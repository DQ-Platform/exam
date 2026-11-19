/**
 * DQ Platform — Elan linki üçün zəngin önizləmə (WhatsApp / Telegram / Facebook)
 * Cloudflare Worker: sayta gələn ?news=ID və ?qeyd=... linklərində <head>-dəki
 * og:title / og:description / og:image teqlərini həmin elanın özünün
 * başlığı, mətni və QAPAQ ŞƏKLİ ilə əvəz edir.
 *
 * Quraşdırma (Cloudflare → Workers → exam → Settings → Variables):
 *   SUPABASE_URL = https://cpzwliqlgaplroscvduo.supabase.co
 *   SUPABASE_KEY = (saytdakı public/anon açar)
 * Sonra bu faylı Worker-in kodu kimi qoyun; öz statik fayllarınız üçün
 * env.ASSETS.fetch(request) istifadə olunur.
 */
const IMG_KEYS = ["cover","qapaq","image","img","photo","thumb","thumbnail","pic","banner","poster"];
const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const clip = (s,n) => { s = String(s||"").replace(/\s+/g," ").trim(); return s.length>n ? s.slice(0,n-1)+"…" : s; };

async function loadNews(env, id){
  const u = `${env.SUPABASE_URL}/rest/v1/dq_v2_store?select=id,data&collection=eq.news&id=eq.${encodeURIComponent(id)}&limit=1`;
  const r = await fetch(u,{headers:{apikey:env.SUPABASE_KEY,Authorization:"Bearer "+env.SUPABASE_KEY}});
  if(!r.ok) return null;
  const a = await r.json();
  return a && a[0] ? a[0].data || null : null;
}
function pickImage(d, origin){
  for(const k of IMG_KEYS){
    let v = d[k]; if(Array.isArray(v)) v = v[0]; if(v && typeof v==="object") v = v.url||v.src;
    if(typeof v==="string" && v.trim()){ v=v.trim(); if(v.startsWith("//")) v="https:"+v; if(v.startsWith("/")) v=origin+v; if(/^https?:\/\//i.test(v)) return v; }
  }
  return null;
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    const id = url.searchParams.get("news") || (url.pathname.match(/^\/news\/([^/]+)/)||[])[1];
    if(!id || !(res.headers.get("content-type")||"").includes("text/html")) return res;

    let d = null;
    try{ d = await loadNews(env, id); }catch(e){}
    if(!d) return res;

    const title = clip(d.title||d.name||"İmtahan elanı", 90);
    const desc  = clip(d.text||d.body||d.desc||d.description||d.summary||"", 160);
    const img   = pickImage(d, url.origin);
    const set = (v)=>({ element(e){ e.setAttribute("content", v); } });

    let rw = new HTMLRewriter()
      .on('meta[property="og:title"]', set(title))
      .on('meta[name="twitter:title"]', set(title))
      .on('meta[property="og:url"]', set(url.href))
      .on('meta[property="og:type"]', set("article"))
      .on("title", { element(e){ e.setInnerContent(title); } });
    if(desc) rw = rw.on('meta[property="og:description"]', set(desc)).on('meta[name="twitter:description"]', set(desc));
    if(img){
      rw = rw
        .on('meta[property="og:image"]', set(img))
        .on('meta[property="og:image:secure_url"]', set(img))
        .on('meta[name="twitter:image"]', set(img))
        .on('meta[property="og:image:width"]', { element(e){ e.remove(); } })
        .on('meta[property="og:image:height"]', { element(e){ e.remove(); } })
        .on('meta[name="twitter:card"]', set("summary_large_image"));
    }
    const out = new Response(rw.transform(res).body, res);
    out.headers.set("cache-control","public, max-age=300");
    return out;
  }
};
