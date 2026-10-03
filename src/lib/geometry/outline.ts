/**
 * 2D outlines for procedural devices.
 *
 * Corners are superellipse quadrants ("continuous" corners): with an exponent
 * above 2 the curvature falls to zero where the corner meets the straight edge,
 * which is what makes industrial-design corners read as soft instead of
 * "rounded-rect". Points are resampled by arc length so highlights sweep
 * evenly across the corner.
 */

export interface OutlinePoint {
  x: number;
  y: number;
  /** Outward unit normal. */
  nx: number;
  ny: number;
  /** Normalised arc length, 0..1 (closing point excluded). */
  u: number;
}

export interface RoundedRectOptions {
  /** 0 = circular arcs, 1 = very soft continuous corner. */
  smooth?: number;
  /** Points per corner after resampling. */
  segments?: number;
}

const EPS = 1e-6;

function superellipseCorner(
  cx: number,
  cy: number,
  r: number,
  start: number,
  n: number,
  dense: number,
): [number, number][] {
  const pts: [number, number][] = [];
  const e = 2 / n;
  for (let i = 0; i <= dense; i++) {
    const t = start + (i / dense) * (Math.PI / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([cx + r * Math.sign(c) * Math.abs(c) ** e, cy + r * Math.sign(s) * Math.abs(s) ** e]);
  }
  return pts;
}

function resample(pts: [number, number][], count: number): [number, number][] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = acc[acc.length - 1];
  if (total < EPS) return [pts[0]];
  const out: [number, number][] = [];
  let j = 1;
  for (let i = 0; i <= count; i++) {
    const target = (i / count) * total;
    while (j < acc.length - 1 && acc[j] < target) j++;
    const span = acc[j] - acc[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - acc[j - 1]) / span));
    out.push([
      pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f,
      pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f,
    ]);
  }
  return out;
}

/** Closed CCW outline of a rectangle with continuous corners, centred on the origin. */
export function roundedRectOutline(
  width: number,
  height: number,
  radius: number,
  { smooth = 0.6, segments = 28 }: RoundedRectOptions = {},
): OutlinePoint[] {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const n = 2 + 2.4 * smooth;
  const hx = width / 2 - r;
  const hy = height / 2 - r;
  const corners: [number, number, number][] = [
    [hx, hy, 0],
    [-hx, hy, Math.PI / 2],
    [-hx, -hy, Math.PI],
    [hx, -hy, (3 * Math.PI) / 2],
  ];

  const raw: [number, number][] = [];
  for (const [cx, cy, start] of corners) {
    const corner = r > EPS ? resample(superellipseCorner(cx, cy, r, start, n, 256), segments) : [[cx, cy] as [number, number]];
    for (const p of corner) {
      const last = raw[raw.length - 1];
      if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > EPS) raw.push(p);
    }
  }
  const first = raw[0];
  const last = raw[raw.length - 1];
  if (raw.length > 1 && Math.hypot(first[0] - last[0], first[1] - last[1]) < EPS) raw.pop();

  return withNormals(raw);
}

/** Circle outline (CCW). */
export function circleOutline(radius: number, segments = 64): OutlinePoint[] {
  const raw: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    raw.push([Math.cos(t) * radius, Math.sin(t) * radius]);
  }
  return withNormals(raw);
}

/** Computes outward normals (average of adjacent edge directions) and arc length. */
export function withNormals(raw: [number, number][]): OutlinePoint[] {
  const count = raw.length;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const a = raw[i];
    const b = raw[(i + 1) % count];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(l);
    total += l;
  }
  let s = 0;
  return raw.map((p, i) => {
    const prev = raw[(i - 1 + count) % count];
    const next = raw[(i + 1) % count];
    const l0 = lengths[(i - 1 + count) % count] || 1;
    const l1 = lengths[i] || 1;
    const tx = (p[0] - prev[0]) / l0 + (next[0] - p[0]) / l1;
    const ty = (p[1] - prev[1]) / l0 + (next[1] - p[1]) / l1;
    const tl = Math.hypot(tx, ty) || 1;
    const point = { x: p[0], y: p[1], nx: ty / tl, ny: -tx / tl, u: s / total };
    s += lengths[i];
    return point;
  });
}

/** Moves every point inward along its normal. Valid while `d` stays below the smallest corner radius. */
export function insetOutline(outline: OutlinePoint[], d: number): OutlinePoint[] {
  return outline.map((p) => ({ ...p, x: p.x - p.nx * d, y: p.y - p.ny * d }));
}
