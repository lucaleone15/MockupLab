# Modes clairs, fond unifié, formats print, Projet en couleurs, réseaux sociaux — design

Date : 2026-10-13 · Statut : validé en conversation, à relire

## But

Rendre MockupLab plus simple à comprendre et plus cohérent à l'usage, pour la majorité des utilisateurs potentiels
(débutant pressé, graphiste print, freelance qui livre un pack client, créateur vidéo, utilisateur du mode Photo) :

- chaque mode a **un rôle unique**, et le **Studio** est le mode principal ;
- la scène a **une seule source de couleur** : le fond (plus de « couleur du mur » par objet) ;
- le décor se règle **à un seul endroit** et donne un rendu homogène ;
- les prints acceptent **plus de tailles** et peuvent **suivre le ratio de l'image** ;
- le mode Projet permet de **choisir les couleurs** du pack et reste cohérent ;
- des **formats réseaux sociaux** (Insta, TikTok…), des **vidéos verticales** et un **carrousel** Insta ;
- la qualité est vérifiée par des **tests d'usage** (parcours joués comme un humain), pas seulement techniques.

Ce que l'utilisateur a dit, mot pour mot ou presque : formats print = « plus de tailles papier » + « s'adapter à mon image » ;
mur = « le mur devient le fond » (dégradé, motif ou image affichés sur le mur), la table suit aussi ;
décor = « réglages éparpillés » + « rendu incohérent » ; Projet = les 4 sources de couleur (images, marque, pipette, une couleur par scène) ;
réseaux = formats préréglés + vidéos verticales + carrousel ; « enlève le dépôt d'image direct, il faut d'abord choisir le mode » ;
modes = clarifier « leur rôle (chevauchements) » ; Studio = mode principal.

## Phases

Chaque phase se termine par les tests d'usage (section 7), un rapport avant/après, et un arrêt pour le retour de l'utilisateur.
Un commit par phase, pas de push sans accord.

| # | Phase |
|---|---|
| 0 | Audit d'usage initial |
| 1 | Modes clairs, Studio en premier |
| 2 | Fond unifié et décor regroupé |
| 3 | Formats print |
| 4 | Projet : couleurs et cohérence |
| 5 | Réseaux sociaux |

## 1. Modes clairs (phase 1)

### Rôles

| Mode | On y met | On en sort | Réglages |
|---|---|---|---|
| **Studio** (principal) | 1 ou plusieurs designs | **une** scène, en image ou en vidéo | tous |
| **Rapide** | **1** design | **beaucoup** de mock-ups tout faits ; on en télécharge un ou plusieurs | support et format seulement |
| **Projet** | **tous** les designs d'un client | **un pack** assorti : une scène par design, une scène d'ensemble, une planche, en ZIP | style et couleurs du pack |
| **Photo** | 1 design + une **vraie photo** | le design posé sur la photo | ceux de la photo |

Suppression des doublons :

- Le bouton « Idées » du Studio (`stage.ideas`, barre flottante) devient **« Varier ma scène »**. Une phrase d'aide le distingue
  de Rapide : il garde la scène (appareils, textes) et varie angle, lumière, décor ; Rapide part de zéro avec des ambiances toutes faites.
- Rapide n'expose aucun réglage avancé ; chaque vignette a **« Affiner dans le Studio »**.
- Projet se règle globalement (style, couleurs) ; chaque scène a **« Affiner dans le Studio »**.

### Accueil (`src/home/Home.tsx`)

- La zone de dépôt et le collage ⌘V sont **retirés** de l'accueil. Le dépôt et le collage marchent **dans** chaque mode.
- Studio = grande carte principale (« Ouvrir le Studio ») ; Rapide, Projet, Photo = cartes secondaires en dessous.
- Chaque carte dit en une ligne pour qui et ce qu'on obtient :
  - Studio : « Ta scène 3D, réglée dans le moindre détail : appareils, décor, lumière, caméra, vidéo »
  - Rapide : « Une image → des mock-ups prêts, tu choisis »
  - Projet : « Tout un projet (site, appli, print) → un pack assorti et une planche »
  - Photo : « Ton design posé sur une vraie photo »
- Les Récents restent.

### En-tête (`src/shell/ModeSwitch.tsx`)

- Ordre : **Studio · Rapide · Projet · Photo**.
- Infobulle sur chaque onglet = la phrase de la carte.

### Dans chaque mode

- État vide : ce qu'on dépose et ce qu'on obtient, avec la zone de dépôt.
- Le rôle du mode (une ligne) est visible en haut de l'état vide.

## 2. Fond unifié et décor regroupé (phase 2)

### Le fond pilote tous les murs

- Supprimés : le paramètre `wall` (« Couleur du mur ») de l'affiche (`src/models/print/Posters.tsx`) et de l'affichage
  (`src/models/signage/Signage.tsx`), et `Decor.wall` (mur de la table, `src/store/project.ts`, `src/app/panels/ScenePanel.tsx`).
- `wallFor` ne renvoie plus de couleur : chaque mur **affiche le fond** — couleur unie, dégradé, motif ou image (floutée/assombrie
  comme le fond) — comme un mur peint ou un papier peint. Il garde son grain, son éclairage et les ombres portées.
- Le studio cyclo, le mur de la table et les murs des objets utilisent tous le fond. Fond transparent : murs en blanc chaud neutre.
- Le setter `setBackground` ne coupe plus le studio quand le fond n'est pas uni : le cyclo affiche aussi le fond.
- Conservés : « Mur oui/non », « Au mur / Posée ».

### Un seul onglet Décor

- Trois blocs dans l'ordre : **Fond** (couleur, dégradé, motif, image) · **Mise en scène** (Aucune / Studio / Podium / Surface / Table,
  avec leurs options : matière, ombres projetées, forme…) · **Sol**.
- Le bloc décor de l'onglet Ambiance disparaît ; Ambiance garde les ambiances en un clic.
- La jonction sol/fond se fond dans le fond (pas de coupure visible) pour toutes les mises en scène.

### Anciens projets (`src/store/persistence.ts`)

- Version du projet 5 → 6. À l'ouverture : si une table ou un objet mural avait une couleur de mur et que le fond était le dégradé
  par défaut, cette couleur devient le fond uni ; sinon elle est ignorée. Les paramètres `wall` restants sont retirés.

## 3. Formats print (phase 3)

Tailles :

- **Affiche** : A4, A3, A2, A1, A0, 30×40, 40×50, 50×70, 61×91, 70×100 cm.
- **Flyer** : A6, A5, A4, DL (10×21), carré 21×21.
- **Carte postale** : A6, 10×15, carré 14×14.
- **Carte de visite** : 85×55, 89×51, carré 55×55 mm.

« Adapter à mon image » :

- Premier choix de la liste et **défaut**.
- Le papier prend le ratio exact de l'image de la face principale, sans recadrage ; orientation portrait, paysage ou carré automatique.
- La taille choisie fixe le plus grand côté ; la taille réelle obtenue s'affiche (« ≈ 42 × 56 cm »).
- Cadre, passe-partout, verre, ombres et mur suivent.
- Sans image : ratio de la taille standard choisie.

Taille standard : image cadrée comme aujourd'hui, avec le curseur *Position*.

Les anciens projets gardent leur format (A3/A2/A1, A4/A5) sans « adapter ».

## 4. Projet : couleurs et cohérence (phase 4)

Bloc **« Couleurs du pack »** dans `src/project/ProjectScreen.tsx` :

- **Tirées des images** : 4 à 5 palettes de 2–3 couleurs, extraites des designs importés (couleurs dominantes, adoucies pour un fond).
- **Palette de marque** : si l'onglet Marque est rempli.
- **Pipette libre**.

Application :

- Par défaut, toutes les scènes ont la même couleur de fond.
- Interrupteur **« Varier d'une scène à l'autre »** : les scènes alternent les couleurs de la palette.
- Clic sur une scène : choisir sa couleur, pour elle seule.
- La couleur passe par le fond unifié : murs, studio, mur de la table ; le podium peint prend la 2e couleur ; la planche utilise la palette.
- Le style (table, studio, podium, aurora…) reste un choix séparé, la couleur s'y applique.
- Les vignettes se recalculent après un changement.

## 5. Réseaux sociaux (phase 5 — Studio et Rapide)

### Formats préréglés (`src/export/settings.ts`)

Groupe « Réseaux », taille exacte en pixels (×2 possible) :

| Format | Ratio | Pixels |
|---|---|---|
| Post Insta | 4:5 | 1080×1350 |
| Post carré | 1:1 | 1080×1080 |
| Story / Reel / TikTok | 9:16 | 1080×1920 |
| YouTube | 16:9 | 1920×1080 |
| LinkedIn | 1.91:1 | 1200×627 |
| Pinterest | 2:3 | 1000×1500 |

**« Zones de sécurité »** : affiche dans l'aperçu les zones couvertes par l'interface du réseau (légende, boutons, barre du haut).
Jamais exportées.

### Vidéos verticales (`src/animation/`)

- Préréglage « Reel / TikTok » : 9:16, 1080×1920, 30 i/s, 6 / 10 / 15 s, MP4 H.264.
- Option **boucle parfaite** (la fin rejoint le début) pour les animations qui s'y prêtent.
- Les plans cinéma sont recadrés pour le vertical (sujet plus grand dans le cadre).

### Carrousel Insta

- Format « Carrousel » : 2 à 10 slides, 4:5 ou 1:1.
- La scène devient une bande de N × la largeur d'une slide ; des pointillés montrent les coupes ; les appareils peuvent chevaucher deux slides.
- « Disposer » répartit les appareils sur la bande.
- Export : ZIP `01.png … NN.png`.

## 6. Hors périmètre

Renommer les modes ; réduire le nombre de modes ; CI ; signature de l'app Mac ; poids des textures.

## 7. Tests d'usage

- Un script Playwright par profil, dans `scripts/usage/` :
  - **débutant pressé** : de l'accueil à un post Insta exporté, objectif < 2 min ;
  - **graphiste print** : affiche + flyer + carte de visite sur un mur assorti, export HD ;
  - **freelance** : pack client en Projet (site + appli + print), couleurs de marque, planche ;
  - **créateur vidéo** : Reel vertical animé, export MP4 ;
  - **photo** : un design posé sur une photo modèle.
- Les scripts n'agissent que via ce qui est **visible** (rôles, libellés, textes) — jamais via les hooks de test internes.
- Capture à chaque étape dans `out/usage/<profil>/`, avec le nombre de clics et le temps.
- Lancement à la phase 0 puis à la fin de chaque phase. Rapport de frictions en français (bloquant / surprenant / lent),
  comparaison avant/après, dans `docs/usage/`.
- Les scripts `check-*` existants restent ; ceux que les changements cassent sont mis à jour.

## Risques

- Mur = fond en dégradé ou image : le mur est en perspective, l'image doit rester lisible et éclairée ; vérifier sur les 4 mises en scène.
- Supprimer le dépôt direct de l'accueil ralentit le débutant : la carte Studio doit mener à un état vide qui invite à déposer.
- Carrousel : bande très large → rendu par tuiles déjà présent, à vérifier en 10 slides.
