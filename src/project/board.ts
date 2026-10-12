import type { Brand } from '@/store/project';

/*
 * The presentation board: one large image (3:2) with the hero, up to three
 * mock-ups, the project name in Syne, the logo and the brand palette.
 */

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image'));
    img.src = src;
  });
}

/** Draws `img` to fill the box (cropped, centred) with rounded corners. */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k;
  const sh = h / k;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

export async function composeBoard(o: { hero: string; shots: string[]; name: string; brand: Brand; logo?: string; width: number }) {
  const W = o.width;
  const H = Math.round((W * 2) / 3);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const m = W * 0.04;
  const gap = W * 0.016;
  const radius = W * 0.012;
  const bg = '#f4f4f6';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // header: project name (Syne) and logo
  const titleSize = W * 0.034;
  await document.fonts.load(`700 ${titleSize}px "Syne Variable"`).catch(() => undefined);
  ctx.fillStyle = '#1d1d1f';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${titleSize}px "Syne Variable", system-ui, sans-serif`;
  const title = o.name || o.brand.name || 'MockupLab';
  ctx.fillText(title, m, m + titleSize);
  if (o.brand.tagline) {
    ctx.fillStyle = '#6e6e73';
    ctx.font = `500 ${W * 0.013}px "Geist Variable", system-ui, sans-serif`;
    ctx.fillText(o.brand.tagline, m, m + titleSize + W * 0.024);
  }
  const headerH = titleSize + W * 0.045;
  if (o.logo) {
    const logo = await loadImage(o.logo).catch(() => null);
    if (logo) {
      const lh = titleSize * 1.3;
      const lw = (logo.width / logo.height) * lh;
      ctx.drawImage(logo, W - m - lw, m, lw, lh);
    }
  }

  // footer: palette
  const footH = W * 0.04;
  const colors = o.brand.colors.slice(0, 6);
  const dot = footH * 0.7;
  colors.forEach((c, i) => {
    const x = m + i * (dot * 3.4);
    const y = H - m - dot;
    ctx.fillStyle = c.hex;
    ctx.beginPath();
    ctx.roundRect(x, y, dot, dot, dot / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.stroke();
    ctx.fillStyle = '#6e6e73';
    ctx.font = `500 ${W * 0.0085}px "Geist Mono Variable", ui-monospace, monospace`;
    ctx.fillText(c.hex.toUpperCase(), x + dot + W * 0.005, y + dot * 0.68);
  });

  // images: hero on the left, up to three shots on the right
  const top = m + headerH;
  const bottom = H - m - footH - gap;
  const areaH = bottom - top;
  const shots = o.shots.slice(0, 3);
  const heroW = shots.length ? (W - 2 * m) * 0.64 : W - 2 * m;
  const hero = await loadImage(o.hero);
  cover(ctx, hero, m, top, heroW, areaH, radius);
  if (shots.length) {
    const x = m + heroW + gap;
    const w = W - m - x;
    const h = (areaH - gap * (shots.length - 1)) / shots.length;
    for (const [i, src] of shots.entries()) {
      const img = await loadImage(src).catch(() => null);
      if (img) cover(ctx, img, x, top + i * (h + gap), w, h, radius);
    }
  }
  // accent: first brand colour as a thin rule under the title
  if (colors[0]) {
    ctx.fillStyle = colors[0].hex;
    ctx.fillRect(m, m + headerH - W * 0.012, W * 0.05, W * 0.003);
  }
  return canvas;
}
