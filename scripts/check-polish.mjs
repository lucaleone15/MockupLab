// scripts/check-polish.mjs — 1.0.1 polish: no monospace font in the UI, blue-only UI accents, one-font logo,
// the app icon everywhere, the merged "Fond" decor, the real-mock-up home page, and a 3-file release.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { openApp, check, done } from './lib/app.mjs';

// --- static checks -------------------------------------------------------
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const ui = walk('src').filter((f) => /\.(tsx?|css)$/.test(f) && !/src\/(models|i18n)\//.test(f) && !/(brandDraw|brandArt|brandFonts|backgroundPresets|patterns|overlays|useScreenMaterial)\.ts$/.test(f) && !/store\/project\.ts$/.test(f)); // content (sample palette, default wallpaper), not UI
const orange = ui.filter((f) => /ff5c35|255,\s*92,\s*53|255 92 53/i.test(readFileSync(f, 'utf8').replace(/--brand:\s*#ff5c35;/gi, '')));
check(orange.length === 0, `no orange in the interface code (${orange.join(', ')})`);
const yml = readFileSync('electron-builder.yml', 'utf8');
check(/arch:\s*\[?universal/.test(yml) && !/target:\s*zip/.test(yml), 'macOS: one universal dmg, no zip');
check(/MockupLab-Mac\.\$\{ext\}/.test(yml) && /MockupLab-Windows\.\$\{ext\}/.test(yml), 'clear file names (MockupLab-Mac.dmg, MockupLab-Windows.exe)');
check(/differentialPackage:\s*false/.test(yml) && /writeUpdateInfo:\s*false/.test(yml), 'no blockmap files');
const { isNewer } = createRequire(import.meta.url)('../desktop/update-check.cjs');
check(isNewer('1.0.1', '1.0.0') && isNewer('v1.2.0', '1.1.9') && !isNewer('1.0.0', '1.0.0') && !isNewer('0.9.9', '1.0.0'), 'version comparison for the macOS update check');

// --- in the app ----------------------------------------------------------
const { browser, page, errors } = await openApp({ colorScheme: 'light' });
const monoOnScreen = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getClientRects().length && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter((el) => /mono/i.test(getComputedStyle(el).fontFamily))
      .map((el) => el.tagName + ':' + el.textContent.trim().slice(0, 20)),
  );
// home: real mock-ups, “Open the Studio” in the first screen, the icon
await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=home-hero] img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => [...document.querySelectorAll('[data-testid=home-hero] img')].some((i) => /showcase\//.test(i.src) && i.naturalWidth >= 1200)), 'home hero shows a real rendered mock-up');
check((await page.locator('[data-testid=showcase-strip] img').count()) >= 5, 'strip of real mock-ups');
const cta = await page.getByRole('button', { name: 'Ouvrir le Studio', exact: true }).boundingBox();
check(!!cta && cta.y + cta.height <= 900, '“Open the Studio” visible without scrolling');
check(await page.evaluate(() => /icons\/(favicon|icon)/.test(document.querySelector('link[rel=icon]')?.getAttribute('href') ?? '')), 'favicon is the app icon');
check(await page.evaluate(() => !!document.querySelector('[data-testid=logo] img[src*="icons/"]')), 'logo mark is the app icon');
const weights = await page.evaluate(() => [...document.querySelectorAll('[data-testid=logo] span span')].map((s) => getComputedStyle(s).fontWeight + getComputedStyle(s).fontFamily));
check(weights.length === 2 && weights[0] === weights[1], `logo in one font and weight (${weights.join(' | ')})`);
let mono = await monoOnScreen();
// studio pages
await page.evaluate(() => (location.hash = '#/studio'));
await page.waitForSelector('[data-testid=studio-rail]');
for (const tab of ['Appareils', 'Réglages', 'Décor', 'Lumière', 'Caméra', 'Marque', 'Vidéo']) {
  await page.getByTestId('studio-rail').getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
  mono = mono.concat(await monoOnScreen());
}
// Décor page: the background colour, then what the device stands on (3 choices); the background stays editable with the table
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Décor', exact: true }).click();
await page.waitForTimeout(200);
const titles = (await page.getByTestId('rail-page').getByRole('heading', { level: 3 }).allTextContents()).map((s) => s.trim());
check(JSON.stringify(titles.slice(0, 2)) === JSON.stringify(['Couleur du fond', 'Sur quoi poser l’appareil ?']), `Décor page order ${JSON.stringify(titles)}`);
const kinds = await page.locator('[data-testid^="support-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(8)));
check(JSON.stringify(kinds) === JSON.stringify(['sweep', 'podium', 'table']), `set choices ${JSON.stringify(kinds)}`);
await page.evaluate(() => window.__mockuplab.project.getState().setBackground({ kind: 'gradient', type: 'linear', stops: [{ color: '#000000', at: 0 }, { color: '#ffffff', at: 1 }], angle: 90 }));
await page.getByTestId('support-podium').click();
await page.getByTestId('support-sweep').click();
await page.waitForTimeout(200);
check((await page.evaluate(() => window.__mockuplab.project.getState().decor.kind)) === 'sweep', 'Studio set works with a gradient');
await page.getByTestId('support-table').click();
await page.waitForTimeout(300);
check((await page.getByTestId('rail-page').getByRole('radio', { name: 'Dégradé' }).count()) > 0, 'with the table, the background is still editable');
check((await page.getByText('Couleur du mur').count()) === 0 && (await page.getByText('Le mur de la table sert de fond').count()) === 0, 'no separate wall colour for the table');
await page.getByTestId('support-sweep').click();
check(mono.length === 0, `no monospace text in the interface (${[...new Set(mono)].slice(0, 6).join(', ')})`);
// every mode says what it is for while it is empty
for (const [path, screen] of [['/studio', 'studio'], ['/rapide', 'quick'], ['/projet', 'project']]) {
  await page.evaluate((p) => { history.pushState(null, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(500);
  check(await page.getByTestId('mode-role').first().isVisible().catch(() => false), `${screen}: empty state says what the mode is for`);
}
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);
check(await page.getByRole('button', { name: 'Varier ma scène' }).isVisible(), 'Studio: “Vary my scene” button');
// once the scene has a design of the user's, the role line goes (it only explains an empty Studio)
await page.evaluate(async () => {
  const api = window.__mockuplab;
  const s = api.project.getState();
  s.resetAll();
  s.addItem('poster');
  await api.loadSamples(api.project.getState().items[0].id);
  api.project.getState().addItem('business-card');
});
await page.waitForTimeout(400);
check(!(await page.getByTestId('mode-role').first().isVisible().catch(() => false)), 'Studio: no role line over a scene that already has a design');
// the sample brand says it is a sample, and can be cleared in one click
await page.evaluate(() => { history.pushState(null, '', '/projet'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(500);
check(await page.getByText('Marque d’exemple').first().isVisible().catch(() => false), 'the sample brand is labelled as a sample');
await page.getByRole('button', { name: 'Partir de zéro' }).click();
await page.waitForTimeout(200);
check((await page.getByPlaceholder('Nom de la marque').inputValue()) === '' && !(await page.getByText('Marque d’exemple').first().isVisible().catch(() => false)), '“Start from scratch” clears the sample brand');
await done(browser, errors);
