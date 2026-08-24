# [009] Nouveau type de question "Recherche" (image cachée, révélation au survol)

## Contexte
Demande utilisateur : un 14e type de question. Il existe déjà 2 types
"image à deviner" avec révélation progressive PILOTÉE PAR LE CHRONO
(zoomguess : dézoom+déflou automatique ; reveal : flou qui se dissipe,
tâche 008). "Recherche" est différent : la révélation n'est pas automatique
mais ACTIVE — pilotée par le geste du joueur (survol souris ou doigt sur
mobile), façon "carte à gratter"/"brouillard de guerre" (fog of war). Le
joueur doit deviner ce que représente l'image en la révélant lui-même, puis
valider sa réponse en texte libre.

## Objectif
Ajouter "Recherche" comme type de question jouable de bout en bout :
création dans l'éditeur (upload image + réponse(s) acceptée(s)), affichage
côté joueur (image sous calque noir opaque, zone révélée au passage du
curseur/doigt, bouton "Valider" en dessous), affichage côté hôte, et
scoring côté serveur (comparaison texte libre).

## Périmètre
- Nouveau type `recherche` dans `QUESTION_TYPE_META` (index.js) et son
  équivalent éditeur (editor.js) — icône, couleur, hint dédiés.
- Éditeur : section de configuration (upload image + réponse(s)
  acceptées), sur le modèle de "zoomguess"/"free" (réutilise
  `#correctSection`, générique aux types à réponse texte libre).
- Écran joueur (mobile IRL + PC/à distance) : image sous un calque noir
  opaque, révélation façon **lampe torche/spotlight** (décidé avec
  l'utilisateur) : seule la zone actuellement sous le curseur/doigt est
  visible, elle se recache dès qu'il s'éloigne — jamais cumulatif. Rayon/
  taille de la zone révélée à préciser au moment du plan.
- Bouton "Valider" en dessous de l'image, réutilise le layout empilé
  `.free-text-input` déjà en place pour free/reveal/pbac/blindtest/
  zoomguess (tâche 008) — texte "Valider" déjà généralisé à tous les types.
- Écran hôte : affichage cohérent avec les autres types "image à deviner"
  existants (zoomguess).
- Scoring serveur : comparaison texte libre, comme "free"/"zoomguess"
  (server/index.js) — pas de nouvelle mécanique de score.
- Support tactile (mobile) en plus de la souris — la description mentionne
  explicitement les deux.

## Hors périmètre
- Toute mécanique de temps/chrono pilotant la révélation (contrairement à
  zoomguess/reveal) — ici la révélation est purement gestuelle, indépendante
  du décompte (sauf indication contraire de l'utilisateur).
- Modification des types existants (zoomguess, reveal, image) — "Recherche"
  est un type à part entière, pas une variante d'un type existant.
- `supabase/schema.sql` — pas de nouvelle colonne a priori (les questions
  sont stockées en JSON dans `quizzes.questions`, comme tous les autres
  types) ; à confirmer si un besoin de stockage spécifique apparaît en
  cours de route (ne pas y toucher sans validation explicite, voir
  `CLAUDE.md`).
- Mode "à distance" hérite du même mécanisme de révélation gestuelle que
  l'IRL (souris disponible sur PC) — pas de traitement différent entre les
  2 modes pour ce type, sauf si l'utilisateur en décide autrement.

## Fichiers concernés
- `client/public/js/index.js` — `QUESTION_TYPE_META`, rendu joueur (nouvelle
  zone de révélation, calque + détection de survol/toucher), rendu hôte,
  soumission de réponse (texte libre, même chemin que free/zoomguess).
- `client/public/index.html` — nouveau bloc DOM pour la zone "image cachée"
  côté jeu (hôte + joueur), dans la zone de réponse existante.
- `client/public/css/style.css` — styles de la zone de révélation (calque
  noir opaque, effet de dévoilement).
- `client/public/js/editor.js` — section de configuration du type dans
  l'éditeur (upload image, réponse(s) acceptée(s), icône/couleur, toggling
  de sections — voir les nombreux points d'accroche `zoomguess` existants
  comme modèle).
- `client/public/editor.html` — nouveau bloc de configuration dans le
  formulaire de question.
- `server/index.js` — ajout du type à la liste des types broadcastés (voir
  la liste explicite de types autour de la ligne ~1398) et au scoring texte
  libre existant (comme "free").
- `design-system/` — potentiellement une nouvelle référence visuelle si
  l'utilisateur veut cadrer le rendu avant de coder (pas décidé ici).

## Plan
Exploration faite : le type le plus proche existant est "zoomguess" (image
obligatoire à deviner, réponse texte libre, upload/anti-triche déjà
rodés) — "recherche" en réutilise le squelette de données (`q.image` /
`payload.imageUrl`, réponse dans `q.correct`/le bouton "Valider" déjà
généralisé en tâche 008), mais avec un mécanisme de révélation **actif**
(piloté par le pointeur/doigt du joueur) plutôt qu'automatique (piloté par
le chrono). Aucune étape ne touche `supabase/schema.sql` ni `render.yaml`,
aucune nouvelle dépendance npm — toutes les questions restent stockées en
JSON dans `quizzes.questions`, comme les 13 types existants ; l'upload
d'image réutilise le relais déjà en place pour "image"/"zoomguess"
(`uploadRoomImage`/`uploadQuestionMedia`). Rien ci-dessous ne touche donc
une zone listée dans les "Interdictions" du `CLAUDE.md`.

**Trade-offs actés pour ce premier jet** (à corriger en review si besoin) :
- **Technique de révélation** : `mask-image: radial-gradient(...)` sur un
  calque noir, pilotée par 2 propriétés CSS custom (`--spot-x`/`--spot-y`)
  mises à jour en JS au pointermove — pas de `<canvas>` à redessiner à la
  main (plus simple, moins coûteux). Nécessite le préfixe
  `-webkit-mask-image` pour Safari (les deux seront posées).
- **Rayon de la lampe torche fixe** (pas de réglage par question dans
  l'éditeur, contrairement au "niveau de zoom" de zoomguess) — pas de
  sur-ingénierie pour une première version ; une constante CSS facilement
  ajustable si un réglage par question s'avère nécessaire à l'usage.
- **L'hôte a sa propre lampe torche interactive** (même composant que le
  joueur, verrouillé pour le scoring comme "image"/"order"/etc.) plutôt
  qu'une vue "réponse déjà visible" pour lui — cohérent avec
  "l'écran hôte n'est qu'un écran de plus à partager" déjà en place pour
  "zoomguess" ; utile comme outil de présentation en IRL (l'hôte balaie
  l'image pour le groupe), neutre en mode à distance.
- **Anti-triche** : `correct` doit être retiré de la diffusion initiale
  (comme "zoomguess"/"reveal") — sans ça, la réponse est lisible en
  devtools dès l'affichage de la question, avant même d'avoir commencé à
  explorer l'image. Point de vigilance explicite, voir étape 5.

1. **Éditeur — section de configuration** (`editor.html` + `editor.js`)
   Nouveau `rechercheSection` (sur le modèle de `zoomGuessSection`, sans le
   réglage "niveau de zoom") : upload d'image + aperçu, réutilise
   `correctSection` (réponses acceptées, déjà générique free/zoomguess/
   reveal) et `QTYPE_HINTS`. Mise à jour de `toggleTypeSections()`
   (visibilité de la section + exclusion d'`illustrationSection`, comme
   "image"/"zoomguess"/"reveal") et du save/load de question (`q.image`).
   *Testable seul* : créer une question "Recherche" dans l'éditeur,
   uploader une image, taper une réponse acceptée, sauvegarder, recharger
   le quiz → tout doit persister.

2. **Métadonnées côté jeu** (`index.js`)
   `QUESTION_TYPE_META.recherche` (icône, couleur, hint) + ajout à
   `COMPLEX_TYPES` (mécanique pas évidente au premier coup d'œil, comme
   zoomguess/image/intrus). *Testable seul* : le badge de type + l'intro de
   question affichent "Recherche" correctement (écran de jeu pas encore
   câblé, voir étape 4).

3. **DOM + CSS de la zone de jeu** (`index.html` + `style.css`)
   Nouveau bloc `#rechercheArea` (image + calque `#rechercheOverlay`), même
   gabarit de boîte fixe que `.reveal-img-wrap`/`.illustration-img-wrap.is-
   zoomed` (`object-fit:contain`, cohérence visuelle entre types "image à
   deviner"). CSS du calque : noir opaque, `mask-image`/`-webkit-mask-image`
   radial-gradient sur `--spot-x`/`--spot-y`/rayon constant. Pas encore
   interactif à cette étape (juste le rendu statique, calque plein).

4. **Logique de jeu — upload, affichage, interaction pointeur/tactile**
   (`index.js`)
   - `emitQuestion` : `q.type === 'recherche'` rejoint le groupe upload
     `payload.imageUrl` (comme "image"/"zoomguess", `imageToUpload`).
   - Rendu de question : toggle `#rechercheArea` comme `revealArea`/
     `imageArea`, affectation de `payload.imageUrl`.
   - Écouteurs `pointermove`/`pointerleave` (souris) et `touchmove`/
     `touchend` (tactile) sur la zone, mettant à jour `--spot-x`/`--spot-y`
     en coordonnées normalisées (même technique que `submitImageClick`,
     `getBoundingClientRect`) ; masque revient plein (calque opaque partout)
     dès que le pointeur quitte la zone / le doigt se lève — jamais
     cumulatif (décidé avec l'utilisateur).
   - Réponse : réutilise `answerInput`/`sendBtn` déjà généralisés (tâche
     008, texte "Valider" + layout empilé) — `recherche` rejoint la liste
     des types "texte libre" (exclu d'`isTileType`), et la liste de focus
     auto PC (`payload.type === 'free' || 'zoomguess' || 'pbac' ||
     'reveal'`, à étendre).
   *Testable* : partie de bout en bout côté joueur ET hôte (chacun avec sa
   propre lampe torche), souris sur PC et doigt sur mobile.

5. **Anti-triche serveur** (`server/index.js`)
   Ajouter `'recherche'` à la liste qui retire `correct` de la diffusion
   initiale (`broadcastPayload`, condition avec "zoomguess"/"reveal"/etc.).
   Aucun autre changement serveur : le scoring tombe déjà dans la branche
   générique "réponse texte libre modérée par l'hôte" (`else` final de
   `answer:submit`), utilisée telle quelle par free/zoomguess/reveal/pbac —
   pas de branche dédiée à ajouter.
   *Testable* : ouvrir les devtools réseau côté joueur à l'affichage d'une
   question "Recherche" → `correct` absent du payload `question:show`.

6. **Révélation de la réponse en fin de question** (`index.js`)
   Ajouter `'recherche'` au dispatch `socket.on('question:reveal', ...)`
   (même branche que `'free' || 'zoomguess' || 'reveal'` →
   `revealFreeAnswer`). *Testable* : à la fin du chrono, la bonne réponse
   s'affiche comme pour "free"/"zoomguess".

7. **Passe de polish après premier test réel** (tous fichiers concernés)
   Ajustements visuels (rayon de la lampe torche, feather du dégradé,
   couleur/icône définitives) une fois vu en conditions réelles — pas de
   vérification visuelle possible dans cet environnement (voir Risques).

## Étapes réalisées
- [x] Étape 1 — Éditeur : section de configuration. `<option value="recherche">`
  + `#rechercheSection` (upload image + aperçu, sur le modèle de
  `zoomGuessSection` sans le réglage de zoom) dans `editor.html`. Côté
  `editor.js` : refs DOM, `applyReadOnly`, `QTYPE_ICON`/`QTYPE_COLOR`/
  `QTYPE_HINTS`, `toggleTypeSections()` (affichage section + exclusion
  `illustrationSection` + inclusion `correctSection`), `populateRechercheFields()`,
  upload/suppression d'image, `selectQuestion()`, `qType.onchange`, collage
  d'image (paste), `validateQuestion()` (image + réponse obligatoires,
  comme "zoomguess"). Companion CSS ajouté dans `style.css` (hors liste de
  fichiers du plan mais nécessaire à cette étape) : nouveau token
  `--color-flame` (tous les autres déjà pris par les 13 types existants) +
  `.question-item.type-recherche`/`.question-detail[data-qtype="recherche"]`
  pour que la pastille/bordure de couleur de l'éditeur s'affiche réellement.
- [x] Étape 2 — Métadonnées côté jeu. `QUESTION_TYPE_META.recherche` (icône
  🔦, couleur/rgb identiques au token éditeur `--color-flame`/`#ff6a1a`,
  hint dédié) + ajout à `COMPLEX_TYPES` dans `index.js`. Commentaire
  au-dessus de `QUESTION_TYPE_META` corrigé au passage (comptait encore
  "7 types" dans `COMPLEX_TYPES`, en compte 8 maintenant — retiré plutôt
  que remis à jour, pour ne pas re-dériver au prochain type ajouté).
- [x] Étape 3 — DOM + CSS de la zone de jeu. `#rechercheArea` (image +
  `#rechercheOverlay`) ajouté dans `index.html`, juste après `#revealArea`
  et avant le bloc réponse `#freeText` partagé. CSS dans `style.css` : même
  gabarit de boîte fixe que `.reveal-img-wrap` (cohérence visuelle entre
  types "image à deviner"), calque noir avec `mask-image`/
  `-webkit-mask-image` radial-gradient piloté par `--spot-x`/`--spot-y`/
  `--spot-r` — `--spot-r` par défaut à `0px` (aucun trou, calque plein,
  comme prévu à cette étape) ; l'interactivité (mise à jour de ces
  propriétés au pointer/touch) arrive à l'étape 4.
- [x] Étape 4 — Logique de jeu (upload, affichage, interaction). `emitQuestion`
  (`index.js`) : `recherche` rejoint le groupe upload `payload.imageUrl`
  (comme "image"/"zoomguess"). Rendu de question : toggle `#rechercheArea`
  + `rechercheImg.src`, calque remis plein (`--spot-r: 0px`) à chaque
  nouvelle question. Interaction : **Pointer Events uniquement**
  (`pointerdown`/`pointermove`/`pointerleave`/`pointerup`/`pointercancel`),
  pas d'écouteurs `touch*` séparés — même convention que `wireOrderDrag`,
  le tactile n'ayant de toute façon aucune notion de "survol" sans contact
  (`pointermove` n'y est émis QUE pendant un contact actif, ce qui donne
  déjà le comportement lampe torche voulu). `touch-action:none` ajouté sur
  `.recherche-wrap` (`style.css`) pour empêcher le geste de faire défiler la
  page sur mobile. Réponse : `recherche` ajouté à la liste de focus auto PC
  (`answerInput`/`sendBtn` fonctionnaient déjà sans changement, `recherche`
  n'étant pas dans `isTileType`).

  **Écart découvert en cours de route par rapport au plan** : le trade-off
  "l'hôte a sa propre lampe torche interactive" supposait que la lampe
  torche pourrait suivre le même verrouillage `.answers-locked` que les
  autres types — faux une fois vérifié : `.answers-locked` n'est JAMAIS
  retiré côté hôte (`if (!isHost) { ...inputArea.classList.remove(...) }`
  dans `emitQuestion`), donc l'inclure dans la liste `.answers-locked
  .xxx { pointer-events:none }` aurait bloqué la lampe torche hôte en
  permanence — contredisant le trade-off déjà validé. Résolu en laissant
  `.recherche-wrap` HORS de cette liste de verrouillage (décision documentée
  en commentaire CSS) : la lampe torche (hôte ET joueur) reste explorable
  dès l'affichage de la question, y compris un peu avant `startTs` — effet
  de bord mineur assumé (pure exploration visuelle de l'image, aucun impact
  sur le score : la soumission de réponse reste normalement verrouillée via
  `sendBtn.disabled`/`answerInput.disabled`, inchangés) plutôt que de
  complexifier la choreographie de verrouillage existante pour un cas à
  faible enjeu. Sans lien avec l'anti-triche sur `correct` (étape 5, pas
  encore faite à ce stade).
- [x] Étape 5 — Anti-triche serveur. `'recherche'` ajouté à la liste
  `broadcastPayload` (`server/index.js`, même condition que "zoomguess"/
  "reveal"/etc.) : `q.correct` est désormais retiré de la diffusion
  `question:show` pour ce type — sinon la réponse aurait été lisible en
  devtools dès l'affichage de la question.
- [x] Étape 6 — Révélation en fin de question. `'recherche'` ajouté au
  dispatch `socket.on('question:reveal', ...)` (même branche que
  `'free'/'zoomguess'/'reveal'` → `revealFreeAnswer`). Ajout au-delà du
  strict libellé du plan, mais dans son esprit ("révélation de la
  réponse") : le calque noir est aussi entièrement retiré à ce moment
  (`rechercheOverlay.classList.add('d-none')`) — sans ça, la question se
  serait terminée sans jamais montrer l'image complète au joueur,
  contrairement à zoomguess/reveal qui finissent déjà nets par construction
  (dézoom total / fondu terminé). Reset symétrique ajouté à l'étape 4 revue
  ici : le calque redevient visible (`classList.remove('d-none')`) au
  démarrage de la question SUIVANTE, pour ne pas rester cassé si 2
  questions "recherche" se suivent.

## Checks effectués
- `node --check client/public/js/editor.js` : OK.
- `node --check client/public/js/index.js` : OK.
- `node --check server/index.js` : OK. Démarrage réel (`npm start` dans
  `server/`, quelques secondes) : aucune erreur au boot.
- `node --check client/public/js/index.js` (étape 6) : OK.
- Équilibre des accolades CSS : 1260/1260, OK (inchangé étape 4 : ajout net
  nul de `{}`, juste un déplacement de sélecteur + commentaire).
- Pas de vérification visuelle possible dans cette session (pas de Browser
  pane) — à confirmer par l'utilisateur, en particulier le point ci-dessus
  (torche explorable un peu avant `startTs`) et le rendu tactile réel sur
  téléphone : créer une question "Recherche" dans l'éditeur, uploader une
  image, taper une réponse, sauvegarder,
  recharger ; vérifier que le badge de type + l'intro affichent "Recherche"
  en jeu (l'écran de jeu lui-même n'est pas encore interactif, voir étape 4).

## Tests manuels recommandés
- Créer une question "Recherche" dans l'éditeur (upload image + réponses
  acceptées), sauvegarder, recharger le quiz.
- Vraie partie : hôte + au moins un joueur, dans les deux modes (IRL et à
  distance), sur PC (souris) et sur téléphone (doigt) — vérifier que la
  lampe torche suit bien le pointeur/doigt et se recache dès qu'il
  s'éloigne, que "Valider" fonctionne, que la réponse se révèle en fin de
  question et que la bonne réponse n'est jamais visible en devtools avant
  la fin du chrono.

## Risques restants
- Rayon de la lampe torche fixé arbitrairement (voir Plan, étape 3) — à
  ajuster après un premier test visuel réel, aucune vérification visuelle
  n'étant possible dans cet environnement (pas de navigateur/rendu).
- Support tactile mobile : écouteurs `touchmove`/`touchend` dédiés (pas de
  `:hover` natif ni de `mouseleave` équivalent sur tactile) — à tester sur
  un vrai téléphone.
- `mask-image` : support Safari via le préfixe `-webkit-mask-image` prévu
  au plan, mais jamais testé en pratique dans cette session — navigateur à
  vérifier en priorité si le calque ne se comporte pas comme attendu sur
  iOS.

## Statut
`en review` — étapes 1 à 6 (fonctionnelles) faites. Étape 7 (polish après
premier test réel) en attente d'un retour utilisateur en conditions
réelles.
