import { openApp } from './lib/app.mjs';
const [hash, scheme, out, tab, rail = 'studio-rail'] = process.argv.slice(2);
const { browser, page } = await openApp({ hash, colorScheme: scheme });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Essayer un exemple' }).click().catch(() => {});
await page.waitForTimeout(1200);
if (tab) { await page.getByTestId(rail).getByRole('tab', { name: tab, exact: true }).click(); await page.waitForTimeout(500); }
await page.screenshot({ path: out });
await browser.close();
