// scripts/check-studio-2.mjs — feedback round 2, Studio: no Ambiance page (a scene starts as « Studio sombre »),
// Devices page with a catalogue window, Décor starting with the background colour, Brand basics first.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const shot = (name) => page.screenshot({ path: `out/studio2/${name}.png` });
const rail = page.getByTestId('studio-rail');
const state = () => page.evaluate(() => window.__mockuplab.project.getState());

// 1. no Ambiance page; a fresh scene is the « Studio sombre »
check((await rail.getByRole('tab', { name: 'Ambiance', exact: true }).count()) === 0, 'no Ambiance page in the rail');
const s0 = await state();
check(s0.background.kind === 'gradient' && s0.background.stops[0].color === '#2a2a31' && s0.decor.kind === 'none' && s0.lighting.preset === 'studio', 'a fresh scene starts as the dark studio');

// 2. Devices: the scene first, the catalogue in a window
await rail.getByRole('tab', { name: 'Appareils', exact: true }).click();
const pageEl = page.getByTestId('rail-page');
check((await pageEl.getByRole('button', { name: /^Phone Pro$/ }).count()) === 0, 'Devices page: no model cards until “Add a device”');
await page.evaluate(() => window.__mockuplab.loadSamples(window.__mockuplab.project.getState().items[0].id));
await page.waitForTimeout(500);
await shot('devices');
await page.getByTestId('add-device').click();
const cat = page.getByTestId('catalogue');
check(await cat.isVisible(), 'the catalogue opens');
await cat.getByTestId('catalogue-family-phone').click();
const phones = (await cat.getByRole('button', { name: /^Phone( Pro| Neo)?$/ }).allTextContents()).map((x) => x.trim());
check(['Phone Pro', 'Phone', 'Phone Neo'].every((n) => phones.includes(n)), `phones family lists the phones (${phones})`);
await shot('catalogue');
await cat.getByRole('button', { name: /^Phone Pro$/ }).click();
await page.waitForTimeout(400);
check((await state()).items.length === 2 && !(await cat.isVisible().catch(() => false)), 'a click adds the device and closes the catalogue');
await page.getByTestId('add-device').click();
await cat.getByTestId('catalogue-family-several').click();
await cat.getByTestId('composition-phones-3').click();
await page.waitForTimeout(400);
check((await state()).items.length === 3, '“Several devices” › 3 phones gives 3 devices');
const rows = pageEl.getByTestId('scene-item');
check((await rows.count()) === 3, 'one row per device');
let visibleTrash = 0;
for (let i = 0; i < 3; i++) if (await rows.nth(i).getByRole('button', { name: 'Supprimer', exact: true }).isVisible()) visibleTrash++;
check(visibleTrash === 3, 'every row shows its trash');
await rows.nth(1).getByRole('button', { name: 'Plus d’actions' }).click();
await page.getByRole('menuitem', { name: 'Dupliquer' }).click();
await page.waitForTimeout(300);
check((await state()).items.length === 4, 'the ⋯ menu duplicates');
await shot('devices-4');
// “Change” replaces that device (its images stay); “Add” adds one
const before = await state();
await rows.nth(0).getByRole('button', { name: 'Changer', exact: true }).click();
check((await cat.getByRole('heading').first().textContent()).includes('Changer'), 'Change opens the catalogue titled “Change …”');
check(await cat.getByText('sera remplacé').isVisible(), 'the catalogue says the device will be replaced');
check((await cat.getByTestId('catalogue-family-several').count()) === 0, 'no ready-made scenes when changing one device');
await shot('catalogue-change');
await cat.getByTestId('catalogue-family-laptop').click();
await cat.getByRole('button', { name: 'Laptop 14', exact: true }).click();
await page.waitForTimeout(400);
const after = await state();
check(after.items.length === before.items.length && after.items[0].modelId === 'laptop-14' && after.items[0].id === before.items[0].id, 'Change replaces that device, nothing is added');
check(!!Object.values(after.items[0].surfaces).find((b) => b.assetId), 'the replaced device keeps an image');
await page.getByTestId('add-device').click();
check(await cat.getByText('s’ajoute à la scène').isVisible(), 'Add says the device is added to the scene');
await page.keyboard.press('Escape');

await done(browser, errors);
