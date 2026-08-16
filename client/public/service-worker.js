// Existe surtout pour satisfaire le critère d'installabilité de Chrome/
// Android (bannière "Ajouter à l'écran d'accueil" — exige un service worker
// enregistré avec un handler fetch, même minimal). Sur iOS, Safari ignore ce
// fichier : l'installation s'y fait via le menu Partager, sans lui.
//
// Stratégie réseau-d'abord (jamais cache-d'abord) pour le HTML/CSS/JS de
// l'appli : ce projet est corrigé très souvent (plusieurs déploiements par
// semaine, voir APP_VERSION côté serveur) — un cache-d'abord ferait tourner
// un client resté sur une VIEILLE version du code face à un serveur déjà mis
// à jour, source de bugs de compatibilité difficiles à diagnostiquer. Le
// cache ne sert donc que de secours si le réseau échoue (vraie coupure), pas
// comme accélérateur de chargement.
const CACHE_NAME = 'queazy-shell-v1'
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-16.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Jamais intercepter autre chose que du GET same-origin : les appels
  // Supabase/socket.io (cross-origin ou temps réel) doivent passer tels
  // quels, sans jamais être servis depuis un cache.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req))
  )
})
