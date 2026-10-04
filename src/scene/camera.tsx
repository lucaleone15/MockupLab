import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ratioValue } from '@/export/settings';
import { getModel } from '@/models/registry';
import { isLandscape } from '@/models/types';
import { useAssets } from '@/store/assets';
import { selectSelectedItem, useProject, type CameraPresetId, type CameraSettings, type SceneItem } from '@/store/project';
import { useUi } from '@/store/ui';
import { Accumulator, applyLensSample, type LensSetup } from './accumulator';

/* ------------------------------------------------------------ optics */

const SENSOR_HEIGHT = 24; // full-frame, mm

export const focalToFov = (mm: number) => THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_HEIGHT / 2 / mm));

/** Shared with the exporter: what the camera looks at, the point to keep sharp, and the subject size. */
export const cameraState = {
  target: new THREE.Vector3(0, 7, 0),
  focus: new THREE.Vector3(0, 7, 0),
  forward: new THREE.Vector3(0, 0, -1),
  subject: 15,
};

/** f-number for the aperture slider: 0 → f/16, 1 → f/1.4 (log scale). */
export const fNumber = (aperture: number) => 16 * Math.pow(1.4 / 16, aperture);

/**
 * Physical thin lens: radius = focal length / (2 N). Scene units are real
 * centimetres, so depth of field behaves like a real camera: a phone shot
 * from 40 cm gets a shallow focus, a desktop shot from a metre a deeper one.
 */
export function lensFor(camera: THREE.PerspectiveCamera, settings: CameraSettings): LensSetup {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  // Several devices: focus on the composition and stop down to f/8 at most,
  // like a photographer would for a group, so every design stays readable.
  const group = useProject.getState().items.filter((it) => it.visible).length > 1;
  const point = group ? cameraState.target : cameraState.focus;
  // Distance to the focus plane along the view axis (thin-lens model).
  const toFocus = point.clone().sub(camera.position).dot(forward);
  const focusDistance = Math.max(1, toFocus + settings.focus * cameraState.subject * 0.8);
  const n = group ? Math.max(8, fNumber(settings.aperture)) : fNumber(settings.aperture);
  const radius = settings.dof ? settings.focal / 10 / (2 * n) : 0;
  return { radius, focusDistance };
}

/** World position of the point to keep in focus for an item (its screen). */
export function focusPoint(item: SceneItem, floorY: number): THREE.Vector3 {
  const model = getModel(item.modelId);
  let local: THREE.Vector3;
  if (model.anchor === 'bottom') local = new THREE.Vector3(...(model.focus ?? model.view.target));
  else {
    const flat = item.pose === 'flat';
    const landscape = isLandscape(item.params);
    const [w, h, d] = model.size;
    local = new THREE.Vector3(0, flat ? d / 2 : (landscape ? w : h) / 2, 0);
  }
  return local
    .multiplyScalar(item.scale)
    .applyEuler(new THREE.Euler(...item.rotation))
    .add(new THREE.Vector3(item.position[0], item.position[1] + floorY, item.position[2]));
}

/* ------------------------------------------------------------ framing */

interface PresetDef {
  /** Degrees around the device, 0 = facing its screen. null = the model's own 3/4 view. */
  azimuth: number | null;
  elevation: number;
  focal?: number;
  flat?: boolean;
}

export const CAMERA_PRESETS: Record<Exclude<CameraPresetId, 'custom'>, PresetDef> = {
  front: { azimuth: 0, elevation: 4 },
  threeQuarter: { azimuth: null, elevation: 0 },
  isometric: { azimuth: 45, elevation: 35.26, focal: 600 },
  top: { azimuth: 0, elevation: 89.5, flat: true },
  high: { azimuth: 28, elevation: 46 },
  low: { azimuth: 22, elevation: 3 },
};

/** Bounding box corners of an item in world space. */
function itemCorners(item: SceneItem, floorY: number): THREE.Vector3[] {
  const model = getModel(item.modelId);
  const [w, h, d] = model.size;
  const landscape = isLandscape(item.params) && model.anchor !== 'bottom';
  const flat = item.pose === 'flat' && model.anchor !== 'bottom';
  const fw = landscape ? h : w;
  const fh = landscape ? w : h;
  const box = flat
    ? { x: fw / 2, y0: 0, y1: d + 0.3, z: fh / 2 }
    : { x: fw / 2, y0: 0, y1: fh, z: model.anchor === 'bottom' ? d / 2 : d / 2 + 0.3 };
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(item.position[0], item.position[1] + floorY, item.position[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...item.rotation)),
    new THREE.Vector3(item.scale, item.scale, item.scale),
  );
  const out: THREE.Vector3[] = [];
  for (const x of [-box.x, box.x]) for (const y of [box.y0, box.y1]) for (const z of [-box.z, box.z]) out.push(new THREE.Vector3(x, y, z).applyMatrix4(m));
  return out;
}

/**
 * Camera position that frames all items for a viewing direction: every bbox
 * corner is projected in the camera basis and the distance is the smallest
 * one keeping them inside `fill` of the frame.
 */
export function frame(items: SceneItem[], dir: THREE.Vector3, fovDeg: number, aspect: number, floorY: number, fill = 0.76) {
  const corners = items.flatMap((it) => itemCorners(it, floorY));
  const box = new THREE.Box3().setFromPoints(corners);
  const target = box.getCenter(new THREE.Vector3());
  const forward = dir.clone().normalize().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tv = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * fill;
  const th = tv * aspect;
  let dist = 1;
  for (const c of corners) {
    const v = c.clone().sub(target);
    const x = Math.abs(v.dot(right));
    const y = Math.abs(v.dot(up));
    const z = v.dot(forward);
    dist = Math.max(dist, -z + x / th, -z + y / tv);
  }
  return { target, position: target.clone().addScaledVector(dir.clone().normalize(), dist), subject: box.getSize(new THREE.Vector3()).length() };
}

/** Direction from target to camera for a preset, relative to the selected device's yaw. */
export function presetDirection(preset: CameraPresetId, item: SceneItem | null): THREE.Vector3 {
  const model = getModel(item?.modelId ?? 'phone-pro');
  const def = preset === 'custom' ? CAMERA_PRESETS.threeQuarter : CAMERA_PRESETS[preset];
  if (def.azimuth === null) return new THREE.Vector3(...model.view.offset).normalize();
  const yaw = item?.rotation[1] ?? 0;
  const az = THREE.MathUtils.degToRad(def.azimuth) + yaw;
  const el = THREE.MathUtils.degToRad(def.elevation);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/* ------------------------------------------------------------ rig */

export function CameraRig({ floorY }: { floorY: number }) {
  useAdaptiveNear();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const resetToken = useUi((s) => s.viewResetToken);
  const settings = useProject((s) => s.camera);
  const items = useProject((s) => s.items);
  const item = useProject(selectSelectedItem);
  const ratio = useProject((s) => s.export.ratio);

  const latest = useRef({ items, item, ratio, settings, floorY });
  latest.current = { items, item, ratio, settings, floorY };

  // Focal length the camera currently uses (shared by the framing and dolly effects).
  const lastFocal = useRef(settings.focal);

  // Re-frame on reset, preset, device, orientation, pose, ratio or décor height changes.
  const frameKey = [
    resetToken,
    settings.preset,
    items.map((i) => `${i.modelId}:${i.params.orientation}:${i.pose}`).join(','),
    ratio,
    floorY.toFixed(2),
  ].join('|');

  useEffect(() => {
    const { items, item, ratio, settings, floorY } = latest.current;
    lastFocal.current = settings.focal;
    camera.fov = focalToFov(settings.focal);
    camera.updateProjectionMatrix();
    // A custom (orbited) view keeps its angle and is only re-fitted.
    const dir =
      settings.preset === 'custom' && controls.current
        ? camera.position.clone().sub(controls.current.target)
        : presetDirection(settings.preset, item);
    const f = frame(items, dir, camera.fov, ratioValue(ratio), floorY);
    camera.position.copy(f.position);
    cameraState.target.copy(f.target);
    cameraState.subject = f.subject;
    if (item) cameraState.focus.copy(focusPoint(item, floorY));
    controls.current?.target.copy(f.target);
    controls.current?.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, camera, invalidate]);

  useEffect(() => {
    if (item) cameraState.focus.copy(focusPoint(item, floorY));
    invalidate();
  }, [item, floorY, invalidate]);

  // Focal length changes dolly the camera so the framing is kept ("dolly zoom").
  useEffect(() => {
    const prev = focalToFov(lastFocal.current);
    const next = focalToFov(settings.focal);
    lastFocal.current = settings.focal;
    if (Math.abs(prev - next) < 1e-6) return;
    const target = controls.current?.target ?? cameraState.target;
    const off = camera.position.clone().sub(target);
    off.multiplyScalar(Math.tan(THREE.MathUtils.degToRad(prev / 2)) / Math.tan(THREE.MathUtils.degToRad(next / 2)));
    camera.position.copy(target).add(off);
    camera.fov = next;
    camera.updateProjectionMatrix();
    controls.current?.update();
    invalidate();
  }, [settings.focal, camera, invalidate]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Lets the visual check scripts frame close-ups.
    Object.assign(window, {
      __mockuplabCamera: (pos: [number, number, number], target: [number, number, number], fov?: number) => {
        camera.position.set(...pos);
        controls.current?.target.set(...target);
        cameraState.target.set(...target);
        if (fov) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        controls.current?.update();
        invalidate();
      },
    });
  }, [camera, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      minDistance={8}
      maxDistance={6000}
      maxPolarAngle={Math.PI * 0.499}
      onChange={() => controls.current && cameraState.target.copy(controls.current.target)}
      onStart={() => {
        if (useProject.getState().camera.preset !== 'custom') useProject.getState().setCamera({ preset: 'custom' });
      }}
    />
  );
}

/**
 * Keeps depth precision high at every distance: the near plane follows the
 * distance to the subject (z-buffer precision depends on far/near only
 * through near), so thin layers — cover glass, bezels, cutouts — never fight.
 */
export function useAdaptiveNear() {
  useFrame(({ camera, controls }) => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.getWorldDirection(cameraState.forward);
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? cameraState.target;
    const near = THREE.MathUtils.clamp(cam.position.distanceTo(target) * 0.12, 0.5, 60);
    if (Math.abs(near - cam.near) / cam.near > 0.05) {
      cam.near = near;
      cam.far = Math.max(8000, near * 4000);
      cam.updateProjectionMatrix();
    }
  }, -1);
}

/* ------------------------------------------------------------ depth of field preview */

const PREVIEW_SAMPLES = 40;

/**
 * Takes over rendering while depth of field is on: shows the sharp frame while
 * things move, then accumulates lens samples progressively when idle.
 */
export function DofPreview() {
  const settings = useProject((s) => s.camera);
  const accumulator = useMemo(() => new Accumulator(), []);
  useEffect(() => () => accumulator.dispose(), [accumulator]);
  const state = useRef({ key: '', version: 0, seen: -1 });

  // Any project or asset change restarts the accumulation.
  useEffect(() => {
    const bump = () => (state.current.version += 1);
    const a = useProject.subscribe(bump);
    const b = useAssets.subscribe(bump);
    return () => {
      a();
      b();
    };
  }, []);

  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame(({ gl, scene, camera, invalidate }) => {
    const cam = camera as THREE.PerspectiveCamera;
    gl.getDrawingBufferSize(size);
    const key = `${cam.matrixWorld.elements.join(',')}|${cam.projectionMatrix.elements.join(',')}|${size.x}x${size.y}`;
    const st = state.current;
    if (key !== st.key || st.version !== st.seen) {
      st.key = key;
      st.seen = st.version;
      accumulator.reset(gl, size.x, size.y);
    }
    if (accumulator.count < PREVIEW_SAMPLES) {
      const lens = lensFor(cam, settings);
      const restore = applyLensSample(cam, lens, accumulator.count, PREVIEW_SAMPLES, { width: size.x, height: size.y }, { x: 0, y: 0, width: size.x, height: size.y });
      gl.setRenderTarget(null);
      gl.clear();
      gl.render(scene, cam);
      accumulator.add(gl);
      cam.clearViewOffset();
      restore();
      // Keep the camera matrices identical to the key so the next frame continues.
      st.key = `${cam.matrixWorld.elements.join(',')}|${cam.projectionMatrix.elements.join(',')}|${size.x}x${size.y}`;
      if (accumulator.count < PREVIEW_SAMPLES) invalidate();
    }
    accumulator.resolve(gl);
  }, 1);
  return null;
}
