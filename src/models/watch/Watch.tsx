import { useMemo } from 'react';
import * as THREE from 'three';
import { roundedRectOutline } from '@/lib/geometry/outline';
import { latheZ, roundedPlane, roundedSlab } from '@/lib/geometry/sweep';
import { brushedMetal, coverGlass, glossyGlass } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';

/*
 * Watch: squircle aluminium case with a domed cover glass, a crown and a side
 * button, worn on a sport band that loops back as around a wrist — the classic
 * product shot. The band is a rounded section swept along a smooth closed path.
 */

const W = 3.9;
const H = 4.6;
const D = 1.05;
const R = 0.95;
const DISPLAY: [number, number, number] = [3.44, 4.2, 0.72];
const BAND_W = 2.3;
const BAND_T = 0.32;
/** The band's path (y, z) from the top lug, around the back, to the bottom lug. */
const BAND_PATH: [number, number][] = [
  [2.2, -0.1],
  [2.85, -0.22],
  [3.28, -0.85],
  [3.4, -2.2],
  [3.05, -3.6],
  [2.05, -4.6],
  [0.4, -5.1],
  [-1.2, -4.95],
  [-2.5, -4.05],
  [-3.25, -2.65],
  [-3.35, -1.2],
  [-2.9, -0.32],
  [-2.2, -0.1],
];
/** Lowest point of the band, under the case centre (the watch rests on it). */
const FLOOR = 3.35 + BAND_T / 2;
/** The whole object is centred in depth for framing. */
const Z_SHIFT = 2.45;

/** A rounded section swept along a curve lying in the YZ plane (normals from the section outline). */
function bandGeometry() {
  const curve = new THREE.CatmullRomCurve3(
    BAND_PATH.map(([y, z]) => new THREE.Vector3(0, y, z)),
    false,
    'centripetal',
  );
  const section = roundedRectOutline(BAND_W, BAND_T, BAND_T / 2 - 0.01, { smooth: 0.2, segments: 8 });
  const steps = 220;
  const ring = section.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const c = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const n = new THREE.Vector3().crossVectors(t, X).normalize();
    for (const p of section) {
      pos.push(c.x + X.x * p.x + n.x * p.y, c.y + X.y * p.x + n.y * p.y, c.z + X.z * p.x + n.z * p.y);
      const nn = X.clone().multiplyScalar(p.nx).add(n.clone().multiplyScalar(p.ny)).normalize();
      nor.push(nn.x, nn.y, nn.z);
      uv.push(p.u, u * 6);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      const c = (i + 1) * ring + j;
      const d = (i + 1) * ring + ((j + 1) % ring);
      index.push(a, c, b, b, c, d);
    }
  // winding: the first triangle must face along its vertex normal
  const v = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const face = new THREE.Vector3().crossVectors(v(index[1]).sub(v(index[0])), v(index[2]).sub(v(index[0])));
  if (face.dot(new THREE.Vector3(nor[index[0] * 3], nor[index[0] * 3 + 1], nor[index[0] * 3 + 2])) < 0)
    for (let k = 0; k < index.length; k += 3) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

let geometry: ReturnType<typeof build> | null = null;
function build() {
  return {
    case: roundedSlab({ width: W, height: H, radius: R, thickness: D, front: { d: 0.22, z: 0.28 }, back: { d: 0.4, z: 0.36 }, smooth: 0.65, segments: 36, edgeSegments: 14 }),
    glass: roundedSlab({ width: W - 0.08, height: H - 0.08, radius: R - 0.04, thickness: 0.16, front: { d: 0.2, z: 0.11 }, back: 0, smooth: 0.65, segments: 36, edgeSegments: 10 }),
    display: roundedPlane(DISPLAY[0], DISPLAY[1], DISPLAY[2], { smooth: 0.65, segments: 36 }),
    crown: latheZ(
      [
        [0, 0],
        [0.33, 0],
        [0.355, 0.03],
        [0.36, 0.26],
        [0.33, 0.3],
        [0, 0.3],
      ],
      72,
    ),
    crownRidges: new THREE.CylinderGeometry(0.362, 0.362, 0.2, 60, 1, true),
    button: roundedSlab({ width: 0.3, height: 1.35, radius: 0.15, thickness: 0.12, front: { d: 0.05, z: 0.05 }, smooth: 0, segments: 12, edgeSegments: 6 }),
    sensor: latheZ(
      [
        [0, 0.14],
        [0.6, 0.12],
        [1.05, 0.06],
        [1.2, 0],
      ],
      64,
    ),
    band: bandGeometry(),
  };
}

const silicone = (color: string) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.08, clearcoatRoughness: 0.5 });

function Watch({ finish, surfaces, screen, params }: DeviceProps) {
  geometry ??= build();
  const g = geometry;
  const screenMaterial = useScreenMaterial(surfaces.screen, DISPLAY[0] / DISPLAY[1], screen);
  const frame = brushedMetal(finish.colors.case, 0.34, 0.1);
  const bandColor = String(params.band ?? finish.colors.band);
  const band = useMemo(() => silicone(bandColor), [bandColor]);
  const glassTop = D / 2 + 0.06;
  return (
    <group position={[0, FLOOR, Z_SHIFT]}>
      <mesh geometry={g.case} material={frame} castShadow receiveShadow />
      <mesh geometry={g.glass} material={coverGlass()} position={[0, 0, glassTop - 0.08]} />
      <mesh geometry={g.display} material={screenMaterial} position={[0, 0, glassTop + 0.0015]} />
      {/* crown with its knurled ring, and the side button */}
      <group position={[W / 2 - 0.05, 0.95, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={g.crown} material={frame} castShadow />
        <mesh geometry={g.crownRidges} material={brushedMetal(finish.colors.case, 0.5, 0.6)} position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <mesh geometry={g.button} material={frame} position={[W / 2 - 0.03, -0.55, 0]} rotation={[0, Math.PI / 2, 0]} />
      {/* back: sensor dome */}
      <mesh geometry={g.sensor} material={glossyGlass('#15161a')} position={[0, 0, -D / 2 + 0.02]} rotation={[Math.PI, 0, 0]} />
      <mesh geometry={g.band} material={band} castShadow receiveShadow />
    </group>
  );
}

function watchFinish(id: string, fr: string, en: string, caseColor: string, band: string): DeviceFinish {
  return { id, name: { fr, en }, swatch: caseColor, colors: { case: caseColor, band } };
}

const BAND_COLORS = [
  { value: '#24262c', label: { fr: 'Minuit', en: 'Midnight' } },
  { value: '#e9e3d6', label: { fr: 'Lumière stellaire', en: 'Starlight' } },
  { value: '#ff5c35', label: { fr: 'Corail', en: 'Coral' } },
  { value: '#3e5a4b', label: { fr: 'Forêt', en: 'Forest' } },
  { value: '#b8c7e0', label: { fr: 'Bleu glacier', en: 'Glacier blue' } },
  { value: '#e8b9c0', label: { fr: 'Rose poudré', en: 'Powder pink' } },
];

export const watch: DeviceModule = {
  id: 'watch',
  name: { fr: 'Watch', en: 'Watch' },
  category: 'wearable',
  anchor: 'bottom',
  size: [W + 0.4, FLOOR * 2, 5.9],
  sizeFor: () => ({ size: [W + 0.4, FLOOR * 2, 5.9], focus: [0, FLOOR, Z_SHIFT + D / 2] }),
  focus: [0, FLOOR, Z_SHIFT + D / 2],
  surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: DISPLAY[0] / DISPLAY[1], nativeSize: [396, 484] }],
  finishes: [
    watchFinish('midnight', 'Aluminium minuit', 'Midnight aluminium', '#2b2e35', '#24262c'),
    watchFinish('starlight', 'Aluminium stellaire', 'Starlight aluminium', '#ddd5c6', '#e9e3d6'),
    watchFinish('silver', 'Aluminium argent', 'Silver aluminium', '#d3d5d8', '#b8c7e0'),
    watchFinish('rose', 'Aluminium rose', 'Rose aluminium', '#e6c9bf', '#e8b9c0'),
  ],
  defaultFinish: 'midnight',
  params: [{ id: 'band', kind: 'swatch', label: { fr: 'Bracelet', en: 'Band' }, options: BAND_COLORS, default: '#24262c' }],
  view: { target: [0, FLOOR, Z_SHIFT], offset: [6, 3, 18] },
  yaw: -0.3,
  Component: Watch,
};
