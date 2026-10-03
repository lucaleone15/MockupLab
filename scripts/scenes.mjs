// Renders scene scenarios (background / décor / light / camera / floor) into out/scenes/.
// Usage: node scripts/scenes.mjs [only-name,...]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const table = (material, wall, ambience, gobo) => ({ kind: 'table', material, wall, ambience, gobo });
const SCENARIOS = [
  { name: 'studio-default', model: 'phone-pro' },
  { name: 'table-oak', model: 'phone-pro', decor: table('oak', '#ece6dc', 'day', 'window') },
  { name: 'table-walnut', model: 'laptop-14', decor: table('walnut', '#b9c2ae', 'day', 'leaves') },
  { name: 'table-marble', model: 'phone', decor: table('marble-white', '#d9c8b0', 'sun', 'blinds') },
  { name: 'table-travertine', model: 'tablet-pro-11', decor: table('travertine', '#c98a6b', 'evening', 'leaves') },
  { name: 'table-concrete', model: 'desktop-24', decor: table('concrete', '#aebccb', 'day', 'window') },
  { name: 'table-black', model: 'laptop-air-13', decor: table('marble-black', '#3a3a3d', 'evening', 'none') },
  { name: 'dbg-gobo', model: 'phone', decor: table('marble-white', '#d9c8b0', 'sun', 'blinds'), lighting: { environment: 0 } },
  { name: 'aurora-refl', model: 'phone-pro', bg: { kind: 'pattern', pattern: 'aurora', colors: ['#0c0a1d', '#4b2ad8', '#ff6a3d'], scale: 1, grain: 0.35, seed: 4 }, ground: { reflection: true, reflectivity: 0.45 } },
  { name: 'podium-terrazzo', model: 'phone-pro', decor: { kind: 'podium', podiumFinish: 'material', material: 'terrazzo' }, light: 'highkey', bg: { kind: 'solid', color: '#e9e4dc' } },
  { name: 'flatlay-marble', model: 'phone-pro', decor: { kind: 'surface', material: 'marble-white' }, camera: { preset: 'top' }, pose: 'flat', bg: { kind: 'solid', color: '#f1efe9' }, light: 'highkey' },
  { name: 'flatlay-linen', model: 'phone', decor: { kind: 'surface', material: 'linen' }, camera: { preset: 'top' }, pose: 'flat', bg: { kind: 'solid', color: '#e4e0d8' }, light: 'highkey' },
  { name: 'surface-walnut', model: 'laptop-14', decor: { kind: 'surface', material: 'walnut' }, bg: { kind: 'solid', color: '#efeae3' }, light: 'highkey' },
  { name: 'dof-4k', model: 'phone-pro', camera: { preset: 'threeQuarter', dof: true, aperture: 0.5, focus: 0 }, decor: table('oak', '#ece6dc', 'day', 'window'), export: { resolution: '4k' } },
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
    // Let lazily loaded assets (HDRI, textures) arrive.
    await new Promise((res) => setTimeout(res, sc.decor ? 1500 : 0));
    if (sc.light) st().applyLightPreset(sc.light);
    if (sc.ground) st().setGround(sc.ground);

    if (sc.camera) st().setCamera(sc.camera);
    if (sc.decor?.kind === 'table' && !sc.camera) st().setCamera({ dof: true, aperture: 0.6 });
    if (sc.decor?.kind === 'table') {
      const amb = { day: [0.95, 0.32], sun: [0.92, 0.26], evening: [0.95, 0.22] }[sc.decor.ambience];
      st().setLighting({ exposure: amb[0], environment: amb[1] });
    }
    if (sc.lighting) st().setLighting(sc.lighting);
    st().setExport({ resolution: '1080', ratio: '16:9', format: 'png', ...(sc.export ?? {}) });
    const m = api.models.find((x) => x.id === sc.model);
    const landscape = st().items[0].params.orientation === 'landscape';
    const tall = landscape ? 1 / m.aspect < 1 : m.aspect < 1;
    await api.importFromUrl(tall ? '/samples/sample-app.png' : '/samples/sample-web.png', 'sample');
    await new Promise((res) => setTimeout(res, 2200));
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
