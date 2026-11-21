// DQPlatform — vahid Cloudflare Worker (exam)
// Marşrutlar:
//   /news?id=...        → xəbər üçün şəkilli önizləmə kartı (WhatsApp / Telegram / Facebook), insanı sayta yönləndirir
//   /news-img?id=...    → xəbərin önizləmə şəkli (data:image → real şəkil, keşlənir)
//   /news-debug?id=...  → diaqnostika
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

// Mərkəzi baza = Firebase Firestore (sayt dq-firebase.js ilə eyni layihə). Worker oxu/yazmanı Firestore REST ilə edir.
const FS_PROJECT = 'dq-platform-bdaf3';
const FS_KEY = 'AIzaSyA6mD_qCRIcc8gIEsZB1EiEbUozZeMmd34'; // ictimai web açarı (dq-firebase.js ilə eynidir)
const FS_DOCS = `https://firestore.googleapis.com/v1/projects/${FS_PROJECT}/databases/(default)/documents`;
const FS_T = 'dq_v2_store';
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

/* ---------------- Mərkəzi baza (Firestore REST) ---------------- */
function fsVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}; for (const k in (v.mapValue.fields || {})) o[k] = fsVal(v.mapValue.fields[k]); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  return null;
}
async function fsFetch(url, init, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'key=' + FS_KEY, init);
      if (r.status < 500 && r.status !== 429) return r;
      last = new Error('Firestore ' + r.status);
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 250 * (i + 1) * (i + 1)));
  }
  throw last;
}
// Sənəd → { id, data, collection } (sətir formatı dq-firebase.js ilə eyni: j_* = JSON, _big = hissələrə bölünmüş)
async function fsRow(doc) {
  const f = doc.fields || {}, id = String(doc.name || '').split('/').pop();
  let row;
  if (f._big) {
    const r = await fsFetch(`${FS_DOCS}/${FS_T}/${id}/p?pageSize=300`);
    const parts = ((await r.json()).documents || []).map(d => ({ i: fsVal(d.fields.i), s: fsVal(d.fields.s) })).sort((a, b) => a.i - b.i);
    row = JSON.parse(parts.map(p => p.s).join(''));
  } else {
    row = {};
    for (const k in f) {
      if (k === '_big' || k.startsWith('d_')) continue;
      if (k.startsWith('j_')) { try { row[k.slice(2)] = JSON.parse(f[k].stringValue); } catch (e) { row[k.slice(2)] = null; } }
      else row[k] = fsVal(f[k]);
    }
  }
  const n = row.id != null ? Number(row.id) : Number(id);
  return { id: isNaN(n) ? id : n, collection: row.collection, data: row.data || {} };
}
async function dbQuery(collection, where = [], limit = 50) {
  const filters = [{ fieldFilter: { field: { fieldPath: 'collection' }, op: 'EQUAL', value: { stringValue: collection } } }];
  for (const [k, v] of where) filters.push({ fieldFilter: { field: { fieldPath: 'd_' + k }, op: 'EQUAL', value: { stringValue: String(v) } } });
  const r = await fsFetch(`${FS_DOCS}:runQuery`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: FS_T }], where: { compositeFilter: { op: 'AND', filters } }, limit } })
  });
  if (!r.ok) return [];
  const rows = await Promise.all((await r.json()).filter(x => x.document).map(x => fsRow(x.document)));
  return rows.sort((a, b) => Number(b.id) - Number(a.id));
}
async function dbGet(id, collection) {
  const r = await fsFetch(`${FS_DOCS}/${FS_T}/${encodeURIComponent(String(id))}`);
  if (!r.ok) return null;
  const row = await fsRow(await r.json());
  return !collection || row.collection === collection ? row : null;
}
async function dbDelete(id) {
  await fsFetch(`${FS_DOCS}/${FS_T}/${encodeURIComponent(String(id))}`, { method: 'DELETE' }, 1).catch(() => {});
}
async function findNews(id) {
  id = String(id || '').trim();
  if (!id || id.length > 80) return null;
  // Xəbər linkindəki id slug, data.id, data.nid və ya sətrin öz nömrəsi ola bilər — hamısı yoxlanılır
  const tries = [['slug', id], ['id', id], ['nid', id]];
  for (const w of tries) {
    try {
      const rows = await dbQuery('news', [w], 1);
      if (rows[0]) return { ...rows[0].data, _id: rows[0].id };
    } catch (x) {}
  }
  if (/^\d+$/.test(id)) {
    try { const row = await dbGet(id, 'news'); if (row) return { ...row.data, _id: row.id }; } catch (x) {}
  }
  return null;
}

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
// Xəbər üçün ən yaxşı şəkil: əvvəl og (kvadrat önizləmə), sonra img — yalnız WhatsApp limitinə sığırsa
function pickImage(n) {
  const og = decodeDataUrl(n.og);
  if (og && og.bytes.length < WA_MAX) return og;
  const im = decodeDataUrl(n.img);
  if (im && im.bytes.length < WA_MAX) return im;
  return null;
}

/* ---------------- Web Push (VAPID) ---------------- */
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const baku = (d, o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', ...o }).format(new Date(d));
const dmy = d => baku(d, { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
const hm = d => baku(d, { hour: '2-digit', minute: '2-digit', hour12: false });

async function liveExam(env) {
  const l = (await dbQuery('liveexams', [], 10)).map(x => ({ ...x.data, _id: x.id }));
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

    /* 0) Diaqnostika */
    if (url.pathname === '/news-debug') {
      const id = url.searchParams.get('id') || '';
      const n = await findNews(id);
      const pick = n && pickImage(n);
      let fb;
      try { const r = await fetch(FALLBACK.url, { method: 'HEAD' }); fb = { status: r.status, type: r.headers.get('content-type'), bytes: r.headers.get('content-length') }; } catch (e) { fb = String(e); }
      return new Response(JSON.stringify({
        worker: 'v5', found: !!n, title: n && n.title, slug: n && n.slug, id: n && n._id,
        hasImg: !!(n && n.img), hasOg: !!(n && n.og),
        chosen: pick ? { type: pick.type, bytes: pick.bytes.length, w: pick.w, h: pick.h } : 'fallback',
        fallback: fb
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
      const ext = n && (/^https?:\/\//i.test(n.og || '') ? n.og : /^https?:\/\//i.test(n.img || '') ? n.img : '');
      if (ext) return Response.redirect(ext, 302);
      const d = n && pickImage(n);
      if (!d) return Response.redirect(FALLBACK.url, 302);

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
      if (!id) return section('Xəbərlər', '📰 DQPlatform — Xəbərlər və elanlar', 'İmtahan elanları, qanunvericilikdə dəyişikliklər və yeniliklər bir yerdə.', SITE + '/news', SITE + '/?go=news', head);
      const n = await findNews(id);
      if (!n) return Response.redirect(SITE + '/?go=news', 302);

      const key = n.slug || n.id || n._id;
      const title = clean(n.title, 90) || 'DQPlatform';
      const desc = clean(n.sum || n.body, 200) || 'DQPlatform — dövlət qulluğu imtahanlarına hazırlıq platforması';
      const page = `${SITE}/news?id=${encodeURIComponent(key)}`;
      const go = `${SITE}/?news=${encodeURIComponent(key)}`;

      let img = FALLBACK.url, itype = FALLBACK.type, iw = FALLBACK.w, ih = FALLBACK.h;
      const d = pickImage(n);
      if (d) {
        img = `${SITE}/news-img?id=${encodeURIComponent(key)}&v=${d.bytes.length}`;
        itype = d.type; iw = d.w; ih = d.h;
      } else if (/^https?:\/\//i.test(n.og || n.img || '')) {
        img = n.og || n.img; itype = ''; iw = 0; ih = 0;
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
          : ((await dbGet(cm[1], 'liveexams')) || {}).data;
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

      const subs = await dbQuery('push_subs', [], 2000);
      let sent = 0;
      await Promise.all(subs.map(async s => {
        try {
          const aud = new URL(s.data.endpoint).origin;
          const r = await fetch(s.data.endpoint, {
            method: 'POST',
            headers: { Authorization: `vapid t=${await vapidJwt(aud, env)}, k=${env.VAPID_PUBLIC || VAPID_PUBLIC_DEFAULT}`, TTL: '86400', Urgency: 'high', 'Content-Length': '0' }
          });
          if (r.ok) sent++;
          else if (r.status === 404 || r.status === 410) await dbDelete(s.id);
        } catch (e) {}
      }));
      return Response.json({ sent, total: subs.length }, { headers: CORS });
    }

    return pass();
  }
};
