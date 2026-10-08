/* DQ Platform – service worker (PWA + push) */
const VERSION = 'dq-v4';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png'];
const SB = 'https://cpzwliqlgaplroscvduo.supabase.co';
const SB_KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';
/* Worker-in özünə məxsus marşrutları keşləmə / toxunma */
const SKIP = /^\/(news|news-img|news-debug|qeydiyyat|test|testler|sinaq|s%C4%B1naq|s\u0131naq|cover|push)(\/|$|\?)/i;

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
  if (SKIP.test(u.pathname)) return;                  /* önizləmə/keçid səhifələri birbaşa şəbəkədən */

  if (r.mode === 'navigate') {                         /* səhifə: əvvəl şəbəkə, oflayn olanda keş */
    e.respondWith(
      fetch(r).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./', copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./').then((x) => x || Response.error()))
    );
    return;
  }
  e.respondWith(                                       /* fayllar: keş + arxada yenilə */
    caches.match(r).then((hit) => {
      const net = fetch(r).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(r, copy)).catch(() => {}); }
        return res;
      }).catch(() => hit || Response.error());
      return hit || net;
    })
  );
});

/* ---------- Push bildirişləri ----------
   Worker yükləməsiz ("boş") push göndərir; mətn Supabase-dəki son push_msg qeydindən oxunur. */
async function latestMsg() {
  try {
    const r = await fetch(SB + '/rest/v1/dq_v2_store?select=data&collection=eq.push_msg&order=id.desc&limit=1', { headers: { apikey: SB_KEY } });
    if (!r.ok) return {};
    const rows = await r.json();
    return (rows[0] && rows[0].data) || {};
  } catch (e) { return {}; }
}

self.addEventListener('push', function (event) {
  event.waitUntil((async function () {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
    if (!d.title && !d.body) d = await latestMsg();
    const opt = {
      body: d.body || '',
      icon: d.icon || 'icon-512.png',
      badge: d.badge || 'icon-192.png',
      data: { url: d.url || './' },
      tag: d.tag || 'dq-' + (d.ts || 'msg'),
      renotify: true
    };
    if (d.image) { try { opt.image = new URL(d.image, self.registration.scope).href; } catch (e) {} }
    await self.registration.showNotification(d.title || 'DQ Platform', opt);
  })());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { list[i].navigate(url); return list[i].focus(); }
    }
    return clients.openWindow(url);
  }));
});
