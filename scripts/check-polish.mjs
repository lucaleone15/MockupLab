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
// home: real mock-ups, the drop zone in the first screen, the icon
await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=home-hero] img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
check(await page.evaluate(() => [...document.querySelectorAll('[data-testid=home-hero] img')].some((i) => /showcase\//.test(i.src) && i.naturalWidth >= 1200)), 'home hero shows a real rendered mock-up');
check((await page.locator('[data-testid=showcase-strip] img').count()) >= 5, 'strip of real mock-ups');
const drop = await page.getByTestId('home-drop').boundingBox();
check(!!drop && drop.y + drop.height <= 900, 'drop zone visible without scrolling');
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
// decor: Fond · Podium · Surface · Table, with the studio cyclo as an option of Fond
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Décor', exact: true }).click();
const kinds = (await page.getByTestId('decor-kinds').getByRole('button').allTextContents()).map((s) => s.trim());
check(JSON.stringify(kinds) === JSON.stringify(['Fond', 'Podium', 'Surface', 'Table']), `decor choices ${JSON.stringify(kinds)}`);
await page.getByTestId('decor-kinds').getByRole('button', { name: 'Fond' }).click();
await page.evaluate(() => window.__mockuplab.project.getState().setBackground({ kind: 'solid', color: '#334455' }));
await page.waitForTimeout(200);
await page.getByRole('switch', { name: /Cyclo studio/ }).click();
let d = await page.evaluate(() => { const s = window.__mockuplab.project.getState(); return { kind: s.decor.kind, color: s.decor.color }; });
check(d.kind === 'sweep' && d.color.toLowerCase() === '#334455', `cyclo on: studio backdrop in the background colour (${JSON.stringify(d)})`);
await page.evaluate(() => window.__mockuplab.project.getState().setBackground({ kind: 'solid', color: '#aa2200' }));
await page.waitForTimeout(200);
d = await page.evaluate(() => window.__mockuplab.project.getState().decor);
check(d.color.toLowerCase() === '#aa2200', 'cyclo follows the background colour');
await page.evaluate(() => window.__mockuplab.project.getState().setBackground({ kind: 'gradient', stops: [{ color: '#000000', at: 0 }, { color: '#ffffff', at: 1 }], angle: 90, mode: 'linear' }));
await page.waitForTimeout(200);
check((await page.evaluate(() => window.__mockuplab.project.getState().decor.kind)) === 'none', 'a gradient turns the cyclo off');
check(mono.length === 0, `no monospace text in the interface (${[...new Set(mono)].slice(0, 6).join(', ')})`);
await done(browser, errors);
