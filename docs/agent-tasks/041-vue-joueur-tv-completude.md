# [041] Vue Joueur TV : bug zoomguess + éléments manquants (retour de test réel)

## Contexte
Retour de l'utilisateur après un premier vrai test en conditions réelles de
la Vue Joueur TV (`display.html`/`display.js`, tâche 040, mergée dans
`main`). Deux catégories de retours, à ne pas traiter de la même façon :

1. **Un vrai bug (régression fonctionnelle)** : la question "ZoomOut
   Devinette" (`zoomguess`) affiche directement l'image complète, non
   dézoomée, dès l'apparition — alors que le principe même de ce type de
   question est de deviner à partir d'une image qui démarre très zoomée
   (`scale(4)`, voir `payload.zoom`/`q.zoom` dans `index.js` côté MJ) puis
   se dézoome progressivement pendant le minuteur. Le repli générique de la
   tâche 040 (`illustrationUrlOf` dans `display.js`) affiche
   `payload.imageUrl` tel quel, sans transform ni animation — sur
   `zoomguess` précisément, ça montre la réponse immédiatement et casse le
   jeu pour tous les joueurs qui regardent la TV. C'est le seul des 14
   types "en repli" concerné : vérifié que `reveal` n'a pas le même
   problème (l'image réponse n'arrive que via `timer:end`, jamais dans
   `question:show`, et `display.js` ignore déjà `timer:end` — donc `reveal`
   n'expose rien de prématuré aujourd'hui, juste rien du tout pendant la
   question, ce qui est le comportement de repli normal).

2. **Des éléments délibérément exclus du périmètre de la tâche 040, que
   l'utilisateur redemande après avoir vu le rendu en vrai** : tuile
   d'annonce/décompte avant la question, classement entre les questions,
   animations d'apparition, podium de fin de partie, logo animé sur l'écran
   d'attente. La tâche 040 avait explicitement exclu classement/animations/
   podium (cahier des charges initial : "aucune barre de temps, aucun
   classement, aucune indication bonne/mauvaise réponse") — ce retour
   révise ce choix après usage réel, pas une erreur d'implémentation.

Pistes de réutilisation trouvées en explorant le code avant d'écrire cette
tâche (à creuser en `/plan-feature`, pas tranchées ici) :
- `.irl-center-logo` (`style.css`/`index.html`) : composant logo QuEazy déjà
  existant et déjà animé (`.animate-logo`, orbite des 4 formes du logo),
  utilisé ailleurs pour l'écran d'attente joueur IRL — probablement
  réutilisable tel quel pour l'écran d'attente de `display.html`.
- `results.js`/`result.html` : le podium final ("course arcade néon",
  animation question par question, tri équipe/solo) existe déjà en entier
  sur la page spectateur. Le serveur émet `quiz:end` en fin de partie (voir
  `index.js` côté MJ, redirige vers `/result.html?room=CODE`) —
  `display.js` pourrait soit rediriger vers `result.html` à ce moment (zéro
  duplication), soit avoir son propre rendu minimal. Décision à prendre en
  plan, pas ici.
- `showQuestionIntro`/`questionIntroCountdown`/`INTRO_READ_MS`/
  `INTRO_COUNTDOWN_MS` (`index.js` côté MJ) : mécanisme d'intro déjà en
  place côté régie (annonce catégorie/type puis décompte des 3 dernières
  secondes) — à voir s'il peut être piloté par les mêmes timings côté TV ou
  s'il faut un signal serveur dédié.

## Objectif
- Le rendu `zoomguess` sur `display.html` ne doit plus jamais montrer
  l'image non dézoomée dès l'apparition de la question.
- La Vue Joueur TV donne au public une expérience plus proche d'un vrai
  écran de présentation façon Kahoot : annonce de question, classement
  entre les questions, podium final, transitions visuelles, écran d'attente
  avec le logo QuEazy animé.
- Aucune régression sur ce qui fonctionne déjà (rendu QCM/Vrai-Faux/Intrus,
  rattrapage de connexion, plein écran — tâche 040).

## Périmètre
1. **Bug `zoomguess`** — priorité, à traiter en premier et indépendamment
   du reste : ne plus exposer l'image non dézoomée. Reste à trancher en
   plan : suppression simple de l'image pour ce type en repli (fix minimal,
   sûr) vs. reproduction de l'animation de dézoom (fix complet, aligné avec
   le rendu MJ).
2. Tuile d'annonce de question (type + catégorie) avec décompte, avant
   l'affichage des propositions.
3. Classement (leaderboard) affiché entre les questions — `display.js`
   n'écoute aujourd'hui même pas l'évènement `leaderboard:show`.
4. Animations d'apparition pour la question/les tuiles (au minimum un
   fade/slide à l'affichage, à définir en plan).
5. Podium de fin de partie.
6. Écran d'attente (avant le début de la partie) : logo QuEazy affiché, un
   peu animé.
7. Correctif CSS : espacement insuffisant entre le titre de la question et
   les tuiles de réponses (`body.display-body .question-text`/
   `.options-grid` dans `style.css`).

## Hors périmètre
- Tout ce qui reste explicitement hors périmètre de la tâche 040 et non
  redemandé ici (son, mode à distance/Jouer, rendu mécanique dédié pour les
  types autres que `zoomguess`/QCM/Vrai-Faux/Intrus).
- Toute modification de l'interface MJ (`index.html`/`index.js`) au-delà de
  ce qui serait strictement nécessaire pour émettre un signal déjà absent
  (à confirmer en plan si un tel signal manque réellement côté serveur).
- Refonte visuelle du podium/classement existants de `results.js` — s'il
  sont réutilisés tels quels, aucune modification ne leur est apportée ici.

## Fichiers concernés
- `client/public/js/display.js` — rendu `zoomguess`, tuile d'annonce/
  décompte, écoute `leaderboard:show`/`quiz:end`, animations d'apparition,
  logo écran d'attente.
- `client/public/css/style.css` — bloc `body.display-body` : espacement
  titre/tuiles, animations, styles de la tuile d'annonce, écran d'attente.
- `client/public/display.html` — ajout d'éléments DOM si nécessaire (tuile
  d'annonce, conteneur classement, logo écran d'attente).
- `server/index.js` — uniquement si un signal serveur manque réellement
  pour la tuile d'annonce/décompte (à confirmer en plan, aucune certitude à
  ce stade).
- `client/public/js/results.js` / `client/public/result.html` — consultés
  comme référence pour le podium, modifiés seulement si la décision de plan
  est de réutiliser leur rendu directement plutôt que de rediriger dessus.

## Plan
Aucune "Interdiction" du CLAUDE.md n'est concernée (pas de schéma DB, pas de
`render.yaml`, pas de nouvelle dépendance npm). Une seule étape (4) touche
`server/index.js` — modification petite et localisée (catch-up de
reconnexion), mais dans le monolithe qui demande une lecture attentive du
diff.

Exploration faite avant d'écrire ce plan (au-delà de ce qui était déjà
noté en Contexte) :
- **zoomguess** : le dézoom est piloté par le client seul, à partir de
  champs déjà présents dans `question:show` (`payload.startTs`,
  `payload.timerMs`, `payload.zoom` {x,y,startScale}, `payload.imagePos`,
  `payload.imageBg`) — `server/index.js` les inclut déjà dans
  `broadcastPayload` (rien n'est retiré pour ce type). Aucun tick serveur :
  l'hôte calcule `scale = startScale + (1-startScale) * progress` en
  boucle `requestAnimationFrame`/`setInterval`, `progress` dérivé de
  `Date.now()` contre `startTs`/`(timerMs - ZOOMGUESS_ANSWER_WINDOW_MS)`
  (constante `10000` ms, dupliquée en JS, aucun signal serveur). Donc
  reproductible à l'identique côté `display.js` sans toucher au serveur, y
  compris pour un rattrapage de connexion (déjà couvert par
  `sendJoinCatchup`, qui repasse `startTs`/`timerMs`/`zoom` tels quels).
- **Tuile d'annonce/décompte** : mécanisme déjà 100% générique côté
  serveur — `tuto:begin` (émis par l'hôte) → `io.to(code).emit('tuto:show',
  {type, durationMs, startTs})` → … → `io.to(code).emit('tuto:done')`,
  diffusé à TOUTE la room, viewers compris (aucun changement serveur requis
  pour le cas normal). Manque réel trouvé : le rattrapage de reconnexion
  pour une intro en cours (`room.pendingTuto`, `server/index.js` ~ligne
  1337) n'existe que dans la branche joueur réel de `room:join`, pas dans
  la branche `viewer:true` — un spectateur qui (re)charge `display.html`
  pile pendant une intro ne la verrait jamais avant la question suivante.
  Le DOM/CSS de la tuile (`#questionIntroOverlay`/`-Card`/`-Icon`/`-Title`/
  `-Hint`/`-Countdown`, classes `.question-intro-*`) n'est PAS scopé à
  l'écran MJ dans `style.css` — réutilisable tel quel sans nouveau CSS,
  juste en dupliquant le même DOM dans `display.html` (même convention
  déjà en place pour le logo, voir plus bas).
- **Métadonnées par type de question** (icône/libellé/couleur/astuce,
  `QUESTION_TYPE_META` dans `index.js`) : déjà dupliquées telles quelles
  dans `editor.js` ET `admin-bank.js` (chacune avec un commentaire renvoyant
  vers `index.js` comme source de référence) — c'est la convention établie
  du projet (pas de module partagé, pas de bundler). `display.js` suit la
  même convention plutôt que d'introduire un fichier partagé.
- **Animations d'apparition** : `@keyframes tileRevealIn` (`style.css`) est
  déjà global, non scopé à l'écran MJ — réutilisable tel quel via
  `el.style.animation = 'tileRevealIn 0.5s cubic-bezier(.34,1.56,.64,1) ...ms both'`
  (voir `applyTileReveal` dans `index.js`, ~4 lignes, à dupliquer pareil que
  `QUESTION_TYPE_META` ci-dessus).
- **Logo écran d'attente** : `.irl-center-logo` (SVG inline complet, ~180
  lignes) est déjà dupliqué tel quel sur 5 pages (login/editor/profile/
  select/result) — même geste pour `display.html`, copié depuis
  `result.html`. L'animation (`.animate-logo`, orbite des 4 formes) n'est
  aujourd'hui déclenchée qu'au survol souris (`mouseenter`) — aucune TV n'a
  de curseur, donc `display.js` doit la déclencher lui-même (au chargement
  puis en boucle, voir étape 5).
- **Classement entre les questions** : `leaderboard:show` ne porte aucune
  donnée, seulement un top-de-fenêtre — les scores viennent de
  `score:update` (deltas cumulés, diffusés à toute la room) sur une base
  `scores` Map initialisée depuis `lobby:list` (chaque joueur y porte déjà
  son `score` total). C'est le mécanisme réel d'`index.js` — `results.js`
  ignore volontairement `score:update` (un classement final seul n'a pas
  besoin de fraîcheur en direct), mais `display.js` en a besoin ici :
  reprend donc le mécanisme d'`index.js`, pas celui, plus simple, de
  `results.js`.
- **Podium de fin de partie** : le serveur diffuse déjà `quiz:end` à toute
  la room ; l'hôte comme les joueurs redirigent alors vers
  `/result.html?room=CODE`, qui a déjà tout le rendu podium ("course
  arcade néon"). Piste retenue plus bas : rediriger `display.html`
  pareillement plutôt que dupliquer ce rendu.

1. **Bug `zoomguess` (priorité).** Dans `display.js` : au `question:show`
   d'un type `zoomguess`, poser le zoom initial (`transformOrigin`+
   `scale(startScale)`) immédiatement comme le fait l'hôte, puis un tick
   (`setInterval`, ~200ms comme `showQuestionIntro`) qui recalcule le scale
   depuis `startTs`/`timerMs`/`ZOOMGUESS_ANSWER_WINDOW_MS` (constante
   dupliquée, commentée comme miroir d'`index.js`) jusqu'à `scale(1)`.
   Nettoyage de l'intervalle à la question suivante (`clearInterval` dans
   `renderQuestion`, même garde que `currentIntrusRequestToken`). *Trade-off* :
   reproduire l'animation plutôt que masquer l'image pour ce type — les
   données nécessaires sont déjà dans le payload existant, pas de
   changement serveur, et masquer l'image aurait laissé `zoomguess` comme
   seul type "vide" parmi les reprises visuelles alors que rien ne
   l'empêche techniquement.
   Étape autonome, testable seule (Playwright : émettre une question
   `zoomguess` avec `zoom`, vérifier le scale au fil du temps).

2. **Correctif CSS — espacement titre/tuiles.** `body.display-body
   .display-content` n'a aujourd'hui aucun `gap` entre ses enfants
   (illustration/prompt/tuiles) — seuls `.question-text`/`.options-grid` ont
   leurs marges explicitement mises à 0 (probablement pour laisser le `gap:
   3vh` du parent `.display-root` faire le travail, qui ne s'applique qu'à
   SES enfants directs, pas à ceux de `.display-content`). Ajouter un `gap`
   sur `.display-content` (valeur à ajuster visuellement, ~3-4vh pour
   rester cohérent avec le reste). Étape isolée, un seul fichier, trivial à
   valider visuellement.

3. **Animations d'apparition.** Petite fonction `applyTileReveal`-like
   dupliquée dans `display.js` (voir Exploration ci-dessus), appliquée à
   l'illustration/au prompt/à chaque tuile dans `renderQuestion` (délai
   échelonné pour les tuiles, comme côté MJ). Dépend de l'étape 1 pour le
   nettoyage cohérent des animations/intervalles à chaque nouvelle question
   (mais reste un diff distinct, localisé à `renderQuestion`/`renderMcq`/
   `renderTruefalse`/`renderIntrus`).

4. **Tuile d'annonce de question + décompte.**
   - `display.html` : copier le bloc DOM `#questionIntroOverlay` (voir
     Exploration) tel quel.
   - `display.js` : dupliquer le sous-ensemble nécessaire de
     `QUESTION_TYPE_META` (icône/libellé/couleur/astuce, 17 entrées) +
     `INTRO_READ_MS`/`INTRO_COUNTDOWN_MS`/`INTRO_DURATION_MS`, écouter
     `tuto:show`/`tuto:done` (même logique de décompte que
     `showQuestionIntro` côté MJ, dérivée de `startTs`/`durationMs` — pas de
     `seenQuestionTypesThisGame` ici, la TV n'a pas de notion de "déjà vu",
     chaque question garde sa pleine intro).
   - `server/index.js` : ajouter le même rattrapage `room.pendingTuto` que
     la branche joueur réel (voir Exploration) à la branche `viewer:true`
     de `room:join`, juste avant `sendJoinCatchup`. *Trade-off* : c'est la
     seule étape qui touche le serveur dans cette tâche — nécessaire, sinon
     un rechargement de `display.html` pile pendant une intro resterait
     bloqué sur l'écran d'attente jusqu'à la question suivante (même classe
     de bug que celui corrigé en tâche 040 pour `question:show`).
   Étape la plus grosse du lot — diff à part entière, mais reste localisée
   à ces 3 fichiers.

5. **Logo animé sur l'écran d'attente.** Copier le bloc `.irl-center-logo`
   depuis `result.html` dans `#displayWaiting` (`display.html`). Dans
   `display.js`, déclencher `.animate-logo` au chargement puis en boucle
   (`setInterval`, ex. toutes les 8-10s, retirer/re-ajouter la classe pour
   rejouer l'animation comme le fait déjà le hover ailleurs) tant que
   `#displayWaiting` est visible ; arrêter l'intervalle dès le premier
   `question:show` (`clearInterval`, écran d'attente masqué de toute façon).
   *Trade-off* : déclenchement automatique en boucle plutôt qu'au survol
   (repris ailleurs) — une TV n'a pas de curseur, sans boucle le logo ne
   s'animerait jamais.

6. **Classement entre les questions.** Dans `display.js` : `scores` Map
   (id → {name, total}) initialisée sur `lobby:list`, mise à jour sur
   chaque `score:update` (même mécanisme qu'`index.js`, voir Exploration).
   Nouveau bloc DOM (`display.html`) + rendu trié par score dans
   `display.js`, affiché sur `leaderboard:show` (masque `#displayContent`,
   comme `leaderOverlay` masque l'écran de jeu côté MJ) et masqué au
   `question:show` suivant. Rattrapage de reconnexion : si `room.
   leaderboardShown` est vrai, `sendJoinCatchup` (tâche 040) émet déjà
   `leaderboard:show` au (re)join — rien à ajouter côté serveur, juste
   s'assurer que les scores sont déjà connus à ce moment (`lobby:list` est
   émis avant `sendJoinCatchup` dans la branche `viewer:true`, donc oui).
   Dépend des étapes précédentes uniquement pour la cohérence visuelle
   (pas de dépendance technique).

7. **Podium de fin de partie.** `display.js` : écouter `quiz:end` et
   rediriger (`window.location.href`) vers `/result.html?room=CODE`,
   exactement comme le fait déjà `index.js` côté MJ/joueurs. *Trade-off* :
   réutilisation complète (podium "course arcade néon" déjà là, aucune
   duplication) contre un inconvénient réel — l'API Fullscreen ne survit
   jamais une navigation de page (même onglet) : la TV ressortira du plein
   écran au moment du podium, `result.html` n'ayant lui-même aucun bouton
   plein écran aujourd'hui. Pas de meilleure option simple dans le
   périmètre de cette tâche (dupliquer le podium serait un gros chantier à
   part) — à signaler clairement à l'utilisateur avant validation, pas une
   surprise à découvrir en testant. Étape la plus simple du lot (quelques
   lignes), mais dernière du plan car sa dépendance (`quiz:end`) n'a de
   sens qu'une fois le reste du rendu en place pour la démo.

## Étapes réalisées
- [x] Étape 1 — Bug `zoomguess`. `display.html` : illustration restructurée
      en `#displayIllustrationWrap > #displayIllustrationZoomLayer >
      #displayIllustration` (couche intermédiaire inerte pour tout autre
      type, même principe que côté MJ mais classes propres à cette page —
      jamais les classes globales `.illustration-img-wrap.is-zoomed`, pour
      ne jamais entrer en collision de spécificité avec le gabarit de régie
      MJ). `style.css` : nouveau bloc scopé `.display-root
      .illustration-img-wrap.display-zoom-box` (boîte de taille fixe,
      ratio 640/420, `overflow:hidden`) + `.illustration-zoom-layer`
      (porte le `scale()`)+ `.illustration-img` (simple `object-fit:cover`,
      pas de recadrage statique reproduit — simplification volontaire, même
      choix que les tuiles Intrus de la tâche 040). `display.js` :
      `renderIllustration` pose le zoom initial (`transformOrigin`+
      `scale(startScale)`) immédiatement pour `zoomguess`, puis un tick
      (`setInterval` 100ms) recalcule le scale depuis
      `payload.startTs`/`payload.timerMs`/`ZOOMGUESS_ANSWER_WINDOW_MS`
      (constante dupliquée, miroir d'`index.js`) jusqu'à `scale(1)`,
      s'arrête automatiquement une fois le dézoom terminé ; nettoyé à
      chaque nouvelle question (`clearZoomTick`, même garde que
      `currentIntrusRequestToken`).
- [x] Étape 2 — Espacement titre/tuiles. Cause réelle trouvée en creusant
      (pas exactement celle supposée au plan) : `.display-content` n'avait
      aucun `gap` entre ses enfants directs — ajouté (`gap: 3vh`),
      `margin-bottom: 3vh` retiré de `.illustration-img` (redondant avec le
      nouveau `gap`, aurait doublé l'espacement après l'illustration
      spécifiquement). **Régression trouvée et corrigée au passage** (pas
      dans le plan initial, découverte en implémentant) : depuis l'étape 1,
      l'illustration est enveloppée dans `#displayIllustrationWrap`
      (jamais masqué lui-même, seul l'`<img>` à l'intérieur l'était) — un
      wrapper vide mais visible compte comme enfant flex et consomme un
      `gap`, ce qui aurait ajouté un vide en haut de l'écran sur TOUTE
      question sans illustration (la majorité des cas). Corrigé en
      `display.js` : le `d-none` bascule maintenant sur le wrapper entier
      (`renderIllustration` et le handler `onerror`), pas seulement sur
      l'image.
- [x] Étape 3 — Animations d'apparition. Réutilise tel quel le
      `@keyframes tileRevealIn` (déjà global dans `style.css`, non scopé à
      l'écran MJ) via une fonction `applyTileReveal` dupliquée dans
      `display.js` (miroir exact d'`index.js`, même constantes
      `REVEAL_QUESTION_BEAT_MS`/`REVEAL_STAGGER_MS`) : le prompt apparaît
      immédiatement (delay 0, même traitement que `qDiv` côté MJ, sans
      passer par `applyTileReveal`), l'illustration (si présente) et la
      première tuile après un temps de lecture de 900ms, puis chaque tuile
      suivante avec 350ms de délai supplémentaire — même rythme que l'écran
      de jeu MJ. Illustration animée seulement quand elle va réellement
      s'afficher (jamais sur un wrapper resté caché). Éléments persistants
      (prompt, wrapper illustration) réinitialisés via le "reset trick"
      (`animation:none` + reflow forcé) pour rejouer l'animation à chaque
      question ; tuiles (fraîchement créées à chaque question, voir
      `clearOptions`) n'en ont pas besoin.
- [x] Étape 4 — Tuile d'annonce de question + décompte. `display.html` :
      bloc `#questionIntroOverlay` copié verbatim depuis `index.html`
      (classes `.question-intro-*` déjà globales dans `style.css`, aucun
      nouveau CSS nécessaire). `display.js` : `QUESTION_TYPE_META` (icône/
      libellé/couleur/astuce, 17 entrées) dupliqué à l'identique depuis
      `index.js` — même convention que `editor.js`/`admin-bank.js` déjà
      dans ce projet ; seules `INTRO_COUNTDOWN_MS`/`INTRO_EXIT_MS`
      reprises (pas `INTRO_READ_MS`/`COMPLEX_TYPES`/
      `seenQuestionTypesThisGame`, qui ne servent qu'à CALCULER `durationMs`
      côté hôte — la TV ne fait que le RECEVOIR déjà calculé via
      `tuto:show`). `showQuestionIntro`/`hideQuestionIntro` répliquent la
      logique MJ (décompte dérivé de `startTs`/`durationMs`, chiffre visible
      seulement dans les 3 dernières secondes) sans `syncedNow()` (même
      simplification que le dézoom `zoomguess`, étape 1). `tuto:show` fait
      aussi sortir l'écran de l'état d'attente (`displayWaiting`), la tuile
      d'annonce arrivant maintenant AVANT `question:show`.
      `server/index.js` : rattrapage `room.pendingTuto` ajouté à la branche
      `viewer:true` de `room:join` (même bloc que la branche joueur réel,
      absent jusqu'ici pour un spectateur) — sans ça, une TV qui recharge
      `display.html` pile pendant une intro restait sur l'écran d'attente
      jusqu'à la question suivante.
- [x] Étape 5 — Logo animé sur l'écran d'attente. **Écart par rapport au
      plan initial**, trouvé en creusant avant de coder : le plan prévoyait
      de réutiliser `.irl-center-logo` (le logo centré déjà présent sur
      `index.html`) copié depuis `result.html` — mais `result.html` n'a en
      réalité QUE le logo navbar simple (`.brand-logo-wrap`/
      `.brand-logo-svg`, 46px, aucune animation continue), pas la variante
      `.irl-center-logo` (qui n'existe que sur `index.html`, où elle
      coexiste avec le logo navbar — d'où son `<style>` interne aux id
      suffixés "Irl", nécessaire pour ne pas entrer en collision avec le
      premier logo de la page). `display.html` n'a qu'UN SEUL logo au
      total, donc pas ce risque : le SVG simple de `result.html`, copié
      verbatim tel quel (mêmes id non suffixés), suffit. Pour l'animation
      continue, réutilisation à l'identique de `@keyframes irl-logo-breathe`
      (déjà globale dans `style.css`, définie pour `.irl-center-logo`) via
      une nouvelle règle `.display-waiting-logo { animation:
      irl-logo-breathe 3.2s ease-in-out infinite; }` — **aucun JS
      nécessaire pour cette étape** : contrairement au plan initial
      (`.animate-logo` + minuterie JS pour reproduire l'effet), cette
      respiration tourne nativement en CSS pur dès que l'élément est
      visible, sans dépendre d'un survol (aucune TV n'a de curseur).
      `body.display-waiting` devient flex-colonne (logo au-dessus du texte,
      `gap: 3vh`) ; logo dimensionné à `clamp(72px, 12vh, 140px)` (contre
      46px en navbar) pour rester lisible sur un grand écran.
- [x] Étape 6 — Classement entre les questions. `display.html` : nouveau
      bloc `#displayLeaderboard` (titre + liste), masqué par défaut.
      `style.css` : rendu simplifié inspiré de `.leader-row` côté MJ (badge
      de rang rond doré/argenté/bronze pour le podium via
      `--tile-gold`/`--tile-silver`/`--tile-bronze`, déjà existants) — pas
      d'indication "c'est moi" (aucun sens sur un écran partagé), pas
      d'animation de gain de points, simplifications volontaires cohérentes
      avec le reste de cette page. `display.js` : Map `scores` (id → {name,
      total}) alimentée par `lobby:list` (hôte toujours exclu, contrairement
      à `index.js` qui l'inclut en mode "Jouer" — cette page n'a de sens
      qu'en mode "Présenter") et `score:update` (`total` déjà absolu côté
      serveur, jamais un delta à cumuler soi-même — même mécanisme
      qu'`index.js`, pas celui, plus simple, de `results.js`). Affiché sur
      `leaderboard:show` (masque `#displayContent`), masqué dans
      `showQuestionIntro` (tuile d'annonce suivante) et défensivement dans
      `renderQuestion`. Aucun changement serveur : `leaderboard:show` est
      déjà générique, et le rattrapage de reconnexion (`room.leaderboardShown`)
      existait déjà depuis la tâche 040.
      **Bug trouvé en vérifiant visuellement** (capture prise 500ms après
      `leaderboard:show` : rien n'était encore apparu) : réutiliser
      `applyTileReveal` (étape 3) pour les lignes du classement leur
      appliquait le même temps de lecture fixe de 900ms
      (`REVEAL_QUESTION_BEAT_MS`, pensé pour laisser lire une question avant
      ses tuiles) avant que la première ligne n'apparaisse — pour un
      classement que l'hôte vient de déclencher explicitement, ce délai se
      voyait comme un temps mort. Corrigé avec une cascade dédiée, plus
      rapide et qui démarre immédiatement (`idx * 90ms`, pas de temps de
      lecture initial).
- [x] Étape 7 — Podium de fin de partie. `display.js` : écoute `quiz:end`
      (déjà diffusé à toute la room par le serveur, aucun changement
      serveur) et redirige vers `/result.html?room=CODE` — réutilisation
      complète du podium "course arcade néon" déjà construit dans
      `results.js`/`result.html`, aucun rendu dupliqué. *Trade-off assumé*
      (voir le plan) : l'API Fullscreen ne survit jamais une navigation de
      page, la TV ressort donc du plein écran à ce moment précis —
      `result.html` n'a lui-même aucun bouton plein écran aujourd'hui ; pas
      de meilleure option simple dans le périmètre de cette tâche
      (dupliquer le podium serait un chantier à part).

## Checks effectués
- [x] Étape 1 — `node --check client/public/js/display.js` : OK.
- [x] Étape 1 — Démarrage serveur vérifié (`PORT=8970 node index.js`) :
      boot propre, arrêté proprement en fin de test (aucun processus
      `node index.js` restant).
- [x] Étape 1 — Vérification visuelle Playwright (salle réelle créée via
      socket brut, `display.html` chargée en vraie page Chromium) :
      question `zoomguess` avec une image-grille de test (pour repérer
      visuellement le niveau de zoom) — capture à t≈0 montre bien 1-2
      cases de la grille (zoomé, image non reconnaissable, comme voulu) ;
      capture à t≈2,5s montre un état intermédiaire (`transform: matrix`
      confirmant un scale ≈2.88, entre `startScale=4` et `1`) ; capture à
      t≈5,5s (après la fin du `zoomDuration` calculé) montre la grille
      complète (`scale(1)`, dézoom terminé) — dézoom progressif confirmé,
      plus d'image complète visible dès l'apparition. Aucune `pageerror`
      sur toute la séquence.
- [x] Étape 1 — Non-régression : question `mcq` avec `illustrationUrl`
      classique (hors `zoomguess`) — `#displayIllustrationWrap` ne porte
      PAS la classe `display-zoom-box`, l'image garde exactement son
      gabarit d'avant (`max-height:32vh` mesuré à 345.6px pour un viewport
      1080px de haut, soit 1080×0.32 — inchangé), rendu visuellement
      identique à avant cette étape.
- [x] Étape 2 — `node --check client/public/js/display.js` : OK.
- [x] Étape 2 — Démarrage serveur vérifié, arrêté proprement en fin de
      test.
- [x] Étape 2 — Vérification Playwright (salle réelle) : question SANS
      illustration — wrapper bien `display:none` (aucun vide résiduel),
      espacement prompt→tuiles mesuré à 32.4px (= 3vh sur 1080px) ; question
      AVEC illustration — espacement illustration→prompt ET prompt→tuiles
      tous deux à 32.4px (rythme régulier, plus de doublement). Captures
      comparées visuellement, espacement clairement lisible sans être
      collé.
- [x] Étape 3 — `node --check client/public/js/display.js` : OK.
- [x] Étape 3 — Démarrage serveur vérifié, arrêté proprement en fin de
      test.
- [x] Étape 3 — Vérification Playwright (salle réelle, opacité mesurée via
      `getComputedStyle`) : à t≈50ms le prompt est déjà en cours
      d'apparition (opacity 0.28) tandis que les 4 tuiles sont encore
      totalement invisibles (opacity 0) ; à t≈1000ms la 1re tuile est
      pleinement visible (opacity 1, délai 900ms atteint) tandis que la
      dernière reste invisible (délai 1950ms, pas encore atteint) ; à
      t≈2500ms les 4 tuiles sont pleinement visibles. Cascade confirmée
      visuellement sur les captures aux 3 instants. Aucune `pageerror`.
- [x] Étape 4 — `node --check client/public/js/display.js` et
      `node --check server/index.js` : OK.
- [x] Étape 4 — Démarrage serveur vérifié, arrêté proprement en fin de
      test (3 passes de test successives, toutes nettoyées).
- [x] Étape 4 — Vérification Playwright (salle réelle) : `tuto:begin` type
      `mcq` durationMs=4000 — tuile visible avec bonne icône/titre/astuce
      dès l'arrivée, écran d'attente masqué ; aucun chiffre de décompte
      avant les 3 dernières secondes (`""` à t≈300ms, `"2"` à t≈2000ms) ;
      overlay bien masqué après `tuto:done` (t≈4300ms). Rattrapage de
      reconnexion : un NOUVEAU viewer qui rejoint PENDANT une intro
      `zoomguess` active voit immédiatement la tuile avec le bon type
      (confirme le correctif serveur `room.pendingTuto`). Séquence complète
      réelle testée (`tuto:begin` → `tuto:done` naturel du serveur →
      `question:show`) : tuile bien masquée, écran de jeu normal affiché
      juste après (prompt + 2 tuiles), aucun état bloqué entre les deux.
      Aucune `pageerror` sur l'ensemble des 3 passes.
- [x] Étape 5 — `node --check client/public/js/display.js` : OK (fichier
      non modifié à cette étape, revérifié quand même).
- [x] Étape 5 — Démarrage serveur vérifié, arrêté proprement en fin de
      test.
- [x] Étape 5 — Vérification Playwright (salle réelle) : logo bien visible
      et centré au-dessus du texte d'attente (capture) ; animation
      confirmée EN COURS D'EXÉCUTION (transform mesuré différent à deux
      instants séparés de 1,6s, la moitié du cycle de 3,2s — pas figé) ;
      écran d'attente (logo + texte) bien masqué dès `question:show`, même
      comportement qu'avant cette étape. Aucune `pageerror`.
- [x] Étape 6 — `node --check client/public/js/display.js` : OK.
- [x] Étape 6 — Démarrage serveur vérifié, arrêté proprement en fin de
      test.
- [x] Étape 6 — Vérification Playwright avec un scénario RÉEL (pas
      simulé) : 2 VRAIS joueurs (Alice/Bob) rejoignent la salle et
      répondent à une VRAIE question `mcq` (Alice juste, Bob faux) —
      `score:update` réellement calculé et émis par le serveur. Classement
      affiché : Alice #1 (badge doré, 990 pts), Bob #2 (badge argenté,
      0 pts) — ordre et scores corrects, `#displayContent` bien masqué.
      Rattrapage de reconnexion confirmé : un NOUVEAU viewer qui rejoint
      PENDANT que le classement est affiché le voit immédiatement avec les
      bons scores (2 lignes, 990 pts en premier). Classement bien masqué
      dès le `tuto:show` de la question suivante. Aucune `pageerror`.
      Bug de timing trouvé et corrigé pendant cette vérification (voir
      Étapes réalisées, étape 6) — reconfirmé visuellement après le
      correctif (capture).
- [x] Étape 7 — `node --check client/public/js/display.js` : OK.
- [x] Étape 7 — Démarrage serveur vérifié, arrêté proprement en fin de
      test.
- [x] Étape 7 — Vérification Playwright (salle réelle) : `quiz:end` émis
      par l'hôte → `display.html` redirige bien vers
      `/result.html?room=CODE` (URL confirmée après navigation) ;
      `result.html` charge et affiche sa coquille normalement (titre
      "Résultats finaux", onglets Podium/Détail, bouton retour) — le
      podium lui-même reste vide dans ce test (aucune vraie partie jouée,
      hors périmètre de cette vérification, `result.html` est une page
      déjà existante et déjà testée par ailleurs). Une erreur JS
      "supabase is not defined" est apparue, mais c'est un artefact du
      bouchon réseau du test (Supabase inaccessible en sandbox, comme
      partout ailleurs dans ce projet en environnement de test) —
      préexistante à `result.html`, sans lien avec le changement de cette
      étape.
- [x] **Vérification finale (`/review`)** : test Playwright combiné rejouant
      les 7 étapes à la suite dans UN SEUL parcours réaliste continu (pas
      segmenté étape par étape comme les vérifications ci-dessus) : écran
      d'attente (logo) → intro `zoomguess` → `question:show` (boîte de zoom
      bien activée) → réponse d'un vrai joueur → classement (1 ligne) →
      intro de la question suivante (classement bien masqué) →
      `question:show` `mcq` (tuiles bien rendues) → `quiz:end` → redirection
      `result.html` confirmée. Aucune régression d'interaction entre étapes
      trouvée. `git diff` relu intégralement sur les 4 fichiers touchés
      (`server/index.js`, `display.html`, `display.js`, `style.css`) : le
      touché serveur reste minimal et conforme au plan, tout le CSS/JS
      nouveau reste scopé à `display.html`/`body.display-body`, aucune
      dérive de périmètre, aucun `catch` vide, aucune dépendance ajoutée,
      aucune zone interdite du CLAUDE.md touchée.

## Tests manuels recommandés
- Tester le bouton "🖥️ Mode présentation" en conditions réelles (2 écrans
  physiques) — voir si Chrome/Edge propose la permission Window Management
  et si la fenêtre se positionne sur l'écran secondaire (non vérifiable en
  sandbox, déjà signalé en tâche 040).
- Jouer une VRAIE partie complète de bout en bout avec la vue TV ouverte :
  intro de chaque question, dézoom `zoomguess`, classement entre plusieurs
  questions avec plus de 2-3 joueurs (rythme des animations, lisibilité à
  distance), puis podium final — les vérifications de cette tâche ont
  couvert chaque étape isolément, jamais un enchaînement complet sur une
  vraie partie multi-questions.
- Vérifier le classement avec beaucoup de joueurs (15+, `LEADERBOARD_MAX_ROWS`)
  pour confirmer que la troncature/le scroll de secours (`overflow-y:auto`
  sur `.display-leaderboard`) restent lisibles sur un vrai écran TV.
- Vérifier la perte du plein écran au moment du podium (étape 7, trade-off
  assumé) en conditions réelles — remettre le plein écran manuellement sur
  `result.html` si besoin, aucun bouton dédié aujourd'hui sur cette page.

## Risques restants
- **Podium (étape 7) : perte du plein écran assumée.** La redirection vers
  `result.html` sort la TV du plein écran (limitation du navigateur, pas
  du code) — `result.html` n'a pas de bouton plein écran. Si ça gêne à
  l'usage, une tâche ultérieure pourrait ajouter ce bouton à `result.html`
  (hors périmètre ici, page partagée avec les joueurs).
- **Classement (étape 6) : pas de mode équipe.** `display.js` construit son
  propre classement solo (voir `renderLeaderboardList`), sans reprendre
  l'agrégation par équipe d'`index.js` (`renderTeamBoard`/
  `computeTeamHistory`) — une partie en mode équipe affichera un classement
  par JOUEUR individuel sur la TV, pas par équipe. Simplification
  volontaire (proportionnalité de l'étape), à reconsidérer si l'utilisateur
  joue effectivement en mode équipe avec cette vue.
- **Zoomguess (étape 1) : pas de recadrage statique.** Le rendu TV ignore
  `payload.imagePos` (cadrage choisi à l'édition) — simple `object-fit:cover`
  centré à la place. Risque cosmétique mineur seulement (l'image peut être
  cadrée différemment de l'écran MJ), jamais un risque de spoiler.
- Les 13 types "en repli" (hors QCM/Vrai-Faux/Intrus/zoomguess) restent
  sans rendu dédié sur cette page (prompt + image statique seulement) —
  limite déjà actée en tâche 040, pas remise en cause ici.

## Statut
`en review` — les 7 étapes du plan sont terminées et vérifiées
(individuellement puis en un parcours combiné de bout en bout). En attente
de validation utilisateur avant commit/push.
