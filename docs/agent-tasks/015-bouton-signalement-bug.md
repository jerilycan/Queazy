# [015] Bouton "Signaler un bug"

## Contexte
L'utilisateur veut un moyen simple pour ses joueurs de remonter un
problème pendant une partie, sans passer par un canal externe. Décision
déjà prise avec l'utilisateur (2 questions tranchées) : le message part
vers un webhook Discord/Slack déjà existant côté utilisateur (pas de
nouvelle table Supabase, pas de mailto, pas de formulaire externe), et le
bouton vit dans le menu IRL/à distance déjà en place (roue crantée en
haut à droite pendant une partie IRL/à distance), à côté de "Quitter le
salon".

## Objectif
Un joueur en pleine partie IRL/à distance peut ouvrir le menu roue
crantée, cliquer "Signaler un bug", taper un message libre, l'envoyer, et
ce message arrive dans le salon Discord/Slack de l'utilisateur avec assez
de contexte pour être exploitable (au minimum le code de la salle).
L'URL du webhook ne doit JAMAIS être exposée au client (elle vit
uniquement côté serveur, dans une variable d'environnement que
l'utilisateur ajoutera lui-même sur Render).

## Périmètre
- Nouveau bouton `#irlReportBugBtn` (ou nom similaire) dans
  `#irlMenuDropdown` (`client/public/index.html`), à côté de
  `#irlLeaveBtn`, cohérent visuellement (`.irl-menu-item`).
- Petite modale (nouveau markup, pas de composant générique de saisie de
  texte existant dans `QzUI` — seulement `confirm`/`toast`/`tour`,
  voir `ui-widgets.js`) : un `<textarea>` pour le message libre + bouton
  d'envoi. Fermeture par clic extérieur/Échap, cohérent avec les autres
  overlays déjà en place (ex. `#qrExpandOverlay`).
- Contexte envoyé avec le message : au minimum le code de la salle
  (`roomInput.value`/équivalent déjà utilisé ailleurs), et si simple à
  obtenir sans effort, le type de question affichée au moment de l'envoi
  (`currentQuestionType`) — best effort, ne bloque rien si absent (ex.
  envoyé depuis le lobby).
- Nouvel endpoint serveur `POST /api/feedback` (`server/index.js`, même
  famille que les `app.post('/api/room-...')` déjà en place) : reçoit
  `{ message, roomCode, questionType }`, valide/borne la longueur du
  message (éviter un texte énorme ou vide), relaie vers le webhook via
  `fetch(process.env.FEEDBACK_WEBHOOK_URL, { method: 'POST', ... })` (API
  `fetch` déjà globale en Node 22, aucune nouvelle dépendance npm
  nécessaire). Si `FEEDBACK_WEBHOOK_URL` n'est pas définie (utilisateur
  n'a pas encore configuré la variable), répondre proprement (ex. 503)
  plutôt que planter — le bouton doit rester silencieusement inoffensif
  tant que ce n'est pas configuré, pas casser l'appli.
- Retour visuel côté client après envoi (toast succès/erreur via
  `window.QzUI.toast`, déjà utilisé partout ailleurs).
- Limiter les abus basique (ex. bouton désactivé pendant l'envoi, pas de
  double-clic) — pas de rate-limiting serveur sophistiqué, hors périmètre
  explicite (voir plus bas).

## Hors périmètre
- **`render.yaml` non touché** : l'ajout de la variable d'environnement
  `FEEDBACK_WEBHOOK_URL` sur Render se fait par l'utilisateur lui-même
  dans le dashboard Render, pas dans ce fichier (secret, jamais committé).
  Je n'ai pas besoin de connaître l'URL réelle du webhook pour coder
  cette tâche.
- Pas de nouvelle table Supabase, pas de persistance des retours côté
  appli (le webhook Discord/Slack EST le stockage, décision déjà prise).
- Pas de bouton équivalent ailleurs que le menu IRL/à distance (pas dans
  la navbar générale, pas côté hôte spécifiquement, pas dans l'éditeur) —
  peut être étendu plus tard si demandé, mais pas dans cette tâche.
- Pas de rate-limiting serveur avancé (par IP, par salle...) — juste le
  garde-fou basique côté client (bouton désactivé pendant l'envoi) +
  bornage de la longueur du message côté serveur.
- Pas de pièce jointe (capture d'écran, etc.) — texte seul.

## Fichiers concernés
- `client/public/index.html` — bouton `#irlReportBugBtn` dans
  `#irlMenuDropdown` (à côté de `#irlLeaveBtn`), nouvelle modale de
  saisie (markup, `d-none` par défaut).
- `client/public/js/index.js` — DOM refs, ouverture/fermeture de la
  modale (même esprit que le toggle du menu roue crantée déjà en place,
  ~ligne 4102 et suivantes), construction du payload (message + code de
  salle + type de question si disponible), appel `fetch('/api/feedback', ...)`,
  retour visuel via `window.QzUI.toast`.
- `server/index.js` — nouvel `app.post('/api/feedback', ...)` (même
  famille que les routes `/api/room-*` déjà en place, ~ligne 606 et
  suivantes pour le style à reprendre), lecture de
  `process.env.FEEDBACK_WEBHOOK_URL`, relai `fetch()` vers le webhook,
  validation/bornage du message.
- `client/public/css/style.css` — styles de la nouvelle modale
  (cohérents avec les tokens existants, pas de nouvelle feuille).
- Pas de fichier `.env`/`render.yaml` créé ou modifié dans cette tâche
  (voir Hors périmètre) — juste un rappel dans "Tests manuels
  recommandés" que l'utilisateur doit ajouter la variable lui-même.

## Plan

**Zones interdites CLAUDE.md — vérifié en explorant, aucune touchée :**
- Pas de nouvelle dépendance npm : `server/package.json` liste seulement
  `fastify`, `@fastify/static`, `@fastify/compress`, `@supabase/supabase-js`,
  `socket.io`. `fetch()` est déjà utilisé tel quel (sans import) dans
  `checkStorageUsage` (server/index.js:153) et `render.yaml` fixe
  `NODE_VERSION: 20` → `fetch` global déjà présent en prod, aucun ajout
  nécessaire.
- Pas de `render.yaml` touché (confirmé, la variable d'env se rajoute à la
  main par l'utilisateur sur Render, déjà noté dans le fichier de suivi).
- Pas de `supabase/schema.sql` touché (aucune persistance, le webhook est
  le seul "stockage").

**Pattern de référence trouvé** : `checkStorageUsage` (server/index.js:134-164)
est exactement le pattern "webhook Discord optionnel" à reprendre : lire
`process.env.XXX_WEBHOOK_URL`, si absent → log `app.log.warn` + sortie
propre (pas de crash), sinon `fetch(url, { method:'POST', headers:
{'Content-Type':'application/json'}, body: JSON.stringify({content: ...}) })`
puis vérifier `res.ok`. Le format Discord webhook attend `{ content: "texte" }`.

Les routes `/api/room-*` (server/index.js:606-737) sont définies **à
l'intérieur** de `const start = async () => { const rooms = new Map(); ... }`
(server/index.js:306-307) car elles ont besoin de `rooms`. `/api/feedback`
n'a pas besoin de `rooms`, mais le cadrage demande explicitement la "même
famille" que ces routes pour le style — je les mets donc au même endroit
(juste après le bloc `/api/room-audio`, avant `await refreshMinPointsFloor()`
ligne 739) plutôt qu'au niveau racine avec `/api/quizz` : cohérence de
lecture (toutes les routes "en jeu" groupées) plus importante ici que la
portée technique inutilisée de `rooms`.

Modale de référence à imiter pour ouverture/fermeture (clic extérieur +
Échap) : `qzConfirm` dans `client/public/js/ui-widgets.js:205-240` — PAS
`#qrExpandOverlay` (qui se ferme au clic n'importe où, y compris sur son
propre contenu, différent de ce qui est demandé ici) ni les popups
`.modal-overlay` existantes d'index.html (`personalizationPopup`,
`tutoVideosModal`) qui n'ont qu'un bouton "fermer", pas de clic
extérieur/Échap. Le pattern exact à copier : `overlay.addEventListener(
'mousedown', e => { if (e.target === overlay) close() })` +
`document.addEventListener('keydown', e => { if (e.key==='Escape') close()
})`, retirés proprement à la fermeture. Markup basé sur `.modal-overlay` /
`.modal-content card max-w-500` (déjà stylés en CSS) + classes utilitaires
existantes (`btn`, `btn-primary`, `h-48`, `w-full`, `d-flex gap-sm
justify-end`) — pas de nouvelle feuille de style requise pour l'ossature ;
seul un éventuel ajustement fin (ex. compteur de caractères) irait dans
`style.css`.

`currentQuestionType` (client/public/js/index.js:814, mis à jour ligne
5102) est une variable globale du fichier, lisible depuis n'importe quel
handler ajouté plus bas — pas besoin de la faire remonter autrement.
`roomInput` (élément `#room`) est déjà utilisé partout ailleurs
(`roomInput.value.trim()`) pour le code de salle courant.

---

### Étape 1 — Serveur : `POST /api/feedback`
Fichier : `server/index.js`.
- Ajouter juste après le bloc `/api/room-audio` (avant `await
  refreshMinPointsFloor()`, ~ligne 738) :
  - Constante `FEEDBACK_MESSAGE_MAX_LENGTH` (ex. 2000) à côté des autres
    constantes de bornage du fichier (style `MAX_NAME_LENGTH`).
  - `app.post('/api/feedback', async (req, reply) => { ... })` :
    - lit `message`, `roomCode`, `questionType` depuis `req.body`
    - valide `message` : `typeof string`, `.trim()` non vide, longueur
      `<= FEEDBACK_MESSAGE_MAX_LENGTH` → sinon `reply.code(400).send({error:
      'invalid_message'})`
    - `roomCode`/`questionType` : best-effort, `typeof string` sinon
      ignorés silencieusement (pas de 400 pour ça — cohérent avec "n'importe
      quoi côté client ne doit pas bloquer l'envoi du message principal")
    - lit `process.env.FEEDBACK_WEBHOOK_URL` ; absent → `app.log.warn(...)`
      + `reply.code(503).send({error: 'not_configured'})` (comportement
      "silencieusement inoffensif" demandé dans le cadrage)
    - construit le texte Discord avec contexte (ex. \`🐛 **Signalement**\n
      Salle: ${roomCode || '—'} · Question: ${questionType || '—'}\n\n
      ${message}\`)
    - `fetch(webhookUrl, { method: 'POST', headers: {'Content-Type':
      'application/json'}, body: JSON.stringify({ content: text }) })`
      dans un `try/catch` (réseau down) → `catch` log + `reply.code(502)
      .send({error: 'relay_failed'})`, `!res.ok` → même traitement
    - succès → `return { ok: true }`
- Trade-off : pas de rate-limiting serveur (explicitement hors périmètre) —
  seule protection : bornage de longueur + le garde-fou client (bouton
  désactivé pendant l'envoi, étape 3).
- Check : `node --check server/index.js`, puis proposer `npm start` dans
  `server/` pour vérifier le boot (la route doit apparaître sans erreur
  même sans `FEEDBACK_WEBHOOK_URL` définie).

### Étape 2 — HTML : bouton + markup de la modale
Fichier : `client/public/index.html`.
- Ajouter `<button type="button" id="irlReportBugBtn" class="irl-menu-item">
  🐛 Signaler un bug</button>` juste avant `#irlLeaveBtn` dans
  `#irlMenuDropdown` (~ligne 402) — avant "Quitter" plutôt qu'après : une
  action non destructive placée avant l'action destructive, cohérent avec
  la convention UI habituelle (option prudente avant option risquée).
- Ajouter la modale en fin de fichier, dans le même groupe que les autres
  overlays (`#qrExpandOverlay`) ou `.modal-overlay` (`personalizationPopup`,
  `tutoVideosModal`) pour rester group é avec les popups existantes :
  ```html
  <div id="reportBugOverlay" class="modal-overlay d-none">
    <div class="modal-content card max-w-500">
      <div class="d-flex justify-between align-center mb-lg">
        <h2 class="font-28">Signaler un bug</h2>
        <button type="button" id="reportBugCloseBtn" class="btn-close">&times;</button>
      </div>
      <textarea id="reportBugMessage" rows="4" class="w-full mb-lg"
        maxlength="2000" placeholder="Décris ce qui ne va pas..."></textarea>
      <div class="d-flex gap-sm justify-end">
        <button type="button" id="reportBugSendBtn" class="btn btn-primary h-48">Envoyer</button>
      </div>
    </div>
  </div>
  ```
  (id/texte à ajuster librement à l'implémentation, pas figé ici).
- Trade-off : pas de bouton "Annuler" séparé — le clic extérieur/Échap
  couvre déjà l'annulation, cohérent avec `qzConfirm` qui, lui, a besoin
  d'un bouton Annuler dédié uniquement parce qu'il a aussi un bouton OK à
  distinguer ; ici il n'y a qu'une seule action possible (envoyer).
- Check : `node --check` non pertinent (HTML) ; vérification visuelle
  reportée à la fin de l'étape 3 (le markup seul, `d-none`, ne montre rien).

### Étape 3 — JS : ouverture/fermeture + envoi
Fichier : `client/public/js/index.js`.
- DOM refs à côté des autres (`irlMenuBtn`/`irlMenuDropdown`/`irlLeaveBtn`,
  ~ligne 716) : `irlReportBugBtn`, `reportBugOverlay`, `reportBugMessage`,
  `reportBugSendBtn`, `reportBugCloseBtn`.
- Ouverture : sur clic `irlReportBugBtn` → fermer le dropdown roue crantée
  (même 2 lignes que `irlLeaveBtn.onclick`) puis `reportBugOverlay.classList
  .remove('d-none')` + focus sur le textarea.
- Fermeture (mousedown sur l'overlay lui-même OU `Escape` OU clic sur
  `reportBugCloseBtn`) : `classList.add('d-none')`, vider le textarea.
  Écouteurs posés une seule fois au chargement (comme `qrExpandOverlay`),
  pas re-créés à chaque ouverture — pas de fuite de listener à gérer.
- Envoi (`reportBugSendBtn.onclick`) :
  - lire `reportBugMessage.value.trim()` ; vide → ne rien envoyer (bouton
    reste actif, pas d'erreur nécessaire, le `maxlength` HTML couvre déjà
    le trop-long)
  - désactiver `reportBugSendBtn` (`disabled = true`) le temps de l'appel,
    le réactiver dans un `finally`
  - `fetch('/api/feedback', { method: 'POST', headers: {'Content-Type':
    'application/json'}, body: JSON.stringify({ message, roomCode:
    roomInput.value.trim() || null, questionType: currentQuestionType ||
    null }) })`
  - succès (`res.ok`) → `window.QzUI.toast('Signalement envoyé, merci !',
    'success')`, fermer la modale, vider le textarea
  - échec (webhook non configuré 503, erreur relais 502, ou réseau) →
    `window.QzUI.toast('Envoi impossible, réessaie plus tard.', 'error')`,
    modale reste ouverte (le joueur ne perd pas son texte tapé)
- Trade-off : pas de distinction de message d'erreur entre "webhook pas
  configuré côté hôte" (503) et "panne réseau" (502/catch) — un seul
  message générique côté joueur, qui n'a de toute façon aucune action à
  en tirer dans les deux cas (ce n'est pas lui qui peut configurer la
  variable d'env).
- Check : `node --check client/public/js/index.js`, puis vérification
  visuelle Browser pane (ouvrir le menu roue crantée en pleine partie,
  ouvrir la modale, taper un message, envoyer avec/sans
  `FEEDBACK_WEBHOOK_URL` définie en local pour voir les 2 toasts).

### Étape 4 — CSS (si besoin après l'étape 2/3)
Fichier : `client/public/css/style.css`.
- A priori aucun style nouveau strictement nécessaire : `.modal-overlay`/
  `.modal-content`/`.card`/`.btn`/`.btn-primary`/`.btn-close`/`w-full`
  couvrent déjà l'essentiel (mêmes classes que `personalizationPopup`).
  Cette étape ne sera concrétisée que si la vérification visuelle de
  l'étape 3 révèle un ajustement nécessaire (ex. hauteur du textarea,
  espacement) — pas de règle écrite à l'aveugle avant d'avoir vu le rendu.
- Trade-off : risque de sur-anticiper des styles inutiles si écrit avant
  la vérification visuelle — d'où le choix de la traiter en dernier,
  conditionnelle.

---

**Rappel pour "Tests manuels recommandés"** (à remplir au fil de
l'implémentation, mais déjà identifié) : tester explicitement le cas
`FEEDBACK_WEBHOOK_URL` absente (comportement par défaut tant que
l'utilisateur ne l'a pas ajoutée sur Render) pour confirmer le 503 propre
sans crash serveur, comme demandé dans "Risques restants".

## Étapes réalisées
- [x] **Étape 1 — Serveur `POST /api/feedback`** : ajout de
  `FEEDBACK_MESSAGE_MAX_LENGTH` (2000, à côté de `MAX_NAME_LENGTH`,
  server/index.js) et de la route `app.post('/api/feedback', ...)` juste
  après le bloc `/api/room-audio`, avant `refreshMinPointsFloor()`. Valide
  `message` (string non vide, `<= 2000` → 400 `invalid_message`),
  `roomCode`/`questionType` best-effort (ignorés silencieusement si pas
  string). Lit `process.env.FEEDBACK_WEBHOOK_URL` : absent → `app.log.warn`
  + 503 `not_configured` ; sinon relaie le texte formaté vers le webhook
  Discord (`fetch` + `{content: ...}`), `try/catch` + `!res.ok` → 502
  `relay_failed`. Succès → `{ ok: true }`. Reprend exactement le pattern de
  `checkStorageUsage`.
- [x] **Étape 2 — HTML bouton + modale** : bouton `#irlReportBugBtn`
  (🐛 Signaler un bug) ajouté dans `#irlMenuDropdown`, juste avant
  `#irlLeaveBtn` (client/public/index.html). Modale `#reportBugOverlay`
  ajoutée en fin de fichier, groupée avec `personalizationPopup` (mêmes
  classes `.modal-overlay`/`.modal-content card max-w-500`), markup
  identique à celui proposé dans le plan.
- [x] **Étape 3 — JS ouverture/fermeture + envoi** : DOM refs ajoutées à
  côté d'`irlLeaveBtn` (client/public/js/index.js). Ouverture via
  `irlReportBugBtn.onclick` (ferme le dropdown roue crantée, affiche la
  modale, focus textarea). Fermeture centralisée dans
  `closeReportBugOverlay()` (vide le textarea), câblée une seule fois au
  chargement sur mousedown-overlay (clic extérieur uniquement, pas sur le
  contenu), `Escape`, et le bouton de fermeture — même pattern que
  `qzConfirm`. Envoi : garde-fou message vide (ne rien envoyer),
  `disabled = true` pendant l'appel / réactivé en `finally`, `fetch`
  POST vers `/api/feedback` avec `message`, `roomCode` (`roomInput.value`),
  `questionType` (`currentQuestionType`), toast succès + fermeture modale
  si `res.ok`, toast erreur générique (modale reste ouverte, texte
  préservé) sinon — y compris en cas d'exception réseau (`catch`).
- [x] **Étape 4 — CSS** : non nécessaire. Vérifié visuellement (voir
  Checks effectués) que `.modal-overlay`/`.modal-content card max-w-500`
  suffisent (gradient de fond, ombre, arrondis, centrage — identiques à
  `personalizationPopup`) ; aucune règle ajoutée dans `style.css`.

## Checks effectués
- [x] `node --check server/index.js` → OK
- [x] `node --check client/public/js/index.js` → OK
- [x] Démarrage serveur vérifié : redémarrage du serveur de preview local
  après les modifs, boot sans erreur (`preview_logs` propre), y compris
  **sans** `FEEDBACK_WEBHOOK_URL` définie (état par défaut de ce sandbox).
- [x] Vérification visuelle/fonctionnelle Browser pane (screenshot non
  disponible dans ce sandbox — pane sans compositing, cf. limitation
  connue — vérifié à la place via DOM/JS + computed styles + réseau) :
  - `curl` direct sur `/api/feedback` : message vide/whitespace → 400
    `invalid_message` ; message valide sans webhook configuré → 503
    `not_configured`.
  - Ouverture de la modale via clic sur `#irlReportBugBtn` : overlay passe
    de `d-none` à visible, focus posé sur le textarea.
  - Fermeture par `Escape` : overlay recaché, textarea vidé.
  - Clic sur le contenu de la modale (`mousedown` sur `.modal-content`) :
    ne ferme PAS ; `mousedown` sur l'overlay lui-même : ferme.
  - Envoi avec message non vide, webhook absent : requête réseau confirmée
    (`read_network_requests` → `POST /api/feedback → 503`), toast rouge
    `⚠️ Envoi impossible, réessaie plus tard.` affiché, modale reste
    ouverte, texte tapé conservé, bouton réactivé après l'appel (pas de
    blocage).
  - Envoi avec message vide/espaces uniquement : aucune requête, aucun
    toast (garde-fou respecté).
  - Fermeture via `#reportBugCloseBtn` : overlay recaché, textarea vidé.
  - Styles rendus : `.modal-content` a bien le gradient de fond, l'ombre,
    les coins arrondis et le centrage attendus (mêmes tokens que
    `personalizationPopup`), confirmant qu'aucun CSS nouveau n'est requis.
  - Aucune erreur console imputable au code ajouté (le seul `[error]`
    lié est le 503 réseau attendu, volontairement non bloquant côté
    client ; les 2 autres `ERR_FAILED` sont du bruit socket.io sans
    rapport, onglet non connecté à une vraie partie).

## Tests manuels recommandés
- **Ajouter `FEEDBACK_WEBHOOK_URL` sur Render** (dashboard, jamais dans
  `render.yaml`/`.env`) avec l'URL réelle du webhook Discord/Slack, puis
  vérifier en conditions réelles que le message arrive bien dans le salon
  avec le bon format (`🐛 **Signalement** / Salle: XXXXX · Question: yyy`
  suivi du texte) — impossible à vérifier depuis ce sandbox (pas d'accès à
  la vraie URL du webhook, cf. Hors périmètre de la tâche).
- Vérifier le cas où le webhook répond une erreur HTTP réelle (mauvaise
  URL, webhook supprimé côté Discord) : doit donner 502 côté serveur et le
  même toast générique côté client — testé uniquement en simulation logique
  (code relu), pas en conditions réelles faute d'URL de webhook.
- Test en vraies conditions de jeu (pas seulement via DOM/JS dans ce
  sandbox) : ouvrir une vraie partie IRL et une vraie partie à distance,
  ouvrir le menu roue crantée, vérifier que le bouton "Signaler un bug"
  est visible et bien placé au-dessus de "Quitter le salon" sur mobile et
  desktop (rendu visuel réel non vérifiable ici, pas de compositing
  disponible dans ce sandbox — cf. limitation connue "Navigateur sandbox
  sans rAF").
- Vérifier que `roomCode` et `questionType` remontent correctement dans le
  message Discord pendant une vraie question en cours (ce sandbox n'a
  testé que l'envoi hors contexte de partie active, avec `roomCode`/
  `questionType` vides par construction).
- Double-vérifier qu'aucun double-envoi n'est possible en cliquant très
  vite plusieurs fois sur "Envoyer" en conditions réelles (le `disabled`
  a été vérifié logiquement mais pas sous clic humain rapide réel).

## Risques restants
- Le contenu exact du message Discord (mise en forme, emoji, longueur
  réelle une fois `FEEDBACK_WEBHOOK_URL` configurée) n'a pas pu être
  vérifié en conditions réelles — seul le code a été relu et le flux HTTP
  jusqu'au 503 a été testé.
- Pas de rate-limiting serveur (accepté et documenté comme hors périmètre
  dans le cadrage) : un joueur mal intentionné pourrait tout de même
  spammer `/api/feedback` en dehors de l'UI (ex. via curl), le seul
  garde-fou serveur étant le bornage de longueur du message. Risque jugé
  acceptable par le cadrage initial, mais à garder en tête si le webhook
  Discord venait à recevoir un flot anormal de messages.
- Vérification visuelle réelle (rendu pixel, positionnement mobile) non
  faite faute de compositing disponible dans ce sandbox — seule une
  vérification DOM/computed-styles a été possible (voir Checks effectués).

## Statut
`en review`
