# [014] Nouveau type de question "Indice" (💡)

## Contexte
L'utilisateur veut un nouveau type de question où le joueur doit deviner
une réponse (texte libre) à l'aide d'une série de 1 à 4 indices qui
apparaissent progressivement pendant le temps de la question, chaque
indice pouvant être un texte ou une image, à un moment configurable par le
créateur (indépendant du timer global de la question). L'affichage joueur
doit être animé : le nouvel indice prend la place centrale, l'ancien se
range sur le côté en conservant l'historique visible.

## Objectif
Un créateur de quiz peut ajouter une question de type "Indice" avec 1 à 4
indices (texte ou image chacun), chacun avec son propre délai d'apparition
en secondes depuis le début de la question. Côté joueur, la réponse se
saisit en texte libre à tout moment (comparaison avec tolérance, comme le
type "Texte libre" existant), une seule validation possible, non
modifiable après envoi. Les indices apparaissent aux moments configurés
(indépendamment du minuteur global) avec une animation : le nouvel indice
devient l'élément central, les précédents se rangent sur le côté sous une
forme plus discrète mais toujours visible.

## Périmètre
- Nouveau type `indice` dans l'éditeur (`#qType`), avec sa propre section
  de configuration :
  - jusqu'à 4 indices, ajout/suppression/réordonnancement ;
  - chaque indice : soit un champ texte, soit une image (upload, même
    mécanisme que les autres champs média de l'éditeur) — exclusif, pas
    les deux à la fois pour un même indice ;
  - un délai d'apparition en secondes par indice, configurable
    individuellement (le premier indice peut être à 0s = visible dès le
    départ) ;
  - validation à la sauvegarde (bornes, champs non vides, délais
    croissants ou au moins cohérents).
- Réponse : réutilise le moteur de comparaison/tolérance du type "Texte
  libre" (`fuzzy()` côté serveur) — pas de nouvelle logique de scoring
  à inventer, juste s'assurer que "indice" emprunte le même chemin que
  "free" (réponse à tout moment, une seule validation, verrouillée après
  envoi — comportement désormais OBLIGATOIRE pour tous les types depuis le
  retrait du toggle "une seule tentative", pas juste un défaut).
- Les indices continuent d'apparaître même après l'envoi de la réponse par
  CE joueur (le rendu suit le chrono partagé de la salle, pas l'état
  individuel — même logique que le dézoom progressif de "ZoomOut
  Devinette", voir Fichiers concernés).
- Rattrapage à l'affichage (rejoindre/rafraîchir en cours de question) :
  ne pas planifier un `setTimeout` isolé par indice (un indice déjà "en
  retard" au montage ne s'afficherait jamais) — recalculer à chaque tick
  du chrono déjà partagé (dérivé de `startTs`/`timerMs`, comme le fait
  "ZoomOut Devinette") quels indices doivent déjà être visibles.
- Validation éditeur : en plus des délais cohérents/croissants, chaque
  délai doit rester `≤ timerMs` de la question (sinon un indice configuré
  trop tard ne s'affiche jamais).
- Affichage joueur : zone dédiée avec un emplacement central (indice
  actuel) et une bande latérale/historique (indices précédents, réduits),
  avec transition animée à chaque nouvelle apparition. Le timing
  d'apparition des indices se base sur `startTs` de la question (comme le
  minuteur), pas sur le minuteur global lui-même.
- Icône 💡, couleur dédiée, intégration à tous les endroits où les autres
  types sont déjà référencés de façon générique (liste de types,
  normalisation au chargement d'une partie réelle, upload média à la
  sauvegarde, etc. — voir "Fichiers concernés" et le risque de liste
  blanche oubliée documenté plus bas).

## Hors périmètre
- Pas de nouveau mode de scoring (proportionnel, pénalité si mauvaise
  réponse avant le bon indice, etc.) — reprend exactement le
  comportement binaire de "Texte libre".
- Pas de limite du nombre de tentatives configurable par le créateur
  (le toggle correspondant a été retiré du produit, voir tâche
  précédente sur "une seule tentative") — "indice" suit le même défaut
  serveur (`singleAttempt` true) que tous les autres types.
- Pas de son/vidéo comme type d'indice — seulement texte ou image.
- Pas de retouche des types existants ("free", "reveal", "recherche")
  au-delà de ce qui est strictement nécessaire pour brancher "indice" à
  côté d'eux sans les casser.

## Fichiers concernés
- `client/public/editor.html` — nouvelle `<option value="indice">` dans
  `#qType`, nouvelle section `#indiceSection` (liste d'indices,
  texte/image, délai d'apparition).
- `client/public/js/editor.js` — CRUD des indices (ajout/suppression,
  bornes 1-4), validation à la sauvegarde, `QTYPE_ICON`/`QTYPE_COLOR`/
  `QTYPE_HINTS`, câblage dans `toggleTypeSections()`/`qType.onchange`/
  `applyReadOnly`, et surtout **`uploadQuestionMedia`** (upload média à
  la sauvegarde, voir `field(q, 'image')` etc. plus haut dans ce fichier)
  — chaque indice-image doit être ajouté à cette liste, sous peine de
  reproduire le bug de liste blanche déjà vu 4 fois cette session
  (`q.image`, `q.audio`, `q.zones` côté client x2, côté serveur x1 — voir
  tâche 013).
- `client/public/index.html` — nouvelle zone de jeu joueur (`#indiceArea`
  ou équivalent) : emplacement central + bande latérale/historique.
- `client/public/js/index.js` — émission du payload (`hints` avec leur
  délai), **normalisation de chargement de partie réelle** (le `const norm
  = playable.map(...)` inline dans le chargement Supabase, ~ligne 3284 —
  PIÈGE DÉJÀ RENCONTRÉ 3 FOIS, voir tâche 013 : `q.image`, `q.audio`,
  `q.zones`), planification des apparitions d'indices calée sur
  `payload.startTs` en réutilisant le tick du chrono déjà partagé (voir
  pattern `zoomguess`/dézoom progressif, ~ligne 5238, plutôt que des
  `setTimeout` isolés — permet le rattrapage automatique), logique
  d'affichage/anim, branchement dans `submitCurrentAnswer` (réutilise le
  chemin "free", ~ligne 5558) SANS rien faire de spécial (aucune branche
  dédiée nécessaire pour "indice" a priori), le bandeau de révélation
  (`payload.type === 'free' || ...`, ~ligne 6609 — ajouter `'indice'`),
  l'auto-soumission juste avant la fin du chrono
  (`currentQuestionType === 'free' || 'pbac' || 'reveal'`, ~ligne 5288 —
  ajouter `'indice'` pour ne pas perdre une réponse tapée mais jamais
  cliquée) et l'autofocus desktop du champ texte (~ligne 5134, même
  liste de types — cosmétique, mais cohérent avec "free").
- `server/index.js` — l'objet `question` construit à `question:show`
  (liste blanche explicite, PIÈGE DÉJÀ RENCONTRÉ — voir tâche 013) doit
  porter `hints` pour que la réponse serveur (`fuzzy(payload.content,
  q.correct)`) et tout affichage recap fonctionnent ; a priori PAS de
  nouveau bloc `if (q.type === 'indice')` nécessaire pour le scoring
  lui-même (le chemin générique en fin de `answer:submit`, déjà emprunté
  par "free"/"truefalse"/"intrus", doit suffire) — à confirmer en
  explorant le code pendant `/plan-feature`.
- `client/public/css/style.css` — nouvelles classes + animations pour la
  zone d'indices (entrée de l'indice central, transition vers la bande
  latérale).
- `client/public/js/editor.js` — texte du tutoriel éditeur codé en dur
  (~ligne 4254, "15 types disponibles : ...") : PIÈGE DÉJÀ RENCONTRÉ à la
  tâche 013 (déjà faux une fois, "13 types" au lieu de 15) — passer à "16
  types" et ajouter "indice" à l'énumération ; idem pour un commentaire de
  code obsolète (~ligne 674, "13 types et leurs libellés") à mettre à jour
  au passage.
- `docs/agent-tasks/013-question-rangement.md` — référence de pattern
  (type de question ajouté récemment, mêmes pièges déjà rencontrés et
  documentés, à ne pas reproduire une 5e fois).

## Plan

### Modèle de données retenu
```js
// Question :
{
  type: 'indice',
  hints: [
    { text: 'Il vit dans l\'eau', image: null, delayS: 0 },      // texte OU image, jamais les deux
    { text: null, image: 'data:...' /* -> URL Supabase après save */, delayS: 8 },
    { text: 'Il a des moustaches', image: null, delayS: 16 },
    { text: null, image: null, delayS: 24 } // 4e indice optionnel
  ],
  correct: ['Phoque'] // liste de réponses acceptées, EXACTEMENT le même format que "free" (fuzzy() serveur)
}
```
Décision : un seul tableau `hints` (1 à 4 objets `{ text, image, delayS }`), pas deux listes parallèles — plus simple à valider (bornes, délais croissants) et à itérer côté rendu que deux tableaux `hints`/`hintDelays` désynchronisables. `text`/`image` exclusifs : mettre l'un vide quand l'autre est choisi (même logique que `q.image` vs pas d'image pour les autres types, pas de flag `hintType` séparé — un simple `if (hint.image) ... else if (hint.text) ...` suffit à l'usage et évite un champ redondant).

**Trade-off le plus important — protection anti-triche du payload diffusé.** `q.correct` de "free" est actuellement diffusé EN CLAIR dans `question:show` (pas dans la liste d'exclusion de `broadcastPayload`, `server/index.js` ~ligne 1413) : ouvrir les devtools pendant qu'on répond à une question "Texte libre" révèle déjà la réponse. Pour "indice", où tout le principe du type est de deviner PROGRESSIVEMENT à partir d'indices qui apparaissent dans le temps, laisser `correct` en clair dès `question:show` viderait le gameplay de son sens (un joueur ouvre les devtools, lit la réponse avant même le 1er indice). **Contrairement à "free", `'indice'` DOIT donc être ajouté à la liste d'exclusion de `broadcastPayload`** (même traitement que `zoomguess`/`recherche`/`reveal`, qui devinent aussi progressivement) — `q.correct` reste dispo côté serveur pour `fuzzy()` (reconstruit indépendamment dans l'objet `question`, ligne ~1396, jamais concerné par ce filtre) mais ne part plus vers les clients avant la révélation. C'est un vrai écart volontaire par rapport à "free" à faire valider explicitement (pas juste "copier free").

**Confirmation (contredit une hypothèse du fichier de tâche) : le `hints` du payload N'A PAS besoin d'être ajouté à l'objet `question` reconstruit côté serveur (`server/index.js` ~ligne 1396).** Ce tableau n'est utilisé QUE pour l'affichage/timing côté client (jamais lu par `fuzzy()` ni par `answer:submit`/`revealQuestion`) ; il transite déjà automatiquement de `payload` vers `question.showPayload` via le spread `payloadWithoutCorrectOrExplanation` (comme n'importe quel champ non explicitement retiré) — contrairement à `q.zones` (tâche 013) qui, lui, est relu côté serveur dans `answer:submit` pour le récap (`zoneLabel()`), d'où son besoin réel d'être sur l'objet `question`. Seule la liste `broadcastPayload` (exclusion de `correct`, voir trade-off ci-dessus) est à toucher côté serveur pour ce type — pas la reconstruction de `question`. À vérifier une dernière fois en implémentant l'étape 7, mais ça change le périmètre serveur annoncé dans "Fichiers concernés" (plus léger que prévu).

**Couleur dédiée : aucun token CSS existant n'est libre.** Les 15 types actuels ont déjà consommé TOUS les tokens `--tile-*`/`--color-cyan/teal/violet/indigo/lime/flame/sky/amber/accent-2` disponibles (vérifié dans `QTYPE_COLOR`, `client/public/js/editor.js` ~ligne 621, et dans `style.css`). **DÉCIDÉ (validé par l'utilisateur) : nouveau token `--color-gold: #f2c94c`**, ajouté dans les DEUX blocs `:root` clair/sombre existants de `style.css` (pas une nouvelle feuille — reste dans les clous du CLAUDE.md).

**Anti-triche : DÉCIDÉ (validé par l'utilisateur).** `'indice'` est ajouté à la liste d'exclusion `broadcastPayload` (comme `zoomguess`/`recherche`/`reveal`) — `q.correct` ne part JAMAIS en clair vers les clients avant la révélation, contrairement à "free" qui reste inchangé (hors périmètre de cette tâche).

**Aucune zone interdite du `CLAUDE.md` touchée par défaut** : pas de migration `supabase/schema.sql` (`questions` déjà `jsonb`), pas de `render.yaml`, pas de nouvelle dépendance npm, pas de nouveau fichier CSS (le nouveau token reste dans `style.css` existant). Rien à valider de ce côté avant `/implement-step` — seul le choix de couleur ci-dessus a besoin d'un "go" simple (pas une interdiction du CLAUDE.md, juste une préférence visuelle).

---

1. **Constantes + validation éditeur** (`client/public/js/editor.js`)
   - `INDICE_MIN_HINTS = 1`, `INDICE_MAX_HINTS = 4`.
   - `isValidIndiceHints(hints, timerMs)` : chaque indice a EXACTEMENT un contenu (texte non vide OU image, jamais aucun, jamais les deux), un `delayS` numérique ≥ 0, délais croissants (ou au moins non décroissants — à trancher à l'implémentation selon ce qui reste le plus simple à éditer sans frustrer un réordonnancement), et `delayS * 1000 ≤ q.timerMs` (sinon un indice ne s'affiche jamais — règle explicite du Périmètre).
   - `QTYPE_ICON.indice = '💡'`, `QTYPE_COLOR.indice = 'var(--color-gold)'` (ou le token retenu), `QTYPE_HINTS.indice = { icon: '💡', text: '...', color: '#f2c94c', rgb: '...' }`.
   - Nouvelle option `<option value="indice">💡 Indice</option>` dans `#qType` (fait ici en JS n'a pas de sens — reporté à l'étape 2, `editor.html`).

2. **`editor.html`** — nouvelle section détail, sur le modèle de `#intrusSection` (liste d'items) mais chaque ligne a un sélecteur texte/image et un champ délai en plus :
   ```html
   <div id="indiceSection" class="detail-section d-none">
     <label>Indices (1 à 4), chacun avec son délai d'apparition</label>
     <div id="indiceList" class="options-editor"><!-- Rempli par JS --></div>
     <button id="addIndiceBtn" class="btn btn-nav-secondary mt-8">+ Ajouter un indice</button>
     <p class="text-muted font-13 mt-8">Chaque indice est un texte OU une image, avec un délai en secondes depuis le début de la question (0s = visible dès le départ).</p>
   </div>
   ```
   + `<option value="indice">💡 Indice</option>` dans `#qType`.
   - `correctSection` (réponses acceptées, réutilisé tel quel) reste géré à l'étape 3 (`toggleTypeSections`), pas ici — ce fichier ne fait que le markup pur, `d-none` par défaut.

3. **`editor.js` — logique de la section** (le plus gros morceau du plan éditeur) :
   - `renderIndiceHints()` : une ligne par indice — bouton bascule texte/image (vide l'autre champ au changement, cohérent avec la contrainte d'exclusivité), `<input type="text">` OU zone d'upload+aperçu (même mécanisme que les autres champs média de l'éditeur, ex. `enigmeImage`), `<input type="number">` pour `delayS`, bouton supprimer (désactivé si `hints.length <= INDICE_MIN_HINTS`).
   - Pas de glisser-réordonner ici contrairement à "rangement"/"timeline" : l'ORDRE d'apparition est entièrement dérivé des `delayS`, pas d'un ordre de liste à maintenir séparément — un simple tri visuel par délai croissant suffit, évite un champ d'ordre redondant en plus du délai (moins de code qu'un `wireXDrag`).
   - Branchement : `toggleTypeSections()` (afficher/masquer `#indiceSection`), `qType.onchange` (initialiser `q.hints = []` si vide au passage vers "indice", nettoyer/laisser tel quel au sens contraire comme les autres types), `applyReadOnly` (désactiver tous les inputs/boutons de la section), `correctSection` — ajouter `qType.value !== 'indice'` dans la condition ligne ~1857 pour que la liste "Réponses acceptées" apparaisse aussi pour "indice" (réutilisation directe, pas de nouveau champ), et la validation de sauvegarde (`saveQuizBtn.onclick`, même bloc que les vérifs `INTRUS_MIN/MAX` ~ligne 3915) : bornes du nombre d'indices, `isValidIndiceHints`, et qu'au moins une réponse acceptée est renseignée (`q.correct`, comme "free").
   - `illustrationSection` : ajouter `qType.value === 'indice'` à la liste d'exclusion (~ligne 1845) — "indice" a déjà sa propre notion d'image (par indice), une illustration générique en plus créerait une confusion entre deux zones d'image différentes pour le même type.

4. **`editor.js` — `uploadQuestionMedia`** (~ligne 4020) : ajouter le cas indice, sur le modèle du bloc "intrus" juste en dessous :
   ```js
   if (q.type === 'indice' && Array.isArray(q.hints)) {
     q.hints.forEach(h => field(h, 'image'))
   }
   ```
   Étape isolée du reste par prudence — c'est PILE le piège de liste blanche oubliée documenté 4 fois dans "Fichiers concernés" ; autant la traiter comme un diff à part, facile à vérifier seule.

5. **`client/public/index.html`** — nouvelle zone de jeu, sur le modèle de `#rangementArea`/`#timelineArea` :
   ```html
   <div id="indiceArea" class="indice-area d-none">
     <div id="indiceCentral" class="indice-central"></div>
     <div id="indiceHistory" class="indice-history"></div>
   </div>
   ```
   Markup pur, `d-none` par défaut, pas encore alimenté (étapes suivantes).

6. **`index.js` (hôte, émission du payload)** — dans le même bloc que `timelineItems`/`zones` (~ligne 4609) :
   ```js
   // "indice" : hints publics dès le départ dans leur INTÉGRALITÉ (texte/image/
   // délai) — contrairement à timeline/rangement, il n'y a rien à cacher DANS
   // ce tableau lui-même (le contenu d'un indice n'est pas la réponse), seule
   // q.correct doit rester secrète (voir server/index.js, exclusion broadcastPayload).
   hints: q.type === 'indice' ? (q.hints || []).map(h => ({ text: h.text || null, image: h.image || null, delayS: Math.max(0, Number(h.delayS) || 0) })) : undefined,
   ```
   Pas de mélange/anonymisation nécessaire (contrairement à `timelineItems`/`rangementItems`) : les indices n'ont pas d'ordre à cacher, `delayS` détermine déjà tout.

7. **`server/index.js`** :
   - Ajouter `'indice'` à la liste des types exclus de `broadcastPayload` (~ligne 1413) — voir trade-off ci-dessus, LE changement volontaire par rapport à "free".
   - **Pas d'autre changement serveur attendu** (voir "Confirmation" ci-dessus) : `fuzzy(payload.content, q.correct)` fonctionne déjà tel quel pour "indice" via le chemin générique de fin d'`answer:submit` (même chemin que "free"), `q.correct` étant déjà universellement porté par l'objet `question` reconstruit (ligne 1396, pas de champ spécifique à ajouter). `revealQuestion` n'a besoin d'aucun cas particulier non plus (`question.correct` part tel quel, comme "free"). À CONFIRMER en implémentant cette étape (relire `answer:submit` en entier une dernière fois avant de conclure qu'aucune branche `if (q.type === 'indice')` n'est nécessaire) — si un besoin imprévu apparaît, il faudra le signaler avant de continuer.

8. **`index.js` (joueur, affichage/animation/branchements)** — le plus gros morceau du plan joueur :
   - `indiceState = { shown: [] }` (indices déjà affichés, par index) — pas besoin de plus, contrairement à `associationState`/`rangementState` (pas d'interaction du joueur avec les indices eux-mêmes, ils sont purement passifs).
   - `buildIndiceArea(hints)` : prépare `#indiceCentral`/`#indiceHistory` vides, stocke `hints` trié par `delayS` croissant dans une variable de module (comme `payload.timelineItems` l'est implicitement via closure) pour que le tick du chrono (voir ci-dessous) puisse le relire à chaque intervalle.
   - **Apparition pilotée par le tick du chrono déjà partagé** (`timerInt`, ~ligne 5224, même bloc que le dézoom `zoomguess`/`reveal` ~ligne 5238-5255) — PAS de `setTimeout` par indice (piège explicitement signalé dans le Périmètre : un late-joiner ne rattraperait jamais un indice déjà passé). À chaque tick : calculer `elapsed = now - start`, parcourir les indices triés, afficher ceux dont `delayS * 1000 <= elapsed` et pas encore dans `indiceState.shown` — l'ancien indice central (s'il y en a un) bascule dans `#indiceHistory` (classe réduite), le nouveau devient central avec l'animation d'entrée. Résultat : un late-joiner/refresh recalcule immédiatement l'état correct au premier tick après montage, sans jamais "rater" un indice (même garantie que le dézoom zoomguess).
   - Branchements génériques (mêmes points de couture que "free", le type NE rentre dans AUCUNE liste "tuile"/verrouillage spécifique) :
     - Toggle `d-none` de `#indiceArea` sur `payload.type === 'indice'` (bloc ~ligne 4963-4983, à côté de `rechercheArea`).
     - `buildIndiceArea(payload.hints)` appelé dans le même bloc que `buildRangementArea`/`buildTimelineList` (~ligne 5150-5158).
     - `answerInput` reste visible pour "indice" (PAS dans `isTileType`, ~ligne 5119) — texte libre classique, chemin `else { content = answerInput.value.trim() }` de `submitCurrentAnswer` (~ligne 5558) suffit déjà, aucune branche dédiée.
     - Auto-soumission juste avant la fin du chrono (~ligne 5288) : ajouter `'indice'` à la condition `currentQuestionType === 'free' || 'pbac' || 'reveal'`.
     - Autofocus desktop du champ texte (~ligne 5134) : ajouter `'indice'`.
     - Bandeau de révélation (~ligne 6609) : ajouter `'indice'` à `payload.type === 'free' || 'zoomguess' || 'reveal' || 'recherche'`.
     - **PAS d'ajout à la liste `is-locked`** (~ligne 5102/5592, `[gradSlider, orderList, ...]`) : contrairement aux zones interactives des autres types, `#indiceArea` n'a rien à griser après envoi — les indices continuent d'apparaître pour tout le monde indépendamment de l'état individuel (règle explicite du Périmètre). Seul `answerInput` se verrouille (déjà couvert génériquement).
     - `QUESTION_TYPE_META.indice` (icône/couleur/hint) + `COMPLEX_TYPES` (~ligne 332) : à ajouter, mécanique nouvelle qui mérite l'intro longue comme "rangement"/"zoomguess".
     - Reset entre questions : `indiceState = { shown: [] }` réinitialisé au même endroit que `myRangementSubmission = null` etc. (~ligne 5175), `#indiceArea` vidée avant reconstruction dans `buildIndiceArea`.

9. **`client/public/css/style.css`** :
   - Nouveau token couleur (`--color-gold` ou équivalent retenu à l'étape 1, dans les DEUX blocs `:root` clair/sombre).
   - `.indice-area`, `.indice-central` (grande carte, texte OU image), `.indice-history` (bande latérale, indices réduits — miniature/texte tronqué), transition d'entrée du nouvel indice central + transition de "rétrécissement" vers l'historique (l'animation demandée dans le Périmètre — `@keyframes` dédiées, cohérentes avec `applyTileReveal`/le style d'entrée déjà en place pour les autres tuiles plutôt qu'un système entièrement neuf).
   - Mirroir `.question-item.type-indice { --qt-color: var(--color-gold); }` (~ligne 4597, bloc des types).
   - Texte du tutoriel éditeur (`editor.js` ~ligne 4254, "15 types" → "16 types", ajouter "indice" à l'énumération) + commentaire obsolète ~ligne 674 ("13 types" → "16 types", déjà faux avant cette tâche comme relevé dans la tâche 013 — profiter du passage pour corriger).

10. **Vérification** : `node --check` sur les 3 fichiers JS touchés (`editor.js`, `index.js` client, `server/index.js`), équilibre des balises `<div>` de `editor.html`/`index.html`, équilibre CSS (accolades), démarrage `npm start`, puis test manuel en Browser pane — créer une question "Indice" dans l'éditeur (2-3 indices texte + 1 image, délais croissants), lancer une partie test, jouer côté joueur (vérifier l'apparition aux bons moments, l'animation central/historique, l'auto-soumission, la révélation), et un test de "rattrapage" (rafraîchir la page joueur en cours de question, vérifier que les indices déjà passés apparaissent immédiatement sans attendre leur délai).

## Étapes réalisées
- [x] **Étape 1 — Constantes + validation éditeur** (`client/public/js/editor.js`)
  - `INDICE_MIN_HINTS = 1`, `INDICE_MAX_HINTS = 4` ajoutés juste après le
    bloc `INTRUS_MIN/MAX_OPTIONS` (~ligne 256), avec un commentaire
    précisant que le DOM `#indiceSection` n'existe pas encore (reporté à
    l'étape 2).
  - `isValidIndiceHints(hints, timerMs)` ajoutée juste après : borne le
    nombre d'indices (1-4), vérifie l'exclusivité texte/image (XOR via
    `hasText === hasImage`), `delayS` numérique ≥ 0, délais **non
    décroissants** (pas strictement croissants — décision pour rester
    simple à éditer sans frustrer un réordonnancement futur, comme évoqué
    dans le Plan), et `delayS * 1000 <= timerMs`.
  - `QTYPE_ICON.indice = '💡'` ajouté à l'objet existant.
  - `QTYPE_COLOR.indice = 'var(--color-gold)'` ajouté (token pas encore
    défini dans `style.css` à ce stade — étape 9 du plan — mais la
    référence JS est déjà en place).
  - `QTYPE_HINTS.indice = { icon: '💡', text: '...', color: '#f2c94c', rgb: '242,201,76' }`
    ajouté (texte d'aperçu de mécanique, sur le modèle des autres entrées).
  - **Pas** d'`<option value="indice">` ajoutée dans `editor.html`
    (reporté explicitement à l'étape 2, comme prévu par le Plan) — à ce
    stade "indice" n'apparaît donc encore nulle part dans l'UI.

- [x] **Étape 2 — `editor.html`** (`client/public/editor.html`)
  - `<option value="indice">💡 Indice</option>` ajoutée dans `#qType`, juste
    après `rangement`.
  - Nouvelle section `#indiceSection` (markup pur, `d-none` par défaut) sur
    le modèle demandé : `#indiceList`, `#addIndiceBtn`, texte d'aide —
    insérée juste avant `#imageSection`.
- [x] **Étape 3 — `editor.js`, logique de la section indice**
  - DOM refs `indiceSection`/`indiceList`/`addIndiceBtn` ajoutées juste
    après `isValidIndiceHints` (étape 1).
  - `renderIndiceHints()` : une ligne par indice (triées visuellement par
    `delayS` croissant, pas d'ordre de liste séparé — comme prévu par le
    Plan), bascule texte/image (le mode se déduit de `hint.image`, pas de
    flag `hintType` séparé — passer en image vide le texte et ouvre
    directement le sélecteur de fichier via `compressImageFile`, revenir en
    texte vide l'image), champ délai (`<input type="number">`), bouton
    supprimer désactivé si `hints.length <= INDICE_MIN_HINTS`.
  - `addIndiceBtn.onclick` : ajoute un indice vide (délai par défaut =
    dernier délai + 5s, borné au timer de la question), refuse au-delà de
    `INDICE_MAX_HINTS`.
  - Branchements : `toggleTypeSections()` (affichage `#indiceSection`),
    exclusion de `illustrationSection` pour `qType.value === 'indice'`
    (déjà sa propre notion d'image par indice), inclusion dans
    `correctSection` (réutilise "Réponses acceptées" comme "free"),
    `qType.onchange` (init `q.hints = [{text:'', image:null, delayS:0}]` si
    pas déjà valide, `q.correct = ['']` sinon existant), `renderIndiceHints()`
    ajoutée aux 3 listes d'appel (`selectQuestion`, fin de `qType.onchange`,
    `deleteQuestionAt`/navigation), `applyReadOnly` (ajout de
    `addIndiceBtn`), validation à la sauvegarde (bloc `isValidIndiceHints`
    à côté du bloc "intrus", et extension du check "au moins une réponse
    acceptée" existant de `free` à `free || indice`).
  - Textes tutoriel : "15 types" → "16 types" (+ "indice" dans
    l'énumération) et commentaire "13 types" → "16 types" (déjà faux avant
    cette tâche, comme relevé dans la tâche 013).
- [x] **Étape 4 — `uploadQuestionMedia`** (`client/public/js/editor.js`)
  - Bloc dédié ajouté juste après le bloc "intrus" existant :
    `if (q.type === 'indice' && Array.isArray(q.hints)) { q.hints.forEach(h => field(h, 'image')) }`
    — traité isolément par prudence (piège de liste blanche oubliée
    documenté 4 fois).
- [x] **Étape 5 — `client/public/index.html`, zone de jeu joueur**
  - `#indiceArea` (`d-none` par défaut) ajoutée juste après `#rechercheArea`
    et avant `#freeText` (réutilisé tel quel pour la saisie, comme "free") :
    `#indiceCentral` (indice courant) + `#indiceHistory` (bande des
    précédents). Markup pur, pas encore alimenté (étape 8).
- [x] **Étape 6 — `index.js` (hôte), émission du payload**
  - `hints` ajouté au même objet payload que `timelineItems`/`zones`/
    `rangementItems` : `q.type === 'indice' ? (q.hints || []).map(h => ({ text: h.text || null, image: h.image || null, delayS: ... })) : undefined`.
    Diffusé en intégralité (rien à cacher dans le tableau lui-même, seule
    `q.correct` doit rester secrète — voir étape 7).
- [x] **Étape 7 — `server/index.js`**
  - `'indice'` ajouté à la liste d'exclusion de `broadcastPayload`
    (~ligne 1419) — LE changement volontaire par rapport à "free" (anti-
    triche décidé dans le fichier de tâche), `q.correct` ne part plus en
    clair avant révélation.
  - Confirmé en relisant le code (pas de changement) : l'objet `question`
    reconstruit (~ligne 1396) n'a pas besoin de `hints` (jamais relu côté
    serveur, transite déjà via le spread `payloadWithoutCorrectOrExplanation`
    → `question.showPayload`). `answer:submit` route "indice" vers le même
    chemin générique `fuzzy(payload?.content, q.correct)` (ligne ~2017) que
    "free"/"zoomguess"/"recherche" (aucun des `if (q.type === ...)` qui
    précèdent ce chemin générique ne mentionne "indice" — confirmé en
    listant tous les `q.type ===` du fichier). `revealQuestion` n'a besoin
    d'aucun cas particulier non plus : `question.correct` part tel quel,
    comme pour "free".

- [x] **Étape 8 — `index.js` (joueur), affichage/animation/branchements**
  - `QUESTION_TYPE_META.indice` (icône/couleur/hint) et `COMPLEX_TYPES`
    (ajout de `'indice'`) ajoutés.
  - `indiceArea`/`indiceCentral`/`indiceHistory` (DOM refs) ajoutés.
  - `indiceHints` (hints triés, variable de module) + `indiceState = { shown: [] }`,
    `buildIndiceArea(hints)` (prépare/trie/reset), `buildIndiceCardContent(hint)`
    (texte OU image), `updateIndiceArea(elapsedMs)` (fait apparaître les
    indices dus, bascule l'ancien central vers l'historique, pas de
    `setTimeout` par indice).
  - Branchements : toggle `d-none` de `#indiceArea` sur `payload.type === 'indice'`
    (à côté de `#blindtestArea`), `buildIndiceArea(payload.hints)` appelé
    dans le même bloc que `buildRangementArea`, `updateIndiceArea(now - start)`
    appelé à chaque tick de `timerInt` (juste après le bloc de révélation
    progressive "reveal", même endroit que le dézoom `zoomguess`), reset
    `indiceState = { shown: [] }` au même endroit que
    `myRangementSubmission = null`, auto-soumission (`currentQuestionType === 'indice'`
    ajouté à la condition free/pbac/reveal), autofocus desktop du champ
    texte (`payload.type === 'indice'` ajouté), bandeau de révélation
    (`payload.type === 'indice'` ajouté à la condition
    free/zoomguess/reveal/recherche, réutilise `revealFreeAnswer`).
  - Confirmé (aucune modif nécessaire) : `answerInput` n'est PAS dans
    `isTileType` (~ligne 5138, liste inchangée) donc reste visible pour
    "indice" ; `submitCurrentAnswer` route "indice" vers le `else { content = answerInput.value.trim() }`
    générique (aucune branche dédiée) ; la liste `is-locked`
    (`[gradSlider, orderList, associationArea, timelineList, imageWrap, blindtestFields, rangementArea]`)
    ne porte PAS `indiceArea`, comme prévu par le Plan (les indices
    continuent d'apparaître pour tout le monde après envoi, rien à griser).
  - **Piège de liste blanche oubliée (5e fois)** : `hints: Array.isArray(q.hints) ? q.hints : []`
    ajouté à l'objet `norm` de `loadQuizById` (~ligne 3359, chargement
    d'une VRAIE partie depuis Supabase) — sans ce champ, "indice" aurait
    perdu silencieusement tous ses indices à ce chargement précis, exactement
    le même piège que `q.image`/`q.audio`/`q.zones` déjà rencontré 4 fois
    (voir tâche 013).

- [x] **Étape 9 — `client/public/css/style.css`**
  - `--color-gold: #f2c94c` (+ `--color-gold-rgb`) ajouté dans les DEUX
    blocs `:root` clair/sombre existants (décision validée).
  - `.indice-area`/`.indice-central`/`.indice-central-card`/`.indice-history`/
    `.indice-history-card`/`.indice-card-text`/`.indice-card-img` ajoutés
    (zone de jeu joueur) — `.indice-enter` réutilise `@keyframes tileRevealIn`
    existante pour l'entrée de la carte centrale (pas de système entièrement
    neuf), le passage central → historique est une simple transition CSS sur
    les propriétés qui changent entre les deux classes (largeur/hauteur/
    opacité/padding).
  - `.indice-edit-row`/`.indice-thumb` ajoutés (ligne d'édition éditeur, sur
    le modèle de `.intrus-photo-thumb`).
  - Mirroir `.question-item.type-indice`/`.question-detail[data-qtype="indice"]`
    (`--qt-color: var(--color-gold)`) ajoutés à côté de "recherche".
  - Textes tutoriel/commentaire "15/13 types" déjà corrigés à l'étape 3.

## Checks effectués
- [x] `node --check client/public/js/editor.js` → OK (étape 1)
- [x] `node --check client/public/js/editor.js` → OK (étapes 2-4, après
      ajout de la logique complète de la section indice)
- [x] `node --check client/public/js/index.js` → OK (étape 6)
- [x] `node --check server/index.js` → OK (étape 7)
- [x] `node --check client/public/js/index.js` → OK (étape 8, après ajout de
      la logique d'affichage/animation complète côté joueur)
- [x] Équilibre des balises `<div>` de `editor.html`/`index.html` (comptage
      programmatique open/close, identiques) — étape 10
- [x] Équilibre CSS (accolades, comptage programmatique, profondeur finale à
      0) — étape 10
- [x] `npm start` (`server/index.js`) démarre sans erreur, port 3000 répond
      200 — étape 10
- [x] Vérification statique du HTML servi (`curl` sur `editor.html`/
      `index.html` réellement servis par le serveur tournant, pas juste les
      fichiers sources) : `<option value="indice">`, `#indiceSection`,
      `#addIndiceBtn`, `#indiceArea`, `#indiceCentral`, `#indiceHistory`
      tous présents et bien formés dans le HTML livré.
- [ ] **Vérification visuelle interactive Browser pane — NON FAITE.**
      `/editor.html` (et toute page nécessitant une session) redirige vers
      l'écran de connexion (`Connexion - QuEazy`, voir capture texte) : je
      n'ai ni compte ni identifiants pour m'authentifier, et je n'en crée pas
      moi-même (hors périmètre que je m'autorise). Impossible d'aller plus
      loin qu'une inspection statique du HTML servi — voir "Tests manuels
      recommandés" ci-dessous pour ce qu'il reste à vérifier à la main.

## Révision de l'animation (retour utilisateur post-implémentation)
Après un premier test réel, retour utilisateur : l'animation de révélation
des indices méritait d'être revue. Exploration via canvas de design
(3 directions proposées : trajectoire retracée/FLIP, pile de cartes en
éventail, éclat + journal vertical), affinée à plusieurs reprises avec
l'utilisateur jusqu'à une direction finale validée, puis implémentée
directement dans le code réel (`client/public/css/style.css`,
`client/public/js/index.js`) :
- **Entrée du nouvel indice central** : remplace l'ancien fade+scale
  (`tileRevealIn`) par un retournement 3D (`@keyframes indiceFlipIn`,
  `perspective` sur `.indice-central`) + un reflet qui balaie la carte
  (`::after` + `@keyframes indiceSweep`).
- **Passage vers l'historique** : remplace l'ancienne transition "sur place"
  (largeur/hauteur qui changent sans déplacement perceptible) par un vrai
  FLIP (First/Last/Invert/Play) — `flipIndiceCardToHistory(el)` côté
  `index.js` : la carte VOLE de sa position centrale jusqu'à son carré dans
  `.indice-history` en rétrécissant tout du long.
- [x] `node --check client/public/js/index.js` → OK (après ajout de
      `flipIndiceCardToHistory`)
- [x] Équilibre CSS (accolades, comptage programmatique) → OK
- [x] Vérification en Browser pane (DOM réel, mesures `getBoundingClientRect`
      plutôt que capture d'écran — indisponible dans ce sandbox) : animation
      `indiceFlipIn` bien appliquée à la carte entrante, `perspective: 1200px`
      confirmée sur `.indice-central`, transform FLIP calculée cohérente
      (delta position + échelle correspondant à la vraie différence de
      taille/position entre carte centrale et carré d'historique),
      `transition: transform, opacity` confirmée sur `.indice-history-card`.

## Tests manuels recommandés
Aucune vérification interactive en Browser pane n'a pu être faite (pas
d'identifiants pour se connecter, voir "Checks effectués" étape 10) — tout
ce qui suit reste à faire à la main avant de pousser, dans l'ordre suggéré
par le Plan (étape 10) :
1. **Éditeur** : créer une question "Indice" (💡), vérifier que
   `#indiceSection` s'affiche bien (et QUE elle, pas l'illustration
   générique), ajouter 2-3 indices texte + 1 image avec des délais
   croissants (ex. 0s, 8s, 16s, 24s), vérifier le bouton bascule
   texte/image (vide bien l'autre champ), le bouton supprimer désactivé
   sous 1 indice, le bouton "+ Ajouter" désactivé/toast au-delà de 4.
   Vérifier que la liste "Réponses acceptées" apparaît bien pour ce type
   (reprise de "free").
2. **Validation à la sauvegarde** : tenter de sauvegarder avec un délai
   `> timerMs`, avec un indice ni texte ni image, avec aucune réponse
   acceptée renseignée — vérifier les 3 messages d'erreur dédiés
   (`isValidIndiceHints` / bloc "au moins une réponse acceptée").
3. **Lecture seule / dupliquer un quiz public** : vérifier que la section
   indice s'affiche bien en lecture seule (inputs désactivés, pas de
   bouton "+").
4. **Partie test réelle** (via Supabase, PAS le mode "test rapide" en
   mémoire si celui-ci existe et saute le chargement réel — vérifier que
   c'est bien le chemin `loadQuizById` qui est emprunté, seul concerné par
   le correctif de liste blanche de l'étape 8) : lancer une partie,
   rejoindre côté joueur, vérifier que les indices apparaissent aux bons
   moments (delayS respecté), l'animation (nouvel indice au centre, ancien
   qui se range dans l'historique en réduit — ressenti visuel NON vérifié
   par l'agent, seul le CSS a été écrit et relu, jamais vu s'exécuter).
5. **Auto-soumission** : taper une réponse sans cliquer "Valider", laisser
   le chrono filer jusqu'à la fin — vérifier l'envoi automatique juste
   avant `remaining <= 0`.
6. **Révélation** : vérifier le bandeau "Bonne/Mauvaise réponse" et
   l'affichage de la bonne réponse à la fin du chrono.
7. **Rattrapage (le plus important)** : en cours de question "Indice",
   rafraîchir la page joueur (ou rejoindre en retard) APRÈS que 1-2 indices
   soient déjà passés — vérifier qu'ils apparaissent immédiatement au
   montage (pas seulement à leur délai d'origine), sans doublon ni indice
   manquant. C'est le comportement central demandé par le Périmètre et
   celui pour lequel une régression serait la plus facile à ne pas
   remarquer visuellement.
8. **Anti-triche** : ouvrir les devtools (onglet Réseau/WS) pendant une
   question "Indice" AVANT le 1er indice, vérifier que la trame
   `question:show` ne contient PAS `correct` (contrairement à "free", qui
   lui l'expose toujours — écart volontaire, voir trade-off du fichier de
   tâche).
9. **Couleur/icône** : vérifier visuellement `--color-gold` (#f2c94c) dans
   les DEUX thèmes clair/sombre — pastille sidebar éditeur, bordure carte
   indice joueur, badge de type en jeu — jamais rendu à l'écran par
   l'agent.
10. Fichiers vérifiés seulement statiquement (comptage de balises/accolades,
    `node --check`, HTML brut servi par `curl`) : aucune capture d'écran
    n'a confirmé le rendu visuel réel de `#indiceArea`/`#indiceCentral`/
    `#indiceHistory` ni de la section éditeur.

## Risques restants
- Liste blanche oubliée (voir "Fichiers concernés") — piège déjà rencontré
  4 fois sur des champs spécifiques à un type de question ; traité
  explicitement à l'étape 4 (`uploadQuestionMedia`) et à l'étape 8
  (`norm` de `loadQuizById`, 5e occurrence du même piège) — mais seule une
  vraie partie chargée depuis Supabase (pas un test purement local) peut
  confirmer qu'aucun autre chemin de chargement n'a été oublié.
- Timing des indices basé sur `startTs`/tick partagé (pas de `setTimeout`
  par indice) : la logique de rattrapage (`updateIndiceArea`) n'a jamais
  été exécutée dans un vrai navigateur par l'agent — seule la relecture du
  code garantit qu'elle recalcule bien l'état correct à chaque tick. À
  vérifier en priorité (voir "Tests manuels recommandés" #7).
- **Relais média non couvert (hors périmètre du Plan tel qu'écrit) :**
  contrairement à "intrus" (`uploadRoomIntrusImages`) ou à l'illustration
  générique (`uploadRoomImage`), les images d'indices transitent
  actuellement TELLES QUELLES dans le payload `question:show` (voir
  `hints: ... image: h.image || null` ajouté à l'étape 6) — pas de relais
  HTTP dédié. Pour un quiz déjà sauvegardé (image migrée en URL Supabase
  Storage via `uploadQuestionMedia`, étape 4), c'est sans risque (juste une
  URL, comme `q.image`/`q.illustration` une fois migrés). Mais un très
  vieux quiz jamais resauvegardé, ou un scénario où l'upload Supabase
  échoue silencieusement (voir `uploadMediaField`, repli sur le base64
  d'origine), enverrait un indice-image en base64 BRUT dans la frame
  WebSocket — même famille de risque que celui déjà résolu pour "intrus"
  (frame trop grosse), non traité ici car absent du Plan validé (10
  étapes, aucune ne prévoit de nouvel endpoint `/api/room-indice-images`).
  À surveiller si un joueur ne voit jamais apparaître un indice-image en
  partie réelle.
- Ressenti/qualité visuelle de l'animation (entrée de la carte centrale,
  transition vers l'historique réduit) : écrite par analogie avec
  `tileRevealIn`/les transitions CSS existantes, jamais vue s'exécuter par
  l'agent (pas d'accès Browser pane authentifié) — probable besoin
  d'ajustements de timing/tailles après un premier regard humain.

## Statut
`en review`
