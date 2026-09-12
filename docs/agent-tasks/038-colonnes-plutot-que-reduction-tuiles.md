# [038] Régie MJ : plus de colonnes plutôt que réduire les tuiles

## Contexte
Retour utilisateur, en réaction directe à un cas mis en évidence pendant
les tests de la tâche [037](037-agrandir-image-espace-libre-regie.md)
(agrandir l'image dans l'espace libre du bloc central) : sur un QCM avec
beaucoup d'options (testé avec 8), le filet de sécurité existant
`fitStageContent` (tâche [029](029-fit-stage-content-regie.md)) réduit
TOUT le contenu de la carte via `zoom` (jusqu'au plancher
`STAGE_FIT_MIN_ZOOM = 0.55`) pour éviter le scroll — y compris les tuiles
de réponse, qui deviennent nettement plus petites et moins lisibles.

`.options-grid` (mcq/truefalse/intrus) est aujourd'hui figée à exactement
2 colonnes (`grid-template-columns: repeat(2, 1fr)`, `style.css` ligne
~1778) quel que soit le nombre d'options — plus il y a d'options, plus la
grille s'allonge en HAUTEUR (plus de rangées), jusqu'à dépasser l'espace
disponible et déclencher la réduction globale par zoom. Demande
explicite : les tuiles de réponse doivent garder leur taille actuelle (ou
à peine plus petite) pour rester lisibles — s'il faut de la place en plus,
l'ajouter en LARGEUR (plus de colonnes) plutôt qu'en récupérant de la
hauteur au prix d'un rétrécissement global.

## Objectif
En régie MJ desktop (`body.is-host.game-active`, ≥1100px), quand une
question a beaucoup d'éléments de réponse (cas cité : QCM à beaucoup
d'options ; `.options-grid`, types mcq/truefalse/intrus) : la grille
s'étale en plus de colonnes plutôt que de s'allonger en hauteur, de sorte
que chaque tuile garde une taille proche de sa taille actuelle (celle déjà
utilisée aujourd'hui, ≥1300px : `min-height: 88px; font-size: 20px`, voir
`style.css`) au lieu de dépendre de `fitStageContent` pour tenir dans le
cadre.

## Périmètre
- `.options-grid` (mcq/truefalse/intrus) — le cas cité explicitement,
  actuellement figé à 2 colonnes indépendamment du nombre d'options.
- Garder le rendu ACTUEL inchangé pour un nombre d'options "normal" (ex.
  4, le cas le plus courant) — pas question de repasser en 3-4 colonnes
  par défaut pour un QCM classique, seulement quand le nombre d'options
  dépasse ce que 2 colonnes peuvent raisonnablement contenir sans
  déclencher `fitStageContent`.
- `fitStageContent` reste en place comme filet de sécurité DERNIER
  RECOURS (cas réellement extrême — énoncé très long + beaucoup
  d'options + image, où même en colonnes ça ne suffirait pas) — cette
  tâche vise à le rendre inutile dans l'immense majorité des cas, pas à
  le retirer.
- Uniquement régie desktop (`body.is-host.game-active`, ≥1100px) — même
  portée que les tâches 028/029/030/031/037, jamais la vue joueur/mobile
  (qui garde sa propre disposition, pensée pour un écran étroit où
  ajouter des colonnes n'aurait pas de sens).

## Hors périmètre
- **À confirmer avec l'utilisateur avant `/plan-feature`** : les autres
  zones à liste d'éléments qui peuvent aussi s'allonger — `association`
  (déjà une disposition adaptative en rangées, tâche récente hors suivi
  agent-tasks, probablement déjà satisfaisante), `rangement` (déjà des
  rangées adaptatives par zone, tâche 013), `order`/`timeline` (liste
  SÉQUENTIELLE où l'ordre de lecture compte — passer en plusieurs
  colonnes casserait la lecture "qui suit qui", probablement à exclure
  par nature). Cadrées ici comme hors périmètre par défaut ; seul
  `.options-grid` est traité dans cette tâche sauf validation contraire.
- Vue joueur (mobile/tablette/PC) : disposition actuelle inchangée.
- Toute modification du plancher `STAGE_FIT_MIN_ZOOM` ou de la logique
  interne de `fitStageContent` lui-même (tâche 029) — reste tel quel,
  seulement moins souvent sollicité.

## Fichiers concernés
- `client/public/css/style.css` — `.options-grid` (ligne ~1778, figée à
  `repeat(2, 1fr)`) : à rendre dépendante du nombre d'options en régie
  desktop (probablement via une variable CSS `--options-cols` posée en
  JS, plutôt qu'un `auto-fit` pur qui changerait aussi le rendu du cas à
  4 options déjà satisfaisant — à trancher au planning).
- `client/public/js/index.js` — construction des tuiles MCQ/truefalse/
  intrus (`question:show`, bloc `optionsDiv`/`.options-grid`, voir aussi
  `buildOptions`-like logic déjà en place) : poser le nombre de colonnes
  selon le nombre d'options, uniquement en régie desktop.
- `docs/agent-tasks/029-fit-stage-content-regie.md` et
  `037-agrandir-image-espace-libre-regie.md` — référence historique
  uniquement, pas de modification de leur contenu.

## Plan

**Conclusion de l'exploration** : le périmètre réel se réduit à MCQ
uniquement.
- `truefalse` a TOUJOURS exactement 2 options (`.options-grid.truefalse-grid`
  ne surcharge jamais `grid-template-columns`, hérite du `repeat(2, 1fr)`
  de base) — déjà optimal, rien à faire.
- `intrus` a DÉJÀ un système adaptatif dédié (`--intrus-row-cols`, posé
  PAR TUILE en JS, table `INTRUS_ROW_PATTERNS` dans `index.js`, consommé
  par `.options-grid.intrus-grid` en `flex-wrap` — pas `grid-template-
  columns`) depuis un retour utilisateur antérieur, actif dès 900px donc
  déjà couvert en régie desktop. Rien à faire non plus.
- Seul `.options-grid` "nu" (mcq, ni `.truefalse-grid` ni `.intrus-grid`)
  reste figé à `repeat(2, 1fr)` (`style.css` ligne 1778) quel que soit le
  nombre d'options — 2 à 8 par question, bornes imposées par l'éditeur
  (`MCQ_MIN_OPTIONS`/`MCQ_MAX_OPTIONS`, `editor.js`).
- Filet de sécurité déjà existant et pertinent pour ce plan :
  `fitTileText` (`index.js`) réduit déjà la police d'UNE tuile (plancher
  12px) si son texte déborde à largeur donnée — couvre déjà le cas d'une
  réponse longue dans une tuile devenue plus étroite avec plus de
  colonnes, rien à ajouter ici non plus.

**Approche retenue** : même patron que `--intrus-row-cols` (déjà en
place) — une variable CSS posée en JS au moment de construire les tuiles
MCQ, consommée par une règle CSS scopée régie desktop. Nombre de colonnes
selon le nombre d'options (`count`) : `count <= 4 ? 2 : count <= 6 ? 3 :
4` (2-4 options : 2 colonnes, comportement ACTUEL inchangé ; 5-6 : 3 ;
7-8 : 4). *Trade-off* : une formule plutôt qu'une table explicite comme
`INTRUS_ROW_PATTERNS` — justifié pour l'intrus par un besoin spécifique
(éviter une tuile orpheline mal centrée en rangées de largeur variable),
absent ici (grille uniforme `repeat(N, 1fr)`, une dernière rangée
incomplète reste simplement alignée à gauche — déjà le cas AUJOURD'HUI
pour un MCQ à 3 options avec la grille figée à 2 colonnes, rien de
nouveau introduit par ce changement).

1. **JS — poser `--mcq-cols` à la construction des tuiles MCQ**
   - Dans la branche `payload.type === 'mcq'` de la construction des
     tuiles (`index.js`, ~ligne 7223), calculer le nombre de colonnes
     depuis `payload.options.length` et le poser via
     `optionsDiv.style.setProperty('--mcq-cols', ...)`.
   - Réinitialiser (`removeProperty`) pour les autres types partageant
     `#options` (truefalse/intrus), par hygiène — même pattern déjà
     utilisé pour `--intrus-cols` juste à côté — bien que ces deux types
     ne consomment jamais cette propriété (la règle CSS de l'étape 2 les
     exclut explicitement), pour ne pas laisser une valeur JS orpheline
     sans lecteur.

2. **CSS — consommer `--mcq-cols` en régie desktop uniquement**
   - `body.is-host.game-active .container .options-grid:not(.truefalse-grid):not(.intrus-grid) { grid-template-columns: repeat(var(--mcq-cols, 2), 1fr); }`
     (repli à 2 si jamais absente — identique au rendu actuel).
   - Uniquement régie desktop (`body.is-host.game-active`, ≥1100px) :
     vue joueur/mobile inchangée, comme cadré.

3. **Vérification visuelle**
   - Script Playwright jetable (même méthode que les tâches 036/037) :
     MCQ à 2, 4, 6 et 8 options, avec et sans illustration (pour
     confirmer la bonne coexistence avec la tâche 037 — l'image doit
     continuer à profiter de l'espace vertical libéré par des tuiles
     moins hautes), à 1366×768 ET 1920×1080. Confirmer :
     - 2-4 options : rendu IDENTIQUE à avant (2 colonnes, même taille de
       tuile).
     - 5-8 options : passage à 3/4 colonnes, taille de police/tuile
       proche de l'actuelle (`fitTileText` peut la réduire légèrement si
       une réponse est longue — attendu, "à peine plus petit" accepté
       par l'utilisateur).
     - `fitStageContent` sollicité beaucoup moins souvent (idéalement
       plus du tout pour 8 options texte courtes sans image) — comparer
       `mainZoom` avant/après sur le même cas que le stress-test de la
       tâche 037.

Aucune étape ne touche une zone des "Interdictions" du `CLAUDE.md` (pas de
`supabase/schema.sql`, pas de `render.yaml`, pas de nouvelle dépendance) —
uniquement du CSS/JS côté client.

## Étapes réalisées
- [x] 1. JS — `--mcq-cols` posée sur `#options` à la construction des
      tuiles MCQ (formule `count<=4?2:count<=6?3:4`). Réinitialisée
      (`removeProperty`) une seule fois avant les branches par type
      (juste après `optionsDiv.innerHTML = ''`), plutôt que dans chacune
      des branches truefalse/intrus séparément comme envisagé au
      planning — même résultat (aucune des deux ne consomme cette
      propriété), diff plus petit.
- [x] 2. CSS — `--mcq-cols` consommée par `.options-grid:not(.truefalse-grid):not(.intrus-grid)`
      en régie desktop uniquement. Confirmé visuellement : 2/4 options →
      2 colonnes (identique à avant), 6 → 3, 8 → 4 — tuiles toujours
      bien lisibles, `mainZoom` reste à `1` (aucune réduction
      déclenchée) même à 8 options sur 1366×768.
- [x] 3. Vérification visuelle complète — MCQ + illustration à 4 et 8
      options : image toujours visible, tuiles lisibles, aucun scroll,
      bonne coexistence avec la tâche 037 (image profite de l'espace
      libéré par une grille plus compacte). Cas cumulé extrême repéré
      (énoncé long + 8 options + illustration) : l'illustration se
      réduit jusqu'à disparaître complètement (espace vertical
      entièrement absorbé par le texte + les tuiles avant elle) — montré
      à l'utilisateur, jugé acceptable pour l'instant (résultat
      recherché — tuiles lisibles — atteint ; ce cas cumulé n'est pas le
      scénario décrit au départ). Piste retenue si retravaillé plus tard
      : réduire `#stageWrap`'s padding-top (96px, historique de réglages
      à la marge documentée dans son commentaire style.css) pour libérer
      de la place — nécessite une vérification live soigneuse (badge/
      timer en position absolue juste en dessous) avant d'y toucher, pas
      fait dans cette tâche.

## Checks effectués
- [x] Étape 1 : `node --check client/public/js/index.js` — passe.
- [x] Étape 2 : brace-balance CSS vérifiée ; vérification visuelle
      (script Playwright jetable) sur 2/4/6/8 options à 1366×768 —
      captures + mesures (`--mcq-cols`, `grid-template-columns`,
      `mainZoom`) conformes à l'attendu pour les 4 cas.
- [x] Étape 3 : vérification visuelle avec illustration (2/4/8 options +
      image, + cas cumulé énoncé long) — captures envoyées à
      l'utilisateur, comportement discuté et jugé acceptable en l'état.

## Tests manuels recommandés
En régie desktop (≥1100px), salle IRL (Présenter et "à distance", même
régie) :
- MCQ à 2, 3, 4 options : confirmer visuellement AUCUN changement par
  rapport à avant cette tâche.
- MCQ à 5, 6, 7, 8 options : confirmer le passage à 3/4 colonnes, tuiles
  lisibles (police proche de la taille actuelle), pas de zoom réducteur
  déclenché pour un cas raisonnable (réponses courtes).
- Même cas + illustration : confirmer que l'image profite bien de
  l'espace vertical libéré par la grille plus compacte (tâche 037).
- Une réponse MCQ avec un texte très long dans une grille à 4 colonnes
  (tuile étroite) : confirmer que `fitTileText` réduit sa police
  proprement sans casser la mise en page des autres tuiles.
- Vue joueur (mobile/PC) : confirmer AUCUN changement (grille 2 colonnes
  ou 1 colonne mobile, comme avant).

## Risques restants
- Dernière rangée incomplète (ex. 7 options en 4 colonnes = 4+3) reste
  alignée à gauche, pas centrée — limitation cosmétique mineure, déjà
  présente aujourd'hui pour un MCQ à 3 options (grille 2 colonnes
  figée), pas une régression introduite par cette tâche. Si signalé à
  l'usage, s'inspirer du traitement déjà fait pour "intrus" (flex-wrap +
  justify-content:center) plutôt que de le anticiper sans demande.
- Les seuils choisis (≤4→2, ≤6→3, ≤8→4 colonnes) sont un point de départ
  raisonnable, pas testés avec du vrai contenu utilisateur (textes
  d'options réels, pas les placeholders synthétiques du script de test)
  — à ajuster si le rendu réel semble trop serré ou trop clairsemé.
- **Cas cumulé extrême** (énoncé de question long + 8 options +
  illustration) : l'illustration disparaît complètement (réduite à 0 par
  le flex-grow, aucune place restante une fois texte + tuiles logés) —
  montré à l'utilisateur, jugé secondaire par rapport à l'objectif
  principal (tuiles lisibles, atteint). Piste de correctif envisagée
  mais NON faite ici : réduire `#stageWrap`'s `padding-top` (96px
  aujourd'hui, marge dont l'historique dans `style.css` documente déjà
  un tâtonnement — 48px insuffisant, 80px encore signalé insuffisant
  mais soupçonné d'être un artefact de cache PWA plutôt qu'un vrai
  calcul, 96px jamais revalidé depuis) pour redonner de la place — décrit
  comme "pousser l'énoncé plus haut, dans la limite d'une marge minimum
  de respiration". Nécessite une mesure live précise du dégagement
  réel sous le badge/timer (tous deux position:absolute juste en
  dessous) avant de choisir une nouvelle valeur, pour ne pas
  réintroduire le chevauchement historique — à reprendre dans une
  tâche dédiée si besoin.

## Statut
`en review`
