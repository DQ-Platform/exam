/* DQ Platform service worker: təkrar girişdə ani açılış.
   Statik fayllar: keşdən dərhal + arxa fonda yenilənmə. HTML: əvvəl şəbəkə, olmasa keş.
   Supabase / API sorğularına toxunmur (məlumat həmişə təzə qalır). */
const V = "dq-v1";
const CORE = ["/", "/index.html", "/app.js?v=20"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put("/index.html", cp)); return res; })
      .catch(() => caches.match("/index.html")));
    return;
  }
  if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|json|ico)$/.test(u.pathname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
