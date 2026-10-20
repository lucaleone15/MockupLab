# Retours du 20 octobre (2ᵉ tour) : Studio épuré, export unique, aperçu réseaux, projets nommés, accueil — design

Date : 2026-10-20 · Statut : validé en conversation (maquettes dans `.superpowers/brainstorm/42711-1792508722/content/`), à relire

## But

L'utilisateur a essayé la version de la branche `simplify-feedback` (commit `40a2713` : mode Photo retiré, scène vide,
dispositions, scènes toutes prêtes, Lumière simplifiée, « Paramètres avancés » replié, guide). Son verdict : « il y a trop
d'options, c'est pas clair ». Ce tour rend le Studio plus lisible, met l'export image et vidéo au même endroit, remplace
les formats réseaux par un vrai **aperçu dans l'interface du réseau**, fait qu'**aucun projet ne reste « Sans titre »**
et que **chaque export se retrouve**, et refait l'accueil pour mettre le Studio en valeur.

Ce qu'il a dit, presque mot pour mot :
- Ambiance : « on peut enlever, ça sert à rien. On part de base sur Studio sombre et après on peut éditer ».
- Appareils : « pas du tout lisible, pas pratique… trop d'options, c'est pas clair » ; les scènes toutes prêtes :
  « c'est bien de pouvoir régler bien propre », mais leur pertinence est douteuse et l'UX « pas agréable ».
- Décor : la différence entre « Aucune » et « Studio » n'est pas claire, « ça fait beaucoup d'options » ;
  « le plus important, c'est de mettre la couleur de fond ».
- Lumière : bien. Caméra, Réglages : ok.
- Marque : « peut-être un peu trop de choses… trier, ou rendre ça plus clair ».
- Vidéo : l'aperçu ne s'arrête qu'avec Échap, il faut pouvoir recliquer ; le petit badge au point bleu au milieu de la
  barre du bas est moche ; « pour exporter en vidéo il faut aller dans Vidéo », alors que ça devrait être dans
  **Exporter**, avec les deux options. Il veut **une icône qui illustre chaque animation**.
- Réseaux : « le carrousel Insta ça sert à rien » ; il voulait **voir son mock-up dans l'interface** d'Instagram, TikTok,
  YouTube…
- Accueil : ne met pas assez le projet en valeur ; il reste de l'orange alors que l'app est bleue (logo à revoir) ;
  mettre en avant des mock-ups simples faits avec le Studio ; Rapide et Projet doivent prendre toute la largeur (« il y a un trou »).
- Projets : on travaille toujours en « Sans titre », on ne retrouve rien ; donner un nom en arrivant dans le Studio ;
  retrouver **tous les exports** d'un projet, avec leurs réglages, et pouvoir **les reprendre**.

## Non-buts

- Pas de nouveau mode Photo, pas de retour des formats carrousel.
- Pas de vraie publication sur les réseaux : l'aperçu est une imitation générique, sans logo ni marque officiels.
- Lumière, Caméra, Réglages (page de l'appareil sélectionné) ne changent pas, sauf ce qui en découle ci-dessous.
- Les modes Rapide et Projet ne changent pas, sauf le nom du projet et les exports retrouvables.

## Anti-buts (ce qui serait un échec même si ça marche)

- Ajouter des réglages au lieu d'en enlever : chaque page doit montrer **moins** de choses qu'aujourd'hui au premier coup d'œil.
- Cacher l'essentiel dans « Paramètres avancés » : la couleur du fond, le choix d'un appareil, l'export vidéo restent à un clic.
- Une interface de réseau qui ressemble à s'y méprendre à la vraie (logos, noms de marque) : elle doit rester générique.
- Perdre un projet ou un export existant pendant la migration.

## Contraintes

- Travail sur la branche `simplify-feedback`, à la suite de `40a2713` (non fusionnée). Un commit par phase, messages
  sans ligne co-auteur Claude, **pas de push** sans l'accord de l'utilisateur.
- Projets existants (IndexedDB, fichiers `.json`) : ils doivent s'ouvrir sans erreur ; les champs qui disparaissent sont
  migrés dans `migrateProject` (`src/store/persistence.ts`).
- Les scripts `scripts/check-*.mjs` et `scripts/usage/*` sont mis à jour en même temps que l'interface ; tous passent
  à la fin de chaque phase, plus un script par phase pour les nouveautés.
- FR et EN pour tous les textes (`src/i18n/fr.ts`, `en.ts`).
- Le guide de démarrage (`src/shell/Tour.tsx`) suit l'interface : ses étapes sont mises à jour à chaque phase qui
  touche une partie qu'il présente.

## Phases

| # | Phase |
|---|---|
| 1 | Studio épuré : Ambiance retirée, page Appareils, Décor, Marque |
| 2 | Export unique image / vidéo, aperçu vidéo, page Vidéo retirée |
| 3 | Aperçu dans l'interface des réseaux, carrousel retiré |
| 4 | Projets nommés, page projet avec tous ses exports |
| 5 | Accueil |

Chaque phase : captures (`out/…`) relues avant le commit, tous les checks verts, rapport court à l'utilisateur.

## 1. Studio épuré

### 1.1 Ambiance retirée (décidé)
- La page **Ambiance** disparaît du rail. Une nouvelle scène part du « Studio sombre » (c'est déjà `initialProject()` :
  fond dégradé radial sombre, pas de décor, lumière studio) ; on règle le reste dans Décor, Lumière, Caméra.
- Le bouton « Varier ma scène » (variantes) reste dans la barre du bas : c'est lui qui propose des looks.
- `SCENE_PRESETS` reste utilisé ailleurs (variantes, modes Rapide et Projet) ; seul le composant `Looks` et son entrée
  de rail sont retirés.

### 1.2 Page Appareils — option A des maquettes (décidé)
- En haut, **les appareils de la scène** : une ligne par appareil, plus grande qu'aujourd'hui, avec une silhouette de
  l'appareil, son nom, un bouton **⋯** (dupliquer, masquer, verrouiller) et une **corbeille toujours visible**.
  L'appareil sélectionné est entouré. Scène vide : la phrase actuelle (« La scène est vide… »).
- **Disposition** (Équilibrée, En ligne, Éventail, Cascade) sous la liste, seulement à partir de 2 appareils (inchangé ;
  en carrousel, ce choix disparaissait — sans carrousel après la phase 3, il est toujours là).
- La taille d'un print sélectionné reste affichée sous la liste (comme aujourd'hui).
- Un grand bouton **« ＋ Ajouter un appareil »**. La bibliothèque n'est plus affichée en permanence : le bouton ouvre une
  **fenêtre catalogue** avec, à gauche, les familles (Téléphones, Ordinateurs, Tablettes, Écrans, Navigateur, Montres,
  Affichage, Print, Objets & textile, Marque, Mes modèles 3D, **Plusieurs appareils**) et, à droite, de grandes cartes.
  Un clic sur une carte ajoute l'appareil (placement automatique, comme aujourd'hui) et ferme la fenêtre.
- **Plusieurs appareils** = les scènes toutes prêtes actuelles (`src/lib/compositions.ts`), présentées comme les autres
  cartes. Elles ne sont plus un bloc permanent sur la page.
- L'import `.glb` reste dans « Mes modèles 3D ».
- *À la discrétion du builder* : glisser une carte du catalogue vers la scène (le glisser-déposer actuel) peut être
  conservé ou abandonné ; la fenêtre peut être un `Sheet` ou un panneau ancré au bouton.

### 1.3 Décor — maquette v2 (décidé)
La page pose deux questions, dans cet ordre.
1. **La couleur du fond**, tout en haut, le réglage le plus important :
   un grand carré de la couleur actuelle (clic → sélecteur de couleur natif), le code hexadécimal modifiable, une rangée
   de 8 couleurs toutes prêtes (et les couleurs de la marque si la marque est remplie). Juste dessous, le type de fond :
   **Couleur · Dégradé · Motif · Image** (Transparent dans les paramètres avancés du fond). Choisir Dégradé, Motif ou
   Image montre ses réglages (fonds tout prêts pour le dégradé, motifs, choix de l'image) ; leurs réglages fins
   (angle, échelle, grain, flou, assombrir…) restent sous « Paramètres avancés ».
   Avec un dégradé ou un motif, le grand carré règle la couleur principale.
2. **« Sur quoi poser l'appareil ? »** : 4 grandes cartes illustrées, chacune avec une phrase :
   - **Rien** — l'appareil flotte devant le fond (`decor.kind = 'none'`) ;
   - **Studio photo** — sol et mur courbes, ombres au sol (`'sweep'`) ;
   - **Podium** — un socle, peint ou en matière (`'podium'`) ;
   - **Vraie table** — bois, marbre… dans une vraie pièce (`'table'`).
   Les réglages de chacun (matière, couleur du podium, forme, arche, ombres de fenêtre, ambiance de la pièce) sont sous
   « Paramètres avancés ». **Surface** (`'surface'`, une matière fondue dans le fond) n'est plus un choix de premier
   niveau : dans « Vraie table », une option avancée « Sans la pièce » la donne. La section **Sol** (ombre, reflet)
   rejoint les paramètres avancés du Décor.
- Migration : rien à migrer, les valeurs de `decor.kind` ne changent pas.

### 1.4 Marque (décidé par Claude, à vérifier par l'utilisateur)
- Visible : nom, logo, couleurs, polices (titre et texte), et la note « Marque d'exemple · Partir de zéro ».
- Sous « Paramètres avancés » : la signature, la planche de marque, les visuels générés, nuancier et spécimen 3D, et
  les ajouts de calques palette / typo.

### 1.5 Guide
Étapes retirées : Ambiance. Étape Appareils : parle du bouton « Ajouter un appareil ». Étape Décor : « commence par la
couleur du fond ».

## 2. Export unique image / vidéo

- Le bouton **Exporter** (barre du haut, ⌘E) ouvre la fenêtre d'export avec deux onglets **Image | Vidéo**.
  - Image : format, taille, qualité (inchangé) + la case de la phase 3.
  - Vidéo : **l'animation**, puis durée (6 / 10 / 15 s), qualité (Cinéma / Rapide), format (MP4 / WebM / GIF), taille,
    cadence, le bouton « Reel / TikTok », **Aperçu** et **Exporter la vidéo**.
- **Vignettes d'animation** : chaque animation a une vignette illustrée (une petite scène schématique — un appareil,
  une flèche de mouvement) qui **joue l'animation en boucle au survol** (SVG/CSS animé, pas un rendu 3D). Le nom sous la
  vignette. Les groupes « Plans cinéma » et « Classiques » restent.
- **Aperçu** : la fenêtre se met de côté pendant l'aperçu ; le bouton devient **« ■ Arrêter »** et l'arrête au clic ;
  Échap marche toujours. Le badge au point bleu qui apparaissait au milieu de la barre du bas est supprimé ; à la place,
  un bouton « ■ Arrêter l'aperçu » discret en haut de la vue (ou le seul bouton de la fenêtre) — *à la discrétion du
  builder, tant qu'il ne recouvre pas la barre du bas*.
- La page **Vidéo** du rail disparaît. `export.kind` n'a plus besoin d'être stocké dans le projet : l'onglet choisi
  vit dans l'interface ; ⌘E ouvre la fenêtre sur le dernier onglet utilisé.
- Guide : l'étape Vidéo disparaît, l'étape Exporter dit « une image ou une vidéo ».

## 3. Aperçu dans l'interface des réseaux

- Le carrousel Insta est retiré (ratios `c{n}-4x5|1x1`, découpe en slides, ZIP de slides, `arrangeInRow` si plus utilisé,
  guides de découpe). Migration : un projet en carrousel passe en post Insta (`ig-post`).
- Les zones de sécurité (pointillés roses) sont retirées : l'interface du réseau les remplace.
- Dans la barre du bas, le menu « Réseaux » devient **« Voir sur… »** avec : Post Insta, Story, TikTok / Reel, YouTube
  (et « Aucun »). Choisir un réseau règle le ratio et la taille qui vont avec (comme les formats sociaux actuels) et
  **affiche autour / par-dessus la vue une interface générique** de ce réseau :
  - Post Insta (4:5) : en-tête avec avatar et nom du compte, l'image, la rangée d'icônes, « J'aime », la légende ;
  - Story (9:16) : barre de progression, avatar, nom, « il y a 2 h », champ « Envoyer un message » ;
  - TikTok / Reel (9:16) : onglets « Abonnements · Pour toi », colonne d'icônes à droite, nom et légende en bas ;
  - YouTube (16:9) : la vidéo, le titre, la chaîne et son nombre d'abonnés.
  Icônes génériques (cœur, bulle, avion…), **aucun logo ni nom de marque**.
- Nom du compte, avatar et légende : remplis par défaut avec la marque (nom → `@nom`, logo → avatar), modifiables dans
  le menu « Voir sur… ». Stockés dans le projet (`social: { network, account, caption, title }`, migré à vide).
- Export image : une case **« Avec l'interface du réseau »**, décochée par défaut, visible seulement quand un réseau
  est choisi. Cochée, l'image exportée contient l'interface (dessinée en 2D sur le canvas d'export, à la taille d'un
  écran de téléphone mis à l'échelle, ou de la page YouTube). La vidéo ne prend pas l'interface (non-but de ce tour).

## 4. Projets nommés, exports retrouvables

### 4.1 Un nom au départ
- Quand le Studio s'ouvre sur un **nouveau projet** (jamais nommé : `name === 'Untitled'` et aucun export), une petite
  fenêtre **« Nouveau projet »** demande un nom (champ prérempli vide, bouton « Créer », lien « Plus tard »).
  Même chose pour **Nouveau projet** du menu du projet.
- « Plus tard » : le projet reste « Sans titre » ; la fenêtre revient **au premier export** (avant le téléchargement).
- Le guide de première visite s'ouvre après cette fenêtre, pas en même temps.
- Rapide et Projet : la fenêtre s'ouvre seulement au moment où leur travail devient un projet (envoi vers le Studio,
  premier export), *à la discrétion du builder selon le flux existant de `library`*.

### 4.2 Page d'un projet
- Sur l'accueil (« Récents », « Tout voir »), un clic sur un projet ouvre **sa page** (fenêtre ou écran) : vignette,
  nom (renommable), date, et **tous ses exports**, du plus récent au plus ancien, le dernier marqué « Dernier ».
  Bouton principal « Ouvrir dans le Studio ».
- Chaque export : vignette, type et réglages (ex. « PNG · 4K · 16:9 », « MP4 · 1080p · 10 s »), un résumé de la scène
  (décor, angle), la date, et deux boutons :
  - **Télécharger** — le fichier gardé ;
  - **Reprendre** — ouvre le Studio sur la scène **exactement comme au moment de cet export** (appareils, images, fond,
    décor, lumière, caméra, format, textes). C'est une étape annulable (⌘Z revient à la scène d'avant).
- Stockage (`src/library/exports.ts`) : chaque export garde en plus un **instantané du projet** (le `Project` sérialisé,
  sans les images, qui sont des assets du projet) et ses réglages d'export. Les images référencées par un instantané
  sont conservées tant que l'export existe (`referencedAssets` les compte).
- Limites : les **fichiers** restent plafonnés (aujourd'hui 10 par projet et 500 Mo en tout ; passer à 30 par projet),
  mais **la fiche et l'instantané d'un export ne sont jamais supprimés** automatiquement : quand son fichier a été
  libéré, la fiche reste et propose « Reprendre » (puis exporter à nouveau) au lieu de « Télécharger ».
- La liste « Exports récents » en bas de la fenêtre d'export peut rester ou renvoyer vers la page du projet —
  *à la discrétion du builder*.

## 5. Accueil — option B des maquettes (décidé)

- **Bleu partout, plus d'orange** : `--brand` passe au bleu de l'app ; le logo (« Mockup**Lab** ») et l'icône de l'app
  (pastille orange, dégradé du téléphone) sont refaits en bleu/violet (`scripts/make-icons.mjs`, `public/icons/*`,
  favicon, icône Electron). La marque d'exemple « Solstice » (orange) n'est pas concernée : c'est un exemple de marque.
- En-tête façon page produit : titre centré (« Le studio photo de tes designs. »), une phrase, le bouton
  « Ouvrir le Studio ».
- Dessous, en grand, **une capture du Studio en train de faire un mock-up** (rail, panneau, vue avec un beau rendu),
  générée par un script comme les captures actuelles (`scripts/make-showcase.mjs`).
- Puis les **trois modes sur une seule ligne qui remplit la largeur** (Studio plus large, Rapide, Projet), sans trou.
- Puis un **défilé de mock-ups** faits avec le Studio (les images de `public/showcase`, régénérées avec des rendus
  simples et propres : un téléphone, un portable, une table, un studio), et les projets récents.
- Les captures qui montraient le mode Photo ont déjà été retirées.

## Laissé au builder

- Composants et fichiers exacts, découpage interne, noms de clés i18n.
- Le dessin des vignettes d'animation et des interfaces de réseau, dans le respect des maquettes et des anti-buts.
- Les petits textes d'aide, tant qu'ils sont courts.

## Vérification

- Un script par phase (`check-studio-2`, `check-export-2`, `check-social-preview`, `check-projects`, `check-home` mis à
  jour) qui joue le parcours visible et prend des captures relues avant chaque commit.
- Tous les `check-*.mjs` existants et `scripts/usage/run-all.mjs` passent (adaptés quand l'interface a changé).
- `npm run build` passe.
