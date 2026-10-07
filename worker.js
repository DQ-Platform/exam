// Cloudflare Worker — xəbər linki (/news?id=...) üçün WhatsApp/Telegram/Facebook "böyük kart" önizləməsi
// Quraşdırma: Workers → exam → Edit code → bu kodu tam əvəz et → Deploy.
const SB = 'https://cpzwliqlgaplroscvduo.supabase.co';
const KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';
const SITE = 'https://exam.dqplatform.workers.dev';
const FALLBACK = { url: SITE + '/og-image.jpg', type: 'image/jpeg', w: 988, h: 668 }; // şəkli olmayan elanlar üçün (landscape)

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, n) => {
  s = String(s ?? '').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};

async function findNews(id) {
  id = String(id || '').trim();
  if (!id || id.length > 80) return null;
  const q = /^\d+$/.test(id)
    ? `or=(data->>slug.eq.${id},id.eq.${id})`
    : `data->>slug=eq.${encodeURIComponent(id)}`;
  try {
    const r = await fetch(`${SB}/rest/v1/dq_v2_store?select=id,data&collection=eq.news&${q}&limit=1`, { headers: { apikey: KEY } });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] ? { ...rows[0].data, _id: rows[0].id } : null;
  } catch (e) { return null; }
}

// data:image/...;base64,XXXX → { type, bytes, w, h }
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

// Şəklin real ölçüsünü başlıqdan oxu (JPEG/PNG) — og:image:width/height düzgün olsun
function dims(b, type) {
  try {
    if (type === 'image/png') {
      const dv = new DataView(b.buffer, b.byteOffset);
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    if (type === 'image/jpeg' || type === 'image/jpg') {
      let i = 2;
      while (i < b.length) {
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pass = () => (env.ASSETS ? env.ASSETS.fetch(request) : fetch(request));
    const head = request.method === 'HEAD';

    // 0) Diaqnostika: /news-debug?id=... → Worker nəyi tapdı, hansı şəkli verir
    if (url.pathname === '/news-debug') {
      const id = url.searchParams.get('id') || '';
      const n = await findNews(id);
      const pick = n && (decodeDataUrl(n.og) || decodeDataUrl(n.img));
      let fb = null;
      try { const r = await fetch(FALLBACK.url, { method: 'HEAD' }); fb = { status: r.status, type: r.headers.get('content-type'), bytes: r.headers.get('content-length') }; } catch (e) { fb = String(e); }
      return new Response(JSON.stringify({
        worker: 'v3', found: !!n, title: n && n.title, slug: n && n.slug, id: n && n._id,
        hasImg: !!(n && n.img), hasOg: !!(n && n.og), imgKind: n && n.img ? String(n.img).slice(0, 20) : null,
        chosen: pick ? { type: pick.type, bytes: pick.bytes.length, w: pick.w, h: pick.h, whatsappOk: pick.bytes.length < 300000 } : 'fallback',
        fallback: fb
      }, null, 2), { headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store' } });
    }

    // 1) Qapaq şəkli: data:image → real şəkil (Cloudflare keşi ilə)
    if (url.pathname === '/news-img') {
      const id = url.searchParams.get('id') || '';
      const cache = caches.default;
      const ck = new Request(url.origin + '/news-img?id=' + encodeURIComponent(id) + '&v=' + encodeURIComponent(url.searchParams.get('v') || ''));
      const hit = await cache.match(ck);
      if (hit) return head ? new Response(null, hit) : hit;

      const n = await findNews(id);
      const im = n && (n.og || n.img);   // og = saytın yaratdığı 1200x630 önizləmə şəkli
      if (im && /^https?:\/\//i.test(im)) return Response.redirect(im, 302);
      const d = decodeDataUrl(im);
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

    // 2) Xəbər səhifəsi: bot-lar üçün OG meta, insanlar üçün saytın xəbərinə yönləndirmə
    if (url.pathname.replace(/\/$/, '') === '/news') {
      const id = url.searchParams.get('id') || '';
      const n = await findNews(id);
      if (!n) return pass();

      const key = n.slug || n._id;
      const title = clean(n.title, 90) || 'DQPlatform';
      const desc = clean(n.sum || n.body, 200) || 'DQPlatform — dövlət qulluğu imtahanlarına hazırlıq platforması';
      const page = `${SITE}/news?id=${encodeURIComponent(key)}`;
      const go = `${SITE}/?news=${encodeURIComponent(key)}`;

      // Şəkil seçimi
      let img = FALLBACK.url, itype = FALLBACK.type, iw = FALLBACK.w, ih = FALLBACK.h;
      const d = decodeDataUrl(n.og) || decodeDataUrl(n.img);
      if (d) {
        // v = şəklin ölçüsü → şəkil dəyişəndə link də dəyişir, WhatsApp köhnə keşi göstərmir
        img = `${SITE}/news-img?id=${encodeURIComponent(key)}&v=${d.bytes.length}`;
        itype = d.type; iw = d.w; ih = d.h;
      } else if (/^https?:\/\//i.test(n.img || '')) {
        img = n.img; itype = ''; iw = 0; ih = 0;
      }

      const html = `<!doctype html><html lang="az"><head><meta charset="utf-8">
<title>${esc(title)} | DQPlatform</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(page)}">
<meta property="og:type" content="article">
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
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(go)}">
</head><body><script>location.replace(${JSON.stringify(go).replace(/</g, '\\u003c')})</script><a href="${esc(go)}">${esc(title)}</a></body></html>`;

      return new Response(head ? null : html, { headers: {
        'content-type': 'text/html;charset=utf-8',
        'cache-control': 'public, max-age=300'
      } });
    }

    return pass();
  }
}
