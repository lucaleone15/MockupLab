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
    at: [3.595, 2.15],
    plateau: { width: 6.25, height: 3.45, radius: 0.92, thickness: 0.14, material: 'metal' },
    lenses: [
      [-1.95, 0.87, 0.86],
      [-1.95, -0.87, 0.86],
      [-0.18, -0.06, 0.86],
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

/** 6.1" mainstream phone: satin aluminium band, notch, glossy back, diagonal dual camera. */
export const phoneClassic = definePhone({
  id: 'phone',
  name: { fr: 'Phone', en: 'Phone' },
  width: 7.15,
  height: 14.67,
  depth: 0.78,
  radius: 1.25,
  smooth: 0.55,
  bandEdge: { d: 0.1, z: 0.11 },
  frame: { roughness: 0.38, anisotropy: 0.12 },
  display: { width: 6.46, height: 13.98, radius: 0.9 },
  nativeSize: [1170, 2532],
  cutout: { kind: 'notch', width: 2.7, height: 0.56, radius: 0.26 },
  back: 'glossy',
  camera: {
    at: [0.32 + 1.475, 0.32 + 1.475],
    plateau: { width: 2.95, height: 2.95, radius: 0.78, thickness: 0.09 },
    lenses: [
      [-0.66, 0.66, 0.64],
      [0.66, -0.66, 0.64],
    ],
    flash: [0.74, 0.76, 0.2],
    mic: [-0.72, -0.78],
  },
  buttons: [
    [-1, 2.45, 0.55],
    [-1, 3.6, 0.9],
    [-1, 4.8, 0.9],
    [1, 4.2, 1.6],
  ],
  finishes: [
    phoneFinish('midnight', 'Minuit', 'Midnight', '#2e3138', '#20242c', '#2a2d33'),
    phoneFinish('starlight', 'Lumière stellaire', 'Starlight', '#e6dfd2', '#f1ebe1', '#d6cfc2'),
    phoneFinish('blue', 'Bleu', 'Blue', '#a5b7cb', '#bfcddc', '#92a3b6'),
    phoneFinish('purple', 'Mauve', 'Purple', '#c4b7d4', '#d6cde2', '#b0a4c0'),
    phoneFinish('red', 'Rouge', 'Red', '#b51f2e', '#c42a38', '#9c1a27'),
  ],
  defaultFinish: 'midnight',
});

/** Generic Android-style flagship: flat aluminium frame, punch-hole, floating lenses. */
export const phoneNeo = definePhone({
  id: 'phone-neo',
  name: { fr: 'Phone Neo', en: 'Phone Neo' },
  width: 7.06,
  height: 14.7,
  depth: 0.76,
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
