const nameEl = document.getElementById('name')
const avatarEl = document.getElementById('avatar')
const avatarGridEl = document.getElementById('avatarGrid')
const saveBtn = document.getElementById('save')

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
let selectedAvatar = ''

const setSelectedAvatar = (url) => {
  selectedAvatar = url
  avatarEl.style.backgroundImage = url ? `url(${url})` : ''
  avatarEl.style.backgroundSize = 'cover'
  avatarEl.style.backgroundPosition = 'center'
  Array.from(avatarGridEl.children).forEach(tile => {
    tile.classList.toggle('selected', tile.dataset.avatar === url)
  })
}

const setupAvatarGrid = (currentUrl) => {
  avatarGridEl.innerHTML = ''
  AVATAR_CHOICES.forEach(url => {
    const tile = document.createElement('div')
    tile.className = 'icon-opt avatar-tile'
    tile.style.backgroundImage = `url(${url})`
    tile.dataset.avatar = url
    tile.onclick = () => setSelectedAvatar(url)
    avatarGridEl.appendChild(tile)
  })
  setSelectedAvatar(currentUrl || AVATAR_CHOICES[0])
}
const profileLink = document.getElementById('profile')
const toastsEl = document.getElementById('toasts')
const profilePopup = document.getElementById('profilePopup')

const showProfilePopup = () => {
  if (profilePopup) profilePopup.classList.remove('d-none')
}

const hideProfilePopup = () => {
  if (profilePopup) profilePopup.classList.add('d-none')
}

const logoutBtn = document.getElementById('logout')
const sb = window.supabaseClient

const showToast = (msg, type='info') => {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.padding = '12px 20px'
  t.style.borderRadius = '12px'
  t.style.boxShadow = 'var(--shadow-lg)'
  t.style.fontWeight = '600'
  t.style.fontSize = '14px'
  t.style.color = 'white'
  t.style.zIndex = '9999'
  
  if (type === 'error') {
    t.style.background = '#ef4444'
    t.style.border = '1px solid #dc2626'
  } else {
    t.style.background = 'var(--color-accent)'
    t.style.border = '1px solid #2563eb'
  }
  
  toastsEl.appendChild(t)
  setTimeout(() => { t.remove() }, 3000)
}

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
    let displayName = user.user_metadata.full_name || user.email.split('@')[0]
    let avatarUrl = null
    try {
      const { data: p } = await sb.from('profiles').select('username, avatar_url').eq('id', user.id).single()
      if (p?.username) displayName = p.username
      if (p?.avatar_url) avatarUrl = p.avatar_url
    } catch {}
    nameEl.value = displayName
    if (!avatarUrl) {
      const savedAvatar = localStorage.getItem('queazy_profile_avatar')
      if (savedAvatar) avatarUrl = savedAvatar
    }
    applyAvatar(profileAvatar, displayName, avatarUrl)
    if (profileNameEl) profileNameEl.textContent = firstNameOf(displayName)
    setupAvatarGrid(avatarUrl)
  } else if (isGuest) {
    const name = localStorage.getItem('queazy_profile_name') || 'Invité'
    nameEl.value = name
    const avatarUrl = localStorage.getItem('queazy_profile_avatar') || ''
    applyAvatar(profileAvatar, name, avatarUrl)
    if (profileNameEl) profileNameEl.textContent = firstNameOf(name)
    setupAvatarGrid(avatarUrl)
  }
}

const load = () => {
  const nm = localStorage.getItem('queazy_profile_name') || ''
  if (!nameEl.value) nameEl.value = nm
}

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    console.log("Déconnexion en cours...");
    try {
      if (sb) {
        await sb.auth.signOut()
      }
    } catch (err) {
      console.error("Erreur lors de la déconnexion Supabase:", err)
    }
    
    // Nettoyage local dans tous les cas
    localStorage.removeItem('queazy_guest')
    localStorage.removeItem('queazy_profile_name')
    localStorage.removeItem('queazy_profile_avatar')
    
    console.log("Redirection vers login.html");
    window.location.href = '/login.html'
  }
}

saveBtn.onclick = async () => {
  const nm = nameEl.value.trim().slice(0, 20)
  if (!nm) { showToast('Veuillez entrer un pseudo', 'error'); return }

  const { data: { session } } = await sb.auth.getSession()
  if (session) {
    try {
      const { error: metaErr } = await sb.auth.updateUser({ data: { full_name: nm } })
      if (metaErr) throw metaErr
      const { data: updData, error: updErr } = await sb.from('profiles').update({ username: nm, avatar_url: selectedAvatar }).eq('id', session.user.id).select()
      if (updErr) throw updErr
      if (!updData || updData.length === 0) {
        const { error: insErr } = await sb.from('profiles').insert({ id: session.user.id, username: nm, avatar_url: selectedAvatar })
        if (insErr) throw insErr
      }
    } catch (e) {
      showToast('Erreur lors de la sauvegarde : ' + (e.message || e), 'error')
      return
    }
  }

  localStorage.setItem('queazy_profile_name', nm)
  localStorage.setItem('queazy_profile_avatar', selectedAvatar)
  const profileAvatarEl = document.getElementById('profileAvatar')
  const profileNameLabelEl = document.getElementById('profileName')
  if (profileAvatarEl) {
    profileAvatarEl.textContent = ''
    profileAvatarEl.style.backgroundImage = `url(${selectedAvatar})`
    profileAvatarEl.style.backgroundSize = 'cover'
    profileAvatarEl.style.backgroundPosition = 'center'
  }
  if (profileNameLabelEl) profileNameLabelEl.textContent = nm.trim().split(/\s+/)[0] || 'Profil'
  showToast('Profil sauvegardé')
  hideProfilePopup()
}

const savedAvatarPreview = localStorage.getItem('queazy_profile_avatar')
const profileAvatarPreviewEl = document.getElementById('profileAvatar')
if (savedAvatarPreview && profileAvatarPreviewEl) {
  profileAvatarPreviewEl.style.backgroundImage = 'url(' + savedAvatarPreview + ')'
  profileAvatarPreviewEl.style.backgroundSize = 'cover'
  profileAvatarPreviewEl.style.backgroundPosition = 'center'
}

checkAuth()
load()
showProfilePopup() // Show popup on page load

// Logo animation trigger
const brand = document.querySelector('.brand')
if (brand) {
  brand.addEventListener('mouseenter', () => {
    brand.classList.remove('animate-logo')
    void brand.offsetWidth // Trigger reflow
    brand.classList.add('animate-logo')
  })
}
