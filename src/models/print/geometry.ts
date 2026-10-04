import * as THREE from 'three';
import { roundedRectOutline } from '@/lib/geometry/outline';
import { flatShape, sweep } from '@/lib/geometry/sweep';

/*
 * Geometry for paper goods. Everything is built in the XY plane facing +Z
 * (front) — objects lie flat by rotating -90° around X.
 */

export interface CardGeometry {
  edge: THREE.BufferGeometry;
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
}

/** Card stock with real thickness: edge band + front face + back face (back UVs read correctly from behind). */
export function cardGeometry(w: number, h: number, thickness: number, radius: number): CardGeometry {
  const outline = roundedRectOutline(w, h, radius, { smooth: 0.2, segments: radius > 0.01 ? 8 : 1 });
  const edge = sweep(
    outline,
    [
      { d: 0, z: -thickness / 2, nr: 1, nz: 0 },
      { d: 0, z: thickness / 2, nr: 1, nz: 0 },
    ],
    { capBack: false, capFront: false },
  );
  const front = flatShape(outline);
  front.translate(0, 0, thickness / 2);
  const back = flatShape(outline);
  back.rotateY(Math.PI);
  back.translate(0, 0, -thickness / 2);
  return { edge, front, back };
}

/**
 * A thin sheet with a natural, slight lift of one corner (paper never lies
 * perfectly flat). Returns front and back faces 0.15 mm apart.
 */
export function sheetGeometry(w: number, h: number, curl = 0.6, seg = 48) {
  const front = new THREE.PlaneGeometry(w, h, seg, Math.round((seg * h) / w));
  const pos = front.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // smooth lift towards the bottom-right corner (no crease anywhere)
    const u = x / w + 0.5;
    const v = 0.5 - y / h;
    pos.setZ(i, curl * Math.pow(u * v, 3));
  }
  front.computeVertexNormals();
  const back = front.clone();
  // read correctly from behind: mirror U, flip winding
  const uv = back.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const idx = back.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  // the back layer always sits behind the front face (−Z side)
  const bp = back.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) - 0.015);
  back.computeVertexNormals();
  return { front, back };
}

/** Flat ribbon following a curve on (or near) the floor, `width` wide, facing +Y. */
export function ribbonGeometry(points: THREE.Vector3[], width: number, segments = 200) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pts = curve.getSpacedPoints(segments);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = curve.getTangentAt(i / segments);
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(width / 2);
    if (i > 0) len += p.distanceTo(pts[i - 1]);
    pos.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z);
    uv.push(len / width, 0, len / width, 1);
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ribbons lie face up
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) if (n.getY(i) < 0) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/** Canvas texture of stacked paper edges (for stacks of cards and page blocks). */
let edgeTex: THREE.Texture | null = null;
export function pageEdgeTexture() {
  if (edgeTex) return edgeTex;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 512;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 512; y += 2) {
    const v = 236 + Math.round(Math.random() * 14);
    g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    g.fillRect(0, y, 8, 1);
    g.fillStyle = 'rgb(205,202,195)';
    g.fillRect(0, y + 1, 8, 1);
  }
  edgeTex = new THREE.CanvasTexture(c);
  edgeTex.colorSpace = THREE.SRGBColorSpace;
  edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping;
  return edgeTex;
}
