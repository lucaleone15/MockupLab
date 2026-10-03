import { create } from 'zustand';
import { temporal } from 'zundo';
import type { Fit } from '@/scene/screenMaterial';

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
  params: Record<string, number | string | boolean>;
  surfaces: Record<string, SurfaceBinding>;
  screen: ScreenSettings;
  position: Vec3;
  rotation: Vec3;
  scale: number;
}

export interface GradientStop {
  color: string;
  /** 0..1 */
  at: number;
}

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; type: 'linear' | 'radial'; angle: number; stops: GradientStop[] }
  | { kind: 'transparent' };

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
  version: 1;
  name: string;
  items: SceneItem[];
  selectedId: string | null;
  background: Background;
  export: ExportSettings;
}

/* -------------------------------------------------------------- defaults */

export const DEFAULT_SURFACE: SurfaceBinding = { assetId: null, fit: 'cover', align: 0 };
export const DEFAULT_SCREEN: ScreenSettings = { brightness: 1, reflection: 0.5 };

const uid = () => Math.random().toString(36).slice(2, 10);

export function makeItem(modelId: string, finishId: string, size: Vec3): SceneItem {
  return {
    id: uid(),
    modelId,
    finishId,
    params: {},
    surfaces: { screen: { ...DEFAULT_SURFACE } },
    screen: { ...DEFAULT_SCREEN },
    position: [0, size[1] / 2, 0],
    rotation: [0, -0.32, 0],
    scale: 1,
  };
}

function initialProject(): Project {
  const item = makeItem('phone-pro', 'natural', [7.06, 14.66, 0.83]);
  return {
    version: 1,
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
    export: { format: 'png', resolution: '4k', ratio: '16:9', quality: 0.92 },
  };
}

/* ----------------------------------------------------------------- store */

interface ProjectActions {
  updateItem: (id: string, patch: Partial<SceneItem> | ((item: SceneItem) => Partial<SceneItem>)) => void;
  setSurface: (itemId: string, slot: string, patch: Partial<SurfaceBinding>) => void;
  setBackground: (bg: Background) => void;
  setExport: (patch: Partial<ExportSettings>) => void;
  replaceModel: (itemId: string, modelId: string, finishId: string, size: Vec3) => void;
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
      setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
      replaceModel: (itemId, modelId, finishId, size) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, modelId, finishId, params: {}, position: [it.position[0], size[1] / 2, it.position[2]] }
              : it,
          ),
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
