// Cloudflare Worker: şəkil yüklə (POST /upload) və göstər (GET /i/<ad>). R2 binding adı: BUCKET, secret: UPLOAD_KEY
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "x-key,content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

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
