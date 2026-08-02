const CACHE = 'workbench-v1';
const ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/storage.js',
  'js/app.js',
  'js/modules/weather.js',
  'js/modules/schedule.js',
  'js/modules/todo.js',
  'js/modules/shortcuts.js',
  'js/modules/home.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
