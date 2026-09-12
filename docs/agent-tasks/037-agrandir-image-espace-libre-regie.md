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

**Conclusion de l'exploration** : "l'image" de la question ne vit pas au
même endroit selon le type — trois familles bien distinctes :
1. **Illustration décorative générique** (`#illustrationImgWrap` /
   `#illustrationImg`, `payload.illustrationUrl`) : utilisée par TOUS les
   types SAUF `image`/`reveal`/`recherche`/`halo`/`zoomguess` (qui ont leur
   propre champ image dédié, voir `emitQuestion` ~ligne 6283). C'est le cas
   le plus fréquent (mcq/truefalse/intrus/graduation/order/timeline/
   rangement/indice/blindtest/free/pbac) et celui qui illustre le mieux le
   problème signalé : plafond fixe `.illustration-img { max-height: 260px
   }` (ligne 2925, pensé mobile), jamais remonté pour la régie desktop —
   contrairement aux zones par type de la tâche 030.
2. **Zone image dédiée dans `#inputArea`**, où l'image EST tout le contenu
   de la question : `reveal`/`recherche`/`halo` partagent déjà un plafond
   généreux et responsive en régie desktop (`height: min(65vh, 560px)`,
   ligne 4541, tâche 030) — déjà mieux loti que le cas 1, mais toujours un
   plafond FIXE, pas dépendant de l'espace réellement libre pour CETTE
   question précise.
3. **Cas à part, mécaniquement plus sensibles** : `image` (zone cliquable,
   `#imageWrap` dimensionné via JS "une seule fois", pas en pur CSS, voir
   ligne ~2731) et `zoomguess` (mécanisme de zoom/dézoom avec calculs de
   transform dépendant de la taille affichée) — agrandir leur boîte sans
   casser leurs calculs JS demande plus de prudence. `association` n'a
   PAS "une image" mais jusqu'à 16 petites images de tuiles : agrandir
   l'espace ne se traduit pas par "une image plus grande" de la même
   façon.

**Approche retenue (cas 1 et 2)** : purement CSS, pas de mesure JS. Poser
UNE classe (ex. `has-question-image`) sur `#stageWrap`/`#main` à
`question:show`, dès que la question a une image (n'importe laquelle des
sources ci-dessus) — puis :
- `#stageWrap` : `align-self: stretch` au lieu de `center` sous cette
  classe (rejoint la hauteur des blocs latéraux, déjà stretch).
- `#main` passe en `display:flex; flex-direction:column` sous cette même
  classe (il ne l'est pas par défaut, simple bloc empilé) : badge/timer/
  question gardent leur taille naturelle, et le conteneur de l'image
  (`#illustrationImgWrap` pour le cas 1, `.reveal-area`/`.recherche-wrap`/
  `.halo-wrap` pour le cas 2) reçoit `flex: 1; min-height: 0`, avec l'image
  elle-même en `max-height: 100%; object-fit: contain` (retrait du plafond
  fixe sous cette classe). Le flex-grow absorbe alors AUTOMATIQUEMENT tout
  l'espace inutilisé, sans calcul JS — le navigateur fait le travail.
  *Trade-off* : une mesure JS (à la `fitStageContent`) donnerait un
  contrôle plus fin (ex. plafonner à l'aspect-ratio naturel de l'image
  pour éviter un agrandissement disproportionné sur une image très
  large/étroite), mais le flex-grow + `object-fit:contain` couvre déjà ce
  cas nativement (l'image ne peut pas dépasser son propre ratio à
  l'intérieur d'une boîte flex) — pas de raison d'ajouter de la
  complexité JS pour un résultat équivalent.
- Sans image sur la question : classe absente, `align-self: center` et
  comportement actuel intacts (déjà le cas par défaut).

1. **JS — poser la classe `has-question-image` au bon moment**
   - Dans le handler `question:show` (index.js), calculer si la question a
     une image (`payload.illustrationUrl || payload.imageUrl ||
     payload.enigmeImageUrl` selon le type — réutiliser la même logique
     que `mediaUrl`/les branches déjà lues dans `emitQuestion`/le handler
     client) et poser/retirer la classe sur `#stageWrap` en conséquence.
     Réservé à la régie desktop (`is-host`/`game-active`, la classe elle
     -même peut être posée partout, seul le CSS scopé `@media (min-width:
     1100px)` la rend active).
   - **Décision à confirmer** : `association` compte-t-il comme "a une
     image" pour cette classe (vu qu'elle n'agrandit rien de concret ici,
     étape 2/3 ne la couvrant pas) ? Proposition : NON à ce stade — la
     classe ne sert que pour les cas 1/2 couverts par l'étape suivante,
     `association` reste `align-self:center` comme aujourd'hui tant
     qu'elle n'a pas son propre traitement.

2. **CSS — `#stageWrap` stretch + `#main` flex sous `has-question-image`,
   cas 1 (illustration décorative générique)**
   - Nouvelle règle scopée `body.is-host.game-active.has-question-image
     .container #stageWrap { align-self: stretch }` (ou classe posée plus
     localement sur `#stageWrap` lui-même, à trancher au moment du code
     — équivalent fonctionnellement, préférence pour la classe sur
     `#stageWrap` directement : évite de dépendre d'un sélecteur combiné
     avec `body`, plus proche de l'élément concerné).
   - `#main` en flex-column + `#illustrationImgWrap { flex: 1; min-height:
     0; display:flex; align-items:center; justify-content:center }` +
     `.illustration-img { max-height: 100%` sous cette classe (au lieu de
     260px).
   - Couvre à lui seul la majorité des types (cas le plus visible du
     problème signalé : un mcq avec 4 options courtes + petite image).

3. **CSS — étendre à `reveal`/`recherche`/`halo` (cas 2)**
   - Même traitement flex pour `.reveal-area`/`.recherche-wrap`/
     `.halo-wrap` (leurs parents dans `#inputArea` doivent aussi devenir
     flex le temps de leur laisser absorber l'espace) — remplacer leur
     plafond fixe `min(65vh, 560px)` par un comportement flex-grow sous
     `has-question-image`, garder le plafond actuel en repli hors régie
     desktop/sans la classe.

4. **Vérifier la coexistence avec `fitStageContent`**
   - Rappeler `fitStageContent()` après l'agrandissement (déjà appelé aux
     bons points d'accroche, `question:show`/`question:reveal` — à
     vérifier que l'ORDRE reste correct : agrandir D'ABORD, puis laisser
     `fitStageContent` réduire par zoom SI malgré tout ça déborde encore,
     jamais l'inverse).
   - Cas à tester spécifiquement : question avec énoncé long + image +
     beaucoup d'options — confirmer que le résultat final reste dans le
     cadre (zoom réduit si besoin), pas de boucle ou d'état incohérent
     entre les deux mécanismes.

5. **Vérification visuelle**
   - Script Playwright jetable (même méthode que la tâche 036 — pas
     d'outil Browser pane dans cette session) : comparer AVANT/APRÈS sur
     un mcq simple (le cas le plus parlant), confirmer l'image
     visiblement plus grande et la carte alignée sur la hauteur des
     blocs latéraux ; confirmer qu'une question SANS image n'a rien
     changé (carte toujours compacte/centrée).

**Hors périmètre de ce plan, à trancher séparément si voulu** :
`image`/`zoomguess` (cas 3, dimensionnement JS/mécanique de zoom à
respecter) et `association` (pas "une image" mais une grille de tuiles) —
non traités ici, laissés avec leur comportement actuel.

Aucune étape ne touche une zone des "Interdictions" du `CLAUDE.md` (pas de
`supabase/schema.sql`, pas de `render.yaml`, pas de nouvelle dépendance) —
uniquement du CSS/JS côté client.

## Étapes réalisées
- [x] 1. JS — classe `has-question-image` posée sur `#stageWrap` à
      `question:show`, calculée type par type (reveal/recherche+halo/
      générique), `image`/`zoomguess`/`association` explicitement
      exclus. Aucun effet visuel encore : le CSS qui la consomme arrive
      aux étapes 2/3.
- [x] 2. CSS — stretch + flex illustration décorative générique (mcq,
      free, etc., portrait inclus) — confirmé visuellement, image
      nettement agrandie (ex. 260px → 404-1044px selon le cas), sans
      distorsion (`object-fit: contain`), question sans image inchangée.
      2 pièges rencontrés/corrigés en cours de route : `max-height`
      restait prioritaire sur `height:100%` sans `max-height:none`
      explicite ; `#illustrationZoomLayer` (enveloppe intermédiaire)
      avait besoin d'une largeur ET hauteur explicites (référence
      circulaire sinon).
- [x] 3. CSS — étendu à reveal/recherche/halo — confirmé visuellement.
      2 pièges supplémentaires : `#inputArea` reçoit `display:block` en
      inline à chaque question (même piège que `#main`, `!important`
      nécessaire) ; `.reveal-area`/`.reveal-img-wrap` ont une marge
      gauche/droite `auto` (pensée pour un centrage hors flex) qui
      empêche l'étirement sur l'axe transversal sans `width:100%`
      explicite — les deux effondraient toute la chaîne à 0px sans ces
      correctifs. `#illustrationImgWrap` (vide pour ces 3 types) protégé
      par `:has(.illustration-img:not(.d-none))` pour ne pas voler
      l'espace flex de `#inputArea`.
- [ ] 4. Coexistence avec `fitStageContent`
- [ ] 5. Vérification visuelle

## Checks effectués
- [x] Étape 1 : `node --check client/public/js/index.js` — passe.
- [ ] Vérification visuelle (script Playwright jetable, comme pour la
      tâche 036 — aucun outil Browser pane interactif dans cette session
      distante)

## Tests manuels recommandés
En régie desktop (≥1100px), salle IRL (Présenter et "à distance", les deux
utilisent la même régie) :
- MCQ avec petite illustration + peu d'options : image nettement plus
  grande, carte alignée sur la hauteur des docks latéraux.
- MCQ SANS illustration : aucun changement (carte toujours compacte,
  centrée).
- Reveal / recherche / halo : image toujours plus grande qu'avant quand
  il y a de la place, jamais de scroll inattendu.
- Question à énoncé long + illustration + beaucoup d'options (ex.
  association 8 paires ou rangement avec plusieurs zones) : confirmer que
  `fitStageContent` réduit toujours correctement si le total déborde
  malgré l'agrandissement.
- Illustration très large (paysage) et très étroite (portrait) : l'image
  ne doit jamais déformer son ratio (`object-fit: contain`), ni déborder
  horizontalement de sa colonne.

## Risques restants
- Les types "cas 3" (`image`/`zoomguess`) et `association` restent hors
  périmètre — leur écran continuera de sembler comparativement plus petit/
  centré que les autres types une fois cette tâche faite, pouvait donner
  une impression d'incohérence entre types si remarqué.
- `#illustrationImgWrap`/zones image dédiées n'ont aujourd'hui aucune
  règle de flex — vérifier qu'aucune autre règle CSS existante ne dépend
  implicitement de leur comportement de bloc normal (ex. marges `auto`,
  `text-align: center` hérité) une fois passées en enfants flex.

## Statut
`en cours`
