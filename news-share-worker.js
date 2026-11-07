/*
 * DQ Platform — xəbər paylaşma önizləməsi (WhatsApp / Telegram / Facebook)
 *
 * Paylaşılan link:  https://exam.dqplatform.workers.dev/n/<XƏBƏR_ID>
 *  - WhatsApp/Telegram bu linkin HTML-ini oxuyur (JavaScript işlətmir) və xəbərin
 *    öz başlığı, qısa mətni və KİÇİK qapaq şəkli ilə kart göstərir.
 *  - İnsan linkə toxunanda dərhal əsas sayta  /?news=<ID>  ünvanına yönlənir.
 *
 * Qoşulma: mövcud Worker-inizin fetch() funksiyasının əvvəlində:
 *
 *   import { handleNewsShare } from "./news-share-worker.js";
 *   ...
 *   const r = await handleNewsShare(request, env);
 *   if (r) return r;
 *
 * Lazım olan dəyişənlər (wrangler.toml / Dashboard → Variables):
 *   SUPABASE_URL, SUPABASE_ANON_KEY   (xəbərlər Supabase-dədirsə)
 *   NEWS_TABLE  (susmaya görə "news")
 * Xəbərlər başqa yerdədirsə (Firebase və s.), yalnız aşağıdakı getNews() dəyişir.
 */

const THUMB = 300;            // kiçik önizləmə (WhatsApp 300px-dən kiçik şəkli yan tərəfdə KİÇİK göstərir)
const SITE = "DQPlatform";

/* ---------- Xəbəri bazadan götür (yalnız bu hissəni öz bazanıza uyğunlaşdırın) ---------- */
export async function getNews(id, env) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const table = env.NEWS_TABLE || "news";
  const u = `${env.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
  const r = await fetch(u, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + env.SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? normalize(a[0]) : null;
}

/* müxtəlif sahə adlarını eyniləşdir */
export function normalize(x) {
  const pick = (...k) => { for (const n of k) if (x[n]) return String(x[n]); return ""; };
  return {
    title: pick("title", "headline", "name", "basliq"),
    text: pick("summary", "excerpt", "description", "short", "body", "content", "text"),
    image: pick("image_url", "image", "cover", "cover_url", "img", "photo", "qapaq"),
    date: pick("date", "created_at", "published_at")
  };
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plain = s => String(s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const ID_RX = /^[A-Za-z0-9_-]{1,64}$/;

export function previewHtml(origin, id, n) {
  const title = clip(plain(n.title) || SITE, 90);
  const desc = clip(plain(n.text), 160);
  const page = `${origin}/n/${id}`;
  const img = n.image ? `${origin}/nimg/${id}.jpg` : `${origin}/og-square.jpg?v=4`;
  const go = `${origin}/?news=${encodeURIComponent(id)}`;
  return `<!doctype html><html lang="az"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="az_AZ">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${THUMB}">
<meta property="og:image:height" content="${THUMB}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(page)}">
<meta http-equiv="refresh" content="0;url=${esc(go)}">
<script>location.replace(${JSON.stringify(go)})</script>
</head><body><p><a href="${esc(go)}">${esc(title)}</a></p></body></html>`;
}

/* ---------- Əsas giriş nöqtəsi ---------- */
export async function handleNewsShare(request, env, getter) {
  const url = new URL(request.url);
  const get = getter || getNews;

  /* 1) /n/<id> → xəbərə xas önizləmə səhifəsi */
  let m = /^\/n\/([^/]+)\/?$/.exec(url.pathname);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!ID_RX.test(id)) return Response.redirect(url.origin + "/", 302);
    let n = null;
    try { n = await get(id, env); } catch (e) { n = null; }
    if (!n || !n.title) return Response.redirect(url.origin + "/", 302);
    return new Response(previewHtml(url.origin, id, n), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" }
    });
  }

  /* 2) /nimg/<id>.jpg → xəbərin qapaq şəkli, KİÇİK kvadrat (300×300) */
  m = /^\/nimg\/([^/]+)\.jpg$/.exec(url.pathname);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!ID_RX.test(id)) return new Response("not found", { status: 404 });
    let n = null;
    try { n = await get(id, env); } catch (e) { n = null; }
    if (!n || !n.image) return Response.redirect(url.origin + "/og-square.jpg?v=4", 302);
    const src = new URL(n.image, url.origin).toString();
    let r;
    try { r = await fetch(src, { cf: { image: { width: THUMB, height: THUMB, fit: "cover", quality: 80, format: "jpeg" } } }); } catch (e) { r = null; }
    if (!r || !r.ok) { try { r = await fetch(src); } catch (e) { r = null; } }   // Image Resizing yoxdursa orijinalı ver
    if (!r || !r.ok) return Response.redirect(url.origin + "/og-square.jpg?v=4", 302);
    return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=86400" } });
  }
  return null;   // başqa sorğular — mövcud Worker davam etsin
}

export default { fetch: async (req, env) => (await handleNewsShare(req, env)) || new Response("not found", { status: 404 }) };
