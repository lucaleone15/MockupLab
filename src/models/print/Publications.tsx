import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedSlab } from '@/lib/geometry/sweep';
import type { DeviceFinish, DeviceModule, DeviceProps, ImageAspects, ParamValue } from '../types';
import { useImageAspects } from '../imageAspects';
import { BOOK_SIZES, BROCHURE_SIZES, FIT_PARAM, MAGAZINE_SIZES, paperDims, sizeParam } from './formats';
import { cardGeometry, pageEdgeTexture } from './geometry';
import { PAPER_PARAM, finishOf, paperMaterial, usePrintMaterial } from './shared';

const NO_FINISH: DeviceFinish[] = [{ id: 'default', name: { fr: 'Standard', en: 'Default' }, swatch: '#f4f2ec', colors: {} }];
const deg = THREE.MathUtils.degToRad;

/** Plane facing +Z whose UVs cover [u0, u1] of the texture (one panel of a spread). */
function panelGeometry(w: number, h: number, u0: number, u1: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
  return g;
}

function edgeMaterial(pages: number) {
  const tex = pageEdgeTexture().clone();
  tex.repeat.set(1, pages / 256);
  tex.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.95, sheen: 0.3, sheenColor: new THREE.Color('#fff') });
}

/* ------------------------------------------------------------ tri-fold */

/** One panel of the tri-fold: a third of the open sheet (whose ratio is the inside image's). */
function panelDims(params: Record<string, ParamValue>, aspects?: ImageAspects) {
  const [w, h] = paperDims(BROCHURE_SIZES, params, aspects, 'inside');
  return [w / 3, h] as const;
}

function Brochure({ surfaces, params }: DeviceProps) {
  const [PW, PH] = panelDims(params, useImageAspects(surfaces));
  const finish = finishOf(params);
  const inside = usePrintMaterial(surfaces.inside, (PW * 3) / PH, { finish });
  const outside = usePrintMaterial(surfaces.outside, (PW * 3) / PH, { finish });
  const a = deg(Number(params.fold ?? 20));
  const panels = useMemo(
    () =>
      [0, 1, 2].map((i) => ({
        front: panelGeometry(PW, PH, i / 3, (i + 1) / 3),
        // outside spread runs the other way (panel 0 is under the right-hand outside panel)
        back: (() => {
          const g = new THREE.PlaneGeometry(PW, PH);
          g.rotateY(Math.PI);
          const uv = g.attributes.uv as THREE.BufferAttribute;
          for (let k = 0; k < uv.count; k++) uv.setX(k, (2 - i + uv.getX(k)) / 3);
          return g;
        })(),
      })),
    [PW, PH],
  );
  const showOutside = params.face === 'outside';
  const lift = Math.sin(a) * PW;

  const panel = (i: number) => (
    <group>
      <mesh geometry={panels[i].front} material={inside} castShadow receiveShadow />
      <mesh geometry={panels[i].back} material={outside} castShadow receiveShadow />
    </group>
  );
  // Built lying flat, inside up: middle panel on the floor, side panels lifted at the folds.
  const body = (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <group position={[-PW / 2, 0, 0]} rotation={[0, a, 0]}>
        <group position={[-PW / 2, 0, 0]}>{panel(0)}</group>
      </group>
      {panel(1)}
      <group position={[PW / 2, 0, 0]} rotation={[0, -a, 0]}>
        <group position={[PW / 2, 0, 0]}>{panel(2)}</group>
      </group>
    </group>
  );
  return showOutside ? (
    <group position={[0, lift + 0.02, 0]} rotation={[0, 0, Math.PI]}>
      {body}
    </group>
  ) : (
    <group position={[0, 0.02, 0]}>{body}</group>
  );
}

export const brochure: DeviceModule = {
  id: 'brochure',
  name: { fr: 'Dépliant 3 volets', en: 'Tri-fold brochure' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [30, 4, 21],
  sizeFor: (p, aspects) => {
    const [PW, PH] = panelDims(p, aspects);
    const a = deg(Number(p.fold ?? 20));
    return { size: [PW + 2 * PW * Math.cos(a), PW * Math.sin(a), PH], focus: [0, 0, 0] };
  },
  paperSize: (p, aspects) => paperDims(BROCHURE_SIZES, p, aspects, 'inside'),
  surfaces: [
    { id: 'inside', label: { fr: 'Intérieur', en: 'Inside' }, aspect: 29.7 / 21, nativeSize: [3508, 2480] },
    { id: 'outside', label: { fr: 'Extérieur', en: 'Outside' }, aspect: 29.7 / 21, nativeSize: [3508, 2480] },
  ],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(BROCHURE_SIZES, 'a4'),
    {
      id: 'face',
      kind: 'choice',
      label: { fr: 'Face visible', en: 'Showing' },
      options: [
        { value: 'inside', label: { fr: 'Intérieur', en: 'Inside' } },
        { value: 'outside', label: { fr: 'Extérieur', en: 'Outside' } },
      ],
      default: 'inside',
    },
    { id: 'fold', kind: 'slider', label: { fr: 'Ouverture des volets', en: 'Panel angle' }, min: 0, max: 70, step: 1, default: 18, unit: '°' },
    PAPER_PARAM,
  ],
  view: { target: [0, 0, 0], offset: [8, 30, 26] },
  yaw: 0,
  Component: Brochure,
};

/* ------------------------------------------------------------ magazine */

const BLOCK = 0.5;

/** One page: from the open spread's image (half of it) or the closed cover's. */
function pageDims(params: Record<string, ParamValue>, aspects?: ImageAspects) {
  return params.state === 'closed' ? paperDims(MAGAZINE_SIZES, params, aspects, 'cover') : paperDims(MAGAZINE_SIZES, params, aspects, 'spread', 2);
}

/** Page lying open: rises from the gutter and curls slightly at the outer edge. */
function pageGeometry(side: -1 | 1, MW: number, MH: number) {
  const g = new THREE.PlaneGeometry(MW, MH, 60, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + MW / 2; // 0 at the gutter → MW at the outer edge
    const d = x;
    const z = 0.12 + 0.62 * (1 - Math.exp(-d / 1.6)) - 0.18 * Math.max(0, (d - MW + 3) / 3) ** 2;
    pos.setXYZ(i, side * x, pos.getY(i), z);
    // spread: left page = u 0..0.5, right page = 0.5..1
    uv.setX(i, side < 0 ? 0.5 - uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
  }
  if (side < 0) {
    // mirrored in x: flip winding back to face +Z
    const idx = g.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
  }
  g.computeVertexNormals();
  return g;
}

function Magazine({ surfaces, params }: DeviceProps) {
  const [MW, MH] = pageDims(params, useImageAspects(surfaces));
  const finish = finishOf(params);
  const cover = usePrintMaterial(surfaces.cover, MW / MH, { finish: finish === 'matte' ? 'satin' : finish });
  const spread = usePrintMaterial(surfaces.spread, (MW * 2) / MH, { finish: 'matte' });
  const g = useMemo(
    () => ({
      closed: cardGeometry(MW, MH, BLOCK, 0.08),
      left: pageGeometry(-1, MW, MH),
      right: pageGeometry(1, MW, MH),
      block: roundedSlab({ width: MW - 3.5, height: MH - 0.1, radius: 0.05, thickness: 0.45, smooth: 0, segments: 2, edgeSegments: 1 }),
    }),
    [MW, MH],
  );
  const edges = useMemo(() => edgeMaterial(60), []);
  if (params.state === 'closed') {
    return (
      <group position={[0, BLOCK / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.closed.edge} material={edges} castShadow receiveShadow />
        <mesh geometry={g.closed.front} material={cover} castShadow receiveShadow />
        <mesh geometry={g.closed.back} material={paperMaterial()} />
      </group>
    );
  }
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* page blocks under each half (kept away from the gutter, which dips) */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.block} material={edges} position={[s * (MW / 2 + 1.75), 0, 0.225]} castShadow receiveShadow />
      ))}
      <mesh geometry={g.left} material={spread} castShadow receiveShadow />
      <mesh geometry={g.right} material={spread} castShadow receiveShadow />
    </group>
  );
}

export const magazine: DeviceModule = {
  id: 'magazine',
  name: { fr: 'Magazine', en: 'Magazine' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [42, 1, 27.5],
  sizeFor: (p, aspects) => {
    const [MW, MH] = pageDims(p, aspects);
    return { size: p.state === 'closed' ? [MW, BLOCK, MH] : [MW * 2, 0.8, MH], focus: [0, 0, 0] };
  },
  paperSize: (p, aspects) => pageDims(p, aspects),
  surfaces: [
    { id: 'spread', label: { fr: 'Double page', en: 'Spread' }, aspect: 42 / 27.5, nativeSize: [4961, 3248] },
    { id: 'cover', label: { fr: 'Couverture', en: 'Cover' }, aspect: 21 / 27.5, nativeSize: [2480, 3248] },
  ],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(MAGAZINE_SIZES, 'mag'),
    {
      id: 'state',
      kind: 'choice',
      label: { fr: 'État', en: 'State' },
      options: [
        { value: 'open', label: { fr: 'Ouvert', en: 'Open' } },
        { value: 'closed', label: { fr: 'Fermé', en: 'Closed' } },
      ],
      default: 'open',
    },
    PAPER_PARAM,
  ],
  view: { target: [0, 0, 0], offset: [6, 34, 24] },
  yaw: 0,
  Component: Magazine,
};

/* ------------------------------------------------------------ book */

const BD = 3.2;
const BOARD = 0.3;

function Book({ surfaces, params }: DeviceProps) {
  const [BW, BH] = paperDims(BOOK_SIZES, params, useImageAspects(surfaces), 'cover');
  const finish = finishOf(params);
  const cover = usePrintMaterial(surfaces.cover, BW / BH, { finish });
  const spine = usePrintMaterial(surfaces.spine, BD / BH, { finish });
  const cloth = useMemo(() => new THREE.MeshPhysicalMaterial({ color: String(params.cloth), roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') }), [params.cloth]);
  const g = useMemo(
    () => ({
      board: roundedSlab({ width: BW, height: BH, radius: 0.15, thickness: BOARD, front: 0.08, back: 0.08, smooth: 0.3, segments: 4, edgeSegments: 3 }),
    }),
    [BW, BH],
  );
  const edges = useMemo(() => {
    const m = edgeMaterial(300);
    return [m, m, m, m, paperMaterial(), paperMaterial()];
  }, []);
  const inner = BD - BOARD * 2;
  return (
    <group position={[0, BH / 2, 0]}>
      {/* boards: front (printed face on top) and back */}
      <mesh geometry={g.board} material={cloth} position={[0, 0, inner / 2 + BOARD / 2]} castShadow receiveShadow />
      <mesh position={[0, 0, inner / 2 + BOARD + 0.002]} material={cover}>
        <planeGeometry args={[BW - 0.1, BH - 0.1]} />
      </mesh>
      <mesh geometry={g.board} material={cloth} position={[0, 0, -inner / 2 - BOARD / 2]} castShadow receiveShadow />
      {/* page block, set back from the edges like a real hardcover */}
      <mesh position={[0.15, 0, 0]} material={edges} castShadow receiveShadow>
        <boxGeometry args={[BW - 0.6, BH - 0.6, inner]} />
      </mesh>
      {/* spine */}
      <mesh position={[-BW / 2 - 0.02, 0, 0]} material={cloth} castShadow>
        <boxGeometry args={[0.32, BH, BD]} />
      </mesh>
      <mesh position={[-BW / 2 - 0.185, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={spine}>
        <planeGeometry args={[BD - 0.05, BH - 0.1]} />
      </mesh>
    </group>
  );
}

export const book: DeviceModule = {
  id: 'book',
  name: { fr: 'Livre', en: 'Book' },
  category: 'print',
  surfaceKind: 'print',
  anchor: 'bottom',
  size: [15.9, 23.5, BD],
  sizeFor: (p, aspects) => {
    const [w, h] = paperDims(BOOK_SIZES, p, aspects, 'cover');
    return { size: [w + 0.4, h, BD] };
  },
  paperSize: (p, aspects) => paperDims(BOOK_SIZES, p, aspects, 'cover'),
  surfaces: [
    { id: 'cover', label: { fr: 'Couverture', en: 'Cover' }, aspect: 15.5 / 23.5, nativeSize: [1831, 2776] },
    { id: 'spine', label: { fr: 'Dos', en: 'Spine' }, aspect: BD / 23.5, nativeSize: [378, 2776] },
  ],
  finishes: NO_FINISH,
  defaultFinish: 'default',
  params: [
    FIT_PARAM,
    sizeParam(BOOK_SIZES, 'large'),
    {
      id: 'cloth',
      kind: 'swatch',
      label: { fr: 'Toile', en: 'Cloth' },
      options: [
        { value: '#1f2430', label: { fr: 'Marine', en: 'Navy' } },
        { value: '#2b2b2d', label: { fr: 'Noir', en: 'Black' } },
        { value: '#e9e3d6', label: { fr: 'Écru', en: 'Ecru' } },
        { value: '#a64b35', label: { fr: 'Brique', en: 'Brick' } },
        { value: '#5d6b55', label: { fr: 'Olive', en: 'Olive' } },
      ],
      default: '#2b2b2d',
    },
    { ...PAPER_PARAM, default: 'satin' } as typeof PAPER_PARAM,
  ],
  view: { target: [0, 11.75, 0], offset: [-6, 6, 60] },
  yaw: 0.55,
  Component: Book,
};
