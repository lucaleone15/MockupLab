import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useProject } from '@/store/project';
import type { LoadedPlace } from '../places';
import { screenUniforms } from '../screenMaterial';
import { LIGHT_PRESETS } from './presets';

const deg = THREE.MathUtils.degToRad;

/** Distance of the key light from the scene centre (directional light: only the direction matters). */
const KEY_DISTANCE = 60;

/**
 * Scene lighting. In a studio set-up: the preset's procedural environment
 * (rotated with the key light so highlights follow it) and a shadow-casting
 * key light. In a real place: the place's HDRI, and a key light aimed from
 * the room's main light source (detected in the HDRI).
 */
export function Lighting({ place }: { place: LoadedPlace | null }) {
  const lighting = useProject((s) => s.lighting);
  const ground = useProject((s) => s.ground);
  const decor = useProject((s) => s.decor);
  const { scene, gl, invalidate } = useThree();
  const preset = LIGHT_PRESETS[lighting.preset];
  const inPlace = decor.kind === 'place';

  useEffect(() => {
    scene.environmentIntensity = lighting.environment;
    gl.toneMappingExposure = lighting.exposure;
    screenUniforms.uExposure.value = lighting.exposure;
    invalidate();
  }, [scene, gl, lighting.environment, lighting.exposure, invalidate]);

  // Key light direction: from the HDRI's main light in a place, from the settings otherwise.
  const position = useMemo<[number, number, number]>(() => {
    if (inPlace && place) {
      const sun = place.sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deg(decor.rotation));
      // Keep it above the table so shadows stay on it.
      sun.y = Math.max(sun.y, 0.45);
      sun.normalize().multiplyScalar(KEY_DISTANCE);
      return [sun.x, sun.y, sun.z];
    }
    const az = deg(lighting.azimuth);
    const el = deg(Math.max(5, Math.min(89, lighting.elevation)));
    return [Math.sin(az) * Math.cos(el) * KEY_DISTANCE, Math.sin(el) * KEY_DISTANCE, Math.cos(az) * Math.cos(el) * KEY_DISTANCE];
  }, [inPlace, place, decor.rotation, lighting.azimuth, lighting.elevation]);

  const castShadow = ground.shadow === 'soft' || decor.kind !== 'none';
  const envRotation: [number, number, number] = inPlace
    ? [0, deg(decor.rotation), 0]
    : [0, deg(lighting.azimuth - preset.manual.azimuth), 0];

  return (
    <>
      {inPlace ? (
        place && <Environment map={place.env} environmentRotation={envRotation} />
      ) : (
        <Environment key={preset.id} resolution={512} frames={1} environmentRotation={envRotation}>
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
      )}
      <directionalLight
        position={position}
        intensity={inPlace ? lighting.intensity * 1.7 : lighting.intensity}
        color={inPlace ? '#fff6ea' : lighting.color}
        castShadow={castShadow}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={2 + (inPlace ? 0.55 : lighting.softness) * 34}
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
