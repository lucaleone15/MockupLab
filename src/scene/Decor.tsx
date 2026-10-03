import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { patternCanvas, type PatternSpec } from '@/lib/patterns';
import { roundedSlab } from '@/lib/geometry/sweep';
import { getModel } from '@/models/registry';
import { prepareTexture } from '@/store/assets';
import type { Decor, SceneItem, SurfaceMaterialId } from '@/store/project';

/*
 * 3D set dressing: a seamless studio sweep, a podium (with an optional arch
 * backdrop), a textured surface fading into the background, or a desk against
 * a wall. Surfaces use the procedural pattern engine for their textures.
 */

export const SURFACES: Record<SurfaceMaterialId, { spec: PatternSpec; roughness: number; tile: number }> = {
  marble: { spec: { pattern: 'marble', colors: ['#f2f0ec', '#8d8a86', '#c9a96e'], scale: 1, grain: 0, seed: 3 }, roughness: 0.22, tile: 70 },
  wood: { spec: { pattern: 'wood', colors: ['#c99d70', '#8a5f3c', '#5a3a22'], scale: 1, grain: 0, seed: 1 }, roughness: 0.5, tile: 70 },
  concrete: { spec: { pattern: 'concrete', colors: ['#bdbab4', '#8f8b85', '#4d4a46'], scale: 1.2, grain: 0, seed: 2 }, roughness: 0.85, tile: 80 },
  terrazzo: { spec: { pattern: 'terrazzo', colors: ['#ece7df', '#d9764a', '#4b6e8c'], scale: 1.4, grain: 0, seed: 5 }, roughness: 0.38, tile: 28 },
  linen: { spec: { pattern: 'linen', colors: ['#e7e0d3', '#c3b8a5', '#000000'], scale: 1, grain: 0, seed: 4 }, roughness: 0.95, tile: 30 },
  paper: { spec: { pattern: 'paper', colors: ['#f3efe6', '#d9d2c3', '#7d7468'], scale: 1, grain: 0, seed: 6 }, roughness: 0.9, tile: 60 },
};

const textures = new Map<SurfaceMaterialId, THREE.Texture>();

function surfaceTexture(id: SurfaceMaterialId) {
  let t = textures.get(id);
  if (!t) {
    t = prepareTexture(new THREE.CanvasTexture(patternCanvas(SURFACES[id].spec, 2048, 2048)));
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    textures.set(id, t);
  }
  return t;
}

/** Material for a surface of `size` cm (texture tiled at the material's physical scale). */
function useSurfaceMaterial(id: SurfaceMaterialId, sizeX: number, sizeY: number, fade = false) {
  const material = useMemo(() => {
    const base = surfaceTexture(id);
    const map = base.clone();
    map.needsUpdate = true;
    map.repeat.set(sizeX / SURFACES[id].tile, sizeY / SURFACES[id].tile);
    const m = new THREE.MeshStandardMaterial({ map, roughness: SURFACES[id].roughness, metalness: 0 });
    if (fade) {
      m.alphaMap = radialFade();
      m.transparent = true;
      m.depthWrite = false;
    }
    return m;
  }, [id, sizeX, sizeY, fade]);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
  }, [material]);
  return material;
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
  grd.addColorStop(0.55, '#fff');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  fadeTex = new THREE.CanvasTexture(c);
  return fadeTex;
}

/* ------------------------------------------------------------ helpers */

/** Radius of the floor area the devices occupy (for podium sizing). */
export function itemsRadius(items: SceneItem[]) {
  let r = 6;
  for (const it of items) {
    const [w, h, d] = getModel(it.modelId).size;
    const flat = it.pose === 'flat' && getModel(it.modelId).anchor !== 'bottom';
    const fx = w / 2;
    const fz = flat ? h / 2 : d / 2;
    r = Math.max(r, Math.hypot(it.position[0], it.position[2]) + Math.hypot(fx, fz));
  }
  return r;
}

export interface DecorLayout {
  /** Height of the surface the devices stand on. */
  floorY: number;
  /** Reflective / shadow surface under the devices (null → infinite floor). */
  top: THREE.BufferGeometry | null;
}

export function decorLayout(decor: Decor, items: SceneItem[]): DecorLayout {
  if (decor.kind !== 'podium') return { floorY: 0, top: null };
  const r = itemsRadius(items) + 3;
  const h = Math.max(4, r * 0.38);
  const top =
    decor.shape === 'cylinder'
      ? new THREE.CircleGeometry(r, 96)
      : new THREE.PlaneGeometry(r * 2, r * 2);
  return { floorY: h, top };
}

/* ------------------------------------------------------------ sweep */

/** Profile (z, y) of a cyclorama: floor, cove, wall; swept along X. */
function sweepGeometry(width: number) {
  const pts: { z: number; y: number; nz: number; ny: number }[] = [];
  const R = 60;
  const back = -70;
  pts.push({ z: 260, y: 0, nz: 0, ny: 1 });
  pts.push({ z: back + R, y: 0, nz: 0, ny: 1 });
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push({ z: back + R - Math.sin(a) * R, y: R - Math.cos(a) * R, nz: Math.sin(a), ny: Math.cos(a) });
  }
  pts.push({ z: back, y: 400, nz: 1, ny: 0 });
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
      return <Sweep color={decor.color} />;
    case 'podium':
      return <Podium decor={decor} items={items} />;
    case 'surface':
      return <Surface material={decor.material} />;
    case 'desk':
      return <Desk decor={decor} />;
    default:
      return null;
  }
}

function Sweep({ color }: { color: string }) {
  const geo = useMemo(() => sweepGeometry(900), []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
    </mesh>
  );
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
  const base = new THREE.Color(decor.color);
  const darker = '#' + base.clone().multiplyScalar(0.82).getHexString();
  return (
    <group>
      {decor.shape === 'cylinder' ? (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h, 128, 1]} />
          <meshStandardMaterial color={decor.color} roughness={0.78} />
        </mesh>
      ) : (
        <mesh geometry={g.block} position={[0, h / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={decor.color} roughness={0.78} />
        </mesh>
      )}
      {decor.arch && (
        <mesh geometry={g.arch} position={[0, r * 1.6, -r - 6]} castShadow receiveShadow>
          <meshStandardMaterial color={darker} roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Surface({ material }: { material: SurfaceMaterialId }) {
  const size = 320;
  const mat = useSurfaceMaterial(material, size, size, true);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={mat} receiveShadow>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}

function Desk({ decor }: { decor: Decor }) {
  const top = useSurfaceMaterial(decor.material, 260, 120);
  return (
    <group>
      <mesh position={[0, -2.2, 10]} material={top} receiveShadow castShadow>
        <boxGeometry args={[260, 4.4, 120]} />
      </mesh>
      <mesh position={[0, 120, -50]} receiveShadow>
        <planeGeometry args={[700, 400]} />
        <meshStandardMaterial color={decor.color} roughness={0.95} />
      </mesh>
    </group>
  );
}
