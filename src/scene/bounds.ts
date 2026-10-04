import { useMemo } from 'react';
import * as THREE from 'three';
import { footprint } from '@/lib/arrange';
import { getModel } from '@/models/registry';
import { sizeOf } from '@/models/types';
import { useProject } from '@/store/project';
import { decorLayout } from './Decor';

/**
 * Centre and radius of the composition (devices may hang on a wall or stand
 * on a podium): the key light and its shadow map follow it, so tall or high
 * objects (posters, banners, desktops) always receive and cast shadows.
 */
export function useCompositionBounds() {
  const items = useProject((s) => s.items);
  const decor = useProject((s) => s.decor);
  return useMemo(() => {
    const floorY = decorLayout(decor, items).floorY;
    const box = new THREE.Box3();
    for (const it of items) {
      const f = footprint(it);
      const { y0 } = sizeOf(getModel(it.modelId), it.params);
      const r = Math.hypot(f.w, f.d) / 2;
      box.expandByPoint(new THREE.Vector3(it.position[0] - r, floorY + y0, it.position[2] - r));
      box.expandByPoint(new THREE.Vector3(it.position[0] + r, floorY + y0 + f.h, it.position[2] + r));
    }
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(40, box.getSize(new THREE.Vector3()).length() / 2);
    return { center, radius };
  }, [items, decor]);
}
