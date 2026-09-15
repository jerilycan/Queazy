# [043] Vue TV : synchronisation légère (suite retours IRL réels)

## Contexte
La tâche 042 (miroir en direct de la vue TV/vidéoprojecteur) a été mergée
(v2.29.0) après vérification par deux agents indépendants — mais ces
vérifications ont eu lieu dans un bac à sable de dev qui ne permettait pas
un vrai `window.open()` cross-fenêtre (contournement par simulation de
`postMessage`, documenté dans `docs/agent-tasks/042-vue-tv-miroir-direct.md`).

En usage réel, en session IRL (retour utilisateur direct + capture d'écran),
plusieurs problèmes apparaissent qui n'avaient pas été détectés :
1. Le titre/contenu de la question clignote à l'infini côté TV.
2. La barre de minuteur n'est pas fluide côté TV (saccadée), contrairement à
   l'écran MJ.
3. Rien n'est bien centré/composé à l'écran — mise en page qui semble cassée
   par rapport à ce qui avait été vérifié en sandbox.
4. Le mode "zoomOut" (type `zoomguess`) n'est pas identique à ce qui
   s'affiche sur les autres écrans (déjà documenté comme écart mineur
   préexistant, jamais corrigé — voir 042, section "Écarts trouvés #5").
5. Aucun décompte / présentation du type de question avant le début de
   chaque question côté TV.
6. Nouveau besoin : un écran d'attente avec le logo QuEazy + un sous-texte
   ("Le quizz va bientôt commencer") quand le mode présentation vient d'être
   lancé, avant la première question.

**Root cause confirmée pour les points 1/2/3** (reproduite en direct sur le
serveur de prod `queazy-4epw.onrender.com` : vraie room créée via socket,
vrai `stageHtml` généré par le serveur, injecté dans `display.html` pour
observer le rendu réel) : `pushDisplayMirror()` (`client/public/js/index.js`)
remplace **tout** le HTML (`innerHTML =`) de la zone miroir à **chaque**
mutation du `#stageWrap` côté MJ — y compris les mises à jour du minuteur,
qui surviennent 10×/seconde. La TV reconstruit donc son contenu depuis zéro
jusqu'à 10-60 fois par seconde pendant toute la durée d'une question, ce qui
casse toute transition CSS (la barre de minuteur, animée via `style.transform`
sur un même élément persistant côté MJ, ne peut plus transitionner en
douceur puisqu'elle est détruite et recréée à chaque sync côté TV) et peut
causer un effet de clignotement visible sur d'autres éléments.

## Objectif
Réaffirmé explicitement par l'utilisateur, c'est le critère de réussite —
pas un mécanisme technique précis : **pendant une session IRL, tout le monde
qui regarde l'écran présenté doit voir exactement la même visualisation au
même moment, pour un confort optimal.** Concrètement : rendu stable (aucun
clignotement), minuteur fluide, mise en page centrée/soignée à l'échelle TV,
tous les types de question fidèles (dont `zoomguess`), une transition claire
avant chaque question (décompte + type), et un écran d'attente accueillant
au lancement du mode présentation.

## Périmètre
- Revoir le mécanisme de synchronisation MJ -> TV pour qu'il ne reconstruise
  plus tout le contenu à chaque tick du minuteur : un renvoi de HTML complet
  uniquement lors d'un changement de CONTENU réel (nouvelle question, tuile
  révélée, popup de révélation...), et un traitement séparé et léger du
  minuteur (valeur/pourcentage appliqué en douceur sur le MÊME élément
  persistant côté TV, jamais recréé). **Le principe central de la tâche 042
  reste : ne JAMAIS dupliquer la logique de rendu par type de question dans
  `display.js`** — c'est précisément ce qui avait fait échouer les tâches
  040/041 (rollback). Le mécanisme exact (comment distinguer "changement
  structurel" d'un "simple tick du minuteur" dans le `MutationObserver", ou
  toute autre approche) est à trancher en `/plan-feature`.
- Corriger le centrage/la mise en page générale de la vue TV en conditions
  réelles (au-delà de ce qui avait été vérifié en sandbox).
- Corriger l'écart `zoomguess` déjà documenté en tâche 042 (non identique aux
  autres écrans).
- Ajouter un décompte + présentation du type de question avant chaque
  question côté TV.
- Ajouter un écran d'attente avec logo QuEazy + sous-texte "Le quizz va
  bientôt commencer" au lancement du mode présentation (avant la 1ère
  question) — remplace l'état d'attente actuel ("En attente du MJ…").

## Hors périmètre
- Tout ce qui reste hors périmètre de la tâche 042 originale (son sur la TV,
  classement/contrôles hôte/modération sur la TV, mode "à distance"/"Jouer").
- Toute nouvelle fonctionnalité de présentation non demandée ici (ex.
  transitions supplémentaires, effets visuels non cités).
- `docs/agent-tasks/042-vue-tv-miroir-direct.md` : référence uniquement, ne
  pas modifier (tâche précédente déjà clôturée/mergée).

## Fichiers concernés
- `client/public/js/index.js` — `pushDisplayMirror`, `MutationObserver`,
  logique de synchronisation (à revoir pour ne plus tout reconstruire à
  chaque tick).
- `client/public/js/display.js` — réception, gestion du minuteur en léger/
  séparé, décompte + type de question avant chaque question, écran d'attente
  avec logo.
- `client/public/display.html` — conteneurs éventuels pour le nouvel écran
  d'attente / le décompte.
- `client/public/css/style.css` — styles zoomguess/centrage/écran d'attente/
  décompte, dans le bloc `body.display-body` existant.

## Plan
Aucune "Interdiction" du CLAUDE.md concernée (pas de schéma DB, pas de
`render.yaml`, pas de nouvelle dépendance — tout reste `postMessage`/
`MutationObserver`/CSS natifs, même esprit que la tâche 042).

**Exploration faite avant ce plan** :
- `pushDisplayMirror`/`scheduleDisplayMirrorPush`/`MutationObserver`
  (`index.js` ~L4150-4235) confirmés : l'observer sur `#stageWrap` écoute
  `attributes`+`characterData` sur TOUT le sous-arbre, donc CHAQUE tick du
  minuteur (`setInterval(...,100)`, ~L7461) déclenche une reconstruction
  complète côté TV — la boucle touche `timerBarFill.style.transform`,
  `timerLabel.textContent`, et (uniquement pour `zoomguess`)
  `illustrationZoomLayer.style.transform` à CHAQUE tick. `updateIndiceArea`
  (~L2292), en revanche, ne mute le DOM QUE quand un nouvel indice devient
  dû (pas à chaque tick) — pas concerné par ce problème.
- `#questionIntroOverlay` (décompte + type de question avant chaque
  question, mécanisme déjà existant côté MJ via `showQuestionIntro`,
  `index.js` ~L714-810) confirmé être un **élément séparé, frère de
  `#stageWrap`/`#revealPopupOverlay`** dans `index.html` (L1422) — jamais
  observé ni mirroré aujourd'hui, ce qui explique complètement l'absence de
  décompte côté TV (écart #5). Même schéma que `#revealPopupOverlay` à
  reproduire pour lui.
- Logo QuEazy : convention déjà en place dans le projet (voir commentaire
  `index.html` ~L225) — le SVG `.brand-logo-svg` est DUPLIQUÉ tel quel dans
  chaque page qui en a besoin (login/editor/profile/select/result), jamais
  partagé dynamiquement. `display.html` suit la même convention plutôt que
  d'inventer un mécanisme de partage.

**Décision structurante (cœur du fix clignotement/fluidité)** : au lieu de
reconstruire tout `#displayStage` à chaque mutation, on distingue désormais
deux canaux :
- Un canal **structurel** (`queazy-display-sync`, inchangé dans son
  principe) : renvoi du HTML complet, mais seulement quand une mutation
  RÉELLE de contenu survient (nouvelle question, tuile qui se révèle,
  popup, décompte...).
- Un canal **léger et dédié** (`queazy-display-tick`, nouveau) : juste les
  valeurs qui bougent en continu (pourcentage du minuteur, libellé,
  éventuel scale de zoom) postées directement depuis le MÊME `setInterval`
  qui pilote déjà le minuteur côté MJ (aucun nouvel intervalle créé), et
  appliquées côté TV directement sur les éléments déjà mirorrés
  (`#timerBar`/`#timerLabel`/`#illustrationZoomLayer`, retrouvés via
  `getElementById` dans le DOM déjà injecté) — jamais détruits/recréés.
*Trade-off* : deux canaux plutôt qu'un seul complique légèrement le
protocole, mais c'est la façon la plus directe de couper la source du
problème (on a DÉJÀ le callback qui calcule ces valeurs 10×/s, autant les
pousser directement plutôt que de les faire transiter par une
reconstruction complète du DOM à chaque fois) sans dupliquer la moindre
logique de rendu par type — le principe central de la tâche 042 reste
intact.

1. **Mirroring de l'intro par question.** Nouveau conteneur `#displayIntro`
   dans `display.html` (même esprit que `#displayPopup`), nouvel observer
   sur `#questionIntroOverlay` (même pattern que `#revealPopupOverlay`),
   nouveau champ `introHtml`/`introVisible` dans le message
   `queazy-display-sync`. CSS dédié dans `body.display-body` (réutilise les
   couleurs par type déjà posées en variable CSS par `showQuestionIntro`,
   `--qt-color`/`--qt-color-rgb`). *Étape isolée, testable seule (injecter
   un `stageHtml`/`introHtml` de test comme fait pendant le diagnostic).*

2. **Canal léger dédié `queazy-display-tick` (minuteur + zoom).** Dans le
   `setInterval` existant du minuteur (`index.js` ~L7461), poster en plus
   `displayWin.postMessage({ type: 'queazy-display-tick', pct, label,
   urgent, zoomScale }, location.origin)` (zoomScale seulement si
   `currentIllustrationZoom`). Côté `display.js`, un handler dédié applique
   ces valeurs directement sur les éléments déjà présents dans
   `#displayStage` (pas de re-render, pas de `innerHTML`). *Étape isolée,
   testable seule en observant que le minuteur avance en douceur même sans
   toucher à l'observer (étape 3).*

3. **Filtrer le `MutationObserver` pour ignorer les mutations volatiles.**
   Cœur du fix anti-clignotement : dans le callback de l'observer sur
   `#stageWrap`, ignorer un batch de `MutationRecord`s si TOUS ciblent
   exclusivement `#timerBar`/`#timerLabel`/`#illustrationZoomLayer` (déjà
   couverts par le canal léger de l'étape 2) — ne déclenche
   `scheduleDisplayMirrorPush` (reconstruction complète) que s'il reste au
   moins une mutation "réelle" dans le batch. *Dépend de l'étape 2 (sans
   elle, ignorer ces mutations ferait perdre l'affichage du minuteur/zoom
   côté TV) — à valider ensemble avant de considérer le fix terminé.*

4. **Écran d'attente avec logo QuEazy + sous-texte.** Dans `display.html`,
   remplace/complète l'état `#displayWaiting` actuel ("En attente du MJ…")
   par le SVG `.brand-logo-svg` dupliqué (convention du projet, voir
   exploration ci-dessus) + un sous-texte "Le quizz va bientôt commencer",
   affiché tant qu'aucune question n'a encore été montrée. *Étape isolée,
   diff HTML/CSS pur.*

5. **Vérification centrage général.** Une fois 1-3 en place, revérifier en
   conditions réelles si "rien n'est centré" persiste — hypothèse à
   confirmer/infirmer : ce symptôme peut n'être qu'une conséquence visuelle
   de la reconstruction permanente (capture en plein milieu d'un
   redémarrage de rendu), pas un bug CSS distinct. Corriger le CSS
   `body.display-body` UNIQUEMENT si un écart réel persiste après le fix de
   fluidité — pas de retouche CSS spéculative avant d'avoir revérifié.

6. **Vérification `zoomguess`.** Revérifier l'écart déjà documenté en tâche
   042 (image qui peut chevaucher la question sans `.is-zoomed`) main
   maintenant que son `transform` est appliqué en douceur via le canal léger
   (étape 2) plutôt que détruit/recréé — confirmer si le fix de fluidité
   suffit ou s'il faut encore un correctif CSS ciblé.

7. **Test manuel réel obligatoire avant clôture.** Les vérifications de la
   tâche 042 (agents en bac à sable) n'ont JAMAIS pu tester un vrai
   `window.open()` cross-fenêtre — c'est très probablement pour ça que ces
   bugs n'ont pas été détectés avant la mise en prod. Cette fois, un test
   manuel RÉEL (deux fenêtres/écrans, vraie session IRL) est un prérequis
   explicite avant de considérer la tâche prête, pas une simple
   recommandation.

## Étapes réalisées
- [x] 1. Mirroring de l'intro par question (`#displayIntro`) — conteneur
      ajouté dans `display.html`, observer `MutationObserver` dédié sur
      `#questionIntroOverlay` (`index.js`), champs `introHtml`/`introVisible`
      dans `pushDisplayMirror`, traitement symétrique à `#displayPopup` côté
      `display.js`, CSS dédié dans `body.display-body` (réutilise
      `--qt-color`/`--qt-color-rgb` héritées).
- [x] 2. Canal léger `queazy-display-tick` (minuteur + zoom) — `pushDisplayTick`
      posté depuis le `setInterval` existant du minuteur (`index.js` ~L7508,
      aucun nouvel intervalle), y compris dans la branche `now < start`
      (phase de révélation, barre pleine/"···"). Handler dédié côté
      `display.js`, `getElementById` à chaque tick (jamais de référence mise
      en cache, ni de `innerHTML`).
- [x] 3. Filtrage du `MutationObserver` sur `#stageWrap` — `isVolatileMutationTarget`/
      `handleStageMutations` : un batch qui ne touche QUE `timerBarFill`/
      `timerLabel`/`illustrationZoomLayer` (ou leurs descendants, ex. le nœud
      texte de `#timerLabel`) n'appelle plus `scheduleDisplayMirrorPush`.
- [x] 4. Écran d'attente avec logo + sous-texte — SVG `.brand-logo-svg`
      dupliqué tel quel (convention du projet) + "Le quizz va bientôt
      commencer" dans `display.html`. Signal de masquage revu en cours de
      route (voir "Risques restants" : `stageHtml`/`introVisible` se sont
      révélés insuffisants à l'usage) — nouveau champ `gameStarted`
      (`anyQuestionShown` côté `index.js`, latché, remis à zéro si l'hôte
      relance un quiz dans la même salle).
- [x] 5. Vérification centrage général — aucun écart CSS trouvé après le fix
      de fluidité (voir Tests manuels recommandés) : hypothèse confirmée,
      documentée comme résolue, aucune retouche CSS.
- [x] 6. Vérification `zoomguess` — cas `:not(.is-zoomed)` (fix tâche 042)
      reconfirmé toujours actif (`overflow:hidden` sur le wrap). Cas normal
      (`.is-zoomed` présent, `startScale` élevé) : écart résiduel PRÉEXISTANT
      documenté en tâche 042 non reproduit avec les paramètres de test
      utilisés (voir détail dans Tests manuels recommandés/Risques restants)
      — aucune retouche CSS spéculative, conformément au Plan.
- [ ] 7. Test manuel réel (deux fenêtres, vraie session IRL) — hors périmètre
      d'un agent, à faire par l'utilisateur.

## Checks effectués
- [x] `node --check client/public/js/index.js` — OK (dernière passe, après
      toutes les modifs de cette tâche).
- [x] `node --check client/public/js/display.js` — OK.
- [x] Démarrage serveur vérifié — `queazy-server` (`node server/index.js`)
      démarré via `preview_start`, aucune erreur dans les logs
      (`preview_logs`), arrêté proprement (`preview_stop`) en fin de tâche.
- [x] Vérification visuelle Browser pane — voir détail ci-dessous.

## Tests manuels recommandés
Méthode utilisée (même limitation de bac à sable que la tâche 042 — un vrai
`window.open()` cross-fenêtre navigue l'onglet courant au lieu d'ouvrir une
vraie fenêtre séparée, connu et documenté) : salle IRL réelle créée via
`socket.emit('room:create', { mode: 'present' })` (pas de login, pas de
compte créé), questions réelles envoyées via `socket.emit('question:show',
...)`/`emitQuestionShow(...)` (même chemin que le vrai flux hôte, y compris
l'intro `tuto:begin`/`tuto:show`/`tuto:done`). Miroir testé via une VRAIE
iframe same-origin chargeant `display.html?room=...` (pas une simulation de
`postMessage` : `displayWin` pointé sur `iframe.contentWindow`, un vrai
`postMessage`/`message` traverse réellement la frontière de fenêtre) —
`pushDisplayMirror()`/`pushDisplayTick()` réels appelés, jamais réimplémentés
pour le test.
- **Étape 1 (intro)** : décompte + type mirroré vérifié pour plusieurs types
  (`order`, `graduation`, `truefalse`, `mcq`, `association`) — titre/icône/
  astuce/décompte corrects côté TV, masqué dès `tuto:done` côté hôte. Carte
  vérifiée bien contenue dans le viewport à 800×600 une fois l'animation
  d'entrée terminée (`cardRect` mesuré, `fitsInViewport: true`).
- **Étape 2 (tick)** : `pushDisplayTick(pct, label, urgent, zoomScale)` appelé
  directement — confirmé que `#timerBar`/`#timerLabel`/
  `#illustrationZoomLayer` se mettent à jour (style/textContent/classe
  `timer-urgent`) SANS toucher `innerHTML` (même référence de nœud DOM avant/
  après, `#question` inchangé, `syncCount` ne bouge pas). `zoomScale: null`
  laisse le transform existant intact (pas de reset non désiré hors
  zoomguess).
- **Étape 3 (filtrage)** : `isVolatileMutationTarget`/`handleStageMutations`
  testés directement avec de faux `MutationRecord`s — un batch 100% volatil
  (`timerBarFill`/nœud texte de `timerLabel`/`illustrationZoomLayer`) ne
  déclenche PAS `scheduleDisplayMirrorPush` (`hasRealMutation === false`) ;
  un batch avec une seule mutation réelle (`#question`) le déclenche
  (`hasRealMutation === true`). Vérification faite au niveau de la logique
  plutôt que via le `MutationObserver`/`requestAnimationFrame` réel : ce
  dernier ne se déclenche jamais dans ce bac à sable (`document.visibilityState`
  toujours `'hidden'`, limite déjà connue — voir mémoire "sandbox-browser-no-raf"),
  donc inobservable en bout en bout ici (comme en tâche 042).
- **Étape 4 (écran d'attente)** : logo + sous-texte affichés correctement à
  l'ouverture (capture à l'appui), écran d'attente masqué uniquement après
  `gameStarted: true` (voir Risques restants pour la découverte qui a motivé
  ce champ), jamais masqué par un simple sync "vide" avant le lancement du
  quiz.
- **Étape 5 (centrage)** : mesuré (pas seulement à l'œil) à 1920×1080 —
  `#main` horizontalement centré (`mainHorizontallyCentered: true`), aucun
  débordement (`#displayStage.scrollHeight === clientHeight`,
  `scrollWidth === clientWidth`) sur une question `mcq` à 4 options + badge +
  minuteur. Capture d'écran à 1280×720 : mise en page équilibrée, rien de
  clairsemé ni décentré. Hypothèse du Plan confirmée : aucun correctif CSS
  nécessaire.
- **Étape 6 (zoomguess)** : testé aux deux cas à 1920×1080 ET 800×600.
  - Cas `:not(.is-zoomed)` (pas de `payload.zoom`, vieux quiz) : `overflow:hidden`
    toujours actif sur le wrap (fix tâche 042 intact) — aucune fuite visuelle
    vérifiée malgré un `getBoundingClientRect()` brut de l'image qui dépasse
    (normal, clippé par le CSS).
  - Cas `.is-zoomed` normal (`zoom: {x:0.5, y:0.5, startScale:4}`, image test
    512×512) : AUCUN chevauchement mesuré avec le badge/minuteur/question
    (`wrapOverlapsQuestion`/`wrapOverlapsTimer`/`wrapOverlapsBadge`: `false`)
    à 1920×1080 ; léger débordement vertical de `#displayStage` à 800×600
    (~22px, absorbé par le scroll de secours déjà en place, cohérent avec le
    comportement documenté en tâche 042 pour cette taille extrême). L'écart
    résiduel "~25px avec un `startScale` élevé" documenté en tâche 042 comme
    préexistant/hors périmètre n'a PAS été reproduit avec ces paramètres de
    test — hypothèse plausible : ce résidu dépend de la géométrie précise
    d'une vraie image de quiz (ratio, taille) plus que du mécanisme de tick
    en lui-même (le canal léger n'introduit aucune nouvelle cause de
    débordement : seule la valeur `scale()` change en douceur, le
    `transformOrigin`/crop statique reste posé une seule fois à
    `question:show`, inchangé par cette tâche). Aucune retouche CSS
    spéculative faite, conformément au Plan ("pas de retouche CSS spéculative
    avant d'avoir revérifié").

## Risques restants
- **Le test manuel réel (étape 7) reste le seul test qui compte pour ce qui a
  motivé cette tâche** (clignotement/minuteur saccadé en conditions RÉELLES,
  jamais reproductible dans ce bac à sable où `requestAnimationFrame` ne se
  déclenche jamais — voir mémoire "sandbox-browser-no-raf"). Toutes les
  vérifications ci-dessus portent sur la LOGIQUE (filtrage, canal léger,
  mirroring) et le RENDU statique (CSS/géométrie), jamais sur le fix de
  fluidité en mouvement réel — c'est précisément ce qui avait laissé passer
  les bugs de la tâche 042 une première fois. À confirmer par l'utilisateur
  en conditions réelles avant `clôturée`.
- **Découverte non anticipée par le Plan, corrigée en cours de route** :
  `stageHtml` seul (le champ initialement envisagé pour masquer l'écran
  d'attente) s'est révélé TOUJOURS non-vide dès le chargement de la page côté
  MJ (`#stageWrap` porte du balisage caché en `d-none`, pas seulement pendant
  une vraie question) — testé en réel, `stageWrapEl.innerHTML.length` déjà à
  20 Ko juste après `room:create`, avant toute question. `introVisible` seul
  ne suffisait pas non plus (redevient `false` dès la fin de l'intro, donc
  inexploitable pour le rattrapage d'état d'une fenêtre TV rechargée EN COURS
  de question, après la fin de l'intro). Remplacé par un nouveau signal
  explicite et latché, `gameStarted`/`anyQuestionShown` (voir `index.js`,
  déclaration + les deux sites où il passe à `true` + la remise à zéro dans
  le handler "Lancer le quiz") — ajout non prévu tel quel dans le Plan
  d'origine mais strictement nécessaire pour que l'étape 4 fonctionne
  correctement ; documenté ici pour trace.
- L'écart résiduel `zoomguess` "~25px avec un `startScale` élevé" (documenté
  préexistant/hors périmètre en tâche 042) n'a pas été reproduit avec les
  paramètres de test utilisés ici (image carrée 512×512, `startScale: 4`,
  zoom centré) — reste à surveiller avec du contenu de quiz réel (vraies
  images, vrais réglages de zoom) lors du test manuel réel, sans quoi il
  resterait un angle mort de cette vérification.
- Les vérifications de la tâche 042 n'ont jamais pu tester un vrai
  `window.open()` cross-fenêtre dans le bac à sable de dev — cette
  limitation reste la même pour cette tâche (contournée ici par une VRAIE
  iframe same-origin plutôt qu'une simulation de `postMessage`, un cran plus
  fidèle qu'en tâche 042, mais toujours pas un vrai `window.open()`
  cross-fenêtre).

## Statut
`en cours` — étapes 1 à 6 du Plan implémentées et vérifiées (logique +
géométrie statique, voir détail ci-dessus) ; étape 7 (test manuel réel,
deux fenêtres, vraie session IRL) explicitement réservée à l'utilisateur.
Statut volontairement laissé `en cours`, pas `clôturée` — décision humaine
après le test manuel réel.

## Contrainte explicite de l'utilisateur pour cette tâche
**Ne rien pousser ni merger (`git push`/`git merge`/PR) tant que
l'utilisateur ne l'a pas explicitement redemandé** — même une fois le
travail terminé et vérifié. Plus strict que l'usage habituel de ce projet
tant que cette consigne n'est pas levée.
