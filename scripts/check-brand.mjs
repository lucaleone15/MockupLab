// Brand identity checks: imported font, logo, brand board, generated visuals, swatch fan.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('out/brand', { recursive: true });
const fontPath = process.env.FONT;
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => indexedDB.deleteDatabase('mockuplab'));
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(800);
const fontB64 = fontPath ? readFileSync(fontPath).toString('base64') : null;

const render = async (name) => {
  const d = await p.evaluate(async () => {
    const img = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await img.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  });
  writeFileSync(`out/brand/${name}.png`, Buffer.from(d, 'base64'));
};

// Kit: logo + imported heading font.
await p.evaluate(async (fontB64) => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  const logo = await (await fetch('/samples/sample-logo.png')).blob();
  const asset = await api.importAsset(new File([logo], 'logo.png', { type: 'image/png' }));
  st().setBrand({ logoAssetId: asset.id });
  if (fontB64) {
    const bytes = Uint8Array.from(atob(fontB64), (c) => c.charCodeAt(0));
    const f = await api.importFontFile(new File([bytes], 'Instrument-Serif-Regular.woff2'));
    if (f) st().setBrand({ heading: f });
  }
  st().setExport({ resolution: '1080', ratio: '16:9', format: 'png' });
}, fontB64);

// 1. Brand board around a laptop + phone, with generated brand visuals on the screens.
await p.evaluate(async () => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  st().replaceModel(st().selectedId, 'laptop-14');
  st().addItem('phone-pro');
  st().arrange();
  await api.applyBrandArt(st().items.map((i) => i.id));
  st().setBackground({ kind: 'solid', color: '#efe8dc' });
  st().applyLightPreset('highkey');
  const ink = '#1D1A17';
  const o = api.overlays;
  const b = st().brand;
  st().addOverlay(o.newLogoOverlay(b.logoAssetId, { size: 0.075, x: 0.1, y: 0.12 }));
  st().addOverlay(o.newTextOverlay({ text: b.name, font: 'heading', size: 0.075, color: ink, align: 'left', x: 0.06, y: 0.26 }));
  st().addOverlay(o.newTextOverlay({ text: b.tagline, font: 'body', weight: 400, size: 0.026, color: ink, align: 'left', x: 0.061, y: 0.33, tracking: 0 }));
  st().addOverlay(o.newTypeOverlay({ size: 0.045, x: 0.06, y: 0.56, color: ink }));
  st().addOverlay(o.newPaletteOverlay({ size: 0.055, x: 0.2, y: 0.86, color: ink }));
  st().setCamera({ shift: 0.16 });
  api.ui.getState().resetView();
});
await p.waitForTimeout(2500);
await render('board');

// 2. Generated visuals on print: business cards + tote.
await p.evaluate(async () => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  for (const o of st().overlays) st().removeOverlay(o.id);
  st().setCamera({ shift: 0 });
  const keep = st().items[0].id;
  for (const it of st().items.slice(1)) st().removeItem(it.id);
  st().replaceModel(keep, 'business-card');
  st().addItem('tote');
  st().arrange();
  await api.applyBrandArt(st().items.map((i) => i.id));
  st().setDecor({ kind: 'table', material: 'oak', wall: '#ece6dc', ambience: 'day', gobo: 'window' });
  st().setLighting({ exposure: 0.95, environment: 0.32 });
  api.ui.getState().resetView();
});
await p.waitForTimeout(2500);
await render('generated');

// 3. Swatch fan (the specimen card is gone).
await p.evaluate(async () => {
  const api = window.__mockuplab;
  const st = () => api.project.getState();
  const keep = st().items[0].id;
  for (const it of st().items.slice(1)) st().removeItem(it.id);
  st().replaceModel(keep, 'swatch-fan');
  st().arrange();
  st().setDecor({ kind: 'surface', material: 'linen' });
  st().setBackground({ kind: 'solid', color: '#e4e0d8' });
  st().setCamera({ preset: 'top' });
  api.ui.getState().resetView();
});
await p.waitForTimeout(2500);
await render('identity-objects');
console.log('errors:', errors.join('\n') || 'none');
await b.close();
