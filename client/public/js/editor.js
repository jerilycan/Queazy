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
    qGradMin, qGradMax, qGradTarget,
    document.getElementById('gradMinMinus'), document.getElementById('gradMinPlus'),
    document.getElementById('gradMaxMinus'), document.getElementById('gradMaxPlus'),
    document.getElementById('gradTargetMinus'), document.getElementById('gradTargetPlus')
  ]
  controls.forEach(el => { if (el) el.disabled = true })
  if (saveQuizBtn) saveQuizBtn.style.display = 'none'
  if (deleteQuizBtn) deleteQuizBtn.style.display = 'none'
  if (duplicateQuizBtn) duplicateQuizBtn.classList.remove('d-none')
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

const updateSidebar = () => {
  questionListEl.innerHTML = ''
  questions.forEach((q, idx) => {
    const item = document.createElement('div')
    item.className = `question-item type-${q.type || 'free'} ${idx === activeIndex ? 'active' : ''}`.trim()
    item.onclick = () => selectQuestion(idx)
    
    const num = document.createElement('span')
    num.className = 'q-num'
    num.textContent = idx + 1
    
    const text = document.createElement('span')
    text.className = 'q-text'
    text.textContent = q.prompt || '(Nouvelle question)'
    
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

  renderOptions()
  renderCorrects()
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
  }
}

const toggleTypeSections = () => {
  mcqSection.classList.toggle('d-none', qType.value !== 'mcq')
  if (graduationSection) graduationSection.classList.toggle('d-none', qType.value !== 'graduation')
  if (correctSection) correctSection.classList.toggle('d-none', qType.value === 'graduation')
  if (qType.value === 'mcq') {
    correctLabel.textContent = 'Réponses correctes'
  } else {
    correctLabel.textContent = 'Réponses acceptées'
  }
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
  }
  toggleTypeSections()
  renderOptions()
  renderCorrects()
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

  renderOptions()
  renderCorrects()
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
