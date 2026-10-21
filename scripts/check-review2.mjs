// scripts/check-review2.mjs — regressions found by the phases 2–6 review: render sandboxes vs autosave and
// project switching, stale Quick thumbnails, drops on Quick/Project, Project downloads and multi-page PDFs.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp();
const api = (fn, arg) => page.evaluate(fn, arg);
const idbProject = (id) =>
  api(async (id) => {
    const db = await new Promise((res) => { const q = indexedDB.open('mockuplab'); q.onsuccess = () => res(q.result); });
    return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get('project:' + id); r.onsuccess = () => res(r.result ? { name: r.result.name, first: r.result.items[0]?.id } : null); });
  }, id);
// I3: looking at Quick on a fresh profile creates no project
await api(() => (location.hash = '#/rapide'));
await page.waitForTimeout(3500);
await api(() => (location.hash = '#/'));
await page.waitForTimeout(1500);
check((await api(() => window.__mockuplab.library.state().list.length)) === 0, 'visiting Quick creates no project');
// I1: a format chosen during the gallery render sticks
await api(() => (location.hash = '#/rapide'));
await page.waitForTimeout(800);
await page.getByRole('button', { name: '1:1', exact: true }).click();
await page.waitForTimeout(3000);
check((await api(() => window.__mockuplab.project.getState().export.ratio)) === '1:1', 'format changed during a render is kept');
// I4: thumbnails always match the current support (the supports are behind « Changer »)
await page.getByTestId('quick-device').getByRole('button', { name: 'Changer' }).click();
await page.getByTestId('quick-support').getByRole('button', { name: 'Ordinateur' }).click();
await page.waitForTimeout(300);
await page.getByTestId('quick-support').getByRole('button', { name: 'Tablette' }).click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid=quick-tile] img').length >= 4, null, { timeout: 90000 }).catch(() => {});
const stale = await api(() => { const s = window.__mockuplab.quick.state(); return Object.entries(s.thumbKeys).filter(([, k]) => !k.startsWith('tablet|')).length; });
check(stale === 0, `no thumbnail left from the previous support (${stale})`);
// I5: a drop on Quick sets Quick's design, not the project's device
// compare the user's project outside any render (on the home page)
const userItems = async () => {
  await api(() => (location.hash = '#/'));
  await page.waitForTimeout(1500);
  return api(() => JSON.stringify(window.__mockuplab.project.getState().items.map((it) => it.surfaces)));
};
const before = await userItems();
await api(() => (location.hash = '#/rapide'));
await page.waitForTimeout(800);
const drop = (names) =>
  api(async (names) => {
    const dt = new DataTransfer();
    for (const n of names) dt.items.add(new File([await (await fetch('/samples/' + n)).blob()], n, { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, names);
await drop(['sample-web.png']);
await page.waitForTimeout(1200);
const q = await api(() => { const s = window.__mockuplab.quick.state(); return s.assetId && window.__mockuplab.assetName(s.assetId); });
const after = await userItems();
check(q === 'sample-web.png' && after === before, `drop on Quick → Quick's design (${q}), project untouched`);
await api(() => (location.hash = '#/projet'));
await page.waitForTimeout(500);
await drop(['sample-app.png', 'sample-poster.png']);
await page.waitForTimeout(1500);
check((await api(() => window.__mockuplab.pack.state().files.length)) === 2, 'drop on Project → both images added');
// C1: opening another project while a sandbox renders keeps both projects intact
await api(() => (location.hash = '#/studio'));
await page.waitForTimeout(500);
await api(() => window.__mockuplab.project.setState({ name: 'AAA' }));
await page.waitForTimeout(1500);
const A = await api(() => window.__mockuplab.library.state().currentId);
await api(() => window.__mockuplab.library.create());
await api(() => window.__mockuplab.project.setState({ name: 'BBB' }));
await page.waitForTimeout(1500);
const B = await api(() => window.__mockuplab.library.state().currentId);
await api((A) => window.__mockuplab.library.open(A), A);
await api(() => (location.hash = '#/rapide'));
await page.waitForTimeout(1200);
await api(async (B) => { await window.__mockuplab.library.open(B); location.hash = '#/studio'; }, B);
await page.waitForTimeout(4000);
const now = await api(() => ({ current: window.__mockuplab.library.state().currentId, name: window.__mockuplab.project.getState().name }));
check(now.current === B && now.name === 'BBB', `opening B during a render shows B (${JSON.stringify(now)})`);
check((await idbProject(B))?.name === 'BBB' && (await idbProject(A))?.name === 'AAA', 'both stored projects intact');
// I2: an edit right before Quick is not saved as the Quick scene
await api(() => window.__mockuplab.project.setState({ name: 'BBB2' }));
await api(() => (location.hash = '#/rapide'));
await page.waitForTimeout(2500);
const stored = await idbProject(B);
check(stored && stored.first !== 'quick-item', `the staged Quick scene is never saved as the project (${JSON.stringify(stored)})`);
// I6: no thumbnail is captured while a sandbox renders
check((await api(() => window.__mockuplab.thumbs.canCapture())) === false, 'thumbnail capture is skipped during a sandbox render');
// I8a: download one mock-up from the pack
await api(() => (location.hash = '#/projet'));
await page.waitForFunction(() => document.querySelectorAll('[data-testid=pack-item] img').length >= 2, null, { timeout: 120000 }).catch(() => {});
await page.getByTestId('pack-item').nth(1).hover();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.getByTestId('pack-item').nth(1).getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `one pack mock-up downloads (${dl.suggestedFilename()})`);
// I8b: a multi-page PDF offers its other pages
const maker = await chromium.launch();
const mp = await maker.newPage();
await mp.setContent('<style>@page{size:A4;margin:0}body{margin:0}div{height:290mm}</style><div style="background:#ff5c35"></div><div style="break-before:page;background:#2f4a3b"></div>');
await mp.pdf({ path: 'out/pdf/two.pdf', format: 'A4', printBackground: true });
await maker.close();
await api(async (bytes) => window.__mockuplab.pack.add([new File([new Uint8Array(bytes)], 'deux.pdf', { type: 'application/pdf' })]), [...readFileSync('out/pdf/two.pdf')]);
await page.waitForFunction(() => window.__mockuplab.pack.state().files.some((f) => f.pdf), null, { timeout: 30000 }).catch(() => {});
const more = page.getByRole('button', { name: /autre page|other page/ });
check((await more.count()) === 1, 'multi-page PDF offers its other pages');
await more.click();
await page.waitForTimeout(1500);
check((await api(() => window.__mockuplab.pack.state().files.filter((f) => /deux-p\d\.png/.test(f.name)).length)) === 2, 'both PDF pages in the pack');
await done(browser, errors);
