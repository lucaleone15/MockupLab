import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { getModel } from '@/models/registry';
import { defaultParams } from '@/models/types';
import { sampleAsset } from '@/lib/samples';
import { StudioEnvironment } from '@/scene/StudioEnvironment';
import { DEFAULT_BRAND, DEFAULT_SCREEN, DEFAULT_SURFACE, type SurfaceBinding } from '@/store/project';

/*
 * The home page's hero: MockupLab's real laptop and phone, with the sample
 * designs on their screens, turning slowly in a dark studio — rendered by the
 * app's own models and studio light, apart from the user's project. Scrolling
 * turns them further and the pointer tilts them a little. It draws only while
 * on screen; with reduced motion it stays still.
 */

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One device of the hero, standing on the floor (y = 0), its screen showing a sample design. */
function HeroDevice({ modelId, sample, position, yaw }: { modelId: string; sample: string; position: [number, number, number]; yaw: number }) {
  const model = getModel(modelId);
  const [surfaces, setSurfaces] = useState<Record<string, SurfaceBinding> | null>(null);
  useEffect(() => {
    let alive = true;
    void sampleAsset(sample).then((assetId) => {
      if (!alive) return;
      setSurfaces(Object.fromEntries(model.surfaces.map((s, i) => [s.id, { ...DEFAULT_SURFACE, assetId: i === 0 ? assetId : null }])));
    });
    return () => {
      alive = false;
    };
  }, [model, sample]);
  if (!surfaces) return null;
  const Component = model.Component;
  // centre-anchored devices (the phone) are lifted onto the floor
  const lift = model.anchor === 'bottom' ? 0 : model.size[1] / 2;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group position={[0, lift, 0]}>
        <Component finish={model.finishes[0]} surfaces={surfaces} screen={DEFAULT_SCREEN} params={defaultParams(model)} brand={DEFAULT_BRAND} />
      </group>
    </group>
  );
}

function Turntable({ still, scroll }: { still: boolean; scroll: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const angle = useRef(0);
  useFrame((state, dt) => {
    (window as unknown as { __heroFrames?: number }).__heroFrames = ((window as unknown as { __heroFrames?: number }).__heroFrames ?? 0) + 1;
    const g = group.current;
    if (!g || still) return;
    angle.current += Math.min(dt, 0.05) * 0.18;
    const target = -0.35 + angle.current + (scroll.current ?? 0) * 0.9;
    g.rotation.y = target;
    // the pointer tilts the devices a little, eased
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -state.pointer.y * 0.12, 0.06);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, state.pointer.x * 0.05, 0.06);
  });
  return (
    <group ref={group} rotation={[0, -0.35, 0]}>
      <HeroDevice modelId="laptop-14" sample="sample-web.png" position={[-5, 0, -3]} yaw={0.15} />
      <HeroDevice modelId="phone-pro" sample="sample-app.png" position={[15, 0, 9]} yaw={-0.35} />
    </group>
  );
}

/** A soft radial glow as a texture (the light pool on the floor, the halo behind). */
function useGlow(inner: string, outer: string) {
  const [texture] = useState(() => {
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
  });
  return texture;
}

/** A studio set: a pool of light on the floor and a blue halo behind the devices. */
function Set() {
  const pool = useGlow('rgba(150,165,210,0.42)', 'rgba(150,165,210,0)');
  const halo = useGlow('rgba(61,123,255,0.5)', 'rgba(61,123,255,0)');
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, -0.05, 2]}>
        <planeGeometry args={[84, 56]} />
        <meshBasicMaterial map={pool} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[3, 22, -70]}>
        <planeGeometry args={[130, 62]} />
        <meshBasicMaterial map={halo} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function HeroStage({ className }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still] = useState(reducedMotion);
  const scroll = useRef(0);

  // draw only while on screen
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the home page scrolls inside its own container
  useEffect(() => {
    const scroller = wrap.current?.closest('[data-testid=home]');
    if (!scroller) return;
    const onScroll = () => (scroll.current = scroller.scrollTop / window.innerHeight);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={wrap} data-testid="hero-3d" className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={still ? 'demand' : visible ? 'always' : 'never'}
        camera={{ position: [0, 19, 78], fov: 30, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(3, 10, 0)}
      >
        <StudioEnvironment />
        <Set />
        <ambientLight intensity={0.15} />
        <directionalLight position={[-40, 80, 60]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <Turntable still={still} scroll={scroll} />
        <ContactShadows position={[0, 0, 0]} scale={140} blur={2.6} far={40} opacity={0.6} resolution={512} color="#000010" />
      </Canvas>
    </div>
  );
}
