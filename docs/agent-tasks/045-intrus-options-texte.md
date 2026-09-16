# [045] Options texte pour le type de question "intrus"

## Contexte
Le type de question "intrus" est aujourd'hui strictement composé de photos :
modèle de données (`q.options[i] = {id, image, pos, bg}`), validation
("entre 3 et 8 photos, toutes importées"), et rendu côté joueur/MJ (tuile
`.intrus-tile` = une `<img>`, aucun texte — voir le commentaire explicite
dans `client/public/js/index.js` : "Pas de texte dans la tuile (juste une
photo)", l'`aria-label` utilise d'ailleurs la position ("Photo N") faute de
texte à afficher) sont pensés exclusivement pour des photos.

Retour utilisateur : pouvoir ajouter des options texte dans une question
"intrus" — validé avec l'utilisateur (voir cadrage) : une option texte est
une **alternative** à une option photo (pas une légende ajoutée sous une
photo) — une question peut mélanger librement options photo et options
texte, y compris un intrus purement textuel au milieu de photos ou
l'inverse.

## Objectif
Pouvoir créer, dans l'éditeur, une question "intrus" dont les options sont
un mélange libre de photos et de textes courts, avec le même mécanisme de
sélection de l'intrus (une case/radio) et la même mécanique de jeu
(repérer l'option qui n'a rien à voir avec les autres) qu'aujourd'hui —
seul le contenu de chaque tuile change (photo OU texte).

## Périmètre
- Éditeur (`editor.js`/`editor.html`) : ajouter une option texte (à côté de
  l'ajout photo existant), modèle de données `q.options[i]` étendu pour
  porter soit une image soit un texte (jamais les deux), liste
  réordonnable existante (`wireIntrusEditDrag`) inchangée dans son
  principe.
- Validation (`editor.js`, `validateQuestion`) : le message et la règle
  "toutes les photos importées" doivent couvrir le cas mixte (chaque
  option doit avoir SOIT une image SOIT un texte non vide, jamais aucun des
  deux).
- Rendu en jeu (`index.js`, construction des tuiles `.intrus-tile`) : une
  tuile texte au lieu d'une tuile image quand l'option n'a pas de photo —
  cohérent visuellement avec les tuiles texte d'autres types (mcq/
  truefalse), `aria-label` à revoir pour utiliser le texte réel quand il
  existe.
- CSS (`style.css`) : style de la tuile texte pour "intrus" (probablement
  proche de `.option-btn` texte standard), y compris son rendu déjà
  retouché pour la vue TV (`body.display-body .option-btn.intrus-tile`,
  tâche 042/043 — à vérifier que le mélange photo/texte reste correct
  dessus aussi).
- Serveur (`server/index.js`) : vérifier si `payload.options` (liste
  d'ids, utilisée pour le récap "Image N" côté hôte) a besoin d'un
  ajustement pour un intrus texte (ex. libellé de récap différent quand ce
  n'est pas une photo).

## Hors périmètre
- Changer le nombre min/max d'options (reste 3 à 8, INTRUS_MIN/MAX_OPTIONS
  inchangés).
- Changer le mécanisme de désignation de l'intrus (une seule case/radio,
  inchangé).
- Toute légende/texte complémentaire SOUS une photo existante (explicitement
  écarté — voir cadrage : le texte remplace une photo, ne s'y ajoute pas).

## Fichiers concernés
- `client/public/js/editor.js` — modèle `q.options`, UI d'ajout d'option
  texte, `renderIntrusOptions`, `validateQuestion`.
- `client/public/editor.html` — bouton/zone d'ajout d'une option texte
  (à côté de `intrusPhotosUpload`).
- `client/public/js/index.js` — construction des tuiles `.intrus-tile`
  (actuellement toujours une `<img>`), `aria-label`.
- `client/public/css/style.css` — style tuile texte pour "intrus" (écran
  MJ/joueur + vue TV déjà existante).
- `server/index.js` — `payload.options`/libellé de récap, à vérifier.

## Plan
Aucune "Interdiction" du CLAUDE.md concernée (pas de schéma DB, pas de
`render.yaml`, pas de nouvelle dépendance).

**Exploration faite avant ce plan** :
- `q.options[i]` = `{id, image, pos, bg}` (editor.js), validé par
  `isValidIntrusOptions` (~L400 : exige `image: string` sur CHAQUE
  élément — à assouplir).
- Ajout de photos : `#intrusPhotosUpload` (input file multiple) ->
  `addIntrusPhotos(files)` (~L4629). Rendu/glisser-déposer/suppression :
  `renderIntrusOptions`/`wireIntrusEditDrag` (~L4293-4429).
- Émission (`index.js`, `emitQuestion`) : `payload.options` ne porte QUE
  les ids (`q.options.map(o => o?.id ?? '')`, ~L6652) — les photos
  elles-mêmes partent à PART, via `uploadRoomIntrusImages(roomCode,
  q.options)` (~L6568, POST vers `/api/room-intrus-images/:code`, upload
  group monté une seule fois) puis `payload.intrusImagesUrl`. Le texte
  n'aura PAS besoin de ce détour : contrairement à une image, rien à
  uploader — il peut voyager directement dans `payload.options` (à
  transformer en tableau d'objets `{id, text?}` plutôt que de simples ids,
  ou champ séparé — à trancher en implémentant, selon ce qui perturbe le
  moins le format déjà attendu côté serveur/`historyEntry`/récap).
- Rendu en jeu (`index.js`, construction des tuiles ~L7849-7862) :
  actuellement toujours une `<img class="intrus-tile-img">`, jamais de
  texte (`aria-label` généré depuis la position, pas le contenu — à
  corriger pour utiliser le vrai texte quand il existe, meilleur pour
  l'accessibilité).
- CSS TV (tâche 042/043, `body.display-body .option-btn.intrus-tile`) :
  scopé à la tuile photo (`max-height`, ratio 4:3) — une tuile texte
  "intrus" réutilisera probablement le style `.option-btn` texte standard
  déjà retouché pour la TV ailleurs, à vérifier plutôt qu'à réinventer.

1. **Modèle de données + validation (éditeur).** `isValidIntrusOptions`
   accepte désormais un élément SOIT `{id, image}` SOIT `{id, text}` (jamais
   les deux, jamais aucun des deux) ; `validateQuestion` reformule son
   message d'erreur ("photos" -> "options") pour rester correct dans les
   deux cas. *Étape isolée, testable seule par une sauvegarde manuelle avec
   un mélange texte/photo.*
2. **UI d'ajout + rendu (éditeur).** Bouton `+ Ajouter un texte` à côté de
   `#intrusPhotosUpload` (même emplacement, même style que les autres
   boutons d'ajout de ce fichier — ex. `addIndiceBtn`), ajoute
   `{id: genToken(), text: ''}` à `q.options`. `renderIntrusOptions` :
   branche par option (image -> ligne actuelle inchangée ; texte -> ligne
   avec un `<input type="text">`, même poignée de glisser-déposer, même
   bouton supprimer, même radio "marquer comme intrus"). *Dépend de
   l'étape 1 pour la validation, sinon testable seule visuellement.*
3. **Émission + rendu en jeu.** `payload.options` transmet aussi le texte
   des options textuelles (voir décision ci-dessus) ; construction des
   tuiles (`index.js`) : une tuile texte (réutilise le style `.option-btn`
   texte standard) au lieu d'une `<img>` quand l'option correspondante n'a
   pas de photo ; `aria-label` basé sur le texte réel quand il existe.
   *Étape la plus dense — à tester avec les 17 types déjà vérifiés pour la
   tâche 042/043 en tête (ne pas casser le rendu photo existant).*
4. **Vérification CSS TV.** Confirmer qu'un mélange photo/texte reste
   correct sur la vue TV (`body.display-body`) — retoucher UNIQUEMENT si
   un écart réel est trouvé (pas de retouche spéculative), même discipline
   que les tâches 042/043.
5. **Récap hôte.** Vérifier `server/index.js` (libellé "Image N" dans le
   récap, voir `zoneLabel()`/équivalent pour "intrus") — une option texte
   ne doit pas s'appeler "Image N" dans le récap final, à corriger si
   besoin.

## Étapes réalisées
- [x] 1. Modèle de données + validation.
- [x] 2. UI d'ajout + rendu (éditeur).
- [x] 3. Émission + rendu en jeu (tuiles texte).
- [x] 4. Vérification CSS TV.
- [x] 5. Récap hôte (libellé options texte).

### Détail des choix d'implémentation

1. **Modèle + validation** (`editor.js`) : `isValidIntrusOptions` distingue
   désormais deux vérifications à des moments différents (même piège identifié
   pour `isValidIndiceHints`, évité ici) :
   - `isValidIntrusOptions` (rendu + changement de type) : check STRUCTUREL
     seulement (`typeof o.image === 'string'` XOR `typeof o.text === 'string'`,
     contenu vide autorisé) — sinon une option texte fraîchement ajoutée à
     `text: ''` aurait été jugée "invalide" et aurait vidé tout `q.options` au
     premier `renderIntrusOptions()`.
   - `validateQuestion` (sauvegarde) : nouvelle vérification stricte
     `hasMissingContent` (photo OU texte non vide, jamais aucun des deux) qui
     remplace l'ancien `hasMissingImage`. Messages reformulés "photos" ->
     "options" partout dans ce bloc.
   Bouton `#addIntrusTextBtn` ajouté dans `applyReadOnly` (liste des contrôles
   désactivés en lecture seule).
2. **UI d'ajout + rendu** : bouton "+ Ajouter un texte" (`editor.html`, à côté
   de `#intrusPhotosUpload`) -> `q.options.push({id: genIntrusOptionId(),
   text: ''})`. `renderIntrusOptions` branche par option : `typeof opt.image
   === 'string'` -> ligne photo inchangée, sinon -> `<input type="text">`
   (maxlength `TEXT_SHORT_MAXLENGTH`, même style que les autres listes du
   fichier) relié en direct à `q.options[idx].text`. Poignée de glisser-
   déposer (`wireIntrusEditDrag`), radio "intrus" et bouton supprimer
   inchangés et partagés entre les deux branches (l'exclusion `INPUT` dans
   `wireIntrusEditDrag` couvrait déjà ce nouveau champ texte sans modif).
3. **Émission + rendu en jeu — format retenu pour le texte** : `payload.options`
   reste un simple tableau d'ids (INCHANGÉ, aucun risque de régression sur
   les usages existants côté serveur — `buildRecap`/`question.options` pour
   "Image N", côté client pour `dataset.optionId`/tileCount). Le texte
   voyage dans un CHAMP SÉPARÉ, `payload.intrusTexts` = `{id: texte}` pour
   les seules options textuelles (absence de clé = c'est une option photo).
   Choix motivé par le risque le plus faible : changer la forme d'`options`
   (ex. `{id, text?}`) aurait cassé au moins 3 usages existants qui font un
   `indexOf`/comparaison directe sur l'id (`buildRecap` côté serveur,
   `dataset.optionId`/`intrusTileElById[id]` côté client). Contrepartie côté
   upload photo (`index.js` `emitQuestion`) : `uploadRoomIntrusImages`
   n'est appelé qu'avec le SOUS-ENSEMBLE d'options ayant une `.image` (et
   seulement s'il y en a au moins une) — sinon les options texte, sans champ
   `.image`, auraient fait échouer la validation `isValidImageValue` de
   toute la requête, y compris pour les vraies photos du lot.
   Rendu (`index.js`, construction des tuiles) : `payload.intrusTexts[id]`
   présent -> tuile texte (`.intrus-tile-text`, `textContent`, `aria-label`
   = le texte réel, `fitTileText` pour l'ajustement de police) ; absent ->
   branche photo strictement inchangée (même `<img class="intrus-tile-img">`,
   même `aria-label` "Photo N").
4. **CSS TV** : aucune régression trouvée sur la disposition existante (tâche
   042/043) — testé à 1920×1080 avec `body.display-body`, 7 options mixtes
   (motif de rangées [3,2,2]) : le conteneur `.options-grid.intrus-grid` est
   en `display:flex` avec `align-items:stretch` implicite, donc chaque
   tuile texte hérite AUTOMATIQUEMENT de la même hauteur que les tuiles
   photo de sa rangée (vérifié : 317px pour les 7 tuiles, dans les deux
   rangées). Seul ajout nécessaire : un modificateur `.intrus-tile-text`
   (style.css) qui réactive le look ".option-btn" texte standard (fond
   coloré tournant par position, icône ::before, padding) que
   `.option-btn.intrus-tile` désactive normalement pour les photos — même
   rotation de couleurs que le QCM (`:nth-child(8n+N)`), vérifiée par
   position réelle en test (2e tuile -> bleu, 5e -> violet, conforme).
5. **Récap hôte** (`server/index.js`) : `question.intrusTexts` (nouveau champ
   passthrough, même traitement que `question.options` juste au-dessus dans
   la liste blanche) permet à `buildRecap`/`labelFor` de retraduire l'id
   d'une réponse TEXTE en son contenu réel, testé EN PREMIER avant le repli
   "Image N" (qui reste inchangé pour une réponse photo). `/api/room-intrus-
   images/:code` : plancher `images.length >= 3` abaissé à `>= 1` (une
   question mixte peut n'avoir qu'1 ou 2 photos sur 3-8 options).

## Checks effectués
- [x] `node --check` sur chaque fichier JS modifié (editor.js, index.js
  client, server/index.js) — OK sur les 3.
- [x] Vérification visuelle Browser pane (éditeur + jeu + vue TV) — voir
  détail ci-dessous (éditeur limité par l'absence de compte Supabase de
  test).

## Tests manuels effectués
Serveur réel démarré via `.claude/launch.json` (config `queazy-server`),
piloté par socket.io directement depuis la page (mêmes techniques que les
tâches précédentes) :
- **Jeu (hôte + joueur), intrus mixte 3 options** (`ph1` photo, `ph2` photo,
  `tx1` texte = intrus, `ph3` photo) : tuiles rendues correctement des deux
  côtés — photos en `<img>` avec `aria-label="Photo N"`, texte en tuile
  colorée (jaune, 3e position) avec `aria-label` = texte réel. Sélection +
  révélation (anneau + `✓` vert) fonctionnelles sur la tuile texte, vues en
  capture d'écran.
- **Régression intrus 100% photo** (5 options, pas de champ `intrusTexts` du
  tout — comme un ancien quiz jamais resauvegardé) : rendu strictement
  identique à avant (5 tuiles `<img>`, `aria-label` "Photo 1".."Photo 5"),
  aucune classe/texte parasite.
- **Récap hôte** : réponse d'un joueur sur l'option texte `tx1` -> récap
  affiche `"answer":"Réponse texte"` (le vrai texte, pas "Image N") ;
  réponse sur une option photo `ph1` -> récap affiche `"Image 1"` comme
  avant (aucune régression).
- **Vue TV** (`body.display-body`, 1920×1080, 7 options mixtes, motif de
  rangées [3,2,2]) : tuiles texte et photo de même hauteur dans leur
  rangée (317px), couleurs de rotation correctes par position. Aucune
  retouche CSS spéculative nécessaire au-delà du nouveau modificateur
  `.intrus-tile-text`.
- **Validation editor.js (logique isolée)** : éditeur réel inaccessible sans
  compte Supabase (redirige vers `login.html?reason=create`, même limite
  que l'agent de la tâche 044) — `isValidIntrusOptions`/`hasMissingContent`
  testées directement via `javascript_tool` avec les mêmes corps de
  fonction que le fichier réel : structure photo-seule/texte-seul (même
  vide)/mixte valides, ni-les-deux/les-deux invalides, ancien format
  (tableau de strings hérité d'un autre type) invalide ; côté sauvegarde,
  texte vide/espaces bloqué, mixte rempli accepté. Tous les cas testés
  correspondent au comportement attendu (voir détail des choix ci-dessus).
  Pas de vérification visuelle de l'UI d'ajout/glisser-déposer côté éditeur
  (bouton, input, rendu de ligne) faute d'accès — relecture de code seule.

## Risques restants
- L'UI d'ajout d'option texte côté éditeur (`#addIntrusTextBtn`, rendu de la
  ligne `<input>`, glisser-déposer avec une ligne texte) n'a été vérifiée
  que par relecture de code et test isolé de la logique de validation —
  jamais visuellement dans le vrai `editor.html` (bloqué par l'auth
  Supabase, aucun compte de test disponible). À vérifier visuellement dès
  qu'un compte de test existe.
- `payload.intrusTexts` est un nouveau champ public transmis tel quel dans
  `question:show` (comme le reste du contenu d'une question "intrus", déjà
  visible avant réponse) — aucun souci d'anti-triche différent des options
  photo existantes (le texte d'une option n'est jamais la réponse en soi,
  seul `q.correct` l'est, et reste filtré comme avant).

## Statut
`ouverte`
