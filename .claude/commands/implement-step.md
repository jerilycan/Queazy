Implémente UNE SEULE étape du plan d'une tâche en cours.

1. Ouvre le fichier `docs/agent-tasks/<NNN>-*.md` concerné, repère la
   première étape du Plan pas encore cochée dans "Étapes réalisées".
2. Si cette étape touche une zone listée dans les "Interdictions" du
   `CLAUDE.md` (schéma DB, `render.yaml`, nouvelle dépendance, ou implique
   un `git push`), **arrête-toi et demande confirmation explicite avant de
   toucher au code** — ne suppose pas que la validation du plan couvrait
   déjà ce détail.
3. Implémente cette étape, et seulement celle-là — pas la suivante, même si
   elle semble triviale ou "tant qu'on y est".
4. Lance les checks pertinents du `CLAUDE.md` (`node --check` sur les
   fichiers JS modifiés, démarrage serveur si `server/index.js` est touché,
   vérification Browser pane si le client est touché).
5. Coche l'étape dans "Étapes réalisées", ajoute les checks effectués dans
   la section correspondante du fichier de suivi.

**Arrête-toi après cette étape.** Résume le diff (ce qui a changé et
pourquoi) et attends la review de l'utilisateur avant de relancer
`/implement-step` pour l'étape suivante.
