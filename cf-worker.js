// Cloudflare Worker: şəkil yüklə (POST /upload), göstər (GET /i/<ad>) və imtahan suallarını keşləyib ver (GET /rest/exam_questions?...).
// R2 binding: BUCKET · secret: UPLOAD_KEY · (tövsiyə) KV binding: CACHE · (istəyə görə) SUPABASE_URL, SUPABASE_KEY
const DEF_URL = "https://cpzwliqlgaplroscvduo.supabase.co";
const DEF_KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
const FRESH = 300; // saniyə: bu müddət ərzində Supabase-ə getmir
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "x-key,content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Expose-Headers": "x-edge"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (req.method === "GET" && u.pathname === "/rest/exam_questions") {
      const qs = u.search;
      if (qs.length > 600 || !/exam_id=eq\./.test(qs) || !/category=eq\./.test(qs))
        return new Response("bad request", { status: 400, headers: cors });
      const key = "q:" + qs, now = Date.now();
      const kv = env.CACHE;
      let c = null;
      if (kv) { try { c = await kv.get(key, "json"); } catch (e) {} }
      const out = (body, tag, status = 200) => new Response(body, { status, headers: {
        ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60", "x-edge": tag } });
      if (c && now - c.t < FRESH * 1000) return out(c.d, "HIT");
      try {
        const o = await fetch((env.SUPABASE_URL || DEF_URL) + "/rest/v1/exam_questions" + qs,
          { headers: { apikey: env.SUPABASE_KEY || DEF_KEY, Accept: "application/json" } });
        if (!o.ok) throw new Error("origin " + o.status);
        const body = await o.text();
        if (kv) ctx.waitUntil(kv.put(key, JSON.stringify({ t: now, d: body }), { expirationTtl: 3600 }));
        return out(body, kv ? "MISS" : "NOCACHE");
      } catch (e) {
        if (c) return out(c.d, "STALE");
        return new Response("origin error", { status: 502, headers: cors });
      }
    }

    if (req.method === "POST" && u.pathname === "/upload") {
      if (req.headers.get("x-key") !== env.UPLOAD_KEY)
        return new Response("forbidden", { status: 403, headers: cors });
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 4e6) return new Response("too big", { status: 413, headers: cors });
      const h = await crypto.subtle.digest("SHA-256", buf);
      const hex = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
      const type = req.headers.get("content-type") || "image/png";
      const ext = type.includes("webp") ? "webp" : type.includes("jpeg") ? "jpg" : "png";
      const key = hex + "." + ext;            // eyni şəkil = eyni ad (təkrar yazılmır)
      await env.BUCKET.put(key, buf, { httpMetadata: { contentType: type } });
      return Response.json({ url: u.origin + "/i/" + key }, { headers: cors });
    }

    if (req.method === "GET" && u.pathname.startsWith("/i/")) {
      const cache = caches.default;
      let r = await cache.match(req);
      if (r) return r;
      const o = await env.BUCKET.get(u.pathname.slice(3));
      if (!o) return new Response("yoxdur", { status: 404, headers: cors });
      r = new Response(o.body, { headers: {
        ...cors,
        "Content-Type": o.httpMetadata?.contentType || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable"
      }});
      ctx.waitUntil(cache.put(req, r.clone()));
      return r;
    }
    return new Response("DQ image host OK", { headers: cors });
  }
};
