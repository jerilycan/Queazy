# [048] Historique des parties par quiz : score à battre, top 3, joueurs déjà passés

## Contexte
Retour d'une série de tests en prod (message utilisateur, fil de la tâche 047) :
- au lancement d'un quiz, rien n'indique le meilleur score déjà fait dessus ;
- rien ne dit à l'hôte qu'un joueur présent dans le lobby a déjà fait ce quiz
  (donc connaît les réponses) au moment de le choisir.

Aujourd'hui **rien n'enregistre les scores ni les participations** : le
serveur garde l'état d'une partie en mémoire (`rooms`, `historyEntry` dans
`server/index.js`) et le perd à la fermeture de la salle ; `supabase/schema.sql`
ne contient que `profiles`, `quizzes`, `reports`, `app_settings`,
`bank_questions`. Cette tâche demande donc une **nouvelle persistance** (donc
un changement de schéma DB, zone soumise à validation explicite par le
`CLAUDE.md`).

## Objectif
Vérifiable concrètement :
1. **Score à battre** : au début d'un quiz, un bandeau affiche le meilleur
   score jamais fait sur ce quiz (avec le pseudo ? à confirmer). **Rien
   n'est affiché** si le quiz n'a jamais été terminé.
2. **Top 3 final** : à la fin de la partie, révélation des 3 meilleurs
   scores sur ce quiz (tous temps confondus) avec leurs pseudos — la partie
   qui vient de se terminer comprise, mise en évidence si elle y figure.
3. **Déjà participé — lobby** : à la sélection d'un quiz, si un joueur
   présent dans le lobby l'a déjà fait, un avertissement s'affiche avec une
   bulle au survol : « Attention, X a déjà participé ».
4. **Déjà participé — configuration** : un bouton « Liste des joueurs ayant
   participé » dans la configuration du quiz ouvre la liste (pseudo, nombre
   de parties, meilleur score, dernière date).

## Périmètre
- Enregistrement, à la fin d'une partie (`quiz:end`), d'un résultat par
  joueur : quiz, pseudo, identité du joueur, score, date.
- Lecture : meilleur score d'un quiz, top 3, joueurs ayant participé.
- Affichage MJ (lobby/sélection, configuration) et joueurs/TV pour le top 3
  de fin (écran de résultats existant).

## Hors périmètre
- Classements globaux inter-quiz, statistiques par question, badges.
- Historique par joueur côté profil (page « mes parties »).
- Rétro-remplissage des parties passées (rien n'a été enregistré avant).
- Mode équipe (score cumulé par équipe) : à trancher en planification, par
  défaut le score individuel uniquement.

## Questions ouvertes (à trancher avant `/plan-feature`)
- **Identité d'un joueur** : les invités n'ont pas de compte (jeton généré,
  voir `rememberJoin`/`genToken` dans `index.js`). Deux options : (a) joueurs
  connectés uniquement (fiable, `auth.users`), (b) aussi les invités par
  pseudo (simple mais un pseudo n'est pas une identité : « Bob » ≠ « Bob »).
  Le warning « X a déjà participé » dépend directement de ce choix.
- **Quelles parties comptent** : toutes, ou seulement les parties terminées
  (`quiz:end`) avec au moins N joueurs / en mode « Présenter » ? Une partie
  de test seul ne devrait pas fixer le « score à battre ».
- **Quiz identifié par son id Supabase** : les quiz du mode « Jouer »
  (générés automatiquement depuis la banque) n'ont pas d'id stable — exclus ?
- **Droits de lecture** : qui peut voir la liste des joueurs ayant participé
  (propriétaire du quiz seulement, ou tout hôte qui le lance) ?

## Fichiers concernés
- `supabase/schema.sql` — **nouvelle table** (résultats de parties) + règles
  d'accès (RLS) : zone interdite sans validation explicite (`CLAUDE.md`).
- `server/index.js` — à la fin de partie (`quiz:end`), écriture des résultats
  (le serveur connaît les scores finaux) ; endpoints/évènements de lecture
  (meilleur score, top 3, participants d'un lobby).
- `client/public/js/index.js` — bandeau « score à battre » au lancement,
  warning + bulle à la sélection du quiz, bouton « liste des participants ».
- `client/public/index.html` — markup du bandeau, du warning et de la modale.
- `client/public/js/results.js` + `result.html` — révélation du top 3 à la fin.
- `client/public/css/style.css` — styles du bandeau, de la bulle, du podium.
- `client/public/js/display.js` (si le bandeau/top 3 doit être mirroré sur la
  TV) — à confirmer en planification.

## Décisions validées (utilisateur)
1. **Joueurs connectés uniquement** (compte Supabase) — les invités ne sont
   ni enregistrés ni détectés.
2. **Seules les parties terminées** (`quiz:end`) comptent.
3. **Quiz du mode « Jouer » (auto) exclus** (pas d'id stable).
4. **Liste des participants visible par le propriétaire du quiz** seulement.

## Constats du code (exploration)
- Le serveur n'utilise que la clé **anon** (`supabaseAdmin = createClient(URL,
  ANON_KEY)`, `server/index.js:27`) : aucune clé `service_role` — écrire en
  base passera par une **policy RLS**, pas par un contournement.
- L'identité joueur côté serveur est un **jeton aléatoire** (`queazy_token`,
  `genToken()`), PAS l'id Supabase : le serveur ne sait pas qui est connecté.
  Il faut que le client envoie son **JWT Supabase** à `room:join` et que le
  serveur le vérifie (`supabaseAdmin.auth.getUser(jwt)`), puis garde `userId`
  sur le joueur.
- Le serveur **ne connaît pas l'id du quiz** (il vit dans `loadedQuiz.id`
  côté client hôte) : l'hôte doit le déclarer au serveur (nouvel évènement ou
  champ de `room:*`), absent pour un quiz « Jouer ».
- Scores finaux disponibles à `quiz:end` (`room.scores`, `room.players`,
  `server/index.js:2860`) ; pas d'écriture en base aujourd'hui.

## Plan

**Étape 1 — Schéma : table `quiz_results` (⚠ zone interdite : validation
dédiée requise avant `/implement-step`)**
Nouvelle table `quiz_results(id, quiz_id → quizzes, player_id → auth.users,
player_name, score, played_at, room_code)` + index `(quiz_id, score desc)` et
`(quiz_id, player_id)`. RLS : **insertion** par un utilisateur authentifié
pour LUI-MÊME (`player_id = auth.uid()`), **lecture** limitée au propriétaire
du quiz (`quizzes.owner_id = auth.uid()`) pour la liste détaillée.
Trade-off : le top 3 et le « score à battre » doivent être lisibles par tout
hôte/joueur, pas seulement le propriétaire → deux **fonctions SQL
`security definer`** (`quiz_top_scores(quiz_id, n)` renvoyant seulement
pseudo + score + date, `quiz_has_played(quiz_id, player_ids[])` renvoyant
seulement les ids ayant joué) plutôt qu'une policy de lecture large qui
exposerait toute la table. Fichier : `supabase/schema.sql` (+ à exécuter
manuellement dans Supabase, comme les migrations précédentes).

**Étape 2 — Identité joueur connectée côté serveur**
Client (`index.js`) : joindre le `access_token` Supabase à `room:join` quand
une session existe. Serveur : vérifier le JWT (`auth.getUser`), stocker
`player.userId` (jamais fait confiance à un id envoyé en clair — risque
d'usurpation). Invité = pas de `userId`, comportement inchangé.

**Étape 3 — Le serveur connaît le quiz de la partie**
Évènement `room:setQuiz { roomCode, quizId }` émis par l'hôte à la sélection
(`loadQuizById`/`confirmQuizSelect`), ignoré hors mode « Présenter » ou quiz
auto ; stocké `room.quizId`. Trade-off : évènement dédié plutôt qu'un champ
dans `question:show`, car le warning du lobby (étape 6) en a besoin AVANT le
lancement.

**Étape 4 — Enregistrement à `quiz:end`**
Dans le handler `quiz:end` : si `room.quizId` et mode Présenter, insérer une
ligne par joueur **ayant un `userId`** (hors hôte) avec son score final.
Échec d'écriture = journalisé, jamais bloquant pour la fin de partie
(commentaire explicite, pas de `catch` vide). Protection double-envoi :
`room.resultsSaved`.

**Étape 5 — Score à battre + top 3 final**
- Au lancement (`question:show` de la 1re question), l'hôte/les joueurs
  reçoivent `quiz:bestScore { score, name }` (serveur appelle
  `quiz_top_scores(quizId, 1)`) → bandeau ; **rien si aucun résultat**.
- À la fin : `quiz:end` enrichi avec le top 3 (après insertion de la partie
  courante, qui y est mise en évidence) → affichage sur `result.html`
  (`results.js`) ; mirroir TV seulement si trivial (à confirmer à l'étape).

**Étape 6 — Warning « déjà participé » au lobby**
À la sélection du quiz (`room:setQuiz`) et à chaque arrivée de joueur, le
serveur appelle `quiz_has_played(quizId, userIds des joueurs connectés)` et
envoie à l'hôte `lobby:alreadyPlayed [{ playerId, name }]`. Hôte : icône ⚠
sur la tuile du joueur + bulle au survol « Attention, X a déjà participé ».
Invités jamais signalés (décision 1).

**Étape 7 — Bouton « Liste des joueurs ayant participé » (propriétaire)**
Dans la configuration du quiz (éditeur, `editor.html`/`editor.js`), pour le
propriétaire seulement : modale listant pseudo, nombre de parties, meilleur
score, dernière date — lue en direct via la policy de lecture propriétaire
(étape 1), sans passer par le serveur.

**Étape 8 — Vérification de bout en bout**
Deux comptes de test + un invité sur une salle locale : partie terminée →
lignes en base ; 2e partie → score à battre + warning ; top 3 ; liste
propriétaire ; quiz « Jouer » et partie interrompue = rien d'écrit.

Zones interdites touchées : **étape 1 (schéma DB, `supabase/schema.sql`)**.
Pas de nouvelle dépendance ni de `render.yaml`. Étape 2 : changement du
contrat `room:join` (rétro-compatible : le JWT est optionnel).

## Étapes réalisées
- [x] Étape 1 — table `quiz_results` + fonctions `quiz_top_scores`,
  `quiz_has_played`, `quiz_participants` (`supabase/schema.sql`, commit
  9cc238e), exécutées par l'utilisateur dans Supabase ; vérifié : `count(*)`
  = 0 et `quiz_top_scores(...)` répond sans erreur. Note : le serveur n'a que
  la clé anon, il insèrera donc chaque ligne avec le JETON DE SESSION du
  joueur concerné (policy `player_id = auth.uid()`), plutôt qu'avec une clé
  admin.
- [x] Étape 2 — `io({ auth })` côté client joint le jeton de session à
  chaque (re)connexion ; côté serveur `resolveSocketUserId` le fait vérifier
  (`supabaseAdmin.auth.getUser`), mémorise `player.userId` et
  `room.playerAuth[token] = { userId, jwt }` (hors hôte). Commit local dans
  le worktree `../QuEazy-test` (non poussé).
- [x] Étape 3 — `room:setQuiz { roomCode, quizId }` : le client
  (`declareQuizToServer`, appelée en fin de `loadQuizById` ET dans
  `room:created`, le quiz pouvant finir de charger avant la salle) ; le
  serveur (même garde que `game:setMode` : hôte seul, avant le lancement,
  jamais en mode « Jouer », uuid valide) mémorise `room.quizId`. Commit local
  `../QuEazy-test` (non poussé).
- [x] Étape 4 — `saveQuizResults(code, room)` (`server/index.js`), appelée
  par `quiz:end` uniquement si le socket est celui de l'hôte (le handler n'avait
  pas de garde d'hôte) : une ligne par joueur connecté (hors hôte), insérée
  avec SON jeton de session (policy `player_id = auth.uid()`), score du
  serveur ; `room.resultsSaved` évite le double envoi ; échec = warn, jamais
  bloquant. Limite connue : un jeton expiré (partie > ~1 h) fait échouer cette
  ligne seulement.
- [x] Étape 5 — serveur : `quiz:bestScore {name, score}` émis à toute la salle
  au lancement de la 1re question (`quiz_top_scores(quizId, 1)`, rien si
  aucun résultat) ; `quiz:end` porte `quizId`. Client : bandeau éphémère
  `#bestScoreBanner` (8 s) ; `index.js` ajoute `&qid=` à l'URL des résultats
  pour TOUS les joueurs ; `results.js` lit `quiz_top_scores(qid, 3)` (1,5 s puis
  5 s, l'écriture suit `quiz:end`) et affiche « Meilleurs scores sur ce quiz »
  sous le podium. Hors de cette étape (non fait) : miroir TV du bandeau/top 3
  et mise en évidence de la partie qui vient de se terminer dans le top 3
  (la fonction SQL ne renvoie pas la salle) — à trancher.
- [x] Étape 6 — serveur : `notifyAlreadyPlayed` (RPC `quiz_has_played`) envoie
  `lobby:alreadyPlayed {players:[{id,name}]}` à l'HÔTE SEUL, à la sélection du
  quiz (`room:setQuiz`) et à l'arrivée de chaque joueur identifié ; liste vide
  quand plus personne n'est concerné. Client : tuile du salon avec pastille ⚠ et
  bulle CSS au survol/focus « Attention, X a déjà participé à ce quiz »
  (placée sous la pastille : la grille coupe vers le haut). Invités jamais
  signalés.
- [x] Étape 7 — éditeur : bouton « 👥 Participants » (`#participantsQuizBtn`)
  visible pour le propriétaire d'un quiz enregistré (après chargement ou après
  la 1re sauvegarde), ouvre une modale construite en JS qui lit
  `quiz_participants` (pseudo, parties, meilleur score, dernière partie) ou
  affiche « Personne n'a encore terminé ce quiz » ; jamais montré en lecture
  seule (quiz d'un autre créateur).
- [x] Étape 8 — vérification de bout en bout (serveur de test, un seul compte :
  jeton du compte de test réutilisé par plusieurs sockets, pas de 2e compte
  réel) : partie interrompue (salle fermée sans fin), mode « Jouer », aucun
  quiz déclaré, invités seuls → 0 ligne écrite ; double `quiz:end` → une seule
  écriture ; 2 onglets du même compte → 2 lignes, invité ignoré ;
  `quiz_top_scores` ne renvoie qu'une ligne par joueur ; aucun log d'erreur.

## Checks effectués
- [x] `node --check server/index.js` et `client/public/js/index.js`
- [x] Démarrage serveur vérifié (port 3100, code commité) : un joueur
  connecté est identifié (log « joueur connecté identifié » avec son userId),
  un jeton invalide est refusé (warn, le joueur rejoint quand même), un
  invité n'est pas identifié, aucun log d'erreur.
- [ ] Vérification visuelle Browser pane — rien de visible pour cette étape
- [x] Étape 3 : serveur de test, sockets factices — seul le setQuiz de
  l'hôte avec un uuid valide en mode Présenter est accepté (id mal formé,
  non-hôte et salle « Jouer » ignorés) ; parcours UI réel : sélection du quiz
  ET lancement direct `?create=true&quiz=<id>` déclarent bien l'id du quiz ;
  aucun log d'erreur.
- [x] Étape 4 : partie de test réelle (hôte factice + page connectée +
  invité) — un `quiz:end` d'un joueur non-hôte n'écrit rien ; celui de l'hôte
  écrit exactement 1 ligne (le joueur connecté ; hôte et invité ignorés) ;
  `quiz_results`, `quiz_top_scores` et `quiz_participants` la renvoient.
  ⚠ cette ligne de test (room `4HR2P`, score 0) est dans la vraie base :
  à supprimer (`delete from public.quiz_results where room_code = '4HR2P';`).
- [x] Étape 5 : partie de test — bandeau « Score à battre » reçu au lancement
  de la 1re question, absent sur un quiz sans résultat ; top 3 affiché sur
  `result.html`. ⚠ lignes de test à supprimer (rooms `MK5NS`, `KG8PX`).
- [x] Étape 6 : hôte réel (page) + joueur factice avec le jeton du compte de
  test + invité — seule la tuile du joueur connecté ayant déjà joué reçoit ⚠
  (bulle vérifiée à l'écran) ; l'alerte disparaît en choisissant un quiz jamais
  joué ; aucun log d'erreur.
- [x] Étape 7 : éditeur du quiz de test (compte propriétaire) — bouton visible,
  modale listant le joueur de test (1 partie, 0 pts, date) ; `node --check
  editor.js` OK.

## Tests manuels recommandés
- **Deux comptes réels** : un joueur termine un quiz en mode « Présenter » ; le top 3 s'affiche sous le podium des résultats (joueur, MJ, TV) et le résultat est bien enregistré.
- **Salon** : à la sélection d'un quiz déjà terminé, le podium (score à battre) apparaît chez tous les joueurs, y compris ceux qui arrivent après ; il disparaît si on change pour un quiz sans résultat.
- « Déjà participé » : avertissement à l'hôte quand un joueur connecté a déjà fait le quiz ; liste des participants dans la configuration du quiz.
- Invités (sans compte) : rien enregistré, aucun podium faussé.
- Mode « Jouer » (quiz généré) : aucun enregistrement ni podium.
## Risques restants
- **Lignes de test à supprimer dans la vraie base** : `delete from
  public.quiz_results where room_code in ('4HR2P','MK5NS','KG8PX','ABW2H');`
- **Jeton de session expiré** (partie de plus d'~1 h) : le résultat du joueur
  concerné n'est pas enregistré (warn dans les logs, fin de partie non bloquée).
- **Même compte dans 2 onglets** : compté comme 2 participations (le top 3
  garde le meilleur score par compte).
- **Pas testé avec 2 comptes réels** ni sous Firefox/mobile.
- **Non fait** : miroir TV du bandeau « score à battre » / du top 3 ; mise en
  évidence de la partie du jour dans le top 3.
- **Non poussé** : commits locaux dans le worktree `../QuEazy-test` (083cc97 →
  55736de), la table SQL est déjà créée en base.
- **Le bandeau « score à battre » de la 1re question a été remplacé** par le podium du salon (`lobby:quizPodium`, diffusé par le serveur à la sélection du quiz et à chaque arrivée).
- Podium du salon et top 3 TV vérifiés avec des données d'exemple seulement : aucun quiz n'a de résultat réel en base à ce jour.
- Le miroir TV du salon n'existe pas (la TV ne montre pas le salon).
## Statut
`clôturée`
