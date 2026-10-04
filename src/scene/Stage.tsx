import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getModel } from '@/models/registry';
import { isLandscape } from '@/models/types';
import { configureTextureLimits } from '@/store/assets';
import { selectSelectedItem, useProject, type SceneItem } from '@/store/project';
import { CameraRig, DofPreview, lensFor } from './camera';
import { ContactShadow } from './ContactShadow';
import { DecorScene, decorLayout } from './Decor';
import { setExportBridge } from './exporter';
import { Lighting } from './lighting/Lighting';
import { ReflectiveFloor } from './ReflectiveFloor';
import { useAmbience } from './ambiences';
import { useCompositionBounds } from './bounds';
import { InteractionBridge, Interactive, SelectionRing } from './interaction';

/** Resting height of a device lying on its back (camera bumps included). */
const FLAT_CLEARANCE = 0.12;

function Device({ item }: { item: SceneItem }) {
  const brand = useProject((s) => s.brand);
  const model = getModel(item.modelId);
  const finish = model.finishes.find((f) => f.id === item.finishId) ?? model.finishes[0];
  const Component = model.Component;
  const upright = model.anchor !== 'bottom';
  // Only free-standing devices (phones, tablets…) are turned for landscape; others handle it themselves.
  const landscape = upright && isLandscape(item.params);
  const flat = upright && item.pose === 'flat';
  // Centre-anchored devices are lifted so they rest on the floor.
  const lift = !upright ? 0 : flat ? model.size[2] / 2 + FLAT_CLEARANCE : (landscape ? model.size[0] : model.size[1]) / 2;
  return (
    <group position={item.position} rotation={item.rotation} scale={item.scale} visible={item.visible}>
      <Interactive item={item}>
        <group position={[0, lift, 0]} rotation={[flat ? -Math.PI / 2 : 0, 0, 0]}>
          <group rotation={[0, 0, landscape ? Math.PI / 2 : 0]}>
            <Component finish={finish} surfaces={item.surfaces} screen={item.screen} params={item.params} brand={brand} />
          </group>
        </group>
      </Interactive>
    </group>
  );
}

/** Registers the live renderer with the exporter and restores it after offline renders. */
function ExportBridge() {
  const { gl, scene, camera, size, viewport, invalidate } = useThree();
  useEffect(() => {
    setExportBridge({
      gl,
      scene,
      camera,
      lens: () => lensFor(camera as THREE.PerspectiveCamera, useProject.getState().camera),
      restore: () => {
        gl.setPixelRatio(viewport.dpr);
        gl.setSize(size.width, size.height, false);
        invalidate();
      },
    });
    return () => setExportBridge(null);
  }, [gl, scene, camera, size, viewport.dpr, invalidate]);
  return null;
}

/** Shadows and reflection on the surface the devices stand on. */
function Ground({ floorY, top }: { floorY: number; top: THREE.BufferGeometry | null }) {
  const ground = useProject((s) => s.ground);
  const decor = useProject((s) => s.decor.kind);
  const floor = useMemo(() => new THREE.PlaneGeometry(400, 400), []);
  // Contact shadows cover the whole composition, wherever it stands.
  const { center, radius } = useCompositionBounds();
  const shadowSize = Math.max(decor === 'podium' ? 60 : 90, radius * 3);
  const catcherMaterial = useMemo(() => {
    const m = new THREE.ShadowMaterial({ transparent: true, depthWrite: false });
    const uRadius = { value: 1 };
    m.userData.uRadius = uRadius;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRadius = uRadius;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDisc;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDisc = position.xy;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDisc;\nuniform float uRadius;')
        .replace(
          'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
          'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * ( 1.0 - smoothstep( 0.62, 1.0, length( vDisc ) / uRadius ) ) );',
        );
    };
    return m;
  }, []);
  catcherMaterial.userData.uRadius.value = radius * 1.5;

  const catcher = decor === 'none' || decor === 'podium';
  const k = ground.shadowOpacity / 0.55;
  catcherMaterial.opacity = 0.36 * k;
  return (
    <>
      {/* soft cast shadow catcher on the studio floor (décors receive shadows themselves) */}
      {ground.shadow === 'soft' && catcher && (
        // Disc inside the key light's shadow frustum, fading out before its edge (no visible boundary).
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.001, center.z]} receiveShadow renderOrder={-1} material={catcherMaterial}>
          <circleGeometry args={[radius * 1.5, 96]} />
        </mesh>
      )}
      {ground.shadow !== 'none' && (
        <>
          {/* tight contact line + broad soft occlusion */}
          <ContactShadow y={floorY} x={center.x} z={center.z} size={shadowSize} far={1.3} blur={0.9 * (90 / shadowSize)} opacity={Math.min(1, 1.1 * k)} resolution={shadowSize > 120 ? 2048 : 1024} />
          <ContactShadow y={floorY} x={center.x} z={center.z} size={shadowSize} far={9} blur={3 * (90 / shadowSize)} resolution={512} opacity={Math.min(1, (ground.shadow === 'contact' ? 0.65 : 0.5) * k)} />
        </>
      )}
      {ground.reflection && <ReflectiveFloor geometry={top ?? floor} y={floorY} strength={ground.reflectivity} />}
    </>
  );
}

function Scene() {
  const items = useProject((s) => s.items);
  const selected = useProject(selectSelectedItem);
  const decor = useProject((s) => s.decor);
  const dof = useProject((s) => s.camera.dof);
  const layout = useMemo(() => decorLayout(decor, items), [decor, items]);
  const ambience = useAmbience(decor.kind === 'table' ? decor.ambience : null);
  return (
    <>
      <Lighting ambience={ambience} />
      <DecorScene decor={decor} items={items} />
      <group position={[0, layout.floorY, 0]}>
        {items.map((item) => (
          <Device key={item.id} item={item} />
        ))}
      </group>
      {items.length > 1 && selected && selected.visible && <SelectionRing item={selected} floorY={layout.floorY} />}
      <InteractionBridge floorY={layout.floorY} />
      <Ground floorY={layout.floorY} top={layout.top} />
      <CameraRig floorY={layout.floorY} />
      {dof && <DofPreview />}
      <ExportBridge />
    </>
  );
}

export function Stage() {
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop="demand"
      shadows="variance"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false }}
      camera={{ fov: 26, near: 1, far: 50000, position: [10, 13, 41] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
        gl.setClearColor(0x000000, 0);
        configureTextureLimits(gl.capabilities.getMaxAnisotropy(), gl.capabilities.maxTextureSize);
      }}
    >
      <Scene />
    </Canvas>
  );
}
