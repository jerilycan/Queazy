# [031] IRL : masquer le gameplay/les réponses sur l'écran du MJ

## Contexte
Retour utilisateur, en réaction directe au travail de mise en page par type
([030](030-dispositions-par-type-regie.md)) : "Le problème de disposition
n'est pas du tout réglé... On va faire quelque chose en premier lieu. Dès
qu'une partie est en mode IRL, on n'affiche RIEN en terme de réponse/
gameplay sur la vue du MJ. Pour garder plus de place pour l'image." Un
changement de direction plus radical que l'agrandissement au cas par cas :
en IRL, la salle répond de vive voix/à main levée — l'écran du MJ n'a plus
besoin de montrer les tuiles de réponse, toute la place doit revenir à
l'illustration.

**Contredit un choix passé documenté dans le code** (commentaire
`client/public/js/index.js` avant cette tâche : "L'hôte voit désormais les
mêmes tuiles que les joueurs... c'est son écran à partager avec la salle")
— retour utilisateur explicite qui inverse ce choix, gardé pour mémoire
dans l'historique git, le commentaire a été mis à jour en conséquence pour
ne pas induire en erreur plus tard.

## Objectif
Dès qu'une partie tourne en mode IRL (`room.gameMode === 'irl'`, PAS "à
distance") ET que l'hôte est un présentateur pur (`isPresenterHost()` —
n'inclut jamais le mode "Jouer", où l'hôte répond comme un joueur) : plus
aucune zone de réponse/gameplay (`#inputArea`, quel que soit le type de
question) sur son écran. L'illustration décorative, quand il y en a une,
récupère l'espace ainsi libéré.

## Périmètre
- Toute taille d'écran (pas seulement régie desktop ≥1100px) — c'est un
  choix de CONTENU (rien à voir avec le manque de place), pas juste un
  réglage de mise en page large.
- Agrandissement de l'illustration décorative en régie desktop
  (`body.is-host.game-active`, ≥1100px) pour profiter de l'espace libéré.
- Compatibilité avec la disposition portrait existante
  (`.regie-portrait-layout`, [028](028-image-portrait-regie.md)) : plus de
  2e colonne vide une fois `#inputArea` masqué.
- Mode "à distance" (`gameMode === 'remote'`) : AUCUN changement, la vue
  régie garde son rôle de console de contrôle habituel.
- Mode "Jouer" (`roomMode === 'auto'`, l'hôte participe comme un joueur) :
  AUCUN changement, `isPresenterHost()` exclut ce cas.

## Hors périmètre
- Vue joueur (mobile/tablette) — déjà gérée séparément
  (`body.irl-player-mode`), non touchée ici.
- Le travail d'agrandissement par type de [030](030-dispositions-par-type-regie.md)
  reste en place et continue de s'appliquer normalement dès que
  `#inputArea` est visible (mode "à distance", ou IRL en mode "Jouer" où
  l'hôte joue) — cette tâche ne le remplace pas, elle ajoute un cas où
  `#inputArea` est masqué AVANT même de se poser la question de sa taille.

## Fichiers concernés
- `client/public/js/index.js` — `updateIrlPlayerUI()` : nouvelle classe
  `body.irl-presenter-mode`, posée/retirée aux mêmes points d'appel déjà
  existants (game-active, game:mode, isHost, retour au salon).
- `client/public/css/style.css` — `body.irl-presenter-mode #inputArea {
  display: none !important; }` (toute taille d'écran) + agrandissement de
  l'illustration et correctif de la grille portrait en régie desktop.

## Plan
1. `updateIrlPlayerUI()` : calcule et pose `body.irl-presenter-mode` quand
   `gameMode === 'irl' && gameActive && isPresenterHost()`.
2. CSS : masquer `#inputArea` sous cette classe (`!important` — l'inline
   `display:block` posé à chaque question par `question:show` l'emporterait
   sinon, même patron déjà utilisé pour `#main`/`#hostPanel`).
3. CSS régie desktop : agrandir `.illustration-img` (plafond par défaut
   260px, pensé mobile) ; repasser `#main.regie-portrait-layout` à une
   seule colonne (`#inputArea` en `display:none` est retiré du calcul de
   grille CSS, sans ce correctif la 2e colonne resterait un espace vide
   réservé pour rien).

## Étapes réalisées
- [x] 1. `body.irl-presenter-mode` posée/retirée dans `updateIrlPlayerUI()`.
- [x] 2. `#inputArea` masqué (`!important`), toute taille d'écran.
- [x] 3. Illustration agrandie + grille portrait repassée à 1 colonne en
      régie desktop.

## Checks effectués
- [x] `node --check client/public/js/index.js` — passe.
- [x] **Vérification EN DIRECT** (Browser pane, vraie page, salle
      "Présenter" IRL, régie desktop 1400px) :
  - Question avec illustration paysage : `body.irl-presenter-mode` posée,
    `#inputArea` `display:none`, illustration agrandie (≈65vh) et bien
    visible, aucune tuile de réponse affichée.
  - Question avec illustration portrait : grille repassée à une seule
    colonne (`grid-template-columns` résolu à une seule piste), image
    portrait centrée pleine largeur.
  - Question SANS illustration : aucun crash, carte simplement plus
    sobre (juste la question, pas de tuiles) — comportement attendu
    (littéralement "n'affiche RIEN en terme de réponse/gameplay").
  - Mode "à distance" (même salle, `game:setMode` avant le lancement) :
    `body.irl-presenter-mode` ABSENTE, `#inputArea` reste `display:block`
    — comportement inchangé confirmé.

## Tests manuels recommandés
Tester en conditions réelles sur plusieurs types de question (mcq,
association, blindtest...) en IRL, confirmer qu'aucun type ne laisse
échapper une trace de gameplay (ex. bandeau de révélation "Bonne réponse"
qui vivrait ailleurs que dans `#inputArea` — à vérifier au cas par cas si
signalé). Vérifier aussi la bascule d'ambiance EN COURS DE SALON (avant
lancement) : passer IRL → à distance → IRL doit à chaque fois refléter le
bon état une fois la partie lancée.

## Risques restants
- Le bandeau de révélation ("Bonne réponse"/couleurs correct/incorrect) vit
  dans `#inputArea` pour la plupart des types (tuiles qui changent de
  couleur) — masqué avec le reste en IRL, cohérent avec la demande
  ("RIEN"), mais à confirmer que le MJ n'a besoin de voir la bonne réponse
  nulle part ailleurs sur son écran (le classement/le score suffisent).
- Types sans illustration : carte assez vide en IRL (juste le texte de la
  question) — pas d'amélioration demandée pour ce cas précis, mais à
  surveiller si jugé trop sobre à l'usage réel.

## Statut
`en review`
