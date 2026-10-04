// Renders every model (or MODELS=id1,id2) with the matching sample screen into out/models/.
// Usage: node scripts/gallery.mjs [url]   env: PARAMS='{"orientation":"portrait"}' FINISH=silver RATIO=16:9 SHOTS=...
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.env.OUT ?? 'out/models';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { if (!sessionStorage.getItem('mockuplab:keep')) indexedDB.deleteDatabase('mockuplab'); });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text()}`));
await page.goto(url);
await page.waitForFunction(() => window.__mockuplab, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const models = await page.evaluate(() => window.__mockuplab.models);
const only = process.env.MODELS?.split(',');
for (const m of models.filter((m) => !only || only.includes(m.id))) {
  const r = await page.evaluate(
    async ({ m, params, finish, ratio, bg }) => {
      const api = window.__mockuplab;
      const st = api.project.getState();
      const id = st.selectedId;
      st.replaceModel(id, m.id);
      for (const [k, v] of Object.entries(params)) api.project.getState().setParam(id, k, v);
      if (finish) api.project.getState().updateItem(id, { finishId: finish });
      if (bg) api.project.getState().setBackground(bg);
      api.project.getState().setExport({ resolution: '1080', ratio, format: 'png' });
      await api.loadSamples(id);
      await new Promise((res) => setTimeout(res, 1600));
      const t0 = performance.now();
      const img = await api.renderImage();
      const buf = new Uint8Array(await img.blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { data: btoa(bin), ms: Math.round(performance.now() - t0) };
    },
    {
      m,
      params: JSON.parse(process.env.PARAMS ?? '{}'),
      finish: process.env.FINISH,
      ratio: process.env.RATIO ?? '16:9',
      bg: process.env.BG ? JSON.parse(process.env.BG) : null,
    },
  );
  const suffix = process.env.SUFFIX ?? '';
  writeFileSync(`${out}/${m.id}${suffix}.png`, Buffer.from(r.data, 'base64'));
  console.log(`${m.id}: ${r.ms} ms`);
  for (const [i, shot] of JSON.parse(process.env.SHOTS ?? '[]').entries()) {
    // Ratio first: changing it re-frames the camera.
    await page.evaluate(() => window.__mockuplab.project.getState().setExport({ ratio: '1:1' }));
    await page.waitForTimeout(600);
    await page.evaluate((s) => window.__mockuplabCamera(s.pos, s.target, s.fov), shot);
    await page.waitForTimeout(300);
    const d = await page.evaluate(async () => {
      const img = await window.__mockuplab.renderImage();
      const buf = new Uint8Array(await img.blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    });
    writeFileSync(`${out}/${m.id}-shot${i}.png`, Buffer.from(d, 'base64'));
  }
}
console.log(logs.join('\n'));
await browser.close();
