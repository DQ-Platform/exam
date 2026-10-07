// Cloudflare Worker — xəbər linki (/news?id=...) üçün WhatsApp/Telegram önizləməsi (qapaq şəkli + başlıq)
// Quraşdırma: Workers → exam (saytı verən worker) → Edit code → bu kodu əvvəlinə/üzərinə əlavə et.
const SB = 'https://cpzwliqlgaplroscvduo.supabase.co';
const KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';
const SITE = 'https://exam.dqplatform.workers.dev';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function findNews(id) {
  const q = /^\d+$/.test(id) ? `or=(data->>slug.eq.${id},id.eq.${id})` : `data->>slug=eq.${encodeURIComponent(id)}`;
  const r = await fetch(`${SB}/rest/v1/dq_v2_store?select=id,data&collection=eq.news&${q}&limit=1`, { headers: { apikey: KEY } });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? { ...rows[0].data, _id: rows[0].id } : null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pass = () => (env.ASSETS ? env.ASSETS.fetch(request) : fetch(request));

    // 1) Qapaq şəkli: data:image/jpeg;base64 → real JPEG
    if (url.pathname === '/news-img') {
      const n = await findNews(url.searchParams.get('id') || '');
      const m = n && /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(n.img || '');
      if (!m) return Response.redirect(SITE + '/og-image.jpg', 302);
      const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400' } });
    }

    // 2) Xəbər səhifəsi: bot-lar üçün OG meta, insanlar üçün saytın xəbərinə yönləndirmə
    if (url.pathname.replace(/\/$/, '') === '/news') {
      const id = url.searchParams.get('id') || '';
      const n = id && await findNews(id);
      if (!n) return pass();
      const key = n.slug || n._id;
      const desc = (n.sum || String(n.body || '').replace(/\s+/g, ' ')).slice(0, 180);
      const img = n.img ? `${SITE}/news-img?id=${encodeURIComponent(key)}` : `${SITE}/og-image.jpg`;
      const page = `${SITE}/news?id=${encodeURIComponent(key)}`;
      const go = `${SITE}/?news=${encodeURIComponent(key)}`;
      const html = `<!doctype html><html lang="az"><head><meta charset="utf-8">
<title>${esc(n.title)} | DQPlatform</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="DQPlatform">
<meta property="og:title" content="${esc(n.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="720">
<meta property="og:image:height" content="900">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(n.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(go)}">
</head><body><script>location.replace(${JSON.stringify(go)})</script><a href="${esc(go)}">${esc(n.title)}</a></body></html>`;
      return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'public, max-age=300' } });
    }

    return pass();
  }
};
// ═══════════════════════════════════════════════════════════
// YAMAQ 2/2 — Cloudflare Worker (exam.dqplatform.workers.dev)
// Səbəb: şəkil bazada base64 saxlanır, WhatsApp/Telegram isə og:image üçün
// real https linki (jpeg/png) tələb edir. Worker həm /news-img?id=... verir,
// həm də /news?id=... səhifəsinin og: teqlərinə bu linki yazır.
// ═══════════════════════════════════════════════════════════
const SB  = 'https://cpzwliqlgaplroscvduo.supabase.co';
const KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';

async function getNews(id) {
  const q = /^\d+$/.test(id) ? 'id=eq.' + id : 'data->>slug=eq.' + encodeURIComponent(id);
  const r = await fetch(`${SB}/rest/v1/dq_v2_store?select=id,data&collection=eq.news&${q}&limit=1`,
    { headers: { apikey: KEY } });
  const a = r.ok ? await r.json() : [];
  return a[0] ? { ...a[0].data, _id: a[0].id } : null;
}
const clean = (s, n) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const id = u.searchParams.get('id');

    /* ── 1) Qapaq şəkli: base64 → real şəkil faylı ── */
    if (u.pathname === '/news-img' && id) {
      const n = await getNews(id);
      const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec((n && n.img) || '');
      if (!m) return Response.redirect(u.origin + '/og-image.jpg', 302);
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400, s-maxage=86400' }
      });
    }

    /* ── 2) Paylaşılan xəbər linki: og teqləri ── */
    if (u.pathname === '/news' && id) {
      const page = await env.ASSETS.fetch(new Request(u.origin + '/', req)); // index.html
      const n = await getNews(id);
      if (!n) return page;

      const link  = `${u.origin}/news?id=${encodeURIComponent(n.slug || n._id)}`;
      const title = 'DQPlatform - ' + clean(n.title, 120);
      const desc  = clean(n.sum || n.body, 200) || 'DQPlatform Exam';
      const hasImg = /^data:image\//.test(n.img || '');
      const image = hasImg ? `${u.origin}/news-img?id=${encodeURIComponent(n.slug || n._id)}`
                           : `${u.origin}/og-image.jpg`;
      const set = {
        'og:title': title, 'twitter:title': title,
        'og:description': desc, 'twitter:description': desc, 'description': desc,
        'og:url': link,
        'og:image': image, 'og:image:secure_url': image, 'twitter:image': image,
        ...(hasImg ? { 'og:image:width': '720', 'og:image:height': '900', 'og:image:type': 'image/jpeg' } : {})
      };
      return new HTMLRewriter()
        .on('meta', { element(el) {
          const k = el.getAttribute('property') || el.getAttribute('name');
          if (k in set) el.setAttribute('content', set[k]);
        }})
        .on('title', { element(el) { el.setInnerContent(title); } })
        .transform(new Response(page.body, { status: 200, headers: page.headers }));
    }

    return env.ASSETS.fetch(req);
  }
};

