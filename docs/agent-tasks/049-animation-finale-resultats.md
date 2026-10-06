# [049] Animation de fin de partie « tous les joueurs → podium »

## Contexte
La page de résultats (`result.html` / `results.js`) n'anime aujourd'hui que le
podium (3 pistes qui montent). Les autres joueurs n'apparaissent que dans la
liste en dessous. Après une série de démos validées avec l'utilisateur
(`client/public/demo-resultats-course.html`, temporaire), 6 animations sur une
même base visuelle (mosaïque de cartes en verre sur grille néon cyan) ont été
retenues : Corruption, Verrouillage, Téléportation, Surcharge, Implosion,
Effacement pixel.

## Objectif
À l'arrivée sur la page de résultats (TV `&tv=1`, joueurs, MJ — c'est la même
page), quand il y a plus de 3 joueurs (ou équipes) et un historique de
questions : tous les joueurs apparaissent en cartes, se réordonnent question
après question, puis tous sauf les 3 premiers sont éliminés en rafale (ordre
aléatoire, effets qui se chevauchent) avec l'une des 6 animations, puis le podium
actuel s'affiche (couronne, médailles, fanfare, confettis). Bouton « Passer ».
Même animation et même ordre d'élimination sur tous les écrans d'une même salle.

## Périmètre
- Nouveau script `results-finale.js` (moteur + 6 effets), CSS associé.
- Branchement dans `tryStartRace` (`results.js`) ; modes joueur et équipe.
- Mode TV : lancement automatique, pas de bouton « Passer ».
- Repli : ≤ 3 joueurs, historique vide ou « mouvement réduit » → comportement actuel.

## Hors périmètre
- Aucun changement serveur / schéma / dépendance.
- Pas de son supplémentaire (la fanfare existante reste sur le podium).
- Pas de refonte du podium ni de la liste complète.

## Fichiers concernés
- `client/public/js/results-finale.js` — nouveau, moteur d'animation
- `client/public/js/results.js` — appel du finale avant la course du podium
- `client/public/result.html` — balise script
- `client/public/css/style.css` — styles `.fin-*`, masquage du podium/liste pendant le finale
- `client/public/demo-resultats-course.*` — démo temporaire, à supprimer en fin de tâche

## Plan
1. Moteur `results-finale.js` : plateau (cartes, layout adaptatif), course cumulée, rafale d'éliminations, finale, « Passer », graine partagée.
2. Les 6 effets d'élimination.
3. CSS (`.fin-*`) + masquage pendant le finale.
4. Branchement dans `results.js` (joueurs et équipes) + `result.html`.
5. Vérifications visuelles (joueurs, TV, 4 / 10 / 20 joueurs, mobile), nettoyage de la démo.

## Étapes réalisées
- [x] 1 — moteur `results-finale.js` (plateau, course cumulée, rafale, finale, « Passer », graine partagée)
- [x] 2 — les 6 effets (corruption, verrouillage, téléportation, surcharge, implosion, effacement pixel)
- [x] 3 — CSS `.fin-*` + masquage du podium/liste pendant l'animation
- [x] 4 — branchement `launchPodium` dans `results.js` (joueurs et équipes), balise dans `result.html`
- [~] 5 — vérifications faites (voir Checks) ; suppression des fichiers de démo laissée à la clôture

## Checks effectués
- [x] `node --check` sur `results-finale.js` et `results.js`
- [x] Vérification visuelle Browser pane, avec des joueurs fictifs injectés depuis la console (pas de vraie partie) : flux complet 12 joueurs jusqu'au podium sans erreur, les 6 effets lancés en parallèle (fin sans erreur), mode TV `&tv=1` à 20 joueurs (pas de bouton « Passer »), mobile 375 px à 10 joueurs, bouton « Passer »

## Tests manuels recommandés
- Vraie partie à 4+ joueurs : les 3 écrans (TV, joueur, MJ) montrent la même animation et le même ordre d'élimination.
- Partie à 3 joueurs ou moins, ou sans question jouée : comportement d'avant (podium seul).
- Mode équipe avec 4+ équipes.
- Joueur avec avatar image (URL) et nom très long.
- « Passer » (joueur/MJ) ; TV : rien à cliquer.
- Réglage système « réduire les animations » : podium direct.
- Joueur qui arrive en cours de route / recharge la page de résultats.

## Risques restants
- Fluidité réelle non jugée (navigateur de test) : à regarder sur TV et sur mobile milieu de gamme (jusqu'à ~40 clones par effet « effacement »).
- Même effet/ordre sur tous les écrans, mais pas synchronisés à la milliseconde (chaque écran lance l'animation à son arrivée sur la page).
- Très gros effectifs (>40) : cartes très petites, texte peu lisible.
- La liste complète et le podium sont masqués pendant l'animation ; l'onglet « Détail » reste accessible.
- Podium restylé (fond/grille néon, pistes en verre, avatars cerclés, pastille cyan) pour garder la même DA que l’animation, y compris en repli (≤ 3 joueurs).
- Bug existant non traité : le bandeau « Arrivée ! » chevauche le score du 1er sur le podium.

## Statut
`en review`
