// scripts/check-export.mjs — the Export sheet downloads an image; leaving Video goes back to images.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const kind = () => page.evaluate(() => window.__mockuplab.project.getState().export.kind);
const rail = page.getByTestId('studio-rail');
await rail.getByRole('tab', { name: 'Vidéo', exact: true }).click();
await page.waitForTimeout(200);
check((await kind()) === 'video', 'Video page → video kind');
await rail.getByRole('tab', { name: 'Lumière', exact: true }).click();
await page.waitForTimeout(200);
check((await kind()) === 'image', 'leaving Video → image kind');
// leaving the Video page must not leave undo steps behind
check((await page.evaluate(() => window.__mockuplab.project.temporal.getState().pastStates.length)) === 0, 'visiting Video adds no undo step');
await page.getByTestId('top-export').click();
const sheet = page.getByTestId('export-sheet');
check(await sheet.isVisible(), 'Export opens the sheet');
await sheet.getByRole('radio', { name: '1080p', exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), sheet.getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `downloaded ${dl.suggestedFilename()}`);
// ⌘E opens the sheet too
await page.keyboard.press('Meta+e');
await page.waitForTimeout(300);
check(await sheet.isVisible(), '⌘E opens the sheet');
await done(browser, errors);
