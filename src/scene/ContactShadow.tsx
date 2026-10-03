import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HorizontalBlurShader, VerticalBlurShader } from 'three-stdlib';

/*
 * Contact shadow: the scene is rendered from below the floor with an
 * orthographic camera, keeping only what lies within `far` cm above it,
 * darker the closer it is; the result is blurred and laid on the floor.
 *
 * Same idea as drei's ContactShadows, which blurs with a plane at the world
 * origin seen through the shadow camera — that silently yields an empty
 * shadow whenever the floor is at or above y = 0. Here the blur passes use
 * their own camera, so the shadow works at any height.
 */

interface Props {
  y: number;
  size: number;
  far: number;
  blur: number;
  opacity: number;
  resolution?: number;
}

export function ContactShadow({ y, size, far, blur, opacity, resolution = 1024 }: Props) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);

  const r = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution);
    const targetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false;
    const depth = new THREE.MeshDepthMaterial();
    depth.depthTest = depth.depthWrite = false;
    // Darkness falls off with the height above the floor.
    depth.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) );',
      );
    };
    const camera = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0, far);
    camera.rotation.x = Math.PI / 2; // look up
    const h = new THREE.ShaderMaterial(HorizontalBlurShader);
    const v = new THREE.ShaderMaterial(VerticalBlurShader);
    h.depthTest = v.depthTest = false;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.frustumCulled = false;
    return { target, targetBlur, depth, camera, h, v, quad, quadCamera };
  }, [resolution, size, far]);

  useEffect(
    () => () => {
      r.target.dispose();
      r.targetBlur.dispose();
      r.depth.dispose();
      r.h.dispose();
      r.v.dispose();
      r.quad.geometry.dispose();
    },
    [r],
  );

  const blurPass = (amount: number) => {
    r.quad.material = r.h;
    r.h.uniforms.tDiffuse.value = r.target.texture;
    r.h.uniforms.h.value = amount / 256;
    gl.setRenderTarget(r.targetBlur);
    gl.render(r.quad, r.quadCamera);
    r.quad.material = r.v;
    r.v.uniforms.tDiffuse.value = r.targetBlur.texture;
    r.v.uniforms.v.value = amount / 256;
    gl.setRenderTarget(r.target);
    gl.render(r.quad, r.quadCamera);
  };

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    r.camera.position.set(0, y - 0.01, 0);
    r.camera.updateMatrixWorld();
    const prevBg = scene.background;
    const prevOverride = scene.overrideMaterial;
    const prevTarget = gl.getRenderTarget();
    const prevAlpha = gl.getClearAlpha();
    g.visible = false;
    scene.background = null;
    scene.overrideMaterial = r.depth;
    gl.setClearAlpha(0);
    gl.setRenderTarget(r.target);
    gl.clear();
    gl.render(scene, r.camera);
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    blurPass(blur);
    blurPass(blur * 0.4);
    gl.setRenderTarget(prevTarget);
    gl.setClearAlpha(prevAlpha);
    g.visible = true;
  });

  return (
    <group ref={group} position={[0, y + 0.003, 0]}>
      {/* The camera looks up: flip so the shadow lines up with the objects. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, -1, 1]} renderOrder={1}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={r.target.texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
