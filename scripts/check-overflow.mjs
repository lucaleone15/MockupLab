// scripts/check-overflow.mjs — no text spills out of, or wraps inside, a choice button (segmented controls, chips,
// tabs, menus) anywhere: every model's settings, every Studio page with its advanced settings open, the Export
// window, the catalogue, Quick and Project. Usage: node scripts/check-overflow.mjs [fr|en]
import { openApp, check, done } from './lib/app.mjs';
const lang = process.argv[2] ?? 'fr';
const { browser, page, errors } = await openApp({ hash: '#/studio', lang });

/** Buttons whose text wraps to a second line or overflows the button, in `root` (a selector). */
const audit = (where) =>
  page.evaluate((where) => {
    const bad = [];
    const buttons = document.querySelectorAll('[role="radio"], [role="tab"], [role="menuitemradio"], [role="menuitem"], button');
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(b).visibility === 'hidden') continue;
      const text = b.innerText.trim();
      if (!text) continue;
      // overflow: the content is wider than the button
      const over = b.scrollWidth > b.clientWidth + 1;
      // wrap: one run of text broken over two rows (an icon above a label is not a wrap)
      let wraps = false;
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rows = new Set([...range.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top)));
        if (rows.size > 1) wraps = true;
      }
      // a tall button (a title and its description) may wrap: only one-line controls are held to it
      if (r.height >= 40) wraps = false;
      if (over || wraps) bad.push(`${where}: « ${text.replace(/\s+/g, ' ').slice(0, 40)} » ${over ? 'overflows' : 'wraps'} (${Math.round(r.width)} px)`);
    }
    return bad;
  }, where);

const issues = new Set();
const record = (list) => list.forEach((x) => issues.add(x));
const openAdvanced = async () => {
  for (const b of await page.getByRole('button', { name: /Paramètres avancés|Advanced settings/ }).all()) {
    if ((await b.getAttribute('aria-expanded')) === 'false') await b.click().catch(() => {});
  }
  await page.waitForTimeout(150);
};

// every model's settings
const models = await page.evaluate(() => window.__mockuplab.models.map((m) => m.id));
for (const id of models) {
  await page.evaluate((id) => {
    const s = window.__mockuplab.project.getState();
    s.resetAll();
    s.addItem(id);
    window.__mockuplab.ui.getState().setStudioPage('settings');
  }, id);
  await page.waitForTimeout(250);
  await openAdvanced();
  record(await audit(`settings/${id}`));
}

// every Studio page, advanced settings open
for (const p of ['devices', 'decor', 'light', 'camera', 'text', 'brand']) {
  await page.evaluate((p) => window.__mockuplab.ui.getState().setStudioPage(p), p);
  await page.waitForTimeout(250);
  await openAdvanced();
  record(await audit(`page/${p}`));
}
// the décor page with each support and each background kind
for (const kind of ['sweep', 'podium', 'table']) {
  await page.evaluate((kind) => {
    window.__mockuplab.project.getState().setDecor({ kind });
    window.__mockuplab.ui.getState().setStudioPage('decor');
  }, kind);
  await page.waitForTimeout(250);
  await openAdvanced();
  record(await audit(`decor/${kind}`));
}

// the Format menu, the Export window (both tabs), the catalogue
await page.getByTestId('format-menu').click();
await page.waitForTimeout(200);
record(await audit('format-menu'));
await page.keyboard.press('Escape');
await page.getByTestId('top-export').click();
for (const tab of ['image', 'video']) {
  await page.getByTestId(`export-tab-${tab}`).click();
  await page.waitForTimeout(250);
  record(await audit(`export/${tab}`));
}
await page.keyboard.press('Escape');
await page.evaluate(() => window.__mockuplab.ui.getState().setStudioPage('devices'));
await page.getByTestId('add-device').click();
for (const f of await page.locator('[data-testid^="catalogue-family-"]').all()) {
  await f.click();
  await page.waitForTimeout(150);
  record(await audit(`catalogue/${await f.innerText()}`));
}
await page.keyboard.press('Escape');

// Quick and Project
for (const path of ['/rapide', '/projet']) {
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  record(await audit(path));
}

for (const i of issues) console.log('  ', i);
check(issues.size === 0, `no choice button with text that wraps or spills (${issues.size} found)`);
await done(browser, errors);
