// scripts/lib/app.mjs — shared helpers for the check-* scripts (dev server on :5173).
import { chromium } from 'playwright';

/** Opens the app on a fresh profile. `hash` like '#/studio'. */
export async function openApp({ hash = '', lang = 'fr', colorScheme = 'dark', fresh = true, viewport = { width: 1440, height: 900 }, init } = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
  const context = await browser.newContext({ viewport, colorScheme, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(
    ({ fresh, lang }) => {
      if (fresh && !sessionStorage.getItem('fresh')) {
        indexedDB.deleteDatabase('mockuplab');
        localStorage.clear();
        sessionStorage.setItem('fresh', '1');
      }
      localStorage.setItem('mockuplab:lang', lang);
    },
    { fresh, lang },
  );
  if (init) await page.addInitScript(init);
  await page.goto(`http://localhost:5173/${hash}`);
  await page.waitForFunction(() => window.__mockuplab);
  await page.waitForTimeout(600);
  return { browser, context, page, errors };
}

export function check(cond, label) {
  if (cond) console.log('✓', label);
  else {
    console.error('✗', label);
    process.exitCode = 1;
  }
}

export async function done(browser, errors) {
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}
