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
// Un clic sur un lien du site (navbar, "Mes Quiz"...) ferme la page et donc
// le socket : ça déclenche un 'disconnect' bien réel, mais totalement
// inoffensif puisqu'on quitte de toute façon. Sans ce drapeau, le bandeau
// "Connexion perdue" s'affichait une fraction de seconde à chaque
// changement de page avant que la nouvelle ne remplace l'ancienne — voir le
// disconnect handler plus bas qui l'ignore quand ce drapeau est levé.
let isNavigatingAway = false
// Drapeau levé juste avant une navigation déjà confirmée via notre propre
// popup (voir l'écouteur de clic plus bas) : évite qu'un clic sur un lien de
// la navbar déclenche ENSUITE la boîte de dialogue générique du navigateur
// en plus de notre popup déjà validée.
let allowNavigation = false
window.addEventListener('beforeunload', (e) => {
  isNavigatingAway = true
  if (allowNavigation || !inActiveGame) return
  e.preventDefault()
  e.returnValue = ''
})
// Filet de sécurité pour Safari iOS, où 'beforeunload' n'est pas toujours
// fiable : 'pagehide' se déclenche systématiquement au départ de la page.
window.addEventListener('pagehide', () => { isNavigatingAway = true })

// Clic sur un lien de la page (navbar : logo, Créer, Rejoindre, Mes Quiz...)
// EN PLEINE QUESTION : on peut l'intercepter à temps et proposer notre
// propre popup, cohérente avec le reste de l'identité QuEazy, plutôt que la
// boîte de dialogue générique et impersonnelle du navigateur (celle-ci reste
// le filet de sécurité pour un rafraîchissement/fermeture d'onglet/retour
// arrière, qu'on ne peut techniquement pas intercepter autrement).
document.addEventListener('click', (e) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target.closest('a[href]')
  if (!a || a.target === '_blank' || !inActiveGame) return
  e.preventDefault()
  QzUI.confirm({
    title: 'Quitter la partie ?',
    message: 'Une partie est en cours. Si tu quittes maintenant, tu risques de perdre ta place et ta progression.',
    confirmLabel: 'Quitter la partie',
    cancelLabel: 'Rester',
    danger: true
  }).then((ok) => {
    if (!ok) return
    inActiveGame = false
    allowNavigation = true
    window.location.href = a.href
  })
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
const gradDecBtn = document.getElementById('gradDecBtn')
const gradIncBtn = document.getElementById('gradIncBtn')
const revealAnswerText = document.getElementById('revealAnswerText')
const myResultBanner = document.getElementById('myResultBanner')
const revealExplanationText = document.getElementById('revealExplanationText')
const orderArea = document.getElementById('orderArea')
const orderList = document.getElementById('orderList')
const orderCompare = document.getElementById('orderCompare')
const orderCompareMine = document.getElementById('orderCompareMine')
const orderCompareCorrect = document.getElementById('orderCompareCorrect')
const timelineArea = document.getElementById('timelineArea')
const timelineList = document.getElementById('timelineList')
const associationArea = document.getElementById('associationArea')
const associationColA = document.getElementById('associationColA')
const associationColB = document.getElementById('associationColB')
const associationLinksSvg = document.getElementById('associationLinksSvg')
const imageArea = document.getElementById('imageArea')
const imageViewport = document.getElementById('imageViewport')
const imageWrap = document.getElementById('imageWrap')
const imageImg = document.getElementById('imageImg')
const imageClickLayer = document.getElementById('imageClickLayer')
const imageMarker = document.getElementById('imageMarker')
const imageZonesRevealPath = document.getElementById('imageZonesRevealPath')
const imagePlayersLayer = document.getElementById('imagePlayersLayer')
const imageErrorMsg = document.getElementById('imageErrorMsg')
const imageReloadBtn = document.getElementById('imageReloadBtn')
const imageZoomControls = document.getElementById('imageZoomControls')
const imageZoomInBtn = document.getElementById('imageZoomInBtn')
const imageZoomOutBtn = document.getElementById('imageZoomOutBtn')
const imageZoomResetBtn = document.getElementById('imageZoomResetBtn')
const imageZoomLabel = document.getElementById('imageZoomLabel')
const blindtestArea = document.getElementById('blindtestArea')
const blindtestAudio = document.getElementById('blindtestAudio')
const blindtestErrorMsg = document.getElementById('blindtestErrorMsg')
const blindtestReloadBtn = document.getElementById('blindtestReloadBtn')
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
const illustrationImgWrap = document.getElementById('illustrationImgWrap')
// "ZoomOut Devinette" : filet en plus de draggable="false"/-webkit-user-drag
// (voir index.html/style.css) — bloque le drag natif qui montrerait sinon un
// fantôme de l'image source non zoomée/floutée (retour utilisateur).
if (illustrationImg) illustrationImg.addEventListener('dragstart', e => e.preventDefault())
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
const recapPlayerList = document.getElementById('recapPlayerList')
const recapSidebar = document.getElementById('recapSidebar')
const recapSidebarToggle = document.getElementById('recapSidebarToggle')
const recapSidebarClose = document.getElementById('recapSidebarClose')

// Panneau latéral récap (hôte) : ouvert/fermé retenu d'une question — et
// d'une partie — à l'autre (localStorage), pour ne pas avoir à rouvrir à
// chaque fois en session IRL si l'hôte l'a volontairement caché (écran
// projeté aux joueurs, réponses individuelles pas destinées à tous les yeux).
const RECAP_SIDEBAR_PREF_KEY = 'queazy_recap_sidebar_open'
const setRecapSidebarOpen = (open) => {
  if (recapSidebar) recapSidebar.classList.toggle('is-open', open)
  if (recapSidebarToggle) recapSidebarToggle.classList.toggle('is-open', open)
  localStorage.setItem(RECAP_SIDEBAR_PREF_KEY, open ? '1' : '0')
}
// resetUI() cache ces deux éléments en ajoutant .d-none ET un style.display
// inline ("none") — un simple classList.remove('d-none') ne suffit donc pas
// pour les faire réapparaître, l'inline style gagne toujours sur la classe.
// Sans ça le bouton restait invisible pour de vrai après un "Créer une salle"
// (qui passe systématiquement par resetUI()), pas seulement en cas de reload.
const showRecapSidebarUi = () => {
  ;[recapSidebar, recapSidebarToggle].forEach(el => {
    if (!el) return
    el.classList.remove('d-none')
    el.style.display = ''
  })
}
if (recapSidebarToggle) {
  recapSidebarToggle.onclick = () => setRecapSidebarOpen(!recapSidebar.classList.contains('is-open'))
}
if (recapSidebarClose) {
  recapSidebarClose.onclick = () => setRecapSidebarOpen(false)
}
// Mode équipe (hôte uniquement), voir socket.on('team:list') plus bas.
const teamModePanel = document.getElementById('teamModePanel')
const teamModeToggle = document.getElementById('teamModeToggle')
const teamModeControls = document.getElementById('teamModeControls')
const teamCountInput = document.getElementById('teamCountInput')
const teamAutoAssignBtn = document.getElementById('teamAutoAssignBtn')
// Importance de la rapidité (hôte uniquement, voir socket.on('game:speedLevel') plus bas).
const speedLevelPanel = document.getElementById('speedLevelPanel')
const speedLevelSelect = document.getElementById('speedLevelSelect')
// Rendu "maison" (voir js/ui-widgets.js) au lieu du <select> natif — le
// reste du code ci-dessous continue de lire/écrire speedLevelSelect.value
// et d'écouter 'change' sans rien savoir de ce widget.
if (window.QzUI) window.QzUI.enhanceSelect(speedLevelSelect)
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
// Anti double-clic pendant l'upload média d'une question (voir goNext) —
// .is-disabled seul ne bloque pas les clics (pointer-events:auto).
let goNextPending = false
let isHost = false
let currentSingleAttempt = true
let selectedIcon = AVATAR_CHOICES[0]
let timerInt = null
// Zoom progressif sur l'illustration (voir editor.js) : {x, y, startScale}
// de la question en cours, ou null si désactivée. Lu par le même tick que
// la barre de temps (voir timerInt plus bas) pour dézoomer synchronisé sur
// TOUS les écrans (hôte + joueurs), puisque tous calculent depuis le même
// startTs/timerMs reçus du serveur — jamais un minuteur local indépendant.
let currentIllustrationZoom = null
// Un fort scale() seul ne garantit pas un rendu "juste une tache de
// couleur" : sur une image aux formes simples et très contrastées (dessin
// stylisé, rendu 3D à plat...), même un tout petit recadrage agrandi peut
// rester lisible (retour utilisateur : un oeil encore net à zoom x25). Le
// flou, lui, brouille l'image quel que soit son contenu — ajouté en plus du
// zoom, proportionnel au niveau choisi, et retombe à 0 en même temps que le
// dézoom atteint scale(1).
const zoomGuessBlurPx = (startScale) => Math.min(24, Math.max(0, (startScale - 1) * 1.1))
let selectedMcqOptions = []
let currentQuestionType = 'free'
let isGameEnded = false

// --- Révélation « écran principal » : la question apparaît en grand, puis
// les réponses une à une avec une animation — purement cosmétique désormais,
// indépendante du chrono/du déverrouillage (voir startTs, ouvert par le
// serveur après un simple tampon réseau fixe, plus après cette animation :
// on peut cliquer/valider dès l'affichage, sans attendre qu'elle finisse de
// jouer, voir server/index.js ANSWER_WINDOW_BUFFER_MS). L'hôte voit
// exactement la même chose (tuiles en lecture seule) — c'est son écran à
// partager avec la salle.
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

// Accessibilité clavier des tuiles mcq/truefalse/intrus (<div> avec
// seulement un .onclick, injouables au clavier — retour utilisateur,
// contrairement au curseur de graduation qui a déjà tabindex/role/flèches).
// Un simple tabindex + role + relais Entrée/Espace vers le même .onclick
// suffit, sans dupliquer la logique de sélection propre à chaque type.
const makeTileFocusable = (el) => {
  el.tabIndex = 0
  el.setAttribute('role', 'button')
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      el.click()
    }
  })
}

// --- Curseur classique sur piste : les bornes min/max sont les deux bouts
// physiques de la piste (toujours visibles), donc jamais ambiguës — remplace
// l'ancienne règle à viseur fixe/graduation défilante. ---
const gradState = { min: 0, max: 100, value: 50, disabled: false }
// Valeur de repli uniquement (voir question:reveal ci-dessous, qui utilise
// payload.tolerance en priorité — configurable par question depuis
// l'éditeur) : sert pour les vieux quiz sauvegardés avant l'ajout de ce
// champ. Doit rester cohérent avec GRAD_CORRECT_ABS_TOLERANCE_DEFAULT dans
// server/index.js.
const GRAD_CORRECT_ABS_TOLERANCE_DEFAULT = 0

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

// Boutons -/+ à côté du chiffre : incrément de 1 en 1, pour les joueurs qui
// trouvent le glisser trop imprécis (retour utilisateur). Même garde
// gradState.disabled que le clavier/pointeur ci-dessus.
if (gradDecBtn) gradDecBtn.addEventListener('click', () => {
  if (gradState.disabled) return
  setGradValue(gradState.value - 1, true)
})
if (gradIncBtn) gradIncBtn.addEventListener('click', () => {
  if (gradState.disabled) return
  setGradValue(gradState.value + 1, true)
})

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

// --- Question "timeline" : classer des événements dans le bon ordre -------
// Même mécanique de glisser au pointeur que la liste "order" ci-dessus
// (wireOrderDrag), adaptée à des cartes à deux lignes (titre + description)
// au lieu d'un simple texte. "key" = index ORIGINAL dans q.correct (voir
// server/index.js, jamais la date elle-même, jamais montrée avant la
// révélation) : c'est ce qui est envoyé au serveur, dans l'ordre où le
// joueur a placé les cartes — le serveur retrie par date pour déterminer
// l'ordre correct et compare position par position.
let timelineDisabled = true
const setTimelineDisabled = (v) => { timelineDisabled = v }
const TIMELINE_LIST_GAP = 10

const wireTimelineDrag = (el) => {
  let dragActive = false
  el.addEventListener('pointerdown', (e) => {
    if (timelineDisabled || dragActive) return
    if (currentSingleAttempt && sendBtn.disabled) return
    e.preventDefault()
    dragActive = true
    const startY = e.clientY
    el.classList.add('dragging')
    el.style.zIndex = '10'
    try { el.setPointerCapture(e.pointerId) } catch {}

    const others = Array.from(timelineList.children).filter(c => c !== el)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(timelineList.children).indexOf(el)
    const itemHeight = el.getBoundingClientRect().height + TIMELINE_LIST_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      el.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = el.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      let newSlot = 0
      baseRects.forEach(r => { if (center > r.top + r.height / 2) newSlot++ })
      if (newSlot === currentSlot) return
      currentSlot = newSlot
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
        timelineList.insertBefore(el, others[currentSlot] || null)
      }
      others.forEach(c => { c.style.transition = ''; c.style.transform = '' })
      el.classList.remove('dragging')
      el.style.zIndex = ''
      el.style.transition = 'transform 0.2s ease'
      el.style.transform = ''
      setTimeout(() => { el.style.transition = '' }, 200)
      dragActive = false
    }

    const onUp = (ev) => { try { el.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
  })
}

let myTimelineSubmission = null // [{title, description}, ...] tel qu'envoyé, dans l'ordre soumis — pour la comparaison au reveal

const buildTimelineList = (items) => {
  if (!timelineList) return
  timelineList.innerHTML = ''
  timelineDisabled = true
  ;(items || []).forEach((item, uid) => {
    const el = document.createElement('div')
    el.className = 'timeline-item'
    el.dataset.key = item.key
    el.dataset.title = item.title || ''
    el.dataset.description = item.description || ''
    el.innerHTML = `<span class="order-item-handle">⠿</span><span class="timeline-item-text"><span class="timeline-item-title"></span><span class="timeline-item-desc"></span></span>`
    el.querySelector('.timeline-item-title').textContent = item.title || ''
    el.querySelector('.timeline-item-desc').textContent = item.description || ''
    timelineList.appendChild(el)
    wireTimelineDrag(el)
    applyTileReveal(el, uid)
  })
}

const getCurrentTimelineKeys = () => Array.from(timelineList.children).map(el => Number(el.dataset.key))
const getCurrentTimelineSubmission = () => Array.from(timelineList.children).map(el => ({ title: el.dataset.title, description: el.dataset.description }))

// Révélation : même principe que revealOrderList (comparaison ligne à ligne
// figée plutôt qu'une liste qui se réordonne sous les yeux). Comparaison par
// TITRE (le joueur soumet des clés numériques au serveur, mais on ne les
// reçoit pas en retour — le payload de révélation ne porte que les
// événements triés, voir server/index.js revealQuestion) : suppose des
// titres uniques au sein d'une même question, comme "order" suppose déjà
// des éléments textuels uniques.
const revealTimelineList = (correctEvents) => {
  if (!timelineList || !Array.isArray(correctEvents) || correctEvents.length === 0) return
  setTimelineDisabled(true)
  timelineList.classList.add('is-revealed')
  const mine = Array.isArray(myTimelineSubmission) && myTimelineSubmission.length === correctEvents.length
    ? myTimelineSubmission
    : null

  Array.from(timelineList.children).forEach((el, i) => {
    const correctEv = correctEvents[i]
    el.querySelector('.timeline-item-title').textContent = correctEv?.title || ''
    const dateLabel = Number.isFinite(Number(correctEv?.date)) ? ` (${correctEv.date})` : ''
    el.querySelector('.timeline-item-desc').textContent = (correctEv?.description || '') + dateLabel
    const isCorrect = !!mine && mine[i]?.title === correctEv?.title
    el.classList.toggle('correct-reveal', isCorrect)
    el.classList.toggle('incorrect-reveal', !isCorrect)
  })
}

// --- Question "association" : relier les éléments A aux éléments B -------
// q.correct côté serveur = [{a,b}, ...] : la paire i associe TOUJOURS a[i] à
// b[i] (voir server/index.js). payload.pairsA garde cet ordre d'origine
// (sert de repère stable, colonne A jamais mélangée) ; payload.pairsB est
// mélangé une fois par emitQuestion (hôte) avant l'envoi — jamais dans
// l'ordre correct. Chaque paire que le joueur crée est coloriée (une couleur
// par index A, palette reprise du mode équipe) ET reliée par un trait SVG
// (voir renderAssociationLinks plus bas, demande explicite d'un retour
// visuel plus direct que la seule couleur partagée) — les deux réutilisent
// la même palette, donc restent cohérents entre eux.
const ASSOCIATION_PAIR_COLORS = ['pair-0', 'pair-1', 'pair-2', 'pair-3', 'pair-4', 'pair-5', 'pair-6', 'pair-7']
let associationRevealed = false // bascule la couleur des traits en vert/rouge à la révélation (voir revealAssociationPairs)
let associationResizeObserver = null
let associationState = null // { pairsA, pairsB, matches, selected } pendant la question active
let myAssociationSubmission = null // matches[] tel qu'envoyé, gardé pour la comparaison au reveal
let associationDisabled = true
const setAssociationDisabled = (v) => { associationDisabled = v }

// Ne touche qu'aux classes CSS des tuiles déjà en place (matched/selected/
// couleur de paire) — jamais au DOM lui-même. Appelée à chaque clic
// (sélection d'un A ou d'un B, complétion d'une paire) : reconstruire tout
// le DOM à ce moment-là (comme le faisait renderAssociationColumns avant)
// rejouait aussi applyTileReveal sur les nouveaux éléments, donc TOUTES les
// tuiles disparaissaient puis se réaffichaient une par une avec les mêmes
// délais que l'apparition initiale — un "réaffichage" complet à chaque clic.
const updateAssociationClasses = () => {
  if (!associationState || !associationColA || !associationColB) return
  const { pairsBKeys, matches, selected } = associationState
  Array.from(associationColA.children).forEach((el, i) => {
    ASSOCIATION_PAIR_COLORS.forEach(c => el.classList.remove(c))
    el.classList.toggle('is-matched', matches[i] !== null)
    if (matches[i] !== null) el.classList.add(ASSOCIATION_PAIR_COLORS[i % ASSOCIATION_PAIR_COLORS.length])
    el.classList.toggle('is-selected', selected?.side === 'a' && selected.index === i)
  })
  Array.from(associationColB.children).forEach((el, j) => {
    // Identité par CLÉ (index d'origine de la paire, voir pairsBKeys) plutôt
    // que par texte : un élément peut désormais n'avoir qu'une image et pas
    // de texte (voir editor.js), et deux éléments B sans texte seraient
    // sinon indiscernables l'un de l'autre (toujours "" === "").
    const key = pairsBKeys[j] ?? j
    const matchedAIdx = matches.findIndex(m => m === key)
    ASSOCIATION_PAIR_COLORS.forEach(c => el.classList.remove(c))
    el.classList.toggle('is-matched', matchedAIdx !== -1)
    if (matchedAIdx !== -1) el.classList.add(ASSOCIATION_PAIR_COLORS[matchedAIdx % ASSOCIATION_PAIR_COLORS.length])
    el.classList.toggle('is-selected', selected?.side === 'b' && selected.index === j)
  })
  renderAssociationLinks()
}

// Un ResizeObserver plutôt qu'un recalcul ponctuel : la position/hauteur
// réelle des tuiles peut bouger sans clic (image d'un élément qui finit de
// charger après coup, voir fillAssociationImages ; redimensionnement de la
// fenêtre) — un seul point d'observation sur le conteneur entier suffit à
// tout couvrir, y compris le cas où #associationArea passe de masqué (d-none,
// donc 0×0) à visible en changeant de question. Créé une seule fois : la
// même balise #associationArea est réutilisée d'une question à l'autre,
// jamais recréée.
const ensureAssociationResizeObserver = () => {
  if (associationResizeObserver || !associationArea || typeof ResizeObserver === 'undefined') return
  associationResizeObserver = new ResizeObserver(() => renderAssociationLinks())
  associationResizeObserver.observe(associationArea)
}

// Trace un trait entre la tuile A choisie et la tuile B qui lui est associée,
// pour CHAQUE paire déjà complétée — coordonnées lues directement sur le DOM
// (getBoundingClientRect) plutôt que déduites de la grille, pour rester
// justes quel que soit le nombre de lignes que prend le texte d'une tuile.
// Le trait va du bord DROIT de la tuile A au bord GAUCHE de la tuile B (pas
// centre à centre) : il ne traverse ainsi jamais l'intérieur d'une tuile,
// seulement l'espace vide entre les deux colonnes — pas besoin de le passer
// derrière les tuiles avec un z-index.
const renderAssociationLinks = () => {
  if (!associationLinksSvg || !associationState || !associationColA || !associationColB || !associationArea) return
  const { matches } = associationState
  const areaRect = associationArea.getBoundingClientRect()
  associationLinksSvg.innerHTML = ''
  if (!areaRect.width || !areaRect.height) return
  associationLinksSvg.setAttribute('viewBox', `0 0 ${areaRect.width} ${areaRect.height}`)
  Array.from(associationColA.children).forEach((elA, i) => {
    const key = matches[i]
    if (key === null || key === undefined) return
    const elB = associationColB.querySelector(`[data-assoc-key="${key}"]`)
    if (!elB) return
    const rectA = elA.getBoundingClientRect()
    const rectB = elB.getBoundingClientRect()
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', rectA.right - areaRect.left)
    line.setAttribute('y1', rectA.top + rectA.height / 2 - areaRect.top)
    line.setAttribute('x2', rectB.left - areaRect.left)
    line.setAttribute('y2', rectB.top + rectB.height / 2 - areaRect.top)
    const colorClass = associationRevealed
      ? (key === i ? 'correct-reveal' : 'incorrect-reveal')
      : ASSOCIATION_PAIR_COLORS[i % ASSOCIATION_PAIR_COLORS.length]
    line.setAttribute('class', `association-link ${colorClass}`)
    associationLinksSvg.appendChild(line)
  })
}

// Complète (ou remplace) la paire A[aIdx] <-> B[bIdx] : un B déjà utilisé
// par un AUTRE A en est d'abord libéré — une association déjà créée peut
// toujours être remplacée (demande explicite), jamais un B partagé par deux
// A à la fois.
const completeAssociationPair = (aIdx, bIdx) => {
  const key = associationState.pairsBKeys[bIdx] ?? bIdx
  const prevIdx = associationState.matches.findIndex(m => m === key)
  if (prevIdx !== -1) associationState.matches[prevIdx] = null
  associationState.matches[aIdx] = key
  associationState.selected = null
}

// Construit le DOM des deux colonnes une seule fois (au chargement de la
// question, avec l'animation d'apparition en cascade) — les clics ensuite
// ne font que mettre à jour les classes via updateAssociationClasses, voir
// plus haut. La sélection fonctionne dans les deux sens (cliquer un A puis
// un B, OU un B puis un A) : avant, cliquer un B en premier ne faisait
// SILENCIEUSEMENT rien (retour utilisateur : "bug sur le 5e sélection" — un
// joueur qui change d'ordre d'habitude sur sa dernière paire tombait sur ce
// clic mort sans aucun message).
// Géométrie de recadrage partagée avec l'éditeur (voir editor.js
// computeCropGeometry, dupliquée volontairement — scripts classiques
// indépendants, pas de module partagé) : traduit {x,y,zoom} en échelle +
// décalage à appliquer à l'<img>. zoom=1 = cadrage plein (comportement
// d'origine, aucun bord vide) ; zoom<1 dézoome, ce qui PEUT faire apparaître
// des bords vides — comblés par la couleur de fond du conteneur (voir
// applyCropTransform, réglée séparément depuis la couleur dominante calculée
// à l'édition).
const computeCropGeometry = (natW, natH, boxW, boxH, zoom, posX, posY) => {
  const coverScale = Math.max(boxW / natW, boxH / natH)
  const scale = coverScale * (Number.isFinite(zoom) ? zoom : 1)
  const renderedW = natW * scale
  const renderedH = natH * scale
  const overflowX = Math.max(0, renderedW - boxW)
  const overflowY = Math.max(0, renderedH - boxH)
  const offsetX = overflowX > 0 ? -overflowX * posX : (boxW - renderedW) / 2
  const offsetY = overflowY > 0 ? -overflowY * posY : (boxH - renderedH) / 2
  return { scale, offsetX, offsetY }
}

// Pose taille + transform sur une <img> déjà chargée, à l'intérieur d'un
// conteneur `wrapEl` (position:relative, overflow:hidden — voir style.css) :
// utilisé aussi bien pour "association" (.assoc-item-img) que "intrus"
// (.option-btn.intrus-tile), les deux en tuile 4:3.
const applyCropTransform = (wrapEl, imgEl, pos) => {
  const boxW = wrapEl.clientWidth
  const boxH = wrapEl.clientHeight
  if (!boxW || !boxH || !imgEl.naturalWidth) return
  const p = pos || {}
  const posX = Number.isFinite(p.x) ? p.x : 0.5
  const posY = Number.isFinite(p.y) ? p.y : 0.5
  const zoom = Number.isFinite(p.zoom) ? p.zoom : 1
  const { scale, offsetX, offsetY } = computeCropGeometry(imgEl.naturalWidth, imgEl.naturalHeight, boxW, boxH, zoom, posX, posY)
  imgEl.style.width = `${imgEl.naturalWidth}px`
  imgEl.style.height = `${imgEl.naturalHeight}px`
  imgEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
}

// Vignette optionnelle insérée AVANT le texte d'une tuile association (voir
// editor.js buildAssocPhotoSlot pour l'origine de l'image) — un conteneur
// (.assoc-item-img, position:relative/overflow:hidden, voir style.css) avec
// l'<img> réelle à l'intérieur (.assoc-item-img-inner), jamais l'inverse :
// object-fit ne permettant pas de dézoomer sous le cadrage plein (retour
// utilisateur), le positionnement se fait désormais à la main (voir
// applyCropTransform) une fois l'image chargée. Créé vide/caché à chaque
// tuile — même si aucune image n'existe pour elle, voir fillAssociationImages
// ci-dessous qui le remplit une fois le fetch résolu. d-none tant que src est
// vide : le conteneur (comme l'image) ne participe de toute façon jamais à
// el.textContent (identifiant de correspondance utilisé tel quel par
// completeAssociationPair/revealAssociationPairs), qu'une image finisse par
// être chargée ou non.
const buildAssocItemImg = () => {
  const wrap = document.createElement('div')
  wrap.className = 'assoc-item-img d-none'
  const img = document.createElement('img')
  img.className = 'assoc-item-img-inner'
  img.alt = ''
  wrap.appendChild(img)
  return wrap
}

const renderAssociationColumns = () => {
  if (!associationState || !associationColA || !associationColB) return
  const { pairsA, pairsB, pairsBKeys, matches, selected } = associationState
  associationColA.innerHTML = ''
  pairsA.forEach((text, i) => {
    const el = document.createElement('div')
    el.className = 'assoc-item'
    el.dataset.assocId = `${i}a`
    el.appendChild(buildAssocItemImg())
    el.appendChild(document.createTextNode(text))
    if (matches[i] !== null) el.classList.add('is-matched', ASSOCIATION_PAIR_COLORS[i % ASSOCIATION_PAIR_COLORS.length])
    if (selected?.side === 'a' && selected.index === i) el.classList.add('is-selected')
    el.onclick = () => {
      if (associationDisabled) return
      if (currentSingleAttempt && sendBtn.disabled) return
      const sel = associationState.selected
      if (sel && sel.side === 'b') {
        // Un B était déjà sélectionné : ce clic sur A complète la paire.
        completeAssociationPair(i, sel.index)
      } else {
        // Recliquer un A déjà sélectionné le désélectionne ; en cliquer un
        // autre (même déjà apparié) permet de choisir un nouveau B pour lui —
        // son ancienne association reste affichée tant qu'un B n'est pas
        // choisi pour la remplacer.
        associationState.selected = (sel && sel.side === 'a' && sel.index === i) ? null : { side: 'a', index: i }
      }
      updateAssociationClasses()
    }
    associationColA.appendChild(el)
    applyTileReveal(el, i)
  })
  associationColB.innerHTML = ''
  pairsB.forEach((text, j) => {
    const el = document.createElement('div')
    el.className = 'assoc-item'
    const key = pairsBKeys[j] ?? j
    el.dataset.assocId = `${key}b`
    el.dataset.assocKey = key
    el.appendChild(buildAssocItemImg())
    el.appendChild(document.createTextNode(text))
    const matchedAIdx = matches.findIndex(m => m === key)
    if (matchedAIdx !== -1) el.classList.add('is-matched', ASSOCIATION_PAIR_COLORS[matchedAIdx % ASSOCIATION_PAIR_COLORS.length])
    if (selected?.side === 'b' && selected.index === j) el.classList.add('is-selected')
    el.onclick = () => {
      if (associationDisabled) return
      if (currentSingleAttempt && sendBtn.disabled) return
      const sel = associationState.selected
      if (sel && sel.side === 'a') {
        // Un A était déjà sélectionné : ce clic sur B complète la paire.
        completeAssociationPair(sel.index, j)
      } else {
        // Même bascule sélection/désélection que côté A, voir plus haut.
        associationState.selected = (sel && sel.side === 'b' && sel.index === j) ? null : { side: 'b', index: j }
      }
      updateAssociationClasses()
    }
    associationColB.appendChild(el)
    applyTileReveal(el, j)
  })
}

// Remplit les vignettes après-coup, une fois le relais HTTP dédié résolu
// (voir server/index.js /api/room-association-images, même principe que pour
// "intrus") — jamais de data-URI dans la frame socket.io elle-même, trop
// lourd une fois déployé (voir emitQuestion côté index.js).
const fillAssociationImages = (imagesUrl) => {
  if (!imagesUrl) return
  fetch(imagesUrl).then(res => res.json()).then(({ images }) => {
    (images || []).forEach(item => {
      // [data-assoc-id] cible la TUILE (.assoc-item), pas le conteneur
      // d'image (.assoc-item-img, imbriqué dedans — voir buildAssocItemImg)
      // qui porte le "d-none" à retirer. Le retirer directement de la tuile
      // ne faisait donc jamais rien (elle ne l'a jamais eu) : les images
      // restaient invisibles en permanence, quel que soit l'upload (bug
      // réel constaté : "les images du mode association ne s'affichent
      // pas", présent depuis l'origine de cette fonctionnalité).
      const tile = associationArea?.querySelector(`[data-assoc-id="${item.id}"]`)
      const wrap = tile?.querySelector('.assoc-item-img')
      const img = wrap?.querySelector('.assoc-item-img-inner')
      if (!wrap || !img) return
      // Couleur dominante calculée à l'édition (voir editor.js
      // computeDominantEdgeColor) — ne se voit que si l'image a été dézoomée
      // sous le cadrage plein (voir applyCropTransform), sinon entièrement
      // recouverte par la photo elle-même. Repli CSS sinon (voir style.css).
      if (item.bg) wrap.style.background = item.bg
      img.src = item.image
      wrap.classList.remove('d-none')
      // Cadrage choisi à l'édition (voir editor.js openImageCropModal) —
      // {x, y, zoom}, absent = centré + zoom plein (comportement d'origine).
      const applyNow = () => applyCropTransform(wrap, img, item.pos)
      if (img.complete && img.naturalWidth) applyNow()
      img.onload = applyNow
    })
  }).catch(() => {})
}

const buildAssociationArea = (pairsA, pairsB, pairsBKeys, imagesUrl) => {
  if (!associationColA || !associationColB) return
  associationState = {
    pairsA: Array.isArray(pairsA) ? pairsA : [],
    pairsB: Array.isArray(pairsB) ? pairsB : [],
    pairsBKeys: Array.isArray(pairsBKeys) ? pairsBKeys : [],
    matches: new Array(Array.isArray(pairsA) ? pairsA.length : 0).fill(null),
    selected: null
  }
  associationDisabled = true
  associationRevealed = false
  if (associationLinksSvg) associationLinksSvg.innerHTML = ''
  renderAssociationColumns()
  fillAssociationImages(imagesUrl)
  ensureAssociationResizeObserver()
}

// Révélation : même principe que revealOrderList (comparaison ligne à ligne
// plutôt qu'un simple "tout devient vert") — chaque élément A prend le vert
// si SA paire a été correctement devinée, le rouge sinon (avec la bonne
// réponse affichée en regard) ; côté B, seul l'élément effectivement bien
// utilisé par le joueur est colorié en vert (les autres restent neutres :
// "non choisi" n'est pas la même chose que "faux").
const revealAssociationPairs = (correctPairs) => {
  if (!associationColA || !associationColB || !Array.isArray(correctPairs)) return
  setAssociationDisabled(true)
  associationRevealed = true
  // mine[i] est désormais la CLÉ (index d'origine) de l'élément B choisi pour
  // le A d'index i, pas son texte (voir completeAssociationPair) — la paire i
  // est toujours correcte quand mine[i] === i, par construction (a[i]<->b[i]).
  const mine = Array.isArray(myAssociationSubmission) ? myAssociationSubmission : []
  Array.from(associationColA.children).forEach((el, i) => {
    el.classList.remove('is-selected')
    const correct = mine[i] === i
    el.classList.toggle('correct-reveal', correct)
    el.classList.toggle('incorrect-reveal', !correct)
    // Pas d'indice textuel si le B correct n'a pas de texte (élément identifié
    // par une image seule) : " → " tout seul serait plus confus qu'utile.
    if (!correct && correctPairs[i]?.b) {
      const hint = document.createElement('span')
      hint.className = 'assoc-correct-hint'
      hint.textContent = ' → ' + correctPairs[i].b
      el.appendChild(hint)
    }
  })
  Array.from(associationColB.children).forEach((el) => {
    const key = Number(el.dataset.assocKey)
    const wasChosenCorrectly = mine[key] === key
    el.classList.toggle('correct-reveal', wasChosenCorrectly)
  })
  // Le hint textuel ajouté juste au-dessus peut faire grandir une tuile A
  // (retour à la ligne) : recalculer les traits maintenant plutôt que
  // d'attendre le prochain déclenchement du ResizeObserver évite un instant
  // de trait mal aligné.
  renderAssociationLinks()
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
  const viewportW = imageViewport.getBoundingClientRect().width || IMAGE_ZOOM_BASE_WIDTH
  const ratio = (imageImg.naturalWidth && imageImg.naturalHeight) ? imageImg.naturalWidth / imageImg.naturalHeight : (4 / 3)
  let w = viewportW
  let h = Math.round(w / ratio)
  // Sur une image PORTRAIT (plus haute que large), h dépassait souvent
  // IMAGE_FRAME_MAX_HEIGHT et se retrouvait plafonné SEUL — le cadre
  // n'avait alors plus le même ratio que l'image, et #imageImg (object-fit:
  // contain) la faisait flotter en "lettrebox" à l'intérieur, avec du vide
  // de chaque côté. Le calque de clic et le SVG de révélation, eux,
  // recouvrent tout le CADRE (coordonnées 0-1 dessus, pas sur la zone
  // réellement visible de l'image) : ils se retrouvaient donc décalés par
  // rapport à l'image elle-même, parfois carrément visibles à côté d'elle
  // (bug remonté par l'utilisateur, capture à l'appui — jamais reproduit
  // côté éditeur, qui ne plafonne que la largeur, jamais la hauteur). Fix :
  // si la hauteur dépasse le plafond, on réduit la LARGEUR EN PROPORTION
  // pour garder le cadre à l'exact ratio de l'image — plus jamais de
  // lettrebox, donc plus jamais de décalage.
  if (h > IMAGE_FRAME_MAX_HEIGHT) {
    h = IMAGE_FRAME_MAX_HEIGHT
    w = Math.round(h * ratio)
  }
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

// URL d'origine de la question "image" en cours (SANS cache-buster) —
// posée une seule fois par question, lue par imageReloadBtn ci-dessous pour
// retenter le chargement sans empiler de paramètres à chaque tentative.
let currentImageAnswerSrc = null
const buildImageAnswerArea = (src, { baseSrc } = {}) => {
  if (!imageImg || !imageClickLayer) return
  currentImageAnswerSrc = baseSrc || src
  imageImg.classList.remove('d-none')
  if (imageErrorMsg) imageErrorMsg.classList.add('d-none')
  // Posé AVANT d'assigner .src : une image déjà en cache peut déclencher
  // "load" de façon quasi synchrone, le rater reviendrait à garder le cadre
  // (et le zoom affiché) de la question précédente.
  imageImg.onload = setupImageFrame
  imageImg.onerror = () => {
    // Peut arriver pour un joueur (upload correctement fait côté hôte) suite
    // à une coupure réseau/serveur momentanée — pas seulement un vrai upload
    // raté : d'où le bouton "Recharger" plutôt qu'un simple message figé
    // (retour joueur : "image indisponible" sur une carte, sans recours).
    console.error('[image] échec de chargement de l\'image:', src)
    imageImg.classList.add('d-none')
    if (imageErrorMsg) imageErrorMsg.classList.remove('d-none')
  }
  imageImg.src = src
  imageSelectedPoint = null
  imageDisabled = true
  if (imageMarker) imageMarker.classList.add('d-none')
  if (imageZonesRevealPath) imageZonesRevealPath.setAttribute('d', '')
  if (imagePlayersLayer) imagePlayersLayer.innerHTML = ''
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
if (imageReloadBtn) {
  imageReloadBtn.onclick = () => {
    if (!currentImageAnswerSrc) return
    // Cache-buster : sans ça, un navigateur qui a mis l'échec en cache pour
    // cette URL exacte peut re-échouer instantanément sans même retenter la
    // requête réseau.
    const sep = currentImageAnswerSrc.includes('?') ? '&' : '?'
    buildImageAnswerArea(`${currentImageAnswerSrc}${sep}retry=${Date.now()}`, { baseSrc: currentImageAnswerSrc })
  }
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

// Pincement à deux doigts pour zoomer (retour utilisateur, test iPhone : la
// molette n'existe pas au toucher, seuls restaient les boutons +/-, qui
// zooment toujours depuis le coin haut-gauche — impossible en pratique de
// viser une zone ailleurs sur l'image sans un vrai geste de pincement).
// Coexiste avec le glisser à un doigt (déplacer la vue) déjà en place :
// activeImagePointers suit tous les doigts posés sur le calque, un 2e doigt
// bascule en mode pincement et annule un glisser à un doigt en cours.
const activeImagePointers = new Map() // pointerId -> {x, y}
let imagePinch = null
const imagePointerDist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y)

if (imageClickLayer) {
  imageClickLayer.addEventListener('pointerdown', (e) => {
    activeImagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { imageClickLayer.setPointerCapture(e.pointerId) } catch {}
    if (activeImagePointers.size >= 2) {
      // Un 2e (ou 3e) doigt arrive : plus question d'un simple tap/glisser,
      // on repart sur un pincement propre à partir des deux premiers doigts.
      imagePanGesture = null
      const [p1, p2] = Array.from(activeImagePointers.values())
      const rect = imageViewport.getBoundingClientRect()
      const anchorX = (p1.x + p2.x) / 2 - rect.left
      const anchorY = (p1.y + p2.y) / 2 - rect.top
      imagePinch = {
        startDist: imagePointerDist(p1, p2),
        startZoom: imageZoom,
        anchorX,
        anchorY,
        // Point de l'IMAGE (pas de l'écran) sous le milieu des deux doigts —
        // reste sous ce milieu pendant tout le pincement, comme le zoom
        // molette vers le curseur (zoomImageTowardPoint) côté desktop.
        anchorLocalX: (anchorX - imagePanX) / imageZoom,
        anchorLocalY: (anchorY - imagePanY) / imageZoom
      }
    } else {
      imagePanGesture = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, pointerId: e.pointerId }
    }
  })
  imageClickLayer.addEventListener('pointermove', (e) => {
    if (!activeImagePointers.has(e.pointerId)) return
    activeImagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (imagePinch && activeImagePointers.size >= 2) {
      const [p1, p2] = Array.from(activeImagePointers.values())
      const dist = imagePointerDist(p1, p2)
      if (dist > 0 && imagePinch.startDist > 0) {
        imageZoom = Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, imagePinch.startZoom * (dist / imagePinch.startDist)))
        imagePanX = imagePinch.anchorX - imagePinch.anchorLocalX * imageZoom
        imagePanY = imagePinch.anchorY - imagePinch.anchorLocalY * imageZoom
        applyImageZoom()
      }
      return
    }

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
    activeImagePointers.delete(e.pointerId)
    try { imageClickLayer.releasePointerCapture(e.pointerId) } catch {}
    if (imagePinch) {
      // Un pincement a eu lieu : jamais un "tap" valide, quel que soit le
      // doigt relâché en premier — pas de submitImageClick ici.
      if (activeImagePointers.size < 2) imagePinch = null
      imagePanGesture = null
      imageClickLayer.classList.remove('panning')
      return
    }
    if (!imagePanGesture || e.pointerId !== imagePanGesture.pointerId) return
    imageClickLayer.classList.remove('panning')
    if (!imagePanGesture.moved) submitImageClick(e.clientX, e.clientY)
    imagePanGesture = null
  }
  imageClickLayer.addEventListener('pointerup', endImagePanGesture)
  imageClickLayer.addEventListener('pointercancel', () => {
    activeImagePointers.clear()
    imagePinch = null
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

// Point + pseudo de CHAQUE joueur (voir server/index.js revealQuestion, qui
// calcule déjà `correct` avec le même calcul que le scoring réel) — affichés
// en plus du gros marqueur ci-dessus (réservé au point du joueur COURANT,
// sans pseudo). Retour utilisateur : voir où tout le monde a cliqué, pas
// seulement soi-même.
const revealImagePlayerPoints = (players) => {
  if (!imagePlayersLayer) return
  imagePlayersLayer.innerHTML = ''
  const list = Array.isArray(players) ? players : []
  list.forEach(p => {
    if (typeof p?.x !== 'number' || typeof p?.y !== 'number') return
    const el = document.createElement('div')
    el.className = 'image-player-marker'
    el.style.left = `${p.x * 100}%`
    el.style.top = `${p.y * 100}%`
    const name = document.createElement('span')
    name.className = 'image-player-name'
    name.textContent = p.name || 'Joueur'
    const dot = document.createElement('span')
    dot.className = `image-player-dot${p.correct ? ' is-correct' : ''}`
    el.appendChild(name)
    el.appendChild(dot)
    imagePlayersLayer.appendChild(el)
  })
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
// Contrôle RÉEL du volume/de la coupure une fois le graphe Web Audio monté
// (voir ensureBlindTestAnalyser plus bas) : <audio>.muted/.volume natifs ne
// sont plus lus par le navigateur une fois l'élément routé dans un graphe
// Web Audio — tout le son sort du graphe, plus jamais de l'élément lui-même.
// Les poser seuls ne coupait donc plus rien après la première mise en route
// de l'analyseur (nécessaire à l'animation de l'orbe) : un joueur "muet" en
// mode IRL entendait quand même le morceau — bug remonté surtout sur iPhone
// (Safari iOS étant plus strict sur le déblocage audio, l'analyseur y
// démarre plus systématiquement que sur d'autres navigateurs).
let blindtestGain = null
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
  applyBlindTestAudioOutput()
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
    // Nœud de gain entre l'analyseur et les enceintes : seul point qui
    // contrôle vraiment le son entendu une fois ce graphe monté (voir le
    // commentaire sur blindtestGain plus haut).
    blindtestGain = blindtestAudioCtx.createGain()
    source.connect(blindtestAnalyser)
    blindtestAnalyser.connect(blindtestGain)
    blindtestGain.connect(blindtestAudioCtx.destination)
    // Applique tout de suite l'état muted/volume déjà posé sur <audio>
    // avant que ce graphe n'existe (voir buildBlindTestArea) — sinon ce
    // nœud tout neuf démarrerait à son gain par défaut (1), pas au bon
    // niveau/muet.
    applyBlindTestAudioOutput()
  } catch (e) {
    // Web Audio indisponible/bloqué (ex. navigateur trop restrictif) : l'orbe
    // retombe simplement sur sa respiration CSS générique (voir orb-idle),
    // l'audio continue de jouer normalement via l'élément <audio> lui-même.
    blindtestAnalyser = null
  }
  return blindtestAnalyser
}

// Synchronise le nœud de gain (vraie sortie une fois le graphe monté) avec
// l'état muted/volume posé sur <audio> — à appeler après CHAQUE changement
// de l'un ou l'autre. Sans effet tant que le graphe n'existe pas encore :
// l'élément <audio> gère alors le son nativement, correctement.
const applyBlindTestAudioOutput = () => {
  if (!blindtestAudio || !blindtestGain) return
  blindtestGain.gain.value = blindtestAudio.muted ? 0 : blindtestAudio.volume
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

// "Débloque" l'audio à CHAQUE geste (tap/clic) de ce visiteur sur la page —
// pas seulement le tout premier ({once:true} retiré) : iOS Safari peut
// re-suspendre le contexte Web Audio en cours de partie (écran verrouillé,
// appel, passage à une autre appli...), silencieusement, longtemps après le
// déblocage initial. resume() est un no-op bon marché quand le contexte
// tourne déjà, donc pas de coût à réessayer à chaque tap (bouton "Valider",
// tuile de réponse, etc.) plutôt qu'une seule fois en tout début de session.
document.addEventListener('pointerdown', () => { resumeBlindTestAudioCtx() }, { passive: true })

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

// URL d'origine de l'extrait "blind test" en cours (SANS cache-buster) —
// posée une seule fois par question, lue par blindtestReloadBtn ci-dessous
// pour retenter le chargement sans empiler de paramètres à chaque tentative.
let currentBlindTestAudioSrc = null
const buildBlindTestArea = (audioUrl, mode, hostVolumePct) => {
  if (!blindtestAudio) return
  stopBlindTestPulse()
  hideBlindTestUnlockPrompt()
  if (blindtestTitleInput) blindtestTitleInput.value = ''
  if (blindtestArtistInput) blindtestArtistInput.value = ''
  myBlindTestSubmission = null
  currentBlindTestAudioSrc = audioUrl || null
  if (blindtestErrorMsg) blindtestErrorMsg.classList.add('d-none')
  if (blindtestOrb) blindtestOrb.classList.remove('d-none')
  // "à distance" : personne n'est muet, chacun entend sur son poste.
  // "irl" (par défaut) : seul l'hôte (l'écran/les enceintes de la salle) entend.
  blindtestAudio.muted = mode === 'remote' ? false : !isHost
  applyBlindTestAudioOutput()
  blindtestAudio.pause()
  blindtestAudio.currentTime = 0
  // Peut arriver suite à une coupure réseau/serveur momentanée, pas
  // seulement un vrai échec d'upload — même raison/même remède que
  // imageImg.onerror (voir buildImageAnswerArea) : jusqu'ici, un extrait qui
  // ne chargeait pas laissait le joueur dans un silence total, sans aucun
  // message ni recours (retour utilisateur : "j'entends rien, c'est cassé
  // ou normal ?").
  blindtestAudio.onerror = () => {
    console.error('[blindtest] échec de chargement de l\'extrait audio :', audioUrl)
    if (blindtestOrb) blindtestOrb.classList.add('d-none')
    if (blindtestErrorMsg) blindtestErrorMsg.classList.remove('d-none')
  }
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
  applyBlindTestAudioOutput()
}
if (blindtestReloadBtn) {
  blindtestReloadBtn.onclick = () => {
    if (!currentBlindTestAudioSrc || !blindtestAudio) return
    // Cache-buster : sans ça, un navigateur qui a mis l'échec en cache pour
    // cette URL exacte peut re-échouer instantanément sans même retenter la
    // requête réseau (même technique que imageReloadBtn).
    const sep = currentBlindTestAudioSrc.includes('?') ? '&' : '?'
    if (blindtestErrorMsg) blindtestErrorMsg.classList.add('d-none')
    if (blindtestOrb) blindtestOrb.classList.remove('d-none')
    blindtestAudio.src = `${currentBlindTestAudioSrc}${sep}retry=${Date.now()}`
  }
}

const playBlindTestAudio = () => {
  if (!blindtestAudio || !blindtestAudio.src) return
  resumeBlindTestAudioCtx().then(() => {
    blindtestAudio.play().then(() => {
      startBlindTestPulse()
      // <audio>.play() peut réussir (aucune erreur, lecture "en cours") tout
      // en restant totalement silencieux si le contexte Web Audio dans
      // lequel il est routé (voir ensureBlindTestAnalyser) est resté ou
      // repassé "suspended" — notamment sur iOS Safari, qui peut re-suspendre
      // le contexte en cours de partie sans prévenir (écran verrouillé,
      // appel, changement d'appli). Se fier au seul succès de play() cachait
      // ce cas : aucun son, mais pas de bouton de déblocage proposé non plus.
      if (blindtestAudioCtx && blindtestAudioCtx.state !== 'running') {
        showBlindTestUnlockPrompt()
      } else {
        hideBlindTestUnlockPrompt()
      }
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
  // Pas d'artiste attendu pour ce morceau (voir emitQuestion, titleOnly) :
  // on n'affiche que le titre, jamais "Titre — ?" ni "Titre — " (retour
  // utilisateur : ça laissait croire à tort qu'un artiste était attendu).
  parts.push(correctArtist ? `Bonne réponse : ${correctTitle || '?'} — ${correctArtist}` : `Bonne réponse : ${correctTitle || '?'}`)
  if (myBlindTestSubmission && (myBlindTestSubmission.title || myBlindTestSubmission.artist)) {
    parts.push(correctArtist ? `Toi : ${myBlindTestSubmission.title || '—'} / ${myBlindTestSubmission.artist || '—'}` : `Toi : ${myBlindTestSubmission.title || '—'}`)
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
  if (timelineList) {
    timelineList.classList.remove('is-revealed')
    Array.from(timelineList.children).forEach(el => el.classList.remove('correct-reveal', 'incorrect-reveal'))
  }
  if (associationColA) {
    Array.from(associationColA.children).forEach(el => {
      el.classList.remove('correct-reveal', 'incorrect-reveal', 'is-selected')
      const hint = el.querySelector('.assoc-correct-hint')
      if (hint) hint.remove()
    })
  }
  if (associationColB) {
    Array.from(associationColB.children).forEach(el => el.classList.remove('correct-reveal', 'incorrect-reveal'))
  }
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
// Points gagnés par CHAQUE joueur pendant la question en cours (playerId ->
// somme des deltas, voir score:update) — sert au "+XXX" affiché sur chaque
// tuile du classement au moment de la révélation (retour utilisateur), à ne
// pas confondre avec myLastDelta qui ne couvre que MOI (bandeau de résultat
// perso). Remis à zéro à chaque question:show.
const questionDeltas = new Map()
// Rafraîchi à chaque question:show, mis à true si un score:update pour MOI
// arrive avant la révélation — sert uniquement à choisir le son (correct.wav
// / wrong.wav) joué à la révélation, jamais affiché avant.
let myAnsweredCorrectlyThisQuestion = false
// "Presque !" (curseur graduation) ne doit s'afficher que pour une réponse
// VRAIMENT proche — pas dès qu'un delta > 0 a été gagné (retour utilisateur :
// plage 0-25, cible 13, réponse 7 → "Presque !" alors que l'écart de 6
// représente presque la moitié de l'écart maximum possible). closeness est
// linéaire (0-1, voir plus bas), pas encore passé à la puissance
// GRAD_CLOSENESS_EXPONENT (serveur) qui, elle, ne pèse que sur les points —
// 0.8 exige un écart d'au plus 20% de l'intervalle min/max pour mériter le
// label "Presque !", sinon c'est une "Mauvaise réponse" même si quelques
// points résiduels ont été marqués.
const GRAD_PRESQUE_MIN_CLOSENESS = 0.8
// "Petit Bac" (q.type === 'pbac') : DOIT rester strictement identique à
// PBAC_BASE_POINTS côté serveur (server/index.js) — sert uniquement ici à
// déduire le libellé du bandeau perso (Bonne réponse / Presque / Mauvaise)
// à partir de myLastDelta, le serveur ne renvoyant jamais "pourquoi" un
// delta a été réduit (unique, en double, ou refusé/en triple+, tout se
// traduit juste par un montant de points différent, voir answer:submit).
const PBAC_BASE_POINTS = 1000
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

const formatQuizUpdatedAt = (iso) => {
  if (!iso) return ''
  try {
    return 'Modifié le ' + new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
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
    // "questions" volontairement PAS demandé ici : colonne JSONB qui embarque
    // toutes les images/audio en base64 de chaque question (parfois
    // plusieurs Mo par quiz) — la charger entière pour CHAQUE quiz de la
    // liste juste pour afficher "X questions" rendait ce popup très lent
    // dès qu'un compte avait plusieurs quiz riches en médias (perf remontée
    // par l'utilisateur). "Modifié le ..." (déjà quasi gratuit) à la place.
    const { data } = await window.supabaseClient
      .from('quizzes')
      .select('id,title,updated_at')
      .eq('owner_id', session.user.id)
      .order('updated_at', { ascending: false })
    const mapped = (data || []).map(q => ({ id: q.id, title: q.title, updatedAt: q.updated_at }))
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
    countEl.textContent = formatQuizUpdatedAt(quiz.updatedAt)
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
      showAnnounce('Sélectionne un quiz.', 'error')
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
      showAnnounce('Connecte-toi pour accéder à tes quiz !', 'error')
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
  
  document.body.classList.remove('game-active', 'is-host')
  // Hide all dynamic panels — 'main' (toute la zone de jeu : question,
  // illustration, options/association/timeline/etc., bandeau de résultat)
  // en particulier : jamais togglée nulle part avant (toujours visible par
  // défaut, voir index.html), donc jamais nettoyée en quittant une partie
  // en cours — cliquer Créer/Rejoindre en pleine partie laissait la
  // dernière question affichée derrière la nouvelle carte (retour
  // utilisateur : "laisse des traces"). Réaffichée par le prochain
  // question:show reçu (voir son handler). 'leaderOverlay' : même raison,
  // pour l'écran de classement plein écran.
  const panels = ['lobby', 'main', 'leaderOverlay', 'hostPanel', 'roomInfo', 'timerContainer', 'persistentRoomCode', 'recapSidebar', 'recapSidebarToggle']
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
      // Questions marquées "brouillon" dans l'éditeur (voir editor.js
      // qDraftToggle) : exclues d'office de la partie — c'est tout le sens
      // de ce réglage (retour utilisateur : pouvoir sauvegarder une question
      // inachevée sans risquer qu'elle tombe sur les joueurs). Filtrées ICI,
      // avant même la normalisation, pour que le reste du flux de jeu
      // (numérotation, "Question X/Y", isLastQuestion...) n'ait jamais à
      // savoir qu'elles existent.
      const draftCount = Array.isArray(data.questions) ? data.questions.filter(q => q.draft).length : 0
      const playable = Array.isArray(data.questions) ? data.questions.filter(q => !q.draft) : []
      const norm = playable.map((q, i) => ({
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
        tolerance: q.tolerance,
        image: q.image,
        illustration: q.illustration,
        // Même oubli que q.image en son temps : sans ce champ, l'extrait audio
        // du blind test disparaissait silencieusement au chargement du quiz
        // (question démarrée sans le moindre son, aucune erreur visible).
        audio: q.audio,
        explanation: q.explanation || ''
      }))
      loadedQuiz = {
        id: data.id,
        title: data.title || '',
        singleAttempt: data.single_attempt !== false,
        questions: norm
      }
      quizIndex = 0
      currentSingleAttempt = loadedQuiz.singleAttempt !== false
      const draftNote = draftCount > 0 ? ` (${draftCount} brouillon${draftCount > 1 ? 's' : ''} ignoré${draftCount > 1 ? 's' : ''})` : ''
      loadedInfo.textContent = 'Quiz chargé: ' + (loadedQuiz.title || id) + draftNote
      log('Quiz chargé: ' + (loadedQuiz.title || id) + draftNote)
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
  // Même raison que dans resetUI (voir son commentaire) : la dernière
  // question affichée ne doit jamais rester visible derrière le salon
  // d'attente d'une partie suivante.
  const mainEl = document.getElementById('main')
  if (mainEl) {
    mainEl.classList.add('d-none')
    mainEl.style.display = 'none'
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

  if (!roomCode) { log('Entre un code de salle'); return }

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

roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click() })
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click() })
guestNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmGuestJoin.click() })

confirmGuestJoin.onclick = () => {
  const roomCode = roomInput.value.trim()
  const guestName = guestNameInput.value.trim()
  if (!roomCode) { log('Entre un code de salle'); return }
  if (!guestName) { log('Entre un pseudo'); return }

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
  if (isNavigatingAway) return
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

// --- Importance de la rapidité (salon d'attente uniquement, voir
// server/index.js room.speedLevel / game:setSpeedLevel / floorForSpeedLevel).
// Le panneau lui-même n'est visible que côté hôte (comme #teamModePanel),
// mais l'event est diffusé à TOUTE la salle (voir room:join côté serveur) :
// ce qui compte pour la synchronisation demandée, c'est que la valeur reçue
// soit la même pour tout le monde et que le calcul du score, résolu côté
// serveur au moment de question:show (question.pointsFloor), s'appuie
// dessus — jamais sur un état local au client.
socket.on('game:speedLevel', ({ level }) => {
  if (speedLevelSelect && ['low', 'normal', 'high'].includes(level)) {
    speedLevelSelect.value = level
  }
})

if (speedLevelSelect) {
  speedLevelSelect.addEventListener('change', () => {
    const roomCode = roomInput.value.trim()
    if (!roomCode) return
    socket.emit('game:setSpeedLevel', { roomCode, level: speedLevelSelect.value })
  })
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
      startQuizBtn.title = "Il faut au moins un joueur pour lancer le quiz !"
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

    // Le serveur (p.isHost, voir buildPlayerList) fait TOUJOURS foi : jamais
    // un simple repli local. Sans ça, un joueur ayant par erreur créé sa
    // propre salle plus tôt dans le même onglet (isHost=true posé par
    // room:created) puis rejoint la VRAIE salle comme simple joueur gardait
    // pour de bon les commandes hôte à l'écran — rien ne remettait jamais
    // isHost à false quand le serveur disait pourtant clairement le
    // contraire (retour utilisateur : "un de mes joueurs avait les
    // contrôles du maître du jeu").
    if (isMe) isHost = !!p.isHost
    // Bascule le panneau hôte en barre latérale gauche sur grand écran (voir
    // CSS body.is-host #hostPanel) — retour utilisateur : au centre, ce
    // panneau gênait une présentation IRL projetée, la place centrale doit
    // rester pour la question/l'image, pas les boutons de contrôle.
    document.body.classList.toggle('is-host', isHost)

    if (isMe && p.isHost) {
      hostPanel.classList.remove('d-none')
      hostPanel.style.display = 'flex'

      // Même cause que le panneau lien+QR juste en dessous (voir commentaire
      // !inActiveGame) : lobby:list se redéclenche pour tout le monde à
      // chaque (re)connexion d'un joueur, y compris en PLEINE QUESTION —
      // sans cette garde, ce bloc remettait Lancer/Choisir un quiz visibles
      // et cachait Suivant à chaque fois qu'un joueur se reconnectait après
      // une coupure, rendant l'hôte incapable d'avancer dans le quiz sans
      // recharger la page (retour utilisateur, un seul joueur reconnecté a
      // suffi à déclencher le bug).
      if (!inActiveGame) {
        if (teamModePanel) teamModePanel.classList.remove('d-none')
        if (speedLevelPanel) speedLevelPanel.classList.remove('d-none')

        // Reset buttons visibility when entering lobby as host
        startQuizBtn.classList.remove('d-none')
        startQuizBtn.style.display = 'inline-flex'
        selectQuizBtn.classList.remove('d-none')
        selectQuizBtn.style.display = 'inline-flex'
        nextQuestionBtn.classList.add('d-none')
        nextQuestionBtn.style.display = 'none'
      }

      hideBuilder()
      const jc = document.getElementById('joinCard')
      if (jc) {
        jc.classList.add('d-none')
        jc.style.display = 'none'
      }
      // Panneau lien+QR : uniquement au salon d'attente, jamais réaffiché
      // une fois la partie lancée. lobby:list (et donc ce rendu) se
      // redéclenche pour TOUT le monde à chaque (re)connexion d'un joueur —
      // y compris en pleine question, ex. un joueur qui vient de se
      // reconnecter après une coupure. Sans la garde !inActiveGame, ce
      // panneau resurgissait alors par-dessus l'écran de jeu de l'hôte,
      // comme une tuile "Lien pour rejoindre + QR code" en trop (retour
      // utilisateur).
      const roomInfo = document.getElementById('roomInfo')
      if (roomInfo && !inActiveGame) {
        roomInfo.classList.remove('d-none')
        roomInfo.style.display = 'block'
      }
    } else if (isMe && !p.isHost) {
      hostPanel.classList.add('d-none')
      hostPanel.style.display = 'none'
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
          kickBtn.onclick = async () => {
            const ok = window.QzUI
              ? await window.QzUI.confirm({ title: 'Exclure ce joueur ?', message: `Exclure ${p.name} de la salle ?`, confirmLabel: 'Exclure', danger: true })
              : confirm(`Exclure ${p.name} de la salle ?`)
            if (ok) socket.emit('player:kick', { roomCode: roomInput.value.trim(), playerId: p.id })
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
  const lobbyNameBox = document.getElementById('lobbyName')
  if (lobbyNameBox) lobbyNameBox.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click() })
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
  // Ne concerne que le salon d'attente (griser "Lancer" tant que les
  // joueurs ne sont pas prêts) — comme lobby:list, cet évènement se
  // redéclenche pour toute la salle à chaque (re)connexion d'un joueur, y
  // compris en PLEINE QUESTION (voir room:join côté serveur). Sans la garde
  // !inActiveGame, une reconnexion en pleine révélation regrisait "Suivant"
  // (qui reste désormais affiché pendant toute la partie, pas seulement au
  // salon d'attente) et l'hôte ne pouvait plus avancer (retour utilisateur :
  // "le bouton question suivante ne fonctionne pas").
  if (isHost && !inActiveGame) {
    const players = document.querySelectorAll('.player-tile')
    const hasPlayers = players.length > 0

    nextQuestionBtn.classList.toggle('is-disabled', !allReady || !hasPlayers)
    startQuizBtn.classList.toggle('is-disabled', !allReady || !hasPlayers)

    if (!hasPlayers) {
      startQuizBtn.title = "Il faut au moins un joueur pour lancer le quiz !"
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

// Même principe encore, pour les PLUSIEURS photos du type "intrus" (voir
// server/index.js /api/room-intrus-images/:code) — un seul upload pour
// toute la grille plutôt qu'un par photo. `images` = [{id, image}, ...]
// (voir editor.js). Retourne l'URL à interroger une fois pour récupérer le
// tableau complet {images:[...]}, pas une URL par photo.
const uploadRoomIntrusImages = (roomCode, images) => {
  return fetch(`/api/room-intrus-images/${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images })
  }).then(res => {
    if (!res.ok) throw new Error('upload failed')
    return `/api/room-intrus-images/${encodeURIComponent(roomCode)}?v=${Date.now()}`
  })
}

// Même principe encore, pour les images OPTIONNELLES d'éléments association
// (voir editor.js buildAssocPhotoSlot) — un seul upload group{a,b} par paire
// ayant au moins une image, plutôt qu'un relais par élément.
const uploadRoomAssociationImages = (roomCode, images) => {
  return fetch(`/api/room-association-images/${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images })
  }).then(res => {
    if (!res.ok) throw new Error('upload failed')
    return `/api/room-association-images/${encodeURIComponent(roomCode)}?v=${Date.now()}`
  })
}

// Retourne une Promise<boolean> (true = question:show effectivement émise) —
// indispensable pour goNext/startQuizBtn : voir plus bas, l'incrémentation de
// quizIndex n'a le droit d'avoir lieu qu'une fois cette promesse résolue à
// true, jamais avant (sinon un upload de médias qui échoue — coupure réseau
// pendant l'upload des images d'une question "association", le cas le plus
// gros — fait quand même avancer l'index : la question suivante remplace
// silencieusement celle qui n'a jamais démarré, comme "sautée").
const emitQuestion = (index) => {
  const roomCode = roomInput.value.trim()
  if (!roomCode || !loadedQuiz) return Promise.resolve(false)
  const q = loadedQuiz.questions && loadedQuiz.questions[index]
  if (!q) {
    if (index >= loadedQuiz.questions.length) log('Quiz terminé')
    return Promise.resolve(false)
  }
  // Repère de progression dans la barre hôte, complété par le compteur
  // de réponses reçu via answer:progress.
  hostQuestionLabel = `Question ${index + 1}/${loadedQuiz.questions.length}`
  if (loadedInfo) loadedInfo.textContent = `${hostQuestionLabel} · en attente des réponses…`
  const correctOrder = Array.isArray(q.correct) ? q.correct : []
  // "association" : un seul mélange d'index, réutilisé pour dériver à la
  // fois pairsB (textes mélangés) et pairsBKeys (index d'origine de chaque
  // position mélangée) — les deux doivent rester synchronisés position par
  // position, voir le commentaire sur pairsB plus bas.
  const bShuffleOrder = q.type === 'association' ? shuffleArray(correctOrder.map((_, i) => i)) : []
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
    // "intrus" (photos) : jamais les data-URI ici (voir uploads plus bas,
    // même relais HTTP que "image"/"illustration") — seulement les petits id
    // de chaque photo, dans l'ordre. Sert aussi de tileCount côté serveur
    // (computeRevealMs) : la longueur doit rester correcte même avant que
    // l'upload des images elles-mêmes ait résolu.
    options: q.type === 'order'
      ? shuffleArray(correctOrder)
      : q.type === 'intrus'
        ? (Array.isArray(q.options) ? q.options.map(o => o?.id ?? '') : [])
        : (Array.isArray(q.options) ? q.options : []),
    // "association" : la colonne A garde son ordre d'origine (sert de repère
    // stable pour le scoring serveur, voir server/index.js), seule la
    // colonne B est mélangée avant l'envoi — jamais dans l'ordre correct.
    // pairsBKeys mélangé EXACTEMENT dans le même ordre que pairsB (on mélange
    // une seule fois une liste d'index, puis on en dérive les deux tableaux) :
    // sert à retrouver l'image associée à chaque élément B affiché après
    // mélange (voir images/associationImagesUrl plus bas + buildAssociationArea
    // côté client), le texte seul ne suffisant plus d'identifiant stable une
    // fois qu'il peut être vide (élément identifié par une image seule).
    pairsA: q.type === 'association' ? correctOrder.map(p => p?.a ?? '') : undefined,
    pairsB: q.type === 'association' ? bShuffleOrder.map(i => correctOrder[i]?.b ?? '') : undefined,
    pairsBKeys: q.type === 'association' ? bShuffleOrder : undefined,
    // "timeline" : la date reste dans q.correct (server/index.js s'en sert
    // pour scorer/révéler) mais n'est JAMAIS incluse ici — seuls titre/
    // description + une clé (index d'origine) partent au mélange.
    timelineItems: q.type === 'timeline' ? shuffleArray(correctOrder.map((e, i) => ({ title: e?.title ?? '', description: e?.description ?? '', key: i }))) : undefined,
    min: q.min,
    max: q.max,
    // Écart accepté comme "Bonne réponse !" pour ce type, configuré par
    // question dans l'éditeur (voir server/index.js GRAD_CORRECT_ABS_TOLERANCE_DEFAULT
    // pour la valeur de repli si absente).
    tolerance: q.type === 'graduation' ? (Math.max(0, Number(q.tolerance) || 0)) : undefined,
    audioMode: q.type === 'blindtest' ? audioMode : undefined,
    audioVolume: q.type === 'blindtest' ? hostAudioVolume : undefined,
    // "Titre uniquement" (voir editor.js) : pas d'artiste attendu pour ce
    // morceau (ex. générique de dessin animé). Le champ artiste n'est alors
    // ni affiché côté joueur ni jugé côté serveur (voir answer:submit).
    // En plus du réglage explicite, on regarde aussi si un artiste a
    // vraiment été renseigné dans le quiz : un vieux quiz sauvegardé avant
    // l'ajout de cette case (q.titleOnly === undefined) mais dont l'artiste
    // est resté vide affichait quand même le champ "Artiste" côté joueur —
    // qui n'avait alors aucune chance de le remplir juste, le champ étant
    // dupé pour rien (retour utilisateur : "ça dupe le joueur").
    titleOnly: q.type === 'blindtest' ? (!!q.titleOnly || !(Array.isArray(q.correct?.artist) && q.correct.artist.some(a => (a || '').trim()))) : undefined,
    // QCM à plusieurs bonnes réponses : undefined/true = il faut cocher
    // exactement l'ensemble des bonnes réponses (comportement historique,
    // jamais cassé pour un quiz déjà sauvegardé) ; false = au moins une
    // bonne réponse cochée (et aucune mauvaise) suffit à valider — voir
    // server/index.js answer:submit pour le calcul du score.
    requireAllCorrect: q.type === 'mcq' ? (q.requireAllCorrect !== false) : undefined,
    singleAttempt: currentSingleAttempt,
    // Texte optionnel affiché SEULEMENT à la révélation (voir server/index.js,
    // jamais diffusé dans question:show — sinon lisible en devtools avant
    // même de répondre), ex. "Faux, l'entreprise a été créée en 1986".
    explanation: q.explanation || '',
    // "zoomguess" : zoom obligatoire sur SA propre image (voir editor.js),
    // {x, y, startScale}. Purement cosmétique côté client, aucun impact sur
    // le scoring (qui reste le texte libre générique) — pas besoin que le
    // serveur en sache quoi que ce soit, transmis tel quel.
    zoom: q.type === 'zoomguess' ? (q.zoom || { x: 0.5, y: 0.5, startScale: 4 }) : undefined
  }
  // L'image ("image" cliquable, "zoomguess" à deviner, ou simple illustration
  // au-dessus de la question pour les autres types) et l'extrait audio du
  // type "blindtest" ne transitent plus par le socket (voir server/index.js) :
  // on les dépose d'abord via une requête HTTP classique, puis on démarre la
  // question avec juste leur URL. Si un upload échoue, on ne démarre pas la
  // question plutôt que de l'afficher sans média à personne.
  const imageToUpload = (q.type === 'image' || q.type === 'zoomguess') ? q.image : q.illustration
  const audioToUpload = q.type === 'blindtest' ? q.audio : null
  const uploads = []
  // Quiz sauvegardé depuis le chantier Supabase Storage (voir editor.js
  // uploadQuestionMedia) : q.image/q.illustration/q.audio sont déjà des URLs
  // publiques, plus besoin du relais HTTP (créé à l'origine uniquement pour
  // éviter les gros blobs base64 dans la frame websocket — non pertinent
  // pour une simple URL). Un vieux quiz jamais resauvegardé garde son
  // base64 et passe toujours par le relais, inchangé.
  if (imageToUpload && /^https?:\/\//.test(imageToUpload)) {
    if (q.type === 'image' || q.type === 'zoomguess') payload.imageUrl = imageToUpload
    else payload.illustrationUrl = imageToUpload
  } else if (imageToUpload) {
    uploads.push(uploadRoomImage(roomCode, imageToUpload).then(url => {
      if (q.type === 'image' || q.type === 'zoomguess') payload.imageUrl = url
      else payload.illustrationUrl = url
    }))
  }
  if (audioToUpload && /^https?:\/\//.test(audioToUpload)) {
    payload.audioUrl = audioToUpload
  } else if (audioToUpload) {
    uploads.push(uploadRoomAudio(roomCode, audioToUpload).then(url => { payload.audioUrl = url }))
  }
  if (q.type === 'intrus' && Array.isArray(q.options) && q.options.length > 0) {
    uploads.push(uploadRoomIntrusImages(roomCode, q.options).then(url => { payload.intrusImagesUrl = url }))
  }
  if (q.type === 'association') {
    // id "<indexPaire><a|b>" (ex. "3b") : indexPaire toujours l'index
    // D'ORIGINE dans correctOrder (stable pour A, retrouvable pour B via
    // pairsBKeys ci-dessus, voir server/index.js pour le pattern attendu).
    // pos : cadrage choisi à l'édition (voir editor.js openAssocCropModal),
    // transmis tel quel — {x,y,zoom} normalisés/multiplicateur, absent si
    // l'image n'a jamais été recadrée (cadrage plein par défaut côté rendu,
    // voir applyCropTransform). bg : couleur dominante du pourtour de la
    // photo (voir editor.js computeDominantEdgeColor), ne se voit que si
    // dézoomée sous le cadrage plein. Les deux sont purement cosmétiques,
    // jamais validés strictement côté serveur (voir /api/room-association-images).
    const assocImages = []
    correctOrder.forEach((pair, i) => {
      if (pair?.aImage) assocImages.push({ id: `${i}a`, image: pair.aImage, pos: pair.aPos || undefined, bg: pair.aBg || undefined })
      if (pair?.bImage) assocImages.push({ id: `${i}b`, image: pair.bImage, pos: pair.bPos || undefined, bg: pair.bBg || undefined })
    })
    if (assocImages.length > 0) {
      uploads.push(uploadRoomAssociationImages(roomCode, assocImages).then(url => { payload.associationImagesUrl = url }))
    }
  }
  if (uploads.length > 0) {
    // Retour utilisateur : rien n'indiquait qu'un envoi était en cours
    // pendant l'upload d'image/son avant de démarrer la question — sur une
    // connexion lente ou un gros fichier, l'hôte pouvait croire l'appli
    // figée. is-disabled (voir goNext) bloque déjà le double-clic, mais
    // c'est un repère purement visuel, sans texte.
    if (loadedInfo) loadedInfo.textContent = `${hostQuestionLabel} · envoi du média en cours…`
    return Promise.all(uploads).then(() => {
      if (loadedInfo) loadedInfo.textContent = `${hostQuestionLabel} · en attente des réponses…`
      socket.emit('question:show', payload)
      return true
    }).catch(() => {
      if (loadedInfo) loadedInfo.textContent = `${hostQuestionLabel} · échec de l'envoi du média`
      log('Échec de l\'envoi du média, question non démarrée — réessayez')
      showAnnounce('Échec de l\'envoi du média — réessaie')
      return false
    })
  }
  socket.emit('question:show', payload)
  return Promise.resolve(true)
}

const goNext = () => {
  // Pas de garde sur nextQuestionBtn.classList('is-disabled') ici : goNext
  // est aussi le handler de leaderNextBtn ("Question suivante" dans
  // l'overlay classement, voir updateHostControls), qui est un bouton
  // DIFFÉRENT — et nextQuestionBtn reste justement grisé pendant toute la
  // phase classement (hostPhase !== 'revealed'), donc ce test bloquait à
  // tort tout clic sur "Question suivante" (retour utilisateur : "ce bouton
  // ne fonctionne pas"). Les deux boutons ne branchent goNext que dans les
  // phases où c'est déjà légitime (voir updateHostControls) : plus besoin
  // de re-vérifier ici.
  if (!loadedQuiz || quizIndex >= loadedQuiz.questions.length || goNextPending) return
  const index = quizIndex
  goNextPending = true
  // .is-disabled seul ne bloque pas les clics (voir CSS, pointer-events:auto
  // volontaire) — le vrai garde-fou contre un double-clic pendant l'upload
  // est goNextPending ci-dessus, la classe n'est qu'un repère visuel.
  if (leaderNextBtn) leaderNextBtn.classList.add('is-disabled')
  emitQuestion(index).then(started => {
    goNextPending = false
    // Retiré dans TOUS les cas (succès ET échec) — ne l'était qu'en cas
    // d'échec, le bouton restait grisé en permanence dès le premier succès,
    // à chaque question suivante (retour utilisateur : "le bouton se grise
    // entre deux questions"). Il reste bien fonctionnel malgré le griséé
    // (pointer-events:auto, voir plus haut), mais donne l'impression d'être
    // cassé.
    if (leaderNextBtn) leaderNextBtn.classList.remove('is-disabled')
    if (started) {
      quizIndex = index + 1
    }
    // Échec (upload média, déconnexion pendant l'envoi...) : quizIndex n'a
    // pas bougé, un nouveau clic relance la MÊME question plutôt que de
    // sauter à la suivante.
  })
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
  // Barre de l'hôte (en haut de page) : reste affichée pendant TOUTE la
  // question, pas seulement à la révélation (retour utilisateur — un bouton
  // qui apparaît/disparaît est moins lisible qu'un repère visuel constant) —
  // simplement grisée tant que tout le monde n'a pas répondu. En phase
  // classement, le classement plein écran la recouvrirait de toute façon —
  // l'avancement se fait alors via un bouton placé DANS l'overlay du
  // classement (leaderNextBtn, voir plus bas).
  const revealed = hostPhase === 'revealed'
  nextQuestionBtn.classList.remove('d-none')
  nextQuestionBtn.style.display = 'inline-flex'
  nextQuestionBtn.classList.toggle('is-disabled', !revealed)
  if (revealed) {
    // Après la toute dernière question, sauter la page "classement" (qui
    // n'aurait plus rien à annoncer avant les résultats finaux, lesquels
    // sont EUX-MÊMES un classement) et aller directement aux résultats,
    // plutôt que d'imposer un clic supplémentaire dessus (retour hôte).
    if (isLastQuestion()) {
      nextQuestionBtn.textContent = 'Résultat'
      nextQuestionBtn.onclick = showResults
    } else {
      nextQuestionBtn.textContent = 'Suivant'
      nextQuestionBtn.onclick = () => {
        const roomCode = roomInput.value.trim()
        if (roomCode) socket.emit('leaderboard:show', { roomCode })
      }
    }
  } else {
    // Grisé : aucune action tant que la question n'est pas révélée (voir
    // .btn.is-disabled, qui ne bloque pas les clics tout seul — pas de
    // handler du tout ici, plutôt qu'un handler qu'il faudrait re-garder).
    nextQuestionBtn.textContent = 'Suivant'
    nextQuestionBtn.onclick = null
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
      showAnnounce('Il faut au moins un joueur pour lancer le quiz !')
    } else {
      // Retour utilisateur : le message générique ne disait ni QUI bloquait
      // ni comment débloquer — seul recours jusqu'ici, repérer soi-même la
      // bonne tuile dans le salon et l'exclure, sans qu'aucun texte ne le
      // suggère. lastLobbyArr (voir renderLobbyGrid) donne directement les
      // noms des joueurs encore en "Attente".
      const notReady = (lastLobbyArr || []).filter(p => !p.isHost && p.connected !== false && !p.ready).map(p => p.name)
      const names = notReady.length ? ` : ${notReady.join(', ')}` : ''
      showAnnounce(`Tous les joueurs ne sont pas prêts${names}. Tu peux exclure un joueur bloqué depuis sa tuile dans le salon.`)
    }
    return
  }
  if (!loadedQuiz || !loadedQuiz.questions || loadedQuiz.questions.length === 0) {
    showAnnounce('Charge un quiz avant de lancer la partie !')
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

  quizIndex = 0
  qrDiv.style.display = 'none'
  const roomInfo = document.getElementById('roomInfo')
  if (roomInfo) {
    roomInfo.classList.add('d-none')
    roomInfo.style.display = 'none'
  }
  // Panneau récap (hôte) : le bouton pour l'afficher/cacher n'a de sens
  // qu'une fois la partie lancée (rien à récapituler avant) — état
  // ouvert/fermé restauré depuis la dernière fois (voir RECAP_SIDEBAR_PREF_KEY).
  showRecapSidebarUi()
  setRecapSidebarOpen(localStorage.getItem(RECAP_SIDEBAR_PREF_KEY) === '1')
  // On émet directement la première question (au lieu de simuler un clic sur
  // nextQuestionBtn) : le bouton reste grisé/onclick=null tant que la question
  // n'est pas révélée (voir updateHostControls), donc un .click() ici ne
  // déclencherait plus rien depuis qu'il reste affiché-mais-grisé par défaut.
  const startIndex = quizIndex
  emitQuestion(startIndex).then(started => {
    if (started) {
      quizIndex = startIndex + 1
    } else {
      // Échec au tout premier envoi (upload média...) : on revient à l'écran
      // de lancement plutôt que de laisser l'hôte bloqué sur des boutons de
      // navigation grisés sans aucune question jamais démarrée.
      startQuizBtn.classList.remove('d-none')
      startQuizBtn.style.display = ''
      selectQuizBtn.classList.remove('d-none')
      selectQuizBtn.style.display = ''
      nextQuestionBtn.classList.add('d-none')
      nextQuestionBtn.style.display = 'none'
    }
  })
  nextQuestionBtn.classList.add('is-disabled')
  nextQuestionBtn.onclick = null
}

socket.on('question:show', payload => {
  inActiveGame = true
  // Bouton du panneau récap (hôte) : re-synchronisé à CHAQUE question, pas
  // seulement au clic sur "LANCER" (voir startQuizBtn.onclick) — sinon un
  // hôte qui rechargeait la page ou se reconnectait en pleine partie (courant
  // sur plusieurs questions) ne le revoyait plus jamais, question:show étant
  // le seul évènement qui resynchronise alors son écran (retour utilisateur :
  // "je vois pas de panneau récap" en pleine partie, version pourtant à jour).
  if (isHost) {
    showRecapSidebarUi()
    setRecapSidebarOpen(localStorage.getItem(RECAP_SIDEBAR_PREF_KEY) === '1')
  }
  clearRevealState()
  // Snapshot AVANT que les scores de cette question ne commencent à arriver :
  // sert de référence pour annoncer le changement de position au bon moment.
  preQuestionOrder = computeOrder().filter(([id, s]) => !s.isHost).map(([id]) => id)
  // Remis à zéro à chaque question (voir score:update) : sert au "+XXX"
  // affiché sur chaque tuile du classement (retour utilisateur), un par
  // joueur plutôt qu'un seul (myLastDelta, réservé à MON propre bandeau de
  // résultat).
  questionDeltas.clear()
  const lobby = document.getElementById('lobby')
  if (lobby) {
    lobby.classList.add('d-none')
    lobby.style.display = 'none'
  }
  // Symétrique du masquage dans resetUI (voir son commentaire) : remet la
  // zone de jeu au premier plan si un Créer/Rejoindre l'avait cachée entre
  // deux parties dans le même onglet.
  const mainEl = document.getElementById('main')
  if (mainEl) {
    mainEl.classList.remove('d-none')
    mainEl.style.display = 'block'
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
    const isMcqLike = payload.type === 'mcq' || payload.type === 'truefalse' || payload.type === 'intrus'
    optionsDiv.style.display = isMcqLike ? 'grid' : 'none'
    optionsDiv.classList.toggle('d-none', !isMcqLike)
    optionsDiv.classList.toggle('truefalse-grid', payload.type === 'truefalse')
    optionsDiv.classList.toggle('intrus-grid', payload.type === 'intrus')
  }
  if (graduationArea) {
    graduationArea.classList.toggle('d-none', payload.type !== 'graduation')
  }
  if (orderArea) {
    orderArea.classList.toggle('d-none', payload.type !== 'order')
  }
  if (associationArea) {
    associationArea.classList.toggle('d-none', payload.type !== 'association')
  }
  if (timelineArea) {
    timelineArea.classList.toggle('d-none', payload.type !== 'timeline')
    if (timelineList) timelineList.classList.remove('is-revealed')
  }
  if (imageArea) {
    imageArea.classList.toggle('d-none', payload.type !== 'image')
  }
  if (blindtestArea) {
    blindtestArea.classList.toggle('d-none', payload.type !== 'blindtest')
  }
  if (illustrationImg) {
    // "zoomguess" utilise sa PROPRE image (payload.imageUrl, obligatoire),
    // avec zoom toujours actif ; les autres types réutilisent le même
    // élément pour leur illustration décorative optionnelle (payload.
    // illustrationUrl), jamais zoomée.
    const isZoomGuess = payload.type === 'zoomguess'
    const mediaUrl = isZoomGuess ? payload.imageUrl : payload.illustrationUrl
    if (mediaUrl) {
      illustrationImg.onerror = () => { illustrationImg.classList.add('d-none') }
      illustrationImg.src = mediaUrl
      illustrationImg.classList.remove('d-none')
      // L'animation d'entrée (tileRevealIn) anime elle-même "transform" —
      // posée directement sur <img>, elle écraserait en continu (tant
      // qu'elle reste attachée, ~0.5s) tout scale() posé juste en dessous
      // pour le zoom initial de "zoomguess" : une animation CSS l'emporte
      // toujours sur un style inline pour la même propriété, quel que soit
      // l'ordre d'exécution JS. D'où le bug remonté par l'utilisateur
      // ("aucun zoom") — corrigé en animant le WRAPPER (qui n'a besoin
      // d'aucun transform) plutôt que l'image elle-même, qui reste ainsi
      // libre pour le scale() du zoom.
      applyTileReveal(illustrationImgWrap || illustrationImg, 0)
    } else {
      illustrationImg.classList.add('d-none')
      illustrationImg.removeAttribute('src')
    }
    // Zoom initial posé tout de suite (avant même startTs) : la question
    // révélée doit apparaître déjà zoomée, pas dézoomée puis re-zoomée une
    // fois le chrono démarré. Le dézoom progressif lui-même est piloté par
    // le tick de la barre de temps (voir timerInt plus bas).
    currentIllustrationZoom = isZoomGuess ? (payload.zoom || null) : null
    if (illustrationImgWrap) illustrationImgWrap.classList.toggle('is-zoomed', !!currentIllustrationZoom)
    if (currentIllustrationZoom) {
      illustrationImg.style.transformOrigin = `${currentIllustrationZoom.x * 100}% ${currentIllustrationZoom.y * 100}%`
      illustrationImg.style.transform = `scale(${currentIllustrationZoom.startScale})`
      illustrationImg.style.filter = `blur(${zoomGuessBlurPx(currentIllustrationZoom.startScale)}px)`
    } else {
      illustrationImg.style.transformOrigin = ''
      illustrationImg.style.transform = ''
      illustrationImg.style.filter = ''
    }
  }
  answerInput.value = ''
  answerInput.disabled = false
  sendBtn.disabled = true
  gradState.disabled = true
  selectedMcqOptions = []
  // Symétrique du answerInput.disabled = false juste au-dessus : ces deux
  // champs sont verrouillés après soumission en mode "une seule tentative"
  // (voir submitCurrentAnswer) mais n'étaient jamais redéverrouillés ici au
  // démarrage de la question SUIVANTE — oubli qui laissait les champs
  // titre/artiste bloqués en écriture dès la 2e question blind test de la
  // partie (signalé par l'utilisateur : "je ne peux pas écrire").
  if (blindtestTitleInput) blindtestTitleInput.disabled = false
  if (blindtestArtistInput) blindtestArtistInput.disabled = false
  // Symétrique du .add('is-locked') posé dans submitCurrentAnswer — sans
  // ça, le grisage de la question précédente resterait affiché sur celle-ci.
  ;[gradSlider, orderList, associationArea, timelineList, imageWrap, blindtestFields].forEach(el => {
    if (el) el.classList.remove('is-locked')
  })
  // "Titre uniquement" (voir editor.js) : masque le champ artiste plutôt que
  // de le laisser visible mais inutile — rien ne l'attend côté scoring
  // (voir server/index.js), le montrer inviterait à le remplir pour rien.
  if (blindtestArtistInput) blindtestArtistInput.classList.toggle('d-none', payload.type === 'blindtest' && !!payload.titleOnly)
  // Tout le monde démarre verrouillé : la question puis les tuiles se
  // révèlent d'abord (ci-dessous), le chrono et les réponses ne s'activent
  // qu'à startTs. L'hôte, lui, reste verrouillé en permanence — il ne répond
  // jamais, ce n'est que son écran à partager avec la salle.
  inputArea.classList.add('answers-locked')
  hideAnswerStatus()

  const freeTextEl = document.getElementById('freeText')
  freeTextEl.classList.add('d-none')
  if (!isHost) {
    const isTileType = payload.type === 'mcq' || payload.type === 'truefalse' || payload.type === 'intrus' || payload.type === 'graduation' || payload.type === 'order' || payload.type === 'image' || payload.type === 'association' || payload.type === 'timeline'
    const isBlindtest = payload.type === 'blindtest'
    freeTextEl.classList.toggle('mcq-mode', isTileType)
    answerInput.classList.toggle('d-none', isTileType || isBlindtest)
    if (blindtestFields) blindtestFields.classList.toggle('d-none', !isBlindtest)
    sendBtn.textContent = isTileType ? 'Valider' : 'Envoyer'
    // Curseur placé directement dans le champ de saisie sur PC (retour
    // utilisateur) : évite un clic superflu avant de pouvoir taper une
    // question à saisie libre ("free"/"zoomguess", seuls types affichant
    // answerInput). Uniquement sur pointeur fin (souris/trackpad) — sur
    // mobile, focus() ferait surgir le clavier virtuel par-dessus l'écran
    // avant même que le joueur ait vu la question.
    if ((payload.type === 'free' || payload.type === 'zoomguess' || payload.type === 'pbac') && window.matchMedia('(pointer: fine)').matches) {
      answerInput.focus()
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
  if (payload.type === 'association') {
    buildAssociationArea(payload.pairsA, payload.pairsB, payload.pairsBKeys, payload.associationImagesUrl)
  }
  if (payload.type === 'timeline') {
    buildTimelineList(payload.timelineItems)
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
  myAssociationSubmission = null
  myTimelineSubmission = null

  if (timerBarFill) {
    timerBarFill.classList.remove('timer-urgent')
    timerBarFill.style.transform = 'scaleX(1)'
  }

  // Déverrouillage à startTs (aligné sur REVEAL_QUESTION_BEAT_MS — voir
  // server/index.js ANSWER_WINDOW_BUFFER_MS — pas la durée complète de
  // l'animation d'entrée comme avant) : tuiles/curseur/liste et bouton
  // d'envoi redeviennent interactifs dès que le chrono démarre pour de vrai,
  // au moment où la première réponse commence tout juste à apparaître.
  // revealToken évite qu'un déverrouillage tardif ne s'applique après le
  // passage à une autre question (hôte qui enchaîne très vite).
  const myRevealToken = ++revealToken
  if (!isHost) {
    setTimeout(() => {
      if (revealToken !== myRevealToken) return
      inputArea.classList.remove('answers-locked')
      sendBtn.disabled = false
      gradState.disabled = false
      setOrderDisabled(false)
      setAssociationDisabled(false)
      setTimelineDisabled(false)
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

    // Dézoom progressif de l'illustration (voir "Zoomer progressivement sur
    // un détail", editor.js) : même tick que la barre de temps ci-dessous,
    // donc synchronisé sur tous les écrans puisque `remaining`/`total` sont
    // dérivés du même startTs/timerMs reçus du serveur. Atteint pile scale(1)
    // (image complète) au même instant que le chrono affiche 0.
    if (currentIllustrationZoom && illustrationImg) {
      const progress = Math.min(1, 1 - remaining / total)
      const scale = currentIllustrationZoom.startScale + (1 - currentIllustrationZoom.startScale) * progress
      illustrationImg.style.transform = `scale(${scale})`
      illustrationImg.style.filter = `blur(${zoomGuessBlurPx(currentIllustrationZoom.startScale) * (1 - progress)}px)`
    }

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

    // Auto-envoi juste avant la fin du chrono pour les questions à réponse
    // écrite (libre / blind test) : si le joueur n'a jamais cliqué "Envoyer"
    // mais a bel et bien tapé quelque chose, ça part quand même au lieu
    // d'être perdu (retour utilisateur : sinon la réponse tapée n'était
    // jamais transmise). Rien n'est envoyé si le champ est resté vide — pas
    // de fausse tentative comptée. Un peu AVANT remaining=0 (marge réseau)
    // pour arriver au serveur avant la fermeture de la fenêtre de réponse
    // (voir server/index.js answer:submit, `Date.now() - q.startTs > q.timerMs`).
    // submitCurrentAnswer() lui-même pose hasAnsweredThisQuestion = true,
    // donc ce bloc ne se déclenche qu'une seule fois.
    if (!isHost && !hasAnsweredThisQuestion && remaining > 0 && remaining <= 500) {
      if ((currentQuestionType === 'free' || currentQuestionType === 'pbac') && answerInput.value.trim()) {
        submitCurrentAnswer()
      } else if (currentQuestionType === 'blindtest' && ((blindtestTitleInput?.value || '').trim() || (blindtestArtistInput?.value || '').trim())) {
        submitCurrentAnswer()
      } else if (currentQuestionType === 'mcq' && selectedMcqOptions.length > 0) {
        submitCurrentAnswer()
      } else if ((currentQuestionType === 'truefalse' || currentQuestionType === 'intrus') && selectedMcqOptions.length > 0) {
        submitCurrentAnswer()
      } else if (currentQuestionType === 'image' && imageSelectedPoint) {
        submitCurrentAnswer()
      } else if (currentQuestionType === 'order' || currentQuestionType === 'graduation' || currentQuestionType === 'association' || currentQuestionType === 'timeline') {
        // Ces quatre types n'ont aucune garde de contenu dans
        // submitCurrentAnswer (voir plus bas) : l'état actuellement affiché
        // — modifié ou pas (ordre mélangé tel quel, curseur resté au
        // milieu, aucune paire faite, dates dans l'ordre de mélange...) —
        // est toujours une soumission valide, donc toujours sûr d'auto-
        // envoyer ici plutôt que de perdre la tentative d'un joueur qui a
        // interagi sans jamais cliquer "Valider" (retour utilisateur —
        // corrigé d'abord pour "order" seul cette session, étendu ici aux
        // 3 autres types dans exactement le même cas). mcq/truefalse/
        // intrus/image restent à part juste au-dessus : eux DOIVENT avoir
        // une vraie garde ("Rien n'est envoyé si le champ est resté vide"),
        // sans quoi un joueur n'ayant jamais touché l'écran se verrait
        // quand même compter une tentative.
        submitCurrentAnswer()
      }
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
      makeTileFocusable(el)
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
  } else if (payload.type === 'intrus' && Array.isArray(payload.options)) {
    // Réutilise le rendu QCM (mêmes tuiles .option-btn) mais choix EXCLUSIF
    // comme "truefalse" — il n'y a qu'un seul intrus possible. Chaque tuile
    // affiche une PHOTO plutôt qu'un texte : payload.options ne contient que
    // les petits id des photos (jamais les data-URI elles-mêmes, voir
    // emitQuestion — même relais HTTP que "image"/"illustration", trop
    // lourd pour transiter de façon fiable par socket.io une fois déployé).
    // Les tuiles existent tout de suite (nécessaire pour applyTileReveal,
    // l'animation d'entrée), les photos arrivent un instant après via une
    // requête HTTP à part.
    const intrusTileElById = {}
    payload.options.forEach((id, i) => {
      const el = document.createElement('div')
      el.className = 'option-btn intrus-tile'
      el.dataset.optionId = id
      makeTileFocusable(el)
      // Pas de texte dans la tuile (juste une photo) : role="button" seul ne
      // suffit pas à un lecteur d'écran pour identifier laquelle est
      // laquelle, d'où ce label explicite basé sur la position affichée.
      el.setAttribute('aria-label', `Photo ${i + 1}`)
      const img = document.createElement('img')
      img.className = 'intrus-tile-img'
      img.alt = ''
      el.appendChild(img)
      el.onclick = () => {
        if (currentSingleAttempt && sendBtn.disabled) return
        selectedMcqOptions = [id]
        Array.from(optionsDiv.children).forEach(c => c.classList.remove('selected'))
        el.classList.add('selected')
      }
      optionsDiv.appendChild(el)
      applyTileReveal(el, i)
      intrusTileElById[id] = el
    })
    if (payload.intrusImagesUrl) {
      fetch(payload.intrusImagesUrl).then(res => res.json()).then(({ images }) => {
        (images || []).forEach(item => {
          const el = intrusTileElById[item.id]
          const img = el?.querySelector('.intrus-tile-img')
          if (!el || !img) return
          // Couleur dominante calculée à l'édition (voir editor.js
          // computeDominantEdgeColor) — ne se voit que si l'image a été
          // dézoomée sous le cadrage plein (voir applyCropTransform).
          if (item.bg) el.style.background = item.bg
          img.src = item.image
          // Cadrage choisi à l'édition (voir editor.js renderIntrusOptions /
          // openImageCropModal) — {x, y, zoom}, absent = centré + zoom plein
          // (comportement d'origine).
          const applyNow = () => applyCropTransform(el, img, item.pos)
          if (img.complete && img.naturalWidth) applyNow()
          img.onload = applyNow
        })
      }).catch(() => {})
    }
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
      makeTileFocusable(el)
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
// garde son bouton "Valider" mais doit aussi pouvoir déclencher le même
// envoi automatiquement à l'approche de la fin du chrono (voir le bloc
// d'auto-envoi plus haut), pour ne pas perdre la tentative d'un joueur qui a
// réordonné les tuiles sans jamais cliquer dessus.
const submitCurrentAnswer = () => {
  const roomCode = roomInput.value.trim()

  let content = ''

  if (currentQuestionType === 'mcq') {
    if (selectedMcqOptions.length === 0) {
      showAnnounce('Sélectionne au moins une réponse')
      return
    }
    // JSON plutôt que join(', ') : une option dont le texte contient
    // elle-même une virgule (ex. "Paris, France") cassait la reconstruction
    // côté serveur (split(',')), qui ne retombait plus jamais sur l'exacte
    // liste des bonnes réponses -> "mauvaise réponse" alors que tout était
    // coché correctement (retour utilisateur).
    content = JSON.stringify(selectedMcqOptions)
  } else if (currentQuestionType === 'truefalse' || currentQuestionType === 'intrus') {
    if (selectedMcqOptions.length === 0) {
      showAnnounce('Sélectionne au moins une réponse')
      return
    }
    // PAS de JSON.stringify ici (contrairement au QCM juste au-dessus) : un
    // seul choix exclusif possible, jamais de virgule à protéger — et
    // surtout, côté serveur, ces deux types passent par le comparateur
    // "fuzzy" générique (texte brut vs q.correct), qui ne sait pas décoder
    // du JSON. Envoyer '["dph5eu"]' au lieu de 'dph5eu' faisait échouer la
    // comparaison à tous les coups -> "mauvaise réponse" alors que le bon
    // intrus était pourtant coché (retour utilisateur, régression du fix
    // QCM ci-dessus appliqué à tort à ces deux types aussi).
    content = selectedMcqOptions[0]
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
  } else if (currentQuestionType === 'association') {
    // Pas d'obligation d'avoir tout apparié (le score est proportionnel,
    // 0 association valide est un résultat possible comme les autres) — on
    // envoie l'état actuel tel quel, null pour les A encore sans paire.
    myAssociationSubmission = associationState ? associationState.matches.slice() : []
    content = JSON.stringify(myAssociationSubmission)
  } else if (currentQuestionType === 'timeline') {
    myTimelineSubmission = getCurrentTimelineSubmission() // pour la comparaison au reveal (titres)
    content = JSON.stringify(getCurrentTimelineKeys()) // pour le serveur (clés = index d'origine)
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
    setAssociationDisabled(true)
    setTimelineDisabled(true)
    imageDisabled = true
    if (blindtestTitleInput) blindtestTitleInput.disabled = true
    if (blindtestArtistInput) blindtestArtistInput.disabled = true
    Array.from(optionsDiv.children).forEach(c => {
      c.style.pointerEvents = 'none'
      if (!c.classList.contains('selected')) {
        c.style.opacity = '0.5'
      }
    })
    // Retour visuel "verrouillé" pour les types sans équivalent des tuiles
    // ci-dessus (retour utilisateur : seuls mcq/truefalse/intrus grisaient
    // visiblement après envoi — les autres restaient identiques à l'écran,
    // le joueur pouvait continuer à toucher/glisser sans aucun effet
    // visible et se demander si son geste avait un effet).
    ;[gradSlider, orderList, associationArea, timelineList, imageWrap, blindtestFields].forEach(el => {
      if (el) el.classList.add('is-locked')
    })
  }
}
sendBtn.onclick = submitCurrentAnswer

answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendBtn.click() } })
if (blindtestTitleInput) blindtestTitleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendBtn.click() } })
if (blindtestArtistInput) blindtestArtistInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendBtn.click() } })

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

// "Petit Bac" : contrairement au reste de la modération (une réponse jugée
// isolément), l'hôte doit ici REGROUPER lui-même les réponses qu'il juge
// identiques avant de les valider ensemble (retour utilisateur — jamais de
// correspondance automatique, il n'existe aucune liste de bonnes réponses
// pour ce type). Chaque ligne pbac de moderationDiv porte une case à cocher
// (voir plus bas) ; ce bandeau, unique et partagé, se met à jour en direct
// selon le nombre actuellement coché et affiche le montant de points qui en
// résultera (voir PBAC_BASE_POINTS) avant même de valider.
const pbacGroupBar = document.createElement('div')
pbacGroupBar.className = 'card'
pbacGroupBar.style.marginTop = '8px'
pbacGroupBar.style.display = 'none'
pbacGroupBar.style.alignItems = 'center'
pbacGroupBar.style.justifyContent = 'space-between'
pbacGroupBar.style.gap = '12px'
pbacGroupBar.style.flexWrap = 'wrap'
const pbacGroupLabel = document.createElement('div')
pbacGroupLabel.style.fontSize = '13px'
pbacGroupLabel.style.opacity = '0.75'
pbacGroupLabel.textContent = 'Coche les réponses identiques entre elles, puis valide la famille'
const pbacGroupBtn = document.createElement('button')
pbacGroupBtn.className = 'btn btn-primary'
pbacGroupBtn.style.padding = '8px 16px'
pbacGroupBtn.disabled = true
pbacGroupBtn.textContent = 'Valider la famille'
pbacGroupBar.appendChild(pbacGroupLabel)
pbacGroupBar.appendChild(pbacGroupBtn)
document.querySelector('.container').appendChild(pbacGroupBar)

// Rafraîchit le libellé/l'état du bandeau à partir des cases actuellement
// cochées — appelée à chaque coche/décoche ainsi qu'après tout ajout/retrait
// de ligne pbac (nouvelle réponse, famille validée, réponse refusée).
const updatePbacGroupBar = () => {
  const anyPbacRow = moderationDiv.querySelector('[data-pbac="1"]')
  pbacGroupBar.style.display = anyPbacRow ? 'flex' : 'none'
  const n = moderationDiv.querySelectorAll('input.pbac-check:checked').length
  if (n === 0) {
    pbacGroupBtn.disabled = true
    pbacGroupBtn.textContent = 'Valider la famille'
    return
  }
  pbacGroupBtn.disabled = false
  const pts = n === 1 ? PBAC_BASE_POINTS : n === 2 ? Math.round(PBAC_BASE_POINTS / 2) : 0
  pbacGroupBtn.textContent = n === 1
    ? `Valider (réponse unique, +${pts} pts)`
    : n === 2
      ? `Valider ces 2 réponses (+${pts} pts chacune)`
      : `Valider ces ${n} réponses (0 pt, trop de doublons)`
}
pbacGroupBtn.onclick = () => {
  const roomCode = roomInput.value.trim()
  const answerIds = [...moderationDiv.querySelectorAll('input.pbac-check:checked')]
    .map(cb => cb.closest('[data-answer-id]')?.dataset.answerId)
    .filter(Boolean)
  if (answerIds.length === 0) return
  socket.emit('moderation:pbacGroup', { roomCode, answerIds })
  answerIds.forEach(id => moderationDiv.querySelector(`[data-answer-id="${id}"]`)?.remove())
  if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
  updatePbacGroupBar()
}
// Confirmation serveur (voir server/index.js moderation:pbacGroup) : retire
// les lignes correspondantes si elles existent encore — filet de sécurité en
// plus du retrait optimiste ci-dessus (ex. plusieurs onglets hôte ouverts).
socket.on('moderation:pbacGrouped', ({ answerIds }) => {
  (answerIds || []).forEach(id => moderationDiv.querySelector(`[data-answer-id="${id}"]`)?.remove())
  if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
  updatePbacGroupBar()
})

let isModerationPending = false
socket.on('answer:queue', ({ answerId, playerId, playerName, content, blindtest, fields, pbac }) => {
  if (!isHost) {
    const isMcq = !optionsDiv.classList.contains('d-none')
    if (!isMcq) {
      isModerationPending = true
    }
    return
  }

  // Évite un doublon si cet évènement est rejoué au reconnect de l'hôte
  // (voir server/index.js room:join, rattrapage pendant une modération en
  // cours) alors que la ligne existe déjà dans le panneau (reconnexion sans
  // recharger la page — le DOM du panneau n'est jamais vidé entre deux
  // évènements, seulement ligne par ligne à la résolution de chacune).
  if (moderationDiv.querySelector(`[data-answer-id="${answerId}"]`)) return

  moderationDiv.style.display = 'block'

  const item = document.createElement('div')
  item.style.padding = '12px'
  item.style.borderBottom = '1px solid var(--color-border)'
  item.dataset.answerId = answerId

  const nameTag = document.createElement('div')
  nameTag.style.fontWeight = '700'
  nameTag.style.fontSize = '13px'
  nameTag.style.opacity = '0.75'
  nameTag.style.marginBottom = '4px'
  nameTag.textContent = playerName || 'Joueur'
  item.appendChild(nameTag)

  if (pbac) {
    item.dataset.pbac = '1'
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    row.style.justifyContent = 'space-between'
    row.style.gap = '12px'

    const left = document.createElement('label')
    left.style.display = 'flex'
    left.style.alignItems = 'center'
    left.style.gap = '10px'
    left.style.cursor = 'pointer'
    left.style.flex = '1'
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.className = 'pbac-check'
    check.onchange = updatePbacGroupBar
    const answerLabel = document.createElement('span')
    answerLabel.style.fontWeight = '600'
    answerLabel.textContent = content
    left.appendChild(check)
    left.appendChild(answerLabel)

    const reject = document.createElement('button')
    reject.className = 'btn'
    reject.style.padding = '8px 16px'
    reject.textContent = 'Refuser'
    reject.onclick = () => {
      const roomCode = roomInput.value.trim()
      socket.emit('moderation:reject', { roomCode, answerId })
      item.remove()
      if (moderationDiv.children.length === 0) moderationDiv.style.display = 'none'
      updatePbacGroupBar()
    }

    row.appendChild(left)
    row.appendChild(reject)
    item.appendChild(row)
    moderationDiv.appendChild(item)
    updatePbacGroupBar()
    return
  }

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
    // "Titre uniquement" (voir editor.js/server) : pas de clé "artist" du
    // tout dans fields pour ce cas, plutôt qu'une entrée vide qui afficherait
    // une ligne "Artiste" sans objet à juger.
    if (fields.artist) item.appendChild(buildFieldRow('Artiste', 'artist'))
    moderationDiv.appendChild(item)
    return
  }

  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.alignItems = 'center'
  row.style.justifyContent = 'space-between'
  row.style.gap = '12px'

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
  row.appendChild(label)
  row.appendChild(btns)
  item.appendChild(row)
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
// Ids dont le "+XXX -> fusion dans le score" a déjà joué POUR CETTE
// révélation du classement (retour utilisateur) — contrairement à
// leaderRowsRevealed (persiste toute la partie, une ligne ne rejoue jamais
// son entrée), celui-ci est remis à zéro à CHAQUE leaderboard:show : le gain
// de points doit rejouer à chaque question, pas une seule fois dans toute la
// partie. Sans ce garde-fou, renderBoard() (rappelée par ex. à la moindre
// reconnexion pendant que le classement reste affiché) relancerait le
// décompte depuis zéro à chaque appel.
const leaderScoreAnimated = new Set()
// Anime le score d'une ligne de `oldTotal` à `newTotal`, avec un badge
// "+delta" qui apparaît d'abord à côté (retour utilisateur : "sur la
// droite des tuiles joueurs"), puis se fond dans le nombre au moment où
// celui-ci commence réellement à monter — plutôt que deux animations
// indépendantes, sans lien visuel entre elles.
const LEADER_GAIN_HOLD_MS = 550 // le badge reste lisible avant de fusionner
const LEADER_COUNT_DURATION_MS = 900
const animateScoreGain = (row, oldTotal, newTotal, delta) => {
  const scoreEl = row.querySelector('.leader-score')
  const gainEl = row.querySelector('.leader-score-gain')
  if (!scoreEl) return
  if (!gainEl || !(delta > 0)) { scoreEl.textContent = `${newTotal} pts`; return }
  scoreEl.textContent = `${oldTotal} pts`
  gainEl.textContent = `+${delta}`
  gainEl.classList.remove('d-none', 'leader-score-gain-merge')
  // Force le navigateur à appliquer l'état "juste apparu" avant d'enchaîner
  // sur la transition d'entrée (même pattern que les autres animations de
  // ce fichier — sans ce reflow forcé, l'ajout immédiat d'une classe de
  // transition ne joue pas, le badge apparaîtrait déjà à son état final).
  void gainEl.offsetWidth
  gainEl.classList.add('leader-score-gain-in')
  setTimeout(() => {
    gainEl.classList.add('leader-score-gain-merge')
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / LEADER_COUNT_DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubique : rapide au début, ralentit en approchant la cible
      scoreEl.textContent = `${Math.round(oldTotal + (newTotal - oldTotal) * eased)} pts`
      if (t < 1) requestAnimationFrame(tick)
      else {
        scoreEl.textContent = `${newTotal} pts`
        gainEl.classList.add('d-none')
        gainEl.classList.remove('leader-score-gain-in', 'leader-score-gain-merge')
      }
    }
    requestAnimationFrame(tick)
  }, LEADER_GAIN_HOLD_MS)
}

// Au-delà de ce nombre, le classement plein (tout le monde) devient une
// longue liste défilante peu lisible une fois projeté à l'écran pour une
// grande salle — incohérent avec le podium final, qui ne montre déjà que le
// top 3 (voir results.js). Seul le top N + la ligne du joueur qui consulte
// son propre écran (si hors top N) reste affiché.
const LEADERBOARD_MAX_ROWS = 15

const renderBoard = () => {
  const fullOrder = computeOrder().filter(([id, s]) => !s.isHost)
  // Rang RÉEL de chacun, calculé sur la liste complète — même tronqué à
  // l'affichage, le numéro affiché doit rester le vrai classement, pas la
  // position dans la liste réduite.
  const rankById = new Map(fullOrder.map(([id], i) => [id, i]))
  let ordered = fullOrder
  if (fullOrder.length > LEADERBOARD_MAX_ROWS) {
    const top = fullOrder.slice(0, LEADERBOARD_MAX_ROWS)
    const mine = fullOrder.find(([id]) => id === window.myId)
    ordered = (mine && !top.some(([id]) => id === window.myId)) ? [...top, mine] : top
  }
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
      row.innerHTML = `<span class="leader-rank"></span><span class="leader-name"></span><span class="leader-gone-badge d-none">Parti</span><span class="leader-score-gain d-none"></span><span class="leader-score"></span>`
      leaderRows.set(id, row)
    }
    row.classList.toggle('is-me', id === window.myId)
    row.classList.toggle('is-gone', s.connected === false)
    // Repère visuel (léger espace + séparateur, voir style.css) quand cette
    // ligne est le joueur qui consulte son propre écran, accroché à la fin
    // de la liste malgré un rang bien plus loin que le top affiché — sans
    // ça, "38" apparaissant juste sous "15" ressemblerait à un bug plutôt
    // qu'à une troncature volontaire.
    row.classList.toggle('is-detached', idx === LEADERBOARD_MAX_ROWS)
    row.querySelector('.leader-rank').textContent = rankById.get(id) + 1
    row.querySelector('.leader-name').textContent = s.name
    row.querySelector('.leader-gone-badge').classList.toggle('d-none', s.connected !== false)
    // "+XXX" qui se fond dans le score au moment où il commence à monter
    // (retour utilisateur) : seulement au premier renderBoard() de CETTE
    // révélation du classement (overlayVisible + pas déjà joué, voir
    // leaderScoreAnimated) — un appel ultérieur (reconnexion pendant que le
    // classement reste affiché, etc.) affiche directement le score final,
    // sans rejouer le décompte.
    const gained = questionDeltas.get(id) || 0
    const alreadyAnimated = leaderScoreAnimated.has(id)
    if (overlayVisible && gained > 0 && !alreadyAnimated) {
      leaderScoreAnimated.add(id)
      animateScoreGain(row, s.total - gained, s.total, gained)
    } else if (!alreadyAnimated) {
      // Pas encore révélé (overlay caché — ex. simple mise à jour du salon)
      // ou rien gagné cette question : score final affiché tel quel, aucune
      // animation à déclencher.
      row.querySelector('.leader-score').textContent = `${s.total} pts`
    }
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
  if (!roomCode) return
  // loadedQuiz n'existe que côté hôte (seul à appeler loadQuizById) : ce
  // paramètre part donc naturellement vide pour les joueurs, qui n'ont pas
  // accès à relancer une partie — pas besoin de détection de rôle dédiée.
  // Repris par result.html (bouton "Rejouer ce quiz", voir results.js) pour
  // ramener l'hôte sur l'accueil avec le MÊME quiz déjà chargé plutôt que de
  // lui faire retraverser tout l'écran de sélection (retour utilisateur :
  // aucun moyen de relancer la même partie une fois sur les résultats).
  const quizParam = loadedQuiz?.id ? `&quiz=${encodeURIComponent(loadedQuiz.id)}` : ''
  window.location.href = `/result.html?room=${encodeURIComponent(roomCode)}${quizParam}`
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
  // Même raison que la barre de temps juste au-dessus : la question peut se
  // clore avant que le tick d'index.js n'ait naturellement atteint scale(1)
  // (tout le monde a répondu en avance) — on force l'image complète tout de
  // suite pour rester cohérent avec la révélation qui s'affiche en dessous.
  if (currentIllustrationZoom && illustrationImg) { illustrationImg.style.transform = 'scale(1)'; illustrationImg.style.filter = '' }
  // Coupe l'extrait s'il n'était pas déjà terminé (le chrono peut être plus
  // court que le clip) — pour l'hôte ET les joueurs, chacun ayant sa propre
  // instance <audio> (voir buildBlindTestArea).
  if (currentQuestionType === 'blindtest') stopBlindTestAudio()
  if (!isHost) {
    // Ne PAS masquer inputArea : la révélation (surbrillance QCM, règle,
    // réponse acceptée) s'affiche dedans. On verrouille juste les interactions.
    inputArea.classList.add('answers-locked')
    setOrderDisabled(true)
    setAssociationDisabled(true)
    setTimelineDisabled(true)
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
  // clearRevealState() (appelée à chaque question:show) cache ce bloc via
  // .d-none — sans le retirer ici, tout son contenu reste display:none en
  // permanence : le panneau latéral s'affiche mais paraît vide en boucle.
  questionRecapCard.classList.remove('d-none')
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
  // Détail par joueur (voir server/index.js buildRecap) : qui a répondu quoi,
  // demande explicite pour pouvoir rebondir nommément à l'oral en session IRL.
  if (recapPlayerList) {
    recapPlayerList.innerHTML = ''
    const perPlayer = Array.isArray(payload?.perPlayer) ? payload.perPlayer : []
    const escRecap = s => (s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    // "presque" (state === 'almost', voir server/index.js buildRecap) : des
    // points ont été marqués sans que la réponse soit jugée entièrement
    // correcte (graduation proche, image proche, une partie des paires/de
    // l'ordre juste...) — état à part de correct/incorrect, avec sa propre
    // couleur (orange) et icône (vague), pour le distinguer d'un coup d'œil.
    const STATE_MARK = { correct: '✅', almost: '🌊', incorrect: '❌' }
    // "relier"/"frise chronologique" : plusieurs éléments sur plusieurs
    // lignes (answerDetails, voir buildRecap) — illisible tronqué sur une
    // seule ligne (retour hôte : "doit être lisible"/"une ligne = un
    // événement").
    const isMultiline = payload?.type === 'association' || payload?.type === 'timeline'
    perPlayer.forEach(p => {
      const state = p.state || (p.correct ? 'correct' : 'incorrect')
      const row = document.createElement('div')
      row.className = `recap-player-row is-${state}${isMultiline ? ' is-multiline' : ''}`
      const answerHtml = isMultiline
        ? escRecap(p.answer || '—').replace(/\n/g, '<br>')
        : escRecap(p.answer || '—')
      row.innerHTML = `
        <span class="recap-player-mark">${STATE_MARK[state] || '❌'}</span>
        <span class="recap-player-name">${escRecap(p.name || 'Joueur')}</span>
        <span class="recap-player-answer">${answerHtml}</span>
      `
      recapPlayerList.appendChild(row)
    })
  }
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
  if ((payload.type === 'mcq' || payload.type === 'truefalse' || payload.type === 'intrus') && optionsDiv) {
    Array.from(optionsDiv.children).forEach(el => {
      // "intrus" (photos) : la tuile n'a plus de texte à comparer, l'id de
      // la photo est dans son dataset (voir question:show) plutôt que dans
      // el.textContent comme pour mcq/truefalse.
      const value = payload.type === 'intrus' ? el.dataset.optionId : el.textContent
      if ((payload.correct || []).includes(value)) el.classList.add('correct-reveal')
      else el.classList.add('incorrect-reveal')
    })
    showMyResultBanner()
  } else if (payload.type === 'free' || payload.type === 'zoomguess') {
    revealFreeAnswer((payload.correct || [])[0] || '')
    showMyResultBanner()
  } else if (payload.type === 'pbac') {
    // Aucune "bonne réponse" à révéler (catégorie ouverte) : seul mon propre
    // résultat compte. myLastDelta == PBAC_BASE_POINTS -> réponse unique,
    // 0 < myLastDelta < PBAC_BASE_POINTS -> réponse en double (voir server/
    // index.js finalizePbacScoring), 0 -> refusée par l'hôte OU donnée par
    // 3 joueurs ou plus (indiscernables ici, mais le message reste correct
    // dans les deux cas : "Mauvaise réponse").
    if (myLastDelta >= PBAC_BASE_POINTS) {
      showMyResultBanner()
    } else if (myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! Quelqu'un d'autre a donné la même réponse (+${myLastDelta} points)`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  } else if (payload.type === 'graduation') {
    positionGradTargetMarker(payload.target)
    // Score continu (proximité), comme "image" : au lieu d'un simple binaire,
    // on distingue "Bonne réponse" (écart dans la tolérance CONFIGURÉE POUR
    // CETTE QUESTION, voir payload.tolerance — plus une constante globale
    // fixe, réglable par question depuis l'éditeur), "Presque !" (score
    // partiel touché mais pas assez près) et "Mauvaise réponse" (aucun
    // point). Repli sur GRAD_CORRECT_ABS_TOLERANCE_DEFAULT si absente (vieux
    // quiz sauvegardé avant l'ajout de ce champ) — doit rester cohérent avec
    // la même valeur de repli côté serveur (celui qui détermine le ✓/✗
    // affiché sur la page résultats).
    const target = Number(payload.target)
    const tolerance = Number.isFinite(Number(payload.tolerance)) ? Number(payload.tolerance) : GRAD_CORRECT_ABS_TOLERANCE_DEFAULT
    const range = Math.max(1e-9, gradState.max - gradState.min)
    const absDiff = (Number.isFinite(target) && myGradAnswerValue !== null)
      ? Math.abs(myGradAnswerValue - target)
      : null
    const closeness = absDiff !== null ? Math.max(0, 1 - absDiff / range) : null
    if (absDiff !== null && absDiff <= tolerance) {
      showMyResultBanner()
    } else if (closeness !== null && closeness >= GRAD_PRESQUE_MIN_CLOSENESS && myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! +${myLastDelta} points`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  } else if (payload.type === 'order') {
    revealOrderList(payload.correct || [])
    showMyResultBanner()
  } else if (payload.type === 'association') {
    const correctPairs = payload.correct || []
    revealAssociationPairs(correctPairs)
    const mine = Array.isArray(myAssociationSubmission) ? myAssociationSubmission : []
    const correctCount = correctPairs.reduce((acc, pair, i) => acc + (mine[i] === i ? 1 : 0), 0)
    if (correctCount === correctPairs.length && correctPairs.length > 0) {
      showMyResultBanner()
    } else if (myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! ${correctCount}/${correctPairs.length} associations correctes (+${myLastDelta} points)`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  } else if (payload.type === 'timeline') {
    const correctEvents = payload.correct || []
    revealTimelineList(correctEvents)
    const mine = Array.isArray(myTimelineSubmission) ? myTimelineSubmission : []
    const correctCount = correctEvents.reduce((acc, ev, i) => acc + (mine[i]?.title === ev.title ? 1 : 0), 0)
    if (correctCount === correctEvents.length && correctEvents.length > 0) {
      showMyResultBanner()
    } else if (myAnsweredCorrectlyThisQuestion) {
      showMyResultBanner(`Presque ! ${correctCount}/${correctEvents.length} bien placés (+${myLastDelta} points)`, 'is-close')
    } else {
      showMyResultBanner('Mauvaise réponse', 'is-incorrect')
    }
  } else if (payload.type === 'image') {
    const zones = payload.correct || []
    revealImageZones(zones)
    revealImagePlayerPoints(payload.players)
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
  // Nouvelle révélation : le "+XXX -> fusion" (voir animateScoreGain) doit
  // pouvoir rejouer pour cette question, contrairement à leaderRowsRevealed
  // (l'entrée d'une ligne, elle, ne se rejoue qu'une fois par joueur sur
  // toute la partie).
  leaderScoreAnimated.clear()
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
  // Idem mais pour TOUS les joueurs (pas seulement moi) : sert au "+XXX"
  // affiché sur chaque tuile du classement (voir renderBoard/animateScoreGain).
  if (total > prevTotal) {
    const gained = typeof delta === 'number' ? delta : (total - prevTotal)
    questionDeltas.set(playerId, (questionDeltas.get(playerId) || 0) + gained)
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
