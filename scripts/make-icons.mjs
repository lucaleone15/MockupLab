// scripts/make-icons.mjs — app icons (PWA + desktop) rasterised from public/favicon.svg.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const svg = readFileSync('public/favicon.svg', 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
const shot = async (size, path, { maskable = false } = {}) => {
  await p.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.72) : size;
  await p.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? '#111113' : 'transparent'}"><div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await p.screenshot({ path, omitBackground: !maskable });
};
await shot(192, 'public/icons/icon-192.png');
await shot(512, 'public/icons/icon-512.png');
await shot(1024, 'public/icons/icon-1024.png');
await shot(512, 'public/icons/icon-maskable-512.png', { maskable: true });
await shot(180, 'public/icons/apple-touch-icon.png', { maskable: true });
await b.close();
console.log('icons written');
