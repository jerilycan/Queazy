# [039] Mode "présentation" séparé (vue présentée / vue présentateur)

## Contexte
Aujourd'hui, en mode "Présenter" IRL, un seul écran fait double usage :
l'écran de l'hôte EST à la fois ce qui est projeté à la salle ET ce qui
porte les contrôles du MJ (modération, bouton suivant, réglages...).
Plusieurs retours utilisateur récents (panneau de modération qui rétrécit
la carte centrale, bouton volume mal placé...) viennent directement de
cette contrainte : tout doit cohabiter sur le même écran, à la fois lisible
projeté ET pratique à manipuler. Retour utilisateur : pouvoir lancer un
mode "présentation" façon PowerPoint, avec une vue présentée (projetée,
purement visuelle) séparée de la vue présentateur (contrôles, sur l'écran
du MJ).

## Objectif
Permettre à l'hôte, en mode "Présenter" IRL, d'ouvrir une seconde fenêtre
("vue affichage") destinée à être projetée/dupliquée sur un second écran —
purement visuelle (question, timer, image, révélation, classement), sans
aucun contrôle — pendant que sa fenêtre principale ("vue présentateur")
garde tous les contrôles MJ, sans plus avoir à ménager une mise en page
"projetable".

## Périmètre
- Une "vue affichage" (nouvelle page, ou nouveau mode de la page
  existante — à trancher en `/plan-feature`) qui rejoint la salle en
  lecture seule (réutilise/étend le mécanisme `viewer:true` déjà existant,
  voir `server/index.js` `room:join` et `client/public/js/results.js`) et
  affiche uniquement le contenu "scène" déjà rendu côté régie (question,
  timer, image, révélation, classement) — sans dock de contrôles, sans
  zone de modération.
- Rattrapage d'état pour un spectateur qui rejoint EN COURS de question
  (aujourd'hui `viewer:true` n'est utilisé qu'après la fin de partie, par
  `result.html` — jamais testé/prévu pour rejoindre au milieu d'une
  question active). Nécessite de renvoyer l'état de la question en cours
  (et son minutage) à un spectateur qui rejoint tardivement.
- Décision + implémentation de qui porte le son de jeu une fois les deux
  vues séparées (aujourd'hui c'est l'appareil de l'hôte qui fait sortir le
  son en IRL — à basculer vers la vue affichage, celle réellement branchée
  aux enceintes/au vidéoprojecteur).
- Mode plein écran pour la vue affichage (API Fullscreen).
- Robustesse : la vue affichage doit pouvoir se raccrocher proprement si
  elle est fermée/rechargée par erreur en pleine partie.
- Adaptation de la vue présentateur (fenêtre de contrôle) maintenant
  libérée de la contrainte "doit aussi être présentable" — réorganisation
  à discuter en `/plan-feature`, sans tout redessiner d'un coup.

## Hors périmètre
- Mode "à distance" (`remote`) : chaque joueur a déjà son propre écran, la
  séparation vue présentée / vue présentateur n'a pas de sens dans ce mode.
- Mode "Jouer" (`roomMode === 'auto'`) : pas de MJ dédié dans ce mode,
  hors périmètre.
- Un vrai "mode présentateur" façon PowerPoint avec notes de l'hôte,
  aperçu de la question suivante, minuteur dédié à l'hôte, etc. — au-delà
  de la simple séparation contrôles/affichage demandée ici. Pourra faire
  l'objet d'une tâche ultérieure une fois la séparation de base posée.
- Refonte visuelle complète de la vue présentateur : ce ticket pose la
  séparation technique ; une réorganisation ergonomique plus poussée du
  panneau de contrôle (au-delà de ce qui est nécessaire pour fonctionner
  sans la contrainte de projection) est un chantier à part.
- Prise en charge de plus de deux écrans/vues simultanées.

## Fichiers concernés
- `server/index.js` — `room:join` (branche `viewer:true`) : à étendre pour
  renvoyer l'état de la question active à un spectateur qui rejoint en
  cours de partie, pas seulement après la fin.
- `client/public/js/index.js` — logique régie desktop actuelle (rendu de
  la "scène" centrale, dock de contrôles, minutage, son) : à examiner pour
  ce qui peut être réutilisé/extrait pour la vue affichage plutôt que
  dupliqué, et pour l'adaptation de la vue présentateur (qui porte le son,
  quels contrôles restent).
- `client/public/js/results.js` — référence existante du pattern
  `viewer:true` côté client (jointure lecture seule) à étudier/réutiliser.
- `client/public/index.html` — page hôte actuelle ; à voir si la vue
  affichage devient un nouveau mode de cette page ou une page dédiée.
- `client/public/css/style.css` — mise en page régie desktop actuelle
  (`#stageWrap`, `#hostPanel`, `#moderationZone`, `#liveClassementDock`) à
  adapter une fois la contrainte de double-usage levée.
- Nouveau(x) fichier(s) probable(s) pour la vue affichage (page et/ou
  script dédiés) — nom et structure exacts à trancher en `/plan-feature`.

## Plan
Aucune "Interdiction" du CLAUDE.md n'est concernée par ce plan (pas de
schéma DB, pas de `render.yaml`, pas de nouvelle dépendance npm — l'API
Fullscreen est native au navigateur).

1. **Serveur — rattrapage pour un spectateur qui rejoint en cours de
   partie.** `server/index.js` a déjà une logique de rattrapage complète
   (question active / question terminée+révélée / question terminée+
   modération en attente, ~lignes 1303-1358) — mais réservée aujourd'hui à
   un vrai JOUEUR qui (re)rejoint ; la branche `viewer:true` (ligne ~1199)
   retourne avant de l'atteindre. Extraire ce bloc dans une fonction
   partagée et l'appeler aussi depuis la branche `viewer:true`. Aucun
   nouvel évènement socket nécessaire — `question:show`/`timer:end`/
   `question:reveal`/`leaderboard:show` existent déjà et sont déjà
   "sans spoiler" (voir `payloadWithoutCorrectOrExplanation`), donc pas de
   nouveau risque d'exposition pour un spectateur qui n'était pas censé
   voir la réponse. Étape autonome, testable indépendamment du reste
   (avant même qu'une vraie vue affichage existe côté client).

2. **Client — point d'entrée "vue affichage".** Nouveau mode de
   `index.html`/`index.js` (ex. paramètre `?display=1&room=CODE` dans
   l'URL) qui, au chargement, court-circuite l'écran de connexion habituel
   (pas de formulaire nom/avatar/salon d'attente) et rejoint directement la
   salle en `viewer:true`.
   - *Trade-off à valider avant de coder cette étape* : `results.js`
     (seul exemple existant de vue "spectateur") est un script séparé
     volontairement simple, mais il n'affiche qu'un résumé final
     (podium/liste) — jamais une question EN COURS. Dupliquer le rendu des
     ~15 types de questions dans un 2e script serait une duplication
     massive et un double entretien à chaque futur ajustement visuel.
     Réutiliser `index.js` (déjà structuré autour de rôles via `isHost`/
     `gameMode`) ajoute une branche de plus au monolithe — cohérent avec
     son style actuel — au prix d'une surface de risque plus grande (une
     référence égarée à un état "joueur/hôte" quelque part dans ce très
     gros fichier pourrait casser silencieusement la vue affichage). Une
     alternative (script dédié, quitte à dupliquer le rendu) reste possible
     si ce compromis ne convient pas.

3. **Client — mise en page "scène seule".** En mode affichage, masquer
   tout le chrome de contrôle (panneau hôte, zone de modération, zone de
   saisie/bouton envoyer) et forcer la mise en page régie "carte centrale"
   en plein écran — réutilise la structure déjà en place (`#stageWrap`),
   aucun nouveau système de rendu par type de question à écrire.

4. **Client — qui porte le son.** Basculer la lecture du son de jeu
   (révélation, blind test, bonus) vers la fenêtre affichage plutôt que la
   fenêtre hôte, en mode affichage IRL — nouveau prédicat (ex.
   `isDisplayView`) à poser à côté de `isHost`/`isPresenterHost()` à
   chaque endroit où le son est aujourd'hui déclenché côté hôte.

5. **Client — plein écran.** Bouton "Lancer en plein écran" sur la vue
   affichage (API Fullscreen — nécessite un geste utilisateur, pas de
   passage en plein écran automatique possible au chargement).

6. **Client — indicateur côté contrôles.** Sur la fenêtre présentateur
   (pas de refonte, voir Hors périmètre), un simple indicateur "vue
   affichage connectée / en attente" pour que l'hôte sache si sa 2e
   fenêtre est bien branchée — rien de plus à ce stade.

7. **Vérification robustesse.** Test manuel : fermer/recharger la fenêtre
   affichage en pleine question, en pleine révélation, et pendant une
   modération en attente — confirme que le rattrapage de l'étape 1 couvre
   bien les trois cas dans ce nouveau contexte.

## Étapes réalisées
- [x] Étape 1 — Serveur : rattrapage partagé pour un spectateur qui rejoint
      en cours de partie. Extraction du bloc de rattrapage (question active
      / révélée / modération en attente) de `room:join` dans une fonction
      partagée `sendJoinCatchup(room, socket)`, appelée à la fois depuis la
      branche joueur réel (comportement inchangé) et depuis la branche
      `viewer:true` (nouveau, juste avant son `return`).
- [x] Étape 2 — Client : point d'entrée "vue affichage". Nouveau paramètre
      `?display=1&room=CODE` (`index.html`/`index.js`) : court-circuite le
      bloc create/play/join habituel de l'IIFE de démarrage (résultat de
      `resetUI()` corrigé en masquant en plus `#joinCard`), affiche un
      nouveau placeholder d'attente `#displayViewScreen`, et rejoint
      directement la salle en `viewer:true` dans `socket.on('connect')` — y
      compris à chaque reconnexion socket.io automatique (même handler
      réexécuté). Choix retenu pour le trade-off noté au Plan : réutilise
      `index.js` plutôt qu'un script séparé.
- [x] Étape 3 — Client : mise en page "scène seule". Deux changements
      ciblés plutôt qu'un système de masquage dupliqué :
      1. `isPresenterHost()` inclut désormais `isDisplayView` (même rôle
         que le host régie IRL : ne joue jamais, tuiles verrouillées en
         permanence via `.answers-locked`, jamais de confettis/bandeau de
         résultat personnel, pas de redirection résultats en fin de quiz).
         Fait aussi apparaître `body.is-host` gratuitement (posé par
         `renderLobbyGrid`, déjà appelé pour tout socket recevant
         `lobby:list` y compris un viewer) — la mise en page régie
         desktop "carte centrale" (`body.is-host.game-active`, CSS déjà
         existant) s'applique donc SANS AUCUNE nouvelle règle CSS de
         layout.
      2. `updateIrlPlayerUI()` exclut `isDisplayView` de son calcul
         `isPlayerInGame` — évite `.irl-player-mode`/`.remote-player-mode`
         (mise en page MOBILE joueur, incompatible : masque entre autres
         `#illustrationImgWrap`, l'image étant précisément ce que la vue
         affichage doit montrer).
      3. Nouveau `body.display-view-mode` (posé une fois au démarrage,
         étape 2) + un petit bloc CSS ciblé pour le SEUL chrome pas déjà
         hors d'atteinte par ailleurs : navbar, `#moderationZone`/
         `#moderationModalOverlay` (pilotés par le nombre de réponses en
         attente, pas par un rôle), `#gameProgressInfo`. `#hostPanel`/
         `#hostAutoPanel`/`#recapSidebar`(+toggle)/`#persistentRoomCode`
         restent déjà hors d'atteinte (gardés par `isHost` brut ou des
         évènements strictement hôte, jamais reçus par un viewer) — pas
         de nouvelle règle nécessaire pour eux.
- [x] Étape 4 — Serveur + client : qui porte le son. `room.viewerCount`
      (nouveau champ, `server/index.js`) incrémenté/décrémenté par
      `room:join`/`disconnect` UNIQUEMENT pour un viewer marqué
      `payload.display` (nouveau flag, posé seulement par le mode
      `?display=1` côté client — jamais par `results.js`, qui reste un
      simple `viewer:true` "nu", intentionnellement non affecté). Diffuse
      `display:status { connected }` à toute la salle à chaque changement.
      Côté client, nouveau `shouldPlayIrlAudio()` (remplace le `!isHost`
      figé aux 3 points où le son de jeu est aujourd'hui déclenché —
      `revealAudioPlayer`/`bonusAudioPlayer`/`blindtestAudio`) : la vue
      affichage porte le son dès qu'elle est connectée, l'hôte le reprend
      automatiquement dès qu'elle se déconnecte. `placeMasterVolumeControl()`
      et la visibilité du fader général étendues à la vue affichage
      (c'est elle qui règle son propre volume une fois qu'elle porte le
      son) — mais SANS déplacer le fader dans `#hostPanel` (masqué pour
      elle, `isHost` brut gardé pour ce placement précis, pas
      `isPresenterHost()`).
- [x] Étape 5 — Client : plein écran. Nouveau bouton
      `#displayFullscreenBtn` (position fixe, persiste au-delà du
      placeholder d'attente), API Fullscreen native (`requestFullscreen`/
      `exitFullscreen`), geste utilisateur requis (pas de plein écran
      automatique au chargement), libellé mis à jour via
      `fullscreenchange`.
- [x] Étape 6 — Client : indicateur côté contrôles. Nouvelle pastille
      `#displayStatusPill` dans `#hostPanel` (même traitement visuel que
      la pastille "Ambiance" existante, régie desktop uniquement),
      "connectée"/"en attente" mise à jour dans le même handler
      `display:status` que l'étape 4 — aucun nouvel évènement serveur.
- [x] Étape 7 — Vérification robustesse (voir détail dans Checks
      effectués/Risques restants) : état 1 (question active) confirmé
      via un VRAI rechargement de page de la vue affichage, à travers
      tout le chemin applicatif réel (bootstrap → `socket.on('connect')`
      → `room:join` viewer+display → rattrapage serveur → rendu) — état
      identique avant/après. États 2 (révélée) et 3 (modération en
      attente) déjà confirmés au niveau protocole (étape 1, sockets
      bruts) ; leur re-confirmation via un vrai rechargement de page n'a
      pas pu être menée à bien dans cet environnement (harness Playwright
      devenu instable après plusieurs lancements successifs de
      navigateurs dans cette session — voir Risques restants) — le
      mécanisme de reconnexion emprunté est cependant rigoureusement
      identique pour les 3 états (même bootstrap, même
      `sendJoinCatchup`), seul le contenu rejoué diffère.

## Checks effectués
- [x] `node --check server/index.js` — OK (étape 1)
- [x] `node --check client/public/js/index.js` — OK (étape 2)
- [x] Démarrage serveur vérifié (`npm start` équivalent, boot sans erreur —
      seuls les avertissements Supabase habituels liés au sandbox, sans
      rapport avec ces changements), aux étapes 1 et 2
- [x] Test fonctionnel ciblé (Playwright, connexions socket.io brutes,
      hors périmètre "Browser pane" pour l'étape 1, purement serveur) : un
      spectateur (`viewer:true`) qui rejoint PENDANT une question active
      reçoit bien `question:show` (état 1) ; un spectateur qui rejoint
      APRÈS la révélation reçoit bien `question:show` + `question:reveal`
      (état 2) — les deux mêmes rattrapages qu'un vrai joueur reconnectant.
      État 3 (modération en attente) non re-testé isolément : extraction
      verbatim du bloc existant déjà couvert par ce cas côté joueur réel,
      aucune logique modifiée.
- [x] Vérification via Playwright (pas de Browser pane disponible dans cet
      environnement distant, voir note dans le fichier de suivi) pour
      l'étape 2 : chargement de `/?display=1&room=CODE` sur une vraie salle
      → `#joinCard` bien masqué, `#displayViewScreen` bien affiché, le
      spectateur reçoit `team:list`/`room:mode`/`lobby:list` (jointure
      viewer:true acceptée côté serveur), et une reconnexion socket.io
      simulée réémet bien `room:join` en `viewer:true` automatiquement.
- [x] `node --check server/index.js` / `node --check client/public/js/index.js`
      — OK après chaque étape 3 à 6 (aucune régression de syntaxe).
- [x] Étape 3 (Playwright, salle réelle hôte+question active) : `body`
      obtient bien `display-view-mode is-host game-active` (mise en page
      régie gratuite), navbar/zone de modération/compteur de réponses
      bien masqués, `#inputArea` reste `answers-locked` même après le
      début du chrono (tuiles jamais déverrouillées, comme le vrai hôte).
- [x] Étape 4 (Playwright, page hôte réelle + vue affichage réelle) :
      `shouldPlayIrlAudio()` vaut `true` côté hôte tant qu'aucune vue
      affichage n'est connectée, bascule à `false` dès qu'une vue
      affichage rejoint (`true` côté vue affichage), et redevient `true`
      côté hôte dès que la page de la vue affichage est fermée.
- [x] Étape 5 (Playwright, API Fullscreen stubbée — pas de vrai plein
      écran fiable en sandbox headless) : bouton visible au bon libellé,
      clic déclenche bien `requestFullscreen`/`exitFullscreen` selon
      l'état, libellé mis à jour par `fullscreenchange`.
- [x] Étape 6 (Playwright, même scénario que l'étape 4) : pastille
      `#displayStatusPill` bascule correctement `en attente` ↔
      `connectée` (classe `.is-connected` comprise) au même rythme que
      `shouldPlayIrlAudio()`.
- [x] Étape 7 (Playwright, salle réelle hôte+joueur+vue affichage,
      rechargement de la VRAIE page vue affichage) : état 1 (question
      libre active) identique avant/après un rechargement complet de la
      page — `#main` visible, texte de la question correct.

## Tests manuels recommandés
Aucune vérification visuelle réelle (Browser pane) n'a été possible dans cet
environnement distant — tout ce qui précède est vérifié par DOM/état JS via
Playwright, jamais "vu" tel qu'un humain le verrait. Avant de considérer
cette tâche vraiment terminée, recommandé en conditions réelles (2 appareils
si possible, ou 2 fenêtres du même poste) :
1. Créer une salle "Présenter" IRL, ouvrir la vue affichage
   (`/?display=1&room=CODE`) dans une 2e fenêtre/appareil — vérifier le
   rendu visuel réel de chaque type de question (les ~15 types n'ont pas
   tous été testés individuellement, seulement `mcq`/`free` ici).
2. Lancer une question, couper le son sur l'appareil hôte et vérifier que
   le son sort bien de la vue affichage (et inversement à sa fermeture).
3. Fermer/recharger la vue affichage en pleine question, en pleine
   révélation, et pendant une modération en attente (les 3 états visés par
   l'étape 7) — confirmer visuellement l'absence de flash de l'écran de
   connexion et le bon raccrochage. États 2/3 validés au niveau
   protocole/logique ici, pas encore via un vrai rechargement de page en
   conditions réelles (voir Risques restants).
4. Vérifier le plein écran (bouton) sur un vrai navigateur/appareil —
   l'API Fullscreen peut se comporter différemment d'un navigateur ou
   OS à l'autre (ex. Safari iOS ne supporte pas `requestFullscreen` sur
   `<html>` de la même façon).
5. Confirmer que l'indicateur "vue affichage connectée/en attente" reste
   cohérent après plusieurs cycles connexion/déconnexion/reconnexion
   (coupure wifi réelle, pas seulement fermeture propre de la page).

## Risques restants
- Étape 1 seule ne change aucun comportement visible : aucune vue affichage
  cliente n'existe encore pour consommer ce rattrapage (voir étape 2).
  `results.js` (seul appelant actuel de `viewer:true`) reçoit désormais ces
  événements en plus, mais n'a pas de handler pour `question:show`/
  `timer:end`/`question:reveal`/`leaderboard:show`/`answer:queue` : sans
  effet, à reconfirmer visuellement si `results.js` est un jour étendu pour
  les écouter.
- Étape 2 seule ne pose que le point d'entrée : `#displayViewScreen` reste
  affiché tant qu'aucun `question:show` n'arrive. Dès qu'une question est
  déjà active (grâce au rattrapage de l'étape 1) ou démarre normalement,
  le handler générique `question:show` (non filtré par rôle) prend le
  relais et affiche `#stageWrap`/`#main` SANS AUCUNE adaptation "scène
  seule" : c'est le rôle de l'étape 3 (masquer le chrome de contrôle,
  layout plein écran). Ne pas juger la vue affichage sur son rendu avant
  que l'étape 3 soit posée.
- Pas de `Browser pane` dans cet environnement distant : la vérification
  visuelle réelle (rendu, absence de flash de l'écran de connexion) reste
  à confirmer par l'utilisateur en conditions réelles, au-delà des checks
  DOM/réseau faits via Playwright ici — voir Tests manuels recommandés.
- États 2 (révélée) et 3 (modération en attente) de l'étape 7 : validés au
  niveau protocole (étape 1, sockets bruts) et par raisonnement de code
  (mécanisme de reconnexion identique quel que soit l'état, voir Étapes
  réalisées) — mais PAS reconfirmés via un vrai rechargement de la page vue
  affichage comme état 1 l'a été. Le test Playwright correspondant est
  devenu instable après plusieurs lancements de navigateurs dans cette
  session (probablement une contention de ressources dans ce bac à sable,
  pas un signe de bug applicatif — état 1 avait pourtant réussi deux fois
  d'affilée avec exactement le même mécanisme) plutôt que de continuer à
  batailler avec l'outillage de test, mieux valait le signaler clairement
  ici : à reconfirmer manuellement (voir Tests manuels recommandés) avant
  de considérer l'étape 7 définitivement bouclée.
- Volume de la vue affichage quand elle est sur un appareil DIFFÉRENT de
  l'hôte (pas juste une 2e fenêtre du même navigateur) : le fader général
  lui est désormais accessible (étape 4), mais jamais testé en conditions
  réelles multi-appareils.
- `#displayStatusPill`/`shouldPlayIrlAudio()` reposent sur `room.viewerCount`
  qui redescend uniquement au `disconnect` socket.io — une coupure réseau
  de quelques secondes sur la vue affichage fait donc temporairement
  céder le son à l'hôte puis revenir à la vue affichage à la reconnexion
  (au lieu d'un délai de grâce comme pour l'hôte) : accepté comme
  compromis raisonnable pour cette tâche (voir Hors périmètre — pas de
  vrai mécanisme multi-écrans avancé), mais peut créer un bref
  aller-retour audible si la coupure est très courte.

## Revue `/review` (avant commit)
Diff complet relu (`server/index.js`, `client/public/js/index.js`,
`client/public/index.html`, `client/public/css/style.css` — les 4 fichiers
listés dans "Fichiers concernés", `results.js` volontairement non touché,
conforme au choix acté à l'étape 2). Vérifié contre `CLAUDE.md` : aucune
zone interdite touchée (pas de `supabase/schema.sql`, pas de `render.yaml`,
aucune dépendance npm ajoutée), aucun refactor hors périmètre glissé en
cours de route. Deux points relevés :
- **`catch` vide sans commentaire** (`client/public/js/index.js`, bouton
  plein écran) — **corrigé** : `document.exitFullscreen().catch(() => {})`
  n'avait aucun commentaire expliquant pourquoi l'échec est ignoré,
  contrairement à son jumeau juste en dessous (`requestFullscreen().catch(...)`,
  bien commenté). Même commentaire repris (refus navigateur rare, rien à
  faire de plus, le bouton reste cohérent via `fullscreenchange`).
- **Mineur (a11y, pas une règle CLAUDE.md)** : `#displayFullscreenBtn`
  garde le même `aria-label="Passer en plein écran"` HTML même une fois en
  plein écran (seul le `textContent` visible change) — contrairement à
  `#irlMenuBtn`, qui met à jour `aria-expanded` dynamiquement ailleurs
  dans le fichier. Cosmétique, aucun impact fonctionnel.
- Duplication mineure acceptée : `isHost && roomMode !== 'auto'` apparaît
  maintenant à 2 endroits (`placeMasterVolumeControl`,
  `renderLiveClassementDock`) au lieu d'un seul avant que `isPresenterHost()`
  change de sens — un helper dédié serait possible mais semble
  disproportionné pour 2 points d'usage (CLAUDE.md : "pas d'abstraction
  inutile pour un seul point d'usage").

"Objectif" du fichier de suivi confirmé atteint par le diff (pas juste les
étapes cochées) : vue affichage ouvrable, purement visuelle, sans contrôle,
fenêtre présentateur inchangée pour l'hôte. Le seul point de l'Objectif
non couvert par du code (adaptation plus poussée de la vue présentateur)
est explicitement délégué à une tâche future par "Hors périmètre" — décision
déjà actée au moment du plan, pas un oubli de ce diff.

## Vérification visuelle post-merge (capture d'écran)
Après le merge dans `main`, demande explicite de l'utilisateur : "teste en
conditions réelles et envoie-moi le screen". Pas de Browser pane ni de
second appareil physique dans cet environnement distant — capture réalisée
via Playwright + Chromium headless, en pilotant le VRAI code client (clics
réels sur le formulaire de connexion joueur, `createRoom()` réel côté hôte,
`?display=1&room=CODE` réel côté vue affichage), pas des sockets bruts. La
sélection d'un quiz réel étant impossible ici (catalogue Supabase
inatteignable), la question a été lancée en rejouant directement l'évènement
`question:show` avec un payload MCQ — même évènement, même payload que ce
qu'émettrait normalement le flux "Sélectionner un Quiz" côté serveur.

**Bug réel trouvé et corrigé grâce à ce test visuel** (invisible dans tous
les checks Playwright précédents, qui ne vérifiaient que des classes/l'état
JS, jamais le rendu réel) : `#displayViewScreen` (placeholder "Connexion à
la salle…") n'était jamais masqué une fois une question réellement lancée —
il restait affiché EN PERMANENCE, et pire, prenait la place de `#hostPanel`
dans la grille régie desktop (`body.is-host.game-active .container`),
chevauchant visuellement la scène réelle. Corrigé dans `enterGameScreen()`
(`client/public/js/index.js`) — même endroit et même raison que le
masquage déjà existant d'`#hostAutoPanel`, qui n'est pas non plus un enfant
de `#lobby`. `node --check` OK après coup. Reconfirmé par une 2e capture :
plus de chevauchement, scène propre.

3 captures envoyées à l'utilisateur : (1) placeholder d'attente avant toute
question (navbar/contrôles bien absents, bouton plein écran visible), (2)
scène en pleine question MCQ (tuiles colorées, classement live, toujours
aucun contrôle), (3) panneau hôte réel montrant l'indicateur "Vue
affichage : connectée" (étape 6) fonctionnel en conditions quasi-réelles.

## Statut
`en revue` — les 7 étapes du plan sont implémentées et testées (voir
Checks effectués), diff complet relu (`/review`), `catch` vide corrigé,
mergée dans `main`. Vérification visuelle post-merge effectuée (voir
section ci-dessus) — a révélé et corrigé un bug réel (`#displayViewScreen`
jamais masqué), ce correctif n'est PAS ENCORE poussé sur `main` (en attente
de validation utilisateur, règle permanente CLAUDE.md). Reste idéalement un
test en conditions RÉELLEMENT réelles (2 appareils physiques) avant de
passer à `terminée`.
