# [030] Régie MJ : disposition dédiée par type de question

## Contexte
Demande utilisateur : que chaque type de question ait, en régie desktop MJ,
une disposition adaptée à son contenu plutôt que de s'appuyer uniquement sur
le générique + le filet de sécurité anti-débordement ([029](029-fit-stage-content-regie.md)).
Un sous-agent design a exploré le code et produit une proposition détaillée :
[030-dispositions-par-type-regie-PROPOSITION.md](030-dispositions-par-type-regie-PROPOSITION.md).
Cette tâche reprend les pistes retenues de cette proposition.

## Objectif
Pour chaque type retenu ci-dessous, une disposition régie desktop
(`body.is-host.game-active .container`, `min-width: 1100px`) qui utilise
mieux l'espace disponible que le générique actuel — sans jamais toucher la
vue joueur (mobile/tablette/IRL).

## Périmètre
Les pistes CSS (et un point JS ponctuel pour blindtest si nécessaire)
identifiées dans la proposition, traitées une par une, chacune vérifiée en
direct par un sous-agent dédié avant de passer à la suivante :
1. blindtest — orbe audio agrandi.
2. graduation — curseur agrandi.
3. reveal / recherche / halo — gabarit partagé agrandi (un seul chantier).
4. order / timeline — liste élargie/agrandie.
5. rangement — zones élargies.
6. association — grille élargie/agrandie.
7. indice — carte centrale élargie (hauteur fixe conservée, animation à
   valider visuellement).

## Hors périmètre
- mcq / truefalse / intrus / zoomguess / free / pbac : proposition = pas de
  changement (déjà bien traités ou structurellement rien à disposer).
- image : proposition = gain réel mais nécessite de toucher du JS
  (`setupImageFrame`/`IMAGE_FRAME_MAX_HEIGHT`), pas seulement du CSS
  conditionnel comme les autres pistes — explicitement déprioritisé, pas
  traité dans cette tâche.

## Fichiers concernés
- `client/public/css/style.css` — toutes les pistes.
- `client/public/js/index.js` — uniquement si `buildBlindTestOrbBars`
  s'avère dépendre d'une constante en dur plutôt que de la taille réelle de
  `.blindtest-orb` (point 1).

## Plan
1. blindtest (CSS + vérif JS orbe).
2. graduation (CSS pur).
3. reveal / recherche / halo (CSS pur, un bloc pour 3 types).
4. order / timeline (CSS pur).
5. rangement (CSS pur).
6. association (CSS pur).
7. indice (CSS pur, vérif visuelle animation flip).

Chaque étape : implémentation → `node --check` si JS touché → vérification
EN DIRECT par un sous-agent dédié (Browser pane, vraie page, salle
"Présenter", régie desktop) avant de passer à l'étape suivante.

## Étapes réalisées
- [x] 1. blindtest
- [x] 2. graduation
- [x] 3. reveal / recherche / halo
- [x] 4. order / timeline
- [x] 5. rangement
- [x] 6. association
- [x] 7. indice

## Checks effectués
- [x] 1. blindtest — CSS pur (`.blindtest-orb`/`-core`/`-bars` élargis, 24
      barres décoratives suivent via `transform: scale(1.591)` sur leur
      conteneur plutôt que de toucher `buildBlindTestOrbBars`). Vérifié EN
      DIRECT par sous-agent dédié (Browser pane, salle "Présenter", régie
      1400px) : `.blindtest-orb` 280px, `-core` 120px, `-bars` scale
      confirmé, couronne bien répartie, rien ne déborde. **PASS**.
- [x] 2. graduation — CSS pur (`.graduation-area`/`.grad-slider`/`-track`/
      `-thumb`/`.grad-value`/`.graduation-labels` élargis/agrandis).
      Vérifié EN DIRECT par sous-agent dédié : toutes les valeurs CSS
      appliquées exactement comme prévu, ET test d'interaction (clic à 0/
      25/50/75/100% de la piste élargie) confirmant que `setFromClientX`
      (basé sur `getBoundingClientRect`, pas de px en dur) reste
      parfaitement précis à la nouvelle taille. **PASS**.
- [x] 3. reveal / recherche / halo — CSS pur, un seul bloc de règles pour
      les 3 types (gabarit partagé). Vérifié EN DIRECT par sous-agent
      dédié sur les 3 types un par un : tailles appliquées (900px/560px),
      ET pour recherche/halo test d'interaction pointeur confirmant que le
      masque "lampe torche" (`--spot-x`/`--spot-y`/`mask-image`, calculé
      via `getBoundingClientRect()` dynamique) reste parfaitement aligné
      sur la nouvelle taille de boîte, aucun décalage résiduel. **PASS**.
- [x] 4. order / timeline — CSS pur (`.order-area`/`.timeline-area`/
      `-item`/`-item-text`/`-item-title`/`-item-desc` élargis/agrandis).
      Vérifié EN DIRECT par sous-agent dédié : tailles appliquées, test de
      glisser-déposer sans anomalie DOM. Constat utile du sous-agent : le
      drag est de toute façon désactivé pour l'hôte présentateur
      (`isPresenterHost()`, ce type de vue n'est jamais interactive pour
      lui) — le risque "casser le drag" n'existait donc pas réellement sur
      cette vue précise, confirmé empiriquement. **PASS**.
- [x] 5. rangement — CSS pur (`.rangement-area` élargi à 1000px, motif de
      rangée déjà en % côté JS, rien d'autre à toucher). Vérifié EN DIRECT
      par sous-agent dédié à 5 zones (motif 3+2) : zones d'une même rangée
      strictement identiques entre elles, rangées bien centrées l'une sous
      l'autre, aucune disproportion. **PASS**.
- [x] 6. association — CSS pur (`.association-area` élargi à 900px,
      `.assoc-item` agrandi). Vérifié EN DIRECT par sous-agent dédié :
      styles appliqués, ET traits SVG reliant les paires (calculés
      dynamiquement via `getBoundingClientRect()`) exactement alignés sur
      les tuiles à la nouvelle taille, aucun décalage. **PASS**.
- [x] 7. indice — CSS pur (`.indice-area`/`.indice-central`/`-card`/
      `.indice-card-text` élargis/agrandis, hauteur relevée 240→320px).
      Vérifié EN DIRECT par sous-agent dédié : tailles appliquées, aucun
      débordement de texte (même avec un indice long), ET calcul FLIP
      (`flipIndiceCardToHistory`) toujours cohérent à la nouvelle taille
      (dx/dy/sx/sy vérifiés sans NaN, correspondant exactement au
      `getBoundingClientRect()` réel) — la technique FLIP mesure
      dynamiquement, aucune dépendance à l'ancienne valeur 240px. **PASS**.

Les 7 étapes de la tâche 030 sont validées. Prêt pour le push.

## Tests manuels recommandés
Tester chaque type avec de vraies données (pas seulement les scénarios de
test synthétiques utilisés pour la vérification en direct).

## Risques restants
- Les mesures ont été prises avec des données de test synthétiques (SVG
  data URI, textes courts/longs choisis à la main) — voir "Tests manuels
  recommandés" pour la validation en conditions réelles.
- `indice` : hauteur relevée 240px→320px, sûr pour le calcul FLIP
  (dynamique, vérifié), mais l'animation visuelle elle-même (retournement
  3D à l'entrée, vol vers l'historique) n'a pas pu être observée EN
  MOUVEMENT dans ce sandbox de test (limitation `requestAnimationFrame`
  documentée dans [029](029-fit-stage-content-regie.md), pas un doute sur
  ce changement précis) — à confirmer visuellement par l'utilisateur en
  usage réel si un souci d'animation apparaissait (peu probable vu la
  vérification du calcul sous-jacent).
- `mcq`/`truefalse`/`intrus`/`zoomguess`/`free`/`pbac`/`image` restent hors
  périmètre de cette tâche (voir proposition), pas de régression possible
  puisque non touchés.

## Statut
`en review`
