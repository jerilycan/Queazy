# [008] Alignement sur les designs décidés (audit multi-canvas)

## Contexte
Audit systématique de tous les canvases de design QuEazy (52 artboards :
"Écran hôte" — Menu/Lobby/Host_*/Player_*/PlayerPC_* — "Mes Quiz" et
"Résultats/Profil/Connexion") contre le code actuel, fait via 6 agents en
parallèle. Le lobby avait déjà été traité (voir
`docs/agent-tasks/007-refonte-lobby-salon-attente.md`). 2 bugs CSS trouvés
pendant l'audit (`border-accent`/`border-danger` inexistantes) ont déjà été
corrigés séparément (`login.html`, `profile.html`, `style.css`
`.btn-danger-outline`).

Décisions prises avec l'utilisateur pour les écarts qui en nécessitaient une :

| Sujet | Décision |
|---|---|
| Zoomguess en IRL (image masquée côté joueur, casse le mécanisme) | **Exception** : afficher l'image même en IRL pour ce type précis. |
| Mode "à distance" (aucun traitement visuel dédié) | **Aligner sur le design** : navbar masquée + roue crantée + pastille "🌐 Connecté à distance", comme en IRL. |
| Zoomguess — forme du cadre (rectangle actuel vs cercle design) | **Garder le rectangle** — écart assumé, pas corrigé. |
| "Quiz publics" — bouton "▶ Jouer ce quiz" absent | **Lancer une partie hôte directement** avec ce quiz, sans passer par l'éditeur. |
| "Reveal" — bascule nette vs révélation progressive | **Implémenter la révélation progressive**, liée au chrono. |
| Tableau "Détail" des résultats — lignes plates vs "pilules" | **Passer aux lignes pilules** (le texte de réponse ajouté depuis reste). |

## Objectif
Implémenter les écarts réels restants entre le design décidé et le code,
dans l'ordre : correctifs simples sans risque d'abord, puis les 3 chantiers
plus consistants (mode à distance, révélation progressive Reveal, flux
"Jouer" depuis Quiz publics) qui touchent à de la logique de jeu/flux, pas
juste du style.

## Périmètre
1. Type "Order" (hôte + joueur) : badge numéroté manquant.
2. Type "Intrus" (hôte + joueur PC) : grille 2 colonnes → 3 colonnes desktop.
3. Types Free/Reveal/Pbac/Blindtest/Zoomguess (joueur) : bouton "Envoyer" →
   "Valider" + layout empilé au lieu d'inline.
4. Zoomguess : exception IRL (image visible côté joueur pour ce type).
5. Tableau "Détail" résultats : lignes pilules.
6. Mode "à distance" : navbar masquée + roue crantée + pastille, comme IRL.
7. "Quiz publics" : bouton "Jouer" → lance une partie hôte avec ce quiz.
8. "Reveal" : révélation progressive liée au chrono.

## Hors périmètre
- Tout le reste de l'audit déjà classé "déjà aligné" ou "assumé/documenté"
  (badge type position fixe, largeur colonne PC, icône ⚙️=thème, forme
  Zoomguess).
- Le lobby (`007`), les écrans hôte génériques (`004`-`006`), déjà traités.

## Fichiers concernés
- `client/public/index.html`, `client/public/css/style.css`,
  `client/public/js/index.js` (points 1-4, 6, 8)
- `client/public/result.html`, `client/public/css/style.css` (point 5)
- `client/public/select.html`, `client/public/js/select.js`,
  `client/public/js/index.js`, potentiellement `server/index.js` (point 7)

## Étapes réalisées
- [x] Order (hôte + joueur) : pastille numérotée `.order-item-rank` ajoutée
  (`style.css`), renumérotée après chaque glisser-déposer via
  `updateOrderRanks()` (`index.js`).
- [x] Intrus : grille passée à 3 colonnes ≥900px (`.options-grid.intrus-grid`),
  mobile inchangé (toujours 2 colonnes, décision produit déjà actée).
- [x] Free/Reveal/Pbac/Blindtest/Zoomguess (joueur) : bouton toujours
  "Valider" (plus de branche "Envoyer" — couvrait en fait tous les types
  restants) ; `.free-text-input` empilé (`flex-direction:column`) au lieu
  d'en ligne pour ces mêmes types.
- [x] Zoomguess en IRL : exception `.zoomguess-visible` — l'image reste
  affichée sur le téléphone du joueur pour ce type précis uniquement.
- [x] Tableau "Détail" résultats : lignes "pilules" (`border-collapse:separate`
  + `border-spacing`, fond par ligne, coins arrondis sur 1ère/dernière
  cellule, en-tête uppercase).
- [x] Mode "à distance" : même traitement que l'IRL (navbar masquée, roue
  crantée) via une nouvelle classe `body.remote-player-mode`, en plus de
  `body.irl-player-mode` existante — seule l'image décorative reste une
  exception IRL only. Pastille "🌐 Connecté à distance" **adaptée** : posée
  comme ligne d'info dans le menu de la roue crantée (`#irlMenuModeInfo`)
  plutôt qu'un nouvel élément flottant séparé, pour éviter tout risque de
  chevauchement avec `.persistent-code`/`#gameProgressInfo` sans pouvoir
  vérifier visuellement — écart assumé par rapport au placement exact de la
  maquette, à revoir si l'utilisateur préfère un vrai badge flottant.
- [x] "Quiz publics" : bouton "▶ Jouer ce quiz" (`select.js`) → redirige
  vers `index.html?create=true&quiz=<id>`, qui crée la salle ET précharge
  le quiz via `loadQuizById()` (réutilise exactement ce que fait déjà
  `confirmQuizSelect`). L'affichage de l'auteur (2e écart repéré par
  l'audit sur ce même onglet) n'a PAS été traité — nécessiterait une
  jointure Supabase (`profiles`) non décidée avec l'utilisateur, hors
  périmètre de la décision prise ("bouton Jouer" seulement).
- [x] "Reveal" : révélation progressive — **réinterprétée** après lecture du
  code serveur (voir "Décision technique" ci-dessous) : c'est l'image
  ÉNIGME qui se dévoile (flou progressif, même mécanique que le dézoom
  "zoomguess"), pas l'image RÉPONSE (qui n'arrive jamais côté client avant
  `timer:end`, anti-triche — voir server/index.js).

## Décision technique prise en cours de route (pas demandée explicitement)
Pour "Reveal", la révélation progressive ne pouvait PAS porter sur l'image
réponse : elle n'est transmise au client qu'à `timer:end` (server/index.js),
délibérément, pour empêcher un joueur de l'inspecter (devtools/réseau) avant
la fin du chrono. L'implémenter comme suggéré littéralement (réponse qui se
révèle pendant la question) aurait donc introduit une régression de
triche. Le hint du type (`QUESTION_TYPE_META.reveal` : "l'image qui se
révèle petit à petit") confirme que c'est l'ÉNIGME qui doit progressivement
se dévoiler pendant le décompte — implémenté ainsi (flou 20px → 0px), la
bascule vers la réponse à `timer:end` reste inchangée.

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- `node --check client/public/js/select.js` : OK.
- Équilibre des accolades CSS : 1254/1254, OK.
- Pas de vérification visuelle réelle possible dans cette session (pas de
  partie en cours, pas d'outil de rendu) — **à confirmer par l'utilisateur**.

## Tests manuels recommandés
Vraie partie avec chaque type de question concerné, dans les deux thèmes,
en IRL et à distance. Flux "Jouer" depuis Quiz publics de bout en bout.

## Risques restants
Aucune vérification visuelle réelle possible dans cette session (pas de
partie en cours, pas d'outil de rendu) — tout est fait par lecture/édition
de code, à confirmer par l'utilisateur.

## Suite — auteur sur "Quiz publics" + 2 fixes triviaux du tout premier audit
Retour utilisateur : ajouter l'affichage de l'auteur sur les cartes de
l'onglet "Quiz publics" (2e écart repéré à côté du bouton "Jouer", laissé
de côté à la clôture initiale de cette tâche). Découverte en creusant :
nécessite une policy RLS sur `profiles` (aucune lecture publique n'existait,
seulement "chacun lit son propre profil") — **validée explicitement par
l'utilisateur avant modification**, conformément à `CLAUDE.md`.

- [x] `supabase/schema.sql` : nouvelle policy RLS, scopée aux auteurs ayant
  au moins un quiz public (pas un accès général à tous les profils) —
  **à coller manuellement dans Supabase Dashboard > SQL Editor**, ce fichier
  n'étant qu'une source versionnée, pas exécuté automatiquement.
- [x] `select.js` (`loadPublic`) : requête `profiles` séparée sur les
  `owner_id` de la page (pas de embed PostgREST direct possible, `quizzes`
  et `profiles` référencent toutes deux `auth.users` mais n'ont pas de FK
  entre elles) ; carte affiche "par <Auteur> · Modifié le ..." quand connu,
  retombe sur la date seule sinon (pseudo manquant/policy pas encore
  appliquée en base).
- [x] 2 fixes triviaux du tout premier audit (avant la découverte du canvas
  de design), jamais faits : `.option-btn { border-radius: 20px }` codé en
  dur → `var(--radius-lg)` ; commentaire de `.recap-sidebar-toggle` corrigé
  (disait "hôte, toujours sur PC", contredit par `index.js` — "Ouvert à
  TOUT LE MONDE désormais").

## Checks effectués (suite)
- `node --check client/public/js/select.js` : OK.
- Équilibre des accolades CSS : 1260/1260, OK.
- `supabase/schema.sql` : pas d'outil de vérification automatique
  (CLAUDE.md) — relu à la main, parenthèses/policy bien formées.

## Risques restants (suite)
- **La policy RLS n'est pas encore appliquée en base** tant que l'utilisateur
  n'a pas collé ce SQL dans le Supabase Dashboard — sans ça, `loadPublic`
  continuera de recevoir `authorName: null` pour tout le monde (dégradation
  silencieuse déjà prévue côté JS, pas un crash).
- Pas de vérification visuelle possible dans cette session.

## Statut
`en review`
