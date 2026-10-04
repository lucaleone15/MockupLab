import { useMemo } from 'react';
import * as THREE from 'three';
import type { I18nString } from '@/i18n';
import { roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { brushedMetal, cavity, coverGlass, lensGlass, mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';

/*
 * Desktop displays. Origin on the floor, centred on the panel; screen faces +Z.
 */

/* ------------------------------------------------------- bent stand */

interface StandSpec {
  width: number;
  thickness: number;
  /** Bend radius (centre line). */
  bend: number;
  /** Foot from its front edge (z) to the start of the bend (z). */
  footFront: number;
  footBack: number;
  /** Column lean from vertical, radians (top leans forward). */
  lean: number;
  /** Height (y) of the column top. */
  top: number;
}

/**
 * One aluminium plate bent into a foot and a leaning column. The bend is built
 * from two cylinder sectors (outer / inner skin) with ring caps, so it shades
 * perfectly smooth.
 */
function BentStand({ s, color }: { s: StandSpec; color: string }) {
  const g = useMemo(() => {
    const t = s.thickness;
    const R = s.bend;
    const sweepAngle = Math.PI / 2 + s.lean;
    const yc = t / 2 + R;
    const endZ = s.footBack - R * Math.cos(s.lean);
    const endY = yc + R * Math.sin(s.lean);
    const length = (s.top - endY) / Math.cos(s.lean);
    const footLen = s.footFront - s.footBack;
    const foot = roundedSlab({
      width: s.width,
      height: footLen,
      radius: [0, 0, 1.2, 1.2],
      thickness: t,
      front: 0.08,
      back: 0.08,
      smooth: 0.5,
      segments: 16,
      edgeSegments: 4,
    });
    const column = roundedSlab({ width: s.width, height: length, radius: [0.6, 0.6, 0, 0], thickness: t, front: 0.08, back: 0.08, segments: 10, edgeSegments: 4 });
    column.translate(0, length / 2, 0);
    const outer = new THREE.CylinderGeometry(R + t / 2, R + t / 2, s.width - 0.16, 48, 1, true, Math.PI / 2, sweepAngle);
    const inner = new THREE.CylinderGeometry(R - t / 2, R - t / 2, s.width - 0.16, 48, 1, true, Math.PI / 2, sweepAngle);
    const capR = new THREE.RingGeometry(R - t / 2, R + t / 2, 48, 1, (3 * Math.PI) / 2, sweepAngle);
    const capL = new THREE.RingGeometry(R - t / 2, R + t / 2, 48, 1, -Math.PI - s.lean, sweepAngle);
    return { foot, column, outer, inner, capR, capL, yc, endZ, endY, footLen };
  }, [s]);
  const metal = brushedMetal(color, 0.34, 0.25);
  const innerMetal = useMemo(() => {
    const m = metal.clone();
    m.side = THREE.BackSide;
    return m;
  }, [metal]);
  return (
    <group>
      <mesh geometry={g.foot} material={metal} position={[0, s.thickness / 2, s.footBack + g.footLen / 2]} rotation={[-Math.PI / 2, 0, 0]} castShadow />
      <group position={[0, g.yc, s.footBack]}>
        <mesh geometry={g.outer} material={metal} rotation={[0, 0, -Math.PI / 2]} castShadow />
        <mesh geometry={g.inner} material={innerMetal} rotation={[0, 0, -Math.PI / 2]} />
        <mesh geometry={g.capR} material={metal} position={[s.width / 2 - 0.08, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={g.capL} material={metal} position={[-s.width / 2 + 0.08, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      </group>
      <mesh geometry={g.column} material={metal} position={[0, g.endY, g.endZ]} rotation={[s.lean, 0, 0]} castShadow />
    </group>
  );
}

/* ------------------------------------------------------- panel */

interface PanelSpec {
  width: number;
  height: number;
  depth: number;
  radius: number;
  /** Rounding of the back edge (thick monitors have a soft back). */
  backEdge: number;
  display: { width: number; height: number };
  /** Height of the coloured chin below the glass (0 = glass to the bottom). */
  chin: number;
  bottom: number;
  /** z of the panel's front face. */
  front: number;
}

function Panel({ p, colors, bezel, surfaces, screen }: { p: PanelSpec; colors: { body: string; chin: string }; bezel: string } & Pick<DeviceProps, 'surfaces' | 'screen'>) {
  const glassH = p.height - p.chin;
  const g = useMemo(
    () => ({
      body: roundedSlab({
        width: p.width,
        height: p.height,
        radius: p.radius,
        thickness: p.depth,
        front: 0.06,
        back: p.backEdge,
        smooth: 0.5,
        segments: 28,
        edgeSegments: 10,
      }),
      glass: roundedPlane(
        p.width - 0.12,
        glassH - (p.chin ? 0.06 : 0.12),
        p.chin ? [p.radius - 0.06, p.radius - 0.06, 0, 0] : p.radius - 0.06,
        { smooth: 0.5, segments: 24 },
      ),
      chin: p.chin ? roundedPlane(p.width - 0.12, p.chin - 0.06, [0, 0, p.radius - 0.06, p.radius - 0.06], { smooth: 0.5, segments: 24 }) : null,
      display: roundedPlane(p.display.width, p.display.height, 0.05, { segments: 4 }),
    }),
    [p, glassH],
  );
  const material = useScreenMaterial(surfaces.screen, p.display.width / p.display.height, screen);
  const sideBezel = (p.width - p.display.width) / 2;
  const displayCenterY = p.height / 2 - sideBezel - p.display.height / 2;
  const glassCenterY = p.height / 2 - glassH / 2 - (p.chin ? 0.03 : 0);
  return (
    <group position={[0, p.bottom + p.height / 2, p.front - p.depth / 2]}>
      <mesh geometry={g.body} material={brushedMetal(colors.body, 0.36, 0.1)} castShadow />
      <group position={[0, 0, p.depth / 2 + 0.008]}>
        <mesh geometry={g.glass} material={coverGlass(bezel)} position={[0, glassCenterY, 0]} />
        {g.chin && <mesh geometry={g.chin} material={brushedMetal(colors.chin, 0.4, 0.05)} position={[0, -p.height / 2 + p.chin / 2 + 0.03, 0]} />}
        <mesh geometry={g.display} material={material} position={[0, displayCenterY, 0.006]} />
        <mesh position={[0, p.height / 2 - sideBezel / 2, 0.01]}>
          <circleGeometry args={[0.08, 24]} />
          <primitive object={lensGlass()} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------- connectors */

/**
 * Connectors on the back of a panel. `xs` are given as seen from behind
 * (x → right when looking at the back), y from the panel bottom.
 */
function BackPorts({ p, xs, y, round }: { p: PanelSpec; xs: number[]; y: number; round?: [number, number, number] }) {
  const g = useMemo(
    () => ({ usbc: roundedPlane(0.84, 0.27, 0.135, { smooth: 0, segments: 8 }), round: new THREE.CircleGeometry(1, 32) }),
    [],
  );
  const z = p.front - p.depth - 0.003;
  return (
    <group position={[0, p.bottom, z]} rotation={[0, Math.PI, 0]}>
      {xs.map((x) => (
        <mesh key={x} geometry={g.usbc} material={cavity()} position={[x, y, 0]} />
      ))}
      {round && <mesh geometry={g.round} material={mattePlastic('#1b1b1e', 0.5)} position={[round[0], round[1], 0]} scale={[round[2], round[2], 1]} />}
    </group>
  );
}

/* ------------------------------------------------------- modules */

const surface = (aspect: number, nativeSize: [number, number]) => [
  { id: 'screen', label: { fr: 'Écran', en: 'Screen' } as I18nString, aspect, nativeSize },
];

const aio = (id: string, fr: string, en: string, body: string, chin: string): DeviceFinish => ({
  id,
  name: { fr, en },
  swatch: body,
  colors: { body, chin },
});

const DESKTOP_PANEL: PanelSpec = {
  width: 54.7,
  height: 35.7,
  depth: 1.15,
  radius: 1.3,
  backEdge: 0.2,
  display: { width: 52.2, height: 29.36 },
  chin: 5.1,
  bottom: 10.2,
  front: -1.6,
};
const DESKTOP_STAND: StandSpec = { width: 13, thickness: 0.5, bend: 1.5, footFront: 4.6, footBack: -7.4, lean: 0.3, top: 22 };

function Desktop24({ finish, surfaces, screen, params }: DeviceProps) {
  const bezel = params.bezel === 'black' ? '#050506' : '#f1f1f0';
  return (
    <group>
      <BentStand s={DESKTOP_STAND} color={finish.colors.body} />
      <Panel p={DESKTOP_PANEL} colors={{ body: finish.colors.body, chin: finish.colors.chin }} bezel={bezel} surfaces={surfaces} screen={screen} />
      <BackPorts p={DESKTOP_PANEL} xs={[-22.6, -21.3, -20.0, -18.7]} y={2.6} round={[-11, 3.0, 0.55]} />
      <mesh
        position={[-DESKTOP_PANEL.width / 2 - 0.002, DESKTOP_PANEL.bottom + 4.2, DESKTOP_PANEL.front - DESKTOP_PANEL.depth / 2]}
        rotation={[0, -Math.PI / 2, 0]}
        material={cavity()}
      >
        <circleGeometry args={[0.17, 20]} />
      </mesh>
    </group>
  );
}

export const desktop24: DeviceModule = {
  id: 'desktop-24',
  name: { fr: 'Desktop 24', en: 'Desktop 24' },
  category: 'desktop',
  anchor: 'bottom',
  size: [54.7, 46, 15],
  surfaces: surface(52.2 / 29.36, [4480, 2520]),
  finishes: [
    aio('blue', 'Bleu', 'Blue', '#3a6390', '#a9c6e2'),
    aio('green', 'Vert', 'Green', '#3f7c5f', '#bcdcc8'),
    aio('pink', 'Rose', 'Pink', '#d36f81', '#f2c6cd'),
    aio('silver', 'Argent', 'Silver', '#c9cacd', '#e4e5e7'),
    aio('yellow', 'Jaune', 'Yellow', '#e3b13d', '#f6dd94'),
    aio('orange', 'Orange', 'Orange', '#df6a3e', '#f4b896'),
    aio('purple', 'Violet', 'Purple', '#7563a9', '#c9bfe2'),
  ],
  defaultFinish: 'blue',
  params: [
    {
      id: 'bezel',
      kind: 'choice',
      label: { fr: 'Bordure', en: 'Bezel' },
      options: [
        { value: 'white', label: { fr: 'Blanche', en: 'White' } },
        { value: 'black', label: { fr: 'Noire', en: 'Black' } },
      ],
      default: 'white',
    },
  ],
  view: { target: [0, 23, -2], offset: [34, 10, 110] },
  focus: [0, 28, -1.6],
  yaw: -0.3,
  Component: Desktop24,
};

const DISPLAY_PANEL: PanelSpec = {
  width: 62.3,
  height: 35.6,
  depth: 3.1,
  radius: 1.1,
  backEdge: 0.9,
  display: { width: 59.65, height: 33.55 },
  chin: 0,
  bottom: 12.2,
  front: -1.4,
};
const DISPLAY_STAND: StandSpec = { width: 15.5, thickness: 0.55, bend: 1.6, footFront: 4.2, footBack: -8.6, lean: 0.28, top: 25 };

function Display27({ finish, surfaces, screen }: DeviceProps) {
  return (
    <group>
      <BentStand s={DISPLAY_STAND} color={finish.colors.body} />
      <Panel p={DISPLAY_PANEL} colors={{ body: finish.colors.body, chin: finish.colors.body }} bezel="#040405" surfaces={surfaces} screen={screen} />
      <BackPorts p={DISPLAY_PANEL} xs={[19.6, 21.0, 22.4, 23.8]} y={3.2} round={[-12, 3.4, 0.6]} />
    </group>
  );
}

export const display27: DeviceModule = {
  id: 'display-27',
  name: { fr: 'Display 27', en: 'Display 27' },
  category: 'desktop',
  anchor: 'bottom',
  size: [62.3, 48, 17],
  surfaces: surface(59.65 / 33.55, [5120, 2880]),
  finishes: [aio('silver', 'Argent', 'Silver', '#cfd0d3', '#cfd0d3'), aio('space', 'Noir sidéral', 'Space black', '#3a3b3e', '#3a3b3e')],
  defaultFinish: 'silver',
  view: { target: [0, 24, -2], offset: [36, 10, 112] },
  focus: [0, 30, -1.4],
  yaw: -0.3,
  Component: Display27,
};

/* Generic office monitor: thin black bezels, rounded back housing, pedestal stand. */
const MONITOR_PANEL: PanelSpec = {
  width: 61.2,
  height: 35.8,
  depth: 1.4,
  radius: 0.35,
  backEdge: 0.3,
  display: { width: 59.8, height: 33.64 },
  chin: 0,
  bottom: 11.5,
  front: 1.2,
};

function Monitor27({ finish, surfaces, screen }: DeviceProps) {
  const g = useMemo(
    () => ({
      housing: roundedSlab({ width: 38, height: 22, radius: 3, thickness: 2.6, front: 0, back: { d: 1.6, z: 1.3 }, smooth: 0.6, segments: 24, edgeSegments: 10 }),
      neck: roundedSlab({ width: 5.2, height: 24, radius: 0.8, thickness: 2.2, front: 0.4, back: 0.6, smooth: 0.6, segments: 12, edgeSegments: 6 }),
      base: roundedSlab({ width: 25, height: 19, radius: 3.5, thickness: 1.1, front: { d: 0.5, z: 0.4 }, back: 0.1, smooth: 0.6, segments: 24, edgeSegments: 8 }),
    }),
    [],
  );
  const plastic = mattePlastic(finish.colors.body, 0.48);
  return (
    <group>
      <mesh geometry={g.base} material={plastic} position={[0, 0.55, -1.5]} rotation={[-Math.PI / 2, 0, 0]} castShadow />
      <mesh geometry={g.neck} material={plastic} position={[0, 12.5, -3.1]} rotation={[-0.08, 0, 0]} castShadow />
      <mesh geometry={g.housing} material={plastic} position={[0, 30, -0.9]} castShadow />
      <Panel p={MONITOR_PANEL} colors={{ body: finish.colors.body, chin: finish.colors.body }} bezel="#050506" surfaces={surfaces} screen={screen} />
    </group>
  );
}

export const monitor27: DeviceModule = {
  id: 'monitor-27',
  name: { fr: 'Monitor 27', en: 'Monitor 27' },
  category: 'desktop',
  anchor: 'bottom',
  size: [61.2, 47.3, 19],
  surfaces: surface(59.8 / 33.64, [2560, 1440]),
  finishes: [aio('graphite', 'Graphite', 'Graphite', '#26272a', '#26272a'), aio('white', 'Blanc', 'White', '#e9e9ea', '#e9e9ea')],
  defaultFinish: 'graphite',
  view: { target: [0, 23.5, -2], offset: [36, 10, 112] },
  focus: [0, 29.4, 1.2],
  yaw: -0.3,
  Component: Monitor27,
};
