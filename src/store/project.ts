import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Fit } from '@/scene/screenMaterial';
import { getModel } from '@/models/registry';
import { defaultParams, type DeviceModule, type ParamValue } from '@/models/types';
import { LIGHT_PRESETS } from '@/scene/lighting/presets';
import { arrangeItems, besideOthers, constrainItems, layoutItems, type Layout } from '@/lib/arrange';
import { useAssets } from './assets';
import { DEFAULT_SOCIAL, type SocialView } from '@/social/networks';

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
/** Social formats have an exact pixel size. */
export type SocialPreset = 'ig-post' | 'ig-square' | 'story' | 'youtube' | 'linkedin' | 'pinterest';
/** An Instagram carousel: N slides of 4:5 or 1:1 side by side. */
export type RatioPreset = '16:9' | '4:3' | '1:1' | '4:5' | '9:16' | '3:2' | 'a4' | SocialPreset;

export type AnimationId = 'reveal' | 'dive' | 'dutch' | 'flip' | 'drop' | 'crane' | 'vertigo' | 'trailer' | 'turntable' | 'swing' | 'orbit' | 'scroll' | 'float';

export interface VideoSettings {
  animation: AnimationId;
  /** Seconds. */
  duration: number;
  fps: 24 | 30 | 60;
  resolution: '720' | '1080' | '4k';
  format: 'mp4' | 'webm' | 'gif';
  /** Shots that do not loop by themselves come back to their start (ping-pong). */
  loop?: boolean;
  /** 'cinema': motion blur (several instants per frame) and animated depth of field. */
  quality: 'fast' | 'cinema';
}

export interface ExportSettings {
  video: VideoSettings;
  format: ImageFormat;
  resolution: ResolutionPreset;
  ratio: RatioPreset;
  /** 0..1, JPG/WebP only. */
  quality: number;
}

export interface Project {
  version: 6;
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
  /** How the devices are laid out; every added or removed device lays them out again. */
  arrangement: Layout;
  /** “Voir sur…”: the network interface shown around the scene. */
  social: SocialView;
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

/** Families whose devices stand in for one another in a ready-made scene (any phone for a phone…). */
const SCREEN_FAMILIES = ['phone', 'tablet', 'laptop', 'desktop', 'wearable', 'browser'];

/** The devices laid out the scene's way. */
function laidOut(items: SceneItem[], s: Pick<Project, 'arrangement' | 'decor'>) {
  return constrainItems(layoutItems(items, s.arrangement), s.decor);
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
  kind: 'sweep',
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
    export: { video: { ...DEFAULT_VIDEO }, format: 'png', resolution: '4k', ratio: '16:9', quality: 0.92 },
    arrangement: 'auto',
    social: { ...DEFAULT_SOCIAL },
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
  /** Adds a device and lays the scene out again (or puts it at `position`, where it was dropped); selects it. */
  addItem: (modelId: string, position?: Vec3) => void;
  duplicateItem: (id: string) => void;
  /** Removes a device, even the last one (the scene is then empty). */
  removeItem: (id: string) => void;
  /** Lays out every device, in `layout` (which becomes the scene's) or the scene's own. */
  arrange: (layout?: Layout) => void;
  /**
   * A ready-made scene: these devices in this layout. Devices of the same kind
   * already in the scene are kept (model, finish, images); new ones take the
   * image of the first kept one of their kind.
   */
  setComposition: (modelIds: string[], layout: Layout) => void;
  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  /** Replaces the whole project (load, import, new). */
  loadProject: (project: Project) => void;
  /** Background, set, light, camera, floor and text layers back to defaults; devices and images are kept. */
  resetScene: () => void;
  /** Everything back to a fresh project (undoable). */
  resetAll: () => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  setSocial: (patch: Partial<SocialView>) => void;
  setParam: (itemId: string, id: string, value: ParamValue) => void;
  /** Swaps the device of an item, keeping its images and placement. */
  replaceModel: (itemId: string, modelId: string) => void;
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
  arrangement: s.arrangement,
  social: s.social,
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
          const items = [...s.items, item];
          // dropped somewhere: it stays there; otherwise the whole scene is laid out again
          return { items: position ? constrainItems(items, s.decor) : laidOut(items, s), selectedId: item.id };
        }),
      duplicateItem: (id) =>
        set((s) => {
          const src = s.items.find((it) => it.id === id);
          if (!src) return {};
          const w = getModel(src.modelId).size[0];
          const copy: SceneItem = structuredClone(src);
          copy.id = uid();
          copy.position = [src.position[0] + w * 0.7 + 4, src.position[1], src.position[2] + 4];
          return { items: laidOut([...s.items, copy], s), selectedId: copy.id };
        }),
      removeItem: (id) =>
        set((s) => {
          const rest = s.items.filter((it) => it.id !== id);
          const items = rest.length ? laidOut(rest, s) : [];
          return { items, selectedId: s.selectedId === id ? (items[items.length - 1]?.id ?? null) : s.selectedId };
        }),
      arrange: (layout) =>
        set((s) => {
          const arrangement = layout ?? s.arrangement;
          return { arrangement, items: laidOut(s.items, { ...s, arrangement }) };
        }),
      setComposition: (modelIds, layout) => {
        breakBurst();
        set((s) => {
          const pool = [...s.items];
          // what each slot of the composition asked for, and the device that fills it
          const kept: { asked: string; item: SceneItem }[] = [];
          const items = modelIds.map((modelId) => {
            const category = getModel(modelId).category;
            // a screen device of the scene fills a slot of its family (the user's phone stays their phone);
            // prints and objects only fill a slot of their own model (a flyer is not a poster)
            const fits = (it: SceneItem) => it.modelId === modelId || (SCREEN_FAMILIES.includes(category) && getModel(it.modelId).category === category);
            const i = pool.findIndex(fits);
            if (i >= 0) {
              const [it] = pool.splice(i, 1);
              kept.push({ asked: modelId, item: it });
              return { ...it, visible: true, pose: 'standing' as const, scale: 1 };
            }
            // another slot asking for the same model takes the same device as the first one (model, finish, images)
            const sibling = kept.find((k) => k.asked === modelId)?.item;
            const item = makeItem(getModel(sibling?.modelId ?? modelId));
            if (sibling) {
              item.finishId = sibling.finishId;
              item.surfaces = structuredClone(sibling.surfaces);
            }
            kept.push({ asked: modelId, item });
            return item;
          });
          // a kept device without an image takes the first image of its kind, so every screen starts filled
          const filled = items.map((it) => {
            if (Object.values(it.surfaces).some((b) => b.assetId)) return it;
            const source = items.find((o) => o.modelId === it.modelId && Object.values(o.surfaces).some((b) => b.assetId));
            return source ? { ...it, surfaces: structuredClone(source.surfaces) } : it;
          });
          return { arrangement: layout, items: laidOut(filled, { ...s, arrangement: layout }), selectedId: filled[0]?.id ?? null };
        });
      },
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
        set(initialProject());
      },
      setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
      setSocial: (patch) => set((s) => ({ social: { ...s.social, ...patch } })),
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
        // a device of another size takes its own room: the scene is laid out again
        set((s) => (s.items.length > 1 ? { items: laidOut(s.items, s) } : {}));
      },
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
