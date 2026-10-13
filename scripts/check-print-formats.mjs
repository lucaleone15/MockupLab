// scripts/check-print-formats.mjs — paper sizes and "Adapt to my image" for poster, flyer, postcard, business card.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });

// helpers in the page: an image of a given size, a fresh scene with one model, its size
await page.evaluate(() => {
  const api = window.__mockuplab;
  window.__img = async (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').fillRect(0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return api.importAsset(new File([blob], `img-${w}x${h}.png`, { type: 'image/png' }));
  };
  window.__only = (modelId, params = {}) => {
    const s = api.project.getState();
    s.resetAll();
    s.addItem(modelId);
    const it = api.project.getState().items[0];
    for (const [k, v] of Object.entries(params)) api.project.getState().setParam(it.id, k, v);
    return it.id;
  };
  window.__size = async (id) => (await api.itemSize(id)).size.map((v) => Math.round(v * 10) / 10);
});

const r = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const out = {};
  // poster A2, adapted to a landscape image
  let id = window.__only('poster', { format: 'a2', frame: 'none' });
  out.posterDefault = api.project.getState().items[0].params.fit;
  const land = await window.__img(1600, 900);
  api.project.getState().setSurface(id, 'poster', { assetId: land.id });
  out.posterFit = await window.__size(id);
  api.project.getState().setParam(id, 'fit', false);
  out.posterPaper = await window.__size(id);
  // image removed: paper ratio again
  api.project.getState().setParam(id, 'fit', true);
  api.project.getState().setSurface(id, 'poster', { assetId: null });
  out.posterNoImage = await window.__size(id);
  // flyer DL, postcard square, business card 89×51 (no image, single)
  id = window.__only('flyer', { format: 'dl', layout: 'single' });
  out.flyerDL = await window.__size(id);
  id = window.__only('postcard', { format: 'sq14', layout: 'single' });
  out.postcardSq = await window.__size(id);
  id = window.__only('business-card', { format: 'us', layout: 'single' });
  out.cardUS = await window.__size(id);
  // an older project without "fit" stays as it was
  const old = api.persistence.migrateProject({ version: 6, items: [{ id: 'p', modelId: 'poster', params: { format: 'a3' } }] });
  out.oldFit = old.items[0].params.fit;
  return out;
});
check(r.posterDefault === true, '“Adapt to my image” is on by default');
const [pw, ph] = r.posterFit; // an upright poster: width, height, depth
check(Math.abs(pw / ph - 16 / 9) < 0.02 && Math.abs(pw - 59.4) < 0.2, `A2 poster adapted to a 16:9 image: ${pw} × ${ph} cm (long side 59.4)`);
check(r.posterPaper[0] === 42 && r.posterPaper[1] === 59.4, `A2 poster not adapted: 42 × 59.4 (${r.posterPaper})`);
check(r.posterNoImage[0] === 42 && r.posterNoImage[1] === 59.4, `no image: the paper's own ratio (${r.posterNoImage})`);
check(r.flyerDL[0] === 9.9 && r.flyerDL[2] === 21, `flyer DL 9.9 × 21 (${r.flyerDL})`);
check(r.postcardSq[0] === 14 && r.postcardSq[2] === 14, `square postcard 14 × 14 (${r.postcardSq})`);
check(r.cardUS[0] === 8.9 && r.cardUS[2] === 5.1, `US business card 8.9 × 5.1 (${r.cardUS})`);
check(r.oldFit === false, 'an older project keeps its paper ratio (no “adapt”)');

// the panel: the ten poster sizes and the real size
await page.evaluate(async () => {
  const id = window.__only('poster', { format: 'a2' });
  const land = await window.__img(1600, 900);
  window.__mockuplab.project.getState().setSurface(id, 'poster', { assetId: land.id });
});
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Réglages', exact: true }).click();
await page.waitForTimeout(300);
const sizes = ['A4', 'A3', 'A2', 'A1', 'A0', '30 × 40', '40 × 50', '50 × 70', '61 × 91', '70 × 100'];
const seen = [];
for (const s of sizes) if (await page.getByRole('radio', { name: s, exact: true }).count()) seen.push(s);
check(seen.length === 10, `ten poster sizes offered (${seen.join(', ')})`);
check(await page.getByRole('switch', { name: 'Adapter à mon image' }).isVisible(), '“Adapt to my image” switch shown');
check(await page.getByText('≈ 59 × 33 cm').first().isVisible().catch(() => false), 'the real size is shown (≈ 59 × 33 cm)');

// the size is chosen right where the poster was picked (Devices page)
await page.evaluate(() => window.__mockuplab.project.getState().resetAll());
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Appareils', exact: true }).click();
await page.getByTestId('library-tabs').getByRole('button', { name: 'Print' }).click();
await page.getByTestId('rail-page').getByRole('button', { name: 'Affiche', exact: true }).click();
await page.waitForTimeout(300);
check(await page.getByTestId('rail-page').getByRole('switch', { name: 'Adapter à mon image' }).isVisible().catch(() => false), 'Devices page: “Adapt to my image” right after picking the poster');
check(await page.getByTestId('rail-page').getByRole('radio', { name: 'A1', exact: true }).isVisible().catch(() => false), 'Devices page: the sizes right after picking the poster');
// a bigger size re-frames the view (the poster stays in the frame)
const dist = () => page.evaluate(() => { const c = window.__mockuplab.bridge().camera; return c.position.length(); });
await page.waitForTimeout(500);
const d0 = await dist();
await page.getByTestId('rail-page').getByRole('radio', { name: 'A0', exact: true }).click();
await page.waitForTimeout(800);
const d1 = await dist();
check(d1 > d0 * 1.4, `A2 → A0 re-frames the view (camera ${Math.round(d0)} → ${Math.round(d1)})`);
// other size changes (a laptop's lid) keep the user's view
const lid = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const s = api.project.getState();
  s.resetAll();
  s.addItem('laptop-14');
  await new Promise((r) => setTimeout(r, 600));
  const cam = api.bridge().camera;
  const before = cam.position.clone();
  const it = api.project.getState().items[0];
  const def = (await api.models).find?.((m) => m.id === 'laptop-14');
  api.project.getState().setParam(it.id, 'angle', 70);
  await new Promise((r) => setTimeout(r, 600));
  return before.distanceTo(cam.position);
});
check(lid < 0.01, `changing a laptop's lid angle keeps the view (camera moved ${lid.toFixed(2)})`);
await done(browser, errors);
