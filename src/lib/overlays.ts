import { loadImage, useAssets } from '@/store/assets';
import type { Brand, Overlay, OverlayFont } from '@/store/project';
import { fontStack, isItalicFamily, registerFontAsset } from './brandFonts';

/*
 * Layers painted over the render: titles, captions, logos, and brand-identity
 * blocks (colour palette, type specimen). The same painter draws the live
 * preview and the export (sizes are fractions of the frame), and returns the
 * boxes it drew so the preview can select and drag them.
 */

export interface OverlayBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const images = new Map<string, HTMLImageElement>();

function familyOf(font: OverlayFont, brand: Brand) {
  if (font === 'heading' || font === 'body') return brand[font].family;
  return font === 'serif' ? 'Instrument Serif' : font === 'mono' ? 'Geist Mono Variable' : 'Geist Variable';
}

function cssFont(font: OverlayFont, weight: number, px: number, brand: Brand) {
  const italic = isItalicFamily(familyOf(font, brand));
  return `${italic ? 'italic ' : ''}${italic ? 400 : weight} ${px}px ${fontStack(font)}`;
}

/** Loads fonts and images used by the overlays (and the brand's own typefaces). */
export async function prepareOverlays(overlays: Overlay[], brand: Brand) {
  const jobs: Promise<unknown>[] = [];
  for (const f of [brand.heading, brand.body]) if (f.assetId) jobs.push(registerFontAsset(f.assetId, f.family).catch(() => undefined));
  await Promise.all(jobs);
  const more: Promise<unknown>[] = [];
  const fonts = new Set<string>();
  for (const o of overlays) {
    if (o.kind === 'text') fonts.add(cssFont(o.font, o.weight, 32, brand));
    if (o.kind === 'type') {
      fonts.add(cssFont('heading', 700, 32, brand));
      fonts.add(cssFont('body', 400, 32, brand));
    }
    if (o.kind === 'palette') fonts.add(cssFont('body', 500, 32, brand));
    const logo = o.kind === 'logo' ? o.assetId : null;
    if (logo && !images.has(logo)) {
      const asset = useAssets.getState().assets[logo];
      if (asset) more.push(loadImage(asset.url).then((img) => images.set(logo, img)));
    }
  }
  for (const f of fonts) more.push(document.fonts.load(f).catch(() => undefined));
  await Promise.all(more);
}

function textBlock(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  font: string,
  size: number,
  x: number,
  y: number,
  align: CanvasTextAlign,
  tracking = 0,
) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${tracking * size}px`;
  const lh = size * 1.12;
  const top = y - ((lines.length - 1) * lh) / 2;
  let maxW = 0;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, top + i * lh);
    maxW = Math.max(maxW, ctx.measureText(line).width);
  });
  ctx.letterSpacing = '0px';
  const left = align === 'left' ? x : align === 'right' ? x - maxW : x - maxW / 2;
  return { x: left, y: top - lh / 2, w: maxW, h: lines.length * lh };
}

export function paintOverlays(ctx: CanvasRenderingContext2D, overlays: Overlay[], w: number, h: number, brand: Brand): OverlayBox[] {
  const boxes: OverlayBox[] = [];
  for (const o of overlays) {
    if (!o.visible) continue;
    const ax = o.x * w;
    const ay = o.y * h;
    if (o.kind === 'text') {
      const size = o.size * h;
      ctx.fillStyle = o.color;
      const b = textBlock(ctx, o.text.split('\n'), cssFont(o.font, o.weight, size, brand), size, ax, ay, o.align, o.tracking);
      boxes.push({ id: o.id, ...b });
    } else if (o.kind === 'logo') {
      const img = o.assetId ? images.get(o.assetId) : undefined;
      if (!img) continue;
      const ih = o.size * h;
      const iw = ih * (img.naturalWidth / img.naturalHeight);
      ctx.globalAlpha = o.opacity;
      ctx.drawImage(img, ax - iw / 2, ay - ih / 2, iw, ih);
      ctx.globalAlpha = 1;
      boxes.push({ id: o.id, x: ax - iw / 2, y: ay - ih / 2, w: iw, h: ih });
    } else if (o.kind === 'palette') {
      // Colour chips with name and hex, in a row or a column, centred on the anchor.
      const chip = o.size * h;
      const gap = chip * 0.28;
      const labelH = o.labels ? chip * 0.62 : 0;
      const n = brand.colors.length;
      const cellW = o.layout === 'row' ? chip + (o.labels ? chip * 0.5 : 0) : chip;
      const cellH = chip + labelH;
      const totalW = o.layout === 'row' ? n * cellW + (n - 1) * gap : cellW + (o.labels ? chip * 2.4 : 0);
      const totalH = o.layout === 'row' ? cellH : n * chip + (n - 1) * gap;
      const x0 = ax - totalW / 2;
      const y0 = ay - totalH / 2;
      brand.colors.forEach((c, i) => {
        const cx = o.layout === 'row' ? x0 + i * (cellW + gap) + cellW / 2 : x0 + chip / 2;
        const cy = o.layout === 'row' ? y0 + chip / 2 : y0 + i * (chip + gap) + chip / 2;
        ctx.fillStyle = c.hex;
        ctx.beginPath();
        if (o.shape === 'circle') ctx.arc(cx, cy, chip / 2, 0, Math.PI * 2);
        else ctx.roundRect(cx - chip / 2, cy - chip / 2, chip, chip, chip * 0.12);
        ctx.fill();
        // hairline so light colours stay visible on light backgrounds
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = Math.max(1, chip * 0.012);
        ctx.stroke();
        if (o.labels) {
          ctx.fillStyle = o.color;
          const fs = chip * 0.2;
          const lx = o.layout === 'row' ? cx : cx + chip * 0.75;
          const align: CanvasTextAlign = o.layout === 'row' ? 'center' : 'left';
          const ly = o.layout === 'row' ? cy + chip / 2 + chip * 0.22 : cy - fs * 0.6;
          textBlock(ctx, [c.name], cssFont('body', 600, fs, brand), fs, lx, ly, align);
          ctx.globalAlpha = 0.65;
          textBlock(ctx, [c.hex.toUpperCase()], cssFont('mono', 400, fs * 0.9, brand), fs * 0.9, lx, ly + fs * 1.15, align);
          ctx.globalAlpha = 1;
        }
      });
      boxes.push({ id: o.id, x: x0, y: y0, w: totalW, h: totalH });
    } else if (o.kind === 'type') {
      // Specimen: big "Aa" in the heading face + face names + alphabet in the body face.
      const s = o.size * h;
      ctx.fillStyle = o.color;
      const aa = textBlock(ctx, ['Aa'], cssFont('heading', 700, s * 2.2, brand), s * 2.2, ax, ay - s * 0.35, 'left', -0.03);
      const tx = ax + aa.w + s * 0.5;
      const label = (f: Brand['heading']) => f.family.replace(/ · [a-z0-9]{4}$/, '').replace(/ Variable$/, '');
      const b1 = textBlock(ctx, [label(brand.heading)], cssFont('heading', 700, s * 0.55, brand), s * 0.55, tx, ay - s * 0.75, 'left');
      ctx.globalAlpha = 0.7;
      const b2 = textBlock(ctx, [label(brand.body)], cssFont('body', 400, s * 0.38, brand), s * 0.38, tx, ay - s * 0.15, 'left');
      ctx.globalAlpha = 1;
      const b3 = textBlock(ctx, ['ABCDEFGHIJKLM', 'abcdefghijklm 0123456789'], cssFont('body', 400, s * 0.3, brand), s * 0.3, ax, ay + s * 1.25, 'left', 0.02);
      const right = Math.max(aa.x + aa.w, b1.x + b1.w, b2.x + b2.w, b3.x + b3.w);
      boxes.push({ id: o.id, x: ax, y: aa.y, w: right - ax, h: b3.y + b3.h - aa.y });
    }
  }
  return boxes;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function newTextOverlay(partial: Partial<Extract<Overlay, { kind: 'text' }>> = {}): Overlay {
  return {
    id: uid(),
    kind: 'text',
    text: 'Titre du projet',
    font: 'heading',
    weight: 700,
    size: 0.058,
    color: '#ffffff',
    align: 'center',
    x: 0.5,
    y: 0.085,
    tracking: -0.02,
    visible: true,
    ...partial,
  };
}

export function newLogoOverlay(assetId: string, partial: Partial<Extract<Overlay, { kind: 'logo' }>> = {}): Overlay {
  return { id: uid(), kind: 'logo', assetId, size: 0.08, x: 0.1, y: 0.1, opacity: 1, visible: true, ...partial };
}

export function newPaletteOverlay(partial: Partial<Extract<Overlay, { kind: 'palette' }>> = {}): Overlay {
  return { id: uid(), kind: 'palette', size: 0.07, x: 0.5, y: 0.88, layout: 'row', shape: 'circle', labels: true, color: '#ffffff', visible: true, ...partial };
}

export function newTypeOverlay(partial: Partial<Extract<Overlay, { kind: 'type' }>> = {}): Overlay {
  return { id: uid(), kind: 'type', size: 0.06, x: 0.06, y: 0.5, color: '#ffffff', visible: true, ...partial };
}
