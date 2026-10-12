// Photo mode: templates, auto-detection accuracy, samples, full-resolution export.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('out/photo', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  indexedDB.deleteDatabase('mockuplab-templates');
  localStorage.setItem('mockuplab:lang', 'fr');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/photo');
await p.waitForFunction(() => window.__mockuplab?.photo);
await p.waitForTimeout(800);
await p.waitForTimeout(500);
await p.screenshot({ path: 'out/photo/empty.png' });

const ids = await p.evaluate(() => window.__mockuplab.photo.templates.map((t) => t.id));
for (const id of ids) {
  // detection from the centre of each bundled zone, compared with the stored corners (photo px)
  const report = await p.evaluate(async (id) => {
    const api = window.__mockuplab;
    const tpl = api.photo.templates.find((t) => t.id === id);
    await api.photo.applyTemplate(tpl);
    const st = api.project.getState();
    const a = st.photo.assetId;
    const px = await api.photo.assetPixels(a, 1600);
    const asset = await new Promise((r) => r(api.assetName(a)));
    return tpl.zones.map((z) => {
      const cx = z.corners.reduce((s, c) => s + c[0], 0) / 4;
      const cy = z.corners.reduce((s, c) => s + c[1], 0) / 4;
      const q = api.photo.detectQuad(px, cx, cy);
      return { zone: typeof z.name === 'string' ? z.name : z.name.fr, stored: z.corners, detected: q && q.map((c) => c.map((v) => +v.toFixed(4))) };
    });
  }, id);
  console.log(id, JSON.stringify(report));
  await p.evaluate(() => window.__mockuplab.photo.loadSamples());
  await p.waitForTimeout(900);
  await p.screenshot({ path: `out/photo/ui-${id}.png` });
  const res = await p.evaluate(async () => {
    const r = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), w: r.width, h: r.height, name: r.filename };
  });
  writeFileSync(`out/photo/${id}.png`, Buffer.from(res.b64, 'base64'));
  console.log('  export', res.name, res.w, res.h);
}
console.log('errors:', errors.join('\n') || 'none');
await b.close();
