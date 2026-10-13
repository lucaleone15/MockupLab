# Phases 0–1 : tests d'usage et modes clairs — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place des tests d'usage joués comme un humain (phase 0, audit initial), puis rendre le rôle de chaque mode évident, avec le Studio comme mode principal et plus de dépôt direct sur l'accueil (phase 1).

**Architecture:** Les tests d'usage sont des scripts Playwright dans `scripts/usage/`, qui n'agissent que via ce qui est visible (rôles, libellés, textes) et produisent captures + `summary.json` par profil. Les modes : textes de rôle centralisés dans l'i18n (`mode.<screen>.role`), réutilisés par l'accueil, l'en-tête (infobulles) et un petit composant `ModeRole` dans l'état vide de chaque mode.

**Tech Stack:** Vite 8, React 19, TypeScript, Tailwind 4, zustand, Playwright (scripts `node`), dev server sur :5173.

**Spec:** `docs/superpowers/specs/2026-10-13-usage-modes-fond-print-social-design.md` (sections « Phases », 1 et 7). Les phases 2 à 5 auront chacune leur propre plan après le retour de l'utilisateur.

## Global Constraints

- UI en français et en anglais : toute nouvelle chaîne existe dans `src/i18n/fr.ts` **et** `src/i18n/en.ts` (le type `I18nKey` vient de `fr`).
- Tutoiement en français, ton des chaînes existantes.
- Ordre des modes partout : **Studio · Rapide · Projet · Photo**.
- Pas de dépôt ni de collage d'image sur l'accueil : on choisit d'abord un mode.
- Un commit par phase (ou par tâche), message en anglais, **sans** ligne Co-Authored-By. Pas de push sans l'accord de l'utilisateur.
- Tests d'usage : jamais `window.__mockuplab` pour **agir** (seulement pour attendre que l'app soit prête via `openApp`).
- Arrêt pour le retour de l'utilisateur à la fin de la phase 0 et à la fin de la phase 1.

## Review Focus

- Fichier déposé ou collé sur l'accueil → il ne doit rien se perdre en silence : un toast « Choisis d'abord un mode… » s'affiche.
- Navigation clavier dans l'en-tête (flèches) → suit le nouvel ordre Studio · Rapide · Projet · Photo.
- Anglais → aucune chaîne française qui fuit dans l'accueil, l'en-tête, les états vides.
- Petite fenêtre (1280×720) → la carte Studio et le bouton « Ouvrir le Studio » restent dans le premier écran.
- Fichier `.glb` déposé sur l'accueil → toujours importé comme modèle (comportement existant inchangé).

---

## Phase 0 — Audit d'usage initial

### Task 1: Harnais des tests d'usage

**Files:**
- Create: `scripts/usage/lib.mjs`
- Create: `scripts/usage/run-all.mjs`

**Interfaces:**
- Consumes: `openApp`, `done` de `scripts/lib/app.mjs`.
- Produces: `journey(name, goal, run, opts?)` où `run(u)` reçoit `u = { page, step(label, fn), friction(kind, text), upload(locator, file) }` ; écrit `out/usage/<name>/NN-<slug>.png` et `out/usage/<name>/summary.json` `{ name, goal, ok, ms, clicks, steps:[{label, ms, clicks}], frictions:[{kind, text, step}] }`. `kind ∈ 'bloquant' | 'surprenant' | 'lent'`.

- [ ] **Step 1: Écrire `scripts/usage/lib.mjs`**

```js
// scripts/usage/lib.mjs — a user journey, played only through what is visible on screen.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { openApp } from '../lib/app.mjs';

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function journey(name, goal, run, opts = {}) {
  const dir = `out/usage/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { browser, page, errors } = await openApp({ colorScheme: 'light', ...opts });
  // every real (trusted) click counts, wherever it lands
  await page.evaluate(() => {
    window.__usageClicks = 0;
    addEventListener('click', (e) => e.isTrusted && window.__usageClicks++, true);
  });
  const clicks = () => page.evaluate(() => window.__usageClicks ?? 0);
  const steps = [];
  const frictions = [];
  let current = '';
  const t0 = Date.now();
  let ok = true;
  const u = {
    page,
    friction: (kind, text) => frictions.push({ kind, text, step: current }),
    async step(label, fn, { slowMs = 4000 } = {}) {
      current = label;
      const s = Date.now();
      const c = await clicks();
      try {
        await fn();
      } catch (e) {
        frictions.push({ kind: 'bloquant', text: `${label} : ${e.message.split('\n')[0]}`, step: label });
        await page.screenshot({ path: `${dir}/${String(steps.length + 1).padStart(2, '0')}-ECHEC-${slug(label)}.png` });
        throw e;
      }
      const ms = Date.now() - s;
      if (ms > slowMs) frictions.push({ kind: 'lent', text: `${label} : ${(ms / 1000).toFixed(1)} s`, step: label });
      steps.push({ label, ms, clicks: (await clicks()) - c });
      await page.screenshot({ path: `${dir}/${String(steps.length).padStart(2, '0')}-${slug(label)}.png` });
    },
    async upload(trigger, file) {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), trigger.click()]);
      await chooser.setFiles(file);
    },
  };
  try {
    await run(u);
  } catch {
    ok = false;
  }
  for (const e of errors) frictions.push({ kind: 'bloquant', text: `erreur console : ${e}`, step: '' });
  const summary = { name, goal, ok, ms: Date.now() - t0, clicks: await clicks().catch(() => -1), steps, frictions };
  writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`${ok ? '✓' : '✗'} ${name} — ${(summary.ms / 1000).toFixed(1)} s, ${summary.clicks} clics, ${frictions.length} friction(s)`);
  for (const f of frictions) console.log(`   [${f.kind}] ${f.text}`);
  await browser.close();
  if (!ok) process.exitCode = 1;
  return summary;
}
```

- [ ] **Step 2: Écrire `scripts/usage/run-all.mjs`**

```js
// scripts/usage/run-all.mjs — every user journey, one after the other (dev server on :5173).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const only = process.argv[2];
const files = readdirSync('scripts/usage').filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.includes(only))).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync('node', [`scripts/usage/${f}`], { stdio: 'inherit' });
  if (r.status) failed++;
}
console.log(`\n${files.length - failed}/${files.length} parcours aboutis — captures et summary.json dans out/usage/`);
process.exitCode = failed ? 1 : 0;
```

- [ ] **Step 3: Vérifier que le harnais tourne**

Créer un parcours jetable `scripts/usage/00-smoke.mjs` :

```js
import { journey } from './lib.mjs';
await journey('smoke', 'ouvrir l’app', async (u) => {
  await u.step('Accueil', () => u.page.getByRole('heading', { level: 1 }).waitFor());
});
```

Run: `npm run dev` (en arrière-plan) puis `node scripts/usage/00-smoke.mjs`
Expected: `✓ smoke — … 0 friction(s)` et `out/usage/smoke/01-accueil.png`. Supprimer `00-smoke.mjs` ensuite.

- [ ] **Step 4: Commit**

```bash
git add scripts/usage/lib.mjs scripts/usage/run-all.mjs
git commit -m "Usage tests: journey harness (visible UI only, screenshots, clicks, frictions)"
```

### Task 2: Les cinq parcours

**Files:**
- Create: `scripts/usage/01-debutant.mjs`, `02-graphiste-print.mjs`, `03-freelance-pack.mjs`, `04-createur-video.mjs`, `05-photo.mjs`

**Interfaces:**
- Consumes: `journey` (Task 1). Fichiers d'exemple dans `public/samples/`.

Règle pour chaque script : uniquement `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder` sur les libellés **français** visibles (pas de `getByTestId`, pas de `__mockuplab`). Si un libellé n'est pas trouvable par un humain (icône sans texte, action cachée), le script le note avec `u.friction('surprenant', …)` puis passe par le chemin qu'un humain finirait par trouver. Chaque `step` a un timeout Playwright de 8 s (`{ timeout: 8000 }` sur les `waitFor`/`click`). Avant chaque script, lancer l'app dans un navigateur à la main pour relever les libellés exacts.

- [ ] **Step 1: `01-debutant.mjs` — un post Insta en moins de 2 minutes**

```js
// Beginner in a hurry: from the home page to an Instagram post exported, under 2 minutes.
import { journey } from './lib.mjs';
const s = await journey('debutant', 'Une capture d’appli → un post Insta 4:5 téléchargé, < 2 min', async (u) => {
  const p = u.page;
  await u.step('Accueil', () => p.getByRole('heading', { level: 1 }).waitFor());
  await u.step('Importer sa capture', () => u.upload(p.getByRole('button', { name: /Dépose tes images|Ouvrir le Studio/ }).first(), 'public/samples/sample-app.png'));
  await u.step('Choisir le format Insta 4:5', () => p.getByRole('button', { name: '4:5', exact: true }).first().click({ timeout: 8000 }));
  await u.step('Voir un rendu', () => p.getByRole('img').first().waitFor({ timeout: 15000 }), { slowMs: 6000 });
  await u.step('Télécharger', async () => {
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.getByRole('button', { name: /Télécharger|Exporter/ }).first().click()]);
    if (!/\.(png|jpe?g|webp)$/i.test(d.suggestedFilename())) u.friction('surprenant', `fichier téléchargé : ${d.suggestedFilename()}`);
  });
});
if (s.ms > 120000) console.log('   [lent] plus de 2 minutes');
```

(Le premier bouton de la page d'accueil change en phase 1 : la regex accepte les deux libellés ; en phase 1 le parcours passe par le Studio et le bouton Exporter du haut.)

- [ ] **Step 2: `02-graphiste-print.mjs` — affiche + flyer + carte de visite**

Étapes (`u.step`), dans cet ordre :
1. « Ouvrir le Studio » : carte ou onglet Studio.
2. « Ajouter une affiche » : onglet *Appareils* → filtre *Print* → carte *Affiche*.
3. « Mettre son visuel sur l'affiche » : `upload` via « parcourir » avec `public/samples/sample-poster.png`.
4. « Choisir le format A1 » : choix *Format* → *A1* dans les réglages de l'appareil.
5. « Changer la couleur du mur » : trouver *Couleur du mur* → *Sauge* (en phase 2 ce réglage disparaît : le parcours changera la couleur du **fond**).
6. « Ajouter un flyer » et « Ajouter une carte de visite » : même filtre *Print*.
7. « Disposer » : bouton *Disposer*.
8. « Exporter en 4K » : bouton *Exporter* → *4K* → téléchargement attendu (`waitForEvent('download', { timeout: 60000 })`, `slowMs: 20000`).

- [ ] **Step 3: `03-freelance-pack.mjs` — pack client en mode Projet**

1. « Ouvrir Projet » : carte ou onglet *Projet*.
2. « Ajouter les visuels du client » : `upload` de `sample-web.png`, `sample-app.png`, `sample-poster.png`, `sample-card-front.png` (`setFiles([...])`).
3. « Choisir un style » : cliquer le 2e style proposé.
4. « Remplir la marque » : chercher où mettre logo et couleurs (*Marque*) ; `friction('surprenant', …)` si ce n'est pas trouvable depuis Projet.
5. « Voir la planche » : la planche de présentation est visible.
6. « Télécharger le pack » : *Télécharger le pack (.zip)* → téléchargement `.zip` (`timeout: 120000`, `slowMs: 45000`).

- [ ] **Step 4: `04-createur-video.mjs` — Reel vertical**

1. « Ouvrir le Studio ». 2. « Mettre sa capture » (`sample-app.png`). 3. « Format 9:16 » (barre flottante). 4. « Onglet Vidéo ». 5. « Choisir un plan cinéma » (premier plan de la liste). 6. « Exporter la vidéo MP4 » : bouton d'export vidéo → téléchargement `.mp4` (`timeout: 180000`, `slowMs: 60000`).

- [ ] **Step 5: `05-photo.mjs` — design sur une vraie photo**

1. « Ouvrir Photo ». 2. « Prendre une photo fournie » (*Voir les photos fournies* → première). 3. « Poser son design » (`sample-web.png`). 4. « Exporter » → téléchargement image.

- [ ] **Step 6: Lancer tous les parcours**

Run: `node scripts/usage/run-all.mjs`
Expected: un dossier par profil dans `out/usage/`, chacun avec ses captures et `summary.json`. Un parcours qui échoue n'est **pas** corrigé à ce stade : c'est un résultat d'audit.

- [ ] **Step 7: Commit**

```bash
git add scripts/usage/0*.mjs
git commit -m "Usage tests: five journeys (beginner, print designer, freelance pack, video creator, photo)"
```

### Task 3: Rapport d'audit initial

**Files:**
- Create: `docs/usage/2026-10-13-audit-initial.md`

- [ ] **Step 1: Relire toutes les captures** de `out/usage/*/` (outil Read sur chaque PNG) et les `summary.json`.

- [ ] **Step 2: Écrire le rapport** avec cette structure :

```markdown
# Audit d'usage initial — 2026-10-13

| Parcours | Abouti | Temps | Clics | Frictions |
|---|---|---|---|---|
| Débutant pressé | … | … | … | … |

## Frictions, de la plus grave à la moins grave
1. **[bloquant] …** — parcours, étape, capture `out/usage/…/NN-….png`, ce qu'un humain voit, ce qu'il attendait.

## Ce qui sera corrigé par les phases prévues
- … → phase N

## Frictions hors phases (proposées à l'utilisateur)
- …
```

- [ ] **Step 3: Commit et arrêt**

```bash
git add docs/usage/2026-10-13-audit-initial.md
git commit -m "Usage audit: baseline report"
```

**STOP** — présenter le rapport à l'utilisateur (tableau + 5 frictions principales) et attendre son retour avant la phase 1.

---

## Phase 1 — Modes clairs, Studio en premier

### Task 4: Textes des modes (fr/en)

**Files:**
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`

**Interfaces:**
- Produces: clés `mode.studio.role`, `mode.quick.role`, `mode.project.role`, `mode.photo.role`, `home.openStudio`, `home.otherModes`, `home.main`, `home.pickMode`, `stage.ideasHint` ; supprime `home.drop`, `home.dropHint`, `home.quick`, `home.project`, `home.studio`, `home.photo`.

- [ ] **Step 1: Ajouter / modifier dans `fr.ts`**

```ts
  'mode.studio.role': 'Ta scène 3D, réglée dans le moindre détail : appareils, décor, lumière, caméra, vidéo.',
  'mode.quick.role': 'Une image → des mock-ups tout faits. Tu choisis, tu télécharges.',
  'mode.project.role': 'Tous les visuels d’un client → un pack assorti et une planche.',
  'mode.photo.role': 'Ton design posé sur une vraie photo.',
  'home.openStudio': 'Ouvrir le Studio',
  'home.otherModes': 'ou choisis un autre mode',
  'home.main': 'Mode principal',
  'home.pickMode': 'Choisis d’abord un mode, puis dépose ton image dedans.',
  'stage.ideasHint': 'Garde tes appareils et tes textes, et fait varier l’angle, la lumière et le décor.',
```

Remplacer les valeurs :
`'home.lead'` → `'MockupLab place tes captures, tes sites et tes affiches sur des appareils et des objets réalistes en 3D, ou sur de vraies photos. Gratuit, et tout se passe dans ton navigateur.'` ;
`'home.leadDesktop'` → même texte avec `'Tout reste sur ton ordinateur.'` à la place de la dernière phrase ;
`'stage.ideas'` → `'Varier ma scène'` ; `'quick.customize'` → `'Affiner dans le Studio'` ; `'project.openStudio'` → `'Affiner dans le Studio'`.
Supprimer `home.drop`, `home.dropHint`, `home.quick`, `home.project`, `home.studio`, `home.photo`.

- [ ] **Step 2: Même chose dans `en.ts`**

```ts
  'mode.studio.role': 'Your 3D scene, tuned down to the last detail: devices, set, light, camera, video.',
  'mode.quick.role': 'One image → ready-made mock-ups. Pick, download.',
  'mode.project.role': 'All of a client’s visuals → a matching pack and a board.',
  'mode.photo.role': 'Your design placed on a real photo.',
  'home.openStudio': 'Open the Studio',
  'home.otherModes': 'or pick another mode',
  'home.main': 'Main mode',
  'home.pickMode': 'Pick a mode first, then drop your image in it.',
  'stage.ideasHint': 'Keeps your devices and text, and varies the angle, light and set.',
```

`'home.lead'` → `'MockupLab puts your screenshots, websites and posters on realistic 3D devices and objects, or on real photos. Free, and it all happens in your browser.'` ; `'home.leadDesktop'` idem avec `'Everything stays on your computer.'` ; `'stage.ideas'` → `'Vary my scene'` ; `'quick.customize'` et `'project.openStudio'` → `'Refine in Studio'`. Supprimer les mêmes clés.

- [ ] **Step 3: Typecheck** — Run: `npm run typecheck`. Expected: erreurs **uniquement** dans `src/home/Home.tsx` (clés supprimées) ; elles disparaissent à la Task 5.

### Task 5: Accueil sans dépôt, Studio en premier

**Files:**
- Modify: `src/home/Home.tsx`
- Modify: `src/app/shortcuts.ts:11,152-158`
- Modify: `scripts/check-home.mjs`

**Interfaces:**
- Consumes: clés de la Task 4, `navigate` (`src/shell/route.ts`), `toast` (`src/store/toasts.ts`).
- Produces: `MODE_ORDER: Screen[] = ['studio', 'quick', 'project', 'photo']` exporté depuis `src/shell/route.ts` (utilisé par la Task 6). `importFromHome` disparaît.

- [ ] **Step 1: Réécrire le test `scripts/check-home.mjs`** (il doit échouer avant l'implémentation)

```js
// scripts/check-home.mjs — no drop on home: pick a mode first; Studio first and biggest; resume.
import { openApp, check, done } from './lib/app.mjs';
const { browser, page, errors } = await openApp({ viewport: { width: 1280, height: 720 } });
check(await page.getByTestId('home').isVisible(), 'home shown on first visit');
check((await page.getByTestId('home-drop').count()) === 0, 'no drop zone on home');
const cta = page.getByRole('button', { name: 'Ouvrir le Studio' });
const box = await cta.boundingBox();
check(!!box && box.y + box.height <= 720, 'Open the Studio is in the first screen at 1280×720');
const order = await page.locator('[data-testid^="mode-card-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(10)));
check(order.join() === 'studio,quick,project,photo', `mode cards in order (${order})`);
const [studioCard, quickCard] = await Promise.all([page.getByTestId('mode-card-studio').boundingBox(), page.getByTestId('mode-card-quick').boundingBox()]);
check(studioCard.width > quickCard.width * 1.5, 'Studio card is the big one');
for (const m of ['studio', 'quick', 'project', 'photo']) check((await page.getByTestId(`mode-card-${m}`).innerText()).length > 20, `${m} card explains its role`);
// pasting on home does not import: it asks to pick a mode
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const png = await new Promise((res) => c.toBlob(res, 'image/png'));
  const dt = new DataTransfer();
  dt.items.add(new File([png], 'paste.png', { type: 'image/png' }));
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
});
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'home', 'paste on home stays on home');
check(await page.getByText('Choisis d’abord un mode').isVisible(), 'paste on home says to pick a mode');
await cta.click();
await page.waitForTimeout(400);
check((await page.evaluate(() => window.__mockuplab.ui.getState().screen)) === 'studio', 'Open the Studio opens the Studio');
// a saved photo project resumes into the photo screen
await page.evaluate(() => (location.hash = '#/photo'));
await page.waitForTimeout(300);
await page.evaluate(async () => window.__mockuplab.photo.applyTemplate(window.__mockuplab.photo.templates[0]));
await page.waitForTimeout(2500);
await page.evaluate(() => (location.hash = '#/'));
await page.reload();
await page.waitForFunction(() => window.__mockuplab);
await page.waitForTimeout(800);
check((await page.getByTestId('project-card').count()) >= 1, 'recent projects shown');
await page.getByTestId('project-card').first().getByRole('button', { name: /Ouvrir/ }).click();
await page.waitForTimeout(400);
const r = await page.evaluate(() => ({ screen: window.__mockuplab.ui.getState().screen, photo: !!window.__mockuplab.project.getState().photo.assetId }));
check(r.screen === 'photo' && r.photo, 'resume opens the photo screen with its photo');
await done(browser, errors);
```

Run: `node scripts/check-home.mjs` — Expected: FAIL sur « no drop zone on home », « Open the Studio… », l'ordre des cartes.

- [ ] **Step 2: Exporter l'ordre des modes depuis `src/shell/route.ts`** (après `AVAILABLE`)

```ts
/** The modes, main one first: Studio · Rapide · Projet · Photo. */
export const MODE_ORDER: Screen[] = ['studio', 'quick', 'project', 'photo'];
```

- [ ] **Step 3: `src/home/Home.tsx`**

- Supprimer les imports `ImagePlus`, `pickImages`, `MOD`, la constante `MODES`, la fonction `importFromHome`, et `const [before, after] = …`.
- Importer `ArrowRight, ChevronDown` de `lucide-react` et `MODE_ORDER` de `@/shell/route`.
- Remplacer le bouton `data-testid="home-drop"` du hero par :

```tsx
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('studio')}
              className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#1d1d1f] transition-transform duration-150 hover:bg-white/90 active:scale-[0.98]"
            >
              {t('home.openStudio')}
              <ArrowRight size={17} />
            </button>
            <a href="#modes" className="flex items-center gap-1 text-[14px] font-medium text-white/80 hover:text-white">
              {t('home.otherModes')}
              <ChevronDown size={15} />
            </a>
          </div>
```

- Remplacer la section des modes (`<section className="flex flex-col gap-4">…</section>`) par :

```tsx
        <section id="modes" className="flex scroll-mt-6 flex-col gap-4">
          <h2 className="font-display text-[26px] font-bold">{t('home.modes')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODE_ORDER.map((m) => {
              const main = m === 'studio';
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`mode-card-${m}`}
                  disabled={!AVAILABLE[m]}
                  onClick={() => navigate(m)}
                  className={cx(
                    'glass group flex overflow-hidden rounded-[18px] text-left transition-transform duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 active:scale-[0.99]',
                    main ? 'flex-col md:col-span-3 md:flex-row' : 'flex-col',
                  )}
                >
                  <span className={cx('block overflow-hidden bg-surface-2', main ? 'aspect-[16/10] md:aspect-auto md:w-[58%]' : 'aspect-[16/10]')}>
                    <img src={shot(MODE_SHOTS[m])} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quart)] group-hover:scale-[1.04]" draggable={false} />
                  </span>
                  <span className={cx('flex flex-col gap-1.5', main ? 'justify-center px-7 py-6' : 'px-4 pb-4 pt-3')}>
                    {main && <span className="w-fit rounded-full bg-accent/12 px-2.5 py-0.5 text-[12px] font-semibold text-accent">{t('home.main')}</span>}
                    <span className={cx('font-display font-bold', main ? 'text-[30px]' : 'text-[20px]')}>{t(`screen.${m}` as I18nKey)}</span>
                    <span className={cx('leading-snug text-fg-muted', main ? 'text-[15px]' : 'text-[13px]')}>{t(`mode.${m}.role` as I18nKey)}</span>
                    {main && (
                      <span className="mt-3 flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
                        {t('home.openStudio')}
                        <ArrowRight size={16} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
```

Le hero ne contient plus qu'un seul bouton nommé « Ouvrir le Studio » (la carte Studio contient le même texte dans un `<span>` à l'intérieur d'un bouton nommé « Studio … » : `getByRole('button', { name: 'Ouvrir le Studio' })` résout le bouton du hero car le nom accessible de la carte est plus long — si le test trouve 2 éléments, utiliser `{ name: 'Ouvrir le Studio', exact: true }`).

- [ ] **Step 4: `src/app/shortcuts.ts`** — retirer `import { importFromHome } from '@/home/Home';`, importer `t` de `@/i18n` et `toast` de `@/store/toasts` s'ils ne le sont pas, et dans `routeFiles` :

```ts
  if (screen === 'home') toast.info(t('home.pickMode'));
```

(Le `.glb` déposé sur l'accueil est traité avant `routeFiles` dans `onDrop` : inchangé.)

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && node scripts/check-home.mjs`
Expected: typecheck sans erreur ; toutes les lignes `✓`.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/fr.ts src/i18n/en.ts src/home/Home.tsx src/app/shortcuts.ts src/shell/route.ts scripts/check-home.mjs
git commit -m "Home: pick a mode first (no direct drop), Studio first and biggest, one-line role per mode"
```

### Task 6: En-tête — ordre et infobulles

**Files:**
- Modify: `src/shell/ModeSwitch.tsx`
- Modify: `scripts/check-nav.mjs` (ajout de vérifications)

**Interfaces:**
- Consumes: `MODE_ORDER` (Task 5), `Tooltip` de `@/ui/primitives` (`{ label, shortcut?, children }`), clés `mode.<m>.role`.

- [ ] **Step 1: Ajouter au début de `scripts/check-nav.mjs`** (après l'ouverture de l'app, sur l'écran Studio) :

```js
await page.evaluate(() => history.pushState(null, '', '/studio'));
await page.evaluate(() => dispatchEvent(new PopStateEvent('popstate')));
await page.waitForTimeout(300);
const tabs = await page.getByTestId('mode-switch').getByRole('radio').allInnerTexts();
check(tabs.join() === 'Studio,Rapide,Projet,Photo', `header order (${tabs})`);
await page.getByTestId('mode-switch').getByRole('radio', { name: 'Rapide' }).hover();
check(await page.getByRole('tooltip').filter({ hasText: 'mock-ups tout faits' }).isVisible(), 'hovering a mode explains its role');
```

Run: `node scripts/check-nav.mjs` — Expected: FAIL sur l'ordre.

- [ ] **Step 2: `src/shell/ModeSwitch.tsx`** — remplacer `const MODES: Screen[] = ['quick', 'project', 'studio', 'photo'];` par l'import de `MODE_ORDER` depuis `./route` (et remplacer `MODES` par `MODE_ORDER` dans le fichier), importer `Tooltip` depuis `@/ui/primitives`, mettre à jour le commentaire en `/** Studio · Rapide · Projet · Photo — …`, et envelopper chaque bouton disponible :

```tsx
        const button = (
          <button
            key={m}
            /* …props inchangées… */
          >
            {t(`screen.${m}` as I18nKey)}
          </button>
        );
        return available ? (
          <Tooltip key={m} label={t(`mode.${m}.role` as I18nKey)}>
            {button}
          </Tooltip>
        ) : (
          button
        );
```

- [ ] **Step 3: Vérifier** — Run: `npm run typecheck && node scripts/check-nav.mjs && node scripts/check-urls.mjs` — Expected: tout en `✓`.

- [ ] **Step 4: Commit**

```bash
git add src/shell/ModeSwitch.tsx scripts/check-nav.mjs
git commit -m "Header: Studio first, each mode explains its role on hover"
```

### Task 7: Rôle du mode dans chaque état vide, « Varier ma scène », « Affiner dans le Studio »

**Files:**
- Create: `src/shell/ModeRole.tsx`
- Modify: `src/quick/QuickScreen.tsx:73-76`, `src/project/ProjectScreen.tsx` (au-dessus de la liste des fichiers), `src/photo/PhotoView.tsx:398-410`, `src/app/Viewport.tsx:81-90`, `src/shell/FloatingBar.tsx:45-49`
- Modify: `scripts/check-studio.mjs`, `scripts/check-variants.mjs`, `scripts/check-polish.mjs` (libellés `Idées` → `Varier ma scène`, `Personnaliser` → `Affiner dans le Studio`)

**Interfaces:**
- Produces: `ModeRole({ screen, className? }: { screen: Exclude<Screen, 'home'>; className?: string })` → `<p data-testid="mode-role">`.

- [ ] **Step 1: Test** — ajouter à `scripts/check-polish.mjs` :

```js
for (const [path, screen] of [['/studio', 'studio'], ['/rapide', 'quick'], ['/projet', 'project'], ['/photo', 'photo']]) {
  await page.evaluate((p) => { history.pushState(null, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForTimeout(400);
  check(await page.getByTestId('mode-role').first().isVisible(), `${screen}: empty state says what the mode is for`);
}
await page.evaluate(() => { history.pushState(null, '', '/studio'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(300);
check(await page.getByRole('button', { name: 'Varier ma scène' }).isVisible(), 'Studio: “Vary my scene” button');
```

et remplacer dans les trois scripts les libellés `Idées` / `Personnaliser` par `Varier ma scène` / `Affiner dans le Studio`. Run: `node scripts/check-polish.mjs` — Expected: FAIL sur `mode-role`.

- [ ] **Step 2: Créer `src/shell/ModeRole.tsx`**

```tsx
import { useT, type I18nKey } from '@/i18n';
import type { Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

/** One line that says what a mode is for, shown where the mode is still empty. */
export function ModeRole({ screen, className }: { screen: Exclude<Screen, 'home'>; className?: string }) {
  const { t } = useT();
  return (
    <p data-testid="mode-role" className={cx('text-[13px] leading-snug text-fg-muted', className)}>
      {t(`mode.${screen}.role` as I18nKey)}
    </p>
  );
}
```

- [ ] **Step 3: Brancher `ModeRole`**

- `QuickScreen.tsx` : juste avant `<GroupTitle>{t('quick.design')}</GroupTitle>`, quand aucune image n'est choisie : `{!asset && <ModeRole screen="quick" />}` (la variable `asset` existe déjà dans ce composant ; sinon la lire comme à la ligne 91).
- `ProjectScreen.tsx` : au-dessus du bouton `data-testid="project-add"`, quand `!s.files.length` : `<ModeRole screen="project" />`.
- `PhotoView.tsx` (`PhotoEmpty`) : remplacer le `<p>` de `photo.empty.body` par le même `<p>` précédé de `<ModeRole screen="photo" className="mt-2 text-[14px] font-medium text-fg" />`.
- `Viewport.tsx` (`EmptyHint`) : envelopper le conteneur de la pilule dans une colonne et ajouter au-dessus `<ModeRole screen="studio" className="rounded-full bg-black/45 px-3 py-1 text-[12px] text-white/80 backdrop-blur-xl" />`.

- [ ] **Step 4: `FloatingBar.tsx`** — envelopper le bouton `data-testid="open-variants"` dans `<Tooltip label={t('stage.ideasHint')}>…</Tooltip>` (le libellé vient déjà de `stage.ideas`, modifié en Task 4).

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && node scripts/check-polish.mjs && node scripts/check-studio.mjs && node scripts/check-variants.mjs && node scripts/check-quick.mjs && node scripts/check-project.mjs && node scripts/check-a11y.mjs`
Expected: tout en `✓`. Puis `node scripts/shoot-ui.mjs` et relire `out/ui/home-*.png`, `quick-*.png`, `project-*.png`, `photo-empty-*.png`, `studio-Appareils-*.png` (clair et sombre).

- [ ] **Step 6: Commit**

```bash
git add src/shell/ModeRole.tsx src/quick/QuickScreen.tsx src/project/ProjectScreen.tsx src/photo/PhotoView.tsx src/app/Viewport.tsx src/shell/FloatingBar.tsx scripts/check-polish.mjs scripts/check-studio.mjs scripts/check-variants.mjs
git commit -m "Each mode says what it is for when empty; Studio 'Vary my scene', 'Refine in Studio' from Quick and Project"
```

### Task 8: Parcours d'usage après la phase 1, rapport, arrêt

**Files:**
- Modify: `scripts/usage/01-debutant.mjs` à `05-photo.mjs` (entrée par les modes : plus de dépôt sur l'accueil)
- Create: `docs/usage/2026-10-13-phase-1.md`

- [ ] **Step 1: Adapter les parcours** — le débutant passe par « Ouvrir le Studio » → « parcourir » (pilule de l'état vide) → format 4:5 dans la barre flottante → *Exporter* du haut ; les autres parcours entrent par leur carte de mode. Aucun autre changement.

- [ ] **Step 2: Lancer** — Run: `node scripts/usage/run-all.mjs`

- [ ] **Step 3: Rapport** `docs/usage/2026-10-13-phase-1.md` : même tableau que l'audit initial avec une colonne « avant » et une colonne « après » (temps, clics, frictions), les frictions résolues, les nouvelles, et les captures clés.

- [ ] **Step 4: Commit**

```bash
git add scripts/usage docs/usage/2026-10-13-phase-1.md
git commit -m "Usage tests after phase 1: journeys enter through a mode; before/after report"
```

**STOP** — présenter le rapport avant/après et les captures de l'accueil (clair/sombre) à l'utilisateur ; attendre son retour avant d'écrire le plan de la phase 2 (fond unifié).
