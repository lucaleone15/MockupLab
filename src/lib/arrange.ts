import { getModel } from '@/models/registry';
import { isLandscape, sizeOf } from '@/models/types';
import type { Decor, SceneItem, Vec3 } from '@/store/project';

/*
 * Composition helpers for multi-device scenes. Footprints are in cm on the
 * floor (x = width, z = depth), ignoring yaw (close enough for spacing).
 */

const GAP = 4;

export function footprint(item: Pick<SceneItem, 'modelId' | 'params' | 'pose' | 'scale'>): { w: number; d: number; h: number } {
  const model = getModel(item.modelId);
  const [w, h, d] = sizeOf(model, item.params).size;
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
export function arrangeItems(input: SceneItem[]): SceneItem[] {
  if (input.length < 2) return input.map((it) => ({ ...it, position: [0, 0, 0] as Vec3 }));
  // a poster hung high above prints lying on the floor leaves an empty band in the middle of the frame:
  // arranged together, it leans against the wall instead, at the prints' level
  const onFloor = input.some((it) => it.visible && !wallOf(it));
  const items = onFloor ? input.map((it) => (it.modelId === 'poster' && it.params.mount === 'wall' ? { ...it, params: { ...it.params, mount: 'lean' } } : it)) : input;
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

/* ------------------------------------------------------------ walls & limits */

/** Back walls of the 3D sets (table set, studio sweep), local Z. */
export const TABLE_BACK = -55;
export const SWEEP_BACK = -70;
const STAGE_RADIUS = 600;

export function decorWallZ(decor: Pick<Decor, 'kind'>): number | null {
  return decor.kind === 'table' ? TABLE_BACK : decor.kind === 'sweep' ? SWEEP_BACK : null;
}

export interface SceneWall {
  z: number;
  /** False when the set already has its own wall (table, studio). */
  draw: boolean;
}

const wallOf = (it: SceneItem) => getModel(it.modelId).wallFor?.({ ...it.params }) ?? null;

/**
 * The single wall of the scene: the set's wall when there is one, otherwise
 * the wall of the first object that hangs on / leans against a wall.
 */
export function sceneWall(items: SceneItem[], decor: Pick<Decor, 'kind'>): SceneWall | null {
  const hanging = items.filter((it) => it.visible !== false && wallOf(it));
  if (!hanging.length) return null;
  const first = hanging[0];
  const decorZ = decorWallZ(decor);
  if (decorZ !== null) return { z: decorZ, draw: false };
  return { z: first.position[2] + wallOf(first)!.z, draw: true };
}

/**
 * Keeps every object where it makes sense: wall objects hang flat on the
 * scene's wall, nothing goes behind a wall, nothing leaves the stage.
 */
export function constrainItems(items: SceneItem[], decor: Pick<Decor, 'kind'>): SceneItem[] {
  const wall = sceneWall(items, decor);
  const back = wall?.z ?? decorWallZ(decor);
  return items.map((it) => {
    let [x, y, z] = it.position;
    let yaw = it.rotation[1];
    const own = wallOf(it);
    if (own && wall) {
      z = wall.z - own.z;
      yaw = 0;
    } else if (back !== null) {
      const f = footprint(it);
      const ext = Math.abs(Math.cos(yaw)) * (f.d / 2) + Math.abs(Math.sin(yaw)) * (f.w / 2);
      z = Math.max(z, back + ext + 0.5);
    }
    const r = Math.hypot(x, z);
    if (r > STAGE_RADIUS) {
      x *= STAGE_RADIUS / r;
      z *= STAGE_RADIUS / r;
    }
    if (x === it.position[0] && z === it.position[2] && yaw === it.rotation[1]) return it;
    return { ...it, position: [x, y, z] as Vec3, rotation: [it.rotation[0], yaw, it.rotation[2]] as Vec3 };
  });
}
