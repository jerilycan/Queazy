# [040] Vraie vue Joueur dédiée pour affichage TV / vidéoprojecteur

## Contexte
Reprise après le rollback de la tâche 039 ("catastrophe" signalée par
l'utilisateur, cause exacte non précisée). L'utilisateur revient avec un
cahier des charges beaucoup plus précis, qui révèle le vrai défaut de
l'approche 039 : la vue affichage y réutilisait `index.html`/`index.js`
(l'interface MJ elle-même) avec un mode `?display=1` + du CSS/JS pour
masquer le chrome — exactement ce que l'utilisateur demande maintenant de
NE PAS faire ("Il ne faut PAS simplement faire « cacher les sidebars avec
CSS sur la même page »"). Nouvelle demande : une PAGE réellement séparée,
sur le modèle de `result.html`/`results.js` qui existe déjà dans le projet
pour un besoin similaire (vue spectateur en lecture seule).

Objectif produit : en mode "Présenter" IRL, le MJ garde son PC/écran
actuel intact, et peut brancher une TV/vidéoprojecteur en second écran
(mode "Étendre" Windows) affichant une vue Joueur épurée, synchronisée en
temps réel avec la question en cours côté MJ.

## Objectif
- Nouvelle page dédiée (HTML + JS séparés, pas un mode de `index.html`)
  affichant UNIQUEMENT question + propositions + images, sans classement,
  sans contrôles, sans sidebars, sans aucun élément de l'UI MJ.
- Synchronisée avec l'état de partie réel (mêmes événements socket que la
  vue MJ), sans dupliquer la logique métier serveur.
- Ouvrable depuis un bouton dédié côté MJ ("Mode présentation" /
  "Afficher sur l'écran joueur"), dans une fenêtre séparée (`window.open`),
  déplaçable manuellement sur l'écran secondaire, avec un bouton plein
  écran dans la vue elle-même.
- Aucune modification visuelle/fonctionnelle de l'interface MJ actuelle au
  delà de l'ajout de ce bouton.

## Périmètre
- Nouvelle page `client/public/display.html` + nouveau script
  `client/public/js/display.js`, sur le modèle de `result.html`/`results.js`
  déjà existants (page séparée, réutilise `style.css` pour la cohérence
  visuelle, connexion Socket.io en lecture seule).
- Rendu épuré : prompt de la question, propositions (texte et/ou image
  selon le type), image d'illustration — rien d'autre.
- Types de questions couverts en v1 — **validé par l'utilisateur** : rendu
  dédié complet pour les types "tuiles" les plus courants (QCM, Vrai/Faux,
  Intrus), qui correspondent à l'exemple visuel donné par l'utilisateur.
  Les 12 autres types (texte libre, curseur numérique/graduation, ordre,
  image-clic, zoomguess, révélation, blind test, association, timeline,
  rangement, petit bac, recherche, indice, halo) affichent un repli simple
  (prompt + image si présente), sans leur mécanique spécifique — pourra
  être étendu type par type dans une tâche ultérieure si besoin.
- Rattrapage d'état pour rejoindre EN COURS de question (le mécanisme
  serveur conçu pendant la tâche 039 était correct et n'est pas remis en
  cause par le nouveau cahier des charges — à réintroduire proprement).
- Plein écran (API Fullscreen, bouton dédié dans la vue Joueur).
- Bouton "Mode présentation" côté MJ (`index.html`/`index.js`) ouvrant la
  nouvelle page dans une fenêtre séparée via `window.open()`.
- Détection best-effort de l'écran secondaire (Window Management API,
  `getScreenDetails()`) SI disponible dans le navigateur — repli simple
  (fenêtre normale + bouton plein écran manuel) sinon. Ne pas construire
  toute l'architecture autour de cette API expérimentale.

## Hors périmètre
- Toute refonte visuelle ou fonctionnelle de l'interface MJ actuelle
  (`index.html`/`index.js`) au-delà du bouton d'ouverture.
- Qui porte le son de jeu (bascule audio hôte → vue affichage) — non
  demandé dans ce cahier des charges (contrairement à la tâche 039), donc
  hors périmètre ici. Le son reste comme aujourd'hui (poste de l'hôte).
- Mode "à distance" (`remote`) et mode "Jouer" (`roomMode === 'auto'`) —
  même exclusion que la tâche 039, cette vue n'a de sens qu'en "Présenter"
  IRL avec MJ dédié.
- Indicateur de connexion côté MJ (existait en 039, pas redemandé ici —
  à ajouter seulement si l'utilisateur le souhaite après coup).
- Rendu dédié complet pour les 15 types de question dès cette étape (voir
  Périmètre — repli générique pour les types non couverts).
- Plus de deux écrans/vues simultanées.

## Fichiers concernés
- `client/public/display.html` (NOUVEAU) — page dédiée, calquée sur
  `result.html`.
- `client/public/js/display.js` (NOUVEAU) — logique dédiée, calquée sur
  `results.js` (connexion `viewer:true`, mais rendu de question EN COURS
  au lieu d'un résumé final).
- `client/public/js/index.js` — ajout du bouton "Mode présentation" +
  `window.open()` vers la nouvelle page. Aucune autre modification.
- `client/public/index.html` — ajout du bouton lui-même (probablement
  dans `#hostPanel`).
- `server/index.js` — `room:join` (branche `viewer:true`) : réintroduire
  le rattrapage d'état pour un spectateur qui rejoint en cours de
  question (logique déjà conçue/testée en tâche 039, non remise en cause
  par le nouveau cahier des charges).
- `client/public/css/style.css` — réutilisation des classes existantes
  (tuiles `.option-btn` et ses 8 couleurs/formes, styles de texte de
  question/image) pour la cohérence visuelle de la nouvelle page ; ajout
  de règles propres à `display.html` seulement si nécessaire (mise en page
  plein écran/16:9), jamais de modification de la mise en page MJ
  existante.

## Plan
Aucune "Interdiction" du CLAUDE.md n'est concernée par ce plan (pas de
schéma DB, pas de `render.yaml`, pas de nouvelle dépendance npm — l'API
Fullscreen et la Window Management API sont natives au navigateur).

Exploration faite avant d'écrire ce plan : `results.js`/`result.html` lus
en entier (patron de référence — page HTML séparée, connexion `viewer:true`,
réutilise `style.css`) ; le handler `question:show` d'`index.js` lu en
détail pour les champs de payload disponibles (`prompt`, `type`, `category`,
`options` — tableau de chaînes pour QCM/Vrai-Faux, tableau d'id opaques +
`intrusImagesUrl` pour Intrus — `illustrationUrl` pour l'image décorative
générique) ; `server/index.js` relu pour `room:join`/`/api/room-intrus-images/:code`
(endpoint HTTP simple, déjà keyed par code de salle, réutilisable tel quel
sans aucune logique nouvelle côté serveur).

1. **Serveur — rattrapage d'état pour un spectateur qui rejoint en cours de
   question.** Même conception que la tâche 039 (question active / révélée
   / modération en attente — ~lignes 1300-1360 de `server/index.js`,
   réservée aujourd'hui à un vrai joueur qui (re)rejoint) : extraire dans
   une fonction partagée, l'appeler aussi depuis la branche `viewer:true`
   de `room:join`. Aucun nouvel évènement, les payloads existants sont déjà
   "sans spoiler". Étape autonome, testable indépendamment du reste, avant
   même que la page dédiée existe.

2. **Nouvelle page/script minimal — tuyau de bout en bout.** Créer
   `client/public/display.html` (calqué sur `result.html` : `<head>`
   allégé — pas de confetti/profil, juste `style.css` + Socket.io) et
   `client/public/js/display.js` (calqué sur `results.js` : connexion
   `viewer:true`, voir tâche 039 pour la mécanique déjà validée). Se
   contente d'écouter `question:show` et d'afficher `payload.prompt` en
   texte brut, sans mise en forme — preuve que la salle/le rattrapage
   fonctionnent avant d'investir dans le rendu visuel. Testable seul avec
   Playwright (comme les étapes 1/2 de la tâche 039).

3. **Rendu tuiles + image.** Construit le vrai rendu :
   - QCM / Vrai-Faux : tuiles réutilisant les classes CSS existantes
     (`.option-btn`, système de 8 couleurs/formes déjà dans `style.css`),
     mêmes données que `payload.options` (tableau de chaînes).
   - Intrus : mêmes tuiles, mais photo au lieu de texte — réutilise
     `payload.intrusImagesUrl` (URL déjà prête dans le payload,
     `fetch()` + mapping par id, identique au mécanisme d'`index.js`).
   - Image d'illustration générique (`payload.illustrationUrl`), affichée
     pour TOUS les types qui en portent une, y compris ceux en repli.
   - Repli pour les 12 autres types (texte libre, graduation, ordre,
     image-clic, zoomguess, révélation, blind test, association, timeline,
     rangement, petit bac, recherche, indice, halo) — voir Périmètre
     (choix déjà validé par l'utilisateur) : juste le prompt + l'image le
     cas échéant, sans leur mécanique.
   - Trade-off : aucune donnée de score/correction n'est jamais demandée
     ici (`payload` est déjà spoiler-free), donc pas de risque d'exposer
     la réponse avant l'heure sur l'écran TV.

4. **Mise en page plein écran / 16:9 / responsive.** Nouveau bloc CSS
   scopé à `display.html` (nouvelle feuille inline ou section dédiée dans
   `style.css`, clairement délimitée pour ne jamais interférer avec la
   mise en page MJ) : pas de scrollbar, texte/tuiles/images qui remplissent
   l'espace disponible, lisible à plusieurs mètres. Aucune modification de
   la mise en page régie MJ existante.

5. **Bouton "Mode présentation" côté MJ + ouverture fenêtre.** Nouveau
   bouton dans `#hostPanel` (`index.html`/`index.js`, visible dès la
   création de la salle — pas besoin d'attendre le lancement du quiz, le
   MJ doit pouvoir préparer la TV avant) : `window.open('/display.html?room=CODE',
   'queazy-display', ...)`. Detection best-effort de l'écran secondaire si
   `window.getScreenDetails` est disponible (API Window Management,
   Chrome/Edge récents, nécessite une permission utilisateur) pour
   pré-positionner la fenêtre dessus ; repli simple (fenêtre normale,
   déplacée à la main par le MJ) sur tout autre navigateur — pas
   d'architecture construite autour de cette API expérimentale, comme
   demandé.

6. **Plein écran dans la vue Joueur.** Bouton dédié dans `display.js`
   (API Fullscreen standard, geste utilisateur requis) — même mécanique
   que celle déjà conçue/testée en tâche 039, simplement dans le nouveau
   fichier.

7. **Vérification robustesse.** Test manuel/Playwright : fermeture/
   rechargement de la fenêtre `display.html` en pleine question, en pleine
   révélation — confirme que le rattrapage de l'étape 1 couvre bien ces
   cas dans ce nouveau contexte.

## Étapes réalisées
- [x] Étape 1 — Serveur : rattrapage d'état pour un spectateur qui rejoint
      en cours de question. Extraction du bloc de rattrapage (question
      active / révélée / modération en attente) de `room:join` dans une
      fonction partagée `sendJoinCatchup(room, socket)`, appelée à la fois
      depuis la branche joueur réel (comportement inchangé) et depuis la
      branche `viewer:true` (nouveau, juste avant son `return`). Reprend
      la conception déjà validée en tâche 039, réimplémentée proprement
      sur la base de code actuelle (post-rollback).
- [x] Étape 2 — Nouvelle page/script minimal (tuyau de bout en bout).
      `client/public/display.html` (calqué sur `result.html` : même `<head>`
      allégé — polices, `style.css`, Socket.io ; sans confetti/profil/
      navbar/pwa.js/theme.js/supabase, page volontairement minimale) +
      `client/public/js/display.js` (calqué sur `results.js` : `roomCode`
      depuis l'URL, `io()`, `room:join` avec `viewer:true` au `connect`).
      À cette étape, se contentait d'écouter `question:show` et d'afficher
      `payload.prompt` en texte brut — remplacé par le rendu complet dès
      l'étape 3 (même fichier, pas de version intermédiaire gardée).
- [x] Étape 3 — Rendu tuiles + image. QCM et Vrai/Faux : grille de tuiles
      réutilisant telles quelles les classes existantes `.options-grid` +
      `.option-btn` (+ `.truefalse-grid`/`.truefalse-btn`) de `style.css` —
      aucun CSS dupliqué, juste de nouveaux `<div>` avec ces classes,
      purement informatif (pas d'`onclick`). Intrus : mêmes tuiles
      (`.intrus-tile`) avec une `<img>` à l'intérieur (style inline minimal
      `object-fit:cover`, sans réutiliser `.intrus-tile-img` — celle-ci
      dépend d'`applyCropTransform`, le cadrage avancé explicitement hors
      périmètre) ; reprend le mécanisme `fetch(payload.intrusImagesUrl)` +
      mapping par id d'`index.js`, avec un jeton de requête (`
      currentIntrusRequestToken`) pour qu'une réponse HTTP en retard n'aille
      jamais écraser les tuiles d'une question suivante déjà affichée.
      Image d'illustration générique : un seul champ à la fois porte l'image
      selon le type (`illustrationUrl`/`imageUrl`/`enigmeImageUrl`, jamais
      deux en même temps — vérifié dans `index.js` `emitQuestion`), affichée
      en haut pour tous les types qui en portent une, y compris les 12 types
      en repli (texte libre, graduation, ordre, image-clic, zoomguess,
      révélation, blind test, association, timeline, rangement, petit bac,
      recherche, indice, halo) qui n'affichent sinon que le prompt, sans
      leur mécanique spécifique — choix déjà validé, pas reconsidéré.
      `timer:end`/`question:reveal` : écouteurs enregistrés explicitement
      mais volontairement no-op (commentés) — aucune barre de temps, aucun
      classement, aucune indication bonne/mauvaise réponse, comme validé.
- [x] Étape 4 — Mise en page plein écran/16:9/responsive. Nouveau bloc CSS
      en toute fin de `style.css` (après le bloc "Responsive" existant, même
      raison : primer sur les règles de base à spécificité égale), scopé à
      `body.display-body` (posée uniquement par `display.html`) — jamais de
      modification des règles de base partagées avec l'écran de jeu MJ.
      Tailles en `vh`/`vw`/`clamp()` pour remplir l'écran et rester lisible
      à distance quelle que soit la résolution ; `overflow:hidden` sur
      `body.display-body` (jamais de scrollbar) ; repli mobile dédié
      (`@media max-width:640px`) en plus du comportement responsive déjà
      présent nativement dans `style.css` pour `.options-grid`/`.option-btn`.
- [x] Étape 5 — Bouton "Mode présentation" côté MJ + ouverture fenêtre.
      `index.html` : `#openDisplayBtn` ajouté dans `#hostPanel` entre
      "Sélectionner un Quiz" et "LANCER" (même groupe `.d-flex.gap-sm`),
      aucune autre modification de la page. `index.js` : câblage ouvrant
      `/display.html?room=CODE` via `window.open(url, 'queazy-display')`
      dans une fenêtre nommée fixe (clics répétés = même fenêtre réutilisée/
      renavigée, jamais de doublon). Détection best-effort de l'écran
      secondaire via `window.getScreenDetails` (Window Management API) —
      voir "Écart notable" ci-dessous pour un bug trouvé et corrigé en
      testant ce point précis.
- [x] Étape 6 — Plein écran dans la vue Joueur. Bouton dédié dans
      `display.js` (`document.documentElement.requestFullscreen()` /
      `document.exitFullscreen()`, jamais automatique au chargement, libellé
      mis à jour via `fullscreenchange`), `.catch()` commenté sur les deux
      appels (règle CLAUDE.md sur les erreurs avalées).
- [x] Étape 7 — Vérification robustesse (passe QA/design séparée, 2e agent).
      Voir "Checks effectués" ci-dessous pour le détail complet (Volet 1 :
      les 17 types de question un par un ; Volet 2 : cas limites + rechargement
      réel de la page en pleine question et après révélation + redimension-
      nement de fenêtre). Deux bugs réels trouvés et corrigés au passage,
      tous deux dans le périmètre déjà prévu pour cette étape (CSS/JS scopés
      à `display.html`/`display.js`/le bloc `body.display-body` de
      `style.css`, jamais l'écran MJ) — détaillés plus bas.

## Checks effectués
- [x] `node --check server/index.js` — OK (étape 1)
- [x] Démarrage serveur vérifié — boot propre (seuls les avertissements
      Supabase habituels liés au sandbox, sans rapport) (étape 1)
- [x] Test fonctionnel ciblé (Playwright, connexions socket.io brutes,
      étape purement serveur) : un spectateur (`viewer:true`) qui rejoint
      PENDANT une question active reçoit bien `question:show` (état 1) ;
      un spectateur qui rejoint APRÈS la révélation reçoit bien
      `question:show` + `question:reveal` (état 2) — mêmes résultats
      qu'en tâche 039, comportement identique confirmé sur la base de code
      resynchronisée. État 3 (modération en attente) non re-testé
      isolément : extraction verbatim du bloc existant déjà couvert par ce
      cas côté joueur réel, aucune logique modifiée (étape 1).
- [x] `node --check` sur `client/public/js/display.js` et
      `client/public/js/index.js` — OK à chaque étape (2, 3, 5, 6).
- [x] Démarrage serveur reveérifié après chaque étape (étapes 2/3/4/5/6) —
      boot propre, `/`, `/display.html` et `/js/display.js` répondent 200.
- [x] Étape 2 (Playwright) : hôte (socket.io brut) crée une salle et émet
      `question:show` ; une vraie page Chromium sur
      `/display.html?room=CODE` affiche bien `payload.prompt` en texte
      brut — tuyau de bout en bout confirmé avant d'investir dans le rendu.
- [x] Étape 3+4 (Playwright, captures d'écran desktop 1920×1080 ET mobile
      390×844) : QCM (4 options, avec/sans illustration), Vrai/Faux, Intrus
      (upload réel via `/api/room-intrus-images/:code` + fetch côté
      `display.js`, 4 tuiles avec photos chargées vérifiées individuellement),
      un type en repli (`free`, prompt + illustration, tuiles bien
      masquées), un type portant l'image sous `imageUrl` plutôt
      qu'`illustrationUrl` (`image`) — image affichée dans les deux cas.
      Écran d'attente avant la première question vérifié. Aucun scroll
      horizontal détecté (desktop ni mobile) sur aucun de ces écrans.
      Captures comparées visuellement à la maquette validée par
      l'utilisateur (`task040-mockups/mockup-1-vue-tv.png`, session
      précédente) — rendu identique (image en haut, question centrée,
      grille de tuiles colorées en dessous).
- [x] Étape 5 (Playwright) : `#openDisplayBtn` présent et câblé ; 1er clic
      ouvre une fenêtre vers `/display.html?room=CODE` (URL vérifiée) ; 2e
      clic réutilise la même fenêtre (nombre de pages du navigateur
      inchangé). Room creation réelle non exerçable dans ce sandbox (exige
      une session Supabase authentifiée, voir `createBtn.onclick`) —
      précondition simulée directement (`roomInput.value` posé + `#hostPanel`
      démasqué, exactement l'état que la vraie création de salle produit).
- [x] Étape 6 (Playwright) : pas de plein écran au chargement ; clic sur le
      bouton bascule `document.fullscreenElement` et met à jour le libellé
      dans les deux sens (`⛶ Plein écran` ↔ `🗗 Quitter le plein écran` via
      `fullscreenchange`) ; aucune exception JS non gérée pendant les deux
      clics.
- [x] Test d'intégration final (Playwright) : `timer:end`/`question:reveal`
      reçus sans casser l'affichage (prompt/tuiles inchangés, aucune classe
      `.correct-reveal`/`.incorrect-reveal` jamais posée — conforme à
      "aucune indication bonne/mauvaise réponse") ; rechargement de
      `display.html` EN PLEINE question (combine le rattrapage serveur de
      l'étape 1 et le rendu de l'étape 3) : réaffiche exactement la même
      question après reload, sans erreur JS sur toute la séquence.
- [x] Tous les serveurs/processus Playwright de test nettoyés après chaque
      vérification (aucun processus `node index.js` restant en fin de
      tâche).
- [x] Étape 7 — Volet 1 (passe QA/design séparée, 2e agent) : les 17 types
      canoniques de `QUESTION_TYPE_META` (`client/public/js/index.js`, le
      plan en comptait "12" en repli par erreur d'énumération — voir plus
      bas) testés un par un via Playwright + connexions socket.io brutes
      (salle réelle, `question:show` réaliste par type, mêmes champs
      qu'`emitQuestion` — `illustrationUrl` générique / `imageUrl` pour
      image·zoomguess·recherche·halo / `enigmeImageUrl` pour reveal),
      capture desktop 1920x1080 ET mobile 390x844 pour chacun (avec une
      vraie image visible 400x260, pas un 1x1px invisible en `width:auto`).
      Les 3 types à rendu dédié (mcq/truefalse/intrus) : tuiles lisibles,
      couleurs/formes cohérentes avec l'écran MJ, aucun débordement. Les 14
      types en repli : prompt + image propres, aucune zone vide moche,
      aucune image "cassée", pas de scroll horizontal sur aucune des 34
      captures (17 types × desktop/mobile).
- [x] Étape 7 — Volet 1, Intrus spécifiquement : 3, 5 ET 8 photos (min/
      médian/max, voir `isValidImageValue` côté serveur) testées avec un
      VRAI upload via `POST /api/room-intrus-images/:code` (comme
      `index.js`), photos distinctement colorées pour repérer un éventuel
      mauvais mapping id→image (aucun trouvé, mapping correct dans les 3
      cas). Bug réel trouvé et corrigé à 8 photos — voir "Écart notable".
- [x] Étape 7 — Volet 2 (stress test) : prompt 200+ caractères avec retours
      à la ligne explicites (aucun débordement, retours à la ligne
      respectés) ; QCM 8 options (`MCQ_MAX_OPTIONS`, `editor.js`) avec
      textes 30+ caractères chacun (8 tuiles toutes visibles, wrap propre,
      8 couleurs/formes distinctes) ; QCM 2 options (rendu correct, pas de
      tuile fantôme) ; emoji + accents + guillemets français dans le prompt
      (affiché tel quel, aucun souci d'encodage) ; `illustrationUrl`
      pointant vers une URL 404 (bug réel trouvé et corrigé — voir "Écart
      notable") ; question sans `illustrationUrl` du tout (repli déjà
      propre, confirmé) ; deux `question:show` enchaînés à 30ms d'intervalle
      (état final = uniquement la 2e question, aucune trace visuelle/DOM de
      la 1re — pas de mélange, pas de flash).
- [x] Étape 7 — Rechargement RÉEL de la page (`page.reload()`, pas
      seulement au niveau protocole comme au test d'intégration de
      l'étape 6) : PENDANT une question active (`sendJoinCatchup`, état 1)
      ET APRÈS une révélation (`question:reveal`, état 2) — dans les deux
      cas la question réapparaît correctement après reload (même prompt,
      mêmes tuiles), `#displayWaiting` reste bien masqué, aucune erreur JS
      sur toute la séquence (`page.on('pageerror')` surveillé en continu).
- [x] Étape 7 — Redimensionnement de la fenêtre PENDANT une question
      affichée (1920x1080 → 1280x720 → 768x1024 portrait → 390x844), à la
      fois sur un QCM standard et sur un Intrus à 8 photos (le cas le plus
      contraignant verticalement) : aucune scrollbar horizontale ni
      débordement vertical détecté à AUCUNE des 4 tailles, dans les deux
      cas (recalcul dynamique confirmé, voir "Écart notable").
- [x] `node --check` sur `server/index.js`, `client/public/js/display.js`
      et `client/public/js/index.js` après les 2 corrections de cette
      passe — OK.
- [x] Serveur de test démarré (`PORT=8970 node index.js`) pour toute la
      durée de la passe QA, arrêté proprement à la fin (aucun processus
      `node index.js` restant, port fermé) ; log serveur relu, aucune
      erreur en dehors des avertissements Supabase habituels (egress
      bloqué en sandbox, sans rapport avec le code testé).

## Écart notable par rapport au plan
- **Étape 5 — bug trouvé et corrigé en testant, pas anticipé par le plan** :
  la première version câblait le bouton en `async`, avec un
  `await window.getScreenDetails()` posé AVANT l'appel à `window.open()`
  (dans l'esprit de "tente d'abord la détection, ouvre en conséquence").
  Testé en conditions réalistes (permission jamais tranchée — ce qui arrive
  aussi bien en environnement headless que, potentiellement, dans un vrai
  navigateur si l'invite est ignorée) : la promesse de `getScreenDetails()`
  ne se résout ni ne rejette JAMAIS dans ce cas, et `window.open()` appelé
  après un `await` a perdu le geste utilisateur — bloqué silencieusement
  par le navigateur (aucune erreur, la fenêtre n'apparaît simplement
  jamais). Corrigé : `window.open()` est maintenant SYNCHRONE dans le
  gestionnaire de clic (ouverture normale garantie, geste utilisateur
  jamais perdu) ; la détection d'écran secondaire tourne ensuite en tâche
  de fond (avec un timeout de 1.5s par sécurité) et REPOSITIONNE la fenêtre
  déjà ouverte (`displayWin.moveTo`/`.resizeTo`) si un écran secondaire est
  trouvé, au lieu de conditionner l'ouverture elle-même. Comportement final
  conforme au plan ("repli simple qui fonctionne de façon fiable sur TOUS
  les navigateurs modernes, l'API Window Management n'est qu'un bonus") —
  juste une implémentation plus robuste que la première intuition.
- **Étape 7 (passe QA/design séparée) — 3 bugs réels trouvés en testant les
  17 types un par un et les cas limites, tous corrigés dans le périmètre
  déjà prévu pour cette étape** :
  1. **Icône et texte qui se chevauchaient sur les tuiles QCM/Intrus en
     mobile.** Le bloc CSS de l'étape 4 fixe `.display-root .option-btn` en
     `vh`/`vw` pour toutes les tailles, puis le réduit à des valeurs fixes en
     px dans `@media (max-width:640px)` — mais cette media query ne
     réajustait QUE `padding`/`min-height`, pas `.option-btn::before` (la
     pastille de forme, positionnée en absolu). À 390px de large, l'icône
     (calculée en `vh` de la hauteur d'écran, restée active faute de
     réécriture) débordait de ~3px sur le texte (`padding-left:56px` vs
     icône finissant à ~59px) — repéré en capture mobile QCM/Vrai-Faux,
     visible seulement sur la tuile standard `.option-btn` (pas sur
     `.truefalse-btn`, dont l'icône est empilée en flex `position:static`,
     jamais absolue). Corrigé : valeurs fixes ajoutées pour `::before` dans
     ce même bloc `@media (max-width:640px)` (`left:16px; width/height:24px`),
     cohérent avec le reste du bloc mobile.
  2. **Intrus à 7-8 photos qui débordait verticalement de l'écran (dernière
     rangée rognée) sur une résolution TV courante (1920x1080).** Le plafond
     `max-height: min(320px, 36vh)` par tuile, hérité tel quel de l'écran MJ
     (`.options-grid.intrus-grid .option-btn.intrus-tile`, style.css), ne
     suppose implicitement qu'UNE rangée — sur cette page (mise en page
     centrée, pleine hauteur, `overflow:hidden` volontaire, jamais de
     scrollbar), 3 rangées (7-8 photos, la grille retombant sur son défaut 3
     colonnes — voir "Risques restants") à cette hauteur dépassaient
     largement les 1080px disponibles. Corrigé côté `display.js`
     (`applyIntrusTileSizing`, appelée depuis `renderIntrus` ET sur
     `resize`) : calcule l'espace RÉELLEMENT disponible sous le prompt et
     le nombre de rangées réel, puis pose un `max-height` par tuile en JS
     (jamais plus grand que les 320px hérités, jamais plus petit que 60px).
     Vérifié à 3/5/8 photos et aux 4 tailles de fenêtre du Volet 2 (aucun
     débordement dans aucun cas).
  3. **`illustrationUrl` cassée/404 : image potentiellement "manquante"
     visible.** Sur ce Chromium précis, une image cassée avec `alt=""` et
     `width:auto` (voir `.illustration-img` de base) s'effondre à 0x0 (pas
     d'icône visible dans NOS captures) — mais rien ne garantissait ce
     comportement sur tout navigateur, et le pattern `onerror` existe déjà
     partout ailleurs dans `index.js` pour ce risque précis (ex.
     `illustrationImg`/`rechercheImg`/`haloImg`). Ajouté par cohérence et
     robustesse dans `display.js` (`renderIllustration`) : même pattern
     exact (`.onerror = () => classList.add('d-none')`, réassigné à chaque
     rendu — une réponse en retard pour une ANCIENNE image ne peut pas
     s'appliquer après coup, le navigateur abandonne une requête dont le
     `src` a déjà changé).

## Tests manuels recommandés
- Ouvrir une vraie salle "Présenter" IRL sur un poste avec 2 écrans
  (physiques), cliquer "🖥️ Mode présentation", vérifier si Chrome/Edge
  propose la permission Window Management et si la fenêtre se positionne
  bien sur l'écran secondaire quand elle est accordée (non vérifiable en
  sandbox : la permission ne peut pas être accordée par un navigateur
  headless piloté par Playwright).
- Vérifier le plein écran en conditions réelles (geste utilisateur réel,
  hors sandbox) sur au moins Chrome et Firefox.
- Vérifier le repli `illustrationUrl` cassée (point 3 de l'Écart notable
  étape 7) sur un vrai Firefox/Safari, pas seulement Chromium — le fix
  (`onerror`) rend le comportement fiable sur tout navigateur en théorie,
  mais seul Chromium (Playwright) a pu être vérifié en sandbox ; l'absence
  de bug n'a été OBSERVÉE que sur ce moteur avant correction.
- Les 17 types ont désormais tous été capturés par cette passe QA (voir
  Checks effectués, étape 7) — plus de revue visuelle manuelle nécessaire
  pour ce point précis, sauf changement futur du rendu.

## Risques restants
- Le rendu "Intrus" ne reproduit pas le motif de répartition par rangée de
  `index.js` (`INTRUS_ROW_PATTERNS`, ex. 7 photos = rangées de 3/2/2) —
  simplification volontaire (voir le plan : "pas besoin de l'anneau de
  sélection ni du cadrage avancé, juste afficher la photo dans la tuile"),
  le CSS existant retombe sur son repli par défaut (3 colonnes) pour tout
  nombre de photos. Ce point reste inchangé après la passe QA (étape 7) :
  ce qui a été corrigé, c'est le DÉBORDEMENT VERTICAL que ce repli 3
  colonnes fixes provoquait à 7-8 photos (voir Écart notable, bug 2) — pas
  la disposition elle-même, toujours différente de l'écran MJ pour des
  comptes comme 5, 7 ou 8 (juste sans jamais rien couper à l'écran
  désormais, vérifié à 3/5/8 photos × 4 tailles de fenêtre). À reconsidérer
  si l'utilisateur le signale après usage réel.
- `window.getScreenDetails()` re-déclenche potentiellement l'invite de
  permission à CHAQUE clic sur "Mode présentation" (pas de mémorisation
  côté client) — comportement du navigateur, hors de notre contrôle,
  cohérent avec le statut "bonus" de cette détection.
- **Rendu des 14 types en repli — évaluation honnête (étape 7) : minimal,
  pas juste "propre mais incomplet".** Pour des types dont la mécanique EST
  l'essentiel du visuel côté joueur (`order`/`timeline`/`rangement` :
  glisser-déposer ; `association` : liaison de colonnes ; `blindtest` :
  extrait audio ; `recherche`/`halo` : balayage/clics progressifs sur une
  image cachée ; `zoomguess` : dézoom animé ; `reveal` : image qui se
  complète), l'écran TV n'affiche RIEN de tout ça — juste le prompt et,
  quand il y en a une, l'image statique. Un public qui regarde seulement la
  TV (sans écran de joueur sous les yeux) ne voit donc aucune indication de
  ce qui se passe pendant ces types de question, contrairement aux 3 types à
  rendu dédié. C'est un choix de périmètre déjà validé par l'utilisateur
  (voir "Périmètre"/"Hors périmètre" en tête de ce fichier, pas remis en
  cause par cette passe QA) — mais le signaler clairement plutôt que de
  laisser croire que ces 14 types ont un rendu TV équivalent aux 3 dédiés :
  visuellement, ce n'est pas le cas, et ça ne le sera pas sans une tâche
  ultérieure dédiée à chacun.

## Statut
`ouverte`
