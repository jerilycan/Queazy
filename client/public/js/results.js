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

let history = []
let historyReceived = false
let latestPlayers = null
let raceStarted = false

// ---------------------------------------------------------------------
// Podium final "course arcade néon" : chaque barre grimpe question par
// question au rythme des points RÉELLEMENT gagnés à chaque tour (voir
// historyEntry.deltas côté serveur), au lieu d'une simple apparition
// statique — une bonne réponse fait bondir la barre, une mauvaise la
// laisse plate, un enchaînement de bonnes réponses affiche un badge 🔥.
// Prototype comparé et validé avant implémentation (voir historique de
// conversation) : montée classique / révélation cinématique / arcade néon,
// puis affinage "course" sur cette dernière piste à la demande de l'utilisateur.
// ---------------------------------------------------------------------
const RACE_LANE_BOTTOM = 40 // doit rester synchro avec `bottom: 40px` dans .race-lane-* (style.css)
const RACE_TOTAL_MS = 3000 // durée cible totale, quel que soit le nombre de questions
const RACE_MIN_STEP_MS = 220 // plancher pour rester lisible si beaucoup de questions
const RACE_STREAK_THRESHOLD = 3

const applyLaneAvatar = (el, p) => {
  if (!el) return
  const isImg = isAvatarUrl(p?.avatar)
  el.style.backgroundImage = isImg ? `url(${p.avatar})` : ''
  el.textContent = isImg ? '' : (p?.avatar || (p ? p.name.slice(0, 2).toUpperCase() : ''))
}

const runRace = (top) => {
  const stage = document.getElementById('raceStage')
  const lanesEl = document.getElementById('raceLanes')
  const qStrip = document.getElementById('raceQstrip')
  const statusPill = document.getElementById('raceStatusPill')
  const finishFlash = document.getElementById('raceFinishFlash')
  const bigFlash = document.getElementById('raceBigflash')
  if (!stage || !lanesEl || top.length === 0) return

  // Ordre classique d'un podium (2e - 1er - 3e), la position ne change plus
  // ensuite : seule la hauteur de chaque barre évolue pendant la course.
  const lanesOrder = top.length === 3 ? [top[1], top[0], top[2]] : top

  lanesEl.innerHTML = lanesOrder.map(p => `
    <div class="race-lane" data-key="${p.id}" data-player-id="${p.id}">
      <div class="race-lane-track"></div>
      <div class="race-lane-bar" data-bar></div>
      <div class="race-lane-crown" data-crown>👑</div>
      <div class="race-lane-badge" data-badge></div>
      <div class="race-lane-streak" data-streak></div>
      <div class="race-lane-score" data-score>0 pts</div>
      <div class="race-lane-avatar" data-avatar></div>
      <div class="race-lane-name" data-name>${p.name}</div>
    </div>
  `).join('')

  const refs = {}
  lanesOrder.forEach(p => {
    const lane = lanesEl.querySelector(`.race-lane[data-key="${p.id}"]`)
    refs[p.id] = {
      lane,
      track: lane.querySelector('.race-lane-track'),
      bar: lane.querySelector('[data-bar]'),
      score: lane.querySelector('[data-score]'),
      crown: lane.querySelector('[data-crown]'),
      badge: lane.querySelector('[data-badge]'),
      streak: lane.querySelector('[data-streak]'),
      avatar: lane.querySelector('[data-avatar]'),
      name: lane.querySelector('[data-name]'),
    }
    applyLaneAvatar(refs[p.id].avatar, p)
  })

  const trackHeight = refs[lanesOrder[0].id].track.getBoundingClientRect().height || 280
  const maxScale = Math.max(1, ...top.map(p => p.score)) * 1.08

  const setLanePosition = (id, heightPx) => {
    const r = refs[id]
    r.bar.style.height = heightPx + 'px'
    const bottom = (RACE_LANE_BOTTOM + heightPx) + 'px'
    r.avatar.style.bottom = bottom
    r.score.style.bottom = bottom
    r.crown.style.bottom = bottom
    r.badge.style.bottom = bottom
    r.streak.style.bottom = bottom
  }

  const spawnFloatPop = (id, text, heightPx) => {
    const r = refs[id]
    const el = document.createElement('div')
    el.className = 'race-float-pop'
    el.textContent = text
    el.style.bottom = (RACE_LANE_BOTTOM + heightPx + 40) + 'px'
    r.lane.appendChild(el)
    setTimeout(() => el.remove(), 850)
  }

  const finishRace = () => {
    statusPill.className = 'race-status-pill done'
    statusPill.textContent = '🏁 Arrivée !'
    finishFlash.classList.add('go')
    qStrip.querySelectorAll('.race-qdot').forEach(d => { d.classList.remove('active'); d.classList.add('done') })

    const ranked = [...top] // déjà trié par score décroissant
    const rankClass = ['rank-1', 'rank-2', 'rank-3']
    const rankColor = ['gold', 'silver', 'bronze']
    const rankBadge = ['🥇', '🥈', '🥉']

    setTimeout(() => {
      ranked.forEach((p, i) => {
        const r = refs[p.id]
        r.lane.classList.add(rankClass[i])
        r.bar.classList.add(rankColor[i])
        r.badge.textContent = rankBadge[i]
        r.badge.classList.add('show')
      })
      const winner = refs[ranked[0].id]
      winner.crown.classList.add('show')
      winner.name.classList.add('glitch')
      bigFlash.classList.add('go')
      stage.classList.add('shake')
      if (window.confetti) window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.55 } })
      try { fanfareSound.currentTime = 0; fanfareSound.play().catch(() => {}) } catch {}
      setTimeout(() => stage.classList.remove('shake'), 450)
    }, 300)
  }

  // Historique vide (aucune question jouée) : pas de course à rejouer, on
  // saute directement les barres à leur hauteur finale puis l'arrivée.
  if (history.length === 0) {
    qStrip.innerHTML = ''
    statusPill.className = 'race-status-pill live'
    statusPill.innerHTML = '<span class="dot"></span>Podium'
    top.forEach(p => {
      const h = Math.min(trackHeight, (p.score / maxScale) * trackHeight)
      setLanePosition(p.id, h)
      refs[p.id].score.textContent = `${p.score} pts`
    })
    setTimeout(finishRace, 400)
    return
  }

  qStrip.innerHTML = history.map((_, i) => `<div class="race-qdot" data-q="${i}">${i + 1}</div>`).join('')
  statusPill.className = 'race-status-pill live'

  const running = {}; top.forEach(p => { running[p.id] = 0 })
  const streaks = {}; top.forEach(p => { streaks[p.id] = 0 })
  const stepMs = Math.max(RACE_MIN_STEP_MS, RACE_TOTAL_MS / history.length)

  const applyQuestion = (i) => {
    const h = history[i]
    statusPill.innerHTML = `<span class="dot"></span>Question ${i + 1} / ${history.length}`
    qStrip.querySelectorAll('.race-qdot').forEach((d, di) => {
      d.classList.toggle('active', di === i)
      d.classList.toggle('done', di < i)
    })
    top.forEach(p => {
      const delta = Number(h.deltas?.[p.id]) || 0
      const r = refs[p.id]
      if (delta > 0) {
        streaks[p.id] += 1
        running[p.id] += delta
        const heightPx = Math.min(trackHeight, (running[p.id] / maxScale) * trackHeight)
        setLanePosition(p.id, heightPx)
        r.score.textContent = Math.round(running[p.id]).toLocaleString('fr-FR') + ' pts'
        r.avatar.classList.remove('hop'); void r.avatar.offsetWidth; r.avatar.classList.add('hop')
        spawnFloatPop(p.id, '+' + delta, heightPx)
        if (streaks[p.id] >= RACE_STREAK_THRESHOLD) {
          r.streak.textContent = '🔥×' + streaks[p.id]
          r.streak.classList.add('show')
        } else {
          r.streak.classList.remove('show')
        }
      } else {
        streaks[p.id] = 0
        r.streak.classList.remove('show')
        r.avatar.classList.remove('miss'); void r.avatar.offsetWidth; r.avatar.classList.add('miss')
      }
    })
  }

  let qIndex = 0
  applyQuestion(0)
  const raceTimer = setInterval(() => {
    qIndex += 1
    if (qIndex >= history.length) {
      clearInterval(raceTimer)
      setTimeout(finishRace, 300)
      return
    }
    applyQuestion(qIndex)
  }, stepMs)
}

const tryStartRace = () => {
  if (raceStarted || !historyReceived || !latestPlayers) return
  const ordered = computeOrder(latestPlayers.slice())
  const top = ordered.slice(0, 3)
  if (top.length === 0) return
  raceStarted = true
  runRace(top)
}

const render = (players) => {
  const ordered = computeOrder(players.slice())
  latestPlayers = players
  tryStartRace()
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
      // Même effet "dépassement" que le classement en cours de partie
      // (index.js renderBoard()) : halo doré tant que la ligne grimpe.
      row.classList.add(dy > 0 ? 'rank-up' : 'rank-down')
      row.style.zIndex = '5'
      requestAnimationFrame(() => {
        row.style.transition = ''
        row.style.transform = ''
      })
      row.addEventListener('transitionend', function onEnd (e) {
        if (e.propertyName !== 'transform') return
        row.removeEventListener('transitionend', onEnd)
        row.classList.remove('rank-up', 'rank-down')
        row.style.zIndex = ''
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
  historyReceived = true
  tryStartRace()
})

socket.on('lobby:list', (list) => {
  const players = (list || []).filter(p => !p.isHost).map(p => ({ id: p.id, name: p.name, score: p.score || 0, avatar: p.avatar || '' }))
  render(players)
})

socket.on('score:update', ({ playerId, delta, total }) => {
  // Optionnel: attendre une prochaine lobby:list si nécessaire
})

