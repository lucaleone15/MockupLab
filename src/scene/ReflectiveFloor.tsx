import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraState } from './camera';

/*
 * Planar reflection with a physically motivated fade.
 *
 * Before the floor is drawn, the scene is rendered from the mirrored camera
 * into a render target (colour + depth), with an oblique near plane clipping
 * everything below the floor. The floor shader reads the reflected colour
 * and fades it with the distance between the floor and the reflected surface
 * along the view ray, so the base of an object reflects strongly and its top
 * fades out, like on polished stone. Transparent where nothing is reflected,
 * so it sits on any background.
 */

const vert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 textureMatrix;
varying vec4 vUvProj;
varying float vViewZ;
varying vec3 vWorld;
void main() {
  vUvProj = textureMatrix * vec4(position, 1.0);
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

const frag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uStrength;
uniform float uFalloff;
uniform float uLogFar;
uniform float uBlur;
uniform float uLogDepth;
uniform float uNear;
uniform float uFar;
varying vec4 vUvProj;
varying float vViewZ;
varying vec3 vWorld;
void main() {
  #include <logdepthbuf_fragment>
  vec2 uv = vUvProj.xy / vUvProj.w;
  float d = texture2D(tDepth, uv).x;
  if (d >= 0.99999) discard;
  // view-space distance of the reflected surface (log or standard depth buffer)
  float w = uLogDepth > 0.5
    ? exp2(d * uLogFar) - 1.0
    : (uNear * uFar) / (uFar - d * (uFar - uNear));
  // Depth difference along the view axis → height of the reflected point above the floor.
  vec3 toCam = cameraPosition - vWorld;
  float sinA = abs(toCam.y) / length(toCam);
  float pathScale = length(toCam) / max(vViewZ, 1e-3);
  float height = max(w - vViewZ, 0.0) * pathScale * sinA;
  float fade = exp(-height * uFalloff);
  vec4 c = texture2D(tColor, uv, uBlur * clamp(height * 0.35, 0.0, 3.0));
  float a = c.a * fade * uStrength;
  if (a < 0.002) discard;
  gl_FragColor = vec4(c.rgb / max(c.a, 1e-4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function ReflectiveFloor({ geometry, y, strength }: { geometry: THREE.BufferGeometry; y: number; strength: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  const { target, material, mirror } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(512, 512, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(512, 512),
    });
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        textureMatrix: { value: new THREE.Matrix4() },
        uStrength: { value: 0.4 },
        uFalloff: { value: 0.32 },
        uLogFar: { value: 1 },
        uLogDepth: { value: 1 },
        uNear: { value: 1 },
        uFar: { value: 1000 },
        uBlur: { value: 1 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    return { target, material, mirror: new THREE.PerspectiveCamera() };
  }, []);

  useEffect(() => {
    material.uniforms.uStrength.value = strength;
    invalidate();
  }, [strength, material, invalidate]);
  useEffect(
    () => () => {
      target.dispose();
      target.depthTexture?.dispose();
      material.dispose();
    },
    [target, material],
  );

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const normal = new THREE.Vector3();
    const reflectorPos = new THREE.Vector3();
    const cameraPos = new THREE.Vector3();
    const rotation = new THREE.Matrix4();
    const lookAt = new THREE.Vector3();
    const view = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    const plane = new THREE.Plane();
    const clip = new THREE.Vector4();
    const q = new THREE.Vector4();
    const size = new THREE.Vector2();
    const full = new THREE.PerspectiveCamera();

    m.onBeforeRender = (renderer, scene, camera) => {
      // Exports render in tiles (sub-window projections). The reflection is
      // always computed for the full frame so every tile samples the same,
      // seamless reflection; lens-shifted windows of the same size are kept.
      let cam = camera as THREE.PerspectiveCamera;
      const v = cam.view;
      let fullW = 0;
      let fullH = 0;
      if (v?.enabled && (v.width !== v.fullWidth || v.height !== v.fullHeight)) {
        full.copy(cam, false);
        full.matrixWorld.copy(cam.matrixWorld);
        full.matrixWorldInverse.copy(cam.matrixWorldInverse);
        full.clearViewOffset();
        if (Math.abs(cameraState.shift) > 1e-4) full.setViewOffset(v.fullWidth, v.fullHeight, -cameraState.shift * v.fullWidth, 0, v.fullWidth, v.fullHeight);
        cam = full;
        fullW = v.fullWidth;
        fullH = v.fullHeight;
      }
      reflectorPos.setFromMatrixPosition(m.matrixWorld);
      cameraPos.setFromMatrixPosition(cam.matrixWorld);
      rotation.extractRotation(m.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rotation);
      view.subVectors(reflectorPos, cameraPos);
      if (view.dot(normal) > 0) return; // camera below the floor
      view.reflect(normal).negate().add(reflectorPos);
      rotation.extractRotation(cam.matrixWorld);
      lookAt.set(0, 0, -1).applyMatrix4(rotation).add(cameraPos);
      tgt.subVectors(reflectorPos, lookAt).reflect(normal).negate().add(reflectorPos);
      mirror.position.copy(view);
      mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
      mirror.lookAt(tgt);
      mirror.near = cam.near;
      mirror.far = cam.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(cam.projectionMatrix);

      const tm = material.uniforms.textureMatrix.value as THREE.Matrix4;
      tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      tm.multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse).multiply(m.matrixWorld);

      // Oblique near plane = the floor (Lengyel), so nothing below it is reflected.
      plane.setFromNormalAndCoplanarPoint(normal, reflectorPos).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const e = mirror.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + e[8]) / e[0];
      q.y = (Math.sign(clip.y) + e[9]) / e[5];
      q.z = -1;
      q.w = (1 + e[10]) / e[14];
      clip.multiplyScalar(2 / clip.dot(q));
      e[2] = clip.x;
      e[6] = clip.y;
      e[10] = clip.z + 1;
      e[14] = clip.w;

      renderer.getDrawingBufferSize(size);
      const k = fullW ? Math.min(1, 2048 / Math.max(fullW, fullH)) : 0.5;
      const w = Math.max(64, Math.round((fullW || size.x) * k));
      const h = Math.max(64, Math.round((fullH || size.y) * k));
      if (target.width !== w || target.height !== h) target.setSize(w, h);

      const logDepth = renderer.capabilities.logarithmicDepthBuffer;
      material.uniforms.uLogDepth.value = logDepth ? 1 : 0;
      material.uniforms.uLogFar.value = Math.log2(cam.far + 1);
      material.uniforms.uNear.value = cam.near;
      material.uniforms.uFar.value = cam.far;

      const prevTarget = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      const prevShadowAuto = renderer.shadowMap.autoUpdate;
      m.visible = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.state.buffers.depth.setMask(true); // the depth buffer must be writable to be cleared
      renderer.setClearAlpha(0);
      renderer.clear();
      renderer.render(scene, mirror);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearAlpha(prevAlpha);
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      m.visible = true;
    };
    return () => {
      m.onBeforeRender = () => {};
    };
  }, [material, mirror, target]);

  return <mesh ref={mesh} geometry={geometry} material={material} position={[0, y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />;
}
