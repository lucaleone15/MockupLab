import type { CameraPresetId } from '@/store/project';

/*
 * Ready-made mock-ups for the Quick gallery: a complete scene (one of the
 * scene presets) seen from an angle, tagged for the filters.
 */

export type QuickTag = 'light' | 'dark' | 'wood' | 'marble' | 'color' | 'lifestyle';
export const QUICK_TAGS: QuickTag[] = ['light', 'dark', 'wood', 'marble', 'color', 'lifestyle'];

export interface QuickTemplate {
  id: string;
  /** Scene preset id (src/scene/scenePresets.ts). */
  preset: string;
  /** Angle; undefined keeps the preset's own. */
  camera?: CameraPresetId;
  tags: QuickTag[];
}

const t = (preset: string, tags: QuickTag[], camera?: CameraPresetId): QuickTemplate => ({ id: camera ? `${preset}@${camera}` : preset, preset, camera, tags });

export const TEMPLATES: QuickTemplate[] = [
  t('table-oak-white', ['wood', 'lifestyle', 'light']),
  t('studio-light', ['light']),
  t('studio-dark', ['dark']),
  t('aurora', ['color', 'dark']),
  t('table-concrete-blue', ['lifestyle', 'light']),
  t('flatlay-linen', ['light']),
  t('table-marble-sand', ['marble', 'lifestyle', 'light']),
  t('podium-terrazzo', ['light', 'color']),
  t('table-walnut-sage', ['wood', 'lifestyle']),
  t('noir', ['dark']),
  t('table-travertine-terracotta', ['lifestyle', 'color']),
  t('flatlay-marble', ['marble', 'light']),
  t('podium-arch', ['light']),
  t('neon', ['color', 'dark']),
  t('table-black-marble', ['marble', 'dark', 'lifestyle']),
  t('studio-light', ['light'], 'front'),
  t('studio-dark', ['dark'], 'low'),
  t('aurora', ['color', 'dark'], 'front'),
];
