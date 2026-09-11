# [032] Lot de 7 sujets (révélation, régie, petit bac, mobile, indice)

## Contexte
Retour utilisateur groupé, 7 sujets distincts à traiter un par un, chacun
vérifié EN DIRECT par un sous-agent dédié avant d'être considéré acquis.
Un 8e sujet (IRL : réponse visible à la révélation) est arrivé en cours de
route, en réaction directe à la tâche [031](031-irl-hide-gameplay-mj.md).

## Sujets et implémentation

### 1. Popup de révélation joueur : 10s (au lieu de 4.5s)
`REVEAL_POPUP_BASE_DELAY_MS` (`client/public/js/index.js`, dans
`socket.on('question:reveal', ...)`) : 4500 → 10000. Toujours étendue si un
son de révélation dure plus longtemps (jamais raccourcie en dessous de
10s). Fermeture manuelle (✕/clic fond) et fermeture par "Suivant" MJ (via
`clearRevealState()`, déjà appelée à chaque nouvelle question) inchangées —
déjà satisfaites par l'architecture existante. `AUTO_ADVANCE_REVEAL_DELAY_MS`
(auto-avance hôte en mode "Jouer") aligné à 10000 aussi, pour ne pas faire
apparaître le classement avant que la popup joueur ait eu le temps de
s'afficher pleinement.

### 2. Régie MJ : 3 encarts de même taille — REVENU EN ARRIÈRE
`body.is-host.game-active .container` (`client/public/css/style.css`,
`@media (min-width: 1100px)`) : `grid-template-columns: 280px minmax(0,1fr)
280px` → `1fr 1fr 1fr` essayé, puis **annulé** après retour utilisateur
avec capture d'écran à l'appui : les docks latéraux (contrôles hôte,
classement) n'avaient pas assez de contenu pour occuper un tiers plein
écran — ça laissait un vide énorme des deux côtés pendant que le centre
(le contenu réel de la question) restait comparativement étroit, l'inverse
de l'effet recherché. Le sous-agent de vérification avait pourtant repéré
ce risque ("observation annexe : colonnes latérales visuellement un peu
vides") sans le remonter comme un défaut bloquant — leçon retenue : une
observation de ce genre doit être traitée comme un signal fort, pas
juste une note en passant. Remis à `280px minmax(0, 1fr) 280px` (centre
dominant, docks à taille fixe adaptée à leur contenu) — les 3 colonnes
gardent déjà la même HAUTEUR (`align-items: stretch`), qui satisfaisait
probablement l'intention réelle du retour utilisateur.

### 3. Petit bac : réponses cachées (pas floutées) côté MJ en IRL
`.moderation-answers-hidden .moderation-answer-text` (`style.css`) :
l'ancien flou (`color:transparent` + `text-shadow`) gardait la largeur
naturelle du texte réel, donc la longueur du mot restait devinable à la
forme du flou — remplacé par un bandeau plein de largeur FIXE (96px),
indépendante du contenu réel.

### 4. Mobile joueur : barre de temps trop proche de la question
`.timer-container` (`style.css`, `@media (max-width: 640px)`) :
`margin-bottom: 40px` ajouté (au lieu des 24px symétriques par défaut),
spécifiquement sur mobile.

### 5. Révélation : réponse comme titre dans la popup + son seul sans popup
- `hasRevealExtras` renommé `hasRevealPopupContent`, sa définition exclut
  désormais `payload.revealAudio` : un son de révélation SEUL (sans
  explication ni image) ne déclenche plus l'ouverture de la popup — il
  joue directement en fond (déjà indépendant de cette variable, inchangé).
- Nouvel élément `#revealPopupAnswerTitle` dans la popup (`index.html`),
  peuplé par copie de `#revealAnswerText` (source de vérité inchangée) une
  fois toutes les branches par type passées — même miroir déjà utilisé pour
  `#revealPopupBadge`.

### 6. Typo "adéqsuates"
Vérifié dans `client/public/js/index.js:431` (texte d'intro du type
"mcq") : déjà orthographié correctement ("adéquates") dans le code actuel.
Aucune autre occurrence trouvée dans le repo. **Rien à corriger** — probable
confusion avec une version antérieure/en cache.

### 7. Type "indice" : afficher tous les indices non révélés à la fin
`socket.on('question:reveal', ...)`, branche `indice` : `updateIndiceArea(Infinity)`
ajouté — réutilise la fonction existante (condition `delayS*1000 >
elapsedMs`, jamais vraie face à `Infinity`) pour forcer l'affichage de tous
les indices encore non montrés, dans le même ordre/animation qu'en cours de
partie.

### 8. (Ajouté en cours de route) IRL : réponse visible à la révélation
Suite à [031](031-irl-hide-gameplay-mj.md) : `#inputArea` reste masqué
PENDANT la question en IRL présentateur, mais redevient visible
(`.irl-reveal-answer`, posée à `question:reveal`, retirée à la question
suivante via `clearRevealState()`) pour que le MJ revoie la réponse
(tuiles correct/incorrect, etc.) une fois les joueurs passés.

## Fichiers concernés
- `client/public/js/index.js`
- `client/public/css/style.css`
- `client/public/index.html`

## Checks effectués
- [x] `node --check client/public/js/index.js` — passe (à chaque étape).
- [x] **1/5 (popup révélation)** — sous-agent dédié, PASS sur les 3 points :
      popup ouverte 2417ms puis refermée à +10001ms (conforme à 10000ms) ;
      son seul sans explication/image ne fait jamais passer
      `#revealPopupOverlay` en visible (`revealAudioPlayer.src` bien posé
      quand même) ; `#revealPopupAnswerTitle` reprend exactement le
      contenu de `#revealAnswerText` ("Bonne réponse : X"), bandeau vert
      en haut de la popup confirmé visuellement.
- [x] **2 (3 colonnes égales) — REVENU EN ARRIÈRE** : essayé en 1fr 1fr
      1fr (validé techniquement par sous-agent, 431px chacune, aucun
      débordement), mais retour utilisateur avec capture d'écran réelle :
      vide énorme dans les docks latéraux, centre comparativement étroit.
      Remis à `280px minmax(0,1fr) 280px`, revérifié EN DIRECT
      (screenshot) — rendu équilibré, docks compacts, centre dominant.
- [x] **3 (petit bac caché)** — sous-agent dédié : bandeaux masqués mesurés
      à largeur STRICTEMENT identique (62.92px) pour "Ami" (3 lettres) et
      "Anticonstitutionnellement" (25 lettres), aucune fuite de longueur ;
      bascule "œil" (masqué ↔ visible) confirmée toujours fonctionnelle
      (largeurs redeviennent naturelles/différentes une fois révélées).
- [x] **4 (timer mobile)** — sous-agent dédié : `margin-bottom: 40px`
      confirmé à une largeur mobile, espacement visuellement amélioré.
- [x] **7 (indice, tout révéler)** — sous-agent dédié : 2 indices affichés
      avant la fin (delayS 0/2), passage à 4 indices confirmé après la
      révélation NATURELLE du minuteur serveur (delayS 50/80 inclus, qui
      n'auraient normalement jamais été atteints) — DOM et captures
      d'écran vérifiés, aucune erreur console.
- [x] **8 (IRL réponse à la révélation)** — sous-agent dédié, PASS sur les
      3 états : masqué pendant la question, `display:block` +
      `.irl-reveal-answer` à la révélation (MCQ coloré vert confirmé),
      remasqué à la question suivante (`clearRevealState()` opérationnel).

## Risques restants
- Sujet 3 : le sous-agent a repéré (hors périmètre du correctif testé,
  non modifié ici) que `moderationAnswersHidden` (init `let
  moderationAnswersHidden = gameMode === 'irl'`) est évalué au chargement
  du script, AVANT que `room:create`/`game:mode` ne confirme le vrai mode
  — la toute première question peut donc s'afficher "réponses visibles"
  par défaut au lieu de "masquées" en IRL, le temps que l'état socket
  arrive. Pas un défaut du correctif de masquage lui-même (largeur fixe
  toujours correcte une fois `moderationAnswersHidden` vrai), mais un
  angle mort d'initialisation préexistant à signaler si observé en usage
  réel.
- Sujet 2 : les colonnes latérales (hôte/classement) sont maintenant
  beaucoup plus larges (431px vs 280px) — un sous-agent a noté qu'elles
  paraissent un peu vides à cette largeur ; pas de contenu cassé, mais à
  garder en tête si un resserrement du contenu latéral est demandé ensuite.
- Sujet 1 : `AUTO_ADVANCE_REVEAL_DELAY_MS` et `REVEAL_POPUP_BASE_DELAY_MS`
  restent deux constantes séparées calculant la même logique en double
  (dette déjà documentée en tâche 029) — non retouché ici, hors périmètre.
- Sujet 5 : "réponse comme un titre" ne s'affiche QUE pour les types qui
  remplissaient déjà `#revealAnswerText` (texte libre, indice, blind test,
  pbac) — les types à tuiles (mcq, association...) n'ont pas de résumé
  textuel générique de la bonne réponse à afficher dans la popup ; le
  plateau coloré en dessous (visible une fois la popup fermée/pas ouverte)
  fait déjà cet office pour eux, comportement jugé suffisant sans
  construire un résumé texte par type supplémentaire (hors périmètre).

## Tests manuels recommandés
Tester en conditions réelles (pas seulement les scénarios synthétiques des
sous-agents) : une vraie question petit bac IRL avec plusieurs joueurs,
une vraie session régie 3 colonnes sur un grand écran de présentation, et
une question indice avec de vrais indices pour confirmer que l'animation
(pas seulement le nombre final de cartes) reste fluide en usage réel.

## Statut
`en review` — les 7 sujets (+ le 8e ajouté en cours de route) sont tous
validés PASS par sous-agent dédié.
