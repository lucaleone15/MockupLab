import * as THREE from 'three';
import type { I18nKey } from '@/i18n';
import { getModel } from '@/models/registry';
import { cameraHandle, cameraState, focusPoint, frame, presetDirection, type CameraView } from '@/scene/camera';
import { decorLayout } from '@/scene/Decor';
import { ratioValue } from '@/export/settings';
import { useAssets } from '@/store/assets';
import { selectSelectedItem, useProject, type AnimationId, type CameraSettings, type SceneItem, type Vec3, type VideoSettings, type WorkMode } from '@/store/project';
import { aspectsOf } from '@/models/imageAspects';

/*
 * Animations, as a function of time: a "rig" captures the scene once, then
 * `at(t)` (t from 0 to 1 over the clip) sets the state of that instant —
 * so a frame can be rendered for any t, in any order, at any frame rate,
 * and several instants can be averaged into one frame (motion blur).
 *
 * Camera moves are written as keyframes around the subject (azimuth,
 * elevation, distance, roll, focal length, focus), eased like a camera on a
 * motion-control rig; object moves (spin, drop) change the devices.
 */

export interface AnimationDef {
  id: AnimationId;
  label: I18nKey;
  hint: I18nKey;
  modes: WorkMode[];
  /** Seamless loop (a GIF can repeat it forever). */
  loop: boolean;
  /** Group in the picker. */
  group: 'cinematic' | 'classic';
}

export const ANIMATIONS: AnimationDef[] = [
  { id: 'reveal', label: 'anim.reveal', hint: 'anim.reveal.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'dive', label: 'anim.dive', hint: 'anim.dive.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'dutch', label: 'anim.dutch', hint: 'anim.dutch.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'flip', label: 'anim.flip', hint: 'anim.flip.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'drop', label: 'anim.drop', hint: 'anim.drop.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'crane', label: 'anim.crane', hint: 'anim.crane.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'vertigo', label: 'anim.vertigo', hint: 'anim.vertigo.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'trailer', label: 'anim.trailer', hint: 'anim.trailer.hint', modes: ['scene'], loop: false, group: 'cinematic' },
  { id: 'turntable', label: 'anim.turntable', hint: 'anim.turntable.hint', modes: ['scene'], loop: true, group: 'classic' },
  { id: 'swing', label: 'anim.swing', hint: 'anim.swing.hint', modes: ['scene'], loop: true, group: 'classic' },
  { id: 'orbit', label: 'anim.orbit', hint: 'anim.orbit.hint', modes: ['scene'], loop: false, group: 'classic' },
  { id: 'scroll', label: 'anim.scroll', hint: 'anim.scroll.hint', modes: ['scene', 'photo'], loop: false, group: 'classic' },
  { id: 'float', label: 'anim.float', hint: 'anim.float.hint', modes: ['scene'], loop: true, group: 'classic' },
  { id: 'zoom', label: 'anim.zoom', hint: 'anim.zoom.hint', modes: ['photo'], loop: false, group: 'classic' },
];

export const animationsFor = (mode: WorkMode) => ANIMATIONS.filter((a) => a.modes.includes(mode));

/* ------------------------------------------------------------ easing */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
/** Slow start, long gentle landing: how a motion-control rig moves. */
const cinematic = (x: number) => 1 - (1 - clamp01(x) ** 1.6) ** 3;
/** Overshoots a little before settling (a spin landing). */
const easeOutBack = (x: number, s = 1.25) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;
/** 0 → 1 with a pause at both ends (reading time before and after a scroll). */
const held = (t: number, hold = 0.14) => easeInOut(clamp01((t - hold) / (1 - 2 * hold)));
const lerp = THREE.MathUtils.lerp;
const rad = THREE.MathUtils.degToRad;

/* ------------------------------------------------------------ rigs */

export interface Rig {
  /** Sets the scene at time t (0..1). */
  at(t: number): void;
  /** Photo mode zoom factor at t, applied when composing (1 = none). */
  zoom(t: number): number;
  /** Devices move (the view must redraw shadows between instants). */
  moves: boolean;
  /** Instants to average for motion blur at t (fast moves need more); 6 when absent. */
  blur?(t: number): number;
  /**
   * Cross-fades (montage): the instants to render and their weights; a
   * single shot otherwise.
   */
  layers?(t: number): { rig: Rig; t: number; weight: number; scale: number }[];
}

/** Camera pose relative to the starting view: offsets in degrees, distance and focal as factors. */
interface CamKey {
  t: number;
  az?: number;
  el?: number;
  /** Absolute elevation in degrees (instead of an offset). */
  elAbs?: number;
  dist?: number;
  roll?: number;
  /** Focal length factor (>1 = longer lens, narrower view). */
  focal?: number;
  /** Keep the subject's size while the distance changes (dolly zoom). */
  keepSize?: boolean;
  /** Depth of field: aperture 0..1 (null = the user's own). */
  aperture?: number;
  /** Focus offset (-1 closer .. 1 further). */
  focus?: number;
}

/** Items that can move: things hanging on a wall stay where they are. */
const movable = (it: SceneItem) => it.visible && !getModel(it.modelId).wallFor?.(it.params, aspectsOf(it.surfaces));

function cameraRig(keys: CamKey[], ease: (x: number) => number, base: CameraView | undefined, cam: CameraSettings): Rig {
  const off = base ? base.position.clone().sub(base.target) : new THREE.Vector3(0, 0, 1);
  const sph = new THREE.Spherical().setFromVector3(off);
  const baseEl = 90 - THREE.MathUtils.radToDeg(sph.phi);
  const value = (t: number, k: keyof CamKey, fallback: number) => {
    const list = keys.filter((x) => x[k] !== undefined);
    if (!list.length) return fallback;
    if (t <= list[0].t) return list[0][k] as number;
    for (let i = 1; i < list.length; i++)
      if (t <= list[i].t) {
        const a = list[i - 1];
        const b = list[i];
        return lerp(a[k] as number, b[k] as number, ease((t - a.t) / (b.t - a.t)));
      }
    return list[list.length - 1][k] as number;
  };
  return {
    moves: false,
    zoom: () => 1,
    at(t) {
      if (!base) return;
      const az = value(t, 'az', 0);
      const el = keys.some((k) => k.elAbs !== undefined) ? value(t, 'elAbs', baseEl) : baseEl + value(t, 'el', 0);
      const dist = value(t, 'dist', 1);
      const focal = value(t, 'focal', 1);
      const keep = keys.some((k) => k.keepSize);
      const fov0 = rad(base.fov);
      // dolly zoom: the view narrows as the camera backs away, the subject keeps its size
      const fov = keep ? 2 * Math.atan(Math.tan(fov0 / 2) / dist) : 2 * Math.atan(Math.tan(fov0 / 2) / focal);
      const s = new THREE.Spherical(sph.radius * dist, rad(90 - Math.min(80, Math.max(1.5, el))), sph.theta + rad(az));
      cameraHandle.restore?.({ position: new THREE.Vector3().setFromSpherical(s).add(base.target), target: base.target, fov: THREE.MathUtils.radToDeg(fov), roll: rad(value(t, 'roll', 0)) });
      // depth of field follows the keys (read by the lens at render time)
      if (keys.some((k) => k.aperture !== undefined || k.focus !== undefined))
        useProject.setState({ camera: { ...cam, dof: true, aperture: value(t, 'aperture', cam.aperture), focus: value(t, 'focus', cam.focus) } });
    },
  };
}

/** A clip made of shots, cross-faded. */
function montage(shots: { rig: Rig; from: number; to: number }[], fade = 0.07): Rig {
  const local = (s: (typeof shots)[number], t: number) => clamp01((t - s.from) / (s.to - s.from));
  const layers = (t: number) => {
    const out: { rig: Rig; t: number; weight: number; scale: number }[] = [];
    shots.forEach((s, i) => {
      const next = shots[i + 1];
      const prev = shots[i - 1];
      if (t < s.from - (prev ? fade / 2 : 0) || t > s.to + (next ? fade / 2 : 0)) return;
      let w = 1;
      if (next && t > s.to - fade / 2) w = clamp01((s.to + fade / 2 - t) / fade);
      if (prev && t < s.from + fade / 2) w = clamp01((t - (s.from - fade / 2)) / fade);
      out.push({ rig: s.rig, t: local(s, t), weight: w, scale: 1 / (s.to - s.from) });
    });
    return out.sort((a, b) => b.weight - a.weight);
  };
  return {
    moves: shots.some((s) => s.rig.moves),
    blur: (t) => {
      const top = layers(t)[0];
      return top?.rig.blur?.(top.t) ?? 6;
    },
    zoom: () => 1,
    layers,
    at(t) {
      const top = layers(t)[0];
      top?.rig.at(top.t);
    },
  };
}

/**
 * Instants averaged for motion blur around a shot's time t: half a frame interval (a 180° shutter).
 * Only a shot that loops by itself wraps around its seam; any other shot — a montage's shots included,
 * even under "Perfect loop" — stays within its own start and end.
 */
export function shutterTimes(t: number, sub: number, step: number, scale: number, nativeLoop: boolean): number[] {
  return Array.from({ length: sub }, (_, k) => {
    const tt = t + (sub > 1 ? ((k + 0.5) / sub - 0.5) * 0.5 * step * scale : 0);
    return nativeLoop ? ((tt % 1) + 1) % 1 : Math.min(1, Math.max(0, tt));
  });
}

/** A shot played forth and back: its last frame is its first (a seamless loop). */
export function loopRig(rig: Rig): Rig {
  const pp = (t: number) => 1 - Math.abs(1 - 2 * t);
  return {
    at: (t) => rig.at(pp(t)),
    zoom: (t) => rig.zoom(pp(t)),
    moves: rig.moves,
    blur: rig.blur && ((t) => rig.blur!(pp(t))),
    layers: rig.layers && ((t) => rig.layers!(pp(t))),
  };
}

/** Whether the video loops: the shot does by itself, or "Perfect loop" is on. */
export const loops = (def: AnimationDef, v: Pick<VideoSettings, 'loop'>) => def.loop || !!v.loop;

/** The rig of a video: the shot, played forth and back for a perfect loop. */
export function rigFor(def: AnimationDef, v: Pick<VideoSettings, 'loop'>): Rig {
  const rig = makeRig(def.id);
  return v.loop && !def.loop ? loopRig(rig) : rig;
}

export function makeRig(id: AnimationId): Rig {
  const p = useProject.getState();
  const items = p.items;
  const moving = items.filter(movable);
  const centre = moving.length
    ? moving.reduce((c, it) => [c[0] + it.position[0] / moving.length, 0, c[2] + it.position[2] / moving.length] as Vec3, [0, 0, 0] as Vec3)
    : ([0, 0, 0] as Vec3);
  const view = cameraHandle.save?.();
  const cam = p.camera;

  /** Items turned by `angle` around the composition centre, lifted by `lift`, tilted by `tilt`. */
  const pose = (angle: number, lift = 0, tilt = 0) =>
    items.map((it) => {
      if (!movable(it)) return it;
      const dx = it.position[0] - centre[0];
      const dz = it.position[2] - centre[2];
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return {
        ...it,
        position: [centre[0] + dx * c + dz * s, it.position[1] + lift, centre[2] - dx * s + dz * c] as Vec3,
        rotation: [it.rotation[0] + tilt, it.rotation[1] + angle, it.rotation[2]] as Vec3,
      };
    });
  const objectRig = (f: (t: number) => void, camKeys?: CamKey[], blur?: (t: number) => number): Rig => {
    const camera = camKeys ? cameraRig(camKeys, easeInOut, view, cam) : null;
    return {
      moves: true,
      zoom: () => 1,
      blur,
      at(t) {
        f(t);
        camera?.at(t);
      },
    };
  };

  switch (id) {
    case 'reveal':
      // from a grazing close-up on the edge, out and around to the hero view
      return cameraRig(
        [
          // a set has a wall of limited width: a narrower start keeps it in the frame
          { t: 0, az: p.decor.kind === 'table' ? 32 : 58, el: -8, dist: 0.42, roll: -7, aperture: 0.95, focus: -0.3 },
          { t: 1, az: 0, el: 0, dist: 1, roll: 0, aperture: cam.dof ? cam.aperture : 0.45, focus: cam.focus },
        ],
        cinematic,
        view,
        cam,
      );
    case 'dutch':
      // high and tilted, diving across towards a tight three-quarter view
      return cameraRig(
        [
          { t: 0, az: -38, el: 24, dist: 1.5, roll: 12 },
          { t: 1, az: 10, el: -3, dist: 0.62, roll: -2 },
        ],
        easeInOut,
        view,
        cam,
      );
    case 'crane':
      return cameraRig(
        [
          { t: 0, az: -42, elAbs: 2.5, dist: 1.05 },
          { t: 1, az: 28, elAbs: 48, dist: 0.88 },
        ],
        easeInOut,
        view,
        cam,
      );
    case 'vertigo':
      return cameraRig(
        [
          { t: 0, az: -6, dist: 0.55, keepSize: true },
          { t: 1, az: 8, dist: 3.4, keepSize: true },
        ],
        easeInOut,
        view,
        cam,
      );
    case 'orbit':
      return cameraRig(
        [
          { t: 0, az: -24, el: 5, dist: 1.1 },
          { t: 1, az: 24, el: -4, dist: 0.9 },
        ],
        easeInOut,
        view,
        cam,
      );
    case 'dive': {
      // from the current view to facing the screen, then into it until the design fills the frame
      const item = selectSelectedItem(p) ?? items[0];
      if (!view || !item) return cameraRig([], easeInOut, view, cam);
      const floorY = decorLayout(p.decor, items).floorY;
      const dir = presetDirection(item.pose === 'flat' ? 'top' : 'front', item);
      const fov = view.fov;
      const front = frame([item], dir, fov, ratioValue(p.export.ratio), floorY, 1);
      const screen = focusPoint(item, floorY);
      const startOff = view.position.clone().sub(view.target);
      const endDist = front.position.distanceTo(front.target) * 0.74;
      return {
        moves: false,
        zoom: () => 1,
        at(t) {
          const k = cinematic(t);
          const target = view.target.clone().lerp(screen, easeInOut(clamp01(t * 1.3)));
          // direction turns towards the screen's normal, distance shrinks
          const d0 = startOff.clone().normalize();
          const d1 = dir.clone().normalize();
          const d = d0.lerp(d1, easeInOut(clamp01(t * 1.15))).normalize();
          const dist = lerp(startOff.length(), endDist, k);
          const roll = rad(5) * Math.sin(Math.PI * clamp01(t * 1.1));
          cameraHandle.restore?.({ position: d.multiplyScalar(dist).add(target), target, fov, roll });
        },
      };
    }
    case 'flip':
      // a fast turn and a half, landing facing the camera with a small overshoot, then a slow drift
      return objectRig(
        (t) => {
          const u = clamp01(t / 0.55);
          const spin = t < 0.55 ? lerp(-Math.PI * 3, 0, easeOutBack(u, 0.9)) : rad(6) * easeInOut((t - 0.55) / 0.45);
          const lift = t < 0.55 ? Math.sin(Math.PI * u) * 3.5 : 0;
          useProject.setState({ items: pose(spin, lift) });
        },
        [
          { t: 0, dist: 1.12, el: 4 },
          { t: 1, dist: 0.9, el: 0 },
        ],
        // the spin is fast: more instants per frame while it turns
        (t) => (t < 0.5 ? 10 : 4),
      );
    case 'drop':
      // falls in turning, lands, a small bounce, the shadow forms under it
      return objectRig(
        (t) => {
          const land = 0.42;
          let lift: number;
          // starts just above the frame, so it enters straight away
          if (t < land) lift = 20 * (1 - (t / land) ** 2);
          else {
            const u = (t - land) / (1 - land);
            lift = Math.abs(Math.sin(u * Math.PI * 3)) * 2.2 * Math.exp(-u * 6);
          }
          const spin = lerp(-rad(95), 0, easeOutCubic(clamp01(t / 0.6)));
          const tilt = lerp(rad(-18), 0, easeOutCubic(clamp01(t / 0.5)));
          useProject.setState({ items: pose(spin, lift, tilt) });
        },
        [
          { t: 0, el: 6, dist: 1.08 },
          { t: 1, el: 0, dist: 0.92 },
        ],
        (t) => (t < 0.55 ? 8 : 4),
      );
    case 'trailer':
      return montage([
        { rig: makeRig('reveal'), from: 0, to: 0.36 },
        { rig: makeRig('dutch'), from: 0.36, to: 0.66 },
        { rig: makeRig('dive'), from: 0.66, to: 1 },
      ]);
    case 'turntable':
      return objectRig((t) => useProject.setState({ items: pose(t * Math.PI * 2) }));
    case 'swing':
      return objectRig((t) => useProject.setState({ items: pose(Math.sin(t * Math.PI * 2) * rad(32)) }), undefined, () => 4);
    case 'float':
      // a slow sway while rising and settling back (1 cm)
      return objectRig((t) => useProject.setState({ items: pose(Math.sin(t * Math.PI * 2) * rad(7), (1 - Math.cos(t * Math.PI * 2)) / 2) }), undefined, () => 3);
    case 'scroll':
      return scrollRig(view);
    case 'zoom':
      return { moves: false, at: () => undefined, zoom: (t) => 1 + 0.12 * easeInOut(t) };
  }
}

/** The long captures scroll, the camera pushes in a little (3D). */
function scrollRig(view: CameraView | undefined): Rig {
  const p = useProject.getState();
  const assets = useAssets.getState().assets;
  const target = selectSelectedItem(p);
  const slots =
    p.mode === 'photo'
      ? []
      : p.items.flatMap((it) =>
          Object.entries(it.surfaces)
            .filter(([, b]) => b.assetId && b.fit === 'cover' && assets[b.assetId])
            .filter(() => !target || it.id === target.id || p.items.length === 1)
            .map(([slot]) => [it.id, slot] as const),
        );
  const zones = p.mode === 'photo' ? p.photo.zones.filter((z) => z.surface.assetId && z.surface.fit === 'cover').map((z) => z.id) : [];
  return {
    moves: true,
    zoom: () => 1,
    // a slow scroll: a few instants are enough for smooth text
    blur: () => 3,
    at(t) {
      const align = held(t);
      if (p.mode === 'photo') for (const z of zones) useProject.getState().setZoneSurface(z, { align });
      else
        useProject.setState((s) => ({
          items: s.items.map((it) => {
            const mine = slots.filter(([id]) => id === it.id);
            if (!mine.length) return it;
            const surfaces = { ...it.surfaces };
            for (const [, slot] of mine) surfaces[slot] = { ...surfaces[slot], align };
            return { ...it, surfaces };
          }),
        }));
      if (p.mode === 'scene' && view) {
        const off = view.position.clone().sub(view.target).multiplyScalar(1 - 0.06 * easeInOut(t));
        cameraHandle.restore?.({ position: off.add(view.target), target: view.target, fov: view.fov });
      }
    },
  };
}

/** Is there anything to scroll? (an image longer than its face) */
export function hasScrollable() {
  const p = useProject.getState();
  const assets = useAssets.getState().assets;
  const tall = (assetId: string | null, aspect: number) => {
    const a = assetId ? assets[assetId] : undefined;
    return !!a && a.width / a.height < aspect * 0.9;
  };
  if (p.mode === 'photo') return p.photo.zones.some((z) => z.surface.fit === 'cover' && tall(z.surface.assetId, z.aspect));
  return p.items.some((it) => {
    const model = getModel(it.modelId);
    return model.surfaces.some((s) => it.surfaces[s.id]?.fit === 'cover' && tall(it.surfaces[s.id]?.assetId ?? null, s.aspect));
  });
}

/** The live camera is back to the user's view, without roll. */
export function resetRoll() {
  cameraState.roll = 0;
}
