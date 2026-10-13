import * as THREE from 'three';

let aoTex: THREE.Texture | null = null;
/** Soft dark rounded-rect falloff: the ambient shadow an object casts on a wall right behind it. */
function wallShadowTexture() {
  if (aoTex) return aoTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // alpha map: white = shadow
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(18px)';
  g.fillStyle = '#fff';
  g.fillRect(44, 44, 168, 168);
  aoTex = new THREE.CanvasTexture(c);
  return aoTex;
}

export function WallShadow({ w, h, z }: { w: number; h: number; z: number }) {
  return (
    <mesh position={[0.8, -2.2, z]} renderOrder={1}>
      <planeGeometry args={[w * 1.22 + 10, h * 1.22 + 10]} />
      <meshBasicMaterial color="#000" transparent opacity={0.5} depthWrite={false} alphaMap={wallShadowTexture()} />
    </mesh>
  );
}

