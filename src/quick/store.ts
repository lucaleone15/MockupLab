import { create } from 'zustand';
import { t, useLang, type I18nString } from '@/i18n';
import { download, formatBytes, slugify } from '@/export/exportImage';
import { fileToAsset } from '@/lib/importImage';
import { expandPdfs, isPdf } from '@/lib/pdf';
import { sampleAsset } from '@/lib/samples';
import { ZipWriter } from '@/lib/zip';
import { getModel } from '@/models/registry';
import { applyStudioLook } from '@/scene/studioLooks';
import { makeItem, useProject, type SceneItem } from '@/store/project';
import { useAssets } from '@/store/assets';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { inSandbox, onCancelSandboxes, renderFull, renderThumb, settleScene, whenIdle } from '@/variants/render';
import { detectSupport, modelForSupport, type Support } from './detect';
import { QUICK_COLORS, SHOTS, type ShotId } from './templates';

/*
 * Quick mode: the user's design (or a sample) on the device that suits it,
 * in a plain photo studio of the picked colour, seen six ways. Thumbnails are
 * rendered one at a time in the variants sandbox, so the user's project is
 * never touched.
 */

export type QuickTile = { id: ShotId; label: I18nString };

interface QuickState {
  assetId: string | null;
  support: Support;
  confident: boolean;
  /** The studio's colour. */
  color: string;
  tiles: QuickTile[];
  thumbs: Record<string, string>;
  /** What each thumbnail shows (support|design|ratio|colour), to never keep a stale one. */
  thumbKeys: Record<string, string>;
  selected: string[];
  busy: string | null;
  /** The support was picked by hand (not detected). */
  byHand: boolean;
}

const ITEM_ID = 'quick-item';
/** Devices that can lie flat on the floor (a framed poster cannot). */
const LIES_FLAT: Support[] = ['phone', 'tablet', 'print', 'watch', 'browser'];
const liesFlat = () => LIES_FLAT.includes(get().support) && modelOfCurrent() !== 'poster';

export const useQuick = create<QuickState>(() => ({ assetId: null, support: 'phone', confident: true, color: QUICK_COLORS[0].hex, tiles: SHOTS, thumbs: {}, thumbKeys: {}, selected: [], busy: null, byHand: false }));
const set = useQuick.setState;
const get = useQuick.getState;

let run = 0;
onCancelSandboxes(() => run++);

const currentKey = () => `${get().support}|${get().assetId ?? 'sample'}|${useProject.getState().export.ratio}|${get().color}`;

/** The model the current support is shown on, for the current image. */
function modelOfCurrent() {
  const { support, assetId } = get();
  const asset = assetId ? useAssets.getState().assets[assetId] : undefined;
  return modelForSupport(support, asset?.width, asset?.height);
}

/** The device of the current support, with the design (or a sample) on its first face. */
async function stagedItem(): Promise<SceneItem> {
  const { assetId } = get();
  const model = getModel(modelOfCurrent());
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

/** Puts a shot in the (sandboxed or real) project. */
async function stage(tile: QuickTile) {
  const item = await stagedItem();
  // two of the same device, side by side
  const items = tile.id === 'pair' ? [item, { ...item, id: `${ITEM_ID}-2` }] : [item];
  useProject.setState({ items, selectedId: item.id, overlays: [] });
  applyStudioLook(tile.id === 'podium' ? 'podium' : 'studio', get().color);
  const p = useProject.getState();
  // flat things lie on the floor; a laptop or a screen is seen from high up instead
  const flat = liesFlat();
  if (tile.id === 'front') p.setCamera({ preset: 'front' });
  if (tile.id === 'top') {
    if (flat) p.setPose('flat');
    p.setCamera({ preset: flat ? 'top' : 'high' });
    // seen from above, a soft shadow would ring the device with grey
    p.setGround({ shadow: 'contact', shadowOpacity: 0.12 });
  }
  // a longer lens, closer, with a soft background (a tall device lies down, so the close-up runs along it)
  if (tile.id === 'close') {
    if (flat) p.setPose('flat');
    p.setCamera({ preset: flat ? 'high' : 'threeQuarter', zoom: flat ? 1.5 : 1.8, focal: 85, dof: true, aperture: 0.45 });
  }
  if (tile.id === 'pair') p.arrange('auto');
}

/** Renders the thumbnails still missing, in order; a newer call cancels this one. */
async function renderMissing() {
  const token = ++run;
  const todo = () => get().tiles.filter((x) => !get().thumbs[x.id]);
  if (!todo().length || useUi.getState().screen !== 'quick') return;
  await inSandbox(async () => {
    for (let next = todo()[0]; next && token === run && useUi.getState().screen === 'quick'; next = todo()[0]) {
      const key = currentKey();
      await stage(next);
      await settleScene();
      if (token !== run) break;
      const url = await renderThumb();
      // the support, design, format or colour changed while it rendered: drop it, it will be redone
      if (token !== run || key !== currentKey()) {
        URL.revokeObjectURL(url);
        break;
      }
      set((s) => ({ thumbs: { ...s.thumbs, [next.id]: url }, thumbKeys: { ...s.thumbKeys, [next.id]: key } }));
    }
  }).catch(() => undefined);
}

function dropThumbs() {
  run++;
  for (const url of Object.values(get().thumbs)) URL.revokeObjectURL(url);
  set({ thumbs: {}, thumbKeys: {} });
}

export const labelOf = (tile: QuickTile) => tile.label[useLang.getState().lang];

export const quick = {
  state: get,
  detectSupport,
  modelForSupport,
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
    const { support, confident } = detectSupport(asset.width, asset.height, pdf, file.name);
    dropThumbs();
    set({ assetId: asset.id, support, confident, selected: [], byHand: false });
    void renderMissing();
  },
  setSupport(support: Support) {
    if (support === get().support) return;
    dropThumbs();
    set({ support, confident: true, byHand: true });
    void renderMissing();
  },
  setColor(color: string) {
    if (color === get().color) return;
    dropThumbs();
    set({ color });
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
    // real ids, so later devices and undo behave as usual
    const items = useProject.getState().items.map((it) => ({ ...it, id: Math.random().toString(36).slice(2, 10) }));
    useProject.setState({ items, selectedId: items[0].id });
    open();
    useUi.getState().resetView();
  },
};
