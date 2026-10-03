import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { I18nString } from '@/i18n';
import type { MaterialId } from '@/store/project';

/*
 * Photographed PBR materials (CC0, Poly Haven / ambientCG), bundled in
 * public/assets/materials/<id>/ as colour (2K), normal and roughness maps.
 * `size` is the real-world width covered by one texture tile, in cm, so a
 * table and a podium show the grain at the same, believable scale.
 */

export interface RealMaterialSpec {
  name: I18nString;
  size: number;
  roughness: number;
  normalScale: number;
  /** Polished / lacquered finish. */
  clearcoat: number;
  clearcoatRoughness: number;
  sheen?: number;
  /** Dielectric reflectance multiplier (1 = default 4 %). */
  specular?: number;
}

export const REAL_MATERIALS: Record<MaterialId, RealMaterialSpec> = {
  // Polished stone: a light, slightly soft gloss — not a mirror.
  'marble-white': { name: { fr: 'Marbre blanc', en: 'White marble' }, size: 170, roughness: 0.7, normalScale: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.22 },
  'marble-black': { name: { fr: 'Marbre noir', en: 'Black marble' }, size: 180, roughness: 0.7, normalScale: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.18 },
  // Honed / matte surfaces: no varnish layer at all.
  travertine: { name: { fr: 'Travertin', en: 'Travertine' }, size: 110, roughness: 1, normalScale: 0.6, clearcoat: 0, clearcoatRoughness: 0 },
  terrazzo: { name: { fr: 'Terrazzo', en: 'Terrazzo' }, size: 20, roughness: 0.9, normalScale: 0.4, clearcoat: 0.12, clearcoatRoughness: 0.35 },
  concrete: { name: { fr: 'Béton ciré', en: 'Polished concrete' }, size: 160, roughness: 1, normalScale: 0.8, clearcoat: 0, clearcoatRoughness: 0 },
  linen: { name: { fr: 'Lin', en: 'Linen' }, size: 32, roughness: 1, normalScale: 1, clearcoat: 0, clearcoatRoughness: 0, sheen: 0.6 },
  // Oiled wood: matte, a faint sheen only at grazing angles.
  oak: { name: { fr: 'Chêne', en: 'Oak' }, size: 100, roughness: 1, normalScale: 0.5, clearcoat: 0, clearcoatRoughness: 0, specular: 0.45 },
  walnut: { name: { fr: 'Noyer', en: 'Walnut' }, size: 180, roughness: 1, normalScale: 0.5, clearcoat: 0, clearcoatRoughness: 0, specular: 0.45 },
};

export const MATERIAL_ORDER: MaterialId[] = ['oak', 'walnut', 'marble-white', 'marble-black', 'travertine', 'terrazzo', 'concrete', 'linen'];

export const materialUrl = (id: MaterialId, file: 'color' | 'normal' | 'rough' | 'thumb') =>
  `${import.meta.env.BASE_URL}assets/materials/${id}/${file}.jpg`;

const loader = new THREE.TextureLoader();
const cache = new Map<string, Promise<THREE.Texture>>();

export function loadMaterialMap(id: MaterialId, file: 'color' | 'normal' | 'rough') {
  return load(materialUrl(id, file), file === 'color');
}

function load(url: string, color: boolean): Promise<THREE.Texture> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((t) => {
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    });
    cache.set(url, p);
  }
  return p;
}

/**
 * A physical material for a surface of sizeX × sizeY cm. Starts as a neutral
 * placeholder and receives its maps once loaded. `alphaMap` (optional) fades
 * the surface into the background.
 */
export function useRealMaterial(id: MaterialId, sizeX: number, sizeY: number, alphaMap?: THREE.Texture | null) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#8a8580', roughness: 0.9 }), []);

  useEffect(() => {
    const spec = REAL_MATERIALS[id];
    material.roughness = spec.roughness;
    material.clearcoat = spec.clearcoat;
    material.clearcoatRoughness = spec.clearcoatRoughness;
    material.sheen = spec.sheen ?? 0;
    material.specularIntensity = spec.specular ?? 1;
    material.sheenRoughness = 0.8;
    material.sheenColor.set('#ffffff');
    material.normalScale.set(spec.normalScale, spec.normalScale);
    if (alphaMap) {
      material.alphaMap = alphaMap;
      material.transparent = true;
      material.depthWrite = false;
    }
    let alive = true;
    const clones: THREE.Texture[] = [];
    Promise.all([load(materialUrl(id, 'color'), true), load(materialUrl(id, 'normal'), false), load(materialUrl(id, 'rough'), false)])
      .then(([c, n, r]) => {
        if (!alive) return;
        const repeat = (t: THREE.Texture) => {
          const k = t.clone();
          k.repeat.set(sizeX / spec.size, sizeY / spec.size);
          k.needsUpdate = true;
          clones.push(k);
          return k;
        };
        material.color.set('#ffffff');
        material.map = repeat(c);
        material.normalMap = repeat(n);
        material.roughnessMap = repeat(r);
        material.needsUpdate = true;
        invalidate();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      clones.forEach((t) => t.dispose());
    };
  }, [id, sizeX, sizeY, alphaMap, material, invalidate]);

  useEffect(() => () => material.dispose(), [material]);
  return material;
}
