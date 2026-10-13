// scripts/check-social.mjs — social formats (exact pixel sizes, safe zones), Reel/TikTok video preset, Instagram carousel.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const exportSize = () => page.evaluate(async () => {
  const r = await window.__mockuplab.renderImage();
  return [r.width, r.height];
});
const pick = async (name) => {
  await page.getByRole('button', { name: /Réseaux/ }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(name) }).click();
  await page.waitForTimeout(250);
};
const expected = [['Post Insta', 1080, 1350], ['Post carré', 1080, 1080], ['Story · Reel · TikTok', 1080, 1920], ['YouTube', 1920, 1080], ['LinkedIn', 1200, 627], ['Pinterest', 1000, 1500]];
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ resolution: '1080', format: 'png' }));
for (const [name, w, h] of expected) {
  await pick(name);
  const [ew, eh] = await exportSize();
  check(ew === w && eh === h, `${name}: exported ${ew} × ${eh} (expected ${w} × ${h})`);
}
// safe zones for vertical formats, shown on the stage only
await pick('Story · Reel · TikTok');
await page.getByRole('button', { name: 'Zones de sécurité' }).click();
await page.waitForTimeout(200);
check(await page.getByTestId('safe-zones').isVisible().catch(() => false), 'Story: safe zones shown over the stage');
const inExport = await page.evaluate(async () => {
  const r = await window.__mockuplab.renderImage();
  const bmp = await createImageBitmap(r.blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  // the zones are drawn in a vivid magenta on screen: none of it in the file
  const d = c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i] > 230 && d[i + 1] < 60 && d[i + 2] > 180) n++;
  return n;
});
check(inExport === 0, 'safe zones are never exported');
// Quick offers the social formats too
await page.evaluate(() => { history.pushState(null, '', '/rapide'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(400);
check((await page.getByRole('button', { name: 'Post Insta' }).count()) > 0 && (await page.getByRole('button', { name: /Story/ }).count()) > 0, 'Quick offers Post Insta and Story');
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);

await done(browser, errors);
