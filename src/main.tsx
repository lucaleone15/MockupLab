import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { useLang } from './i18n';
import { restoreProject, startAutosave } from './store/persistence';

document.documentElement.lang = useLang.getState().lang;

// Restore the autosaved project before the first render, then keep saving.
void restoreProject().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  startAutosave();
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
  ]).then(([ex, im, pr, reg, rf, pe, ia, sa, bf, ba, ov, ui]) => {
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
        importFromUrl: im.importFromUrl,
        project: pr.useProject,
        models: reg.MODELS.map((m) => ({ id: m.id, aspect: m.surfaces[0]?.aspect ?? 1 })),
      },
    });
  });
}
