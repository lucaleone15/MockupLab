import { importImages } from '@/lib/importImage';
import { navigate } from '@/shell/route';
import { useProject } from '@/store/project';

/** From the landing: the captures go on a device (one is added if the scene is empty), then the Studio opens. */
export async function startWithFiles(files: File[]) {
  if (!files.length) return;
  await importImages(files);
  navigate('studio');
}

/** From the landing: the Studio opens on a ready-made scene with the sample designs. */
export async function startWithExample() {
  const project = useProject.getState();
  if (!project.items.length) project.addItem('laptop-14');
  const { loadSamples } = await import('@/lib/samples');
  for (const it of useProject.getState().items) await loadSamples(it.id);
  navigate('studio');
}
