import { useAssets } from '@/store/assets';
import { loadSamples } from './samples';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';

const isSample = (assetId: string | null) => !!assetId && !!useAssets.getState().assets[assetId]?.name.startsWith('sample-');

/**
 * Swaps the device of an item in one step: own images follow, sample images
 * are replaced by samples that fit the new device, the view is reframed.
 */
export async function switchModel(itemId: string, modelId: string) {
  const before = useProject.getState().items.find((it) => it.id === itemId);
  if (!before || before.modelId === modelId) return;
  const usedSamples = Object.values(before.surfaces).some((b) => isSample(b.assetId));
  useProject.getState().replaceModel(itemId, modelId);
  useUi.getState().setActiveSlot(null);
  useUi.getState().resetView();
  if (usedSamples) await loadSamples(itemId);
}
