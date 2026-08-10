// Composants d'UI "maison" partagés (index.html, editor.html, login.html) —
// remplacent les widgets natifs du navigateur (select, confirm, alert) qui
// ne peuvent pas être stylisés et cassent l'identité visuelle de l'appli
// (boutons pilule, dégradé rose/violet, ombre "3D", voir .btn/.btn-primary
// dans style.css). Non-module classique (pas d'import/export) pour rester
// cohérent avec le reste du projet (scripts <script defer> simples, sans
// bundler) — expose tout sous window.QzUI.
;(function () {
  // --- Sélecteur déroulant maison (remplace <select>) -----------------------
  // Le <select> natif original reste dans le DOM et reste la SOURCE DE VÉRITÉ
  // (masqué visuellement, jamais retiré) : tout le code existant qui lit/écrit
  // .value, écoute 'change' ou bascule .disabled continue de fonctionner sans
  // aucune modification ailleurs — seul le rendu visuel est remplacé par un
  // bouton + une liste déroulante stylisés comme le reste de l'appli. Le
  // <select> lui-même est caché (display:none) plutôt que rendu invisible-
  // mais-présent : le bouton personnalisé reprend entièrement le clavier
  // (flèches/Entrée/Échap), comme les curseurs "maison" (graduation, volume)
  // ailleurs dans ce projet.
  function enhanceSelect(selectEl) {
    if (!selectEl || selectEl.dataset.qzEnhanced) return
    selectEl.dataset.qzEnhanced = '1'

    const wrap = document.createElement('div')
    wrap.className = 'qz-select'
    selectEl.parentNode.insertBefore(wrap, selectEl)
    wrap.appendChild(selectEl)
    selectEl.style.display = 'none'

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'qz-select-trigger'
    trigger.setAttribute('role', 'combobox')
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    wrap.appendChild(trigger)

    const list = document.createElement('ul')
    list.className = 'qz-select-list d-none'
    list.setAttribute('role', 'listbox')
    wrap.appendChild(list)

    let items = []

    const buildItems = () => {
      list.innerHTML = ''
      items = Array.from(selectEl.options).map(opt => {
        const li = document.createElement('li')
        li.className = 'qz-select-option'
        li.setAttribute('role', 'option')
        li.textContent = opt.textContent
        li.dataset.value = opt.value
        if (opt.disabled) li.classList.add('is-disabled')
        list.appendChild(li)
        return li
      })
    }
    buildItems()

    const syncLabel = () => {
      const selected = selectEl.options[selectEl.selectedIndex]
      trigger.textContent = selected ? selected.textContent : ''
      items.forEach(li => li.classList.toggle('is-selected', li.dataset.value === selectEl.value))
    }
    syncLabel()

    const closeList = () => {
      list.classList.add('d-none')
      trigger.setAttribute('aria-expanded', 'false')
      trigger.classList.remove('is-open')
    }
    const openList = () => {
      if (selectEl.disabled) return
      list.classList.remove('d-none')
      trigger.setAttribute('aria-expanded', 'true')
      trigger.classList.add('is-open')
      items.forEach(li => li.classList.toggle('is-active', li.dataset.value === selectEl.value))
      const active = items.find(li => li.classList.contains('is-active'))
      if (active) active.scrollIntoView({ block: 'nearest' })
    }
    const toggleList = () => { list.classList.contains('d-none') ? openList() : closeList() }

    const choose = (li) => {
      if (!li || li.classList.contains('is-disabled')) return
      selectEl.value = li.dataset.value // passe par le setter surchargé plus bas -> syncLabel() appelé
      selectEl.dispatchEvent(new Event('change', { bubbles: true }))
      closeList()
      trigger.focus()
    }

    trigger.addEventListener('click', toggleList)
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.qz-select-option')
      if (li) choose(li)
    })

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (list.classList.contains('d-none')) { openList(); return }
        const enabled = items.filter(li => !li.classList.contains('is-disabled'))
        if (enabled.length === 0) return
        const curIdx = enabled.findIndex(li => li.classList.contains('is-active'))
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const next = enabled[(curIdx + dir + enabled.length) % enabled.length]
        items.forEach(li => li.classList.remove('is-active'))
        next.classList.add('is-active')
        next.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (list.classList.contains('d-none')) { openList(); return }
        choose(items.find(li => li.classList.contains('is-active')))
      } else if (e.key === 'Escape') {
        closeList()
      } else if (e.key === 'Tab') {
        closeList()
      }
    })

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closeList()
    })

    // Le reste de l'appli continue d'écrire `selectEl.value = ...` ou
    // `selectEl.disabled = ...` directement (ex. socket.on('game:speedLevel'),
    // applyReadOnly côté éditeur) sans savoir que ce widget existe : on
    // intercepte ces deux setters natifs pour garder le rendu synchronisé,
    // plutôt que de devoir modifier tous les appelants existants.
    const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
    Object.defineProperty(selectEl, 'value', {
      configurable: true,
      get() { return valueDesc.get.call(selectEl) },
      set(v) { valueDesc.set.call(selectEl, v); syncLabel() }
    })
    const disabledDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'disabled')
    Object.defineProperty(selectEl, 'disabled', {
      configurable: true,
      get() { return disabledDesc.get.call(selectEl) },
      set(v) {
        disabledDesc.set.call(selectEl, v)
        trigger.disabled = !!v
        trigger.classList.toggle('is-disabled', !!v)
        if (v) closeList()
      }
    })
  }

  // --- Modale de confirmation (remplace window.confirm) ----------------------
  let confirmOverlay = null
  function ensureConfirmModal() {
    if (confirmOverlay) return confirmOverlay
    confirmOverlay = document.createElement('div')
    confirmOverlay.className = 'modal-overlay d-none qz-confirm-overlay'
    confirmOverlay.innerHTML =
      '<div class="modal-content card max-w-500">' +
        '<h2 class="qz-confirm-title mb-md font-28"></h2>' +
        '<p class="qz-confirm-message text-muted mb-lg"></p>' +
        '<div class="d-flex gap-sm justify-end">' +
          '<button type="button" class="btn h-48 qz-confirm-cancel"></button>' +
          '<button type="button" class="btn btn-primary h-48 qz-confirm-ok"></button>' +
        '</div>' +
      '</div>'
    document.body.appendChild(confirmOverlay)
    return confirmOverlay
  }

  // qzConfirm({ title, message, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
  function qzConfirm(opts) {
    opts = opts || {}
    const overlay = ensureConfirmModal()
    overlay.querySelector('.qz-confirm-title').textContent = opts.title || 'Confirmer'
    overlay.querySelector('.qz-confirm-message').textContent = opts.message || ''
    const cancelBtn = overlay.querySelector('.qz-confirm-cancel')
    const okBtn = overlay.querySelector('.qz-confirm-ok')
    cancelBtn.textContent = opts.cancelLabel || 'Annuler'
    okBtn.textContent = opts.confirmLabel || 'Confirmer'
    okBtn.classList.toggle('btn-danger', !!opts.danger)
    okBtn.classList.toggle('btn-primary', !opts.danger)
    overlay.classList.remove('d-none')

    return new Promise((resolve) => {
      const cleanup = (result) => {
        overlay.classList.add('d-none')
        okBtn.removeEventListener('click', onOk)
        cancelBtn.removeEventListener('click', onCancel)
        overlay.removeEventListener('mousedown', onOverlay)
        document.removeEventListener('keydown', onKey)
        resolve(result)
      }
      const onOk = () => cleanup(true)
      const onCancel = () => cleanup(false)
      const onOverlay = (e) => { if (e.target === overlay) cleanup(false) }
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(false)
        else if (e.key === 'Enter') cleanup(true)
      }
      okBtn.addEventListener('click', onOk)
      cancelBtn.addEventListener('click', onCancel)
      overlay.addEventListener('mousedown', onOverlay)
      document.addEventListener('keydown', onKey)
      okBtn.focus()
    })
  }

  // --- Toast (remplace window.alert pour les messages courts) ---------------
  // Même principe que showToast() dans editor.js à l'origine, généralisé ici
  // pour être partagé avec index.js/login.js plutôt que dupliqué.
  let toastHost = null
  function ensureToastHost() {
    if (toastHost) return toastHost
    toastHost = document.createElement('div')
    toastHost.className = 'qz-toast-host'
    document.body.appendChild(toastHost)
    return toastHost
  }
  function qzToast(message, type) {
    const host = ensureToastHost()
    const t = document.createElement('div')
    t.className = 'qz-toast' + (type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : '')
    t.textContent = message
    host.appendChild(t)
    // Force le reflow avant d'ajouter la classe d'entrée, sinon la transition
    // CSS ne joue pas (l'élément est déjà dans son état final au 1er paint).
    void t.offsetWidth
    t.classList.add('is-visible')
    setTimeout(() => {
      t.classList.remove('is-visible')
      setTimeout(() => t.remove(), 300)
    }, 3200)
  }

  // --- Visite guidée "spotlight" (tutoriel de prise en main) -----------------
  // Overlay plein écran assombri avec un "trou" découpé autour de l'élément
  // ciblé à chaque étape (technique du box-shadow géant sur .qz-tour-hole :
  // évite un masque SVG/clip-path, la zone du trou reste visuellement nette
  // sans bloquer les clics dessus) + une bulle d'explication repositionnée à
  // côté, avec Précédent/Suivant/Passer et une case "Ne plus afficher"
  // persistée en localStorage (une clé par tutoriel, fournie par l'appelant —
  // permet plusieurs tutoriels indépendants sur des pages différentes).
  // Pas de requestAnimationFrame ni de scroll "smooth" : le positionnement se
  // calcule tout de suite après un scrollIntoView instantané, plus simple et
  // plus robuste qu'attendre la fin d'une animation de scroll.
  let tourEls = null
  function ensureTour() {
    if (tourEls) return tourEls
    const backdrop = document.createElement('div')
    backdrop.className = 'qz-tour-backdrop d-none'
    const hole = document.createElement('div')
    hole.className = 'qz-tour-hole'
    const popup = document.createElement('div')
    popup.className = 'qz-tour-popup'
    popup.innerHTML =
      '<div class="qz-tour-progress"></div>' +
      '<h3 class="qz-tour-title"></h3>' +
      '<p class="qz-tour-text"></p>' +
      '<label class="qz-tour-skip-label">' +
        '<input type="checkbox" class="qz-toggle-input qz-tour-skip-check" />' +
        '<span class="qz-toggle-track"><span class="qz-toggle-thumb"></span></span>' +
        'Ne plus afficher ce tutoriel' +
      '</label>' +
      '<div class="qz-tour-actions">' +
        '<button type="button" class="btn qz-tour-prev">Précédent</button>' +
        '<button type="button" class="btn text-danger qz-tour-close">Passer</button>' +
        '<button type="button" class="btn btn-primary qz-tour-next">Suivant</button>' +
      '</div>'
    backdrop.appendChild(hole)
    backdrop.appendChild(popup)
    document.body.appendChild(backdrop)
    tourEls = { backdrop, hole, popup }
    return tourEls
  }

  // qzTour(steps, { storageKey, force }) — steps: [{ target: '#id'|Element, title, text }, ...]
  // Auto-ignoré si storageKey est déjà marquée "vue" en localStorage, sauf
  // avec force:true (bouton "revoir le tutoriel" — ignore la préférence
  // enregistrée pour CETTE ouverture, mais la case à cocher reste active :
  // la cocher à nouveau pendant un replay forcé redésactive bien le tutoriel).
  function qzTour(steps, opts) {
    opts = opts || {}
    const storageKey = opts.storageKey || 'qz_tour_dismissed'
    if (!opts.force && localStorage.getItem(storageKey) === '1') return

    const validSteps = (steps || [])
      .map(s => {
        let el = typeof s.target === 'string' ? document.querySelector(s.target) : s.target
        // Un <select> passé par enhanceSelect() est caché (display:none, voir
        // plus haut) : son getBoundingClientRect() est alors vide (0,0,0,0),
        // ce qui cadrait le spotlight en haut à gauche de l'écran au lieu du
        // menu déroulant réellement visible. On cible plutôt son wrapper
        // .qz-select, qui reprend exactement la taille/position du bouton
        // visible.
        if (el && el.tagName === 'SELECT' && el.dataset.qzEnhanced && el.parentElement && el.parentElement.classList.contains('qz-select')) {
          el = el.parentElement
        }
        return { ...s, el }
      })
      .filter(s => s.el)
    if (validSteps.length === 0) return

    const { backdrop, hole, popup } = ensureTour()
    const titleEl = popup.querySelector('.qz-tour-title')
    const textEl = popup.querySelector('.qz-tour-text')
    const progressEl = popup.querySelector('.qz-tour-progress')
    const prevBtn = popup.querySelector('.qz-tour-prev')
    const nextBtn = popup.querySelector('.qz-tour-next')
    const closeBtn = popup.querySelector('.qz-tour-close')
    const skipCheck = popup.querySelector('.qz-tour-skip-check')
    skipCheck.checked = false

    let idx = 0

    // Hauteur à garder libre en haut de l'écran pour ne pas caler la cible
    // sous la navbar sticky (position:sticky, voir .navbar dans style.css) —
    // mesurée en direct plutôt que codée en dur : reste juste si la navbar
    // change de taille (mobile, futur redesign...), et vaut une petite marge
    // fixe si la page n'a pas de navbar sticky.
    const stickyTopClearance = () => {
      const nav = document.querySelector('.navbar')
      if (nav) {
        const pos = getComputedStyle(nav).position
        if (pos === 'sticky' || pos === 'fixed') {
          return Math.ceil(nav.getBoundingClientRect().bottom) + 16
        }
      }
      return 16
    }

    const positionFor = (el) => {
      const r = el.getBoundingClientRect()
      const pad = 8
      hole.style.top = (r.top - pad) + 'px'
      hole.style.left = (r.left - pad) + 'px'
      hole.style.width = (r.width + pad * 2) + 'px'
      hole.style.height = (r.height + pad * 2) + 'px'

      // 4 positions candidates (dessous / dessus / droite / gauche de la
      // cible), essayées dans cet ordre : la première qui a vraiment la
      // place NÉCESSAIRE est retenue. Indispensable pour une cible haute et
      // étroite (ex. #questionList, une sidebar aussi haute que l'écran) où
      // ni "dessous" ni "dessus" ne peuvent jamais suffire — sans ce repli
      // latéral, l'encart était plaqué en haut de l'écran par défaut,
      // par-dessus la moitié du halo qu'il est censé expliquer.
      const popupRect = popup.getBoundingClientRect()
      const topClear = stickyTopClearance()
      const GAP = 12, EDGE = 12
      const clampH = (x) => Math.min(Math.max(x, EDGE), window.innerWidth - popupRect.width - EDGE)
      const clampV = (y) => Math.min(Math.max(y, topClear), window.innerHeight - popupRect.height - EDGE)

      const spaceBelow = window.innerHeight - r.bottom - EDGE
      const spaceAbove = r.top - topClear - EDGE
      const spaceRight = window.innerWidth - r.right - EDGE
      const spaceLeft = r.left - EDGE

      let top, left
      if (spaceBelow >= popupRect.height + GAP) {
        top = r.bottom + pad + GAP
        left = clampH(r.left)
      } else if (spaceAbove >= popupRect.height + GAP) {
        top = r.top - pad - GAP - popupRect.height
        left = clampH(r.left)
      } else if (spaceRight >= popupRect.width + GAP) {
        top = clampV(r.top)
        left = r.right + pad + GAP
      } else if (spaceLeft >= popupRect.width + GAP) {
        top = clampV(r.top)
        left = r.left - pad - GAP - popupRect.width
      } else {
        // Dernier recours (cible géante dans les deux sens) : au plus près
        // sans sortir de l'écran, quitte à effleurer un bord du halo.
        top = clampV(r.bottom + pad + GAP)
        left = clampH(r.left)
      }
      popup.style.top = top + 'px'
      popup.style.left = left + 'px'
    }

    const cleanup = () => {
      backdrop.classList.add('d-none')
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
    }
    const finish = () => {
      if (skipCheck.checked) localStorage.setItem(storageKey, '1')
      cleanup()
      if (typeof opts.onFinish === 'function') opts.onFinish()
    }

    const render = () => {
      const step = validSteps[idx]
      // block:'nearest' ne bouge pas si la cible est déjà techniquement dans
      // les limites du viewport — mais "dans les limites" ignore la navbar
      // sticky qui la recouvre visuellement (cas vécu : bouton Sauvegarder
      // juste sous la navbar, jamais scrollé, spotlight plaqué en haut de
      // l'écran). scroll-margin-top force le navigateur à réserver cette
      // marge lors du calcul ; block:'center' garantit un vrai mouvement de
      // scroll à chaque étape plutôt qu'un ajustement minimal qui peut
      // laisser la cible collée à un bord (plus sensible à un zoom élevé, où
      // le viewport utile est plus petit). Style inline restauré juste après
      // : scrollIntoView est synchrone (pas de behavior:'smooth' ici), donc
      // la valeur a déjà été lue par le navigateur au moment du restore.
      const prevScrollMargin = step.el.style.scrollMarginTop
      step.el.style.scrollMarginTop = stickyTopClearance() + 'px'
      step.el.scrollIntoView({ block: 'center', inline: 'nearest' })
      step.el.style.scrollMarginTop = prevScrollMargin
      titleEl.textContent = step.title || ''
      textEl.textContent = step.text || ''
      progressEl.textContent = (idx + 1) + ' / ' + validSteps.length
      prevBtn.disabled = idx === 0
      nextBtn.textContent = idx === validSteps.length - 1 ? 'Terminer' : 'Suivant'
      positionFor(step.el)
    }

    const onResize = () => positionFor(validSteps[idx].el)
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') nextBtn.click()
      else if (e.key === 'ArrowLeft' && !prevBtn.disabled) prevBtn.click()
    }

    prevBtn.onclick = () => { if (idx > 0) { idx--; render() } }
    nextBtn.onclick = () => { if (idx < validSteps.length - 1) { idx++; render() } else finish() }
    closeBtn.onclick = finish

    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)

    backdrop.classList.remove('d-none')
    idx = 0
    render()
  }

  window.QzUI = { enhanceSelect: enhanceSelect, confirm: qzConfirm, toast: qzToast, tour: qzTour }
})()
