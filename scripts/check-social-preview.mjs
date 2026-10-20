// scripts/check-social-preview.mjs — “Voir sur…”: the mock-up inside a generic post, story, TikTok or YouTube
// interface, exportable with it; the carousel and the safe-zone guides are gone.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/social2', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const state = () => page.evaluate(() => window.__mockuplab.project.getState());

// 1. no carousel any more: an old carousel project opens as an Insta post
const migrated = await page.evaluate(() => {
  const api = window.__mockuplab;
  const p = api.persistence.migrateProject({ ...api.persistence.snapshot(), export: { ...api.project.getState().export, ratio: 'c3-4x5' } });
  return p.export.ratio;
});
check(migrated === 'ig-post', `an old carousel project becomes an Insta post (${migrated})`);
await page.getByTestId('floating-bar').getByRole('button', { name: /Réseaux|Voir sur/ }).click();
await page.waitForTimeout(200);
check((await page.getByRole('menuitemradio', { name: /Carrousel/ }).count()) === 0, 'no carousel in the menu');
await page.keyboard.press('Escape');
check((await page.locator('[data-testid="safe-zones"]').count()) === 0 && (await page.getByRole('button', { name: /Zones de sécurité|Zones sûres/ }).count()) === 0, 'no safe-zone guides');

// 2. “Voir sur…”: the mock-up inside a generic interface of the network
await page.getByRole('button', { name: 'Essayer un exemple' }).click();
await page.waitForTimeout(1500);
const open = async () => {
  await page.getByTestId('floating-bar').getByRole('button', { name: /Voir sur/ }).click();
  await page.waitForTimeout(150);
};
await open();
await page.getByRole('textbox', { name: 'Légende' }).fill('Le nouveau site est en ligne');
await page.getByTestId('see-on-ig-post').click();
await page.waitForTimeout(500);
let st = await state();
check(st.export.ratio === 'ig-post' && st.social.network === 'ig-post', 'Insta post: the 4:5 post format and its interface');
const frame = page.getByTestId('social-frame');
check(await frame.isVisible(), 'the interface shows around the scene');
const label = (await frame.getAttribute('aria-label')) ?? '';
check(label.includes('@solstice') && label.includes('Le nouveau site est en ligne'), `the account comes from the brand, the caption from the menu (${label})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: 'out/social2/ig-post.png' });
for (const n of ['story', 'tiktok', 'youtube']) {
  await open();
  await page.getByTestId(`see-on-${n}`).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  st = await state();
  check(st.social.network === n && st.export.ratio === { story: 'story', tiktok: 'story', youtube: 'youtube' }[n], `${n}: its format and interface`);
  await page.screenshot({ path: `out/social2/${n}.png` });
}
check(!/instagram|tiktok|youtube/i.test(await page.getByTestId('social-frame').evaluate((el) => el.innerText)), 'no network name written in the interface');
// export: without the interface by default, with it when asked
await open();
await page.getByTestId('see-on-ig-post').click();
await page.keyboard.press('Escape');
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ format: 'png', resolution: '1080' }));
const size = () =>
  page.evaluate(async () => {
    const { blob } = await window.__mockuplab.renderImage();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const px = c.getContext('2d').getImageData(Math.round(bmp.width / 2), 4, 1, 1).data;
    return { w: bmp.width, h: bmp.height, top: [px[0], px[1], px[2]] };
  });
const plain = await size();
check(plain.w === 1080 && plain.h === 1350, `without the interface: the 1080 × 1350 post (${plain.w} × ${plain.h})`);
await page.getByTestId('top-export').click();
await page.getByTestId('export-tab-image').click();
const box = page.getByTestId('export-with-interface');
check(await box.isVisible(), 'the Export window offers “with the network interface”');
await box.click();
await page.keyboard.press('Escape');
const framed = await size();
check(framed.w === 1080 && framed.h > 1500 && framed.top.every((v) => v > 240), `with it: the post with its header and caption, white header (${framed.w} × ${framed.h}, top ${framed.top})`);
await page.evaluate(() => window.__mockuplab.project.getState().setSocial({ withInterface: false }));
// back to a plain format: the interface goes
await open();
await page.getByTestId('see-on-none').click();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check((await page.getByTestId('social-frame').count()) === 0 && (await state()).social.network === null, '“None” removes the interface');
await page.getByTestId('floating-bar').getByRole('radio', { name: '16:9' }).click();
check((await state()).export.ratio === '16:9', 'a plain ratio still works');

await done(browser, errors);
