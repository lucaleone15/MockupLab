// Milestone d checks: multi-device composition, overlays, autosave restore, project file round trip, drag.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('out/comp', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
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
  writeFileSync(`out/comp/${name}.png`, Buffer.from(d, 'base64'));
};

// 1. Composition: laptop + phone + tablet, arranged, on a table set, with overlays.
await p.evaluate(async () => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  st().replaceModel(st().selectedId, 'laptop-14');
  await api.importFromUrl('/samples/sample-web.png', 'web');
  st().addItem('phone-pro');
  await api.importFromUrl('/samples/sample-app.png', 'app');
  st().addItem('tablet-pro-11');
  await api.importFromUrl('/samples/sample-web.png', 'web');
  st().arrange();
  st().setDecor({ kind: 'table', material: 'oak', wall: '#ece6dc', ambience: 'day', gobo: 'window' });
  st().setLighting({ exposure: 0.95, environment: 0.32 });
  st().setCamera({ dof: true, aperture: 0.45 });
  st().addOverlay({ id: 't1', kind: 'text', text: 'Nora Studio', font: 'serif', weight: 400, size: 0.075, color: '#1d1b19', align: 'left', x: 0.06, y: 0.12, tracking: -0.01, visible: true });
  st().addOverlay({ id: 't2', kind: 'text', text: 'Identité & produit · 2026', font: 'sans', weight: 500, size: 0.024, color: '#4a4640', align: 'left', x: 0.062, y: 0.19, tracking: 0.02, visible: true });
  st().setExport({ resolution: '1080', ratio: '16:9', format: 'png' });
  api.project.getState().items; // no-op
  window.__mockuplab_ui?.resetView?.();
});
await p.keyboard.press('f');
await p.waitForTimeout(2500);
await render('composition');
await p.screenshot({ path: 'out/comp/ui.png' });

// 2. Drag the selected device with the mouse: its position must change.
const before = await p.evaluate(() => { const s = window.__mockuplab.project.getState(); return { id: s.selectedId, pos: s.items.find((i) => i.id === s.selectedId).position }; });
const box = await p.locator('[data-testid=frame] canvas').first().boundingBox();
// find a pixel on a device: use picking from the center outwards
const pt = await p.evaluate(async ({ box }) => {
  const { picking } = window.__mockuplab;
  for (let dy = 0; dy < box.height / 2; dy += 20) for (let dx = -box.width / 2; dx < box.width / 2; dx += 20) {
    const x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
    const id = picking.item(x, y);
    if (id) return { x, y, id };
  }
  return null;
}, { box });
let dragResult = 'no device found';
if (pt) {
  const start = await p.evaluate((id) => window.__mockuplab.project.getState().items.find((i) => i.id === id).position, pt.id);
  before.pos = start.map((v) => Math.round(v * 10) / 10);
  await p.mouse.move(pt.x, pt.y);
  await p.mouse.down();
  await p.mouse.move(pt.x + 80, pt.y + 10, { steps: 8 });
  await p.mouse.up();
  const after = await p.evaluate((id) => window.__mockuplab.project.getState().items.find((i) => i.id === id).position, pt.id);
  dragResult = `${pt.id} moved from ${JSON.stringify(before.pos)} to ${JSON.stringify(after.map((v) => Math.round(v * 10) / 10))}`;
}
console.log('drag:', dragResult);

// 3. Autosave → reload → restored.
await p.waitForTimeout(1500);
await p.evaluate(() => sessionStorage.setItem('mockuplab:keep', '1'));
await p.reload();
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(1500);
const restored = await p.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  return { items: s.items.map((i) => i.modelId), overlays: s.overlays.length, decor: s.decor.kind, images: s.items.filter((i) => Object.values(i.surfaces).some((b) => b.assetId)).length };
});
console.log('restored after reload:', JSON.stringify(restored));

// 4. Project file round trip.
const json = await p.evaluate(async () => {
  const { blob, filename } = await window.__mockuplab.persistence.exportProjectFile();
  return { size: blob.size, filename, text: await blob.text() };
});
console.log('project file:', json.filename, Math.round(json.size / 1024), 'KB');
await p.evaluate(() => window.__mockuplab.persistence.newProject());
const fresh = await p.evaluate(() => window.__mockuplab.project.getState().items.length);
await p.evaluate(async (text) => {
  await window.__mockuplab.persistence.importProjectFile(new File([text], 'p.mockuplab.json', { type: 'application/json' }));
}, json.text);
const reimported = await p.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  return { items: s.items.length, overlays: s.overlays.length, images: s.items.filter((i) => Object.values(i.surfaces).some((b) => b.assetId)).length };
});
console.log('new project items:', fresh, '→ reimported:', JSON.stringify(reimported));
await p.waitForTimeout(2000);
await render('reimported');
console.log('errors:', errors.filter((e) => !e.includes('Clock')).join('\n') || 'none');
await b.close();
