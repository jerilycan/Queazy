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
    // Bug corrigé (audit UX) : .is-disabled n'est qu'un style (voir style.css
    // .btn:disabled/.is-disabled, pointer-events:auto volontaire pour garder
    // le curseur "interdit" visible) — sans cette garde, le lien restait
    // cliquable en dessous et naviguait quand même vers /?create=true, où
    // index.html finissait par rediriger vers le login après un aller-retour
    // en trop. Même garde que navCreate.onclick dans index.js.
    if (!canCreate) {
      navCreateEl.onclick = (e) => { e.preventDefault(); window.location.href = '/login.html?reason=create' }
    }
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
    // Repli volontaire sur user_metadata/email (déjà posé juste au-dessus) en
    // cas d'échec (RLS, réseau) — pas bloquant pour le reste de la page, qui
    // n'a besoin que d'un nom/avatar à afficher, pas forcément le plus à jour.
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

const formatUpdatedAt = (iso) => {
  if (!iso) return ''
  try {
    return 'Modifié le ' + new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

// Couleurs cycliques de l'avatar-initiales (nouvelle DA, voir maquette
// "Mes Quiz — Refonte") : pas de couleur liée aux données du quiz (aucune
// n'existe côté serveur), juste de quoi rendre la liste plus vivante qu'un
// gris uniforme.
const CARD_ACCENTS = [
  ['var(--tile-blue)', 'var(--tile-blue-deep)'],
  ['var(--color-accent)', 'var(--color-accent-2)'],
  ['var(--tile-green)', 'var(--tile-green-deep)'],
  ['var(--color-teal)', '#0a7d63'],
  ['var(--tile-bronze)', 'var(--tile-bronze-deep)'],
  ['var(--color-violet)', '#7a2fa8'],
]
const initialsOf = (title) =>
  (title || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// Bug corrigé (audit UX) : loadMine/loadPublic ignoraient le champ `error`
// de la réponse Supabase — une vraie panne (RLS cassée, coupure réseau,
// timeout) tombait dans `render(data || [], ...)` avec data=null, donc
// affichait l'état vide légitime ("Aucun quiz pour l'instant, crée le
// premier") au lieu d'un message d'erreur — confusion totale pour un
// utilisateur qui a réellement des quiz. `retryFn` permet de relancer la
// même requête sans recharger toute la page.
// Bug corrigé (audit UX) : aucun signal entre le clic sur un onglet et
// l'arrivée des données — sur réseau lent, la grille restait vide sans
// indication, un utilisateur impatient pouvait conclure à tort "il n'y a
// rien" avant même que la requête ait abouti ou échoué.
const renderLoading = () => {
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⏳</div>
      <h3>Chargement…</h3>
    </div>`
}

const renderLoadError = (retryFn) => {
  list.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <h3>Erreur de chargement</h3>
      <p>Impossible de récupérer les quiz pour l'instant — vérifie ta connexion et réessaie.</p>
      <button type="button" class="btn btn-primary" id="retryLoadBtn">Réessayer</button>
    </div>`
  const retryBtn = document.getElementById('retryLoadBtn')
  if (retryBtn) retryBtn.onclick = retryFn
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
  arr.forEach((q, i) => {
    const [a, a2] = CARD_ACCENTS[i % CARD_ACCENTS.length]

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

    const head = document.createElement('div')
    head.className = 'quiz-card-head'

    const avatar = document.createElement('div')
    avatar.className = 'quiz-card-avatar'
    avatar.style.background = `linear-gradient(135deg, ${a} 0%, ${a2} 100%)`
    avatar.textContent = initialsOf(q.title)

    const textWrap = document.createElement('div')
    textWrap.style.minWidth = '0'

    const title = document.createElement('div')
    title.className = 'quiz-card-title'
    title.textContent = q.title

    const meta = document.createElement('div')
    meta.className = 'quiz-card-meta'
    // "Quiz publics" (design décidé) : auteur devant la date, quand connu —
    // q.authorName vient de loadPublic (2e requête sur profiles, RLS dédiée).
    // Pseudo jamais garanti (profil supprimé, policy pas encore en place le
    // temps que l'utilisateur colle la migration...) : retombe silencieusement
    // sur la date seule plutôt que d'afficher "par null".
    meta.textContent = (!isMineTab && q.authorName)
      ? `par ${q.authorName} · ${formatUpdatedAt(q.updated_at)}`
      : formatUpdatedAt(q.updated_at)

    textWrap.appendChild(title)
    textWrap.appendChild(meta)
    head.appendChild(avatar)
    head.appendChild(textWrap)
    card.appendChild(head)

    // Actions rapides (nouvelle DA) : seulement sur "Mes Quiz" — un quiz
    // public n'appartient pas à qui le consulte, ni Dupliquer ni Supprimer
    // n'aurait de sens ici (voir editor.js pour la seule action existante
    // sur un quiz d'autrui : "Dupliquer dans mes quiz", différente).
    if (isMineTab) {
      const actions = document.createElement('div')
      actions.className = 'quiz-card-actions'

      const editBtn = document.createElement('button')
      editBtn.className = 'quiz-card-action-btn is-primary'
      editBtn.type = 'button'
      editBtn.textContent = '✏️ Éditer'
      editBtn.onclick = (e) => { e.stopPropagation(); card.onclick() }

      const dupBtn = document.createElement('button')
      dupBtn.className = 'quiz-card-action-btn'
      dupBtn.type = 'button'
      dupBtn.title = 'Dupliquer'
      dupBtn.textContent = '⧉'
      dupBtn.onclick = (e) => { e.stopPropagation(); duplicateQuiz(q.id, q.title, dupBtn) }

      const delBtn = document.createElement('button')
      delBtn.className = 'quiz-card-action-btn'
      delBtn.type = 'button'
      delBtn.title = 'Supprimer'
      delBtn.textContent = '🗑️'
      delBtn.onclick = (e) => { e.stopPropagation(); deleteQuiz(q.id, q.title) }

      actions.appendChild(editBtn)
      actions.appendChild(dupBtn)
      actions.appendChild(delBtn)
      card.appendChild(actions)
    } else {
      // "Quiz publics" (design décidé) : "▶ Jouer ce quiz" lance une salle
      // hôte directement avec ce quiz préchargé, plutôt que d'ouvrir
      // l'éditeur en lecture seule (comportement du clic sur la carte,
      // toujours valable par ailleurs — cette action n'y touche pas). Voir
      // index.js (?create=true&quiz=<id>, loadQuizById appelé au chargement).
      const actions = document.createElement('div')
      actions.className = 'quiz-card-actions'

      const playBtn = document.createElement('button')
      playBtn.className = 'quiz-card-action-btn is-primary'
      playBtn.type = 'button'
      playBtn.textContent = '▶ Jouer ce quiz'
      playBtn.onclick = (e) => {
        e.stopPropagation()
        window.location.href = '/index.html?create=true&quiz=' + encodeURIComponent(q.id)
      }

      actions.appendChild(playBtn)
      card.appendChild(actions)
    }

    list.appendChild(card)
  })
}

// Duplique un quiz DÉJÀ À MOI directement depuis la liste — même logique que
// duplicateQuizBtn dans editor.js (voir "Dupliquer dans mes quiz", pour le
// cas d'un quiz d'AUTRUI), mais on ne va chercher "questions" que pour CE
// quiz précis, à la demande : `loadMine`/`loadPublic` l'excluent
// volontairement de la liste pour la perf (voir leurs commentaires plus
// haut), donc pas question de l'ajouter à la requête de liste pour ça.
const duplicateQuiz = async (id, srcTitle, btn) => {
  if (btn) btn.disabled = true
  try {
    const { data: src, error: fetchErr } = await sb.from('quizzes')
      .select('title,questions,single_attempt')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { window.location.href = '/login.html?reason=create'; return }
    const { error: insertErr } = await sb.from('quizzes')
      .insert([{
        title: 'Copie de ' + (src.title || srcTitle || 'Quiz'),
        questions: src.questions,
        single_attempt: src.single_attempt,
        is_public: false, // une copie est privée par défaut
        owner_id: session.user.id
      }])
    if (insertErr) throw insertErr
    window.QzUI ? window.QzUI.toast('Quiz dupliqué !') : null
    await loadMine()
  } catch (err) {
    console.error('[quiz] duplication impossible :', err)
    window.QzUI ? window.QzUI.toast('Erreur lors de la duplication du quiz', 'error') : alert('Erreur lors de la duplication du quiz')
  } finally {
    if (btn) btn.disabled = false
  }
}

// Suppression directe depuis la liste — même requête que deleteQuizBtn dans
// editor.js, juste déclenchée d'un autre endroit.
const deleteQuiz = async (id, title) => {
  const ok = window.QzUI
    ? await window.QzUI.confirm({ title: 'Supprimer ce quiz ?', message: `« ${title} » sera supprimé définitivement.`, confirmLabel: 'Supprimer', danger: true })
    : confirm(`Supprimer « ${title} » ? Cette action est définitive.`)
  if (!ok) return
  try {
    const { error } = await sb.from('quizzes').delete().eq('id', id)
    if (error) throw error
    window.QzUI ? window.QzUI.toast('Quiz supprimé.') : null
    await loadMine()
  } catch (err) {
    console.error('[quiz] suppression impossible :', err)
    window.QzUI ? window.QzUI.toast('Erreur lors de la suppression du quiz', 'error') : alert('Erreur lors de la suppression du quiz')
  }
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
  renderLoading()
  const { data, error } = await sb
    .from('quizzes')
    // "questions" volontairement PAS demandé ici : c'est une colonne JSONB
    // qui embarque toutes les images/audio en base64 de chaque question
    // (parfois plusieurs Mo par quiz) — la charger entière pour CHAQUE quiz
    // de la liste juste pour compter ses questions rendait cet écran très
    // lent, surtout avec plusieurs quiz riches en médias (perf remontée par
    // l'utilisateur). Le nombre de questions n'est donc plus affiché ici
    // (repère "Modifié le ..." à la place, déjà disponible) ; il reste
    // consultable en ouvrant le quiz.
    .select('id,title,updated_at')
    .eq('owner_id', session.user.id)
    .order('updated_at', { ascending: false })
  if (error) { console.error('[select] loadMine error:', error); renderLoadError(loadMine); return }
  render(data || [], true)
}

const loadPublic = async () => {
  renderLoading()
  const { data, error } = await sb
    .from('quizzes')
    // "questions" volontairement PAS demandé ici : c'est une colonne JSONB
    // qui embarque toutes les images/audio en base64 de chaque question
    // (parfois plusieurs Mo par quiz) — la charger entière pour CHAQUE quiz
    // de la liste juste pour compter ses questions rendait cet écran très
    // lent, surtout avec plusieurs quiz riches en médias (perf remontée par
    // l'utilisateur). Le nombre de questions n'est donc plus affiché ici
    // (repère "Modifié le ..." à la place, déjà disponible) ; il reste
    // consultable en ouvrant le quiz. "owner_id" demandé en plus pour aller
    // chercher le pseudo de l'auteur juste en dessous (design décidé).
    .select('id,title,updated_at,owner_id')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
  if (error) { console.error('[select] loadPublic error:', error); renderLoadError(loadPublic); return }
  const quizzes = data || []
  // Pas de embed PostgREST direct possible ici (`.select('profiles(username)')`) :
  // "quizzes" référence "auth.users", pas "profiles" directement — aucune
  // clé étrangère entre les deux tables pour que Supabase les joigne tout
  // seul. 2e requête séparée à la place, sur les owner_id réellement
  // présents dans la page (jamais tous les profils) — autorisée par la
  // policy RLS dédiée "lecture publique du pseudo pour les quiz publics"
  // (voir supabase/schema.sql), sans quoi elle renverrait juste rien.
  const ownerIds = [...new Set(quizzes.map(q => q.owner_id).filter(Boolean))]
  if (ownerIds.length > 0) {
    const { data: authors } = await sb.from('profiles').select('id,username').in('id', ownerIds)
    const usernameById = new Map((authors || []).map(a => [a.id, a.username]))
    quizzes.forEach(q => { q.authorName = usernameById.get(q.owner_id) || null })
  }
  render(quizzes, false)
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
