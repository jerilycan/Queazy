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
1. L'éditeur réel de "Texte libre" affiche la même disposition que le
   canvas retenu : un champ "Réponse correcte" mis en avant + un accordéon
   de chips "Variantes acceptées", avec ajout (Entrée) et suppression (×)
   par variante — comportement équivalent à l'actuel (les réponses
   acceptées restent une simple liste de chaînes côté modèle/serveur, rien
   ne change pour le jeu/la comparaison de réponse).
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
  chips pour eux dans cette tâche (peut faire l'objet d'une tâche
  ultérieure si décidé).
- Toute modification du canvas de design lui-même (déjà à jour, publié).
- Toute nouvelle option de tolérance orthographique / testeur de réponse
  (dispositions explorées puis écartées lors du choix sur le canvas — non
  retenues).
- Modification de `render.yaml`/`supabase/schema.sql`.
- `server/index.js` : a priori non concerné (le format `q.correct` ne
  change pas) — à confirmer en `/plan-feature`, pas à supposer réglé ici.

## Fichiers concernés
- `client/public/editor.html` — structure de `#correctSection` : à
  restructurer pour distinguer un bloc "Texte libre" (réponse + chips) du
  bloc partagé existant (les 5 autres types).
- `client/public/js/editor.js` — `renderCorrects()` (~ligne 2927),
  `toggleTypeSections()` (~ligne 2846, condition qui affiche
  `correctSection`), et les constantes DOM `correctSection`/`correctList`/
  `correctLabel` (~ligne 268-275) : nouvelle logique d'affichage/état pour
  le bloc "Texte libre" (réponse principale + chips, accordéon
  ouvert/fermé, ajout/suppression de variante).
- `client/public/css/style.css` — nouvelles classes pour la disposition
  chips (inspirées de `.main-answer-input`/`.chip-list`/`.chip`/
  `.chip-remove`/`.chip-add-input` du canvas), à harmoniser avec les
  tokens déjà en place dans ce fichier (pas ceux du canvas, qui a sa
  propre palette de maquette).
- `server/index.js` — a priori pas touché (format `q.correct` inchangé) ;
  à confirmer en `/plan-feature`.

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

5. **Vérification indépendante (sous-agent dédié, lecture seule)** —
   une fois les étapes 1-4 posées : lancer un sous-agent qui (a) relit
   `Free.dc.html`/`FreeAvance.dc.html` sur l'artifact
   https://claude.ai/code/artifact/44801ee6-88f3-4c2d-a8c0-e346d7fb85d4
   (action "read"), (b) relit le diff réel (`editor.html`/`editor.js`/
   `style.css`), et (c) rapporte tout écart de fond entre les deux
   (classes/structure manquantes, comportement différent de l'accordéon,
   plafond de variantes non respecté, régression sur les 5 autres types
   partageant `#correctSection`) — sans corriger lui-même, juste un
   rapport à traiter avant de clôturer la tâche. Même esprit que les
   vérifications "confirmé par sous-agent indépendant" déjà utilisées dans
   ce dossier (voir tâche 036).

## Étapes réalisées
- [x] Étape 1 — CSS chips
- [x] Étape 2 — HTML `#correctFreeSection`
- [x] Étape 3 — DOM refs + `toggleTypeSections()`
- [x] Étape 4 — logique du composant (populate/render/handlers + branchements)
- [x] Étape 5 — vérification sous-agent indépendant (canvas ⇄ rendu réel)

## Checks effectués
- [x] `node --check client/public/js/editor.js` (OK après chaque étape 1-4)
- [ ] Vérification visuelle Browser pane (client touché) : type "Texte
      libre" affiche bien réponse principale + accordéon de variantes ;
      les 5 autres types partageant `#correctSection` (zoomguess, reveal,
      recherche, indice, halo) inchangés. **Non fait par l'agent** (pas
      d'accès Browser pane dans ce contexte d'exécution) — à faire par
      l'utilisateur avant de pousser.
- [x] Relecture manuelle du diff (`git diff` sur les 3 fichiers touchés)
- [x] Vérification sous-agent dédié : cohérence canvas ⇄ rendu réel —
      conclusion "cohérent, rien à corriger" (aucun écart de fond ; seule
      divergence de nommage assumée : `.count-badge` du canvas →
      `.auto-accordion-count` réel déjà existant, réutilisation en fait
      voulue par le canvas lui-même — voir son commentaire interne).

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

## Risques restants
- Pas de nouvelle dépendance, pas de changement de schéma Supabase, pas de
  `render.yaml` touché — aucune des interdictions du CLAUDE.md n'est
  concernée par ce plan.
- Le toggle Standard/Avancé du canvas n'existe pas côté app réelle et
  n'est PAS construit par cette tâche (voir constat en tête du Plan) — à
  garder en tête pour ne pas être surpris que le reste du panneau "Texte
  libre" ne bouge pas au-delà de la section Réponses acceptées.
- État plié/déplié de l'accordéon purement transitoire (variable module,
  pas persistée) : redevient replié par défaut après un rechargement de
  page, comme le reste de l'état d'édition non sauvegardé de cet éditeur —
  cohérent avec l'existant, à confirmer que ça ne surprend pas à l'usage.

## Statut
`en review`
