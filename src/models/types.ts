import type { FC } from 'react';
import type { I18nString } from '@/i18n';
import type { ScreenSettings, SurfaceBinding } from '@/store/project';

export type DeviceCategory = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'browser' | 'wearable' | 'print' | 'merch';

/** A surface that receives a user image (a screen, a printed face…). */
export interface SurfaceSlot {
  id: string;
  label: I18nString;
  /** Width / height of the visible surface, in its upright (portrait for phones) orientation. */
  aspect: number;
  /** Suggested pixel size for designs (shown to the user). */
  nativeSize?: [number, number];
}

export interface DeviceFinish {
  id: string;
  name: I18nString;
  /** Swatch colour shown in the UI. */
  swatch: string;
  /** Free-form colours consumed by the model component. */
  colors: Record<string, string>;
}

export type ParamValue = number | string | boolean;

/** User-tweakable model parameter, rendered automatically in the properties panel. */
export type ParamDef =
  | { id: string; kind: 'slider'; label: I18nString; min: number; max: number; step: number; default: number; unit?: string }
  | { id: string; kind: 'toggle'; label: I18nString; default: boolean }
  | { id: string; kind: 'choice'; label: I18nString; options: { value: string; label: I18nString }[]; default: string }
  | { id: string; kind: 'text'; label: I18nString; default: string; placeholder?: string };

/** Shared parameter: rotates the device 90° and maps landscape images upright. */
export const ORIENTATION_PARAM = {
  id: 'orientation',
  kind: 'choice' as const,
  label: { fr: 'Orientation', en: 'Orientation' },
  options: [
    { value: 'portrait', label: { fr: 'Portrait', en: 'Portrait' } },
    { value: 'landscape', label: { fr: 'Paysage', en: 'Landscape' } },
  ],
  default: 'portrait',
} satisfies ParamDef;

export const isLandscape = (params: Record<string, ParamValue>) => params.orientation === 'landscape';

/** Camera framing used when the model is selected or the view is reset. */
export interface ViewSpec {
  /** Look-at point, relative to the device's ground anchor. */
  target: [number, number, number];
  /** Camera offset from the target. */
  offset: [number, number, number];
}

export interface DeviceProps {
  finish: DeviceFinish;
  surfaces: Record<string, SurfaceBinding>;
  screen: ScreenSettings;
  params: Record<string, ParamValue>;
}

/**
 * Contract every model module implements. Adding a device means creating a
 * folder under `src/models/`, exporting a `DeviceModule`, and listing it in
 * `registry.ts`.
 *
 * Conventions: 1 scene unit = 1 cm; the screen faces +Z; up is +Y.
 * `anchor: 'center'` models are centred on their origin (the stage lifts them
 * so they rest on the floor); `anchor: 'bottom'` models already sit on y = 0.
 */
export interface DeviceModule {
  id: string;
  name: I18nString;
  category: DeviceCategory;
  /** Bounding box in centimetres: width, height, depth (upright orientation). */
  size: [number, number, number];
  anchor?: 'center' | 'bottom';
  surfaces: SurfaceSlot[];
  finishes: DeviceFinish[];
  defaultFinish: string;
  params?: ParamDef[];
  view: ViewSpec;
  /**
   * Point kept sharp with depth of field — the screen — relative to the ground
   * anchor (bottom-anchored models). Upright devices focus on their centre.
   */
  focus?: [number, number, number];
  /** Default yaw (radians) when the device is added. */
  yaw?: number;
  Component: FC<DeviceProps>;
}

export function defaultParams(model: DeviceModule): Record<string, ParamValue> {
  return Object.fromEntries((model.params ?? []).map((p) => [p.id, p.default]));
}
