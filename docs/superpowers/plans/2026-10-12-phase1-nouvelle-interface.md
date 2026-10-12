# Phase 1 — Nouvelle interface : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'éditeur à trois colonnes et onglets par une interface à écrans (Accueil, Studio, Photo ; Rapide et Projet annoncés « Bientôt »), avec rail de pages plates, fenêtre Exporter, nouveau design system clair « Apple » / sombre vitré et titres en Syne — sans ajouter ni retirer de fonctionnalité.

**Architecture:** Un état `screen` dans le store `ui`, synchronisé avec le hash de l'URL, choisit l'écran. Le canvas 3D (`Viewport`) reste monté pour les écrans 3D ; les panneaux existants sont **réutilisés et découpés** en pages de rail (on exporte les sections existantes au lieu de les réécrire). Le design system passe par les variables CSS de `src/index.css` et les primitives de `src/ui/primitives.tsx`, ce qui restyle d'un coup tous les panneaux.

**Tech Stack:** Vite 7 + React 19 + TypeScript, Tailwind 4 (variables CSS `@theme inline`), zustand (+ zundo), radix-ui, lucide-react, React Three Fiber. Tests : scripts Playwright (`node scripts/check-*.mjs`) contre le serveur de dev `npx vite --port 5173`.

**Spec:** `docs/superpowers/specs/2026-10-12-ui-redesign-design.md` (§ 3, 4, 7, 8, 9, 11, 12, 13-phase 1, 14).

## Global Constraints

- Aucune fonctionnalité ajoutée ni retirée ; chaque ligne de la table § 11 de la spec doit rester atteignable (Rapide/Projet : cartes et onglets « Bientôt » non cliquables).
- Modèle de données du projet inchangé (`mode: 'scene' | 'photo'`) ; les projets autosauvés et les `.json` existants s'ouvrent sans migration.
- Écran `studio` ⇔ `mode = 'scene'` ; écran `photo` ⇔ `mode = 'photo'`.
- Hash : `#/` (accueil), `#/studio`, `#/photo` ; `#/rapide` et `#/projet` redirigent vers `#/` en phase 1.
- Couleurs clair : `--bg #f5f5f7`, panneaux `#ffffff`, texte `#1d1d1f` / `#6e6e73` / `#aeaeb2`, accent `#0071e3`.
- Couleurs sombre vitré : fond dégradé `#14151a → #0b0b0e`, panneaux `rgb(40 40 46 / .55)` + `backdrop-filter: blur(20px) saturate(1.4)` + liseré `inset 0 0 0 1px rgb(255 255 255 / .07)`, texte `#f5f5f7` / `#98989d` / `#636366`, accent `#f5f5f7` sur texte `#1d1d1f`.
- `--brand: #ff5c35` réservé au logo.
- Titres en **Syne** (`@fontsource-variable/syne`), interface en Geist 13 px, petits libellés 12 px, plus aucun micro-titre en majuscules.
- Rayons : 10 px contrôles, 14 px cartes/panneaux, 18 px fenêtres.
- Thème par défaut **Auto** (suit le système) ; choix Clair / Sombre persistant (`localStorage['mockuplab:theme']` = `auto|light|dark`).
- Aucune section repliable (`aria-expanded`) dans les pages de rail.
- Tous les textes visibles passent par l'i18n (FR et EN).
- Le canvas 3D monté en permanence sur tous les écrans (spec § 3.3) sert aux vignettes de Rapide/Projet : il est traité en phase 3 ; en phase 1 il vit dans l'écran Studio.
- Commits sans ligne `Co-Authored-By`. Aucun `git push` sans accord.
- Skills à charger pendant l'exécution : `apple-design` et `frontend-design` (tâches 2, 3, 6), `emil-design-eng` (tâche 3), `impeccable` + `web-design-guidelines` + `design:accessibility-review` (tâche 11).

## Review Focus

1. **Projet autosauvé en mode photo** : rouvrir l'app sur `#/` puis cliquer « Reprendre » doit ouvrir l'écran **Photo** (pas Studio) avec la photo et ses zones — testé en tâche 5.
2. **Raccourcis clavier sur l'accueil** : ⌘Z, Suppr, R, F, flèches ne doivent rien modifier quand l'accueil est affiché (le projet est invisible) — testé en tâche 4.
3. **Glisser-déposer ou coller une image sur l'accueil** : l'image doit arriver sur l'écran de l'appareil du Studio, et l'app passer sur `#/studio` — testé en tâche 5.
4. **Changement de thème système pendant l'utilisation en mode Auto** : l'app suit sans recharger ; en mode Clair/Sombre forcé, elle ne suit pas — testé en tâche 1.
5. **Exporter avec la page Vidéo ouverte puis fermée** : le bouton Exporter de la barre doit exporter une **image** (pas une vidéo) dès qu'on a quitté la page Vidéo — testé en tâche 9.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/index.css` | Tokens clair/sombre, polices, classes `.glass`, `.stage-bg`, `.font-display` |
| `index.html` | Résolution du thème Auto avant le premier rendu, couleurs de splash |
| `src/store/ui.ts` | `themePref`, `theme` résolu, `screen`, `studioPage`, `photoPage`, `exportOpen` |
| `src/ui/primitives.tsx` | Primitives restylées ; `Section` non repliable ; `Advanced` toujours ouvert ; nouveaux `Chip`, `Sheet` |
| `src/shell/route.ts` | Type `Screen`, `navigate()`, `useRouteSync()` (hash ⇄ store, mode du projet) |
| `src/shell/Logo.tsx` | Logo Syne |
| `src/shell/TopBar.tsx` | Barre du haut (logo, projet, modes, annuler/rétablir, `···`, Exporter) |
| `src/shell/ProjectMenu.tsx` | Nom du projet + menu (nouveau, ouvrir, enregistrer) + « enregistré » |
| `src/shell/ModeSwitch.tsx` | Rapide · Projet · Studio · Photo |
| `src/shell/MoreMenu.tsx` | Langue, thème, raccourcis, recommencer |
| `src/shell/Rail.tsx` | `Rail` (colonne d'icônes) + `RailPage` (titre + contenu défilant) |
| `src/shell/FloatingBar.tsx` | Format, recentrer, aperçu plein écran, ✦ Idées |
| `src/shell/ExportSheet.tsx` | Fenêtre Exporter (image) |
| `src/home/Home.tsx` | Accueil |
| `src/studio/StudioScreen.tsx` | Rail Studio + page + Viewport + barre flottante |
| `src/studio/DevicesPage.tsx` | Bibliothèque en onglets + « Dans la scène » + import .glb |
| `src/studio/SettingsPage.tsx` | Réglages de l'appareil sélectionné |
| `src/photo/PhotoScreen.tsx` | Rail Photo + page + PhotoView |
| `src/app/App.tsx` | Aiguillage par écran |
| `src/app/Viewport.tsx` | Fond `.stage-bg`, plus de bouton/légende internes (déplacés dans la barre flottante) |
| `src/app/PropertiesPanel.tsx` | Ne garde que `DeviceSection`, `ImageSection`, `ExportForm` exportés (plus d'onglets) |
| `src/app/LibraryPanel.tsx` | Ne garde que `ModelCard`, `Silhouette`, `UserModels`, `CATEGORY_KEYS`, `MODEL_DRAG_TYPE` (clic = ajouter) |
| `src/app/panels/ScenePanel.tsx` | Exporte `Looks`, `DecorSection`, `BackgroundSection`, `LightSection`, `CameraSection`, `GroundSection` |
| `src/app/panels/TextPanel.tsx` | `TextPage` et `BrandPage` au lieu de `TextPanel` |
| `src/app/panels/CompositionSection.tsx` | `SceneItems` (liste + ajouter + disposer) et `Placement` (rotation, avancer/reculer, centrer) |
| `src/photo/PhotoPanel.tsx` | Exporte `ZonesSection`, `DesignSection`, `BlendSection`, `GeometrySection`, `PhotoSection` |
| `src/photo/PhotoLibrary.tsx` | `PhotoLibraryPage` (contenu sans `<aside>`) |
| `src/scene/interaction.tsx` | Clic sur un appareil → page Réglages |
| `src/app/shortcuts.ts` | Raccourcis inactifs sur l'accueil ; dépose/collage sur l'accueil → Studio |
| `src/main.tsx` | Mémorise si un projet autosauvé existait (`ui.hasSavedProject`) |
| `src/i18n/fr.ts`, `src/i18n/en.ts` | Nouvelles clés |
| `scripts/lib/app.mjs` | Aide commune aux nouveaux scripts de test |
| `scripts/check-theme.mjs`, `check-nav.mjs`, `check-home.mjs`, `check-studio.mjs`, `check-export.mjs`, `check-photo-rail.mjs` | Nouveaux tests |
| Supprimés : `src/app/TopBar.tsx` | (remplacé par `src/shell/`) |

**Prérequis pour tous les tests :** serveur de dev lancé dans un terminal à part : `npx vite --port 5173` (base `/`). Les scripts sortent avec le code 1 si une vérification échoue.

---

### Task 0: Aide de test commune

**Files:**
- Create: `scripts/lib/app.mjs`

**Interfaces:**
- Produces: `openApp(opts) → Promise<{ browser, context, page, errors }>` ; `check(cond, label)` ; `done(browser, errors)`.

- [ ] **Step 1: Écrire l'aide**

```js
// scripts/lib/app.mjs — shared helpers for the check-* scripts (dev server on :5173).
import { chromium } from 'playwright';

/** Opens the app on a fresh profile. `hash` like '#/studio'. */
export async function openApp({ hash = '', lang = 'fr', colorScheme = 'dark', fresh = true, viewport = { width: 1440, height: 900 }, init } = {}) {
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
  const context = await browser.newContext({ viewport, colorScheme, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(
    ({ fresh, lang }) => {
      if (fresh && !sessionStorage.getItem('fresh')) {
        indexedDB.deleteDatabase('mockuplab');
        localStorage.clear();
        sessionStorage.setItem('fresh', '1');
      }
      localStorage.setItem('mockuplab:lang', lang);
    },
    { fresh, lang },
  );
  if (init) await page.addInitScript(init);
  await page.goto(`http://localhost:5173/${hash}`);
  await page.waitForFunction(() => window.__mockuplab);
  await page.waitForTimeout(600);
  return { browser, context, page, errors };
}

export function check(cond, label) {
  if (cond) console.log('✓', label);
  else {
    console.error('✗', label);
    process.exitCode = 1;
  }
}

export async function done(browser, errors) {
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}
```

- [ ] **Step 2: Vérifier que le module se charge**

Run: `node -e "import('./scripts/lib/app.mjs').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'check', 'done', 'openApp' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/app.mjs
git commit -m "Test helper for the new UI checks"
```

---

### Task 1: Tokens, polices et thème Auto

**Files:**
- Modify: `package.json` (dépendance `@fontsource-variable/syne`)
- Modify: `src/index.css` (tokens, polices, classes utilitaires)
- Modify: `index.html` (script de thème, couleurs du splash)
- Modify: `src/store/ui.ts` (thème)
- Test: `scripts/check-theme.mjs`

**Interfaces:**
- Produces: `type ThemePref = 'auto' | 'light' | 'dark'` ; `useUi` : `themePref: ThemePref`, `theme: 'light' | 'dark'` (résolu), `setThemePref(p: ThemePref)`. `setTheme` est **supprimé** (seul appelant : l'ancien `TopBar`, supprimé en tâche 4). Classes CSS : `.glass`, `.stage-bg`, `.font-display`. Variables : `--panel-shadow`, `--panel-blur`, `--brand`, `--stage-bg`.

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-theme.mjs — Auto follows the system, forced themes persist and do not follow it.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ colorScheme: 'light' });
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
check((await theme()) === 'light', 'auto + system light → light');
check((await bg()) === '#f5f5f7', `light --bg is #f5f5f7 (got ${await bg()})`);
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(200);
check((await theme()) === 'dark', 'auto follows a system switch to dark without reload');
await page.evaluate(() => window.__mockuplab.ui.getState().setThemePref('light'));
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(200);
check((await theme()) === 'light', 'forced light ignores the system');
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
check((await theme()) === 'light', 'forced light survives a reload');
check((await page.evaluate(() => localStorage.getItem('mockuplab:theme'))) === 'light', 'pref stored');
const font = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-display'));
check(/Syne/.test(font), 'display font is Syne');
await done(browser, errors);
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node scripts/check-theme.mjs`
Expected: FAIL (`setThemePref is not a function`, `--bg` = `#0a0a0c`).

- [ ] **Step 3: Installer Syne**

Run: `npm install @fontsource-variable/syne`

- [ ] **Step 4: Réécrire les tokens dans `src/index.css`**

Remplacer les lignes 1–5 (imports) et les deux blocs `:root…` (lignes 6–52) par :

```css
@import 'tailwindcss';
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
@import '@fontsource-variable/syne';
@import '@fontsource/instrument-serif/400-italic.css';

@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

/* Light, "Apple": light grey page, white panels, system blue accent. */
:root,
:root[data-theme='light'] {
  --bg: #f5f5f7;
  --surface: #ffffff;
  --surface-2: #f5f5f7;
  --surface-3: #ececf0;
  --surface-4: #e3e3e8;
  --line: rgb(0 0 0 / 0.07);
  --line-strong: rgb(0 0 0 / 0.13);
  --fg: #1d1d1f;
  --fg-muted: #6e6e73;
  --fg-subtle: #aeaeb2;
  --accent: #0071e3;
  --accent-hover: #0077ed;
  --accent-soft: rgb(0 113 227 / 0.1);
  --accent-fg: #ffffff;
  --brand: #ff5c35;
  --panel-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.05);
  --panel-blur: none;
  --menu-bg: rgb(255 255 255 / 0.92);
  --stage: #ececf0;
  --stage-bg: linear-gradient(180deg, #fafafa, #e8e8ed);
  --frame-shadow: 0 30px 70px -24px rgb(0 0 0 / 0.28), 0 0 0 1px rgb(0 0 0 / 0.05);
  --success: #1f9d55;
  --danger: #d70015;
  color-scheme: light;
}

/* Dark, frosted glass: translucent panels over a deep gradient, white accent. */
:root[data-theme='dark'] {
  --bg: #0b0b0e;
  --surface: rgb(40 40 46 / 0.55);
  --surface-2: rgb(255 255 255 / 0.06);
  --surface-3: rgb(255 255 255 / 0.1);
  --surface-4: rgb(255 255 255 / 0.16);
  --line: rgb(255 255 255 / 0.07);
  --line-strong: rgb(255 255 255 / 0.14);
  --fg: #f5f5f7;
  --fg-muted: #98989d;
  --fg-subtle: #636366;
  --accent: #f5f5f7;
  --accent-hover: #ffffff;
  --accent-soft: rgb(255 255 255 / 0.12);
  --accent-fg: #1d1d1f;
  --brand: #ff5c35;
  --panel-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07), 0 10px 30px rgb(0 0 0 / 0.25);
  --panel-blur: blur(20px) saturate(1.4);
  --menu-bg: rgb(44 44 50 / 0.85);
  --stage: #121317;
  --stage-bg: radial-gradient(120% 90% at 50% 35%, #23252c, #0e0f13);
  --frame-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06);
  --success: #30d158;
  --danger: #ff453a;
  color-scheme: dark;
}
```

Dans le bloc `@theme inline`, remplacer la ligne `--font-display: …` par `--font-display: 'Syne Variable', ui-sans-serif, system-ui, sans-serif;` et ajouter `--color-brand: var(--brand);`.

Remplacer la règle `body { … background: var(--bg); … }` : garder toutes les propriétés, mais remplacer `background: var(--bg);` par :

```css
  background: var(--bg);
  background-image: var(--app-bg, none);
```

et ajouter juste après le bloc `:root[data-theme='dark']` : `:root[data-theme='dark'] { --app-bg: linear-gradient(180deg, #14151a, #0b0b0e); }`

Remplacer la règle `.stage-dots { … }` par :

```css
/* The 3D stage behind the frame: a soft studio gradient (no more dots). */
.stage-bg {
  background: var(--stage-bg);
}

/* Panels: white cards in light, frosted glass in dark. */
.glass {
  background: var(--surface);
  box-shadow: var(--panel-shadow);
  -webkit-backdrop-filter: var(--panel-blur);
  backdrop-filter: var(--panel-blur);
}

/* Menus, tooltips' cousins and dialogs: opaque enough to read over the stage. */
.menu-surface {
  background: var(--menu-bg);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  backdrop-filter: blur(24px) saturate(1.5);
  box-shadow: 0 0 0 1px var(--line-strong), 0 18px 50px rgb(0 0 0 / 0.18);
}

.font-display {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
}
```

- [ ] **Step 5: Script de thème dans `index.html`**

Remplacer `data-theme="dark"` de `<html>` par `data-theme="light"`, la balise `<meta name="theme-color" …>` par les deux lignes :

```html
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f5f7" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0b0e" />
```

le bloc `<style>` par :

```html
    <style>
      html, body, #root { height: 100%; margin: 0; }
      html { background: #f5f5f7; --splash-fg: #6e6e73; }
      html[data-theme='dark'] { background: #0b0b0e; --splash-fg: #98989d; }
    </style>
```

et le `<script>` par :

```html
    <script>
      try {
        const p = localStorage.getItem('mockuplab:theme');
        const dark = p === 'dark' || (p !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      } catch {}
    </script>
```

- [ ] **Step 6: Thème dans `src/store/ui.ts`**

Remplacer `export type Theme = 'dark' | 'light';` par :

```ts
export type Theme = 'dark' | 'light';
/** What the user picked: follow the system, or force one theme. */
export type ThemePref = 'auto' | 'light' | 'dark';
```

Dans `interface UiState`, remplacer `theme: Theme;` et `setTheme: (t: Theme) => void;` par :

```ts
  /** The theme in use (resolved from the preference and the system). */
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
```

Remplacer `const initialTheme = …;` par :

```ts
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem('mockuplab:theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

const resolve = (p: ThemePref): Theme => (p === 'auto' ? (systemDark() ? 'dark' : 'light') : p);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
```

Dans `create<UiState>((set) => ({`, remplacer les entrées `theme: initialTheme(),` et `setTheme: (theme) => {…},` par :

```ts
  theme: resolve(readPref()),
  themePref: readPref(),
  setThemePref: (themePref) => {
    try {
      if (themePref === 'auto') localStorage.removeItem('mockuplab:theme');
      else localStorage.setItem('mockuplab:theme', themePref);
    } catch {
      /* storage unavailable */
    }
    const theme = resolve(themePref);
    applyTheme(theme);
    set({ themePref, theme });
  },
```

À la fin du fichier, ajouter :

```ts
// Auto: follow the system theme live.
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { themePref } = useUi.getState();
    if (themePref !== 'auto') return;
    const theme = resolve('auto');
    applyTheme(theme);
    useUi.setState({ theme });
  });
}
```

- [ ] **Step 7: Brancher provisoirement l'ancien bouton thème**

Dans `src/app/TopBar.tsx`, remplacer `const setTheme = useUi((s) => s.setTheme);` par `const setThemePref = useUi((s) => s.setThemePref);` et `onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}` par `onClick={() => setThemePref(theme === 'dark' ? 'light' : 'dark')}` (le fichier est supprimé en tâche 4 ; cela garde le build vert). Dans `src/app/Viewport.tsx`, remplacer `stage-dots` par `stage-bg`.

- [ ] **Step 8: Vérifier**

Run: `npm run typecheck && node scripts/check-theme.mjs`
Expected: typecheck sans erreur ; tous les `✓`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/index.css index.html src/store/ui.ts src/app/TopBar.tsx src/app/Viewport.tsx scripts/check-theme.mjs
git commit -m "Design tokens: Apple light, frosted dark, Syne, auto theme"
```

---

### Task 2: Primitives restylées, sections non repliables

**Files:**
- Modify: `src/ui/primitives.tsx`
- Test: `scripts/check-studio.mjs` (créé en tâche 6 ; ici vérification visuelle + typecheck)

**Interfaces:**
- Produces (exports de `src/ui/primitives.tsx`, signatures inchangées pour l'existant) : `Button`, `IconButton`, `Tooltip`, `Kbd`, `Section({ title, aside, children, defaultOpen? })` (désormais **non repliable**, `defaultOpen` ignoré), `Field`, `Segmented`, `Slider`, `ColorField`, `Spinner`, `Switch`, `Advanced({ children, more, less })` (désormais **toujours ouvert**, titré par `more`… voir code), **nouveaux** : `Chip({ active, onClick, children, disabled?, title?, 'data-testid'? })`, `Sheet({ open, onOpenChange, title, description?, children, footer?, testId? })`, `GroupTitle({ children, aside? })`.

Avant d'écrire : charger les skills `apple-design` et `frontend-design` et appliquer leurs règles (cibles ≥ 28 px, états hover/pressed/focus visibles, transitions 150–250 ms, pas d'animation bloquante).

- [ ] **Step 1: Remplacer `Button` et `IconButton`**

```tsx
type Variant = 'primary' | 'secondary' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 shadow-[0_0_0_1px_var(--line)_inset]',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-3',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium select-none whitespace-nowrap',
        'transition-[background-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97]',
        'disabled:opacity-35 disabled:saturate-0 disabled:pointer-events-none',
        size === 'sm' && 'h-7 rounded-full px-3 text-[12px]',
        size === 'md' && 'h-8 rounded-full px-3.5 text-[13px]',
        size === 'lg' && 'h-10 rounded-full px-5 text-[13.5px]',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  shortcut,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string }) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        className={cx(
          'inline-grid place-items-center size-8 rounded-[10px] text-fg-muted hover:text-fg hover:bg-surface-3',
          'transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:opacity-30 disabled:pointer-events-none',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}
```

(Le bouton désactivé n'est plus « orange pâle » : `saturate-0` + opacité — corrige le point 5 de l'audit.)

- [ ] **Step 2: `Tooltip` et `Kbd`**

Dans `Tooltip`, remplacer la `className` du `RTooltip.Content` par
`"z-50 flex items-center gap-2 rounded-lg menu-surface px-2.5 py-1 text-[12px] font-medium text-fg animate-[fade-in_120ms_ease-out]"`.
Dans `Kbd`, remplacer `'rounded px-1 font-mono text-[10.5px] leading-[16px]'` par `'rounded-md px-1.5 font-mono text-[11px] leading-[18px]'` et la branche `inverted` par `'bg-black/10 text-current/80 dark:bg-white/15'`.

- [ ] **Step 3: `Section` non repliable + `GroupTitle`**

Remplacer toute la fonction `Section` par :

```tsx
/** Title of a group inside a rail page: plain text, never collapsible. */
export function GroupTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[13px] font-semibold text-fg">{children}</h3>
      {aside}
    </div>
  );
}

/**
 * A group of controls in a rail page. Kept under its historical name so every
 * panel picks up the new look; `defaultOpen` is ignored (nothing collapses).
 */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <section className="flex flex-col gap-3.5 border-t border-line px-5 py-5 first:border-t-0">
      <GroupTitle aside={aside}>{title}</GroupTitle>
      {children}
    </section>
  );
}
```

Retirer `ChevronDown` et `useState` des imports s'ils ne sont plus utilisés (ils le sont encore par rien après l'étape 5 — vérifier avec le typecheck).

- [ ] **Step 4: `Field`, `Segmented`, `Slider`, `Switch`, `ColorField`**

- `Field` : libellé `text-[12px] text-fg-muted` → `text-[12.5px] text-fg-muted` ; valeur inchangée.
- `Segmented` : conteneur `'relative flex rounded-lg bg-surface-2 p-0.5 shadow-[0_0_0_1px_var(--line)_inset]'` → `'relative flex rounded-[10px] bg-surface-3 p-[3px]'` ; bouton : `rounded-md` → `rounded-[8px]` ; tailles `h-7 text-[12px]` → `h-7 text-[12.5px]`, `h-6 text-[11.5px]` → `h-6 text-[12px]` ; état actif → `'bg-surface text-fg shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_var(--line-strong)] dark:bg-white/18'` (en clair : pastille blanche, en sombre : verre plus clair).
- `Slider` : piste `h-[3px] … bg-surface-4` → `h-1 … bg-surface-4` ; plage `bg-fg-muted group-hover:bg-fg` → `bg-accent` ; pouce `size-3.5 … bg-fg shadow-[0_1px_4px_rgb(0_0_0/0.4)]` → `size-[18px] … bg-white shadow-[0_1px_4px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.12)]`.
- `Switch` : `h-[18px] w-[30px]` → `h-[22px] w-[38px]` ; pastille `size-[14px]` → `size-[18px]`, translation `translate-x-[12px]` → `translate-x-[16px]` ; fond actif `bg-accent` → `bg-[#34c759]` (vert système, lisible dans les deux thèmes).
- `ColorField` : `rounded-lg` → `rounded-[10px]`.

- [ ] **Step 5: `Advanced` toujours ouvert**

Remplacer la fonction `Advanced` par :

```tsx
/** Fine-tuning controls, always visible under a small heading (no more hidden "More options"). */
export function Advanced({ children, more }: { children: ReactNode; more: string; less?: string }) {
  return (
    <div className="flex flex-col gap-3.5 pt-1">
      <div className="text-[12px] font-medium text-fg-subtle">{more}</div>
      {children}
    </div>
  );
}
```

Dans `src/i18n/fr.ts`, changer `'ui.more': 'Plus d’options'` en `'ui.more': 'Réglages fins'` ; dans `en.ts`, `'ui.more': 'Fine-tuning'`.

- [ ] **Step 6: Nouveaux `Chip` et `Sheet`**

Ajouter les imports `Dialog` (radix-ui) et `X` (lucide-react) en tête, puis :

```tsx
/* ---------------------------------------------------------------- Chip */

export function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
  ...rest
}: { active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; title?: string; 'data-testid'?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-fg text-bg' : 'bg-surface-3 text-fg-muted hover:text-fg',
      )}
      {...rest}
    />
  );
}

/* --------------------------------------------------------------- Sheet */

/** A centred dialog with a title, a scrolling body and an optional footer. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  testId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px] animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          data-testid={testId}
          className="menu-surface fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[18px] text-fg animate-[toast-in_220ms_var(--ease-out-quart)]"
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <Dialog.Title className="font-display text-[20px] font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13px] text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Fermer">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="scroll-thin flex flex-col gap-4 overflow-y-auto px-6 py-3">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck`
Expected: aucune erreur. Ouvrir `http://localhost:5173/` en clair puis en sombre et vérifier visuellement que les panneaux actuels n'ont plus de chevrons ni de « Plus d'options » repliés.

- [ ] **Step 8: Commit**

```bash
git add src/ui/primitives.tsx src/i18n/fr.ts src/i18n/en.ts
git commit -m "Primitives: new look, nothing collapses, Chip and Sheet"
```

---

### Task 3: Écrans et navigation par hash

**Files:**
- Modify: `src/store/ui.ts`
- Create: `src/shell/route.ts`
- Modify: `src/main.tsx`
- Test: `scripts/check-nav.mjs`

**Interfaces:**
- Produces:
  - `src/store/ui.ts` : `type Screen = 'home' | 'quick' | 'project' | 'studio' | 'photo'` ; `type StudioPage = 'devices' | 'settings' | 'ambiance' | 'decor' | 'light' | 'camera' | 'text' | 'brand' | 'video'` ; `type PhotoPage = 'photos' | 'zones' | 'design' | 'render' | 'video'` ; état `screen`, `studioPage`, `photoPage`, `exportOpen: boolean`, `hasSavedProject: boolean` ; actions `setScreen(s)`, `setStudioPage(p)`, `setPhotoPage(p)`, `setExportOpen(v)`.
  - `src/shell/route.ts` : `SCREEN_HASH: Record<Screen, string>`, `navigate(screen: Screen)`, `screenFromHash(hash: string): Screen`, `useRouteSync()` (hook à appeler une fois dans `App`), `AVAILABLE: Record<Screen, boolean>` (`quick`/`project` = `false` en phase 1).

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-nav.mjs — hash ⇄ screen, project mode follows, back button, unavailable screens.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp();
const st = () => page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, mode: window.__mockuplab.project.getState().mode, hash: location.hash }));
let s = await st();
check(s.screen === 'home' && (s.hash === '' || s.hash === '#/'), 'no hash → home');
await page.evaluate(() => (location.hash = '#/photo'));
await page.waitForTimeout(200);
s = await st();
check(s.screen === 'photo' && s.mode === 'photo', '#/photo → photo screen, photo mode');
await page.evaluate(() => (location.hash = '#/studio'));
await page.waitForTimeout(200);
s = await st();
check(s.screen === 'studio' && s.mode === 'scene', '#/studio → studio screen, scene mode');
await page.goBack();
await page.waitForTimeout(200);
check((await st()).screen === 'photo', 'back button returns to photo');
await page.evaluate(() => (location.hash = '#/rapide'));
await page.waitForTimeout(200);
s = await st();
check(s.screen === 'home' && s.hash === '#/', '#/rapide (not yet available) → home');
await done(browser, errors);
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-nav.mjs`
Expected: FAIL (`screen` undefined).

- [ ] **Step 3: État dans `src/store/ui.ts`**

Ajouter après `ThemePref` :

```ts
export type Screen = 'home' | 'quick' | 'project' | 'studio' | 'photo';
export type StudioPage = 'devices' | 'settings' | 'ambiance' | 'decor' | 'light' | 'camera' | 'text' | 'brand' | 'video';
export type PhotoPage = 'photos' | 'zones' | 'design' | 'render' | 'video';
```

Dans `UiState` :

```ts
  /** Which screen is shown (mirrors the URL hash, see src/shell/route.ts). */
  screen: Screen;
  setScreen: (s: Screen) => void;
  studioPage: StudioPage;
  setStudioPage: (p: StudioPage) => void;
  photoPage: PhotoPage;
  setPhotoPage: (p: PhotoPage) => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  /** An autosaved project existed when the app started (the home page offers to resume it). */
  hasSavedProject: boolean;
```

Dans le `create` :

```ts
  screen: 'home',
  setScreen: (screen) => set({ screen }),
  studioPage: 'settings',
  setStudioPage: (studioPage) => set({ studioPage }),
  photoPage: 'photos',
  setPhotoPage: (photoPage) => set({ photoPage }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  hasSavedProject: false,
```

- [ ] **Step 4: Créer `src/shell/route.ts`**

```ts
import { useEffect } from 'react';
import { useProject } from '@/store/project';
import { useUi, type Screen } from '@/store/ui';

/*
 * The screen lives in the URL hash so the browser's back button works and a
 * mode can be bookmarked. The project's own mode follows the screen:
 * studio ⇔ 'scene', photo ⇔ 'photo'. Quick and project are not built yet.
 */

export const SCREEN_HASH: Record<Screen, string> = {
  home: '#/',
  quick: '#/rapide',
  project: '#/projet',
  studio: '#/studio',
  photo: '#/photo',
};

/** Screens that can be opened in this version. */
export const AVAILABLE: Record<Screen, boolean> = { home: true, quick: false, project: false, studio: true, photo: true };

export function screenFromHash(hash: string): Screen {
  const found = (Object.keys(SCREEN_HASH) as Screen[]).find((s) => SCREEN_HASH[s] === hash);
  return found && AVAILABLE[found] ? found : 'home';
}

function apply(screen: Screen) {
  const ui = useUi.getState();
  if (screen === 'studio' || screen === 'photo') {
    const mode = screen === 'studio' ? 'scene' : 'photo';
    if (useProject.getState().mode !== mode) {
      useProject.getState().setMode(mode);
      ui.setPhotoTool('select');
    }
  }
  if (ui.screen !== screen) ui.setScreen(screen);
}

/** Opens a screen (pushes a history entry). */
export function navigate(screen: Screen) {
  const target = AVAILABLE[screen] ? screen : 'home';
  if (location.hash !== SCREEN_HASH[target]) location.hash = SCREEN_HASH[target];
  else apply(target);
}

/** Keeps the store in step with the hash. Call once, in App. */
export function useRouteSync() {
  useEffect(() => {
    const sync = () => {
      const screen = screenFromHash(location.hash);
      // unknown or unavailable hash: normalise the address bar
      if (location.hash && location.hash !== SCREEN_HASH[screen]) history.replaceState(null, '', SCREEN_HASH[screen]);
      apply(screen);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
}
```

- [ ] **Step 5: `hasSavedProject` dans `src/main.tsx`**

Remplacer `.then(() => restoreProject())` par :

```ts
  .then(() => restoreProject())
  .then((restored) => useUi.setState({ hasSavedProject: !!restored }))
  .catch(() => undefined)
```

et ajouter l'import `import { useUi } from './store/ui';`.

- [ ] **Step 6: Appel provisoire dans `App`**

Dans `src/app/App.tsx`, importer `useRouteSync` depuis `@/shell/route` et l'appeler juste après `useGlobalInput();`. (L'aiguillage visuel arrive en tâche 4 ; ici seul l'état change.)

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck && node scripts/check-nav.mjs`
Expected: tous les `✓`.

- [ ] **Step 8: Commit**

```bash
git add src/store/ui.ts src/shell/route.ts src/main.tsx src/app/App.tsx scripts/check-nav.mjs
git commit -m "Screens in the URL hash; project mode follows the screen"
```

---

### Task 4: Barre du haut, menu ···, aiguillage des écrans

**Files:**
- Create: `src/shell/Logo.tsx`, `src/shell/ProjectMenu.tsx`, `src/shell/ModeSwitch.tsx`, `src/shell/MoreMenu.tsx`, `src/shell/TopBar.tsx`
- Delete: `src/app/TopBar.tsx`
- Modify: `src/app/App.tsx`, `src/app/ResetDialog.tsx`, `src/app/shortcuts.ts`, `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `scripts/check-nav.mjs` (complété)

**Interfaces:**
- Consumes: `navigate`, `AVAILABLE` (tâche 3) ; `useUi` : `screen`, `themePref`, `setThemePref`, `setHelpOpen`, `setExportOpen`.
- Produces: `Logo()` ; `TopBar()` ; `ResetDialog({ open, onOpenChange })` (le bouton disparaît, la fenêtre est pilotée par le menu) ; `data-testid` : `mode-switch` (radiogroup, radios nommés « Rapide », « Projet », « Studio », « Photo »), `more-menu`, `top-export`.

- [ ] **Step 1: Compléter le test**

Ajouter avant `await done(...)` dans `scripts/check-nav.mjs` :

```js
await page.evaluate(() => (location.hash = '#/studio'));
await page.waitForTimeout(300);
const radios = await page.getByTestId('mode-switch').getByRole('radio').allTextContents();
check(JSON.stringify(radios.map((r) => r.trim())) === JSON.stringify(['Rapide', 'Projet', 'Studio', 'Photo']), `mode switch: ${radios}`);
check(await page.getByTestId('mode-switch').getByRole('radio', { name: 'Rapide' }).isDisabled(), 'Rapide disabled in phase 1');
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Photo' }).click();
await page.waitForTimeout(200);
check((await st()).hash === '#/photo', 'mode switch → #/photo');
await page.getByRole('button', { name: 'Plus' }).click();
check(await page.getByRole('menuitem', { name: /Raccourcis clavier/ }).isVisible(), '··· menu lists shortcuts');
await page.keyboard.press('Escape');
// keyboard shortcuts do nothing on home
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.__mockuplab.project.getState().items.length);
await page.keyboard.press('Backspace');
await page.keyboard.press('r');
const after = await page.evaluate(() => window.__mockuplab.project.getState().items.length);
check(before === after, 'Delete on home does not remove the device');
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-nav.mjs`
Expected: FAIL (les radios valent `3D`, `Photo`).

- [ ] **Step 3: i18n**

Ajouter dans `src/i18n/fr.ts` (avant `} as const;`) :

```ts
  'screen.home': 'Accueil',
  'screen.quick': 'Rapide',
  'screen.project': 'Projet',
  'screen.studio': 'Studio',
  'screen.photo': 'Photo',
  'screen.soon': 'Bientôt',
  'more.open': 'Plus',
  'more.language': 'Langue',
  'more.theme': 'Thème',
  'more.theme.auto': 'Auto',
  'more.theme.light': 'Clair',
  'more.theme.dark': 'Sombre',
  'more.shortcuts': 'Raccourcis clavier',
  'more.reset': 'Recommencer…',
  'logo.home': 'MockupLab — accueil',
```

et dans `src/i18n/en.ts` :

```ts
  'screen.home': 'Home',
  'screen.quick': 'Quick',
  'screen.project': 'Project',
  'screen.studio': 'Studio',
  'screen.photo': 'Photo',
  'screen.soon': 'Soon',
  'more.open': 'More',
  'more.language': 'Language',
  'more.theme': 'Theme',
  'more.theme.auto': 'Auto',
  'more.theme.light': 'Light',
  'more.theme.dark': 'Dark',
  'more.shortcuts': 'Keyboard shortcuts',
  'more.reset': 'Start over…',
  'logo.home': 'MockupLab — home',
```

- [ ] **Step 4: `src/shell/Logo.tsx`**

```tsx
import { useT } from '@/i18n';
import { navigate, SCREEN_HASH } from './route';

/** "Mockup" + "Lab" in Syne; the brand orange lives only here. Links to the home page. */
export function Logo({ asLink = true }: { asLink?: boolean }) {
  const { t } = useT();
  const mark = (
    <span className="flex items-center gap-2">
      <span className="relative grid size-7 place-items-center rounded-[9px] bg-fg text-bg">
        <span className="block h-[15px] w-[9px] rounded-[3px] border-[1.75px] border-current" />
        <span className="absolute right-[5px] top-[5px] size-[5px] rounded-full bg-brand" />
      </span>
      <span className="font-display text-[17px] leading-none">
        <span className="font-extrabold">Mockup</span>
        <span className="font-medium text-brand">Lab</span>
      </span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <a
      href={SCREEN_HASH.home}
      aria-label={t('logo.home')}
      onClick={(e) => {
        e.preventDefault();
        navigate('home');
      }}
      className="rounded-lg outline-offset-4"
    >
      {mark}
    </a>
  );
}
```

- [ ] **Step 5: `src/shell/ProjectMenu.tsx`**

Déplacer `ProjectControls` depuis `src/app/TopBar.tsx` (lignes 31–88 actuelles) sous le nom `ProjectMenu`, avec ces changements de classes : conteneur `ml-2 flex min-w-0 items-center gap-1` → `flex min-w-0 items-center gap-1` ; champ nom `h-7 w-[180px] … rounded-md … text-[13px]` → `h-8 w-[200px] … rounded-[10px] … text-[13.5px]` ; contenu du menu `rounded-xl bg-surface-3 p-1 shadow-2xl ring-1 ring-line-strong` → `menu-surface rounded-[14px] p-1.5` ; `item` : `rounded-md px-2.5 py-1.5 text-[12.5px] … data-[highlighted]:bg-surface-4` → `rounded-[8px] px-2.5 py-2 text-[13px] … data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg`. Imports identiques à ceux de l'ancien fichier pour cette partie (`useEffect`, `useState`, `DropdownMenu`, `Check`, `ChevronDown`, `FilePlus2`, `FolderOpen`, `Save`, `useT`, `newProject`, `openProjectFile`, `saveProjectFile` depuis `@/app/projectFiles`, `useProject`, `useUi`, `Kbd`, `MOD` depuis `@/app/shortcuts`).

- [ ] **Step 6: `src/shell/ModeSwitch.tsx`**

```tsx
import { useT, type I18nKey } from '@/i18n';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';
import { AVAILABLE, navigate } from './route';

const MODES: Screen[] = ['quick', 'project', 'studio', 'photo'];

/** Rapide · Projet · Studio · Photo — a pill segmented control; unbuilt modes say "Soon". */
export function ModeSwitch() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  return (
    <div role="radiogroup" aria-label={t('screen.home')} data-testid="mode-switch" className="flex rounded-full bg-surface-3 p-[3px]">
      {MODES.map((m) => {
        const active = m === screen;
        const available = AVAILABLE[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!available}
            title={available ? undefined : t('screen.soon')}
            onClick={() => navigate(m)}
            className={cx(
              'h-7 rounded-full px-4 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active ? 'bg-surface text-fg shadow-[0_1px_3px_rgb(0_0_0/0.14)] dark:bg-white/18' : 'text-fg-muted hover:text-fg',
              !available && 'opacity-40',
            )}
          >
            {t(`screen.${m}` as I18nKey)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: `src/app/ResetDialog.tsx` piloté de l'extérieur**

Transformer `ResetButton` en `ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void })` : supprimer `const [open, setOpen] = useState(false);` et l'`IconButton` déclencheur, remplacer `setOpen(false)` par `onOpenChange(false)`, `<Dialog.Root open={open} onOpenChange={setOpen}>` par `<Dialog.Root open={open} onOpenChange={onOpenChange}>`. Remplacer la classe du `Dialog.Content` par celle des fenêtres (`menu-surface … rounded-[18px]`). Retirer les imports devenus inutiles (`useState`, `RotateCcw`, `IconButton`).

- [ ] **Step 8: `src/shell/MoreMenu.tsx`**

```tsx
import { useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Ellipsis, Keyboard, Languages, RotateCcw, SunMoon } from 'lucide-react';
import { useLang, useT } from '@/i18n';
import { ResetDialog } from '@/app/ResetDialog';
import { useUi, type ThemePref } from '@/store/ui';
import { Kbd } from '@/ui/primitives';

const row = 'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg';
const label = 'px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-fg-subtle';

/** Language, theme, shortcuts and "start over", out of the top bar. */
export function MoreMenu() {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const themePref = useUi((s) => s.themePref);
  const setThemePref = useUi((s) => s.setThemePref);
  const [reset, setReset] = useState(false);
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={t('more.open')} data-testid="more-menu" className="grid size-8 place-items-center rounded-[10px] text-fg-muted hover:bg-surface-3 hover:text-fg">
            <Ellipsis size={18} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={8} align="end" className="menu-surface z-50 min-w-[230px] rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
            <DropdownMenu.Label className={label}>
              <Languages size={12} className="mr-1 inline" />
              {t('more.language')}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={lang} onValueChange={(v) => setLang(v as 'fr' | 'en')}>
              <DropdownMenu.RadioItem value="fr" className={row}>Français{lang === 'fr' && ' ✓'}</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="en" className={row}>English{lang === 'en' && ' ✓'}</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Label className={label}>
              <SunMoon size={12} className="mr-1 inline" />
              {t('more.theme')}
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={themePref} onValueChange={(v) => setThemePref(v as ThemePref)}>
              {(['auto', 'light', 'dark'] as const).map((p) => (
                <DropdownMenu.RadioItem key={p} value={p} className={row}>
                  {t(`more.theme.${p}`)}
                  {themePref === p && ' ✓'}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="mx-2 my-1 h-px bg-line" />
            <DropdownMenu.Item className={row} onSelect={() => useUi.getState().setHelpOpen(true)}>
              <Keyboard size={15} />
              <span className="flex-1">{t('more.shortcuts')}</span>
              <Kbd>?</Kbd>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={row} onSelect={() => setReset(true)}>
              <RotateCcw size={15} />
              {t('more.reset')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ResetDialog open={reset} onOpenChange={setReset} />
    </>
  );
}
```

(`SunMoon` existe dans lucide-react 1.x ; vérifier avec `grep -c "SunMoon" node_modules/lucide-react/dist/lucide-react.d.ts`, sinon utiliser `Sun`.)

- [ ] **Step 9: `src/shell/TopBar.tsx`**

```tsx
import { useStore } from 'zustand';
import { Download, Redo2, Undo2 } from 'lucide-react';
import { useT } from '@/i18n';
import { MOD } from '@/app/shortcuts';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, IconButton } from '@/ui/primitives';
import { Logo } from './Logo';
import { ModeSwitch } from './ModeSwitch';
import { MoreMenu } from './MoreMenu';
import { ProjectMenu } from './ProjectMenu';

/** Logo / project · modes · undo, redo, more, export. */
export function TopBar() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  const exporting = useUi((s) => s.exporting);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const editor = screen === 'studio' || screen === 'photo';
  return (
    <header className="relative z-20 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-[var(--menu-bg)] px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <span className="text-fg-subtle">/</span>
        <ProjectMenu />
      </div>
      <ModeSwitch />
      <div className="flex items-center justify-end gap-1">
        {editor && (
          <>
            <IconButton label={t('top.undo')} shortcut={`${MOD}Z`} disabled={!canUndo} onClick={() => useProject.temporal.getState().undo()}>
              <Undo2 size={17} />
            </IconButton>
            <IconButton label={t('top.redo')} shortcut={`⇧${MOD}Z`} disabled={!canRedo} onClick={() => useProject.temporal.getState().redo()}>
              <Redo2 size={17} />
            </IconButton>
          </>
        )}
        <MoreMenu />
        {editor && (
          <Button variant="primary" className="ml-2" onClick={() => useUi.getState().setExportOpen(true)} disabled={!!exporting} data-testid="top-export">
            <Download size={15} strokeWidth={2.2} />
            {t('top.export')}
          </Button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Aiguillage dans `src/app/App.tsx`**

Remplacer le contenu de `App()` après `if (!webgl) return <NoWebGL />;` par :

```tsx
  const screen = useUi((s) => s.screen);
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        {screen === 'home' ? (
          <Home />
        ) : (
          <>
            <TopBar />
            <ErrorBoundary label={t(screen === 'photo' ? 'screen.photo' : 'screen.studio')} key={screen}>
              {screen === 'photo' ? <PhotoScreen /> : <StudioScreen />}
            </ErrorBoundary>
          </>
        )}
      </div>
      <Toaster />
      <HelpDialog />
      <VariantsDialog />
      <PreviewOverlay />
      <SmallScreenNotice />
      <BatchDialog />
      <ExportSheet />
    </Tooltip.Provider>
  );
```

En attendant les tâches 5–9, créer des **coquilles** minimales pour que le build passe : `src/home/Home.tsx` (`export function Home() { return <div data-testid="home" />; }`), `src/studio/StudioScreen.tsx` (rend l'ancien trio `<LibraryPanel /><Viewport /><PropertiesPanel />` dans un `div className="flex min-h-0 flex-1"`), `src/photo/PhotoScreen.tsx` (rend `<PhotoLibrary /><PhotoView /><PropertiesPanel />` de même), `src/shell/ExportSheet.tsx` (`export function ExportSheet() { return null; }`). Imports à mettre à jour dans `App.tsx` : `Logo` depuis `@/shell/Logo`, `TopBar` depuis `@/shell/TopBar`, `useUi` depuis `@/store/ui`, et les quatre nouveaux écrans ; supprimer les imports de `LibraryPanel`, `PropertiesPanel`, `Viewport` (garder `PreviewOverlay`), `PhotoLibrary`, `PhotoView`, `useProject`.

Supprimer `src/app/TopBar.tsx` (`git rm src/app/TopBar.tsx`).

- [ ] **Step 11: Raccourcis inactifs sur l'accueil**

Dans `src/app/shortcuts.ts`, au début de `onKey`, après `if (isEditable(e.target)) return;`, ajouter :

```ts
  // the home page shows no project: only the help shortcut works there
  if (useUi.getState().screen === 'home' && e.key !== '?') return;
```

- [ ] **Step 12: Vérifier**

Run: `npm run typecheck && node scripts/check-nav.mjs && node scripts/check-theme.mjs`
Expected: tous les `✓`.

- [ ] **Step 13: Commit**

```bash
git add -A src/shell src/app/App.tsx src/app/ResetDialog.tsx src/app/shortcuts.ts src/home src/studio src/photo/PhotoScreen.tsx src/i18n scripts/check-nav.mjs
git commit -m "Top bar with mode switch and more menu; screens routed"
```

---

### Task 5: Page d'accueil

**Files:**
- Modify: `src/home/Home.tsx`
- Modify: `src/app/shortcuts.ts` (dépose/collage sur l'accueil)
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `scripts/check-home.mjs`

**Interfaces:**
- Consumes: `navigate`, `AVAILABLE`, `Logo`, `useUi.hasSavedProject`, `importImages` (`@/lib/importImage`), `pickImages`.
- Produces: `Home()` ; `data-testid` : `home`, `home-drop`, `home-resume`, `mode-card-<screen>`.

Avant d'écrire : charger `frontend-design` et `apple-design` ; titre en Syne 700, interlettrage −0,02 em, tout doit tenir dans 1440×900 sans défiler.

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-home.mjs — explanation, drop zone → studio with the image, resume, mode cards.
import { openApp, check, done } from './lib/app.mjs';
let { browser, page, errors } = await openApp();
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check(await page.getByRole('heading', { level: 1 }).isVisible(), 'headline present');
check(!(await page.getByTestId('home-resume').isVisible().catch(() => false)), 'no resume line without a saved project');
for (const m of ['quick', 'project']) check(await page.getByTestId(`mode-card-${m}`).isDisabled(), `${m} card disabled (soon)`);
// drop zone: pick a file
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('home-drop').click()]);
await chooser.setFiles('public/samples/' + (await import('node:fs')).readdirSync('public/samples').find((f) => /\.(png|jpe?g|webp)$/i.test(f)));
await page.waitForTimeout(1200);
const s = await page.evaluate(() => {
  const p = window.__mockuplab.project.getState();
  return { screen: window.__mockuplab.ui.getState().screen, hasImage: p.items.some((it) => Object.values(it.surfaces).some((b) => b.assetId)) };
});
check(s.screen === 'studio' && s.hasImage, 'picked image → studio, on the device screen');
// a saved photo project resumes into the photo screen (same browser: the autosave is kept across the reload)
await page.evaluate(() => (location.hash = '#/photo'));
await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
await page.waitForTimeout(1800);
await page.evaluate(() => (location.hash = '#/'));
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(600);
check(await page.getByTestId('home-resume').isVisible(), 'resume line shown');
await page.getByTestId('home-resume').click();
await page.waitForTimeout(400);
const r = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, photo: !!window.__mockuplab.project.getState().photo.assetId }));
check(r.screen === 'photo' && r.photo, 'resume opens the photo screen with its photo');
// paste on home → studio
await page.evaluate(() => (location.hash = '#/'));
await page.waitForTimeout(200);
await page.evaluate(async () => {
  const blob = await (await fetch('/favicon.svg')).blob();
  const png = await new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = 300; c.height = 600; c.getContext('2d').drawImage(img, 0, 0, 300, 600); c.toBlob(res, 'image/png'); };
    img.src = URL.createObjectURL(blob);
  });
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(800);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'paste on home → studio');
await done(browser, errors);
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-home.mjs`
Expected: FAIL (`heading` introuvable).

- [ ] **Step 3: i18n**

FR :

```ts
  'home.title': 'Tes designs, mis en scène.',
  'home.lead': 'Dépose une capture d’écran, un site ou une affiche : MockupLab la place sur des appareils et des objets réalistes en 3D, ou sur de vraies photos. Gratuit, et tout se passe dans ton navigateur.',
  'home.drop': 'Dépose tes images ici, colle-les ({paste}) ou parcours',
  'home.dropHint': 'PNG, JPG, WebP ou GIF — elles restent sur ton appareil.',
  'home.modes': 'Ou choisis un mode',
  'home.quick': 'Une image → des mock-ups prêts.',
  'home.project': 'Site + mobile + print → un pack cohérent.',
  'home.studio': 'Tout régler : appareils, décor, lumière, caméra, vidéo.',
  'home.photo': 'Ton design posé sur une vraie photo.',
  'home.resume': 'Reprendre « {name} »',
  'home.resumeMode': '{mode} · enregistré automatiquement',
  'home.open': 'Ouvrir',
```

EN :

```ts
  'home.title': 'Your designs, staged.',
  'home.lead': 'Drop a screenshot, a website or a poster: MockupLab puts it on realistic 3D devices and objects, or on real photos. Free, and it all happens in your browser.',
  'home.drop': 'Drop your images here, paste them ({paste}) or browse',
  'home.dropHint': 'PNG, JPG, WebP or GIF — they stay on your device.',
  'home.modes': 'Or pick a mode',
  'home.quick': 'One image → ready-made mock-ups.',
  'home.project': 'Website + mobile + print → one consistent pack.',
  'home.studio': 'Tune everything: devices, set, light, camera, video.',
  'home.photo': 'Your design on a real photo.',
  'home.resume': 'Resume “{name}”',
  'home.resumeMode': '{mode} · autosaved',
  'home.open': 'Open',
```

- [ ] **Step 4: `src/home/Home.tsx`**

```tsx
import { Camera, ImagePlus, Layers, Sparkles, SlidersHorizontal, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLang, useT, type I18nKey } from '@/i18n';
import { importImages, pickImages } from '@/lib/importImage';
import { MOD } from '@/app/shortcuts';
import { Logo } from '@/shell/Logo';
import { AVAILABLE, navigate } from '@/shell/route';
import { useProject } from '@/store/project';
import { useUi, type Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

const CARDS: { screen: Screen; icon: ReactNode; tint: string }[] = [
  { screen: 'quick', icon: <Sparkles size={22} />, tint: 'from-[#e8f0fd] to-[#f3f7fe] dark:from-white/10 dark:to-white/[0.03]' },
  { screen: 'project', icon: <Layers size={22} />, tint: 'from-[#efe9fb] to-[#f7f4fd] dark:from-white/10 dark:to-white/[0.03]' },
  { screen: 'studio', icon: <SlidersHorizontal size={22} />, tint: 'from-[#e7f5ec] to-[#f3faf6] dark:from-white/10 dark:to-white/[0.03]' },
  { screen: 'photo', icon: <Camera size={22} />, tint: 'from-[#f4ede6] to-[#faf6f2] dark:from-white/10 dark:to-white/[0.03]' },
];

/** Opens the studio, then puts the files on the selected device (same path as a drop in the studio). */
export function importFromHome(files: Iterable<File>) {
  navigate('studio');
  // the screen switch sets the project to 3D first, so the image lands on the device
  queueMicrotask(() => void importImages(files));
}

function Resume() {
  const { t } = useT();
  const has = useUi((s) => s.hasSavedProject);
  const name = useProject((s) => s.name);
  const mode = useProject((s) => s.mode);
  if (!has) return null;
  const target: Screen = mode === 'photo' ? 'photo' : 'studio';
  return (
    <button
      type="button"
      data-testid="home-resume"
      onClick={() => navigate(target)}
      className="glass group flex w-full items-center gap-4 rounded-[14px] px-5 py-4 text-left transition-transform duration-150 active:scale-[0.99]"
    >
      <span className="flex-1">
        <span className="block text-[14px] font-semibold">{t('home.resume', { name: name === 'Untitled' ? t('project.untitled') : name })}</span>
        <span className="block text-[12.5px] text-fg-muted">{t('home.resumeMode', { mode: t(target === 'photo' ? 'screen.photo' : 'screen.studio') })}</span>
      </span>
      <span className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-accent-fg">
        {t('home.open')}
        <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

export function Home() {
  const { t } = useT();
  const lang = useLang((s) => s.lang);
  const [before, after] = t('home.drop').split('{paste}');
  return (
    <div data-testid="home" className="scroll-thin flex h-full flex-col overflow-y-auto">
      <header className="flex h-14 shrink-0 items-center justify-between px-6">
        <Logo asLink={false} />
        <span className="text-[12.5px] text-fg-subtle">{lang.toUpperCase()}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col justify-center gap-10 px-6 pb-12">
        <section className="flex flex-col items-center gap-5 text-center">
          <h1 className="font-display text-[clamp(40px,5.2vw,64px)] font-bold leading-[1.02]">{t('home.title')}</h1>
          <p className="max-w-[620px] text-[16px] leading-relaxed text-fg-muted">{t('home.lead')}</p>
          <button
            type="button"
            data-testid="home-drop"
            onClick={() => pickImages()}
            className="mt-2 flex w-full max-w-[620px] flex-col items-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface px-6 py-7 text-fg-muted transition-[border-color,transform,background-color] duration-150 hover:border-accent hover:text-fg active:scale-[0.99]"
          >
            <ImagePlus size={24} className="text-accent" />
            <span className="text-[14.5px] font-medium">
              {before}
              <kbd className="mx-1 rounded-md bg-surface-3 px-1.5 font-mono text-[12px]">{MOD}V</kbd>
              {after}
            </span>
            <span className="text-[12.5px] text-fg-subtle">{t('home.dropHint')}</span>
          </button>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-medium text-fg-subtle">{t('home.modes')}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CARDS.map((c) => {
              const available = AVAILABLE[c.screen];
              return (
                <button
                  key={c.screen}
                  type="button"
                  data-testid={`mode-card-${c.screen}`}
                  disabled={!available}
                  onClick={() => navigate(c.screen)}
                  className={cx(
                    'glass group flex flex-col gap-3 rounded-[18px] p-4 text-left transition-transform duration-200 ease-[var(--ease-out-quart)]',
                    available ? 'hover:-translate-y-0.5 active:scale-[0.99]' : 'cursor-default opacity-60',
                  )}
                >
                  <span className={cx('grid h-24 place-items-center rounded-[12px] bg-gradient-to-br text-fg', c.tint)}>{c.icon}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[19px] font-bold">{t(`screen.${c.screen}` as I18nKey)}</span>
                    {!available && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-fg-muted">{t('screen.soon')}</span>}
                  </span>
                  <span className="text-[13px] leading-snug text-fg-muted">{t(`home.${c.screen}` as I18nKey)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <Resume />
      </main>
    </div>
  );
}
```

Ajouter dans `pickImages` (`src/lib/importImage.ts`) un paramètre optionnel pour réutiliser le sélecteur depuis l'accueil :

```ts
export function pickImages(onFiles: (files: FileList) => void = (f) => void importImages(f)) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => input.files && onFiles(input.files);
  input.click();
}
```

et dans `Home`, remplacer `onClick={() => pickImages()}` par `onClick={() => pickImages(importFromHome)}`.

- [ ] **Step 5: Dépose et collage sur l'accueil**

Dans `src/app/shortcuts.ts`, importer `importFromHome` depuis `@/home/Home`. Dans `onPaste`, remplacer `importImages(files);` par :

```ts
        if (useUi.getState().screen === 'home') importFromHome(files);
        else importImages(files);
```

Dans `onDrop`, juste avant `// An image dropped on a device…`, ajouter :

```ts
      if (useUi.getState().screen === 'home') {
        if (e.dataTransfer?.files.length) importFromHome(e.dataTransfer.files);
        return;
      }
```

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && node scripts/check-home.mjs`
Expected: tous les `✓`. Capture : `node -e` n'est pas nécessaire — ouvrir `http://localhost:5173/` en 1440×900 clair et sombre et vérifier qu'il n'y a pas de défilement.

- [ ] **Step 7: Commit**

```bash
git add src/home/Home.tsx src/lib/importImage.ts src/app/shortcuts.ts src/i18n scripts/check-home.mjs
git commit -m "Home page: explanation, drop zone, modes, resume"
```

---

### Task 6: Rail et écran Studio (Appareils, Réglages)

**Files:**
- Create: `src/shell/Rail.tsx`, `src/studio/DevicesPage.tsx`, `src/studio/SettingsPage.tsx`
- Modify: `src/studio/StudioScreen.tsx`, `src/app/LibraryPanel.tsx`, `src/app/PropertiesPanel.tsx`, `src/app/panels/CompositionSection.tsx`, `src/scene/interaction.tsx`, `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `scripts/check-studio.mjs`

**Interfaces:**
- Consumes: `useUi.studioPage/setStudioPage`, `Section`, `GroupTitle`, `Chip`.
- Produces:
  - `src/shell/Rail.tsx` : `type RailItem<P extends string> = { id: P; label: string; icon: ReactNode }` ; `Rail<P>({ items, value, onChange, testId })` (rôle `tablist`, chaque bouton rôle `tab` nommé par son libellé, `aria-selected`) ; `RailPage({ title, children, testId })`.
  - `src/app/LibraryPanel.tsx` exporte `ModelCard({ model, onDelete? })` (**clic = ajouter**), `Silhouette`, `UserModels`, `CATEGORY_KEYS`, `MODEL_DRAG_TYPE` ; plus de `LibraryPanel`.
  - `src/app/PropertiesPanel.tsx` exporte `DeviceSection`, `ImageSection`, `RatioPicker`, `ExportForm` (ex-`ExportSection` sans `Section` englobante ni bascule vidéo) ; plus de `PropertiesPanel`.
  - `src/app/panels/CompositionSection.tsx` exporte `SceneItems()` et `Placement()` ; plus de `CompositionSection`.
  - `src/studio/DevicesPage.tsx` : `DevicesPage()` ; `src/studio/SettingsPage.tsx` : `SettingsPage()`.
  - `data-testid` : `studio-rail`, `rail-page`, `library-tabs`.

Avant d'écrire : charger `apple-design` (rail : icône 20 px + libellé 11 px, cible 52×52, page active en `accent-soft`) et `emil-design-eng` (transition de page : fondu + translation 6 px, 180 ms, interrompable).

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-studio.mjs — rail pages render flat, library click adds, canvas click opens Settings.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const rail = page.getByTestId('studio-rail');
const names = (await rail.getByRole('tab').allTextContents()).map((s) => s.trim());
check(JSON.stringify(names) === JSON.stringify(['Appareils', 'Réglages', 'Ambiance', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']), `rail: ${names}`);
for (const n of names) {
  await rail.getByRole('tab', { name: n, exact: true }).click();
  await page.waitForTimeout(250);
  const collapsible = await page.getByTestId('rail-page').locator('[aria-expanded]').count();
  check(collapsible === 0, `${n}: no collapsible section`);
  check((await page.getByTestId('rail-page').getByRole('heading', { level: 2 }).textContent()).trim() === n, `${n}: page title`);
}
await rail.getByRole('tab', { name: 'Appareils', exact: true }).click();
const count = () => page.evaluate(() => window.__mockuplab.project.getState().items.length);
const n0 = await count();
await page.getByTestId('rail-page').getByRole('button', { name: 'Laptop 14', exact: true }).click();
await page.waitForTimeout(300);
check((await count()) === n0 + 1, 'library click adds a device');
// a click on a device in the canvas opens Settings
await rail.getByRole('tab', { name: 'Lumière', exact: true }).click();
const box = await page.getByTestId('frame').boundingBox();
const hit = await page.evaluate(({ x, y, w, h }) => {
  for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) {
    const px = x + (w * i) / 20, py = y + (h * j) / 20;
    if (window.__mockuplab.picking.item?.(px, py)) return [px, py];
  }
  return null;
}, { x: box.x, y: box.y, w: box.width, h: box.height });
check(!!hit, 'found a device in the frame');
await page.mouse.click(hit[0], hit[1]);
await page.waitForTimeout(300);
check((await page.evaluate(() => window.__mockuplab.ui.getState().studioPage)) === 'settings', 'canvas click → Settings page');
await done(browser, errors);
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-studio.mjs`
Expected: FAIL (`studio-rail` introuvable).

- [ ] **Step 3: i18n des pages**

FR :

```ts
  'page.devices': 'Appareils',
  'page.settings': 'Réglages',
  'page.ambiance': 'Ambiance',
  'page.decor': 'Décor',
  'page.light': 'Lumière',
  'page.camera': 'Caméra',
  'page.text': 'Texte',
  'page.brand': 'Marque',
  'page.video': 'Vidéo',
  'page.photos': 'Photos',
  'page.zones': 'Zones',
  'page.design': 'Design',
  'page.render': 'Rendu',
  'devices.inScene': 'Dans la scène',
  'devices.library': 'Ajouter un appareil',
  'devices.hint': 'Clic : ajoute à la scène · glisser : le pose où tu veux.',
  'settings.none': 'Sélectionne un appareil dans la scène pour le régler.',
  'settings.placement': 'Position dans la scène',
```

EN :

```ts
  'page.devices': 'Devices',
  'page.settings': 'Settings',
  'page.ambiance': 'Mood',
  'page.decor': 'Set',
  'page.light': 'Light',
  'page.camera': 'Camera',
  'page.text': 'Text',
  'page.brand': 'Brand',
  'page.video': 'Video',
  'page.photos': 'Photos',
  'page.zones': 'Zones',
  'page.design': 'Design',
  'page.render': 'Render',
  'devices.inScene': 'In the scene',
  'devices.library': 'Add a device',
  'devices.hint': 'Click: adds it to the scene · drag: drops it where you want.',
  'settings.none': 'Select a device in the scene to adjust it.',
  'settings.placement': 'Placement in the scene',
```

Mettre à jour `'library.add'` : FR `'Ajouter à la scène'` (inchangé) ; supprimer l'usage de `'library.replace'` et `'library.hint'` (les clés restent dans les dictionnaires jusqu'à la tâche 11 où l'on nettoie les clés inutilisées).

- [ ] **Step 4: `src/shell/Rail.tsx`**

```tsx
import type { ReactNode } from 'react';
import { cx } from '@/ui/primitives';

export type RailItem<P extends string> = { id: P; label: string; icon: ReactNode };

/** Column of page buttons (icon + label). One page open at a time. */
export function Rail<P extends string>({ items, value, onChange, testId }: { items: RailItem<P>[]; value: P; onChange: (p: P) => void; testId?: string }) {
  return (
    <nav className="glass flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-[14px] py-2" role="tablist" aria-orientation="vertical" data-testid={testId}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={cx(
              'flex w-[58px] flex-col items-center gap-1 rounded-[10px] py-2 text-[11px] font-medium leading-none transition-[background-color,color,transform] duration-150 active:scale-[0.95]',
              active ? 'bg-accent-soft text-fg [&>svg]:text-accent dark:[&>svg]:text-fg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

/** The open page: a title in Syne and its flat content, scrolling on its own. */
export function RailPage({ title, children, testId = 'rail-page' }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <aside className="glass flex w-[312px] shrink-0 flex-col overflow-hidden rounded-[14px]" data-testid={testId} role="tabpanel" aria-label={title}>
      <h2 className="font-display shrink-0 px-5 pb-1 pt-5 text-[20px] font-bold">{title}</h2>
      <div key={title} className="scroll-thin flex-1 overflow-y-auto pb-4 animate-[page-in_180ms_var(--ease-out-quart)]">
        {children}
      </div>
    </aside>
  );
}
```

Ajouter dans `src/index.css` (près des autres `@keyframes`) :

```css
@keyframes page-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
```

- [ ] **Step 5: Bibliothèque — clic = ajouter**

Dans `src/app/LibraryPanel.tsx` :
- exporter `Silhouette` et `ModelCard` (`export function …`) ;
- dans `ModelCard`, remplacer le `onClick` du bouton principal par :

```tsx
                        onClick={() => {
                          addItem(m.id);
                          resetView();
                        }}
```

  remplacer `<Tooltip label={t('library.replace')}>` par `<Tooltip label={t('library.add')}>`, supprimer le bouton rond « + » (le second `Tooltip` entier), supprimer `selected`/`active` et la classe d'état actif (garder la variante inactive : `'text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-3 hover:text-fg'`), et passer `rounded-xl bg-surface-2` → `rounded-[12px] bg-surface-2` ;
- supprimer la fonction `LibraryPanel` et les imports devenus inutiles (`selectSelectedItem`, `getModel`, `switchModel`, `Plus`) ;
- exporter `UserModels`.

- [ ] **Step 6: Composition en deux morceaux**

Dans `src/app/panels/CompositionSection.tsx`, remplacer `export function CompositionSection()` par deux composants partageant un hook :

```tsx
function useComposition() {
  const { tr } = useT();
  const items = useProject((s) => s.items);
  const selectedId = useProject((s) => s.selectedId);
  const selected = items.find((it) => it.id === selectedId) ?? items[0];
  // "Phone Pro", "Phone Pro 2"… when the same model appears several times.
  const seen = new Map<string, number>();
  const labels = items.map((it) => {
    const n = (seen.get(it.modelId) ?? 0) + 1;
    seen.set(it.modelId, n);
    return n > 1 ? `${tr(getModel(it.modelId).name)} ${n}` : tr(getModel(it.modelId).name);
  });
  return { items, selected, labels };
}
```

- `SceneItems()` : `<Section title={t('devices.inScene')} aside={…count…}>` contenant la liste `<ul>` actuelle (inchangée) puis **seulement** le bouton « Disposer » en pleine largeur (le menu déroulant « Ajouter un appareil » est supprimé : la bibliothèque juste en dessous le remplace).
- `Placement()` : si `selected`, `<Section title={t('settings.placement')}>` contenant le `Field` Rotation, la grille Avancer/Reculer/Centrer (si `items.length > 1`) et le paragraphe `comp.dragHint` — code repris tel quel du bloc `{selected && (…)}` actuel.
- Retirer les imports devenus inutiles (`DropdownMenu`, `Plus`, `modelsByCategory`, `CATEGORY_KEYS` local s'il ne sert plus).

- [ ] **Step 7: `src/studio/DevicesPage.tsx`**

```tsx
import { useState } from 'react';
import { useT } from '@/i18n';
import { CATEGORY_KEYS, ModelCard, UserModels } from '@/app/LibraryPanel';
import { SceneItems } from '@/app/panels/CompositionSection';
import { modelsByCategory } from '@/models/registry';
import type { DeviceCategory } from '@/models/types';
import { Chip, Section } from '@/ui/primitives';

/** What is in the scene, then the library (one category at a time) and the .glb import. */
export function DevicesPage() {
  const { t } = useT();
  const groups = modelsByCategory();
  const [cat, setCat] = useState<DeviceCategory | 'custom'>(groups[0]?.[0] ?? 'phone');
  const models = groups.find(([c]) => c === cat)?.[1] ?? [];
  return (
    <>
      <SceneItems />
      <Section title={t('devices.library')}>
        <div className="flex flex-wrap gap-1.5" data-testid="library-tabs">
          {groups.map(([c]) => (
            <Chip key={c} active={c === cat} onClick={() => setCat(c)}>
              {CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c}
            </Chip>
          ))}
          <Chip active={cat === 'custom'} onClick={() => setCat('custom')}>
            {t('library.custom')}
          </Chip>
        </div>
        {cat === 'custom' ? (
          <UserModels />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {models.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        )}
        <p className="text-[12px] leading-snug text-fg-subtle">{t('devices.hint')}</p>
      </Section>
    </>
  );
}
```

Vérifier que `modelsByCategory()` renvoie bien des paires `[DeviceCategory, DeviceModule[]]` (c'est le cas dans `src/models/registry.ts`) et que les modèles `.glb` de l'utilisateur ne sont **pas** dans ces groupes (ils sont affichés par `UserModels`) ; si `modelsByCategory()` inclut une catégorie `custom`, la filtrer : `groups.filter(([c]) => c !== 'custom')`.

- [ ] **Step 8: `PropertiesPanel.tsx` → morceaux exportés**

Dans `src/app/PropertiesPanel.tsx` : exporter `DeviceSection`, `ImageSection`, `RatioPicker` ; renommer `ExportSection` en `ExportForm` et l'exporter, en retirant le `<Section title=…>` englobant, le `Segmented` Image/Vidéo et toute la branche vidéo (`settings.kind === 'video' ? … :`), ainsi que le `RatioPicker` (le format est réglé dans la barre flottante, tâche 7) ; supprimer `type Tab`, la fonction `PropertiesPanel` et les imports inutiles (`useState`, `CompositionSection`, `ScenePanel`, `TextPanel`, `PhotoPanel`, `VideoSection`). Dans `DeviceSection`, le titre passe de `t('props.device')` au nom de l'appareil : `<Section title={tr(model.name)}>`.

- [ ] **Step 9: `src/studio/SettingsPage.tsx`**

```tsx
import { useT } from '@/i18n';
import { DeviceSection, ImageSection } from '@/app/PropertiesPanel';
import { Placement } from '@/app/panels/CompositionSection';
import { selectSelectedItem, useProject } from '@/store/project';

/** Everything about the selected device: model, design on its screen(s), finish, placement. */
export function SettingsPage() {
  const { t } = useT();
  const item = useProject(selectSelectedItem);
  if (!item) return <p className="px-5 py-4 text-[13px] leading-relaxed text-fg-muted">{t('settings.none')}</p>;
  return (
    <>
      <ImageSection />
      <DeviceSection />
      <Placement />
    </>
  );
}
```

Ordre des groupes (spec § 7) : « Ton design » d'abord, puis l'appareil (titre = nom de l'appareil, `ModelSwitcher` « Changer d'appareil » en tête, finition, position, luminosité…), puis le placement. Le rendu de `SettingsPage` est donc :

```tsx
      <ImageSection />
      <DeviceSection />
      <Placement />
```

Dans `ImageSection`, remplacer les titres `t('props.images')` / `t('props.image')` par les nouvelles clés `t('settings.designs')` / `t('settings.design')` — FR « Tes designs » / « Ton design », EN « Your designs » / « Your design ».

- [ ] **Step 10: `src/studio/StudioScreen.tsx`**

```tsx
import { Armchair, Camera, Clapperboard, Palette, SlidersHorizontal, Smartphone, Sparkles, Sun, Type } from 'lucide-react';
import { useT } from '@/i18n';
import { Viewport } from '@/app/Viewport';
import { Rail, RailPage, type RailItem } from '@/shell/Rail';
import { useUi, type StudioPage } from '@/store/ui';
import { DevicesPage } from './DevicesPage';
import { SettingsPage } from './SettingsPage';
import { StudioPageBody } from './pages';

const ICON = 20;

export function StudioScreen() {
  const { t } = useT();
  const page = useUi((s) => s.studioPage);
  const setPage = useUi((s) => s.setStudioPage);
  const items: RailItem<StudioPage>[] = [
    { id: 'devices', label: t('page.devices'), icon: <Smartphone size={ICON} /> },
    { id: 'settings', label: t('page.settings'), icon: <SlidersHorizontal size={ICON} /> },
    { id: 'ambiance', label: t('page.ambiance'), icon: <Sparkles size={ICON} /> },
    { id: 'decor', label: t('page.decor'), icon: <Armchair size={ICON} /> },
    { id: 'light', label: t('page.light'), icon: <Sun size={ICON} /> },
    { id: 'camera', label: t('page.camera'), icon: <Camera size={ICON} /> },
    { id: 'text', label: t('page.text'), icon: <Type size={ICON} /> },
    { id: 'brand', label: t('page.brand'), icon: <Palette size={ICON} /> },
    { id: 'video', label: t('page.video'), icon: <Clapperboard size={ICON} /> },
  ];
  const title = items.find((i) => i.id === page)?.label ?? '';
  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2">
      <Rail items={items} value={page} onChange={setPage} testId="studio-rail" />
      <RailPage title={title}>
        {page === 'devices' && <DevicesPage />}
        {page === 'settings' && <SettingsPage />}
        {page !== 'devices' && page !== 'settings' && <StudioPageBody page={page} />}
      </RailPage>
      <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[14px]">
        <Viewport />
      </div>
    </div>
  );
}
```

Créer `src/studio/pages.tsx` provisoire (complété en tâche 7) :

```tsx
import type { StudioPage } from '@/store/ui';
export function StudioPageBody({ page }: { page: StudioPage }) {
  return <p className="px-5 text-fg-muted">{page}</p>;
}
```

- [ ] **Step 11: Clic dans la 3D → Réglages**

Dans `src/scene/interaction.tsx`, `onPointerDown` de `Interactive`, remplacer `if (s.selectedId !== item.id) s.selectItem(item.id);` par :

```ts
    if (s.selectedId !== item.id) s.selectItem(item.id);
    // picking a device in the scene opens its settings
    if (useUi.getState().screen === 'studio') useUi.getState().setStudioPage('settings');
```

(importer `useUi` depuis `@/store/ui` si absent).

- [ ] **Step 12: Vérifier**

Run: `npm run typecheck && node scripts/check-studio.mjs`
Expected: les vérifications Appareils/Réglages/ajout/clic passent ; les titres des autres pages passent aussi (le corps est provisoire). Puis `node scripts/check-switch.mjs` (utilise « Changer » et « Carte de visite ») : doit toujours passer — si « Carte de visite » était cliqué dans la bibliothèque pour **remplacer**, adapter le script en tâche 10.

- [ ] **Step 13: Commit**

```bash
git add -A src/shell/Rail.tsx src/studio src/app/LibraryPanel.tsx src/app/PropertiesPanel.tsx src/app/panels/CompositionSection.tsx src/scene/interaction.tsx src/index.css src/i18n scripts/check-studio.mjs
git commit -m "Studio rail with Devices and Settings pages; library click adds"
```

---

### Task 7: Pages Ambiance, Décor, Lumière, Caméra, Texte, Marque + barre flottante

**Files:**
- Modify: `src/studio/pages.tsx`, `src/app/panels/ScenePanel.tsx`, `src/app/panels/TextPanel.tsx`, `src/app/Viewport.tsx`
- Create: `src/shell/FloatingBar.tsx`
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `scripts/check-studio.mjs` (complété)

**Interfaces:**
- Consumes: `RatioPicker` n'est plus utilisé ; `RATIOS` (`@/export/settings`), `useProject.setExport`, `useUi.resetView`, `variants.open()` (`@/variants/store`).
- Produces: `ScenePanel.tsx` exporte `Looks`, `DecorSection`, `BackgroundSection`, `LightSection`, `CameraSection`, `GroundSection` ; `TextPanel.tsx` exporte `TextPage`, `BrandPage` ; `FloatingBar()` avec `data-testid="floating-bar"`, bouton `open-variants` ; `StudioPageBody({ page })` complet.

- [ ] **Step 1: Compléter le test**

Ajouter avant `await done(...)` dans `scripts/check-studio.mjs` :

```js
const bar = page.getByTestId('floating-bar');
await bar.getByRole('radio', { name: '1:1' }).click();
check((await page.evaluate(() => window.__mockuplab.project.getState().export.ratio)) === '1:1', 'floating bar sets the ratio');
await bar.getByTestId('open-variants').click();
await page.waitForTimeout(500);
check(await page.getByTestId('variants').isVisible(), 'Ideas opens the variants grid');
await page.keyboard.press('Escape');
await rail.getByRole('tab', { name: 'Ambiance', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: /Chêne · mur blanc/ }).isVisible(), 'Ambiance lists the moods');
await rail.getByRole('tab', { name: 'Marque', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: /Planche de marque/ }).isVisible(), 'Brand page has the brand board');
await rail.getByRole('tab', { name: 'Texte', exact: true }).click();
check(await page.getByTestId('rail-page').getByRole('button', { name: 'Titre', exact: true }).isVisible(), 'Text page adds titles');
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-studio.mjs`
Expected: FAIL (`floating-bar` introuvable).

- [ ] **Step 3: Exports de `ScenePanel.tsx`**

Préfixer de `export` les fonctions `Looks`, `DecorSection`, `BackgroundSection`, `LightSection`, `CameraSection`, `GroundSection`. Supprimer la fonction `ScenePanel` (et l'import `useT` si inutilisé ensuite). Dans `Looks`, la `Section` prend le titre `t('page.ambiance')` → **retirer** le `Section` englobant : la page porte déjà le titre ; envelopper la grille dans `<div className="px-5 pt-3">…</div>`.

- [ ] **Step 4: `TextPage` et `BrandPage`**

Dans `src/app/panels/TextPanel.tsx` : renommer `TextPanel` en `TextPage`, retirer `<BrandKit />` et `<BrandShowcase add={add} />` de son rendu. Extraire l'ajout dans un hook partagé au-dessus de `TextPage` :

```tsx
function useAddOverlay() {
  const addOverlay = useProject((s) => s.addOverlay);
  const selectOverlay = useUi((s) => s.selectOverlay);
  return (o: Overlay) => {
    addOverlay(o);
    selectOverlay(o.id);
  };
}

/** Brand kit and everything generated from it. */
export function BrandPage() {
  const add = useAddOverlay();
  return (
    <>
      <BrandKit />
      <BrandShowcase add={add} />
    </>
  );
}
```

et dans `TextPage`, remplacer la définition locale de `add` par `const add = useAddOverlay();`. Retirer le `Advanced` autour de `text.dragHint` (garder le paragraphe seul).

- [ ] **Step 5: `src/studio/pages.tsx` complet**

```tsx
import { VideoSection } from '@/animation/VideoSection';
import { BackgroundSection, CameraSection, DecorSection, GroundSection, LightSection, Looks } from '@/app/panels/ScenePanel';
import { BrandPage, TextPage } from '@/app/panels/TextPanel';
import type { StudioPage } from '@/store/ui';
import { VideoPage } from './VideoPage';

/** Body of the rail pages built from the existing panel sections. */
export function StudioPageBody({ page }: { page: StudioPage }) {
  switch (page) {
    case 'ambiance':
      return <Looks />;
    case 'decor':
      return (
        <>
          <BackgroundSection />
          <DecorSection />
          <GroundSection />
        </>
      );
    case 'light':
      return <LightSection />;
    case 'camera':
      return <CameraSection />;
    case 'text':
      return <TextPage />;
    case 'brand':
      return <BrandPage />;
    case 'video':
      return <VideoPage />;
    default:
      return null;
  }
}
```

Créer `src/studio/VideoPage.tsx` provisoire : `export function VideoPage() { return <div className="flex flex-col gap-3.5 px-5 pt-3"><VideoSection /></div>; }` (finalisé en tâche 9). Retirer l'import inutile de `VideoSection` dans `pages.tsx`.

Les sections qui ne portent pas déjà le titre de la page gardent leur titre de groupe (`Décor`, `Fond`, `Sol` sur la page Décor). Pour Lumière et Caméra, la `Section` ferait doublon avec le titre de page : dans `LightSection` et `CameraSection`, passer le titre de la `Section` à `t('light.presets')` (FR « Préréglages », EN « Presets ») et `t('camera.angles')` (FR « Angles », EN « Angles »), clés à ajouter.

- [ ] **Step 6: `src/shell/FloatingBar.tsx`**

```tsx
import { Maximize2, Scan, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { RATIOS } from '@/export/settings';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { variants } from '@/variants/store';
import { Tooltip, cx } from '@/ui/primitives';

const btn = 'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg';

/** Output format, recenter, full-screen preview and Ideas, floating over the stage. */
export function FloatingBar({ onFullscreen }: { onFullscreen: () => void }) {
  const { t } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const setExport = useProject((s) => s.setExport);
  return (
    <div className="menu-surface pointer-events-auto flex items-center gap-1 rounded-[14px] p-1" data-testid="floating-bar">
      <div role="radiogroup" aria-label={t('props.ratio')} className="flex">
        {RATIOS.map((r) => (
          <Tooltip key={r.id} label={r.hint ?? r.label}>
            <button
              type="button"
              role="radio"
              aria-checked={ratio === r.id}
              aria-label={r.label}
              onClick={() => setExport({ ratio: r.id })}
              className={cx('h-8 rounded-[10px] px-2.5 font-mono text-[12px] transition-colors', ratio === r.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg')}
            >
              {r.label}
            </button>
          </Tooltip>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <button type="button" className={btn} onClick={() => useUi.getState().resetView()}>
        <Scan size={15} />
        {t('stage.resetView')}
      </button>
      <button type="button" className={btn} onClick={onFullscreen}>
        <Maximize2 size={15} />
        {t('stage.fullscreen')}
      </button>
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <button type="button" className={cx(btn, 'text-fg')} onClick={() => variants.open()} data-testid="open-variants">
        <Sparkles size={15} />
        {t('stage.ideas')}
      </button>
    </div>
  );
}
```

Clés : FR `'stage.fullscreen': 'Aperçu'`, `'stage.ideas': 'Idées'` ; EN `'stage.fullscreen': 'Preview'`, `'stage.ideas': 'Ideas'`.

- [ ] **Step 7: `Viewport` : barre flottante et plein écran**

Dans `src/app/Viewport.tsx`, dans `Viewport()` :
- supprimer le bloc `<div className="pointer-events-none absolute bottom-0 …">…</div>` (taille + légende) et le bloc `<div className="absolute right-3 top-3">…</div>` (bouton recentrer) ;
- ajouter `const main = useRef<HTMLElement>(null);` et fusionner avec `ref` du `useFrameSize` en passant `ref={(el) => { ref.current = el as HTMLDivElement; main.current = el; }}` — plus simple : envelopper `<main>` dans un `div` racine plein écran : 

```tsx
  return (
    <div ref={root} className="relative flex min-w-0 flex-1">
      <main ref={ref} className="stage-bg relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
        …frame inchangée…
        <DropOverlay />
        <ExportOverlay />
      </main>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <FloatingBar onFullscreen={() => void root.current?.requestFullscreen?.()} />
      </div>
    </div>
  );
```

  avec `const root = useRef<HTMLDivElement>(null);` et l'import de `FloatingBar` depuis `@/shell/FloatingBar`. Le `padY` de `useFrameSize` passe de 72 à 84 pour laisser la place à la barre.
- Dans `EmptyHint`, remonter la pastille : `bottom-5` → `bottom-20` ; remplacer `bg-black/55` par `menu-surface` et les couleurs `text-white/…` par `text-fg`/`text-fg-muted`.
- Supprimer les imports devenus inutiles (`Scan`, `IconButton`, `outputSize`, `videoSize`, `exportSettings`/`out` s'ils ne servent plus).

- [ ] **Step 8: Vérifier**

Run: `npm run typecheck && node scripts/check-studio.mjs && node scripts/check-variants.mjs`
Expected: tous les `✓` ; `check-variants` passe (il utilise `open-variants`).

- [ ] **Step 9: Commit**

```bash
git add -A src/studio src/shell/FloatingBar.tsx src/app/panels/ScenePanel.tsx src/app/panels/TextPanel.tsx src/app/Viewport.tsx src/i18n scripts/check-studio.mjs
git commit -m "Studio pages from the existing panels; floating bar with format and Ideas"
```

---

### Task 8: Écran Photo en rail

**Files:**
- Modify: `src/photo/PhotoScreen.tsx`, `src/photo/PhotoPanel.tsx`, `src/photo/PhotoLibrary.tsx`, `src/photo/PhotoView.tsx`
- Test: `scripts/check-photo-rail.mjs`

**Interfaces:**
- Consumes: `Rail`, `RailPage`, `useUi.photoPage/setPhotoPage`, `batch.open()` (`@/variants/batch`).
- Produces: `PhotoLibraryPage()` ; exports `ZonesSection`, `DesignSection`, `BlendSection`, `GeometrySection`, `PhotoSection` ; `PhotoScreen()` ; `data-testid` : `photo-rail`, `photo-library` (conservé sur le contenu de la page Photos), `open-batch` (bouton « Appliquer à plusieurs designs » de la page Design).

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-photo-rail.mjs — photo rail pages, templates listed once, batch from Design.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/photo' });
const rail = page.getByTestId('photo-rail');
const names = (await rail.getByRole('tab').allTextContents()).map((s) => s.trim());
check(JSON.stringify(names) === JSON.stringify(['Photos', 'Zones', 'Design', 'Rendu', 'Vidéo']), `rail: ${names}`);
const tplName = 'Tablette et téléphone';
check((await page.getByRole('button', { name: new RegExp(tplName) }).count()) === 1, 'each provided photo is listed once');
await page.getByTestId('photo-library').getByRole('button', { name: new RegExp(tplName) }).click();
await page.waitForTimeout(1500);
for (const n of names) {
  await rail.getByRole('tab', { name: n, exact: true }).click();
  await page.waitForTimeout(200);
  check((await page.getByTestId('rail-page').locator('[aria-expanded]').count()) === 0, `${n}: flat`);
}
await rail.getByRole('tab', { name: 'Design', exact: true }).click();
await page.getByTestId('open-batch').click();
await page.waitForTimeout(300);
check(await page.getByTestId('batch').isVisible(), 'batch dialog opens from Design');
await done(browser, errors);
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-photo-rail.mjs`
Expected: FAIL (`photo-rail` introuvable).

- [ ] **Step 3: `PhotoLibraryPage`**

Dans `src/photo/PhotoLibrary.tsx`, renommer `PhotoLibrary` en `PhotoLibraryPage` ; remplacer la racine `<aside className="flex w-[232px] …" data-testid="photo-library">` par `<div className="flex flex-col px-5 pt-3" data-testid="photo-library">`, supprimer le bloc d'en-tête (`photo.library` + `photo.library.hint`) et le `div` défilant (garder son contenu). Les titres « Photos fournies » / « Mes modèles » passent en `GroupTitle`. Grille des cartes : `grid-cols-1` → `grid-cols-2`.

- [ ] **Step 4: Une seule liste de photos fournies**

Dans `src/photo/PhotoView.tsx`, dans l'état vide (sans photo), supprimer la grille « Ou pars d'une photo fournie » ; garder le titre, le texte et le bouton « Importer ma photo », et ajouter sous le bouton un lien texte qui ouvre la page Photos : `<button type="button" className="text-[13px] font-medium text-accent" onClick={() => useUi.getState().setPhotoPage('photos')}>{t('photo.seeProvided')}</button>` (FR « Voir les photos fournies », EN « See the provided photos »). Le bloc à supprimer est celui qui affiche la clé `photo.empty.templates` (« Ou pars d'une photo fournie ») et la grille de `PHOTO_TEMPLATES` qui le suit ; ajouter la clé `photo.seeProvided` aux deux dictionnaires.

- [ ] **Step 5: Exports de `PhotoPanel.tsx` + bouton lot**

Préfixer de `export` : `PhotoSection`, `ZonesSection`, `DesignSection`, `BlendSection`, `GeometrySection`. Supprimer `PhotoPanel`. Dans `DesignSection`, ajouter à la fin du contenu :

```tsx
      <Button size="sm" onClick={() => batch.open()} data-testid="open-batch">
        <Layers size={13} />
        {t('photo.batch')}
      </Button>
```

(imports `batch` depuis `@/variants/batch`, `Layers` depuis lucide). Clés : FR `'photo.batch': 'Appliquer à plusieurs designs'`, EN `'photo.batch': 'Apply to several designs'`.

- [ ] **Step 6: `src/photo/PhotoScreen.tsx`**

```tsx
import { Blend, Clapperboard, ImageUp, Images, Scan } from 'lucide-react';
import { useT } from '@/i18n';
import { VideoPage } from '@/studio/VideoPage';
import { Rail, RailPage, type RailItem } from '@/shell/Rail';
import { useProject } from '@/store/project';
import { useUi, type PhotoPage } from '@/store/ui';
import { BlendSection, DesignSection, GeometrySection, PhotoSection, ZonesSection } from './PhotoPanel';
import { PhotoLibraryPage } from './PhotoLibrary';
import { PhotoView } from './PhotoView';

export function PhotoScreen() {
  const { t } = useT();
  const page = useUi((s) => s.photoPage);
  const setPage = useUi((s) => s.setPhotoPage);
  const zone = useProject((s) => s.photo.zones.find((z) => z.id === s.photo.selectedZoneId));
  const hasPhoto = useProject((s) => !!s.photo.assetId);
  const items: RailItem<PhotoPage>[] = [
    { id: 'photos', label: t('page.photos'), icon: <Images size={20} /> },
    { id: 'zones', label: t('page.zones'), icon: <Scan size={20} /> },
    { id: 'design', label: t('page.design'), icon: <ImageUp size={20} /> },
    { id: 'render', label: t('page.render'), icon: <Blend size={20} /> },
    { id: 'video', label: t('page.video'), icon: <Clapperboard size={20} /> },
  ];
  const needsZone = page === 'design' || page === 'render';
  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2">
      <Rail items={items} value={page} onChange={setPage} testId="photo-rail" />
      <RailPage title={items.find((i) => i.id === page)?.label ?? ''}>
        {page === 'photos' && (
          <>
            <PhotoLibraryPage />
            {hasPhoto && <PhotoSection />}
          </>
        )}
        {page === 'zones' && (hasPhoto ? <ZonesSection /> : <p className="px-5 py-3 text-[13px] text-fg-muted">{t('photo.panel.empty')}</p>)}
        {needsZone && !zone && <p className="px-5 py-3 text-[13px] text-fg-muted">{t('photo.pickZone')}</p>}
        {page === 'design' && zone && <DesignSection zone={zone} />}
        {page === 'render' && zone && (
          <>
            <BlendSection zone={zone} />
            <GeometrySection zone={zone} />
          </>
        )}
        {page === 'video' && <VideoPage />}
      </RailPage>
      <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[14px]">
        <PhotoView />
      </div>
    </div>
  );
}
```

Clés : FR `'photo.pickZone': 'Sélectionne une zone sur la photo (ou crée-en une dans Zones).'`, EN `'photo.pickZone': 'Select a zone on the photo (or create one in Zones).'`.

Dans `PhotoView.tsx`, remplacer la classe de fond `stage-dots` (s'il y en a une) par `stage-bg`.

- [ ] **Step 7: Vérifier**

Run: `npm run typecheck && node scripts/check-photo-rail.mjs`
Expected: tous les `✓`.

- [ ] **Step 8: Commit**

```bash
git add -A src/photo src/i18n scripts/check-photo-rail.mjs
git commit -m "Photo screen with its rail; provided photos listed once; batch from Design"
```

---

### Task 9: Fenêtre Exporter et page Vidéo

**Files:**
- Modify: `src/shell/ExportSheet.tsx`, `src/studio/VideoPage.tsx`, `src/app/shortcuts.ts`
- Test: `scripts/check-export.mjs`

**Interfaces:**
- Consumes: `ExportForm` (tâche 6), `useUi.exportOpen/setExportOpen`, `useProject.setExport`, `Sheet`.
- Produces: `ExportSheet()` (`data-testid="export-sheet"`), `VideoPage()` qui met `export.kind = 'video'` à l'ouverture et `'image'` à la fermeture.

- [ ] **Step 1: Écrire le test**

```js
// scripts/check-export.mjs — the Export sheet downloads an image; leaving Video goes back to images.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ hash: '#/studio' });
const rail = page.getByTestId('studio-rail');
await rail.getByRole('tab', { name: 'Vidéo', exact: true }).click();
check((await page.evaluate(() => window.__mockuplab.project.getState().export.kind)) === 'video', 'Video page → video kind');
await rail.getByRole('tab', { name: 'Lumière', exact: true }).click();
check((await page.evaluate(() => window.__mockuplab.project.getState().export.kind)) === 'image', 'leaving Video → image kind');
await page.getByTestId('top-export').click();
const sheet = page.getByTestId('export-sheet');
check(await sheet.isVisible(), 'Export opens the sheet');
await sheet.getByRole('radio', { name: '1080p', exact: true }).click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), sheet.getByRole('button', { name: /Télécharger/ }).click()]);
check(/\.(png|jpg|webp)$/.test(dl.suggestedFilename()), `downloaded ${dl.suggestedFilename()}`);
await done(browser, errors);
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node scripts/check-export.mjs`
Expected: FAIL (`export-sheet` introuvable).

- [ ] **Step 3: `src/shell/ExportSheet.tsx`**

```tsx
import { Download } from 'lucide-react';
import { useT } from '@/i18n';
import { exportImage } from '@/export/exportImage';
import { ExportForm } from '@/app/PropertiesPanel';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Sheet } from '@/ui/primitives';

/** The one place to export an image: format, size, quality, then download. */
export function ExportSheet() {
  const { t } = useT();
  const open = useUi((s) => s.exportOpen);
  const exporting = useUi((s) => s.exporting);
  const setOpen = useUi((s) => s.setExportOpen);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t('export.title')}
      testId="export-sheet"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!!exporting}
            onClick={() => {
              useProject.getState().setExport({ kind: 'image' });
              setOpen(false);
              void exportImage();
            }}
          >
            <Download size={16} strokeWidth={2.2} />
            {t('export.download')}
          </Button>
        </>
      }
    >
      <ExportForm />
    </Sheet>
  );
}
```

Clés : FR `'export.title': 'Exporter l’image'`, `'export.download': 'Télécharger'` ; EN `'export.title': 'Export the image'`, `'export.download': 'Download'`. Dans `ExportForm`, retirer le gros bouton `export.cta` (le pied de la fenêtre le remplace).

- [ ] **Step 4: `src/studio/VideoPage.tsx`**

```tsx
import { useEffect } from 'react';
import { VideoSection } from '@/animation/VideoSection';
import { useProject } from '@/store/project';

/** Video lives in its own page; while it is open, exports are videos. */
export function VideoPage() {
  useEffect(() => {
    useProject.getState().setExport({ kind: 'video' });
    return () => useProject.getState().setExport({ kind: 'image' });
  }, []);
  return <div className="flex flex-col gap-3.5 px-5 pt-3">{<VideoSection />}</div>;
}
```

Vérifier que `setExport` ne crée pas d'entrée d'historique gênante : si `kind` est suivi par zundo et que l'aller-retour Vidéo ajoute deux pas d'annulation, entourer les deux appels de `useProject.temporal.getState().pause()` / `.resume()`.

- [ ] **Step 5: ⌘E ouvre la fenêtre en mode image**

Dans `src/app/shortcuts.ts`, remplacer la branche `mod && key === 'e'` par :

```ts
  } else if (mod && key === 'e') {
    e.preventDefault();
    if (useProject.getState().export.kind === 'video') exportImage();
    else ui.setExportOpen(true);
```

Mettre à jour le libellé `'sc.export'` : FR `'Exporter (ouvre la fenêtre, ou exporte la vidéo sur la page Vidéo)'` ; EN `'Export (opens the dialog, or exports the video on the Video page)'`.

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && node scripts/check-export.mjs && node scripts/check-video.mjs`
Expected: tous les `✓` ; `check-video` adapté si besoin (il clique `video-preview`, toujours présent dans la page Vidéo — il faut d'abord ouvrir la page : ajouter `await page.goto('http://localhost:5173/#/studio'); await page.getByTestId('studio-rail').getByRole('tab', { name: 'Vidéo', exact: true }).click();` avant le clic, en tâche 10 si le script échoue).

- [ ] **Step 7: Commit**

```bash
git add -A src/shell/ExportSheet.tsx src/studio/VideoPage.tsx src/app/shortcuts.ts src/app/PropertiesPanel.tsx src/i18n scripts/check-export.mjs
git commit -m "Export sheet; video in its own page"
```

---

### Task 10: Fenêtres restylées et scripts existants adaptés

**Files:**
- Modify: `src/variants/VariantsDialog.tsx`, `src/variants/BatchDialog.tsx`, `src/app/HelpDialog.tsx`, `src/app/Toaster.tsx`, `src/app/App.tsx` (`NoWebGL`, `SmallScreenNotice`), `src/app/ModelSwitcher.tsx`
- Modify: `scripts/check-a11y.mjs`, `check-prod.mjs`, `check-photo-ui.mjs`, `check-photo.mjs`, `check-photo-own.mjs`, `check-batch-photo.mjs`, `check-switch.mjs`, `check-video.mjs`, `check-glb.mjs`, `check-composition.mjs`, `check-walls.mjs`, `scenes.mjs`, `shoot.mjs`, `gallery.mjs`

**Interfaces:**
- Consumes: classes `.menu-surface`, `.glass`, `font-display` ; `navigate`.
- Produces: tous les scripts existants passent sur la nouvelle interface.

- [ ] **Step 1: Restyler les fenêtres et menus**

Dans chacun des fichiers listés, remplacer les classes de conteneur de fenêtre/menu :
- `rounded-2xl bg-surface p-5 shadow-2xl ring-1 ring-line-strong` → `menu-surface rounded-[18px] p-6` ;
- `rounded-xl bg-surface-3 p-1 shadow-2xl ring-1 ring-line-strong` → `menu-surface rounded-[14px] p-1.5` ;
- en-têtes de fenêtre `text-[15px] font-semibold` → `font-display text-[20px] font-bold` ;
- éléments de menu `rounded-md … data-[highlighted]:bg-surface-4` → `rounded-[8px] … data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg` ;
- étiquettes de menu `text-[10.5px] font-semibold uppercase tracking-[0.08em]` → `text-[11.5px] font-medium` ;
- icônes de fenêtre sur fond `bg-accent` orange (Variantes, Lot) → `bg-fg text-bg`.
Rechercher les restes : `grep -rn "uppercase tracking" src` doit ne rien renvoyer hors `src/models` et `src/lib` (dessins de marque).

- [ ] **Step 2: Adapter les scripts existants**

Remplacements systématiques dans `scripts/*.mjs` :
- `getByTestId('mode-switch').getByRole('radio', { name: '3D' })` → `getByTestId('mode-switch').getByRole('radio', { name: 'Studio' })` ;
- `p.goto('http://localhost:5173/')` suivi d'un travail en 3D → `p.goto('http://localhost:5173/#/studio')` ; en photo → `#/photo` (et supprimer le clic sur le sélecteur « Photo » qui suit) ;
- `getByRole('radio', { name: 'Scène', exact: true })` (onglet) → `getByTestId('studio-rail').getByRole('tab', { name: 'Ambiance', exact: true })` quand le script cherche une ambiance (`check-prod` : « Chêne · mur blanc »), sinon `'Décor'` ;
- `getByRole('radio', { name: 'Export', exact: true })` + `'1080p'` + bouton « Exporter l'image » (`check-prod`) → `getByTestId('top-export').click()` puis `getByTestId('export-sheet').getByRole('radio', { name: '1080p', exact: true })` puis `getByTestId('export-sheet').getByRole('button', { name: /Télécharger/ })` ;
- `getByRole('button', { name: 'Réinitialiser' })` (`check-switch`) → `getByTestId('more-menu').click()` puis `getByRole('menuitem', { name: /Recommencer/ })` ;
- `getByRole('button', { name: 'Carte de visite' })` dans `check-switch` : le script cherchait à **remplacer** l'appareil via la bibliothèque → passer par la page Réglages : `getByTestId('studio-rail').getByRole('tab', { name: 'Réglages', exact: true })`, bouton `/Changer/`, puis `getByRole('menuitem', { name: 'Carte de visite' })` ;
- `getByTestId('open-batch')` en photo (`check-batch-photo`) → ouvrir d'abord `getByTestId('photo-rail').getByRole('tab', { name: 'Design', exact: true })` ;
- `getByTestId('import-glb')` (`check-glb`) → ouvrir d'abord la page Appareils puis la puce « Mes modèles » (`getByTestId('library-tabs').getByRole('button', { name: 'Mes modèles 3D' })`) ;
- `getByTestId('video-preview')` (`check-video`) → ouvrir d'abord la page Vidéo du rail ;
- `getByRole('button', { name: 'Essayer un exemple' })` : inchangé (pastille du canvas) ;
- `check-a11y` : remplacer la boucle sur les onglets par une boucle sur les 9 pages du rail Studio puis les 5 pages du rail Photo, plus l'accueil :

```js
await p.goto('http://localhost:5173/#/');
await p.waitForTimeout(500);
report.push(await sweep('Accueil'));
await p.goto('http://localhost:5173/#/studio');
await p.waitForTimeout(800);
for (const tab of ['Appareils', 'Réglages', 'Ambiance', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']) {
  await p.getByTestId('studio-rail').getByRole('tab', { name: tab, exact: true }).click();
  await p.waitForTimeout(300);
  report.push(await sweep(`Studio · ${tab}`));
}
await p.goto('http://localhost:5173/#/photo');
await p.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
await p.waitForTimeout(800);
for (const tab of ['Photos', 'Zones', 'Design', 'Rendu', 'Vidéo']) {
  await p.getByTestId('photo-rail').getByRole('tab', { name: tab, exact: true }).click();
  await p.waitForTimeout(300);
  report.push(await sweep(`Photo · ${tab}`));
}
```

  et terminer par `if (report.some((r) => r.bad.length)) process.exitCode = 1;`.

- [ ] **Step 3: Lancer toute la suite**

Run (serveur de dev lancé) :

```bash
for s in check-theme check-nav check-home check-studio check-export check-photo-rail check-a11y check-switch check-variants check-batch-photo check-video check-glb check-photo check-photo-ui check-photo-own check-composition check-walls; do echo "== $s"; node scripts/$s.mjs || echo "FAILED $s"; done
```

Expected: aucun `FAILED`, aucun `✗`, `check-a11y` : `ok` partout. Corriger chaque échec dans le script (sélecteur) **ou** dans l'app (vraie régression) avant de continuer.

- [ ] **Step 4: Commit**

```bash
git add -A src scripts
git commit -m "Dialogs and menus restyled; existing checks follow the new UI"
```

---

### Task 11: Audit de finition, nettoyage, captures

**Files:**
- Modify: selon les constats (fichiers de `src/shell`, `src/home`, `src/studio`, `src/photo`, `src/ui`)
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts` (clés inutilisées supprimées)
- Create: `scripts/shoot-ui.mjs`

**Interfaces:**
- Produces: `node scripts/shoot-ui.mjs` → `out/ui/{home,studio-<page>,photo-<page>,export}-{light,dark}.png`.

- [ ] **Step 1: Script de captures**

```js
// scripts/shoot-ui.mjs — every screen and rail page, light and dark, into out/ui/.
import { mkdirSync } from 'node:fs';
import { openApp } from './lib/app.mjs';
mkdirSync('out/ui', { recursive: true });
for (const scheme of ['light', 'dark']) {
  const { browser, page } = await openApp({ colorScheme: scheme });
  const shot = (name) => page.screenshot({ path: `out/ui/${name}-${scheme}.png` });
  await shot('home');
  await page.evaluate(() => (location.hash = '#/studio'));
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Essayer un exemple' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  for (const tab of ['Appareils', 'Réglages', 'Ambiance', 'Décor', 'Lumière', 'Caméra', 'Texte', 'Marque', 'Vidéo']) {
    await page.getByTestId('studio-rail').getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
    await shot(`studio-${tab}`);
  }
  await page.getByTestId('top-export').click();
  await page.waitForTimeout(400);
  await shot('export');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = '#/photo'));
  await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
  await page.waitForTimeout(1500);
  for (const tab of ['Photos', 'Zones', 'Design', 'Rendu']) {
    await page.getByTestId('photo-rail').getByRole('tab', { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
    await shot(`photo-${tab}`);
  }
  await browser.close();
}
console.log('out/ui written');
```

Run: `node scripts/shoot-ui.mjs` puis **regarder chaque image** (Read sur les PNG).

- [ ] **Step 2: Audit avec les skills**

Charger successivement `impeccable` (mode audit), `web-design-guidelines` (sur `src/shell src/home src/studio src/photo src/ui`) et `design:accessibility-review`. Pour chaque constat concret (contraste < AA, cible < 28 px, focus invisible, texte tronqué, incohérence d'espacement entre pages, état vide manquant), corriger dans le fichier concerné. Vérifier en particulier :
- contraste `--fg-subtle` sur `--surface` en clair (`#aeaeb2` sur blanc ≈ 2,1:1) : ne l'utiliser que pour du texte non essentiel ≥ 12 px, sinon passer à `--fg-muted` ;
- lisibilité des panneaux vitrés au-dessus d'un décor clair en sombre (texte toujours ≥ 4,5:1 : sinon augmenter l'opacité de `--surface` à 0,7) ;
- le bouton primaire blanc en sombre a un état focus visible.

- [ ] **Step 3: Nettoyer l'i18n**

Lister les clés non utilisées :

```bash
node -e "const fr=require('fs').readFileSync('src/i18n/fr.ts','utf8');const keys=[...fr.matchAll(/^  '([^']+)':/gm)].map(m=>m[1]);const {execSync}=require('child_process');const src=execSync('grep -rhoE \"[a-zA-Z]+\\.[a-zA-Z.]+\" src --include=*.ts --include=*.tsx').toString();console.log(keys.filter(k=>!src.includes(k)).join('\n'))"
```

Supprimer de `fr.ts` et `en.ts` les clés réellement mortes (anciens onglets `tab.*`, `mode.scene`, `library.hint`, `library.replace`, `top.theme`, `top.lang`…) en vérifiant chacune avec `grep -rn "'<clé>'" src` (certaines clés sont construites dynamiquement, ex. `` `camera.${…}` `` : les garder).

- [ ] **Step 4: Vérification complète**

Run: `npm run build` puis la boucle de la tâche 10 Step 3, puis `node scripts/shoot-ui.mjs`.
Expected: build OK, aucun `FAILED`, captures relues.

- [ ] **Step 5: Commit et arrêt**

```bash
git add -A src scripts
git commit -m "Phase 1 polish: audit fixes, i18n cleanup, UI screenshots"
```

Puis **s'arrêter** : présenter les captures `out/ui/*` (clair et sombre) à l'utilisateur et attendre sa validation avant la phase 2. Ne pas pousser.
