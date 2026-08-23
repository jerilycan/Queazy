# [006] Mode présentation — navbar masquée, logo + joueurs, vrai centrage

## Contexte
Retour utilisateur suite à la tâche 005 (layout régie) : "Catastrophe. La
navbar ne devrait pas être visible quand on lance la présentation + la
tuile centrale devrait être vraiment au centre + Rajouter le logo + les
joueurs en haut sous forme de petits cercles".

## Objectif
1. Masquer la navbar en layout régie hôte.
2. Centrer réellement la carte question (horizontalement ET verticalement).
3. Nouvel en-tête "présentation" : logo + code de salle + avatars des
   joueurs en petits cercles, à la place de la navbar.

## Périmètre
Toujours scopé à `body.is-host.game-active` + `@media (min-width:1100px)`
(même contexte que la tâche 005) — mobile/joueur inchangés.

## Fichiers concernés
- `client/public/index.html` — nouveau `<header id="presentationHeader">`.
- `client/public/css/style.css` — navbar masquée, centrage vertical de la
  grille, styles de l'en-tête, **découverte + correction d'un conflit avec
  un système préexistant** (voir ci-dessous).
- `client/public/js/index.js` — `setDisplayRoomCode()` (partagé entre 2
  affichages du code de salle), `renderHostPlayerStrip()` généralisée à
  plusieurs cibles (`.host-player-strip`).

## Découverte importante en cours de route
En vérifiant le centrage, la carte centrale n'était PAS centrée (décalée de
+130px). Cause : un système **préexistant, antérieur à la tâche 005**,
répondait déjà partiellement au même besoin ("garder le centre libre
pendant la présentation") — `#hostPanel` en `position:fixed` + `.container`
avec `margin-left:280px`, actif dès `min-width:1024px`, sur le MÊME
sélecteur `body.is-host.game-active`. Les deux systèmes (l'ancien fixe,
et la nouvelle grille CSS de la tâche 005) se marchaient dessus. Raté lors
de l'audit de la tâche 004/005 (recherché par nom de composant, pas lu le
fichier de bout en bout — cette règle vit dans une zone du fichier associée
au bouton "Récap", pas avec le reste des styles `#hostPanel`).

**Corrigé** en bornant l'ancien système à `(min-width:1024px) and
(max-width:1099.98px)` — il continue de gérer proprement l'étroite
fourchette 1024-1099px où la nouvelle grille n'est pas encore active,
plutôt que d'être supprimé.

**Deuxième bug trouvé en vérifiant** (auto-placement CSS Grid) : sans
`grid-column`/`grid-row` explicites sur `#hostPanel`, son placement dans la
grille dépendait de l'ordre/visibilité des AUTRES enfants de `.container`
(`#joinCard` notamment) — repéré en testant à la main sans repasser par le
vrai flux JS qui les masque. Corrigé en fixant `grid-column`/`grid-row`
explicitement sur les 3 éléments de la grille (hôte/carte/classement),
rendant le placement déterministe quel que soit l'état des autres enfants.

## Choix techniques
- **Logo en `<img src="/icons/queazy-wordmark.png">`**, pas une 2e copie du
  SVG de la navbar (dégradés à id répétés, référencés en interne — dupliquer
  ces id dans le document est un comportement non garanti par la spec SVG).
  Asset déjà existant dans le projet.
- **`setDisplayRoomCode(code)`** : fonction partagée, met à jour tous les
  `.display-room-code` (2 aujourd'hui : `#displayRoomCode` dans `#roomInfo`,
  `#presentationRoomCode` dans le nouvel en-tête) plutôt que dupliquer les 2
  call sites existants.
- **`renderHostPlayerStrip()` généralisée** : itère maintenant sur
  `document.querySelectorAll('.host-player-strip')` au lieu d'un seul
  `getElementById('hostPlayerStrip')` — même liste de joueurs affichée à 2
  endroits (panneau hôte + en-tête présentation) sans dupliquer la fonction.
- **`.presentation-header` sans classe `d-none`** dans le HTML, même
  raison que `.live-classement-dock` (tâche 005) : piloté entièrement par
  la media query (`display:none` par défaut, `flex` seulement en régie) —
  `.d-none` (`!important`) aurait gagné sur la media query sinon.

## Étapes réalisées
- [x] `body.is-host.game-active .navbar { display: none; }` (régie only).
- [x] `#presentationHeader` : logo + pastille "Salle CODE + avatars".
- [x] `.container` : `align-content: center` + `min-height` pour centrer
  verticalement la rangée dock/carte/dock dans l'espace libéré par la
  navbar masquée.
- [x] Ancien système `#hostPanel` fixe borné à 1024-1099.98px (au lieu de
  ≥1024px sans limite) pour ne plus entrer en conflit avec la grille ≥1100px.
- [x] `grid-column`/`grid-row` explicites sur `#hostPanel`/`#stageWrap`/
  `#liveClassementDock` — placement déterministe.
- [x] `setDisplayRoomCode()` + généralisation de `renderHostPlayerStrip()`.

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- Équilibre des accolades CSS : 1219/1219, OK.
- Vérifié en Browser pane (onglet neuf, cache + service worker vidés) à
  1400px : navbar `none`, en-tête `flex`, `#hostPanel` en colonne 1 (x177,
  w260), `#stageWrap` colonne 2 CENTRÉE (offset horizontal ~0px), dock
  classement colonne 3 (x953, w260), aucun chevauchement avec le bouton
  Récap. Testé aussi avec `#joinCard` volontairement laissé visible (pire
  cas rencontré en cours de route) : placement toujours correct grâce aux
  `grid-column`/`grid-row` explicites.
- Revérifié à 390px (mobile) : navbar repasse en `flex` (visible), en-tête
  en `none`, `#hostPanel` repasse en `relative`, `.container` repasse en
  `block` — layout mobile confirmé intact.

## Tests manuels recommandés
- Vraie partie hôte sur écran ≥1100px : logo + code de salle + avatars
  visibles en haut, navbar absente, carte centrale bien au centre.
- Vérifier l'affichage du code de salle et des avatars AVANT le lancement
  de la partie (dans `#roomInfo`) : toujours correct (fonction partagée,
  pas juste testé côté présentation).
- Les deux thèmes (clair/sombre) sur le nouvel en-tête — pas retesté
  visuellement, tokens déjà theme-aware réutilisés.

## Suite — retour capture d'écran (2e passe)
"Beaucoup trop centré [...] La tuile gauche doit être collée à gauche, la
droite, à droite. Le logo doit être le SVG, et le centre le plus grand
possible."

- [x] `.container` en régie : `max-width: none; width: 100%; padding: 0
  24px;` au lieu du `max-width: 1100px` centré habituel — les 2 docks
  touchent quasiment les bords, la carte centrale (`minmax(0,1fr)`)
  récupère tout l'espace restant (476px → 934px+ sur un écran 1600px).
  Colonnes des docks élargies à 280px (260px paraissait perdu à pleine
  largeur d'écran).
- [x] Logo : remplacé le PNG par un **clone du vrai SVG de la navbar**
  (`.brand-logo-svg`, cloné en JS via `cloneNode(true)`) plutôt qu'une
  image à part — ses couleurs viennent d'une règle CSS globale sur cette
  classe (`.brand-logo-svg .cls-N { fill: url(#...) }`), donc le clone
  rend à l'identique sans dupliquer la moindre couleur à la main. Les id
  de dégradés SVG dupliqués (navbar + clone) sont sans conséquence : ce
  sont des copies identiques du même dégradé — vérifié en Browser pane que
  `fill` résout bien vers l'URL du dégradé sur le clone.

Vérifié en Browser pane (onglet neuf, cache+SW vidés) à 1600px : logo
cloné (hauteur 64px), dock gauche à 24px du bord, dock droit à ~34px de
l'autre bord (24px de marge + scrollbar), carte centrale à 934px de large.
Revérifié à 390px : navbar reste visible, en-tête caché, `.container`
reprend son `max-width: 1100px` habituel — layout mobile intact.

## Suite — retour utilisateur (3e passe)
"Je veux que les blocs gauche et droite aient une taille fixe selon la
taille de l'écran. Ça doit prendre la hauteur, COMME le design décidé
ensemble. Le type de question doit se retrouver en haut à gauche de la
tuile centrale, et le temps en haut à droite."

- [x] `.container` : `grid-template-rows: 1fr` + `height` (au lieu de
  `min-height`) + `align-items: stretch` (au lieu de `start`) — les 3
  colonnes (dock/carte/dock) s'étirent maintenant à la MÊME hauteur, celle
  de toute la rangée disponible, plutôt que chacune haute seulement de son
  propre contenu.
- [x] `#hostPanel`/`#liveClassementDock`/`#stageWrap` : `overflow-y: auto`
  en filet de sécurité (contenu qui dépasserait la hauteur disponible,
  ex. beaucoup de joueurs).
- [x] `#stageWrap` : passé en `display:flex; flex-direction:column;
  justify-content:center` — la question reste centrée verticalement dans
  la carte maintenant plus haute, au lieu de rester collée en haut.
- [x] `#questionTypeBadge` : `left:50%; transform:translateX(-50%)` →
  `left:0` (coin haut-gauche, au lieu de centré).
- [x] `#timerContainer` : transformé en pastille compacte (`width:200px`)
  ancrée `position:absolute; top:0; right:0` dans la carte (coin
  haut-droit, symétrique au badge) — au lieu du bandeau pleine largeur
  sticky habituel. Même `#timerBar`/`#timerLabel` à l'intérieur, aucun
  changement JS.

**Nouveau piège du même genre que les 2 précédents** (auto-placement CSS
Grid pollué par un enfant de `.container` sans placement explicite) :
`#joinCard`, laissé visible dans un test à la main (comme en tâche 006),
créait cette fois une DEUXIÈME rangée implicite (grid-template-rows
recalculé en `207.5px 498.5px` au lieu du seul `1fr` attendu), qui
écrasait la hauteur voulue. Confirmé qu'en conditions réelles ce n'est PAS
un bug : `#joinCard` est déjà `d-none` avant que `game-active` ne soit
posé (voir le flux normal de démarrage de partie) — reproduit le test avec
`#joinCard` correctement masqué (comme en vrai) pour valider le résultat
final, plutôt que de complexifier encore la grille pour un état qui ne
peut pas se produire.

Vérifié en Browser pane (onglet neuf) à 1600px, `#joinCard` masqué comme en
vrai jeu : les 3 colonnes font TOUTES 730px de haut (pleine hauteur de la
rangée), badge en (top:1,left:1) et timer en (top:1,right:1) relatifs à la
carte — coins haut-gauche/haut-droit confirmés. Revérifié à 390px : badge
repasse en `fixed`, timer repasse en `sticky` pleine largeur (350px vs
200px en régie) — layout mobile intact.

## Suite — retour utilisateur (4e passe) + référence design canvas
"Y'a du mieux [...] rajoute des marges pour le type de question + le
timer. Recentre un peu la tuile centrale qui n'est pas sensée prendre
toute la hauteur (mais garde une taille convenable quand même). Et répare
le logo qui est chelou et pas animé." — avec, en cours de route, un renvoi
explicite vers l'artboard "Texte libre" de la page "Écran hôte" du canvas
de design pour calibrer l'espacement.

**Cause du logo cassé, trouvée en creusant** : la 2e/3e passe clonait le
SVG du logo (`.brand-logo-svg`) dans un nouvel en-tête, pour contourner la
navbar entièrement masquée. Ce clone dupliquait tous les `id` de dégradés
du SVG dans le document — et l'ORIGINAL (dans la navbar, `display:none`)
passait toujours en premier dans l'ordre du DOM. Un `display:none` retire
tout son sous-arbre du rendu, **y compris ses `<defs>`** : les dégradés de
l'original ne sont plus des sources de peinture valides une fois cachés,
et `fill:url(#id)` résout vers ce premier `id` (l'original mort) plutôt que
vers la copie du clone. Explique le rendu cassé ET l'absence d'animation
(l'écouteur `mouseenter` déclenchant `.animate-logo` est branché sur le
VRAI `.brand`, jamais recopié sur le clone).

**Corrigé en repensant l'approche** plutôt qu'en rafistolant le clone
(renommer tous les id + réécrire toutes les références aurait aussi cassé
les règles CSS globales `.brand-logo-svg .cls-N { fill: url(#…) }`, qui
ciblent ces id en dur) :
- [x] Navbar **gardée** (plus jamais masquée entièrement) — seuls ses
  `.nav-group` (Créer/Rejoindre/Mes Quiz/profil) sont masqués en régie ;
  passée en grille 3 colonnes (`1fr auto 1fr`) : logo à gauche (inchangé,
  c'est le VRAI `.brand`, animation intacte), `#presentationRoomPill`
  centrée, `#presentationPlayerInfo` à droite.
- [x] `#presentationHeader`/`#presentationLogo` et le clone JS
  entièrement retirés (plus qu'un seul `.brand-logo-svg` dans tout le
  document, vérifié en Browser pane).
- [x] `#presentationRoomPill`/`#presentationPlayerInfo` : mêmes éléments
  qu'avant (code de salle + avatars), déplacés dans la navbar au lieu d'un
  `<header>` séparé — toujours masqués par défaut/pilotés par la media
  query régie (même raison anti-`.d-none` que le reste).
- [x] `#questionTypeBadge`/`#timerContainer` : `top/left`/`top/right` 0 →
  20px (marge par rapport au bord de la carte).
- [x] `#stageWrap` : `align-self: center` (au lieu d'hériter du `stretch`
  de `.container`) + `min-height: 380px` — les 2 docks restent étirés
  pleine hauteur, seule la carte se dimensionne sur son contenu et se
  centre verticalement dedans.

**Bug trouvé et corrigé EN VÉRIFIANT** (pas supposé) : la règle qui masque
`.presentation-room-pill` par défaut (`display:none`) était immédiatement
suivie de l'ANCIENNE règle d'habillage du même sélecteur, qui posait encore
`display:flex` en dur — même spécificité, elle regagnait par simple ordre
de cascade et affichait la pastille même hors contexte régie. Corrigé en
retirant `display` de la règle d'habillage (la visibilité vient uniquement
de la règle groupée + de la media query).

**Piège d'outillage rencontré en vérifiant** : les résultats du premier
passage de vérification semblaient montrer le bug encore présent même
après correction — en fait le cache HTTP du navigateur (`max-age=120s` sur
les assets statiques) servait une version de `style.css` vieille de
quelques dizaines de secondes malgré un onglet neuf et un paramètre anti-
cache sur l'URL de la PAGE (qui ne change pas la clé de cache de la feuille
de style elle-même). Contourné en remplaçant dynamiquement le `<link
rel="stylesheet">` par un lien avec `?bust=timestamp` avant de mesurer —
technique à réutiliser si un correctif semble "ne pas s'appliquer" alors
que le fichier source est confirmé correct.

Vérifié en Browser pane (feuille de style forcée fraîche) à 1600px : navbar
en `grid`, `.nav-group` masqué, pastille centrée (795 vs 800 attendu),
badge/timer à 21px du bord (marge 20px + arrondi), carte centrale à 380px
de haut (`min-height`, PAS 730px comme les docks), docks toujours à 730px/
682px (pleine hauteur). Un seul `.brand-logo-svg` dans le document. Revérifié
à 390px : navbar repasse en `flex` normal, pastille/joueurs repassent en
`none` — mobile intact.

## Suite — retour utilisateur (5e passe)
"Je ne veux pas de NAVBAR lorsqu'une game est en cours, ni côté MJ, ni côté
joueurs. Seulement le logo en haut centré." — avec renvoi explicite vers
l'artboard "Texte libre" du canvas de design pour vérifier la construction.
Tentative de relire ce canvas directement (`WebFetch` sur l'URL de
l'artifact) : n'a renvoyé que le code interne de l'éditeur, pas un résumé
exploitable du contenu — retombé sur la capture d'écran déjà fournie par
l'utilisateur dans l'échange précédent comme référence, qui montre
exactement ce point (logo seul, sans boutons, en haut).

**Changement de portée important** : jusqu'ici, masquer/réduire la navbar
n'était fait que pour l'hôte en desktop (`body.is-host.game-active` + `min-
width:1100px`). Cette fois la demande couvre TOUT LE MONDE (hôte ET
joueurs) et TOUTE largeur d'écran — `body.game-active` seul (déjà posé sur
tous les clients dès qu'une question s'affiche, hôte comme joueurs, voir
index.js) suffit, sans condition de largeur.

- [x] `body.game-active .navbar` : `.nav-group` (Créer/Rejoindre/Mes Quiz/
  profil) masqués, `justify-content:center` + `margin-right:0` sur `.brand`
  pour centrer ce qu'il reste (le logo, toujours le VRAI, jamais un clone)
  — sorti de la media query desktop, s'applique à toute largeur et aux
  deux rôles.
- [x] `#presentationRoomPill`/`#presentationPlayerInfo` (code de salle +
  joueurs dans la navbar, ajoutés en 4e passe) retirés entièrement — HTML,
  CSS et le commentaire JS qui les documentait. "Seulement le logo" ne
  laisse plus de place à un second contenu dans la navbar ; le nombre de
  joueurs reste visible ailleurs (panneau hôte).
- [x] Le layout régie hôte desktop (grille 3 colonnes, docks pleine
  hauteur, carte centrée) reste scopé comme avant — inchangé, vérifié
  toujours fonctionnel à côté de ce nouveau comportement de navbar.

Vérifié en Browser pane (feuille de style forcée fraîche) : joueur mobile
(390px, `game-active` sans `is-host`) — `nav-group` masqué, logo
parfaitement centré (195px sur 390px de large) ; hôte desktop (1600px) —
même centrage (795 vs 800 attendu) ET grille régie toujours intacte
(docks 730px, carte 380px) ; hors partie (`game-active`/`is-host` retirés)
— navbar entièrement revenue à la normale (`justify-content:normal`,
`nav-group` en `flex`).

## Suite — retour utilisateur (6e passe) : la barre elle-même, pas juste ses boutons
Capture d'écran + capture de référence fournies : "toujours une navbar
disgracieuse [...] un code salle qui devrait être en haut à droite [puis
corrigé en cours de route : "en haut à gauche, pardon"] [...] et en haut à
droite le nombre de joueurs + réponses reçues [...] la tuile gauche devrait
changer de design pour coller à celle de droite."

- [x] `body.game-active .navbar` : ne se contente plus de masquer les
  boutons — `background/backdrop-filter/border/box-shadow/border-radius`
  tous à `none`/`0` (`!important`, voir bug ci-dessous). La barre elle-même
  disparaît, ne reste que le logo centré flottant sur le fond.
- [x] `.persistent-code` ("EN DIRECT · Code salle") : `bottom-right` →
  `top-left` pendant une partie.
- [x] Nouveau `#gameProgressInfo` (coin haut-droit) : "N joueurs · M ont
  répondu" — réutilise la donnée déjà envoyée par le serveur à l'hôte
  (`socket.on('answer:progress')`, déjà utilisée pour `#loadedInfo` dans le
  panneau hôte) plutôt qu'un nouvel événement. Hôte uniquement : c'est la
  seule donnée disponible côté client.
- [x] `#hostPanel` (tuile gauche) restylé pour "coller" à
  `#liveClassementDock` (tuile droite) en régie desktop : liseré rose
  (`.border-accent-left`) retiré, padding aligné (18px), icône-badge
  masquée, titre réduit à la taille du titre du dock classement (15px).

**Bug trouvé EN VÉRIFIANT** (pas supposé bon) : le premier essai de
masquage de la navbar (`background:none` etc. sans `!important`) ne
s'appliquait PAS en thème clair — `:root[data-theme="light"] .navbar`
(3 sélecteurs de classe) l'emportait sur `body.game-active .navbar`
(2 classes + 1 type), spécificité CSS plus élevée. Repéré en testant
explicitement les deux thèmes plutôt qu'un seul. Corrigé avec
`!important` sur ces propriétés précises (justifié : c'est une
suppression volontaire et totale du style, pas un réglage fin qui
mériterait une meilleure spécificité).

Vérifié en Browser pane (feuille de style forcée fraîche) : navbar sans
fond/ombre/bordure en thème clair ET sombre, boutons masqués, logo centré ;
code de salle en haut-gauche (20,20) y compris à 390px ; `#gameProgressInfo`
en haut-droite ; `#hostPanel` sans liseré, padding 18px, icône masquée ;
hors partie, navbar entièrement revenue à la normale dans les deux thèmes.

## Suite — retour utilisateur (7e passe) : bug code salle, logo, barres
"Bug du code salle 'vide' / logo un peu petit encore / design des barres à
revoir, prendre comme réf la nouvelle DA." Clarifié avec l'utilisateur :
"les barres" = la barre de temps ET la barre de progression de l'hôte.

- [x] **Bug corrigé** (`socket.on('room:created', ...)`, index.js) : ce
  handler posait `persistentCode.style.display = 'block'` mais ne retirait
  JAMAIS la classe `d-none` (`!important`, un style inline ne peut pas la
  regagner) — contrairement à l'autre handler (`player:token`) qui le fait
  correctement. L'hôte ne voyait donc jamais ce badge par ce chemin, ou le
  voyait apparaître vide selon l'ordre d'arrivée des 2 événements. Corrigé
  en ajoutant le `classList.remove('d-none')` manquant.
- [x] Logo : `72px` pendant une partie (`46px` de base) — `56px` sur petit
  écran (`≤640px`, joueur sur téléphone) pour ne pas dominer tout le haut
  de l'écran.
- [x] Barre de progression de l'hôte (panneau gauche) : **remplacée** —
  points → vraie barre fine (`#hostProgressBar`, ex-`#hostProgressDots`,
  renommé pour rester honnête sur ce qu'il affiche désormais), même
  dégradé cyan→accent que la barre de temps. `renderHostProgressDots()`
  renommée `renderHostProgressBar()`.
- [x] Barre de temps (pastille coin haut-droit, tâche 006) : passée de 28px
  (chiffre superposé dedans) à 8px fine, chiffre écrit À CÔTÉ plutôt que
  dessus — même `#timerBar`/`#timerLabel`, juste repositionnés. Scopé à la
  régie hôte desktop uniquement ; le bandeau plein-largeur classique
  (mobile/joueur) est inchangé.

Vérifié en Browser pane (feuille de style forcée fraîche, 1600px) :
`renderHostProgressBar(3, 12)` produit bien une barre à 33% + label
"4/12" ; barre de temps à 8px de haut, `#timerLabel` en `position:static`
(sorti du chevauchement) ; logo à 72px. Revérifié à 390px : barre de temps
repasse à 28px avec label superposé (`position:absolute`), logo à 56px —
comportements mobile distincts confirmés, pas juste un `display:none`
oublié.

## Suite — retour utilisateur (8e passe) : panneau hôte complet + forme
Capture d'écran de référence (panneau "TU ANIMES / Capitales du monde")
fournie : "reprends les éléments de cette barre, et rajoute les : un logo,
un gros bouton question suivante en haut, la gestion du son par défaut
pour les joueurs, et le 'sur place / à distance' en bas." Puis, en cours
de route : "la forme de la tuile de gauche est toujours pas adéquate, tout
les angles doivent être arrondis, il ne doit pas y avoir de scrollbar."

- [x] Icône restaurée (masquée par erreur à la passe précédente en
  interprétant trop littéralement "coller au dock classement").
- [x] **Réordonnancement réel** du panneau (icône/titre → barre de
  progression → gros bouton "Question suivante ✨" → carte musique →
  pastille "Ambiance" tout en bas) : `#hostPanel` a 2 enfants directs en
  HTML (bloc texte, groupe de boutons) — `order` seul ne peut pas
  entrelacer les enfants de l'un avec ceux de l'autre. Résolu avec
  `display: contents` sur le bloc texte (UNIQUEMENT en régie desktop) :
  il s'efface du rendu sans toucher au DOM, ses enfants deviennent des
  enfants directs de `#hostPanel`, tous réordonnables ensemble via `order`.
  Le bandeau horizontal d'origine (mobile, desktop 1024-1099px) n'est
  jamais dans ce contexte, donc jamais affecté.
- [x] `#hostPlayerStrip`/`#loadedInfo` masqués (régie uniquement) :
  redondants avec la barre de progression + `#gameProgressInfo` (coin
  haut-droit, 6e passe) — évite de dupliquer la même info 3 fois.
- [x] Bouton "Question suivante ✨" : 64px de haut (au lieu de 48px),
  texte mis à jour (était "Suivant").
- [x] Carte musique : restructurée en 2 lignes (libellé + pourcentage sur
  une ligne, barre pleine largeur en dessous) au lieu d'une seule ligne
  compacte — même éléments (`#audioVolumeTrack`/`#audioVolumeLabel`),
  juste réordonnés via `order` + `flex-basis:100%` sur la barre.
- [x] Nouvelle pastille `#hostAmbiancePill` ("🎉 Ambiance : Sur place / À
  distance") — affiche `gameMode`, déjà suivi et diffusé par le serveur
  (`socket.on('game:mode')`), aucun nouvel état. `margin-top:auto` la
  pousse tout en bas du panneau (étiré pleine hauteur, voir tâche 005).
- [x] **Bug de forme corrigé** : `overflow-y:auto` → `overflow:hidden` sur
  `#hostPanel` — une scrollbar visible carre visuellement le coin qu'elle
  longe, même avec `border-radius` posé sur la boîte (artefact de rendu
  connu). Le contenu a aussi été allégé (2 éléments masqués ci-dessus),
  donc plus de raison réaliste de déborder. `#stageWrap`/
  `#liveClassementDock` gardent `overflow-y:auto` (contenu réellement
  variable — question longue, beaucoup de joueurs — pas concernés par ce
  retour, qui visait spécifiquement la tuile gauche).

**Fausse alerte pendant la vérification** : un test à 390px obtenu en
RESIZE depuis 1600px (au lieu d'une navigation directe à cette largeur)
rapportait un bouton toujours à 64px alors que la media query
`(min-width:1100px)` ne matchait plus (`matchMedia(...).matches === false`)
— everything pointait vers un bug de cascade CSS. Repris en navigant
DIRECTEMENT à 390px (au lieu de resize depuis un onglet large) : 48px
correct, confirmant que c'était un artefact de l'outil de resize
automatisé (la media query ne s'était pas ré-évaluée), pas un vrai bug.
Noté ici pour la suite : préférer une navigation directe à la largeur
voulue plutôt qu'un resize progressif quand un résultat semble incohérent.

Vérifié en Browser pane (feuille de style forcée fraîche, 1600px) :
`overflow:hidden` + `border-radius:24px` uniforme confirmés, icône
visible, ordre réel des éléments confirmé par leurs positions verticales
(eyebrow→127px, barre→177px, bouton→211px, musique→291px, ambiance→787px
poussée en bas), bouton 64px avec le bon texte, pastille ambiance avec le
bon texte. Revérifié à 390px (navigation directe) : wrapper texte repasse
en `display:flex` normal, pastille ambiance cachée, bouton à 48px —
mobile confirmé intact.

## Suite — retour utilisateur (9e passe) : accord + toujours visible
"Laisse toujours afficher l'info en haut à droite 'X joueurs, X ont
répondu' et adapte s'il n'y a qu'un joueur le libellé (1 joueur a
répondu)."

- [x] `updateGameProgressInfo(total, answered)` (nouvelle fonction
  partagée, index.js) : le verbe s'accorde avec `answered` (pas `total` —
  on peut avoir 8 joueurs et 1 seule réponse), `a répondu` si
  `answered <= 1`, `ont répondu` sinon. Appelée depuis `emitQuestion()`
  (début de CHAQUE question, `answered=0`) ET depuis
  `socket.on('answer:progress')` (mise à jour au fil des réponses) — donc
  visible dès le tout début de la question, pas seulement à la 1ère
  réponse reçue.
- [x] Nombre de joueurs à l'initialisation : `lastLobbyArr` (déjà tenu à
  jour par `lobby:list`, filtré hors hôte) — pas de nouvelle donnée.

Vérifié en Browser pane : `updateGameProgressInfo(1,0)` → "1 joueur · 0 a
répondu", `(1,1)` → "1 joueur · 1 a répondu", `(8,1)` → "8 joueurs · 1 a
répondu", `(8,5)` → "8 joueurs · 5 ont répondu" — les 4 cas d'accord
corrects.

## Suite — retour utilisateur (10e passe)
"Il n'est plus visible [confirmé après coup : le compteur joueurs/
réponses] / indique le nom du quiz en cours en dessous de 'Contrôles de
l'hôte' / agrandit un peu le bouton suivant pour mettre une petite icône
'shine' comme sur l'exemple fourni plus tôt / sur la timebar, enlève le
noir autour chez le MJ / met le temps sur la droite, à l'extérieur, de la
barre et non collé à l'intérieur."

- [x] `#hostQuizTitle` : nouveau, sous "Contrôles de l'hôte", posé au
  chargement du quiz (`loadedQuiz.title`) — masqué hors régie desktop.
- [x] Bouton "Question suivante" : 76px (au lieu de 64px), `✨` sorti dans
  son propre `<span class="btn-shine-icon">` (au lieu d'un emoji collé en
  fin de texte) — empilé SOUS le libellé en régie (`flex-direction:
  column`), texte inchangé partout ailleurs.
- [x] `#timerContainer` : fond sombre + flou retirés en régie (`background:
  none`) — pensés pour rester lisibles par-dessus le contenu de question
  qui défile en mobile/joueur, plus nécessaires posés sur la carte régie
  elle-même (fond uni, jamais de contenu qui défile derrière).
- [x] `#timerLabel` : vraiment sorti de la barre (`position:absolute;
  left:100%`, wrapper réduit à `calc(100% - 34px)` pour lui laisser une
  vraie place, toujours DANS les 220px de `#timerContainer` — jamais
  au-delà, pour ne jamais dépendre du comportement d'overflow de
  `#stageWrap`, un ancêtre).

**Bug du compteur joueurs/réponses** : cause exacte non retrouvée avec
certitude en relisant le code (la fonction `updateGameProgressInfo()`
fonctionne correctement testée isolément, comme aux passes précédentes) —
renforcé en l'appelant aussi depuis `socket.on('question:show')` (signal
canonique "une question est affichée" reçu par l'hôte), en plus de
`emitQuestion()` (appelée avant l'aller-retour serveur) où elle était déjà
posée, pour ne plus dépendre uniquement du bon déroulé de cette 2e
promesse. **Pas garanti résolu** — à confirmer par l'utilisateur sur le
prochain test réel, avec plus de détail si le problème persiste (à quel
moment exact ça disparaît : dès la 1ère question, après un "Suivant",
etc.).

Vérifié en Browser pane (feuille fraîche) à 1600px : quiz title affiché
avec le bon texte, bouton 76px/colonne/2 spans distincts, fond du timer
transparent, label positionné 10px à droite du bord de la barre (hors de
sa boîte). Revérifié à 390px (navigation directe) : bouton 48px/ligne,
fond du timer toujours sombre (nécessaire là), titre quiz caché — mobile
intact.

## Risques restants
- Hauteur du wordmark (44px) pas comparée à l'échelle exacte de la
  maquette — ajustable si trop petit/grand à l'usage réel.
- `min-height: calc(100vh - 170px)` sur `.container` : valeur estimée pour
  l'espace libéré par la navbar masquée + l'en-tête, pas mesurée
  précisément pour toutes les hauteurs de fenêtre — à surveiller sur un
  vrai poste hôte (résolution/zoom variables).

## Statut
`en review`
