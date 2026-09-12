# [036] IRL : réafficher les réponses côté MJ, en lecture seule

## Contexte
Retour utilisateur qui inverse à nouveau la décision de la tâche
[031](031-irl-hide-gameplay-mj.md) (masquer entièrement `#inputArea` côté
écran du MJ en IRL, remplacé à la révélation par un résumé texte
`#irlAnswerRecap` en tâche [033](033-multi-sujets-2.md)) : "finalement les
joueurs attendent les propositions en regardant l'écran [du MJ]" — en jeu
IRL, la salle répond de vive voix/à main levée en se basant sur les
propositions affichées à l'écran, il faut donc que ces propositions
réapparaissent sur l'écran du MJ. Contrairement à l'état d'avant la tâche
031, le MJ ne doit toutefois pouvoir interagir avec AUCUNE d'entre elles —
uniquement les regarder, ce n'est que son écran à partager avec la salle.

**Contexte technique important découvert en cadrant cette tâche** : le
mécanisme qui rend les tuiles non interactives pour l'hôte présentateur
(`isPresenterHost()`) existe déjà et n'a jamais été retiré, y compris
pendant les tâches 031/033 — voir `inputArea.classList.add('answers-locked')`
posé à chaque question et jamais retiré pour lui (`if (!isPresenterHost())`
gate le déverrouillage), classe qui désactive déjà le pointer-events sur
`.option-btn`/`.grad-slider`/`.order-item`/`.assoc-item`/`.timeline-item`/
`.image-click-layer`/`.halo-wrap` (voir `style.css`). Seule la règle CSS de
la tâche 031 (`body.irl-presenter-mode #inputArea { display: none
!important; }`) masque tout ; le "verrouillage visuel sans interaction"
sous-jacent, lui, est déjà en place.

## Objectif
En IRL (`gameMode === 'irl'`), dès qu'une question est affichée sur
l'écran d'un hôte présentateur pur (`isPresenterHost()`, jamais en mode
"Jouer") : `#inputArea` redevient visible, quel que soit le type de
question, avec les mêmes tuiles/éléments que ceux vus par les joueurs —
mais strictement en lecture seule : aucun clic, glisser-déposer ou
interaction ne doit avoir d'effet pour le MJ (comportement déjà garanti
par `answers-locked`, à vérifier/confirmer type par type plutôt qu'à
recoder).

## Périmètre
- Toute taille d'écran (symétrique du masquage introduit en 031, qui
  s'appliquait lui aussi à toute taille d'écran).
- Tous les types de question ayant un `#inputArea` (mcq, truefalse,
  intrus, graduation, order, image, association, timeline, rangement,
  blindtest, free, zoomguess, pbac, reveal, recherche, indice, halo...).
- Retirer ou adapter la règle CSS `body.irl-presenter-mode #inputArea {
  display: none !important; }` (tâche 031) pour laisser les tuiles
  réapparaître.
- Vérifier/renforcer au besoin que `answers-locked` empêche bien toute
  interaction pour CHAQUE type (y compris drag & drop
  association/rangement/order, slider graduation) — pas seulement les
  clics simples de type QCM.
- Revoir les ajustements CSS desktop ajoutés en 031 pour un `#inputArea`
  absent (illustration agrandie à 65vh, grille portrait repassée à 1
  colonne) : ne doivent plus s'appliquer une fois `#inputArea` de nouveau
  visible, sous peine de recréer le problème inverse (image géante qui
  écrase les tuiles, ou grille à 1 colonne avec les tuiles qui ne
  profitent plus de la 2e colonne prévue en tâche 028).
- Trancher le sort de `#irlAnswerRecap` (résumé texte, tâche 033) :
  redondant une fois les tuiles à nouveau visibles à la révélation, ou
  conservé en complément — décision à documenter dans le Plan.

## Hors périmètre
- Mode "à distance" (`gameMode === 'remote'`) — jamais touché par 031,
  reste inchangé ici aussi.
- Mode "Jouer" (`roomMode === 'auto'`, l'hôte joue) — `isPresenterHost()`
  exclut toujours ce cas, aucun changement.
- Vue joueur (mobile/tablette, `body.irl-player-mode`) — non concernée.
- Toute nouvelle interactivité pour le MJ : cette tâche réaffiche de la
  VISUALISATION seulement, elle ne redonne au MJ aucune capacité de
  répondre/agir sur les tuiles (le MJ reste un présentateur pur).

## Fichiers concernés
- `client/public/css/style.css` — règle `body.irl-presenter-mode
  #inputArea` (031) à retirer/adapter ; règles d'agrandissement de
  l'illustration desktop + grille portrait 1 colonne (031) à revoir ;
  styles `body.irl-presenter-mode #irlAnswerRecap` (033) à trancher selon
  la décision prise sur son sort.
- `client/public/js/index.js` — `updateIrlPlayerUI()`/`isPresenterHost()`
  (la classe `irl-presenter-mode` elle-même n'a probablement pas besoin de
  changer, seul le CSS qui la consomme change) ; relecture des fonctions
  `build*`/`reveal*` par type de question pour confirmer qu'aucune ne
  réactive l'interactivité pour `isPresenterHost()` ; `buildIrlAnswerRecap`
  et le bloc qui le peuple (à garder ou retirer selon la décision sur
  `#irlAnswerRecap`).
- `docs/agent-tasks/031-irl-hide-gameplay-mj.md` et
  `033-multi-sujets-2.md` — référence historique uniquement, pas de
  modification de leur contenu.

## Plan
_à remplir par `/plan-feature`_

## Étapes réalisées
- [ ]

## Checks effectués
- [ ] `node --check client/public/js/index.js`
- [ ] Vérification visuelle Browser pane

## Tests manuels recommandés
_à remplir par `/plan-feature`_

## Risques restants
_à remplir par `/plan-feature`_

## Statut
`ouverte`
