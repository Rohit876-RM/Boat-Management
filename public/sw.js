const CACHE_NAME = 'fishing-boat-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/workers.js',
  '/js/trips.js',
  '/js/payments.js',
  '/js/attendance.js',
  '/js/reports.js',
  '/js/i18n.js',
  '/js/modal.js',
  '/icon-512.png',
  '/locales/en.json',
  '/locales/hi.json',
  '/locales/kn.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
