import { t } from '@/i18n';
import { useAssets } from '@/store/assets';
import { makeZone, useProject, type PhotoZone } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { detectQuads } from './detect';
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
export async function createZone(points: Vec2[]): Promise<string | null> {
  const { photo } = useProject.getState();
  if (!photo.assetId || points.length !== 4) return null;
  const corners = orderCorners(points);
  if (!isConvex(corners)) {
    toast.error(t('photo.zone.invalid'));
    return null;
  }
  const probe = makeZone({ corners, aspect: aspectOf(corners) });
  const stats = await statsFor(photo.assetId, probe);
  // a dark surface is a screen (off, or dimmed); a light one is most often paper
  const kind: PhotoZone['kind'] = stats.level > 0.15 ? 'print' : 'screen';
  // a dark screen with something light in front of it (fingers, a phone held up): keep that in front
  const occlusion = kind === 'screen' && stats.foreground > 0.03 && stats.foreground < 0.6 ? 0.6 : 0;
  const n = useProject.getState().photo.zones.length + 1;
  const zone = makeZone({ corners, aspect: probe.aspect, kind, occlusion, name: `${t('photo.zone')} ${n}` });
  useProject.getState().addZone(zone);
  useUi.getState().setPhotoTool('select');
  useUi.getState().setActiveCorner(null);
  return zone.id;
}

function insideQuad(q: Quad, x: number, y: number) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = Math.sign((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
    if (c && sign && c !== sign) return false;
    if (c) sign = c;
  }
  return true;
}

/** Applies suggestion i of the last detection to its zone. */
export function pickSuggestion(i: number) {
  const s = useUi.getState().suggestions;
  if (!s) return;
  const zone = useProject.getState().photo.zones.find((z) => z.id === s.zoneId);
  if (!zone) return;
  const index = ((i % s.candidates.length) + s.candidates.length) % s.candidates.length;
  const corners = s.candidates[index] as Quad;
  useProject.getState().updateZone(zone.id, { corners, ...(zone.aspectAuto && { aspect: aspectOf(corners) }) });
  useProject.getState().selectZone(zone.id);
  useUi.getState().setSuggestions({ ...s, index });
}

const differs = (a: Quad, b: Quad) => a.some((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) > 0.006);

/**
 * Magic wand on a double-click (normalised coordinates): on empty photo, finds
 * the screen / sheet / frame around the point and adds it as a zone; on an
 * existing zone, replaces its outline with the next candidate.
 */
export async function detectZoneAt(x: number, y: number) {
  const { photo } = useProject.getState();
  if (!photo.assetId) return false;
  const zone = [...photo.zones].reverse().find((z) => z.visible && insideQuad(z.corners, x, y));
  const shown = useUi.getState().suggestions;
  if (zone && shown && shown.zoneId === zone.id && shown.candidates.length > 1) {
    pickSuggestion(shown.index + 1);
    return true;
  }
  const px = await assetPixels(photo.assetId, 1600);
  const candidates = detectQuads(px, x, y, 6);
  if (!candidates.length) {
    toast.info(t('photo.detect.none'));
    return false;
  }
  if (zone) {
    // an existing zone: offer what the photo suggests, starting with what differs from it
    const list = [...candidates.filter((c) => differs(c, zone.corners)), zone.corners];
    useUi.getState().setSuggestions({ zoneId: zone.id, candidates: list, index: list.length - 1 });
    pickSuggestion(0);
    return true;
  }
  const id = await createZone(candidates[0]);
  if (id && candidates.length > 1) useUi.getState().setSuggestions({ zoneId: id, candidates, index: 0 });
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
