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
_À remplir en `/plan-feature` — l'ampleur (17 types × 2 modes + coquille +
sélecteur) impose un découpage en plusieurs étapes validées une par une,
probablement : (1) infrastructure du toggle + coquille, (2) sélecteur de
type, (3) intégration du travail 037 dans "Texte libre", (4)+ une étape par
type ou petit groupe de types restants, chacune relisant son artboard dans
le canvas au moment voulu plutôt que tout extraire d'un coup ici._

## Étapes réalisées
- [ ]

## Checks effectués
- [ ] `node --check client/public/js/editor.js`
- [ ] Vérification visuelle Browser pane (éditeur, bascule Standard/Avancé
      sur plusieurs types)

## Tests manuels recommandés
- Basculer Standard ⇄ Avancé sur plusieurs types de question, vérifier
  qu'aucune valeur déjà réglée (image, son, brouillon, catégorie...) n'est
  perdue en repassant en Standard puis en Avancé.
- Créer un quiz entièrement en mode Standard, le sauvegarder, le rouvrir en
  Avancé : tous les champs par défaut doivent être cohérents (rien de
  cassé/vide qui ne devrait pas l'être).

## Risques restants
- Ampleur réelle (17 types) : risque de dérive de temps/qualité si
  implémenté d'un coup plutôt que type par type avec vérification visuelle
  à chaque étape.
- Palette de couleurs du canvas ≠ palette réelle de l'app (le canvas est un
  outil de design générique avec ses propres tokens `--color-*`) — chaque
  étape doit traduire en tokens réels, jamais copier les valeurs brutes du
  canvas.
- Recoupement avec la tâche 037 (WIP non committé, mélangé avec 044/045
  dans le même diff) : à isoler proprement avant de commencer à coder
  dessus, même technique de stash déjà utilisée avec succès dans une
  session précédente.

## Statut
`ouverte`
