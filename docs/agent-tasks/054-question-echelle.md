# [054] Nouveau type de question « Échelle »

## Contexte
Demande de l'utilisateur, inspirée du jeu Magnitudle (joué en stream) :
deviner la taille réelle d'un élément en le comparant à une référence de
hauteur connue. Exemple : une console Wii (référence) et Psykokwak (à
deviner), thème culture pop. Aucun type actuel ne propose ce geste. Le plus
proche est la Graduation (curseur numérique), mais elle n'a pas de
comparaison visuelle.

Constat utile pour le mode « Jouer » : `bank_questions.question` est un
`jsonb` libre et `bank_questions.type` un `text` sans contrainte (voir
`supabase/schema.sql`). Un nouveau type peut donc entrer dans la banque
par le bouton existant « Ajouter à la banque » de l'éditeur, **sans
modifier le schéma**.

## Objectif
Un créateur peut ajouter une question « Échelle » à un quiz :
- deux images, la **référence** et l'**élément à deviner** ;
- la hauteur réelle de chacune, en cm.

En partie :
- les deux silhouettes sont posées sur le même sol ;
- chaque joueur redimensionne l'élément jusqu'à la taille qu'il pense
  réelle, puis valide.

À la révélation :
- la silhouette **grisée à la vraie taille** apparaît à côté de celle du
  joueur, sur les téléphones, chez le MJ et sur l'écran TV ;
- un bandeau donne la réponse du joueur, la vraie taille et l'écart ;
- **les silhouettes de tous les joueurs** s'affichent, chacune à la
  taille proposée par son joueur, pour que tout le monde les voie
  (demande de l'utilisateur, comme les points de chaque joueur au
  mode « image ») :
  - le **pseudo** est écrit au-dessus de chaque silhouette ;
  - chaque joueur a **sa propre couleur**, la même pour sa silhouette et
    son pseudo, pour qu'on les distingue ;
  - la couleur est attribuée par le serveur et transmise avec la
    révélation, pour être identique sur tous les écrans.

Points :
- **selon la précision uniquement**, sans composante vitesse (décision
  de l'utilisateur) ;
- écart mesuré en **rapport** (échelle logarithmique), pas en cm ;
- plein barème (1000) quand la réponse est quasi exacte, puis
  décroissance jusqu'à 0. Les seuils exacts seront fixés au plan.

Le calcul est fait par le serveur, sans modération du MJ. Le type
fonctionne donc en « Présenter » comme en « Jouer ».

## Périmètre
- **Éditeur** :
  - nouveau type dans la liste des types ;
  - section dédiée : deux images, deux hauteurs en cm, libellé de chaque
    élément ;
  - recadrage automatique de chaque image au ras du dessin (pixels
    non transparents, via canvas, sans dépendance) ;
  - aperçu « Tester » ;
  - envoi des images par le chemin déjà en place (`uploadQuestionMedia`).
- **Écran de jeu** (`index.js` / `index.html`) :
  - les deux silhouettes sur un même sol, en aplat de couleur (référence
    et élément de couleurs distinctes) ;
  - poignée à glisser et curseur de réglage fin, sur une échelle
    logarithmique ;
  - vue qui se dézoome pour garder les deux silhouettes à l'écran ;
  - verrouillage après validation, comme les autres types.
- **Serveur** (`server/index.js`) :
  - réception de la taille proposée, avec contrôle des bornes ;
  - calcul des points de précision, sans vitesse ;
  - historique et récap ;
  - vraie taille transmise dans `revealPayload` ;
  - liste de tous les joueurs ayant répondu (pseudo, taille proposée,
    indice de couleur), sur le modèle de `imagePlayers` du mode « image ».
- **Révélation** :
  - silhouette grisée à la vraie taille ;
  - silhouettes de tous les joueurs, chacune de sa couleur, avec le pseudo
    au-dessus. Disposition à fixer au plan : côte à côte sur le sol, avec
    une réduction automatique quand il y a beaucoup de joueurs, et des
    pseudos qui ne se chevauchent pas ;
  - bandeau « Ta réponse / Réelle / écart » ;
  - bandeau personnel Bonne réponse / Presque / Mauvaise réponse, cohérent
    avec les points.
- **Écran TV** : vérifier que la copie de `#stageWrap` rend correctement
  les silhouettes (taille et cadrage sur grand écran), et corriger si
  besoin dans `display.js`.
- **« Comment jouer ? »** : métadonnées du type (`QUESTION_TYPE_META`) et
  étapes dans `TUTO_STEPS`.
- **Banque / mode Jouer** :
  - le type est accepté par la génération automatique (pas d'exclusion) ;
  - libellé ajouté dans l'admin de la banque (`admin-bank.js`).
- CSS dans `client/public/css/style.css`.

## Hors périmètre
- Toute modification de `supabase/schema.sql` (non nécessaire, voir
  Contexte).
- Une bibliothèque intégrée de références toutes prêtes (humain,
  porte, Wii…). C'est une idée évoquée, à faire dans une tâche séparée si
  l'utilisateur la valide.
- Le remplissage de la banque avec des questions « Échelle » (contenu, pas
  du code).
- La vidéo de démo de « Comment jouer ? ». Elle se génère avec le moteur
  de démos hors dépôt et viendra après, une fois l'écran de jeu stabilisé.
  En attendant, le type n'a pas de vidéo, ou la fenêtre gère son absence.
- Toute composante vitesse dans les points.
- La modération MJ : aucune réponse ne passe en attente.
- Les tailles autres que la hauteur (largeur, volume).

## Fichiers concernés
- `client/public/editor.html` : option du type et section de saisie
  (images, hauteurs).
- `client/public/js/editor.js` :
  - formulaire du type ;
  - recadrage automatique des images ;
  - validation et sérialisation de la question ;
  - envoi des médias (`uploadQuestionMedia`).
- `client/public/index.html` : zone de jeu (silhouettes, sol, poignée,
  curseur) dans `#stageWrap`.
- `client/public/js/index.js` :
  - `QUESTION_TYPE_META` et `TUTO_STEPS` ;
  - affichage à `question:show` ;
  - interaction et envoi de la réponse ;
  - verrouillage ;
  - révélation et bandeau de résultat.
- `server/index.js` :
  - branche `answer:submit` du type ;
  - calcul des points ;
  - `revealPayload` ;
  - récap (`buildRecap`).
- `client/public/js/display.js` : ajustements éventuels pour l'écran TV
  (cadrage des silhouettes).
- `client/public/js/admin-bank.js` : libellé et résumé du type dans
  l'admin de la banque.
- `client/public/css/style.css` : styles de la scène, des silhouettes, de
  la poignée et de la révélation.

## Plan
_(à remplir par `/plan-feature`)_

## Étapes réalisées
- [ ] _(à remplir)_

## Checks effectués
- [ ] `node --check <fichier>` sur chaque fichier JS modifié
- [ ] Démarrage serveur vérifié (si `server/index.js` touché)
- [ ] Vérification visuelle Browser pane (si client touché)

## Tests manuels recommandés
_(à remplir)_

## Risques restants
_(à remplir — à surveiller dès le plan : la lisibilité des silhouettes de
tous les joueurs quand ils sont nombreux, 15-20 en soirée, en particulier
sur un téléphone)_

## Statut
`ouverte`
