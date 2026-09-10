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
(à remplir par `/plan-feature`)

## Étapes réalisées
- [ ] (à remplir par `/implement-step`)

## Checks effectués
- [ ] `node --check client/public/js/index.js`
- [ ] Vérification visuelle Browser pane (image portrait ET paysage, régie
      desktop ET vue joueur/mobile)

## Tests manuels recommandés
(à remplir par `/plan-feature`/`/implement-step`)

## Risques restants
(à remplir par `/plan-feature`/`/implement-step`)

## Statut
`ouverte`
