// scripts/check-home.mjs — the home page as a 3D story: a split hero, a 3D stage that stays on the right and changes
// with each chapter, labelled dots, the page's paper changing colour, light and dark; then the modes and the end.
// Plus what stays true: the call to action in the first screen, the modes, paste, fonts, the blue brand.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/home4', { recursive: true });
const CHAPTERS = ['why', 'devices', 'studio', 'motion', 'social', 'clients'];
const scroller = '[data-testid=home]';
const toChapter = async (page, id) => {
  await page.evaluate((id) => document.querySelector(`[data-chapter-id=${id}]`).scrollIntoView({ block: 'center' }), id);
  await page.waitForTimeout(1100);
};

const { browser, page, errors } = await openApp({ viewport: { width: 1280, height: 720 } });

// 1. first visit: the home page; the main action in the first screen; no arrow on it
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check((await page.getByTestId('home-drop').count()) === 0, 'no drop zone on home');
const cta = page.getByTestId('home-hero').getByRole('button', { name: 'Ouvrir le Studio', exact: true });
const box = await cta.boundingBox();
check(!!box && box.y + box.height <= 720, 'Open the Studio is in the first screen at 1280×720');
check((await cta.locator('svg').count()) === 0, 'no arrow added to the main button');

// 2. paste on home asks to pick a mode first
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'home', 'paste on home stays on home');
check(await page.getByText('Choisis d’abord un mode').isVisible(), 'paste on home says to pick a mode');

// 3. no project yet: no « Mes projets », no « Reprendre »
check((await page.getByRole('button', { name: 'Mes projets' }).count()) === 0, 'no « Mes projets » before any project');
await cta.click();
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'Open the Studio opens the Studio');

// 4. a saved project: « Mes projets » in the header, « Reprendre » under the main button
await page.evaluate(() => window.__mockuplab.project.setState({ name: 'Reprise' }));
await page.waitForTimeout(2500);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
check((await page.getByTestId('recents').count()) === 0 && (await page.getByTestId('showcase-strip').count()) === 0, 'no recents row and no « Fait avec MockupLab » strip at the bottom');
await page.getByRole('button', { name: 'Mes projets' }).click();
await page.waitForTimeout(300);
check(await page.getByTestId('all-projects').isVisible(), '« Mes projets » opens the projects window');
await page.keyboard.press('Escape');
await page.getByTestId('home-hero').getByRole('button', { name: /Reprendre « Reprise »/ }).click();
await page.waitForTimeout(600);
const r = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, name: window.__mockuplab.project.getState().name }));
check(r.screen === 'studio' && r.name === 'Reprise', `« Reprendre » opens the last project in the Studio (${r.screen}/${r.name})`);

// 5. desktop: split hero, the stage stays on the right, each chapter changes it, the paper changes colour
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
const stage = page.getByTestId('hero-3d');
await stage.waitFor({ timeout: 15000 });
await page.waitForTimeout(2000);
const h1 = await page.getByTestId('home-hero').getByRole('heading', { level: 1 }).boundingBox();
const sb = await stage.boundingBox();
check(!!h1 && !!sb && h1.x < 200 && h1.x + h1.width <= sb.x + 1, `split hero: the title on the left, the 3D on the right (${Math.round(h1?.x)}–${Math.round(h1?.x + h1?.width)} | ${Math.round(sb?.x)})`);
check((await page.getByTestId('home').getAttribute('data-theme')) === null, 'the page follows the app theme (not forced dark)');
await page.screenshot({ path: 'out/home4/hero-dark.png' });
const paper0 = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, scroller);
const seen = new Set();
for (const id of CHAPTERS) {
  await toChapter(page, id);
  const st = await page.evaluate(() => ({ chapter: document.querySelector('[data-testid=hero-3d]')?.dataset.chapter, state: window.__heroState }));
  seen.add(st.state);
  check(st.chapter === id && st.state === id, `chapter « ${id} »: the 3D takes its state (${st.chapter}/${st.state})`);
  const top = (await stage.boundingBox())?.y ?? -1;
  check(top >= -1 && top < 40, `chapter « ${id} »: the 3D stays in view (top ${Math.round(top)})`);
  await page.screenshot({ path: `out/home4/chapter-${id}.png` });
}
check(seen.size === CHAPTERS.length, 'six different 3D states');
await toChapter(page, 'why');
const paper1 = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, scroller);
check(paper0 !== paper1, `the page's paper changes with the chapter (${paper0} → ${paper1})`);

// 6. the dots: labelled, clickable, the current one marked
const dots = page.getByRole('navigation', { name: /Chapitres/ }).getByRole('button');
check((await dots.count()) === 7, `seven labelled dots (${await dots.count()})`);
await dots.filter({ hasText: 'Réseaux' }).first().click({ force: true }).catch(() => page.getByRole('button', { name: 'Réseaux' }).click());
await page.waitForTimeout(1600);
check((await page.evaluate(() => window.__heroState)) === 'social', 'a dot takes you to its chapter');
check((await page.getByRole('button', { name: 'Réseaux' }).getAttribute('aria-current')) === 'step', 'the current dot is marked');

// 7. the copy: no long dash, the main label only once per place, the story's promises
const text = await page.getByTestId('home').innerText();
check(!/[—–]/.test(text), 'no long dash in the page');
check(/gratuit/i.test(text) && /4K/.test(text) && /(ordinateur|appareil)/i.test(text) && /client/i.test(text) && /(post|story|Reel)/i.test(text), 'the story says free, 4K, private, social and clients');
const fonts = await page.evaluate(() => {
  const h = document.querySelector('[data-testid=home] h1');
  const p = document.querySelector('[data-testid=home] p');
  return { h: getComputedStyle(h).fontFamily, stretch: getComputedStyle(h).fontStretch, p: getComputedStyle(p).fontFamily };
});
check(/^"?Archivo/.test(fonts.h) && fonts.stretch === '125%' && /Geist/.test(fonts.p), `titles in Archivo Expanded, text in Geist (${JSON.stringify(fonts)})`);

// 8. after the story: the three modes on one row, Studio the big one; the end
const order = await page.locator('[data-testid^="mode-card-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(10)));
check(order.join() === 'studio,quick,project', `mode cards in order (${order})`);
const cards = await Promise.all(['studio', 'quick', 'project'].map((m) => page.getByTestId(`mode-card-${m}`).boundingBox()));
check(cards[0].width > cards[1].width * 1.5 && cards.every((c) => Math.abs(c.y - cards[0].y) < 2), 'the modes share one row, Studio the big one');
for (const m of ['studio', 'quick', 'project']) check((await page.getByTestId(`mode-card-${m}`).innerText()).length > 20, `${m} card explains its role`);
check((await page.getByTestId('home-end').getByRole('button', { name: 'Ouvrir le Studio' }).count()) === 1, 'the end has « Ouvrir le Studio »');

// 9. off screen the 3D stops drawing; the project is left alone
const itemsBefore = await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((i) => i.modelId)));
await page.evaluate(() => document.querySelector('[data-testid=home-end]').scrollIntoView());
await page.waitForTimeout(800);
const f1 = await page.evaluate(() => window.__heroFrames ?? 0);
await page.waitForTimeout(800);
check((await page.evaluate(() => window.__heroFrames ?? 0)) === f1, 'scrolled past the story, the 3D stops drawing');
check((await page.evaluate(() => JSON.stringify(window.__mockuplab.project.getState().items.map((i) => i.modelId)))) === itemsBefore, 'the 3D story leaves the project alone');

// 10. every render loads in full size
for (let y = 0; y < 14000; y += 800) {
  await page.evaluate(({ s, y }) => document.querySelector(s).scrollTo(0, y), { s: scroller, y });
  await page.waitForTimeout(150);
}
await page.waitForTimeout(800);
const imgs = await page.evaluate(() => [...document.querySelectorAll('[data-testid=home] img[src*="/showcase/"]')].filter((i) => i.offsetParent).map((i) => ({ src: i.getAttribute('src'), w: Math.max(i.naturalWidth, i.naturalHeight) })));
check(imgs.every((i) => i.w >= 1000), `every visible render loads (${imgs.filter((i) => i.w < 1000).map((i) => i.src).join(', ') || imgs.length})`);

// 11. light: the page is light, the paper still changes; dark stays dark
await page.emulateMedia({ colorScheme: 'light' });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(1500);
const lum = (c) => (c.match(/\d+/g) ?? [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
const lightBg = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, scroller);
check(lum(lightBg) > 190, `light theme: a light page (${lightBg})`);
await page.screenshot({ path: 'out/home4/hero-light.png' });
for (const id of ['studio', 'social']) {
  await toChapter(page, id);
  await page.screenshot({ path: `out/home4/chapter-${id}-light.png` });
}
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
const darkBg = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, scroller);
check(lum(darkBg) < 60, `dark theme: a dark page (${darkBg})`);

// 12. reduced motion: the stage holds still
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await stage.waitFor({ timeout: 15000 });
await page.waitForTimeout(2500);
const s1 = (await stage.screenshot()).toString('base64');
await page.waitForTimeout(800);
check(s1 === (await stage.screenshot()).toString('base64'), 'with reduced motion the 3D holds still');
await page.emulateMedia({ reducedMotion: 'no-preference' });

// 13. phone: one column, a picture under each chapter, no sideways scroll
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
const mobile = await page.evaluate((ids) => ({
  wide: document.querySelector('[data-testid=home]').scrollWidth > innerWidth + 1,
  stills: ids.map((id) => !!document.querySelector(`[data-chapter-id=${id}] img, [data-chapter-id=${id}] video`)?.offsetParent),
}), CHAPTERS);
check(!mobile.wide, 'phone: no sideways scroll');
check((await page.getByRole('dialog').count()) === 0, 'phone: no « made for a computer » warning over the home page (it is about the editor)');
check(mobile.stills.every(Boolean), `phone: a picture under each chapter (${mobile.stills})`);
await page.screenshot({ path: 'out/home4/mobile.png', fullPage: false });

// 14. the blue brand: no orange on the home page, a blue icon
const orange = await page.evaluate(() => [...document.querySelectorAll('[data-testid=home] *')].filter((el) => getComputedStyle(el).color === 'rgb(255, 92, 53)' || getComputedStyle(el).backgroundColor === 'rgb(255, 92, 53)').length);
check(orange === 0, `no orange on the home page (${orange})`);
const hue = await page.evaluate(async () => {
  const img = new Image();
  img.src = '/icons/icon-192.png?' + Date.now();
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, 192, 192).data;
  let r = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (d[i + 3] > 200 && max - min > 60) { r += d[i]; b += d[i + 2]; }
  }
  return { r, b };
});
check(hue.b > hue.r * 1.3, `the app icon is blue (${JSON.stringify(hue)})`);
await done(browser, errors);
