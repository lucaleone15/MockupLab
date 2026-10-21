// scripts/check-project.mjs — Project mode: images sorted onto supports, 6 styles, pack (hero + one per image
// + board), ZIP, and "open in Studio".
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { openApp, check, done, viaFileDialog } from './lib/app.mjs';
mkdirSync('out/project', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/projet' });
await page.waitForSelector('[data-testid=project-screen]');
const chooser = await viaFileDialog(page, () => page.getByTestId('project-add').click());
await chooser.setFiles(['public/samples/sample-web.png', 'public/samples/sample-app.png', 'public/samples/sample-poster.png']);
await page.waitForTimeout(800);
const rows = page.getByTestId('project-file');
check((await rows.count()) === 3, `3 images listed (${await rows.count()})`);
const supports = await rows.locator('select').evaluateAll((els) => els.map((e) => e.value));
check(JSON.stringify(supports) === JSON.stringify(['laptop', 'phone', 'print']), `supports detected ${JSON.stringify(supports)}`);
// change one support by hand
await rows.nth(2).locator('select').selectOption('tablet');
check((await page.evaluate(() => window.__mockuplab.pack.state().files[2].support)) === 'tablet', 'support changed by hand');
await rows.nth(2).locator('select').selectOption('print');
// styles: 6 previews
await page.waitForFunction(() => document.querySelectorAll('[data-testid=project-style] img').length === 3, null, { timeout: 120000 }).catch(() => {});
check((await page.locator('[data-testid=project-style] img').count()) === 3, 'three studio styles rendered');
await page.getByTestId('project-style').nth(1).click();
// pack: hero + 3 + board
await page.waitForFunction(() => document.querySelectorAll('[data-testid=pack-item] img').length === 5, null, { timeout: 180000 }).catch(() => {});
check((await page.locator('[data-testid=pack-item] img').count()) === 5, `pack preview: hero + 3 + board (${await page.locator('[data-testid=pack-item] img').count()})`);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 400000 }), page.getByRole('button', { name: /Télécharger le pack/ }).click()]);
await dl.saveAs('out/project/' + dl.suggestedFilename());
const list = execSync(`unzip -Z1 out/project/${dl.suggestedFilename()}`).toString().trim().split('\n');
check(list.length === 5 && list.some((f) => /^00-hero/.test(f)) && list.some((f) => /planche/.test(f)), `ZIP has hero, 3 mock-ups and the board (${list.join(', ')})`);
// open the hero in the Studio
await page.getByTestId('pack-item').first().getByRole('button', { name: /Affiner dans le Studio/ }).click();
await page.waitForTimeout(1500);
const st = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, models: window.__mockuplab.project.getState().items.map((it) => it.modelId) }));
check(st.screen === 'studio' && st.models.length === 3, `hero opens in the Studio with 3 devices (${JSON.stringify(st)})`);
await done(browser, errors);
