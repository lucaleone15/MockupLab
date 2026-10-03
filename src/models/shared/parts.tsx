import * as THREE from 'three';
import { circleOutline } from '@/lib/geometry/outline';
import { flatShape, latheZ } from '@/lib/geometry/sweep';
import { blackGloss, cavity, flashDiffuser, lensGlass, mattePlastic, polishedMetal, sapphireCover } from '@/scene/materials';

/*
 * Small parts shared by every device: camera lenses, flash, sensors, holes.
 * Geometries are built once and scaled per use.
 */

const RING_R = 0.79; // outer radius of the reference lens geometry

let parts: {
  lensRing: THREE.BufferGeometry;
  lensBarrel: THREE.BufferGeometry;
  lensDome: THREE.BufferGeometry;
  lensCover: THREE.BufferGeometry;
  disc: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
} | null = null;

function geo() {
  return (parts ??= {
    // [radius, height] pairs: outer wall up → top → inner wall down.
    lensRing: latheZ(
      [
        [0.79, 0],
        [0.79, 0.11],
        [0.785, 0.13],
        [0.772, 0.142],
        [0.735, 0.145],
        [0.722, 0.138],
        [0.718, 0.12],
      ],
      72,
    ),
    // dark anodised barrel visible through the cover glass
    lensBarrel: latheZ(
      [
        [0.72, 0.1],
        [0.6, 0.1],
        [0.52, 0.085],
        [0.46, 0.08],
      ],
      72,
    ),
    // coated front element
    lensDome: latheZ(
      [
        [0.47, 0.079],
        [0.4, 0.088],
        [0.25, 0.095],
        [0.0, 0.098],
      ],
      72,
    ),
    // flat sapphire cover over the whole lens
    lensCover: latheZ(
      [
        [0.722, 0.122],
        [0.5, 0.124],
        [0.0, 0.125],
      ],
      72,
    ),
    disc: latheZ(
      [
        [1, 0],
        [1, 0.08],
        [0.85, 0.11],
        [0.0, 0.12],
      ],
      40,
    ),
    hole: flatShape(circleOutline(1, 24)),
  });
}

type V3 = [number, number, number];

/** Camera lens with a polished ring of the given outer radius, standing on +Z. */
export function Lens({ position, radius, ring }: { position: V3; radius: number; ring: string }) {
  const g = geo();
  const k = radius / RING_R;
  return (
    <group position={position} scale={[k, k, Math.min(1, k * 1.1)]}>
      <mesh geometry={g.lensRing} material={polishedMetal(ring)} />
      <mesh geometry={g.lensBarrel} material={mattePlastic('#16161a', 0.42)} />
      <mesh geometry={g.lensDome} material={lensGlass()} />
      <mesh geometry={g.lensCover} material={sapphireCover()} />
    </group>
  );
}

/** Flash diffuser. */
export function Flash({ position, radius }: { position: V3; radius: number }) {
  return <mesh geometry={geo().disc} material={flashDiffuser()} position={position} scale={[radius, radius, 0.22]} />;
}

/** Dark sensor window (depth sensor, ambient light…). */
export function Sensor({ position, radius }: { position: V3; radius: number }) {
  return <mesh geometry={geo().disc} material={blackGloss()} position={position} scale={[radius, radius, 0.2]} />;
}

/** Flat black opening facing +Z (mic, speaker hole, front camera). */
export function Hole({ position, radius, rotation }: { position: V3; radius: number; rotation?: V3 }) {
  return <mesh geometry={geo().hole} material={cavity()} position={position} rotation={rotation} scale={[radius, radius, 1]} />;
}

/** Row of speaker / vent holes along X, facing +Z. */
export function HoleRow({ position, count, pitch, radius, rotation }: { position: V3; count: number; pitch: number; radius: number; rotation?: V3 }) {
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: count }, (_, i) => (
        <Hole key={i} position={[(i - (count - 1) / 2) * pitch, 0, 0]} radius={radius} />
      ))}
    </group>
  );
}
