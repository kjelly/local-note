// sw.js — Service Worker
// 策略：
//   - install: precache app shell
//   - activate: 跳過等待 + 接管 clients
//   - fetch:
//       * 同源 GET：cache-first，背景 stale-while-revalidate 更新
//       * 其他：網路優先，失敗時回退快取

const CACHE_NAME = 'local-brain-v24-shell-v1';
const SHELL = [
  './',
  './index.html',
  './src/styles/base.css',
  './src/styles/sidebar.css',
  './src/styles/editor.css',
  './src/styles/modal.css',
  './src/styles/ai.css',
  './src/styles/responsive.css',
  './src/main.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨源（Google APIs / Ollama）放行
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    // navigation 用 network-first，確保 SPA 不會卡在舊版
    if (req.mode === 'navigate') {
      try {
        const res = await fetchPromise;
        if (res) return res;
      } catch (_) {}
      return cached || new Response('Offline', { status: 503 });
    }
    return cached || fetchPromise;
  })());
});
