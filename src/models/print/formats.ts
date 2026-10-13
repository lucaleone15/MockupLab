import type { I18nString } from '@/i18n';
import type { ImageAspects, ParamDef, ParamValue } from '../types';

/*
 * Paper sizes of the printed models, in cm, as they are usually quoted
 * (portrait for posters and flyers, landscape for cards), and the
 * "Adapt to my image" option: the paper takes the image's exact proportions,
 * the chosen size setting its longest side.
 */

export interface PaperSize {
  value: string;
  label: string;
  /** Width × height in cm. */
  w: number;
  h: number;
}

const size = (value: string, label: string, w: number, h: number): PaperSize => ({ value, label, w, h });

export const POSTER_SIZES: PaperSize[] = [
  size('a4', 'A4', 21, 29.7),
  size('a3', 'A3', 29.7, 42),
  size('a2', 'A2', 42, 59.4),
  size('a1', 'A1', 59.4, 84.1),
  size('a0', 'A0', 84.1, 118.9),
  size('30x40', '30 × 40', 30, 40),
  size('40x50', '40 × 50', 40, 50),
  size('50x70', '50 × 70', 50, 70),
  size('61x91', '61 × 91', 61, 91.5),
  size('70x100', '70 × 100', 70, 100),
];

export const FLYER_SIZES: PaperSize[] = [
  size('a6', 'A6', 10.5, 14.8),
  size('a5', 'A5', 14.8, 21),
  size('a4', 'A4', 21, 29.7),
  size('dl', 'DL', 9.9, 21),
  size('sq21', '21 × 21', 21, 21),
];

export const POSTCARD_SIZES: PaperSize[] = [size('a6', 'A6', 14.8, 10.5), size('10x15', '10 × 15', 15, 10), size('sq14', '14 × 14', 14, 14)];

export const CARD_SIZES: PaperSize[] = [size('eu', '85 × 55', 8.5, 5.5), size('us', '89 × 51', 8.9, 5.1), size('sq', '55 × 55', 5.5, 5.5)];

export const FIT_PARAM: ParamDef = { id: 'fit', kind: 'toggle', label: { fr: 'Adapter à mon image', en: 'Adapt to my image' }, default: true };

export function sizeParam(sizes: PaperSize[], fallback: string): ParamDef {
  return {
    id: 'format',
    kind: 'choice',
    label: { fr: 'Format', en: 'Size' } satisfies I18nString,
    options: sizes.map((s) => ({ value: s.value, label: { fr: s.label, en: s.label } })),
    default: fallback,
  };
}

/** Width × height (cm) of the paper: the chosen size, or the image's proportions with the chosen size as the longest side. */
export function paperDims(sizes: PaperSize[], params: Record<string, ParamValue>, aspects: ImageAspects | undefined, slot: string): [number, number] {
  const s = sizes.find((x) => x.value === params.format) ?? sizes[0];
  const r = params.fit === true ? aspects?.[slot] : undefined;
  if (!r || !Number.isFinite(r) || r <= 0) return [s.w, s.h];
  const long = Math.max(s.w, s.h);
  return r >= 1 ? [long, long / r] : [long * r, long];
}
