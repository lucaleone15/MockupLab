// Batch in photo mode: several designs into the selected zone of a template, one ZIP.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
mkdirSync('out/variants', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
});
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://localhost:5173/#/photo');
await p.waitForFunction(() => window.__mockuplab?.photo);
await p.evaluate(async () => {
  const api = window.__mockuplab;
  api.project.getState().setExport({ format: 'jpeg' });
  await api.photo.applyTemplate(api.photo.templates.find((t) => t.id === 'laptop-desk'));
});
await p.waitForTimeout(800);
const before = await p.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().photo));
await p.getByTestId('photo-rail').getByRole('tab', { name: 'Design', exact: true }).click();
await p.getByTestId('open-batch').click();
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByTestId('batch').getByRole('button', { name: /Glisse tes images/ }).click()]);
await chooser.setFiles(['public/samples/sample-web.png', 'public/samples/sample-poster.png']);
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.getByTestId('batch-run').click()]);
await dl.saveAs('out/variants/' + dl.suggestedFilename());
console.log('photo batch:', dl.suggestedFilename());
console.log(execSync(`cd out/variants && rm -rf zip3 && mkdir zip3 && cd zip3 && unzip -q ../${dl.suggestedFilename()} && ls`).toString());
console.log('photo project untouched:', before === (await p.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().photo))));
console.log('errors:', errors.join('\n') || 'none');
await b.close();
