# MockupLab — Refonte de l'interface, modes, projets, PWA et app bureau

Date : 2026-10-12 · Statut : en relecture

## 1. Objectif

Rendre MockupLab compréhensible dès l'arrivée et agréable à utiliser, **sans retirer aucune fonctionnalité** :

- une page d'accueil qui explique l'app et permet d'agir tout de suite ;
- des **modes séparés** (Rapide, Projet, Studio, Photo) au lieu d'un seul éditeur plein de sous-menus ;
- un mode **Projet** : plusieurs images d'un même projet (site, mobile, print…) → un pack cohérent généré automatiquement ;
- une interface moderne, épurée, « Apple », avec une typographie à caractère ;
- plusieurs projets enregistrés et leurs exports, retrouvables depuis l'accueil (« Récents ») ;
- une app installable sur Mac et Windows (PWA puis Electron), avec mise à jour proposée.

**Critères de succès**

- Un nouveau venu comprend ce que fait l'app et obtient un premier mock-up téléchargeable en moins d'une minute sans lire d'aide.
- Plus aucune section repliée dans les panneaux ; chaque réglage est à au plus 2 clics de l'écran du mode.
- Toutes les fonctions actuelles restent accessibles (cf. § 11, table de correspondance).
- Les projets et fichiers `.json` existants s'ouvrent sans perte.
- Les scripts `check-*` existants passent (adaptés aux nouveaux sélecteurs), plus les nouveaux.

**Hors périmètre** : comptes utilisateurs / synchronisation cloud, application mobile, signature de code (préparée mais pas achetée), nouveaux modèles 3D.

## 2. Audit de l'existant (résumé)

1. Aucune entrée en matière : l'app s'ouvre sur l'éditeur avec un Phone Pro ; l'action principale (déposer son design) est une petite pastille.
2. Barre du haut surchargée (~14 contrôles) ; « Lot » est une icône sans libellé ; « Variantes », la fonction la plus « magique », est dans un coin.
3. Trois colonnes permanentes (232 + 300 px) qui écrasent le canvas ; bibliothèque de ~40 silhouettes grises quasi identiques ; clic = remplacer / survol « + » = ajouter, expliqué par un texte de 11 px ; liste des modèles en double dans « Changer ».
4. Panneau de droite : 4 onglets × sections repliables (5 sur 6 fermées dans Scène) ; Composition enfouie en bas d'Appareil ; « Marque » mélange kit, textes et générateurs ; la vidéo est cachée derrière un interrupteur dans Export.
5. Doublons : Export en onglet et en bouton ; photos fournies listées deux fois en mode Photo ; bouton d'export désactivé orange (paraît cassé).
6. Style dense « outil pro » : textes 11–12,5 px, micro-titres en majuscules, orange partout, canvas à pointillés.
7. Pas de notion de projet multi-supports ni de plusieurs projets.

## 3. Structure générale

### 3.1 Écrans et navigation

Nouvel état d'interface `screen: 'home' | 'quick' | 'project' | 'studio' | 'photo'` (store `ui`), reflété dans l'URL par hash (`#/`, `#/rapide`, `#/projet`, `#/studio`, `#/photo`) : le bouton retour du navigateur fonctionne, un mode peut être mis en favori. Sans hash → accueil.

Le modèle de données du projet ne change pas : `mode: 'scene' | 'photo'` reste. `studio` ⇔ `mode = 'scene'`, `photo` ⇔ `mode = 'photo'`. Rapide et Projet travaillent sur la scène 3D via le bac à sable existant.

### 3.2 Barre du haut (tous les écrans sauf l'accueil, qui a sa propre barre légère)

`[Logo → accueil] / [Nom du projet ▾ : nouveau, ouvrir .json, enregistrer .json, dupliquer] [✓ enregistré]` — au centre `[Rapide | Projet | Studio | Photo]` — à droite `[↶] [↷] [···] [Exporter]`.

- `···` : Langue (FR/EN), Thème (Auto/Clair/Sombre), Raccourcis clavier, Recommencer à zéro.
- Annuler / rétablir et Exporter seulement dans Studio et Photo (Rapide et Projet ont leurs propres boutons de téléchargement).
- Environ 7 contrôles au lieu de 14.

### 3.3 Un seul moteur 3D partagé

Le canvas R3F (`Viewport`) est monté **une fois** au niveau de l'app et reste monté sur tous les écrans : visible dans Studio, caché (hors écran, taille fixe) dans Rapide et Projet où il produit les vignettes via `inSandbox` / `composeScene` (`src/variants/render.ts`). Pas de second contexte WebGL.

## 4. Accueil

Tient sur un écran, barre légère (logo, FR/EN, thème).

- Titre (Syne) : « Tes designs, mis en scène. » + une phrase : ce que fait l'app, gratuit, 100 % dans le navigateur.
- Grande zone de dépose (glisser, coller ⌘V, parcourir ; images et PDF) : **1 fichier → Rapide**, **plusieurs → Projet**.
- 4 cartes de modes avec mini-aperçu : Rapide, Projet, Studio, Photo.
- **Récents** (phase 2) : grille des derniers projets (miniature, nom, mode, date, nombre d'exports) + « Voir tout ». Avant la phase 2 : une ligne « Reprendre » vers le projet autosauvé.
- Cartes de modes pas encore livrés : badge « Bientôt », non cliquables.

## 5. Mode Rapide

Colonne gauche (carte blanche) :
- **Ton design** : vignette + Remplacer (sans image : un exemple est utilisé).
- **Support**, détecté automatiquement, modifiable : Téléphone · Tablette · Ordinateur · Navigateur · Écran · Montre · Print · Objets.
- **Format** : 16:9 · 4:3 · 1:1 · 4:5 · 9:16 (= `export.ratio`).

Zone principale :
- Filtres : Tous · Clair · Sombre · Bois · Marbre · Coloré · Lifestyle ; « ↻ Plus d'idées » (moteur `generateLooks`).
- Grille de vignettes rendues avec **ton** design, qui se mettent à jour quand le design, le support ou le format change ; rendu progressif (file d'attente, annulée si on quitte l'écran).
- Survol : **Télécharger** (rendu HD au format d'export courant) ou **Personnaliser** (applique ce modèle au projet et ouvre le Studio).
- Sélection multiple (case) → « Télécharger la sélection (.zip) ».

**Catalogue de modèles** (`src/quick/templates.ts`) : un modèle = support (catégorie) + modèle d'appareil par défaut + `Look` (fond, décor, lumière, caméra, sol, pose) + tags de filtre. Environ 8–12 par support, construits à partir de `SCENE_PRESETS`, des ambiances et des préréglages lumière/caméra existants.

**Détection du support** (`src/quick/detect.ts`), à partir des dimensions (ratio r = largeur / hauteur), règles appliquées dans cet ordre :
1. PDF → Print.
2. Capture pleine page : r < 0,4 et largeur ≥ 1000 px → Navigateur (défilement).
3. r < 0,6 (ex. 1179×2556) → Téléphone.
4. 0,69 ≤ r ≤ 0,73 (formats A, ex. 2480×3508) et hauteur ≥ 2000 px → Print ; sinon 0,6 ≤ r < 0,85 → Tablette.
5. 0,85 ≤ r ≤ 1,15 → Montre si largeur < 600 px, sinon Print (carré).
6. 1,15 < r ≤ 1,9 → Ordinateur ; r > 1,9 → Écran.
- Si r tombe à moins de 5 % d'une frontière, la puce affiche « à confirmer ». Les règles sont regroupées dans une table, couverte par `check-quick`.

## 6. Mode Projet

Une seule page, trois étapes visibles (indicateur 1-2-3) :

1. **Tes images** : liste des fichiers déposés (images, PDF → 1re page rendue, option « toutes les pages »), chacun avec son support détecté et un menu pour le corriger, réordonnables, supprimables ; « + Ajouter des images ». À côté, carte **Kit de marque** (optionnelle) : logo, couleurs, typos — le kit existant (`project.brand`).
2. **Style** : 6 styles en vignettes, chacune montrant la scène héro rendue dans ce style.
3. **Ton pack** : aperçu de
   - **Héro** : tous les supports réunis (jusqu'à 5 ; au-delà, les 5 plus « variés », choisis par catégorie), disposés avec `arrangeItems` ;
   - **un mock-up par image**, dans le même style ;
   - **Planche de présentation** (interrupteur, activée par défaut) : image 2D (canvas) composée du héro, de 3–4 mock-ups, du nom du projet, du logo et de la palette du kit de marque.
   Actions : « Télécharger le pack (.zip) », et sur chaque vignette « Télécharger » / « Ouvrir dans le Studio ».

Remplace le « Traitement par lot » 3D : déposer 10 captures d'app produit 10 mock-ups téléphone dans le même style (+ héro). Le lot reste disponible en mode Photo (page Design : « Appliquer à plusieurs designs »), en réutilisant `src/variants/batch.ts`.

**Import PDF** (`src/lib/pdf.ts`) : `pdfjs-dist` chargé à la demande ; page rendue à 200 dpi, plafonnée à 4096 px sur le grand côté ; accepté aussi dans Rapide, Studio et Photo partout où une image est acceptée.

## 7. Studio

Layout : barre du haut · **rail** à gauche (64 px) · **page** du rail (≈ 300 px) · canvas · **barre flottante** en bas du canvas.

Pages du rail (chacune plate, groupes avec simple titre, aucune section repliée) :

| Page | Contenu |
|---|---|
| Appareils | Bibliothèque : catégories en onglets, recherche, grandes vignettes. **Clic = ajouter** (glisser sur la scène fonctionne toujours). « Dans la scène » : liste des appareils (afficher/masquer, verrouiller, dupliquer, supprimer), « Disposer ». Import `.glb`. |
| Réglages | Appareil sélectionné : « Changer d'appareil » (remplacer), design(s) à l'écran par face, cadrage/alignement, finition, position, orientation et paramètres du modèle, luminosité, reflets, rotation, avant/arrière, centrer. S'ouvre automatiquement au clic sur un appareil dans le canvas. |
| Ambiance | Galerie des ambiances prêtes (tout-en-un). |
| Décor | Fond, décor (mur, bureau, podium…), sol — à plat. |
| Lumière | Préréglages en vignettes + réglages fins. |
| Caméra | Angles en vignettes + focale, profondeur de champ. |
| Texte | Textes et logo posés sur l'image. |
| Marque | Kit de marque, objets de marque (planche, nuancier, spécimen), visuels générés, « Pour tous ». |
| Vidéo | Animation, qualité, durée, format, taille, fps, aperçu, export vidéo/GIF. |

Barre flottante : format (16:9, 4:3, 1:1, 4:5, 9:16…), Recentrer, Aperçu plein écran, **✦ Idées** (ouvre la grille Variantes existante, restylée).

**Exporter** : fenêtre (`Sheet`) : format (PNG/JPG/WebP), qualité, taille, ratio, sortie en pixels, note profondeur de champ / JPG transparent, bouton Télécharger. L'onglet Export disparaît. Depuis la phase 2, liste des « Exports récents » du projet en bas de la fenêtre.

## 8. Photo

Même structure que le Studio. Rail : **Photos** (importer ma photo + photos fournies, une seule fois) · **Zones** · **Design** (+ « Appliquer à plusieurs designs ») · **Rendu** (fusion + géométrie). Centre : la photo ; sans photo, état vide avec « Importer ma photo » (les photos fournies restent dans la page Photos). Vidéo et Exporter comme dans le Studio.

## 9. Design system

### 9.1 Couleurs (variables CSS sur `:root`, thème Auto par défaut)

| Rôle | Clair « Apple » | Sombre vitré |
|---|---|---|
| `--bg` | `#f5f5f7` | dégradé `#14151a → #0b0b0e` |
| `--surface` (panneaux) | `#ffffff` + ombre `0 1px 2px rgb(0 0 0/.04), 0 8px 24px rgb(0 0 0/.05)` | `rgb(40 40 46/.55)` + `backdrop-filter: blur(20px) saturate(1.4)` + liseré `inset 0 0 0 1px rgb(255 255 255/.07)` |
| `--fg` / `--fg-muted` / `--fg-subtle` | `#1d1d1f` / `#6e6e73` / `#aeaeb2` | `#f5f5f7` / `#98989d` / `#636366` |
| `--accent` / `--accent-fg` | `#0071e3` / blanc | `#f5f5f7` / `#1d1d1f` |
| `--focus` | halo bleu | halo blanc |
| `--brand` | `#ff5c35`, **réservé au logo** | idem |

Contraste AA vérifié pour tous les couples texte/fond (`check-a11y`).

### 9.2 Typographie

- **Titres : Syne** (variable, `@fontsource-variable/syne`) — accueil (≈ 44–56 px, 700), noms des modes, titres des pages du rail (≈ 20 px, 700), titres des fenêtres. Interlettrage légèrement resserré.
- **Interface : Geist** (déjà embarquée) — corps 13 px, petits libellés 12 px, valeurs numériques en Geist Mono tabulaire.
- **Logo** : « Mockup » en Syne 800 + « Lab » en Syne 500 couleur `--brand`.
- Plus de micro-titres en majuscules.

### 9.3 Formes, espace, mouvement

- Rayons : 10 px (contrôles), 14 px (cartes, panneaux), 18 px (fenêtres) ; pastilles pour les sélecteurs.
- Grille de 4 px, groupes séparés de 20–24 px.
- Transitions type ressort 150–250 ms (changement de page du rail, fenêtres, survol des vignettes), `prefers-reduced-motion` respecté.
- Canvas : fond uni dégradé doux (plus de pointillés).

### 9.4 Composants (`src/ui/`)

Restylés : `Button`, `IconButton`, `Segmented`, `Slider`, `Switch`, `Field`, `Tooltip`, `Kbd`, `Dialog`, `Menu`. `Section` repliable → `Group` (titre simple). Nouveaux : `Rail`, `RailPage`, `Sheet`, `Chip`, `DropZone`, `ProjectCard`, `MockupTile`, `Stepper`, `FloatingBar`.

### 9.5 Skills à appliquer pendant la réalisation

`apple-design` et `frontend-design` (conception), `emil-design-eng` (micro-interactions), `design:design-system` (tokens/composants), `impeccable` + `web-design-guidelines` (audit de fin de phase), `design:accessibility-review` (accessibilité).

## 10. Projets, Récents, PWA, Electron

### 10.1 Projets multiples et Récents (`src/library/`)

- IndexedDB (`idb-keyval`, base `mockuplab`) : `project:<id>` (snapshot), `index` (liste `{ id, name, screen, updatedAt, thumbKey, exportCount }`), `asset:<id>` partagés entre projets, `thumb:<projectId>`, `export:<projectId>:<id>` (blob + métadonnées).
- Autosave par projet (mécanisme existant, clé par id). Miniature 320 px rendue au plus toutes les 30 s d'activité et en quittant le projet.
- Exports : chaque téléchargement (image, vidéo, ZIP) est conservé ; 10 derniers par projet, plafond global 500 Mo ; au-delà, les plus anciens sont supprimés, avec un message. `navigator.storage.persist()` demandé.
- Assets : nettoyés seulement quand plus aucun projet ne les référence.
- Actions : ouvrir, renommer, dupliquer, supprimer (confirmation), exporter en `.json`.
- **Migration** : la clé de projet actuelle devient le premier projet de la liste au premier lancement.

### 10.2 PWA (`src/pwa/`)

`vite-plugin-pwa` (Workbox) : manifeste (nom, icônes, couleurs des deux thèmes), précache du code de l'app, cache à la demande des textures/HDR/modèles (`public/assets`). Mode `prompt` : quand une nouvelle version est disponible, bannière « Nouvelle version disponible — Mettre à jour » ; on ne recharge jamais sans accord. Fonctionne hors ligne une fois chargée.

### 10.3 App bureau Electron (`desktop/`)

- Charge exactement le build web (`dist`) via un protocole interne fixe (`app://mockuplab/`) pour que l'origine — donc IndexedDB — reste stable d'une version à l'autre ; build avec `BASE_PATH=/`.
- `electron-builder` : `.dmg` (arm64 + x64) et installeur NSIS Windows ; workflow GitHub Actions déclenché par un tag `v*` (runners macOS et Windows), publication sur GitHub Releases.
- `electron-updater` : vérification au lancement puis toutes les 6 h ; l'app affiche la **même bannière** que la PWA (pont IPC exposé par un preload).
- Sans signature : Windows installe la mise à jour en un clic (avertissement SmartScreen à la première installation) ; macOS propose la mise à jour et ouvre la page de la release. Signature/notarisation Apple : prévue dans la configuration, activable plus tard sans refonte.
- Le site GitHub Pages reste en ligne et identique.

## 11. Correspondance ancien → nouveau (aucune perte)

| Aujourd'hui | Demain |
|---|---|
| Bibliothèque (gauche) | Studio › Appareils |
| Onglet Appareil › Appareil, Image d'écran | Studio › Réglages |
| Onglet Appareil › Composition | Studio › Appareils (« Dans la scène ») + Réglages (rotation, ordre) |
| Onglet Scène › Ambiances | Studio › Ambiance ; Rapide (galerie) |
| Onglet Scène › Décor, Fond, Sol | Studio › Décor |
| Onglet Scène › Lumière / Caméra | Studio › Lumière / Caméra |
| Onglet Marque › Kit, Mettre en valeur | Studio › Marque ; Projet (étape 1) |
| Onglet Marque › Textes | Studio › Texte |
| Onglet Export › Image | Fenêtre Exporter |
| Onglet Export › Vidéo | Studio/Photo › Vidéo |
| Variantes (haut) | ✦ Idées (barre flottante) ; Rapide › Plus d'idées |
| Lot (icône) | Mode Projet (3D) ; Photo › Design › Appliquer à plusieurs designs |
| 3D / Photo | Studio / Photo dans le sélecteur de modes |
| Nouveau / Ouvrir / Enregistrer | Menu du nom de projet ; Récents |
| Langue, thème, aide, réinitialiser | Menu `···` |
| Annuler / rétablir | Barre du haut (Studio, Photo) |
| Import .glb | Studio › Appareils |

## 12. Gestion des erreurs

- Détection incertaine : puce « à confirmer », l'utilisateur choisit ; jamais bloquant.
- PDF illisible/protégé/trop lourd : message clair, le fichier est ignoré, les autres continuent.
- Rendus en coulisse : file annulable (changement d'écran, nouvelle image), progression visible ; le projet de l'utilisateur n'est jamais modifié (bac à sable).
- Stockage plein : message ; suppression des exports les plus anciens ; jamais de suppression automatique de projet.
- Mise à jour (PWA/Electron) échouée : message discret, nouvel essai au prochain lancement ; jamais d'interruption du travail.
- Inchangés : écran « pas de WebGL », avertissement petit écran, annuler/rétablir, sauvegarde auto.

## 13. Phases de livraison

Chaque phase : plan d'implémentation, captures clair + sombre vérifiées, `check-*` verts, commit ; arrêt pour validation avant la suivante ; aucun push sans accord.

1. **Nouvelle interface** — design system, barre du haut, accueil (Rapide/Projet « Bientôt », ligne Reprendre), Studio en rail, Photo en rail, fenêtre Exporter, Idées. Aucune fonction ajoutée ni retirée.
2. **Projets & Récents** — § 10.1.
3. **Mode Rapide** — § 5.
4. **Mode Projet** — § 6 (dont import PDF).
5. **PWA** — § 10.2.
6. **App Electron** — § 10.3.

## 14. Tests et vérification

- `npm run typecheck` et `npm run build` à chaque phase.
- Scripts existants mis à jour pour les nouveaux sélecteurs (`check-photo-ui`, `check-variants`, `check-batch-photo`, `check-video`, `check-glb`, `check-a11y`, `shoot`, `scenes`…), avec des `data-testid` stables sur rail, modes et fenêtres.
- Nouveaux : `check-home` (accueil, dépose 1 vs plusieurs, Reprendre), `check-library` (multi-projets, migration de l'ancienne clé, exports conservés, nettoyage des assets), `check-quick` (table de détection + galerie + téléchargement), `check-project` (affectation, pack, planche, ZIP, PDF), `check-pwa` (hors ligne, bannière de mise à jour avec un second build), `check-desktop` (Electron lancé via Playwright `_electron`, persistance entre deux lancements).
- Captures de chaque écran en clair et en sombre, inspectées avant de les présenter.
