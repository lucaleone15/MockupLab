import type { I18nString } from '@/i18n';
import type { Brand, RatioPreset } from '@/store/project';

/*
 * “Voir sur…”: the mock-up shown inside a generic interface of a social
 * network (no logo, no brand name of the network), to see it in place.
 */

export type Network = 'ig-post' | 'story' | 'tiktok' | 'youtube';

export interface SocialView {
  network: Network | null;
  /** Account name shown in the interface ('' → from the brand). */
  account: string;
  caption: string;
  /** Video title (YouTube). */
  title: string;
  /** The exported image includes the interface. */
  withInterface: boolean;
}

export const DEFAULT_SOCIAL: SocialView = { network: null, account: '', caption: '', title: '', withInterface: false };

export const NETWORK_ORDER: Network[] = ['ig-post', 'story', 'tiktok', 'youtube'];

export const NETWORKS: Record<Network, { ratio: RatioPreset; label: I18nString }> = {
  'ig-post': { ratio: 'ig-post', label: { fr: 'Post Insta', en: 'Insta post' } },
  story: { ratio: 'story', label: { fr: 'Story', en: 'Story' } },
  tiktok: { ratio: 'story', label: { fr: 'TikTok / Reel', en: 'TikTok / Reel' } },
  youtube: { ratio: 'youtube', label: { fr: 'YouTube', en: 'YouTube' } },
};

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '');

/** The account shown: the one typed, else the brand's name as a handle. */
export function accountOf(social: SocialView, brand: Pick<Brand, 'name'>) {
  const typed = social.account.trim();
  if (typed) return typed.startsWith('@') ? typed : `@${typed}`;
  return `@${slug(brand.name) || 'moncompte'}`;
}

/**
 * Room the interface takes around the image, as fractions of the image width:
 * above and below (post, YouTube); stories and TikTok draw over the image.
 */
export function chromeOf(network: Network) {
  if (network === 'ig-post') return { top: 0.13, bottom: 0.33 };
  if (network === 'youtube') return { top: 0, bottom: 0.2 };
  return { top: 0, bottom: 0 };
}
