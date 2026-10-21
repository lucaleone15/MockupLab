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
  for (const tab of ['Appareils', 'Réglages', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque']) {
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
  await page.evaluate(() => (location.hash = '#/rapide'));
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 6, null, { timeout: 120000 }).catch(() => {});
  await shot('quick');
  await page.evaluate(() => (location.hash = '#/projet'));
  await page.evaluate(async () => {
    for (const n of ['sample-web.png', 'sample-app.png', 'sample-poster.png']) {
      const blob = await (await fetch('/samples/' + n)).blob();
      await window.__mockuplab.pack.add([new File([blob], n, { type: 'image/png' })]);
    }
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=pack-item] img').length >= 5, null, { timeout: 200000 }).catch(() => {});
  await shot('project');
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForTimeout(1000);
  await shot('home-recents');
  await browser.close();
}
console.log('out/ui written');
