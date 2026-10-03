import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Fit } from '@/scene/screenMaterial';
import { getModel } from '@/models/registry';
import { defaultParams, type DeviceModule, type ParamValue } from '@/models/types';
import { LIGHT_PRESETS } from '@/scene/lighting/presets';

/* ------------------------------------------------------------------ types */

export type Vec3 = [number, number, number];

export interface SurfaceBinding {
  assetId: string | null;
  fit: Fit;
  /** Crop position when the image overflows: 0 = top/left, 1 = bottom/right. */
  align: number;
}

export interface ScreenSettings {
  /** Emissive multiplier, 1 = faithful colours. */
  brightness: number;
  /** Strength of the cover-glass reflection over the screen, 0..1. */
  reflection: number;
}

export interface SceneItem {
  id: string;
  modelId: string;
  finishId: string;
  params: Record<string, ParamValue>;
  surfaces: Record<string, SurfaceBinding>;
  screen: ScreenSettings;
  /** Point on the floor under the device. */
  position: Vec3;
  rotation: Vec3;
  scale: number;
  /** Upright on its edge, or lying flat on its back (phones, tablets, browser). */
  pose: 'standing' | 'flat';
}

export interface GradientStop {
  color: string;
  /** 0..1 */
  at: number;
}

export type PatternId = 'grain' | 'aurora' | 'topo' | 'dots' | 'grid' | 'blueprint';

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; type: 'linear' | 'radial' | 'conic'; angle: number; stops: GradientStop[] }
  | { kind: 'pattern'; pattern: PatternId; colors: [string, string, string]; scale: number; grain: number; seed: number }
  | { kind: 'image'; assetId: string | null; blur: number; dim: number }
  | { kind: 'transparent' };

/** Photographed PBR materials bundled in public/assets/materials (CC0). */
export type MaterialId = 'marble-white' | 'marble-black' | 'travertine' | 'terrazzo' | 'concrete' | 'linen' | 'oak' | 'walnut';
/** Light moods of the table set (CC0 HDRIs in public/assets/light). */
export type AmbienceId = 'day' | 'sun' | 'evening';
/** Shadows projected on the table set (light through a window, blinds, foliage). */
export type GoboId = 'none' | 'window' | 'blinds' | 'leaves';

/** 3D set dressing around the devices. */
export interface Decor {
  kind: 'none' | 'sweep' | 'podium' | 'surface' | 'table';
  /** Paint colour (sweep, painted podium). */
  color: string;
  /** Surface, table top or podium material. */
  material: MaterialId;
  podiumFinish: 'paint' | 'material';
  shape: 'cylinder' | 'block';
  arch: boolean;
  /** Table set: plain wall behind the table. */
  wall: string;
  ambience: AmbienceId;
  gobo: GoboId;
}

export type LightPresetId = 'studio' | 'highkey' | 'dramatic' | 'neon' | 'daylight' | 'golden' | 'noir';

export interface Lighting {
  preset: LightPresetId;
  /** Key light. */
  intensity: number;
  color: string;
  /** Degrees, 0 = from the front, positive = from the right. */
  azimuth: number;
  /** Degrees above the floor. */
  elevation: number;
  /** 0 = crisp shadows, 1 = very soft. */
  softness: number;
  /** Environment (reflections and fill) multiplier. */
  environment: number;
  exposure: number;
}

export type CameraPresetId = 'front' | 'threeQuarter' | 'isometric' | 'top' | 'high' | 'low' | 'custom';

export interface CameraSettings {
  preset: CameraPresetId;
  /** Full-frame equivalent focal length, mm. */
  focal: number;
  dof: boolean;
  /** 0..1 blur strength. */
  aperture: number;
  /** Focus offset along the view axis, -1 (closer) .. 1 (further), relative to the subject size. */
  focus: number;
}

export interface Ground {
  shadow: 'soft' | 'contact' | 'none';
  shadowOpacity: number;
  reflection: boolean;
  /** 0..1 */
  reflectivity: number;
}

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export type ResolutionPreset = '1080' | '2k' | '4k';
export type RatioPreset = '16:9' | '4:3' | '1:1' | '4:5' | '9:16' | '3:2' | 'a4';

export interface ExportSettings {
  format: ImageFormat;
  resolution: ResolutionPreset;
  ratio: RatioPreset;
  /** 0..1, JPG/WebP only. */
  quality: number;
}

export interface Project {
  version: 2;
  name: string;
  items: SceneItem[];
  selectedId: string | null;
  background: Background;
  decor: Decor;
  lighting: Lighting;
  camera: CameraSettings;
  ground: Ground;
  export: ExportSettings;
}

/* -------------------------------------------------------------- defaults */

export const DEFAULT_SURFACE: SurfaceBinding = { assetId: null, fit: 'cover', align: 0 };
export const DEFAULT_SCREEN: ScreenSettings = { brightness: 1, reflection: 0.5 };

const uid = () => Math.random().toString(36).slice(2, 10);

export function makeItem(model: DeviceModule): SceneItem {
  return {
    id: uid(),
    modelId: model.id,
    finishId: model.defaultFinish,
    params: defaultParams(model),
    surfaces: Object.fromEntries(model.surfaces.map((s) => [s.id, { ...DEFAULT_SURFACE }])),
    screen: { ...DEFAULT_SCREEN },
    position: [0, 0, 0],
    rotation: [0, model.yaw ?? -0.32, 0],
    scale: 1,
    pose: 'standing',
  };
}

export const DEFAULT_DECOR: Decor = {
  kind: 'none',
  color: '#d9d4cb',
  material: 'marble-white',
  podiumFinish: 'paint',
  shape: 'cylinder',
  arch: false,
  wall: '#ece6dc',
  ambience: 'day',
  gobo: 'window',
};
export const DEFAULT_GROUND: Ground = { shadow: 'soft', shadowOpacity: 0.55, reflection: false, reflectivity: 0.35 };
export const DEFAULT_CAMERA: CameraSettings = { preset: 'threeQuarter', focal: 52, dof: false, aperture: 0.6, focus: 0 };

function initialProject(): Project {
  const item = makeItem(getModel('phone-pro'));
  return {
    version: 2,
    name: 'Untitled',
    items: [item],
    selectedId: item.id,
    background: {
      kind: 'gradient',
      type: 'radial',
      angle: 0,
      stops: [
        { color: '#2a2a31', at: 0 },
        { color: '#0d0d10', at: 1 },
      ],
    },
    decor: { ...DEFAULT_DECOR },
    lighting: { ...LIGHT_PRESETS.studio.manual, preset: 'studio' },
    camera: { ...DEFAULT_CAMERA },
    ground: { ...DEFAULT_GROUND },
    export: { format: 'png', resolution: '4k', ratio: '16:9', quality: 0.92 },
  };
}

/* ----------------------------------------------------------------- store */

interface ProjectActions {
  updateItem: (id: string, patch: Partial<SceneItem> | ((item: SceneItem) => Partial<SceneItem>)) => void;
  setSurface: (itemId: string, slot: string, patch: Partial<SurfaceBinding>) => void;
  setBackground: (bg: Background) => void;
  setDecor: (patch: Partial<Decor>) => void;
  setLighting: (patch: Partial<Lighting>) => void;
  /** Applies a lighting preset (resets the manual values to the preset's). */
  applyLightPreset: (id: LightPresetId) => void;
  setCamera: (patch: Partial<CameraSettings>) => void;
  setGround: (patch: Partial<Ground>) => void;
  setPose: (pose: SceneItem['pose']) => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  setParam: (itemId: string, id: string, value: ParamValue) => void;
  /** Swaps the device of an item, keeping its images and placement. */
  replaceModel: (itemId: string, modelId: string) => void;
}

export type ProjectState = Project & ProjectActions;

/**
 * History groups bursts of changes (slider drags, typing) into one undo step:
 * the state before the first change of a burst is recorded, the rest is merged.
 */
function burst<T extends unknown[]>(fn: (...args: T) => void, ms = 450) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    if (timer === undefined) fn(...args);
    clearTimeout(timer);
    timer = setTimeout(() => (timer = undefined), ms);
  };
}

const historyOf = (s: ProjectState): Project => ({
  version: s.version,
  name: s.name,
  items: s.items,
  selectedId: s.selectedId,
  background: s.background,
  decor: s.decor,
  lighting: s.lighting,
  camera: s.camera,
  ground: s.ground,
  export: s.export,
});

export const useProject = create<ProjectState>()(
  temporal(
    (set) => ({
      ...initialProject(),
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it)),
        })),
      setSurface: (itemId, slot, patch) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, surfaces: { ...it.surfaces, [slot]: { ...(it.surfaces[slot] ?? DEFAULT_SURFACE), ...patch } } }
              : it,
          ),
        })),
      setBackground: (background) => set({ background }),
      setDecor: (patch) => set((s) => ({ decor: { ...s.decor, ...patch } })),
      setLighting: (patch) => set((s) => ({ lighting: { ...s.lighting, ...patch } })),
      applyLightPreset: (id) => set({ lighting: { ...LIGHT_PRESETS[id].manual, preset: id } }),
      setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      setGround: (patch) => set((s) => ({ ground: { ...s.ground, ...patch } })),
      setPose: (pose) => set((s) => ({ items: s.items.map((it) => ({ ...it, pose })) })),
      setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
      setParam: (itemId, id, value) =>
        set((s) => ({ items: s.items.map((it) => (it.id === itemId ? { ...it, params: { ...it.params, [id]: value } } : it)) })),
      replaceModel: (itemId, modelId) =>
        set((s) => ({
          items: s.items.map((it) => {
            if (it.id !== itemId) return it;
            const model = getModel(modelId);
            // Keep the first image across devices (screen → screen).
            const firstImage = Object.values(it.surfaces).find((b) => b.assetId);
            const surfaces = Object.fromEntries(
              model.surfaces.map((slot, i) => [slot.id, it.surfaces[slot.id] ?? (i === 0 && firstImage ? { ...firstImage } : { ...DEFAULT_SURFACE })]),
            );
            return {
              ...it,
              modelId,
              finishId: model.finishes.some((f) => f.id === it.finishId) ? it.finishId : model.defaultFinish,
              params: defaultParams(model),
              surfaces,
              rotation: [0, model.yaw ?? -0.32, 0],
            };
          }),
        })),
    }),
    {
      limit: 100,
      partialize: historyOf,
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      handleSet: (handleSet) => burst(handleSet),
    },
  ),
);

export const useHistory = () => useProject.temporal;

export const selectSelectedItem = (s: ProjectState) => s.items.find((it) => it.id === s.selectedId) ?? s.items[0] ?? null;
