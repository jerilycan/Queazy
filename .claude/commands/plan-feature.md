Produit le plan technique d'une tâche déjà cadrée par `/new-task`.

1. Trouve le fichier `docs/agent-tasks/<NNN>-*.md` concerné (demande lequel
   si plusieurs sont `ouverte` et que ce n'est pas évident dans la
   conversation).
2. Explore réellement le code des fichiers listés dans "Fichiers concernés"
   (et tout fichier voisin pertinent découvert en chemin) avant de proposer
   quoi que ce soit — pas de plan à partir d'hypothèses.
3. Remplis la section **Plan** du fichier de suivi avec des étapes
   concrètes et **découpées pour être validées une par une** (chaque étape
   doit être un diff raisonnable à relire, pas "tout le serveur" d'un coup).
4. Pour chaque option d'implémentation non évidente, note le trade-off en
   une phrase (pourquoi ce choix plutôt qu'un autre) directement dans le
   Plan ou en note sous l'étape concernée.
5. Signale explicitement si le plan touche une zone listée dans les
   "Interdictions" du `CLAUDE.md` (schéma DB, `render.yaml`, nouvelle
   dépendance) — ces étapes-là auront besoin d'une validation dédiée au
   moment de `/implement-step`, pas seulement ici.

**Ne code rien.** Affiche le plan mis à jour et attends la validation avant
de lancer `/implement-step`.
