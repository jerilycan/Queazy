# [022] Modération de la banque de questions (mode "Jouer")

## Contexte
La banque de questions (`bank_questions`, tâche 021) alimente le mode
"Jouer" (quiz auto-généré). Jusqu'ici, tout utilisateur connecté peut y
publier une question depuis l'éditeur (`editor.js`, bouton "Ajouter à la
banque") et elle devient immédiatement jouable par tout le monde, sans
relecture. L'utilisateur veut ouvrir la contribution à tous ses joueurs
connectés, mais avec une validation avant publication réelle, et pouvoir
lui-même désigner qui a le droit de valider — sans dépendre de moi pour
chaque ajout de modérateur.

Migration SQL déjà appliquée manuellement par l'utilisateur dans le
Dashboard Supabase (voir échanges précédents de cette session) :
- `bank_questions.status` (`text`, défaut `'pending'`, check
  `pending|approved|rejected`).
- Nouvelle table `bank_admins` (`email text primary key`, `role text`
  défaut `'moderator'`, check `moderator|super`, `added_by text`,
  `created_at`), RLS activée : lecture ouverte à tout admin (via
  sous-requête sur sa propre présence dans la table), insert/delete
  réservés à un `role='super'`. Un premier super admin (le compte de
  l'utilisateur) est déjà inséré (bootstrap).
- Policies `bank_questions` mises à jour : lecture = `approved` OU
  soumission propre (`created_by = auth.uid()`) OU admin ; insert forcé à
  `status='pending'` ; update (validation) réservé aux admins (référence
  `auth.jwt()->>'email'` dans `bank_admins`, pas de `user_id`).

**Ne pas re-toucher au schéma** dans cette tâche — il est déjà en place et
validé, cette tâche ne couvre que le code applicatif.

## Objectif
- Toute nouvelle question ajoutée à la banque part en attente
  (`pending`), invisible du mode "Jouer" tant qu'elle n'est pas approuvée.
- Une page admin permet à un admin (moderator ou super) de voir les
  questions en attente et de les Approuver/Rejeter.
- Cette même page admin permet à un **super admin uniquement** de gérer la
  liste des admins : ajouter un email (en choisissant son rôle
  moderator/super) et en retirer un — section masquée/inactive pour un
  moderator simple.
- Le message affiché après "Ajouter à la banque" dans l'éditeur reflète
  l'attente de validation, plus l'ajout immédiat.
- `generateAutoQuiz()` (mode "Jouer") ne pioche jamais une question autre
  qu'`approved`, même si la RLS le garantit déjà (défense en profondeur,
  cohérent avec le reste du code qui ne fait jamais confiance qu'au
  serveur/à la RLS seule).

## Périmètre
- Nouvelle page HTML/JS admin (nom à trancher en plan — ex.
  `admin-bank.html`/`admin-bank.js`), accessible uniquement à un compte
  présent dans `bank_admins` (vérifié côté client à l'ouverture ; la RLS
  reste la vraie barrière de sécurité).
  - Liste des questions `pending` (prompt, catégorie, type, difficulté,
    auteur) avec actions Approuver/Rejeter.
  - Section gestion des admins (liste actuelle + rôle, champ email +
    sélecteur de rôle + bouton Ajouter, bouton Retirer par ligne) —
    rendue/activée seulement si le compte courant a `role='super'`.
- `client/public/js/editor.js` : texte de confirmation après ajout à la
  banque.
- `client/public/js/index.js` : filtre `status='approved'` explicite dans
  `generateAutoQuiz()`.
- Un point d'accès pour atteindre la page admin (lien discret, visible
  seulement si admin — à trancher en plan : navbar, ou juste une URL
  directe non liée nulle part pour l'instant).

## Hors périmètre
- Toute modification du schéma SQL (déjà fait manuellement, hors de cette
  tâche).
- Notification (email/Discord) à un admin quand une question arrive en
  attente — pas demandé.
- Historique/audit des validations passées (qui a approuvé quoi, quand) —
  pas demandé, `bank_questions` n'a pas de colonne pour ça aujourd'hui.
- Pagination/recherche avancée sur la liste des questions en attente (si
  le volume reste faible, une simple liste suffit — à revoir plus tard si
  besoin).
- Modifier le flux "Ajouter à la banque" lui-même (champs, validation) —
  seul le message de confirmation change.

## Fichiers concernés
- `client/public/js/editor.js` — bouton "Ajouter à la banque"
  (`addToBankBtn.onclick`, ~ligne 5038) : message de confirmation à
  adapter.
- `client/public/js/index.js` — `generateAutoQuiz()` (~ligne 5943 à ce
  jour) : ajouter le filtre `status`.
- Nouveaux fichiers : page admin HTML + JS (nom à définir en plan),
  probablement à côté de `select.html`/`profile.html` pour reprendre leur
  structure de page (navbar, garde de connexion via
  `window.supabaseClient.auth.getSession()`).
- `client/public/css/style.css` — styles de la nouvelle page (réutiliser
  au maximum les classes existantes : `.card`, `.btn`, `.detail-section`,
  etc., voir CLAUDE.md "pas de nouvelle feuille de style parallèle").

## Plan
Exploration faite : `client/public/js/editor.js` (bouton banque ~L5038-5075),
`client/public/js/index.js` (`generateAutoQuiz` L4046-4111, `QUESTION_TYPE_META`
L326, `DIFFICULTY_LABELS` L4045), `client/public/js/select.js` (pattern
liste/cartes, requête profils séparée pour l'auteur, `window.QzUI` toast/confirm),
`client/public/js/profile.js` et `profile.html` (garde de connexion, structure
de page simple à une carte), `client/public/select.html` (navbar + tabs),
`client/public/css/style.css` (`.card`, `.detail-section`, `.table-custom`
L3660 déjà utilisé par `result.html`, `.status-badge` L1039 + modificateurs
`status-ready`/`status-waiting`/`status-gone` réutilisables tels quels pour des
pastilles rôle/statut sans nouvelle classe), `client/public/js/ui-widgets.js`
(`window.QzUI.toast/confirm/enhanceSelect`), `supabase/schema.sql` (état du
schéma AVANT migration manuelle — le fichier n'a pas été mis à jour avec
`status`/`bank_admins`, mais ce n'est pas dans le périmètre de cette tâche ;
le code applicatif suppose la migration déjà appliquée en base, comme indiqué
dans le fichier de tâche).

1. **`client/public/js/index.js`** — `generateAutoQuiz()` : ajouter
   `.eq('status', 'approved')` à la requête de chaque palier (L4069), à côté
   des filtres `.eq('difficulty', ...)`/`.in('category', ...)`/`.in('type', ...)`
   déjà présents. Défense en profondeur uniquement, la RLS bloque déjà le
   reste — diff d'une ligne.

2. **`client/public/js/editor.js`** — message de confirmation après "Ajouter à
   la banque" (L5067) : remplacer `'Question ajoutée à la banque !'` par un
   texte qui reflète l'attente de validation, ex.
   `'Question envoyée à la banque, en attente de validation !'`. Aucune autre
   logique du bloc `addToBankBtn.onclick` ne change (hors périmètre : le flux
   d'ajout lui-même).

3. **Nouvelle page `client/public/admin-bank.html`** — structure copiée de
   `profile.html`/`select.html` (mêmes balises `<head>`, même navbar avec le
   SVG de marque et les liens standard Jouer/Présenter/Rejoindre/Mes
   Quiz/profil). Nom retenu : `admin-bank.html`/`admin-bank.js` (cohérent avec
   `bank_questions`/`bank_admins`, évite toute confusion avec le futur mode
   "Jouer" déjà nommé "banque"). Corps : un `<h1>`, puis deux `<div class="card">` :
   - `#pendingSection` : liste des questions `pending` sous forme de
     `<table class="table-custom">` (colonnes prompt/catégorie/type/difficulté/
     auteur/actions) — réutilise `.table-custom` déjà utilisé par
     `result.html`, pas de nouveau composant de liste. *Trade-off* : table
     plutôt que cartes façon `select.js`, car les colonnes (auteur, type,
     difficulté) s'alignent mieux en tableau pour un usage de modération
     rapide (comparer plusieurs lignes d'un coup) qu'en grille de cartes.
   - `#adminsSection` : liste des admins existants (même `.table-custom`,
     colonnes email/rôle/ajouté par/actions) + formulaire d'ajout (input email
     + `<select>` moderator/super + bouton), masqué (`d-none`) et son contenu
     non rendu tant que le rôle courant n'est pas `super`.
   Both sections démarrent cachées jusqu'à la résolution de la garde d'accès
   (évite un flash de contenu avant vérification, même logique que les pages
   existantes qui attendent `checkAuth()`).

4. **Nouveau `client/public/js/admin-bank.js`** :
   - Garde de connexion identique à `profile.js`/`select.js`
     (`sb.auth.getSession()`, redirection `/login.html` si ni session ni
     invité — un invité n'a de toute façon aucune chance d'être admin, mais on
     ne le bloque pas différemment des autres pages protégées).
   - Vérification admin **côté client** (rappel : la vraie barrière est la
     RLS) : `sb.from('bank_admins').select('role').eq('email', session.user.email).maybeSingle()`.
     Comme la policy de lecture de `bank_admins` n'autorise la lecture
     d'AUCUNE ligne à qui n'est pas déjà admin (sous-requête non corrélée sur
     sa propre présence dans la table), une réponse vide ⇒ compte non-admin
     avec certitude (pas une erreur réseau masquée) : afficher un état "Accès
     réservé aux modérateurs" (`empty-state`, cohérent avec `select.js`) et ne
     rendre AUCUNE des deux sections.
   - Si `role` = `moderator` ou `super` : afficher `#pendingSection`, charger
     les questions `pending` : `sb.from('bank_questions').select('id,category,type,difficulty,question,created_by').eq('status','pending').order('created_at')`.
     Auteur : 2e requête sur `profiles` par lot d'ids `created_by` (même
     pattern que `loadPublic` dans `select.js`, pas de FK directe
     `bank_questions → profiles` pour un embed PostgREST). `question.prompt`
     (ou équivalent selon le type — vérifier la forme exacte au moment
     d'implémenter, cf. structure normalisée décrite dans le commentaire
     `supabase/schema.sql` L333) affiché tronqué dans la colonne prompt.
     Actions par ligne : "Approuver" → `update({status:'approved'})`,
     "Rejeter" → confirmation `window.QzUI.confirm` puis
     `update({status:'rejected'})` (on ne supprime pas la ligne — permet de
     revenir dessus manuellement en base si besoin, aucune UI de
     "rejetées" n'est demandée par le périmètre). Retirer la ligne de la
     liste locale après succès plutôt que tout recharger.
   - Si `role` = `super` en plus : afficher `#adminsSection`, charger
     `sb.from('bank_admins').select('email,role,added_by,created_at').order('created_at')`.
     Ajout : insert `{email, role, added_by: session.user.email}` (le
     `select` non-corrélé fait qu'un super voit déjà tout, pas besoin de
     recharger depuis zéro — append local). Retrait : bouton par ligne,
     confirmation `window.QzUI.confirm`, `delete().eq('email', ...)`. *Note* :
     pas de garde applicative empêchant un super de se retirer lui-même (la
     RLS l'autoriserait) — accepté comme risque mineur v1, un super qui se
     retire par erreur reste réversible via le Dashboard Supabase.
   - Toutes les erreurs Supabase passées par `window.QzUI.toast(..., 'error')`
     avec `console.error` détaillé, même pattern que partout ailleurs (jamais
     de message Postgres brut affiché).

5. **Point d'entrée vers la page** — *trancher* : lien conditionnel ajouté
   uniquement dans `client/public/js/profile.js` (pas dans la navbar commune à
   toutes les pages). *Trade-off* : un lien navbar global obligerait à
   interroger `bank_admins` sur CHAQUE page pour CHAQUE utilisateur connecté
   (coût réseau permanent pour une fonctionnalité que quasi personne
   n'utilise) ; `/profile.html` est déjà l'endroit "compte" où on va chercher
   ses réglages personnels (à côté de "Se déconnecter"), et `profile.js`
   attend déjà la session avant de peupler la page — une requête
   supplémentaire ciblée `bank_admins` à cet endroit précis n'ajoute un appel
   que sur une page peu visitée en boucle. Implémentation : dans
   `checkAuth()` de `profile.js`, après résolution de la session, si
   connecté, requête `bank_admins.select('role').eq('email', session.user.email).maybeSingle()`
   et affichage d'un bouton discret (`btn btn-nav-secondary` ou lien texte
   sous les boutons existants) "Modération banque de questions" pointant vers
   `/admin-bank.html`, cité seulement si une ligne est trouvée. `profile.html`
   reçoit l'élément (caché par défaut, `d-none`), `profile.js` le révèle.

6. **CSS** — a priori aucune nouvelle classe n'est nécessaire
   (`.card`, `.table-custom`, `.btn`, `.btn-primary`, `.btn-danger-outline`,
   `.detail-section`, `.status-badge` + modificateurs existants couvrent
   tableau/formulaire/pastilles). Si l'implémentation révèle un besoin de
   mise en page ponctuelle (espacement entre les deux cartes, largeur du
   formulaire d'ajout admin), ajouter le minimum dans
   `client/public/css/style.css`, jamais de nouvelle feuille.

Aucune étape ne touche `supabase/schema.sql`, `render.yaml`,
`.claude/settings.local.json`/`launch.json`, ni n'ajoute de dépendance npm —
pas de zone d'interdiction du `CLAUDE.md` concernée, pas de validation dédiée
nécessaire au-delà de celle donnée pour cette tâche.

## Étapes réalisées
- [x] 1. `client/public/js/index.js` — `generateAutoQuiz()` : ajout de
      `.eq('status', 'approved')` sur chaque requête par palier de difficulté.
- [x] 2. `client/public/js/editor.js` — message de confirmation
      `addToBankBtn` mis à jour : "Question envoyée à la banque, en attente
      de validation !".
- [x] 3. Nouvelle page `client/public/admin-bank.html` (navbar/structure
      identiques aux autres pages, sections "Questions en attente" et
      "Gestion des admins" en `.table-custom`).
- [x] 4. Nouveau `client/public/js/admin-bank.js` (garde de connexion,
      vérification `bank_admins`, chargement/actions Approuver-Rejeter,
      chargement/ajout/retrait des admins pour un `role='super'`).
- [x] 5. Point d'entrée : lien conditionnel `#adminBankLink` ajouté dans
      `client/public/profile.html`, révélé par `client/public/js/profile.js`
      (requête `bank_admins` ciblée sur cette page uniquement).
- [x] 6. CSS : aucune nouvelle classe nécessaire — réutilisation de
      `.card`, `.table-custom`, `.btn`/`.btn-primary`/`.btn-danger-outline`,
      `.detail-section`, `.empty-state`. Deux ajustements de classes
      utilitaires existantes (`mb-md` remplacé par `mb-20`, pas de `.ml-8` —
      style inline `marginLeft` sur le bouton "Rejeter", cohérent avec l'usage
      déjà en place pour les composants générés en JS).

## Checks effectués
- [x] `node --check` sur `index.js`, `editor.js`, `profile.js`,
      `admin-bank.js` — tous OK.
- [x] Aucun fichier serveur touché (confirmé en plan) — serveur local déjà
      actif (`GET /server-info` → 200) non redémarré, pas de check de boot
      nécessaire pour cette tâche.
- [x] Vérification visuelle Browser pane sur `admin-bank.html` : garde de
      connexion confirmée (visite anonyme → redirection immédiate vers
      `/login.html`, constatée avant toute modification). Rendu des deux
      sections (tableau "Questions en attente" + tableau "Gestion des
      admins" + formulaire d'ajout) vérifié en injectant temporairement des
      données fixture dans une COPIE locale non committée de `admin-bank.js`
      (aucun compte réel créé, aucun mot de passe saisi — voir note
      ci-dessous) : mise en page `.table-custom`/`.card`/`.btn` conforme à
      la charte, boutons Approuver/Rejeter/Retirer correctement câblés. Le
      fichier `admin-bank.js` a été restauré à l'identique de la version
      commitée juste après (`node --check` re-passé, `grep` confirmant
      l'absence de tout résidu de test) — voir écart ci-dessous.
- [ ] `editor.js` (message de confirmation "Ajouter à la banque") non
      revérifié visuellement en direct (nécessite un compte connecté réel,
      hors de portée sans identifiants — changement d'une seule chaîne,
      relu par lecture de code).

## Tests manuels recommandés
- Ajouter une question via l'éditeur en étant connecté avec un compte
  non-admin : vérifier le nouveau message "en attente de validation" et que
  la question n'apparaît PAS dans le mode "Jouer" tant que non approuvée.
- Se connecter avec le compte super admin bootstrap, ouvrir `/profile.html`
  et vérifier que le lien "🛡️ Modération banque de questions" apparaît,
  puis l'ouvrir : la question ajoutée doit être visible dans "Questions en
  attente" avec le bon auteur/catégorie/type/difficulté.
- **Avant tout test d'Approuver/Rejeter/Ajouter un admin : voir le risque
  RLS bloquant ci-dessous, susceptible de faire échouer ces actions.**
- Vérifier qu'un compte `role='moderator'` (ajouté depuis "Gestion des
  admins") voit la page mais PAS la section "Gestion des admins".
- Vérifier qu'un compte absent de `bank_admins` obtient l'état "Accès
  refusé" en ouvrant `/admin-bank.html` directement, et ne voit pas le lien
  sur `/profile.html`.
- Après approbation d'une question, relancer une génération "Jouer" et
  vérifier qu'elle peut être piochée par `generateAutoQuiz()`.

## Risques restants
- **Bug RLS découvert pendant la vérification (bloquant, hors périmètre de
  cette tâche — nécessite une correction du schéma, donc validation
  utilisateur avant toute modif SQL) :** un clic "Approuver" déclenché
  pendant la vérification a renvoyé une vraie erreur Postgres via le client
  Supabase : `infinite recursion detected in policy for relation
  "bank_admins"` (code `42P17`). La policy `update` de `bank_questions`
  référence `bank_admins`, dont la policy de lecture se référence
  elle-même (sous-requête non corrélée sur sa propre présence) — cette
  combinaison semble créer une récursion aux yeux de Postgres. Impact
  potentiel : les actions Approuver/Rejeter (`bank_questions.update`) et
  possiblement la vérification admin elle-même
  (`bank_admins.select(...).eq('email', ...)`, utilisée par `admin-bank.js`
  ET par le lien conditionnel de `profile.js`) pourraient échouer en usage
  réel, pas seulement avec l'id fictif utilisé pendant le test. **À
  vérifier en priorité par l'utilisateur avec un vrai compte admin avant de
  considérer cette tâche utilisable en production** ; correction probable :
  revoir la policy `bank_admins` (éviter l'auto-référence, ou passer par
  une fonction `security definer` comme `resolve_login_email` dans
  `supabase/schema.sql`) — nécessitera une validation dédiée avant toute
  modification SQL, conformément au `CLAUDE.md`.
- Aucun mécanisme de re-vérification si le rôle d'un admin change pendant
  qu'il a la page ouverte (session déjà chargée) — acceptable pour une v1.
- Le point d'entrée n'existe que sur `/profile.html` (voir Plan, trade-off
  assumé) : un admin qui ne visite jamais cette page ne découvre pas
  `/admin-bank.html` autrement qu'en connaissant l'URL directement.
- `supabase/schema.sql` (fichier versionné) n'a pas été mis à jour avec la
  migration `status`/`bank_admins` déjà appliquée manuellement par
  l'utilisateur en Dashboard — écart déjà noté en Contexte de cette tâche,
  hors périmètre, mais à garder en tête pour une reconstruction du schéma
  depuis ce fichier (elle omettrait aujourd'hui cette migration).

## Écarts par rapport au plan initial
- Le plan prévoyait de dupliquer le SVG de marque complet dans
  `admin-bank.html` (comme sur les autres pages) : fait tel quel, sans
  écart.
- Vérification visuelle : le plan supposait de simuler une session
  admin/super-admin via des inserts de test dans `bank_admins`/
  `bank_questions`. Cela suppose de se connecter avec un compte réel
  (email + mot de passe), ce qui est hors de portée ici (aucune saisie de
  mot de passe ni création de compte, quel que soit le contexte — règle
  permanente). À la place, le rendu a été vérifié en injectant des données
  fixture directement dans une copie temporaire non committée de
  `admin-bank.js` (bypass de la garde d'auth, jamais de vraie session),
  restaurée immédiatement après capture. Ça couvre le rendu et le câblage
  des actions, mais PAS le comportement réel de la RLS en conditions
  normales (d'où le bug de récursion trouvé quand même, via un vrai appel
  réseau Supabase déclenché par le clic "Approuver" pendant ce test).

## Statut
`en review`
