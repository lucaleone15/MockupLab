// scripts/check-simplify.mjs — feedback of 2026-10-20: the last device can be removed (empty scene),
// devices lay themselves out, ready-made scenes, a short Light page, the first-visit guide.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/simplify', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const shot = (name) => page.screenshot({ path: `out/simplify/${name}.png` });
const items = () => page.evaluate(() => window.__mockuplab.project.getState().items.map((it) => ({ id: it.id, model: it.modelId, x: it.position[0], z: it.position[2], yaw: it.rotation[1], img: Object.values(it.surfaces).map((b) => b.assetId).find(Boolean) ?? null })));
const rail = (name) => page.getByTestId('studio-rail').getByRole('tab', { name, exact: true }).click();

// 1. the last device can be deleted: the scene is empty and says so
await rail('Appareils');
await page.getByTestId('rail-page').getByText('Phone Pro', { exact: true }).first().hover();
await page.getByTestId('rail-page').getByRole('button', { name: 'Supprimer', exact: true }).first().click();
await page.waitForTimeout(400);
check((await items()).length === 0, 'the only device can be deleted');
check(await page.getByTestId('empty-scene').isVisible(), 'an empty scene says so');
await shot('empty-scene');
await rail('Lumière');
await page.getByTestId('empty-scene').getByRole('button', { name: 'Ajouter un appareil' }).click();
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'devices', '“Add a device” opens the Devices page');

// 2. an image pasted into an empty scene brings the device that suits it
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 1000;
  c.getContext('2d').fillStyle = '#3a6df0';
  c.getContext('2d').fillRect(0, 0, 1600, 1000);
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'site.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(1200);
let list = await items();
check(list.length === 1 && !!list[0].img, `a pasted image in an empty scene adds a device with it (${list.map((i) => i.model)})`);

// 3. added devices lay themselves out (centred, no overlap)
await page.evaluate(() => window.__mockuplab.project.getState().removeItem(window.__mockuplab.project.getState().items[0].id));
const addFrom = async (family, name) => {
  await page.getByTestId('add-device').click();
  await page.getByTestId(`catalogue-family-${family}`).click();
  await page.getByTestId('catalogue').getByRole('button', { name, exact: true }).click();
};
const pickComposition = async (id) => {
  await page.getByTestId('add-device').click();
  await page.getByTestId('catalogue-family-several').click();
  await page.getByTestId(`composition-${id}`).click();
};
for (let i = 0; i < 3; i++) await addFrom('phone', 'Phone Pro');
await page.waitForTimeout(600);
list = await items();
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
check(list.length === 3 && Math.abs(dist(list[0], list[1]) - dist(list[1], list[2])) < 0.3 && dist(list[0], list[1]) > 8, `three added phones are evenly spaced, without overlapping (${dist(list[0], list[1]).toFixed(1)}, ${dist(list[1], list[2]).toFixed(1)})`);
await shot('three-added');
// layouts
await page.getByTestId('rail-page').getByRole('radio', { name: 'En ligne' }).click();
await page.waitForTimeout(800);
list = await items();
const line = Math.abs((list[1].x - list[0].x) * (list[2].z - list[0].z) - (list[1].z - list[0].z) * (list[2].x - list[0].x));
check(Math.abs(dist(list[0], list[1]) - dist(list[1], list[2])) < 0.01 && line < 0.01, `“In a row”: evenly spaced on one line (${dist(list[0], list[1]).toFixed(1)})`);
await shot('layout-row');
for (const [label, name] of [['Éventail', 'fan'], ['Cascade', 'cascade'], ['Équilibrée', 'auto']]) {
  await page.getByTestId('rail-page').getByRole('radio', { name: label }).click();
  await page.waitForTimeout(800);
  check((await page.evaluate(() => window.__mockuplab.project.getState().arrangement)) === name, `layout ${name} applied`);
  await shot(`layout-${name}`);
}

// 4. ready-made scenes keep the devices already there, with their images
await page.evaluate(() => window.__mockuplab.loadSamples(window.__mockuplab.project.getState().items[0].id));
await page.waitForTimeout(800);
for (const id of ['phones-2', 'phones-3', 'phones-3-row', 'phones-4', 'phones-5', 'laptop-phone', 'laptop-tablet-phone', 'all-screens']) {
  await pickComposition(id);
  await page.waitForTimeout(1500);
  await shot(`composition-${id}`);
}
list = await items();
check(list.length === 4 && list.some((i) => i.model.startsWith('phone') && i.img), `“Every screen”: 4 devices, the phone keeps its image (${list.map((i) => i.model)})`);
await pickComposition('phones-5');
await page.waitForTimeout(800);
list = await items();
check(list.length === 5 && list.every((i) => i.img), `“5 phones”: every phone has an image to start from (${list.filter((i) => i.img).length}/5)`);
check(Math.abs(dist(list[0], list[2]) - dist(list[4], list[2])) < 0.01, 'the fan is symmetric');

// 5. Light: a few clear choices, the rest folded under Advanced settings
await rail('Lumière');
await page.waitForTimeout(300);
const panel = page.getByTestId('rail-page');
check(!(await panel.getByText('Hauteur', { exact: true }).isVisible().catch(() => false)), 'Light: fine settings folded by default');
await panel.getByRole('radio', { name: 'De côté' }).click();
const light = await page.evaluate(() => window.__mockuplab.project.getState().lighting);
check(light.elevation < 40 && light.azimuth < -60, `“From the side” moves the key light (${light.azimuth}°, ${light.elevation}°)`);
check(await panel.getByRole('radio', { name: 'De côté' }).getAttribute('aria-checked') === 'true', '“From the side” shows as chosen');
await shot('light');
await panel.getByRole('button', { name: 'Paramètres avancés' }).click();
check(await panel.getByText('Hauteur', { exact: true }).isVisible(), 'Advanced settings unfold');
await shot('light-advanced');

// 6. the guide: from the ⋯ menu, every step, then remembered
await page.getByTestId('more-menu').click();
await page.getByTestId('start-tour').click();
await page.waitForTimeout(500);
check(await page.getByTestId('tour').isVisible(), 'the guide opens from the ⋯ menu');
let n = 0;
while (await page.getByTestId('tour').isVisible().catch(() => false)) {
  await page.waitForTimeout(350);
  await shot(`tour-${String(++n).padStart(2, '0')}`);
  await page.getByTestId('tour-next').click();
  if (n > 20) break;
}
check(n === 13, `the guide has 13 steps (${n})`);
check((await page.evaluate(() => localStorage.getItem('mockuplab:tour'))) === '1', 'a finished guide is remembered');
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'devices', 'the guide ends on the Devices page');
await done(browser, errors);
