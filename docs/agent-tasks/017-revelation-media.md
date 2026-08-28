# [017] Image et son optionnels à la révélation

## Contexte
Aujourd'hui, la révélation (affichée à tous les joueurs juste après la
bonne réponse, quel que soit le type de question) ne porte qu'une
"Explication" textuelle optionnelle (`question.explanation`). Retour
utilisateur : il veut pouvoir enrichir ce moment avec une image et/ou un
son, chacun facultatif et indépendant du texte. Direction UX validée via
`/design` (canvas "Éditeur — Révélation Enrichie") : le champ texte actuel
devient un bloc groupé "Après la révélation" avec 3 volets optionnels
(texte / image / son), image et son côte à côte façon
`.split-grid` (même pattern que "Type de réponse / Temps imparti").

## Objectif
Un créateur peut, pour n'importe quel type de question, ajouter à la
révélation : un texte (existant), une image (nouveau), un son de 15
secondes max (nouveau) — chacun indépendamment optionnel. Les joueurs et
l'hôte voient/entendent ces ajouts au moment de `question:reveal`, en plus
du texte d'explication existant.

## Périmètre
- Éditeur (`editor.html` + `editor.js`) : remplacement du bloc
  "Explication" par le bloc groupé validé en design (texte / image / son),
  avec upload+aperçu+retrait pour l'image et upload+lecteur+retrait pour
  le son — mêmes patterns visuels que l'illustration existante et la carte
  audio "Blind Test", **sans** le découpage/waveform (juste un court
  effet).
- Limite dure de **15 secondes** sur le son de révélation, vérifiée
  côté client à la sélection du fichier (durée lue via un élément
  `<audio>` temporaire) — fichier trop long refusé avec un message clair,
  jamais silencieusement tronqué.
- Stockage : réutilisation telle quelle du pipeline déjà en place
  (`uploadMediaField`/`uploadQuestionMedia` dans `editor.js`, bucket
  Supabase Storage `quiz-media` déjà configuré et déjà utilisé pour
  `q.image`, `q.illustration`, `q.audio`, etc.) — deux nouveaux champs
  génériques `q.revealImage` et `q.revealAudio` (tous types de question),
  uploadés en base64→URL exactement comme les champs existants. **Aucune
  nouvelle infra à créer côté utilisateur.**
- Serveur (`server/index.js`) : `revealQuestion()` inclut désormais
  `revealImage`/`revealAudio` dans `question.revealPayload` envoyé via
  `question:reveal`.
- Client jeu (`index.html` + `index.js`) : affichage de l'image et lecture
  du son de révélation au moment de `question:reveal`, à côté du texte
  d'explication déjà géré par `revealExplanationText`.
- CSS (`style.css`) : nouvelles classes pour le bloc éditeur groupé et
  pour l'affichage image/son en jeu à la révélation.

## Hors périmètre
- Pas de découpage/trim du son de révélation (pas de waveform) — c'est
  volontairement plus simple que le Blind Test.
- Pas de renommage du champ "Explication" en "Révélation" comme titre —
  collision avec le type de question existant 🖼️ Révélation, déjà tranché
  en design (le libellé reste "Après la révélation" en phrase, jamais un
  titre isolé "Révélation").
- Pas de gestion spécifique de l'autoplay navigateur au-delà d'un
  comportement standard `<audio autoplay>` — un risque connu (politique
  autoplay des navigateurs) documenté dans les risques, pas résolu ici
  avec une mécanique dédiée.
- Pas de migration des anciens quiz — le texte d'explication existant
  reste intact, l'image/le son sont juste absents tant qu'ils ne sont pas
  ajoutés.

## Fichiers concernés
- `client/public/editor.html` — remplacement du bloc `#qExplanation` par
  le bloc groupé (texte + inputs image/son + aperçus).
- `client/public/js/editor.js` — DOM refs, handlers upload/retrait pour
  `revealImage`/`revealAudio`, validation durée 15s, ajout aux fonctions
  `uploadQuestionMedia`/populate/reset déjà existantes pour les champs
  média.
- `client/public/css/style.css` — classes du bloc groupé éditeur + de
  l'affichage en jeu.
- `server/index.js` — `revealQuestion()`, ajout des deux champs à
  `question.revealPayload`.
- `client/public/index.html` — nouveaux éléments DOM pour l'affichage
  image/son de révélation, à côté de `#revealExplanationText`.
- `client/public/js/index.js` — `socket.on('question:reveal', ...)`,
  affichage image + lecture son ; nettoyage à l'écran suivant (comme
  `revealExplanationText` déjà nettoyé ligne ~2779).

## Plan
1. **Éditeur — markup** : dans `editor.html`, remplacer le
   `.detail-section` de `#qExplanation` par le bloc groupé "Après la
   révélation" (texte inchangé + 2 colonnes image/son), en reprenant
   l'exact HTML/classes validés dans le canvas de design (`illustration-
   preview-wrap` pour l'image, carte son inspirée de `.audio-clip-wrap`
   mais sans waveform). Nouveaux ids : `revealImageUpload`,
   `revealImagePreviewWrap`, `revealImagePreviewImg`,
   `removeRevealImageBtn`, `revealAudioUpload`, `revealAudioPreviewWrap`,
   `revealAudioPreviewPlayer`, `removeRevealAudioBtn`.
2. **Éditeur — CSS** : ajouter les classes manquantes dans `style.css`
   (le bloc groupé `.reveal-card`/`.reveal-media-grid`/etc. et la petite
   carte son sans waveform) — reprises quasi telles quelles du canvas de
   design, adaptées aux vraies variables du projet (déjà les mêmes
   tokens).
3. **Éditeur — logique JS** : dans `editor.js`, ajouter les handlers
   `onchange`/retrait pour les deux nouveaux inputs (même schéma que
   `revealEnigmeUploadInput`/`removeRevealEnigmeBtn` existants pour le
   type "reveal", ou que `illustrationUpload`). Pour le son : lire le
   fichier, vérifier sa durée via un élément `<audio>` temporaire
   (`loadedmetadata` → `.duration`), rejeter avec toast si > 15s, sinon
   `compressImageFile`-style passage en dataURL (pas de compression audio,
   juste `FileReader.readAsDataURL`). Peupler/réinitialiser
   `q.revealImage`/`q.revealAudio` dans les fonctions existantes qui
   gèrent déjà `q.explanation` (chargement d'une question, sauvegarde,
   changement de type).
4. **Éditeur — upload au save** : ajouter
   `field(q, 'revealImage')` et `field(q, 'revealAudio')` dans
   `uploadQuestionMedia` (`editor.js` ~ligne 4310), juste à côté des
   champs déjà listés — aucune autre modif du pipeline d'upload
   nécessaire (générique).
5. **Serveur** : dans `revealQuestion()` (`server/index.js` ~ligne 586),
   ajouter `revealImage: question.revealImage || undefined` et
   `revealAudio: question.revealAudio || undefined` à
   `question.revealPayload`.
6. **Client jeu — markup** : dans `index.html`, ajouter les éléments
   d'affichage à côté de `#revealExplanationText` (ex.
   `#revealImageDisplay` en `<img>`, `#revealAudioPlayer` en `<audio>`),
   cachés par défaut (`d-none`).
7. **Client jeu — logique JS** : dans `index.js`,
   `socket.on('question:reveal', ...)` : si `payload.revealImage`,
   afficher l'image ; si `payload.revealAudio`, définir `src` et tenter
   `.play()` (catch silencieux si bloqué par le navigateur — pas de
   mécanique de repli ici, hors périmètre). Nettoyage à l'écran suivant,
   même endroit que le nettoyage actuel de `revealExplanationText`
   (~ligne 2779).
8. **CSS jeu** : classes d'affichage de l'image/du son à la révélation
   (cohérentes avec l'existant autour de `.reveal-explanation`).
9. **Checks** : `node --check server/index.js` et
   `node --check client/public/js/editor.js`,
   `node --check client/public/js/index.js` (syntaxe uniquement, ce sont
   des scripts navigateur) ; démarrage `npm start` ; vérification visuelle
   Browser pane sur l'éditeur (ajout/retrait image+son, limite 15s) puis
   sur une partie test (révélation avec image+son).

## Étapes réalisées
- [x] 1. Éditeur — markup : `#qExplanation` déplacé dans le nouveau bloc
      groupé `.reveal-card` (`editor.html`), avec les 2 volets image/son
      (`revealImageUpload`/`revealImagePreviewWrap`/`revealImagePreviewImg`/
      `removeRevealImageBtn`, `revealAudioUpload`/`revealAudioPreviewWrap`/
      `revealAudioPreviewPlayer`/`removeRevealAudioBtn`), classes reprises
      du canvas de design.
- [x] 2. Éditeur — CSS : `.reveal-card`/`.reveal-sublabel`/`.reveal-row`/
      `.reveal-media-grid`/`.reveal-media-preview`/`.reveal-sound-card`/
      `.reveal-sound-badge`/`.reveal-remove-link` ajoutées dans
      `style.css`, juste après `.illustration-remove-btn:hover` — tokens du
      projet (`--color-surface-2`, `--color-accent-rgb`, `--radius-md`,
      `--space-md`...), pas de valeur recopiée telle quelle du canvas.
- [x] 3. Éditeur — logique JS : `populateRevealMediaFields(q)` (nouvelle
      fonction, à ne pas confondre avec `populateRevealFields` déjà
      existante pour le type "reveal") + handlers `onchange`/retrait pour
      les deux inputs dans `editor.js`. Le son : vérif de durée via un
      `<audio>` temporaire (`loadedmetadata` → `.duration`), rejet avec
      `showToast` si > 15s (`REVEAL_AUDIO_MAX_DURATION`), sinon
      `FileReader.readAsDataURL` (pas de compression). `q.revealImage`/
      `q.revealAudio` peuplés/lus aux mêmes points que `q.explanation`
      (`selectQuestion`, `deleteQuestionAt`) — jamais réinitialisés au
      changement de type (générique, indépendant de `q.type`, comme
      `q.explanation`).
- [x] 4. Éditeur — upload au save : `field(q, 'revealImage')` et
      `field(q, 'revealAudio')` ajoutés dans `uploadQuestionMedia`
      (`editor.js`), juste après `enigmeImage`/`reponseImage`.
- [x] 5. Serveur : `revealImage`/`revealAudio` ajoutés à
      `question.revealPayload` dans `revealQuestion()` (`server/index.js`),
      même pattern que `explanation`/`target`/`tolerance`. Vérifié que ces
      champs ne fuitent PAS avant la révélation (absents de
      `question.showPayload`/`emitQuestion`, comme `explanation` déjà).
- [x] 6. Client jeu — markup : `#revealImageDisplay` (`<img>`) et
      `#revealAudioPlayer` (`<audio>`) ajoutés dans `index.html`, juste
      après `#revealExplanationText`, cachés par défaut (`d-none`).
- [x] 7. Client jeu — logique JS : dans `socket.on('question:reveal', ...)`
      (`index.js`), affichage de l'image et `.play()` du son (catch
      silencieux si bloqué par le navigateur) juste après le bloc
      `revealExplanationText` existant. Nettoyage ajouté dans
      `clearRevealState()`, juste après le nettoyage de
      `revealExplanationText` (pause + retrait du `src` pour l'audio, retrait
      du `src` pour l'image).
- [x] 8. CSS jeu : `.reveal-media-img` ajoutée dans `style.css`, juste après
      `.reveal-explanation`.
- [x] 9. Checks : voir section suivante.

## Checks effectués
- [x] `node --check server/index.js` → OK, aucune erreur de syntaxe.
- [x] `node --check client/public/js/editor.js` → OK.
- [x] `node --check client/public/js/index.js` → OK.
- [x] `npm start` dans `server/` (via le launch config `queazy-server` du
      Browser pane, port 3000 par défaut) → démarre sans erreur, aucune
      erreur dans les logs serveur (`preview_logs`).
- [x] Vérification structurelle du bloc éditeur (DOM) : tous les nouveaux
      ids (`revealImageUpload`, `revealImagePreviewWrap`,
      `revealImagePreviewImg`, `removeRevealImageBtn`, `revealAudioUpload`,
      `revealAudioPreviewWrap`, `revealAudioPreviewPlayer`,
      `removeRevealAudioBtn`) présents dans le DOM rendu, avec les bons
      états initiaux cachés (`d-none` sur les deux wraps de preview) et les
      bonnes classes CSS (`illustration-preview-wrap reveal-media-preview`
      pour l'image, `reveal-sound-card` pour le son) — vérifié via un rendu
      statique de `editor.html` dans le Browser pane (texte de page +
      inspection JS des classes), le contenu du bloc "Après la révélation"
      (Texte/Image/Son, sous-labels, boutons "Retirer le son"/"✕") s'affiche
      correctement, aucune erreur dans la console.
- [ ] **Non vérifié en interaction réelle (upload de fichier, clic
      retrait, limite 15s, partie de test avec révélation image+son)** —
      voir "Risques restants" ci-dessous pour l'explication détaillée.

## Tests manuels recommandés (complète les cas déjà listés plus haut)
- Vérifier spécifiquement qu'un ancien quiz (sans `revealImage`/
  `revealAudio`) continue de fonctionner à l'identique — les deux champs
  sont `undefined`/absents, `revealPayload` ne les inclut pas (`|| undefined`),
  le client jeu ne montre ni image ni audio (garde `payload.revealImage`/
  `payload.revealAudio`).
- Vérifier qu'un son WAV volontairement lourd mais < 15s est accepté sans
  message d'erreur de poids (aucune limite de poids ajoutée, comme prévu au
  périmètre) — juste plus long à sauvegarder.

## Risques restants
- Politique autoplay des navigateurs : `<audio autoplay>`/`.play()` peut
  être bloqué chez certains joueurs selon leur historique d'interaction —
  pas de mécanique de repli prévue dans le périmètre de cette tâche (catch
  silencieux uniquement).
- Pas de compression/transcodage du son côté client : un fichier "15s" mais
  dans un format lourd (WAV non compressé) peut quand même peser plusieurs
  Mo — pas de limite de poids en plus de la limite de durée dans le
  périmètre validé.
- **Vérification interactive incomplète, à faire par l'utilisateur avant de
  pousser** : l'éditeur (`editor.html`) est protégé par une authentification
  Supabase (redirection vers `/login.html` sans session active) — créer un
  compte ou entrer un mot de passe pour se connecter est une action
  interdite pour l'agent (règles de sécurité de l'environnement), donc
  impossible de dérouler le scénario complet (upload réel d'un fichier
  image/son via le sélecteur natif, clic sur "Retirer", test concret du
  rejet à > 15s, lancement d'une partie de test avec révélation) depuis ce
  poste. Ce qui A été vérifié : absence d'erreur de syntaxe (`node --check`),
  démarrage serveur propre, structure DOM/CSS correcte et fidèle au design
  validé, absence d'erreur console sur un rendu de la page. Ce qui RESTE à
  vérifier manuellement par l'utilisateur (connecté) avant de pousser :
  upload réel image + son (<15s) sur une question de test, clic sur les
  boutons "✕"/"Retirer le son", tentative avec un son > 15s (message de
  refus attendu), puis une partie de test complète pour confirmer
  l'affichage/lecture côté hôte ET côté joueur à la révélation.

## Correctif post-review
Retour utilisateur après la première passe : le son de révélation était
joué **sans respecter le mode IRL / à distance** du salon — contrairement
à `blindtestAudio` (voir `buildBlindTestArea`, `index.js`), qui coupe le
son sur les téléphones des joueurs en IRL (tout le monde est dans la même
pièce, seul l'hôte doit faire sortir le son) et le laisse ouvert à
distance. `revealAudioPlayer` appelait `.play()` sans jamais poser
`.muted`, donc chaque joueur aurait entendu le son en même temps que
l'hôte en IRL. Corrigé dans `socket.on('question:reveal', ...)`
(`index.js`) : `revealAudioPlayer.muted = gameMode === 'remote' ? false :
!isHost`, posé juste avant `.play()`, même règle que `blindtestAudio`.
`node --check client/public/js/index.js` → OK après correction.

## Statut
`en review`

## Tests manuels recommandés
- Créer une question de n'importe quel type, ajouter texte + image + son
  (<15s) à la révélation, sauvegarder, relancer une partie et vérifier
  l'affichage/lecture côté hôte ET côté joueur à la révélation.
- Tenter un son > 15s : doit être refusé avec un message clair, jamais
  silencieusement tronqué ou accepté.
- Retirer l'image ou le son après ajout : doit repasser à l'état vide
  (bouton "Parcourir…") sans casser le texte d'explication à côté.
- Question sans aucun des 3 champs : révélation identique à avant cette
  tâche (aucune régression sur les quiz existants).

## Risques restants
- Politique autoplay des navigateurs : `<audio autoplay>` peut être
  bloqué chez certains joueurs selon leur historique d'interaction — pas
  de mécanique de repli prévue dans le périmètre de cette tâche.
- Pas de compression/transcodage du son côté client : un fichier "15s"
  mais dans un format lourd (WAV non compressé) peut quand même peser
  plusieurs Mo — pas de limite de poids en plus de la limite de durée
  dans le périmètre validé.

## Statut
`ouverte`
