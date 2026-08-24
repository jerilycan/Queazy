# [004] Refonte DA — écran hôte en jeu (`index.html`)

## Contexte
Retour utilisateur direct : le chantier de refonte DA (tâches 001-003) a
couvert navbar/boutons/fond global, `select.html`, `result.html`,
`profile.html`, `login.html`, `editor.html` — mais jamais vraiment
`index.html` en tant qu'écran hôte pendant une partie en direct. Les tâches
précédentes avaient traité 2 points ciblés ("EN DIRECT" + points de
progression, voir 002) et s'étaient arrêtées là, faute de moyen fiable de
vérifier le reste sans une vraie partie en cours.

## Objectif
Faire un état des lieux honnête composant par composant de l'écran hôte en
jeu, puis aligner ceux qui accusent un vrai écart avec la nouvelle DA
(halo violet de fond, radius/ombres punchy, dégradé accent) — sans toucher à
l'état/logique JS de la partie en direct (zone à haut risque, retours
utilisateur déjà nombreux dessus, voir commentaires dans le CSS existant).

## Périmètre
Composants visuels de `index.html` visibles côté hôte pendant une partie :
panneau de contrôle hôte, timer, badge de type de question, intro de
question, zone de réponse (déjà largement partagée avec `editor.html`),
overlay de classement/podium, sidebar de récap, overlay de modération.

## Hors périmètre
- Toute nouvelle mécanique de jeu ou changement de comportement JS.
- Repasser en horizontal le système de classement (déjà tranché "garder
  l'actuel" en 003, décision 2).
- `race-lane`/pistes de course (idem, décision 2 de 003).

## État des lieux (avant modif)
- **`#hostPanel`** (panneau de contrôle) : déjà aligné — dégradé accent sur
  l'icône, pile d'avatars ("chantier plateau chaleureux", antérieur à cette
  session), boutons `.btn`/`.btn-primary` déjà sur le bon vocabulaire. Rien
  à faire.
- **`#persistentRoomCode` / "EN DIRECT" / points de progression** : déjà
  fait (tâche 002).
- **`.leader-overlay`** (classement/podium) : **écart réel** — fond en
  dégradé plat 2 tons (`--color-bg-deep` → `--color-bg`), masquait
  complètement le halo violet du fond global puisque cet overlay recouvre
  tout le viewport. **Corrigé** (voir plus bas).
- **`.leader-row`** : déjà sur les bons tokens (`--gradient-card`,
  `--radius-md`, `--shadow-sm`) — rien à faire.
- **`.timer-container` / `.question-type-badge`** : glass foncé
  (`rgba(5,5,12,0.78)` + blur) différent de la recette de la navbar
  (dégradé violet translucide + blur). **Tranché par l'utilisateur** :
  garder le noir quasi-opaque (lisibilité garantie par-dessus n'importe
  quel fond de question — image, couleur de type vive... — plutôt que la
  cohérence visuelle avec la navbar). Aucune modif à faire ici, fermé.
- **`.question-intro-card`** (bandeau d'intro de question) : déjà aligné —
  `--radius-lg`, `--gradient-card`, `--shadow-lg` + lueur néon `--qt-color`
  par-dessus (déjà token-based). Rien à faire.
- **`.blindtest-orb`** : déjà aligné — dégradé `--color-accent`/`--color-accent-2`
  + `box-shadow` en `--color-accent-rgb`. Rien à faire.
- **`.recap-sidebar`** : déjà aligné — `--gradient-card` (même "chantier
  plateau chaleureux" que `#hostPanel`). Rien à faire, sauf deux détails
  mineurs (voir Étapes réalisées).
- **`.moderation-wait-overlay`/-card** : overlay = simple voile sombre +
  flou par-dessus le jeu visible en dessous (comme `.question-intro-overlay`)
  — fonctionne tel quel dans les deux thèmes, pas un fond plein qui masque
  le halo. `.moderation-wait-card` déjà sur `--gradient-card`/`--radius-lg`.
  Rien à faire.

## Fichiers concernés
- `client/public/css/style.css`

## Étapes réalisées
- [x] `.leader-overlay` : fond remplacé par le même halo radial que `body`
  (nouvelle DA, tâche 001) au lieu du dégradé plat 2 tons.
- [x] Bug thème clair trouvé EN VÉRIFIANT le point précédent (pas juste
  supposé) : `.leader-overlay` n'avait aucun override thème clair, donc le
  halo sombre codé en dur (#3a1450/#200a38) fondait dans `var(--color-bg)`
  résolu en quasi-blanc — flaque violette disgracieuse en haut d'un fond
  clair. Ajouté `:root[data-theme="light"] .leader-overlay`, même recette
  à deux halos discrets que `:root[data-theme="light"] body`.
- [x] `.leader-title` ("Classement") : `color: white` en dur →
  `var(--color-text)` — invisible en thème clair (texte blanc sur fond
  quasi-blanc), identique à l'œil en thème sombre (`--color-text` y vaut
  déjà un blanc cassé).
- [x] Décision utilisateur actée : `.timer-container`/`.question-type-badge`
  gardent leur verre noir quasi-opaque (lisibilité > cohérence visuelle).
- [x] Audit complet des composants restants de l'écran hôte en jeu
  (`.question-intro-card`, `.blindtest-orb`, `.recap-sidebar`,
  `.moderation-wait-overlay`) : tous déjà token-based (`--gradient-card`,
  `--radius-lg`, `--color-accent*`), hérités d'un chantier antérieur
  ("plateau chaleureux") — rien à refaire dessus.
- [x] `.leader-gone-badge` / `.leader-row.is-detached` : override thème
  clair ajouté (même encre `rgba(35,25,65,…)` que les autres overrides
  clairs du fichier) — les `rgba(255,255,255,…)` d'origine restent la
  valeur par défaut (thème sombre), inchangée.

## Checks effectués
- Équilibre des accolades CSS : 1192/1192, OK.
- Vérifié en Browser pane (onglet neuf + cache-bust, PWA cache oblige) :
  `#leaderOverlay` affiché à la main (pas de vraie partie en cours) —
  thème clair : halo à deux touches discrètes + titre lisible (`rgb(33,26,58)`
  sur fond clair) ; thème sombre : halo radial complet jusqu'au fond,
  titre inchangé (`rgb(244,242,255)`).
- `.leader-gone-badge`/`.leader-row.is-detached` : vérifiés par lecture de
  code uniquement (changement mineur, même schéma que les overrides clairs
  déjà vérifiés ailleurs dans ce fichier) — pas re-testés en Browser pane.

## Tests manuels recommandés
- Lancer une vraie partie, aller jusqu'au classement/podium, dans les deux
  thèmes : vérifier le halo (avant : fond plat sombre, ou flaque violette
  en thème clair) et la lisibilité du titre "Classement".
- Pas de changement de comportement JS dans ce lot — rien d'autre à tester
  côté logique.

## Suite — retour utilisateur avec capture d'écran en vraie partie
Capture d'écran fournie (hôte, question Petit Bac en cours) : "ça ne
ressemble pas du tout à la DA attendue". Diagnostic à partir de l'image —
premier retour visuel réel sur `index.html` en jeu de toute cette série de
tâches (001-004 précédents, jamais vérifiés qu'à l'aveugle ou à la main).

**Constat** : `#hostPanel` (carte, icône dégradé, points de progression,
bouton "Suivant" dégradé) est bien conforme. Le vrai décrochage visuel est
`.timer-container`/`.timer-bar-wrapper` (barre de temps) : design hérité
tel quel du chantier "plateau chaleureux" (pré-refonte 001-004), sans la
moindre ombre — seul élément de tout l'écran de jeu à flotter à plat sur le
halo de fond sans aucun relief, contrairement à `.card`/`.navbar`/
`.question-type-badge` juste à côté qui en ont tous une.

- [x] `.timer-container` : ajout `box-shadow: 0 4px 14px rgba(0,0,0,0.3)`
  (même recette que `.question-type-badge`, son voisin direct sur le même
  écran) — ne touche pas la couleur du verre (décision déjà actée plus
  haut : rester en noir quasi-opaque).
- [x] `.timer-bar-wrapper` : ombre portée externe ajoutée en plus de
  l'ombre interne d'origine (`0 4px 12px rgba(0,0,0,0.25)`) — relief
  "punchy" cohérent avec `.btn`/`.card` ailleurs dans l'appli.

Vérifié en Browser pane (onglet neuf + cache-bust) : `getComputedStyle`
confirme les deux `box-shadow` appliqués tels qu'écrits. Pas de capture
d'écran possible dans cet outil (le rendu ne compose pas en tâche de fond)
— **à confirmer visuellement par l'utilisateur**, changement purement
additif (aucune couleur/mise en page touchée) donc risque de régression
faible, mais l'appréciation "punchy ou pas" reste à l'œil.

## Risques restants
- Le reste de l'audit (panneau hôte, classement, intro, orbe, récap,
  modération) tient toujours — seule la barre de temps s'est révélée être
  un vrai décrochage une fois vue en conditions réelles, pas détecté par la
  seule lecture de code lors de l'audit précédent.
- Cette passe reste additive (ombre uniquement) — si "pas du tout la DA
  attendue" visait autre chose que le manque de relief (palette, forme,
  taille de la barre...), remonter précisément quoi pour aller plus loin.
- Priorité de test : lancer une vraie partie jusqu'au classement, dans les
  deux thèmes — seule vérification faite dans cette session est manuelle
  (affichage forcé hors partie réelle).

## Statut
`en review`
