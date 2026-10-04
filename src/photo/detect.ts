import { orderCorners, type Quad, type Vec2 } from './homography';

/*
 * "Magic wand" for the photo mode: from a point inside a screen, a sheet of
 * paper or a frame, grows the region of similar colour (edge-aware, so soft
 * reflections and gradients stay inside), then fits a quadrilateral to it:
 * convex hull → four corners by least area loss → each side refined with a
 * line fitted to the straight part of the boundary (rounded screen corners
 * are ignored, so the corners land where the straight edges meet).
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** 3×3 box blur: sensor noise in dark screens must not stop the fill. */
function blur(px: Pixels): Pixels {
  const { data, width: w, height: h } = px;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            s += data[(yy * w + xx) * 4 + c];
            n++;
          }
        }
        out[(y * w + x) * 4 + c] = s / n;
      }
  return { data: out, width: w, height: h };
}

/** Flood fill from (sx, sy); returns the region mask or null when it leaks over most of the image. */
function grow(px: Pixels, sx: number, sy: number, local: number, global: number) {
  const { data, width: w, height: h } = px;
  const mask = new Uint8Array(w * h);
  const s = (sy * w + sx) * 4;
  const seed = [data[s], data[s + 1], data[s + 2]];
  const stack = new Int32Array(w * h);
  let top = 0;
  stack[top++] = sy * w + sx;
  mask[sy * w + sx] = 1;
  let count = 1;
  const near = (a: number, b: number) =>
    Math.max(Math.abs(data[a] - data[b]), Math.abs(data[a + 1] - data[b + 1]), Math.abs(data[a + 2] - data[b + 2])) <= local;
  const close = (a: number) =>
    Math.max(Math.abs(data[a] - seed[0]), Math.abs(data[a + 1] - seed[1]), Math.abs(data[a + 2] - seed[2])) <= global;
  while (top) {
    const i = stack[--top];
    const x = i % w;
    const y = (i - x) / w;
    const neighbours = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const n of neighbours) {
      if (n < 0 || mask[n]) continue;
      if (!near(i * 4, n * 4) || !close(n * 4)) continue;
      mask[n] = 1;
      stack[top++] = n;
      count++;
    }
  }
  return { mask, count };
}

function hull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Drops hull vertices one by one, always the one whose removal loses the least area, until four remain. */
function reduceToQuad(poly: Vec2[]): Vec2[] {
  const p = [...poly];
  const tri = (a: Vec2, b: Vec2, c: Vec2) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  while (p.length > 4) {
    let best = 0;
    let loss = Infinity;
    for (let i = 0; i < p.length; i++) {
      const l = tri(p[(i - 1 + p.length) % p.length], p[i], p[(i + 1) % p.length]);
      if (l < loss) {
        loss = l;
        best = i;
      }
    }
    p.splice(best, 1);
  }
  return p;
}

type Line = { p: Vec2; d: Vec2 };

/** Total least squares line through points. */
function fitLine(points: Vec2[]): Line | null {
  if (points.length < 8) return null;
  let mx = 0;
  let my = 0;
  for (const [x, y] of points) {
    mx += x;
    my += y;
  }
  mx /= points.length;
  my /= points.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: [mx, my], d: [Math.cos(angle), Math.sin(angle)] };
}

function intersect(a: Line, b: Line): Vec2 | null {
  const den = a.d[0] * b.d[1] - a.d[1] * b.d[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den;
  return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t];
}

/**
 * Finds the quadrilateral around (x, y) — normalised coordinates in, normalised
 * corners out (TL, TR, BR, BL) — or null when nothing clean is found.
 */
export function detectQuad(px: Pixels, x: number, y: number): Quad | null {
  const { width: w, height: h } = px;
  const sx = Math.min(w - 1, Math.max(0, Math.round(x * w)));
  const sy = Math.min(h - 1, Math.max(0, Math.round(y * h)));
  // Growing tolerance: keep the largest region before it suddenly leaks into the surroundings.
  const smooth = blur(px);
  let region: ReturnType<typeof grow> | null = null;
  for (const [local, global] of [
    [3, 24],
    [5, 36],
    [8, 52],
    [12, 72],
    [18, 96],
  ]) {
    const r = grow(smooth, sx, sy, local, global);
    if (r.count > w * h * 0.85) break;
    if (region && region.count > w * h * 0.004 && r.count > region.count * 1.6) break;
    region = r;
  }
  if (!region || region.count < w * h * 0.002) return null;
  const { mask } = region;

  // Boundary pixels (region pixels touching the outside), at pixel centres pushed half a pixel out.
  const boundary: Vec2[] = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (!mask[k]) continue;
      if (i === 0 || j === 0 || i === w - 1 || j === h - 1 || !mask[k - 1] || !mask[k + 1] || !mask[k - w] || !mask[k + w]) boundary.push([i + 0.5, j + 0.5]);
    }
  const corners = reduceToQuad(hull(boundary));
  if (corners.length < 4) return null;
  let quad = orderCorners(corners);

  // Refine each side with the boundary points along its straight middle part.
  const lines: (Line | null)[] = [0, 1, 2, 3].map((i) => {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const n: Vec2 = [-d[1], d[0]];
    const tol = Math.max(2, len * 0.02);
    const pts = boundary.filter((p) => {
      const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / len;
      const dist = Math.abs((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]);
      return t > 0.15 && t < 0.85 && dist < tol;
    });
    const line = fitLine(pts);
    if (!line) return null;
    // Move the line half a pixel outwards: boundary pixels lie inside the edge.
    const c: Vec2 = [(quad[0][0] + quad[2][0]) / 2, (quad[0][1] + quad[2][1]) / 2];
    const ln: Vec2 = [-line.d[1], line.d[0]];
    const side = Math.sign((line.p[0] - c[0]) * ln[0] + (line.p[1] - c[1]) * ln[1]) || 1;
    line.p = [line.p[0] + ln[0] * 0.5 * side, line.p[1] + ln[1] * 0.5 * side];
    return line;
  });
  if (lines.every(Boolean)) {
    const refined = [0, 1, 2, 3].map((i) => intersect(lines[(i + 3) % 4]!, lines[i]!));
    // keep the refinement only if it stays close to the hull corners
    const ok = refined.every((p, i) => p && Math.hypot(p[0] - quad[i][0], p[1] - quad[i][1]) < Math.max(w, h) * 0.05);
    if (ok) quad = refined as Quad;
  }
  return quad.map(([qx, qy]) => [qx / w, qy / h]) as Quad;
}
