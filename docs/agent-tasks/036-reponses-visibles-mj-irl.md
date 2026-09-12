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
- Retirer `#irlAnswerRecap` (résumé texte, tâche 033) : redondant une fois
  les tuiles à nouveau visibles à la révélation (décision validée par
  l'utilisateur — pas besoin de le garder).

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
  styles `body.irl-presenter-mode #irlAnswerRecap` (033) à retirer.
- `client/public/js/index.js` — `updateIrlPlayerUI()`/`isPresenterHost()`
  (la classe `irl-presenter-mode` elle-même n'a probablement pas besoin de
  changer, seul le CSS qui la consomme change) ; relecture des fonctions
  `build*`/`reveal*` par type de question pour confirmer qu'aucune ne
  réactive l'interactivité pour `isPresenterHost()` ; retrait de
  `buildIrlAnswerRecap`/`irlAnswerRecap` et du bloc qui le peuple (plus
  d'usage une fois les tuiles réaffichées).
- `client/public/index.html` — élément `#irlAnswerRecap` (tâche 033) et son
  commentaire, à retirer (oublié du premier passage, trouvé en explorant le
  code pour le plan).
- `server/index.js` — `APP_VERSION`, à incrémenter par convention (chaque
  tâche visible côté client bump cette constante).
- `docs/agent-tasks/031-irl-hide-gameplay-mj.md` et
  `033-multi-sujets-2.md` — référence historique uniquement, pas de
  modification de leur contenu.

## Plan

**Conclusion de l'exploration** : le verrouillage visuel-mais-non-interactif
pour l'hôte présentateur (`answers-locked` posé en permanence + les flags
`orderDisabled`/`associationDisabled`/`timelineDisabled`/`rangementDisabled`/
`gradState.disabled`, tous initialisés `true` et jamais repassés à `false`
pour lui, voir le `setTimeout` de déverrouillage gardé par `if
(!isPresenterHost())`) fonctionne déjà et n'a JAMAIS été retiré, même
pendant les tâches 031/033 — il était juste invisible derrière `#inputArea`
en `display:none`. Chaque écouteur de glisser-déposer/clic (`wireOrderDrag`,
`wireTimelineDrag`, `wireRangementCardDrag`, le slider de graduation,
`.assoc-item.onclick`, `imageClickLayer`) est attaché DIRECTEMENT sur
l'élément couvert par `.answers-locked … { pointer-events: none }` — pas de
délégation distante ni de calcul de position qui contournerait ce
verrouillage. Les fonctions `build*` (tuiles, association, timeline,
rangement, indice, image...) sont déjà appelées inconditionnellement, y
compris pour l'hôte présentateur (jamais gardées par `isPresenterHost()`).
**Conséquence** : cette tâche est presque entièrement un nettoyage CSS/HTML
(retirer ce que 031/033 ont ajouté), pas une réécriture de la logique de
verrouillage — aucune étape ne touche au mécanisme `answers-locked`
lui-même, seulement à ce qui masquait `#inputArea` par-dessus.

1. **CSS — réafficher `#inputArea` et annuler les ajustements desktop
   pensés pour son absence (retour sur tâche 031)**
   - Supprimer `body.irl-presenter-mode #inputArea { display: none
     !important; }` (`style.css`, ~ligne 8509) et son commentaire
     au-dessus (~lignes 8495-8508).
   - Supprimer le bloc `body.is-host.game-active.irl-presenter-mode
     .container #main ...` (illustration agrandie à 65vh + grille portrait
     repassée à 1 colonne, ~lignes 4551-4568) et son commentaire.
   - *Trade-off* : suppression pure, pas d'adaptation — une fois
     `#inputArea` visible, le comportement "par défaut" (sans la classe
     `irl-presenter-mode`) est déjà EXACTEMENT celui voulu : c'est celui
     déjà utilisé en mode "à distance"/"Jouer", jamais concernés par ces
     overrides (illustration à 260px de base, `.regie-portrait-layout` à 2
     colonnes déjà prévu pour `#inputArea` visible, tâche 028) — vérifié en
     lisant la règle de base `.illustration-img` (`max-height: 260px`,
     ligne 2899) et la grille portrait (`grid-template-columns: 1fr 1fr`,
     ligne 4408), aucune des deux n'est spécifique à un mode.

2. **CSS — retirer les styles de `#irlAnswerRecap` (tâche 033)**
   - Supprimer `body.irl-presenter-mode #irlAnswerRecap { ... }`
     (`style.css`, ~lignes 8510-8528) et son commentaire.

3. **HTML — retirer l'élément `#irlAnswerRecap`**
   - Supprimer `<div id="irlAnswerRecap" ...>` et le commentaire tâche 033
     juste au-dessus (`index.html`, ~lignes 1342-1352).

4. **JS — retirer les références orphelines à `irlAnswerRecap`**
   - Supprimer la déclaration `const irlAnswerRecap = ...` et son
     commentaire dédié (~lignes 891-895), en gardant le commentaire voisin
     sur `revealPopupAnswerTitle` (sans rapport, tâche 032).
   - Supprimer le bloc qui le vide dans `clearRevealState` (~lignes
     3568-3573) ; reformuler la phrase de commentaire du dessus qui
     affirme (à tort après cette tâche) que "`#inputArea` reste masqué en
     permanence pour l'hôte présentateur IRL".
   - Supprimer le bloc qui le peuple dans le handler `socket.on('question:reveal', ...)`
     (~lignes 8842-8863).

5. **JS — retirer la classe `irl-presenter-mode` elle-même**
   - Dans `updateIrlPlayerUI()` (~ligne 5330), retirer
     `document.body.classList.toggle('irl-presenter-mode', ...)`.
   - Réduire le commentaire qui la documentait (~lignes 5312-5327,
     "Pour l'hôte PRÉSENTATEUR...") et repasser la note sur "les quatre
     facteurs" à trois, puisque `isPresenterHost()` ne rentre plus dans le
     calcul de cette fonction après ce retrait.
   - *Trade-off* (à valider, seule étape avec un vrai choix) : je propose
     de RETIRER la classe plutôt que de la laisser posée sans lecteur —
     après les étapes 1-2, plus aucune règle CSS ne la consomme nulle part
     (vérifié par recherche globale) ; la laisser vivante mais orpheline
     serait trompeur (donnerait l'impression qu'un style en dépend encore
     quelque part) dans un fichier déjà volumineux où ce genre de résidu
     est coûteux à ré-auditer plus tard. Alternative plus prudente : la
     laisser posée (diff plus petit, risque nul) si une réutilisation
     rapprochée est prévue — à trancher si tu préfères ce filet de
     sécurité.

6. **`server/index.js` — bump `APP_VERSION`**
   - `2.27.0` → `2.27.1` (patch : changement d'affichage seul, convention
     déjà suivie par toutes les tâches précédentes, y compris 031 qui
     avait le même genre de portée CSS/JS).

Aucune étape ne touche une zone des "Interdictions" du `CLAUDE.md` (pas de
`supabase/schema.sql`, pas de `render.yaml`, pas de nouvelle dépendance) —
uniquement du nettoyage CSS/HTML/JS côté client + le bump `APP_VERSION`
déjà pratiqué sans validation dédiée dans toutes les tâches comparables.

## Étapes réalisées
- [x] 1. CSS — `#inputArea` réaffiché, ajustements desktop (illustration
      65vh + grille portrait 1 colonne) de la tâche 031 retirés.
- [x] 2. CSS — styles `#irlAnswerRecap` retirés
- [x] 3. HTML — élément `#irlAnswerRecap` retiré
- [x] 4. JS — références orphelines à `irlAnswerRecap` retirées
- [x] 5. JS — classe `irl-presenter-mode` retirée
- [ ] 6. `server/index.js` — bump `APP_VERSION`

## Checks effectués
- [x] Étape 1 : relecture manuelle du fichier avant/après édition (pas
      d'outil de lint CSS dans ce projet) — les deux blocs retirés
      proprement, pas d'accolade orpheline, contexte voisin intact
      (vérifié aux deux emplacements).
- [x] Étape 1 : `grep irl-presenter-mode client/public/css/style.css` — ne
      renvoie plus que la règle `#irlAnswerRecap` (tâche 033, prévue pour
      l'étape 2, pas celle-ci).
- [x] Étape 2 : confirmée par sous-agent indépendant (diff limité à la
      règle `#irlAnswerRecap` + son commentaire, accolades du fichier
      équilibrées 1542/1542, aucune casse prématurée — l'élément HTML et
      les refs JS restent pour l'instant mais l'élément est masqué par
      défaut via `d-none`).
- [x] Étape 3 : confirmée par sous-agent indépendant (diff limité à
      l'élément `#irlAnswerRecap` + son commentaire, HTML valide autour,
      seules des refs JS résiduelles restent — prévues pour l'étape 4).
- [x] Étape 4 : confirmée par sous-agent indépendant (`node --check` passe,
      3 blocs retirés proprement — déclaration, `clearRevealState`, handler
      `question:reveal` —, `isPresenterHost()`/`gameMode` intacts ailleurs
      dans le fichier). Note du sous-agent : le commentaire du bloc
      `clearRevealState` a été supprimé en bloc plutôt que "reformulé"
      comme littéralement écrit dans le plan — résultat correct (plus
      aucune affirmation fausse), juste une exécution différente de
      l'énoncé du plan, sans impact.
- [x] `node --check client/public/js/index.js` — lancé par précaution
      (fichier non modifié à cette étape), passe.
- [x] Étape 4 : `node --check client/public/js/index.js` — passe.
- [x] Étape 5 : confirmée par sous-agent indépendant (`node --check` passe,
      `grep -rn irl-presenter-mode client/public/` vide sur tout le dossier,
      `isPresenterHost()`/`roomMode` restent utilisés normalement à une
      quinzaine/vingtaine d'autres endroits, commentaire "trois facteurs"
      cohérent avec les 2 toggles restants).
- [ ] Vérification visuelle Browser pane — **non effectuée à cette étape** :
      aucun outil "Browser pane" interactif disponible dans cette session
      distante (pas d'équivalent à ce qu'utilisaient les tâches
      précédentes en local), et l'état actuel est intermédiaire
      (`#irlAnswerRecap` existe encore, étapes 2-6 pas faites) — pas encore
      un état cohérent à montrer. À faire une fois toutes les étapes
      terminées ; dis-moi si tu préfères un script Playwright automatisé
      entre-temps.

## Tests manuels recommandés
En régie desktop (≥1100px) ET sur un écran plus petit, salle "Présenter"
(jamais mode "Jouer") en IRL, tester au moins un type de chaque famille :
- **Tuiles simples** (mcq/truefalse/intrus) : tuiles visibles, colorées à
  la révélation (bonne réponse en vert), AUCUN clic ne sélectionne rien
  pour le MJ.
- **Glisser-déposer** (order/timeline/rangement) : items visibles, un
  essai de glisser-déposer côté MJ ne doit RIEN déplacer.
- **Slider** (graduation) : curseur visible, un clic/glissé dessus ne doit
  rien déplacer.
- **Association** : clic sur un item ne sélectionne rien.
- **Image** (image/zoomguess) : clic sur l'image ne place aucun marqueur.
- **Question avec illustration** : vérifier que l'image garde sa taille
  normale (260px de base), PAS la taille agrandie de la tâche 031.
- **Question avec illustration portrait** : vérifier le retour à la
  grille 2 colonnes (tâche 028), pas 1 colonne.
- Confirmer qu'aucune trace de `#irlAnswerRecap` n'apparaît plus à la
  révélation.
- Mode "à distance" et mode "Jouer" (même salle) : confirmer qu'AUCUN
  changement visuel n'est visible (comportement déjà celui d'avant cette
  tâche pour ces deux modes).

## Risques restants
- **`.recherche-wrap` (lampe torche IRL)** reste volontairement EXCLUE du
  verrouillage `answers-locked` (choix documenté dans `style.css`,
  antérieur à la tâche 031 : outil de présentation sans impact sur le
  score, pas un mécanisme de réponse) — non touché par cette tâche. À
  confirmer que c'est bien voulu : si le MJ ne doit vraiment RIEN pouvoir
  actionner, même cet outil de présentation, ce sera une étape
  supplémentaire à ajouter (hors du plan actuel).
- Types sans contenu visuel propre (réponse texte libre pure, sans image
  ni tuile — ex. "free") : le comportement pré-existant qui masque
  `freeTextEl` pour l'hôte présentateur (`if (!isPresenterHost())`,
  antérieur à la tâche 031, hors périmètre ici) fait que sa carte reste
  quasi vide pour ce type précis — comportement inchangé par cette tâche,
  pas une régression qu'elle introduit.

## Statut
`en cours`
