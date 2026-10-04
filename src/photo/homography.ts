/*
 * Projective geometry for the photo mode: the homography taking the unit
 * square onto a quadrilateral of the photo (and back), corner ordering and
 * the physical aspect ratio of a rectangle seen in perspective.
 */

export type Vec2 = [number, number];
/** Corners in reading order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Vec2, Vec2, Vec2, Vec2];
/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Homography mapping (u, v) in the unit square to the quad (Heckbert's closed form). */
export function squareToQuad(q: Quad): Mat3 {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  // (u, v) = (0,0) → TL, (1,0) → TR, (1,1) → BR, (0,1) → BL
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

export function invert(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}

export function apply(m: Mat3, x: number, y: number): Vec2 {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

const cross = (a: Vec2, b: Vec2, o: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** True when the quad is convex and non-degenerate (a homography exists). */
export function isConvex(q: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(q[(i + 1) % 4], q[(i + 2) % 4], q[i]);
    if (Math.abs(c) < 1e-9) return false;
    const s = Math.sign(c);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Puts four points in TL, TR, BR, BL order (clockwise on screen, starting top-left). */
export function orderCorners(points: Vec2[]): Quad {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const sorted = [...points].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  let first = 0;
  sorted.forEach((p, i) => {
    if (p[0] + p[1] < sorted[first][0] + sorted[first][1]) first = i;
  });
  return [0, 1, 2, 3].map((i) => sorted[(first + i) % 4]) as Quad;
}

/**
 * Width / height of the real rectangle behind a perspective quad, assuming a
 * pinhole camera centred on the photo with square pixels (Zhang & He,
 * "Whiteboard scanning and image enhancement", 2007). Falls back to the
 * mean edge lengths when the view is too frontal to recover the focal length.
 */
export function estimateAspect(q: Quad, width: number, height: number): number {
  const c: Vec2 = [width / 2, height / 2];
  // m1 TL, m2 TR, m3 BL, m4 BR, relative to the principal point
  const P = (p: Vec2): [number, number, number] => [p[0] - c[0], p[1] - c[1], 1];
  const m1 = P(q[0]);
  const m2 = P(q[1]);
  const m3 = P(q[3]);
  const m4 = P(q[2]);
  const X = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const D = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const k2 = D(X(m1, m4), m3) / D(X(m2, m4), m3);
  const k3 = D(X(m1, m4), m2) / D(X(m3, m4), m2);
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
  const len = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const fallback = (len(q[0], q[1]) + len(q[3], q[2])) / (len(q[0], q[3]) + len(q[1], q[2]));
  const f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2]);
  const diag = Math.hypot(width, height);
  // a plausible focal length: between an ultra-wide and a long telephoto
  if (!Number.isFinite(f2) || f2 <= 0 || Math.sqrt(f2) < diag * 0.3 || Math.sqrt(f2) > diag * 12) {
    if (Math.abs(n2[2]) < 1e-6 && Math.abs(n3[2]) < 1e-6) return Math.sqrt((n2[0] ** 2 + n2[1] ** 2) / (n3[0] ** 2 + n3[1] ** 2)) || fallback;
    return fallback;
  }
  const r = Math.sqrt((n2[0] ** 2 / f2 + n2[1] ** 2 / f2 + n2[2] ** 2) / (n3[0] ** 2 / f2 + n3[1] ** 2 / f2 + n3[2] ** 2));
  return Number.isFinite(r) && r > 0.05 && r < 20 ? r : fallback;
}
