const socket = io()

// Bandeau persistant de statut de connexion (ma propre connexion perdue, ou
// celle de l'hôte) — contrairement à showAnnounce (toast qui s'auto-masque),
// reste affiché tant que la situation n'est pas résolue. Un seul élément
// réutilisé pour les deux cas, le dernier appel gagnant si les deux se
// chevauchent (ex. moi-même déconnecté au moment où l'hôte l'est aussi).
const connBanner = document.createElement('div')
connBanner.className = 'conn-status-banner d-none'
document.body.appendChild(connBanner)
const setConnBanner = (msg, severe = false) => {
  connBanner.textContent = msg
  connBanner.classList.toggle('is-severe', severe)
  connBanner.classList.remove('d-none')
}
const clearConnBanner = () => connBanner.classList.add('d-none')

// Avertissement avant de quitter/rafraîchir EN PLEINE QUESTION (pas pendant
// le salon d'attente, où quitter ne coûte rien) : sans ça, un retour arrière
// ou un rafraîchissement accidentel déclenche tout le mécanisme de
// reconnexion pour rien — mieux vaut l'éviter en amont. Passé à false juste
// avant toute navigation VOULUE (fin de quiz, salle fermée, exclusion) pour
// ne jamais bloquer un départ légitime.
let inActiveGame = false
window.addEventListener('beforeunload', (e) => {
  if (!inActiveGame) return
  e.preventDefault()
  e.returnValue = ''
})

// Vibration mobile (retour haptique) sur bonne/mauvaise réponse — complète
// les sons/couleurs, utile quand le son est coupé/silencieux (cas fréquent :
// hôte en mode IRL, salle de classe, téléphone en silencieux qui n'empêche
// pas forcément l'audio web de jouer). Ignoré en silence sur les navigateurs
// qui ne supportent pas l'API (pas de vibreur, ex. la plupart des ordinateurs).
const VIBRATE_CORRECT = [40]
const VIBRATE_INCORRECT = [40, 60, 40]
const vibrate = (pattern) => {
  try { navigator.vibrate?.(pattern) } catch {}
}

// Sons du jeu : tic-tac du timer, bonne/mauvaise réponse. Un seul objet Audio
// réutilisé par son (avec currentTime=0) pour permettre des déclenchements
// rapprochés (ex. tic-tac chaque seconde) sans empiler les instances.
const sounds = {
  tick: new Audio('/audio/tick.wav'),
  correct: new Audio('/audio/correct.wav'),
  wrong: new Audio('/audio/wrong.wav')
}
sounds.tick.volume = 0.35
const playSound = (name) => {
  const el = sounds[name]
  if (!el) return
  try { el.currentTime = 0; el.play().catch(() => {}) } catch {}
}

// Fisher-Yates — utilisé pour mélanger l'ordre initial affiché aux joueurs
// pour les questions de type "order" (l'ordre correct ne doit jamais être
// l'arrangement de départ trivial saisi dans l'éditeur).
const shuffleArray = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// État d'authentification partagé (mis à jour par checkAuth)
let isAuthReady = false
let canCreate = false

// Vérification de l'authentification
const checkAuth = async () => {
  const isGuest = localStorage.getItem('queazy_guest') === 'true'
  const { data: { session } } = await window.supabaseClient.auth.getSession()

  const navLogin = document.getElementById('navLogin')
  const navCreateEl = document.getElementById('navCreate')
  const profileLink = document.getElementById('profile')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileName = document.getElementById('profileName')

  canCreate = !!session
  if (navCreateEl) {
    navCreateEl.classList.toggle('is-disabled', !canCreate)
    navCreateEl.title = canCreate ? '' : 'Connecte-toi pour créer'
  }

  const firstNameOf = (name) => (name || '').trim().split(/\s+/)[0] || 'Profil'
  const computeInitials = (name) => {
    if (!name) return '??'
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }
  const applyAvatar = (el, name, avatarUrl) => {
    if (!el) return
    el.style.display = 'flex'
    el.style.alignItems = 'center'
    el.style.justifyContent = 'center'
    el.style.fontWeight = 'bold'
    el.style.borderRadius = '50%'
    el.style.textDecoration = 'none'
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
      el.textContent = ''
      el.style.backgroundImage = `url(${avatarUrl})`
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center'
      el.style.backgroundColor = 'transparent'
      el.style.color = 'white'
    } else {
      el.style.backgroundImage = ''
      el.textContent = computeInitials(name || '')
      el.style.background = 'var(--color-accent)'
      el.style.color = 'white'
    }
  }

  if (!session && !isGuest) {
    // Si déconnecté : afficher le bouton "Connexion" et masquer le profil
    if (navLogin) navLogin.classList.remove('d-none')
    if (profileLink) profileLink.classList.add('d-none')
    isAuthReady = true
    return
  }

  // Si connecté ou invité : afficher le profil et masquer le bouton "Connexion"
  if (navLogin) navLogin.classList.add('d-none')
  if (profileLink) profileLink.classList.remove('d-none')

  // Si connecté, on peut récupérer le profil
  if (session) {
    const user = session.user
    let avatarUrl = null
    let displayName = user.user_metadata.full_name || user.email.split('@')[0]
    try {
      const { data: p } = await window.supabaseClient.from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single()
      if (p?.username) displayName = p.username
      if (p?.avatar_url) avatarUrl = p.avatar_url
    } catch {}
    if (!avatarUrl) {
      const savedAvatar = localStorage.getItem('queazy_profile_avatar')
      if (savedAvatar) avatarUrl = savedAvatar
    }
    applyAvatar(profileAvatar, displayName, avatarUrl)
    if (profileName) profileName.textContent = firstNameOf(displayName)
  } else if (isGuest) {
    // Si invité
    const name = localStorage.getItem('queazy_profile_name') || 'Invité'
    const avatarUrl = localStorage.getItem('queazy_profile_avatar') || ''
    applyAvatar(profileAvatar, name, avatarUrl)
    if (profileName) profileName.textContent = firstNameOf(name)
  }
  isAuthReady = true
}

const roomInput = document.getElementById('room')
const nameInput = document.getElementById('name')
const joinCard = document.getElementById('joinCard')
const joinBtn = document.getElementById('join')
const createBtn = document.getElementById('createRoom')
const createRoomDivider = document.getElementById('createRoomDivider')
const hostPanel = document.getElementById('hostPanel')
const guestJoinOptions = document.getElementById('guestJoinOptions')
const guestNameInput = document.getElementById('guestNameInput')
const confirmGuestJoin = document.getElementById('confirmGuestJoin')
const cancelGuestJoin = document.getElementById('cancelGuestJoin')
const params = new URLSearchParams(location.search)
const preRoom = params.get('room')
const autoCreate = params.get('create')
const autoJoin = params.get('join')

if (preRoom) {
  roomInput.value = preRoom.toUpperCase()
}

roomInput.addEventListener('input', () => {
  const pos = roomInput.selectionStart
  roomInput.value = roomInput.value.toUpperCase()
  roomInput.setSelectionRange(pos, pos)
})

window.addEventListener('DOMContentLoaded', () => {
  // Logo animation trigger
  const brand = document.querySelector('.brand')
  if (brand) {
    brand.addEventListener('mouseenter', () => {
      brand.classList.remove('animate-logo')
      void brand.offsetWidth // Trigger reflow
      brand.classList.add('animate-logo')
    })
  }
})

;(async () => {
  await checkAuth()

  if (autoCreate === 'true') {
    if (!canCreate) {
      window.location.href = '/login.html?reason=create'
      return
    }
    resetUI()
    createRoom()
  } else if (autoJoin === 'true') {
    resetUI()
    showJoinPanel(false)
  }
})()
const qDiv = document.getElementById('question')
const timerBarFill = document.getElementById('timerBar')
const timerLabel = document.getElementById('timerLabel')
const inputArea = document.getElementById('inputArea')
const answerInput = document.getElementById('answer')
const sendBtn = document.getElementById('send')
const optionsDiv = document.getElementById('options')
const graduationArea = document.getElementById('graduationArea')
const gradSlider = document.getElementById('gradSlider')
const gradSliderFill = document.getElementById('gradSliderFill')
const gradSliderThumb = document.getElementById('gradSliderThumb')
const gradValueReadout = document.getElementById('gradValueReadout')
const gradMinLabel = document.getElementById('gradMinLabel')
const gradMaxLabel = document.getElementById('gradMaxLabel')
const revealAnswerText = document.getElementById('revealAnswerText')
const myResultBanner = document.getElementById('myResultBanner')
const revealExplanationText = document.getElementById('revealExplanationText')
const orderArea = document.getElementById('orderArea')
const orderList = document.getElementById('orderList')
const orderCompare = document.getElementById('orderCompare')
const orderCompareMine = document.getElementById('orderCompareMine')
const orderCompareCorrect = document.getElementById('orderCompareCorrect')
const imageArea = document.getElementById('imageArea')
const imageViewport = document.getElementById('imageViewport')
const imageWrap = document.getElementById('imageWrap')
const imageImg = document.getElementById('imageImg')
const imageClickLayer = document.getElementById('imageClickLayer')
const imageMarker = document.getElementById('imageMarker')
const imageZonesRevealPath = document.getElementById('imageZonesRevealPath')
const imageErrorMsg = document.getElementById('imageErrorMsg')
const imageZoomControls = document.getElementById('imageZoomControls')
const imageZoomInBtn = document.getElementById('imageZoomInBtn')
const imageZoomOutBtn = document.getElementById('imageZoomOutBtn')
const imageZoomResetBtn = document.getElementById('imageZoomResetBtn')
const imageZoomLabel = document.getElementById('imageZoomLabel')
const blindtestArea = document.getElementById('blindtestArea')
const blindtestAudio = document.getElementById('blindtestAudio')
const blindtestOrb = document.getElementById('blindtestOrb')
const blindtestUnlockBtn = document.getElementById('blindtestUnlockBtn')
const blindtestFields = document.getElementById('blindtestFields')
const blindtestTitleInput = document.getElementById('blindtestTitleInput')
const blindtestArtistInput = document.getElementById('blindtestArtistInput')
const audioModeRemoteInput = document.getElementById('audioModeRemote')
const audioVolumeTrack = document.getElementById('audioVolumeTrack')
const audioVolumeFill = document.getElementById('audioVolumeFill')
const audioVolumeThumb = document.getElementById('audioVolumeThumb')
const audioVolumeLabel = document.getElementById('audioVolumeLabel')
const blindtestVolumeTrack = document.getElementById('blindtestVolumeTrack')
const blindtestVolumeFill = document.getElementById('blindtestVolumeFill')
const blindtestVolumeThumb = document.getElementById('blindtestVolumeThumb')
// Illustration optionnelle (tous les types SAUF "image", qui affiche déjà sa
// propre image cliquable via imageWrap/imageImg ci-dessus) : simple photo
// décorative au-dessus de l'énoncé.
const illustrationImg = document.getElementById('illustrationImg')
const logDiv = document.getElementById('log')
const nextQuestionBtn = document.getElementById('nextQuestion')
const leaderNextBtn = document.getElementById('leaderNextBtn')
const startQuizBtn = document.getElementById('startQuiz')
// Récap rapide de la question (hôte uniquement), voir socket.on('question:recap')
const questionRecapCard = document.getElementById('questionRecapCard')
const recapBarFill = document.getElementById('recapBarFill')
const recapPctText = document.getElementById('recapPctText')
const recapTopAnswerRow = document.getElementById('recapTopAnswerRow')
const recapTopAnswerText = document.getElementById('recapTopAnswerText')
const recapTopAnswerCount = document.getElementById('recapTopAnswerCount')
// Mode équipe (hôte uniquement), voir socket.on('team:list') plus bas.
const teamModePanel = document.getElementById('teamModePanel')
const teamModeToggle = document.getElementById('teamModeToggle')
const teamModeControls = document.getElementById('teamModeControls')
const teamCountInput = document.getElementById('teamCountInput')
const teamAutoAssignBtn = document.getElementById('teamAutoAssignBtn')
const loadedInfo = document.getElementById('loadedInfo')
const qrDiv = document.getElementById('qr')
const AVATAR_CHOICES = [
  '/avatars/avatar1.png',
  '/avatars/avatar2.png',
  '/avatars/avatar3.png',
  '/avatars/avatar4.png',
  '/avatars/avatar5.png',
  '/avatars/avatar6.png',
  '/avatars/avatar7.png',
  '/avatars/avatar8.png'
]

let loadedQuiz = null
let quizIndex = 0
let isHost = false
let currentSingleAttempt = true
let selectedIcon = AVATAR_CHOICES[0]
let timerInt = null
let selectedMcqOptions = []
let currentQuestionType = 'free'
let isGameEnded = false

// --- Révélation « écran principal » : la question apparaît en grand, puis
// les réponses une à une avec une animation, avant que le chrono ne démarre
// vraiment pour les joueurs. L'hôte voit exactement la même chose (tuiles en
// lecture seule) — c'est son écran à partager avec la salle. Les constantes
// de timing sont dupliquées côté serveur (server/index.js) pour que le délai
// avant déverrouillage corresponde pile à la durée de l'animation ici.
const REVEAL_QUESTION_BEAT_MS = 900
const REVEAL_STAGGER_MS = 350
let revealToken = 0
const applyTileReveal = (el, index) => {
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = `tileRevealIn 0.5s cubic-bezier(.34,1.56,.64,1) ${REVEAL_QUESTION_BEAT_MS + index * REVEAL_STAGGER_MS}ms both`
  // Le "both" maintient l'état final (transform: translateY(0) scale(1)) une
  // fois l'animation terminée — ce qui, tant que l'animation reste attachée à
  // l'élément, continue de l'emporter sur tout style "transform" posé
  // ensuite en JS (ex. le glisser de la question "ordre"), même bien après
  // la fin visuelle de l'entrée. On la détache donc une fois jouée.
  el.addEventListener('animationend', function onEnd () {
    el.removeEventListener('animationend', onEnd)
    el.style.animation = ''
  }, { once: true })
}

// --- Curseur classique sur piste : les bornes min/max sont les deux bouts
// physiques de la piste (toujours visibles), donc jamais ambiguës — remplace
// l'ancienne règle à viseur fixe/graduation défilante. ---
const gradState = { min: 0, max: 100, value: 50, disabled: false }
// Doit rester cohérent avec GRAD_CORRECT_ABS_TOLERANCE dans server/index.js —
// sert uniquement à choisir le message de reveal ("Bonne réponse" vs
// "Presque !"), le scoring lui-même reste le calcul de proximité continu
// côté serveur. Écart ABSOLU (pas un pourcentage de l'intervalle) : 0 = seule
// la valeur exacte compte comme "Bonne réponse !".
const GRAD_CORRECT_ABS_TOLERANCE = 0

const setGradValue = (v, animate) => {
  const clamped = Math.min(gradState.max, Math.max(gradState.min, Math.round(v)))
  gradState.value = clamped
  const pct = gradState.max === gradState.min ? 0 : (clamped - gradState.min) / (gradState.max - gradState.min) * 100
  if (gradValueReadout) gradValueReadout.textContent = clamped
  if (gradSlider) gradSlider.setAttribute('aria-valuenow', clamped)
  // Pas de transition CSS permanente sur left/width : ça retarderait le pouce
  // derrière le doigt pendant le glisser. On l'active seulement au besoin
  // (arrivée initiale, révélation), au coup par coup.
  if (gradSliderFill) {
    gradSliderFill.style.transition = animate ? 'width 0.3s cubic-bezier(.22,1,.36,1), background 0.2s ease' : 'background 0.2s ease'
    gradSliderFill.style.width = `${pct}%`
  }
  if (gradSliderThumb) {
    gradSliderThumb.style.transition = animate ? 'left 0.3s cubic-bezier(.22,1,.36,1), box-shadow 0.15s ease' : 'box-shadow 0.15s ease'
    gradSliderThumb.style.left = `${pct}%`
  }
}

const buildGradSlider = (min, max, value) => {
  if (!gradSlider) return
  gradState.min = min
  gradState.max = max
  gradState.disabled = true
  gradSlider.classList.remove('reveal')
  gradSlider.setAttribute('aria-valuemin', min)
  gradSlider.setAttribute('aria-valuemax', max)
  setGradValue(value)
  if (gradMinLabel) gradMinLabel.textContent = min
  if (gradMaxLabel) gradMaxLabel.textContent = max
  applyTileReveal(gradSlider, 0)
}

if (gradSlider) {
  let dragging = false
  // Mesuré sur .grad-slider-track (pas .grad-slider lui-même) : c'est CE
  // conteneur, pas le padding autour, qui sert de repère à gradSliderThumb
  // (style.left en %, voir setGradValue) — mesurer sur le mauvais élément
  // décalait le pouce, qui n'atteignait jamais vraiment les deux bouts.
  const gradTrackEl = gradSlider.querySelector('.grad-slider-track') || gradSlider
  const setFromClientX = (clientX) => {
    const r = gradTrackEl.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setGradValue(gradState.min + pct * (gradState.max - gradState.min))
  }
  gradSlider.addEventListener('pointerdown', e => {
    if (gradState.disabled) return
    dragging = true
    try { gradSlider.setPointerCapture(e.pointerId) } catch {}
    gradSlider.classList.add('grabbing')
    setFromClientX(e.clientX)
  })
  gradSlider.addEventListener('pointermove', e => {
    if (!dragging) return
    setFromClientX(e.clientX)
  })
  const endDrag = (e) => {
    if (!dragging) return
    dragging = false
    try { gradSlider.releasePointerCapture(e.pointerId) } catch {}
    gradSlider.classList.remove('grabbing')
  }
  gradSlider.addEventListener('pointerup', endDrag)
  gradSlider.addEventListener('pointercancel', endDrag)

  // Navigation clavier (accessibilité) : le curseur "maison" ne marchait
  // jusque-là qu'au pointeur (souris/doigt). tabindex="0" + role="slider"
  // posés dans index.html, le reste (± au clavier) se pilote ici.
  gradSlider.addEventListener('keydown', e => {
    if (gradState.disabled) return
    const range = gradState.max - gradState.min
    const smallStep = Math.max(1, Math.round(range / 100)) // ~1% du range
    const bigStep = Math.max(smallStep, Math.round(range / 10)) // ~10%
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setGradValue(gradState.value + smallStep, true)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setGradValue(gradState.value - smallStep, true)
    else if (e.key === 'PageUp') setGradValue(gradState.value + bigStep, true)
    else if (e.key === 'PageDown') setGradValue(gradState.value - bigStep, true)
    else if (e.key === 'Home') setGradValue(gradState.min, true)
    else if (e.key === 'End') setGradValue(gradState.max, true)
    else handled = false
    if (handled) e.preventDefault()
  })
}

// --- Liste réordonnable (question "order") ---
// Glisser au pointeur fait maison (remplace SortableJS, testé sur prototype
// et validé) : pendant le geste, SEULE la tuile saisie bouge réellement
// (transform, pilotée par le pointeur) ; les autres se poussent en pur
// visuel à partir de positions figées au tout début du geste, jamais
// recalculées en cours de route. Le DOM lui-même n'est réordonné qu'UNE
// SEULE FOIS, au relâchement — une première version qui retouchait le DOM à
// chaque frame provoquait des échanges en cascade sur des positions déjà
// périmées (tuiles qui "bougeaient" avec leur voisine, plantages).
let orderDisabled = false
const orderState = { itemEls: [] }
const setOrderDisabled = (v) => { orderDisabled = v }

const getCurrentOrderTexts = () => Array.from(orderList.children).map(el => el.dataset.text)

// Écart réel entre deux tuiles à l'écran = leur hauteur + le gap CSS de
// .order-list (10px) — sert à calculer de combien pousser les tuiles
// traversées pendant le glisser.
const ORDER_LIST_GAP = 10

const wireOrderDrag = (el) => {
  let dragActive = false // évite qu'un pointerdown ne démarre un 2e glisser
  // par-dessus un premier dont le pointerup/pointercancel n'aurait pas été
  // reçu (perte du geste par le navigateur) — sans ça, les écouteurs
  // pointermove/pointerup s'empilent indéfiniment sur la même tuile et
  // finissent par se marcher dessus.
  // Toute la tuile est saisissable (pas seulement la poignée ⠿, qui reste
  // affichée comme simple indice visuel).
  el.addEventListener('pointerdown', (e) => {
    if (orderDisabled || dragActive) return
    if (currentSingleAttempt && sendBtn.disabled) return
    e.preventDefault()
    dragActive = true
    const startY = e.clientY
    el.classList.add('dragging')
    el.style.zIndex = '10'
    try { el.setPointerCapture(e.pointerId) } catch {}

    // Positions des AUTRES tuiles figées ici, une fois pour toutes : jamais
    // recalculées pendant le glisser (voir le commentaire plus haut).
    const others = Array.from(orderList.children).filter(c => c !== el)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(orderList.children).indexOf(el)
    const itemHeight = el.getBoundingClientRect().height + ORDER_LIST_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      el.style.transform = `translateY(${dy}px) scale(1.03)`

      const rect = el.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      let newSlot = 0
      baseRects.forEach(r => { if (center > r.top + r.height / 2) newSlot++ })
      if (newSlot === currentSlot) return
      currentSlot = newSlot

      // Pousse (en pur visuel) chaque tuile comprise entre son ancienne
      // place et la nouvelle place de la tuile saisie — recalculé à neuf à
      // partir de baseRects à chaque fois, jamais en cumulant les déplacements
      // précédents (ce qui évite toute dérive/cascade).
      others.forEach((c, i) => {
        let shift = 0
        if (newSlot > startSlot && i >= startSlot && i < newSlot) shift = -itemHeight
        else if (newSlot < startSlot && i >= newSlot && i < startSlot) shift = itemHeight
        c.style.transition = 'transform 0.18s ease'
        c.style.transform = shift ? `translateY(${shift}px)` : ''
      })
    }

    const cleanup = (applyReorder) => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      if (applyReorder && currentSlot !== startSlot) {
        orderList.insertBefore(el, others[currentSlot] || null)
      }
      others.forEach(c => { c.style.transition = ''; c.style.transform = '' })
      el.classList.remove('dragging')
      el.style.zIndex = ''
      el.style.transition = 'transform 0.2s ease'
      el.style.transform = ''
      setTimeout(() => { el.style.transition = '' }, 200)
      dragActive = false
    }

    const onUp = (ev) => {
      try { el.releasePointerCapture(ev.pointerId) } catch {}
      // Ordre final appliqué UNE SEULE FOIS ici, puis tous les transforms
      // manuels sont effacés.
      cleanup(true)
    }
    // Le navigateur peut annuler le geste (perte du pointeur, geste système
    // qui prend le dessus...) sans jamais envoyer pointerup — sans ce
    // nettoyage, les écouteurs restent accrochés indéfiniment sur la tuile.
    const onCancel = () => cleanup(false)

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
  })
}

const buildOrderList = (items) => {
  if (!orderList) return
  orderList.innerHTML = ''
  orderState.itemEls = []
  orderDisabled = true

  items.forEach((text, uid) => {
    const el = document.createElement('div')
    el.className = 'order-item'
    el.dataset.text = text
    el.innerHTML = `<span class="order-item-handle">⠿</span><span class="order-item-text"></span>`
    el.querySelector('.order-item-text').textContent = text
    orderList.appendChild(el)
    orderState.itemEls.push(el)
    wireOrderDrag(el)
    applyTileReveal(el, uid)
  })
  // Question fraîche : on repart sur la liste glissable, la comparaison
  // (peuplée seulement à la révélation, voir revealOrderList) redevient
  // cachée si elle traînait encore de la question précédente.
  if (orderCompare) orderCompare.classList.add('d-none')
  orderList.classList.remove('d-none')
}

// Révélation : au lieu de réordonner la liste sous les yeux du joueur (ce
// qui effaçait sa mémoire de "où j'avais mis quoi" pendant l'animation —
// illisible, cf. retours utilisateur), on fige "Ta réponse" telle que
// soumise à côté de "Réponse correcte", ligne par ligne, chaque ligne de
// "Ta réponse" coloriée verte/rouge selon si CETTE position précise était
// la bonne. Le score reste tout-ou-rien côté serveur — cette coloration par
// ligne est purement informative, pour situer où ça a dérapé d'un coup d'œil.
const revealOrderList = (correctOrder) => {
  if (!orderCompare || !orderCompareMine || !orderCompareCorrect) return
  if (!Array.isArray(correctOrder) || correctOrder.length === 0) return
  setOrderDisabled(true)
  orderList.classList.add('d-none')
  orderCompare.classList.remove('d-none')

  const mine = Array.isArray(myOrderSubmission) && myOrderSubmission.length === correctOrder.length
    ? myOrderSubmission
    : null

  orderCompareCorrect.innerHTML = correctOrder.map((text, i) => `
    <div class="order-compare-row">
      <span class="order-compare-rank">${i + 1}</span>
      <span class="order-compare-text"></span>
    </div>
  `).join('')
  orderCompareCorrect.querySelectorAll('.order-compare-text').forEach((el, i) => { el.textContent = correctOrder[i] })

  if (!mine) {
    orderCompareMine.innerHTML = `<div class="order-compare-empty">Pas de réponse envoyée</div>`
    return
  }

  orderCompareMine.innerHTML = mine.map((text, i) => {
    const isCorrect = text === correctOrder[i]
    return `
      <div class="order-compare-row ${isCorrect ? 'is-correct' : 'is-incorrect'}">
        <span class="order-compare-rank">${i + 1}</span>
        <span class="order-compare-text"></span>
        <span class="order-compare-icon">${isCorrect ? '✓' : '✗'}</span>
      </div>
    `
  }).join('')
  orderCompareMine.querySelectorAll('.order-compare-text').forEach((el, i) => { el.textContent = mine[i] })
}

// --- Question "image" : où sur l'image ? ---
// Le joueur clique directement sur l'image (coordonnées normalisées 0-1, pas
// de grille — une grille fixe restait trop grossière face à des zones de
// bonne réponse dessinées librement au pixel par le créateur, voir editor.js).
// Le scoring par proximité (voir server/index.js) tolère d'être à une
// certaine distance de la zone correcte la plus proche.
let imageDisabled = true
let imageSelectedPoint = null // { x, y } normalisé 0-1

// Zoom + déplacement sur l'image façon carte interactive (GeoGuessr) : un
// cadre FIXE (#imageWrap a une largeur/hauteur posées en pixels UNE SEULE
// FOIS par question, voir setupImageFrame — jamais retouchées ensuite, donc
// le cadre ne bouge plus pendant qu'on zoome, contrairement à l'ancienne
// version qui redimensionnait le wrap lui-même et laissait le viewport se
// re-calculer autour). Le zoom/déplacement sont maintenant un simple
// transform CSS (translate + scale) sur ce cadre fixe, au lieu de jouer sur
// sa largeur + le scroll natif du viewport.
// L'éditeur (editor.js) garde volontairement son ancien mécanisme au
// scroll : le glisser y sert déjà à tracer les zones, impossible de le
// réutiliser aussi pour déplacer la vue sans ambiguïté.
const IMAGE_ZOOM_BASE_WIDTH = 640 // repli si le viewport n'a pas encore de taille (cas normalement jamais atteint)
const IMAGE_FRAME_MAX_HEIGHT = 480
const IMAGE_ZOOM_MIN = 1
const IMAGE_ZOOM_MAX = 4
const IMAGE_ZOOM_STEP = 0.25
const IMAGE_ZOOM_WHEEL_STEP = 0.18
const IMAGE_PAN_THRESHOLD = 6 // px avant de considérer le geste comme un glisser plutôt qu'un clic
let imageZoom = 1
let imagePanX = 0
let imagePanY = 0
let imageFrameW = 0
let imageFrameH = 0

const applyImageTransform = () => {
  if (!imageWrap) return
  imageWrap.style.transform = `translate(${imagePanX}px, ${imagePanY}px) scale(${imageZoom})`
}
// Empêche de déplacer le cadre au-delà des bords de l'image (jamais de vide
// visible) : le cadre zoomé doit toujours recouvrir entièrement le cadre de
// base, dans les deux axes.
const clampImagePan = () => {
  if (!imageFrameW || !imageFrameH) return
  const scaledW = imageFrameW * imageZoom
  const scaledH = imageFrameH * imageZoom
  const minX = Math.min(0, imageFrameW - scaledW)
  const minY = Math.min(0, imageFrameH - scaledH)
  imagePanX = Math.min(0, Math.max(minX, imagePanX))
  imagePanY = Math.min(0, Math.max(minY, imagePanY))
}
const applyImageZoom = () => {
  if (!imageWrap) return
  clampImagePan()
  applyImageTransform()
  if (imageZoomLabel) imageZoomLabel.textContent = Math.round(imageZoom * 100) + '%'
  if (imageZoomOutBtn) imageZoomOutBtn.disabled = imageZoom <= IMAGE_ZOOM_MIN
  if (imageZoomInBtn) imageZoomInBtn.disabled = imageZoom >= IMAGE_ZOOM_MAX
}
const setImageZoom = (z) => {
  imageZoom = Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, z))
  applyImageZoom()
}
// Cadre fixe calculé une seule fois par question, une fois l'image chargée
// (naturalWidth/Height nécessaires pour connaître son vrai ratio) : largeur
// = place dispo dans le viewport, hauteur = déduite du ratio (image entière
// visible à 100%, jamais recadrée), plafonnée pour ne pas exploser la mise
// en page sur une image très haute (object-fit: contain absorbe l'écart).
const setupImageFrame = () => {
  if (!imageWrap || !imageViewport || !imageImg) return
  const w = imageViewport.getBoundingClientRect().width || IMAGE_ZOOM_BASE_WIDTH
  const ratio = (imageImg.naturalWidth && imageImg.naturalHeight) ? imageImg.naturalWidth / imageImg.naturalHeight : (4 / 3)
  const h = Math.min(IMAGE_FRAME_MAX_HEIGHT, Math.round(w / ratio))
  imageFrameW = w
  imageFrameH = h
  imageWrap.style.width = w + 'px'
  imageWrap.style.height = h + 'px'
  imagePanX = 0
  imagePanY = 0
  setImageZoom(1)
}
// Zoom centré sur le curseur (comme Google Maps/Figma) : le point de l'image
// sous la souris reste visuellement au même endroit à l'écran avant/après le
// zoom — recalcule le déplacement en conséquence au lieu de rattraper le
// scroll natif du viewport (plus de scrollLeft/scrollTop, tout passe par
// imagePanX/Y désormais).
const zoomImageTowardPoint = (newZoom, clientX, clientY) => {
  if (!imageWrap || !imageViewport || !imageFrameW) { setImageZoom(newZoom); return }
  const viewportRect = imageViewport.getBoundingClientRect()
  const mouseX = clientX - viewportRect.left
  const mouseY = clientY - viewportRect.top
  const clampedZoom = Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, newZoom))
  const localX = (mouseX - imagePanX) / imageZoom
  const localY = (mouseY - imagePanY) / imageZoom
  imageZoom = clampedZoom
  imagePanX = mouseX - localX * imageZoom
  imagePanY = mouseY - localY * imageZoom
  applyImageZoom()
}
if (imageZoomInBtn) imageZoomInBtn.onclick = () => setImageZoom(imageZoom + IMAGE_ZOOM_STEP)
if (imageZoomOutBtn) imageZoomOutBtn.onclick = () => setImageZoom(imageZoom - IMAGE_ZOOM_STEP)
if (imageZoomResetBtn) imageZoomResetBtn.onclick = () => setImageZoom(1)
// Molette directement sur l'image = zoome vers le curseur, sans avoir à
// lâcher la souris pour viser précisément.
if (imageViewport) {
  imageViewport.addEventListener('wheel', (e) => {
    e.preventDefault()
    const step = e.deltaY < 0 ? IMAGE_ZOOM_WHEEL_STEP : -IMAGE_ZOOM_WHEEL_STEP
    zoomImageTowardPoint(imageZoom + step, e.clientX, e.clientY)
  }, { passive: false })
}

const buildImageAnswerArea = (src) => {
  if (!imageImg || !imageClickLayer) return
  imageImg.classList.remove('d-none')
  if (imageErrorMsg) imageErrorMsg.classList.add('d-none')
  // Posé AVANT d'assigner .src : une image déjà en cache peut déclencher
  // "load" de façon quasi synchrone, le rater reviendrait à garder le cadre
  // (et le zoom affiché) de la question précédente.
  imageImg.onload = setupImageFrame
  imageImg.onerror = () => {
    // Ne devrait normalement jamais arriver (l'hôte upload avant d'émettre
    // question:show) — si ça arrive quand même (upload raté, salle nettoyée
    // entre-temps...), au moins le signaler clairement plutôt qu'une zone de
    // clic flottant sur une image cassée invisible.
    console.error('[image] échec de chargement de l\'image:', src)
    imageImg.classList.add('d-none')
    if (imageErrorMsg) imageErrorMsg.classList.remove('d-none')
  }
  imageImg.src = src
  imageSelectedPoint = null
  imageDisabled = true
  if (imageMarker) imageMarker.classList.add('d-none')
  if (imageZonesRevealPath) imageZonesRevealPath.setAttribute('d', '')
  if (imageWrap) applyTileReveal(imageWrap, 0)
  if (imageZoomControls) imageZoomControls.classList.remove('d-none')
  // Repli synchrone : évite un flash de l'ancien cadre/zoom pendant que la
  // nouvelle image charge (setupImageFrame reprendra la main dès "load"
  // avec les vraies dimensions).
  imageZoom = 1
  imagePanX = 0
  imagePanY = 0
  applyImageZoom()
}

// Glisser pour se déplacer (comme une carte) / cliquer pour répondre : les
// deux gestes se font sur la même couche, distingués par un seuil de
// mouvement (même technique que le glisser-déposer du type "ordre") — un
// pointerup sans déplacement significatif = un clic, sinon la vue vient
// d'être déplacée et rien n'est soumis.
let imagePanGesture = null

const submitImageClick = (clientX, clientY) => {
  if (imageDisabled) return
  if (currentSingleAttempt && sendBtn.disabled) return
  const rect = imageClickLayer.getBoundingClientRect()
  imageSelectedPoint = {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
  }
  if (imageMarker) {
    // Retire puis remet la classe d'animation : sinon un second clic ne
    // rejoue pas le "drop" (l'élément reste affiché, l'animation ne se
    // déclenche qu'au passage masqué -> visible).
    imageMarker.classList.add('d-none')
    void imageMarker.offsetWidth
    imageMarker.classList.remove('d-none', 'marker-correct', 'marker-incorrect')
    imageMarker.style.left = `${imageSelectedPoint.x * 100}%`
    imageMarker.style.top = `${imageSelectedPoint.y * 100}%`
  }
}

if (imageClickLayer) {
  imageClickLayer.addEventListener('pointerdown', (e) => {
    imagePanGesture = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, pointerId: e.pointerId }
    try { imageClickLayer.setPointerCapture(e.pointerId) } catch {}
  })
  imageClickLayer.addEventListener('pointermove', (e) => {
    if (!imagePanGesture || e.pointerId !== imagePanGesture.pointerId) return
    const dx = e.clientX - imagePanGesture.lastX
    const dy = e.clientY - imagePanGesture.lastY
    if (!imagePanGesture.moved) {
      const dist = Math.hypot(e.clientX - imagePanGesture.startX, e.clientY - imagePanGesture.startY)
      if (dist > IMAGE_PAN_THRESHOLD) {
        imagePanGesture.moved = true
        imageClickLayer.classList.add('panning')
      }
    }
    if (imagePanGesture.moved) {
      imagePanX += dx
      imagePanY += dy
      clampImagePan()
      applyImageTransform()
    }
    imagePanGesture.lastX = e.clientX
    imagePanGesture.lastY = e.clientY
  })
  const endImagePanGesture = (e) => {
    if (!imagePanGesture || e.pointerId !== imagePanGesture.pointerId) return
    try { imageClickLayer.releasePointerCapture(e.pointerId) } catch {}
    imageClickLayer.classList.remove('panning')
    if (!imagePanGesture.moved) submitImageClick(e.clientX, e.clientY)
    imagePanGesture = null
  }
  imageClickLayer.addEventListener('pointerup', endImagePanGesture)
  imageClickLayer.addEventListener('pointercancel', () => {
    imagePanGesture = null
    imageClickLayer.classList.remove('panning')
  })
}

// Distance (en unités normalisées 0-1) entre le point cliqué et une zone
// (forme libre tracée dans l'éditeur, ou rectangle legacy — voir
// zone-geometry.js) : 0 si le point tombe dedans, sinon l'écart au bord le
// plus proche. Doit rester identique au calcul serveur (server/index.js)
// pour que le message affiché ("Presque ! ...") corresponde exactement aux
// points réellement accordés.
const imageZoneDistance = (point, zone) => {
  if (!point || !zone) return null
  const pts = zoneToPolygonPoints(zone)
  if (pts.length < 3) return null
  return distPointToPolygon(point, pts)
}
// Distance à la zone la plus proche, quand il y en a plusieurs (voir editor.js).
const imageMinZoneDistance = (point, zones) => {
  const list = Array.isArray(zones) ? zones : []
  const dists = list.map(z => imageZoneDistance(point, z)).filter(d => d !== null)
  return dists.length ? Math.min(...dists) : null
}

// Révélation : la ou les zones correctes s'affichent en vert (voir
// zone-geometry.js), chacune comme sa propre forme ; le marqueur du joueur
// passe au vert s'il était dans l'une d'elles, au rouge sinon — pour comparer
// les deux d'un coup d'œil, sans jamais avoir eu à cliquer sur une case précise.
const revealImageZones = (zones) => {
  if (!imageZonesRevealPath) return
  imageDisabled = true
  const list = (Array.isArray(zones) ? zones : []).filter(z => zoneToPolygonPoints(z).length >= 3)
  imageZonesRevealPath.setAttribute('d', zonesToSvgPath(list))
  if (imageMarker && imageSelectedPoint) {
    const dist = imageMinZoneDistance(imageSelectedPoint, list)
    imageMarker.classList.toggle('marker-correct', dist === 0)
    imageMarker.classList.toggle('marker-incorrect', dist !== 0)
  }
}

// --- Question "blind test" : extrait audio + orbe néon réactif ---
// Deux modes, choisis par l'hôte (case à cocher dans #hostPanel) :
//  - "IRL" (par défaut) : seul l'écran de l'hôte (branché aux enceintes de la
//    salle) diffuse le son ; les joueurs restent en muet pour éviter la
//    cacophonie de plusieurs téléphones décalés.
//  - "À distance" : tout le monde entend, chacun sur son propre poste.
// Dans les deux cas, TOUT LE MONDE charge et décode le même extrait (même
// muet) pour que l'orbe pulse en vrai sur chaque écran, pas une fausse
// animation générique.
let blindtestAudioCtx = null
let blindtestAnalyser = null
let blindtestPulseRAF = null
let myBlindTestSubmission = null // { title, artist } — capturé à l'envoi (voir sendBtn.onclick)
let audioMode = 'irl' // 'irl' | 'remote' — lu depuis #audioModeRemote côté hôte, transmis dans le payload
if (audioModeRemoteInput) {
  audioModeRemoteInput.checked = audioMode === 'remote'
  audioModeRemoteInput.onchange = () => { audioMode = audioModeRemoteInput.checked ? 'remote' : 'irl' }
}

// Curseur de volume "maison" (div + pointer events) plutôt qu'un
// <input type="range"> restylé — voir style.css .volume-track pour le
// pourquoi (bug visuel cross-navigateur avec le halo de focus global). Même
// principe que le curseur du type "graduation" : rects des autres éléments
// non pertinents ici (une seule piste, pas de tuiles à pousser), juste la
// position du pointeur relative à SA PROPRE piste — donc jamais de décalage
// entre l'endroit cliqué et l'endroit où le pouce atterrit, à n'importe
// quelle largeur d'écran.
const wireVolumeSlider = (track, fill, thumb, initialPct, onChange) => {
  if (!track || !fill || !thumb) return { setPct: () => {}, getPct: () => initialPct }
  let pct = initialPct
  const render = () => {
    fill.style.width = pct + '%'
    thumb.style.left = pct + '%'
    track.setAttribute('aria-valuenow', pct)
  }
  const setFromClientX = (clientX) => {
    const r = track.getBoundingClientRect()
    pct = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100)
    render()
    onChange(pct)
  }
  let dragging = false
  track.addEventListener('pointerdown', e => {
    dragging = true
    try { track.setPointerCapture(e.pointerId) } catch {}
    track.classList.add('grabbing')
    setFromClientX(e.clientX)
  })
  track.addEventListener('pointermove', e => { if (dragging) setFromClientX(e.clientX) })
  const endDrag = e => {
    if (!dragging) return
    dragging = false
    try { track.releasePointerCapture(e.pointerId) } catch {}
    track.classList.remove('grabbing')
  }
  track.addEventListener('pointerup', endDrag)
  track.addEventListener('pointercancel', endDrag)

  // Navigation clavier (accessibilité) : même piste "maison" que le curseur
  // de graduation (voir plus haut) — jusque-là uniquement pilotable au
  // pointeur (souris/doigt). tabindex/role/aria posés ci-dessous plutôt que
  // dans le HTML : cette fabrique sert deux curseurs distincts (volume hôte
  // et volume joueur, voir plus bas).
  track.tabIndex = 0
  track.setAttribute('role', 'slider')
  track.setAttribute('aria-valuemin', '0')
  track.setAttribute('aria-valuemax', '100')
  track.addEventListener('keydown', e => {
    let handled = true
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { pct = Math.min(100, pct + 5); render(); onChange(pct) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { pct = Math.max(0, pct - 5); render(); onChange(pct) }
    else if (e.key === 'Home') { pct = 0; render(); onChange(pct) }
    else if (e.key === 'End') { pct = 100; render(); onChange(pct) }
    else handled = false
    if (handled) e.preventDefault()
  })

  render()
  return {
    setPct: (v) => { pct = Math.min(100, Math.max(0, Math.round(v))); render() },
    getPct: () => pct
  }
}

// Volume par défaut choisi par l'hôte (0-100, transmis dans le payload de
// question:show) : sert de point de départ pour un joueur qui n'a encore
// jamais touché à SON propre curseur (voir plus bas, blindtestVolumeSlider) —
// une fois qu'il l'a fait, sa préférence perso (localStorage) prend toujours
// le dessus, y compris pour les questions suivantes du même quiz.
let hostAudioVolume = 70
const audioVolumeSlider = wireVolumeSlider(audioVolumeTrack, audioVolumeFill, audioVolumeThumb, hostAudioVolume, (pct) => {
  hostAudioVolume = pct
  if (audioVolumeLabel) audioVolumeLabel.textContent = pct + '%'
})

// Volume LOCAL du joueur, jamais envoyé au serveur — juste pour lui, en cas
// de son trop fort à son goût. Persisté en localStorage pour ne pas avoir à
// le refaire à chaque question/partie.
const BLINDTEST_VOLUME_KEY = 'queazy_blindtest_volume'
const getMyBlindTestVolumePct = () => {
  const saved = localStorage.getItem(BLINDTEST_VOLUME_KEY)
  return saved !== null ? Math.min(100, Math.max(0, Number(saved))) : null
}
const blindtestVolumeSlider = wireVolumeSlider(blindtestVolumeTrack, blindtestVolumeFill, blindtestVolumeThumb, getMyBlindTestVolumePct() ?? 70, (pct) => {
  localStorage.setItem(BLINDTEST_VOLUME_KEY, String(pct))
  if (blindtestAudio) blindtestAudio.volume = Math.min(1, Math.max(0, pct / 100))
})

// Monte le graphe Web Audio <audio> -> analyser -> destination UNE SEULE FOIS
// (createMediaElementSource ne peut être appelé qu'une fois par élément, sinon
// il lève une exception) — après ça, <audio> ne sort plus jamais le son
// directement, tout passe par ce graphe (d'où l'importance que le contexte
// soit bien "running", voir resumeBlindTestAudioCtx ci-dessous).
const ensureBlindTestAnalyser = () => {
  if (blindtestAnalyser || !blindtestAudio) return blindtestAnalyser
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    blindtestAudioCtx = new AudioCtx()
    const source = blindtestAudioCtx.createMediaElementSource(blindtestAudio)
    blindtestAnalyser = blindtestAudioCtx.createAnalyser()
    blindtestAnalyser.fftSize = 256
    source.connect(blindtestAnalyser)
    blindtestAnalyser.connect(blindtestAudioCtx.destination)
  } catch (e) {
    // Web Audio indisponible/bloqué (ex. navigateur trop restrictif) : l'orbe
    // retombe simplement sur sa respiration CSS générique (voir orb-idle),
    // l'audio continue de jouer normalement via l'élément <audio> lui-même.
    blindtestAnalyser = null
  }
  return blindtestAnalyser
}

// Un AudioContext démarre (ou repasse) "suspended" tant qu'aucun geste
// utilisateur ne l'a débloqué — et une fois <audio> routé à travers lui (voir
// ci-dessus), un contexte suspendu coupe le son en silence total MÊME SI
// <audio>.play() a réussi et n'est pas en pause. C'est la cause la plus
// probable d'un "ça ne joue pas" silencieux (aucune erreur visible). On
// tente le resume() à chaque geste utilisateur ET juste avant chaque lecture.
const resumeBlindTestAudioCtx = () => {
  ensureBlindTestAnalyser()
  if (blindtestAudioCtx && blindtestAudioCtx.state === 'suspended') {
    return blindtestAudioCtx.resume().catch(() => {})
  }
  return Promise.resolve()
}

// "Débloque" l'audio dès le tout premier geste (tap/clic) de CE visiteur sur
// la page — bien avant qu'une question blind test ne démarre. Sans ça, le
// premier play() programmatique (déclenché par le minuteur, pas un geste)
// peut être refusé par le navigateur, ou le contexte Web Audio rester
// suspendu. {once:true} : un seul geste suffit, pas besoin de répéter.
document.addEventListener('pointerdown', () => { resumeBlindTestAudioCtx() }, { once: true, passive: true })

const hideBlindTestUnlockPrompt = () => {
  if (blindtestUnlockBtn) blindtestUnlockBtn.classList.add('d-none')
}
const showBlindTestUnlockPrompt = () => {
  if (blindtestUnlockBtn) blindtestUnlockBtn.classList.remove('d-none')
}
if (blindtestUnlockBtn) {
  // Filet de sécurité si le déblocage "au premier geste" n'a pas suffi
  // (rare, mais les politiques d'autoplay varient beaucoup d'un navigateur à
  // l'autre) : un tap direct sur ce bouton est TOUJOURS un geste valide.
  blindtestUnlockBtn.onclick = () => {
    resumeBlindTestAudioCtx().then(() => {
      blindtestAudio.play().then(() => { startBlindTestPulse(); hideBlindTestUnlockPrompt() }).catch(() => {})
    })
  }
}

// Bouton "Tester le son" (popup de personnalisation, avant "Je suis prêt !") :
// utile surtout pour un quiz "à distance" (chacun doit entendre sur son
// poste) — un joueur qui a coupé le son de son téléphone ou refusé
// l'autoplay ne le découvrirait sinon qu'en plein blind test, trop tard.
// Un bip synthétique (pas besoin de fichier) suffit à confirmer "j'entends",
// et le geste du clic débloque au passage l'AudioContext pour plus tard.
const soundCheckBtn = document.getElementById('soundCheckBtn')
const soundCheckStatus = document.getElementById('soundCheckStatus')
if (soundCheckBtn) {
  soundCheckBtn.onclick = () => {
    resumeBlindTestAudioCtx().then(() => {
      if (!blindtestAudioCtx) return
      const now = blindtestAudioCtx.currentTime
      const osc = blindtestAudioCtx.createOscillator()
      const gain = blindtestAudioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(1320, now + 0.15)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.connect(gain)
      gain.connect(blindtestAudioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
      if (soundCheckStatus) soundCheckStatus.classList.remove('d-none')
    })
  }
}

const stopBlindTestPulse = () => {
  if (blindtestPulseRAF) cancelAnimationFrame(blindtestPulseRAF)
  blindtestPulseRAF = null
  if (blindtestOrb) {
    blindtestOrb.style.transform = ''
    blindtestOrb.style.boxShadow = ''
    blindtestOrb.classList.add('orb-idle')
  }
}

const startBlindTestPulse = () => {
  const analyser = ensureBlindTestAnalyser()
  if (!analyser || !blindtestOrb) return
  blindtestOrb.classList.remove('orb-idle')
  const data = new Uint8Array(analyser.frequencyBinCount)
  const loop = () => {
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length / 255 // 0..1
    const scale = 1 + avg * 0.5
    blindtestOrb.style.transform = `scale(${scale.toFixed(3)})`
    blindtestOrb.style.boxShadow = `0 0 ${40 + avg * 60}px ${10 + avg * 20}px rgba(var(--color-accent-rgb), ${0.35 + avg * 0.4})`
    blindtestPulseRAF = requestAnimationFrame(loop)
  }
  loop()
}

const buildBlindTestArea = (audioUrl, mode, hostVolumePct) => {
  if (!blindtestAudio) return
  stopBlindTestPulse()
  hideBlindTestUnlockPrompt()
  if (blindtestTitleInput) blindtestTitleInput.value = ''
  if (blindtestArtistInput) blindtestArtistInput.value = ''
  myBlindTestSubmission = null
  // "à distance" : personne n'est muet, chacun entend sur son poste.
  // "irl" (par défaut) : seul l'hôte (l'écran/les enceintes de la salle) entend.
  blindtestAudio.muted = mode === 'remote' ? false : !isHost
  blindtestAudio.pause()
  blindtestAudio.currentTime = 0
  blindtestAudio.src = audioUrl || ''
  // Volume : la valeur "par défaut" choisie par l'hôte ne sert QUE de point
  // de départ pour quelqu'un qui n'a JAMAIS touché à son propre curseur (ni
  // en tant que joueur, ni en tant qu'hôte, sur CE navigateur) — dès qu'une
  // préférence perso existe (même une seule fois, n'importe quand), elle
  // gagne pour toujours, y compris pour l'hôte lui-même : le "défaut" ne
  // doit jamais écraser un réglage volontaire déjà fait.
  const myVolumePct = getMyBlindTestVolumePct()
  const startVolumePct = myVolumePct !== null ? myVolumePct : (typeof hostVolumePct === 'number' ? hostVolumePct : 70)
  blindtestAudio.volume = Math.min(1, Math.max(0, startVolumePct / 100))
  blindtestVolumeSlider.setPct(startVolumePct)
}

const playBlindTestAudio = () => {
  if (!blindtestAudio || !blindtestAudio.src) return
  resumeBlindTestAudioCtx().then(() => {
    blindtestAudio.play().then(() => {
      startBlindTestPulse()
      hideBlindTestUnlockPrompt()
    }).catch(() => {
      // Le navigateur a refusé la lecture programmatique (pas de geste
      // récent) : au lieu d'échouer en silence, on propose un bouton qui,
      // lui, EST un geste — garantit que la musique démarre au pire au tap.
      showBlindTestUnlockPrompt()
    })
  })
}

const stopBlindTestAudio = () => {
  if (blindtestAudio) blindtestAudio.pause()
  hideBlindTestUnlockPrompt()
  stopBlindTestPulse()
}

const revealBlindTestAnswer = (correctTitle, correctArtist) => {
  if (!revealAnswerText) return
  const parts = []
  parts.push(`Bonne réponse : ${correctTitle || '?'} — ${correctArtist || '?'}`)
  if (myBlindTestSubmission && (myBlindTestSubmission.title || myBlindTestSubmission.artist)) {
    parts.push(`Toi : ${myBlindTestSubmission.title || '—'} / ${myBlindTestSubmission.artist || '—'}`)
  }
  revealAnswerText.innerHTML = parts.map(p => `<div>${p.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>`).join('')
  revealAnswerText.classList.remove('d-none')
}

const clearRevealState = () => {
  Array.from(optionsDiv.children).forEach(el => el.classList.remove('correct-reveal', 'incorrect-reveal'))
  if (revealAnswerText) { revealAnswerText.classList.add('d-none'); revealAnswerText.textContent = '' }
  if (myResultBanner) { myResultBanner.classList.add('d-none'); myResultBanner.classList.remove('is-correct', 'is-incorrect', 'is-close'); myResultBanner.textContent = '' }
  if (revealExplanationText) { revealExplanationText.classList.add('d-none'); revealExplanationText.textContent = '' }
  if (gradSlider) gradSlider.classList.remove('reveal')
  if (orderCompare) orderCompare.classList.add('d-none')
  if (orderList) orderList.classList.remove('d-none')
  if (imageZonesRevealPath) imageZonesRevealPath.setAttribute('d', '')
  if (imageMarker) imageMarker.classList.remove('marker-correct', 'marker-incorrect')
  if (questionRecapCard) questionRecapCard.classList.add('d-none')
}

// Bandeau perso "Bonne réponse !/Mauvaise réponse" au reveal — nécessaire
// pour les types où la révélation ne montre que LA bonne réponse (ex.
// "ordre" : tout redevient vert quel que soit mon résultat) sans jamais dire
// si LA MIENNE l'était.
// text/variant : pour les types à score de proximité (ex. "image"), un état
// intermédiaire "Presque !" (variant 'is-close') peut être imposé — sinon
// déduit de myAnsweredCorrectlyThisQuestion (bon points gagnés = vert).
const showMyResultBanner = (text, variant) => {
  if (!myResultBanner || isHost) return
  myResultBanner.classList.remove('d-none', 'is-correct', 'is-incorrect', 'is-close')
  if (text) {
    myResultBanner.classList.add(variant || 'is-correct')
    myResultBanner.textContent = text
    return
  }
  if (myAnsweredCorrectlyThisQuestion) {
    myResultBanner.classList.add('is-correct')
    myResultBanner.textContent = `Bonne réponse ! +${myLastDelta} points`
  } else {
    myResultBanner.classList.add('is-incorrect')
    myResultBanner.textContent = 'Mauvaise réponse'
  }
}

// Badge « Réponse envoyée » : feedback principal du joueur après soumission
const answerStatusEl = document.getElementById('answerStatus')
const showAnswerStatus = () => { if (answerStatusEl) answerStatusEl.classList.remove('d-none') }
const hideAnswerStatus = () => { if (answerStatusEl) answerStatusEl.classList.add('d-none') }

const positionGradTargetMarker = (target) => {
  // Révélation : on bloque le curseur et on déplace le pouce jusqu'à la
  // bonne valeur, teinté en vert.
  gradState.disabled = true
  if (gradSlider) gradSlider.classList.add('reveal')
  setGradValue(Number(target), true)
}

const revealFreeAnswer = (text) => {
  if (!revealAnswerText) return
  revealAnswerText.textContent = `Bonne réponse : ${text}`
  revealAnswerText.classList.remove('d-none')
}
const scores = new Map()
// Classement (ids triés par score) juste avant le début de la question en
// cours — sert à annoncer un changement de position au bon moment (voir
// revealMyPositionChange), jamais pendant que les réponses sont encore en
// train d'arriver.
let preQuestionOrder = []
// Rafraîchi à chaque question:show, mis à true si un score:update pour MOI
// arrive avant la révélation — sert uniquement à choisir le son (correct.wav
// / wrong.wav) joué à la révélation, jamais affiché avant.
let myAnsweredCorrectlyThisQuestion = false
// Delta de points du dernier score:update me concernant — sert au bandeau
// "Bonne réponse ! +X points" affiché au reveal (voir showMyResultBanner).
let myLastDelta = 0
// Rafraîchi à chaque question:show, mis à true dès l'envoi d'une réponse —
// coupe le tic-tac du timer pour ce joueur (il n'a plus besoin d'être pressé).
let hasAnsweredThisQuestion = false
// Valeur envoyée par CE joueur pour une question "graduation" — capturée à
// l'envoi, car gradState.value est ensuite déplacé par positionGradTargetMarker
// pour l'animation de révélation (le curseur glisse jusqu'à la bonne valeur) :
// lire gradState.value après coup donnerait donc la bonne réponse, pas la sienne.
let myGradAnswerValue = null
// Ordre envoyé par CE joueur pour une question "order" — capturé à l'envoi,
// car revealOrderList() réarrange ensuite les tuiles vers l'ordre correct
// (le tableau currentOrder ne reflète plus alors ce que le joueur avait mis).
let myOrderSubmission = null
const leaderOverlay = document.getElementById('leaderOverlay')
const leaderboard = document.getElementById('leaderboard')
const navCreate = document.getElementById('navCreate')
const navJoin = document.getElementById('navJoin')
const navMyQuizzes = document.getElementById('navMyQuizzes')
const isAvatarUrl = (s) => typeof s === 'string' && /^(data:|https?:|blob:|\/)/.test(s)

// --- Popup "en attente de validation" + réactions partagées ---
// Remplace l'ancien basculement brutal sur le classement pendant qu'une
// réponse libre attend d'être validée par l'hôte : une petite carte flotte
// devant l'écran de jeu (qui reste visible en dessous, juste assombri) au
// lieu de couper le rythme avec un écran figé. Quelques boutons "fun"
// permettent de patienter, avec un effet visible par toute la salle en
// direct (voir socket.on('fun:react', ...) plus bas).
const moderationWaitOverlay = document.getElementById('moderationWaitOverlay')
const moderationWaitText = document.getElementById('moderationWaitText')
const reactionLayer = document.getElementById('reactionLayer')
const MODERATION_WAIT_CAPTIONS = [
  'Le chef fignole son jugement...',
  'Analyse des pépites en cours...',
  'Presque bon...',
  'Un peu de patience, ça arrive !',
  'Dégustation en cours...'
]
let moderationWaitCaptionInt = null

const showModerationWait = () => {
  if (!moderationWaitOverlay) return
  moderationWaitOverlay.classList.remove('d-none')
  let idx = 0
  if (moderationWaitText) moderationWaitText.textContent = MODERATION_WAIT_CAPTIONS[idx]
  clearInterval(moderationWaitCaptionInt)
  moderationWaitCaptionInt = setInterval(() => {
    if (!moderationWaitText) return
    idx = (idx + 1) % MODERATION_WAIT_CAPTIONS.length
    moderationWaitText.classList.add('is-fading')
    setTimeout(() => {
      moderationWaitText.textContent = MODERATION_WAIT_CAPTIONS[idx]
      moderationWaitText.classList.remove('is-fading')
    }, 250)
  }, 2600)
}
const hideModerationWait = () => {
  if (moderationWaitOverlay) moderationWaitOverlay.classList.add('d-none')
  clearInterval(moderationWaitCaptionInt)
  moderationWaitCaptionInt = null
}

// Emoji qui monte à l'écran et se retire seul une fois l'animation finie —
// léger cooldown CLIENT en plus de la limite serveur (voir server/index.js),
// juste pour éviter le double-tap accidentel.
const spawnFloatingReaction = (emoji) => {
  if (!reactionLayer) return
  const el = document.createElement('span')
  el.className = 'floating-reaction'
  el.textContent = emoji
  el.style.left = `${5 + Math.random() * 90}%`
  el.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 160)}px`)
  el.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 60)}deg`)
  reactionLayer.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

let lastReactionSentTs = 0
const REACTION_CLIENT_COOLDOWN_MS = 600
document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.onclick = () => {
    const now = Date.now()
    if (now - lastReactionSentTs < REACTION_CLIENT_COOLDOWN_MS) return
    lastReactionSentTs = now
    const roomCode = roomInput.value.trim()
    socket.emit('fun:react', { roomCode, emoji: btn.dataset.emoji })
  }
})

socket.on('fun:react', ({ emoji }) => {
  if (typeof emoji === 'string') spawnFloatingReaction(emoji)
})

// Quiz Selection Popup elements
const quizSelectPopup = document.getElementById('quizSelectPopup')
const quizList = document.getElementById('quizList')
const selectQuizBtn = document.getElementById('selectQuizBtn')
const cancelQuizSelect = document.getElementById('cancelQuizSelect')
const confirmQuizSelect = document.getElementById('confirmQuizSelect')
let selectedQuizId = null

// Functions to show/hide quiz selection popup
const showQuizSelectPopup = () => {
  if (quizSelectPopup) {
    quizSelectPopup.classList.remove('d-none')
    loadQuizzes() // Load quizzes when popup is shown
  }
}

const hideQuizSelectPopup = () => {
  if (quizSelectPopup) {
    quizSelectPopup.classList.add('d-none')
    selectedQuizId = null // Reset selected quiz
    confirmQuizSelect.disabled = true // Disable confirm button
  }
}

// Load real quizzes from API
const loadQuizzes = async () => {
  quizList.innerHTML = '<p class="text-muted">Chargement des quiz...</p>'
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession()
    if (!session) {
      quizList.innerHTML = '<p class="text-muted">Connecte-toi pour sélectionner tes quiz.</p>'
      return
    }
    const { data } = await window.supabaseClient
      .from('quizzes')
      .select('id,title,questions')
      .eq('owner_id', session.user.id)
      .order('updated_at', { ascending: false })
    const mapped = (data || []).map(q => ({ id: q.id, title: q.title, count: Array.isArray(q.questions) ? q.questions.length : 0 }))
    displayQuizzes(mapped)
  } catch (error) {
    console.error('Erreur lors du chargement des quiz:', error)
    quizList.innerHTML = '<p class="text-danger">Erreur lors du chargement des quiz.</p>'
  }
}

// Display quizzes in the popup
const displayQuizzes = (quizzes) => {
  quizList.innerHTML = '' // Clear loading message
  if (!quizzes || quizzes.length === 0) {
    quizList.innerHTML = '<p class="text-muted">Aucun quiz disponible.</p>'
    return
  }

  quizzes.forEach(quiz => {
    const quizItem = document.createElement('div')
    quizItem.className = 'quiz-item card d-flex justify-between align-center p-md cursor-pointer'
    // Construit via le DOM (textContent) plutôt qu'un innerHTML avec
    // template literal : quiz.title vient de Supabase et peut avoir été saisi
    // par n'importe quel hôte (quiz publics) — un titre contenant du HTML/JS
    // s'exécuterait sinon chez quiconque parcourt la liste des quiz.
    const infoDiv = document.createElement('div')
    const titleEl = document.createElement('h4')
    titleEl.className = 'font-bold'
    titleEl.textContent = quiz.title
    const countEl = document.createElement('p')
    countEl.className = 'text-muted font-14'
    countEl.textContent = `${quiz.count || 0} questions`
    infoDiv.appendChild(titleEl)
    infoDiv.appendChild(countEl)
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'quizSelection'
    radio.value = quiz.id
    radio.className = 'radio-btn'
    quizItem.appendChild(infoDiv)
    quizItem.appendChild(radio)
    quizItem.onclick = () => {
      // Select the radio button when clicking the item
      radio.checked = true
      selectedQuizId = quiz.id
      confirmQuizSelect.disabled = false // Enable confirm button
      // Remove 'selected' class from other items and add to current
      document.querySelectorAll('.quiz-item').forEach(item => item.classList.remove('selected'))
      quizItem.classList.add('selected')
    }
    quizList.appendChild(quizItem)
  })
}

// Event listeners for quiz selection popup
if (selectQuizBtn) {
  selectQuizBtn.onclick = showQuizSelectPopup
}

if (cancelQuizSelect) {
  cancelQuizSelect.onclick = hideQuizSelectPopup
}

if (confirmQuizSelect) {
  confirmQuizSelect.onclick = () => {
    if (selectedQuizId) {
      loadQuizById(selectedQuizId) // Load the selected quiz
      hideQuizSelectPopup()
    } else {
      showAnnounce('Veuillez sélectionner un quiz.', 'error')
    }
  }
}

const log = m => { logDiv.textContent = m }
let baseUrl = location.origin

// Récupération de l'URL du serveur si nécessaire
try { 
  fetch('/server-info')
    .then(r => r.json())
    .then(info => { 
      if (info && info.url) { 
        baseUrl = info.url; 
        const infoEl = document.getElementById('serverInfo'); 
        if (infoEl) { 
          infoEl.style.display = 'block'; 
          infoEl.textContent = baseUrl 
        } 
      } 
    }) 
} catch {}

const savedName = localStorage.getItem('queazy_profile_name'); 
if (savedName) { nameInput.value = savedName }

const savedAvatarPreview = localStorage.getItem('queazy_profile_avatar')
if (savedAvatarPreview) {
  const p = document.getElementById('profileAvatar')
  if (p) {
    p.style.backgroundImage = 'url(' + savedAvatarPreview + ')'
    p.style.backgroundSize = 'cover'
    p.style.backgroundPosition = 'center'
  }
}

const createRoom = () => {
  socket.emit('room:create', { token: getToken() })
}

createBtn.onclick = async () => {
  const { data: { session } } = await window.supabaseClient.auth.getSession()
  if (!session) {
    window.location.href = '/login.html?reason=create'
    return
  }
  createRoom()
}

const showJoinPanel = (showCreateRoomButton = true) => {
  if (joinCard) {
    joinCard.classList.remove('d-none')
    joinCard.style.display = 'block'
  }
  if (createBtn) {
    if (showCreateRoomButton) {
      createBtn.classList.remove('d-none')
      createBtn.style.display = 'inline-flex'
    } else {
      createBtn.classList.add('d-none')
      createBtn.style.display = 'none'
    }
  }
  if (createRoomDivider) {
    if (showCreateRoomButton) {
      createRoomDivider.classList.remove('d-none')
      createRoomDivider.style.display = 'flex'
    } else {
      createRoomDivider.classList.add('d-none')
      createRoomDivider.style.display = 'none'
    }
  }
  if (guestJoinOptions) {
    guestJoinOptions.classList.add('d-none')
    guestJoinOptions.style.display = 'none'
  }
  const timerContainer = document.getElementById('timerContainer')
  if (timerContainer) {
    timerContainer.classList.add('d-none')
    timerContainer.style.display = 'none'
  }
  nameInput.focus()
}
navCreate.onclick = async (e) => {
  e.preventDefault()

  const { data: { session } } = await window.supabaseClient.auth.getSession()
  if (!session) {
    window.location.href = '/login.html?reason=create'
    return
  }

  if (isHost && roomInput.value) {
    socket.emit('room:close', { roomCode: roomInput.value })
  }
  resetUI()
  createRoom()
}

if (navMyQuizzes) {
  navMyQuizzes.onclick = async (e) => {
    e.preventDefault()
    const { data: { session } } = await window.supabaseClient.auth.getSession()
    if (!session) {
      showAnnounce('Vous devez être connecté pour accéder à vos quiz !', 'error')
      return
    }
    window.location.href = navMyQuizzes.href
  }
}

navJoin.onclick = (e) => {
  e.preventDefault()
  if (isHost && roomInput.value) {
    socket.emit('room:close', { roomCode: roomInput.value })
  }
  resetUI()
  showJoinPanel(false)
}

const resetUI = () => {
  inActiveGame = false // voir beforeunload : plus rien à protéger, salle fermée/quittée
  isHost = false
  roomInput.value = ''
  
  // Hide all dynamic panels
  const panels = ['lobby', 'hostPanel', 'roomInfo', 'timerContainer', 'persistentRoomCode']
  panels.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.classList.add('d-none')
      el.style.display = 'none'
    }
  })
  
  // Show join panel
  if (joinCard) {
    joinCard.classList.remove('d-none')
    joinCard.style.display = 'block'
  }
  
  // Reset quiz state
  loadedQuiz = null
  quizIndex = 0
  loadedInfo.textContent = 'Aucun quiz sélectionné'
  qrDiv.innerHTML = ''
}

socket.on('room:closed', ({ message }) => {
  clearConnBanner()
  showAnnounce(message, 'info')
  resetUI()
})

socket.on('player:kicked', ({ message }) => {
  clearConnBanner()
  showAnnounce(message || 'Tu as été exclu de la salle.', 'error')
  resetUI()
})

const loadQuizById = (id) => {
  window.supabaseClient
    .from('quizzes')
    .select('id,title,questions,single_attempt')
    .eq('id', id)
    .single()
    .then(({ data, error }) => {
      if (error) throw error
      const norm = Array.isArray(data.questions) ? data.questions.map((q, i) => ({
        id: q.id || ('q' + (i + 1)),
        type: q.type || 'free',
        prompt: q.prompt || 'Question',
        timerMs: q.timerMs || 15000,
        // "blindtest" range ses réponses acceptées dans un objet {title, artist},
        // pas un tableau comme les autres types (voir editor.js/emitQuestion) —
        // sans ce cas à part, Array.isArray(q.correct) est faux et on perdait
        // silencieusement titre/artiste (affichés "?" au reveal ensuite).
        correct: q.type === 'blindtest'
          ? (q.correct && !Array.isArray(q.correct) ? q.correct : { title: [], artist: [] })
          : (Array.isArray(q.correct) ? q.correct : []),
        options: Array.isArray(q.options) ? q.options : [],
        min: q.min,
        max: q.max,
        image: q.image,
        illustration: q.illustration,
        // Même oubli que q.image en son temps : sans ce champ, l'extrait audio
        // du blind test disparaissait silencieusement au chargement du quiz
        // (question démarrée sans le moindre son, aucune erreur visible).
        audio: q.audio,
        explanation: q.explanation || ''
      })) : []
      loadedQuiz = {
        id: data.id,
        title: data.title || '',
        singleAttempt: data.single_attempt !== false,
        questions: norm
      }
      quizIndex = 0
      currentSingleAttempt = loadedQuiz.singleAttempt !== false
      loadedInfo.textContent = 'Quizz chargé: ' + (loadedQuiz.title || id)
      log('Quizz chargé: ' + (loadedQuiz.title || id))
    })
    .catch(() => {})
}
 
socket.on('room:created', ({ roomCode, serverUrl, hostToken }) => {
  isHost = true
  roomInput.value = roomCode
  if (logDiv) { logDiv.style.display = 'none' }
  hostPanel.classList.remove('d-none')
  hostPanel.style.display = 'flex'
  showLobby()
  hideBuilder()
  const jc = document.getElementById('joinCard')
  if (jc) {
    jc.classList.add('d-none')
    jc.style.display = 'none'
  }
  const roomInfo = document.getElementById('roomInfo')
  if (roomInfo) {
    roomInfo.classList.remove('d-none')
    roomInfo.style.display = 'block'
  }
  qrDiv.innerHTML = ''
  const persistentCode = document.getElementById('persistentRoomCode')
  if (persistentCode) persistentCode.style.display = 'block'
  const displayRoomCode = document.getElementById('displayRoomCode');
  if (displayRoomCode) {
    displayRoomCode.textContent = roomCode;
  }
  const base = serverUrl || baseUrl
  const joinUrl = `${base}/?room=${roomCode}`
  new QRCode(qrDiv, joinUrl)
  const infoEl = document.getElementById('serverInfo'); if (infoEl) { infoEl.textContent = 'Salle créée: ' + roomCode + ' • ' + joinUrl }
  const copyBtn = document.getElementById('copyUrl')
  if (copyBtn) { 
    copyBtn.onclick = () => { 
      const input = document.createElement('input')
      input.value = joinUrl
      document.body.appendChild(input)
      input.select()
      try {
        document.execCommand('copy')
        showAnnounce('Lien copié !')
      } catch (err) {
        console.error('Erreur de copie:', err)
      }
      document.body.removeChild(input)
    } 
  }
  
  const hName = localStorage.getItem('queazy_profile_name') || 'Hôte'
  const hAv = localStorage.getItem('queazy_profile_avatar') || '👑'
  
  // Use hostToken if provided to ensure match
  const token = hostToken || getToken()
  if (hostToken) localStorage.setItem('queazy_token', hostToken)

  // Même mécanisme de reconnexion que les joueurs (voir rememberJoin) : le
  // serveur sait déjà réassocier room.hostId au nouveau socket.id via ce
  // même token (voir room:join côté serveur), il ne manquait que ce réflexe
  // client pour que l'hôte redevienne opérationnel après un accroc réseau.
  rememberJoin(roomCode, hName, hAv, token)
  socket.emit('room:join', { roomCode, playerName: hName, token: token, avatar: hAv })
  socket.emit('player:ready', { roomCode, ready: true })
})

const preQuiz = params.get('quiz')
if (preQuiz) { loadQuizById(preQuiz) }

const genToken = () => Math.random().toString(36).slice(2, 10)
const getToken = () => {
  let t = localStorage.getItem('queazy_token')
  if (!t) { t = genToken(); localStorage.setItem('queazy_token', t) }
  return t
}
const debounce = (fn, ms) => {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}
const setupLiveProfile = () => {
  const nameBox = document.getElementById('lobbyName')
  if (nameBox && !nameBox._bound) {
    const handler = debounce(() => {
      const roomCode = roomInput.value.trim()
      const name = (nameBox.value.trim() || 'Player')
      const avatar = selectedIcon || '🙂'
      socket.emit('player:profile', { roomCode, name, avatar })
    }, 200)
    nameBox.addEventListener('input', handler)
    nameBox._bound = true
  }
}

const hideJoinPanel = () => {
  if (joinCard) {
    joinCard.classList.add('d-none')
    joinCard.style.display = 'none'
  }
  if (createBtn) {
    createBtn.classList.add('d-none')
    createBtn.style.display = 'none'
  }
  if (createRoomDivider) {
    createRoomDivider.classList.add('d-none')
    createRoomDivider.style.display = 'none'
  }
  if (guestJoinOptions) {
    guestJoinOptions.classList.add('d-none')
    guestJoinOptions.style.display = 'none'
  }
}

const showLobby = () => {
  document.body.classList.remove('game-active')
  const lobby = document.getElementById('lobby')
  if (lobby) {
    lobby.classList.remove('d-none')
    lobby.style.display = 'block'
  }
  const timerContainer = document.getElementById('timerContainer')
  if (timerContainer) {
    timerContainer.classList.add('d-none')
    timerContainer.style.display = 'none'
  }
}

const iconButtons = () => Array.from(document.querySelectorAll('.icon-opt'))
const updateSelectionVisual = (sel) => {
  iconButtons().forEach(b => {
    if (b.dataset.avatar === sel) b.classList.add('selected')
    else b.classList.remove('selected')
  })
}

const setupIconGrid = () => {
  const grid = document.getElementById('iconGrid')
  if (!grid) {
    console.error('Icon grid not found!')
    return
  }

  grid.innerHTML = ''

  AVATAR_CHOICES.forEach(url => {
    const opt = document.createElement('div')
    opt.className = 'icon-opt avatar-tile'
    opt.style.backgroundImage = `url(${url})`
    opt.dataset.avatar = url
    grid.appendChild(opt)
  })

  iconButtons().forEach(btn => {
    btn.onclick = () => {
      selectedIcon = btn.dataset.avatar
      const prev = document.getElementById('lobbyPreview')
      if (prev) {
        prev.style.backgroundImage = `url(${selectedIcon})`
        prev.textContent = ''
      }
      updateSelectionVisual(selectedIcon)
    }
  })
}

const showBuilder = () => {
  const popup = document.getElementById('personalizationPopup')
  const builder = document.getElementById('lobbyBuilder')
  if (popup && builder) {
    // 1. Réinitialiser les styles de visibilité sur le builder lui-même
    builder.classList.remove('d-none')
    builder.style.display = 'flex'
    
    // 2. Afficher la popup
    popup.classList.remove('d-none')
    popup.style.display = 'flex'
    
    // 3. Initialiser la grille d'icônes
    setupIconGrid()
    
    // 4. Pré-remplir le nom si disponible
    const nameInput = document.getElementById('lobbyName')
    if (nameInput) {
      // Priorité : localStorage > valeur actuelle de l'input > champ de connexion principal > invité
      const savedName = localStorage.getItem('queazy_profile_name')
      const mainName = document.getElementById('name')?.value
      const guestName = document.getElementById('guestNameInput')?.value
      
      const currentName = savedName || mainName || guestName || ''
      nameInput.value = currentName
    }
    
    // 5. Pré-remplir l'avatar si disponible
    const currentAvatar = localStorage.getItem('queazy_profile_avatar') || selectedIcon || AVATAR_CHOICES[0]
    selectedIcon = currentAvatar
    const prev = document.getElementById('lobbyPreview')
    if (prev) {
      if (isAvatarUrl(currentAvatar)) {
        prev.style.backgroundImage = `url(${currentAvatar})`
        prev.textContent = ''
      } else {
        prev.style.backgroundImage = ''
        prev.textContent = currentAvatar
      }
    }
    updateSelectionVisual(currentAvatar)
  } else {
    console.error('Popup ou Builder introuvable dans le DOM !')
  }
}

const hideBuilder = () => {
  const popup = document.getElementById('personalizationPopup')
  if (popup) {
    popup.classList.add('d-none')
    popup.style.display = 'none'
  }
}

socket.on('player:token', ({ token }) => {
  localStorage.setItem('queazy_token', token)
  hideJoinPanel()
  showLobby()
  showBuilder()
  setupLiveProfile()
  
  const code = roomInput.value.trim()
  const persistentCode = document.getElementById('persistentRoomCode')
  if (persistentCode) {
    persistentCode.classList.remove('d-none')
    persistentCode.style.display = 'block'
  }
  const displayRoomCode = document.getElementById('displayRoomCode')
  if (displayRoomCode && code) {
    displayRoomCode.textContent = code
  }
})

// Nécessaire pour se "rattacher" automatiquement à la même place après une
// reconnexion socket.io (perte de réseau, mise en veille de l'onglet sur
// mobile, tab backgrounded pendant un appui long...) : un socket.id change à
// chaque reconnexion, et sans réémettre room:join avec le MÊME token, on ne
// revient jamais dans la room socket.io -> plus aucune mise à jour reçue
// (classement figé/désynchronisé, ligne qui semble "disparaître" au prochain
// rendu). Le serveur, lui, sait déjà très bien réassocier un token à un
// nouveau socket.id (voir room:join côté serveur) — il ne manquait que ce
// réflexe côté client.
let myJoinedRoomCode = null
let myJoinedName = null
let myJoinedAvatar = null
let myJoinedToken = null
const rememberJoin = (roomCode, playerName, avatar, token) => {
  myJoinedRoomCode = roomCode
  myJoinedName = playerName
  myJoinedAvatar = avatar
  myJoinedToken = token
}

joinBtn.onclick = () => {
  const roomCode = roomInput.value.trim()
  const playerName = nameInput.value.trim()

  if (!roomCode) { log('Veuillez entrer un code de salle'); return }

  if (!playerName) {
    // If player name is empty, show guest join options
    if (joinCard) {
      joinCard.classList.add('d-none')
      joinCard.style.display = 'none'
    }
    if (guestJoinOptions) {
      guestJoinOptions.classList.remove('d-none')
      guestJoinOptions.style.display = 'block'
    }
    guestNameInput.value = `Invité#${Math.floor(Math.random() * 9000) + 1000}`
    guestNameInput.focus()
    return
  }

  const avatar = selectedIcon || localStorage.getItem('queazy_profile_avatar') || '🙂'
  const token = getToken()
  rememberJoin(roomCode, playerName, avatar, token)
  socket.emit('room:join', { roomCode, playerName, token, avatar })
}

confirmGuestJoin.onclick = () => {
  const roomCode = roomInput.value.trim()
  const guestName = guestNameInput.value.trim()
  if (!roomCode) { log('Veuillez entrer un code de salle'); return }
  if (!guestName) { log('Veuillez entrer un pseudo invité'); return }

  const guestAvatar = '🙂' // Default guest avatar
  // genToken() (pas getToken()) : un invité n'a pas de compte, son jeton
  // n'est PAS persisté dans localStorage — mais il doit rester identique le
  // temps de cette session d'onglet pour que la reconnexion fonctionne (voir
  // rememberJoin ci-dessus), d'où la variable plutôt qu'un nouvel appel.
  const guestToken = genToken()
  rememberJoin(roomCode, guestName, guestAvatar, guestToken)
  socket.emit('room:join', { roomCode, playerName: guestName, token: guestToken, avatar: guestAvatar })
}

cancelGuestJoin.onclick = () => {
  if (guestJoinOptions) {
    guestJoinOptions.classList.add('d-none')
    guestJoinOptions.style.display = 'none'
  }
  if (joinCard) {
    joinCard.classList.remove('d-none')
    joinCard.style.display = 'block'
  }
  nameInput.focus()
}

socket.on('disconnect', () => {
  setConnBanner('Connexion perdue — reconnexion en cours…')
})

// Émis par le serveur à TOUS les joueurs d'une salle quand l'hôte lui-même
// décroche (voir le délai de grâce côté serveur) : sans ça, les joueurs
// verraient juste la partie se figer sans explication pendant que le
// serveur attend en silence un éventuel retour de l'hôte.
socket.on('host:disconnected', () => {
  setConnBanner('L\'hôte a été déconnecté — en attente de reconnexion…', true)
})
socket.on('host:reconnected', () => {
  clearConnBanner()
})

socket.on('connect', () => {
  clearConnBanner()
  window.myId = socket.id
  if (myJoinedRoomCode) {
    // Reconnexion (pas la toute première connexion de l'onglet) : on était
    // déjà dans une room avant que ce socket ne change d'id (coupure réseau,
    // onglet mis en veille...) — on se réémet en room:join avec le MÊME
    // token pour se faire rattacher à notre entrée existante (score compris)
    // sous ce nouveau socket.id, et revenir dans la room socket.io (sinon
    // plus aucune mise à jour n'arrive : classement figé, ligne qui semble
    // "disparaître" au prochain rendu).
    socket.emit('room:join', { roomCode: myJoinedRoomCode, playerName: myJoinedName, token: myJoinedToken, avatar: myJoinedAvatar })
  } else if (preRoom) {
    const nm = nameInput.value.trim() || localStorage.getItem('queazy_profile_name') || 'Joueur'
    const av = selectedIcon || localStorage.getItem('queazy_profile_avatar') || '🙂'
    rememberJoin(preRoom.toUpperCase(), nm, av, getToken())
    socket.emit('room:join', { roomCode: preRoom.toUpperCase(), playerName: nm, token: getToken(), avatar: av })
  }
})



// Re-run setupIconGrid when joining lobby
const originalShowLobby = () => {
  const lobby = document.getElementById('lobby')
  if (lobby) {
    lobby.classList.remove('d-none')
    lobby.style.display = 'block'
  }
}

socket.on('room:join:success', ({ roomCode, isHost: hostStatus }) => {
  isHost = hostStatus
  roomInput.value = roomCode
  originalShowLobby()

  if (!isHost) {
    showBuilder()
  }
})

// --- Mode équipe (salon d'attente uniquement, voir server/index.js) ---
// teamsById tient les métadonnées (nom/couleur) de chaque équipe, tenues à
// jour par team:list (diffusé à l'activation, à la réassignation en masse et
// à chaque room:join) — lobby:list (rafraîchi bien plus souvent) ne porte
// que le teamId de chaque joueur, jamais les métadonnées elles-mêmes.
let teamModeActive = false
let teamsById = {}
let lastLobbyArr = [] // dernière liste reçue de lobby:list, réutilisée par team:list pour redessiner sans attendre le prochain lobby:list
let playerTeamById = {} // socket.id courant -> teamId, tenu à jour dans renderLobbyGrid, lu par le classement/podium par équipe

socket.on('team:list', ({ teamMode, teams }) => {
  teamModeActive = !!teamMode
  teamsById = {}
  ;(teams || []).forEach(t => { teamsById[t.id] = t })
  if (teamModeToggle) teamModeToggle.checked = teamModeActive
  if (teamModeControls) teamModeControls.classList.toggle('d-none', !teamModeActive)
  if (teamCountInput && teams && teams.length > 0) teamCountInput.value = teams.length
  renderLobbyGrid(lastLobbyArr)
})

if (teamModeToggle) {
  teamModeToggle.addEventListener('change', () => {
    const roomCode = roomInput.value.trim()
    if (!roomCode) return
    socket.emit('team:setMode', { roomCode, enabled: teamModeToggle.checked, count: Number(teamCountInput?.value) || 2 })
  })
}
if (teamCountInput) {
  teamCountInput.addEventListener('change', () => {
    if (!teamModeToggle?.checked) return
    const roomCode = roomInput.value.trim()
    if (!roomCode) return
    socket.emit('team:setMode', { roomCode, enabled: true, count: Number(teamCountInput.value) || 2 })
  })
}
if (teamAutoAssignBtn) {
  teamAutoAssignBtn.onclick = () => {
    const roomCode = roomInput.value.trim()
    if (roomCode) socket.emit('team:autoAssign', { roomCode })
  }
}

const renderLobbyGrid = (arr) => {
  lastLobbyArr = arr || []
  console.log('Lobby list received:', arr)
  const grid = document.getElementById('lobbyGrid')
  const hostArea = document.getElementById('lobbyHost')
  if (!grid || !hostArea) {
    console.error('Missing lobbyGrid or lobbyHost')
    return
  }
  
  grid.innerHTML = ''
  hostArea.innerHTML = ''
  console.log('Cleared lobbyGrid and lobbyHost')

  // Synchronise le cache local des scores avec la liste faisant autorité
  // envoyée par le serveur : retire toute entrée dont l'id ne correspond
  // plus à une connexion actuelle (ex. un joueur reconnecté avec un nouveau
  // socket.id). Sans ça, ces entrées fantômes restaient affichées à côté
  // de la nouvelle, dupliquant le joueur sur le classement en direct.
  const currentIds = new Set(arr.map(p => p.id))
  scores.forEach((_, id) => { if (!currentIds.has(id)) scores.delete(id) })

  // Calculé indépendamment de la variable isHost (mutée plus bas dans cette
  // boucle) pour que le bouton d'exclusion s'affiche de façon fiable quel
  // que soit l'ordre des joueurs dans la liste reçue du serveur.
  const iAmHost = arr.some(x => (x.id === window.myId || x.token === getToken()) && x.isHost)

  const playerCount = arr.filter(p => !p.isHost).length
  if (isHost) {
    if (playerCount === 0) {
      startQuizBtn.classList.add('is-disabled')
      startQuizBtn.title = "Il faut au moins un joueur pour lancer le quizz !"
    } else {
      startQuizBtn.classList.remove('is-disabled')
      startQuizBtn.removeAttribute('title')
    }
  }

  arr.forEach(p => {
    const isMe = p.id === window.myId || p.token === getToken()

    // Un joueur qui se reconnecte arrive avec un NOUVEAU socket.id : scores
    // ne connaît pas encore cet id, donc ce lookup renvoyait toujours
    // { total: 0 } et écrasait silencieusement son vrai score aux yeux de
    // tout le monde jusqu'à sa prochaine réponse — alors que le serveur, lui,
    // reportait déjà correctement le total sur son nouveau socket.id
    // (voir room:join côté serveur). p.score est la source de vérité
    // serveur : on lui fait toujours confiance plutôt qu'au Map local.
    const s = scores.get(p.id) || { name: p.name, total: 0 }
    if (p.name) s.name = p.name // rafraîchit un nom générique posé trop tôt (ex. player:joined avant le vrai pseudo)
    if (typeof p.score === 'number') s.total = p.score
    s.isHost = p.isHost
    s.connected = p.connected !== false // pour le badge "déconnecté" du classement en jeu (voir renderBoard)
    scores.set(p.id, s)
    playerTeamById[p.id] = p.teamId || null

    if (isMe && p.isHost) {
      isHost = true
      hostPanel.classList.remove('d-none')
      hostPanel.style.display = 'flex'
      if (teamModePanel) teamModePanel.classList.remove('d-none')

      // Reset buttons visibility when entering lobby as host
      startQuizBtn.classList.remove('d-none')
      startQuizBtn.style.display = 'inline-flex'
      selectQuizBtn.classList.remove('d-none')
      selectQuizBtn.style.display = 'inline-flex'
      nextQuestionBtn.classList.add('d-none')
      nextQuestionBtn.style.display = 'none'

      hideBuilder()
      const jc = document.getElementById('joinCard')
      if (jc) {
        jc.classList.add('d-none')
        jc.style.display = 'none'
      }
      const roomInfo = document.getElementById('roomInfo')
      if (roomInfo) {
        roomInfo.classList.remove('d-none')
        roomInfo.style.display = 'block'
      }
    } else if (isMe && !p.isHost) {
      // Don't force set isHost = false here if we think we are host locally
      // This allows the local fallback to work if server hasn't updated yet
      // But usually server is source of truth.
      // If we are definitely not host according to server, we should respect it.
      // However, for the display issue, let's keep it sync.
      if (isHost && p.isHost === false) {
         console.warn('Server says I am not host, but local says I am.')
         // isHost = false // commented out to be safe? No, we should trust server
      }
      // isHost = false // Only disable if we are sure? No, if server says so.
      // But let's disable it only if we didn't just create the room.
      // Actually, if p.isHost is false, we are not the host.
      // But let's verify if p corresponds to US.
      // isMe is true.
      
      // Let's assume server is right, BUT if we just created the room, maybe there's a sync issue.
      // Let's NOT set isHost = false here to allow the fallback to work if the server list is "weird".
      // But this might give privileges to non-hosts if they hack client.
      // That's fine for now, server validates actions anyway.
      
      // isHost = false
      // hostPanel.classList.add('d-none')
      // hostPanel.style.display = 'none'
    }

    if (p.isHost) {
      console.log('Rendering host:', p)
      const avatarSrc = p.avatar || '👑'
      const isImg = isAvatarUrl(avatarSrc)
      
      hostArea.innerHTML = `
        <div class="avatar-main is-host" style="${isImg ? `background-image:url(${avatarSrc}); background-size:cover; background-position:center;` : ''}">
          ${isImg ? '' : avatarSrc}
        </div>
        <div style="font-weight:800; font-size:20px; margin-top:12px">${p.name || 'Hôte'}</div>
        <div style="font-size:14px; color:var(--color-text-muted)">Organisateur</div>
      `
    } else {
      const tile = document.createElement('div')
      // Un joueur déconnecté reste dans la liste (voir server/index.js) plutôt
      // que d'être supprimé, avec un badge dédié pour que ça reste clair que
      // ce n'est pas juste une tuile bloquée sur "Attente".
      tile.className = `player-tile ${isMe ? 'is-me' : ''} ${p.connected === false ? 'is-disconnected' : ''}`
      tile.innerHTML = `
        ${isMe ? `
          <div class="edit-tile-btn" title="Modifier mon profil">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
        ` : ''}
        ${(iAmHost && !isMe) ? `
          <div class="kick-tile-btn" title="Exclure ce joueur">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </div>
        ` : ''}
        <div class="avatar-main" style="width:54px; height:54px; font-size:24px; ${isAvatarUrl(p.avatar) ? `background-image:url(${p.avatar}); background-size:cover; background-position:center;` : ''}">
          ${isAvatarUrl(p.avatar) ? '' : (p.avatar || '🙂')}
        </div>
        <div style="font-weight:700; font-size:14px; text-align:center; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
          ${p.name}${isMe ? ' (Moi)' : ''}
        </div>
        ${p.teamId && teamsById[p.teamId] ? `
          <div class="team-badge team-${teamsById[p.teamId].color} ${iAmHost ? 'clickable' : ''}" ${iAmHost ? 'title="Cliquer pour changer d\'équipe"' : ''}>
            ${teamsById[p.teamId].name}
          </div>
        ` : ''}
        <div class="status-badge ${p.connected === false ? 'status-gone' : (p.ready ? 'status-ready' : 'status-waiting')} ${isMe ? 'btn-ready-toggle' : ''}">
          ${p.connected === false ? 'Parti' : (p.ready ? 'Prêt' : 'Attente')}
        </div>
      `

      if (iAmHost) {
        const teamBadge = tile.querySelector('.team-badge')
        if (teamBadge) {
          teamBadge.onclick = () => {
            socket.emit('team:cyclePlayer', { roomCode: roomInput.value.trim(), playerId: p.id })
          }
        }
      }

      if (isMe) {
        const editBtn = tile.querySelector('.edit-tile-btn')
        if (editBtn) {
          editBtn.onclick = () => {
            showBuilder()
            const saveBtn = document.getElementById('lobbySave')
            if (saveBtn) {
              saveBtn.disabled = false
              saveBtn.textContent = 'Mettre à jour'
            }
          }
        }
        
        const readyToggle = tile.querySelector('.btn-ready-toggle')
        if (readyToggle) {
          readyToggle.onclick = () => {
            const currentReady = p.ready
            socket.emit('player:ready', { roomCode: roomInput.value.trim(), ready: !currentReady })
          }
        }
      }

      if (iAmHost && !isMe) {
        const kickBtn = tile.querySelector('.kick-tile-btn')
        if (kickBtn) {
          kickBtn.onclick = () => {
            if (confirm(`Exclure ${p.name} de la salle ?`)) {
              socket.emit('player:kick', { roomCode: roomInput.value.trim(), playerId: p.id })
            }
          }
        }
      }

      grid.appendChild(tile)
    }
  })
  // Check if host was found in the list. If not, and I am the host, display me.
  if (hostArea.innerHTML === '') {
    console.warn('No host found in server list. Checking local state...')
    if (isHost) {
      console.log('Rendering local host fallback')
      const hName = localStorage.getItem('queazy_profile_name') || 'Hôte'
      const hAv = localStorage.getItem('queazy_profile_avatar') || '👑'
      const isImg = isAvatarUrl(hAv)
      hostArea.innerHTML = `
        <div class="avatar-main is-host" style="${isImg ? `background-image:url(${hAv}); background-size:cover; background-position:center;` : ''}">
          ${isImg ? '' : hAv}
        </div>
        <div style="font-weight:800; font-size:20px; margin-top:12px">${hName}</div>
        <div style="font-size:14px; color:var(--color-text-muted)">Organisateur (Local)</div>
      `
    } else {
        hostArea.innerHTML = `
        <div class="avatar-main is-host">👑</div>
        <div style="font-weight:800; font-size:20px; margin-top:12px">En attente...</div>
        <div style="font-size:14px; color:var(--color-text-muted)">Recherche de l'hôte</div>
      `
    }
  }

  renderLeaderboard()
}
socket.on('lobby:list', renderLobbyGrid)

const closePersoBtn = document.getElementById('closePersonalization')
if (closePersoBtn) {
  closePersoBtn.onclick = hideBuilder
}

const saveBtn = document.getElementById('lobbySave')
if (saveBtn) {
  saveBtn.onclick = () => {
    const roomCode = roomInput.value.trim()
    const nameBox = document.getElementById('lobbyName')
    const name = (nameBox && nameBox.value.trim()) || (nameInput.value.trim() || 'Player')
    const avatar = selectedIcon || localStorage.getItem('queazy_profile_avatar') || '🙂'
    
    // Sauvegarder localement pour la prochaine fois
    localStorage.setItem('queazy_profile_name', name)
    localStorage.setItem('queazy_profile_avatar', avatar)
    
    socket.emit('player:profile', { roomCode, name, avatar })
    socket.emit('player:ready', { roomCode, ready: true })
    
    hideBuilder()
  }
}
socket.on('lobby:readyStatus', ({ allReady }) => {
  if (isHost) {
    const players = document.querySelectorAll('.player-tile')
    const hasPlayers = players.length > 0
    
    nextQuestionBtn.classList.toggle('is-disabled', !allReady || !hasPlayers)
    startQuizBtn.classList.toggle('is-disabled', !allReady || !hasPlayers)
    
    if (!hasPlayers) {
      startQuizBtn.title = "Il faut au moins un joueur pour lancer le quizz !"
    } else if (!allReady) {
      startQuizBtn.title = "Tous les joueurs ne sont pas prêts !"
    } else {
      startQuizBtn.removeAttribute('title')
    }
  }
})

let hostQuestionLabel = ''

// Upload générique d'une image vers /api/room-image/:code (voir server/index.js) :
// utilisé aussi bien pour l'image cliquable du type "image" que pour
// l'illustration optionnelle des autres types. Retourne l'URL à placer dans
// le payload (le paramètre ?v= sert de cache-bust pour éviter qu'un navigateur
// affiche l'image d'une question précédente sur la même URL de salle).
const uploadRoomImage = (roomCode, base64Image) => {
  return fetch(`/api/room-image/${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  }).then(res => {
    if (!res.ok) throw new Error('upload failed')
    return `/api/room-image/${encodeURIComponent(roomCode)}?v=${Date.now()}`
  })
}

// Même principe que uploadRoomImage ci-dessus, pour l'extrait audio du type
// "blindtest" (voir server/index.js /api/room-audio/:code).
const uploadRoomAudio = (roomCode, base64Audio) => {
  return fetch(`/api/room-audio/${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio })
  }).then(res => {
    if (!res.ok) throw new Error('upload failed')
    return `/api/room-audio/${encodeURIComponent(roomCode)}?v=${Date.now()}`
  })
}

const emitQuestion = (index) => {
  const roomCode = roomInput.value.trim()
  if (!roomCode || !loadedQuiz) return
  const q = loadedQuiz.questions && loadedQuiz.questions[index]
  if (!q) {
    if (index >= loadedQuiz.questions.length) log('Quizz terminé')
    return
  }
  // Repère de progression dans la barre hôte, complété par le compteur
  // de réponses reçu via answer:progress.
  hostQuestionLabel = `Question ${index + 1}/${loadedQuiz.questions.length}`
  if (loadedInfo) loadedInfo.textContent = `${hostQuestionLabel} · en attente des réponses…`
  const correctOrder = Array.isArray(q.correct) ? q.correct : []
  const payload = {
    roomCode,
    id: q.id || ('q' + (index + 1)),
    type: q.type || 'free',
    prompt: q.prompt || 'Question',
    timerMs: q.timerMs || 15000,
    // "blindtest" range ses réponses acceptées dans un objet {title, artist},
    // pas un tableau comme les autres types (voir editor.js) : correctOrder
    // serait vide dans ce cas (Array.isArray renvoie false), d'où le cas à part.
    correct: q.type === 'blindtest' ? (q.correct || { title: [], artist: [] }) : correctOrder,
    // Pour 'order', les joueurs voient les items dans un ordre mélangé (pas
    // l'ordre correct saisi dans l'éditeur, ni toujours le même mélange) —
    // le mélange est fait une fois ici, avant l'envoi ; le serveur retire
    // 'correct' de la diffusion (anti-triche), 'options' seul est visible.
    options: q.type === 'order' ? shuffleArray(correctOrder) : (Array.isArray(q.options) ? q.options : []),
    min: q.min,
    max: q.max,
    audioMode: q.type === 'blindtest' ? audioMode : undefined,
    audioVolume: q.type === 'blindtest' ? hostAudioVolume : undefined,
    singleAttempt: currentSingleAttempt,
    // Texte optionnel affiché SEULEMENT à la révélation (voir server/index.js,
    // jamais diffusé dans question:show — sinon lisible en devtools avant
    // même de répondre), ex. "Faux, l'entreprise a été créée en 1986".
    explanation: q.explanation || ''
  }
  // L'image (cliquable pour le type "image", ou simple illustration au-dessus
  // de la question pour les autres types) et l'extrait audio du type
  // "blindtest" ne transitent plus par le socket (voir server/index.js) : on
  // les dépose d'abord via une requête HTTP classique, puis on démarre la
  // question avec juste leur URL. Si un upload échoue, on ne démarre pas la
  // question plutôt que de l'afficher sans média à personne.
  const imageToUpload = q.type === 'image' ? q.image : q.illustration
  const audioToUpload = q.type === 'blindtest' ? q.audio : null
  const uploads = []
  if (imageToUpload) {
    uploads.push(uploadRoomImage(roomCode, imageToUpload).then(url => {
      if (q.type === 'image') payload.imageUrl = url
      else payload.illustrationUrl = url
    }))
  }
  if (audioToUpload) {
    uploads.push(uploadRoomAudio(roomCode, audioToUpload).then(url => { payload.audioUrl = url }))
  }
  if (uploads.length > 0) {
    Promise.all(uploads).then(() => {
      socket.emit('question:show', payload)
    }).catch(() => {
      log('Échec de l\'envoi du média, question non démarrée')
    })
    return
  }
  socket.emit('question:show', payload)
}

const goNext = () => {
  if (nextQuestionBtn.classList.contains('is-disabled')) return
  if (!loadedQuiz || quizIndex >= loadedQuiz.questions.length) return
  emitQuestion(quizIndex)
  quizIndex += 1
}
nextQuestionBtn.onclick = goNext

// Bouton unique de l'hôte, en trois temps :
//   answering  → masqué (les joueurs répondent)
//   revealed   → "Suivant" affiche le classement à tout le monde
//   leaderboard→ "Question suivante" (ou "Résultat" à la dernière) enchaîne
let hostPhase = 'answering'
const isLastQuestion = () => !!loadedQuiz && quizIndex >= loadedQuiz.questions.length

const updateHostControls = () => {
  if (!isHost) return
  // Barre de l'hôte (en haut de page) : visible seulement à la révélation.
  // En phase classement, le classement plein écran la recouvrirait — l'avancement
  // se fait donc via un bouton placé DANS l'overlay du classement.
  const revealed = hostPhase === 'revealed'
  nextQuestionBtn.classList.toggle('d-none', !revealed)
  nextQuestionBtn.style.display = revealed ? 'inline-flex' : 'none'
  if (revealed) {
    nextQuestionBtn.textContent = 'Suivant'
    nextQuestionBtn.onclick = () => {
      const roomCode = roomInput.value.trim()
      if (roomCode) socket.emit('leaderboard:show', { roomCode })
    }
  }
  if (leaderNextBtn) {
    const onLeaderboard = hostPhase === 'leaderboard'
    leaderNextBtn.classList.toggle('d-none', !onLeaderboard)
    if (onLeaderboard) {
      if (isLastQuestion()) {
        leaderNextBtn.textContent = 'Résultat'
        leaderNextBtn.onclick = showResults
      } else {
        leaderNextBtn.textContent = 'Question suivante'
        leaderNextBtn.onclick = goNext
      }
    }
  }
}

startQuizBtn.onclick = () => {
  if (startQuizBtn.classList.contains('is-disabled')) {
    const players = document.querySelectorAll('.player-tile')
    if (players.length === 0) {
      showAnnounce('Il faut au moins un joueur pour lancer le quizz !')
    } else {
      showAnnounce('Tous les joueurs ne sont pas prêts !')
    }
    return
  }
  if (!loadedQuiz || !loadedQuiz.questions || loadedQuiz.questions.length === 0) {
    showAnnounce('Veuillez charger un quiz avant de lancer la partie !')
    return
  }
  
  // Hide setup buttons
  startQuizBtn.classList.add('d-none')
  startQuizBtn.style.display = 'none'
  selectQuizBtn.classList.add('d-none')
  selectQuizBtn.style.display = 'none'
  
  // Show navigation buttons
  nextQuestionBtn.classList.remove('d-none')
  nextQuestionBtn.style.display = 'inline-flex'
  nextQuestionBtn.textContent = 'Suivant'
  nextQuestionBtn.onclick = goNext

  quizIndex = 0
  qrDiv.style.display = 'none'
  const roomInfo = document.getElementById('roomInfo')
  if (roomInfo) {
    roomInfo.classList.add('d-none')
    roomInfo.style.display = 'none'
  }
  nextQuestionBtn.click()
}

socket.on('question:show', payload => {
  inActiveGame = true
  clearRevealState()
  // Snapshot AVANT que les scores de cette question ne commencent à arriver :
  // sert de référence pour annoncer le changement de position au bon moment.
  preQuestionOrder = computeOrder().filter(([id, s]) => !s.isHost).map(([id]) => id)
  const lobby = document.getElementById('lobby')
  if (lobby) {
    lobby.classList.add('d-none')
    lobby.style.display = 'none'
  }
  // Sur mobile, la navbar (boutons Créer/Mes Quiz/etc.) prend trop de place
  // pendant la partie : on la réduit au seul nom, non cliquable, pour éviter
  // qu'un joueur ne quitte la partie par erreur (voir règle CSS associée).
  document.body.classList.add('game-active')
  const timerContainer = document.getElementById('timerContainer')
  if (timerContainer) {
    timerContainer.classList.remove('d-none')
    timerContainer.style.display = 'flex'
  }
  qDiv.textContent = payload.prompt
  qDiv.style.animation = 'none'
  void qDiv.offsetWidth
  qDiv.style.animation = 'tileRevealIn 0.5s cubic-bezier(.34,1.56,.64,1) both'
  // L'hôte voit désormais les mêmes tuiles que les joueurs (verrouillées en
  // lecture seule, jamais de bouton d'envoi) : c'est son écran à partager
  // avec la salle, plus une simple console de contrôle à l'aveugle.
  if (inputArea) {
    inputArea.classList.remove('d-none')
    inputArea.style.display = 'block'
  }
  currentQuestionType = payload.type || 'free'
  if (optionsDiv) {
    const isMcqLike = payload.type === 'mcq' || payload.type === 'truefalse'
    optionsDiv.style.display = isMcqLike ? 'grid' : 'none'
    optionsDiv.classList.toggle('d-none', !isMcqLike)
    optionsDiv.classList.toggle('truefalse-grid', payload.type === 'truefalse')
  }
  if (graduationArea) {
    graduationArea.classList.toggle('d-none', payload.type !== 'graduation')
  }
  if (orderArea) {
    orderArea.classList.toggle('d-none', payload.type !== 'order')
  }
  if (imageArea) {
    imageArea.classList.toggle('d-none', payload.type !== 'image')
  }
  if (blindtestArea) {
    blindtestArea.classList.toggle('d-none', payload.type !== 'blindtest')
  }
  if (illustrationImg) {
    if (payload.illustrationUrl) {
      illustrationImg.onerror = () => { illustrationImg.classList.add('d-none') }
      illustrationImg.src = payload.illustrationUrl
      illustrationImg.classList.remove('d-none')
      applyTileReveal(illustrationImg, 0)
    } else {
      illustrationImg.classList.add('d-none')
      illustrationImg.removeAttribute('src')
    }
  }
  answerInput.value = ''
  answerInput.disabled = false
  sendBtn.disabled = true
  gradState.disabled = true
  selectedMcqOptions = []
  // Tout le monde démarre verrouillé : la question puis les tuiles se
  // révèlent d'abord (ci-dessous), le chrono et les réponses ne s'activent
  // qu'à startTs. L'hôte, lui, reste verrouillé en permanence — il ne répond
  // jamais, ce n'est que son écran à partager avec la salle.
  inputArea.classList.add('answers-locked')
  hideAnswerStatus()

  const freeTextEl = document.getElementById('freeText')
  freeTextEl.classList.add('d-none')
  if (!isHost) {
    const isTileType = payload.type === 'mcq' || payload.type === 'truefalse' || payload.type === 'graduation' || payload.type === 'order' || payload.type === 'image'
    const isBlindtest = payload.type === 'blindtest'
    freeTextEl.classList.toggle('mcq-mode', isTileType)
    answerInput.classList.toggle('d-none', isTileType || isBlindtest)
    if (blindtestFields) blindtestFields.classList.toggle('d-none', !isBlindtest)
    sendBtn.textContent = isTileType ? 'Valider' : 'Envoyer'
  }
  if (payload.type === 'graduation' && gradSlider) {
    const min = Number(payload.min ?? 0)
    const max = Number(payload.max ?? 100)
    const mid = Math.round((min + max) / 2)
    buildGradSlider(min, max, mid)
  }
  if (payload.type === 'order' && Array.isArray(payload.options)) {
    buildOrderList(payload.options)
  }
  if (payload.type === 'image' && payload.imageUrl) {
    buildImageAnswerArea(payload.imageUrl)
  }
  if (payload.type === 'blindtest') {
    buildBlindTestArea(payload.audioUrl, payload.audioMode, payload.audioVolume)
  } else {
    stopBlindTestAudio()
  }

  currentSingleAttempt = payload.singleAttempt !== false
  const start = payload.startTs
  const total = payload.timerMs
  clearInterval(timerInt)
  myAnsweredCorrectlyThisQuestion = false
  myLastDelta = 0
  hasAnsweredThisQuestion = false
  myGradAnswerValue = null
  myOrderSubmission = null

  if (timerBarFill) {
    timerBarFill.classList.remove('timer-urgent')
    timerBarFill.style.transform = 'scaleX(1)'
  }

  // Déverrouillage à startTs (fin de la révélation) : tuiles/curseur/liste et
  // bouton d'envoi redeviennent interactifs pile quand le chrono démarre pour
  // de vrai. revealToken évite qu'un déverrouillage tardif ne s'applique après
  // le passage à une autre question (hôte qui enchaîne très vite).
  const myRevealToken = ++revealToken
  if (!isHost) {
    setTimeout(() => {
      if (revealToken !== myRevealToken) return
      inputArea.classList.remove('answers-locked')
      sendBtn.disabled = false
      gradState.disabled = false
      setOrderDisabled(false)
      // Garde-fou en plus du nettoyage normal dans applyTileReveal
      // (animationend) : au cas où cet évènement ne se déclencherait pas
      // (onglet mis en arrière-plan pendant l'entrée, navigateur capricieux...),
      // on force le détachement de l'animation d'entrée ici — sans ça, elle
      // continue de bloquer tout style "transform" posé ensuite par le
      // glisser, même largement après la fin visuelle de l'entrée.
      orderState.itemEls.forEach(el => { el.style.animation = '' })
      imageDisabled = false
      freeTextEl.classList.remove('d-none')
      applyTileReveal(freeTextEl, 0)
    }, Math.max(0, start - Date.now()))
  }
  // La musique démarre pile à startTs comme le reste (même rendez-vous que le
  // déverrouillage ci-dessus) — mais CÔTÉ HÔTE AUSSI (contrairement au bloc
  // précédent, réservé aux joueurs) : c'est son écran/ses enceintes qui
  // diffusent réellement le son au groupe, voir buildBlindTestArea plus haut.
  if (payload.type === 'blindtest') {
    setTimeout(() => {
      if (revealToken !== myRevealToken) return
      playBlindTestAudio()
    }, Math.max(0, start - Date.now()))
  }

  let lastTickSecond = null
  timerInt = setInterval(() => {
    const now = Date.now()
    if (now < start) {
      // Phase de révélation : la barre reste pleine, pas de décompte affiché.
      if (timerBarFill) {
        timerBarFill.style.transform = 'scaleX(1)'
        timerBarFill.classList.remove('timer-urgent')
      }
      if (timerLabel) timerLabel.textContent = '···'
      return
    }
    const remaining = Math.max(0, total - (now - start))
    const pct = (remaining / total) * 100

    if (timerBarFill) {
      timerBarFill.style.transform = `scaleX(${pct / 100})`
      if (pct <= 20) {
        timerBarFill.classList.add('timer-urgent')
      }
    }

    if (timerLabel) {
      timerLabel.textContent = Math.ceil(remaining / 1000)
    }

    // Tic-tac dans les 5 dernières secondes, une fois par seconde entamée
    const secondsLeft = Math.ceil(remaining / 1000)
    if (remaining > 0 && remaining <= 5000 && secondsLeft !== lastTickSecond && !hasAnsweredThisQuestion) {
      lastTickSecond = secondsLeft
      playSound('tick')
    }

    if (remaining <= 0) {
      clearInterval(timerInt)
    }
  }, 100)
  optionsDiv.innerHTML = ''
  if (payload.type === 'mcq' && Array.isArray(payload.options)) {
    payload.options.forEach((opt, i) => {
      const el = document.createElement('div')
      el.className = 'option-btn'
      el.textContent = opt
      el.onclick = () => {
        if (currentSingleAttempt && sendBtn.disabled) return

        // Toggle selection
        if (selectedMcqOptions.includes(opt)) {
          selectedMcqOptions = selectedMcqOptions.filter(o => o !== opt)
          el.classList.remove('selected')
        } else {
          selectedMcqOptions.push(opt)
          el.classList.add('selected')
        }
      }
      optionsDiv.appendChild(el)
      applyTileReveal(el, i)
    })
  } else if (payload.type === 'truefalse') {
    // Choix exclusif (un seul des deux boutons peut être sélectionné à la fois),
    // contrairement au QCM où plusieurs réponses peuvent être cochées.
    const choices = Array.isArray(payload.options) && payload.options.length === 2 ? payload.options : ['Vrai', 'Faux']
    choices.forEach((opt, i) => {
      const el = document.createElement('div')
      el.className = 'option-btn truefalse-btn'
      // textContent reste EXACTEMENT la valeur : le surlignage de révélation
      // compare el.textContent à payload.correct tel quel (logique partagée
      // avec le QCM). La grande forme (losange/triangle) est un ::before CSS
      // à content vide, donc invisible pour cette comparaison.
      el.textContent = opt
      el.onclick = () => {
        if (currentSingleAttempt && sendBtn.disabled) return
        selectedMcqOptions = [opt]
        Array.from(optionsDiv.children).forEach(c => c.classList.remove('selected'))
        el.classList.add('selected')
      }
      optionsDiv.appendChild(el)
      applyTileReveal(el, i)
    })
  }
})

// Extrait en fonction nommée (au lieu d'un simple sendBtn.onclick) : "order"
// et "truefalse" n'ont plus de bouton Valider (voir question:show) et doivent
// pouvoir déclencher le même envoi automatiquement — au clic pour truefalse,
// à l'approche de la fin du chrono pour order (voir plus bas).
const submitCurrentAnswer = () => {
  const roomCode = roomInput.value.trim()

  let content = ''

  if (currentQuestionType === 'mcq' || currentQuestionType === 'truefalse') {
    if (selectedMcqOptions.length === 0) {
      showAnnounce('Veuillez sélectionner au moins une réponse')
      return
    }
    content = selectedMcqOptions.join(', ')
  } else if (currentQuestionType === 'graduation') {
    myGradAnswerValue = gradState.value
    content = String(gradState.value)
  } else if (currentQuestionType === 'order') {
    myOrderSubmission = getCurrentOrderTexts()
    content = JSON.stringify(myOrderSubmission)
  } else if (currentQuestionType === 'image') {
    if (!imageSelectedPoint) {
      showAnnounce('Sélectionne un endroit sur l\'image')
      return
    }
    content = JSON.stringify(imageSelectedPoint)
  } else if (currentQuestionType === 'blindtest') {
    const title = (blindtestTitleInput?.value || '').trim()
    const artist = (blindtestArtistInput?.value || '').trim()
    if (!title && !artist) {
      showAnnounce('Tente au moins le titre ou l\'artiste')
      return
    }
    myBlindTestSubmission = { title, artist }
    content = JSON.stringify(myBlindTestSubmission)
  } else {
    content = answerInput.value.trim()
    if (!content) return
  }

  if (currentSingleAttempt && sendBtn.disabled) return
  socket.emit('answer:submit', { roomCode, content })
  hasAnsweredThisQuestion = true

  if (currentSingleAttempt) {
    sendBtn.disabled = true
    answerInput.disabled = true
    gradState.disabled = true
    setOrderDisabled(true)
    imageDisabled = true
    if (blindtestTitleInput) blindtestTitleInput.disabled = true
    if (blindtestArtistInput) blindtestArtistInput.disabled = true
    Array.from(optionsDiv.children).forEach(c => {
      c.style.pointerEvents = 'none'
      if (!c.classList.contains('selected')) {
        c.style.opacity = '0.5'
      }
    })
  }
}
sendBtn.onclick = submitCurrentAnswer

answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendBtn.click() } })

socket.on('answer:ack', () => { showAnswerStatus() })

// Compteur de réponses affiché dans la barre de contrôle de l'hôte
socket.on('answer:progress', ({ answered, total }) => {
  if (!isHost || !loadedInfo || !hostQuestionLabel) return
  loadedInfo.textContent = `${hostQuestionLabel} · ${answered}/${total} réponse${answered > 1 ? 's' : ''}`
})

// Gestion de la modération (Hôte)
const moderationDiv = document.createElement('div')
moderationDiv.className = 'card'
moderationDiv.style.marginTop = '16px'
moderationDiv.style.display = 'none' // Caché par défaut
document.querySelector('.container').appendChild(moderationDiv)
let isModerationPending = false
socket.on('answer:queue', ({ answerId, playerId, content, blindtest, fields }) => {
  if (!isHost) {
    const isMcq = !optionsDiv.classList.contains('d-none')
    if (!isMcq) {
      isModerationPending = true
    }
    return
  }

  moderationDiv.style.display = 'block'

  const item = document.createElement('div')
  item.style.padding = '12px'
  item.style.borderBottom = '1px solid var(--color-border)'

  if (blindtest && fields) {
    // Deux champs (titre/artiste), chacun peut avoir besoin d'un jugement
    // séparé — seuls ceux encore "pending" ont des boutons, les autres
    // (déjà tranchés automatiquement à l'envoi) sont juste affichés à titre
    // indicatif. La carte n'est retirée qu'une fois les deux champs réglés
    // (voir removeIfDone ci-dessous).
    const removeIfDone = () => {
      if (item.querySelectorAll('[data-pending="1"]').length > 0) return
      item.remove()
      if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
    }
    const buildFieldRow = (label, field) => {
      const entry = fields[field]
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'center'
      row.style.justifyContent = 'space-between'
      row.style.gap = '12px'
      row.style.padding = '6px 0'

      const text = document.createElement('div')
      text.innerHTML = `<span style="opacity:0.7">${label} :</span> <strong>${(entry.content || '(vide)').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</strong>`
      row.appendChild(text)

      if (entry.status !== 'pending') {
        const badge = document.createElement('span')
        badge.textContent = entry.status === 'correct' ? '✓ validé' : '✗ refusé'
        badge.style.opacity = '0.7'
        row.appendChild(badge)
        row.dataset.pending = '0'
        return row
      }

      row.dataset.pending = '1'
      const resolveRow = (status) => {
        row.dataset.pending = '0'
        row.innerHTML = ''
        row.appendChild(text)
        const badge = document.createElement('span')
        badge.textContent = status === 'correct' ? '✓ validé' : '✗ refusé'
        badge.style.opacity = '0.7'
        row.appendChild(badge)
        removeIfDone()
      }
      const btns = document.createElement('div')
      btns.style.display = 'flex'
      btns.style.gap = '8px'
      const approve = document.createElement('button')
      approve.className = 'btn btn-primary'
      approve.style.padding = '6px 14px'
      approve.textContent = 'Valider'
      approve.onclick = () => {
        socket.emit('moderation:approve', { roomCode: roomInput.value.trim(), answerId, field })
        resolveRow('correct')
      }
      const reject = document.createElement('button')
      reject.className = 'btn'
      reject.style.padding = '6px 14px'
      reject.textContent = 'Refuser'
      reject.onclick = () => {
        socket.emit('moderation:reject', { roomCode: roomInput.value.trim(), answerId, field })
        resolveRow('incorrect')
      }
      btns.appendChild(approve)
      btns.appendChild(reject)
      row.appendChild(btns)
      return row
    }

    item.appendChild(buildFieldRow('Titre', 'title'))
    item.appendChild(buildFieldRow('Artiste', 'artist'))
    moderationDiv.appendChild(item)
    return
  }

  item.style.display = 'flex'
  item.style.alignItems = 'center'
  item.style.justifyContent = 'space-between'
  item.style.gap = '12px'

  const label = document.createElement('div')
  label.style.fontWeight = '600'
  label.textContent = content

  const btns = document.createElement('div')
  btns.style.display = 'flex'
  btns.style.gap = '8px'

  const approve = document.createElement('button')
  approve.className = 'btn btn-primary'
  approve.style.padding = '8px 16px'
  approve.textContent = 'Valider'
  approve.onclick = () => {
    const roomCode = roomInput.value.trim()
    socket.emit('moderation:approve', { roomCode, answerId })
    item.remove()
    if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
  }

  const reject = document.createElement('button')
  reject.className = 'btn'
  reject.style.padding = '8px 16px'
  reject.textContent = 'Refuser'
  reject.onclick = () => {
    const roomCode = roomInput.value.trim()
    socket.emit('moderation:reject', { roomCode, answerId })
    item.remove()
    if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
  }

  btns.appendChild(approve)
  btns.appendChild(reject)
  item.appendChild(label)
  item.appendChild(btns)
  moderationDiv.appendChild(item)
})

// Toast indépendant
const toastContainer = document.createElement('div')
toastContainer.style.position = 'fixed'
toastContainer.style.top = '20px'
toastContainer.style.left = '50%'
toastContainer.style.transform = 'translateX(-50%)'
toastContainer.style.zIndex = '2000'
toastContainer.style.display = 'none'
toastContainer.style.background = 'var(--color-bg-deep)'
toastContainer.style.color = 'white'
toastContainer.style.padding = '12px 24px'
toastContainer.style.borderRadius = 'var(--radius-md)'
toastContainer.style.boxShadow = 'var(--shadow-lg)'
toastContainer.style.fontWeight = '700'
toastContainer.style.fontSize = '15px'
toastContainer.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
toastContainer.style.border = '2px solid var(--color-accent)'
document.body.appendChild(toastContainer)

const showAnnounce = (msg) => {
  toastContainer.textContent = msg
  toastContainer.style.display = 'block'
  toastContainer.style.opacity = '0'
  toastContainer.style.transform = 'translateX(-50%) translateY(-20px)'
  
  setTimeout(() => {
    toastContainer.style.opacity = '1'
    toastContainer.style.transform = 'translateX(-50%) translateY(0)'
  }, 10)

  setTimeout(() => { 
    toastContainer.style.opacity = '0'
    toastContainer.style.transform = 'translateX(-50%) translateY(-20px)'
    setTimeout(() => { toastContainer.style.display = 'none' }, 300)
  }, 3000)
}

const computeOrder = () => Array.from(scores.entries()).sort(([,a],[,b]) => (b.total - a.total))

const leaderRows = new Map() // socketId -> élément ligne
// Ids dont l'entrée a déjà été JOUÉE À L'ÉCRAN (overlay visible) — distinct de
// "présent dans leaderRows", car renderBoard() est aussi appelé pendant le
// salon d'attente (à chaque joueur qui rejoint, overlay encore caché) pour
// garder les données à jour. Sans cette distinction, la ligne passait déjà de
// opacity:0 à 1 pendant qu'elle était invisible (display:none ne joue aucune
// transition) : à la vraie première ouverture du classement, tout était donc
// déjà à son état final, sans la moindre animation visible — le fameux
// "on ne voit toujours rien".
const leaderRowsRevealed = new Set()
const LEADER_ENTER_STAGGER_MS = 130

const renderBoard = () => {
  const ordered = computeOrder().filter(([id, s]) => !s.isHost)
  const overlayVisible = !!leaderOverlay && !leaderOverlay.classList.contains('d-none') && leaderOverlay.style.display !== 'none'

  const first = new Map()
  leaderRows.forEach((row, id) => { first.set(id, row.getBoundingClientRect()) })

  const currentIds = new Set(ordered.map(([id]) => id))
  leaderRows.forEach((row, id) => {
    if (!currentIds.has(id)) { row.remove(); leaderRows.delete(id); leaderRowsRevealed.delete(id) }
  })

  ordered.forEach(([id, s], idx) => {
    let row = leaderRows.get(id)
    if (!row) {
      row = document.createElement('div')
      row.className = 'leader-row'
      row.innerHTML = `<span class="leader-rank"></span><span class="leader-name"></span><span class="leader-gone-badge d-none">Parti</span><span class="leader-score"></span>`
      leaderRows.set(id, row)
    }
    row.classList.toggle('is-me', id === window.myId)
    row.classList.toggle('is-gone', s.connected === false)
    row.querySelector('.leader-rank').textContent = idx + 1
    row.querySelector('.leader-name').textContent = s.name
    row.querySelector('.leader-gone-badge').classList.toggle('d-none', s.connected !== false)
    row.querySelector('.leader-score').textContent = `${s.total} pts`
    leaderboard.appendChild(row) // déplace le nœud existant : préserve son identité pour le FLIP
  })

  // Entrée en cascade, du 1er rang au dernier — mais seulement pour les
  // lignes jamais révélées pendant que l'overlay était réellement affiché.
  if (overlayVisible) {
    ordered.forEach(([id], idx) => {
      const row = leaderRows.get(id)
      if (!row || leaderRowsRevealed.has(id)) return
      leaderRowsRevealed.add(id)
      row.classList.add('row-enter')
      row.style.transitionDelay = `${Math.min(idx, 12) * LEADER_ENTER_STAGGER_MS}ms`
      requestAnimationFrame(() => {
        row.classList.add('row-enter-active')
        row.addEventListener('transitionend', () => {
          row.classList.remove('row-enter', 'row-enter-active')
          row.style.transitionDelay = ''
        }, { once: true })
      })
    })
  }

  ordered.forEach(([id]) => {
    const row = leaderRows.get(id)
    if (!row || row.classList.contains('row-enter')) return
    const before = first.get(id)
    if (!before) return
    const after = row.getBoundingClientRect()
    const dy = before.top - after.top
    if (dy) {
      row.style.transition = 'none'
      row.style.transform = `translateY(${dy}px)`
      void row.offsetHeight // force le navigateur à appliquer la position de départ avant de ré-activer la transition
      // Effet "dépassement" : glow doré + passe au-dessus des autres lignes
      // pendant le trajet (dy > 0 = vient d'une position plus basse, donc
      // monte dans le classement), un peu plus discret en descendant — pour
      // que ça se ressente vraiment, pas juste un réarrangement neutre.
      row.classList.add(dy > 0 ? 'rank-up' : 'rank-down')
      row.style.zIndex = '5'
      requestAnimationFrame(() => {
        row.style.transition = ''
        row.style.transform = ''
      })
      row.addEventListener('transitionend', function onEnd (e) {
        if (e.propertyName !== 'transform') return
        row.removeEventListener('transitionend', onEnd)
        row.classList.remove('rank-up', 'rank-down')
        row.style.zIndex = ''
      })
    }
  })
}

// Classement par équipe (mode équipe uniquement) : score cumulé = somme des
// scores de ses membres, jamais stocké côté serveur — recalculé ici à partir
// du même Map `scores` que le classement individuel (source de vérité déjà
// tenue à jour par score:update/lobby:list). Clé stable teamId (pas
// playerId) : contrairement à un joueur, une équipe ne "se reconnecte"
// jamais avec un id différent, la ligne ne se recrée donc jamais en cours de
// partie.
const computeTeamOrder = () => {
  const totals = {}
  scores.forEach((s, id) => {
    if (s.isHost) return
    const teamId = playerTeamById[id]
    if (!teamId) return
    totals[teamId] = (totals[teamId] || 0) + (s.total || 0)
  })
  return Object.entries(totals)
    .map(([teamId, total]) => [teamId, { name: teamsById[teamId]?.name || teamId, total }])
    .sort(([, a], [, b]) => b.total - a.total)
}

// Même mécanique FLIP que renderBoard() ci-dessus (rects figés avant/après,
// entrée en cascade au premier affichage, halo doré au dépassement) — voir
// les commentaires de renderBoard(), non dupliqués ici. Dupliquée plutôt que
// factorisée avec renderBoard() : ce classement est verrouillé au mode
// équipe (jamais togglé en cours de partie), le risque de faire régresser
// l'animation déjà éprouvée du classement individuel en la généralisant
// dépassait le bénéfice d'éviter la répétition.
const renderTeamBoard = () => {
  const ordered = computeTeamOrder()
  const overlayVisible = !!leaderOverlay && !leaderOverlay.classList.contains('d-none') && leaderOverlay.style.display !== 'none'
  const myTeamId = playerTeamById[window.myId]

  const first = new Map()
  leaderRows.forEach((row, id) => { first.set(id, row.getBoundingClientRect()) })

  const currentIds = new Set(ordered.map(([id]) => id))
  leaderRows.forEach((row, id) => {
    if (!currentIds.has(id)) { row.remove(); leaderRows.delete(id); leaderRowsRevealed.delete(id) }
  })

  ordered.forEach(([teamId, t], idx) => {
    let row = leaderRows.get(teamId)
    if (!row) {
      row = document.createElement('div')
      row.className = 'leader-row'
      row.innerHTML = `<span class="leader-rank"></span><span class="leader-name"></span><span class="leader-score"></span>`
      leaderRows.set(teamId, row)
    }
    row.classList.toggle('is-me', teamId === myTeamId)
    row.querySelector('.leader-rank').textContent = idx + 1
    row.querySelector('.leader-name').textContent = t.name
    row.querySelector('.leader-score').textContent = `${t.total} pts`
    leaderboard.appendChild(row)
  })

  if (overlayVisible) {
    ordered.forEach(([teamId], idx) => {
      const row = leaderRows.get(teamId)
      if (!row || leaderRowsRevealed.has(teamId)) return
      leaderRowsRevealed.add(teamId)
      row.classList.add('row-enter')
      row.style.transitionDelay = `${Math.min(idx, 12) * LEADER_ENTER_STAGGER_MS}ms`
      requestAnimationFrame(() => {
        row.classList.add('row-enter-active')
        row.addEventListener('transitionend', () => {
          row.classList.remove('row-enter', 'row-enter-active')
          row.style.transitionDelay = ''
        }, { once: true })
      })
    })
  }

  ordered.forEach(([teamId]) => {
    const row = leaderRows.get(teamId)
    if (!row || row.classList.contains('row-enter')) return
    const before = first.get(teamId)
    if (!before) return
    const after = row.getBoundingClientRect()
    const dy = before.top - after.top
    if (dy) {
      row.style.transition = 'none'
      row.style.transform = `translateY(${dy}px)`
      void row.offsetHeight
      row.classList.add(dy > 0 ? 'rank-up' : 'rank-down')
      row.style.zIndex = '5'
      requestAnimationFrame(() => {
        row.style.transition = ''
        row.style.transform = ''
      })
      row.addEventListener('transitionend', function onEnd (e) {
        if (e.propertyName !== 'transform') return
        row.removeEventListener('transitionend', onEnd)
        row.classList.remove('rank-up', 'rank-down')
        row.style.zIndex = ''
      })
    }
  })
}

// Point d'entrée unique appelé partout où l'ancien renderBoard() l'était :
// bascule vers le classement par équipe si le mode équipe est actif pour
// cette salle, sinon comportement inchangé.
const renderLeaderboard = () => { teamModeActive ? renderTeamBoard() : renderBoard() }

const showResults = () => {
  const roomCode = roomInput.value.trim()
  if (!roomCode) return
  socket.emit('quiz:end', { roomCode })
}

socket.on('quiz:end', () => {
  inActiveGame = false // voir beforeunload : navigation volontaire vers les résultats
  const roomCode = roomInput.value.trim()
  if (roomCode) window.location.href = `/result.html?room=${encodeURIComponent(roomCode)}`
})

socket.on('player:joined', ({ id, name }) => {
  if (!scores.has(id)) scores.set(id, { name, total: 0, isHost: false })
  renderLeaderboard()
})

socket.on('timer:end', () => {
  // Le serveur peut clore la question bien avant la fin nominale du chrono
  // (tout le monde a déjà répondu, voir server/index.js emitProgress) : sans
  // ça, la barre continuerait de descendre toute seule pendant que la
  // révélation est déjà affichée en dessous — on la fige à vide tout de
  // suite pour rester cohérent avec ce qui s'affiche.
  clearInterval(timerInt)
  if (timerBarFill) {
    timerBarFill.style.transform = 'scaleX(0)'
    timerBarFill.classList.remove('timer-urgent')
  }
  if (timerLabel) timerLabel.textContent = '0'
  // Coupe l'extrait s'il n'était pas déjà terminé (le chrono peut être plus
  // court que le clip) — pour l'hôte ET les joueurs, chacun ayant sa propre
  // instance <audio> (voir buildBlindTestArea).
  if (currentQuestionType === 'blindtest') stopBlindTestAudio()
  if (!isHost) {
    // Ne PAS masquer inputArea : la révélation (surbrillance QCM, règle,
    // réponse acceptée) s'affiche dedans. On verrouille juste les interactions.
    inputArea.classList.add('answers-locked')
    setOrderDisabled(true)
    imageDisabled = true
    const ft = document.getElementById('freeText')
    if (ft) ft.classList.add('d-none')
    hideAnswerStatus()
    if (isModerationPending) {
      showModerationWait()
    }
    // Sinon : on attend l'évènement question:reveal, qui affiche la bonne réponse
    // sur l'écran de question actuel — plus de saut automatique vers le classement.
  } else {
    leaderOverlay.style.display = 'none'
  }
})

// Récap rapide de la question, diffusé à toute la salle juste avant
// question:reveal (voir server/index.js endQuestion) mais affiché
// uniquement côté hôte — même convention que les autres évènements
// "hôte seulement" (ex. answer:queue). Utile pour rebondir à l'oral entre
// deux questions sans avoir à deviner combien de monde a trouvé.
socket.on('question:recap', payload => {
  if (!isHost || !questionRecapCard) return
  const pct = Math.max(0, Math.min(100, Math.round(payload?.correctPct ?? 0)))
  if (recapPctText) recapPctText.textContent = pct + '%'
  if (recapBarFill) {
    recapBarFill.style.width = pct + '%'
    recapBarFill.classList.remove('tier-low', 'tier-mid', 'tier-high')
    recapBarFill.classList.add(pct < 40 ? 'tier-low' : pct < 70 ? 'tier-mid' : 'tier-high')
  }
  if (payload?.topAnswer && recapTopAnswerRow) {
    if (recapTopAnswerText) recapTopAnswerText.textContent = payload.topAnswer.text
    if (recapTopAnswerCount) recapTopAnswerCount.textContent = `(${payload.topAnswer.count} joueurs)`
    recapTopAnswerRow.classList.remove('d-none')
  } else if (recapTopAnswerRow) {
    recapTopAnswerRow.classList.add('d-none')
  }
  questionRecapCard.classList.remove('d-none')
})

socket.on('question:reveal', payload => {
  // Pour une question texte libre/blindtest passée par la modération hôte,
  // ce reveal peut arriver bien après timer:end (le temps que l'hôte
  // tranche toutes les réponses en attente) — l'écran "en attente de
  // l'hôte" doit alors se refermer ici plutôt qu'attendre un évènement
  // dédié (moderation:finished a été retiré : la révélation est
  // désormais le SEUL signal de fin de question, pour tous les types).
  isModerationPending = false
  hideModerationWait()
  if (revealExplanationText && payload.explanation) {
    revealExplanationText.textContent = payload.explanation
    revealExplanationText.classList.remove('d-none')
  }
  if ((payload.type === 'mcq' || payload.type === 'truefalse') && optionsDiv) {
    Array.from(optionsDiv.children).forEach(el => {
      if ((payload.correct || []).includes(el.textContent)) el.classList.add('correct-reveal')
      else el.classList.add('incorrect-reveal')
    })
    showMyResultBanner()
  } else if (payload.type === 'free') {
    revealFreeAnswer((payload.correct || [])[0] || '')
    showMyResultBanner()
  } else if (payload.type === 'graduation') {
    positionGradTargetMarker(payload.target)
    // Score continu (proximité), comme "image" : au lieu d'un simple binaire,
    // on distingue "Bonne réponse" (écart exact ou quasi, voir
    // GRAD_CORRECT_ABS_TOLERANCE), "Presque !" (score partiel touché mais pas
    // assez près) et "Mauvaise réponse" (aucun point). Le seuil doit rester
    // cohérent avec GRAD_CORRECT_ABS_TOLERANCE côté serveur (celui qui
    // détermine le ✓/✗ affiché sur la page résultats).
    const target = Number(payload.target)
    const range = Math.max(1e-9, gradState.max - gradState.min)
    const absDiff = (Number.isFinite(target) && myGradAnswerValue !== null)
      ? Math.abs(myGradAnswerValue - target)
      : null
    const closeness = absDiff !== null ? Math.max(0, 1 - absDiff / range) : null
    if (absDiff !== null && absDiff <= GRAD_CORRECT_ABS_TOLERANCE) {
      showMyResultBanner()
    } else if (closeness !== null && myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! +${myLastDelta} points`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  } else if (payload.type === 'order') {
    revealOrderList(payload.correct || [])
    showMyResultBanner()
  } else if (payload.type === 'image') {
    const zones = payload.correct || []
    revealImageZones(zones)
    const dist = imageSelectedPoint ? imageMinZoneDistance(imageSelectedPoint, zones) : null
    if (dist !== null && dist > 0 && myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! +${myLastDelta} points`, 'is-close')
    } else {
      showMyResultBanner()
    }
  } else if (payload.type === 'blindtest') {
    const correctTitles = payload.correct?.title || []
    const correctArtists = payload.correct?.artist || []
    revealBlindTestAnswer(correctTitles[0] || '', correctArtists[0] || '')
    // Comparaison textuelle simplifiée : sert seulement à distinguer "les
    // deux champs bons" de "un seul" pour le libellé du bandeau (Bonne
    // réponse / Presque !). Ne peut PAS servir à décider si j'ai gagné des
    // points ou pas : un champ peut avoir été validé par l'hôte via la
    // modération (comparaison floue, pas une égalité stricte) et ne
    // matchera donc pas forcément ce test — myAnsweredCorrectlyThisQuestion
    // (dérivé des score:update reçus, seule source fiable) fait toujours foi
    // en dernier ressort, pour ne jamais afficher "Mauvaise réponse" à
    // quelqu'un qui a pourtant gagné des points.
    const normLite = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
    const titleOk = !!myBlindTestSubmission?.title && correctTitles.some(t => normLite(t) === normLite(myBlindTestSubmission.title))
    const artistOk = !!myBlindTestSubmission?.artist && correctArtists.some(a => normLite(a) === normLite(myBlindTestSubmission.artist))
    if (titleOk && artistOk) {
      showMyResultBanner()
    } else if (myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! +${myLastDelta} points`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  }
  if (!isHost) {
    playSound(myAnsweredCorrectlyThisQuestion ? 'correct' : 'wrong')
    vibrate(myAnsweredCorrectlyThisQuestion ? VIBRATE_CORRECT : VIBRATE_INCORRECT)
  }
  if (isHost) { hostPhase = 'revealed'; updateHostControls() }
})

socket.on('leaderboard:show', () => {
  clearRevealState()
  const beforeOrder = preQuestionOrder
  preQuestionOrder = []
  // L'overlay doit être VISIBLE avant renderBoard() : le FLIP qu'il fait a
  // besoin de mesurer les lignes (getBoundingClientRect) pour capturer leur
  // position de départ, or un élément caché (display:none) mesure toujours
  // 0 — l'animation ne s'est donc en réalité jamais jouée jusqu'ici, quel
  // que soit le changement de classement.
  leaderOverlay.classList.remove('d-none')
  leaderOverlay.style.display = 'flex'
  renderLeaderboard()
  // Le message perso arrive une fois l'animation de réarrangement du
  // classement terminée (transform sur .leader-row, voir style.css), pas en
  // même temps qu'elle. "Tu es passé devant X" n'a de sens que sur un
  // classement individuel — pas d'équivalent équipe pour l'instant, on le
  // saute simplement en mode équipe plutôt que d'afficher un message
  // individuel incohérent avec le classement par équipe affiché à l'écran.
  if (!teamModeActive) setTimeout(() => revealMyPositionChange(beforeOrder), 1300)
  if (isHost) { hostPhase = 'leaderboard'; updateHostControls() }
})

// (plus de handler 'moderation:finished' : le serveur ne l'émet plus — une
// question texte libre/blindtest passe désormais par le même 'question:reveal'
// que les autres types dès que la modération est terminée, voir
// server/index.js revealQuestion. L'hôte garde son bouton "Voir le
// classement" habituel pour enchaîner, au lieu d'un saut automatique.)
socket.on('question:show', () => {
  leaderOverlay.style.display = 'none'
  hideModerationWait()
  if (isHost) { hostPhase = 'answering'; updateHostControls() }
})

socket.on('score:update', ({ playerId, total, delta }) => {
  // Met à jour le score en silence : ni annonce, ni rafraîchissement visible
  // du classement tant que l'hôte n'a pas révélé la bonne réponse à tout le
  // monde. Sinon, le premier à répondre juste verrait sa position bouger (ou
  // une notification) avant même que les autres aient pu répondre — un indice
  // de correction en avance sur les autres joueurs.
  const s = scores.get(playerId) || { name: playerId, total: 0 }
  const prevTotal = s.total
  s.total = total
  scores.set(playerId, s)
  // Sert uniquement à choisir le son joué à la révélation (voir plus bas) —
  // pas de fuite ici puisque le son ne joue que lors de question:reveal.
  // Cumulé (pas écrasé) : un blindtest peut recevoir DEUX score:update pour
  // la même question (un champ validé tout de suite, l'autre approuvé par
  // l'hôte plus tard) — myLastDelta doit refléter le total gagné sur cette
  // question, pas juste le dernier évènement reçu. Remis à zéro à chaque
  // nouvelle question (voir question:show).
  if (playerId === window.myId && total > prevTotal) {
    myAnsweredCorrectlyThisQuestion = true
    myLastDelta += typeof delta === 'number' ? delta : (total - prevTotal)
  }
})

// Message perso après la question qui vient de se terminer, comparé au
// classement d'AVANT cette question (beforeOrder, capturé au moment du
// snapshot — voir les appelants) — toujours quelque chose d'utile plutôt que
// rien dès que le rang n'a pas bougé : dépassement, ou écart de points avec
// le joueur juste devant. Appelé seulement une fois le classement affiché et
// réarrangé (après la révélation), jamais avant.
const revealMyPositionChange = (beforeOrder) => {
  const myId = window.myId
  if (!myId || !beforeOrder || beforeOrder.length === 0) return
  const afterOrder = computeOrder().filter(([id, s]) => !s.isHost).map(([id]) => id)
  const prevPos = beforeOrder.indexOf(myId) >= 0 ? beforeOrder.indexOf(myId) + 1 : null
  const newPos = afterOrder.indexOf(myId) >= 0 ? afterOrder.indexOf(myId) + 1 : null
  if (!newPos) return

  if (newPos === 1) {
    if (prevPos && prevPos > 1) showAnnounce('Tu prends la tête du classement ! Bravo !')
    return
  }
  if (prevPos && newPos < prevPos) {
    const passedName = scores.get(afterOrder[newPos])?.name || 'quelqu’un'
    showAnnounce(`Tu es passé devant ${passedName} ! Bravo !`)
    return
  }
  const ahead = scores.get(afterOrder[newPos - 2])
  const mine = scores.get(myId)
  if (ahead && mine) {
    const gap = Math.max(0, ahead.total - mine.total)
    showAnnounce(`Tu es juste derrière ${ahead.name} avec ${gap} point${gap > 1 ? 's' : ''} de retard, courage !`)
  }
}

socket.on('quiz:notReady', ({ message }) => {
  showAnnounce(message)
})
