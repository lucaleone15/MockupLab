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

/** Words and phrases of a file name that say "print", in French or English (whole words only). */
const PRINT_WORDS = [
  'carte de visite', 'cartes de visite', 'carte visite', 'carte postale', 'business card', 'business cards', 'businesscard',
  'postcard', 'post card', 'flyer', 'flyers', 'affiche', 'affiches', 'poster', 'posters', 'brochure', 'depliant', 'dépliant',
  'invitation', 'invitations', 'print',
];
/** Business cards (85 × 55 mm), either way round, printed at up to 600 dpi. */
const CARD_RATIO = 85 / 55;
const CARD_MAX_SIDE = 2200;
/** Widths of common screens and screenshots: a card-shaped image this wide is a screen. */
const SCREEN_WIDTHS = [1280, 1366, 1440, 1512, 1536, 1600, 1680, 1728, 1920, 2048, 2560, 2880, 3024, 3456, 3840];

/** The model a support is shown on, for an image of this size: a card-shaped print goes on a business card. */
export function modelForSupport(support: Support, width = 0, height = 0): string {
  if (support === 'print' && width && height && cardShaped(width, height)) return 'business-card';
  return SUPPORT_MODELS[support];
}

function cardShaped(width: number, height: number) {
  const long = Math.max(width, height);
  const r = long / Math.min(width, height);
  return Math.abs(r - CARD_RATIO) / CARD_RATIO < 0.015 && long <= CARD_MAX_SIDE && !SCREEN_WIDTHS.includes(long);
}

/** A file name that says it is a print ("carte-de-visite_recto.png", "PosterA2.jpg"). */
function printByName(name: string) {
  const words = ` ${name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëîïôöùûüç]+/g, ' ')
    .trim()} `;
  return PRINT_WORDS.some((w) => words.includes(` ${w} `));
}

export function detectSupport(width: number, height: number, isPdf = false, name = ''): { support: Support; confident: boolean } {
  if (isPdf) return { support: 'print', confident: true };
  if (printByName(name) || cardShaped(width, height)) return { support: 'print', confident: false };
  const r = width / Math.max(1, height);
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
