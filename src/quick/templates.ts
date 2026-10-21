import type { I18nString } from '@/i18n';

/*
 * Quick mode's studio photos: the design on its device in a plain studio of
 * the picked colour, seen six ways.
 */

export type ShotId = 'front' | 'threeQuarter' | 'podium' | 'top' | 'pair' | 'close';

export const SHOTS: { id: ShotId; label: I18nString }[] = [
  { id: 'front', label: { fr: 'Face', en: 'Front' } },
  { id: 'threeQuarter', label: { fr: 'Trois-quarts', en: 'Three-quarter' } },
  { id: 'podium', label: { fr: 'Sur podium', en: 'On a podium' } },
  { id: 'top', label: { fr: 'Vu de dessus', en: 'From above' } },
  { id: 'pair', label: { fr: 'Deux appareils', en: 'Two devices' } },
  { id: 'close', label: { fr: 'Gros plan', en: 'Close-up' } },
];

/** Studio colours: pale tints first, then deep ones. */
export const QUICK_COLORS: { hex: string; name: I18nString }[] = [
  { hex: '#f4f2ee', name: { fr: 'Blanc cassé', en: 'Off-white' } },
  { hex: '#e9e4f7', name: { fr: 'Lilas', en: 'Lilac' } },
  { hex: '#dfe8f3', name: { fr: 'Bleu ciel', en: 'Sky blue' } },
  { hex: '#e3ece2', name: { fr: 'Sauge', en: 'Sage' } },
  { hex: '#f3e3d8', name: { fr: 'Pêche', en: 'Peach' } },
  { hex: '#f6dfe2', name: { fr: 'Rose poudré', en: 'Powder pink' } },
  { hex: '#1f2a44', name: { fr: 'Bleu nuit', en: 'Midnight blue' } },
  { hex: '#2b2b2e', name: { fr: 'Graphite', en: 'Graphite' } },
  { hex: '#0b0b0d', name: { fr: 'Noir', en: 'Black' } },
];
