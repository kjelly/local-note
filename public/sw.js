// sw.js — Service Worker
// 策略：
//   - install: precache app shell
//   - activate: 跳過等待 + 接管 clients
//   - fetch:
//       * 同源 GET：cache-first，背景 stale-while-revalidate 更新
//       * 其他：網路優先，失敗時回退快取
//   - sync (Phase 5): 背景同步事件 → 通知 clients 觸發 reconcile

// CACHE_NAME 每次 deploy 必須 bump（v1 → v2 …）
// bump 後 activate 會把舊 v1 cache 清掉，使用者下次啟動就拿到新版
const CACHE_NAME = 'local-brain-v24-shell-v2';
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
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
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

// Phase 5：背景同步事件
self.addEventListener('sync', (event) => {
  if (event.tag === 'lb-reconcile') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll();
      for (const c of clients) c.postMessage({ type: 'lb:sync-trigger' });
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'lb:skipWaiting') self.skipWaiting();
});
