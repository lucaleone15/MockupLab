// scripts/check-home.mjs — no drop on home: pick a mode first; Studio first and biggest; resume.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ viewport: { width: 1280, height: 720 } });
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check((await page.getByTestId('home-drop').count()) === 0, 'no drop zone on home');
const cta = page.getByRole('button', { name: 'Ouvrir le Studio', exact: true });
const box = await cta.boundingBox();
check(!!box && box.y + box.height <= 720, 'Open the Studio is in the first screen at 1280×720');
const order = await page.locator('[data-testid^="mode-card-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(10)));
check(order.join() === 'studio,quick,project,photo', `mode cards in order (${order})`);
const [studioCard, quickCard] = await Promise.all([page.getByTestId('mode-card-studio').boundingBox(), page.getByTestId('mode-card-quick').boundingBox()]);
check(studioCard.width > quickCard.width * 1.5, 'Studio card is the big one');
const studioTitle = await page.getByTestId('mode-card-studio').getByText('Studio', { exact: true }).boundingBox();
check(!!studioTitle && studioTitle.y + studioTitle.height <= 720, `the Studio card and its name show in the first screen at 1280×720 (title bottom ${studioTitle && Math.round(studioTitle.y + studioTitle.height)})`);
for (const m of ['studio', 'quick', 'project', 'photo']) check((await page.getByTestId(`mode-card-${m}`).innerText()).length > 20, `${m} card explains its role`);
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
// a saved photo project resumes into the photo screen
await page.evaluate(() => (location.hash = '#/photo'));
await page.waitForTimeout(300);
await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
await page.waitForTimeout(2500);
await page.evaluate(() => (location.hash = '#/'));
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
check((await page.getByTestId('project-card').count()) >= 1, 'recent projects shown');
await page.getByTestId('project-card').first().getByRole('button', { name: /Ouvrir/ }).click();
await page.waitForTimeout(400);
const r = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, photo: !!window.__mockuplab.project.getState().photo.assetId }));
check(r.screen === 'photo' && r.photo, 'resume opens the photo screen with its photo');
await done(browser, errors);
