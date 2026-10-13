import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Fit } from '@/scene/screenMaterial';
import { getModel } from '@/models/registry';
import { defaultParams, type DeviceModule, type ParamValue } from '@/models/types';
import { LIGHT_PRESETS } from '@/scene/lighting/presets';
import { arrangeItems, besideOthers, constrainItems } from '@/lib/arrange';
import { useAssets } from './assets';
import type { Quad } from '@/photo/homography';

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
  /** The sample phone a new project starts with, until it is edited: the first device picked replaces it. */
  sample?: boolean;
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

export type AnimationId = 'reveal' | 'dive' | 'dutch' | 'flip' | 'drop' | 'crane' | 'vertigo' | 'trailer' | 'turntable' | 'swing' | 'orbit' | 'scroll' | 'float' | 'zoom';

export interface VideoSettings {
  animation: AnimationId;
  /** Seconds. */
  duration: number;
  fps: 24 | 30 | 60;
  resolution: '720' | '1080' | '4k';
  format: 'mp4' | 'webm' | 'gif';
  /** 'cinema': motion blur (several instants per frame) and animated depth of field. */
  quality: 'fast' | 'cinema';
}

export interface ExportSettings {
  /** What the Export button produces. */
  kind: 'image' | 'video';
  video: VideoSettings;
  format: ImageFormat;
  resolution: ResolutionPreset;
  ratio: RatioPreset;
  /** 0..1, JPG/WebP only. */
  quality: number;
}

/** A target area of a photo (a screen, a sheet of paper) that receives a design in perspective. */
export interface PhotoZone {
  id: string;
  name: string;
  /** Screens add the photo's reflections; prints also take its shading. Sets the defaults below. */
  kind: 'screen' | 'print';
  /** Normalised photo coordinates (0..1), TL, TR, BR, BL of the design. */
  corners: Quad;
  /** Width / height of the real surface (estimated from the perspective, or set by the template). */
  aspect: number;
  /** The ratio follows the corners (re-estimated when they move); off once chosen by hand or by a template. */
  aspectAuto: boolean;
  surface: SurfaceBinding;
  /** Corner rounding, fraction of the shorter side. */
  radius: number;
  /** 0..1: multiply by the photo's shading (paper folds, shadows). */
  shading: number;
  /** 0..1: add the photo's reflections and highlights (screen blend). */
  reflection: number;
  /** 0.5..1.5 */
  brightness: number;
  /** -1 (softer, to match a blurry photo) .. 1 (crisper). */
  sharpness: number;
  /** 0..1 film grain matching the photo. */
  noise: number;
  /** Edge softness in pixels. */
  feather: number;
  /** 0..1: tint the design with the photo's ambient light. */
  match: number;
  /** 0..1: keeps in front what clearly differs from the surface (fingers on a screen). 0 = off. */
  occlusion: number;
  /**
   * What the photo's own surface lends to the design: 'auto' keeps its fine
   * details and reflections only when it is blank (an unlit screen, plain
   * paper); 'hide' never (only its smooth light); 'keep' always.
   */
  original: 'auto' | 'hide' | 'keep';
  /** Pixels the design extends past the corners, to cover the surface's own edge. */
  bleed: number;
  visible: boolean;
}

export interface PhotoScene {
  /** The photo (an asset). */
  assetId: string | null;
  /** Bundled or saved template the photo comes from. */
  templateId: string | null;
  zones: PhotoZone[];
  selectedZoneId: string | null;
}

export type WorkMode = 'scene' | 'photo';

export interface Project {
  version: 6;
  /** 3D scene or photo mock-up. */
  mode: WorkMode;
  photo: PhotoScene;
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

export const EMPTY_PHOTO: PhotoScene = { assetId: null, templateId: null, zones: [], selectedZoneId: null };

/** Blend settings that suit a kind of zone. */
export function zoneDefaults(kind: PhotoZone['kind']) {
  return kind === 'screen'
    ? { radius: 0, shading: 0, reflection: 0.7, brightness: 1, sharpness: 0, noise: 0.15, feather: 0.6, match: 0.1, occlusion: 0, original: 'auto' as const, bleed: 1 }
    : { radius: 0, shading: 0.85, reflection: 0.2, brightness: 1, sharpness: 0, noise: 0.25, feather: 0.6, match: 0.35, occlusion: 0, original: 'auto' as const, bleed: 1 };
}

export function makeZone(init: Partial<PhotoZone> & Pick<PhotoZone, 'corners' | 'aspect'>): PhotoZone {
  const kind = init.kind ?? 'screen';
  return {
    id: uid(),
    name: '',
    kind,
    surface: { ...DEFAULT_SURFACE },
    ...zoneDefaults(kind),
    aspectAuto: true,
    visible: true,
    ...init,
  };
}

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

/** The scene is still the lone sample phone of a new project, never edited and without an image. */
function isUntouchedSample(items: SceneItem[]) {
  return items.length === 1 && items[0].sample === true && items[0].modelId === 'phone-pro' && Object.values(items[0].surfaces).every((b) => !b.assetId);
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
  ambience: 'day',
  gobo: 'window',
};
export const DEFAULT_GROUND: Ground = { shadow: 'soft', shadowOpacity: 0.55, reflection: false, reflectivity: 0.35 };
export const DEFAULT_VIDEO: VideoSettings = { animation: 'reveal', duration: 6, fps: 30, resolution: '1080', format: 'mp4', quality: 'cinema' };
export const DEFAULT_CAMERA: CameraSettings = { preset: 'threeQuarter', focal: 52, dof: false, aperture: 0.6, focus: 0, shift: 0 };

export function initialProject(): Project {
  const item = { ...makeItem(getModel('phone-pro')), sample: true };
  return {
    version: 6,
    mode: 'scene',
    photo: structuredClone(EMPTY_PHOTO),
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
    export: { kind: 'image', video: { ...DEFAULT_VIDEO }, format: 'png', resolution: '4k', ratio: '16:9', quality: 0.92 },
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
  /** Background, set, light, camera, floor and text layers back to defaults; devices and images are kept. */
  resetScene: () => void;
  /** Everything back to a fresh project (undoable). */
  resetAll: () => void;
  /** Photo mode: removes the photo and its zones. */
  resetPhoto: () => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  setParam: (itemId: string, id: string, value: ParamValue) => void;
  /** Swaps the device of an item, keeping its images and placement. */
  replaceModel: (itemId: string, modelId: string) => void;
  setMode: (mode: WorkMode) => void;
  /**
   * Sets the photo and its zones (own photo: no zones; template: its zones).
   * Designs already placed carry over to the new zones, in order.
   */
  setPhoto: (assetId: string, templateId: string | null, zones: PhotoZone[]) => void;
  addZone: (zone: PhotoZone) => void;
  updateZone: (id: string, patch: Partial<PhotoZone> | ((z: PhotoZone) => Partial<PhotoZone>)) => void;
  setZoneSurface: (id: string, patch: Partial<SurfaceBinding>) => void;
  removeZone: (id: string) => void;
  selectZone: (id: string | null) => void;
}

export type ProjectState = Project & ProjectActions;

/**
 * History groups bursts of changes (slider drags, typing) into one undo step:
 * the state before the first change of a burst is recorded, the rest is merged.
 */
let burstTimer: ReturnType<typeof setTimeout> | undefined;

/** Ends the current burst, so the next change gets its own undo step (resets, device swaps). */
function breakBurst() {
  clearTimeout(burstTimer);
  burstTimer = undefined;
}

function burst<T extends unknown[]>(fn: (...args: T) => void, ms = 450) {
  return (...args: T) => {
    if (burstTimer === undefined) fn(...args);
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => (burstTimer = undefined), ms);
  };
}

const historyOf = (s: ProjectState): Project => ({
  version: s.version,
  mode: s.mode,
  photo: s.photo,
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
          items: constrainItems(
            s.items.map((it) => (it.id === id ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch), sample: false } : it)),
            s.decor,
          ),
        })),
      // an image can change a print's proportions ("Adapt to my image"): walls and limits are re-applied
      setSurface: (itemId, slot, patch) =>
        set((s) => ({
          items: constrainItems(
            s.items.map((it) =>
              it.id === itemId
                ? { ...it, sample: false, surfaces: { ...it.surfaces, [slot]: { ...(it.surfaces[slot] ?? DEFAULT_SURFACE), ...patch } } }
                : it,
            ),
            s.decor,
          ),
        })),
      // walls, the table's wall and the studio cyclo all show the background
      setBackground: (background) => set({ background }),
      setDecor: (patch) =>
        set((s) => {
          const decor = { ...s.decor, ...patch };
          return { decor, items: constrainItems(s.items, decor) };
        }),
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
          // the first pick replaces the sample phone a new project starts with, if it was left untouched
          if (isUntouchedSample(s.items)) {
            if (position) item.position = position;
            return { items: constrainItems([item], s.decor), selectedId: item.id };
          }
          item.position = position ?? besideOthers(s.items, getModel(modelId).size[0]);
          // A new device starts with the image of the selected one when the screens look alike.
          const selected = s.items.find((it) => it.id === s.selectedId);
          const source = selected && Object.values(selected.surfaces).find((b) => b.assetId);
          const slot = getModel(modelId).surfaces[0];
          const sourceSlot = selected && getModel(selected.modelId).surfaces[0];
          if (source && slot && sourceSlot && (slot.aspect < 1) === (sourceSlot.aspect < 1)) item.surfaces[slot.id] = { ...source };
          return { items: constrainItems([...s.items, item], s.decor), selectedId: item.id };
        }),
      duplicateItem: (id) =>
        set((s) => {
          const src = s.items.find((it) => it.id === id);
          if (!src) return {};
          const w = getModel(src.modelId).size[0];
          const copy: SceneItem = structuredClone(src);
          copy.id = uid();
          copy.position = [src.position[0] + w * 0.7 + 4, src.position[1], src.position[2] + 4];
          return { items: constrainItems([...s.items, copy], s.decor), selectedId: copy.id };
        }),
      removeItem: (id) =>
        set((s) => {
          if (s.items.length <= 1) return {};
          const items = constrainItems(s.items.filter((it) => it.id !== id), s.decor);
          return { items, selectedId: s.selectedId === id ? items[items.length - 1].id : s.selectedId };
        }),
      arrange: () => set((s) => ({ items: constrainItems(arrangeItems(s.items), s.decor) })),
      addOverlay: (overlay) => set((s) => ({ overlays: [...s.overlays, overlay] })),
      updateOverlay: (id, patch) =>
        set((s) => ({ overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)) })),
      removeOverlay: (id) => set((s) => ({ overlays: s.overlays.filter((o) => o.id !== id) })),
      loadProject: (project) => set({ ...project }),
      resetScene: () => {
        breakBurst();
        set((s) => {
          const fresh = initialProject();
          const items = s.items.map((it) => ({ ...it, pose: 'standing' as const, scale: 1, rotation: [0, getModel(it.modelId).yaw ?? -0.32, 0] as Vec3 }));
          return {
            background: fresh.background,
            decor: fresh.decor,
            lighting: fresh.lighting,
            camera: fresh.camera,
            ground: fresh.ground,
            overlays: [],
            items: constrainItems(items.length > 1 ? arrangeItems(items) : items.map((it) => ({ ...it, position: [0, 0, 0] as Vec3 })), fresh.decor),
          };
        });
      },
      resetAll: () => {
        breakBurst();
        set((s) => ({ ...initialProject(), mode: s.mode }));
      },
      resetPhoto: () => {
        breakBurst();
        set({ photo: structuredClone(EMPTY_PHOTO) });
      },
      setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
      setParam: (itemId, id, value) =>
        set((s) => ({
          items: constrainItems(
            s.items.map((it) => (it.id === itemId ? { ...it, params: { ...it.params, [id]: value } } : it)),
            s.decor,
          ),
        })),
      replaceModel: (itemId, modelId) => {
        breakBurst();
        set((s) => ({
          items: constrainItems(
            s.items.map((it) => {
              if (it.id !== itemId) return it;
              const model = getModel(modelId);
              // The user's own images follow the device; bundled samples don't (they are swapped for matching ones).
              const assets = useAssets.getState().assets;
              const mine = (b: SurfaceBinding | undefined) => !!b?.assetId && !assets[b.assetId]?.name.startsWith('sample-');
              const own = Object.values(it.surfaces).filter(mine);
              const surfaces = Object.fromEntries(
                model.surfaces.map((slot, i) => {
                  const fit = slot.fit ?? 'cover';
                  const same = it.surfaces[slot.id];
                  if (mine(same)) return [slot.id, { ...same!, fit }];
                  if (own[i]) return [slot.id, { ...own[i], fit, align: slot.fit ? 0.5 : own[i].align }];
                  return [slot.id, { ...DEFAULT_SURFACE, fit, align: slot.fit ? 0.5 : 0 }];
                }),
              );
              return {
                ...it,
                modelId,
                sample: false,
                finishId: model.finishes.some((f) => f.id === it.finishId) ? it.finishId : model.defaultFinish,
                params: defaultParams(model),
                surfaces,
                position: [it.position[0], 0, it.position[2]] as Vec3,
                rotation: [0, model.yaw ?? -0.32, 0] as Vec3,
              };
            }),
            s.decor,
          ),
        }));
      },
      setMode: (mode) => {
        breakBurst();
        set({ mode });
      },
      setPhoto: (assetId, templateId, zones) => {
        breakBurst();
        set((s) => {
          const prev = s.photo.zones;
          const next = zones.map((z, i) => (prev[i]?.surface.assetId ? { ...z, surface: { ...prev[i].surface } } : z));
          return { photo: { assetId, templateId, zones: next, selectedZoneId: next[0]?.id ?? null } };
        });
      },
      addZone: (zone) => {
        breakBurst();
        set((s) => ({ photo: { ...s.photo, zones: [...s.photo.zones, zone], selectedZoneId: zone.id } }));
      },
      updateZone: (id, patch) =>
        set((s) => ({
          photo: { ...s.photo, zones: s.photo.zones.map((z) => (z.id === id ? { ...z, ...(typeof patch === 'function' ? patch(z) : patch) } : z)) },
        })),
      setZoneSurface: (id, patch) =>
        set((s) => ({
          photo: { ...s.photo, zones: s.photo.zones.map((z) => (z.id === id ? { ...z, surface: { ...z.surface, ...patch } } : z)) },
        })),
      removeZone: (id) => {
        breakBurst();
        set((s) => {
          const zones = s.photo.zones.filter((z) => z.id !== id);
          return { photo: { ...s.photo, zones, selectedZoneId: s.photo.selectedZoneId === id ? (zones[zones.length - 1]?.id ?? null) : s.photo.selectedZoneId } };
        });
      },
      selectZone: (id) => set((s) => ({ photo: { ...s.photo, selectedZoneId: id } })),
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
