/**
 * DQPlatform – xəbər linki önizləməsi (WhatsApp / Telegram / Facebook ...)
 *
 * /news?id=<slug|id>   -> saytın index.html-i, amma og:title / og:description / og:image xəbərə görə dəyişdirilir
 * /cover?id=<slug|id>  -> xəbərin qapaq şəklini (bazada base64 kimi saxlanılır) real JPEG kimi qaytarır
 *
 * Mövcud Worker-inizdə /news və /cover üçün artıq kod varsa, onu bununla əvəz edin.
 * Qalan bütün sorğular olduğu kimi statik fayllara (env.ASSETS) ötürülür.
 */
const SB = 'https://cpzwliqlgaplroscvduo.supabase.co';
const KEY = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF';
const BASE = 'https://exam.dqplatform.workers.dev';

async function getNews(id) {
  const p = new URLSearchParams({ select: 'id,data', collection: 'eq.news', limit: '1' });
  if (/^\d+$/.test(id)) p.set('id', 'eq.' + id); else p.set('data->>slug', 'eq.' + id);
  const r = await fetch(`${SB}/rest/v1/dq_v2_store?${p}`, { headers: { apikey: KEY } });
  if (!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? Object.assign({}, a[0].data, { _id: a[0].id }) : null;
}

const clip = (t, n) => {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    /* ---- qapaq şəkli ---- */
    if (url.pathname === '/cover' && id) {
      const n = await getNews(id).catch(() => null);
      const m = n && n.img && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(n.img);
      if (!m) return Response.redirect(BASE + '/og-image.jpg', 302);
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' },
      });
    }

    /* ---- xəbər linki: index.html + xəbərə uyğun meta teqlər ---- */
    if (url.pathname.replace(/\/$/, '') === '/news' && id) {
      const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      const n = await getNews(id).catch(() => null);
      if (!n) return page;

      const title = 'DQPlatform - ' + n.title;
      const desc = clip(n.sum || n.body, 160);
      const hasImg = !!(n.img && /^data:image\//.test(n.img));
      const img = hasImg ? `${BASE}/cover?id=${encodeURIComponent(id)}&v=${n.img.length}` : `${BASE}/og-image.jpg`;
      const link = `${BASE}/news?id=${encodeURIComponent(id)}`;
      const set = (v) => ({ element(e) { e.setAttribute('content', v); } });

      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(title); } })
        .on('meta[property="og:title"]', set(title))
        .on('meta[name="twitter:title"]', set(title))
        .on('meta[property="og:description"]', set(desc))
        .on('meta[name="twitter:description"]', set(desc))
        .on('meta[name="description"]', set(desc))
        .on('meta[property="og:url"]', set(link))
        .on('meta[property="og:type"]', set('article'))
        .on('meta[property="og:image"]', set(img))
        .on('meta[property="og:image:secure_url"]', set(img))
        .on('meta[name="twitter:image"]', set(img))
        .on('meta[property="og:image:type"]', set(hasImg ? 'image/jpeg' : 'image/jpeg'))
        .on('meta[property="og:image:width"]', set(hasImg ? '720' : '988'))
        .on('meta[property="og:image:height"]', set(hasImg ? '900' : '668'))
        .transform(page);
    }

    return env.ASSETS.fetch(request);
  },
};
