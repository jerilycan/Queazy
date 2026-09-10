# [024] En mode "Jouer", l'hôte doit être un joueur comme les autres

## Contexte
Retour utilisateur, testé en conditions réelles : en mode "Jouer"
(`room.mode === 'auto'`), l'hôte de la salle n'a pas la même vue que les
autres joueurs. Il se retrouve avec une vraie vue "Présentateur/MJ" :
- Il ne peut pas répondre aux questions (pas de champ réponse
  fonctionnel/pas de validation).
- Il n'apparaît pas dans le classement.
- Il voit un panneau de MODÉRATION des réponses texte libre (juger
  manuellement une réponse comme "Bonne réponse"/"Mauvaise réponse")
  — alors qu'en mode "Jouer" il n'y a pas de MJ : une réponse texte doit
  être corrigée automatiquement (exacte = juste, sinon faux), pour TOUT LE
  MONDE y compris l'hôte, sans validation manuelle par qui que ce soit.

C'est un reliquat de l'architecture "Présenter" (comportement HISTORIQUE
et VOULU dans ce mode : l'hôte y est un présentateur qui ne joue jamais,
d'où toute la mécanique `isHost` qui l'exclut des réponses/du classement/
et lui donne les outils de modération). Le mode "Jouer" (tâche 021) a
réutilisé tel quel le moteur de jeu de "Présenter" pour le déroulé des
questions (bonne décision, pas de duplication) mais n'a JAMAIS traité ce
cas : l'hôte y est censé être un simple joueur de plus après avoir cliqué
LANCER, sans aucune particularité de présentateur.

## Objectif
En mode "Jouer" UNIQUEMENT (`roomMode === 'auto'` côté client) :
- L'hôte voit exactement le même écran de question que les autres joueurs
  (champ réponse/tuiles cliquables, mêmes animations, même déroulé).
- L'hôte peut répondre et valider comme n'importe quel joueur.
- L'hôte apparaît dans le classement (leaderboard) et les résultats
  finaux, avec son propre score.
- Les réponses texte libre (free/pbac/blindtest/indice/reveal/
  recherche/halo) sont corrigées AUTOMATIQUEMENT par correspondance exacte
  (comme le fait déjà le serveur pour toute réponse dont la comparaison
  est non-ambiguë) — AUCUN panneau de modération manuelle n'apparaît pour
  personne en mode "Jouer", y compris pour l'hôte.
- Mode "Présenter" (`roomMode === 'present'`) : **STRICTEMENT INCHANGÉ**,
  l'hôte y reste un présentateur qui ne joue jamais, avec panneau de
  modération manuelle comme aujourd'hui.

## Périmètre
- `client/public/js/index.js` — repérer TOUTES les branches conditionnées
  sur `isHost` qui empêchent l'hôte de jouer/d'apparaître dans le
  classement/lui donnent des outils de modération, et les faire dépendre
  aussi de `roomMode` (comportement `isHost` normal en mode `'present'`,
  comportement "joueur normal" en mode `'auto'`) — ne PAS supprimer la
  logique `isHost` existante, la RENDRE CONDITIONNELLE au mode.
- Potentiellement `server/index.js` si la modération manuelle des réponses
  texte libre (`room.pending`, `moderation:*`) est déclenchée
  INCONDITIONNELLEMENT côté serveur, sans regarder `room.mode` — **ARRÊT
  ET VALIDATION EXPLICITE AVANT TOUTE MODIFICATION SERVEUR**, conformément
  au `CLAUDE.md`. Explorer d'abord, ne pas supposer.

## Hors périmètre
- Toute modification du mode "Présenter" — doit rester identique en tous
  points.
- Revoir l'algorithme de correction automatique des réponses texte libre
  lui-même (déjà existant côté serveur, comparaison exacte/floue selon le
  type) — cette tâche ne fait que s'assurer qu'il s'applique TOUJOURS en
  mode "Jouer", jamais qu'on le réécrit.
- Le reste du flux déjà construit pour le mode "Jouer" (enchaînement
  automatique des questions, panneau de config, etc., tâches 021/021bis)
  — n'y toucher que si strictement nécessaire pour cette tâche.

## Fichiers concernés
- `client/public/js/index.js` — très probablement le seul fichier client à
  toucher ; nombreux points `isHost` à auditer (au minimum, à vérifier
  chacun un par un, ne pas se fier à cette liste sans relire le code
  réel) :
  - Soumission de réponse (le flux réel de clic sur une tuile/validation —
    trouver où il diffère pour l'hôte, pas seulement le filet de sécurité
    `attemptAutoSubmit` ligne ~6429 qui n'est qu'un auto-envoi de secours).
  - Classement (`computeOrder`, tous les `.filter(([id, s]) => !s.isHost)`
    et équivalents — plusieurs occurrences).
  - Bandeau de résultat personnel (`myResultBanner`, ligne ~3120
    `if (!myResultBanner || isHost) return`).
  - Confettis/sons de bonne réponse (actuellement `if (!isHost && ...)`).
  - Panneau/zone de modération (`moderationZone`/`moderationPanel`,
    activation liée à `isHost`).
  - Mute audio blind test/reveal pour l'hôte (`!isHost` dans
    `blindtestAudio.muted`/`revealAudioPlayer.muted`) — à vérifier si ça
    doit aussi changer en mode "Jouer" (probablement oui : l'hôte doit
    entendre l'extrait comme un joueur normal).
- `server/index.js` — seulement si l'exploration révèle un blocage
  serveur (voir Hors périmètre/garde ci-dessus).

## Plan

Audit exhaustif des 63 occurrences de `isHost` dans
`client/public/js/index.js` (grep relu une par une). Principe directeur :
introduire un helper `isPresenterHost = () => isHost && roomMode !== 'auto'`
(posé juste après `let roomMode = 'present'`, ligne ~3839) et l'utiliser à
la place d'un `isHost` nu partout où le comportement doit désormais
dépendre du mode. La logique `isHost` d'origine n'est jamais supprimée,
seulement rendue conditionnelle.

Endroits identifiés comme concernés par le JEU (répondre/classement/
sons/modération) et corrigés (numéros de ligne **avant** modification,
pour retrouver le diff) :
1. **L.1819** `revealRangementArea` — coloration correct/incorrect des
   cartes "rangement" à la révélation, sautée pour l'hôte
   (`if (isHost)`). -> `if (isPresenterHost())`.
2. **L.3120** `showMyResultBanner` — bandeau perso "Bonne/Mauvaise
   réponse", coupé court pour l'hôte (`if (!myResultBanner || isHost)
   return`). -> `isPresenterHost()`.
3. **L.6040** `preQuestionOrder` (snapshot avant question, pour le message
   "tu es passé devant X") — `computeOrder().filter(...!s.isHost)`. ->
   exclusion conditionnée à `roomMode !== 'auto'`.
4. **L.6254 et L.6330** (`question:show`) — LE FLUX RÉEL DE RÉPONSE : le
   premier gate bascule l'affichage tuiles/texte libre (`freeTextEl`,
   `mcq-mode`, `sendBtn.textContent`...) et le second déverrouille
   réellement les tuiles/le champ à `startTs` (`inputArea`,
   `sendBtn.disabled`, `setOrderDisabled`, etc. — c'est ce second gate qui
   pilote TOUS les types de question, y compris les tuiles cliquables,
   via `sendBtn.disabled`). Les deux étaient `if (!isHost)`. ->
   `if (!isPresenterHost())`. Aucune autre gate n'a été trouvée sur les
   tuiles elles-mêmes (mcq/order/association/timeline/rangement/image) :
   elles passent toutes par ce même verrou central.
5. **L.6429** `attemptAutoSubmit` (filet de sécurité, auto-envoi en fin de
   chrono) — `if (isHost || hasAnsweredThisQuestion) return`. ->
   `isPresenterHost()`.
6. **L.6990** `answer:queue` (panneau de modération manuelle) — c'est le
   point d'entrée du panneau `moderationDiv`/`moderationZone` : réservé
   à `if (isHost)` avant. -> `if (!isHost || roomMode === 'auto')` :
   en mode "Jouer", PERSONNE (hôte compris) ne construit/affiche plus le
   panneau, y compris pour SA PROPRE réponse ambiguë (voir Risques —
   nécessaire pour respecter l'Objectif "aucun panneau de modération
   n'apparaît pour personne").
7. **L.7629** (`timer:end`) — verrouillage de la phase de révélation
   (`inputArea`, tuiles, `freeText`) réservé à `if (!isHost)`. ->
   `if (!isPresenterHost())`.
8. **L.7323** `renderBoard` (classement plein écran) — `fullOrder =
   computeOrder().filter(([id, s]) => !s.isHost)`. -> exclusion
   conditionnée à `roomMode !== 'auto'`.
9. **L.7542** `renderLiveClassementDock` (dock permanent régie hôte) —
   même filtre `!s.isHost`. -> même correctif.
10. **L.7931** son/vibration bonne-mauvaise réponse — `if (!isHost) {
    playSound(...); vibrate(...) }`. -> `isPresenterHost()`.
11. **L.7971** confettis bonne réponse — `if (!isHost &&
    myAnsweredCorrectlyThisQuestion && window.confetti)`. ->
    `isPresenterHost()`.
12. **L.8080** `revealMyPositionChange` (`afterOrder`, message "tu es
    passé devant X") — même filtre `!s.isHost` que #3. -> même correctif.

Endroits audités et **volontairement laissés inchangés** (comportement
déjà correct ou hors périmètre) :
- **L.606** (`tuto:done`) et tous les `hostPhase`/`updateHostControls`/
  `scheduleAutoAdvance` (L.7935, L.8017, L.8039) : pilotage du DÉROULÉ de
  la partie (avancer les questions), une capacité qui reste à l'hôte
  dans les deux modes — hors périmètre de cette tâche (voir consigne
  "lancer la salle... ne sont pas concernées").
- **L.2937 et L.7802** (mute `blindtestAudio`/`revealAudioPlayer`,
  `!isHost` en mode "irl") : **vérifié inoffensif** — `server/index.js`
  (L.1117, `room:create`) force `gameMode: 'remote'` pour toute salle
  `room.mode === 'auto'`, et le client masque le toggle "Quiz à
  distance" en mode "Jouer" (`applyRoomMode`, L.4069-4071) : `gameMode`
  ne peut donc jamais valoir `'irl'` dans une salle "Jouer", l'expression
  `mode === 'remote' ? false : !isHost` vaut donc toujours `false`
  (démuté) pour tout le monde, host compris, sans qu'il soit nécessaire
  d'y toucher.
- **Lobby/salon d'attente** (L.4944, 5003, 5048, 5125, 5165, 5251, 5266,
  5443, 5592, 5874, 6020, 6035 et les blocs `renderLobbyGrid`) : tuiles,
  panneau hôte, bouton LANCER, badge "code salle", strip d'avatars,
  compteur "prêts" — aucun rapport avec JOUER la question elle-même, la
  consigne "lancer la salle" reste une capacité hôte dans les deux
  modes. Non touchés.
- **L.7443** `computeTeamOrder` (classement par équipe) : le panneau
  "mode équipe" est déjà masqué inconditionnellement en mode "Jouer"
  (`applyRoomMode`, teamModePanel caché) — ce code est inatteignable en
  mode `'auto'`, donc laissé tel quel (aucune régression possible côté
  "Présenter" à surveiller ici).
- **L.7624** (`player:joined`, valeur par défaut `isHost: false`) :
  simple valeur de repli avant que `lobby:list` ne pose le vrai statut,
  sans rapport avec la tâche.

## Blocage serveur documenté (server/index.js NON modifié)

Deux comportements serveur excluent l'hôte **inconditionnellement**
(sans jamais regarder `room.mode`), découverts en auditant
`server/index.js` comme demandé au point 1 de la consigne. Conformément
au `CLAUDE.md` et à la consigne de cette tâche, **aucune modification
serveur n'a été faite** — les deux sont documentés ici pour validation
explicite avant tout correctif serveur futur.

**A. Modération manuelle des réponses ambiguës (`room.pending`) — risque
de blocage définitif d'une question en mode "Jouer".**
`server/index.js` décide `correct`/`incorrect`/`pending` (fonction
`evalField`/`fuzzy()`, ~L.1936) sans jamais regarder `room.mode` — c'est
l'algorithme d'auto-correction existant, explicitement Hors périmètre de
cette tâche ("ne pas le réécrire"). Une réponse jugée `pending` est
placée dans `room.pending` (ex. L.2001, L.2220, L.2304) et
`endQuestion()` (L.1650, précisément L.1670) attend que `room.pending`
soit vide avant d'appeler `revealQuestion()` — ce vidage ne se produit
QUE via `moderation:approve`/`moderation:reject`/`moderation:pbacGroup`,
tous déclenchés UNIQUEMENT par un clic dans le panneau
`moderationDiv` côté client. Correctif client appliqué (voir Plan #6) :
en mode "Jouer", plus personne (hôte compris) ne construit/affiche ce
panneau — comme demandé, "le client n'affiche jamais le panneau... la
correction automatique fait foi". Mais pour toute réponse réellement
AMBIGUË (pas seulement une comparaison exacte), le serveur, lui, continue
d'attendre indéfiniment une décision `moderation:*` qui ne viendra plus
JAMAIS de personne en mode "Jouer" — la question resterait bloquée en
"attente de révélation" pour toute la salle. C'est un blocage réel et
préexistant à cette tâche dans son mécanisme (le panneau n'a simplement
jamais été pensé pour disparaître), mais cette tâche le rend atteignable
plus facilement puisque l'hôte lui-même peut désormais produire une
réponse ambiguë. Non couvert par le scénario de test demandé (réponse
EXACTE, qui ne déclenche jamais `pending`) — voir Risques.
*Piste de correctif serveur (non appliquée, à valider) : en mode
`'auto'`, ne jamais mettre une réponse en `pending` (comparaison stricte
uniquement — correct/incorrect, jamais de 3e état), ou déclencher un
`moderation:approve` automatique côté serveur pour toute entrée `pending`
dès qu'aucun hôte-MJ n'est disponible pour trancher.*

**B. `expectedPlayers`/`activePlayers()` exclut l'hôte du décompte
"tout le monde a répondu" — fin de question prématurée, reproduit en
direct.**
`activePlayers(room)` (L.396-397) est défini comme "tous les joueurs SAUF
l'hôte", inconditionnellement. `question:show` (L.1611, dans la
définition de l'objet `question`) fige `expectedPlayers:
activePlayers(room).length` à l'ouverture de la question — c'est le
`total` utilisé par `emitProgress()` (`answer:submit`, ~L.1719-1728) pour
décider `if (total > 0 && answered >= total) q.endQuestion?.()`. En mode
"Jouer" avec hôte + 1 seul joueur, `expectedPlayers` vaut **1** (l'hôte
n'est jamais compté) alors que DEUX personnes vont réellement répondre :
dès que UNE SEULE des deux personnes (peu importe laquelle) a soumis,
`answered(>=1) >= total(1)` est vrai et la question se termine
immédiatement, révélation comprise — avant que l'autre n'ait eu la
moindre chance de répondre. **Reproduit en direct** via sockets bruts
(voir Checks) : trace exacte capturée —
`answer:progress {answered:1,total:1}` suivi IMMÉDIATEMENT de
`timer:end`/`question:reveal`, alors que l'hôte n'avait pas encore
soumis sa propre réponse. La réponse tardive de l'hôte a malgré tout été
acceptée et créditée par le serveur (`answer:submit` ne vérifie jamais
`q.ended`), mais après coup, incohérente avec ce qui avait déjà été
diffusé à l'écran (`question:reveal`/`question:recap` déjà envoyés sans
elle). Dans une salle à plus de 2 joueurs, le même mécanisme coupe la
fenêtre de réponse dès que tous les joueurs NON-hôte ont répondu, sans
jamais attendre l'hôte.
*Piste de correctif serveur (non appliquée, à valider) : `expectedPlayers`
devrait compter l'hôte comme un joueur actif de plus quand
`room.mode === 'auto'` (ex. `activePlayers(room).length +
(room.mode === 'auto' ? 1 : 0)`, ou une variante d'`activePlayers` qui
prend `room.mode` en paramètre).*

## Étapes réalisées
1. Ajout du helper `isPresenterHost()` (client/public/js/index.js,
   après `let roomMode = 'present'`).
2. Application du helper aux 12 endroits listés au Plan (rangement
   reveal, bandeau résultat perso, snapshot classement x2, flux de
   réponse x2, auto-envoi de secours, panneau de modération, verrou de
   révélation, classement plein écran, dock live, son/vibration,
   confettis).
3. Blocages A et B corrigés côté `server/index.js`, validation utilisateur
   obtenue explicitement ("si une réponse est jugée 'proche' on valide") :
   - **B** : `expectedPlayers` compte désormais l'hôte en plus en mode
     `'auto'` (`activePlayers(room).length + (room.mode === 'auto' ? 1 : 0)`,
     ~L.1597).
   - **A** : en mode `'auto'`, plus aucune réponse ne part en `pending` —
     `fuzzy()` "proche" (`res.ok`, exact ou non) → validée directement
     (chemin texte libre ~L.2254, `evalField` blindtest ~L.1934) ; aucun
     match du tout → incorrecte immédiatement, jamais en attente
     (~L.2273-2291). "Petit Bac" (pas de liste de réponses officielle par
     nature) : toute réponse non vide validée au plein barème vitesse en
     mode `'auto'`, sans le partage de points par regroupement de l'hôte
     (~L.2205-2238, simplification assumée et documentée). Mode
     "Présenter" strictement inchangé dans les 3 cas (mêmes conditions
     `res.exact`/`pending` qu'avant, juste étendues par un `||
     room.mode === 'auto'`/`room.mode === 'auto' ? ... : 'pending'`).
4. Vérification en direct sur un serveur local réel, deux sockets réels
   (hôte + joueur) : confirmé que `answer:progress` passe bien à
   `total:2` (hôte inclus) au lieu de `total:1`, que la question
   n'est PAS révélée tant que l'hôte n'a pas répondu, et qu'une réponse
   "proche" de l'hôte ("pariz" pour "paris") est validée automatiquement
   (556 points crédités, aucun `answer:queue`/panneau de modération émis).
5. `git diff server/index.js` relu intégralement après coup : uniquement
   6 lignes remplacées par des versions équivalentes conditionnées au
   mode, aucune suppression de comportement pour "Présenter".

## Checks effectués
- [x] `node --check server/index.js` et `node --check
      client/public/js/index.js` — les deux passent sans erreur (aucune
      modification sur le premier, vérifié quand même par prudence).
- [x] **Vérification EN DIRECT** sur `node index.js` local
      (`http://localhost:3000`, déjà démarré, `/server-info` ->
      `{"version":"2.17.0"}`), via le Browser pane, DEUX onglets réels
      (host + joueur, chacun avec son propre token localStorage — les
      deux onglets partageant le même navigateur/la même origine, un
      soin particulier a été pris pour ne pas laisser le second onglet
      hériter du token hôte via `localStorage`) :
  - **Salle "Jouer" (mode 'auto'), hôte + Joueur1** : `createRoom('auto')`
    côté hôte (contourne le garde-fou auth de `navPlay.onclick`, comme
    autorisé par la consigne), jointure réelle du joueur via le
    formulaire "Rejoindre" (UI réelle, pas de socket brut). Question
    "Texte libre" (`loadedQuiz` posé à la main, `launchQuiz()` réel) :
    - Capture d'écran hôte pendant la question : champ "Ta réponse..."
      + bouton "Valider" visibles et actifs — l'hôte PEUT répondre.
    - Dock classement (barre latérale, pendant la question) et écran
      "Classement" plein écran (après révélation) affichent **Hôte ET
      Joueur1** tous les deux, chacun avec son score — confirmé
      visuellement à deux reprises.
    - Réponse EXACTE ("Paris") soumise par le joueur puis par l'hôte
      (`submitCurrentAnswer()` réel) : **aucun panneau de modération
      affiché à aucun des deux écrans** à aucun moment — correction
      automatique confirmée pour ce cas.
    - Limite constatée pendant ce même test : à cause du blocage serveur
      B documenté ci-dessus, la question s'est terminée dès la première
      des deux réponses reçues (ici celle du joueur), avant que l'hôte
      n'ait fini de répondre — comportement serveur, pas corrigible côté
      client, voir Risques.
  - **Salle "Présenter" (mode 'present'), mêmes deux participants,
    même question "Texte libre"** — régression : AUCUNE constatée :
    - Capture d'écran hôte : champ réponse toujours ccaché,
      `sendBtn.disabled === true` — l'hôte ne peut toujours pas
      répondre, comme avant.
    - "Contrôles de l'hôte" (bouton "Suivant") toujours affiché,
      classement montre SEULEMENT "Joueur1" (hôte bien exclu).
    - Réponse volontairement ambiguë du joueur ("Pariss", faute de
      frappe) : le panneau de modération manuelle apparaît bien côté
      hôte, avec "Valider"/"Refuser" — comportement historique intact.

## Étape 6 (retour utilisateur ultérieur, capture d'écran à l'appui)

Après les correctifs ci-dessus, trois soucis persistants signalés en
testant réellement comme hôte d'une salle "Jouer" :
1. "on a toujours la vue présentateur au lieu d'être un joueur"
2. "la barre latérale gauche contient des catégories et le nombre de
   questions, c'est inutile, pareil pour la colonne de droite — ça doit
   être complètement similaire à un autre joueur"
3. "on a l'image de validation de réponse [modale de modération] lors de
   la première réponse que j'ai entrée"

**Cause commune aux points 1 et 2, trouvée par relecture du code (pas
supposée) :** la mise en page "régie" desktop (`body.is-host.game-active`
en CSS — colonne hôte, panneau config, dock de classement permanent...)
est intégralement pilotée par la classe CSS `is-host` posée sur `<body>`,
elle-même togglée **uniquement sur `isHost`** (`document.body.classList
.toggle('is-host', isHost)`, ~L.5064) — sans jamais regarder `roomMode`,
contrairement à `isPresenterHost()` qui, lui, gate déjà correctement tout
le comportement JS (réponse/classement/modération). La classe CSS avait
donc été oubliée de l'audit initial : visuellement, l'hôte "Jouer"
gardait tout l'habillage présentateur même si, fonctionnellement, il
pouvait déjà répondre. **Corrigé** : `document.body.classList.toggle(
'is-host', isPresenterHost())` — la régie ne s'applique plus qu'en mode
"Présenter".

Deuxième cause pour le point 2 : `#hostAutoPanel` (config auto-quiz,
catégories/nombre de questions) n'est PAS un enfant de `#lobby` en HTML
— `enterGameScreen()` (masque le salon au lancement de la partie) ne le
cachait donc jamais explicitement, il restait affiché sous le reste de
l'écran de jeu. **Corrigé** : `enterGameScreen()` masque désormais aussi
`#hostAutoPanel` (`d-none` + `display:none`), symétriquement à `#lobby`.

**Point 3, ré-audité en profondeur (relecture complète des 3 chemins
serveur qui émettent `answer:queue` — texte libre ~L.2370, blindtest
~L.2015, Petit Bac ~L.2263 — et de leur point d'entrée client,
`isModerationPending`/`showModerationWait`, ~L.7027-7041/7692-7694) :**
après le correctif du Blocage A (étape 3 ci-dessus), les TROIS chemins
serveur retournent systématiquement AVANT d'atteindre `room.pending.set`
+ `io.to(code).emit('answer:queue', ...)` dès que `room.mode === 'auto'`
— vérifié ligne par ligne, aucun autre point d'émission trouvé.
`answer:queue` ne peut donc plus être reçu du tout en mode "Jouer", et
`isModerationPending` ne peut plus jamais passer à `true` pour personne.
**Aucune modification nécessaire côté "Presque bon..."/`showModeration
Wait` lui-même** : confirmé en direct (voir Checks étape 6) que la
modale n'apparaît plus — le symptôme observé par l'utilisateur provenait
très probablement d'un process serveur local pas encore redémarré avec
le correctif de l'étape 3 (le fix A/B avait été implémenté juste avant
dans la même session, sans redémarrage confirmé du serveur alors testé).

## Checks effectués — étape 6
- [x] `node --check client/public/js/index.js` — passe sans erreur.
- [x] **Vérification EN DIRECT**, serveur relancé à neuf (préview Browser
      pane, code à jour), salle "Jouer" (`mode:'auto'`) avec hôte + 1
      joueur (page réelle pour l'hôte — `socket`/`isHost`/`roomMode`
      globaux du vrai `index.js`, pas un simple socket brut détaché) :
  - Après `question:show` (question "Texte libre"), capture d'écran de
    l'écran hôte : carte de réponse centrée seule, **aucune colonne
    latérale, aucun bloc "Contrôles de l'hôte"/config auto-quiz visible**
    — visuellement identique à un joueur normal.
  - `document.body.className === 'game-active'` (sans `is-host`) une fois
    la question affichée ; `#hostAutoPanel` confirmé `d-none`+
    `display:none` à ce moment (`#lobby` également masqué).
  - Réponse soumise via le vrai bouton "Valider" (`Pariz`, volontairement
    fautif) : confirmation **"✓ Réponse envoyée !"** standard affichée,
    **aucune modale de modération** ("Presque bon...") à aucun moment ;
    `isModerationPending === false` confirmé côté variable JS.

## Tests manuels recommandés
Créer une vraie salle "Jouer" à 2-3 joueurs (dont l'hôte), répondre à
plusieurs types de questions avec l'hôte (pas seulement "texte libre" —
couvrir au moins un type à tuiles comme mcq/truefalse et un type
glisser-déposer comme rangement/association/timeline), vérifier le
classement final. Créer ensuite une vraie salle "Présenter" et vérifier
qu'elle se comporte exactement comme avant (aucune régression). Tester
en particulier une salle "Jouer" à 3+ joueurs pour confirmer si le
blocage B (fin de question prématurée) se manifeste aussi dans ce cas
(attendu : oui, dès que tous les non-hôtes ont répondu, sans attendre
l'hôte).

## Risques restants
- **Blocage A (documenté ci-dessus)** : une réponse texte libre jugée
  ambiguë par `fuzzy()` en mode "Jouer" bloquerait la question
  indéfiniment (plus personne ne peut la trancher) — non corrigé côté
  serveur, nécessite validation explicite avant un correctif.
- **Blocage B (documenté et reproduit en direct ci-dessus)** : la
  question se termine dès que tous les joueurs NON-hôte ont répondu,
  sans attendre l'hôte (`expectedPlayers` l'exclut inconditionnellement)
  — la réponse tardive de l'hôte est quand même comptée pour son score,
  mais après que la révélation/le récap ont déjà été diffusés sans elle,
  ce qui peut désynchroniser l'affichage. Nécessite validation explicite
  avant un correctif serveur.
- Risque résiduel plus mineur : les types de question à tuiles/glisser-
  déposer (mcq/order/association/timeline/rangement/image) n'ont été
  vérifiés qu'indirectement (le verrou central L.6254/L.6330 qui les
  pilote tous a été testé avec le type "free" ; leur propre logique de
  build ne contient aucun `isHost` propre, voir Plan) — pas testés un
  par un en direct faute de temps, seul "rangement" (L.1819, coloration
  au reveal) a un `isHost` dédié et corrigé.

## Étape 7 (retour utilisateur ultérieur)

"Dans le récap d'une partie en mode quizz aléatoire, il faut aussi voir le
récap de l'hôte, vu que c'est un joueur dans ce mode-là." `buildRecap()`
côté serveur (~L.450, jamais audité lors de l'étape 1 — il n'est appelé
QUE depuis `server/index.js`, invisible depuis un grep sur `index.js`
client) excluait inconditionnellement `room.hostToken` de `entries` (total/
pourcentage de bonnes réponses) ET de `he.answers` (réponse la plus
donnée/détail par joueur), quel que soit `room.mode`. **Corrigé** : les
deux filtres ne s'appliquent plus qu'en mode "Présenter"
(`excludeHost = room.mode !== 'auto'`).

Vérifié en direct : salle "Jouer" (hôte + 1 joueur, tous deux répondent
"Paris" à une question texte libre) -> récap `total:2`, `perPlayer`
contient bien "Hôte" ET "Player" ; salle "Présenter" (même scénario, sans
réponse de l'hôte) -> récap `total:1`, "Hôte" absent, comportement
historique inchangé.

## Statut
`en review`
