# [005] Layout "régie 2 rails" — écran hôte en jeu (`index.html`)

## Contexte
Retour utilisateur avec la maquette de référence en rappel : l'écran hôte
en jeu doit avoir une vraie mise en page à 3 zones (dock hôte à gauche,
carte question au centre, classement en direct à droite) — pas juste des
correctifs ponctuels de couleur/ombre comme la tâche 004. Écart déjà
documenté depuis la tâche 002 (décision 8) : "l'écran hôte réel est
structuré très différemment de la maquette — pas la mise en page 'régie' à
deux rails", jamais traité depuis faute de moyen sûr de le vérifier.

## Objectif
Faire correspondre l'écran hôte en jeu à la maquette : dock hôte fixe à
gauche, carte centrale (badge + timer + question + réponses), classement
permanent à droite qui reste visible PENDANT la question (pas seulement
entre les questions comme aujourd'hui) — sans casser le comportement JS
existant ni le rendu mobile/joueur, déjà longuement retouché.

## Décision validée avec l'utilisateur
Le classement permanent à droite est bien construit dans ce lot (pas
reporté) — il réutilise les scores déjà suivis côté client, aucune nouvelle
donnée serveur nécessaire.

## Périmètre
- Layout desktop hôte uniquement (`body.is-host.game-active`, ≥1100px) :
  le mobile/joueur ne change PAS.
- Dock gauche = `#hostPanel` existant, restylé en colonne.
- Carte centrale = nouveau `#stageWrap` (wrapper autour de
  `#questionTypeBadge` + `#main`, aucun id déplacé).
- Dock droit = nouveau `#liveClassementDock`, alimenté par les données déjà
  suivies côté client (`scores`, `computeOrder()`), pas de nouvel événement
  socket.

## Hors périmètre
- Mode équipes pour le dock permanent (masqué dans ce mode pour l'instant —
  `computeOrder()`/scores individuels ne représentent pas les scores
  d'équipe).
- Le "X% ont déjà trouvé" visible sur la maquette (donnée de
  `question:recap`, déjà affichée ailleurs dans `.recap-sidebar` — pas
  dupliquée ici dans ce 1er lot).
- Toute nouvelle mécanique/donnée serveur (`server/index.js` non touché).
- Repenser le layout du côté JOUEUR (uniquement l'hôte est concerné par
  cette maquette).

## Fichiers concernés
- `client/public/index.html` — wrapper `#stageWrap` + nouvel aside
  `#liveClassementDock`, aucun id existant déplacé/retiré.
- `client/public/css/style.css` — grille régie (media query desktop +
  `body.is-host.game-active`), dock hôte en colonne, carte `#stageWrap`,
  badge en position absolute dans ce contexte, styles du dock classement.
- `client/public/js/index.js` — `renderLiveClassementDock()`, appelée
  depuis le point d'entrée unique `renderLeaderboard()` (déjà appelé
  partout où les scores changent).

## Choix techniques notables
- **Aucun élément déplacé dans le DOM** en dehors du nouveau wrapper
  `#stageWrap` (qui regroupe deux éléments déjà adjacents) — la grille CSS
  place `#hostPanel`/`#stageWrap`/`#liveClassementDock` par id, tous les 3
  enfants directs de `.container`. Aucun `getElementById` existant cassé.
- **Gardé derrière `@media (min-width: 1100px)`** : le layout
  mobile/joueur — déjà longuement retouché, beaucoup de retours
  utilisateur documentés dans le CSS existant — reste identique, y compris
  pour un hôte qui ouvrirait sur petit écran.
- **`#questionTypeBadge` passe de `position:fixed` à `position:absolute`**
  UNIQUEMENT dans ce contexte régie (scopé par la même media query) :
  élimine la classe de bug déjà documentée (backdrop-filter créant un bloc
  conteneur pour un descendant `fixed`) en changeant intentionnellement de
  stratégie de positionnement plutôt que d'y être exposé accidentellement.
- **`#liveClassementDock` sans classe `d-none` dans le HTML** (contrairement
  aux autres panneaux du fichier) : sa visibilité est pilotée entièrement
  par la media query CSS (`display:none` par défaut, `block` seulement sous
  `body.is-host.game-active` en desktop) — `.d-none` utilise `!important`,
  qui aurait sinon gagné sur la media query quel que soit l'état réel.
- **`renderLiveClassementDock()` construit ses lignes via `createElement`/
  `textContent`**, jamais `innerHTML` avec le nom du joueur interpolé — même
  précaution que `renderBoard()` existant (les pseudos sont fournis par les
  joueurs, jamais interpolés dans du HTML brut).

## Étapes réalisées
- [x] `#stageWrap` : wrapper HTML autour de `#questionTypeBadge` + `#main`.
- [x] `#liveClassementDock` : nouvel aside HTML + `#liveClassementList`.
- [x] CSS grille régie (`body.is-host.game-active .container`, ≥1100px) :
  3 colonnes 260px/1fr/260px.
- [x] `#hostPanel` : colonne verticale + groupe de boutons empilé en régie.
- [x] `#stageWrap` : carte (fond/bordure/radius/ombre) + ancre positionnée
  pour le badge.
- [x] `#questionTypeBadge` : absolute + centré en haut de la carte, en
  régie uniquement.
- [x] `.live-classement-dock`/-title/-list/-row/-rank/-name/-score : styles
  du dock (mini version de `.leader-row`, mêmes tokens de couleur).
- [x] `renderLiveClassementDock()` (index.js) : top 5, masqué en mode
  équipe, câblée sur `renderLeaderboard()`.

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- Équilibre des accolades CSS : 1211/1211, OK.
- Vérifié en Browser pane (onglet neuf + cache-bust) :
  - DOM : `#questionTypeBadge`/`#main` bien enfants de `#stageWrap`, aucun
    id manquant.
  - État forcé à la main (`body.is-host.game-active` + panneaux visibles,
    pas de vraie partie) à 1400px : `.container` en `grid` (260px/466px/
    260px), `#liveClassementDock` en `block`, `#stageWrap` en `relative`
    avec fond dégradé, badge en `absolute`, `#hostPanel` en colonne — tout
    conforme.
  - Même état à 390px (mobile) : `.container` repasse en `block`, le dock
    classement repasse en `none`, le badge repasse en `fixed` — layout
    mobile confirmé intact.

## Tests manuels recommandés
- **Priorité** : lancer une vraie partie en tant qu'hôte sur un écran
  ≥1100px (desktop/projecteur), vérifier que le layout régie ressemble à
  la maquette et que le classement à droite se met à jour question après
  question (pas seulement au classement plein écran entre les questions).
- Vérifier qu'un mode équipe actif masque bien le dock sans erreur console.
- Vérifier sur mobile/tablette que rien n'a changé côté hôte comme côté
  joueur.
- Vérifier les deux thèmes (clair/sombre) sur le dock classement et la
  carte centrale — pas re-testés visuellement dans cette session, tokens
  déjà theme-aware réutilisés (`--gradient-card`, `--color-surface-2`,
  `--tile-*`) par cohérence avec `.leader-row`/`.card` déjà vérifiés
  ailleurs, mais pas un test direct.

## Risques restants
- Premier lot d'un layout structurel jamais tenté sur cet écran — même en
  desktop, une vraie partie (plusieurs joueurs, tous types de question,
  scroll si le contenu déborde de la carte) reste la seule vraie preuve.
- `#stageWrap` n'a pas de hauteur/scroll interne dédié — un type de
  question avec beaucoup de contenu (ex. Petit Bac à plusieurs catégories,
  association avec beaucoup de paires) pourrait déborder de la carte sans
  qu'un scroll ne soit prévu explicitement ; à surveiller au test réel.
- "% ont déjà trouvé" de la maquette volontairement pas dupliqué ici (déjà
  dans `.recap-sidebar`) — à trancher si l'utilisateur le veut aussi dans
  ce dock après le premier test.

## Statut
`en review`
