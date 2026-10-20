// scripts/check-urls.mjs — clean addresses (/studio, /rapide…) instead of /#/…, old #/ links still work,
// and the web app leaves the browser's ⌘S / ⌘O / ⌘D alone.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: 'studio' });
const where = () => page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, path: location.pathname, hash: location.hash }));
let w = await where();
check(w.screen === 'studio' && w.path === '/studio' && !w.hash, `direct /studio opens the Studio (${JSON.stringify(w)})`);
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Rapide' }).click();
await page.waitForTimeout(300);
w = await where();
check(w.path === '/rapide' && !w.hash, `switching mode gives a clean address (${w.path}${w.hash})`);
await page.goBack();
await page.waitForTimeout(300);
check((await where()).screen === 'studio', 'back button returns to the Studio');
await page.goto('http://localhost:5173/#/projet');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(500);
w = await where();
check(w.screen === 'project' && w.path === '/projet' && !w.hash, `old #/projet link redirected to /projet (${JSON.stringify(w)})`);
await page.goto('http://localhost:5173/nimporte');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(500);
w = await where();
check(w.screen === 'home' && w.path === '/', `unknown address → home (${JSON.stringify(w)})`);
// browser shortcuts are not taken by the web app
await page.evaluate(() => (location.hash = '#/studio'));
await page.waitForTimeout(500);
await page.evaluate(() => {
  window.__prevented = [];
  window.addEventListener('keydown', (e) => e.metaKey && e.key.length === 1 && window.__prevented.push(`${e.key}:${e.defaultPrevented}`));
});
for (const k of ['s', 'o', 'd']) await page.keyboard.press(`Meta+${k}`);
const prevented = await page.evaluate(() => window.__prevented);
check(prevented.length === 3 && prevented.every((p) => p.endsWith(':false')), `⌘S ⌘O ⌘D left to the browser (${prevented.join(' ')})`);
check((await page.evaluate(() => window.__mockuplab.project.getState().items.length)) === 1, '⌘D did not duplicate the device on the web');
await done(browser, errors);
