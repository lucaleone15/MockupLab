import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { assetTexture, prepareTexture } from '@/store/assets';
import type { SurfaceBinding } from '@/store/project';
import { loadMaterialMap } from '@/scene/realMaterials';
import { fitTexture } from '@/scene/screenMaterial';
import { useSurfaceImage } from '@/scene/useScreenMaterial';
import type { ParamDef } from '../types';

/*
 * Shared pieces for printed objects. Unlike screens, prints are lit like any
 * other surface: the design is the diffuse colour of a paper, card, ceramic or
 * fabric material, so it reacts to light and shadows the way a real print does.
 */

export type PaperFinish = 'matte' | 'satin' | 'gloss';

export const PAPER_PARAM: ParamDef = {
  id: 'paper',
  kind: 'choice',
  label: { fr: 'Finition', en: 'Finish' },
  options: [
    { value: 'matte', label: { fr: 'Mate', en: 'Matte' } },
    { value: 'satin', label: { fr: 'Satinée', en: 'Satin' } },
    { value: 'gloss', label: { fr: 'Brillante', en: 'Gloss' } },
  ],
  default: 'matte',
  advanced: true,
};

export const finishOf = (params: Record<string, unknown>): PaperFinish =>
  params.paper === 'gloss' || params.paper === 'satin' ? params.paper : 'matte';

const FINISHES: Record<PaperFinish, { roughness: number; clearcoat: number; clearcoatRoughness: number; sheen: number }> = {
  matte: { roughness: 0.92, clearcoat: 0, clearcoatRoughness: 0, sheen: 0.25 },
  satin: { roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.35, sheen: 0.1 },
  gloss: { roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0 },
};

/* ------------------------------------------------------------ placeholder */

let placeholder: THREE.Texture | null = null;

/** Neutral "design goes here" paper: soft colour field and suggested text lines. */
export function printPlaceholder(): THREE.Texture {
  if (placeholder) return placeholder;
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3f0ea';
  g.fillRect(0, 0, S, S);
  const grd = g.createRadialGradient(S * 0.72, S * 0.3, 0, S * 0.72, S * 0.3, S * 0.55);
  grd.addColorStop(0, 'rgba(255,120,80,0.55)');
  grd.addColorStop(1, 'rgba(255,120,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(30,28,26,0.75)';
  g.fillRect(S * 0.1, S * 0.62, S * 0.5, S * 0.05);
  g.fillStyle = 'rgba(30,28,26,0.28)';
  for (let i = 0; i < 3; i++) g.fillRect(S * 0.1, S * (0.72 + i * 0.045), S * (0.62 - i * 0.12), S * 0.018);
  placeholder = prepareTexture(new THREE.CanvasTexture(c));
  return placeholder;
}

/* ------------------------------------------------------------ materials */

/**
 * Printed material bound to a surface. In "contain" mode the area around the
 * image shows the paper colour instead of stretched edge pixels.
 */
export function usePrintMaterial(
  binding: SurfaceBinding | undefined,
  surfaceAspect: number,
  { finish = 'matte', paper = '#f7f5f0', rotated = false, base = 'paper' }: { finish?: PaperFinish; paper?: string; rotated?: boolean; base?: 'paper' | 'ceramic' } = {},
) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(() => {
    const uPaper = { value: new THREE.Color(paper) };
    const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.8 });
    m.userData.uPaper = uPaper;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uPaper = uPaper;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uPaper;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
#ifdef USE_MAP
  // transparent parts of a design show the stock (paper, ceramic…) underneath
  diffuseColor.rgb = mix(uPaper, diffuseColor.rgb, diffuseColor.a);
  diffuseColor.a = 1.0;
  if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) diffuseColor.rgb = uPaper;
#endif`,
        );
    };
    m.customProgramCacheKey = () => 'mockuplab-print-v2';
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const f = FINISHES[finish];
    material.roughness = base === 'ceramic' ? 0.18 : f.roughness;
    material.clearcoat = base === 'ceramic' ? 1 : f.clearcoat;
    material.clearcoatRoughness = base === 'ceramic' ? 0.04 : f.clearcoatRoughness;
    material.sheen = base === 'ceramic' ? 0 : f.sheen;
    (material.userData.uPaper.value as THREE.Color).set(paper);
    invalidate();
  }, [finish, paper, base, material, invalidate]);

  const { asset, image } = useSurfaceImage(binding);
  const fit = binding?.fit ?? 'cover';
  const align = binding?.align ?? 0.5;
  useEffect(() => {
    const ready = asset && image;
    const tex = (ready ? assetTexture(asset, image) : printPlaceholder()).clone();
    tex.needsUpdate = true;
    const imageAspect = ready ? asset.width / asset.height : rotated ? 1 / surfaceAspect : surfaceAspect;
    fitTexture(tex, imageAspect, surfaceAspect, fit, align, rotated);
    const hadMap = !!material.map;
    material.map = tex;
    if (!hadMap) material.needsUpdate = true;
    invalidate();
    return () => tex.dispose();
  }, [asset, image, fit, align, surfaceAspect, rotated, material, invalidate]);

  return material;
}

const plain = new Map<string, THREE.MeshPhysicalMaterial>();

/** Unprinted paper / card stock (edges, page blocks, backs). */
export function paperMaterial(color = '#f4f2ec', roughness = 0.9) {
  const key = `${color}:${roughness}`;
  let m = plain.get(key);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') });
    plain.set(key, m);
  }
  return m;
}

/** Woven fabric: matte with sheen at grazing angles and a real linen weave normal map. */
export function useFabricMaterial(map: THREE.Texture | null, tiling: number, { color = '#ffffff', cutout = false }: { color?: string; cutout?: boolean } = {}) {
  const invalidate = useThree((s) => s.invalidate);
  const material = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 1, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide }),
    [],
  );
  useEffect(() => {
    material.map = map;
    // Garments are cut out of their texture by the silhouette's alpha.
    material.alphaTest = cutout ? 0.5 : 0;
    material.needsUpdate = true;
    invalidate();
  }, [map, cutout, material, invalidate]);
  useEffect(() => {
    material.color.set(color);
    invalidate();
  }, [color, material, invalidate]);
  useEffect(() => {
    let alive = true;
    let n: THREE.Texture | null = null;
    loadMaterialMap('linen', 'normal').then((t) => {
      if (!alive) return;
      n = t.clone();
      n.repeat.set(tiling, tiling);
      n.needsUpdate = true;
      material.normalMap = n;
      material.normalScale.set(0.6, 0.6);
      material.needsUpdate = true;
      invalidate();
    });
    return () => {
      alive = false;
      n?.dispose();
    };
  }, [material, tiling, invalidate]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/**
 * Canvas texture painted from the surface's image (or nothing while it
 * loads). `draw` receives the 2D context and the image; used for garments,
 * where the design is printed into a zone of a larger piece of fabric.
 */
export function useComposedTexture(
  binding: SurfaceBinding | undefined,
  size: [number, number],
  draw: (g: CanvasRenderingContext2D, image: HTMLImageElement | null, w: number, h: number) => void,
  deps: unknown[],
) {
  const { image } = useSurfaceImage(binding);
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = size[0];
    c.height = size[1];
    return prepareTexture(new THREE.CanvasTexture(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size[0], size[1]]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const c = texture.image as HTMLCanvasElement;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    draw(g, image, c.width, c.height);
    texture.needsUpdate = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, image, invalidate, ...deps]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** Draws an image into a box, "contain" (whole design visible) or "cover". */
export function drawFitted(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fit: 'cover' | 'contain') {
  const ia = img.naturalWidth / img.naturalHeight;
  const ba = w / h;
  let dw = w;
  let dh = h;
  if ((fit === 'contain') === ia > ba) dh = w / ia;
  else dw = h * ia;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Colour param shared by objects with a body colour (mug, bag, tee…). */
export const colorParam = (id: string, fr: string, en: string, options: [string, string, string][], def: string): ParamDef => ({
  id,
  kind: 'choice',
  label: { fr, en },
  options: options.map(([value, f, e]) => ({ value, label: { fr: f, en: e } })),
  default: def,
});
