import { getModel } from '@/models/registry';
import { isLandscape } from '@/models/types';
import type { SceneItem, Vec3 } from '@/store/project';

/*
 * Composition helpers for multi-device scenes. Footprints are in cm on the
 * floor (x = width, z = depth), ignoring yaw (close enough for spacing).
 */

const GAP = 4;

export function footprint(item: Pick<SceneItem, 'modelId' | 'params' | 'pose' | 'scale'>): { w: number; d: number; h: number } {
  const model = getModel(item.modelId);
  const [w, h, d] = model.size;
  const k = item.scale ?? 1;
  if (model.anchor === 'bottom') return { w: w * k, d: d * k, h: h * k };
  const landscape = isLandscape(item.params);
  const fw = landscape ? h : w;
  const fh = landscape ? w : h;
  if (item.pose === 'flat') return { w: fw * k, d: fh * k, h: d * k };
  return { w: fw * k, d: d * k + 1, h: fh * k };
}

/** Floor position for a new device of the given width: just right of the existing ones. */
export function besideOthers(items: SceneItem[], width: number): Vec3 {
  if (!items.length) return [0, 0, 0];
  let right = -Infinity;
  for (const it of items) right = Math.max(right, it.position[0] + footprint(it).w / 2);
  return [right + GAP + width / 2, 0, 3];
}

/**
 * Balanced layout: the largest device sits at the centre-back (the "hero"),
 * the others alternate right / left in front of it, angled towards the
 * centre, so every screen stays visible from a 3/4 view.
 */
export function arrangeItems(items: SceneItem[]): SceneItem[] {
  if (items.length < 2) return items.map((it) => ({ ...it, position: [0, 0, 0] as Vec3 }));
  const sized = items.map((it) => ({ it, f: footprint(it) })).sort((a, b) => b.f.w * b.f.h - a.f.w * a.f.h);
  const [hero, ...rest] = sized;
  const out = new Map<string, SceneItem>();
  const heroYaw = getModel(hero.it.modelId).yaw ?? -0.3;
  out.set(hero.it.id, { ...hero.it, position: [0, 0, 0], rotation: [0, heroYaw * 0.6, 0] });

  // Satellites start near the hero's edges so they overlap it only slightly.
  let right = hero.f.w * 0.42;
  let left = -hero.f.w * 0.42;
  const front = hero.f.d / 2;
  rest.forEach(({ it, f }, i) => {
    const toRight = i % 2 === 0;
    const row = Math.floor(i / 2);
    const z = front + f.d / 2 + 4 + row * 5;
    let x: number;
    if (toRight) {
      x = right + f.w / 2;
      right = x + f.w / 2 + GAP;
    } else {
      x = left - f.w / 2;
      left = x - f.w / 2 - GAP;
    }
    const yaw = toRight ? -0.42 : 0.3;
    out.set(it.id, { ...it, position: [x, 0, z], rotation: [0, yaw, 0] });
  });
  return items.map((it) => out.get(it.id)!);
}
