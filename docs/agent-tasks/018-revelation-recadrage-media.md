# [018] Recadrage de l'image et découpe du son à la révélation

## Contexte
Suite à la tâche 017 (image et son optionnels à la révélation), deux
retours utilisateur :
1. L'image de révélation ne peut pas être recentrée/recadrée — alors que
   ce geste existe déjà ailleurs dans l'éditeur (association, intrus) via
   une popup dédiée (`openImageCropModal`, `editor.js`).
2. Le son de révélation est aujourd'hui **rejeté en bloc** s'il dépasse 15
   secondes (tâche 017) — l'utilisateur veut pouvoir choisir QUELLE portion
   de 15s garder via une popup de découpe, plutôt qu'un refus sec.

En creusant le code pour brancher le recadrage d'image, **un bug bloquant
de la tâche 017 a été découvert** : `q.revealImage`/`q.revealAudio` ne sont
jamais transmis en jeu. Deux listes blanches distinctes oublient ces deux
champs :
- `emitQuestion` côté hôte (`client/public/js/index.js` ~ligne 4874) :
  construit le payload envoyé au serveur champ par champ (comme
  `explanation` juste à côté) — `revealImage`/`revealAudio` n'y figurent
  pas du tout.
- L'objet `question` autoritaire côté serveur (`server/index.js`
  ~ligne 1506, dans le handler `question:show`) : reconstruit lui aussi le
  question à partir d'une liste blanche de champs du payload — même oubli.

Résultat : `question.revealPayload.revealImage`/`revealAudio` (ajoutés en
tâche 017 dans `revealQuestion()`) valent toujours `undefined` en pratique,
quoi que le créateur ait configuré dans l'éditeur. La fonctionnalité livrée
en 2.9.0 ne fonctionne donc pas encore en jeu. C'est le même piège que
plusieurs commentaires du code documentent déjà pour d'autres champs
(q.image, q.audio, q.zones oubliés par le passé, voir les commentaires
autour de la ligne 1506 de `server/index.js`).

## Objectif
1. Le son et l'image de révélation configurés dans l'éditeur arrivent
   réellement en jeu (correction du bug de câblage ci-dessus).
2. Un créateur peut recentrer/recadrer l'image de révélation exactement
   comme pour "association"/"intrus" (glisser + molette/pincement, popup
   dédiée).
3. Un créateur qui sélectionne un son de révélation plus long que 15s se
   voit proposer une popup de découpe (façon Blind Test : forme d'onde,
   poignées de sélection, aperçu), pas un refus sec. Un son déjà ≤ 15s est
   accepté tel quel, sans popup forcée.

## Périmètre
- **Correctif de câblage (prioritaire, bloquant)** :
  - `client/public/js/index.js`, `emitQuestion` (~ligne 4874) : ajouter
    `revealImage: q.revealImage || undefined, revealAudio: q.revealAudio
    || undefined,` au payload, juste à côté de `explanation`. Ces deux
    champs sont **toujours déjà des URLs `https://`** au moment où une
    partie démarre (ils n'existent que depuis la tâche 017, uploadés au
    save via `uploadQuestionMedia` — contrairement à `q.illustration`/
    `q.audio`, aucun ancien quiz ne peut avoir une version base64 non
    migrée de ces deux champs) : **pas besoin** du relais HTTP
    `uploadRoomImage`/`uploadRoomAudio` (`room.pendingImage`/
    `pendingAudio` sont des slots UNIQUES par salle, déjà utilisés pour
    l'illustration/l'audio blindtest de la même question — les réutiliser
    ici collisionnerait). Passthrough direct, comme `explanation`.
  - `server/index.js`, construction de l'objet `question` autoritaire
    dans le handler `question:show` (~ligne 1506) : ajouter
    `revealImage: payload?.revealImage || undefined, revealAudio:
    payload?.revealAudio || undefined` à la liste blanche.
  - `server/index.js`, destructuring `payloadWithoutCorrectOrExplanation`
    (~ligne 1522) : ajouter `revealImage`/`revealAudio` (et les deux
    nouveaux champs de cadrage ci-dessous, `revealPos`/`revealBg`) à la
    liste des champs RETIRÉS du `broadcastPayload` — même raison que
    `explanation` : ne jamais laisser un joueur les lire en devtools
    (`question:show`) avant la révélation officielle. Sans ce retrait, le
    correctif ci-dessus introduirait une fuite (le spoil serait visible
    dès le début de la question).
- **Recadrage de l'image** : réutilisation telle quelle de
  `openImageCropModal` (`editor.js`) pour l'image de révélation.
  Convention de nommage déjà en place ailleurs (`imgField.replace('Image',
  'Pos'|'Bg')`) : `q.revealImage` → `q.revealPos` (`{x,y,zoom}`) et
  `q.revealBg` (couleur dominante). Transmission en jeu : mêmes deux
  nouveaux champs ajoutés au payload `emitQuestion`/`question:show`
  (purement cosmétiques, jamais validés côté serveur — comme
  `pair.aPos`/`bPos`) et au `revealPayload`. Affichage : `#revealImageDisplay`
  doit être enveloppé d'un conteneur `position:relative;overflow:hidden`
  (comme `.assoc-item-img-wrap`) et utiliser `applyCropTransform`
  (dupliquée côté `index.js`, déjà utilisée pour association/intrus) au
  lieu d'un simple `<img src>` plein cadre.
- **Découpe du son** : nouvelle popup de découpe pour le son de
  révélation, sur le même principe visuel que le composant Blind Test
  existant (`#audioTrimWrap`, forme d'onde `renderWaveform`, poignées de
  sélection, `encodeWavMono`) mais **autonome** (sa propre popup avec ses
  propres éléments DOM créés à la volée, pas un partage d'état avec les
  variables module `pendingAudioBuffer`/`audioStartInput`/etc. déjà
  utilisées par Blind Test — même philosophie de duplication volontaire
  que `computeCropGeometry`, dupliquée entre `editor.js` et `index.js`
  pour la même raison), plafonnée à **15 secondes max** de sélection
  (au lieu de 30 pour Blind Test). Un fichier déjà ≤ 15s est accepté
  directement (pas de popup forcée, juste l'aperçu existant). Un fichier
  plus long ouvre la popup, découpe obligatoire avant validation.

## Hors périmètre
- Pas de changement du composant Blind Test existant (juste inspiration/
  réutilisation de logique, pas de refactor commun forcé).
- Pas de limite de poids en plus de la limite de durée (déjà tranché en
  tâche 017).
- Pas de correctif d'autres champs éventuellement oubliés dans les mêmes
  listes blanches au-delà de `revealImage`/`revealAudio`/`revealPos`/
  `revealBg` — strictement ce qui concerne cette tâche.

## Fichiers concernés
- `client/public/js/index.js` — correctif `emitQuestion` (payload),
  affichage recadré de `#revealImageDisplay` (wrapper + `applyCropTransform`),
  nettoyage à l'écran suivant.
- `server/index.js` — correctif de la liste blanche `question` (handler
  `question:show`) et du retrait de `broadcastPayload`, `revealPayload`
  dans `revealQuestion()` (ajout `revealPos`/`revealBg`).
- `client/public/js/editor.js` — branchement du clic sur l'aperçu image de
  révélation vers `openImageCropModal` ; nouvelle popup de découpe audio
  pour le son de révélation.
- `client/public/index.html` — wrapper autour de `#revealImageDisplay`
  pour le recadrage.
- `client/public/css/style.css` — classes du wrapper de recadrage en jeu
  et de la popup de découpe audio (peut réutiliser une bonne partie de
  `.audio-trim-wrap`/`.audio-waveform*` existantes si la popup les cible
  par les mêmes classes, adaptées à un contexte `.modal-content`).

## Plan
1. **Correctif de câblage critique** : les 3 modifications décrites plus
   haut (`emitQuestion`, whitelist serveur, retrait du broadcast) — à
   faire et vérifier EN PREMIER, indépendamment du reste, avec un test
   manuel dédié si possible (ou au moins une relecture attentive des 3
   points de câblage, le login éditeur restant hors de portée de l'agent).
2. **Éditeur — recadrage image** : rendre `#revealImagePreviewImg`
   cliquable (comme les vignettes association/intrus) → `openImageCropModal`
   → sauvegarde `q.revealPos`/`q.revealBg`. Réinitialiser `revealPos`/
   `revealBg` si l'image est remplacée/retirée.
3. **Éditeur — popup de découpe audio** : nouvelle fonction (ex.
   `openAudioTrimModal(file, maxDuration, onConfirm)`) : décode le fichier
   sélectionné, si `duration <= 15` → passe directement en dataURL comme
   aujourd'hui (pas de popup) ; sinon ouvre une popup avec forme d'onde +
   poignées + steppers début/durée (durée plafonnée à 15s) + aperçu +
   bouton "Utiliser cet extrait" → encode l'extrait choisi en WAV mono,
   ferme la popup, appelle `onConfirm(dataUrl)`. Remplace le rejet sec
   actuel dans le handler `onchange` du son de révélation (`editor.js`,
   ajouté en tâche 017).
4. **Transmission en jeu** : ajouter `revealPos`/`revealBg` au payload
   `emitQuestion` et à la whitelist serveur/`revealPayload` (même
   traitement que `revealImage`/`revealAudio` à l'étape 1).
5. **Affichage en jeu recadré** : envelopper `#revealImageDisplay` d'un
   conteneur adapté (`position:relative;overflow:hidden`, CSS dédiée) et
   appeler `applyCropTransform` avec `payload.revealPos` une fois l'image
   chargée, au lieu du `<img src>` direct actuel.
6. **Checks** : `node --check` sur les 3 fichiers JS modifiés ; démarrage
   `npm start` ; vérification visuelle Browser pane de tout ce qui ne
   nécessite pas de session connectée (structure DOM/CSS des nouvelles
   popups, absence d'erreur console) — documenter clairement, comme en
   tâche 017, ce qui reste à tester manuellement par l'utilisateur connecté
   (recadrage réel d'une image, découpe réelle d'un son, partie de test
   pour confirmer que le correctif de câblage fonctionne vraiment de bout
   en bout).

## Étapes réalisées
1. **Correctif de câblage critique** (bloquant, fait en premier) :
   - `client/public/js/index.js`, `emitQuestion` : ajout de
     `revealImage`/`revealAudio`/`revealPos`/`revealBg` au payload, juste à
     côté de `explanation` (passthrough direct, pas de relais HTTP — mêmes
     raisons que documentées dans le fichier de suivi).
   - `server/index.js`, construction de l'objet `question` autoritaire dans
     le handler `question:show` : ajout des 4 mêmes champs à la liste
     blanche (`revealImage: payload?.revealImage || undefined`, etc.).
   - `server/index.js`, destructuring `payloadWithoutCorrectOrExplanation` :
     ajout de `revealImage, revealAudio, revealPos, revealBg` aux champs
     retirés du `broadcastPayload` (anti-spoil, même traitement
     qu'`explanation`).
   - `server/index.js`, `revealPayload` dans `revealQuestion()` : ajout de
     `revealPos`/`revealBg` (revealImage/revealAudio y étaient déjà depuis
     la tâche 017, mais lisaient un champ jamais peuplé — corrigé par le
     point précédent).
2. **Éditeur — recadrage image** (`client/public/js/editor.js`) :
   - `#revealImagePreviewImg` rendue cliquable (curseur pointeur + titre),
     ouvre `openImageCropModal(q.revealImage, q.revealPos, q.revealBg, …)`
     — même convention `imgField.replace('Image','Pos'|'Bg')` que
     `openAssocCropModal`, appliquée directement sur `questions[activeIndex]`
     plutôt que sur une paire.
   - `revealPos`/`revealBg` réinitialisés (`delete`) quand l'image est
     remplacée (upload d'un nouveau fichier, ou "Remplacer l'image" dans la
     popup) ou retirée (bouton "Retirer cette image").
3. **Éditeur — popup de découpe audio** (`client/public/js/editor.js`) :
   - Nouvelle fonction `openRevealAudioTrimModal(file, onConfirm)` : popup
     autonome (overlay + DOM créés à la volée, comme `openImageCropModal`),
     duplique la logique de forme d'onde/glisser/redimensionnement du
     composant Blind Test mais avec un état 100% local (aucune variable
     module `pendingAudioBuffer`/`audioStartInput` touchée) et un plafond de
     15s (`REVEAL_AUDIO_MAX_DURATION`) au lieu de 30. Réutilise telles
     quelles les fonctions pures existantes `encodeWavMono`/`blobToDataUrl`
     (pas d'état partagé, dupliquer leur code n'aurait rien apporté — voir
     CLAUDE.md "pas de duplication évitable").
   - Le handler `onchange` du son de révélation n'affiche plus un refus sec
     au-delà de 15s : il ouvre désormais la popup, et n'écrit
     `q.revealAudio` que si l'utilisateur valide un extrait ("Annuler" ne
     modifie rien). Un fichier déjà ≤15s reste accepté directement en
     dataURL, sans popup, comme avant.
4. **Transmission en jeu** : fait en même temps que l'étape 1 (le payload
   `emitQuestion`/la liste blanche serveur couvraient déjà `revealPos`/
   `revealBg` dès le premier correctif, pas de second passage nécessaire).
5. **Affichage en jeu recadré** :
   - `client/public/index.html` : `#revealImageDisplay` enveloppée dans un
     nouveau conteneur `#revealImageDisplayWrap`
     (`.reveal-media-img-wrap`).
   - `client/public/css/style.css` : `.reveal-media-img-wrap` reprend
     l'ancien habillage visuel (taille max, marge, radius, ombre,
     `aspect-ratio: 16/10` plutôt qu'une hauteur fixe en px, comme
     `.assoc-item-img`) + `position:relative;overflow:hidden` ;
     `.reveal-media-img` devient l'`<img>` interne, positionnée en absolu
     (même paire wrapper/inner que `.assoc-item-img`/`.assoc-item-img-inner`).
   - `client/public/js/index.js` : le handler `question:reveal` appelle
     `applyCropTransform(revealImageDisplayWrap, revealImageDisplay,
     payload.revealPos)` une fois l'image chargée (avec un garde-fou d'ordre
     : le `d-none` est retiré du wrapper AVANT de poser `src`/vérifier
     `.complete`, sinon `applyCropTransform` lirait un `clientWidth`/
     `clientHeight` de 0 pour une image déjà en cache). `clearRevealState`
     (nettoyage à l'écran suivant) masque aussi le wrapper et réinitialise
     `transform`/`width`/`height` sur l'`<img>`.
6. **Checks** : voir section dédiée ci-dessous.

## Checks effectués
- `node --check` sur les 3 fichiers JS modifiés
  (`server/index.js`, `client/public/js/index.js`,
  `client/public/js/editor.js`) : **OK**, aucune erreur de syntaxe.
- `npm start` dans `server/` (port `3903`, le 3902 étant resté occupé par un
  précédent essai) : démarre sans erreur, log
  `"Server listening at http://0.0.0.0:3903"`.
- Vérification visuelle via le Browser pane (session non authentifiée) :
  - Page d'accueil (`index.html`) : rendu inchangé, pas d'erreur console liée
    au changement (la seule erreur console présente, "An unknown error
    occurred when fetching the script", apparaît aussi bien avant qu'après
    les modifs et n'est pas liée aux fichiers touchés — probablement un
    import dynamique du SDK Supabase, hors périmètre).
  - `#revealImageDisplayWrap`/`#revealImageDisplay` bien présents dans le
    DOM avec les classes attendues (`reveal-media-img-wrap d-none` /
    `reveal-media-img`).
  - **Test synthétique du recadrage en jeu** : les écrans étant masqués via
    `.d-none` tant qu'aucune partie n'est en cours, j'ai retiré
    temporairement ces classes et rejoué à la main la formule
    d'`applyCropTransform` (zoom 1.4, position 0.2/0.8) sur une image de
    test pour confirmer visuellement le rendu : le conteneur affiche bien
    ses dimensions calculées via `aspect-ratio` (420×263, ratio 16/10),
    l'image est correctement zoomée/décalée et rognée par
    `overflow:hidden`, sans déborder ni déformer la boîte (coins arrondis +
    ombre conservés). Capture vue pendant la vérification. État de test
    annulé ensuite par un rechargement de la page.
  - `editor.html` : redirige vers `login.html?reason=create` (auth Supabase
    requise), confirmé non contournable — conforme à l'interdiction de
    créer un compte/se connecter. J'ai seulement vérifié via `fetch()` que
    le HTML statique de `editor.html` sert toujours correctement les
    éléments existants (`#revealImagePreviewImg`, `#revealAudioUpload`,
    `#audioTrimWrap`), preuve que le fichier n'est pas cassé côté serveur.
    Impossible en revanche de cliquer réellement sur la vignette de
    recadrage ni d'ouvrir la nouvelle popup de découpe audio dans une
    session réelle — voir "Risques restants".

## Tests manuels recommandés
- **Prioritaire** : vérifier que le correctif de câblage fonctionne
  réellement — créer une question avec image + son de révélation,
  démarrer une partie de test, confirmer que l'image et le son
  apparaissent/jouent bien à la révélation (c'était silencieusement cassé
  depuis la tâche 017).
- Recadrer l'image de révélation (glisser + zoom), sauvegarder, vérifier
  que le cadrage choisi est bien celui affiché en jeu à la révélation.
- Sélectionner un son > 15s pour la révélation : la popup de découpe doit
  s'ouvrir, permettre de choisir la portion, et produire un extrait ≤ 15s.
- Sélectionner un son déjà ≤ 15s : doit être accepté directement, sans
  popup forcée.
- Vérifier qu'un joueur ne peut PAS voir `revealImage`/`revealAudio`/
  `revealPos`/`revealBg` dans la frame WebSocket `question:show` avant la
  révélation (onglet réseau des devtools) — seulement à `question:reveal`.

## Risques restants
- La popup de découpe audio duplique une partie de la logique déjà
  présente pour Blind Test (choix assumé, voir Périmètre) — un bug corrigé
  dans l'un ne se répercutera pas automatiquement dans l'autre.
- Vérification interactive limitée par l'absence de session éditeur
  authentifiée pour l'agent (même limitation que la tâche 017) — la
  majorité des tests manuels ci-dessous restent à faire par l'utilisateur,
  en particulier :
  - Le clic réel sur la vignette de révélation → ouverture de
    `openImageCropModal` → sauvegarde `revealPos`/`revealBg` n'a pu être
    exercé qu'en lecture de code, pas cliqué en vrai (login éditeur requis).
  - La nouvelle popup `openRevealAudioTrimModal` (glisser/poignées/
    prévisualisation/extraction WAV) n'a pu être vérifiée que par relecture
    attentive du code et par comparaison ligne à ligne avec le composant
    Blind Test dont elle s'inspire — jamais ouverte dans un vrai navigateur
    avec un vrai fichier audio > 15s.
  - Le correctif de câblage (le plus important de cette tâche) a été relu
    attentivement à 4 reprises aux 3 points exacts indiqués, mais **n'a pas
    pu être confirmé de bout en bout par un test de partie réelle** (créer
    un quiz avec image+son de révélation, lancer une partie de test,
    vérifier que l'image/le son apparaissent à la révélation) — impossible
    sans session éditeur authentifiée. C'est le test le plus important à
    faire avant tout déploiement.
- Le wrapper `.reveal-media-img-wrap` utilise désormais `aspect-ratio: 16/10`
  au lieu de l'ancien `max-height: 260px` — le rendu a été confirmé visuel
  via un test synthétique (voir Checks), mais pas comparé côte à côte avec
  l'ancien comportement sur un vrai écran de révélation en jeu.

## Statut
`en review`
