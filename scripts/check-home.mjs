// scripts/check-home.mjs — explanation, drop zone → studio with the image, resume, mode cards, paste.
import { readdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp();
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check(await page.getByRole('heading', { level: 1 }).isVisible(), 'headline present');
check((await page.getByTestId('project-card').count()) === 0, 'no recent projects on a first visit');
for (const m of ['quick', 'project']) check(await page.getByTestId(`mode-card-${m}`).isDisabled(), `${m} card disabled (soon)`);
const scroll = await page.evaluate(() => {
  const el = document.querySelector('[data-testid=home]');
  return el.scrollHeight - el.clientHeight;
});
check(scroll <= 0, `home fits 1440×900 without scrolling (overflow ${scroll}px)`);
// drop zone: pick a file
const sample = readdirSync('public/samples').find((f) => f === 'sample-app.png');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('home-drop').click()]);
await chooser.setFiles('public/samples/' + sample);
await page.waitForTimeout(1200);
const s = await page.evaluate(() => {
  const p = window.__mockuplab.project.getState();
  return { screen: window.__mockuplab.ui.getState().screen, hasImage: p.items.some((it) => Object.values(it.surfaces).some((b) => b.assetId)) };
});
check(s.screen === 'studio' && s.hasImage, 'picked image → studio, on the device screen');
// a saved photo project resumes into the photo screen (same browser: the autosave is kept across the reload)
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
// paste on home → studio
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(200);
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 600;
  c.getContext('2d').fillRect(0, 0, 300, 600);
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(800);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'paste on home → studio');
await done(browser, errors);
