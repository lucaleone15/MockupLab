// Renders scene scenarios (background / décor / light / camera / floor) into out/scenes/.
// Usage: node scripts/scenes.mjs [only-name,...]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const SCENARIOS = [
  { name: 'studio-default', model: 'phone-pro' },
  { name: 'mat-wood', model: 'phone', decor: { kind: 'surface', material: 'wood' }, camera: { preset: 'top' }, pose: 'flat' },
  { name: 'mat-marble', model: 'phone', decor: { kind: 'surface', material: 'marble' }, camera: { preset: 'top' }, pose: 'flat' },
  { name: 'dof-4k', model: 'phone-pro', camera: { preset: 'threeQuarter', dof: true, aperture: 0.5, focus: 0 }, decor: { kind: 'surface', material: 'concrete' }, export: { resolution: '4k' } },
  { name: 'reflect-debug', model: 'phone-pro', bg: { kind: 'solid', color: '#202024' }, ground: { reflection: true, reflectivity: 1, shadow: 'none' }, camera: { preset: 'front' } },
  { name: 'aurora-reflection', model: 'phone-pro', bg: { kind: 'pattern', pattern: 'aurora', colors: ['#0c0a1d', '#4b2ad8', '#ff6a3d'], scale: 1, grain: 0.35, seed: 4 }, ground: { reflection: true, reflectivity: 0.45 } },
  { name: 'podium-arch', model: 'phone-pro', decor: { kind: 'podium', color: '#e8d9c8', shape: 'cylinder', arch: true }, light: 'highkey', bg: { kind: 'solid', color: '#efe3d6' } },
  { name: 'sweep-dramatic', model: 'laptop-14', decor: { kind: 'sweep', color: '#2b2b30' }, light: 'dramatic' },
  { name: 'marble-top', model: 'phone-pro', decor: { kind: 'surface', material: 'marble' }, camera: { preset: 'top' }, pose: 'flat', bg: { kind: 'solid', color: '#f1efe9' }, light: 'daylight' },
  { name: 'desk-golden', model: 'laptop-air-13', decor: { kind: 'desk', material: 'wood', color: '#e9e2d6' }, light: 'golden' },
  { name: 'neon-iso', model: 'tablet-pro-11', light: 'neon', camera: { preset: 'isometric', focal: 600 }, bg: { kind: 'solid', color: '#07060d' }, ground: { reflection: true, reflectivity: 0.5 } },
  { name: 'noir-dof', model: 'phone', light: 'noir', camera: { preset: 'front', dof: true, aperture: 0.6, focus: -0.4 }, bg: { kind: 'solid', color: '#000000' } },
  { name: 'terrazzo-low', model: 'desktop-24', decor: { kind: 'surface', material: 'terrazzo' }, camera: { preset: 'low' }, bg: { kind: 'pattern', pattern: 'grain', colors: ['#fde7d9', '#f6b9a1', '#fff2e6'], scale: 1, grain: 0.5, seed: 2 } },
];

const only = process.argv[2]?.split(',');
const url = process.env.URL ?? 'http://localhost:5173/';
mkdirSync('out/scenes', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text()}`));

for (const sc of SCENARIOS.filter((s) => !only || only.includes(s.name))) {
  await page.goto(url);
  await page.waitForFunction(() => window.__mockuplab, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(async (sc) => {
    const api = window.__mockuplab;
    const st = () => api.project.getState();
    const id = st().selectedId;
    st().replaceModel(id, sc.model);
    if (sc.pose) st().setPose(sc.pose);
    if (sc.bg) st().setBackground(sc.bg);
    if (sc.decor) st().setDecor(sc.decor);
    if (sc.light) st().applyLightPreset(sc.light);
    if (sc.ground) st().setGround(sc.ground);
    if (sc.camera) st().setCamera(sc.camera);
    st().setExport({ resolution: '1080', ratio: '16:9', format: 'png', ...(sc.export ?? {}) });
    const m = api.models.find((x) => x.id === sc.model);
    const landscape = st().items[0].params.orientation === 'landscape';
    const tall = landscape ? 1 / m.aspect < 1 : m.aspect < 1;
    await api.importFromUrl(tall ? '/samples/sample-app.png' : '/samples/sample-web.png', 'sample');
    await new Promise((res) => setTimeout(res, 1500));
    const t0 = performance.now();
    const img = await api.renderImage();
    const buf = new Uint8Array(await img.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: btoa(bin), ms: Math.round(performance.now() - t0) };
  }, sc);
  writeFileSync(`out/scenes/${sc.name}.png`, Buffer.from(r.data, 'base64'));
  if (process.env.UI) await page.locator('[data-testid=frame]').screenshot({ path: `out/scenes/${sc.name}-ui.png` });
  console.log(`${sc.name}: ${r.ms} ms`);
}
console.log(logs.join('\n'));
await browser.close();
