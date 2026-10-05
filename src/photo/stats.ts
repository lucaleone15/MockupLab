import { apply, invert, squareToQuad, type Quad } from './homography';
import type { Pixels } from './detect';

/*
 * What the photo looks like under a zone, used to blend the design into it
 * without letting the original surface show through:
 *
 * - the light falling on the surface, as a smooth function over the zone (a
 *   robust quadratic fit of the log-luminance: printed marks, pictures or a
 *   lit screen's content are outliers the fit ignores), so shading can follow
 *   the photo's light gradients and never its content;
 * - whether the surface is blank (an unlit screen, plain paper) or carries
 *   content: only a blank surface lends its fine details and reflections;
 * - the darkest colour (what a "black" screen really shows, so only light
 *   above it counts as reflection), the median colour (foreground detection)
 *   and the ambient tint of the surroundings.
 */

export interface ZoneStats {
  /** Linear RGB, ~5th percentile per channel. */
  low: [number, number, number];
  /** Linear RGB, median: what the surface itself looks like (foreground detection). */
  mid: [number, number, number];
  /** Linear RGB tint of the surroundings, normalised to luminance 1. */
  tint: [number, number, number];
  /** log(luminance + LIGHT_EPS) ≈ c·[1, u, v, u², uv, v²] over the zone's unit square. */
  light: [number, number, number, number, number, number];
  /** Fitted level taken as "unshaded" (85th percentile of the fit over the zone). */
  lightRef: number;
  /** 0 = the surface carries content (print, picture, lit screen), 1 = blank. */
  clean: number;
  /** Linear median luminance of the surface. */
  level: number;
  /** Share of the zone clearly unlike the surface itself (fingers, an object held in front). */
  foreground: number;
}

/**
 * How blank the surface is, for a kind of zone: a screen that is off is also
 * dark — a bright screen is showing something, even blurred by the lens.
 */
export function blankness(s: ZoneStats, kind: 'screen' | 'print') {
  return kind === 'screen' ? s.clean * (1 - smooth(0.06, 0.22, s.level)) : s.clean;
}

export const LIGHT_EPS = 0.02;

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const LUT = Float32Array.from({ length: 256 }, (_, i) => lin(i));

const pct = (arr: ArrayLike<number>, p: number) => {
  if (!arr.length) return 0;
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

const basis = (u: number, v: number) => [1, u, v, u * u, u * v, v * v];

/** Solves the 6×6 system A x = b (Gaussian elimination with partial pivoting). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Robust (Tukey biweight, iteratively reweighted) quadratic fit of y over (u, v). */
function robustFit(u: number[], v: number[], y: number[]) {
  const n = y.length;
  const w = new Float64Array(n).fill(1);
  let c = [pct(y, 0.5), 0, 0, 0, 0, 0];
  const res = new Float64Array(n);
  let scale = 0.1;
  for (let it = 0; it < 6; it++) {
    const A = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const b = new Array(6).fill(0);
    for (let i = 0; i < n; i++) {
      if (!w[i]) continue;
      const f = basis(u[i], v[i]);
      for (let r = 0; r < 6; r++) {
        b[r] += w[i] * f[r] * y[i];
        for (let k = 0; k < 6; k++) A[r][k] += w[i] * f[r] * f[k];
      }
    }
    for (let r = 0; r < 6; r++) A[r][r] += 1e-6;
    const next = solve(A, b);
    if (!next) break;
    c = next;
    for (let i = 0; i < n; i++) {
      const f = basis(u[i], v[i]);
      res[i] = y[i] - f.reduce((s, x, k) => s + x * c[k], 0);
    }
    const abs = Array.from(res, Math.abs);
    scale = Math.max(0.02, 1.4826 * pct(abs, 0.5));
    const k = 4.685 * scale;
    for (let i = 0; i < n; i++) {
      const t = res[i] / k;
      w[i] = Math.abs(t) < 1 ? (1 - t * t) ** 2 : 0;
    }
  }
  return { c, res, scale };
}

/** Samples the photo inside the quad (normalised corners) and in a ring around it. */
export function zoneStats(px: Pixels, quad: Quad): ZoneStats {
  const { data, width: w, height: h } = px;
  const q = quad.map(([x, y]) => [x * w, y * h]) as Quad;
  const Hi = invert(squareToQuad(q));
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const ys: number[] = [];
  const chroma: number[] = [];
  let sharp = 0;
  const grey = (x: number, y: number) => {
    const k = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
    return 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
  };
  const soft = (x: number, y: number) => (grey(x, y) + grey(x + 1, y) + grey(x, y + 1) + grey(x + 1, y + 1)) / 4;
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let an = 0;
  const qx = q.map((p) => p[0]);
  const qy = q.map((p) => p[1]);
  const pad = Math.max(Math.max(...qx) - Math.min(...qx), Math.max(...qy) - Math.min(...qy)) * 0.25;
  const x0 = Math.max(0, Math.floor(Math.min(...qx) - pad));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...qx) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...qy) - pad));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...qy) + pad));
  const step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 12000)));
  for (let y = y0; y <= y1; y += step)
    for (let x = x0; x <= x1; x += step) {
      const [u, v] = apply(Hi, x + 0.5, y + 0.5);
      const k = (y * w + x) * 4;
      const R = LUT[data[k]];
      const G = LUT[data[k + 1]];
      const B = LUT[data[k + 2]];
      // inset a little so the frame / bezel does not count
      if (u > 0.04 && u < 0.96 && v > 0.04 && v < 0.96) {
        r.push(R);
        g.push(G);
        b.push(B);
        const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        us.push(u);
        vs.push(v);
        ys.push(Math.log(L + LIGHT_EPS));
        chroma.push(Math.max(R, G, B) - Math.min(R, G, B));
        // fine detail (text, interface, print) — a blurry reflection has none
        // on 2×2 averages, two pixels apart: sensor grain cancels out, text and UI edges remain
        if (Math.abs(4 * soft(x, y) - soft(x - 2, y) - soft(x + 2, y) - soft(x, y - 2) - soft(x, y + 2)) > 14) sharp++;
      } else if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) {
        ar += R;
        ag += G;
        ab += B;
        an++;
      }
    }
  const low: [number, number, number] = [pct(r, 0.05), pct(g, 0.05), pct(b, 0.05)];
  const mid: [number, number, number] = [pct(r, 0.5), pct(g, 0.5), pct(b, 0.5)];
  let tint: [number, number, number] = [1, 1, 1];
  if (an) {
    const m = [ar / an, ag / an, ab / an];
    const l = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    if (l > 1e-3) tint = [m[0] / l, m[1] / l, m[2] / l].map((c) => Math.min(1.6, Math.max(0.5, c))) as [number, number, number];
  }

  let light: ZoneStats['light'] = [Math.log(0.5 + LIGHT_EPS), 0, 0, 0, 0, 0];
  let lightRef = light[0];
  let clean = 1;
  if (ys.length > 30) {
    const fit = robustFit(us, vs, ys);
    light = fit.c as ZoneStats['light'];
    const fitted = us.map((u, i) => basis(u, vs[i]).reduce((s, x, k) => s + x * fit.c[k], 0));
    lightRef = pct(fitted, 0.85);
    // content = crisp detail over a share of the surface, or colourful variety
    const detail = sharp / ys.length;
    const colour = pct(chroma, 0.9) - pct(chroma, 0.1);
    clean = 1 - Math.max(smooth(0.022, 0.07, detail), smooth(0.12, 0.3, colour));
  }
  const level = 0.2126 * mid[0] + 0.7152 * mid[1] + 0.0722 * mid[2];
  const sm = mid.map(Math.sqrt);
  let fg = 0;
  for (let i = 0; i < r.length; i++) if (Math.hypot(Math.sqrt(r[i]) - sm[0], Math.sqrt(g[i]) - sm[1], Math.sqrt(b[i]) - sm[2]) > 0.45) fg++;
  return { low, mid, tint, light, lightRef, clean, level, foreground: r.length ? fg / r.length : 0 };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
