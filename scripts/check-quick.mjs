// scripts/check-quick.mjs — Quick mode: support detection, live gallery, download, customize, more ideas.
import { openApp, check, done, viaFileDialog } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
// 1. detection table (spec § 5)
const table = [
  [1179, 2556, 'phone'],
  [2480, 3508, 'print'],
  [1440, 900, 'laptop'],
  [1440, 5200, 'browser'],
  [400, 440, 'watch'],
  [3000, 1000, 'screen'],
  [1536, 2048, 'tablet'],
  [1700, 1100, 'print'],
  [3024, 1964, 'laptop'],
  [2880, 1800, 'laptop'],
  [750, 1334, 'phone'],
  [1242, 2208, 'phone'],
  [1200, 675, 'laptop'],
  [2400, 1350, 'laptop'],
  [5120, 2880, 'laptop'],
  [2944, 1904, 'laptop'],
];
for (const [w, h, want] of table) {
  const got = await page.evaluate(([w, h]) => window.__mockuplab.quick.detectSupport(w, h), [w, h]);
  check(got.support === want, `${w}×${h} → ${want} (${got.support})`);
}
const near = await page.evaluate(() => window.__mockuplab.quick.detectSupport(1150, 1000));
check(near.confident === false, '1150×1000 sits near a boundary → to confirm');
const named = await page.evaluate(() => window.__mockuplab.quick.detectSupport(1440, 900, false, 'carte-de-visite-recto.png'));
check(named.support === 'print', 'a file named like a business card → print');
for (const [w, h, name, want] of [[1170, 2532, 'menu-screen.png', 'phone'], [1440, 900, 'sprint-board.png', 'laptop'], [1440, 900, 'fingerprint.png', 'laptop'], [1440, 900, 'card-component.png', 'laptop'], [1440, 900, 'carte-du-site.png', 'laptop']]) {
  const got = await page.evaluate(([w, h, n]) => window.__mockuplab.quick.detectSupport(w, h, false, n), [w, h, name]);
  check(got.support === want, `${name} ${w}×${h} → ${want} (${got.support})`);
}
check((await page.evaluate(() => window.__mockuplab.quick.detectSupport(1440, 900, false, 'carte-de-visite-recto.png'))).confident === false, 'a print guessed from the name is still to confirm');
const flyer = await page.evaluate(() => window.__mockuplab.quick.detectSupport(1920, 1080, false, 'Flyer_A5.jpg'));
check(flyer.support === 'print', 'a file named like a flyer → print');
const cardModel = await page.evaluate(() => [window.__mockuplab.quick.modelForSupport('print', 1700, 1100), window.__mockuplab.quick.modelForSupport('print', 1414, 2000)]);
check(cardModel[0] === 'business-card' && cardModel[1] === 'poster', `a card-shaped print goes on a business card, a tall one on a poster (${cardModel})`);
const pdf = await page.evaluate(() => window.__mockuplab.quick.detectSupport(1000, 1000, true));
check(pdf.support === 'print', 'PDF → print');
// 2. the gallery renders with a sample, without an image of ours
const before = await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((it) => it.modelId)));
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForSelector('[data-testid=quick-screen]');
const tiles = page.getByTestId('quick-tile');
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 12, null, { timeout: 120000 }).catch(() => {});
check((await page.locator('[data-testid=quick-tile] img').count()) >= 12, `≥ 12 ready-made mock-ups rendered (${await page.locator('[data-testid=quick-tile] img').count()})`);
// leaving during a render keeps the user's project intact
await page.getByTestId('quick-filter').getByRole('button', { name: 'Sombre' }).click();
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(800);
check((await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((it) => it.modelId)))) === before, 'leaving Quick mid-render leaves the project as it was');
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForSelector('[data-testid=quick-screen]');
await page.getByTestId('quick-filter').getByRole('button', { name: 'Tous' }).click();
// 3. our own design: a website screenshot → laptop
const chooser = await viaFileDialog(page, () => page.getByTestId('quick-pick').click());
await chooser.setFiles('public/samples/sample-web.png');
await page.waitForTimeout(500);
check((await page.getByTestId('quick-support').getByRole('button', { pressed: true }).textContent()).trim() === 'Ordinateur', 'website screenshot detected as Ordinateur');
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 3, null, { timeout: 60000 }).catch(() => {});
// 4. download one
await tiles.first().hover();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), tiles.first().getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `tile downloads an image (${dl.suggestedFilename()})`);
// 5. more ideas
const n0 = await tiles.count();
await page.getByRole('button', { name: /Plus d’idées/ }).click();
await page.waitForTimeout(300);
check((await tiles.count()) === n0 + 6, `more ideas adds 6 tiles (${n0} → ${await tiles.count()})`);
// 6. customize → studio with the laptop and our image
await tiles.nth(1).hover();
await tiles.nth(1).getByRole('button', { name: /Affiner dans le Studio/ }).click();
await page.waitForTimeout(1500);
const st = await page.evaluate(() => {
  const api = window.__mockuplab;
  const p = api.project.getState();
  return { screen: api.ui.getState().screen, model: p.items[0].modelId, image: api.assetName(Object.values(p.items[0].surfaces)[0].assetId) };
});
check(st.screen === 'studio' && st.model === 'laptop-14' && st.image === 'sample-web.png', `customize opens the studio with that mock-up (${JSON.stringify(st)})`);
await done(browser, errors);
