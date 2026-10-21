// scripts/check-motion.mjs — motion: screen changes cross-fade (View Transitions, back button included, none under
// reduced motion), menus grow from their trigger, thumbnails arrive in a cascade, the home's end eases in.
import { openApp, check, done } from './lib/app.mjs';
const init = () => {
  window.__vt = 0;
  const original = document.startViewTransition?.bind(document);
  if (original)
    document.startViewTransition = (cb) => {
      window.__vt++;
      return original(cb);
    };
};
const { browser, page, errors } = await openApp({ hash: '#/studio', init });
const vt = () => page.evaluate(() => window.__vt);
const screen = () => page.evaluate(() => window.__mockuplab.ui.getState().screen);

// 1. screen changes
const v0 = await vt();
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Rapide' }).click();
await page.waitForTimeout(500);
check((await vt()) === v0 + 1 && (await screen()) === 'quick', `a mode change runs one screen transition (${(await vt()) - v0})`);
await page.goBack();
await page.waitForTimeout(500);
check((await vt()) === v0 + 2 && (await screen()) === 'studio', 'the back button too, and the screen follows the address');

// 2. menus grow from their trigger
await page.getByTestId('more-menu').first().click();
await page.waitForTimeout(60);
const menu = page.getByRole('menu').first();
const m = await menu.evaluate((el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return { name: s.animationName, origin: s.transformOrigin, centre: `${r.width / 2}px ${r.height / 2}px` };
});
check(m.name === 'menu-in' && m.origin !== m.centre, `a menu opens from its button (${m.name}, ${m.origin})`);
await page.keyboard.press('Escape');

// 3. thumbnails cascade in
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Rapide' }).click();
await page.waitForSelector('[data-testid=quick-tile]');
const delays = await page.getByTestId('quick-tile').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).animationDelay)));
check(delays.length === 6 && delays.every((d, i) => i === 0 || d > delays[i - 1]), `Quick photos arrive one after the other (${delays.join(', ')})`);

// 4. the end of the home page eases in when reached
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Studio' }).click();
await page.waitForTimeout(500);
await page.evaluate(() => window.__mockuplab.ui.getState().setScreen('home'));
await page.waitForSelector('[data-testid=home-end]');
const end = page.getByTestId('home-end').locator('.reveal').first();
check((await end.getAttribute('data-shown')) === null, 'the end waits off screen');
await page.getByTestId('home-end').scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
check((await end.getAttribute('data-shown')) !== null && (await end.evaluate((el) => getComputedStyle(el).opacity)) === '1', 'it eases in once reached');

// 5. reduced motion: no screen transition
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForTimeout(300);
const v1 = await vt();
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Projet' }).click();
await page.waitForTimeout(300);
check((await vt()) === v1 && (await screen()) === 'project', 'reduced motion: the screen changes at once');

await done(browser, errors);
