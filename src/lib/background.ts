import { loadImage, useAssets } from '@/store/assets';
import type { Background } from '@/store/project';
import { drawPattern } from './patterns';

/**
 * Paints a background on a 2D canvas. The same function draws the live
 * preview (behind the transparent WebGL canvas) and the exported image, so
 * what you see is exactly what you export. Sizes are expressed relative to
 * the canvas so a 4K export matches the preview.
 */

const images = new Map<string, HTMLImageElement>();

/** Loads what the background needs (image backgrounds). Resolves when it can be painted. */
export async function prepareBackground(bg: Background) {
  if (bg.kind !== 'image' || !bg.assetId || images.has(bg.assetId)) return;
  const asset = useAssets.getState().assets[bg.assetId];
  if (!asset) return;
  images.set(bg.assetId, await loadImage(asset.url));
}

export function paintBackground(ctx: CanvasRenderingContext2D, bg: Background, w: number, h: number, opts: { checker?: number } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  switch (bg.kind) {
    case 'transparent':
      if (opts.checker) paintChecker(ctx, w, h, opts.checker);
      break;
    case 'solid':
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'gradient': {
      let grad: CanvasGradient;
      const a = (bg.angle * Math.PI) / 180;
      if (bg.type === 'linear') {
        // CSS convention: 0° points up, 90° points right.
        const dx = Math.sin(a);
        const dy = -Math.cos(a);
        const half = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy);
        grad = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
      } else if (bg.type === 'radial') {
        grad = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.hypot(w, h) * 0.62);
      } else {
        grad = ctx.createConicGradient(a - Math.PI / 2, w / 2, h / 2);
      }
      for (const s of [...bg.stops].sort((x, y) => x.at - y.at)) grad.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'pattern':
      drawPattern(ctx, bg, Math.round(w), Math.round(h));
      break;
    case 'image': {
      const img = bg.assetId ? images.get(bg.assetId) : undefined;
      ctx.fillStyle = '#16161a';
      ctx.fillRect(0, 0, w, h);
      if (!img) break;
      // cover, slightly enlarged when blurred so edges never show
      const blur = bg.blur * h * 0.03;
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (1 + bg.blur * 0.08);
      const iw = img.naturalWidth * k;
      const ih = img.naturalHeight * k;
      if (blur > 0.5) ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      ctx.filter = 'none';
      if (bg.dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${bg.dim * 0.85})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
  }
  ctx.restore();
}

/** ±1 LSB triangular noise: removes 8-bit banding from smooth gradients in exports. */
export function dither(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = Math.random() - Math.random();
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function paintChecker(ctx: CanvasRenderingContext2D, w: number, h: number, size: number) {
  const dark = document.documentElement.dataset.theme !== 'light';
  ctx.fillStyle = dark ? '#1b1b1f' : '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dark ? '#232328' : '#ececef';
  for (let y = 0; y < h; y += size) {
    for (let x = (y / size) % 2 ? size : 0; x < w; x += size * 2) ctx.fillRect(x, y, size, size);
  }
}

/** CSS approximation of a background, for small UI swatches. */
export function backgroundCss(b: Background): string {
  switch (b.kind) {
    case 'solid':
      return b.color;
    case 'gradient': {
      const stops = [...b.stops].sort((x, y) => x.at - y.at).map((s) => `${s.color} ${s.at * 100}%`).join(',');
      if (b.type === 'linear') return `linear-gradient(${b.angle}deg, ${stops})`;
      if (b.type === 'radial') return `radial-gradient(circle at 50% 42%, ${stops})`;
      return `conic-gradient(from ${b.angle}deg, ${stops})`;
    }
    case 'pattern':
      return `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]} 60%, ${b.colors[2]})`;
    case 'image':
      return '#2a2a2e';
    case 'transparent':
      return 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 10px 10px';
  }
}
