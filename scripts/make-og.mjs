// scripts/make-og.mjs — the link previews (LinkedIn, X, Slack…): 1200×630, a real render + name + tagline,
// one per language → public/og/og-fr.png, public/og/og-en.png. Run once after changing the showcase.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, statSync } from 'node:fs';

const b64 = (f) => readFileSync(f).toString('base64');
const archivo = b64('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2');
const geist = b64('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');
const hero = b64('public/showcase/hero-still.webp');
const icon = b64('public/icons/icon-192.png');
const TEXT = {
  fr: { tag: 'Mockups 3D gratuits, dans ton navigateur', small: 'Gratuit · Sans compte · Rien ne quitte ton ordinateur' },
  en: { tag: 'Free 3D mockups, right in your browser', small: 'Free · No account · Nothing leaves your computer' },
};

mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [lang, t] of Object.entries(TEXT)) {
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Archivo; src: url(data:font/woff2;base64,${archivo}) format('woff2'); font-stretch: 62% 125%; font-weight: 100 900; }
    @font-face { font-family: Geist; src: url(data:font/woff2;base64,${geist}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; width: 1200px; height: 630px; background: #000; overflow: hidden; }
    .shot { position: absolute; right: -250px; top: 0; height: 630px; -webkit-mask-image: radial-gradient(ellipse 60% 70% at 62% 50%, #000 55%, transparent 100%); }
    .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #000 40%, rgba(0,0,0,0) 62%); }
    .text { position: absolute; left: 72px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; gap: 22px; color: #fff; }
    .brand { display: flex; align-items: center; gap: 16px; font: 700 34px Geist; letter-spacing: -.01em; }
    .brand img { width: 56px; height: 56px; }
    h1 { margin: 0; font-family: Archivo; font-stretch: 125%; font-weight: 800; font-size: 60px; line-height: 1.0; letter-spacing: -.01em; }
    p { margin: 0; font: 500 22px Geist; color: rgba(255,255,255,.62); }
    .url { position: absolute; left: 72px; bottom: 44px; font: 500 20px Geist; color: #5b8cff; }
  </style></head><body>
    <img class="shot" src="data:image/webp;base64,${hero}">
    <div class="fade"></div>
    <div class="text">
      <div class="brand"><img src="data:image/png;base64,${icon}">MockupLab</div>
      <h1>${t.tag}</h1>
      <p>${t.small}</p>
    </div>
    <div class="url">mockuplab3d.netlify.app${lang === 'en' ? '/en' : ''}</div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const out = `public/og/og-${lang}.png`;
  await page.screenshot({ path: out });
  console.log(out, Math.round(statSync(out).size / 1024), 'KB');
}
await browser.close();
