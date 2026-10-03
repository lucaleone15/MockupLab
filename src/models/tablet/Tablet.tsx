import type { I18nString } from '@/i18n';
import { roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { brushedMetal, cavity, coverGlass, glossyGlass, lensGlass, mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { Flash, Hole, HoleRow, Lens, Sensor } from '../shared/parts';
import { ORIENTATION_PARAM, isLandscape, type DeviceFinish, type DeviceModule, type DeviceProps } from '../types';
import { useMemo } from 'react';

export interface TabletSpec {
  id: string;
  name: I18nString;
  width: number;
  height: number;
  depth: number;
  radius: number;
  display: { width: number; height: number; radius: number };
  nativeSize: [number, number];
  finishes: DeviceFinish[];
}

const GLASS_INSET = 0.035;
const GLASS_T = 0.045;

function Tablet({ spec: s, finish, surfaces, screen, params }: DeviceProps & { spec: TabletSpec }) {
  const g = useMemo(
    () => ({
      body: roundedSlab({
        width: s.width,
        height: s.height,
        radius: s.radius,
        thickness: s.depth,
        front: { d: 0.035, z: 0.04 },
        back: { d: 0.05, z: 0.05 },
        smooth: 0.45,
        segments: 36,
        edgeSegments: 10,
      }),
      glass: roundedSlab({
        width: s.width - GLASS_INSET * 2,
        height: s.height - GLASS_INSET * 2,
        radius: s.radius - GLASS_INSET,
        thickness: GLASS_T,
        front: { d: 0.025, z: 0.018 },
        smooth: 0.45,
        segments: 36,
        edgeSegments: 6,
      }),
      display: roundedPlane(s.display.width, s.display.height, s.display.radius, { smooth: 0.45, segments: 24 }),
      plateau: roundedSlab({ width: 2.9, height: 2.9, radius: 0.78, thickness: 0.1, front: { d: 0.06, z: 0.05 }, segments: 20, edgeSegments: 6 }),
      button: roundedSlab({ width: 0.22, height: 1, radius: 0.11, thickness: 0.1, front: { d: 0.04, z: 0.04 }, smooth: 0, segments: 10, edgeSegments: 5 }),
      port: roundedPlane(0.9, 0.28, 0.14, { smooth: 0, segments: 10 }),
    }),
    [s],
  );
  const metal = brushedMetal(finish.colors.frame, 0.42, 0.08);
  const material = useScreenMaterial(surfaces.screen, s.display.width / s.display.height, screen, { rotated: isLandscape(params) });
  const glassTop = s.depth / 2 + 0.012;
  const screenZ = glassTop + 0.0015;
  const bezelX = (s.width - s.display.width) / 2;

  return (
    <group>
      <mesh geometry={g.body} material={metal} castShadow />
      <mesh geometry={g.glass} material={coverGlass()} position={[0, 0, glassTop - GLASS_T / 2]} />
      <mesh geometry={g.display} material={material} position={[0, 0, screenZ]} />
      {/* front camera on the long (landscape-top) edge */}
      <group position={[s.width / 2 - bezelX / 2, 0, glassTop + 0.001]}>
        <Hole position={[0, 0, 0]} radius={0.13} />
        <mesh position={[0, 0, 0.0005]} scale={[0.07, 0.07, 1]}>
          <circleGeometry args={[1, 24]} />
          <primitive object={lensGlass()} attach="material" />
        </mesh>
      </group>
      {/* camera module on the back, top-left in back view */}
      <group position={[s.width / 2 - 0.75 - 1.45, s.height / 2 - 0.75 - 1.45, -s.depth / 2]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={g.plateau} material={glossyGlass(finish.colors.frame)} position={[0, 0, 0.04]} castShadow />
        <Lens position={[-0.62, 0.62, 0.09]} radius={0.6} ring={finish.colors.frame} />
        <Lens position={[-0.62, -0.62, 0.09]} radius={0.6} ring={finish.colors.frame} />
        <Flash position={[0.66, 0.66, 0.09]} radius={0.19} />
        <Sensor position={[0.66, -0.62, 0.09]} radius={0.27} />
        <Hole position={[0.7, 0.02, 0.091]} radius={0.04} />
      </group>
      {/* top button (portrait) and volume buttons on the right edge */}
      <mesh geometry={g.button} material={metal} position={[s.width / 2 - 2.6, s.height / 2 - 0.02, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} scale={[1, 1.9, 1]} />
      {[2.6, 4.1].map((y) => (
        <mesh key={y} geometry={g.button} material={metal} position={[s.width / 2 - 0.02, s.height / 2 - y, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.25, 1]} />
      ))}
      {/* speaker grilles on both short edges, port at the bottom */}
      {[-1, 1].map((side) =>
        [-1, 1].map((x) => (
          <HoleRow
            key={`${side}${x}`}
            position={[x * (s.width / 2 - 2.4), side * (s.height / 2 + 0.0015), 0]}
            rotation={[(-side * Math.PI) / 2, 0, 0]}
            count={11}
            pitch={0.12}
            radius={0.034}
          />
        )),
      )}
      <mesh geometry={g.port} material={cavity()} position={[0, -s.height / 2 - 0.0015, 0]} rotation={[Math.PI / 2, 0, 0]} />
      {/* magnetic connector on the back */}
      {[-0.35, 0, 0.35].map((x) => (
        <mesh key={x} position={[x, -s.height / 2 + 0.55, -s.depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.09, 24]} />
          <primitive object={mattePlastic('#8d8e91', 0.3)} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

const finishes: DeviceFinish[] = [
  { id: 'space', name: { fr: 'Noir sidéral', en: 'Space black' }, swatch: '#3b3c3f', colors: { frame: '#3b3c3f' } },
  { id: 'silver', name: { fr: 'Argent', en: 'Silver' }, swatch: '#d9dadc', colors: { frame: '#d9dadc' } },
];

function defineTablet(spec: TabletSpec): DeviceModule {
  const Component = (props: DeviceProps) => <Tablet spec={spec} {...props} />;
  Component.displayName = `Tablet(${spec.id})`;
  return {
    id: spec.id,
    name: spec.name,
    category: 'tablet',
    size: [spec.width, spec.height, spec.depth],
    surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: spec.display.width / spec.display.height, nativeSize: spec.nativeSize }],
    finishes: spec.finishes,
    defaultFinish: spec.finishes[0].id,
    params: [{ ...ORIENTATION_PARAM, default: 'landscape' as string }],
    view: { target: [0, spec.height / 2, 0], offset: [spec.height * 0.68, spec.height * 0.39, spec.height * 2.8] },
    yaw: -0.28,
    Component,
  };
}

export const tablet11 = defineTablet({
  id: 'tablet-pro-11',
  name: { fr: 'Tablet Pro 11', en: 'Tablet Pro 11' },
  width: 17.85,
  height: 24.96,
  depth: 0.53,
  radius: 1.25,
  display: { width: 16.05, height: 23.28, radius: 0.5 },
  nativeSize: [1668, 2420],
  finishes,
});

export const tablet13 = defineTablet({
  id: 'tablet-pro-13',
  name: { fr: 'Tablet Pro 13', en: 'Tablet Pro 13' },
  width: 21.5,
  height: 28.16,
  depth: 0.51,
  radius: 1.3,
  display: { width: 19.86, height: 26.48, radius: 0.5 },
  nativeSize: [2064, 2752],
  finishes,
});
