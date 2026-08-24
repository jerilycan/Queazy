# [011] Refonte DA — vue joueur PC en jeu

## Contexte
La refonte DA "punchy" (tâches 001-006 : navbar, boutons, cartes, écran
régie hôte) n'a jamais touché la vue JOUEUR (non-hôte) pendant une partie
sur desktop. Retour utilisateur avec capture d'écran à l'appui : la barre
de temps garde son ancien look (fond noir quasi-opaque, bordure blanche
épaisse "à l'ancienne"), le badge de type de question a le même souci, et
le bandeau de résultat ("Mauvaise réponse") est plat, sans la carte/ombre
"punchy" utilisée partout ailleurs (`.card`, `--gradient-card`,
`--shadow-md/lg`).

## Objectif
Faire que l'écran de jeu vu par un joueur (desktop, pas mobile — le mobile
n'est pas concerné par ce retour) suive la même DA que l'écran hôte déjà
validé : mêmes tokens de couleur/rayon/ombre, même langage de carte, plus
de fond noir/bordure blanche "à l'ancienne" isolés du reste.

## Périmètre
- `.timer-container` / `.timer-bar-wrapper` / `.timer-label` (base, pas
  scopé `is-host` — s'applique donc déjà au joueur).
- `.question-type-badge` (même remarque, base non scopée host).
- `.my-result-banner` (bandeau bonne/mauvaise réponse) et
  `.reveal-explanation`.
- Uniquement le rendu DESKTOP du joueur (≥1100px ou le breakpoint déjà en
  place) ; ne pas toucher aux règles `@media (max-width: 640px)` déjà
  ajustées pour mobile sauf incompatibilité avérée.

## Hors périmètre
- L'écran hôte (déjà traité, tâches 004-006, validé par l'utilisateur).
- Le layout mobile joueur (non mentionné dans le retour, déjà beaucoup
  retouché par ailleurs).
- Les tuiles de réponse elles-mêmes (`.option-btn` etc.) — déjà sur les
  tokens `--shadow-md`/`--tile-*`, pas signalées comme problème dans la
  capture.
- Tout ajout de fonctionnalité — uniquement de la restylisation CSS.

## Fichiers concernés
- `client/public/css/style.css` — `.timer-container`, `.timer-bar-wrapper`,
  `.timer-label`, `.question-type-badge`, `.my-result-banner`,
  `.reveal-explanation`.

## Plan
1. `.timer-container` : remplacer le fond noir quasi-opaque + `backdrop-filter`
   par le langage carte (`--gradient-card`, `--shadow-md`), retirer la
   bordure blanche dure.
2. `.timer-bar-wrapper`/`.timer-label` : aligner sur le traitement déjà
   validé côté hôte (pastille, fond de piste translucide, libellé sans
   halo texte dur) sans casser le DOM ni le JS qui cible ces classes.
3. `.question-type-badge` : même changement de recette verre → carte.
4. `.my-result-banner`/`.reveal-explanation` : ajouter l'ombre/carte
   (`--shadow-md`, fond `--gradient-card` ou `--color-card` selon le cas)
   pour sortir du plat.
5. Vérifier en Browser pane (état joueur forcé, pas hôte, ≥1100px), deux
   thèmes.
6. Faire valider par le sous-agent "gardien DA" avant de considérer la
   tâche terminée.

## Étapes réalisées
- [x] `.timer-container` : verre noir + blur → `--gradient-card` + `--shadow-md`.
- [x] `.timer-bar-wrapper` : bordure blanche épaisse retirée.
- [x] `.question-type-badge` : même bascule verre → carte.
- [x] `.my-result-banner` / `.reveal-explanation` : ombre `--shadow-md`
  ajoutée ; `.is-incorrect` passé de `--color-surface` plat à
  `--gradient-card`.
- [x] Contre-passe régression hôte : `body.is-host.game-active .container
  #timerContainer` reprend `box-shadow: none` (la pastille régie n'a jamais
  eu de fond/ombre propre, seule la barre en dessous en garde une).

## Checks effectués
- [x] CSS uniquement, pas de JS touché — `node --check` non applicable
- [x] Équilibre des accolades CSS : 1264/1264, OK
- [x] Vérification visuelle Browser pane (état joueur forcé, ≥1100px,
  cache-bust) : `.timer-container`/`.question-type-badge`/`.my-result-
  banner` tous sur `--gradient-card`+`--shadow-md`, testé thème clair ET
  sombre (via `localStorage.queazy_theme` + rechargement complet).
- [x] Non-régression hôte vérifiée : `#timerContainer` reste `background:
  none; box-shadow: none` sous `body.is-host.game-active`.
- [x] Revue par le sous-agent "gardien DA" — **Conforme** (tokens
  `--gradient-card`/`--shadow-md` vérifiés dans les deux thèmes, aucune
  régression hôte détectée).

## Suite — retour utilisateur (curseur numérique)
Retour complémentaire, hors périmètre initial de ce lot (marqueur de
réponse perso sur le type "graduation", pas un souci de tokens DA) :
"le repère 'ta réponse' n'indique pas la valeur choisie". Corrigé
séparément : `#gradMyMarkerTag` (nouvel id, `index.html`) rempli en JS
(`positionGradTargetMarker`, `index.js`) avec `Ta réponse : ${valeur}`
au lieu du texte statique "Ta réponse" seul.

## Tests manuels recommandés
Lancer une vraie partie, rejoindre en tant que joueur sur un écran large,
comparer visuellement à l'écran hôte pour la cohérence de langage visuel.

## Risques restants
`.timer-container`/`.question-type-badge` sont utilisés par le joueur ET
par l'hôte (la version hôte est ensuite surchargée par les règles
`body.is-host.game-active .container #timerContainer` déjà en place,
scopées desktop régie). Modifier la base doit rester compatible avec ces
surcharges existantes — vérifier qu'aucune régression n'apparaît côté hôte.

## Statut
`en cours`
