/**
 * 缘合 YuanHe — Service Worker
 * 策略：
 *   - API/SSE 请求：不缓存，直通网络
 *   - 静态资源：cache-first（加速二次打开）
 *   - 离线时：提供简单离线页面
 */

const CACHE_VERSION = 'yuanhe-v5';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const STATIC_ASSETS = [
  '/app',
  '/public/manifest.json',
  '/public/icons/icon-180.svg',
  '/public/icons/icon-192.svg',
  '/public/icons/icon-512.svg',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: route strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 仅处理 GET 请求
  if (req.method !== 'GET') return;

  // API / WebSocket / SSE — 直通网络，不缓存
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    req.headers.get('accept')?.includes('text/event-stream')
  ) {
    return;
  }

  // App 主页 — 网络优先（确保拿到最新版本），失败才用缓存
  if (url.pathname === '/app' || url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || new Response('离线模式，请连接网络', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })))
    );
    return;
  }

  // 静态资源（icons/manifest）— 缓存优先
  if (url.pathname.startsWith('/public/')) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return resp;
        }).catch(() => cached)
      )
    );
    return;
  }

  // CDN 资源（React/Babel/marked 等）— 缓存优先（减少重复下载）
  if (url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return resp;
        }).catch(() => cached)
      )
    );
  }
});
