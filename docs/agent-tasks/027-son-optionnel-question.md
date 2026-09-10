# [027] Son facultatif sur n'importe quel type de question

## Contexte
Le Blind Test a déjà tout un système d'extrait audio (import, découpe à la
forme d'onde, lecture synchronisée pendant la question, coupure à la fin).
L'utilisateur veut la même chose comme option FACULTATIVE sur N'IMPORTE
QUEL type de question (QCM, Vrai/Faux, texte libre...) — un son
d'ambiance/indice qui joue pendant que les joueurs répondent, sans rapport
avec le principe même de Blind Test (deviner le titre/artiste).

## Objectif
Depuis l'éditeur, sur une question de N'IMPORTE QUEL type, un créateur peut
facultativement ajouter un extrait audio :
- Même outil d'import/découpe que Blind Test (forme d'onde réelle, 2
  poignées Début/Durée, 30s max).
- À la partie : le son se lance en même temps que la question apparaît
  (comme pour Blind Test), pour tout le monde.
- Le son se coupe automatiquement dès que tout le monde a répondu (même
  instant que la fin normale de la question/`timer:end`, comme Blind Test
  déjà aujourd'hui).
- Sans effet sur le déroulé normal du type de question lui-même (QCM reste
  QCM, etc.) — c'est un ajout au-dessus, pas une transformation du type.

## Périmètre
- Éditeur : section "Son (facultatif)" réutilisant le même composant
  d'import/découpe/forme d'onde que Blind Test, rendue disponible pour tout
  type de question (pas seulement `blindtest`, qui garde en plus sa
  mécanique de jeu propre — deviner titre/artiste — inchangée).
- Diffusion/lecture en jeu : le son choisi joue dès `question:show` pour
  tout le monde (mêmes règles de coupure IRL/à distance déjà en place pour
  Blind Test — voir `gameMode`), et se coupe à `timer:end`/fin de question.
- Sauvegarde du quiz : le clip suit la question comme un champ de plus
  (upload/URL Supabase Storage), même mécanique que les médias déjà
  existants (image, audio Blind Test).

## Hors périmètre
- Toute modification de la mécanique de jeu Blind Test elle-même (deviner
  titre/artiste, champs de réponse dédiés, score) — reste un type à part,
  cette tâche ne fait qu'étendre la disponibilité de l'OUTIL audio à
  d'autres types.
- Plusieurs sons sur une même question, ou un son différent selon la phase
  (lecture/révélation) — un seul extrait, comme Blind Test.
- Visualiseur/pulsation animée (`startBlindTestPulse`) ou tout autre habillage
  visuel spécifique à l'écran Blind Test — à trancher au plan si le son
  facultatif doit avoir son propre repère visuel minimal (ex. juste une
  icône "🔊 son en cours") ou rester totalement silencieux visuellement.
- Le réglage volume/coupure déjà existant (IRL vs à distance, mute hôte) —
  réutilisé tel quel, pas remis en cause.

## Fichiers concernés
- `client/public/editor.html`/`client/public/js/editor.js` — le bloc
  d'import/découpe audio existant (`#audioTrimWrap`/`#audioClipWrap`,
  `renderWaveform`, `audioUploadInput.onchange`, etc., voir tâche du
  correctif forme d'onde de cette même session) est actuellement rattaché
  au type "blindtest" (`toggleTypeSections`/`q.audio`) — à rendre
  disponible pour les autres types, sous un champ distinct pour ne pas
  entrer en conflit avec le `q.audio` propre à Blind Test le jour où les
  deux coexisteraient dans le même modèle de données (à trancher au plan :
  nom du champ, ex. `q.bonusAudio`).
- `client/public/js/index.js` — `emitQuestion()` (upload/URL du clip,
  actuellement déjà assez générique — voir `audioToUpload`/`payload.audioUrl`,
  à vérifier si réellement indépendant du type ou seulement câblé pour
  blindtest) ; lecture en jeu actuellement centrée sur
  `buildBlindTestArea()`/`blindtestAudio` (visualiseur, prompt de
  déblocage autoplay, mute IRL/à distance) — à déterminer si on réutilise
  cet élément `<audio>` tel quel (mutuellement exclusif avec Blind Test,
  jamais les deux en même temps sur une question) ou si un second élément
  `<audio>` dédié est plus simple/sûr ; coupure à `timer:end` (déjà le
  point où `stopBlindTestAudio()` est appelé aujourd'hui).
- `server/index.js` — relais existant `/api/room-audio/:code`
  (`room.pendingAudio`) déjà générique (un slot par salle, pas spécifique à
  un type) — probablement réutilisable tel quel sans modification.

## Plan

Points explorés avant ce découpage :
- `uploadQuestionMedia()` (editor.js, sauvegarde du quiz) traite déjà
  `q.audio` **pour n'importe quel type**, sans condition — confirmé en
  lisant le code (`field(q, 'audio')` hors de toute branche `if (q.type
  === ...)`). Le stockage/upload Supabase Storage ne demande donc AUCUNE
  modification.
- `.detail-section#blindtestSection` mélange actuellement DEUX choses : le
  bloc d'import/découpe audio (réutilisable tel quel) ET les champs propres
  à la mécanique Blind Test (case "Titre uniquement", listes titre/artiste
  acceptés). Il faut les séparer en deux sections DOM distinctes pour
  afficher l'une (audio) partout et l'autre (réponses) seulement pour
  `blindtest` — sans dupliquer ni les ids ni le JS qui les pilote déjà
  (`renderWaveform`, `audioUploadInput.onchange`, `audioExtractBtn`...,
  tous génériques, aucun ne teste `q.type`).
- **Décision de champ modèle (tranchée ici, cf. l'hésitation notée dans
  Fichiers concernés)** : garder `q.audio` comme SEUL champ, pas de
  `q.bonusAudio` séparé. Une question n'a jamais qu'un seul type à la
  fois, donc aucun risque de collision entre "l'audio du Blind Test" et
  "le son facultatif d'un autre type" — c'est plus simple et ça évite de
  dupliquer toute la logique de chargement/sauvegarde/validation déjà en
  place pour `q.audio`.
- **Pas de nouvelle case à cocher "activer le son"** : le même patron déjà
  utilisé pour l'illustration optionnelle (`illustrationSection`, visible
  sur presque tous les types, upload vide par défaut, aperçu seulement une
  fois un fichier choisi) s'applique tel quel ici — la section audio est
  simplement toujours visible (sauf sur les types qui gèrent déjà leur
  propre son/image en tant que cœur du type, voir étape 1), avec son bouton
  d'import déjà vide par défaut. Plus simple qu'un toggle en plus à
  synchroniser avec le modèle.
- `validateQuestion()` : le garde-fou "audio obligatoire" existant est déjà
  strictement scopé à `if (q.type === 'blindtest')` — aucune modification
  nécessaire, le son reste bien facultatif pour tous les autres types.
- Côté salle de jeu, `emitQuestion()` (index.js) calcule aujourd'hui
  `audioToUpload = q.type === 'blindtest' ? q.audio : null` (L.5870) —
  gardé par erreur au seul type blindtest alors que le reste de la chaîne
  (upload/relais `/api/room-audio/:code`, `payload.audioUrl`) est déjà
  générique. Simple retrait de cette condition.
  **Complément trouvé par la validation du plan (subagent)** :
  `payload.audioMode` (L.5807, `q.type === 'blindtest' ? gameMode :
  undefined`) a EXACTEMENT le même problème et doit être corrigé DANS LA
  MÊME étape — sinon `audioMode` vaut `undefined` pour tout type non-
  blindtest, et la règle de mute prévue pour `playBonusAudio`
  (`mode === 'remote' ? false : !isHost`) traiterait silencieusement
  `undefined` comme "IRL" : le son bonus resterait muet pour tous les
  non-hôtes même en partie "à distance". Les deux conditions tombent
  ensemble.
- Lecture en jeu : `buildBlindTestArea()`/`blindtestAudio` embarquent tout
  un appareillage propre à Blind Test (visualiseur, pulsation, prompt de
  déblocage dédié, slider de volume utilisateur) — explicitement HORS
  PÉRIMÈTRE de reproduire pour le son facultatif générique. Un second
  élément `<audio>` DÉDIÉ, cette fois minimal, est plus sûr (aucun risque
  de régression sur Blind Test) et suffisant : mute selon IRL/à distance +
  hôte (même règle), volume fixe, lecture en `.catch(() => {})` silencieux
  si bloquée par la politique autoplay du navigateur — même patron déjà
  utilisé pour `revealAudioPlayer` (tâches 017/018) dans ce même fichier,
  pas besoin d'inventer un système de déblocage dédié comme Blind Test.

Étapes (chacune un diff autonome) :

1. **`client/public/editor.html`** — sépare `#blindtestSection` en deux
   blocs distincts :
   - `#bonusAudioSection` (nouveau nom) : garde le bloc d'import/découpe
     tel quel (mêmes ids : `audioUpload`, `audioTrimWrap`,
     `audioWaveform`, `audioClipWrap`, etc. — AUCUN changement d'id, juste
     déplacé dans son propre conteneur), libellé neutre ("🔊 Son
     (facultatif)" + une phrase expliquant qu'il joue pendant la question
     et se coupe une fois tout le monde répondu).
   - `#blindtestAnswersSection` (nouveau nom) : garde la case "Titre
     uniquement" + les listes titre/artiste, reste strictement réservé à
     `blindtest`.
2. **`client/public/js/editor.js`** — `toggleTypeSections()` : remplace le
   `blindtestSection.classList.toggle(...)` unique par deux lignes
   (`bonusAudioSection` visible pour TOUS les types sauf ceux qui ont déjà
   leur propre son/mécanique audio en cœur de type — seul `blindtest`
   lui-même est concerné, son propre bloc audio restant affiché via ce
   même `#bonusAudioSection` partagé ; `blindtestAnswersSection` visible
   uniquement pour `blindtest`, comme avant). Toutes les autres références
   à `blindtestSection` dans le fichier (recherchées explicitly) à
   vérifier/adapter au nouveau découpage.
3. **`client/public/js/index.js` — `emitQuestion()`** : retire la
   condition de type sur `audioToUpload` (devient `q.audio || null`,
   n'importe quel type) ; `audioMode` peut rester tel quel ou être posé
   sans condition (`gameMode`, sans effet si aucun son) — à trancher au
   moment de l'implémentation selon ce qui reste le plus lisible.
4. **`client/public/index.html`** — nouvel élément `<audio id=
   "bonusAudioPlayer" class="d-none">` (pas de contrôles visibles, pas de
   visualiseur — juste un lecteur en arrière-plan).
5. **`client/public/js/index.js`** — nouvelles fonctions `playBonusAudio(
   url, mode)`/`stopBonusAudio()` (mute selon `mode === 'remote' ? false :
   !isHost`, volume fixe raisonnable ex. 70%, `src` + `.play().catch(() =>
   {})`) ; câblées dans le handler `question:show` (branche `else` du test
   `payload.type === 'blindtest'` déjà existant : lit `payload.audioUrl`
   s'il est présent, sinon appelle `stopBonusAudio()`) et dans le handler
   `timer:end` (appel systématique de `stopBonusAudio()`, à côté de l'appel
   déjà existant à `stopBlindTestAudio()` pour blindtest).
6. **Vérification en direct** (Browser pane, sockets bruts + vraie page) :
   question de type "free" (ou autre) avec `audioUrl` renseigné → le son
   démarre bien à `question:show`, se coupe bien à `timer:end` (fin
   normale ET fin anticipée "tout le monde a répondu", même mécanisme) ;
   confirmer qu'une question SANS son ne déclenche rien (`stopBonusAudio()`
   no-op) ; confirmer que Blind Test lui-même n'est pas affecté (son propre
   système de lecture inchangé, `bonusAudioPlayer` jamais sollicité pour ce
   type).

Aucune zone des "Interdictions" du `CLAUDE.md` n'est concernée par ce plan.

## Risques restants (identifiés par la validation du plan, avant implémentation)
- **Reconnexion à une question déjà en révélation** (`server/index.js`
  ~L.1281-1298) : le serveur réémet `question:show` (donc redémarrerait
  l'audio) mais ne réémet `timer:end` (qui l'arrêterait) que pour le type
  "reveal" — un reconnectant arrivant à ce stade sur une question blindtest
  OU (après cette tâche) sur une question avec son bonus verrait/entendrait
  le son redémarrer brièvement sans jamais se couper. Bug préexistant sur
  Blind Test, hors périmètre de cette tâche (pas introduit par elle), mais
  mécaniquement étendu au son bonus — à corriger dans une tâche dédiée si
  gênant en pratique.
- **UX changement de type** : `qType.onchange` ne vide jamais `q.audio`
  quand on change le type d'une question (comportement déjà existant,
  vérifié dans `editor.js`). Un quiz configuré en Blind Test puis retypé
  en QCM garderait automatiquement l'ancien extrait comme son bonus, sans
  confirmation du créateur — pas un bug de données (rien d'orphelin), mais
  potentiellement surprenant. Assumé tel quel pour cette tâche (cohérent
  avec le choix "un seul champ `q.audio`") ; à revoir seulement si
  remonté comme gênant en usage réel.

## Étapes réalisées
- [x] 1. `editor.html` — séparation en `#bonusAudioSection` (audio,
      partagé) et `#blindtestAnswersSection` (titre/artiste, propre à
      Blind Test), ids internes inchangés.
- [x] 2. `editor.js` — consts renommées, `toggleTypeSections()` :
      `bonusAudioSection` visible pour tous les types,
      `blindtestAnswersSection` réservé à `blindtest`.
- [x] 3. `index.js emitQuestion()` — retiré la condition de type sur
      `audioToUpload` ET `audioMode` (correctif trouvé par la validation
      du plan).
- [x] 4. `index.html` — nouvel élément `<audio id="bonusAudioPlayer">`.
- [x] 5. `index.js` — `playBonusAudio()`/`stopBonusAudio()`, câblées dans
      `question:show` (branche non-blindtest) et `timer:end`.
- [x] 6. Vérification en direct.

## Checks effectués
- [x] `node --check client/public/js/editor.js` — passe.
- [x] `node --check client/public/js/index.js` — passe.
- [x] (server/index.js non touché, conforme au plan — relais déjà
      générique).
- [x] **Vérification EN DIRECT** (Browser pane, vraie page hôte + joueur,
      salle "Présenter") :
  - Question type "free" avec `audioUrl` : son démarré des deux côtés
    (`paused:false` côté hôte).
  - Règle de mute confirmée dans les 3 cas : `audioMode:'remote'` → joueur
    non-hôte non muet (`muted:false`) — exactement le bug trouvé par la
    validation du plan, confirmé corrigé ; `audioMode` absent (IRL par
    défaut) → joueur non-hôte muet (`muted:true`).
  - Coupure à la fin de question (joueur répond → `timer:end`) : son
    arrêté des deux côtés (`paused:true`).
  - Question type "blindtest" avec `audioUrl` : `bonusAudioPlayer` jamais
    sollicité (`bonusPaused:true`), `blindtestAudio` reçoit bien l'URL —
    exclusion mutuelle confirmée, aucune régression sur Blind Test.
  - `.play()` bloqué par la politique autoplay du navigateur sur l'onglet
    joueur (`paused:true` malgré `muted:false`) — comportement ATTENDU et
    déjà accepté (même compromis que `revealAudioPlayer`, pas de mécanique
    de déblocage dédiée dans le périmètre de cette tâche), pas un bug.

## Tests manuels recommandés
Avec un vrai compte, dans l'éditeur : ouvrir une question de type QCM (ou
autre), confirmer que "🔊 Son (facultatif)" apparaît et fonctionne comme
pour Blind Test (import, découpe, aperçu, retrait). Vérifier qu'un type
Blind Test affiche bien les DEUX sections (son + réponses titre/artiste).
En partie réelle (pas juste sockets bruts), confirmer que le son se lance
bien à l'affichage de la question sur un vrai navigateur ayant déjà
interagi avec la page (contourne la politique autoplay, non testable en
conditions bot). Tester aussi le cas "changement de type après avoir
configuré un Blind Test" (voir Risques ci-dessous).

## Risques restants
- **Reconnexion à une question déjà en révélation** (`server/index.js`
  ~L.1281-1298, identifié par la validation du plan) : un reconnectant
  tardif peut voir/entendre le son facultatif redémarrer brièvement sans
  `timer:end` pour l'arrêter, sauf pour le type "reveal". Bug préexistant
  sur Blind Test, mécaniquement étendu ici — non corrigé (hors périmètre).
- **UX changement de type** (identifié par la validation du plan) : passer
  d'un type "blindtest" configuré à un autre type garde automatiquement
  l'ancien extrait comme son facultatif, sans confirmation du créateur —
  assumé tel quel (voir Plan), à revoir si gênant en usage réel.
- Politique autoplay navigateur : `.play()` peut être bloqué côté joueur
  sans qu'il n'existe de mécanisme de déblocage dédié (contrairement à
  Blind Test) — assumé/documenté, même compromis que `revealAudioPlayer`.

## Statut
`en review`
