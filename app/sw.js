const VERSION = 'almost-human-v9-0-conversation-1';
const SHELL = ['./','./index.html','./styles.css?v=9.0','./app.js?v=9.0','./config.js?v=9.0','./manifest.webmanifest?v=9.0','./core/stages.js','./core/anti-repetition.js','./core/safety.js','./core/memory.js','./core/store.js','./core/activities.js','./core/engine.js','./core/cloud.js','./core/chatStream.js','./core/phraseQueue.js','./core/performance9.js','./core/voiceMode9.js','./features/onboarding9.js','./features/navigation9.js','./features/home9.js','./features/growth9.js','./features/memories9.js','./features/haven9.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/') || url.pathname.includes('/functions/')) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && url.origin === self.location.origin) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : null))));
});
