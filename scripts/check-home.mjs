// scripts/check-home.mjs — no drop on home: pick a mode first; Studio first and biggest; resume.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ viewport: { width: 1280, height: 720 } });
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check((await page.getByTestId('home-drop').count()) === 0, 'no drop zone on home');
const cta = page.getByRole('button', { name: 'Ouvrir le Studio', exact: true });
const box = await cta.boundingBox();
check(!!box && box.y + box.height <= 720, 'Open the Studio is in the first screen at 1280×720');
const order = await page.locator('[data-testid^="mode-card-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(10)));
check(order.join() === 'studio,quick,project', `mode cards in order (${order})`);
const [studioCard, quickCard] = await Promise.all([page.getByTestId('mode-card-studio').boundingBox(), page.getByTestId('mode-card-quick').boundingBox()]);
check(studioCard.width > quickCard.width * 1.5, 'Studio card is the big one');
const studioTitle = await page.getByTestId('mode-card-studio').getByText('Studio', { exact: true }).boundingBox();
check(!!studioTitle && studioTitle.y + studioTitle.height <= 720, `the Studio card and its name show in the first screen at 1280×720 (title bottom ${studioTitle && Math.round(studioTitle.y + studioTitle.height)})`);
for (const m of ['studio', 'quick', 'project']) check((await page.getByTestId(`mode-card-${m}`).innerText()).length > 20, `${m} card explains its role`);
// pasting on home does not import: it asks to pick a mode
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
await cta.click();
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'Open the Studio opens the Studio');
// a saved project resumes into the Studio
await page.evaluate(() => window.__mockuplab.project.setState({ name: 'Reprise' }));
await page.waitForTimeout(2500);
await page.evaluate(() => (location.hash = '#/'));
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
check((await page.getByTestId('project-card').count()) >= 1, 'recent projects shown');
await page.getByTestId('project-card').first().getByRole('button', { name: /Ouvrir/ }).click();
// a card opens the project's page; its button opens the Studio
await page.getByTestId('project-page').getByRole('button', { name: 'Ouvrir dans le Studio' }).click();
await page.waitForTimeout(400);
const r = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, name: window.__mockuplab.project.getState().name }));
check(r.screen === 'studio' && r.name === 'Reprise', `resume opens the Studio with the project (${r.screen}/${r.name})`);
// blue brand: the app's old orange is gone from the home page, the Studio's top bar and the icon
const orange = (scope) => page.evaluate((scope) => [...document.querySelectorAll(scope)].filter((el) => getComputedStyle(el).color === 'rgb(255, 92, 53)' || getComputedStyle(el).backgroundColor === 'rgb(255, 92, 53)').map((el) => el.textContent?.trim().slice(0, 20) || el.tagName), scope);
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(600);
const onHome = await orange('[data-testid=home] *');
check(onHome.length === 0, `no orange on the home page (${onHome.slice(0, 4)})`);
await page.goto('http://localhost:5173/studio');
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(600);
const onBar = await orange('header *');
check(onBar.length === 0, `no orange in the Studio's top bar (${onBar.slice(0, 4)})`);
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
