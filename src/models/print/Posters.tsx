import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedSlab } from '@/lib/geometry/sweep';
import { brushedMetal, mattePlastic } from '@/scene/materials';
import { useRealMaterial } from '@/scene/realMaterials';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';
import { cardGeometry } from './geometry';
import { WallShadow } from '../shared/wall';
import { PAPER_PARAM, finishOf, paperMaterial, usePrintMaterial } from './shared';

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];
const A = Math.SQRT2;

/* ------------------------------------------------------------ poster */

const POSTER_FORMATS: Record<string, number> = { a3: 29.7, a2: 42, a1: 59.4 };
const FRAME_COLORS: Record<string, string> = { black: '#1b1b1d', white: '#efeeea', oak: 'oak' };
const LEAN = THREE.MathUtils.degToRad(7);
const HANG_BOTTOM = 92;

function posterDims(params: Record<string, unknown>) {
  const w = POSTER_FORMATS[String(params.format)] ?? POSTER_FORMATS.a2;
  const h = w * A;
  const framed = params.frame !== 'none';
  const bar = framed ? Math.max(1.6, w * 0.045) : 0;
  const mat = framed && params.mat === true ? w * 0.09 : 0;
  const fw = w + 2 * (mat + bar);
  const fh = h + 2 * (mat + bar);
  return { w, h, framed, bar, mat, fw, fh, depth: framed ? 2.4 : 0.4 };
}

/** Thin glass in front of a framed print: only its reflections show. */
const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.035, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false });

function Frame({ fw, fh, bar, depth, color }: { fw: number; fh: number; bar: number; depth: number; color: string }) {
  const oak = useRealMaterial('oak', fw, fh);
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.4 }), [color]);
  const material = color === 'oak' ? oak : paint;
  const bars: [number, number, number, number][] = [
    [0, fh / 2 - bar / 2, fw, bar],
    [0, -fh / 2 + bar / 2, fw, bar],
    [-fw / 2 + bar / 2, 0, bar, fh - bar * 2],
    [fw / 2 - bar / 2, 0, bar, fh - bar * 2],
  ];
  return (
    <group>
      {bars.map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]} material={material} castShadow receiveShadow>
          <boxGeometry args={[w, h, depth]} />
        </mesh>
      ))}
      {/* backing board */}
      <mesh position={[0, 0, -depth / 2 + 0.15]} material={paperMaterial('#e9e6df')}>
        <boxGeometry args={[fw - bar, fh - bar, 0.3]} />
      </mesh>
    </group>
  );
}

function Poster({ surfaces, params }: DeviceProps) {
  const d = posterDims(params);
  const print = usePrintMaterial(surfaces.poster, 1 / A, { finish: finishOf(params) });
  const board = useMemo(() => cardGeometry(d.w, d.h, d.framed ? 0.05 : 0.5, 0.02), [d.w, d.h, d.framed]);
  const onWall = params.mount !== 'lean';
  const showWall = params.wallOn !== false;

  const art = (
    <group>
      {d.framed && <Frame fw={d.fw} fh={d.fh} bar={d.bar} depth={d.depth} color={FRAME_COLORS[String(params.frame)] ?? '#1b1b1d'} />}
      {d.mat > 0 && (
        <mesh position={[0, 0, -d.depth / 2 + 0.35]} material={paperMaterial('#f6f4ef', 0.95)} receiveShadow>
          <boxGeometry args={[d.fw - d.bar * 2, d.fh - d.bar * 2, 0.15]} />
        </mesh>
      )}
      <group position={[0, 0, d.framed ? -d.depth / 2 + 0.47 : 0]}>
        <mesh geometry={board.edge} material={paperMaterial('#f2f0ea')} castShadow />
        <mesh geometry={board.front} material={print} castShadow receiveShadow />
        <mesh geometry={board.back} material={paperMaterial()} />
      </group>
      {d.framed && (
        <mesh position={[0, 0, d.depth / 2 - 0.25]} material={glass} renderOrder={2}>
          <planeGeometry args={[d.fw - d.bar * 2, d.fh - d.bar * 2]} />
        </mesh>
      )}
    </group>
  );

  if (onWall) {
    return (
      <group>
        <group position={[0, HANG_BOTTOM + d.fh / 2, 0]}>
          {art}
          {showWall && <WallShadow w={d.fw} h={d.fh} z={-d.depth / 2 - 0.03} />}
        </group>
      </group>
    );
  }
  // Leaning against the wall, standing on the floor (the stage draws the wall).
  return (
    <group>
      <group position={[0, (Math.cos(LEAN) * d.fh) / 2, -Math.sin(LEAN) * (d.fh / 2)]} rotation={[-LEAN, 0, 0]}>
        {art}
      </group>
    </group>
  );
}

export const poster: DeviceModule = {
  id: 'poster',
  name: { fr: 'Affiche', en: 'Poster' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [50, 66, 3],
  sizeFor: (p) => {
    const d = posterDims(p);
    const wall = p.mount !== 'lean';
    return { size: [d.fw, d.fh, wall ? d.depth : d.depth + Math.sin(LEAN) * d.fh], y0: wall ? HANG_BOTTOM : 0 };
  },
  wallFor: (p) => {
    if (p.wallOn === false) return null;
    const d = posterDims(p);
    const z = p.mount !== 'lean' ? -d.depth / 2 - 0.05 : -d.depth / 2 - Math.sin(LEAN) * d.fh - 0.2;
    return { z, color: String(p.wall) };
  },
  surfaces: [{ id: 'poster', label: { fr: 'Affiche', en: 'Poster' }, aspect: 1 / A, nativeSize: [4961, 7016] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    {
      id: 'format',
      kind: 'choice',
      label: { fr: 'Format', en: 'Size' },
      options: [
        { value: 'a3', label: { fr: 'A3', en: 'A3' } },
        { value: 'a2', label: { fr: 'A2', en: 'A2' } },
        { value: 'a1', label: { fr: 'A1', en: 'A1' } },
      ],
      default: 'a2',
    },
    {
      id: 'frame',
      kind: 'choice',
      label: { fr: 'Cadre', en: 'Frame' },
      options: [
        { value: 'none', label: { fr: 'Aucun', en: 'None' } },
        { value: 'black', label: { fr: 'Noir', en: 'Black' } },
        { value: 'white', label: { fr: 'Blanc', en: 'White' } },
        { value: 'oak', label: { fr: 'Chêne', en: 'Oak' } },
      ],
      default: 'black',
    },
    { id: 'mat', kind: 'toggle', label: { fr: 'Passe-partout', en: 'Mat' }, default: true },
    {
      id: 'mount',
      kind: 'choice',
      label: { fr: 'Accrochage', en: 'Mount' },
      options: [
        { value: 'wall', label: { fr: 'Au mur', en: 'On the wall' } },
        { value: 'lean', label: { fr: 'Posée', en: 'Leaning' } },
      ],
      default: 'wall',
    },
    { id: 'wallOn', kind: 'toggle', label: { fr: 'Mur', en: 'Wall' }, default: true },
    {
      id: 'wall',
      kind: 'swatch',
      label: { fr: 'Couleur du mur', en: 'Wall colour' },
      options: [
        { value: '#ece6dc', label: { fr: 'Blanc chaud', en: 'Warm white' } },
        { value: '#d9c8b0', label: { fr: 'Sable', en: 'Sand' } },
        { value: '#b9c2ae', label: { fr: 'Sauge', en: 'Sage' } },
        { value: '#c98a6b', label: { fr: 'Terracotta', en: 'Terracotta' } },
        { value: '#aebccb', label: { fr: 'Bleu poudré', en: 'Powder blue' } },
        { value: '#3a3a3d', label: { fr: 'Anthracite', en: 'Charcoal' } },
      ],
      default: '#ece6dc',
    },
    PAPER_PARAM,
  ],
  view: { target: [0, 0, 0], offset: [18, 4, 100] },
  yaw: 0,
  Component: Poster,
};

/* ------------------------------------------------------------ roll-up */

const RU_W = 85;
const RU_H = 200;

function RollUp({ surfaces, params }: DeviceProps) {
  const print = usePrintMaterial(surfaces.banner, RU_W / RU_H, { finish: finishOf(params) });
  const g = useMemo(
    () => ({
      base: roundedSlab({ width: 90, height: 24, radius: 4, thickness: 9, front: { d: 2.4, z: 2.4 }, back: 0.4, smooth: 0.6, segments: 16, edgeSegments: 8 }),
      banner: cardGeometry(RU_W, RU_H, 0.05, 0.01),
    }),
    [],
  );
  const alu = brushedMetal('#c9cbce', 0.35, 0.3);
  return (
    <group>
      <mesh geometry={g.base} material={alu} position={[0, 4.5, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      {/* end caps of the cassette */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 44.8, 4.5, 0]} material={mattePlastic('#2a2a2c', 0.5)}>
          <boxGeometry args={[0.6, 8.6, 23]} />
        </mesh>
      ))}
      {/* pole behind the banner */}
      <mesh position={[0, 9 + RU_H / 2, -2]} material={alu} castShadow>
        <cylinderGeometry args={[0.8, 0.8, RU_H, 24]} />
      </mesh>
      <group position={[0, 9 + RU_H / 2, 0]}>
        <mesh geometry={g.banner.edge} material={paperMaterial()} />
        <mesh geometry={g.banner.front} material={print} castShadow receiveShadow />
        <mesh geometry={g.banner.back} material={paperMaterial('#e6e6e6')} castShadow />
      </group>
      {/* top rail */}
      <mesh position={[0, 9 + RU_H + 1, 0]} material={alu} castShadow>
        <boxGeometry args={[RU_W + 1, 2.4, 1.6]} />
      </mesh>
    </group>
  );
}

export const rollUp: DeviceModule = {
  id: 'roll-up',
  name: { fr: 'Roll-up', en: 'Roll-up banner' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [90, 212, 24],
  surfaces: [{ id: 'banner', label: { fr: 'Bannière', en: 'Banner' }, aspect: RU_W / RU_H, nativeSize: [2008, 4724] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [{ ...PAPER_PARAM, default: 'satin' } as typeof PAPER_PARAM],
  view: { target: [0, 105, 0], offset: [40, 10, 120] },
  yaw: -0.25,
  Component: RollUp,
};
