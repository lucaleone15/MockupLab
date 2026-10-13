# Phase 5 : réseaux sociaux — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Formats préréglés (Post Insta 4:5, carré, Story/Reel/TikTok 9:16, YouTube, LinkedIn, Pinterest) à la taille exacte en pixels avec zones de sécurité affichées (jamais exportées) ; préréglage vidéo « Reel / TikTok » avec boucle parfaite ; carrousel Insta (2–10 slides, 4:5 ou 1:1) exporté en ZIP de slides.

**Architecture:** Les formats sont des `RatioPreset` de plus (`ig-post`, `ig-square`, `story`, `youtube`, `linkedin`, `pinterest`) avec une taille en pixels (`px`) ; le carrousel est un ratio calculé `c<N>-4x5` / `c<N>-1x1` (bande de N slides). `outputSize` donne la taille exacte (×1 / ×1,5 / ×2 selon 1080 / 2K / 4K). Les zones de sécurité et les coupes du carrousel sont des calques DOM sur le cadre (hors export). L'export d'un carrousel rend la bande puis la découpe en N images dans un ZIP.

**Spec:** § 5.

### Task 1 — Formats réseaux + zones de sécurité (`scripts/check-social.mjs`)
- [ ] Test : menu « Réseaux » de la barre ; chaque format donne sa taille exacte (1080×1350, 1080×1080, 1080×1920, 1920×1080, 1200×627, 1000×1500) ; « Zones de sécurité » visible pour Story et absent de l'image exportée ; Rapide propose Post Insta et Story. FAIL → implémenter → PASS ; `check-export`, `check-quick`, `check-studio` PASS. Commit.
### Task 2 — Vidéo « Reel / TikTok » et boucle parfaite (`scripts/check-social.mjs`)
- [ ] Test : bouton « Reel / TikTok » dans l'onglet Vidéo → 9:16 Story, 1080p, 30 i/s, 10 s, MP4 ; durées 6/10/15 ; « Boucle parfaite » : la caméra de la dernière image = celle de la première. FAIL → implémenter → PASS ; `check-video`/`check-cinema` PASS. Commit.
### Task 3 — Carrousel Insta (`scripts/check-social.mjs`)
- [ ] Test : « Carrousel » 3 slides 4:5 → cadre 3,2× plus large que haut (2,4) avec 2 coupes en pointillé ; « Disposer » répartit 3 appareils, un par slide ; l'export donne un ZIP `01.png…03.png` de 1080×1350. FAIL → implémenter → PASS. Commit.
### Task 4 — Parcours d'usage, rapport final
- [ ] Parcours vidéo : préréglage ; nouveau parcours « créateur carrousel ». `run-all`, captures, `docs/usage/2026-10-13-phase-5.md`. Commit.
