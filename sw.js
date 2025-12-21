// Service Worker pour le fonctionnement offline

const CACHE_NAME = 'reexpeditions-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/database.js',
    '/js/scanner.js',
    '/js/parser.js',
    '/js/search.js',
    '/js/ui.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js'
];

// Installation du Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Installation...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Mise en cache des fichiers');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Activation');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retourner la ressource en cache si disponible
                if (response) {
                    return response;
                }

                // Sinon, faire la requête réseau
                return fetch(event.request).then(response => {
                    // Ne pas mettre en cache les requêtes non-GET
                    if (event.request.method !== 'GET') {
                        return response;
                    }

                    // Cloner la réponse
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
            .catch(() => {
                // En cas d'échec (offline), retourner une page d'erreur
                console.log('[SW] Requête échouée, mode offline');
            })
    );
});