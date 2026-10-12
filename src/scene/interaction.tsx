import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { footprint } from '@/lib/arrange';
import { roundedRectOutline } from '@/lib/geometry/outline';
import { getModel } from '@/models/registry';
import { useUi } from '@/store/ui';
import { useProject, type SceneItem } from '@/store/project';

/*
 * Direct manipulation of devices in the 3D view: click to select, drag to
 * move on the floor, Alt/Option + drag to turn. Helpers (selection ring) live
 * on their own layer, which the exporter never renders.
 */

export const HELPER_LAYER = 1;

interface Drag {
  id: string;
  mode: 'move' | 'rotate';
  /**
   * 'plane': the device slides on the horizontal plane at the grabbed height,
   * staying under the cursor. 'screen': the view grazes that plane (objects on
   * a wall, eye-level shots) — a tiny mouse move would send the object metres
   * away — so it moves sideways along the screen instead.
   */
  how: 'plane' | 'screen' | 'wall';
  planeY: number;
  startHit: THREE.Vector3;
  startPos: [number, number, number];
  startYaw: number;
  startX: number;
  startY: number;
  /** World units per screen pixel at the object's depth, and the camera's right vector on the floor. */
  perPx: number;
  right: THREE.Vector3;
  started: boolean;
}

/** Pixels the pointer must travel before a click becomes a drag. */
const DRAG_THRESHOLD = 4;

/** Shared with the viewport (drops): floor / device picking at screen coordinates. */
export const picking = {
  /** Point on the vertical plane z = const under the pointer (objects sliding along a wall). */
  wall: null as null | ((clientX: number, clientY: number, z: number) => [number, number, number] | null),
  /** Point on the horizontal plane at height `y` (floor by default) under the pointer. */
  floor: null as null | ((clientX: number, clientY: number, y?: number) => [number, number, number] | null),
  item: null as null | ((clientX: number, clientY: number) => string | null),
};

export function InteractionBridge({ floorY }: { floorY: number }) {
  const { camera, gl, scene, controls, invalidate } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    camera.layers.enable(HELPER_LAYER);
  }, [camera]);

  useEffect(() => {
    plane.constant = -floorY;
    const ray = (clientX: number, clientY: number) => {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster;
    };
    picking.floor = (x, y, height) => {
      const p = height === undefined ? plane : new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
      const hit = ray(x, y).ray.intersectPlane(p, new THREE.Vector3());
      return hit ? [hit.x, 0, hit.z] : null;
    };
    picking.wall = (x, y, z) => {
      const hit = ray(x, y).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), new THREE.Vector3());
      return hit ? [hit.x, hit.y, hit.z] : null;
    };
    picking.item = (x, y) => {
      const hits = ray(x, y).intersectObjects(scene.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && !o.userData.itemId) o = o.parent;
        if (o) return o.userData.itemId as string;
      }
      return null;
    };
    return () => {
      picking.floor = null;
      picking.wall = null;
      picking.item = null;
    };
  }, [camera, gl, scene, raycaster, plane, floorY]);

  // Drag loop on window events, so the pointer can leave the device while dragging.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = active.drag;
      if (!d) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
        d.started = true;
      }
      const s = useProject.getState();
      if (d.mode === 'rotate') {
        const yaw = d.startYaw + (e.clientX - d.startX) * 0.012;
        s.updateItem(d.id, (it) => ({ rotation: [it.rotation[0], yaw, it.rotation[2]] }));
      } else if (d.how === 'wall') {
        // along the wall: only X changes, the object stays under the cursor
        const hit = picking.wall?.(e.clientX, e.clientY, d.startHit.z);
        if (!hit) return;
        s.updateItem(d.id, { position: [d.startPos[0] + hit[0] - d.startHit.x, d.startPos[1], d.startPos[2]] });
      } else if (d.how === 'screen') {
        const dx = (e.clientX - d.startX) * d.perPx;
        s.updateItem(d.id, { position: [d.startPos[0] + d.right.x * dx, d.startPos[1], d.startPos[2] + d.right.z * dx] });
      } else {
        const hit = picking.floor?.(e.clientX, e.clientY, d.planeY);
        if (!hit) return;
        s.updateItem(d.id, { position: [d.startPos[0] + hit[0] - d.startHit.x, d.startPos[1], d.startPos[2] + hit[2] - d.startHit.z] });
      }
      invalidate();
    };
    const onUp = () => {
      if (!active.drag) return;
      active.drag = null;
      gl.domElement.style.cursor = '';
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl, controls, invalidate]);

  return null;
}

const active: { drag: Drag | null } = { drag: null };

/** Wraps a device: tags it for picking and handles select / drag. */
export function Interactive({ item, children }: { item: SceneItem; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { gl, controls } = useThree();
  useEffect(() => {
    if (group.current) group.current.userData.itemId = item.id;
  }, [item.id]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = useProject.getState();
    if (s.selectedId !== item.id) s.selectItem(item.id);
    // picking a device in the scene opens its settings
    if (useUi.getState().screen === 'studio') useUi.getState().setStudioPage('settings');
    if (item.locked) return;
    const cam = e.camera as THREE.PerspectiveCamera;
    const planeY = e.point.y;
    // How steeply the view meets the horizontal plane: shallow → sideways screen drag.
    const grazing = Math.abs(e.ray.direction.y) < 0.28;
    const hit = picking.floor?.(e.nativeEvent.clientX, e.nativeEvent.clientY, planeY);
    if (!hit && !grazing) return;
    const depth = e.point.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3()));
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * depth) / gl.domElement.clientHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    const onWall = !!getModel(item.modelId).wallFor?.({ ...item.params });
    const wallHit = onWall ? picking.wall?.(e.nativeEvent.clientX, e.nativeEvent.clientY, e.point.z) : null;
    active.drag = {
      id: item.id,
      how: wallHit ? 'wall' : grazing || !hit ? 'screen' : 'plane',
      planeY,
      mode: e.nativeEvent.altKey ? 'rotate' : 'move',
      startHit: new THREE.Vector3(...(wallHit ?? hit ?? [0, 0, 0])),
      startPos: [...item.position],
      startYaw: item.rotation[1],
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      perPx,
      right,
      started: false,
    };
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
    gl.domElement.style.cursor = e.nativeEvent.altKey ? 'ew-resize' : 'grabbing';
  };

  return (
    <group
      ref={group}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!active.drag) gl.domElement.style.cursor = item.locked ? 'pointer' : 'grab';
      }}
      onPointerOut={() => {
        if (!active.drag) gl.domElement.style.cursor = '';
      }}
    >
      {children}
    </group>
  );
}

/** Thin accent outline on the floor around the selected device (preview only). */
export function SelectionRing({ item, floorY }: { item: SceneItem; floorY: number }) {
  const f = footprint(item);
  const geometry = useMemo(() => {
    const pad = 1.6;
    const outline = roundedRectOutline(f.w + pad * 2, f.d + pad * 2, Math.min(3, (f.d + pad * 2) / 2), { smooth: 0.4, segments: 10 });
    const pts = outline.map((p) => new THREE.Vector3(p.x, 0, -p.y));
    pts.push(pts[0].clone());
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [f.w, f.d]);
  const line = useMemo(() => {
    const l = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ff5c35', transparent: true, opacity: 0.9, depthTest: false }));
    l.layers.set(HELPER_LAYER);
    l.renderOrder = 10;
    return l;
  }, [geometry]);
  return <primitive object={line} position={[item.position[0], floorY + 0.05, item.position[2]]} rotation={[0, item.rotation[1], 0]} />;
}
