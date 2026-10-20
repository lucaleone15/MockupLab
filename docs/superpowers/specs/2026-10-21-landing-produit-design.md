# Landing façon page produit — design

Date : 2026-10-21 · Statut : validé en conversation (maquettes dans `.superpowers/brainstorm/57442-1792525273/content/`), à relire

## But

La page d'accueil doit **présenter le projet et dire pourquoi il existe**, avec une narration de page produit Apple :
de grands titres, une phrase, de grands visuels, section après section, qui montrent tout ce que MockupLab propose.
Ce que l'utilisateur a dit : « présente bien le projet et pourquoi ça existe », « le storytelling comme une page produit
Apple qui dit tout ce que ça propose », « un truc avec de la 3D avec les produits, avec quelque chose qui tourne »,
« je n'aime pas tellement la police Syne », « deux polices différentes pour les textes et les titres »,
« que les studios mis en avant aient un fond classe et une belle lumière ».

## Décisions prises avec l'utilisateur

- **Hero : vraie 3D en direct (option A).** Les vrais modèles de MockupLab (un portable et un téléphone avec les designs
  d'exemple) tournent lentement dans un studio sombre, rendus par le moteur 3D de l'app. Le défilement de la page les fait
  pivoter, la souris les incline légèrement.
- **Police des titres : Archivo Expanded** (Archivo à 125 % de largeur, graisse 700–800), **dans toute l'app** à la place de
  Syne. **Textes : Geist** (inchangé). Deux polices différentes, comme demandé.
- **L'histoire, de haut en bas (8 sections)** :
  1. **Hero 3D** — titre, une phrase, « Ouvrir le Studio ».
  2. **Pourquoi** — un mock-up prend des heures dans Photoshop et les modèles sont payants ; ici c'est gratuit, ça prend
     30 secondes, et rien ne quitte ton ordinateur.
  3. **Des dizaines d'appareils** — téléphones, portables, écrans, print, objets, ta marque — grand visuel qui défile.
  4. **Un vrai studio** — fonds, podiums, vraies tables en marbre et en bois, lumière de studio.
  5. **Ça bouge** — plans cinéma et vidéos pour Reels / TikTok (une vidéo en boucle faite par MockupLab).
  6. **Voir sur les réseaux** — le mock-up dans un post, une story, un TikTok.
  7. **Pour tes clients** — Rapide, Projet (pack assorti), historique des exports.
  8. **Fin** — gratuit, open source, web + app Mac/Windows — « Ouvrir le Studio ».
  Chaque section : un grand titre (Archivo Expanded), une phrase (Geist), un grand rendu fait avec MockupLab.
- **Tous les rendus de la page sont refaits** sur des **fonds soignés avec une belle lumière** (studio sombre profond,
  dégradés doux, vraies matières), par le script de vitrine.

## Non-buts

- Pas de changement des écrans Studio, Rapide, Projet au-delà de la police des titres.
- Pas de vidéo hébergée ailleurs : tout ce que la page montre est produit par MockupLab et livré avec l'app.

## Anti-buts

- Une page lente ou saccadée : le hero doit rester fluide (60 i/s sur un Mac récent), s'arrêter de tourner quand il
  n'est plus visible, et ne pas bloquer l'affichage du titre pendant le chargement de la 3D.
- Des rendus quelconques (fond gris plat, lumière plate) : chaque visuel doit avoir l'air d'une photo de produit.
- Du texte qui promet plus que l'app ne fait.

## Contraintes

- Même branche `simplify-feedback`, commits sans ligne co-auteur Claude, pas de push.
- `prefers-reduced-motion` : le hero ne tourne pas tout seul et les défilements sont désactivés (images fixes).
- Sans WebGL 2 (vieux navigateur) : le hero affiche une image fixe à la place de la 3D.
- La police est intégrée à l'app (paquet `@fontsource-variable/archivo`, axe de largeur), pas chargée depuis Google Fonts
  (l'app fonctionne hors ligne et en application de bureau).
- FR et EN pour tous les textes ; les checks existants (`check-home`, `check-a11y`, `check-theme`…) passent, adaptés si
  l'interface change ; `npm run build` passe.

## Laissé au builder

- Le moteur du hero : le composant `Stage` de l'app dans un canvas dédié, ou une petite scène R3F qui réutilise les modules
  des modèles (`src/models/*`) et l'éclairage studio — au choix, tant que ce sont les vrais modèles et la vraie lumière.
- La mise en page exacte de chaque section, les animations d'apparition au défilement (sobres), les textes exacts
  (courts, dans le ton de l'app, tutoiement).
- Les scènes des rendus (appareils, fonds, matières, lumière), tant qu'elles sont soignées et variées.

## Vérification

- `check-home` étendu : les 8 sections sont présentes dans l'ordre ; le hero contient un canvas 3D qui s'anime
  (deux captures à 1 s d'écart diffèrent) ; avec `prefers-reduced-motion`, il ne bouge pas ; les titres sont en
  Archivo (`getComputedStyle(h1).fontFamily`), les textes en Geist ; les cartes des modes restent sur une ligne.
- Captures de la page entière relues avant le commit (thème sombre, et à 1280 × 720).
