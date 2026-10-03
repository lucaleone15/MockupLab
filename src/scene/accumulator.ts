import * as THREE from 'three';

/*
 * Multi-sample accumulation for depth of field (and extra anti-aliasing).
 *
 * Each sample is rendered normally to the default framebuffer (so tone
 * mapping and per-material colour handling are exactly the live ones), copied
 * into a texture, decoded to linear premultiplied colour and added into a
 * half-float target. The average is encoded back and drawn to the screen.
 */

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const decode = /* glsl */ `
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 linearToSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }`;

export class Accumulator {
  private frame: THREE.FramebufferTexture | null = null;
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly addMat: THREE.ShaderMaterial;
  private readonly resolveMat: THREE.ShaderMaterial;
  count = 0;

  constructor() {
    this.addMat = new THREE.ShaderMaterial({
      uniforms: { tFrame: { value: null } },
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tFrame;
        varying vec2 vUv;
        ${decode}
        void main() {
          vec4 s = texture2D(tFrame, vUv);
          vec3 c = s.a > 0.0 ? srgbToLinear(s.rgb / s.a) * s.a : vec3(0.0);
          gl_FragColor = vec4(c, s.a);
        }`,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    // Additive in both colour and alpha.
    this.addMat.blending = THREE.CustomBlending;
    this.addMat.blendSrc = THREE.OneFactor;
    this.addMat.blendDst = THREE.OneFactor;
    this.addMat.blendSrcAlpha = THREE.OneFactor;
    this.addMat.blendDstAlpha = THREE.OneFactor;

    this.resolveMat = new THREE.ShaderMaterial({
      uniforms: { tAcc: { value: null }, uCount: { value: 1 } },
      vertexShader: quadVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D tAcc;
        uniform float uCount;
        varying vec2 vUv;
        ${decode}
        void main() {
          vec4 s = texture2D(tAcc, vUv) / uCount;
          vec3 c = s.a > 0.0 ? linearToSrgb(s.rgb / s.a) * s.a : vec3(0.0);
          gl_FragColor = vec4(c, s.a);
        }`,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.addMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** Starts a new accumulation for a drawing buffer of the given size. */
  reset(gl: THREE.WebGLRenderer, width: number, height: number) {
    if (!this.frame || this.frame.image.width !== width || this.frame.image.height !== height) {
      this.frame?.dispose();
      this.target?.dispose();
      this.frame = new THREE.FramebufferTexture(width, height);
      this.target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false });
    }
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.setRenderTarget(prev);
    this.count = 0;
  }

  /** Adds what is currently in the default framebuffer. */
  add(gl: THREE.WebGLRenderer) {
    if (!this.frame || !this.target) return;
    gl.copyFramebufferToTexture(this.frame);
    this.addMat.uniforms.tFrame.value = this.frame;
    this.quad.material = this.addMat;
    const prev = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    gl.setRenderTarget(this.target);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(prev);
    gl.autoClear = autoClear;
    this.count++;
  }

  /** Draws the average into the default framebuffer. */
  resolve(gl: THREE.WebGLRenderer) {
    if (!this.target || this.count === 0) return;
    this.resolveMat.uniforms.tAcc.value = this.target.texture;
    this.resolveMat.uniforms.uCount.value = this.count;
    this.quad.material = this.resolveMat;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(null);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(prev);
  }

  dispose() {
    this.frame?.dispose();
    this.target?.dispose();
    this.addMat.dispose();
    this.resolveMat.dispose();
    this.quad.geometry.dispose();
  }
}

/** Vogel (golden-angle) disk: evenly spread lens samples, sample 0 at the centre. */
export function lensSample(i: number, n: number): [number, number] {
  if (i === 0) return [0, 0];
  const r = Math.sqrt((i + 0.5) / n);
  const t = i * 2.399963229728653;
  return [r * Math.cos(t), r * Math.sin(t)];
}

/** Halton sequence for sub-pixel jitter. */
export function halton(i: number, base: number) {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

export interface LensSetup {
  /** World units: lens radius. 0 disables depth of field. */
  radius: number;
  /** Distance from the camera to the plane in focus. */
  focusDistance: number;
}

/**
 * Prepares sample `i` of `n`: moves the camera on the lens and shifts the view
 * window so the focus plane stays still (thin-lens model), plus sub-pixel
 * jitter. `tile` describes the sub-rectangle being rendered (exports render in
 * tiles). Returns a function restoring the camera.
 */
export function applyLensSample(
  camera: THREE.PerspectiveCamera,
  lens: LensSetup,
  i: number,
  n: number,
  full: { width: number; height: number },
  tile: { x: number; y: number; width: number; height: number },
): () => void {
  const [lx, ly] = lensSample(i, n);
  const dx = lx * lens.radius;
  const dy = ly * lens.radius;
  const saved = camera.position.clone();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  camera.position.addScaledVector(right, dx).addScaledVector(up, dy);
  camera.updateMatrixWorld();
  const pxPerUnit = full.height / (2 * lens.focusDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const jx = i === 0 ? 0 : halton(i, 2) - 0.5;
  const jy = i === 0 ? 0 : halton(i, 3) - 0.5;
  camera.setViewOffset(full.width, full.height, tile.x - dx * pxPerUnit + jx, tile.y + dy * pxPerUnit + jy, tile.width, tile.height);
  return () => {
    camera.position.copy(saved);
    camera.updateMatrixWorld();
  };
}
