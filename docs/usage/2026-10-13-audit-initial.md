# Audit d'usage initial — 2026-10-13

Cinq parcours joués comme un humain (`node scripts/usage/run-all.mjs`, dev server, Chromium 1440×900, profil vierge) :
le script ne clique que sur ce qui est visible et nommé à l'écran. Captures : `out/usage/<parcours>/`.

| Parcours | Abouti | Temps | Clics | Frictions |
|---|---|---|---|---|
| Débutant pressé — capture d'appli → post Insta 4:5 | oui | 3,8 s | 3 | 0 détectée, 2 vues sur les captures |
| Graphiste print — affiche A1 + flyer + carte, mur assorti, 4K | oui | 2,9 s (+ export) | 16 | 3 + 3 vues sur les captures |
| Freelance — pack client en Projet | oui | 11,1 s | 4 | 2 + 2 vues sur les captures |
| Créateur vidéo — Reel vertical MP4 | oui | 56,1 s (export ≈ 50 s) | 6 | 1 |
| Photo — design web sur une photo fournie | oui | 5,5 s | 7 | 1 |

Les temps sont ceux d'un robot qui sait où cliquer : un humain met bien plus longtemps. Ce qui compte, ce sont les **clics**
et les **endroits où il faut deviner**.

## Frictions, de la plus grave à la moins grave

1. **[bloquant] Projet : impossible de choisir les couleurs du pack.** La palette de marque (à droite) n'habille que la planche ;
   les 6 styles ont des couleurs figées. `freelance-pack/05-…png`
2. **[surprenant] Print : « Disposer » casse la scène.** Avec une affiche au mur + flyer + carte, la caméra passe en plongée,
   l'affiche est de travers, le flyer et la carte sont minuscules au sol, et un **triangle noir** apparaît en bas à gauche
   (bord du mur / du sol). `graphiste-print/07-disposer.png`
3. **[surprenant] Print : le téléphone d'exemple réapparaît.** Le 1er clic sur « Affiche » remplace le téléphone, mais il revient
   (grisé) dans « Dans la scène » après l'ajout du flyer et de la carte. `graphiste-print/06-…png`
4. **[surprenant] Studio : on arrive sur « Réglages » du téléphone d'exemple**, pas sur la liste des appareils. Pour ajouter une
   affiche il faut d'abord trouver « Appareils ». `graphiste-print/01-…png`
5. **[surprenant] Print : le format de l'affiche est caché dans « Réglages »**, loin de l'endroit où on a choisi l'affiche.
   On fait l'aller-retour Appareils ↔ Réglages pour chaque objet. `graphiste-print/04-…png`
6. **[surprenant] Projet : la carte de visite est détectée comme « Ordinateur ».** (`sample-card-front.png`, sombre, paysage.)
   `freelance-pack/03-…png`
7. **[surprenant] Projet : le kit de marque est pré-rempli avec la marque d'exemple « Solstice »** sur un profil vierge : on ne
   sait pas si ce sont ses couleurs ou celles de l'exemple. `freelance-pack/06-…png`
8. **[surprenant] Photo : après le choix d'une photo, le bandeau dit « Glisse ton design sur une zone, ou Essayer un exemple »** —
   pas de bouton pour parcourir ses fichiers ; il faut deviner l'onglet « Design ». `photo/03-…png`
9. **[surprenant] Vidéo : pas de préréglage Reel / TikTok** ; il faut savoir régler 9:16, 1080p, 30 i/s et la durée.
   Le bouton « Exporter la vidéo » est sous la ligne de flottaison. `createur-video/05-…png`
10. **[lent] Rapide : les vignettes arrivent une par une** ; 4 rendus en ≈ 1 s, mais la 2e rangée reste en spinners pendant
    plusieurs secondes. `debutant/05-…png`
11. **[surprenant] Rapide : la vignette « Aurora & reflet » est voilée** (brume violette sur le téléphone). `debutant/05-…png`
12. **[surprenant] Accueil : les 4 modes sont sous la ligne de flottaison** ; le premier écran ne montre que la zone de dépôt.
    `debutant/01-accueil.png`
13. **[surprenant] Projet et Rapide : les appareils occupent peu de place dans le cadre** (beaucoup de vide autour).
    `freelance-pack/07-…png`

## Ce que les phases prévues corrigent

- 1 → phase 4 (couleurs du pack)
- 4, 12 → phase 1 (modes clairs, Studio principal, accueil)
- 2 (triangle noir, mur/sol), 3 → phase 2 (fond unifié et décor) — à confirmer pendant la phase
- 5 → phase 3 (formats print : le format est le premier réglage qu'on voit)
- 9 → phase 5 (préréglage Reel / TikTok)

## Frictions hors phases (à décider)

- 6 détection carte de visite → print
- 7 kit de marque d'exemple pré-rempli
- 8 bouton « parcourir » dans le bandeau du mode Photo
- 10 vitesse des vignettes Rapide
- 11 vignette Aurora voilée
- 13 cadrage plus serré dans Rapide et Projet
- 2 (partie « Disposer » : caméra plongeante, objets minuscules)
