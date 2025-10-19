// apps/web/public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  clients.claim();
});
self.addEventListener('fetch', () => {}); // まずは空でOK（後でキャッシュ戦略を足す）
