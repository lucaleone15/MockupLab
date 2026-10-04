import { useAssets } from '@/store/assets';

/** Registers an imported font file (kept as an asset) with the document, once. */
const registered = new Set<string>();

export async function registerFontAsset(assetId: string, family: string) {
  if (registered.has(assetId)) return;
  const asset = useAssets.getState().assets[assetId];
  if (!asset) return;
  const face = new FontFace(family, await asset.blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  registered.add(assetId);
}
