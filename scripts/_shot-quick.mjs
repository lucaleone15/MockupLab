import { openApp, viaFileDialog } from './lib/app.mjs';
const [scheme, out] = process.argv.slice(2);
const { browser, page } = await openApp({ hash: '#/rapide', colorScheme: scheme });
const chooser = await viaFileDialog(page, () => page.getByTestId('quick-pick').click());
await chooser.setFiles('public/samples/sample-app.png');
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 9, null, { timeout: 120000 });
await page.screenshot({ path: out });
await browser.close();
