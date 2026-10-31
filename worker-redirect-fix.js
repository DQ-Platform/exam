/* Cloudflare Worker (exam.dqplatform.workers.dev) — yönləndirmə zamanı linkin parametrləri itməsin.
   Videoda link workers.dev-dən dq-platform.github.io/... ünvanına keçir və "?giris=1&qrup=...&sinaq=..." silinir.
   Worker-inizdə yönləndirmə hissəsini bu şəkildə dəyişin (HEDEF-i öz ünvanınızla əvəz edin): */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL("https://dq-platform.github.io/HEDEF-REPO/");
    target.search = url.search;   // ← əsas düzəliş: parametrlər saxlanılır
    target.hash = url.hash;
    return Response.redirect(target.toString(), 302);
  }
};
