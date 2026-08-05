const path = require('path')
const Fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const { Server } = require('socket.io')

// bodyLimit relevé (défaut Fastify 1 Mo) : la route /api/room-image accepte
// une image compressée en base64 (~jusqu'à ~1,3 Mo pour 1 Mo de binaire brut).
const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 5 * 1024 * 1024 })
const PORT = process.env.PORT || 3000

const publicDir = path.join(__dirname, '..', 'client', 'public')
app.register(fastifyStatic, { root: publicDir })

app.get('/health', async () => ({ ok: true }))

const quizzStore = new Map()
const uid = () => Math.random().toString(36).slice(2, 10)
const MAX_NAME_LENGTH = 20
const seedQuizz = {
  id: 'sample1',
  title: 'Démo Néon',
  singleAttempt: true,
  isPublic: true,
  questions: [
    { id: 'q1', type: 'free', prompt: 'Capitale de la France ?', timerMs: 15000, correct: ['paris'], options: [] },
    { id: 'q2', type: 'mcq', prompt: 'Couleur néon principale ?', timerMs: 15000, correct: ['cyan'], options: ['cyan', 'magenta', 'lime', 'violet'] }
  ]
}
quizzStore.set(seedQuizz.id, seedQuizz)

app.get('/api/quizz', async (req) => {
  const owner = req.query?.owner
  const visibility = req.query?.visibility
  const list = Array.from(quizzStore.values())
    .filter(q => {
      if (visibility === 'public') return !!q.isPublic
      if (owner) return q.ownerId === owner
      return !!q.isPublic
    })
    .map(q => ({ id: q.id, title: q.title, count: Array.isArray(q.questions) ? q.questions.length : 0 }))
  return list
})

app.get('/api/quizz/:id', async (req, reply) => {
  const q = quizzStore.get(req.params.id)
  if (!q) return reply.code(404).send({ error: 'not_found' })
  return q
})

app.post('/api/quizz', async (req, reply) => {
  const b = req.body || {}
  const id = uid()
  const q = { 
    id, 
    title: b.title || 'Sans titre', 
    singleAttempt: b.singleAttempt !== false, 
    questions: Array.isArray(b.questions) ? b.questions : [],
    ownerId: typeof b.ownerId === 'string' ? b.ownerId : null
  }
  quizzStore.set(id, q)
  return { id }
})

app.put('/api/quizz/:id', async (req, reply) => {
  const id = req.params.id
  if (!quizzStore.has(id)) return reply.code(404).send({ error: 'not_found' })
  const b = req.body || {}
  const prev = quizzStore.get(id)
  const q = { 
    id, 
    title: b.title || 'Sans titre', 
    singleAttempt: b.singleAttempt !== false, 
    questions: Array.isArray(b.questions) ? b.questions : [],
    ownerId: prev?.ownerId || (typeof b.ownerId === 'string' ? b.ownerId : null)
  }
  quizzStore.set(id, q)
  return { ok: true }
})

app.delete('/api/quizz/:id', async (req, reply) => {
  const id = req.params.id
  const ok = quizzStore.delete(id)
  return { ok }
})

// Déduit l'URL publique à partir de la requête entrante plutôt que de deviner
// une IP locale : reflète toujours l'adresse réellement utilisée pour joindre
// le serveur, que ce soit en local (localhost), sur le réseau Wi-Fi (LAN,
// via l'en-tête Host envoyé par le navigateur) ou une fois déployé derrière
// le proxy d'un hébergeur comme Render (via x-forwarded-proto/Host).
const getBaseUrl = (headers) => {
  const proto = headers['x-forwarded-proto'] || 'http'
  const host = headers['host'] || `localhost:${PORT}`
  return `${proto}://${host}`
}

const start = async () => {
  const rooms = new Map()

  // Construit la liste de joueurs envoyée au client (lobby, classement,
  // résultats finaux...). Les joueurs déconnectés restent dedans, avec leur
  // dernier score/nom connu (voir le handler 'disconnect' : il ne les
  // supprime plus) — un joueur qui quitte en cours de partie doit rester
  // visible au classement plutôt que de disparaître.
  const buildPlayerList = (room) => Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar || '',
    score: room.scores.get(p.id) || 0,
    ready: !!p.ready,
    isHost: p.id === room.hostId || p.token === room.hostToken,
    connected: p.connected !== false
  }))

  // Joueurs (hors hôte) actuellement connectés — sert à la fois pour "tout le
  // monde est prêt" et pour le compteur "X/Y ont répondu" : un joueur qui a
  // quitté ne doit jamais bloquer indéfiniment le reste de la salle (il
  // resterait "non prêt"/"n'a pas répondu" pour toujours sinon).
  const activePlayers = (room) => Array.from(room.players.values())
    .filter(p => p.id !== room.hostId && p.token !== room.hostToken && p.connected !== false)

  const computeAllReady = (room) => activePlayers(room).every(p => !!p.ready)

  // Historique traduit token -> socket.id courant de chaque joueur (voir plus
  // bas) — diffusé à TOUTE la salle (pas seulement au socket qui rejoint) :
  // sinon un viewer déjà connecté (ex. page résultats restée ouverte) garde un
  // mapping figé au moment de sa propre connexion, qui devient faux dès qu'un
  // AUTRE joueur se reconnecte ensuite avec un nouveau socket.id (tous ses
  // résultats affichent alors "–", alors que son score est pourtant correct).
  const buildHistorySync = (room) => room.history.map(h => {
    const idResults = {}
    for (const [tok, val] of Object.entries(h.results)) {
      const t = room.tokens.get(tok)
      if (t) idResults[t.id] = val
    }
    return { id: h.id, prompt: h.prompt, type: h.type, results: idResults }
  })

  app.get('/server-info', async (req) => ({ url: getBaseUrl(req.headers), port: PORT }))

  // Question "image" : l'image ne transite plus par socket.io (un gros blob
  // base64 embarqué dans un message temps réel s'est révélé peu fiable une
  // fois déployé — coupures/pertes silencieuses observées en prod alors que
  // tout fonctionnait en local). L'hôte la dépose ici via une requête HTTP
  // classique juste avant de démarrer la question ; tout le monde (hôte
  // compris, pour un seul chemin de code) la récupère ensuite via un simple
  // <img src>, bien mieux géré par un hébergeur/proxy qu'un frame websocket
  // géant. Stockée en mémoire par code de salle (écrasée à chaque nouvelle
  // question "image" — une seule à la fois par salle, pas besoin de plus).
  app.post('/api/room-image/:code', async (req, reply) => {
    const room = rooms.get(req.params.code)
    if (!room) return reply.code(404).send({ error: 'room_not_found' })
    const image = req.body?.image
    if (typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(image) || image.length > 2_000_000) {
      return reply.code(400).send({ error: 'invalid_image' })
    }
    room.pendingImage = image
    return { ok: true }
  })

  app.get('/api/room-image/:code', async (req, reply) => {
    const room = rooms.get(req.params.code)
    const dataUri = room?.pendingImage
    if (!dataUri) return reply.code(404).send()
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
    if (!match) return reply.code(404).send()
    reply.header('Cache-Control', 'no-store')
    reply.type(match[1])
    return Buffer.from(match[2], 'base64')
  })

  await app.listen({ port: PORT, host: '0.0.0.0' })
  const io = new Server(app.server, { cors: { origin: '*' } })

  const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim()
  const lev = (a, b) => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      }
    }
    return dp[m][n]
  }
  const fuzzy = (input, answers) => {
    const x = norm(input)
    const normalizedAnswers = answers.map(a => norm(a)).sort()
    
    // Check for multiple answers (comma separated)
    // ONLY if there are multiple correct answers defined
    if (normalizedAnswers.length > 1 && x.includes(',')) {
      const inputs = x.split(',').map(s => s.trim()).filter(s => s !== '').sort()
      
      if (inputs.length === normalizedAnswers.length) {
        const allMatch = inputs.every((val, idx) => val === normalizedAnswers[idx])
        if (allMatch) return { ok: true, exact: true }
      }
      return { ok: false }
    }

    for (const ans of answers) {
      const y = norm(ans)
      if (x === y) return { ok: true, exact: true }
      const d = lev(x, y)
      const thresh = Math.max(1, Math.floor(y.length * 0.2))
      if (d <= thresh) return { ok: true, exact: false }
    }
    return { ok: false }
  }
  const pointsFor = (startTs, now, base = 1000, alpha = 0.05, floor = 100) => {
    const elapsed = Math.max(0, now - startTs)
    const raw = Math.max(floor, Math.floor(base - alpha * elapsed))
    return raw
  }
  const GRAD_CORRECT_THRESHOLD = 0.8
  // Question "image" : distance en cases (Chebyshev — inclut les diagonales,
  // cohérent avec une grille visible où une case adjacente "compte presque")
  // au-delà de laquelle la proximité ne rapporte plus rien.
  const IMAGE_PROXIMITY_MAX_DIST = 3
  // Doit rester cohérent avec IMAGE_GRID_COLS/ROWS dans client/public/js/index.js
  // (grille fixe côté joueur) — sert ici à convertir la case cliquée en
  // coordonnées normalisées 0-1, pour la comparer au rectangle {x0,y0,x1,y1}
  // dessiné librement par le créateur dans l'éditeur (pas de grille de son côté).
  const IMAGE_GRID_COLS = 10
  const IMAGE_GRID_ROWS = 6

  // Délai de révélation avant que le chrono ne démarre vraiment : le temps
  // que la question s'affiche puis que les réponses apparaissent une à une
  // (animation partagée hôte/joueurs), tout le monde lit en même temps avant
  // que ça ne devienne une course. Les constantes (pause, décalage par tuile,
  // durée d'anim) sont dupliquées côté client (index.js) pour que le timing
  // visuel colle exactement à ce délai serveur.
  const REVEAL_QUESTION_BEAT_MS = 900
  const REVEAL_STAGGER_MS = 350
  const REVEAL_TILE_ANIM_MS = 500
  const REVEAL_BUFFER_MS = 400
  const computeRevealMs = (payload) => {
    const hasTiles = payload?.type === 'mcq' || payload?.type === 'truefalse' || payload?.type === 'order'
    const tileCount = hasTiles && Array.isArray(payload?.options) ? Math.max(1, payload.options.length) : 1
    const staggerSpan = hasTiles ? (tileCount - 1) * REVEAL_STAGGER_MS : 0
    // "free" n'a ni tuiles à faire apparaître une à une ni animation à
    // attendre (un seul champ texte) : le tampon de fin d'animation ne sert
    // donc à rien pour ce type, contrairement aux autres — on ne garde que le
    // temps de lecture de la question.
    const isFree = payload?.type === 'free'
    const tileAnim = isFree ? 0 : REVEAL_TILE_ANIM_MS
    const buffer = isFree ? 0 : REVEAL_BUFFER_MS
    return REVEAL_QUESTION_BEAT_MS + staggerSpan + tileAnim + buffer
  }

  io.on('connection', socket => {
    socket.on('room:create', async payload => {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase()
      const hostToken = payload?.token || uid()
      rooms.set(code, {
        hostId: socket.id,
        hostToken: hostToken,
        players: new Map(),
        state: 'lobby',
        pending: new Map(),
        currentQuestion: null,
        scores: new Map(),
        tokens: new Map(),
        history: [],
        ended: false
      })
      socket.hostRoomCode = code // Store room code in socket to handle disconnect
      await socket.join(code)
      const serverUrl = getBaseUrl(socket.handshake.headers)
      socket.emit('room:created', { roomCode: code, serverUrl, hostToken })
    })

    socket.on('room:close', async payload => {
      const code = (payload?.roomCode || '').toUpperCase()
      const room = rooms.get(code)
      if (room && room.hostId === socket.id) {
        io.to(code).emit('room:closed', { message: 'La salle a été fermée par l\'hôte.' })
        rooms.delete(code)
        // Make all clients in the room leave
        const sockets = await io.in(code).fetchSockets()
        sockets.forEach(s => s.leave(code))
      }
    })

    socket.on('room:join', async payload => {
      const code = (payload?.roomCode || '').toUpperCase()
      const name = (payload?.playerName || 'Player').slice(0, MAX_NAME_LENGTH)
      const token = payload?.token || uid()
      const room = rooms.get(code)
      if (!room) return socket.emit('room:error', { message: 'room not found' })
      socket.roomCode = code // Pour nettoyer proprement cette entrée au disconnect

      // Si c'est l'hôte qui se reconnecte
      if (token === room.hostToken) {
        room.hostId = socket.id
      }
      
      console.log('DEBUG room:join', { 
        socketId: socket.id, 
        roomHostId: room.hostId, 
        token, 
        roomHostToken: room.hostToken,
        matchId: socket.id === room.hostId,
        matchToken: token === room.hostToken
      })

      const existing = room.tokens.get(token)
      if (existing) {
        room.players.delete(existing.id)
        room.players.set(socket.id, { id: socket.id, name: existing.name || name, score: existing.score || 0, token, avatar: payload?.avatar || existing.avatar || '', ready: false, connected: true })
        room.scores.set(socket.id, existing.score || 0)
      } else {
        room.players.set(socket.id, { id: socket.id, name, score: 0, token, avatar: payload?.avatar || '', ready: false, connected: true })
        room.scores.set(socket.id, 0)
      }
      room.tokens.set(token, { id: socket.id, name, score: room.scores.get(socket.id) })

      await socket.join(code)
      socket.emit('player:token', { token })
      io.to(code).emit('player:joined', { id: socket.id, name })

      // Diffusé à toute la salle (pas seulement à ce socket) : voir
      // buildHistorySync, un mapping token->id envoyé à un seul viewer devient
      // faux dès qu'un AUTRE joueur se reconnecte ensuite.
      if (room.history.length > 0) {
        io.to(code).emit('history:sync', { history: buildHistorySync(room) })
      }

      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
    })

    socket.on('player:profile', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const p = room.players.get(socket.id)
      if (!p) return
      if (payload?.name) p.name = String(payload.name).slice(0, MAX_NAME_LENGTH)
      if (typeof payload?.avatar === 'string') p.avatar = payload.avatar
      const tok = room.tokens.get(p.token)
      if (tok) room.tokens.set(p.token, { id: socket.id, name: p.name, score: room.scores.get(socket.id) || 0 })
      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
    })

    socket.on('player:ready', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const p = room.players.get(socket.id)
      if (!p) return
      p.ready = !!payload?.ready
      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
    })

    socket.on('player:kick', payload => {
      const code = payload?.roomCode
      const targetId = payload?.playerId
      const room = rooms.get(code)
      if (!room) return
      // Seul l'hôte peut exclure un joueur, et pas lui-même.
      if (socket.id !== room.hostId) return
      if (targetId === room.hostId) return
      const target = room.players.get(targetId)
      if (!target) return

      room.players.delete(targetId)
      room.scores.delete(targetId)
      // Invalide son jeton pour qu'une reconnexion (même navigateur) ne le
      // fasse pas rentrer automatiquement avec son ancien état.
      if (target.token) room.tokens.delete(target.token)

      const targetSocket = io.sockets.sockets.get(targetId)
      if (targetSocket) {
        targetSocket.emit('player:kicked', { message: 'Tu as été exclu de la salle par l\'hôte.' })
        targetSocket.leave(code)
        targetSocket.disconnect(true)
      }

      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
    })

    socket.on('question:show', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return

      if (!computeAllReady(room)) {
        socket.emit('quiz:notReady', { message: 'Tous les joueurs ne sont pas prêts !' })
        return
      }

      const historyEntry = { id: payload?.id, prompt: payload?.prompt, type: payload?.type, results: {} }
      room.history.push(historyEntry)

      const revealMs = computeRevealMs(payload)
      room.currentQuestion = { id: payload?.id, type: payload?.type, correct: payload?.correct || [], min: payload?.min, max: payload?.max, timerMs: payload?.timerMs || 15000, startTs: Date.now() + revealMs, answered: new Set(), submissions: new Map(), pending: room.pending, singleAttempt: payload?.singleAttempt !== false, historyEntry }

      // Pour 'graduation', ne jamais diffuser la valeur cible : sinon elle est
      // lisible dans la frame WebSocket (devtools) avant même de répondre.
      const { correct, ...payloadWithoutCorrect } = payload || {}
      const broadcastPayload = (payload?.type === 'graduation' || payload?.type === 'order' || payload?.type === 'image') ? payloadWithoutCorrect : payload

      // Diffusé immédiatement (pas au bout de revealMs) : chaque client anime
      // lui-même la révélation de la question/des tuiles jusqu'à startTs, pour
      // que l'hôte (écran principal) et les joueurs la voient au même moment.
      io.to(code).emit('question:show', { ...broadcastPayload, singleAttempt: room.currentQuestion.singleAttempt, startTs: room.currentQuestion.startTs })
      setTimeout(() => {
        // Tout token sans résultat pour cette question au moment où le temps est écoulé
        // n'a simplement pas répondu (couvre aussi une soumission graduation avec des
        // bornes invalides, déjà ignorée silencieusement côté scoring).
        for (const [token] of room.tokens) {
          if (!(token in historyEntry.results)) historyEntry.results[token] = 'incorrect'
        }

        io.to(code).emit('timer:end', { id: room.currentQuestion.id })

        // Si une réponse texte libre est encore en attente de validation par l'hôte,
        // on ne révèle pas la bonne réponse : le flux de modération existant continue
        // de gérer la transition vers le classement une fois la modération terminée.
        if (room.pending.size === 0) {
          io.to(code).emit('question:reveal', {
            id: room.currentQuestion.id,
            type: room.currentQuestion.type,
            correct: room.currentQuestion.correct,
            target: room.currentQuestion.type === 'graduation' ? room.currentQuestion.correct?.[0] : undefined
          })
        }
      }, revealMs + room.currentQuestion.timerMs)
    })

    socket.on('answer:submit', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const q = room.currentQuestion
      if (!q) return
      // Encore en phase de révélation (les tuiles apparaissent à l'écran) :
      // le client bloque déjà l'UI, mais on ne fait jamais confiance qu'au
      // serveur pour l'ouverture réelle de la fenêtre de réponse.
      if (Date.now() < q.startTs) return
      if (Date.now() - q.startTs > q.timerMs) return
      if (q.answered?.has(socket.id)) return
      if (q.singleAttempt && q.submissions?.has(socket.id)) return
      socket.emit('answer:ack', { playerId: socket.id })

      // Compteur « X/Y ont répondu » pour l'écran de l'hôte : émis après chaque
      // soumission enregistrée (peu importe qu'elle soit juste, fausse ou en
      // attente de modération).
      const emitProgress = () => {
        const total = activePlayers(room).length
        io.to(code).emit('answer:progress', { answered: q.submissions?.size || 0, total })
      }

      if (q.type === 'graduation') {
        const guess = Number(payload?.content)
        const min = Number(q.min), max = Number(q.max)
        const target = Number(q.correct?.[0])
        if (!Number.isFinite(guess) || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target) || min >= max) return
        const clamped = Math.min(max, Math.max(min, guess))
        const range = Math.max(1e-9, max - min)
        const closeness = Math.max(0, 1 - Math.abs(clamped - target) / range)
        const delta = Math.round(pointsFor(q.startTs, Date.now()) * closeness)
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total })
          if (q.historyEntry) q.historyEntry.results[p.token] = closeness >= GRAD_CORRECT_THRESHOLD ? 'correct' : 'incorrect'
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      if (q.type === 'image') {
        // Distance jusqu'au rectangle de bonne réponse ({x0,y0,x1,y1}, tracé
        // librement par le créateur, coordonnées normalisées 0-1) -> facteur
        // de proximité, même principe que la tolérance de "graduation". On
        // convertit d'abord la case cliquée (grille fixe côté joueur) en point
        // normalisé (son centre), puis on mesure l'écart au rectangle en
        // "unités de case" (delta normalisé * nombre de cases) pour garder le
        // même seuil de tolérance qu'avant (IMAGE_PROXIMITY_MAX_DIST). Dans le
        // rectangle -> distance 0 -> points max ; en dehors -> ça dégrade selon
        // l'écart au bord le plus proche (Chebyshev : le plus grand des deux axes).
        let cell
        try { cell = JSON.parse(payload?.content || 'null') } catch { cell = null }
        const zone = Array.isArray(q.correct) ? q.correct[0] : null
        if (!cell || typeof cell.col !== 'number' || typeof cell.row !== 'number' || !zone || typeof zone.x0 !== 'number') return
        const px = (cell.col + 0.5) / IMAGE_GRID_COLS
        const py = (cell.row + 0.5) / IMAGE_GRID_ROWS
        const distX = px < zone.x0 ? (zone.x0 - px) * IMAGE_GRID_COLS : px > zone.x1 ? (px - zone.x1) * IMAGE_GRID_COLS : 0
        const distY = py < zone.y0 ? (zone.y0 - py) * IMAGE_GRID_ROWS : py > zone.y1 ? (py - zone.y1) * IMAGE_GRID_ROWS : 0
        const dist = Math.max(distX, distY)
        const closeness = Math.max(0, 1 - dist / IMAGE_PROXIMITY_MAX_DIST)
        const delta = Math.round(pointsFor(q.startTs, Date.now()) * closeness)
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total })
          if (q.historyEntry) q.historyEntry.results[p.token] = dist === 0 ? 'correct' : 'incorrect'
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      if (q.type === 'order') {
        // Tout ou rien : l'ordre soumis (JSON d'un tableau) doit correspondre
        // exactement, élément par élément, à q.correct. Pas de fuzzy matching
        // ici (ça n'aurait pas de sens pour une comparaison de séquence), pas
        // de modération (comme mcq/truefalse).
        let submitted
        try { submitted = JSON.parse(payload?.content || '[]') } catch { submitted = null }
        const correctOrder = Array.isArray(q.correct) ? q.correct : []
        const isCorrect = Array.isArray(submitted) &&
          submitted.length === correctOrder.length &&
          submitted.every((v, i) => v === correctOrder[i])
        const p = room.players.get(socket.id)
        if (isCorrect) {
          const delta = pointsFor(q.startTs, Date.now())
          const total = (room.scores.get(socket.id) || 0) + delta
          room.scores.set(socket.id, total)
          if (p?.token) {
            room.tokens.set(p.token, { id: socket.id, name: p.name, score: total })
            if (q.historyEntry) q.historyEntry.results[p.token] = 'correct'
          }
          q.answered?.add(socket.id)
          q.submissions?.set(socket.id, 'correct')
          io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        } else {
          if (p?.token && q.historyEntry) q.historyEntry.results[p.token] = 'incorrect'
          q.submissions?.set(socket.id, 'incorrect')
        }
        emitProgress()
        return
      }

      const res = fuzzy(payload?.content || '', q.correct)

      if (res.ok && res.exact) {
        const delta = pointsFor(q.startTs, Date.now())
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total })
          if (q.historyEntry) q.historyEntry.results[p.token] = 'correct'
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'correct')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
      } else {
        // Pour les QCM ('mcq') et Vrai/Faux ('truefalse'), c'est binaire : si ce
        // n'est pas EXACT, c'est FAUX. On ne passe JAMAIS par la modération.
        if (q.type === 'mcq' || q.type === 'truefalse') {
          q.submissions?.set(socket.id, 'incorrect')
          const p = room.players.get(socket.id)
          if (p?.token && q.historyEntry) q.historyEntry.results[p.token] = 'incorrect'
          emitProgress()
          return
        }

        const prevId = q.submissions?.get(socket.id)
        if (!q.singleAttempt && prevId) {
          room.pending.delete(prevId)
        }
        const submitTs = Date.now()
        const delta = pointsFor(q.startTs, submitTs)
        const answerId = `${socket.id}:${submitTs}`
        room.pending.set(answerId, { playerId: socket.id, content: payload?.content, ts: submitTs, delta, historyEntry: q.historyEntry })
        q.submissions?.set(socket.id, answerId)
        io.to(code).emit('answer:queue', { answerId, playerId: socket.id, content: payload?.content })
        emitProgress()
      }
    })

    socket.on('moderation:approve', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const item = room.pending.get(payload?.answerId)
      if (!item) return
      room.pending.delete(payload?.answerId)
      const q = room.currentQuestion
      if (q?.answered?.has(item.playerId)) return
      const delta = item.delta || pointsFor(q.startTs, item.ts)
      const total = (room.scores.get(item.playerId) || 0) + delta
      room.scores.set(item.playerId, total)
      const p = room.players.get(item.playerId)
      if (p?.token) {
        room.tokens.set(p.token, { id: item.playerId, name: p.name, score: total })
        if (item.historyEntry) item.historyEntry.results[p.token] = 'correct'
      }
      q?.answered?.add(item.playerId)
      io.to(code).emit('score:update', { playerId: item.playerId, delta, total })

      // Si plus aucune réponse en attente après approbation
      if (room.pending.size === 0) {
        io.to(code).emit('moderation:finished')
      }
    })

    socket.on('moderation:reject', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const item = room.pending.get(payload?.answerId)
      room.pending.delete(payload?.answerId)
      if (item?.historyEntry) {
        const p = room.players.get(item.playerId)
        if (p?.token) item.historyEntry.results[p.token] = 'incorrect'
      }
      io.to(code).emit('moderation:rejected', { answerId: payload?.answerId })

      // Si plus aucune réponse en attente après rejet
      if (room.pending.size === 0) {
        io.to(code).emit('moderation:finished')
      }
    })

    socket.on('leaderboard:show', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || socket.id !== room.hostId) return
      io.to(code).emit('leaderboard:show')
    })

    socket.on('disconnect', () => {
      const code = socket.roomCode || socket.hostRoomCode
      if (!code) return
      const room = rooms.get(code)
      if (!room) return

      // Si l'hôte se déconnecte avant la fin du quiz, la salle se ferme pour tout le monde.
      if (room.hostId === socket.id && !room.ended) {
        io.to(code).emit('room:closed', { message: 'L\'hôte s\'est déconnecté.' })
        rooms.delete(code)
        return
      }

      // Sinon (joueur qui quitte, ou hôte qui navigue vers /result.html une fois le
      // quiz terminé) : on ne supprime plus l'entrée, juste marquée déconnectée.
      // Un joueur qui quitte en cours de partie doit rester visible au
      // classement/podium avec son dernier score connu, pas disparaître — s'il
      // revient avec le même jeton, room:join reprend cette même entrée (pas
      // de doublon possible, donc pas de risque de "joueur fantôme" dupliqué).
      const p = room.players.get(socket.id)
      if (p) {
        p.connected = false
        io.to(code).emit('lobby:list', buildPlayerList(room))
        io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
      }
    })

    socket.on('quiz:end', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (room) {
        room.ended = true
        io.to(code).emit('quiz:end')
        // Nettoyage différé : laisse le temps à tout le monde de consulter les
        // résultats avant de libérer la salle (elle n'est plus auto-supprimée
        // au disconnect une fois "ended").
        setTimeout(() => rooms.delete(code), 15 * 60 * 1000)
      }
    })
  })
}

start()
