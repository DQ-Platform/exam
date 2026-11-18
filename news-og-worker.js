/* DQ Platform — xəbər linkləri üçün şəxsi önbaxış (Open Graph) Worker-i
   /news?id=XXXX  → index.html qaytarır, amma og:title / og:description / og:image xəbərə görə dəyişir
   /og-news?id=XXXX → xəbərin qapaq şəkli (base64 və ya URL-dən)
   Tələb: static assets binding adı ASSETS (wrangler: assets = { binding = "ASSETS", directory = "./" })
   Mövcud _worker.js varsa, aşağıdakı handle() məntiqini onun fetch-inə əlavə edin. */

const SU = "https://cpzwliqlgaplroscvduo.supabase.co";
const SK = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
const ID_KEYS = ["id", "nid", "slug", "key", "uid"];            // data içində id saxlanan açarlar
const T_KEYS = ["title", "t", "baslik", "name", "head"];
const B_KEYS = ["body", "text", "desc", "description", "txt", "content", "summary"];
const I_KEYS = ["img", "image", "cover", "photo", "pic", "thumb", "qapaq", "poster"];

const pick = (d, ks) => { for (const k of ks) if (d && d[k] && typeof d[k] === "string") return d[k]; return ""; };
const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function sb(q) {
  const r = await fetch(SU + "/rest/v1/dq_v2_store?select=id,data&collection=eq.news&" + q + "&limit=1",
    { headers: { apikey: SK, Authorization: "Bearer " + SK }, cf: { cacheTtl: 60, cacheEverything: true } });
  if (!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? a[0] : null;
}
async function findNews(id) {
  id = String(id || "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!id) return null;
  for (const k of ID_KEYS) { const row = await sb("data->>" + k + "=eq." + id); if (row) return row; }
  if (/^\d+$/.test(id)) return await sb("id=eq." + id);
  return null;
}

async function handle(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/og-news") {
    const row = await findNews(url.searchParams.get("id"));
    const img = row ? pick(row.data, I_KEYS) : "";
    if (!img) return Response.redirect(url.origin + "/og-square.jpg?v=4", 302);
    const m = img.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
    if (m) {
      const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: { "content-type": m[1], "cache-control": "public, max-age=3600" } });
    }
    return Response.redirect(new URL(img, url.origin).href, 302);
  }

  if (url.pathname === "/news" || url.pathname === "/news/") {
    const id = url.searchParams.get("id");
    const page = await env.ASSETS.fetch(new Request(url.origin + "/", request));
    const row = await findNews(id);
    if (!row) return page;
    const d = row.data || {};
    const title = strip(pick(d, T_KEYS)) || "DQPlatform xəbər";
    const desc = strip(pick(d, B_KEYS)).slice(0, 180) || "Dövlət qulluğu xəbərləri — DQPlatform";
    const link = url.origin + "/news?id=" + encodeURIComponent(id);
    const image = url.origin + "/og-news?id=" + encodeURIComponent(id);
    const set = (name, val) => ({ element(e) { e.setAttribute("content", val); } });
    return new HTMLRewriter()
      .on('meta[property="og:title"]', set("", title))
      .on('meta[property="og:description"]', set("", desc))
      .on('meta[property="og:url"]', set("", link))
      .on('meta[property="og:type"]', set("", "article"))
      .on('meta[property="og:image"]', set("", image))
      .on('meta[property="og:image:secure_url"]', set("", image))
      .on('meta[property="og:image:width"]', set("", "1200"))
      .on('meta[property="og:image:height"]', set("", "630"))
      .on('meta[name="twitter:card"]', set("", "summary_large_image"))
      .on('meta[name="twitter:title"]', set("", title))
      .on('meta[name="twitter:description"]', set("", desc))
      .on('meta[name="twitter:image"]', set("", image))
      .on("title", { element(e) { e.setInnerContent(title); } })
      .transform(new Response(page.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } }));
  }
  return env.ASSETS.fetch(request);
}

export default { fetch: handle };
