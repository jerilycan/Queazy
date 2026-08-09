const path = require('path')
const Fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const { Server } = require('socket.io')
const { createClient } = require('@supabase/supabase-js')

// bodyLimit relevé (défaut Fastify 1 Mo) : /api/room-image accepte une image
// compressée en base64, /api/room-audio un clip audio recadré (voir plus bas)
// — plus lourd, d'où les 8 Mo (contre 5 initialement).
const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 8 * 1024 * 1024 })
const PORT = process.env.PORT || 3000

// Bump manuellement à chaque changement notable — affiché en discret dans un
// coin de la page (voir theme.js) via /server-info, juste pour repérer d'un
// coup d'œil si le déploiement en cours est bien à jour.
const APP_VERSION = '1.16.4'

// Client Supabase côté serveur, utilisé uniquement en lecture seule pour des
// réglages de jeu globaux (voir MIN_POINTS_FLOOR_DEFAULT plus bas). La clé
// anon est déjà publique (embarquée telle quelle côté client dans
// supabase-config.js) : aucun secret n'est introduit ici. Une variable
// d'environnement permet de la surcharger sans toucher au code si besoin.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://btlmhieavrvkznkrqrrm.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bG1oaWVhdnJ2a3pua3JxcnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTA0NjcsImV4cCI6MjA5ODU4NjQ2N30.cvcmBhLRzFobbvGc9ObQABOV43NlsOAlMW1Hxuppv0c'
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Plancher de points minimum garanti sur une bonne réponse répondue au
// dernier moment (voir pointsFor plus bas) — modifiable sans redéploiement
// via la table Supabase `app_settings` (clé 'min_points_floor', voir
// supabase/schema.sql). Rechargé périodiquement ; si la table est absente ou
// injoignable, cette valeur par défaut reste utilisée telle quelle.
const MIN_POINTS_FLOOR_DEFAULT = 300
const MIN_POINTS_FLOOR_SETTING_KEY = 'min_points_floor'
const MIN_POINTS_FLOOR_REFRESH_MS = 2 * 60 * 1000
let minPointsFloor = MIN_POINTS_FLOOR_DEFAULT

const refreshMinPointsFloor = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', MIN_POINTS_FLOOR_SETTING_KEY)
      .maybeSingle()
    if (error) throw error
    const n = Number(data?.value)
    if (Number.isFinite(n) && n >= 0 && n !== minPointsFloor) {
      app.log.info(`min_points_floor mis à jour depuis Supabase : ${minPointsFloor} -> ${n}`)
      minPointsFloor = n
    }
  } catch (err) {
    // Table pas encore créée, réseau indisponible, etc. : on garde la
    // dernière valeur connue (ou le défaut) plutôt que de faire échouer quoi
    // que ce soit côté jeu.
    app.log.warn(`min_points_floor: lecture Supabase impossible, valeur conservée (${minPointsFloor}) — ${err.message || err}`)
  }
}

// Réglage de partie "Importance de la rapidité" (voir room.speedLevel,
// game:setSpeedLevel) : 3 niveaux fixes, choisis au lobby par l'hôte comme le
// mode équipe (même pattern, voir team:setMode). 'normal' réutilise
// volontairement le plancher global ci-dessus (déjà configurable en base) :
// c'est la valeur par défaut affichée aux joueurs qui ne touchent jamais au
// réglage. 'low'/'high' sont des constantes fixes, pas encore pilotables
// depuis Supabase (pas demandé pour l'instant).
const SPEED_LEVEL_FLOOR = { low: 500, high: 100 }
const floorForSpeedLevel = (level) => {
  if (level === 'low') return SPEED_LEVEL_FLOOR.low
  if (level === 'high') return SPEED_LEVEL_FLOOR.high
  return minPointsFloor // 'normal', ou toute valeur absente/invalide
}

const publicDir = path.join(__dirname, '..', 'client', 'public')
app.register(fastifyStatic, { root: publicDir })

app.get('/health', async () => ({ ok: true }))

const quizzStore = new Map()
const uid = () => Math.random().toString(36).slice(2, 10)
const MAX_NAME_LENGTH = 20
// Délai de grâce avant de fermer la salle quand l'hôte se déconnecte — une
// coupure wifi de quelques secondes ne doit pas tuer la partie pour tout le
// monde. Voir le handler 'disconnect' et room:join (reconnexion via hostToken).
const HOST_GRACE_MS = 45 * 1000
// Filet de sécurité contre les salles oubliées en mémoire indéfiniment : le
// délai de grâce hôte ci-dessus couvre déjà le cas où le socket de l'hôte se
// déconnecte réellement, mais une salle dont l'onglet reste ouvert (wifi
// toujours actif, personne ne revient jamais) ne déclenche aucun événement
// 'disconnect' — rien ne la fermerait sinon. Voir sweepAbandonedRooms.
const ABANDONED_ROOM_MS = 3 * 60 * 60 * 1000 // 3h sans la moindre activité
const ROOM_SWEEP_INTERVAL_MS = 10 * 60 * 1000
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

  // Mode équipe : palette fixe (couleur + nom), réutilisée telle quelle côté
  // client (tile-red/tile-blue/... déjà dans style.css) — le serveur n'envoie
  // qu'une clé de couleur, jamais de valeur CSS. Plafonne à 6 équipes.
  const TEAM_PALETTE = [
    { color: 'red', name: 'Équipe Rouge' },
    { color: 'blue', name: 'Équipe Bleue' },
    { color: 'yellow', name: 'Équipe Jaune' },
    { color: 'green', name: 'Équipe Verte' },
    { color: 'cyan', name: 'Équipe Cyan' },
    { color: 'purple', name: 'Équipe Violette' }
  ]
  const MAX_TEAMS = TEAM_PALETTE.length

  // La partie a démarré dès que la première question a été envoyée —
  // room.currentQuestion n'est plus jamais remis à null ensuite (juste
  // remplacé par la question suivante), donc ce test reste vrai aussi
  // pendant l'écran de classement entre deux questions. Sert à verrouiller
  // la configuration des équipes une fois la partie lancée.
  const gameStarted = (room) => room.currentQuestion !== null

  const buildTeamList = (room) => Array.from(room.teams.values())

  const teamMemberCount = (room, teamId) =>
    activePlayers(room).filter(p => p.teamId === teamId).length

  // Équipe la moins fournie au moment de l'appel — sert à placer un joueur
  // qui rejoint après la répartition initiale (ou dont l'équipe n'existe
  // plus après une réduction du nombre d'équipes) sans jamais le laisser
  // sans équipe.
  const smallestTeamId = (room) => {
    let best = null, bestCount = Infinity
    for (const id of room.teams.keys()) {
      const c = teamMemberCount(room, id)
      if (c < bestCount) { bestCount = c; best = id }
    }
    return best
  }

  // Répartition équilibrée : mélange les joueurs actifs puis les distribue
  // en tourniquet sur les équipes existantes — pas un simple découpage en
  // tranches (qui grouperait les premiers arrivés ensemble à chaque fois).
  const shuffleAssignTeams = (room) => {
    const teamIds = Array.from(room.teams.keys())
    if (teamIds.length === 0) return
    const players = activePlayers(room)
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[players[i], players[j]] = [players[j], players[i]]
    }
    players.forEach((p, i) => { p.teamId = teamIds[i % teamIds.length] })
  }

  // room.players porte le teamId "vivant" (source de vérité pendant que le
  // joueur est connecté) ; room.tokens est ce qui survit à une déconnexion
  // et permet de le restaurer à la reconnexion (voir room:join) — les deux
  // doivent donc rester synchronisés après toute réassignation en masse.
  const syncTeamIdsToTokens = (room) => {
    for (const p of room.players.values()) {
      if (!p.token) continue
      const tok = room.tokens.get(p.token)
      if (tok) room.tokens.set(p.token, { ...tok, teamId: p.teamId || null })
    }
  }

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
    connected: p.connected !== false,
    teamId: p.teamId || null
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
    // Delta de points réellement gagné à cette question (0/absent si aucun
    // point) — traduit token -> id courant comme results ci-dessus. Sert au
    // podium final (page résultats) pour rejouer la progression question par
    // question au lieu d'une simple animation cosmétique.
    const idDeltas = {}
    for (const [tok, val] of Object.entries(h.deltas || {})) {
      const t = room.tokens.get(tok)
      if (t) idDeltas[t.id] = val
    }
    return { id: h.id, prompt: h.prompt, type: h.type, results: idResults, deltas: idDeltas }
  })

  // Petit récap affiché côté hôte juste après la révélation (voir
  // question.endQuestion) : "X% ont trouvé" + la réponse la plus donnée,
  // utile pour rebondir à l'oral. Se base sur historyEntry.results (déjà
  // rempli pour TOUS les tokens de room.tokens au moment de la clôture, y
  // compris "incorrect" pour qui n'a pas répondu — voir endQuestion) pour le
  // %, et sur historyEntry.answers (texte brut soumis, uniquement
  // enregistré pour les types à réponse textuelle courte :
  // mcq/truefalse/free/blindtest) pour la réponse la plus donnée. Ne
  // concerne pas "order"/"image" (pas de texte comparable) : le % reste
  // calculé, juste pas de "réponse la plus donnée" pour ces types-là.
  // room.tokens contient AUSSI le token de l'hôte lui-même (il rejoint la
  // salle via room:join comme un joueur, voir plus bas) : sans l'exclure
  // explicitement ici, il compterait à tort comme un "incorrect"
  // supplémentaire et fausserait le %.
  const buildRecap = (room, question) => {
    const he = question?.historyEntry
    if (!he) return null
    const entries = Object.entries(he.results || {}).filter(([tok]) => tok !== room.hostToken)
    const total = entries.length
    if (total === 0) return null
    const correct = entries.filter(([, v]) => v === 'correct').length
    const correctPct = Math.round((100 * correct) / total)

    let topAnswer = null
    const counts = new Map() // clé normalisée -> { text, count }
    for (const [tok, raw] of Object.entries(he.answers || {})) {
      if (tok === room.hostToken) continue
      if (typeof raw !== 'string') continue
      const trimmed = raw.trim()
      if (!trimmed) continue
      const key = norm(trimmed)
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { text: trimmed, count: 1 })
    }
    let best = null
    for (const entry of counts.values()) {
      if (!best || entry.count > best.count) best = entry
    }
    // N'affiche "la réponse la plus donnée" que si au moins 2 joueurs sont
    // vraiment tombés d'accord — sinon ce serait juste "la première réponse
    // au hasard parmi des réponses toutes différentes", pas une vraie tendance.
    if (best && best.count >= 2) topAnswer = { text: best.text, count: best.count }

    return { id: question.id, type: question.type, correct, total, correctPct, topAnswer }
  }

  // Diffuse la bonne réponse (+ le récap juste avant) à toute la salle.
  // Point de sortie UNIQUE vers la révélation, appelé soit directement à la
  // fermeture du chrono (endQuestion, si rien n'attend de modération), soit
  // plus tard dès que la modération d'une question à texte libre/blindtest
  // se termine (voir resolveBlindTestField / moderation:approve / reject) —
  // avant, ce second cas sautait purement et simplement la révélation
  // (comportement `moderation:finished`), ce qui laissait les joueurs sans
  // jamais connaître la bonne réponse pour ces questions-là.
  const revealQuestion = (io, code, room, question) => {
    const recap = buildRecap(room, question)
    if (recap) io.to(code).emit('question:recap', recap)
    // "timeline" : q.correct n'est pas forcément trié (voir answer:submit,
    // qui retrie systématiquement par date plutôt que de faire confiance à
    // l'ordre de stockage) — la révélation doit montrer le VRAI ordre
    // chronologique, pas l'ordre de saisie du créateur.
    const revealCorrect = question.type === 'timeline' && Array.isArray(question.correct)
      ? [...question.correct].sort((a, b) => Number(a?.date) - Number(b?.date))
      : question.correct
    io.to(code).emit('question:reveal', {
      id: question.id,
      type: question.type,
      correct: revealCorrect,
      explanation: question.explanation || '',
      target: question.type === 'graduation' ? question.correct?.[0] : undefined,
      tolerance: question.type === 'graduation' ? (question.tolerance ?? GRAD_CORRECT_ABS_TOLERANCE_DEFAULT) : undefined
    })
  }

  app.get('/server-info', async (req) => ({ url: getBaseUrl(req.headers), port: PORT, version: APP_VERSION }))

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

  // Question "blind test" : même principe que /api/room-image ci-dessus (pas
  // de gros blob dans une frame websocket), pour le clip audio déjà recadré
  // par le créateur (voir editor.js, encodé en WAV mono côté client). Cap plus
  // large que l'image (~4,5 Mo de binaire) : même un extrait recadré à 30s
  // reste bien plus lourd qu'une photo compressée.
  app.post('/api/room-audio/:code', async (req, reply) => {
    const room = rooms.get(req.params.code)
    if (!room) return reply.code(404).send({ error: 'room_not_found' })
    const audio = req.body?.audio
    if (typeof audio !== 'string' || !/^data:audio\/(wav|x-wav|mpeg|mp3|ogg|webm|mp4);base64,/i.test(audio) || audio.length > 6_000_000) {
      return reply.code(400).send({ error: 'invalid_audio' })
    }
    room.pendingAudio = audio
    return { ok: true }
  })

  app.get('/api/room-audio/:code', async (req, reply) => {
    const room = rooms.get(req.params.code)
    const dataUri = room?.pendingAudio
    if (!dataUri) return reply.code(404).send()
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
    if (!match) return reply.code(404).send()
    reply.header('Cache-Control', 'no-store')
    reply.type(match[1])
    return Buffer.from(match[2], 'base64')
  })

  await refreshMinPointsFloor()
  setInterval(refreshMinPointsFloor, MIN_POINTS_FLOOR_REFRESH_MS)

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
  // Composante "vitesse" du score : décroissance LINÉAIRE et CONTINUE (pas de
  // palier) de `base` (réponse quasi instantanée) jusqu'à `floor` (réglage de
  // partie "Importance de la rapidité", voir floorForSpeedLevel), atteint
  // exactement à la fin de la fenêtre de réponse RÉELLE de la question
  // (`timerMs`) — et non plus un taux fixe indépendant de la durée
  // configurée : avant, `floor` était touché après une durée fixe (ex.
  // 14000ms pour floor=300), sans lien avec un timerMs de 15s, 30s ou 60s,
  // ce qui aplatissait le score bien avant la fin du chrono dès que la
  // question durait plus que ça. Ici, ça marche pareil quelle que soit la
  // durée choisie par le créateur pour CETTE question.
  // Un seul Math.round final : toujours un entier, jamais de double
  // arrondi qui dérive.
  const pointsFor = (startTs, now, timerMs, floor = minPointsFloor, base = 1000) => {
    const duration = Math.max(1, Number(timerMs) || 15000)
    const elapsed = Math.min(duration, Math.max(0, now - startTs))
    const t = elapsed / duration
    return Math.round(base - (base - floor) * t)
  }
  // Écart ABSOLU (pas un pourcentage de l'intervalle min/max) pour dire
  // "Bonne réponse !" au lieu de "Presque !" — un seuil en % de l'intervalle
  // (ancienne version : 0.8, 20% de tolérance) donnait une marge d'erreur
  // réelle qui explosait dès que le curseur était large (ex. 0-100 pour une
  // réponse factuelle à un ou deux chiffres), sans rapport avec la précision
  // réellement attendue. Configurable par question depuis l'éditeur
  // (q.tolerance) ; cette constante ne sert plus que de valeur de repli pour
  // les quiz sauvegardés avant l'ajout de ce champ (question.tolerance null).
  // 0 = seule la valeur exacte compte comme "Bonne réponse !".
  const GRAD_CORRECT_ABS_TOLERANCE_DEFAULT = 0
  // Les scores "graduation"/"image" sont continus (proximité 0-1) : sans
  // courbe, un "presque" à closeness=0.9 touchait encore 90% des points,
  // trop proche d'une réponse parfaite. On élève la proximité à une
  // puissance > 1 avant de la multiplier aux points de vitesse : ça ne
  // change rien à closeness=1 (toujours 100%), mais creuse l'écart pour
  // tout ce qui n'est pas exact (0.9 -> 81%, 0.7 -> 49%, 0.5 -> 25%).
  const CLOSENESS_EXPONENT = 2
  // Réactions "fun" pendant l'attente de validation d'une réponse libre (voir
  // index.js showModerationWait) : liste blanche stricte (jamais de contenu
  // arbitraire relayé à toute la salle) + cooldown par socket pour éviter
  // qu'un seul joueur ne spam la même réaction en boucle.
  const FUN_REACTION_EMOJIS = ['🎉', '👏', '🔥', '😂', '❤️']
  const REACTION_COOLDOWN_MS = 500
  // Question "image" : le joueur clique directement sur l'image (coordonnées
  // normalisées 0-1, pas de grille — voir index.js) ; le créateur définit une
  // ou plusieurs zones de forme libre tracées à main levée (idem, voir
  // editor.js et client/public/js/zone-geometry.js — copie Node de ces mêmes
  // fonctions ci-dessous, ce fichier n'a pas accès aux <script> du client).
  // Distance du point cliqué au bord de la zone la plus proche (0 si dedans),
  // en unités normalisées : au-delà de ce seuil (30% de la largeur/hauteur de
  // l'image), la proximité ne rapporte plus rien.
  const IMAGE_PROXIMITY_MAX_DIST = 0.3

  // Une zone stockée est soit un polygone { points:[{x,y},...] } (nouveau
  // format, tracé à main levée), soit un rectangle legacy { x0,y0,x1,y1 }
  // (anciens quiz) — ramené à une liste de points communs pour que le reste
  // du calcul n'ait jamais à distinguer les deux formats.
  const zoneToPolygonPoints = (zone) => {
    if (!zone) return []
    if (Array.isArray(zone.points)) return zone.points
    if (typeof zone.x0 === 'number' && typeof zone.y0 === 'number' && typeof zone.x1 === 'number' && typeof zone.y1 === 'number') {
      return [
        { x: zone.x0, y: zone.y0 },
        { x: zone.x1, y: zone.y0 },
        { x: zone.x1, y: zone.y1 },
        { x: zone.x0, y: zone.y1 }
      ]
    }
    return []
  }
  const pointInPolygon = (pt, points) => {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y
      const xj = points[j].x, yj = points[j].y
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }
  const pointToSegmentDist = (pt, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
    let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy))
  }
  const distPointToPolygon = (pt, points) => {
    if (points.length < 3) return Infinity
    if (pointInPolygon(pt, points)) return 0
    let min = Infinity
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length]
      const d = pointToSegmentDist(pt, a, b)
      if (d < min) min = d
    }
    return min
  }

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
    const hasTiles = payload?.type === 'mcq' || payload?.type === 'truefalse' || payload?.type === 'order' || payload?.type === 'intrus'
    const tileCount = hasTiles && Array.isArray(payload?.options) ? Math.max(1, payload.options.length) : 1
    const staggerSpan = hasTiles ? (tileCount - 1) * REVEAL_STAGGER_MS : 0
    // "free" et "blindtest" n'ont ni tuiles à faire apparaître une à une ni
    // animation à attendre (un ou deux champs texte) : le tampon de fin
    // d'animation ne sert donc à rien pour ces types, contrairement aux
    // autres — on ne garde que le temps de lecture de la question.
    const isFree = payload?.type === 'free' || payload?.type === 'blindtest'
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
        ended: false,
        teamMode: false,
        teams: new Map(),
        hostDisconnectedAt: null,
        lastActivityAt: Date.now(), // voir sweepAbandonedRooms plus bas
        speedLevel: 'normal' // voir game:setSpeedLevel / floorForSpeedLevel
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
      room.lastActivityAt = Date.now() // voir sweepAbandonedRooms

      // Si c'est l'hôte qui se reconnecte
      if (token === room.hostToken) {
        room.hostId = socket.id
        // hostDisconnectedAt n'est posé que par le handler 'disconnect' lors
        // d'une VRAIE coupure (voir plus bas) — pas lors du tout premier
        // room:join qui suit room:create (flux normal de création de salle).
        // Ça permet de ne prévenir les joueurs d'un retour de l'hôte que
        // quand ils ont effectivement été avertis d'un décrochage.
        if (room.hostDisconnectedAt) {
          room.hostDisconnectedAt = null
          io.to(code).emit('host:reconnected')
        }
      }

      const existing = room.tokens.get(token)
      const isHostJoining = token === room.hostToken
      let player
      if (existing) {
        room.players.delete(existing.id)
        player = { id: socket.id, name: existing.name || name, score: existing.score || 0, token, avatar: payload?.avatar || existing.avatar || '', ready: false, connected: true, teamId: existing.teamId || null }
        room.players.set(socket.id, player)
        room.scores.set(socket.id, existing.score || 0)
      } else {
        player = { id: socket.id, name, score: 0, token, avatar: payload?.avatar || '', ready: false, connected: true, teamId: null }
        room.players.set(socket.id, player)
        room.scores.set(socket.id, 0)
      }
      // Un joueur (hors hôte) qui rejoint pendant que le mode équipe est déjà
      // actif — nouveau joueur ou reconnexion d'un joueur dont l'équipe
      // aurait entre-temps disparu (réduction du nombre d'équipes) — est
      // placé sur l'équipe la moins fournie plutôt que de rester sans équipe.
      if (room.teamMode && !isHostJoining && (!player.teamId || !room.teams.has(player.teamId))) {
        player.teamId = smallestTeamId(room)
      }
      room.tokens.set(token, { id: socket.id, name, score: room.scores.get(socket.id), teamId: player.teamId })

      await socket.join(code)
      socket.emit('player:token', { token })
      io.to(code).emit('player:joined', { id: socket.id, name })

      // Diffusé à toute la salle (pas seulement à ce socket) : voir
      // buildHistorySync, un mapping token->id envoyé à un seul viewer devient
      // faux dès qu'un AUTRE joueur se reconnecte ensuite.
      if (room.history.length > 0) {
        io.to(code).emit('history:sync', { history: buildHistorySync(room) })
      }

      io.to(code).emit('team:list', { teamMode: room.teamMode, teams: buildTeamList(room) })
      io.to(code).emit('game:speedLevel', { level: room.speedLevel })
      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })

      // Rattrapage : une question est déjà active au moment où ce socket
      // (re)rejoint — reconnexion en pleine partie, le cas le plus fréquent,
      // mais ça couvre aussi un nouveau joueur qui rejoint en retard. Sans
      // ça, il restait bloqué sur l'écran salon d'attente jusqu'à la
      // question SUIVANTE, sans jamais pouvoir répondre à celle en cours —
      // alors que le serveur, lui, acceptait déjà sa réponse si on la lui
      // envoyait directement (juste jamais présentée dans l'UI). On ne
      // renvoie rien si la question est déjà terminée (ended, ou chrono
      // écoulé) : elle est alors en phase de révélation/classement, un tout
      // autre écran qu'un simple resend de question:show rendrait faux.
      const q = room.currentQuestion
      if (q && !q.ended && Date.now() < q.startTs + q.timerMs && q.showPayload) {
        socket.emit('question:show', q.showPayload)
      }
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
      if (tok) room.tokens.set(p.token, { id: socket.id, name: p.name, score: room.scores.get(socket.id) || 0, teamId: p.teamId || null })
      io.to(code).emit('lobby:list', buildPlayerList(room))
      io.to(code).emit('lobby:readyStatus', { allReady: computeAllReady(room) })
    })

    // --- Mode équipe (salon d'attente uniquement, voir gameStarted) ---

    socket.on('team:setMode', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || room.hostId !== socket.id || gameStarted(room)) return

      if (!payload?.enabled) {
        room.teamMode = false
        room.teams.clear()
        for (const p of room.players.values()) p.teamId = null
      } else {
        const count = Math.min(MAX_TEAMS, Math.max(2, Number(payload?.count) || 2))
        room.teamMode = true
        room.teams.clear()
        for (let i = 0; i < count; i++) {
          const { color, name } = TEAM_PALETTE[i]
          room.teams.set('t' + i, { id: 't' + i, name, color })
        }
        shuffleAssignTeams(room)
      }
      syncTeamIdsToTokens(room)
      io.to(code).emit('team:list', { teamMode: room.teamMode, teams: buildTeamList(room) })
      io.to(code).emit('lobby:list', buildPlayerList(room))
    })

    socket.on('team:autoAssign', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || room.hostId !== socket.id || gameStarted(room) || !room.teamMode) return
      shuffleAssignTeams(room)
      syncTeamIdsToTokens(room)
      io.to(code).emit('lobby:list', buildPlayerList(room))
    })

    // Fait passer un joueur à l'équipe suivante de la palette (retour au
    // début après la dernière) — réassignation manuelle simple par clic sur
    // son badge d'équipe, plutôt qu'un glisser-déposer entre colonnes.
    socket.on('team:cyclePlayer', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || room.hostId !== socket.id || gameStarted(room) || !room.teamMode) return
      const p = room.players.get(payload?.playerId)
      if (!p || p.id === room.hostId) return
      const teamIds = Array.from(room.teams.keys())
      if (teamIds.length === 0) return
      const idx = teamIds.indexOf(p.teamId)
      p.teamId = teamIds[(idx + 1) % teamIds.length]
      const tok = room.tokens.get(p.token)
      if (tok) room.tokens.set(p.token, { ...tok, teamId: p.teamId })
      io.to(code).emit('lobby:list', buildPlayerList(room))
    })

    // Réglage de partie "Importance de la rapidité" (voir floorForSpeedLevel
    // plus haut) — même pattern que team:setMode : hôte uniquement, verrouillé
    // dès que la partie est lancée (le niveau choisi doit rester le même pour
    // TOUTES les questions d'une même partie, pas de changement en cours de
    // route). Broadcasté à toute la salle (hôte + joueurs) pour affichage
    // synchronisé, même si le calcul du score lui-même ne dépend jamais de ce
    // que le client affiche : voir question.pointsFloor, résolu côté serveur
    // au moment de question:show.
    socket.on('game:setSpeedLevel', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || room.hostId !== socket.id || gameStarted(room)) return
      const level = ['low', 'normal', 'high'].includes(payload?.level) ? payload.level : 'normal'
      room.speedLevel = level
      io.to(code).emit('game:speedLevel', { level })
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
      room.lastActivityAt = Date.now() // voir sweepAbandonedRooms

      if (!computeAllReady(room)) {
        socket.emit('quiz:notReady', { message: 'Tous les joueurs ne sont pas prêts !' })
        return
      }

      const historyEntry = { id: payload?.id, prompt: payload?.prompt, type: payload?.type, results: {}, deltas: {}, answers: {} }
      room.history.push(historyEntry)

      const revealMs = computeRevealMs(payload)
      // Référence stable (pas juste room.currentQuestion, qui sera écrasé par
      // la question SUIVANTE dès que l'hôte enchaîne) : indispensable pour
      // que endQuestion (déclenché soit par le minuteur, soit en avance dès
      // que tout le monde a répondu — voir emitProgress dans answer:submit)
      // referme toujours la BONNE question, même s'il se déclenche tard.
      // tolerance : écart accepté comme "Bonne réponse !" pour le type
      // graduation (voir GRAD_CORRECT_ABS_TOLERANCE_DEFAULT plus bas, valeur
      // de repli si absente/invalide — ex. un vieux quiz sauvegardé avant
      // l'ajout de ce champ). Jamais négative.
      // pointsFloor : résolu UNE FOIS ici depuis le réglage de partie
      // room.speedLevel (voir floorForSpeedLevel) plutôt qu'à chaque
      // answer:submit — garantit que tous les joueurs de cette question
      // reçoivent exactement le même calcul, même si l'hôte changeait le
      // réglage entre deux questions (ce que le client bloque déjà une fois
      // la partie lancée, voir game:setSpeedLevel, mais on ne fait jamais
      // confiance qu'au serveur pour ça).
      const question = { id: payload?.id, type: payload?.type, correct: payload?.correct || [], explanation: payload?.explanation || '', min: payload?.min, max: payload?.max, tolerance: Number.isFinite(Number(payload?.tolerance)) ? Math.max(0, Number(payload.tolerance)) : null, timerMs: payload?.timerMs || 15000, pointsFloor: floorForSpeedLevel(room.speedLevel), startTs: Date.now() + revealMs, answered: new Set(), submissions: new Map(), pending: room.pending, singleAttempt: payload?.singleAttempt !== false, historyEntry, ended: false }
      room.currentQuestion = question

      // Pour 'graduation', ne jamais diffuser la valeur cible : sinon elle est
      // lisible dans la frame WebSocket (devtools) avant même de répondre.
      // 'explanation' est retiré pour TOUS les types, même raison : elle
      // spoilerait souvent la réponse si elle était visible avant le reveal.
      // 'association'/'timeline' : q.correct porte les paires/dates réelles —
      // jamais diffusé tel quel (les colonnes/cartes mélangées voyagent dans
      // des champs séparés, voir emitQuestion côté client, eux non filtrés).
      const { correct, explanation, ...payloadWithoutCorrectOrExplanation } = payload || {}
      const broadcastPayload = (payload?.type === 'graduation' || payload?.type === 'order' || payload?.type === 'image' || payload?.type === 'blindtest' || payload?.type === 'association' || payload?.type === 'timeline')
        ? payloadWithoutCorrectOrExplanation
        : { ...payloadWithoutCorrectOrExplanation, correct }

      // Diffusé immédiatement (pas au bout de revealMs) : chaque client anime
      // lui-même la révélation de la question/des tuiles jusqu'à startTs, pour
      // que l'hôte (écran principal) et les joueurs la voient au même moment.
      // Gardé sur la question (voir room:join) : un socket qui (re)rejoint
      // PENDANT que cette question est active n'a sinon plus jamais l'occasion
      // de la voir — startTs étant un horodatage absolu, le repasser tel quel
      // à un arrivant tardif recale automatiquement son chrono côté client
      // (pas besoin de recalculer un temps restant à la main).
      question.showPayload = { ...broadcastPayload, singleAttempt: question.singleAttempt, startTs: question.startTs }
      io.to(code).emit('question:show', question.showPayload)

      // Termine la question : à la fin normale du chrono (setTimeout ci-
      // dessous), OU en avance dès que tout le monde a répondu (voir
      // emitProgress dans answer:submit, qui appelle question.endQuestion()).
      // "ended" protège contre un double déclenchement (le setTimeout est
      // annulé dans le second cas, mais mieux vaut ne jamais dépendre que de
      // ça).
      question.endQuestion = () => {
        if (question.ended) return
        question.ended = true
        clearTimeout(question.timeoutId)

        // Tout token sans résultat pour cette question à la fermeture n'a
        // simplement pas répondu (couvre aussi une soumission graduation
        // avec des bornes invalides, déjà ignorée silencieusement côté
        // scoring).
        for (const [token] of room.tokens) {
          if (!(token in historyEntry.results)) historyEntry.results[token] = 'incorrect'
        }

        io.to(code).emit('timer:end', { id: question.id })

        // Si une réponse texte libre est encore en attente de validation par
        // l'hôte, on ne révèle pas tout de suite : voir revealQuestion, elle
        // sera appelée dès que la modération de CETTE question sera terminée
        // (voir resolveBlindTestField / moderation:approve / moderation:reject
        // plus bas) — jamais sautée pour de bon comme c'était le cas avant.
        if (room.pending.size === 0) revealQuestion(io, code, room, question)
      }
      question.timeoutId = setTimeout(question.endQuestion, revealMs + question.timerMs)
    })

    socket.on('answer:submit', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      room.lastActivityAt = Date.now() // voir sweepAbandonedRooms
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
      // attente de modération). Point de passage commun à TOUTES les branches
      // de ce handler (chacune l'appelle juste après avoir enregistré une
      // soumission) : c'est donc l'endroit naturel pour enchaîner sur la
      // révélation dès que tout le monde a répondu, sans attendre la fin du
      // chrono.
      const emitProgress = () => {
        const total = activePlayers(room).length
        const answered = q.submissions?.size || 0
        io.to(code).emit('answer:progress', { answered, total })
        if (total > 0 && answered >= total) q.endQuestion?.()
      }

      if (q.type === 'graduation') {
        const guess = Number(payload?.content)
        const min = Number(q.min), max = Number(q.max)
        const target = Number(q.correct?.[0])
        if (!Number.isFinite(guess) || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(target) || min >= max) return
        const clamped = Math.min(max, Math.max(min, guess))
        const range = Math.max(1e-9, max - min)
        const closeness = Math.max(0, 1 - Math.abs(clamped - target) / range)
        const delta = Math.round(pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor) * (closeness ** CLOSENESS_EXPONENT))
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          if (q.historyEntry) {
            const tolerance = q.tolerance ?? GRAD_CORRECT_ABS_TOLERANCE_DEFAULT
            q.historyEntry.results[p.token] = Math.abs(clamped - target) <= tolerance ? 'correct' : 'incorrect'
            q.historyEntry.deltas[p.token] = delta
          }
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      if (q.type === 'image') {
        // Distance jusqu'à la zone de bonne réponse la plus proche (une ou
        // plusieurs formes libres tracées à main levée par le créateur, ou
        // rectangles legacy {x0,y0,x1,y1} pour les anciens quiz — coordonnées
        // normalisées 0-1, voir zoneToPolygonPoints) -> facteur de proximité,
        // même principe que la tolérance de "graduation". Le joueur clique
        // directement sur l'image (point normalisé, pas de grille) : dans
        // n'importe laquelle des zones -> distance 0 -> points max ; en
        // dehors -> ça dégrade selon l'écart au bord le plus proche.
        let point
        try { point = JSON.parse(payload?.content || 'null') } catch { point = null }
        const zones = (Array.isArray(q.correct) ? q.correct : []).map(z => zoneToPolygonPoints(z)).filter(pts => pts.length >= 3)
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || zones.length === 0) return
        const dist = Math.min(...zones.map(pts => distPointToPolygon(point, pts)))
        const closeness = Math.max(0, 1 - dist / IMAGE_PROXIMITY_MAX_DIST)
        const delta = Math.round(pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor) * (closeness ** CLOSENESS_EXPONENT))
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          if (q.historyEntry) {
            q.historyEntry.results[p.token] = dist === 0 ? 'correct' : 'incorrect'
            q.historyEntry.deltas[p.token] = delta
          }
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      if (q.type === 'association') {
        // q.correct = [{a,b}, ...] (voir question:show) : la paire i associe
        // TOUJOURS a[i] à b[i] par construction — pas besoin de retrouver un
        // index après mélange, la comparaison se fait par le TEXTE b soumis
        // pour la position i (voir emitQuestion côté client : seule la
        // colonne B est mélangée avant envoi, la colonne A garde son ordre
        // d'origine, qui sert justement d'index stable ici). Score
        // proportionnel au nombre de paires correctes (pas de tout-ou-rien,
        // demande explicite) : pointsFor() × (correctCount / total).
        let submitted
        try { submitted = JSON.parse(payload?.content || '[]') } catch { submitted = null }
        const pairs = Array.isArray(q.correct) ? q.correct : []
        if (!Array.isArray(submitted) || pairs.length === 0) return
        const pairTotal = pairs.length
        // .slice(0, pairTotal) : un client qui enverrait un tableau plus long
        // ne peut pas gagner plus que pairTotal correspondances — la boucle
        // ne regarde jamais au-delà de la vraie liste de paires de toute façon.
        const correctCount = pairs.reduce((acc, pair, i) => acc + (submitted[i] === pair.b ? 1 : 0), 0)
        const fraction = Math.max(0, Math.min(1, correctCount / pairTotal))
        const delta = Math.round(pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor) * fraction)
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          if (q.historyEntry) {
            // Label binaire pour le récap/podium (comme graduation/image) :
            // "correct" seulement si TOUTES les paires sont bonnes, même si
            // le score, lui, reste proportionnel.
            q.historyEntry.results[p.token] = correctCount === pairTotal ? 'correct' : 'incorrect'
            q.historyEntry.deltas[p.token] = delta
          }
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      if (q.type === 'blindtest') {
        // Deux champs indépendants (titre / artiste) : champ VIDE -> raté
        // direct (le joueur n'a pas tenté ce champ, rien à soumettre au
        // jugement de l'hôte) ; champ rempli et EXACTEMENT identique à une
        // réponse acceptée -> validé tout de suite, pas besoin de déranger
        // l'hôte ; champ rempli mais pas une correspondance exacte -> TOUJOURS
        // en attente de modération PAR CHAMP (l'hôte tranche titre et artiste
        // séparément), même si la distance à la réponse attendue est grande —
        // avant, un champ jugé "trop différent" par fuzzy() était rejeté
        // automatiquement sans jamais passer par l'hôte, qui ne voyait donc
        // jamais les réponses qu'il aurait pourtant pu vouloir valider à la
        // main (typo réelle, orthographe alternative, etc.). Chaque champ
        // vaut la moitié des points "vitesse" habituels (pointsFor) : 100% si
        // les deux sont bons, 50% si un seul, 0% sinon.
        let content
        try { content = JSON.parse(payload?.content || 'null') } catch { content = null }
        const titleInput = typeof content?.title === 'string' ? content.title : ''
        const artistInput = typeof content?.artist === 'string' ? content.artist : ''
        const acceptedTitle = Array.isArray(q.correct?.title) ? q.correct.title : []
        const acceptedArtist = Array.isArray(q.correct?.artist) ? q.correct.artist : []

        const submitTs = Date.now()
        const halfDelta = Math.round(pointsFor(q.startTs, submitTs, q.timerMs, q.pointsFloor) / 2)

        const evalField = (input, accepted) => {
          if (!input.trim()) return 'incorrect'
          if (!accepted.length) return 'pending' // pas de réponse "officielle" définie : à l'hôte de juger
          const res = fuzzy(input, accepted)
          if (res.ok && res.exact) return 'correct'
          return 'pending'
        }
        const titleStatus = evalField(titleInput, acceptedTitle)
        const artistStatus = evalField(artistInput, acceptedArtist)

        const p = room.players.get(socket.id)
        let deltaApplied = 0
        for (const status of [titleStatus, artistStatus]) {
          if (status !== 'correct') continue
          deltaApplied += halfDelta
        }
        let total = room.scores.get(socket.id) || 0
        if (deltaApplied > 0) {
          total += deltaApplied
          room.scores.set(socket.id, total)
          if (p?.token) room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          io.to(code).emit('score:update', { playerId: socket.id, delta: deltaApplied, total })
        }
        // Un des deux champs peut encore partir en modération juste en-dessous
        // (delta additionnel à venir plus tard, voir resolveBlindTestField) :
        // on initialise/complète quand même dès maintenant avec ce qui est déjà
        // acquis, plutôt que d'écraser une valeur posée par l'autre champ.
        if (p?.token && q.historyEntry) {
          q.historyEntry.deltas[p.token] = (q.historyEntry.deltas[p.token] || 0) + deltaApplied
          // Seul le titre sert au récap hôte ("réponse la plus donnée") —
          // l'artiste n'y participe pas, deux champs combinés dans une seule
          // statistique n'auraient pas de sens.
          if (titleInput.trim()) q.historyEntry.answers[p.token] = titleInput
        }

        q.submissions?.set(socket.id, `${socket.id}:${submitTs}`)

        if (titleStatus === 'pending' || artistStatus === 'pending') {
          const answerId = `${socket.id}:${submitTs}`
          const fields = {
            title: { content: titleInput, status: titleStatus },
            artist: { content: artistInput, status: artistStatus }
          }
          // token en plus de playerId : si ce joueur se reconnecte (nouveau
          // socket.id) avant que l'hôte ne tranche ce champ, on doit pouvoir
          // retrouver SON entrée actuelle plutôt que créditer un socket.id
          // périmé que plus personne ne lit (voir resolvePendingId).
          room.pending.set(answerId, { playerId: socket.id, token: p?.token || null, ts: submitTs, historyEntry: q.historyEntry, halfDelta, fields })
          io.to(code).emit('answer:queue', { answerId, playerId: socket.id, blindtest: true, fields })
          emitProgress()
          return
        }

        // Les deux champs sont déjà tranchés (correct ou incorrect) : rien à
        // envoyer en modération, le résultat final est connu tout de suite.
        q.answered?.add(socket.id)
        if (p?.token && q.historyEntry) {
          q.historyEntry.results[p.token] = (titleStatus === 'correct' && artistStatus === 'correct') ? 'correct' : 'incorrect'
        }
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
          const delta = pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor)
          const total = (room.scores.get(socket.id) || 0) + delta
          room.scores.set(socket.id, total)
          if (p?.token) {
            room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
            if (q.historyEntry) {
              q.historyEntry.results[p.token] = 'correct'
              q.historyEntry.deltas[p.token] = delta
            }
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

      if (q.type === 'timeline') {
        // q.correct = [{title, description, date}, ...] dans l'ordre de
        // saisie du créateur (PAS forcément trié) — l'ordre chronologique
        // correct est toujours recalculé ici à partir de "date" plutôt que
        // supposé déjà trié, pour rester robuste même sur un vieux quiz
        // sauvegardé avant un éventuel bug de tri côté éditeur.
        // "key" = index ORIGINAL dans q.correct (voir emitQuestion côté
        // client, colonne mélangée par titre+description seulement, jamais
        // par date) : le joueur soumet la séquence de clés dans l'ordre où
        // il a placé les cartes. Un événement est "correctement placé" si sa
        // position dans sa soumission correspond à sa position dans l'ordre
        // chronologique réel — pas de tout-ou-rien, score proportionnel au
        // nombre d'événements bien placés (demande explicite).
        let submitted
        try { submitted = JSON.parse(payload?.content || '[]') } catch { submitted = null }
        const events = Array.isArray(q.correct) ? q.correct : []
        if (!Array.isArray(submitted) || events.length === 0) return
        const n = events.length
        const correctOrderKeys = events
          .map((e, i) => i)
          .sort((a, b) => Number(events[a]?.date) - Number(events[b]?.date))
        const correctPositionOfKey = new Map(correctOrderKeys.map((key, pos) => [key, pos]))
        let correctCount = 0
        submitted.slice(0, n).forEach((key, pos) => {
          if (correctPositionOfKey.get(key) === pos) correctCount++
        })
        const fraction = Math.max(0, Math.min(1, correctCount / n))
        const delta = Math.round(pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor) * fraction)
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          if (q.historyEntry) {
            q.historyEntry.results[p.token] = correctCount === n ? 'correct' : 'incorrect'
            q.historyEntry.deltas[p.token] = delta
          }
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'graded')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
        return
      }

      const res = fuzzy(payload?.content || '', q.correct)

      if (res.ok && res.exact) {
        const delta = pointsFor(q.startTs, Date.now(), q.timerMs, q.pointsFloor)
        const total = (room.scores.get(socket.id) || 0) + delta
        room.scores.set(socket.id, total)
        const p = room.players.get(socket.id)
        if (p?.token) {
          room.tokens.set(p.token, { id: socket.id, name: p.name, score: total, teamId: p.teamId || null })
          if (q.historyEntry) {
            q.historyEntry.results[p.token] = 'correct'
            q.historyEntry.deltas[p.token] = delta
            q.historyEntry.answers[p.token] = payload?.content || ''
          }
        }
        q.answered?.add(socket.id)
        q.submissions?.set(socket.id, 'correct')
        io.to(code).emit('score:update', { playerId: socket.id, delta, total })
        emitProgress()
      } else {
        // Pour les QCM ('mcq'), Vrai/Faux ('truefalse') et Intrus ('intrus'),
        // c'est binaire : si ce n'est pas EXACT, c'est FAUX. On ne passe
        // JAMAIS par la modération. "intrus" réutilise entièrement ce chemin
        // (une seule bonne réponse dans q.correct, comme truefalse) plutôt
        // que d'ajouter un système dédié — le chemin "correct" juste au-dessus
        // (res.ok && res.exact) est déjà 100% générique, aucun changement
        // requis là-bas.
        if (q.type === 'mcq' || q.type === 'truefalse' || q.type === 'intrus') {
          q.submissions?.set(socket.id, 'incorrect')
          const p = room.players.get(socket.id)
          if (p?.token && q.historyEntry) {
            q.historyEntry.results[p.token] = 'incorrect'
            q.historyEntry.answers[p.token] = payload?.content || ''
          }
          emitProgress()
          return
        }

        const prevId = q.submissions?.get(socket.id)
        if (!q.singleAttempt && prevId) {
          room.pending.delete(prevId)
        }
        const submitTs = Date.now()
        const delta = pointsFor(q.startTs, submitTs, q.timerMs, q.pointsFloor)
        const answerId = `${socket.id}:${submitTs}`
        const p = room.players.get(socket.id)
        if (p?.token && q.historyEntry) q.historyEntry.answers[p.token] = payload?.content || ''
        // token en plus de playerId : voir le commentaire équivalent sur la
        // file d'attente blindtest plus haut (resolvePendingId).
        room.pending.set(answerId, { playerId: socket.id, token: p?.token || null, content: payload?.content, ts: submitTs, delta, timerMs: q.timerMs, pointsFloor: q.pointsFloor, historyEntry: q.historyEntry })
        q.submissions?.set(socket.id, answerId)
        io.to(code).emit('answer:queue', { answerId, playerId: socket.id, content: payload?.content })
        emitProgress()
      }
    })

    // Un joueur peut se reconnecter (nouveau socket.id) PENDANT qu'une de ses
    // réponses est encore en attente de modération par l'hôte : le socket.id
    // capturé au moment de la soumission (item.playerId) devient alors périmé
    // (room:join a supprimé l'ancienne entrée room.players, voir plus haut) —
    // sans ça, l'approbation/le rejet créditait silencieusement un id
    // fantôme que plus personne ne lit, et le joueur perdait purement et
    // simplement les points de cette question (bug réel constaté : un joueur
    // gagnant terminait en bas du classement final). On retrouve son id
    // ACTUEL via son token, stable lui à travers les reconnexions.
    const resolvePendingId = (room, item) => {
      if (item.token) {
        const tok = room.tokens.get(item.token)
        if (tok) return tok.id
      }
      return item.playerId
    }

    // Résout un champ (titre OU artiste) d'un item de modération "blindtest" —
    // contrairement aux autres types, un même item peut avoir besoin de DEUX
    // passages en modération (un par champ) avant d'être retiré de la file :
    // on ne le supprime de room.pending et on ne fige le résultat définitif
    // (historyEntry, q.answered) qu'une fois qu'aucun champ n'est plus "pending".
    const resolveBlindTestField = (io, code, room, answerId, item, field, correct) => {
      const entry = item.fields[field]
      if (!entry || entry.status !== 'pending') return
      entry.status = correct ? 'correct' : 'incorrect'
      const currentId = resolvePendingId(room, item)
      if (correct) {
        // Champ toujours "fuzzy" ici (seul cas qui passe par la modération,
        // voir evalField) : plein halfDelta, pas de réduction — une fois que
        // l'hôte tranche "c'est correct", seule la vitesse doit compter,
        // exactement comme pour le texte libre (moderation:approve plus bas,
        // qui donne déjà 100% des points sur une approbation manuelle).
        const delta = item.halfDelta
        const total = (room.scores.get(currentId) || 0) + delta
        room.scores.set(currentId, total)
        const p = room.players.get(currentId)
        if (p?.token) {
          room.tokens.set(p.token, { id: currentId, name: p.name, score: total, teamId: p.teamId || null })
          if (item.historyEntry) item.historyEntry.deltas[p.token] = (item.historyEntry.deltas[p.token] || 0) + delta
        }
        io.to(code).emit('score:update', { playerId: currentId, delta, total })
      }
      const stillPending = Object.values(item.fields).some(f => f.status === 'pending')
      if (stillPending) return
      room.pending.delete(answerId)
      const q = room.currentQuestion
      q?.answered?.add(currentId)
      const p = room.players.get(currentId)
      if (p?.token && item.historyEntry) {
        const bothCorrect = item.fields.title.status === 'correct' && item.fields.artist.status === 'correct'
        item.historyEntry.results[p.token] = bothCorrect ? 'correct' : 'incorrect'
      }
      // Dès que la file de modération est vide, la question peut enfin être
      // révélée (voir revealQuestion) — mais seulement si c'est bien encore
      // LA question concernée (comparaison par historyEntry, pas juste par
      // référence à room.currentQuestion qui aurait pu avancer) et qu'elle
      // est bien terminée (chrono écoulé / tout le monde a répondu).
      if (room.pending.size === 0) {
        const q = room.currentQuestion
        if (q && q.historyEntry === item.historyEntry && q.ended) revealQuestion(io, code, room, q)
      }
    }

    socket.on('moderation:approve', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const item = room.pending.get(payload?.answerId)
      if (!item) return

      if (item.fields) {
        const field = payload?.field === 'artist' ? 'artist' : 'title'
        resolveBlindTestField(io, code, room, payload.answerId, item, field, true)
        return
      }

      room.pending.delete(payload?.answerId)
      const q = room.currentQuestion
      const currentId = resolvePendingId(room, item)
      if (q?.answered?.has(currentId)) return
      // item.delta est normalement toujours déjà posé (voir answer:submit
      // plus haut) ; ce repli n'existe que par prudence, et réutilise le
      // timerMs/pointsFloor ENREGISTRÉS SUR LA SOUMISSION plutôt que ceux de
      // room.currentQuestion, qui a pu avancer entre-temps si l'hôte a
      // enchaîné avant que l'hôte n'ait tranché cette modération.
      const delta = item.delta || pointsFor(q.startTs, item.ts, item.timerMs ?? q?.timerMs, item.pointsFloor ?? q?.pointsFloor)
      const total = (room.scores.get(currentId) || 0) + delta
      room.scores.set(currentId, total)
      const p = room.players.get(currentId)
      if (p?.token) {
        room.tokens.set(p.token, { id: currentId, name: p.name, score: total, teamId: p.teamId || null })
        if (item.historyEntry) {
          item.historyEntry.results[p.token] = 'correct'
          item.historyEntry.deltas[p.token] = delta
        }
      }
      q?.answered?.add(currentId)
      io.to(code).emit('score:update', { playerId: currentId, delta, total })

      // Si plus aucune réponse en attente après approbation, on peut enfin
      // révéler la bonne réponse (voir revealQuestion).
      if (room.pending.size === 0 && q && q.historyEntry === item.historyEntry && q.ended) {
        revealQuestion(io, code, room, q)
      }
    })

    socket.on('moderation:reject', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const item = room.pending.get(payload?.answerId)
      if (!item) return

      if (item.fields) {
        const field = payload?.field === 'artist' ? 'artist' : 'title'
        resolveBlindTestField(io, code, room, payload.answerId, item, field, false)
        return
      }

      room.pending.delete(payload?.answerId)
      if (item?.historyEntry) {
        const p = room.players.get(resolvePendingId(room, item))
        if (p?.token) item.historyEntry.results[p.token] = 'incorrect'
      }
      io.to(code).emit('moderation:rejected', { answerId: payload?.answerId })

      // Si plus aucune réponse en attente après rejet, on peut enfin révéler
      // la bonne réponse (voir revealQuestion).
      const q = room.currentQuestion
      if (room.pending.size === 0 && q && item?.historyEntry && q.historyEntry === item.historyEntry && q.ended) {
        revealQuestion(io, code, room, q)
      }
    })

    socket.on('fun:react', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room) return
      const emoji = payload?.emoji
      if (!FUN_REACTION_EMOJIS.includes(emoji)) return
      const now = Date.now()
      if (!room.lastReactionTs) room.lastReactionTs = new Map()
      const last = room.lastReactionTs.get(socket.id) || 0
      if (now - last < REACTION_COOLDOWN_MS) return
      room.lastReactionTs.set(socket.id, now)
      io.to(code).emit('fun:react', { emoji })
    })

    socket.on('leaderboard:show', payload => {
      const code = payload?.roomCode
      const room = rooms.get(code)
      if (!room || socket.id !== room.hostId) return
      room.lastActivityAt = Date.now() // voir sweepAbandonedRooms
      io.to(code).emit('leaderboard:show')
    })

    socket.on('disconnect', () => {
      const code = socket.roomCode || socket.hostRoomCode
      if (!code) return
      const room = rooms.get(code)
      if (!room) return

      // Si l'hôte se déconnecte avant la fin du quiz : on ne ferme plus la
      // salle tout de suite (une coupure wifi de quelques secondes tuerait
      // la partie pour tout le monde). Délai de grâce pendant lequel l'hôte
      // peut se reconnecter comme n'importe quel joueur, via room.hostToken
      // (voir room:join) ; la salle n'est réellement fermée que si personne
      // n'a repris la main d'ici là (room.hostId toujours == ce socket, qui
      // n'a donc jamais été remplacé par une reconnexion entre-temps).
      const disconnectedHostId = socket.id
      if (room.hostId === disconnectedHostId && !room.ended) {
        room.hostDisconnectedAt = Date.now()
        io.to(code).emit('host:disconnected', { graceMs: HOST_GRACE_MS })
        setTimeout(() => {
          const r = rooms.get(code)
          if (r && r.hostId === disconnectedHostId) {
            io.to(code).emit('room:closed', { message: 'L\'hôte s\'est déconnecté.' })
            rooms.delete(code)
          }
        }, HOST_GRACE_MS)
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

  // Purge périodique des salles abandonnées (voir ABANDONED_ROOM_MS) : les
  // autres mécanismes de nettoyage (délai de grâce hôte, quiz:end) supposent
  // tous un ÉVÉNEMENT (déconnexion, fin de quiz) pour se déclencher — ici on
  // couvre le cas où rien ne se passe jamais plus, sans qu'aucun socket ne
  // se déconnecte pour autant (onglet oublié ouvert, wifi toujours actif).
  setInterval(() => {
    const now = Date.now()
    for (const [code, room] of rooms) {
      if (now - room.lastActivityAt > ABANDONED_ROOM_MS) {
        rooms.delete(code)
      }
    }
  }, ROOM_SWEEP_INTERVAL_MS)
}

start()
