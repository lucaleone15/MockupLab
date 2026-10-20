// scripts/check-studio-2.mjs — feedback round 2, Studio: no Ambiance page (a scene starts as « Studio sombre »),
// Devices page with a catalogue window, Décor starting with the background colour, Brand basics first.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const shot = (name) => page.screenshot({ path: `out/studio2/${name}.png` });
const rail = page.getByTestId('studio-rail');
const state = () => page.evaluate(() => window.__mockuplab.project.getState());

// 1. no Ambiance page; a fresh scene is the « Studio sombre »
check((await rail.getByRole('tab', { name: 'Ambiance', exact: true }).count()) === 0, 'no Ambiance page in the rail');
const s0 = await state();
check(s0.background.kind === 'gradient' && s0.background.stops[0].color === '#2a2a31' && s0.decor.kind === 'none' && s0.lighting.preset === 'studio', 'a fresh scene starts as the dark studio');

await done(browser, errors);
