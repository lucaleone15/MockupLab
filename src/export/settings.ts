import type { I18nString } from '@/i18n';
import type { ExportSettings, ImageFormat, RatioPreset, ResolutionPreset, SocialPreset } from '@/store/project';

export const RESOLUTIONS: { id: ResolutionPreset; label: string; short: number }[] = [
  { id: '1080', label: '1080p', short: 1080 },
  { id: '2k', label: '2K', short: 1440 },
  { id: '4k', label: '4K', short: 2160 },
];

export const RATIOS: { id: Exclude<RatioPreset, SocialPreset>; label: string; value: number; hint?: string }[] = [
  { id: '16:9', label: '16:9', value: 16 / 9, hint: 'Behance · YouTube' },
  { id: '3:2', label: '3:2', value: 3 / 2, hint: 'Dribbble' },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '1:1', label: '1:1', value: 1, hint: 'Instagram' },
  { id: '4:5', label: '4:5', value: 4 / 5, hint: 'Instagram · LinkedIn' },
  { id: '9:16', label: '9:16', value: 9 / 16, hint: 'Story · Reel' },
  { id: 'a4', label: 'A4', value: 1 / Math.SQRT2 },
];

export const FORMATS: { id: ImageFormat; label: string; mime: string; ext: string }[] = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPG', mime: 'image/jpeg', ext: 'jpg' },
  { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp' },
];

/** Social formats: exact pixel size (at "1080"; ×1.5 at 2K, ×2 at 4K). */
export interface SocialFormat {
  id: SocialPreset;
  label: I18nString;
  px: [number, number];
}

export const SOCIAL: SocialFormat[] = [
  { id: 'ig-post', label: { fr: 'Post Insta', en: 'Insta post' }, px: [1080, 1350] },
  { id: 'ig-square', label: { fr: 'Post carré', en: 'Square post' }, px: [1080, 1080] },
  { id: 'story', label: { fr: 'Story · Reel · TikTok', en: 'Story · Reel · TikTok' }, px: [1080, 1920] },
  { id: 'youtube', label: { fr: 'YouTube', en: 'YouTube' }, px: [1920, 1080] },
  { id: 'linkedin', label: { fr: 'LinkedIn', en: 'LinkedIn' }, px: [1200, 627] },
  { id: 'pinterest', label: { fr: 'Pinterest', en: 'Pinterest' }, px: [1000, 1500] },
];

export const socialOf = (id: RatioPreset) => SOCIAL.find((s) => s.id === id);

const SCALE: Record<ResolutionPreset, number> = { '1080': 1, '2k': 1.5, '4k': 2 };

/** Exact pixel size of a social format at a resolution, or null. */
export function fixedSize(s: Pick<ExportSettings, 'resolution' | 'ratio'>): { width: number; height: number } | null {
  const k = SCALE[s.resolution] ?? 1;
  const social = socialOf(s.ratio);
  if (social) return { width: Math.round(social.px[0] * k), height: Math.round(social.px[1] * k) };
  return null;
}

export const ratioValue = (id: RatioPreset) => {
  const social = socialOf(id);
  if (social) return social.px[0] / social.px[1];
  return RATIOS.find((r) => r.id === id)?.value ?? 16 / 9;
};

/** Output pixel size: the preset fixes the short side, the ratio the long one. */
export function outputSize(s: Pick<ExportSettings, 'resolution' | 'ratio'>): { width: number; height: number } {
  const fixed = fixedSize(s);
  if (fixed) return fixed;
  const short = RESOLUTIONS.find((r) => r.id === s.resolution)?.short ?? 2160;
  const ratio = ratioValue(s.ratio);
  return ratio >= 1
    ? { width: Math.round(short * ratio), height: short }
    : { width: short, height: Math.round(short / ratio) };
}

/** Supersampling factor: 2× up to 4K-class outputs, 1× beyond (already huge). */
export function supersampleFor(width: number, height: number) {
  return width * height <= 3840 * 3840 ? 2 : 1;
}
