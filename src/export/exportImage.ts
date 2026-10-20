import { t, useLang } from '@/i18n';
import { getModel } from '@/models/registry';
import { dither, paintBackground, prepareBackground } from '@/lib/background';
import { paintOverlays, prepareOverlays } from '@/lib/overlays';
import { renderFrame } from '@/scene/exporter';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { FORMATS, carouselOf, outputSize, supersampleFor } from './settings';
import { ZipWriter } from '@/lib/zip';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function formatBytes(n: number) {
  const [k, m] = useLang.getState().lang === 'fr' ? ['Ko', 'Mo'] : ['KB', 'MB'];
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} ${k}`;
  return `${(n / 1024 / 1024).toFixed(1)} ${m}`;
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), mime, quality),
  );
}

export function download(blob: Blob, filename: string) {
  // every image, video or ZIP is kept with its project, and refreshes its thumbnail
  void import('@/library/exports').then((m) => m.recordExport(blob, filename));
  void import('@/library/thumbs').then((m) => m.scheduleThumb(1500));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Renders the current 3D composition (background, scene, text layers) at the given size. */
export async function composeScene(o: { width: number; height: number; supersample?: number; samples?: number; onProgress?: (done: number, total: number) => void; opaque?: boolean }) {
  const project = useProject.getState();
  const { width, height } = o;
  const dof = project.camera.dof && project.camera.aperture > 0;
  const { canvas: scene, tiles } = await renderFrame({
    width,
    height,
    // With depth of field, lens samples already anti-alias (each one is sub-pixel jittered).
    supersample: dof ? 1 : (o.supersample ?? supersampleFor(width, height)),
    samples: dof ? (o.samples ?? 64) : 1,
    onProgress: dof ? o.onProgress : undefined,
  });
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  // The table set paints its own (opaque) background in 3D.
  const transparent = project.background.kind === 'transparent' && project.decor.kind !== 'table';
  const flat2d = project.decor.kind !== 'table';
  if (!transparent && flat2d) {
    await prepareBackground(project.background);
    paintBackground(ctx, project.background, width, height);
    if (project.background.kind !== 'solid') dither(ctx, width, height);
  } else if (o.opaque) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(scene, 0, 0);
  // Titles, captions and logos on top.
  await prepareOverlays(project.overlays, project.brand);
  paintOverlays(ctx, project.overlays, width, height, project.brand);
  return { canvas: out, tiles };
}

/** Encodes a canvas in the export format (PNG when the browser cannot write WebP). */
export async function encodeCanvas(canvas: HTMLCanvasElement) {
  const settings = useProject.getState().export;
  const format = FORMATS.find((f) => f.id === settings.format) ?? FORMATS[0];
  let blob = await toBlob(canvas, format.mime, settings.quality);
  let ext = format.ext;
  if (blob.type !== format.mime) {
    toast.info(t('export.webpFallback'));
    blob = await toBlob(canvas, 'image/png', 1);
    ext = 'png';
  }
  return { blob, ext };
}

/** A file-name friendly version of a label. */
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Renders the current composition and returns the encoded image. */
export async function renderImage(): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const project = useProject.getState();
  const { width, height } = outputSize(project.export);
  const { canvas, tiles } = await composeScene({
    width,
    height,
    opaque: project.export.format === 'jpeg',
    onProgress: (done, total) => {
      // Only while an export is running (renderImage is also used by scripts).
      if (useUi.getState().exporting) useUi.getState().setExporting(t('export.rendering', { w: width, h: height }) + ` ${Math.round((done / total) * 100)} %`);
    },
  });
  if (tiles > 16) toast.info(t('export.tiles', { n: tiles }));
  const { blob, ext } = await encodeCanvas(canvas);
  const item = project.items.find((i) => i.id === project.selectedId) ?? project.items[0];
  const slug =
    project.name && project.name !== 'Untitled'
      ? slugify(project.name) || 'mockup'
      : item
        ? getModel(item.modelId).id
        : 'scene';
  return { blob, width, height, filename: `mockuplab-${slug}-${width}x${height}.${ext}` };
}

/**
 * An Instagram carousel's slides: the strip is rendered once (anti-aliased for the size of one slide),
 * cut on the canvas, and each slide encoded once at the export format and quality — 01, 02…
 */
export async function renderCarouselSlides(onProgress?: (done: number, total: number) => void): Promise<{ name: string; blob: Blob; width: number; height: number }[]> {
  const project = useProject.getState();
  const c = carouselOf(project.export.ratio);
  const { width, height } = outputSize(project.export);
  const slides = c?.slides ?? 1;
  const w = Math.round(width / slides);
  const { canvas } = await composeScene({ width, height, opaque: project.export.format === 'jpeg', supersample: supersampleFor(w, height), onProgress });
  const out: { name: string; blob: Blob; width: number; height: number }[] = [];
  for (let i = 0; i < slides; i++) {
    const slide = document.createElement('canvas');
    slide.width = w;
    slide.height = height;
    slide.getContext('2d')!.drawImage(canvas, i * w, 0, w, height, 0, 0, w, height);
    const { blob, ext } = await encodeCanvas(slide);
    out.push({ name: `${String(i + 1).padStart(2, '0')}.${ext}`, blob, width: w, height });
  }
  return out;
}

/** Exports what is asked (default: the project's current kind, i.e. a video on the Video page). */
export async function exportImage(kind: 'image' | 'video' = useProject.getState().export.kind) {
  const ui = useUi.getState();
  if (ui.exporting) return;
  if (kind === 'video') {
    const { exportVideo } = await import('@/animation/actions');
    return exportVideo();
  }
  const project = useProject.getState();
  const { width, height } = outputSize(project.export);
  ui.setExporting(t('export.rendering', { w: width, h: height }));
  try {
    // Let the progress overlay paint before the (synchronous) GPU work.
    await nextFrame();
    await nextFrame();
    const carousel = carouselOf(project.export.ratio);
    if (carousel) {
      // an Instagram carousel: its slides, in posting order, in one ZIP
      const slides = await renderCarouselSlides();
      const zip = new ZipWriter();
      for (const f of slides) await zip.add(f.name, f.blob);
      const blob = zip.finish();
      download(blob, `mockuplab-carousel-${slides.length}x${slides[0].width}x${slides[0].height}.zip`);
      toast.success(t('social.carouselDone', { n: carousel.slides, size: formatBytes(blob.size) }));
    } else {
      const res = await renderImage();
      download(res.blob, res.filename);
      toast.success(t('export.done', { w: res.width, h: res.height, size: formatBytes(res.blob.size) }));
    }
  } catch (e) {
    toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
  } finally {
    useUi.getState().setExporting(null);
  }
}
