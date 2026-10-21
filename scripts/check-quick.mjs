// scripts/check-quick.mjs — Quick mode: support detection, a background colour, six studio photos, download, customize.
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
// 2. six studio photos in a colour, with a sample, without an image of ours
const before = await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((it) => it.modelId)));
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForSelector('[data-testid=quick-screen]');
const tiles = page.getByTestId('quick-tile');
const swatches = page.getByTestId('quick-color').getByRole('radio');
check((await swatches.count()) === 9, `nine studio colours (${await swatches.count()})`);
check(await page.getByLabel('Autre couleur').isVisible().catch(() => false), 'a free colour: “Autre couleur”');
const labels = (await tiles.locator('span.truncate').allTextContents()).map((x) => x.trim());
check(JSON.stringify(labels) === JSON.stringify(['Face', 'Trois-quarts', 'Sur podium', 'Vu de dessus', 'Deux appareils', 'Gros plan']), `six studio shots (${labels.join(', ')})`);
check((await page.getByTestId('quick-filter').count()) === 0 && (await page.getByRole('button', { name: /Plus d’idées/ }).count()) === 0, 'no ambience filters, no “more ideas”');
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length === 6, null, { timeout: 120000 }).catch(() => {});
check((await page.locator('[data-testid=quick-tile] img').count()) === 6, `all six rendered (${await page.locator('[data-testid=quick-tile] img').count()})`);
// leaving during a render keeps the user's project intact
await swatches.nth(1).click();
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(800);
check((await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((it) => it.modelId)))) === before, 'leaving Quick mid-render leaves the project as it was');
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForSelector('[data-testid=quick-screen]');
// what each shot stages (the real project is used: customize opens it in the Studio)
const staged = (id) =>
  page.evaluate(async (id) => {
    const api = window.__mockuplab;
    await api.quick.customize(id, () => {});
    const p = api.project.getState();
    const b = p.background;
    return { decor: p.decor.kind, finish: p.decor.podiumFinish, arch: p.decor.arch, items: p.items.length, camera: p.camera.preset, zoom: p.camera.zoom ?? 1, stops: b.kind === 'gradient' ? b.stops.map((s) => s.color.toLowerCase()) : [b.color] };
  }, id);
const front = await staged('front');
check(front.decor === 'sweep' && front.camera === 'front' && front.items === 1, `Face: one device on a studio sweep, from the front (${JSON.stringify(front)})`);
const podium = await staged('podium');
check(podium.decor === 'podium' && podium.finish === 'paint' && !podium.arch, `Sur podium: a painted podium, no arch (${JSON.stringify(podium)})`);
const top = await staged('top');
check(top.camera === 'top', `Vu de dessus: a phone lies flat, seen from above (${top.camera})`);
const pair = await staged('pair');
check(pair.items === 2, `Deux appareils: two devices (${pair.items})`);
const close = await staged('close');
check(close.zoom > 1.2, `Gros plan: the camera comes closer (zoom ${close.zoom})`);
// a colour drives every photo's background
await page.getByRole('radio', { name: 'Bleu nuit' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length === 6, null, { timeout: 120000 }).catch(() => {});
const keys = await page.evaluate(() => Object.values(window.__mockuplab.quick.state().thumbKeys));
check(keys.length === 6 && keys.every((k) => k.endsWith('#1f2a44')), `every thumbnail shows the picked colour (${keys.length})`);
const night = await staged('front');
check(night.stops.at(-1) === '#1f2a44', `“Bleu nuit” paints the studio (${night.stops.join(' → ')})`);
await page.evaluate(() => window.__mockuplab.quick.start());
// 3. our own design: a website screenshot → laptop, detected
const chooser = await viaFileDialog(page, () => page.getByTestId('quick-pick').click());
await chooser.setFiles('public/samples/sample-web.png');
await page.waitForTimeout(500);
check(/Ordinateur.*détecté/.test(await page.getByTestId('quick-device').textContent()), `website screenshot detected as Ordinateur (${await page.getByTestId('quick-device').textContent()})`);
await page.getByTestId('quick-device').getByRole('button', { name: 'Changer' }).click();
check((await page.getByTestId('quick-support').getByRole('button', { pressed: true }).textContent()).trim() === 'Ordinateur', '“Changer” lists the supports, Ordinateur chosen');
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 3, null, { timeout: 60000 }).catch(() => {});
// 4. download one
await tiles.first().hover();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), tiles.first().getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `tile downloads an image (${dl.suggestedFilename()})`);
// 5. customize → studio with the laptop and our image
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
