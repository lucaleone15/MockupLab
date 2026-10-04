import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DeviceFinish, DeviceModule, DeviceProps, ParamDef } from '../types';
import { PAPER_PARAM, finishOf, paperMaterial, usePrintMaterial } from '../print/shared';

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];

/** Physical material whose colour follows a param (re-renders the frame when it changes). */
function useColoredMaterial(color: string, props: THREE.MeshPhysicalMaterialParameters) {
  const invalidate = useThree((s) => s.invalidate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => new THREE.MeshPhysicalMaterial(props), []);
  useEffect(() => {
    m.color.set(color);
    invalidate();
  }, [m, color, invalidate]);
  useEffect(() => () => m.dispose(), [m]);
  return m;
}

const swatch = (id: string, fr: string, en: string, options: [string, string, string][], def: string): ParamDef => ({
  id,
  kind: 'swatch',
  label: { fr, en },
  options: options.map(([value, f, e]) => ({ value, label: { fr: f, en: e } })),
  default: def,
});

/* ------------------------------------------------------------ box */

const BOX_SHAPES: Record<string, [number, number, number]> = {
  tall: [9, 16, 9],
  cube: [12, 12, 12],
  flat: [22, 6, 16],
};

function Box({ surfaces, params }: DeviceProps) {
  const [w, h, d] = BOX_SHAPES[String(params.shape)] ?? BOX_SHAPES.tall;
  const finish = finishOf(params);
  const front = usePrintMaterial(surfaces.front, w / h, { finish });
  const side = usePrintMaterial(surfaces.side, d / h, { finish });
  const top = usePrintMaterial(surfaces.top, w / d, { finish });
  // BoxGeometry material order: +x, −x, +y, −y, +z, −z
  const materials = useMemo(() => [side, side, top, paperMaterial('#d9cfbf'), front, front], [side, top, front]);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={materials} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* tuck flap seam on the lid: a fine shadow line */}
      <mesh position={[0, h + 0.002, -d / 2 + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.1, 0.04]} />
        <meshBasicMaterial color="#000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

export const box: DeviceModule = {
  id: 'box',
  name: { fr: 'Boîte', en: 'Box' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: BOX_SHAPES.tall,
  sizeFor: (p) => ({ size: BOX_SHAPES[String(p.shape)] ?? BOX_SHAPES.tall }),
  surfaces: [
    { id: 'front', label: { fr: 'Face', en: 'Front' }, aspect: 9 / 16, nativeSize: [1063, 1890] },
    { id: 'side', label: { fr: 'Côté', en: 'Side' }, aspect: 9 / 16, nativeSize: [1063, 1890] },
    { id: 'top', label: { fr: 'Dessus', en: 'Top' }, aspect: 1, nativeSize: [1063, 1063] },
  ],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    {
      id: 'shape',
      kind: 'choice',
      label: { fr: 'Forme', en: 'Shape' },
      options: [
        { value: 'tall', label: { fr: 'Haute', en: 'Tall' } },
        { value: 'cube', label: { fr: 'Cube', en: 'Cube' } },
        { value: 'flat', label: { fr: 'Plate', en: 'Flat' } },
      ],
      default: 'tall',
    },
    PAPER_PARAM,
  ],
  view: { target: [0, 8, 0], offset: [30, 22, 52] },
  yaw: -0.55,
  Component: Box,
};

/* ------------------------------------------------------------ tube */

const TR = 3.5;
const TH = 16;
const CAP = 4.5;

function Tube({ surfaces, params }: DeviceProps) {
  const wrap = usePrintMaterial(surfaces.wrap, (2 * Math.PI * TR) / TH, { finish: finishOf(params) });
  const cap = useColoredMaterial(String(params.cap), { roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color('#fff') });
  return (
    <group>
      {/* printed body: open cylinder, seam at the back */}
      <mesh position={[0, TH / 2, 0]} material={wrap} castShadow receiveShadow>
        <cylinderGeometry args={[TR, TR, TH, 96, 1, true, Math.PI, Math.PI * 2]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={paperMaterial('#cdbfa6')}>
        <circleGeometry args={[TR, 64]} />
      </mesh>
      {/* lid */}
      <mesh position={[0, TH - CAP / 2 + 0.6, 0]} material={cap} castShadow receiveShadow>
        <cylinderGeometry args={[TR + 0.12, TR + 0.12, CAP, 96]} />
      </mesh>
    </group>
  );
}

export const tube: DeviceModule = {
  id: 'tube',
  name: { fr: 'Tube', en: 'Tube' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [TR * 2 + 0.3, TH + 0.6, TR * 2 + 0.3],
  surfaces: [{ id: 'wrap', label: { fr: 'Étiquette', en: 'Wrap' }, aspect: (2 * Math.PI * TR) / TH, nativeSize: [2598, 1890] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    swatch('cap', 'Couvercle', 'Lid', [['#1d1d1f', 'Noir', 'Black'], ['#f1efe9', 'Blanc', 'White'], ['#c7a77f', 'Kraft', 'Kraft'], ['#b5603f', 'Terracotta', 'Terracotta']], '#1d1d1f'),
    PAPER_PARAM,
  ],
  view: { target: [0, 9, 0], offset: [18, 12, 60] },
  yaw: 0,
  Component: Tube,
};

/* ------------------------------------------------------------ mug */

const MR = 4.1;
const MH = 9.6;
/** Printed arc on the front, clear of the handle on the right. */
const PRINT_ARC = 2.5;
const PRINT_H = 7.6;

function mugProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0, 0],
    [MR - 0.45, 0],
    [MR - 0.15, 0.08],
    [MR - 0.02, 0.35],
    [MR, 0.8],
    [MR, MH - 0.2],
    [MR - 0.06, MH - 0.02],
    [MR - 0.2, MH],
    [MR - 0.34, MH - 0.04],
    [MR - 0.4, MH - 0.2],
    [MR - 0.42, 1.2],
    [MR - 0.6, 0.85],
    [0, 0.8],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x, y));
}

function Mug({ surfaces, params }: DeviceProps) {
  const ceramic = useColoredMaterial(String(params.color), { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03 });
  const print = usePrintMaterial(surfaces.print, (MR * PRINT_ARC) / PRINT_H, { base: 'ceramic', paper: String(params.color) });
  const g = useMemo(() => {
    const handle = new THREE.CatmullRomCurve3([
      new THREE.Vector3(MR - 0.2, 7.9, 0),
      new THREE.Vector3(MR + 1.8, 7.9, 0),
      new THREE.Vector3(MR + 2.9, 6.4, 0),
      new THREE.Vector3(MR + 2.6, 3.9, 0),
      new THREE.Vector3(MR + 1.2, 2.6, 0),
      new THREE.Vector3(MR - 0.2, 2.4, 0),
    ]);
    return {
      body: new THREE.LatheGeometry(mugProfile(), 128),
      handle: new THREE.TubeGeometry(handle, 64, 0.52, 20, false),
    };
  }, []);
  return (
    <group>
      <mesh geometry={g.body} material={ceramic} castShadow receiveShadow />
      <mesh geometry={g.handle} material={ceramic} castShadow receiveShadow />
      <mesh position={[0, 1.2 + PRINT_H / 2, 0]} material={print} castShadow>
        <cylinderGeometry args={[MR + 0.012, MR + 0.012, PRINT_H, 96, 1, true, -PRINT_ARC / 2, PRINT_ARC]} />
      </mesh>
    </group>
  );
}

export const mug: DeviceModule = {
  id: 'mug',
  name: { fr: 'Mug', en: 'Mug' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [MR * 2 + 3, MH, MR * 2],
  surfaces: [{ id: 'print', label: { fr: 'Impression', en: 'Print' }, aspect: (MR * PRINT_ARC) / PRINT_H, nativeSize: [1500, 1112], fit: 'contain' }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    swatch(
      'color',
      'Céramique',
      'Ceramic',
      [
        ['#f7f6f2', 'Blanc', 'White'],
        ['#1f1f21', 'Noir', 'Black'],
        ['#e8dcc8', 'Sable', 'Sand'],
        ['#9db0a0', 'Sauge', 'Sage'],
        ['#c46d4e', 'Terracotta', 'Terracotta'],
      ],
      '#f7f6f2',
    ),
  ],
  view: { target: [0, 5, 0], offset: [12, 14, 52] },
  yaw: -0.15,
  Component: Mug,
};

/* ------------------------------------------------------------ bottle */

const BR = 3.7;
const LABEL_ARC = 2.2;
const LABEL_H = 9;

function bottleProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0, 0.6],
    [BR - 0.8, 0.5],
    [BR - 0.2, 0.15],
    [BR, 0.6],
    [BR, 20.5],
    [BR - 0.4, 22.6],
    [2.2, 25],
    [1.5, 27.2],
    [1.45, 29.2],
    [1.6, 29.4],
    [1.6, 30.2],
    [0, 30.2],
  ];
  return p.map(([x, y]) => new THREE.Vector2(x, y));
}

const GLASS: Record<string, { color: string; roughness: number }> = {
  green: { color: '#17301f', roughness: 0.04 },
  amber: { color: '#4a2509', roughness: 0.04 },
  black: { color: '#0d0d0f', roughness: 0.05 },
  frost: { color: '#dfe6e3', roughness: 0.38 },
};

function Bottle({ surfaces, params }: DeviceProps) {
  const spec = GLASS[String(params.glass)] ?? GLASS.green;
  const glass = useColoredMaterial(spec.color, { roughness: spec.roughness, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 });
  glass.roughness = spec.roughness;
  const label = usePrintMaterial(surfaces.label, (BR * LABEL_ARC) / LABEL_H, { finish: finishOf(params) });
  const foil = useColoredMaterial(String(params.cap), { metalness: 0.6, roughness: 0.35 });
  const g = useMemo(() => ({ body: new THREE.LatheGeometry(bottleProfile(), 128) }), []);
  return (
    <group>
      <mesh geometry={g.body} material={glass} castShadow receiveShadow />
      <mesh position={[0, 8.5, 0]} material={label} castShadow>
        <cylinderGeometry args={[BR + 0.015, BR + 0.015, LABEL_H, 96, 1, true, -LABEL_ARC / 2, LABEL_ARC]} />
      </mesh>
      {/* capsule over the neck */}
      <mesh position={[0, 28.1, 0]} material={foil} castShadow>
        <cylinderGeometry args={[1.66, 1.6, 4.4, 48]} />
      </mesh>
    </group>
  );
}

export const bottle: DeviceModule = {
  id: 'bottle',
  name: { fr: 'Bouteille', en: 'Bottle' },
  category: 'merch',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [BR * 2, 30.4, BR * 2],
  surfaces: [{ id: 'label', label: { fr: 'Étiquette', en: 'Label' }, aspect: (BR * LABEL_ARC) / LABEL_H, nativeSize: [962, 1063] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    {
      id: 'glass',
      kind: 'choice',
      label: { fr: 'Verre', en: 'Glass' },
      options: [
        { value: 'green', label: { fr: 'Vert', en: 'Green' } },
        { value: 'amber', label: { fr: 'Ambré', en: 'Amber' } },
        { value: 'black', label: { fr: 'Noir', en: 'Black' } },
        { value: 'frost', label: { fr: 'Dépoli', en: 'Frosted' } },
      ],
      default: 'green',
    },
    swatch('cap', 'Capsule', 'Capsule', [['#1d1d1f', 'Noir', 'Black'], ['#b8954f', 'Or', 'Gold'], ['#8d1f2a', 'Bordeaux', 'Burgundy'], ['#e9e6df', 'Blanc', 'White']], '#1d1d1f'),
    PAPER_PARAM,
  ],
  view: { target: [0, 15, 0], offset: [14, 8, 80] },
  yaw: 0,
  Component: Bottle,
};
