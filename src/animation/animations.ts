import * as THREE from 'three';
import type { I18nKey } from '@/i18n';
import { getModel } from '@/models/registry';
import { cameraHandle } from '@/scene/camera';
import { useAssets } from '@/store/assets';
import { selectSelectedItem, useProject, type AnimationId, type SceneItem, type Vec3, type WorkMode } from '@/store/project';

/*
 * Animations, as a function of time: a "rig" captures the scene once, then
 * `at(t)` (t from 0 to 1 over the clip) sets the state of that instant —
 * so a frame can be rendered for any t, in any order, at any frame rate.
 * Loops (turntable, swing, float) end where they start.
 */

export interface AnimationDef {
  id: AnimationId;
  label: I18nKey;
  hint: I18nKey;
  modes: WorkMode[];
  /** Seamless loop (a GIF can repeat it forever). */
  loop: boolean;
}

export const ANIMATIONS: AnimationDef[] = [
  { id: 'turntable', label: 'anim.turntable', hint: 'anim.turntable.hint', modes: ['scene'], loop: true },
  { id: 'swing', label: 'anim.swing', hint: 'anim.swing.hint', modes: ['scene'], loop: true },
  { id: 'orbit', label: 'anim.orbit', hint: 'anim.orbit.hint', modes: ['scene'], loop: false },
  { id: 'scroll', label: 'anim.scroll', hint: 'anim.scroll.hint', modes: ['scene', 'photo'], loop: false },
  { id: 'float', label: 'anim.float', hint: 'anim.float.hint', modes: ['scene'], loop: true },
  { id: 'zoom', label: 'anim.zoom', hint: 'anim.zoom.hint', modes: ['photo'], loop: false },
];

export const animationsFor = (mode: WorkMode) => ANIMATIONS.filter((a) => a.modes.includes(mode));

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** 0 → 1 with a pause at both ends (reading time before and after a scroll). */
const held = (t: number, hold = 0.14) => ease(Math.min(1, Math.max(0, (t - hold) / (1 - 2 * hold))));

/** Items that can move: things hanging on a wall stay where they are. */
const movable = (it: SceneItem) => it.visible && !getModel(it.modelId).wallFor?.(it.params);

export interface Rig {
  /** Sets the scene at time t (0..1). */
  at(t: number): void;
  /** Photo mode zoom factor at t, applied when composing (1 = none). */
  zoom(t: number): number;
}

export function makeRig(id: AnimationId): Rig {
  const p = useProject.getState();
  const items = p.items;
  const moving = items.filter(movable);
  const centre = moving.length
    ? moving.reduce((c, it) => [c[0] + it.position[0] / moving.length, 0, c[2] + it.position[2] / moving.length] as Vec3, [0, 0, 0] as Vec3)
    : ([0, 0, 0] as Vec3);
  const view = cameraHandle.save?.();

  /** Items turned by `angle` around the composition centre, lifted by `lift`. */
  const pose = (angle: number, lift = 0) =>
    items.map((it) => {
      if (!movable(it)) return it;
      const dx = it.position[0] - centre[0];
      const dz = it.position[2] - centre[2];
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return {
        ...it,
        position: [centre[0] + dx * c + dz * s, it.position[1] + lift, centre[2] - dx * s + dz * c] as Vec3,
        rotation: [it.rotation[0], it.rotation[1] + angle, it.rotation[2]] as Vec3,
      };
    });

  // scrolling: every face whose image is longer than the face
  const scrollable = (() => {
    const assets = useAssets.getState().assets;
    if (p.mode === 'photo') return p.photo.zones.filter((z) => z.surface.assetId && z.surface.fit === 'cover').map((z) => z.id);
    const target = selectSelectedItem(p);
    return items.flatMap((it) =>
      Object.entries(it.surfaces)
        .filter(([, b]) => b.assetId && b.fit === 'cover' && assets[b.assetId])
        .filter(() => !target || it.id === target.id || items.length === 1)
        .map(([slot]) => [it.id, slot] as const),
    );
  })();

  return {
    at(t) {
      switch (id) {
        case 'turntable':
          useProject.setState({ items: pose(t * Math.PI * 2) });
          break;
        case 'swing':
          useProject.setState({ items: pose(Math.sin(t * Math.PI * 2) * THREE.MathUtils.degToRad(32)) });
          break;
        case 'float':
          // a slow sway while rising and settling back (1 cm)
          useProject.setState({ items: pose(Math.sin(t * Math.PI * 2) * THREE.MathUtils.degToRad(7), (1 - Math.cos(t * Math.PI * 2)) / 2) });
          break;
        case 'orbit': {
          if (!view) break;
          // a slow arc around the subject while pushing in
          const k = ease(t);
          const off = view.position.clone().sub(view.target);
          const sph = new THREE.Spherical().setFromVector3(off);
          sph.theta += THREE.MathUtils.degToRad(-24 + 48 * k);
          sph.phi = Math.min(Math.PI * 0.49, Math.max(0.15, sph.phi + THREE.MathUtils.degToRad(5 - 9 * k)));
          sph.radius *= 1.1 - 0.2 * k;
          cameraHandle.restore?.({ position: new THREE.Vector3().setFromSpherical(sph).add(view.target), target: view.target, fov: view.fov });
          break;
        }
        case 'scroll': {
          const align = held(t);
          if (p.mode === 'photo') for (const z of scrollable as string[]) useProject.getState().setZoneSurface(z, { align });
          else
            useProject.setState((s) => ({
              items: s.items.map((it) => {
                const slots = (scrollable as (readonly [string, string])[]).filter(([id]) => id === it.id);
                if (!slots.length) return it;
                const surfaces = { ...it.surfaces };
                for (const [, slot] of slots) surfaces[slot] = { ...surfaces[slot], align };
                return { ...it, surfaces };
              }),
            }));
          // and a gentle push-in in 3D
          if (p.mode === 'scene' && view) {
            const off = view.position.clone().sub(view.target).multiplyScalar(1 - 0.06 * ease(t));
            cameraHandle.restore?.({ position: off.add(view.target), target: view.target, fov: view.fov });
          }
          break;
        }
        case 'zoom':
          break;
      }
    },
    zoom(t) {
      return id === 'zoom' ? 1 + 0.12 * ease(t) : 1;
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
