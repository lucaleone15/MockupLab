// Walls & placement: wall objects share one wall, nothing goes behind it, grazing drags stay sane.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('out/walls', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => indexedDB.deleteDatabase('mockuplab'));
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(800);
const render = async (name) => {
  const d = await p.evaluate(async () => {
    const img = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await img.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  writeFileSync(`out/walls/${name}.png`, Buffer.from(d, 'base64'));
};
const state = () => p.evaluate(() => window.__mockuplab.project.getState().items.map((i) => ({ m: i.modelId, x: Math.round(i.position[0] * 10) / 10, z: Math.round(i.position[2] * 10) / 10, yaw: Math.round(i.rotation[1] * 100) / 100 })));

// TV on the wall + poster + phone: one wall, phone in front of it.
await p.evaluate(async () => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  st().setExport({ resolution: '1080', ratio: '16:9', format: 'png' });
  st().replaceModel(st().selectedId, 'tv');
  st().addItem('poster');
  st().addItem('phone-pro');
  // try to push the phone far behind the wall
  const phone = st().items[2].id;
  st().updateItem(phone, { position: [10, 0, -80] });
  for (const it of st().items) await api.loadSamples(it.id);
  api.ui.getState().resetView();
});
console.log('after push behind wall:', JSON.stringify(await state()));
await p.waitForTimeout(2000);
await render('wall-trio');

// Grazing drag on the TV: move the mouse 120 px right, the TV must slide sideways (not jump in depth).
await p.evaluate(() => window.__mockuplab.ui.getState().resetView());
await p.waitForTimeout(800);
const box = await p.locator('[data-testid=frame] canvas').first().boundingBox();
const pt = await p.evaluate(({ box }) => {
  const { picking, project } = window.__mockuplab;
  const tv = project.getState().items[0].id;
  for (let dy = -box.height / 2; dy < box.height / 2; dy += 15) for (let dx = -box.width / 2; dx < box.width / 2; dx += 15) {
    const x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
    if (picking.item(x, y) === tv) return { x, y };
  }
  return null;
}, { box });
const before = (await state())[0];
if (pt) {
  await p.mouse.move(pt.x, pt.y);
  await p.mouse.down();
  await p.mouse.move(pt.x + 120, pt.y + 6, { steps: 10 });
  await p.mouse.up();
}
const after = (await state())[0];
console.log('tv drag:', pt ? JSON.stringify(before) + ' → ' + JSON.stringify(after) : 'tv not found');

// Click without moving must not move anything.
if (pt) {
  const s0 = JSON.stringify(await state());
  await p.mouse.click(pt.x + 120, pt.y + 6);
  console.log('plain click moved something:', s0 !== JSON.stringify(await state()));
}

// Table set: items pushed in front of the table wall, posters hang on it.
await p.evaluate(() => {
  const st = () => window.__mockuplab.project.getState();
  st().setDecor({ kind: 'table', material: 'oak', wall: '#ece6dc', ambience: 'day', gobo: 'window' });
  window.__mockuplab.ui.getState().resetView();
});
console.log('with table set:', JSON.stringify(await state()));
await p.waitForTimeout(2500);
await render('wall-table');
console.log('errors:', errors.join('\n') || 'none');
await b.close();
