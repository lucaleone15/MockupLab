import { openApp } from './lib/app.mjs';
const [scheme, out, tab] = process.argv.slice(2);
const { browser, page } = await openApp({ hash: '#/photo', colorScheme: scheme });
await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[1]));
await page.waitForTimeout(1500);
if (tab) { await page.getByTestId('photo-rail').getByRole('tab', { name: tab, exact: true }).click(); await page.waitForTimeout(400); }
await page.screenshot({ path: out });
await browser.close();
