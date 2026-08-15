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
const replayTutorialBtn = document.getElementById('replayTutorialBtn')
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
const qDraftToggle = document.getElementById('qDraftToggle')
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
  // Saisie directe (retour utilisateur : champ passé en "readonly" par
  // erreur, impossible d'y taper une valeur — seuls - / + fonctionnaient).
  // onchange (au blur/Enter, pas à chaque frappe) : cloner le clampage sur
  // 'input' aurait re-clampé "1" en "5" dès la première frappe de "15",
  // empêchant de jamais taper la suite.
  qTimer.onchange = () => {
    const val = Math.min(120, Math.max(5, parseInt(qTimer.value) || 15))
    qTimer.value = val
    if (questions[activeIndex]) questions[activeIndex].timerMs = val * 1000
  }
}

const mcqSection = document.getElementById('mcqSection')
const optionsList = document.getElementById('optionsList')
const addOptionBtn = document.getElementById('addOption')
// "Toutes les bonnes réponses doivent être cochées pour valider" (QCM à
// plusieurs bonnes réponses) : q.requireAllCorrect, undefined/true = ancien
// comportement (ensemble exact attendu, jamais cassé pour un quiz déjà
// sauvegardé), false = au moins une bonne cochée (et aucune mauvaise) suffit
// — voir server/index.js answer:submit pour le calcul réel du score.
const mcqRequireAllToggle = document.getElementById('mcqRequireAllToggle')
if (mcqRequireAllToggle) {
  mcqRequireAllToggle.onchange = () => {
    const q = questions[activeIndex]
    if (!q) return
    q.requireAllCorrect = mcqRequireAllToggle.checked
  }
}
// Bornes homogènes avec les autres types (association/timeline/intrus, voir
// plus bas) : sans plafond, rien n'empêchait d'empiler des dizaines
// d'options QCM (constaté : 12+ sans le moindre garde-fou) — 8 reste
// largement assez pour un quiz jouable, et cohérent d'un type à l'autre.
const MCQ_MIN_OPTIONS = 2
const MCQ_MAX_OPTIONS = 8

// Garde-fous de longueur sur les champs de texte libre (retour utilisateur :
// "éviter les dérives classiques" — un pavé de texte collé dans une option,
// un élément à ordonner/associer ou un titre d'événement casse la mise en
// page d'une tuile, et rien de tout ça n'a jamais besoin d'être long dans un
// quiz jouable). Seuil "court" pour les éléments unitaires (options,
// réponses acceptées, éléments order/association/timeline), "long" pour les
// zones de texte libre (énoncé, explication) qui restent des phrases.
const TEXT_SHORT_MAXLENGTH = 120
const TEXT_LONG_MAXLENGTH = 400
const correctSection = document.getElementById('correctSection')
const correctList = document.getElementById('correctList')
const addCorrectBtn = document.getElementById('addCorrect')
const FREE_MAX_ANSWERS = 8
const deleteQuestionBtn = document.getElementById('deleteQuestion')
const qIndexLabel = document.getElementById('qIndexLabel')
const questionSaveBar = document.getElementById('questionSaveBar')
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
const ORDER_MIN_ITEMS = 2
const ORDER_MAX_ITEMS = 8

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
const pbacSection = document.getElementById('pbacSection')
const intrusEditList = document.getElementById('intrusEditList')
const intrusPhotosUploadInput = document.getElementById('intrusPhotosUpload')
const INTRUS_MIN_OPTIONS = 3
const INTRUS_MAX_OPTIONS = 8

// Chaque photo reçoit un petit id stable (alphanumérique minuscule, sûr pour
// la comparaison serveur — voir fuzzy()/norm() qui met tout en minuscules :
// jamais le contenu de l'image elle-même comme "valeur" comparée). q.correct
// référence cet id, pas la position dans le tableau : survit sans effort à
// un réordonnancement par glisser (wireIntrusEditDrag ne fait que déplacer
// les objets {id, image} dans le tableau, l'id voyage avec).
const genIntrusOptionId = () => Math.random().toString(36).slice(2, 8)
const isValidIntrusOptions = (options) =>
  Array.isArray(options) && options.every(o => o && typeof o.id === 'string' && typeof o.image === 'string')

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

// Type dédié "ZoomOut Devinette" : extrait de l'illustration générique
// ci-dessus (qui portait initialement cette fonctionnalité en option) pour
// en faire un type de question à part entière — plus simple à trouver, et
// l'image + le zoom y sont désormais OBLIGATOIRES plutôt qu'une case à
// cocher optionnelle facile à manquer. q.image = la photo, q.zoom =
// {x, y, startScale} (x/y normalisés 0-1, centre du zoom). Le dézoom
// lui-même (startScale -> 1 au rythme du chrono) est purement côté jeu
// (index.js), calé sur le même tick que la barre de temps.
const zoomGuessSection = document.getElementById('zoomGuessSection')
const zoomGuessUploadInput = document.getElementById('zoomGuessUpload')
const zoomGuessPreviewWrap = document.getElementById('zoomGuessPreviewWrap')
const zoomGuessPreviewImg = document.getElementById('zoomGuessPreviewImg')
const zoomGuessMarker = document.getElementById('zoomGuessMarker')
const removeZoomGuessBtn = document.getElementById('removeZoomGuessBtn')
const zoomGuessZoomInput = document.getElementById('zoomGuessZoomInput')
const zoomGuessZoomMinusBtn = document.getElementById('zoomGuessZoomMinus')
const zoomGuessZoomPlusBtn = document.getElementById('zoomGuessZoomPlus')
const ZOOM_GUESS_MIN = 2
// Plafond relevé de 8 à 25 (demande explicite) : à 8x, une zone assez unie
// de l'image (peau, cheveux...) reste souvent reconnaissable — l'idée du
// type est de pouvoir monter assez haut pour ne voir qu'une tache de
// couleur au tout début, pas déjà un trait du visage.
const ZOOM_GUESS_MAX = 25
const ZOOM_GUESS_DEFAULT = 4

// Question "blind test" : upload du morceau + recadrage (début/durée) en un
// extrait court, encodé en WAV mono côté client (voir plus bas) — q.audio
// stocke directement l'extrait déjà coupé, jamais le fichier complet importé.
const blindtestSection = document.getElementById('blindtestSection')
const audioUploadInput = document.getElementById('audioUpload')
const audioTrimWrap = document.getElementById('audioTrimWrap')
const audioTrimPlayer = document.getElementById('audioTrimPlayer')
const audioStartInput = document.getElementById('audioStartInput')
const audioDurationInput = document.getElementById('audioDurationInput')
const audioStartFromEndBtn = document.getElementById('audioStartFromEndBtn')
const audioTotalDurationEl = document.getElementById('audioTotalDuration')
const audioPreviewBtn = document.getElementById('audioPreviewBtn')
const audioExtractBtn = document.getElementById('audioExtractBtn')
const audioClipWrap = document.getElementById('audioClipWrap')
const audioClipPlayer = document.getElementById('audioClipPlayer')
const removeAudioClipBtn = document.getElementById('removeAudioClipBtn')
const correctTitleList = document.getElementById('correctTitleList')
const correctArtistList = document.getElementById('correctArtistList')
const addCorrectTitleBtn = document.getElementById('addCorrectTitle')
const addCorrectArtistBtn = document.getElementById('addCorrectArtist')
const btTitleOnlyToggle = document.getElementById('btTitleOnly')
const btArtistColumn = document.getElementById('btArtistColumn')
if (btTitleOnlyToggle) {
  btTitleOnlyToggle.onchange = () => {
    const q = questions[activeIndex]
    if (!q) return
    q.titleOnly = btTitleOnlyToggle.checked
    if (btArtistColumn) btArtistColumn.classList.toggle('d-none', q.titleOnly)
  }
}

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
    addAssociationPairBtn, addTimelineEventBtn, intrusPhotosUploadInput, replayTutorialBtn,
    qGradMin, qGradMax, qGradTarget, qGradTolerance, tfTrueBtn, tfFalseBtn, addOrderItemBtn, imageUploadInput,
    clearImageZoneBtn, illustrationUploadInput, removeIllustrationBtn,
    zoomGuessUploadInput, removeZoomGuessBtn, zoomGuessZoomMinusBtn, zoomGuessZoomPlusBtn,
    audioUploadInput, audioStartInput, audioDurationInput, audioStartFromEndBtn, audioPreviewBtn, audioExtractBtn,
    removeAudioClipBtn, addCorrectTitleBtn, addCorrectArtistBtn,
    document.getElementById('gradMinMinus'), document.getElementById('gradMinPlus'),
    document.getElementById('gradMaxMinus'), document.getElementById('gradMaxPlus'),
    document.getElementById('gradTargetMinus'), document.getElementById('gradTargetPlus'),
    document.getElementById('gradToleranceMinus'), document.getElementById('gradTolerancePlus'),
    document.getElementById('audioStartMinus'), document.getElementById('audioStartPlus'),
    document.getElementById('audioDurationMinus'), document.getElementById('audioDurationPlus'),
    btTitleOnlyToggle, mcqRequireAllToggle
  ]
  controls.forEach(el => { if (el) el.disabled = true })
  if (saveQuizBtn) saveQuizBtn.style.display = 'none'
  // Rien à sauvegarder en lecture seule : la barre fixe entière disparaît
  // (pas seulement son bouton), sans quoi elle resterait affichée vide de
  // sens en bas de l'écran.
  if (questionSaveBar) questionSaveBar.classList.add('d-none')
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

// Renfort visuel SUR LE CHAMP fautif lui-même, en plus du toast — un
// testeur n'a pas vu le message "La question X n'a pas d'énoncé" (toast
// transitoire, en bas d'écran) et a cru avoir perdu ses questions en
// quittant la page sans jamais réussir à sauvegarder. selectQuestion(i)
// amène déjà à la bonne question, mais si le champ vide lui-même ne saute
// pas aux yeux, la cause reste invisible. Contour rouge + petite secousse,
// retirés dès que l'utilisateur touche au champ (pas besoin de bouton pour
// l'effacer).
const flagFieldError = (el) => {
  if (!el) return
  el.classList.remove('field-error')
  void el.offsetWidth // relance l'animation même si déjà marqué juste avant
  el.classList.add('field-error')
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const clear = () => el.classList.remove('field-error')
  el.addEventListener('input', clear, { once: true })
  el.addEventListener('focus', clear, { once: true })
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
    if (e.target.closest('.q-delete-btn')) return
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
    item.className = `question-item type-${q.type || 'free'} ${idx === activeIndex ? 'active' : ''} ${q.draft ? 'is-draft' : ''}`.trim()
    item.dataset.index = idx
    if (q.draft) item.title = 'Brouillon — ignorée en jeu'
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
    // 🚧 en préfixe plutôt qu'un badge à part : reste lisible même dans
    // l'espace étroit de la sidebar, pas besoin de deviner via une couleur.
    text.textContent = (q.draft ? '🚧 ' : '') + (q.prompt || '(Nouvelle question)')

    if (!readOnly) item.appendChild(handle)
    item.appendChild(num)
    item.appendChild(text)

    if (!readOnly) {
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'q-delete-btn'
      del.title = 'Supprimer cette question'
      del.setAttribute('aria-label', 'Supprimer cette question')
      del.textContent = '✕'
      // stopPropagation : sans ça, le clic remonte au listener 'click' de
      // l'item (voir wireQuestionDrag) et sélectionne la question juste
      // avant/après sa suppression — inutile et source de flash visuel.
      del.onclick = (e) => { e.stopPropagation(); confirmDeleteQuestionAt(idx) }
      item.appendChild(del)
    }

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
    // Retour utilisateur : contrairement à la suppression d'une question,
    // ce bouton n'avait aucune confirmation alors qu'il efface d'un coup
    // une ou plusieurs zones tracées à main levée — souvent le travail le
    // plus long à refaire de toute la question.
    QzUI.confirm({
      title: 'Effacer toutes les zones ?',
      message: 'Toutes les zones de bonne réponse tracées pour cette question seront supprimées.',
      confirmLabel: 'Effacer',
      danger: true
    }).then((ok) => {
      if (!ok || !questions[activeIndex]) return
      questions[activeIndex].correct = []
      renderImageZones([])
    })
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
// Vignettes "association"/"intrus" (voir buildAssocPhotoSlot/addIntrusPhotos
// plus bas) : jamais affichées plus grandes qu'une tuile 4:3 dans une grille
// (voir .assoc-item-img/.intrus-tile en CSS), inutile de garder la même
// définition qu'une illustration pleine largeur. Une question association
// peut cumuler jusqu'à 16 de ces images dans UN SEUL envoi HTTP au moment de
// démarrer la question (voir emitQuestion côté index.js) — les compresser
// plus fort ici réduit d'autant ce pic d'upload, qui partage la même
// connexion que le WebSocket de la partie en cours (retour utilisateur :
// l'hôte se voit déconnecté par l'appli pendant cet envoi, alors même que sa
// connexion n'a jamais vraiment coupé — juste saturée par cet envoi).
const TILE_IMAGE_MAX_DIMENSION = 640
const IMAGE_JPEG_QUALITY = 0.8

const compressImageFile = (file, onSuccess, maxDimension = IMAGE_MAX_DIMENSION) => {
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
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight))
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
    // Retour utilisateur : contrairement à la suppression d'une question,
    // retirer l'illustration se faisait en un clic sans confirmation.
    QzUI.confirm({
      title: 'Retirer cette illustration ?',
      message: 'Il faudra réimporter une image pour en remettre une.',
      confirmLabel: 'Retirer',
      danger: true
    }).then((ok) => {
      if (!ok || !questions[activeIndex]) return
      questions[activeIndex].illustration = null
      populateIllustrationFields(questions[activeIndex])
    })
  }
}

// --- Question "ZoomOut Devinette" : image + point/niveau de zoom ---------
const positionZoomGuessMarker = (zoom) => {
  if (!zoomGuessMarker) return
  if (!zoom) { zoomGuessMarker.classList.add('d-none'); return }
  zoomGuessMarker.style.left = `${zoom.x * 100}%`
  zoomGuessMarker.style.top = `${zoom.y * 100}%`
  zoomGuessMarker.classList.remove('d-none')
}

const populateZoomGuessFields = (q) => {
  if (!zoomGuessPreviewWrap) return
  if (q.type !== 'zoomguess') return
  if (q.image) {
    zoomGuessPreviewImg.src = q.image
    zoomGuessPreviewWrap.classList.remove('d-none')
  } else {
    zoomGuessPreviewWrap.classList.add('d-none')
  }
  if (!q.zoom) q.zoom = { x: 0.5, y: 0.5, startScale: ZOOM_GUESS_DEFAULT }
  if (zoomGuessZoomInput) zoomGuessZoomInput.value = q.zoom.startScale
  positionZoomGuessMarker(q.image ? q.zoom : null)
}

if (zoomGuessUploadInput) {
  zoomGuessUploadInput.onchange = () => {
    const file = zoomGuessUploadInput.files && zoomGuessUploadInput.files[0]
    zoomGuessUploadInput.value = ''
    if (!file || !questions[activeIndex]) return
    compressImageFile(file, (dataUrl) => {
      const q = questions[activeIndex]
      q.image = dataUrl
      // Nouvelle image -> un ancien point de zoom choisi sur l'image
      // précédente n'a plus de sens (cadre différent), mais on garde le
      // niveau de zoom déjà réglé.
      q.zoom = { x: 0.5, y: 0.5, startScale: q.zoom?.startScale || ZOOM_GUESS_DEFAULT }
      populateZoomGuessFields(q)
    })
  }
}

if (removeZoomGuessBtn) {
  removeZoomGuessBtn.onclick = () => {
    if (!questions[activeIndex]) return
    // Retour utilisateur : contrairement à la suppression d'une question,
    // retirer l'image ZoomOut Devinette (avec son point de zoom déjà
    // choisi) se faisait en un clic sans confirmation.
    QzUI.confirm({
      title: 'Retirer cette image ?',
      message: 'Le point de zoom déjà choisi sera perdu avec elle.',
      confirmLabel: 'Retirer',
      danger: true
    }).then((ok) => {
      if (!ok || !questions[activeIndex]) return
      questions[activeIndex].image = null
      populateZoomGuessFields(questions[activeIndex])
    })
  }
}

if (zoomGuessPreviewImg) {
  zoomGuessPreviewImg.onclick = (e) => {
    const q = questions[activeIndex]
    if (readOnly || !q || !q.image) return
    if (!q.zoom) q.zoom = { x: 0.5, y: 0.5, startScale: ZOOM_GUESS_DEFAULT }
    const rect = zoomGuessPreviewImg.getBoundingClientRect()
    q.zoom.x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    q.zoom.y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    positionZoomGuessMarker(q.zoom)
  }
}

const commitZoomGuessLevel = (val) => {
  const q = questions[activeIndex]
  const clamped = Math.min(ZOOM_GUESS_MAX, Math.max(ZOOM_GUESS_MIN, val))
  if (zoomGuessZoomInput) zoomGuessZoomInput.value = clamped
  if (q) {
    if (!q.zoom) q.zoom = { x: 0.5, y: 0.5, startScale: clamped }
    else q.zoom.startScale = clamped
  }
}
if (zoomGuessZoomMinusBtn) {
  zoomGuessZoomMinusBtn.onclick = () => commitZoomGuessLevel((Number(zoomGuessZoomInput?.value) || ZOOM_GUESS_DEFAULT) - 1)
}
if (zoomGuessZoomPlusBtn) {
  zoomGuessZoomPlusBtn.onclick = () => commitZoomGuessLevel((Number(zoomGuessZoomInput?.value) || ZOOM_GUESS_DEFAULT) + 1)
}
// Saisie directe (retour utilisateur : champ passé en "readonly" par erreur,
// impossible d'y taper une valeur — seuls - / + fonctionnaient, et même sans
// le readonly, rien ne relayait une saisie tapée vers q.zoom.startScale, voir
// commitZoomGuessLevel). onchange (au blur/Enter) plutôt que oninput : sinon
// le clampage à ZOOM_GUESS_MIN (2) dès la première frappe de "25" empêcherait
// de jamais taper la suite.
if (zoomGuessZoomInput) {
  zoomGuessZoomInput.onchange = () => commitZoomGuessLevel(Number(zoomGuessZoomInput.value) || ZOOM_GUESS_DEFAULT)
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

// "Depuis la fin" (retour utilisateur : viser la fin d'un morceau obligeait à
// calculer et taper durée_totale - durée_extrait à la main, sans même voir la
// durée totale affichée quelque part) — affichée à côté du champ "Début" dès
// qu'un fichier est chargé (voir audioUploadInput.onchange plus bas).
const formatAudioDuration = (sec) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
if (audioStartFromEndBtn) {
  audioStartFromEndBtn.onclick = () => {
    if (!pendingAudioBuffer) return
    const duration = Number(audioDurationInput.value) || 1
    audioStartInput.value = Math.round(pendingAudioBuffer.duration - duration)
    clampAudioTrimInputs()
  }
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
  // "Titre uniquement" — synchronise la case et la colonne "Artiste(s)
  // accepté(s)" avec q.titleOnly à chaque affichage de cette question
  // (sélection dans la sidebar, retour depuis un autre type...).
  if (btTitleOnlyToggle) btTitleOnlyToggle.checked = !!q.titleOnly
  if (btArtistColumn) btArtistColumn.classList.toggle('d-none', !!q.titleOnly)
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
      if (audioTotalDurationEl) audioTotalDurationEl.textContent = `(morceau : ${formatAudioDuration(audioBuffer.duration)})`
      audioTrimWrap.classList.remove('d-none')
    }).catch(() => {
      showToast('Impossible de lire ce fichier audio', 'error')
    })
  }
}

if (audioStartInput) audioStartInput.oninput = clampAudioTrimInputs
if (audioDurationInput) audioDurationInput.oninput = clampAudioTrimInputs

// Boutons +/- des champs Début/Durée : présents dans le HTML depuis le
// départ mais jamais câblés (contrairement à bindGradStepper pour les
// champs curseur numérique) — ne faisaient donc rien au clic (signalé par
// l'utilisateur). clampAudioTrimInputs() rejoue le même clampage que la
// saisie manuelle (oninput ci-dessus), donc +/- ne peuvent pas sortir des
// bornes valides (0 <= début, durée <= AUDIO_CLIP_MAX_DURATION et piste).
const audioStartMinusBtn = document.getElementById('audioStartMinus')
const audioStartPlusBtn = document.getElementById('audioStartPlus')
const audioDurationMinusBtn = document.getElementById('audioDurationMinus')
const audioDurationPlusBtn = document.getElementById('audioDurationPlus')
if (audioStartMinusBtn && audioStartInput) {
  audioStartMinusBtn.onclick = () => { audioStartInput.value = (Number(audioStartInput.value) || 0) - 1; clampAudioTrimInputs() }
}
if (audioStartPlusBtn && audioStartInput) {
  audioStartPlusBtn.onclick = () => { audioStartInput.value = (Number(audioStartInput.value) || 0) + 1; clampAudioTrimInputs() }
}
if (audioDurationMinusBtn && audioDurationInput) {
  audioDurationMinusBtn.onclick = () => { audioDurationInput.value = (Number(audioDurationInput.value) || 0) - 1; clampAudioTrimInputs() }
}
if (audioDurationPlusBtn && audioDurationInput) {
  audioDurationPlusBtn.onclick = () => { audioDurationInput.value = (Number(audioDurationInput.value) || 0) + 1; clampAudioTrimInputs() }
}

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
    // Retour utilisateur : contrairement à la suppression d'une question,
    // retirer l'extrait audio se faisait en un clic sans confirmation — le
    // découpage (début/durée) est pourtant souvent le réglage le plus long
    // à refaire de tout l'éditeur.
    QzUI.confirm({
      title: 'Retirer cet extrait audio ?',
      message: 'Le découpage (début/durée) déjà réglé sera perdu avec lui.',
      confirmLabel: 'Retirer',
      danger: true
    }).then((ok) => {
      if (!ok || !questions[activeIndex]) return
      questions[activeIndex].audio = null
      populateAudioFields(questions[activeIndex])
    })
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
  if (qDraftToggle) qDraftToggle.checked = !!q.draft
  qPrompt.value = q.prompt || ''
  if (qExplanation) qExplanation.value = q.explanation || ''
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  populateGradFields(q)
  populateTrueFalseFields(q)
  populateImageFields(q)
  populateIllustrationFields(q)
  populateZoomGuessFields(q)
  populateAudioFields(q)
  if (mcqRequireAllToggle) mcqRequireAllToggle.checked = q.requireAllCorrect !== false

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
  // N'a de sens qu'une fois une question réellement sélectionnée (jamais
  // avant le tout premier appel) — masquée à nouveau en lecture seule, voir
  // applyReadOnly.
  if (questionSaveBar) questionSaveBar.classList.remove('d-none')

  // Mettre le focus sur l'énoncé pour une saisie rapide
  qPrompt.focus()
  hasSelectedOnce = true
}

const saveCurrentQuestionState = () => {
  if (activeIndex < 0 || activeIndex >= questions.length) return

  const q = questions[activeIndex]
  if (qDraftToggle) q.draft = qDraftToggle.checked
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
  if (zoomGuessSection) zoomGuessSection.classList.toggle('d-none', qType.value !== 'zoomguess')
  if (blindtestSection) blindtestSection.classList.toggle('d-none', qType.value !== 'blindtest')
  if (associationSection) associationSection.classList.toggle('d-none', qType.value !== 'association')
  if (timelineSection) timelineSection.classList.toggle('d-none', qType.value !== 'timeline')
  if (intrusSection) intrusSection.classList.toggle('d-none', qType.value !== 'intrus')
  if (pbacSection) pbacSection.classList.toggle('d-none', qType.value !== 'pbac')
  // L'illustration optionnelle n'a de sens que pour les types qui n'ont pas
  // déjà leur propre image (le type "image" utilise la sienne comme cible
  // cliquable, "zoomguess" la sienne comme photo à deviner — pas comme
  // simple décoration).
  if (illustrationSection) illustrationSection.classList.toggle('d-none', qType.value === 'image' || qType.value === 'zoomguess')
  // "blindtest" a ses deux propres listes de réponses (titre/artiste, voir
  // blindtestSection ci-dessus) au lieu de la liste générique "correct".
  // "mcq" a aussi sa propre façon de désigner la bonne réponse : la case à
  // cocher sur chaque option (voir renderOptions), qui alimente déjà
  // entièrement q.correct — la liste "correct" générique ci-dessous ferait
  // donc double emploi (retaper le texte d'une réponse déjà cochée), d'où
  // la confusion remontée par l'utilisateur. "free" (texte libre) ET
  // "zoomguess" (deviner à partir de l'image) ont besoin de cette liste.
  // "association" / "timeline" / "intrus" ont chacun leur propre section
  // ci-dessus.
  if (correctSection) correctSection.classList.toggle('d-none', qType.value !== 'free' && qType.value !== 'zoomguess')
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
  // Rendu spécifique au QCM : q.options y est un tableau de TEXTES. Les
  // autres types réutilisent parfois aussi q.options mais avec une forme
  // différente ("intrus" : objets {id, image}) — un opt.trim() y plantait
  // (TypeError: opt.trim is not a function), ce qui interrompait
  // selectQuestion() EN PLEIN MILIEU et empêchait d'atteindre
  // toggleTypeSections() juste après : le panneau restait bloqué sur
  // l'ancien type pendant qu'une partie des champs (prompt, timer...) avait
  // déjà changé — d'où l'impression de ne "jamais accéder" à une question
  // intrus depuis la barre latérale (bug remonté par l'utilisateur). Liste
  // blanche plutôt que liste noire ("sauf blindtest") : plus sûr pour
  // n'importe quel futur type qui réutiliserait q.options différemment.
  if (q.type !== 'mcq') return
  if (!q.options) q.options = []

  // q.correct (sauvegardé/envoyé au serveur) reste un tableau de TEXTES, mais
  // le suivi PENDANT L'ÉDITION se fait par INDEX (correctIndices), pas par
  // recherche de valeur (l'ancien code faisait q.correct.indexOf(oldVal)) :
  // avec plusieurs options encore vides (ou un texte dupliqué) en même temps,
  // cocher l'une puis taper dans une autre pouvait faire correspondre la
  // MAUVAISE option et voler silencieusement la bonne réponse à une autre
  // (bug remonté par l'utilisateur — coché correct à la création, compté
  // faux en jeu). Un index reste sans ambiguïté pour toute la durée de CE
  // rendu, indépendamment du texte tapé. Correspondance texte->index encore
  // best-effort ICI (une seule fois, au chargement), chaque entrée de
  // q.correct n'étant consommée qu'une fois pour éviter de cocher plusieurs
  // options partageant un texte identique.
  const remainingCorrectTexts = q.correct.slice()
  const correctIndices = new Set()
  q.options.forEach((opt, i) => {
    if (opt.trim() === '') return
    const pos = remainingCorrectTexts.indexOf(opt)
    if (pos !== -1) {
      correctIndices.add(i)
      remainingCorrectTexts.splice(pos, 1)
    }
  })
  const syncCorrectFromIndices = () => {
    q.correct = q.options.filter((_, i) => correctIndices.has(i))
  }

  q.options.forEach((opt, idx) => {
    const row = createInputRow(opt, (val) => {
      q.options[idx] = val
      // Cette option est (ou reste) marquée correcte : on reconstruit q.correct
      // en entier plutôt que de "renommer" une entrée retrouvée par texte.
      if (correctIndices.has(idx)) syncCorrectFromIndices()
    }, () => {
      if (q.options.length <= MCQ_MIN_OPTIONS) {
        showToast(`Il faut au moins ${MCQ_MIN_OPTIONS} options`, 'error')
        return
      }
      // Retire cette option de q.correct AVANT de la spliced (les index de
      // correctIndices ne sont valables que pour CE rendu, pas après).
      if (correctIndices.has(idx)) {
        correctIndices.delete(idx)
        syncCorrectFromIndices()
      }
      q.options.splice(idx, 1)
      renderOptions()
    }, true, correctIndices.has(idx), (checked) => {
      if (checked) correctIndices.add(idx)
      else correctIndices.delete(idx)
      syncCorrectFromIndices()
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
    input.maxLength = TEXT_SHORT_MAXLENGTH
    input.oninput = (e) => { q.correct[idx] = e.target.value }
    row.appendChild(input)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.correct.length <= ORDER_MIN_ITEMS) {
          showToast(`Il faut au moins ${ORDER_MIN_ITEMS} éléments à ordonner`, 'error')
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
    if (questions[activeIndex].correct.length >= ORDER_MAX_ITEMS) {
      showToast(`Maximum ${ORDER_MAX_ITEMS} éléments`, 'error')
      return
    }
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
    // .assoc-photo-slot (vignette + bouton 📷/×, voir buildAssocPhotoSlot) :
    // sans cette exclusion, le pointerdown sur l'image elle-même était
    // capturé par CE glisser (réordonnancement de la ligne) avant de pouvoir
    // atteindre le onclick de la vignette (ouverture du recadreur) —
    // e.preventDefault() + setPointerCapture juste en dessous empêchaient
    // alors tout click d'être émis sur l'image (retour utilisateur : "ça ne
    // fonctionne pas, peut-être l'évènement de drag & drop qui prend la
    // main").
    if (e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('.assoc-photo-slot')) return
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

// Point focal utilisé par object-position en jeu (voir index.js
// renderAssociationColumns/renderIntrusOptions équivalent) — {x,y} normalisés
// 0..1, 0.5/0.5 = centré (comportement par défaut si absent, identique à
// l'ancien recadrage automatique). ASPECT DOIT rester synchronisé avec
// .assoc-item-img / .intrus-tile-img côté jeu (voir style.css, les deux sont
// déjà en 4:3) : le point choisi ici ne "tombe juste" que si l'aperçu du
// recadreur a le même ratio que la tuile réelle.
const IMAGE_CROP_ASPECT = 4 / 3
const IMAGE_CROP_VIEWPORT_W = 360
// Bornes du zoom, en multiple de "coverScale" (1 = cadrage plein, identique
// au comportement d'origine avant l'ajout du dézoom — voir computeCropGeometry).
const IMAGE_CROP_ZOOM_MAX = 4

// Échantillonne le pourtour de l'image (haut/bas/gauche/droite) sur une petite
// version réduite (rapide, la précision au pixel près n'a aucun intérêt ici)
// et regroupe les couleurs par "seau" pour dégager la teinte la PLUS
// FRÉQUENTE sur ce pourtour (pas une simple moyenne, qui donnerait une bouillie
// grisâtre dès que les bords sont bariolés) — sert de fond derrière l'image
// une fois dézoomée (voir applyCropTransform), pour que les bandes vides ne
// jurent pas avec la photo. Fonctionne uniquement parce que nos images sont
// toujours des data-URI locales (jamais de canvas "taint" cross-origin).
const computeDominantEdgeColor = (img) => {
  try {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    const buckets = new Map()
    const step = 24 // quantification : regroupe les teintes proches ensemble
    const addPixel = (x, y) => {
      const i = (y * size + x) * 4
      if (data[i + 3] < 200) return // pixel (quasi-)transparent, ignoré
      const key = [0, 1, 2].map(k => Math.round(data[i + k] / step) * step).join(',')
      buckets.set(key, (buckets.get(key) || 0) + 1)
    }
    for (let x = 0; x < size; x++) { addPixel(x, 0); addPixel(x, size - 1) }
    for (let y = 0; y < size; y++) { addPixel(0, y); addPixel(size - 1, y) }
    let bestKey = null
    let bestCount = 0
    buckets.forEach((count, key) => { if (count > bestCount) { bestCount = count; bestKey = key } })
    return bestKey ? `rgb(${bestKey})` : null
  } catch {
    return null // ne devrait pas arriver (data-URI locale) mais ne bloque jamais le recadrage
  }
}

// Géométrie partagée par la popup ET par le rendu en jeu (voir la fonction
// jumelle côté index.js, dupliquée volontairement — les deux fichiers sont
// des scripts classiques indépendants, pas de module partagé) : à partir de
// la taille naturelle de l'image, de la boîte d'affichage et du zoom choisi,
// calcule l'échelle et le décalage (translation) à appliquer. zoom=1 =
// "coverScale", exactement l'ancien recadrage automatique (l'image remplit
// toute la boîte, jamais de bord vide) ; zoom<1 dézoome en dessous de ce
// seuil, ce qui FAIT apparaître des bords vides (comblés par la couleur
// dominante, voir computeDominantEdgeColor) — c'est précisément le but.
const computeCropGeometry = (natW, natH, boxW, boxH, zoom, posX, posY) => {
  const coverScale = Math.max(boxW / natW, boxH / natH)
  const scale = coverScale * (Number.isFinite(zoom) ? zoom : 1)
  const renderedW = natW * scale
  const renderedH = natH * scale
  const overflowX = Math.max(0, renderedW - boxW)
  const overflowY = Math.max(0, renderedH - boxH)
  // Zoomé/cadré normalement (l'image dépasse la boîte sur cet axe) : offset
  // dérivé de la fraction 0..1 choisie, comme avant. Dézoomé au point que
  // l'image tienne entièrement sur cet axe : plus de fraction pertinente,
  // on centre simplement (sinon l'image resterait collée à un bord).
  const offsetX = overflowX > 0 ? -overflowX * posX : (boxW - renderedW) / 2
  const offsetY = overflowY > 0 ? -overflowY * posY : (boxH - renderedH) / 2
  return { scale, overflowX, overflowY, offsetX, offsetY, coverScale }
}

// Pose la taille/transform sur un <img> déjà chargé (naturalWidth/Height
// connus), à l'intérieur d'un conteneur `wrapEl` (position:relative,
// overflow:hidden — voir style.css .assoc-item-img-wrap/.intrus-tile) dont la
// couleur de fond a déjà été réglée séparément (voir bg/computeDominantEdgeColor).
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

// Popup "glisser pour recadrer, molette/pincement pour zoomer" générique —
// même principe qu'un recadrage de photo de profil (retour utilisateur),
// avec en plus la possibilité de dézoomer pour montrer davantage de la photo
// (les bords vides que ça révèle sont comblés par sa couleur dominante,
// plutôt qu'une couleur fixe qui jurerait). Partagée entre "association" (voir
// openAssocCropModal) et "intrus" (voir renderIntrusOptions).
// currentPos : {x,y,zoom} actuel ou null/undefined (= centré, zoom plein).
// bgColor : couleur déjà connue pour cette image, ou null si jamais calculée.
// callbacks : { onSave(pos), onReplace(dataUrl), onBgReady(bgColor) } —
// onReplace reçoit la nouvelle image déjà compressée (l'appelant réinitialise
// le cadrage associé) ; onBgReady est TOUJOURS appelé une fois la couleur
// dominante connue (recalculée si bgColor était absent), pour que l'appelant
// la persiste et n'ait plus à la recalculer la prochaine fois.
const openImageCropModal = (imageSrc, currentPos, bgColor, callbacks) => {
  const pos = {
    x: Number.isFinite(currentPos?.x) ? currentPos.x : 0.5,
    y: Number.isFinite(currentPos?.y) ? currentPos.y : 0.5,
    zoom: Number.isFinite(currentPos?.zoom) ? currentPos.zoom : 1
  }
  let minZoom = 0.3 // resserré dès que la géométrie réelle est connue (voir computeOverflow)

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  const viewportH = Math.round(IMAGE_CROP_VIEWPORT_W / IMAGE_CROP_ASPECT)
  overlay.innerHTML = `
    <div class="modal-content card max-w-500 assoc-crop-modal">
      <h2 class="mb-md font-20">Recadrer l'image</h2>
      <p class="text-muted font-13 mb-md">Glisse l'image pour la repositionner, molette ou pincement pour zoomer/dézoomer.</p>
      <div class="assoc-crop-viewport" style="width:${IMAGE_CROP_VIEWPORT_W}px; height:${viewportH}px; background:${bgColor || 'var(--color-bg-alt)'};">
        <img class="assoc-crop-img" src="${imageSrc}" alt="" draggable="false" />
      </div>
      <div class="d-flex align-center gap-sm mt-12 assoc-crop-zoom-row">
        <button type="button" class="btn-timer assoc-crop-zoom-out" title="Dézoomer">-</button>
        <span class="text-muted font-13 assoc-crop-zoom-label" style="min-width:4ch; text-align:center;">100%</span>
        <button type="button" class="btn-timer assoc-crop-zoom-in" title="Zoomer">+</button>
      </div>
      <div class="d-flex justify-between align-center mt-20 assoc-crop-actions">
        <button type="button" class="btn h-48 assoc-crop-replace">Remplacer l'image</button>
        <div class="d-flex gap-sm">
          <button type="button" class="btn h-48 assoc-crop-cancel">Annuler</button>
          <button type="button" class="btn btn-primary h-48 assoc-crop-ok">Valider</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)

  const viewport = overlay.querySelector('.assoc-crop-viewport')
  const img = overlay.querySelector('.assoc-crop-img')
  const zoomLabel = overlay.querySelector('.assoc-crop-zoom-label')
  let overflowX = 0
  let overflowY = 0

  const applyPos = () => {
    const { overflowX: ofx, overflowY: ofy, offsetX, offsetY, scale } = computeCropGeometry(
      img.naturalWidth, img.naturalHeight, viewport.clientWidth, viewport.clientHeight, pos.zoom, pos.x, pos.y
    )
    overflowX = ofx
    overflowY = ofy
    img.style.width = `${img.naturalWidth}px`
    img.style.height = `${img.naturalHeight}px`
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
    zoomLabel.textContent = `${Math.round(pos.zoom * 100)}%`
  }
  const setZoom = (z) => { pos.zoom = Math.min(IMAGE_CROP_ZOOM_MAX, Math.max(minZoom, z)); applyPos() }
  const onImageReady = () => {
    // Le plancher de zoom est celui qui montre l'image ENTIÈRE sans dépasser
    // (ratio "contain"/"cover") — inutile de dézoomer davantage, ça ne
    // révélerait plus rien de nouveau, juste plus de bord vide autour.
    const containScale = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight)
    const coverScale = Math.max(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight)
    minZoom = Math.min(1, containScale / coverScale)
    pos.zoom = Math.min(IMAGE_CROP_ZOOM_MAX, Math.max(minZoom, pos.zoom))
    applyPos()
    if (!bgColor) {
      const computed = computeDominantEdgeColor(img)
      if (computed) {
        viewport.style.background = computed
        callbacks.onBgReady(computed)
      }
    } else {
      callbacks.onBgReady(bgColor)
    }
  }
  if (img.complete && img.naturalWidth) onImageReady()
  img.onload = onImageReady

  // Un 2e doigt qui se pose bascule en pincement (zoom) et annule le glisser
  // à un seul doigt en cours — même principe que le pincement déjà en place
  // pour le type "image" en jeu (voir index.js activeImagePointers/imagePinch),
  // adapté ici en zoom pur (pas de pan lié à l'ancrage du pincement, cette
  // popup reste petite : le centrage automatique de computeCropGeometry suffit).
  const activeCropPointers = new Map()
  let cropPinch = null
  let dragStart = null
  viewport.addEventListener('pointerdown', (e) => {
    activeCropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { viewport.setPointerCapture(e.pointerId) } catch {}
    if (activeCropPointers.size >= 2) {
      dragStart = null
      const [p1, p2] = Array.from(activeCropPointers.values())
      cropPinch = { startDist: Math.hypot(p1.x - p2.x, p1.y - p2.y), startZoom: pos.zoom }
    } else {
      dragStart = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y, pointerId: e.pointerId }
      viewport.classList.add('is-dragging')
    }
  })
  viewport.addEventListener('pointermove', (e) => {
    if (!activeCropPointers.has(e.pointerId)) return
    activeCropPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (cropPinch && activeCropPointers.size >= 2) {
      const [p1, p2] = Array.from(activeCropPointers.values())
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      if (dist > 0 && cropPinch.startDist > 0) setZoom(cropPinch.startZoom * (dist / cropPinch.startDist))
      return
    }
    if (!dragStart || e.pointerId !== dragStart.pointerId) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    // Glisser l'image vers la DROITE doit révéler la partie GAUCHE de la
    // photo (comme on la déplace physiquement) : la fraction se déplace
    // donc dans le sens INVERSE du geste.
    pos.x = overflowX > 0 ? Math.min(1, Math.max(0, dragStart.posX - dx / overflowX)) : 0.5
    pos.y = overflowY > 0 ? Math.min(1, Math.max(0, dragStart.posY - dy / overflowY)) : 0.5
    applyPos()
  })
  const endDrag = (e) => {
    activeCropPointers.delete(e.pointerId)
    try { viewport.releasePointerCapture(e.pointerId) } catch {}
    if (cropPinch) {
      if (activeCropPointers.size < 2) cropPinch = null
      dragStart = null
      viewport.classList.remove('is-dragging')
      return
    }
    if (!dragStart || e.pointerId !== dragStart.pointerId) return
    dragStart = null
    viewport.classList.remove('is-dragging')
  }
  viewport.addEventListener('pointerup', endDrag)
  viewport.addEventListener('pointercancel', endDrag)
  // Molette (desktop) — un cran ~10% de zoom, centré sur la boîte (pas sur le
  // curseur : la popup est petite, l'anchoring précis n'apporte pas grand-chose
  // ici contrairement au zoom plein écran de l'éditeur d'image "zoomguess").
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault()
    setZoom(pos.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }, { passive: false })
  overlay.querySelector('.assoc-crop-zoom-in').onclick = () => setZoom(pos.zoom * 1.2)
  overlay.querySelector('.assoc-crop-zoom-out').onclick = () => setZoom(pos.zoom / 1.2)

  const close = () => overlay.remove()
  overlay.querySelector('.assoc-crop-cancel').onclick = close
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close() })
  overlay.querySelector('.assoc-crop-ok').onclick = () => {
    close()
    callbacks.onSave({ x: pos.x, y: pos.y, zoom: pos.zoom })
  }
  overlay.querySelector('.assoc-crop-replace').onclick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return
      compressImageFile(file, (dataUrl) => {
        close()
        callbacks.onReplace(dataUrl)
      }, TILE_IMAGE_MAX_DIMENSION)
    }
    input.click()
  }
}

// Wrapper association : pos stocké sur pair.aPos/bPos, couleur de fond sur
// pair.aBg/bBg (voir index.js emitQuestion/fillAssociationImages pour la
// transmission au jeu).
const openAssocCropModal = (pair, imgField, rerender) => {
  const posField = imgField.replace('Image', 'Pos')
  const bgField = imgField.replace('Image', 'Bg')
  openImageCropModal(pair[imgField], pair[posField], pair[bgField], {
    onSave: (pos) => { pair[posField] = pos; rerender() },
    onBgReady: (bg) => { pair[bgField] = bg },
    onReplace: (dataUrl) => {
      pair[imgField] = dataUrl
      delete pair[posField] // nouvelle image : l'ancien cadrage n'a plus de sens
      delete pair[bgField]
      rerender()
    }
  })
}

// Vignette optionnelle pour un côté (A ou B) d'une paire association — même
// principe que la vignette "intrus" (cliquer une image existante l'ouvre
// pour la recadrer, voir openAssocCropModal), plus un petit bouton "×"
// séparé pour la retirer complètement et retomber sur le texte seul (l'image
// reste facultative, contrairement à "intrus" où elle est le contenu même de
// la tuile). imgField vaut 'aImage' ou 'bImage' — stocké directement sur
// l'objet pair, comme pair.a/pair.b.
const buildAssocPhotoSlot = (pair, imgField, rerender) => {
  const wrap = document.createElement('div')
  wrap.className = 'assoc-photo-slot'

  const openPicker = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files && input.files[0]
      if (!file) return
      compressImageFile(file, (dataUrl) => {
        pair[imgField] = dataUrl
        rerender()
      }, TILE_IMAGE_MAX_DIMENSION)
    }
    input.click()
  }

  if (pair[imgField]) {
    const thumb = document.createElement('img')
    thumb.className = 'assoc-photo-thumb'
    thumb.src = pair[imgField]
    thumb.alt = ''
    if (!readOnly) {
      thumb.title = 'Cliquer pour recadrer cette image'
      thumb.classList.add('cursor-pointer')
      thumb.onclick = () => openAssocCropModal(pair, imgField, rerender)
    }
    wrap.appendChild(thumb)
    if (!readOnly) {
      const clear = document.createElement('button')
      clear.className = 'assoc-photo-clear'
      clear.innerHTML = '&times;'
      clear.title = 'Retirer cette image'
      clear.onclick = (e) => {
        e.stopPropagation()
        delete pair[imgField]
        delete pair[imgField.replace('Image', 'Pos')]
        rerender()
      }
      wrap.appendChild(clear)
    }
  } else if (!readOnly) {
    const add = document.createElement('button')
    add.className = 'assoc-photo-add'
    add.type = 'button'
    add.title = 'Ajouter une image (optionnel)'
    add.textContent = '📷'
    add.onclick = openPicker
    wrap.appendChild(add)
  }

  return wrap
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

    row.appendChild(buildAssocPhotoSlot(pair, 'aImage', renderAssociationPairs))

    const inputA = document.createElement('input')
    inputA.type = 'text'
    inputA.value = pair.a
    inputA.placeholder = 'Élément A'
    inputA.style.flex = '1'
    inputA.disabled = readOnly
    inputA.maxLength = TEXT_SHORT_MAXLENGTH
    inputA.oninput = (e) => { pair.a = e.target.value }
    row.appendChild(inputA)

    const arrow = document.createElement('span')
    arrow.textContent = '↔'
    arrow.className = 'text-muted'
    arrow.style.padding = '0 4px'
    row.appendChild(arrow)

    row.appendChild(buildAssocPhotoSlot(pair, 'bImage', renderAssociationPairs))

    const inputB = document.createElement('input')
    inputB.type = 'text'
    inputB.value = pair.b
    inputB.placeholder = 'Élément B'
    inputB.style.flex = '1'
    inputB.disabled = readOnly
    inputB.maxLength = TEXT_SHORT_MAXLENGTH
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
    titleInput.maxLength = TEXT_SHORT_MAXLENGTH
    titleInput.oninput = (e) => { ev.title = e.target.value }
    fields.appendChild(titleInput)

    const descInput = document.createElement('input')
    descInput.type = 'text'
    descInput.value = ev.description || ''
    descInput.placeholder = 'Description courte (optionnelle)'
    descInput.disabled = readOnly
    descInput.maxLength = TEXT_SHORT_MAXLENGTH
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
    // .intrus-photo-thumb : même exclusion que .assoc-photo-slot pour
    // l'association (voir wireAssociationEditDrag) — sinon le clic sur la
    // vignette pour ouvrir le recadreur était capturé par ce glisser de
    // réordonnancement avant d'atteindre son onclick.
    if (e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.classList.contains('intrus-photo-thumb')) return
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
  if (!isValidIntrusOptions(q.options)) q.options = []
  if (!Array.isArray(q.correct)) q.correct = []

  q.options.forEach((opt, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row intrus-photo-row'
    row.dataset.index = idx

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
      wireIntrusEditDrag(row)
    }

    const thumb = document.createElement('img')
    thumb.className = 'intrus-photo-thumb'
    thumb.src = opt.image
    thumb.alt = ''
    if (opt.pos && Number.isFinite(opt.pos.x) && Number.isFinite(opt.pos.y)) {
      thumb.style.objectPosition = `${opt.pos.x * 100}% ${opt.pos.y * 100}%`
    }
    // Cliquer la vignette ouvre le même recadreur "glisser pour repositionner"
    // que pour l'image association (voir openImageCropModal) — remplacer la
    // photo reste possible depuis cette popup, sans perdre la place de la
    // photo dans la liste ni son statut d'intrus éventuel.
    if (!readOnly) {
      thumb.title = 'Cliquer pour recadrer cette photo'
      thumb.classList.add('cursor-pointer')
      thumb.onclick = () => {
        openImageCropModal(opt.image, opt.pos, opt.bg, {
          onSave: (pos) => { q.options[idx].pos = pos; renderIntrusOptions() },
          onBgReady: (bg) => { q.options[idx].bg = bg },
          onReplace: (dataUrl) => {
            q.options[idx].image = dataUrl
            delete q.options[idx].pos
            delete q.options[idx].bg
            renderIntrusOptions()
          }
        })
      }
    }
    row.appendChild(thumb)

    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = INTRUS_RADIO_NAME
    radio.className = 'checkbox-custom mr-8'
    radio.checked = q.correct[0] === opt.id
    radio.title = 'Marquer comme intrus'
    radio.disabled = readOnly
    radio.onchange = () => { q.correct = [q.options[idx].id] }
    row.appendChild(radio)

    if (!readOnly) {
      const del = document.createElement('button')
      del.className = 'btn-icon btn-danger'
      del.innerHTML = '&times;'
      del.onclick = () => {
        if (q.options.length <= INTRUS_MIN_OPTIONS) {
          showToast(`Il faut au moins ${INTRUS_MIN_OPTIONS} photos`, 'error')
          return
        }
        const wasIntrus = q.correct[0] === q.options[idx].id
        q.options.splice(idx, 1)
        if (wasIntrus) q.correct = []
        renderIntrusOptions()
      }
      row.appendChild(del)
    }

    intrusEditList.appendChild(row)
  })
}

// Sélection MULTIPLE de fichiers en une fois (attribut "multiple" sur
// l'input, voir editor.html) : on compresse chaque fichier retenu et on
// ajoute une photo par fichier, jusqu'à INTRUS_MAX_OPTIONS — pas besoin de
// rouvrir le sélecteur 8 fois pour 8 photos.
if (intrusPhotosUploadInput) {
  intrusPhotosUploadInput.onchange = () => {
    const files = intrusPhotosUploadInput.files ? Array.from(intrusPhotosUploadInput.files) : []
    intrusPhotosUploadInput.value = ''
    addIntrusPhotos(files)
  }
}

// Extrait du onchange ci-dessus pour être réutilisable depuis le collage
// (Ctrl+V, voir l'écouteur "paste" plus bas dans ce fichier) — même logique,
// que les fichiers viennent du sélecteur ou du presse-papier.
function addIntrusPhotos (files) {
  const q = questions[activeIndex]
  if (!q || !files || files.length === 0) return
  if (!Array.isArray(q.options)) q.options = []
  const room = INTRUS_MAX_OPTIONS - q.options.length
  if (room <= 0) {
    showToast(`Maximum ${INTRUS_MAX_OPTIONS} photos`, 'error')
    return
  }
  const toAdd = files.slice(0, room)
  if (files.length > toAdd.length) {
    showToast(`Seules les ${toAdd.length} premières photos ont été ajoutées (maximum ${INTRUS_MAX_OPTIONS})`, 'error')
  }
  toAdd.forEach(file => {
    compressImageFile(file, (dataUrl) => {
      q.options.push({ id: genIntrusOptionId(), image: dataUrl })
      renderIntrusOptions()
    }, TILE_IMAGE_MAX_DIMENSION)
  })
}

// Coller une image (Ctrl+V) plutôt que devoir passer par le sélecteur de
// fichiers — demande explicite de l'utilisateur. Écouteur global (pas un par
// champ d'upload) : redirige vers la zone d'image pertinente pour le type de
// question actuellement affiché, déterminée par quelle section n'est pas
// masquée (voir toggleTypeSections) plutôt que par l'élément qui a le focus
// (aucun de ces encarts n'est un vrai champ de saisie où "coller" aurait un
// autre sens). Ignoré si le presse-papier ne contient PAS d'image (laisse le
// comportement natif du navigateur pour un collage de texte classique dans
// n'importe quel champ).
document.addEventListener('paste', (e) => {
  if (readOnly || !questions[activeIndex]) return
  const items = e.clipboardData && e.clipboardData.items
  if (!items) return
  const files = Array.from(items)
    .filter(it => it.kind === 'file' && it.type && it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean)
  if (files.length === 0) return
  e.preventDefault()
  const q = questions[activeIndex]
  if (q.type === 'image' && imageSection && !imageSection.classList.contains('d-none')) {
    compressImageFile(files[0], (dataUrl) => {
      q.image = dataUrl
      populateImageFields(q)
    })
  } else if (q.type === 'intrus' && intrusSection && !intrusSection.classList.contains('d-none')) {
    addIntrusPhotos(files)
  } else if (q.type === 'zoomguess' && zoomGuessSection && !zoomGuessSection.classList.contains('d-none')) {
    compressImageFile(files[0], (dataUrl) => {
      q.image = dataUrl
      q.zoom = { x: 0.5, y: 0.5, startScale: q.zoom?.startScale || ZOOM_GUESS_DEFAULT }
      populateZoomGuessFields(q)
    })
  } else if (illustrationSection && !illustrationSection.classList.contains('d-none')) {
    compressImageFile(files[0], (dataUrl) => {
      q.illustration = dataUrl
      populateIllustrationFields(q)
    })
  } else {
    return
  }
  showToast(files.length > 1 ? `${files.length} images collées !` : 'Image collée !')
})

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
  input.maxLength = TEXT_SHORT_MAXLENGTH
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
  } else if (qType.value === 'mcq') {
    // q.options venant d'un autre type peut avoir une forme totalement
    // différente ("intrus" : objets {id, image}) : on repart sur une liste
    // de textes classique, sauf s'il en a déjà une (ex. retour sur ce
    // type) — sans ce garde-fou, renderOptions() plante sur opt.trim()
    // (objet au lieu d'une chaîne), même bug que celui déjà corrigé pour
    // la navigation vers "intrus" depuis la barre latérale.
    if (!Array.isArray(q.options) || !q.options.every(o => typeof o === 'string')) q.options = []
    if (!Array.isArray(q.correct)) q.correct = []
    if (mcqRequireAllToggle) mcqRequireAllToggle.checked = q.requireAllCorrect !== false
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
  } else if (qType.value === 'zoomguess') {
    // q.correct venant d'un autre type peut être un objet (blindtest) ou des
    // formes spécifiques (association/timeline/image) : on repart sur une
    // liste de réponses acceptées classique, sauf s'il en a déjà une (ex.
    // retour sur ce type, ou venant de "free" qui a la même forme).
    if (!Array.isArray(q.correct)) q.correct = ['']
    populateZoomGuessFields(q)
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
    // q.options venant d'un autre type n'a pas la forme [{id,image}, ...]
    // attendue ici (ni q.correct=[id]) : on repart propre dans les deux cas,
    // sauf s'ils ont déjà la bonne forme (ex. retour sur ce type). Vide plutôt
    // qu'un tableau de 3 entrées comme les autres types : pas de placeholder
    // sensé pour une photo pas encore importée, l'utilisateur doit uploader.
    if (!isValidIntrusOptions(q.options)) q.options = []
    if (!Array.isArray(q.correct) || q.correct.length !== 1) q.correct = []
  } else if (qType.value === 'free') {
    // Seul type (avec zoomguess/mcq) resté sans branche ici jusqu'ici : un
    // q.correct hérité d'un autre type (objet blindtest, paires association,
    // id intrus...) restait dans une forme incompatible avec la liste de
    // réponses acceptées classique attendue par renderCorrects() pour ce
    // type — repart propre sauf s'il a déjà la bonne forme (ex. retour sur
    // ce type, ou venant de zoomguess/mcq qui partagent la même forme).
    if (!Array.isArray(q.options) || !q.options.every(o => typeof o === 'string')) q.options = []
    if (!Array.isArray(q.correct)) q.correct = ['']
  } else if (qType.value === 'pbac') {
    // "Petit Bac" n'a aucune liste de bonnes réponses prédéfinie (tout passe
    // par le regroupement de l'hôte en direct, voir server/index.js) : q.
    // correct/q.options hérités d'un autre type (paires association, zones
    // image, id intrus...) n'ont jamais de sens ici et restaient tels quels
    // — polluant silencieusement l'objet question envoyé au serveur sans
    // jamais être réellement utilisés (seul type oublié de ce nettoyage).
    q.correct = []
    q.options = []
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

// Extrait de l'ancien deleteQuestionBtn.onclick pour être appelable aussi
// depuis la croix de suppression de la sidebar (voir updateSidebar) — la
// question supprimée n'y est pas forcément la question active en cours
// d'édition, il faut donc décaler activeIndex correctement dans les deux
// cas plutôt que de toujours retomber sur "activeIndex - 1".
const deleteQuestionAt = (index) => {
  if (questions.length <= 1) {
    showToast('Un quiz doit avoir au moins une question', 'error')
    return
  }
  if (index < 0 || index >= questions.length) return

  const deletingActive = index === activeIndex
  // Si on supprime une AUTRE question que celle en cours d'édition, on
  // sauve d'abord son état (elle reste affichée/éditée après coup) — mais
  // surtout pas si c'est ELLE qu'on supprime (voir commentaire d'origine :
  // on ne veut pas "sauver" une question qui n'existe plus).
  if (!deletingActive && hasSelectedOnce) saveCurrentQuestionState()

  questions.splice(index, 1)

  if (deletingActive) {
    activeIndex = Math.min(index, questions.length - 1)
    const q = questions[activeIndex]

    if (qDraftToggle) qDraftToggle.checked = !!q.draft
    qPrompt.value = q.prompt || ''
    if (qExplanation) qExplanation.value = q.explanation || ''
    qType.value = q.type || 'free'
    qTimer.value = (q.timerMs || 15000) / 1000
    populateGradFields(q)
    populateTrueFalseFields(q)
    populateImageFields(q)
    populateIllustrationFields(q)
    populateZoomGuessFields(q)
    populateAudioFields(q)
    if (mcqRequireAllToggle) mcqRequireAllToggle.checked = q.requireAllCorrect !== false

    renderOptions()
    renderCorrects()
    renderOrderItems()
    renderCorrectTitleList()
    renderCorrectArtistList()
    renderAssociationPairs()
    renderTimelineEvents()
    renderIntrusOptions()
    toggleTypeSections()
  } else if (index < activeIndex) {
    // Une question AVANT celle en cours d'édition disparaît : tout le monde
    // après elle glisse d'un cran, activeIndex doit suivre pour continuer à
    // pointer sur la même question (déjà affichée, pas besoin de recharger
    // les champs).
    activeIndex -= 1
  }

  updateSidebar()
  qIndexLabel.textContent = `Question ${activeIndex + 1} / ${questions.length}`
  if (deletingActive) qPrompt.focus()
}

// Bouton "Supprimer cette question" retiré du bas du panneau (retour
// utilisateur, doublon avec la croix de la sidebar) — deleteQuestionBtn
// n'existe donc plus dans le DOM, guard nécessaire.
if (deleteQuestionBtn) deleteQuestionBtn.onclick = () => deleteQuestionAt(activeIndex)

// Confirmation avant suppression depuis la sidebar : contrairement au
// bouton "Supprimer" du panneau de détail (qu'il faut déjà avoir ouvert
// cette question pour atteindre), la croix de la liste est un clic rapide
// au milieu d'une zone de glisser-déposer — plus exposée au clic accidentel,
// d'où ce garde-fou supplémentaire ici uniquement.
const confirmDeleteQuestionAt = (index) => {
  if (questions.length <= 1) {
    showToast('Un quiz doit avoir au moins une question', 'error')
    return
  }
  const q = questions[index]
  const label = q?.prompt?.trim() ? `« ${q.prompt.trim()} »` : `la question ${index + 1}`
  QzUI.confirm({
    title: 'Supprimer cette question ?',
    message: `Tu es sur le point de supprimer ${label}. Cette action est définitive.`,
    confirmLabel: 'Supprimer',
    danger: true
  }).then((ok) => {
    if (ok) deleteQuestionAt(index)
  })
}

addOptionBtn.onclick = () => {
  if (questions[activeIndex].options.length >= MCQ_MAX_OPTIONS) {
    showToast(`Maximum ${MCQ_MAX_OPTIONS} options`, 'error')
    return
  }
  questions[activeIndex].options.push('')
  renderOptions()
}

addCorrectBtn.onclick = () => {
  if (questions[activeIndex].correct.length >= FREE_MAX_ANSWERS) {
    showToast(`Maximum ${FREE_MAX_ANSWERS} réponses acceptées`, 'error')
    return
  }
  questions[activeIndex].correct.push('')
  renderCorrects()
}
// --- Garde-fou "modifications non sauvegardées" -----------------------------
// Empêche de quitter l'éditeur (lien de la navbar, fermeture d'onglet,
// rafraîchissement) sans s'en rendre compte après une modification non
// sauvegardée. Comparaison par snapshot JSON plutôt qu'un drapeau "dirty"
// mis à true au premier changement : ça évite d'instrumenter un par un
// chaque point de mutation possible (glisser-déposer, upload, tracé de
// zone, coller une image...), et redevient automatiquement "propre" si
// l'utilisateur annule ses changements pour revenir à l'état sauvegardé.
const snapshotQuizState = () => {
  saveCurrentQuestionState()
  return JSON.stringify({
    title: titleEl.value.trim(),
    questions,
    singleAttempt: singleAttemptEl.checked,
    isPublic: isPublicEl.checked
  })
}
let savedSnapshot = null
const markSaved = () => { savedSnapshot = snapshotQuizState() }
const hasUnsavedChanges = () => !readOnly && savedSnapshot !== null && snapshotQuizState() !== savedSnapshot

// Onglet fermé/rafraîchi/URL tapée directement : impossible d'afficher une
// popup à notre image (le navigateur impose sa propre boîte de dialogue
// générique pour des raisons de sécurité), mais on garde ce filet natif pour
// les départs qu'on ne peut pas intercepter autrement.
let allowNavigation = false
// Vrai le temps de la requête réseau de sauvegarde (voir saveQuizBtn.onclick
// plus bas) : un départ pile à ce moment-là (onglet fermé, page rafraîchie)
// interromprait la requête en plein vol, avec un résultat imprévisible côté
// serveur (sauvegarde partielle ?). Le popup de chargement bloque déjà les
// clics DANS la page, mais pas fermeture d'onglet/rafraîchissement/URL tapée
// — d'où ce drapeau en plus de hasUnsavedChanges() sur les deux gardes-fous
// ci-dessous.
let isSaving = false
window.addEventListener('beforeunload', (e) => {
  if (allowNavigation || (!isSaving && !hasUnsavedChanges())) return
  e.preventDefault()
  e.returnValue = ''
})

// Clic sur un lien de la page (navbar : logo, Créer, Rejoindre, Mes Quiz...) :
// on peut l'intercepter à temps et proposer notre propre popup, cohérente
// avec le reste de l'identité QuEazy, plutôt que la boîte native.
document.addEventListener('click', (e) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target.closest('a[href]')
  if (!a || a.target === '_blank') return
  if (isSaving) {
    // Pendant la sauvegarde elle-même : pas de choix à proposer, on bloque
    // net (contrairement à "modifications non sauvegardées" ci-dessous, où
    // quitter quand même reste une option valable).
    e.preventDefault()
    showToast('Sauvegarde en cours, merci de patienter...', 'error')
    return
  }
  if (!hasUnsavedChanges()) return
  e.preventDefault()
  QzUI.confirm({
    title: 'Modifications non sauvegardées',
    message: 'Tu as des modifications non sauvegardées sur ce quiz. Veux-tu vraiment quitter sans les sauvegarder ?',
    confirmLabel: 'Quitter sans sauvegarder',
    cancelLabel: 'Rester',
    danger: true
  }).then((ok) => {
    if (!ok) return
    allowNavigation = true
    window.location.href = a.href
  })
})

// Popup plein écran bloquant pendant la sauvegarde (retour utilisateur :
// pouvoir sortir de la page en pleine sauvegarde, alors qu'il n'a pas fini
// de modifier ses questions, prêtait à confusion). Réutilise l'habillage
// visuel de QzUI.confirm (.modal-overlay/.modal-content) pour rester
// cohérent, mais sans aucun bouton — rien à cliquer, juste à attendre.
let saveLoadingOverlay = null
const ensureSaveOverlay = () => {
  if (!saveLoadingOverlay) {
    saveLoadingOverlay = document.createElement('div')
    saveLoadingOverlay.className = 'modal-overlay'
    document.body.appendChild(saveLoadingOverlay)
  }
  return saveLoadingOverlay
}
const showSaveLoading = () => {
  const overlay = ensureSaveOverlay()
  overlay.innerHTML = `
    <div class="modal-content" style="text-align:center;">
      <div class="qz-spinner" aria-hidden="true"></div>
      <p class="font-bold mt-16" style="margin:16px 0 0;">Sauvegarde en cours…</p>
      <p class="text-muted font-14" style="margin:6px 0 0;">Merci de patienter, ne quitte pas cette page.</p>
    </div>`
  overlay.classList.remove('d-none')
}
const hideSaveLoading = () => {
  if (saveLoadingOverlay) saveLoadingOverlay.classList.add('d-none')
}
// Bascule LA MÊME popup vers un état "succès" au lieu de la fermer aussitôt
// pour rouvrir un toast séparé en bas d'écran — retour utilisateur : "Sauvegarde
// effectuée" doit être vu directement là où le regard est déjà posé (la popup
// de chargement), pas ailleurs sur l'écran. Se referme seule après un court
// délai, pas besoin d'un bouton "OK" pour un message purement informatif.
const showSaveSuccess = (message) => {
  const overlay = ensureSaveOverlay()
  overlay.innerHTML = `
    <div class="modal-content" style="text-align:center;">
      <div class="qz-save-success-check" aria-hidden="true">✓</div>
      <p class="font-bold mt-16" style="margin:16px 0 0;">${message}</p>
    </div>`
  overlay.classList.remove('d-none')
  setTimeout(hideSaveLoading, 1400)
}

// Extrait de saveQuizBtn.onclick (retour utilisateur : pouvoir sauvegarder
// UNE SEULE question sans que le reste du quiz doive déjà être valide, voir
// saveQuestionBtn plus bas) — vérifie q (la question d'index i), et en cas
// d'erreur sélectionne l'onglet concerné + affiche le toast, exactement comme
// avant. true = valide, false = invalide (déjà signalé à l'utilisateur).
const validateQuestion = (q, i) => {
  // "Brouillon" : le but explicite est de pouvoir sauvegarder une question
  // inachevée (retour utilisateur) — aucune des règles ci-dessous ne doit
  // bloquer la sauvegarde tant que ce réglage reste coché. Elle est de
  // toute façon exclue de la partie (voir index.js, filtrée au chargement
  // du quiz pour l'hôte).
  if (q.draft) return true

  // Vérifier l'énoncé (commun à tous les types)
  if (!q.prompt || q.prompt.trim() === '') {
    selectQuestion(i)
    flagFieldError(qPrompt)
    showToast(`La question ${i + 1} n'a pas d'énoncé`, 'error')
    return false
  }

  if (q.type === 'mcq') {
    // Au moins une option non vide
    const validOptions = (q.options || []).filter(o => o && o.trim() !== '')
    if (validOptions.length === 0) {
      selectQuestion(i)
      showToast(`Le QCM ${i + 1} doit avoir au moins une option de réponse`, 'error')
      return false
    }
    // Au moins une option cochée comme correcte
    const hasChecked = validOptions.some(o => (q.correct || []).includes(o))
    if (!hasChecked) {
      selectQuestion(i)
      showToast(`Le QCM ${i + 1} : cochez au moins une bonne réponse`, 'error')
      return false
    }
  } else if (q.type === 'free') {
    // Au moins une réponse acceptée renseignée
    const hasAnswer = (q.correct || []).some(c => c && c.trim() !== '')
    if (!hasAnswer) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : renseignez au moins une réponse acceptée`, 'error')
      return false
    }
  } else if (q.type === 'zoomguess') {
    // Une image à deviner ET au moins une réponse acceptée sont obligatoires
    // (contrairement à l'illustration générique des autres types, purement
    // décorative et optionnelle).
    if (!q.image) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : importe une image à deviner`, 'error')
      return false
    }
    const hasAnswer = (q.correct || []).some(c => c && c.trim() !== '')
    if (!hasAnswer) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : renseignez au moins une réponse acceptée`, 'error')
      return false
    }
  }

  // Pour les curseurs numériques, vérifier la cohérence min/max/cible
  if (q.type === 'graduation') {
    const min = Number(q.min), max = Number(q.max), target = Number(q.correct?.[0])
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target)) {
      selectQuestion(i)
      showToast(`Le curseur ${i + 1} a des valeurs invalides`, 'error')
      return false
    }
    if (min >= max) {
      selectQuestion(i)
      showToast(`Le curseur ${i + 1} : le minimum doit être inférieur au maximum`, 'error')
      return false
    }
    if (target < min || target > max) {
      selectQuestion(i)
      showToast(`Le curseur ${i + 1} : la valeur correcte doit être entre le min et le max`, 'error')
      return false
    }
  }

  // Pour l'ordre/classement, il faut au moins 2 éléments non vides
  if (q.type === 'order') {
    const validItems = (q.correct || []).filter(item => item && item.trim() !== '')
    if (validItems.length < 2) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : il faut au moins 2 éléments à ordonner`, 'error')
      return false
    }
  }

  // Pour "association", entre 2 et 8 paires, chaque élément A et B rempli
  if (q.type === 'association') {
    const pairs = Array.isArray(q.correct) ? q.correct : []
    if (pairs.length < ASSOCIATION_MIN_PAIRS || pairs.length > ASSOCIATION_MAX_PAIRS) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : il faut entre ${ASSOCIATION_MIN_PAIRS} et ${ASSOCIATION_MAX_PAIRS} paires`, 'error')
      return false
    }
    // Chaque élément (A et B) doit avoir AU MOINS un texte OU une image —
    // les deux ensemble restent possibles, mais une image seule suffit
    // désormais (retour utilisateur : bloqué à la sauvegarde avec des
    // éléments image-seule, le texte était jusque-là obligatoire à tort).
    const hasEmpty = pairs.some(p => (!p.a || !p.a.trim()) && !p.aImage) || pairs.some(p => (!p.b || !p.b.trim()) && !p.bImage)
    if (hasEmpty) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : chaque élément doit avoir un texte ou une image`, 'error')
      return false
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
      return false
    }
    const hasEmptyTitle = events.some(e => !e.title || !e.title.trim())
    if (hasEmptyTitle) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : chaque événement doit avoir un titre`, 'error')
      return false
    }
    const hasInvalidDate = events.some(e => !Number.isFinite(Number(e.date)))
    if (hasInvalidDate) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : chaque événement doit avoir une date (année) valide`, 'error')
      return false
    }
  }

  // Pour "intrus", entre 3 et 8 photos toutes importées, et exactement un
  // intrus désigné (le radio garantit déjà "au plus un" côté UI ; ici on
  // vérifie qu'il y en a bien "au moins un").
  if (q.type === 'intrus') {
    const opts = Array.isArray(q.options) ? q.options : []
    if (opts.length < INTRUS_MIN_OPTIONS || opts.length > INTRUS_MAX_OPTIONS) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : il faut entre ${INTRUS_MIN_OPTIONS} et ${INTRUS_MAX_OPTIONS} photos`, 'error')
      return false
    }
    const hasMissingImage = opts.some(o => !o || !o.image)
    if (hasMissingImage) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : chaque emplacement doit avoir une photo`, 'error')
      return false
    }
    if (!Array.isArray(q.correct) || q.correct.length !== 1 || !opts.some(o => o.id === q.correct[0])) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : désigne l'intrus parmi les photos`, 'error')
      return false
    }
  }

  // Pour "image", il faut une image importée et une case désignée
  if (q.type === 'image') {
    if (!q.image) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : importe une image`, 'error')
      return false
    }
    if (!Array.isArray(q.correct) || !q.correct.some(zone => zoneToPolygonPoints(zone).length >= 3)) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : trace une zone sur l'image pour indiquer la bonne réponse`, 'error')
      return false
    }
  }

  // Pour "blindtest", il faut un extrait audio validé et au moins une
  // réponse acceptée pour le titre — et pour l'artiste aussi, SAUF en mode
  // "titre uniquement" (voir btTitleOnlyToggle), où ce champ est caché
  // côté joueur et jamais jugé côté serveur (voir answer:submit) : rien à
  // exiger ici non plus, sans quoi on bloque la sauvegarde pour un champ
  // que personne ne remplira jamais (bug remonté par l'utilisateur).
  if (q.type === 'blindtest') {
    if (!q.audio) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : importe et valide un extrait audio`, 'error')
      return false
    }
    const hasTitle = (q.correct?.title || []).some(c => c && c.trim() !== '')
    if (!hasTitle) {
      selectQuestion(i)
      showToast(`La question ${i + 1} : renseigne au moins un titre accepté`, 'error')
      return false
    }
    if (!q.titleOnly) {
      const hasArtist = (q.correct?.artist || []).some(c => c && c.trim() !== '')
      if (!hasArtist) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : renseigne au moins un artiste accepté`, 'error')
        return false
      }
    }
  }

  return true
}

// Upload à la sauvegarde vers le bucket Supabase Storage "quiz-media" (voir
// supabase/schema.sql) : jusqu'ici chaque image/son de question était
// stocké en base64 DANS la colonne JSON `questions` elle-même — ça alourdit
// la base pour rien (surtout les extraits blind test, en WAV non compressé,
// voir encodeWavMono plus haut). Un champ déjà en URL (http...) est laissé
// tel quel, idempotent : une re-sauvegarde ne réuploade pas ce qui n'a pas
// changé. Les vieux quiz jamais resauvegardés depuis ce chantier restent en
// base64 indéfiniment — pas de migration automatique de l'existant (voir
// emitQuestion côté index.js, qui gère toujours les deux formats).
// Tolérant à l'échec (jamais de throw) : le bucket/les policies "quiz-media"
// (voir supabase/schema.sql) doivent être collés à la main dans le Dashboard
// Supabase — tant que ce n'est pas fait (ou en cas de souci réseau/quota),
// l'upload échoue et cette fonction garde le base64 tel quel plutôt que de
// bloquer TOUTE la sauvegarde du quiz (retour utilisateur : le code peut
// partir en prod avant que le SQL soit collé). La migration s'active
// automatiquement dès que le bucket existe, sans nouveau déploiement.
const uploadMediaField = async (sb, ownerId, dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl
  try {
    const match = /^data:([^;]+);base64,/.exec(dataUrl)
    const mime = match ? match[1] : 'application/octet-stream'
    const ext = mime.split('/')[1] || 'bin'
    const blob = await (await fetch(dataUrl)).blob()
    // owner_id/... : correspond exactement à la policy RLS d'upload sur
    // storage.objects (voir schema.sql) — sinon rejeté par Supabase.
    const path = `${ownerId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await sb.storage.from('quiz-media').upload(path, blob, { contentType: mime })
    if (error) throw error
    return sb.storage.from('quiz-media').getPublicUrl(path).data.publicUrl
  } catch (err) {
    console.warn('[quiz-media] upload impossible, base64 conservé :', err?.message || err)
    return dataUrl
  }
}

// Parcourt tous les champs média connus, quel que soit le type de question
// (voir emitQuestion côté index.js pour la liste de référence : q.image,
// q.illustration, q.audio, pair.aImage/bImage pour "association",
// options[].image pour "intrus"). Uploads en parallèle, pas séquentiels.
const uploadQuestionMedia = async (sb, ownerId, qs) => {
  const uploads = []
  const field = (obj, key) => {
    if (!obj?.[key]) return
    uploads.push(uploadMediaField(sb, ownerId, obj[key]).then(url => { obj[key] = url }))
  }
  qs.forEach(q => {
    field(q, 'image')
    field(q, 'illustration')
    field(q, 'audio')
    if (q.type === 'association' && Array.isArray(q.correct)) {
      q.correct.forEach(pair => {
        field(pair, 'aImage')
        field(pair, 'bImage')
      })
    }
    if (q.type === 'intrus' && Array.isArray(q.options)) {
      q.options.forEach(opt => field(opt, 'image'))
    }
  })
  await Promise.all(uploads)
}

// Écriture réseau proprement dite — QUEL que soit le déclencheur ("Sauvegarder"
// en haut, valide TOUT le quiz, ou "Sauvegarder cette question" en bas, ne
// valide QUE la question active), la ligne Supabase est toujours réécrite en
// entier (une seule colonne JSON `questions` pour tout le quiz, pas de
// granularité par question côté base) — impossible techniquement de
// persister "seulement" une question. successMessage adapte juste le texte
// affiché à l'utilisateur pour rester honnête sur ce qui vient de se passer.
const persistQuiz = async (successMessage) => {
  const title = titleEl.value.trim() || 'Mon Quiz sans titre'
  const sb = window.supabaseClient
  isSaving = true
  showSaveLoading()
  saveQuizBtn.disabled = true
  if (saveQuestionBtn) saveQuestionBtn.disabled = true
  try {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      hideSaveLoading()
      showToast('Connecte-toi pour sauvegarder', 'error')
      return
    }
    await uploadQuestionMedia(sb, session.user.id, questions)
    const body = {
      title,
      questions,
      singleAttempt: singleAttemptEl.checked,
      isPublic: isPublicEl.checked
    }
    if (currentId) {
      const { error } = await sb.from('quizzes')
        .update({ title, questions, single_attempt: body.singleAttempt, is_public: body.isPublic })
        .eq('id', currentId)
      if (error) throw error
      showSaveSuccess(successMessage)
      markSaved()
    } else {
      const { data, error } = await sb.from('quizzes')
        .insert([{ title, questions, single_attempt: body.singleAttempt, is_public: body.isPublic, owner_id: session.user.id }])
        .select('id')
        .single()
      if (error) throw error
      currentId = data.id
      showSaveSuccess('Quiz créé et sauvegardé !')
      markSaved()
    }
  } catch (err) {
    hideSaveLoading()
    showToast('Erreur: ' + (err.message || 'sauvegarde'), 'error')
  } finally {
    isSaving = false
    saveQuizBtn.disabled = false
    if (saveQuestionBtn) saveQuestionBtn.disabled = false
  }
}

saveQuizBtn.onclick = async () => {
  if (readOnly) return
  saveCurrentQuestionState()
  for (let i = 0; i < questions.length; i++) {
    if (!validateQuestion(questions[i], i)) return
  }
  await persistQuiz('Sauvegarde effectuée !')
}

// Bouton "Sauvegarder" de la barre fixe en bas — simple doublon du bouton
// "Sauvegarder" du bandeau du haut (retour utilisateur), même comportement
// exact (valide TOUT le quiz, écrit toute la ligne Supabase), juste accessible
// sans remonter en haut de page pendant l'édition d'une question.
const saveQuestionBtn = document.getElementById('saveQuestion')
if (saveQuestionBtn) {
  saveQuestionBtn.onclick = (...args) => saveQuizBtn.onclick(...args)
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

// --- Tutoriel de prise en main (visite guidée "spotlight", voir QzUI.tour
// dans ui-widgets.js) : cible uniquement les zones TOUJOURS visibles quel
// que soit le type de question sélectionné (jamais une section de détail
// spécifique à un type comme #mcqSection, qui reste d-none la plupart du
// temps) — reste donc valable peu importe l'état de l'éditeur au moment où
// il se déclenche. Auto-affiché une fois (voir maybeStartEditorTour), rejoué
// à volonté via le bouton #replayTutorialBtn.
const EDITOR_TOUR_STORAGE_KEY = 'queazy_editor_tutorial_dismissed'
const EDITOR_TOUR_STEPS = [
  { target: '#title', title: 'Titre du quiz', text: 'Donne un nom à ton quiz — c\'est ce que tes joueurs verront pour le choisir.' },
  { target: '#addQuestion', title: 'Ajouter une question', text: 'Clique ici pour ajouter une nouvelle question à ton quiz.' },
  { target: '#questionList', title: 'Liste des questions', text: 'Toutes tes questions apparaissent ici. Glisse-les pour les réordonner, clique pour éditer, la croix pour supprimer.' },
  // Ordre aligné sur la disposition actuelle du formulaire (retour
  // utilisateur) : type + minuteur remontés tout en haut (juste sous
  // Brouillon), avant l'énoncé — voir editor.html.
  { target: '#qType', title: 'Type de question', text: '10 types disponibles : QCM, Vrai/Faux, curseur numérique, ordre, image, blind test, association, timeline, intrus... Chacun a sa propre zone de configuration plus bas, qui s\'adapte automatiquement à ton choix.' },
  { target: '#qTimer', title: 'Temps imparti', text: 'Règle en secondes le temps laissé aux joueurs pour répondre, avec les boutons - et +.' },
  { target: '#qPrompt', title: 'Énoncé de la question', text: 'Écris ta question ici — c\'est ce qui s\'affiche en grand à l\'écran pendant la partie.' },
  { target: '#illustrationUpload', title: 'Illustration (optionnelle)', text: 'Ajoute une image au-dessus de la question, purement décorative (le type "Image" a son propre mécanisme cliquable, séparé de celle-ci).' },
  { target: '#qExplanation', title: 'Explication (optionnelle)', text: 'Un texte affiché juste après la révélation de la bonne réponse, pour donner un peu de contexte.' },
  { target: '#saveQuiz', title: 'Sauvegarder', text: 'N\'oublie pas de sauvegarder une fois ton quiz prêt !' }
]
const startEditorTour = (force) => {
  if (window.QzUI) window.QzUI.tour(EDITOR_TOUR_STEPS, { storageKey: EDITOR_TOUR_STORAGE_KEY, force: !!force })
}
// Jamais pour un viewer en lecture seule (quiz d'un autre créateur) : le
// tutoriel explique comment CRÉER, ça n'a pas de sens là où on ne peut rien
// modifier — readOnly n'est confirmé qu'après la réponse Supabase (voir
// init ci-dessous), d'où l'appel différé plutôt qu'ici directement.
const maybeStartEditorTour = () => { if (!readOnly) startEditorTour(false) }
if (replayTutorialBtn) replayTutorialBtn.onclick = () => startEditorTour(true)

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
        markSaved()

        // Seul le créateur peut modifier : sinon, lecture seule (la base le
        // refuse déjà via RLS, mais on l'empêche aussi dans l'UI).
        const { data: { session } } = await sb.auth.getSession()
        if (!session || session.user.id !== data.owner_id) {
          applyReadOnly()
        }
        maybeStartEditorTour()
      })
      .catch(() => {
        showToast('Erreur lors du chargement du quiz', 'error')
        resetToNew()
        maybeStartEditorTour()
      })
  } else {
    resetToNew()
    maybeStartEditorTour()
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
  markSaved()
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
