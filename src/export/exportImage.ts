import { t, useLang } from '@/i18n';
import { getModel } from '@/models/registry';
import { dither, paintBackground, prepareBackground } from '@/lib/background';
import { paintOverlays, prepareOverlays } from '@/lib/overlays';
import { renderFrame } from '@/scene/exporter';
import { photoOutputSize, renderPhotoImage } from '@/photo/exportPhoto';
import { useProject } from '@/store/project';
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

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Renders the current composition and returns the encoded image. */
export async function renderImage(): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const project = useProject.getState();
  if (project.mode === 'photo') {
    const r = await renderPhotoImage();
    if (r.blob.type === (FORMATS.find((f) => f.id === project.export.format) ?? FORMATS[0]).mime) return r;
    toast.info(t('export.webpFallback'));
    const blob = await toBlob(r.canvas, 'image/png', 1);
    return { ...r, blob, filename: r.filename.replace(/\.[a-z]+$/, '.png') };
  }
  const settings = project.export;
  const { width, height } = outputSize(settings);
  const format = FORMATS.find((f) => f.id === settings.format) ?? FORMATS[0];

  // With depth of field, lens samples already anti-alias (each one is sub-pixel jittered).
  const dof = project.camera.dof && project.camera.aperture > 0;
  const { canvas: scene, tiles } = await renderFrame({
    width,
    height,
    supersample: dof ? 1 : supersampleFor(width, height),
    samples: dof ? 64 : 1,
    onProgress: dof
      ? (done, total) => {
          // Only while an export is running (renderImage is also used by scripts).
          if (useUi.getState().exporting) useUi.getState().setExporting(t('export.rendering', { w: width, h: height }) + ` ${Math.round((done / total) * 100)} %`);
        }
      : undefined,
  });
  if (tiles > 16) toast.info(t('export.tiles', { n: tiles }));

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
  } else if (format.id === 'jpeg') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(scene, 0, 0);
  // Titles, captions and logos on top.
  await prepareOverlays(project.overlays, project.brand);
  paintOverlays(ctx, project.overlays, width, height, project.brand);

  let blob = await toBlob(out, format.mime, settings.quality);
  let ext = format.ext;
  if (blob.type !== format.mime) {
    toast.info(t('export.webpFallback'));
    blob = await toBlob(out, 'image/png', 1);
    ext = 'png';
  }
  const item = project.items.find((i) => i.id === project.selectedId) ?? project.items[0];
  const slug =
    project.name && project.name !== 'Untitled'
      ? project.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'mockup'
      : item
        ? getModel(item.modelId).id
        : 'scene';
  return { blob, width, height, filename: `mockuplab-${slug}-${width}x${height}.${ext}` };
}

export async function exportImage() {
  const ui = useUi.getState();
  if (ui.exporting) return;
  const project = useProject.getState();
  if (project.mode === 'photo' && !project.photo.assetId) return;
  const { width, height } = project.mode === 'photo' ? photoOutputSize() : outputSize(project.export);
  ui.setExporting(t('export.rendering', { w: width, h: height }));
  try {
    // Let the progress overlay paint before the (synchronous) GPU work.
    await nextFrame();
    await nextFrame();
    const res = await renderImage();
    download(res.blob, res.filename);
    toast.success(t('export.done', { w: res.width, h: res.height, size: formatBytes(res.blob.size) }));
  } catch (e) {
    toast.error(t('export.failed', { reason: e instanceof Error ? e.message : String(e) }));
  } finally {
    useUi.getState().setExporting(null);
  }
}
