import { definePhone, phoneFinish } from './Phone';

/*
 * Generic interpretations of common phone silhouettes. Dimensions are in
 * centimetres and follow typical 2022–2025 proportions; names are neutral.
 */

/**
 * Current 6.3" pro flagship (measured on the 2025–2026 generation, 71.9 × 150.0 × 8.75 mm): aluminium unibody,
 * thin even borders, pill cutout, a camera plateau across the whole width of the back (three lenses in a
 * triangle on the left, flash and LiDAR on the right), action button, side button and a flush camera control.
 */
export const phonePro = definePhone({
  id: 'phone-pro',
  name: { fr: 'Phone Pro', en: 'Phone Pro' },
  width: 7.19,
  height: 15.0,
  depth: 0.875,
  radius: 1.2,
  smooth: 0.6,
  // the band meets the screen glass with a small radius, and curves into the back with a large one
  bandEdge: { d: 0.13, z: 0.15 },
  backEdge: { d: 0.45, z: 0.42 },
  unibody: true,
  // bead-blasted anodised aluminium (low anisotropy → fine grain, not brushed)
  frame: { roughness: 0.5, anisotropy: 0.12 },
  display: { width: 6.79, height: 14.6, radius: 1.0 },
  nativeSize: [1206, 2622],
  cutout: { kind: 'island', width: 2.0, height: 0.6, top: 0.2 },
  back: 'frosted',
  camera: {
    // measured on the maker's photos (perspective corrected): a raised block inset ~4.5 mm, 6.25 × 3.3 cm
    // its corners are concentric with the phone's (12 mm − the 4.5 mm inset): the plateau follows the outline
    at: [3.595, 2.2],
    plateau: { width: 6.25, height: 3.55, radius: 0.75, thickness: 0.14, material: 'metal' },
    lenses: [
      // kept inside the plateau with a margin, even in its rounded corner
      [-1.86, 0.84, 0.8],
      [-1.86, -0.84, 0.8],
      [-0.12, -0.05, 0.8],
    ],
    collar: true,
    flash: [2.2, 0.85, 0.32],
    sensor: [2.05, -1.0, 0.32],
    mic: [2.15, -0.1],
  },
  buttons: [
    // left: action, volume up, volume down; right: side button, camera control
    [-1, 2.95, 0.6],
    [-1, 4.3, 1.05],
    [-1, 5.6, 1.05],
    [1, 4.6, 1.75],
    [1, 9.55, 1.9],
  ],
  finishes: [
    phoneFinish('silver', 'Argent', 'Silver', '#cfd0d2', '#e3e3e1', '#bdbec0'),
    phoneFinish('deep-blue', 'Bleu intense', 'Deep blue', '#34405a', '#3b4762', '#2c364c'),
    phoneFinish('orange', 'Orange cosmique', 'Cosmic orange', '#c96a35', '#d9784a', '#b25d2d'),
    phoneFinish('cherry', 'Cerise sombre', 'Dark cherry', '#5c2633', '#68303c', '#4e202b'),
    phoneFinish('black', 'Noir', 'Black', '#2c2d31', '#35363a', '#252629'),
  ],
  defaultFinish: 'silver',
});

/**
 * Current 6.3" mainstream phone (measured on the 2025 generation, 71.5 × 149.6 × 7.95 mm): contoured
 * aluminium band, thin borders, pill cutout, matte colour-infused glass back, a vertical glass capsule with
 * two stacked lenses (the flash outside it, to the right), action button, side button and camera control.
 */
export const phoneClassic = definePhone({
  id: 'phone',
  name: { fr: 'Phone', en: 'Phone' },
  width: 7.15,
  height: 14.96,
  depth: 0.795,
  radius: 1.18,
  smooth: 0.6,
  bandEdge: { d: 0.16, z: 0.17 },
  frame: { roughness: 0.42, anisotropy: 0.12 },
  display: { width: 6.77, height: 14.58, radius: 1.0 },
  nativeSize: [1206, 2622],
  cutout: { kind: 'island', width: 2.0, height: 0.6, top: 0.2 },
  back: 'frosted',
  camera: {
    // the capsule: 1.95 × 3.9 cm, fully rounded ends, its centre 1.45 cm in and 2.45 cm down
    at: [1.45, 2.45],
    plateau: { width: 1.95, height: 3.9, radius: 0.975, thickness: 0.12 },
    lenses: [
      [0, 0.97, 0.78],
      [0, -0.97, 0.78],
    ],
    collar: true,
    flash: [1.6, 1.3, 0.3],
    mic: [1.6, 0.55],
  },
  buttons: [
    // left: action, volume up, volume down; right: side button, camera control
    [-1, 2.9, 0.6],
    [-1, 4.25, 1.0],
    [-1, 5.5, 1.0],
    [1, 4.55, 1.7],
    [1, 9.5, 1.85],
  ],
  finishes: [
    phoneFinish('lavender', 'Lavande', 'Lavender', '#b9a9d2', '#cdbfe0', '#a797bf'),
    phoneFinish('sage', 'Sauge', 'Sage', '#a9b79c', '#c0cab3', '#97a58b'),
    phoneFinish('mist-blue', 'Bleu brume', 'Mist blue', '#9fb7cf', '#bccbdc', '#8ea5bc'),
    phoneFinish('white', 'Blanc', 'White', '#e3e3e0', '#f1f1ee', '#d1d1ce'),
    phoneFinish('black', 'Noir', 'Black', '#2c2d31', '#36373b', '#26272a'),
  ],
  defaultFinish: 'lavender',
});

/** Generic Android-style flagship: flat aluminium frame, punch-hole, floating lenses. */
export const phoneNeo = definePhone({
  id: 'phone-neo',
  name: { fr: 'Phone Neo', en: 'Phone Neo' },
  // a current compact Android flagship (Galaxy S proportions: 70.5 × 146.9 × 7.2 mm), flat band, punch-hole
  width: 7.05,
  height: 14.69,
  depth: 0.72,
  radius: 0.95,
  smooth: 0.35,
  bandEdge: { d: 0.12, z: 0.14 },
  frame: { roughness: 0.3, anisotropy: 0.2 },
  display: { width: 6.66, height: 14.43, radius: 0.75 },
  nativeSize: [1080, 2340],
  cutout: { kind: 'punch', diameter: 0.3, top: 0.36 },
  back: 'frosted',
  camera: {
    at: [1.45, 2.85],
    lenses: [
      [0, 1.4, 0.58],
      [0, 0, 0.58],
      [0, -1.4, 0.58],
    ],
    flash: [1.15, 1.25, 0.15],
    sensor: [1.15, 0.7, 0.09],
  },
  buttons: [
    [1, 3.5, 2.3],
    [1, 5.4, 1.1],
  ],
  finishes: [
    phoneFinish('black', 'Noir', 'Black', '#232427', '#27282c', '#1e1f22'),
    phoneFinish('cream', 'Crème', 'Cream', '#e7e0d1', '#efe8da', '#d5cebf'),
    phoneFinish('lavender', 'Lavande', 'Lavender', '#b7afcf', '#c8c0dc', '#a59dbd'),
    phoneFinish('green', 'Sauge', 'Sage', '#5d6f5d', '#6b7e6a', '#4f604f'),
  ],
  defaultFinish: 'black',
});
