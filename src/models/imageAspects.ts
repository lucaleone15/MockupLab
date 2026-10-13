import { useAssets } from '@/store/assets';
import type { SurfaceBinding } from '@/store/project';
import type { ImageAspects } from './types';

/** Width / height of the images placed on an item's surfaces (slot id → ratio). */
export function aspectsOf(surfaces: Record<string, SurfaceBinding> | undefined, assets = useAssets.getState().assets): ImageAspects {
  const out: ImageAspects = {};
  for (const [slot, b] of Object.entries(surfaces ?? {})) {
    const a = b?.assetId ? assets[b.assetId] : undefined;
    if (a?.width && a.height) out[slot] = a.width / a.height;
  }
  return out;
}

/** Same, inside a component: follows the images as they change. */
export function useImageAspects(surfaces: Record<string, SurfaceBinding>): ImageAspects {
  const assets = useAssets((s) => s.assets);
  return aspectsOf(surfaces, assets);
}
