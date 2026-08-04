(function () {
  var KEY = 'queazy_theme'

  function apply(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }

  var saved = null
  try { saved = localStorage.getItem(KEY) } catch (e) {}
  apply(saved === 'light' ? 'light' : 'dark')

  function initMenuToggle() {
    var navbar = document.querySelector('.navbar')
    if (!navbar) return
    var groups = Array.prototype.slice.call(navbar.querySelectorAll('.nav-group'))
    // Rien à mettre dans un menu (ex. login.html, qui n'a que le nom) : pas
    // de burger nécessaire.
    if (groups.length === 0) return

    var menu = document.createElement('div')
    menu.className = 'nav-menu'
    groups.forEach(function (g) { menu.appendChild(g) })
    navbar.appendChild(menu)

    var burger = document.createElement('button')
    burger.type = 'button'
    burger.className = 'menu-toggle-btn'
    burger.setAttribute('aria-label', 'Menu')
    burger.innerHTML = '<span></span><span></span><span></span>'
    burger.onclick = function (e) {
      e.stopPropagation()
      navbar.classList.toggle('nav-open')
    }
    navbar.insertBefore(burger, menu)

    document.addEventListener('click', function (e) {
      if (navbar.classList.contains('nav-open') && !navbar.contains(e.target)) {
        navbar.classList.remove('nav-open')
      }
    })
  }

  function initToggle() {
    var navbar = document.querySelector('.navbar')
    if (!navbar) return
    initMenuToggle()

    var btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'themeToggle'
    btn.className = 'theme-toggle-btn'

    var setIcon = function () {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light'
      btn.textContent = isLight ? '🌙' : '☀️'
      var label = isLight ? 'Passer en thème sombre' : 'Passer en thème clair'
      btn.title = label
      btn.setAttribute('aria-label', label)
    }
    setIcon()

    btn.onclick = function () {
      var isLight = document.documentElement.getAttribute('data-theme') === 'light'
      var next = isLight ? 'dark' : 'light'
      apply(next)
      try { localStorage.setItem(KEY, next) } catch (e) {}
      setIcon()
    }

    var host = navbar.querySelector('.nav-group:last-child')
    if (host) host.insertBefore(btn, host.firstChild)
    else navbar.appendChild(btn)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle)
  } else {
    initToggle()
  }
})()
