import { t } from '@/i18n';
import { useAssets } from '@/store/assets';
import { makeZone, useProject, type PhotoZone } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { detectQuad } from './detect';
import { estimateAspect, isConvex, orderCorners, type Quad, type Vec2 } from './homography';
import { assetPixels, statsFor } from './source';

/** Photo size in pixels (corners are stored normalised). */
export function photoSize() {
  const id = useProject.getState().photo.assetId;
  const a = id ? useAssets.getState().assets[id] : undefined;
  return a ? { w: a.width, h: a.height } : { w: 1, h: 1 };
}

export function aspectOf(corners: Quad) {
  const { w, h } = photoSize();
  return estimateAspect(corners.map(([x, y]) => [x * w, y * h]) as Quad, w, h);
}

/** Adds a zone on four points (any order); its kind follows what the photo shows there. */
export async function createZone(points: Vec2[]) {
  const { photo } = useProject.getState();
  if (!photo.assetId || points.length !== 4) return;
  const corners = orderCorners(points);
  if (!isConvex(corners)) {
    toast.error(t('photo.zone.invalid'));
    return;
  }
  const probe = makeZone({ corners, aspect: aspectOf(corners) });
  const stats = await statsFor(photo.assetId, probe);
  // a light, even surface is paper; a dark one is a screen
  const kind: PhotoZone['kind'] = stats.high > 0.35 ? 'print' : 'screen';
  const n = useProject.getState().photo.zones.length + 1;
  useProject.getState().addZone(makeZone({ corners, aspect: probe.aspect, kind, name: `${t('photo.zone')} ${n}` }));
  useUi.getState().setPhotoTool('select');
  useUi.getState().setActiveCorner(null);
}

/** Magic wand: finds the screen / sheet around a point (normalised coordinates) and adds it as a zone. */
export async function detectZoneAt(x: number, y: number) {
  const { photo } = useProject.getState();
  if (!photo.assetId) return false;
  const px = await assetPixels(photo.assetId, 1600);
  const quad = detectQuad(px, x, y);
  if (!quad) {
    toast.info(t('photo.detect.none'));
    return false;
  }
  await createZone(quad);
  return true;
}

/** Arrow keys: moves the active corner (or the whole zone) by photo pixels. */
export function nudge(dx: number, dy: number) {
  const { photo, updateZone } = useProject.getState();
  const zone = photo.zones.find((z) => z.id === photo.selectedZoneId);
  if (!zone) return;
  const { w, h } = photoSize();
  const corner = useUi.getState().activeCorner;
  const corners = zone.corners.map((c, i) => (corner === null || corner === i ? [c[0] + dx / w, c[1] + dy / h] : c)) as Quad;
  if (!isConvex(corners)) return;
  updateZone(zone.id, { corners, ...(zone.aspectAuto && corner !== null && { aspect: aspectOf(corners) }) });
}
