// scripts/check-seo.mjs — what search engines and AI crawlers read in the built site (dist/), without a browser:
// a prerendered landing per language with its metadata, structured data, robots.txt, sitemap.xml, llms.txt.
// Usage: npm run build && node scripts/check-seo.mjs
import { existsSync, readFileSync } from 'node:fs';
import { check } from './lib/app.mjs';
import { HEAD, SITE_URL } from './seo.mjs';
import { fr } from '../src/i18n/fr.ts';
import { en } from '../src/i18n/en.ts';

const read = (f) => (existsSync(`dist/${f}`) ? readFileSync(`dist/${f}`, 'utf8') : '');
const attr = (html, re) => html.match(re)?.[1];
const decode = (s = '') => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

for (const [lang, file, dict, url] of [
  ['fr', 'index.html', fr, `${SITE_URL}/`],
  ['en', 'en/index.html', en, `${SITE_URL}/en/`],
]) {
  const html = read(file);
  check(html.length > 0, `${file} exists`);
  const head = HEAD[lang];
  check(attr(html, /<html[^>]*\slang="([^"]+)"/) === lang, `${file}: <html lang="${lang}">`);
  const body = html.slice(html.indexOf('<body'));
  const h1 = decode(attr(body, /<h1[^>]*>([\s\S]*?)<\/h1>/)?.replace(/<[^>]+>/g, ''));
  check(h1 === dict['home.title'], `${file}: prerendered <h1> is the landing title (${h1})`);
  check(decode(attr(html, /<title>([^<]*)<\/title>/)) === head.title, `${file}: <title> ${head.title}`);
  const desc = decode(attr(html, /<meta name="description" content="([^"]*)"/));
  check(desc === head.description && desc.length >= 120 && desc.length <= 170, `${file}: description (${desc?.length} chars)`);
  check(!/photo en perspective|mode photo|photo mode/i.test(html.slice(0, html.indexOf('<body'))), `${file}: no mention of the removed photo mode in the head`);
  check(attr(html, /<link rel="canonical" href="([^"]+)"/) === url, `${file}: canonical ${url}`);
  const alt = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`).sort();
  check(alt.join(' ') === `en=${SITE_URL}/en/ fr=${SITE_URL}/ x-default=${SITE_URL}/`, `${file}: hreflang fr/en/x-default (${alt.join(' ')})`);
  const og = attr(html, /<meta property="og:image" content="([^"]+)"/) ?? '';
  check(og.startsWith(`${SITE_URL}/`) && existsSync(`dist${og.slice(SITE_URL.length)}`), `${file}: og:image is absolute and exists (${og})`);
  check(attr(html, /<meta property="og:url" content="([^"]+)"/) === url && /<meta name="twitter:card" content="summary_large_image"/.test(html), `${file}: og:url and twitter card`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
  const types = blocks.flatMap((b) => (b?.['@graph'] ?? [b]).map((x) => x?.['@type']));
  check(blocks.length > 0 && blocks.every(Boolean), `${file}: JSON-LD parses`);
  const graph = blocks.flatMap((b) => b?.['@graph'] ?? [b]);
  const app = graph.find((x) => x?.['@type'] === 'SoftwareApplication');
  check(!!app && app.offers?.price === '0' && app.url === url && app.inLanguage === lang, `${file}: SoftwareApplication, free, ${url} (${types.join(', ')})`);
  const faq = graph.find((x) => x?.['@type'] === 'FAQPage');
  check(faq?.mainEntity?.length === 6 && faq.mainEntity.every((q) => q.name && q.acceptedAnswer?.text), `${file}: FAQPage with 6 answered questions`);
  check(faq?.mainEntity?.[0]?.name === dict['home.faq.q1'], `${file}: FAQ JSON-LD matches the visible FAQ`);
  check(!/role="dialog"|role="alertdialog"/.test(body), `${file}: no dialog (guide, project name…) frozen in the HTML`);
  check(/<div id="root" data-prerendered="home">/.test(body), `${file}: landing marked as prerendered`);
  check(/\[data-splash\]\{display:none!important\}/.test(html), `${file}: the splash stays hidden on the landing`);
}

// the about page, in each language
for (const [lang, file, dict, url, other] of [
  ['fr', 'a-propos.html', fr, `${SITE_URL}/a-propos`, `${SITE_URL}/en/about`],
  ['en', 'en/about.html', en, `${SITE_URL}/en/about`, `${SITE_URL}/a-propos`],
]) {
  const html = read(file);
  check(html.length > 0, `${file} exists`);
  check(attr(html, /<html[^>]*\slang="([^"]+)"/) === lang, `${file}: <html lang="${lang}">`);
  const body = html.slice(html.indexOf('<body'));
  const h1 = decode(attr(body, /<h1[^>]*>([\s\S]*?)<\/h1>/)?.replace(/<[^>]+>/g, ''));
  check(h1 === dict['about.title'], `${file}: prerendered <h1> is the about title (${h1})`);
  check(decode(attr(html, /<title>([^<]*)<\/title>/)) === dict['about.meta.title'], `${file}: <title> ${dict['about.meta.title']}`);
  const desc = decode(attr(html, /<meta name="description" content="([^"]*)"/));
  check(desc === dict['about.meta.description'] && desc.length >= 120 && desc.length <= 170, `${file}: description (${desc?.length} chars)`);
  check(attr(html, /<link rel="canonical" href="([^"]+)"/) === url, `${file}: canonical ${url}`);
  check(html.includes(`hreflang="${lang === 'fr' ? 'en' : 'fr'}" href="${other}"`), `${file}: hreflang to ${other}`);
  check(/"@type":"AboutPage"/.test(html) && /"addressCountry":"CH"/.test(html), `${file}: AboutPage JSON-LD, author in Switzerland`);
  check(/<div id="root" data-prerendered="about">/.test(body), `${file}: about page marked as prerendered`);
}

const robots = read('robots.txt');
check(robots && !/^Disallow:\s*\/\s*$/m.test(robots) && robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'robots.txt allows crawling and names the sitemap');
check(['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'].every((b) => robots.includes(`User-agent: ${b}`)), 'robots.txt welcomes AI crawlers');
const sitemap = read('sitemap.xml');
check(sitemap.includes(`<loc>${SITE_URL}/</loc>`) && sitemap.includes(`<loc>${SITE_URL}/en/</loc>`) && sitemap.includes('hreflang="en"'), 'sitemap.xml lists / and /en/ with hreflang');
const llms = read('llms.txt');
check(llms.startsWith('# MockupLab') && llms.includes(SITE_URL) && llms.length > 400, 'llms.txt describes the site');
