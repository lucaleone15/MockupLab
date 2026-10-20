// .glb import: a test model (screen named "Screen") is imported through the library,
// gets the sample image, renders, survives a reload and a project file round trip, and can be deleted.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('out/glb', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => {
  if (!sessionStorage.getItem('fresh')) {
    indexedDB.deleteDatabase('mockuplab');
    indexedDB.deleteDatabase('mockuplab-models');
    sessionStorage.setItem('fresh', '1');
  }
  localStorage.setItem('mockuplab:lang', 'fr');
  localStorage.setItem('mockuplab:tab', 'device');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto('http://localhost:5173/#/studio');
await p.waitForFunction(() => window.__mockuplab);
const glb = await p.evaluate(async () => {
  const { makeKiosk } = await import('/scripts/fixtures/makeGlb.ts');
  const buf = new Uint8Array(await makeKiosk());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
});
writeFileSync('out/glb/kiosk.glb', Buffer.from(glb, 'base64'));
await p.getByTestId('studio-rail').getByRole('tab', { name: 'Appareils', exact: true }).click();
await p.getByTestId('add-device').click();
await p.getByTestId('catalogue-family-custom').click();
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('import-glb').click()]);
await chooser.setFiles('out/glb/kiosk.glb');
await p.waitForTimeout(1500);
const item = () => p.evaluate(() => {
  const api = window.__mockuplab;
  const it = api.project.getState().items[0];
  return { modelId: it.modelId, slots: Object.keys(it.surfaces), image: api.assetName(it.surfaces.screen?.assetId) ?? null };
});
console.log('after import:', JSON.stringify(await item()));
await p.evaluate(async () => {
  const api = window.__mockuplab;
  await api.loadSamples(api.project.getState().items[0].id);
  api.project.getState().setExport({ resolution: '1080', format: 'png' });
});
await p.waitForTimeout(1500);
await p.screenshot({ path: 'out/glb/ui.png' });
const shot = async (name) => {
  const r = await p.evaluate(async () => {
    const res = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await res.blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  writeFileSync(`out/glb/${name}.png`, Buffer.from(r, 'base64'));
};
await shot('render');
// reload: the model and the project come back
await p.waitForTimeout(1500);
await p.reload();
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(2000);
console.log('after reload:', JSON.stringify(await item()));
// project file round trip in a fresh browser profile
const file = await p.evaluate(async () => {
  const { exportProjectFile } = await import('/src/store/persistence.ts');
  const f = await exportProjectFile();
  return { text: await f.blob.text(), name: f.filename };
});
writeFileSync('out/glb/' + file.name, file.text);
console.log('project file:', file.name, Math.round(file.text.length / 1024), 'KB, models:', JSON.parse(file.text).models?.length);
const ctx2 = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p2 = await ctx2.newPage();
await p2.addInitScript(() => localStorage.setItem('mockuplab:lang', 'fr'));
await p2.goto('http://localhost:5173/#/studio');
await p2.waitForFunction(() => window.__mockuplab);
await p2.evaluate(async (text) => {
  const { importProjectFile } = await import('/src/store/persistence.ts');
  await importProjectFile(new File([text], 'p.mockuplab.json', { type: 'application/json' }));
}, file.text);
await p2.waitForTimeout(1500);
console.log('other browser after opening the file:', await p2.evaluate(() => window.__mockuplab.project.getState().items[0].modelId));
// delete the model: the device falls back to the phone
p.on('dialog', (d) => d.accept());
await p.getByTestId('studio-rail').getByRole('tab', { name: 'Appareils', exact: true }).click();
await p.getByTestId('add-device').click();
await p.getByTestId('catalogue-family-custom').click();
await p.getByTestId('catalogue').getByText('kiosk').first().hover();
await p.getByRole('button', { name: 'Supprimer ce modèle' }).first().click();
await p.waitForTimeout(800);
console.log('after delete:', (await item()).modelId);
console.log('errors:', errors.join('\n') || 'none');
await b.close();
