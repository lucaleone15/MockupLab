import { useEffect, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getModel } from '@/models/registry';
import { configureTextureLimits } from '@/store/assets';
import { useProject, type SceneItem } from '@/store/project';
import { useUi } from '@/store/ui';
import { setExportBridge } from './exporter';
import { StudioEnvironment } from './StudioEnvironment';

function Device({ item }: { item: SceneItem }) {
  const model = getModel(item.modelId);
  const finish = model.finishes.find((f) => f.id === item.finishId) ?? model.finishes[0];
  const Component = model.Component;
  return (
    <group position={item.position} rotation={item.rotation} scale={item.scale}>
      <Component finish={finish} surfaces={item.surfaces} screen={item.screen} params={item.params} />
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

/** Key light: gives specular highlights and casts a soft (VSM) shadow on the floor behind the devices. */
function KeyLight() {
  return (
    <directionalLight
      position={[-9, 44, 16]}
      intensity={0.9}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-radius={22}
      shadow-blurSamples={24}
      shadow-bias={-0.0005}
      shadow-camera-left={-55}
      shadow-camera-right={55}
      shadow-camera-top={55}
      shadow-camera-bottom={-55}
      shadow-camera-near={1}
      shadow-camera-far={120}
    />
  );
}

const DEFAULT_TARGET = new THREE.Vector3(0, 7.33, 0);
const DEFAULT_POSITION = new THREE.Vector3(10, 13, 41);

function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const resetToken = useUi((s) => s.viewResetToken);
  useEffect(() => {
    camera.position.copy(DEFAULT_POSITION);
    controls.current?.target.copy(DEFAULT_TARGET);
    controls.current?.update();
    invalidate();
  }, [resetToken, camera, invalidate]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Lets scripts/shoot.mjs frame close-ups.
    Object.assign(window, {
      __mockuplabCamera: (pos: [number, number, number], target: [number, number, number], fov?: number) => {
        camera.position.set(...pos);
        controls.current?.target.set(...target);
        if (fov && camera instanceof THREE.PerspectiveCamera) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        controls.current?.update();
        invalidate();
      },
    });
  }, [camera, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={DEFAULT_TARGET}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      minDistance={12}
      maxDistance={160}
      maxPolarAngle={Math.PI * 0.53}
    />
  );
}

export function Stage() {
  const items = useProject((s) => s.items);
  return (
    <Canvas
      className="!absolute inset-0"
      frameloop="demand"
      shadows="variance"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 26, near: 1, far: 2000, position: DEFAULT_POSITION.toArray() }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1;
        gl.setClearColor(0x000000, 0);
        configureTextureLimits(gl.capabilities.getMaxAnisotropy(), gl.capabilities.maxTextureSize);
      }}
    >
      <StudioEnvironment />
      <KeyLight />
      {items.map((item) => (
        <Device key={item.id} item={item} />
      ))}
      {/* soft cast shadow from the key light + tight contact occlusion */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={-1}>
        {/* kept inside the shadow camera frustum so its edge never shows */}
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={40} resolution={1024} blur={1.2} far={3} opacity={0.55} />
      <CameraRig />
      <ExportBridge />
    </Canvas>
  );
}
