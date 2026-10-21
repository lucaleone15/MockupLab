// scripts/check-social.mjs — social formats (exact pixel sizes), a vertical video from the format, perfect loop.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const exportSize = () => page.evaluate(async () => {
  const r = await window.__mockuplab.renderImage();
  return [r.width, r.height];
});
const pick = async (name) => {
  await page.getByTestId('format-menu').click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
};
// the exact social sizes, in the Format menu (the square post is the 1:1 proportion, not listed twice)
const expected = [['Post Insta', 1080, 1350], ['Story', 1080, 1920], ['YouTube', 1920, 1080], ['LinkedIn', 1200, 627], ['Pinterest', 1000, 1500]];
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ resolution: '1080', format: 'png' }));
for (const [name, w, h] of expected) {
  await pick(name);
  const [ew, eh] = await exportSize();
  check(ew === w && eh === h, `${name}: exported ${ew} × ${eh} (expected ${w} × ${h})`);
}
// Quick offers the social formats too
await page.evaluate(() => { history.pushState(null, '', '/rapide'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(400);
check((await page.getByRole('button', { name: 'Post Insta' }).count()) > 0 && (await page.getByRole('button', { name: /Story/ }).count()) > 0, 'Quick offers Post Insta and Story');
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);

// a vertical video comes from the Story · Reel format; the Export window has no « Reel » preset any more
await page.getByTestId('format-menu').click();
await page.getByRole('menuitemradio', { name: /^Story · Reel/ }).click();
await page.keyboard.press('Escape');
await page.getByTestId('top-export').click();
await page.getByTestId('export-tab-video').click();
await page.waitForTimeout(200);
check((await page.getByRole('button', { name: 'Reel / TikTok' }).count()) === 0, 'no « Reel / TikTok » preset in the video tab');
await page.getByTestId('export-sheet').getByRole('radio', { name: '1080p', exact: true }).click();
const out = await page.getByTestId('video-output').innerText();
check(/^1080 × 1920/.test(out), `the vertical format gives a 1080 × 1920 video (${out})`);
for (const g of ['Le mouvement', 'La durée', 'Le fichier']) check(await page.getByRole('heading', { name: g }).isVisible(), `the video tab reads in groups: « ${g} »`);
for (const d of ['6 s', '10 s', '15 s']) check(await page.getByRole('radio', { name: d, exact: true }).isVisible().catch(() => false), `duration ${d} offered`);

await page.getByRole('switch', { name: 'Boucle parfaite' }).click();
const gap = await page.evaluate(async () => {
  const A = await window.__mockuplab.animations();
  const p = window.__mockuplab.project.getState();
  const def = A.ANIMATIONS.find((a) => a.id === 'reveal');
  const rig = A.rigFor(def, p.export.video);
  const cam = window.__mockuplab.bridge().camera;
  rig.at(0);
  const a = cam.position.clone();
  rig.at(1);
  const b = cam.position.clone();
  rig.at(0.5);
  const mid = cam.position.clone();
  return [a.distanceTo(b), a.distanceTo(mid)];
});
check(gap[0] < 0.5 && gap[1] > 5, `perfect loop: the last frame is the first (${gap[0].toFixed(2)}), the middle moves (${gap[1].toFixed(1)})`);
await page.keyboard.press('Escape');
// perfect loop on a montage: the motion-blur instants of a shot never wrap to its end
const samples = await page.evaluate(async () => {
  const A = await window.__mockuplab.animations();
  return [A.shutterTimes(0, 6, 1 / 299, 1, false), A.shutterTimes(0, 6, 1 / 300, 1, true)];
});
check(samples[0].every((t) => t >= 0 && t < 0.05), `montage shot at its start: blur instants stay at its start (${samples[0].map((t) => t.toFixed(3)).join(' ')})`);
check(samples[1].some((t) => t > 0.9), 'a shot that loops by itself still wraps its blur instants around the seam');
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ format: 'png', quality: 0.92 }));
await done(browser, errors);
