// scripts/check-prod.mjs — the production build as visitors get it (Netlify, or `vite preview` locally):
// every address opens the right screen in the right language, the files crawlers read are there, the
// headers are set (on Netlify), a sample scene exports, and no request fails.
// Usage: node scripts/check-prod.mjs [url]   (default http://localhost:4173/)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { check } from './lib/app.mjs';

mkdirSync('out/prod', { recursive: true });
const url = (process.argv[2] ?? 'http://localhost:4173/').replace(/\/?$/, '/');
const remote = url.startsWith('https://');
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const failed = [];
const errors = [];
const watch = (p) => {
  p.on('requestfailed', (r) => !/favicon|chrome-extension/.test(r.url()) && failed.push(`${r.failure()?.errorText} ${r.url()}`));
  p.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  p.on('pageerror', (e) => errors.push(e.message));
};

// every address: right screen, right language, status 200
const SCREENS = { '': 'home', studio: 'frame', rapide: 'quick-screen', projet: 'project-screen' };
for (const lang of ['fr', 'en']) {
  for (const [path, testid] of Object.entries(SCREENS)) {
    const p = await ctx.newPage();
    watch(p);
    const address = url + (lang === 'en' ? 'en/' : '') + path;
    const res = await p.goto(address);
    const ok = await p.getByTestId(testid).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
    const htmlLang = await p.evaluate(() => document.documentElement.lang);
    check(res?.status() === 200 && ok && htmlLang === lang, `${address} → ${testid}, ${htmlLang} (${res?.status()})`);
    await p.close();
  }
}

// files for crawlers
for (const [file, type] of [['robots.txt', 'text/plain'], ['sitemap.xml', 'xml'], ['llms.txt', 'text/plain'], ['og/og-fr.png', 'image/png'], ['manifest.webmanifest', 'manifest']]) {
  const r = await ctx.request.get(url + file);
  check(r.status() === 200 && (r.headers()['content-type'] ?? '').includes(type), `${file} served (${r.status()}, ${r.headers()['content-type']})`);
}

// headers (Netlify only: vite preview sets none)
if (remote) {
  const home = await ctx.request.get(url);
  const asset = (await home.text()).match(/\/assets\/[\w.-]+\.js/)?.[0];
  const a = await ctx.request.get(new URL(asset, url).href);
  check(/immutable/.test(a.headers()['cache-control'] ?? ''), `hashed assets cached for good (${a.headers()['cache-control']})`);
  check(/no-cache/.test(home.headers()['cache-control'] ?? ''), `pages always revalidated (${home.headers()['cache-control']})`);
  check(home.headers()['x-content-type-options'] === 'nosniff' && home.headers()['x-frame-options'] === 'DENY', 'security headers');
}

// a sample scene, exported in 1080p
const p = await ctx.newPage();
watch(p);
await p.addInitScript(() => localStorage.setItem('mockuplab:askName', '0'));
const t0 = Date.now();
await p.goto(url + 'studio');
await p.getByTestId('frame').waitFor();
console.log('Studio ready in', Date.now() - t0, 'ms');
await p.getByRole('button', { name: 'Essayer un exemple' }).click();
await p.waitForTimeout(3500);
await p.screenshot({ path: 'out/prod/studio.png' });
await p.getByTestId('top-export').click();
await p.getByTestId('export-sheet').getByRole('radio', { name: '1080p', exact: true }).click();
const t1 = Date.now();
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ }).click()]);
await dl.saveAs('out/prod/' + dl.suggestedFilename());
check(/\.png$/.test(dl.suggestedFilename()), `export 1080p in ${Date.now() - t1} ms (${dl.suggestedFilename()})`);

check(failed.length === 0, `no failed request${failed.length ? ': ' + failed.slice(0, 5).join(' | ') : ''}`);
check(errors.length === 0, `no page error${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await b.close();
