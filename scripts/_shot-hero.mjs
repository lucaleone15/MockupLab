import { openApp, viaFileDialog } from './lib/app.mjs';
const [out, style] = process.argv.slice(2);
const { browser, page } = await openApp({ hash: '#/projet', colorScheme: 'light' });
const chooser = await viaFileDialog(page, () => page.getByTestId('project-add').click());
await chooser.setFiles(['public/samples/sample-web.png', 'public/samples/sample-app.png', 'public/samples/sample-poster.png']);
if (style) { await page.waitForTimeout(500); await page.getByTestId('project-style').nth(+style).click(); }
await page.waitForFunction(() => document.querySelectorAll('[data-testid=pack-item] img').length >= 1, null, { timeout: 200000 });
await page.getByTestId('pack-item').first().screenshot({ path: out });
await browser.close();
