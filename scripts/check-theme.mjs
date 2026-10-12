// scripts/check-theme.mjs — Auto follows the system, forced themes persist and do not follow it.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ colorScheme: 'light' });
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
check((await theme()) === 'light', 'auto + system light → light');
check((await bg()) === '#f5f5f7', `light --bg is #f5f5f7 (got ${await bg()})`);
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(200);
check((await theme()) === 'dark', 'auto follows a system switch to dark without reload');
await page.evaluate(() => window.__mockuplab.ui.getState().setThemePref('light'));
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(200);
check((await theme()) === 'light', 'forced light ignores the system');
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
check((await theme()) === 'light', 'forced light survives a reload');
check((await page.evaluate(() => localStorage.getItem('mockuplab:theme'))) === 'light', 'pref stored');
const font = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-display'));
check(/Syne/.test(font), 'display font is Syne');
// hint text (--fg-subtle) stays readable on panels in both themes (≥ 3:1)
const contrast = () =>
  page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const hex = (v) => v.trim().replace('#', '');
    const lum = (h) => {
      const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const fg = lum(hex(css.getPropertyValue('--fg-subtle')));
    const bg = document.documentElement.dataset.theme === 'dark' ? lum('25252b') : lum('ffffff');
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
for (const p of ['light', 'dark']) {
  await page.evaluate((p) => window.__mockuplab.ui.getState().setThemePref(p), p);
  const c = await contrast();
  check(c >= 3, `${p}: --fg-subtle contrast ${c.toFixed(2)} ≥ 3`);
}
await done(browser, errors);
