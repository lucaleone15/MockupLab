import { t, useLang } from '@/i18n';
import { getModel } from '@/models/registry';
import { dither, paintBackground } from '@/lib/background';
import { renderFrame } from '@/scene/exporter';
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
  const settings = project.export;
  const { width, height } = outputSize(settings);
  const format = FORMATS.find((f) => f.id === settings.format) ?? FORMATS[0];

  const { canvas: scene, tiles } = renderFrame({ width, height, supersample: supersampleFor(width, height) });
  if (tiles > 16) toast.info(t('export.tiles', { n: tiles }));

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  const transparent = project.background.kind === 'transparent';
  if (!transparent) {
    paintBackground(ctx, project.background, width, height);
    if (project.background.kind === 'gradient') dither(ctx, width, height);
  } else if (format.id === 'jpeg') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(scene, 0, 0);

  let blob = await toBlob(out, format.mime, settings.quality);
  let ext = format.ext;
  if (blob.type !== format.mime) {
    toast.info(t('export.webpFallback'));
    blob = await toBlob(out, 'image/png', 1);
    ext = 'png';
  }
  const item = project.items.find((i) => i.id === project.selectedId) ?? project.items[0];
  const slug = item ? getModel(item.modelId).id : 'scene';
  return { blob, width, height, filename: `mockuplab-${slug}-${width}x${height}.${ext}` };
}

export async function exportImage() {
  const ui = useUi.getState();
  if (ui.exporting) return;
  const { width, height } = outputSize(useProject.getState().export);
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
