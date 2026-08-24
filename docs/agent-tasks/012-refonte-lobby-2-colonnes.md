# [012] Salon d'attente — disposition 2 colonnes desktop + QR agrandissable

## Contexte
Suite à plusieurs passes de revue visuelle sur le canvas de design ("Écran
hôte QuEazy", artboard `Lobby.dc.html`), disposition validée par
l'utilisateur : colonne gauche = salon (organisateur + réglages, sans les
joueurs) + contrôles de l'hôte en dessous ; colonne droite = partage
d'accès (QR + code) en haut + joueurs connectés (tuiles) en dessous. QR
cliquable pour l'agrandir en plein écran (joueurs IRL qui photographient
l'écran projeté).

## Objectif
Porter cette disposition dans le vrai salon d'attente (`#lobby`,
`index.html`), desktop uniquement (≥1100px) — mobile inchangé.

## Périmètre
- `client/public/index.html` : `#lobby` scindé en `#lobbySalon` (salon
  sans joueurs) + `#lobbyPlayersCard` (joueurs) ; QR entouré d'un
  `#qrWrap` cliquable + pastille d'agrandissement ; nouvel overlay
  `#qrExpandOverlay`.
- `client/public/css/style.css` : grille 2 colonnes desktop
  (`.container:has(#lobby:not(.d-none))`), styles QR cliquable + overlay.
- `client/public/js/index.js` : `currentJoinUrl` + `openQrOverlay`/
  `closeQrOverlay`, régénère le QR en plus grand via la même lib
  (`QRCode`), pas un agrandissement CSS flou.

## Hors périmètre
- Mobile/tablette (<1100px) : `#lobbySalon`/`#lobbyPlayersCard` restent
  simplement 2 cartes empilées au lieu d'une seule (léger changement
  visuel non demandé mais nécessaire pour scinder le contenu — marge
  ajoutée entre les deux pour ne pas les faire se toucher).

## Choix techniques notables
- **`:has()` plutôt qu'une classe body dédiée** : `#lobby` porte déjà son
  propre `d-none` (voir `showLobby`/`enterGameScreen` dans `index.js`),
  pas besoin d'un 2e état à maintenir en JS rien que pour ce layout.
- **`#lobby { display: contents !important; }`** (desktop uniquement) :
  même technique que `#hostPanel` en régie hôte pendant la partie
  (déjà dans ce fichier) — aplati pour que `#lobbySalon`/
  `#lobbyPlayersCard` rejoignent directement la grille de `.container`,
  aux côtés de `#hostPanel`/`#roomInfo`. `!important` nécessaire :
  `showLobby` pose `display:block` en inline sur `#lobby`, qu'un
  sélecteur normal ne peut pas battre.
- **QR agrandi régénéré, pas zoomé en CSS** : `new QRCode(el, {width:320,
  height:320})` redessine un vrai QR net à cette taille, plutôt qu'un
  `transform:scale()` sur le petit QR existant (rendu flou).
- **Pastille d'agrandissement toujours visible, pas au survol** : un
  joueur IRL regarde un écran projeté, jamais une souris — rien à
  survoler.

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- Équilibre des accolades CSS : 1284/1284, OK.
- Vérifié en Browser pane (état hôte forcé en lobby, cache-bust) :
  - Desktop 1440px : grille confirmée (`lobbySalon`/`hostPanel` alignés en
    colonne gauche, `roomInfo`/`lobbyPlayersCard` en colonne droite,
    lignes synchronisées entre les 2 colonnes, aucun chevauchement, gap
    20px exact entre les colonnes).
  - Clic sur le QR : overlay plein écran s'ouvre, QR régénéré à 320×320
    (vs 256×256 pour le petit), code affiché, fermeture au clic confirmée.
  - Mobile 390px : `.container`/`#lobby` restent `display:block` (règle
    desktop bien cantonnée à `min-width:1100px`), les 2 cartes s'empilent
    avec un espacement propre (32px).

## Tests manuels recommandés
Vraie partie côté hôte sur un écran ≥1100px : vérifier la disposition en
conditions réelles, avec plusieurs joueurs (grille de tuiles qui grandit),
et tester le QR agrandi en le scannant/photographiant pour de vrai.
Vérifier les deux thèmes (clair/sombre).

## Risques restants
- `#hostPanel` en colonne gauche (largeur ~1fr, potentiellement large sur
  un très grand écran) n'a pas été retouché dans ses proportions internes
  — à surveiller si ça semble trop étiré sur un écran très large.
- Pas de test réel multi-joueurs (uniquement simulé via
  `renderLobbyGrid` appelé à la main).

## Retour utilisateur post-implémentation (correctif)
Une fois en place, la colonne droite (`#roomInfo` / `#lobbyPlayersCard`)
était cassée : les deux étaient des items de grille sur des LIGNES
partagées avec la colonne gauche, dimensionnées par le plus haut contenu
de chaque ligne — "Joueurs connectés" démarrait donc à la hauteur de
`#lobbySalon` (souvent bien plus haute que le QR), laissant un grand vide
sous "Partager l'accès". Corrigé en regroupant les deux cartes dans un
nouveau conteneur `#lobbyShareCol` (déplacé dans le DOM, `#roomInfo`
maintenant nichée dans `#lobby` — safe : `#roomInfo` n'est montrée qu'en
salon d'attente, `!inActiveGame`, jamais réutilisée pendant la partie,
contrairement à `#hostPanel`), qui devient l'unique item de grille de la
colonne droite (`grid-row: 1 / span 2`, `align-self: stretch`) et se
répartit lui-même en `flex-direction: column` avec `flex: 2`/`flex: 3`
(≈ 40 % / 60 %, retour utilisateur explicite) — indépendant de la hauteur
de la colonne gauche. Vérifié en Browser pane à 1440px (état lobby forcé
en JS) : colonne droite pleine hauteur alignée avec la gauche, ratio
≈ 40/60 confirmé par `getBoundingClientRect()`, plus de vide entre les
deux cartes.

## 2e retour utilisateur (après le 1er correctif) : 2 bugs
1. "Pas de scroll bar si le nombre de joueurs ne dépasse pas la taille de
   la tuile" — la carte entière avait `overflow-y:auto` avec une hauteur
   forcée par le ratio flex-grow (base 0), donc plus grande que son
   contenu réel : une barre de scroll apparaissait même vide.
2. "Le partage d'accès est cassé, on voit plus les infos comme avant" —
   même cause (base 0 + `justify-content:center`) : `#roomInfo` recevait
   moins de hauteur que son contenu réel (QR + code + bouton), et `.card`
   (`overflow:hidden`, coins arrondis) rognait "Copier le lien
   d'invitation".

Root cause commune : `#lobbyShareCol` utilisait `align-self:stretch` sur
une grille dont les pistes sont dimensionnées par le CONTENU des items
qui les occupent — y compris celui qui les enjambe. Avec des enfants
flex-grow dedans, cette contribution de contenu peut dépasser largement
la hauteur réelle de la colonne gauche, gonflant les pistes de grille
au-delà du nécessaire (et à l'inverse, sous-dimensionnant si on essayait
de contraindre différemment) — cause du vide, puis du rognage, en
fonction de la variante essayée.

Fixé en sortant complètement `#lobbyShareCol` du calcul de grille : une
HAUTEUR EXPLICITE en pixels, posée par `syncLobbyColumnHeight()`
(index.js, `ResizeObserver` sur `#lobbySalon`/`#hostPanel` + quelques
appels directs aux points d'affichage initiaux) — mesure la hauteur
réelle de la colonne gauche et la pose en `style.height` sur
`#lobbyShareCol` (jamais `min-height`, qui ne plafonne rien). À
l'intérieur, `#roomInfo` a `flex-shrink:0` : ne rétrécit jamais sous son
contenu réel (le minimum automatique de flexbox tombe à 0 dès que
l'élément a `overflow` non-visible, ce que `.card` a déjà — `flex-
shrink:0` est la seule protection fiable). `#lobbyPlayersCard` absorbe
l'écart à la place (peut rétrécir, `min-height:0`), et seul `#lobbyGrid`
(pas la carte entière) a `overflow-y:auto` — ne scrolle que si les
tuiles dépassent vraiment l'espace laissé.

Vérifié en Browser pane (1440px, salon complet avec les 3 réglages
visibles + hôte) : colonne droite alignée exactement sur la gauche
(738px des deux côtés), QR + code + bouton entièrement visibles, 2
tuiles sans scrollbar (client height = scroll height). Testé aussi en
salon "minimal" (réglages cachés, 504px de colonne gauche, cas extrême) :
`#roomInfo` reste intact (jamais rogné), seule la zone joueurs se
resserre. Mobile 390px inchangé (hauteur explicite retirée sous 1100px).

## 3e retour utilisateur : bloc "Partager l'accès" de nouveau trop grand
Après le fix du 2e retour (`flex: 2 0 auto` sur `#roomInfo`), le `2` de
grow restait actif : `#roomInfo` recevait toujours une part de l'espace
EXTRA disponible dans `#lobbyShareCol`. Comme son contenu naturel (le QR)
est déjà large, la moindre part de croissance en plus donnait une carte
énorme avec beaucoup de vide autour d'un code de salle resté minuscule
(15px) — perdu dans la carte. Corrigé : `#roomInfo` passe à
`flex: 0 0 auto` (aucune croissance, seulement sa taille de contenu
naturelle — `flex-shrink:0` du 2e correctif reste, toujours aucun
rognage possible) ; `#lobbyPlayersCard` passe à `flex: 1 1 auto` (absorbe
TOUT l'espace en plus, cohérent avec son rôle — accueillir des joueurs
qui arrivent). Le code de salle (`.room-info-code-value`) passe de 15px à
26px, seule info que l'hôte annonce à voix haute à ses joueurs IRL.
Vérifié en Browser pane (1440px, salon complet) : `#roomInfo` à sa
hauteur naturelle exacte (aucune inflation), `#lobbyPlayersCard` absorbe
le reste de la colonne droite.

## 4e retour utilisateur : "j'ai dit 40/60 en hauteur", pris au pied de la lettre
Le flex-grow (essayé aux 2 tours précédents, sous 2 formes) ne donne
jamais un vrai 40/60 du TOTAL : il dépend de la taille de contenu de
départ de chaque carte, et le QR est intrinsèquement large. Remplacé par
une hauteur EXACTE en pixels, posée par JS (`syncLobbyColumnHeight`,
index.js) : 40%/60% de `#lobbyShareCol` (moins le gap), affectée
directement à `#roomInfo`/`#lobbyPlayersCard` (`flex: none`, la valeur ne
bouge plus). Le QR (256×256 par défaut, fixé par la librairie qrcodejs)
est réduit à la source à 130×130 pour tenir dans les 40% — un
rétrécissement par CSS (`height:100%` en cascade dans une chaîne de
pourcentages) essayé d'abord a bouclé sur une dépendance circulaire et
effondré le QR à 0×0 (constaté : `flex-basis:auto` sur un parent dont le
seul contenu attend LUI-MÊME sa taille du parent). Padding de la carte
réduit (20px), `overflow-y:auto` posé en filet de sécurité si jamais le
contenu dépasse quand même les 40% (colonne de gauche exceptionnellement
courte) — scroll plutôt que rognage silencieux.

Piège de vérification rencontré 2 fois pendant ce tour : qrcodejs rend à
la fois un `<canvas>` (visible) ET un `<img style="display:none">` (caché,
export) dans `#qr` — mesurer `#qr img` donne toujours 0×0 par design,
`#qr canvas` est le bon sélecteur pour vérifier la taille réelle.

Vérifié en Browser pane (1440px, salon complet + vrai `QRCode()`) :
canvas 130×130 confirmé, `#roomInfo`/`#lobbyPlayersCard` à leurs 282px/
424px exacts (40/60 de 738-32 de gap), mobile 390px inchangé (hauteurs
vidées sous 1100px).

## Statut
`en review`
