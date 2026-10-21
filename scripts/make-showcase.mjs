// scripts/make-showcase.mjs — every visual of the home page, rendered by MockupLab itself from the bundled sample
// designs, on classy backgrounds with studio light (dev server on :5173). Output: public/showcase/*
// Usage: node scripts/make-showcase.mjs [name…]   (no name: everything)
import { mkdirSync, writeFileSync } from 'node:fs';
import { openApp } from './lib/app.mjs';
mkdirSync('public/showcase', { recursive: true });
const only = process.argv.slice(2);
const want = (name) => !only.length || only.includes(name);
const { browser, page } = await openApp({ hash: '#/studio', colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
const write = (file, base64) => {
  writeFileSync(`public/showcase/${file}`, Buffer.from(base64, 'base64'));
  console.log('saved', file);
};

/** Puts devices (with their sample designs) in a scene preset (or a custom set) and waits for it to settle. */
async function scene({ models, layout = 'auto', preset, background, decor, light, camera, ratio = '16:9' }) {
  await page.evaluate(
    async ({ models, layout, preset, background, decor, light, camera, ratio }) => {
      const api = window.__mockuplab;
      const { SCENE_PRESETS, applyScenePreset } = await import('/src/scene/scenePresets.ts');
      const s = api.project.getState();
      s.setComposition(models, layout);
      for (const it of api.project.getState().items) await api.loadSamples(it.id);
      if (preset) applyScenePreset(SCENE_PRESETS.find((p) => p.id === preset));
      if (background) s.setBackground(background);
      if (decor) s.setDecor(decor);
      if (light) s.applyLightPreset(light);
      if (camera) s.setCamera(camera);
      s.setExport({ ratio, format: 'webp', quality: 0.86, resolution: '2k' });
      api.ui.getState().resetView();
    },
    { models, layout, preset, background, decor, light, camera, ratio },
  );
  await page.waitForTimeout(3500);
}

async function still(file) {
  const b64 = await page.evaluate(async () => {
    const { blob } = await window.__mockuplab.renderImage();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  write(file, b64);
}

// deep night studio: a dark blue gradient behind the sweep
const night = { kind: 'gradient', type: 'radial', angle: 0, stops: [{ color: '#1d2340', at: 0 }, { color: '#07080c', at: 1 }] };

if (want('hero-still')) {
  await scene({ models: ['laptop-14', 'phone-pro'], layout: 'row', preset: 'studio-dark', background: night });
  await still('hero-still.webp');
}
if (want('devices-phones')) {
  await scene({ models: ['phone-pro', 'phone-pro', 'phone-pro'], layout: 'fan', preset: 'studio-dark', background: night });
  await still('devices-phones.webp');
}
if (want('devices-print')) {
  // a flat lay of prints, seen from above on white marble
  await scene({ models: ['flyer', 'business-card', 'postcard'], preset: 'flatlay-marble' });
  await still('devices-print.webp');
}
if (want('devices-desk')) {
  await scene({ models: ['desktop-24', 'laptop-14', 'tablet-pro-11', 'phone-pro'], preset: 'studio-light' });
  await still('devices-desk.webp');
}
if (want('studio-marble')) {
  await scene({ models: ['laptop-14', 'phone-pro'], layout: 'row', preset: 'table-black-marble' });
  await still('studio-marble.webp');
}
if (want('studio-podium')) {
  await scene({ models: ['phone-pro'], preset: 'podium-terrazzo', background: { kind: 'solid', color: '#e7e2f3' } });
  await still('studio-podium.webp');
}
if (want('studio-travertine')) {
  await scene({ models: ['tablet-pro-11', 'phone-pro'], preset: 'table-travertine-terracotta' });
  await still('studio-travertine.webp');
}
if (want('social-post')) {
  // the social phone: the sample design as an Insta post, on a podium
  await scene({ models: ['phone-pro'], preset: 'podium-arch', ratio: '4:5' });
  await page.evaluate(async () => {
    const s = window.__mockuplab.project.getState();
    s.setParam(s.items[0].id, 'app', 'post');
    s.setParam(s.items[0].id, 'caption', 'Le nouveau site est en ligne');
    // a phone showing a post takes the poster sample
    await window.__mockuplab.loadSamples(s.items[0].id);
  });
  await page.waitForTimeout(1500);
  await still('social-post.webp');
}
if (want('motion')) {
  // a turntable of the phone, looping, for the “it moves” section (MP4 and WebM) and its still
  await scene({ models: ['phone-pro'], preset: 'studio-dark', background: night });
  await still('motion-still.webp');
  for (const format of ['mp4', 'webm']) {
    const b64 = await page.evaluate(async (format) => {
      const api = window.__mockuplab;
      const s = api.project.getState();
      s.setExport({ video: { ...s.export.video, animation: 'turntable', duration: 6, resolution: '720', fps: 30, format, quality: 'cinema' } });
      const { blob } = await api.renderVideo();
      const buf = new Uint8Array(await blob.arrayBuffer());
      let out = '';
      for (let i = 0; i < buf.length; i += 0x8000) out += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(out);
    }, format);
    write(`motion.${format}`, b64);
  }
}
// several devices of one client (Project hero)
if (want('clients-pack')) {
  await page.evaluate(() => {
    history.pushState(null, '', '/projet');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__mockuplab.project.getState().setExport({ resolution: '2k', format: 'webp', quality: 0.86, ratio: '16:9' }));
  for (const n of ['sample-web.png', 'sample-app.png', 'sample-poster.png']) {
    await page.evaluate(async (n) => {
      const b = await (await fetch('/samples/' + n)).blob();
      await window.__mockuplab.pack.add([new File([b], n, { type: 'image/png' })]);
    }, n);
  }
  await page.evaluate((s) => window.__mockuplab.pack.setStyle(s), 'table-walnut-sage');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.evaluate(() => window.__mockuplab.pack.downloadOne('hero'))]);
  await dl.saveAs('public/showcase/clients-pack.webp');
  console.log('saved clients-pack.webp');
}
await browser.close();

// the Studio at work (home page): a laptop and a phone side by side in the photo studio, the Décor page open
if (want('studio-ui')) {
  const { browser, page } = await openApp({ hash: '#/studio', colorScheme: 'dark', viewport: { width: 1600, height: 1000 } });
  await page.evaluate(async () => {
    const api = window.__mockuplab;
    const s = api.project.getState();
    s.setComposition(['laptop-14', 'phone-pro'], 'row');
    for (const it of api.project.getState().items) await api.loadSamples(it.id);
    s.setBackground({ kind: 'solid', color: '#e9e4f7' });
    s.setDecor({ kind: 'sweep' });
    s.setExport({ ratio: '16:9' });
    api.ui.getState().setStudioPage('decor');
    api.ui.getState().resetView();
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'public/showcase/studio-ui.jpg', type: 'jpeg', quality: 86 });
  console.log('saved studio-ui.jpg');
  await browser.close();
}
