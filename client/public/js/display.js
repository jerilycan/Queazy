// Vue Joueur dédiée TV/vidéoprojecteur (tâche 040) — page séparée de
// index.html/index.js (l'interface MJ elle-même), sur le patron déjà en
// place pour result.html/results.js : connexion Socket.io en lecture seule
// (viewer:true, voir server/index.js room:join), affichage EN COURS de la
// question active plutôt qu'un résumé final. Aucune duplication de la
// logique métier serveur — on ne fait qu'afficher les payloads déjà
// "sans spoiler" (voir server/index.js payloadWithoutCorrectOrExplanation).
// Rendu volontairement minimal (design validé par l'utilisateur) : prompt +
// tuiles + image, jamais de barre de temps ni d'indication de bonne/
// mauvaise réponse — un écran projeté, personne n'y répond. Classement
// entre les questions ajouté en tâche 041 (étape 6, retour utilisateur),
// revient sur l'exclusion initiale de la tâche 040 — voir plus bas.
const roomCode = new URLSearchParams(location.search).get('room') || ''
const socket = io()

const displayWaiting = document.getElementById('displayWaiting')
const displayContent = document.getElementById('displayContent')
const displayIllustrationWrap = document.getElementById('displayIllustrationWrap')
const displayIllustrationZoomLayer = document.getElementById('displayIllustrationZoomLayer')
const displayIllustration = document.getElementById('displayIllustration')
const displayPrompt = document.getElementById('displayPrompt')
const displayOptions = document.getElementById('displayOptions')
const displayLeaderboard = document.getElementById('displayLeaderboard')
const displayLeaderboardList = document.getElementById('displayLeaderboardList')

socket.on('connect', () => {
  socket.emit('room:join', { roomCode, viewer: true })
})

// L'image ("imageUrl"/"enigmeImageUrl" pour les types qui portent une image-
// mécanique propre, "illustrationUrl" pour tous les autres) — voir index.js
// emitQuestion, un seul de ces 3 champs est jamais présent à la fois pour
// une même question (imageToUpload n'uploade qu'UNE seule image par
// question). On l'affiche systématiquement quand présente, y compris pour
// les types en repli (étape 3 du plan) : aucune mécanique dédiée reproduite,
// juste l'illustration en haut de l'écran.
const illustrationUrlOf = (payload) => payload?.illustrationUrl || payload?.imageUrl || payload?.enigmeImageUrl || ''

// Animation d'apparition (tâche 041, étape 3) : jusqu'ici la question
// apparaissait d'un coup, sans transition, contrairement à l'écran de jeu
// MJ. Réutilise tel quel le @keyframes tileRevealIn (style.css, déjà global
// — non scopé à l'écran MJ) via la même mécanique qu'index.js
// (applyTileReveal/REVEAL_QUESTION_BEAT_MS/REVEAL_STAGGER_MS, dupliqués ici
// à l'identique — même convention déjà suivie pour QUESTION_TYPE_META dans
// editor.js/admin-bank.js, pas de module partagé dans ce projet) : le
// prompt apparaît tout de suite, l'illustration et la première tuile après
// un "temps de lecture" de REVEAL_QUESTION_BEAT_MS, puis chaque tuile
// suivante avec un délai supplémentaire de REVEAL_STAGGER_MS.
const REVEAL_QUESTION_BEAT_MS = 900
const REVEAL_STAGGER_MS = 350
const applyTileReveal = (el, index) => {
  // Repasser deux fois la MÊME chaîne d'animation sur un élément PERSISTANT
  // (prompt/illustration, jamais recréés d'une question à l'autre,
  // contrairement aux tuiles ci-dessous) ne la rejouerait pas — le
  // navigateur ne voit alors aucun changement de valeur. Le forcer à
  // repartir de zéro (none + reflow forcé) avant de la réappliquer.
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = `tileRevealIn 0.5s cubic-bezier(.34,1.56,.64,1) ${REVEAL_QUESTION_BEAT_MS + index * REVEAL_STAGGER_MS}ms both`
}

// "zoomguess" : l'image EST le mécanisme du jeu (elle démarre très zoomée
// et se dézoome progressivement pendant le minuteur), pas une illustration
// décorative comme pour les autres types — voir index.js (~ligne 7090+).
// Bug corrigé ici (tâche 041, étape 1) : le repli générique affichait
// jusqu'ici l'image COMPLÈTE dès l'apparition de la question (aucun
// transform appliqué), exposant la réponse immédiatement sur la TV — cassait
// le jeu pour tout le monde puisque c'est un écran partagé, contrairement au
// téléphone d'un joueur où lui seul aurait "triché". ZOOMGUESS_ANSWER_WINDOW_MS
// miroir exact de la constante d'index.js (même nom, même valeur) : l'image
// atteint scale(1) cette durée AVANT la fin du chrono, pas pile dessus.
const ZOOMGUESS_ANSWER_WINDOW_MS = 10000
let zoomTickIntervalId = null
const clearZoomTick = () => {
  if (zoomTickIntervalId) { clearInterval(zoomTickIntervalId); zoomTickIntervalId = null }
}

const renderIllustration = (payload) => {
  // Toujours nettoyé en premier, même si la question suivante n'est pas
  // "zoomguess" — sinon un intervalle de la question PRÉCÉDENTE continuerait
  // à écraser le transform de la nouvelle image (aucune classe .zoomguess
  // pour le distinguer, juste une variable de module comme
  // currentIntrusRequestToken plus haut).
  clearZoomTick()
  const url = illustrationUrlOf(payload)
  const zoom = payload?.type === 'zoomguess' ? payload.zoom : null
  // Bug trouvé en implémentant l'étape 2 (espacement) : masquer seulement
  // l'<img> (comme avant l'étape 1) ne suffit plus depuis que l'illustration
  // est enveloppée dans #displayIllustrationWrap — un wrapper resté visible
  // mais vide compte quand même comme enfant flex de .display-content
  // (`gap`, voir style.css), ce qui aurait ajouté un vide en haut de l'écran
  // sur TOUTE question sans image (la majorité). Le wrapper entier suit donc
  // maintenant la présence de l'image, pas seulement l'<img> à l'intérieur.
  displayIllustrationWrap.classList.toggle('d-none', !url)
  displayIllustrationWrap.classList.toggle('display-zoom-box', !!zoom)
  // Animée seulement si elle va réellement s'afficher (voir le toggle
  // d-none ci-dessus) — animer un élément qui reste caché ne sert à rien et
  // laisserait une transition "surprise" si une question SANS illustration
  // suivait une question AVEC (l'animation resterait armée dessus).
  if (url) applyTileReveal(displayIllustrationWrap, 0)
  // Bandes vides éventuelles (voir imageBg côté MJ, même mécanisme) — remis
  // à vide hors zoomguess pour ne pas laisser la couleur d'une question
  // précédente sur ce wrapper réutilisé.
  displayIllustrationWrap.style.background = (zoom && payload.imageBg) ? payload.imageBg : ''
  if (zoom) {
    // Zoom initial posé tout de suite, AVANT le chargement de l'image
    // ci-dessous (même ordre que côté MJ) : la question révélée doit
    // apparaître déjà zoomée, pas dézoomée puis re-zoomée une fois l'image
    // chargée.
    displayIllustrationZoomLayer.style.transformOrigin = `${zoom.x * 100}% ${zoom.y * 100}%`
    displayIllustrationZoomLayer.style.transform = `scale(${zoom.startScale})`
    const totalMs = Number(payload.timerMs) || 15000
    const zoomDuration = Math.max(0, totalMs - ZOOMGUESS_ANSWER_WINDOW_MS)
    const start = payload.startTs
    // Pas de correction d'horloge (syncedNow() côté MJ) ici : un léger
    // décalage d'horloge locale ne produit qu'une différence cosmétique
    // imperceptible sur l'angle du dézoom, jamais un problème de fond —
    // ajouter tout un mécanisme de synchronisation pour ça serait
    // disproportionné (page en lecture seule, personne n'y répond).
    const tick = () => {
      const progress = zoomDuration > 0 ? Math.min(1, Math.max(0, (Date.now() - start) / zoomDuration)) : 1
      const scale = zoom.startScale + (1 - zoom.startScale) * progress
      displayIllustrationZoomLayer.style.transform = `scale(${scale})`
      if (progress >= 1) clearZoomTick() // dézoom terminé, plus rien à recalculer jusqu'à la question suivante
    }
    tick()
    zoomTickIntervalId = setInterval(tick, 100) // ~10x/seconde, même cadence que côté MJ
  } else {
    displayIllustrationZoomLayer.style.transformOrigin = ''
    displayIllustrationZoomLayer.style.transform = ''
  }
  // Bug trouvé en QA (stress test : illustrationUrl invalide/404) : sans
  // onerror, une image cassée peut laisser une icône "image manquante" du
  // navigateur en plein écran projeté — repli déjà en place côté MJ pour ce
  // même risque (voir index.js, plusieurs `.onerror = () => classList.add
  // ('d-none')`, ex. illustrationImg/rechercheImg/haloImg), repris ici tel
  // quel. Réassigné à chaque appel (comme côté MJ) : une réponse en retard
  // pour une ANCIENNE image ne peut pas s'appliquer après coup, le
  // navigateur abandonne une requête d'image dont le `src` a déjà changé.
  displayIllustration.onerror = () => {
    displayIllustration.classList.add('d-none')
    displayIllustrationWrap.classList.add('d-none') // même raison que le toggle ci-dessus : pas de wrapper vide qui consomme un `gap` pour rien
  }
  displayIllustration.src = url || ''
  displayIllustration.classList.toggle('d-none', !url)
}

const clearOptions = () => {
  displayOptions.innerHTML = ''
  displayOptions.className = 'options-grid d-none'
  displayOptions.style.removeProperty('--mcq-cols')
}

// QCM : mêmes tuiles/mêmes couleurs que l'écran de jeu MJ (.option-btn,
// système de 8 couleurs/formes via :nth-child(8n+X) déjà dans style.css) —
// purement informatif ici, aucun onclick (personne ne répond depuis la TV).
const renderMcq = (payload) => {
  const options = Array.isArray(payload.options) ? payload.options : []
  displayOptions.className = 'options-grid'
  // Même formule que index.js (renderQuestion) pour rester visuellement
  // cohérent avec l'écran MJ à nombre d'options égal.
  displayOptions.style.setProperty('--mcq-cols', options.length <= 4 ? 2 : options.length <= 6 ? 3 : 4)
  options.forEach((opt, idx) => {
    const el = document.createElement('div')
    el.className = 'option-btn'
    el.textContent = opt
    displayOptions.appendChild(el)
    // Tuile fraîchement créée (voir clearOptions à chaque question) : pas
    // besoin du "reset" de applyTileReveal pour un élément persistant, mais
    // la fonction reste inoffensive à appeler (l'élément n'a de toute façon
    // aucune animation préexistante à réinitialiser).
    applyTileReveal(el, idx)
  })
}

// Vrai/Faux : mêmes 2 grandes tuiles losange/triangle que l'écran MJ (voir
// .options-grid.truefalse-grid dans style.css).
const renderTruefalse = (payload) => {
  const choices = Array.isArray(payload.options) && payload.options.length === 2 ? payload.options : ['Vrai', 'Faux']
  displayOptions.className = 'options-grid truefalse-grid'
  choices.forEach((opt, idx) => {
    const el = document.createElement('div')
    el.className = 'option-btn truefalse-btn'
    el.textContent = opt
    displayOptions.appendChild(el)
    applyTileReveal(el, idx)
  })
}

// Un seul id à la fois "en vol" : une réponse HTTP intrus en retard (question
// suivante déjà affichée entre-temps) ne doit jamais venir écraser les
// tuiles d'une AUTRE question — voir le guard dans renderIntrus ci-dessous.
let currentIntrusRequestToken = 0

// Voir l'appel dans renderIntrus ci-dessous pour le contexte du bug corrigé.
// cols : mêmes seuils que .options-grid.intrus-grid dans style.css (flex 3
// colonnes à partir de 900px, grille 2 colonnes en dessous — y compris la
// plage 641-899px, qui retombe sur .options-grid de base, elle-même à 2
// colonnes) — pas de lecture DOM fiable équivalente pour un layout flex
// (grid-template-columns n'existe pas en mode flex).
const applyIntrusTileSizing = () => {
  const tiles = Array.from(displayOptions.querySelectorAll('.intrus-tile'))
  if (tiles.length === 0) return
  const cols = window.innerWidth >= 900 ? 3 : 2
  const rows = Math.ceil(tiles.length / cols)
  const gridTop = displayOptions.getBoundingClientRect().top
  // Marge de sécurité en bas : même respiration que le padding bas de
  // .display-root (5vh, voir style.css) plutôt que de coller les tuiles au
  // bord de l'écran.
  const bottomMargin = window.innerHeight * 0.05
  const available = window.innerHeight - gridTop - bottomMargin
  const gapPx = parseFloat(getComputedStyle(displayOptions).rowGap) || 20
  const perRow = (available - (rows - 1) * gapPx) / rows
  // Jamais plus grand que le plafond hérité du CSS de base (320px) — juste
  // plus petit si l'espace réel est plus serré ; jamais plus petit que 60px
  // (repli raisonnable, une tuile minuscule reste au moins reconnaissable).
  const maxH = Math.max(60, Math.min(320, perRow))
  tiles.forEach(el => { el.style.maxHeight = maxH + 'px' })
}
// Redimensionnement de fenêtre PENDANT une question intrus déjà affichée
// (vérifié en QA : 1920x1080 -> 1280x720 -> 768x1024 -> 390x844) : sans ce
// recalcul, une taille figée au premier rendu pouvait redevenir trop grande
// (ou rester inutilement petite) après un resize, jusqu'à la question
// suivante.
window.addEventListener('resize', () => {
  if (displayOptions.classList.contains('intrus-grid')) applyIntrusTileSizing()
})

// Intrus : mêmes tuiles que le QCM, une photo au lieu d'un texte — reprend
// le mécanisme de fetch + mapping par id d'index.js (payload.intrusImagesUrl,
// voir server/index.js /api/room-intrus-images/:code), en plus simple :
// pas d'anneau de sélection ni de cadrage avancé (applyCropTransform côté
// MJ), juste la photo affichée pleine tuile (object-fit:cover) — choix déjà
// validé par l'utilisateur, un écran projeté n'a pas besoin de ce niveau de
// finition.
const renderIntrus = (payload) => {
  const ids = Array.isArray(payload.options) ? payload.options : []
  displayOptions.className = 'options-grid intrus-grid'
  const tileImgById = {}
  ids.forEach((id, idx) => {
    const el = document.createElement('div')
    el.className = 'option-btn intrus-tile'
    const img = document.createElement('img')
    img.alt = ''
    // Style inline volontaire (comme .intrus-tile-img côté MJ, elle aussi en
    // grande partie pilotée en JS) : simple plein-cadre, pas de recadrage
    // fin à appliquer ici, contrairement à applyCropTransform côté MJ.
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
    el.appendChild(img)
    displayOptions.appendChild(el)
    applyTileReveal(el, idx)
    tileImgById[id] = img
  })
  // Bug trouvé en QA (stress test 8 photos, 1920x1080) : le plafond hérité
  // de l'écran MJ pour .intrus-tile (max-height: min(320px, 36vh), voir
  // style.css) suppose implicitement UNE seule rangée — sur cette page,
  // centrée en pleine hauteur avec overflow:hidden (jamais de scrollbar),
  // 3 rangées (7-8 photos) à cette hauteur dépassaient la fenêtre et
  // étaient rognées en bas. Recalculé ici selon l'espace RÉELLEMENT
  // disponible sous le prompt et le nombre de rangées réel, jamais figé à
  // une rangée supposée comme le fait le CSS hérité seul.
  applyIntrusTileSizing()
  if (!payload.intrusImagesUrl) return
  const requestToken = ++currentIntrusRequestToken
  fetch(payload.intrusImagesUrl).then(res => res.json()).then(({ images }) => {
    if (requestToken !== currentIntrusRequestToken) return // une autre question est déjà affichée : on n'écrase pas ses tuiles
    ;(images || []).forEach(item => {
      const img = tileImgById[item.id]
      if (img) img.src = item.image
    })
  }).catch(() => {}) // best-effort : une photo manquante laisse juste une tuile vide, pas bloquant pour un écran projeté
}

// Types "tuiles" avec rendu dédié (design validé par l'utilisateur) — les 13
// autres types (texte libre, graduation, ordre, image-clic, révélation,
// blind test, association, timeline, rangement, petit bac, recherche,
// indice, halo) se contentent du repli générique : prompt + illustration si
// présente, sans reproduire leur mécanique (voir le plan de la tâche 040 —
// choix déjà validé, pas à reconsidérer ici). "zoomguess" fait bande à part
// depuis la tâche 041 : toujours pas de rendu "tuiles" (il n'en a pas côté
// MJ non plus), mais son image N'EST PLUS un simple repli statique — voir
// renderIllustration ci-dessus, dézoom reproduit pour ne pas spoiler la
// réponse dès l'apparition.
const renderQuestion = (payload) => {
  displayWaiting.classList.add('d-none')
  // Filet de sécurité (étape 6) : question:show devrait toujours arriver
  // après tuto:done (qui masque déjà le classement, voir showQuestionIntro
  // plus haut), mais un rattrapage de reconnexion en PLEINE question
  // (sendJoinCatchup côté serveur, sans passer par tuto:show) ne le ferait
  // sinon jamais.
  displayLeaderboard.classList.add('d-none')
  displayContent.classList.remove('d-none')
  displayPrompt.textContent = payload?.prompt || ''
  // Contrairement à l'illustration/aux tuiles ci-dessous (voir
  // applyTileReveal, delay = REVEAL_QUESTION_BEAT_MS + ...) : le prompt
  // apparaît lui tout de suite (delay 0), exactement comme qDiv côté MJ
  // (index.js) — d'où l'assignation directe plutôt qu'un appel à
  // applyTileReveal(displayPrompt, ...), qui aurait ajouté un délai.
  displayPrompt.style.animation = 'none'
  void displayPrompt.offsetWidth
  displayPrompt.style.animation = 'tileRevealIn 0.5s cubic-bezier(.34,1.56,.64,1) both'
  renderIllustration(payload)
  clearOptions()
  if (payload?.type === 'mcq') renderMcq(payload)
  else if (payload?.type === 'truefalse') renderTruefalse(payload)
  else if (payload?.type === 'intrus') renderIntrus(payload)
}

// --- Tuile d'annonce de question + décompte (étape 4) -------------------
// Mécanisme déjà 100% générique côté serveur (tuto:begin/tuto:show/
// tuto:done, voir server/index.js) : l'hôte l'émet pour CHAQUE question,
// avant même question:show (qui n'arrive qu'une fois l'intro terminée,
// voir emitQuestionShow côté index.js) — diffusé à toute la room, viewer
// compris, sans aucun changement serveur pour ce cas normal (seul le
// rattrapage de reconnexion en pleine intro a nécessité un ajout, voir
// room:join). Repose sur les mêmes classes CSS que l'écran MJ
// (.question-intro-*, déjà globales dans style.css, non scopées à
// l'écran MJ) — DOM copié verbatim depuis index.html (voir display.html).
//
// Métadonnées par type (icône/libellé/couleur/astuce) dupliquées ici à
// l'identique depuis index.js QUESTION_TYPE_META — même convention déjà
// suivie dans ce projet pour editor.js/admin-bank.js (pas de module
// partagé, pas de bundler) : à maintenir manuellement en cas d'ajout d'un
// nouveau type de question.
const QUESTION_TYPE_META = {
  free: { icon: '📝', label: 'Texte libre', color: '#39ff88', rgb: '57,255,136', hint: 'Tape ta réponse et valide.' },
  mcq: { icon: '🔘', label: 'Choix multiples', color: '#2f8bff', rgb: '47,139,255', hint: 'Sélectionne la ou les réponses adéquates et valide.' },
  truefalse: { icon: '✅', label: 'Vrai / Faux', color: '#ff3b5c', rgb: '255,59,92', hint: 'Choisis Vrai ou Faux et valide.' },
  graduation: { icon: '↔️', label: 'Curseur numérique', color: '#ffd23f', rgb: '255,210,63', hint: 'Positionne le curseur sur ta réponse et valide.' },
  order: { icon: '↕️', label: 'Ordre / classement', color: '#ff2fb0', rgb: '255,47,176', hint: 'Fais glisser les éléments pour les remettre dans le bon ordre.' },
  image: { icon: '📍', label: 'Image', color: '#2fe3ff', rgb: '47,227,255', hint: 'Touche l\'endroit sur l\'image qui correspond à la réponse.' },
  zoomguess: { icon: '🔍', label: 'ZoomOut Devinette', color: '#5865f2', rgb: '88,101,242', hint: 'Devine ce que montre l\'image avant qu\'elle ne se dézoome complètement.' },
  reveal: { icon: '🖼️', label: 'Révélation', color: '#cfd8ea', rgb: '207,216,234', hint: 'Observe l\'image (incomplète) et devine de quoi il s\'agit — la version complète apparaît à la révélation.' },
  blindtest: { icon: '🎵', label: 'Blind Test', color: '#7b2ff7', rgb: '123,47,247', hint: 'Écoute l\'extrait, puis trouve de quoi il s\'agit.' },
  association: { icon: '🔗', label: 'Association', color: '#ff9f5a', rgb: '255,159,90', hint: 'Relie chaque élément de gauche à son binôme à droite.' },
  timeline: { icon: '⏳', label: 'Timeline', color: '#14e0b8', rgb: '20,224,184', hint: 'Place les événements dans l\'ordre chronologique.' },
  rangement: { icon: '🗂️', label: 'Rangement', color: '#7b2ff7', rgb: '123,47,247', hint: 'Range chaque carte dans la bonne zone.' },
  intrus: { icon: '🎯', label: 'Intrus', color: '#b34bf5', rgb: '179,75,245', hint: 'Repère la photo qui n\'a rien à voir avec les autres.' },
  pbac: { icon: '🎩', label: 'Petit Bac', color: '#c8f542', rgb: '200,245,66', hint: 'Tape ta réponse — elle sera jugée par l\'hôte, comme au vrai Petit Bac !' },
  recherche: { icon: '🔦', label: 'Recherche', color: '#ff6a1a', rgb: '255,106,26', hint: 'Balaie l\'image cachée avec le curseur (ou le doigt) pour la révéler zone par zone, puis valide ta réponse.' },
  indice: { icon: '💡', label: 'Indice', color: '#f2c94c', rgb: '242,201,76', hint: 'Devine la réponse en texte libre à l\'aide des indices qui apparaissent progressivement, puis valide.' },
  halo: { icon: '✨', label: 'Halo', color: '#c4b5fd', rgb: '196,181,253', hint: 'Clique jusqu\'à 5 fois sur l\'image noire pour révéler des halos de lumière permanents (chaque clic coûte un peu plus de points), puis valide ta réponse.' }
}
// Seules ces 2 constantes sont nécessaires ici — INTRO_READ_MS/
// INTRO_READ_COMPLEX_MS/COMPLEX_TYPES/seenQuestionTypesThisGame (index.js)
// ne servent qu'à CALCULER durationMs côté hôte avant l'émission de
// tuto:begin ; la TV ne fait que RECEVOIR durationMs déjà calculé (tuto:show),
// jamais le recalculer elle-même — pas de notion de "type déjà vu" ici,
// chaque question garde sa pleine intro sur cet écran.
const INTRO_COUNTDOWN_MS = 3000
const INTRO_EXIT_MS = 450

const questionIntroOverlay = document.getElementById('questionIntroOverlay')
const questionIntroCard = document.getElementById('questionIntroCard')
const questionIntroIcon = document.getElementById('questionIntroIcon')
const questionIntroTitle = document.getElementById('questionIntroTitle')
const questionIntroHint = document.getElementById('questionIntroHint')
const questionIntroCountdown = document.getElementById('questionIntroCountdown')
let questionIntroTimerId = null
let questionIntroExitTimerId = null

const hideQuestionIntro = () => {
  if (questionIntroTimerId) { clearInterval(questionIntroTimerId); questionIntroTimerId = null }
  if (questionIntroExitTimerId) { clearTimeout(questionIntroExitTimerId); questionIntroExitTimerId = null }
  questionIntroOverlay.classList.add('d-none')
  questionIntroCard.classList.remove('intro-anim-in', 'intro-anim-out')
}

const showQuestionIntro = (type, durationMs, startTs) => {
  const meta = QUESTION_TYPE_META[type]
  if (!meta) return
  // Transition depuis l'écran d'attente (voir enterGameScreen côté MJ,
  // même besoin) : la tuile d'annonce arrive AVANT question:show
  // (emitQuestionShow n'émet question:show qu'une fois l'intro terminée),
  // donc c'est elle qui doit faire sortir l'écran du salon d'attente sur
  // cette page, pas question:show comme avant l'étape 4. Même raison pour
  // le classement (étape 6, voir plus bas) : affiché "entre les
  // questions", il doit disparaître dès que la question SUIVANTE commence
  // à s'annoncer — sinon il resterait visible par-dessus l'intro.
  displayWaiting.classList.add('d-none')
  displayLeaderboard.classList.add('d-none')
  questionIntroOverlay.style.setProperty('--qt-color', meta.color)
  questionIntroOverlay.style.setProperty('--qt-color-rgb', meta.rgb)
  questionIntroIcon.textContent = meta.icon
  questionIntroTitle.textContent = meta.label
  questionIntroHint.textContent = meta.hint || ''
  questionIntroOverlay.classList.remove('d-none')
  questionIntroCard.classList.remove('intro-anim-out')
  questionIntroCard.classList.add('intro-anim-in')
  if (questionIntroTimerId) clearInterval(questionIntroTimerId)
  if (questionIntroExitTimerId) clearTimeout(questionIntroExitTimerId)
  // Décompte dérivé de startTs/durationMs (horodatage serveur), pas d'un
  // simple setTimeout local : reste juste même pour un client qui vient de
  // (re)rejoindre en pleine phase intro (voir room:join côté serveur). Le
  // chiffre ne s'affiche que durant les INTRO_COUNTDOWN_MS dernières
  // millisecondes, comme côté MJ. Pas de syncedNow() ici (voir la même
  // décision pour le dézoom zoomguess, étape 1) : décalage d'horloge locale
  // sans conséquence réelle sur une page en lecture seule.
  const tick = () => {
    const remaining = (startTs + durationMs) - Date.now()
    questionIntroCountdown.textContent = (remaining > 0 && remaining <= INTRO_COUNTDOWN_MS)
      ? String(Math.ceil(remaining / 1000))
      : ''
  }
  tick()
  questionIntroTimerId = setInterval(tick, 200)
  const exitDelay = Math.max(0, (startTs + durationMs) - Date.now() - INTRO_EXIT_MS)
  questionIntroExitTimerId = setTimeout(() => {
    questionIntroCard.classList.remove('intro-anim-in')
    questionIntroCard.classList.add('intro-anim-out')
  }, exitDelay)
}

socket.on('tuto:show', ({ type, durationMs, startTs }) => showQuestionIntro(type, durationMs, startTs))
socket.on('tuto:done', hideQuestionIntro)

socket.on('question:show', renderQuestion)

// timer:end/question:reveal : rien à afficher de plus ici (pas de barre de
// temps, pas d'indication bonne/mauvaise réponse — voir le plan de la tâche
// 040) — juste s'assurer de ne rien casser à leur réception. Enregistrés
// explicitement (plutôt que simplement absents) pour documenter que c'est
// un choix volontaire, pas un oubli.
socket.on('timer:end', () => {})
socket.on('question:reveal', () => {})

// --- Classement entre les questions (tâche 041, étape 6) -----------------
// Revient sur l'exclusion initiale de la tâche 040 ("jamais de classement"),
// suite à un retour utilisateur après un premier test réel. Mécanisme
// serveur déjà générique (leaderboard:show ne porte aucune donnée, juste un
// top de rideau — voir server/index.js) : les scores viennent d'ailleurs,
// exactement comme côté MJ (index.js, la Map `scores` + lobby:list +
// score:update), PAS du mécanisme plus simple de results.js (qui ignore
// volontairement score:update, un classement FINAL seul n'a pas besoin de
// fraîcheur en direct — celui-ci, lui, doit refléter le score À CET INSTANT).
const scores = new Map() // id -> { name, total }
const LEADERBOARD_MAX_ROWS = 15 // miroir d'index.js (même nom, même valeur) — évite un débordement d'écran pour une très grande salle

socket.on('lobby:list', (list) => {
  const currentIds = new Set((list || []).map(p => p.id))
  // Synchronise avec la liste faisant autorité (même raison qu'index.js) :
  // un joueur reconnecté change de socket.id, sans ce nettoyage son ancienne
  // entrée resterait affichée en double à côté de la nouvelle.
  scores.forEach((_, id) => { if (!currentIds.has(id)) scores.delete(id) })
  ;(list || []).forEach(p => {
    // Hôte toujours exclu ici (contrairement à index.js, qui l'inclut en
    // mode "Jouer") : cette page n'a de sens qu'en mode "Présenter" (voir
    // Hors périmètre des tâches 040/041), où l'hôte n'est jamais un joueur.
    if (p.isHost) return
    const s = scores.get(p.id) || { name: p.name, total: 0 }
    if (p.name) s.name = p.name
    if (typeof p.score === 'number') s.total = p.score
    scores.set(p.id, s)
  })
})

socket.on('score:update', ({ playerId, total }) => {
  // `total` est déjà le score ABSOLU faisant autorité côté serveur (voir
  // server/index.js) — jamais un delta à cumuler soi-même, même mécanisme
  // qu'index.js.
  const s = scores.get(playerId) || { name: playerId, total: 0 }
  s.total = total
  scores.set(playerId, s)
})

const renderLeaderboardList = () => {
  const ordered = Array.from(scores.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, LEADERBOARD_MAX_ROWS)
  displayLeaderboardList.innerHTML = ''
  ordered.forEach(([, s], idx) => {
    const row = document.createElement('div')
    row.className = 'display-leaderboard-row'
    row.innerHTML = `<span class="display-leaderboard-rank">${idx + 1}</span><span class="display-leaderboard-name"></span><span class="display-leaderboard-score">${s.total} pts</span>`
    // textContent (pas innerHTML) pour le nom : un pseudo joueur n'est
    // jamais du HTML de confiance (voir le même réflexe ailleurs dans ce
    // fichier, ex. displayPrompt.textContent).
    row.querySelector('.display-leaderboard-name').textContent = s.name
    displayLeaderboardList.appendChild(row)
    // PAS applyTileReveal (étape 3) ici : son temps de lecture fixe de
    // REVEAL_QUESTION_BEAT_MS (900ms) avant la première tuile a du sens
    // pour laisser lire le prompt d'une question avant les réponses — pour
    // un classement que l'hôte vient de déclencher explicitement, ce même
    // délai fixe se voyait (bug trouvé en vérifiant visuellement, capture
    // prise à 500ms : rien n'était encore apparu) comme un temps mort
    // avant que quoi que ce soit ne s'affiche. Cascade plus rapide et
    // qui démarre tout de suite, propre à cette liste.
    row.style.animation = 'none'
    void row.offsetWidth
    row.style.animation = `tileRevealIn 0.4s cubic-bezier(.34,1.56,.64,1) ${idx * 90}ms both`
  })
}

socket.on('leaderboard:show', () => {
  displayContent.classList.add('d-none')
  displayLeaderboard.classList.remove('d-none')
  renderLeaderboardList()
})

// --- Podium de fin de partie (tâche 041, étape 7) -------------------------
// Le serveur diffuse déjà quiz:end à toute la room (voir index.js, même
// évènement pour l'hôte et les joueurs) — repris ici tel quel plutôt que de
// dupliquer le rendu du podium ("course arcade néon", déjà entièrement
// construit dans results.js/result.html) : réutilisation complète, zéro
// code de rendu à maintenir en double. Trade-off assumé (voir le plan de
// cette tâche) : l'API Fullscreen ne survit JAMAIS une navigation de page,
// même dans le même onglet — la TV ressort donc du plein écran au moment du
// podium (result.html n'a lui-même aucun bouton plein écran aujourd'hui).
// Pas de meilleure option simple dans ce périmètre : dupliquer le podium
// dans display.js serait un chantier à part entière, hors de cette tâche.
socket.on('quiz:end', () => {
  window.location.href = `/result.html?room=${encodeURIComponent(roomCode)}`
})

// --- Plein écran (étape 6) ---------------------------------------------
// Bouton dédié, jamais de plein écran automatique au chargement (exige un
// geste utilisateur, l'API Fullscreen le refuserait de toute façon).
const fullscreenBtn = document.getElementById('displayFullscreenBtn')
const updateFullscreenLabel = () => {
  fullscreenBtn.textContent = document.fullscreenElement ? '🗗 Quitter le plein écran' : '⛶ Plein écran'
}
fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) {
    // Rejeté seulement si aucun élément n'est en plein écran (ne peut pas
    // arriver ici, le bouton n'est cliqué que dans ce cas) ou si le
    // document a perdu le focus entre-temps (changement d'onglet) — sans
    // conséquence, l'utilisateur retentera simplement le clic.
    document.exitFullscreen().catch(() => {})
  } else {
    // Rejeté si le navigateur refuse (permission, iframe sans allow=
    // fullscreen — non applicable ici, page top-level) : pas de repli
    // nécessaire, l'écran reste simplement en fenêtre normale.
    document.documentElement.requestFullscreen().catch(() => {})
  }
})
document.addEventListener('fullscreenchange', updateFullscreenLabel)
