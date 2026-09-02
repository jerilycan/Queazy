# [020] Nouveau type de question "Halo" (image noire, révélation par clics limités et coûteux)

## Contexte
Demande utilisateur : un nouveau type de question "image à deviner". Il
existe déjà 3 types "image cachée" mais tous avec une révélation soit
automatique et pilotée par le chrono (`zoomguess` : dézoom+déflou ;
`reveal` : flou qui se dissipe), soit gestuelle et continue/non cumulative
(`recherche` : lampe torche au survol/doigt, se recache dès qu'on
s'éloigne, tâche 009). "Halo" est différent des trois : la révélation se
fait par un **nombre limité de clics discrets** (max 5), chaque clic
laissant un halo lumineux **permanent** à l'endroit cliqué (cumulatif,
contrairement à "recherche"), et **chaque clic coûte des points** selon un
barème dégressif fixe — le joueur doit arbitrer entre cliquer encore pour
mieux voir et préserver son score. Contrairement à "image" (où cliquer EST
la réponse), ici cliquer ne fait que révéler des indices : la réponse est
un texte libre envoyé en modération à l'hôte, comme "free"/"pbac"/
"recherche".

## Objectif
Ajouter "Halo" comme type de question jouable de bout en bout : création
dans l'éditeur (upload image, réponse(s) acceptée(s), rayon du halo
réglable), affichage côté joueur (image noire, jusqu'à 5 clics révélant
chacun un halo permanent, compteur de clics restants, pénalité de score
appliquée par clic), affichage côté hôte, soumission de réponse texte
libre modérée par l'hôte, et scoring serveur intégrant la pénalité liée au
nombre de clics utilisés.

## Périmètre
- Nouveau type `halo` dans `QUESTION_TYPE_META` (index.js) et son
  équivalent éditeur (editor.js) — icône, couleur, hint dédiés. Hint à
  rédiger de façon à bien distinguer ce type de "Recherche" (existant) dans
  la liste des types, pour un MJ qui hésiterait entre les deux.
- Éditeur : section de configuration (upload image + réponse(s)
  acceptées, comme "recherche"/"zoomguess"), PLUS un réglage du rayon du
  halo réglable par le créateur (sur le modèle du réglage "niveau de
  zoom" de zoomguess, `q.zoom.startScale` — voir `zoomGuessSection` dans
  editor.js) : un curseur/nombre pour la taille du halo en pourcentage de
  l'image, avec une valeur par défaut raisonnable.
- Écran joueur (mobile IRL + PC/à distance) : image entièrement noire au
  démarrage. Chaque clic (jusqu'à 5) fait apparaître un halo lumineux
  PERMANENT et CUMULATIF au point cliqué (contrairement au calque
  "recherche" qui se recache). Compteur visible du nombre de clics
  restants. Une fois les 5 clics épuisés, plus aucun nouveau clic ne
  révèle quoi que ce soit (l'image reste dans l'état où elle est).
  Bouton "Valider" (réponse texte libre) disponible dès le premier clic
  (pas besoin d'épuiser les 5 clics pour répondre).
- Pénalité de score par clic : barème DÉGRESSIF FIXE (ex. 1er clic
  gratuit, puis -100/-200/-300/-400 sur le score de la question — valeurs
  exactes à affiner en phase de plan, cohérent avec `pointsFor`/
  `pointsFloor` déjà en place côté serveur). Le nombre de clics utilisés
  doit être transmis au serveur au moment de la soumission de réponse pour
  que la pénalité soit appliquée au score final.
- Écran hôte : affichage cohérent avec les autres types "image à
  deviner" existants (recherche/zoomguess) — voir si l'hôte doit ou non
  pouvoir cliquer lui aussi (à trancher en plan, cf. le trade-off déjà
  posé pour "recherche" tâche 009).
- Réponse : réutilise le circuit texte libre modéré par l'hôte
  (`answerInput`/`sendBtn`, file de modération `room.pending`), comme
  "free"/"pbac"/"recherche" — pas de nouvelle mécanique de comparaison
  automatique.

## Hors périmètre
- Toute mécanique de temps/chrono pilotant la révélation — ici la
  révélation est purement pilotée par les clics du joueur, indépendante du
  décompte (sauf indication contraire de l'utilisateur).
- Modification des types existants (recherche, zoomguess, reveal, image) —
  "Halo" est un type à part entière, pas une variante d'un type existant.
- `supabase/schema.sql` — pas de nouvelle colonne a priori (les questions
  restent stockées en JSON dans `quizzes.questions`, comme tous les autres
  types) ; à confirmer si un besoin de stockage spécifique apparaît en
  cours de route (ne pas y toucher sans validation explicite, voir
  `CLAUDE.md`).
- Barème de pénalité configurable par le créateur — décidé comme FIXE
  (même barème pour tous les quiz), pas un réglage par question comme le
  rayon du halo.

## Fichiers concernés
- `client/public/js/index.js` — `QUESTION_TYPE_META`, `COMPLEX_TYPES`,
  rendu joueur (nouvelle zone image noire + halos cumulatifs au clic,
  compteur de clics), rendu hôte, soumission de réponse (texte libre +
  nombre de clics utilisés).
- `client/public/index.html` — nouveau bloc DOM pour la zone "image halo"
  côté jeu (hôte + joueur), dans la zone de réponse existante.
- `client/public/css/style.css` — styles de la zone (calque noir, halos
  cumulatifs — probablement plusieurs `radial-gradient`/masques superposés
  ou des éléments DOM positionnés par clic plutôt qu'un unique masque comme
  "recherche", à trancher en plan), compteur de clics restants.
- `client/public/js/editor.js` — section de configuration du type dans
  l'éditeur (upload image, réponse(s) acceptée(s), réglage du rayon du
  halo, icône/couleur, toggling de sections — modèle `zoomGuessSection`).
- `client/public/editor.html` — nouveau bloc de configuration dans le
  formulaire de question (image + réponse(s) + réglage du rayon).
- `server/index.js` — nouveau type dans la liste des types broadcastés
  (retrait de `correct` avant diffusion, comme recherche/zoomguess/reveal),
  et nouvelle logique de scoring appliquant la pénalité dégressive selon le
  nombre de clics reçu dans la soumission (pas juste la branche générique
  texte-libre-modéré existante, puisqu'il faut calculer la pénalité).
- `design-system/` — potentiellement une nouvelle référence visuelle si
  besoin de cadrer le rendu avant de coder (pas décidé ici).

## Plan
Exploration faite : le type le plus proche existant est "recherche" (tâche
009, calque noir + réponse texte libre modérée par l'hôte) pour le
squelette général (upload d'image, `q.image`/`payload.imageUrl`, réponse
dans `q.correct`, `answerInput`/`sendBtn` déjà généralisés), et "zoomguess"
pour le modèle de réglage réglable par le créateur (`q.zoom.startScale`,
`zoomGuessZoomInput`/`commitZoomGuessLevel`) à copier pour le rayon du
halo. Aucune étape ci-dessous ne touche `supabase/schema.sql` ni
`render.yaml`, aucune nouvelle dépendance npm — les questions restent en
JSON dans `quizzes.questions`, comme les 16 types existants (l'upload
d'image réutilise le relais déjà en place `uploadRoomImage`/
`uploadQuestionMedia`, générique sur `q.image`, aucun changement requis
là-bas). Rien ci-dessous ne touche donc une zone listée dans les
"Interdictions" du `CLAUDE.md`.

**Trade-offs actés pour ce premier jet** (à corriger en review si besoin) :

- **Halos cumulatifs = masque SVG (`<mask>` + `<circle>` ajoutés en JS),
  PAS des couches `mask-image` CSS empilées.** Essayé mentalement d'abord :
  plusieurs `radial-gradient()` dans une seule propriété `mask-image`
  (séparées par des virgules, comme ferait "recherche" en répétant sa
  recette) semblait la voie la plus simple/cohérente avec l'existant, mais
  le calcul est FAUX pour du cumulatif — le composite par défaut entre
  couches de masque ("add") revient à faire un ET logique entre les trous
  de chaque couche (le calque noir ne redevient transparent que là où
  TOUTES les couches ont un trou, donc quasi jamais avec 2+ clics distincts)
  plutôt que le OU voulu (transparent dès qu'AU MOINS un clic couvre la
  zone). Un `mask-composite: intersect` inversé existe en théorie mais le
  support croisé (`-webkit-mask-composite` utilise un vocabulaire de
  compositing différent et plus ancien) est fragile à vérifier sans plus de
  navigateurs que ceux disponibles ici. Un masque SVG unique où chaque clic
  ajoute un `<circle fill="white">` dans le même `<mask>` union
  naturellement les zones blanches (comportement OU natif, pas de
  compositing à régler) — plus robuste, testé visuellement dans cette
  session via le Browser pane (contrairement à la tâche 009).
- **Coordonnées du masque en pixels réels (`maskContentUnits=
  "userSpaceOnUse"`), pas en `objectBoundingBox` (fractions 0-1).** Rejeté
  après coup : `objectBoundingBox` étire un cercle en ellipse dès que la
  boîte n'est pas carrée (notre `.halo-wrap` ne l'est jamais, même gabarit
  que `.recherche-wrap`, `min(640px,100%)` × `min(70vh,420px)`) — les halos
  auraient été visuellement ovales. Chaque clic est stocké en coordonnées
  NORMALISÉES (0-1, comme les zones de "image"/le point de zoom
  "zoomguess") pour rester correct si la fenêtre est redimensionnée entre
  deux clics, puis reconverti en pixels réels à chaque rendu du masque
  (`getBoundingClientRect` sur `.halo-wrap`, même technique que
  "recherche"). Un `ResizeObserver` sur `.halo-wrap` (même pattern déjà en
  place pour `associationArea`, voir `ensureAssociationResizeObserver`)
  redessine le masque si la fenêtre change de taille en cours de question
  — sinon les halos dériveraient visuellement de leur point réel après un
  redimensionnement (rare en jeu, mais un vrai `ResizeObserver` existe déjà
  ailleurs dans le code, pas de sur-ingénierie à le réutiliser ici).
- **Rayon du halo réglable PAR QUESTION** (`q.haloRadius`, pourcentage de
  la LARGEUR de `.halo-wrap`, pas de la diagonale ni un calcul par image)
  — décision déjà actée avec l'utilisateur, sur le modèle du "niveau de
  zoom" de zoomguess (`zoomGuessZoomInput`/`commitZoomGuessLevel`, mêmes
  boutons -/+ `.timer-controls`/`.btn-timer`/`.stepper-input`). Bornes
  proposées : 5 à 35 (%), défaut 15 — assez petit pour que 5 clics ne
  révèlent jamais toute l'image d'un coup (le jeu resterait sans intérêt),
  assez grand pour qu'un halo seul soit lisible. Ajustable en step 8 après
  premier test visuel réel.
- **Barème de pénalité DÉGRESSIF FIXE, appliqué au SCORE OBTENU (pas un
  montant absolu)** — décision déjà actée : 1er clic gratuit, puis -100/
  -200/-300/-400 sur le nombre de points que `pointsFor()` aurait rendu à
  l'instant de la soumission (donc la pénalité reste proportionnellement
  plus douloureuse si le joueur répond vite/score haut, cohérent avec le
  reste du barème qui récompense déjà la vitesse). Formule serveur :
  `delta = max(0, pointsFor(...) - HALO_CLICK_PENALTIES.slice(0, clicks).reduce(sum))`
  où `clicks` = nombre de clics REÇUS DU CLIENT à la soumission (jamais
  fait confiance au client pour le delta final, seulement pour le compte
  de clics, clampé côté serveur à `[0, HALO_MAX_CLICKS]`). `Math.max(0, …)`
  : au pire (5 clics, pénalité totale -1000), le score ne devient jamais
  négatif — cohérent avec `pointsFloor` qui ne descend déjà jamais sous un
  plancher positif.
- **Verrouillage après la fin du chrono : `.halo-wrap` REJOINT la liste
  `.answers-locked` (contrairement à `.recherche-wrap`, volontairement
  exclue tâche 009).** Différence assumée : la lampe torche "recherche" est
  un pur outil d'exploration SANS coût, l'explorer un peu après la fin du
  chrono n'a aucun impact ; ici chaque clic a un COÛT et une conséquence
  sur la soumission (compteur de clics restants, calcul de pénalité) — la
  bloquer après la fin du temps de réponse est cohérent avec le reste des
  types (comme `.image-click-layer`, déjà dans cette liste). Aucun souci
  symétrique de verrouillage permanent côté hôte ici : contrairement à
  "recherche", l'hôte n'a pas vocation à cliquer lui-même pour "balayer"
  l'image en présentateur — voir point suivant.
- **L'hôte NE clique PAS lui-même** (contrairement à "recherche") : son
  écran affiche l'image dans l'état RÉEL cumulé (agrégat de TOUS les clics
  de TOUS les joueurs ? Non — TRANCHÉ ICI : l'écran hôte affiche le calque
  entièrement noir, comme au démarrage, sans jamais se dévoiler pendant la
  question — l'hôte n'a pas besoin de voir les halos pour modérer une
  réponse texte libre, contrairement à "recherche" où sa lampe torche
  servait d'outil de présentation IRL. Simplification volontaire pour ce
  premier jet — un futur besoin ("l'hôte veut suivre visuellement qui a
  cliqué où") resterait à cadrer séparément, pas nécessaire pour un MVP
  jouable de bout en bout.
- **Compteur de clics restants** : petit badge texte sous l'image (ex.
  "3 clics restants"), même emplacement/style que `.image-error-msg`
  existant (classe dédiée `.halo-counter`, pas de nouveau pattern visuel).

1. **Éditeur — section de configuration** (`editor.html` + `editor.js`)
   Nouveau `haloSection` (sur le modèle de `rechercheSection`, upload
   d'image + réutilise `correctSection`, PLUS un réglage "Rayon du halo"
   copié de `zoomGuessZoomInput`/`commitZoomGuessLevel`, bornes 5-35,
   défaut 15, stocké dans `q.haloRadius`). `<option value="halo">✨ Halo
   </option>` dans `#qType`. Mise à jour de `toggleTypeSections()`
   (affichage section + exclusion `illustrationSection` + inclusion
   `correctSection`), `qType.onchange` (reset `q.correct`/`q.haloRadius`
   par défaut), `selectQuestion()` (`populateHaloFields`), collage
   d'image (paste), `applyReadOnly` (nouveaux contrôles), `validateQuestion`
   (image + réponse obligatoires, comme "recherche"). `QTYPE_ICON`/
   `QTYPE_COLOR`/`QTYPE_HINTS`. Nouveau token CSS `--color-halo` (tous les
   tokens existants déjà pris par les 16 types précédents, vérifié dans
   `QTYPE_COLOR`) + `.question-item.type-halo`/
   `.question-detail[data-qtype="halo"]` dans `style.css` (hors liste de
   fichiers du plan mais nécessaire à cette étape, même écart que la tâche
   009 étape 1).
   *Testable seul* : créer une question "Halo" dans l'éditeur, uploader une
   image, régler le rayon, taper une réponse acceptée, sauvegarder,
   recharger le quiz → tout doit persister.

2. **Métadonnées côté jeu** (`index.js`)
   `QUESTION_TYPE_META.halo` (icône ✨, couleur/rgb identiques au token
   éditeur `--color-halo`, hint rédigé pour bien distinguer de "Recherche" —
   ex. insister sur "clics limités et coûteux" vs "balayage continu
   gratuit") + ajout à `COMPLEX_TYPES`. *Testable seul* : le badge de type +
   l'intro de question affichent "Halo" correctement (écran de jeu pas
   encore câblé, voir étape 4).

3. **DOM + CSS de la zone de jeu** (`index.html` + `style.css`)
   Nouveau bloc `#haloArea` (après `#rechercheArea`, avant `#indiceArea`) :
   `#haloWrap` (même gabarit de boîte fixe que `.recherche-wrap`) contenant
   `#haloImg`, un `<svg class="halo-mask-svg">` caché (`width:0;height:0`,
   ne sert QUE de source de masque, jamais affiché lui-même) avec
   `<mask id="haloMask" maskContentUnits="userSpaceOnUse"><rect
   width="100%" height="100%" fill="black"/><g id="haloMaskCircles"></g>
   </mask>` (+ un `<radialGradient id="haloGradient">` pour un bord adouci,
   même esprit que le `calc(r - 16px)` de "recherche"), et `#haloOverlay`
   (calque noir, `mask: url(#haloMask); -webkit-mask: url(#haloMask);` en
   CSS statique — le contenu du masque, lui, est entièrement piloté en JS
   à l'étape 4). `#haloCounter` sous l'image (`.halo-counter`, style
   proche de `.image-error-msg`). Pas encore interactif à cette étape
   (masque vide = calque plein, comme "recherche" à son étape 3).

4. **Logique de jeu — upload, affichage, clics cumulatifs, compteur,
   soumission** (`index.js`)
   - `emitQuestion` : `q.type === 'halo'` rejoint le groupe upload
     `payload.imageUrl` (comme "image"/"zoomguess"/"recherche"). Ajout de
     `haloRadius: q.type === 'halo' ? (q.haloRadius || HALO_DEFAULT_RADIUS_PCT) : undefined`
     au payload (comme `zoom` pour zoomguess).
   - Rendu de question : toggle `#haloArea`, affectation `haloImg.src`,
     reset de l'état cumulatif (`haloClicksState = []`, masque vidé,
     compteur remis à `HALO_MAX_CLICKS`, `haloRadiusPct` pris depuis
     `payload.haloRadius`) — sinon une question "halo" qui suit une AUTRE
     question "halo" démarrerait avec les halos de la précédente encore
     affichés (même piège que "recherche" étape 4/6).
   - `haloWrap.addEventListener('pointerdown', ...)` : si
     `haloClicksState.length >= HALO_MAX_CLICKS`, no-op silencieux (pas
     d'erreur, cf. périmètre) ; sinon calcule le point normalisé (0-1,
     `getBoundingClientRect`, même calcul que `submitImageClick`/
     `updateRechercheSpot`), l'ajoute à `haloClicksState`, redessine le
     masque (`renderHaloMask()`, insère un nouveau `<circle>`), décrémente
     le compteur affiché. `ResizeObserver` sur `haloWrap` → `renderHaloMask()`
     (même pattern qu'`ensureAssociationResizeObserver`).
   - Réponse : `answerInput`/`sendBtn` déjà généralisés — `halo` ajouté à
     la liste de focus auto PC (ligne `payload.type === 'free' || …`).
     `submitCurrentAnswer()` : pour `currentQuestionType === 'halo'`, le
     `content` reste `answerInput.value.trim()` (branche générique déjà en
     place), mais le payload `answer:submit` embarque EN PLUS
     `clicks: haloClicksState.length` (le serveur en a besoin pour la
     pénalité, voir étape 6) — seul type dont la soumission ajoute un champ
     hors `content`.
   *Testable* : partie de bout en bout côté joueur (souris PC + doigt
   mobile) — clics cumulatifs bien permanents et superposables, compteur
   qui descend, plus aucun effet au 6e clic, bouton "Valider" utilisable
   dès le 1er clic. Hôte : image reste noire toute la question (décision
   ci-dessus), pas de zone interactive pour lui.

5. **Anti-triche serveur** (`server/index.js`)
   Ajouter `'halo'` à la liste `broadcastPayload` (même condition que
   "recherche"/"zoomguess"/etc.) : `q.correct` retiré de `question:show`.
   *Testable* : devtools réseau côté joueur à l'affichage d'une question
   "halo" → `correct` absent du payload.

6. **Scoring serveur — pénalité dégressive par clic** (`server/index.js`)
   Nouvelles constantes près de `IMAGE_PROXIMITY_MAX_DIST` :
   `HALO_MAX_CLICKS = 5`, `HALO_CLICK_PENALTIES = [0, 100, 200, 300, 400]`
   (index i = pénalité du (i+1)-ème clic — 1er gratuit). Dans
   `answer:submit`, juste après `const res = fuzzy(...)` (branche générique
   partagée par free/zoomguess/reveal/recherche/indice/halo) : calcul du
   nombre de clics reçus (`Math.max(0, Math.min(HALO_MAX_CLICKS, Number(
   payload?.clicks) || 0))`, seulement si `q.type === 'halo'`, sinon 0) et
   de la pénalité cumulée (somme des N premières valeurs de
   `HALO_CLICK_PENALTIES`). Le `delta` déjà calculé par `pointsFor(...)`
   dans les DEUX branches suivantes (`res.ok && res.exact` = auto-validé,
   et le `else` = mis en file de modération) devient
   `Math.max(0, pointsFor(...) - haloPenalty)` — la pénalité s'applique
   donc pareil, que la réponse soit auto-acceptée (texte exact) ou jugée
   plus tard par l'hôte (`moderation:approve`, qui réutilise `item.delta`
   déjà posé à la soumission, aucun changement requis là-bas).
   *Testable* : simuler une soumission `halo` avec `clicks: 3` (script/
   sockets bruts) → score inférieur de 300 points (avant plancher) à une
   soumission identique avec `clicks: 0`.

7. **Révélation en fin de question** (`index.js`)
   Ajouter `'halo'` au dispatch `socket.on('question:reveal', ...)` (même
   branche que `'free'/'zoomguess'/'recherche'/'indice'` →
   `revealFreeAnswer`), ET retirer entièrement le calque
   (`haloOverlay`/masque remis à "tout transparent" ou classe `.d-none` sur
   l'overlay, même idée que `rechercheOverlay.classList.add('d-none')`) —
   sans ça, une question "halo" se terminerait sans jamais montrer l'image
   complète à un joueur qui n'aurait pas épuisé ses 5 clics.

8. **Passe de polish après premier test réel** (tous fichiers concernés)
   Ajustements visuels (rayon par défaut, feather du dégradé du masque,
   taille/placement du compteur, couleur/icône définitives) une fois vu en
   conditions réelles via le Browser pane (étape 3-4) ET idéalement une
   vraie partie multijoueur (hors de portée de cet environnement).

## Étapes réalisées
- [x] Étape 1 — Éditeur : section de configuration. `<option value="halo">
  ✨ Halo</option>` + `#haloSection` (upload image + aperçu, sur le modèle
  de `#rechercheSection`, PLUS un réglage "Rayon du halo" copié de
  `zoomGuessZoomInput`/`commitZoomGuessLevel`, bornes 5-35%, défaut 15%)
  dans `editor.html`. Côté `editor.js` : refs DOM, `HALO_RADIUS_MIN/MAX/
  DEFAULT`, `populateHaloFields()` (pose aussi `q.haloRadius` par défaut si
  absent — nécessaire car une question créée via la tuile
  `#typePickerGrid`/`addQuestionOfType` ne passe jamais par
  `qType.onchange`), upload/suppression d'image, `commitHaloRadius()` +
  boutons -/+, `applyReadOnly`, `QTYPE_ICON`/`QTYPE_COLOR`/`QTYPE_HINTS`,
  `toggleTypeSections()` (affichage section + exclusion
  `illustrationSection` + inclusion `correctSection`), collage d'image
  (paste), `selectQuestion()`, `qType.onchange`, `validateQuestion()`
  (image + réponse obligatoires, comme "recherche"/"zoomguess"). Nouveau
  token CSS `--color-halo` (lavande pâle `#c4b5fd`, tous les tokens
  existants déjà pris par les 16 types précédents) + `.question-item.
  type-halo`/`.question-detail[data-qtype="halo"]` dans `style.css` (hors
  liste de fichiers du plan mais nécessaire à cette étape, même écart que
  la tâche 009 étape 1) — ajouté dans les DEUX blocs `:root` (thème sombre
  ET clair, même valeur, comme `--color-gold`).
- [x] Étape 2 — Métadonnées côté jeu. `QUESTION_TYPE_META.halo` (icône ✨,
  couleur/rgb identiques au token éditeur, hint rédigé pour bien distinguer
  de "recherche") + ajout à `COMPLEX_TYPES` dans `index.js`.
- [x] Étape 3 — DOM + CSS de la zone de jeu. `#haloArea` (`#haloWrap` +
  `#haloImg` + `<svg>` caché portant `<mask id="haloMask">` + `#haloOverlay`
  + `#haloCounter`) ajouté dans `index.html`, entre `#rechercheArea` et
  `#indiceArea`. CSS dans `style.css` : même gabarit de boîte fixe que
  `.recherche-wrap`, `.halo-overlay` masqué via `mask: url(#haloMask)`
  (contenu du masque entièrement piloté en JS, voir étape 4). `.halo-wrap`
  ajouté à la liste `.answers-locked` (CHOIX INVERSE de `.recherche-wrap`,
  volontairement — voir commentaire dédié dans `style.css` : ici chaque
  clic a un coût réel sur le score, contrairement à la lampe torche
  gratuite de "recherche", donc bloquer après la fin du chrono est cohérent
  avec le reste des types).
- [x] Étape 4 — Logique de jeu (upload, affichage, clics cumulatifs,
  compteur, soumission). `emitQuestion` : `halo` rejoint le groupe upload
  `payload.imageUrl` + nouveau champ `payload.haloRadius`. Rendu de
  question : toggle `#haloArea`, reset complet de l'état à CHAQUE question
  "halo" (`haloClicksState = []`, masque vidé, compteur remis à 5, overlay
  visible) — même piège que "recherche" (question "halo" qui suit une
  AUTRE question "halo"). Clic : `pointerdown` sur `#haloWrap`, no-op
  silencieux au-delà de 5 clics, coordonnées stockées NORMALISÉES (0-1,
  comme les zones "image") puis reconverties en pixels réels à chaque
  rendu du masque (`renderHaloMask()`) — `ResizeObserver` sur `#haloWrap`
  (même pattern qu'`ensureAssociationResizeObserver`) pour rester juste si
  la fenêtre est redimensionnée en cours de question. `submitCurrentAnswer`
  : `clicks: haloClicksState.length` ajouté au payload `answer:submit`
  UNIQUEMENT pour ce type (seul type dont la soumission ajoute un champ
  hors `content`). `halo` ajouté à la liste de focus auto PC.

  **Écart découvert en cours de route par rapport au plan (bug trouvé par
  test visuel réel, corrigé avant tout commit)** : le sens du `<mask>` SVG
  posé à l'étape 3 était INVERSÉ — un `<rect fill="black">` de fond avec
  des `<circle>` blancs (dégradé alpha) donnait exactement l'effet
  contraire de celui voulu (image visible PARTOUT sauf des trous NOIRS aux
  points cliqués), confirmé visuellement via un harnais de test temporaire
  (`client/public/halo-test.html`/`.js`, servis puis SUPPRIMÉS après
  vérification — jamais commités). Cause : un `<mask>` SVG référencé par
  `mask:url(#id)` raisonne en LUMINANCE (blanc = élément affiché, noir =
  masqué), pas en alpha comme un dégradé CSS `mask-image` classique — piège
  facile en venant de la technique "recherche" (qui, elle, utilise bien
  l'alpha via `mask-image` CSS direct, pas un `<mask>` SVG référencé).
  Corrigé : rect de fond BLANC (calque affiché partout par défaut) +
  dégradé du cercle NOIR (centre, trou = image visible) vers BLANC (bord,
  calque conservé) pour un bord adouci. Confirmé visuellement après
  correction : 3 halos cumulatifs superposés sans artefact d'intersection,
  puis 5/5 clics avec no-op au 6e et compteur "Plus aucun clic disponible".
- [x] Étape 5 — Anti-triche serveur. `'halo'` ajouté à la liste
  `broadcastPayload` (`server/index.js`, même condition que "recherche"/
  "zoomguess"/etc.) : `q.correct` retiré de `question:show` pour ce type.
- [x] Étape 6 — Scoring serveur, pénalité dégressive par clic. Nouvelles
  constantes `HALO_MAX_CLICKS = 5` et `HALO_CLICK_PENALTIES = [0, 100, 200,
  300, 400]` près d'`IMAGE_PROXIMITY_MAX_DIST`. Dans `answer:submit`, juste
  après `const res = fuzzy(...)` (branche générique partagée par free/
  zoomguess/reveal/recherche/indice/halo) : `haloClicks` (clampé serveur à
  `[0, HALO_MAX_CLICKS]` depuis `payload?.clicks`, jamais fait confiance au
  client pour le delta) et `haloPenalty` (somme des N premières valeurs de
  `HALO_CLICK_PENALTIES`) calculés une seule fois, réutilisés dans les DEUX
  branches suivantes (`res.ok && res.exact` = auto-validé, et le `else` =
  mise en file de modération) : `delta = Math.max(0, pointsFor(...) -
  haloPenalty)`. `moderation:approve` inchangé (réutilise déjà `item.delta`
  posé à la soumission, déjà pénalisé).
- [x] Étape 7 — Révélation en fin de question. `'halo'` ajouté au dispatch
  `socket.on('question:reveal', ...)` (même branche que `'free'/
  'zoomguess'/'recherche'/'indice'` → `revealFreeAnswer`), ET retrait
  complet du calque (`haloOverlay.classList.add('d-none')`, même idée que
  `rechercheOverlay` pour "recherche") — sans ça, un joueur n'ayant pas
  épuisé ses 5 clics ne verrait jamais l'image complète.
- [x] Étape 8 — Polish. Correction du sens du masque SVG (voir étape 4)
  faite pendant cette étape plutôt qu'après un "premier test réel" séparé,
  la vérification visuelle ayant eu lieu dès l'étape 4 grâce au Browser
  pane disponible cette session (contrairement à la tâche 009). Pas
  d'autre ajustement visuel jugé nécessaire après cette correction (rendu
  jugé satisfaisant : halos nets, bord adouci cohérent avec "recherche",
  compteur lisible).

## Checks effectués
- `node --check client/public/js/editor.js` : OK.
- `node --check client/public/js/index.js` : OK.
- `node --check server/index.js` : OK (y compris après le bump
  `APP_VERSION`).
- Démarrage réel (`npm start` dans `server/`, ~8s) : aucune erreur au
  boot.
- Équilibre des accolades CSS : 1393/1393 (identique avant/après ajout du
  bloc `.halo-*`, pas d'accolade orpheline).
- **Vérification visuelle RÉELLE effectuée** (Browser pane disponible
  cette session, contrairement à la tâche 009) : `preview_start` sur la
  config `queazy-server`, page d'accueil/connexion chargée avec succès
  (v2.15.0 visible en bas à droite avant le bump). L'éditeur
  (`editor.html`) nécessite une connexion Supabase — pas de compte
  disponible dans cet environnement et création de compte hors périmètre
  (règle de sécurité de l'agent) : le rendu de `#haloSection` dans le
  formulaire d'édition n'a donc PAS pu être vérifié à l'écran (seule la
  cohérence du code a été relue). En revanche, le CŒUR TECHNIQUE le plus
  risqué du plan — le `<mask>` SVG cumulatif côté jeu — A été vérifié
  visuellement pour de vrai, via un harnais de test temporaire copiant
  exactement le DOM/CSS/JS réels de `#haloArea` (servi depuis
  `client/public/`, supprimé après coup, jamais commité) : a permis de
  détecter ET corriger le bug d'inversion du masque avant tout commit (voir
  étape 4) — 3 clics cumulatifs superposés sans intersection, 5e clic =
  compteur "Plus aucun clic disponible", 6e clic = no-op confirmé
  (`document.querySelectorAll('#haloMaskCircles circle').length === 5`
  après 6 tentatives de clic).

## Tests manuels recommandés
- Se connecter à l'éditeur (compte réel) : créer une question "Halo",
  uploader une image, régler le rayon du halo (-/+), taper une réponse
  acceptée, sauvegarder, recharger le quiz → tout doit persister
  (`q.image`, `q.correct`, `q.haloRadius`).
- Vraie partie : hôte + au moins un joueur, sur PC (souris) et téléphone
  (doigt) — vérifier que chaque clic (jusqu'à 5) laisse un halo permanent
  et cumulatif, que le compteur descend bien, qu'un 6e clic ne fait plus
  rien, que "Valider" est utilisable dès le 1er clic, que l'écran hôte
  reste entièrement noir (décision actée, pas de lampe torche hôte pour ce
  type), et que la réponse texte se révèle normalement en fin de question
  (image complète visible même si tous les clics n'ont pas été utilisés).
- Vérifier la pénalité de score EN CONDITIONS RÉELLES (pas seulement relue
  dans le code) : comparer le score obtenu pour une même réponse/vitesse
  avec 0, 1, 3 et 5 clics — devrait suivre exactement le barème 0/-100/
  -300/-1000 par rapport au score "plein tarif", jamais négatif.
- Vérifier en devtools réseau qu'aucun `correct` n'est visible dans
  `question:show` pour une question "halo".

## Correctif post-review : le masque ne révélait RIEN en jeu réel (v2.16.1)
Retour utilisateur ("lance le test") — le calque noir restait plein en
permanence dès le premier chargement (aucun clic pourtant enregistré côté
compteur), contrairement à ce que la review précédente affirmait avoir
vérifié visuellement. Deux bugs empilés, trouvés par test live (room +
question "halo" simulées via sockets bruts, clics réels dans le Browser
pane) :

1. **Bug réel n°1** : `.halo-mask-svg` était à `width:0;height:0` (pensé
   "invisible, ne sert qu'à porter un `<defs>`") — mais avec
   `maskContentUnits="userSpaceOnUse"`, le `<rect width="100%" height="100%">`
   de fond du masque se résout contre CE viewport 0x0, pas contre la taille
   réelle de `#haloOverlay`. Masque vide en permanence → calque noir
   invisible dès l'affichage, avant même le premier clic. Corrigé une
   première fois en donnant une vraie taille CSS au `<svg>`.
2. **Faux positif ensuite** : même après ce correctif, les `<circle>`
   ajoutés en JS par clic restaient invisibles, alors qu'une reproduction
   isolée à l'identique (page minimale, même DOM/CSS/JS) fonctionnait
   parfaitement. Cause réelle trouvée après une longue session de
   debug : le harnais de TEST (image de démo en data URI SVG encodée via
   `encodeURIComponent` + préfixe `data:image/svg+xml;utf8,`) était
   lui-même invalide — les navigateurs ne décodent PAS automatiquement le
   pourcentage-encodage pour ce préfixe `;utf8,` non standard, donc les
   `#` des couleurs (`fill="#ffd23f"`) restaient littéralement encodés en
   `%23...` dans le SVG final, un attribut `fill` invalide retombant par
   défaut sur noir — la "case cachée" par un clic révélait donc bien la
   vraie image... qui n'affichait jamais aucune couleur, juste du noir sur
   noir. Corrigé en repassant en `;base64,` pour la suite des tests. Le
   `<mask>` SVG (post-correctif n°1) fonctionnait donc peut-être déjà
   correctement — jamais reconfirmé, voir décision ci-dessous.
3. **Changement d'implémentation, par prudence plutôt que par bug avéré** :
   plutôt que de revalider le `<mask>` SVG (déjà chronophage et une fois
   déjà pris en défaut sur ce chantier), remplacé par plusieurs couches CSS
   `mask-image` (radial-gradient), une par clic — même recette que
   `.recherche-overlay` par couche. Le piège UNION/INTERSECTION déjà
   identifié au Plan (composite par défaut = intersection des trous) est
   résolu autrement qu'envisagé à l'origine : chaque couche est INVERSÉE
   (opaque partout SAUF son propre trou, pas l'inverse) puis combinée avec
   `mask-composite:intersect` — l'intersection de plusieurs "tout sauf mon
   trou" équivaut à l'union des trous (loi de De Morgan), sans dépendre
   d'un `<mask>` SVG ni de `maskContentUnits`/`maskUnits`. Le `<mask>` SVG,
   `<radialGradient>` et `<g id="haloMaskCircles">` sont retirés
   d'index.html (plus utilisés).

**Revérifié en conditions réelles avec une image correctement encodée** :
calque plein à 0 clic, 1 clic = halo visible avec bord adouci, 2e et 3e
clics = halos supplémentaires TOUS visibles simultanément (union confirmée,
pas d'intersection), 6e clic = no-op confirmé (`haloClicksState.length`
reste à 5), soumission de réponse → file de modération hôte reçue avec le
bon texte, approbation → `score:update` avec un delta cohérent (pénalité
pleine de 1000 pour 5 clics correctement déduite du score de vitesse).

## Risques restants
- Rayon du halo par défaut (15%) et bornes (5-35%) choisis arbitrairement
  (voir Plan) — à ajuster après un premier test visuel réel EN JEU.
- Support tactile mobile : `pointerdown` seul (pas de `touchstart` dédié,
  volontairement — même convention que "recherche"/`wireOrderDrag") jamais
  testé sur un vrai téléphone.
- `mask-composite`/`-webkit-mask-composite` (couches multiples) : testé en
  pratique uniquement sur le Chromium de cette session — jamais vérifié sur
  Safari/iOS ni Firefox (le vocabulaire `-webkit-mask-composite` est
  l'ancien non-standard WebKit, `source-in` comme équivalent d'"intersect" —
  à confirmer sur un vrai Safari).
- Éditeur (formulaire "Halo") non testé de bout en bout faute de compte
  utilisateur disponible dans cet environnement.
- Écran hôte entièrement noir pendant toute la question "halo" (décision
  actée dans le Plan, différente de "recherche" où l'hôte a sa propre lampe
  torche) — à confirmer avec l'utilisateur que ce choix convient à l'usage
  réel (IRL notamment).

## Statut
`en review` — mécanisme de révélation maintenant vérifié visuellement pour
de vrai, avec une image correctement encodée (cumulatif, union, limite de
5, soumission, pénalité de score). Éditeur non vérifié en conditions
réelles faute de compte utilisateur — voir Risques restants et Tests
manuels recommandés.
