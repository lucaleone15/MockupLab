import { loadImage, useAssets } from '@/store/assets';
import type { PhotoZone } from '@/store/project';
import type { Pixels } from './detect';
import { zoneStats, type ZoneStats } from './stats';

/** Decoded pixels of an asset at a bounded size (analysis only), cached per asset and size. */
const pixelCache = new Map<string, Promise<Pixels>>();
export function assetPixels(assetId: string, maxSide: number): Promise<Pixels> {
  const key = `${assetId}:${maxSide}`;
  let p = pixelCache.get(key);
  if (!p) {
    p = (async () => {
      const asset = useAssets.getState().assets[assetId];
      if (!asset) throw new Error('missing asset');
      const img = await loadImage(asset.url);
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      // halve step by step: each step averages 2×2 pixels, so fine texture and JPEG noise
      // do not alias into false detail (a single large downscale skips pixels)
      let src: CanvasImageSource = img;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      while (sw / 2 >= w * 1.0001 && sh / 2 >= h) {
        const half = document.createElement('canvas');
        half.width = Math.max(w, Math.round(sw / 2));
        half.height = Math.max(h, Math.round(sh / 2));
        const hc = half.getContext('2d')!;
        hc.imageSmoothingQuality = 'high';
        hc.drawImage(src, 0, 0, half.width, half.height);
        src = half;
        sw = half.width;
        sh = half.height;
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, w, h);
      return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
    })();
    pixelCache.set(key, p);
  }
  return p;
}

const statsCache = new Map<string, ZoneStats>();
/** Photo statistics under a zone (cached by photo and corners). */
export async function statsFor(photoId: string, zone: PhotoZone): Promise<ZoneStats> {
  const key = `${photoId}:${zone.corners.flat().map((v) => v.toFixed(4)).join(',')}`;
  const hit = statsCache.get(key);
  if (hit) return hit;
  const px = await assetPixels(photoId, 640);
  const s = zoneStats(px, zone.corners);
  if (statsCache.size > 200) statsCache.clear();
  statsCache.set(key, s);
  return s;
}
