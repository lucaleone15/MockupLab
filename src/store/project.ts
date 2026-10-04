import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Fit } from '@/scene/screenMaterial';
import { getModel } from '@/models/registry';
import { defaultParams, type DeviceModule, type ParamValue } from '@/models/types';
import { LIGHT_PRESETS } from '@/scene/lighting/presets';
import { arrangeItems, besideOthers } from '@/lib/arrange';

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
  visible: boolean;
  /** Locked devices cannot be moved with the mouse. */
  locked: boolean;
}

/** Built-in faces, or the brand kit's heading / body typefaces. */
export type OverlayFont = 'sans' | 'serif' | 'mono' | 'heading' | 'body';

/** A typeface of the brand kit: one of the bundled ones, or a font file imported by the user (stored as an asset). */
export interface BrandFont {
  family: string;
  assetId: string | null;
}

export interface BrandColor {
  hex: string;
  name: string;
}

/** Brand identity used by the "Brand" tab: palette, typefaces, logo, generated visuals. */
export interface Brand {
  name: string;
  tagline: string;
  logoAssetId: string | null;
  colors: BrandColor[];
  heading: BrandFont;
  body: BrandFont;
}

/** 2D layers painted over the render: titles, captions, logos. Positions are fractions of the frame. */
export type Overlay =
  | {
      id: string;
      kind: 'text';
      text: string;
      font: OverlayFont;
      weight: 400 | 500 | 700 | 800;
      /** Font size as a fraction of the frame height. */
      size: number;
      color: string;
      align: 'left' | 'center' | 'right';
      /** Anchor point (fraction of width / height); the text aligns around it. */
      x: number;
      y: number;
      /** Letter spacing in em. */
      tracking: number;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'palette';
      /** Chip size as a fraction of the frame height. */
      size: number;
      x: number;
      y: number;
      layout: 'row' | 'column';
      shape: 'circle' | 'square';
      labels: boolean;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'type';
      size: number;
      x: number;
      y: number;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'logo';
      assetId: string | null;
      /** Height as a fraction of the frame height. */
      size: number;
      x: number;
      y: number;
      opacity: number;
      visible: boolean;
    };

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
  /** Horizontal lens shift, fraction of the frame width (positive: subject moves right). */
  shift: number;
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
  version: 4;
  brand: Brand;
  name: string;
  items: SceneItem[];
  selectedId: string | null;
  overlays: Overlay[];
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

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeItem(model: DeviceModule): SceneItem {
  return {
    id: uid(),
    modelId: model.id,
    finishId: model.defaultFinish,
    params: defaultParams(model),
    surfaces: Object.fromEntries(model.surfaces.map((s) => [s.id, { ...DEFAULT_SURFACE, fit: s.fit ?? 'cover', align: s.fit ? 0.5 : 0 }])),
    screen: { ...DEFAULT_SCREEN },
    position: [0, 0, 0],
    rotation: [0, model.yaw ?? -0.32, 0],
    scale: 1,
    pose: 'standing',
    visible: true,
    locked: false,
  };
}

export const DEFAULT_BRAND: Brand = {
  name: 'Solstice',
  tagline: 'Festival de musique en plein air',
  logoAssetId: null,
  colors: [
    { hex: '#FF5C35', name: 'Soleil' },
    { hex: '#1D1A17', name: 'Nuit' },
    { hex: '#2F4A3B', name: 'Forêt' },
    { hex: '#FFB547', name: 'Miel' },
    { hex: '#F1EBE0', name: 'Lin' },
  ],
  heading: { family: 'Geist Variable', assetId: null },
  body: { family: 'Geist Variable', assetId: null },
};

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
export const DEFAULT_CAMERA: CameraSettings = { preset: 'threeQuarter', focal: 52, dof: false, aperture: 0.6, focus: 0, shift: 0 };

export function initialProject(): Project {
  const item = makeItem(getModel('phone-pro'));
  return {
    version: 4,
    brand: structuredClone(DEFAULT_BRAND),
    name: 'Untitled',
    items: [item],
    selectedId: item.id,
    overlays: [],
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
  setBrand: (patch: Partial<Brand>) => void;
  setLighting: (patch: Partial<Lighting>) => void;
  /** Applies a lighting preset (resets the manual values to the preset's). */
  applyLightPreset: (id: LightPresetId) => void;
  setCamera: (patch: Partial<CameraSettings>) => void;
  setGround: (patch: Partial<Ground>) => void;
  /** Pose of one item, or of every item (camera presets). */
  setPose: (pose: SceneItem['pose'], itemId?: string) => void;
  selectItem: (id: string | null) => void;
  /** Adds a device next to the others (or at `position`) and selects it. */
  addItem: (modelId: string, position?: Vec3) => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  /** Lays out every device in a balanced composition. */
  arrange: () => void;
  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  /** Replaces the whole project (load, import, new). */
  loadProject: (project: Project) => void;
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
  brand: s.brand,
  name: s.name,
  items: s.items,
  selectedId: s.selectedId,
  overlays: s.overlays,
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
      setBrand: (patch) => set((s) => ({ brand: { ...s.brand, ...patch } })),
      setLighting: (patch) => set((s) => ({ lighting: { ...s.lighting, ...patch } })),
      applyLightPreset: (id) => set({ lighting: { ...LIGHT_PRESETS[id].manual, preset: id } }),
      setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      setGround: (patch) => set((s) => ({ ground: { ...s.ground, ...patch } })),
      setPose: (pose, itemId) => set((s) => ({ items: s.items.map((it) => (!itemId || it.id === itemId ? { ...it, pose } : it)) })),
      selectItem: (selectedId) => set({ selectedId }),
      addItem: (modelId, position) =>
        set((s) => {
          const item = makeItem(getModel(modelId));
          item.position = position ?? besideOthers(s.items, getModel(modelId).size[0]);
          // A new device starts with the image of the selected one when the screens look alike.
          const selected = s.items.find((it) => it.id === s.selectedId);
          const source = selected && Object.values(selected.surfaces).find((b) => b.assetId);
          const slot = getModel(modelId).surfaces[0];
          const sourceSlot = selected && getModel(selected.modelId).surfaces[0];
          if (source && slot && sourceSlot && (slot.aspect < 1) === (sourceSlot.aspect < 1)) item.surfaces[slot.id] = { ...source };
          return { items: [...s.items, item], selectedId: item.id };
        }),
      duplicateItem: (id) =>
        set((s) => {
          const src = s.items.find((it) => it.id === id);
          if (!src) return {};
          const w = getModel(src.modelId).size[0];
          const copy: SceneItem = structuredClone(src);
          copy.id = uid();
          copy.position = [src.position[0] + w * 0.7 + 4, src.position[1], src.position[2] + 4];
          return { items: [...s.items, copy], selectedId: copy.id };
        }),
      removeItem: (id) =>
        set((s) => {
          if (s.items.length <= 1) return {};
          const items = s.items.filter((it) => it.id !== id);
          return { items, selectedId: s.selectedId === id ? items[items.length - 1].id : s.selectedId };
        }),
      arrange: () => set((s) => ({ items: arrangeItems(s.items) })),
      addOverlay: (overlay) => set((s) => ({ overlays: [...s.overlays, overlay] })),
      updateOverlay: (id, patch) =>
        set((s) => ({ overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)) })),
      removeOverlay: (id) => set((s) => ({ overlays: s.overlays.filter((o) => o.id !== id) })),
      loadProject: (project) => set({ ...project }),
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
            // Each slot keeps its own image; the first one inherits the old first image.
            const surfaces = Object.fromEntries(
              model.surfaces.map((slot, i) => [
                slot.id,
                it.surfaces[slot.id] ?? (i === 0 && firstImage ? { ...firstImage, fit: slot.fit ?? firstImage.fit } : { ...DEFAULT_SURFACE, fit: slot.fit ?? 'cover' }),
              ]),
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
