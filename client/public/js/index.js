const socket = io()

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
const gradRuler = document.getElementById('gradRuler')
const gradRulerTrack = document.getElementById('gradRulerTrack')
const gradValueReadout = document.getElementById('gradValueReadout')
const gradMinLabel = document.getElementById('gradMinLabel')
const gradMaxLabel = document.getElementById('gradMaxLabel')
const revealAnswerText = document.getElementById('revealAnswerText')
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

// --- Curseur "règle" : viseur fixe au centre, c'est la graduation qui défile ---
const PX_PER_MAJOR = 72
const gradState = { min: 0, max: 100, value: 50, pxPerUnit: 1, disabled: false }

const niceStep = (range) => {
  const raw = Math.max(range, 1) / 10
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n >= 5 ? 5 : n >= 2 ? 2 : 1
  return Math.max(1, Math.round(m * pow))
}

const applyRulerTransform = () => {
  if (!gradRulerTrack) return
  gradRulerTrack.style.transform = `translateX(${-(gradState.value - gradState.min) * gradState.pxPerUnit}px)`
}

const setRulerValue = (v, animate) => {
  const clamped = Math.min(gradState.max, Math.max(gradState.min, Math.round(v)))
  gradState.value = clamped
  if (gradValueReadout) gradValueReadout.textContent = clamped
  if (gradRulerTrack) gradRulerTrack.style.transition = animate ? '' : 'none'
  applyRulerTransform()
}

const buildRuler = (min, max, value) => {
  if (!gradRuler || !gradRulerTrack) return
  gradState.min = min
  gradState.max = max
  gradState.disabled = false
  gradRuler.classList.remove('reveal')
  const range = max - min
  const major = niceStep(range)
  const minor = Math.max(1, Math.round(major / 5))
  gradState.pxPerUnit = PX_PER_MAJOR / major
  const pad = (gradRuler.clientWidth || 480) / 2
  let html = ''
  for (let v = min; v <= max; v += minor) {
    const isMajor = (v - min) % major === 0
    const left = pad + (v - min) * gradState.pxPerUnit
    html += `<div class="grad-tick ${isMajor ? 'major' : ''}" style="left:${left}px"></div>`
    if (isMajor) html += `<div class="grad-tick-label" style="left:${left}px">${v}</div>`
  }
  gradRulerTrack.innerHTML = html
  setRulerValue(value, false)
  if (gradMinLabel) gradMinLabel.textContent = min
  if (gradMaxLabel) gradMaxLabel.textContent = max
}

if (gradRuler) {
  let dragging = false, startX = 0, startValue = 0
  gradRuler.addEventListener('pointerdown', e => {
    if (gradState.disabled) return
    dragging = true
    startX = e.clientX
    startValue = gradState.value
    try { gradRuler.setPointerCapture(e.pointerId) } catch {}
    gradRuler.classList.add('grabbing')
  })
  gradRuler.addEventListener('pointermove', e => {
    if (!dragging) return
    const dx = e.clientX - startX
    setRulerValue(startValue - dx / gradState.pxPerUnit, false)
  })
  const endDrag = (e) => {
    if (!dragging) return
    dragging = false
    try { gradRuler.releasePointerCapture(e.pointerId) } catch {}
    gradRuler.classList.remove('grabbing')
    setRulerValue(gradState.value, true)
  }
  gradRuler.addEventListener('pointerup', endDrag)
  gradRuler.addEventListener('pointercancel', endDrag)
}

const clearRevealState = () => {
  Array.from(optionsDiv.children).forEach(el => el.classList.remove('correct-reveal', 'incorrect-reveal'))
  if (revealAnswerText) { revealAnswerText.classList.add('d-none'); revealAnswerText.textContent = '' }
  if (gradRuler) gradRuler.classList.remove('reveal')
}

const positionGradTargetMarker = (target) => {
  // Révélation : on bloque le curseur et on fait défiler la règle jusqu'à la
  // bonne valeur (le viseur central atterrit dessus), viseur teinté en vert.
  gradState.disabled = true
  if (gradRuler) gradRuler.classList.add('reveal')
  setRulerValue(Number(target), true)
}

const revealFreeAnswer = (text) => {
  if (!revealAnswerText) return
  revealAnswerText.textContent = `Bonne réponse : ${text}`
  revealAnswerText.classList.remove('d-none')
}
const scores = new Map()
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
        max: q.max
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
      tile.className = `player-tile ${isMe ? 'is-me' : ''}`
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
        <div class="status-badge ${p.ready ? 'status-ready' : 'status-waiting'} ${isMe ? 'btn-ready-toggle' : ''}">
          ${p.ready ? 'Prêt' : 'Attente'}
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

const emitQuestion = (index) => {
  const roomCode = roomInput.value.trim()
  if (!roomCode || !loadedQuiz) return
  const q = loadedQuiz.questions && loadedQuiz.questions[index]
  if (!q) { 
    if (index >= loadedQuiz.questions.length) log('Quizz terminé')
    return 
  }
  const payload = {
    roomCode,
    id: q.id || ('q' + (index + 1)),
    type: q.type || 'free',
    prompt: q.prompt || 'Question',
    timerMs: q.timerMs || 15000,
    correct: Array.isArray(q.correct) ? q.correct : [],
    options: Array.isArray(q.options) ? q.options : [],
    min: q.min,
    max: q.max,
    singleAttempt: currentSingleAttempt
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
  const lobby = document.getElementById('lobby')
  if (lobby) {
    lobby.classList.add('d-none')
    lobby.style.display = 'none'
  }
  const timerContainer = document.getElementById('timerContainer')
  if (timerContainer) {
    timerContainer.classList.remove('d-none')
    timerContainer.style.display = 'flex'
  }
  qDiv.textContent = payload.prompt
  if (inputArea) {
    inputArea.classList.remove('d-none')
    inputArea.style.display = isHost ? 'none' : 'block'
  }
  currentQuestionType = payload.type || 'free'
  if (optionsDiv) {
    optionsDiv.style.display = payload.type === 'mcq' ? 'grid' : 'none'
    if (payload.type === 'mcq') {
      optionsDiv.classList.remove('d-none')
    } else {
      optionsDiv.classList.add('d-none')
    }
  }
  if (graduationArea) {
    graduationArea.classList.toggle('d-none', payload.type !== 'graduation')
  }
  answerInput.value = ''
  answerInput.disabled = false
  sendBtn.disabled = false
  gradState.disabled = false
  selectedMcqOptions = []

  // Show send button for MCQ/graduation too if we want manual validation
  if ((payload.type === 'mcq' || payload.type === 'graduation') && !isHost) {
    document.getElementById('freeText').classList.remove('d-none')
    document.getElementById('freeText').classList.add('mcq-mode')
    answerInput.classList.add('d-none')
    sendBtn.textContent = 'Valider'
    if (payload.type === 'graduation' && gradRuler) {
      const min = Number(payload.min ?? 0)
      const max = Number(payload.max ?? 100)
      const mid = Math.round((min + max) / 2)
      buildRuler(min, max, mid)
    }
  } else {
    document.getElementById('freeText').classList.remove('mcq-mode')
    answerInput.classList.remove('d-none')
    sendBtn.textContent = 'Envoyer'
  }

  currentSingleAttempt = payload.singleAttempt !== false
  const start = payload.startTs
  const total = payload.timerMs
  clearInterval(timerInt)
  
  if (timerBarFill) {
    timerBarFill.classList.remove('timer-urgent')
    timerBarFill.style.width = '100%'
  }

  timerInt = setInterval(() => {
    const now = Date.now()
    const remaining = Math.max(0, total - (now - start))
    const pct = (remaining / total) * 100
    
    if (timerBarFill) {
      timerBarFill.style.width = `${pct}%`
      if (pct <= 20) {
        timerBarFill.classList.add('timer-urgent')
      }
    }
    
    if (timerLabel) {
      timerLabel.textContent = Math.ceil(remaining / 1000)
    }

    if (remaining <= 0) {
      clearInterval(timerInt)
    }
  }, 100)
  optionsDiv.innerHTML = ''
  if (!isHost && payload.type === 'mcq' && Array.isArray(payload.options)) {
    payload.options.forEach(opt => {
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
    })
  }
})

sendBtn.onclick = () => {
  const roomCode = roomInput.value.trim()

  let content = ''

  if (currentQuestionType === 'mcq') {
    if (selectedMcqOptions.length === 0) {
      showAnnounce('Veuillez sélectionner au moins une réponse')
      return
    }
    content = selectedMcqOptions.join(', ')
  } else if (currentQuestionType === 'graduation') {
    content = String(gradState.value)
  } else {
    content = answerInput.value.trim()
    if (!content) return
  }

  if (currentSingleAttempt && sendBtn.disabled) return
  socket.emit('answer:submit', { roomCode, content })

  if (currentSingleAttempt) {
    sendBtn.disabled = true
    answerInput.disabled = true
    gradState.disabled = true
    Array.from(optionsDiv.children).forEach(c => {
      c.style.pointerEvents = 'none'
      if (!c.classList.contains('selected')) {
        c.style.opacity = '0.5'
      }
    })
  }
}

answerInput.addEventListener('keydown', e => { if (e.key === 'Enter') { sendBtn.click() } })

socket.on('answer:ack', () => { log('Réponse envoyée') })

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
toastContainer.style.background = 'var(--color-text)'
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
      requestAnimationFrame(() => {
        row.style.transition = ''
        row.style.transform = ''
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
    inputArea.style.display = 'none'
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
  if (payload.type === 'mcq' && optionsDiv) {
    Array.from(optionsDiv.children).forEach(el => {
      if ((payload.correct || []).includes(el.textContent)) el.classList.add('correct-reveal')
      else el.classList.add('incorrect-reveal')
    })
  } else if (payload.type === 'free') {
    revealFreeAnswer((payload.correct || [])[0] || '')
  } else if (payload.type === 'graduation') {
    positionGradTargetMarker(payload.target)
  }
  if (isHost) { hostPhase = 'revealed'; updateHostControls() }
})

socket.on('leaderboard:show', () => {
  clearRevealState()
  renderBoard()
  leaderOverlay.classList.remove('d-none')
  leaderOverlay.style.display = 'flex'
  if (isHost) { hostPhase = 'leaderboard'; updateHostControls() }
})

socket.on('moderation:finished', () => {
  isModerationPending = false
  renderBoard()
  leaderOverlay.classList.remove('d-none')
  leaderOverlay.style.display = 'flex'
  if (isHost) { hostPhase = 'leaderboard'; updateHostControls() }
})
socket.on('question:show', () => {
  leaderOverlay.style.display = 'none'
  if (isHost) { hostPhase = 'answering'; updateHostControls() }
})

socket.on('score:update', ({ playerId, delta, total }) => {
  const beforeOrder = computeOrder().map(([id]) => id)
  const s = scores.get(playerId) || { name: playerId, total: 0 }
  s.total = total
  scores.set(playerId, s)
  const afterOrder = computeOrder().map(([id]) => id)
  renderBoard()
  
  const myId = window.myId
  if (myId === playerId) {
    const prevPos = beforeOrder.indexOf(myId) >= 0 ? beforeOrder.indexOf(myId) + 1 : null
    const newPos = afterOrder.indexOf(myId) >= 0 ? afterOrder.indexOf(myId) + 1 : null
    if (newPos && prevPos && newPos < prevPos) {
      const passedName = scores.get(afterOrder[newPos])?.name || 'quelqu’un'
      showAnnounce(`WOAW ! Tu passes en ${newPos}ᵉ position, devant ${passedName} !`)
    } else if (newPos && prevPos && newPos > prevPos) {
      const aheadName = scores.get(afterOrder[newPos - 2])?.name || 'quelqu’un'
      showAnnounce(`Oh… Tu descends en ${newPos}ᵉ position, derrière ${aheadName}.`)
    }
  }
})

socket.on('quiz:notReady', ({ message }) => {
  showAnnounce(message)
})
