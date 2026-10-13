import { create } from 'zustand';
import { t } from '@/i18n';
import { download, encodeCanvas, formatBytes, renderCarouselSlides, slugify } from '@/export/exportImage';
import { fileToAsset } from '@/lib/importImage';
import { ZipWriter } from '@/lib/zip';
import { composePhoto } from '@/photo/exportPhoto';
import { settle } from '@/scene/exporter';
import { loadImage, useAssets, type Asset } from '@/store/assets';
import { selectSelectedItem, useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { getModel } from '@/models/registry';
import type { Look } from './looks';
import { inSandbox, renderFull, showLook } from './render';
import { carouselOf } from '@/export/settings';

/*
 * Batch: several designs through the same style. Each image goes, in turn,
 * on the selected device's screen (or the selected photo zone), with the
 * current look or each selected variant; every render lands in one ZIP.
 */

interface BatchState {
  open: boolean;
  files: { id: string; file: File; url: string }[];
  /** 'current' scene, or the 'variants' selected in the gallery. */
  style: 'current' | 'variants';
  job: { done: number; total: number } | null;
}

export const useBatch = create<BatchState>(() => ({ open: false, files: [], style: 'current', job: null }));

let run = 0;
const ACCEPTED = /^image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml)$/;

/** Where the batch images go: the selected device's active (or first) face, or the selected photo zone. */
export function batchTarget() {
  const p = useProject.getState();
  if (p.mode === 'photo') {
    const zone = p.photo.zones.find((z) => z.id === p.photo.selectedZoneId) ?? p.photo.zones[0];
    return zone ? { kind: 'zone' as const, id: zone.id, name: zone.name } : null;
  }
  const item = selectSelectedItem(p);
  if (!item) return null;
  const model = getModel(item.modelId);
  const slots = model.surfaces.map((s) => s.id);
  if (!slots.length) return null;
  const active = useUi.getState().activeSlot;
  const slot = active && slots.includes(active) ? active : slots[0];
  return { kind: 'slot' as const, id: item.id, slot, model };
}

export const batch = {
  open() {
    useBatch.setState({ open: true });
  },
  close() {
    run++;
    useBatch.setState({ open: false, job: null });
  },
  add(files: Iterable<File>) {
    const list = [...files].filter((f) => ACCEPTED.test(f.type));
    useBatch.setState((s) => ({ files: [...s.files, ...list.map((file) => ({ id: Math.random().toString(36).slice(2, 10), file, url: URL.createObjectURL(file) }))] }));
  },
  remove(id: string) {
    useBatch.setState((s) => {
      const f = s.files.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return { files: s.files.filter((x) => x.id !== id) };
    });
  },
  clear() {
    for (const f of useBatch.getState().files) URL.revokeObjectURL(f.url);
    useBatch.setState({ files: [] });
  },
  setStyle(style: BatchState['style']) {
    useBatch.setState({ style });
  },
  cancel() {
    run++;
    useBatch.setState({ job: null });
  },

  /** Renders every image × style and downloads the ZIP. */
  async run(looks: Look[]) {
    const { files } = useBatch.getState();
    const target = batchTarget();
    if (!files.length || !target) return;
    const styles: (Look | null)[] = looks.length ? looks : [null];
    const token = ++run;
    const total = files.length * styles.length;
    useBatch.setState({ job: { done: 0, total } });
    const temp: string[] = [];
    try {
      // the images, as temporary assets
      const assets: { asset: Asset; name: string }[] = [];
      for (const f of files) {
        const a = await fileToAsset(f.file, f.file.name || 'image');
        useAssets.getState().add(a);
        temp.push(a.id);
        assets.push({ asset: a, name: slugify(f.file.name.replace(/\.[^.]+$/, '')) || 'image' });
      }
      const zip = new ZipWriter();
      let done = 0;
      await inSandbox(async () => {
        for (const style of styles) {
          if (token !== run) return;
          if (style) await showLook(style);
          for (const { asset, name } of assets) {
            if (token !== run) return;
            const p = useProject.getState();
            if (target.kind === 'zone') {
              p.setZoneSurface(target.id, { assetId: asset.id, align: 0 });
              const { canvas } = await composePhoto();
              const { blob, ext } = await encodeCanvas(canvas);
              await zip.add(`${name}.${ext}`, blob);
            } else {
              p.setSurface(target.id, target.slot, { assetId: asset.id, align: 0 });
              await loadImage(asset.url);
              await settle(4);
              const base = `${name}${style ? `-${slugify(style.label)}` : ''}`;
              // a carousel: each design gives its slides
              if (carouselOf(useProject.getState().export.ratio)) for (const f of await renderCarouselSlides()) await zip.add(`${base}-${f.name}`, f.blob);
              else {
                const { blob, ext } = await renderFull();
                await zip.add(`${base}.${ext}`, blob);
              }
            }
            done++;
            useBatch.setState({ job: { done, total } });
          }
        }
      });
      if (token !== run || !zip.size) return;
      const blob = zip.finish();
      download(blob, `mockuplab-lot-${zip.size}.zip`);
      toast.success(t('batch.done', { n: zip.size, size: formatBytes(blob.size) }));
    } catch (e) {
      toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
    } finally {
      useAssets.getState().remove(temp);
      if (token === run) useBatch.setState({ job: null });
    }
  },
};
