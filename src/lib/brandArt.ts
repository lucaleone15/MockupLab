import { getModel } from '@/models/registry';
import { drawBrandArt, type ArtVariant } from './brandDraw';
export { paletteRoles } from './brandDraw';
import { loadImage, useAssets } from '@/store/assets';
import { useProject, type Brand } from '@/store/project';
import { fileToAsset } from './importImage';
import { prepareOverlays } from './overlays';

/*
 * Brand visuals generated from the brand kit, for every printable face or
 * screen: a "primary" face (logo on the main colour), a "secondary" face
 * (name, tagline and palette on the lightest colour), a pattern made of the
 * logo, and a screen layout. Drawn on a canvas, saved as regular assets.
 */

const font = (brand: Brand, role: 'heading' | 'body', weight: number, px: number) =>
  `${brand[role].family === 'Instrument Serif' ? 'italic 400' : weight} ${px}px "${brand[role].family}", "Geist Variable", system-ui, sans-serif`;

async function brandFontsReady(brand: Brand) {
  await prepareOverlays([], brand);
  await Promise.all([document.fonts.load(font(brand, 'heading', 800, 40)), document.fonts.load(font(brand, 'body', 400, 40))]).catch(() => undefined);
}

async function logoImage(brand: Brand) {
  const asset = brand.logoAssetId ? useAssets.getState().assets[brand.logoAssetId] : undefined;
  return asset ? loadImage(asset.url) : null;
}

/** Renders brand art at the given aspect and stores it as an asset. */
export async function brandArtAsset(aspect: number, variant: ArtVariant) {
  const brand = useProject.getState().brand;
  await brandFontsReady(brand);
  const logo = await logoImage(brand);
  const long = 2200;
  const W = Math.round(aspect >= 1 ? long : long * aspect);
  const H = Math.round(aspect >= 1 ? long / aspect : long);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBrandArt(c.getContext('2d')!, W, H, brand, logo, variant);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
  const asset = await fileToAsset(blob, `${brand.name || 'brand'}-${variant}.png`);
  useAssets.getState().add(asset);
  return asset.id;
}

const VARIANTS: ArtVariant[] = ['primary', 'secondary', 'pattern'];

/** Fills the faces of the given devices (or the selected one) with generated brand visuals. */
export async function applyBrandArt(itemIds?: string[]) {
  const state = useProject.getState();
  const ids = itemIds ?? [state.selectedId ?? state.items[0]?.id].filter(Boolean) as string[];
  for (const id of ids) {
    const item = useProject.getState().items.find((it) => it.id === id);
    if (!item) continue;
    const model = getModel(item.modelId);
    const print = model.surfaceKind === 'print';
    const landscape = item.params.orientation === 'landscape' || item.params.format === 'landscape';
    for (const [i, slot] of model.surfaces.entries()) {
      const aspect = model.anchor !== 'bottom' && landscape ? 1 / slot.aspect : slot.aspect;
      const variant: ArtVariant = print ? VARIANTS[i % VARIANTS.length] : 'screen';
      const assetId = await brandArtAsset(aspect, variant);
      useProject.getState().setSurface(id, slot.id, { assetId, fit: 'cover', align: 0.5 });
    }
  }
}
