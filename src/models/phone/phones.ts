import { definePhone, phoneFinish } from './Phone';

/*
 * Generic interpretations of common phone silhouettes. Dimensions are in
 * centimetres and follow typical 2022–2025 proportions; names are neutral.
 */

/** 6.1" flagship: titanium band, pill cutout, matte back, triple camera plateau. */
export const phonePro = definePhone({
  id: 'phone-pro',
  name: { fr: 'Phone Pro', en: 'Phone Pro' },
  width: 7.06,
  height: 14.66,
  depth: 0.825,
  radius: 1.35,
  smooth: 0.6,
  bandEdge: { d: 0.09, z: 0.11 },
  frame: { roughness: 0.32, anisotropy: 0.35 },
  display: { width: 6.51, height: 14.11, radius: 1.075 },
  nativeSize: [1179, 2556],
  cutout: { kind: 'island', width: 2.09, height: 0.61, top: 0.18 },
  back: 'frosted',
  camera: {
    at: [0.3 + 1.775, 0.3 + 1.775],
    plateau: { width: 3.55, height: 3.55, radius: 0.95, thickness: 0.11 },
    lenses: [
      [-0.84, 0.84, 0.79],
      [-0.84, -0.84, 0.79],
      [0.88, 0, 0.79],
    ],
    flash: [0.92, 1.24, 0.25],
    sensor: [0.92, -1.24, 0.22],
    mic: [0.25, 1.4],
  },
  buttons: [
    [-1, 2.55, 0.55],
    [-1, 3.85, 1.0],
    [-1, 5.15, 1.0],
    [1, 4.4, 1.7],
  ],
  finishes: [
    phoneFinish('natural', 'Titane naturel', 'Natural titanium', '#b4aea4', '#c6c0b5', '#9d978d'),
    phoneFinish('black', 'Titane noir', 'Black titanium', '#4a4b4f', '#3d3e42', '#3a3b3e'),
    phoneFinish('white', 'Titane blanc', 'White titanium', '#dddcd7', '#efeee9', '#c9c8c3'),
    phoneFinish('blue', 'Titane bleu', 'Blue titanium', '#46526a', '#4f5b70', '#3c4659'),
    phoneFinish('desert', 'Titane sable', 'Desert titanium', '#c3a68e', '#d2bda7', '#ad937c'),
  ],
  defaultFinish: 'natural',
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
  bandEdge: { d: 0.05, z: 0.06 },
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
  bandEdge: { d: 0.04, z: 0.05 },
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
