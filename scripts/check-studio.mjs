// scripts/check-studio.mjs — rail pages render flat, library click adds, canvas click opens Settings.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const rail = page.getByTestId('studio-rail');
check((await rail.getByRole('tab', { selected: true }).textContent()).trim() === 'Appareils', 'a fresh Studio opens on Appareils (add or change devices first)');
const names = (await rail.getByRole('tab').allTextContents()).map((s) => s.trim());
check(JSON.stringify(names) === JSON.stringify(['Appareils', 'Réglages', 'Ambiance', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']), `rail: ${names}`);
for (const n of names) {
  await rail.getByRole('tab', { name: n, exact: true }).click();
  await page.waitForTimeout(250);
  const collapsible = await page.getByTestId('rail-page').locator('[aria-expanded]:not([aria-haspopup])').count();
  check(collapsible === 0, `${n}: no collapsible section`);
  check((await page.getByTestId('rail-page').getByRole('heading', { level: 2 }).textContent()).trim() === n, `${n}: page title`);
}
await rail.getByRole('tab', { name: 'Appareils', exact: true }).click();
const count = () => page.evaluate(() => window.__mockuplab.project.getState().items.length);
const n0 = await count();
await page.getByTestId('library-tabs').getByRole('button', { name: 'Ordinateurs portables' }).click();
await page.getByTestId('rail-page').getByRole('button', { name: 'Laptop 14', exact: true }).click();
await page.waitForTimeout(300);
check((await count()) === n0 + 1, 'library click adds a device');
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
await rail.getByRole('tab', { name: 'Ambiance', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: /Chêne · mur blanc/ }).isVisible(), 'Ambiance lists the moods');
await rail.getByRole('tab', { name: 'Marque', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: /Planche de marque/ }).isVisible(), 'Brand page has the brand board');
await rail.getByRole('tab', { name: 'Texte', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: 'Titre', exact: true }).isVisible(), 'Text page adds titles');
await rail.getByRole('tab', { name: 'Décor', exact: true }).click();
check((await page.getByTestId('rail-page').getByRole('heading', { level: 3 }).count()) >= 3, 'Decor page shows background, set and floor groups');
await rail.getByRole('tab', { name: 'Lumière', exact: true }).focus();
await page.keyboard.press('ArrowDown');
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'camera', 'ArrowDown in the rail moves to the next page');
check((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Caméra', 'focus follows the keyboard in the rail');
await done(browser, errors);
