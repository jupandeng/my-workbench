const CACHE = 'workbench-v3';
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
  'js/modules/fitness.js',
  'js/modules/kaoyan.js',
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
  // 网络优先：先拉最新，失败再用缓存
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
