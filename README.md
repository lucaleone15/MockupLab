# MockupLab

**Générateur de mock-ups 3D gratuit, open source et 100 % local.**
Glisse un screenshot, obtiens un rendu d'appareil réaliste et exporte-le en vraie image (PNG, JPG, WebP) jusqu'en 4K. Aucun serveur, aucun upload : tes images ne quittent jamais ton navigateur.

> *English summary: free, open-source, in-browser 3D mock-up generator. Drop a screenshot, get a photoreal device render, export PNG/JPG/WebP up to 4K. No backend, no upload. UI available in French and English.*

---

## Fonctionnalités

| | Statut |
|---|---|
| Téléphones : Phone Pro (îlot), Phone (encoche), Phone Neo (style Android, poinçon) — portrait / paysage | ✅ |
| Tablettes : Tablet Pro 11 & 13 — portrait / paysage | ✅ |
| Portables : Laptop 14 & Laptop Air 13 — angle d'ouverture réglable, encoche optionnelle, clavier complet QWERTY / AZERTY | ✅ |
| Écrans : Desktop 24 (tout-en-un coloré), Display 27, Monitor 27 | ✅ |
| Fenêtre de navigateur : clair / sombre, barre compacte ou onglets, carte 3D ou plat, URL personnalisable | ✅ |
| Écran fidèle aux couleurs (pas d'effet « autocollant ») + reflet de vitre réglable | ✅ |
| **Print** : carte de visite (seule, recto/verso, pile), carte postale, flyer A4/A5, affiche (au mur ou posée, cadre noir/blanc/chêne, passe-partout, verre), dépliant 3 volets (intérieur/extérieur, ouverture réglable), magazine ouvert/fermé, livre relié, papeterie (lettre + enveloppe), badge avec tour de cou, roll-up — finition mate / satinée / brillante | ✅ |
| **Objets & textile** : boîte (3 formats, face/côté/dessus), tube, mug (5 céramiques), bouteille avec étiquette (4 verres), tote bag et t-shirt à plat (7 coloris de tissu, trame réelle, plis) | ✅ |
| **Ambiances complètes en un clic** (fond, décor, lumière, caméra, sol) | ✅ |
| **Mise en scène « table »** : table en vraie matière contre un mur uni (couleur au choix), lumière du jour / soleil / fin de journée, ombres projetées de fenêtre, stores ou feuillage, profondeur de champ réaliste | ✅ |
| **Matières photographiées (PBR)** : chêne, noyer, marbre blanc, marbre noir, travertin, terrazzo, béton ciré, lin | ✅ |
| Décors 3D : studio à fond courbe, podium (peint ou en vraie matière, cylindre / bloc, arche), surface en vraie matière fondue dans le fond | ✅ |
| Fonds 2D : uni, dégradé multi-couleurs (linéaire / radial / conique, éditeur), motifs graphiques (aurora, grain, topographie, trame, grille, blueprint), image floutée / assombrie, transparent | ✅ |
| Éclairage : 7 ambiances (studio doux, haute clé, dramatique, néon, lumière du jour, heure dorée, sombre premium) + intensité, couleur, direction, hauteur, douceur des ombres, reflets, exposition | ✅ |
| Caméra : face, 3/4, isométrique, dessus (appareil posé à plat), plongée, contre-plongée, orbite libre, focale 14–600 mm, profondeur de champ physique | ✅ |
| Sol : ombre douce / contact / aucune, réflexion au sol avec fondu réaliste | ✅ |
| Export PNG / JPG / WebP, 1080p · 2K · 4K, 7 ratios, supersampling ×2, rendu par tuiles | ✅ |
| **Compositions multi-appareils** : ajout (bouton + ou glisser depuis la bibliothèque), sélection au clic, déplacement à la souris, rotation (Alt + glisser, R), duplication, masquage, verrouillage, disposition automatique | ✅ |
| **Textes & logo** sur le rendu (3 polices, graisse, taille, couleur, interlettrage, position, glisser avec aimantation), exportés avec l'image | ✅ |
| **Sauvegarde automatique** dans le navigateur (images comprises), projet en `.json` (images intégrées) : nouveau / ouvrir / enregistrer | ✅ |
| Glisser-déposer (une image déposée sur un appareil va sur son écran), coller (⌘V), undo/redo, raccourcis (touche ?), thème clair/sombre, FR/EN | ✅ |
| Mode photo (perspective sur 4 coins) | 🔜 jalon f |
| Variantes automatiques & traitement par lots (ZIP) | 🔜 jalon g |
| Vidéo / GIF (turntable, défilement) | 🔜 jalon h |
| Import de modèles `.glb` | 🔜 jalon i |

## Démarrer

Prérequis : Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # sert le build sur http://localhost:4173/MockupLab/
```

## Utilisation

1. Glisse une image sur la fenêtre, colle-la avec **⌘V / Ctrl+V**, ou clique sur **Essayer un exemple**.
2. Tourne autour de l'appareil (glisser), zoome (molette), déplace la vue (clic droit).
3. Règle la finition, la luminosité de l'écran, les reflets et le fond dans le panneau de droite.
4. Choisis format, résolution et ratio, puis **Exporter** (**⌘E / Ctrl+E**).

Astuce : exporte ton design au ratio natif de l'écran (affiché sous le nom de l'image, par ex. **1179 × 2556** pour Phone Pro, **3024 × 1964** pour Laptop 14, **1440 × 900** pour le navigateur). Les captures plus longues sont cadrées par le haut ; le curseur *Position* fait défiler le cadrage. Les réglages propres à chaque appareil (orientation, ouverture, encoche, thème du navigateur…) apparaissent dans la section *Appareil*.

### Raccourcis

| Action | Raccourci |
|---|---|
| Ouvrir une image | ⌘O / Ctrl+O |
| Enregistrer le projet (.json) | ⌘S / Ctrl+S |
| Dupliquer l'appareil | ⌘D / Ctrl+D |
| Supprimer l'appareil / le texte sélectionné | ⌫ |
| Déplacer l'appareil (Maj : ×5) | Flèches |
| Tourner de 15° | R (Maj+R : sens inverse) |
| Afficher l'aide | ? |
| Coller une image | ⌘V / Ctrl+V |
| Exporter | ⌘E / Ctrl+E |
| Annuler / rétablir | ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y) |
| Recentrer la vue | F |

## Comment ça marche

- **Rendu** : Three.js via react-three-fiber. Matériaux PBR (`MeshPhysicalMaterial` : métal anisotrope, verre, clearcoat, iridescence des objectifs), environnement studio généré à partir de *Lightformers* (aucun fichier HDR), tone mapping *Khronos PBR Neutral*.
- **Écran** : le shader d'écran sort du tone mapping et compose `image + Neutral(reflets)`. Les pixels de ton design sortent donc exactement avec leurs couleurs d'origine, tandis que les reflets suivent la même courbe que la vitre autour.
- **Géométrie** : contours en *squircle* (coins continus de type superellipse) balayés le long d'un profil d'arête, avec normales analytiques pour des reflets sans facettes (`src/lib/geometry`).
- **Matières réelles et table** : textures PBR et HDRI sous licence CC0 embarqués dans `public/assets/` (≈ 15 Mo, chargés à la demande). Le HDRI ne sert qu'à la lumière d'appoint et aux reflets (il n'est jamais affiché) ; sa fenêtre est détectée et tournée vers l'avant-gauche, d'où vient la lumière principale — un spot qui projette une texture (« gobo ») de fenêtre, de stores ou de feuillage sur le mur et la table.
- **Motifs graphiques** : générés par des shaders (`src/lib/patterns.ts`) dans un petit contexte WebGL dédié, à n'importe quelle résolution.
- **Éclairage** : chaque ambiance est un environnement procédural (*Lightformers*) + une lumière clé à ombres douces (VSM) ; l'environnement tourne avec la direction de la lumière pour garder des reflets cohérents.
- **Réflexion au sol** : miroir planaire avec plan de coupe oblique ; le reflet s'estompe selon la hauteur réelle du point reflété au-dessus du sol (lue dans la profondeur), comme sur une pierre polie.
- **Profondeur de champ** : modèle de lentille mince par accumulation (64 échantillons à l'export, progressif dans l'aperçu) — physiquement juste et compatible avec le rendu fidèle des écrans.
- **Export** : rendu hors écran à 2× la taille finale, découpé en tuiles (`camera.setViewOffset`) avec marges de recouvrement pour éviter les coutures, puis réduit. Le fond est peint par le même code dans l'aperçu et dans l'export (`src/lib/background.ts`), avec un léger dithering anti-banding sur les dégradés.

## Structure du code

```
src/
  app/          interface : barre du haut, bibliothèque, viewport, panneau de propriétés, raccourcis
  ui/           composants (Button, Slider, Segmented, Section…)
  i18n/         dictionnaires FR / EN
  store/        état du projet (zustand + historique zundo), assets, UI, toasts
  scene/        Stage R3F, environnement studio, matériaux, matériau d'écran, exporteur
  models/       un dossier par appareil + registre
  lib/geometry  contours squircle, sweep de profil, lathe
  export/       réglages (résolutions, ratios, formats) et pipeline d'export
scripts/        captures de vérification Playwright, génération des exemples
```

## Ajouter un modèle

Chaque appareil est un module qui implémente `DeviceModule` (`src/models/types.ts`) :

```tsx
// src/models/tablet/TabletAir.tsx
import type { DeviceModule, DeviceProps } from '../types';
import { roundedSlab, roundedPlane } from '@/lib/geometry/sweep';
import { brushedMetal } from '@/scene/materials';
import { useScreenMaterial } from '@/scene/useScreenMaterial';

const W = 17.85, H = 24.76, T = 0.61; // centimètres (1 unité = 1 cm)

function TabletAir({ finish, surfaces, screen }: DeviceProps) {
  const screenMat = useScreenMaterial(surfaces.screen, 16.4 / 23.6, screen);
  // … construis la géométrie (mémoïsée) et retourne un <group>
}

export const tabletAir: DeviceModule = {
  id: 'tablet-air',
  name: { fr: 'Tablet Air', en: 'Tablet Air' },
  category: 'tablet',
  size: [W, H, T],
  surfaces: [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: 16.4 / 23.6, nativeSize: [1640, 2360] }],
  finishes: [{ id: 'silver', name: { fr: 'Argent', en: 'Silver' }, swatch: '#d6d7da', colors: { frame: '#d6d7da' } }],
  defaultFinish: 'silver',
  Component: TabletAir,
};
```

Puis ajoute-le à `MODELS` dans `src/models/registry.ts`. Conventions :

- l'écran regarde vers **+Z** et la hauteur suit **+Y** ; avec `anchor: 'center'` (défaut) l'appareil est centré sur son origine et posé au sol automatiquement, avec `anchor: 'bottom'` (laptops, écrans) il repose déjà sur y = 0 ;
- `params` déclare des réglages (`slider`, `toggle`, `choice`, `text`) que le panneau de propriétés affiche tout seul ; `ORIENTATION_PARAM` ajoute portrait/paysage ;
- `view` donne le point visé et la direction de la caméra ; la distance est calculée automatiquement ;
- les pièces communes (objectifs, flash, perçages) sont dans `src/models/shared/parts.tsx`, les familles paramétrables dans `phone/Phone.tsx`, `tablet/Tablet.tsx`, `laptop/Laptop.tsx` ;
- les écrans utilisent `useScreenMaterial` (couleurs exactes, reflets de vitre) ; les objets imprimés utilisent `usePrintMaterial` (`src/models/print/shared.tsx`), un vrai matériau papier / céramique éclairé par la scène, et déclarent `surfaceKind: 'print'` ;
- un modèle peut avoir plusieurs `surfaces` (recto, verso, couverture…) : l'interface affiche une image par face ;
- `sizeFor(params)` donne l'encombrement selon les réglages (format, présentation) pour le cadrage automatique ;
- les géométries sont construites une seule fois et partagées entre instances.

## Vérification visuelle

```bash
npm run dev
node scripts/shoot.mjs                         # captures UI + export 1080p dans out/
node scripts/gallery.mjs                       # rend chaque modèle dans out/models/
node scripts/check-swap.mjs                    # non-régression : changement d'image
node scripts/check-composition.mjs             # multi-appareils, textes, sauvegarde auto, projet JSON
node scripts/scenes.mjs                        # scénarios de scène (décors, lumières, caméra)
THEME=light node scripts/shoot.mjs             # thème clair
EXPORT='{"resolution":"4k","ratio":"1:1","format":"png"}' node scripts/shoot.mjs
```

## Déployer sur GitHub Pages

1. Pousse le dépôt sur GitHub (branche `main`).
2. Dans **Settings → Pages**, choisis **Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`, à l'adresse `https://<utilisateur>.github.io/<dépôt>/`. Le chemin de base est déduit automatiquement du nom du dépôt.

Pour un autre hébergeur statique : `BASE_PATH=/ npm run build` puis publie `dist/`.

## Assets embarqués (CC0)

Tous les environnements et matières fournis sont sous licence **CC0 1.0** (domaine public) ; merci à leurs auteurs :

- **HDRI** — [Poly Haven](https://polyhaven.com) : `photo_studio_loft_hall` (lumière et reflets de la mise en scène « table »).
- **Textures** — [ambientCG](https://ambientcg.com) : `Marble012`, `Marble016`, `Travertine009`, `Terrazzo009`, `Concrete034`, `Fabric036` ; [Poly Haven](https://polyhaven.com) : `oak_veneer_04`, `walnut_veneer`.

Le script `python3 scripts/fetch_assets.py` les télécharge et les optimise à nouveau (redimensionnement, compression).

## Mentions légales

- Les appareils sont des **interprétations génériques** (« Phone Pro », « Laptop 14 »…). Aucun logo ni marque déposée n'est reproduit, et MockupLab n'est affilié à aucun fabricant.
- Les **modèles `.glb`, templates photo et images** que tu importes restent sous leur propre licence. Vérifier que tu as le droit de les utiliser est de ta responsabilité.
- Polices embarquées : Geist et Geist Mono (SIL OFL), Instrument Serif (SIL OFL).

## Licence

[MIT](LICENSE)
