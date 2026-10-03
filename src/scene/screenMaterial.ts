import * as THREE from 'three';

/**
 * Screen material.
 *
 * The user's image drives the emissive channel and must come out with exactly
 * its source colours. The scene uses Khronos PBR Neutral tone mapping, which
 * would dull whites and desaturate bright colours. So this material opts out
 * of renderer tone mapping and composes the pixel itself:
 *
 *   out = image + Neutral(reflections)
 *
 * Reflections (dielectric specular, F0 = 4 %, scaled by the `reflection`
 * setting) go through the same curve as the surrounding cover glass, so a dark
 * screen and the black bezel reflect identically: no "sticker" seam.
 */

const NEUTRAL = /* glsl */ `
uniform vec3 uFill;
uniform float uExposure;
vec3 mlNeutral(vec3 color) {
  const float S = 0.8 - 0.04;
  const float Dsat = 0.15;
  color *= uExposure;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < S) return color;
  float d = 1. - S;
  float newPeak = 1. - d * d / (peak + d - S);
  color *= newPeak / peak;
  float g = 1. - 1. / (Dsat * (peak - newPeak) + 1.);
  return mix(color, vec3(newPeak), g);
}
`;

export interface ScreenMaterialUniforms {
  uFill: { value: THREE.Color };
  uExposure: { value: number };
}

export function createScreenMaterial(): THREE.MeshPhysicalMaterial {
  const uniforms: ScreenMaterialUniforms = { uFill: { value: new THREE.Color('#000000') }, uExposure: { value: 1 } };
  const material = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    emissive: '#ffffff',
    emissiveIntensity: 1,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 0,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NEUTRAL}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  if (vEmissiveMapUv.x < 0.0 || vEmissiveMapUv.x > 1.0 || vEmissiveMapUv.y < 0.0 || vEmissiveMapUv.y > 1.0) {
    totalEmissiveRadiance = uFill;
  }
#endif
  vec3 mlScreen = totalEmissiveRadiance;
  totalEmissiveRadiance = vec3(0.0);`,
      )
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mlNeutral(gl_FragColor.rgb) + mlScreen;');
  };
  material.customProgramCacheKey = () => 'mockuplab-screen-v2';
  return material;
}

export type Fit = 'cover' | 'contain';

/**
 * Positions a texture on a surface of the given aspect (width / height).
 * `align` moves the crop window (0 = top/left, 0.5 = centre, 1 = bottom/right)
 * when the image overflows in cover mode; tall screenshots default to the top.
 */
export function fitTexture(texture: THREE.Texture, imageAspect: number, surfaceAspect: number, fit: Fit, align = 0) {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.center.set(0, 0);
  texture.rotation = 0;
  const imageTaller = imageAspect < surfaceAspect;
  if (fit === 'cover') {
    if (imageTaller) {
      const ry = imageAspect / surfaceAspect;
      texture.repeat.set(1, ry);
      texture.offset.set(0, (1 - ry) * (1 - align));
    } else {
      const rx = surfaceAspect / imageAspect;
      texture.repeat.set(rx, 1);
      texture.offset.set((1 - rx) * align, 0);
    }
  } else if (imageTaller) {
    const rx = surfaceAspect / imageAspect;
    texture.repeat.set(rx, 1);
    texture.offset.set((1 - rx) / 2, 0);
  } else {
    const ry = imageAspect / surfaceAspect;
    texture.repeat.set(1, ry);
    texture.offset.set(0, (1 - ry) / 2);
  }
  texture.updateMatrix();
}
