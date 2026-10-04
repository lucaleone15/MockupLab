// Photo mode on your own photos: import, double-click detection, samples, export,
// and a second double-click on the zone (next suggestion).
// PHOTOS='[["path.jpg",[x,y]],…]' node scripts/check-photo-own.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
mkdirSync('out/photo/own', { recursive: true });
const cases = JSON.parse(process.env.PHOTOS ?? '[["public/assets/photo/marble-duo.jpg",[0.42,0.62]]]');
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => window.__mockuplab?.photo);
await p.getByTestId('mode-switch').getByRole('radio', { name: 'Photo' }).click();
for (const [file, seed] of cases) {
  const name = basename(file).replace(/\.[a-z]+$/, '');
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('photo-library').getByRole('button', { name: 'Importer ma photo' }).click()]);
  await chooser.setFiles(file);
  await p.waitForTimeout(900);
  await p.keyboard.press('Escape');
  const box = await p.getByTestId('zone-editor').boundingBox();
  const at = (x, y) => [box.x + x * box.width, box.y + y * box.height];
  const t0 = Date.now();
  await p.mouse.dblclick(...at(...seed));
  await p.waitForFunction(() => window.__mockuplab.project.getState().photo.zones.length > 0, null, { timeout: 15000 }).catch(() => {});
  const ms = Date.now() - t0;
  await p.evaluate(() => window.__mockuplab.photo.loadSamples());
  await p.waitForTimeout(700);
  await p.screenshot({ path: `out/photo/own/${name}-ui.png` });
  const res = await p.evaluate(async () => {
    const r = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  writeFileSync(`out/photo/own/${name}.png`, Buffer.from(res, 'base64'));
  // next suggestion
  const before = await p.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().photo.zones[0]?.corners));
  await p.mouse.dblclick(...at(...seed));
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().photo.zones[0]?.corners));
  console.log(name.padEnd(30), `${ms} ms`, 'zones', await p.evaluate(() => window.__mockuplab.project.getState().photo.zones.length), 'next suggestion changed:', before !== after);
}
console.log('errors:', errors.join('\n') || 'none');
await b.close();
