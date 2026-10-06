# [052] Timeline — mécanique « frise qui grandit »

## Contexte
Le type Timeline et le type Ordre ont aujourd'hui la même interaction : glisser des cartes dans une liste verticale pour les remettre dans l'ordre (seul le contenu change). Retour utilisateur (25/08, relancé le 06/10) : Timeline doit tester autre chose. 5 pistes ont été maquettées (canvas « Timeline — 5 visuels », https://claude.ai/artifact/VDdb5dphm4HUeYNjjjKnJA) ; l'utilisateur a choisi la n°3 « Frise qui grandit ».

## Objectif
Pour une question Timeline, le joueur voit une frise verticale d'événements déjà datés (les « repères », dates visibles) et un lot de tuiles à placer (sans date). Il glisse une tuile vers la frise ; pendant le glissement, les emplacements possibles apparaissent, et celui survolé affiche « Déposer ici ». Chaque tuile posée rejoint la frise et crée de nouveaux emplacements autour d'elle (la frise « grandit »). Résultat vérifiable :
- les emplacements ne sont visibles que pendant un glisser de tuile (clic maintenu + déplacement), « Déposer ici » seulement sur celui survolé ;
- libellés des emplacements : « Avant tout ça » (avant la première tuile), « Entre les deux » (entre deux tuiles), « Après tout ça » (après la dernière) ;
- scoring **binaire** par tuile à placer : bien placée = points, mal placée (y compris à un cran) = 0 ; points pondérés par le temps comme les autres types, proportionnels au nombre de tuiles bien placées ;
- la révélation montre l'ordre réel avec les dates, et marque chaque tuile juste/fausse ;
- fonctionne sur joueur mobile, joueur PC, MJ et TV (miroir).

## Périmètre
- **Remplacement complet de l'ancien Timeline** (liste à réordonner) : plus de mode « ordre », pas de rétrocompatibilité du rendu ; les questions Timeline déjà sauvegardées doivent rester ouvrables (migration douce, à définir au plan).
- Rendu joueur : frise verticale (rail + dates + cartes), emplacements apparaissant au glisser, réserve de tuiles « À insérer », validation.
- Éditeur : le créateur saisit ses événements datés et désigne lesquels sont des repères visibles (les autres sont à placer par le joueur) ; au moins 1 repère et 1 tuile à placer.
- Serveur : scoring par tuile, révélation, historique (`historyEntry`), récap, et non-envoi des dates des tuiles à placer avant la révélation.
- Révélation côté joueur, TV/MJ (miroir), page de résultats si elle affiche des réponses Timeline.
- Prévisualisation « Tester cette question » de l'éditeur (à vérifier).

## Hors périmètre
- Les 4 autres pistes (axe temporel, Avant/Après, ligne de métro, règle de précision).
- État partagé entre questions d'un même quiz (la frise grandit **dans** une question, pas d'une question à l'autre).
- Modification de `supabase/schema.sql` (questions stockées en JSON dans `quizzes.questions`).
- Refonte de l'Ordre / Rangement.

## Décisions validées (06/10)
1. L'ancien Timeline est **supprimé entièrement** (pas de mode double).
2. Le créateur désigne dans l'éditeur ce qui est repère / à placer (pas de tirage aléatoire).
3. Barème : exact = points pleins, **voisin = 0**.
4. Dates égales : les emplacements adjacents sont tous acceptés.
5. Les emplacements apparaissent au clic-glisser d'une tuile ; chaque pose crée de nouveaux emplacements (« Avant tout ça » / « Entre les deux » / « Après tout ça »). Interprétation retenue : plusieurs tuiles à placer par question, posées une par une ; les tuiles déjà posées restent déplaçables jusqu'à la validation.

## Choix techniques retenus au plan
- **Modèle de données** : `q.correct = [{title, description, date, anchor}, ...]` (même tableau qu'aujourd'hui, un champ `anchor: true` en plus = repère visible). Pas de nouveau champ de question, pas de changement de schéma (JSON dans `quizzes.questions`, idem `bank_questions`). Trade-off : un champ par événement plutôt qu'une liste d'index de repères à part → impossible de désynchroniser les deux quand on supprime/réordonne un événement.
- **Migration des anciennes questions** : si aucun événement n'a `anchor`, l'événement à la date médiane devient repère, les autres sont à placer (règle unique, appliquée dans l'éditeur à l'ouverture de la question et dans `emitQuestion` côté hôte, jamais dans `server/index.js`). Trade-off : on garde les quiz existants jouables sans script de migration ; le créateur peut ensuite corriger dans l'éditeur.
- **Qui est « bien placé »** (règle indépendante des erreurs des autres tuiles) : une tuile à placer est juste si (a) le nombre de repères situés avant elle dans la séquence soumise est compatible avec sa date (dates égales tolérées), et (b) elle n'est inversée par rapport à aucune autre tuile posée dans le même emplacement. Trade-off : comparer l'index final à l'index réel ferait tomber des tuiles justes dès qu'une seule autre est mal posée.
- **Score** : `pointsFor(...) × tuiles justes / tuiles à placer` (même proportionnalité que l'ancien Timeline), 0 par tuile fausse, voisin compris. Une tuile non posée au moment de l'envoi est fausse.
- **Données envoyées aux joueurs** : `timelineAnchors` (titre, description, **date**, clé) triés par date + `timelineItems` (tuiles à placer, titre/description/clé, **sans date**, mélangées). `q.correct` complet reste serveur / hôte, jamais diffusé avant la révélation (comportement actuel conservé).
- **Contenu soumis** : `JSON.stringify([clés dans l'ordre de la frise, repères et tuiles posées])` — même canal `answer:submit` / `payload.content` qu'avant ; le serveur retrouve les repères via `q.correct[k].anchor`.
- **Interaction** : glisser au pointeur (même mécanique pointer events que `wireOrderDrag`/`wireRangement…`) d'une tuile de la réserve **ou d'une tuile déjà posée** ; une copie fantôme suit le doigt ; pendant le glisser seulement, des emplacements s'insèrent dans la frise avec leur libellé (« Avant tout ça » / « Entre les deux » / « Après tout ça »), celui survolé s'agrandit en « Déposer ici ». Lâcher hors emplacement = la tuile retourne où elle était. Trade-off : pas de mode « tap sur l'emplacement » en plus, pour garder une seule interaction à tester (à rouvrir si les retours mobile le demandent).
- **Rendu TV / MJ** : la TV est un miroir DOM de l'écran de l'hôte (tâche 042) — pas de rendu dédié ; seuls les styles `body.display-body .timeline-*` sont à adapter.
- **Zones interdites CLAUDE.md** : aucune touchée (pas de `schema.sql`, pas de `render.yaml`, pas de dépendance). Aucun `git push` dans ce plan ; la pousse reste soumise à ton feu vert, et le bump `APP_VERSION` se fait à ce moment-là.

## Fichiers concernés
- `server/index.js` — scoring `answer:submit` (branche `timeline`, ~L2314), révélation (`revealQuestion`, ~L571), émission de la question (ne pas envoyer la date de l'événement à placer), historique.
- `client/public/js/index.js` — `buildTimelineList` / `wireTimelineDrag` / `revealTimelineList` (~L2041-2175), `emitQuestion` payload (~L7265), `QUESTION_TYPE_META` (~L742).
- `client/public/index.html` — markup `#timelineArea`.
- `client/public/js/editor.js` + `client/public/editor.html` — saisie des événements, désignation de l'événement à placer, aide.
- `client/public/css/style.css` — styles `.timeline-*` de la frise (rail, emplacements, carte à insérer, révélation).
- `client/public/js/display.js` — vue TV (miroir : vérifier seulement).
- `client/public/js/results.js` — récap éventuel des réponses Timeline (à vérifier).
- `docs/agent-tasks/052-timeline-frise-qui-grandit.md` — ce suivi.

## Plan
1. **Éditeur : modèle et saisie** (`editor.js`, `editor.html`, `style.css`, `admin-bank.js`). Chaque événement a un interrupteur « Repère visible / À placer » ; règles : au moins 1 repère et 1 tuile à placer, 2 à 8 événements, titre et date obligatoires ; suppression du glisser-réordonner des lignes (l'ordre de saisie n'a plus d'importance) ; normalisation de migration à l'ouverture d'une ancienne question ; textes d'aide du type mis à jour ; libellé de la banque d'admin. Vérif : Browser pane (ajout, bascule, sauvegarde, rechargement, ancienne question migrée).
2. **Serveur : score, révélation, historique** (`server/index.js`). Remplacer la branche `timeline` de `answer:submit` par la règle « bien placé » ci-dessus ; `revealQuestion` renvoie toujours les événements triés par date (avec `anchor`) ; `answerDetails` = une ligne par tuile (✓/✗ + titre) ; garde-fous (soumission invalide, 0 repère, 0 tuile). Vérif : `node --check`, fonction de scoring pure testée à la main avec un petit script (cas : tout juste, tout faux, voisin, dates égales, tuile non posée), démarrage serveur.
3. **Client : payload et rendu statique de la frise** (`index.js` `emitQuestion` + `buildTimelineBoard`, `index.html`, `style.css`). Envoi de `timelineAnchors` / `timelineItems`, rendu fidèle à la maquette n°3 (rail, dates des repères, réserve « À insérer »), verrouillage / déverrouillage au `startTs`, nettoyage entre questions. Aucune interaction encore. Vérif : Browser pane en mode Jouer et via « Tester cette question ».
4. **Client : glisser-déposer** (`index.js`). Interaction décrite plus haut (réserve → frise, déplacement d'une tuile posée, emplacements dynamiques avec libellés, « Déposer ici » au survol, retour si lâché hors emplacement, défilement auto pendant le glisser via `startAutoScrollOnDrag`), `submitCurrentAnswer` / envoi automatique à la fin du chrono. Vérif : souris et émulation tactile mobile, vue PC, dépôt aux trois types d'emplacements.
5. **Révélation, bandeau de résultat, récap, TV/MJ** (`index.js`, `style.css`). Reconstruire la frise dans l'ordre réel avec les dates, tuiles justes/fausses (même règle que le serveur, recalculée côté client comme le fait déjà le Timeline actuel), bandeau « Presque ! x/y bien placés », récap multiligne ; styles `body.display-body` pour la TV ; vérif du miroir TV et de l'aperçu de l'éditeur.
6. **Nettoyage et review** : supprimer l'ancien code (`wireTimelineDrag`, `revealTimelineList` ancienne version, styles `.timeline-item` morts), mettre à jour les commentaires, puis `/review` et `/close-task`.

Chaque étape = un diff relu et validé avant la suivante (`/implement-step`).

## Étapes réalisées
- [x] 1. Éditeur : modèle (`anchor`) et saisie — interrupteur Repère visible / À placer, 2 à 8 événements, migration des anciennes questions, validation à la sauvegarde, libellé banque admin
- [ ] 2. Serveur : score, révélation, historique
- [ ] 3. Client : payload et rendu statique de la frise
- [ ] 4. Client : glisser-déposer
- [ ] 5. Révélation, bandeau, récap, TV/MJ
- [ ] 6. Nettoyage et review

## Checks effectués
- [x] `node --check <fichier>` sur chaque fichier JS modifié (étape 1 : editor.js, admin-bank.js)
- [ ] Démarrage serveur vérifié (si `server/index.js` touché)
- [ ] Vérification visuelle Browser pane (si client touché) — étape 1 faite : création d'une question Timeline, bascule des rôles, résumé « n repères · m à placer », migration d'une ancienne question (médiane → repère) ; la sauvegarde réelle (toast d'erreur 0 repère) reste à tester à la main

## Tests manuels recommandés
(à remplir au /review)

## Risques restants
(à remplir au /review)

## Statut
`en cours`
