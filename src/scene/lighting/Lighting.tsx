import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useProject } from '@/store/project';
import { AMBIENCES, KEY_AZIMUTH, KEY_ELEVATION, goboTexture, type LoadedAmbience } from '../ambiences';
import { TABLE_BACK } from '../Decor';
import { screenUniforms } from '../screenMaterial';
import { LIGHT_PRESETS } from './presets';

const deg = THREE.MathUtils.degToRad;

/** Distance of the key light from the scene centre. */
const KEY_DISTANCE = 60;

const SHADOW_PROPS = {
  'shadow-mapSize': [2048, 2048] as [number, number],
  'shadow-blurSamples': 24,
  'shadow-bias': -0.0005,
};

const direction = (azimuth: number, elevation: number, distance: number): [number, number, number] => {
  const az = deg(azimuth);
  const el = deg(Math.max(5, Math.min(89, elevation)));
  return [Math.sin(az) * Math.cos(el) * distance, Math.sin(el) * distance, Math.cos(az) * Math.cos(el) * distance];
};

/**
 * Scene lighting.
 * - Studio: the preset's procedural environment (rotated with the key light
 *   so highlights follow it) and a shadow-casting key light.
 * - Table set: a real HDRI for fill and reflections (never shown), and a key
 *   light from the front-left — a spot projecting window / blinds / foliage
 *   shadows, or a soft directional light.
 */
export function Lighting({ ambience }: { ambience: LoadedAmbience | null }) {
  const lighting = useProject((s) => s.lighting);
  const ground = useProject((s) => s.ground);
  const decor = useProject((s) => s.decor);
  const { gl, invalidate } = useThree();
  const preset = LIGHT_PRESETS[lighting.preset];
  const table = decor.kind === 'table';
  const spotTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    // (environmentIntensity is passed to <Environment>, which would otherwise reset it to 1)
    gl.toneMappingExposure = lighting.exposure;
    screenUniforms.uExposure.value = lighting.exposure;
    screenUniforms.uReflection.value = table ? 0.16 : 1;
    invalidate();
  }, [gl, lighting.exposure, table, invalidate]);

  if (table) {
    const spec = AMBIENCES[decor.ambience];
    const intensity = spec.key.intensity * (lighting.intensity / 0.9);
    return (
      <>
        {ambience && <Environment map={ambience.env} environmentIntensity={lighting.environment} environmentRotation={[0, ambience.rotation, 0]} />}
        <primitive object={spotTarget} position={[0, 22, TABLE_BACK]} />
        {decor.gobo !== 'none' ? (
          <spotLight
            position={direction(KEY_AZIMUTH, KEY_ELEVATION - 6, 190)}
            target={spotTarget}
            color={spec.key.color}
            intensity={intensity}
            decay={0}
            angle={0.5}
            penumbra={0.6}
            map={goboTexture(decor.gobo)}
            castShadow
            shadow-radius={6}
            shadow-camera-near={40}
            shadow-camera-far={400}
            {...SHADOW_PROPS}
          />
        ) : (
          <directionalLight
            position={direction(KEY_AZIMUTH, KEY_ELEVATION, KEY_DISTANCE)}
            color={spec.key.color}
            intensity={intensity}
            castShadow
            shadow-radius={18}
            shadow-camera-left={-120}
            shadow-camera-right={120}
            shadow-camera-top={120}
            shadow-camera-bottom={-120}
            shadow-camera-near={1}
            shadow-camera-far={300}
            {...SHADOW_PROPS}
          />
        )}
      </>
    );
  }

  const castShadow = ground.shadow === 'soft' || decor.kind !== 'none';
  return (
    <>
      <Environment
        key={preset.id}
        resolution={512}
        frames={1}
        environmentIntensity={lighting.environment}
        environmentRotation={[0, deg(lighting.azimuth - preset.manual.azimuth), 0]}
      >
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
        position={direction(lighting.azimuth, lighting.elevation, KEY_DISTANCE)}
        intensity={lighting.intensity}
        color={lighting.color}
        castShadow={castShadow}
        shadow-radius={2 + lighting.softness * 34}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={1}
        shadow-camera-far={200}
        {...SHADOW_PROPS}
        shadow-mapSize={[1024, 1024]}
      />
    </>
  );
}
