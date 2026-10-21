/* Colour arithmetic in HSL, for backgrounds and palettes made from one colour. */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl {
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

export function hslToHex({ h, s, l }: Hsl): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('');
}

/** A colour of this hue at a lightness, its saturation capped. */
export const tone = (c: Hsl, l: number, sMax: number): string => hslToHex({ h: c.h, s: Math.min(c.s, sMax), l });

/** Lighter (or, negative, darker) version of a colour. */
export function lighten(hex: string, amount = 0.1): string {
  const c = hexToHsl(hex);
  return hslToHex({ ...c, l: Math.max(0.03, Math.min(0.97, c.l + amount)) });
}

/** Hue distance in degrees (0..180). */
export const hueGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
