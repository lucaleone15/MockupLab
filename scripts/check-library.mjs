// scripts/check-library.mjs — several projects in IndexedDB: migration of the old single project,
// create / duplicate / rename / remove, images shared between projects, current project restored.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const idb = (fn, arg) => page.evaluate(fn, arg);
// raw IndexedDB access, independent from the app's code
const RAW = `
  window.idbOpen = () => new Promise((res, rej) => { const r = indexedDB.open('mockuplab'); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  window.idbTx = async (mode, fn) => { const db = await idbOpen(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const out = fn(t.objectStore('kv')); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
`;
// 1. build an old-format autosave: key 'project' + 'asset:<id>'
await page.getByRole('button', { name: 'Essayer un exemple' }).click();
await page.waitForTimeout(1500);
const legacy = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const project = { ...api.persistence.snapshot(), name: 'Ancien projet' };
  const id = project.items[0].surfaces.screen.assetId;
  const blob = await (await fetch(api.assetUrl(id))).blob();
  return { project, asset: { id, name: 'legacy.png', width: 10, height: 20 }, bytes: [...new Uint8Array(await blob.arrayBuffer())], type: blob.type };
});
await page.evaluate(
  async ({ RAW, l }) => {
    eval(RAW);
    // stop the app from writing while we rebuild the database
    window.__mockuplab.persistence.pauseAutosave(true);
    // empty the store in place (deleting the database would block on the app's open connection)
    await idbTx('readwrite', (s) => s.clear());
    const blob = new Blob([new Uint8Array(l.bytes)], { type: l.type });
    await idbTx('readwrite', (s) => { s.put(l.project, 'project'); s.put({ ...l.asset, blob }, 'asset:' + l.asset.id); });
    localStorage.removeItem('mockuplab:current');
  },
  { RAW, l: legacy },
);
await page.reload();
await page.waitForFunction(() => window.__mockuplab?.library);
await page.waitForTimeout(1200);
const lib = () => page.evaluate(() => { const s = window.__mockuplab.library.state(); return { ids: s.list.map((p) => p.id), names: s.list.map((p) => p.name), current: s.currentId }; });
let L = await lib();
check(L.ids.length === 1 && L.names[0] === 'Ancien projet', `old autosave migrated into the library (${JSON.stringify(L.names)})`);
const assetOk = await page.evaluate((id) => !!window.__mockuplab.assetUrl(id), legacy.asset.id);
check(assetOk, 'its image is loaded');
const keys = () => idb(async (RAW) => { eval(RAW); const db = await idbOpen(); return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').getAllKeys(); r.onsuccess = () => res(r.result.map(String)); }); }, RAW);
check(!(await keys()).includes('project'), 'old key removed after migration');
const oldId = L.ids[0];
// 2. create a new project, the old one stays
await page.evaluate(() => window.__mockuplab.library.create());
await page.waitForTimeout(400);
await page.evaluate(() => window.__mockuplab.project.setState({ name: 'Nouveau' }));
await page.waitForTimeout(1200);
L = await lib();
check(L.ids.length === 2 && L.current !== oldId && L.names.includes('Nouveau'), `new project created next to the old one (${JSON.stringify(L.names)})`);
// 3. duplicate + rename
const dupId = await page.evaluate((id) => window.__mockuplab.library.duplicate(id), oldId);
await page.evaluate((id) => window.__mockuplab.library.rename(id, 'Copie test'), dupId);
await page.waitForTimeout(300);
L = await lib();
check(L.ids.length === 3 && L.names.includes('Copie test'), `duplicate + rename (${JSON.stringify(L.names)})`);
// 4. removing one project keeps an image another project still uses
await page.evaluate((id) => window.__mockuplab.library.remove(id), oldId);
await page.waitForTimeout(1200);
check((await keys()).includes('asset:' + legacy.asset.id), 'shared image kept after removing one of its projects');
await page.evaluate((id) => window.__mockuplab.library.remove(id), dupId);
await page.waitForTimeout(1200);
check(!(await keys()).includes('asset:' + legacy.asset.id), 'image deleted once no project uses it');
// 5. the current project comes back after a reload
const cur = (await lib()).current;
await page.reload();
await page.waitForFunction(() => window.__mockuplab?.library);
await page.waitForTimeout(1000);
L = await lib();
check(L.current === cur && (await page.evaluate(() => window.__mockuplab.project.getState().name)) === 'Nouveau', 'current project restored after reload');
// 6. exports are kept with the project (10 at most) and the project gets a thumbnail
await page.getByTestId('top-export').click();
await page.getByTestId('export-sheet').getByRole('radio', { name: '1080p', exact: true }).click();
await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ }).click()]);
await page.waitForTimeout(1500);
const exp = () => page.evaluate(async () => { const id = window.__mockuplab.library.state().currentId; const list = await window.__mockuplab.exports.listExports(id); const blob = list[0] && (await window.__mockuplab.exports.getExport(id, list[0].id)); return { n: list.length, size: blob?.size ?? 0, count: window.__mockuplab.library.state().list.find((p) => p.id === id)?.exportCount }; });
let E = await exp();
check(E.n === 1 && E.size > 1000 && E.count === 1, `downloaded image kept with the project (${JSON.stringify(E)})`);
await page.evaluate(async () => { for (let i = 0; i < 11; i++) await window.__mockuplab.exports.recordExport(new Blob(['x'.repeat(10)], { type: 'image/png' }), `extra-${i}.png`); });
E = await exp();
check(E.n === 10 && E.count === 10, `only the last 10 exports are kept (${E.n})`);
await page.waitForFunction(() => { const s = window.__mockuplab.library.state(); return s.list.find((p) => p.id === s.currentId)?.hasThumb; }, null, { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => { const s = window.__mockuplab.library.state(); return !!s.thumbs[s.currentId]; }), 'the project has a thumbnail');
// 7. recents on the home page: open, rename, duplicate, delete; all projects; recent exports in the sheet
await page.getByTestId('export-sheet').isVisible().catch(() => {});
await page.getByTestId('top-export').click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid=recent-export]').length === 10, null, { timeout: 5000 }).catch(() => {});
check((await page.getByTestId('export-sheet').getByTestId('recent-export').count()) === 10, 'Export sheet lists the kept exports');
const [again] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-sheet').getByTestId('recent-export').first().getByRole('button', { name: /Télécharger/ }).click()]);
check(/extra-10\.png$/.test(again.suggestedFilename()), `a kept export downloads again (${again.suggestedFilename()})`);
await page.keyboard.press('Escape');
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(500);
const cards = page.getByTestId('project-card');
check((await cards.count()) === 1, `one recent project card (${await cards.count()})`);
await cards.first().getByRole('button', { name: /Options/ }).click();
await page.getByRole('menuitem', { name: /Dupliquer/ }).click();
await page.waitForTimeout(500);
check((await cards.count()) === 2, 'card menu duplicates');
await cards.first().getByRole('button', { name: /Options/ }).click();
await page.getByRole('menuitem', { name: /Renommer/ }).click();
await page.getByTestId('text-dialog').getByRole('textbox').fill('Renommé');
await page.getByTestId('text-dialog').getByRole('button', { name: 'OK' }).click();
await page.waitForTimeout(600);
check((await page.getByTestId('project-card').filter({ hasText: 'Renommé' }).count()) === 1, 'card menu renames');
await page.getByTestId('project-card').filter({ hasText: 'Renommé' }).getByRole('button', { name: /Options/ }).click();
await page.getByRole('menuitem', { name: /Supprimer/ }).click();
await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
await page.waitForTimeout(500);
check((await cards.count()) === 1, 'card menu deletes (after confirmation)');
await cards.first().getByRole('button', { name: /Ouvrir/ }).click();
await page.waitForTimeout(500);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'opening a card goes to its screen');
await done(browser, errors);
