// scripts/shoot-ui.mjs — every screen and rail page, light and dark, into out/ui/.
import { mkdirSync } from 'node:fs';
import { openApp } from './lib/app.mjs';
mkdirSync('out/ui', { recursive: true });
for (const scheme of ['light', 'dark']) {
  const { browser, page } = await openApp({ colorScheme: scheme });
  const shot = (name) => page.screenshot({ path: `out/ui/${name}-${scheme}.png` });
  await shot('home');
  await page.evaluate(() => (location.hash = '#/studio'));
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Essayer un exemple' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  for (const tab of ['Appareils', 'Réglages', 'Ambiance', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']) {
    await page.getByTestId('studio-rail').getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
    await shot(`studio-${tab}`);
  }
  await page.getByTestId('top-export').click();
  await page.waitForTimeout(400);
  await shot('export');
  await page.keyboard.press('Escape');
  await page.getByTestId('more-menu').click();
  await page.waitForTimeout(300);
  await shot('more-menu');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = '#/photo'));
  await page.waitForTimeout(400);
  await shot('photo-empty');
  await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
  await page.waitForTimeout(1500);
  for (const tab of ['Photos', 'Zones', 'Design', 'Rendu']) {
    await page.getByTestId('photo-rail').getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
    await shot(`photo-${tab}`);
  }
  await browser.close();
}
console.log('out/ui written');
