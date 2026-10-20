// scripts/check-print-formats-2.mjs — every printed model has its sizes and “Adapt to my image”; the stationery
// set is split into a letterhead and an envelope.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/print2', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/studio' });

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
});

// 1. every printed model: sizes and “Adapt to my image”
const models = await page.evaluate(async () => {
  const { MODELS } = await import('/src/models/registry.ts');
  // the swatch fan is drawn from the brand (no image of the user's): no paper size to pick
  return MODELS.filter((m) => m.category === 'print' && m.surfaces.length).map((m) => ({
    id: m.id,
    sizes: m.params?.find((p) => p.id === 'format')?.options?.map((o) => o.value) ?? [],
    fit: !!m.params?.some((p) => p.id === 'fit'),
    paper: !!m.paperSize,
  }));
});
const ids = models.map((m) => m.id);
check(!ids.includes('stationery') && ids.includes('letterhead') && ids.includes('envelope'), `the stationery set is two objects: letterhead and envelope (${ids.join(', ')})`);
const kinds = await page.evaluate(async () => {
  const { MODELS } = await import('/src/models/registry.ts');
  return Object.fromEntries(MODELS.map((m) => [m.id, m.category]));
});
check(kinds['swatch-fan'] === 'print' && !('specimen' in kinds), `the swatch fan is with the printed goods, the specimen card is gone`);
const noSpecimen = await page.evaluate(() => window.__mockuplab.persistence.migrateProject({ version: 6, items: [{ id: 'x', modelId: 'specimen', params: {} }, { id: 'y', modelId: 'flyer', params: {} }] }).items.map((i) => i.modelId));
check(noSpecimen.join() === 'flyer', `an old specimen card is dropped (${noSpecimen})`);
for (const m of models) check(m.sizes.length >= 2 && m.fit && m.paper, `${m.id}: ${m.sizes.length} sizes, adapt to my image, real size shown`);

const defaults = await page.evaluate(async () => {
  const { getModel } = await import('/src/models/registry.ts');
  const { defaultParams } = await import('/src/models/types.ts');
  return { poster: defaultParams(getModel('poster')), flyer: defaultParams(getModel('flyer')) };
});
check(defaults.poster.mat === false, 'a poster has one frame by default (no mat that reads as a second frame)');
check(defaults.flyer.layout === 'single', 'a flyer is one sheet by default');
const doubles = await page.evaluate(async () => {
  const { MODELS } = await import('/src/models/registry.ts');
  const { defaultParams } = await import('/src/models/types.ts');
  return MODELS.filter((m) => 'layout' in defaultParams(m) && m.category === 'print').map((m) => `${m.id}:${defaultParams(m).layout}`);
});
check(doubles.every((d) => d.endsWith(':single')), `nothing shows twice by default (${doubles.join(', ')})`);

// the swatch fan: its own colours, as many as wanted, each with a name
await page.evaluate(() => {
  window.__only('swatch-fan');
  window.__mockuplab.ui.getState().setStudioPage('settings');
});
await page.waitForTimeout(500);
const fan = page.getByTestId('colors-param');
const rows0 = await fan.getByRole('textbox', { name: /Nom de la couleur/ }).count();
const brandN = await page.evaluate(() => window.__mockuplab.project.getState().brand.colors.length);
check(rows0 === brandN, `the fan starts from the brand's palette (${rows0} colours)`);
await fan.getByRole('button', { name: 'Ajouter une couleur' }).click();
await fan.getByRole('button', { name: 'Ajouter une couleur' }).click();
await fan.getByRole('textbox', { name: 'Nom de la couleur 1' }).fill('Bleu nuit');
check((await fan.getByRole('textbox', { name: 'Code hex de la couleur 1' }).inputValue()).startsWith('#'), 'each colour shows its hex value');
await fan.getByRole('textbox', { name: 'Code hex de la couleur 1' }).fill('#123456');
await page.waitForTimeout(300);
let fanColors = await page.evaluate(() => JSON.parse(window.__mockuplab.project.getState().items[0].params.colors));
check(fanColors.length === brandN + 2 && fanColors[0].name === 'Bleu nuit' && fanColors[0].hex === '#123456', `two colours added, the first renamed and given a hex value (${fanColors.length}, ${fanColors[0].name}, ${fanColors[0].hex})`);
await fan.getByRole('button', { name: /Retirer la couleur 2/ }).click();
await page.waitForTimeout(300);
fanColors = await page.evaluate(() => JSON.parse(window.__mockuplab.project.getState().items[0].params.colors));
check(fanColors.length === brandN + 1, `a colour removed (${fanColors.length})`);
await page.getByTestId('frame').screenshot({ path: 'out/print2/swatch-fan-custom.png' });
await fan.getByRole('button', { name: 'Reprendre la palette de la marque' }).click();
check((await page.evaluate(() => window.__mockuplab.project.getState().items[0].params.colors)) === '', 'back to the brand palette');

// 2. two sizes give two boxes; a wide image adapts the paper
// the open magazine's image is a spread of two pages; the brochure's sizes are the open sheet
const MAIN = { magazine: ['spread', 2] };
for (const m of models) {
  const r = await page.evaluate(
    async ({ m, main }) => {
      const api = window.__mockuplab;
      const [a, b] = [m.sizes[0], m.sizes[m.sizes.length - 1]];
      const id = window.__only(m.id, { format: a, fit: false });
      const sa = (await api.itemSize(id)).size;
      api.project.getState().setParam(id, 'format', b);
      const sb = (await api.itemSize(id)).size;
      const { getModel } = await import('/src/models/registry.ts');
      const model = getModel(m.id);
      const [slot, divide] = main ?? [model.surfaces[0].id, 1];
      const img = await window.__img(1200 * divide, 600);
      api.project.getState().setSurface(id, slot, { assetId: img.id });
      api.project.getState().setParam(id, 'fit', true);
      const it = api.project.getState().items[0];
      const { aspectsOf } = await import('/src/models/imageAspects.ts');
      const paper = model.paperSize({ ...it.params }, aspectsOf(it.surfaces));
      return { sa, sb, paper };
    },
    { m, main: MAIN[m.id] },
  );
  check(r.sa.join() !== r.sb.join(), `${m.id}: the size changes the object (${r.sa.map(Math.round)} → ${r.sb.map(Math.round)})`);
  check(Math.abs(r.paper[0] / r.paper[1] - 2) < 0.02, `${m.id}: adapted to a 2:1 image, the paper is 2:1 (${r.paper.map((v) => v.toFixed(1))})`);
}

// 2b. a poster leaning on the floor of the photo studio stands on the flat floor, against a flat wall (not in the cove)
const lean = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const id = window.__only('poster', { mount: 'lean' });
  api.project.getState().setDecor({ kind: 'sweep' });
  const { sceneWall, SWEEP_BACK, SWEEP_COVE } = await import('/src/lib/arrange.ts');
  const s = api.project.getState();
  const it = s.items.find((i) => i.id === id);
  const size = (await api.itemSize(id)).size;
  const hung = window.__only('poster', { mount: 'wall' });
  api.project.getState().setDecor({ kind: 'sweep' });
  const wallHung = sceneWall(api.project.getState().items, api.project.getState().decor);
  return { wall: sceneWall(s.items, s.decor), front: it.position[2] + size[2] / 2, flat: SWEEP_BACK + SWEEP_COVE, wallHung, hung };
});
check(lean.wall?.draw && Math.abs(lean.wall.z - lean.flat) < 0.01, `a leaning poster gets a flat wall where the studio floor is still flat (${JSON.stringify(lean.wall)})`);
check(lean.front - 8 > lean.flat - 0.5, `its foot stands on the flat floor (front ${lean.front.toFixed(1)}, flat from ${lean.flat})`);
check(lean.wallHung && !lean.wallHung.draw, 'a hanging poster keeps the studio backdrop');

// 2c. the poster's settings: few in sight (size, frame, mount), the finer ones folded away
await page.evaluate(() => {
  window.__only('poster');
  window.__mockuplab.ui.getState().setStudioPage('settings');
});
await page.waitForTimeout(400);
const panel = page.getByTestId('rail-page');
const visible = async (name) => panel.getByText(name, { exact: true }).first().isVisible().catch(() => false);
check((await visible('Format')) && (await visible('Cadre')) && (await visible('Accrochage')), 'format, frame and mount are in sight');
check(!(await visible('Passe-partout')) && !(await visible('Finition')), 'mat and paper finish are folded under « Paramètres avancés »');
check(await panel.getByRole('radio', { name: 'Aucun' }).first().isVisible(), 'the frame can be removed in one click (Cadre: Aucun)');
await panel.getByRole('button', { name: 'Paramètres avancés' }).last().click();
check(await visible('Passe-partout'), 'the mat is there once unfolded');
await panel.getByRole('radio', { name: 'Aucun' }).first().click();
await page.waitForTimeout(200);
check(!(await visible('Passe-partout')), 'no mat setting without a frame');

// 3. an old stationery set opens as a letterhead and an envelope, with their images
const old = await page.evaluate(async () => {
  const api = window.__mockuplab;
  const a = await window.__img(210, 297);
  const b = await window.__img(220, 110);
  const p = api.persistence.migrateProject({
    version: 6,
    items: [{ id: 's', modelId: 'stationery', params: { paper: 'satin' }, surfaces: { letter: { assetId: a.id }, envelope: { assetId: b.id } }, position: [0, 0, 0] }],
  });
  return { items: p.items.map((i) => ({ model: i.modelId, image: i.surfaces.front?.assetId, paper: i.params.paper })), a: a.id, b: b.id };
});
check(
  old.items.length === 2 && old.items[0].model === 'letterhead' && old.items[0].image === old.a && old.items[1].model === 'envelope' && old.items[1].image === old.b && old.items.every((i) => i.paper === 'satin'),
  `an old stationery set becomes a letterhead and an envelope (${JSON.stringify(old.items)})`,
);

// 4. each printed model renders with its sample, at two sizes
for (const m of models) {
  await page.evaluate(async (m) => {
    const id = window.__only(m.id, { format: m.sizes[m.sizes.length - 1] });
    await window.__mockuplab.loadSamples(id);
    window.__mockuplab.ui.getState().resetView();
  }, m);
  await page.waitForTimeout(900);
  await page.getByTestId('frame').screenshot({ path: `out/print2/${m.id}.png` });
}

await done(browser, errors);
