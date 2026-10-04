import { createStore, del, get, keys, set } from 'idb-keyval';
import { t } from '@/i18n';
import { getModel } from '@/models/registry';
import { defaultParams } from '@/models/types';
import { useAssets, type Asset } from './assets';
import {
  DEFAULT_BRAND,
  DEFAULT_CAMERA,
  DEFAULT_DECOR,
  DEFAULT_GROUND,
  DEFAULT_SCREEN,
  DEFAULT_SURFACE,
  EMPTY_PHOTO,
  initialProject,
  zoneDefaults,
  useProject,
  type Project,
  type ProjectState,
} from './project';
import { toast } from './toasts';
import { useUi } from './ui';

/*
 * Local persistence: the project autosaves to IndexedDB (images included, as
 * blobs), and can be exported / imported as a single JSON file with the
 * images embedded. Nothing ever leaves the browser.
 */

const db = createStore('mockuplab', 'kv');
const PROJECT_KEY = 'project';
const assetKey = (id: string) => `asset:${id}`;

interface StoredAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  blob: Blob;
}

export function snapshot(s: ProjectState = useProject.getState()): Project {
  return {
    version: 5,
    mode: s.mode,
    photo: s.photo,
    brand: s.brand,
    name: s.name,
    items: s.items,
    selectedId: s.selectedId,
    overlays: s.overlays,
    background: s.background,
    decor: s.decor,
    lighting: s.lighting,
    camera: s.camera,
    ground: s.ground,
    export: s.export,
  };
}

/** Asset ids a project needs (screens, background image, logos). */
export function referencedAssets(p: Project): Set<string> {
  const ids = new Set<string>();
  for (const it of p.items) for (const b of Object.values(it.surfaces)) if (b.assetId) ids.add(b.assetId);
  if (p.background.kind === 'image' && p.background.assetId) ids.add(p.background.assetId);
  for (const o of p.overlays) if (o.kind === 'logo' && o.assetId) ids.add(o.assetId);
  for (const id of [p.brand?.logoAssetId, p.brand?.heading.assetId, p.brand?.body.assetId]) if (id) ids.add(id);
  if (p.photo?.assetId) ids.add(p.photo.assetId);
  for (const z of p.photo?.zones ?? []) if (z.surface.assetId) ids.add(z.surface.assetId);
  return ids;
}

/** Fills anything missing (older versions, hand-edited files) with defaults. */
export function migrateProject(raw: unknown): Project {
  const base = initialProject();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Project> & Record<string, unknown>;
  const items = Array.isArray(r.items) && r.items.length
    ? r.items.map((it) => {
        const model = getModel(it.modelId);
        return {
          ...base.items[0],
          ...it,
          modelId: model.id,
          params: { ...defaultParams(model), ...(it.params ?? {}) },
          screen: { ...DEFAULT_SCREEN, ...(it.screen ?? {}) },
          visible: it.visible ?? true,
          locked: it.locked ?? false,
          pose: it.pose ?? 'standing',
        };
      })
    : base.items;
  const decor = { ...DEFAULT_DECOR, ...(r.decor ?? {}) };
  const rawPhoto = (r.photo ?? {}) as Partial<Project['photo']>;
  const zones = Array.isArray(rawPhoto.zones)
    ? rawPhoto.zones
        .filter((z) => Array.isArray(z?.corners) && z.corners.length === 4)
        .map((z) => ({
          ...zoneDefaults(z.kind === 'print' ? 'print' : 'screen'),
          ...z,
          name: z.name ?? '',
          visible: z.visible ?? true,
          aspect: z.aspect > 0 ? z.aspect : 1,
          aspectAuto: z.aspectAuto ?? false,
          surface: { ...DEFAULT_SURFACE, ...(z.surface ?? {}) },
        }))
    : [];
  const photo = {
    ...EMPTY_PHOTO,
    ...rawPhoto,
    zones,
    selectedZoneId: zones.some((z) => z.id === rawPhoto.selectedZoneId) ? (rawPhoto.selectedZoneId as string) : (zones[0]?.id ?? null),
  };
  if (!['none', 'sweep', 'podium', 'surface', 'table'].includes(decor.kind)) decor.kind = 'none';
  return {
    ...base,
    name: typeof r.name === 'string' ? r.name : base.name,
    items,
    selectedId: items.some((it) => it.id === r.selectedId) ? (r.selectedId as string) : items[0].id,
    overlays: Array.isArray(r.overlays) ? r.overlays : [],
    background: r.background ?? base.background,
    decor,
    lighting: { ...base.lighting, ...(r.lighting ?? {}) },
    camera: { ...DEFAULT_CAMERA, ...(r.camera ?? {}) },
    ground: { ...DEFAULT_GROUND, ...(r.ground ?? {}) },
    export: { ...base.export, ...(r.export ?? {}) },
    brand: { ...DEFAULT_BRAND, ...(r.brand ?? {}) },
    mode: r.mode === 'photo' ? 'photo' : 'scene',
    photo,
    version: 5,
  };
}

function addAsset(a: StoredAsset) {
  const asset: Asset = { ...a, url: URL.createObjectURL(a.blob) };
  useAssets.getState().add(asset);
}

/** Registers the brand's imported typefaces with the document. */
async function registerBrandFonts(project: Project) {
  const { registerFontAsset } = await import('@/lib/brandFonts');
  for (const f of [project.brand.heading, project.brand.body]) if (f.assetId) await registerFontAsset(f.assetId, f.family).catch(() => undefined);
}

function load(project: Project) {
  void registerBrandFonts(project);
  useProject.getState().loadProject(project);
  useProject.temporal.getState().clear();
  useUi.getState().selectOverlay(null);
  useUi.getState().resetView();
}

/** Restores the autosaved project, if any. */
export async function restoreProject(): Promise<boolean> {
  try {
    const raw = await get(PROJECT_KEY, db);
    if (!raw) return false;
    const project = migrateProject(raw);
    await Promise.all(
      [...referencedAssets(project)].map(async (id) => {
        const a = (await get(assetKey(id), db)) as StoredAsset | undefined;
        if (a) addAsset(a);
      }),
    );
    load(project);
    return true;
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

async function save() {
  const project = snapshot();
  const needed = referencedAssets(project);
  const assets = useAssets.getState().assets;
  await set(PROJECT_KEY, project, db);
  const stored = new Set((await keys(db)).map(String).filter((k) => k.startsWith('asset:')).map((k) => k.slice(6)));
  for (const id of needed) {
    const a = assets[id];
    if (a && !stored.has(id)) await set(assetKey(id), { id, name: a.name, width: a.width, height: a.height, blob: a.blob } satisfies StoredAsset, db);
  }
  // Forget images no longer used by the project.
  for (const id of stored) if (!needed.has(id)) await del(assetKey(id), db);
  useUi.getState().setSavedAt(Date.now());
}

/** Saves shortly after every change. */
export function startAutosave() {
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void save().catch(() => undefined), 700);
  };
  useProject.subscribe(schedule);
  useAssets.subscribe(schedule);
}

/* ------------------------------------------------------------ files */

interface ProjectFile {
  app: 'MockupLab';
  format: 1;
  project: Project;
  assets: { id: string; name: string; width: number; height: number; data: string }[];
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function exportProjectFile(): Promise<{ blob: Blob; filename: string }> {
  const project = snapshot();
  const all = useAssets.getState().assets;
  const assets = await Promise.all(
    [...referencedAssets(project)]
      .filter((id) => all[id])
      .map(async (id) => ({ id, name: all[id].name, width: all[id].width, height: all[id].height, data: await toDataUrl(all[id].blob) })),
  );
  const file: ProjectFile = { app: 'MockupLab', format: 1, project, assets };
  const slug = (project.name || 'projet').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'projet';
  return { blob: new Blob([JSON.stringify(file)], { type: 'application/json' }), filename: `${slug}.mockuplab.json` };
}

export async function importProjectFile(file: File) {
  let parsed: ProjectFile;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    toast.error(t('project.invalid'));
    return;
  }
  if (parsed?.app !== 'MockupLab' || !parsed.project) {
    toast.error(t('project.invalid'));
    return;
  }
  for (const a of parsed.assets ?? []) {
    try {
      const blob = await (await fetch(a.data)).blob();
      addAsset({ id: a.id, name: a.name, width: a.width, height: a.height, blob });
    } catch {
      /* a broken image must not block the rest of the project */
    }
  }
  load(migrateProject(parsed.project));
  toast.success(t('project.opened', { name: parsed.project.name || file.name }));
}

export function newProject() {
  load(initialProject());
}
