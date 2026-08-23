# [006] Mode présentation — navbar masquée, logo + joueurs, vrai centrage

## Contexte
Retour utilisateur suite à la tâche 005 (layout régie) : "Catastrophe. La
navbar ne devrait pas être visible quand on lance la présentation + la
tuile centrale devrait être vraiment au centre + Rajouter le logo + les
joueurs en haut sous forme de petits cercles".

## Objectif
1. Masquer la navbar en layout régie hôte.
2. Centrer réellement la carte question (horizontalement ET verticalement).
3. Nouvel en-tête "présentation" : logo + code de salle + avatars des
   joueurs en petits cercles, à la place de la navbar.

## Périmètre
Toujours scopé à `body.is-host.game-active` + `@media (min-width:1100px)`
(même contexte que la tâche 005) — mobile/joueur inchangés.

## Fichiers concernés
- `client/public/index.html` — nouveau `<header id="presentationHeader">`.
- `client/public/css/style.css` — navbar masquée, centrage vertical de la
  grille, styles de l'en-tête, **découverte + correction d'un conflit avec
  un système préexistant** (voir ci-dessous).
- `client/public/js/index.js` — `setDisplayRoomCode()` (partagé entre 2
  affichages du code de salle), `renderHostPlayerStrip()` généralisée à
  plusieurs cibles (`.host-player-strip`).

## Découverte importante en cours de route
En vérifiant le centrage, la carte centrale n'était PAS centrée (décalée de
+130px). Cause : un système **préexistant, antérieur à la tâche 005**,
répondait déjà partiellement au même besoin ("garder le centre libre
pendant la présentation") — `#hostPanel` en `position:fixed` + `.container`
avec `margin-left:280px`, actif dès `min-width:1024px`, sur le MÊME
sélecteur `body.is-host.game-active`. Les deux systèmes (l'ancien fixe,
et la nouvelle grille CSS de la tâche 005) se marchaient dessus. Raté lors
de l'audit de la tâche 004/005 (recherché par nom de composant, pas lu le
fichier de bout en bout — cette règle vit dans une zone du fichier associée
au bouton "Récap", pas avec le reste des styles `#hostPanel`).

**Corrigé** en bornant l'ancien système à `(min-width:1024px) and
(max-width:1099.98px)` — il continue de gérer proprement l'étroite
fourchette 1024-1099px où la nouvelle grille n'est pas encore active,
plutôt que d'être supprimé.

**Deuxième bug trouvé en vérifiant** (auto-placement CSS Grid) : sans
`grid-column`/`grid-row` explicites sur `#hostPanel`, son placement dans la
grille dépendait de l'ordre/visibilité des AUTRES enfants de `.container`
(`#joinCard` notamment) — repéré en testant à la main sans repasser par le
vrai flux JS qui les masque. Corrigé en fixant `grid-column`/`grid-row`
explicitement sur les 3 éléments de la grille (hôte/carte/classement),
rendant le placement déterministe quel que soit l'état des autres enfants.

## Choix techniques
- **Logo en `<img src="/icons/queazy-wordmark.png">`**, pas une 2e copie du
  SVG de la navbar (dégradés à id répétés, référencés en interne — dupliquer
  ces id dans le document est un comportement non garanti par la spec SVG).
  Asset déjà existant dans le projet.
- **`setDisplayRoomCode(code)`** : fonction partagée, met à jour tous les
  `.display-room-code` (2 aujourd'hui : `#displayRoomCode` dans `#roomInfo`,
  `#presentationRoomCode` dans le nouvel en-tête) plutôt que dupliquer les 2
  call sites existants.
- **`renderHostPlayerStrip()` généralisée** : itère maintenant sur
  `document.querySelectorAll('.host-player-strip')` au lieu d'un seul
  `getElementById('hostPlayerStrip')` — même liste de joueurs affichée à 2
  endroits (panneau hôte + en-tête présentation) sans dupliquer la fonction.
- **`.presentation-header` sans classe `d-none`** dans le HTML, même
  raison que `.live-classement-dock` (tâche 005) : piloté entièrement par
  la media query (`display:none` par défaut, `flex` seulement en régie) —
  `.d-none` (`!important`) aurait gagné sur la media query sinon.

## Étapes réalisées
- [x] `body.is-host.game-active .navbar { display: none; }` (régie only).
- [x] `#presentationHeader` : logo + pastille "Salle CODE + avatars".
- [x] `.container` : `align-content: center` + `min-height` pour centrer
  verticalement la rangée dock/carte/dock dans l'espace libéré par la
  navbar masquée.
- [x] Ancien système `#hostPanel` fixe borné à 1024-1099.98px (au lieu de
  ≥1024px sans limite) pour ne plus entrer en conflit avec la grille ≥1100px.
- [x] `grid-column`/`grid-row` explicites sur `#hostPanel`/`#stageWrap`/
  `#liveClassementDock` — placement déterministe.
- [x] `setDisplayRoomCode()` + généralisation de `renderHostPlayerStrip()`.

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- Équilibre des accolades CSS : 1219/1219, OK.
- Vérifié en Browser pane (onglet neuf, cache + service worker vidés) à
  1400px : navbar `none`, en-tête `flex`, `#hostPanel` en colonne 1 (x177,
  w260), `#stageWrap` colonne 2 CENTRÉE (offset horizontal ~0px), dock
  classement colonne 3 (x953, w260), aucun chevauchement avec le bouton
  Récap. Testé aussi avec `#joinCard` volontairement laissé visible (pire
  cas rencontré en cours de route) : placement toujours correct grâce aux
  `grid-column`/`grid-row` explicites.
- Revérifié à 390px (mobile) : navbar repasse en `flex` (visible), en-tête
  en `none`, `#hostPanel` repasse en `relative`, `.container` repasse en
  `block` — layout mobile confirmé intact.

## Tests manuels recommandés
- Vraie partie hôte sur écran ≥1100px : logo + code de salle + avatars
  visibles en haut, navbar absente, carte centrale bien au centre.
- Vérifier l'affichage du code de salle et des avatars AVANT le lancement
  de la partie (dans `#roomInfo`) : toujours correct (fonction partagée,
  pas juste testé côté présentation).
- Les deux thèmes (clair/sombre) sur le nouvel en-tête — pas retesté
  visuellement, tokens déjà theme-aware réutilisés.

## Suite — retour capture d'écran (2e passe)
"Beaucoup trop centré [...] La tuile gauche doit être collée à gauche, la
droite, à droite. Le logo doit être le SVG, et le centre le plus grand
possible."

- [x] `.container` en régie : `max-width: none; width: 100%; padding: 0
  24px;` au lieu du `max-width: 1100px` centré habituel — les 2 docks
  touchent quasiment les bords, la carte centrale (`minmax(0,1fr)`)
  récupère tout l'espace restant (476px → 934px+ sur un écran 1600px).
  Colonnes des docks élargies à 280px (260px paraissait perdu à pleine
  largeur d'écran).
- [x] Logo : remplacé le PNG par un **clone du vrai SVG de la navbar**
  (`.brand-logo-svg`, cloné en JS via `cloneNode(true)`) plutôt qu'une
  image à part — ses couleurs viennent d'une règle CSS globale sur cette
  classe (`.brand-logo-svg .cls-N { fill: url(#...) }`), donc le clone
  rend à l'identique sans dupliquer la moindre couleur à la main. Les id
  de dégradés SVG dupliqués (navbar + clone) sont sans conséquence : ce
  sont des copies identiques du même dégradé — vérifié en Browser pane que
  `fill` résout bien vers l'URL du dégradé sur le clone.

Vérifié en Browser pane (onglet neuf, cache+SW vidés) à 1600px : logo
cloné (hauteur 64px), dock gauche à 24px du bord, dock droit à ~34px de
l'autre bord (24px de marge + scrollbar), carte centrale à 934px de large.
Revérifié à 390px : navbar reste visible, en-tête caché, `.container`
reprend son `max-width: 1100px` habituel — layout mobile intact.

## Risques restants
- Hauteur du wordmark (44px) pas comparée à l'échelle exacte de la
  maquette — ajustable si trop petit/grand à l'usage réel.
- `min-height: calc(100vh - 170px)` sur `.container` : valeur estimée pour
  l'espace libéré par la navbar masquée + l'en-tête, pas mesurée
  précisément pour toutes les hauteurs de fenêtre — à surveiller sur un
  vrai poste hôte (résolution/zoom variables).

## Statut
`en review`
