import type { Brand } from '@/store/project';

/*
 * Brand visuals drawn from the brand kit (pure canvas code, no store access):
 * a "primary" face (logo on the main colour), a "secondary" face (name,
 * tagline and palette on the lightest colour), a logo pattern, and a screen
 * layout.
 */

export type ArtVariant = 'primary' | 'secondary' | 'pattern' | 'screen';

const luminance = (hex: string) => {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/** Lightest / darkest colours of the palette and a readable ink for a background. */
export function paletteRoles(brand: Brand) {
  const sorted = [...brand.colors].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  const dark = sorted[0]?.hex ?? '#111111';
  const light = sorted[sorted.length - 1]?.hex ?? '#ffffff';
  const main = brand.colors[0]?.hex ?? '#ff5c35';
  const accent = brand.colors.find((c) => c.hex !== main && c.hex !== dark && c.hex !== light)?.hex ?? dark;
  const ink = (bg: string) => (luminance(bg) > 0.35 ? dark : light);
  return { main, accent, dark, light, ink };
}

const font = (brand: Brand, role: 'heading' | 'body', weight: number, px: number) =>
  `${brand[role].family === 'Instrument Serif' ? 'italic 400' : weight} ${px}px "${brand[role].family}", "Geist Variable", system-ui, sans-serif`;

function fitText(g: CanvasRenderingContext2D, text: string, fontFor: (px: number) => string, maxW: number, start: number) {
  let px = start;
  g.font = fontFor(px);
  while (px > 8 && g.measureText(text).width > maxW) {
    px *= 0.92;
    g.font = fontFor(px);
  }
  return px;
}

function drawLogo(g: CanvasRenderingContext2D, logo: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) {
  const a = logo.naturalWidth / logo.naturalHeight;
  let w = maxW;
  let h = w / a;
  if (h > maxH) {
    h = maxH;
    w = h * a;
  }
  g.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
}

export function drawBrandArt(g: CanvasRenderingContext2D, W: number, H: number, brand: Brand, logo: HTMLImageElement | null, variant: ArtVariant) {
  const r = paletteRoles(brand);
  const m = Math.min(W, H);
  if (variant === 'primary') {
    g.fillStyle = r.main;
    g.fillRect(0, 0, W, H);
    g.fillStyle = r.ink(r.main);
    if (logo) drawLogo(g, logo, W / 2, H / 2, W * 0.55, H * 0.42);
    else {
      const px = fitText(g, brand.name, (p) => font(brand, 'heading', 800, p), W * 0.8, m * 0.22);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(brand.name, W / 2, H / 2, W * 0.86);
      void px;
    }
    return;
  }
  if (variant === 'pattern') {
    g.fillStyle = r.dark;
    g.fillRect(0, 0, W, H);
    const cell = m / 4;
    for (let y = 0, row = 0; y < H + cell; y += cell, row++) {
      for (let x = (row % 2) * (cell / 2) - cell; x < W + cell; x += cell) {
        if (logo) {
          g.globalAlpha = 0.9;
          drawLogo(g, logo, x, y, cell * 0.55, cell * 0.55);
          g.globalAlpha = 1;
        } else {
          g.fillStyle = brand.colors[(row + Math.round(x / cell)) % brand.colors.length]?.hex ?? r.main;
          g.beginPath();
          g.arc(x, y, cell * 0.26, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    return;
  }
  // secondary & screen: light background, name, tagline, palette
  g.fillStyle = r.light;
  g.fillRect(0, 0, W, H);
  const pad = m * 0.09;
  const ink = r.ink(r.light);
  g.fillStyle = ink;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  if (logo && variant === 'screen') drawLogo(g, logo, pad + m * 0.06, pad + m * 0.06, m * 0.14, m * 0.12);
  const titleY = variant === 'screen' ? H * 0.42 : pad + m * 0.2;
  const px = fitText(g, brand.name, (p) => font(brand, 'heading', 800, p), W - pad * 2, m * (variant === 'screen' ? 0.2 : 0.16));
  g.fillText(brand.name, pad, titleY);
  g.globalAlpha = 0.72;
  const tp = fitText(g, brand.tagline, (p) => font(brand, 'body', 400, p), W - pad * 2, px * 0.32);
  g.fillText(brand.tagline, pad, titleY + tp * 1.7);
  g.globalAlpha = 1;
  if (variant === 'screen') {
    // call-to-action pill in the main colour
    const bw = m * 0.34;
    const bh = m * 0.085;
    g.fillStyle = r.main;
    g.beginPath();
    g.roundRect(pad, titleY + tp * 3.2, bw, bh, bh / 2);
    g.fill();
  }
  // palette strip
  const n = brand.colors.length;
  const chip = Math.min((W - pad * 2) / (n * 1.35), m * 0.12);
  brand.colors.forEach((c, i) => {
    g.fillStyle = c.hex;
    g.beginPath();
    g.arc(pad + chip / 2 + i * chip * 1.35, H - pad - chip / 2, chip / 2, 0, Math.PI * 2);
    g.fill();
  });
  if (logo && variant === 'secondary') drawLogo(g, logo, W - pad - m * 0.07, H - pad - chip / 2, m * 0.16, chip * 1.2);
}

