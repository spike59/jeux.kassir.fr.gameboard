// Service worker : le site reste utilisable sans réseau (voiture, train…).
// VERSION et PRECACHE sont remplis au build (vite.config.js) : rien à changer à la main.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  // un fichier manquant (jeu retiré…) ne doit pas empêcher l'installation
  event.waitUntil(caches.open(VERSION).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Réseau d'abord (pour avoir les nouveaux jeux et les scores du jour), cache si hors ligne.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
