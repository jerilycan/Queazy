Clôture une tâche déjà passée par `/review`.

1. Ouvre le fichier `docs/agent-tasks/<NNN>-*.md` concerné.
2. Vérifie que toutes les étapes du Plan sont cochées dans "Étapes
   réalisées" — sinon, dis-le et n'avance pas la clôture.
3. Passe le Statut à `clôturée`.
4. Propose un message de commit (français, cohérent avec l'historique du
   projet — voir `git log --oneline` pour le ton) qui résume la tâche, sans
   le lister mot pour mot le contenu du fichier de suivi.
5. Rappelle explicitement : **ne pas pousser sans feu vert de
   l'utilisateur**, même si tout est vert ici — c'est une consigne
   permanente du `CLAUDE.md`, pas une option de cette commande.

Ne fais pas le commit toi-même sans que l'utilisateur ait validé le message
proposé.
