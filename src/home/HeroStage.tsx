import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getModel } from '@/models/registry';
import { defaultParams, type ParamValue } from '@/models/types';
import { bundledAsset } from '@/lib/samples';
import { useRealMaterial } from '@/scene/realMaterials';
import { StudioEnvironment } from '@/scene/StudioEnvironment';
import { DEFAULT_BRAND, DEFAULT_SCREEN, DEFAULT_SURFACE, type SurfaceBinding } from '@/store/project';

/*
 * The home page's 3D stage: MockupLab's own device models, with the sample
 * designs on their screens, on a stage that follows the story. Each chapter
 * has its pose for every device (where it stands, where it faces, hidden or
 * not), its camera and its set; the stage eases to it (≈ 600 ms). It draws
 * only while on screen, and with reduced motion it jumps to each pose.
 */

export type ChapterId = 'intro' | 'why' | 'devices' | 'studio' | 'motion' | 'social' | 'clients';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Pose {
  x: number;
  z: number;
  yaw: number;
  /** Scale (1 by default). */
  s?: number;
}

interface Actor {
  key: string;
  model: string;
  /** The screen's image (a path from the site's root) in a chapter. */
  screen: (c: ChapterId) => string;
  params?: (c: ChapterId) => Record<string, ParamValue>;
  finish?: number;
  poses: Partial<Record<ChapterId, Pose>>;
}

const SAMPLE = (n: string) => `samples/sample-${n}.png`;
const HOME: Pose[] = [
  { x: -5, z: -3, yaw: 0.15 },
  { x: 15, z: 9, yaw: -0.35 },
];

const ACTORS: Actor[] = [
  {
    key: 'laptop',
    model: 'laptop-14',
    // « why »: the laptop shows MockupLab itself
    screen: (c) => (c === 'why' ? 'showcase/studio-ui.jpg' : SAMPLE('web')),
    poses: { intro: HOME[0], why: { x: -3, z: -2, yaw: 0.3 }, devices: { x: -13, z: -6, yaw: 0.35 }, studio: HOME[0], motion: HOME[0] },
  },
  {
    key: 'phone',
    model: 'phone-pro',
    screen: (c) => (c === 'social' ? SAMPLE('poster') : SAMPLE('app')),
    // « social »: the phone shows the design as an Insta post
    params: (c): Record<string, ParamValue> => (c === 'social' ? { app: 'post', caption: 'Le nouveau site est en ligne' } : {}),
    poses: { intro: HOME[1], why: { x: 12, z: 7, yaw: -0.15 }, studio: HOME[1], motion: HOME[1], social: { x: 2, z: 16, yaw: 0, s: 1.45 }, clients: { x: 2, z: 9, yaw: 0 } },
  },
  {
    // « devices »: another phone, another colour, and a tablet comes in
    key: 'classic',
    model: 'phone',
    finish: 2,
    screen: () => SAMPLE('app'),
    poses: { devices: { x: 7, z: 9, yaw: -0.2 } },
  },
  { key: 'tablet', model: 'tablet-pro-11', screen: () => SAMPLE('poster'), poses: { devices: { x: 23, z: 1, yaw: -0.45 } } },
  { key: 'fanL', model: 'phone-pro', finish: 1, screen: () => SAMPLE('poster'), poses: { clients: { x: -13, z: 4, yaw: 0.45 } } },
  { key: 'fanR', model: 'phone-pro', finish: 3, screen: () => SAMPLE('label'), poses: { clients: { x: 17, z: 4, yaw: -0.45 } } },
];

/** Camera per chapter: position and the point it looks at. */
const CAMERA: Record<ChapterId, [number, number, number, number, number, number]> = {
  intro: [0, 19, 78, 3, 10, 0],
  why: [0, 18, 70, 4, 10, 1],
  devices: [2, 20, 82, 4, 10, 0],
  studio: [0, 21, 80, 4, 9, 2],
  motion: [0, 19, 76, 4, 10, 2],
  social: [2, 15, 60, 2, 13, 12],
  clients: [2, 16, 70, 2, 10, 4],
};

/** The group's yaw per chapter (the motion chapter spins). */
const TURN: Record<ChapterId, number> = { intro: -0.35, why: -0.15, devices: -0.2, studio: -0.3, motion: -0.35, social: 0, clients: 0 };

type Set = 'sweep' | 'podium' | 'table';
const LIFT: Record<Set, number> = { sweep: 0, podium: 5, table: 3 };
const SETS: Set[] = ['sweep', 'podium', 'table'];

const BRAND = { ...DEFAULT_BRAND, name: 'Solstice festival' };
const damp = THREE.MathUtils.damp;

/** One device, its screen showing a bundled image. */
function Device({ actor, chapter }: { actor: Actor; chapter: ChapterId }) {
  const model = getModel(actor.model);
  const screen = actor.screen(chapter);
  const [surfaces, setSurfaces] = useState<Record<string, SurfaceBinding> | null>(null);
  useEffect(() => {
    let alive = true;
    void bundledAsset(screen).then((assetId) => {
      if (alive) setSurfaces(Object.fromEntries(model.surfaces.map((s, i) => [s.id, { ...DEFAULT_SURFACE, assetId: i === 0 ? assetId : null }])));
    });
    return () => {
      alive = false;
    };
  }, [model, screen]);
  const params = useMemo(() => ({ ...defaultParams(model), ...(actor.params?.(chapter) ?? {}) }), [model, actor, chapter]);
  if (!surfaces) return null;
  const Component = model.Component;
  const finish = model.finishes[actor.finish ?? 0] ?? model.finishes[0];
  // centre-anchored devices (phones, tablets) are lifted onto the floor
  const lift = model.anchor === 'bottom' ? 0 : model.size[1] / 2;
  return (
    <group position={[0, lift, 0]}>
      <Component finish={finish} surfaces={surfaces} screen={DEFAULT_SCREEN} params={params} brand={BRAND} />
    </group>
  );
}

/** An actor eased towards its pose of the chapter; hidden ones shrink away and stop drawing. */
function ActorNode({ actor, chapter, still }: { actor: Actor; chapter: ChapterId; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pose = actor.poses[chapter];
  // mounted the first time it is needed, then kept (no reload when coming back)
  const [mounted, setMounted] = useState(!!pose);
  useEffect(() => {
    if (pose) setMounted(true);
  }, [pose]);
  const start = actor.poses.intro ?? pose ?? { x: 0, z: 0, yaw: 0 };
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = pose ?? { ...(g.userData.last ?? start), s: 0 };
    if (pose) g.userData.last = pose;
    const k = still ? Infinity : 7;
    const t = Math.min(dt, 0.05);
    g.position.x = damp(g.position.x, target.x, k, t);
    g.position.z = damp(g.position.z, target.z, k, t);
    g.rotation.y = damp(g.rotation.y, target.yaw, k, t);
    const s = damp(g.scale.x, target.s ?? 1, k, t);
    g.scale.setScalar(Math.max(s, 0.0001));
    g.visible = s > 0.02;
  });
  if (!mounted) return null;
  return (
    <group ref={ref} position={[start.x, 0, start.z]} rotation={[0, start.yaw, 0]} scale={pose ? 1 : 0.0001}>
      <Device actor={actor} chapter={chapter} />
    </group>
  );
}

/** A soft pool of light on the floor (a texture, disposed with the stage). */
function useGlow(inner: string, outer: string) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, inner);
    r.addColorStop(1, outer);
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [inner, outer]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** The set of the « studio » chapter: a podium or a wooden table rises under the devices. */
function SetPieces({ set, still, light }: { set: Set; still: boolean; light: boolean }) {
  const podium = useRef<THREE.Mesh>(null);
  const table = useRef<THREE.Mesh>(null);
  const oak = useRealMaterial('oak', 120, 70);
  const stone = useMemo(() => new THREE.MeshPhysicalMaterial({ color: light ? '#e2e0dc' : '#2b2c33', roughness: 0.7, clearcoat: 0.15 }), [light]);
  useEffect(() => () => stone.dispose(), [stone]);
  useFrame((_, dt) => {
    const k = still ? Infinity : 7;
    const t = Math.min(dt, 0.05);
    for (const [m, on, h] of [
      [podium.current, set === 'podium', LIFT.podium],
      [table.current, set === 'table', LIFT.table],
    ] as const) {
      if (!m) continue;
      // it rises from the floor (scaled in height) rather than popping in
      const y = damp(m.scale.y, on ? 1 : 0.001, k, t);
      m.scale.y = y;
      m.position.y = (h * y) / 2;
      m.visible = y > 0.01;
    }
  });
  return (
    <>
      <mesh ref={podium} material={stone} position={[4, 0, 3]} scale={[1, 0.001, 1]} castShadow receiveShadow>
        <cylinderGeometry args={[32, 32, LIFT.podium, 96]} />
      </mesh>
      <mesh ref={table} material={oak} position={[4, 0, 2]} scale={[1, 0.001, 1]} castShadow receiveShadow>
        <boxGeometry args={[120, LIFT.table, 70]} />
      </mesh>
    </>
  );
}

function Story({ chapter, still, light }: { chapter: ChapterId; still: boolean; light: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lifted = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const look = useRef(new THREE.Vector3(...CAMERA.intro.slice(3)));
  const invalidate = useThree((s) => s.invalidate);
  const [set, setSet] = useState<Set>('sweep');
  const pool = useGlow(light ? 'rgba(255,255,255,0.55)' : 'rgba(150,165,210,0.35)', 'rgba(255,255,255,0)');

  // the studio chapter shows its sets one after the other (the table, held still, with reduced motion)
  useEffect(() => {
    if (chapter !== 'studio') return setSet('sweep');
    if (still) return setSet('table');
    let i = 0;
    setSet(SETS[1]);
    const id = setInterval(() => setSet(SETS[(++i + 1) % SETS.length]), 1600);
    return () => clearInterval(id);
  }, [chapter, still]);

  useEffect(() => {
    (window as unknown as { __heroState?: ChapterId }).__heroState = chapter;
    invalidate();
  }, [chapter, set, invalidate]);

  useFrame((state, dt) => {
    const w = window as unknown as { __heroFrames?: number };
    w.__heroFrames = (w.__heroFrames ?? 0) + 1;
    const t = Math.min(dt, 0.05);
    const k = still ? Infinity : 6;
    const g = group.current;
    if (g) {
      // the motion chapter spins the devices; elsewhere they settle back to the chapter's angle
      if (chapter === 'motion' && !still) spin.current += t * 1.3;
      else spin.current = damp(spin.current, Math.round(spin.current / (Math.PI * 2)) * Math.PI * 2, k, t);
      const sway = chapter === 'intro' && !still ? Math.sin(state.clock.elapsedTime * 0.35) * 0.18 : 0;
      g.rotation.y = damp(g.rotation.y, TURN[chapter] + sway, k, t) + (spin.current - (g.userData.spin ?? 0));
      g.userData.spin = spin.current;
      // the pointer tilts the stage a little
      if (!still) {
        g.rotation.x = damp(g.rotation.x, -state.pointer.y * 0.06, 4, t);
        g.rotation.z = damp(g.rotation.z, state.pointer.x * 0.03, 4, t);
      }
    }
    if (lifted.current) lifted.current.position.y = damp(lifted.current.position.y, LIFT[set], k, t);
    const [px, py, pz, lx, ly, lz] = CAMERA[chapter];
    // a tall stage (the right column) needs the camera further back for the same framing as a wide one
    const back = THREE.MathUtils.clamp(1.35 / (state.size.width / state.size.height), 1, 1.9);
    const cx = lx + (px - lx) * back;
    const cy = ly + (py - ly) * back;
    const cz = lz + (pz - lz) * back;
    const cam = state.camera;
    cam.position.set(damp(cam.position.x, cx, k * 0.8, t), damp(cam.position.y, cy, k * 0.8, t), damp(cam.position.z, cz, k * 0.8, t));
    look.current.set(damp(look.current.x, lx, k * 0.8, t), damp(look.current.y, ly, k * 0.8, t), damp(look.current.z, lz, k * 0.8, t));
    cam.lookAt(look.current);
  });

  return (
    <group ref={group} rotation={[0, TURN.intro, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, 0.02, 2]}>
        <planeGeometry args={[96, 64]} />
        <meshBasicMaterial map={pool} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <SetPieces set={set} still={still} light={light} />
      <group ref={lifted}>
        {ACTORS.map((a) => (
          <ActorNode key={a.key} actor={a} chapter={chapter} still={still} />
        ))}
        <ContactShadows position={[0, 0.03, 0]} scale={140} blur={2.6} far={40} opacity={light ? 0.45 : 0.65} resolution={512} color={light ? '#1a2240' : '#000010'} />
      </group>
    </group>
  );
}

export default function HeroStage({ className, chapter, light, eventSource }: { className?: string; chapter: ChapterId; light: boolean; eventSource?: RefObject<HTMLElement | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still] = useState(reducedMotion);

  // draws only while on screen
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // the set fades into the page's paper at its edges (no hard edge of the canvas)
    <div ref={wrap} data-testid="hero-3d" data-chapter={chapter} className={className} style={{ maskImage: 'radial-gradient(72% 68% at 50% 48%, #000 62%, transparent 100%)', WebkitMaskImage: 'radial-gradient(72% 68% at 50% 48%, #000 62%, transparent 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={!visible ? 'never' : still ? 'demand' : 'always'}
        camera={{ position: CAMERA.intro.slice(0, 3) as [number, number, number], fov: 30, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        eventSource={eventSource?.current ?? undefined}
        eventPrefix="client"
        onCreated={({ camera }) => camera.lookAt(...(CAMERA.intro.slice(3) as [number, number, number]))}
      >
        <StudioEnvironment />
        <ambientLight intensity={light ? 0.35 : 0.15} />
        <directionalLight position={[-40, 80, 60]} intensity={light ? 1.3 : 1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <Story chapter={chapter} still={still} light={light} />
      </Canvas>
    </div>
  );
}
