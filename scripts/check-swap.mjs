// Regression check: swapping images must show the new one immediately.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.addInitScript(() => { if (!sessionStorage.getItem('mockuplab:keep')) indexedDB.deleteDatabase('mockuplab'); });
await p.goto('http://localhost:5173/');
await p.waitForFunction(() => window.__mockuplab);
await p.waitForTimeout(1500);
// Solid-colour test images, then sample each time from the screen centre.
const colours = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff'];
for (const c of colours) {
  await p.evaluate(async (c) => {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 650;
    const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 300, 650);
    const blob = await new Promise((r) => cv.toBlob(r));
    const { importImages } = await import('/src/lib/importImage.ts');
    await importImages([new File([blob], c + '.png', { type: 'image/png' })]);
  }, c);
  await p.waitForTimeout(500);
  const px = await p.evaluate(async () => {
    const r = await window.__mockuplab.renderImage();
    const bmp = await createImageBitmap(r.blob);
    const cv = new OffscreenCanvas(bmp.width, bmp.height); const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0);
    return [...g.getImageData(bmp.width / 2, bmp.height / 2, 1, 1).data.slice(0, 3)];
  });
  console.log(c, '→ centre pixel', px);
}
await b.close();
