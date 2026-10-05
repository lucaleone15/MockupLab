// Accessibility sweep: every button, link, input and slider of each tab and mode has an accessible name.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => {
  indexedDB.deleteDatabase('mockuplab');
  localStorage.setItem('mockuplab:lang', 'fr');
});
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(800);
const sweep = (where) =>
  p.evaluate((where) => {
    const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent || '').trim() || (el.querySelector('img[alt]')?.getAttribute('alt') ?? '').trim();
    const bad = [];
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), [role=slider], [role=switch], [role=radio], textarea, select')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let name = nameOf(el);
      if (!name && el.id) name = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ?? '';
      if (!name && el.closest('label')) name = el.closest('label').textContent.trim();
      if (!name && el instanceof HTMLInputElement && el.placeholder) name = el.placeholder;
      if (!name) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
    }
    return { where, bad };
  }, where);
const report = [];
for (const tab of ['Appareil', 'Scène', 'Marque', 'Export']) {
  await p.getByRole('radio', { name: tab, exact: true }).first().click();
  await p.waitForTimeout(300);
  report.push(await sweep(`3D · ${tab}`));
}
await p.getByTestId('mode-switch').getByRole('radio', { name: 'Photo' }).click();
await p.evaluate(async () => {
  const api = window.__mockuplab;
  await api.photo.applyTemplate(api.photo.templates[0]);
});
await p.waitForTimeout(800);
report.push(await sweep('Photo'));
for (const r of report) console.log(r.where.padEnd(14), r.bad.length ? `${r.bad.length} sans nom: ${[...new Set(r.bad)].join(', ')}` : 'ok');
await b.close();
