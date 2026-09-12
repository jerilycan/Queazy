# [038] Régie MJ : plus de colonnes plutôt que réduire les tuiles

## Contexte
Retour utilisateur, en réaction directe à un cas mis en évidence pendant
les tests de la tâche [037](037-agrandir-image-espace-libre-regie.md)
(agrandir l'image dans l'espace libre du bloc central) : sur un QCM avec
beaucoup d'options (testé avec 8), le filet de sécurité existant
`fitStageContent` (tâche [029](029-fit-stage-content-regie.md)) réduit
TOUT le contenu de la carte via `zoom` (jusqu'au plancher
`STAGE_FIT_MIN_ZOOM = 0.55`) pour éviter le scroll — y compris les tuiles
de réponse, qui deviennent nettement plus petites et moins lisibles.

`.options-grid` (mcq/truefalse/intrus) est aujourd'hui figée à exactement
2 colonnes (`grid-template-columns: repeat(2, 1fr)`, `style.css` ligne
~1778) quel que soit le nombre d'options — plus il y a d'options, plus la
grille s'allonge en HAUTEUR (plus de rangées), jusqu'à dépasser l'espace
disponible et déclencher la réduction globale par zoom. Demande
explicite : les tuiles de réponse doivent garder leur taille actuelle (ou
à peine plus petite) pour rester lisibles — s'il faut de la place en plus,
l'ajouter en LARGEUR (plus de colonnes) plutôt qu'en récupérant de la
hauteur au prix d'un rétrécissement global.

## Objectif
En régie MJ desktop (`body.is-host.game-active`, ≥1100px), quand une
question a beaucoup d'éléments de réponse (cas cité : QCM à beaucoup
d'options ; `.options-grid`, types mcq/truefalse/intrus) : la grille
s'étale en plus de colonnes plutôt que de s'allonger en hauteur, de sorte
que chaque tuile garde une taille proche de sa taille actuelle (celle déjà
utilisée aujourd'hui, ≥1300px : `min-height: 88px; font-size: 20px`, voir
`style.css`) au lieu de dépendre de `fitStageContent` pour tenir dans le
cadre.

## Périmètre
- `.options-grid` (mcq/truefalse/intrus) — le cas cité explicitement,
  actuellement figé à 2 colonnes indépendamment du nombre d'options.
- Garder le rendu ACTUEL inchangé pour un nombre d'options "normal" (ex.
  4, le cas le plus courant) — pas question de repasser en 3-4 colonnes
  par défaut pour un QCM classique, seulement quand le nombre d'options
  dépasse ce que 2 colonnes peuvent raisonnablement contenir sans
  déclencher `fitStageContent`.
- `fitStageContent` reste en place comme filet de sécurité DERNIER
  RECOURS (cas réellement extrême — énoncé très long + beaucoup
  d'options + image, où même en colonnes ça ne suffirait pas) — cette
  tâche vise à le rendre inutile dans l'immense majorité des cas, pas à
  le retirer.
- Uniquement régie desktop (`body.is-host.game-active`, ≥1100px) — même
  portée que les tâches 028/029/030/031/037, jamais la vue joueur/mobile
  (qui garde sa propre disposition, pensée pour un écran étroit où
  ajouter des colonnes n'aurait pas de sens).

## Hors périmètre
- **À confirmer avec l'utilisateur avant `/plan-feature`** : les autres
  zones à liste d'éléments qui peuvent aussi s'allonger — `association`
  (déjà une disposition adaptative en rangées, tâche récente hors suivi
  agent-tasks, probablement déjà satisfaisante), `rangement` (déjà des
  rangées adaptatives par zone, tâche 013), `order`/`timeline` (liste
  SÉQUENTIELLE où l'ordre de lecture compte — passer en plusieurs
  colonnes casserait la lecture "qui suit qui", probablement à exclure
  par nature). Cadrées ici comme hors périmètre par défaut ; seul
  `.options-grid` est traité dans cette tâche sauf validation contraire.
- Vue joueur (mobile/tablette/PC) : disposition actuelle inchangée.
- Toute modification du plancher `STAGE_FIT_MIN_ZOOM` ou de la logique
  interne de `fitStageContent` lui-même (tâche 029) — reste tel quel,
  seulement moins souvent sollicité.

## Fichiers concernés
- `client/public/css/style.css` — `.options-grid` (ligne ~1778, figée à
  `repeat(2, 1fr)`) : à rendre dépendante du nombre d'options en régie
  desktop (probablement via une variable CSS `--options-cols` posée en
  JS, plutôt qu'un `auto-fit` pur qui changerait aussi le rendu du cas à
  4 options déjà satisfaisant — à trancher au planning).
- `client/public/js/index.js` — construction des tuiles MCQ/truefalse/
  intrus (`question:show`, bloc `optionsDiv`/`.options-grid`, voir aussi
  `buildOptions`-like logic déjà en place) : poser le nombre de colonnes
  selon le nombre d'options, uniquement en régie desktop.
- `docs/agent-tasks/029-fit-stage-content-regie.md` et
  `037-agrandir-image-espace-libre-regie.md` — référence historique
  uniquement, pas de modification de leur contenu.

## Plan
_à remplir par `/plan-feature`_

## Étapes réalisées
- [ ]

## Checks effectués
- [ ] `node --check client/public/js/index.js`
- [ ] Vérification visuelle (script Playwright jetable, comme pour les
      tâches 036/037 — aucun outil Browser pane interactif dans cette
      session distante)

## Tests manuels recommandés
_à remplir par `/plan-feature`_

## Risques restants
_à remplir par `/plan-feature`_

## Statut
`ouverte`
