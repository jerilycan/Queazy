# [023] Aperçu jouable d'une question de la banque (page admin)

## Contexte
Suite directe de la tâche 022 (modération de `bank_questions`). L'admin
voit désormais le prompt, les métadonnées et les images d'une question en
attente, mais pas comment elle se comporte réellement en jeu (chrono,
tuiles, révélation...). Décision validée avec l'utilisateur : l'aperçu doit
**rejouer la vraie question** via le moteur de jeu existant (pas une
reconstruction visuelle séparée par type) — l'admin la joue lui-même en
solo, exactement comme un vrai joueur.

## Objectif
Un bouton "Aperçu" sur chaque ligne de `admin-bank.html` ouvre un nouvel
onglet qui : crée une salle solo (mode "Présenter"), charge UNIQUEMENT
cette question comme mini-quiz à une question, la lance automatiquement, et
laisse l'admin y jouer normalement (répondre, voir le chrono, la
révélation, le score) — sans qu'il ait à naviguer le salon d'attente ou
sélectionner un quiz manuellement.

## Périmètre
- `client/public/js/admin-bank.js`/`admin-bank.html` : bouton "Aperçu" par
  ligne, ouvre `/?previewBankQuestion=<id>` dans un nouvel onglet
  (`window.open(..., '_blank')`).
- `client/public/js/index.js` : nouveau bloc d'initialisation déclenché
  UNIQUEMENT par la présence du paramètre `previewBankQuestion` dans l'URL
  (aucun effet sur le chargement normal de la page, aucun changement de
  comportement pour `?create=true`/`?play=true`/`?join=true` existants) :
  1. Vérifie la session (redirige vers `/login.html` sinon, même garde que
     `autoCreate`).
  2. Récupère la question via
     `supabaseClient.from('bank_questions').select('question').eq('id', id).single()`
     — la RLS (tâche 022) filtre déjà naturellement : un non-admin qui
     tenterait de prévisualiser une question `pending` d'un autre auteur
     obtient un résultat vide/une erreur RLS, aucune vérification
     supplémentaire à coder ici.
  3. Construit `loadedQuiz = { id: 'bank-preview-<id>', title: 'Aperçu — banque de questions', questions: [<question récupérée>] }`
     (même forme que ce que produit déjà `loadQuizById()` pour un quiz
     normal — aucune nouvelle structure).
  4. Crée automatiquement une salle (mode `'present'`, réutilise
     `createRoom()`), se marque prêt, lance automatiquement la question
     (équivalent d'un clic sur "LANCER") — étudier précisément
     `computeAllReady`/le flux `player:ready` côté `server/index.js` et
     `startQuizBtn.onclick` côté `index.js` avant d'écrire quoi que ce
     soit, ne pas deviner la mécanique exacte du "prêt".

## Hors périmètre
- Rendu séparé/statique par type de question (explicitement écarté par
  l'utilisateur — voir Contexte).
- Nettoyage particulier de la salle après l'aperçu — le mécanisme existant
  de salles abandonnées (`sweepAbandonedRooms`, `server/index.js`) suffit
  déjà, rien de spécifique à ajouter.
- Modifier `server/index.js` — cette tâche ne devrait avoir besoin d'aucun
  changement serveur (la salle "aperçu" est une salle `present` normale
  aux yeux du serveur) ; si l'exploration prouve le contraire, s'arrêter et
  demander confirmation avant de toucher au serveur (voir CLAUDE.md).
- Bouton "Aperçu" pour les questions déjà approuvées/rejetées (uniquement
  les questions `pending` listées sur la page pour l'instant).

## Fichiers concernés
- `client/public/js/admin-bank.js` — nouveau bouton par ligne.
- `client/public/admin-bank.html` — rien a priori (le bouton est injecté en
  JS comme les autres actions), à confirmer en plan.
- `client/public/js/index.js` — nouveau bloc d'init conditionnel au
  paramètre `previewBankQuestion` (chercher où `autoCreate`/les autres
  paramètres de query string sont déjà lus, probablement même zone que
  `resetUI()`/`createRoom()`).

## Plan

### Constats d'exploration (avant d'écrire quoi que ce soit)

- **Query params existants** (`client/public/js/index.js` ligne 243-256) :
  `autoCreate`/`autoJoin`/`autoPlay`/`preQuizId` sont lus juste après
  `const params = new URLSearchParams(location.search)`, puis consommés dans
  le premier bloc `;(async () => { await checkAuth() ... })()` (lignes
  282-310). Ce bloc est asynchrone (`await checkAuth()`) : son corps ne
  s'exécute qu'après un tour de microtâche, donc APRÈS que tout le reste du
  script synchrone (dont `createRoom`, `loadQuizById`, `startQuizBtn.onclick`,
  définis plus bas dans le fichier) ait fini de s'évaluer. C'est pour ça que
  ce bloc peut déjà référencer ces fonctions/consts alors qu'elles sont
  déclarées après lui dans le fichier — le nouveau bloc `previewBankQuestion`
  peut utiliser exactement le même principe (IIFE async placée juste après ce
  premier bloc, sans rien avancer/réordonner dans le fichier).
- **`createRoom()`** (ligne 3488) : `socket.emit('room:create', { token, mode })`
  — rien d'autre, aucune garde de session (les appelants la font eux-mêmes,
  ex. `createBtn.onclick` ligne 3492-3499 via `getSession()` direct).
- **`loadQuizById(id)`** (ligne 3659-3752) : construit
  `loadedQuiz = { id: data.id, title, questions: norm }` avec `norm` une
  normalisation complète (fallback sur `timerMs`, `correct`, `options`,
  `zones`, `hints`, champs de révélation...). `generateAutoQuiz()` (mode
  "Jouer", ligne 4046-4115), lui, construit `loadedQuiz` directement depuis
  `bank_questions.question` SANS repasser par cette normalisation complète :
  `questions: shuffled.map((r, i) => ({ ...r.question, id: r.question?.id ||
  ('q' + (i + 1)), type: r.type, category: r.category }))` — donc le blob
  `question` stocké en banque est déjà directement jouable tel quel (il vient
  de `questions[activeIndex]` dans l'éditeur via `addToBankBtn.onclick`,
  `client/public/js/editor.js` ligne 5038-5065, jamais retouché depuis).
  **Décision retenue** : suivre le même pattern que `generateAutoQuiz` (pas
  celui de `loadQuizById`, qui est fait pour un quiz complet venant de
  `quizzes`, une autre table/un autre format de stockage) — fallback d'id
  identique, pas de re-normalisation inutile.
- **Mécanisme "prêt" — la question posée dans le fichier de tâche** :
  - `server/index.js` ligne 397 : `activePlayers = players => [...].filter(p
    => p.id !== room.hostId && p.token !== room.hostToken && p.connected !==
    false)` — **l'hôte est explicitement EXCLU du calcul de "prêt"**.
  - Ligne 399 : `computeAllReady = room => activePlayers(room).every(p =>
    !!p.ready)` — sur un tableau VIDE (salle solo, aucun joueur hors l'hôte),
    `.every()` renvoie `true` par définition JS. **Une salle solo est donc
    déjà "prête" dès sa création, sans que l'hôte n'ait besoin d'un
    quelconque statut `ready` particulier.**
  - Ligne 1521 (`question:show` côté serveur) : bloque uniquement si
    `room.history.length === 0 && !computeAllReady(room)` — pour une salle
    fraîchement créée sans autre joueur, cette condition est déjà fausse dès
    le départ.
  - Côté client, `room:created` (ligne 4117-4204) émet de toute façon déjà
    `socket.emit('player:ready', { roomCode, ready: true })` à la ligne 4203
    pour TOUT hôte (présent avant cette tâche, comportement inchangé) — donc
    aucune émission supplémentaire à ajouter pour ce point précis.
  - Concrètement le seul obstacle client à un lancement immédiat est visuel :
    `startQuizBtn` peut porter la classe `is-disabled`, posée uniquement par
    le handler `lobby:readyStatus` (ligne 5342-5366) selon `!allReady ||
    !hasPlayers` (`hasPlayers` compte les `.player-tile` du DOM, qui INCLUT
    la tuile de l'hôte lui-même — voir `renderLobbyGrid`, ligne 4883+). Dans
    `index.html` (ligne 693), `#startQuiz` n'a PAS `is-disabled` par défaut
    au chargement de la page. Donc dans l'ordre normal (`room:created` →
    lobby:list rendant la tuile hôte → lobby:readyStatus avec `allReady:
    true`), le bouton n'est jamais réellement bloquant pour une salle solo —
    mais pour rester robuste si ce timing changeait un jour, le nouveau bloc
    vérifie l'état de la classe et, si jamais elle est posée, attend un
    `lobby:readyStatus` avant de relancer l'essai, plutôt que de supposer
    l'absence de la classe.
- **`startQuizBtn.onclick`** (ligne 5840-5923) : vérifie `is-disabled` (sinon
  message d'erreur), régénère un quiz auto si `roomMode === 'auto'`, vérifie
  `loadedQuiz`, masque les boutons de config, affiche "Suivant", puis appelle
  `emitQuestion(0)`. **Le nouveau bloc doit appeler cette fonction TELLE
  QUELLE** (`startQuizBtn.onclick()`) une fois `loadedQuiz` posé et la salle
  créée — jamais de réimplémentation séparée du flux de lancement.
- **`admin-bank.js` — `renderPending`** (ligne 136-197) : chaque ligne `<tr>`
  a une dernière cellule `actionsTd` où `approveBtn`/`rejectBtn` sont
  `appendChild`és (lignes 179-194). Le bouton "Aperçu" s'insère au même
  endroit, avant `approveBtn` (ordre de lecture naturel : voir avant de
  juger), même style de création (`document.createElement('button')` +
  classe `.btn`).

### Étapes

1. `client/public/js/admin-bank.js` — dans `renderPending`, créer
   `previewBtn` (bouton `.btn` neutre, texte "Aperçu"), `onclick =>
   window.open('/?previewBankQuestion=' + row.id, '_blank')`, inséré dans
   `actionsTd` avant `approveBtn`.
2. `client/public/js/index.js` — nouveau bloc IIFE async juste après le
   premier bloc `;(async () => { await checkAuth() ... })()` (donc après la
   ligne 310, avant `const qDiv = ...`), guardé par
   `const previewBankQuestionId = params.get('previewBankQuestion')` :
   a. Vérifie la session via `window.supabaseClient.auth.getSession()`,
      redirige vers `/login.html?reason=create` si absente (même pattern que
      `createBtn.onclick`/`navCreate.onclick`).
   b. `supabaseClient.from('bank_questions').select('question').eq('id',
      previewBankQuestionId).single()` — si erreur/donnée absente (RLS ou id
      invalide), toast d'erreur (`showAnnounce`) et on s'arrête là (pas de
      salle créée pour rien).
   c. `resetUI()` (remet `loadedQuiz` à `null` proprement, même geste que la
      branche `autoCreate`) puis construit `loadedQuiz = { id:
      'bank-preview-' + previewBankQuestionId, title: 'Aperçu — banque de
      questions', questions: [{ ...data.question, id: data.question.id ||
      'q1' }] }` (fallback d'id, même pattern que `generateAutoQuiz`).
   d. `createRoom('present')`, puis `socket.once('room:created', ...)` :
      tente `startQuizBtn.onclick()` si le bouton n'est pas `is-disabled`,
      sinon réessaie au prochain `lobby:readyStatus` (garde défensive, cf.
      constat ci-dessus — ne devrait normalement jamais être nécessaire pour
      une salle solo).
3. Vérification en direct (voir section Checks) + `node --check` sur les
   deux fichiers modifiés.

### Écart volontaire par rapport à la lettre du fichier de tâche

Le fichier de tâche dit "se marque prêt" comme étape distincte — l'exploration
montre que c'est déjà fait pour TOUT hôte dans le handler `room:created`
existant (ligne 4203, `socket.emit('player:ready', { roomCode, ready: true
})`, code déjà en place avant cette tâche) et que ce n'est de toute façon pas
le facteur bloquant pour une salle solo (voir constat "prêt" ci-dessus). Le
nouveau bloc n'émet donc PAS de `player:ready` supplémentaire — il se contente
d'attendre que `startQuizBtn` ne soit plus `is-disabled` avant de cliquer,
principe plus robuste (attend un état réel plutôt que de supposer un délai).

## Étapes réalisées

1. **`client/public/js/admin-bank.js`** — bouton "Aperçu" ajouté dans
   `renderPending`, juste avant `approveBtn` dans `actionsTd` : `.btn h-36
   px-12 font-13`, `onclick = () => window.open('/?previewBankQuestion=' +
   row.id, '_blank')`.
2. **`client/public/js/index.js`** — nouveau bloc `previewBankQuestionId`
   ajouté juste après le premier bloc `;(async () => { await checkAuth()
   ... })()` (avant `const qDiv = ...`) : garde de session
   (`getSession()`/redirection `/login.html?reason=create`), requête
   `bank_questions.select('question').eq('id', ...).single()`, `resetUI()`
   puis construction de `loadedQuiz` (même pattern que `generateAutoQuiz`,
   fallback d'id `q1`), `createRoom('present')`, puis au `room:created` :
   lancement automatique.
3. **Écart pris par rapport au plan initial, découvert en vérification
   live** (détail dans "Risques restants" et "Checks effectués") :
   `startQuizBtn.onclick` a été refactoré — son corps (après la garde
   `is-disabled`) a été extrait dans une nouvelle fonction `launchQuiz()`
   (juste au-dessus de `startQuizBtn.onclick`, ligne ~5928), appelée par
   `startQuizBtn.onclick` après sa garde ET directement par le bloc
   `previewBankQuestionId` (avec `inActiveGame = true` posé juste avant,
   voir raison ci-dessous). Aucun autre comportement du bouton "LANCER"
   n'a changé.

## Écarts pris par rapport au plan (avec raison)

- **Le bouton "LANCER" n'a PAS été cliqué/déclenché via
  `startQuizBtn.onclick()`**, contrairement à ce que prévoyait le plan
  initial. Découverte en vérification live (pas visible à la seule lecture
  du code, voir Constats du Plan) : `renderLobbyGrid` (déclenché par
  `lobby:list`, lui-même émis par le `room:join` que le handler
  `room:created` existant émet automatiquement) pose EXPLICITEMENT
  `startQuizBtn.classList.add('is-disabled')` dès que `playerCount` (joueurs
  NON-hôte) vaut 0 — ligne ~4978-4987 de `index.js` — indépendamment de
  `computeAllReady` côté serveur (qui, lui, ignore bien l'hôte et considère
  une salle solo comme "prête", comme prévu dans le Plan). Une salle
  d'aperçu n'aura JAMAIS de second joueur : le bouton serait donc resté
  grisé pour toujours, avec le message "Il faut au moins un joueur pour
  lancer le quiz !" à chaque tentative. **Correctif** : extraction de
  `launchQuiz()` (voir ci-dessus), appelée directement par le bloc
  d'aperçu — cette garde UX (pensée pour empêcher une VRAIE partie
  multijoueur de démarrer sans joueur) ne s'applique pas à ce contexte
  solo. `startQuizBtn.onclick` lui-même est inchangé dans son comportement
  observable (la garde `is-disabled` s'applique toujours normalement au
  clic humain).
- **`inActiveGame = true` posé manuellement juste avant `launchQuiz()`**
  dans le bloc d'aperçu, plutôt que de laisser ce flag à sa valeur par
  défaut (`false`) jusqu'au `question:show` réel. Découverte en
  vérification live : entre `room:created` et `question:show` (pendant la
  phase d'intro "tuto"), un ou plusieurs `lobby:list` supplémentaires
  arrivent (déclenchés par le `room:join` émis juste avant) — et
  `renderLobbyGrid` réaffiche `startQuizBtn`/`selectQuizBtn` à CHAQUE
  `lobby:list` tant que `inActiveGame` est encore `false` (bloc "Reset
  buttons visibility when entering lobby as host"). En jeu normal, ce
  bloc n'a aucun effet visible car l'hôte clique "LANCER" bien après que ce
  `lobby:list` initial soit déjà réglé ; ici, `launchQuiz()` est déclenché
  immédiatement après `room:created`, en pleine fenêtre de course. Poser
  `inActiveGame = true` juste avant (exactement ce que `question:show` va
  de toute façon faire une poignée d'instants plus tard, geste idempotent)
  neutralise cette course sans toucher au flag ailleurs dans le fichier.

## Checks effectués
- [x] `node --check client/public/js/index.js` → OK
- [x] `node --check client/public/js/admin-bank.js` → OK
- [x] Chargement normal de la page (`http://localhost:3000/`, SANS
      `previewBankQuestion`) observé en direct via le Browser pane :
      écran "C'est l'heure du quiz !" identique à avant, aucune erreur
      console liée au nouveau bloc, aucune régression visible.
- [x] Garde de session du bloc d'aperçu vérifiée en direct : navigation
      vers `http://localhost:3000/?previewBankQuestion=<uuid factice>`
      SANS session → redirection effective vers `/login.html` (écran
      "Connexion" observé).
- [x] Plomberie du flux de lancement vérifiée en direct (voir limite
      ci-dessous) : `resetUi()` → `loadedQuiz` construit (forme identique à
      celle du bloc réel) → `createRoom('present')` → `room:created` reçu →
      `launchQuiz()` appelé → `question:show` reçu côté socket avec le bon
      `type`/`prompt` → capture d'écran confirmant l'affichage réel de la
      question (badge de type, chrono, "Contrôles de l'hôte" propre — plus
      aucune trace de "Sélectionner un Quiz"/"LANCER" après le correctif
      `inActiveGame`). Reproduit 3 fois (types `truefalse`, `mcq`, `free`)
      avec des résultats identiques.
- [ ] Non vérifié avec un VRAI compte admin (voir Limite ci-dessous).

### Limite de vérification (accès admin réel non testable)
Les identifiants réels étant interdits par la politique de sécurité, le
bloc `previewBankQuestionId` n'a PAS pu être traversé littéralement de bout
en bout (sa garde de session redirige légitimement un visiteur anonyme). La
vérification live a donc porté sur :
1. **La garde de session elle-même** (redirection effective observée).
2. **La plomberie exacte** que ce bloc exécute une fois la session/la
   requête `bank_questions` validées (construction de `loadedQuiz`,
   `createRoom`, mécanisme "prêt", `launchQuiz`) — rejouée à l'identique
   depuis la console du navigateur réel, sur le VRAI serveur local, avec le
   VRAI code chargé (pas une simulation isolée) : seule la partie
   `getSession()`/`select('question')` a été court-circuitée par une valeur
   construite à la main, tout le reste (le code exécuté ensuite) est le
   code réel du fichier.
Le bouton "Aperçu" de `admin-bank.js` n'a pas pu être testé au clic dans
une vraie page admin (accès gaté par `bank_admins`, nécessite un compte
admin réel) — sa correction a été vérifiée par relecture (même pattern
exact que `approveBtn`/`rejectBtn` juste à côté) et par un test DOM isolé
reproduisant fidèlement son bloc de création. Un test manuel avec un vrai
compte admin (voir "Tests manuels recommandés") reste nécessaire pour la
confirmation finale bout-en-bout.

## Checks effectués
- [ ] `node --check` sur chaque fichier JS modifié
- [ ] Vérification EN DIRECT du flux complet (création de salle, chargement
      du mini-quiz à une question, lancement automatique, affichage réel de
      la question) via la technique établie de pilotage socket brut
      (voir mémoire "gif-demo-technique" — ne pas se contenter d'un
      `node --check`, ce flux touche `index.js`, code partagé par tous les
      visiteurs du site)
- [ ] Confirmation qu'aucune régression n'affecte le chargement normal de
      la page (sans `previewBankQuestion` dans l'URL)

## Tests manuels recommandés
Depuis `/admin-bank.html` avec un vrai compte admin : cliquer "Aperçu" sur
une question `pending`, vérifier l'ouverture d'un nouvel onglet, le
lancement automatique de la question, pouvoir y répondre normalement.

## Risques restants
- Non testé avec un vrai compte admin — voir "Limite de vérification"
  ci-dessus. À faire avant de considérer la tâche définitivement close.
- `launchQuiz()` (nouvelle fonction extraite) est maintenant appelée depuis
  DEUX points d'entrée (`startQuizBtn.onclick` et le bloc d'aperçu) — toute
  future modification du flux de lancement (ex. tâche future sur le mode
  "Jouer"/auto-quiz) impactera aussi l'aperçu ; à garder en tête, mais
  comportement volontaire (c'est justement le but de l'extraction : ne
  jamais avoir deux flux de lancement qui divergent).
- Si `bank_questions.question` contient un jour un champ `id` en conflit
  avec un autre usage (aucun cas identifié aujourd'hui), le fallback
  `'q1'` est codé en dur ; sans impact connu à ce jour (une seule question
  par salle d'aperçu, jamais plusieurs `id` à distinguer).
- Salle d'aperçu jamais nettoyée explicitement (hors périmètre assumé,
  voir fichier de tâche — `sweepAbandonedRooms` suffit).

## Statut
`en review`
