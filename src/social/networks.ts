import type { Brand } from '@/store/project';

/*
 * The generic social interfaces a phone can show on its screen (no logo, no
 * network name): a post, a story, a short video.
 */

export type Network = 'ig-post' | 'story' | 'tiktok';

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '');

/** The account shown: the one typed, else the brand's name as a handle. */
export function handleOf(account: string, brand: Pick<Brand, 'name'>) {
  const typed = account.trim();
  if (typed) return typed.startsWith('@') ? typed : `@${typed}`;
  return `@${slug(brand.name) || 'moncompte'}`;
}

/**
 * Room the interface takes around the image, as fractions of the image width:
 * above and below (post); stories and short videos draw over the image.
 */
export function chromeOf(network: Network) {
  if (network === 'ig-post') return { top: 0.13, bottom: 0.33 };
  return { top: 0, bottom: 0 };
}
