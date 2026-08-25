# [013] Nouveau type de question "Rangement"

## Contexte
La question "timeline" (frise chronologique) est aujourd'hui un copié-collé
du gameplay "order" (remettre dans l'ordre) : le joueur glisse des cartes
dans une liste verticale, seul le contenu (titre + description au lieu d'un
simple texte) change. L'utilisateur veut un gameplay vraiment différent.

Plusieurs pistes ont été proposées et maquettées dans un canvas de design
(https://claude.ai/code/artifact/11317506-6a5d-4cf9-9267-24bcd30357f7,
6 artboards). L'utilisateur a choisi l'artboard **"Zones / époques"** et l'a
baptisé **"Rangement"** : au lieu de remettre les cartes dans un ordre
précis, le joueur les glisse dans des ZONES/périodes nommées par le
créateur du quiz (ex. "Avant 1900", "1900-1950", "1950-2000", "Après 2000"
— ou tout autre découpage à sa convenance, y compris pour trier des
"amis"/personnes plutôt que des événements). Moins exigeant qu'une date
précise, plus proche d'un tri par catégorie que d'un classement.

## Objectif
Un nouveau type de question "Rangement" jouable de bout en bout :
création dans l'éditeur (définir les zones + assigner chaque carte à une
zone), affichage et interaction côté joueur (glisser les cartes dans les
zones), scoring et révélation côté serveur/hôte — au même niveau de
finition que les types de question existants (timeline, association...).

## Périmètre
- Nouveau `type: 'rangement'` dans le modèle de question.
- Éditeur : définir une liste de zones (nom + ordre, création/suppression/
  réordonnancement), puis une liste de cartes (texte, éventuellement une
  image comme "intrus"/"association" — à trancher au moment du plan),
  chacune assignée à une des zones définies.
- Jeu (joueur) : affichage des zones en colonnes/cases, cartes à glisser
  dedans (glisser-déposer, réutilise les patterns déjà en place pour
  "order"/"association"/"timeline" côté `index.js`).
- Scoring serveur : proportionnel au nombre de cartes dans la bonne zone
  (même famille de calcul que "timeline"/"association" actuellement —
  `pointsFor() × (correctCount / total)`), jamais de modération humaine.
- Révélation : montrer la bonne zone pour chaque carte mal placée (même
  esprit que le rouge/vert déjà utilisé sur "timeline"/"association").
- Style visuel : aligné sur l'artboard "Zones / époques" validé (zones en
  pointillés, cartes qui viennent s'y ranger), adapté aux vrais tokens de
  l'appli (déjà fait dans le canvas de design, à reprendre fidèlement).

## Hors périmètre
- Les autres pistes non retenues du canvas pour CETTE tâche (Portraits,
  Face à face, Tape le repère, Axe temporel) — pas construites.
- **"Avant / Après" est volontairement laissé de côté ICI, pas abandonné** :
  l'utilisateur veut l'ajouter dans un second temps, comme un nouveau type
  de question à part entière (pas une variante de "Rangement") — fera
  l'objet de sa propre tâche `/new-task` une fois "Rangement" livré.
- Toucher au type "timeline" existant (reste tel quel, aucune migration
  des quiz existants).
- `supabase/schema.sql` : pas de changement attendu, `questions` est déjà
  `jsonb` — un nouveau `type` dans le JSON n'a besoin d'aucune migration.
  À confirmer/re-vérifier au moment du plan si un besoin imprévu apparaît.
- Mode IRL "masquer les réponses" (déjà géré génériquement côté panneau de
  modération — sans objet ici puisque ce type n'a jamais de modération).

## Fichiers concernés
- `client/public/editor.html` — nouvelle section détail pour "rangement"
  (option dans `#qType`, zone d'édition des zones + des cartes).
- `client/public/js/editor.js` — logique de création/édition/validation/
  sauvegarde des zones et des cartes assignées, rendu de la section.
- `client/public/index.html` — nouvelle zone de jeu `#rangementArea` (ou
  nom équivalent), à côté de `#timelineArea`/`#associationArea`.
- `client/public/js/index.js` — rendu + glisser-déposer + soumission +
  révélation côté joueur ; icône/libellé du type dans les tables
  `questionTypeMeta`-like déjà en place (voir `icon`/`color` par type).
- `server/index.js` — nouvelle branche de scoring dans `answer:submit`
  (`q.type === 'rangement'`), filtrage `q.correct` du payload diffusé
  (comme les autres types "auto-corrigés" déjà exclus de la diffusion
  avant révélation).
- `client/public/css/style.css` — styles des zones/cartes, repris de
  l'artboard validé.
- `docs/agent-tasks/013-question-rangement.md` — ce fichier de suivi.

## Plan

### Modèle de données retenu
```js
// Question :
{
  type: 'rangement',
  zones: ['Avant 1900', '1900-1950', '1950-2000', 'Après 2000'], // noms, dans l'ordre du créateur — PUBLIC dès l'affichage (ce sont les cibles)
  correct: [
    { title: 'Premier vol Wright', description: '', zone: 1 }, // zone = index dans `zones`, caché jusqu'à la révélation
    { title: 'Révolution française', description: '', zone: 0 },
    // ...
  ]
}
```
Décision : `zones` est un tableau à part (public dès `question:show`), `correct[i].zone` est l'INDEX dans ce tableau (pas le nom en clair) — évite un risque de désync si deux zones portaient un nom identique, et reste cohérent avec la clé numérique `key` déjà utilisée pour identifier une carte côté "timeline"/"association".

**Trade-off le plus important du plan — interaction de jeu :** la maquette validée montre un glisser-déposer entre plusieurs conteneurs (zones). Le code existant n'a NULLE PART de drag-and-drop multi-conteneurs (order/timeline glissent dans UNE liste ; association est déjà en tap-tap : sélectionner un élément à gauche puis son binôme à droite, voir `completeAssociationPair`/`associationState` dans `index.js`). Recommandation : **reprendre le modèle tap-tap d'association** (taper une carte dans le bac, puis taper une zone pour l'y déposer — retaper la carte dans sa zone la renvoie au bac) plutôt que d'inventer un vrai drag multi-conteneurs. Beaucoup moins de code, mobile-friendly par construction (le glisser-déposer actuel est déjà pointer-based et pas trivial à généraliser à plusieurs cibles), et le rendu visuel (cartes "posées" dans des zones en pointillés) reste identique à la maquette — seul le GESTE change (taper au lieu de glisser). Étape 6 ci-dessous part de cette hypothèse ; si tu préfères un vrai glisser-déposer multi-zones, dis-le avant `/implement-step` — c'est un chantier sensiblement plus lourd (à rechiffrer).

**Mise à jour après l'étape 8 :** l'utilisateur a explicitement demandé le vrai glisser-déposer ("je veux pouvoir cliquer glisser les tuiles"). Le tap-tap a donc été remplacé par un glisser réel — la carte se détache visuellement (position:fixed dans `document.body`, suit le pointeur), la zone survolée est détectée via `elementFromPoint` à chaque `pointermove`, le dépôt se fait au relâchement (`moveRangementCard`, seul point d'écriture, inchangé). Voir l'étape 6 mise à jour ci-dessous.

**Aucune zone interdite du `CLAUDE.md` touchée** : pas de migration `supabase/schema.sql` (`questions` est déjà `jsonb`), pas de `render.yaml`, pas de nouvelle dépendance npm.

---

1. **Constantes + validation éditeur** (`client/public/js/editor.js`)
   - `RANGEMENT_MIN_ZONES = 2`, `RANGEMENT_MAX_ZONES = 5`, `RANGEMENT_MIN_ITEMS = 4`, `RANGEMENT_MAX_ITEMS = 12` (aligné sur les bornes existantes des types voisins — timeline 3-8, intrus 3-8 ; un peu plus large ici car les zones tolèrent davantage de cartes).
   - `isValidRangementZones(zones)` / `isValidRangementItems(correct, zones)` (chaque `zone` doit être un index valide de `zones`).
   - Enregistrer le type dans `QTYPE_ICON`/`QTYPE_COLOR` (`rangement: '🗂️'`, couleur : réutiliser `var(--color-accent-2)` — déjà défini, jamais utilisé comme couleur de type, évite d'ajouter un nouveau token CSS juste pour ça).

2. **`editor.html`** — nouvelle section détail, sur le modèle de `#timelineSection`/`#associationSection` :
   ```html
   <div id="rangementSection" class="detail-section d-none">
     <label>Zones (2 à 5), glisser pour réordonner</label>
     <div id="rangementZoneList" class="options-editor"><!-- Rempli par JS --></div>
     <button id="addRangementZone" class="btn btn-nav-secondary mt-8">+ Ajouter une zone</button>

     <label class="mt-16">Cartes (4 à 12) — assigne chacune à une zone</label>
     <div id="rangementItemList" class="options-editor"><!-- Rempli par JS --></div>
     <button id="addRangementItem" class="btn btn-nav-secondary mt-8">+ Ajouter une carte</button>
     <p class="text-muted font-13 mt-8">Les joueurs voient les noms de zones dès le début — seule l'assignation de chaque carte reste cachée jusqu'à la révélation.</p>
   </div>
   ```
   + option `<option value="rangement">🗂️ Rangement</option>` dans `#qType`.

3. **`editor.js` — logique de la section** : `renderRangementZones()`/`renderRangementItems()` calquées sur `renderTimelineEvents` (glisser pour réordonner les ZONES via le pattern `wireTimelineEditDrag`, réutilisable tel quel côté zones) ; chaque ligne "carte" porte un `<input type="text">` (titre) + un `<select>` peuplé dynamiquement depuis la liste de zones courante (se re-render à chaque ajout/suppression/renommage de zone, comme les `<select>` de team déjà présents ailleurs dans le fichier). Branchement dans `qType.onchange` (afficher/masquer la section), dans `applyReadOnly` (désactiver les deux boutons d'ajout + inputs), et dans la validation de sauvegarde (`saveQuizBtn.onclick`, même bloc que la vérif `TIMELINE_MIN_EVENTS`/`MAX_EVENTS` vue à la ligne ~3550) : nombre de zones/cartes dans les bornes, chaque carte a un titre non vide et une zone assignée.

4. **`client/public/index.html`** — nouvelle zone de jeu, sur le modèle de `#timelineArea`/`#associationArea` :
   ```html
   <div id="rangementArea" class="rangement-area d-none">
     <div id="rangementZones" class="rangement-zones"></div>
     <div id="rangementTray" class="rangement-tray"></div>
   </div>
   ```

5. **`index.js` (hôte, émission de la question)** — dans le même bloc que `timelineItems`/`pairsA`/`pairsB` (~ligne 4340-4360) :
   ```js
   zones: q.type === 'rangement' ? q.zones : undefined, // public, jamais mélangé
   rangementItems: q.type === 'rangement'
     ? shuffleArray((q.correct || []).map((it, i) => ({ title: it?.title ?? '', description: it?.description ?? '', key: i })))
     : undefined, // zone JAMAIS incluse ici, même logique que `date` pour timeline
   ```

6. **`index.js` (joueur, affichage + interaction)** :
   - `buildRangementArea(zones, items)` : rend les colonnes de zones (nom + conteneur vide) dans `#rangementZones`, les cartes non placées dans `#rangementTray`.
   - État local `rangementState = { assignments: {}, selectedKey: null }` (calqué sur `associationState`).
   - Clic sur une carte (bac ou déjà posée) → sélection (highlight, comme `.is-selected` côté association) ; clic sur une zone avec une carte sélectionnée → assigne (`assignments[key] = zoneIndex`, re-render : la carte quitte le bac et rejoint la zone) ; clic sur une carte déjà posée sans sélection active → la retire de sa zone et la renvoie au bac.
   - `getCurrentRangementSubmission()` → `assignments` tel quel (`{ [key]: zoneIndex }`), envoyé par `submitCurrentAnswer` comme `content` JSON (même schéma que `association`/`order`). Cartes jamais placées : absentes de `assignments`, comptées incorrectes côté serveur (pas de blocage à la soumission — cohérent avec le chrono qui peut couper avant que tout soit placé).
   - `revealRangementArea(correctItems)` : pour chaque carte, compare sa zone soumise à `correctItems[key].zone`, classes `.correct-reveal`/`.incorrect-reveal` (mêmes noms que timeline), et RE-place toute carte mal rangée dans sa vraie zone à la révélation (visuellement, comme le "vrai ordre" de `revealTimelineList`).
   - Enregistrer `rangement` dans `QUESTION_TYPE_META` + `COMPLEX_TYPES` (mécanique nouvelle, mérite l'intro longue) ; brancher `rangementArea`/`rangementDisabled` dans les mêmes points de couture que les autres types : le tableau `isTileType`-like (ligne ~4862), le bloc `payload.type === 'timeline'` (~4893, affichage/masquage de zone), le verrouillage post-envoi (~5300-5323, ajouter `rangementArea` à la liste des éléments `.is-locked`), le reset entre questions (~2412-2414).

7. **`server/index.js`** :
   - Ajouter `'rangement'` à la liste des types dont `correct` est retiré du `broadcastPayload` (ligne ~1402).
   - Nouvelle branche dans `answer:submit`, sur le modèle de `association` (proportionnel, pas de modération) : parser `content` (JSON `{ [key]: zoneIndex }`), comparer à `q.correct[key].zone` pour chaque carte, `correctCount / total` → `delta = Math.round(pointsFor(...) * fraction)`. `historyEntry.results` = `'correct'` seulement si TOUTES les cartes sont bien rangées (même convention que association/timeline) ; `historyEntry.answers`/`answerDetails` : lister "Titre → Nom de la zone choisie" par carte (utile pour le récap hôte).
   - `revealQuestion` : `question.revealPayload.correct = question.correct` tel quel (pas de retri nécessaire, contrairement à timeline) — le client réconcilie par `key`.

8. **`client/public/css/style.css`** — nouvelles règles `.rangement-zones` (grille de colonnes), `.rangement-zone` (bordure pointillée, cf. artboard "Zones / époques" du canvas de design), `.rangement-card`/`.rangement-tray`, états `.selected`/`.correct-reveal`/`.incorrect-reveal` (mêmes tokens de couleur que timeline/association déjà en place) ; mirroir `.question-item.type-rangement { --qt-color: var(--color-accent-2); }` à ajouter au bloc des types (~ligne 4449 et suivantes).
   - Mettre à jour le texte du tutoriel éditeur ("13 types disponibles" → "14 types disponibles", voir `editor.js` ~ligne 3906) et tout autre décompte de types en dur trouvé en cours de route.

9. **Vérification** : `node --check` sur les 3 fichiers JS touchés, équilibre CSS (comptage accolades), démarrage `npm start`, puis test manuel en Browser pane — créer une question "Rangement" dans l'éditeur (2 zones, 4 cartes), lancer une partie test, jouer côté joueur (placer/retirer des cartes), vérifier le scoring proportionnel et la révélation côté hôte + joueur.

## Étapes réalisées
- [x] Étape 1 — Constantes + validation éditeur (`client/public/js/editor.js`) :
  `RANGEMENT_MIN_ZONES/MAX_ZONES/MIN_ITEMS/MAX_ITEMS`, `isValidRangementZones`,
  `isValidRangementItems`, entrées `rangement` dans `QTYPE_ICON` (🗂️) et
  `QTYPE_COLOR` (`var(--color-accent-2)`, token existant réutilisé). Pas
  encore branché à un rendu — aucune interface visible ne change à cette
  étape.
- [x] Étape 2 — `editor.html` : option `<option value="rangement">🗂️ Rangement</option>`
  dans `#qType`, nouvelle section `#rangementSection` (`#rangementZoneList`
  + bouton `#addRangementZone`, `#rangementItemList` + bouton
  `#addRangementItem`), sur le modèle de `#timelineSection`. Markup pur,
  `d-none` par défaut et pas encore branché à `qType.onchange` (étape 3) —
  aucun rendu ne change encore côté navigateur.
- [x] Étape 3 — logique de la section éditeur (`client/public/js/editor.js`) :
  `renderRangementZones`/`wireRangementZoneDrag` (glisser pour réordonner
  les zones, même mécanique que timeline) et `renderRangementItems` (titre
  + `<select>` de zone par carte, pas de glisser — l'ordre des cartes n'a
  aucun impact sur le jeu). Remap explicite des index de zone stockés sur
  chaque carte au réordonnancement ET à la suppression d'une zone
  (`remapZoneIndexAfterMove`/`remapZoneIndexAfterDelete`) — sans ça, une
  carte assignée par INDEX se retrouverait pointer vers la mauvaise zone
  après un glisser. Branché dans `toggleTypeSections`, dans le bloc
  `qType.onchange` (initialisation/nettoyage de `q.zones`/`q.correct` selon
  le type précédent), dans `applyReadOnly` (boutons d'ajout désactivés,
  chaque input/select/bouton de suppression désactivé individuellement dans
  le rendu), et dans la validation de sauvegarde (bornes zones/cartes,
  noms/titres non vides). `QTYPE_HINTS.rangement` ajouté pour l'aperçu de
  mécanique dans l'éditeur.
- [x] Étape 4 — `client/public/index.html` : nouvelle zone de jeu
  `#rangementArea` (`#rangementZones` + `#rangementTray`), sur le modèle de
  `#timelineArea`/`#associationArea`. Markup pur, `d-none` par défaut, pas
  encore alimenté par le JS (étapes 5-6).
- [x] Étape 5 — émission de la question (hôte), `client/public/js/index.js` :
  `zones` (public, jamais mélangé — c'est l'ordre voulu par le créateur) et
  `rangementItems` (titre/description + clé mélangés, zone attendue JAMAIS
  incluse) ajoutés au payload `question:new`, même bloc que `timelineItems`.
  Pas encore de rendu ni de scoring branché (étapes 6-7) — le serveur, pour
  l'instant, diffuserait encore `q.correct` en clair pour ce type tant que
  l'étape 7 ne l'a pas ajouté à la liste d'exclusion ; sans incidence
  puisque rien n'affiche/n'utilise ce payload côté joueur avant l'étape 6.
- [x] Étape 6 — affichage/interaction/révélation (joueur),
  `client/public/js/index.js` :
  - `buildRangementArea(zones, items)` : construit les colonnes de zones et
    les cartes du bac UNE SEULE FOIS (jamais recréées ensuite, pour ne pas
    rejouer l'animation d'entrée `applyTileReveal` à chaque clic).
  - `moveRangementCard(key, zoneIdx)` : point d'écriture unique pour
    déplacer une carte (appendChild réel) entre bac et zones.
  - **Révisé après l'étape 8** (retour utilisateur : "je veux pouvoir
    cliquer-glisser") : l'interaction tap-tap initiale a été remplacée par
    un VRAI glisser-déposer — `wireRangementCardDrag`, la carte se détache
    dans `document.body` (position:fixed) et suit le pointeur, `.rangement-
    zone` survolée détectée via `elementFromPoint` à chaque `pointermove`,
    dépôt au relâchement. Simple clic (sans glisser) sur une carte déjà
    posée : retrait rapide vers le bac, conservé comme repli pratique.
  - `getCurrentRangementAssignments()` / contenu envoyé au serveur dans
    `submitCurrentAnswer` (branche `rangement`, même schéma proportionnel
    que "association" — pas d'obligation d'avoir tout rangé).
  - `revealRangementArea(correctItems)` : déplace chaque carte vers sa VRAIE
    zone à la révélation (posée ou non), marque correct/incorrect.
  - Branché partout où c'était nécessaire : visibilité par type,
    `isTileType`, verrouillage/déverrouillage (submit, timer:end, intro),
    `clearRevealState`, `QUESTION_TYPE_META`/`COMPLEX_TYPES`, banderole de
    résultat au reveal (`correctCount`/`X presque !`).
- [x] Étape 7 — `server/index.js` (scoring + reveal) :
  - `'rangement'` ajouté à la liste des types dont `correct` est retiré du
    payload diffusé (`broadcastPayload`) — ferme le trou temporaire laissé
    ouvert depuis l'étape 5.
  - Nouvelle branche `q.type === 'rangement'` dans `answer:submit`, même
    famille que "association" : `submitted = { [key]: zoneIdx }` comparé à
    `q.correct[key].zone`, score proportionnel
    (`pointsFor() × correctCount/total`), `historyEntry.answers`/
    `answerDetails` listent "Titre → Zone" par carte (ou "(non placée)").
  - `revealQuestion` : aucun changement nécessaire — la condition de retri
    existante ne visait QUE "timeline" (l'ordre chronologique recalculé),
    `question.correct` part donc déjà tel quel pour "rangement", ce qui est
    le comportement voulu (le client réconcilie par `key`).
- [x] Étape 8 — CSS (`client/public/css/style.css`) : `.rangement-area`,
  `.rangement-zones` (grille `auto-fit, minmax(140px, 1fr)`),
  `.rangement-zone` (bordure pointillée, repris du canvas de design "Zones
  / époques" validé), `.rangement-tray`, `.rangement-card`
  (`.is-selected`/`.correct-reveal`/`.incorrect-reveal`), `.rangement-zone-select`
  (classe dédiée pour le `<select>` de l'éditeur, pas `.qz-select`).
  `#rangementArea` ajouté à la règle `.is-locked` partagée. Mirroir
  `.question-item.type-rangement { --qt-color: var(--color-accent-2); }`.
  Texte du tutoriel éditeur corrigé au passage ("13 types" était déjà faux
  avant cette tâche — "recherche" n'y avait jamais été ajouté — remis à
  "15 types" avec "recherche" et "rangement" tous les deux).
- [ ] Étape 9 — vérification de bout en bout

## Checks effectués
- [x] `node --check client/public/js/editor.js` (étapes 1 et 3)
- [x] Équilibre des balises `<div>` de `editor.html` (94/94) (étape 2)
- [x] Markup servi confirmé via `fetch('/editor.html')` en Browser pane :
  les 5 ids (`rangementSection`, `rangementZoneList`, `addRangementZone`,
  `rangementItemList`, `addRangementItem`) et l'option `value="rangement"`
  sont bien présents dans le HTML réellement servi (étape 3) — `editor.html`
  reste derrière l'authentification dans cette session, donc pas de test
  interactif complet possible (créer/renommer/glisser une zone, assigner
  une carte) ; à tester manuellement en vrai (voir "Tests manuels
  recommandés").
- [x] Équilibre des balises `<div>` de `index.html` (160/160) + markup
  confirmé servi via `fetch('/index.html')` (`rangementArea`,
  `rangementZones`, `rangementTray`) (étape 4)
- [x] `node --check client/public/js/index.js` (étapes 5 et 6)
- [x] Browser pane, page joueur (`index.html`) rechargée : aucune erreur
  console, `#rangementArea`/`#rangementZones`/`#rangementTray` présents et
  `d-none` par défaut (étape 6) — pas de test interactif complet en
  conditions réelles (créer une salle, lancer une question "rangement",
  taper des cartes/zones, vérifier le score) : ces fonctions ne sont pas
  exposées sur `window` (closures de script classique) et une partie
  complète nécessite un salon hôte+joueur réel ; à tester manuellement
  (voir "Tests manuels recommandés").
- [x] `node --check server/index.js` (étape 7)
- [x] Démarrage serveur vérifié — redémarré (pas de watcher/nodemon,
  `npm start` ne recharge pas seul), `/server-info` répond 200, aucune
  erreur dans les logs (étape 7)
- [x] `node --check client/public/js/editor.js` (étape 8, texte tutoriel)
- [x] Vérification visuelle Browser pane, page joueur, état forcé à la main
  (zones + cartes injectées directement, `buildRangementArea` n'étant pas
  exposée sur `window`) : rendu conforme au canvas de design en desktop
  (800px, captures) ET en mobile (375px, grille qui repasse à 2 colonnes,
  aucun débordement) — zones en pointillés, cartes posées/en attente,
  anneaux vert/rouge (étape 8).
- [x] Retour utilisateur post-étape 8 : bug réel repéré en test ("aucun
  bloc") — `q.zones` manquait à la liste blanche de normalisation du quiz
  au CHARGEMENT pour lancer une partie (`index.js`, la fonction `norm`),
  perdu silencieusement alors que l'éditeur/la sauvegarde le gardaient très
  bien. Corrigé (`node --check` OK).
- [x] Retour utilisateur post-étape 8 : glisser-déposer réel demandé (tap-tap
  remplacé) + rangées centrées façon "intrus" (`RANGEMENT_ZONE_ROW_PATTERNS`,
  `--rangement-row-cols`). `node --check` OK. Vérifié en Browser pane : 5
  zones mesurées en DOM -> rangée de 3 (225px chacune) puis rangée de 2
  (344px chacune), les deux bien centrées sur la même largeur totale
  (285→985px). Mécanique de glisser (élément détaché + `elementFromPoint` +
  rattachement) rejouée et confirmée sur l'élément réel — le VRAI handler
  (`wireRangementCardDrag`) n'a pas pu être déclenché depuis devtools
  (`rangementDisabled` est une closure non exposée sur `window`, verrouillée
  par défaut hors d'une vraie partie) ; intégration complète à tester en
  vrai (voir tests manuels).
- [x] Retour utilisateur ("tres bien sur PC, mais pas respecté sur
  téléphone") : le centrage en rangées n'était appliqué qu'à partir de
  900px — en dessous, `.rangement-zones` retombait sur une grille
  `auto-fit` qui ne centrait pas une dernière rangée incomplète (ex. 2
  zones seules, collées à gauche). Ajout d'un motif de rangées mobile
  dédié plafonné à 2 colonnes (`RANGEMENT_ZONE_ROW_PATTERNS_MOBILE`,
  `--rangement-row-cols-mobile`), appliqué par défaut, `--rangement-row-cols`
  ne prenant le relai qu'au-dessus de 900px. `node --check` OK, CSS
  équilibrée. Vérifié en DOM à 375px (viewport mobile) pour 3 et 5 zones :
  rangées de 2 pleine largeur, dernière zone isolée en pleine largeur
  (pas de trou visuel puisque chaque rangée occupe déjà 100% de la
  largeur par construction — pas besoin de gap à combler).

## Tests manuels recommandés
- Éditeur : créer une question "Rangement", ajouter/renommer/supprimer des
  zones, vérifier que le glisser réordonne bien les zones ET que les
  cartes déjà assignées ne changent PAS de zone réelle après le
  réordonnancement (juste leur position affichée). Ajouter/supprimer des
  cartes, vérifier les bornes (2-5 zones, 4-12 cartes) et les messages de
  validation à la sauvegarde.
- Jeu : lancer une partie test avec une question "Rangement", vérifier côté
  joueur que glisser une carte du bac (ou d'une zone) jusqu'à une zone
  l'y dépose bien (zone en surbrillance pendant le survol), qu'un simple
  clic sur une carte déjà posée la renvoie directement au bac, et qu'un
  glisser relâché HORS de toute zone remet la carte à sa position d'origine.
  Tester au tactile (mobile/tablette), pas seulement souris/trackpad.
  Envoyer une réponse partiellement rangée (cartes encore dans le bac) et
  vérifier que ça n'empêche pas la validation au bout du chrono. Vérifier la
  révélation (cartes qui migrent vers leur vraie zone, vert/rouge) et le
  score proportionnel. Vérifier aussi l'affichage en rangées centrées pour
  chaque nombre de zones possible (2 à 5).

## Risques restants
_(à remplir au fil de l'implémentation)_

## Statut
`ouverte`
