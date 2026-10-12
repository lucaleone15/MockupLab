import { openApp } from './lib/app.mjs';
const [hash, scheme, out, tab] = process.argv.slice(2);
const { browser, page } = await openApp({ hash, colorScheme: scheme });
await page.waitForTimeout(1500);
if (tab) { await page.getByRole('radio', { name: tab, exact: true }).first().click(); await page.waitForTimeout(500); }
await page.screenshot({ path: out });
await browser.close();
