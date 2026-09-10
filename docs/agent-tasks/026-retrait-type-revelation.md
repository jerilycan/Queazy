# [026] Retirer le type de question "révélation" de la sélection

## Contexte
Le type de question "révélation" (`type: 'reveal'`, icône 🖼️) — deviner une
image "énigme" avant qu'elle ne soit comparée à l'image "réponse" — n'apporte
rien selon l'utilisateur, comparé aux autres types de devinette déjà
disponibles (zoomguess, recherche, halo...). À retirer de la sélection de
types proposée pour une NOUVELLE question.

**Piège de nommage à ne PAS confondre** (repéré en exploration) : il existe
DEUX choses différentes qui portent le mot "reveal" dans le code :
1. Le TYPE de question "reveal" lui-même (`q.type === 'reveal'`,
   `q.enigmeImage`/`q.reponseImage`) — celui visé par cette tâche.
2. La fonctionnalité générique "Après la révélation" (`revealImage`/
   `revealAudio`/`revealPos`/`revealBg`, tâches 017/018) — image/son de
   révélation optionnels, disponibles pour TOUS les types de question (QCM,
   Vrai/Faux, etc.), sans rapport avec le type "reveal" — **PAS concernée
   par cette tâche**, ne pas y toucher.

## Objectif
Un créateur de quiz ne peut plus choisir "🖼️ Révélation" en créant une
NOUVELLE question (retiré de la grille de choix de type dans l'éditeur).

**Décision de périmètre proposée ici, à valider/ajuster** : retrait
"doux", pas de purge complète —
- Les quiz déjà sauvegardés contenant une question de type "reveal"
  continuent de s'afficher, se jouer et se scorer normalement (aucune
  régression pour du contenu existant, aucune migration de données).
- Cette question reste éditable telle quelle dans l'éditeur si on la
  rouvre (champs énigme/réponse toujours visibles/fonctionnels) — seule la
  possibilité d'en CRÉER une nouvelle disparaît.
- Alternative plus radicale (purge complète : retirer tout le code
  serveur/client lié + traiter les questions "reveal" déjà existantes en
  base) **non retenue par défaut** — bien plus risqué (casse le contenu
  existant sans migration), à ne faire que si explicitement demandé.

## Périmètre
- Retirer "reveal" de la grille de choix de type pour une NOUVELLE question
  (`renderTypePicker`, éditeur) — sans retirer l'`<option>` correspondante
  de `#qType` lui-même (nécessaire pour qu'une question "reveal" déjà
  existante continue à s'afficher/s'éditer correctement si on la rouvre).
- Documentation/tuto : ne plus présenter "Révélation" comme un type
  disponible dans "Comment jouer ?"/l'aide, si elle y est listée.

## Hors périmètre
- La fonctionnalité générique "Après la révélation" (`revealImage`/
  `revealAudio`/`revealPos`/`revealBg`, tâches 017/018) — voir piège de
  nommage ci-dessus, aucun rapport, ne pas toucher.
- Toute migration/suppression des questions "reveal" déjà présentes dans
  des quiz sauvegardés ou dans `bank_questions` — hors périmètre par
  défaut (voir décision ci-dessus).
- Le moteur de jeu (`server/index.js`, `client/public/js/index.js`) qui
  fait encore tourner une question "reveal" existante — laissé intact,
  aucune modification.
- Retrait des assets (`client/public/img/tuto/reveal.gif`) — laissé en
  place (encore potentiellement référencé pour une question existante),
  sauf si son retrait est explicitement demandé plus tard.

## Fichiers concernés
- `client/public/editor.html` — `<option value="reveal">🖼️ Révélation
  </option>` dans `#qType` (~L.314) : gardée en place (voir périmètre),
  mais marquée d'une façon exploitable par `editor.js` pour l'exclure de la
  grille de choix (ex. attribut `data-` dédié, ou liste d'exclusion codée
  en dur côté JS — à trancher au plan).
- `client/public/js/editor.js` — `renderTypePicker()` (~L.809, source de
  vérité actuelle = TOUTES les `<option>` de `#qType` sans distinction) :
  doit désormais exclure "reveal" de la grille générée, sans toucher au
  reste du comportement de `#qType`.

## Plan

Points explorés avant de proposer ce découpage :
- `renderTypePicker()` (~L.809) reconstruit la grille de tuiles UNE SEULE
  fois (garde `childElementCount`) à partir de `[...qType.options]` — un
  simple `if (type === 'reveal') return` dans le `forEach` suffit à
  l'exclure de la création d'une NOUVELLE question, sans toucher au reste.
- **Découverte en explorant `qType.onchange` (~L.4154), qui change le
  périmètre initialement pressenti** : `#qType` n'est PAS qu'un affichage
  passif du type déjà choisi — c'est aussi le mécanisme pour CHANGER le
  type d'une question EXISTANTE (choisir "reveal" dans ce menu déroulant,
  sur n'importe quelle question déjà créée, la retype en "reveal" tout de
  suite). Retirer "reveal" seulement de la grille de tuiles (choix initial)
  laisserait donc une porte dérobée grande ouverte : ce menu déroulant
  permettrait quand même de créer indirectement une nouvelle question
  "reveal" en changeant le type de n'importe quelle autre question.
  -> l'`<option value="reveal">` doit rester dans le DOM (question "reveal"
  déjà existante toujours affichable/éditable, voir Objectif) mais devenir
  **invisible dans la liste déroulée SAUF quand c'est déjà le type de la
  question active** — synchronisé dynamiquement à chaque question
  chargée dans l'éditeur, pas un simple retrait statique dans le HTML.
- Attribut HTML choisi : `hidden` sur l'`<option>` (pas `disabled` ni un
  retrait/réinjection du nœud) — un `<option hidden>` déjà sélectionné
  reste affiché normalement dans le select FERMÉ (donc une question
  "reveal" existante s'affiche toujours correctement comme "🖼️
  Révélation"), seule la liste DÉROULÉE le masque — exactement le
  comportement voulu, sans avoir à retirer/réinjecter le nœud DOM à chaque
  changement de question. `editor.html` n'a donc PAS besoin d'attribut
  `data-` dédié : toggle géré entièrement en JS via une petite fonction
  appelée aux mêmes 2 points que `qType.value = q.type` (voir ci-dessous),
  même patron que `qDraftToggle`/`addToBankCheckbox` (tâche 026 bis).
- Seuls 2 points assignent réellement `qType.value` dans tout le fichier
  (`selectQuestion` ~L.2366, et la branche de rechargement après
  suppression de la question active ~L.4374) — les autres occurrences de
  `qType.value` sont des LECTURES (comparaisons dans `qType.onchange`),
  pas des points de chargement à couvrir.
- Aucune zone des "Interdictions" du `CLAUDE.md` n'est concernée.

Étape unique (les deux volets — grille de tuiles ET menu déroulant — sont
nécessaires ENSEMBLE pour fermer complètement la création, les découper en
deux livrerait un état intermédiaire encore contournable) :

1. **`client/public/js/editor.js`** :
   - `renderTypePicker()` : `if (type === 'reveal') return` dans la boucle
     `forEach`, avant la construction de la tuile — "reveal" n'apparaît
     plus dans la grille de choix d'une nouvelle question.
   - Nouvelle petite fonction `syncRevealOptionAvailability(q)` : récupère
     `qType.querySelector('option[value="reveal"]')` une fois (hors de la
     fonction, comme les autres consts de champs), pose `.hidden =
     q?.type !== 'reveal'` à chaque appel.
   - Appelée juste après `qType.value = q.type || 'free'` aux 2 points de
     chargement identifiés ci-dessus (`selectQuestion`, rechargement post-
     suppression).
   - Aucun changement dans `qType.onchange` lui-même : une fois qu'une
     question a déjà `type: 'reveal'` et que l'option est donc visible
     pour elle, la resélectionner ne fait rien de neuf (déjà ce type) ;
     une fois qu'on change VERS un autre type, l'option redevient masquée
     au prochain chargement de question (ou immédiatement si on veut être
     strict — à vérifier lors du test manuel, pas bloquant si elle ne se
     recache qu'au rechargement suivant, cas rare en pratique).

2. **Vérification en direct** (Browser pane) : ouvrir l'éditeur (avec un
   compte réel, pas de contournement d'auth possible ici) —
   - Créer une nouvelle question via la grille de tuiles : "🖼️ Révélation"
     absente.
   - Sur une question EXISTANTE d'un autre type, ouvrir le menu déroulant
     "Type de réponse" : "🖼️ Révélation" absente de la liste.
   - Si un quiz de test contient déjà une question "reveal" (à créer au
     besoin AVANT cette étape, en committant temporairement un accès
     direct ou en demandant à l'utilisateur un lien de quiz existant) :
     l'ouvrir, confirmer qu'elle s'affiche/s'édite normalement (type bien
     affiché "🖼️ Révélation", champs énigme/réponse fonctionnels).

## Étapes réalisées
- [x] 1. `renderTypePicker()` exclut "reveal" + `syncRevealOptionAvailability()`
      masque/affiche dynamiquement l'`<option>` dans `#qType` selon le type
      de la question active, appelée aux 2 points de chargement.
- [x] 2. Vérification en direct.

## Checks effectués
- [x] `node --check client/public/js/editor.js` — passe.
- [x] **Bug trouvé ET corrigé en cours de route** : `qTypeRevealOption =
      qType.querySelector(...)` avait été placé AVANT la déclaration de
      `const qType`, une erreur de zone morte temporelle
      (`ReferenceError: Cannot access 'qType' before initialization`) qui
      aurait fait planter TOUT l'éditeur au chargement. Repéré via les logs
      de la vérification en direct (voir juste en dessous), pas par
      relecture seule — déplacé après `const qType = ...`.
- [x] **Vérification en direct** (Browser pane) : l'éditeur exige un vrai
      compte connecté (aucun accès invité), impossible à tester en conditions
      réelles sans entrer d'identifiants (interdit). À la place, la logique
      EXACTE du fichier (copiée telle quelle, pas retranscrite) a été
      exécutée dans une page de test isolée servie par le serveur local
      (nettoyée après coup) :
  - Grille de choix (type neuf) : `["free","mcq","halo"]` — "reveal" bien
    absent (testé avec 4 options dont "reveal", 3 restantes).
  - Question active type "mcq" : option "reveal" `hidden: true` dans le
    menu déroulant (ne peut plus être choisie pour retyper cette question).
  - Question active DÉJÀ type "reveal" : option `hidden: false`, valeur du
    select toujours "reveal" — reste affichable/éditable normalement.
  - Piège de service worker (déjà rencontré plus tôt dans la session) :
    la page de test servait une version EN CACHE de son propre script au
    premier chargement (fonctions `undefined`) — confirmé et contourné par
    `serviceWorker.getRegistrations()/unregister()` + `caches.keys()/delete()`
    avant de recharger.

## Tests manuels recommandés
Avec un vrai compte : ouvrir l'éditeur, cliquer "+" pour ajouter une
question — confirmer que "🖼️ Révélation" n'apparaît plus dans la grille.
Sur une question existante d'un autre type, ouvrir le menu déroulant "Type
de réponse" — confirmer son absence là aussi. Si un quiz existant contient
déjà une question "reveal" (sinon impossible à re-créer pour tester,
volontairement), l'ouvrir et vérifier qu'elle s'affiche/s'édite normalement
(type bien affiché, champs énigme/réponse fonctionnels), et qu'elle reste
jouable normalement en partie.

## Risques restants
- Non vérifié dans le vrai éditeur avec un vrai compte (voir Checks) — la
  logique testée est EXACTEMENT celle du fichier livré, mais l'intégration
  réelle (chargement d'un quiz existant, tuiles avec icônes/couleurs
  réelles, interaction souris) n'a pas pu être rejouée en conditions
  réelles faute d'accès à un compte.
- Si un jour une question "reveal" doit être retypée par son propriétaire
  (ex. la convertir en "free"), rien ne l'en empêche (`qType.onchange`
  inchangé) — cohérent avec l'objectif ("moteur de jeu laissé intact"),
  mais à garder en tête si quelqu'un s'attend à ce que le type reste figé.

## Statut
`en review`
