import { del, get, keys, set } from 'idb-keyval';
import { t } from '@/i18n';
import { getModel } from '@/models/registry';
import { LAYOUTS, type Layout } from '@/lib/arrange';
import { defaultParams } from '@/models/types';
import { useAssets, type Asset } from './assets';
import {
  DEFAULT_BRAND,
  DEFAULT_CAMERA,
  DEFAULT_DECOR,
  DEFAULT_GROUND,
  DEFAULT_SCREEN,
  initialProject,
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

import { db } from '@/library/db';
import {
  LEGACY_KEY,
  assetKey,
  collectUnusedAssets,
  loadThumbs,
  newId,
  projectKey,
  readIndex,
  rememberCurrent,
  storedCurrent,
  thumbKey,
  upsertMeta,
  useLibrary,
  writeIndex,
  type ProjectMeta,
} from '@/library/store';

interface StoredAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  blob: Blob;
}

export function snapshot(s: ProjectState = useProject.getState()): Project {
  return {
    version: 6,
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
    arrangement: s.arrangement,
  };
}

/** Asset ids a project needs (screens, background image, logos). */
export function referencedAssets(p: Project): Set<string> {
  const ids = new Set<string>();
  for (const it of p.items) for (const b of Object.values(it.surfaces)) if (b.assetId) ids.add(b.assetId);
  if (p.background.kind === 'image' && p.background.assetId) ids.add(p.background.assetId);
  for (const o of p.overlays) if (o.kind === 'logo' && o.assetId) ids.add(o.assetId);
  for (const id of [p.brand?.logoAssetId, p.brand?.heading.assetId, p.brand?.body.assetId]) if (id) ids.add(id);
  return ids;
}

/** Fills anything missing (older versions, hand-edited files) with defaults. */
export function migrateProject(raw: unknown): Project {
  const base = initialProject();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Project> & Record<string, unknown>;
  const items = Array.isArray(r.items)
    ? r.items.map((it) => {
        const model = getModel(it.modelId);
        return {
          ...base.items[0],
          ...it,
          modelId: model.id,
          // walls have no colour of their own any more (v6): they show the background;
          // prints saved before "Adapt to my image" keep their paper's proportions
          params: Object.fromEntries(
            Object.entries({ ...defaultParams(model), ...('fit' in defaultParams(model) && !('fit' in (it.params ?? {})) ? { fit: false } : {}), ...(it.params ?? {}) }).filter(([k]) => k !== 'wall'),
          ),
          screen: { ...DEFAULT_SCREEN, ...(it.screen ?? {}) },
          visible: it.visible ?? true,
          locked: it.locked ?? false,
          pose: it.pose ?? 'standing',
        };
      })
    : base.items;
  const { wall: oldWall, ...rawDecor } = (r.decor ?? {}) as Partial<Project['decor']> & { wall?: string };
  const decor = { ...DEFAULT_DECOR, ...rawDecor };
  // v5 → v6: the wall colour of the table or of a wall object becomes the background, if the background was the default one
  // only a wall that was actually shown (on the wall, wall switched on) gives its colour
  const hanging = Array.isArray(r.items)
    ? r.items.find((it) => {
        const params = { ...defaultParams(getModel(it.modelId)), ...(it.params ?? {}) };
        return typeof params.wall === 'string' && !!getModel(it.modelId).wallFor?.(params);
      })
    : undefined;
  const legacyWall = (decor.kind === 'table' ? oldWall : undefined) ?? (hanging?.params as Record<string, string> | undefined)?.wall;
  const background = r.background && JSON.stringify(r.background) !== JSON.stringify(base.background) ? r.background : legacyWall ? ({ kind: 'solid', color: legacyWall } as const) : (r.background ?? base.background);
  if (!['none', 'sweep', 'podium', 'surface', 'table'].includes(decor.kind)) decor.kind = 'none';
  return {
    ...base,
    name: typeof r.name === 'string' ? r.name : base.name,
    items,
    selectedId: items.some((it) => it.id === r.selectedId) ? (r.selectedId as string) : (items[0]?.id ?? null),
    overlays: Array.isArray(r.overlays) ? r.overlays : [],
    background,
    decor,
    lighting: { ...base.lighting, ...(r.lighting ?? {}) },
    camera: { ...DEFAULT_CAMERA, ...(r.camera ?? {}) },
    ground: { ...DEFAULT_GROUND, ...(r.ground ?? {}) },
    export: { ...base.export, ...(r.export ?? {}), video: { ...base.export.video, ...(r.export?.video ?? {}) } },
    brand: { ...DEFAULT_BRAND, ...(r.brand ?? {}) },
    arrangement: LAYOUTS.includes(r.arrangement as Layout) ? (r.arrangement as Layout) : 'auto',
    version: 6,
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

async function loadAssets(project: Project) {
  const have = useAssets.getState().assets;
  await Promise.all(
    [...referencedAssets(project)].map(async (id) => {
      if (have[id]) return;
      const a = (await get(assetKey(id), db)) as StoredAsset | undefined;
      if (a) addAsset(a);
    }),
  );
}

/** Moves the old single autosave (key 'project') into the library, once. */
async function migrateLegacy() {
  const raw = await get(LEGACY_KEY, db);
  if (!raw) return;
  const project = migrateProject(raw);
  const id = newId();
  await set(projectKey(id), project, db);
  await upsertMeta(metaOf(id, project, 0, false));
  await del(LEGACY_KEY, db);
  rememberCurrent(id);
}

function metaOf(id: string, project: Project, exportCount: number, hasThumb: boolean): ProjectMeta {
  return { id, name: project.name, updatedAt: Date.now(), assets: [...referencedAssets(project)], exportCount, hasThumb };
}

/** Loads one stored project into the editor and makes it the current one. */
async function openStored(id: string): Promise<boolean> {
  const raw = await get(projectKey(id), db);
  if (!raw) return false;
  const project = migrateProject(raw);
  await loadAssets(project);
  rememberCurrent(id);
  withoutSave(() => load(project));
  return true;
}

/** Reads the library and restores the current project (true if there was one). */
export async function restoreProject(): Promise<boolean> {
  try {
    await migrateLegacy();
    const list = await readIndex();
    useLibrary.setState({ list });
    void loadThumbs();
    const wanted = storedCurrent();
    const id = list.find((p) => p.id === wanted)?.id ?? list[0]?.id;
    if (!id) return false;
    return await openStored(id);
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let paused = false;
/** Changes not saved yet. */
let dirty = false;

/** Suspends autosave while the project is changed temporarily (variants, batches); resuming saves. */
export function pauseAutosave(v: boolean, changedMeanwhile = false) {
  paused = v;
  if (changedMeanwhile) dirty = true;
  clearTimeout(timer);
  // resuming saves only what was changed before (or during) the pause, never a staged scene
  if (!v && dirty) schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (paused) return;
    dirty = false;
    void save().catch(() => undefined);
  }, 700);
}

/** Runs `fn` (a load) without scheduling an autosave for it. */
let silent = false;
function withoutSave(fn: () => void) {
  silent = true;
  try {
    fn();
  } finally {
    silent = false;
  }
}

async function save() {
  const project = snapshot();
  let id = useLibrary.getState().currentId;
  if (!id) {
    id = newId();
    rememberCurrent(id);
  }
  const needed = referencedAssets(project);
  const assets = useAssets.getState().assets;
  await set(projectKey(id), project, db);
  const previous = (await readIndex()).find((p) => p.id === id);
  await upsertMeta(metaOf(id, project, previous?.exportCount ?? 0, previous?.hasThumb ?? false));
  const stored = new Set((await keys(db)).map(String).filter((k) => k.startsWith('asset:')).map((k) => k.slice(6)));
  for (const aid of needed) {
    const a = assets[aid];
    if (a && !stored.has(aid)) await set(assetKey(aid), { id: aid, name: a.name, width: a.width, height: a.height, blob: a.blob } satisfies StoredAsset, db);
  }
  // Forget images no project uses any more.
  await collectUnusedAssets(needed);
  useUi.getState().setSavedAt(Date.now());
}

/** Saves the current project now (before switching to another one). */
export async function flushSave() {
  clearTimeout(timer);
  if (paused) {
    // a render sandbox holds a staged scene: stop it, the user's project comes back
    const { cancelSandboxes } = await import('@/variants/render');
    await cancelSandboxes();
    clearTimeout(timer);
  }
  if (!dirty) return;
  dirty = false;
  await save().catch(() => undefined);
}

/** Saves shortly after every change. */
export function startAutosave() {
  const onChange = () => {
    if (silent) return;
    // changes made by a render sandbox are not the user's
    if (paused) return;
    dirty = true;
    schedule();
  };
  useProject.subscribe(onChange);
  useAssets.subscribe(onChange);
}

/* ------------------------------------------------------------ files */

interface ProjectFile {
  app: 'MockupLab';
  format: 1;
  project: Project;
  assets: { id: string; name: string; width: number; height: number; data: string }[];
  /** Imported 3D models used by the project (.glb as data URLs). */
  models?: { id: string; name: string; createdAt: number; meta: unknown; data: string }[];
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
  const { userModelRecord } = await import('@/models/glb/userModels');
  const modelIds = [...new Set(project.items.map((it) => it.modelId).filter((id) => id.startsWith('glb:')))];
  const models = (
    await Promise.all(
      modelIds.map(async (id) => {
        const rec = await userModelRecord(id);
        return rec && { id: rec.id, name: rec.name, createdAt: rec.createdAt, meta: rec.meta, data: await toDataUrl(rec.blob) };
      }),
    )
  ).filter((m): m is NonNullable<typeof m> => !!m);
  const file: ProjectFile = { app: 'MockupLab', format: 1, project, assets, models };
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
  if (parsed.models?.length) {
    const { adoptUserModel } = await import('@/models/glb/userModels');
    for (const m of parsed.models) {
      try {
        const blob = await (await fetch(m.data)).blob();
        await adoptUserModel({ id: m.id, name: m.name, createdAt: m.createdAt, meta: m.meta as never, blob });
      } catch {
        /* the device falls back to the default phone */
      }
    }
  }
  for (const a of parsed.assets ?? []) {
    try {
      const blob = await (await fetch(a.data)).blob();
      addAsset({ id: a.id, name: a.name, width: a.width, height: a.height, blob });
    } catch {
      /* a broken image must not block the rest of the project */
    }
  }
  await flushSave();
  rememberCurrent(null);
  load(migrateProject(parsed.project));
  toast.success(t('project.opened', { name: parsed.project.name || file.name }));
}

export function newProject() {
  void library.create();
}

/* ------------------------------------------------------------ library */

export const library = {
  state: () => useLibrary.getState(),
  /** Opens a stored project (the current one is saved first). */
  async open(id: string) {
    await flushSave();
    return openStored(id);
  },
  /** Starts a fresh project; it is stored at its first change. */
  async create() {
    await flushSave();
    rememberCurrent(null);
    load(initialProject());
  },
  async duplicate(id: string): Promise<string> {
    if (id === useLibrary.getState().currentId) await flushSave();
    const raw = await get(projectKey(id), db);
    if (!raw) return '';
    const project = migrateProject(raw);
    const copy = { ...project, name: t('library.copyOf', { name: project.name === 'Untitled' ? t('project.untitled') : project.name }) };
    const nid = newId();
    await set(projectKey(nid), copy, db);
    const thumb = (await get(thumbKey(id), db)) as Blob | undefined;
    if (thumb) await set(thumbKey(nid), thumb, db);
    await upsertMeta(metaOf(nid, copy, 0, !!thumb));
    void loadThumbs();
    return nid;
  },
  async rename(id: string, name: string) {
    if (id === useLibrary.getState().currentId) {
      useProject.setState({ name: name || 'Untitled' });
      return;
    }
    const raw = await get(projectKey(id), db);
    if (!raw) return;
    await set(projectKey(id), { ...(raw as Project), name }, db);
    const list = await readIndex();
    await writeIndex(list.map((p) => (p.id === id ? { ...p, name } : p)));
  },
  async remove(id: string) {
    const current = useLibrary.getState().currentId === id;
    if (current) {
      const { cancelSandboxes } = await import('@/variants/render');
      await cancelSandboxes();
      clearTimeout(timer);
      dirty = false;
    }
    await del(projectKey(id), db);
    await del(thumbKey(id), db);
    const { deleteAllExports } = await import('@/library/exports');
    await deleteAllExports(id);
    const url = useLibrary.getState().thumbs[id];
    if (url) URL.revokeObjectURL(url);
    await writeIndex((await readIndex()).filter((p) => p.id !== id));
    if (current) {
      rememberCurrent(null);
      withoutSave(() => load(initialProject()));
    }
    await collectUnusedAssets(current ? [] : referencedAssets(snapshot()));
  },
};
