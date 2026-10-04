import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { brushedMetal, coverGlass, mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { WallShadow, useWall } from '../shared/wall';
import { type DeviceFinish, type DeviceModule, type DeviceProps, type ParamDef } from '../types';

/*
 * Digital signage: TVs, a free-standing digital totem and a backlit street
 * poster (bus-shelter format). Origin on the floor, screens face +Z.
 */

const INCH = 2.54;
const screenSize = (diag: number) => ({ w: diag * INCH * (16 / Math.hypot(16, 9)), h: diag * INCH * (9 / Math.hypot(16, 9)) });

const HOUSINGS: DeviceFinish[] = [
  { id: 'black', name: { fr: 'Noir', en: 'Black' }, swatch: '#1b1b1d', colors: { body: '#1b1b1d', metal: '#2a2a2d' } },
  { id: 'silver', name: { fr: 'Aluminium', en: 'Aluminium' }, swatch: '#c9cbce', colors: { body: '#c9cbce', metal: '#c9cbce' } },
  { id: 'white', name: { fr: 'Blanc', en: 'White' }, swatch: '#ecebe7', colors: { body: '#ecebe7', metal: '#d6d6d4' } },
];

const WALL_PARAM: ParamDef = {
  id: 'wall',
  kind: 'swatch',
  label: { fr: 'Couleur du mur', en: 'Wall colour' },
  options: [
    { value: '#ece6dc', label: { fr: 'Blanc chaud', en: 'Warm white' } },
    { value: '#d9c8b0', label: { fr: 'Sable', en: 'Sand' } },
    { value: '#b9c2ae', label: { fr: 'Sauge', en: 'Sage' } },
    { value: '#3a3a3d', label: { fr: 'Anthracite', en: 'Charcoal' } },
  ],
  default: '#ece6dc',
};

/** Flat panel: thin body, edge-to-edge glass, display. Centred on its origin, facing +Z. */
function FlatPanel({ w, h, bezel, depth, finish, material }: { w: number; h: number; bezel: number; depth: number; finish: DeviceFinish; material: THREE.Material }) {
  const g = useMemo(
    () => ({
      body: roundedSlab({ width: w + bezel * 2, height: h + bezel * 2, radius: 0.6, thickness: depth, front: 0.15, back: { d: 1.2, z: 0.8 }, smooth: 0.4, segments: 10, edgeSegments: 6 }),
      glass: roundedPlane(w + bezel * 2 - 0.2, h + bezel * 2 - 0.2, 0.5, { smooth: 0.4, segments: 8 }),
      display: roundedPlane(w, h, 0.1, { segments: 2 }),
    }),
    [w, h, bezel, depth],
  );
  return (
    <group>
      <mesh geometry={g.body} material={brushedMetal(finish.colors.metal, 0.4, 0.05)} castShadow receiveShadow />
      <mesh geometry={g.glass} material={coverGlass()} position={[0, 0, depth / 2 + 0.01]} />
      <mesh geometry={g.display} material={material} position={[0, 0, depth / 2 + 0.02]} />
    </group>
  );
}

/* ------------------------------------------------------------ TV */

const TV_SIZES: Record<string, number> = { '43': 43, '55': 55, '65': 65 };
const TV_STAND_H = 9;
const TV_WALL_BOTTOM = 95;

function tvDims(params: Record<string, unknown>) {
  const { w, h } = screenSize(TV_SIZES[String(params.size)] ?? 55);
  const landscape = params.format !== 'portrait';
  return { w, h, fw: (landscape ? w : h) + 1.6, fh: (landscape ? h : w) + 1.6, landscape };
}

function Tv({ surfaces, screen, params, finish }: DeviceProps) {
  const d = tvDims(params);
  const material = useScreenMaterial(surfaces.screen, d.w / d.h, screen, { rotated: !d.landscape });
  const wall = useWall(String(params.wall));
  const onWall = params.mount === 'wall';
  const bottom = onWall ? TV_WALL_BOTTOM : TV_STAND_H;
  return (
    <group>
      <group position={[0, bottom + d.fh / 2, 0]}>
        <group rotation={[0, 0, d.landscape ? 0 : Math.PI / 2]}>
          <FlatPanel w={d.w} h={d.h} bezel={0.8} depth={2.6} finish={finish} material={material} />
        </group>
        {onWall && <WallShadow w={d.fw} h={d.fh} z={-1.55} />}
      </group>
      {onWall ? (
        <mesh material={wall} position={[0, 60, -1.6]} receiveShadow>
          <planeGeometry args={[1200, 520]} />
        </mesh>
      ) : (
        <group>
          {/* pedestal: neck + low plate */}
          <mesh position={[0, TV_STAND_H / 2 + 0.6, -0.6]} material={brushedMetal(finish.colors.metal, 0.35, 0.05)} castShadow>
            <boxGeometry args={[10, TV_STAND_H, 1.6]} />
          </mesh>
          <mesh position={[0, 0.6, 2]} material={brushedMetal(finish.colors.metal, 0.35, 0.05)} castShadow receiveShadow>
            <boxGeometry args={[Math.min(42, d.fw * 0.35), 1.2, 24]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export const tv: DeviceModule = {
  id: 'tv',
  name: { fr: 'TV', en: 'TV' },
  category: 'signage',
  anchor: 'bottom',
  size: [123, 79, 24],
  sizeFor: (p) => {
    const d = tvDims(p);
    const onWall = p.mount === 'wall';
    return { size: [d.fw, d.fh + (onWall ? 0 : TV_STAND_H), onWall ? 3 : 24], y0: onWall ? TV_WALL_BOTTOM : 0, focus: [0, (onWall ? TV_WALL_BOTTOM : TV_STAND_H) + d.fh / 2, 0] };
  },
  surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: 16 / 9, nativeSize: [3840, 2160] }],
  finishes: HOUSINGS,
  defaultFinish: 'black',
  params: [
    {
      id: 'size',
      kind: 'choice',
      label: { fr: 'Diagonale', en: 'Size' },
      options: [
        { value: '43', label: { fr: '43"', en: '43"' } },
        { value: '55', label: { fr: '55"', en: '55"' } },
        { value: '65', label: { fr: '65"', en: '65"' } },
      ],
      default: '55',
    },
    {
      // not 'orientation': that id makes the stage turn the whole device
      id: 'format',
      kind: 'choice',
      label: { fr: 'Orientation', en: 'Orientation' },
      options: [
        { value: 'landscape', label: { fr: 'Paysage', en: 'Landscape' } },
        { value: 'portrait', label: { fr: 'Portrait', en: 'Portrait' } },
      ],
      default: 'landscape',
    },
    {
      id: 'mount',
      kind: 'choice',
      label: { fr: 'Installation', en: 'Mount' },
      options: [
        { value: 'stand', label: { fr: 'Sur pied', en: 'On a stand' } },
        { value: 'wall', label: { fr: 'Au mur', en: 'On the wall' } },
      ],
      default: 'wall',
    },
    WALL_PARAM,
  ],
  view: { target: [0, 0, 0], offset: [30, 6, 110] },
  yaw: -0.2,
  Component: Tv,
};

/* ------------------------------------------------------------ totem */

const TOTEM = screenSize(55);
const T_W = TOTEM.h + 7;
const T_H = 186;
const T_D = 9;
const T_SCREEN_TOP = T_H - 4;

function Totem({ surfaces, screen, finish }: DeviceProps) {
  // Portrait 55": the 16:9 panel turned on its side.
  const material = useScreenMaterial(surfaces.screen, TOTEM.w / TOTEM.h, screen, { rotated: true });
  const g = useMemo(
    () => ({
      housing: roundedSlab({ width: T_W, height: T_H - 3, radius: 2.4, thickness: T_D, front: 0.3, back: { d: 1.2, z: 1 }, smooth: 0.5, segments: 16, edgeSegments: 6 }),
      base: roundedSlab({ width: T_W + 8, height: 44, radius: 4, thickness: 2.4, front: { d: 0.6, z: 0.6 }, back: 0.2, smooth: 0.5, segments: 16, edgeSegments: 6 }),
      glass: roundedPlane(T_W - 0.4, T_H - 3.4, 2.2, { smooth: 0.5, segments: 16 }),
      display: roundedPlane(TOTEM.w, TOTEM.h, 0.1, { segments: 2 }),
    }),
    [],
  );
  const body = finish.id === 'silver' ? brushedMetal(finish.colors.metal, 0.38, 0.05) : mattePlastic(finish.colors.body, 0.45);
  const screenCenter = T_SCREEN_TOP - TOTEM.w / 2 - 2;
  return (
    <group>
      <mesh geometry={g.base} material={body} position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={g.housing} material={body} position={[0, 2.4 + (T_H - 3) / 2, 0]} castShadow receiveShadow />
      <group position={[0, 2.4 + (T_H - 3) / 2, T_D / 2 + 0.02]}>
        <mesh geometry={g.glass} material={coverGlass()} />
        <mesh geometry={g.display} material={material} position={[0, screenCenter - (2.4 + (T_H - 3) / 2), 0.012]} rotation={[0, 0, Math.PI / 2]} />
      </group>
    </group>
  );
}

export const totem: DeviceModule = {
  id: 'totem',
  name: { fr: 'Totem numérique', en: 'Digital totem' },
  category: 'signage',
  anchor: 'bottom',
  size: [T_W + 8, T_H, 44],
  sizeFor: () => ({ size: [T_W + 8, T_H, 44], focus: [0, T_SCREEN_TOP - TOTEM.w / 2, 0] }),
  surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: TOTEM.h / TOTEM.w, nativeSize: [2160, 3840] }],
  finishes: HOUSINGS,
  defaultFinish: 'black',
  view: { target: [0, 95, 0], offset: [34, 4, 120] },
  yaw: -0.3,
  Component: Totem,
};

/* ------------------------------------------------------------ backlit street poster */

const M_W = 116;
const M_H = 171;
const M_FRAME = 6;
const M_BOTTOM = 32;

function StreetPoster({ surfaces, screen, finish, params }: DeviceProps) {
  // Backlit print: rendered as an emissive surface, slightly diffused (no glossy screen glare).
  const material = useScreenMaterial(surfaces.screen, M_W / M_H, { ...screen, reflection: Math.min(screen.reflection, 0.35) });
  const metal = brushedMetal(finish.colors.metal, 0.38, 0.05);
  const fw = M_W + M_FRAME * 2;
  const fh = M_H + M_FRAME * 2;
  const twoSided = params.sides === 'two';
  const g = useMemo(
    () => ({
      frame: roundedSlab({ width: fw, height: fh, radius: 3, thickness: 14, front: { d: 1.2, z: 1.2 }, back: { d: 1.2, z: 1.2 }, smooth: 0.5, segments: 12, edgeSegments: 6 }),
      display: roundedPlane(M_W, M_H, 0.2, { segments: 2 }),
    }),
    [fw, fh],
  );
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (fw / 2 - 12), M_BOTTOM / 2, 0]} material={metal} castShadow>
          <boxGeometry args={[7, M_BOTTOM + 2, 7]} />
        </mesh>
      ))}
      <group position={[0, M_BOTTOM + fh / 2, 0]}>
        <mesh geometry={g.frame} material={metal} castShadow receiveShadow />
        <mesh geometry={g.display} material={material} position={[0, 0, 7.05]} />
        <mesh position={[0, 0, 7.1]}>
          <planeGeometry args={[M_W, M_H]} />
          <meshPhysicalMaterial color="#ffffff" transparent opacity={0.04} roughness={0.05} clearcoat={1} depthWrite={false} />
        </mesh>
        {twoSided && <mesh geometry={g.display} material={material} position={[0, 0, -7.05]} rotation={[0, Math.PI, 0]} />}
      </group>
    </group>
  );
}

export const streetPoster: DeviceModule = {
  id: 'street-poster',
  name: { fr: 'Panneau lumineux', en: 'Backlit street poster' },
  category: 'signage',
  anchor: 'bottom',
  size: [M_W + M_FRAME * 2, M_BOTTOM + M_H + M_FRAME * 2, 14],
  sizeFor: () => ({ size: [M_W + M_FRAME * 2, M_H + M_FRAME * 2, 14], y0: M_BOTTOM }),
  surfaces: [{ id: 'screen', label: { fr: 'Affiche', en: 'Poster' }, aspect: M_W / M_H, nativeSize: [3425, 5050] }],
  finishes: [HOUSINGS[1], HOUSINGS[0], HOUSINGS[2]],
  defaultFinish: 'silver',
  params: [
    {
      id: 'sides',
      kind: 'choice',
      label: { fr: 'Faces', en: 'Sides' },
      options: [
        { value: 'one', label: { fr: 'Une', en: 'One' } },
        { value: 'two', label: { fr: 'Deux', en: 'Two' } },
      ],
      default: 'one',
    },
  ],
  view: { target: [0, 0, 0], offset: [40, 4, 130] },
  yaw: -0.35,
  Component: StreetPoster,
};

