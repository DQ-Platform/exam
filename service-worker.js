const C = 'dq-v4';
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'icon-192.png', 'icon-512.png'])).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => clients.claim())
));
/* Səhifə və CDN faylları: keşdən dərhal, arxa planda yenilə. Supabase sorğularına toxunmur. */
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const page = r.mode === 'navigate', cdn = CDN.includes(u.hostname);
  if (!page && !cdn) return;
  const key = page ? './' : r;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(key);
    const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(key, res.clone()); return res; }).catch(() => hit);
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
