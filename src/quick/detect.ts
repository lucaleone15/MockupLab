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

export function detectSupport(width: number, height: number, isPdf = false): { support: Support; confident: boolean } {
  if (isPdf) return { support: 'print', confident: true };
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
