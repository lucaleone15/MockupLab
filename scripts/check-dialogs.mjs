// scripts/check-dialogs.mjs — every pop-up is the app's own: confirmations, names and file choice open
// app dialogs (no window.confirm / prompt, no file chooser before “Parcourir…”).
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
let native = 0;
let choosers = 0;
page.on('dialog', (d) => {
  native++;
  void d.dismiss();
});
page.on('filechooser', () => choosers++);
const state = () => page.evaluate(() => window.__mockuplab.project.getState());
const png = async () =>
  page.evaluateHandle(async () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    c.getContext('2d').fillStyle = '#e33';
    c.getContext('2d').fillRect(0, 0, 64, 40);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'fond.png', { type: 'image/png' }));
    return dt;
  });

// 1. choosing an image opens the app's dialog; a file dropped on it is used
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Décor', exact: true }).click();
await page.getByTestId('rail-page').getByRole('radio', { name: 'Image', exact: true }).click();
await page.waitForTimeout(300);
const dialog = page.getByTestId('file-dialog');
check(await dialog.isVisible(), '“Image” opens the app’s file dialog');
check(choosers === 0, 'no system file chooser before “Browse…”');
await page.screenshot({ path: 'out/dialogs-file.png' });
const dt = await png();
await dialog.getByTestId('file-drop').dispatchEvent('drop', { dataTransfer: dt });
await page.waitForTimeout(800);
check((await state()).background.kind === 'image', 'a file dropped on the dialog becomes the background');
check(!(await dialog.isVisible().catch(() => false)), 'the dialog closes once a file is chosen');
check((await state()).items.every((it) => Object.values(it.surfaces).every((b) => !b.assetId || !b.assetId.includes('fond'))), 'the dropped file did not go on a device screen as well');

// 2. “Browse…” is the one way to the system chooser
// the dialog stays open until answered: do not wait for it here
await page.evaluate(() => import('/src/lib/importImage.ts').then((m) => void m.pickImages()));
await page.waitForTimeout(300);
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dialog.getByRole('button', { name: 'Parcourir…' }).click()]);
check(!!chooser, '“Browse…” opens the system chooser');
await chooser.setFiles({ name: 'ecran.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64') });
await page.waitForTimeout(800);
check(await page.evaluate(() => Object.values(window.__mockuplab.project.getState().items[0].surfaces).some((b) => b.assetId && window.__mockuplab.assetName(b.assetId) === 'ecran.png')), 'a browsed image goes on the device');

// 3. renaming and deleting a project: app dialogs
await page.evaluate(() => window.__mockuplab.project.setState({ name: 'Mon projet' }));
await page.waitForTimeout(2500);
await page.evaluate(() => window.__mockuplab.library.create());
await page.waitForTimeout(500);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
// saved projects are in the « Mes projets » window (no recents row on the home page any more)
await page.getByRole('button', { name: 'Mes projets' }).click();
await page.waitForTimeout(300);
const card = page.getByTestId('project-card').filter({ hasText: 'Mon projet' });
await card.getByRole('button', { name: /Options|Plus/ }).first().click();
await page.getByRole('menuitem', { name: 'Renommer' }).click();
const text = page.getByTestId('text-dialog');
check(await text.isVisible(), 'Rename opens the app’s text dialog');
await text.getByRole('textbox').fill('Projet renommé');
await text.getByRole('button', { name: 'OK' }).click();
const renamed = await page.getByTestId('project-card').filter({ hasText: 'Projet renommé' }).waitFor({ timeout: 5000 }).then(() => true, () => false);
check(renamed, 'the project is renamed');
await page.getByTestId('project-card').filter({ hasText: 'Projet renommé' }).getByRole('button', { name: /Options|Plus/ }).first().click();
await page.getByRole('menuitem', { name: 'Supprimer' }).click();
const confirm = page.getByTestId('confirm-dialog');
check(await confirm.isVisible(), 'Delete asks in the app’s confirm dialog');
await page.screenshot({ path: 'out/dialogs-confirm.png' });
await confirm.getByRole('button', { name: 'Supprimer' }).click();
await page.waitForTimeout(500);
check((await page.getByTestId('project-card').filter({ hasText: 'Projet renommé' }).count()) === 0, 'the project is deleted');
check(native === 0, `no browser pop-up (${native})`);
await done(browser, errors);
