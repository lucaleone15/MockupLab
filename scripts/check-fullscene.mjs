// scripts/check-fullscene.mjs — the Studio's 3D scene fills the window under the panels; the camera frames the export
// exactly (what the frame shows is what is exported), outside the frame a veil; clicks still pick the device.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/fullscene', { recursive: true });

for (const scheme of ['dark', 'light']) {
  const { browser, page, errors } = await openApp({ hash: '#/studio', colorScheme: scheme });
  await page.evaluate(async () => {
    const api = window.__mockuplab;
    await api.loadSamples(api.project.getState().items[0].id);
    api.project.getState().setExport({ format: 'png', resolution: '1080', ratio: '16:9' });
    api.ui.getState().resetView();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `out/fullscene/studio-${scheme}.png` });

  // 1. the canvas covers the stage area, under the rail and the panel; the frame sits right of the panel
  const r = await page.evaluate(() => {
    const rect = (el) => el && el.getBoundingClientRect().toJSON();
    return {
      canvas: rect(document.querySelector('[data-testid=scene-area] canvas')),
      rail: rect(document.querySelector('[data-testid=studio-rail]')),
      panel: rect(document.querySelector('[data-testid=rail-page]')),
      frame: rect(document.querySelector('[data-testid=frame]')),
      w: innerWidth,
    };
  });
  check(!!r.canvas && r.canvas.left <= r.rail.left + 1 && r.canvas.right >= r.w - 2, `${scheme}: the scene runs under the rail and the panel to the window's edge (${Math.round(r.canvas?.left)}–${Math.round(r.canvas?.right)})`);
  check(r.frame.left >= r.panel.right - 1 && r.frame.right <= r.w, `${scheme}: the export frame sits in the free space right of the panel`);

  // 2. the frame shows exactly what is exported
  const compare = async () => {
    const box = await page.getByTestId('frame').boundingBox();
    const shot = await page.screenshot({ clip: box });
    return page.evaluate(
      async ({ png, w, h }) => {
        const load = async (src) => {
          const i = new Image();
          i.src = src;
          await i.decode();
          return i;
        };
        const live = await load(`data:image/png;base64,${png}`);
        const { blob } = await window.__mockuplab.renderImage();
        const out = await load(URL.createObjectURL(blob));
        const W = 160;
        const H = Math.round((W * h) / w);
        const px = (img) => {
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, W, H);
          return g.getImageData(0, 0, W, H).data;
        };
        const a = px(live);
        const b = px(out);
        let d = 0;
        for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        return d / ((a.length / 4) * 3);
      },
      { png: shot.toString('base64'), w: box.width, h: box.height },
    );
  };
  const d1 = await compare();
  check(d1 < 12, `${scheme}: the frame shows what is exported (mean difference ${d1.toFixed(1)} / 255)`);
  await page.getByTestId('format-menu').click();
  await page.getByRole('menuitemradio', { name: /^4:5/ }).click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__mockuplab.ui.getState().resetView());
  await page.waitForTimeout(1500);
  const d2 = await compare();
  check(d2 < 12, `${scheme}: still after switching to 4:5 (mean difference ${d2.toFixed(1)} / 255)`);
  await page.screenshot({ path: `out/fullscene/studio-${scheme}-4x5.png` });

  // 3. outside the frame, a veil: the scene is dimmed there
  const veil = await page.evaluate(() => {
    const f = document.querySelector('[data-testid=frame]');
    return getComputedStyle(f).boxShadow;
  });
  const spread = Math.max(0, ...[...veil.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])));
  check(spread >= 500, `${scheme}: a veil spreads around the frame (${spread} px)`);

  // 4. a click on the device picks it
  await page.evaluate(() => window.__mockuplab.ui.getState().setStudioPage('decor'));
  const box = await page.getByTestId('frame').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'settings', `${scheme}: a click on the device opens its settings`);
  await done(browser, errors);
}
