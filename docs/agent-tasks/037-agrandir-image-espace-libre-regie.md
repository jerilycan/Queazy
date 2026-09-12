# [037] Régie MJ : agrandir l'image dans l'espace libre du bloc central

## Contexte
Retour utilisateur, en prolongement direct de la tâche
[036](036-reponses-visibles-mj-irl.md) (réaffichage des tuiles de réponse
côté MJ) : en régie desktop (≥1100px), les 3 colonnes de
`body.is-host.game-active .container` (`#hostPanel`, `#stageWrap`,
`#liveClassementDock`) sont dans la même rangée de grille avec
`align-items: stretch` — mais `#stageWrap` (la carte centrale, question +
image + tuiles) annule volontairement ce stretch depuis un retour
utilisateur antérieur ("4e passe", voir commentaire dans `style.css`) :
`align-self: center; min-height: 380px; max-height: 100%;`. Résultat : les
2 blocs latéraux s'étirent toujours sur toute la hauteur de la rangée,
alors que le bloc central reste centré à la taille de son propre contenu —
s'il y a peu de contenu (ex. MCQ avec options courtes + petite
illustration), il reste petit avec de l'espace vide au-dessus/en-dessous,
alors que rien ne l'empêche techniquement d'aller jusqu'à la même hauteur
(le plafond `max-height: 100%` existe déjà, seul `align-self: center` +
`min-height: 380px` retiennent la carte à sa taille de contenu).

Demande : quand la carte centrale POURRAIT atteindre la hauteur des blocs
latéraux (i.e. il y a de la place inutilisée), la laisser l'atteindre, et
donner cet espace récupéré à l'IMAGE de la question (illustration
décorative générique, ou image spécifique au type) pour l'agrandir —
plutôt que de laisser du vide autour d'une carte compacte.

**Discussion préalable avec l'utilisateur, décisions actées** :
- Une question **sans aucune image** garde le comportement actuel (carte
  compacte, centrée, `align-self: center` inchangé pour ce cas) — rien à
  agrandir, pas de raison d'étirer la carte. Précision utilisateur : même
  des types "texte" comme `free`/`order` peuvent avoir une illustration
  optionnelle — ce n'est donc pas une liste de types à exclure, c'est une
  question de savoir si CETTE question précise porte une image ou non.
- Le mécanisme existant `fitStageContent` (tâche
  [029](029-fit-stage-content-regie.md), qui RÉDUIT le contenu via `zoom`
  quand il déborde de la carte, plancher `STAGE_FIT_MIN_ZOOM = 0.55`) doit
  continuer à fonctionner normalement en parallèle — ce nouveau mécanisme
  s'ajoute pour le cas inverse (agrandir quand il y a de la place
  inutilisée), il ne le remplace pas. Les deux peuvent s'appliquer sur la
  même question (ex. image agrandie au maximum, puis si malgré tout le
  total déborde encore, `fitStageContent` réduit par-dessus).

## Objectif
En régie desktop (`body.is-host.game-active`, ≥1100px) : pour toute
question qui porte une image (illustration décorative générique OU image
spécifique aux types `image`/`reveal`/`recherche`/`halo`/`zoomguess`/
`association`), le bloc central (`#stageWrap`/`#main`) utilise la hauteur
disponible jusqu'à celle des blocs latéraux (`#hostPanel`/
`#liveClassementDock`) quand le contenu ne la remplit pas déjà, et
l'espace ainsi récupéré profite à l'agrandissement de l'image — pas
seulement à un centrage avec du vide autour. Sans image sur la question,
comportement actuel inchangé (carte compacte, centrée).

## Périmètre
- Tous les types de question, dès lors que LA question en cours porte une
  image (illustration générique ou image dédiée au type).
- Uniquement régie desktop (`body.is-host.game-active`, ≥1100px) — même
  portée que les tâches 028/029/030/031, jamais la vue joueur/mobile.
- `#stageWrap` : revoir `align-self: center` pour permettre à la carte de
  s'étirer jusqu'à la hauteur de la rangée QUAND il y a une image et de la
  place à donner (mécanisme à concevoir au planning — probablement
  conditionné en JS via une classe posée sur la carte, plutôt qu'un pur
  changement CSS statique, puisque la décision dépend de la présence d'une
  image sur CETTE question précise).
- L'agrandissement doit cibler l'image en priorité (pas juste étirer la
  carte en laissant le vide se déplacer autour de l'image toujours à sa
  taille plafond actuelle, ex. `.illustration-img { max-height: 260px }`
  ou les plafonds par type de la tâche 030, ex. `.reveal-img-wrap { height:
  min(65vh, 560px) }`).
- Coexistence avec `fitStageContent` (tâche 029) : les deux mécanismes
  actifs simultanément, sans que l'un ne casse l'autre (voir Contexte).

## Hors périmètre
- Question sans aucune image : comportement inchangé (carte compacte/
  centrée), pas dans le périmètre de cette tâche.
- Mode "à distance" et vue joueur/mobile : jamais concernés (régie desktop
  hôte uniquement, comme les tâches 028/029/030/031).
- Toute refonte du mécanisme `fitStageContent` lui-même (le rétrécissement
  en cas de débordement) — il doit continuer à fonctionner tel quel, pas
  être réécrit ici.
- Disposition portrait dédiée (`.regie-portrait-layout`, tâche 028, grid 2
  colonnes) : à vérifier au planning si elle a besoin d'un ajustement
  similaire ou si elle reste hors périmètre (sa colonne image a déjà sa
  propre logique de taille).

## Fichiers concernés
- `client/public/css/style.css` — règle `body.is-host.game-active
  .container #stageWrap` (`align-self: center`, `min-height: 380px`,
  `max-height: 100%`, ~ligne 4370-4423) à revoir ; plafonds de taille par
  type d'image à ajuster en conséquence (`.illustration-img` ligne ~2899,
  et les règles régie desktop par type ajoutées en tâche 030 — reveal/
  recherche/halo/order/timeline/rangement/indice/graduation/blindtest,
  ~lignes 4466-4550).
- `client/public/js/index.js` — `fitStageContent()` (~ligne 6607, tâche
  029) : à examiner pour savoir si le nouveau mécanisme d'agrandissement
  s'y intègre (même fonction étendue) ou vit à côté (nouvelle fonction
  dédiée, appelée aux mêmes points : fin de `question:show`/
  `question:reveal`, chargement de l'illustration) — décision à prendre au
  planning avec le trade-off noté.
- `docs/agent-tasks/029-fit-stage-content-regie.md` — référence
  historique uniquement, pas de modification de son contenu.

## Plan
_à remplir par `/plan-feature`_

## Étapes réalisées
- [ ]

## Checks effectués
- [ ] `node --check client/public/js/index.js` (si JS modifié)
- [ ] Vérification visuelle (script Playwright jetable, comme pour la
      tâche 036 — aucun outil Browser pane interactif dans cette session
      distante)

## Tests manuels recommandés
_à remplir par `/plan-feature`_

## Risques restants
_à remplir par `/plan-feature`_

## Statut
`ouverte`
