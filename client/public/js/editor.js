// Éléments du DOM
const titleEl = document.getElementById('title')
const profileLink = document.getElementById('profile')
const sb = window.supabaseClient

const checkAuth = async () => {
  const { data: { session } } = await sb.auth.getSession()

  const navLogin = document.getElementById('navLogin')
  const navCreateEl = document.getElementById('navCreate')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileNameEl = document.getElementById('profileName')

  const canCreate = !!session
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

  if (!session) {
    if (navLogin) navLogin.classList.remove('d-none')
    if (profileLink) profileLink.classList.add('d-none')
    window.location.href = '/login.html?reason=create'
    return
  }

  if (navLogin) navLogin.classList.add('d-none')
  if (profileLink) profileLink.classList.remove('d-none')

  const user = session.user
  let avatarUrl = null
  let displayName = user.user_metadata.full_name || user.email.split('@')[0]
  try {
    const { data: p } = await sb.from('profiles').select('username, avatar_url').eq('id', user.id).single()
    if (p?.username) displayName = p.username
    if (p?.avatar_url) avatarUrl = p.avatar_url
  } catch {}
  if (!avatarUrl) {
    const savedAvatar = localStorage.getItem('queazy_profile_avatar')
    if (savedAvatar) avatarUrl = savedAvatar
  }
  applyAvatar(profileAvatar, displayName, avatarUrl)
  if (profileNameEl) profileNameEl.textContent = firstNameOf(displayName)
}

checkAuth()

const savedAvatarPreview = localStorage.getItem('queazy_profile_avatar')
const profileAvatarPreviewEl = document.getElementById('profileAvatar')
if (savedAvatarPreview && profileAvatarPreviewEl) {
  profileAvatarPreviewEl.style.backgroundImage = 'url(' + savedAvatarPreview + ')'
  profileAvatarPreviewEl.style.backgroundSize = 'cover'
  profileAvatarPreviewEl.style.backgroundPosition = 'center'
}

const singleAttemptEl = document.getElementById('singleAttempt')
const isPublicEl = document.getElementById('isPublic')
const saveQuizBtn = document.getElementById('saveQuiz')
const deleteQuizBtn = document.getElementById('deleteQuiz')
const duplicateQuizBtn = document.getElementById('duplicateQuiz')
const reportQuizBtn = document.getElementById('reportQuizBtn')
const reportPopup = document.getElementById('reportPopup')
const reportReasonInput = document.getElementById('reportReason')
const cancelReportBtn = document.getElementById('cancelReport')
const confirmReportBtn = document.getElementById('confirmReport')
const addQuestionBtn = document.getElementById('addQuestion')
const questionListEl = document.getElementById('questionList')
const questionDetailEl = document.getElementById('questionDetail')
const toastsEl = document.getElementById('toasts')

// Champs de détail de question
const qPrompt = document.getElementById('qPrompt')
const qExplanation = document.getElementById('qExplanation')
const qType = document.getElementById('qType')
// Rendu "maison" (voir js/ui-widgets.js) au lieu du <select> natif — le
// reste du code ci-dessous continue de lire/écrire qType.value, d'écouter
// 'change'/.onchange et de basculer .disabled (applyReadOnly) sans rien
// savoir de ce widget.
if (window.QzUI) window.QzUI.enhanceSelect(qType)
const qTimer = document.getElementById('qTimer')
const timerMinus = document.getElementById('timerMinus')
const timerPlus = document.getElementById('timerPlus')

// --- Événements Timer ---
if (timerMinus && timerPlus && qTimer) {
  timerMinus.onclick = () => {
    let val = parseInt(qTimer.value) || 15
    if (val > 5) {
      val -= 5
      qTimer.value = val
      questions[activeIndex].timerMs = val * 1000
    }
  }
  timerPlus.onclick = () => {
    let val = parseInt(qTimer.value) || 15
    if (val < 120) {
      val += 5
      qTimer.value = val
      questions[activeIndex].timerMs = val * 1000
    }
  }
}

const mcqSection = document.getElementById('mcqSection')
const optionsList = document.getElementById('optionsList')
const addOptionBtn = document.getElementById('addOption')
const correctSection = document.getElementById('correctSection')
const correctList = document.getElementById('correctList')
const addCorrectBtn = document.getElementById('addCorrect')
const deleteQuestionBtn = document.getElementById('deleteQuestion')
const qIndexLabel = document.getElementById('qIndexLabel')
const correctLabel = document.getElementById('correctLabel')

const graduationSection = document.getElementById('graduationSection')
const qGradMin = document.getElementById('qGradMin')
const qGradMax = document.getElementById('qGradMax')
const qGradTarget = document.getElementById('qGradTarget')
const qGradTolerance = document.getElementById('qGradTolerance')

const trueFalseSection = document.getElementById('trueFalseSection')
const tfTrueBtn = document.getElementById('tfTrueBtn')
const tfFalseBtn = document.getElementById('tfFalseBtn')

const orderSection = document.getElementById('orderSection')
const orderEditList = document.getElementById('orderEditList')
const addOrderItemBtn = document.getElementById('addOrderItem')

const associationSection = document.getElementById('associationSection')
const associationEditList = document.getElementById('associationEditList')
const addAssociationPairBtn = document.getElementById('addAssociationPair')
const ASSOCIATION_MIN_PAIRS = 2
const ASSOCIATION_MAX_PAIRS = 8

const timelineSection = document.getElementById('timelineSection')
const timelineEditList = document.getElementById('timelineEditList')
const addTimelineEventBtn = document.getElementById('addTimelineEvent')
const TIMELINE_MIN_EVENTS = 3
const TIMELINE_MAX_EVENTS = 8

const intrusSection = document.getElementById('intrusSection')
const intrusEditList = document.getElementById('intrusEditList')
const addIntrusOptionBtn = document.getElementById('addIntrusOption')
const INTRUS_MIN_OPTIONS = 3
const INTRUS_MAX_OPTIONS = 8

const imageSection = document.getElementById('imageSection')
const imageUploadInput = document.getElementById('imageUpload')
const imageEditViewport = document.getElementById('imageEditViewport')
const imageEditWrap = document.getElementById('imageEditWrap')
const imageEditImg = document.getElementById('imageEditImg')
const imageEditZoneSvg = document.getElementById('imageEditZoneSvg')
const imageEditZonePath = document.getElementById('imageEditZonePath')
const clearImageZoneBtn = document.getElementById('clearImageZoneBtn')
const imageZoomControls = document.getElementById('imageZoomControls')
const imageZoomInBtn = document.getElementById('imageZoomInBtn')
const imageZoomOutBtn = document.getElementById('imageZoomOutBtn')
const imageZoomResetBtn = document.getElementById('imageZoomResetBtn')
const imageZoomLabel = document.getElementById('imageZoomLabel')

// Illustration optionnelle (tous les types SAUF "image", qui a déjà sa propre
// image cliquable ci-dessus) : simple photo affichée au-dessus de la question,
// stockée dans un champ distinct (q.illustration) pour ne jamais se marcher
// dessus avec q.image.
const illustrationSection = document.getElementById('illustrationSection')
const illustrationUploadInput = document.getElementById('illustrationUpload')
const illustrationPreviewWrap = document.getElementById('illustrationPreviewWrap')
const illustrationPreviewImg = document.getElementById('illustrationPreviewImg')
const removeIllustrationBtn = document.getElementById('removeIllustrationBtn')

// Question "blind test" : upload du morceau + recadrage (début/durée) en un
// extrait court, encodé en WAV mono côté client (voir plus bas) — q.audio
// stocke directement l'extrait déjà coupé, jamais le fichier complet importé.
const blindtestSection = document.getElementById('blindtestSection')
const audioUploadInput = document.getElementById('audioUpload')
const audioTrimWrap = document.getElementById('audioTrimWrap')
const audioTrimPlayer = document.getElementById('audioTrimPlayer')
const audioStartInput = document.getElementById('audioStartInput')
const audioDurationInput = document.getElementById('audioDurationInput')
const audioPreviewBtn = document.getElementById('audioPreviewBtn')
const audioExtractBtn = document.getElementById('audioExtractBtn')
const audioClipWrap = document.getElementById('audioClipWrap')
const audioClipPlayer = document.getElementById('audioClipPlayer')
const removeAudioClipBtn = document.getElementById('removeAudioClipBtn')
const correctTitleList = document.getElementById('correctTitleList')
const correctArtistList = document.getElementById('correctArtistList')
const addCorrectTitleBtn = document.getElementById('addCorrectTitle')
const addCorrectArtistBtn = document.getElementById('addCorrectArtist')

const bindGradStepper = (input, minusBtn, plusBtn, onCommit) => {
  const commit = (val) => { input.value = val; onCommit(Number(val) || 0) }
  minusBtn.onclick = () => commit((Number(input.value) || 0) - 1)
  plusBtn.onclick = () => commit((Number(input.value) || 0) + 1)
  input.oninput = () => onCommit(Number(input.value) || 0)
}

if (qGradMin && qGradMax && qGradTarget) {
  bindGradStepper(qGradMin, document.getElementById('gradMinMinus'), document.getElementById('gradMinPlus'), (v) => { if (questions[activeIndex]) questions[activeIndex].min = v })
  bindGradStepper(qGradMax, document.getElementById('gradMaxMinus'), document.getElementById('gradMaxPlus'), (v) => { if (questions[activeIndex]) questions[activeIndex].max = v })
  bindGradStepper(qGradTarget, document.getElementById('gradTargetMinus'), document.getElementById('gradTargetPlus'), (v) => { if (questions[activeIndex]) questions[activeIndex].correct = [String(v)] })
  // Écart accepté comme "Bonne réponse !" (voir server/index.js
  // GRAD_CORRECT_ABS_TOLERANCE) — jamais négatif, un écart ne se compte pas
  // en dessous de zéro. Re-clampe aussi la valeur AFFICHÉE (pas seulement
  // celle stockée) : sans ça, un clic sur "-" à 0 affichait -1 dans le champ
  // tout en gardant 0 en mémoire, désynchronisé.
  bindGradStepper(qGradTolerance, document.getElementById('gradToleranceMinus'), document.getElementById('gradTolerancePlus'), (v) => {
    const clamped = Math.max(0, v)
    if (clamped !== v) qGradTolerance.value = clamped
    if (questions[activeIndex]) questions[activeIndex].tolerance = clamped
  })
}

// État de l'application
let currentId = null
let questions = []
let activeIndex = 0
let hasSelectedOnce = false
let readOnly = false // true si on ouvre le quiz d'un autre créateur (lecture seule)

// Passe l'éditeur en lecture seule : désactive toutes les saisies, masque
// enregistrer/supprimer et affiche un bandeau. Les lignes d'options/réponses
// recréées dynamiquement sont gérées via le drapeau readOnly dans createInputRow.
const applyReadOnly = () => {
  readOnly = true
  const controls = [
    titleEl, singleAttemptEl, isPublicEl, qPrompt, qType, qTimer, timerMinus, timerPlus,
    addQuestionBtn, deleteQuestionBtn, addOptionBtn, addCorrectBtn,
    addAssociationPairBtn, addTimelineEventBtn, addIntrusOptionBtn,
    qGradMin, qGradMax, qGradTarget, qGradTolerance, tfTrueBtn, tfFalseBtn, addOrderItemBtn, imageUploadInput,
    clearImageZoneBtn, illustrationUploadInput, removeIllustrationBtn,
    audioUploadInput, audioStartInput, audioDurationInput, audioPreviewBtn, audioExtractBtn,
    removeAudioClipBtn, addCorrectTitleBtn, addCorrectArtistBtn,
    document.getElementById('gradMinMinus'), document.getElementById('gradMinPlus'),
    document.getElementById('gradMaxMinus'), document.getElementById('gradMaxPlus'),
    document.getElementById('gradTargetMinus'), document.getElementById('gradTargetPlus'),
    document.getElementById('gradToleranceMinus'), document.getElementById('gradTolerancePlus')
  ]
  controls.forEach(el => { if (el) el.disabled = true })
  if (saveQuizBtn) saveQuizBtn.style.display = 'none'
  if (deleteQuizBtn) deleteQuizBtn.style.display = 'none'
  if (duplicateQuizBtn) duplicateQuizBtn.classList.remove('d-none')
  if (reportQuizBtn) reportQuizBtn.classList.remove('d-none')
  const banner = document.getElementById('readOnlyBanner')
  if (banner) banner.classList.remove('d-none')
}

// --- Utilitaires ---

// Délègue au composant partagé (voir js/ui-widgets.js, QzUI.toast) plutôt
// que de dupliquer le rendu ici — repli minimal si le script n'a pas chargé.
const showToast = (msg, type = 'info') => {
  if (window.QzUI) { window.QzUI.toast(msg, type); return }
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = msg
  t.style.padding = '12px 20px'
  t.style.borderRadius = '12px'
  t.style.boxShadow = 'var(--shadow-lg)'
  t.style.fontWeight = '600'
  t.style.fontSize = '14px'
  t.style.color = 'white'
  t.style.background = type === 'error' ? '#ef4444' : 'var(--color-accent)'
  toastsEl.appendChild(t)
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300) }, 3000)
}

// --- Logique de l'Éditeur ---

const createDefaultQuestion = () => ({
  type: 'free',
  prompt: '',
  options: [],
  correct: [''],
  timerMs: 15000
})

const moveQuestion = (fromIdx, toIdx) => {
  if (fromIdx === toIdx) return
  const [moved] = questions.splice(fromIdx, 1)
  questions.splice(toIdx, 0, moved)
  // L'index de la question actuellement ouverte doit suivre son contenu, pas
  // sa position numérique : sinon, après un déplacement, l'éditeur continue
  // d'afficher les champs d'une AUTRE question sans que rien ne le signale.
  if (activeIndex === fromIdx) activeIndex = toIdx
  else if (fromIdx < activeIndex && toIdx >= activeIndex) activeIndex -= 1
  else if (fromIdx > activeIndex && toIdx <= activeIndex) activeIndex += 1
  updateSidebar()
  qIndexLabel.textContent = `Question ${activeIndex + 1} / ${questions.length}`
}

// Même glisser au pointeur que la liste "ordre" en jeu (voir index.js
// wireOrderDrag) et que la liste de réponses "ordre" de cet éditeur (voir
// wireOrderEditDrag plus bas) : rects des AUTRES lignes figés une seule fois
// au pointerdown, la ligne saisie suit le pointeur via son propre transform,
// un "newSlot" recalculé à chaque mouvement à partir de ces rects figés, et
// un seul réordonnancement (via moveQuestion) au relâchement. Remplace
// l'ancienne implémentation en API HTML5 Drag and Drop (ghost par défaut du
// navigateur, moins fluide, pas de retour visuel de poussée).
// Toute la tuile reste cliquable pour sélectionner la question (comme avant)
// : le geste n'est traité comme un glisser qu'au-delà d'un petit seuil de
// déplacement, sinon un simple clic (sans bouger) sélectionne normalement.
const QUESTION_LIST_GAP = 8
const QUESTION_DRAG_THRESHOLD = 4
let questionDragActive = false

const wireQuestionDrag = (item, idx) => {
  let dragMoved = false

  item.addEventListener('click', () => {
    if (dragMoved) { dragMoved = false; return }
    selectQuestion(idx)
  })

  if (readOnly) return

  item.addEventListener('pointerdown', (e) => {
    if (questionDragActive || e.button) return
    questionDragActive = true
    dragMoved = false
    const startY = e.clientY
    let dragStarted = false
    let others, baseRects, startSlot, itemHeight, currentSlot

    const beginDrag = () => {
      dragStarted = true
      dragMoved = true
      item.classList.add('dragging')
      item.style.zIndex = '10'
      try { item.setPointerCapture(e.pointerId) } catch {}
      others = Array.from(questionListEl.children).filter(c => c !== item)
      baseRects = others.map(c => c.getBoundingClientRect())
      startSlot = Array.from(questionListEl.children).indexOf(item)
      itemHeight = item.getBoundingClientRect().height + QUESTION_LIST_GAP
      currentSlot = startSlot
    }

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      if (!dragStarted) {
        if (Math.abs(dy) < QUESTION_DRAG_THRESHOLD) return
        beginDrag()
      }
      item.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = item.getBoundingClientRect()
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
      item.removeEventListener('pointermove', onMove)
      item.removeEventListener('pointerup', onUp)
      item.removeEventListener('pointercancel', onCancel)
      questionDragActive = false
      if (!dragStarted) return
      others.forEach(c => { c.style.transition = ''; c.style.transform = '' })
      item.classList.remove('dragging')
      item.style.zIndex = ''
      item.style.transform = ''
      if (applyReorder && currentSlot !== startSlot) {
        if (hasSelectedOnce) saveCurrentQuestionState()
        moveQuestion(startSlot, currentSlot)
      }
    }
    const onUp = (ev) => { try { item.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    item.addEventListener('pointermove', onMove)
    item.addEventListener('pointerup', onUp)
    item.addEventListener('pointercancel', onCancel)
  })
}

const updateSidebar = () => {
  questionListEl.innerHTML = ''
  questions.forEach((q, idx) => {
    const item = document.createElement('div')
    item.className = `question-item type-${q.type || 'free'} ${idx === activeIndex ? 'active' : ''}`.trim()
    item.dataset.index = idx
    wireQuestionDrag(item, idx)

    const handle = document.createElement('span')
    handle.className = 'q-drag-handle'
    handle.textContent = '⠿'
    handle.title = 'Glisser pour réordonner'

    const num = document.createElement('span')
    num.className = 'q-num'
    num.textContent = idx + 1

    const text = document.createElement('span')
    text.className = 'q-text'
    text.textContent = q.prompt || '(Nouvelle question)'

    if (!readOnly) item.appendChild(handle)
    item.appendChild(num)
    item.appendChild(text)
    questionListEl.appendChild(item)
  })
}

const populateGradFields = (q) => {
  if (!qGradMin) return
  qGradMin.value = q.min ?? 0
  qGradMax.value = q.max ?? 100
  qGradTarget.value = q.correct?.[0] ?? 50
  qGradTolerance.value = q.tolerance ?? 0
}

const populateTrueFalseFields = (q) => {
  if (!tfTrueBtn) return
  const isTrue = (q.correct?.[0] ?? 'Vrai') === 'Vrai'
  tfTrueBtn.classList.toggle('active', isTrue)
  tfFalseBtn.classList.toggle('active', !isTrue)
}

// Zone(s) de bonne réponse (type "image") : une ou plusieurs formes tracées à
// main levée directement sur l'image (voir zone-geometry.js), chacune
// stockée en coordonnées normalisées 0-1 sous la forme { points: [{x,y},...] }.
// Les anciens quiz stockent encore des rectangles { x0,y0,x1,y1 } : les deux
// formats cohabitent, zoneToPolygonPoints() les ramène à une liste de points
// commune partout où c'est nécessaire (affichage, clic pour supprimer, score).
// Plusieurs zones indépendantes sont autorisées (ex. deux formes disjointes
// toutes les deux valides) ; contrairement aux rectangles, pas de fusion —
// une forme libre n'a pas de grille naturelle sur laquelle fusionner, et deux
// formes qui se touchent restent correctes affichées superposées.
// Pose directement l'attribut "d" (déjà construit) — utilisé aussi bien pour
// les zones confirmées (renderImageZones ci-dessous) que pour la
// prévisualisation du tracé en cours, qui a besoin d'un "d" composite
// (zones confirmées + tracé ouvert, voir plus bas).
const setImageZonePathD = (d) => {
  if (!imageEditZoneSvg || !imageEditZonePath) return
  if (!d) {
    imageEditZoneSvg.classList.add('d-none')
    imageEditZonePath.setAttribute('d', '')
    return
  }
  imageEditZoneSvg.classList.remove('d-none')
  imageEditZonePath.setAttribute('d', d)
}

const renderImageZones = (zones) => {
  const list = Array.isArray(zones) ? zones : []
  setImageZonePathD(list.length ? zonesToSvgPath(list) : '')
}

// En dessous de cette taille (boîte englobante du tracé, normalisée), on
// considère le geste comme un clic plutôt qu'un vrai tracé, et on regarde
// s'il tombe dans une zone existante (pour la supprimer) au lieu de créer une
// nouvelle zone quasi ponctuelle.
const IMAGE_ZONE_MIN_SIZE = 0.015
// Distance minimale (normalisée) entre deux points consécutifs enregistrés
// du tracé — sans ce filtre, un mousemove à haute fréquence produirait des
// milliers de points quasi identiques pour un simple geste de la souris.
const IMAGE_ZONE_MIN_POINT_DIST = 0.006

if (imageEditWrap) {
  let currentPath = null // tableau de points en cours de tracé, ou null si aucun tracé actif
  const pointFromEvent = (e) => {
    const rect = imageEditWrap.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    }
  }
  imageEditWrap.addEventListener('mousedown', (e) => {
    if (readOnly || !questions[activeIndex]?.image) return
    currentPath = [pointFromEvent(e)]
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => {
    if (!currentPath || !questions[activeIndex]) return
    const pt = pointFromEvent(e)
    const last = currentPath[currentPath.length - 1]
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < IMAGE_ZONE_MIN_POINT_DIST) return
    currentPath.push(pt)
    // Prévisualisation en direct : les zones déjà validées (fermées, comme
    // d'habitude) + le tracé en cours EN OUVERT (pas de segment de fermeture
    // tant que le clic n'est pas relâché — la fermeture géométrique réelle
    // n'a lieu qu'au mouseup, voir plus bas).
    const confirmedD = zonesToSvgPath(questions[activeIndex].correct || [])
    const liveD = pointsToOpenSvgPath(currentPath)
    setImageZonePathD([confirmedD, liveD].filter(Boolean).join(' '))
  })
  window.addEventListener('mouseup', () => {
    if (!currentPath) return
    const path = currentPath
    currentPath = null
    const q = questions[activeIndex]
    if (!q) return
    if (!Array.isArray(q.correct)) q.correct = []

    const xs = path.map(p => p.x), ys = path.map(p => p.y)
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    if (w < IMAGE_ZONE_MIN_SIZE && h < IMAGE_ZONE_MIN_SIZE) {
      // Tracé trop petit pour être une vraie forme : traité comme un clic.
      // S'il tombe DANS une zone existante, on la retire (clic pour
      // désélectionner) ; sinon on ignore (clic accidentel dans le vide).
      const idx = q.correct.findIndex(zone => pointInPolygon(path[0], zoneToPolygonPoints(zone)))
      if (idx !== -1) q.correct.splice(idx, 1)
      renderImageZones(q.correct)
      return
    }
    q.correct.push({ points: path })
    renderImageZones(q.correct)
  })
}

if (clearImageZoneBtn) {
  clearImageZoneBtn.onclick = () => {
    if (readOnly || !questions[activeIndex]) return
    questions[activeIndex].correct = []
    renderImageZones([])
  }
}

// Zoom sur l'image pendant le tracé des zones (type "image") : largeur en
// pixels posée explicitement en JS (plutôt que la propriété CSS "zoom", qui
// s'est révélée peu fiable selon les navigateurs — l'image ne grandissait
// pas vraiment, seul le tracé semblait épaissir). #imageEditWrap n'a plus de
// largeur en % ni de max-width fixe dans le CSS/HTML : sa largeur EST
// IMAGE_ZOOM_BASE_WIDTH * imageEditZoom, un point. L'image et le SVG restent
// à width:100% de ce wrap (voir CSS), donc les deux grandissent ensemble.
// getBoundingClientRect() (utilisé par pointFromEvent) reste juste à
// n'importe quel niveau de zoom puisque c'est une vraie taille de mise en
// page, pas un simple effet visuel. Le viewport parent (overflow: auto) sert
// de cadre défilable pour se déplacer une fois zoomé.
const IMAGE_ZOOM_BASE_WIDTH = 480 // px, correspond à l'ancien max-width (zoom = 1)
const IMAGE_ZOOM_MIN = 1
const IMAGE_ZOOM_MAX = 4
const IMAGE_ZOOM_STEP = 0.25
let imageEditZoom = 1

const applyImageEditZoom = () => {
  if (!imageEditWrap) return
  const px = Math.round(IMAGE_ZOOM_BASE_WIDTH * imageEditZoom)
  imageEditWrap.style.width = px + 'px'
  if (imageZoomLabel) imageZoomLabel.textContent = Math.round(imageEditZoom * 100) + '%'
  if (imageZoomOutBtn) imageZoomOutBtn.disabled = imageEditZoom <= IMAGE_ZOOM_MIN
  if (imageZoomInBtn) imageZoomInBtn.disabled = imageEditZoom >= IMAGE_ZOOM_MAX
}

const setImageEditZoom = (z) => {
  imageEditZoom = Math.min(IMAGE_ZOOM_MAX, Math.max(IMAGE_ZOOM_MIN, z))
  applyImageEditZoom()
}

// Zoom centré sur le curseur (comme Google Maps/Figma) : le point de l'image
// qui se trouve sous la souris reste visuellement au même endroit à l'écran
// avant/après le zoom, en rattrapant le scroll du viewport en conséquence.
// clientX/clientY en coordonnées écran (comme un event de souris).
const IMAGE_ZOOM_WHEEL_STEP = 0.18
const zoomImageEditTowardPoint = (newZoom, clientX, clientY) => {
  if (!imageEditWrap || !imageEditViewport) { setImageEditZoom(newZoom); return }
  const viewportRect = imageEditViewport.getBoundingClientRect()
  const mouseX = clientX - viewportRect.left
  const mouseY = clientY - viewportRect.top
  const oldWidth = imageEditWrap.offsetWidth || 1
  const oldHeight = imageEditWrap.offsetHeight || 1
  // Position du point visé, en fraction (0-1) de l'image entière — repère
  // stable qui ne dépend pas du zoom courant.
  const fracX = (imageEditViewport.scrollLeft + mouseX) / oldWidth
  const fracY = (imageEditViewport.scrollTop + mouseY) / oldHeight

  setImageEditZoom(newZoom)

  imageEditViewport.scrollLeft = fracX * imageEditWrap.offsetWidth - mouseX
  imageEditViewport.scrollTop = fracY * imageEditWrap.offsetHeight - mouseY
}

if (imageZoomInBtn) imageZoomInBtn.onclick = () => setImageEditZoom(imageEditZoom + IMAGE_ZOOM_STEP)
if (imageZoomOutBtn) imageZoomOutBtn.onclick = () => setImageEditZoom(imageEditZoom - IMAGE_ZOOM_STEP)
if (imageZoomResetBtn) imageZoomResetBtn.onclick = () => setImageEditZoom(1)
// Molette directement sur l'image = zoome vers le curseur (pas besoin de
// Ctrl) : c'est le geste demandé pour viser précisément sans lâcher la
// souris. Le viewport garde ses scrollbars pour se déplacer une fois zoomé
// (glisser la barre, ou dézoomer).
if (imageEditViewport) {
  imageEditViewport.addEventListener('wheel', (e) => {
    e.preventDefault()
    const step = e.deltaY < 0 ? IMAGE_ZOOM_WHEEL_STEP : -IMAGE_ZOOM_WHEEL_STEP
    zoomImageEditTowardPoint(imageEditZoom + step, e.clientX, e.clientY)
  }, { passive: false })
}

const populateImageFields = (q) => {
  if (!imageEditWrap) return
  if (q.image) {
    imageEditImg.src = q.image
    imageEditWrap.classList.remove('d-none')
    if (imageZoomControls) imageZoomControls.classList.remove('d-none')
    setImageEditZoom(1) // pas de zoom qui traîne d'une question à l'autre
    renderImageZones(q.correct)
  } else {
    imageEditWrap.classList.add('d-none')
    if (imageZoomControls) imageZoomControls.classList.add('d-none')
  }
}

// Garde-fous techniques sur l'upload : "accept=image/*" sur l'input n'est
// qu'une suggestion du sélecteur de fichier, pas une vraie protection — on
// vérifie le type réel, on plafonne la taille brute, puis on redimensionne
// et recompresse systématiquement via un canvas. Ça évite à la fois les
// fichiers énormes/mal formés et les lignes de quiz qui gonflent en base.
// Partagé entre l'image cliquable du type "image" et l'illustration
// optionnelle des autres types (même pipeline, juste stocké différemment).
const IMAGE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 Mo, avant compression
const IMAGE_MAX_DIMENSION = 1280
const IMAGE_JPEG_QUALITY = 0.8

const compressImageFile = (file, onSuccess) => {
  if (!file) return
  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Ce fichier n\'est pas une image', 'error')
    return
  }
  if (file.size > IMAGE_MAX_UPLOAD_BYTES) {
    showToast('Image trop lourde (10 Mo max)', 'error')
    return
  }
  const img = new Image()
  const objectUrl = URL.createObjectURL(file)
  img.onload = () => {
    URL.revokeObjectURL(objectUrl)
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    // Recompressée en JPEG : plus léger que le PNG d'origine pour une
    // photo, et taille finale plafonnée quelle que soit l'image importée.
    onSuccess(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY))
  }
  img.onerror = () => {
    // Le type MIME annonçait une image mais le navigateur n'a pas pu la
    // décoder : fichier corrompu ou pas réellement une image malgré
    // l'extension/le type déclaré.
    URL.revokeObjectURL(objectUrl)
    showToast('Impossible de lire cette image', 'error')
  }
  img.src = objectUrl
}

if (imageUploadInput) {
  imageUploadInput.onchange = () => {
    const file = imageUploadInput.files && imageUploadInput.files[0]
    // Permet de reproposer le même fichier après une erreur (sinon le
    // navigateur ne redéclenche pas onchange si on reprend le même fichier).
    imageUploadInput.value = ''
    if (!file || !questions[activeIndex]) return
    compressImageFile(file, (dataUrl) => {
      questions[activeIndex].image = dataUrl
      populateImageFields(questions[activeIndex])
    })
  }
}

const populateIllustrationFields = (q) => {
  if (!illustrationPreviewWrap) return
  if (q.illustration) {
    illustrationPreviewImg.src = q.illustration
    illustrationPreviewWrap.classList.remove('d-none')
  } else {
    illustrationPreviewWrap.classList.add('d-none')
  }
}

if (illustrationUploadInput) {
  illustrationUploadInput.onchange = () => {
    const file = illustrationUploadInput.files && illustrationUploadInput.files[0]
    illustrationUploadInput.value = ''
    if (!file || !questions[activeIndex]) return
    compressImageFile(file, (dataUrl) => {
      questions[activeIndex].illustration = dataUrl
      populateIllustrationFields(questions[activeIndex])
    })
  }
}

if (removeIllustrationBtn) {
  removeIllustrationBtn.onclick = () => {
    if (!questions[activeIndex]) return
    questions[activeIndex].illustration = null
    populateIllustrationFields(questions[activeIndex])
  }
}

// --- Question "blind test" : upload + recadrage audio ---
// q.audio stocke directement l'extrait déjà coupé (jamais le fichier
// complet importé) : on décode le fichier importé en mémoire (Web Audio
// API), l'utilisateur choisit un début/une durée en le prévisualisant via
// un <audio> classique, puis on découpe le buffer décodé et on le
// réencode nous-mêmes en WAV mono (pas de librairie : juste écrire
// l'en-tête WAV + les échantillons PCM 16 bits à la main). Mono plutôt que
// stéréo : divise le poids par 2, largement suffisant pour reconnaître un
// morceau dans un quiz.
const AUDIO_MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 Mo — le fichier importé (piste complète ou déjà coupée), jamais stocké tel quel
const AUDIO_CLIP_MAX_DURATION = 30 // secondes — plafond de l'extrait réellement conservé, pour garder un poids raisonnable
let pendingAudioBuffer = null // AudioBuffer décodé du fichier en cours d'import, tant que l'extrait n'a pas été validé
let pendingAudioObjectUrl = null
let audioPreviewTimeout = null

const clampAudioTrimInputs = () => {
  if (!pendingAudioBuffer) return
  const maxDuration = Math.min(AUDIO_CLIP_MAX_DURATION, pendingAudioBuffer.duration)
  let duration = Math.min(maxDuration, Math.max(1, Number(audioDurationInput.value) || 1))
  let start = Math.max(0, Math.min(Number(audioStartInput.value) || 0, pendingAudioBuffer.duration - duration))
  audioDurationInput.value = Math.round(duration)
  audioStartInput.value = Math.round(start)
}

const encodeWavMono = (audioBuffer, startSec, durationSec) => {
  const sampleRate = audioBuffer.sampleRate
  const startSample = Math.max(0, Math.floor(startSec * sampleRate))
  const numSamples = Math.max(0, Math.min(Math.floor(durationSec * sampleRate), audioBuffer.length - startSample))
  const channels = audioBuffer.numberOfChannels
  const mono = new Float32Array(numSamples)
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c)
    for (let i = 0; i < numSamples; i++) mono[i] += data[startSample + i] / channels
  }
  const bytesPerSample = 2
  const byteRate = sampleRate * bytesPerSample
  const dataSize = numSamples * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true)
  view.setUint16(32, bytesPerSample, true); view.setUint16(34, 16, true)
  writeStr(36, 'data'); view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(blob)
})

const populateAudioFields = (q) => {
  if (!audioClipWrap) return
  if (q.audio) {
    audioClipPlayer.src = q.audio
    audioClipWrap.classList.remove('d-none')
  } else {
    audioClipPlayer.removeAttribute('src')
    audioClipWrap.classList.add('d-none')
  }
}

if (audioUploadInput) {
  audioUploadInput.onchange = () => {
    const file = audioUploadInput.files && audioUploadInput.files[0]
    audioUploadInput.value = ''
    if (!file || !questions[activeIndex]) return
    if (!file.type || !file.type.startsWith('audio/')) {
      showToast('Ce fichier n\'est pas un audio', 'error')
      return
    }
    if (file.size > AUDIO_MAX_UPLOAD_BYTES) {
      showToast('Fichier audio trop lourd (25 Mo max)', 'error')
      return
    }
    if (pendingAudioObjectUrl) URL.revokeObjectURL(pendingAudioObjectUrl)
    pendingAudioObjectUrl = URL.createObjectURL(file)
    audioTrimPlayer.src = pendingAudioObjectUrl
    file.arrayBuffer().then(buf => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      return ctx.decodeAudioData(buf).finally(() => ctx.close())
    }).then(audioBuffer => {
      pendingAudioBuffer = audioBuffer
      audioStartInput.value = 0
      audioDurationInput.value = Math.min(15, Math.floor(audioBuffer.duration))
      clampAudioTrimInputs()
      audioTrimWrap.classList.remove('d-none')
    }).catch(() => {
      showToast('Impossible de lire ce fichier audio', 'error')
    })
  }
}

if (audioStartInput) audioStartInput.oninput = clampAudioTrimInputs
if (audioDurationInput) audioDurationInput.oninput = clampAudioTrimInputs

if (audioPreviewBtn) {
  audioPreviewBtn.onclick = () => {
    if (!pendingAudioBuffer) return
    clampAudioTrimInputs()
    const start = Number(audioStartInput.value) || 0
    const duration = Number(audioDurationInput.value) || 1
    if (audioPreviewTimeout) clearTimeout(audioPreviewTimeout)
    audioTrimPlayer.currentTime = start
    audioTrimPlayer.play().catch(() => {})
    audioPreviewTimeout = setTimeout(() => audioTrimPlayer.pause(), duration * 1000)
  }
}

if (audioExtractBtn) {
  audioExtractBtn.onclick = async () => {
    if (!pendingAudioBuffer || !questions[activeIndex]) {
      showToast('Importe d\'abord un fichier audio', 'error')
      return
    }
    clampAudioTrimInputs()
    const start = Number(audioStartInput.value) || 0
    const duration = Number(audioDurationInput.value) || 1
    const blob = encodeWavMono(pendingAudioBuffer, start, duration)
    const dataUrl = await blobToDataUrl(blob)
    questions[activeIndex].audio = dataUrl
    populateAudioFields(questions[activeIndex])
    showToast('Extrait audio prêt !')
  }
}

if (removeAudioClipBtn) {
  removeAudioClipBtn.onclick = () => {
    if (!questions[activeIndex]) return
    questions[activeIndex].audio = null
    populateAudioFields(questions[activeIndex])
  }
}

// Deux listes indépendantes de réponses acceptées (titre / artiste), sur le
// même composant createInputRow que les autres types — juste dupliqué une
// fois par champ. q.correct = { title: [...], artist: [...] } pour ce type
// (au lieu d'un simple tableau comme les autres types).
const renderCorrectFieldList = (field, listEl) => {
  if (!listEl) return
  listEl.innerHTML = ''
  const q = questions[activeIndex]
  // Appelée sans condition à chaque sélection de question (voir selectQuestion
  // ci-dessous), comme les autres render*() : sans ce garde-fou par type, elle
  // écraserait le q.correct (tableau) d'un AUTRE type par l'objet {title,artist}.
  if (!q || q.type !== 'blindtest') return
  if (!q.correct || Array.isArray(q.correct)) q.correct = { title: [''], artist: [''] }
  if (!Array.isArray(q.correct[field]) || q.correct[field].length === 0) q.correct[field] = ['']

  q.correct[field].forEach((val, idx) => {
    const row = createInputRow(val, (v) => {
      q.correct[field][idx] = v
    }, () => {
      if (q.correct[field].length > 1) {
        q.correct[field].splice(idx, 1)
        renderCorrectFieldList(field, listEl)
      } else {
        showToast('Il faut au moins une réponse acceptée', 'error')
      }
    }, false)
    listEl.appendChild(row)
  })
}
const renderCorrectTitleList = () => renderCorrectFieldList('title', correctTitleList)
const renderCorrectArtistList = () => renderCorrectFieldList('artist', correctArtistList)

if (addCorrectTitleBtn) {
  addCorrectTitleBtn.onclick = () => {
    if (!questions[activeIndex]) return
    if (!questions[activeIndex].correct || Array.isArray(questions[activeIndex].correct)) questions[activeIndex].correct = { title: [''], artist: [''] }
    questions[activeIndex].correct.title.push('')
    renderCorrectTitleList()
  }
}
if (addCorrectArtistBtn) {
  addCorrectArtistBtn.onclick = () => {
    if (!questions[activeIndex]) return
    if (!questions[activeIndex].correct || Array.isArray(questions[activeIndex].correct)) questions[activeIndex].correct = { title: [''], artist: [''] }
    questions[activeIndex].correct.artist.push('')
    renderCorrectArtistList()
  }
}

const selectQuestion = (index) => {
  if (hasSelectedOnce) saveCurrentQuestionState()
  activeIndex = index
  const q = questions[activeIndex]
  if (!q) return

  // Mettre à jour les champs
  qPrompt.value = q.prompt || ''
  if (qExplanation) qExplanation.value = q.explanation || ''
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  populateGradFields(q)
  populateTrueFalseFields(q)
  populateImageFields(q)
  populateIllustrationFields(q)
  populateAudioFields(q)

  renderOptions()
  renderCorrects()
  renderOrderItems()
  renderCorrectTitleList()
  renderCorrectArtistList()
  renderAssociationPairs()
  renderTimelineEvents()
  renderIntrusOptions()
  toggleTypeSections()
  updateSidebar()

  qIndexLabel.textContent = `Question ${activeIndex + 1} / ${questions.length}`

  // Mettre le focus sur l'énoncé pour une saisie rapide
  qPrompt.focus()
  hasSelectedOnce = true
}

const saveCurrentQuestionState = () => {
  if (activeIndex < 0 || activeIndex >= questions.length) return

  const q = questions[activeIndex]
  q.prompt = qPrompt.value.trim()
  if (qExplanation) q.explanation = qExplanation.value.trim()
  q.type = qType.value
  q.timerMs = parseInt(qTimer.value) * 1000 || 15000
  if (q.type === 'graduation') {
    q.min = Number(qGradMin.value)
    q.max = Number(qGradMax.value)
    q.correct = [String(qGradTarget.value)]
    q.tolerance = Math.max(0, Number(qGradTolerance.value) || 0)
  } else if (q.type === 'truefalse') {
    // Options fixes ; q.correct est déjà tenu à jour par les boutons Vrai/Faux
    // (voir plus bas), on s'assure juste qu'il reste valide.
    q.options = ['Vrai', 'Faux']
    if (q.correct?.[0] !== 'Vrai' && q.correct?.[0] !== 'Faux') q.correct = ['Vrai']
  }
}

const toggleTypeSections = () => {
  mcqSection.classList.toggle('d-none', qType.value !== 'mcq')
  if (graduationSection) graduationSection.classList.toggle('d-none', qType.value !== 'graduation')
  if (trueFalseSection) trueFalseSection.classList.toggle('d-none', qType.value !== 'truefalse')
  if (orderSection) orderSection.classList.toggle('d-none', qType.value !== 'order')
  if (imageSection) imageSection.classList.toggle('d-none', qType.value !== 'image')
  if (blindtestSection) blindtestSection.classList.toggle('d-none', qType.value !== 'blindtest')
  if (associationSection) associationSection.classList.toggle('d-none', qType.value !== 'association')
  if (timelineSection) timelineSection.classList.toggle('d-none', qType.value !== 'timeline')
  if (intrusSection) intrusSection.classList.toggle('d-none', qType.value !== 'intrus')
  // L'illustration optionnelle n'a de sens que pour les types qui n'ont pas
  // déjà leur propre image (le type "image" utilise la sienne comme cible
  // cliquable, pas comme simple décoration).
  if (illustrationSection) illustrationSection.classList.toggle('d-none', qType.value === 'image')
  // "blindtest" a ses deux propres listes de réponses (titre/artiste, voir
  // blindtestSection ci-dessus) au lieu de la liste générique "correct".
  // "mcq" a aussi sa propre façon de désigner la bonne réponse : la case à
  // cocher sur chaque option (voir renderOptions), qui alimente déjà
  // entièrement q.correct — la liste "correct" générique ci-dessous ferait
  // donc double emploi (retaper le texte d'une réponse déjà cochée), d'où
  // la confusion remontée par l'utilisateur. Seul "free" (texte libre, pas
  // d'options à cocher) a encore besoin de cette liste. "association" /
  // "timeline" / "intrus" ont chacun leur propre section ci-dessus.
  if (correctSection) correctSection.classList.toggle('d-none', qType.value !== 'free')
  correctLabel.textContent = 'Réponses acceptées'
}

if (tfTrueBtn && tfFalseBtn) {
  tfTrueBtn.onclick = () => { if (questions[activeIndex]) questions[activeIndex].correct = ['Vrai']; populateTrueFalseFields(questions[activeIndex]) }
  tfFalseBtn.onclick = () => { if (questions[activeIndex]) questions[activeIndex].correct = ['Faux']; populateTrueFalseFields(questions[activeIndex]) }
}

const renderOptions = () => {
  optionsList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q) return
  // "blindtest" range ses réponses acceptées dans q.correct = {title, artist}
  // (pas un tableau) : les .includes/.indexOf ci-dessous plantent sur un objet,
  // et cette fonction ne sert de toute façon à rien pour ce type (pas d'options QCM).
  if (q.type === 'blindtest') return
  if (!q.options) q.options = []
  
  q.options.forEach((opt, idx) => {
    const isCorrect = q.correct.includes(opt) && opt.trim() !== ''
    const row = createInputRow(opt, (val) => {
      // Si on change le texte d'une option qui était correcte, on met à jour le tableau correct
      const oldVal = q.options[idx]
      q.options[idx] = val
      const cIdx = q.correct.indexOf(oldVal)
      if (cIdx !== -1) {
        q.correct[cIdx] = val
      }
    }, () => {
      const val = q.options[idx]
      q.options.splice(idx, 1)
      const cIdx = q.correct.indexOf(val)
      if (cIdx !== -1) q.correct.splice(cIdx, 1)
      renderOptions()
    }, true, isCorrect, (checked) => {
      const val = q.options[idx]
      if (checked) {
        if (!q.correct.includes(val)) q.correct.push(val)
      } else {
        const cIdx = q.correct.indexOf(val)
        if (cIdx !== -1) q.correct.splice(cIdx, 1)
      }
    })
    optionsList.appendChild(row)
  })
}

const renderCorrects = () => {
  correctList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q) return
  // "blindtest" a ses deux propres listes (renderCorrectTitleList/Artist) et
  // q.correct = {title, artist}, pas un tableau — voir renderOptions ci-dessus.
  // "mcq" pilote q.correct via les cases à cocher des options (voir
  // renderOptions) : cette liste-ci reste cachée pour ce type (voir
  // toggleTypeSections), pas la peine de la peupler pour autant.
  if (q.type === 'blindtest' || q.type === 'mcq') return
  if (!q.correct) q.correct = ['']
  
  q.correct.forEach((cor, idx) => {
    const row = createInputRow(cor, (val) => {
      q.correct[idx] = val
    }, () => {
      if (q.correct.length > 1) {
        q.correct.splice(idx, 1)
        renderCorrects()
      } else {
        showToast('Il faut au moins une réponse correcte', 'error')
      }
    }, false)
    correctList.appendChild(row)
  })
}

// Même glisser au pointeur que la liste "ordre" en jeu (voir index.js
// wireOrderDrag) : rects des AUTRES lignes figés une seule fois au
// pointerdown, la ligne saisie suit le pointeur via son propre transform, un
// "newSlot" recalculé à chaque mouvement à partir de ces rects figés, et un
// seul réordonnancement (ici : un seul splice de q.correct) au relâchement —
// jamais de mutation cumulative pendant le geste.
const ORDER_EDIT_LIST_GAP = 8
let orderEditDragActive = false

// Toute la ligne est saisissable (pas seulement la poignée ⠿), sauf le champ
// texte et le bouton supprimer, qui doivent garder leur propre comportement
// (édition/clic) plutôt que de déclencher un glisser.
const wireOrderEditDrag = (row) => {
  row.addEventListener('pointerdown', (e) => {
    if (readOnly || orderEditDragActive) return
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return
    e.preventDefault()
    orderEditDragActive = true
    const startY = e.clientY
    row.classList.add('dragging')
    try { row.setPointerCapture(e.pointerId) } catch {}

    const others = Array.from(orderEditList.children).filter(c => c !== row)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(orderEditList.children).indexOf(row)
    const itemHeight = row.getBoundingClientRect().height + ORDER_EDIT_LIST_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      row.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = row.getBoundingClientRect()
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
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onCancel)
      orderEditDragActive = false
      const q = questions[activeIndex]
      if (applyReorder && currentSlot !== startSlot && q && Array.isArray(q.correct)) {
        const [moved] = q.correct.splice(startSlot, 1)
        q.correct.splice(currentSlot, 0, moved)
      }
      // Reconstruction complète plutôt qu'un simple insertBefore : les lignes
      // portent un <input> texte librement édité, un rendu frais à partir de
      // q.correct est la seule source de vérité fiable (numéros, closures).
      renderOrderItems()
    }
    const onUp = (ev) => { try { row.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onCancel)
  })
}

const renderOrderItems = () => {
  if (!orderEditList) return
  orderEditList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q) return
  // Sans ce garde-fou, le "!Array.isArray(q.correct)" juste en dessous serait
  // vrai pour "blindtest" (q.correct = {title, artist}, pas un tableau) et
  // écraserait silencieusement ses réponses acceptées à chaque sélection.
  if (q.type === 'blindtest') return
  if (!Array.isArray(q.correct) || q.correct.length === 0) q.correct = ['', '']

  q.correct.forEach((item, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row'
    row.dataset.index = idx

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
      wireOrderEditDrag(row)
    }

    const num = document.createElement('span')
    num.className = 'order-edit-num'
    num.textContent = idx + 1
    row.appendChild(num)

    const input = document.createElement('input')
    input.type = 'text'
    input.value = item
    input.placeholder = 'Élément ' + (idx + 1)
    input.style.flex = '1'
    input.disabled = readOnly
    input.oninput = (e) => { q.correct[idx] = e.target.value }
    row.appendChild(input)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.correct.length <= 2) {
          showToast('Il faut au moins 2 éléments à ordonner', 'error')
          return
        }
        q.correct.splice(idx, 1)
        renderOrderItems()
      }
      row.appendChild(del)
    }

    orderEditList.appendChild(row)
  })
}

if (addOrderItemBtn) {
  addOrderItemBtn.onclick = () => {
    if (!questions[activeIndex]) return
    if (!Array.isArray(questions[activeIndex].correct)) questions[activeIndex].correct = []
    questions[activeIndex].correct.push('')
    renderOrderItems()
  }
}

// --- Question "association" : q.correct = [{a, b}, ...] -------------------
// La paire i associe TOUJOURS a[i] à b[i] (voir server/index.js) : réordonner
// les paires ici change donc aussi quel A correspond à quel B, pas seulement
// l'ordre d'affichage — cohérent avec ce qu'attend le joueur (mélange fait
// côté client au lancement de la question, voir index.js emitQuestion).
const isValidAssociationPairs = (correct) =>
  Array.isArray(correct) && correct.length >= 1 &&
  correct.every(p => p && typeof p === 'object' && typeof p.a === 'string' && typeof p.b === 'string')

// Même glisser au pointeur que renderOrderItems ci-dessus (voir son
// commentaire pour le détail du mécanisme : rects figés au pointerdown, un
// seul splice au relâchement).
const ASSOCIATION_EDIT_LIST_GAP = 8
let associationEditDragActive = false

const wireAssociationEditDrag = (row) => {
  row.addEventListener('pointerdown', (e) => {
    if (readOnly || associationEditDragActive) return
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return
    e.preventDefault()
    associationEditDragActive = true
    const startY = e.clientY
    row.classList.add('dragging')
    try { row.setPointerCapture(e.pointerId) } catch {}

    const others = Array.from(associationEditList.children).filter(c => c !== row)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(associationEditList.children).indexOf(row)
    const itemHeight = row.getBoundingClientRect().height + ASSOCIATION_EDIT_LIST_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      row.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = row.getBoundingClientRect()
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
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onCancel)
      associationEditDragActive = false
      const q = questions[activeIndex]
      if (applyReorder && currentSlot !== startSlot && q && Array.isArray(q.correct)) {
        const [moved] = q.correct.splice(startSlot, 1)
        q.correct.splice(currentSlot, 0, moved)
      }
      renderAssociationPairs()
    }
    const onUp = (ev) => { try { row.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onCancel)
  })
}

const renderAssociationPairs = () => {
  if (!associationEditList) return
  associationEditList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q || q.type !== 'association') return
  if (!isValidAssociationPairs(q.correct)) q.correct = [{ a: '', b: '' }, { a: '', b: '' }]

  q.correct.forEach((pair, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row'
    row.dataset.index = idx

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
      wireAssociationEditDrag(row)
    }

    const num = document.createElement('span')
    num.className = 'order-edit-num'
    num.textContent = idx + 1
    row.appendChild(num)

    const inputA = document.createElement('input')
    inputA.type = 'text'
    inputA.value = pair.a
    inputA.placeholder = 'Élément A'
    inputA.style.flex = '1'
    inputA.disabled = readOnly
    inputA.oninput = (e) => { pair.a = e.target.value }
    row.appendChild(inputA)

    const arrow = document.createElement('span')
    arrow.textContent = '↔'
    arrow.className = 'text-muted'
    arrow.style.padding = '0 4px'
    row.appendChild(arrow)

    const inputB = document.createElement('input')
    inputB.type = 'text'
    inputB.value = pair.b
    inputB.placeholder = 'Élément B'
    inputB.style.flex = '1'
    inputB.disabled = readOnly
    inputB.oninput = (e) => { pair.b = e.target.value }
    row.appendChild(inputB)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.correct.length <= ASSOCIATION_MIN_PAIRS) {
          showToast(`Il faut au moins ${ASSOCIATION_MIN_PAIRS} paires`, 'error')
          return
        }
        q.correct.splice(idx, 1)
        renderAssociationPairs()
      }
      row.appendChild(del)
    }

    associationEditList.appendChild(row)
  })
}

if (addAssociationPairBtn) {
  addAssociationPairBtn.onclick = () => {
    const q = questions[activeIndex]
    if (!q) return
    if (!isValidAssociationPairs(q.correct)) q.correct = []
    if (q.correct.length >= ASSOCIATION_MAX_PAIRS) {
      showToast(`Maximum ${ASSOCIATION_MAX_PAIRS} paires`, 'error')
      return
    }
    q.correct.push({ a: '', b: '' })
    renderAssociationPairs()
  }
}

// --- Question "timeline" : q.correct = [{title, description, date}, ...] -
// Stocké dans l'ordre de SAISIE du créateur, PAS forcément trié par date —
// c'est le serveur qui retrie systématiquement par "date" au moment du
// score et de la révélation (voir server/index.js answer:submit/
// revealQuestion), jamais l'ordre de stockage brut. "date" n'est qu'un
// nombre (année) : accepte les négatifs (avant J.-C.), pas de date
// calendaire complète (jour/mois) dans cette version.
const isValidTimelineEvents = (correct) =>
  Array.isArray(correct) && correct.length >= 1 &&
  correct.every(e => e && typeof e === 'object' && typeof e.title === 'string')

const TIMELINE_EDIT_LIST_GAP = 8
let timelineEditDragActive = false

const wireTimelineEditDrag = (row) => {
  row.addEventListener('pointerdown', (e) => {
    if (readOnly || timelineEditDragActive) return
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return
    e.preventDefault()
    timelineEditDragActive = true
    const startY = e.clientY
    row.classList.add('dragging')
    try { row.setPointerCapture(e.pointerId) } catch {}

    const others = Array.from(timelineEditList.children).filter(c => c !== row)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(timelineEditList.children).indexOf(row)
    const itemHeight = row.getBoundingClientRect().height + TIMELINE_EDIT_LIST_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      row.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = row.getBoundingClientRect()
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
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onCancel)
      timelineEditDragActive = false
      const q = questions[activeIndex]
      if (applyReorder && currentSlot !== startSlot && q && Array.isArray(q.correct)) {
        const [moved] = q.correct.splice(startSlot, 1)
        q.correct.splice(currentSlot, 0, moved)
      }
      renderTimelineEvents()
    }
    const onUp = (ev) => { try { row.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onCancel)
  })
}

const renderTimelineEvents = () => {
  if (!timelineEditList) return
  timelineEditList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q || q.type !== 'timeline') return
  if (!isValidTimelineEvents(q.correct)) q.correct = [{ title: '', description: '', date: 0 }, { title: '', description: '', date: 0 }, { title: '', description: '', date: 0 }]

  q.correct.forEach((ev, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row timeline-edit-row'
    row.dataset.index = idx

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
      wireTimelineEditDrag(row)
    }

    const num = document.createElement('span')
    num.className = 'order-edit-num'
    num.textContent = idx + 1
    row.appendChild(num)

    const fields = document.createElement('div')
    fields.className = 'timeline-edit-fields'

    const titleInput = document.createElement('input')
    titleInput.type = 'text'
    titleInput.value = ev.title || ''
    titleInput.placeholder = 'Titre de l\'événement'
    titleInput.disabled = readOnly
    titleInput.oninput = (e) => { ev.title = e.target.value }
    fields.appendChild(titleInput)

    const descInput = document.createElement('input')
    descInput.type = 'text'
    descInput.value = ev.description || ''
    descInput.placeholder = 'Description courte (optionnelle)'
    descInput.disabled = readOnly
    descInput.oninput = (e) => { ev.description = e.target.value }
    fields.appendChild(descInput)

    const dateInput = document.createElement('input')
    dateInput.type = 'number'
    dateInput.className = 'timeline-date-input'
    dateInput.value = ev.date ?? 0
    dateInput.placeholder = 'Année (ex: 1789, -450)'
    dateInput.title = 'Sert uniquement à calculer l\'ordre correct — jamais montré aux joueurs avant la révélation'
    dateInput.disabled = readOnly
    dateInput.oninput = (e) => { ev.date = e.target.value === '' ? 0 : Number(e.target.value) }
    fields.appendChild(dateInput)

    row.appendChild(fields)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.correct.length <= TIMELINE_MIN_EVENTS) {
          showToast(`Il faut au moins ${TIMELINE_MIN_EVENTS} événements`, 'error')
          return
        }
        q.correct.splice(idx, 1)
        renderTimelineEvents()
      }
      row.appendChild(del)
    }

    timelineEditList.appendChild(row)
  })
}

if (addTimelineEventBtn) {
  addTimelineEventBtn.onclick = () => {
    const q = questions[activeIndex]
    if (!q) return
    if (!isValidTimelineEvents(q.correct)) q.correct = []
    if (q.correct.length >= TIMELINE_MAX_EVENTS) {
      showToast(`Maximum ${TIMELINE_MAX_EVENTS} événements`, 'error')
      return
    }
    q.correct.push({ title: '', description: '', date: 0 })
    renderTimelineEvents()
  }
}

// --- Question "intrus" : q.options = [texte, ...] (3 à 8), q.correct = ----
// [texteDeLIntrus] — même format qu'un tableau à une seule réponse acceptée
// (comme "truefalse"), pour que le serveur réutilise tel quel le chemin de
// scoring binaire mcq/truefalse (voir server/index.js). Un <input
// type="radio"> par ligne (même groupe "name") garantit par construction
// qu'un seul intrus peut être coché à la fois — impossible d'en avoir 0 ou
// plusieurs une fois qu'une sélection a été faite.
const INTRUS_RADIO_NAME = 'intrusRadio'
const ORDER_LIST_LIKE_GAP = 8
let intrusEditDragActive = false

const wireIntrusEditDrag = (row) => {
  row.addEventListener('pointerdown', (e) => {
    if (readOnly || intrusEditDragActive) return
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return
    e.preventDefault()
    intrusEditDragActive = true
    const startY = e.clientY
    row.classList.add('dragging')
    try { row.setPointerCapture(e.pointerId) } catch {}

    const others = Array.from(intrusEditList.children).filter(c => c !== row)
    const baseRects = others.map(c => c.getBoundingClientRect())
    const startSlot = Array.from(intrusEditList.children).indexOf(row)
    const itemHeight = row.getBoundingClientRect().height + ORDER_LIST_LIKE_GAP
    let currentSlot = startSlot

    const onMove = (ev) => {
      const dy = ev.clientY - startY
      row.style.transform = `translateY(${dy}px) scale(1.02)`
      const rect = row.getBoundingClientRect()
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
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onCancel)
      intrusEditDragActive = false
      const q = questions[activeIndex]
      if (applyReorder && currentSlot !== startSlot && q && Array.isArray(q.options)) {
        const [moved] = q.options.splice(startSlot, 1)
        q.options.splice(currentSlot, 0, moved)
      }
      renderIntrusOptions()
    }
    const onUp = (ev) => { try { row.releasePointerCapture(ev.pointerId) } catch {}; cleanup(true) }
    const onCancel = () => cleanup(false)

    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onCancel)
  })
}

const renderIntrusOptions = () => {
  if (!intrusEditList) return
  intrusEditList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q || q.type !== 'intrus') return
  if (!Array.isArray(q.options) || q.options.length < INTRUS_MIN_OPTIONS) q.options = ['', '', '']
  if (!Array.isArray(q.correct)) q.correct = []

  q.options.forEach((opt, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row'
    row.dataset.index = idx

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
      wireIntrusEditDrag(row)
    }

    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = INTRUS_RADIO_NAME
    radio.className = 'checkbox-custom mr-8'
    radio.checked = q.correct[0] === opt && opt.trim() !== ''
    radio.title = 'Marquer comme intrus'
    radio.disabled = readOnly
    radio.onchange = () => { q.correct = [q.options[idx]] }
    row.appendChild(radio)

    const input = document.createElement('input')
    input.type = 'text'
    input.value = opt
    input.placeholder = 'Proposition ' + (idx + 1)
    input.style.flex = '1'
    input.disabled = readOnly
    input.oninput = (e) => {
      const wasIntrus = q.correct[0] === q.options[idx]
      q.options[idx] = e.target.value
      if (wasIntrus) q.correct = [e.target.value]
    }
    row.appendChild(input)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.options.length <= INTRUS_MIN_OPTIONS) {
          showToast(`Il faut au moins ${INTRUS_MIN_OPTIONS} propositions`, 'error')
          return
        }
        const wasIntrus = q.correct[0] === q.options[idx]
        q.options.splice(idx, 1)
        if (wasIntrus) q.correct = []
        renderIntrusOptions()
      }
      row.appendChild(del)
    }

    intrusEditList.appendChild(row)
  })
}

if (addIntrusOptionBtn) {
  addIntrusOptionBtn.onclick = () => {
    const q = questions[activeIndex]
    if (!q) return
    if (!Array.isArray(q.options)) q.options = []
    if (q.options.length >= INTRUS_MAX_OPTIONS) {
      showToast(`Maximum ${INTRUS_MAX_OPTIONS} propositions`, 'error')
      return
    }
    q.options.push('')
    renderIntrusOptions()
  }
}

const createInputRow = (value, onInput, onDelete, showCheck = false, isChecked = false, onCheck = null) => {
  const div = document.createElement('div')
  div.className = 'option-row'
  
  if (showCheck) {
    const check = document.createElement('input')
    check.type = 'checkbox'
    check.className = 'checkbox-custom mr-8'
    check.checked = isChecked
    check.title = 'Marquer comme réponse correcte'
    check.disabled = readOnly
    check.onchange = (e) => onCheck(e.target.checked)
    div.appendChild(check)
  }

  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  input.placeholder = 'Entrez du texte...'
  input.style.flex = '1'
  input.disabled = readOnly
  input.oninput = (e) => onInput(e.target.value)

  div.appendChild(input)

  if (!readOnly) {
    const del = document.createElement('button')
    del.className = 'btn-icon btn-danger'
    del.innerHTML = '&times;'
    del.onclick = onDelete
    div.appendChild(del)
  }
  return div
}

// --- Événements ---

qType.onchange = () => {
  const q = questions[activeIndex]
  q.type = qType.value
  if (qType.value === 'graduation') {
    if (q.min === undefined) q.min = 0
    if (q.max === undefined) q.max = 100
    if (!q.correct || !q.correct[0]) q.correct = ['50']
    populateGradFields(q)
  } else if (qType.value === 'truefalse') {
    q.options = ['Vrai', 'Faux']
    if (q.correct?.[0] !== 'Vrai' && q.correct?.[0] !== 'Faux') q.correct = ['Vrai']
    populateTrueFalseFields(q)
  } else if (qType.value === 'order') {
    // q.correct venant d'un autre type (une seule réponse acceptée, options
    // QCM...) n'a pas de sens comme séquence à ordonner : on repart propre
    // sauf s'il contient déjà au moins 2 éléments (ex. retour sur ce type).
    if (!Array.isArray(q.correct) || q.correct.length < 2) q.correct = ['', '']
  } else if (qType.value === 'image') {
    // q.correct venant d'un autre type (texte, séquence...) ne correspond pas
    // au format zone attendu ({points:[...]} ou {x0,y0,x1,y1} legacy) : on
    // repart propre sauf s'il a déjà la bonne forme (ex. retour sur ce type).
    if (!Array.isArray(q.correct) || !q.correct.some(zone => zoneToPolygonPoints(zone).length >= 3)) q.correct = []
    populateImageFields(q)
  } else if (qType.value === 'blindtest') {
    // q.correct venant d'un autre type est un tableau, pas l'objet
    // {title, artist} attendu ici : on repart propre sauf s'il a déjà la bonne
    // forme (ex. retour sur ce type).
    if (!q.correct || Array.isArray(q.correct)) q.correct = { title: [''], artist: [''] }
    populateAudioFields(q)
  } else if (qType.value === 'association') {
    // q.correct venant d'un autre type n'a pas la forme [{a,b}, ...]
    // attendue ici : on repart propre sauf s'il a déjà cette forme (ex.
    // retour sur ce type).
    if (!isValidAssociationPairs(q.correct)) q.correct = [{ a: '', b: '' }, { a: '', b: '' }]
  } else if (qType.value === 'timeline') {
    // q.correct venant d'un autre type n'a pas la forme
    // [{title,description,date}, ...] attendue ici : on repart propre sauf
    // s'il a déjà cette forme (ex. retour sur ce type).
    if (!isValidTimelineEvents(q.correct)) q.correct = [{ title: '', description: '', date: 0 }, { title: '', description: '', date: 0 }, { title: '', description: '', date: 0 }]
  } else if (qType.value === 'intrus') {
    // q.options venant d'un autre type n'a pas forcément 3-8 entrées ; q.correct
    // venant d'un autre type (blindtest {title,artist}, association [{a,b}]...)
    // ne correspond pas au format [texteIntrus] attendu ici : on repart
    // propre dans les deux cas, sauf s'ils ont déjà la bonne forme.
    if (!Array.isArray(q.options) || q.options.length < INTRUS_MIN_OPTIONS) q.options = ['', '', '']
    if (!Array.isArray(q.correct) || q.correct.length !== 1) q.correct = []
  }
  toggleTypeSections()
  renderOptions()
  renderCorrects()
  renderOrderItems()
  renderCorrectTitleList()
  renderCorrectArtistList()
  renderAssociationPairs()
  renderTimelineEvents()
  renderIntrusOptions()
}

qPrompt.oninput = () => {
  questions[activeIndex].prompt = qPrompt.value
  // Mettre à jour seulement le texte dans la sidebar pour la fluidité
  const activeItem = questionListEl.children[activeIndex]
  if (activeItem) {
    activeItem.querySelector('.q-text').textContent = qPrompt.value || '(Nouvelle question)'
  }
}
if (qExplanation) {
  qExplanation.oninput = () => { questions[activeIndex].explanation = qExplanation.value }
}

addQuestionBtn.onclick = () => {
  questions.push(createDefaultQuestion())
  selectQuestion(questions.length - 1)
}

deleteQuestionBtn.onclick = () => {
  if (questions.length <= 1) {
    showToast('Un quiz doit avoir au moins une question', 'error')
    return
  }
  
  questions.splice(activeIndex, 1)
  const nextIndex = Math.max(0, activeIndex - 1)
  
  // On force le passage à une autre question sans essayer de sauver la question supprimée
  activeIndex = nextIndex
  const q = questions[activeIndex]
  
  qPrompt.value = q.prompt || ''
  if (qExplanation) qExplanation.value = q.explanation || ''
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  populateGradFields(q)
  populateTrueFalseFields(q)
  populateImageFields(q)
  populateIllustrationFields(q)
  populateAudioFields(q)

  renderOptions()
  renderCorrects()
  renderOrderItems()
  renderCorrectTitleList()
  renderCorrectArtistList()
  renderAssociationPairs()
  renderTimelineEvents()
  renderIntrusOptions()
  toggleTypeSections()
  updateSidebar()

  qIndexLabel.textContent = `Question ${activeIndex + 1} / ${questions.length}`
  qPrompt.focus()
}

addOptionBtn.onclick = () => {
  questions[activeIndex].options.push('')
  renderOptions()
}

addCorrectBtn.onclick = () => {
  questions[activeIndex].correct.push('')
  renderCorrects()
}
saveQuizBtn.onclick = async () => {
  if (readOnly) return
  saveCurrentQuestionState()

  // Validation avant sauvegarde
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]

    // Vérifier l'énoncé (commun à tous les types)
    if (!q.prompt || q.prompt.trim() === '') {
      selectQuestion(i)
      showToast(`La question ${i + 1} n'a pas d'énoncé`, 'error')
      return
    }

    if (q.type === 'mcq') {
      // Au moins une option non vide
      const validOptions = (q.options || []).filter(o => o && o.trim() !== '')
      if (validOptions.length === 0) {
        selectQuestion(i)
        showToast(`Le QCM ${i + 1} doit avoir au moins une option de réponse`, 'error')
        return
      }
      // Au moins une option cochée comme correcte
      const hasChecked = validOptions.some(o => (q.correct || []).includes(o))
      if (!hasChecked) {
        selectQuestion(i)
        showToast(`Le QCM ${i + 1} : cochez au moins une bonne réponse`, 'error')
        return
      }
    } else if (q.type === 'free') {
      // Au moins une réponse acceptée renseignée
      const hasAnswer = (q.correct || []).some(c => c && c.trim() !== '')
      if (!hasAnswer) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : renseignez au moins une réponse acceptée`, 'error')
        return
      }
    }

    // Pour les curseurs numériques, vérifier la cohérence min/max/cible
    if (q.type === 'graduation') {
      const min = Number(q.min), max = Number(q.max), target = Number(q.correct?.[0])
      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target)) {
        selectQuestion(i)
        showToast(`Le curseur ${i + 1} a des valeurs invalides`, 'error')
        return
      }
      if (min >= max) {
        selectQuestion(i)
        showToast(`Le curseur ${i + 1} : le minimum doit être inférieur au maximum`, 'error')
        return
      }
      if (target < min || target > max) {
        selectQuestion(i)
        showToast(`Le curseur ${i + 1} : la valeur correcte doit être entre le min et le max`, 'error')
        return
      }
    }

    // Pour l'ordre/classement, il faut au moins 2 éléments non vides
    if (q.type === 'order') {
      const validItems = (q.correct || []).filter(item => item && item.trim() !== '')
      if (validItems.length < 2) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : il faut au moins 2 éléments à ordonner`, 'error')
        return
      }
    }

    // Pour "association", entre 2 et 8 paires, chaque élément A et B rempli
    if (q.type === 'association') {
      const pairs = Array.isArray(q.correct) ? q.correct : []
      if (pairs.length < ASSOCIATION_MIN_PAIRS || pairs.length > ASSOCIATION_MAX_PAIRS) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : il faut entre ${ASSOCIATION_MIN_PAIRS} et ${ASSOCIATION_MAX_PAIRS} paires`, 'error')
        return
      }
      const hasEmpty = pairs.some(p => !p.a || !p.a.trim() || !p.b || !p.b.trim())
      if (hasEmpty) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : chaque paire doit avoir ses deux éléments remplis`, 'error')
        return
      }
    }

    // Pour "timeline", entre 3 et 8 événements, chacun avec un titre et une
    // date numérique valide (l'ordre correct est calculé côté serveur à
    // partir de "date", peu importe l'ordre de saisie ici).
    if (q.type === 'timeline') {
      const events = Array.isArray(q.correct) ? q.correct : []
      if (events.length < TIMELINE_MIN_EVENTS || events.length > TIMELINE_MAX_EVENTS) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : il faut entre ${TIMELINE_MIN_EVENTS} et ${TIMELINE_MAX_EVENTS} événements`, 'error')
        return
      }
      const hasEmptyTitle = events.some(e => !e.title || !e.title.trim())
      if (hasEmptyTitle) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : chaque événement doit avoir un titre`, 'error')
        return
      }
      const hasInvalidDate = events.some(e => !Number.isFinite(Number(e.date)))
      if (hasInvalidDate) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : chaque événement doit avoir une date (année) valide`, 'error')
        return
      }
    }

    // Pour "intrus", entre 3 et 8 propositions toutes remplies, et
    // exactement un intrus désigné (le radio garantit déjà "au plus un" côté
    // UI ; ici on vérifie qu'il y en a bien "au moins un").
    if (q.type === 'intrus') {
      const opts = Array.isArray(q.options) ? q.options : []
      if (opts.length < INTRUS_MIN_OPTIONS || opts.length > INTRUS_MAX_OPTIONS) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : il faut entre ${INTRUS_MIN_OPTIONS} et ${INTRUS_MAX_OPTIONS} propositions`, 'error')
        return
      }
      const hasEmptyOption = opts.some(o => !o || !o.trim())
      if (hasEmptyOption) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : chaque proposition doit être remplie`, 'error')
        return
      }
      if (!Array.isArray(q.correct) || q.correct.length !== 1 || !opts.includes(q.correct[0])) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : désigne l'intrus parmi les propositions`, 'error')
        return
      }
    }

    // Pour "image", il faut une image importée et une case désignée
    if (q.type === 'image') {
      if (!q.image) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : importe une image`, 'error')
        return
      }
      if (!Array.isArray(q.correct) || !q.correct.some(zone => zoneToPolygonPoints(zone).length >= 3)) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : trace une zone sur l'image pour indiquer la bonne réponse`, 'error')
        return
      }
    }

    // Pour "blindtest", il faut un extrait audio validé et au moins une
    // réponse acceptée pour CHAQUE champ (titre ET artiste)
    if (q.type === 'blindtest') {
      if (!q.audio) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : importe et valide un extrait audio`, 'error')
        return
      }
      const hasTitle = (q.correct?.title || []).some(c => c && c.trim() !== '')
      if (!hasTitle) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : renseigne au moins un titre accepté`, 'error')
        return
      }
      const hasArtist = (q.correct?.artist || []).some(c => c && c.trim() !== '')
      if (!hasArtist) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : renseigne au moins un artiste accepté`, 'error')
        return
      }
    }
  }
  
  const title = titleEl.value.trim() || 'Mon Quiz sans titre'
  const body = {
    title,
    questions,
    singleAttempt: singleAttemptEl.checked,
    isPublic: isPublicEl.checked
  }
  const sb = window.supabaseClient
  try {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      showToast('Connecte-toi pour sauvegarder', 'error')
      return
    }
    if (currentId) {
      const { error } = await sb.from('quizzes')
        .update({ title, questions, single_attempt: body.singleAttempt, is_public: body.isPublic })
        .eq('id', currentId)
      if (error) throw error
      showToast('Quiz sauvegardé avec succès !')
    } else {
      const { data, error } = await sb.from('quizzes')
        .insert([{ title, questions, single_attempt: body.singleAttempt, is_public: body.isPublic, owner_id: session.user.id }])
        .select('id')
        .single()
      if (error) throw error
      currentId = data.id
      showToast('Quiz créé et sauvegardé !')
    }
  } catch (err) {
    showToast('Erreur: ' + (err.message || 'sauvegarde'), 'error')
  }
}

// Dupliquer le quiz d'un autre créateur dans mes propres quiz (copie privée éditable)
if (duplicateQuizBtn) {
  duplicateQuizBtn.onclick = async () => {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { window.location.href = '/login.html?reason=create'; return }
    const srcTitle = titleEl.value.trim() || 'Quiz'
    duplicateQuizBtn.disabled = true
    try {
      const { data, error } = await sb.from('quizzes')
        .insert([{
          title: 'Copie de ' + srcTitle,
          questions,
          single_attempt: singleAttemptEl.checked,
          is_public: false, // une copie est privée par défaut
          owner_id: session.user.id
        }])
        .select('id')
        .single()
      if (error) throw error
      showToast('Quiz dupliqué dans tes quiz !')
      window.location.href = '/editor.html?id=' + encodeURIComponent(data.id)
    } catch (err) {
      duplicateQuizBtn.disabled = false
      showToast('Erreur lors de la duplication : ' + (err.message || ''), 'error')
    }
  }
}

// Signaler le quiz d'un autre créateur (contenu inapproprié, image
// problématique...) — insertion dans la table reports, consultée à la main
// depuis le dashboard Supabase. Aucune action automatique sur le quiz : la
// modération reste manuelle.
if (reportQuizBtn && reportPopup) {
  reportQuizBtn.onclick = () => {
    reportReasonInput.value = ''
    reportPopup.classList.remove('d-none')
  }
  cancelReportBtn.onclick = () => { reportPopup.classList.add('d-none') }
  confirmReportBtn.onclick = async () => {
    if (!currentId) { reportPopup.classList.add('d-none'); return }
    confirmReportBtn.disabled = true
    try {
      const { data: { session } } = await sb.auth.getSession()
      const { error } = await sb.from('reports').insert([{
        quiz_id: currentId,
        reporter_id: session?.user?.id || null,
        reason: reportReasonInput.value.trim() || null
      }])
      if (error) throw error
      reportPopup.classList.add('d-none')
      showToast('Merci, ton signalement a été envoyé.')
    } catch (err) {
      showToast('Erreur lors de l\'envoi du signalement : ' + (err.message || ''), 'error')
    } finally {
      confirmReportBtn.disabled = false
    }
  }
}

deleteQuizBtn.onclick = async () => {
  if (readOnly) return
  if (!currentId) return
  const ok = window.QzUI
    ? await window.QzUI.confirm({ title: 'Supprimer ce quiz ?', message: 'Cette action est définitive et ne peut pas être annulée.', confirmLabel: 'Supprimer', danger: true })
    : confirm('Voulez-vous vraiment supprimer ce quiz ?')
  if (!ok) return
  const sb = window.supabaseClient
  sb.from('quizzes').delete().eq('id', currentId)
    .then(({ error }) => {
      if (error) throw error
      window.location.href = '/select.html'
    })
    .catch(err => showToast(err.message, 'error'))
}

// --- Initialisation ---

const init = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const id = urlParams.get('id')
  
  if (id) {
    currentId = id
    window.supabaseClient.from('quizzes')
      .select('id,title,questions,single_attempt,is_public,owner_id')
      .eq('id', id)
      .single()
      .then(async ({ data, error }) => {
        if (error) throw error
        titleEl.value = data.title || ''
        singleAttemptEl.checked = data.single_attempt !== false
        isPublicEl.checked = !!data.is_public
        questions = data.questions || [createDefaultQuestion()]
        activeIndex = 0
        selectQuestion(0)
        updateSidebar()

        // Seul le créateur peut modifier : sinon, lecture seule (la base le
        // refuse déjà via RLS, mais on l'empêche aussi dans l'UI).
        const { data: { session } } = await sb.auth.getSession()
        if (!session || session.user.id !== data.owner_id) {
          applyReadOnly()
        }
      })
      .catch(() => {
        showToast('Erreur lors du chargement du quiz', 'error')
        resetToNew()
      })
  } else {
    resetToNew()
  }
  
  // Avatar profil
  const savedAvatar = localStorage.getItem('queazy_profile_avatar')
  const profileAvatarEl = document.getElementById('profileAvatar')
  if (savedAvatar && profileAvatarEl) {
    profileAvatarEl.style.backgroundImage = `url(${savedAvatar})`
    profileAvatarEl.style.backgroundSize = 'cover'
  }
}

const resetToNew = () => {
  currentId = null
  questions = [createDefaultQuestion()]
  activeIndex = 0
  titleEl.value = ''
  isPublicEl.checked = false
  selectQuestion(0)
  updateSidebar()
}

// Logo animation
const brand = document.querySelector('.brand')
if (brand) {
  brand.addEventListener('mouseenter', () => {
    brand.classList.remove('animate-logo')
    void brand.offsetWidth
    brand.classList.add('animate-logo')
  })
}

init()
