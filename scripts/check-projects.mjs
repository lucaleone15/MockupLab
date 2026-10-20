// scripts/check-projects.mjs — every export of a project is kept with its settings and a snapshot of the scene,
// can be resumed (undoable), survives the file limit as an entry, and keeps the images it needs.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const api = (fn, arg) => page.evaluate(fn, arg);
await page.getByRole('button', { name: 'Essayer un exemple' }).click();
await page.waitForTimeout(1500);
await api(() => window.__mockuplab.project.setState({ name: 'Historique' }));
await page.waitForTimeout(2500);
const projectId = await api(() => window.__mockuplab.library.state().currentId);
check(!!projectId, 'the project is stored');

// 1. two exports with different backgrounds keep their settings and their scene
const exportWith = async (color) => {
  await api((c) => {
    const s = window.__mockuplab.project.getState();
    s.setBackground({ kind: 'solid', color: c });
    s.setExport({ format: 'png', resolution: '1080', ratio: '16:9' });
  }, color);
  await Promise.all([page.waitForEvent('download', { timeout: 120000 }), api(() => import('/src/export/exportImage.ts').then((m) => m.exportImage('image')))]);
  await page.waitForTimeout(600);
};
await exportWith('#112233');
const firstImage = await api(() => Object.values(window.__mockuplab.project.getState().items[0].surfaces).find((b) => b.assetId).assetId);
await exportWith('#445566');
let list = await api((id) => window.__mockuplab.exports.listExports(id), projectId);
check(list.length === 2, `two exports kept (${list.length})`);
check(list[0].settings?.kind === 'image' && list[0].settings.format === 'png' && list[0].settings.width === 1920 && list[0].settings.ratio === '16:9', `an export keeps its settings (${JSON.stringify(list[0].settings)})`);
check(list[0].snapshot?.background.color === '#445566' && list[1].snapshot?.background.color === '#112233', 'an export keeps its scene');

// 2. resume: the older scene comes back, ⌘Z returns to the newer one
await api(({ id, e }) => window.__mockuplab.exports.resumeExport(id, e), { id: projectId, e: list[1].id });
await page.waitForTimeout(500);
check((await api(() => window.__mockuplab.project.getState().background.color)) === '#112233', 'Resume brings that export’s scene back');
check((await api(() => window.__mockuplab.ui.getState().screen)) === 'studio', '… in the Studio');
await api(() => window.__mockuplab.project.temporal.getState().undo());
check((await api(() => window.__mockuplab.project.getState().background.color)) === '#445566', 'and ⌘Z undoes it');

// 3. an image only an export still uses is kept
await api(async () => {
  const s = window.__mockuplab.project.getState();
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const a = await window.__mockuplab.importAsset(new File([blob], 'autre.png', { type: 'image/png' }));
  s.setSurface(s.items[0].id, 'screen', { assetId: a.id });
});
await page.waitForTimeout(2500);
await api(() => import('/src/library/store.ts').then((m) => m.collectUnusedAssets()));
check(await api((id) => window.__mockuplab.storedAsset(id), firstImage), 'an image used only by an export is not cleaned away');

// 4. past the file limit, the oldest files go but their entries stay
await api(async (id) => {
  for (let i = 0; i < 30; i++) await window.__mockuplab.exports.recordExport(new Blob(['x'], { type: 'image/png' }), `x${i}.png`, { kind: 'image', format: 'png', width: 10, height: 10, ratio: '1:1' });
}, projectId);
list = await api((id) => window.__mockuplab.exports.listExports(id), projectId);
check(list.length === 32, `every export keeps its entry (${list.length})`);
check(list.filter((e) => e.hasFile).length === 30 && !list[list.length - 1].hasFile, 'only the 30 newest keep their file');
await done(browser, errors);

// 5. a name when a project starts; the project page lists its exports
{
  // automated browsers skip the name question unless asked to show it
  const { browser, page, errors } = await openApp({ hash: '#/studio', init: () => localStorage.setItem('mockuplab:askName', '1') });
  const api = (fn, arg) => page.evaluate(fn, arg);
  const dialog = page.getByTestId('name-dialog');
  check(await dialog.isVisible(), 'a new project asks for its name');
  check((await page.getByTestId('tour').count()) === 0, 'the guide waits for the name');
  await dialog.getByRole('button', { name: 'Plus tard' }).click();
  check((await api(() => window.__mockuplab.project.getState().name)) === 'Untitled', '“Later” keeps it untitled');
  await page.getByRole('button', { name: 'Essayer un exemple' }).click();
  await page.waitForTimeout(1500);
  await api(() => window.__mockuplab.project.getState().setExport({ resolution: '1080', format: 'png', ratio: '16:9' }));
  await page.keyboard.press('Meta+e');
  await page.getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ }).click();
  check(await dialog.isVisible(), 'the first export asks for the name first');
  await dialog.getByRole('textbox', { name: 'Nom du projet' }).fill('Site Solstice');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), dialog.getByRole('button', { name: 'Créer' }).click()]);
  check(/site-solstice/.test(dl.suggestedFilename()), `named, then exported (${dl.suggestedFilename()})`);
  await page.waitForTimeout(3000);
  check((await api(() => window.__mockuplab.library.state().list.map((p) => p.name))).includes('Site Solstice'), 'the library knows it by its name');
  // the project page
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(() => window.__mockuplab);
  await page.waitForTimeout(800);
  await page.getByTestId('project-card').filter({ hasText: 'Site Solstice' }).getByRole('button', { name: /Ouvrir/ }).click();
  const proj = page.getByTestId('project-page');
  check(await proj.isVisible(), 'a project card opens the project page');
  const entries = proj.getByTestId('export-entry');
  check((await entries.count()) === 1, 'it lists the project’s exports');
  const text = await entries.first().innerText();
  check(/PNG · 1920 × 1080 · 16:9/.test(text) && /Dernier/.test(text), `each export shows its settings (${text.replace(/\n/g, ' | ')})`);
  await page.screenshot({ path: 'out/project-page.png' });
  await entries.first().getByRole('button', { name: 'Reprendre' }).click();
  await page.waitForTimeout(800);
  check((await api(() => window.__mockuplab.ui.getState().screen)) === 'studio' && !(await dialog.isVisible().catch(() => false)), 'Resume opens the Studio (no name question for a named project)');
  await done(browser, errors);
}
