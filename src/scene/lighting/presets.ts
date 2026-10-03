import type { I18nString } from '@/i18n';
import type { LightPresetId, Lighting } from '@/store/project';

/**
 * Lighting presets. Each one is a procedural environment (emissive
 * "Lightformers" rendered into a cube map: reflections + fill light) plus the
 * default values of the key light, which the user can then tweak.
 * Positions are in environment space: +Z is the front, +Y is up.
 */

type V3 = [number, number, number];

export interface Former {
  form: 'rect' | 'circle' | 'ring';
  intensity: number;
  color?: string;
  position: V3;
  rotation?: V3;
  scale: V3 | number;
  /** Aim at the origin instead of using `rotation`. */
  aim?: boolean;
}

export interface LightPreset {
  id: LightPresetId;
  name: I18nString;
  /** CSS background used for the preset chip in the UI. */
  swatch: string;
  envColor: string;
  formers: Former[];
  manual: Omit<Lighting, 'preset'>;
}

const PI = Math.PI;
const up: V3 = [PI / 2, 0, 0];
const down: V3 = [-PI / 2, 0, 0];

export const LIGHT_PRESETS: Record<LightPresetId, LightPreset> = {
  studio: {
    id: 'studio',
    name: { fr: 'Studio doux', en: 'Soft studio' },
    swatch: 'radial-gradient(circle at 50% 20%, #ffffff 0 18%, #5b5b63 48%, #1a1a1e 80%)',
    envColor: '#1a1a1e',
    formers: [
      { form: 'rect', intensity: 2.6, position: [0, 10, 2], rotation: up, scale: [18, 10, 1] },
      { form: 'rect', intensity: 3.4, position: [-9, 2, 4], rotation: [0, PI / 2.4, 0], scale: [4, 20, 1] },
      { form: 'rect', intensity: 2.2, position: [9, 2, 3], rotation: [0, -PI / 2.4, 0], scale: [4, 20, 1] },
      { form: 'rect', intensity: 0.55, position: [0, 2, 10], rotation: [0, PI, 0], scale: [26, 14, 1] },
      { form: 'rect', intensity: 1.4, position: [0, 3, -10], scale: [20, 5, 1] },
      { form: 'circle', intensity: 5, position: [6, 7, 9], scale: 1.4, aim: true },
      { form: 'rect', intensity: 0.5, color: '#e2dccf', position: [0, -6, 0], rotation: down, scale: [30, 30, 1] },
    ],
    manual: { intensity: 0.9, color: '#ffffff', azimuth: -29, elevation: 67, softness: 0.6, environment: 1, exposure: 1 },
  },
  highkey: {
    id: 'highkey',
    name: { fr: 'Haute clé', en: 'High key' },
    swatch: 'radial-gradient(circle at 50% 30%, #ffffff 0 40%, #d4d4d8 75%, #a1a1aa)',
    envColor: '#c9c9cd',
    formers: [
      { form: 'rect', intensity: 3, position: [0, 10, 2], rotation: up, scale: [24, 16, 1] },
      { form: 'rect', intensity: 2.2, position: [-10, 2, 4], rotation: [0, PI / 2.4, 0], scale: [8, 20, 1] },
      { form: 'rect', intensity: 2.2, position: [10, 2, 4], rotation: [0, -PI / 2.4, 0], scale: [8, 20, 1] },
      { form: 'rect', intensity: 1.6, position: [0, 2, 10], rotation: [0, PI, 0], scale: [26, 14, 1] },
      { form: 'rect', intensity: 1.2, color: '#f4f2ee', position: [0, -6, 0], rotation: down, scale: [30, 30, 1] },
    ],
    manual: { intensity: 1.1, color: '#ffffff', azimuth: -20, elevation: 72, softness: 0.85, environment: 1, exposure: 1 },
  },
  dramatic: {
    id: 'dramatic',
    name: { fr: 'Dramatique', en: 'Dramatic' },
    swatch: 'linear-gradient(90deg, #f4ede4 0 14%, #3a3632 30%, #050506 70%)',
    envColor: '#050506',
    formers: [
      { form: 'rect', intensity: 6, color: '#fff4e8', position: [-9, 2, 2], rotation: [0, PI / 2.2, 0], scale: [3, 18, 1] },
      { form: 'rect', intensity: 3, position: [8, 4, -7], rotation: [0, -PI / 4, 0], scale: [0.6, 14, 1] },
      { form: 'rect', intensity: 0.15, position: [0, -6, 0], rotation: down, scale: [30, 30, 1] },
    ],
    manual: { intensity: 1.7, color: '#fff2e2', azimuth: -72, elevation: 28, softness: 0.25, environment: 1, exposure: 1 },
  },
  neon: {
    id: 'neon',
    name: { fr: 'Néon', en: 'Neon' },
    swatch: 'linear-gradient(90deg, #ff2fd1, #3b1d6e 50%, #21e4ff)',
    envColor: '#07060d',
    formers: [
      { form: 'rect', intensity: 5, color: '#ff2fd1', position: [-9, 2, 3], rotation: [0, PI / 2.4, 0], scale: [2, 20, 1] },
      { form: 'rect', intensity: 5, color: '#21e4ff', position: [9, 2, 3], rotation: [0, -PI / 2.4, 0], scale: [2, 20, 1] },
      { form: 'rect', intensity: 1.3, color: '#6a3cff', position: [0, 10, 0], rotation: up, scale: [14, 10, 1] },
      { form: 'rect', intensity: 2, color: '#3d5bff', position: [0, 3, -10], scale: [20, 1.2, 1] },
    ],
    manual: { intensity: 0.55, color: '#c9a8ff', azimuth: 35, elevation: 52, softness: 0.5, environment: 1.2, exposure: 1 },
  },
  daylight: {
    id: 'daylight',
    name: { fr: 'Lumière du jour', en: 'Daylight' },
    swatch: 'linear-gradient(180deg, #a9c8f0, #e9eef5 60%, #e8dfcf)',
    envColor: '#8fa9c9',
    formers: [
      { form: 'rect', intensity: 1.8, color: '#d5e6ff', position: [0, 10, 0], rotation: up, scale: [30, 30, 1] },
      { form: 'rect', intensity: 1.1, position: [0, 1, 10], rotation: [0, PI, 0], scale: [30, 4, 1] },
      { form: 'circle', intensity: 16, color: '#fff3dc', position: [-6, 7, 5], scale: 1.1, aim: true },
      { form: 'rect', intensity: 0.9, color: '#e9e2d5', position: [0, -6, 0], rotation: down, scale: [30, 30, 1] },
    ],
    manual: { intensity: 1.7, color: '#fff2dc', azimuth: -45, elevation: 50, softness: 0.15, environment: 1, exposure: 1 },
  },
  golden: {
    id: 'golden',
    name: { fr: 'Heure dorée', en: 'Golden hour' },
    swatch: 'linear-gradient(180deg, #6d6fb3, #e58a5c 55%, #ffcf8a)',
    envColor: '#2b1f2a',
    formers: [
      { form: 'circle', intensity: 14, color: '#ffb066', position: [-8, 2.5, 5], scale: 1.6, aim: true },
      { form: 'rect', intensity: 1, color: '#7f86cc', position: [0, 10, 0], rotation: up, scale: [30, 30, 1] },
      { form: 'rect', intensity: 1.2, color: '#ff9a62', position: [-9, 1, 2], rotation: [0, PI / 2.2, 0], scale: [10, 4, 1] },
      { form: 'rect', intensity: 0.6, color: '#f1c49a', position: [0, -6, 0], rotation: down, scale: [30, 30, 1] },
    ],
    manual: { intensity: 1.9, color: '#ffb469', azimuth: -64, elevation: 18, softness: 0.2, environment: 1, exposure: 1.05 },
  },
  noir: {
    id: 'noir',
    name: { fr: 'Sombre premium', en: 'Dark premium' },
    swatch: 'linear-gradient(180deg, #000 0 30%, #2b2b30 32%, #000 36% 70%, #1c1c20 72%, #000 76%)',
    envColor: '#000000',
    formers: [
      { form: 'rect', intensity: 3.2, position: [0, 10, 1], rotation: up, scale: [18, 0.45, 1] },
      { form: 'rect', intensity: 2.4, position: [0, 4, -10], scale: [22, 0.35, 1] },
      { form: 'rect', intensity: 1.8, position: [-10, 3, 1], rotation: [0, PI / 2, 0], scale: [0.35, 18, 1] },
      { form: 'rect', intensity: 0.12, position: [0, 2, 10], rotation: [0, PI, 0], scale: [26, 14, 1] },
    ],
    manual: { intensity: 0.6, color: '#ffffff', azimuth: -35, elevation: 60, softness: 0.5, environment: 1, exposure: 0.95 },
  },
};

export const LIGHT_PRESET_ORDER: LightPresetId[] = ['studio', 'highkey', 'dramatic', 'neon', 'daylight', 'golden', 'noir'];
