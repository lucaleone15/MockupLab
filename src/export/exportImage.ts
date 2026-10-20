import { t, useLang } from '@/i18n';
import { getModel } from '@/models/registry';
import { dither, paintBackground, prepareBackground } from '@/lib/background';
import { paintOverlays, prepareOverlays } from '@/lib/overlays';
import { renderFrame } from '@/scene/exporter';
import { useProject } from '@/store/project';
import { paintSocial } from '@/social/paint';
import type { ExportSettingsRecord } from '@/library/exports';
import { socialTextNow } from '@/social/SocialFrame';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { FORMATS, outputSize, supersampleFor } from './settings';

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

export function download(blob: Blob, filename: string, settings?: ExportSettingsRecord) {
  // every image, video or ZIP is kept with its project (with its settings and scene), and refreshes its thumbnail
  void import('@/library/exports').then((m) => m.recordExport(blob, filename, settings));
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
  // “with the network's interface”: the post, story or video page around the image
  const { network, withInterface } = project.social;
  const out = network && withInterface ? paintSocial(canvas, network, await socialTextNow()) : canvas;
  const { blob, ext } = await encodeCanvas(out);
  const item = project.items.find((i) => i.id === project.selectedId) ?? project.items[0];
  const slug =
    project.name && project.name !== 'Untitled'
      ? slugify(project.name) || 'mockup'
      : item
        ? getModel(item.modelId).id
        : 'scene';
  return { blob, width: out.width, height: out.height, filename: `mockuplab-${slug}${out === canvas ? '' : `-${network}`}-${out.width}x${out.height}.${ext}` };
}

/** Exports an image (default) or the video of the export settings. */
export async function exportImage(kind: 'image' | 'video' = 'image') {
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
    const res = await renderImage();
    download(res.blob, res.filename, { kind: 'image', format: project.export.format, width: res.width, height: res.height, ratio: project.export.ratio });
    toast.success(t('export.done', { w: res.width, h: res.height, size: formatBytes(res.blob.size) }));
  } catch (e) {
    toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
  } finally {
    useUi.getState().setExporting(null);
  }
}
