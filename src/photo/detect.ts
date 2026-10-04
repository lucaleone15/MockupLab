import { isConvex, orderCorners, type Quad, type Vec2 } from './homography';

/*
 * Automatic zone detection from a double-click: finds the screens, sheets,
 * frames or cards around a point. Two sources of candidates:
 *
 * - region growing: the area of similar colour around the point (edge-aware,
 *   with a growing tolerance), outlined by its convex hull reduced to four
 *   corners — good for blank surfaces (a screen that is off, white paper);
 * - straight lines: a Hough transform of the image gradients gives the long
 *   edges; every set of four lines that encloses the point is a candidate —
 *   this also works when the surface shows content (a lit screen, a print).
 *
 * Each candidate is scored by how much of its four sides actually lie on an
 * edge of the photo (an edge with the right orientation, along most of the
 * side, so a hand covering a corner does not disqualify it). The sides of the
 * best ones are then refined to sub-pixel precision. Candidates are returned
 * ranked: double-clicking the same zone again cycles through them (inner
 * display or whole glass, artwork or mat…).
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface Field {
  w: number;
  h: number;
  /** Blurred grey levels (0..255). */
  g: Float32Array;
  gx: Float32Array;
  gy: Float32Array;
  mag: Float32Array;
  /** Edge threshold on the gradient magnitude. */
  T: number;
  /** Colour copy at the same size, for region growing. */
  rgb: Pixels;
}

const ANALYSIS = 1000;

/** Area-average downscale to at most `maxSide` pixels (colour), plus blurred grey levels and Sobel gradients. */
function field(px: Pixels, maxSide: number): Field {
  const f = Math.min(1, maxSide / Math.max(px.width, px.height));
  const w = Math.max(8, Math.round(px.width * f));
  const h = Math.max(8, Math.round(px.height * f));
  const data = new Uint8ClampedArray(w * h * 4);
  const sx = px.width / w;
  const sy = px.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < px.height; yy++)
        for (let xx = x0; xx < x1 && xx < px.width; xx++) {
          const k = (yy * px.width + xx) * 4;
          r += px.data[k];
          g += px.data[k + 1];
          b += px.data[k + 2];
          n++;
        }
      const o = (y * w + x) * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
      data[o + 3] = 255;
    }
  }
  let grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  // [1 2 1] blur, twice: texture and sensor noise stop reading as edges
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const l = grey[y * w + Math.max(0, x - 1)];
        const r = grey[y * w + Math.min(w - 1, x + 1)];
        t[y * w + x] = (l + 2 * grey[y * w + x] + r) / 4;
      }
    const u = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const a = t[Math.max(0, y - 1) * w + x];
        const b = t[Math.min(h - 1, y + 1) * w + x];
        u[y * w + x] = (a + 2 * t[y * w + x] + b) / 4;
      }
    grey = u;
  }
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = grey[i - w - 1];
      const b = grey[i - w];
      const c = grey[i - w + 1];
      const d = grey[i - 1];
      const e = grey[i + 1];
      const f2 = grey[i + w - 1];
      const g2 = grey[i + w];
      const h2 = grey[i + w + 1];
      const X = c + 2 * e + h2 - (a + 2 * d + f2);
      const Y = f2 + 2 * g2 + h2 - (a + 2 * b + c);
      gx[i] = X;
      gy[i] = Y;
      mag[i] = Math.hypot(X, Y);
    }
  // adaptive threshold: subtle edges (a black display in a black bezel) still count
  const sample: number[] = [];
  for (let i = 0; i < mag.length; i += 7) sample.push(mag[i]);
  sample.sort((p, q) => p - q);
  const T = Math.min(48, Math.max(10, sample[Math.floor(sample.length * 0.9)] * 0.3));
  return { w, h, g: grey, gx, gy, mag, T, rgb: { data, width: w, height: h } };
}

/** Is there an edge across the direction `n` at (x, y)? (within a pixel, gradient aligned with n) */
function hit(F: Field, x: number, y: number, nx: number, ny: number) {
  for (let o = -1; o <= 1; o++) {
    const X = Math.round(x + nx * o);
    const Y = Math.round(y + ny * o);
    if (X < 1 || Y < 1 || X >= F.w - 1 || Y >= F.h - 1) continue;
    const i = Y * F.w + X;
    const m = F.mag[i];
    if (m > F.T && Math.abs(F.gx[i] * nx + F.gy[i] * ny) > 0.85 * m) return true;
  }
  return false;
}

const inImage = (F: Field, x: number, y: number) => x >= 1 && y >= 1 && x < F.w - 1 && y < F.h - 1;

/**
 * How well the (trimmed) segment AB outlines a surface: the fraction of it that
 * lies on an aligned edge, weighted by how even the band just outside it is
 * (a bezel, a frame, a wall — whereas an edge inside a screen's content has
 * more content beyond it). `out` is the outward normal. -1 when the segment is
 * mostly outside the image.
 */
function segmentScore(F: Field, A: Vec2, B: Vec2, out: Vec2): { score: number; inner: number; outer: number } {
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const none = { score: -1, inner: 0, outer: 0 };
  if (len < 6) return none;
  const dx = (B[0] - A[0]) / len;
  const dy = (B[1] - A[1]) / len;
  const nx = -dy;
  const ny = dx;
  let inside = 0;
  let hits = 0;
  const band: number[] = [];
  const inBand: number[] = [];
  for (let t = len * 0.08; t <= len * 0.92; t += 1) {
    const x = A[0] + dx * t;
    const y = A[1] + dy * t;
    if (!inImage(F, x, y)) continue;
    inside++;
    if (hit(F, x, y, nx, ny)) hits++;
    for (const o of [3, 6]) {
      const X = Math.round(x + out[0] * o);
      const Y = Math.round(y + out[1] * o);
      if (inImage(F, X, Y)) band.push(F.g[Y * F.w + X]);
      const Xi = Math.round(x - out[0] * o);
      const Yi = Math.round(y - out[1] * o);
      if (inImage(F, Xi, Yi)) inBand.push(F.g[Yi * F.w + Xi]);
    }
  }
  if (inside < Math.max(10, len * 0.3)) return none;
  const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
  let even = 0.5;
  if (band.length > 8) {
    const m = band.reduce((a, b) => a + b, 0) / band.length;
    const sd = Math.sqrt(band.reduce((a, b) => a + (b - m) ** 2, 0) / band.length);
    even = Math.exp(-sd / 16);
  }
  return { score: (hits / inside) * (0.35 + 0.65 * even), inner: median(inBand), outer: median(band) };
}

function quadScore(F: Field, q: Vec2[]) {
  const cx = q.reduce((a, p) => a + p[0], 0) / 4;
  const cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const s = [0, 1, 2, 3].map((i) => {
    const A = q[i];
    const B = q[(i + 1) % 4];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    let out: Vec2 = [(B[1] - A[1]) / len, -(B[0] - A[0]) / len];
    const mx = (A[0] + B[0]) / 2;
    const my = (A[1] + B[1]) / 2;
    if ((mx - cx) * out[0] + (my - cy) * out[1] < 0) out = [-out[0], -out[1]];
    return segmentScore(F, A, B, out);
  });
  const sides = s.filter((v) => v.score >= 0);
  if (sides.length < 3) return 0;
  const valid = sides.map((v) => v.score);
  // a side lost outside the image is allowed (a cropped screen), at a cost
  const missing = valid.length === 3 ? 0.8 : 1;
  // one surface: the bands just inside look alike on every side, and so do the bands
  // just outside (a mix of the display's edges and the body's edges does not)
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
  const coherent = Math.exp(-spread(sides.map((v) => v.inner)) / 70) * Math.exp(-spread(sides.map((v) => v.outer)) / 70);
  return missing * (0.75 + 0.25 * coherent) * (0.55 * Math.min(...valid) + 0.45 * (valid.reduce((a, b) => a + b, 0) / valid.length));
}

/** A rectangle seen in perspective: opposite sides close to parallel, no extreme corner angles. */
function plausible(q: Vec2[]) {
  const dir = (i: number) => Math.atan2(q[(i + 1) % 4][1] - q[i][1], q[(i + 1) % 4][0] - q[i][0]);
  const diff = (a: number, b: number) => {
    let d = Math.abs(a - b) % Math.PI;
    if (d > Math.PI / 2) d = Math.PI - d;
    return d;
  };
  const deg = Math.PI / 180;
  const len = q.map((p, i) => Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]));
  if (Math.min(...len) < Math.max(...len) * 0.12) return false;
  if (diff(dir(0), dir(2)) > 14 * deg || diff(dir(1), dir(3)) > 14 * deg) return false;
  for (let i = 0; i < 4; i++) {
    const a = diff(dir(i), dir((i + 1) % 4));
    if (a < 35 * deg) return false;
  }
  return true;
}

/** Final ranking: edge score, then mild preferences for larger zones centred on the click. */
function rank(F: Field, q: Vec2[], seed: Vec2, score: number) {
  if (!plausible(q)) return 0;
  const area = Math.abs(q.reduce((s, p, i) => s + p[0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * p[1], 0)) / 2;
  const size = Math.sqrt(Math.min(1, area / (0.25 * F.w * F.h)));
  const cx = q.reduce((a, p) => a + p[0], 0) / 4;
  const cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const centred = Math.max(0, 1 - Math.hypot(seed[0] - cx, seed[1] - cy) / Math.sqrt(area));
  return score * (0.93 + 0.07 * size) * (0.85 + 0.15 * centred);
}

/* ------------------------------------------------------------ lines */

interface Line {
  nx: number;
  ny: number;
  rho: number;
}

function intersect(a: Line, b: Line): Vec2 | null {
  const det = a.nx * b.ny - a.ny * b.nx;
  if (Math.abs(det) < 1e-6) return null;
  return [(a.rho * b.ny - a.ny * b.rho) / det, (a.nx * b.rho - a.rho * b.nx) / det];
}

/** Long straight edges of the image (Hough transform voted by gradient direction). */
function houghLines(F: Field, max: number, seed: Vec2, window = 0): Line[] {
  const { w, h } = F;
  // window > 0: only edges within that radius of the seed (small objects among long lines)
  const win2 = window * window;
  const NT = 180;
  const D = Math.ceil(Math.hypot(w, h));
  const NR = 2 * D + 1;
  const acc = new Float32Array(NT * NR);
  const cs = Float64Array.from({ length: NT }, (_, t) => Math.cos((t * Math.PI) / NT));
  const sn = Float64Array.from({ length: NT }, (_, t) => Math.sin((t * Math.PI) / NT));
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const m = F.mag[i];
      if (m <= F.T) continue;
      if (win2 && (x - seed[0]) ** 2 + (y - seed[1]) ** 2 > win2) continue;
      let th = Math.atan2(F.gy[i], F.gx[i]);
      if (th < 0) th += Math.PI;
      const ti = Math.round((th / Math.PI) * NT);
      // edges near the click count more: the zone is around it
      const R = 0.35 * Math.hypot(w, h);
      const d2 = ((x - seed[0]) ** 2 + (y - seed[1]) ** 2) / (R * R);
      const wgt = Math.min(m, 4 * F.T) / F.T / (1 + d2);
      for (let dt = -2; dt <= 2; dt++) {
        const t = (((ti + dt) % NT) + NT) % NT;
        const r = Math.round(x * cs[t] + y * sn[t]) + D;
        acc[t * NR + r] += wgt;
      }
    }
  const minVotes = Math.min(w, h) * (window ? 0.02 : 0.03);
  const peaks: { t: number; r: number; v: number }[] = [];
  for (let t = 0; t < NT; t++)
    for (let r = 1; r < NR - 1; r++) {
      const v = acc[t * NR + r];
      if (v < minVotes) continue;
      let best = true;
      for (let dt = -3; dt <= 3 && best; dt++) {
        const tt = t + dt;
        if (tt < 0 || tt >= NT) continue;
        for (let dr = -4; dr <= 4; dr++) {
          const rr = r + dr;
          if ((dt || dr) && rr >= 0 && rr < NR && acc[tt * NR + rr] > v) {
            best = false;
            break;
          }
        }
      }
      if (best) peaks.push({ t, r, v });
    }
  peaks.sort((a, b) => b.v - a.v);
  return peaks.slice(0, max).map((p) => ({ nx: cs[p.t], ny: sn[p.t], rho: p.r - D }));
}

/** Edge hits along a line, as prefix sums: the edge fraction of any segment in O(1). */
interface Profile {
  p0: Vec2;
  d: Vec2;
  D: number;
  hits: Int32Array;
  inside: Int32Array;
}

function profile(F: Field, l: Line): Profile {
  const D = Math.ceil(Math.hypot(F.w, F.h));
  const p0: Vec2 = [l.nx * l.rho, l.ny * l.rho];
  const d: Vec2 = [-l.ny, l.nx];
  const hits = new Int32Array(2 * D + 2);
  const inside = new Int32Array(2 * D + 2);
  for (let t = -D; t <= D; t++) {
    const x = p0[0] + d[0] * t;
    const y = p0[1] + d[1] * t;
    const k = t + D;
    const isIn = inImage(F, x, y);
    inside[k + 1] = inside[k] + (isIn ? 1 : 0);
    hits[k + 1] = hits[k] + (isIn && hit(F, x, y, l.nx, l.ny) ? 1 : 0);
  }
  return { p0, d, D, hits, inside };
}

function profileScore(P: Profile, A: Vec2, B: Vec2) {
  let ta = (A[0] - P.p0[0]) * P.d[0] + (A[1] - P.p0[1]) * P.d[1];
  let tb = (B[0] - P.p0[0]) * P.d[0] + (B[1] - P.p0[1]) * P.d[1];
  if (ta > tb) [ta, tb] = [tb, ta];
  const len = tb - ta;
  const i0 = Math.max(0, Math.min(2 * P.D + 1, Math.round(ta + len * 0.08) + P.D));
  const i1 = Math.max(0, Math.min(2 * P.D + 1, Math.round(tb - len * 0.08) + P.D));
  const inside = P.inside[i1] - P.inside[i0];
  if (inside < Math.max(10, len * 0.3)) return -1;
  return (P.hits[i1] - P.hits[i0]) / inside;
}

/** Every set of four lines that encloses the seed: a quick edge score for all, the full score for the best. */
function lineCandidates(F: Field, seed: Vec2): { quad: Vec2[]; score: number }[] {
  // long lines of the whole image, plus the lines close to the click
  const global = houghLines(F, 52, seed);
  const local = houghLines(F, 24, seed, 0.22 * Math.hypot(F.w, F.h)).filter(
    (l) => !global.some((g) => Math.abs(g.nx * l.nx + g.ny * l.ny) > 0.9995 && Math.abs(g.rho - l.rho * Math.sign(g.nx * l.nx + g.ny * l.ny)) < 3),
  );
  const lines = [...global, ...local]
    .map((l) => {
      const sd = seed[0] * l.nx + seed[1] * l.ny - l.rho;
      const s = Math.sign(sd);
      // angle of the outward normal (from the seed towards the line)
      return { ...l, sd, phi: Math.atan2(-l.ny * s, -l.nx * s) };
    })
    .filter((l) => Math.abs(l.sd) > 4)
    .sort((a, b) => a.phi - b.phi);
  const profiles = lines.map((l) => profile(F, l));
  const n = lines.length;
  const lo = (35 * Math.PI) / 180;
  const hi = (150 * Math.PI) / 180;
  const inner = (l: (typeof lines)[number], p: Vec2) => Math.sign(l.sd) * (p[0] * l.nx + p[1] * l.ny - l.rho) >= -1.5;
  const area = (q: Vec2[]) => Math.abs(q.reduce((s, p, i) => s + p[0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * p[1], 0)) / 2;
  const quick: { quad: Vec2[]; pre: number }[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const g1 = lines[b].phi - lines[a].phi;
      if (g1 < lo || g1 > hi) continue;
      for (let c = b + 1; c < n; c++) {
        const g2 = lines[c].phi - lines[b].phi;
        if (g2 < lo || g2 > hi) continue;
        for (let d = c + 1; d < n; d++) {
          const g3 = lines[d].phi - lines[c].phi;
          const g4 = lines[a].phi + 2 * Math.PI - lines[d].phi;
          if (g3 < lo || g3 > hi || g4 < lo || g4 > hi) continue;
          const idx = [a, b, c, d];
          const L = idx.map((i) => lines[i]);
          const q: Vec2[] = [];
          let ok = true;
          for (let i = 0; i < 4 && ok; i++) {
            const p = intersect(L[i], L[(i + 1) % 4]);
            if (!p || p[0] < -0.75 * F.w || p[0] > 1.75 * F.w || p[1] < -0.75 * F.h || p[1] > 1.75 * F.h) ok = false;
            else q.push(p);
          }
          if (!ok) continue;
          // each corner must respect the two other lines: the quad is the region the lines enclose
          for (let i = 0; i < 4 && ok; i++) for (let j = 0; j < 4 && ok; j++) if (j !== i && j !== (i + 1) % 4 && !inner(L[j], q[i])) ok = false;
          if (!ok || area(q) < F.w * F.h * 0.004 || !plausible(q)) continue;
          // side i of the quad lies on line i, between corners i-1 and i
          const f: number[] = [];
          for (let i = 0; i < 4; i++) {
            const v = profileScore(profiles[idx[i]], q[(i + 3) % 4], q[i]);
            if (v >= 0) f.push(v);
          }
          if (f.length < 3) continue;
          const pre = (f.length === 3 ? 0.8 : 1) * (0.55 * Math.min(...f) + 0.45 * (f.reduce((x, y) => x + y, 0) / f.length));
          if (pre > 0.3) quick.push({ quad: q, pre });
        }
      }
    }
  quick.sort((x, y) => y.pre - x.pre);
  return quick.slice(0, 150).map((c) => ({ quad: c.quad, score: rank(F, c.quad, seed, quadScore(F, c.quad)) }));
}

/* ------------------------------------------------------------ regions */

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
    for (const nb of neighbours) {
      if (nb < 0 || mask[nb]) continue;
      if (!near(i * 4, nb * 4) || !close(nb * 4)) continue;
      mask[nb] = 1;
      stack[top++] = nb;
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

/** Quads around the regions of similar colour that contain the seed, at several tolerances. */
function regionCandidates(F: Field, seed: Vec2): { quad: Vec2[]; score: number }[] {
  const px = F.rgb;
  const { width: w, height: h } = px;
  const sx = Math.min(w - 1, Math.max(0, Math.round(seed[0])));
  const sy = Math.min(h - 1, Math.max(0, Math.round(seed[1])));
  const out: { quad: Vec2[]; score: number }[] = [];
  let last = 0;
  for (const [local, global] of [
    [3, 24],
    [5, 36],
    [8, 52],
    [12, 72],
    [18, 96],
  ]) {
    const r = grow(px, sx, sy, local, global);
    if (r.count > w * h * 0.85) break;
    if (r.count < w * h * 0.002 || r.count === last) continue;
    last = r.count;
    const boundary: Vec2[] = [];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!r.mask[k]) continue;
        if (i === 0 || j === 0 || i === w - 1 || j === h - 1 || !r.mask[k - 1] || !r.mask[k + 1] || !r.mask[k - w] || !r.mask[k + w]) boundary.push([i, j]);
      }
    const corners = reduceToQuad(hull(boundary));
    if (corners.length < 4) continue;
    const quad = orderCorners(corners);
    // how much of the quad the region fills: a ragged region is a poor outline
    const area = Math.abs(quad.reduce((s, p, i) => s + p[0] * quad[(i + 1) % 4][1] - quad[(i + 1) % 4][0] * p[1], 0)) / 2;
    const fill = Math.min(1, r.count / Math.max(1, area));
    out.push({ quad, score: rank(F, quad, seed, quadScore(F, quad)) * (0.6 + 0.4 * fill) });
  }
  return out;
}

/* ------------------------------------------------------------ refinement */

function fitLine(points: Vec2[]): Line | null {
  if (points.length < 6) return null;
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
  // normal = eigenvector of the smallest eigenvalue
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy) + Math.PI / 2;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  return { nx, ny, rho: mx * nx + my * ny };
}

/** Bilinear sample of the directional gradient |∇g · n|. */
function dgrad(F: Field, x: number, y: number, nx: number, ny: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 1 || y0 < 1 || x0 >= F.w - 2 || y0 >= F.h - 2) return 0;
  const fx = x - x0;
  const fy = y - y0;
  const at = (i: number) => Math.abs(F.gx[i] * nx + F.gy[i] * ny);
  const i = y0 * F.w + x0;
  return (at(i) * (1 - fx) + at(i + 1) * fx) * (1 - fy) + (at(i + F.w) * (1 - fx) + at(i + F.w + 1) * fx) * fy;
}

/** Moves each side onto the strongest nearby edge, with sub-pixel precision. */
function refine(F: Field, q: Vec2[]): Vec2[] {
  const lines: (Line | null)[] = [0, 1, 2, 3].map((i) => {
    const A = q[i];
    const B = q[(i + 1) % 4];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dx = (B[0] - A[0]) / len;
    const dy = (B[1] - A[1]) / len;
    const nx = -dy;
    const ny = dx;
    const pts: Vec2[] = [];
    for (let t = len * 0.1; t <= len * 0.9; t += 1.5) {
      const x = A[0] + dx * t;
      const y = A[1] + dy * t;
      if (!inImage(F, x, y)) continue;
      let best = -1;
      let bv = F.T;
      const vals: number[] = [];
      for (let o = -3; o <= 3; o++) vals.push(dgrad(F, x + nx * o, y + ny * o, nx, ny));
      vals.forEach((v, k) => {
        if (v > bv) {
          bv = v;
          best = k;
        }
      });
      if (best <= 0 || best >= vals.length - 1) continue;
      // parabolic peak
      const [a, b, c] = [vals[best - 1], vals[best], vals[best + 1]];
      const den = a - 2 * b + c;
      const off = best - 3 + (den !== 0 ? (0.5 * (a - c)) / den : 0);
      pts.push([x + nx * off, y + ny * off]);
    }
    let line = fitLine(pts);
    if (!line) return null;
    // drop outliers (fingers, reflections across the edge) and fit again
    const kept = pts.filter(([x, y]) => Math.abs(x * line!.nx + y * line!.ny - line!.rho) < 1.2);
    if (kept.length >= pts.length * 0.5) line = fitLine(kept) ?? line;
    return line;
  });
  if (!lines.every(Boolean)) return q;
  const r = [0, 1, 2, 3].map((i) => intersect(lines[(i + 3) % 4]!, lines[i]!));
  const diag = Math.hypot(F.w, F.h);
  if (r.some((p, i) => !p || Math.hypot(p[0] - q[i][0], p[1] - q[i][1]) > diag * 0.03)) return q;
  return r as Vec2[];
}

/* ------------------------------------------------------------ nesting */

function insideQuad(q: Vec2[], p: Vec2) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    if (c && sign && c !== sign) return false;
    if (c) sign = c;
  }
  return true;
}

/** Robust spread (MAD) of the grey levels between two nested quads. */
function ringSpread(F: Field, outer: Vec2[], inner: Vec2[]) {
  const xs = outer.map((p) => p[0]);
  const ys = outer.map((p) => p[1]);
  const x0 = Math.max(1, Math.min(...xs));
  const x1 = Math.min(F.w - 2, Math.max(...xs));
  const y0 = Math.max(1, Math.min(...ys));
  const y1 = Math.min(F.h - 2, Math.max(...ys));
  const step = Math.max(1, Math.sqrt(((x1 - x0) * (y1 - y0)) / 1500));
  const ring: number[] = [];
  for (let y = y0; y <= y1; y += step)
    for (let x = x0; x <= x1; x += step) if (insideQuad(outer, [x, y]) && !insideQuad(inner, [x, y])) ring.push(F.g[Math.round(y) * F.w + Math.round(x)]);
  if (ring.length < 20) return null;
  ring.sort((a, b) => a - b);
  const med = ring[ring.length >> 1];
  const dev = ring.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return dev[dev.length >> 1] * 1.4826;
}

/**
 * Nested candidates: a surface inside an even ring (a display in its bezel, a
 * print in its frame) is what one means to replace, so the inner one goes
 * first; but when the ring is busy, the inner one is a block of the content
 * (a card of a web page) and the outer one — the whole screen — goes first.
 */
function preferInner(F: Field, list: { quad: Vec2[]; score: number }[]) {
  for (const outer of list)
    for (const inner of list) {
      if (inner === outer || !inner.quad.every((p) => insideQuad(outer.quad, p))) continue;
      const lo = Math.min(inner.score, outer.score);
      const hi = Math.max(inner.score, outer.score);
      if (lo < hi * 0.6) continue;
      const spread = ringSpread(F, outer.quad, inner.quad);
      if (spread === null) continue;
      if (spread < 10 && inner.score < outer.score) inner.score = outer.score * 1.01;
      else if (spread > 22 && outer.score < inner.score && outer.score >= inner.score * 0.8) outer.score = inner.score * 1.01;
    }
  list.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------ entry */


/**
 * Ranked quadrilaterals around (x, y) — normalised coordinates in, normalised
 * corners out (TL, TR, BR, BL) — best first; empty when nothing clean is found.
 */
export function detectQuads(px: Pixels, x: number, y: number, max = 5): Quad[] {
  const F = field(px, ANALYSIS);
  const seed: Vec2 = [x * F.w - 0.5, y * F.h - 0.5];
  const all = [...regionCandidates(F, seed), ...lineCandidates(F, seed)].sort((a, b) => b.score - a.score);
  if (!all.length || all[0].score < 0.25) return [];
  // distinct candidates (many line sets give nearly the same quad), each snapped
  // to the image edges and scored again, then the nesting preference
  const diag = Math.hypot(F.w, F.h);
  const same = (a: Vec2[], b: Vec2[]) => a.every((pc, i) => Math.hypot(pc[0] - b[i][0], pc[1] - b[i][1]) < diag * 0.008);
  const rough: Vec2[][] = [];
  for (const c of all) {
    const q = orderCorners(c.quad);
    if (rough.some((p) => same(p, q))) continue;
    rough.push(q);
    if (rough.length >= 30) break;
  }
  let distinct: { quad: Vec2[]; score: number }[] = [];
  for (const r of rough) {
    const q = orderCorners(refine(F, r));
    if (!isConvex(q as Quad) || !insideQuad(q, seed) || distinct.some((p) => same(p.quad, q))) continue;
    distinct.push({ quad: q, score: rank(F, q, seed, quadScore(F, q)) });
  }
  distinct.sort((a, b) => b.score - a.score);
  if (!distinct.length || distinct[0].score < 0.25) return [];
  preferInner(F, distinct);
  const best = distinct[0].score;
  distinct = distinct.filter((c) => c.score >= best * 0.6);
  const picked = distinct.slice(0, max);
  return picked
    .map((c) => c.quad)
    .map((q) => q.map(([qx, qy]) => [(qx + 0.5) / F.w, (qy + 0.5) / F.h]) as Quad);
}

/** The best quadrilateral around (x, y), or null. */
export function detectQuad(px: Pixels, x: number, y: number): Quad | null {
  return detectQuads(px, x, y, 1)[0] ?? null;
}
