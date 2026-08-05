const params = new URLSearchParams(window.location.search)
const roomCode = params.get('room') || ''
const socket = io()

const fanfareSound = new Audio('/audio/fanfare.wav')

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
let history = []

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
      if (p?.id) avatarEl.dataset.playerId = p.id
      else delete avatarEl.dataset.playerId
    }
  }
  fill(byStep(1), top[0])
  fill(byStep(2), top[1])
  fill(byStep(3), top[2])

  if (!revealed) {
    revealed = true
    const step3 = byStep(3), step2 = byStep(2), step1 = byStep(1)
    // Une place sans joueur (partie à 1-2 participants) ne doit pas apparaître
    // du tout — pas de podium vide avec un "—" à la 3e place.
    const reveal = (step, hasPlayer, delay) => {
      if (!step) return
      if (hasPlayer) {
        step.style.display = ''
        setTimeout(() => step.classList.remove('hidden'), delay)
      } else {
        step.style.display = 'none'
      }
    }
    reveal(step3, !!top[2], 500)
    reveal(step2, !!top[1], 1700)
    setTimeout(() => {
      reveal(step1, !!top[0], 0)
      if (top[0] && window.confetti) window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } })
      if (top[0]) { try { fanfareSound.currentTime = 0; fanfareSound.play().catch(() => {}) } catch {} }
    }, 2900)
  }

  renderFullTable(ordered)
}

// Réutilise les mêmes lignes DOM d'un rendu à l'autre (au lieu de tout
// reconstruire) pour pouvoir animer leur déplacement — technique FLIP
// identique à renderBoard() dans index.js (classement en cours de partie).
const fullTableRows = new Map() // playerId -> élément ligne

const renderFullTable = (ordered) => {
  const tbl = document.getElementById('fullTable')
  if (!tbl) return

  const first = new Map()
  fullTableRows.forEach((row, id) => { first.set(id, row.getBoundingClientRect()) })

  const currentIds = new Set(ordered.map(p => p.id))
  fullTableRows.forEach((row, id) => {
    if (!currentIds.has(id)) { row.remove(); fullTableRows.delete(id) }
  })

  ordered.forEach((p, i) => {
    let row = fullTableRows.get(p.id)
    if (!row) {
      row = document.createElement('div')
      row.className = 'result-row'
      row.innerHTML = `<span class="result-row-rank"></span><span class="result-row-score"></span>`
      fullTableRows.set(p.id, row)
    }
    if (p.id) row.dataset.playerId = p.id
    row.querySelector('.result-row-rank').textContent = `${i + 1}. ${p.name}`
    row.querySelector('.result-row-score').textContent = `${p.score} pts`
    tbl.appendChild(row) // déplace le nœud existant : préserve son identité pour le FLIP
  })

  ordered.forEach(p => {
    const row = fullTableRows.get(p.id)
    if (!row) return
    const before = first.get(p.id)
    if (!before) return // ligne neuve : pas d'état "avant" à animer depuis
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

const historyTooltip = document.createElement('div')
historyTooltip.id = 'historyTooltip'
historyTooltip.className = 'history-tooltip d-none'
document.body.appendChild(historyTooltip)

const showHistoryTooltip = (playerId, x, y) => {
  if (!playerId || history.length === 0) { historyTooltip.classList.add('d-none'); return }
  const rows = history.map(h => {
    const status = h.results ? h.results[playerId] : undefined
    const icon = status === 'correct' ? '✓' : status === 'incorrect' ? '✗' : '–'
    const cls = status === 'correct' ? 'icon-correct' : status === 'incorrect' ? 'icon-incorrect' : 'icon-absent'
    return `<div class="history-tooltip-row"><span>${h.prompt || ''}</span><span class="${cls}">${icon}</span></div>`
  }).join('')
  historyTooltip.innerHTML = rows
  historyTooltip.style.left = `${x + 12}px`
  historyTooltip.style.top = `${y + 12}px`
  historyTooltip.classList.remove('d-none')
}

const hideHistoryTooltip = () => { historyTooltip.classList.add('d-none') }

;[document.getElementById('resultsPodium'), document.getElementById('fullTable')].forEach(container => {
  if (!container) return
  container.addEventListener('mousemove', e => {
    const target = e.target.closest('[data-player-id]')
    if (target) showHistoryTooltip(target.dataset.playerId, e.clientX, e.clientY)
    else hideHistoryTooltip()
  })
  container.addEventListener('mouseleave', hideHistoryTooltip)
})

socket.on('connect', () => {
  const name = localStorage.getItem('queazy_profile_name') || 'Spectateur'
  const avatar = localStorage.getItem('queazy_profile_avatar') || '🙂'
  socket.emit('room:join', { roomCode, playerName: name, token: getToken(), avatar })
})

socket.on('history:sync', (payload) => {
  history = payload?.history || []
})

socket.on('lobby:list', (list) => {
  const players = (list || []).filter(p => !p.isHost).map(p => ({ id: p.id, name: p.name, score: p.score || 0, avatar: p.avatar || '' }))
  render(players)
})

socket.on('score:update', ({ playerId, delta, total }) => {
  // Optionnel: attendre une prochaine lobby:list si nécessaire
})

