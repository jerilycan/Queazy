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
