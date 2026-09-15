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
  const { stageHtml, popupHtml, popupVisible, introHtml, introVisible, gameStarted } = event.data

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
  displayStage.classList.toggle('d-none', !stageHtml)

  // Tâche 043, étape 1 : miroir de #questionIntroOverlay (décompte + type de
  // question avant chaque question) — même traitement que displayPopup
  // ci-dessous, élément séparé côté source (voir index.js).
  displayIntro.innerHTML = introHtml || ''
  displayIntro.classList.toggle('d-none', !introVisible)

  displayPopup.innerHTML = popupHtml || ''
  displayPopup.classList.toggle('d-none', !popupVisible)
})

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
