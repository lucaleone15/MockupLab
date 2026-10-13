# Phase 3 : formats print — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Plus de tailles papier pour l'affiche, le flyer, la carte postale et la carte de visite, et un interrupteur « Adapter à mon image » (actif par défaut) qui donne au papier le ratio exact de l'image, sans recadrage ; le format se choisit dès la liste des appareils.

**Architecture:** Un module `src/models/print/formats.ts` décrit les tailles (cm) et calcule `paperDims(size, fit, imageRatio)`. Les fonctions de taille des modèles reçoivent les ratios des images posées : `sizeFor(params, aspects?)`, `wallFor(params, aspects?)`, `sizeOf(model, params, aspects?)`, avec `imageAspects(item)` (lu dans `useAssets`) côté logique et `useImageAspects(surfaces)` côté composant. Le ratio n'est pas stocké : il suit l'image où qu'elle ait été posée (Studio, Rapide, Projet).

**Spec:** `docs/superpowers/specs/2026-10-13-usage-modes-fond-print-social-design.md` § 3.

## Global Constraints

- Affiche : A4, A3, A2, A1, A0, 30×40, 40×50, 50×70, 61×91, 70×100. Flyer : A6, A5, A4, DL (10×21), carré 21×21. Carte postale : A6, 10×15, carré 14×14. Carte de visite : 85×55, 89×51, carré 55×55.
- « Adapter à mon image » : premier réglage, actif par défaut ; la taille choisie fixe le plus grand côté ; la taille réelle s'affiche (« ≈ 42 × 56 cm »). Sans image : ratio de la taille choisie.
- Anciens projets : pas d'« adapter » (paramètre absent → `false`), format gardé.
- FR + EN.

## Review Focus

- Image paysage sur une affiche « au mur » : l'affiche devient paysage, le mur et l'ombre suivent, rien ne passe derrière le mur.
- Image retirée : retour au ratio papier.
- Affiche « posée » (lean) adaptée à une image très haute : reste posée au sol contre le mur.
- Rapide / Projet : une affiche paysage s'adapte aussi.
- Carte de visite en pile avec une image carrée.

---

### Task 1: Tailles et « Adapter à mon image » (affiche, flyer, carte postale, carte de visite)

**Files:** Create `src/models/print/formats.ts`, `src/models/imageAspects.ts`; Modify `src/models/types.ts` (signatures, `ParamDef` kind `'chips'` pour les longues listes), `src/models/print/Posters.tsx`, `src/models/print/Cards.tsx`, `src/lib/arrange.ts`, `src/scene/bounds.ts`, `src/scene/camera.tsx`, `src/scene/Decor.tsx`, `src/scene/interaction.tsx`, `src/animation/animations.ts`, `src/app/PropertiesPanel.tsx`, `src/store/persistence.ts`; Test `scripts/check-print-formats.mjs`.

- [ ] Test : affiche avec une image paysage 1600×900 et « Adapter » → `sizeOf` donne largeur > hauteur, ratio 16:9 ±1 %, plus grand côté = taille choisie (A2 → 59,4 cm) ; sans adapter → 42 × 59,4 ; flyer DL → 9,9 × 21 ; carte de visite 89×51 ; carte postale carré 14 × 14 ; le panneau propose les 10 tailles d'affiche et affiche « ≈ 59 × 33 cm » ; un projet v6 sans `fit` reste non adapté. FAIL.
- [ ] Implémenter, typecheck, test PASS ; `check-walls`, `check-composition`, `check-backdrop`, `check-swap` PASS. Commit.

### Task 2: Le format dès la liste des appareils

**Files:** `src/studio/DevicesPage.tsx`, `src/app/PropertiesPanel.tsx` (exporter `ParamControl`).

- [ ] Test (`check-print-formats`) : après un clic sur « Affiche » dans Appareils, « Adapter à mon image » et les tailles sont visibles sur la même page. FAIL → afficher, sous « Dans la scène », les réglages `fit` et `format` de l'objet sélectionné quand il en a. PASS. Commit.

### Task 3: Parcours d'usage, rapport

- [ ] Parcours print : la friction « format caché dans Réglages » disparaît ; ajouter l'étape « Adapter à mon image » (vérifier la taille affichée). `run-all`, captures, rapport `docs/usage/2026-10-13-phase-3.md`. Commit.
