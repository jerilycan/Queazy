# [021] Nouvelle navbar (Jouer / Présenter / Rejoindre) + mode de jeu automatique "Jouer"

## Contexte
Demande utilisateur : distinguer clairement deux usages de QuEazy — jouer
entre amis sans préparer de contenu (nouveau) vs présenter un quiz préparé
en tant que MJ (existant, à préserver tel quel). La navbar actuelle
(`Créer`/`Rejoindre`) ne reflète que l'action technique, pas l'intention.
Décidé avec l'utilisateur (voir échange de cadrage) : la banque de
questions du mode "Jouer" vit dans une table Supabase DÉDIÉE et curatée
(pas une agrégation des quiz publics existants) — c'est la seule étape qui
touche `supabase/schema.sql`, migration additive déjà validée par
l'utilisateur, détaillée ci-dessous.

Architecture existante (analyse faite avant cadrage, à ne pas
redécouvrir) :
- Le serveur (`server/index.js`) n'a AUCUNE notion de "quiz" : l'objet
  `room` (en mémoire, jamais persistant) ne connaît que la question EN
  COURS, diffusée une par une par l'hôte (`question:show`). Toute la
  progression d'un quiz (liste de questions, index courant) vit
  entièrement CÔTÉ CLIENT HÔTE, dans une variable globale
  `loadedQuiz = {id, title, questions:[...]}` + `quizIndex`
  (`client/public/js/index.js`).
- La sélection de quiz actuelle (popup "Sélectionner un Quiz" dans
  `#hostPanel`, voir `loadQuizById()`) ne fait qu'alimenter cette même
  variable `loadedQuiz` — le moteur de partie qui la consomme ensuite
  (`nextQuestion`, `emitQuestionShow`, etc.) ignore totalement d'où
  viennent les questions. **Conséquence directe pour cette tâche** :
  générer un `loadedQuiz` "maison" (titre "Quiz aléatoire", questions
  piochées dans la banque) suffit à réutiliser 100% du moteur de partie
  existant, sans y toucher.
- Un préchargement de quiz par query param existe déjà (`?quiz=<id>`,
  utilisé par l'onglet "Quiz publics" de `select.html`) — patron à
  réutiliser pour `?play=true`/`?present=true`.
- Les réglages de salle éphémères déjà diffusés à toute la salle
  (`room.speedLevel` via `game:setSpeedLevel`, `room.gameMode` via
  `game:setMode`) sont le patron à suivre pour `room.mode` et la config du
  quiz auto — mêmes conventions, pas de nouveau système parallèle.
- Aucune notion de catégorie/difficulté n'existe nulle part aujourd'hui
  (ni dans `quizzes.questions` jsonb, ni dans l'éditeur).

## Objectif
1. Navbar : remplacer `Créer`/`Rejoindre` par `🎮 Jouer` / `🎤 Présenter` /
   `🔗 Rejoindre`, exprimant l'intention plutôt que l'action technique.
2. Parcours "Présenter" : strictement le comportement actuel de "Créer"
   (créer salle → lobby → sélection manuelle d'un quiz → présentation) —
   zéro régression.
3. Parcours "Jouer" : créer salle → lobby → **configuration d'un quiz
   automatique** (à la place de la sélection manuelle) → partie. L'hôte
   peut lancer immédiatement avec les valeurs par défaut, ou personnaliser
   catégories/types/difficulté/nombre de questions avant de lancer.
4. Nouvelle table Supabase `bank_questions` (banque curatée, migration
   additive) + moyen de la peupler depuis l'éditeur existant (tag
   catégorie/difficulté sur une question + action "Ajouter à la banque").
5. "Rejoindre" reste un accès direct indépendant, inchangé.

## Périmètre
- **Navbar** (`client/public/index.html` + les pages qui la dupliquent —
  `select.html`, `login.html`, `profile.html`, `editor.html`, `result.html`
  si elles ont leur propre copie de la navbar, à vérifier) : 3 boutons
  d'intention. `Jouer` et `Présenter` déclenchent tous les deux
  `createRoom()` (existant), avec un flag de mode différent transmis au
  serveur à la création (voir plus bas) — pas deux implémentations
  parallèles de la création de salle.
- **`room.mode`** (`server/index.js`, `socket.on('room:create')`) :
  nouveau champ sur l'objet `room` EN MÉMOIRE, valeur `'present'`
  (défaut, comportement actuel si le champ est absent — rétrocompatible)
  ou `'auto'`. Même famille que `room.speedLevel`/`room.gameMode` déjà en
  place — diffusé à la salle via un événement dédié léger (nouveau,
  mais sur le modèle de `game:setSpeedLevel`/`game:setMode`), jamais
  persisté en base.
- **Config du quiz auto, éphémère sur `room`** : catégories sélectionnées,
  types sélectionnés, répartition de difficulté (`{facile, moyen,
  difficile}`, défaut `{10, 10, 0}` sur 20 questions), nombre total de
  questions. Modifiable par l'hôte SEULEMENT tant que la partie n'a pas
  démarré ; diffusée en lecture seule aux autres joueurs du lobby (mêmes
  conventions que `lobby:list`/`team:list`).
- **Lobby, panneau hôte** (`#hostPanel`, `client/public/index.html`
  autour de la ligne 655) : si `room.mode==='auto'`, remplacer le bouton
  "Sélectionner un Quiz" par un panneau de configuration (catégories à
  cocher, types à cocher — réutiliser `QUESTION_TYPE_META` existant pour
  la liste des 17 types, curseurs/inputs pour la répartition de difficulté
  et le nombre total). Le reste du panneau hôte (joueurs connectés,
  partage du code, bouton "LANCER") ne change pas.
- **Génération du quiz au lancement** (`client/public/js/index.js`, côté
  hôte, au clic sur "LANCER" quand `room.mode==='auto'`) : interroger
  `bank_questions` (Supabase, lecture publique) filtrée par
  catégories/types/difficultés choisis, tirer aléatoirement le bon nombre
  par palier de difficulté, dédupliquer, MÉLANGER L'ORDRE (jamais
  facile×10 puis moyen×10 d'affilée), construire un `loadedQuiz` de la
  même forme que `loadQuizById()` produit déjà, puis démarrer exactement
  comme le flux existant (aucune nouvelle fonction de progression).
- **Affichage du thème avant la question** : un badge catégorie au-dessus
  du prompt (ex. "🎬 CINÉMA"), réutilisant le même langage visuel que le
  badge de type déjà existant (`.question-type-badge`) — jamais annoncé à
  l'avance pour la question suivante.
- **Éditeur** (`client/public/editor.html` + `editor.js`) : deux nouveaux
  champs par question (`category` texte libre ou liste suggérée,
  `difficulty` facile/moyen/difficile) + un bouton "Ajouter à la banque"
  qui upsert une copie de la question (son `type` + son payload complet +
  ces deux tags) dans `bank_questions`. Nécessite d'être connecté et
  d'avoir rempli catégorie + difficulté avant de pouvoir publier.
- **Nouvelle table Supabase** (`supabase/schema.sql`, migration ADDITIVE
  uniquement — aucune table existante modifiée), déjà validée avec
  l'utilisateur :
  ```sql
  create table if not exists public.bank_questions (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    difficulty text not null check (difficulty in ('facile','moyen','difficile')),
    type text not null,
    question jsonb not null,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
  );
  alter table public.bank_questions enable row level security;
  create policy "bank_questions: lecture publique" on public.bank_questions
    for select using (true);
  create policy "bank_questions: ajout par un utilisateur connecte" on public.bank_questions
    for insert with check (auth.uid() = created_by);
  create index if not exists bank_questions_category_idx on public.bank_questions (category);
  create index if not exists bank_questions_difficulty_idx on public.bank_questions (difficulty);
  create index if not exists bank_questions_type_idx on public.bank_questions (type);
  ```
  `question jsonb` reprend EXACTEMENT la forme d'une question dans
  `quizzes.questions[i]` (même normalisation que `loadQuizById`), pour
  réutiliser tout le rendu/scoring existant sans traitement spécial par
  type.
- **Peuplement initial de la banque** : la banque sera vide au départ tant
  que personne n'a publié de question depuis l'éditeur — préciser
  clairement dans le lobby "Jouer" si la banque ne contient pas assez de
  questions pour les critères choisis (message d'erreur explicite au
  lancement plutôt qu'une partie à 3 questions sans prévenir), plutôt que
  de bloquer l'accès au mode.

## Hors périmètre
- Agrégation des quiz publics existants dans la banque — écarté avec
  l'utilisateur au profit d'une banque dédiée.
- Interface d'administration/modération de `bank_questions` (signalement,
  suppression par un tiers) — hors demande initiale, à cadrer séparément
  si besoin une fois le mode en usage réel.
- Modification du parcours "Présenter"/de la sélection manuelle de quiz
  au-delà du renommage du point d'entrée navbar — doit rester identique.
- Nouveaux types de question, nouvelles catégories imposées par défaut
  (une liste de catégories suggérées peut exister côté éditeur, mais
  aucune n'est "en dur" obligatoire) — réutiliser l'existant.
- `render.yaml` — aucune raison d'y toucher ici.
- Authentification/consentement pour publier dans la banque au-delà de ce
  qui existe déjà (`auth.uid()`) — pas de nouveau système de modération de
  compte.

## Fichiers concernés
- `client/public/index.html` — navbar (3 boutons), `#hostPanel` (panneau
  config auto en plus du panneau sélection quiz existant), badge
  catégorie avant la question.
- `client/public/select.html`, `login.html`, `profile.html`,
  `editor.html`, `result.html` — navbar dupliquée à vérifier/mettre à
  jour si elle diffère d'une page à l'autre.
- `client/public/js/index.js` — `params`/`autoCreate`/`autoJoin` (nouveau
  cas `?play=true`), `createRoom()` (flag de mode à transmettre),
  affichage conditionnel du panneau hôte selon `room.mode`, génération du
  `loadedQuiz` auto au clic "LANCER", badge catégorie.
- `client/public/js/editor.js` + `editor.html` — champs
  catégorie/difficulté par question, action "Ajouter à la banque".
- `server/index.js` — `room.mode` sur l'objet room (`socket.on('room:create')`),
  nouvel événement de diffusion de la config auto à la salle (mêmes
  conventions que `game:setSpeedLevel`/`game:setMode`).
- `supabase/schema.sql` — migration additive `bank_questions` (détaillée
  ci-dessus, déjà validée).
- `client/public/css/style.css` — styles du panneau de config auto, badge
  catégorie (réutiliser au maximum les tokens/patrons existants).

## Plan
*(rédigé en `/plan-feature`, étapes pensées pour être relues une par une)*

1. **`supabase/schema.sql`** — ajouter le bloc `bank_questions` fourni dans
   Contexte (verbatim), en fin de fichier. Additive uniquement. **Jamais
   exécutée par l'agent** — juste ajoutée au fichier suivi par git ; à
   appliquer manuellement par l'utilisateur dans le Dashboard Supabase.

2. **`server/index.js` — `room.mode` + `room.autoConfig` (mémoire uniquement)**
   - `socket.on('room:create')` : lire `payload?.mode === 'auto' ? 'auto' :
     'present'`, stocker `room.mode`. Ajouter `room.autoConfig` avec les
     valeurs par défaut actées (`categories: []` = toutes, `types: []` =
     tous, `difficulty: {facile:10, moyen:10, difficile:0}`, `count: 20`) —
     tableau vide = "pas de filtre", pour ne pas dupliquer la liste des 17
     types/catégories côté serveur.
   - Inclure `mode`/`autoConfig` dans la réponse `room:created` (évite un
     aller-retour supplémentaire juste après la création, contrairement à
     `speedLevel`/`gameMode` qui n'ont pas besoin d'être connus immédiatement
     par le créateur puisqu'il en connaît déjà la valeur par défaut).
   - Nouvel événement `room:setAutoConfig` (hôte uniquement, verrouillé dès
     `gameStarted(room)`, même garde que `game:setSpeedLevel`) : remplace
     `room.autoConfig` par le payload reçu (validé a minima : types/tableaux,
     nombres positifs) puis rediffuse `io.to(code).emit('room:autoConfig',
     room.autoConfig)`.
   - `room:join` : rejoue `room:mode`/`room:autoConfig` au socket qui
     rejoint, même patron que `game:speedLevel`/`game:mode` juste en dessous
     dans le fichier — pour qu'un joueur qui rejoint après coup voie la
     config déjà choisie (lecture seule côté client, imposée par l'UI, pas
     par le serveur — même confiance qu'ailleurs dans ce fichier).
   - Trade-off : pas de nouvel événement `room:setMode` — le mode se fixe
     une fois pour toutes à la création (le choix navbar Jouer/Présenter),
     jamais changé en cours de lobby, donc pas besoin d'un setter dédié
     après coup, contrairement à `autoConfig` qui doit rester réglable par
     l'hôte avant lancement.

3. **Navbar (3 boutons) — `index.html`, `select.html`, `profile.html`,
   `editor.html`** (les 4 pages qui dupliquent `#navCreate`/`#navJoin`;
   `login.html`/`result.html` n'ont pas ce bloc, non touchées) :
   - Remplacer `<a href="/?create=true" id="navCreate">Créer</a>` par deux
     boutons : `🎮 Jouer` (`id="navPlay"`, `href="/?play=true"`) placé avant,
     puis `🎤 Présenter` (`id="navCreate"` conservé — pas de renommage d'id
     pour ne pas casser les handlers déjà branchés dans
     select.js/profile.js/editor.js/index.js, seul le libellé/l'icône
     changent), `href="/?create=true"` inchangé.
   - `🔗 Rejoindre` (`id="navJoin"`) inchangé à part le préfixe emoji.
   - `index.js` : ajouter `const navPlay = document.getElementById('navPlay')`
     et un `navPlay.onclick` calqué sur `navCreate.onclick` (vérifie la
     session, sinon redirige `/login.html?reason=create`) mais appelle
     `createRoom('auto')` au lieu de `createRoom()`.
   - `select.js`/`profile.js`/`editor.js` : dupliquer le bloc
     `canCreate`/`navCreateEl.classList.toggle('is-disabled', ...)` existant
     pour `navPlayEl` (même garde, même redirection si non connecté) — même
     duplication que celle déjà en place pour `navCreate` dans ces 3
     fichiers (pas de nouvelle abstraction pour 4 points d'usage qui
     déviaient déjà chacun légèrement avant cette tâche).

4. **`index.js` — query params + `createRoom(mode)`**
   - `createRoom = (mode = 'present') => socket.emit('room:create', {
     token: getToken(), mode })`.
   - `params.get('play')` (`autoPlay`) : même branche que `autoCreate`
     actuel mais SANS `loadQuizById(preQuizId)` (le mode auto ne précharge
     jamais un quiz manuel) — `createRoom('auto')`.
   - `createBtn.onclick`/`navCreate.onclick` continuent d'appeler
     `createRoom()` (donc mode `'present'` par défaut) — comportement
     identique à aujourd'hui, zéro régression.

5. **`index.js`/`index.html` — panneau hôte conditionnel selon `room.mode`**
   - Nouvelle variable module `roomMode = 'present'`, mise à jour dans
     `socket.on('room:created', ...)` (lit `mode`/`autoConfig` reçus) et
     réinitialisée dans `resetUI()`.
   - Nouveau bloc HTML `#hostAutoPanel` (card, juste après `#hostPanel` dans
     `index.html`) : cases à cocher catégories (liste peuplée dynamiquement
     depuis les catégories DISTINCTES déjà présentes dans `bank_questions`,
     tout décoché visuellement = "toutes" ; liste vide tant que la banque
     est vide, cf. Risques), cases à cocher types (générées depuis
     `QUESTION_TYPE_META`, réutilisé tel quel — pas de nouvelle liste),
     3 inputs numériques (facile/moyen/difficile, défaut 10/10/0), 1 input
     nombre total (défaut 20, lecture seule dérivée de la somme des 3 ci-
     dessus pour éviter une incohérence à corriger à la main). Affiché/
     masqué via `roomMode === 'auto'` au même endroit que `hostPanel` est
     déjà montré/masqué (`room:created`, `resetUI`).
   - `#selectQuizBtn` masqué quand `roomMode === 'auto'` (pas de sélection
     manuelle en mode auto) ; `#hostAutoPanel` masqué quand `roomMode ===
     'present'`.
   - Changement d'un champ du panneau auto → `socket.emit('room:setAutoConfig',
     { roomCode, ...config })`, avec un debounce léger (300ms) pour éviter
     une rafale d'événements sur une saisie clavier (nombre total, inputs).
   - `socket.on('room:autoConfig', ...)` met à jour l'affichage en LECTURE
     SEULE pour les non-hôtes (mêmes inputs mais `disabled`), même patron
     que `lobby:list`.

6. **`index.js` — génération du quiz auto au clic "LANCER"**
   - Nouvelle fonction `generateAutoQuiz()` (async) : si `roomMode !==
     'auto'`, no-op (le flux `startQuiz.onclick` existant continue tel
     quel). Sinon :
     - Requête Supabase `bank_questions` filtrée par `category in (...)`
       (si des catégories sont cochées), `type in (...)` (idem), pour
       CHACUN des 3 paliers de difficulté séparément (3 requêtes, une par
       palier, avec sa propre limite demandée) plutôt qu'une requête globale
       + tri en mémoire — plus simple à garder correct si un palier manque
       de questions (message d'erreur précis "pas assez de {palier}" plutôt
       que générique).
     - Si un palier demandé (`count > 0`) renvoie moins de lignes que
       demandé : abort, `showAnnounce('Banque insuffisante : seulement N
       question(s) {palier} disponible(s) pour ces critères.', 'error')`,
       ne PAS lancer la partie (le bouton LANCER redevient cliquable).
     - Sinon : tirer aléatoirement le bon nombre par palier (`shuffleArray`
       déjà existant, réutilisé), concaténer, mélanger l'ORDRE FINAL une 2e
       fois (`shuffleArray` à nouveau sur le tableau complet, jamais pendant
       la sélection par palier — pour ne jamais biaiser vers "facile
       d'abord"), dédupliquer par `id` (Set) avant le mélange final au cas
       où une question apparaîtrait dans 2 tirages (ne devrait pas arriver
       vu les requêtes séparées par palier, filet de sécurité).
     - Construire `loadedQuiz = { id: 'auto-' + Date.now(), title: 'Quiz
       aléatoire', questions: rows.map(r => ({ ...normalisation identique à
       `loadQuizById`, category: r.category, ...r.question })) }` — même
       forme exacte que `loadQuizById` produit, pour que le reste du moteur
       (`emitQuestion`, `nextQuestion`, `isLastQuestion`...) n'ait RIEN à
       changer.
   - `startQuiz.onclick` existant : appeler `await generateAutoQuiz()`
     avant la suite de son code actuel si `roomMode === 'auto'`, abort si
     `generateAutoQuiz()` a échoué (banque insuffisante).
   - Trade-off : génération faite CÔTÉ HÔTE (comme `loadQuizById`), jamais
     côté serveur — cohérent avec "le serveur n'a aucune notion de quiz"
     (Contexte) et évite de dupliquer la logique de lecture Supabase côté
     `server/index.js`, qui n'a aujourd'hui aucun accès Supabase.

7. **Badge catégorie avant la question**
   - `emitQuestion()` (client) : ajouter `category: q.category ||
     undefined` au payload envoyé — passthrough déjà garanti côté serveur
     (le destructuring de `question:show` dans `server/index.js` ne retire
     que `correct`/`explanation`/`reponseImageUrl`/`revealImage*`, tout le
     reste — dont `category` — traverse déjà tel quel jusqu'à
     `question:show` diffusé).
   - `index.html` : nouveau `<div id="questionCategoryBadge" class="d-none">`
     juste au-dessus de `#question`, pill simple (pas de positionnement
     `fixed` comme `#questionTypeBadge` — pas besoin du même ancrage
     complexe, juste au-dessus du texte de la question dans le flux normal).
   - `index.js` : `updateQuestionCategoryBadge(payload.category)` appelée
     juste après `updateQuestionTypeBadge(payload.type)` dans
     `socket.on('question:show', ...)` — masque si `category` absent
     (parcours "Présenter", zéro régression visuelle).
   - `style.css` : classe `.question-category-badge`, réutilise les tokens
     déjà en place (`--color-accent`, mêmes radius/police que
     `.question-type-badge`) plutôt que d'inventer une nouvelle palette.

8. **Éditeur — champs catégorie/difficulté + "Ajouter à la banque"**
   - `editor.html` : dans `#questionDetail`, juste après le bloc
     `qDraftToggle`, un input texte `qCategoryInput` (avec `<datalist>`
     `qCategorySuggestions`, peuplée par les catégories déjà utilisées dans
     CE quiz + un petit set de suggestions codées en dur mais NON
     obligatoires, cf. Hors périmètre — juste des suggestions, jamais
     imposées) + un `<select id="qDifficultySelect">` (vide/facile/moyen/
     difficile, vide par défaut) + un bouton `#addToBankBtn` ("➕ Ajouter à
     la banque").
   - `editor.js` : `selectQuestion()`/`saveCurrentQuestionState()` (et le
     second point de re-rendu après suppression, ~ligne 4307) lisent/
     écrivent `q.category`/`q.difficulty` comme les autres champs déjà là
     (`q.explanation`, `q.draft`).
   - `#addToBankBtn.onclick` : vérifie session (sinon toast + retour, comme
     `saveQuizBtn`), vérifie `q.category`/`q.difficulty` remplis (sinon
     toast explicite), sauvegarde d'abord la question courante
     (`saveCurrentQuestionState()`), passe la question par
     `uploadQuestionMedia(sb, session.user.id, [q])` (réutilisation directe
     — même fonction qui uploade déjà les médias base64 au save d'un quiz
     entier, appelée ici sur un tableau à 1 élément) puis
     `sb.from('bank_questions').insert([{ category, difficulty, type: q.type,
     question: q, created_by: session.user.id }])`. Toast de confirmation/
     erreur, pas de nouvel état local (pas de "déjà publié" suivi — un ajout
     répété crée simplement une 2e ligne, accepté tel quel, cf. Hors
     périmètre modération).

9. **CSS** — uniquement des ajouts dans `client/public/css/style.css` :
   `.question-category-badge`, `#hostAutoPanel` (grille de checkboxes,
   inputs difficulté), pas de nouvelle feuille.

10. **Bump `APP_VERSION`** (`server/index.js`) en mineur (2.16.2 → 2.17.0)
    une fois 1-9 fonctionnels, mise à jour de ce fichier de suivi, commits
    par étape logique, push sur `origin dev`.

### Découpage des commits prévu
1. `supabase/schema.sql` (migration additive)
2. `server/index.js` (room.mode/autoConfig + événements)
3. Navbar 3 boutons (4 fichiers HTML + JS associés)
4. Panneau hôte auto (`index.html` + `index.js` + CSS)
5. Génération du quiz auto + badge catégorie
6. Éditeur (catégorie/difficulté + bouton banque)
7. Bump version + doc de suivi

## Étapes réalisées
- [x] Étape 1 — `supabase/schema.sql` : bloc `bank_questions` ajouté
      (verbatim, additif), commit dédié. **Jamais exécuté sur la vraie
      base** — à appliquer manuellement par l'utilisateur dans le Dashboard
      Supabase (voir Risques restants).
- [x] Étape 2 — `server/index.js` : `room.mode` (`'present'`/`'auto'`) +
      `room.autoConfig` (défauts 10/10/0, 20 questions, aucun filtre)
      ajoutés à `room:create`, inclus dans la réponse `room:created`,
      rejoués à `room:join` (`room:mode`/`room:autoConfig`, même patron que
      `game:speedLevel`/`game:mode`). Nouvel événement `room:setAutoConfig`
      (hôte uniquement, verrouillé une fois la partie lancée).
- [x] Étape 3 — Navbar 3 boutons (`🎮 Jouer` / `🎤 Présenter` / `🔗
      Rejoindre`) sur `index.html`, `select.html`, `profile.html`,
      `editor.html` (les 4 pages qui dupliquaient l'ancienne navbar 2
      boutons — `login.html`/`result.html` n'ont pas ce bloc, non
      touchées). `id="navCreate"` conservé pour "Présenter" (seul le
      libellé/l'icône changent, zéro handler cassé) ; nouveau `id="navPlay"`
      avec la même garde de connexion que "Présenter" dans
      `select.js`/`profile.js`/`editor.js` (dupliquée, même style que le
      code existant pour ces 3 fichiers).
- [x] Étape 4 — `index.js` : `createRoom(mode = 'present')`, query param
      `?play=true` (nouveau, même famille que `?create=`/`?join=`),
      `navPlay.onclick`/`navCreate.onclick`/`createBtn.onclick` mis à jour.
      `?create=true` continue de fonctionner à l'identique (mode `'present'`
      implicite) — vérifié : zéro régression du parcours "Présenter".
- [x] Étape 5 — Panneau hôte conditionnel : `#hostAutoPanel` (nouveau,
      `client/public/index.html`) affiché/masqué via `applyRoomMode()`
      selon `room.mode`, mutuellement exclusif avec `#selectQuizBtn`.
      Catégories (peuplées depuis les catégories distinctes de
      `bank_questions`), types (17, depuis `QUESTION_TYPE_META`),
      difficulté (3 inputs, défaut 10/10/0), total dérivé affiché en
      lecture seule. Changements synchronisés via `room:setAutoConfig`
      (debounce 300ms) ; non-hôtes reçoivent `room:autoConfig` en lecture
      seule (inputs `disabled`).
- [x] Étape 6 — `generateAutoQuiz()` : requêtes séparées par palier de
      difficulté sur `bank_questions`, message d'erreur précis si un palier
      est insuffisant (bloque le lancement, n'écrase pas `loadedQuiz`),
      tirage aléatoire + mélange final de l'ordre (jamais pendant la
      sélection par palier), dédoublonnage par id. `startQuiz.onclick`
      appelle `generateAutoQuiz()` avant la suite de son code existant
      quand `roomMode === 'auto'`.
- [x] Étape 7 — Badge catégorie (`#questionCategoryBadge`,
      `.question-category-badge`) : `category` ajouté au payload
      `emitQuestion()`, passthrough déjà garanti côté serveur (vérifié en
      lisant le destructuring de `question:show`), affiché/masqué à chaque
      `question:show` — masqué par défaut (quiz manuel "Présenter"), jamais
      annoncé à l'avance pour la question suivante.
- [x] Étape 8 — Éditeur (`editor.html`/`editor.js`) : champs
      `qCategoryInput` (+ `<datalist>` de suggestions dérivées des
      catégories déjà utilisées dans le quiz courant, aucune imposée),
      `qDifficultySelect`, bouton `#addToBankBtn` (vérifie session +
      catégorie/difficulté remplies + validation existante de la question,
      réutilise `uploadQuestionMedia` pour ne jamais publier de data URI,
      insert dans `bank_questions`).
- [x] Étape 9 — CSS ajoutée dans `client/public/css/style.css` uniquement
      (`.question-category-badge`, `.auto-config-check-list`,
      `.auto-config-check`, `.auto-config-num`) — pas de nouvelle feuille.
- [x] Étape 10 — `APP_VERSION` 2.16.2 → 2.17.0, ce fichier de suivi
      complété, commits par étape logique, push sur `origin dev`.

## Checks effectués
- [x] `node --check` sur `server/index.js`, `client/public/js/index.js`,
      `client/public/js/editor.js`, `client/public/js/select.js`,
      `client/public/js/profile.js` — tous OK, à chaque étape.
- [x] Démarrage serveur vérifié (`npm start` dans `server/`, port 3000,
      réponse HTTP 200, puis via `preview_start` avec la config
      `queazy-server` de `.claude/launch.json`) — aucune erreur au boot.
- [x] Vérification visuelle Browser pane : navbar 3 boutons conforme,
      simulation `room:create` par socket brut (technique de session
      documentée) confirmant `room.mode`/`autoConfig` corrects côté
      serveur pour `mode:'auto'` ET pour l'absence de `mode` (retombe sur
      `'present'`, zéro régression) ; `#hostAutoPanel` rendu correctement
      après correction d'un bug de layout trouvé pendant cette
      vérification (voir Risques restants) ; badge catégorie
      affiché/masqué correctement ; markup éditeur (`qCategoryInput`,
      `qDifficultySelect`, `addToBankBtn`) confirmé présent dans le HTML
      servi (page elle-même non testée manuellement au clic, redirige vers
      `/login.html` sans session réelle dans cet environnement).
- [ ] Migration `bank_questions` appliquée manuellement par l'utilisateur
      dans Supabase (jamais exécutée automatiquement par l'agent) — **à
      faire avant tout test réel du mode "Jouer"**.

## Tests manuels recommandés
- Appliquer la migration `bank_questions` (Dashboard Supabase > SQL
  Editor, coller le bloc en fin de `supabase/schema.sql`).
- Depuis l'éditeur, ouvrir une question existante, renseigner
  catégorie/difficulté, cliquer "Ajouter à la banque" — vérifier
  l'apparition en base (table `bank_questions`) et l'absence de data URI
  dans `question` (médias déjà uploadés vers `quiz-media`).
- Publier au moins 10 questions faciles + 10 moyennes (mêmes catégories)
  pour retrouver les valeurs par défaut du panneau "Jouer".
- Depuis la navbar, cliquer "🎮 Jouer" (connecté) → vérifier l'arrivée en
  lobby avec `#hostAutoPanel` déjà rempli par défaut, cliquer "LANCER" sans
  rien changer → partie qui démarre avec 20 questions mélangées.
- Décocher une catégorie/un type, changer la répartition de difficulté,
  vérifier que la config se synchronise chez un 2e onglet/joueur du lobby
  en LECTURE SEULE.
- Retester intégralement le parcours "🎤 Présenter" (ex-"Créer") — sélection
  manuelle d'un quiz, lancement, partie complète — pour confirmer l'absence
  de régression.
- Vider volontairement un palier de difficulté (ex. demander 5 questions
  "difficile" alors que la banque n'en contient aucune) → vérifier le
  message d'erreur explicite et l'absence de lancement de partie.

## Risques restants
- **Migration SQL non appliquée** : `bank_questions` n'existe pas encore
  sur la vraie base tant que l'utilisateur n'a pas collé le bloc de
  `supabase/schema.sql` dans le Dashboard Supabase — le mode "Jouer" est
  donc actuellement INUTILISABLE en conditions réelles (échoue proprement
  avec un message d'erreur, ne casse rien d'autre, voir generateAutoQuiz).
- **Banque vide au départ** : même après la migration, aucune question
  n'existe tant que personne n'a utilisé "Ajouter à la banque" depuis
  l'éditeur — le mode "Jouer" affichera systématiquement "banque
  insuffisante" jusqu'à un premier peuplement réel. Aucune donnée de
  départ fournie (hors périmètre, décision actée).
- **Non testé avec une vraie session utilisateur** : cet environnement de
  vérification n'a pas de compte Supabase connecté — les parcours
  "Jouer"/"Présenter" déclenchés depuis la navbar (garde `canCreate`) et le
  bouton "Ajouter à la banque" de l'éditeur n'ont été vérifiés que par
  inspection du markup + appels directs aux fonctions JS (`applyRoomMode`,
  `generateAutoQuiz`, `updateQuestionCategoryBadge`) et par simulation
  socket brute côté serveur — jamais en clic réel multi-joueurs avec la
  vraie banque peuplée.
- **Debounce `room:setAutoConfig` (300ms)** : pas de garde côté serveur
  contre un hôte qui enchaînerait des changements très rapides sur
  plusieurs onglets simultanément (cas limite non rencontré en pratique
  ailleurs dans ce fichier pour `game:setSpeedLevel`/`game:setMode`, même
  niveau de confiance appliqué ici).
- **Catégories du panneau "Jouer"** dérivées d'une requête `select
  category` sans limite sur toute la table `bank_questions` — pourrait
  devenir coûteux si la banque grossit beaucoup (des milliers de lignes) ;
  pas un problème à l'échelle actuelle (banque vide), à surveiller si le
  mode "Jouer" est massivement adopté.

## Statut
`en review`
