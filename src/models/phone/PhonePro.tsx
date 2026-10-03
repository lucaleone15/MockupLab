import { useMemo } from 'react';
import * as THREE from 'three';
import { circleOutline } from '@/lib/geometry/outline';
import { flatShape, latheZ, roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import {
  blackGloss,
  brushedMetal,
  cavity,
  coverGlass,
  flashDiffuser,
  frostedGlass,
  glossyGlass,
  islandBlack,
  lensGlass,
  mattePlastic,
  polishedMetal,
  sapphireCover,
} from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';

/*
 * "Phone Pro": a generic 6.1" flagship with a pill-shaped camera cutout,
 * flat titanium band, matte glass back and a triple-camera plateau.
 * Dimensions in centimetres, modelled after common 2023–2025 flagship proportions.
 */
const W = 7.06;
const H = 14.66;
const T = 0.825;
const BODY_R = 1.35;
const SMOOTH = 0.6;
const BAND_EDGE = { d: 0.09, z: 0.11 };
const GLASS_INSET = 0.05;
const GLASS_T = 0.05;
const GLASS_TOP = T / 2 + 0.015;
const DISPLAY_W = 6.51;
const DISPLAY_H = 14.11;
const DISPLAY_R = BODY_R - (W - DISPLAY_W) / 2;
const SCREEN_Z = GLASS_TOP + 0.0015;

const PLATEAU = 3.55;
const PLATEAU_MARGIN = 0.3;

/** Side buttons: [side, centre offset from the top, length]. */
const BUTTONS: [-1 | 1, number, number][] = [
  [-1, 2.55, 0.55], // action
  [-1, 3.85, 1.0], // volume up
  [-1, 5.15, 1.0], // volume down
  [1, 4.4, 1.7], // power
];

interface PhoneGeometry {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  display: THREE.BufferGeometry;
  island: THREE.BufferGeometry;
  islandLens: THREE.BufferGeometry;
  plateau: THREE.BufferGeometry;
  lensRing: THREE.BufferGeometry;
  lensBarrel: THREE.BufferGeometry;
  lensDome: THREE.BufferGeometry;
  lensCover: THREE.BufferGeometry;
  smallDisc: THREE.BufferGeometry;
  button: Record<string, THREE.BufferGeometry>;
  antennaSide: THREE.BufferGeometry;
  antennaTop: THREE.BufferGeometry;
  port: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
  earpiece: THREE.BufferGeometry;
}

let geometry: PhoneGeometry | null = null;

function buildGeometry(): PhoneGeometry {
  const button: Record<string, THREE.BufferGeometry> = {};
  for (const [, , len] of BUTTONS) {
    button[len] ??= roundedSlab({
      width: 0.26,
      height: len,
      radius: 0.13,
      thickness: 0.12,
      front: { d: 0.05, z: 0.05 },
      smooth: 0,
      segments: 12,
      edgeSegments: 6,
    });
  }
  return {
    body: roundedSlab({
      width: W,
      height: H,
      radius: BODY_R,
      thickness: T,
      front: BAND_EDGE,
      back: BAND_EDGE,
      smooth: SMOOTH,
      segments: 40,
      edgeSegments: 14,
    }),
    glass: roundedSlab({
      width: W - GLASS_INSET * 2,
      height: H - GLASS_INSET * 2,
      radius: BODY_R - GLASS_INSET,
      thickness: GLASS_T,
      front: { d: 0.035, z: 0.022 },
      back: 0,
      smooth: SMOOTH,
      segments: 40,
      edgeSegments: 8,
    }),
    display: roundedPlane(DISPLAY_W, DISPLAY_H, DISPLAY_R, { smooth: SMOOTH, segments: 40 }),
    island: roundedPlane(2.09, 0.61, 0.305, { smooth: 0, segments: 20 }),
    islandLens: flatShape(circleOutline(0.11, 32)),
    plateau: roundedSlab({
      width: PLATEAU,
      height: PLATEAU,
      radius: 0.95,
      thickness: 0.11,
      front: { d: 0.07, z: 0.06 },
      back: 0,
      smooth: SMOOTH,
      segments: 24,
      edgeSegments: 8,
    }),
    // [radius, height] pairs, outer wall up → top → inner wall down.
    lensRing: latheZ(
      [
        [0.79, 0],
        [0.79, 0.11],
        [0.785, 0.13],
        [0.772, 0.142],
        [0.735, 0.145],
        [0.722, 0.138],
        [0.718, 0.12],
      ],
      72,
    ),
    // dark anodised barrel visible through the cover glass
    lensBarrel: latheZ(
      [
        [0.72, 0.1],
        [0.6, 0.1],
        [0.52, 0.085],
        [0.46, 0.08],
      ],
      72,
    ),
    // coated front element
    lensDome: latheZ(
      [
        [0.47, 0.079],
        [0.4, 0.088],
        [0.25, 0.095],
        [0.0, 0.098],
      ],
      72,
    ),
    // flat sapphire cover over the whole lens
    lensCover: latheZ(
      [
        [0.722, 0.122],
        [0.5, 0.124],
        [0.0, 0.125],
      ],
      72,
    ),
    smallDisc: latheZ(
      [
        [1, 0],
        [1, 0.08],
        [0.85, 0.11],
        [0.0, 0.12],
      ],
      40,
    ),
    button,
    antennaSide: new THREE.BoxGeometry(0.008, 0.05, T - 0.24),
    antennaTop: new THREE.BoxGeometry(0.05, 0.008, T - 0.24),
    port: roundedPlane(0.9, 0.3, 0.15, { smooth: 0, segments: 12 }),
    hole: flatShape(circleOutline(0.045, 16)),
    earpiece: roundedPlane(1.15, 0.032, 0.016, { smooth: 0, segments: 8 }),
  };
}

const getGeometry = () => (geometry ??= buildGeometry());

function CameraModule({ g, finish }: { g: PhoneGeometry; finish: DeviceFinish }) {
  const ring = polishedMetal(finish.colors.frame);
  const lens = lensGlass();
  const barrel = mattePlastic('#16161a', 0.42);
  const cover = sapphireCover();
  // Back-view coordinates (as seen when looking at the back of the phone).
  const lenses: [number, number][] = [
    [-0.84, 0.84],
    [-0.84, -0.84],
    [0.88, 0],
  ];
  return (
    <group
      position={[W / 2 - PLATEAU_MARGIN - PLATEAU / 2, H / 2 - PLATEAU_MARGIN - PLATEAU / 2, -GLASS_TOP]}
      rotation={[0, Math.PI, 0]}
    >
      <mesh geometry={g.plateau} material={glossyGlass(finish.colors.back)} position={[0, 0, 0.045]} castShadow />
      {lenses.map(([x, y], i) => (
        <group key={i} position={[x, y, 0.1]}>
          <mesh geometry={g.lensRing} material={ring} />
          <mesh geometry={g.lensBarrel} material={barrel} />
          <mesh geometry={g.lensDome} material={lens} />
          <mesh geometry={g.lensCover} material={cover} />
        </group>
      ))}
      <mesh geometry={g.smallDisc} material={flashDiffuser()} position={[0.92, 1.24, 0.1]} scale={[0.25, 0.25, 0.22]} />
      <mesh geometry={g.smallDisc} material={blackGloss()} position={[0.92, -1.24, 0.1]} scale={[0.22, 0.22, 0.2]} />
      <mesh geometry={g.hole} material={cavity()} position={[0.25, 1.4, 0.101]} scale={0.9} />
    </group>
  );
}

function PhonePro({ finish, surfaces, screen }: DeviceProps) {
  const g = getGeometry();
  const screenMaterial = useScreenMaterial(surfaces.screen, DISPLAY_W / DISPLAY_H, screen);
  const frame = brushedMetal(finish.colors.frame);
  const antenna = mattePlastic(finish.colors.antenna, 0.55);
  const glassZ = GLASS_TOP - GLASS_T / 2;
  const speakers = useMemo(() => [-1, 1].flatMap((side) => Array.from({ length: 6 }, (_, i) => side * (0.95 + i * 0.17))), []);

  return (
    <group>
      <mesh geometry={g.body} material={frame} castShadow />
      {/* front cover glass, display and cutout */}
      <mesh geometry={g.glass} material={coverGlass()} position={[0, 0, glassZ]} />
      <mesh geometry={g.display} material={screenMaterial} position={[0, 0, SCREEN_Z]} />
      <mesh geometry={g.island} material={islandBlack()} position={[0, DISPLAY_H / 2 - 0.18 - 0.305, SCREEN_Z + 0.004]} />
      <mesh geometry={g.islandLens} material={lensGlass()} position={[0.62, DISPLAY_H / 2 - 0.485, SCREEN_Z + 0.006]} renderOrder={1} />
      <mesh geometry={g.earpiece} material={mattePlastic('#121214', 0.8)} position={[0, H / 2 - 0.135, GLASS_TOP + 0.001]} />
      {/* back glass */}
      <mesh geometry={g.glass} material={frostedGlass(finish.colors.back)} position={[0, 0, -glassZ]} rotation={[0, Math.PI, 0]} />
      <CameraModule g={g} finish={finish} />
      {/* buttons */}
      {BUTTONS.map(([side, offset, len], i) => (
        <mesh
          key={i}
          geometry={g.button[len]}
          material={frame}
          position={[side * (W / 2 - 0.01), H / 2 - offset, 0]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        />
      ))}
      {/* antenna bands */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`s${sx}${sy}`} geometry={g.antennaSide} material={antenna} position={[sx * (W / 2 - 0.002), sy * (H / 2 - 1.62), 0]} />
        )),
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`t${sx}${sy}`} geometry={g.antennaTop} material={antenna} position={[sx * 1.9, sy * (H / 2 - 0.002), 0]} />
        )),
      )}
      {/* bottom: port and speaker grilles */}
      <group position={[0, -H / 2 - 0.0015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={g.port} material={cavity()} />
        {speakers.map((x) => (
          <mesh key={x} geometry={g.hole} material={cavity()} position={[x, 0, 0]} />
        ))}
      </group>
    </group>
  );
}

const finish = (id: string, fr: string, en: string, frame: string, back: string, antenna: string): DeviceFinish => ({
  id,
  name: { fr, en },
  swatch: frame,
  colors: { frame, back, antenna },
});

export const phonePro: DeviceModule = {
  id: 'phone-pro',
  name: { fr: 'Phone Pro', en: 'Phone Pro' },
  category: 'phone',
  size: [W, H, T],
  surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: DISPLAY_W / DISPLAY_H, nativeSize: [1179, 2556] }],
  finishes: [
    finish('natural', 'Titane naturel', 'Natural titanium', '#b4aea4', '#c6c0b5', '#9d978d'),
    finish('black', 'Titane noir', 'Black titanium', '#4a4b4f', '#3d3e42', '#3a3b3e'),
    finish('white', 'Titane blanc', 'White titanium', '#dddcd7', '#efeee9', '#c9c8c3'),
    finish('blue', 'Titane bleu', 'Blue titanium', '#46526a', '#4f5b70', '#3c4659'),
    finish('desert', 'Titane sable', 'Desert titanium', '#c3a68e', '#d2bda7', '#ad937c'),
  ],
  defaultFinish: 'natural',
  Component: PhonePro,
};
