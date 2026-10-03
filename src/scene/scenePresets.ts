import type { I18nString } from '@/i18n';
import {
  DEFAULT_CAMERA,
  DEFAULT_DECOR,
  DEFAULT_GROUND,
  useProject,
  type Background,
  type CameraSettings,
  type Decor,
  type Ground,
  type LightPresetId,
  type MaterialId,
  type PlaceId,
} from '@/store/project';
import { PLACES } from './places';

/**
 * Complete looks applied in one click: background, set, light, camera and
 * floor. Everything stays editable afterwards.
 */
export interface ScenePreset {
  id: string;
  name: I18nString;
  thumb: { place: PlaceId; material: MaterialId } | { css: string; material?: MaterialId };
  background?: Background;
  decor: Partial<Decor>;
  light?: LightPresetId;
  exposure?: number;
  camera?: Partial<CameraSettings>;
  ground?: Partial<Ground>;
}

const place = (id: PlaceId, fr: string, en: string, material: MaterialId = PLACES[id].table): ScenePreset => ({
  id: `place-${id}`,
  name: { fr, en },
  thumb: { place: id, material },
  decor: { kind: 'place', place: id, material, rotation: PLACES[id].rotation, blur: 0.45 },
  light: 'studio',
  exposure: PLACES[id].exposure,
});

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'studio-dark',
    name: { fr: 'Studio sombre', en: 'Dark studio' },
    thumb: { css: 'radial-gradient(circle at 50% 40%, #3a3a42, #0d0d10 70%)' },
    background: { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#2a2a31', at: 0 }, { color: '#0d0d10', at: 1 }] },
    decor: { kind: 'none' },
    light: 'studio',
  },
  {
    id: 'studio-light',
    name: { fr: 'Studio clair', en: 'Light studio' },
    thumb: { css: 'radial-gradient(circle at 50% 40%, #ffffff, #dcdad4 75%)' },
    background: { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#ffffff', at: 0 }, { color: '#dcdad4', at: 1 }] },
    decor: { kind: 'none' },
    light: 'highkey',
  },
  place('loft', 'Loft · chêne', 'Loft · oak'),
  place('cafe', 'Café · noyer', 'Café · walnut'),
  place('lounge', 'Salon · marbre', 'Lounge · marble'),
  place('veranda', 'Véranda · travertin', 'Veranda · travertine'),
  place('evening', 'Soirée · marbre noir', 'Evening · black marble'),
  place('atelier', 'Atelier · béton', 'Atelier · concrete'),
  {
    id: 'podium-terrazzo',
    name: { fr: 'Podium terrazzo', en: 'Terrazzo podium' },
    thumb: { css: 'linear-gradient(#ece6dc, #d9d1c4)', material: 'terrazzo' },
    background: { kind: 'solid', color: '#e9e4dc' },
    decor: { kind: 'podium', podiumFinish: 'material', material: 'terrazzo', shape: 'cylinder', arch: false },
    light: 'highkey',
  },
  {
    id: 'podium-arch',
    name: { fr: 'Podium & arche', en: 'Podium & arch' },
    thumb: { css: 'radial-gradient(ellipse at 50% 20%, #f6e9dc 0 30%, #e8d9c8 31% 60%, #efe3d6 61%)' },
    background: { kind: 'solid', color: '#efe3d6' },
    decor: { kind: 'podium', podiumFinish: 'paint', color: '#e8d9c8', shape: 'cylinder', arch: true },
    light: 'highkey',
  },
  {
    id: 'flatlay-marble',
    name: { fr: 'À plat sur marbre', en: 'Flat lay on marble' },
    thumb: { css: 'linear-gradient(#f1efe9, #e6e3dc)', material: 'marble-white' },
    background: { kind: 'solid', color: '#f1efe9' },
    decor: { kind: 'surface', material: 'marble-white' },
    light: 'highkey',
    camera: { preset: 'top' },
  },
  {
    id: 'flatlay-linen',
    name: { fr: 'À plat sur lin', en: 'Flat lay on linen' },
    thumb: { css: 'linear-gradient(#e8e4dd, #d6d0c6)', material: 'linen' },
    background: { kind: 'solid', color: '#e4e0d8' },
    decor: { kind: 'surface', material: 'linen' },
    light: 'highkey',
    camera: { preset: 'top' },
  },
  {
    id: 'aurora',
    name: { fr: 'Aurora & reflet', en: 'Aurora & reflection' },
    thumb: { css: 'linear-gradient(135deg, #0c0a1d, #4b2ad8 55%, #ff6a3d)' },
    background: { kind: 'pattern', pattern: 'aurora', colors: ['#0c0a1d', '#4b2ad8', '#ff6a3d'], scale: 1, grain: 0.35, seed: 4 },
    decor: { kind: 'none' },
    light: 'studio',
    ground: { reflection: true, reflectivity: 0.45 },
  },
  {
    id: 'neon',
    name: { fr: 'Néon', en: 'Neon' },
    thumb: { css: 'linear-gradient(90deg, #ff2fd1, #110b1f 45% 55%, #21e4ff)' },
    background: { kind: 'solid', color: '#07060d' },
    decor: { kind: 'none' },
    light: 'neon',
    ground: { reflection: true, reflectivity: 0.5 },
  },
  {
    id: 'noir',
    name: { fr: 'Noir dramatique', en: 'Dramatic black' },
    thumb: { css: 'linear-gradient(90deg, #f4ede4 0 6%, #2b2b30 25%, #050506 70%)' },
    background: { kind: 'solid', color: '#050506' },
    decor: { kind: 'sweep', color: '#1d1d21' },
    light: 'dramatic',
  },
];

/** Applies a preset (one undo step: the history groups bursts of changes). */
export function applyScenePreset(p: ScenePreset) {
  const s = useProject.getState();
  if (p.background) s.setBackground(p.background);
  s.setDecor({ ...DEFAULT_DECOR, ...p.decor });
  if (p.light) s.applyLightPreset(p.light);
  if (p.exposure) s.setLighting({ exposure: p.exposure });
  s.setGround({ ...DEFAULT_GROUND, ...p.ground });
  const camera = { ...DEFAULT_CAMERA, preset: 'threeQuarter' as const, ...p.camera };
  s.setPose(camera.preset === 'top' ? 'flat' : 'standing');
  s.setCamera(camera);
}
