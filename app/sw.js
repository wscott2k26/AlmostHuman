const VERSION = 'almost-human-v10-0-evolution-shell-1';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=10.0',
  './version10.css?v=10.0',
  './version10-appearance.css?v=10.0',
  './app.js?v=10.0',
  './version10-compat.js?v=10.0',
  './version10.js?v=10.0',
  './config.js?v=10.0',
  './manifest.webmanifest?v=10.0',
  './core/stages.js',
  './core/anti-repetition.js',
  './core/safety.js',
  './core/memory.js',
  './core/store.js',
  './core/activities.js',
  './core/engine.js',
  './core/cloud.js',
  './core/chatStream.js',
  './core/phraseQueue.js',
  './core/performance9.js',
  './core/voiceMode9.js',
  './core/appearance10.js',
  './core/origin10.js',
  './core/voiceProfile10.js',
  './core/evolution10.js',
  './features/onboarding9.js',
  './features/navigation9.js',
  './features/home9.js',
  './features/growth9.js',
  './features/memories9.js',
  './features/haven9.js',
  './features/creator10.js',
  './features/identityStudio10.js',
  './features/evolutionJourney10.js',
  './features/havenEnvironment10.js',
  './character/materials10.js',
  './character/appearanceVisual10.js',
  './character/motion10.js',
  './character/renderer10.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/') || url.pathname.includes('/functions/')) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : null))),
  );
});
