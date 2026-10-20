// scripts/check-export-2.mjs — one Export window for the image and the video: tabs, animation thumbnails
// that play on hover, a preview that stops from its own button or Escape, no Video page in the rail.
import { mkdirSync } from 'node:fs';
import { openApp, check, done } from './lib/app.mjs';
mkdirSync('out/export2', { recursive: true });
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const ui = () => page.evaluate(() => window.__mockuplab.ui.getState());
const rail = page.getByTestId('studio-rail');
await page.getByRole('button', { name: 'Essayer un exemple' }).click();
await page.waitForTimeout(1500);

check((await rail.getByRole('tab', { name: 'Vidéo', exact: true }).count()) === 0, 'no Video page in the rail');
await page.keyboard.press('Meta+e');
await page.waitForTimeout(300);
const sheet = page.getByTestId('export-sheet');
check(await sheet.isVisible(), '⌘E opens the Export window');
check((await sheet.getByTestId('export-tab-image').getAttribute('aria-selected')) === 'true', 'it opens on Image');
await sheet.getByTestId('export-tab-video').click();
const tiles = sheet.getByTestId('anim-tile');
check((await tiles.count()) === 13, `Video lists the 13 animations (${await tiles.count()})`);
check((await tiles.locator('svg').count()) >= 13, 'each animation has its thumbnail');
const state = (i) => tiles.nth(i).locator('.anim-thumb').evaluate((el) => getComputedStyle(el).animationPlayState);
check((await state(8)) === 'paused', 'a thumbnail rests until hovered');
await tiles.nth(8).hover();
await page.waitForTimeout(100);
check((await state(8)) === 'running', 'hovering a thumbnail plays it');
await page.screenshot({ path: 'out/export2/video.png' });

// preview: the window steps aside, a stop button that does not cover the bottom bar
await sheet.getByTestId('video-preview').click();
await page.waitForTimeout(800);
check((await ui()).previewing, 'Preview plays');
check(!(await sheet.isVisible().catch(() => false)), 'the Export window steps aside during the preview');
const stop = page.getByTestId('preview-stop');
const [sb, fb] = await Promise.all([stop.boundingBox(), page.getByTestId('floating-bar').boundingBox()]);
check(!!sb && !!fb && (sb.y + sb.height < fb.y || sb.y > fb.y + fb.height || sb.x > fb.x + fb.width || sb.x + sb.width < fb.x), 'the stop button does not cover the bottom bar');
await page.screenshot({ path: 'out/export2/preview.png' });
await stop.click();
await page.waitForTimeout(500);
check(!(await ui()).previewing, 'its button stops the preview');
check(await sheet.isVisible(), 'the Export window comes back after the preview');
check((await sheet.getByTestId('export-tab-video').getAttribute('aria-selected')) === 'true', '… on the Video tab');
await sheet.getByTestId('video-preview').click();
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
check(!(await ui()).previewing, 'Escape stops the preview too');
check(await sheet.isVisible(), 'and the window comes back');

// the video export downloads from the window
await page.evaluate(() => {
  const s = window.__mockuplab.project.getState();
  s.setExport({ video: { ...s.export.video, animation: 'turntable', duration: 2, resolution: '720', fps: 24, format: 'mp4', quality: 'fast' } });
});
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), sheet.getByTestId('video-export').click()]);
check(/\.mp4$/.test(dl.suggestedFilename()), `the video downloads (${dl.suggestedFilename()})`);
await page.waitForTimeout(500);
await page.keyboard.press('Meta+e');
await page.waitForTimeout(300);
check((await sheet.getByTestId('export-tab-video').getAttribute('aria-selected')) === 'true', '⌘E reopens on the last tab used');
await done(browser, errors);
