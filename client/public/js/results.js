const params = new URLSearchParams(window.location.search)
const roomCode = params.get('room') || ''
const socket = io()

const backBtn = document.getElementById('backHome')
if (backBtn) backBtn.onclick = () => { window.location.href = '/' }

const checkAuth = async () => {
  const isGuest = localStorage.getItem('queazy_guest') === 'true'
  const sb = window.supabaseClient
  const { data: { session } } = await sb.auth.getSession()

  const navLogin = document.getElementById('navLogin')
  const profileLink = document.getElementById('profile')
  const profileAvatar = document.getElementById('profileAvatar')
  const profileNameEl = document.getElementById('profileName')

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
    const name = localStorage.getItem('queazy_profile_name') || 'Invité'
    const avatarUrl = localStorage.getItem('queazy_profile_avatar') || ''
    applyAvatar(profileAvatar, name, avatarUrl)
    if (profileNameEl) profileNameEl.textContent = firstNameOf(name)
  }
}

checkAuth()

const genToken = () => Math.random().toString(36).slice(2, 10)
const getToken = () => {
  let t = localStorage.getItem('queazy_token')
  if (!t) { t = genToken(); localStorage.setItem('queazy_token', t) }
  return t
}

const computeOrder = (entries) => entries.sort((a, b) => (b.score - a.score))
const isAvatarUrl = (s) => typeof s === 'string' && /^(data:|https?:|blob:|\/)/.test(s)

let revealed = false

const render = (players) => {
  const ordered = computeOrder(players.slice())
  const top = ordered.slice(0, 3)
  const byStep = (n) => document.querySelector(`.podium-step.step-${n}`)
  const fill = (el, p) => {
    if (!el) return
    el.querySelector('.podium-name').textContent = p ? p.name : '—'
    el.querySelector('.podium-score').textContent = p ? `${p.score} pts` : ''
    const avatarEl = el.querySelector('.podium-avatar')
    if (avatarEl) {
      const isImg = isAvatarUrl(p?.avatar)
      avatarEl.style.backgroundImage = isImg ? `url(${p.avatar})` : ''
      avatarEl.textContent = isImg ? '' : (p?.avatar || (p ? p.name.slice(0, 2).toUpperCase() : ''))
    }
  }
  fill(byStep(1), top[0])
  fill(byStep(2), top[1])
  fill(byStep(3), top[2])

  if (!revealed) {
    revealed = true
    const step3 = byStep(3), step2 = byStep(2), step1 = byStep(1)
    // Les places sans joueur (parties à 1-2 participants) apparaissent tout de
    // suite, sans animation : pas de rebond "dramatique" sur une case vide.
    const reveal = (step, hasPlayer, delay) => {
      if (!step) return
      if (hasPlayer) setTimeout(() => step.classList.remove('hidden'), delay)
      else step.classList.remove('hidden')
    }
    reveal(step3, !!top[2], 500)
    reveal(step2, !!top[1], 1700)
    setTimeout(() => {
      reveal(step1, !!top[0], 0)
      if (top[0] && window.confetti) window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } })
    }, 2900)
  }

  const tbl = document.getElementById('fullTable')
  if (tbl) {
    tbl.innerHTML = ''
    ordered.forEach((p, i) => {
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.justifyContent = 'space-between'
      row.style.padding = '12px 0'
      row.style.borderBottom = '1px solid var(--color-border)'
      row.innerHTML = `
        <span style="font-weight:600">${i + 1}. ${p.name}</span>
        <span style="color:var(--color-accent); font-weight:700">${p.score} pts</span>
      `
      tbl.appendChild(row)
    })
  }
}

socket.on('connect', () => {
  const name = localStorage.getItem('queazy_profile_name') || 'Spectateur'
  const avatar = localStorage.getItem('queazy_profile_avatar') || '🙂'
  socket.emit('room:join', { roomCode, playerName: name, token: getToken(), avatar })
})

socket.on('lobby:list', (list) => {
  const players = (list || []).filter(p => !p.isHost).map(p => ({ name: p.name, score: p.score || 0, avatar: p.avatar || '' }))
  render(players)
})

socket.on('score:update', ({ playerId, delta, total }) => {
  // Optionnel: attendre une prochaine lobby:list si nécessaire
})

