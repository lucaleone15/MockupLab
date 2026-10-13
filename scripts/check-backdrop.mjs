// scripts/check-backdrop.mjs — walls show the background: a red→blue gradient shows on the wall behind a poster,
// on the table set's wall and on the studio cyclo, in the exported image (tiles included).
import { writeFileSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });

const RED_BLUE = { kind: 'gradient', type: 'linear', angle: 180, stops: [{ color: '#d02020', at: 0 }, { color: '#2030d0', at: 1 }] };
const BLUE_RED = { ...RED_BLUE, stops: [{ color: '#2030d0', at: 0 }, { color: '#d02020', at: 1 }] };

/** Sets up a scene, exports it, and returns the average colour of small patches (fractions of the frame). */
async function shot(name, setup, patches) {
  const out = await page.evaluate(async ({ setup, patches }) => {
    const api = window.__mockuplab;
    const p = api.project.getState();
    if (!p.__backdropInit) p.setExport({ ratio: '16:9', format: 'png' });
    await new Function('api', `return (async () => { ${setup} })()`)(api);
    await new Promise((r) => setTimeout(r, 2500));
    const img = await api.renderImage();
    const bmp = await createImageBitmap(img.blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const avg = ([fx, fy]) => {
      const d = g.getImageData(Math.round(fx * bmp.width) - 4, Math.round(fy * bmp.height) - 4, 8, 8).data;
      const s = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k];
      return s.map((v) => Math.round(v / (d.length / 4)));
    };
    const buf = new Uint8Array(await img.blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { colors: patches.map(avg), png: btoa(bin) };
  }, { setup, patches });
  writeFileSync(`out/backdrop/${name}.png`, Buffer.from(out.png, 'base64'));
  return out.colors;
}
const reddish = ([r, , b]) => r > b + 30;
const bluish = ([r, , b]) => b > r + 30;

// 1. a poster on the wall, no set: the shared wall shows the gradient (red at the top, blue lower down)
const poster = await shot(
  'poster-gradient',
  `const s = api.project.getState();
   s.setDecor({ kind: 'none' });
   s.setBackground(${JSON.stringify(RED_BLUE)});
   s.addItem('poster');
   const id = api.project.getState().items.find((i) => i.modelId === 'poster').id;
   for (const it of api.project.getState().items) if (it.id !== id) s.removeItem(it.id);`,
  [[0.06, 0.08], [0.06, 0.62]],
);
check(reddish(poster[0]) && bluish(poster[1]), `poster wall follows the gradient: top ${poster[0]}, lower ${poster[1]}`);

// no wall colour of its own: the poster's settings have no "Couleur du mur"
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Réglages', exact: true }).click();
await page.waitForTimeout(300);
check((await page.getByText('Couleur du mur').count()) === 0, 'the poster has no wall colour of its own');

// table set: its wall shows the background too, whichever way round
for (const [name, bg, test] of [['table-red-top', RED_BLUE, reddish], ['table-blue-top', BLUE_RED, bluish]]) {
  const [top] = await shot(
    name,
    `const s = api.project.getState();
     if (!api.project.getState().items.some((i) => i.modelId === 'phone-pro')) s.addItem('phone-pro');
     const keep = api.project.getState().items.find((i) => i.modelId === 'phone-pro').id;
     for (const it of api.project.getState().items) if (it.id !== keep) s.removeItem(it.id);
     s.setDecor({ kind: 'table', material: 'oak' });
     s.setBackground(${JSON.stringify(bg)});`,
    [[0.5, 0.05]],
  );
  check(test(top), `table wall shows the background (${name}: ${top})`);
}

// studio cyclo with a gradient: the cyclo stays and shows it
const [cyc] = await shot('sweep-gradient', `const s = api.project.getState(); s.setDecor({ kind: 'sweep' }); s.setBackground(${JSON.stringify(RED_BLUE)});`, [[0.5, 0.05]]);
check((await page.evaluate(() => window.__mockuplab.project.getState().decor.kind)) === 'sweep', 'a gradient keeps the studio cyclo');
check(reddish(cyc), `the cyclo shows the gradient (${cyc})`);

// 2. same scene exported in 4K (several tiles): the gradient runs smoothly down the wall, no seam
const col = await shot('poster-gradient-4k', `api.project.getState().setExport({ resolution: '4k' });`, Array.from({ length: 12 }, (_, i) => [0.04, 0.04 + i * 0.08]));
const reds = col.map((c) => c[0]);
const steps = reds.slice(1).map((r, i) => r - reds[i]);
check(steps.every((d) => d <= 6) && Math.max(...steps.map(Math.abs)) < 40, `4K tiles: the wall gradient is continuous (red down the wall: ${reds.join(' ')})`);
await page.evaluate(() => window.__mockuplab.project.getState().setExport({ resolution: '1080' }));

await done(browser, errors);
