# [029] Régie MJ : jamais de scroll pendant une présentation

## Contexte
Retour utilisateur (deux captures d'écran, Blind Test) : sur l'écran du MJ
en régie desktop, l'illustration + le visualiseur audio + le curseur de
volume + le bandeau "Bonne réponse" débordaient tous du cadre, avec une
scrollbar visible — inutilisable en présentation live. Confirmé ensuite par
un deuxième retour (captures, type "Association") : une question à 8 paires
déborde aussi, la consigne n'étant même plus visible en scrollant au
maximum. Demande explicite : "Tout les éléments sur l'affichage du MJ
devraient être dans le cadre. Trouve une astuce pour ne pas avoir à
scroller lors d'une présentation" — un correctif générique, pas un réglage
par type de question (contrairement à la tâche [028](028-image-portrait-regie.md),
qui ne concernait que le cas portrait).

## Objectif
Sur l'écran du MJ (régie desktop, `body.is-host.game-active`, ≥1100px)
uniquement : quel que soit le type de question et son contenu, la carte de
jeu (`#main`, dans `#stageWrap`) ne doit jamais nécessiter de scroll pour
être visible en entier pendant une présentation.

## Périmètre
- Mécanisme générique, indépendant du type de question : mesure la hauteur
  réelle du contenu après chaque affichage/révélation et le réduit avec
  `zoom` (jamais `transform: scale`, qui ne change que le rendu visuel, pas
  la taille de mise en page prise en compte par le calcul de débordement
  d'un ancêtre) tout juste assez pour tenir dans la carte, jamais agrandi
  au-delà de 100%.
- Uniquement régie desktop — aucun effet côté joueur/mobile.

## Hors périmètre
- Tout réglage CSS par type de question (déjà couvert au cas par cas par
  ailleurs, ex. [028](028-image-portrait-regie.md) pour le portrait) — ce
  mécanisme est un filet de sécurité générique en complément, pas un
  remplacement.
- Tout changement de mise en page côté joueur/IRL.

## Fichiers concernés
- `client/public/js/index.js` — nouvelle fonction `fitStageContent()`,
  appelée en fin de `question:show` (+ `setTimeout` 400ms pour les images
  de tuiles qui continuent de charger après ce point) et de
  `question:reveal`, ainsi qu'au chargement/erreur de l'illustration.

## Plan
- Mesurer `#stageWrap.clientHeight` (moins son padding) comme espace
  disponible, et `#main.scrollHeight` comme hauteur réelle du contenu à
  `zoom` remis à 1 (sinon un zoom déjà appliqué à la question précédente
  fausserait la mesure).
- Si le contenu déborde, poser `mainEl.style.zoom = available / contentHeight`,
  borné entre `STAGE_FIT_MIN_ZOOM` (0.55, pour ne jamais réduire au point de
  devenir illisible) et `1` (jamais agrandi).

## Étapes réalisées
- [x] 1. `fitStageContent()` + `STAGE_FIT_MIN_ZOOM` ajoutés, câblés en fin
      de `question:show`/`question:reveal` et sur l'illustration.
- [x] 2. **Bug trouvé en vérifiant en direct** : la mesure passait par un
      `requestAnimationFrame`, qui ne se déclenche jamais tant que l'onglet
      n'est pas au premier plan (constaté dans le bac à sable de test de cet
      agent, onglet toujours "hidden" — voir mémoire
      `sandbox-browser-no-raf`). Au-delà du problème de test, c'est un vrai
      risque en usage réel (fenêtre de présentation qui perd le focus,
      partage d'écran...). Corrigé en rendant la mesure synchrone : lire
      `scrollHeight`/`clientHeight` juste après le reset du style force déjà
      un recalcul de mise en page dans le navigateur, `requestAnimationFrame`
      n'apportait rien ici.

## Checks effectués
- [x] `node --check client/public/js/index.js` — passe.
- [x] **Vérification EN DIRECT** (Browser pane, vraie page, salle
      "Présenter", régie desktop) :
  - Question "Association" à 8 paires (le cas signalé) : `contentHeight`
    (604px) dépassait l'espace disponible (576px) → zoom appliqué
    (`≈0.95`), rendu confirmé par capture d'écran — titre, 8 lignes de
    paires, tout tient dans la carte sans scroll.
  - Question "Blind Test" avec illustration portrait + son : rendu
    confirmé par capture d'écran, tout tient dans le cadre (le contenu de
    ce cas précis tenait déjà sans besoin de réduire le zoom, confirmant
    que le mécanisme ne réduit QUE quand c'est nécessaire).

## Tests manuels recommandés
Tester en conditions réelles (pas juste des données de test synthétiques) :
une question Blind Test avec une vraie image portrait + un extrait audio
long, une question à choix multiples avec beaucoup d'options, une question
"Intrus" avec plusieurs photos — confirmer qu'aucun cas ne nécessite de
scroll et que le zoom réduit reste lisible (jamais en dessous de 55%).

## Risques restants
- `STAGE_FIT_MIN_ZOOM = 0.55` est une valeur empirique : un contenu qui
  déborderait même à 55% de zoom resterait scrollable/coupé — pas de cas de
  ce genre rencontré en test, mais possible avec un contenu extrême (ex.
  énoncé très long + beaucoup d'options + image).
- Mécanisme basé sur `zoom`, propriété non standard mais largement
  supportée par les navigateurs Chromium/WebKit récents (pas de préoccupation
  ici, la régie MJ tourne toujours sur un navigateur desktop moderne).

## Statut
`en review`
