import { useMemo } from 'react';
import * as THREE from 'three';
import type { I18nString } from '@/i18n';
import { circleOutline, cornerExtent } from '@/lib/geometry/outline';
import { flatShape, roundedPlane, roundedSlab, type EdgeRadius } from '@/lib/geometry/sweep';
import { brushedMetal, cavity, coverGlass, frostedGlass, glossyGlass, islandBlack, mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { SOCIAL_PARAMS } from '@/social/phoneScreen';
import { useSocialScreen } from '@/social/useSocialScreen';
import { Flash, Hole, Lens, Sensor } from '../shared/parts';
import { isLandscape, ORIENTATION_PARAM, type DeviceFinish, type DeviceModule, type DeviceProps } from '../types';

/* --------------------------------------------------------------- spec */

export type Cutout =
  | { kind: 'island'; width: number; height: number; top: number }
  | { kind: 'notch'; width: number; height: number; radius: number }
  | { kind: 'punch'; diameter: number; top: number }
  | { kind: 'none' };

export interface CameraSpec {
  /** Module centre, measured on the back from the top-left corner (x → right, y → down). */
  at: [number, number];
  plateau?: { width: number; height: number; radius: number; thickness: number };
  /** Lens centres and outer ring radii, relative to the module centre (x → right, y → up, back view). */
  lenses: [number, number, number][];
  flash?: [number, number, number];
  sensor?: [number, number, number];
  mic?: [number, number];
}

export interface PhoneSpec {
  id: string;
  name: I18nString;
  width: number;
  height: number;
  depth: number;
  radius: number;
  smooth: number;
  /** Rounding between side band and front/back glass. */
  bandEdge: EdgeRadius;
  frame: { roughness: number; anisotropy: number };
  display: { width: number; height: number; radius: number };
  nativeSize: [number, number];
  cutout: Cutout;
  back: 'frosted' | 'glossy';
  camera: CameraSpec;
  /** [side (-1 left, 1 right), centre offset from the top, length] */
  buttons: [-1 | 1, number, number][];
  finishes: DeviceFinish[];
  defaultFinish: string;
}

const GLASS_INSET = 0.05;
const GLASS_T = 0.09;

/* ----------------------------------------------------------- geometry */

interface PhoneGeometry {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  display: THREE.BufferGeometry;
  cutout: THREE.BufferGeometry | null;
  plateau: THREE.BufferGeometry | null;
  button: Record<string, THREE.BufferGeometry>;
  antennaSide: THREE.BufferGeometry;
  antennaTop: THREE.BufferGeometry;
  port: THREE.BufferGeometry;
  earpiece: THREE.BufferGeometry;
}

const cache = new Map<string, PhoneGeometry>();

function buildGeometry(s: PhoneSpec): PhoneGeometry {
  const button: Record<string, THREE.BufferGeometry> = {};
  for (const [, , len] of s.buttons) {
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
  const c = s.cutout;
  const cutout =
    c.kind === 'island'
      ? roundedPlane(c.width, c.height, c.height / 2, { smooth: 0, segments: 20 })
      : c.kind === 'notch'
        ? roundedPlane(c.width, c.height, [0, 0, c.radius, c.radius], { smooth: 0.3, segments: 16 })
        : c.kind === 'punch'
          ? flatShape(circleOutline(c.diameter / 2, 40))
          : null;
  const p = s.camera.plateau;
  return {
    body: roundedSlab({
      width: s.width,
      height: s.height,
      radius: s.radius,
      thickness: s.depth,
      front: s.bandEdge,
      back: s.bandEdge,
      smooth: s.smooth,
      segments: 40,
      edgeSegments: 14,
    }),
    glass: roundedSlab({
      width: s.width - GLASS_INSET * 2,
      height: s.height - GLASS_INSET * 2,
      radius: s.radius - GLASS_INSET,
      thickness: GLASS_T,
      front: { d: 0.06, z: 0.035 },
      back: 0,
      smooth: s.smooth,
      segments: 40,
      edgeSegments: 8,
    }),
    display: roundedPlane(s.display.width, s.display.height, s.display.radius, { smooth: s.smooth, segments: 40 }),
    cutout,
    plateau: p
      ? roundedSlab({
          width: p.width,
          height: p.height,
          radius: p.radius,
          thickness: p.thickness,
          front: { d: Math.min(0.07, p.thickness * 0.6), z: Math.min(0.06, p.thickness * 0.55) },
          back: 0,
          smooth: s.smooth,
          segments: 24,
          edgeSegments: 8,
        })
      : null,
    button,
    antennaSide: new THREE.BoxGeometry(0.008, 0.05, s.depth - 0.24),
    antennaTop: new THREE.BoxGeometry(0.05, 0.008, s.depth - 0.24),
    port: roundedPlane(0.9, 0.3, 0.15, { smooth: 0, segments: 12 }),
    earpiece: roundedPlane(1.15, 0.032, 0.016, { smooth: 0, segments: 8 }),
  };
}

function geometryFor(s: PhoneSpec) {
  let g = cache.get(s.id);
  if (!g) {
    g = buildGeometry(s);
    cache.set(s.id, g);
  }
  return g;
}

/* ---------------------------------------------------------- component */

function CameraModule({ s, g, finish, backZ }: { s: PhoneSpec; g: PhoneGeometry; finish: DeviceFinish; backZ: number }) {
  const cam = s.camera;
  const z = cam.plateau ? cam.plateau.thickness - 0.01 : 0;
  return (
    <group position={[s.width / 2 - cam.at[0], s.height / 2 - cam.at[1], -backZ]} rotation={[0, Math.PI, 0]}>
      {g.plateau && cam.plateau && (
        <mesh geometry={g.plateau} material={glossyGlass(finish.colors.back)} position={[0, 0, cam.plateau.thickness / 2 - 0.01]} castShadow />
      )}
      {cam.lenses.map(([x, y, r], i) => (
        <Lens key={i} position={[x, y, z]} radius={r} ring={finish.colors.frame} />
      ))}
      {cam.flash && <Flash position={[cam.flash[0], cam.flash[1], z]} radius={cam.flash[2]} />}
      {cam.sensor && <Sensor position={[cam.sensor[0], cam.sensor[1], z]} radius={cam.sensor[2]} />}
      {cam.mic && <Hole position={[cam.mic[0], cam.mic[1], z + 0.001]} radius={0.04} />}
    </group>
  );
}

function Phone({ spec: s, finish, surfaces, screen, params, brand }: DeviceProps & { spec: PhoneSpec }) {
  const g = geometryFor(s);
  const aspect = s.display.width / s.display.height;
  const compose = useSocialScreen(params, brand, aspect);
  const screenMaterial = useScreenMaterial(surfaces.screen, aspect, screen, {
    rotated: isLandscape(params) && !compose,
    compose,
  });
  const frame = brushedMetal(finish.colors.frame, s.frame.roughness, s.frame.anisotropy);
  const antenna = mattePlastic(finish.colors.antenna, 0.55);
  const glassTop = s.depth / 2 + 0.015;
  const glassZ = glassTop - GLASS_T / 2;
  const screenZ = glassTop + 0.0015;
  const displayTop = s.display.height / 2;
  const speakers = useMemo(() => [-1, 1].flatMap((side) => Array.from({ length: 6 }, (_, i) => side * (0.95 + i * 0.17))), []);

  const c = s.cutout;
  const cutoutY =
    c.kind === 'island'
      ? displayTop - c.top - c.height / 2
      : c.kind === 'notch'
        ? displayTop - c.height / 2 + 0.02
        : c.kind === 'punch'
          ? displayTop - c.top
          : 0;
  const earpieceY = c.kind === 'notch' ? displayTop - 0.12 : s.height / 2 - (s.height / 2 - displayTop) / 2;
  // Antenna lines sit on the straight runs, just past the corner curves.
  const run = cornerExtent(s.radius, s.smooth);
  const sideBand = s.height / 2 - run - 0.25;
  const topBand = s.width / 2 - run - 0.2;

  return (
    <group>
      <mesh geometry={g.body} material={frame} castShadow />
      {/* front: cover glass, display, cutout */}
      <mesh geometry={g.glass} material={coverGlass()} position={[0, 0, glassZ]} />
      <mesh geometry={g.display} material={screenMaterial} position={[0, 0, screenZ]} />
      {g.cutout && <mesh geometry={g.cutout} material={islandBlack()} position={[0, cutoutY, screenZ + 0.004]} />}
      <mesh
        geometry={g.earpiece}
        material={mattePlastic(c.kind === 'notch' ? '#1c1c1f' : '#121214', 0.8)}
        position={[0, earpieceY, (c.kind === 'notch' ? screenZ + 0.008 : glassTop + 0.001)]}
        scale={c.kind === 'punch' ? [0.7, 1, 1] : 1}
      />
      {/* back */}
      <mesh
        geometry={g.glass}
        material={s.back === 'frosted' ? frostedGlass(finish.colors.back) : glossyGlass(finish.colors.back)}
        position={[0, 0, -glassZ]}
        rotation={[0, Math.PI, 0]}
      />
      <CameraModule s={s} g={g} finish={finish} backZ={glassTop} />
      {/* buttons */}
      {s.buttons.map(([side, offset, len], i) => (
        <mesh
          key={i}
          geometry={g.button[len]}
          material={frame}
          position={[side * (s.width / 2 - 0.01), s.height / 2 - offset, 0]}
          rotation={[0, (side * Math.PI) / 2, 0]}
        />
      ))}
      {/* antenna bands */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`s${sx}${sy}`} geometry={g.antennaSide} material={antenna} position={[sx * (s.width / 2 - 0.002), sy * sideBand, 0]} />
        )),
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={`t${sx}${sy}`} geometry={g.antennaTop} material={antenna} position={[sx * topBand, sy * (s.height / 2 - 0.002), 0]} />
        )),
      )}
      {/* bottom: port and speaker grilles */}
      <group position={[0, -s.height / 2 - 0.0015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={g.port} material={cavity()} />
        {speakers.map((x) => (
          <Hole key={x} position={[x, 0, 0]} radius={0.045} />
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------ module */

export function phoneFinish(id: string, fr: string, en: string, frame: string, back: string, antenna: string): DeviceFinish {
  return { id, name: { fr, en }, swatch: frame, colors: { frame, back, antenna } };
}

export function definePhone(spec: PhoneSpec): DeviceModule {
  const Component = (props: DeviceProps) => <Phone spec={spec} {...props} />;
  Component.displayName = `Phone(${spec.id})`;
  return {
    id: spec.id,
    name: spec.name,
    category: 'phone',
    size: [spec.width, spec.height, spec.depth],
    surfaces: [
      {
        id: 'screen',
        label: { fr: 'Écran', en: 'Screen' },
        aspect: spec.display.width / spec.display.height,
        nativeSize: spec.nativeSize,
      },
    ],
    finishes: spec.finishes,
    defaultFinish: spec.defaultFinish,
    params: [ORIENTATION_PARAM, ...SOCIAL_PARAMS],
    view: { target: [0, spec.height / 2, 0], offset: [10, 5.7, 41] },
    Component,
  };
}
