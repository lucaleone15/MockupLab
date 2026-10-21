import { create } from 'zustand';
import { t } from '@/i18n';
import { download, formatBytes, slugify } from '@/export/exportImage';
import { fileToAsset } from '@/lib/importImage';
import { expandPdfs, isPdf, pdfPageCount, pdfToImage } from '@/lib/pdf';
import { ZipWriter } from '@/lib/zip';
import { getModel } from '@/models/registry';
import { applyStudioLook, type StudioLook } from '@/scene/studioLooks';
import { useAssets } from '@/store/assets';
import { makeItem, useProject, type SceneItem } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { inSandbox, onCancelSandboxes, renderFull, renderThumb, settleScene, whenIdle } from '@/variants/render';
import { detectSupport, modelForSupport, type Support } from '@/quick/detect';
import { composeBoard } from './board';
import { lighten } from '@/lib/color';
import { DEFAULT_PALETTE, harmonize, imageColors } from './palettes';

/*
 * Project mode: several images of one project (website, app, print…), each
 * on the support that suits it, in one shared style: a hero scene with the
 * supports together, one mock-up per image, and an optional board.
 */

export interface PackFile {
  id: string;
  name: string;
  assetId: string;
  support: Support;
  confident: boolean;
  /** First page of a longer PDF: its other pages can be added. */
  pdf?: { file: File; pages: number };
}

/** Plain studio looks, all in the pack's colours. */
export const STYLES: StudioLook[] = ['studio', 'podium', 'dark'];
/** Which supports go in the hero first (at most five). */
const HERO_ORDER: Support[] = ['laptop', 'browser', 'phone', 'tablet', 'print', 'screen', 'objects', 'watch'];
const HERO_MAX = 5;

/** Colours of the pack: detected from the images, then the user's to change. */
export interface PackColors {
  palette: string[];
  /** Each visual takes the palette's colours in turn instead of all the first one. */
  vary: boolean;
  /** A colour of its own for one scene ('hero' or a file id). */
  perScene: Record<string, string>;
  /** The designs' own colours, offered when picking a colour. */
  imageColors: string[];
  /** Changed by hand: new images no longer redo the palette. */
  edited: boolean;
}

const MAX_COLORS = 5;
const NO_COLORS: PackColors = { palette: DEFAULT_PALETTE, vary: false, perScene: {}, imageColors: [], edited: false };

interface PackState {
  files: PackFile[];
  style: StudioLook;
  colors: PackColors;
  board: boolean;
  thumbs: { hero?: string; items: Record<string, string>; styles: Record<string, string>; board?: string };
  busy: boolean;
}

export const usePack = create<PackState>(() => ({ files: [], style: STYLES[0], colors: NO_COLORS, board: true, thumbs: { items: {}, styles: {} }, busy: false }));
const set = usePack.setState;
const get = usePack.getState;
let run = 0;
onCancelSandboxes(() => run++);

const uid = () => Math.random().toString(36).slice(2, 10);

/** In the hero every support stands on the same floor: print is a flyer, not a frame on the wall. */
const HERO_MODELS: Partial<Record<Support, string>> = { print: 'flyer' };

function deviceFor(file: PackFile, hero = false): SceneItem {
  const asset = useAssets.getState().assets[file.assetId];
  const model = getModel((hero && HERO_MODELS[file.support]) || modelForSupport(file.support, asset?.width, asset?.height));
  const item = makeItem(model);
  const slot = model.surfaces[0];
  if (slot) item.surfaces = { ...item.surfaces, [slot.id]: { ...item.surfaces[slot.id], assetId: file.assetId, align: 0 } };
  return item;
}

/** One image per support, in hero order, five at most. */
export function heroFiles(files = get().files): PackFile[] {
  const out: PackFile[] = [];
  for (const s of HERO_ORDER) {
    const f = files.find((x) => x.support === s);
    if (f) out.push(f);
    if (out.length === HERO_MAX) break;
  }
  return out;
}

/** Puts the hero (all supports) or one image's mock-up in the project, in a style. */
function stage(target: 'hero' | string, style = get().style) {
  const files = target === 'hero' ? heroFiles() : get().files.filter((f) => f.id === target);
  const items = files.map((f) => deviceFor(f, target === 'hero'));
  useProject.setState({ items, selectedId: items[0]?.id ?? null, overlays: [] });
  applyStudioLook(style, sceneColor(target));
  if (items.length > 1) useProject.getState().arrange('auto');
}

/** The pack colour of a scene: its own, the palette's next one (one per visual) or the first one. */
function sceneColor(target: 'hero' | string): string {
  const { palette, vary, perScene } = get().colors;
  if (perScene[target]) return perScene[target];
  if (!vary) return palette[0];
  const i = target === 'hero' ? 0 : get().files.findIndex((f) => f.id === target) + 1;
  return palette[Math.max(0, i) % palette.length];
}

/** Reads the images' colours; the palette follows them until it is changed by hand. */
async function suggest() {
  const urls = get().files.map((f) => useAssets.getState().assets[f.assetId]?.url).filter((u): u is string => !!u);
  const found = await imageColors(urls);
  set((s) => ({ colors: { ...s.colors, imageColors: found, palette: s.colors.edited ? s.colors.palette : harmonize(found) } }));
}

const hex = (v: string) => v.trim().toLowerCase();

function editPalette(palette: string[]) {
  set((s) => ({ colors: { ...s.colors, palette, edited: true } }));
  changed(true);
}

const revoke = (url?: string) => url && URL.revokeObjectURL(url);

function dropPackThumbs(withStyles: boolean) {
  const { thumbs } = get();
  revoke(thumbs.hero);
  revoke(thumbs.board);
  Object.values(thumbs.items).forEach(revoke);
  if (withStyles) Object.values(thumbs.styles).forEach(revoke);
  set({ thumbs: { items: {}, styles: withStyles ? {} : thumbs.styles } });
}

const boardInput = (hero: string, shots: string[]) => {
  const p = useProject.getState();
  const { palette } = get().colors;
  // the board wears the pack's colours (with the brand's names when they are the brand's)
  const isBrand = palette.join() === p.brand.colors.map((c) => c.hex.toLowerCase()).join();
  const brand = isBrand ? p.brand : { ...p.brand, colors: palette.map((hex) => ({ hex, name: '' })) };
  return { hero, shots, name: p.name === 'Untitled' ? '' : p.name, brand, logo: p.brand.logoAssetId ? useAssets.getState().assets[p.brand.logoAssetId]?.url : undefined };
};

/** Renders the missing previews: styles first, then the pack; a newer call cancels this one. */
async function renderMissing() {
  const token = ++run;
  if (!get().files.length || useUi.getState().screen !== 'project') return;
  const alive = () => token === run && useUi.getState().screen === 'project';
  await inSandbox(async () => {
    for (const style of STYLES) {
      if (!alive()) return;
      if (get().thumbs.styles[style]) continue;
      stage('hero', style);
      await settleScene();
      const url = await renderThumb();
      if (!alive()) return void URL.revokeObjectURL(url);
      set((s) => ({ thumbs: { ...s.thumbs, styles: { ...s.thumbs.styles, [style]: url } } }));
    }
    if (alive() && !get().thumbs.hero) {
      stage('hero');
      await settleScene();
      const url = await renderThumb();
      if (!alive()) return void URL.revokeObjectURL(url);
      set((s) => ({ thumbs: { ...s.thumbs, hero: url } }));
    }
    for (const f of get().files) {
      if (!alive()) return;
      if (get().thumbs.items[f.id]) continue;
      stage(f.id);
      await settleScene();
      const url = await renderThumb();
      if (!alive()) return void URL.revokeObjectURL(url);
      set((s) => ({ thumbs: { ...s.thumbs, items: { ...s.thumbs.items, [f.id]: url } } }));
    }
  }).catch(() => undefined);
  const { thumbs, board, files } = get();
  if (alive() && board && thumbs.hero && !thumbs.board) {
    const canvas = await composeBoard({ ...boardInput(thumbs.hero, files.map((f) => thumbs.items[f.id]).filter(Boolean)), width: 960 });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    if (blob && alive()) set((s) => ({ thumbs: { ...s.thumbs, board: URL.createObjectURL(blob) } }));
  }
}

function changed(styles: boolean) {
  run++;
  dropPackThumbs(styles);
  void renderMissing();
}

export const pack = {
  state: get,
  start() {
    void renderMissing();
  },
  stop() {
    run++;
  },
  async add(input: Iterable<File>) {
    const added: PackFile[] = [];
    for (const original of input) {
      const pdf = isPdf(original);
      const [file] = pdf ? await expandPdfs([original]) : [original];
      if (!file || !file.type.startsWith('image/')) continue;
      const asset = await fileToAsset(file, file.name || 'image');
      useAssets.getState().add(asset);
      const { support, confident } = detectSupport(asset.width, asset.height, pdf, file.name);
      const pages = pdf ? await pdfPageCount(original) : 0;
      added.push({ id: uid(), name: file.name, assetId: asset.id, support, confident, pdf: pages > 1 ? { file: original, pages } : undefined });
    }
    if (!added.length) return;
    set((s) => ({ files: [...s.files, ...added] }));
    await suggest();
    changed(true);
  },
  /** Adds the other pages of a PDF whose first page is in the pack. */
  async addPdfPages(id: string) {
    const row = get().files.find((f) => f.id === id);
    if (!row?.pdf) return;
    const { file, pages } = row.pdf;
    set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, pdf: undefined } : f)) }));
    const added: PackFile[] = [];
    for (let n = 2; n <= pages; n++) {
      try {
        const img = await pdfToImage(file, n);
        const asset = await fileToAsset(img, img.name);
        useAssets.getState().add(asset);
        added.push({ id: uid(), name: img.name, assetId: asset.id, support: row.support, confident: true });
      } catch {
        toast.error(t('pdf.error', { name: file.name }));
        break;
      }
    }
    const i = get().files.findIndex((f) => f.id === id);
    set((s) => ({ files: [...s.files.slice(0, i + 1), ...added, ...s.files.slice(i + 1)] }));
    changed(true);
  },
  /** One mock-up of the pack at the export settings. */
  async downloadOne(target: 'hero' | string) {
    if (get().busy) return;
    run++;
    set({ busy: true });
    try {
      const file = get().files.find((f) => f.id === target);
      const r = await inSandbox(async () => {
        stage(target);
        await settleScene();
        return renderFull();
      });
      const base = target === 'hero' ? 'hero' : slugify((file?.name ?? 'mockup').replace(/\.[^.]+$/, '')) || 'mockup';
      download(r.blob, `mockuplab-${base}-${r.width}x${r.height}.${r.ext}`);
    } catch (e) {
      toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      set({ busy: false });
      void renderMissing();
    }
  },
  remove(id: string) {
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
    void suggest().then(() => changed(true));
  },
  /** One colour of the palette, changed by hand. */
  setColor(i: number, value: string) {
    const c = hex(value);
    const { palette } = get().colors;
    if (!/^#[0-9a-f]{6}$/.test(c) || !palette[i] || palette[i] === c) return;
    editPalette(palette.map((x, j) => (j === i ? c : x)));
  },
  /** One more colour: an image colour not yet used, or a lighter tone of the last one. */
  addColor() {
    const { palette, imageColors: found } = get().colors;
    if (palette.length >= MAX_COLORS) return;
    editPalette([...palette, found.find((x) => !palette.includes(x)) ?? lighten(palette[palette.length - 1], 0.12)]);
  },
  removeColor(i: number) {
    const { palette } = get().colors;
    if (palette.length <= 1) return;
    editPalette(palette.filter((_, j) => j !== i));
  },
  /** The brand's colours as the palette. */
  takeBrand() {
    const colors = useProject.getState().brand.colors.map((c) => hex(c.hex)).slice(0, MAX_COLORS);
    if (colors.length) editPalette(colors);
  },
  /** Back to the palette detected from the images. */
  redetect() {
    set((s) => ({ colors: { ...s.colors, palette: harmonize(s.colors.imageColors), perScene: {}, edited: false } }));
    changed(true);
  },
  setVary(vary: boolean) {
    set((s) => ({ colors: { ...s.colors, vary } }));
    changed(true);
  },
  /** A colour of its own for one scene (null: back to the pack's). */
  setSceneColor(target: 'hero' | string, color: string | null) {
    set((s) => {
      const perScene = { ...s.colors.perScene };
      if (color) perScene[target] = color;
      else delete perScene[target];
      return { colors: { ...s.colors, perScene } };
    });
    changed(true);
  },
  sceneColor,
  move(id: string, delta: -1 | 1) {
    const files = [...get().files];
    const i = files.findIndex((f) => f.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= files.length) return;
    [files[i], files[j]] = [files[j], files[i]];
    set({ files });
    changed(false);
  },
  setSupport(id: string, support: Support) {
    set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, support, confident: true } : f)) }));
    changed(true);
  },
  setStyle(style: StudioLook) {
    if (style === get().style) return;
    set({ style });
    changed(false);
  },
  setBoard(board: boolean) {
    set({ board });
    if (board) void renderMissing();
  },
  /** Everything at the export settings, in one ZIP. */
  async downloadZip() {
    if (!get().files.length || get().busy) return;
    run++;
    set({ busy: true });
    try {
      const { files, board } = get();
      const out = await inSandbox(async () => {
        const list: { name: string; blob: Blob; url: string }[] = [];
        stage('hero');
        await settleScene();
        let r = await renderFull();
        list.push({ name: `00-hero-${r.width}x${r.height}.${r.ext}`, blob: r.blob, url: URL.createObjectURL(r.blob) });
        for (const [i, f] of files.entries()) {
          stage(f.id);
          await settleScene();
          r = await renderFull();
          list.push({ name: `${String(i + 1).padStart(2, '0')}-${slugify(f.name.replace(/\.[^.]+$/, '')) || 'mockup'}.${r.ext}`, blob: r.blob, url: URL.createObjectURL(r.blob) });
        }
        return list;
      });
      const zip = new ZipWriter();
      for (const f of out) await zip.add(f.name, f.blob);
      if (board) {
        const canvas = await composeBoard({ ...boardInput(out[0].url, out.slice(1).map((f) => f.url)), width: 3000 });
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
        await zip.add('planche.png', blob);
      }
      out.forEach((f) => URL.revokeObjectURL(f.url));
      const blob = zip.finish();
      const name = useProject.getState().name;
      download(blob, `mockuplab-${slugify(name === 'Untitled' ? 'pack' : name) || 'pack'}.zip`);
      toast.success(t('variants.exported', { n: zip.size, size: formatBytes(blob.size) }));
    } catch (e) {
      toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      set({ busy: false });
      void renderMissing();
    }
  },
  /** Makes the hero (or one image's mock-up) the project's scene, then opens the Studio. */
  async openInStudio(target: 'hero' | string, open: () => void) {
    run++;
    await whenIdle();
    stage(target);
    open();
    useUi.getState().resetView();
  },
};
