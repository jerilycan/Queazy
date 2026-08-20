const params = new URLSearchParams(window.location.search)
const roomCode = params.get('room') || ''
const socket = io()

// Bandeau persistant de statut de connexion — voir le même mécanisme dans
// index.js (commentaire détaillé là-bas). Ici la salle est déjà "ended" côté
// serveur, donc pas d'événement host:disconnected/host:reconnected à gérer :
// seule notre propre coupure réseau est concernée.
const connBanner = document.createElement('div')
connBanner.className = 'conn-status-banner d-none'
document.body.appendChild(connBanner)
const setConnBanner = (msg, severe = false) => {
  connBanner.textContent = msg
  connBanner.classList.toggle('is-severe', severe)
  connBanner.classList.remove('d-none')
}
const clearConnBanner = () => connBanner.classList.add('d-none')

// Même correctif que index.js : ignorer le 'disconnect' déclenché par un
// départ volontaire de la page (clic sur un lien), sinon le bandeau
// flashait une fraction de seconde à chaque changement de page.
let isNavigatingAway = false
window.addEventListener('beforeunload', () => { isNavigatingAway = true })
window.addEventListener('pagehide', () => { isNavigatingAway = true })

socket.on('disconnect', () => {
  if (isNavigatingAway) return
  setConnBanner('Connexion perdue — reconnexion en cours…')
})
socket.on('connect', () => clearConnBanner())

const fanfareSound = new Audio('/audio/fanfare.wav')

const backBtn = document.getElementById('backHome')
if (backBtn) backBtn.onclick = () => { window.location.href = '/' }

// N'apparaît que côté hôte : ?quiz= n'est ajouté à l'URL que par l'hôte
// (voir index.js quiz:end, seul à connaître loadedQuiz.id) — un joueur qui
// arrive ici n'a jamais ce paramètre, donc jamais ce bouton. Retour
// utilisateur : aucun moyen de relancer la même partie une fois sur les
// résultats, seulement "Retour à l'accueil" puis re-sélectionner le quiz.
const replayQuizId = params.get('quiz')
const replayBtn = document.getElementById('replayQuiz')
if (replayBtn && replayQuizId) {
  replayBtn.classList.remove('d-none')
  replayBtn.onclick = () => { window.location.href = `/?quiz=${encodeURIComponent(replayQuizId)}` }
}

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

// Mode équipe : le podium regroupe alors par équipe (score cumulé des
// membres) au lieu d'un joueur par piste — voir computeTeamEntities/
// computeTeamHistory plus bas. La liste complète sous le podium, elle,
// reste TOUJOURS par joueur individuel (voir renderFullTable) : c'est là
// que le détail par personne demandé reste consultable.
let teamModeActive = false
let teamsById = {}
const TEAM_EMOJI = { red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢', cyan: '🩵', purple: '🟣' }

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

const runRace = (top, raceHistory) => {
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
  if (raceHistory.length === 0) {
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

  qStrip.innerHTML = raceHistory.map((_, i) => `<div class="race-qdot" data-q="${i}">${i + 1}</div>`).join('')
  statusPill.className = 'race-status-pill live'

  const running = {}; top.forEach(p => { running[p.id] = 0 })
  const streaks = {}; top.forEach(p => { streaks[p.id] = 0 })
  const stepMs = Math.max(RACE_MIN_STEP_MS, RACE_TOTAL_MS / raceHistory.length)

  const applyQuestion = (i) => {
    const h = raceHistory[i]
    statusPill.innerHTML = `<span class="dot"></span>Question ${i + 1} / ${raceHistory.length}`
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
    if (qIndex >= raceHistory.length) {
      clearInterval(raceTimer)
      setTimeout(finishRace, 300)
      return
    }
    applyQuestion(qIndex)
  }, stepMs)
}

// Une "entité" équipe pour la course : mêmes champs qu'un joueur
// (id/name/avatar/score) pour que runRace() n'ait besoin d'aucune branche
// spécifique — seul un id d'équipe à la place d'un id de joueur, et un
// historique reconstruit en conséquence (voir computeTeamHistory).
const computeTeamEntities = () => {
  const totals = {}
  ;(latestPlayers || []).forEach(p => {
    if (!p.teamId) return
    totals[p.teamId] = (totals[p.teamId] || 0) + (p.score || 0)
  })
  return Object.entries(totals)
    .map(([teamId, score]) => ({
      id: teamId,
      name: teamsById[teamId]?.name || teamId,
      avatar: TEAM_EMOJI[teamsById[teamId]?.color] || '👥',
      score
    }))
    .sort((a, b) => b.score - a.score)
}

// Reconstruit un historique "par équipe" à partir de l'historique par joueur
// (history[].deltas est indexé par id de JOUEUR côté serveur) : chaque
// entrée somme les deltas de tous les membres d'une même équipe pour cette
// question-là.
const computeTeamHistory = () => {
  const teamByPlayer = {}
  ;(latestPlayers || []).forEach(p => { if (p.teamId) teamByPlayer[p.id] = p.teamId })
  return history.map(h => {
    const deltas = {}
    for (const [playerId, delta] of Object.entries(h.deltas || {})) {
      const teamId = teamByPlayer[playerId]
      if (!teamId) continue
      deltas[teamId] = (deltas[teamId] || 0) + (Number(delta) || 0)
    }
    return { ...h, deltas }
  })
}

const tryStartRace = () => {
  if (raceStarted || !historyReceived || !latestPlayers) return
  if (teamModeActive) {
    const topTeams = computeTeamEntities().slice(0, 3)
    if (topTeams.length === 0) return
    raceStarted = true
    runRace(topTeams, computeTeamHistory())
    return
  }
  const ordered = computeOrder(latestPlayers.slice())
  const top = ordered.slice(0, 3)
  if (top.length === 0) return
  raceStarted = true
  runRace(top, history)
}

// Une fois la course lancée (raceStarted), les pistes du podium gardent
// l'id de joueur figé au moment du lancement (voir runRace, data-player-id
// posé une seule fois). Si CE joueur se reconnecte ensuite (nouveau
// socket.id — page rechargée, réseau coupé...), la piste continue de
// porter l'ancien id, qui ne correspond plus à rien dans l'historique
// (history:sync republie tout sous les ids COURANTS à chaque reconnexion,
// voir server/index.js buildHistorySync) : le survol de sa piste
// n'affichait donc plus jamais le bon récap par question — contrairement à
// la liste complète en dessous, reconstruite avec les ids courants à
// CHAQUE lobby:list (voir renderFullTable), donc toujours correcte. On
// retrouve la piste concernée par NOM (seul repère qui survit à une
// reconnexion côté client : le serveur ne diffuse jamais les tokens) et on
// rafraîchit son id.
const resyncRaceLaneIds = (players) => {
  if (!raceStarted) return
  const lanesEl = document.getElementById('raceLanes')
  if (!lanesEl) return
  const currentIdByName = new Map()
  players.forEach(p => { if (p.name) currentIdByName.set(p.name, p.id) })
  lanesEl.querySelectorAll('.race-lane').forEach(lane => {
    const nameEl = lane.querySelector('[data-name]')
    const freshId = nameEl ? currentIdByName.get(nameEl.textContent) : null
    if (freshId && freshId !== lane.dataset.playerId) {
      lane.dataset.playerId = freshId
    }
  })
}

const render = (players) => {
  // Le podium (top) veut le tri par équipe s'il est actif ; la liste
  // complète en dessous, elle, reste TOUJOURS un classement individuel par
  // joueur — voir renderFullTable, jamais agrégée par équipe.
  const ordered = computeOrder(players.slice())
  latestPlayers = players
  tryStartRace()
  resyncRaceLaneIds(players)
  renderFullTable(ordered)
  renderDetailTab(ordered)
  renderDetailTable(ordered)
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
      row.innerHTML = `<span class="result-row-rank"></span><span class="result-row-team"></span><span class="result-row-score"></span>`
      fullTableRows.set(p.id, row)
    }
    if (p.id) row.dataset.playerId = p.id
    row.querySelector('.result-row-rank').textContent = `${i + 1}. ${p.name}`
    // Le podium ne montre que les équipes en mode équipe (voir tryStartRace)
    // — cette ligne-ci reste TOUJOURS individuelle, avec juste un badge pour
    // situer le joueur dans son équipe (score cumulé visible sur le podium
    // au-dessus, score personnel ici).
    const teamEl = row.querySelector('.result-row-team')
    const team = p.teamId ? teamsById[p.teamId] : null
    if (team) {
      teamEl.textContent = team.name
      teamEl.className = `result-row-team team-badge team-${team.color}`
      teamEl.classList.remove('d-none')
    } else {
      teamEl.className = 'result-row-team d-none'
    }
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

// --- Onglet "Détail" : ce que chaque joueur a répondu à chaque question ---
// Retour utilisateur : la seule vue disponible jusqu'ici (survol d'une piste
// du podium / d'une ligne du classement) ne montrait qu'un ✓/✗ par question,
// dans un tooltip fugace au survol — impossible de voir CE QUI a été
// répondu, ni combien de points ça a rapporté. Une carte par joueur
// (repliée par défaut, dépliable au clic) plutôt qu'un tableau matriciel
// joueurs×questions : reste lisible sur mobile sans le moindre scroll
// horizontal, contrairement à une grille qui grandirait avec le nombre de
// questions ET de joueurs à la fois.
const escDetail = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

const detailPlayerCards = new Map() // playerId -> élément carte (réutilisé pour garder l'état ouvert/fermé entre deux rendus)

const renderDetailTab = (ordered) => {
  const list = document.getElementById('detailList')
  if (!list) return

  const currentIds = new Set(ordered.map(p => p.id))
  detailPlayerCards.forEach((card, id) => {
    if (!currentIds.has(id)) { card.remove(); detailPlayerCards.delete(id) }
  })

  ordered.forEach((p, i) => {
    let card = detailPlayerCards.get(p.id)
    if (!card) {
      card = document.createElement('div')
      card.className = 'detail-player'
      const header = document.createElement('div')
      header.className = 'detail-player-header'
      header.onclick = () => card.classList.toggle('is-open')
      header.innerHTML = `
        <span class="detail-player-rank"></span>
        <span class="detail-player-score"></span>
        <span class="detail-player-toggle">▾</span>
      `
      const body = document.createElement('div')
      body.className = 'detail-player-body'
      card.appendChild(header)
      card.appendChild(body)
      detailPlayerCards.set(p.id, card)
    }
    card.querySelector('.detail-player-rank').textContent = `${i + 1}. ${p.name}`
    card.querySelector('.detail-player-score').textContent = `${p.score} pts`

    // Le corps (liste des questions) est reconstruit à chaque rendu — pas de
    // FLIP ici, contrairement à renderFullTable : l'ordre des QUESTIONS ne
    // change jamais en cours de partie, rien à animer.
    const body = card.querySelector('.detail-player-body')
    body.innerHTML = history.map(h => {
      const status = h.results ? h.results[p.id] : undefined
      const isCorrect = status === 'correct'
      const mark = isCorrect ? '✓' : status === 'incorrect' ? '✗' : '–'
      const markCls = isCorrect ? 'is-correct' : status === 'incorrect' ? 'is-incorrect' : 'is-absent'
      const answer = h.answers ? h.answers[p.id] : undefined
      const points = Number(h.deltas?.[p.id]) || 0
      return `
        <div class="detail-q-row">
          <span class="detail-q-mark ${markCls}">${mark}</span>
          <span class="detail-q-body">
            <span class="detail-q-prompt">${escDetail(h.prompt || '(question)')}</span>
            <span class="detail-q-answer">${answer ? escDetail(answer).replace(/\n/g, '<br>') : 'Pas de réponse'}</span>
          </span>
          <span class="detail-q-points ${points > 0 ? 'is-positive' : ''}">${points > 0 ? '+' : ''}${points} pts</span>
        </div>
      `
    }).join('')

    list.appendChild(card) // déplace le nœud existant : préserve l'état ouvert/fermé et l'ordre de classement
  })
}

// Version tableau (PC — voir CSS, masquée sur mobile où les cartes
// ci-dessus prennent le relais) : une ligne par joueur, une colonne par
// question. Retour utilisateur : la réponse doit être VISIBLE dans la
// case, pas seulement accessible en infobulle au survol (facile à manquer,
// invisible au toucher) — tronquée avec ellipsis si trop longue, le texte
// complet reste quand même en infobulle native (title) pour les réponses
// longues (ex. "relier").
const renderDetailTable = (ordered) => {
  const head = document.getElementById('detailTableHead')
  const body = document.getElementById('detailTableBody')
  if (!head || !body) return

  head.innerHTML = `<tr>
    <th class="detail-table-name-col">Joueur</th>
    ${history.map((h, i) => `<th title="${escDetail(h.prompt || '')}">Q${i + 1}</th>`).join('')}
    <th class="detail-table-total-col">Total</th>
  </tr>`

  body.innerHTML = ordered.map((p, i) => {
    const cells = history.map(h => {
      const status = h.results ? h.results[p.id] : undefined
      const isCorrect = status === 'correct'
      const mark = isCorrect ? '✓' : status === 'incorrect' ? '✗' : '–'
      const cls = isCorrect ? 'is-correct' : status === 'incorrect' ? 'is-incorrect' : 'is-absent'
      const answer = h.answers ? h.answers[p.id] : undefined
      const answerFlat = answer ? answer.replace(/\n/g, ' / ') : ''
      const points = Number(h.deltas?.[p.id]) || 0
      const tip = `${h.prompt || ''} — ${answerFlat || 'pas de réponse'}`
      return `<td class="detail-table-cell ${cls}" title="${escDetail(tip)}">
        <span class="detail-table-mark">${mark}</span>${points > 0 ? `<span class="detail-table-pts">+${points}</span>` : ''}
        <span class="detail-table-answer">${answerFlat ? escDetail(answerFlat) : '—'}</span>
      </td>`
    }).join('')
    return `<tr>
      <td class="detail-table-name">${i + 1}. ${escDetail(p.name)}</td>
      ${cells}
      <td class="detail-table-total">${p.score} pts</td>
    </tr>`
  }).join('')
}

// --- Bascule Podium / Détail --------------------------------------------
const resultsTabBtns = document.querySelectorAll('.results-tab-btn')
resultsTabBtns.forEach(btn => {
  btn.onclick = () => {
    resultsTabBtns.forEach(b => b.classList.toggle('active', b === btn))
    const podiumTab = document.getElementById('podiumTab')
    const detailTab = document.getElementById('detailTab')
    const showDetail = btn.dataset.tab === 'detail'
    if (podiumTab) podiumTab.classList.toggle('d-none', showDetail)
    if (detailTab) detailTab.classList.toggle('d-none', !showDetail)
  }
})

const historyTooltip = document.createElement('div')
historyTooltip.id = 'historyTooltip'
historyTooltip.className = 'history-tooltip d-none'
document.body.appendChild(historyTooltip)

// En mode équipe, les pistes du podium portent un id d'ÉQUIPE
// (data-player-id, voir runRace) — jamais présent dans history[].results,
// indexé lui par id de JOUEUR (buildHistorySync côté serveur). Sans cette
// distinction, le survol d'une piste du podium ne trouvait jamais rien et
// affichait "–" sur toutes les questions, alors que la liste complète en
// dessous (toujours indexée par joueur, jamais par équipe) fonctionnait
// normalement. Pour une équipe, faute d'un vrai "juste/faux" agrégé, on se
// base sur le même signal que la course elle-même : l'équipe a-t-elle
// gagné des points sur cette question (au moins un membre qui a trouvé).
const showHistoryTooltip = (playerId, x, y) => {
  if (!playerId || history.length === 0) { historyTooltip.classList.add('d-none'); return }
  const isTeam = teamModeActive && !!teamsById[playerId]
  const rows = (isTeam ? computeTeamHistory() : history).map(h => {
    let status
    if (isTeam) {
      status = (Number(h.deltas?.[playerId]) || 0) > 0 ? 'correct' : 'incorrect'
    } else {
      status = h.results ? h.results[playerId] : undefined
    }
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

// viewer:true (voir server/index.js room:join) : cette page ne fait que
// CONSULTER des résultats, jamais participer — sans ce marqueur, le
// serveur nous ajoutait comme un vrai joueur ("Spectateur" en repli quand
// aucun profil n'est enregistré), visible dans le salon/le classement de
// tout le monde (retour utilisateur, bug remonté après une session de
// test). On reçoit quand même les mêmes diffusions (history:sync/
// team:list/lobby:list) pour rester à jour.
socket.on('connect', () => {
  socket.emit('room:join', { roomCode, viewer: true })
})

socket.on('history:sync', (payload) => {
  history = payload?.history || []
  historyReceived = true
  tryStartRace()
  // Peut arriver APRÈS le premier lobby:list (ordre non garanti) : sans ces
  // deux appels, l'onglet Détail (tableau ET cartes) resterait bâti sur un
  // historique vide (aucune question listée) jusqu'à la prochaine
  // reconnexion d'un joueur.
  if (latestPlayers) {
    const ordered = computeOrder(latestPlayers.slice())
    renderDetailTab(ordered)
    renderDetailTable(ordered)
  }
})

// Diffusé par le serveur juste avant lobby:list à chaque room:join (voir
// server/index.js) — arrive donc toujours à temps pour la toute première
// render(), mais on retente quand même ici au cas où (defensive, comme pour
// history:sync ci-dessus).
socket.on('team:list', ({ teamMode, teams }) => {
  teamModeActive = !!teamMode
  teamsById = {}
  ;(teams || []).forEach(t => { teamsById[t.id] = t })
  tryStartRace()
})

socket.on('lobby:list', (list) => {
  const players = (list || []).filter(p => !p.isHost).map(p => ({ id: p.id, name: p.name, score: p.score || 0, avatar: p.avatar || '', teamId: p.teamId || null }))
  render(players)
})

socket.on('score:update', ({ playerId, delta, total }) => {
  // Optionnel: attendre une prochaine lobby:list si nécessaire
})

// Logo animation trigger (voir index/editor/select/profile.js, même
// mécanisme partout : classe posée par JS, pas par :hover, pour que
// l'explosion des décorations du logo se termine même si la souris ne
// reste pas dessus).
const brand = document.querySelector('.brand')
if (brand) {
  brand.addEventListener('mouseenter', () => {
    brand.classList.remove('animate-logo')
    void brand.offsetWidth // Trigger reflow
    brand.classList.add('animate-logo')
  })
}

