import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { useLang } from './i18n';

document.documentElement.lang = useLang.getState().lang;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Hooks for the visual test scripts (scripts/shoot.mjs).
  void Promise.all([
    import('./export/exportImage'),
    import('./lib/importImage'),
    import('./store/project'),
    import('./models/registry'),
    import('./scene/exporter'),
  ]).then(([ex, im, pr, reg, rf]) => {
    Object.assign(window, {
      __mockuplab: {
        renderImage: ex.renderImage,
        renderFrame: rf.renderFrame,
        importFromUrl: im.importFromUrl,
        project: pr.useProject,
        models: reg.MODELS.map((m) => ({ id: m.id, aspect: m.surfaces[0]?.aspect ?? 1 })),
      },
    });
  });
}
