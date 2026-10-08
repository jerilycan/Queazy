# [053] Revue et harmonisation des textes visibles de l'application

## Contexte
Retour utilisateur (07/10) : « on va revoir les textes un peu partout dans l'app ; certains ne sont pas raccord avec l'existant — par exemple « choisis entre les X types de question » : on avait modifié X à une époque car c'était faux ».
L'appli a beaucoup évolué (types de question passés de 13 à 17, mode Standard/Avancé, Timeline refaite, podium du quiz dans le salon, vue TV, aperçu « Tester »…) alors que des textes ont été écrits à chaque étape : certains citent encore des chiffres, des fonctionnements ou des noms qui ne sont plus exacts.

## Objectif
Vérifiable concrètement :
1. Un **inventaire** des textes visibles incohérents ou périmés (chiffres, noms de types, descriptions de mécaniques, boutons/menus qui n'existent plus ou ont changé de nom, ton/tutoiement mélangés, orthographe).
2. Chaque texte retenu est **corrigé** pour correspondre à l'existant ; tout nombre qui dérive (ex. nombre de types) est **calculé** depuis la source (liste des types) plutôt qu'écrit en dur, quand c'est simple.
3. Aucun changement de comportement : uniquement du texte (et au plus de petits calculs de compteur).

## Périmètre
- Textes affichés au joueur / à l'hôte / à la TV / dans l'éditeur : pages HTML (`index`, `editor`, `select`, `profile`, `login`, `result`, `display`, `admin-bank`), chaînes des scripts clients (toasts, bulles d'aide, descriptions de types, tutoriel de l'éditeur, popups, bandeaux), messages envoyés par le serveur et affichés (erreurs, annonces).
- Les aides des types de question : `QUESTION_TYPE_META` (index.js), `QTYPE_HINTS` / aide de l'éditeur (editor.js), étapes du tutoriel de l'éditeur, textes de « Comment jouer ? ».
- Cohérence terminologique : Présenter / Jouer / Rejoindre, MJ / hôte, Standard / Avancé, repère / tuile à placer, etc.

## Hors périmètre
- Nouvelle fonctionnalité ou changement de comportement.
- Traduction / internationalisation.
- Commentaires de code (sauf s'ils décrivent un texte affiché).
- Refonte visuelle (mise en forme, couleurs) : traitée à part.
- Refonte des textes juridiques ou des e-mails Supabase.

## Décisions validées (07/10)
1. **Tutoiement partout** (comme le reste de l'appli).
2. **Nombres calculés** quand la source existe (nombre de types), sinon on évite le chiffre.
3. Messages serveur : par défaut, **inclus seulement ceux affichés tels quels** côté client (non tranché par l'utilisateur — à corriger si tu préfères les exclure).

## Fichiers concernés
- `client/public/index.html`, `editor.html`, `select.html`, `profile.html`, `login.html`, `result.html`, `display.html`, `admin-bank.html` — textes statiques.
- `client/public/js/index.js` — `QUESTION_TYPE_META`, popups, toasts, textes du salon / de la partie.
- `client/public/js/editor.js` — aides de types (`QTYPE_HINTS`), tutoriel de l'éditeur (ex. « 17 types disponibles… »), toasts d'erreur.
- `client/public/js/select.js`, `profile.js`, `login.js`, `results.js`, `results-finale.js`, `display.js`, `admin-bank.js`, `ui-widgets.js` — chaînes visibles.
- `server/index.js` — messages d'erreur / annonces affichés tels quels (selon la décision ci-dessus).

## Constats de l'exploration (avant plan)
- **Chiffre en dur** : tutoriel de l'éditeur (`editor.js`, `EDITOR_TOUR_STEPS`, étape « Type de question ») : « 17 types disponibles : … » écrit en dur avec la liste complète — déjà faux une fois (13 puis 15) ; c'est très probablement le « choisis entre les X types » cité. Autres « 16/17 types » : seulement dans des commentaires.
- **Vouvoiement isolé** : `index.html` « Préparez-vous pour le début de la partie » ; `editor.html` « Entrez votre question ici... » ; `editor.js` « Voulez-vous vraiment supprimer ce quiz ? » ; placeholder « Entrez du texte... ».
- **Orthographe** : `display.html` « Le quizz va bientôt commencer » (partout ailleurs : « quiz »).
- **Anglais** : serveur `room:error` « room not found ».
- **Mécaniques périmées probables** : tutoriel de l'éditeur (étapes « Illustration » et « Explication » — l'illustration est maintenant dans le bloc « Image et son », l'explication dans « Après la révélation » ; rien sur Standard/Avancé, « Tester », l'image du quiz, ni les repères du Timeline) ; info-bulle du mode « à distance » (`index.html`, parle d'« un présentateur » alors que l'appli dit MJ / hôte / Organisateur) ; 4 sources de description des types à garder cohérentes (`QUESTION_TYPE_META`, `QTYPE_HINTS`, étapes d'aide, GIF « Comment jouer ? »).
- **Vocabulaire mélangé** : hôte / MJ / organisateur / présentateur ; « Mode présentation » (bouton TV) vs « Présenter » (navbar).
- L'exploration n'est PAS exhaustive : l'étape 1 du plan est justement l'inventaire complet.

## Inventaire (étape 1 — lecture seule, à valider avant toute modification)
Méthode : extraction automatique de ~460 chaînes visibles (8 pages HTML, 12 scripts clients, `server/index.js`) puis relecture une à une, plus vérification des nombres affichés contre les constantes du code. Les chaînes jugées justes ne sont pas listées.

### A. Chiffres et limites faux ou fragiles
| # | Où | Texte actuel | Problème | Proposition |
|---|---|---|---|---|
| A1 | `editor.js:6200` (tutoriel, étape « Type de question ») | « 17 types disponibles : QCM, Vrai/Faux, … texte libre. » | Chiffre ET liste écrits en dur (déjà faux à 13 puis 15) — le « X types » signalé | « ${n} types disponibles — QCM, Vrai/Faux, Timeline, Blind Test… », `n` = nombre d'options de `#qType` ; liste raccourcie en exemples |
| A2 | `editor.html:441` | « Indices (1 à 4), chacun avec son délai d'apparition » | **Faux** : `INDICE_MAX_HINTS = 6` (éditeur) | « Indices (1 à 6)… » — ou plage lue depuis les constantes |
| A3 | `editor.js:2937` (aide du type Halo) | « jusqu'à 5 fois (chaque clic après le 1er coûte des points) » | **Faux** : le serveur fait payer **chaque** clic (50 / 100 / 150 / 200 / 250, plus de 1er clic gratuit) ; `editor.html:410` et `index.js:757` le disent correctement | « jusqu'à 5 fois (chaque clic coûte des points, de plus en plus) » |
| A4 | `editor.html` : « (2 à 8) » Paires, Frise, « (2 à 5) » Zones, « (4 à 12) » Cartes, « (3 à 8) » Options d'intrus, « jusqu'à 8 » photos ; « 30 s max », « 15 s max », « 10 Mo », « 25 Mo » | — | Aujourd'hui **justes**, mais écrits en dur à côté de constantes JS (c'est ainsi que A2 est arrivé) | Option : remplir ces bornes depuis les constantes au chargement (petite fonction) — à décider |

### B. Mécaniques ou emplacements décrits de façon périmée
| # | Où | Texte actuel | Problème | Proposition |
|---|---|---|---|---|
| B1 | `editor.js:6203` (tutoriel, « Illustration ») | « Ajoute une image au-dessus de la question, purement décorative… » | L'image s'affiche **sous** la question (corrigé dans `editor.html:493`), et le bloc s'appelle « Image et son » | « Dans « Image et son », ajoute une image sous la question, purement décorative… » |
| B2 | `editor.js:6204` (tutoriel, « Explication ») | « Explication (optionnelle) » | Le bloc s'appelle « Après la révélation » (texte, image, son) | « Après la révélation (optionnelle) : texte, image ou son… » |
| B3 | `editor.js` tutoriel (EDITOR_TOUR_STEPS) | — | **Aucune étape** pour : mode Standard/Avancé, « Tester », image du quiz (pastille), repères du Timeline | Ajouter 3 étapes courtes (Standard/Avancé, Image du quiz, Tester) |
| B4 | `index.html:635` (info-bulle « Quiz à distance ») | « …la navbar disparaît… (un présentateur les montre sur l'écran commun)… l'écran de l'hôte » | Jargon (« navbar »), et « présentateur » n'existe plus nulle part ailleurs | « …la barre du haut disparaît au profit d'une petite roue crantée, les images décoratives sont masquées (l'hôte les montre sur l'écran commun)… » |
| B5 | `editor.html:978` (encart Standard) | « Brouillon, banque de questions, image, son et médias de révélation… » | Incomplet depuis la tâche 052/051 (catégorie, difficulté, image du quiz…) | « Brouillon, banque de questions, catégorie, difficulté, image, son et médias de révélation — tout reste réglable en un clic. » |
| B6 | Types de question (descriptions) | 4 formulations indépendantes : `QUESTION_TYPE_META` (`index.js`), `QTYPE_HINTS` (`editor.js:2923-2937`), textes sous chaque section (`editor.html`), GIF | Pas de contradiction trouvée **hors A3**, mais aucune source commune : risque de dérive | Ne rien factoriser (hors périmètre) ; relire les 17 types ensemble à l'étape 5 |

### C. Vouvoiement isolé (le reste de l'appli tutoie)
| # | Où | Texte actuel | Proposition |
|---|---|---|---|
| C1 | `index.html:569` (salon) | « Préparez-vous pour le début de la partie » | « Prépare-toi pour le début de la partie » |
| C2 | `editor.html:347` (placeholder) | « Entrez votre question ici... » | « Écris ta question ici... » |
| C3 | `editor.js:4899` (placeholder générique) | « Entrez du texte... » | « Écris ta réponse... » (ou « Saisis du texte... ») |
| C4 | `editor.js:6166` (confirm de repli) | « Voulez-vous vraiment supprimer ce quiz ? » | « Veux-tu vraiment supprimer ce quiz ? » |
| C5 | `index.js:7588` (hôte, échec d'envoi du média) | « …question non démarrée — réessayez » (la ligne suivante dit « réessaie ») | « …question non démarrée — réessaie » |

### D. Orthographe
| # | Où | Texte actuel | Proposition |
|---|---|---|---|
| D1 | `display.html:163` (écran TV d'attente) | « Le quizz va bientôt commencer » | « Le quiz va bientôt commencer » |

### E. Vocabulaire (hôte / MJ / présentateur / Mode présentation)
| # | Constat | Proposition à valider (glossaire, étape 2) |
|---|---|---|
| E1 | Dans l'interface visible : « hôte » (partout), « Organisateur » (badge), « Contrôles de l'hôte ». « MJ » n'apparaît que dans des commentaires de code ; « présentateur » une seule fois (B4). | Texte visible : **hôte** (badge « Organisateur » conservé). « MJ » et « présentateur » bannis des textes affichés. |
| E2 | Bouton de l'écran TV : « 🖥️ Mode présentation » (`index.html:891`) alors que la barre du haut dit « Présenter » (créer une salle) — deux sens proches pour deux choses différentes | « 🖥️ Écran TV » (ou « Écran de présentation »), au choix |
| E3 | « Quiz à distance (chacun sur son écran) » (libellé) vs « IRL » (info-bulle) | Garder « en présentiel » / « à distance » partout, expliquer « IRL » une fois dans l'info-bulle ou le remplacer par « en présentiel » |

### F. Vus et laissés tels quels (pour mémoire)
- `server/index.js:1372` « room not found » : anglais mais **jamais affiché** (aucun gestionnaire côté client) — à traduire seulement si on le branche un jour.
- Messages serveur affichés (« La salle a été fermée par l'hôte. », « Tu as été exclu de la salle par l'hôte. », « Tous les joueurs ne sont pas prêts ! », « L'hôte s'est déconnecté. ») : corrects et tutoyés.
- Textes de l'animation de fin (« Signal instable… », « Suppression des données… ») : volontairement thématiques.
- Libellés de la page de modération (`admin-bank`) : cohérents entre eux, réservés aux admins.

## Plan
1. **Inventaire complet (lecture seule, aucun code modifié).** Parcourir les 8 pages HTML, les scripts clients et les messages serveur affichés ; consigner dans cette fiche un tableau « fichier:ligne · texte actuel · problème · texte proposé », groupé par catégorie (chiffres, mécanique périmée, tutoiement, orthographe, anglais, vocabulaire). Validation de l'utilisateur sur le tableau avant toute modification (le choix des mots est subjectif). Trade-off : un tableau à valider d'abord évite de réécrire des dizaines de textes au goût de l'assistant.
2. **Glossaire et décisions de vocabulaire** (dans la fiche) : un terme par notion (ex. MJ vs hôte vs Organisateur vs présentateur ; Présenter / Jouer / Rejoindre ; Mode présentation) ; appliqué ensuite partout. À valider avec l'inventaire.
3. **Chiffres calculés.** Tutoriel de l'éditeur : nombre de types lu depuis `#qType` (`option`) au moment de construire l'étape, et suppression de la liste exhaustive en dur (quelques exemples + « et d'autres »). Autres compteurs trouvés à l'étape 1 traités pareil. Trade-off : calculer évite que le chiffre redevienne faux au prochain type ajouté ; la liste complète, elle, redeviendrait fausse aussi.
4. **Tutoiement, orthographe, anglais.** Corrections ponctuelles listées à l'étape 1 (`index.html`, `editor.html`, `editor.js`, `display.html`, `server/index.js` pour les messages affichés tels quels). Aucune logique modifiée.
5. **Mécaniques périmées.** Réécriture des textes qui décrivent un fonctionnement qui a changé : tutoriel de l'éditeur (nouvel ordre : titre, ajouter une question, type, énoncé, Image et son, réponse, « Après la révélation », mode Standard/Avancé, Tester, Sauvegarder), info-bulle IRL/à distance, descriptions de types cohérentes entre elles (une phrase de référence par type, reprise dans les 3 endroits où elle apparaît quand c'est possible sans refactor).
6. **Vérification et relecture.** `node --check` sur chaque JS modifié ; passage visuel dans le Browser pane sur chaque page touchée (accueil, salon, éditeur + tutoriel, sélection de quiz, résultats, vue TV, connexion) ; `/review`.

Chaque étape = un diff relu et validé avant la suivante (`/implement-step`). **Aucune zone interdite du `CLAUDE.md` touchée** (pas de `schema.sql`, `render.yaml` ni dépendance) ; pas de `git push` dans ce plan.

## Étapes réalisées
- [x] 1. Inventaire complet (voir « Inventaire » ci-dessus) — **à valider par l'utilisateur** avant l'étape 2.
- [x] 2. Glossaire : dans les textes visibles, **hôte** (badge « Organisateur » conservé) ; « MJ » et « présentateur » bannis ; le bouton de la vue TV devient **« Écran TV »** (plus « Mode présentation », trop proche de « Présenter ») ; « IRL » remplacé par « en présentiel » dans l'info-bulle ; « Quiz à distance » inchangé.
- [x] 3. Chiffres : nombre de types du tutoriel lu dans `qType.options.length` (liste exhaustive retirée) ; « Indices (1 à 6) » corrigé ; aide du Halo corrigée. **A4 non fait** (bornes « 2 à 8 »… laissées en dur, justes aujourd'hui).
- [x] 4. Tutoiement, orthographe : C2, C3, C4, C5, D1 faits. **C1 volontairement NON modifié** (« Préparez-vous pour le début de la partie » s'adresse à toute la salle — décision utilisateur).
- [x] 5. Mécaniques : tutoriel de l'éditeur réécrit (12 étapes dont Image du quiz, Standard/Avancé, Tester ; Image / Après la révélation corrigés), info-bulle du mode à distance, encart Standard (catégorie, difficulté).
- [x] 6. Vérification et relecture (voir ci-dessous)

## Checks effectués
- [x] `node --check <fichier>` sur chaque fichier JS modifié (étape 1 : aucun fichier de code modifié)
- [ ] Démarrage serveur vérifié (si `server/index.js` touché)
- [x] Vérification (si client touché) : textes servis par le serveur local relus sur index, display et editor ; les 12 cibles du tutoriel existent dans `editor.html` (script) et le nombre de types calculé vaut 17. **Non vérifié à l'œil** : le tutoriel lui-même (l'éditeur exige une connexion, session perdue dans le volet).

## Tests manuels recommandés
- **Éditeur, bouton « Tutoriel »** : parcourir les 12 étapes en mode Standard puis en mode Avancé (les étapes dont la cible est masquée sont sautées) ; vérifier l'ordre, les textes et que « 17 types » correspond bien au menu.
- Étape « Tester la question » : visible seulement quand une question est ouverte.
- Salon : texte « Préparez-vous… » inchangé (volontaire, s'adresse à toute la salle) ; info-bulle « Quiz à distance » (« en présentiel », « barre du haut »).
- Bouton « 🖥️ Écran TV » côté hôte en partie « Présenter » : ouvre bien la fenêtre TV ; écran d'attente TV : « Le quiz va bientôt commencer ».
- Éditeur : placeholders (« Écris ta question ici... », « Écris ici... »), « Indices (1 à 6) » (vérifier qu'on peut bien en ajouter 6), aide du Halo, encart du mode Standard.
- Supprimer un quiz depuis l'éditeur : la boîte de confirmation habituelle s'affiche (le « Veux-tu vraiment… » n'est qu'un repli sans la bibliothèque d'interface).
## Risques restants
- Le tutoriel de l'éditeur n'a pas été vu à l'œil (connexion requise, session perdue dans le volet de test) : seuls ses textes et ses 12 cibles ont été vérifiés par script.
- Les bornes affichées (« 2 à 8 », « 3 à 8 », « 4 à 12 », durées et poids maximaux) restent écrites en dur à côté des constantes du code : elles sont justes aujourd'hui mais peuvent dériver (c'est ainsi que « Indices (1 à 4) » est devenu faux). Piste : les lire depuis les constantes (non faite, décision utilisateur).
- Le glossaire (hôte, Écran TV…) ne couvre que les textes affichés : des commentaires de code utilisent encore « MJ ».
- L'extraction automatique des textes ne voit que les chaînes entre guillemets : un texte construit par morceaux a pu lui échapper.
- Quatre sources de description des types de question restent indépendantes (`QUESTION_TYPE_META`, `QTYPE_HINTS`, textes de l'éditeur, GIF) : aucune contradiction trouvée après correction du Halo, mais rien ne garantit qu'elles le resteront.
## Statut
`en review`
