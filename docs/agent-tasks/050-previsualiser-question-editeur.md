# [050] Prévisualiser une question depuis l'éditeur (« Tester cette question »)

## Contexte
Retour utilisateur : « un moyen de prévisualiser sa question, en mode test, directement »
depuis l'éditeur. Aujourd'hui, pour voir le rendu joueur d'une question il faut la publier
en banque puis ouvrir l'aperçu admin, ou lancer une vraie partie.

Un mécanisme existe déjà côté client (tâche 028) : `index.js` accepte
`?previewBankQuestion=<id>`, charge UNE question de `bank_questions`, crée une salle en mode
« Jouer » (`room.mode === 'auto'`) et la fait jouer comme un joueur (répond, valide,
voit la révélation). Le serveur ne stocke aucun quiz : c'est le client hôte qui lui envoie le
contenu de chaque question — aucune modification serveur nécessaire.

## Objectif
Un bouton « ▶ Tester cette question » dans l'éditeur ouvre, dans une fenêtre superposée
(sans quitter l'éditeur), la question en cours d'édition telle qu'un joueur la vit : énoncé,
minuteur, réponse, validation, révélation. Fonctionne sur les 17 types, y compris pour une
question jamais sauvegardée.

## Périmètre
- Nouveau paramètre `?previewEditorQuestion=1` dans `index.js` : même mécanique que
  `previewBankQuestion`, mais la question arrive de l'éditeur par `postMessage`
  (pas par Supabase ni par `localStorage` : les images/sons en data URI dépassent vite le quota).
- Bouton + modale (iframe) dans l'éditeur ; poignée de main `postMessage`
  (l'aperçu dit « prêt », l'éditeur envoie la question, vérification d'origine).
- Contrôle minimal avant lancement (réutiliser `validateQuestion` de l'éditeur) avec le même
  message d'erreur qu'à la sauvegarde.
- Fermeture de la modale = fin de l'aperçu (la salle éphémère disparaît avec la déconnexion).

## Hors périmètre
- Aucun changement serveur, schéma, dépendance.
- Pas d'aperçu multi-joueurs ni de vue TV/MJ.
- Pas de sauvegarde automatique de la question en testant.

## Fichiers concernés
- `client/public/js/index.js` — mode `previewEditorQuestion` (factoriser avec le bloc `previewBankQuestion`)
- `client/public/js/editor.js` — bouton, modale, envoi de la question
- `client/public/editor.html`, `client/public/css/style.css` — bouton et modale

## Plan
1. `index.js` : factoriser le chargement d'une question d'aperçu (lecture bank / lecture message) ; ajouter l'attente du message de l'éditeur (avec délai d'expiration et message d'erreur lisible).
2. `editor.js` : `saveCurrentQuestionState()` + validation, modale iframe `/?previewEditorQuestion=1`, envoi de la question au signal « prêt », fermeture propre (Échap / bouton).
3. Bouton « ▶ Tester cette question » (visible dès qu'une question est sélectionnée, masqué en lecture seule ? à confirmer) + styles.
4. Vérification sur plusieurs types (QCM, texte libre, image, blind test avec son, ordre) : rendu, minuteur, révélation ; question jamais sauvegardée ; erreurs.

## Étapes réalisées
- [x] 1 — `index.js` : mode `?previewEditorQuestion=1` (poignée de main postMessage, fin d'aperçu sans page de résultats)
- [x] 2 — `editor.js` : modale iframe, validation, envoi de la question, « Recommencer », Échap
- [x] 3 — bouton « ▶ Tester » dans la barre flottante + styles
- [ ] 4 — vérification visuelle (bloquée : session de connexion du Browser pane à refaire)

## Checks effectués
- [ ] `node --check` sur chaque fichier JS modifié
- [ ] Vérification visuelle Browser pane

## Tests manuels recommandés
À compléter à la relecture.

## Risques restants
- L'aperçu dépend du mode « Jouer » : son comportement (scores, classement final) doit rester sans effet de bord (pas d'écriture en base, vérifier `quiz_results`).
- Audio : l'autoplay peut être bloqué dans l'iframe avant une interaction.

## Statut
`en cours`
