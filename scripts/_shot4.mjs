import { openApp } from './lib/app.mjs';
const [scheme, out] = process.argv.slice(2);
const { browser, page } = await openApp({ hash: '#/studio', colorScheme: scheme });
await page.waitForTimeout(1000);
await page.getByTestId('top-export').click();
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
