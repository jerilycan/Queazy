# [007] Refonte DA — salon d'attente (`#lobby` dans `index.html`)

## Contexte
Retour utilisateur direct, avec renvoi vers le canvas de design "Écran
hôte QuEazy" — plus précisément l'artboard `Lobby.dc.html` (le board avec
le QR code de partage), extrait directement depuis les données du canvas
(la lecture "live" du canvas publié ne renvoie que le shell de l'éditeur,
pas le contenu — limitation déjà rencontrée en tâche 006 — mais le fichier
HTML de l'artboard est présent tel quel dans les données de l'artifact
sauvegardées localement, et a pu en être extrait).

## Objectif
Aligner le salon d'attente (`#lobby`, avant le lancement de la partie) sur
le design décidé dans `Lobby.dc.html`, sans toucher à la logique de jeu.

## Périmètre
- Carte organisateur (`#lobbyHost`/`.lobby-host-card`).
- Carte "Partager l'accès" (`#roomInfo`, QR + code de salle + lien).

## Hors périmètre
- `.player-tile`/`.status-badge` (grille des joueurs connectés) : le
  design décidé montre un simple point vert "en ligne", mais
  l'implémentation actuelle porte une fonctionnalité plus riche (badges
  Prêt/Attente/Parti, déjà auditée comme alignée sur `cards.html` par un
  audit précédent) — pas question de régresser une fonctionnalité réelle
  pour coller à une maquette plus simple sur ce point précis.
- Réglages (mode équipe / rapidité / quiz à distance) : déjà quasiment
  identiques au design décidé à la relecture (mêmes tokens
  `--color-surface`/`--color-border`/`--radius-md`) — écart jugé
  cosmétique, non traité pour ne pas dériver hors du périmètre annoncé.
- État "navbar connectée" (avatar + pseudo à la place du bouton Connexion)
  visible sur l'artboard : composant partagé (navbar), pas spécifique au
  lobby — non traité ici.

## Fichiers concernés
- `client/public/css/style.css`
- `client/public/js/index.js` — 3 endroits générant le HTML de la carte
  organisateur (`renderLobbyGrid` + fallback local), `#serverInfo` (handler
  `room:created`).
- `client/public/index.html` — classe `border-accent-top` retirée de
  `#roomInfo` (remplacée par un override CSS scopé par id).

## Étapes réalisées
- [x] `.lobby-host-card` : fond `var(--gradient-card)` + barre d'accent
  4px (`::before`) + ombre marquée → `var(--color-surface)` (même token
  que `.team-mode-panel`, déjà theme-aware), sans barre ni ombre —
  panneau discret imbriqué dans `#lobby` au lieu d'une "carte dans la
  carte". Override thème clair dédié supprimé (devenu inutile, le token
  gère déjà les deux thèmes).
- [x] `.avatar-main.is-host::after` (👑 flottant au-dessus de l'avatar)
  retiré, remplacé par `.host-organizer-badge` (nouvelle pastille "👑
  ORGANISATEUR", même recette que `.btn-nav-secondary`/`.team-badge`) —
  appliqué dans les 3 endroits de `index.js` qui construisent la carte
  organisateur (serveur, fallback local connu, fallback "hôte introuvable"
  laissé en texte muted simple, pas un vrai état "organisateur").
- [x] `#roomInfo` : classe `border-accent-top` (barre 4px un seul côté)
  retirée, remplacée par un override scopé `#roomInfo { border: 1px solid
  rgba(var(--color-accent-rgb),0.3); }` (liseré fin sur tout le pourtour)
  — n'affecte pas les autres usages de `.border-accent-top` ailleurs dans
  l'appli.
- [x] `.qr-container` : `box-shadow: var(--shadow-sm)` ajouté (absent
  avant, présent dans le design décidé).
- [x] `#serverInfo` (`room:created`) : passé d'une ligne concaténée
  ("Salle créée: CODE • URL") à 2 lignes — code de salle mis en avant
  (`.room-info-code-value`, police Baloo 2, espacé) au-dessus du lien
  complet en discret (`.room-info-url`).

## Checks effectués
- `node --check client/public/js/index.js` : OK.
- Équilibre des accolades CSS : 1242/1242, OK.
- Pas de vérification visuelle en conditions réelles (pas d'outil
  "Browser pane" disponible dans cette session, pas de partie en cours) —
  **à confirmer par l'utilisateur**.

## Tests manuels recommandés
- Créer une salle en tant qu'hôte, dans les deux thèmes : carte
  organisateur (fond discret, pastille "👑 ORGANISATEUR" sous le nom, plus
  de couronne flottante), carte "Partager l'accès" (liseré rose fin,
  QR avec ombre, code de salle en 2 lignes distinctes).
- Vérifier que `.border-accent-top` reste inchangée ailleurs dans l'appli
  (override scopé par id, ne devrait rien casser).

## Risques restants
- Écart maquette non traité intentionnellement sur les réglages
  (toggles) et la grille joueurs — voir "Hors périmètre" si un vrai écart
  y est repéré à l'usage.
- Aucune vérification visuelle réelle possible dans cette session
  (contrainte d'outillage, pas un choix) — premier retour utilisateur en
  conditions réelles à prévoir avant de considérer ce chantier clos.

## Statut
`en review`
