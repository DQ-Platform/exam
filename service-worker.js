/* DQ Platform – service worker (PWA + push) */
const VERSION = 'dq-v5';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png'];
/* Mərkəzi baza: Firebase Firestore (REST). Sayt (dq-firebase.js) və worker.js ilə eyni layihə. */
const FS_DOCS = 'https://firestore.googleapis.com/v1/projects/dq-platform-bdaf3/databases/(default)/documents';
const FS_KEY = 'AIzaSyA6mD_qCRIcc8gIEsZB1EiEbUozZeMmd34';
/* Worker-in özünə məxsus marşrutları keşləmə / toxunma */
const SKIP = /^\/(news|news-img|news-debug|qeydiyyat|cover|push)(\/|$|\?)/;

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
   Worker yükləməsiz ("boş") push göndərir; mətn mərkəzi bazadakı son push_msg qeydindən oxunur. */
async function latestMsg() {
  try {
    const r = await fetch(FS_DOCS + ':runQuery?key=' + FS_KEY, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'dq_v2_store' }],
        where: { fieldFilter: { field: { fieldPath: 'collection' }, op: 'EQUAL', value: { stringValue: 'push_msg' } } }, limit: 50 } })
    });
    if (!r.ok) return {};
    let best = null, bestId = -1;
    (await r.json()).forEach(function (x) {
      const f = x.document && x.document.fields; if (!f || !f.j_data) return;
      const id = Number(f.id && f.id.integerValue) || 0;
      if (id > bestId) { bestId = id; best = f.j_data.stringValue; }
    });
    return best ? (JSON.parse(best) || {}) : {};
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
