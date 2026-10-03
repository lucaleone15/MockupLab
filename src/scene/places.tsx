import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import type { I18nString } from '@/i18n';
import type { MaterialId, PlaceId } from '@/store/project';
import { screenUniforms } from './screenMaterial';

/*
 * Real places: a CC0 HDRI (Poly Haven) lights the scene and gives believable
 * reflections, while a photographic panorama of the same room is shown
 * behind the devices, softly blurred like a shallow depth of field.
 * The main light of the room (usually a window) is detected in the HDRI so
 * the key light — and the shadows — come from the right direction.
 */

export interface PlaceSpec {
  name: I18nString;
  /** Default table top. */
  table: MaterialId;
  /** Default orientation (degrees) showing the nicest part of the room behind the devices. */
  rotation: number;
  /** Exposure that suits the room's brightness. */
  exposure: number;
}

export const PLACES: Record<PlaceId, PlaceSpec> = {
  loft: { name: { fr: 'Loft', en: 'Loft' }, table: 'oak', rotation: 72, exposure: 1 },
  cafe: { name: { fr: 'Café', en: 'Café' }, table: 'walnut', rotation: 90, exposure: 1.05 },
  lounge: { name: { fr: 'Salon', en: 'Lounge' }, table: 'marble-white', rotation: 162, exposure: 0.95 },
  veranda: { name: { fr: 'Véranda', en: 'Veranda' }, table: 'travertine', rotation: 108, exposure: 0.85 },
  evening: { name: { fr: 'Soirée', en: 'Evening' }, table: 'marble-black', rotation: 90, exposure: 0.95 },
  atelier: { name: { fr: 'Atelier', en: 'Atelier' }, table: 'concrete', rotation: 119, exposure: 0.95 },
};

export const PLACE_ORDER: PlaceId[] = ['loft', 'cafe', 'lounge', 'veranda', 'evening', 'atelier'];

export const placeUrl = (id: PlaceId, file: 'env.hdr' | 'bg.jpg' | 'thumb.jpg') => `${import.meta.env.BASE_URL}assets/places/${id}/${file}`;

/* ------------------------------------------------------------ loading */

export interface LoadedPlace {
  env: THREE.DataTexture;
  background: THREE.Texture;
  /** Direction towards the main light, in the unrotated panorama. */
  sun: THREE.Vector3;
}

const places = new Map<PlaceId, Promise<LoadedPlace>>();

/** Brightest region of an equirectangular HDR (cos-weighted, on a coarse grid). */
function findSun(tex: THREE.DataTexture): THREE.Vector3 {
  const { width, height, data } = tex.image as { width: number; height: number; data: Float32Array | Uint16Array };
  const half = tex.type === THREE.HalfFloatType;
  const value = (i: number) => (half ? THREE.DataUtils.fromHalfFloat((data as Uint16Array)[i]) : (data as Float32Array)[i]);
  const GW = 64;
  const GH = 32;
  const grid = new Float32Array(GW * GH);
  const stride = data.length / (width * height);
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * stride;
      const lum = 0.2126 * value(i) + 0.7152 * value(i + 1) + 0.0722 * value(i + 2);
      grid[Math.floor((y / height) * GH) * GW + Math.floor((x / width) * GW)] += lum;
    }
  }
  let best = 0;
  let bx = 0;
  let by = 0;
  for (let y = 1; y < GH - 1; y++) {
    const w = Math.cos(((y + 0.5) / GH - 0.5) * Math.PI);
    for (let x = 0; x < GW; x++) {
      // 3×3 box so a large window wins over a small hot spot
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += grid[(y + dy) * GW + ((x + dx + GW) % GW)];
      if (s * w > best) {
        best = s * w;
        bx = x;
        by = y;
      }
    }
  }
  // Data rows run top → bottom; three's equirect: u = atan(z, x) / 2π + 0.5, v = asin(y) / π + 0.5.
  const u = (bx + 0.5) / GW;
  const v = 1 - (by + 0.5) / GH;
  const phi = (u - 0.5) * Math.PI * 2;
  const theta = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi)).normalize();
}

export function loadPlace(id: PlaceId): Promise<LoadedPlace> {
  let p = places.get(id);
  if (!p) {
    p = Promise.all([new HDRLoader().loadAsync(placeUrl(id, 'env.hdr')), new THREE.TextureLoader().loadAsync(placeUrl(id, 'bg.jpg'))]).then(([env, bg]) => {
      env.mapping = THREE.EquirectangularReflectionMapping;
      bg.colorSpace = THREE.SRGBColorSpace;
      bg.generateMipmaps = true;
      bg.minFilter = THREE.LinearMipmapLinearFilter;
      return { env, background: bg, sun: findSun(env) };
    });
    places.set(id, p);
  }
  return p;
}

export function usePlace(id: PlaceId | null): LoadedPlace | null {
  const [loaded, setLoaded] = useState<{ id: PlaceId; place: LoadedPlace } | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    loadPlace(id).then((place) => {
      if (!alive) return;
      setLoaded({ id, place });
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, [id, invalidate]);
  return id && loaded?.id === id ? loaded.place : null;
}

/* ------------------------------------------------------------ background */

const bgVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main() {
  // Object-space direction: the mesh rotation turns the panorama.
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const bgFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D tBg;
uniform float uBlur;
uniform float uExposure;
varying vec3 vDir;
vec2 equirect(vec3 d) {
  return vec2(atan(d.z, d.x) * RECIPROCAL_PI2 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  vec3 t1 = normalize(cross(d, abs(d.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(d, t1);
  // Disk of directions (golden-angle spiral) sampled at a matching mip level: soft, round blur.
  float r = uBlur * 0.06;
  float lod = uBlur * 5.5;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float a = float(i) * 2.39996323;
    float rr = sqrt((float(i) + 0.5) / 24.0) * r;
    vec3 dd = normalize(d + t1 * cos(a) * rr + t2 * sin(a) * rr);
    acc += textureLod(tBg, equirect(dd), lod).rgb;
  }
  gl_FragColor = vec4(acc / 24.0 * uExposure, 1.0);
  #include <colorspace_fragment>
}`;

/** Panorama of the place, at infinity, softly blurred. */
export function PlaceBackground({ texture, blur, rotation }: { texture: THREE.Texture; blur: number; rotation: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { tBg: { value: null }, uBlur: { value: 0 }, uExposure: screenUniforms.uExposure },
        vertexShader: bgVert,
        fragmentShader: bgFrag,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    material.uniforms.tBg.value = texture;
    material.uniforms.uBlur.value = blur;
    invalidate();
  }, [texture, blur, material, invalidate]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    // Always centred on the camera: no parallax, like a real distant background.
    m.onBeforeRender = (_r, _s, camera) => {
      m.position.copy(camera.position);
      m.updateMatrixWorld();
    };
  }, []);
  return (
    <mesh ref={mesh} material={material} rotation={[0, THREE.MathUtils.degToRad(rotation), 0]} scale={4000} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 32]} />
    </mesh>
  );
}
