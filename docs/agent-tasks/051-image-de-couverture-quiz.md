# [051] Image de couverture des quiz (cartes de « Mes quiz »)

## Contexte
Les cartes de la page « Mes quiz » (`select.html` / `select.js`) affichent une pastille avec
les initiales du titre sur un dégradé. Retour utilisateur : « pouvoir mettre une image,
depuis une liste que je vais t'ajouter » — l'utilisateur fournira lui-même la bibliothèque
d'images ; les créateurs choisissent dedans (pas d'envoi de fichier libre).

## Objectif
Dans l'éditeur, un sélecteur « Image du quiz » (grille de miniatures de la bibliothèque)
permet d'associer une image à un quiz. Elle apparaît à la place des initiales sur la carte du
quiz dans « Mes quiz » et dans l'onglet des quiz publics. Sans image : comportement actuel.

## Périmètre
- Bibliothèque : dossier `client/public/img/quiz-covers/` + manifeste `covers.json`
  (`[{ "id", "label", "file" }]`) ; ajouter une image = déposer le fichier + une ligne dans le manifeste.
- Colonne `quizzes.cover` (texte, id de l'image, nullable) — **modification du schéma, à valider**.
- Éditeur : sélecteur (modale grille), lecture/écriture à l'ouverture/sauvegarde, copie à la duplication.
- `select.js` : requêtes avec `cover`, rendu de l'image sur la carte, repli sur les initiales si id inconnu.

## Où choisir l'image (2 propositions de l'utilisateur, à trancher)
- **Dans l'éditeur, avec la configuration du quiz** (titre, partage public…) : un bloc « Image du quiz » avec la popup de choix ; l'image est enregistrée avec le reste par « Sauvegarder » — même fonctionnement que le titre (aucune écriture directe en base depuis la page « Mes quiz »).
- **Crayon sur la pastille de chaque carte de « Mes quiz »** : popup de choix identique (façon sélection d'avatar), enregistrement immédiat (écriture directe de `cover` sur le quiz).
- Recommandation : commencer par l'éditeur (cohérent avec la sauvegarde actuelle), puis ajouter le crayon sur les cartes avec la MÊME popup si souhaité (peu de code en plus).

## Hors périmètre
- Envoi d'images par les utilisateurs, recadrage, modération.
- Page de jeu / résultats / liste des participants.

## Fichiers concernés
- `supabase/schema.sql` — ajout de `cover` (**validation requise** ; SQL à exécuter côté Supabase par l'utilisateur)
- `client/public/img/quiz-covers/` + `covers.json` — bibliothèque (images fournies par l'utilisateur)
- `client/public/editor.html`, `client/public/js/editor.js` — sélecteur, chargement, sauvegarde, duplication
- `client/public/js/select.js`, `client/public/css/style.css` — rendu des cartes

## Plan
1. Schéma : `alter table public.quizzes add column if not exists cover text;` (+ mise à jour de `schema.sql`) — **après accord explicite**, puis exécution par l'utilisateur.
2. Bibliothèque : dossier, manifeste, 1-2 images de test en attendant les vraies.
3. Éditeur : bouton « Image du quiz » près du titre, modale de choix, `cover` dans `persistQuiz` (insert/update) et au chargement ; copie dans « Dupliquer ».
4. `select.js` : `cover` dans les `select`, image de fond sur `.quiz-card-avatar` (repli initiales), chargement différé du manifeste.
5. Vérifications (carte avec/sans image, id supprimé de la bibliothèque, quiz public, duplication).

## Étapes réalisées
- [ ] 1
- [ ] 2
- [ ] 3
- [ ] 4
- [ ] 5

## Checks effectués
- [ ] `node --check` sur chaque fichier JS modifié
- [ ] Vérification visuelle Browser pane

## Tests manuels recommandés
À compléter à la relecture.

## Risques restants
- Tant que la colonne n'existe pas en base, les requêtes avec `cover` échouent : exécuter le SQL AVANT de déployer.
- Poids des images de la bibliothèque (affichées en petit : prévoir des fichiers légers).

## Statut
`ouverte`
