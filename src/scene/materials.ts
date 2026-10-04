import * as THREE from 'three';
import { withMicro } from './microsurface';

/**
 * Shared PBR material factories. Materials are cached by their parameters so
 * many devices with the same finish share GPU programs and uniforms.
 */
const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/**
 * Anodised / bare metal. Strong anisotropy means a brushed finish (titanium
 * bands: fine streaks along the UV u direction, i.e. around the band);
 * otherwise a bead-blasted one (aluminium bodies: very fine grain).
 */
export const brushedMetal = (color: string, roughness = 0.32, anisotropy = 0.35) =>
  cached(`metal:${color}:${roughness}:${anisotropy}`, () => {
    const m = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, anisotropy });
    return anisotropy >= 0.25 ? withMicro(m, 'brushed', [6, 1], 0.35) : withMicro(m, 'bead', [24, 24], 0.18);
  });

/** Polished metal (lens rings, chamfers). */
export const polishedMetal = (color: string) =>
  cached(`polished:${color}`, () => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.12 }));

/**
 * Cover glass with a dark backing (front face of a device). Same reflectance
 * as the screen material at its default setting, so bezel, cutout and display
 * read as one continuous sheet of glass.
 */
export const coverGlass = (color = '#030304') =>
  cached(`coverglass:${color}`, () =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.04, ior: 1.5, specularIntensity: 1 }),
  );

/** Textured matte glass (device backs). */
export const frostedGlass = (color: string) =>
  cached(`frosted:${color}`, () =>
    withMicro(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.42,
        clearcoat: 0.25,
        clearcoatRoughness: 0.5,
        sheen: 0.15,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color('#ffffff'),
      }),
      'frost',
      [10, 10],
      0.32,
    ),
  );

/** Glossy coloured glass (camera plateau). */
export const glossyGlass = (color: string) =>
  cached(`glossy:${color}`, () =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 }),
  );

/** Camera lens: deep black glass with a subtle anti-reflective coating sheen. */
export const lensGlass = () =>
  cached('lens', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#020203',
      metalness: 0,
      roughness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0,
      iridescence: 1,
      iridescenceIOR: 1.9,
      iridescenceThicknessRange: [250, 520],
      specularIntensity: 1,
      envMapIntensity: 1.6,
    }),
  );

/** Matte plastic / rubber (antenna lines, ports). */
export const mattePlastic = (color: string, roughness = 0.65) =>
  cached(`plastic:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness }));

/** Pure black, slightly glossy (sensor housings, holes). */
export const blackGloss = () =>
  cached('blackgloss', () => new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.18, clearcoat: 0.6 }));

/** Unlit-ish black for openings that should read as depth. */
export const cavity = () => cached('cavity', () => new THREE.MeshBasicMaterial({ color: '#000000' }));

/** Frosted flash diffuser. */
export const flashDiffuser = () =>
  cached('flash', () =>
    new THREE.MeshPhysicalMaterial({ color: '#d9d3c0', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4 }),
  );

/** Clear sapphire lens cover: almost invisible, only its reflections show. */
export const sapphireCover = () =>
  cached('sapphire', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.02,
      transmission: 0,
      transparent: true,
      opacity: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0,
      depthWrite: false,
    }),
  );

/** Camera cutout drawn over the display: needs a stronger depth offset than the screen. */
export const islandBlack = () =>
  cached('island', () =>
    new THREE.MeshPhysicalMaterial({
      color: '#000000',
      roughness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    }),
  );
