import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { assetTexture, loadImage, prepareTexture, useAssets } from '@/store/assets';
import type { ScreenSettings, SurfaceBinding } from '@/store/project';
import { createScreenMaterial, fitTexture } from './screenMaterial';

let placeholder: THREE.Texture | null = null;

/** Abstract wallpaper shown on screens until the user adds an image. */
export function placeholderTexture(): THREE.Texture {
  if (placeholder) return placeholder;
  const w = 1179;
  const h = 2556;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, color: string) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  };
  blob(w * 0.15, h * 0.18, w * 1.1, 'rgba(255,92,53,0.95)');
  blob(w * 0.95, h * 0.45, w * 1.0, 'rgba(120,70,255,0.85)');
  blob(w * 0.3, h * 0.95, w * 1.2, 'rgba(20,160,255,0.75)');
  blob(w * 0.75, h * 0.05, w * 0.6, 'rgba(255,200,120,0.6)');
  // fine grain so the gradient does not band
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  placeholder = prepareTexture(new THREE.CanvasTexture(c));
  return placeholder;
}

/**
 * Screen material bound to a surface: resolves the asset's texture, fits it to
 * the surface aspect and applies the screen settings.
 */
export function useScreenMaterial(binding: SurfaceBinding | undefined, surfaceAspect: number, screen: ScreenSettings) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => createScreenMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  const asset = useAssets((s) => (binding?.assetId ? s.assets[binding.assetId] : undefined));
  // The decoded image is tagged with its URL: right after the asset changes,
  // state still holds the previous image for one render, and it must never be
  // used (or cached) for the new asset.
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!asset) return;
    let alive = true;
    loadImage(asset.url)
      .then((img) => alive && setLoaded({ url: asset.url, img }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [asset]);
  const image = asset && loaded?.url === asset.url ? loaded.img : null;

  const fit = binding?.fit ?? 'cover';
  const align = binding?.align ?? 0;
  useEffect(() => {
    const ready = asset && image;
    const base = ready ? assetTexture(asset, image) : placeholderTexture();
    const tex = base.clone();
    tex.needsUpdate = true;
    const imageAspect = ready ? asset.width / asset.height : surfaceAspect;
    fitTexture(tex, imageAspect, surfaceAspect, fit, align);
    const hadMap = !!material.emissiveMap;
    material.emissiveMap = tex;
    if (!hadMap) material.needsUpdate = true;
    invalidate();
    return () => tex.dispose();
  }, [asset, image, fit, align, surfaceAspect, material, invalidate]);

  useEffect(() => {
    material.emissiveIntensity = screen.brightness;
    // 0.5 ≈ physically plain glass; the slider goes from none to glossy.
    material.specularIntensity = screen.reflection * 2;
    material.envMapIntensity = 0.4 + screen.reflection * 1.2;
    invalidate();
  }, [screen.brightness, screen.reflection, material, invalidate]);

  return material;
}
