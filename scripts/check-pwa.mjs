// scripts/check-pwa.mjs — installable PWA: service worker, works offline, proposes updates (never forces them).
// Builds twice and serves dist with `vite preview` on :4173.
import { execSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { check } from './lib/app.mjs';
const URL = 'http://localhost:4173/MockupLab/';
const build = (id) => execSync('npx vite build', { env: { ...process.env, BUILD_ID: id }, stdio: 'pipe' });
build('first');
const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('mockuplab:lang', 'fr'));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(URL);
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 20000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  check(true, 'service worker controls the page');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
    return href ? (await fetch(href)).json() : null;
  });
  check(manifest?.name === 'MockupLab' && manifest.icons?.length >= 3 && manifest.display === 'standalone', 'web app manifest (name, icons, standalone)');
  const build1 = await page.evaluate(() => window.__BUILD_ID__);
  // offline
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('[data-testid=home]', { timeout: 15000 }).catch(() => {});
  check(await page.getByTestId('home').isVisible(), 'the app opens offline');
  await ctx.setOffline(false);
  // a new version is published
  build('second');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForSelector('[data-testid=update-banner]', { timeout: 20000 }).catch(() => {});
  check(await page.getByTestId('update-banner').isVisible(), 'update banner shown when a new version exists');
  await page.getByTestId('update-banner').getByRole('button', { name: /Plus tard/ }).click();
  check(!(await page.getByTestId('update-banner').isVisible()) && (await page.evaluate(() => window.__BUILD_ID__)) === build1, '"Plus tard" hides it without reloading');
  await page.evaluate(() => window.__mockuplabUpdate?.show());
  await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.getByTestId('update-banner').getByRole('button', { name: /Mettre à jour/ }).click()]);
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => window.__BUILD_ID__)) === 'second', 'updating loads the new version');
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
} finally {
  await b.close();
  preview.kill();
}
