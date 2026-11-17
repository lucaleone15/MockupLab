import { importImages } from '@/lib/importImage';
import { navigate } from '@/shell/route';
import { projectReady } from '@/store/ready';

/** From the landing: the captures go on a device (one is added if the scene is empty), then the Studio opens. */
export async function startWithFiles(files: File[]) {
  if (!files.length) return;
  await projectReady;
  await importImages(files);
  navigate('studio');
}

