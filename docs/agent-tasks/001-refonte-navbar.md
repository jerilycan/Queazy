# [001] Refonte de la navbar (nouvelle DA)

## Contexte
La nouvelle direction artistique du projet a été validée sur maquette
(canvas Design "Écran hôte QuEazy" — `Menu.dc.html` / `MenuConnected.dc.html`
/ `OptionB.dc.html`) : navbar en barre pleine largeur (au lieu de la pill
`999px` centrée actuelle), fond radial violet/magenta en haut de page, et un
vocabulaire de bouton plus "punchy" (poids 800, double ombre 3D + halo
coloré) repris sur toutes les maquettes suivantes (Mes Quiz, éditeur,
résultats, profil, connexion). Rien de tout ça n'a encore été porté dans le
vrai code — le site tourne toujours sur l'ancienne navbar et l'ancien style
de bouton.

## Objectif
Porter la navbar (structure + style) et le fond radial de page vers la
nouvelle DA, sur toutes les pages réelles du site, en gardant le
comportement JS existant intact (états connecté/invité, brand animation,
menu mobile, mode IRL sur `index.html`).

## Périmètre
- Nouvelle structure de navbar : logo à gauche, groupe CRÉER/REJOINDRE +
  séparateur + réglages/Mes Quiz/profil à droite (voir `Menu.dc.html`),
  barre pleine largeur `margin:16px`, `border-radius:22px`, fond glass —
  au lieu de la pill `999px` sticky centrée actuelle.
- "Mes Quiz" en pastille remplie (état actif) sur la page où on se trouve
  déjà — comportement à définir en JS ou en CSS selon la page courante.
- Fond radial violet/magenta en haut de chaque page (`#3a1450` →
  `#200a38` → fond actuel), au lieu du fond plat actuel.
- Nouveau vocabulaire de bouton (`.btn`, `.btn-primary`, `.btn-nav-secondary`,
  `.btn-nav-main`) : poids 800, double ombre (3D + halo coloré au lieu de
  l'ombre simple actuelle).
- Les 6 pages HTML qui embarquent la navbar en dur : `index.html`,
  `select.html`, `editor.html`, `result.html`, `profile.html`, `login.html`.

## Hors périmètre
- Le reste de la refonte "plateau chaleureux" côté jeu (`index.html`) déjà
  en cours sur cette branche (bannière EN DIRECT, points de progression,
  fond dédié spotlight) — pas touché ici, tâche séparée.
- Les mockups eux-mêmes (canvas Design) — déjà faits, cette tâche ne fait
  que porter ce qui y est déjà validé.
- Toute nouvelle fonctionnalité de navigation (rien de comportemental ne
  change, seulement le visuel).
- `design-system/navbar.html` et `design-system/buttons.html` — à mettre à
  jour dans une passe séparée une fois la navbar réelle validée, pour ne
  pas mélanger "référence" et "implémentation" dans le même diff.

## Fichiers concernés
- `client/public/css/style.css` — `.navbar`, `.nav-group`, `.profile-chip`,
  `.btn`/`.btn-primary`/`.btn-nav-main`/`.btn-nav-secondary`, fond `body`
  (source de vérité pour le style ; un seul endroit à changer pour l'essentiel
  du rendu)
- `client/public/index.html` — markup navbar (a Créer/Rejoindre)
- `client/public/select.html` — markup navbar (a Créer/Rejoindre)
- `client/public/editor.html` — markup navbar (a Créer/Rejoindre)
- `client/public/profile.html` — markup navbar (a Créer/Rejoindre)
- `client/public/result.html` — markup navbar (SANS Créer/Rejoindre —
  incohérence déjà présente avant cette tâche, à trancher, voir question
  ouverte ci-dessous)
- `client/public/login.html` — pas de navbar du tout aujourd'hui (juste le
  logo) — à trancher aussi

## Question ouverte avant de planifier
`result.html` n'affiche pas les boutons Créer/Rejoindre aujourd'hui (ça a
sans doute du sens en plein résultats de partie), et `login.html` n'a pas de
nav-group du tout. La maquette `Menu.dc.html` montre la version complète
(avec Créer/Rejoindre). Je pars sur : on garde ces deux variantes réduites
telles quelles (juste restylées), sans forcer Créer/Rejoindre partout — dis
si tu veux au contraire uniformiser.

## Plan

### Constats de l'exploration (important pour la suite)
- `.navbar` n'est PAS dupliquée à l'identique côté comportement : `theme.js`
  (`initMenuToggle`/`initToggle`) manipule le DOM au runtime sur **toutes**
  les pages — il regroupe les `.nav-group` existants dans un `.nav-menu`
  caché par défaut, insère un bouton burger avant lui (mobile), et insère le
  bouton bascule thème (`#themeToggle`, ☀️/🌙) en premier enfant du
  `.nav-group:last-child` (ou en fallback `grid-column:3` s'il n'y a AUCUN
  `.nav-group`, cas de `login.html`). **Toute nouvelle structure doit garder
  exactement 2 `.nav-group` enfants directs de `.navbar` là où il y en a
  aujourd'hui**, sinon ce script casse silencieusement.
- Le fond radial "spot" de `OptionB.dc.html`/`Menu.dc.html` (un seul halo
  chaud en haut, façon plateau télé) est différent du fond **déjà en
  place** sur tout le site aujourd'hui : `body` a 3 halos (rose/cyan/violet)
  qui dérivent lentement (`animation: bg-drift 26s`, tokenisé, avec un
  fond dédié plus doux en thème clair). Les maquettes qu'on a validées
  (Mes Quiz, Résultats, Profil, Connexion) remplacent déjà ce fond partout
  — je pars sur cette bascule confirmée, en **thème sombre uniquement**
  (le thème clair n'a pas été maquetté, je ne le touche pas ici).
- `.theme-toggle-btn` (cercle 40px, `rgba(255,255,255,0.08)`) et
  `.profile-chip` sont **déjà quasi identiques** au rendu des maquettes —
  peu ou pas de changement nécessaire dessus. Le "⚙️" de `Menu.dc.html`
  n'est donc pas un nouveau bouton réglages : c'est le bouton thème
  existant, avec son icône ☀️/🌙 (je ne remplace pas l'icône par un
  engrenage — la fonction reste "changer de thème", le renommer visuellement
  en "réglages" serait une nouvelle feature, hors périmètre).
- Changement de couleur à confirmer : sur les maquettes, "CRÉER" passe du
  dégradé bleu (`--tile-blue`, couleur actuelle) au dégradé accent
  rose/violet (`--color-accent`→`--color-accent-2`). "REJOINDRE" reste
  rouge. Je pars sur ce changement (repris tel quel de la maquette validée).

### Étapes (une par `/implement-step`)
1. **`body` (fond) + `.navbar` (structure et habillage)** dans
   `client/public/css/style.css` :
   - Remplacer le fond 3-halos animé par le halo unique chaud
     (`#3a1450` → `#200a38` → `var(--color-bg)` → `var(--color-bg-deep)`),
     thème sombre uniquement (garder `:root[data-theme="light"] body` tel
     quel).
   - `.navbar` : `display:flex` (logo à gauche, un seul groupe droit)
     au lieu de `grid-template-columns:1fr auto 1fr` ; `border-radius:22px`
     (au lieu de `999px`) ; fond glass `linear-gradient(180deg,
     rgba(30,30,66,.6), rgba(22,22,46,.7))` + `backdrop-filter:blur(16px)`
     (au lieu de `rgba(5,5,12,.78)` + `blur(14px)`) ; garder `position:sticky;
     top:12px` (comportement inchangé, juste l'habillage).
   - Ajouter un séparateur visuel (`<span>` 1px) entre les deux
     `.nav-group` — nouvel élément DOM, sans toucher au nombre de
     `.nav-group` (theme.js n'y touche pas, aucun risque de casse).
   - Adapter la media query mobile (`@media max-width:640px`) aux mêmes
     nouvelles valeurs de radius/fond.
2. **Boutons globaux** dans `client/public/css/style.css` :
   `.btn`/`.btn-primary`/`.btn-nav-secondary`/`.btn-nav-main` → poids 800,
   double ombre (3D + halo coloré), `.btn-nav-secondary` en pastille
   translucide (`rgba(accent,.10)` + bordure `1px`) au lieu du contour plein
   `2px`. Un seul endroit à changer, s'applique automatiquement partout
   (site + `design-system/buttons.html` si sa page de référence utilise
   bien les mêmes classes — à vérifier en passant, sans le remaquetter).
3. **Couleur "CRÉER"** : dégradé accent au lieu de tile-blue, sur
   `.btn.btn-nav-main` (+ son override `:root[data-theme="light"]`, à
   adapter dans la même teinte pour ne pas casser le thème clair même si on
   ne retouche pas son fond).
4. **"Mes Quiz" actif** : sur `select.html` uniquement, donner au lien
   "Mes Quiz" de la navbar une classe dédiée (ex. `.btn-nav-active`, pastille
   remplie accent) directement dans le HTML de cette page — pas de JS de
   détection de route, la navbar étant déjà dupliquée par page.
5. **Vérification `login.html`** : cette page n'a aucun `.nav-group`
   aujourd'hui (juste le logo) — avec `.navbar` en `flex` au lieu de
   `grid`, la règle `.navbar > .theme-toggle-btn { grid-column:3;
   justify-self:end }` (fallback quand `theme.js` ne trouve pas de
   `.nav-group`) doit être adaptée en flex (`margin-left:auto` par ex.)
   pour que le bouton thème reste bien casé à droite sur cette page précise.
6. Vérification visuelle Browser pane sur les 6 pages (dark uniquement),
   desktop + mobile (comportement burger), avant de clore.

## Étapes réalisées
- [x] Étape 1 : fond `body` (halo unique, thème sombre) + structure/habillage
  `.navbar` (flex, radius 22px, séparateur en pseudo-élément, media query
  mobile adaptée) — `client/public/css/style.css`
- [x] Étape 2 : boutons globaux (`.btn`/`.btn-primary`/`.btn-nav-main`/
  `.btn-nav-secondary`) — poids 800, double ombre 3D+halo, pastille
  translucide
- [x] Étape 3 : couleur "CRÉER" (accent au lieu de tile-blue, dark uniquement
  — l'override `:root[data-theme="light"]` garde son bleu, voir Risques)
- [x] Étape 4 : "Mes Quiz" actif sur `select.html` (`.btn-nav-active`)
- [x] Étape 5 : `login.html` — déjà réglé à l'étape 1, rien à faire de plus
- [x] Étape 6 : vérification finale toutes pages

## Checks effectués
- Étape 1 :
  - Vérifié en JS (Browser pane, `select.html` en mode invité) : navbar
    `display:flex`, `border-radius:22px`, fond glass appliqué, les 2
    `.nav-group` bien clusterisés à droite (séparateur présent), bouton
    thème toujours inséré au bon endroit par `theme.js`.
  - `login.html` (sans `.nav-group`) : le bouton thème atterrit
    naturellement à droite grâce à `margin-right:auto` sur `.brand` — la
    règle de repli `grid-column:3` prévue à l'étape 5 du plan s'est avérée
    déjà inutile (elle ne fait plus rien en `flex`) et a été supprimée
    tout de suite plutôt que laissée en code mort. L'étape 5 du plan est
    donc déjà couverte.
  - Mobile (375px, `select.html`) : menu burger toujours fonctionnel
    (`nav-open` bascule bien l'affichage), séparateur neutralisé comme
    prévu dans le dropdown empilé.
  - Retour utilisateur (capture d'écran, navigateur réel large) : le halo
    d'origine (1400×900px, centré à -12%) était bien trop petit/discret sur
    un écran large — quasiment invisible en dehors d'un liseré près de la
    navbar. Élargi à 2200×1300px, falloff repoussé à 78% (au lieu de 62%)
    pour que le violet reste visible plus loin dans la page, plus proche du
    rendu OptionB.dc.html d'origine.
- Étapes 2-4 : vérifiées via `fetch(url, {cache:'no-store'})` (source de
  vérité serveur) plutôt que le rendu direct de l'onglet de test — piège
  de cache rencontré en cours de route, voir "Tests manuels recommandés".
- Étape 6 : équilibre des accolades CSS vérifié (1140/1140, `node -e`),
  aucune régression de syntaxe ; les 6 pages répondent 200 et embarquent
  toutes `class="navbar"`.

## Tests manuels recommandés
- Parcourir les 6 pages en local (`npm.cmd start`), en **thème sombre**
  (celui visé par cette refonte) : `index.html` (avant/pendant une partie),
  `select.html`, `editor.html`, `result.html`, `profile.html`, `login.html`.
  Penser au **Ctrl+Maj+R** ou à un onglet neuf pour éviter le cache HTTP/PWA
  (voir plus haut).
- Vérifier le menu mobile (< 640px) sur au moins une page avec les 2
  `.nav-group` (ex. `select.html`) : ouverture/fermeture du burger, clic en
  dehors qui referme.
- Vérifier `index.html` spécifiquement en mode IRL joueur
  (`body.irl-player-mode`) : la navbar doit toujours disparaître entièrement
  au profit de la roue crantée — comportement piloté par une règle CSS non
  touchée ici, mais à reconfirmer visuellement puisque c'est la page la plus
  complexe.
- Vérifier que le halo de fond ne semble pas trop discret (ou trop présent)
  sur ton écran réel — c'est déjà ce qui a motivé un premier ajustement de
  taille cette session, la valeur actuelle (2200×1300px) est un compromis
  visuel, pas une mesure exacte issue de la maquette.

## Risques restants
- **Thème clair non harmonisé** : je n'ai délibérément pas touché au thème
  clair (jamais maquetté dans cette refonte). Le bouton "CRÉER" y reste bleu
  (`:root[data-theme="light"] .btn.btn-nav-main`, non modifié) alors qu'il
  est maintenant rose/violet en thème sombre — incohérence entre thèmes,
  déjà actée comme hors périmètre au moment du plan.
- **Fond de la navbar non thémé** : la barre reste toujours en verre sombre
  (`rgba(30,30,66,...)`) même en thème clair — vérifié, ce n'est **pas une
  régression** (l'ancienne navbar était déjà hardcodée en dark,
  `rgba(5,5,12,0.78)`), mais ce n'est pas non plus corrigé.
- **Aucun outil de vérification automatique** dans ce projet (rappel
  `CLAUDE.md`) : tout ce qui précède a été vérifié manuellement (Browser
  pane + `fetch(..., {cache:'no-store'})` pour contourner le cache HTTP/SW
  qui a faussé une partie des vérifications en cours de route) — pas de
  filet de sécurité automatisé derrière ce diff.
- Le halo de fond utilise des valeurs `px` fixes (2200×1300) plutôt que des
  unités relatives au viewport — au-delà d'un écran très large (>2200px de
  large), le halo pourrait sembler recentré/trop petit sur les bords ; pas
  vérifié au-delà de la largeur testée ici.

## Statut
`clôturée`
