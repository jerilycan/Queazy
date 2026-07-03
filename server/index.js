const path = require('path')
const Fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const { Server } = require('socket.io')

const app = Fastify({ logger: true, trustProxy: true })
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
  app.get('/server-info', async (req) => ({ url: getBaseUrl(req.headers), port: PORT }))
  await app.listen({ port: PORT, host: '0.0.0.0' })
  const io = new Server(app.server, { cors: { origin: '*' } })

  const rooms = new Map()

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
        room.players.set(socket.id, { id: socket.id, name: existing.name || name, score: existing.score || 0, token, avatar: payload?.avatar || existing.avatar || '', ready: false })
        room.scores.set(socket.id, existing.score || 0)
      } else {
        room.players.set(socket.id, { id: socket.id, name, score: 0, token, avatar: payload?.avatar || '', ready: false })
        room.scores.set(socket.id, 0)
      }
      room.tokens.set(token, { id: socket.id, name, score: room.scores.get(socket.id) })
      
      await socket.join(code)
      socket.emit('player:token', { token })
      io.to(code).emit('player:joined', { id: socket.id, name })

      // Envoyé uniquement au socket qui rejoint (ex. la page de résultats finaux) :
      // traduit les résultats indexés par token (identité durable) vers le socket.id
      // courant de chaque joueur — ne jamais exposer les tokens bruts au client, ils
      // servent à reprendre l'identité d'un joueur en cas de reconnexion.
      if (room.history.length > 0) {
        const history = room.history.map(h => {
          const idResults = {}
          for (const [tok, val] of Object.entries(h.results)) {
            const t = room.tokens.get(tok)
            if (t) idResults[t.id] = val
          }
          return { id: h.id, prompt: h.prompt, type: h.type, results: idResults }
        })
        socket.emit('history:sync', { history })
      }
      
      const list = Array.from(room.players.values()).map(p => ({ 
        id: p.id, 
        name: p.name, 
        avatar: p.avatar || '', 
        score: room.scores.get(p.id) || 0, 
        ready: !!p.ready, 
        isHost: p.id === room.hostId || p.token === room.hostToken
      }))
      io.to(code).emit('lobby:list', list)
      
      const allReady = Array.from(room.players.values())
        .filter(p => p.id !== room.hostId && p.token !== room.hostToken) // L'hôte n'a pas besoin d'être prêt
        .every(p => !!p.ready)
      io.to(code).emit('lobby:readyStatus', { allReady })
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
      const list = Array.from(room.players.values()).map(x => ({ 
        id: x.id, 
        name: x.name, 
        avatar: x.avatar || '', 
        score: room.scores.get(x.id) || 0, 
        ready: !!x.ready, 
        isHost: x.id === room.hostId || x.token === room.hostToken
      }))
      io.to(code).emit('lobby:list', list)
      const allReady = Array.from(room.players.values())
        .filter(x => x.id !== room.hostId && x.token !== room.hostToken)
        .every(x => !!x.ready)
      io.to(code).emit('lobby:readyStatus', { allReady })
    })

    socket.on('player:ready', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const p = room.players.get(socket.id)
      if (!p) return
      p.ready = !!payload?.ready
      const list = Array.from(room.players.values()).map(x => ({ 
        id: x.id, 
        name: x.name, 
        avatar: x.avatar || '', 
        score: room.scores.get(x.id) || 0, 
        ready: !!x.ready, 
        isHost: x.id === room.hostId || x.token === room.hostToken
      }))
      io.to(code).emit('lobby:list', list)
      const allReady = Array.from(room.players.values())
        .filter(x => x.id !== room.hostId && x.token !== room.hostToken)
        .every(x => !!x.ready)
      io.to(code).emit('lobby:readyStatus', { allReady })
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

      const list = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar || '',
        score: room.scores.get(p.id) || 0,
        ready: !!p.ready,
        isHost: p.id === room.hostId || p.token === room.hostToken
      }))
      io.to(code).emit('lobby:list', list)
      const allReady = Array.from(room.players.values())
        .filter(p => p.id !== room.hostId && p.token !== room.hostToken)
        .every(p => !!p.ready)
      io.to(code).emit('lobby:readyStatus', { allReady })
    })

    socket.on('question:show', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return

      const allReady = Array.from(room.players.values())
        .filter(p => p.id !== room.hostId && p.token !== room.hostToken)
        .every(p => !!p.ready)
      if (!allReady) {
        socket.emit('quiz:notReady', { message: 'Tous les joueurs ne sont pas prêts !' })
        return
      }

      const historyEntry = { id: payload?.id, prompt: payload?.prompt, type: payload?.type, results: {} }
      room.history.push(historyEntry)

      room.currentQuestion = { id: payload?.id, type: payload?.type, correct: payload?.correct || [], min: payload?.min, max: payload?.max, timerMs: payload?.timerMs || 15000, startTs: Date.now(), answered: new Set(), submissions: new Map(), pending: room.pending, singleAttempt: payload?.singleAttempt !== false, historyEntry }

      // Pour 'graduation', ne jamais diffuser la valeur cible : sinon elle est
      // lisible dans la frame WebSocket (devtools) avant même de répondre.
      const { correct, ...payloadWithoutCorrect } = payload || {}
      const broadcastPayload = payload?.type === 'graduation' ? payloadWithoutCorrect : payload

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
      }, room.currentQuestion.timerMs)
    })

    socket.on('answer:submit', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const q = room.currentQuestion
      if (!q) return
      if (Date.now() - q.startTs > q.timerMs) return
      if (q.answered?.has(socket.id)) return
      if (q.singleAttempt && q.submissions?.has(socket.id)) return
      socket.emit('answer:ack', { playerId: socket.id })

      // Compteur « X/Y ont répondu » pour l'écran de l'hôte : émis après chaque
      // soumission enregistrée (peu importe qu'elle soit juste, fausse ou en
      // attente de modération).
      const emitProgress = () => {
        const total = Array.from(room.players.values())
          .filter(p => p.id !== room.hostId && p.token !== room.hostToken).length
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
        // Pour les QCM (type 'mcq'), c'est binaire : si ce n'est pas EXACT, c'est FAUX.
        // On ne passe JAMAIS par la modération pour un QCM.
        if (q.type === 'mcq') {
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
      // quiz terminé) : on retire uniquement cette connexion de la liste. Sans ça,
      // les entrées fantômes s'accumulaient à chaque déconnexion (un joueur qui ne
      // se reconnectait jamais avec le même jeton restait affiché indéfiniment,
      // donnant l'impression d'un joueur dupliqué sur le classement/podium).
      if (room.players.delete(socket.id)) {
        const list = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '',
          score: room.scores.get(p.id) || 0,
          ready: !!p.ready,
          isHost: p.id === room.hostId || p.token === room.hostToken
        }))
        io.to(code).emit('lobby:list', list)
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
