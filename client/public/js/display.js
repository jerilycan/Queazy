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

let lastStageSig = null
let lastIntroHtml = ''
let lastPopupHtml = ''
let lastLeaderHtml = ''

// event.origin vérifié explicitement (jamais de '*' en émission côté MJ non
// plus, voir index.js pushDisplayMirror) : les deux pages sont same-origin
// par construction, pas de raison d'accepter un message d'ailleurs.
// QR d'accès à la salle sur l'écran d'attente (retour utilisateur : "afficher le
// QR code au lancement du mode présentation"). Régénéré seulement quand l'URL
// change (le sync arrive très souvent). Pas de QR si la librairie n'a pas pu se
// charger (réseau) : l'écran d'attente reste simplement comme avant.
let displayQrUrl = ''
const renderDisplayQr = (joinUrl, code) => {
  const wrap = document.getElementById('displayQr')
  const box = document.getElementById('displayQrBox')
  const codeEl = document.getElementById('displayQrCode')
  if (!wrap || !box || !joinUrl || !window.QRCode) return
  if (joinUrl !== displayQrUrl) {
    displayQrUrl = joinUrl
    box.innerHTML = ''
    const size = Math.round(Math.min(window.innerHeight * 0.32, 360))
    new window.QRCode(box, { text: joinUrl, width: size, height: size })
  }
  if (codeEl) codeEl.textContent = code ? `Code salle : ${code}` : ''
  wrap.classList.remove('d-none')
}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-sync') return
  const { stageSig, stageHtml, popupHtml, popupVisible, introHtml, introVisible, leaderHtml, leaderVisible, gameStarted, joinUrl, roomCode: syncedRoomCode } = event.data
  renderDisplayQr(joinUrl, syncedRoomCode)

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
  // Pas de réinjection si le contenu du stage n'a pas changé (stageSig, voir
  // index.js stageSignature) : chaque réinjection recrée l'énoncé et rejoue son
  // animation d'entrée — clignotement du titre dès qu'un évènement sans
  // rapport (classement, compteur de joueurs...) déclenchait un miroir.
  const stageChanged = stageSig === undefined || stageSig !== lastStageSig
  if (stageChanged) {
    lastStageSig = stageSig
    displayStage.innerHTML = stageHtml || ''
    resumeEntranceAnimations(displayStage)
  }
  // RÉGRESSION corrigée (nouveau retour utilisateur, écran d'attente pas
  // centré) : `!stageHtml` ne devient JAMAIS vrai (même piège documenté
  // juste au-dessus pour displayWaiting — stageHtml porte toujours du
  // balisage, même avant la 1ère question), donc #displayStage restait
  // visible en permanence dès le tout premier sync. Comme #displayStage a
  // `height:100%` (voir style.css), il occupait alors toute la hauteur
  // disponible même vide de contenu VISIBLE (#main garde son propre d-none),
  // écrasant le centrage flex de #displayWaiting à côté de lui dans
  // #displayRoot. Même signal fiable que displayWaiting (gameStarted).
  const stageWasHidden = displayStage.classList.contains('d-none')
  displayStage.classList.toggle('d-none', !gameStarted)
  const stageNeedsFit = stageChanged || stageWasHidden !== !gameStarted

  // Retour utilisateur ("l'image est microscopique pour une TV") : côté MJ,
  // fitStageContent() (index.js) réduit #main avec `zoom` (0.55 à 1) pour tenir
  // dans SA petite carte régie, et ce zoom voyage tel quel dans le style inline
  // de #main mirroré — la TV, qui a bien plus de place, affichait donc tout
  // (image, textes) à 55-65 % de sa taille prévue. On repart de zoom:1 et on ne
  // réduit ici que si le contenu déborde réellement de #displayStage.
  if (stageNeedsFit) {
    refitStage()
    // Une image qui finit de charger APRÈS ce calcul change la hauteur du
    // contenu (mesuré : QCM à réponses longues + image, débordement de 1000px+
    // alors que l'ajustement avait conclu que tout tenait) — on refait l'ajustement.
    displayStage.querySelectorAll('img').forEach(img => {
      if (!img.complete) img.addEventListener('load', refitStage, { once: true })
    })
    // Filet pour les décalages de mise en page tardifs (police web, animations
    // d'entrée) qui ne déclenchent aucun évènement : un dernier ajustement peu
    // après, seulement si le stage n'a pas encore été remplacé entre-temps.
    const sigAtInject = lastStageSig
    setTimeout(() => { if (lastStageSig === sigAtInject) refitStage() }, 300)
  }

  // Tâche 043, étape 1 : miroir de #questionIntroOverlay (décompte + type de
  // question avant chaque question) — même traitement que displayPopup
  // ci-dessous, élément séparé côté source (voir index.js). Même garde
  // anti-réinjection que le stage : un HTML identique ne rejoue pas ses
  // animations d'entrée.
  const introChanged = (introHtml || '') !== lastIntroHtml
  if (introChanged) { lastIntroHtml = introHtml || ''; displayIntro.innerHTML = lastIntroHtml }
  displayIntro.classList.toggle('d-none', !introVisible)

  const popupChanged = (popupHtml || '') !== lastPopupHtml
  if (popupChanged) { lastPopupHtml = popupHtml || ''; displayPopup.innerHTML = lastPopupHtml }
  displayPopup.classList.toggle('d-none', !popupVisible)

  const leaderChanged = (leaderHtml || '') !== lastLeaderHtml
  if (leaderChanged) { lastLeaderHtml = leaderHtml || ''; displayLeaderboard.innerHTML = lastLeaderHtml }
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

  // Bug remonté en test réel ("le minuteur fait des allers-retours gauche/
  // droite, comme si des secondes étaient ajoutées") : stageHtml est un
  // instantané capturé côté MJ à un moment potentiellement bien antérieur au
  // tick temps réel (ex. juste avant l'ouverture de la fenêtre TV, ou lors
  // d'une reconstruction complète déclenchée par une tout autre mutation —
  // une image "association"/"zoomguess" qui finit de charger, par exemple) —
  // #timerBar/#timerLabel qu'il contient reflètent donc l'AVANCEMENT DU
  // MINUTEUR AU MOMENT DU MIROIR, pas l'instant présent. displayStage venant
  // d'être entièrement réinjecté juste au-dessus, la barre "sautait" vers
  // cette valeur figée avant que le prochain tick (jusqu'à 100ms plus tard,
  // voir pushDisplayTick côté index.js) ne la rattrape — répété à chaque
  // reconstruction survenue PENDANT une question. Réappliquer ici le DERNIER
  // tick réellement reçu (lastTickData, voir plus bas) élimine le saut à la
  // source, quelle que soit la cause de la reconstruction.
  if (lastTickData) applyDisplayTick(lastTickData)
  if (lastOrbData && stageChanged) applyDisplayOrb(lastOrbData)
})

// Bugs remontés en test réel ("sur les questions de type classement,
// l'apparition des éléments clignote sur la télé", "à chaque nouvel indice,
// il y a un effet de drop") : chaque réinjection du stage recrée tous ses
// éléments, et une animation d'entrée inline (tileRevealIn, posée par
// applyTileReveal côté index.js avec un délai en cascade) repartait alors de
// zéro — tuiles qui disparaissent puis réapparaissent une à une, énoncé qui
// "retombe" à chaque nouvel indice. data-anim-start (horloge murale, même
// machine que le MJ) dit quand l'animation a VRAIMENT démarré côté MJ : on
// décale son délai d'autant (délai négatif = l'animation reprend en cours de
// route, ou directement à son état final si elle est déjà terminée).
const parseCssTimeMs = (value) => {
  const v = (value || '').trim()
  if (v.endsWith('ms')) return parseFloat(v) || 0
  if (v.endsWith('s')) return (parseFloat(v) || 0) * 1000
  return 0
}
// Style CALCULÉ (pas seulement inline) : couvre aussi les entrées portées
// par une classe (.indice-enter, galerie d'indices...). Les pseudo-éléments
// (reflet ::after de .indice-enter) ne peuvent pas être décalés en inline —
// une fois l'entrée largement passée, .tv-anim-done (voir style.css) coupe
// simplement leur animation pour qu'ils ne rejouent pas non plus.
const TV_ANIM_DONE_AFTER_MS = 1500
const resumeEntranceAnimations = (container) => {
  const now = Date.now()
  container.querySelectorAll('[data-anim-start]').forEach(el => {
    const elapsed = now - Number(el.dataset.animStart)
    if (!Number.isFinite(elapsed) || elapsed <= 0) return
    const cs = getComputedStyle(el)
    if (!cs.animationName || cs.animationName === 'none') return
    el.style.animationDelay = cs.animationDelay.split(',').map(d => `${parseCssTimeMs(d) - elapsed}ms`).join(', ')
    if (elapsed > TV_ANIM_DONE_AFTER_MS) el.classList.add('tv-anim-done')
  })
}

// Même piège que le zoom ci-dessus : fitTileText (index.js) réduit la police
// des tuiles de réponse EN INLINE (jusqu'à 12px) pour tenir dans les petites
// tuiles du MJ ; mirroré tel quel, ça écrasait la taille TV (clamp 18-40px du
// CSS) — réponses QCM illisibles à distance (retour utilisateur). On retire
// le style inline : la taille TV du CSS reprend la main.
const resetTileFontSizes = () => {
  displayStage.querySelectorAll('.option-btn, .question-text, .order-item').forEach(el => el.style.removeProperty('font-size'))
}

// Réponses LONGUES (ex. 70 caractères en QCM à 3 colonnes) : à la taille TV
// agrandie (jusqu'à 64px), chaque tuile pouvait dépasser 900px de haut et faire
// déborder l'écran de plus de 1000px, hors de portée du zoom de secours. On
// réduit donc la police des tuiles par paliers de 8 % (plancher 22px) tant que
// le contenu déborde de #displayStage — les réponses courtes gardent leur
// grande taille, seules les longues rétrécissent.
const fitOptionText = () => {
  // .order-item en plus : les lignes de la liste "ordre" se réduisent aussi avant d'en arriver au zoom de secours.
  const btns = displayStage.querySelectorAll('.option-btn, .order-item')
  if (!btns.length) return
  const title = displayStage.querySelector('.question-text')
  let size = parseFloat(getComputedStyle(btns[0]).fontSize)
  let titleSize = title ? parseFloat(getComputedStyle(title).fontSize) : 0
  let guard = 0
  // Tolérance 4 % de la hauteur : un petit débordement (orbe du blind test...) est absorbé par le
  // zoom de secours (~2 %) plutôt qu'en rapetissant l'énoncé.
  const overflowTolerance = window.innerHeight * 0.04
  while (displayStage.scrollHeight > displayStage.clientHeight + overflowTolerance && guard++ < 40) {
    // D'abord les réponses (plancher 30px), puis l'énoncé (plancher 44px) —
    // un énoncé de 100+ caractères à 80px occupe à lui seul 4 lignes.
    if (size > 30) {
      size = Math.max(30, size * 0.92)
      btns.forEach(el => { el.style.fontSize = `${size.toFixed(1)}px` })
    } else if (title && titleSize > 44) {
      titleSize = Math.max(44, titleSize * 0.92)
      title.style.fontSize = `${titleSize.toFixed(1)}px`
    } else {
      break
    }
  }
}

// Transitions coupées PENDANT la mesure : les tuiles ont une transition sur
// font-size/padding, donc juste après un changement de police getComputedStyle/
// scrollHeight renvoient la valeur en cours d'animation, pas la valeur finale —
// l'ajustement partait sur de faux chiffres (réduisait au plancher sans effet
// visible, puis la police repartait à sa grande taille en fin de transition).
// Reflow forcé AVANT de retirer la classe : les valeurs finales sont déjà
// "calculées", aucune transition ne se déclenche au retrait.
// Budget de hauteur (retour utilisateur : "l'énoncé <= 20 % de la page, l'image
// 30-40 %, les propositions 30-40 %") — on ne réduit une police que si son bloc
// dépasse sa part, les cas simples gardent la taille maximale du CSS.
// Les tuiles "intrus" (photos) ont leurs propres règles et sont exclues.
const LAYOUT_QUESTION_MAX = 0.20
const LAYOUT_OPTIONS_MAX_WITH_IMAGE = 0.38
const LAYOUT_OPTIONS_MAX = 0.50
const isVisibleBox = (el) => !!el && el.getBoundingClientRect().height > 0
// "Intrus" (retour utilisateur : images écrasées sur la TV) : la répartition en
// rangées vient du MJ (ex. 8 photos = 2 colonnes x 4 rangées, pensé pour une
// carte étroite). Sur un écran 16:9, ces tuiles 4:3 de 700px de large étaient
// plafonnées à ~125px de haut (budget 62vh / 4 rangées) donc écrasées. La TV
// choisit sa propre grille : le nombre de colonnes qui donne les PLUS GRANDES
// tuiles 4:3 entières dans le budget, rangées équilibrées.
const INTRUS_TV_HEIGHT_BUDGET = 0.62
const layoutIntrusGrid = () => {
  const optionsEl = displayStage.querySelector('#options.intrus-grid')
  const tiles = Array.from(displayStage.querySelectorAll('.intrus-tile'))
  if (!optionsEl || !tiles.length || !isVisibleBox(optionsEl)) return
  const n = tiles.length
  const gap = parseFloat(getComputedStyle(optionsEl).columnGap) || 20
  const W = optionsEl.clientWidth
  const Hbudget = window.innerHeight * INTRUS_TV_HEIGHT_BUDGET
  let best = { cols: 1, area: -1 }
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const maxW = (W - (cols - 1) * gap) / cols
    const maxH = (Hbudget - (rows - 1) * gap) / rows
    const w = Math.min(maxW, maxH * 4 / 3)
    const area = w * w * 3 / 4
    if (area >= best.area) best = { cols, area }
  }
  const rows = Math.ceil(n / best.cols)
  // Rangées équilibrées (ex. 7 photos sur 2 rangées = 4 + 3), jamais une tuile orpheline.
  const sizes = Array.from({ length: rows }, (_, r) => Math.floor(n / rows) + (r < n % rows ? 1 : 0))
  optionsEl.style.setProperty('--intrus-rows', rows)
  let i = 0
  sizes.forEach(size => { for (let k = 0; k < size; k++) tiles[i++].style.setProperty('--intrus-row-cols', size) })
}

// Image PORTRAIT + beaucoup d'éléments (liste "ordre", 5+ propositions) : empilée
// verticalement, l'image mangeait la hauteur et le zoom de secours tombait à 55-65 %
// (texte minuscule, 30-50 % de la largeur inutilisée). Disposition côte à côte :
// image à gauche, éléments de réponse à droite (voir .tv-side dans style.css).
const SIDE_LAYOUT_MIN_ITEMS = 5
const layoutSideBySide = () => {
  const mainEl = document.getElementById('main')
  if (!mainEl) return false
  const img = displayStage.querySelector('#illustrationImgWrap .illustration-img')
  const orderList = displayStage.querySelector('#orderList')
  const optionsEl = displayStage.querySelector('#options')
  const items = isVisibleBox(orderList)
    ? orderList.querySelectorAll('.order-item').length
    : (isVisibleBox(optionsEl) ? optionsEl.querySelectorAll('.option-btn:not(.intrus-tile)').length : 0)
  const portrait = !!img && isVisibleBox(img) && img.naturalWidth > 0 && img.naturalHeight > img.naturalWidth * 1.15
  const on = portrait && items >= SIDE_LAYOUT_MIN_ITEMS
  mainEl.classList.toggle('tv-side', on)
  return on
}

// Espace vertical inutilisé (retour utilisateur : "espace inutilisé") : le titre reste
// ancré en haut (voulu), mais le reste du contenu s'agrandit pour occuper la place :
// texte seul -> énoncé centré dans la hauteur (taille inchangée, plafonnée à 64px) ; image -> agrandie ;
// propositions -> tuiles plus hautes et police un peu plus grande. Prudent (70 % de
// la place libre) : un dépassement serait ensuite absorbé par le zoom de secours.
const FILL_MIN_FREE = 0.05
const fitFillSpace = () => {
  const mainEl = document.getElementById('main')
  if (!mainEl || mainEl.classList.contains('d-none')) return
  const H = window.innerHeight
  const freeSpace = () => displayStage.getBoundingClientRect().bottom - mainEl.getBoundingClientRect().bottom - H * 0.02
  if (freeSpace() < H * FILL_MIN_FREE) return
  const title = displayStage.querySelector('.question-text')
  const optionsEl = displayStage.querySelector('#options')
  const btns = Array.from(displayStage.querySelectorAll('.option-btn:not(.intrus-tile)')).filter(isVisibleBox)
  const hasOptions = btns.length > 0 && isVisibleBox(optionsEl)
  const img = Array.from(displayStage.querySelectorAll('.illustration-img')).find(el => isVisibleBox(el) && (!el.style.transform || el.style.transform === 'none'))
  // Texte seul : rien d'autre que l'énoncé dans #main.
  if (!hasOptions && !img && title && mainEl.getBoundingClientRect().height < title.getBoundingClientRect().height + H * 0.08) {
    // Pas d'agrandissement de l'énoncé (retour utilisateur : plafond de typo, 64px max
    // comme la règle de base) : on se contente de le centrer dans la hauteur libre.
    mainEl.style.marginTop = `${Math.max(0, Math.round(freeSpace() / 2 - H * 0.04))}px`
    return
  }
  // Image simple agrandie en premier (jamais une image cadrée : son transform est propre).
  if (img && img.naturalWidth && img.naturalHeight && !mainEl.classList.contains('tv-side')) {
    const h0 = img.getBoundingClientRect().height
    const hMax = Math.min(h0 + freeSpace() * (hasOptions ? 0.5 : 0.7), H * (hasOptions ? 0.5 : 0.66))
    const k = Math.min(hMax / img.naturalHeight, window.innerWidth * 0.82 / img.naturalWidth)
    if (k * img.naturalHeight > h0) {
      img.style.width = `${Math.round(img.naturalWidth * k)}px`
      img.style.height = `${Math.round(img.naturalHeight * k)}px`
    }
  }
  // Puis les propositions : tuiles plus hautes, police un peu plus grande.
  if (hasOptions) {
    const free = freeSpace()
    if (free < H * FILL_MIN_FREE) return
    const rows = new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))).size || 1
    const h0 = btns[0].getBoundingClientRect().height
    const hNew = Math.min(h0 + free * 0.7 / rows, H * (img ? 0.24 : 0.30))
    if (hNew <= h0) return
    const fs0 = parseFloat(getComputedStyle(btns[0]).fontSize)
    const fsNew = Math.min(56, fs0 * Math.min(1.25, Math.sqrt(hNew / h0)))
    btns.forEach(b => { b.style.minHeight = `${Math.round(hNew)}px`; b.style.fontSize = `${fsNew.toFixed(1)}px` })
  }
}

const fitLayoutBudget = () => {
  const mainEl = document.getElementById('main')
  if (!mainEl) return
  const H = window.innerHeight
  const title = displayStage.querySelector('.question-text')
  const optionsEl = displayStage.querySelector('#options')
  const btns = Array.from(displayStage.querySelectorAll('.option-btn:not(.intrus-tile)'))
  const hasOptions = btns.length > 0 && isVisibleBox(optionsEl)
  layoutIntrusGrid()
  const side = layoutSideBySide()
  const hasImage = isVisibleBox(displayStage.querySelector('.illustration-img, .illustration-img-wrap'))
  mainEl.classList.toggle('tv-has-options', hasOptions)
  mainEl.classList.toggle('tv-has-image', hasImage)
  // Image d'illustration simple : le CSS ne fait que la PLAFONNER, une image de
  // petite taille naturelle restait donc minuscule (constaté : 18 % de la
  // hauteur avec des propositions). On la dimensionne à sa part (40 % avec
  // propositions, 58 % sinon — relevées depuis 36/52 % sur retour utilisateur,
  // "agrandir les images proportionnellement à l'écran"), ratio conservé,
  // largeur bornée à 82 %. Les
  // images cadrées (transform inline) ont leur propre géométrie : exclues.
  displayStage.querySelectorAll('.illustration-img').forEach(img => {
    // Cadrées = transform inline posé (data-crop-box-w seul ne suffit pas : il
    // est aussi présent sur une illustration simple sans cadrage, qui doit,
    // elle, être agrandie).
    if (img.style.transform && img.style.transform !== 'none') return
    if (!isVisibleBox(img) || !img.naturalWidth || !img.naturalHeight) return
    // Bug remonté en test réel ("curseur numérique/blind test : image
    // écrasée") : certains types plafonnent la hauteur de l'image en CSS
    // (curseur, blind test — voir style.css) — poser ici une hauteur plus
    // grande que ce plafond laissait le CSS la rogner SANS toucher à la
    // largeur, d'où l'image aplatie. Le plafond CSS (max-height, résolu en
    // px par getComputedStyle) entre donc dans le calcul du facteur.
    const cssMaxH = parseFloat(getComputedStyle(img).maxHeight)
    const isTrueFalse = !!(optionsEl && optionsEl.classList.contains('truefalse-grid'))
    const maxH = side ? H * 0.62 : Math.min(H * (hasOptions ? (isTrueFalse ? 0.46 : 0.40) : 0.58), Number.isFinite(cssMaxH) ? cssMaxH : Infinity)
    const k = Math.min(window.innerWidth * (side ? 0.30 : 0.82) / img.naturalWidth, maxH / img.naturalHeight)
    img.style.width = `${Math.round(img.naturalWidth * k)}px`
    img.style.height = `${Math.round(img.naturalHeight * k)}px`
  })
  // "Situer"/"halo" (retour utilisateur : image trop petite sur la TV) : le cadre
  // a une taille fixe (84vw x 50vh) et l'image y est en object-fit:contain, donc
  // une image 3:2 n'en occupait que la moitié. Cadre redimensionné au RATIO de
  // l'image, le plus grand possible dans la place restante sous l'énoncé.
  displayStage.querySelectorAll('#rechercheWrap, #haloWrap').forEach(wrap => {
    const img = wrap.querySelector('img')
    wrap.style.width = ''
    wrap.style.height = ''
    wrap.style.maxWidth = ''
    wrap.style.maxHeight = ''
    if (!img || !isVisibleBox(wrap) || !img.naturalWidth || !img.naturalHeight) return
    const availH = displayStage.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top - 32
    const k = Math.min(window.innerWidth * 0.84 / img.naturalWidth, availH / img.naturalHeight)
    if (!(k > 0)) return
    wrap.style.width = `${Math.round(img.naturalWidth * k)}px`
    wrap.style.height = `${Math.round(img.naturalHeight * k)}px`
    // Plafonds CSS de base (60vh...) levés : la taille calculée ci-dessus fait foi.
    wrap.style.maxWidth = 'none'
    wrap.style.maxHeight = 'none'
  })
  if (title && (hasOptions || hasImage)) {
    let ts = parseFloat(getComputedStyle(title).fontSize)
    let guard = 0
    while (title.getBoundingClientRect().height > H * LAYOUT_QUESTION_MAX && ts > 28 && guard++ < 30) {
      ts = Math.max(28, ts * 0.94)
      title.style.fontSize = `${ts.toFixed(1)}px`
    }
  }
  if (hasOptions) {
    const budget = H * (side ? 0.62 : (hasImage ? LAYOUT_OPTIONS_MAX_WITH_IMAGE : LAYOUT_OPTIONS_MAX))
    let size = parseFloat(getComputedStyle(btns[0]).fontSize)
    let guard = 0
    while (optionsEl.getBoundingClientRect().height > budget && size > 20 && guard++ < 30) {
      size = Math.max(20, size * 0.94)
      btns.forEach(el => { el.style.fontSize = `${size.toFixed(1)}px` })
    }
  }
}

// Traits "association" (voir renderAssociationLinks côté index.js) : leurs
// coordonnées sont en pixels de la mise en page MJ, sans rapport avec celle
// de la TV (tuiles bien plus grandes, colonnes plus espacées) — retracés ici
// entre les MÊMES tuiles (data-a / data-b), dans la géométrie TV. Retour
// utilisateur après test réel : "mettre une ligne entre les propositions et
// leurs paires".
const realignAssociationLinks = () => {
  const svg = displayStage.querySelector('#associationLinksSvg')
  const area = displayStage.querySelector('#associationArea')
  const colA = displayStage.querySelector('#associationColA')
  const colB = displayStage.querySelector('#associationColB')
  if (!svg || !area || !colA || !colB) return
  const lines = svg.querySelectorAll('line[data-a]')
  const areaRect = area.getBoundingClientRect()
  if (!lines.length || !areaRect.width || !areaRect.height) return
  svg.setAttribute('viewBox', `0 0 ${areaRect.width} ${areaRect.height}`)
  const isStackedRows = colB.parentElement.getBoundingClientRect().top >= colA.parentElement.getBoundingClientRect().bottom - 1
  lines.forEach(line => {
    const elA = colA.children[Number(line.dataset.a)]
    const elB = colB.querySelector(`[data-assoc-key="${line.dataset.b}"]`)
    if (!elA || !elB) return
    const a = elA.getBoundingClientRect()
    const b = elB.getBoundingClientRect()
    if (isStackedRows) {
      line.setAttribute('x1', a.left + a.width / 2 - areaRect.left)
      line.setAttribute('y1', a.bottom - areaRect.top)
      line.setAttribute('x2', b.left + b.width / 2 - areaRect.left)
      line.setAttribute('y2', b.top - areaRect.top)
    } else {
      line.setAttribute('x1', a.right - areaRect.left)
      line.setAttribute('y1', a.top + a.height / 2 - areaRect.top)
      line.setAttribute('x2', b.left - areaRect.left)
      line.setAttribute('y2', b.top + b.height / 2 - areaRect.top)
    }
  })
}

const refitStage = () => {
  displayStage.classList.add('display-fitting')
  resetTileFontSizes()
  const mainForFill = document.getElementById('main')
  // Zoom de secours précédent levé AVANT de mesurer : sinon fitOptionText ne voyait aucun débordement (déjà zoomé) et ne réduisait jamais les polices.
  if (mainForFill) { mainForFill.style.marginTop = ''; mainForFill.style.zoom = '' }
  displayStage.querySelectorAll('.option-btn').forEach(b => b.style.removeProperty('min-height'))
  fitLayoutBudget()
  fitOptionText()
  fitFillSpace()
  fitDisplayContent()
  void displayStage.offsetHeight
  displayStage.classList.remove('display-fitting')
  realignAssociationLinks()
}

const DISPLAY_FIT_MIN_ZOOM = 0.55
const fitDisplayContent = () => {
  const mainEl = document.getElementById('main')
  if (!mainEl) return
  mainEl.style.zoom = ''
  const overflow = displayStage.scrollHeight - displayStage.clientHeight
  if (overflow > 0 && mainEl.offsetHeight > overflow) {
    mainEl.style.zoom = Math.max(DISPLAY_FIT_MIN_ZOOM, (mainEl.offsetHeight - overflow) / mainEl.offsetHeight)
  }
}

// Le ratio largeur/hauteur d'une tuile cadrée (ex. 4:3 pour "intrus") est
// le MÊME des deux côtés (mêmes règles CSS de base, seule l'échelle change
// entre MJ et TV) — le transform (translate en px + scale) calculé côté MJ
// se rééchelonne donc par un simple facteur uniforme k = largeurTV/largeurMJ
// (translateX/Y ET scale multipliés par k), sans avoir besoin de connaître
// l'image d'origine ni le cadrage choisi : voir applyCropTransform/
// computeCropGeometry côté index.js pour la dérivation complète (scale et
// offsetX/Y y sont tous deux linéaires en boxW/boxH quand le ratio largeur/
// hauteur de la boîte reste constant).
// Cadrage recalculé DIRECTEMENT pour la boîte TV à partir du point de cadrage
// de l'auteur (data-crop-pos, posé par applyCropTransform côté index.js) —
// même formule que computeCropGeometry (index.js). Bug remonté en test réel
// ("image au reveal cassée sur la télé") : la rétro-ingénierie du transform
// MJ ci-dessous ne marche que si le MJ a pu mesurer sa propre boîte ; quand
// elle était cachée/de taille nulle à ce moment-là (popup de révélation
// côté MJ pas encore visible...), applyCropTransform abandonnait sans rien
// poser et l'image restait à sa taille naturelle, rognée dans son cadre TV.
// Une image pas encore chargée est rattrapée à son évènement load.
const applyTvCropFromPos = (img) => {
  let pos
  try {
    pos = JSON.parse(img.dataset.cropPos)
  } catch {
    // Attribut absent/corrompu : on laisse le repli par rétro-ingénierie
    // (rescaleCroppedImages) faire de son mieux.
    return false
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    img.addEventListener('load', () => applyTvCropFromPos(img), { once: true })
    return true
  }
  const boxW = img.parentElement?.clientWidth
  const boxH = img.parentElement?.clientHeight
  if (!boxW || !boxH) return true
  const natW = img.naturalWidth
  const natH = img.naturalHeight
  const sc = Math.max(boxW / natW, boxH / natH) * (Number.isFinite(pos.zoom) ? pos.zoom : 1)
  const renderedW = natW * sc
  const renderedH = natH * sc
  const posX = Number.isFinite(pos.x) ? pos.x : 0.5
  const posY = Number.isFinite(pos.y) ? pos.y : 0.5
  const tx = renderedW > boxW ? -(renderedW - boxW) * posX : (boxW - renderedW) / 2
  const ty = renderedH > boxH ? -(renderedH - boxH) * posY : (boxH - renderedH) / 2
  img.style.width = `${natW}px`
  img.style.height = `${natH}px`
  img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`
  return true
}

const rescaleCroppedImages = (container) => {
  container.querySelectorAll('img[data-crop-pos]').forEach(applyTvCropFromPos)
  container.querySelectorAll('img[data-crop-box-w]:not([data-crop-pos])').forEach(img => {
    const mjBoxW = Number(img.dataset.cropBoxW)
    const tvBoxW = img.parentElement?.clientWidth
    if (!mjBoxW || !tvBoxW) return
    // [-+\d.eE]+ (pas seulement [-\d.]+) : le navigateur sérialise un résidu
    // de calcul flottant en notation scientifique (ex. "-1.42109e-14px") —
    // sans ça la regex échouait et l'image gardait son transform MJ non
    // rééchelonné (photo trop petite/décalée dans sa tuile, constaté sur un
    // drapeau "intrus" en test réel).
    // Transform MJ d'origine mémorisé au 1er passage : la fonction est ainsi
    // idempotente (relancée à chaque miroir, notamment quand la popup devient
    // visible SANS que son HTML change — cachée, son cadre mesure 0 de large et
    // le rééchelonnage était sauté pour de bon).
    if (!img.dataset.mjTransform) img.dataset.mjTransform = img.style.transform
    const m = img.dataset.mjTransform.match(/translate\(([-+\d.eE]+)px,\s*([-+\d.eE]+)px\)\s*scale\(([-+\d.eE]+)\)/)
    if (!m) return
    const mjTx = parseFloat(m[1])
    const mjTy = parseFloat(m[2])
    const mjSc = parseFloat(m[3])
    const natW = parseFloat(img.style.width)
    const natH = parseFloat(img.style.height)
    const mjBoxH = Number(img.dataset.cropBoxH)
    const tvBoxH = img.parentElement.clientHeight
    if (mjBoxH && tvBoxH && natW && natH) {
      // Boîte TV de RATIO potentiellement différent de celle du MJ (ex. tuiles
      // "intrus" : 4:3 côté MJ, bien plus larges que hautes côté TV pour tenir
      // en hauteur) : un simple facteur uniforme coupait alors l'image à
      // l'envers du cadrage choisi (drapeaux tronqués). On retrouve donc le
      // point de cadrage de l'auteur {x,y,zoom} à partir du transform MJ, puis
      // on recalcule la géométrie pour la vraie boîte TV — même formule que
      // computeCropGeometry (index.js).
      const mjCover = Math.max(mjBoxW / natW, mjBoxH / natH)
      const zoom = mjSc / mjCover
      const mjOverX = natW * mjSc - mjBoxW
      const mjOverY = natH * mjSc - mjBoxH
      const posX = mjOverX > 0 ? Math.min(1, Math.max(0, -mjTx / mjOverX)) : 0.5
      const posY = mjOverY > 0 ? Math.min(1, Math.max(0, -mjTy / mjOverY)) : 0.5
      const sc = Math.max(tvBoxW / natW, tvBoxH / natH) * zoom
      const renderedW = natW * sc
      const renderedH = natH * sc
      const tx = renderedW > tvBoxW ? -(renderedW - tvBoxW) * posX : (tvBoxW - renderedW) / 2
      const ty = renderedH > tvBoxH ? -(renderedH - tvBoxH) * posY : (tvBoxH - renderedH) / 2
      img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`
      return
    }
    // Repli (MJ sans hauteur de référence) : facteur uniforme, valable tant
    // que le ratio de la boîte est le même des deux côtés.
    const k = tvBoxW / mjBoxW
    const tx = mjTx * k
    const ty = mjTy * k
    const sc = mjSc * k
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
// lastTickData : dernier tick reçu, réappliqué après CHAQUE reconstruction de
// #displayStage (voir le handler queazy-display-sync plus haut) — voir son
// commentaire pour le bug que ça corrige. null tant qu'aucun tick n'est
// encore arrivé (première question pas encore démarrée) : rien à réappliquer
// dans ce cas, stageHtml lui-même porte alors déjà l'état initial correct.
let lastTickData = null
const applyDisplayTick = ({ pct, label, urgent, zoomScale }) => {
  const timerBarFill = document.getElementById('timerBar')
  const timerLabel = document.getElementById('timerLabel')
  if (timerBarFill) {
    timerBarFill.style.transform = `scaleX(${pct / 100})`
    timerBarFill.classList.toggle('timer-urgent', !!urgent)
    timerBarFill.classList.toggle('timer-empty', pct <= 0.5)
  }
  if (timerLabel) timerLabel.textContent = label
  if (zoomScale != null) {
    const illustrationZoomLayer = document.getElementById('illustrationZoomLayer')
    if (illustrationZoomLayer) illustrationZoomLayer.style.transform = `scale(${zoomScale})`
  }
}
// Orbe du Blind Test (voir index.js pushDisplayOrb) : appliquée directement sur
// #blindtestOrb, jamais via une reconstruction du stage.
let lastOrbData = null
const applyDisplayOrb = ({ transform, boxShadow, bars }) => {
  const orb = document.getElementById('blindtestOrb')
  if (!orb) return
  orb.style.transform = transform || ''
  orb.style.boxShadow = boxShadow || ''
  const barEls = orb.querySelectorAll('.blindtest-orb-bar')
  barEls.forEach((el, i) => {
    if (bars && bars[i] != null) el.style.setProperty('--lvl', bars[i])
    else el.style.removeProperty('--lvl')
  })
}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-orb') return
  lastOrbData = { transform: event.data.transform, boxShadow: event.data.boxShadow, bars: event.data.bars }
  applyDisplayOrb(lastOrbData)
})
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-tick') return
  const { pct, label, urgent, zoomScale } = event.data
  lastTickData = { pct, label, urgent, zoomScale }
  applyDisplayTick(lastTickData)
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

// Fin de partie (voir index.js, socket.on('quiz:end')) : le MJ quitte sa page
// pour les résultats — plus aucun miroir n'arrivera. La TV charge elle-même
// la page de résultats (URL relative same-origin uniquement, jamais une URL
// arbitraire reçue par message).
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return
  if (event.data?.type !== 'queazy-display-results') return
  const url = event.data.url
  if (typeof url !== 'string' || !url.startsWith('/result.html?')) return
  location.href = url
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

// Le bouton plein écran n'apparaît qu'au mouvement de la souris (voir
// .display-fullscreen-btn côté CSS) : sur une TV/vidéoprojecteur sans souris,
// il n'occupe plus l'écran en permanence.
let uiIdleTimeoutId = null
document.addEventListener('mousemove', () => {
  document.body.classList.add('display-ui-active')
  clearTimeout(uiIdleTimeoutId)
  uiIdleTimeoutId = setTimeout(() => document.body.classList.remove('display-ui-active'), 2500)
})

