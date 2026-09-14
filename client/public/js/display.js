// Vue Joueur dédiée TV/vidéoprojecteur (tâche 040) — page séparée de
// index.html/index.js (l'interface MJ elle-même), sur le patron déjà en
// place pour result.html/results.js : connexion Socket.io en lecture seule
// (viewer:true, voir server/index.js room:join), affichage EN COURS de la
// question active plutôt qu'un résumé final. Aucune duplication de la
// logique métier serveur — on ne fait qu'afficher les payloads déjà
// "sans spoiler" (voir server/index.js payloadWithoutCorrectOrExplanation).
// Rendu volontairement minimal (design validé par l'utilisateur) : prompt +
// tuiles + image, jamais de barre de temps, de classement, ni d'indication
// de bonne/mauvaise réponse — un écran projeté, personne n'y répond.
const roomCode = new URLSearchParams(location.search).get('room') || ''
const socket = io()

const displayWaiting = document.getElementById('displayWaiting')
const displayContent = document.getElementById('displayContent')
const displayIllustration = document.getElementById('displayIllustration')
const displayPrompt = document.getElementById('displayPrompt')
const displayOptions = document.getElementById('displayOptions')

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

const renderIllustration = (payload) => {
  const url = illustrationUrlOf(payload)
  // Bug trouvé en QA (stress test : illustrationUrl invalide/404) : sans
  // onerror, une image cassée peut laisser une icône "image manquante" du
  // navigateur en plein écran projeté — repli déjà en place côté MJ pour ce
  // même risque (voir index.js, plusieurs `.onerror = () => classList.add
  // ('d-none')`, ex. illustrationImg/rechercheImg/haloImg), repris ici tel
  // quel. Réassigné à chaque appel (comme côté MJ) : une réponse en retard
  // pour une ANCIENNE image ne peut pas s'appliquer après coup, le
  // navigateur abandonne une requête d'image dont le `src` a déjà changé.
  displayIllustration.onerror = () => { displayIllustration.classList.add('d-none') }
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
  options.forEach(opt => {
    const el = document.createElement('div')
    el.className = 'option-btn'
    el.textContent = opt
    displayOptions.appendChild(el)
  })
}

// Vrai/Faux : mêmes 2 grandes tuiles losange/triangle que l'écran MJ (voir
// .options-grid.truefalse-grid dans style.css).
const renderTruefalse = (payload) => {
  const choices = Array.isArray(payload.options) && payload.options.length === 2 ? payload.options : ['Vrai', 'Faux']
  displayOptions.className = 'options-grid truefalse-grid'
  choices.forEach(opt => {
    const el = document.createElement('div')
    el.className = 'option-btn truefalse-btn'
    el.textContent = opt
    displayOptions.appendChild(el)
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
  ids.forEach(id => {
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

// Types "tuiles" avec rendu dédié (design validé par l'utilisateur) — les 12
// autres types (texte libre, graduation, ordre, image-clic, zoomguess,
// révélation, blind test, association, timeline, rangement, petit bac,
// recherche, indice, halo) se contentent du repli générique : prompt +
// illustration si présente, sans reproduire leur mécanique (voir le plan de
// la tâche 040 — choix déjà validé, pas à reconsidérer ici).
const renderQuestion = (payload) => {
  displayWaiting.classList.add('d-none')
  displayContent.classList.remove('d-none')
  displayPrompt.textContent = payload?.prompt || ''
  renderIllustration(payload)
  clearOptions()
  if (payload?.type === 'mcq') renderMcq(payload)
  else if (payload?.type === 'truefalse') renderTruefalse(payload)
  else if (payload?.type === 'intrus') renderIntrus(payload)
}

socket.on('question:show', renderQuestion)

// timer:end/question:reveal : rien à afficher de plus ici (pas de barre de
// temps, pas d'indication bonne/mauvaise réponse — voir le plan de la tâche
// 040) — juste s'assurer de ne rien casser à leur réception. Enregistrés
// explicitement (plutôt que simplement absents) pour documenter que c'est
// un choix volontaire, pas un oubli.
socket.on('timer:end', () => {})
socket.on('question:reveal', () => {})

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
