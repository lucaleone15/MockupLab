# Téléphone « réseaux », landing en récit 3D, app en verre dépoli — design

Date : 2026-10-21 · Statut : à valider (maquettes `.superpowers/brainstorm/57442-1792525273/content/retours-3.html`)

## Ce que l'utilisateur a dit

- Réseaux : « le but c'est que ce soit un mock-up de téléphone avec le post Insta et dedans on met notre image, pas un
  format pour exporter les visuels, c'est comme le navigateur que je voulais ».
- Landing : « plus d'interaction et un meilleur scrollytelling », « un mode clair », « que ça donne vraiment envie »,
  « la 3D pourrait nous suivre dans la navigation », « mettre plus les choses en avant, quelque chose de moderne ».
- App : « des ombres, du glassmorphism dans l'ensemble de l'app ».
- Il a invoqué les skills `ui-ux-pro-max` et `design-taste-frontend` : leurs règles s'appliquent.

**Design read** (skill design-taste) : landing de produit grand public pour designers et freelances, langage « page
produit Apple » en verre dépoli, Tailwind v4 + R3F + IntersectionObserver. Cadrans : DESIGN_VARIANCE 7,
MOTION_INTENSITY 7, VISUAL_DENSITY 3.

## 1. Le téléphone « réseaux » (un appareil, comme le Navigateur)

- Les téléphones gagnent un réglage **« Appli à l'écran »** : Aucune · Post Insta · Story · TikTok / Reel.
  - **Post Insta** : l'écran montre le fil (barre d'état, en-tête avec avatar et nom du compte, la photo du post, la rangée
    d'icônes, « J'aime », la légende) ; **l'image de l'utilisateur est la photo du post** (format 4:5, cadrée « couvrir »).
  - **Story** et **TikTok / Reel** : l'image remplit l'écran, l'interface est dessinée par-dessus (barre de progression,
    compte, champ « Envoyer un message » ; onglets « Abonnements · Pour toi », colonne d'icônes, compte et légende).
  - Nom du compte et légende : réglables dans la page Réglages de l'appareil (par défaut : la marque).
  - Interfaces génériques : icônes dessinées en vecteur, aucun logo ni nom de réseau.
- Le catalogue gagne une famille **« Réseaux sociaux »** : trois cartes (Post Insta, Story, TikTok / Reel) qui ajoutent un
  Phone Pro avec ce réglage. « Changer » sur un téléphone garde le réglage.
- **Retirés** : le cadre « Voir sur… » autour de la vue et l'option d'export « avec l'interface du réseau ». Le menu de la
  barre du bas redevient **« Formats »** (tailles exactes : post 4:5, carré, story, YouTube, LinkedIn, Pinterest).
  Migration : le champ `social` des projets devient les textes du téléphone (compte, légende) et disparaît.

## 2. La landing en récit 3D

Règles des skills appliquées : pas de hero centré (VARIANCE 7), pas de lueur bleue « IA », un seul accent (le bleu de
l'app), une seule échelle d'arrondis, pas de trois cartes égales, pas d'écouteur `scroll` (IntersectionObserver ou
animations CSS liées au défilement), aucun tiret long (—) dans les textes, au moins 4 familles de mise en page
différentes, `prefers-reduced-motion` respecté partout, clair **et** sombre conçus ensemble.

- **Thème** : la page suit le thème de l'app (Auto / Clair / Sombre). Les deux sont dessinés : sombre = studio de nuit ;
  clair = studio blanc lumineux, ombres teintées.
- **Hero en deux colonnes** : à gauche le titre (2 lignes max), une phrase (20 mots max), « Ouvrir le Studio » ;
  à droite la scène 3D (portable + téléphone).
- **La 3D suit le récit** : la scène 3D reste collée à droite pendant que les chapitres défilent à gauche (≥ 1024 px ;
  sur mobile, un visuel fixe par chapitre). À chaque chapitre, la scène passe en douceur (≈ 600 ms, ressort) à un état :
  1. pourquoi : les appareils se rapprochent, l'écran du portable montre l'app ;
  2. appareils : le téléphone change de modèle et de couleur, une tablette entre ;
  3. studio : le sol et le fond changent (studio photo → podium → table en bois) ;
  4. ça bouge : rotation rapide façon « turntable » ;
  5. réseaux : le téléphone pivote face à nous et affiche un **post Insta** (l'appareil du point 1) ;
  6. clients : plusieurs appareils en éventail.
  Des **points de navigation** (étiquetés, cliquables, au clavier) montrent le chapitre en cours. Le pointeur incline
  légèrement la scène. Hors écran, la 3D ne dessine plus.
- **Après le récit** (familles de mise en page différentes) : une **grille bento** des vrais rendus (tailles variées),
  les **trois modes** (grand Studio + deux), les **projets récents**, une **bande défilante unique**, la **fin**
  (« Gratuit. Open source. Chez toi. »), un seul libellé de bouton principal sur toute la page (« Ouvrir le Studio »).
- Les chiffres « 30 s · 0 € · 100 % » passent en texte dans le chapitre « pourquoi » (plus de trois cartes égales).

## 3. Toute l'app en verre dépoli

- **Jetons** dans `src/index.css` (clair et sombre) : surface de verre (`--glass`), bord intérieur clair, reflet en haut,
  **3 niveaux d'ombre teintés** (panneaux, menus/fenêtres, éléments flottants), flou 20–28 px + saturation.
- **Où** : rail, panneau de page, barre du haut, barre flottante, fenêtres (Sheet), menus, info-bulles, cartes de la
  bibliothèque, écrans Rapide et Projet. La zone autour de la vue 3D reçoit un **fond coloré doux** (dégradé neutre
  teinté de bleu, clair ou sombre) pour que le verre se lise.
- **Lisibilité** : texte ≥ 4,5:1 sur le verre dans les deux thèmes (verre plus opaque en clair, ≈ 70 %).
  `prefers-reduced-transparency` : surfaces pleines, sans flou (déjà prévu, à étendre).
- Une seule échelle d'arrondis : boutons en pilule, panneaux 16 px, champs 10 px.

## Non-buts

- Pas de nouveau moteur d'animation lourd si IntersectionObserver + transitions suffisent (pas de GSAP sauf besoin
  prouvé). Les icônes restent Lucide (déjà la bibliothèque du projet).
- Pas de changement des fonctions du Studio au-delà du téléphone « réseaux ».

## Vérification

- Scripts : téléphone réseaux (réglage, catalogue, image dans le post, export), landing (chapitres, 3D qui change
  d'état, points de navigation, clair/sombre, mouvement réduit, aucun `—`), verre (jetons appliqués, contraste mesuré
  en clair et en sombre, transparence réduite). Tous les checks existants, les parcours d'usage, `npm run build`.
- Captures relues en clair et en sombre avant chaque commit.
