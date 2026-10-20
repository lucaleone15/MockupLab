import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { useLang } from './i18n';
import { restoreProject, startAutosave } from './store/persistence';

document.documentElement.lang = useLang.getState().lang;

// Imported 3D models, then the autosaved project, before the first render; then keep saving.
void import('./models/glb/userModels')
  .then((m) => m.loadUserModels())
  .catch(() => undefined)
  .then(() => restoreProject())
  .catch(() => undefined)
  .finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  startAutosave();
  void import('./library/thumbs').then((m) => m.startThumbs());
  void import('./pwa/update').then((m) => m.startUpdates());
});

if (import.meta.env.DEV) {
  // Hooks for the visual test scripts (scripts/shoot.mjs).
  void Promise.all([
    import('./export/exportImage'),
    import('./lib/importImage'),
    import('./store/project'),
    import('./models/registry'),
    import('./scene/exporter'),
    import('./store/persistence'),
    import('./scene/interaction'),
    import('./lib/samples'),
    import('./lib/brandFonts'),
    import('./lib/brandArt'),
    import('./lib/overlays'),
    import('./store/ui'),
    import('./store/assets'),
    import('./variants/store'),
    import('./library/exports'),
    import('./quick/store'),
    import('./project/store'),
    import('./library/thumbs'),
  ]).then(([ex, im, pr, reg, rf, pe, ia, sa, bf, ba, ov, ui, as, va, lx, qk, pk, th]) => {
    Object.assign(window, {
      __mockuplab: {
        renderImage: ex.renderImage,
        renderFrame: rf.renderFrame,
        bridge: rf.debugBridge,
        persistence: pe,
        picking: ia.picking,
        loadSamples: sa.loadSamples,
        importFontFile: bf.importFontFile,
        importAsset: im.importAsset,
        applyBrandArt: ba.applyBrandArt,
        overlays: ov,
        ui: ui.useUi,
        assetName: (id: string) => as.useAssets.getState().assets[id]?.name,
        assetUrl: (id: string) => as.useAssets.getState().assets[id]?.url,
        library: pe.library,
        exports: lx,
        quick: qk.quick,
        pack: pk.pack,
        thumbs: th,
        importFiles: im.importImages,
        asset: (id: string) => as.useAssets.getState().assets[id],
        variants: va.useVariants,
        renderVideo: () => import('./animation/video').then((m) => m.renderVideo()),
        importFromUrl: im.importFromUrl,
        project: pr.useProject,
        models: reg.MODELS.map((m) => ({ id: m.id, aspect: m.surfaces[0]?.aspect ?? 1 })),
        looks: () => import('./variants/looks'),
        animations: () => import('./animation/animations'),
        itemSize: async (id: string) => {
          const [{ sizeOf }, { aspectsOf }] = await Promise.all([import('./models/types'), import('./models/imageAspects')]);
          const it = pr.useProject.getState().items.find((x) => x.id === id)!;
          return sizeOf(reg.getModel(it.modelId), it.params, aspectsOf(it.surfaces));
        },
      },
    });
  });
}
