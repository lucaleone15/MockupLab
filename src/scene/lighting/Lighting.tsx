import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useProject } from '@/store/project';
import { screenUniforms } from '../screenMaterial';
import { LIGHT_PRESETS } from './presets';

const deg = THREE.MathUtils.degToRad;

/** Distance of the key light from the scene centre (directional light: only the direction matters). */
const KEY_DISTANCE = 60;

/**
 * Scene lighting from the project settings: the preset's procedural
 * environment (rotated with the key light azimuth so highlights follow it),
 * a shadow-casting key light, and global exposure.
 */
export function Lighting() {
  const lighting = useProject((s) => s.lighting);
  const ground = useProject((s) => s.ground);
  const decor = useProject((s) => s.decor.kind);
  const { scene, gl, invalidate } = useThree();
  const preset = LIGHT_PRESETS[lighting.preset];

  useEffect(() => {
    // Rotate the environment with the key light so reflections stay coherent.
    scene.environmentRotation.set(0, deg(lighting.azimuth - preset.manual.azimuth), 0);
    scene.environmentIntensity = lighting.environment;
    gl.toneMappingExposure = lighting.exposure;
    screenUniforms.uExposure.value = lighting.exposure;
    invalidate();
  }, [scene, gl, lighting.azimuth, lighting.environment, lighting.exposure, preset, invalidate]);

  const az = deg(lighting.azimuth);
  const el = deg(Math.max(5, Math.min(89, lighting.elevation)));
  const position: [number, number, number] = [
    Math.sin(az) * Math.cos(el) * KEY_DISTANCE,
    Math.sin(el) * KEY_DISTANCE,
    Math.cos(az) * Math.cos(el) * KEY_DISTANCE,
  ];
  const castShadow = ground.shadow === 'soft' || decor !== 'none';

  return (
    <>
      <Environment key={preset.id} resolution={512} frames={1}>
        <color attach="background" args={[preset.envColor]} />
        {preset.formers.map((f, i) => (
          <Lightformer
            key={i}
            form={f.form}
            intensity={f.intensity}
            color={f.color ?? '#ffffff'}
            position={f.position}
            scale={f.scale}
            {...(f.aim ? { target: [0, 0, 0] as [number, number, number] } : { rotation: f.rotation ?? [0, 0, 0] })}
          />
        ))}
      </Environment>
      <directionalLight
        position={position}
        intensity={lighting.intensity}
        color={lighting.color}
        castShadow={castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={2 + lighting.softness * 34}
        shadow-blurSamples={24}
        shadow-bias={-0.0005}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
    </>
  );
}
