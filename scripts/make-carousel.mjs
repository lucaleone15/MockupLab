// scripts/make-carousel.mjs — the LinkedIn carousel: 1080×1350 slides from the real renders in public/showcase → docs/launch/carousel.pdf (+ slide PNGs). Usage: node scripts/make-carousel.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const b64 = (f) => readFileSync(f).toString('base64');
const img = (f) => `data:image/${f.endsWith('.jpg') ? 'jpeg' : 'webp'};base64,${b64('public/showcase/' + f)}`;
const fonts = `@font-face{font-family:G;src:url(data:font/woff2;base64,${b64('node_modules/@fontsource-variable/gabarito/files/gabarito-latin-wght-normal.woff2')}) format('woff2');font-weight:400 900}
@font-face{font-family:J;src:url(data:font/woff2;base64,${b64('node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2')}) format('woff2');font-weight:200 800}`;
const mark = (h) => `<svg height="${h}" viewBox="9.5 3.5 22 33"><rect x="14" y="4" width="17" height="32" rx="5.2" fill="#2f6bff" opacity="0.35"/><rect x="10" y="4" width="17" height="32" rx="5.2" fill="#2f6bff"/><rect x="15.3" y="7.4" width="6.4" height="2" rx="1" fill="#fff"/></svg>`;
const N = 8;
const slide = (i, { kicker, title, text, pic, light = false, fit = 'cover', ratio = '16/10', natural = false, bg = '' }) => `
<section class="s ${light ? 'light' : ''}">
  <div class="top"><span class="brand">${mark(30)}<b>MockupLab</b></span><span class="n">${i} / ${N}</span></div>
  ${kicker ? `<div class="k">${kicker}</div>` : ''}
  <h1>${title}</h1>
  ${text ? `<p>${text}</p>` : ''}
  ${pic ? `<div class="pic" style="${natural ? `flex:none;margin-top:auto;aspect-ratio:${ratio};` : ''}${bg ? `background:${bg};` : ''}"><img src="${img(pic)}" style="object-fit:${fit}"></div>` : ''}
</section>`;
const slides = [
  slide(1, { title: 'Le studio photo<br>de tes designs.', text: 'Glisse une capture, obtiens un mock-up photoréaliste en&nbsp;4K. Directement dans ton navigateur.', pic: 'hero-still.webp' }),
  slide(2, { kicker: 'Le problème', title: 'Un beau mock-up, c’était des heures de calques.', text: 'Ou un modèle payant, toujours un peu à côté de ce que tu voulais montrer. J’en avais marre, alors j’ai construit l’outil que je voulais.', pic: 'studio-podium.webp', light: true }),
  slide(3, { kicker: 'Des dizaines d’appareils', title: 'Ton design sur un vrai téléphone, un vrai ordi.', text: 'Téléphones, ordinateurs, tablettes, écrans, montre. Ajoutes-en plusieurs&nbsp;: ils se rangent tout seuls.', pic: 'devices-phones.webp' }),
  slide(4, { kicker: 'Et tout ce qui s’imprime', title: 'Affiches, flyers, cartes, magazines.', text: 'Chacun au vrai format, avec le bon papier.', pic: 'devices-print.webp', light: true }),
  slide(5, { kicker: 'Un vrai studio', title: 'Fond, podium, lumière&nbsp;: tu règles tout.', text: 'Une scène 3D en direct, réglée dans le moindre détail. Ce que tu vois, c’est ce que tu exportes.', pic: 'studio-ui.jpg', ratio: '16/10', natural: true }),
  slide(6, { kicker: 'Pour les réseaux', title: 'Vois-le dans le fil avant de publier.', text: 'Ton visuel dans un post, une story ou un Reel, et des vidéos MP4 ou GIF qui bougent comme une pub.', pic: 'social-post.webp', light: true, fit: 'contain', bg: '#f3e5d3' }),
  slide(7, { kicker: 'Pensé pour tes clients', title: 'Tout un projet, en un pack assorti.', text: 'Rapide sort des mock-ups tout faits d’une seule image. Projet assemble le pack complet d’un client.', pic: 'clients-pack.webp', light: true }),
  `<section class="s end">
    <div class="top"><span class="brand">${mark(30)}<b>MockupLab</b></span><span class="n">${N} / ${N}</span></div>
    <div class="endmark">${mark(150)}</div>
    <h1>Gratuit. Sans compte.<br>Chez toi.</h1>
    <p>Tout se passe dans ton navigateur&nbsp;: tes images ne quittent jamais ton ordinateur. Marche aussi sur téléphone.</p>
    <div class="url">mockuplab.luca-leone.ch</div>
    <div class="by">Conçu par Luca Leone</div>
  </section>`,
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
@page{size:1080px 1350px;margin:0}
*{box-sizing:border-box;margin:0}
body{font-family:J;-webkit-font-smoothing:antialiased}
.s{width:1080px;height:1350px;padding:72px 80px;display:flex;flex-direction:column;gap:26px;color:#fff;page-break-after:always;overflow:hidden;position:relative;
  background:radial-gradient(120% 70% at 50% 0%,#1d2340 0%,#0b0d16 55%,#07080c 100%)}
.s.light{color:#16171b;background:radial-gradient(120% 70% at 50% 0%,#ffffff 0%,#eceff5 60%,#e3e7ef 100%)}
.top{width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}
.brand{display:flex;align-items:center;gap:12px;font:700 28px G;letter-spacing:-0.025em}
.n{font:600 22px J;opacity:.45}
.k{font:700 24px J;color:#4b8bff;letter-spacing:.01em}
.light .k{color:#2f6bff}
h1{font:700 82px/1.0 G;letter-spacing:-0.03em;text-wrap:balance}
p{font:400 30px/1.45 J;opacity:.72;max-width:860px;text-wrap:pretty}
.pic{margin-top:18px;flex:1;min-height:0;border-radius:28px;overflow:hidden;box-shadow:0 40px 90px -30px rgb(0 0 0/.7),0 0 0 1px rgb(255 255 255/.08)}
.light .pic{box-shadow:0 40px 90px -36px rgb(22 32 72/.45),0 0 0 1px rgb(22 32 72/.06)}
.pic img{width:100%;height:100%;display:block}
.end{justify-content:flex-start;text-align:center;align-items:center}
.endmark{margin:60px 0 30px}
.end h1{font-size:92px}
.url{margin-top:auto;font:700 40px G;background:#2f6bff;padding:26px 48px;border-radius:999px}
.by{font:500 24px J;opacity:.5;margin-top:24px}
</style></head><body>${slides.join('')}</body></html>`;
mkdirSync('docs/launch/carousel', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: 'docs/launch/carousel.pdf', width: '1080px', height: '1350px', printBackground: true });
const n = await page.locator('section').count();
for (let i = 0; i < n; i++) await page.locator('section').nth(i).screenshot({ path: `docs/launch/carousel/slide-${i + 1}.png` });
await browser.close();
console.log('slides', n);
