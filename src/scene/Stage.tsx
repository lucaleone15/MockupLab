import { useEffect, useRef, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ratioValue } from '@/export/settings';
import { getModel } from '@/models/registry';
import { isLandscape } from '@/models/types';
import { configureTextureLimits } from '@/store/assets';
import { selectSelectedItem, useProject, type SceneItem } from '@/store/project';
import { useUi } from '@/store/ui';
import { setExportBridge } from './exporter';
import { StudioEnvironment } from './StudioEnvironment';

function Device({ item }: { item: SceneItem }) {
  const model = getModel(item.modelId);
  const finish = model.finishes.find((f) => f.id === item.finishId) ?? model.finishes[0];
  const Component = model.Component;
  const landscape = isLandscape(item.params);
  // Centre-anchored devices are lifted so they rest on the floor.
  const lift = model.anchor === 'bottom' ? 0 : (landscape ? model.size[0] : model.size[1]) / 2;
  return (
    <group position={item.position} rotation={item.rotation} scale={item.scale}>
      <group position={[0, lift, 0]} rotation={[0, 0, landscape ? Math.PI / 2 : 0]}>
        <Component finish={finish} surfaces={item.surfaces} screen={item.screen} params={item.params} />
      </group>
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

/**
 * Camera framing for an item: the model's view spec gives the look-at point
 * and the viewing direction; the distance is computed from the device's
 * on-screen footprint (size, yaw, orientation) so it fills ~72 % of the frame
 * height or ~66 % of its width, whatever the export ratio.
 */
function viewFor(item: SceneItem | null, aspect: number, fovDeg: number) {
  const model = getModel(item?.modelId ?? 'phone-pro');
  const base = new THREE.Vector3(...(item?.position ?? [0, 0, 0]));
  const landscape = item ? isLandscape(item.params) && model.anchor !== 'bottom' : false;
  const [w, h, d] = model.size;
  const yaw = item?.rotation[1] ?? 0;
  const faceW = landscape ? h : w;
  const effW = Math.abs(faceW * Math.cos(yaw)) + Math.abs(d * Math.sin(yaw));
  const effH = landscape ? w : h;
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  // Devices standing on the floor are seen from above, so their projected height is larger.
  const fill = model.anchor === 'bottom' ? 0.62 : 0.72;
  const dist = Math.max(effH / (2 * t) / fill, effW / (2 * t * aspect) / (fill - 0.06));
  const local = model.anchor === 'bottom' ? new THREE.Vector3(...model.view.target) : new THREE.Vector3(0, effH / 2, 0);
  const target = base.clone().add(local);
  const dir = new THREE.Vector3(...model.view.offset).normalize();
  return { target, position: target.clone().add(dir.multiplyScalar(dist)) };
}

function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const resetToken = useUi((s) => s.viewResetToken);
  const item = useProject(selectSelectedItem);
  // Re-frame when the view is reset or the device / its orientation changes.
  const ratio = useProject((s) => s.export.ratio);
  const frameKey = `${resetToken}|${item?.modelId}|${item?.params.orientation}|${ratio}`;
  const itemRef = useRef(item);
  itemRef.current = item;
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    // Use the export ratio rather than camera.aspect: the canvas resizes after this runs.
    const { target, position } = viewFor(itemRef.current, ratioValue(ratioRef.current), cam.fov);
    camera.position.copy(position);
    controls.current?.target.copy(target);
    controls.current?.update();
    invalidate();
  }, [frameKey, camera, invalidate]);
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
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      minDistance={12}
      maxDistance={400}
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
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true }}
      camera={{ fov: 26, near: 1, far: 2000, position: [10, 13, 41] }}
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
