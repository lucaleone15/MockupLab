// Visual check: opens the app, loads the sample, takes UI screenshots and a real export.
// Usage: node scripts/shoot.mjs [url] [outDir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'out';
const theme = process.env.THEME ?? 'dark';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: process.env.HEADED ? false : true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: Number(process.env.HEIGHT ?? 1000) }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(
  ([t, tab]) => {
    localStorage.setItem('mockuplab:theme', t);
    if (tab) localStorage.setItem('mockuplab:tab', tab);
  },
  [theme, process.env.TAB ?? ''],
);
await page.goto(url);
await page.waitForFunction(() => window.__mockuplab, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/ui-empty.png` });

if (process.env.MODEL) await page.evaluate((m) => { const s = window.__mockuplab.project.getState(); s.replaceModel(s.selectedId, m); }, process.env.MODEL);
if (process.env.BG) await page.evaluate((bg) => window.__mockuplab.project.getState().setBackground(bg), JSON.parse(process.env.BG));
await page.evaluate((f) => window.__mockuplab.importFromUrl('/samples/' + f, f), process.env.SAMPLE ?? 'sample-app.png');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/ui-sample.png` });

// Close-ups of device details (exported at 1080p, 1:1).
const shots = JSON.parse(process.env.SHOTS ?? '[]');
async function exportTo(name, s) {
  const r = await page.evaluate(async (s) => {
    const p = window.__mockuplab.project.getState();
    p.setExport(s);
    const t0 = performance.now();
    const r = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await r.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: btoa(bin), name: r.filename, ms: Math.round(performance.now() - t0) };
  }, s);
  writeFileSync(`${out}/${name ?? r.name}`, Buffer.from(r.data, 'base64'));
  console.log(`export ${name ?? r.name} in ${r.ms} ms`);
}

const settings = JSON.parse(process.env.EXPORT ?? '{"resolution":"1080","ratio":"16:9","format":"png"}');
await exportTo(null, settings);
for (const [i, shot] of shots.entries()) {
  await page.evaluate((s) => window.__mockuplabCamera(s.pos, s.target, s.fov), shot);
  await page.waitForTimeout(400);
  await exportTo(`shot-${i}-${shot.name ?? ''}.png`, { resolution: '1080', ratio: shot.ratio ?? '1:1', format: 'png' });
}

const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const d = c?.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GPU:', gl);
console.log(logs.filter((l) => !l.includes('[vite]') && !l.includes('React DevTools')).join('\n'));
await browser.close();
