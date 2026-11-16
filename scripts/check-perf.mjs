// scripts/check-perf.mjs — the landing loads only what it shows, and is fast on a phone.
// Needs the production build served at the URL (default: `npx vite preview --port 4173` → http://localhost:4173/).
// Usage: node scripts/check-perf.mjs [url] [--no-lighthouse]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { check } from './lib/app.mjs';

const url = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'http://localhost:4173/';
const MAX_KB = 2500;
mkdirSync('out/perf', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const requests = [];
let bytes = 0;
page.on('requestfinished', async (r) => {
  requests.push(r.url());
  try {
    bytes += (await r.sizes()).responseBodySize;
  } catch {
    /* gone */
  }
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(4000);
await browser.close();

const paths = requests.map((u) => new URL(u).pathname);
const loaded = (re) => paths.filter((p) => re.test(p));
for (const [label, re] of [
  ['PDF reader', /\/assets\/pdf/],
  ['video export', /\/assets\/(video|mediabunny|gifenc)/],
  ['table/wood/marble textures', /\/assets\/materials\//],
  ['studio lighting maps', /\/assets\/light\//],
  ['Studio screen code', /\/assets\/(StudioScreen|studio)-/i],
]) {
  const hits = loaded(re);
  check(hits.length === 0, `landing does not load the ${label}${hits.length ? ': ' + hits.slice(0, 3).join(', ') : ''}`);
}
check(bytes / 1024 < MAX_KB, `landing transfers ${Math.round(bytes / 1024)} KB (< ${MAX_KB} KB)`);

if (!process.argv.includes('--no-lighthouse')) {
  execSync(
    `npx -y lighthouse@12 ${url} --only-categories=performance --form-factor=mobile --output=json --output-path=out/perf/after.json --chrome-flags="--headless=new" --quiet`,
    { stdio: 'inherit' },
  );
  const { audits: a, categories } = JSON.parse(readFileSync('out/perf/after.json', 'utf8'));
  const lcp = a['largest-contentful-paint'].numericValue;
  const cls = a['cumulative-layout-shift'].numericValue;
  const tbt = a['total-blocking-time'].numericValue;
  console.log(`Lighthouse mobile: score ${categories.performance.score}, FCP ${a['first-contentful-paint'].displayValue}`);
  check(lcp < 2500, `LCP ${Math.round(lcp)} ms < 2500 ms`);
  check(cls < 0.1, `CLS ${cls.toFixed(3)} < 0.1`);
  check(tbt < 300, `TBT ${Math.round(tbt)} ms < 300 ms`);
}
