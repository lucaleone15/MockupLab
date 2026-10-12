import { IMAGE_OR_PDF, expandPdfs } from './pdf';
import { t } from '@/i18n';
import { getMaxTextureSize, useAssets, type Asset } from '@/store/assets';
import { selectSelectedItem, useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { importIntoPhoto } from '@/photo/importPhoto';

const ACCEPTED = /^image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml)$/;

const uid = () => Math.random().toString(36).slice(2, 10);

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

/** Decodes a file into an asset, downscaling it when it exceeds the GPU texture limit. */
export async function fileToAsset(file: Blob, name: string): Promise<Asset> {
  let url = URL.createObjectURL(file);
  let blob = file;
  const img = await decode(url);
  let width = img.naturalWidth || 1024;
  let height = img.naturalHeight || 1024;
  const limit = Math.min(getMaxTextureSize(), 8192);
  if (width > limit || height > limit) {
    const k = limit / Math.max(width, height);
    width = Math.round(width * k);
    height = Math.round(height * k);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png'));
    URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    toast.info(t('image.downscaled', { w: width, h: height }));
  }
  return { id: uid(), name, url, width, height, blob };
}

/** Imports images (drop, paste, picker) and binds the first one to a device screen (the selected one by default). */
export async function importImages(files: Iterable<File>, targetItemId?: string) {
  const list = await expandPdfs(files);
  // photo mode: the photo itself, or the design of a zone (targetItemId is then a zone id)
  if (useProject.getState().mode === 'photo') return importIntoPhoto(list, targetItemId);
  const images = list.filter((f) => ACCEPTED.test(f.type));
  for (const f of list) if (!ACCEPTED.test(f.type)) toast.error(t('image.unsupported', { name: f.name || 'file' }));
  if (!images.length) return;
  if (images.length > 1) toast.info(t('image.multiple'));

  const file = images[0];
  try {
    const asset = await fileToAsset(file, file.name || 'image');
    useAssets.getState().add(asset);
    const state = useProject.getState();
    const item = (targetItemId && state.items.find((it) => it.id === targetItemId)) || selectSelectedItem(state);
    if (item) {
      // The slot chosen in the panel, else the first one without an image, else the first.
      const slots = Object.keys(item.surfaces);
      const active = useUi.getState().activeSlot;
      const slot =
        (!targetItemId || targetItemId === state.selectedId) && active && slots.includes(active)
          ? active
          : (slots.find((k) => !item.surfaces[k].assetId) ?? slots[0] ?? 'screen');
      state.setSurface(item.id, slot, { assetId: asset.id, align: 0 });
      if (state.selectedId !== item.id) state.selectItem(item.id);
    }
  } catch {
    toast.error(t('image.failed', { name: file.name || 'image' }));
  }
}

/** Imports one image file as an asset (not bound to any surface). */
export async function importAsset(file: File): Promise<Asset | null> {
  if (!ACCEPTED.test(file.type)) {
    toast.error(t('image.unsupported', { name: file.name || 'file' }));
    return null;
  }
  try {
    const asset = await fileToAsset(file, file.name || 'image');
    useAssets.getState().add(asset);
    return asset;
  } catch {
    toast.error(t('image.failed', { name: file.name || 'image' }));
    return null;
  }
}

/** Opens the file picker for a single image. */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function importFromUrl(url: string, name: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  await importImages([new File([blob], name, { type: blob.type || 'image/png' })]);
}

export function pickImages(onFiles: (files: FileList) => void = (f) => void importImages(f)) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMAGE_OR_PDF;
  input.multiple = true;
  input.onchange = () => input.files && onFiles(input.files);
  input.click();
}
