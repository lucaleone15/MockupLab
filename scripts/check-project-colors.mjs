// scripts/check-project-colors.mjs — Project mode colours: a harmonious palette detected from the images, then
// edited by hand (hex, add, remove), « une couleur pour tout / une par visuel », a colour of its own for one scene,
// the brand's colours, and the brand kit folded away.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/projet' });
await page.waitForSelector('[data-testid=project-screen]');

const add = (images) =>
  page.evaluate(async (images) => {
    const make = async ([color, name]) => {
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
    await window.__mockuplab.pack.add(await Promise.all(images.map(make)));
  }, images);
const colors = () => page.evaluate(() => window.__mockuplab.pack.state().colors);
const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
};
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const harmonious = (pal) => {
  const hues = pal.map(hsl).filter((c) => c.s > 0.06).map((c) => c.h);
  return hues.every((a) => hues.every((b) => gap(a, b) <= 50));
};

await add([['#d02020', 'red-app.png'], ['#2050d0', 'blue-app.png']]);
await page.waitForTimeout(1500);

check(await page.getByRole('heading', { name: 'Couleurs du pack' }).isVisible().catch(() => false), 'a “Pack colours” block is shown');
let c = await colors();
const imageHues = c.imageColors.map((x) => hsl(x).h);
check(imageHues.some((h) => h < 20 || h > 340) && imageHues.some((h) => h > 200 && h < 250), `the images' red and blue are offered (${c.imageColors.join(' ')})`);
check(c.palette.length === 3 && harmonious(c.palette), `a palette of three colours in harmony (${c.palette.join(' ')})`);
const detected = c.palette;

// edit a colour by its hex code
const swatches = page.getByTestId('pack-palette').getByRole('button', { name: /^Couleur \d/ });
check((await swatches.count()) === 3, `the palette shows its colours (${await swatches.count()})`);
check(/#[0-9A-F]{6}/i.test(await page.getByTestId('pack-palette').textContent()), 'each colour shows its hex code');
await swatches.nth(1).click();
await page.getByLabel('Code hex').fill('#123456');
await page.getByLabel('Code hex').press('Enter');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
c = await colors();
check(c.palette[1] === '#123456' && c.edited, `colour 2 is changed by hand (${c.palette.join(' ')})`);
await add([['#20a040', 'green-app.png']]);
await page.waitForTimeout(800);
check((await colors()).palette[1] === '#123456', 'a palette edited by hand stays when images are added');

// add and remove
await page.getByRole('button', { name: 'Ajouter une couleur au pack' }).click();
check((await colors()).palette.length === 4, 'a colour is added');
await swatches.nth(3).click();
await page.getByRole('button', { name: 'Retirer cette couleur' }).click();
await page.waitForTimeout(150);
check((await colors()).palette.length === 3, 'a colour is removed');

// one colour for everything, or one per visual
const bgOf = (target) =>
  page.evaluate(async (target) => {
    await window.__mockuplab.pack.openInStudio(target, () => {});
    const b = window.__mockuplab.project.getState().background;
    return (b.kind === 'gradient' ? b.stops.at(-1).color : b.color).toLowerCase();
  }, target);
const ids = await page.evaluate(() => window.__mockuplab.pack.state().files.map((f) => f.id));
check((await page.getByRole('radio', { name: 'Une couleur pour tout' }).getAttribute('aria-checked')) === 'true', '« Une couleur pour tout » by default');
const pal = (await colors()).palette;
const all = [await bgOf('hero'), await bgOf(ids[0]), await bgOf(ids[1])];
check(all.every((x) => x === pal[0]), `one colour for the whole pack (${all.join(', ')} = ${pal[0]})`);
await page.getByRole('radio', { name: 'Une par visuel' }).click();
await page.waitForTimeout(200);
const varied = [await bgOf('hero'), await bgOf(ids[0]), await bgOf(ids[1])];
check(new Set(varied).size >= 2 && varied.every((x) => pal.includes(x)), `one colour per visual, from the palette (${varied.join(', ')})`);
await page.evaluate((id) => window.__mockuplab.pack.setSceneColor(id, '#654321'), ids[1]);
check((await bgOf(ids[1])) === '#654321', 'one scene can have its own colour');

// detect again
await page.getByRole('button', { name: 'Re-détecter' }).click();
await page.waitForTimeout(300);
c = await colors();
check(!c.edited && !c.palette.includes('#123456') && harmonious(c.palette), `« Re-détecter » gives a harmonious palette again (${c.palette.join(' ')})`);
check(detected.length === 3, 'detection is stable');

// the last colour cannot be removed
await page.evaluate(() => {
  window.__mockuplab.pack.removeColor(0);
  window.__mockuplab.pack.removeColor(0);
});
await page.waitForTimeout(150);
await swatches.first().click();
check(await page.getByRole('button', { name: 'Retirer cette couleur' }).isDisabled(), 'the last colour cannot be removed');
await page.keyboard.press('Escape');

// the brand's colours, only with a real brand
check((await page.getByRole('button', { name: 'Prendre ma marque' }).count()) === 0, '“My brand” is not offered with the sample brand');
await page.evaluate(() => window.__mockuplab.project.getState().setBrand({ colors: [{ hex: '#0A7E8C', name: 'Lagon' }, { hex: '#F2C14E', name: 'Sable' }] }));
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Prendre ma marque' }).click();
await page.waitForTimeout(150);
c = await colors();
check(c.palette[0] === '#0a7e8c' && c.palette[1] === '#f2c14e', `the brand's colours make the palette (${c.palette.join(' ')})`);

// the brand kit is folded away
const fold = page.getByRole('button', { name: /Kit de marque/ });
check((await fold.getAttribute('aria-expanded')) === 'false', 'the brand kit is folded by default');
await fold.click();
await page.waitForTimeout(400);
check((await fold.getAttribute('aria-expanded')) === 'true' && (await page.getByText('Typo de titre').first().isVisible().catch(() => false)), 'it opens on click');

// greyscale images: a neutral palette
await page.evaluate(() => {
  const api = window.__mockuplab.pack;
  for (const f of api.state().files) api.remove(f.id);
});
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Re-détecter' }).click().catch(() => {});
await add([['#808080', 'grey.png']]);
await page.evaluate(() => window.__mockuplab.pack.redetect());
await page.waitForTimeout(800);
c = await colors();
check(JSON.stringify(c.palette) === JSON.stringify(['#f4f2ee', '#e3e0da', '#2b2b2e']), `no colour in the images: a neutral palette (${c.palette.join(' ')})`);

// background presets have names
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);
await page.getByTestId('studio-rail').getByRole('tab', { name: 'Décor', exact: true }).click();
check((await page.getByRole('button', { name: /^Ambiances \d+$/ }).count()) === 0, 'background presets have real names (not “Ambiances 1, 2…”)');

await done(browser, errors);
