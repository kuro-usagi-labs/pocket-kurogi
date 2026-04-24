// Minimal Service Worker to pass PWA installability requirements
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('fetch', () => {
  // Pass through all requests, no offline caching for MVP
})
