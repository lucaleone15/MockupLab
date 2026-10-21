import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ratioValue } from '@/export/settings';
import { paintBackground, prepareBackground } from '@/lib/background';
import { useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { loadMaterialMap } from './realMaterials';

/*
 * Walls show the background. A wall's base colour is read from the scene's
 * 2D background at the pixel it covers on screen, so a wall continues the
 * background exactly — plain, gradient, pattern or image — while still being
 * lit and shadowed in 3D. During tiled exports the camera's view offset tells
 * the shader where the tile sits in the full frame.
 */

const LONG_SIDE = 2048;
/** A transparent background has nothing to show: walls are a neutral warm white. */
const NEUTRAL = '#ece6dc';

interface BackdropUniforms {
  uBackdrop: { value: THREE.Texture };
  /** Tile rectangle in the full frame: x, y (from the top), width, height, as fractions. */
  uView: { value: THREE.Vector4 };
}

/**
 * Where the frame being rendered sits in the whole image (fractions): the full
 * frame, or one tile of a tiled export. Set by the exporter only — the camera's
 * own view offset also carries the lens shift and depth-of-field jitter, which
 * move the subject, not the background.
 */
const tile = new THREE.Vector4(0, 0, 1, 1);
export function setBackdropTile(x = 0, y = 0, width = 1, height = 1) {
  tile.set(x, y, width, height);
}

/** True while the exporter renders: the live view then leaves the backdrop's tile alone. */
let offline = false;
export const setOfflineRender = (v: boolean) => {
  offline = v;
};
export const isOfflineRender = () => offline;

function patch(material: THREE.MeshStandardMaterial, uniforms: BackdropUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vBackdropClip;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBackdropClip = gl_Position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBackdrop;\nuniform vec4 uView;\nvarying vec4 vBackdropClip;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 backdropNdc = vBackdropClip.xy / vBackdropClip.w * 0.5 + 0.5;
        vec2 backdropUv = vec2(uView.x + backdropNdc.x * uView.z, 1.0 - (uView.y + (1.0 - backdropNdc.y) * uView.w));
        diffuseColor.rgb *= texture2D(uBackdrop, backdropUv).rgb;`,
      );
  };
  material.customProgramCacheKey = () => 'backdrop';
  material.onBeforeRender = () => {
    uniforms.uView.value.copy(tile);
  };
}

/**
 * Material of a wall (or a studio cyclo) that shows the background.
 * `plaster` adds the faint relief of a painted wall.
 */
export function useBackdropMaterial({ roughness = 0.95, plaster = false }: { roughness?: number; plaster?: boolean } = {}) {
  const invalidate = useThree((s) => s.invalidate);
  const background = useProject((s) => s.background);
  const ratio = useProject((s) => s.export.ratio);
  const imageReady = useAssets((s) => (background.kind === 'image' && background.assetId ? !!s.assets[background.assetId] : true));

  const { material, canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const uniforms: BackdropUniforms = { uBackdrop: { value: texture }, uView: { value: new THREE.Vector4(0, 0, 1, 1) } };
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness, metalness: 0 });
    patch(material, uniforms);
    return { material, canvas, texture };
  }, [roughness]);

  // repaint the background into the texture at the frame's proportions
  useEffect(() => {
    let alive = true;
    const r = ratioValue(ratio);
    const w = r >= 1 ? LONG_SIDE : Math.round(LONG_SIDE * r);
    const h = r >= 1 ? Math.round(LONG_SIDE / r) : LONG_SIDE;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      // the GPU storage was allocated at the old size: drop it so it is re-created at the new one
      texture.dispose();
    }
    const paint = () => {
      if (!alive) return;
      const ctx = canvas.getContext('2d')!;
      if (background.kind === 'transparent') {
        ctx.fillStyle = NEUTRAL;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else paintBackground(ctx, background, canvas.width, canvas.height);
      texture.needsUpdate = true;
      invalidate();
    };
    paint();
    void prepareBackground(background)
      .then(paint)
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [background, ratio, imageReady, canvas, texture, invalidate]);

  // painted plaster: a faint concrete relief
  useEffect(() => {
    if (!plaster) return;
    let alive = true;
    let tex: THREE.Texture | null = null;
    loadMaterialMap('concrete', 'normal').then((n) => {
      if (!alive) return;
      tex = n.clone();
      tex.repeat.set(4, 2);
      tex.needsUpdate = true;
      material.normalMap = tex;
      material.normalScale.set(0.25, 0.25);
      material.needsUpdate = true;
      invalidate();
    });
    return () => {
      alive = false;
      tex?.dispose();
    };
  }, [plaster, material, invalidate]);

  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );
  return material;
}
