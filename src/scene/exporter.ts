import * as THREE from 'three';
import { Accumulator, applyLensSample, type LensSetup } from './accumulator';

/**
 * Offline renderer for exports.
 *
 * The frame is rendered at `supersample`× the output size, in tiles (via
 * camera.setViewOffset) so the final size is not bound by the GPU's maximum
 * drawing buffer. Each tile is rendered with a padding band that is discarded,
 * so the downscale filter never sees tile borders (no seams). Rendering goes
 * to the default framebuffer so tone mapping and colour management are
 * identical to the live preview. With depth of field, every tile accumulates
 * lens samples (thin-lens model) before being copied out.
 */

export interface RenderRequest {
  width: number;
  height: number;
  supersample: number;
  /** Lens samples per tile (1 = no depth of field). */
  samples?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  tiles: number;
}

interface Bridge {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  lens: () => LensSetup;
  restore: () => void;
}

let bridge: Bridge | null = null;

export function setExportBridge(b: Bridge | null) {
  bridge = b;
}

/** Dev only: renderer internals for debugging scripts. */
export const debugBridge = () => bridge;

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

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function renderFrame({ width, height, supersample, samples = 1, onProgress }: RenderRequest): Promise<RenderResult> {
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
  // Only the scene: helpers (selection ring…) live on layer 1.
  camera.layers.set(0);
  camera.aspect = rw / rh;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const lens = bridge.lens();
  const accumulate = samples > 1 && lens.radius > 0;
  const accumulator = accumulate ? new Accumulator() : null;

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

  const cols = Math.ceil(rw / step);
  const rows = Math.ceil(rh / step);
  const total = cols * rows;
  let tiles = 0;
  try {
    for (let y = 0; y < rh; y += step) {
      for (let x = 0; x < rw; x += step) {
        const iw = Math.min(step, rw - x);
        const ih = Math.min(step, rh - y);
        const rect = { x: x - pad, y: y - pad, width: tile, height: tile };
        if (accumulator) {
          accumulator.reset(gl, tile, tile);
          for (let i = 0; i < samples; i++) {
            const restore = applyLensSample(camera, lens, i, samples, { width: rw, height: rh }, rect);
            gl.setRenderTarget(null);
            gl.clear();
            gl.render(scene, camera);
            accumulator.add(gl);
            restore();
          }
          accumulator.resolve(gl);
        } else {
          camera.setViewOffset(rw, rh, rect.x, rect.y, rect.width, rect.height);
          gl.clear();
          gl.render(scene, camera);
        }
        ctx.drawImage(gl.domElement, pad, pad, iw, ih, x / supersample, y / supersample, iw / supersample, ih / supersample);
        tiles++;
        onProgress?.(tiles, total);
        // Long renders yield so the progress UI can update.
        if (accumulator) await nextFrame();
      }
    }
  } finally {
    camera.clearViewOffset();
    accumulator?.dispose();
    gl.setClearColor(prevClear, prevClearAlpha);
    bridge.restore();
  }
  return { canvas: out, tiles };
}
