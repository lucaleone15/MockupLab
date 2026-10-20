import type { I18nString } from '@/i18n';
import type { Layout } from './arrange';

/**
 * Ready-made multi-device scenes: the devices, already laid out, so the user
 * only has to put their images on them. Devices of the same kind already in
 * the scene are reused (model, finish, images), see `setComposition`.
 */
export interface Composition {
  id: string;
  name: I18nString;
  models: string[];
  layout: Layout;
}

const phones = (n: number) => Array.from({ length: n }, () => 'phone-pro');

export const COMPOSITIONS: Composition[] = [
  { id: 'phones-2', name: { fr: '2 téléphones', en: '2 phones' }, models: phones(2), layout: 'row' },
  { id: 'phones-3', name: { fr: '3 téléphones', en: '3 phones' }, models: phones(3), layout: 'fan' },
  { id: 'phones-3-row', name: { fr: '3 téléphones en ligne', en: '3 phones in a row' }, models: phones(3), layout: 'row' },
  { id: 'phones-4', name: { fr: '4 téléphones en cascade', en: '4 phones, staircase' }, models: phones(4), layout: 'cascade' },
  { id: 'phones-5', name: { fr: '5 téléphones', en: '5 phones' }, models: phones(5), layout: 'fan' },
  { id: 'laptop-phone', name: { fr: 'Ordi + téléphone', en: 'Laptop + phone' }, models: ['laptop-14', 'phone-pro'], layout: 'auto' },
  { id: 'laptop-tablet-phone', name: { fr: 'Ordi, tablette, téléphone', en: 'Laptop, tablet, phone' }, models: ['laptop-14', 'tablet-pro-11', 'phone-pro'], layout: 'auto' },
  { id: 'all-screens', name: { fr: 'Tous les écrans', en: 'Every screen' }, models: ['desktop-24', 'laptop-14', 'tablet-pro-11', 'phone-pro'], layout: 'auto' },
];
