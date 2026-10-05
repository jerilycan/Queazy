# [037] Cohérence canvas/éditeur : disposition "Réponse + chips" pour Texte libre

## Contexte
Un canvas de design (`/design`, artifact "Éditeur de quiz — Standard /
Avancé") a servi à explorer puis trancher la disposition de la section
"Réponses acceptées" du type "Texte libre" : après comparaison de 3
propositions, la disposition retenue est "Réponse principale + variantes en
chips" (un grand champ "Réponse correcte" mis en avant, puis un accordéon
repliable "Variantes acceptées" en chips/pastilles). Ce choix n'existe pour
l'instant que dans le canvas (artboards `Free.dc.html`/`FreeAvance.dc.html`)
— l'éditeur réel de l'application (`client/public/editor.html` +
`editor.js`) affiche encore l'ancienne liste simple `#correctList`
(`renderCorrects()`), qui reste éditable/supprimable ligne par ligne mais
sans le traitement "réponse principale + chips" décidé.

Un deuxième point ("Ajouter à la banque" / Catégorie / Difficulté) a été
soulevé pendant le cadrage informel en conversation : vérification faite,
ce bloc est DÉJÀ un élément global partagé dans `editor.html` (pas dupliqué
par type), donc déjà cohérent pour tous les types de question — mentionné
ici pour mémoire, mais ne semble pas nécessiter d'implémentation (à
reconfirmer en `/plan-feature`, notamment côté rendu banque/admin, avant de
le considérer clos).

## Objectif
1. ~~L'éditeur réel de "Texte libre" affiche la même disposition que le
   canvas retenu (chips)~~ — FAIT (voir Étapes réalisées), mais l'utilisateur
   est revenu dessus après coup : la disposition finalement retenue est
   l'option 3 du canvas ("Liste + réglages de tolérance"), pas l'option 2
   ("Réponse + chips") déjà livrée. **La liste de chips reste** (elle
   couvre "réponse correcte + orthographes alternatives"), mais on y
   ajoute :
   - un réglage de **tolérance orthographique** à 3 niveaux — Stricte
     (correspondance exacte, accents/casse ignorés seulement), Souple
     (identique au comportement actuel du serveur, 20% de la longueur de
     la réponse en distance de Levenshtein — AUCUNE régression si le
     champ est absent, c'est la valeur par défaut), Très souple (35%) ;
   - un **testeur** ("Tester une réponse") qui simule en direct, dans
     l'éditeur, si une saisie correspondrait à une réponse acceptée compte
     tenu du niveau de tolérance choisi (pastille ✓/✗).
2. Confirmer explicitement (sans forcément coder quoi que ce soit) que
   "Ajouter à la banque"/Catégorie/Difficulté sont bien cohérents entre le
   canvas et l'application réelle pour tous les types.
3. Une vérification indépendante (sous-agent dédié, en fin de tâche)
   confirme la cohérence canvas ⇄ rendu réel avant clôture.

## Périmètre
- Remplacer l'UI de `#correctList`/`renderCorrects()` par la disposition
  "réponse principale + chips" — **uniquement pour le type `free`**
  ("Texte libre"), sans casser les 5 autres types qui réutilisent
  actuellement le même `#correctSection`/`#correctList`
  (`zoomguess`, `reveal`, `recherche`, `indice`, `halo` — voir
  `client/public/js/editor.js` ligne ~2846) : soit en isolant un bloc
  dédié à `free` à côté du bloc partagé existant (repris tel quel pour les
  5 autres types), soit toute autre approche qui ne change PAS le rendu
  des 5 autres types.
- CSS ajouté en reprenant fidèlement les classes du canvas
  (`.main-answer-input`, `.chip-list`, `.chip`, `.chip-remove`,
  `.chip-add-input`, badge de compte) — voir `Free.dc.html`/
  `FreeAvance.dc.html` sur l'artifact
  https://claude.ai/code/artifact/44801ee6-88f3-4c2d-a8c0-e346d7fb85d4
  (le récupérer via l'outil Artifact, action "read", ou le helper
  d'extraction du skill `/design` si besoin du HTML/CSS exact) comme
  référence à adapter au design system réel de `style.css`, pas à copier
  tel quel (tokens différents entre le canvas et l'app réelle).
- Le modèle de données `q.correct` (tableau de chaînes) ne change pas — la
  "réponse correcte" mise en avant est `q.correct[0]`, les "variantes" sont
  `q.correct.slice(1)` (ou toute autre convention équivalente à documenter
  dans le plan) : pas de nouveau champ côté quiz/serveur a priori.
- **Nouveau (revirement utilisateur, option 3 du canvas retenue au lieu de
  l'option 2)** : ajouter, dans `#correctFreeSection` (à côté de la liste de
  chips déjà livrée), un réglage de tolérance orthographique à 3 niveaux
  (Stricte/Souple/Très souple — Souple = comportement serveur actuel par
  défaut) et un champ "Tester une réponse" avec pastille ✓/✗ qui simule
  cette comparaison en direct dans l'éditeur. Nouveau champ
  `q.answerTolerance` (chaîne, ex. `'stricte'|'souple'|'tresSouple'`,
  absent/`'souple'` = comportement actuel) lu côté serveur UNIQUEMENT pour
  moduler `fuzzy()` sur la branche `free`/partagée — voir Fichiers
  concernés et Plan.
- Vérifier/confirmer (sans forcément modifier) la cohérence "Ajouter à la
  banque"/Catégorie/Difficulté entre canvas et app réelle pour tous les
  types.
- Prévoir, en fin de tâche, une vérification par un sous-agent dédié
  (lecture seule) qui compare le canvas et le rendu réel de l'éditeur
  (Texte libre en tout cas, et un passage sur les autres types) et rapporte
  les écarts restants — même esprit que les vérifications "confirmé par
  sous-agent indépendant" déjà utilisées dans d'autres tâches de ce
  dossier.

## Hors périmètre
- Les 5 autres types qui partagent `#correctSection`/`#correctList`
  (`zoomguess`, `reveal`, `recherche`, `indice`, `halo`) : le canvas n'a
  tranché QUE pour "Texte libre" — pas de bascule vers la disposition
  chips/tolérance pour eux dans cette tâche. Important : la tolérance
  reste, elle aussi, PROPRE à `free` (nouveau champ lu uniquement pour ce
  type — les 5 autres gardent le comportement serveur actuel, inchangé,
  tant qu'ils n'envoient pas ce champ).
- Toute modification du canvas de design lui-même (déjà à jour, publié).
- Le toggle Standard/Avancé du canvas (n'existe pas côté app réelle, voir
  constat dans le Plan) — cette tâche ne le construit pas.
- Modification de `render.yaml`/`supabase/schema.sql` (le nouveau champ de
  tolérance vit dans le JSON de la question, comme `q.correct`/`q.hints` —
  pas de colonne dédiée, donc pas de migration).

## Fichiers concernés
- `client/public/editor.html` — structure de `#correctSection` (fait) +
  nouveau contrôle de tolérance (segmented control 3 valeurs) et champ
  "Tester une réponse" avec pastille ✓/✗ dans `#correctFreeSection`.
- `client/public/js/editor.js` — `renderCorrects()` (~ligne 2927, inchangé
  pour les 5 autres types), `toggleTypeSections()` (~ligne 2846, fait),
  `populateFreeAnswer`/`renderFreeVariantChips` (fait) + nouvelle logique
  de tolérance/testeur (dupliquer `norm`/`lev`/le calcul de seuil du
  serveur — même principe que `computeCropGeometry`, déjà dupliqué entre
  `editor.js`/`index.js` dans ce projet, pas de module partagé).
- `client/public/css/style.css` — classes chips (fait) + nouvelles classes
  segmented control tolérance + pastille testeur (inspirées de
  `.tolerance-switch`/`.tolerance-switch-btn`/`.test-pill` du canvas,
  `FreeDispoTolerance.dc.html` — supprimé du canvas depuis, à relire via
  l'historique de versions de l'artifact si besoin, ou reconstruire à
  l'identique du même esprit que `.mode-switch` déjà présent).
- `server/index.js` — **touché cette fois** : `fuzzy()` (ligne ~890) gagne
  un 3e paramètre optionnel `tolerance` qui remplace le facteur fixe 0.2
  par 0 (stricte) / 0.2 (souple, défaut si absent — AUCUNE régression) /
  0.35 (très souple) ; le seul call site à qui passer `q.answerTolerance`
  est celui de la branche générique free/zoomguess/reveal/recherche/indice
  (ligne ~2337, `fuzzy(payload?.content || '', q.correct)` →
  `fuzzy(payload?.content || '', q.correct, q.answerTolerance)`) — l'autre
  call site (blindtest titre/artiste, ligne ~2019, via `evalField`) n'est
  PAS concerné, ne pas y toucher.

## Plan

**Constat d'exploration important (impacte le périmètre)** : l'éditeur réel
n'a AUCUN concept de mode "Standard/Avancé" aujourd'hui (`grep` sur
`advanced-pill`/`mode-switch`/`isAdvanced` : zéro résultat dans
`editor.html`/`editor.js`). Le toggle Standard/Avancé du canvas est une
exploration de design pour une fonctionnalité à part, pas encore construite
côté app réelle. Cette tâche ne construit donc PAS ce toggle — seule la
disposition "réponse + chips" de la section Réponses acceptées est portée,
sans notion de mode (le nouveau bloc est simplement toujours visible pour
le type `free`, comme le reste du panneau aujourd'hui). Si l'utilisateur
veut aussi le toggle Standard/Avancé lui-même, ce sera une tâche séparée
(gros chantier transverse à tous les types).

Autre confirmation : `#correctSection`/`renderCorrects()` est bien partagé
par 6 types (`free`, `zoomguess`, `reveal`, `recherche`, `indice`, `halo` —
voir `toggleTypeSections()` ligne ~2846) ; `q.correct` reste un tableau de
chaînes pour tous, `createInputRow` (ligne ~4470) gère déjà l'édition/
suppression ligne par ligne pour ces 5 types-là — rien à changer pour eux.
`FREE_MAX_ANSWERS = 8` (ligne 271) plafonne déjà le nombre total de
réponses acceptées ; réutilisé tel quel comme plafond "réponse principale +
variantes" (donc 7 variantes max).

1. **CSS (`client/public/css/style.css`)** — ajouter les classes de la
   disposition chips, en reprenant les noms du canvas mais les *tokens*
   déjà présents dans ce fichier (`--color-accent`, `--color-accent-rgb`,
   `--color-surface`, `--color-surface-2`, `--color-border`,
   `--color-text-muted`, `--tile-green`/`--tile-green-rgb`, `--radius-md`,
   `--radius-lg`, `--space-md` — vérifiés existants, mêmes noms que le
   canvas) : `.main-answer-input`, `.count-badge`, `.chip-list`, `.chip`,
   `.chip-remove`, `.chip-add-input`. Pas de générique "accordéon" partagé
   dans l'app réelle (contrairement au canvas) : ajout de 2-3 règles ciblées
   pour CE bloc uniquement (tête cliquable + corps + chevron rotatif) plutôt
   qu'un composant générique pour un seul point d'usage (CLAUDE.md — pas
   d'abstraction inutile).
   *Étape isolée, diff pur CSS, aucun risque fonctionnel.*

2. **HTML (`client/public/editor.html`)** — ajouter un nouveau bloc
   `#correctFreeSection` (juste à côté de l'actuel `#correctSection`,
   `d-none` par défaut) : label + `<input>` "Réponse correcte" mis en
   avant, puis une tête d'accordéon "Variantes acceptées (orthographes
   alternatives)" + badge de compte + corps (liste de chips + champ
   d'ajout). `#correctSection` lui-même n'est PAS modifié (reste utilisé
   tel quel par les 5 autres types).
   *Étape isolée, diff HTML pur, rien n'est encore branché en JS donc rien
   ne peut casser l'existant à ce stade.*

3. **JS — références DOM + `toggleTypeSections()`** (`editor.js`) :
   - Ajouter les constantes DOM du nouveau bloc (input réponse principale,
     bouton accordéon, corps, chevron, liste de chips, badge, champ
     d'ajout) à côté des constantes existantes (ligne ~268-275).
   - `toggleTypeSections()` (ligne ~2846) : retirer `'free'` de la
     condition qui affiche `correctSection`, et ajouter le toggle du
     nouveau `correctFreeSection` (visible uniquement si `qType.value ===
     'free'`).
   *Étape isolée : à ce stade le nouveau bloc s'affiche pour "Texte libre"
   mais reste vide (pas encore peuplé) — visible immédiatement en review,
   utile pour valider le placement/style avant de brancher la logique.*

4. **JS — logique du composant** (`editor.js`) :
   - `populateFreeAnswer(q)` : pose la valeur de l'input "Réponse
     correcte" (`q.correct[0] || ''`), initialise l'état plié/déplié de
     l'accordéon des variantes (déplié si `q.correct.length > 1`, sinon
     replié — repris de l'esprit du canvas, adapté au cas où il n'y a
     encore aucune variante), et appelle `renderFreeVariantChips(q)`.
   - `renderFreeVariantChips(q)` : reconstruit la liste de chips à partir
     de `q.correct.slice(1)` (bouton × par chip → `q.correct.splice(idx+1,
     1)` puis re-render), met à jour le badge de compte.
   - Handler sur l'input "Réponse correcte" : écrit dans `q.correct[0]`
     (créant le tableau si besoin, comme le fait déjà `renderCorrects`
     ailleurs).
   - Handler sur le champ d'ajout de variante (Entrée, ou un petit bouton
     "+") : si `q.correct.length >= FREE_MAX_ANSWERS`, même message d'erreur
     que `addCorrectBtn` ("Maximum 8 réponses acceptées") ; sinon
     `q.correct.push(value.trim())` + vide le champ + re-render.
   - Handler sur la tête d'accordéon : bascule l'état plié/déplié (variable
     module `let freeVariantsOpen`, dans le même style que les autres
     drapeaux d'état transitoires déjà présents dans ce fichier — pas
     persisté sur `q`, purement visuel).
   - Brancher `populateFreeAnswer(q)` aux 3 points où le panneau se peuple
     entièrement pour une question : `selectQuestion` (ligne ~2701, à côté
     de `renderCorrects()`), `deleteQuestionAt` (ligne ~4747, idem), et la
     branche `qType.value === 'free'` de `qType.onchange` (ligne ~4644,
     après le `renderCorrects()` existant — les deux fonctions cohabitent,
     chacune gérant son propre bloc, aucune des deux ne doit s'exécuter
     "à vide" pour le mauvais type donc un simple garde `if (q.type !==
     'free') return` en tête de `populateFreeAnswer`/`renderFreeVariantChips`
     suffit).
   - `validateQuestion` (ligne ~4976, "au moins une réponse acceptée pour
     free/indice") : aucun changement — lit déjà `q.correct` génériquement,
     reste valable avec la nouvelle UI.
   *Étape la plus dense (logique + branchements), mais chaque bloc
   (lecture, ajout, suppression, accordéon) reste un diff local et
   testable indépendamment ; à valider en un seul passage vu les
   dépendances croisées entre l'input principal et la liste de variantes.*

**Reprise après livraison (revirement utilisateur)** : les étapes 1-4
ci-dessus sont FAITES et poussées (voir Étapes réalisées). L'utilisateur est
ensuite revenu sur le choix de disposition — option 3 du canvas ("Liste +
réglages de tolérance") au lieu de l'option 2 déjà livrée. La liste de
chips reste ; les étapes 6-9 ci-dessous AJOUTENT la tolérance + le
testeur par-dessus, sans revenir sur 1-4.

6. **Serveur (`server/index.js`)** — `fuzzy(input, answers, tolerance)` :
   remplacer `const thresh = Math.max(1, Math.floor(y.length * 0.2))`
   (ligne ~910) par un facteur dépendant de `tolerance` :
   `{ stricte: 0, souple: 0.2, tresSouple: 0.35 }[tolerance] ?? 0.2` (le
   `?? 0.2` couvre `undefined`/valeur inconnue = comportement actuel,
   aucune régression pour les quiz existants ou les 5 autres types qui
   n'envoient jamais ce champ). `stricte` (facteur 0) donne `thresh =
   Math.max(1, 0) = 1` avec la formule `Math.max(1, ...)` actuelle — *à
   corriger* : lever le plancher `Math.max(1, ...)` à `tolerance ===
   'stricte' ? 0 : Math.max(1, ...)` pour qu'une correspondance stricte
   soit vraiment exacte (distance 0), pas "1 caractère toléré". Un seul
   call site à adapter (ligne ~2337, branche générique
   free/zoomguess/reveal/recherche/indice) : `fuzzy(payload?.content ||
   '', q.correct, q.answerTolerance)`. Le call site blindtest (ligne
   ~2019, `evalField`) n'est PAS touché.
   *Seule étape qui touche `server/index.js` (fichier CLAUDE.md signale
   comme monolithe à rayon d'impact large) — diff minimal et localisé
   (une ligne de formule + un paramètre optionnel en plus), mais à relire
   avec attention avant de pousser ; touche la logique de notation réelle
   du jeu, pas seulement l'éditeur.*

7. **CSS (`style.css`)** — classes du segmented control de tolérance
   (repris du canvas : `.tolerance-panel`, `.tolerance-switch`,
   `.tolerance-switch-btn`(+`.active`)) et de la pastille testeur
   (`.test-answer-row`, `.test-pill`(+`.match`/`.no-match`)) — mêmes
   tokens réels que l'étape 1 (pas ceux du canvas). Le canvas source
   exact (`FreeDispoTolerance.dc.html`) a été retiré de l'artifact après
   le choix de l'option 2 — reconstruire dans le même esprit que
   `.mode-switch`/`.mode-switch-btn` déjà présents (segmented control),
   pas besoin de le récupérer depuis un historique de version.
   *Étape isolée, diff CSS pur.*

8. **HTML + JS — contrôle de tolérance et testeur** (`editor.html` +
   `editor.js`) :
   - HTML : dans `#correctFreeSection`, sous la liste de chips, un petit
     panneau "Règles de correspondance" avec le segmented control (3
     boutons Stricte/Souple/Très souple) + une ligne "Tester une réponse"
     (`<input>` + pastille).
   - JS : `q.answerTolerance` par défaut `'souple'` si absent (créé au
     premier accès, comme `q.correct`) ; handlers des 3 boutons du
     segmented control (mettent à jour `q.answerTolerance` + la classe
     `.active`) ; dupliquer côté client les fonctions pures `norm`/`lev`
     du serveur (copier-coller assumé, même principe que
     `computeCropGeometry` déjà dupliqué entre `editor.js`/`index.js` —
     pas de module partagé dans ce projet) pour calculer, à chaque frappe
     dans le champ testeur, si la saisie matche `q.correct` avec le seuil
     du niveau actuel — pastille ✓ (verte) / ✗ (rouge) / neutre (champ
     vide), même logique de seuil que l'étape 6 (à garder EXACTEMENT
     synchronisée avec le serveur, sinon le testeur mentirait sur ce qui
     sera réellement accepté en jeu).
   *Étape dense (nouvelle logique de correspondance dupliquée
   client-side) mais autonome — ne touche à rien de ce qui existe déjà
   (chips, branchements des étapes 1-4).*

9. **Vérification indépendante (sous-agent dédié, lecture seule)** —
   une fois les étapes 6-8 posées : lancer un sous-agent qui (a) relit le
   diff réel (`server/index.js`/`editor.html`/`editor.js`/`style.css`),
   et (b) rapporte tout écart de fond — en particulier : le seuil
   "stricte" est-il bien 0 (pas 1, voir le piège `Math.max(1, ...)` noté
   à l'étape 6) ? le testeur côté éditeur donne-t-il EXACTEMENT le même
   verdict que le serveur pour les 3 niveaux (mêmes fonctions `norm`/
   `lev`, même formule de seuil) ? les 5 autres types partageant la
   branche serveur générique (zoomguess/reveal/recherche/indice/halo)
   sont-ils bien inchangés en comportement (n'envoient jamais
   `answerTolerance`, donc retombent sur `souple`) ? — sans corriger
   lui-même, juste un rapport à traiter avant de clôturer la tâche. Même
   esprit que les vérifications "confirmé par sous-agent indépendant"
   déjà utilisées dans ce dossier (voir tâche 036).

## Étapes réalisées
- [x] Étape 1 — CSS chips
- [x] Étape 2 — HTML `#correctFreeSection`
- [x] Étape 3 — DOM refs + `toggleTypeSections()`
- [x] Étape 4 — logique du composant (populate/render/handlers + branchements)
- [x] Étape 5 (devenue étape 9) — vérification sous-agent indépendant,
      1er passage (chips seules) : cohérent, rien à corriger.
- [x] Étape 6 — serveur : `fuzzy()` + tolérance à 3 niveaux
- [x] Étape 7 — CSS tolérance/testeur
- [ ] Étape 8 — HTML + JS contrôle de tolérance et testeur
- [ ] Étape 9 — vérification sous-agent indépendant, 2e passage (tolérance
      + testeur)

## Checks effectués
- [x] `node --check client/public/js/editor.js` (OK après chaque étape 1-4)
- [ ] Vérification visuelle Browser pane (client touché) : type "Texte
      libre" affiche bien réponse principale + accordéon de variantes ;
      les 5 autres types partageant `#correctSection` (zoomguess, reveal,
      recherche, indice, halo) inchangés. **Non fait par l'agent** (pas
      d'accès Browser pane dans ce contexte d'exécution) — à faire par
      l'utilisateur avant de pousser.
- [x] Relecture manuelle du diff (`git diff` sur les 3 fichiers touchés)
- [x] Vérification sous-agent dédié (1er passage, chips) : cohérent, rien
      à corriger (aucun écart de fond ; seule divergence de nommage
      assumée : `.count-badge` du canvas → `.auto-accordion-count` réel
      déjà existant, réutilisation en fait voulue par le canvas lui-même).
- [x] `node --check server/index.js` après l'étape 6 — OK.
- [x] Démarrage serveur vérifié (`node index.js` dans `server/`, port
      alternatif car 3000 déjà occupé par un autre process local) —
      `"Server listening at http://0.0.0.0:3999"` sans exception, process
      arrêté après vérification (obligatoire par CLAUDE.md pour toute modif
      serveur).
- [ ] Vérification manuelle que le testeur (client) et `fuzzy()` (serveur)
      donnent le même verdict sur au moins un cas par niveau de tolérance
      (ex. une faute de frappe à 1 caractère : refusée en "stricte",
      acceptée en "souple"/"très souple").
- [ ] Vérification sous-agent dédié, 2e passage (tolérance + testeur,
      étape 9).

## Tests manuels recommandés
- Créer une question "Texte libre" neuve : la réponse principale se
  remplit, l'accordéon Variantes reste replié tant qu'aucune variante
  n'est ajoutée.
- Taper une variante + Entrée : elle apparaît en chip, le badge de compte
  s'incrémente, le champ se vide.
- Supprimer une chip (×) : elle disparaît, le badge se décrémente.
- Ajouter 7 variantes (+ la réponse principale = 8) : la 8e variante
  refuse avec le message d'erreur existant.
- Changer de type puis revenir sur "Texte libre" (et re-sélectionner la
  question dans la sidebar) : la réponse principale et les variantes
  déjà saisies sont bien restituées (pas de perte de données).
- Sauvegarder le quiz, recharger la page, rouvrir la question : les
  données persistent identiques (le format `q.correct` n'a pas changé
  côté serveur/Supabase).
- Vérifier les 5 autres types (zoomguess/reveal/recherche/indice/halo) :
  liste `#correctSection` inchangée, ajout/suppression de ligne toujours
  fonctionnels.
- Créer une réponse "Canberra" en tolérance Stricte, tester "canberra"
  (accent/casse différents seulement) → ✓ ; tester "Canbera" (1 lettre en
  moins) → ✗. Repasser en Souple, retester "Canbera" → ✓. Repasser en Très
  souple, tester une faute plus grosse ("Canbeurra") → ✓.
- Jouer réellement une question "Texte libre" avec tolérance "Stricte" et
  taper une réponse avec une petite faute de frappe : doit être refusée
  (le serveur, pas seulement l'éditeur) — confirme que `q.answerTolerance`
  est bien transmis et lu jusqu'au bout (emitQuestion → payload → fuzzy()).

## Risques restants
- Pas de nouvelle dépendance, pas de changement de schéma Supabase, pas de
  `render.yaml` touché — aucune des interdictions du CLAUDE.md n'est
  concernée par ce plan. `server/index.js` EST touché (étape 6) — pas une
  interdiction, mais le fichier que CLAUDE.md signale comme monolithe à
  rayon d'impact large : diff minimal, à relire avec attention avant de
  pousser, et `npm start` à vérifier obligatoirement.
- Le toggle Standard/Avancé du canvas n'existe pas côté app réelle et
  n'est PAS construit par cette tâche (voir constat en tête du Plan) — à
  garder en tête pour ne pas être surpris que le reste du panneau "Texte
  libre" ne bouge pas au-delà de la section Réponses acceptées.
- État plié/déplié de l'accordéon purement transitoire (variable module,
  pas persistée) : redevient replié par défaut après un rechargement de
  page, comme le reste de l'état d'édition non sauvegardé de cet éditeur —
  cohérent avec l'existant, à confirmer que ça ne surprend pas à l'usage.
- Risque principal à surveiller : la logique de seuil DUPLIQUÉE
  client(testeur)/serveur(jeu réel) doit rester rigoureusement
  synchronisée (mêmes fonctions `norm`/`lev`, même mapping de tolérance,
  même correctif du plancher `Math.max(1, ...)` pour "stricte") — sinon le
  testeur donnerait un faux sentiment de sécurité au créateur du quiz.

## Statut
`en cours`
