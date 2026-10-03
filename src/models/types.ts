import type { FC } from 'react';
import type { I18nString } from '@/i18n';
import type { SurfaceBinding, ScreenSettings } from '@/store/project';

export type DeviceCategory = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'browser' | 'wearable' | 'print' | 'merch';

/** A surface that receives a user image (a screen, a printed face…). */
export interface SurfaceSlot {
  id: string;
  label: I18nString;
  /** Width / height of the visible surface. */
  aspect: number;
  /** Suggested pixel size for exported designs (shown to the user). */
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

export interface DeviceProps {
  finish: DeviceFinish;
  surfaces: Record<string, SurfaceBinding>;
  screen: ScreenSettings;
  params: Record<string, number | string | boolean>;
}

/**
 * Contract every model module implements. Adding a device means creating a
 * folder under `src/models/`, exporting a `DeviceModule`, and listing it in
 * `registry.ts`.
 */
export interface DeviceModule {
  id: string;
  name: I18nString;
  category: DeviceCategory;
  /** Bounding box in centimetres (1 scene unit = 1 cm): width, height, depth. */
  size: [number, number, number];
  surfaces: SurfaceSlot[];
  finishes: DeviceFinish[];
  defaultFinish: string;
  Component: FC<DeviceProps>;
}
