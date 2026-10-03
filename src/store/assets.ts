import * as THREE from 'three';
import { create } from 'zustand';

/**
 * User images. Kept outside the undoable project store: history only stores
 * asset ids, the pixels live here (and, from milestone d, in IndexedDB).
 */
export interface Asset {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  blob: Blob;
}

interface AssetState {
  assets: Record<string, Asset>;
  add: (asset: Asset) => void;
}

export const useAssets = create<AssetState>((set) => ({
  assets: {},
  add: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),
}));

/* ------------------------------------------------------------ textures */

const textures = new Map<string, THREE.Texture>();
let maxAnisotropy = 8;
let maxTextureSize = 8192;

export function configureTextureLimits(anisotropy: number, textureSize: number) {
  maxAnisotropy = anisotropy;
  maxTextureSize = textureSize;
}
export const getMaxTextureSize = () => maxTextureSize;

export function prepareTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Base texture of an asset, created lazily and shared (clones share the GPU upload). */
export function assetTexture(asset: Asset, image: HTMLImageElement | HTMLCanvasElement): THREE.Texture {
  let tex = textures.get(asset.id);
  if (!tex) {
    tex = prepareTexture(new THREE.Texture(image));
    textures.set(asset.id, tex);
  }
  return tex;
}

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}
