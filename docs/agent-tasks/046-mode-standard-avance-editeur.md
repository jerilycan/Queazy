# [046] Mode Standard / Avancé du configurateur de question

## Contexte
Un canvas de design (`/design`, artifact "Éditeur de quiz — Standard /
Avancé", https://claude.ai/code/artifact/44801ee6-88f3-4c2d-a8c0-e346d7fb85d4)
a été produit pour explorer une refonte de l'éditeur réel
(`client/public/editor.html` + `editor.js`) autour d'un **toggle global
Standard / Avancé** : en mode Standard, l'éditeur ne montre que l'essentiel
pour créer une question rapidement ; en mode Avancé, tous les réglages
optionnels (image d'illustration, son, médias de révélation, brouillon,
banque/catégorie/difficulté, tutoriel/dupliquer/supprimer en accès direct...)
redeviennent visibles. Le canvas contient 38 artboards : une coquille
(barre du haut + sidebar + panneau) en Standard et en Avancé
(`Main.dc.html`/`MainAvance.dc.html`), un sélecteur de type en Standard et
en Avancé (`TypePicker.dc.html`/`TypePickerAvance.dc.html`), puis une paire
Standard/Avancé par mécanique de question, pour les 17 types existants
(`Mcq`, `Free`, `TrueFalse`, `Graduation`, `Order`, `ImageZone`, `ZoomGuess`,
`Reveal`, `BlindTest`, `Association`, `Timeline`, `Intrus`, `PetitBac`,
`Recherche`, `Rangement`, `Indice`, `Halo`).

Ce n'existe aujourd'hui QUE dans le canvas — l'éditeur réel n'a aucune
notion de mode, tous les réglages sont toujours visibles pour tous les
types.

Une tâche antérieure, la 037 (`docs/agent-tasks/037-coherence-canvas-
editeur-reponse-chips.md`), a déjà implémenté une PARTIE du panneau "Texte
libre" en s'inspirant du même canvas (chips de variantes + tolérance
orthographique 3 niveaux + testeur de réponse) — mais SANS la notion de
mode Standard/Avancé (tout est toujours visible). Ce travail est actuellement
**non committé, mélangé dans le même diff que les tâches 044/045** (déjà
identifié et isolé une fois via stash dans une session précédente — voir
l'historique git récent). Cette nouvelle tâche devra décider comment
intégrer ce travail existant (a priori : la tolérance/le testeur basculent
en section "Avancé") plutôt que le dupliquer ou le jeter.

## Objectif
Le configurateur de question réel (`editor.html`/`editor.js`) a un toggle
"Standard / Avancé" fonctionnel, persistant au moins pour la session
d'édition en cours, qui :
- masque/affiche les sections optionnelles de la coquille (barre du haut :
  Tutoriel/Supprimer/Dupliquer en accès direct vs repliés dans un menu
  "⋯") ;
- masque/affiche, dans le sélecteur de type, les mécaniques "avancées"
  (11 des 17 types restent repliées en Standard) ;
- masque/affiche, dans le panneau de configuration de CHAQUE type de
  question, les sections marquées "Avancé" dans le canvas correspondant
  (illustration, son, médias de révélation, section Publication/brouillon/
  banque/catégorie/difficulté, et les réglages spécifiques à chaque type
  marqués pareil dans son propre artboard) ;
- affiche, en mode Standard, l'encart "Plus d'options disponibles → Passer
  en mode avancé" en bas de panneau (voir `.standard-cta` dans
  `Main.dc.html`) ;
- ne casse AUCUNE donnée existante : un champ masqué en Standard garde sa
  valeur déjà réglée (le masquage est purement visuel, jamais une remise à
  zéro).

## Périmètre
- Le mécanisme de toggle lui-même (état, persistance, CSS/JS de
  bascule) — à concevoir en s'inspirant de `Main.dc.html`
  (`.mode-switch`/`.mode-switch-btn`, classe `sc-if` du canvas à traduire en
  `classList.toggle('d-none', ...)`/équivalent réel).
- L'application du mode à la coquille (barre du haut) et au sélecteur de
  type (`#typePickerGrid` ou équivalent réel — nom exact à vérifier dans
  `editor.js`).
- L'application du mode à CHACUN des 17 types de question, section par
  section, en suivant fidèlement le artboard `<Type>.dc.html`/
  `<Type>Avance.dc.html` correspondant (à extraire du canvas au moment de
  chaque étape, un par un — pas tout d'un coup).
- Intégration propre du travail déjà fait par la tâche 037 (tolérance/
  testeur "Texte libre") dans ce nouveau mécanisme.
- CSS ajouté en reprenant fidèlement les classes/valeurs du canvas
  (`.mode-switch`, `.advanced-pill`, `.standard-cta`, `.auto-accordion`
  réutilisé tel quel — déjà présent dans l'appli réelle, voir
  `client/public/index.html` `#autoTypeAccordionBody`).

## Hors périmètre
- Toute modification du comportement EN JEU (`index.js` côté joueur/MJ,
  `server/index.js`) — cette tâche ne touche QUE l'éditeur.
- Persistance du mode choisi en base de données (localStorage suffit,
  sauf décision contraire en `/plan-feature`).
- Les 30 autres artboards du canvas au-delà de ceux déjà lus pour cadrer
  cette tâche (`Main`, `MainAvance`, `TypePicker`, `TypePickerAvance`,
  `Mcq`, `McqAvance`) — chaque type restant sera lu depuis le canvas AU
  MOMENT de l'étape qui l'implémente, pas anticipé ici.
- Reprendre/retoucher les décisions déjà validées de la tâche 037
  au-delà de leur intégration au mode Avancé (pas de nouveau réglage de
  tolérance, pas de changement de comportement du testeur).

## Fichiers concernés
- `client/public/editor.html` — structure des sections, classes CSS,
  boutons de bascule.
- `client/public/js/editor.js` — logique de bascule, state du mode,
  câblage des accordéons déjà existants (`.auto-accordion`, voir
  `toggleTypeSections`/sections par type).
- `client/public/css/style.css` — classes du canvas à porter
  (`.mode-switch`, `.advanced-pill`, `.standard-cta`, etc.), en réutilisant
  les tokens déjà en place (`--color-accent`, `--radius-md`...) plutôt que
  ceux du canvas (palette différente, canvas = outil de design générique,
  pas la DA réelle de QuEazy).
- `docs/agent-tasks/037-coherence-canvas-editeur-reponse-chips.md` — à
  clôturer ou fusionner dans cette tâche une fois son travail intégré au
  mode Avancé (décision à prendre en `/plan-feature`).

## Plan

_Rédigé après lecture du canvas (39 fichiers extraits : `Main`/`TypePicker` + 17 types × Standard/Avancé)
et du code réel (`editor.html` ~930 lignes, `editor.js` ~6000 lignes). Ne touche PAS aux zones
interdites du `CLAUDE.md` (schéma DB, `render.yaml`, dépendances npm) : aucune étape ne nécessite de
validation dédiée à ce titre. Éditeur uniquement, jamais le jeu._

### Constat clé (change le découpage prévu au cadrage)
Les 17 artboards Standard/Avancé sont **identiques** à 9 caractères près (le défaut de la prop `mode`) et
ne diffèrent entre types que par quelques blocs "Avancé", presque toujours les **mêmes** :
- **communs à tous les types** : Image d'illustration, Son facultatif, médias de révélation (image + son ;
  le texte "Explication" reste visible), groupe "Publication" (Brouillon + Zone experte = banque /
  catégorie / difficulté), boutons Tutoriel / Supprimer / Dupliquer de la barre du haut (repliés dans un
  menu "⋯" en Standard) ;
- **spécifiques** (un seul bloc chacun) : QCM « toutes les bonnes réponses doivent être cochées »,
  Curseur numérique « Tolérance », ZoomOut « Niveau de zoom initial », Halo « Rayon du halo » ;
- **sélecteur de type** : 6 types "Basique" (Texte libre, QCM, Vrai/Faux, Curseur, Ordre, Image) visibles,
  les 11 autres derrière « Voir les mécaniques avancées ».

**Choix : une approche pilotée par données, pas 17 implémentations.** On marque les blocs concernés avec un
attribut `data-advanced` dans `editor.html` et UNE règle CSS (`body.editor-standard [data-advanced]
{ display:none }`) les masque. _Trade-off : on perd la fidélité "artboard par artboard" au pixel près,
mais on évite 17 étapes quasi identiques, le risque de dérive et d'oubli entre types, et le masquage reste
purement visuel (aucune valeur n'est jamais effacée)._

### Étapes (une validation visuelle dans le Browser pane à la fin de CHAQUE étape)

**Étape 1 — Infrastructure du toggle + barre du haut.**
- `editor.js` : état `editorMode` (`'standard'` | `'advanced'`), lu/écrit dans `localStorage`
  (`queazy_editor_mode`, repli silencieux commenté si indisponible ; **défaut `standard` pour tous**, décision utilisateur), classe `editor-standard` /
  `editor-advanced` posée sur `<body>` (`applyEditorMode()`).
- `editor.html` : `.mode-switch` (2 boutons) dans `.editor-top-bar-row`, menu `⋯` (`#editorOverflowBtn`).
- Barre du haut : en Standard, Tutoriel / Supprimer / Dupliquer sont **déplacés** (appendChild) dans le
  menu `⋯` ; en Avancé, remis dans `.editor-actions`. _Trade-off : on déplace les mêmes nœuds plutôt que de
  les dupliquer, donc leurs handlers (`replayTutorialBtn.onclick`, `deleteQuizBtn.onclick`...) restent
  câblés une seule fois._
- `style.css` : `.mode-switch*`, `.advanced-pill`, `.editor-overflow-menu`, règle `[data-advanced]`,
  en tokens réels (`--color-accent`, `--radius-md`...), jamais les valeurs brutes du canvas.

**Étape 2 — Blocs communs masqués en Standard.**
- `data-advanced` sur : `#illustrationSection`, `#bonusAudioSection`, bloc média de révélation
  (`#revealImageUpload`/`#revealAudioUpload`, pas `#qExplanation`), brouillon, "Ajouter à la banque",
  catégorie/difficulté.
- Exception **Blind Test** : le son y est le cœur du type, donc visible en Standard (le canvas n'y met
  pas de pastille "Avancé" sur le son) — `body[data-qtype]` posé par `toggleTypeSections()`.
- Pastille « Avancé » en mode Avancé via CSS (`::after`) plutôt que du HTML ajouté partout.
- Regroupement visuel "📤 Publication" (brouillon + zone experte repliable) **en bas** du panneau,
  comme le canvas. _Trade-off : aujourd'hui ces réglages sont tout en haut ; les déplacer change les
  habitudes mais suit la maquette validée — à confirmer (voir Questions)._

**Étape 3 — Sélecteur de type (`renderTypePicker`, `#qType`).**
- Tuiles des 11 types avancés marquées `data-advanced` ; encart « Envie de sortir des sentiers battus ? →
  Voir les mécaniques avancées » (`.standard-cta`) qui bascule en Avancé.
- Types réels : `reveal` est déjà exclu de la grille de création (tâche 026) → **10** tuiles avancées
  réelles, pas 11 comme dans le canvas (texte du CTA à ajuster).
- `#qType` : en Standard on masque les `<option>` avancées **sauf celle de la question courante** (une
  question avancée déjà créée reste éditable).

**Étape 4 — Réglages spécifiques par type (4a, 4b, 4c).**
- 4a : QCM (`#mcqSection` : case « toutes cochées »), Texte libre (intégration 037 : tolérance
  orthographique + testeur marqués Avancé ; variantes en chips restent visibles comme dans `Free.dc.html`).
- 4b : Curseur numérique (Tolérance), ZoomOut (Niveau de zoom initial), Halo (Rayon du halo).
- 4c : vérification des 11 autres types contre leurs artboards (seuls les blocs communs sont avancés) ;
  corrections ponctuelles si un artboard révèle un écart.

**Étape 5 — CTA bas de panneau, tutoriel, cas limites.**
- Encart `.standard-cta` « Plus d'options disponibles → Passer en mode avancé » en bas du panneau (Standard).
- `EDITOR_TOUR_STEPS` : ignorer les étapes dont la cible est masquée (`#illustrationUpload` l'est en
  Standard) sinon la visite guidée casse.
- Lecture seule (`readOnly`), quiz d'un autre créateur : le mode n'a pas de sens, les deux affichages
  restent valables (rien à masquer d'éditable).
- Mobile/étroit : le commutateur ne doit pas casser `.editor-top-bar-row`.

**Étape 6 — Vérification complète et clôture.**
- Banc d'essai Browser pane : les 17 types × 2 modes, basculer en cours d'édition sans perdre aucune
  valeur, sauvegarder/recharger un quiz contenant des réglages avancés édités en Standard.
- `node --check`, accolades CSS, `/review`, puis `/close-task` (fusion/clôture du doc 037).

### Questions à trancher avant `/implement-step`
1. ~~**Mode par défaut**~~ — **TRANCHÉ (utilisateur) : Standard pour tout le monde**, y compris les créateurs existants, tant qu'aucun choix n'est mémorisé. Conséquence : un créateur existant verra d'abord l'éditeur allégé ; l'encart « Plus d'options disponibles » (étape 5) et le commutateur doivent donc rester bien visibles.
2. La **tolérance orthographique + testeur** (tâche 037) absents du canvas : les classer « Avancé » ?
3. Déplacer **Brouillon / banque / catégorie** en bas ("Publication") comme le canvas, ou les laisser en
   haut et seulement les masquer en Standard ?
4. Le mode est-il mémorisé **par navigateur** (localStorage, proposé) ou aussi lié au compte ?

## Étapes réalisées
- [x] Étape 1 — infrastructure du toggle + barre du haut (commutateur `.mode-switch`, état `editorMode` mémorisé en localStorage, défaut Standard, menu « ⋯ » Tutoriel/Supprimer/Dupliquer déplacés, retour à l'ordre d'origine en Avancé et en lecture seule, règle CSS `[data-advanced]`).
- [x] Étape 2 — blocs communs masqués en Standard (illustration, son facultatif sauf Blind Test, médias de révélation, groupe « Publication » déplacé en bas avec « Zone experte » repliable ; pastilles « Avancé »).
- [x] Étape 3 — sélecteur de type (6 types « Basique » visibles en Standard, 10 « Avancé » masqués, libellés de groupe, encart « Envie de sortir des sentiers battus ? » qui bascule en Avancé ; texte d'intro dont le compte « 13 mécaniques » était périmé corrigé). Le masquage d'`<option>` dans `#qType` prévu au plan est sans objet : ce select n'est pas affiché dans l'éditeur actuel.
- [x] Étape 4 — réglages spécifiques par type (QCM « toutes cochées », Curseur « Tolérance », ZoomOut « Niveau de zoom initial », Halo « Rayon », Texte libre « Tolérance orthographique + testeur » de la 037). 4c : les 11 autres types n'ont que les blocs communs, conformément à leurs artboards — rien d'autre à masquer.
- [x] Étape 5 — encart « Plus d'options disponibles » en bas du panneau (Standard), visite guidée qui ignore les cibles masquées, lecture seule, écran étroit.
- [x] Étape 6 — vérification complète des 17 types × 2 modes (clôture `/review` puis `/close-task` à lancer).
- [x] Ajout hors plan initial (demande utilisateur, validé sur une page de démo) — animations de la partie création : (1) blocs avancés en cascade avec liseré au passage en Avancé, (2) nouvelle question qui glisse dans la liste, (3) formulaire en fondu après le choix du type + appui sur la tuile, (4) confettis à la PREMIÈRE sauvegarde d'un quiz uniquement, (5) menu « ⋯ » qui s'ouvre depuis son bouton, (6) commutateur « goutte d'eau » (filtre SVG gooey), (7) tuiles du sélecteur en cascade avec rebond. `prefers-reduced-motion` : fondu simple, confettis coupés. **Dépendance ajoutée côté client** : `canvas-confetti` (CDN jsdelivr, déjà utilisé par `index.html` et `result.html`, autorisé par la CSP) chargé dans `editor.html` — pas un paquet npm.

## Checks effectués
- Animations : `node --check editor.js` OK, accolades CSS OK ; Browser pane : commutateur (2 gouttes, filtre `#qzGoo` appliqué, boutons de 100 px, transition 520 ms, pas de déplacement au chargement), menu ⋯ (`is-closed`), tuiles en cascade (6), bascule vers Avancé (blocs animés), ajout de question (ligne + formulaire animés puis classes retirées), confettis (`canvas` créé, uniquement avec `celebrate`), aucune erreur JS. **Non vérifié : la fluidité visuelle** (le navigateur de test n'avance pas les animations).
- Étapes 4-6 : `node --check editor.js` OK, accolades CSS OK ; Browser pane : QCM/Curseur/ZoomOut/Halo/Texte libre (réglages propres masqués en Standard) ; encart du bas visible en Standard seulement et bascule en Avancé ; visite guidée : 7 étapes en Standard (sans `#illustrationUpload`), 8 en Avancé, démarre sans erreur ; balayage des 17 types (dont `reveal`) : 0 bloc avancé visible en Standard, 3 à 6 en Avancé, aucune erreur JS ; 390 px de large : pas de débordement horizontal ; lecture seule : boutons restaurés dans la barre.
- Étape 3 : `node --check editor.js` OK, accolades CSS OK ; Browser pane : Standard = 6 tuiles + encart, clic sur l'encart passe en Avancé (16 tuiles, libellés Basique/Avancé, encart masqué, mode mémorisé).
- Étape 2 : `node --check editor.js` OK ; Browser pane : en Standard, illustration/son/Publication/brouillon/banque/catégorie/médias de révélation masqués, explication visible ; Blind Test garde son son en Standard ; en Avancé tout visible, groupe Publication en bas ; brouillon et difficulté conservés après bascule Standard/Avancé.
- Étape 1 : `node --check client/public/js/editor.js` OK ; accolades CSS équilibrées ; Browser pane (compte connecté) : défaut Standard sans valeur mémorisée, menu « ⋯ » contient replayTutorialBtn/deleteQuiz/duplicateQuiz, ouverture/fermeture (bouton, clic extérieur, Échap), bascule Avancé remet les boutons dans l'ordre d'origine, mode mémorisé après rechargement, lecture seule (applyReadOnly) restaure les boutons même en Standard.
- [ ] `node --check client/public/js/editor.js`
- [ ] Vérification visuelle Browser pane (éditeur, bascule Standard/Avancé
      sur plusieurs types)

## Tests manuels recommandés
À faire à la main avant/après mise en prod (aucun outil de test automatisé dans ce projet) :
1. **Éditeur, Standard (défaut)** : ouvrir un quiz existant → seuls l'essentiel + l'explication sont visibles ; Tutoriel / Supprimer / Dupliquer dans le menu « ⋯ » ; sélecteur de type à 6 tuiles + encart.
2. **Basculer en Avancé** (commutateur, encart du bas, encart du sélecteur) : blocs en cascade, groupe « Publication » en bas avec « Zone experte » ; le choix survit à un rechargement.
3. **Valeurs conservées** : régler une illustration, un son, un brouillon, une difficulté en Avancé → repasser en Standard → sauvegarder → rouvrir : rien n'est perdu.
4. **Texte libre (037)** : réponse + variantes en chips, tolérance orthographique et testeur (Avancé) ; en jeu, une réponse à 1 faute passe en « Souple », échoue en « Stricte ».
5. **Page d'accueil / salon** : accordéons « Catégories » et « Types de question » du mode automatique (CSS d'accordéon partagé avec la 037) ; page Résultats inchangée.
6. **Première sauvegarde d'un NOUVEAU quiz** : fenêtre de succès + confettis (une seule fois) ; une 2e sauvegarde : pas de confettis.
7. **Animations** à l'œil : commutateur « goutte d'eau », menu « ⋯ », ajout de question, choix du type. Puis réglage « réduire les animations » du système : fondus simples, pas de confettis.
8. **Quiz d'un autre créateur** (lecture seule) : « Dupliquer » reste dans la barre, pas de menu « ⋯ ».
9. **Écran étroit (~390 px)** : barre du haut sans débordement horizontal.

## Risques restants
- **Fluidité des animations non jugée** : le navigateur de test n'avance pas les transitions ; seuls les états posés/retirés et les valeurs de fin ont été contrôlés.
- **`playAnimation` (editor.js) : retrait temporisé (1,6 s) sans annulation** — si une même animation est rejouée avant la fin de la précédente (ex. ré-ouvrir très vite le sélecteur de type), l'ancien minuteur peut retirer les classes de la nouvelle animation plus tôt. Mineur, purement visuel. Fix possible : mémoriser le minuteur par élément et l'annuler.
- **Brouillon invisible en Standard** : une question en brouillon n'affiche son interrupteur qu'en Avancé (le 🚧 de la barre latérale reste visible). À signaler aux créateurs.
- **Périmètre élargi vs. le doc d'origine** : la branche embarque aussi le travail de la tâche 037 (variantes/tolérance, accordéon animé, `server/index.js` : tolérance orthographique `answerTolerance`, uniquement pour le type « free », comportement inchangé sans le champ) — décidé en cours de route car la 046 s'appuie dessus.
- **Dépendance cliente ajoutée** : `canvas-confetti` (CDN jsdelivr) dans `editor.html`, déjà présent ailleurs dans l'appli et autorisé par la CSP ; pas de paquet npm. Si le CDN est injoignable, les confettis ne se lancent pas (aucun blocage de la sauvegarde).
- **Chargement externe** : les confettis ne sont pas testables hors réseau.
- **Aucune validation ne cible un champ masqué** (vérifié sur `validateQuestion`) : une erreur de sauvegarde ne peut pas pointer un bloc caché en Standard.
- Jamais testé sur Firefox/Safari (filtre SVG « gooey », `visibility`/`transform` du menu).

## Statut
`clôturée`
