import { apply, invert, squareToQuad, type Quad } from './homography';
import type { Pixels } from './detect';

/*
 * What the photo looks like under a zone, used to blend the design into it:
 * the darkest colour (what a "black" screen really shows, so only light above
 * it counts as reflection), the unshaded level of the surface (darker areas
 * count as shadow), and the photo's ambient tint.
 */

export interface ZoneStats {
  /** Linear RGB, ~5th percentile per channel. */
  low: [number, number, number];
  /** Linear luminance, ~60th percentile: the surface's unshaded level (printed marks above it never count). */
  high: number;
  /** Linear RGB, median: what the surface itself looks like (foreground detection). */
  mid: [number, number, number];
  /** Linear RGB tint of the surroundings, normalised to luminance 1. */
  tint: [number, number, number];
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const LUT = Float32Array.from({ length: 256 }, (_, i) => lin(i));

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** Samples the photo inside the quad (normalised corners) and in a ring around it. */
export function zoneStats(px: Pixels, quad: Quad): ZoneStats {
  const { data, width: w, height: h } = px;
  const q = quad.map(([x, y]) => [x * w, y * h]) as Quad;
  const H = squareToQuad(q);
  const Hi = invert(H);
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  const lum: number[] = [];
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let an = 0;
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  const pad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.25;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...ys) + pad));
  const step = Math.max(1, Math.round(Math.sqrt(((x1 - x0) * (y1 - y0)) / 20000)));
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
        lum.push(0.2126 * R + 0.7152 * G + 0.0722 * B);
      } else if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) {
        ar += R;
        ag += G;
        ab += B;
        an++;
      }
    }
  const low: [number, number, number] = [pct(r, 0.05), pct(g, 0.05), pct(b, 0.05)];
  const high = Math.max(0.02, pct(lum, 0.6));
  const mid: [number, number, number] = [pct(r, 0.5), pct(g, 0.5), pct(b, 0.5)];
  let tint: [number, number, number] = [1, 1, 1];
  if (an) {
    const m = [ar / an, ag / an, ab / an];
    const l = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    if (l > 1e-3) tint = [m[0] / l, m[1] / l, m[2] / l].map((c) => Math.min(1.6, Math.max(0.5, c))) as [number, number, number];
  }
  return { low, high, mid, tint };
}
