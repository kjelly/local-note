// sw.js — Service Worker (Phase 17)
// 策略：
//   - install: precache app shell (best-effort)
//   - activate: 刪除所有舊 cache + 立刻接管 clients
//   - fetch: NETWORK-FIRST（含 asset、html），離線才回退快取
//     → 確保使用者 deploy 後永遠拿到最新版本，不被舊 cache 卡住
//   - sync: 背景同步事件 → 通知 clients 觸發 reconcile
//   - message: 收到 SKIP_WAITING 立即跳過等待

// 每次 deploy bump；activate 內會刪除所有其他 cache。
// 即使 bump 漏了，網路優先策略仍會讓使用者拿到新版。
const CACHE_NAME = 'local-brain-v24-shell-v3';
const SHELL = [
  './',
  './index.html',
  './404.html',
  './.nojekyll',
  './assets',
  './icons',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 清掉所有舊 cache（不只 CACHE_NAME 不同的）
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim();
    // 通知所有 clients 重新整理（一次性的自動重整機制）
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.postMessage({ type: 'lb:sw-updated' });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨源（Google APIs / Ollama）放行瀏覽器預設
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Network-first：先抓網路，失敗才回退快取（離線）
    try {
      const res = await fetch(req);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch (_) {
      const cached = await cache.match(req);
      if (cached) return cached;
      // navigation 離線且沒快取 → 給基本 offline 訊息
      if (req.mode === 'navigate') {
        return new Response('Offline — 請連上網路後重新整理', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      return new Response('', { status: 504 });
    }
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
