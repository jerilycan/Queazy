# QuEazy — Contrat de travail IA

## Rôle
Assistant de dev sur QuEazy (quiz multijoueur type Kahoot). Cadre-toi sur ce
fichier avant d'improviser une architecture ou une convention.

## Stack (telle quelle, ne pas la faire dévier)
- **Serveur** : Node/CommonJS, Fastify + Socket.io, un seul fichier
  `server/index.js` (~2300 lignes, toute la logique temps réel : rooms,
  sockets, modération). Pas de dossier `src/`, pas de framework serveur
  au-delà de Fastify.
- **Client** : HTML/CSS/JS vanilla statique dans `client/public/`, servi
  directement par `@fastify/static`. **Pas de bundler, pas de build step,
  pas de framework front** (pas de React/Vue à introduire ici).
- **DB** : Supabase, schéma dans `supabase/schema.sql`.
- **Déploiement** : Render (`render.yaml`, service `queazy`), auto-deploy sur
  push `main`.
- **Design** : voir `design-system/` (pages HTML de référence — couleurs,
  boutons, navbar, cartes...) pour les tokens visuels actuels.

## Priorités
1. Comprendre l'existant avant de modifier — surtout dans `server/index.js`,
   qui est un monolithe : une modif imprudente a un rayon d'impact large.
2. Pas de sur-ingénierie : ne pas introduire de framework, de bundler, de
   couche d'abstraction ou de dossier `src/` sous prétexte de "mieux
   structurer" — ce n'est pas le style du projet, et ce n'est jamais demandé
   à la légère.
3. Nommage clair, cohérent avec l'existant (français dans les commentaires et
   les commits, anglais dans les identifiants de code — reprendre l'usage en
   place).
4. Pas de refactor hors périmètre de la tâche demandée.

## Règles de code
- Pas de duplication évitable, pas d'abstraction inutile pour un seul point
  d'usage.
- Jamais de `catch` vide ou de `try/catch` qui avale une erreur sans au
  moins un commentaire expliquant pourquoi c'est volontaire (le code existant
  fait déjà ça bien — voir les commentaires dans `server/index.js` et
  `client/public/js/*.js`, à imiter).
- Garder les fichiers courts quand c'est raisonnable ; ne pas forcer un
  découpage sur `server/index.js` sans qu'on le demande explicitement.
- Le CSS vit dans `client/public/css/style.css` — pas de nouvelle feuille de
  style parallèle, pas de styles inline sauf usage déjà existant du même
  genre (composants générés dynamiquement en JS).

## Interdictions sans validation explicite
- **Ne rien pousser (`git push`) sans feu vert explicite de l'utilisateur** —
  consigne permanente, plus stricte que toute règle ci-dessous, valable même
  si une tâche semble "évidemment" terminée.
- Ne pas modifier `supabase/schema.sql` (schéma DB) sans validation.
- Ne pas modifier `render.yaml` (config de déploiement) sans validation.
- Ne jamais committer de secret ou de `.env` (rien n'est tracké aujourd'hui,
  ça doit rester ainsi — les secrets vivent uniquement côté Render).
- Ne pas introduire de dépendance (npm) sans validation — la liste actuelle
  dans `server/package.json` est volontairement minimale.
- Ne pas toucher `.claude/settings.local.json` ni `.claude/launch.json` sans
  qu'on le demande (ces fichiers locaux contiennent aussi des réglages
  d'autres projets de l'utilisateur, gitignorés — pas de nettoyage
  "au passage").

## Checks obligatoires
**Aucun outil de vérification automatique n'existe dans ce projet
aujourd'hui** (pas de lint, pas de typecheck — pas de TypeScript —, pas de
tests, pas de build). Ne pas en inventer un qui n'existe pas. À la place,
après toute modif :
- `node --check server/index.js` (ou le fichier JS modifié) pour attraper au
  moins les erreurs de syntaxe.
- Pour une modif serveur : proposer de démarrer `npm start` dans
  `server/` et vérifier que ça boote sans erreur.
- Pour une modif client : proposer une vérification visuelle via le Browser
  pane plutôt qu'affirmer que "ça marche" sans l'avoir vu.
Si un vrai outil (ESLint, tests) est ajouté un jour, mettre cette section à
jour en conséquence.

## Mode "tâche simple"
Pour une modif triviale (typo, un style, un texte, un petit bugfix isolé) —
pas de cérémonie : analyser → modifier → check ci-dessus → résumer en une
ou deux phrases ce qui a changé. Le workflow `/new-task` →
`/plan-feature` → `/implement-step` est réservé aux tâches non triviales
(nouvelle feature, refactor, changement touchant plusieurs fichiers).
