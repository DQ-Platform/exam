/*
 * DQ Platform — xəbər linki önizləməsi (WhatsApp / Telegram / Facebook)
 *
 * Paylaşılan link (saytın özünün formatı):  https://exam.dqplatform.workers.dev/news?id=<ID>
 *
 * Bu modul /news?id=<ID> sorğusunda saytın NORMAL səhifəsini (heç nə pozulmur, xəbər əvvəlki kimi açılır)
 * qaytarır, yalnız <head> içindəki önizləmə teqlərini həmin xəbərin başlığı, qısa mətni və
 * KİÇİK kvadrat qapaq şəkli ilə əvəz edir. WhatsApp/Telegram yalnız bu teqləri oxuyur.
 *
 * Qoşulma — Worker-inizin fetch() funksiyasının ƏN əvvəlinə:
 *
 *   import { handleNewsShare } from "./news-share-worker.js";
 *   export default {
 *     async fetch(request, env, ctx) {
 *       const r = await handleNewsShare(request, env);
 *       if (r) return r;
 *       ...əvvəlki kodunuz (məs. return env.ASSETS.fetch(request))
 *     }
 *   }
 */

const SUPABASE_URL = "https://cpzwliqlgaplroscvduo.supabase.co";
const SUPABASE_KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";   // saytda artıq açıq olan publishable açar
const THUMB = 400;            // kvadrat önizləmə: WhatsApp onu yan tərəfdə KİÇİK kart kimi göstərir
const SITE = "DQPlatform";
const ID_RX = /^[A-Za-z0-9_-]{1,64}$/;

/* ---------- xəbəri Supabase-dən götür ---------- */
export async function getNews(id, env) {
  const U = (env && env.SUPABASE_URL) || SUPABASE_URL, K = (env && env.SUPABASE_ANON_KEY) || SUPABASE_KEY;
  const u = `${U}/rest/v1/dq_v2_store?select=id,data&collection=eq.news&id=eq.${encodeURIComponent(id)}&limit=1`;
  const r = await fetch(u, { headers: { apikey: K } });
  if (!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? normalize(a[0].data || a[0]) : null;
}

/* müxtəlif sahə adlarını eyniləşdir; şəkil üçün URL / data: dəyərini axtar */
export function normalize(x) {
  x = x || {};
  const pick = (...k) => { for (const n of k) if (typeof x[n] === "string" && x[n].trim()) return x[n]; return ""; };
  let image = pick("img", "image", "cover", "photo", "pic", "thumb", "imageUrl", "image_url", "cover_url", "qapaq", "banner", "src", "url");
  if (!/^(https?:\/\/|data:image\/|\/)/i.test(image)) image = "";
  if (!image) for (const k in x) { const v = x[k]; if (typeof v === "string" && (/^https?:\/\/\S+\.(jpe?g|png|webp|gif)(\?\S*)?$/i.test(v) || /^data:image\//i.test(v))) { image = v; break; } }
  return {
    title: pick("title", "baslik", "headline", "name", "t"),
    text: pick("summary", "short", "excerpt", "desc", "description", "lead", "text", "body", "content", "html", "d"),
    image
  };
}

const plain = s => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/* önizləmə teqlərinin yeni dəyərləri */
export function metaMap(origin, id, n) {
  const title = clip(plain(n.title) || SITE, 90), desc = clip(plain(n.text), 160);
  const page = `${origin}/news?id=${encodeURIComponent(id)}`;
  const img = n.image ? `${origin}/nimg/${encodeURIComponent(id)}.jpg` : null;
  const m = {
    "description": desc,
    "og:type": "article", "og:title": title, "og:description": desc, "og:url": page,
    "twitter:card": "summary", "twitter:title": title, "twitter:description": desc
  };
  if (img) Object.assign(m, {
    "og:image": img, "og:image:secure_url": img, "og:image:type": "image/jpeg",
    "og:image:width": String(THUMB), "og:image:height": String(THUMB), "og:image:alt": title, "twitter:image": img
  });
  return { map: m, title };
}

/* ---------- əsas giriş nöqtəsi ---------- */
export async function handleNewsShare(request, env, opts) {
  opts = opts || {};
  const url = new URL(request.url);
  const get = opts.getNews || getNews;
  const origin = opts.origin || (req => (env && env.ASSETS ? env.ASSETS.fetch(req) : fetch(req)));
  const rewriter = opts.rewriter || (() => new HTMLRewriter());

  /* 1) /nimg/<id>.jpg → xəbərin qapaq şəkli (kiçik kvadrat) */
  let m = /^\/nimg\/([^/]+)\.jpg$/.exec(url.pathname);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const fallback = () => Response.redirect(url.origin + "/og-square.jpg?v=4", 302);
    if (!ID_RX.test(id)) return fallback();
    let n = null; try { n = await get(id, env); } catch (e) {}
    if (!n || !n.image) return fallback();
    const hdr = ct => ({ "content-type": ct || "image/jpeg", "cache-control": "public, max-age=86400" });
    const dm = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(n.image);
    if (dm) { const bin = atob(dm[2].replace(/\s/g, "")), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new Response(b, { headers: hdr(dm[1]) }); }
    const src = new URL(n.image, url.origin).toString();
    let r = null;
    try { r = await fetch(src, { cf: { image: { width: THUMB, height: THUMB, fit: "cover", quality: 80, format: "jpeg" } } }); } catch (e) {}
    if (!r || !r.ok) { try { r = await fetch(src); } catch (e) { r = null; } }       // Image Resizing yoxdursa orijinalı ver
    if (!r || !r.ok) return fallback();
    return new Response(r.body, { headers: hdr(r.headers.get("content-type")) });
  }

  /* 2) /news?id=<ID>  (və ?news=<ID>) → normal səhifə + xəbərə xas önizləmə teqləri */
  const isNews = url.pathname.replace(/\/+$/, "") === "/news" || url.searchParams.has("news");
  const id = url.searchParams.get("id") || url.searchParams.get("news") || ((/^\/news\/([^/]+)/.exec(url.pathname) || [])[1]);
  if (!isNews || !id || !ID_RX.test(id) || (request.method !== "GET" && request.method !== "HEAD")) return null;
  let n = null; try { n = await get(id, env); } catch (e) {}
  if (!n || !n.title) return null;                                 // tapılmadısa sayt əvvəlki kimi açılsın

  let res = await origin(request);
  if (!res || !res.ok || !/text\/html/i.test(res.headers.get("content-type") || "")) res = await origin(new Request(url.origin + "/", request));
  const { map, title } = metaMap(url.origin, id, n);
  const rw = rewriter()
    .on("title", { element(e) { e.setInnerContent(title); } })
    .on("meta", { element(e) {
      const k = e.getAttribute("property") || e.getAttribute("name");
      if (k && Object.prototype.hasOwnProperty.call(map, k)) e.setAttribute("content", map[k]);
    } });
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "public, max-age=300");
  out.headers.delete("content-length");
  return rw.transform(out);
}

export default { fetch: async (req, env) => (await handleNewsShare(req, env)) || new Response("not found", { status: 404 }) };
