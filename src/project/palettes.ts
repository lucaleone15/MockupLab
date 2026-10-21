import { loadImage } from '@/store/assets';
import { hexToHsl, hslToHex, hueGap, tone, type Hsl } from '@/lib/color';

/*
 * Pack colours. The designs' dominant colours are read, then turned into one
 * palette in a single hue family (a light tint, a soft tone, a deep shade), so
 * the backgrounds never clash; the raw colours stay on offer to pick by hand.
 */

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

/** The palette when the designs have no colour of their own: warm white, stone, graphite. */
export const DEFAULT_PALETTE = ['#f4f2ee', '#e3e0da', '#2b2b2e'];

/** The designs' own colours, most present first (six at most, distinct hues). */
export async function imageColors(urls: string[]): Promise<string[]> {
  const found: Hsl[] = [];
  for (const url of urls) {
    try {
      for (const c of (await dominant(url)).slice(0, 2)) if (!found.some((f) => hueGap(f.h, c.h) < 24)) found.push(c);
    } catch {
      // an image that cannot be read adds no colour
    }
  }
  return found.slice(0, 6).map(hslToHex);
}

/**
 * A background palette from the designs' colours: the main hue as a light
 * tint, a soft tone (of a neighbouring hue when there is one) and a deep shade.
 */
export function harmonize(colors: string[]): string[] {
  if (!colors.length) return DEFAULT_PALETTE;
  const [main, ...rest] = colors.map(hexToHsl);
  const near = rest.find((c) => hueGap(c.h, main.h) <= 50) ?? main;
  return [tone(main, 0.92, 0.4), tone(near, 0.82, 0.3), tone(main, 0.2, 0.25)];
}
