import { loadImage, useAssets } from '@/store/assets';
import type { Overlay, OverlayFont } from '@/store/project';

/*
 * Titles, captions and logos painted over the render. The same painter draws
 * the live preview and the export (sizes are fractions of the frame), and
 * returns the boxes it drew so the preview can select and drag them.
 */

export const FONT_FAMILIES: Record<OverlayFont, string> = {
  sans: '"Geist Variable", system-ui, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: '"Geist Mono Variable", ui-monospace, monospace',
};

export interface OverlayBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const images = new Map<string, HTMLImageElement>();

/** Loads fonts and logo images used by the overlays. */
export async function prepareOverlays(overlays: Overlay[]) {
  const jobs: Promise<unknown>[] = [];
  for (const o of overlays) {
    if (o.kind === 'text') {
      const style = o.font === 'serif' ? 'italic ' : '';
      jobs.push(document.fonts.load(`${style}${o.font === 'serif' ? 400 : o.weight} 32px ${FONT_FAMILIES[o.font]}`).catch(() => undefined));
    } else if (o.assetId && !images.has(o.assetId)) {
      const asset = useAssets.getState().assets[o.assetId];
      if (asset) jobs.push(loadImage(asset.url).then((img) => images.set(o.assetId!, img)));
    }
  }
  await Promise.all(jobs);
}

export function paintOverlays(ctx: CanvasRenderingContext2D, overlays: Overlay[], w: number, h: number): OverlayBox[] {
  const boxes: OverlayBox[] = [];
  for (const o of overlays) {
    if (!o.visible) continue;
    const ax = o.x * w;
    const ay = o.y * h;
    if (o.kind === 'text') {
      const size = o.size * h;
      // Instrument Serif ships in italic only: it is used as an editorial accent.
      ctx.font = `${o.font === 'serif' ? 'italic 400' : o.weight} ${size}px ${FONT_FAMILIES[o.font]}`;
      ctx.fillStyle = o.color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = o.align;
      ctx.letterSpacing = `${o.tracking * size}px`;
      const lines = o.text.split('\n');
      const lh = size * 1.12;
      const top = ay - ((lines.length - 1) * lh) / 2;
      let maxW = 0;
      lines.forEach((line, i) => {
        ctx.fillText(line, ax, top + i * lh);
        maxW = Math.max(maxW, ctx.measureText(line).width);
      });
      ctx.letterSpacing = '0px';
      const left = o.align === 'left' ? ax : o.align === 'right' ? ax - maxW : ax - maxW / 2;
      boxes.push({ id: o.id, x: left, y: top - lh / 2, w: maxW, h: lines.length * lh });
    } else {
      const img = o.assetId ? images.get(o.assetId) : undefined;
      if (!img) continue;
      const ih = o.size * h;
      const iw = ih * (img.naturalWidth / img.naturalHeight);
      ctx.globalAlpha = o.opacity;
      ctx.drawImage(img, ax - iw / 2, ay - ih / 2, iw, ih);
      ctx.globalAlpha = 1;
      boxes.push({ id: o.id, x: ax - iw / 2, y: ay - ih / 2, w: iw, h: ih });
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
    font: 'sans',
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

export function newLogoOverlay(assetId: string): Overlay {
  return { id: uid(), kind: 'logo', assetId, size: 0.08, x: 0.1, y: 0.1, opacity: 1, visible: true };
}
