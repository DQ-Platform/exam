/* DQ Platform – service worker (PWA) */
const VERSION = 'dq-v3';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;           /* Supabase və s. toxunulmur */

  if (r.mode === 'navigate') {                          /* səhifə: əvvəl şəbəkə, oflayn olanda keş */
    e.respondWith(
      fetch(r).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./').then((x) => x || Response.error()))
    );
    return;
  }
  e.respondWith(                                        /* fayllar: keş + arxada yenilə */
    caches.match(r).then((hit) => {
      const net = fetch(r).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(r, copy)).catch(() => {}); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
