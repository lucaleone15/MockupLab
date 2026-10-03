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

mkdirSync('public/samples', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
await page.setContent(phone);
await page.screenshot({ path: 'public/samples/sample-app.png' });
await browser.close();
console.log('wrote public/samples/sample-app.png');
