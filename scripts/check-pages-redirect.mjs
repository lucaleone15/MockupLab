// scripts/check-pages-redirect.mjs — the old address (lucaleone15.github.io/MockupLab/…) sends everyone to
// https://mockuplab3d.netlify.app on the same screen, including people whose browser still runs the old
// installed app (its service worker is replaced by one that clears itself and reloads).
// A local server stands in for GitHub Pages under /MockupLab/; Netlify is stubbed.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { check } from './lib/app.mjs';

const SITE = 'https://mockuplab3d.netlify.app';
let site = 'old'; // what "GitHub Pages" serves: the old app, then the redirect folder
const OLD = {
  'index.html': `<!doctype html><title>old app</title><h1 id="old">OLD APP</h1>
    <script>navigator.serviceWorker.register('/MockupLab/sw.js', { scope: '/MockupLab/' })</script>`,
  // the old app's worker: caches the page and serves it from cache, like the real PWA
  'sw.js': `self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open('old').then((c) => c.add('/MockupLab/'))); });
    self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', (e) => { if (e.request.mode === 'navigate') e.respondWith(caches.match('/MockupLab/').then((r) => r || fetch(e.request))); });`,
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/^\/MockupLab\/?/, '') || 'index.html';
  const type = path.endsWith('.js') ? 'text/javascript' : 'text/html';
  if (site === 'old') {
    const body = OLD[path] ?? OLD['index.html'];
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(body);
    return;
  }
  const file = join('scripts/pages-redirect', path);
  // GitHub Pages: unknown paths get 404.html with status 404
  if (existsSync(file)) res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }).end(readFileSync(file));
  else res.writeHead(404, { 'content-type': 'text/html' }).end(readFileSync('scripts/pages-redirect/404.html'));
});
await new Promise((r) => server.listen(4300, r));
const OLD_URL = 'http://localhost:4300/MockupLab/';

const browser = await chromium.launch();
const errors = [];
async function landing(context, path) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(OLD_URL.replace(/\/$/, '') + path);
  await page.waitForURL((u) => u.href.startsWith(SITE), { timeout: 10000 }).catch(() => {});
  const href = page.url();
  await page.close();
  return href;
}
const stubbed = async () => {
  const context = await browser.newContext();
  await context.route(`${SITE}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>netlify</h1>' }));
  return context;
};

// 1. plain visitors
site = 'redirect';
let ctx = await stubbed();
check((await landing(ctx, '/')) === `${SITE}/`, '/MockupLab/ → netlify /');
check((await landing(ctx, '/studio')) === `${SITE}/studio`, '/MockupLab/studio → netlify /studio');
check((await landing(ctx, '/rapide?x=1')) === `${SITE}/rapide?x=1`, 'query kept (/rapide?x=1)');
check((await landing(ctx, '/#/projet')) === `${SITE}/projet`, 'old #/projet link → netlify /projet');
check((await landing(ctx, '/en/studio')) === `${SITE}/en/studio`, '/MockupLab/en/studio → netlify /en/studio');
const html = readFileSync('scripts/pages-redirect/index.html', 'utf8');
check(html.includes(`<link rel="canonical" href="${SITE}/">`) && /<meta name="robots" content="noindex">/.test(html), 'redirect page: canonical to Netlify, not indexed');
await ctx.close();

// 2. a visitor whose browser runs the old installed app
site = 'old';
ctx = await stubbed();
const page = await ctx.newPage();
await page.goto(OLD_URL);
await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });
await page.reload();
check((await page.locator('#old').count()) === 1, 'old app installed and served by its worker');
site = 'redirect';
// next visit: the browser checks the worker, gets the clearing one, which reloads the page → redirect
await page.goto(OLD_URL + 'studio');
await page.waitForURL((u) => u.href.startsWith(SITE), { timeout: 15000 }).catch(() => {});
check(page.url() === `${SITE}/studio`, `old installed app ends on netlify /studio (${page.url()})`);
const left = await ctx.newPage();
await left.goto('http://localhost:4300/MockupLab/sw.js');
const regs = await left.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).length }));
check(regs.regs === 0 && regs.caches === 0, `old worker and caches removed (${JSON.stringify(regs)})`);

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
server.close();
