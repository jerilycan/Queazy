# [025] Le MJ peut attribuer des points manuellement à un joueur (mode "Présenter")

## Contexte
En mode "Présenter", le MJ anime parfois une partie de la manche à l'oral,
en dehors du système de questions/réponses du quiz (ex. il pose une
question bonus à voix haute après la fin d'une question du quiz). Il n'a
aujourd'hui aucun moyen d'ajuster le score d'un joueur pour récompenser une
bonne réponse orale — seul le score calculé automatiquement par le serveur
à partir des réponses soumises dans l'app existe.

## Objectif
En mode "Présenter" uniquement, à la fin d'une question (après la
révélation), le MJ peut, depuis la barre latérale droite (classement live,
`#liveClassementDock`) :
- Cliquer sur un bouton "+" à côté d'un joueur.
- Voir s'ouvrir une petite popup avec :
  - un champ pour saisir un nombre de points (positif ou négatif),
  - un bouton "Valider" qui applique l'ajustement,
  - deux boutons raccourcis "+200" et "-100" qui ajustent rapidement le
    champ (ou appliquent directement l'ajustement — à trancher au
    moment du plan) sans ressaisie manuelle.
- Le score ajusté du joueur est immédiatement répercuté pour tout le monde
  (classement live, classement plein écran, score affiché au joueur
  concerné), de façon persistante pour le reste de la partie (comme un
  score normal, pas une valeur cosmétique locale).

## Périmètre
- Nouvel événement socket serveur pour appliquer un ajustement de score
  manuel à un joueur d'une salle, initié uniquement par l'hôte de cette
  salle.
- UI : bouton "+" par joueur dans `#liveClassementDock` (mode "Présenter"
  uniquement — jamais en mode "Jouer", où l'hôte est un joueur comme les
  autres, voir tâche 024), popup de saisie avec champ numérique + les 2
  boutons raccourcis + bouton "Valider".
- Répercussion en temps réel du nouveau score sur tous les affichages
  concernés (classement live, classement plein écran, bandeau de résultat
  du joueur concerné si pertinent).

## Hors périmètre
- Toute modification du mode "Jouer" (`roomMode === 'auto'`) — cette
  fonctionnalité n'y est pas disponible, l'hôte y étant un joueur normal
  sans outils de MJ (voir tâche 024).
- Un historique/log détaillé des ajustements manuels (qui a ajusté, quand,
  pourquoi) — non demandé ici, seul le score final compte.
- Une limite ou validation métier sur les valeurs saisies (ex. plafond de
  points) — à clarifier seulement si demandé lors du plan.
- Retrait/correction d'un ajustement déjà appliqué (pas de "undo" dédié) —
  seule l'application d'un nouvel ajustement (y compris négatif) est
  couverte.

## Fichiers concernés
- `server/index.js` — nouvel événement socket (ex. `score:adjust`) : doit
  vérifier que l'émetteur est bien l'hôte de la salle (`socket.id ===
  room.hostId`), appliquer le delta à `room.scores`/`room.tokens` (même
  mécanique que les mises à jour de score existantes dans `answer:submit`),
  puis diffuser `score:update` (ou équivalent) à toute la salle pour rester
  cohérent avec le système de score existant.
- `client/public/js/index.js` — bouton "+" par ligne de joueur dans
  `renderLiveClassementDock()` (~L.7641 et alentours), popup de saisie
  (nouveau petit composant, à construire sur le même patron que les popups
  déjà existantes de l'app), émission du nouvel événement socket, gate
  d'affichage du bouton "+" sur `roomMode !== 'auto'` (voir
  `isPresenterHost()`, tâche 024).
- `client/public/index.html` — markup de la popup (si pas généré
  entièrement en JS, à trancher au moment du plan selon le patron déjà en
  place dans l'app pour ses autres popups).
- `client/public/css/style.css` — styles de la popup et du bouton "+"
  (thème sombre existant, cohérent avec les boutons/cartes déjà en place).

## Plan

Points explorés avant de proposer ce découpage :
- `renderLiveClassementDock()` (~L.7641) est appelée très souvent en dehors
  de toute action du MJ (`lobby:list`, `player:joined`, `timer:end`...) et
  fait `liveClassementList.textContent = ''` avant de tout reconstruire à
  chaque appel. **Un popup posé comme enfant d'une ligne du dock serait donc
  détruit sous les pieds du MJ** dès qu'un de ces évènements arrive pendant
  qu'il saisit un montant. -> le popup doit être un élément UNIQUE et
  persistant ajouté une fois au DOM (même patron que `#revealPopupOverlay`/
  `#qrExpandOverlay`), positionné en overlay centré, pas ancré à la ligne
  cliquée — l'id/nom du joueur ciblé est gardé dans une petite variable JS
  le temps que le popup est ouvert.
- `socket.on('score:update', ...)` (~L.8154) met à jour `scores` **en
  silence, volontairement** (commentaire explicite : le classement ne doit
  pas bouger visiblement avant la révélation, sinon ça donne un indice aux
  autres joueurs). Réutiliser cet évènement tel quel pour un ajustement
  manuel casserait donc l'objectif ("répercuté immédiatement") — il faut un
  évènement **distinct**, `score:adjust`, avec son propre handler client qui
  met à jour `scores` PUIS rappelle `renderLeaderboard()` tout de suite,
  sans toucher aux effets de bord propres à `score:update` (son de
  révélation, `myAnsweredCorrectlyThisQuestion`, `questionDeltas` pour
  l'animation "+XXX" du classement plein écran) qui n'ont pas de sens pour
  un ajustement manuel hors question.
- Le mécanisme d'ajustement de score serveur existant (ex. branche
  `graduation` de `answer:submit`, ~L.1737) donne le patron à reproduire :
  `room.scores.set(...)` + `room.tokens.set(...)` (avec `p.token`) pour
  rester cohérent avec la reconnexion (un joueur qui change de `socket.id`
  retrouve son score via `room.tokens`, voir `room:join`).
- Décision sur les boutons "+200"/"-100" (demandée à trancher ici) :
  **appliqués directement au clic** (pas juste une pré-saisie dans le
  champ), cohérent avec le "à la volée" de la demande — le champ +
  "Valider" restent le chemin pour un montant précis/inhabituel. Popup
  laissé ouvert après un clic +200/-100 (pas de fermeture automatique) : un
  MJ qui enchaîne plusieurs ajustements sur le même joueur (ex. deux bonnes
  réponses orales de suite) n'a pas à rouvrir le popup à chaque fois.
- Décision sur la visibilité du bouton "+" (demandée à trancher ici) :
  visible en permanence pendant `game-active` en mode "Présenter" (pas
  seulement "après la fin d'une question") — plus simple, pas d'état
  supplémentaire à suivre côté client pour détecter précisément "juste
  après la révélation", et sans risque puisque l'outil reste réservé au MJ.
- Aucune zone des "Interdictions" du `CLAUDE.md` (schéma DB, `render.yaml`,
  nouvelle dépendance) n'est concernée par ce plan — pas de validation
  dédiée nécessaire en plus du garde-fou standard `implement-step`.

Étapes (chacune un diff autonome, à valider une par une) :

1. **Serveur — nouvel évènement `score:adjust`** (`server/index.js`, à côté
   des autres handlers `socket.on`) :
   - Rejette silencieusement (simple `return`, même style que
     `player:kick`) si `socket.id !== room.hostId`, si `room.mode ===
     'auto'`, si la cible (`room.players.get(payload.playerId)`) n'existe
     pas, ou si la cible EST l'hôte lui-même (l'hôte n'apparaît jamais dans
     `room.scores` en mode "Présenter", mais défensif en cas d'état
     transitoire).
   - Valide `payload.delta` : entier fini (`Number.isFinite`), arrondi
     (`Math.round`), garde-fou de bon sens sur l'amplitude (ex. clamp à
     ±100000) pour absorber un client buggé — PAS une règle métier de
     plafond (explicitement hors périmètre), juste une sécurité minimale.
   - Applique le delta à `room.scores`/`room.tokens`, même patron que les
     branches de scoring existantes (voir ci-dessus).
   - `io.to(code).emit('score:adjust', { playerId, delta, total })`.

2. **Client — bouton "+" dans le dock** (`renderLiveClassementDock()`,
   `client/public/js/index.js`) : ajouté par ligne, uniquement quand
   `isHost && roomMode !== 'auto'` (mode "Présenter", MJ seulement — jamais
   visible pour un simple joueur ni en mode "Jouer"). Le `id` du joueur
   (actuellement déstructuré `([, s], idx)`, à devenir `([id, s], idx)`)
   est gardé sur le bouton (closure) pour ouvrir le popup sur la bonne
   cible.

3. **Client — popup d'ajustement** (nouveau markup dans
   `client/public/index.html`, dans le même bloc que les autres overlays
   type `#revealPopupOverlay` ; logique dans `index.js`) : titre avec le
   nom du joueur ciblé, champ numérique (accepte négatif), 2 boutons
   "+200"/"-100" (appliquent directement, voir décision ci-dessus), bouton
   "Valider" (applique la valeur du champ) + bouton fermer/Annuler. Émet
   `socket.emit('score:adjust', { roomCode, playerId, delta })`.

4. **Client — handler `score:adjust`** (`index.js`) : met à jour `scores`
   (même lecture/écriture que le handler `score:update` existant, sans ses
   effets de bord propres à la mécanique de question) puis appelle
   `renderLeaderboard()` immédiatement pour répercuter le changement partout
   (dock + classement plein écran si affiché). Petit retour visuel côté MJ
   dans le popup (ex. confirmation "+200 appliqué à X") pour qu'un clic
   raccourci reste perçu même popup laissé ouvert.

5. **CSS** (`client/public/css/style.css`) : bouton "+" compact aligné avec
   les lignes existantes du dock (`.live-classement-row`), overlay/carte du
   popup sur le patron déjà en place (fond sombre, `.card`-like), boutons
   raccourcis visuellement secondaires par rapport à "Valider".

6. **Vérification en direct** (Browser pane, sockets bruts + vraie page) :
   salle "Présenter" avec hôte + 1-2 joueurs, ajustement +200 puis -100 sur
   un joueur, score répercuté immédiatement dock + classement plein écran +
   côté joueur concerné ; confirmé qu'aucun bouton "+" n'apparaît en salle
   "Jouer" (`roomMode==='auto'`) et qu'un `score:adjust` émis depuis un
   socket NON-hôte est bien ignoré côté serveur.

## Étapes réalisées
- [x] 1. Serveur — évènement `score:adjust` (garde-fous hôte/mode/cible/delta).
- [x] 2. Client — bouton "+" par ligne dans `renderLiveClassementDock()`.
- [x] 3. Client — popup d'ajustement (overlay unique et persistant).
- [x] 4. Client — handler `score:adjust` (mise à jour immédiate, distinct de
      `score:update`).
- [x] 5. CSS — bouton "+" et popup.
- [x] 6. Vérification en direct.

## Checks effectués
- [x] `node --check server/index.js`
- [x] `node --check client/public/js/index.js`
- [x] Démarrage serveur vérifié (`npm start` local, port 3000, sans erreur).
- [x] **Vérification EN DIRECT** (Browser pane, vraie page hôte + sockets
      bruts joueurs) :
  - Salle "Présenter" : bouton "+" visible dans le dock, popup ouvert avec
    le bon nom de joueur, "+200" puis champ personnalisé "50" + "Valider"
    appliqués et répercutés IMMÉDIATEMENT dans le dock (0 → 200 → 250),
    popup resté ouvert entre chaque ajustement (comportement "à la volée"
    voulu), "-100" testé isolément (150 → 50, diff exact -100 confirmé).
  - Sécurité serveur : un `score:adjust` émis par le socket du JOUEUR
    (non-hôte) sur lui-même est bien ignoré (score inchangé).
  - Salle "Jouer" (`roomMode==='auto'`) : bouton "+" absent du dock
    (`hasAdjustBtn: false`) ; un `score:adjust` émis directement par l'hôte
    dans cette salle est bien rejeté côté serveur (`room.mode === 'auto'`
    → return), score inchangé.

## Tests manuels recommandés
Créer une vraie salle "Présenter" à 2-3 joueurs, dérouler une question
normalement, puis en pleine partie utiliser le bouton "+" du dock pour
ajuster le score d'un joueur (+200, -100, valeur libre positive ET
négative) et vérifier que ça se reflète bien aussi sur le classement plein
écran (`renderBoard`, pas seulement le dock testé ici) et sur l'écran du
joueur concerné. Vérifier aussi qu'un ajustement pendant une question
active (pas seulement après révélation) ne perturbe pas le déroulé normal
de la question en cours (timer, soumission de réponse).

## Risques restants
- Le classement PLEIN ÉCRAN (`renderBoard`, affiché entre deux questions)
  n'a été vérifié qu'indirectement : `renderLeaderboard()` appelle bien les
  deux (`renderBoard()` + `renderLiveClassementDock()`), mais la
  vérification en direct de cette étape n'a testé que le dock
  (`#liveClassementDock`), pas visuellement le classement plein écran lui-
  même — à confirmer lors d'un test manuel.
- Pas de retour visuel POUR LE JOUEUR ciblé lui-même (il voit son score
  bouger dans le classement comme n'importe quelle mise à jour, mais rien
  ne signale explicitement "le MJ t'a attribué des points") — non demandé
  dans l'objectif, mais pourrait valoir un petit toast dédié si souhaité.
- Le nom affiché dans `scores`/le dock peut rester "Player"/générique tant
  que `lobby:list` n'a pas encore posé le vrai pseudo (repli déjà existant,
  pas introduit par cette tâche) — sans impact sur le bon fonctionnement de
  l'ajustement (basé sur l'id, pas le nom).

## Statut
`en review`
