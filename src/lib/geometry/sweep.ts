import * as THREE from 'three';
import { roundedRectOutline, type OutlinePoint, type RoundedRectOptions } from './outline';

/**
 * A point of an edge profile, read in the plane (inset, z):
 * `d` is how far the surface sits inside the outline, `z` its height.
 * (`nr`, `nz`) is the surface normal in that plane: `nr` > 0 points outward.
 */
export interface ProfilePoint {
  d: number;
  z: number;
  nr: number;
  nz: number;
}

export interface EdgeRadius {
  /** Horizontal (inward) extent of the rounding. */
  d: number;
  /** Vertical extent of the rounding. */
  z: number;
}

const toEdge = (e: number | EdgeRadius): EdgeRadius => (typeof e === 'number' ? { d: e, z: e } : e);

/**
 * Side profile of a slab from z = -t/2 to z = +t/2: flat side wall with
 * elliptical roundings toward the back (bottom) and front (top) faces.
 */
export function slabProfile(
  thickness: number,
  front: number | EdgeRadius,
  back: number | EdgeRadius,
  segments = 10,
): ProfilePoint[] {
  const f = toEdge(front);
  const b = toEdge(back);
  const half = thickness / 2;
  const pts: ProfilePoint[] = [];
  const arc = (r: EdgeRadius, zc: number, a0: number, a1: number) => {
    if (r.d < 1e-6 || r.z < 1e-6) {
      // Sharp edge: duplicate the corner with both normals.
      const z = a0 < Math.PI / 2 ? zc - r.z : zc + r.z;
      pts.push({ d: 0, z, nr: Math.sin(a0), nz: -Math.cos(a0) });
      pts.push({ d: 0, z, nr: Math.sin(a1), nz: -Math.cos(a1) });
      return;
    }
    for (let i = 0; i <= segments; i++) {
      const a = a0 + ((a1 - a0) * i) / segments;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const nr = r.z * s;
      const nz = -r.d * c;
      const nl = Math.hypot(nr, nz) || 1;
      pts.push({ d: r.d - r.d * s, z: zc - r.z * c, nr: nr / nl, nz: nz / nl });
    }
  };
  arc(b, -half + b.z, 0, Math.PI / 2);
  arc(f, half - f.z, Math.PI / 2, Math.PI);
  return pts;
}

export interface SweepOptions {
  capFront?: boolean;
  capBack?: boolean;
}

/**
 * Sweeps an edge profile along a closed convex outline. Normals are analytic
 * (outline normal × profile normal), so curved surfaces shade perfectly smooth.
 * UV: u runs along the outline (useful for brushed anisotropy), v along the profile.
 * Caps are triangle fans; their UVs map the outline bounds to 0..1.
 */
export function sweep(
  outline: OutlinePoint[],
  profile: ProfilePoint[],
  { capFront = true, capBack = true }: SweepOptions = {},
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cols = outline.length + 1; // duplicate seam column for continuous UVs

  let vTotal = 0;
  const vAcc = [0];
  for (let i = 1; i < profile.length; i++) {
    vTotal += Math.hypot(profile[i].d - profile[i - 1].d, profile[i].z - profile[i - 1].z);
    vAcc.push(vTotal);
  }

  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    for (let j = 0; j < cols; j++) {
      const o = outline[j % outline.length];
      positions.push(o.x - o.nx * p.d, o.y - o.ny * p.d, p.z);
      normals.push(o.nx * p.nr, o.ny * p.nr, p.nz);
      uvs.push(j === outline.length ? 1 : o.u, vTotal > 0 ? vAcc[i] / vTotal : 0);
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = b + cols;
      const d = a + cols;
      indices.push(a, b, c, a, c, d);
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const o of outline) {
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x);
    minY = Math.min(minY, o.y);
    maxY = Math.max(maxY, o.y);
  }
  const addCap = (p: ProfilePoint, front: boolean) => {
    const base = positions.length / 3;
    const nz = front ? 1 : -1;
    positions.push((minX + maxX) / 2, (minY + maxY) / 2, p.z);
    normals.push(0, 0, nz);
    uvs.push(0.5, 0.5);
    for (const o of outline) {
      const x = o.x - o.nx * p.d;
      const y = o.y - o.ny * p.d;
      positions.push(x, y, p.z);
      normals.push(0, 0, nz);
      uvs.push((x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
    }
    const n = outline.length;
    for (let j = 0; j < n; j++) {
      const a = base + 1 + j;
      const b = base + 1 + ((j + 1) % n);
      if (front) indices.push(base, a, b);
      else indices.push(base, b, a);
    }
  };
  if (capBack) addCap(profile[0], false);
  if (capFront) addCap(profile[profile.length - 1], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export interface SlabOptions extends RoundedRectOptions {
  width: number;
  height: number;
  radius: number;
  thickness: number;
  front?: number | EdgeRadius;
  back?: number | EdgeRadius;
  edgeSegments?: number;
}

/** Rounded slab centred on the origin, thickness along Z. */
export function roundedSlab({
  width,
  height,
  radius,
  thickness,
  front = 0,
  back = 0,
  edgeSegments = 10,
  ...outline
}: SlabOptions): THREE.BufferGeometry {
  return sweep(
    roundedRectOutline(width, height, radius, outline),
    slabProfile(thickness, front, back, edgeSegments),
  );
}

/** Flat shape in the XY plane facing +Z, with UVs normalised to its bounds (for screens/prints). */
export function flatShape(outline: OutlinePoint[]): THREE.BufferGeometry {
  return sweep(outline, [{ d: 0, z: 0, nr: 0, nz: 1 }], { capBack: false, capFront: true });
}

/** Flat rounded rectangle facing +Z with 0..1 UVs. */
export function roundedPlane(width: number, height: number, radius: number, opts?: RoundedRectOptions) {
  return flatShape(roundedRectOutline(width, height, radius, opts));
}

/**
 * Lathe around the Z axis (instead of three's Y axis) from (radius, z) pairs.
 * Normals are computed per profile segment and averaged, which gives smooth
 * rounded rims for lens rings and buttons.
 */
export function latheZ(points: [number, number][], segments = 64): THREE.BufferGeometry {
  const geo = new THREE.LatheGeometry(
    points.map(([r, z]) => new THREE.Vector2(r, z)),
    segments,
  );
  // Lathe builds around +Y; rotate so its axis becomes +Z.
  geo.rotateX(Math.PI / 2);
  return geo;
}
