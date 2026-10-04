import * as THREE from 'three';

/*
 * Procedural micro-surfaces for device materials. Real aluminium is bead-
 * blasted, titanium bands are brushed, matte glass is etched: these tiny
 * structures break up highlights the way the real finishes do, instead of
 * the perfectly smooth "CG" look. Generated once on a canvas, tiled.
 */

export type Micro = 'bead' | 'brushed' | 'frost';

const SIZE = 512;
const normals = new Map<Micro, THREE.Texture>();
let rough: THREE.Texture | null = null;

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box blur on a wrapped height field. */
function blur(h: Float32Array<ArrayBufferLike>, r: number): Float32Array<ArrayBufferLike> {
  if (r < 1) return h;
  const out = new Float32Array(h.length);
  const tmp = new Float32Array(h.length);
  const n = r * 2 + 1;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += h[y * SIZE + ((x + k + SIZE) % SIZE)];
      tmp[y * SIZE + x] = s / n;
    }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[((y + k + SIZE) % SIZE) * SIZE + x];
      out[y * SIZE + x] = s / n;
    }
  return out;
}

function heightField(kind: Micro): Float32Array<ArrayBufferLike> {
  const r = rng(kind === 'bead' ? 11 : kind === 'brushed' ? 23 : 37);
  const h = new Float32Array(SIZE * SIZE);
  if (kind === 'brushed') {
    // Long streaks along X: each row gets its own value, plus a little grain.
    const rows = new Float32Array(SIZE);
    for (let y = 0; y < SIZE; y++) rows[y] = r();
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = rows[y] * 0.85 + r() * 0.15;
    return h;
  }
  for (let i = 0; i < h.length; i++) h[i] = r();
  return blur(h, kind === 'frost' ? 2 : 1);
}

/** Tangent-space normal map from a height field (wrapped, tileable). */
export function microNormal(kind: Micro): THREE.Texture {
  let t = normals.get(kind);
  if (t) return t;
  const h = heightField(kind);
  const strength = kind === 'brushed' ? 2.5 : kind === 'frost' ? 6 : 4;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = h[y * SIZE + ((x + 1) % SIZE)] - h[y * SIZE + ((x - 1 + SIZE) % SIZE)];
      const dy = h[((y + 1) % SIZE) * SIZE + x] - h[((y - 1 + SIZE) % SIZE) * SIZE + x];
      const n = new THREE.Vector3(-dx * strength, -dy * strength, 1).normalize();
      const i = (y * SIZE + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  normals.set(kind, t);
  return t;
}

/**
 * Low-frequency roughness variation (G channel, 0.93–1.0 × roughness): the
 * faint unevenness of handled objects, which keeps large flat surfaces from
 * reflecting like perfect mirrors.
 */
export function roughnessVariation(): THREE.Texture {
  if (rough) return rough;
  const r = rng(5);
  let h: Float32Array<ArrayBufferLike> = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < h.length; i++) h[i] = r();
  h = blur(blur(h, 12), 12);
  let min = Infinity;
  let max = -Infinity;
  for (const v of h) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < h.length; i++) {
    const v = Math.round((0.93 + 0.07 * ((h[i] - min) / (max - min || 1))) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  rough = new THREE.CanvasTexture(c);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.colorSpace = THREE.NoColorSpace;
  return rough;
}

/** Applies a micro-surface to a material, tiled `repeat` times over its UVs. */
export function withMicro<T extends THREE.MeshStandardMaterial>(m: T, kind: Micro, repeat: [number, number], strength: number): T {
  const n = microNormal(kind).clone();
  n.repeat.set(...repeat);
  n.needsUpdate = true;
  m.normalMap = n;
  m.normalScale.set(strength, strength);
  const rv = roughnessVariation().clone();
  rv.repeat.set(Math.max(1, repeat[0] / 12), Math.max(1, repeat[1] / 12));
  rv.needsUpdate = true;
  m.roughnessMap = rv;
  return m;
}
