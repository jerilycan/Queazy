Relit le diff complet d'une tâche avant commit.

1. Ouvre le fichier `docs/agent-tasks/<NNN>-*.md` concerné.
2. Regarde le diff complet accumulé depuis le début de la tâche (`git diff`
   sur les fichiers listés dans "Fichiers concernés", pas seulement le
   dernier changement) — l'objectif est de juger l'ensemble, pas
   étape par étape comme `/implement-step` l'a déjà fait.
3. Vérifie contre `CLAUDE.md` : pas de refactor hors périmètre glissé en
   cours de route, pas de zone interdite touchée sans validation déjà
   obtenue, pas de dépendance ajoutée en douce, pas de `catch` vide, pas de
   duplication qui aurait pu être évitée.
4. Vérifie que l'"Objectif" du fichier de suivi est réellement atteint par
   le diff — pas juste que chaque étape du plan est cochée.
5. Documente le résultat directement dans le fichier de suivi : complète
   "Tests manuels recommandés" (ce que l'utilisateur doit vérifier à la
   main avant de pousser) et "Risques restants" (ce qui n'a pas pu être
   vérifié automatiquement, faute d'outils de test dans ce projet).

Liste les points relevés (même mineurs) dans ta réponse — ne te contente
pas de dire "tout est bon". S'il y a un vrai problème, propose le fix mais
**ne l'applique pas sans validation** : cette commande relit, elle ne
corrige pas silencieusement.
