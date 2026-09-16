// Vue TV/vidéoprojecteur en miroir direct (tâche 042) — page séparée de
// index.html/index.js (l'interface MJ), ouverte via window.open() en mode
// "Présenter" IRL (voir index.js, bouton #openDisplayBtn). Contrairement à
// result.html/results.js et à l'ancienne tentative (tâche 040, rollback —
// "complètement buguée", voir docs/agent-tasks/042-vue-tv-miroir-direct.md
// pour le contexte), ce fichier n'a AUCUNE connexion Socket.io : il ne fait
// que réafficher le HTML déjà rendu côté MJ, reçu par postMessage depuis
// window.opener. Élimine par construction le risque de divergence entre le
// rendu MJ et le rendu TV (root cause du bug de la tâche 040).
const roomCode = new URLSearchParams(location.search).get('room') || '' // affichage informatif seulement — la vraie liaison se fait via window.opener, pas via ce paramètre

const displayWaiting = document.getElementById('displayWaiting')
const displayIntro = document.getElementById('displayIntro')
const displayStage = document.getElementById('displayStage')
const displayPopup = document.getElementById('displayPopup')
const displayLeaderboard = document.getElementById('displayLeaderboard')

// --- Protocole de synchronisation (miroir en direct, voir index.js) -----
// Poignée de main : signale au MJ (window.opener) que cette page est prête à
// recevoir le miroir, dès le chargement — couvre aussi bien l'ouverture
// initiale (fenêtre pas encore synchronisée) que le rechargement de CETTE
// page en pleine question (état perdu localement, à rattraper). window.opener
// peut être null si la page est ouverte autrement qu'via window.open() côté
// MJ (ex. navigation directe à l'URL, test manuel) — dans ce cas, rien à
// faire, la page reste sur son état d'attente par défaut.
if (window.opener) {
  window.opener.postMessage({ type: 'queazy-display-ready' }, location.origin)
}

// event.origin vérifié explicitement (jamais de '*' en émission côté MJ non
// plus, voir index.js pushDisplayMirror) : les deux pages sont same-origin
// par construction, pas de raison d'accepter un message d'ailleurs.
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-sync') return
  const { stageHtml, popupHtml, popupVisible, introHtml, introVisible, leaderHtml, leaderVisible, gameStarted } = event.data

  // Tâche 043, étape 4 : l'écran d'attente (logo + sous-texte) ne se masque
  // que dès que gameStarted est vrai (voir index.js, anyQuestionShown) — ni
  // stageHtml (toujours non-vide dès le chargement de la page côté MJ,
  // #stageWrap porte du balisage caché en d-none avant même la 1re question)
  // ni introVisible (redevient false dès que l'intro se termine, donc
  // inexploitable pour le rattrapage d'état d'une fenêtre TV ouverte/
  // rechargée EN COURS de question, après la fin de l'intro) ne suffisaient
  // comme signal fiable. Une fois masqué, reste masqué (jamais réaffiché en
  // cours de partie, sauf si l'hôte relance un nouveau quiz dans la même
  // salle — voir index.js, remise à zéro d'anyQuestionShown).
  if (gameStarted) {
    displayWaiting.classList.add('d-none')
  } else {
    displayWaiting.classList.remove('d-none')
  }

  // Miroir DIRECT du HTML déjà rendu côté MJ — jamais de reconstruction du
  // rendu type par type ici (voir le contexte de la tâche 042 dans le Plan) :
  // c'est justement ce qui élimine le risque de divergence qui avait fait
  // échouer la tâche 040 (rollback).
  displayStage.innerHTML = stageHtml || ''
  // RÉGRESSION corrigée (nouveau retour utilisateur, écran d'attente pas
  // centré) : `!stageHtml` ne devient JAMAIS vrai (même piège documenté
  // juste au-dessus pour displayWaiting — stageHtml porte toujours du
  // balisage, même avant la 1ère question), donc #displayStage restait
  // visible en permanence dès le tout premier sync. Comme #displayStage a
  // `height:100%` (voir style.css), il occupait alors toute la hauteur
  // disponible même vide de contenu VISIBLE (#main garde son propre d-none),
  // écrasant le centrage flex de #displayWaiting à côté de lui dans
  // #displayRoot. Même signal fiable que displayWaiting (gameStarted).
  displayStage.classList.toggle('d-none', !gameStarted)

  // Tâche 043, étape 1 : miroir de #questionIntroOverlay (décompte + type de
  // question avant chaque question) — même traitement que displayPopup
  // ci-dessous, élément séparé côté source (voir index.js).
  displayIntro.innerHTML = introHtml || ''
  displayIntro.classList.toggle('d-none', !introVisible)

  displayPopup.innerHTML = popupHtml || ''
  displayPopup.classList.toggle('d-none', !popupVisible)

  displayLeaderboard.innerHTML = leaderHtml || ''
  displayLeaderboard.classList.toggle('d-none', !leaderVisible)

  // Bug remonté en test réel ("les images sont catastrophiques") : voir le
  // commentaire sur applyCropTransform/data-crop-box-w côté index.js — les
  // images cadrées (intrus, association, illustration générique, popup de
  // révélation) portent un transform calculé en pixels absolus pour la
  // taille de leur tuile CÔTÉ MJ, collé tel quel ici où la tuile est plus
  // grande. Rattrapé après coup plutôt qu'en amont : #displayStage/
  // #displayPopup viennent d'être injectés juste au-dessus, donc chaque
  // tuile a déjà sa VRAIE taille TV au moment où ce correctif tourne
  // (clientWidth force un reflow synchrone, pas besoin d'attendre une frame).
  rescaleCroppedImages(displayStage)
  rescaleCroppedImages(displayPopup)
})

// Le ratio largeur/hauteur d'une tuile cadrée (ex. 4:3 pour "intrus") est
// le MÊME des deux côtés (mêmes règles CSS de base, seule l'échelle change
// entre MJ et TV) — le transform (translate en px + scale) calculé côté MJ
// se rééchelonne donc par un simple facteur uniforme k = largeurTV/largeurMJ
// (translateX/Y ET scale multipliés par k), sans avoir besoin de connaître
// l'image d'origine ni le cadrage choisi : voir applyCropTransform/
// computeCropGeometry côté index.js pour la dérivation complète (scale et
// offsetX/Y y sont tous deux linéaires en boxW/boxH quand le ratio largeur/
// hauteur de la boîte reste constant).
const rescaleCroppedImages = (container) => {
  container.querySelectorAll('img[data-crop-box-w]').forEach(img => {
    const mjBoxW = Number(img.dataset.cropBoxW)
    const tvBoxW = img.parentElement?.clientWidth
    if (!mjBoxW || !tvBoxW) return
    const k = tvBoxW / mjBoxW
    const m = img.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
    if (!m) return
    const tx = parseFloat(m[1]) * k
    const ty = parseFloat(m[2]) * k
    const sc = parseFloat(m[3]) * k
    img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`
  })
}

// Tâche 043, étape 2 : canal léger dédié au minuteur/zoom (queazy-display-
// tick), posté 10x/s directement depuis le setInterval du minuteur côté MJ
// (voir index.js, pushDisplayTick) — jamais de innerHTML ici, seulement du
// style/textContent appliqué directement sur les éléments déjà présents dans
// le DOM mirroré (retrouvés via getElementById à CHAQUE tick, jamais mis en
// cache : #displayStage est entièrement reconstruit à chaque sync structurel
// ci-dessus, une référence gardée entre deux syncs deviendrait obsolète).
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-tick') return
  const { pct, label, urgent, zoomScale } = event.data
  const timerBarFill = document.getElementById('timerBar')
  const timerLabel = document.getElementById('timerLabel')
  if (timerBarFill) {
    timerBarFill.style.transform = `scaleX(${pct / 100})`
    timerBarFill.classList.toggle('timer-urgent', !!urgent)
  }
  if (timerLabel) timerLabel.textContent = label
  if (zoomScale != null) {
    const illustrationZoomLayer = document.getElementById('illustrationZoomLayer')
    if (illustrationZoomLayer) illustrationZoomLayer.style.transform = `scale(${zoomScale})`
  }
})

// Tâche 043 (bug remonté en test réel, "saut d'image" sur l'intro) : même
// principe que le canal ci-dessus, mais pour le chiffre du décompte
// d'intro (#questionIntroCountdown, voir index.js pushDisplayIntroTick) —
// jamais de innerHTML ici non plus, juste le textContent appliqué
// directement sur l'élément déjà présent dans #displayIntro.
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-intro-tick') return
  const countdown = document.getElementById('questionIntroCountdown')
  if (countdown) countdown.textContent = event.data.text || ''
})

// Retour utilisateur : "les animations de validation doivent aussi
// apparaître côté présentation" — voir display.html pour l'explication du
// choix (canal léger, jamais de mirroring HTML pour ces deux zones). Ces
// deux gestionnaires RECRÉENT localement les mêmes éléments que
// spawnFloatingAnswer/renderModerationDecision côté MJ (index.js), avec
// EXACTEMENT les mêmes classes CSS déjà partagées via style.css — jamais
// de logique de rendu par type de question dupliquée ici, juste deux
// petits éléments génériques indépendants du type.
const displayReactionLayer = document.getElementById('displayReactionLayer')
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-floating-answer') return
  if (!displayReactionLayer) return
  const { text, correct } = event.data
  const el = document.createElement('div')
  el.className = `floating-answer ${correct ? 'is-correct' : 'is-incorrect'}`
  el.textContent = text
  el.style.left = `${10 + Math.random() * 55}%`
  const zig = (0.75 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1)
  el.style.setProperty('--zig', zig.toFixed(2))
  displayReactionLayer.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
})

// Bug remonté en test réel ("les réactions ne sont pas reproduites côté TV,
// emoji coeur/feu...") — même principe que le bloc juste au-dessus, pour
// les emoji envoyés par les joueurs (voir spawnFloatingReaction/
// pushDisplayFloatingReaction côté index.js) : mêmes classes CSS déjà
// partagées (.floating-reaction, voir style.css), recréée localement ici,
// jamais de HTML cloné.
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-floating-reaction') return
  if (!displayReactionLayer) return
  const { emoji } = event.data
  if (typeof emoji !== 'string' || !emoji) return
  const el = document.createElement('span')
  el.className = 'floating-reaction'
  el.textContent = emoji
  el.style.left = `${5 + Math.random() * 90}%`
  el.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 160)}px`)
  el.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 60)}deg`)
  displayReactionLayer.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
})

const displayModerationFeed = document.getElementById('displayModerationFeed')
const DISPLAY_MODERATION_FEED_MAX_LINES = 6
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-moderation-feed-line') return
  if (!displayModerationFeed) return
  const { name, correct, content } = event.data
  if (typeof name !== 'string' || !name.trim()) return
  displayModerationFeed.classList.remove('d-none')
  const line = document.createElement('div')
  line.className = `moderation-feed-line ${correct ? 'is-correct' : 'is-incorrect'}`
  line.innerHTML = `<span class="moderation-feed-icon">${correct ? '✅' : '❌'}</span><span class="moderation-feed-name"></span>`
  line.querySelector('.moderation-feed-name').textContent = name
  displayModerationFeed.prepend(line)
  while (displayModerationFeed.children.length > DISPLAY_MODERATION_FEED_MAX_LINES) {
    displayModerationFeed.lastElementChild.remove()
  }
})

// Bug remonté en test réel ("la notif des joueurs ayant eu juste/faux à la
// question précédente reste affichée") : posté par index.js à chaque
// nouvelle question (voir pushDisplayClearModerationFeed) — les lignes
// prependées ci-dessus ne disparaissaient auparavant que poussées hors de
// la liste par de nouvelles validations (DISPLAY_MODERATION_FEED_MAX_LINES),
// potentiellement en pleine question suivante s'il y en a eu moins.
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-clear-moderation-feed') return
  if (!displayModerationFeed) return
  displayModerationFeed.innerHTML = ''
  displayModerationFeed.classList.add('d-none')
})

// --- Plein écran (étape 6) ---------------------------------------------
// Bouton dédié, jamais de plein écran automatique au chargement (exige un
// geste utilisateur, l'API Fullscreen le refuserait de toute façon) —
// mécanique reprise telle quelle de la tâche 040 (rollback, voir
// git show 6fe72b4:client/public/js/display.js), déjà validée.
const fullscreenBtn = document.getElementById('displayFullscreenBtn')
const updateFullscreenLabel = () => {
  fullscreenBtn.textContent = document.fullscreenElement ? '🗗 Quitter le plein écran' : '⛶ Plein écran'
}
fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) {
    // Rejeté seulement si aucun élément n'est en plein écran (ne peut pas
    // arriver ici, le bouton n'est cliqué que dans ce cas) ou si le document
    // a perdu le focus entre-temps (changement d'onglet) — sans conséquence,
    // l'utilisateur retentera simplement le clic.
    document.exitFullscreen().catch(() => {})
  } else {
    // Rejeté si le navigateur refuse (permission, iframe sans allow=
    // fullscreen — non applicable ici, page top-level) : pas de repli
    // nécessaire, l'écran reste simplement en fenêtre normale.
    document.documentElement.requestFullscreen().catch(() => {})
  }
})
document.addEventListener('fullscreenchange', updateFullscreenLabel)
