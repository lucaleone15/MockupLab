// scripts/check-social-preview.mjs — “Voir sur…”: the mock-up inside a generic post, story, TikTok or YouTube
// interface, exportable with it; the carousel and the safe-zone guides are gone.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const state = () => page.evaluate(() => window.__mockuplab.project.getState());

// 1. no carousel any more: an old carousel project opens as an Insta post
const migrated = await page.evaluate(() => {
  const api = window.__mockuplab;
  const p = api.persistence.migrateProject({ ...api.persistence.snapshot(), export: { ...api.project.getState().export, ratio: 'c3-4x5' } });
  return p.export.ratio;
});
check(migrated === 'ig-post', `an old carousel project becomes an Insta post (${migrated})`);
await page.getByTestId('floating-bar').getByRole('button', { name: /Réseaux|Voir sur/ }).click();
await page.waitForTimeout(200);
check((await page.getByRole('menuitemradio', { name: /Carrousel/ }).count()) === 0, 'no carousel in the menu');
await page.keyboard.press('Escape');
check((await page.locator('[data-testid="safe-zones"]').count()) === 0 && (await page.getByRole('button', { name: /Zones de sécurité|Zones sûres/ }).count()) === 0, 'no safe-zone guides');

await done(browser, errors);
