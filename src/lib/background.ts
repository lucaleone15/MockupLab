import type { Background } from '@/store/project';

/**
 * Paints a background on a 2D canvas. The same function draws the live
 * preview (behind the transparent WebGL canvas) and the exported image, so
 * what you see is exactly what you export.
 */
export function paintBackground(ctx: CanvasRenderingContext2D, bg: Background, w: number, h: number, opts: { checker?: number } = {}) {
  ctx.clearRect(0, 0, w, h);
  if (bg.kind === 'transparent') {
    if (opts.checker) paintChecker(ctx, w, h, opts.checker);
    return;
  }
  if (bg.kind === 'solid') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  let grad: CanvasGradient;
  if (bg.type === 'linear') {
    // CSS convention: 0° points up, 90° points right.
    const a = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy);
    grad = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
  } else {
    const cx = w / 2;
    const cy = h * 0.42;
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.62);
  }
  for (const s of bg.stops) grad.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
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

export function backgroundIsTransparent(bg: Background) {
  return bg.kind === 'transparent';
}
