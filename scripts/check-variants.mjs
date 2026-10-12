// Variants gallery and batch: thumbnails, project left intact, refine, compare,
// ZIP export of the selection, apply + undo, batch ZIP with the current scene and with variants.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
mkdirSync('out/variants', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
await p.waitForFunction(() => window.__mockuplab?.variants);
await p.evaluate(async () => {
  const api = window.__mockuplab;
  // a light export size keeps the test quick
  api.project.getState().setExport({ resolution: '1080', format: 'jpeg' });
  await api.loadSamples(api.project.getState().items[0].id);
});
await p.waitForTimeout(800);
const state = () => p.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  return JSON.stringify({ bg: s.background, decor: s.decor, light: s.lighting, cam: s.camera, items: s.items.map((i) => [i.rotation, i.finishId, i.pose]), past: window.__mockuplab.project.temporal.getState().pastStates.length });
});
const before = await state();
const thumbsDone = (n) => p.waitForFunction((n) => { const v = window.__mockuplab.variants.getState(); return !v.job && Object.keys(v.thumbs).length >= n && v.looks.length >= n; }, n, { timeout: 120000 });
let t0 = Date.now();
await p.getByTestId('open-variants').click();
await thumbsDone(9);
console.log('9 thumbnails in', Date.now() - t0, 'ms');
await p.waitForTimeout(300);
await p.screenshot({ path: 'out/variants/gallery.png' });
await p.getByTestId('variants').getByRole('button', { name: 'Fermer' }).click().catch(() => {});
await p.keyboard.press('Escape');
await p.waitForTimeout(800);
console.log('project intact after previews:', (await state()) === before);
await p.screenshot({ path: 'out/variants/after-close.png' });
// reopen, select 3, refine the 2nd
await p.getByTestId('open-variants').click();
await p.waitForTimeout(300);
const cards = p.getByTestId('variant');
for (const i of [0, 2, 4]) await cards.nth(i).locator('button[aria-pressed]').click();
await cards.nth(2).hover();
await cards.nth(2).getByRole('button', { name: 'Affiner autour de celle-ci' }).click();
t0 = Date.now();
await p.waitForFunction(() => window.__mockuplab.variants.getState().job);
await thumbsDone(9);
console.log('refine →', await p.evaluate(() => window.__mockuplab.variants.getState().looks.map((l) => l.label).join(' | ')), Date.now() - t0, 'ms');
await p.screenshot({ path: 'out/variants/refined.png' });
// compare two
await p.evaluate(() => window.__mockuplab.variants.setState((s) => ({ selected: s.selected.slice(0, 2) })));
await p.getByRole('button', { name: 'Comparer' }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: 'out/variants/compare.png' });
await p.keyboard.press('Escape');
// export the selection (3) as ZIP
await p.evaluate(() => window.__mockuplab.variants.setState((s) => ({ selected: s.looks.slice(0, 3).map((l) => l.id) })));
t0 = Date.now();
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.getByTestId('variants-export').click()]);
await dl.saveAs('out/variants/' + dl.suggestedFilename());
console.log('export:', dl.suggestedFilename(), Date.now() - t0, 'ms');
console.log(execSync(`cd out/variants && rm -rf zip && mkdir zip && cd zip && unzip -q ../${dl.suggestedFilename()} && ls -la`).toString().split('\n').slice(3).join('\n'));
await p.waitForTimeout(800);
// apply one, then undo
const vb = await state();
await cards.nth(5).hover();
await p.getByRole('button', { name: 'Utiliser' }).nth(5).click().catch(async () => { await p.evaluate(() => { const v = window.__mockuplab.variants.getState(); }); });
await p.waitForTimeout(1500);
const applied = await state();
console.log('applied changes the scene:', applied !== vb);
await p.screenshot({ path: 'out/variants/applied.png' });
await p.keyboard.press('Meta+z');
await p.waitForTimeout(600);
const undone = JSON.parse(await state());
const orig = JSON.parse(vb);
console.log('undo restores:', JSON.stringify(undone.decor) === JSON.stringify(orig.decor) && JSON.stringify(undone.bg) === JSON.stringify(orig.bg));
// batch: current scene, then the selected variants
await p.getByTestId('studio-rail').getByRole('tab', { name: 'Réglages', exact: true }).click();
await p.getByTestId('open-batch').click();
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('batch').getByRole('button', { name: /Glisse tes images/ }).click()]);
await chooser.setFiles(['public/samples/sample-app.png', 'public/samples/sample-poster.png', 'public/samples/sample-card-front.png']);
await p.waitForTimeout(400);
await p.screenshot({ path: 'out/variants/batch.png' });
t0 = Date.now();
const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.getByTestId('batch-run').click()]);
await dl2.saveAs('out/variants/' + dl2.suggestedFilename());
console.log('batch current:', dl2.suggestedFilename(), Date.now() - t0, 'ms');
await p.evaluate(() => window.__mockuplab.variants.setState((s) => ({ selected: s.looks.slice(0, 2).map((l) => l.id) })));
await p.getByTestId('batch').getByRole('radio', { name: /Variantes sélectionnées/ }).click();
const [dl3] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.getByTestId('batch-run').click()]);
await dl3.saveAs('out/variants/' + dl3.suggestedFilename());
console.log('batch variants:', dl3.suggestedFilename());
console.log(execSync(`cd out/variants && rm -rf zip2 && mkdir zip2 && cd zip2 && unzip -q ../${dl3.suggestedFilename()} && ls`).toString());
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
console.log('items keep their own image after batch:', await p.evaluate(() => { const s = window.__mockuplab.project.getState(); return window.__mockuplab.assetName(s.items[0].surfaces.screen.assetId); }));
console.log('errors:', errors.join('\n') || 'none');
await b.close();
