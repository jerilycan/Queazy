// Enregistrement du service worker (voir /service-worker.js) — seul
// prérequis technique pour que Chrome/Android propose "Ajouter à l'écran
// d'accueil" (le manifest.json seul ne suffit pas). Ignoré silencieusement
// sur les navigateurs sans support (Safari desktop, vieux navigateurs) :
// l'app fonctionne à l'identique, juste sans l'invite d'installation.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}

// Bannière d'installation maison plutôt que de compter sur la mini-infobar
// automatique de Chrome (retour utilisateur : "j'ai pas de demande
// d'installation") — Chrome ne la déclenche que sous des conditions
// d'engagement variables (nombre de visites, temps passé...) jamais
// garanties, alors que capturer soi-même l'évènement "beforeinstallprompt"
// et proposer un bouton donne un résultat fiable à tous les coups dès que le
// navigateur juge le site installable. Sans effet sur iOS (Safari ne
// déclenche jamais cet évènement, geste manuel Partager > Sur l'écran
// d'accueil, décision déjà actée) ni si l'app tourne déjà en standalone
// (déjà installée).
const INSTALL_DISMISS_KEY = 'queazy_install_dismissed_at'
const INSTALL_DISMISS_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours avant de re-proposer après un refus
let deferredInstallPrompt = null

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const wasRecentlyDismissed = () => {
  const at = Number(localStorage.getItem(INSTALL_DISMISS_KEY))
  return Number.isFinite(at) && Date.now() - at < INSTALL_DISMISS_SNOOZE_MS
}

const showInstallBanner = () => {
  if (document.getElementById('installBanner')) return
  const banner = document.createElement('div')
  banner.id = 'installBanner'
  banner.className = 'install-banner'
  banner.innerHTML = `
    <span class="install-banner-text">📲 Installer QuEazy sur cet appareil ?</span>
    <button type="button" class="btn btn-nav-main install-banner-btn">Installer</button>
    <button type="button" class="install-banner-close" aria-label="Fermer">×</button>
  `
  document.body.appendChild(banner)

  banner.querySelector('.install-banner-btn').onclick = async () => {
    if (!deferredInstallPrompt) return
    deferredInstallPrompt.prompt()
    await deferredInstallPrompt.userChoice.catch(() => {})
    deferredInstallPrompt = null
    banner.remove()
  }
  banner.querySelector('.install-banner-close').onclick = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
    banner.remove()
  }
}

if (!isStandaloneDisplay()) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // reprend la main sur QUAND/COMMENT le proposer, plutôt que la mini-infobar par défaut du navigateur
    deferredInstallPrompt = e
    if (!wasRecentlyDismissed()) showInstallBanner()
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    document.getElementById('installBanner')?.remove()
  })
}
