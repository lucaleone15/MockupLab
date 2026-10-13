import { loadImage } from '@/store/assets';
import type { Background } from '@/store/project';

/*
 * Pack colours. Palettes are drawn from the designs themselves: their
 * dominant hues, softened into colours that work behind a mock-up (light
 * tints, deep shades, muted tones), so a whole pack looks like one project.
 */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('');
}

const tone = (c: Hsl, l: number, sMax: number): string => hslToHex({ h: c.h, s: Math.min(c.s, sMax), l });

/** Lighter version of a colour, for the centre of a studio gradient. */
export function lighten(hex: string, amount = 0.1): string {
  const c = hexToHsl(hex);
  return hslToHex({ ...c, l: Math.max(0.03, Math.min(0.97, c.l + amount)) });
}

/** Dominant colours of an image: hue buckets weighted by how many pixels and how colourful. */
async function dominant(url: string): Promise<Hsl[]> {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 48, 48);
  const data = g.getImageData(0, 0, 48, 48).data;
  const buckets = new Map<number, { w: number; h: number; s: number; l: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    const p = hexToHsl(hex);
    // near-greys say nothing about the brand's colours
    if (p.s < 0.18 || p.l < 0.08 || p.l > 0.94) continue;
    const key = Math.round(p.h / 20) % 18;
    const b = buckets.get(key) ?? { w: 0, h: 0, s: 0, l: 0 };
    const w = 0.4 + p.s;
    b.w += w;
    b.h += p.h * w;
    b.s += p.s * w;
    b.l += p.l * w;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => b.w - a.w).map((b) => ({ h: b.h / b.w, s: b.s / b.w, l: b.l / b.w }));
}

/** Up to five background palettes (2–3 colours each) drawn from the designs. */
export async function palettesFromImages(urls: string[]): Promise<string[][]> {
  const found: Hsl[] = [];
  for (const url of urls) {
    try {
      for (const c of (await dominant(url)).slice(0, 2)) if (!found.some((f) => Math.abs(((f.h - c.h + 540) % 360) - 180) < 24)) found.push(c);
    } catch {
      // an image that cannot be read adds no colour
    }
  }
  if (!found.length) return [];
  const [a, b = { ...a, h: (a.h + 30) % 360 }, c = { ...a, h: (a.h + 330) % 360 }] = found;
  return [
    // light tints
    [tone(a, 0.9, 0.45), tone(b, 0.86, 0.4), tone(c, 0.82, 0.35)],
    // soft, muted mid-tones
    [tone(a, 0.74, 0.3), tone(b, 0.68, 0.28), tone(c, 0.62, 0.25)],
    // deep shades
    [tone(a, 0.2, 0.45), tone(b, 0.16, 0.4), tone(c, 0.24, 0.35)],
    // the brand's own colours, a little calmer
    [tone(a, Math.min(0.6, Math.max(0.42, a.l)), 0.7), tone(b, Math.min(0.6, Math.max(0.42, b.l)), 0.7), tone(c, 0.5, 0.6)],
    // warm neutrals in the main hue
    [tone(a, 0.88, 0.1), tone(a, 0.74, 0.08), tone(a, 0.26, 0.1)],
  ];
}

/**
 * A style's background in a pack colour: plain for sets with a wall, a soft
 * gradient for the studio looks, the colours of the pattern for a pattern look.
 */
export function colourBackground(original: Background | undefined, color: string, palette: string[]): Background {
  if (original?.kind === 'gradient') return { ...original, stops: [{ color: lighten(color, 0.08), at: 0 }, { color, at: 1 }] };
  if (original?.kind === 'pattern') return { ...original, colors: [color, palette[1] ?? lighten(color, 0.2), palette[2] ?? lighten(color, -0.2)] };
  return { kind: 'solid', color };
}
