(function () {
  var KEY = 'queazy_theme'

  function apply(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
  }

  var saved = null
  try { saved = localStorage.getItem(KEY) } catch (e) {}
  apply(saved === 'light' ? 'light' : 'dark')

  function initToggle() {
    var navbar = document.querySelector('.navbar')
    if (!navbar) return

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
