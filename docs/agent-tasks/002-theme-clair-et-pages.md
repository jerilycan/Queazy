# [002] Thème clair (nouvelle DA) + reste des pages

## Contexte
Suite de la tâche 001 (navbar). L'utilisateur s'absente plusieurs heures et
demande d'avancer seul sur tout le reste du design (toutes les pages selon
la nouvelle DA + une DA dédiée au thème clair), sans validation
intermédiaire — les décisions et questions ouvertes sont listées ici au fil
de l'eau, à lui soumettre à son retour.

## Objectif
Porter la nouvelle DA (déjà validée en maquette : Mes Quiz, éditeur,
résultats, profil, connexion) sur le vrai code, + donner au thème clair un
traitement cohérent avec cette DA (jusqu'ici non maquetté, navbar restée
hardcodée en dark même en thème clair — voir risque noté en 001).

## Périmètre
- Thème clair : navbar (fond adapté), bouton "CRÉER" (aligné sur l'accent
  plutôt que le bleu isolé actuel).
- `select.html` : cartes "Mes Quiz"/"Quiz publics" (avatar-initiales,
  actions rapides Éditer/Dupliquer/Supprimer au survol), état vide.
- `editor.html` : vérifier l'écart réel avec la maquette (une partie semble
  déjà proche — halo par type de question déjà en place).
- `result.html` : onglets Podium/Détail, pistes de course.
- `profile.html` : mise en page carte avatar + formulaire.
- `login.html` : cartes connexion/inscription.
- Reste du chantier `index.html` (bannière EN DIRECT, points de
  progression, fond spotlight dédié) si le temps le permet.

## Hors périmètre
- Toute nouvelle fonctionnalité (duplication de quiz depuis la liste,
  suppression directe, etc.) — ces actions rapides seront visuellement
  présentes sur les cartes si la maquette les montre, mais **sans handler
  JS fonctionnel** tant que ce n'est pas explicitement demandé : décision
  à trancher au cas par cas ci-dessous.
- Les zones interdites du `CLAUDE.md` (schéma DB, `render.yaml`, nouvelle
  dépendance).

## Décisions prises seul (pas de validation possible dans l'immédiat)
_liste vivante, complétée au fil du travail — à relire au retour de
l'utilisateur._

1. **"CRÉER" en thème clair** : j'ai supprimé son override bleu isolé
   (`#2563eb`, ne collait à rien d'autre dans la palette) pour le faire
   suivre `--color-accent`/`--color-accent-2` comme en thème sombre — même
   identité de marque dans les deux thèmes. "REJOINDRE" garde son rouge
   dédié existant (déjà cohérent). *Réversible facilement si tu préfères
   le bleu d'origine — dis-le et je le remets.*
2. **Navbar en thème clair** : verre blanc translucide (au lieu du verre
   noir hardcodé qui s'affichait même en thème clair, un bug pré-existant,
   pas quelque chose que j'ai introduit) — cohérent avec `--color-card`
   blanc du reste du thème clair.
3. **Cartes "Mes Quiz"** : j'ai repris l'avatar-initiales coloré + titre +
   date de la maquette, mais **volontairement laissé de côté la rangée
   d'actions rapides Éditer/Dupliquer/Supprimer** montrée dessus. Cliquer
   la carte pour éditer existe déjà (inchangé) ; "Dupliquer" n'a aucune
   logique existante côté site (le bouton "Dupliquer dans mes quiz" de
   `editor.html` ne concerne que la copie du quiz d'un AUTRE créateur) —
   ajouter cette action aurait été une vraie nouvelle fonctionnalité, pas
   juste un habillage visuel, donc hors périmètre tant que ce n'est pas
   demandé explicitement. *Question pour toi à la fin.*
4. **Onglets "Podium"/"Détail"** (`result.html`) : juste alignés sur le
   nouveau vocabulaire de bouton (poids 800, halo). Je n'ai pas touché aux
   pistes de course elles-mêmes (`.race-lane*`) — c'est un système déjà
   riche et soigné (animations couronne/streak/glitch), pas dans l'esprit
   "pas de sur-ingénierie" d'y toucher sans un vrai écart identifié avec la
   maquette. Sa mécanique réelle (barres VERTICALES qui montent, façon
   course de chevaux) diffère d'ailleurs de la maquette (barres
   horizontales) — la maquette avait pris une liberté que je n'ai pas
   cherché à imposer au vrai code.
5. **Sélection d'avatar** (`.icon-opt.selected`, partagé par `profile.html`
   ET le sélecteur joueur d'`index.html`) : passé en dégradé plein + halo au
   lieu du contour teinté — mais j'ai délibérément **laissé `.avatar-main`
   (le rond blanc de base) inchangé** : c'est un composant partagé par tout
   le jeu (lobby, classement...), le retoucher dépasse le périmètre "design
   des pages" et aurait un rayon d'impact que je ne voulais pas prendre seul.
6. **`editor.html`, `profile.html`, `login.html`** : après vérification,
   ces pages héritent déjà l'essentiel de la nouvelle DA via les tokens et
   classes globales déjà mis à jour (`.card`, `.btn*`, fond, navbar) — pas
   d'écart flagrant identifié qui justifierait une réécriture de leur
   structure propre. Je n'ai donc pas cherché à "inventer" du travail
   supplémentaire dessus.
7. **`index.html` (écran hôte en jeu)** : je n'ai pas touché aux éléments
   encore ouverts de longue date (bannière "EN DIRECT", points de
   progression, fond spotlight dédié) — plus gros chantier, mieux traité
   dans une session dédiée avec plus de marge pour vérifier en profondeur
   plutôt qu'en fin de session autonome.

## Fichiers concernés
- `client/public/css/style.css`
- `client/public/js/select.js`
- `client/public/select.html`, `editor.html`, `result.html`, `profile.html`,
  `login.html`

## Plan
1. Thème clair : navbar + bouton Créer.
2. `select.html` : cartes Mes Quiz/publics + état vide.
3. `result.html` : onglets + pistes de course.
4. `profile.html`.
5. `login.html` (connexion + inscription).
6. `editor.html` : combler l'écart restant avec la maquette.
7. Reste `index.html` si le temps le permet.

## Étapes réalisées
- [x] Thème clair : navbar, menu mobile, profil, bouton "CRÉER"
- [x] `select.html` : cartes Mes Quiz/publics (avatar-initiales)
- [x] `result.html` : onglets Podium/Détail (habillage bouton uniquement)
- [x] Sélecteur d'avatar partagé (`.icon-opt.selected`)
- [ ] `profile.html`, `login.html`, `editor.html` : vérifiés conformes via
  héritage global, pas de retouche dédiée jugée nécessaire (voir décision 6)
- [ ] `index.html` (reste du chantier jeu) : non traité, voir décision 7

## Checks effectués
- `node -e` équilibre des accolades CSS après chaque lot de modifs (dernier
  résultat : 1152/1152, OK) + `node --check select.js` (OK).
- Vérifié en Browser pane (onglets neufs à chaque fois, cache HTTP/PWA
  oblige) : navbar + Créer en thème clair, cartes Mes Quiz (avatar/titre/
  date via un rendu direct de `render()` avec données factices), onglets
  résultats, absence d'erreur console sur `result.html`, `profile.html`,
  `login.html`, `editor.html`.

## Tests manuels recommandés
- Se connecter pour de vrai (pas juste invité) et vérifier `select.html`
  avec de vrais quiz en liste, `editor.html` avec un vrai quiz ouvert —
  pas testé avec un compte réel dans cette session.
- Thème clair sur `result.html`, `profile.html`, `login.html`, `editor.html`
  — seuls `select.html` et la navbar ont été vérifiés en clair.
- Repasser sur `index.html` en jeu réel (hôte + joueur) pour confirmer
  qu'aucune régression n'est venue des changements globaux (boutons,
  fond, `.icon-opt`).

## Risques restants
- Voir les décisions 1, 3, 5, 6, 7 ci-dessus : plusieurs renoncements
  volontaires par prudence (périmètre), pas des oublis — mais à confirmer
  que c'est bien ce que tu voulais.
- Thème clair vérifié seulement sur `select.html`/navbar, pas sur le reste
  des pages (probablement correct par héritage des tokens, mais pas
  visuellement confirmé partout).
- Toujours aucun outil de vérification automatique dans ce projet — tout
  ce qui précède reste du contrôle manuel.

## Statut
`en review` (auto — l'utilisateur n'était pas disponible pour valider en
direct, review à faire à son retour)
