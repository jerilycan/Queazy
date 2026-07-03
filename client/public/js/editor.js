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
const saveQuizBtn = document.getElementById('saveQuiz')
const deleteQuizBtn = document.getElementById('deleteQuiz')
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
const correctList = document.getElementById('correctList')
const addCorrectBtn = document.getElementById('addCorrect')
const deleteQuestionBtn = document.getElementById('deleteQuestion')
const qIndexLabel = document.getElementById('qIndexLabel')
const correctLabel = document.getElementById('correctLabel')

// État de l'application
let currentId = null
let questions = []
let activeIndex = 0
let hasSelectedOnce = false

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

const selectQuestion = (index) => {
  if (hasSelectedOnce) saveCurrentQuestionState()
  activeIndex = index
  const q = questions[activeIndex]
  if (!q) return

  // Mettre à jour les champs
  qPrompt.value = q.prompt || ''
  qType.value = q.type || 'free'
  qTimer.value = (q.timerMs || 15000) / 1000
  
  renderOptions()
  renderCorrects()
  toggleMcqSection()
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
}

const toggleMcqSection = () => {
  const correctSection = correctList.closest('.detail-section')
  if (qType.value === 'mcq') {
    mcqSection.classList.remove('d-none')
    if (correctSection) correctSection.classList.add('d-none')
    correctLabel.textContent = 'Réponses correctes'
  } else {
    mcqSection.classList.add('d-none')
    if (correctSection) correctSection.classList.remove('d-none')
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
    check.onchange = (e) => onCheck(e.target.checked)
    div.appendChild(check)
  }
  
  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  input.placeholder = 'Entrez du texte...'
  input.style.flex = '1'
  input.oninput = (e) => onInput(e.target.value)
  
  const del = document.createElement('button')
  del.className = 'btn-icon btn-danger'
  del.innerHTML = '&times;'
  del.onclick = onDelete
  
  div.appendChild(input)
  div.appendChild(del)
  return div
}

// --- Événements ---

qType.onchange = () => {
  questions[activeIndex].type = qType.value
  toggleMcqSection()
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
  
  renderOptions()
  renderCorrects()
  toggleMcqSection()
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
  saveCurrentQuestionState()
  
  // Validation avant sauvegarde
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    
    // Vérifier l'énoncé
    if (!q.prompt || q.prompt.trim() === '') {
      selectQuestion(i)
      showToast(`La question ${i + 1} n'a pas d'énoncé`, 'error')
      return
    }
    
    // Vérifier les réponses correctes
    const hasCorrectResponse = q.correct && q.correct.some(c => c && c.trim() !== '')
    if (!hasCorrectResponse) {
      selectQuestion(i)
      showToast(`La question ${i + 1} doit avoir au moins une réponse valide`, 'error')
      return
    }
    
    // Pour les QCM, vérifier qu'il y a des options
    if (q.type === 'mcq') {
      const hasValidOptions = q.options && q.options.some(o => o && o.trim() !== '')
      if (!hasValidOptions) {
        selectQuestion(i)
        showToast(`Le QCM ${i + 1} doit avoir au moins une option de réponse`, 'error')
        return
      }
    }
  }
  
  const title = titleEl.value.trim() || 'Mon Quiz sans titre'
  const body = {
    title,
    questions,
    singleAttempt: singleAttemptEl.checked
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
        .update({ title, questions, single_attempt: body.singleAttempt })
        .eq('id', currentId)
      if (error) throw error
      showToast('Quiz sauvegardé avec succès !')
    } else {
      const { data, error } = await sb.from('quizzes')
        .insert([{ title, questions, single_attempt: body.singleAttempt, is_public: false, owner_id: session.user.id }])
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

deleteQuizBtn.onclick = () => {
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
      .select('id,title,questions,single_attempt')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) throw error
        titleEl.value = data.title || ''
        singleAttemptEl.checked = data.single_attempt !== false
        questions = data.questions || [createDefaultQuestion()]
        activeIndex = 0
        selectQuestion(0)
        updateSidebar()
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
