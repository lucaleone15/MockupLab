// scripts/check-photo-rail.mjs — photo rail pages, provided photos listed once, batch from Design.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/photo' });
const rail = page.getByTestId('photo-rail');
const names = (await rail.getByRole('tab').allTextContents()).map((s) => s.trim());
check(JSON.stringify(names) === JSON.stringify(['Photos', 'Zones', 'Design', 'Rendu', 'Vidéo']), `rail: ${names}`);
const tplName = 'Tablette et téléphone';
check((await page.getByRole('button', { name: new RegExp(tplName) }).count()) === 1, 'each provided photo is listed once');
await page.getByTestId('photo-library').getByRole('button', { name: new RegExp(tplName) }).click();
await page.waitForTimeout(1500);
for (const n of names) {
  await rail.getByRole('tab', { name: n, exact: true }).click();
  await page.waitForTimeout(200);
  check((await page.getByTestId('rail-page').locator('[aria-expanded]:not([aria-haspopup])').count()) === 0, `${n}: flat`);
}
await rail.getByRole('tab', { name: 'Design', exact: true }).click();
await page.getByTestId('open-batch').click();
await page.waitForTimeout(300);
check(await page.getByTestId('batch').isVisible(), 'batch dialog opens from Design');
await done(browser, errors);
