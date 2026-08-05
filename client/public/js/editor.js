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
const qType = document.getElementById('qType')
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

const trueFalseSection = document.getElementById('trueFalseSection')
const tfTrueBtn = document.getElementById('tfTrueBtn')
const tfFalseBtn = document.getElementById('tfFalseBtn')

const orderSection = document.getElementById('orderSection')
const orderEditList = document.getElementById('orderEditList')
const addOrderItemBtn = document.getElementById('addOrderItem')

const imageSection = document.getElementById('imageSection')
const imageUploadInput = document.getElementById('imageUpload')
const imageEditWrap = document.getElementById('imageEditWrap')
const imageEditImg = document.getElementById('imageEditImg')
const imageEditZone = document.getElementById('imageEditZone')
const clearImageZoneBtn = document.getElementById('clearImageZoneBtn')

// Illustration optionnelle (tous les types SAUF "image", qui a déjà sa propre
// image cliquable ci-dessus) : simple photo affichée au-dessus de la question,
// stockée dans un champ distinct (q.illustration) pour ne jamais se marcher
// dessus avec q.image.
const illustrationSection = document.getElementById('illustrationSection')
const illustrationUploadInput = document.getElementById('illustrationUpload')
const illustrationPreviewWrap = document.getElementById('illustrationPreviewWrap')
const illustrationPreviewImg = document.getElementById('illustrationPreviewImg')
const removeIllustrationBtn = document.getElementById('removeIllustrationBtn')

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
    qGradMin, qGradMax, qGradTarget, tfTrueBtn, tfFalseBtn, addOrderItemBtn, imageUploadInput,
    clearImageZoneBtn, illustrationUploadInput, removeIllustrationBtn,
    document.getElementById('gradMinMinus'), document.getElementById('gradMinPlus'),
    document.getElementById('gradMaxMinus'), document.getElementById('gradMaxPlus'),
    document.getElementById('gradTargetMinus'), document.getElementById('gradTargetPlus')
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

const showToast = (msg, type = 'info') => {
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

// Glisser-déposer pour réordonner les questions (souris/desktop uniquement :
// l'API HTML5 Drag and Drop n'est pas fiable au toucher sur mobile, ce qui
// est acceptable ici puisque l'éditeur de quiz n'est pas pensé pour mobile).
let dragSrcIndex = null

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

const updateSidebar = () => {
  questionListEl.innerHTML = ''
  questions.forEach((q, idx) => {
    const item = document.createElement('div')
    item.className = `question-item type-${q.type || 'free'} ${idx === activeIndex ? 'active' : ''}`.trim()
    item.onclick = () => selectQuestion(idx)
    item.draggable = !readOnly
    item.dataset.index = idx

    if (!readOnly) {
      item.addEventListener('dragstart', (e) => {
        dragSrcIndex = idx
        item.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
      })
      item.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        item.classList.add('drag-over')
      })
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'))
      item.addEventListener('drop', (e) => {
        e.preventDefault()
        item.classList.remove('drag-over')
        if (dragSrcIndex === null || dragSrcIndex === idx) return
        if (hasSelectedOnce) saveCurrentQuestionState()
        moveQuestion(dragSrcIndex, idx)
        dragSrcIndex = null
      })
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging')
        Array.from(questionListEl.children).forEach(c => c.classList.remove('drag-over'))
        dragSrcIndex = null
      })
    }

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
}

const populateTrueFalseFields = (q) => {
  if (!tfTrueBtn) return
  const isTrue = (q.correct?.[0] ?? 'Vrai') === 'Vrai'
  tfTrueBtn.classList.toggle('active', isTrue)
  tfFalseBtn.classList.toggle('active', !isTrue)
}

// Zone de bonne réponse (type "image") : rectangle tracé au pixel par
// glisser-déposer directement sur l'image, stocké en coordonnées normalisées
// 0-1 (x0,y0,x1,y1) — pas de grille côté éditeur (contrairement à l'écran de
// jeu, voir index.js) : une grille fixe est trop grossière pour cadrer une
// forme irrégulière (ex. un département) sans déborder sur ses voisins,
// alors qu'un rectangle libre peut se caler au pixel près.
const renderImageZone = (rect) => {
  if (!imageEditZone) return
  if (!rect || typeof rect.x0 !== 'number') {
    imageEditZone.classList.add('d-none')
    return
  }
  imageEditZone.classList.remove('d-none')
  imageEditZone.style.left = `${rect.x0 * 100}%`
  imageEditZone.style.top = `${rect.y0 * 100}%`
  imageEditZone.style.width = `${(rect.x1 - rect.x0) * 100}%`
  imageEditZone.style.height = `${(rect.y1 - rect.y0) * 100}%`
}

// En dessous de cette taille (normalisée), on considère le tracé comme un
// clic accidentel plutôt qu'une vraie sélection, et on ignore le résultat.
const IMAGE_ZONE_MIN_SIZE = 0.015

if (imageEditWrap) {
  let dragStart = null
  const pointFromEvent = (e) => {
    const rect = imageEditWrap.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    }
  }
  const rectFrom = (a, b) => ({
    x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y)
  })
  imageEditWrap.addEventListener('mousedown', (e) => {
    if (readOnly || !questions[activeIndex]?.image) return
    dragStart = pointFromEvent(e)
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => {
    if (!dragStart) return
    renderImageZone(rectFrom(dragStart, pointFromEvent(e)))
  })
  window.addEventListener('mouseup', (e) => {
    if (!dragStart) return
    const zone = rectFrom(dragStart, pointFromEvent(e))
    dragStart = null
    if (!questions[activeIndex]) return
    if (zone.x1 - zone.x0 < IMAGE_ZONE_MIN_SIZE || zone.y1 - zone.y0 < IMAGE_ZONE_MIN_SIZE) {
      // Tracé trop petit (clic accidentel) : on garde la zone précédente.
      renderImageZone(questions[activeIndex].correct?.[0])
      return
    }
    questions[activeIndex].correct = [zone]
    renderImageZone(zone)
  })
}

if (clearImageZoneBtn) {
  clearImageZoneBtn.onclick = () => {
    if (readOnly || !questions[activeIndex]) return
    questions[activeIndex].correct = []
    renderImageZone(null)
  }
}

const populateImageFields = (q) => {
  if (!imageEditWrap) return
  if (q.image) {
    imageEditImg.src = q.image
    imageEditWrap.classList.remove('d-none')
    renderImageZone(q.correct?.[0])
  } else {
    imageEditWrap.classList.add('d-none')
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

const selectQuestion = (index) => {
  if (hasSelectedOnce) saveCurrentQuestionState()
  activeIndex = index
  const q = questions[activeIndex]
  if (!q) return

  // Mettre à jour les champs
  qPrompt.value = q.prompt || ''
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  populateGradFields(q)
  populateTrueFalseFields(q)
  populateImageFields(q)
  populateIllustrationFields(q)

  renderOptions()
  renderCorrects()
  renderOrderItems()
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
  q.type = qType.value
  q.timerMs = parseInt(qTimer.value) * 1000 || 15000
  if (q.type === 'graduation') {
    q.min = Number(qGradMin.value)
    q.max = Number(qGradMax.value)
    q.correct = [String(qGradTarget.value)]
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
  // L'illustration optionnelle n'a de sens que pour les types qui n'ont pas
  // déjà leur propre image (le type "image" utilise la sienne comme cible
  // cliquable, pas comme simple décoration).
  if (illustrationSection) illustrationSection.classList.toggle('d-none', qType.value === 'image')
  if (correctSection) correctSection.classList.toggle('d-none', qType.value === 'graduation' || qType.value === 'truefalse' || qType.value === 'order' || qType.value === 'image')
  if (qType.value === 'mcq') {
    correctLabel.textContent = 'Réponses correctes'
  } else {
    correctLabel.textContent = 'Réponses acceptées'
  }
}

if (tfTrueBtn && tfFalseBtn) {
  tfTrueBtn.onclick = () => { if (questions[activeIndex]) questions[activeIndex].correct = ['Vrai']; populateTrueFalseFields(questions[activeIndex]) }
  tfFalseBtn.onclick = () => { if (questions[activeIndex]) questions[activeIndex].correct = ['Faux']; populateTrueFalseFields(questions[activeIndex]) }
}

const renderOptions = () => {
  optionsList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q) return
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

// Réutilise le même glisser-déposer HTML5 que la sidebar des questions
// (moveQuestion) : ici on réordonne q.correct, la séquence "bonne réponse".
let orderDragSrcIndex = null

const renderOrderItems = () => {
  if (!orderEditList) return
  orderEditList.innerHTML = ''
  const q = questions[activeIndex]
  if (!q) return
  if (!Array.isArray(q.correct) || q.correct.length === 0) q.correct = ['', '']

  q.correct.forEach((item, idx) => {
    const row = document.createElement('div')
    row.className = 'option-row order-edit-row'
    row.draggable = !readOnly
    row.dataset.index = idx

    if (!readOnly) {
      row.addEventListener('dragstart', () => { orderDragSrcIndex = idx; row.classList.add('dragging') })
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over') })
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'))
      row.addEventListener('drop', (e) => {
        e.preventDefault()
        row.classList.remove('drag-over')
        if (orderDragSrcIndex === null || orderDragSrcIndex === idx) return
        const [moved] = q.correct.splice(orderDragSrcIndex, 1)
        q.correct.splice(idx, 0, moved)
        orderDragSrcIndex = null
        renderOrderItems()
      })
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging')
        Array.from(orderEditList.children).forEach(c => c.classList.remove('drag-over'))
        orderDragSrcIndex = null
      })
    }

    if (!readOnly) {
      const handle = document.createElement('span')
      handle.className = 'q-drag-handle'
      handle.textContent = '⠿'
      row.appendChild(handle)
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
    // au format {x0,y0,x1,y1} attendu : on repart propre sauf s'il a déjà la
    // bonne forme (ex. retour sur ce type).
    if (!Array.isArray(q.correct) || typeof q.correct[0]?.x0 !== 'number') q.correct = []
    populateImageFields(q)
  }
  toggleTypeSections()
  renderOptions()
  renderCorrects()
  renderOrderItems()
}

qPrompt.oninput = () => {
  questions[activeIndex].prompt = qPrompt.value
  // Mettre à jour seulement le texte dans la sidebar pour la fluidité
  const activeItem = questionListEl.children[activeIndex]
  if (activeItem) {
    activeItem.querySelector('.q-text').textContent = qPrompt.value || '(Nouvelle question)'
  }
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
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  populateGradFields(q)
  populateTrueFalseFields(q)
  populateImageFields(q)
  populateIllustrationFields(q)

  renderOptions()
  renderCorrects()
  renderOrderItems()
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

    // Pour "image", il faut une image importée et une case désignée
    if (q.type === 'image') {
      if (!q.image) {
        selectQuestion(i)
        showToast(`La question ${i + 1} : importe une image`, 'error')
        return
      }
      if (typeof q.correct?.[0]?.x0 !== 'number') {
        selectQuestion(i)
        showToast(`La question ${i + 1} : trace un rectangle sur l'image pour indiquer la zone correcte`, 'error')
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

deleteQuizBtn.onclick = () => {
  if (readOnly) return
  if (!currentId) return
  if (!confirm('Voulez-vous vraiment supprimer ce quiz ?')) return
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
