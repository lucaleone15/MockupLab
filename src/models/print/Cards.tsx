import { useMemo } from 'react';
import * as THREE from 'three';
import type { I18nString } from '@/i18n';
import type { SurfaceBinding } from '@/store/project';
import type { DeviceFinish, DeviceModule, DeviceProps, ImageAspects, ParamDef, ParamValue } from '../types';
import { useImageAspects } from '../imageAspects';
import { CARD_SIZES, ENVELOPE_SIZES, FIT_PARAM, FLYER_SIZES, LETTER_SIZES, POSTCARD_SIZES, paperDims, sizeParam, type PaperSize } from './formats';
import { cardGeometry, pageEdgeTexture, sheetGeometry } from './geometry';
import { PAPER_PARAM, finishOf, paperMaterial, usePrintMaterial, type PaperFinish } from './shared';

/*
 * Flat paper goods: business cards, postcards, flyers, letterheads and envelopes. They lie
 * on the floor, front face up, one by default; "pair" layouts show the back next to the front.
 */

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];

const FLAT_VIEW = { target: [0, 0, 0] as [number, number, number], offset: [10, 34, 30] as [number, number, number] };

const side = (fr: string, en: string): I18nString => ({ fr, en });

/** A card lying flat; `flip` shows its back. */
function Card({
  w,
  h,
  t,
  r,
  front,
  back,
  flip = false,
  position,
  yaw = 0,
}: {
  w: number;
  h: number;
  t: number;
  r: number;
  front: THREE.Material;
  back: THREE.Material;
  flip?: boolean;
  position: [number, number, number];
  yaw?: number;
}) {
  const g = useMemo(() => cardGeometry(w, h, t, r), [w, h, t, r]);
  return (
    <group position={[position[0], position[1] + t / 2, position[2]]} rotation={[0, yaw, 0]}>
      <group rotation={[flip ? Math.PI / 2 : -Math.PI / 2, 0, flip ? Math.PI : 0]}>
        <mesh geometry={g.edge} material={paperMaterial()} castShadow receiveShadow />
        <mesh geometry={g.front} material={front} castShadow receiveShadow />
        <mesh geometry={g.back} material={back} receiveShadow />
      </group>
    </group>
  );
}

/** A stack of `count` cards with visible paper edges; the top shows the front. */
function Stack({ w, h, t, r, count, front, position, yaw }: { w: number; h: number; t: number; r: number; count: number; front: THREE.Material; position: [number, number, number]; yaw: number }) {
  const height = t * count;
  const g = useMemo(() => cardGeometry(w, h, height, r), [w, h, height, r]);
  const edge = useMemo(() => {
    const tex = pageEdgeTexture().clone();
    tex.repeat.set(1, (count * 2) / 512);
    tex.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.95, sheen: 0.3, sheenColor: new THREE.Color('#fff') });
  }, [count]);
  return (
    <group position={[position[0], height / 2, position[2]]} rotation={[0, yaw, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.edge} material={edge} castShadow receiveShadow />
        <mesh geometry={g.front} material={front} castShadow receiveShadow />
        <mesh geometry={g.back} material={paperMaterial()} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------ cards */

interface CardSpec {
  id: string;
  name: I18nString;
  sizes: PaperSize[];
  defaultSize: string;
  t: number;
  native: [number, number];
  stack: boolean;
}

const layoutParam = (stack: boolean): ParamDef => ({
  id: 'layout',
  kind: 'choice',
  label: { fr: 'Présentation', en: 'Layout' },
  options: [
    { value: 'single', label: { fr: 'Seule', en: 'Single' } },
    { value: 'pair', label: { fr: 'Recto/verso', en: 'Both sides' } },
    ...(stack ? [{ value: 'stack', label: { fr: 'Pile', en: 'Stack' } }] : []),
  ],
  // one object by default (nothing shows twice); « Recto/verso » shows both sides
  default: 'single',
});

const CORNERS_PARAM: ParamDef = {
  id: 'corners',
  kind: 'choice',
  label: { fr: 'Coins', en: 'Corners' },
  options: [
    { value: 'square', label: { fr: 'Droits', en: 'Square' } },
    { value: 'rounded', label: { fr: 'Arrondis', en: 'Rounded' } },
  ],
  default: 'square',
  advanced: true,
};

function usePrintPair(surfaces: Record<string, SurfaceBinding>, aspect: number, finish: PaperFinish) {
  const front = usePrintMaterial(surfaces.front, aspect, { finish });
  const back = usePrintMaterial(surfaces.back, aspect, { finish });
  return { front, back };
}

function defineCard(spec: CardSpec): DeviceModule {
  const { t } = spec;
  const gap = 0.9;
  const dims = (params: Record<string, ParamValue>, aspects?: ImageAspects) => paperDims(spec.sizes, params, aspects, 'front');
  const boxes = (w: number, h: number): Record<string, [number, number, number]> => ({
    single: [w, t, h],
    pair: [w * 2 + gap, t, h * 1.15],
    stack: [w * 2 + gap * 2, t * 36, h * 1.2],
  });
  const first = spec.sizes.find((x) => x.value === spec.defaultSize) ?? spec.sizes[0];

  function Component({ surfaces, params }: DeviceProps) {
    const [w, h] = dims(params, useImageAspects(surfaces));
    const { front, back } = usePrintPair(surfaces, w / h, finishOf(params));
    const r = params.corners === 'rounded' ? Math.min(w, h) * 0.06 : 0.02;
    const layout = String(params.layout);
    if (layout === 'single') return <Card w={w} h={h} t={t} r={r} front={front} back={back} position={[0, 0, 0]} />;
    if (layout === 'stack' && spec.stack)
      return (
        <group>
          <Stack w={w} h={h} t={t} r={r} count={36} front={front} position={[-w / 2 - gap, 0, 0]} yaw={0.04} />
          <Card w={w} h={h} t={t} r={r} front={front} back={back} flip position={[w / 2 + gap, 0, h * 0.12]} yaw={-0.14} />
        </group>
      );
    return (
      <group>
        <Card w={w} h={h} t={t} r={r} front={front} back={back} position={[-w / 2 - gap / 2, 0, -h * 0.06]} yaw={0.07} />
        <Card w={w} h={h} t={t} r={r} front={front} back={back} flip position={[w / 2 + gap / 2, 0, h * 0.06]} yaw={-0.09} />
      </group>
    );
  }
  Component.displayName = `Card(${spec.id})`;

  return {
    id: spec.id,
    name: spec.name,
    category: 'print',
    surfaceKind: 'print',
    anchor: 'bottom',
    size: boxes(first.w, first.h).pair,
    paperSize: (p, aspects) => dims(p, aspects),
    sizeFor: (p, aspects) => {
      const [w, h] = dims(p, aspects);
      const b = boxes(w, h);
      return { size: b[String(p.layout)] ?? b.pair, focus: [0, 0, 0] };
    },
    surfaces: [
      { id: 'front', label: side('Recto', 'Front'), aspect: first.w / first.h, nativeSize: spec.native },
      { id: 'back', label: side('Verso', 'Back'), aspect: first.w / first.h, nativeSize: spec.native },
    ],
    finishes: NO_FINISH,
    defaultFinish: 'default',
    params: [FIT_PARAM, sizeParam(spec.sizes, spec.defaultSize), layoutParam(spec.stack), PAPER_PARAM, CORNERS_PARAM],
    view: FLAT_VIEW,
    yaw: 0,
    Component,
  };
}

export const businessCard = defineCard({
  id: 'business-card',
  name: { fr: 'Carte de visite', en: 'Business card' },
  sizes: CARD_SIZES,
  defaultSize: 'eu',
  t: 0.045,
  native: [1004, 650],
  stack: true,
});

export const postcard = defineCard({
  id: 'postcard',
  name: { fr: 'Carte postale', en: 'Postcard' },
  sizes: POSTCARD_SIZES,
  defaultSize: 'a6',
  t: 0.04,
  native: [1748, 1240],
  stack: false,
});

/* ------------------------------------------------------------ flyer */


function Sheet({
  w,
  h,
  front,
  back,
  position,
  yaw,
  flip = false,
  curl = 1,
}: {
  w: number;
  h: number;
  front: THREE.Material;
  back: THREE.Material;
  position: [number, number, number];
  yaw: number;
  flip?: boolean;
  /** Corner lift, 0 = perfectly flat (under other objects). */
  curl?: number;
}) {
  // A sheet lying on its front curls the other way, so the lifted corner always points up.
  const g = useMemo(() => sheetGeometry(w, h, Math.min(w, h) * 0.035 * curl * (flip ? -1 : 1)), [w, h, flip, curl]);
  return (
    <group position={[position[0], position[1] + 0.02, position[2]]} rotation={[0, yaw, 0]}>
      <group rotation={[flip ? Math.PI / 2 : -Math.PI / 2, 0, flip ? Math.PI : 0]}>
        <mesh geometry={g.front} material={front} castShadow receiveShadow />
        <mesh geometry={g.back} material={back} castShadow receiveShadow />
      </group>
    </group>
  );
}

function Flyer({ surfaces, params }: DeviceProps) {
  const [w, h] = paperDims(FLYER_SIZES, params, useImageAspects(surfaces), 'front');
  const { front, back } = usePrintPair(surfaces, w / h, finishOf(params));
  if (params.layout === 'single') return <Sheet w={w} h={h} front={front} back={back} position={[0, 0, 0]} yaw={0} />;
  return (
    <group>
      <Sheet w={w} h={h} front={front} back={back} position={[-w / 2 - 1, 0, -h * 0.03]} yaw={0.05} />
      <Sheet w={w} h={h} front={front} back={back} flip position={[w / 2 + 1, 0, h * 0.03]} yaw={-0.07} />
    </group>
  );
}

export const flyer: DeviceModule = {
  id: 'flyer',
  name: { fr: 'Flyer', en: 'Flyer' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [44, 1, 31],
  paperSize: (p, aspects) => paperDims(FLYER_SIZES, p, aspects, 'front'),
  sizeFor: (p, aspects) => {
    const [w, h] = paperDims(FLYER_SIZES, p, aspects, 'front');
    return { size: p.layout === 'single' ? [w, 0.6, h] : [w * 2 + 2, 0.6, h * 1.08], focus: [0, 0, 0] };
  },
  surfaces: [
    { id: 'front', label: side('Recto', 'Front'), aspect: 21 / 29.7, nativeSize: [2480, 3508] },
    { id: 'back', label: side('Verso', 'Back'), aspect: 21 / 29.7, nativeSize: [2480, 3508] },
  ],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(FLYER_SIZES, 'a5'),
    layoutParam(false),
    PAPER_PARAM,
  ],
  view: FLAT_VIEW,
  yaw: 0,
  Component: Flyer,
};

/* ------------------------------------------------------------ letterhead, envelope */

function Letterhead({ surfaces, params }: DeviceProps) {
  const [w, h] = paperDims(LETTER_SIZES, params, useImageAspects(surfaces), 'front');
  const front = usePrintMaterial(surfaces.front, w / h, { finish: finishOf(params) });
  return <Sheet w={w} h={h} front={front} back={paperMaterial()} position={[0, 0, 0]} yaw={0} curl={0.4} />;
}

export const letterhead: DeviceModule = {
  id: 'letterhead',
  name: { fr: 'Papier à en-tête', en: 'Letterhead' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [21, 0.6, 29.7],
  paperSize: (p, aspects) => paperDims(LETTER_SIZES, p, aspects, 'front'),
  sizeFor: (p, aspects) => {
    const [w, h] = paperDims(LETTER_SIZES, p, aspects, 'front');
    return { size: [w, 0.6, h], focus: [0, 0, 0] };
  },
  surfaces: [{ id: 'front', label: side('Papier à en-tête', 'Letterhead'), aspect: 21 / 29.7, nativeSize: [2480, 3508] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [FIT_PARAM, sizeParam(LETTER_SIZES, 'a4'), PAPER_PARAM],
  view: FLAT_VIEW,
  yaw: 0,
  Component: Letterhead,
};

/**
 * The back of an envelope: the four flaps folded in (sides first, then the bottom, then the closed top flap on
 * them), each a touch different in tone, with creases along the edges and a soft shadow under the top flap.
 */
function envelopeBackTexture(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = 1536;
  c.height = Math.round((1536 * h) / w);
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const flap = (pts: [number, number][], fill: string, shadow = 0) => {
    g.save();
    if (shadow) {
      g.shadowColor = 'rgba(40,30,20,0.28)';
      g.shadowBlur = shadow;
      g.shadowOffsetY = shadow / 3;
    }
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(60,50,40,0.16)';
    g.lineWidth = W * 0.0012;
    g.stroke();
  };
  g.fillStyle = '#efece5';
  g.fillRect(0, 0, W, H);
  flap([[0, 0], [0.33, 0.52], [0, 1]], '#f2efe9');
  flap([[1, 0], [0.67, 0.52], [1, 1]], '#f2efe9');
  flap([[0, 1], [0.12, 0.5], [0.5, 0.4], [0.88, 0.5], [1, 1]], '#f5f3ee', W * 0.006);
  flap([[0, 0], [1, 0], [0.56, 0.6], [0.5, 0.62], [0.44, 0.6]], '#f7f5f1', W * 0.012);
  // the fold all around: a hair darker at the very edge
  g.strokeStyle = 'rgba(60,50,40,0.22)';
  g.lineWidth = W * 0.004;
  g.strokeRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Envelope({ surfaces, params }: DeviceProps) {
  const [w, h] = paperDims(ENVELOPE_SIZES, params, useImageAspects(surfaces), 'front');
  const front = usePrintMaterial(surfaces.front, w / h, { finish: finishOf(params) });
  const backSide = params.side === 'back';
  const flaps = useMemo(() => {
    if (!backSide) return null;
    return new THREE.MeshPhysicalMaterial({ map: envelopeBackTexture(w, h), roughness: 0.88, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') });
  }, [backSide, w, h]);
  // the back side up shows the flaps; the design is on the face
  return <Card w={w} h={h} t={0.12} r={0.06} front={flaps ?? front} back={backSide ? front : paperMaterial()} position={[0, 0, 0]} />;
}

export const envelope: DeviceModule = {
  id: 'envelope',
  name: { fr: 'Enveloppe', en: 'Envelope' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [22, 0.2, 11],
  paperSize: (p, aspects) => paperDims(ENVELOPE_SIZES, p, aspects, 'front'),
  sizeFor: (p, aspects) => {
    const [w, h] = paperDims(ENVELOPE_SIZES, p, aspects, 'front');
    return { size: [w, 0.2, h], focus: [0, 0, 0] };
  },
  surfaces: [{ id: 'front', label: side('Enveloppe', 'Envelope'), aspect: 2, nativeSize: [2598, 1299] }],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(ENVELOPE_SIZES, 'dl'),
    PAPER_PARAM,
    {
      id: 'side',
      kind: 'choice',
      label: side('Côté', 'Side'),
      options: [
        { value: 'front', label: side('Face', 'Front') },
        { value: 'back', label: side('Dos (rabats)', 'Back (flaps)') },
      ],
      default: 'front',
    },
  ],
  view: FLAT_VIEW,
  yaw: 0,
  Component: Envelope,
};
