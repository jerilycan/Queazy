# Proposition — dispositions régie dédiées par type de question

**Statut : document de PROPOSITION, pas une tâche officielle.** Sert de base
pour cadrer la vraie tâche ensuite (`/new-task`). Aucun code modifié pour
produire ce document.

## Périmètre et méthode

Concerne uniquement `body.is-host.game-active .container` en régie desktop
large (`@media (min-width: 1100px)`, voir `client/public/css/style.css`
lignes 4041+). La vue joueur (mobile/tablette/IRL) n'est jamais touchée par
les pistes ci-dessous — je le rappelle type par type quand c'est pertinent.

Pour chaque type j'ai vérifié :
- où et comment le contenu de `#inputArea` (ou zone équivalente) est
  construit dans `client/public/js/index.js` (fonctions `build...`),
- le CSS existant dans `client/public/css/style.css`,
- si l'hôte en mode "Présenter" (`isPresenterHost()`, ligne 4001 de
  `index.js`) voit réellement ce contenu ou si celui-ci reste verrouillé/vide
  côté régie (cas important : plusieurs types n'affichent quasiment rien à
  l'hôte aujourd'hui).

Rappel structurel (déjà en place, task 028/029) : `#main` a pour enfants
directs `#questionCategoryBadge` + `#question`, `#illustrationImgWrap`,
`#inputArea`. La classe `.regie-portrait-layout` bascule déjà `#main` en
grille 2 colonnes (image / `#inputArea`) quand l'illustration est portrait,
indépendamment du type — toute proposition ci-dessous doit rester compatible
avec cette classe (elle continue de piloter `#illustrationImgWrap` vs
`#inputArea`, pas l'intérieur de `#inputArea`).

---

## 1. mcq / truefalse / intrus — tuiles

**JS** : zone commune `#optionsDiv` (variable `optionsDiv` dans `index.js`,
ligne ~6319), classes `.options-grid`, `.truefalse-grid`, `.intrus-grid`
posées selon le type. Remplissage des tuiles lignes 6774+ (mcq),
6795+ (intrus), 6902+ (truefalse).

**CSS actuel** :
- `.options-grid` : grid 2 colonnes fixes (`style.css` L1778).
- `.option-btn` grandit déjà en `min-width:900px`/`1300px` (L1927-1934) et
  `#inputArea.max-w-700` s'élargit à 880px/1040px en régie large (L1831-1836)
  — un effort générique d'agrandissement existe déjà pour ce cas.
- `.intrus-grid` a DÉJÀ une disposition dédiée desktop (`min-width:900px`,
  L1797-1819) : flex + wrap avec `--intrus-row-cols` posé par tuile en JS,
  centrage des rangées incomplètes, plafond `min(320px, 36vh)`.
- `.truefalse-grid` a déjà ses tuiles agrandies en losange/triangle
  (L1838-1889).

**Évaluation** : mcq/truefalse sont déjà bien traités par l'agrandissement
générique — la grille 2 colonnes reste le bon choix visuel (pas de gain
évident à passer à 3-4 colonnes, qui réduirait la taille de chaque tuile).
intrus a déjà une disposition dédiée. **Pas de changement recommandé ici** :
ce sont les types où le générique + agrandissement fait déjà le travail.
Seule réserve mineure (petit chantier si un jour signalé) : sur un écran très
large (`#inputArea` à 1040px+), 2 colonnes pour un mcq à 2-3 options peut
laisser un vide vertical — pas un problème observé/signalé, à ne pas
anticiper sans retour utilisateur.

---

## 2. graduation — curseur

**JS** : `buildGradSlider(min, max, value)` (`index.js` L1169), construit
`.grad-slider` / `.grad-slider-track` / `.grad-slider-thumb` / labels min/max
(`.graduation-labels`).

**CSS actuel** (`style.css` L1592-1767) : `.graduation-area` plafonnée à
`max-width: 700px`, `.grad-slider` plafonné à `max-width: 520px`, centré.
Aucune règle régie desktop dédiée.

**Évaluation** : GAIN RÉEL. En régie large, ce plafond à 520px laisse la
carte centrale largement vide autour d'un simple trait fin — exactement le
type de contenu qui bénéficierait d'une vraie disposition dédiée (le brief
utilisateur le cite explicitement). C'est aussi un des types les plus
"lisibles à distance" pour une salle (gros curseur = meilleur télé-crochet
qu'un petit widget).

**Piste concrète** :
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .graduation-area { max-width: 900px; }
  body.is-host.game-active .container .grad-slider { max-width: 760px; padding: 24px 8px; }
  body.is-host.game-active .container .grad-slider-track { height: 24px; }
  body.is-host.game-active .container .grad-slider-thumb { width: 46px; height: 46px; }
  body.is-host.game-active .container .grad-value { font-size: 64px; }
  body.is-host.game-active .container .graduation-labels { max-width: 760px; font-size: 20px; }
}
```
Rien à changer côté joueur (règles scopées `body.is-host.game-active
.container`, comme le reste des overrides régie existants). Aucune
restructuration DOM : mêmes classes, juste des valeurs plus généreuses.

**Complexité : petit chantier.** Que du CSS, pas de JS à toucher, pas de
risque de régression ailleurs.

---

## 3. order / rangement / timeline — listes/zones

### order / timeline (liste verticale glissable)
**JS** : `buildOrderList` (L1437), `buildTimelineList` (L1608), drag maison
via `wireOrderDrag`/`wireTimelineDrag`.
**CSS** : `.order-area`/`.timeline-area` plafonnés à `max-width: 560px`
(L2251, L2306), items empilés verticalement, `gap: 10px`.

**Évaluation** : gain modéré. Une liste verticale reste le bon choix quel
que soit le nombre d'items (c'est un ordre à lire de haut en bas, un layout
en colonnes multiples casserait la lisibilité de "qui suit qui"). Mais
560px sur une carte qui peut faire 900px+ de large en régie laisse
beaucoup d'espace inutilisé, et les items eux-mêmes restent à taille fixe
(`font-size: 16px`/`13px`) alors qu'ils pourraient être lus par toute la
salle sur un écran partagé.

**Piste concrète** (élargir + grossir, pas de changement structurel) :
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .order-area,
  body.is-host.game-active .container .timeline-area { max-width: 820px; }
  body.is-host.game-active .container .order-item,
  body.is-host.game-active .container .timeline-item { padding: 20px 28px; }
  body.is-host.game-active .container .order-item-text { font-size: 19px; }
  body.is-host.game-active .container .timeline-item-title { font-size: 19px; }
  body.is-host.game-active .container .timeline-item-desc { font-size: 15px; }
}
```
**Complexité : petit chantier.**

### rangement (zones + cartes à glisser)
**JS** : `buildRangementArea(zones, items)` (L1823) — zones réparties en
rangées via `RANGEMENT_ZONE_ROW_PATTERNS`, cartes dans `.rangement-tray`.
**CSS** : `.rangement-area` plafonné à `max-width: 700px` (L2336), zones en
flex-wrap déjà adaptatif au nombre de zones (`--rangement-row-cols`).

**Évaluation** : gain réel, un peu plus gros que order/timeline. Le motif
adaptatif par rangée existe déjà (bon point, rien à casser) mais reste
plafonné à 700px alors que "zones larges + cartes bien lisibles" est
justement le genre de contenu qui profite d'une carte pleine largeur. Piste :
élargir `.rangement-area` en régie desktop (ex. `max-width: none; width:
100%`) et laisser le motif de rangées existant absorber la largeur
supplémentaire (il est déjà en `%`/flex, pas de valeur en dur à corriger).
**Complexité : petit/moyen chantier** (vérifier que le motif de rangées ne
donne pas des zones disproportionnées à 900-1000px de large — un plafond
raisonnable, ex. `max-width: 1000px`, reste plus sûr que `none`).

---

## 4. association — 2 colonnes appariées

**JS** : `buildAssociationArea(pairsA, pairsB, pairsBKeys, imagesUrl)`
(L2300), tuiles `.assoc-item` dans `.association-col-list`, traits SVG
dans `.association-links-svg`.
**CSS** : `.association-area` déjà en `display: grid;
grid-template-columns: 1fr 1fr` (L2153), plafonné à `max-width: 640px`.

**Évaluation** : c'est DÉJÀ la disposition "2 colonnes appariées" citée en
exemple dans le brief — l'existant est bon sur le principe. Seule
limitation : le plafond 640px, hérité du même défaut que order/rangement
(pensé pour mobile/tablette, jamais élargi pour la régie). Gain net possible
mais mineur : élargir la grille et les tuiles (`.assoc-item` a un padding
fixe `14px 16px`, `font-size: 15px`) profiterait à la lisibilité à distance,
sans toucher au principe 2-colonnes déjà pertinent.
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .association-area { max-width: 900px; gap: 32px; }
  body.is-host.game-active .container .assoc-item { padding: 20px 24px; font-size: 18px; }
}
```
**Complexité : petit chantier.**

---

## 5. blindtest — orbe audio

**JS** : `buildBlindTestArea(audioUrl, mode)` (L2994), orbe `.blindtest-orb`
(176px), 24 barres réactives peuplées une fois (`buildBlindTestOrbBars`).
**CSS** (L3204-3299) : orbe fixe 176px, cœur central 76px, pas de règle
régie desktop dédiée.

**Évaluation** : GAIN RÉEL, cité explicitement dans le brief. C'est un type
où l'hôte n'a QUE ça à montrer à l'écran pendant l'écoute (pas de tuiles à
lire, juste l'ambiance) — un orbe à taille fixe pensée pour mobile est le
cas le plus flagrant de sous-usage de l'espace central en régie large.
Grossir l'orbe entier (le conteneur + le rayon des 24 barres, tous deux
pilotés par `width`/`height` en CSS, transform en JS relatif au centre)
serait un vrai gain visuel pour "l'écran qu'on regarde en musique".

**Piste concrète** :
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .blindtest-orb { width: 280px; height: 280px; }
  body.is-host.game-active .container .blindtest-orb-core { width: 120px; height: 120px; }
  body.is-host.game-active .container .blindtest-orb-core svg { width: 42px; height: 42px; }
}
```
Point de vigilance : les 24 barres (`.blindtest-orb-bar`) ont leur
géométrie (longueur/position) posée en JS dans `buildBlindTestOrbBars` —
**vérifier si cette fonction lit `.blindtest-orb.getBoundingClientRect()` ou
une constante en dur** avant de grossir le CSS seul ; si c'est une constante,
il faudra soit la rendre proportionnelle, soit dupliquer un calcul régie
(légèrement plus qu'un simple CSS, à vérifier en implémentation).
**Complexité : petit/moyen chantier** selon ce point.

---

## 6. zoomguess — déjà une mécanique dédiée

**JS** : pas de fonction `build...` séparée — réutilise `#illustrationImgWrap`
avec zoom actif (`isZoomGuess`, transform scale/blur piloté par le tick du
timer, voir L6432-6506). `#inputArea` ne contient pour zoomguess que le champ
texte libre (`answerInput`/`freeTextEl`), déjà générique.
**CSS** : `.zoomguess-visible` (dérogation à la règle "illustration cachée en
IRL"), le zoom lui-même est un `transform` inline, pas une classe dédiée.

**Évaluation** : mécanique déjà pensée spécifiquement pour ce type (zoom
progressif, cadre fixe). **Pas de changement recommandé**, sauf signal
utilisateur concret (le brief le dit explicitement : "à revoir seulement si
un vrai problème est visible" — aucun trouvé en explorant le code).

---

## 7. image — question avec image cliquable

**JS** : `buildImageAnswerArea(src)` (L2489), cadre fixe `#imageViewport` /
`#imageWrap` dimensionné une fois par question (`setupImageFrame`,
L2423+), zoom/pan par transform CSS.
**CSS** (L2680-2705) : `#imageWrap` en largeur posée en JS (px),
`IMAGE_FRAME_MAX_HEIGHT = 480` (constante JS, L2378).

**Évaluation** : gain réel mais plus délicat. Contrairement à graduation/
blindtest (CSS pur), la taille du cadre `image` est calculée en JS
(`setupImageFrame`, basé sur `imageViewport.getBoundingClientRect().width`
et `IMAGE_FRAME_MAX_HEIGHT`). Élargir ce cadre en régie desktop demanderait
de toucher `IMAGE_FRAME_MAX_HEIGHT` (ou le rendre conditionnel à
`document.body.classList.contains('is-host')`/largeur de viewport) plutôt
que du CSS seul — le conteneur `#imageViewport` a déjà `width: 100%`
implicite, donc l'agrandir revient surtout à lever le plafond de hauteur
480px et laisser `setupImageFrame` recalculer sur un `#inputArea` plus
large (déjà élargi par `.max-w-700` générique existant).
**Complexité : moyen chantier** (touche JS, pas seulement CSS — sortir du
principe "classes posées conditionnellement" pur, contrairement aux autres
pistes de ce document). À ne prioriser qu'après graduation/blindtest.

---

## 8. reveal / recherche / halo — image à deviner

**JS** : pas de fonction `build...` dédiée par type — `revealArea`/
`rechercheArea`/`haloArea` togglés visibles (`d-none`), image assignée
directement (`revealEnigmeImg.src`, `rechercheImg.src`, `haloImg.src`).
**CSS** (L2928-3055) : les 3 partagent EXACTEMENT le même gabarit —
`max-width: 640px`, `height: min(70vh, 420px)` — commentaire du code
confirme la cohérence voulue ("même gabarit de boîte fixe... cohérence
visuelle entre types 'image à deviner'").

**Évaluation** : gain réel et group-able (les 3 types partagent déjà la même
classe de gabarit visuel, donc une seule règle régie desktop couvre les
trois d'un coup — cohérent avec "pas de duplication évitable" du
CLAUDE.md). Ce sont des questions où l'image EST le contenu principal
(deviner ce qui est caché/révélé) — un cadre à 420px de haut sur une carte
régie qui peut faire 700px+ de haut est clairement sous-dimensionné.
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .reveal-area,
  body.is-host.game-active .container .recherche-area,
  body.is-host.game-active .container .halo-area { max-width: 900px; }
  body.is-host.game-active .container .reveal-img-wrap,
  body.is-host.game-active .container .recherche-wrap,
  body.is-host.game-active .container .halo-wrap { width: min(900px, 100%); height: min(65vh, 560px); }
}
```
**Complexité : petit chantier**, un seul bloc de règles pour 3 types.

---

## 9. indice — carte centrale + historique

**JS** : `buildIndiceArea(hints)` (L1915) initialise, `flipIndiceCardToHistory`
gère la transition centrale → historique (animation 3D flip).
**CSS** (L3066-3202) : `.indice-area` plafonné 640px, `.indice-central-card`
en **hauteur FIXE 240px** (commentaire explicite : nécessaire pour animer
proprement, pas juste un minimum).

**Évaluation** : gain réel mais AVEC RISQUE — la hauteur fixe 240px est un
choix technique documenté (permettre l'animation flip, pas juste une
négligence). Le brief demande pourtant explicitement de regarder ce type.

**Piste concrète (safe)** : élargir sans toucher à la hauteur ni à
l'animation — même logique que reveal/recherche/halo, garder la carte
`.indice-central-card` à 240px de haut (l'animation dépend de cette valeur
FIXE) mais l'élargir et grossir le texte, et élargir `.indice-history` en
conséquence :
```css
@media (min-width: 1100px) {
  body.is-host.game-active .container .indice-area { max-width: 900px; }
  body.is-host.game-active .container .indice-central,
  body.is-host.game-active .container .indice-central-card { height: 320px; }
  body.is-host.game-active .container .indice-card-text { font-size: 28px; }
}
```
Si la hauteur est relevée (240px → 320px), il faut re-vérifier
`indiceFlipIn`/`indiceSweep` (keyframes en `rotateY`/`translateX`, pas de
valeur en px dépendante de la hauteur — a priori sans risque, mais à
confirmer visuellement en régie avant de livrer, cf. règle CLAUDE.md
"vérification visuelle via Browser pane").
**Complexité : petit/moyen chantier** (CSS seul, mais point d'attention
animation à valider visuellement).

---

## 10. free / pbac — texte libre côté hôte : rien à faire

**JS** : type `free` et `pbac` n'ont **aucune fonction `build...`** — ce
sont de simples champs texte (`answerInput`/`freeTextEl`), jamais montrés à
l'hôte en mode "Présenter" : le bloc qui révèle `freeTextEl` et focus
`answerInput` est explicitement gardé par `if (!isPresenterHost())`
(L6541-6560). La modération pbac (validation des familles de réponses,
`pbacGroupBar`) vit dans `#moderationZone`/`#moderationPanel`, **pas dans
`#inputArea`** — hors périmètre de cette proposition (ce n'est pas la carte
`#main`).

**Évaluation** : **rien à proposer**. Pour ces deux types, `#inputArea` régie
est quasiment vide (juste la question + éventuelle illustration) — il n'y a
structurellement aucun contenu spécifique au type à disposer différemment.
Un chantier ici n'aurait pas de gain visuel puisqu'il n'y a rien à réagencer.

---

## Priorisation

### À traiter en premier (impact visuel fort + fréquence d'usage probable)
1. **blindtest** — l'orbe à taille fixe (176px) est le cas le plus flagrant
   de sous-usage de l'espace régie : c'est LE seul contenu à l'écran pendant
   toute la question, sur un type probablement fréquent (le brief le cite en
   premier parmi les "vrais gains"). Petit/moyen chantier.
2. **graduation** — même logique (curseur fin sur une carte large), petit
   chantier CSS pur, faible risque, gain de lisibilité "présentateur" direct.
3. **reveal / recherche / halo** (groupés, même gabarit CSS partagé) — un
   seul chantier CSS couvre 3 types d'un coup ("image à deviner" est un
   format de question à fort impact visuel en régie, et le partage de classe
   existant rend le coût de la modif très faible pour le gain sur 3 types).

### Bénéfice réel mais secondaire (à faire ensuite, ou si le temps le permet)
4. **order / timeline / rangement / association** — gain net (cartes/tuiles
   trop petites pour la largeur dispo) mais déjà globalement fonctionnels ;
   pas de refonte de layout nécessaire, juste un élargissement + agrandissement
   de texte, à faire au fil de l'eau plutôt qu'en priorité.
5. **indice** — gain réel mais contrainte technique (hauteur fixe liée à
   l'animation flip) qui demande une vérification visuelle avant de livrer,
   donc légèrement plus risqué que les autres "petits chantiers".

### Peut rester générique (pas de perte identifiée)
- **mcq / truefalse / intrus** — l'agrandissement générique existant fait
  déjà le travail ; intrus a même déjà sa propre disposition adaptative.
- **zoomguess** — mécanique déjà dédiée et validée, aucun problème identifié
  en explorant le code.
- **free / pbac** — rien à disposer côté régie, `#inputArea` y est
  structurellement vide pour l'hôte.
- **image** — gain réel mais nécessite de toucher du JS (`setupImageFrame`/
  `IMAGE_FRAME_MAX_HEIGHT`), pas seulement du CSS conditionnel comme les
  autres pistes : à ne traiter qu'après les chantiers CSS purs ci-dessus, pas
  en priorité malgré le gain potentiel.

## Ce qui ne change jamais (rappel)

Toutes les pistes ci-dessus sont scopées `body.is-host.game-active
.container ...` (comme l'existant `.regie-portrait-layout` et le reste des
overrides `@media (min-width: 1100px)`) : aucune ne touche aux règles de
base utilisées par la vue joueur/mobile/IRL. Aucune ne modifie le DOM ni
n'introduit de nouvelle feuille de style — uniquement des classes/sélecteurs
déjà existants, élargis ou agrandis dans `client/public/css/style.css`, avec
une exception ponctuelle côté JS pour `image` (et potentiellement blindtest
selon comment `buildBlindTestOrbBars` calcule la géométrie des barres — à
vérifier à l'implémentation).
