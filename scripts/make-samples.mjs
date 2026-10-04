// Generates the bundled sample screenshots (original, fictional UIs) with Playwright.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const phone = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:393px;height:852px;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;background:#0d0c12;color:#f4f2ee;overflow:hidden;position:relative}
.bg{position:absolute;inset:-120px -80px auto -80px;height:520px;background:radial-gradient(60% 60% at 30% 40%,#ff6b3d 0%,transparent 70%),radial-gradient(55% 55% at 80% 30%,#7b5cff 0%,transparent 70%),radial-gradient(50% 50% at 55% 75%,#ffb547 0%,transparent 70%);filter:blur(30px);opacity:.85}
.status{position:relative;display:flex;justify-content:space-between;padding:18px 32px 0 36px;font-weight:600;font-size:16px}
.status i{display:inline-block;width:24px;height:11px;border:1.5px solid #fff;border-radius:3.5px;margin-left:6px;position:relative;top:1px}
.status i:after{content:"";position:absolute;inset:1.5px 5px 1.5px 1.5px;background:#fff;border-radius:1px}
.wrap{position:relative;padding:44px 22px 0}
.hello{font-size:15px;opacity:.75}
h1{font-size:40px;line-height:1.02;letter-spacing:-1.4px;margin-top:6px;font-weight:700}
h1 em{font-family:Georgia,serif;font-weight:400;font-style:italic}
.chips{display:flex;gap:8px;margin-top:20px}
.chip{padding:9px 14px;border-radius:99px;background:rgba(255,255,255,.14);backdrop-filter:blur(10px);font-size:13px;font-weight:600}
.chip.on{background:#f4f2ee;color:#0d0c12}
.card{margin-top:22px;border-radius:28px;height:250px;position:relative;overflow:hidden;background:linear-gradient(160deg,#2b2440,#15121d)}
.card .art{position:absolute;inset:0;background:radial-gradient(circle at 70% 35%,#ffcf6b 0 52px,transparent 53px),radial-gradient(circle at 70% 35%,rgba(255,207,107,.25) 0 90px,transparent 91px),linear-gradient(180deg,transparent 55%,rgba(0,0,0,.55)),linear-gradient(200deg,#ff7a45,#7b2ff7 70%)}
.card .hills{position:absolute;left:-10%;right:-10%;bottom:-40px;height:150px;background:#1b1430;border-radius:50% 50% 0 0}
.card .meta{position:absolute;left:20px;bottom:18px;right:20px;display:flex;justify-content:space-between;align-items:flex-end}
.card b{display:block;font-size:22px;letter-spacing:-.4px}
.card span{font-size:13px;opacity:.7}
.play{width:48px;height:48px;border-radius:50%;background:#f4f2ee;display:grid;place-items:center}
.play:after{content:"";border-left:14px solid #0d0c12;border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px}
.row{display:flex;gap:12px;margin-top:16px}
.mini{flex:1;border-radius:22px;padding:16px;height:128px;position:relative;overflow:hidden}
.mini small{font-size:12px;opacity:.7;display:block}
.mini strong{font-size:28px;letter-spacing:-1px;display:block;margin-top:6px}
.m1{background:#f4f2ee;color:#0d0c12}
.m2{background:#1e1b27}
.bars{position:absolute;left:16px;right:16px;bottom:14px;display:flex;align-items:flex-end;gap:5px;height:34px}
.bars div{flex:1;border-radius:3px;background:#ff6b3d}
.m2 .bars div{background:#7b5cff}
.tab{position:absolute;left:22px;right:22px;bottom:30px;height:64px;border-radius:32px;background:rgba(30,27,39,.85);backdrop-filter:blur(20px);display:flex;justify-content:space-around;align-items:center;border:1px solid rgba(255,255,255,.08)}
.tab div{width:22px;height:22px;border-radius:7px;border:2px solid rgba(255,255,255,.45)}
.tab div.on{background:#ff6b3d;border-color:#ff6b3d}
.home{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:#fff;transform:translateX(-50%)}
</style></head><body>
<div class="bg"></div>
<div class="status"><span>10:24</span><span>●●●● <i></i></span></div>
<div class="wrap">
  <div class="hello">Bonsoir, Lina</div>
  <h1>Sunset <em>sessions</em><br/>for deep focus</h1>
  <div class="chips"><div class="chip on">Focus</div><div class="chip">Chill</div><div class="chip">Run</div><div class="chip">Sleep</div></div>
  <div class="card"><div class="art"></div><div class="hills"></div><div class="meta"><div><b>Golden Hour</b><span>Ambient · 42 min</span></div><div class="play"></div></div></div>
  <div class="row">
    <div class="mini m1"><small>Cette semaine</small><strong>6 h 12</strong><div class="bars">${[40,70,55,90,65,100,45].map(h=>`<div style="height:${h}%"></div>`).join('')}</div></div>
    <div class="mini m2"><small>Série</small><strong>12 jours</strong><div class="bars">${[60,35,80,50,95,70,85].map(h=>`<div style="height:${h}%"></div>`).join('')}</div></div>
  </div>
</div>
<div class="tab"><div class="on"></div><div></div><div></div><div></div></div>
<div class="home"></div>
</body></html>`;

const web = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1440px;height:900px;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;background:#f4f1ea;color:#17161a;overflow:hidden}
nav{display:flex;align-items:center;justify-content:space-between;padding:30px 64px}
.logo{font-weight:800;font-size:22px;letter-spacing:-.6px}.logo i{font-family:Georgia,serif;font-weight:400;color:#ff5c35}
.links{display:flex;gap:36px;font-size:15px;color:#55525c}.cta{background:#17161a;color:#f4f1ea;padding:12px 22px;border-radius:99px;font-size:14px;font-weight:600}
.hero{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;padding:40px 64px 0}
.tag{display:inline-flex;gap:8px;align-items:center;background:#fff;border-radius:99px;padding:8px 14px;font-size:13px;font-weight:600;box-shadow:0 1px 0 rgba(0,0,0,.06)}
.tag b{width:8px;height:8px;border-radius:50%;background:#3ddc97;display:inline-block}
h1{font-size:92px;line-height:.95;letter-spacing:-4px;margin-top:26px;font-weight:800}
h1 em{font-family:Georgia,serif;font-weight:400;font-style:italic;color:#ff5c35;letter-spacing:-2px}
p.lead{font-size:20px;line-height:1.5;color:#55525c;margin-top:26px;max-width:540px}
.btns{display:flex;gap:12px;margin-top:34px}.b1{background:#ff5c35;color:#fff;padding:16px 26px;border-radius:14px;font-weight:700}.b2{padding:16px 26px;border-radius:14px;font-weight:700;border:1.5px solid #17161a}
.grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:250px 250px;gap:16px}
.c{border-radius:26px;position:relative;overflow:hidden;padding:20px;color:#fff;font-weight:700;font-size:18px}
.c small{display:block;font-weight:500;font-size:13px;opacity:.8;margin-top:4px}
.c1{background:linear-gradient(150deg,#ff8a5c,#c2304a);grid-row:span 2}
.c1:after{content:"";position:absolute;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.18);right:-80px;bottom:-60px}
.c2{background:#17161a}.c2:after{content:"";position:absolute;left:20px;right:20px;bottom:20px;height:90px;border-radius:14px;background:repeating-linear-gradient(90deg,#ff5c35 0 18px,transparent 18px 30px);opacity:.9}
.c3{background:linear-gradient(160deg,#a5b4fc,#4338ca)}
.logos{display:flex;gap:56px;padding:46px 64px;color:#9b97a3;font-weight:800;font-size:20px;letter-spacing:-.4px}
</style></head><body>
<nav><div class="logo">nora<i>studio</i></div><div class="links"><span>Projets</span><span>Services</span><span>À propos</span><span>Journal</span></div><div class="cta">Démarrer un projet</div></nav>
<section class="hero"><div><span class="tag"><b></b> Disponible en novembre</span><h1>Design that <em>moves</em> people.</h1><p class="lead">Studio indépendant de design produit et d’identité visuelle. Nous aidons les marques ambitieuses à raconter leur histoire, du premier croquis au lancement.</p><div class="btns"><span class="b1">Voir les projets</span><span class="b2">Nous écrire</span></div></div>
<div class="grid"><div class="c c1">Halo Bank<small>Identité · App mobile</small></div><div class="c c2">Pulse<small>Dashboard</small></div><div class="c c3">Atlas<small>Site e-commerce</small></div></div></section>
<div class="logos"><span>NORTHWIND</span><span>Lumen</span><span>KOTO</span><span>fieldnotes</span><span>ORBITAL</span><span>Maple&Co</span></div>
</body></html>`;

const base = `*{box-sizing:border-box;margin:0}body{overflow:hidden;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif}`;
const poster = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:707px;height:1000px;background:#f1ebe0;color:#1d1a17;position:relative}
.sun{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#ff8a4c,#e2452c 70%);left:94px;top:150px}
.wave{position:absolute;left:-40px;right:-40px;height:260px;top:520px;background:#1d1a17;border-radius:50% 50% 0 0}
.wave2{position:absolute;left:-40px;right:-40px;height:420px;top:610px;background:#2f4a3b;border-radius:60% 40% 0 0}
h1{position:absolute;left:56px;top:48px;font-size:96px;line-height:.9;letter-spacing:-4px;font-weight:800}
h1 em{font-family:Georgia,serif;font-weight:400}
.meta{position:absolute;left:56px;right:56px;bottom:56px;display:flex;justify-content:space-between;color:#f1ebe0;font-size:20px;font-weight:600}
.meta b{display:block;font-size:44px;letter-spacing:-1px}
</style></head><body><div class="sun"></div><div class="wave"></div><div class="wave2"></div>
<h1>Solstice<br/><em>festival</em></h1><div class="meta"><div><b>21.06</b>Parc des Rives</div><div style="text-align:right"><b>12 artistes</b>Entrée libre</div></div></body></html>`;

const cardFront = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:850px;height:550px;background:#1d1a17;color:#f1ebe0;position:relative}
.mark{position:absolute;left:70px;top:70px;width:90px;height:90px;border-radius:50%;background:#ff5c35}
.mark:after{content:"";position:absolute;inset:26px;border-radius:50%;background:#1d1a17}
h1{position:absolute;left:70px;bottom:70px;font-size:64px;font-weight:800;letter-spacing:-2px}
h1 em{font-family:Georgia,serif;font-weight:400;color:#ff5c35}
</style></head><body><div class="mark"></div><h1>nora<em>studio</em></h1></body></html>`;

const cardBack = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:850px;height:550px;background:#f1ebe0;color:#1d1a17;position:relative;padding:70px}
h2{font-size:44px;font-weight:800;letter-spacing:-1px}
p{font-size:24px;color:#5a544c;margin-top:6px}
.c{position:absolute;left:70px;bottom:70px;font-size:22px;line-height:1.7}
.dot{position:absolute;right:70px;bottom:70px;width:56px;height:56px;border-radius:50%;background:#ff5c35}
</style></head><body><h2>Lina Moreau</h2><p>Directrice artistique</p>
<div class="c">lina@norastudio.fr<br/>+33 6 12 34 56 78<br/>norastudio.fr</div><div class="dot"></div></body></html>`;

const pattern = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:1000px;height:1000px;background:#f1ebe0;display:grid;grid-template-columns:repeat(4,1fr)}
div{aspect-ratio:1;position:relative;overflow:hidden}
div:nth-child(3n){background:#ff5c35}div:nth-child(4n+1){background:#2f4a3b}div:nth-child(5n+2){background:#1d1a17}
div:before{content:"";position:absolute;inset:22%;border-radius:50%;background:#f1ebe0}
div:nth-child(2n):before{border-radius:0 100% 0 100%;background:#ffb547}
</style></head><body>${'<div></div>'.repeat(16)}</body></html>`;

const label = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:900px;height:1000px;background:#f3eee4;color:#1d1a17;position:relative;text-align:center;padding-top:110px}
small{letter-spacing:8px;font-size:22px;font-weight:700;color:#8a6a3a}
h1{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:120px;margin-top:40px;letter-spacing:-3px}
.line{width:120px;height:3px;background:#1d1a17;margin:46px auto}
p{font-size:26px;letter-spacing:4px;font-weight:600}
.y{position:absolute;left:0;right:0;bottom:110px;font-size:64px;font-weight:800;color:#8a6a3a}
</style></head><body><small>DOMAINE DES RIVES</small><h1>Solstice</h1><div class="line"></div><p>CUVÉE D’ÉTÉ<br/>VIN DE FRANCE</p><div class="y">2025</div></body></html>`;

const logo = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:900px;height:1000px;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ff5c35}
.mark{width:420px;height:420px;border-radius:50%;background:#ff5c35;position:relative}
.mark:after{content:"";position:absolute;inset:120px;border-radius:50%;background:#f1ebe0}
.mark:before{content:"";position:absolute;left:-60px;right:-60px;top:190px;height:40px;background:#1d1a17;transform:rotate(-18deg)}
h1{font-size:120px;font-weight:800;letter-spacing:-5px;margin-top:40px;color:#1d1a17;-webkit-text-stroke:0}
h1 em{font-family:Georgia,serif;font-weight:400;color:#ff5c35}
</style></head><body><div class="mark"></div><h1>sol<em>stice</em></h1></body></html>`;

const spread = /* html */ `<!doctype html><html><head><meta charset="utf-8"><style>${base}
body{width:1400px;height:917px;background:#f6f2ea;color:#1d1a17;display:grid;grid-template-columns:1fr 1fr}
.l{background:linear-gradient(160deg,#ff8a4c,#c2304a);position:relative}
.l:after{content:"";position:absolute;width:380px;height:380px;border-radius:50%;background:#f6f2ea;opacity:.18;right:-60px;bottom:-80px}
.r{padding:90px 80px}
small{letter-spacing:6px;font-weight:700;color:#c2304a;font-size:16px}
h1{font-family:Georgia,serif;font-weight:400;font-size:78px;line-height:.95;margin:22px 0 30px;letter-spacing:-2px}
p{font-size:19px;line-height:1.65;color:#4a443d;columns:2;column-gap:36px}
</style></head><body><div class="l"></div><div class="r"><small>DOSSIER · N°12</small><h1>Le design qui ralentit</h1>
<p>${'Dans un monde saturé d’images, certains studios choisissent la lenteur : moins de projets, plus de soin, et des objets qui durent. Nous avons rencontré six d’entre eux pour comprendre comment ils travaillent. '.repeat(4)}</p></div></body></html>`;

mkdirSync('public/samples', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
await page.setContent(phone);
await page.screenshot({ path: 'public/samples/sample-app.png' });
const wide = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await wide.setContent(web);
await wide.screenshot({ path: 'public/samples/sample-web.png' });
const shots = [
  ['sample-poster.png', poster, 707, 1000, 2, false],
  ['sample-card-front.png', cardFront, 850, 550, 2, false],
  ['sample-card-back.png', cardBack, 850, 550, 2, false],
  ['sample-pattern.png', pattern, 1000, 1000, 2, false],
  ['sample-label.png', label, 900, 1000, 1.5, false],
  ['sample-logo.png', logo, 900, 1000, 1.5, true],
  ['sample-spread.png', spread, 1400, 917, 2, false],
];
for (const [name, html, w, h, dpr, transparent] of shots) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await pg.setContent(html);
  await pg.screenshot({ path: `public/samples/${name}`, omitBackground: transparent });
  await pg.close();
}
await browser.close();
console.log('wrote samples');
