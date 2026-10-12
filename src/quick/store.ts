import { create } from 'zustand';
import { t, useLang, type I18nString } from '@/i18n';
import { download, formatBytes, slugify } from '@/export/exportImage';
import { fileToAsset } from '@/lib/importImage';
import { expandPdfs, isPdf } from '@/lib/pdf';
import { sampleAsset } from '@/lib/samples';
import { ZipWriter } from '@/lib/zip';
import { getModel } from '@/models/registry';
import { CAMERA_PRESETS } from '@/scene/camera';
import { SCENE_PRESETS, applyScenePreset } from '@/scene/scenePresets';
import { snapshot } from '@/store/persistence';
import { makeItem, useProject, type Project, type SceneItem } from '@/store/project';
import { useAssets } from '@/store/assets';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { AXES, applyLook, generateLooks, type Look } from '@/variants/looks';
import { inSandbox, renderFull, renderThumb, settleScene, whenIdle } from '@/variants/render';
import { SUPPORT_MODELS, detectSupport, type Support } from './detect';
import { TEMPLATES, type QuickTag, type QuickTemplate } from './templates';

/*
 * Quick mode: the user's design (or a sample) on the device that suits it,
 * rendered in every ready-made scene. Thumbnails are rendered one at a time
 * in the variants sandbox, so the user's project is never touched.
 */

/** A gallery entry: a ready-made template, or an extra look from "More ideas". */
export type QuickTile = { id: string; label: I18nString | string; tags: QuickTag[]; template?: QuickTemplate; look?: Look };

interface QuickState {
  assetId: string | null;
  support: Support;
  confident: boolean;
  filter: QuickTag | 'all';
  tiles: QuickTile[];
  thumbs: Record<string, string>;
  selected: string[];
  busy: string | null;
}

const ITEM_ID = 'quick-item';
const ANGLE: Partial<Record<string, I18nString>> = {
  front: { fr: 'face', en: 'front' },
  low: { fr: 'contre-plongée', en: 'low angle' },
};
const initialTiles = (): QuickTile[] =>
  TEMPLATES.map((tpl) => {
    const preset = SCENE_PRESETS.find((p) => p.id === tpl.preset)!;
    const angle = tpl.camera && ANGLE[tpl.camera];
    const label = angle ? { fr: `${preset.name.fr} · ${angle.fr}`, en: `${preset.name.en} · ${angle.en}` } : preset.name;
    return { id: tpl.id, label, tags: tpl.tags, template: tpl };
  });

export const useQuick = create<QuickState>(() => ({ assetId: null, support: 'phone', confident: true, filter: 'all', tiles: initialTiles(), thumbs: {}, selected: [], busy: null }));
const set = useQuick.setState;
const get = useQuick.getState;

let run = 0;

/** The device of the current support, with the design (or a sample) on its first face. */
async function stagedItem(): Promise<SceneItem> {
  const { support, assetId } = get();
  const model = getModel(SUPPORT_MODELS[support]);
  const item = { ...makeItem(model), id: ITEM_ID };
  const slot = model.surfaces[0];
  if (!slot) return item;
  const id = assetId ?? (await sampleAsset(slot.aspect < 1 ? 'sample-app.png' : 'sample-web.png'));
  item.surfaces = { ...item.surfaces, [slot.id]: { ...item.surfaces[slot.id], assetId: id, align: 0 } };
  if (!assetId && model.surfaces.length > 1) {
    const { loadSamples } = await import('@/lib/samples');
    useProject.setState({ items: [item], selectedId: item.id });
    await loadSamples(item.id);
    return useProject.getState().items[0];
  }
  return item;
}

/** Puts a tile's scene in the (sandboxed or real) project. */
async function stage(tile: QuickTile) {
  const item = await stagedItem();
  useProject.setState({ mode: 'scene', items: [item], selectedId: item.id, overlays: [] });
  if (tile.look) {
    applyLook(tile.look);
    return;
  }
  const tpl = tile.template!;
  applyScenePreset(SCENE_PRESETS.find((p) => p.id === tpl.preset)!);
  if (tpl.camera) {
    useProject.getState().setCamera({ preset: tpl.camera });
    useProject.getState().setPose(CAMERA_PRESETS[tpl.camera as keyof typeof CAMERA_PRESETS]?.flat ? 'flat' : 'standing');
  }
}

const visible = () => {
  const { tiles, filter } = get();
  return filter === 'all' ? tiles : tiles.filter((x) => x.tags.includes(filter));
};

/** Renders the visible thumbnails still missing, in order; a newer call cancels this one. */
async function renderMissing() {
  const token = ++run;
  const todo = () => visible().filter((x) => !get().thumbs[x.id]);
  if (!todo().length || useUi.getState().screen !== 'quick') return;
  await inSandbox(async () => {
    for (let next = todo()[0]; next && token === run && useUi.getState().screen === 'quick'; next = todo()[0]) {
      await stage(next);
      await settleScene();
      if (token !== run) break;
      const url = await renderThumb();
      set((s) => ({ thumbs: { ...s.thumbs, [next.id]: url } }));
    }
  }).catch(() => undefined);
}

function dropThumbs() {
  for (const url of Object.values(get().thumbs)) URL.revokeObjectURL(url);
  set({ thumbs: {} });
}

export const labelOf = (tile: QuickTile) => (typeof tile.label === 'string' ? tile.label : tile.label[useLang.getState().lang]);

export const quick = {
  state: get,
  detectSupport,
  /** Starts (or resumes) rendering; called when the Quick screen shows. */
  start() {
    void renderMissing();
  },
  stop() {
    run++;
  },
  async setImage(input: File) {
    const pdf = isPdf(input);
    const [file] = await expandPdfs([input]);
    if (!file) return;
    const asset = await fileToAsset(file, file.name || 'image');
    useAssets.getState().add(asset);
    const { support, confident } = detectSupport(asset.width, asset.height, pdf);
    dropThumbs();
    set({ assetId: asset.id, support, confident, selected: [] });
    void renderMissing();
  },
  setSupport(support: Support) {
    if (support === get().support) return;
    dropThumbs();
    set({ support, confident: true });
    void renderMissing();
  },
  setFilter(filter: QuickState['filter']) {
    set({ filter });
    void renderMissing();
  },
  /** Re-renders everything (the output format changed). */
  refresh() {
    dropThumbs();
    void renderMissing();
  },
  toggle(id: string) {
    set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] }));
  },
  /** Six more looks generated around the current device. */
  async more() {
    const base: Project = { ...snapshot(), items: [await (async () => ({ ...makeItem(getModel(SUPPORT_MODELS[get().support])), id: ITEM_ID }))()] };
    const looks = generateLooks(6, AXES, Math.floor(Math.random() * 1e9), base);
    set((s) => ({ tiles: [...s.tiles, ...looks.map((look) => ({ id: look.id, label: look.label, tags: [] as QuickTag[], look }))], filter: 'all' }));
    void renderMissing();
  },
  /** Renders tiles at the export settings: one file, or a ZIP. */
  async download(ids: string[]) {
    const tiles = get().tiles.filter((x) => ids.includes(x.id));
    if (!tiles.length || get().busy) return;
    run++;
    set({ busy: ids[0] });
    try {
      const files = await inSandbox(async () => {
        const out: { name: string; blob: Blob }[] = [];
        for (const tile of tiles) {
          await stage(tile);
          await settleScene();
          const r = await renderFull();
          out.push({ name: `mockuplab-${slugify(labelOf(tile)) || 'mockup'}-${r.width}x${r.height}.${r.ext}`, blob: r.blob });
        }
        return out;
      });
      if (files.length === 1) download(files[0].blob, files[0].name);
      else {
        const zip = new ZipWriter();
        for (const f of files) await zip.add(f.name, f.blob);
        const blob = zip.finish();
        download(blob, `mockuplab-rapide-${files.length}.zip`);
        toast.success(t('variants.exported', { n: files.length, size: formatBytes(blob.size) }));
      }
    } catch (e) {
      toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      set({ busy: null });
      void renderMissing();
    }
  },
  /** Makes this mock-up the project's scene, then opens the Studio. */
  async customize(id: string, open: () => void) {
    const tile = get().tiles.find((x) => x.id === id);
    if (!tile) return;
    run++;
    await whenIdle();
    await stage(tile);
    const real = useProject.getState().items[0];
    // a real id, so later devices and undo behave as usual
    const fresh = { ...real, id: Math.random().toString(36).slice(2, 10) };
    useProject.setState({ items: [fresh], selectedId: fresh.id });
    open();
    useUi.getState().resetView();
  },
};
