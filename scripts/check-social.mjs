// scripts/check-social.mjs — social formats (exact pixel sizes, safe zones), Reel/TikTok video preset, Instagram carousel.
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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

// Reel / TikTok video preset, and a perfect loop for a cinematic shot
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Vidéo', exact: true }).click();
await page.getByRole('button', { name: 'Reel / TikTok' }).click();
await page.waitForTimeout(200);
const v = await page.evaluate(() => { const e = window.__mockuplab.project.getState().export; return { ratio: e.ratio, ...e.video }; });
check(v.ratio === 'story' && v.resolution === '1080' && v.fps === 30 && v.duration === 10 && v.format === 'mp4', `Reel / TikTok preset: ${JSON.stringify(v)}`);
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
// Instagram carousel: a strip of slides with cut guides, devices spread one per slide, a ZIP of slides
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Appareils', exact: true }).click();
await page.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  s.resetAll();
  s.addItem('phone-pro');
  s.addItem('phone-pro');
  s.addItem('phone-pro');
  s.setExport({ kind: 'image', format: 'png', resolution: '1080' });
});
await page.getByRole('button', { name: /Réseaux/ }).click();
await page.getByRole('menuitemradio', { name: /Carrousel Insta/ }).click();
await page.waitForTimeout(300);
const box = await page.getByTestId('frame').boundingBox();
check(Math.abs(box.width / box.height - 2.4) < 0.05, `carousel of 3 slides 4:5: a 2.4:1 strip (${(box.width / box.height).toFixed(2)})`);
check((await page.getByTestId('carousel-cut').count()) === 2, 'two cut guides between the three slides');
await page.getByRole('button', { name: 'Ajouter une slide' }).click();
await page.waitForTimeout(200);
check((await page.evaluate(() => window.__mockuplab.project.getState().export.ratio)) === 'c4-4x5', 'a slide can be added');
await page.getByRole('button', { name: 'Retirer une slide' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Disposer' }).click();
await page.waitForTimeout(400);
const xs = await page.evaluate(() => window.__mockuplab.project.getState().items.map((i) => i.position[0]).sort((a, b) => a - b));
check(xs[1] - xs[0] > 12 && xs[2] - xs[1] > 12 && Math.abs(xs[1] - xs[0] - (xs[2] - xs[1])) < 1, `Arrange spreads the devices evenly along the strip (${xs.map(Math.round)})`);
mkdirSync('out/social', { recursive: true });
await page.getByRole('button', { name: 'Exporter' }).first().click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('button', { name: 'Télécharger', exact: true }).click()]);
await dl.saveAs('out/social/' + dl.suggestedFilename());
const list = /\.zip$/.test(dl.suggestedFilename()) ? execSync(`unzip -Z1 out/social/${dl.suggestedFilename()}`).toString().trim().split('\n') : [];
check(JSON.stringify(list) === JSON.stringify(['01.png', '02.png', '03.png']), `carousel export: a ZIP of slides (${dl.suggestedFilename()}: ${list.join(', ')})`);
if (list.length) {
  execSync(`rm -rf out/social/slides && mkdir -p out/social/slides && unzip -o -q out/social/${dl.suggestedFilename()} -d out/social/slides`);
  const dims = execSync('sips -g pixelWidth -g pixelHeight out/social/slides/01.png').toString().match(/\d+/g).slice(-2).join('×');
  check(dims === '1080×1350', `each slide is 1080 × 1350 (${dims})`);
}
await done(browser, errors);
