// DQPlatform — vahid Cloudflare Worker (exam)
// Marşrutlar:
//   /news?id=...        → xəbər üçün şəkilli önizləmə kartı (WhatsApp / Telegram / Facebook), insanı sayta yönləndirir
//   /news-img?id=...    → xəbərin önizləmə şəkli (data:image → real şəkil, keşlənir)
//   /news-debug?id=...  → diaqnostika (v6: id hansı sahədə, şəkil niyə seçildi/seçilmədi)
//   /news (id-siz)      → xəbərlər bölməsi
//   /qeydiyyat          → imtahan qeydiyyatı üçün önizləmə kartı
//   /test               → testlər bölməsi
//   /sinaq  (/sınaq)    → sınaq imtahanı bölməsi
//   /cover/<id>.jpg     → sınaq qapaq şəkli
//   /push/notify        → push bildirişi göndər (POST, x-admin-key)
// Digər bütün sorğular statik fayllara (ASSETS) ötürülür.
//
// Secrets (Settings → Variables and Secrets): VAPID_PRIVATE, ADMIN_KEY
// Vars (istəyə bağlı): VAPID_SUBJECT (məs: mailto:you@mail.com)

const SB = 'https://cpzwliqlgaplroscvduo.supabase.co';
const KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';
const SITE = 'https://exam.dqplatform.workers.dev';
const VAPID_PUBLIC_DEFAULT = 'BDtYn14Q2yQe5x4zgSLRf8Mh6aSiVjagyfbUhUDllpTt2AYfnWE8jMbichN3C3NsyxyZaV1ffzsy3toSp_CL1aI';
// Şəkli olmayan elanlar üçün (kvadrat → WhatsApp-da kiçik şəkil + başlıq + mətn kartı)
const FALLBACK = { url: SITE + '/icon-512.png', type: 'image/png', w: 512, h: 512 };
const WA_MAX = 300000; // WhatsApp ~300KB-dan böyük önizləmə şəklini göstərmir

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => {
  s = String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'x-admin-key,content-type'
};

/* ---------------- Supabase ---------------- */
const ID_KEYS = ['slug', 'id', 'uid', 'nid', 'key', '_id', 'newsId', 'news_id', 'sid', 'code', 'ref', 'hash', 'token', 'permalink'];
async function sbJson(path) {
  const r = await fetch(`${SB}/rest/v1/dq_v2_store?${path}`, { headers: { apikey: KEY } });
  if (!r.ok) throw new Error('supabase ' + r.status);
  return r.json();
}
const valuesOf = o => {
  const out = [];
  (function w(v, d) {
    if (d > 2 || v == null) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (typeof v === 'object') for (const k in v) w(v[k], d + 1);
  })(o, 0);
  return out;
};
// Link slug, data içindəki id, cədvəlin id-si və ya başqa sahə ilə gələ bilər — hamısını yoxla
async function findNews(id, trace) {
  id = String(id || '').trim();
  const t = trace || {};
  if (!id || id.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id)) { t.by = 'bad-id'; return null; }   // filtr inyeksiyasının qarşısı
  try {                                             // 1) dəqiq sorğu
    const keys = ID_KEYS.map(k => `data->>${k}.eq.${id}`);
    const q = /^\d+$/.test(id) ? `or=(${keys.join(',')},id.eq.${id})` : `or=(${keys.join(',')})`;
    const rows = await sbJson(`select=id,data&collection=eq.news&${q}&limit=1`);
    if (rows[0]) { t.by = 'query'; return { ...rows[0].data, _id: rows[0].id }; }
  } catch (e) { t.err1 = String(e); }
  try {                                             // 2) ehtiyat: ən yeni xəbərlərdə istənilən sahənin dəyəri id-yə bərabərdirsə
    const rows = await sbJson('select=id,data&collection=eq.news&order=id.desc&limit=25');
    t.scanned = rows.length;
    for (const r of rows) if (String(r.id) === id || valuesOf(r.data).includes(id)) { t.by = 'scan'; return { ...r.data, _id: r.id }; }
  } catch (e) { t.err2 = String(e); }
  t.by = 'not-found';
  return null;
}
const sb = (env, q, init = {}) => {
  const url = env.SUPABASE_URL || SB, key = env.SUPABASE_KEY || KEY;
  return fetch(`${url}/rest/v1/dq_v2_store?${q}`, { ...init, headers: { apikey: key, Authorization: 'Bearer ' + key } });
};

/* ---------------- Şəkil köməkçiləri ---------------- */
function decodeDataUrl(u) {
  const m = /^data:(image\/[a-z0-9.+-]+)(?:;[^,]*?)?;base64,([\s\S]+)$/i.exec(String(u || '').trim());
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const type = m[1].toLowerCase();
    return { type, bytes, ...dims(bytes, type) };
  } catch (e) { return null; }
}
function dims(b, type) {
  try {
    if (type === 'image/png') {
      const dv = new DataView(b.buffer, b.byteOffset);
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    if (type === 'image/jpeg' || type === 'image/jpg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        const mk = b[i + 1];
        if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC)
          return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
    }
  } catch (e) {}
  return { w: 0, h: 0 };
}
const THUMB = 280;   // 300px-dən kiçik kvadrat → WhatsApp göndərilən mesajda da KİÇİK şəkil + başlıq + mətn kartı göstərir
// Önizləmə şəklini seç. env.IMAGES (Cloudflare Images binding) varsa — istənilən mənbə (data:image və ya URL) 280×280 JPEG-ə kiçildilir.
// Yoxdursa: xarici URL olduğu kimi, kiçik data:image olduğu kimi; böyük data:image — ikon (WhatsApp ~300KB-dan böyük şəkli göstərmir)
async function cardImage(n, env, doIt) {
  const cands = [n.og, n.img, n.image, n.cover].filter(v => typeof v === 'string' && v);
  let first = null;
  for (const v of cands) {
    if (/^https?:\/\//i.test(v)) { first = { kind: 'ext', url: v }; break; }
    const d = decodeDataUrl(v);
    if (d) { first = { kind: 'data', d }; break; }
  }
  if (!first) return null;
  const srcLen = first.kind === 'data' ? first.d.bytes.length : first.url.length;

  if (env && env.IMAGES) {
    if (!doIt) return { mode: 'resize', type: 'image/jpeg', w: THUMB, h: THUMB, v: srcLen };
    try {
      let bytes, type;
      if (first.kind === 'data') { bytes = first.d.bytes; type = first.d.type; }
      else {
        const r = await fetch(first.url);
        if (!r.ok) throw new Error('şəkil ' + r.status);
        bytes = new Uint8Array(await r.arrayBuffer()); type = r.headers.get('content-type') || 'image/jpeg';
      }
      const out = await env.IMAGES.input(new Blob([bytes], { type }).stream())
        .transform({ width: THUMB, height: THUMB, fit: 'cover' }).output({ format: 'image/jpeg', quality: 80 });
      return { mode: 'resize', type: 'image/jpeg', bytes: new Uint8Array(await out.response().arrayBuffer()), w: THUMB, h: THUMB, v: srcLen };
    } catch (e) { return { mode: 'resize-failed', error: String(e), url: first.kind === 'ext' ? first.url : '' }; }
  }
  if (first.kind === 'ext') return { mode: 'external', url: first.url, v: srcLen };
  const small = [n.og, n.img, n.image, n.cover].map(decodeDataUrl).find(d => d && d.bytes.length < WA_MAX);
  if (small) return { mode: 'raw', type: small.type, bytes: small.bytes, w: small.w, h: small.h, v: small.bytes.length };
  return { mode: 'toobig', bytesOrig: first.d.bytes.length };
}

/* ---------------- Web Push (VAPID) ---------------- */
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const baku = (d, o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', ...o }).format(new Date(d));
const dmy = d => baku(d, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
const hm = d => baku(d, { hour: '2-digit', minute: '2-digit', hour12: false });

async function liveExam(env) {
  const r = await sb(env, 'collection=eq.liveexams&order=id.desc&limit=10&select=id,data');
  const l = (await r.json()).map(x => ({ ...x.data, _id: x.id }));
  return l.find(x => x.status !== 'Bitib' && (!x.end || new Date(x.end) > Date.now())) || l[0];
}
async function vapidJwt(aud, env) {
  const pub = env.VAPID_PUBLIC || VAPID_PUBLIC_DEFAULT;
  const p = unb64u(pub);
  const key = await crypto.subtle.importKey('jwk',
    { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), d: env.VAPID_PRIVATE },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: env.VAPID_SUBJECT });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return unsigned + '.' + b64u(sig);
}

/* ---------------- HTML şablonu ---------------- */
function ogPage({ title, ptitle, desc, page, go, img, itype, iw, ih, type }) {
  return `<!doctype html><html lang="az"><head><meta charset="utf-8">
<title>${esc(ptitle || title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(page)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="DQPlatform">
<meta property="og:locale" content="az_AZ">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">${itype ? `
<meta property="og:image:type" content="${esc(itype)}">` : ''}${iw && ih ? `
<meta property="og:image:width" content="${iw}">
<meta property="og:image:height" content="${ih}">` : ''}
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="${iw && ih && iw / ih > 1.6 ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(go)}">
</head><body style="font-family:system-ui;text-align:center;padding:40px"><script>location.replace(${JSON.stringify(go).replace(/</g, '\\u003c')})</script><a href="${esc(go)}">${esc(title)}</a></body></html>`;
}

// Bölmə keçidləri (/test, /sinaq, /news, ...): önizləmə kartı + sayta yönləndirmə
function section(name, title, desc, page, go, head, cover) {
  const html = ogPage({ title, ptitle: name + ' | DQPlatform', desc, page, go, img: cover || FALLBACK.url, itype: cover ? '' : FALLBACK.type, iw: cover ? 0 : FALLBACK.w, ih: cover ? 0 : FALLBACK.h, type: 'website' });
  return new Response(head ? null : html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pass = () => (env.ASSETS ? env.ASSETS.fetch(request) : fetch(request));
    const head = request.method === 'HEAD';

    /* 0) Diaqnostika: /news-debug?id=... */
    if (url.pathname === '/news-debug') {
      const id = url.searchParams.get('id') || '';
      const trace = {};
      const n = await findNews(id, trace);
      let sample;
      try {   // ən yeni xəbərlərin sahə adları: id hansı sahədədir?
        const rows = await sbJson('select=id,data&collection=eq.news&order=id.desc&limit=3');
        sample = rows.map(r => ({
          rowId: r.id, keys: Object.keys(r.data || {}),
          idLike: Object.fromEntries(ID_KEYS.map(k => [k, (r.data || {})[k]]).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => [k, String(v).slice(0, 40)]))
        }));
      } catch (e) { sample = String(e); }
      const ci = n && await cardImage(n, env, false);
      return new Response(JSON.stringify({
        worker: 'v6', idTried: id, found: !!n, lookup: trace, title: n && n.title, slug: n && n.slug, rowId: n && n._id,
        image: !n ? null : ci ? { mode: ci.mode, bytesOrig: ci.bytesOrig, w: ci.w, h: ci.h, url: ci.url } : 'none',
        hasImagesBinding: !!(env && env.IMAGES), newestNewsFields: sample
      }, null, 2), { headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' } });
    }

    /* 1) Xəbər şəkli */
    if (url.pathname === '/news-img') {
      const id = url.searchParams.get('id') || '';
      const cache = caches.default;
      const ck = new Request(url.origin + '/news-img?id=' + encodeURIComponent(id) + '&v=' + encodeURIComponent(url.searchParams.get('v') || ''));
      const hit = await cache.match(ck);
      if (hit) return head ? new Response(null, hit) : hit;

      const n = await findNews(id);
      const d = n && await cardImage(n, env, true);
      if (d && d.url) return Response.redirect(d.url, 302);   // external və ya resize-failed (mənbə URL-i)
      if (!d || !d.bytes) return Response.redirect(FALLBACK.url, 302);

      const res = new Response(d.bytes, { headers: {
        'content-type': d.type,
        'content-length': String(d.bytes.length),
        'cache-control': 'public, max-age=604800, immutable',
        'access-control-allow-origin': '*'
      } });
      ctx.waitUntil(cache.put(ck, res.clone()));
      return head ? new Response(null, res) : res;
    }

    /* 2) Xəbər səhifəsi (OG kart) */
    if (url.pathname.replace(/\/$/, '') === '/news') {
      const id = url.searchParams.get('id') || '';
      const generic = () => section('Xəbərlər', '📰 DQPlatform — Xəbərlər və elanlar', 'İmtahan elanları, qanunvericilikdə dəyişikliklər və yeniliklər bir yerdə.', SITE + '/news', SITE + '/?go=news', head);
      if (!id) return generic();
      const n = await findNews(id);
      if (!n) return generic();                       // 302 yox: yönləndirmə ümumi səhifənin kartını göstərməsin

      const key = String(id).trim();                  // linkdə gələn id-ni olduğu kimi saxla (sayt onu bu formada açır)
      const title = clean(n.title, 90) || 'DQPlatform';
      const desc = clean(n.sum || n.body || n.text, 200) || 'DQPlatform — dövlət qulluğu imtahanlarına hazırlıq platforması';
      const page = `${SITE}/news?id=${encodeURIComponent(key)}`;
      const go = `${SITE}/?news=${encodeURIComponent(key)}`;

      let img = FALLBACK.url, itype = FALLBACK.type, iw = FALLBACK.w, ih = FALLBACK.h;
      const ci = await cardImage(n, env, false);
      if (ci && ci.mode === 'external') { img = ci.url; itype = ''; iw = 0; ih = 0; }
      else if (ci && (ci.mode === 'raw' || ci.mode === 'resize')) {
        img = `${SITE}/news-img?id=${encodeURIComponent(key)}&v=${ci.v}`;
        itype = ci.type; iw = ci.w; ih = ci.h;
      }

      const html = ogPage({ title, ptitle: title + ' | DQPlatform', desc, page, go, img, itype, iw, ih, type: 'article' });
      return new Response(head ? null : html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }

    /* 2b) Testlər və Sınaq bölmələri */
    let pth = '';
    try { pth = decodeURIComponent(url.pathname); } catch (e) { pth = url.pathname; }
    pth = pth.replace(/\/+$/, '').toLowerCase().replace(/ı/g, 'i');
    if (pth === '/test' || pth === '/testler') {
      return section('Testlər', '📝 DQPlatform — Testlər', 'Dövlət qulluğu imtahanına hazırlıq: mövzu üzrə testlər və quizlər.', SITE + '/test', SITE + '/?go=test', head);
    }
    if (pth === '/sinaq') {
      const x = await liveExam(env).catch(() => null);
      const desc = x
        ? `🎓 ${x.type || 'Qəbul tipli sınaq'} — ${x.catline || x.cat}\n📅 ${dmy(x.start)} · ${hm(x.start)}–${hm(x.end || x.start)}\n🔒 FİN kod ilə daxil olun`
        : 'Qəbul tipli sınaq imtahanları. FİN kod ilə daxil olun.';
      const hasCover = x && x.cover && /^data:image\//.test(x.cover);
      return section('Sınaq', '🎓 DQPlatform — Sınaq imtahanı', desc, SITE + '/sinaq', SITE + '/?go=sinaq', head, hasCover ? `${SITE}/cover/${x._id}.jpg` : '');
    }

    /* 3) İmtahan qeydiyyatı (OG kart) */
    if (url.pathname.replace(/\/$/, '') === '/qeydiyyat') {
      const x = await liveExam(env).catch(() => null);
      const title = x ? `📢 ${x.type || 'Qəbul tipli sınaq'} — ${x.catline || x.cat}` : '📢 DQplatform — Sınaq qeydiyyatı';
      const desc = x
        ? `📅 ${dmy(x.start)} · ${hm(x.start)}–${hm(x.end || x.start)}\n🔒 Yalnız qeydiyyatdan keçmiş tələbələr · FİN kod ilə\n📝 Qeydiyyat üçün keçidə daxil olun`
        : 'Qeydiyyat üçün keçidə daxil olun';
      const hasCover = x && x.cover && /^data:image\//.test(x.cover);
      const img = hasCover ? `${SITE}/cover/${x._id}.jpg` : `${SITE}/og-image.jpg`;
      const html = ogPage({ title, desc, page: SITE + '/qeydiyyat', go: SITE + '/?reg=1', img, itype: '', iw: 0, ih: 0, type: 'website' });
      return new Response(head ? null : html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=120' } });
    }

    /* 4) Sınaq qapaq şəkli */
    const cm = url.pathname.match(/^\/cover\/(latest|\d+)\.jpg$/);
    if (cm) {
      let x = null;
      try {
        x = cm[1] === 'latest' ? await liveExam(env)
          : ((await (await sb(env, `collection=eq.liveexams&id=eq.${cm[1]}&select=id,data`)).json())[0] || {}).data;
      } catch (e) {}
      const m = x && String(x.cover || '').match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return Response.redirect(SITE + '/og-image.jpg', 302);
      return new Response(head ? null : unb64u(m[2].replace(/\+/g, '-').replace(/\//g, '_')), {
        headers: { 'content-type': m[1], 'cache-control': 'public,max-age=3600', 'access-control-allow-origin': '*' }
      });
    }

    /* 5) Push bildirişi */
    if (url.pathname === '/push/notify') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });
      if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) return new Response('forbidden', { status: 403, headers: CORS });
      if (!env.VAPID_PRIVATE || !env.VAPID_SUBJECT) return Response.json({ error: 'VAPID_PRIVATE / VAPID_SUBJECT təyin olunmayıb' }, { status: 500, headers: CORS });

      const subs = await (await sb(env, 'collection=eq.push_subs&select=id,data&limit=2000')).json();
      let sent = 0;
      await Promise.all(subs.map(async s => {
        try {
          const aud = new URL(s.data.endpoint).origin;
          const r = await fetch(s.data.endpoint, {
            method: 'POST',
            headers: { Authorization: `vapid t=${await vapidJwt(aud, env)}, k=${env.VAPID_PUBLIC || VAPID_PUBLIC_DEFAULT}`, TTL: '86400', Urgency: 'high', 'Content-Length': '0' }
          });
          if (r.ok) sent++;
          else if (r.status === 404 || r.status === 410) await sb(env, `id=eq.${s.id}`, { method: 'DELETE' });
        } catch (e) {}
      }));
      return Response.json({ sent, total: subs.length }, { headers: CORS });
    }

    return pass();
  }
};
