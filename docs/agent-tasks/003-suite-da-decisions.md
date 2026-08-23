# [003] Suite refonte DA — décisions validées

## Contexte
Suite des tâches 001/002. À son retour, l'utilisateur a tranché les 8
questions laissées ouvertes (voir 002, section "Décisions prises seul").

## Décisions validées (8/8)
1. Cartes Mes Quiz : **construire** Dupliquer + Supprimer pour de vrai.
2. Pistes de course résultats : **garder** le système vertical actuel,
   ne pas reconstruire en horizontal.
3. Forme avatar : **garder** la distinction (profil = carré, jeu = rond).
4. "CRÉER" en thème clair : **garder** l'accent (déjà fait en 002).
5. Nouveau quiz : **construire** le vrai flux à 0 question (comportement,
   pas que du visuel — un quiz démarre aujourd'hui avec 1 question par
   défaut).
6. Éditeur Blind Test : **retravailler** le visuel (waveform, minuteur).
7. Connexion / Créer un compte : **vérifier et ajuster** (jamais vérifiées
   visuellement en 002).
8. Thème clair : **vérifier partout** (éditeur, résultats, connexion, profil).

## Périmètre
Les 6 items ci-dessus qui demandent une action (2, 3, 4 sont déjà réglés,
rien à faire). Point d'attention sur l'item 5 : c'est un changement de
**comportement**, pas juste de style — à traiter avec plus de soin
(`server/index.js` et/ou `editor.js` selon où vit la création par défaut).

## Fichiers concernés
- `client/public/js/select.js`, `client/public/select.html` — items 1
- `client/public/js/editor.js`, `client/public/editor.html` — items 5, 6
- `client/public/css/style.css` — items 5, 6, 8
- `client/public/login.html` — item 7
- Toutes pages — item 8 (vérification, pas forcément de code)

## Plan
1. Cartes Mes Quiz : boutons Dupliquer/Supprimer (Supabase direct depuis
   select.js, pas besoin de passer par l'éditeur).
2. Thème clair : vérification systématique éditeur/résultats/connexion/
   profil, correctifs ciblés si besoin.
3. Connexion/Inscription : passe de vérification visuelle + ajustements.
4. Éditeur Blind Test : visuel (waveform, minuteur).
5. Nouveau quiz à 0 question : le plus sensible, à faire en dernier avec
   soin (chercher où la question par défaut est créée avant de toucher
   à quoi que ce soit).

## Étapes réalisées
- [x] Item 1 — Cartes Mes Quiz : Dupliquer + Supprimer construits pour de
  vrai (`select.js`, réutilise les mêmes requêtes Supabase que
  `editor.js`), inclut `ui-widgets.js` sur `select.html` (toast + confirm).
- [x] Item 8 (partiel) — Thème clair vérifié sur `profile.html`,
  `login.html` (connexion + inscription), `result.html` : rien à corriger,
  déjà correct via les tokens. **`editor.html` non vérifiable** : requiert
  une vraie session (pas de mode invité côté éditeur), pas de compte de
  test disponible dans ce navigateur sandboxé.
- [x] Item 7 — Connexion/Inscription : vérifiées (dark + light), déjà
  conformes, aucun correctif nécessaire.
- [x] Item 6 — Éditeur Blind Test : carte dédiée autour du lecteur audio +
  icône pulsante décorative (pas une vraie forme d'onde — décoder l'audio
  réel aurait été une fonctionnalité à part entière, hors périmètre visuel).
- [x] Item 5 — Nouveau quiz à 0 question : **changement de comportement**,
  le plus sensible de cette liste. Voir détail ci-dessous.

### Item 5 en détail
- `resetToNew()` démarre maintenant à `questions = []` (au lieu d'une
  question "Texte libre" par défaut).
- Nouvel écran `#questionEmptyState` (grille de 13 types, générée depuis
  `#qType` — seule source de vérité déjà établie dans ce fichier) : choisir
  un type ajoute directement la 1ère question dans ce type.
- `deleteQuestionAt` (règle déjà existante "un quiz doit avoir au moins une
  question") reste inchangée : une fois la 1ère question ajoutée, on ne
  peut plus revenir à 0 — l'écran vide n'est possible qu'au tout début.
- Garde-fou ajouté sur `saveQuizBtn` : sauvegarder à 0 question est bloqué
  avec le même message que les gardes-fous de suppression existants.
- **Bug généralisé en le corrigeant** : le tutoriel guidé (`qzTour` dans
  `ui-widgets.js`) ciblait des champs (`#qPrompt`, `#qType`...) qui restent
  dans le DOM mais deviennent invisibles quand `#questionDetail` entier est
  masqué (`d-none`) — son filtre ne regardait que "l'élément existe", pas
  "l'élément est visible" (seul le cas `<select>` caché était déjà traité).
  Corrigé avec `offsetParent !== null`, un filtre générique — vérifié que
  c'est le SEUL appelant de `qzTour` dans tout le projet, donc pas de
  régression possible ailleurs.

## Checks effectués
- `node --check` sur tous les fichiers JS du projet (OK), équilibre des
  accolades CSS (1185/1185, OK).
- Vérifié en Browser pane (onglets neufs) : boutons Dupliquer/Supprimer
  rendus avec les bons libellés et le bon style (bug de spécificité CSS
  trouvé et corrigé en cours de route — voir Risques) ; thème clair sur
  profil/connexion/inscription/résultats.
- **Item 5 (nouveau quiz à 0 question) : PAS vérifié en conditions réelles.**
  `editor.html` exige une vraie session Supabase (aucun mode invité côté
  éditeur, contrairement à `select.html`) — pas de compte de test
  disponible dans ce navigateur sandboxé. Vérifié uniquement par lecture de
  code : cohérence avec les règles déjà existantes (garde-fous
  suppression/sauvegarde), réutilisation de `#qType` comme seule source de
  vérité, syntaxe correcte. **Priorité n°1 à tester toi-même avant de
  considérer cet item terminé.**

## Statut
`en review`
