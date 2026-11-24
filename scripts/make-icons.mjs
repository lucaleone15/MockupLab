// scripts/make-icons.mjs — the app icon (macOS, Windows, PWA, Apple touch): the mark (a blue phone with a lighter
// copy behind for depth) on a graphite tile.
// macOS style: a rounded square of 824 px on a 1024 px canvas with room for the shadow.
import { chromium } from 'playwright';

const tile = (size, { margin, radius, shadow }) => `
<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent">
  <div style="position:relative;width:${size - 2 * margin}px;height:${size - 2 * margin}px;border-radius:${radius}px;
    background:radial-gradient(120% 90% at 30% 15%,#3a3b42 0%,#1d1d1f 55%,#111113 100%);
    box-shadow:${shadow ? `0 ${size * 0.012}px ${size * 0.03}px rgba(0,0,0,.35), inset 0 ${size * 0.002}px 0 rgba(255,255,255,.14)` : 'none'};
    overflow:hidden">
    <!-- soft studio light from the top left -->
    <div style="position:absolute;inset:0;background:radial-gradient(70% 55% at 25% 10%,rgba(255,255,255,.14),transparent 70%)"></div>
    <!-- the mark: an upright blue phone, a lighter copy behind it for depth, its island in white -->
    <svg viewBox="0 0 40 40" style="position:absolute;left:12%;top:12%;width:76%;height:76%">
      <rect x="14" y="4" width="17" height="32" rx="5.2" fill="#2f6bff" opacity=".42"/>
      <rect x="10" y="4" width="17" height="32" rx="5.2" fill="#2f6bff"/>
      <rect x="15.3" y="7.4" width="6.4" height="2" rx="1" fill="#fff"/>
    </svg>
  </div>
</body>`;

const b = await chromium.launch();
const p = await b.newPage();
async function shot(size, path, opts) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(tile(size, opts));
  await p.screenshot({ path, omitBackground: true });
}
// macOS: 824/1024 body, 185 px radius (Apple's grid)
await shot(1024, 'public/app-icons/icon-1024.png', { margin: 100, radius: 185, shadow: true });
// Windows / PWA: nearly full bleed
await shot(512, 'public/app-icons/icon-512.png', { margin: 16, radius: 112, shadow: false });
await shot(192, 'public/app-icons/icon-192.png', { margin: 6, radius: 42, shadow: false });
// maskable (Android/PWA): the system crops it, so no margin and no rounding
await shot(512, 'public/app-icons/icon-maskable-512.png', { margin: 0, radius: 0, shadow: false });
await shot(180, 'public/app-icons/apple-touch-icon.png', { margin: 0, radius: 0, shadow: false });
// browser tab: the rounded icon, nearly full bleed
await shot(48, 'public/app-icons/favicon-48.png', { margin: 1, radius: 11, shadow: false });
await shot(32, 'public/app-icons/favicon-32.png', { margin: 1, radius: 7, shadow: false });
await b.close();
console.log('icons written');
