// scripts/check-glass.mjs — frosted glass across the app, in light and in dark: blurred translucent surfaces with a
// lit edge and tinted shadows, readable text (contrast measured on the rendered pixels), solid surfaces under
// « reduced transparency », pressable buttons that give under the finger.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/glass', { recursive: true });

/** Luminance contrast of two [r, g, b] colours (WCAG). */
function contrast(a, b) {
  const L = ([r, g, b]) => {
    const c = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SURFACES = {
  rail: '[data-testid="studio-rail"]',
  panel: '[data-testid="rail-page"]',
  'floating bar': '[data-testid="floating-bar"]',
  'top bar': 'header',
};

for (const scheme of ['light', 'dark']) {
  const { browser, page, errors, context } = await openApp({ hash: '#/studio', colorScheme: scheme });
  await page.evaluate(async () => {
    const api = window.__mockuplab;
    await api.loadSamples(api.project.getState().items[0].id);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `out/glass/studio-${scheme}.png` });

  // 1. the floating surfaces are frosted glass with a lit edge and a tinted shadow
  for (const [name, sel] of Object.entries(SURFACES)) {
    const s = await page.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { filter: cs.backdropFilter || cs.webkitBackdropFilter, shadow: cs.boxShadow, bg: cs.backgroundColor };
    });
    const blur = Number(/blur\((\d+(?:\.\d+)?)px\)/.exec(s.filter ?? '')?.[1] ?? 0);
    const alpha = Number(/rgba?\([^)]*,\s*([\d.]+)\)/.exec(s.bg)?.[1] ?? 1);
    check(blur >= 20 && alpha < 1, `${scheme} · ${name}: translucent (${alpha}) and blurred (${blur} px)`);
    check(/inset/.test(s.shadow), `${scheme} · ${name}: a lit inner edge`);
    // shadows are tinted by the scene (blue-ish), never plain grey or black
    const tinted = [...s.shadow.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].some(([, r, g, b]) => Number(b) > Number(r) + 8);
    check(tinted, `${scheme} · ${name}: a tinted shadow`);
  }

  // 2. text on the glass reads (≥ 4.5:1), measured against the rendered panel
  const shot = await page.screenshot();
  const measures = await page.evaluate(async ({ png }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const k = img.width / innerWidth;
    const px = (x, y) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)];
    const rgb = (s) => (/rgba?\((\d+), (\d+), (\d+)/.exec(s) ?? []).slice(1, 4).map(Number);
    const panel = document.querySelector('[data-testid="rail-page"]');
    const box = panel.getBoundingClientRect();
    // a clear spot of the panel: just inside its bottom left corner
    const bg = px(box.left + 10, box.bottom - 10);
    const texts = [...panel.querySelectorAll('h2, h3, label, span, p')].filter((e) => e.offsetParent && e.innerText.trim() && !e.closest('button, [role="radio"]'));
    const colours = [...new Set(texts.map((e) => getComputedStyle(e).color))];
    return { bg, colours: colours.map(rgb) };
  }, { png: shot.toString('base64') });
  const worst = Math.min(...measures.colours.map((c) => contrast(c, measures.bg)));
  check(worst >= 4.5, `${scheme} · every text colour on the panel reads at ≥ 4.5:1 (worst ${worst.toFixed(2)} on ${measures.bg})`);

  // 3. menus and windows: glass too
  await page.getByTestId('top-export').click();
  await page.waitForTimeout(300);
  const sheet = await page.getByTestId('export-sheet').or(page.getByRole('dialog')).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { filter: cs.backdropFilter, shadow: cs.boxShadow };
  });
  check(/blur\((2\d|3\d)px\)/.test(sheet.filter) && /inset/.test(sheet.shadow), `${scheme} · the Export window is frosted glass`);
  await page.screenshot({ path: `out/glass/export-${scheme}.png` });
  await page.keyboard.press('Escape');

  // 4. buttons give under the finger
  const btn = page.getByTestId('top-export');
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const scale = await btn.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  check(scale > 0.9 && scale < 0.99, `${scheme} · a pressed button scales down a little (${scale.toFixed(3)})`);

  // 5. reduced transparency: solid surfaces, no blur
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await page.waitForTimeout(200);
  const solid = await page.locator(SURFACES.panel).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { filter: cs.backdropFilter, bg: cs.backgroundColor };
  });
  check((solid.filter === 'none' || !solid.filter) && !/rgba\([^)]*, 0?\.\d+\)/.test(solid.bg), `${scheme} · reduced transparency: a solid panel (${solid.bg}, ${solid.filter})`);
  await done(browser, errors);
}
