# Phase 4 : Projet, couleurs et cohérence — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Choisir les couleurs de fond du pack (tirées des images, palette de marque, pipette), une couleur pour tout le pack ou variée d'une scène à l'autre, une couleur propre à une scène ; la planche suit ; les fonds prédéfinis ont un nom.

**Architecture:** `src/project/palettes.ts` (couleurs dominantes des images → 5 palettes adaptées à un fond ; `colourBackground(style, couleur, palette)`), état `colors` dans `usePack` appliqué dans `stage()` via le fond unifié (phase 2), bloc « Couleurs du pack » sous les styles, pastilles sous chaque scène.

**Spec:** § 4.

### Task 1 (TDD, `scripts/check-project-colors.mjs`)
- [x] Palettes tirées des images (≥ 4, teintes des images) ; une couleur pour tout le pack ; « Varier » ; couleur d'une scène ; « Ma marque » ; pipette ; fonds prédéfinis nommés.
### Task 2
- [x] Parcours freelance : la friction « couleurs du pack » disparaît ; rapport `docs/usage/2026-10-13-phase-4.md`.
