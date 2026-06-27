const CACHE_NAME = 'nexus-chacao-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700&display=swap'
];

// Instalar y guardar en caché
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precachando recursos obligatorios y CDNs');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => {
        console.error('[Service Worker] Error durante precacheo:', err);
      })
  );
});

// Activar y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones y servir desde caché
self.addEventListener('fetch', event => {
  // Ignorar peticiones de Firebase Firestore sync (que usan firestore.googleapis.com o websockets)
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Devolver copia en cache inmediatamente
          return cachedResponse;
        }

        // Si no está en caché, hacer fetch de red
        return fetch(event.request).then(response => {
          // No cachear respuestas no válidas, respuestas opacas, ni llamadas a Firebase Auth/Firestore
          if (!response || response.status !== 200 || response.type !== 'basic' || event.request.method !== 'GET') {
            return response;
          }

          // Clonar respuesta y guardar en caché para peticiones locales futuras
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return response;
        }).catch(err => {
          console.log('[Service Worker] Falla de red para:', event.request.url, err);
          // Si falla de red para el documento principal, podemos devolver el index.html cacheado
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
