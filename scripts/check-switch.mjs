// Device switching and reset flows through the UI.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('out/switch', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => { indexedDB.deleteDatabase('mockuplab'); localStorage.setItem('mockuplab:lang', 'fr'); localStorage.setItem('mockuplab:tab', 'device'); });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(1000);
const slots = () => p.evaluate(() => {
  const api = window.__mockuplab;
  const it = api.project.getState().items[0];
  return { model: it.modelId, images: Object.fromEntries(Object.entries(it.surfaces).map(([k, v]) => [k, v.assetId ? api.assetName(v.assetId) ?? v.assetId : null])) };
});
await p.getByRole('button', { name: 'Essayer un exemple' }).click();
await p.waitForTimeout(1500);
console.log('phone with sample:', JSON.stringify(await slots()));
// Switch with the right-panel menu to Laptop 14.
const triggers = await p.getByRole('button', { name: /Changer/ }).allTextContents();
console.log('switch triggers:', JSON.stringify(triggers));
await p.getByRole('button', { name: /Changer/ }).filter({ hasText: 'Changer' }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: 'out/switch/menu.png' });
await p.getByRole('menuitem', { name: 'Laptop 14' }).click();
await p.waitForTimeout(2500);
console.log('after switch to laptop:', JSON.stringify(await slots()));
await p.screenshot({ path: 'out/switch/laptop.png' });
// Library click: business card.
await p.getByRole('button', { name: 'Carte de visite' }).first().click();
await p.waitForTimeout(2500);
console.log('after library click → card:', JSON.stringify(await slots()));
await p.screenshot({ path: 'out/switch/card.png' });
// Scene changes then reset scene.
await p.evaluate(() => {
  const st = window.__mockuplab.project.getState();
  st.setDecor({ kind: 'podium' });
  st.applyLightPreset('neon');
});
await p.getByRole('button', { name: 'Réinitialiser' }).click();
await p.getByRole('button', { name: /Réinitialiser la scène/ }).click();
await p.waitForTimeout(800);
console.log('after reset scene:', await p.evaluate(() => { const s = window.__mockuplab.project.getState(); return JSON.stringify({ decor: s.decor.kind, light: s.lighting.preset, model: s.items[0].modelId }); }));
await p.keyboard.press('Meta+z');
await p.waitForTimeout(300);
console.log('after undo:', await p.evaluate(() => { const s = window.__mockuplab.project.getState(); return JSON.stringify({ decor: s.decor.kind, light: s.lighting.preset }); }));
await p.getByRole('button', { name: 'Réinitialiser' }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: 'out/switch/dialog.png' });
await p.getByRole('button', { name: /Tout réinitialiser/ }).click();
await p.waitForTimeout(800);
console.log('after reset all:', JSON.stringify(await slots()));
await p.screenshot({ path: 'out/switch/reset.png' });
console.log('errors:', errors.join('\n') || 'none');
await b.close();
