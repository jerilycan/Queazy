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

  window.QzUI = { enhanceSelect: enhanceSelect, confirm: qzConfirm, toast: qzToast }
})()
