// scripts/prerender.mjs — after `vite build`: the landing of each language written as real HTML, with its head
// (title, description, canonical, hreflang, Open Graph, JSON-LD), so search engines and AI crawlers that run no
// JavaScript read the page, and phones paint it before the app starts. React then replaces it.
//   dist/index.html    → / (French)        dist/en/index.html → /en/ (English)
//   dist/a-propos.html → /a-propos         dist/en/about.html → /en/about (the about page, .htaccess serves them)
// The snapshot is the scroll story as a phone first sees it (the same markup fits every size; the 3D comes in
// when the app starts). The editor addresses (/studio…) keep the splash instead.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ABOUT_PATH, AUTHOR, HEAD, REPO, SITE_URL } from './seo.mjs';
import { fr } from '../src/i18n/fr.ts';
import { en } from '../src/i18n/en.ts';

const template = readFileSync('dist/index.html', 'utf8');
if (template.includes('data-prerendered')) throw new Error('dist/index.html is already prerendered: run `vite build` first');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const server = await preview({ preview: { port: 4199, strictPort: false }, logLevel: 'silent' });
const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });

/** The landing's markup, from React's server renderer (prerender.html), and its FAQ. */
async function snapshot(path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${origin}/prerender.html?path=${encodeURIComponent(path)}`);
  await page.waitForFunction(() => window.__prerender);
  return page.evaluate(async () => {
    const html = await window.__prerender;
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
    const faq = [...doc.querySelectorAll('[data-testid=home-faq] details')].map((d) => ({
      q: d.querySelector('summary').textContent.replace(/\+$/, '').trim(),
      a: d.querySelector('p').textContent.trim(),
    }));
    return { html, faq };
  });
}

/** The head of a page: the landing (its FAQ as structured data) or the about page. */
function headFor(lang, faq, kind) {
  const about = kind === 'about';
  const dict = lang === 'en' ? en : fr;
  const h = about ? { ...HEAD[lang], title: dict['about.meta.title'], description: dict['about.meta.description'] } : HEAD[lang];
  const home = `${SITE_URL}${lang === 'en' ? '/en/' : '/'}`;
  const url = about ? SITE_URL + ABOUT_PATH[lang] : home;
  const alternates = about ? { fr: SITE_URL + ABOUT_PATH.fr, en: SITE_URL + ABOUT_PATH.en } : { fr: `${SITE_URL}/`, en: `${SITE_URL}/en/` };
  const image = SITE_URL + h.ogImage;
  const person = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url, sameAs: AUTHOR.sameAs, jobTitle: AUTHOR.jobTitle[lang], address: { '@type': 'PostalAddress', addressCountry: 'CH' } };
  const ld = about
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'AboutPage', name: h.title, url, description: h.description, inLanguage: lang, mainEntity: person, about: { '@type': 'SoftwareApplication', name: 'MockupLab', url: home } },
        ],
      }
    : {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'MockupLab',
        url,
        description: h.description,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web browser',
        inLanguage: lang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        image,
        screenshot: `${SITE_URL}/showcase/hero-still.webp`,
        license: 'https://opensource.org/licenses/MIT',
        author: person,
        countryOfOrigin: { '@type': 'Country', name: 'Switzerland' },
      },
      { '@type': 'WebSite', name: 'MockupLab', url, inLanguage: lang },
      {
        '@type': 'FAQPage',
        inLanguage: lang,
        mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  };
  return [
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="fr" href="${alternates.fr}">`,
    `<link rel="alternate" hreflang="en" href="${alternates.en}">`,
    `<link rel="alternate" hreflang="x-default" href="${alternates.fr}">`,
    `<meta property="og:type" content="${about ? 'profile' : 'website'}">`,
    `<meta property="og:site_name" content="MockupLab">`,
    `<meta property="og:locale" content="${h.locale}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${esc(h.title)}">`,
    `<meta property="og:description" content="${esc(h.description)}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(h.ogAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(h.title)}">`,
    `<meta name="twitter:description" content="${esc(h.description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="author" content="${AUTHOR.name}">`,
    `<script type="application/ld+json">${json(ld)}</script>`,
    // the static landing is for phones, crawlers and still motion; editor addresses keep the splash
    // (!important: the splash carries an inline display)
    `<style>[data-splash]{display:none!important}html.app-route #root[data-prerendered]{display:none}html.app-route [data-splash]{display:grid!important;position:fixed;inset:0}</style>`,
    `<script>if(!/^\\/((en\\/?)?|a-propos\\/?|en\\/about\\/?)$/.test(location.pathname))document.documentElement.classList.add('app-route')</script>`,
  ].join('\n    ');
}

// the splash React replaces (inside #root, after its comment)
const rootOpen = template.indexOf('<div id="root">') + '<div id="root">'.length;
const rootClose = template.lastIndexOf('</div>', template.indexOf('</body>'));
const SPLASH = template.slice(rootOpen, rootClose).replace(/<!--[\s\S]*?-->/g, '').trim();
if (!SPLASH.startsWith('<div style="height:100%')) throw new Error('splash not found in dist/index.html');
const splash = SPLASH.replace('<div style="height:100%', '<div data-splash style="height:100%');

const PAGES = [
  { lang: 'fr', kind: 'home', path: '/', out: 'dist/index.html' },
  { lang: 'en', kind: 'home', path: '/en/', out: 'dist/en/index.html' },
  { lang: 'fr', kind: 'about', path: ABOUT_PATH.fr, out: 'dist/a-propos.html' },
  { lang: 'en', kind: 'about', path: ABOUT_PATH.en, out: 'dist/en/about.html' },
];
for (const { lang, kind, path, out } of PAGES) {
  const { html, faq } = await snapshot(path);
  if (kind === 'home' && faq.length !== 6) throw new Error(`${lang}: expected 6 FAQ entries, got ${faq.length}`);
  const dict = lang === 'en' ? en : fr;
  const h = kind === 'about' ? { title: dict['about.meta.title'], description: dict['about.meta.description'] } : HEAD[lang];
  let page = template
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(h.description)}" />`)
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    // the static page paints without the app: its code (3D engine included) no longer competes with the
    // first picture and the fonts — the entry script still imports it right after
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, '')
    .replace('</head>', `  ${headFor(lang, faq, kind)}\n  </head>`)
    // #root holds the landing exactly as React renders it (hydrated, not repainted); the splash sits beside it
    .replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/, `${splash}<div id="root" data-prerendered="${kind}">${html}</div>\n  </body>`);
  mkdirSync('dist/en', { recursive: true });
  writeFileSync(out, page);
  console.log(`prerendered ${out} (${Math.round(page.length / 1024)} KB, ${faq.length} FAQ)`);
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));

// the build-time page and its code are not part of the site
const { rmSync } = await import('node:fs');
const entry = readFileSync('dist/prerender.html', 'utf8').match(/assets\/prerender-[\w-]+\.js/)?.[0];
rmSync('dist/prerender.html');
if (entry) rmSync(`dist/${entry}`);

// the service worker was generated before these pages: give it their real content (offline visitors get them)
const rev = (f) => createHash('md5').update(readFileSync(f)).digest('hex');
let sw = readFileSync('dist/sw.js', 'utf8');
const before = sw;
const pages = ['index.html', 'en/index.html', 'a-propos.html', 'en/about.html'];
sw = sw.replace(/\{url:"index\.html",revision:"[0-9a-f]+"\}/, pages.map((f) => `{url:"${f}",revision:"${rev(`dist/${f}`)}"}`).join(','));
if (sw === before) throw new Error('index.html not found in the service worker precache list');
writeFileSync('dist/sw.js', sw);
console.log(`service worker precache updated (${pages.join(', ')})`);
