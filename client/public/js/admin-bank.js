// Page de modération de la banque de questions (tâche 022). Accessible à
// tout compte présent dans `bank_admins` (moderator OU super) ; la section
// "gestion des admins" n'est rendue que pour un `role='super'`. Rappel :
// cette vérification côté client n'est qu'un confort d'affichage — la
// vraie barrière de sécurité est la RLS sur `bank_questions`/`bank_admins`
// (voir supabase/schema.sql et le contexte du fichier de tâche 022).
const sb = window.supabaseClient
const profileLink = document.getElementById('profile')
const toastsEl = document.getElementById('toasts')

const gateStateEl = document.getElementById('gateState')
const pendingSectionEl = document.getElementById('pendingSection')
const pendingEmptyEl = document.getElementById('pendingEmpty')
const pendingTableWrapEl = document.getElementById('pendingTableWrap')
const adminsSectionEl = document.getElementById('adminsSection')
const adminsTableBodyEl = document.getElementById('adminsTableBody')
const newAdminEmailEl = document.getElementById('newAdminEmail')
const newAdminRoleEl = document.getElementById('newAdminRole')
const addAdminBtn = document.getElementById('addAdminBtn')
const categoriesSectionEl = document.getElementById('categoriesSection')
const categoriesTableBodyEl = document.getElementById('categoriesTableBody')
const newCategoryNameEl = document.getElementById('newCategoryName')
const addCategoryBtn = document.getElementById('addCategoryBtn')

const showToast = (msg, type = 'info') => {
  if (window.QzUI) { window.QzUI.toast(msg, type); return }
  const t = document.createElement('div')
  t.textContent = msg
  t.style.padding = '12px 20px'
  t.style.borderRadius = '12px'
  t.style.fontWeight = '600'
  t.style.color = 'white'
  t.style.background = type === 'error' ? '#ef4444' : 'var(--color-accent)'
  toastsEl.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

// Même dictionnaire que QUESTION_TYPE_META dans index.js/editor.js, réduit
// aux seuls libellés utiles ici (pas d'icône/couleur nécessaire dans un
// tableau texte) — pas de module partagé dans ce projet (pas de bundler),
// dupliquer un petit dictionnaire reste plus simple qu'une abstraction pour
// ce seul usage (voir CLAUDE.md).
const TYPE_LABELS = {
  free: 'Texte libre', mcq: 'Choix multiples', truefalse: 'Vrai / Faux',
  graduation: 'Curseur numérique', order: 'Ordre / classement', image: 'Image',
  zoomguess: 'ZoomOut Devinette', reveal: 'Révélation', blindtest: 'Blind Test',
  association: 'Association', timeline: 'Timeline', rangement: 'Rangement',
  intrus: 'Intrus', pbac: 'Petit Bac', recherche: 'Recherche', indice: 'Indice',
  halo: 'Halo'
}
const DIFFICULTY_LABELS = { facile: 'Facile', moyen: 'Moyenne', difficile: 'Difficile' }

// --- Navbar : même garde Jouer/Présenter que profile.js/select.js ---------
const applyNavGuard = (session) => {
  const navCreateEl = document.getElementById('navCreate')
  const navPlayEl = document.getElementById('navPlay')
  const canCreate = !!session
  ;[navCreateEl, navPlayEl].forEach(el => {
    if (!el) return
    el.classList.toggle('is-disabled', !canCreate)
    el.title = canCreate ? '' : 'Connecte-toi pour continuer'
    if (!canCreate) el.onclick = (e) => { e.preventDefault(); window.location.href = '/login.html?reason=create' }
  })
}

const applyProfileChip = (session) => {
  const navLogin = document.getElementById('navLogin')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileNameEl = document.getElementById('profileName')
  if (!session) {
    if (navLogin) navLogin.classList.remove('d-none')
    if (profileLink) profileLink.classList.add('d-none')
    return
  }
  if (navLogin) navLogin.classList.add('d-none')
  if (profileLink) profileLink.classList.remove('d-none')
  const user = session.user
  const displayName = user.user_metadata?.full_name || user.email.split('@')[0]
  if (profileNameEl) profileNameEl.textContent = (displayName || '').trim().split(/\s+/)[0] || 'Profil'
  if (profileAvatar) {
    profileAvatar.style.display = 'flex'
    profileAvatar.style.alignItems = 'center'
    profileAvatar.style.justifyContent = 'center'
    profileAvatar.style.borderRadius = '50%'
    profileAvatar.style.background = 'var(--color-accent)'
    profileAvatar.style.color = 'white'
    profileAvatar.textContent = (displayName || '??').substring(0, 2).toUpperCase()
  }
}

// --- Questions en attente ---------------------------------------------

// Toutes les images possibles d'une question, tous types confondus (voir
// editor.js pour la liste de référence des champs par type : q.image pour
// image/zoomguess/recherche/halo, q.enigmeImage/q.reponseImage pour
// "reveal", q.illustration pour l'illustration optionnelle générique,
// q.options[].image pour "intrus", q.hints[].image pour "indice") — jamais
// de data URI ici (uploadQuestionMedia les transforme déjà en URL Supabase
// avant l'ajout à la banque, voir addToBankBtn côté editor.js), donc de
// simples <img src> suffisent, pas besoin de gérer un format base64.
const collectQuestionImages = (q) => {
  if (!q) return []
  const urls = []
  ;['image', 'illustration', 'enigmeImage', 'reponseImage'].forEach(key => { if (q[key]) urls.push(q[key]) })
  if (Array.isArray(q.options)) q.options.forEach(o => { if (o && o.image) urls.push(o.image) })
  if (Array.isArray(q.hints)) q.hints.forEach(h => { if (h && h.image) urls.push(h.image) })
  return urls
}

// Réponse correcte, lisible pour un humain qui relit avant d'approuver
// (retour utilisateur — repérer une erreur dans l'énoncé ou dans la
// réponse elle-même). `q.correct` a une forme DIFFÉRENTE par type (voir
// editor.js, chaque type l'écrit à sa façon) — ce n'est qu'un texte de
// relecture, jamais réinjecté nulle part, donc pas besoin d'un rendu
// pixel-perfect par type comme le vrai jeu : un résumé fidèle suffit.
const describeAnswer = (q) => {
  if (!q) return '—'
  switch (q.type) {
    case 'mcq':
      // q.correct = les TEXTES des options correctes (pas des index),
      // voir editor.js renderOptions.
      return Array.isArray(q.correct) && q.correct.length ? q.correct.join(' / ') : '—'
    case 'truefalse':
      return q.correct?.[0] || '—'
    case 'graduation':
      return q.correct?.[0] != null ? String(q.correct[0]) : '—'
    case 'order':
      return Array.isArray(q.correct) && q.correct.length ? q.correct.join(' → ') : '—'
    case 'association':
      return Array.isArray(q.correct) && q.correct.length
        ? q.correct.map(p => `${p?.a || '?'} ↔ ${p?.b || '?'}`).join(', ')
        : '—'
    case 'timeline':
      return Array.isArray(q.correct) && q.correct.length
        ? q.correct.map(e => e?.title || '?').join(' → ')
        : '—'
    case 'rangement':
      return Array.isArray(q.correct) && q.correct.length
        ? q.correct.map(it => `${it?.title || '?'} (${(q.zones || [])[it?.zone] || '?'})`).join(', ')
        : '—'
    case 'intrus': {
      // q.correct = [id de la tuile intrus] — pas de texte associé (ce
      // sont des photos), on retrouve juste sa position dans q.options.
      const idx = Array.isArray(q.options) ? q.options.findIndex(o => o?.id === q.correct?.[0]) : -1
      return idx >= 0 ? `Photo n°${idx + 1}` : '—'
    }
    case 'blindtest': {
      const title = q.correct?.title?.[0]
      const artist = q.correct?.artist?.[0]
      return [title && `Titre : ${title}`, artist && `Artiste : ${artist}`].filter(Boolean).join(' — ') || '—'
    }
    // free / pbac / indice / recherche / halo / image / zoomguess / reveal :
    // toutes des réponses texte libre, q.correct = tableau de variantes
    // acceptées.
    default:
      return Array.isArray(q.correct) && q.correct.length ? q.correct.filter(Boolean).join(' / ') : '—'
  }
}

// Timer (retour utilisateur : pouvoir l'augmenter si jugé trop court avant
// d'approuver) — modifie DIRECTEMENT q.timerMs dans le jsonb `question`,
// jamais une colonne séparée (le timer n'existe que dans ce blob, comme
// pour un quiz normal, voir emitQuestion côté index.js). ré-écrit tout
// l'objet `question` (déjà chargé en mémoire par loadPending) plutôt qu'un
// jsonb_set côté SQL — plus simple, cohérent avec le reste du fichier qui
// ne fait jamais d'appel RPC dédié.
const saveTimer = async (row, seconds, btn) => {
  const ms = Math.max(3, Math.min(120, Math.round(Number(seconds) || 0))) * 1000
  btn.disabled = true
  try {
    const updatedQuestion = { ...row.question, timerMs: ms }
    const { error } = await sb.from('bank_questions').update({ question: updatedQuestion }).eq('id', row.id)
    if (error) throw error
    row.question = updatedQuestion // garde la ligne en mémoire à jour si Approuver est cliqué juste après
    showToast('Timer mis à jour.')
  } catch (err) {
    console.error('[admin-bank] mise à jour du timer impossible :', err)
    showToast('Erreur lors de la mise à jour du timer', 'error')
  } finally {
    btn.disabled = false
  }
}

// Énoncé + difficulté (retour utilisateur : pouvoir corriger une coquille
// ou reclasser une question mal calibrée avant de l'approuver) — l'énoncé
// vit dans le jsonb `question` (même logique que le timer ci-dessus),
// la difficulté est elle une VRAIE colonne de bank_questions (voir
// supabase/schema.sql) : les deux se sauvent donc en un seul update, sur
// deux champs différents du même appel .update({...}).
const saveQuestionEdits = async (row, promptText, difficulty, btn) => {
  const prompt = (promptText || '').trim()
  if (!prompt) { showToast('L\'énoncé ne peut pas être vide', 'error'); return }
  btn.disabled = true
  try {
    const updatedQuestion = { ...row.question, prompt }
    const { error } = await sb.from('bank_questions').update({ question: updatedQuestion, difficulty }).eq('id', row.id)
    if (error) throw error
    row.question = updatedQuestion
    row.difficulty = difficulty
    showToast('Question mise à jour.')
  } catch (err) {
    console.error('[admin-bank] mise à jour de la question impossible :', err)
    showToast('Erreur lors de la mise à jour de la question', 'error')
  } finally {
    btn.disabled = false
  }
}

const renderPending = (rows, authorsById) => {
  if (rows.length === 0) {
    pendingEmptyEl.classList.remove('d-none')
    pendingTableWrapEl.classList.add('d-none')
    return
  }
  pendingEmptyEl.classList.add('d-none')
  pendingTableWrapEl.classList.remove('d-none')
  pendingTableWrapEl.innerHTML = ''
  rows.forEach(row => {
    const authorName = authorsById.get(row.created_by) || '—'
    const images = collectQuestionImages(row.question)
    const imagesHtml = images.length
      ? images.map(url => `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="" class="admin-bank-thumb" /></a>`).join('')
      : ''

    // Une carte par question (retour utilisateur — voir index.html pour le
    // pourquoi) : en-tête avec catégorie/type/auteur en pastilles, puis
    // l'énoncé et la difficulté éditables pleine largeur, les images si il
    // y en a, puis timer + actions sur une dernière ligne qui passe à la
    // ligne proprement (flex-wrap) plutôt que de compresser des colonnes.
    const card = document.createElement('div')
    card.className = 'admin-bank-question-card'
    card.innerHTML = `
      <div class="admin-bank-card-meta">
        <span class="admin-bank-meta-pill">${row.category || 'Sans catégorie'}</span>
        <span class="admin-bank-meta-pill">${TYPE_LABELS[row.type] || row.type}</span>
        <span class="admin-bank-meta-pill admin-bank-meta-pill-muted">Par ${authorName}</span>
      </div>
      <div class="admin-bank-card-row">
        <div class="detail-section admin-bank-card-prompt">
          <label>Énoncé</label>
        </div>
        <div class="detail-section admin-bank-card-answer">
          <label>Réponse</label>
          <div class="admin-bank-answer-value">${describeAnswer(row.question)}</div>
        </div>
      </div>
      <div class="admin-bank-card-row">
        <div class="detail-section admin-bank-card-difficulty">
          <label>Difficulté</label>
        </div>
        <div class="detail-section admin-bank-card-timer">
          <label>Timer</label>
        </div>
      </div>
      ${imagesHtml ? `<div class="detail-section"><label>Images</label><div class="admin-bank-thumbs">${imagesHtml}</div></div>` : ''}
      <div class="admin-bank-card-row admin-bank-actions-row"></div>
    `

    // Énoncé (retour utilisateur : corriger une coquille avant d'approuver)
    // — "Réponse" juste à côté (voir describeAnswer plus haut) reste en
    // LECTURE SEULE à dessein : la corriger changerait le sens de la
    // question (voire la logique de scoring selon le type), pas juste une
    // coquille — un admin qui la trouve fausse doit Rejeter, pas la
    // retoucher à l'aveugle.
    const promptInput = document.createElement('textarea')
    promptInput.className = 'admin-bank-prompt-input'
    promptInput.rows = 2
    promptInput.value = row.question?.prompt || ''
    card.querySelector('.admin-bank-card-prompt').appendChild(promptInput)

    // Difficulté — vrai <select>, stylé globalement (voir règle `select`
    // dans style.css).
    const difficultySelect = document.createElement('select')
    difficultySelect.className = 'admin-bank-difficulty-select'
    ;['facile', 'moyen', 'difficile'].forEach(val => {
      const opt = document.createElement('option')
      opt.value = val
      opt.textContent = DIFFICULTY_LABELS[val]
      if (row.difficulty === val) opt.selected = true
      difficultySelect.appendChild(opt)
    })
    const questionSaveBtn = document.createElement('button')
    questionSaveBtn.type = 'button'
    questionSaveBtn.className = 'btn h-36 px-12 font-13'
    questionSaveBtn.textContent = 'Enregistrer'
    questionSaveBtn.onclick = () => saveQuestionEdits(row, promptInput.value, difficultySelect.value, questionSaveBtn)
    // Même ligne que le select (retour utilisateur : ce bloc paraissait
    // plus haut que le bloc Timer juste à côté, qui a lui son bouton sur la
    // même ligne que son champ — voir .admin-bank-timer-row) : même patron
    // ici pour que les deux blocs aient la même hauteur.
    const difficultyRow = document.createElement('div')
    difficultyRow.className = 'admin-bank-timer-row'
    difficultyRow.appendChild(difficultySelect)
    difficultyRow.appendChild(questionSaveBtn)
    card.querySelector('.admin-bank-card-difficulty').appendChild(difficultyRow)

    // Timer.
    const timerInput = document.createElement('input')
    timerInput.type = 'number'
    timerInput.min = '3'
    timerInput.max = '120'
    timerInput.className = 'admin-bank-timer-input'
    timerInput.value = String(Math.round((row.question?.timerMs || 15000) / 1000))
    const timerSaveBtn = document.createElement('button')
    timerSaveBtn.type = 'button'
    timerSaveBtn.className = 'btn h-36 px-12 font-13'
    timerSaveBtn.textContent = 'Enregistrer'
    timerSaveBtn.onclick = () => saveTimer(row, timerInput.value, timerSaveBtn)
    const timerRow = document.createElement('div')
    timerRow.className = 'admin-bank-timer-row'
    timerRow.appendChild(timerInput)
    timerRow.appendChild(document.createTextNode(' s'))
    timerRow.appendChild(timerSaveBtn)
    card.querySelector('.admin-bank-card-timer').appendChild(timerRow)

    // Actions — "Aperçu" (tâche 023) ouvre un nouvel onglet qui rejoue la
    // vraie question via le moteur de jeu (salle solo "Présenter"
    // auto-lancée, voir le bloc previewBankQuestionId dans index.js).
    const actionsRow = card.querySelector('.admin-bank-actions-row')
    const previewBtn = document.createElement('button')
    previewBtn.className = 'btn h-36 px-12 font-13'
    previewBtn.type = 'button'
    previewBtn.textContent = 'Aperçu'
    previewBtn.onclick = () => window.open('/?previewBankQuestion=' + row.id, '_blank')

    const approveBtn = document.createElement('button')
    approveBtn.className = 'btn btn-primary h-36 px-12 font-13'
    approveBtn.type = 'button'
    approveBtn.textContent = 'Approuver'
    approveBtn.onclick = () => moderateQuestion(row.id, 'approved', card, approveBtn)

    const rejectBtn = document.createElement('button')
    rejectBtn.className = 'btn btn-danger-outline h-36 px-12 font-13'
    rejectBtn.type = 'button'
    rejectBtn.textContent = 'Rejeter'
    rejectBtn.onclick = () => moderateQuestion(row.id, 'rejected', card, rejectBtn, true)

    actionsRow.appendChild(previewBtn)
    actionsRow.appendChild(approveBtn)
    actionsRow.appendChild(rejectBtn)
    pendingTableWrapEl.appendChild(card)
  })
}

const moderateQuestion = async (id, status, card, btn, needsConfirm = false) => {
  if (needsConfirm) {
    const ok = window.QzUI
      ? await window.QzUI.confirm({ title: 'Rejeter cette question ?', message: 'Elle restera en base mais ne sera jamais jouable.', confirmLabel: 'Rejeter', danger: true })
      : confirm('Rejeter cette question ?')
    if (!ok) return
  }
  btn.disabled = true
  try {
    const { error } = await sb.from('bank_questions').update({ status }).eq('id', id)
    if (error) throw error
    card.remove()
    if (!pendingTableWrapEl.children.length) {
      pendingEmptyEl.classList.remove('d-none')
      pendingTableWrapEl.classList.add('d-none')
    }
    showToast(status === 'approved' ? 'Question approuvée.' : 'Question rejetée.')
  } catch (err) {
    console.error('[admin-bank] modération impossible :', err)
    showToast('Erreur lors de la modération de la question', 'error')
    btn.disabled = false
  }
}

const loadPending = async () => {
  const { data, error } = await sb
    .from('bank_questions')
    .select('id,category,type,difficulty,question,created_by')
    .eq('status', 'pending')
    .order('created_at')
  if (error) {
    console.error('[admin-bank] chargement des questions en attente impossible :', error)
    showToast('Impossible de charger les questions en attente', 'error')
    return
  }
  const rows = data || []
  // Auteurs : requête séparée sur profiles par lot d'ids, même pattern que
  // loadPublic dans select.js — pas de FK bank_questions → profiles pour un
  // embed PostgREST direct.
  const authorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))]
  const authorsById = new Map()
  if (authorIds.length > 0) {
    const { data: authors } = await sb.from('profiles').select('id,username').in('id', authorIds)
    ;(authors || []).forEach(a => authorsById.set(a.id, a.username))
  }
  renderPending(rows, authorsById)
}

// --- Gestion des admins (super uniquement) -----------------------------
const renderAdminRow = (admin) => {
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td>${admin.email}</td>
    <td>${admin.role === 'super' ? 'Super admin' : 'Modérateur'}</td>
    <td>${admin.added_by || '—'}</td>
    <td></td>
  `
  const actionsTd = tr.lastElementChild
  const removeBtn = document.createElement('button')
  removeBtn.className = 'btn btn-danger-outline'
  removeBtn.type = 'button'
  removeBtn.textContent = 'Retirer'
  removeBtn.onclick = async () => {
    const ok = window.QzUI
      ? await window.QzUI.confirm({ title: 'Retirer cet admin ?', message: `${admin.email} perdra l'accès à cette page.`, confirmLabel: 'Retirer', danger: true })
      : confirm(`Retirer ${admin.email} des admins ?`)
    if (!ok) return
    removeBtn.disabled = true
    try {
      const { error } = await sb.from('bank_admins').delete().eq('email', admin.email)
      if (error) throw error
      tr.remove()
      showToast('Admin retiré.')
    } catch (err) {
      console.error('[admin-bank] suppression admin impossible :', err)
      showToast('Erreur lors du retrait de l\'admin', 'error')
      removeBtn.disabled = false
    }
  }
  actionsTd.appendChild(removeBtn)
  return tr
}

const loadAdmins = async () => {
  const { data, error } = await sb.from('bank_admins').select('email,role,added_by,created_at').order('created_at')
  if (error) {
    console.error('[admin-bank] chargement des admins impossible :', error)
    showToast('Impossible de charger la liste des admins', 'error')
    return
  }
  adminsTableBodyEl.innerHTML = ''
  ;(data || []).forEach(admin => adminsTableBodyEl.appendChild(renderAdminRow(admin)))
}

if (addAdminBtn) {
  addAdminBtn.onclick = async () => {
    const email = (newAdminEmailEl.value || '').trim().toLowerCase()
    const role = newAdminRoleEl.value
    if (!email || !email.includes('@')) { showToast('Entre un email valide', 'error'); return }
    const { data: { session } } = await sb.auth.getSession()
    addAdminBtn.disabled = true
    try {
      const { data, error } = await sb.from('bank_admins')
        .insert([{ email, role, added_by: session?.user?.email || null }])
        .select()
      if (error) throw error
      if (data && data[0]) adminsTableBodyEl.appendChild(renderAdminRow(data[0]))
      newAdminEmailEl.value = ''
      showToast('Admin ajouté.')
    } catch (err) {
      console.error('[admin-bank] ajout admin impossible :', err)
      showToast('Erreur lors de l\'ajout de l\'admin (email déjà présent ?)', 'error')
    } finally {
      addAdminBtn.disabled = false
    }
  }
}

// --- Gestion des catégories (super uniquement, tâche 024) --------------
// Même patron que "Gestion des admins" ci-dessus — liste FIXE désormais
// utilisée par le <select> catégorie de l'éditeur (voir editor.js
// loadCategoryOptions), plus de texte libre.
const renderCategoryRow = (cat) => {
  const tr = document.createElement('tr')
  tr.innerHTML = `
    <td>${cat.name}</td>
    <td>${cat.added_by || '—'}</td>
    <td></td>
  `
  const actionsTd = tr.lastElementChild
  const removeBtn = document.createElement('button')
  removeBtn.className = 'btn btn-danger-outline'
  removeBtn.type = 'button'
  removeBtn.textContent = 'Retirer'
  removeBtn.onclick = async () => {
    const ok = window.QzUI
      ? await window.QzUI.confirm({ title: 'Retirer cette catégorie ?', message: `"${cat.name}" ne sera plus proposée dans l'éditeur. Les questions déjà publiées avec cette catégorie ne changent pas.`, confirmLabel: 'Retirer', danger: true })
      : confirm(`Retirer la catégorie "${cat.name}" ?`)
    if (!ok) return
    removeBtn.disabled = true
    try {
      const { error } = await sb.from('bank_categories').delete().eq('name', cat.name)
      if (error) throw error
      tr.remove()
      showToast('Catégorie retirée.')
    } catch (err) {
      console.error('[admin-bank] suppression catégorie impossible :', err)
      showToast('Erreur lors du retrait de la catégorie', 'error')
      removeBtn.disabled = false
    }
  }
  actionsTd.appendChild(removeBtn)
  return tr
}

const loadCategories = async () => {
  const { data, error } = await sb.from('bank_categories').select('name,added_by,created_at').order('name')
  if (error) {
    console.error('[admin-bank] chargement des catégories impossible :', error)
    showToast('Impossible de charger la liste des catégories', 'error')
    return
  }
  categoriesTableBodyEl.innerHTML = ''
  ;(data || []).forEach(cat => categoriesTableBodyEl.appendChild(renderCategoryRow(cat)))
}

if (addCategoryBtn) {
  addCategoryBtn.onclick = async () => {
    const name = (newCategoryNameEl.value || '').trim()
    if (!name) { showToast('Entre un nom de catégorie', 'error'); return }
    const { data: { session } } = await sb.auth.getSession()
    addCategoryBtn.disabled = true
    try {
      const { data, error } = await sb.from('bank_categories')
        .insert([{ name, added_by: session?.user?.email || null }])
        .select()
      if (error) throw error
      if (data && data[0]) categoriesTableBodyEl.appendChild(renderCategoryRow(data[0]))
      newCategoryNameEl.value = ''
      showToast('Catégorie ajoutée.')
    } catch (err) {
      console.error('[admin-bank] ajout catégorie impossible :', err)
      showToast('Erreur lors de l\'ajout de la catégorie (déjà existante ?)', 'error')
    } finally {
      addCategoryBtn.disabled = false
    }
  }
}

// --- Garde d'accès -------------------------------------------------------
const showAccessDenied = (message) => {
  gateStateEl.innerHTML = `
    <div class="empty-state-icon">🔒</div>
    <h3>Accès refusé</h3>
    <p>${message}</p>`
}

const init = async () => {
  const { data: { session } } = await sb.auth.getSession()
  applyNavGuard(session)
  applyProfileChip(session)

  if (!session) {
    window.location.href = '/login.html'
    return
  }

  // Un compte non-admin ne peut lire AUCUNE ligne de bank_admins (la policy
  // de lecture exige déjà d'être admin pour voir quoi que ce soit dans cette
  // table, voir contexte de la tâche 022) : un résultat vide et sans erreur
  // signifie donc "pas admin" avec certitude, pas juste "profil manquant".
  const { data: adminRow, error } = await sb.from('bank_admins').select('role').eq('email', session.user.email).maybeSingle()
  if (error) {
    console.error('[admin-bank] vérification admin impossible :', error)
    showAccessDenied('Impossible de vérifier tes droits pour l\'instant — réessaie dans un instant.')
    return
  }
  if (!adminRow) {
    showAccessDenied('Cette page est réservée aux modérateurs de la banque de questions.')
    return
  }

  gateStateEl.classList.add('d-none')
  pendingSectionEl.classList.remove('d-none')
  loadPending()

  if (adminRow.role === 'super') {
    adminsSectionEl.classList.remove('d-none')
    loadAdmins()
    categoriesSectionEl.classList.remove('d-none')
    loadCategories()
  }
}

init()

// Logo animation trigger (même comportement que sur les autres pages)
const brand = document.querySelector('.brand')
if (brand) {
  brand.addEventListener('mouseenter', () => {
    brand.classList.remove('animate-logo')
    void brand.offsetWidth
    brand.classList.add('animate-logo')
  })
}
