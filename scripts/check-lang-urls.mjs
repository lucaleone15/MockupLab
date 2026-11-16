// scripts/check-lang-urls.mjs — one address per language: / is French, /en/ is English. The address wins over
// the saved choice and the browser language; switching language rewrites the address and survives a reload.
import { chromium } from 'playwright';
import { check } from './lib/app.mjs';

const ORIGIN = 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const errors = [];

/** A fresh page with a saved language and a browser locale. */
async function open(path, { saved, locale = 'en-US' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((saved) => {
    if (!sessionStorage.getItem('fresh')) {
      localStorage.clear();
      sessionStorage.setItem('fresh', '1');
      if (saved) localStorage.setItem('mockuplab:lang', saved);
    }
  }, saved);
  await page.goto(ORIGIN + path);
  await page.waitForFunction(() => window.__mockuplab);
  await page.waitForTimeout(600);
  return page;
}
const state = (page) =>
  page.evaluate(() => ({ lang: document.documentElement.lang, path: location.pathname, screen: window.__mockuplab.ui.getState().screen }));

let page = await open('/en/', { saved: 'fr', locale: 'fr-FR' });
let s = await state(page);
check(s.lang === 'en' && s.path === '/en/', `/en/ is English even with French saved (${JSON.stringify(s)})`);
check(await page.getByText('The photo studio for your designs.').first().isVisible(), '/en/ shows the English landing title');
const icons = await page.evaluate(() => [...document.querySelectorAll('link[rel~=icon], link[rel=apple-touch-icon]')].map((l) => l.href));
check(icons.length >= 3 && icons.every((h) => new URL(h).pathname.startsWith('/icons/')), `icons resolve to /icons/ from /en/ (${icons.join(', ')})`);

page = await open('/', { saved: 'en', locale: 'en-US' });
s = await state(page);
check(s.lang === 'fr' && s.path === '/', `/ is French even with English saved and an English browser (${JSON.stringify(s)})`);

page = await open('/en/studio', { saved: 'fr' });
s = await state(page);
check(s.screen === 'studio' && s.lang === 'en' && s.path === '/en/studio', `/en/studio opens the Studio in English (${JSON.stringify(s)})`);
await page.getByTestId('frame').waitFor();

page = await open('/rapide', { saved: 'en' });
s = await state(page);
check(s.screen === 'quick' && s.lang === 'fr', `/rapide opens Rapide in French (${JSON.stringify(s)})`);

page = await open('/studio', { saved: 'fr' });
await page.getByTestId('more-menu').first().click();
await page.getByRole('menuitemradio', { name: 'English' }).click();
await page.waitForTimeout(400);
s = await state(page);
check(s.path === '/en/studio' && s.lang === 'en', `choosing English moves to /en/studio (${JSON.stringify(s)})`);
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(500);
s = await state(page);
check(s.path === '/en/studio' && s.lang === 'en' && s.screen === 'studio', `reload keeps English and the Studio (${JSON.stringify(s)})`);
await page.getByTestId('more-menu').first().click();
await page.getByRole('menuitemradio', { name: 'Français' }).click();
await page.waitForTimeout(400);
s = await state(page);
check(s.path === '/studio' && s.lang === 'fr', `choosing Français moves back to /studio (${JSON.stringify(s)})`);

page = await open('/en/', { saved: 'en' });
await page.evaluate(() => window.__mockuplab.ui.getState().screen);
await page.goto(ORIGIN + '/en/studio');
await page.waitForFunction(() => window.__mockuplab);
await page.goBack();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(400);
s = await state(page);
check(s.path === '/en/' && s.screen === 'home', `back from /en/studio returns to /en/ (${JSON.stringify(s)})`);

page = await open('/#/studio', { saved: 'fr' });
s = await state(page);
check(s.path === '/studio' && s.screen === 'studio', `old /#/studio link becomes /studio (${JSON.stringify(s)})`);

page = await open('/en/#/studio', { saved: 'fr' });
s = await state(page);
check(s.path === '/en/studio' && s.lang === 'en', `old /en/#/studio link becomes /en/studio (${JSON.stringify(s)})`);

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
