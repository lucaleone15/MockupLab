// scripts/check-social-phone.mjs — the social phone: a phone whose screen shows an Insta post, a story or a Reel
// with the user's image inside (like the Browser model). The old “Voir sur…” frame and export option are gone.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/social-phone', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const state = () => page.evaluate(() => window.__mockuplab.project.getState());
const selected = async () => {
  const s = await state();
  return s.items.find((it) => it.id === s.selectedId);
};
/** The last screen painted for a phone app (dev hook): its size, the photo rect and the colour at the photo centre. */
const screen = () =>
  page.evaluate(() => {
    const c = window.__phoneScreens?.at(-1);
    if (!c) return null;
    const [x, y, w, h] = (c.dataset.photo ?? '0,0,0,0').split(',').map(Number);
    const px = c.getContext('2d').getImageData(Math.round(x + w / 2), Math.round(y + h / 2), 1, 1).data;
    return { app: c.dataset.app, w: c.width, h: c.height, photo: [x, y, w, h], centre: [px[0], px[1], px[2]] };
  });

// 1. the phone has the setting, off by default
const phone = await page.evaluate(async () => {
  const { getModel } = await import('/src/models/registry.ts');
  const m = getModel('phone-pro');
  const app = m.params.find((p) => p.id === 'app');
  return { app: app && { default: app.default, values: app.options.map((o) => o.value) }, aspect: m.surfaces[0].aspect };
});
check(phone.app?.default === 'none' && phone.app.values.join() === 'none,post,story,reel', `phones get « Appli à l'écran »: none, post, story, reel (${JSON.stringify(phone.app)})`);

// 2. the catalogue family adds a Phone Pro showing the post, with the sample design inside
await page.getByTestId('add-device').click();
await page.getByTestId('catalogue-family-social').click();
check((await page.locator('[data-testid^="social-card-"]').count()) === 3, 'the « Réseaux sociaux » family has three cards');
await page.getByTestId('social-card-post').click();
await page.waitForTimeout(1500);
let it = await selected();
check(it?.modelId === 'phone-pro' && it.params.app === 'post', `a Phone Pro showing a post is added (${it?.modelId}, ${it?.params.app})`);
await page.evaluate((id) => window.__mockuplab.loadSamples(id), it.id);
await page.waitForTimeout(1500);
let sc = await screen();
check(sc && sc.app === 'post' && Math.abs(sc.w / sc.h - phone.aspect) / phone.aspect < 0.01, `the screen is painted at the display's ratio (${sc && (sc.w / sc.h).toFixed(3)} vs ${phone.aspect.toFixed(3)})`);
check(sc && sc.photo[2] > 0 && Math.abs(sc.photo[2] / sc.photo[3] - 0.8) < 0.01, `the post photo is 4:5 (${sc?.photo})`);
check(sc && !sc.centre.every((v) => v > 245), `the user's image is the post photo (centre ${sc?.centre})`);
await page.screenshot({ path: 'out/social-phone/post.png' });

// 3. account and caption: only with an app, from the brand by default
await page.getByTestId('studio-rail').locator('[data-page="settings"]').click();
await page.waitForTimeout(300);
const caption = page.getByRole('textbox', { name: 'Légende' });
check(await caption.isVisible(), 'the caption field shows on the Réglages page');
await caption.fill('Le site est en ligne');
await page.getByRole('textbox', { name: 'Nom du compte' }).fill('solstice.festival');
await page.waitForTimeout(400);
it = await selected();
check(it.params.caption === 'Le site est en ligne' && it.params.account === 'solstice.festival', 'account and caption are the phone’s settings');

for (const app of ['story', 'reel']) {
  await page.evaluate(({ id, app }) => window.__mockuplab.project.getState().setParam(id, 'app', app), { id: it.id, app });
  await page.waitForTimeout(700);
  sc = await screen();
  check(sc?.app === app && !sc.centre.every((v) => v > 245), `${app}: the image fills the screen, the interface over it`);
  await page.screenshot({ path: `out/social-phone/${app}.png` });
}
await page.evaluate((id) => window.__mockuplab.project.getState().setParam(id, 'app', 'none'), it.id);
await page.waitForTimeout(300);
check(!(await caption.isVisible()), 'no caption field without an app');
await page.evaluate((id) => window.__mockuplab.project.getState().setParam(id, 'app', 'post'), it.id);

// 4. « Changer » for another phone keeps the app and its texts
await page.evaluate(async (id) => {
  const { switchModel } = await import('/src/lib/switchModel.ts');
  await switchModel(id, 'phone');
}, it.id);
await page.waitForTimeout(500);
it = await selected();
check(it.modelId === 'phone' && it.params.app === 'post' && it.params.caption === 'Le site est en ligne', `changing the phone keeps the post (${it.modelId}, ${it.params.app})`);

// 4b. the account's photo: an image of the user's, kept with the project
const red = await page.evaluate(async (id) => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff0000';
  g.fillRect(0, 0, 64, 64);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const asset = await window.__mockuplab.importAsset(new File([blob], 'avatar.png', { type: 'image/png' }));
  window.__mockuplab.project.getState().setParam(id, 'avatar', asset.id);
  return asset.id;
}, it.id);
await page.waitForTimeout(900);
const face = await page.evaluate(() => {
  const c = window.__phoneScreens.at(-1);
  const [, y] = c.dataset.photo.split(',').map(Number);
  // the post header: the avatar sits 64 px from the left, in the middle of the band above the photo
  const px = c.getContext('2d').getImageData(64, Math.round(y - (0.13 * 1080) / 2), 1, 1).data;
  return [px[0], px[1], px[2]];
});
check(face[0] > 200 && face[1] < 60 && face[2] < 60, `the account's photo shows in the post header (${face})`);
check(await page.getByRole('button', { name: /Photo du compte/ }).first().isVisible(), 'the account photo is picked on the Réglages page');
check(await page.evaluate((red) => window.__mockuplab.persistence.referencedAssets(window.__mockuplab.project.getState()).has(red), red), 'the account photo is saved with the project');

// 4b'. framing it: dragging the preview moves the crop, zoom and « logo entier »
const preview = page.getByTestId('avatar-preview');
check(await preview.isVisible(), 'the account photo shows in a round preview');
await page.evaluate(async (id) => {
  // a wide picture (red left half, blue right half) so the crop can move sideways
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff0000';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#0000ff';
  g.fillRect(64, 0, 64, 64);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const asset = await window.__mockuplab.importAsset(new File([blob], 'wide.png', { type: 'image/png' }));
  window.__mockuplab.project.getState().setParam(id, 'avatar', asset.id);
}, it.id);
await page.waitForTimeout(500);
const pb = await preview.boundingBox();
await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.mouse.down();
await page.mouse.move(pb.x + pb.width / 2 - 40, pb.y + pb.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(700);
it = await selected();
check(it.params.avatarX > 0.9, `dragging left shows the right of the picture (x ${it.params.avatarX})`);
const disc = await page.evaluate(() => {
  const c = window.__phoneScreens.at(-1);
  const [, y] = c.dataset.photo.split(',').map(Number);
  const px = c.getContext('2d').getImageData(77, Math.round(y - (0.13 * 1080) / 2), 1, 1).data;
  return [px[0], px[1], px[2]];
});
check(disc[2] > 200 && disc[0] < 60, `the painted disc shows the framed part (${disc})`);
await page.getByRole('radio', { name: 'Logo entier' }).click();
await page.waitForTimeout(600);
const white = await page.evaluate(() => {
  const c = window.__phoneScreens.at(-1);
  const [, y] = c.dataset.photo.split(',').map(Number);
  const cy = Math.round(y - (0.13 * 1080) / 2);
  // just inside the disc's top edge: the white around a whole logo
  const px = c.getContext('2d').getImageData(77, cy - 40, 1, 1).data;
  return [px[0], px[1], px[2]];
});
check((await selected()).params.avatarFit === 'whole' && white.every((v) => v > 240), `« Logo entier » shows it whole on white (${white})`);

// 4c. the same on its own, like the browser window
await page.getByTestId('studio-rail').locator('[data-page="devices"]').click();
await page.getByTestId('add-device').click();
await page.getByTestId('catalogue-family-social').click();
check((await page.locator('[data-testid^="social-alone-"]').count()) === 3, 'three cards on their own (post, story, Reel)');
await page.getByTestId('social-alone-story').click();
await page.waitForTimeout(1500);
const card = await selected();
check(card.modelId === 'social-card' && card.params.app === 'story', `a story on its own is added (${card.modelId}, ${card.params.app})`);
const cs = await screen();
check(cs && Math.abs(cs.w / cs.h - 9 / 16) < 0.01, `it is painted at 9:16 (${cs && (cs.w / cs.h).toFixed(3)})`);
await page.screenshot({ path: 'out/social-phone/alone.png' });
await page.evaluate((id) => window.__mockuplab.project.getState().removeItem(id), card.id);
await page.evaluate((id) => window.__mockuplab.project.getState().selectItem(id), it.id);

// 5. the old frame and its export option are gone; the floating bar offers « Formats »
check((await page.getByTestId('social-frame').count()) === 0, 'no interface frame around the scene');
await page.getByTestId('format-menu').click();
await page.waitForTimeout(200);
check((await page.locator('[data-testid^="see-on-"]').count()) === 0, 'no « Voir sur… » choices');
check(await page.getByRole('menuitemradio', { name: /^16:9/ }).isVisible(), 'the Format menu has the proportions');
check((await page.getByRole('menuitemradio', { name: /Post carré/ }).count()) === 0, 'the square post is not listed twice (it is 1:1)');
check(await page.getByRole('menuitemradio', { name: /Post Insta/ }).first().isVisible(), 'the Format menu has the exact social sizes');
await page.getByRole('menuitemradio', { name: /^Story/ }).click();
await page.waitForTimeout(200);
check((await state()).export.ratio === 'story', 'a format sets the export size');
await page.keyboard.press('Escape');
await page.getByTestId('top-export').click();
await page.getByTestId('export-tab-image').click();
check((await page.getByTestId('export-with-interface').count()) === 0, 'no « avec l’interface » export option');
await page.keyboard.press('Escape');

// 6. an old project's social texts move to its phones
const migrated = await page.evaluate(() => {
  const api = window.__mockuplab;
  const snap = api.persistence.snapshot();
  // saved before the social phone: no app texts on the phones
  const items = snap.items.map(({ params: { account, caption, app, ...params }, ...it }) => ({ ...it, params }));
  const p = api.persistence.migrateProject({ ...snap, items, social: { network: 'ig-post', account: '@ancien', caption: 'vieux texte', title: '', withInterface: true } });
  return { social: 'social' in p, params: p.items.map((i) => i.params) };
});
check(!migrated.social && migrated.params.every((p) => p.account === '@ancien' && p.caption === 'vieux texte'), `an old project's account and caption go to its phones (${JSON.stringify(migrated)})`);

// 7. the export still renders the phone
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ format: 'png', resolution: '1080' }));
const out = await page.evaluate(async () => {
  const { width, height } = await window.__mockuplab.renderImage();
  return { width, height };
});
check(out.width === 1080 && out.height === 1920, `the story-size export renders (${out.width} × ${out.height})`);

await done(browser, errors);
