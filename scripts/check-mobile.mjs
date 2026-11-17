// scripts/check-mobile.mjs — the editor on a phone (375 × 812, touch): every mode fits the screen and works by finger.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/mobile', { recursive: true });
const { browser, page, errors } = await openApp({ hash: 'studio', viewport: { width: 375, height: 812 }, mobile: true });
await page.waitForTimeout(1500);
/** Nothing sticks out sideways: the page is no wider than the screen, and no visible element ends past its right edge. */
const overflow = () =>
  page.evaluate(() => {
    const w = window.innerWidth;
    const out = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.right > w + 1 && !el.closest('[data-scroll-x]');
    });
    return { doc: document.documentElement.scrollWidth > w, els: out.slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`) };
  });
const box = (sel) => page.locator(sel).first().boundingBox();

// 1. no "made for a computer" warning
check(!(await page.getByText(/écran d.ordinateur/).isVisible().catch(() => false)), 'no small-screen warning');

// 2. Studio: the scene, the top bar on one row, the pages as tabs at the bottom
let o = await overflow();
check(!o.doc && !o.els.length, `Studio fits the width (${o.els.join(', ')})`);
const tabs = await box('[data-testid="studio-rail"]');
check(tabs && tabs.width > tabs.height && tabs.y + tabs.height > 812 - 90, `the pages are a tab bar at the bottom (${JSON.stringify(tabs)})`);
const frame = await box('[data-testid="frame"]');
const sheet = await box('[data-testid="rail-page"]');
check(frame && frame.width > 200 && frame.height > 120, `the export frame keeps room (${frame && `${frame.width}×${frame.height}`})`);
check(sheet && frame && frame.y + frame.height <= sheet.y + 1, 'the frame sits above the page panel');
await page.screenshot({ path: 'out/mobile/studio.png' });
// tapping the open page folds the panel; the frame grows
await page.getByTestId('studio-rail').locator('[data-page="devices"]').tap();
await page.waitForTimeout(400);
const folded = await page.getByTestId('rail-page').isVisible().catch(() => false);
const frame2 = await box('[data-testid="frame"]');
check(!folded && frame2.y > frame.y, `tapping the open tab folds the panel and the frame moves into the freed space (${frame.y} → ${frame2.y})`);
await page.getByTestId('studio-rail').locator('[data-page="devices"]').tap();
await page.waitForTimeout(300);
check(await page.getByTestId('empty-hint').isVisible(), 'a touch screen gets « Choisir une image » instead of drag and paste');
await page.getByTestId('studio-rail').locator('[data-page="light"]').tap();
await page.waitForTimeout(400);
check(await page.getByTestId('rail-page').isVisible(), 'another tab opens its page');
await page.screenshot({ path: 'out/mobile/studio-light.png' });
// the export opens and fits
await page.getByTestId('top-export').tap();
await page.waitForTimeout(500);
const exp = await box('[role="dialog"]');
check(exp && exp.x >= 0 && exp.x + exp.width <= 375 && exp.height <= 812, `the export window fits the screen (${JSON.stringify(exp)})`);
await page.screenshot({ path: 'out/mobile/export.png' });
// a 4K image comes out of a phone too
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('dialog').getByRole('button', { name: 'Télécharger' }).tap()]);
check(/\.png$/.test(download.suggestedFilename()), `the export downloads (${download.suggestedFilename()})`);
await page.waitForTimeout(800);
if (await page.getByRole('dialog').isVisible().catch(() => false)) await page.keyboard.press('Escape');
await page.waitForTimeout(300);
// Ideas: the window of variations fits too
await page.getByTestId('open-variants').tap();
await page.waitForTimeout(2500);
const ideas = await box('[role="dialog"]');
check(ideas && ideas.x >= 0 && ideas.x + ideas.width <= 375, `the Ideas window fits the width (${JSON.stringify(ideas)})`);
await page.screenshot({ path: 'out/mobile/ideas.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
// the guide: each card stays on screen
await page.getByTestId('more-menu').tap();
await page.waitForTimeout(200);
await page.getByTestId('start-tour').tap();
await page.waitForTimeout(800);
for (let i = 0; i < 12; i++) {
  const card = await box('[data-testid="tour-card"]');
  if (!card) break;
  check(card.x >= 0 && card.x + card.width <= 375 && card.y >= 0 && card.y + card.height <= 812, `guide step ${i + 1} stays on screen (${Math.round(card.x)},${Math.round(card.y)} ${Math.round(card.width)}×${Math.round(card.height)})`);
  await page.screenshot({ path: `out/mobile/tour-${i + 1}.png` });
  await page.getByTestId('tour-next').tap();
  await page.waitForTimeout(500);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 3. the mode switch reaches Rapide
await page.getByTestId('mode-switch').tap();
await page.waitForTimeout(200);
await page.getByRole('menuitemradio', { name: 'Rapide' }).tap();
await page.waitForTimeout(3500);
check(page.url().endsWith('/rapide'), `the mode menu opens Rapide (${page.url()})`);
o = await overflow();
check(!o.doc && !o.els.length, `Rapide fits the width (${o.els.join(', ')})`);
await page.locator('[data-testid="quick-tile"] img').first().waitFor({ timeout: 20000 });
const tile = await box('[data-testid="quick-tile"]');
check(tile && tile.width > 300, `one shot per row (${tile?.width})`);
// shown outright (not at opacity 0 waiting for a hover)
const dl = page.getByTestId('quick-tile').first().getByRole('button', { name: 'Télécharger' }).filter({ visible: true }).first();
const shown = await dl.evaluate((el) => { for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0' || getComputedStyle(n).display === 'none') return false; return true; }).catch(() => false);
check(shown, 'a shot’s download button shows without hover');
await page.screenshot({ path: 'out/mobile/quick.png', fullPage: false });

// 4. Projet
await page.getByTestId('mode-switch').tap();
await page.waitForTimeout(200);
await page.getByRole('menuitemradio', { name: 'Projet' }).tap();
await page.waitForTimeout(1500);
o = await overflow();
check(!o.doc && !o.els.length, `Projet fits the width (${o.els.join(', ')})`);
// a touch screen opens the system picker straight away (no drop zone to drop on)
const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.getByTestId('project-add').tap()]);
await chooser.setFiles(['public/samples/sample-web.png', 'public/samples/sample-app.png', 'public/samples/sample-poster.png']);
await page.waitForTimeout(800);
check((await page.getByTestId('project-file').count()) === 3, 'three images added through the system picker');
await page.locator('[data-testid="pack-item"] img').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1500);
o = await overflow();
check(!o.doc && !o.els.length, `Projet with images fits the width (${o.els.join(', ')})`);
check(await page.getByTestId('pack-item').first().getByRole('button', { name: 'Télécharger' }).filter({ visible: true }).count() > 0, 'a pack scene shows its actions without hover');
await page.screenshot({ path: 'out/mobile/project.png' });
await page.getByTestId('project-file').first().screenshot({ path: 'out/mobile/project-row.png' });

await done(browser, errors);
