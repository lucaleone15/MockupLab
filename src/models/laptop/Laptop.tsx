import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { prepareTexture } from '@/store/assets';
import type { I18nString } from '@/i18n';
import { roundedPlane, roundedSlab, type EdgeRadius } from '@/lib/geometry/sweep';
import { brushedMetal, cavity, coverGlass, islandBlack, lensGlass, mattePlastic } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { useFontsReady } from '../shared/useFontsReady';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';
import { drawLegends, type KeyboardLayoutId } from './keyboardLegends';

/*
 * Laptop: aluminium base with keyboard, trackpad, speaker grilles and ports,
 * and a lid hinged at the back edge whose opening angle is a parameter.
 * Base coordinates: origin on the floor at the centre of the footprint,
 * +Z towards the user, the lid pivots around the X axis at the back.
 */

export interface LaptopSpec {
  id: string;
  name: I18nString;
  width: number;
  depth: number;
  baseThickness: number;
  lidThickness: number;
  radius: number;
  baseEdge: { top: EdgeRadius; bottom: EdgeRadius };
  display: { width: number; height: number; top: number; radius: number };
  nativeSize: [number, number];
  keyboard: { back: number; pitch: number; fnPitch: number };
  trackpad: { width: number; depth: number; front: number };
  /** Connectors on each side wall: [kind, centre z] (z < 0 is towards the hinge). */
  ports: { left: [PortKind, number][]; right: [PortKind, number][] };
  grilles: boolean;
  finishes: DeviceFinish[];
}

export type PortKind = 'usbc' | 'magsafe' | 'hdmi' | 'sd' | 'jack';

const FEET = 0.07;
const KEY_GAP = 0.3;

type Key = { x: number; y: number; w: number; d: number };

/** Key rectangles in deck coordinates (x right, y towards the back), centred on the keyboard. */
function keyboardLayout(u: number, fn: number): { keys: Key[]; width: number; depth: number } {
  const rows: number[][] = [
    [1.5, ...Array(12).fill(1), 1],
    [...Array(13).fill(1), 1.5],
    [1.5, ...Array(13).fill(1)],
    [1.75, ...Array(11).fill(1), 1.75],
    [2.25, ...Array(10).fill(1), 2.25],
  ];
  const width = 14.5 * u;
  const depth = fn + 5 * u;
  const keys: Key[] = [];
  const x0 = -width / 2;
  const y0 = depth / 2;
  rows.forEach((row, r) => {
    const pitch = r === 0 ? fn : u;
    const yc = r === 0 ? y0 - fn / 2 : y0 - fn - (r - 0.5) * u;
    let x = x0;
    for (const w of row) {
      keys.push({ x: x + (w * u) / 2, y: yc, w: w * u - KEY_GAP, d: pitch - KEY_GAP });
      x += w * u;
    }
  });
  // bottom row with inverted-T arrows
  const yb = y0 - fn - 4.5 * u;
  let x = x0;
  for (const w of [1, 1, 1, 1.25, 5, 1.25, 1]) {
    keys.push({ x: x + (w * u) / 2, y: yb, w: w * u - KEY_GAP, d: u - KEY_GAP });
    x += w * u;
  }
  const half = u / 2;
  keys.push({ x: x + u / 2, y: yb - half / 2, w: u - KEY_GAP, d: half - KEY_GAP / 2 });
  keys.push({ x: x + 1.5 * u, y: yb + half / 2, w: u - KEY_GAP, d: half - KEY_GAP / 2 });
  keys.push({ x: x + 1.5 * u, y: yb - half / 2, w: u - KEY_GAP, d: half - KEY_GAP / 2 });
  keys.push({ x: x + 2.5 * u, y: yb - half / 2, w: u - KEY_GAP, d: half - KEY_GAP / 2 });
  return { keys, width, depth };
}

/** Builds one InstancedMesh per distinct key size so rounded corners are never stretched. */
function useKeycaps(spec: LaptopSpec) {
  const meshes = useMemo(() => {
    const { keys } = keyboardLayout(spec.keyboard.pitch, spec.keyboard.fnPitch);
    const groups = new Map<string, Key[]>();
    for (const k of keys) {
      const id = `${k.w.toFixed(3)}x${k.d.toFixed(3)}`;
      groups.set(id, [...(groups.get(id) ?? []), k]);
    }
    const material = mattePlastic('#0f0f11', 0.58);
    const m = new THREE.Matrix4();
    return [...groups.values()].map((list) => {
      const geo = roundedSlab({
        width: list[0].w,
        height: list[0].d,
        radius: Math.min(0.16, list[0].d / 2),
        thickness: 0.06,
        front: { d: 0.035, z: 0.025 },
        smooth: 0.3,
        segments: 6,
        edgeSegments: 3,
      });
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((k, i) => mesh.setMatrixAt(i, m.makeTranslation(k.x, k.y, 0.03)));
      mesh.instanceMatrix.needsUpdate = true;
      return mesh;
    });
  }, [spec]);
  useEffect(() => () => meshes.forEach((mesh) => mesh.geometry.dispose()), [meshes]);
  return meshes;
}

/** Legend overlay laid on the keycap tops. */
function KeyLegends({ spec, layout }: { spec: LaptopSpec; layout: KeyboardLayoutId }) {
  const fontsReady = useFontsReady();
  const invalidate = useThree((s) => s.invalidate);
  const kb = useMemo(() => keyboardLayout(spec.keyboard.pitch, spec.keyboard.fnPitch), [spec]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d4d4d8',
        emissive: '#ffffff',
        emissiveIntensity: 0.12,
        roughness: 0.6,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => {
    const tex = prepareTexture(new THREE.CanvasTexture(drawLegends(kb.keys, kb.width, kb.depth, layout)));
    material.map = tex;
    material.emissiveMap = tex;
    material.needsUpdate = true;
    invalidate();
    return () => tex.dispose();
  }, [kb, layout, fontsReady, material, invalidate]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material} position={[0, 0, 0.063]}>
      <planeGeometry args={[kb.width, kb.depth]} />
    </mesh>
  );
}

/** Perforated speaker grille: instanced holes on a grid. */
function useGrille(cols: number, rows: number, pitch: number) {
  const mesh = useMemo(() => {
    const geo = new THREE.CircleGeometry(0.032, 10);
    const inst = new THREE.InstancedMesh(geo, cavity(), cols * rows);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const off = r % 2 ? pitch / 2 : 0;
        inst.setMatrixAt(i++, m.makeTranslation((c - (cols - 1) / 2) * pitch + off, (r - (rows - 1) / 2) * pitch * 0.87, 0));
      }
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [cols, rows, pitch]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return mesh;
}

function Laptop({ spec: s, finish, surfaces, screen, params }: DeviceProps & { spec: LaptopSpec }) {
  const angle = THREE.MathUtils.degToRad(Number(params.angle ?? 110));
  const notch = params.notch === true;
  const lidH = s.depth - 0.2;
  const d = s.display;

  const g = useMemo(() => {
    const lid = roundedSlab({
      width: s.width,
      height: lidH,
      radius: s.radius,
      thickness: s.lidThickness,
      front: { d: 0.08, z: 0.08 },
      back: { d: 0.2, z: 0.22 },
      smooth: 0.5,
      segments: 28,
      edgeSegments: 8,
    });
    lid.translate(0, lidH / 2, 0);
    return {
      base: roundedSlab({
        width: s.width,
        height: s.depth,
        radius: s.radius,
        thickness: s.baseThickness,
        front: s.baseEdge.top,
        back: s.baseEdge.bottom,
        smooth: 0.5,
        segments: 28,
        edgeSegments: 12,
      }),
      lid,
      bezel: roundedPlane(s.width - 0.2, lidH - 0.2, s.radius - 0.1, { smooth: 0.5, segments: 24 }),
      display: roundedPlane(d.width, d.height, [d.radius, d.radius, 0.12, 0.12], { smooth: 0.5, segments: 20 }),
      notch: roundedPlane(3.1, 0.62, [0, 0, 0.2, 0.2], { smooth: 0.2, segments: 10 }),
      deck: roundedPlane(keyboardLayout(s.keyboard.pitch, s.keyboard.fnPitch).width + 0.4, s.keyboard.fnPitch + 5 * s.keyboard.pitch + 0.4, 0.35, { segments: 8 }),
      trackpad: roundedPlane(s.trackpad.width, s.trackpad.depth, 0.5, { smooth: 0.5, segments: 16 }),
      trackpadGap: roundedPlane(s.trackpad.width + 0.06, s.trackpad.depth + 0.06, 0.53, { smooth: 0.5, segments: 16 }),
      ports: {
        usbc: roundedPlane(0.84, 0.27, 0.135, { smooth: 0, segments: 8 }),
        magsafe: roundedPlane(1.45, 0.22, 0.11, { smooth: 0, segments: 8 }),
        hdmi: roundedPlane(1.4, 0.4, [0.05, 0.05, 0.12, 0.12], { smooth: 0, segments: 4 }),
        sd: roundedPlane(2.4, 0.13, 0.06, { smooth: 0, segments: 4 }),
        jack: roundedPlane(0.34, 0.34, 0.17, { smooth: 0, segments: 10 }),
      } satisfies Record<PortKind, THREE.BufferGeometry>,
      foot: new THREE.CylinderGeometry(0.55, 0.6, FEET, 32),
      hinge: new THREE.CylinderGeometry(0.4, 0.4, s.width - 4.6, 40, 1),
    };
  }, [s, lidH, d]);
  const keycaps = useKeycaps(s);
  const grille = useGrille(7, 78, 0.14);
  const grilleR = useMemo(() => grille.clone(), [grille]);

  const metal = brushedMetal(finish.colors.frame, 0.38, 0.12);
  const material = useScreenMaterial(surfaces.screen, d.width / d.height, screen);
  const top = FEET + s.baseThickness;
  const kb = keyboardLayout(s.keyboard.pitch, s.keyboard.fnPitch);
  const kbCenter = s.depth / 2 - s.keyboard.back - kb.depth / 2; // deck y (towards the back)
  const pivotY = top + s.lidThickness / 2;
  const pivotZ = -s.depth / 2 + s.lidThickness / 2 + 0.05;
  const displayY = lidH - d.top - d.height / 2;
  const portY = FEET + s.baseThickness * 0.62;

  return (
    <group>
      {/* base */}
      <mesh geometry={g.base} material={metal} position={[0, FEET + s.baseThickness / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={g.foot} material={mattePlastic('#1a1a1c', 0.8)} position={[sx * (s.width / 2 - 2.6), FEET / 2, sz * (s.depth / 2 - 2.2)]} />
        )),
      )}
      {/* top deck, in a frame where x → right and y → back */}
      <group position={[0, top + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.deck} material={mattePlastic('#0b0b0d', 0.7)} position={[0, kbCenter, 0]} />
        <group position={[0, kbCenter, 0]}>
          {keycaps.map((m, i) => (
            <primitive key={i} object={m} />
          ))}
          <KeyLegends spec={s} layout={params.keyboard === 'azerty' ? 'azerty' : 'qwerty'} />
        </group>
        <mesh geometry={g.trackpadGap} material={mattePlastic('#5c5d61', 0.6)} position={[0, -s.depth / 2 + s.trackpad.front + s.trackpad.depth / 2, 0.006]} />
        <mesh
          geometry={g.trackpad}
          material={brushedMetal(finish.colors.frame, 0.34, 0.12)}
          position={[0, -s.depth / 2 + s.trackpad.front + s.trackpad.depth / 2, 0.012]}
        />
        {s.grilles && (
          <>
            <primitive object={grille} position={[-(kb.width / 2 + (s.width - kb.width) / 4 + 0.05), kbCenter, 0.006]} />
            <primitive object={grilleR} position={[kb.width / 2 + (s.width - kb.width) / 4 + 0.05, kbCenter, 0.006]} />
          </>
        )}
      </group>
      {/* ports: left and right side walls */}
      {/* Left wall faces -X (its local x runs towards +Z), right wall faces +X (local x runs towards -Z). */}
      <group position={[-s.width / 2 - 0.002, portY, 0]} rotation={[0, -Math.PI / 2, 0]}>
        {s.ports.left.map(([kind, z], i) => (
          <mesh key={i} geometry={g.ports[kind]} material={cavity()} position={[z, 0, 0]} />
        ))}
      </group>
      <group position={[s.width / 2 + 0.002, portY, 0]} rotation={[0, Math.PI / 2, 0]}>
        {s.ports.right.map(([kind, z], i) => (
          <mesh key={i} geometry={g.ports[kind]} material={cavity()} position={[-z, 0, 0]} />
        ))}
      </group>
      {/* hinge + lid */}
      <mesh geometry={g.hinge} material={mattePlastic('#18181b', 0.45)} position={[0, pivotY - 0.06, pivotZ]} rotation={[0, 0, Math.PI / 2]} />
      <group position={[0, pivotY, pivotZ]} rotation={[Math.PI / 2 - angle, 0, 0]}>
        <mesh geometry={g.lid} material={metal} castShadow />
        <group position={[0, 0, s.lidThickness / 2 + 0.006]}>
          <mesh geometry={g.bezel} material={coverGlass()} position={[0, lidH / 2, 0]} />
          <mesh geometry={g.display} material={material} position={[0, displayY, 0.006]} />
          {notch && <mesh geometry={g.notch} material={islandBlack()} position={[0, lidH - d.top - 0.31 + 0.01, 0.012]} />}
          <mesh position={[0, lidH - d.top / 2 - (notch ? 0.25 : 0), 0.016]}>
            <circleGeometry args={[0.07, 24]} />
            <primitive object={lensGlass()} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const finishes: DeviceFinish[] = [
  { id: 'space', name: { fr: 'Noir sidéral', en: 'Space black' }, swatch: '#2f3033', colors: { frame: '#2f3033' } },
  { id: 'silver', name: { fr: 'Argent', en: 'Silver' }, swatch: '#d8d9db', colors: { frame: '#d8d9db' } },
  { id: 'midnight', name: { fr: 'Minuit', en: 'Midnight' }, swatch: '#2e3646', colors: { frame: '#2e3646' } },
  { id: 'starlight', name: { fr: 'Lumière stellaire', en: 'Starlight' }, swatch: '#e3dccf', colors: { frame: '#e3dccf' } },
  { id: 'gray', name: { fr: 'Gris sidéral', en: 'Space gray' }, swatch: '#7d7e81', colors: { frame: '#7d7e81' } },
];

function defineLaptop(spec: LaptopSpec, view: DeviceModule['view']): DeviceModule {
  const Component = (props: DeviceProps) => <Laptop spec={spec} {...props} />;
  Component.displayName = `Laptop(${spec.id})`;
  return {
    id: spec.id,
    name: spec.name,
    category: 'laptop',
    anchor: 'bottom',
    size: [spec.width, spec.depth * 0.95, spec.depth],
    // The open lid rises and leans back behind the hinge.
    sizeFor: (p) => {
      const a = THREE.MathUtils.degToRad(Number(p.angle ?? 108));
      const lid = spec.depth - 0.2;
      const behind = Math.max(0, -Math.cos(a) * lid);
      return { size: [spec.width, spec.baseThickness + 0.1 + Math.max(0.6, Math.sin(a) * lid), spec.depth + behind * 2] };
    },
    surfaces: [
      {
        id: 'screen',
        label: { fr: 'Écran', en: 'Screen' },
        aspect: spec.display.width / spec.display.height,
        nativeSize: spec.nativeSize,
      },
    ],
    finishes: spec.finishes,
    defaultFinish: spec.finishes[0].id,
    params: [
      { id: 'angle', kind: 'slider', label: { fr: 'Ouverture', en: 'Opening' }, min: 0, max: 135, step: 1, default: 108, unit: '°' },
      { id: 'notch', kind: 'toggle', label: { fr: 'Encoche caméra', en: 'Camera notch' }, default: false },
      {
        id: 'keyboard',
        kind: 'choice',
        label: { fr: 'Clavier', en: 'Keyboard' },
        options: [
          { value: 'qwerty', label: { fr: 'QWERTY', en: 'QWERTY' } },
          { value: 'azerty', label: { fr: 'AZERTY', en: 'AZERTY' } },
        ],
        default: 'qwerty',
      },
    ],
    view,
    // centre of the open lid (≈108°)
    focus: [0, spec.depth * 0.52, -spec.depth / 2 - spec.depth * 0.13],
    yaw: -0.38,
    Component,
  };
}

export const laptop14 = defineLaptop(
  {
    id: 'laptop-14',
    name: { fr: 'Laptop 14', en: 'Laptop 14' },
    width: 31.26,
    depth: 22.12,
    baseThickness: 0.98,
    lidThickness: 0.52,
    radius: 0.85,
    baseEdge: { top: { d: 0.13, z: 0.13 }, bottom: { d: 0.36, z: 0.4 } },
    display: { width: 30.24, height: 19.64, top: 0.62, radius: 0.85 },
    nativeSize: [3024, 1964],
    keyboard: { back: 1.55, pitch: 1.9, fnPitch: 1.3 },
    trackpad: { width: 13.3, depth: 7.8, front: 0.75 },
    // Pro-style I/O: power + two USB-C + headphone jack left; USB-C, HDMI, SD right.
    ports: {
      left: [
        ['magsafe', -8.0],
        ['usbc', -5.7],
        ['usbc', -4.1],
        ['jack', 6.3],
      ],
      right: [
        ['usbc', -7.6],
        ['hdmi', -5.4],
        ['sd', -1.6],
      ],
    },
    grilles: true,
    finishes: [finishes[1], finishes[4], finishes[0]],
  },
  { target: [0, 9.5, -2], offset: [22, 17, 54] },
);

export const laptopAir = defineLaptop(
  {
    id: 'laptop-air-13',
    name: { fr: 'Laptop Air 13', en: 'Laptop Air 13' },
    width: 30.41,
    depth: 21.5,
    baseThickness: 0.62,
    lidThickness: 0.48,
    radius: 0.8,
    baseEdge: { top: { d: 0.1, z: 0.1 }, bottom: { d: 0.2, z: 0.22 } },
    display: { width: 29.0, height: 18.86, top: 0.6, radius: 0.8 },
    nativeSize: [2560, 1664],
    keyboard: { back: 1.25, pitch: 1.86, fnPitch: 1.5 },
    trackpad: { width: 12.0, depth: 7.6, front: 0.8 },
    // Thin-and-light I/O: power + two USB-C at the back left, headphone jack back right.
    ports: {
      left: [
        ['magsafe', -7.8],
        ['usbc', -5.7],
        ['usbc', -4.3],
      ],
      right: [['jack', -7.7]],
    },
    grilles: false,
    finishes: [finishes[2], finishes[3], finishes[1], finishes[4], finishes[0]],
  },
  { target: [0, 9, -2], offset: [22, 17, 54] },
);
