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
_au fil de l'eau_

## Checks effectués
_au fil de l'eau_

## Tests manuels recommandés
_à remplir en fin de session_

## Risques restants
_à remplir en fin de session_

## Statut
`en cours`
