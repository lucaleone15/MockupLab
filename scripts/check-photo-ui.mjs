// Photo mode interactions: 4-click placement with loupe, double-click detection,
// corner drag + undo, template save / file round trip, autosave restore, back to 3D.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
mkdirSync('out/photo', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.addInitScript(() => {
  if (!sessionStorage.getItem('fresh')) {
    indexedDB.deleteDatabase('mockuplab');
    indexedDB.deleteDatabase('mockuplab-templates');
    sessionStorage.setItem('fresh', '1');
  }
  localStorage.setItem('mockuplab:lang', 'fr');
});
await p.goto('http://localhost:5173/#/photo');
await p.waitForFunction(() => window.__mockuplab?.photo);
await p.waitForTimeout(600);
// import our own photo: the marble one, through the file input
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Importer ma photo' }).first().click()]);
await chooser.setFiles('public/assets/photo/marble-duo.jpg');
await p.waitForTimeout(1200);
const state = () => p.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  return { mode: s.mode, zones: s.photo.zones.map((z) => ({ kind: z.kind, aspect: +z.aspect.toFixed(3), corners: z.corners.map((c) => c.map((v) => +v.toFixed(3))) })), tool: window.__mockuplab.ui.getState().photoTool };
});
console.log('after import:', JSON.stringify(await state()));
const frame = await p.getByTestId('zone-editor').boundingBox();
const at = (x, y) => [frame.x + x * frame.width, frame.y + y * frame.height];
// place mode is on: click the phone's 4 corners (from the bundled template), with the loupe visible
const phone = [[0.64, 0.2798], [0.7685, 0.1845], [0.8862, 0.5264], [0.7565, 0.6234]];
for (const [i, c] of phone.entries()) {
  await p.mouse.move(...at(...c));
  if (i === 2) await p.screenshot({ path: 'out/photo/ui-place.png' });
  await p.mouse.click(...at(...c));
  await p.waitForTimeout(120);
}
await p.waitForTimeout(500);
console.log('after 4 clicks:', JSON.stringify(await state()));
// double-click inside the tablet: auto-detection
await p.mouse.dblclick(...at(0.42, 0.62));
await p.waitForTimeout(1500);
console.log('after double-click:', JSON.stringify(await state()));
await p.evaluate(() => window.__mockuplab.photo.loadSamples());
await p.waitForTimeout(800);
await p.screenshot({ path: 'out/photo/ui-zones.png' });
// drag the selected zone's top-left corner, then undo
const before = await state();
const tl = before.zones[1].corners[0];
await p.mouse.move(...at(...tl));
await p.mouse.down();
await p.mouse.move(...at(tl[0] + 0.03, tl[1] + 0.02), { steps: 8 });
await p.screenshot({ path: 'out/photo/ui-drag.png' });
await p.mouse.up();
const dragged = await state();
console.log('corner drag:', JSON.stringify(tl), '→', JSON.stringify(dragged.zones[1].corners[0]));
await p.waitForTimeout(600);
await p.keyboard.press('Meta+z');
await p.waitForTimeout(300);
console.log('after undo:', JSON.stringify((await state()).zones[1].corners[0]));
// arrow nudge on the active corner
await p.mouse.click(...at(...(await state()).zones[1].corners[2]));
await p.keyboard.press('ArrowRight');
await p.keyboard.press('Shift+ArrowDown');
console.log('nudged corner:', JSON.stringify((await state()).zones[1].corners[2]));
// save as template
await p.getByRole('button', { name: 'Enregistrer comme modèle' }).click();
await p.getByPlaceholder('Nom du modèle').fill('Duo marbre');
await p.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await p.waitForTimeout(800);
const mine = p.getByTestId('photo-library').getByText('Duo marbre');
console.log('template in library:', await mine.count());
// export it as a file, then re-import
await mine.hover();
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exporter en fichier .json' }).click()]);
const file = 'out/photo/' + dl.suggestedFilename();
await dl.saveAs(file);
const parsed = JSON.parse(readFileSync(file, 'utf8'));
console.log('template file:', dl.suggestedFilename(), parsed.kind, parsed.zones.length, 'zones', Math.round(parsed.image.length / 1024), 'KB');
const [chooser2] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Importer un modèle (.json)' }).click()]);
await chooser2.setFiles(file);
await p.waitForTimeout(1500);
console.log('after template import:', await p.getByTestId('photo-library').getByText('Duo marbre').count(), 'entries;', JSON.stringify((await state()).zones.length), 'zones');
// export the image
await p.keyboard.press('Meta+e');
const [dl2] = await Promise.all([p.waitForEvent('download'), p.getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ }).click()]);
await dl2.saveAs('out/photo/ui-export.png');
console.log('export:', dl2.suggestedFilename());
// reload: autosave restores the photo mock-up
await p.waitForTimeout(1500);
await p.reload();
await p.waitForFunction(() => window.__mockuplab?.photo);
await p.waitForTimeout(1500);
console.log('after reload:', JSON.stringify({ ...(await state()), zones: (await state()).zones.length }));
await p.screenshot({ path: 'out/photo/ui-reload.png' });
// back to 3D
await p.getByTestId('mode-switch').getByRole('radio', { name: 'Studio' }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: 'out/photo/ui-3d.png' });
console.log('3D mode:', (await state()).mode);
console.log('errors:', errors.join('\n') || 'none');
await b.close();
