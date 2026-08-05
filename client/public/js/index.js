const socket = io()

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
const orderArea = document.getElementById('orderArea')
const orderList = document.getElementById('orderList')
const imageArea = document.getElementById('imageArea')
const imageWrap = document.getElementById('imageWrap')
const imageImg = document.getElementById('imageImg')
const imageClickLayer = document.getElementById('imageClickLayer')
const imageMarker = document.getElementById('imageMarker')
const imageZonesReveal = document.getElementById('imageZonesReveal')
const imageErrorMsg = document.getElementById('imageErrorMsg')
// Illustration optionnelle (tous les types SAUF "image", qui affiche déjà sa
// propre image cliquable via imageWrap/imageImg ci-dessus) : simple photo
// décorative au-dessus de l'énoncé.
const illustrationImg = document.getElementById('illustrationImg')
const logDiv = document.getElementById('log')
const nextQuestionBtn = document.getElementById('nextQuestion')
const prevQuestionBtn = document.getElementById('prevQuestion')
const leaderNextBtn = document.getElementById('leaderNextBtn')
const startQuizBtn = document.getElementById('startQuiz')
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
}

// --- Curseur classique sur piste : les bornes min/max sont les deux bouts
// physiques de la piste (toujours visibles), donc jamais ambiguës — remplace
// l'ancienne règle à viseur fixe/graduation défilante. ---
const gradState = { min: 0, max: 100, value: 50, disabled: false }
// Doit rester cohérent avec GRAD_CORRECT_THRESHOLD dans server/index.js — sert
// uniquement à choisir le message de reveal ("Bonne réponse" vs "Presque !"),
// le scoring lui-même reste le calcul de proximité continu côté serveur.
const GRAD_CORRECT_THRESHOLD = 0.8

const setGradValue = (v, animate) => {
  const clamped = Math.min(gradState.max, Math.max(gradState.min, Math.round(v)))
  gradState.value = clamped
  const pct = gradState.max === gradState.min ? 0 : (clamped - gradState.min) / (gradState.max - gradState.min) * 100
  if (gradValueReadout) gradValueReadout.textContent = clamped
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
  setGradValue(value)
  if (gradMinLabel) gradMinLabel.textContent = min
  if (gradMaxLabel) gradMaxLabel.textContent = max
  applyTileReveal(gradSlider, 0)
}

if (gradSlider) {
  let dragging = false
  const setFromClientX = (clientX) => {
    const r = gradSlider.getBoundingClientRect()
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
}

// --- Liste réordonnable (question "order") ---
// SortableJS (chargé en CDN, voir index.html) plutôt qu'une implémentation
// maison au pointeur : animation fluide/organique "gratuite" (chaque tuile
// suit le doigt/la souris en continu, les autres glissent pour faire de la
// place), avec un vrai support tactile éprouvé. dataIdAttr utilise le texte
// de chaque tuile comme identifiant stable (déjà supposé unique ailleurs
// dans ce fichier) — sert à demander un tri animé vers l'ordre correct au
// reveal via sortable.sort(...).
let orderDisabled = false
const orderState = { itemEls: [], sortable: null }
// Garde orderState.sortable.option('disabled', ...) synchronisé avec le
// simple booléen orderDisabled utilisé partout ailleurs dans ce fichier.
const setOrderDisabled = (v) => {
  orderDisabled = v
  if (orderState.sortable) orderState.sortable.option('disabled', v)
}

const getCurrentOrderTexts = () => Array.from(orderList.children).map(el => el.dataset.text)

const buildOrderList = (items) => {
  if (!orderList) return
  orderList.innerHTML = ''
  orderState.itemEls = []
  orderDisabled = true

  items.forEach((text, uid) => {
    const el = document.createElement('div')
    el.className = 'order-item'
    el.dataset.text = text
    el.innerHTML = `<span class="order-item-handle">⠿</span><span class="order-item-text"></span><span class="order-item-mybadge d-none"></span>`
    el.querySelector('.order-item-text').textContent = text
    orderList.appendChild(el)
    orderState.itemEls.push(el)
    applyTileReveal(el, uid)
  })

  if (orderState.sortable) { orderState.sortable.destroy(); orderState.sortable = null }
  if (window.Sortable) {
    orderState.sortable = window.Sortable.create(orderList, {
      animation: 250,
      easing: 'cubic-bezier(.22,1,.36,1)',
      disabled: true, // se débloque à startTs, comme avant (voir question:show)
      dataIdAttr: 'data-text',
      ghostClass: 'order-item-ghost',
      chosenClass: 'order-item-chosen',
      dragClass: 'order-item-drag'
    })
  }
}

// Révélation : la liste se réarrange dans l'ordre correct (le score déjà
// attribué est "tout ou rien", donc pas de distinction case par case sur la
// couleur) — mais chaque tuile affiche en plus un badge "Toi : #N" indiquant
// la position que CE joueur avait donnée à cet élément, pour comparer les
// deux d'un coup d'œil plutôt que de perdre sa propre réponse au reveal.
const revealOrderList = (correctOrder) => {
  if (!orderState.itemEls.length) return
  setOrderDisabled(true)
  // sort(ids, useAnimation) : SortableJS anime lui-même le réarrangement vers
  // l'ordre correct (même mécanisme FLIP que le glisser, "gratuit").
  if (orderState.sortable && Array.isArray(correctOrder) && correctOrder.length === orderState.itemEls.length) {
    orderState.sortable.sort(correctOrder, true)
  }
  orderState.itemEls.forEach(el => {
    el.classList.add('correct-reveal')
    const badge = el.querySelector('.order-item-mybadge')
    if (!badge || !myOrderSubmission) return
    const myPos = myOrderSubmission.indexOf(el.dataset.text)
    if (myPos === -1) return
    const correctPos = correctOrder.indexOf(el.dataset.text)
    badge.textContent = `Toi : #${myPos + 1}`
    badge.classList.remove('d-none')
    badge.classList.toggle('badge-correct-pos', correctPos !== -1 && myPos === correctPos)
  })
}

// --- Question "image" : où sur l'image ? ---
// Le joueur clique directement sur l'image (coordonnées normalisées 0-1, pas
// de grille — une grille fixe restait trop grossière face à des zones de
// bonne réponse dessinées librement au pixel par le créateur, voir editor.js).
// Le scoring par proximité (voir server/index.js) tolère d'être à une
// certaine distance de la zone correcte la plus proche.
let imageDisabled = true
let imageSelectedPoint = null // { x, y } normalisé 0-1

const buildImageAnswerArea = (src) => {
  if (!imageImg || !imageClickLayer) return
  imageImg.classList.remove('d-none')
  if (imageErrorMsg) imageErrorMsg.classList.add('d-none')
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
  if (imageZonesReveal) imageZonesReveal.innerHTML = ''
  if (imageWrap) applyTileReveal(imageWrap, 0)
}

if (imageClickLayer) {
  imageClickLayer.onclick = (e) => {
    if (imageDisabled) return
    if (currentSingleAttempt && sendBtn.disabled) return
    const rect = imageClickLayer.getBoundingClientRect()
    imageSelectedPoint = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
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
}

// Distance (en unités normalisées 0-1) entre le point cliqué et une zone
// {x0,y0,x1,y1} (tracée librement dans l'éditeur) : 0 si le point tombe
// dedans, sinon l'écart au bord le plus proche. Doit rester identique au
// calcul serveur (server/index.js) pour que le message affiché ("Presque !
// ...") corresponde exactement aux points réellement accordés.
const imageZoneDistance = (point, zone) => {
  if (!point || !zone || typeof zone.x0 !== 'number') return null
  const dx = point.x < zone.x0 ? zone.x0 - point.x : point.x > zone.x1 ? point.x - zone.x1 : 0
  const dy = point.y < zone.y0 ? zone.y0 - point.y : point.y > zone.y1 ? point.y - zone.y1 : 0
  return Math.max(dx, dy)
}
// Distance à la zone la plus proche, quand il y en a plusieurs (voir editor.js).
const imageMinZoneDistance = (point, zones) => {
  const list = Array.isArray(zones) ? zones : []
  const dists = list.map(z => imageZoneDistance(point, z)).filter(d => d !== null)
  return dists.length ? Math.min(...dists) : null
}

// Révélation : la ou les zones correctes s'affichent comme des rectangles
// verts directement sur l'image ; le marqueur du joueur passe au vert s'il
// était dans l'une d'elles, au rouge sinon — pour comparer les deux d'un
// coup d'œil, sans jamais avoir eu à cliquer sur une case précise.
const revealImageZones = (zones) => {
  if (!imageZonesReveal) return
  imageDisabled = true
  imageZonesReveal.innerHTML = ''
  const list = Array.isArray(zones) ? zones : []
  list.forEach(zone => {
    if (!zone || typeof zone.x0 !== 'number') return
    const el = document.createElement('div')
    el.className = 'image-zone-overlay zone-correct-reveal'
    el.style.left = `${zone.x0 * 100}%`
    el.style.top = `${zone.y0 * 100}%`
    el.style.width = `${(zone.x1 - zone.x0) * 100}%`
    el.style.height = `${(zone.y1 - zone.y0) * 100}%`
    imageZonesReveal.appendChild(el)
  })
  if (imageMarker && imageSelectedPoint) {
    const dist = imageMinZoneDistance(imageSelectedPoint, list)
    imageMarker.classList.toggle('marker-correct', dist === 0)
    imageMarker.classList.toggle('marker-incorrect', dist !== 0)
  }
}

const clearRevealState = () => {
  Array.from(optionsDiv.children).forEach(el => el.classList.remove('correct-reveal', 'incorrect-reveal'))
  if (revealAnswerText) { revealAnswerText.classList.add('d-none'); revealAnswerText.textContent = '' }
  if (myResultBanner) { myResultBanner.classList.add('d-none'); myResultBanner.classList.remove('is-correct', 'is-incorrect', 'is-close'); myResultBanner.textContent = '' }
  if (gradSlider) gradSlider.classList.remove('reveal')
  orderState.itemEls.forEach(el => {
    el.classList.remove('correct-reveal', 'incorrect-reveal')
    const badge = el.querySelector('.order-item-mybadge')
    if (badge) { badge.classList.add('d-none'); badge.classList.remove('badge-correct-pos') }
  })
  if (imageZonesReveal) imageZonesReveal.innerHTML = ''
  if (imageMarker) imageMarker.classList.remove('marker-correct', 'marker-incorrect')
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
const podiumOverlay = document.getElementById('podium')
const isAvatarUrl = (s) => typeof s === 'string' && /^(data:|https?:|blob:|\/)/.test(s)

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
    quizItem.innerHTML = `
      <div>
        <h4 class="font-bold">${quiz.title}</h4>
        <p class="text-muted font-14">${quiz.count || 0} questions</p>
      </div>
      <input type="radio" name="quizSelection" value="${quiz.id}" class="radio-btn" />
    `
    quizItem.onclick = () => {
      // Select the radio button when clicking the item
      const radio = quizItem.querySelector('input[type="radio"]')
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
  showAnnounce(message, 'info')
  resetUI()
})

socket.on('player:kicked', ({ message }) => {
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
        correct: Array.isArray(q.correct) ? q.correct : [],
        options: Array.isArray(q.options) ? q.options : [],
        min: q.min,
        max: q.max,
        image: q.image,
        illustration: q.illustration
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
  socket.emit('room:join', { roomCode, playerName, token: getToken(), avatar })
}

confirmGuestJoin.onclick = () => {
  const roomCode = roomInput.value.trim()
  const guestName = guestNameInput.value.trim()
  if (!roomCode) { log('Veuillez entrer un code de salle'); return }
  if (!guestName) { log('Veuillez entrer un pseudo invité'); return }

  const guestAvatar = '🙂' // Default guest avatar
  socket.emit('room:join', { roomCode, playerName: guestName, token: genToken(), avatar: guestAvatar })
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

socket.on('connect', () => {
  window.myId = socket.id
  if (preRoom) {
    const nm = nameInput.value.trim() || localStorage.getItem('queazy_profile_name') || 'Joueur'
    const av = selectedIcon || localStorage.getItem('queazy_profile_avatar') || '🙂'
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

socket.on('lobby:list', arr => {
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
    
    const s = scores.get(p.id) || { name: p.name, total: 0 }
    if (p.name) s.name = p.name // rafraîchit un nom générique posé trop tôt (ex. player:joined avant le vrai pseudo)
    s.isHost = p.isHost
    scores.set(p.id, s)
    
    if (isMe && p.isHost) {
      isHost = true
      hostPanel.classList.remove('d-none')
      hostPanel.style.display = 'flex'
    
      // Reset buttons visibility when entering lobby as host
      startQuizBtn.classList.remove('d-none')
      startQuizBtn.style.display = 'inline-flex'
      selectQuizBtn.classList.remove('d-none')
      selectQuizBtn.style.display = 'inline-flex'
      nextQuestionBtn.classList.add('d-none')
      nextQuestionBtn.style.display = 'none'
      prevQuestionBtn.classList.add('d-none')
      prevQuestionBtn.style.display = 'none'
    
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
        <div class="status-badge ${p.connected === false ? 'status-gone' : (p.ready ? 'status-ready' : 'status-waiting')} ${isMe ? 'btn-ready-toggle' : ''}">
          ${p.connected === false ? 'Parti' : (p.ready ? 'Prêt' : 'Attente')}
        </div>
      `
      
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

  renderBoard()
})

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
    prevQuestionBtn.classList.toggle('is-disabled', !allReady || !hasPlayers)
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
    correct: correctOrder,
    // Pour 'order', les joueurs voient les items dans un ordre mélangé (pas
    // l'ordre correct saisi dans l'éditeur, ni toujours le même mélange) —
    // le mélange est fait une fois ici, avant l'envoi ; le serveur retire
    // 'correct' de la diffusion (anti-triche), 'options' seul est visible.
    options: q.type === 'order' ? shuffleArray(correctOrder) : (Array.isArray(q.options) ? q.options : []),
    min: q.min,
    max: q.max,
    singleAttempt: currentSingleAttempt
  }
  // L'image (cliquable pour le type "image", ou simple illustration au-dessus
  // de la question pour les autres types) ne transite plus par le socket (voir
  // server/index.js) : on la dépose d'abord via une requête HTTP classique,
  // puis on démarre la question avec juste son URL. Si l'upload échoue, on ne
  // démarre pas la question plutôt que de l'afficher sans image à personne.
  const imageToUpload = q.type === 'image' ? q.image : q.illustration
  if (imageToUpload) {
    uploadRoomImage(roomCode, imageToUpload).then(url => {
      if (q.type === 'image') payload.imageUrl = url
      else payload.illustrationUrl = url
      socket.emit('question:show', payload)
    }).catch(() => {
      log('Échec de l\'envoi de l\'image, question non démarrée')
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
  ;[nextQuestionBtn, prevQuestionBtn].forEach(btn => {
    btn.classList.toggle('d-none', !revealed)
    btn.style.display = revealed ? 'inline-flex' : 'none'
  })
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

prevQuestionBtn.onclick = () => {
  if (prevQuestionBtn.classList.contains('is-disabled')) return
  if (quizIndex <= 1) return // Can't go back before first question
  quizIndex -= 2 // Go back to the previous question index
  emitQuestion(quizIndex)
  quizIndex += 1 // Increment back to next question
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
  prevQuestionBtn.classList.remove('d-none')
  prevQuestionBtn.style.display = 'inline-flex'
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
    if (payload.type === 'mcq' || payload.type === 'truefalse' || payload.type === 'graduation' || payload.type === 'order' || payload.type === 'image') {
      freeTextEl.classList.add('mcq-mode')
      answerInput.classList.add('d-none')
      sendBtn.textContent = 'Valider'
    } else {
      freeTextEl.classList.remove('mcq-mode')
      answerInput.classList.remove('d-none')
      sendBtn.textContent = 'Envoyer'
    }
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
      imageDisabled = false
      freeTextEl.classList.remove('d-none')
      applyTileReveal(freeTextEl, 0)
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

sendBtn.onclick = () => {
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
    Array.from(optionsDiv.children).forEach(c => {
      c.style.pointerEvents = 'none'
      if (!c.classList.contains('selected')) {
        c.style.opacity = '0.5'
      }
    })
  }
}

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
socket.on('answer:queue', ({ answerId, playerId, content }) => {
  if (!isHost) {
    const isMcq = !optionsDiv.classList.contains('d-none')
    if (!isMcq) {
      isModerationPending = true
    }
    return
  }
  
  moderationDiv.style.display = 'block'
  
  const item = document.createElement('div')
  item.style.display = 'flex'
  item.style.alignItems = 'center'
  item.style.justifyContent = 'space-between'
  item.style.padding = '12px'
  item.style.borderBottom = '1px solid var(--color-border)'
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

const renderBoard = () => {
  const ordered = computeOrder().filter(([id, s]) => !s.isHost)

  // Retire le message ponctuel "validation en cours" s'il est encore affiché :
  // il ne doit jamais rester une fois que le vrai classement est rendu.
  const notice = document.getElementById('moderationNotice')
  if (notice) notice.remove()

  const first = new Map()
  leaderRows.forEach((row, id) => { first.set(id, row.getBoundingClientRect()) })

  const currentIds = new Set(ordered.map(([id]) => id))
  leaderRows.forEach((row, id) => {
    if (!currentIds.has(id)) { row.remove(); leaderRows.delete(id) }
  })

  ordered.forEach(([id, s], idx) => {
    let row = leaderRows.get(id)
    const isNew = !row
    if (isNew) {
      row = document.createElement('div')
      row.className = 'leader-row row-enter'
      row.innerHTML = `<span class="leader-rank"></span><span class="leader-name"></span><span class="leader-score"></span>`
      leaderRows.set(id, row)
    }
    row.classList.toggle('is-me', id === window.myId)
    row.querySelector('.leader-rank').textContent = idx + 1
    row.querySelector('.leader-name').textContent = s.name
    row.querySelector('.leader-score').textContent = `${s.total} pts`
    leaderboard.appendChild(row) // déplace le nœud existant : préserve son identité pour le FLIP
  })

  leaderRows.forEach((row) => {
    if (row.classList.contains('row-enter')) {
      requestAnimationFrame(() => {
        row.classList.add('row-enter-active')
        row.addEventListener('transitionend', () => row.classList.remove('row-enter', 'row-enter-active'), { once: true })
      })
    }
  })

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

const showResults = () => {
  const roomCode = roomInput.value.trim()
  if (!roomCode) return
  socket.emit('quiz:end', { roomCode })
}

socket.on('quiz:end', () => {
  const roomCode = roomInput.value.trim()
  if (roomCode) window.location.href = `/result.html?room=${encodeURIComponent(roomCode)}`
})

socket.on('player:joined', ({ id, name }) => { 
  if (!scores.has(id)) scores.set(id, { name, total: 0, isHost: false })
  renderBoard() 
})

socket.on('timer:end', () => {
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
      leaderRows.clear()
      leaderboard.innerHTML = '<div id="moderationNotice"><h2 style="margin-bottom:20px; color:white">Validation des réponses par l\'hôte...</h2><p class="text-white" style="opacity:0.85">Un peu de patience, l\'hôte vérifie les dernières pépites !</p></div>'
      leaderOverlay.classList.remove('d-none')
      leaderOverlay.style.display = 'flex'
    }
    // Sinon : on attend l'évènement question:reveal, qui affiche la bonne réponse
    // sur l'écran de question actuel — plus de saut automatique vers le classement.
  } else {
    leaderOverlay.style.display = 'none'
  }
})

socket.on('question:reveal', payload => {
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
    // on distingue "Bonne réponse" (dans le seuil de tolérance), "Presque !"
    // (score partiel touché mais en dehors du seuil) et "Mauvaise réponse"
    // (aucun point). Le seuil doit rester cohérent avec GRAD_CORRECT_THRESHOLD
    // côté serveur (celui qui détermine le ✓/✗ affiché sur la page résultats).
    const target = Number(payload.target)
    const range = Math.max(1e-9, gradState.max - gradState.min)
    const closeness = (Number.isFinite(target) && myGradAnswerValue !== null)
      ? Math.max(0, 1 - Math.abs(myGradAnswerValue - target) / range)
      : null
    if (closeness !== null && closeness >= GRAD_CORRECT_THRESHOLD) {
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
  }
  if (!isHost) playSound(myAnsweredCorrectlyThisQuestion ? 'correct' : 'wrong')
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
  renderBoard()
  // Le message perso arrive une fois l'animation de réarrangement du
  // classement terminée (transform sur .leader-row, voir style.css), pas en
  // même temps qu'elle.
  setTimeout(() => revealMyPositionChange(beforeOrder), 1300)
  if (isHost) { hostPhase = 'leaderboard'; updateHostControls() }
})

socket.on('moderation:finished', () => {
  isModerationPending = false
  const beforeOrder = preQuestionOrder
  preQuestionOrder = []
  // Overlay visible avant renderBoard() — voir le commentaire équivalent
  // dans 'leaderboard:show' (un élément caché mesure toujours 0, ce qui
  // empêchait l'animation FLIP de se déclencher).
  leaderOverlay.classList.remove('d-none')
  leaderOverlay.style.display = 'flex'
  renderBoard()
  setTimeout(() => revealMyPositionChange(beforeOrder), 1300)
  // Aucune révélation visuelle n'a eu lieu pour cette question (texte libre
  // en attente de modération) : c'est ici qu'on apprend enfin si on avait
  // juste ou faux, donc c'est ici que le son doit jouer.
  if (!isHost) playSound(myAnsweredCorrectlyThisQuestion ? 'correct' : 'wrong')
  if (isHost) { hostPhase = 'leaderboard'; updateHostControls() }
})
socket.on('question:show', () => {
  leaderOverlay.style.display = 'none'
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
  if (playerId === window.myId && total > prevTotal) {
    myAnsweredCorrectlyThisQuestion = true
    myLastDelta = typeof delta === 'number' ? delta : (total - prevTotal)
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
