import type { Background, PatternId } from '@/store/project';

/** Curated starting points; every value stays editable afterwards. */
export const BG_PRESETS: Background[] = [
  { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#2a2a31', at: 0 }, { color: '#0d0d10', at: 1 }] },
  { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#ffffff', at: 0 }, { color: '#dcdad4', at: 1 }] },
  { kind: 'solid', color: '#f1efe9' },
  { kind: 'solid', color: '#0b0b0c' },
  { kind: 'pattern', pattern: 'aurora', colors: ['#0c0a1d', '#4b2ad8', '#ff6a3d'], scale: 1, grain: 0.35, seed: 4 },
  { kind: 'pattern', pattern: 'aurora', colors: ['#f6efe6', '#ffb7a1', '#9fb6ff'], scale: 1.2, grain: 0.25, seed: 11 },
  { kind: 'pattern', pattern: 'grain', colors: ['#ff8a5c', '#c2304a', '#ffd29a'], scale: 1, grain: 0.6, seed: 2 },
  { kind: 'pattern', pattern: 'grain', colors: ['#a5b4fc', '#312e81', '#f0abfc'], scale: 1, grain: 0.6, seed: 7 },
  { kind: 'gradient', type: 'linear', angle: 160, stops: [{ color: '#d9f99d', at: 0 }, { color: '#4d7c0f', at: 1 }] },
  { kind: 'gradient', type: 'conic', angle: 210, stops: [{ color: '#ffd1dc', at: 0 }, { color: '#c4b5fd', at: 0.35 }, { color: '#a5f3fc', at: 0.7 }, { color: '#ffd1dc', at: 1 }] },
  { kind: 'pattern', pattern: 'topo', colors: ['#10131a', '#2f3a52', '#1b2333'], scale: 1, grain: 0.15, seed: 3 },
  { kind: 'pattern', pattern: 'paper', colors: ['#f3eee4', '#d8d0c0', '#6f665b'], scale: 1, grain: 0.15, seed: 1 },
  { kind: 'pattern', pattern: 'concrete', colors: ['#c9c6bf', '#8f8b85', '#55514c'], scale: 1.2, grain: 0.2, seed: 2 },
  { kind: 'pattern', pattern: 'marble', colors: ['#f3f1ed', '#8f8b86', '#c8a86c'], scale: 1, grain: 0.05, seed: 8 },
  { kind: 'pattern', pattern: 'terrazzo', colors: ['#efe9e0', '#e07a4f', '#3f6a8a'], scale: 1.4, grain: 0.1, seed: 5 },
  { kind: 'pattern', pattern: 'linen', colors: ['#e8e1d4', '#c5baa7', '#000000'], scale: 1, grain: 0.1, seed: 4 },
  { kind: 'pattern', pattern: 'dots', colors: ['#f4f1ea', '#ff5c35', '#000000'], scale: 1, grain: 0.05, seed: 1 },
  { kind: 'pattern', pattern: 'blueprint', colors: ['#16346b', '#7fa6e6', '#c7d8f5'], scale: 1, grain: 0.15, seed: 1 },
];

/** Sensible colours when switching to a pattern. */
export const PATTERN_DEFAULTS: Record<PatternId, [string, string, string]> = {
  grain: ['#ff8a5c', '#c2304a', '#ffd29a'],
  aurora: ['#0c0a1d', '#4b2ad8', '#ff6a3d'],
  topo: ['#10131a', '#2f3a52', '#1b2333'],
  paper: ['#f3eee4', '#d8d0c0', '#6f665b'],
  concrete: ['#c9c6bf', '#8f8b85', '#55514c'],
  marble: ['#f3f1ed', '#8f8b86', '#c8a86c'],
  terrazzo: ['#efe9e0', '#e07a4f', '#3f6a8a'],
  linen: ['#e8e1d4', '#c5baa7', '#000000'],
  wood: ['#c99d70', '#7c5434', '#5a3a22'],
  dots: ['#f4f1ea', '#ff5c35', '#000000'],
  grid: ['#f6f5f2', '#cfcac0', '#9a948a'],
  blueprint: ['#16346b', '#7fa6e6', '#c7d8f5'],
};
