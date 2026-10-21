// scripts/make-icons.mjs — the app icon (macOS, Windows, PWA, Apple touch): a tilted phone with its screen lit, on a graphite tile.
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
    <!-- the mark: a phone, tilted, its screen lit in the brand blue -->
    <svg viewBox="0 0 40 40" style="position:absolute;left:12%;top:12%;width:76%;height:76%">
      <defs><linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b7bff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs>
      <g transform="rotate(-8 20 20)">
        <rect x="12" y="5" width="16" height="30" rx="4.5" fill="none" stroke="#f5f5f7" stroke-width="2.2"/>
        <rect x="14.4" y="7.4" width="11.2" height="25.2" rx="2.6" fill="url(#screen)"/>
        <rect x="17.5" y="8.7" width="5" height="1.6" rx=".8" fill="#111113"/>
      </g>
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
await shot(1024, 'public/icons/icon-1024.png', { margin: 100, radius: 185, shadow: true });
// Windows / PWA: nearly full bleed
await shot(512, 'public/icons/icon-512.png', { margin: 16, radius: 112, shadow: false });
await shot(192, 'public/icons/icon-192.png', { margin: 6, radius: 42, shadow: false });
// maskable (Android/PWA): the system crops it, so no margin and no rounding
await shot(512, 'public/icons/icon-maskable-512.png', { margin: 0, radius: 0, shadow: false });
await shot(180, 'public/icons/apple-touch-icon.png', { margin: 0, radius: 0, shadow: false });
// browser tab: the rounded icon, nearly full bleed
await shot(48, 'public/icons/favicon-48.png', { margin: 1, radius: 11, shadow: false });
await shot(32, 'public/icons/favicon-32.png', { margin: 1, radius: 7, shadow: false });
await b.close();
console.log('icons written');
