# [047] Vue TV miroir direct : images écrasées / reveal en retard / animations figées (3e round de retours IRL)

## Contexte
Les tâches 042 (miroir direct de la vue TV/vidéoprojecteur) et 043
(synchronisation légère, suite à un 1er round de retours IRL : clignotement
infini, minuteur saccadé, mise en page cassée) ont toutes les deux été
laissées volontairement `en cours` — jamais `clôturée` — car le seul test qui
compte (deux vraies fenêtres, vraie session IRL) est hors de portée du bac à
sable de dev (voir leurs sections "Risques restants"). Des correctifs
supplémentaires ont déjà été appliqués depuis (commits "Corrections suite aux
retours de test réel (tâche 043 + divers)" et "Vue TV : classement,
animations de validation, correctifs affichage (tâche 042/043 + retours)").

Un nouveau test IRL réel (ce fil de conversation) remonte 3 symptômes encore
présents, pas couverts par ces correctifs précédents :
1. Des images sont écrasées (ratio cassé) côté TV sur un ou plusieurs types
   de question.
2. Les réponses/la révélation arrivent beaucoup trop tard côté TV par
   rapport à l'écran MJ (décalage perceptible, pas juste un détail).
3. Des animations se figent/s'arrêtent en cours de route côté TV.

## Objectif
Identifier la cause précise de chacun des 3 symptômes dans le pipeline de
mirroring déjà en place (`pushDisplayMirror`/`MutationObserver` côté
`index.js` ↔ réception/rendu côté `display.js`) et les corriger, sans
réintroduire les régressions déjà réglées par 042/043 (clignotement, minuteur
saccadé, mise en page cassée) ni dupliquer de logique de rendu par type de
question dans `display.js` (principe central déjà posé par 042, qui avait
fait échouer la tentative précédente, tâche 040).

Vérifiable concrètement, testé en conditions réelles (deux fenêtres, vraie
salle, vrai `window.open()`) :
- Les images gardent leur bon ratio côté TV sur les types de question
  concernés par le retour.
- La révélation (tuile correcte/incorrecte, popup de reveal) apparaît côté TV
  sans décalage perceptible par rapport à l'écran MJ.
- Les animations d'entrée/transition déjà en place côté TV se jouent
  jusqu'au bout sans se figer à mi-course.

## Périmètre
- Audit des mécanismes de mirroring déjà en place pour localiser ce qui ne
  couvre pas (ou plus) les 3 symptômes : `stageSignature`/`pushDisplayMirror`,
  le filtrage du `MutationObserver` (`isVolatileMutationTarget`,
  `isMainCosmeticOnlyMutation`, `isImageStyleOnlyMutation`,
  `scheduleDelayedCropSync`), les canaux légers dédiés (minuteur, orbe,
  décompte d'intro), et côté `display.js` : `refitStage`/`fitLayoutBudget`/
  `fitOptionText`/`rescaleCroppedImages`.
- Correctifs CSS (bloc `body.display-body` de `style.css`) et/ou JS
  (`display.js`, `index.js`) nécessaires pour les 3 symptômes remontés.
- Vérifier en particulier les types de question listés en 042 comme "jamais
  retouchés avec leur propre dimensionnement carte MJ compacte" si une image
  y est en cause (graduation, order, timeline, rangement, association,
  blindtest, recherche, halo, indice), et le type "image" (clic-sur-l'image,
  `setupImageFrame`/`#imageWrap`) déjà connu pour un historique de squish.

## Hors périmètre
- Tout ce qui était déjà hors périmètre de 042/043 (son sur la TV,
  classement/contrôles hôte/modération visibles côté TV au-delà de
  l'existant, mode "à distance"/"Jouer").
- Toute nouvelle fonctionnalité de présentation non demandée ici (nouvelles
  transitions, nouveaux effets visuels non liés aux 3 symptômes).
- `docs/agent-tasks/042-vue-tv-miroir-direct.md` et
  `043-vue-tv-sync-legere.md` : référence/historique uniquement, ne pas
  modifier.
- L'écart `zoomguess` déjà documenté comme connu et préexistant en 042
  ("~25px de débordement avec un `startScale` élevé") — sauf si le test réel
  de cette tâche le relie directement à l'un des 3 symptômes remontés ici.

## Fichiers concernés
- `client/public/js/index.js` — `pushDisplayMirror`, `stageSignature`,
  `MutationObserver` et ses filtres (`handleStageMutations`,
  `isVolatileMutationTarget`, `isMainCosmeticOnlyMutation`,
  `isImageStyleOnlyMutation`, `scheduleDelayedCropSync`), `pushDisplayTick`/
  `pushDisplayIntroTick`/`pushDisplayOrb`, `applyCropTransform` (géométrie de
  cadrage partagée MJ/TV), `setupImageFrame` (type "image").
- `client/public/js/display.js` — réception des messages
  `queazy-display-sync`/`-tick`/`-orb`/`-intro-tick`, `refitStage`/
  `fitLayoutBudget`/`fitOptionText`/`rescaleCroppedImages`, l'état mis en
  cache (`lastStageSig`/`lastTickData`/`lastOrbData`).
- `client/public/css/style.css` — bloc `body.display-body` (dimensionnement
  par type de question).
- `client/public/display.html` — structure des conteneurs miroir, pour
  référence seulement sauf besoin avéré.
- `docs/agent-tasks/042-vue-tv-miroir-direct.md`,
  `043-vue-tv-sync-legere.md` — référence/historique (racines déjà
  identifiées pour des symptômes similaires lors des rounds précédents).

## Plan

**Étape 1 — Corriger la régression "animations figées" (`display-fitting`)**
Dans `display.js`, `.display-fitting` est posée sur `#displayStage` (donc sur
tous ses descendants) au lieu des seuls éléments mesurés par
`fitOptionText`/`fitLayoutBudget` (`.option-btn`, `.question-text`). Scoper la
règle CSS et la pose de la classe à ces deux sélecteurs seulement, pour que les
autres transitions en cours (couleur de tuile au reveal, barre de temps) ne
soient plus coupées à chaque `refitStage()`. Diff petit, uniquement
`display.js` + `style.css`.

**Étape 2 — Reveal "zoomguess" qui n'atteint jamais la TV après l'arrêt du tick**
Dans `index.js`, `timer:end` force `illustrationZoomLayer.style.transform =
'scale(1)'` ([ligne 9373](../../client/public/js/index.js#L9373)) — mutation
sur une cible classée "volatile" (`isVolatileMutationTarget`), donc toujours
ignorée par le `MutationObserver`, et le tick dédié (seul canal qui couvrait
cette valeur) s'est arrêté avant. Deux options, trade-off à trancher :
  - (a) Pousser explicitement un dernier `pushDisplayTick` avec
    `zoomScale: 1` juste après ce forçage (petit diff, réutilise le canal
    existant, cohérent avec le principe "canal léger pour les valeurs qui
    bougent souvent" déjà en place).
  - (b) Sortir `illustrationZoomLayer` de la liste volatile et compter sur
    `scheduleDisplayMirrorPush` classique pour ce cas précis.
  → (a) retenu par défaut (moins de risque de réintroduire le clignotement
  que corrigeait la liste volatile) sauf objection à l'implémentation.
  Vérifier aussi si `question:reveal` (fin de question normale, pas
  anticipée) a besoin du même traitement — lecture du code autour pas encore
  faite à ce stade du plan, à confirmer à l'implémentation.

**Étape 3 — Vérification live des 3 symptômes avec le harnais de test déjà
construit cette session (iframe TV + miroir simulé)**
  - Rejouer un parcours complet des 27 questions de "Quizz entre potes" à
    1920×1080, avec instrumentation : timestamp au moment où le MJ déclenche
    la révélation vs. timestamp où la TV reflète le changement (ratio
    recherché : < 200ms, actuellement potentiellement illimité pour
    zoomguess).
  - Vérifier spécifiquement le ratio des images sur les types listés en
    périphérie (graduation, order, timeline, rangement, association,
    blindtest, recherche, halo, indice) et sur le type "image"
    (`setupImageFrame`/`#imageWrap`), aucune cause statique trouvée mais pas
    formellement revérifié depuis les derniers correctifs de cette session.
  - Si un écrasement ou un retard réel est trouvé à cette étape, revenir en
    étape 2bis/3bis avec un diff ciblé plutôt que d'étendre cette étape.

**Étape 4 — Clôture**
Mettre à jour "Étapes réalisées"/"Risques restants" avec ce qui a été corrigé
vs. seulement vérifié, puis `/review` avant tout commit (le dossier contient
aussi du travail d'animation sans rapport, fait via un autre terminal —
isolation nécessaire au commit, comme pour la tâche 045).

Aucune de ces étapes ne touche schéma DB / `render.yaml` / nouvelle
dépendance — pas de validation CLAUDE.md supplémentaire nécessaire à
`/implement-step`.

## Étapes réalisées
- [x] Étape 1 — `.display-fitting` scopée à `.option-btn`/`.question-text`
  (seuls éléments mesurés par `fitOptionText`/`fitLayoutBudget`) au lieu de
  tout `#displayStage *` (`style.css`, sélecteur `#displayStage.display-fitting
  .option-btn, #displayStage.display-fitting .question-text`). JS inchangé
  (la classe reste posée sur `#displayStage` par `refitStage`, seule la
  portée du sélecteur CSS change).
- [x] Étape 2 — `timer:end` ([index.js](../../client/public/js/index.js),
  forçage `illustrationZoomLayer.style.transform = 'scale(1)'`) pousse
  désormais un dernier `pushDisplayTick(0, '0', false, 1)` juste après ce
  forçage, puisque `clearInterval(timerInt)` a déjà coupé le seul canal qui
  portait `zoomScale` vers la TV à ce moment-là. Option (a) du plan retenue
  telle quelle. `question:reveal` relu : ne touche jamais
  `illustrationZoomLayer` (seulement la popup de révélation, via
  `applyCropTransform`/`revealImageDisplay`, déjà couverte par le canal
  normal) — un seul site à corriger, pas de 2e cas à traiter.

## Checks effectués
- [x] `node --check client/public/js/display.js` et
  `client/public/js/index.js` (OK)
- [ ] Démarrage serveur vérifié (si `server/index.js` touché) — non touché
- [x] Vérification visuelle Browser pane, étape 1 : iframe TV simulée, une
  transition CSS de 2s sur un élément hors `.option-btn`/`.question-text`
  démarrée puis un `refitStage()` déclenché en plein milieu —
  `transition-duration` de cet élément reste `2s` après coup (avant le
  correctif, `#displayStage .display-fitting *` l'aurait coupée à `0s` le
  temps du refit, tronquant la transition).
- [x] Vérification visuelle Browser pane, étape 2 : iframe TV simulée avec
  `illustrationZoomLayer` à `scale(4)`, un message `queazy-display-tick`
  avec `zoomScale:1` posté séparément (reproduisant l'appel ajouté après
  l'arrêt du minuteur) — la TV passe bien à `scale(1)`.

## Tests manuels recommandés
_À remplir par `/plan-feature`._

## Risques restants
_À remplir au fil de l'implémentation._

## Statut
`ouverte`
