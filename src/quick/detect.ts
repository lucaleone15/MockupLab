/*
 * Which kind of support suits an image, from its proportions (spec § 5).
 * r = width / height; the rules apply in this order.
 */

export type Support = 'phone' | 'tablet' | 'laptop' | 'browser' | 'screen' | 'watch' | 'print' | 'objects';

export const SUPPORTS: Support[] = ['phone', 'tablet', 'laptop', 'browser', 'screen', 'watch', 'print', 'objects'];

/** The device each support is shown on. */
export const SUPPORT_MODELS: Record<Support, string> = {
  phone: 'phone-pro',
  tablet: 'tablet-pro-11',
  laptop: 'laptop-14',
  browser: 'browser',
  screen: 'desktop-24',
  watch: 'watch',
  print: 'poster',
  objects: 'mug',
};

const BOUNDARIES = [0.4, 0.6, 0.69, 0.73, 0.85, 1.15, 1.9];

/** File names that say "print" in French or English. */
const PRINT_NAME = /carte|card|visite|business|flyer|affiche|poster|brochure|d[ée]pliant|menu|invitation|print/i;
/** Business cards: 85 × 55 mm and 89 × 51 mm, either way round. */
const CARD_RATIOS = [85 / 55, 89 / 51];
/** Widths of common screens and screenshots: a card-shaped image this wide is a screen. */
const SCREEN_WIDTHS = [1280, 1366, 1440, 1512, 1536, 1600, 1680, 1728, 1920, 2048, 2560, 2880, 3024, 3456, 3840];

/** The model a support is shown on, for an image of this size: a card-shaped print goes on a business card. */
export function modelForSupport(support: Support, width = 0, height = 0): string {
  if (support === 'print' && width && height) {
    const r = Math.max(width, height) / Math.min(width, height);
    if (CARD_RATIOS.some((c) => Math.abs(r - c) / c < 0.02)) return 'business-card';
  }
  return SUPPORT_MODELS[support];
}

export function detectSupport(width: number, height: number, isPdf = false, name = ''): { support: Support; confident: boolean } {
  if (isPdf) return { support: 'print', confident: true };
  if (PRINT_NAME.test(name)) return { support: 'print', confident: true };
  const r = width / Math.max(1, height);
  const long = Math.max(width, height);
  const cardShaped = CARD_RATIOS.some((c) => Math.abs(Math.max(r, 1 / r) - c) / c < 0.02);
  if (cardShaped && !SCREEN_WIDTHS.includes(long)) return { support: 'print', confident: false };
  const confident = !BOUNDARIES.some((b) => Math.abs(r - b) / b < 0.05);
  const support: Support =
    r < 0.4 && width >= 1000
      ? 'browser'
      : r < 0.6
        ? 'phone'
        : r >= 0.69 && r <= 0.73 && height >= 2000
          ? 'print'
          : r < 0.85
            ? 'tablet'
            : r <= 1.15
              ? width < 600
                ? 'watch'
                : 'print'
              : r <= 1.9
                ? 'laptop'
                : 'screen';
  return { support, confident };
}
