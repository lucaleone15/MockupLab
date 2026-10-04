import { paintOverlays, prepareOverlays } from '@/lib/overlays';
import { loadImage, useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { FORMATS } from '@/export/settings';
import { PhotoRenderer, type ZoneDraw } from './renderer';
import { statsFor } from './source';
import { PHOTO_TEMPLATES } from './templates';

/** Output size of a photo mock-up: the photo's own resolution. */
export function photoOutputSize() {
  const { photo } = useProject.getState();
  const a = photo.assetId ? useAssets.getState().assets[photo.assetId] : undefined;
  return { width: a?.width ?? 0, height: a?.height ?? 0 };
}

/** Renders the photo mock-up at full resolution and encodes it. */
export async function renderPhotoImage(): Promise<{ blob: Blob; width: number; height: number; filename: string; ext: string; canvas: HTMLCanvasElement }> {
  const { canvas: out, width, height } = await composePhoto();
  const project = useProject.getState();
  const format = FORMATS.find((f) => f.id === project.export.format) ?? FORMATS[0];
  const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), format.mime, project.export.quality));
  const tpl = PHOTO_TEMPLATES.find((t) => t.id === project.photo.templateId);
  const slug =
    project.name && project.name !== 'Untitled'
      ? project.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'photo'
      : (tpl?.id ?? 'photo');
  return { blob, width, height, ext: format.ext, canvas: out, filename: `mockuplab-${slug}-${width}x${height}.${format.ext}` };
}

/** Composes the photo mock-up (photo, zones, text layers) at the photo's resolution. */
export async function composePhoto(): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const project = useProject.getState();
  const assets = useAssets.getState().assets;
  const pa = project.photo.assetId ? assets[project.photo.assetId] : undefined;
  if (!pa) throw new Error('no photo');
  const { width, height } = pa;
  const img = await loadImage(pa.url);
  const zones: ZoneDraw[] = await Promise.all(
    project.photo.zones.map(async (zone) => {
      const da = zone.surface.assetId ? assets[zone.surface.assetId] : undefined;
      return { zone, stats: await statsFor(pa.id, zone), design: da ? { source: await loadImage(da.url), key: da.id, width: da.width, height: da.height } : null };
    }),
  );
  const gl = document.createElement('canvas');
  const renderer = new PhotoRenderer(gl, { preserve: true });
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  try {
    renderer.render({ source: img, key: pa.id, width, height }, zones, { width, height, preview: false });
    const ctx = out.getContext('2d')!;
    ctx.drawImage(gl, 0, 0);
  } finally {
    renderer.dispose();
  }
  const ctx = out.getContext('2d')!;
  await prepareOverlays(project.overlays, project.brand);
  paintOverlays(ctx, project.overlays, width, height, project.brand);
  return { canvas: out, width, height };
}
