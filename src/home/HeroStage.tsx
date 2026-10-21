import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getModel } from '@/models/registry';
import { defaultParams, type ParamValue } from '@/models/types';
import { bundledAsset } from '@/lib/samples';
import { StudioEnvironment } from '@/scene/StudioEnvironment';
import { DEFAULT_BRAND, DEFAULT_SCREEN, DEFAULT_SURFACE, type SurfaceBinding } from '@/store/project';
import type { StoryChapter } from './useStoryProgress';

/*
 * The home page's 3D story, scrubbed by the scroll. Each chapter is a function
 * of its progress (0 → 1) giving every device's pose, the camera and the set;
 * the stage eases to it every frame, so the 3D follows the reader's finger,
 * both ways. MockupLab's own models and sample designs; the user's project is
 * never touched. It draws only while on screen.
 */

type Key = 'laptop' | 'phone' | 'phoneB' | 'phoneC' | 'tablet';
interface Pose {
  x: number;
  y?: number;
  z: number;
  yaw: number;
  /** Scale; 0 hides the device. */
  s?: number;
}
interface Frame {
  actors: Partial<Record<Key, Pose>>;
  /** Camera position and the point it looks at. */
  camera: [number, number, number, number, number, number];
  /** The whole group's yaw. */
  turn?: number;
  /** The laptop's lid (degrees). */
  lid?: number;
  /** The laptop's screen brightness (0 → 1). */
  glow?: number;
  /** The key light sweeping across (0 → 1). */
  sweep?: number;
  /** « drop »: the capture's descent (0 → 1) and whether it has landed on the screen. */
  capture?: number;
  landed?: boolean;
  /** « social »: how far the feed has scrolled. */
  feed?: number;
  /** « studio »: how far the layers stand apart (0 → 1). */
  explode?: number;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** The phone's scale in « drop » (the capture lands on its screen). */
const DROP = 1;
const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pose = (a: Pose, b: Pose, t: number): Pose => ({ x: mix(a.x, b.x, t), y: mix(a.y ?? 0, b.y ?? 0, t), z: mix(a.z, b.z, t), yaw: mix(a.yaw, b.yaw, t), s: mix(a.s ?? 1, b.s ?? 1, t) });

/** Every chapter, as a function of its progress. At p ≈ 0.2 the chapter's title sits mid-screen. */
export const FRAMES: Record<StoryChapter, (p: number) => Frame> = {
  open: (p) => {
    const t = ease(ramp(p, 0.25, 0.8));
    return {
      actors: { laptop: { x: 0, z: 0, yaw: mix(-0.5, 0, t) } },
      camera: [0, mix(26, 15, t), mix(96, 68, t), 0, mix(6, 11, t), 0],
      lid: Math.round(108 * t),
      glow: ramp(p, 0.55, 0.85),
      sweep: ramp(p, 0, 0.7),
    };
  },
  drop: (p) => {
    const c = ease(ramp(p, 0.2, 0.7));
    return { actors: { phone: { x: 0, z: 8, yaw: mix(-0.25, 0, c), s: DROP } }, camera: [0, 12, 60, 0, 10, 8], capture: c, landed: p > 0.7 };
  },
  devices: (p) => {
    const e = ease(ramp(p, 0.15, 0.8));
    const from: Pose = { x: 0, z: 8, yaw: 0, s: 0.4 };
    return {
      actors: {
        phone: { x: 0, z: 10, yaw: 0 },
        phoneB: pose(from, { x: -15, z: 5, yaw: 0.42 }, e),
        phoneC: pose(from, { x: 15, z: 5, yaw: -0.42 }, e),
        tablet: pose(from, { x: 33, z: -2, yaw: -0.55 }, e),
        laptop: pose(from, { x: -35, z: -6, yaw: 0.55 }, e),
      },
      camera: [0, 20, mix(62, 104, e), 0, 10, 0],
      turn: mix(0.35, -0.35, p),
    };
  },
  studio: (p) => {
    const x = Math.sin(Math.PI * ramp(p, 0.15, 0.95));
    return { actors: { phone: { x: 0, y: 5 + 6 * x, z: 6, yaw: -0.35, s: 1.2 } }, camera: [28, 22, 90, 0, 13, 0], explode: x };
  },
  motion: (p) => {
    const a = mix(-0.9, 0.9, p);
    const r = mix(92, 46, ease(p));
    return { actors: { laptop: { x: -11, z: -5, yaw: 0.2 }, phone: { x: 8, z: 7, yaw: -0.3 } }, camera: [Math.sin(a) * r, mix(26, 12, p), Math.cos(a) * r, 2, 10, 2] };
  },
  social: (p) => {
    const turn = ease(ramp(p, 0.1, 0.4));
    return { actors: { phone: { x: 0, z: 10, yaw: mix(-1.1, 0, turn), s: 1.12 } }, camera: [0, 12, 68, 0, 8.5, 10], feed: ease(ramp(p, 0.45, 0.85)) };
  },
  clients: (p) => {
    const e = ease(ramp(p, 0.15, 0.8));
    return {
      actors: {
        laptop: pose({ x: -30, z: 14, yaw: 0.9 }, { x: -20, z: -2, yaw: 0 }, e),
        phone: pose({ x: 4, z: 22, yaw: -1.2 }, { x: 3, z: 4, yaw: 0 }, e),
        phoneB: pose({ x: 24, z: -10, yaw: 1.1 }, { x: 14, z: 4, yaw: 0 }, e),
        phoneC: pose({ x: 36, z: 12, yaw: -0.8 }, { x: 25, z: 4, yaw: 0 }, e),
      },
      camera: [mix(30, 2, e), mix(30, 18, e), mix(86, 80, e), 2, 10, 0],
    };
  },
};

const SAMPLE = (n: string) => `samples/sample-${n}.png`;
const ACTORS: { key: Key; model: string; finish?: number; screen: (c: StoryChapter) => string }[] = [
  { key: 'laptop', model: 'laptop-14', screen: () => SAMPLE('web') },
  { key: 'phone', model: 'phone-pro', screen: (c) => (c === 'social' ? SAMPLE('poster') : SAMPLE('app')) },
  { key: 'phoneB', model: 'phone-pro', finish: 1, screen: () => SAMPLE('poster') },
  { key: 'phoneC', model: 'phone', finish: 1, screen: () => SAMPLE('label') },
  { key: 'tablet', model: 'tablet-pro-11', screen: () => SAMPLE('poster') },
];
const BRAND = { ...DEFAULT_BRAND, name: 'Solstice festival' };
const damp = THREE.MathUtils.damp;

/** One device, its screen showing a bundled image (none: an empty screen). */
function Device({ model: id, finish, screen, params, brightness }: { model: string; finish?: number; screen: string | null; params: Record<string, ParamValue>; brightness: number }) {
  const model = getModel(id);
  const [surfaces, setSurfaces] = useState<Record<string, SurfaceBinding> | null>(null);
  useEffect(() => {
    let alive = true;
    if (!screen) {
      setSurfaces(Object.fromEntries(model.surfaces.map((s) => [s.id, { ...DEFAULT_SURFACE }])));
      return;
    }
    void bundledAsset(screen).then((assetId) => {
      if (alive) setSurfaces(Object.fromEntries(model.surfaces.map((s, i) => [s.id, { ...DEFAULT_SURFACE, assetId: i === 0 ? assetId : null }])));
    });
    return () => {
      alive = false;
    };
  }, [model, screen]);
  const all = useMemo(() => ({ ...defaultParams(model), ...params }), [model, params]);
  const look = useMemo(() => ({ ...DEFAULT_SCREEN, brightness: DEFAULT_SCREEN.brightness * brightness }), [brightness]);
  if (!surfaces) return null;
  const Component = model.Component;
  const lift = model.anchor === 'bottom' ? 0 : model.size[1] / 2;
  return (
    <group position={[0, lift, 0]}>
      <Component finish={model.finishes[finish ?? 0] ?? model.finishes[0]} surfaces={surfaces} screen={look} params={all} brand={BRAND} />
    </group>
  );
}

/** The capture of « drop »: a flat design coming down onto the phone's screen. */
function Capture({ t, landed }: { t: RefObject<number>; landed: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${SAMPLE('app')}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const phone = getModel('phone-pro');
  const aspect = phone.surfaces[0].aspect;
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const c = t.current ?? 0;
    // from above, tilted, to flat on the screen (the phone stands at z 8)
    m.position.set(0, mix(40, phone.size[1] * DROP * 0.5, c), mix(26, 8 + phone.size[2] * DROP * 0.5 + 0.4, c));
    m.rotation.x = mix(-0.9, 0, c);
    const s = mix(1.6, 1, c);
    m.scale.set(s, s, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = mix(0.2, 1, ramp(c, 0, 0.3));
    m.visible = !landed;
  });
  const w = 6.4 * DROP;
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[w, w / aspect]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** « studio »: the set comes apart in layers (backdrop, podium, softbox) and back. */
function StudioSet({ explode }: { explode: RefObject<number> }) {
  const wall = useRef<THREE.Mesh>(null);
  const podium = useRef<THREE.Mesh>(null);
  const softbox = useRef<THREE.Group>(null);
  const materials = useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({ color: '#e7e2f3', roughness: 0.95 }),
      podium: new THREE.MeshPhysicalMaterial({ color: '#f1efec', roughness: 0.6, clearcoat: 0.2 }),
      light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6 }),
      frame: new THREE.MeshStandardMaterial({ color: '#2a2b30', roughness: 0.5 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useFrame(() => {
    const x = Math.max(0, explode.current ?? 0);
    wall.current?.position.set(0, 40, -30 - 34 * x);
    podium.current?.position.set(0, 2.5 - 8 * x, 6);
    if (softbox.current) {
      softbox.current.position.set(-26 - 8 * x, 16 + 6 * x, 2);
      softbox.current.rotation.set(0.1, 0.75, 0);
    }
  });
  return (
    <>
      <mesh ref={wall} material={materials.wall} receiveShadow>
        <planeGeometry args={[260, 140]} />
      </mesh>
      <mesh ref={podium} material={materials.podium} castShadow receiveShadow>
        <cylinderGeometry args={[15, 15, 5, 96]} />
      </mesh>
      <group ref={softbox}>
        {/* a softbox: a lit diffuser in a thin dark rim, its back facing away */}
        <mesh material={materials.frame}>
          <boxGeometry args={[16.6, 16.6, 4]} />
        </mesh>
        <mesh material={materials.light} position={[0, 0, 2.05]}>
          <planeGeometry args={[16, 16]} />
        </mesh>
      </group>
    </>
  );
}

function Story({ chapter, progress, light }: { chapter: StoryChapter; progress: number; light: boolean }) {
  const group = useRef<THREE.Group>(null);
  const actors = useRef<Partial<Record<Key, THREE.Group>>>({});
  const key = useRef<THREE.DirectionalLight>(null);
  const smooth = useRef({ chapter, p: progress });
  const look = useRef(new THREE.Vector3(0, 8, 0));
  const capture = useRef(0);
  const explode = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  // what changes the devices themselves (their settings, their screens), in coarse steps
  const [disc, setDisc] = useState({ lid: 0, glow: 0, landed: false, feed: 0 });
  const discRef = useRef(disc);

  useEffect(() => {
    const w = window as unknown as { __heroState?: StoryChapter; __heroProgress?: number };
    w.__heroState = chapter;
    w.__heroProgress = progress;
    invalidate();
  }, [chapter, progress, invalidate]);

  useFrame((state, dt) => {
    const w = window as unknown as { __heroFrames?: number; __heroPose?: { lidAngle: number } };
    w.__heroFrames = (w.__heroFrames ?? 0) + 1;
    const t = Math.min(dt, 0.05);
    // the progress eases to the reader's; a new chapter starts from where the reader is
    if (smooth.current.chapter !== chapter) smooth.current = { chapter, p: progress };
    smooth.current.p = damp(smooth.current.p, progress, 9, t);
    const f = FRAMES[chapter](smooth.current.p);
    for (const a of ACTORS) {
      const g = actors.current[a.key];
      if (!g) continue;
      const target = f.actors[a.key] ?? { x: g.position.x, y: g.position.y, z: g.position.z, yaw: g.rotation.y, s: 0 };
      g.position.x = damp(g.position.x, target.x, 8, t);
      g.position.y = damp(g.position.y, target.y ?? 0, 8, t);
      g.position.z = damp(g.position.z, target.z, 8, t);
      g.rotation.y = damp(g.rotation.y, target.yaw, 8, t);
      const s = damp(g.scale.x, target.s ?? 1, 8, t);
      g.scale.setScalar(Math.max(s, 0.0001));
      g.visible = s > 0.02;
    }
    if (group.current) {
      group.current.rotation.y = damp(group.current.rotation.y, f.turn ?? 0, 6, t);
      group.current.rotation.x = damp(group.current.rotation.x, -state.pointer.y * 0.05, 4, t);
    }
    const [px, py, pz, lx, ly, lz] = f.camera;
    // the words take the top of the screen, as on Apple's pages: the picture moves down and steps back a little
    const back = THREE.MathUtils.clamp(1.75 / (state.size.width / state.size.height), 1.15, 2.1);
    const { width: sw, height: sh } = state.size;
    const shiftY = -sh * 0.17;
    const v = (state.camera as THREE.PerspectiveCamera).view;
    if (!v?.enabled || v.offsetY !== shiftY || v.width !== sw || v.height !== sh) (state.camera as THREE.PerspectiveCamera).setViewOffset(sw, sh, 0, shiftY, sw, sh);
    const cam = state.camera;
    cam.position.set(damp(cam.position.x, lx + (px - lx) * back, 7, t), damp(cam.position.y, ly + (py - ly) * back, 7, t), damp(cam.position.z, lz + (pz - lz) * back, 7, t));
    look.current.set(damp(look.current.x, lx, 7, t), damp(look.current.y, ly, 7, t), damp(look.current.z, lz, 7, t));
    cam.lookAt(look.current);
    if (key.current) key.current.position.x = mix(-90, 50, f.sweep ?? 0.6);
    capture.current = f.capture ?? 0;
    explode.current = f.explode ?? 0;
    const next = { lid: f.lid ?? 108, glow: Math.round((f.glow ?? 1) * 20) / 20, landed: f.landed ?? true, feed: Math.round((f.feed ?? 0) * 25) / 25 };
    const d = discRef.current;
    if (next.lid !== d.lid || next.glow !== d.glow || next.landed !== d.landed || next.feed !== d.feed) {
      discRef.current = next;
      setDisc(next);
    }
    w.__heroPose = { lidAngle: discRef.current.lid };
  });

  const phoneParams = useMemo(() => (chapter === 'social' ? { app: 'post', caption: 'Le nouveau site est en ligne', feed: disc.feed } : {}), [chapter, disc.feed]);
  const laptopParams = useMemo(() => ({ angle: disc.lid }), [disc.lid]);
  const none = useMemo(() => ({}), []);
  const dark = chapter === 'drop' && !disc.landed;
  return (
    <>
      <directionalLight ref={key} position={[-40, 80, 60]} intensity={light ? 1.4 : 1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <group ref={group}>
        {ACTORS.map((a) => (
          <group key={a.key} ref={(g) => void (g && (actors.current[a.key] = g))} scale={0.0001}>
            <Device
              model={a.model}
              finish={a.finish}
              screen={a.key === 'phone' && dark ? null : a.screen(chapter)}
              params={a.key === 'laptop' ? laptopParams : a.key === 'phone' ? phoneParams : none}
              brightness={a.key === 'laptop' ? disc.glow : a.key === 'phone' && dark ? 0.05 : 1}
            />
          </group>
        ))}
        {chapter === 'drop' && <Capture t={capture} landed={disc.landed} />}
        {chapter === 'studio' && <StudioSet explode={explode} />}
        <ContactShadows position={[0, 0.03, 0]} scale={140} blur={2.6} far={40} opacity={light ? 0.4 : 0.7} resolution={512} color={light ? '#1a2240' : '#000010'} />
      </group>
    </>
  );
}

export default function HeroStage({ className, chapter, progress, light, eventSource }: { className?: string; chapter: StoryChapter; progress: number; light: boolean; eventSource?: RefObject<HTMLElement | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} data-testid="hero-3d" data-chapter={chapter} className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        // measured without scroll listeners: the stage is sticky, its size only changes with the window
        resize={{ scroll: false }}
        camera={{ position: [0, 26, 96], fov: 30, near: 1, far: 2000 }}
        gl={{ antialias: true, alpha: true }}
        eventSource={eventSource?.current ?? undefined}
        eventPrefix="client"
      >
        <StudioEnvironment />
        <ambientLight intensity={light ? 0.4 : 0.15} />
        <Story chapter={chapter} progress={progress} light={light} />
      </Canvas>
    </div>
  );
}
