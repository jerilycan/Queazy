# [019] Révélation en popup plein écran

## Contexte
Retour utilisateur : l'affichage de la révélation (bandeau résultat +
réponse + explication + image + son, tâches 011/017/018) empile plusieurs
blocs à la suite dans la page, aussi bien côté joueur que côté MJ —
"l'affichage est un peu catastrophique". Direction validée via `/design`
(canvas "Révélation en Popup", page "Carte qui bascule — variantes",
**Variante 1 — bascule verticale**) : une coupure plein écran, avec une
carte qui bascule en 3D (même geste que le retournement des indices, tâche
014), confettis si bonne réponse, badge rond + titre + réponse + image +
explication — **sans barre de son visible** (le son joue en fond,
automatiquement).

Décisions produit tranchées avec l'utilisateur :
- S'applique à **tous les types de question, uniformément** — y compris
  ceux qui ont déjà un feedback visuel riche (tuiles QCM/Vrai-Faux/Intrus
  colorées, liens "association", tri "timeline", zones "rangement", points
  "image", curseur "graduation"). Ce feedback existant reste géré
  EXACTEMENT comme aujourd'hui, en dessous — la popup le masque
  temporairement pendant qu'elle est affichée, puis disparaît.
- Fermeture **automatique après ~4-5 secondes**, prolongée si un son de
  révélation plus long est en cours de lecture (jamais coupé net).

## Objectif
Le bandeau résultat + réponse + explication + image de révélation
(actuellement des blocs empilés en continu dans la page) s'affichent
désormais dans une popup plein écran animée (bascule 3D, confettis si
bonne réponse), qui se referme seule après un délai — pour TOUS les types
de question, côté joueur ET côté hôte (même DOM partagé, voir
`#stageWrap`).

## Périmètre
- **Réutilisation maximale, pas de réécriture** : les éléments existants
  (`#myResultBanner`, `#revealAnswerText`, `#revealExplanationText`,
  `#revealImageDisplayWrap`/`#revealImageDisplay`, `#revealAudioPlayer`)
  gardent leurs ids et TOUTE leur logique JS actuelle inchangée
  (`showMyResultBanner`, `revealFreeAnswer`, le bloc image/son des tâches
  017/018, `applyCropTransform`, le mute IRL/à distance de la tâche 018).
  Seul leur EMPLACEMENT dans le DOM change : ils sont déplacés à
  l'intérieur d'un nouveau conteneur popup plutôt que posés à plat dans la
  page. `#revealAudioPlayer` n'a déjà aucune barre visible aujourd'hui
  (`<audio class="d-none">`, sans `controls`) — rien à retirer là-dessus,
  juste à ne pas lui ajouter de contrôle visible dans le nouveau
  conteneur.
- **Nouveau conteneur popup** (`#revealPopupOverlay` > `#revealPopupCard`)
  : recouvre tout l'écran (`position: fixed; inset: 0`), fond radial teinté
  selon l'état (vert si correct, comme le badge — voir palette ci-dessous),
  carte centrée avec bascule 3D à l'ouverture (même famille d'animation que
  `.indice-central-card.indice-enter`/`indiceFlipIn`, tâche 014).
- **Nouveau badge rond** (✓ / ≈ / ✗) au-dessus du texte de résultat,
  couleur dérivée du MÊME état que `.my-result-banner.is-correct` /
  `.is-incorrect` / `.is-close` déjà calculé aujourd'hui — pas de nouvelle
  logique de détermination d'état, juste un élément visuel en plus piloté
  par la même classe.
- **Confettis** si la réponse du joueur courant est correcte
  (`myAnsweredCorrectlyThisQuestion`) : réutiliser tel quel l'appel déjà en
  place dans `client/public/js/results.js` (`window.confetti({
  particleCount: 150, spread: 80, origin: { y: 0.55 } })`, bibliothèque
  déjà chargée dans `index.html`) — pas de nouvelle bibliothèque, pas de
  nouveau réglage de confettis inventé.
- **Ouverture/fermeture** : la popup s'ouvre au début du traitement de
  `question:reveal` (avant que les branches spécifiques à chaque type ne
  peuplent le contenu) et se ferme automatiquement après un délai — délai
  de base ~4.5s, prolongé pour attendre la fin du son de révélation si
  `payload.revealAudio` est présent et plus long (jamais coupé net,
  jamais raccourci non plus en dessous du délai de base).
- Le feedback visuel déjà en place pour les types à tuiles/zones/liens
  (QCM, Vrai/Faux, Intrus, Association, Timeline, Image, Rangement,
  Graduation, Order, Blind Test) **n'est pas modifié** — juste
  temporairement masqué par la popup pendant qu'elle est affichée, exactement
  comme décidé.

## Hors périmètre
- Pas de bouton pour fermer la popup manuellement avant la fin du délai
  (décision : fermeture automatique uniquement, pas d'action hôte requise).
- Pas de nouvelle logique de calcul de correct/incorrect/proche — la popup
  affiche l'état déjà calculé par le code existant, elle ne le recalcule
  jamais.
- Pas de confettis pour l'hôte (n'a jamais de réponse personnelle) ni de
  variante "toute la salle a bien répondu" — simple réutilisation du
  déclencheur déjà utilisé en fin de partie (`results.js`).
- Pas de retouche des deux autres variantes du canvas de design (bascule à
  plat, pioche de cartes) — seule la Variante 1 est implémentée.

## Fichiers concernés
- `client/public/index.html` — nouveau conteneur `#revealPopupOverlay` /
  `#revealPopupCard` (+ badge), déplacement des éléments existants à
  l'intérieur.
- `client/public/css/style.css` — nouvelles classes du conteneur popup,
  du badge, de l'animation de bascule 3D et du fond teinté par état ;
  retrait des règles qui positionnaient les anciens blocs à plat dans le
  flux de la page (`.reveal-answer`, `.my-result-banner`,
  `.reveal-explanation`, `.reveal-media-img-wrap` restent, mais leur
  contexte de mise en page change).
- `client/public/js/index.js` — ouverture de la popup au début de
  `socket.on('question:reveal', ...)`, fermeture différée à la fin
  (délai de base + prolongation son), déclenchement des confettis,
  nettoyage dans `clearRevealState()` (déjà le point de nettoyage
  existant pour tous les éléments de révélation).

## Plan
1. **Markup** : dans `index.html`, créer `#revealPopupOverlay` (caché par
   défaut) contenant `#revealPopupCard`, lui-même contenant un nouveau
   badge rond (`#revealPopupBadge` ou similaire) suivi des éléments
   EXISTANTS déplacés tels quels (`#myResultBanner`, `#revealAnswerText`,
   `#revealExplanationText`, `#revealImageDisplayWrap`,
   `#revealAudioPlayer`) — mêmes ids, aucune référence JS existante à
   casser.
2. **CSS** : styles du conteneur (fond plein écran, radial-gradient teinté
   par état via une variable CSS posée sur `#revealPopupOverlay` ou une
   classe d'état), de la carte (bascule 3D à l'ouverture, même famille que
   `indiceFlipIn`), du badge (cercle coloré selon l'état, réutilise les
   couleurs déjà utilisées par `.my-result-banner.is-*`).
3. **JS — orchestration** : dans `socket.on('question:reveal', ...)`
   (`index.js`), ouvrir la popup tout en haut du handler (avant les
   branches par type, qui continuent de peupler `#myResultBanner` etc.
   exactement comme aujourd'hui) ; à la toute fin du handler, calculer le
   délai de fermeture (base ~4.5s, étendu à la durée de
   `#revealAudioPlayer` + petite marge si elle est plus longue et connue à
   ce moment — sinon garder le délai de base) et programmer la fermeture.
   Déclencher les confettis à l'ouverture si `myAnsweredCorrectlyThisQuestion`
   est vrai à ce moment (recalculé/disponible comme aujourd'hui).
4. **Nettoyage** : `clearRevealState()` (déjà le point qui nettoie
   `revealExplanationText`/`revealImageDisplayWrap`/`revealAudioPlayer`)
   cache aussi `#revealPopupOverlay` et annule un éventuel minuteur de
   fermeture encore en attente (reconnexion/nouvelle question pendant que
   la popup précédente était censée se refermer).
5. **Checks** : `node --check client/public/js/index.js` ; démarrage
   `npm start` ; vérification visuelle Browser pane de ce qui est
   vérifiable sans session authentifiée (structure DOM/CSS, absence
   d'erreur console) — comme pour les tâches 017/018, la partie
   interactive réelle (vraie partie, vrai confetti, vrai minuteur) reste à
   tester par l'utilisateur connecté, à documenter clairement dans le
   fichier de suivi plutôt que faussement validée.

## Étapes réalisées
1. **Markup** (`client/public/index.html`) : `#myResultBanner`,
   `#revealAnswerText`, `#revealExplanationText`,
   `#revealImageDisplayWrap`/`#revealImageDisplay`, `#revealAudioPlayer`
   retirés de leur emplacement à plat (juste après `#freeText`/`#answer`) et
   déplacés tels quels (mêmes ids, aucun attribut changé) dans un nouveau
   conteneur `#revealPopupOverlay` (`d-none` par défaut) > `#revealPopupCard`
   > `#revealPopupBadge` (nouveau badge rond, `d-none` par défaut, placé en
   premier enfant) + les 5 éléments existants. Placé en sibling de
   `#questionIntroOverlay`/`#leaderOverlay`, juste avant ce dernier, hors du
   flux de `#stageWrap`. `#revealAudioPlayer` reste sans attribut `controls`.
2. **CSS** (`client/public/css/style.css`) : nouveau bloc juste après
   `.reveal-media-img` (avant `.log-message`) —
   - `.reveal-popup-overlay` : `position: fixed; inset: 0; z-index: 1600`
     (au-dessus de `.question-intro-overlay`, z-index 1500), flex centré,
     fond `radial-gradient` sombre neutre par défaut, variantes
     `.is-correct`/`.is-incorrect`/`.is-close` (teinte verte/rouge/jaune via
     `--tile-green-rgb`/`--color-danger-rgb`/`--tile-yellow-rgb`, classes
     posées sur l'overlay en miroir de `.my-result-banner.is-*`).
   - `.reveal-popup-card` : carte centrée (`max-width` 560px), bascule 3D à
     l'ouverture via `.popup-enter` + `@keyframes revealPopupFlipIn`
     (`rotateX`, nouvelle classe/keyframes dédiées — même famille que
     `.indice-central-card.indice-enter`/`indiceFlipIn` mais bascule
     VERTICALE distincte, pas de partage de classe), `prefers-reduced-motion`
     géré. Marges `margin-top` des blocs réutilisés remises à 0 dans ce
     contexte (`gap` du flex column fait l'espacement à la place).
   - `.reveal-popup-badge` : cercle 64px, couleur neutre par défaut,
     `.is-correct`/`.is-incorrect`/`.is-close` reprennent les mêmes couleurs
     que `.my-result-banner.is-*`.
3. **JS — orchestration** (`client/public/js/index.js`) :
   - Nouvelles constantes DOM `revealPopupOverlay`/`revealPopupCard`/
     `revealPopupBadge` (à côté des autres refs `reveal*`).
   - `openRevealPopup()`/`closeRevealPopup()` (nouvelles fonctions, juste
     avant `clearRevealState`) + `revealPopupCloseTimer` (minuteur en
     attente).
   - `socket.on('question:reveal', ...)` : `openRevealPopup()` appelé juste
     après `isModerationPending = false; hideModerationWait()`, donc AVANT
     toutes les branches par type. À la toute fin du handler (après la
     dernière branche `blindtest` et le bloc `playSound`/`vibrate`/
     `hostPhase`) : lecture de l'état déjà posé sur `#myResultBanner`
     (`is-correct`/`is-incorrect`/`is-close`) reportée sur
     `#revealPopupOverlay` + `#revealPopupBadge` (✓/≈/✗) ; confettis
     (`window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.55 }
     })`, réglages identiques à `results.js`) si `!isHost &&
     myAnsweredCorrectlyThisQuestion` ; calcul du délai de fermeture (base
     4500 ms, étendu à `revealAudioPlayer.duration*1000 + 500ms` si connue
     et plus longue) et `setTimeout` de fermeture.
4. **Nettoyage** : `clearRevealState()` appelle `closeRevealPopup()` en tout
   premier (annule le minuteur en attente + cache l'overlay) — couvre le cas
   limite "reconnexion pile pendant la fermeture programmée d'une popup
   précédente" (`clearRevealState` est déjà appelé à `leaderboard:show` et à
   la reconnexion/refresh, avant toute nouvelle question).
5. **Checks** : voir section suivante.

**Confirmation couverture de TOUTES les branches par type** (risque
principal identifié) : relecture ligne par ligne du handler
`socket.on('question:reveal', ...)` (`client/public/js/index.js`, ~6851 à
~7100) — un seul bloc `if/else if` couvre, dans l'ordre : `mcq`/`truefalse`/
`intrus` (tuiles), `free`/`zoomguess`/`reveal`/`recherche`/`indice` (texte
libre), `pbac`, `graduation`, `order`, `association`, `timeline`,
`rangement`, `image`, `blindtest` — soit TOUS les types de question du
projet. Vérifié qu'aucune branche ne contient de `return` ou de sortie
anticipée (recherche `return` sur toute la plage du handler : aucune
occurrence) — chaque branche retombe donc systématiquement sur le code
commun de fin de handler (son/vibration, `hostPhase`, badge/confettis/
minuteur de fermeture), qui s'exécute donc à chaque révélation, quel que
soit le type. `openRevealPopup()` en tout début de handler est, lui,
inconditionnel (avant le premier `if`) — s'exécute donc aussi pour tous les
types sans exception.

## Checks effectués
- `node --check client/public/js/index.js` → OK, aucune erreur de syntaxe.
- `node --check server/index.js` → OK (fichier non modifié par cette tâche,
  vérifié par prudence).
- Serveur local démarré via le Browser pane (`preview_start` sur la config
  `queazy-server` de `.claude/launch.json`, port 3000) → boot sans erreur
  (`preview_logs` niveau erreur : aucune trouvée).
- Navigation sur `index.html?room=TEST` sans session authentifiée (page de
  jeu, pas l'éditeur) : aucune erreur console (`read_console_messages`,
  `onlyErrors: true` → "No console logs").
- Vérification structurelle du DOM via `javascript_tool` (pas de screenshot
  possible dans cet environnement — onglet du Browser pane toujours
  "hidden", voir limitation déjà connue/consignée pour ce projet) :
  - `#revealPopupOverlay` présent, `class="d-none"` par défaut,
    `getComputedStyle(...).display === 'none'` confirmé.
  - `#revealPopupCard` bien imbriqué dans `#revealPopupOverlay`.
  - `#revealPopupBadge`, `#myResultBanner`, `#revealAnswerText`,
    `#revealExplanationText`, `#revealImageDisplayWrap`,
    `#revealAudioPlayer` tous bien imbriqués dans `#revealPopupCard`.
  - `#revealAudioPlayer` confirmé SANS attribut `controls`.
- Vérification visuelle "à la main" (classes forcées via `javascript_tool`
  pour simuler un état `is-correct`, sans passer par une vraie révélation
  socket.io) : `getComputedStyle` confirme `position: fixed`, `inset: 0`,
  `z-index: 1600`, fond `radial-gradient(... rgba(57, 255, 136, 0.35) ...)`
  (teinte verte de `--tile-green-rgb` bien appliquée), carte avec
  `border-radius: 24px` et fond dégradé (`--gradient-card`), badge
  `border-radius: 50%` avec fond vert et texte "✓" — cohérent avec le design
  attendu. État remis à `d-none` ensuite, serveur de test arrêté
  (`preview_stop`).
- **Non vérifié en conditions réelles** (nécessite une vraie session
  authentifiée + une vraie partie multijoueur, hors de portée de cet agent —
  même limitation que les tâches 017/018, voir CLAUDE.md) : déclenchement
  réel de `socket.on('question:reveal', ...)` en jeu, animation de bascule
  3D jouée par le navigateur (impossible à observer, onglet toujours caché
  dans cet environnement — voir limitation "sandbox sans rAF" déjà
  consignée), timing réel du minuteur de fermeture (4.5s / prolongation son),
  vrais confettis déclenchés par une bonne réponse en jeu, comportement côté
  hôte (IRL et à distance) avec une vraie partie, cas limite de reconnexion
  pile pendant une fermeture programmée.

## Correctif post-review (v2)
Retour utilisateur : tout le monde (hôte ET joueurs) doit pouvoir fermer la
popup manuellement avant la fin du délai automatique — via une croix dédiée
ou en cliquant en dehors de la carte — et fermer doit couper le son en
cours, pas juste masquer la popup pendant qu'il continue de jouer.
- `index.html` : bouton `#revealPopupCloseBtn` (✕) ajouté en haut à droite
  de `#revealPopupCard`.
- `style.css` : `.reveal-popup-close-btn` — même principe que
  `.illustration-remove-btn` (cercle sombre translucide), en plus grand
  pour rester facile à toucher sur une carte plus large.
- `index.js` : `closeRevealPopup()` met maintenant `revealAudioPlayer` en
  pause en plus de cacher l'overlay. Deux écouteurs câblés une seule fois
  (pas à chaque ouverture) : clic sur `#revealPopupCloseBtn`, et clic sur
  `#revealPopupOverlay` lui-même (garde `e.target === revealPopupOverlay`,
  même pattern que les popups de recadrage existantes côté éditeur — un
  clic sur le contenu de la carte ne ferme pas). `node --check` → OK.

## Correctif post-review (v3)
Retour utilisateur : pour les types dont la révélation est déjà parlante en
soi via un feedback spatial affiché directement sur le plateau (Rangement,
Association, Timeline, Image, Graduation, Order — cartes/liens/points/
curseur qui passent au vert/rouge en place), la popup générique (juste un
badge + "Bonne réponse !"/"Presque !") cachait ce feedback pour peu de
valeur ajoutée. Décision : elle ne s'ouvre plus INCONDITIONNELLEMENT pour
ces 6 types — seulement s'il y a un vrai contenu à montrer dedans
(explication/image/son ajoutés à cette question précise), qui lui n'est
visible nulle part ailleurs. Les autres types (mcq/truefalse/intrus,
free/pbac/indice/blindtest/reveal/recherche/zoomguess) gardent le
comportement inchangé (popup toujours ouverte).
- `index.js` : `REVEAL_SPATIAL_FEEDBACK_TYPES` (Set) + `hasRevealExtras`
  (`payload.explanation || payload.revealImage || payload.revealAudio`) →
  `shouldOpenRevealPopup`, calculé tout en haut du handler
  `question:reveal`. `openRevealPopup()` conditionné dessus ; le badge/fond
  teinté et le minuteur de fermeture (fin du handler) aussi, pour ne pas
  laisser d'état/minuteur sur une popup jamais ouverte. Les confettis
  restent INDÉPENDANTS de cette bascule (décoratifs, ne cachent rien du
  plateau) — une bonne réponse "Rangement" déclenche toujours les
  confettis même sans popup. `node --check` → OK.

## Correctif post-review (v4, remplace le v3)
Le gating par type (v3) réglait le symptôme (popup "vide" pour Rangement)
mais créait une autre incohérence : QCM/Vrai-Faux/Intrus ont exactement le
même souci (tuiles déjà parlantes une fois colorées) et étaient pourtant
restés dans le "toujours ouvrir". Nouvelle direction, plus simple et plus
cohérente : la popup s'ouvre à nouveau **inconditionnellement pour tous les
types**, mais montre le texte de résultat déjà NUANCÉ que chaque branche
calcule (aucune nouvelle logique) :
- `association` → "Presque ! X/Y associations correctes (+N points)"
- `timeline` → "Presque ! X/Y bien placés (+N points)"
- `rangement` → "Presque ! X/Y bien rangées (+N points)"
- `image`/`graduation` → "Presque ! +N points"
- `mcq` (plusieurs bonnes réponses) → "Presque ! X/Y bonnes réponses (+N
  points)"
- tous les autres types → "Bonne réponse !"/"Mauvaise réponse" (déjà le cas)

Ce texte, déjà posé sur `#myResultBanner` par `showMyResultBanner()`
(inchangé), est donc maintenant réellement VU par le joueur au lieu d'être
calculé pour rien. À la fermeture (auto ou manuelle), le plateau déjà
coloré en dessous (tuiles/cartes/liens/points/curseur — calculé en même
temps, juste masqué derrière la popup entre-temps) redevient visible sans
code supplémentaire. Décision produit qui accompagne ce choix : pas
d'effort particulier pour ajouter un résumé texte détaillé (liste
carte-par-carte, mini-carte de zone...) pour Rangement/Image — le texte
nuancé + le plateau après fermeture suffisent ; l'explication/image/son
restent disponibles pour ces types mais peu d'intérêt à les utiliser en
pratique dessus (retour utilisateur), rien de spécial à coder pour ça.
- `index.js` : retrait de `REVEAL_SPATIAL_FEEDBACK_TYPES`/`hasRevealExtras`/
  `shouldOpenRevealPopup` (introduits en v3) — `openRevealPopup()` de
  nouveau inconditionnel en tête du handler `question:reveal`, badge/fond
  teinté et minuteur de fermeture de nouveau inconditionnels en fin de
  handler. `node --check` → OK.

## Correctif post-review (v5, affine le v4)
Retour utilisateur : ne pas afficher la popup s'il n'y a aucune explication
(ni image/son) écrite par le MJ sur cette question — plus besoin de la
coupure plein écran s'il n'y a rien "en plus" à montrer. Question posée en
retour avant d'implémenter : pour les types SANS feedback visuel sur le
plateau (texte libre, indice, blind test, pbac...), la popup était le SEUL
endroit montrant le bandeau résultat/réponse — réponse retenue : le
bandeau (`#myResultBanner`/`#revealAnswerText`) sort de la popup et reste à
plat dans la page, TOUJOURS visible, que la popup s'ouvre ou non.
- `index.html` : `#revealAnswerText`/`#myResultBanner` déplacés hors de
  `#revealPopupOverlay`, remis à leur emplacement d'origine (juste après
  `#freeText`/`#answer`). La popup ne contient plus que le badge +
  l'explication + l'image + le son.
- `style.css` : règle `margin-top: 0` scoping revue (ne s'applique plus
  qu'à `.reveal-explanation`/`.reveal-media-img-wrap`, plus à
  `.reveal-answer`/`.my-result-banner` qui ont quitté le conteneur).
- `index.js` : `hasRevealExtras = !!(payload.explanation ||
  payload.revealImage || payload.revealAudio)` calculé tout en haut du
  handler `question:reveal`, remplace le gating par type de la v3.
  `openRevealPopup()`, le badge/fond teinté et le minuteur de fermeture
  sont maintenant conditionnés dessus. Les confettis restent
  INDÉPENDANTS (décoratifs, ne cachent rien).

## Correctif indépendant : auto-validation "Rangement" en fin de chrono
Retour utilisateur (à l'origine soupçonné comme un bug de score, en réalité
un oubli d'auto-envoi) : contrairement à "order"/"graduation"/
"association"/"timeline" (déjà auto-envoyés via `attemptAutoSubmit()` si le
joueur n'a jamais cliqué "Valider"), "rangement" en était absent — un
joueur qui plaçait des cartes sans jamais cliquer "Valider" perdait
silencieusement sa tentative (0 point, cartes non transmises), malgré un
placement partiellement/totalement correct. `index.js` : `'rangement'`
ajouté à la même branche inconditionnelle que les 4 autres types (aucune
garde de contenu nécessaire, un rangement partiel/vide reste une
soumission valide côté serveur).

## Tests manuels recommandés
- Lancer une partie de test avec plusieurs types de question (au moins un
  à tuiles comme QCM, un texte libre comme "free"/"indice", un type "riche"
  comme "association" ou "image") : la popup doit s'ouvrir à chaque
  révélation, avec le bon badge/texte/état, puis se refermer seule après
  quelques secondes, révélant le plateau déjà coloré en dessous.
- Question de révélation avec un son > 4.5s (dans la limite des 15s) :
  vérifier que la popup reste ouverte jusqu'à la fin du son, pas coupée
  net.
- Bonne réponse perso → confettis ; mauvaise réponse perso → pas de
  confettis.
- Fermeture manuelle (croix ou clic à l'extérieur de la carte) pendant
  qu'un son de révélation joue : le son doit s'arrêter net, pas continuer
  en arrière-plan popup fermée.
- Question "Rangement"/"Association"/"Timeline"/"Image" avec un résultat
  partiel (ni 100% juste, ni tout faux) : le bandeau à plat doit afficher
  le texte nuancé ("Presque ! X/Y ... (+N points)"), visible immédiatement
  (pas besoin d'attendre/ouvrir une popup).
- QCM à plusieurs bonnes réponses, résultat partiel : même vérification.
- Question SANS explication/image/son : pas de popup du tout, juste le
  bandeau résultat visible directement.
- Question AVEC une explication (même minimale) : la popup s'ouvre bien,
  contenant le badge + l'explication (+ image/son si présents) — le
  bandeau résultat reste visible en dessous, à plat.
- "Rangement" : placer 2 cartes sur 4 sans jamais cliquer "Valider", laisser
  le chrono s'écouler entièrement — la tentative doit partir automatiquement
  (score proportionnel reçu, cartes correctement placées ressortent vertes
  à la révélation), pas 0 point silencieux.
- Reconnexion pile pendant qu'une popup de révélation aurait dû se fermer
  (cas limite) : ne doit pas laisser une popup fantôme bloquée à l'écran
  à la question suivante.
- Côté hôte (IRL et à distance) : même popup, même comportement, mute du
  son toujours correct selon le mode (tâche 018).

## Risques restants
- Le handler `question:reveal` est volumineux et couvre de nombreux types ;
  le point d'ouverture/fermeture générique (tout en haut / tout en bas du
  handler) a été relu branche par branche pour confirmer qu'il couvre CHAQUE
  type sans exception (voir "Étapes réalisées" ci-dessus, confirmation
  explicite) — reste néanmoins à valider EN JEU RÉEL, l'analyse statique du
  code ne remplace pas un test en conditions réelles.
- Le délai de fermeture prolongé pour un son de révélation ne fonctionne
  que si `revealAudioPlayer.duration` est déjà connu de façon SYNCHRONE au
  moment où le délai est calculé (juste après l'appel à `.play()`) — c'est
  le comportement décrit et accepté dans le plan de la tâche ("sinon garder
  le délai de base"), mais concrètement, selon la vitesse de chargement des
  métadonnées audio du navigateur, un son long pourrait dans certains cas ne
  bénéficier QUE du délai de base (4.5s) si sa durée n'est pas encore connue
  à cet instant précis — à surveiller en test réel avec un son > 4.5s.
- Vérification interactive limitée par l'absence de session authentifiée
  pour l'agent (même limitation que les tâches 017/018) ET par
  l'impossibilité de prendre un screenshot dans cet environnement (onglet du
  Browser pane toujours "hidden" — limitation déjà connue pour ce projet) :
  la structure DOM/CSS a été vérifiée par `getComputedStyle`/JS plutôt que
  par capture visuelle. L'animation de bascule 3D et le comportement dynamique
  complet (vraie partie, vrai minuteur, vrais confettis) restent à valider
  par l'utilisateur.

## Statut
`en review`
