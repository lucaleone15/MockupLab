import { Environment, Lightformer } from '@react-three/drei';

/**
 * Procedural studio HDRI: emissive "softboxes" rendered once into a cube map.
 * No HDR file is downloaded. Layout follows a classic product setup —
 * large overhead softbox, two tall strip lights for edge highlights,
 * a broad frontal fill, a back rim and a warm floor bounce.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#1a1a1e']} />
      {/* overhead softbox */}
      <Lightformer form="rect" intensity={2.6} position={[0, 10, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[18, 10, 1]} />
      {/* key strip, left */}
      <Lightformer form="rect" intensity={3.4} position={[-9, 2, 4]} rotation={[0, Math.PI / 2.4, 0]} scale={[4, 20, 1]} />
      {/* fill strip, right */}
      <Lightformer form="rect" intensity={2.2} position={[9, 2, 3]} rotation={[0, -Math.PI / 2.4, 0]} scale={[4, 20, 1]} />
      {/* broad, dim frontal fill so metals never go black */}
      <Lightformer form="rect" intensity={0.55} position={[0, 2, 10]} rotation={[0, Math.PI, 0]} scale={[26, 14, 1]} />
      {/* back rim */}
      <Lightformer form="rect" intensity={1.4} position={[0, 3, -10]} scale={[20, 5, 1]} />
      {/* small round accent for crisp specular dots */}
      <Lightformer form="circle" intensity={5} position={[6, 7, 9]} scale={1.4} target={[0, 0, 0]} />
      {/* floor bounce */}
      <Lightformer form="rect" intensity={0.5} color="#e2dccf" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
    </Environment>
  );
}
