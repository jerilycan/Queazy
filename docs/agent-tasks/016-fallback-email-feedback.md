# [016] Repli email pour le signalement de bug

## Contexte
Le bouton "Signaler un bug" (tâche 015) relaie les messages vers un
webhook Discord. Diagnostic fait avec l'utilisateur : ce relais échoue
systématiquement en production (Cloudflare bloque/challenge l'IP de
sortie partagée du plan Render gratuit pour l'API Discord — confirmé,
pas un bug de code ni une URL invalide). Le webhook reste la voie
principale (peut se rétablir un jour, ou fonctionner pour d'autres
utilisateurs sur un autre plan), mais l'utilisateur veut un filet de
secours : si le webhook échoue, tenter un envoi par email.

## Objectif
Quand le relais Discord échoue (`!res.ok` ou exception fetch, voir
`server/index.js` route `/api/feedback`), le serveur tente un envoi par
email via l'API HTTP de **Resend** vers **jeremy.hulewicz@hotmail.fr**
avant de répondre au client. Si l'email part avec succès, le client doit
voir un succès (le joueur n'a pas à savoir qu'il y a eu un repli) ; si
l'email échoue aussi, réponse d'échec comme aujourd'hui.

## Périmètre
- Nouvelle variable d'environnement `RESEND_API_KEY` (comme
  `FEEDBACK_WEBHOOK_URL`, jamais committée, ajoutée par l'utilisateur
  lui-même sur Render — je n'ai pas besoin de sa valeur pour coder).
- Dans `server/index.js`, route `POST /api/feedback` existante : quand le
  relai webhook échoue (branche `!res.ok` ET branche `catch`), tenter un
  envoi via `fetch('https://api.resend.com/emails', ...)` (API HTTP,
  aucune nouvelle dépendance npm — même famille que le fetch webhook déjà
  en place) avec l'en-tête `Authorization: Bearer ${RESEND_API_KEY}`,
  `from: 'onboarding@resend.dev'` (expéditeur par défaut Resend, ne
  nécessite pas de domaine vérifié — fonctionne pour envoyer vers
  l'adresse du propriétaire du compte Resend), `to:
  'jeremy.hulewicz@hotmail.fr'`, sujet + corps reprenant le même contenu
  que le message Discord (salle, type de question, message).
- Si `RESEND_API_KEY` n'est pas configurée : pas de tentative email, on
  garde le comportement actuel (503/502) — même philosophie que
  `FEEDBACK_WEBHOOK_URL` absente, jamais de crash.
- Si le webhook Discord réussit : aucun changement, l'email n'est PAS
  envoyé en plus (c'est un REPLI, pas un envoi systématique en double).
- Le client ne change pas : succès si SOIT le webhook SOIT l'email a
  fonctionné, échec seulement si les deux ont échoué (ou si aucun des
  deux n'est configuré).
- Logs serveur (comme pour le webhook) : tracer quelle voie a
  effectivement livré le message (webhook / email / aucune), utile pour
  suivre si le blocage Cloudflare se résout un jour côté Discord.

## Hors périmètre
- Pas de vérification de domaine Resend (on reste sur l'expéditeur par
  défaut `onboarding@resend.dev`, suffisant pour un envoi vers l'adresse
  du propriétaire du compte).
- Pas de configuration multi-destinataires, pas de template HTML poussé
  — un email texte simple suffit.
- Pas de retry/backoff sur l'un ou l'autre canal — un seul essai chacun,
  comme le webhook aujourd'hui.
- Pas de suppression du webhook Discord existant — il reste la voie
  principale, l'email est un second essai, pas un remplacement.

## Fichiers concernés
- `server/index.js` — route `POST /api/feedback` (bloc déjà en place,
  tâche 015) : ajout de la tentative email en repli dans les deux
  branches d'échec du webhook.
- Pas de fichier `.env`/`render.yaml` modifié — rappel à l'utilisateur
  d'ajouter `RESEND_API_KEY` sur Render (voir Tests manuels).

## Plan
API Resend confirmée (doc officielle) : `POST https://api.resend.com/emails`,
headers `Authorization: Bearer <clé>` + `Content-Type: application/json`,
body JSON `{ "from": "...", "to": "..." | [...], "subject": "...", "text": "..." }`.

1. Ajouter une fonction `sendFeedbackEmail(subject, text)` au niveau module
   (avant `app.post('/api/feedback', ...)`), sur le même modèle que le bloc
   webhook existant :
   - lit `process.env.RESEND_API_KEY?.trim()` ; absent → `return false`
     immédiatement, aucune tentative (même philosophie que
     `FEEDBACK_WEBHOOK_URL` absent) ;
   - `fetch('https://api.resend.com/emails', { method: 'POST', headers:
     { Authorization: 'Bearer ' + clé, 'Content-Type': 'application/json' },
     body: JSON.stringify({ from: 'onboarding@resend.dev', to:
     'jeremy.hulewicz@hotmail.fr', subject, text }) })` ;
   - `!res.ok` → log `app.log.warn` avec le statut + début du corps de
     réponse (même style que le log d'échec webhook), `return false` ;
   - `catch` → log `app.log.warn` avec `err.message || err`, `return false` ;
   - succès → `return true`.
2. Dans la route `POST /api/feedback` :
   - branche `!res.ok` (ligne ~771) : avant de répondre 502, appeler
     `await sendFeedbackEmail(...)`. Si `true` → logger que le repli email a
     pris le relais et répondre `{ ok: true }` (comme si le webhook avait
     marché) ; si `false` → conserver la réponse 502 actuelle.
   - branche `catch` (ligne ~781) : même logique de repli email avant de
     répondre 502.
   - Sujet email : `` `Signalement QuEazy — salle ${roomCode || '—'}` ``.
     Corps : réutiliser la variable `text` déjà construite pour Discord
     (même contenu salle/type de question/message), sans les marqueurs
     markdown Discord (`🐛 **Signalement**` → texte simple pour un email).
   - Log de succès webhook : ajouter une trace explicite ("livré via
     webhook") pour distinguer clairement les 3 issues dans les logs
     (webhook / email / aucune), comme demandé dans le périmètre.
3. Vérifications : `node --check server/index.js`, démarrage `npm start`
   dans `server/`, test `curl` local de `/api/feedback` sans
   `RESEND_API_KEY` ni `FEEDBACK_WEBHOOK_URL` (doit rester silencieux,
   503 `not_configured` comme aujourd'hui — la fonction email n'est même
   pas atteinte tant que le webhook n'est pas configuré/tenté).

## Étapes réalisées
1. [x] Fonction `sendFeedbackEmail(subject, text)` ajoutée dans
   `server/index.js` (juste avant la route `/api/feedback`) : clé absente
   → `false` immédiat, sinon `POST https://api.resend.com/emails` avec
   `Authorization: Bearer <RESEND_API_KEY>`, `from: 'onboarding@resend.dev'`,
   `to: 'jeremy.hulewicz@hotmail.fr'` ; log `warn` + `false` sur `!res.ok`
   ou `catch`, `true` sur succès.
2. [x] Repli intégré dans les deux branches d'échec du webhook (`!res.ok`
   et `catch`) : appel à `sendFeedbackEmail` avant de répondre — succès
   email → `{ ok: true }` (identique à un succès webhook côté client) +
   log distinguant "livré via email (repli)" ; échec des deux → 502
   `relay_failed` + log "signalement perdu". Ajout d'un log `info` sur
   succès webhook direct, pour tracer les 3 issues possibles dans les logs
   serveur comme demandé.
3. [x] Vérifications : `node --check server/index.js` OK ; serveur démarré
   localement (`npm start`, `PORT=3900`, sans `.env` — `RESEND_API_KEY` et
   `FEEDBACK_WEBHOOK_URL` absentes) ; `curl -X POST /api/feedback` avec un
   message valide → **503 `not_configured`**, comportement identique à
   avant la modif (la route s'arrête avant même d'atteindre le webhook ou
   l'email quand `FEEDBACK_WEBHOOK_URL` est absente — `sendFeedbackEmail`
   n'est jamais appelée dans ce cas, exactement comme prévu au Périmètre).

## Checks effectués
- [x] `node --check server/index.js`
- [x] Démarrage serveur vérifié (`npm start` dans `server/`, boot sans
      erreur, port 3900 utilisé pour ne pas entrer en conflit avec une
      instance existante)
- [x] Comportement sans `RESEND_API_KEY` vérifié (pas de crash, 503
      `not_configured` — même réponse qu'aujourd'hui, car
      `FEEDBACK_WEBHOOK_URL` est également absente dans ce sandbox local)

## Tests manuels recommandés
- Une fois `RESEND_API_KEY` configurée sur Render (à faire par
  l'utilisateur, voir Périmètre) : déclencher "Signaler un bug" en jeu.
  Le webhook Discord va très probablement continuer à échouer (blocage
  Cloudflare déjà diagnostiqué en tâche 015) — c'est exactement le
  scénario qui doit déclencher le repli email. Vérifier :
  - le client voit un succès (le signalement "passe"),
  - un email arrive bien sur jeremy.hulewicz@hotmail.fr (sujet
    `Signalement QuEazy — salle XXXX`, corps = salle/type de
    question/message),
  - les logs Render montrent la ligne "signalement livré via email
    (repli, webhook Discord en échec)".
- Vérifier aussi côté logs Render qu'un signalement sans aucune des deux
  clés configurées (avant l'ajout de `RESEND_API_KEY`) redonne bien le
  503/502 actuel — déjà vérifié en local dans ce sandbox.

## Risques restants
- Le domaine `resend.dev` (expéditeur par défaut) peut lui aussi être
  soumis à du rate-limiting/filtrage selon les fournisseurs mail
  destinataires (Hotmail/Outlook a ses propres filtres anti-spam) — à
  vérifier en conditions réelles une fois `RESEND_API_KEY` configurée.
- Pas de test réel effectué avec une vraie clé Resend (aucune clé
  disponible dans ce sandbox, conformément au périmètre) — seul le
  comportement "clé absente" a pu être vérifié en local.

## Statut
`en review`
