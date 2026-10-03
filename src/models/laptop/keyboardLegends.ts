/*
 * Keycap legends, drawn into one canvas that is laid over the keyboard.
 * Label tables follow the key order produced by `keyboardLayout` in Laptop.tsx:
 * 14 function keys, 14 / 14 / 13 / 12 keys for the four main rows, 7 bottom-row
 * keys, then the arrows (left, up, down, right).
 */

export type KeyboardLayoutId = 'qwerty' | 'azerty';

/** A legend: a single centred glyph, a [shifted, base] pair, or a small modifier label. */
type Legend =
  | string
  | [string, string]
  | { label: string; symbol?: string; align: 'left' | 'right' | 'center'; size?: 'fn' | 'mod' };

const mod = (label: string, align: 'left' | 'right' = 'left', symbol?: string): Legend => ({ label, symbol, align, size: 'mod' });
const fn = (label: string): Legend => ({ label, align: 'center', size: 'fn' });

const FN_ROW: Legend[] = [mod('esc'), ...Array.from({ length: 12 }, (_, i) => fn(`F${i + 1}`)), fn('')];
const ARROWS: Legend[] = ['◀', '▲', '▼', '▶'].map((a) => ({ label: a, align: 'center' as const, size: 'fn' as const }));

const letters = (s: string) => s.split('');

const QWERTY: Legend[] = [
  ...FN_ROW,
  ['~', '`'], ['!', '1'], ['@', '2'], ['#', '3'], ['$', '4'], ['%', '5'], ['^', '6'], ['&', '7'], ['*', '8'], ['(', '9'], [')', '0'], ['_', '-'], ['+', '='],
  mod('delete', 'right'),
  mod('tab'), ...letters('QWERTYUIOP'), ['{', '['], ['}', ']'], ['|', '\\'],
  mod('caps lock'), ...letters('ASDFGHJKL'), [':', ';'], ['"', "'"], mod('return', 'right'),
  mod('shift'), ...letters('ZXCVBNM'), ['<', ','], ['>', '.'], ['?', '/'], mod('shift', 'right'),
  mod('fn'), mod('control', 'left', '⌃'), mod('option', 'left', '⌥'), mod('command', 'left', '⌘'), '', mod('command', 'right', '⌘'), mod('option', 'right', '⌥'),
  ...ARROWS,
];

const AZERTY: Legend[] = [
  ...FN_ROW,
  ['#', '@'], ['1', '&'], ['2', 'é'], ['3', '"'], ['4', "'"], ['5', '('], ['6', '§'], ['7', 'è'], ['8', '!'], ['9', 'ç'], ['0', 'à'], ['°', ')'], ['_', '-'],
  mod('⌫', 'right'),
  mod('⇥'), ...letters('AZERTYUIOP'), ['¨', '^'], ['*', '$'], ['£', '`'],
  mod('⇪'), ...letters('QSDFGHJKLM'), ['%', 'ù'], mod('↩', 'right'),
  mod('⇧'), ...letters('WXCVBN'), ['?', ','], ['.', ';'], ['/', ':'], ['+', '='], mod('⇧', 'right'),
  mod('fn'), mod('ctrl', 'left', '⌃'), mod('alt', 'left', '⌥'), mod('cmd', 'left', '⌘'), '', mod('cmd', 'right', '⌘'), mod('alt', 'right', '⌥'),
  ...ARROWS,
];

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  d: number;
}

const FONT = '"Geist Variable", system-ui, sans-serif';

/**
 * Draws legends for the given key rectangles (deck coordinates in cm, y towards
 * the back, centred on the keyboard). Returns a canvas covering width × depth.
 */
export function drawLegends(keys: KeyRect[], width: number, depth: number, layout: KeyboardLayoutId): HTMLCanvasElement {
  const S = 150; // px per cm
  const c = document.createElement('canvas');
  c.width = Math.round(width * S);
  c.height = Math.round(depth * S);
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  const table = layout === 'azerty' ? AZERTY : QWERTY;

  keys.forEach((k, i) => {
    const legend = table[i];
    if (legend === undefined || legend === '') return;
    const cx = (k.x + width / 2) * S;
    const cy = (depth / 2 - k.y) * S;
    const hw = (k.w / 2) * S;
    const hd = (k.d / 2) * S;
    const pad = 0.17 * S;

    if (typeof legend === 'string') {
      g.font = `400 ${0.34 * S}px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(legend, cx, cy + 0.01 * S);
    } else if (Array.isArray(legend)) {
      g.font = `400 ${0.27 * S}px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(legend[0], cx, cy - 0.2 * S);
      g.fillText(legend[1], cx, cy + 0.22 * S);
    } else if (legend.size === 'fn') {
      g.font = `400 ${(legend.label.length > 1 && !/^F\d/.test(legend.label) ? 0.2 : 0.19) * S}px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(legend.label, cx, cy);
    } else {
      const big = /^[⇧⇥⇪↩⌫]$/.test(legend.label);
      g.font = `400 ${(big ? 0.3 : 0.19) * S}px ${FONT}`;
      g.textAlign = legend.align === 'right' ? 'right' : 'left';
      const x = legend.align === 'right' ? cx + hw - pad : cx - hw + pad;
      g.fillText(legend.label, x, cy + hd - pad - (big ? 0.08 * S : 0.02 * S));
      if (legend.symbol) {
        g.font = `400 ${0.22 * S}px ${FONT}`;
        g.textAlign = legend.align === 'right' ? 'left' : 'right';
        const sx = legend.align === 'right' ? cx - hw + pad : cx + hw - pad;
        g.fillText(legend.symbol, sx, cy - hd + pad + 0.06 * S);
      }
    }
  });
  return c;
}
