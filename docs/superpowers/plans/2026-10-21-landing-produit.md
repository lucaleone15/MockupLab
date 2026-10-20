# Landing produit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A product-page home: a live 3D hero with MockupLab's real devices turning, an eight-section story, new showcase renders on classy backgrounds, and Archivo Expanded titles across the app.

**Architecture:** A self-contained R3F scene `src/home/HeroStage.tsx` (lazy-loaded) renders real model components with sample designs under the procedural studio environment, independent of the user's project store; `src/home/Home.tsx` becomes the eight sections; `scripts/make-showcase.mjs` renders every visual of the page (images and one looping video) with MockupLab itself.

**Tech Stack:** React 19, R3F + drei, three, Tailwind 4, @fontsource-variable (Archivo, Geist), Playwright check scripts.

**Spec:** `docs/superpowers/specs/2026-10-21-landing-produit-design.md`

## Global Constraints

- Branch `simplify-feedback`; commits without any Claude co-author line; no push.
- Titles: Archivo at `font-stretch: 125%`, weight 700–800, via `@fontsource-variable/archivo` (width axis) — in the whole app, replacing Syne (remove `@fontsource-variable/syne`). Texts: Geist, unchanged.
- No Google Fonts or remote assets at runtime (offline PWA and desktop app).
- `prefers-reduced-motion`: the hero does not turn by itself, no scroll-driven motion, the video section shows a still.
- No WebGL 2: the hero shows a still image (`public/showcase/hero-still.webp`).
- FR and EN for every text; tutoiement in FR.
- `npm run build` and every `scripts/check-*.mjs` pass at the end.

## Review Focus

- The hero keeps drawing while scrolled out of view → it must stop rendering (frameloop `never`) when not intersecting (Task 2 test: no frame change while scrolled away).
- The hero must not touch the user's project (no `useProject` writes, no item added) (Task 2 test: project items unchanged after the home page loads).
- Title visible before the 3D loads (lazy chunk) (Task 4 test: `h1` visible while the canvas is still absent, by blocking the r3f chunk).
- 1280 × 720: the hero title and “Ouvrir le Studio” fit in the first screen (Task 4 test).
- Light system theme: the home page stays dark and readable (Task 4 test with `colorScheme: 'light'`).

---

### Task 1: Archivo Expanded titles everywhere

**Files:** Modify `package.json` (+`@fontsource-variable/archivo`, −`@fontsource-variable/syne`), `src/index.css` (`@import '@fontsource-variable/archivo/wdth.css'` or the package's width-axis entry; `--font-display: 'Archivo Variable', …`; `.font-display { font-stretch: 125%; letter-spacing: -0.02em; }`), `scripts/check-home.mjs`.

- [ ] **Step 1:** In `check-home.mjs` assert `getComputedStyle(h1).fontFamily` starts with `"Archivo` and `fontStretch === '125%'` on the home page, and the Studio rail page title (`[data-testid=rail-page] h2`) uses Archivo too; body text (`[data-testid=home] p`) uses Geist.
- [ ] **Step 2:** Run → FAIL (Syne).
- [ ] **Step 3:** `npm install @fontsource-variable/archivo && npm uninstall @fontsource-variable/syne`; switch the CSS. Check the installed package exposes the `wdth` axis (`node_modules/@fontsource-variable/archivo/*.css`); if not, use `@fontsource/archivo` static faces at stretch 125 if published, else ruling.
- [ ] **Step 4:** Run `check-home`, `check-polish` (it checks no monospace text) → PASS; screenshot the Studio and the home page and read them (titles must not overflow their panels: rail page titles, sheet titles).
- [ ] **Step 5:** Commit `"Titles in Archivo Expanded across the app (Syne removed)"`.

### Task 2: Live 3D hero

**Files:** Create `src/home/HeroStage.tsx`; Test `scripts/check-home.mjs`.

**Interfaces:**
- Produces: `export default function HeroStage({ className }: { className?: string })` (default export for `React.lazy`). Renders a `<Canvas data-testid="hero-3d">` with: `StudioEnvironment`, a soft key `directionalLight` with shadow, drei `ContactShadows` under the devices, a dark radial backdrop matching the page (`#0e0f13` → `#1b2140`), and two real devices built from `getModel('laptop-14')` and `getModel('phone-pro')` `Component`s, their screens bound to `sampleAsset('sample-web.png')` / `sampleAsset('sample-app.png')` (`src/lib/samples.ts`); a group turning `0.18 rad/s`, plus `scrollY / innerHeight * 0.9 rad`, tilted by the pointer up to `±0.12 rad`. `frameloop` is `'never'` while the canvas is not intersecting the viewport (IntersectionObserver) or under reduced motion (one frame drawn).
- [ ] **Step 1:** Tests in `check-home.mjs`: (a) `hero-3d` canvas exists; two screenshots of it 800 ms apart differ; (b) with `page.emulateMedia({ reducedMotion: 'reduce' })` and a reload, two screenshots 800 ms apart are identical; (c) after scrolling the home 2000 px, `window.__heroFrames` (a counter the component increments in `useFrame`, exposed only on `window` for checks) stops increasing; (d) `window.__mockuplab.project.getState().items` is unchanged by visiting the home page.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; WebGL 2 missing → render `<img src=".../hero-still.webp">` instead (the still is produced in Task 3; until then a fallback to the existing studio-ui image).
- [ ] **Step 4:** Run → PASS; read screenshots (`out/home3/hero.png`): devices lit like a product photo, no clipping.
- [ ] **Step 5:** Commit `"Home: live 3D hero with the real laptop and phone turning in a studio"`.

### Task 3: Showcase renders on classy backgrounds

**Files:** Modify `scripts/make-showcase.mjs`; outputs in `public/showcase/` (`hero-still.webp`, `devices-*.webp` ×3, `studio-*.webp` ×3, `motion.mp4` + `motion.webm` + `motion-still.webp`, `social-story.webp`, `clients-pack.webp`, `studio-ui.jpg` kept); remove showcase files no longer used.
- [ ] **Step 1:** In `check-home.mjs` assert every image/video the home references loads (`naturalWidth > 0`, video `readyState >= 2`), and each image is at least 1600 px wide.
- [ ] **Step 2:** Run → FAIL (files missing).
- [ ] **Step 3:** Rewrite the script: scenes set through the store (`setComposition`, `loadSamples`, `setBackground`, `setDecor`, `applyLightPreset`, `setCamera`), exported with `renderImage()` at 2K WebP: deep dark gradient studio + soft key; warm marble table; terrazzo podium on a pastel; a print set on paper colour; a multi-device desk. `motion`: `renderVideo()` with `turntable`, 4 s, 720p, cinema, MP4 and WebM. `social-story`: story network with interface. `clients-pack`: Project hero.
- [ ] **Step 4:** Run the script (dev server on :5173), look at every output, redo any flat/dull one; run the test → PASS once Task 4 references them.
- [ ] **Step 5:** Commit `"Showcase: new renders on classy backgrounds with studio light, a looping turntable video"`.

### Task 4: The eight-section story

**Files:** Modify `src/home/Home.tsx` (split sections into `src/home/sections.tsx` if over ~300 lines), `src/i18n/fr.ts`, `src/i18n/en.ts`, `scripts/check-home.mjs`, `scripts/check-a11y.mjs` (if section names change).

**Interfaces:**
- Consumes: `HeroStage` (Task 2, via `React.lazy`), showcase files (Task 3).
- Produces: sections with `data-testid` `home-hero`, `home-why`, `home-devices`, `home-studio`, `home-motion`, `home-social`, `home-clients`, `home-end`, in this order; existing `mode-card-*`, `mode-row`, `recents`, `showcase-strip` kept (modes row lives in `home-clients`).
- [ ] **Step 1:** Tests: the 8 test ids exist in this order (compare `y`); each section has an `h2` (hero `h1`) in Archivo and a `p`; at 1280 × 720 the `h1` and “Ouvrir le Studio” are inside the first screen; with the r3f chunk blocked (`page.route('**/r3f-*.js', r => r.abort())` on the preview build, or delaying it on dev) the `h1` is visible; with `colorScheme: 'light'` the hero background is dark (`rgb` luminance < 40); the end section has “Ouvrir le Studio”; texts mention free, offline/private, 4K, video, social, clients (FR keys). Keep the existing home assertions (no drop zone, paste asks for a mode, recents, modes row).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: each section = big Archivo title + one Geist sentence + a large visual (rounded, soft shadow), fading in once on scroll (`IntersectionObserver`, no motion under reduced motion). Copy (FR, tutoiement), approved direction: Why — « Un mock-up, ça prend des heures dans Photoshop, et les bons modèles sont payants. Ici, 30 secondes, gratuit, et rien ne quitte ton ordinateur. »; others short and factual (no promise the app does not keep).
- [ ] **Step 4:** Run `check-home`, `check-a11y`, `check-theme`, `check-polish` → PASS; full-page screenshots (scroll the `home` container in steps) dark and light system theme, read them.
- [ ] **Step 5:** Commit `"Home: an eight-section product story — why, devices, studio, motion, social, clients, the end"`.
- [ ] **Step 6:** Final: every `check-*.mjs`, `scripts/usage/run-all.mjs`, `npm run build` → pass.
