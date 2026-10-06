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

// Mode TV (voir index.js quiz:end : la fenêtre de présentation ouvre cette page avec &tv=1) :
// vue passive plein écran, sans navigation ni boutons, podium + classement côte à côte,
// agrandie à l'échelle de l'écran (la page est dessinée pour ~700px de large).
if (params.get('tv') === '1') {
  document.body.classList.add('results-tv')
  const tvCard = document.querySelector('.card')
  const applyTvScale = () => {
    if (!tvCard) return
    tvCard.style.zoom = Math.max(1, Math.min(window.innerWidth / 1180, window.innerHeight / 760)).toFixed(3)
  }
  applyTvScale()
  window.addEventListener('resize', applyTvScale)
}

// Bug remonté en test réel ("j'arrive sur le menu, et je suis directement
// redirigé dans le salon que je viens de quitter") : index.js persiste la
// dernière salle rejointe en sessionStorage (QUEAZY_LAST_JOIN_KEY =
// 'queazy_last_join', voir rememberJoin/readLastJoin dans index.js) pour
// survivre à un rechargement de page (micro-coupures réseau) — mais cette
// page-ci (résultats, salle déjà terminée côté serveur) ne le nettoyait
// jamais avant de renvoyer vers '/', qui retombait alors dessus au
// prochain socket.on('connect') et rerejoignait silencieusement. Même clé
// que index.js (pas d'import possible entre ces deux scripts séparés).
const backBtn = document.getElementById('backHome')
if (backBtn) backBtn.onclick = () => {
  try { sessionStorage.removeItem('queazy_last_join') } catch {}
  window.location.href = '/'
}

// N'apparaît que côté hôte : ?quiz= n'est ajouté à l'URL que par l'hôte
// (voir index.js quiz:end, seul à connaître loadedQuiz.id) — un joueur qui
// arrive ici n'a jamais ce paramètre, donc jamais ce bouton. Retour
// utilisateur : aucun moyen de relancer la même partie une fois sur les
// résultats, seulement "Retour à l'accueil" puis re-sélectionner le quiz.
const replayQuizId = params.get('quiz')
const replayBtn = document.getElementById('replayQuiz')
if (replayBtn && replayQuizId) {
  replayBtn.classList.remove('d-none')
  // Même nettoyage que backBtn ci-dessus (même bug) : sans ça, le
  // rechargement de '/' rerejoignait l'ancienne salle terminée au lieu de
  // suivre ?quiz= vers une nouvelle partie.
  replayBtn.onclick = () => {
    try { sessionStorage.removeItem('queazy_last_join') } catch {}
    window.location.href = `/?quiz=${encodeURIComponent(replayQuizId)}`
  }
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
    // Repli volontaire sur user_metadata/email (déjà posé juste au-dessus) en
    // cas d'échec (RLS, réseau) — pas bloquant pour afficher les résultats.
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

// Tâche 024 (retour utilisateur : "le classement final n'intègre pas
// l'hôte") : en mode "Jouer" (roomMode==='auto'), l'hôte est un joueur
// comme un autre côté jeu (voir index.js isPresenterHost) — le classement
// final doit donc l'inclure aussi, contrairement au mode "Présenter" où il
// n'a jamais joué. Reçu via room:mode (voir server/index.js, émis aussi à
// ce viewer désormais).
let roomMode = 'present'

// ---------------------------------------------------------------------
// Podium final : voir results-finale.js (animation de fin + podium 2 - 1 - 3), lancé par launchPodium
// plus bas. Ancien podium « course » (barres qui montent) remplacé par la tâche 049.
// ---------------------------------------------------------------------

// Une "entité" équipe pour la course : mêmes champs qu'un joueur
// (id/name/avatar/score) pour que l'animation de fin n'ait besoin d'aucune branche
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

// Hash stable du code de salle : TV, joueurs et MJ tirent ainsi le même effet et le même ordre
// d'élimination dans l'animation de fin (results-finale.js).
const finaleSeed = (key) => {
  let s = 2166136261
  for (const c of String(key)) { s ^= c.charCodeAt(0); s = Math.imul(s, 16777619) }
  return s >>> 0
}

// Animation de fin (tâche 049) dès 2 joueurs/équipes et un historique : tous les joueurs en cartes,
// éliminés en rafale jusqu'au podium (ou, à 3 ou moins, révélation directe du podium), puis podium
// 2 - 1 - 3 avec couronne, confettis et fanfare. Sans historique, avec un seul joueur ou en
// « mouvement réduit » : podium seul.
const launchPodium = (entities, hist) => {
  const tab = document.getElementById('podiumTab')
  const host = document.getElementById('resultsPodium')
  if (!window.QzFinale || !tab || !host) { console.error('Animation de fin indisponible (results-finale.js absent)'); return }
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const stage = document.createElement('div')
  stage.className = 'fin-stage'
  host.prepend(stage)
  tab.classList.add('finale-active') // masque la liste complète tant que le classement n'est pas révélé
  const done = () => tab.classList.remove('finale-active')
  // Classement frais au moment du podium : un lobby:list a pu arriver pendant l'animation.
  const getTop = () => (teamModeActive ? computeTeamEntities() : computeOrder((latestPlayers || []).slice())).slice(0, 3)
  const onWinner = () => { try { fanfareSound.currentTime = 0; fanfareSound.play().catch(() => {}) } catch {} /* lecture bloquée par le navigateur : sans importance */ }
  const podiumOnly = (animate) => window.QzFinale.podium({ stage, top: getTop(), animate, onWinner }).then(done)
  if (reducedMotion || entities.length < 2 || hist.length === 0) { podiumOnly(!reducedMotion); return }
  try {
    window.QzFinale.run({
      stage,
      entities: entities.map(e => ({ id: e.id, name: e.name, avatar: e.avatar, score: e.score })),
      raceHistory: hist,
      seed: finaleSeed(roomCode),
      canSkip: params.get('tv') !== '1',
      getTop,
      onWinner,
      onDone: done
    })
  } catch (err) {
    console.error('Animation de fin indisponible, podium direct :', err)
    stage.replaceChildren()
    podiumOnly(false)
  }
}

const tryStartRace = () => {
  if (raceStarted || !historyReceived || !latestPlayers) return
  if (teamModeActive) {
    const teams = computeTeamEntities()
    if (teams.length === 0) return
    raceStarted = true
    launchPodium(teams, computeTeamHistory())
    return
  }
  const ordered = computeOrder(latestPlayers.slice())
  if (ordered.length === 0) return
  raceStarted = true
  launchPodium(ordered, history)
}

// Le podium garde l'id de joueur figé à sa construction (data-player-id, voir results-finale.js). Si CE
// joueur se reconnecte ensuite (nouveau socket.id — page rechargée, réseau coupé...), le survol de sa
// colonne n'afficherait plus le bon récap par question : on retrouve la colonne par NOM (seul repère
// qui survit à une reconnexion côté client : le serveur ne diffuse jamais les tokens) et on rafraîchit
// son id. La liste complète, reconstruite à CHAQUE lobby:list, reste toujours correcte.
const resyncPodiumIds = (players) => {
  if (!raceStarted) return
  const currentIdByName = new Map()
  players.forEach(p => { if (p.name) currentIdByName.set(p.name, p.id) })
  document.querySelectorAll('#resultsPodium .fin-pod-col').forEach(col => {
    const freshId = currentIdByName.get(col.querySelector('.fin-pod-name')?.textContent)
    if (freshId && freshId !== col.dataset.playerId) col.dataset.playerId = freshId
  })
}

const render = (players) => {
  // Le podium (top) veut le tri par équipe s'il est actif ; la liste
  // complète en dessous, elle, reste TOUJOURS un classement individuel par
  // joueur — voir renderFullTable, jamais agrégée par équipe.
  const ordered = computeOrder(players.slice())
  latestPlayers = players
  tryStartRace()
  resyncPodiumIds(players)
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
// (data-player-id, voir results-finale.js) — jamais présent dans history[].results,
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

socket.on('room:mode', ({ mode }) => { roomMode = mode === 'auto' ? 'auto' : 'present' })

socket.on('lobby:list', (list) => {
  const players = (list || [])
    .filter(p => roomMode === 'auto' || !p.isHost)
    .map(p => ({ id: p.id, name: p.name, score: p.score || 0, avatar: p.avatar || '', teamId: p.teamId || null }))
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



// Tâche 048 : top 3 de CE quiz (tous temps confondus), révélé sous le podium.
// qid vient de la fin de partie (voir index.js, quiz:end). Les résultats sont
// écrits côté serveur juste APRÈS quiz:end : une 1re lecture légèrement
// décalée, puis une 2e pour rattraper un enregistrement un peu lent. Rien
// n'est affiché si personne n'a de résultat (quiz jamais terminé / invités).
const quizIdForTop = params.get('qid')
if (quizIdForTop) {
  const MEDALS = ['🥇', '🥈', '🥉']
  const renderQuizTop = async () => {
    const sb = window.supabaseClient
    if (!sb) return
    const { data, error } = await sb.rpc('quiz_top_scores', { p_quiz_id: quizIdForTop, p_limit: 3 })
    if (error || !data || !data.length) return
    let box = document.getElementById('quizTopScores')
    if (!box) {
      box = document.createElement('div')
      box.id = 'quizTopScores'
      box.className = 'quiz-top-scores'
      document.getElementById('resultsPodium')?.insertAdjacentElement('afterend', box)
    }
    box.textContent = ''
    const title = document.createElement('h3')
    title.className = 'quiz-top-title'
    title.textContent = 'Meilleurs scores sur ce quiz'
    box.appendChild(title)
    data.forEach((row, i) => {
      const line = document.createElement('div')
      line.className = 'quiz-top-row'
      const medal = document.createElement('span')
      medal.textContent = MEDALS[i] || String(i + 1)
      const name = document.createElement('span')
      name.className = 'quiz-top-name'
      name.textContent = row.player_name
      const score = document.createElement('span')
      score.className = 'quiz-top-score'
      score.textContent = `${row.score} pts`
      line.append(medal, name, score)
      box.appendChild(line)
    })
  }
  window.addEventListener('load', () => {
    setTimeout(renderQuizTop, 1500)
    setTimeout(renderQuizTop, 5000)
  })
}
