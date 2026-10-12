// scripts/check-pdf.mjs — a PDF is imported as an image of its first page; a broken PDF only shows a message.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { openApp, check, done } from './lib/app.mjs';
// make an A4 PDF with Chromium itself
const maker = await chromium.launch();
const mp = await maker.newPage();
await mp.setContent('<body style="margin:0"><div style="width:210mm;height:297mm;background:linear-gradient(#ff5c35,#1d1a17);color:white;font:bold 60px sans-serif;display:grid;place-items:center">Affiche</div></body>');
await mp.pdf({ path: 'out/pdf/sample.pdf', format: 'A4', printBackground: true });
await maker.close();
const bytes = [...readFileSync('out/pdf/sample.pdf')];
const { browser, page, errors } = await openApp({ hash: '#/studio' });
await page.evaluate(async (bytes) => {
  const file = new File([new Uint8Array(bytes)], 'affiche.pdf', { type: 'application/pdf' });
  await window.__mockuplab.importFiles([file]);
}, bytes);
await page.waitForTimeout(800);
const got = await page.evaluate(() => {
  const api = window.__mockuplab;
  const it = api.project.getState().items[0];
  const id = Object.values(it.surfaces)[0].assetId;
  const a = id && api.asset(id);
  return a ? { name: a.name, w: a.width, h: a.height } : null;
});
check(!!got && /affiche-p1\.png$/.test(got.name), `PDF page imported as an image (${JSON.stringify(got)})`);
check(!!got && Math.abs(got.w / got.h - 0.707) < 0.01 && got.h >= 2000, 'A4 proportions at about 200 dpi');
// a broken PDF: a message, no exception
await page.evaluate(async () => {
  await window.__mockuplab.importFiles([new File(['not a pdf'], 'broken.pdf', { type: 'application/pdf' })]);
});
await page.waitForTimeout(800);
check(await page.getByText(/broken\.pdf/).first().isVisible(), 'broken PDF reported in a message');
await done(browser, errors.filter((e) => !/Invalid PDF|InvalidPDFException/.test(e)));
