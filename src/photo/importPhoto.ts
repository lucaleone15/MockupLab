import { IMAGE_OR_PDF, expandPdfs } from '@/lib/pdf';
import { t } from '@/i18n';
import { fileToAsset } from '@/lib/importImage';
import { isSampleAsset, sampleAsset } from '@/lib/samples';
import { useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { startWithPhoto } from './templates';

const ACCEPTED = /^image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml)$/;

/**
 * Images in photo mode: the first image becomes the photo; once there are
 * zones, an image goes into the zone it was dropped on (or the selected one).
 */
export async function importIntoPhoto(input: Iterable<File>, zoneId?: string, asPhoto = false) {
  const files = await expandPdfs(input);
  const images = [...files].filter((f) => ACCEPTED.test(f.type));
  if (!images.length) {
    toast.error(t('image.unsupported', { name: [...files][0]?.name || 'file' }));
    return;
  }
  const file = images[0];
  try {
    const asset = await fileToAsset(file, file.name || 'image');
    useAssets.getState().add(asset);
    const { photo, setZoneSurface } = useProject.getState();
    const target = photo.zones.find((z) => z.id === zoneId) ?? photo.zones.find((z) => z.id === photo.selectedZoneId) ?? photo.zones[0];
    if (asPhoto || !photo.assetId || !target) startWithPhoto(asset.id);
    else setZoneSurface(target.id, { assetId: asset.id, align: 0 });
  } catch {
    toast.error(t('image.failed', { name: file.name || 'image' }));
  }
}

/** File picker for a new photo. */
export function pickPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMAGE_OR_PDF;
  input.onchange = () => input.files && importIntoPhoto(input.files, undefined, true);
  input.click();
}

/** File picker for the design of a zone. */
export function pickZoneImage(zoneId: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMAGE_OR_PDF;
  input.onchange = () => input.files && importIntoPhoto(input.files, zoneId);
  input.click();
}

/** Fills the zones that have no design of their own with fitting samples. */
export async function loadPhotoSamples() {
  for (const z of useProject.getState().photo.zones) {
    if (z.surface.assetId && !isSampleAsset(z.surface.assetId)) continue;
    const name = z.kind === 'print' ? 'sample-poster.png' : z.aspect < 1 ? 'sample-app.png' : 'sample-web.png';
    const assetId = await sampleAsset(name);
    useProject.getState().setZoneSurface(z.id, { assetId, align: z.kind === 'print' ? 0.5 : 0 });
  }
}
