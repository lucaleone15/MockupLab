// scripts/check-studio.mjs — rail pages render flat, library click adds, canvas click opens Settings.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const rail = page.getByTestId('studio-rail');
check((await rail.getByRole('tab', { selected: true }).textContent()).trim() === 'Appareils', 'a fresh Studio opens on Appareils (add or change devices first)');
const names = (await rail.getByRole('tab').allTextContents()).map((s) => s.trim());
check(JSON.stringify(names) === JSON.stringify(['Appareils', 'Réglages', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']), `rail: ${names}`);
for (const n of names) {
  await rail.getByRole('tab', { name: n, exact: true }).click();
  await page.waitForTimeout(250);
  // only fine-tuning folds away, under “Paramètres avancés”, closed at first
  const folds = page.getByTestId('rail-page').locator('[aria-expanded]:not([aria-haspopup])');
  const labels = (await folds.allTextContents()).map((s) => s.trim());
  const open = await folds.evaluateAll((els) => els.filter((e) => e.getAttribute('aria-expanded') === 'true').length);
  check(labels.every((l) => l === 'Paramètres avancés') && open === 0, `${n}: only “Advanced settings” folds, closed at first (${labels.length})`);
  check((await page.getByTestId('rail-page').getByRole('heading', { level: 2 }).textContent()).trim() === n, `${n}: page title`);
}
await rail.getByRole('tab', { name: 'Appareils', exact: true }).click();
const count = () => page.evaluate(() => window.__mockuplab.project.getState().items.length);
const n0 = await count();
await page.getByTestId('add-device').click();
await page.getByTestId('catalogue-family-laptop').click();
await page.getByTestId('catalogue').getByRole('button', { name: 'Laptop 14', exact: true }).click();
await page.waitForTimeout(300);
const models = () => page.evaluate(() => window.__mockuplab.project.getState().items.map((i) => i.modelId).join());
check(n0 === 1 && (await models()) === 'laptop-14', `the first pick replaces the untouched sample phone (${await models()})`);
await page.getByTestId('add-device').click();
await page.getByTestId('catalogue-family-phone').click();
await page.getByTestId('catalogue').getByRole('button', { name: 'Phone Neo', exact: true }).click();
await page.waitForTimeout(300);
check((await count()) === 2, 'the next library click adds a device');
// a click on a device in the canvas opens Settings
await rail.getByRole('tab', { name: 'Lumière', exact: true }).click();
await page.waitForTimeout(800);
const box = await page.getByTestId('frame').boundingBox();
const hit = await page.evaluate(({ x, y, w, h }) => {
  for (let i = 1; i < 20; i++)
    for (let j = 1; j < 20; j++) {
      const px = x + (w * i) / 20,
        py = y + (h * j) / 20;
      if (window.__mockuplab.picking.item?.(px, py)) return [px, py];
    }
  return null;
}, { x: box.x, y: box.y, w: box.width, h: box.height });
check(!!hit, 'found a device in the frame');
if (hit) {
  await page.mouse.click(hit[0], hit[1]);
  await page.waitForTimeout(300);
}
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'settings', 'canvas click → Settings page');
const bar = page.getByTestId('floating-bar');
await bar.getByRole('radio', { name: '1:1' }).click();
check((await page.evaluate(() => window.__mockuplab.project.getState().export.ratio)) === '1:1', 'floating bar sets the ratio');
await bar.getByTestId('open-variants').click();
await page.waitForTimeout(500);
check(await page.getByTestId('variants').isVisible(), 'Ideas opens the variants grid');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await rail.getByRole('tab', { name: 'Marque', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: /Planche de marque/ }).isVisible(), 'Brand page has the brand board');
await rail.getByRole('tab', { name: 'Texte', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: 'Titre', exact: true }).isVisible(), 'Text page adds titles');
await rail.getByRole('tab', { name: 'Décor', exact: true }).click();
check((await page.getByTestId('rail-page').getByRole('heading', { level: 3 }).count()) === 2, 'Decor page shows the background colour and the support');
await rail.getByRole('tab', { name: 'Lumière', exact: true }).focus();
await page.keyboard.press('ArrowDown');
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'camera', 'ArrowDown in the rail moves to the next page');
check((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Caméra', 'focus follows the keyboard in the rail');
// only the untouched sample phone of a new project is replaced — not a phone picked on purpose, not an edited one
const after = (setup) => page.evaluate((setup) => {
  const api = window.__mockuplab.project;
  api.getState().resetAll();
  new Function('s', setup)(api.getState());
  return api.getState().items.map((i) => i.modelId).join();
}, setup);
check((await after(`s.addItem('phone-pro'); s.addItem('laptop-14');`)) === 'phone-pro,laptop-14', 'a phone picked on purpose stays when a laptop is added');
check((await after(`const id = s.items[0].id; s.updateItem(id, { rotation: [0, 0.5, 0] }); s.addItem('laptop-14');`)).split(',').length === 2, 'an edited sample phone stays');
check((await after(`s.addItem('laptop-14');`)) === 'laptop-14', 'an untouched sample phone is replaced');
check((await after(`s.replaceModel(s.selectedId, 'tv'); s.addItem('poster');`)) === 'tv,poster', 'a sample changed with “Change” is kept');
await done(browser, errors);
