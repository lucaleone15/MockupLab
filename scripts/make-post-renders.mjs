// scripts/make-post-renders.mjs — the LinkedIn post's pictures, rendered by MockupLab itself in 4:5 (1080 × 1350):
// a different scene each (the post's story: one mock-up per project, never the same three). Dev server on :5173.
// Output: docs/launch/post/render-*.png, then the hook (image 1) with its title → docs/launch/post/1-*.png …
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { openApp } from './lib/app.mjs';
const OUT = 'docs/launch/post';
mkdirSync(OUT, { recursive: true });
const { browser, page } = await openApp({ hash: '#/studio', colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
const night = { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#1d2340', at: 0 }, { color: '#07080c', at: 1 }] };

async function shot(file, { models, layout = 'auto', preset, background, decor, params, finishes, zoom = 1, light, camera, ground, yaws }) {
  await page.evaluate(
    async ({ models, layout, preset, background, decor, params, finishes, zoom, light, camera, ground, yaws }) => {
      const api = window.__mockuplab;
      const { SCENE_PRESETS, applyScenePreset } = await import('/src/scene/scenePresets.ts');
      const s = api.project.getState();
      s.setComposition([], 'auto');
      s.setComposition(models, layout);
      const items = api.project.getState().items;
      let byX = items;
      (params ?? []).forEach((p, i) => p && Object.entries(p).forEach(([k, v]) => s.setParam(items[i].id, k, v)));
      (finishes ?? []).forEach((f, i) => f && s.updateItem(items[i].id, { finishId: f }));
      // turns each device (radians), e.g. a mirrored trio: the sides face the middle one
      // a trio is framed straight on first (all facing us), then turned: the camera follows the device with the
      // largest footprint, and a turned phone has a larger one than the middle one
      byX = [...items].sort((a, b) => a.position[0] - b.position[0]);
      if (yaws) byX.forEach((it) => s.updateItem(it.id, (x) => ({ rotation: [x.rotation[0], 0, x.rotation[2]] })));
      if (preset) applyScenePreset(SCENE_PRESETS.find((p) => p.id === preset));
      if (background) s.setBackground(background);
      if (decor) s.setDecor(decor);
      if (light) s.applyLightPreset(light);
      if (camera) s.setCamera(camera);
      if (ground) s.setGround(ground);
      for (const it of api.project.getState().items) await api.loadSamples(it.id);
      s.setExport({ ratio: '4:5', format: 'png', resolution: '2k' });
      api.ui.getState().resetView();
      s.setCamera({ zoom });
    },
    { models, layout, preset, background, decor, params, finishes, zoom, light, camera, ground, yaws },
  );
  await page.waitForTimeout(yaws ? 2500 : 4000);
  if (yaws) {
    // turned left to right on screen, without framing again
    await page.evaluate((yaws) => {
      const s = window.__mockuplab.project.getState();
      [...s.items].sort((a, b) => a.position[0] - b.position[0]).forEach((it, i) => s.updateItem(it.id, (x) => ({ rotation: [x.rotation[0], yaws[i], x.rotation[2]] })));
    }, yaws);
    await page.waitForTimeout(2500);
  }
  if (process.env.DBG) console.log(file, JSON.stringify(await page.evaluate(() => { const st = window.__mockuplab.project.getState(); return { cam: st.camera.preset, sel: st.selectedId?.slice(0, 4), items: st.items.map((i) => [i.id.slice(0, 4), Math.round(i.position[0]), +i.rotation[1].toFixed(2)]) }; })));
  const b64 = await page.evaluate(async () => {
    const { blob } = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  writeFileSync(`${OUT}/${file}`, Buffer.from(b64, 'base64'));
  console.log('saved', file);
}

await shot('render-hero.png', { models: ['laptop-14', 'phone-pro'], layout: 'row', preset: 'studio-dark', background: night, zoom: 1.18 });
// three phones in a row, the middle one facing us, the two others turned towards it like a mirror
await shot('render-phones.png', { models: ['phone-pro', 'phone-pro', 'phone-pro'], layout: 'row', preset: 'studio-dark', background: night, finishes: ['deep-blue', 'silver', 'orange'], zoom: 1.15, yaws: [0.52, 0, -0.52], light: 'daylight', camera: { preset: 'front' } });
// a flat lay on the plain studio floor, lit like daylight: soft directional shadows, no grey halo around the paper
await shot('render-print.png', { models: ['flyer', 'business-card', 'postcard'], preset: 'flatlay-marble', decor: { kind: 'sweep' }, background: { kind: 'solid', color: '#eceff5' }, light: 'daylight', camera: { preset: 'top' }, ground: { shadowOpacity: 0.22 } });
// the podium without its arch: the arch caught the phone's shadow right behind it
await shot('render-social.png', { models: ['phone-pro'], preset: 'podium-arch', decor: { kind: 'podium', podiumFinish: 'paint', color: '#e8d9c8', shape: 'cylinder', arch: false }, params: [{ app: 'post', caption: 'Le nouveau site est en ligne' }] });
await shot('render-tablet.png', { models: ['tablet-pro-11', 'phone-pro'], layout: 'row', preset: 'studio-light', background: { kind: 'solid', color: '#e9e4f7' }, zoom: 1.12, light: 'daylight' });
await browser.close();

// the post's images, 1080 × 1350: the hook (the first render with its title), then the renders as they are
const b64 = (f) => readFileSync(f).toString('base64');
const fonts = `@font-face{font-family:G;src:url(data:font/woff2;base64,${b64('node_modules/@fontsource-variable/gabarito/files/gabarito-latin-wght-normal.woff2')}) format('woff2');font-weight:400 900}
@font-face{font-family:J;src:url(data:font/woff2;base64,${b64('node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2')}) format('woff2');font-weight:200 800}`;
const mark = `<svg height="34" viewBox="9.5 3.5 22 33"><rect x="14" y="4" width="17" height="32" rx="5.2" fill="#2f6bff" opacity="0.35"/><rect x="10" y="4" width="17" height="32" rx="5.2" fill="#2f6bff"/><rect x="15.3" y="7.4" width="6.4" height="2" rx="1" fill="#fff"/></svg>`;
const pic = (name) => `data:image/png;base64,${b64(`${OUT}/render-${name}.png`)}`;
const card = (name, hook) => `<!doctype html><html><head><style>${fonts}*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;background:url(${pic(name)}) center/cover;color:#fff;font-family:J;-webkit-font-smoothing:antialiased}
.h{position:absolute;inset:0 0 auto;padding:96px 84px 0;text-align:center}
h1{font:700 92px/0.98 G;letter-spacing:-0.03em;text-wrap:balance}
p{margin-top:26px;font:400 32px/1.4 J;opacity:.72}
.b{position:absolute;left:0;right:0;bottom:64px;display:flex;justify-content:center;align-items:center;gap:12px;font:700 30px G;letter-spacing:-0.025em}
</style></head><body>${hook ? `<div class="h"><h1>${hook[0]}</h1><p>${hook[1]}</p></div><div class="b">${mark}MockupLab</div>` : ''}</body></html>`;
const order = [['hero', ['Fini les trois mêmes mock-ups.', 'Le studio photo de tes designs, gratuit, dans ton navigateur.']], ['phones'], ['tablet'], ['social'], ['print']];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [i, [name, hook]] of order.entries()) {
  await p.setContent(card(name, hook), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${i + 1}-${name}.png` });
  console.log(`saved ${i + 1}-${name}.png`);
}
await b.close();
