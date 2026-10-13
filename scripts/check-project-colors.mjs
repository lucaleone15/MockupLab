// scripts/check-project-colors.mjs — Project mode colours: palettes from the images, brand palette, picker,
// one colour for the whole pack or varied per scene, and a colour of its own for one scene.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/projet' });
await page.waitForSelector('[data-testid=project-screen]');

// two plain images: a red one and a blue one
await page.evaluate(async () => {
  const make = async (color, name) => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 1200;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 600, 1200);
    g.fillStyle = '#ffffff';
    g.fillRect(50, 50, 500, 200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new File([blob], name, { type: 'image/png' });
  };
  await window.__mockuplab.pack.add([await make('#d02020', 'red-app.png'), await make('#2050d0', 'blue-app.png')]);
});
await page.waitForTimeout(1500);

check(await page.getByRole('heading', { name: 'Couleurs du pack' }).isVisible().catch(() => false), 'a “Pack colours” block is shown');
const sugg = await page.evaluate(() => window.__mockuplab.pack.state().colors.suggestions);
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return null;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hues = sugg.flat().map(hue).filter((h) => h !== null);
check(sugg.length >= 4 && sugg.every((p) => p.length >= 2), `palettes drawn from the images (${sugg.length})`);
check(hues.some((h) => h < 20 || h > 340) && hues.some((h) => h > 200 && h < 250), `they carry the images' red and blue (${hues.map(Math.round).join(' ')})`);

// one palette for the whole pack: every scene gets its first colour
const bgOf = (target) =>
  page.evaluate(async (target) => {
    await window.__mockuplab.pack.openInStudio(target, () => {});
    const b = window.__mockuplab.project.getState().background;
    return b.kind === 'solid' ? b.color : b.kind === 'gradient' ? b.stops.map((s) => s.color).join('/') : b.kind;
  }, target);
const ids = await page.evaluate(() => window.__mockuplab.pack.state().files.map((f) => f.id));
await page.getByRole('radio', { name: /Tirée de tes images 1/ }).click();
await page.waitForTimeout(300);
const pal = await page.evaluate(() => window.__mockuplab.pack.state().colors.palette);
const all = [await bgOf('hero'), await bgOf(ids[0]), await bgOf(ids[1])];
check(all.every((c) => c.toLowerCase() === pal[0].toLowerCase()), `one colour for the whole pack (${all.join(', ')} = ${pal[0]})`);

// varied: scenes take the palette's colours in turn
await page.getByRole('switch', { name: 'Varier d’une scène à l’autre' }).click();
await page.waitForTimeout(300);
const varied = [await bgOf('hero'), await bgOf(ids[0]), await bgOf(ids[1])].map((c) => c.toLowerCase());
check(new Set(varied).size >= 2 && varied.every((c) => pal.map((x) => x.toLowerCase()).includes(c)), `varied colours from the palette (${varied.join(', ')})`);

// one scene with a colour of its own
await page.evaluate((id) => window.__mockuplab.pack.setSceneColor(id, '#123456'), ids[1]);
check((await bgOf(ids[1])).toLowerCase() === '#123456', 'one scene can have its own colour');

// back to the style's colours: no scene keeps a colour of its own
await page.getByRole('radio', { name: 'Couleurs du style' }).click();
await page.waitForTimeout(200);
check((await bgOf(ids[1])).toLowerCase() !== '#123456', 'back to the style colours, no scene keeps its own colour');

// the sample brand is not offered as "my brand"; a filled-in brand is
check((await page.getByRole('radio', { name: 'Ma marque' }).count()) === 0, '“My brand” is not offered with the sample brand');
await page.evaluate(() => window.__mockuplab.project.getState().setBrand({ colors: [{ hex: '#0A7E8C', name: 'Lagon' }, { hex: '#F2C14E', name: 'Sable' }] }));
await page.waitForTimeout(200);
// brand palette and free picker
await page.getByRole('radio', { name: 'Ma marque' }).click();
await page.waitForTimeout(200);
const brand = await page.evaluate(() => [window.__mockuplab.pack.state().colors.palette, window.__mockuplab.project.getState().brand.colors.map((c) => c.hex)]);
check(brand[0][0].toLowerCase() === brand[1][0].toLowerCase(), `brand palette uses the brand colours (${brand[0].join(' ')})`);
check(await page.getByLabel('Choisir une couleur').isVisible().catch(() => false), 'a free colour picker is offered');

// background presets have names
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Décor', exact: true }).click();
check((await page.getByRole('button', { name: /^Ambiances \d+$/ }).count()) === 0, 'background presets have real names (not “Ambiances 1, 2…”)');

await done(browser, errors);
