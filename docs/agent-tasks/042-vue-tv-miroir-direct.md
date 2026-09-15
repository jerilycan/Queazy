# [042] Vue TV/vidéoprojecteur en miroir direct du centre MJ

## Contexte
Deuxième tentative sur ce besoin — les tâches 040 ("Vue Joueur dédiée
TV/vidéoprojecteur") et 041 (suite : fix zoomguess + intro/classement/
podium/logo) ont été entièrement **rollback** (retour utilisateur :
"complètement buguée" — voir `git show 6fe72b4`/`git show 97a5f7b` pour le
code original, `git show 8926de5:docs/agent-tasks/041-vue-joueur-tv-completude.md`
pour le cahier des charges détaillé d'origine, toujours consultable via
l'historique git bien que le fichier ait été supprimé du tree par le
revert).

Root cause probable du bug (diagnostiquée en reprenant la tâche, à
confirmer en exploration) : l'ancienne implémentation **réimplémentait**
le rendu de chaque type de question dans un script séparé
(`display.js`) — seuls 3 types sur 17 (QCM/Vrai-Faux/Intrus) avaient un
rendu dédié, les 14 autres un repli minimal (prompt + image seule), et
rien ne garantissait que cette logique dupliquée reste synchronisée avec
le rendu réel côté MJ (`index.js`). Plusieurs bugs ont d'ailleurs été
trouvés et corrigés type par type pendant la QA de la tâche 040 elle-même
(débordements, icônes qui chevauchent le texte, images cassées...) — signe
que cette approche par duplication est intrinsèquement fragile.

Nouvelle approche validée avec l'utilisateur (voir échange de cadrage) :
au lieu de réimplémenter, la fenêtre TV doit être un **miroir en direct**
du contenu déjà affiché côté MJ — éliminant le risque de divergence par
construction, et couvrant les 17 types sans code dédié par type.

## Objectif
En mode "Présenter" IRL, le MJ peut ouvrir une fenêtre séparée (2e écran /
vidéoprojecteur) qui reproduit EN TEMPS RÉEL, en plein écran, le contenu
que le MJ voit lui-même au centre de son écran pendant la partie
(question, minuteur, zone de réponse/tuiles, image, et le popup de
révélation en fin de question) — sans jamais réimplémenter cette logique
de rendu séparément. Tout le reste de l'interface MJ (classement,
contrôles hôte, bouton "Suivant", modération des réponses joueurs) reste
strictement réservé à la page du MJ.

## Périmètre
- Nouvelle page séparée `client/public/display.html` + script dédié
  `client/public/js/display.js` (page HTML propre, pas un mode caché de
  `index.html` — même esprit que `result.html`/`results.js`, déjà
  existants dans le projet pour un besoin de page séparée en lecture
  seule).
- **Miroir en direct** (mécanisme technique précis à trancher en
  `/plan-feature` — pistes : `BroadcastChannel`/`postMessage` portant le
  HTML/état du centre MJ depuis `index.js` vers `display.js`, cross-window
  DOM sync via la référence retournée par `window.open()`, ou autre) du
  contenu du centre MJ :
  - Question (énoncé, catégorie si affichée)
  - Minuteur (barre de temps)
  - Zone de réponse : tuiles/options quel que soit le type (QCM, Vrai/
    Faux, Intrus, curseur, ordre, association, timeline, etc. — TOUS les
    17 types, sans code dédié par type puisque c'est un miroir, pas une
    reconstruction)
  - Image d'illustration / image du type de question
  - Popup de révélation en fin de question (réponse en titre, explication,
    image/son)
- Rendu plein écran sur la fenêtre TV : le contenu remplit tout l'écran
  (16:9, lisible à distance), SANS la carte/panneau MJ (pas de fond/
  bordure/ombre de panneau — juste le contenu, mis en page pour occuper
  tout l'espace).
- Bouton "Mode présentation" côté MJ (`index.html`/`index.js`), visible en
  mode "Présenter" IRL, ouvrant `display.html?room=CODE` dans une fenêtre
  séparée (`window.open`) — reprend l'esprit de la tâche 040 (fenêtre
  nommée réutilisée au clic suivant, détection best-effort d'écran
  secondaire si l'API Window Management est disponible, repli simple
  sinon) sauf mention contraire du cadrage.
- Rattrapage d'état pour une fenêtre TV ouverte ou rechargée EN COURS de
  question (mêmes cas que la tâche 040 : question active / question
  révélée) — le mécanisme diffère puisque le rendu lui-même change
  d'approche (miroir plutôt que reconstruction depuis un payload), à
  concevoir en conséquence.
- Plein écran (API Fullscreen, bouton dédié dans la vue TV).

## Hors périmètre
- Le son (extrait Blind Test, son de question, son de révélation) : reste
  UNIQUEMENT sur le poste du MJ, comme dans la version précédente — pas de
  sortie audio depuis la fenêtre TV (décidé explicitement avec
  l'utilisateur, pour éviter un écho si les deux appareils sont dans la
  même pièce).
- Classement, contrôles hôte (Sélectionner/LANCER/Suivant, réglages
  ambiance/vitesse), panneau de modération des réponses joueurs : ne
  doivent JAMAIS apparaître sur la vue TV — restent exclusivement sur la
  page MJ (`index.html`).
- Mode "à distance" (`remote`) et mode "Jouer" (`roomMode === 'auto'`) —
  cette vue n'a de sens qu'en "Présenter" IRL avec MJ dédié (même
  exclusion que les tâches 039/040).
- Rendu de la carte/panneau MJ telle quelle (fond/bordure/ombre) sur la
  TV — décidé explicitement : plein écran sans ce cadre.
- Toute refonte visuelle/fonctionnelle de l'interface MJ actuelle
  au-delà de l'ajout du bouton d'ouverture et de ce que le mécanisme de
  miroir exige côté `index.js` (ex. exposer/diffuser l'état du centre —
  à détailler en plan, mais sans changer ce que le MJ voit/peut faire).

## Fichiers concernés
- `client/public/display.html` (NOUVEAU) — page dédiée, calquée sur
  `result.html` (tête allégée, `style.css`, Socket.io).
- `client/public/js/display.js` (NOUVEAU) — logique du miroir côté TV :
  réception/rendu du contenu synchronisé, plein écran, rattrapage d'état
  à l'ouverture/rechargement.
- `client/public/js/index.js` — bouton "Mode présentation" +
  `window.open()` ; mécanisme d'émission du contenu à mirrorer (le point
  précis à concevoir en plan — ex. après chaque rendu du centre MJ
  `#stageWrap`/`#main`, ou via un observer dédié).
- `client/public/index.html` — ajout du bouton lui-même (`#hostPanel`,
  comme la tâche 040).
- `client/public/css/style.css` — styles plein écran/16:9 propres à
  `display.html` (nouveau bloc scopé, comme la tâche 040) ; réutilisation
  des classes existantes (`.option-btn`, `.timer-bar-fill`,
  `.reveal-popup-*`, etc.) pour un rendu visuellement identique au MJ,
  cohérent avec le principe de miroir.
- `server/index.js` — **finalement HORS scope technique** (tranché en
  `/plan-feature`, voir Plan) : le miroir est poussé directement par la
  page MJ (déjà connectée) vers la fenêtre TV via `postMessage`, qui n'a
  donc pas besoin de sa propre connexion Socket.io ni d'un rattrapage
  serveur dédié — à rouvrir seulement si l'implémentation révèle un besoin
  imprévu.

## Vérification (obligatoire avant clôture)
En fin de tâche (dernière étape du Plan), deux sous-agents indépendants et
dédiés — pas une simple relecture manuelle — doivent valider le résultat,
chacun avec un mandat précis :
1. **Agent "conformité au besoin"** — vérifie en direct (Browser pane, vraie
   salle) que l'implémentation répond exactement à l'Objectif/Périmètre
   ci-dessus : miroir fidèle du centre MJ pour les 17 types (pas de repli
   minimal caché), popup de révélation reflété, AUCUN élément hors
   périmètre qui fuite sur la vue TV (classement, contrôles hôte,
   modération, son), rattrapage d'état correct à l'ouverture/rechargement
   en cours de question.
2. **Agent "design / responsive"** — vérifie spécifiquement la qualité
   visuelle de la vue TV, indépendamment du fonctionnel : les éléments
   (question, tuiles, image, minuteur) doivent occuper l'espace
   disponible de façon équilibrée — **remplir les zones vides plutôt que
   laisser un rendu clairsemé/perdu dans l'écran**, tout en restant
   soigné (pas de surdimensionnement grossier pour "remplir" au prix de
   la lisibilité/cohérence). À tester à plusieurs tailles/ratios de
   fenêtre (l'utilisateur ouvre une fenêtre de navigateur, pas forcément
   un 1920×1080 exact) — capture d'écran à l'appui pour chaque cas
   vérifié.
Les deux agents rapportent leurs écarts ; ceux-ci sont corrigés avant de
considérer la tâche `clôturée`.

## Plan
Aucune "Interdiction" du CLAUDE.md concernée (pas de schéma DB, pas de
`render.yaml`, pas de nouvelle dépendance — `postMessage`, `MutationObserver`
et l'API Fullscreen sont natives au navigateur).

**Exploration faite avant ce plan** : `index.html` relu autour de
`#stageWrap` (contient `#questionTypeBadge`, `#timerContainer`, `#main`
avec `#question`/`#illustrationImgWrap`/`#inputArea`/`#irlAnswerRecap`) et
de `#revealPopupOverlay`/`#revealPopupCard` — **élément séparé, PAS
imbriqué dans `#stageWrap`** (contient aussi `#revealAudioPlayer`, un
`<audio>`, à exclure explicitement du miroir — voir étape 4). Timer
confirmé à 10 rafraîchissements/seconde (`setInterval(..., 100)`, ligne
~7293 `index.js`). `server/index.js` relu : la branche `viewer:true` de
`room:join` est revenue à son état pré-040 (pas de rattrapage d'état) après
le rollback.

**Décision structurante (résout le point "à réévaluer" côté serveur)** :
contrairement à la tâche 040 (qui dérivait le rendu depuis les payloads
socket bruts, nécessitant un rattrapage serveur dédié), le nouveau miroir
est **poussé directement depuis la page MJ déjà connectée** — la fenêtre TV
n'a donc PAS besoin de sa propre connexion Socket.io, et **`server/index.js`
n'a besoin d'AUCUNE modification** : le rattrapage d'état à l'ouverture/
rechargement de la fenêtre TV se fait par une poignée de main direct
MJ↔TV (étape 3), pas par le serveur. Fichiers concernés mis à jour en
conséquence (server/index.js retiré du périmètre technique, sauf découverte
contraire en cours d'implémentation).

1. **`display.html` + `display.js` — squelette minimal.** Nouvelle page
   calquée sur `result.html` (tête allégée : `style.css` + polices, pas de
   confetti/profil/navbar/pwa.js/theme.js/supabase). `display.js` : lit
   `?room=` de l'URL (affichage informatif seulement, la vraie liaison se
   fait via `window.opener`, pas via Socket.io — voir étape 3), affiche un
   état "En attente du MJ…" par défaut. **Aucune connexion Socket.io** dans
   ce fichier (différence clé avec la tâche 040 et avec `results.js`).
   *Étape isolée, testable seule (page vide qui charge sans erreur).*

2. **`index.js` — bouton "Mode présentation" + ouverture fenêtre.** Reprend
   la mécanique déjà conçue et testée en tâche 040 (`git show
   6fe72b4:client/public/js/index.js` pour référence) : `window.open()`
   **synchrone** dans le gestionnaire de clic (pas d'`await` avant — bug
   réel trouvé et corrigé en 040, à ne pas réintroduire), fenêtre nommée
   `queazy-display` (clics répétés réutilisent la même fenêtre), détection
   best-effort d'écran secondaire (`window.getScreenDetails`) qui
   repositionne la fenêtre déjà ouverte en tâche de fond si accordée,
   bouton visible uniquement en mode "Présenter" IRL (`gameMode==='irl' &&
   roomMode!=='auto'`, même garde que `isPresenterHost()`).
   *Étape isolée, testable seule (clic ouvre bien `/display.html?room=CODE`).*

3. **`index.js`/`display.js` — protocole de synchronisation (le cœur
   technique).**
   - Host (`index.js`) : garde la référence `displayWin` retournée par
     `window.open()` (étape 2). Fonction `pushDisplayMirror()` : si
     `displayWin && !displayWin.closed`, poste
     `displayWin.postMessage({ type: 'queazy-display-sync', stageHtml:
     stageWrap.innerHTML, popupHtml: ..., popupVisible: ... }, location.origin)`
     — **`location.origin` explicite** (jamais `'*'`), les deux pages étant
     same-origin par construction.
   - Déclenchement : `MutationObserver` sur `#stageWrap` (childList +
     subtree + attributes + characterData) plutôt que d'instrumenter
     chaque site qui touche ce contenu (minuteur 10×/s, `question:show`,
     tuiles qui se révèlent, etc. — trop de points d'entrée, garantie de
     fidélité plus faible qu'un observer générique). Callback **batchée en
     `requestAnimationFrame`** (coalesce les mutations rapprochées, ex. le
     minuteur, en un seul postMessage par frame peinte).
     *Trade-off documenté : un observer générique coûte un peu plus cher
     qu'un hook ciblé, mais élimine la classe de bug qui a fait échouer la
     tâche 040 (logique de rendu dupliquée qui diverge) — accepté comme
     bon compromis vu l'historique.*
   - Rattrapage d'état (fenêtre TV ouverte APRÈS le début d'une question, ou
     rechargée par l'utilisateur) : `display.js` poste
     `window.opener.postMessage({ type: 'queazy-display-ready' },
     location.origin)` à son chargement ; `index.js` écoute les messages
     `message` dont `event.source === displayWin` et, sur
     `queazy-display-ready`, appelle `pushDisplayMirror()` immédiatement
     (pas besoin d'attendre la prochaine mutation). Couvre aussi le cas où
     le MJ recharge SA PROPRE page en pleine question : son `#stageWrap` se
     repeuple via le rattrapage existant (`room:join` reconnect, déjà en
     place, inchangé) → déclenche l'observer → repousse à la fenêtre TV
     normalement (aucune poignée de main supplémentaire nécessaire pour ce
     cas précis).
   - `display.js` : au message `queazy-display-sync`, injecte `stageHtml`
     dans un conteneur dédié (`#displayStage`) et `popupHtml`/`popupVisible`
     dans un second (`#displayPopup`), masque l'état d'attente dès la
     première réception.
   *Étape la plus dense, mais isolée du rendu visuel (étape 5) — testable
   avec de simples logs/inspection DOM avant d'investir dans le CSS.*

4. **Exclusion de l'audio du miroir.** `stageWrap.innerHTML`/
   `revealPopupCard.innerHTML` ne portent aucun `<audio>` propre (le seul,
   `#revealAudioPlayer`, vit dans `#revealPopupCard` — voir exploration) :
   avant de poster `popupHtml`, retirer explicitement tout `<audio>` du
   clone (`clone.querySelectorAll('audio').forEach(a => a.remove())`) —
   filet de sécurité explicite plutôt que de compter sur l'absence
   actuelle, pour ne jamais risquer un doublon sonore si un futur type de
   question ajoutait un `<audio>` ailleurs dans ce sous-arbre. Décision
   utilisateur : le son reste uniquement sur le poste du MJ.
   *Micro-étape, à faire en même temps que l'étape 3 (même fonction).*

5. **CSS plein écran/16:9 — mise en page TV (le cœur design).** Nouveau
   bloc scopé à `body.display-body` en fin de `style.css` (même pattern que
   la tâche 040), réécrivant la mise en page des éléments CONNUS reçus par
   id/classe (`#questionTypeBadge`, `#timerContainer`, `#question`,
   `#illustrationImgWrap`, `#inputArea`/`.options-grid`/`.option-btn`,
   `#revealPopupCard`...) pour qu'ils remplissent l'écran disponible — PAS
   la carte MJ (fond/bordure/ombre de `.stage-wrap`/`.panel` explicitement
   NON reproduits, décision utilisateur). Objectif explicite (retour
   utilisateur) : les éléments doivent occuper l'espace réellement
   disponible plutôt que rester petits/perdus au milieu d'un grand écran —
   c'est le mandat précis de l'agent "design/responsive" (voir
   "Vérification" plus haut).
   *Étape isolée, purement CSS, testable à l'œil (Browser pane) une fois le
   tuyau de l'étape 3 en place.*

6. **Plein écran dans `display.js`.** Bouton dédié, `requestFullscreen()`/
   `exitFullscreen()`, libellé mis à jour via `fullscreenchange` — reprend
   telle quelle la mécanique déjà validée en tâche 040
   (`git show 6fe72b4:client/public/js/display.js`).
   *Étape isolée, petit diff autonome.*

7. **`index.html` — bouton "🖥️ Mode présentation".** Ajout dans
   `#hostPanel`, visible dès la création de salle (pas besoin d'attendre le
   lancement du quiz) — reprend le placement de la tâche 040.
   *Étape isolée, diff HTML pur.*

8. **Vérification — Agent "conformité au besoin".** Sous-agent dédié
   (Browser pane, vraie salle IRL "Présenter") : les 17 types un par un
   (miroir fidèle, pas de repli caché puisque c'est littéralement le même
   DOM) ; popup de révélation reflété ; AUCUNE fuite d'éléments hors
   périmètre (classement/contrôles hôte/modération/son) sur la fenêtre TV ;
   rattrapage d'état vérifié (ouverture en cours de question, rechargement
   de la fenêtre TV en cours de question ET après révélation).

9. **Vérification — Agent "design/responsive".** Sous-agent dédié,
   capture d'écran à l'appui, à plusieurs tailles/ratios de fenêtre (pas
   seulement 1920×1080) : les éléments remplissent l'espace disponible sans
   paraître clairsemés, restent lisibles à distance, aucun débordement/
   scroll, cohérence visuelle avec la charte QuEazy (mêmes tokens que
   l'écran MJ). Écarts rapportés et corrigés avant `clôturée`.

## Étapes réalisées
- [x] 1. `display.html` + `display.js` — squelette minimal (page calquée sur
      `result.html` en plus léger, état "En attente du MJ…", aucune
      connexion Socket.io).
- [x] 2. `index.js` — bouton "Mode présentation" + `window.open()` synchrone
      dans le handler de clic, fenêtre nommée `queazy-display`, détection
      best-effort d'écran secondaire (`getScreenDetails`).
- [x] 3. Protocole de synchronisation MJ -> TV (`pushDisplayMirror`,
      `MutationObserver` sur `#stageWrap` + `#revealPopupOverlay`, batché en
      `requestAnimationFrame`, poignée de main `queazy-display-ready` pour le
      rattrapage d'état).
- [x] 4. Exclusion de l'audio du miroir (`stripAudioForDisplay`, filet de
      sécurité explicite appliqué à `stageHtml` ET `popupHtml`).
- [x] 5. CSS plein écran/16:9 (`body.display-body` en fin de `style.css`) —
      badge/timer repositionnés en flux normal, textes/tuiles/popup agrandis
      en `clamp()`/`vh`/`vw` pour occuper l'espace disponible, repli mobile
      `@media (max-width: 640px)`.
- [x] 6. Plein écran dans `display.js` (bouton dédié, `requestFullscreen`/
      `exitFullscreen`, libellé mis à jour via `fullscreenchange`).
- [x] 7. `index.html` — bouton "🖥️ Mode présentation" dans `#hostPanel`,
      `d-none` par défaut (visibilité pilotée en JS).
- [x] 8. Vérification — Agent "conformité au besoin" : 17/17 types testés en
      salle IRL réelle (comparaison stricte `stageWrap` MJ vs `stageHtml`
      mirroré, caractère pour caractère) — identiques, aucun repli minimal
      détecté. Popup de révélation testé en réel (`timer:end`→`question:reveal`
      réel) — contenu conforme, `<audio>` absent du mirroring dans tous les
      cas. Zéro fuite confirmée par contrôle positif (classement/modération/
      contrôles hôte réellement affichés côté MJ puis absents du payload
      mirroré) ET architecturalement (éléments frères de `#stageWrap`, jamais
      descendants). Rattrapage d'état : poignée de main `queazy-display-ready`
      vérifiée en exécution réelle (pas juste programmée) ; rechargement MJ
      en pleine question → repeuplement `#stageWrap` confirmé. Bouton "Mode
      présentation" : visibilité conforme (IRL + non-auto uniquement).
      **Aucun bug fonctionnel trouvé.** Verdict : conforme à l'Objectif/
      Périmètre.
- [x] 9. Vérification — Agent "design/responsive" : testé aux 17 types réels
      (payloads produits par le vrai `index.js`, relayés vers `display.html`
      comme `pushDisplayMirror()` le fait) à 1920×1080/1366×768/800×600/
      390×844, captures à l'appui. **Résultat non homogène** — voir
      "Risques restants" pour le détail par type/sévérité. Popup de
      révélation : bien équilibré aux 3 tailles testées. Bug badge/640px
      (étape 5) : pas de régression, aucun cas similaire trouvé sur les
      types testés. **La tâche ne peut pas être `clôturée` en l'état** —
      au moins les écarts sévères (#1/#3 ci-dessous) doivent être corrigés
      puis revérifiés.

## Checks effectués
- [x] `node --check <fichier>` sur chaque fichier JS modifié — `index.js` et
      `display.js`, OK à chaque étape (dernière passe : les deux OK après
      toutes les modifs).
- [x] Démarrage serveur vérifié — `queazy-server` (`node server/index.js`)
      démarré via le Browser pane (`preview_start`), aucune erreur dans les
      logs (`preview_logs`), serveur arrêté proprement (`preview_stop`) en
      fin de tâche.
- [x] Vérification visuelle Browser pane — voir détail dans "Tests manuels
      recommandés"/"Risques restants" ci-dessous : un vrai bug trouvé et
      corrigé (libellé du badge de type de question invisible sous 640px de
      large, hérité d'une règle média de l'écran MJ non pertinente ici).
- [x] **Repasse de vérification/correction des 5 écarts design/responsive**
      (reprise après interruption de session) — `node --check
      client/public/js/index.js` re-confirmé OK (fichier lu mais PAS modifié
      cette repasse, correctifs 100% CSS comme demandé) ; serveur
      `queazy-server` redémarré via `preview_start`, aucune erreur en log,
      arrêté proprement en fin de repasse. Salle IRL réelle créée
      (`socket.emit('room:create', {mode:'present'})`, room `Q1Y22`),
      questions réelles envoyées via `socket.emit('question:show', ...)`
      (même chemin serveur que le vrai flux hôte) pour les 17 types +
      popup de révélation + `truefalse`/`free` (régression). Miroir testé
      via une iframe pleine page (pas de vraie 2e fenêtre possible dans ce
      bac à sable, `window.open()` connu pour naviguer l'onglet courant —
      voir Risques) chargeant `display.html?room=...`, `displayWin` pointé
      dessus, `pushDisplayMirror()` réel appelé après chaque question —
      protocole de synchronisation inchangé, seul le point d'observation
      diffère de la tâche 040. Débordement vérifié par mesure DOM
      (`#displayStage.scrollHeight` vs `.clientHeight`), pas seulement à
      l'œil, à 1920×1080/1366×768/800×600 selon le type. 5/5 écarts
      corrigés-vérifiés (voir détail par écart plus haut), 3 bugs de
      débordement supplémentaires trouvés et corrigés en cours de route
      (order/timeline, blindtest, recherche/halo/indice/image). Aucune
      régression trouvée sur mcq/truefalse/free/popup de révélation
      (captures à l'appui, 1920×1080).

## Tests manuels recommandés
Techniques de test employées (2 salles simulées via `socket.emit` direct,
sans passer par l'auth — voir méthode dans la mission) et limites du bac à
sable navigateur rencontrées, à connaître avant les vérifications 8/9 :

- **`window.open()` réel non testable dans ce bac à sable** : dans le
  Browser pane utilisé pour cette passe, `window.open(url, 'queazy-display')`
  navigue l'onglet COURANT au lieu d'ouvrir une vraie fenêtre séparée (limite
  de l'environnement d'automatisation, pas un bug du code — le mécanisme est
  repris à l'identique de la tâche 040, déjà validée en conditions réelles).
  Contournement utilisé : les deux moitiés du protocole ont été vérifiées
  INDÉPENDAMMENT plutôt qu'en bout en bout :
  - Côté MJ (onglet "seed") : `displayWin` mocké par un objet
    `{ closed:false, postMessage: (data) => ... }`, question `mcq` réelle
    simulée via `socket.emit('question:show', {...})`, puis
    `pushDisplayMirror()` appelé directement (et via mutation réelle du DOM,
    qui programme bien un `requestAnimationFrame` — voir Risques) : le
    payload capturé est correct (`type: 'queazy-display-sync'`,
    `origin: location.origin`, `stageHtml` = vrai HTML du centre MJ,
    `popupVisible`/`popupHtml` corrects à l'ouverture réelle de la popup de
    révélation via un `timer:end`+`question:reveal` réel avec `explanation`
    + `revealAudio`, `<audio>` bien ABSENT du `popupHtml` malgré sa présence
    réelle dans le DOM source).
  - Côté TV (onglet séparé sur `display.html?room=TEST`) :
    `window.dispatchEvent(new MessageEvent('message', {...}))` utilisé pour
    simuler la réception d'un `queazy-display-sync` — confirme que
    `#displayWaiting` se masque, `#displayStage`/`#displayPopup` se peuplent
    et togglent leur `d-none` selon `popupVisible`.
  - **Recommandé avant clôture** : un test manuel RÉEL (vrai navigateur,
    deux fenêtres/écrans) du clic "Mode présentation" -> ouverture réelle ->
    mirroring en direct pendant une vraie partie, notamment le cas
    "rechargement de la fenêtre TV en cours de question" et "MJ recharge sa
    propre page en pleine question puis reclique Mode présentation".
- **`requestAnimationFrame` ne se déclenche jamais dans ce bac à sable**
  (`document.visibilityState` toujours `'hidden'`, limite déjà connue du
  projet — voir mémoire "Navigateur sandbox sans rAF") : confirmé que le
  `MutationObserver` programme bien l'appel (`displayMirrorRafId` non-null
  après une mutation réelle), mais le callback lui-même n'a pas pu être
  observé s'exécuter tout seul. En usage réel (onglet MJ visible/au premier
  plan), rAF se déclenche normalement à chaque frame peinte.
- **CSS (étape 5) testé à plusieurs tailles** : 390×844 (mobile portrait),
  800×600, 1280×720, 1366×600 (16:9 court), 1920×1080 (TV réelle) — aucun
  débordement horizontal, contenu centré et agrandi pour occuper l'espace
  disponible. Seul le rendu `mcq` a été vérifié visuellement en détail (avec
  et sans popup de révélation) ; les 16 autres types (graduation, ordre,
  timeline, rangement, association, image, blindtest, reveal, recherche,
  indice, halo, zoomguess, intrus, vrai/faux, petit bac, texte libre) n'ont
  PAS été vérifiés un par un visuellement — leurs conteneurs spécifiques
  (`.graduation-area`, `.order-area`, etc.) gardent leur dimensionnement de
  base (non recalculé pour la TV), conformément au périmètre de l'étape 5
  (liste explicite d'éléments "CONNUS" dans le Plan) ; c'est le mandat exact
  de l'agent "design/responsive" (étape 9) de vérifier ces 17 types un par un
  à plusieurs tailles, capture à l'appui.
- Plein écran (étape 6) : bouton cliqué, aucune erreur console (la requête
  `requestFullscreen()` peut être silencieusement refusée par le navigateur
  en contexte automatisé sans vrai geste utilisateur "de confiance" — géré
  par le `.catch(() => {})` existant, comme en tâche 040). À reconfirmer en
  navigateur réel.
- Non testé (hors portée de cette passe, nécessite un vrai environnement) :
  l'API Window Management (`getScreenDetails`) avec un vrai second écran et
  une vraie invite de permission Chrome.

## Risques restants
- Le protocole de synchronisation (étape 3/4) est vérifié CORRECT sur
  chacune de ses deux moitiés séparément (contenu généré côté MJ ; rendu côté
  TV), avec un pipeline complet observé EN EXÉCUTION réelle (mutation DOM →
  `MutationObserver` → `requestAnimationFrame` → `pushDisplayMirror` →
  `postMessage` → réception côté TV) lors de la vérification "conformité au
  besoin" (étape 8, 17/17 types testés en salle IRL réelle). Seul point
  encore hors de portée du bac à sable : une livraison `postMessage` à
  travers un VRAI `window.opener` issu d'un vrai `window.open()` cross-
  fenêtre (le sandbox navigue l'onglet courant au lieu d'ouvrir une fenêtre
  séparée — confirmé à deux reprises, y compris avec un onglet TV pré-ouvert
  pour tester la réutilisation par nom de fenêtre). **À confirmer par un
  test manuel en navigateur réel avant `clôturée`.**
- Découverte de l'étape 8 (non anticipée par le commentaire du code) :
  `#blindtestAudio` est présent en permanence dans `#stageWrap` (juste
  togglé en `d-none`), donc `stageHtml` porte un `<audio>` pour TOUS les
  types de question, pas seulement `blindtest`. `stripAudioForDisplay()`
  le gère déjà correctement dans tous les cas testés — pas un bug, mais le
  filet de sécurité décrit comme "pour un futur type" dans le code est en
  réalité déjà actif aujourd'hui.
- Bug trouvé et corrigé en cours de route (étape 5) : `.question-type-badge-label`
  était caché par une règle média de l'écran MJ (`@media (max-width: 640px)`,
  pensée pour un badge `position:fixed` qui chevauche la barre de temps) —
  restauré explicitement dans `body.display-body` où ce chevauchement n'existe
  plus (badge en flux normal, sa propre ligne). À surveiller si l'agent
  "design/responsive" découvre un cas similaire sur un autre élément hérité
  d'une media query pensée pour le layout MJ (pas audité exhaustivement).
- Dimensionnement CSS (étape 5) volontairement généreux pour occuper l'espace
  à l'échelle TV (1920×1080), mais réglé à l'œil sur UN SEUL cas (mcq à 4
  options, avec/sans popup) — l'agent "design/responsive" (étape 9) doit
  vérifier que ce même réglage reste équilibré (ni trop petit ni
  surdimensionné) pour les autres types, notamment ceux avec beaucoup de
  tuiles (association à 16 items, timeline, rangement) où `.options-grid`/
  les conteneurs spécifiques n'ont pas été retouchés.
- `#revealPopupCloseBtn` est mirroré tel quel sur la TV mais reste INERTE
  (aucun listener câblé dans `display.js`, décision volontaire documentée en
  CSS) — confirmé par l'agent "design/responsive" : se lit comme un simple
  bouton de fermeture standard, pas comme un bug visuel.

### Écarts trouvés par l'agent "design/responsive" (étape 9, à corriger avant clôture)
1. **[Élevé] `corrigé/vérifié`** — 8 types gardent leurs conteneurs
   spécifiques dans leur dimensionnement "carte MJ compacte" (`max-width`/
   polices en px fixes), jamais retouchés dans le bloc `body.display-body`
   (fin de `style.css`) — très clairsemés à 1920×1080/1366×768 :
   `graduation` (`.graduation-area`, `.grad-slider`, `.grad-value`), `order`
   (`.order-area`, `.order-list`, `.order-item`), `timeline`
   (`.timeline-area`, `.timeline-list`, `.timeline-item`), `rangement`
   (`.rangement-area`, `.rangement-zones`, `.rangement-tray`), `association`
   (`.association-area`, `.assoc-item` — pire cas, 16 tuiles regroupées sur
   ~500px sur un écran de 1920px), `blindtest`, `recherche`, `halo`,
   `indice` (`.indice-central-card`, `.indice-history-card`).
   **Repasse de vérification (reprise après interruption)** : les 9 types
   testés en salle IRL réelle (payloads `question:show` réels via le vrai
   flux serveur, `pushDisplayMirror()` réel) à 1920×1080 et 800×600 — tous
   bien remplis, aucun régression trouvée sur le dimensionnement lui-même.
   **3 bugs de débordement supplémentaires trouvés et corrigés pendant cette
   repasse** (mesure DOM `scrollHeight`/`clientHeight`, pas seulement
   visuel) :
   - `order`/`timeline` : 6 items à descriptions réalistes (~45 caractères)
     débordaient de ~96px à 1920×1080 (le réglage d'origine n'avait été
     mesuré qu'avec un contenu plus court). Corrigé en 2 passes :
     `.order-area`/`.timeline-area` élargis (1300px/78vw -> 1600px/88vw,
     supprime le retour à la ligne des descriptions) + padding/gap resserrés
     (1.5vh/1.2vh -> 0.9vh/0.8vh). Un résidu ~76px reste à 800×600
     (fenêtre volontairement extrême) où les polices sont déjà à leur
     plafond bas — absorbé par le scroll de secours de `#displayStage`
     (documenté, pas un des 5 écarts nommés).
   - `blindtest` : le ratio d'échelle des 24 barres autour de l'orbe
     (`.blindtest-orb-bars`, `transform: scale(2.39)`) faisait déborder les
     barres décoratives de ~285px de chaque côté de l'orbe (calcul
     incohérent — le commentaire prétendait reprendre le ratio 1.591 de la
     régie desktop mais utilisait 2.39), mesuré ~129px de scroll à
     1920×1080. Corrigé en revenant au VRAI ratio 1.591 de la régie desktop.
   - `recherche`/`halo` : `height: min(72vh, 880px)` du cadre débordait de
     ~147px à 1920×1080 (ne tenait pas compte du badge/timer/question
     au-dessus). Réduit à `50vh`... `indice` : `.indice-central-card` à
     `46vh` laissait ~16px de trop avec les 4 indices max affichés
     simultanément — réduit à `44vh`. Les deux mesurés SANS scroll aux 3
     tailles (1920×1080/1366×768/800×600).
2. **[Moyen] `corrigé/vérifié`** — `rangement` déborde verticalement à
   800×600 (5 zones/12 cartes, `#displayStage` doit scroller) — même cause
   racine que #1. Déjà corrigé par la passe précédente (`.rangement-zone`
   en `clamp(38px, 7vh, 130px)`) ; reconfirmé cette repasse avec le même cas
   réel (5 zones/12 cartes) à 1920×1080 ET 800×600 : `scrollHeight ===
   clientHeight` aux deux tailles, aucun scroll.
3. **[Moyen] `corrigé/vérifié`** — `intrus` déborde verticalement (scroll)
   à 1920×1080, 1366×768 ET 800×600 avec un nombre réaliste de photos (7
   testées). Cause : `body.display-body .option-btn.intrus-tile
   { min-height: 0; }` (style.css) retire le plancher mais
   `.option-btn.intrus-tile { aspect-ratio: 4/3; }` continue de dériver la
   hauteur depuis la largeur de colonne. Déjà corrigé par la passe
   précédente (`max-height: 22vh`) ; reconfirmé cette repasse avec 7 ET 8
   photos (pire cas autorisé par l'éditeur) aux 3 tailles — aucun scroll
   mesuré. (Une fausse alerte de débordement à 8 photos/800×600 est apparue
   en cours de vérification — measure DOM incohérente entre deux lectures
   successives sans aucun changement de code entre les deux, retest propre
   avec délai supplémentaire = confirmé correct ; probable artefact du bac à
   sable de test, voir note technique en fin de section.)
4. **[Moyen] `corrigé/vérifié`** — `image` (clic-sur-l'image) reste petit
   sur grand écran. Root cause RÉÉVALUÉE pendant cette repasse : ce n'est
   PAS `IMAGE_FRAME_MAX_HEIGHT` (480px, `setupImageFrame` côté MJ) le
   principal coupable comme supposé initialement — un correctif CSS
   `!important` sur `#imageWrap`/`#imageImg` (width/height:auto) avait déjà
   été écrit avant cette passe, mais restait sans effet : `.image-area`
   (règle de BASE, pensée pour la carte MJ compacte) porte son propre
   `max-width: 640px`, jamais neutralisé côté `body.display-body` — il
   plafonnait tout le sous-arbre (`#imageViewport` en hérite via son
   `width:100%`) AVANT même que le style inline de `#imageWrap` n'entre en
   jeu. Ajouté `body.display-body #imageArea { max-width: min(1700px,
   92vw); }`. Vérifié avec une photo générée (1200×700, cadre synthétique
   puisqu'aucun asset local de cette taille n'existait) : l'image remplit
   maintenant ~925×540px à 1920×1080 (contre 640×373px plafonné avant) en
   gardant EXACTEMENT son ratio, sans lettrebox. `max-height` du cadre
   également réduit (76vh -> 44vh, 2 passes) après avoir mesuré un
   débordement (~118px à 1920×1080 puis ~42px résiduel à 800×600 avec une
   photo assez grande pour toucher ce plafond) — même cause que
   recherche/halo/indice ci-dessus. Vérifié SANS scroll aux 3 tailles.
5. **[Faible / cas limite] `corrigé/vérifié`** — `zoomguess` peut
   chevaucher la question si `payload.zoom` est absent (classe `is-zoomed`
   jamais posée dans ce cas). Reproduit cette repasse (chevauchement réel
   avec le badge/minuteur/question, jusqu'à ~200px hors de son propre
   wrapper) : `#illustrationImg` garde son recadrage STATIQUE calculé par
   JS (`applyCropTransform`, index.js — hors périmètre, partagé avec l'écran
   MJ) qui lit les dimensions du wrapper pour calculer sa transform ; sans
   `.is-zoomed`, ce wrapper n'a ni ratio ni `overflow:hidden` définis, donc
   la transform peut positionner l'image hors de sa propre boîte. Fix CSS
   simple et sûr appliqué comme suggéré par le cadrage : nouvelle règle
   `body.display-body .illustration-img-wrap.zoomguess-visible:not(.is-zoomed)
   { position:relative; overflow:hidden; max-height:38vh; }` — borne le
   débordement de la transform JS à l'intérieur de sa propre zone au lieu de
   le laisser déborder sur le reste de la mise en page. Vérifié SANS
   chevauchement ni scroll à 1920×1080 ET 800×600 ; le cas normal
   (`.is-zoomed` présent, payload `zoom` renseigné) non affecté — sélecteur
   plus spécifique inchangé, reconfirmé après coup (repère cependant un
   écart mineur PRÉEXISTANT et hors périmètre : ce cas normal déborde de
   ~25px à 1920×1080 avec un `startScale` élevé — non corrigé, non lié aux
   5 écarts nommés ici, à surveiller si signalé séparément).

**Note technique (bac à sable de test)** : cette repasse s'est heurtée à
plusieurs reprises à des artefacts propres à l'environnement Browser pane
utilisé (déjà documenté en partie côté mémoire "sandbox-browser-no-raf") —
les animations CSS (`tileRevealIn`, `indiceFlipIn`, le "vol" FLIP de
`.indice-history-card`) restent parfois figées à mi-course une fois clonées
dans l'iframe miroir de test (aucun rapport avec le vrai mécanisme
`pushDisplayMirror`/`postMessage`, qui reste inchangé et déjà validé étape
8), gonflant artificiellement le `scrollHeight` mesuré tant qu'elles ne
sont pas "réglées" explicitement (`document.getAnimations().forEach(a =>
a.finish())` + neutralisation des transforms FLIP orphelins). Des lectures
isolées (scrollHeight, captures d'écran) se sont aussi révélées ponctuellement
périmées (DOM à jour mais rendu pas encore reflété) ; toute mesure suspecte a
été revérifiée à froid (rechargement complet + nouvelle capture) avant d'être
retenue comme un vrai écart.

## Statut
`en cours` — étapes 1-9 du Plan complètes (implémentation + les deux
vérifications) ; les 5 écarts de l'agent "design/responsive" sont
maintenant `corrigé/vérifié` (voir détail ci-dessus, y compris 3 bugs de
débordement supplémentaires trouvés et corrigés pendant cette repasse de
vérification). Statut volontairement laissé `en cours` — la clôture se
décide après relecture humaine de ce diff par l'utilisateur, pas
automatiquement par l'agent.
