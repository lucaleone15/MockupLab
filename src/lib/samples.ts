import { getModel } from '@/models/registry';
import { useProject } from '@/store/project';
import { fileToAsset } from './importImage';
import { useAssets } from '@/store/assets';

/*
 * Bundled sample designs (original, fictional brands) used by "Try a sample":
 * every printable face gets a design that suits it.
 */

const BY_MODEL: Record<string, Record<string, string>> = {
  watch: { screen: 'watch' },
  totem: { screen: 'poster' },
  'street-poster': { screen: 'poster' },
  'business-card': { front: 'card-front', back: 'card-back' },
  postcard: { front: 'poster', back: 'card-back' },
  flyer: { front: 'poster', back: 'label' },
  poster: { poster: 'poster' },
  'roll-up': { banner: 'poster' },
  brochure: { inside: 'spread', outside: 'pattern' },
  magazine: { spread: 'spread', cover: 'poster' },
  book: { cover: 'poster', spine: 'pattern' },
  letterhead: { front: 'label' },
  envelope: { front: 'card-front' },
  badge: { badge: 'poster' },
  box: { front: 'label', side: 'pattern', top: 'logo' },
  tube: { wrap: 'pattern' },
  mug: { print: 'logo' },
  bottle: { label: 'label' },
  tote: { print: 'logo' },
  tshirt: { print: 'logo' },
};

function sampleName(modelId: string, slotId: string, aspect: number, app: unknown) {
  // a phone showing a post, a story or a Reel: a poster-like visual, not an app screen
  if (app && app !== 'none') return 'sample-poster.png';
  const named = BY_MODEL[modelId]?.[slotId];
  if (named) return `sample-${named}.png`;
  return aspect < 1 ? 'sample-app.png' : 'sample-web.png';
}

const cache = new Map<string, Promise<string>>();

/** Asset id of a bundled sample (loaded once). */
export function sampleAsset(name: string): Promise<string> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const blob = await (await fetch(`${import.meta.env.BASE_URL}samples/${name}`)).blob();
      const asset = await fileToAsset(blob, name);
      useAssets.getState().add(asset);
      return asset.id;
    })();
    cache.set(name, p);
  }
  return p;
}

export const isSampleAsset = (assetId: string | null | undefined) => !!assetId && !!useAssets.getState().assets[assetId]?.name.startsWith('sample-');

/** Fills every face of a device with a matching sample (one asset per file, shared). */
export async function loadSamples(itemId: string) {
  const state = useProject.getState();
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  const model = getModel(item.modelId);
  const landscape = item.params.orientation === 'landscape';
  for (const slot of model.surfaces) {
    // never overwrite the user's own images
    const current = item.surfaces[slot.id]?.assetId;
    if (current && !useAssets.getState().assets[current]?.name.startsWith('sample-')) continue;
    const aspect = landscape ? 1 / slot.aspect : slot.aspect;
    const assetId = await sampleAsset(sampleName(model.id, slot.id, aspect, item.params.app));
    useProject.getState().setSurface(itemId, slot.id, { assetId });
  }
}
