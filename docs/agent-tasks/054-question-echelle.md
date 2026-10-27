# [054] Nouveau type de question « Échelle »

## Contexte
Demande de l'utilisateur, inspirée du jeu Magnitudle (joué en stream) :
deviner la taille réelle d'un élément en le comparant à une référence de
hauteur connue. Exemple : une console Wii (référence) et Psykokwak (à
deviner), thème culture pop. Aucun type actuel ne propose ce geste. Le plus
proche est la Graduation (curseur numérique), mais elle n'a pas de
comparaison visuelle.

Constat utile pour le mode « Jouer » : `bank_questions.question` est un
`jsonb` libre et `bank_questions.type` un `text` sans contrainte (voir
`supabase/schema.sql`). Un nouveau type peut donc entrer dans la banque
par le bouton existant « Ajouter à la banque » de l'éditeur, **sans
modifier le schéma**.

## Objectif
Un créateur peut ajouter une question « Échelle » à un quiz :
- deux images, la **référence** et l'**élément à deviner** ;
- la hauteur réelle de chacune, en cm.

En partie :
- les deux silhouettes sont posées sur le même sol ;
- chaque joueur redimensionne l'élément jusqu'à la taille qu'il pense
  réelle, puis valide.

À la révélation :
- la silhouette **grisée à la vraie taille** apparaît à côté de celle du
  joueur, sur les téléphones, chez le MJ et sur l'écran TV ;
- un bandeau donne la réponse du joueur, la vraie taille et l'écart ;
- **les silhouettes de tous les joueurs** s'affichent, chacune à la
  taille proposée par son joueur, pour que tout le monde les voie
  (demande de l'utilisateur, comme les points de chaque joueur au
  mode « image ») :
  - le **pseudo** est écrit au-dessus de chaque silhouette ;
  - chaque joueur a **sa propre couleur**, la même pour sa silhouette et
    son pseudo, pour qu'on les distingue ;
  - la couleur est attribuée par le serveur et transmise avec la
    révélation, pour être identique sur tous les écrans.

Points :
- **selon la précision uniquement**, sans composante vitesse (décision
  de l'utilisateur) ;
- écart mesuré en **rapport** (échelle logarithmique), pas en cm ;
- plein barème (1000) quand la réponse est quasi exacte, puis
  décroissance jusqu'à 0. Les seuils exacts seront fixés au plan.

Le calcul est fait par le serveur, sans modération du MJ. Le type
fonctionne donc en « Présenter » comme en « Jouer ».

## Périmètre
- **Éditeur** :
  - nouveau type dans la liste des types ;
  - section dédiée : deux images, deux hauteurs en cm, libellé de chaque
    élément ;
  - recadrage automatique de chaque image au ras du dessin (pixels
    non transparents, via canvas, sans dépendance) ;
  - aperçu « Tester » ;
  - envoi des images par le chemin déjà en place (`uploadQuestionMedia`).
- **Écran de jeu** (`index.js` / `index.html`) :
  - les deux silhouettes sur un même sol, en aplat de couleur (référence
    et élément de couleurs distinctes) ;
  - poignée à glisser et curseur de réglage fin, sur une échelle
    logarithmique ;
  - vue qui se dézoome pour garder les deux silhouettes à l'écran ;
  - verrouillage après validation, comme les autres types.
- **Serveur** (`server/index.js`) :
  - réception de la taille proposée, avec contrôle des bornes ;
  - calcul des points de précision, sans vitesse ;
  - historique et récap ;
  - vraie taille transmise dans `revealPayload` ;
  - liste de tous les joueurs ayant répondu (pseudo, taille proposée,
    indice de couleur), sur le modèle de `imagePlayers` du mode « image ».
- **Révélation** :
  - silhouette grisée à la vraie taille ;
  - silhouettes de tous les joueurs, chacune de sa couleur, avec le pseudo
    au-dessus. Disposition à fixer au plan : côte à côte sur le sol, avec
    une réduction automatique quand il y a beaucoup de joueurs, et des
    pseudos qui ne se chevauchent pas ;
  - bandeau « Ta réponse / Réelle / écart » ;
  - bandeau personnel Bonne réponse / Presque / Mauvaise réponse, cohérent
    avec les points.
- **Écran TV** : vérifier que la copie de `#stageWrap` rend correctement
  les silhouettes (taille et cadrage sur grand écran), et corriger si
  besoin dans `display.js`.
- **« Comment jouer ? »** : métadonnées du type (`QUESTION_TYPE_META`) et
  étapes dans `TUTO_STEPS`.
- **Banque / mode Jouer** :
  - le type est accepté par la génération automatique (pas d'exclusion) ;
  - libellé ajouté dans l'admin de la banque (`admin-bank.js`).
- CSS dans `client/public/css/style.css`.

## Hors périmètre
- Toute modification de `supabase/schema.sql` (non nécessaire, voir
  Contexte).
- Une bibliothèque intégrée de références toutes prêtes (humain,
  porte, Wii…). C'est une idée évoquée, à faire dans une tâche séparée si
  l'utilisateur la valide.
- Le remplissage de la banque avec des questions « Échelle » (contenu, pas
  du code).
- La vidéo de démo de « Comment jouer ? ». Elle se génère avec le moteur
  de démos hors dépôt et viendra après, une fois l'écran de jeu stabilisé.
  En attendant, le type n'a pas de vidéo, ou la fenêtre gère son absence.
- Toute composante vitesse dans les points.
- La modération MJ : aucune réponse ne passe en attente.
- Les tailles autres que la hauteur (largeur, volume).

## Fichiers concernés
- `client/public/editor.html` : option du type et section de saisie
  (images, hauteurs).
- `client/public/js/editor.js` :
  - formulaire du type ;
  - recadrage automatique des images ;
  - validation et sérialisation de la question ;
  - envoi des médias (`uploadQuestionMedia`).
- `client/public/index.html` : zone de jeu (silhouettes, sol, poignée,
  curseur) dans `#stageWrap`.
- `client/public/js/index.js` :
  - `QUESTION_TYPE_META` et `TUTO_STEPS` ;
  - affichage à `question:show` ;
  - interaction et envoi de la réponse ;
  - verrouillage ;
  - révélation et bandeau de résultat.
- `server/index.js` :
  - branche `answer:submit` du type ;
  - calcul des points ;
  - `revealPayload` ;
  - récap (`buildRecap`).
- `client/public/js/display.js` : ajustements éventuels pour l'écran TV
  (cadrage des silhouettes).
- `client/public/js/admin-bank.js` : libellé et résumé du type dans
  l'admin de la banque.
- `client/public/css/style.css` : styles de la scène, des silhouettes, de
  la poignée et de la révélation.

## Plan

Identifiant du type : `echelle`.

Forme de la question, sauvegardée dans `quizzes.questions` et dans
`bank_questions.question`, sans changement de schéma :

```
{ type: 'echelle', prompt,
  refImage, refLabel, refHeight,      // référence (hauteur en cm, publique)
  refRatio,                           // largeur/hauteur après recadrage
  itemImage, itemLabel, itemRatio,    // élément à deviner
  correct: [itemHeightCm],            // vraie taille : jamais diffusée avant la révélation
  timerMs, ... }
```

Les ratios sont calculés et stockés par l'éditeur : l'écran de jeu
dimensionne ainsi les silhouettes sans attendre le chargement des images.

### Étape 1 — Serveur : réponse, points et révélation (`server/index.js`)

**Diffusion de la question.**
- Ajouter `'echelle'` à la liste des types dont `correct` est retiré de
  `broadcastPayload`, comme `graduation`. La vraie taille n'est donc
  jamais lisible dans les outils de développement avant la fin.
- Copier `refHeight` sur l'objet `question`, pour les bornes.

**Réponse (`answer:submit`, branche dédiée).** `content` est la taille
proposée en cm.
- Rejeter une valeur non finie ou ≤ 0.
- La ramener dans les bornes `[refHeight / 200, refHeight × 200]`, les
  mêmes que le curseur côté client.
- Garder la taille proposée de chaque joueur dans
  `question.scaleGuesses[token]`, comme `imagePoints` au mode « image ».

**Points : précision seule, sans `pointsFor` (décision utilisateur).**
- Écart r = |ln(proposé / réel)|.
- r ≤ ln(1,05), soit 5 % d'écart ou moins : 1000 points.
- r ≥ ln(2), soit ×2 ou ÷2 : 0 point.
- Entre les deux, décroissance linéaire sur l'échelle logarithmique.
- Constantes nommées : `SCALE_FULL_RATIO` = 1,05, `SCALE_ZERO_RATIO` = 2.

> Trade-off : le rapport plutôt que des centimètres, pour que 10 cm
> d'erreur pèsent beaucoup sur une fourmi et presque rien sur une girafe.
> Le choix linéaire en log reste simple, et les seuils sont à régler
> après un test en partie.

**Historique et récap.**
- `results` vaut `'correct'` si l'écart est ≤ 10 %, sinon `'incorrect'` :
  le récap et les statistiques ont besoin d'un verdict binaire.
- `deltas` reçoit les points réels.
- `answers` reçoit une chaîne lisible, par exemple « 1,20 m ».

**Révélation (`revealPayload`).**
- `target` : la vraie taille.
- `players` : `[{ name, height, colorIdx }]` pour chaque joueur ayant
  répondu, sans l'hôte.
- `colorIdx` est attribué une fois par joueur (`room.playerColorIdx`, par
  token, dans l'ordre de première réponse) puis réutilisé à chaque
  question. Un même joueur garde ainsi sa couleur toute la partie, et
  tous les écrans voient la même couleur.

Vérification : une partie simulée par sockets (même harnais que les tests
précédents). On contrôle les points à 0 %, 5 %, 30 % et ×2, que la vraie
taille est absente de `question:show`, et le contenu de `revealPayload`.

### Étape 2 — Éditeur : création de la question (`editor.html`, `editor.js`, `admin-bank.js`)

**Type.**
- Option « 📏 Échelle » dans la liste des types.
- Icône et couleur dans les tables d'`editor.js`, à côté de `graduation`.

**Section `#echelleSection`.**
- Deux blocs, « Référence » et « À deviner ». Chacun a une image, un
  libellé (« Nintendo Wii », « Psykokwak ») et une hauteur.
- Hauteur saisie en cm, avec un rappel en m quand elle dépasse 100 cm.

**Traitement des images (`processScaleImage`, nouvelle fonction).**
- Pas de `compressImageFile` : il passe en JPEG, ce qui détruit la
  transparence et donc la silhouette.
- Recadrage au ras des pixels non transparents : boîte englobante des
  pixels dont l'alpha est > 10, lue sur un canvas.
- Réduction à 600 px de haut maximum.
- Export en WebP avec transparence si le navigateur le permet, sinon en
  PNG.
- Si l'image n'a aucune transparence : on la garde entière, avec une
  remarque au créateur (« pas de fond transparent : l'image entière
  servira de silhouette »).
- Calcul et stockage de `refRatio` / `itemRatio`.

> Trade-off : une fonction dédiée plutôt qu'une option de plus à
> `compressImageFile`, déjà utilisée partout pour des photos (JPEG
> voulu). On évite de toucher un chemin partagé.

**Validation à la sauvegarde.**
- Les deux images sont présentes.
- Les deux hauteurs sont > 0.
- La hauteur de l'élément est dans les bornes `[réf / 200, réf × 200]`,
  sinon un message dit pourquoi.

**Envoi des médias.** Ajouter `refImage` et `itemImage` à
`uploadQuestionMedia`, pour qu'elles soient envoyées vers Supabase
Storage comme les autres images.

**Admin de la banque.** Ajouter le libellé « Échelle » et un résumé
(« Wii 23 cm → Psykokwak ») dans `admin-bank.js`.

Vérification : créer, sauvegarder, recharger et réouvrir une question,
avec un PNG transparent et avec un JPEG.

### Étape 3 — Écran de jeu : affichage et réglage (`index.html`, `index.js`, `style.css`)

**Métadonnées.**
- `QUESTION_TYPE_META.echelle` : icône, libellé, couleur, consigne.
- Le type apparaît alors dans la liste « Jouer » et dans « Comment
  jouer ? ».

**Envoi des images (`emitQuestion`).**
- Les URL Supabase sont transmises telles quelles
  (`refImageUrl` / `itemImageUrl`).
- Pour une image encore en base64 (aperçu « Tester », vieux brouillon),
  on réutilise le relais multi-images `/api/room-intrus-images` avec les
  identifiants `ref` / `item`.

> Trade-off : aucun nouvel endpoint serveur. Ce relais ne sert qu'à une
> question à la fois, donc partager son emplacement est sans risque.
> Commentaire à l'appui dans le code.

**Zone `#echelleArea` dans `#stageWrap`.**
- Une scène au ratio fixe, avec un sol.
- La référence à gauche, l'élément à deviner à droite, posés sur le sol.
- Taille de chaque silhouette = hauteur / hauteur visible de la scène, en
  % : tout est relatif, donc la copie de la scène sur la TV reste juste à
  n'importe quelle taille.

**Réglage de la taille.**
- Une poignée sur l'élément, à glisser vers le haut ou le bas (pointer
  events, comme le Halo et la Timeline).
- Un curseur logarithmique en dessous, pour le réglage fin et
  l'accessibilité. Pas de 1 % de la taille.
- L'élément démarre à la hauteur de la référence, sans indice sur la
  réponse.
- La taille courante est affichée : « 1,20 m ».

**Dézoom automatique.** La hauteur visible vaut 1,15 × la plus grande
taille à l'écran, pour que tout reste visible. Elle est lissée pour
éviter les sauts.

**Envoi et verrouillage.**
- Envoi de la taille dans `submitCurrentAnswer`.
- Ajout à la liste des types auto-envoyés en fin de chrono (même règle
  que `graduation` : l'état affiché est toujours une réponse valide).
- `.is-locked` après l'envoi, retiré à la question suivante.

**Images à l'écran.** Pendant la question, on affiche les vraies images,
plus reconnaissables qu'un aplat. Les aplats colorés ne servent qu'à la
révélation (étape 4).

Vérification : une partie en local sur téléphone (372 px) et sur grand
écran.

### Étape 4 — Révélation : silhouettes de tous les joueurs (`index.js`, `style.css`)

**Éléments affichés.**
- La silhouette grisée à la vraie taille.
- Une silhouette par joueur, en aplat de sa couleur : `mask-image` sur
  l'image de l'élément, fond = couleur du joueur, palette de 12 couleurs
  `--scale-player-0..11`, reprise en boucle au-delà de 12 joueurs.
- Le pseudo au-dessus de chaque silhouette, dans la même couleur.
- La référence, toujours affichée.

**Disposition.**
- Toutes les silhouettes alignées sur le sol, triées par taille, la
  grisée à sa place dans le rang.
- L'échelle est recalculée pour inclure la plus grande taille proposée.
- Les largeurs peuvent se chevaucher, mais pas les hauteurs, qui doivent
  rester vraies. Les silhouettes sont donc semi-transparentes.
- Les pseudos sont répartis sur deux rangées en alternance quand ils sont
  serrés.

> Trade-off : on garde les hauteurs exactes plutôt qu'une grille de
> vignettes. Une grille serait plus lisible à 20 joueurs, mais on n'y
> verrait plus les tailles, qui sont tout l'intérêt de la révélation.

**Bandeaux.**
- Bandeau `#revealAnswerText` : « Réelle : 0,80 m · Ta réponse : 1,20 m
  (+50 %) ».
- Bandeau personnel, selon les points :
  - 1000 : « Bonne réponse » ;
  - plus de 0 : « Presque ! (+X points) », en jaune ;
  - 0 : « Mauvaise réponse ».

Vérification : une partie simulée à 3 puis à 15 joueurs. Captures
téléphone, MJ et TV.

> Risque à contrôler à cette étape : `mask-image` sur une image Supabase
> Storage demande une réponse CORS du stockage. Si les en-têtes manquent,
> repli : silhouette en image réelle avec un contour coloré
> (`drop-shadow`) plutôt qu'un aplat.

### Étape 5 — Écran TV et « Comment jouer ? » (`display.js`, `index.js`)

**Écran TV.**
- Contrôler la copie de `#echelleArea`, qui doit déjà être juste puisque
  tout est en %.
- N'ajuster `display.js` que si le cadrage sur grand écran l'exige, comme
  pour `#haloWrap`.

**« Comment jouer ? ».**
- `TUTO_STEPS.echelle` : « Observe la référence », « Agrandis ou
  rétrécis », « Valide… puis attends », « ★ Plus tu es précis, plus tu
  marques ».
- Pas de vidéo pour l'instant (hors périmètre) : la grille et la fenêtre
  doivent gérer un type sans vidéo. Soit on affiche seulement les étapes,
  soit on retire le type de la grille vidéo. Choix à faire à l'étape, au
  plus simple.

Vérification : la TV ouverte depuis la vue MJ pendant une partie, et la
fenêtre « Comment jouer ? ».

**Interdictions du `CLAUDE.md` :** aucune étape ne touche
`supabase/schema.sql`, `render.yaml` ni les dépendances npm. Le type entre
dans le `jsonb` existant de `bank_questions` et `quizzes.questions`.

## Étapes réalisées
- [x] Étape 1 — serveur : réponse, points, révélation
- [x] Étape 2 — éditeur : création de la question
- [x] Étape 3 — écran de jeu : affichage et réglage
- [x] Étape 4 — révélation : silhouettes de tous les joueurs
- [x] Étape 5 — écran TV et « Comment jouer ? »

## Checks effectués
- [ ] `node --check <fichier>` sur chaque fichier JS modifié
  - [x] Étape 1 : `node --check server/index.js` OK
  - [x] Étape 2 : `node --check` OK sur `editor.js` et `admin-bank.js`
  - [x] Étape 3 : `node --check client/public/js/index.js` OK
  - [x] Étape 4 : `node --check client/public/js/index.js` OK
  - [x] Étape 5 : `node --check client/public/js/index.js` OK
- [ ] Démarrage serveur vérifié (si `server/index.js` touché)
  - [x] Étape 1 : le serveur démarre sur le port 3100. Seul avertissement
    au boot : la lecture Supabase de `min_points_floor`, sans réseau dans
    l'environnement de test (préexistant).
  - [x] Étape 1 : partie simulée par sockets, 4 joueurs, référence 23 cm,
    vraie taille 80 cm :
    - `question:show` ne contient pas `correct` ; `refHeight` est bien
      présent ;
    - points obtenus : 80 cm → 1000, 84 cm (+5 %) → 1000, 104 cm
      (+30 %) → 669, 160 cm (×2) → 0, sans `score:update` ;
    - `revealPayload` : `target` = 80, `players` donne le pseudo, la taille
      et `colorIdx` 0 à 3 ;
    - récap : réponses « 80 cm », « 84 cm », « 1,04 m », « 1,60 m » ; états
      correct / correct / presque / incorrect ; 50 % de bonnes réponses.
- [ ] Vérification visuelle Browser pane (si client touché)
  - [x] Étape 2 : éditeur piloté dans Chromium (Playwright, 1280 px et
    390 px), question « Échelle » créée depuis la grille :
    - un PNG 200×300 transparent, avec une silhouette 60×120 au milieu,
      est recadré à 60×120 (ratio 0,5) et exporté en WebP transparent ;
    - un PNG entièrement opaque est gardé entier, `refOpaque` vaut
      `true` et la remarque « Pas de fond transparent » s'affiche ;
    - les champs (images, noms, hauteurs) reviennent à l'identique après
      un changement de question ;
    - validation : refusée sans énoncé, acceptée à 23 cm / 80 cm, refusée
      à 23 cm / 9000 cm (hors bornes, avec message explicite), refusée
      sans image ;
    - captures vérifiées : deux colonnes sur ordinateur, empilées sur
      téléphone, aperçu sur damier.
  - [x] Étape 3 : vraie partie locale (MJ « Présenter » 1280 px + joueur
    390 px tactile). La question passe par le vrai `emitQuestion`, avec des
    images en base64, donc par le relais multi-images :
    - les deux images arrivent chez le joueur ; légendes « Nintendo Wii
      · 23 cm » et « Psykokwak » ;
    - l'élément démarre à 23 cm, à la taille de la référence ;
    - « Valider » s'ouvre à l'ouverture des réponses ;
    - glisser : le haut de l'élément suit le doigt ;
    - doigt maintenu en haut de la scène 0,9 s : la vue s'élargit
      jusqu'à 1,04 m, puis le réglage est précis à 80 cm ;
    - 5 × « − » : 72,5 cm (80 / 1,02⁵) ;
    - « Valider » envoie `72.5` et la scène se verrouille ;
    - côté MJ (et donc TV) : pas de −/+ ni de pastille de taille, et la
      scène tient dans la carte sans être coupée.
  - [x] Étape 4 : vraie partie locale (MJ, écran TV ouvert depuis la vue
    MJ, joueurs), avec 4 puis 15 joueurs ; Léa répond depuis l'interface
    (72,5 cm), les autres par socket, pour une vraie taille de 80 cm :
    - bandeaux de Léa : « Réelle : 80 cm · Ta réponse : 72,5 cm (-9 %) »
      et « Presque ! +923 points » (jaune) ; un joueur à 80 cm voit « Bonne
      réponse ! +1000 points » ;
    - silhouettes triées par taille, la grisée « Réponse · 80 cm » à sa
      place, avec son étiquette sous le sol ; un pseudo de la couleur du
      joueur au-dessus de chaque silhouette ;
    - à 15 joueurs : pseudos répartis sur plusieurs rangées, tous lisibles
      sur téléphone et TV ; la vue s'élargit pour limiter le recouvrement ;
    - TV : l'animation d'entrée des silhouettes n'est plus rejouée à chaque
      mise à jour du miroir (`data-anim-start`, reprise par
      `resumeEntranceAnimations`).
  - [x] Étape 5 :
    - TV ouverte depuis la vue MJ, capturée PENDANT la question : scène
      entière, référence et élément aux bonnes proportions, ni −/+ ni
      pastille de taille. Aucun changement nécessaire dans `display.js`,
      les tailles en % suffisent. La révélation sur TV était déjà vérifiée
      à l'étape 4 ;
    - « Comment jouer ? » : tuile « 📏 Échelle » présente, 4 étapes
      affichées, message « Démo bientôt disponible pour Échelle. » à la
      place de la vidéo (absence de fichier gérée par le code existant).

## Tests manuels recommandés
_(à remplir)_

## Risques restants
_(à remplir — à surveiller dès le plan : la lisibilité des silhouettes de
tous les joueurs quand ils sont nombreux, 15-20 en soirée, en particulier
sur un téléphone)_
- Étape 4 : les aplats de couleur utilisent `mask-image`, testé
  uniquement avec des images en `data:` (relais de l'aperçu). Avec une
  vraie URL Supabase Storage, le navigateur exige que le stockage autorise
  CORS pour ce masque. Supabase l'autorise normalement, mais c'est à
  vérifier en vrai sur une question sauvegardée. Si les aplats
  n'apparaissent pas (rectangles pleins de couleur), il faut revoir le
  rendu.
- Étape 4 : au-delà de 12 joueurs, les couleurs se répètent (palette de
  12, reprise en boucle). Les pseudos restent la distinction.
- Étape 4 : à 15+ joueurs, les silhouettes sont petites, surtout sur
  téléphone, et la TV garde de la hauteur vide au-dessus. La vue est
  élargie pour que les largeurs ne se chevauchent pas trop, puisque les
  hauteurs doivent rester exactes. À juger en soirée réelle.
- Étape 2 : la sauvegarde réelle vers Supabase Storage n'a pas pu être
  testée ici (pas de réseau vers Supabase). `refImage` et `itemImage` sont
  ajoutées à `uploadQuestionMedia`, et les fichiers partent en
  `image/webp`, ou en `image/png` sur Safari. À vérifier en vrai : si le
  bucket `quiz-media` limite les types de fichiers dans le tableau de bord
  Supabase (rien dans `schema.sql`), le WebP pourrait y être refusé.
- Étape 3 : ajouté en cours de route au plan, le **dézoom continu**.
  Pendant un glisser, la vue est figée pour que l'élément ne fuie pas sous
  le doigt. Sans dézoom, impossible de dépasser la hauteur visible : un
  élément 4× plus grand que la référence demandait de lâcher et reprendre
  une dizaine de fois. Désormais, garder le doigt dans les 10 % du haut de
  la scène élargit la vue en continu.
- Étape 5 : pas encore de vidéo de démo dans « Comment jouer ? » (hors
  périmètre). Elle se générera avec le moteur de démos hors dépôt, puis il
  faudra ajouter `TUTO_STEP_STARTS.echelle` et monter
  `TUTO_VIDEOS_VERSION`.
- Étape 3 (ajout validé par l'utilisateur) : **zoom sur un élément plus
  petit que la référence**. Tant que l'élément fait au moins 1/4 de la
  référence, la vue reste cadrée sur la référence. En dessous, elle suit
  l'élément et la référence sort par le haut, comme un zoom d'appareil
  photo. Doigt maintenu juste au-dessus du sol : la vue zoome en continu et
  l'élément rétrécit encore. Vérifié : 70 × « − » depuis 23 cm donne
  5,8 cm, l'élément occupant 18 % de la scène ; maintenu près du sol, on
  descend jusqu'à la borne de 0,1 cm et l'élément reste visible. Effet
  assumé : zoomée, la base de la référence remplit tout le fond de la
  scène.
- Étape 2 : le glisser-déposer d'un fichier sur l'éditeur n'est pas
  branché pour ce type (deux emplacements, la cible serait ambiguë). Il
  faut passer par les boutons de chaque emplacement.

## Statut
`ouverte`

## Retour après mise en ligne (v2.37, test sur téléphone)
Retour de l'utilisateur : réglage « pas fameux », surtout sur téléphone.
Corrigé :
- **Le glisser sur la scène et ses zooms automatiques sont supprimés.** Le
  doigt masquait l'élément, et `touch-action: none` sur la scène bloquait
  le défilement de la page. La taille se règle maintenant uniquement avec
  − et +, sur des boutons agrandis à 60 px, ou au clavier. La vue se
  recadre après chaque appui pour garder l'élément visible.
- **Le maintien des boutons accélère.** La répétition est de plus en plus
  rapide (jusqu'à toutes les 50 ms) et le pas grandit jusqu'à ±6 %. Un
  appui simple reste à ±2 %.
- Vérifié en local (390 px tactile) :
  - un appui + : de 23 à 23,5 cm ;
  - + maintenu 2 s : 1,01 m ;
  - − maintenu 1,5 s : 42 cm ;
  - un tap sur la scène ne change plus la taille, et `touch-action` revient
    à `auto` : la page défile.

## Méthode de jeu de Magnitudle (demande de l'utilisateur)
L'utilisateur a fourni les fichiers JS de Magnitudle (« Size It Up »). Ils
ont servi de **référence pour la mécanique**, rien n'a été recopié. Repris
et réécrit à la façon de QuEazy :
- **Pincement à deux doigts** sur la scène : la taille suit l'écartement en
  proportion.
- **Poignée ↗** au coin de l'élément : la taille suit la distance
  doigt-pied de l'élément.
- **Glisser l'élément** le long du sol (`itemX`), pour le poser contre la
  référence ; il devient translucide pendant le déplacement.
- **Zoom manuel uniquement**, avec deux boutons loupe (×0,75 par appui).
  On peut dézoomer jusqu'à 25 fois le champ de départ et zoomer jusqu'à
  4 fois plus près, ce qui est un ajout de notre part pour les éléments
  minuscules. Plus aucun recadrage automatique pendant le réglage. Les
  boutons − et + sont retirés.
- **Ligne pointillée** à la hauteur de la référence.
- **Taille de la référence et taille choisie cachées** pendant la
  question (comparaison à l'œil) ; elles réapparaissent à la révélation.
- **Barème** : paliers de Magnitudle (rapport → % des points)
  1,06 → 100, 1,12 → 90, 1,2 → 80, 1,35 → 65, 1,5 → 53, 2 → 33, 3 → 14,
  5 → 0, interpolés en log, sur 1000 points.
- Vérifié en local :
  - points : +5 % → 1000, ×1,5 → 530, ×2 → 330, ×5 → 0 ;
  - pincement tactile, doigts deux fois plus écartés : 23 → 46 cm ;
  - poignée tirée de +25 % : 46 → 57,5 cm ;
  - glisser : l'élément passe à 43 % de la largeur sans changer de
    taille ;
  - 2 dézooms puis 1 zoom : la vue passe de 47 à 84 puis 63 cm ;
  - aucune taille affichée pendant la question.
- `touch-action: none` est revenu sur la scène, indispensable pour pincer :
  la page ne défile pas quand le doigt est sur la scène, comme sur
  Magnitudle.

