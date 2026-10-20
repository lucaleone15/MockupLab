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
check(s0.background.kind === 'gradient' && s0.background.stops[0].color === '#2a2a31' && s0.decor.kind === 'sweep' && s0.lighting.preset === 'studio', 'a fresh scene starts as the dark studio');

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
// a bigger device put in a phone's place does not overlap the others: the scene is laid out again
const overlaps = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const items = api.project.getState().items.filter((i) => i.visible);
  const w = await Promise.all(items.map(async (i) => (await api.itemSize(i.id)).size[0] * Math.abs(Math.cos(i.rotation[1]))));
  let worst = 0;
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++) {
      const d = Math.hypot(items[a].position[0] - items[b].position[0], items[a].position[2] - items[b].position[2]);
      worst = Math.max(worst, (w[a] + w[b]) / 2 * 0.75 - d);
    }
  return worst;
});
check(overlaps <= 0, `after Change, no device sits inside another (${overlaps.toFixed(1)} cm too close)`);
await page.waitForTimeout(800);
await shot('after-change');
await page.getByTestId('add-device').click();
check(await cat.getByText('s’ajoute à la scène').isVisible(), 'Add says the device is added to the scene');
await page.keyboard.press('Escape');

// 3. Décor: the background colour first, then what the device stands on
await rail.getByRole('tab', { name: 'Décor', exact: true }).click();
await page.waitForTimeout(300);
const hex = pageEl.getByRole('textbox', { name: 'Code couleur' });
await hex.fill('#1E3A2F');
await hex.press('Enter');
await page.waitForTimeout(200);
let bg = (await state()).background;
check(bg.kind === 'solid' && bg.color === '#1e3a2f', `typing a hex code sets a plain background (${JSON.stringify(bg)})`);
await pageEl.getByTestId('quick-colors').getByRole('button').nth(1).click();
bg = (await state()).background;
check(bg.kind === 'solid' && bg.color !== '#1e3a2f', 'a quick colour sets the background');
check(await pageEl.getByTestId('bg-swatch').isVisible(), 'a big colour swatch opens the picker');
const supports = pageEl.locator('[data-testid^="support-"]');
check((await supports.count()) === 3, `3 choices for what the device stands on (${await supports.count()})`);
await pageEl.getByTestId('support-podium').click();
check((await state()).decor.kind === 'podium', '“Podium” sets the podium');
await pageEl.getByTestId('support-sweep').click();
check((await state()).decor.kind === 'sweep', '“Studio photo” sets the studio sweep');
check((await pageEl.getByText('Rien', { exact: true }).count()) === 0, 'no “Nothing” choice');
const ys = await Promise.all([pageEl.getByTestId('bg-swatch').boundingBox(), pageEl.getByTestId('support-sweep').boundingBox()]);
check(ys[0].y < ys[1].y, 'the background colour comes before the support');
await shot('decor');
// a project saved with a material surface shows “Real table” without the room
await page.evaluate(() => window.__mockuplab.project.getState().setDecor({ kind: 'surface' }));
await page.waitForTimeout(200);
check((await pageEl.getByTestId('support-table').getAttribute('aria-pressed')) === 'true', 'a surface set shows “Real table” chosen');
await pageEl.getByRole('button', { name: 'Paramètres avancés' }).last().click();
check((await pageEl.getByRole('switch', { name: 'Sans la pièce' }).getAttribute('aria-checked')) === 'true', '… with “Without the room” on');
await pageEl.getByRole('switch', { name: 'Sans la pièce' }).click();
check((await state()).decor.kind === 'table', 'switching it off brings the room back');
await shot('decor-advanced');

// a transparent background: no support, and a really transparent export
await pageEl.getByRole('radio', { name: 'Transparent', exact: true }).click();
await page.waitForTimeout(300);
const tr = await state();
check(tr.background.kind === 'transparent' && tr.decor.kind === 'none', `“Transparent” clears the background and the support (${tr.background.kind}/${tr.decor.kind})`);
check((await pageEl.getByText('Sur quoi poser l’appareil ?').count()) === 0, 'no “what does it stand on” with a transparent background');
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ format: 'png', resolution: '1080' }));
const alpha = await page.evaluate(async () => {
  const { blob } = await window.__mockuplab.renderImage();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const corner = (x, y) => g.getImageData(x, y, 1, 1).data[3];
  return [corner(2, 2), corner(bmp.width - 3, 2), corner(2, bmp.height - 3), corner(bmp.width - 3, bmp.height - 3)];
});
check(alpha.every((a) => a === 0), `the exported PNG is transparent around the device (corner alpha ${alpha})`);
await shot('transparent');
await pageEl.getByRole('radio', { name: 'Uni', exact: true }).click();
await page.waitForTimeout(200);
const back = await state();
check(back.background.kind === 'solid' && back.decor.kind === 'sweep', 'leaving transparent brings the photo studio back');

await done(browser, errors);
