# Phase 2 : fond unifié et décor regroupé — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le fond devient la seule source de couleur de la scène : chaque mur (objets muraux, table, studio cyclo) affiche le fond tel qu'il est à l'écran, éclairé et ombré ; le décor se règle en un seul endroit (Fond · Mise en scène · Sol) ; « Disposer » reste lisible avec des objets muraux.

**Architecture:** Un matériau partagé `useBackdropMaterial()` (src/scene/backdrop.ts) : `MeshStandardMaterial` dont la couleur de base est lue dans une `CanvasTexture` du fond (peinte par `paintBackground`) **en coordonnées d'écran** — y compris pendant l'export par tuiles, grâce à `camera.view` (offset/taille) passé en uniform à chaque rendu. Les murs n'ont plus de couleur propre ; `wallFor` ne renvoie plus que `{ z }`.

**Tech Stack:** three r186 (`onBeforeCompile`, `Material.onBeforeRender`), React Three Fiber, zustand, scripts Playwright `check-*`.

**Spec:** `docs/superpowers/specs/2026-10-13-usage-modes-fond-print-social-design.md` § 2.

## Global Constraints

- Mur = fond, y compris dégradé, motif, image ; la table et le studio suivent aussi.
- Fond transparent : murs blanc chaud neutre `#ece6dc`.
- Conservés : « Mur oui/non », « Au mur / Posée ».
- Projet v5 → v6 : une ancienne couleur de mur devient le fond uni si le fond était le dégradé par défaut ; sinon ignorée.
- FR + EN pour toute chaîne. Pas de push.

## Review Focus

- Export 4K en tuiles avec un fond dégradé : le dégradé du mur est continu d'une tuile à l'autre (pas de raccord).
- Fond image pas encore chargée (projet restauré) : le mur se met à jour quand l'image arrive.
- Changement de ratio d'export : la texture du mur suit le nouveau cadre.
- Undo/redo d'un changement de fond : les murs suivent.
- Projet v5 avec table + mur sauge + fond par défaut → s'ouvre avec un fond uni sauge.

---

### Task 1: Matériau « toile de fond » en coordonnées d'écran

**Files:** Create `src/scene/backdrop.ts`; Create `scripts/check-backdrop.mjs`; Modify `src/scene/Stage.tsx` (SharedWall).

**Produces:** `useBackdropMaterial(opts?: { roughness?: number; plaster?: boolean }): THREE.MeshStandardMaterial`.

- [ ] Test `scripts/check-backdrop.mjs` : fond dégradé linéaire rouge (haut) → bleu (bas) ; une affiche au mur (décor aucun) ; rendu via le pont d'export du projet ; mesurer deux pixels du mur (au-dessus de l'affiche, en haut à gauche ; et en bas à gauche) : le haut est plus rouge que bleu, le bas plus bleu que rouge. Même mesure avec la table (Task 2). Lancer : FAIL (mur uni).
- [ ] Implémenter `backdrop.ts` : texture canvas 1024 px sur le grand côté au ratio d'export, repeinte quand `background`, `export.ratio` ou une image de fond change (`prepareBackground`) ; `colorSpace = SRGB` ; `onBeforeCompile` : varying `vClip = gl_Position` ; dans le fragment, `vec2 ndc = vClip.xy / vClip.w * 0.5 + 0.5; vec2 suv = vec2(uView.x + ndc.x * uView.z, 1.0 - (uView.y + (1.0 - ndc.y) * uView.w));` puis `diffuseColor.rgb *= texture2D(uBackdrop, suv).rgb` ; `onBeforeRender(renderer, scene, camera)` met `uView = camera.view?.enabled ? (offsetX/fullWidth, offsetY/fullHeight, width/fullWidth, height/fullHeight) : (0,0,1,1)`. Option `plaster` : normal map béton (comme `useWallMaterial`). Fond transparent → texture unie `#ece6dc`.
- [ ] `SharedWall` utilise `useBackdropMaterial()` et un plan 6000 × 3000 (plus de bord visible en plongée).
- [ ] Test → PASS. Commit « Walls show the background: screen-space backdrop material ».

### Task 2: Plus de couleur de mur nulle part

**Files:** `src/models/types.ts:95`, `src/models/print/Posters.tsx`, `src/models/signage/Signage.tsx`, `src/lib/arrange.ts` (`SceneWall` sans `color`), `src/scene/Decor.tsx` (TableSet + Sweep), `src/store/project.ts` (`Decor.wall`, `DEFAULT_DECOR`, `setBackground`), `src/scene/scenePresets.ts`, `src/variants/looks.ts`, `src/app/panels/ScenePanel.tsx`, `scripts/check-polish.mjs`, `scripts/check-backdrop.mjs`.

- [ ] Tests d'abord : `check-backdrop` (table : le mur suit le dégradé ; studio cyclo + dégradé : le cyclo reste actif et suit le dégradé) ; `check-polish` : « a gradient turns the cyclo off » devient « a gradient keeps the cyclo » ; aucun contrôle nommé « Couleur du mur » dans les réglages de l'affiche et de la TV. FAIL.
- [ ] `wallFor` → `{ z: number } | null` ; retirer le paramètre `wall` (affiche, `WALL_PARAM` de l'affichage) ; `sceneWall` sans couleur ; `TableSet` et `Sweep` utilisent `useBackdropMaterial({ plaster: true })` / `useBackdropMaterial({ roughness: 0.92 })` ; `Decor.wall` supprimé.
- [ ] Ambiances table : `background: { kind: 'solid', color: <ancien mur> }` à la place de `decor.wall` ; `presetActive` compare le fond. Variantes (`looks.ts`) : tirer une couleur de `WALL_COLORS` dans `look.background` (solide) au lieu de `decor.wall`.
- [ ] `setBackground` ne touche plus au décor.
- [ ] Typecheck + `check-backdrop`, `check-polish`, `check-walls`, `check-variants`, `check-switch`, `check-composition` → PASS. Commit.

### Task 3: Un seul endroit — Fond · Mise en scène · Sol

**Files:** `src/studio/pages.tsx`, `src/app/panels/ScenePanel.tsx`, i18n.

- [ ] Test (`check-studio`) : la page Décor affiche, dans l'ordre, les titres « Fond », « Mise en scène », « Sol » ; la mise en scène propose 5 choix « Aucune, Studio, Podium, Surface, Table » ; le fond reste modifiable avec la table. FAIL.
- [ ] Ordre `BackgroundSection`, `DecorSection`, `GroundSection` ; `decor.title` → « Mise en scène » / « Set » ; chips : `none`, `sweep`, `podium`, `surface`, `table` (le studio n'est plus un interrupteur réservé au fond uni) ; `BackgroundSection` toujours éditable (plus de `bg.placeNote`). PASS. Commit.

### Task 4: Anciens projets (v5 → v6)

**Files:** `src/store/persistence.ts`, `src/store/project.ts` (`version: 6`), `scripts/check-backdrop.mjs`.

- [ ] Test : `migrateProject` d'un projet v5 (table, `decor.wall: '#b9c2ae'`, fond = dégradé par défaut) → fond `{ kind: 'solid', color: '#b9c2ae' }`, pas de `decor.wall` ; même projet avec un fond uni rouge → fond rouge gardé ; une affiche v5 avec `params.wall` → paramètre retiré, couleur reprise comme fond si fond par défaut. FAIL → implémenter → PASS. Commit.

### Task 5: « Disposer » avec des objets muraux

**Files:** `src/lib/arrange.ts` (`arrangeItems`), `scripts/check-composition.mjs` ou `check-backdrop.mjs`.

- [ ] Test : affiche au mur + flyer + carte de visite → après « Disposer », les objets au sol sont posés devant la base du mur (z ≤ mur + 60), répartis autour de l'axe de l'affiche, et le cadrage 3/4 garde un angle de caméra ≤ 35° au-dessus de l'horizon. FAIL → implémenter → PASS. Commit.

### Task 6: Parcours d'usage, rapport

- [ ] Parcours print : « Changer la couleur du mur » devient « Changer la couleur du fond » (onglet Décor → Fond → une couleur) ; capture après « Disposer » relue (plus de triangle noir).
- [ ] `node scripts/usage/run-all.mjs`, `node scripts/shoot-ui.mjs` (relire Décor clair/sombre), rapport `docs/usage/2026-10-13-phase-2.md`. Commit.
