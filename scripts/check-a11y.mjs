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
await p.goto('http://localhost:5173/#/');
await p.waitForTimeout(500);
report.push(await sweep('Accueil'));
await p.goto('http://localhost:5173/#/studio');
await p.waitForTimeout(800);
for (const tab of ['Appareils', 'Réglages', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque']) {
  await p.getByTestId('studio-rail').getByRole('tab', { name: tab, exact: true }).click();
  await p.waitForTimeout(300);
  report.push(await sweep(`Studio · ${tab}`));
}
await p.getByTestId('top-export').click();
await p.waitForTimeout(300);
report.push(await sweep('Exporter'));
await p.getByTestId('export-tab-video').click();
await p.waitForTimeout(300);
report.push(await sweep('Exporter · Vidéo'));
await p.keyboard.press('Escape');
await p.goto('http://localhost:5173/#/rapide');
await p.waitForTimeout(2500);
report.push(await sweep('Rapide'));
await p.goto('http://localhost:5173/#/projet');
await p.waitForTimeout(500);
await p.evaluate(async () => {
  const blob = await (await fetch('/samples/sample-web.png')).blob();
  await window.__mockuplab.pack.add([new File([blob], 'site.png', { type: 'image/png' })]);
});
await p.waitForTimeout(2500);
report.push(await sweep('Projet'));
await p.goto('http://localhost:5173/#/');
await p.waitForTimeout(800);
report.push(await sweep('Accueil + récents'));
for (const r of report) console.log(r.where.padEnd(20), r.bad.length ? `${r.bad.length} sans nom: ${[...new Set(r.bad)].join(', ')}` : 'ok');
if (report.some((r) => r.bad.length)) process.exitCode = 1;
await b.close();
