import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { roundedSlab } from '@/lib/geometry/sweep';
import { getModel } from '@/models/registry';
import { sizeOf } from '@/models/types';
import type { Decor, SceneItem } from '@/store/project';
import { useRealMaterial } from './realMaterials';
import { useBackdropMaterial } from './backdrop';

/*
 * 3D set dressing: a seamless studio sweep, a podium (painted or in a real
 * material, optional arch), a real-material surface fading into the
 * background, or a real place (photographed room + table).
 */

/* ------------------------------------------------------------ helpers */

/** Radius of the floor area the devices occupy (for podium sizing). */
export function itemsRadius(items: SceneItem[]) {
  let r = 6;
  for (const it of items) {
    const model = getModel(it.modelId);
    const [w, h, d] = sizeOf(model, it.params, aspectsOf(it.surfaces)).size;
    const flat = it.pose === 'flat' && model.anchor !== 'bottom';
    r = Math.max(r, Math.hypot(it.position[0], it.position[2]) + Math.hypot(w / 2, flat ? h / 2 : d / 2));
  }
  return r;
}

export interface DecorLayout {
  /** Height of the surface the devices stand on. */
  floorY: number;
  /** Reflective surface under the devices (null → large floor). */
  top: THREE.BufferGeometry | null;
}

export function decorLayout(decor: Decor, items: SceneItem[]): DecorLayout {
  if (decor.kind !== 'podium') return { floorY: 0, top: null };
  const r = itemsRadius(items) + 3;
  const h = Math.max(4, r * 0.38);
  const top = decor.shape === 'cylinder' ? new THREE.CircleGeometry(r, 96) : new THREE.PlaneGeometry(r * 2, r * 2);
  return { floorY: h, top };
}

let fadeTex: THREE.Texture | null = null;
/** White centre → black edge: lets a surface melt into the 2D background. */
function radialFade() {
  if (fadeTex) return fadeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.5, '#fff');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  fadeTex = new THREE.CanvasTexture(c);
  return fadeTex;
}

/** Profile (z, y) of a cyclorama: floor, cove, wall; swept along X. */
function sweepGeometry(width: number) {
  const pts: { z: number; y: number; nz: number; ny: number }[] = [];
  const R = 60;
  const back = SWEEP_BACK;
  // floor and wall run far enough that their edges never show, even with long lenses
  pts.push({ z: 6000, y: 0, nz: 0, ny: 1 });
  pts.push({ z: back + R, y: 0, nz: 0, ny: 1 });
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push({ z: back + R - Math.sin(a) * R, y: R - Math.cos(a) * R, nz: Math.sin(a), ny: Math.cos(a) });
  }
  pts.push({ z: back, y: 4000, nz: 1, ny: 0 });
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  for (const p of pts) {
    pos.push(-width / 2, p.y, p.z, width / 2, p.y, p.z);
    nrm.push(0, p.ny, p.nz, 0, p.ny, p.nz);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------ component */

export function DecorScene({ decor, items }: { decor: Decor; items: SceneItem[] }) {
  switch (decor.kind) {
    case 'sweep':
      return <Sweep />;
    case 'podium':
      return <Podium decor={decor} items={items} />;
    case 'surface':
      return <Surface decor={decor} />;
    case 'table':
      return <TableSet decor={decor} />;
    default:
      return null;
  }
}

/** Seamless studio backdrop: it shows the background, curving from the floor up the wall. */
function Sweep() {
  const geo = useMemo(() => sweepGeometry(16000), []);
  const material = useBackdropMaterial({ roughness: 0.92 });
  return <mesh geometry={geo} material={material} receiveShadow />;
}

function Podium({ decor, items }: { decor: Decor; items: SceneItem[] }) {
  const r = itemsRadius(items) + 3;
  const h = Math.max(4, r * 0.38);
  const g = useMemo(
    () => ({
      block: roundedSlab({ width: r * 2, height: r * 2, radius: 1.2, thickness: h, front: 0.5, back: 0.2, smooth: 0.5, segments: 12, edgeSegments: 6 }),
      arch: roundedSlab({ width: r * 2.1, height: r * 3.2, radius: [r * 1.05, r * 1.05, 0, 0], thickness: 2.4, front: 0.6, back: 0.6, smooth: 0, segments: 48, edgeSegments: 6 }),
    }),
    [r, h],
  );
  const real = useRealMaterial(decor.material, r * 2, r * 2);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.78 }), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    paint.color.set(decor.color);
    invalidate();
  }, [paint, decor.color, invalidate]);
  const material = decor.podiumFinish === 'material' ? real : paint;
  const darker = '#' + new THREE.Color(decor.color).multiplyScalar(0.82).getHexString();
  return (
    <group>
      {decor.shape === 'cylinder' ? (
        <mesh position={[0, h / 2, 0]} material={material} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h, 128, 1]} />
        </mesh>
      ) : (
        <mesh geometry={g.block} material={material} position={[0, h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      )}
      {decor.arch && (
        <mesh geometry={g.arch} position={[0, r * 1.6, -r - 6]} castShadow receiveShadow>
          <meshStandardMaterial color={darker} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Surface({ decor }: { decor: Decor }) {
  const size = 300;
  const material = useRealMaterial(decor.material, size, size, radialFade());
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={material} receiveShadow>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}

export { TABLE_BACK } from '@/lib/arrange';
import { SWEEP_BACK, TABLE_BACK } from '@/lib/arrange';
import { aspectsOf } from '@/models/imageAspects';

/**
 * Product-photography table set: a real-material table top pushed against a
 * wall that shows the background. Both are real geometry, so depth of field blurs the wall
 * naturally and the key light's projected shadows land on it.
 */
function TableSet({ decor }: { decor: Decor }) {
  const depth = 200;
  const table = useMemo(
    () => roundedSlab({ width: 600, height: depth, radius: 2, thickness: 4, front: { d: 0.6, z: 0.6 }, back: 0.3, smooth: 0.4, segments: 8, edgeSegments: 6 }),
    [],
  );
  const top = useRealMaterial(decor.material, 600, depth);
  const wall = useBackdropMaterial({ plaster: true });
  return (
    <group>
      <mesh geometry={table} material={top} position={[0, -2, TABLE_BACK + depth / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      <mesh material={wall} position={[0, 150, TABLE_BACK]} receiveShadow>
        <planeGeometry args={[900, 304]} />
      </mesh>
    </group>
  );
}
