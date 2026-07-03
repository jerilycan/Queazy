const list = document.getElementById('list')
const profileLink = document.getElementById('profile')
const sb = window.supabaseClient

const checkAuth = async () => {
  const isGuest = localStorage.getItem('queazy_guest') === 'true'
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

  if (!session && !isGuest) {
    if (navLogin) navLogin.classList.remove('d-none')
    if (profileLink) profileLink.classList.add('d-none')
    window.location.href = '/login.html'
    return
  }

  if (navLogin) navLogin.classList.add('d-none')
  if (profileLink) profileLink.classList.remove('d-none')

  if (session) {
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
  } else if (isGuest) {
    // Si invité
    const name = localStorage.getItem('queazy_profile_name') || 'Invité'
    const avatarUrl = localStorage.getItem('queazy_profile_avatar') || ''
    applyAvatar(profileAvatar, name, avatarUrl)
    if (profileNameEl) profileNameEl.textContent = firstNameOf(name)
  }
}

checkAuth()

const savedAvatarPreview = localStorage.getItem('queazy_profile_avatar')
const profileAvatarPreviewEl = document.getElementById('profileAvatar')
if (savedAvatarPreview && profileAvatarPreviewEl) {
  profileAvatarPreviewEl.style.backgroundImage = 'url(' + savedAvatarPreview + ')'
  profileAvatarPreviewEl.style.backgroundSize = 'cover'
  profileAvatarPreviewEl.style.backgroundPosition = 'center'
}

const render = (arr, isMineTab = true) => {
  list.innerHTML = ''
  if (!arr || arr.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${isMineTab ? '📝' : '🌍'}</div>
        <h3>${isMineTab ? "Aucun quiz pour l'instant" : "Aucun quiz public pour l'instant"}</h3>
        <p>${isMineTab ? 'Crée ton premier quiz pour commencer à jouer avec tes amis.' : 'Reviens plus tard, la communauté ajoute du contenu régulièrement.'}</p>
        ${isMineTab ? '<a href="/editor.html" class="btn btn-primary">+ Créer mon premier quiz</a>' : ''}
      </div>`
    return
  }
  arr.forEach(q => {
    const questionCount = Array.isArray(q.questions) ? q.questions.length : (q.count || 0)
    const card = document.createElement('div')
    card.className = 'card quiz-card'
    card.style.cursor = 'pointer'
    card.style.display = 'flex'
    card.style.flexDirection = 'column'
    card.style.gap = '8px'
    card.style.transition = 'all 0.2s ease'
    
    // Redirection vers l'éditeur au clic sur la carte
    card.onclick = () => {
      window.location.href = '/editor.html?id=' + encodeURIComponent(q.id)
    }
    
    const title = document.createElement('div')
    title.style.fontWeight = '700'
    title.style.fontSize = '18px'
    title.textContent = q.title
    
    const meta = document.createElement('div')
    meta.style.fontSize = '14px'
    meta.style.color = 'var(--color-text-muted)'
    meta.textContent = questionCount + ' questions'
    
    card.appendChild(title)
    card.appendChild(meta)
    list.appendChild(card)
  })
}

const loadMine = async () => {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3>Connecte-toi pour voir tes quiz</h3>
        <p>Tes quiz créés apparaîtront ici une fois connecté.</p>
        <a href="/login.html" class="btn btn-primary">Se connecter</a>
      </div>`
    return
  }
  const { data, error } = await sb
    .from('quizzes')
    .select('id,title,questions,updated_at')
    .eq('owner_id', session.user.id)
    .order('updated_at', { ascending: false })
  render(data || [], true)
}

const loadPublic = async () => {
  const { data, error } = await sb
    .from('quizzes')
    .select('id,title,questions,updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
  render(data || [], false)
}

const newQuizBtn = document.getElementById('newQuizBtn')
if (newQuizBtn) {
  newQuizBtn.onclick = async (e) => {
    e.preventDefault()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      window.location.href = '/login.html?reason=create'
      return
    }
    window.location.href = '/editor.html'
  }
}

const tabMine = document.getElementById('tabMine')
const tabPublic = document.getElementById('tabPublic')

const activate = (mine) => {
  if (tabMine && tabPublic) {
    tabMine.classList.toggle('btn-primary', mine)
    tabPublic.classList.toggle('btn-primary', !mine)
  }
}

if (tabMine) tabMine.onclick = async () => { activate(true); await loadMine() }
if (tabPublic) tabPublic.onclick = async () => { activate(false); await loadPublic() }

;(async () => { activate(true); await loadMine().catch(loadPublic) })()

// Logo animation trigger
const brand = document.querySelector('.brand')
if (brand) {
  brand.addEventListener('mouseenter', () => {
    brand.classList.remove('animate-logo')
    void brand.offsetWidth // Trigger reflow
    brand.classList.add('animate-logo')
  })
}
