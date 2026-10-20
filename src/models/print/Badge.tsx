import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedPlane } from '@/lib/geometry/sweep';
import { cavity, polishedMetal } from '@/scene/materials';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';
import { cardGeometry, ribbonGeometry } from './geometry';
import { PAPER_PARAM, finishOf, paperMaterial, useFabricMaterial, usePrintMaterial } from './shared';
import { BADGE_SIZES, FIT_PARAM, paperDims, sizeParam } from './formats';
import { useImageAspects } from '../imageAspects';

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];

const T = 0.08;
/** The badge sits towards the viewer, the lanyard loop runs away from it. */
const BADGE_Z = 14;

/** Conference badge (PVC card) on a woven lanyard, laid flat. */
function Badge({ surfaces, params }: DeviceProps) {
  const [W, H] = paperDims(BADGE_SIZES, params, useImageAspects(surfaces), 'badge');
  const print = usePrintMaterial(surfaces.badge, W / H, { finish: finishOf(params) });
  const g = useMemo(() => {
    const top = BADGE_Z - H / 2 - 1.4;
    const loop = [
      new THREE.Vector3(-0.6, 0.35, top + 0.4),
      new THREE.Vector3(-1.4, 0.12, top - 3),
      new THREE.Vector3(-6.5, 0.06, top - 14),
      new THREE.Vector3(-9, 0.05, top - 24),
      new THREE.Vector3(-4, 0.05, top - 31),
      new THREE.Vector3(4.5, 0.05, top - 30),
      new THREE.Vector3(8.5, 0.05, top - 21),
      new THREE.Vector3(5.5, 0.06, top - 11),
      new THREE.Vector3(1.4, 0.12, top - 2.8),
      new THREE.Vector3(0.6, 0.35, top + 0.4),
    ];
    return {
      card: cardGeometry(W, H, T, 0.35),
      slot: roundedPlane(1.5, 0.32, 0.16, { smooth: 0, segments: 8 }),
      ribbon: ribbonGeometry(loop, 1.5, 260),
    };
  }, [W, H]);
  const strap = useFabricMaterial(null, 8, { color: String(params.strap) });
  const metal = polishedMetal('#b9bcc1');
  return (
    <group>
      <group position={[0, T / 2, BADGE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.card.edge} material={paperMaterial('#f2f2f2', 0.4)} castShadow receiveShadow />
        <mesh geometry={g.card.front} material={print} castShadow receiveShadow />
        <mesh geometry={g.card.back} material={paperMaterial('#f2f2f2', 0.4)} />
        <mesh geometry={g.slot} material={cavity()} position={[0, H / 2 - 0.6, T / 2 + 0.003]} />
      </group>
      {/* clip: plate + swivel ring */}
      <mesh position={[0, 0.2, BADGE_Z - H / 2 - 0.55]} material={metal} castShadow>
        <boxGeometry args={[1.1, 0.25, 1.2]} />
      </mesh>
      <mesh position={[0, 0.3, BADGE_Z - H / 2 - 1.5]} rotation={[-Math.PI / 2, 0, 0]} material={metal} castShadow>
        <torusGeometry args={[0.55, 0.09, 12, 32]} />
      </mesh>
      <mesh geometry={g.ribbon} material={strap} castShadow receiveShadow />
    </group>
  );
}

export const badge: DeviceModule = {
  id: 'badge',
  name: { fr: 'Badge', en: 'Badge' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [20, 0.6, 38],
  // the lanyard loop runs 31 cm behind the clip, above the badge
  sizeFor: (p, aspects) => {
    const [w, h] = paperDims(BADGE_SIZES, p, aspects, 'badge');
    return { size: [Math.max(20, w), 0.6, h + 32.4], focus: [0, 0, BADGE_Z] };
  },
  paperSize: (p, aspects) => paperDims(BADGE_SIZES, p, aspects, 'badge'),
  surfaces: [{ id: 'badge', label: { fr: 'Badge', en: 'Badge' }, aspect: 5.4 / 8.6, nativeSize: [638, 1016] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(BADGE_SIZES, 'cr80'),
    {
      id: 'strap',
      kind: 'swatch',
      label: { fr: 'Tour de cou', en: 'Lanyard' },
      options: [
        { value: '#1d1d1f', label: { fr: 'Noir', en: 'Black' } },
        { value: '#f2f0ea', label: { fr: 'Blanc', en: 'White' } },
        { value: '#ff5c35', label: { fr: 'Orange', en: 'Orange' } },
        { value: '#2c3f73', label: { fr: 'Bleu', en: 'Blue' } },
        { value: '#5f7a57', label: { fr: 'Vert', en: 'Green' } },
      ],
      default: '#1d1d1f',
    },
    { ...PAPER_PARAM, default: 'gloss' } as typeof PAPER_PARAM,
  ],
  view: { target: [0, 0, 0], offset: [6, 36, 24] },
  yaw: -0.1,
  Component: Badge,
};
