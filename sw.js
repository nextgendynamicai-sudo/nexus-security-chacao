const CACHE_NAME = 'nexus-chacao-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalar y forzar toma de control inmediata
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Precachando UI base');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.error(err))
  );
});

// Activar y exterminar cualquier caché anterior (V1, V2, V3, V4)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] DESTRUYENDO CACHÉ ANTIGUO:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones: ESTRATEGIA NETWORK-FIRST (Red primero, si falla va a Caché)
self.addEventListener('fetch', event => {
  // Ignorar peticiones de Firebase
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      // Si la red responde bien, actualizamos el caché en secreto y devolvemos la respuesta
      if (response && response.status === 200 && response.type === 'basic' && event.request.method === 'GET') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      // Si no hay red, caemos al caché local (Offline-First garantizado)
      console.log('[Service Worker] Sin Red. Sirviendo desde Caché:', event.request.url);
      return caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
