import * as THREE from 'three';

/**
 * Offline renderer for exports.
 *
 * The frame is rendered at `supersample`× the output size, in tiles (via
 * camera.setViewOffset) so the final size is not bound by the GPU's maximum
 * drawing buffer. Each tile is rendered with a padding band that is discarded,
 * so the downscale filter never sees tile borders (no seams). Rendering goes
 * to the default framebuffer so tone mapping and colour management are
 * identical to the live preview.
 */

export interface RenderRequest {
  width: number;
  height: number;
  supersample: number;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  tiles: number;
}

interface Bridge {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  restore: () => void;
}

let bridge: Bridge | null = null;

export function setExportBridge(b: Bridge | null) {
  bridge = b;
}

export function hasRenderer() {
  return bridge !== null;
}

export function renderLimits() {
  if (!bridge) return { tile: 2048 };
  const ctx = bridge.gl.getContext();
  const maxRb = ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) as number;
  const maxVp = ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as Int32Array;
  return { tile: Math.min(2048, maxRb, maxVp[0], maxVp[1]) };
}

export function renderFrame({ width, height, supersample }: RenderRequest): RenderResult {
  if (!bridge) throw new Error('renderer not ready');
  const { gl, scene } = bridge;
  const source = bridge.camera as THREE.PerspectiveCamera;

  const rw = Math.round(width * supersample);
  const rh = Math.round(height * supersample);
  const { tile } = renderLimits();
  const pad = 16;
  // Inner step is a multiple of the supersample factor so tiles map to whole output pixels.
  const step = Math.floor((tile - pad * 2) / supersample) * supersample;

  const camera = source.clone();
  camera.aspect = rw / rh;
  camera.updateProjectionMatrix();

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const prevClearAlpha = gl.getClearAlpha();
  const prevClear = gl.getClearColor(new THREE.Color());
  gl.setPixelRatio(1);
  gl.setSize(tile, tile, false);
  gl.setClearColor(0x000000, 0);

  let tiles = 0;
  try {
    for (let y = 0; y < rh; y += step) {
      for (let x = 0; x < rw; x += step) {
        const iw = Math.min(step, rw - x);
        const ih = Math.min(step, rh - y);
        camera.setViewOffset(rw, rh, x - pad, y - pad, tile, tile);
        gl.clear();
        gl.render(scene, camera);
        ctx.drawImage(gl.domElement, pad, pad, iw, ih, x / supersample, y / supersample, iw / supersample, ih / supersample);
        tiles++;
      }
    }
  } finally {
    camera.clearViewOffset();
    gl.setClearColor(prevClear, prevClearAlpha);
    bridge.restore();
  }
  return { canvas: out, tiles };
}
