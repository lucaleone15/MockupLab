// scripts/make-post-renders.mjs — the LinkedIn post's pictures, rendered by MockupLab itself in 4:5 (1080 × 1350):
// a different scene each (the post's story: one mock-up per project, never the same three). Dev server on :5173.
// Output: docs/launch/post/render-*.png, then the hook (image 1) with its title → docs/launch/post/1-*.png …
// `--fictif`: the same post with the app's own fictional samples (one brand per picture) → docs/launch/post-fictif/
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { openApp } from './lib/app.mjs';
const FICTIF = process.argv.includes('--fictif');
const OUT = FICTIF ? 'docs/launch/post-fictif' : 'docs/launch/post';
mkdirSync(OUT, { recursive: true });
const { browser, page } = await openApp({ hash: '#/studio', colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
const night = { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#1d2340', at: 0 }, { color: '#07080c', at: 1 }] };

// one real project per picture, the background in that project's colours: luca-leone.ch, F1 PitWall, OceanSight,
// a Karting de Vuiteboeuf post, the Étoile Blanche cards. Files in docs/launch/screens/ (served under /@fs/)
const SCREENS = `@fs${process.cwd()}/docs/launch/screens/`;

async function shot(file, { models, layout = 'auto', preset, background, decor, params, finishes, zoom = 1, light, camera, ground, yaws, screens, brand }) {
  await page.evaluate(
    async ({ models, layout, preset, background, decor, params, finishes, zoom, light, camera, ground, yaws, screens, brand, dir }) => {
      const api = window.__mockuplab;
      const { SCENE_PRESETS, applyScenePreset } = await import('/src/scene/scenePresets.ts');
      const s = api.project.getState();
      const { bundledAsset } = await import('/src/lib/samples.ts');
      // the account a social post shows (name and picture)
      if (brand) s.setBrand({ name: brand.name, logoAssetId: brand.logo ? await bundledAsset(dir + brand.logo, brand.logo) : null });
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
      // …on one straight line, evenly spaced around the middle, all at the same depth (the row is staggered)
      if (yaws) {
        const gap = Math.abs(byX[byX.length - 1].position[0] - byX[0].position[0]) / Math.max(1, byX.length - 1);
        byX.forEach((it, i) => s.updateItem(it.id, (x) => ({ rotation: [x.rotation[0], 0, x.rotation[2]], position: [(i - (byX.length - 1) / 2) * gap, x.position[1], 0] })));
      }
      if (preset) applyScenePreset(SCENE_PRESETS.find((p) => p.id === preset));
      if (background) s.setBackground(background);
      if (decor) s.setDecor(decor);
      if (light) s.applyLightPreset(light);
      if (camera) s.setCamera(camera);
      if (ground) s.setGround(ground);
      for (const it of api.project.getState().items) await api.loadSamples(it.id);
      // each device's own screens, in the order of `models`
      for (const [i, faces] of (screens ?? []).entries())
        for (const [slot, name] of Object.entries(faces ?? {})) s.setSurface(items[i].id, slot, { assetId: await bundledAsset(dir + name, name) });
      s.setExport({ ratio: '4:5', format: 'png', resolution: '2k' });
      api.ui.getState().resetView();
      s.setCamera({ zoom });
    },
    { models, layout, preset, background, decor, params, finishes, zoom, light, camera, ground, yaws, screens, brand, dir: SCREENS },
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

const radial = (inner, outer) => ({ kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: inner, at: 0 }, { color: outer, at: 1 }] });
const trio = { models: ['phone-pro', 'phone-pro', 'phone-pro'], layout: 'row', zoom: 1.15, yaws: [0.52, 0, -0.52], camera: { preset: 'front' } };
if (!FICTIF) {
// the portfolio: its red, deepened so the title reads
await shot('render-hero.png', { models: ['laptop-14', 'phone-pro'], layout: 'row', preset: 'studio-dark', background: radial('#4a0f1c', '#0c0507'), zoom: 1.18, screens: [{ screen: 'portfolio-web.png' }, { screen: 'portfolio-mobile.png' }] });
// F1 PitWall: a pit wall at night, carbon black with a red glow; three phones, the sides turned towards the middle one
await shot('render-f1.png', { ...trio, preset: 'studio-dark', background: radial('#4a0c0c', '#050505'), finishes: ['black', 'black', 'black'], screens: [{ screen: 'f1-home.png' }, { screen: 'f1-standing.png' }, { screen: 'f1-track.png' }] });
// OceanSight: deep ocean
await shot('render-ocean.png', { ...trio, preset: 'studio-dark', background: radial('#1d8088', '#062a31'), finishes: ['silver', 'silver', 'silver'], light: 'daylight', screens: [{ screen: 'oceansight-missions.png' }, { screen: 'oceansight-map.png' }, { screen: 'oceansight-profile.png' }] });
// Karting de Vuiteboeuf: a real results post, on the club's navy with a red podium (no arch: it caught the phone's shadow)
await shot('render-karting.png', { models: ['phone-pro'], preset: 'podium-arch', background: { kind: 'solid', color: '#16224a' }, decor: { kind: 'podium', podiumFinish: 'paint', color: '#c8102e', shape: 'cylinder', arch: false }, params: [{ app: 'post', caption: 'Les résultats de la SWS du 5 mai 🏁' }], brand: { name: 'kartingvuiteboeuf', logo: 'kv-logo.png' }, screens: [{ screen: 'kv-post.png' }] });
// L'Étoile Blanche: its real cards in a flat lay on linen, lit like daylight
await shot('render-etoile.png', { models: ['flyer', 'flyer', 'postcard'], preset: 'flatlay-marble', decor: { kind: 'sweep' }, background: { kind: 'solid', color: '#e2cfb8' }, light: 'daylight', camera: { preset: 'top' }, zoom: 1.3, ground: { shadowOpacity: 0.22 }, screens: [{ front: 'eb-campagneAffichage.png' }, { front: 'eb-carteBoissons.png' }, { front: 'eb-anecdotes.png' }] });
} else {
// the app's fictional samples, one brand per picture, the background in its colours
// norastudio (black, orange, cream): its website, deep charcoal with an orange glow so the title reads
await shot('render-hero.png', { models: ['laptop-14'], preset: 'studio-dark', background: radial('#3a1d12', '#0d0b0a'), zoom: 1.12 });
// Sunset sessions, the music app: three phones at dusk
await shot('render-sunset.png', { ...trio, preset: 'studio-dark', background: radial('#5b3a8c', '#140c24'), finishes: ['orange', 'black', 'orange'], light: 'daylight' });
// Solstice festival: its poster as an Instagram post, forest green with an orange podium
await shot('render-solstice.png', { models: ['phone-pro'], preset: 'podium-arch', background: { kind: 'solid', color: '#2f4a3b' }, decor: { kind: 'podium', podiumFinish: 'paint', color: '#ff5c35', shape: 'cylinder', arch: false }, params: [{ app: 'post', caption: 'Rendez-vous le 21 juin au Parc des Rives ☀️' }], brand: { name: 'solstice.festival' } });
// the magazine « Le design qui ralentit »: open on its spread, on a warm blush like its pages
await shot('render-magazine.png', { models: ['magazine'], preset: 'studio-light', background: radial('#f7e6da', '#e2b39b'), light: 'daylight', zoom: 1.18 });
// norastudio's stationery, a flat lay on its orange
await shot('render-nora.png', { models: ['business-card', 'envelope'], preset: 'flatlay-marble', decor: { kind: 'sweep' }, background: { kind: 'solid', color: '#ff6a42' }, light: 'daylight', camera: { preset: 'top' }, zoom: 1.3, ground: { shadowOpacity: 0.22 }, params: [{ layout: 'pair' }] });
}
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
const hook = ['Fini les trois mêmes mock-ups.', 'Des mock-ups 3D gratuits, directement dans le navigateur.'];
const order = FICTIF ? [['hero', hook], ['sunset'], ['solstice'], ['magazine'], ['nora']] : [['hero', hook], ['f1'], ['ocean'], ['karting'], ['etoile']];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [i, [name, hook]] of order.entries()) {
  await p.setContent(card(name, hook), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${OUT}/${i + 1}-${name}.png` });
  console.log(`saved ${i + 1}-${name}.png`);
}
await b.close();
