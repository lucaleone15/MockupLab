import { create } from 'zustand';
import { t } from '@/i18n';
import { download, formatBytes, slugify } from '@/export/exportImage';
import { fileToAsset } from '@/lib/importImage';
import { expandPdfs, isPdf, pdfPageCount, pdfToImage } from '@/lib/pdf';
import { ZipWriter } from '@/lib/zip';
import { getModel } from '@/models/registry';
import { SCENE_PRESETS, applyScenePreset } from '@/scene/scenePresets';
import { useAssets } from '@/store/assets';
import { makeItem, useProject, type SceneItem } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { inSandbox, onCancelSandboxes, renderFull, renderThumb, settleScene, whenIdle } from '@/variants/render';
import { detectSupport, modelForSupport, type Support } from '@/quick/detect';
import { composeBoard } from './board';

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

export const STYLES = ['table-oak-white', 'table-marble-sand', 'studio-light', 'studio-dark', 'podium-terrazzo', 'aurora'];
/** Which supports go in the hero first (at most five). */
const HERO_ORDER: Support[] = ['laptop', 'browser', 'phone', 'tablet', 'print', 'screen', 'objects', 'watch'];
const HERO_MAX = 5;

interface PackState {
  files: PackFile[];
  style: string;
  board: boolean;
  thumbs: { hero?: string; items: Record<string, string>; styles: Record<string, string>; board?: string };
  busy: boolean;
}

export const usePack = create<PackState>(() => ({ files: [], style: STYLES[0], board: true, thumbs: { items: {}, styles: {} }, busy: false }));
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
  useProject.setState({ mode: 'scene', items, selectedId: items[0]?.id ?? null, overlays: [] });
  applyScenePreset(SCENE_PRESETS.find((p) => p.id === style)!);
  if (items.length > 1) useProject.getState().arrange();
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
  return { hero, shots, name: p.name === 'Untitled' ? '' : p.name, brand: p.brand, logo: p.brand.logoAssetId ? useAssets.getState().assets[p.brand.logoAssetId]?.url : undefined };
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
    changed(true);
  },
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
  setStyle(style: string) {
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
