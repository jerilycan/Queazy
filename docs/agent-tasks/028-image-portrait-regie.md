# [028] Illustration portrait : image et énoncé côte à côte en régie MJ

## Contexte
Sur l'écran du MJ (régie desktop, `body.is-host.game-active`, ≥1100px),
une illustration au format PORTRAIT (plus haute que large) est aujourd'hui
empilée AU-DESSUS de l'énoncé, comme n'importe quelle illustration — plafonnée
à 260px de haut (`.illustration-img`), donc assez ÉTROITE une fois ce
plafond appliqué à un format portrait, laissant beaucoup d'espace horizontal
inutilisé à côté d'elle sur la large carte régie. Retour utilisateur (capture
d'écran, question "Ordre / classement" avec une photo portrait) : afficher
l'image et l'énoncé côte à côte plutôt qu'empilés tirerait mieux parti de
cet espace.

## Objectif
Sur l'écran du MJ (régie desktop UNIQUEMENT) :
- Quand l'illustration d'une question est majoritairement au format PORTRAIT
  (hauteur > largeur), l'image et le texte de l'énoncé s'affichent CÔTE À
  CÔTE (image à gauche ou à droite, énoncé à côté), au lieu de la
  disposition empilée actuelle.
- Une illustration au format PAYSAGE (ou carré) garde la disposition
  empilée actuelle — aucun changement pour ce cas.
- Aucun changement pour les joueurs (mobile/tablette, vue IRL où
  l'illustration est de toute façon masquée côté joueur) — uniquement la
  régie desktop du MJ.
- Le reste de l'écran (barre de progression/timer, badge de type, options
  de réponse/liste à ordonner sous l'énoncé, etc.) garde sa place actuelle,
  seule la relation image/énoncé change.

## Périmètre
- Détection du format de l'image (portrait vs paysage/carré) à son
  chargement (`naturalWidth`/`naturalHeight`), côté client.
- Nouvelle disposition CSS (flex/grid row) pour la zone image+énoncé,
  active UNIQUEMENT sous `body.is-host.game-active` (régie) ET quand une
  illustration portrait est présente.
- S'applique à TOUS les types de question qui utilisent l'illustration
  décorative générique (`payload.illustrationUrl` — la plupart des types,
  voir `illustrationSection`/`illustrationImg` client), pas seulement
  "Ordre/classement" cité dans le retour utilisateur.

## Hors périmètre
- Le type "zoomguess" (`payload.imageUrl`, zoom actif, boîte de taille
  FIXE `.illustration-img-wrap.is-zoomed`) — image = mécanisme du jeu, pas
  une illustration décorative, logique d'affichage déjà entièrement
  différente ; non concerné par cette tâche.
- Les types avec leur PROPRE image dédiée au mécanisme (image cliquable
  "image", photos "intrus", "association", "reveal" énigme/réponse,
  "recherche"/"halo" image cachée) — chacun a déjà sa propre mise en page
  spécifique, hors périmètre.
- Toute modification de la vue joueur (mobile, IRL) — l'illustration y est
  déjà gérée différemment (masquée en IRL, voir
  `body.irl-player-mode #illustrationImgWrap`), non touché ici.
- Redimensionnement/recadrage de l'image elle-même (outil de crop déjà
  existant côté éditeur pour d'autres champs image) — hors périmètre, la
  détection portrait/paysage ne fait que CHOISIR la disposition, jamais
  retoucher l'image.

## Fichiers concernés
- `client/public/js/index.js` — `question:show` (~L.6383, bloc qui pose
  `illustrationImg.src`) : ajouter la détection d'orientation (écouteur
  `load` sur l'image, comparer `naturalWidth`/`naturalHeight`) et poser une
  classe dédiée (ex. `is-portrait`) sur `#illustrationImgWrap` ou
  `#stageWrap` en conséquence.
- `client/public/css/style.css` — nouvelle règle sous
  `body.is-host.game-active` (voir le bloc régie existant, ~L.4189 et
  alentours) pour la disposition côte à côte quand cette classe est
  présente ; ne doit rien changer hors régie desktop.

## Plan
Implémenté directement suite à un retour utilisateur détaillé (capture
d'écran + spécification précise : "TITRE en haut, Photo en bas à gauche,
éléments réponse en bas à droite"), après une première frustration sur le
même problème ("impossible de voir la question en haut, impossible de
scroll") — pas de nouveau tour de cadrage, la spec était déjà concrète.

- `#question`/`#illustrationImgWrap`/`#inputArea` sont déjà enfants DIRECTS
  de `#main` dans le DOM (aucun déplacement nécessaire) : bascule `#main`
  en CSS Grid (`.regie-portrait-layout`, régie desktop uniquement) plutôt
  que flex-colonne, avec placement explicite de ces 3 éléments (titre en
  rangée 1 pleine largeur, image/réponses en rangée 2 sur 2 colonnes).
- Détection portrait/paysage en JS (`naturalWidth`/`naturalHeight` une fois
  l'image chargée, `.complete` vérifié pour le cas déjà en cache), classe
  posée sur `#main` — jamais pour "zoomguess" (Hors périmètre), jamais
  supposée stable d'une question à l'autre (réévaluée à chaque
  `question:show`, retirée explicitement si pas d'illustration).
- **Bug trouvé en vérifiant en direct** : `enterGameScreen()` pose un style
  INLINE `display:block` sur `#main` à chaque question — qui l'emporte
  toujours sur une règle de feuille de style, même plus spécifique. Corrigé
  avec `!important` sur `display:grid` (même patron déjà utilisé ailleurs
  dans ce fichier pour `#hostPanel`/padding, exactement pour cette raison).
- En prime (même session, même symptôme "impossible de scroll") :
  `#stageWrap` utilisait `justify-content: center` (pas `safe center`) —
  un flex-box centré dont le contenu déborde clippe le DÉBUT de façon
  inatteignable au scroll (piège CSS connu de l'alignement "unsafe" par
  défaut). Passé à `safe center` : robuste même si un futur cas fait encore
  déborder le contenu.
- `#hostPanel` (colonne gauche) rendu explicitement non-scrollable sur
  retour utilisateur séparé (même session) : l'ancien compromis "scrollable
  mais scrollbar cachée" (pour éviter un clipping silencieux constaté par
  le passé) est retiré, le contenu actuel de cette colonne tenant
  largement dans la hauteur disponible en usage réel.

## Étapes réalisées
- [x] 1. `client/public/css/style.css` — `.regie-portrait-layout` (grid sur
      `#main`, placement des 3 éléments), `!important` sur `display:grid`
      (style inline concurrent).
- [x] 2. `client/public/js/index.js` — détection portrait/paysage au
      chargement de l'illustration, toggle de la classe (exclu pour
      "zoomguess").
- [x] 3. `#stageWrap` : `justify-content: safe center` (corrige le
      "impossible de scroll" à la racine, indépendamment du point 1).
- [x] 4. `#hostPanel` : retrait du scroll caché (retour utilisateur séparé).

## Checks effectués
- [x] `node --check client/public/js/index.js` — passe.
- [x] **Vérification EN DIRECT** (Browser pane, vraie page, salle
      "Présenter", régie desktop 1400px) : question "Ordre/classement"
      avec illustration portrait (SVG data URI 300×500) — `#main` bascule
      bien en grid (`display:grid` confirmé, après correctif `!important`),
      rendu conforme à la spec (titre en haut pleine largeur, image en bas
      à gauche, liste à ordonner en bas à droite), tout tient dans la carte
      sans scroll nécessaire.
- [x] Diagnostic du bug `!important` fait via inspection réelle des règles
      CSS correspondantes (`document.styleSheets`/`element.matches`), pas
      par supposition — confirmé qu'une seule règle matchait `#main` et
      posait bien `display:grid`, mais qu'un style inline la masquait.

## Tests manuels recommandés
Tester avec une VRAIE image portrait uploadée depuis l'éditeur (pas juste
le SVG de test) sur plusieurs types de question (mcq, graduation, texte
libre — pas seulement "order") pour confirmer que `#inputArea` s'adapte
bien à chacun sans débordement. Vérifier aussi qu'une illustration
PAYSAGE/carrée n'active jamais cette disposition (garde le rendu empilé
existant), et que la vue joueur (mobile/tablette, hors régie) reste
totalement inchangée.

## Risques restants
- Testé avec un seul type ("order") faute de temps — les autres types
  partagent tous `#inputArea` comme conteneur générique, donc le
  placement grid devrait s'appliquer uniformément, mais chaque type a sa
  propre mise en page interne (mcq en tuiles, graduation en curseur...)
  qui n'a pas été vérifiée individuellement dans cette colonne plus étroite
  (la moitié de la largeur habituelle).
- `max-height: min(50vh, 420px)` sur l'image portrait (empirique) — à
  ajuster si une image très haute/étroite rend mal dans certains cas.

## Statut
`en review`
