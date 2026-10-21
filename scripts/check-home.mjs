// scripts/check-home.mjs — the home page as an Apple-like product story: pinned chapters whose 3D and words follow
// the scroll continuously (both ways), black and white sections, labelled dots; no scroll listener; stills on a
// phone and with reduced motion. Plus what stays true: the main button, the modes, paste, fonts, the blue brand.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/home5', { recursive: true });
const CHAPTERS = ['open', 'drop', 'devices', 'studio', 'motion', 'social', 'clients', 'modes'];
const scroller = '[data-testid=home]';
// records every scroll listener the page registers
const spy = () => {
  window.__scrollListeners = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    // React delegates every event type once on its root container: that is not a scroll handler of the page
    if (type === 'scroll' && this.id !== 'root') window.__scrollListeners.push(this.constructor?.name ?? 'node');
    return add.call(this, type, ...rest);
  };
};
/** Scrolls so that `p` of chapter `id` crosses the middle of the screen. */
const at = async (page, id, p, wait = 1300) => {
  await page.evaluate(
    ({ s, id, p }) => {
      const root = document.querySelector(s);
      const t = root.querySelector(`[data-chapter-id=${id}]`);
      root.scrollTo(0, t.offsetTop + p * t.offsetHeight - root.clientHeight / 2);
    },
    { s: scroller, id, p },
  );
  await page.waitForTimeout(wait);
};
const stageShot = async (page) => (await page.getByTestId('hero-3d').screenshot()).toString('base64');
const diff = (page, a, b) =>
  page.evaluate(
    async ({ a, b }) => {
      const load = async (s) => {
        const i = new Image();
        i.src = `data:image/png;base64,${s}`;
        await i.decode();
        return i;
      };
      const [x, y] = await Promise.all([load(a), load(b)]);
      const px = (img) => {
        const c = document.createElement('canvas');
        c.width = 120;
        c.height = 120;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, 120, 120);
        return g.getImageData(0, 0, 120, 120).data;
      };
      const [p, q] = [px(x), px(y)];
      let d = 0;
      for (let i = 0; i < p.length; i += 4) d += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
      return d / ((p.length / 4) * 3 * 255);
    },
    { a, b },
  );

const { browser, page, errors } = await openApp({ viewport: { width: 1280, height: 720 }, init: spy });

// 1. the opening: the main button in the first screen, no arrow; paste asks for a mode
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
const cta = page.getByTestId('home-hero').getByRole('button', { name: 'Ouvrir le Studio', exact: true });
const box = await cta.boundingBox();
check(!!box && box.y + box.height <= 720, 'Open the Studio is in the first screen at 1280×720');
check((await cta.locator('svg').count()) === 0, 'no arrow added to the main button');
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'home' && (await page.getByText('Choisis d’abord un mode').isVisible()), 'paste on home asks to pick a mode first');
check((await page.getByRole('button', { name: 'Mes projets' }).count()) === 0, 'no « Mes projets » before any project');
await cta.click();
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'Open the Studio opens the Studio');

// 2. a saved project: « Mes projets » and « Reprendre »
await page.evaluate(() => window.__mockuplab.project.setState({ name: 'Reprise' }));
await page.waitForTimeout(2500);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Mes projets' }).click();
await page.waitForTimeout(300);
check(await page.getByTestId('all-projects').isVisible(), '« Mes projets » opens the projects window');
await page.keyboard.press('Escape');
await page.getByTestId('home-hero').getByRole('button', { name: /Reprendre « Reprise »/ }).click();
await page.waitForTimeout(600);
check((await page.evaluate(() => window.__mockuplab.project.getState().name)) === 'Reprise', '« Reprendre » opens the last project');

// 3. desktop: pinned chapters, continuous 3D, both ways
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.getByTestId('hero-3d').waitFor({ timeout: 15000 });
await page.waitForTimeout(2500);
check((await page.evaluate(() => window.__scrollListeners.length)) === 0, `no scroll listener on the page (${await page.evaluate(() => window.__scrollListeners.join(', '))})`);
const tracks = await page.evaluate((ids) => ids.map((id) => document.querySelector(`[data-chapter-id=${id}]`)?.offsetHeight ?? 0), CHAPTERS);
check(tracks.every((h) => h >= 900 * 1.5), `eight pinned chapters, each ≥ 150 vh (${tracks.map((h) => Math.round(h / 9))})`);
await page.screenshot({ path: 'out/home5/open-0.png' });
await at(page, 'open', 0.1);
const lid1 = await page.evaluate(() => window.__heroPose?.lidAngle);
await at(page, 'open', 0.9);
const lid2 = await page.evaluate(() => window.__heroPose?.lidAngle);
check(lid1 < lid2 && lid2 > 90, `the opening: the lid opens with the scroll (${lid1}° → ${lid2}°)`);
await page.screenshot({ path: 'out/home5/open-90.png' });
const words = async () => page.evaluate(() => document.querySelectorAll('[data-chapter-id=drop] [data-lit="true"]').length);
await at(page, 'drop', 0.15);
const w1 = await words();
await at(page, 'drop', 0.6);
const w2 = await words();
check(w2 > w1, `the words light up with the scroll (${w1} → ${w2})`);
await page.screenshot({ path: 'out/home5/drop-60.png' });
await at(page, 'devices', 0.3);
const d30 = await stageShot(page);
check((await page.evaluate(() => window.__heroState)) === 'devices', 'the stage follows the chapter');
await at(page, 'devices', 0.75);
const d75 = await stageShot(page);
await page.screenshot({ path: 'out/home5/devices-75.png' });
check((await diff(page, d30, d75)) > 0.02, 'within a chapter the 3D keeps changing (30 % ≠ 75 %)');
await at(page, 'devices', 0.3, 1800);
check((await diff(page, d30, await stageShot(page))) < 0.02, 'scrolling back gives the same picture again');
for (const [id, p] of [['studio', 0.5], ['motion', 0.6], ['social', 0.7], ['clients', 0.9]]) {
  await at(page, id, p);
  check((await page.evaluate(() => window.__heroState)) === id, `« ${id} »: the stage takes it`);
  await page.screenshot({ path: `out/home5/${id}-${p * 100}.png` });
}
const bgOf = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-testid=story-stage]')).backgroundColor);
await at(page, 'studio', 0.5);
const studioBg = await bgOf();
await at(page, 'open', 0.5);
const openBg = await bgOf();
const lum = (c) => (c.match(/\d+/g) ?? [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
check(lum(studioBg) > 200 && lum(openBg) < 20, `black and white sections (open ${openBg}, studio ${studioBg})`);

// 4. dots, copy, fonts
const dots = page.getByRole('navigation', { name: /Chapitres/ }).getByRole('button');
check((await dots.count()) === 8, `eight labelled dots (${await dots.count()})`);
await page.getByRole('button', { name: 'Réseaux' }).click();
await page.waitForTimeout(1800);
check((await page.evaluate(() => window.__heroState)) === 'social' && (await page.getByRole('button', { name: 'Réseaux' }).getAttribute('aria-current')) === 'step', 'a dot takes you to its chapter and is marked');
const text = await page.getByTestId('home').innerText();
check(!/[—–]/.test(text), 'no long dash in the page');
check(/gratuit/i.test(text) && /4K/.test(text) && /client/i.test(text) && /(post|story|Reel)/i.test(text), 'the story says free, 4K, social and clients');
const fonts = await page.evaluate(() => {
  const h = document.querySelector('[data-testid=home] h1');
  const p = document.querySelector('[data-testid=home] p');
  return { h: getComputedStyle(h).fontFamily, stretch: getComputedStyle(h).fontStretch, p: getComputedStyle(p).fontFamily };
});
check(/^"?Archivo/.test(fonts.h) && fonts.stretch === '125%' && /Geist/.test(fonts.p), 'titles in Archivo Expanded, text in Geist');

// 5. after the story: the modes and the end; off screen the 3D stops
// the three modes, told one after the other: the lit one and its picture follow the scroll
const lit = async () => page.evaluate(() => ({ mode: document.querySelector('[data-testid^="mode-card-"][data-lit="true"]')?.dataset.testid.slice(10), pic: [...document.querySelectorAll('[data-testid=mode-picture]')].find((i) => getComputedStyle(i).opacity === '1')?.getAttribute('src') }));
const seenModes = [];
for (const p of [0.27, 0.5, 0.73]) {
  await at(page, 'modes', p);
  seenModes.push(await lit());
}
await page.screenshot({ path: 'out/home5/modes-73.png' });
check(seenModes.map((x) => x.mode).join() === 'studio,quick,project' && new Set(seenModes.map((x) => x.pic)).size === 3, `the modes light up one after the other, each with its picture (${JSON.stringify(seenModes)})`);
check((await bgOf()) === 'rgb(245, 245, 247)', 'the modes on white');
await page.getByTestId('mode-card-quick').click();
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'quick', 'a mode opens its screen');
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
const order = await page.locator('[data-testid^="mode-card-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(10)));
check(order.join() === 'studio,quick,project', `mode cards in order (${order})`);
check((await page.getByTestId('home-end').getByRole('button', { name: 'Ouvrir le Studio' }).count()) === 1, 'the end has « Ouvrir le Studio »');
await page.evaluate(() => document.querySelector('[data-testid=home-end]').scrollIntoView());
await page.waitForTimeout(800);
const f1 = await page.evaluate(() => window.__heroFrames ?? 0);
await page.waitForTimeout(800);
check((await page.evaluate(() => window.__heroFrames ?? 0)) === f1, 'past the story, the 3D stops drawing');

// 6. reduced motion: no pinned tracks, a still per chapter
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
const still = await page.evaluate((ids) => ids.map((id) => {
  const t = document.querySelector(`[data-chapter-id=${id}]`);
  return { h: t.offsetHeight / innerHeight, img: !!t.querySelector('img')?.offsetParent };
}), CHAPTERS);
// pinned tracks are ≥ 1.5 screens; a plain chapter is as tall as its content
check(still.every((s) => s.h <= 1.4 && s.img), `reduced motion: plain chapters with a still each (${still.map((s) => s.h.toFixed(1))})`);
await page.emulateMedia({ reducedMotion: 'no-preference' });

// 7. phone: one column, a still per chapter, no sideways scroll, no warning over the page
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
const mobile = await page.evaluate((ids) => ({
  wide: document.querySelector('[data-testid=home]').scrollWidth > innerWidth + 1,
  stills: ids.map((id) => !!document.querySelector(`[data-chapter-id=${id}] img`)?.offsetParent),
}), CHAPTERS);
check(!mobile.wide && mobile.stills.every(Boolean) && (await page.getByRole('dialog').count()) === 0, `phone: no sideways scroll, a still per chapter (${mobile.stills})`);
await page.screenshot({ path: 'out/home5/mobile.png' });

// 8. the logo: the « studio sweep » mark drawn in SVG, the name in one colour
const logo = await page.getByTestId('logo').first().evaluate((el) => ({ svg: !!el.querySelector('svg'), img: !!el.querySelector('img'), colours: new Set([...el.querySelectorAll('span')].map((s) => getComputedStyle(s).color)).size, text: el.innerText.trim() }));
check(logo.svg && !logo.img && logo.colours === 1 && logo.text === 'MockupLab', `the logo: an SVG mark and « MockupLab » in one colour (${JSON.stringify(logo)})`);

// 8b. the blue brand
const orange = await page.evaluate(() => [...document.querySelectorAll('[data-testid=home] *')].filter((el) => getComputedStyle(el).color === 'rgb(255, 92, 53)' || getComputedStyle(el).backgroundColor === 'rgb(255, 92, 53)').length);
check(orange === 0, `no orange on the home page (${orange})`);
await done(browser, errors);
