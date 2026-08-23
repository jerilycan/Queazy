Cadre une nouvelle tâche non triviale sur QuEazy.

1. Demande à l'utilisateur (si ce n'est pas déjà clair dans la conversation)
   ce qu'il veut faire, en une phrase.
2. Regarde `docs/agent-tasks/` pour trouver le prochain numéro disponible
   (le plus haut numéro existant + 1 ; `000-template-task.md` ne compte pas).
3. Copie `docs/agent-tasks/000-template-task.md` vers
   `docs/agent-tasks/<NNN>-<slug-court>.md`.
4. Remplis Contexte, Objectif, Périmètre, Hors périmètre et Fichiers
   concernés (explore le repo si besoin pour lister les fichiers
   pertinents) — mais **laisse Plan, Étapes réalisées, Checks, Tests
   manuels et Risques vides ou à l'état de squelette** : ce n'est pas
   l'objet de cette commande.
5. Statut : `ouverte`.

**Ne modifie AUCUN fichier de code.** Une fois le fichier de suivi écrit,
affiche-en le contenu et **attends la validation de l'utilisateur** avant de
continuer — il va probablement corriger le périmètre. N'enchaîne pas
automatiquement sur `/plan-feature`.
