// scripts/make-showcase.mjs — the real mock-ups shown on the home page, rendered by MockupLab itself
// from the bundled sample designs, and the Studio at work (dev server on :5173). Output: public/showcase/*
import { mkdirSync } from 'node:fs';
import { openApp } from './lib/app.mjs';
mkdirSync('public/showcase', { recursive: true });
const { browser, page } = await openApp({ hash: '#/rapide', colorScheme: 'light' });
const exportAs = (ratio) => page.evaluate((r) => window.__mockuplab.project.getState().setExport({ resolution: '1080', format: 'webp', quality: 0.84, ratio: r }), ratio);
const file = (n) => page.evaluate(async (n) => { const b = await (await fetch('/samples/' + n)).blob(); window.__f = new File([b], n, { type: 'image/png' }); }, n);
const save = async (name, trigger) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), trigger()]);
  await dl.saveAs(`public/showcase/${name}.webp`);
  console.log('saved', name);
};
// single devices (Quick)
for (const [name, img, tile, ratio] of [
  ['phone-aurora', 'sample-app.png', 'aurora', '16:9'],
  ['laptop-marble', 'sample-web.png', 'table-marble-sand', '16:9'],
  ['laptop-concrete', 'sample-web.png', 'table-concrete-blue', '16:9'],
  ['phone-oak', 'sample-app.png', 'table-oak-white', '16:9'],
  ['phone-terrazzo', 'sample-app.png', 'podium-terrazzo', '16:9'],
]) {
  await exportAs(ratio);
  await file(img);
  await page.evaluate(() => window.__mockuplab.quick.setImage(window.__f));
  await save(name, () => page.evaluate((t) => window.__mockuplab.quick.download([t]), tile));
}
// several devices together (Project hero)
await exportAs('16:9');
await page.evaluate(() => (location.hash = '#/projet'));
await page.waitForTimeout(500);
for (const n of ['sample-web.png', 'sample-app.png', 'sample-poster.png']) {
  await file(n);
  await page.evaluate(() => window.__mockuplab.pack.add([window.__f]));
}
for (const style of ['table-black-marble', 'table-oak-white', 'studio-light']) {
  await page.evaluate((s) => window.__mockuplab.pack.setStyle(s), style);
  await save('hero-' + style, () => page.evaluate(() => window.__mockuplab.pack.downloadOne('hero')));
}
await browser.close();

// the Studio at work: a laptop and a phone side by side in the photo studio, the Décor page open (home page, under the title)
{
  const { browser, page } = await openApp({ hash: '#/studio', colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
  await page.evaluate(async () => {
    const api = window.__mockuplab;
    const s = api.project.getState();
    s.setComposition(['laptop-14', 'phone-pro'], 'row');
    for (const it of api.project.getState().items) await api.loadSamples(it.id);
    s.setBackground({ kind: 'solid', color: '#e9e4f7' });
    s.setDecor({ kind: 'sweep' });
    s.setExport({ ratio: '16:9' });
    api.ui.getState().setStudioPage('decor');
    api.ui.getState().resetView();
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'public/showcase/studio-ui.jpg', type: 'jpeg', quality: 86 });
  console.log('saved studio-ui');
  await browser.close();
}
