import type { ExportSettings, ImageFormat, RatioPreset, ResolutionPreset } from '@/store/project';

export const RESOLUTIONS: { id: ResolutionPreset; label: string; short: number }[] = [
  { id: '1080', label: '1080p', short: 1080 },
  { id: '2k', label: '2K', short: 1440 },
  { id: '4k', label: '4K', short: 2160 },
];

export const RATIOS: { id: RatioPreset; label: string; value: number; hint?: string }[] = [
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

export const ratioValue = (id: RatioPreset) => RATIOS.find((r) => r.id === id)?.value ?? 16 / 9;

/** Output pixel size: the preset fixes the short side, the ratio the long one. */
export function outputSize(s: Pick<ExportSettings, 'resolution' | 'ratio'>): { width: number; height: number } {
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
