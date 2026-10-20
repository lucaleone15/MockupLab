// scripts/check-review.mjs — regressions found by the phase 1 review: screen ⇄ mode stay in step,
// home drops land on the device, a leftover video kind never hijacks Export, rail arrows don't nudge.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const st = () =>
  page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, hash: location.pathname + location.hash, past: window.__mockuplab.project.temporal.getState().pastStates.length }));
// 1. opening a screen is not an undo step; an old /photo address shows the home page
let s = await st();
check(s.past === 0, `direct load of #/studio leaves no undo step (${s.past})`);
await page.evaluate(() => (location.hash = '#/photo'));
await page.waitForTimeout(200);
s = await st();
check(s.screen === 'home' && s.hash === '/', `the photo mode is gone: #/photo shows the home page (${s.screen}/${s.hash})`);
await page.evaluate(() => window.__mockuplab.persistence.newProject());
await page.waitForTimeout(300);
// 2. a paste on home stays on home (pick a mode first)
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(200);
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 600;
  c.getContext('2d').fillRect(0, 0, 300, 600);
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'home-paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(1000);
const landed = await page.evaluate(() => {
  const api = window.__mockuplab;
  const q = api.quick.state();
  const scene = api.project.getState().items.flatMap((it) => Object.values(it.surfaces).map((b) => b.assetId && api.assetName(b.assetId)));
  return { screen: api.ui.getState().screen, image: q.assetId && api.assetName(q.assetId), scene };
});
check(landed.screen === 'home' && landed.image !== 'home-paste.png' && !landed.scene.includes('home-paste.png'), `paste on home stays on home, nothing imported (${JSON.stringify(landed)})`);
await page.evaluate(() => (location.hash = '#/studio'));
await page.waitForTimeout(300);
// 3. a leftover video kind does not hijack the image export
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ kind: 'video' }));
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Lumière', exact: true }).click();
await page.keyboard.press('Meta+e');
await page.waitForTimeout(300);
check(await page.getByTestId('export-sheet').isVisible(), '⌘E opens the image sheet even with a stored video kind');
await page.getByTestId('export-sheet').getByRole('radio', { name: '1080p', exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `sheet downloads an image (${dl.suggestedFilename()})`);
// 4. arrows in the rail do not move the selected device
const pos = () => page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items[0].position));
const before = await pos();
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Réglages', exact: true }).focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
check((await pos()) === before, 'rail arrows leave the device in place');
await done(browser, errors);
