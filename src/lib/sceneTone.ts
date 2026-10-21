import type { Background } from '@/store/project';

/** Relative luminance (0 dark … 1 light) of a #rrggbb colour. */
function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How light the scene behind the Studio's glass is, from the project's
 * background: the glass grows denser when the scene would wash its text out
 * (a bright scene in the dark theme, a dark one in the light theme).
 */
export function sceneTone(bg: Background): 'bright' | 'dark' | 'mid' {
  const colors = bg.kind === 'solid' ? [bg.color] : bg.kind === 'gradient' ? bg.stops.map((s) => s.color) : bg.kind === 'pattern' ? bg.colors : null;
  if (bg.kind === 'transparent') return 'bright';
  if (!colors) return 'mid';
  const l = colors.reduce((a, c) => a + luminance(c), 0) / colors.length;
  return l > 0.4 ? 'bright' : l < 0.08 ? 'dark' : 'mid';
}
