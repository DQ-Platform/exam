/* =====================================================================
   DQ Materials v1.3 — Dərs materialları: etibarlı «Aç» / «Yüklə»
   ---------------------------------------------------------------------
   app.js, dq-core.js və dq-admin.js-dən SONRA qoşulur.

   Köhnə kodda tapılan qüsurlar və bu faylın həlli:
   1. Bazadan fayl çəkiləndə xəta səssizcə udulurdu → indi dəqiq səbəb
      göstərilir (icazə / fayl yoxdur / server gec cavab verdi / internet yoxdur)
      və «Yenidən cəhd et» düyməsi var.
   2. Heç bir geribildirim yox idi → indi düyməyə basan kimi progress pəncərəsi
      (MB sayğacı, ləğv etmə) açılır.
   3. PDF oxuyucu (pdf.js) heç vaxt yüklənmirdi, ona görə «Aç» həmişə yeni
      tab/popup-a düşürdü (telefonda bloklanır) → indi pdf.js avtomatik yüklənir,
      səhifələr tənbəl çəkilir, böyütmə/kiçiltmə var. Alınmasa iframe/yeni tab.
   4. Yüklənən fayl yaddaşda saxlanır: «Aç»-dan sonra «Yüklə» ani işləyir.
   5. Admin yükləməsi: PDF-lər Supabase Storage-ə (materials.sql) yazılır,
      Storage qurulmayıbsa köhnə üsula (bazaya base64) avtomatik keçir.
      Köhnə yazılar da (base64) oxunur — heç nə itmir.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqMat) return;
  window.__dqMat = 1;

  var D = document;
  var SB = "https://cpzwliqlgaplroscvduo.supabase.co";
  var KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
  var BUCKET = "materials";
  var ADM_TOK = "dq_adm_tok";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  var LEGACY_MAX = 10e6, STORAGE_MAX = 50e6;

  var cache = new Map();            /* id -> {blob,name,title} */
  var CACHE_MAX = 6;
  var storageOK = null;             /* null: bilinmir, true/false: yoxlanıb */
  var $ = function (id) { return D.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mb(n) { return (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + " MB"; }
  function toast(t) {
    try { if (window.V2 && V2.toast) return V2.toast(t); } catch (e) { }
    var d = D.createElement("div");
    d.className = "dqm-toast"; d.textContent = t; D.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }

  /* ------------------------------------------------------------------
     CSS
  ------------------------------------------------------------------ */
  var CSS = [
    "@keyframes dqmUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
    "@keyframes dqmSp{to{transform:rotate(360deg)}}",
    "@keyframes dqmSt{to{background-position:44px 0}}",
    "@keyframes dqmIn{from{opacity:0}to{opacity:1}}",
    "@keyframes dqmPop{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}",

    /* ---- fənn / fayl siyahısı (modal içində) ---- */
    ".dqm-h{display:flex;align-items:center;gap:10px;margin:0 0 4px;font:800 20px/1.25 inherit;color:#0a2f7a;text-align:left}",
    ".dqm-sub{margin:0 0 14px;color:#64748b;font-size:13px}",
    ".dqm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}",
    ".dqm-sj{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 10px;border:1px solid #dbe5f6;border-radius:16px;background:linear-gradient(160deg,#fff,#f3f7fd);color:#0a2f7a;font:800 14px/1.3 inherit;cursor:pointer;text-align:center;animation:dqmUp .45s cubic-bezier(.22,.9,.24,1) backwards;animation-delay:calc(var(--i,0)*60ms);transition:transform .25s cubic-bezier(.22,.9,.24,1),box-shadow .25s,border-color .2s}",
    ".dqm-sj:hover{transform:translateY(-4px);border-color:#2f63bd;box-shadow:0 16px 28px -14px rgba(10,47,122,.45)}",
    ".dqm-sj:active{transform:scale(.96)}",
    ".dqm-sj small{font-weight:700;font-size:12px;color:#64748b}",
    ".dqm-ic{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;font-size:22px;background:linear-gradient(135deg,#0a2f7a,#2f63bd);box-shadow:0 8px 16px -8px rgba(10,47,122,.6)}",
    ".dqm-back{display:inline-flex;align-items:center;gap:6px;margin:0 0 12px;padding:9px 14px;border:0;border-radius:10px;background:#0a2f7a;color:#fff;font:700 13px inherit;cursor:pointer;transition:transform .2s,background .2s}",
    ".dqm-back:hover{transform:translateX(-3px);background:#12408f}",
    ".dqm-find{width:100%;box-sizing:border-box;margin:0 0 10px;padding:11px 14px;border:1.5px solid #dbe5f6;border-radius:12px;font:500 14px inherit;outline:0;transition:border-color .2s,box-shadow .2s}",
    ".dqm-find:focus{border-color:#2f63bd;box-shadow:0 0 0 4px rgba(47,99,189,.15)}",
    ".dqm-list{display:flex;flex-direction:column;max-height:min(58vh,520px);overflow:auto;margin:0 -4px;padding:0 4px}",
    ".dqm-row{display:flex;align-items:center;gap:12px;padding:11px 8px;border-bottom:1px solid #edf1f8;border-radius:12px;animation:dqmUp .4s cubic-bezier(.22,.9,.24,1) backwards;animation-delay:calc(var(--i,0)*45ms);transition:background .2s}",
    ".dqm-row:hover{background:#f3f7fd}",
    ".dqm-row[hidden]{display:none}",
    ".dqm-nm{flex:1;min-width:0;display:flex;align-items:center;gap:11px}",
    ".dqm-nm .dqm-ic{flex:none;width:40px;height:40px;font-size:19px;border-radius:12px}",
    ".dqm-nm span{min-width:0;font-weight:600;font-size:14px;line-height:1.4;color:#0f172a;overflow-wrap:anywhere}",
    ".dqm-bt{display:flex;gap:6px;flex:none}",
    ".dqm-b{position:relative;overflow:hidden;min-width:62px;border:0;border-radius:10px;padding:10px 14px;font:800 13px inherit;color:#fff;background:#2f63bd;cursor:pointer;transition:transform .2s,box-shadow .2s,filter .2s}",
    ".dqm-b.dl{background:#0a2f7a}",
    ".dqm-b:hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:0 10px 18px -10px rgba(10,47,122,.8)}",
    ".dqm-b:active{transform:scale(.94)}",
    ".dqm-b.ld{pointer-events:none;color:transparent}",
    ".dqm-b.ld:after{content:'';position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2.5px solid rgba(255,255,255,.4);border-top-color:#fff;animation:dqmSp .7s linear infinite}",
    ".dqm-empty{padding:26px 10px;text-align:center;color:#64748b;font-size:14px}",
    "@media(max-width:430px){.dqm-row{flex-wrap:wrap}.dqm-bt{width:100%}.dqm-b{flex:1}}",

    /* ---- progress / xəta pəncərəsi ---- */
    "#dqm-ov{position:fixed;inset:0;z-index:2147483200;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(6,20,52,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    "#dqm-ov.on{display:flex;animation:dqmIn .2s ease}",
    "#dqm-ov .c{width:min(100%,360px);padding:24px 22px 20px;border-radius:22px;background:#fff;color:#0a2f7a;text-align:center;box-shadow:0 30px 70px -20px rgba(0,0,0,.6);animation:dqmPop .35s cubic-bezier(.22,.9,.24,1)}",
    "#dqm-ov .ic{width:54px;height:54px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;font-size:26px;background:#eaf1fc}",
    "#dqm-ov .ic i{width:30px;height:30px;border-radius:50%;border:3.5px solid #cfdcf2;border-top-color:#2f63bd;animation:dqmSp .8s linear infinite}",
    "#dqm-ov .ic em{display:none;font-style:normal}#dqm-ov.err .ic em{display:block}",
    "#dqm-ov.err .ic{background:#fee2e2}#dqm-ov.err .ic i{display:none}",
    "#dqm-ov .t{display:block;font:800 16px/1.35 inherit;margin-bottom:12px;overflow-wrap:anywhere}",
    "#dqm-ov .bar{height:8px;border-radius:99px;background:#e3eaf7;overflow:hidden}",
    "#dqm-ov .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#2f63bd,#d9a441);transition:width .25s}",
    "#dqm-ov .bar.ind i{width:100%!important;background:repeating-linear-gradient(45deg,#2f63bd 0 11px,#6f95d6 11px 22px);background-size:44px 100%;animation:dqmSt .7s linear infinite}",
    "#dqm-ov.err .bar{display:none}",
    "#dqm-ov .s{display:block;margin-top:10px;font-size:13px;color:#475569;line-height:1.5;overflow-wrap:anywhere}",
    "#dqm-ov.err .s{color:#b91c1c;font-weight:600}",
    "#dqm-ov .a{display:flex;gap:8px;margin-top:16px}",
    "#dqm-ov .a button{flex:1;border:0;border-radius:12px;padding:12px;font:800 14px inherit;cursor:pointer;background:#eaf1fc;color:#0a2f7a;transition:transform .2s,filter .2s}",
    "#dqm-ov .a button.p{background:#0a2f7a;color:#fff}",
    "#dqm-ov .a button:hover{filter:brightness(.96);transform:translateY(-1px)}",
    "#dqm-ov .a button:active{transform:scale(.96)}",

    /* ---- PDF oxuyucu ---- */
    "#dqm-v{position:fixed;inset:0;z-index:2147483100;display:flex;flex-direction:column;background:#0b1630;animation:dqmIn .25s ease}",
    "#dqm-v .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:linear-gradient(100deg,#061a47,#0a2f7a);color:#fff;box-shadow:0 8px 20px -10px rgba(0,0,0,.6)}",
    "#dqm-v .hd b{flex:1;min-width:0;font:700 14px/1.3 inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#dqm-v .hd button,#dqm-v .hd a{flex:none;border:0;border-radius:10px;padding:9px 12px;background:rgba(255,255,255,.14);color:#fff;font:700 13px inherit;text-decoration:none;cursor:pointer;transition:background .2s,transform .2s}",
    "#dqm-v .hd button:hover,#dqm-v .hd a:hover{background:rgba(255,255,255,.26)}",
    "#dqm-v .hd button:active{transform:scale(.94)}",
    "#dqm-v .hd .pr{background:linear-gradient(135deg,#d9a441,#f3d58d);color:#3b2a00}",
    "#dqm-v .hd .x{background:rgba(220,38,38,.9)}",
    "#dqm-v .hd .pn{flex:none;font:700 12px inherit;opacity:.85;font-variant-numeric:tabular-nums;min-width:52px;text-align:center}",
    "#dqm-v .bd{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 8px 40px;text-align:center}",
    "#dqm-v .pg{position:relative;margin:0 auto 12px;background:#fff;border-radius:6px;box-shadow:0 10px 28px -10px rgba(0,0,0,.7);overflow:hidden;animation:dqmIn .3s ease}",
    "#dqm-v .pg canvas{display:block;width:100%;height:auto}",
    "#dqm-v .pg .ld{position:absolute;inset:0;display:grid;place-items:center;color:#94a3b8;font:600 13px inherit}",
    "#dqm-v .st{color:#cbd5e1;padding:50px 10px;font:600 14px inherit}",
    "#dqm-v iframe{width:100%;height:100%;min-height:80vh;border:0;border-radius:6px;background:#fff}",
    ".dqm-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483300;padding:12px 18px;border-radius:14px;background:#0a2f7a;color:#fff;font:600 14px system-ui,sans-serif;box-shadow:0 14px 34px -10px rgba(0,0,0,.55)}",
    "@media(max-width:520px){#dqm-v .hd .nm{display:none}}",
    "@media(prefers-reduced-motion:reduce){.dqm-sj,.dqm-row,#dqm-ov .c,#dqm-v,#dqm-v .pg{animation:none!important}#dqm-ov .ic i{animation-duration:2s}}"
  ].join("");
  (function () {
    var s = D.createElement("style"); s.id = "dqm-css"; s.textContent = CSS;
    (D.head || D.documentElement).appendChild(s);
  })();

  /* ------------------------------------------------------------------
     Xəta mətnləri
  ------------------------------------------------------------------ */
  function httpErr(status, body) {
    var e = new Error("HTTP " + status); e.http = status;
    try { var j = JSON.parse(body); e.code = j.code; e.detail = j.message || j.error || ""; } catch (x) { e.detail = String(body || "").slice(0, 160); }
    return e;
  }
  function msgOf(e) {
    var s = e && e.http;
    var tech = e ? (e.http ? " (HTTP " + e.http + (e.code ? ", " + e.code : "") + ")" : (e.message ? " (" + e.message + ")" : "")) : "";
    if (e && e.timeout) return "Server fayla cavab vermədi (25 san). Fayl bazada böyük həcmli saxlanıla bilər — admin faylı Storage-ə (materials.sql) yenidən yükləməlidir.";
    if (s === 401 || s === 403) return "Faylı oxumağa icazə yoxdur. Admin: Supabase-də dq_v2_store və storage üçün SELECT qaydasını yoxlayın." + tech;
    if (s === 404 || s === 406) return "Fayl bazada tapılmadı. Admin onu silmiş ola bilər." + tech;
    if (s === 408 || s === 504 || e && e.code === "57014") return "Server fayla gec cavab verdi. Bir az sonra yenidən cəhd edin." + tech;
    if (s >= 500) return "Server müvəqqəti cavab vermir. Yenidən cəhd edin." + tech;
    if (e && e.nodata) return "Fayl boşdur və ya zədələnib. Admin onu yenidən yükləməlidir.";
    if (e && e.name === "TypeError") return "İnternet bağlantısı yoxdur və ya kəsildi. Bağlantını yoxlayıb yenidən cəhd edin.";
    return "Fayl açıla bilmədi." + tech;
  }

  /* ------------------------------------------------------------------
     Fayl yükləmə (baza və ya Storage)
  ------------------------------------------------------------------ */
  async function readStream(res, prog) {
    var total = +res.headers.get("content-length") || 0;
    if (!res.body || !res.body.getReader) { var b = new Uint8Array(await res.arrayBuffer()); prog && prog(b.length, total); return b; }
    var rd = res.body.getReader(), parts = [], got = 0;
    for (;;) {
      var r = await rd.read();
      if (r.done) break;
      parts.push(r.value); got += r.value.length;
      prog && prog(got, total);
    }
    var out = new Uint8Array(got), o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }
  function b64Blob(dataUrl) {
    var i = dataUrl.indexOf(","), head = dataUrl.slice(0, i), b64 = dataUrl.slice(i + 1), parts = [];
    if (!/;base64/i.test(head)) return new Blob([decodeURIComponent(b64)], { type: "application/pdf" });
    var STEP = 1 << 20;                                   /* 4-ün qatı */
    for (var p = 0; p < b64.length; p += STEP) {
      var bin = atob(b64.slice(p, p + STEP)), u = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
      parts.push(u);
    }
    return new Blob(parts, { type: "application/pdf" });
  }
  /* Server cavab verməzsə səhifə sonsuz "gözlənilir"də qalmasın:
     ilk bayt üçün FIRST_MS, sonra axın dayanarsa STALL_MS */
  var FIRST_MS = 25000, STALL_MS = 20000;
  function guard(outer) {
    var c = new AbortController(), t = 0, hit = false;
    function arm(ms) { clearTimeout(t); t = setTimeout(function () { hit = true; c.abort(); }, ms); }
    if (outer) { if (outer.aborted) c.abort(); else outer.addEventListener("abort", function () { c.abort(); }, { once: true }); }
    arm(FIRST_MS);
    return { signal: c.signal, bump: function () { arm(STALL_MS); }, stop: function () { clearTimeout(t); }, hit: function () { return hit; } };
  }
  async function fetchOnce(id, signal, prog) {
    var g = guard(signal);
    var p2 = function (a, b) { g.bump(); prog && prog(a, b); };
    try {
      var q = SB + "/rest/v1/dq_v2_store?select=title:data->>title,name:data->>name,url:data->>url,data:data->>data&id=eq." + encodeURIComponent(id);
      var res = await fetch(q, {
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, Accept: "application/vnd.pgrst.object+json" },
        signal: g.signal
      });
      g.bump();
      if (!res.ok) { var t = ""; try { t = await res.text(); } catch (x) { } throw httpErr(res.status, t); }
      var raw = await readStream(res, p2), row = JSON.parse(new TextDecoder().decode(raw));
      if (row.url) {                                         /* Storage-dəki fayl (CDN) */
        g.bump();
        var r2 = await fetch(row.url, { signal: g.signal });
        if (!r2.ok) throw httpErr(r2.status, "");
        var bytes = await readStream(r2, p2);
        return { blob: new Blob([bytes], { type: "application/pdf" }), name: row.name, title: row.title };
      }
      if (!row.data) { var ne = new Error("nodata"); ne.nodata = 1; throw ne; }
      return { blob: b64Blob(row.data), name: row.name, title: row.title };
    } catch (e) {
      if (g.hit()) { var te = new Error("timeout"); te.timeout = 1; throw te; }
      throw e;
    } finally { g.stop(); }
  }
  async function fetchFile(id, signal, prog) {
    var key = String(id);
    if (cache.has(key)) return cache.get(key);
    var last;
    for (var i = 0; i < 3; i++) {
      try {
        prog && prog(0, 0, i + 1);
        var f = await fetchOnce(id, signal, prog);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, f);
        return f;
      } catch (e) {
        last = e;
        if (e && e.name === "AbortError") throw e;
        if (e && e.timeout && i >= 1) throw e;
        if (e && ((e.http && e.http < 500 && e.http !== 408 && e.http !== 429) || e.nodata)) throw e;
        await sleep(500 * (i + 1) * (i + 1));
      }
    }
    throw last;
  }

  /* ------------------------------------------------------------------
     Progress / xəta pəncərəsi
  ------------------------------------------------------------------ */
  function ovEl() {
    var e = $("dqm-ov");
    if (!e) {
      e = D.createElement("div"); e.id = "dqm-ov";
      e.setAttribute("role", "alertdialog");
      e.innerHTML = '<div class="c"><div class="ic"><i></i><em>⚠️</em></div><b class="t"></b><div class="bar"><i></i></div><small class="s"></small><div class="a"></div></div>';
      D.body.appendChild(e);
    }
    return e;
  }
  function ovHide() { var e = $("dqm-ov"); e && e.classList.remove("on", "err"); }
  function ovLoad(title, onCancel) {
    var e = ovEl(); e.className = "on";
    e.querySelector(".ic").firstChild.style.display = "";
    e.querySelector(".t").textContent = title || "Material";
    e.querySelector(".s").textContent = "Yüklənir…";
    var bar = e.querySelector(".bar"); bar.className = "bar ind"; bar.firstChild.style.width = "0";
    var a = e.querySelector(".a"); a.innerHTML = '<button type="button">Ləğv et</button>';
    a.firstChild.onclick = onCancel;
    return function (got, total, att) {
      var s = e.querySelector(".s");
      if (att) { if (att > 1) s.textContent = "Yenidən cəhd " + att + " / 3…"; return; }
      if (total > 0) { bar.className = "bar"; bar.firstChild.style.width = Math.min(100, got / total * 100) + "%"; s.textContent = mb(got) + " / " + mb(total); }
      else s.textContent = got ? mb(got) + " yükləndi…" : "Server cavabı gözlənilir…";
    };
  }
  function ovError(msg) {
    return new Promise(function (res) {
      var e = ovEl(); e.className = "on err";
      e.querySelector(".t").textContent = "Fayl açılmadı";
      e.querySelector(".s").textContent = msg;
      var a = e.querySelector(".a");
      a.innerHTML = '<button type="button">Bağla</button><button type="button" class="p">Yenidən cəhd et</button>';
      a.children[0].onclick = function () { res(false); };
      a.children[1].onclick = function () { res(true); };
    });
  }
  async function loadWithUi(id, title) {
    for (;;) {
      var ctl = new AbortController(), cancelled = false;
      var prog = ovLoad(title, function () { cancelled = true; ctl.abort(); });
      try {
        var f = await fetchFile(id, ctl.signal, prog);
        ovHide();
        return f;
      } catch (e) {
        if (cancelled || (e && e.name === "AbortError")) { ovHide(); return null; }
        console.warn("[dq-materials]", e);
        if (!(await ovError(msgOf(e)))) { ovHide(); return null; }
      }
    }
  }

  /* ------------------------------------------------------------------
     Yüklə
  ------------------------------------------------------------------ */
  function fname(f) {
    var n = String(f.name || f.title || "material").replace(/[\\/:*?"<>|]+/g, "_").trim() || "material";
    return /\.pdf$/i.test(n) ? n : n + ".pdf";
  }
  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = D.createElement("a");
    a.href = u; a.download = name; a.rel = "noopener"; a.style.display = "none";
    D.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 10000);
  }

  /* ------------------------------------------------------------------
     PDF oxuyucu
  ------------------------------------------------------------------ */
  var pdfjsP = null;
  function pdfjs() {
    function ready() { try { pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; } catch (e) { } return window.pdfjsLib; }
    if (window.pdfjsLib) return Promise.resolve(ready());
    if (pdfjsP) return pdfjsP;
    pdfjsP = new Promise(function (res, rej) {
      var s = D.createElement("script"), t = setTimeout(function () { rej(new Error("pdf.js zaman aşımı")); }, 15000);
      s.src = PDFJS + "pdf.min.js";
      s.onload = function () { clearTimeout(t); window.pdfjsLib ? res(ready()) : rej(new Error("pdf.js yoxdur")); };
      s.onerror = function () { clearTimeout(t); rej(new Error("pdf.js yüklənmədi")); };
      D.head.appendChild(s);
    }).catch(function (e) { pdfjsP = null; throw e; });
    return pdfjsP;
  }
  function closeViewer() {
    var v = $("dqm-v");
    if (v) { v.__off && v.__off(); v.remove(); }
    D.documentElement.style.overflow = v && v.__ov != null ? v.__ov : D.documentElement.style.overflow;
  }
  async function openViewer(f) {
    closeViewer();
    var name = fname(f), title = f.title || name;
    var v = D.createElement("div"); v.id = "dqm-v"; v.setAttribute("role", "dialog");
    v.innerHTML = '<div class="hd"><b class="nm">' + esc(title) + '</b><span class="pn"></span>' +
      '<button type="button" data-a="zo" aria-label="Kiçilt">−</button><button type="button" data-a="zi" aria-label="Böyüt">+</button>' +
      '<button type="button" class="pr" data-a="dl">⬇ Yüklə</button><button type="button" class="x" data-a="x">✕</button></div>' +
      '<div class="bd"><div class="st">PDF hazırlanır…</div></div>';
    v.__ov = D.documentElement.style.overflow;
    D.body.appendChild(v); D.documentElement.style.overflow = "hidden";
    var bd = v.querySelector(".bd"), pn = v.querySelector(".pn"), zoom = 1, pdf = null, io = null, pages = [];
    var keyH = function (e) { if (e.key === "Escape") closeViewer(); };
    D.addEventListener("keydown", keyH);
    v.__off = function () { D.removeEventListener("keydown", keyH); io && io.disconnect(); try { pdf && pdf.destroy(); } catch (e) { } };

    function fallback() {
      var u = URL.createObjectURL(f.blob), old = v.__off;
      v.__off = function () { old(); URL.revokeObjectURL(u); };
      bd.innerHTML = '<iframe src="' + u + '" title="' + esc(title) + '"></iframe>';
      var hd = v.querySelector(".hd"), a = D.createElement("a");
      a.href = u; a.target = "_blank"; a.rel = "noopener"; a.textContent = "↗ Yeni tab";
      hd.insertBefore(a, hd.querySelector(".pr"));
      v.querySelectorAll('[data-a="zo"],[data-a="zi"]').forEach(function (b) { b.remove(); });
    }
    function build() {
      io && io.disconnect(); bd.innerHTML = ""; pages = [];
      var w = Math.min(bd.clientWidth - 16, 1000) * zoom, dpr = Math.min(window.devicePixelRatio || 1, 2);
      io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); render(x.target); } });
      }, { root: bd, rootMargin: "900px 0px" });
      async function render(box) {
        try {
          var pg = await pdf.getPage(+box.dataset.n), base = pg.getViewport({ scale: 1 }),
            vp = pg.getViewport({ scale: (w / base.width) * dpr }), c = D.createElement("canvas");
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          box.style.minHeight = "0"; box.style.height = "";
          await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          box.innerHTML = ""; box.appendChild(c);
        } catch (e) { if (box.isConnected) box.innerHTML = '<div class="ld">Səhifə göstərilmədi</div>'; }
      }
      for (var i = 1; i <= pdf.numPages; i++) {
        var b = D.createElement("div"); b.className = "pg"; b.dataset.n = i;
        b.style.width = w + "px"; b.style.minHeight = Math.round(w * 1.414) + "px";
        b.innerHTML = '<div class="ld">' + i + '</div>';
        bd.appendChild(b); pages.push(b); io.observe(b);
      }
      count();
    }
    function count() {
      if (!pages.length) return;
      var mid = bd.scrollTop + bd.clientHeight / 3, cur = 1;
      for (var i = 0; i < pages.length; i++) { if (pages[i].offsetTop <= mid) cur = i + 1; else break; }
      pn.textContent = cur + " / " + pages.length;
    }
    var tk = 0;
    bd.addEventListener("scroll", function () { if (!tk) tk = requestAnimationFrame(function () { tk = 0; count(); }); }, { passive: true });
    v.onclick = function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a;
      if (a === "x") closeViewer();
      else if (a === "dl") { download(f.blob, name); toast("Yüklənir ✅"); }
      else if ((a === "zi" || a === "zo") && pdf) {
        var z = Math.max(.6, Math.min(2.4, zoom + (a === "zi" ? .25 : -.25)));
        if (z !== zoom) { zoom = z; build(); }
      }
    };
    try {
      var lib = await pdfjs();
      var u8 = new Uint8Array(await f.blob.arrayBuffer());
      pdf = await lib.getDocument({ data: u8 }).promise;
      if (!$("dqm-v")) return;
      build();
    } catch (e) {
      console.warn("[dq-materials] pdf.js alınmadı, iframe istifadə olunur", e);
      if ($("dqm-v")) fallback();
    }
  }

  /* ------------------------------------------------------------------
     Əsas əməliyyat (Aç / Yüklə)
  ------------------------------------------------------------------ */
  async function run(id, mode, btn, title) {
    mode = mode === "dl" ? "dl" : "open";
    if (btn) btn.classList.add("ld");
    try {
      var f = await loadWithUi(id, title);
      if (!f) return;
      if (mode === "dl") { download(f.blob, fname(f)); toast("Yüklənir ✅"); }
      else await openViewer(f);
    } catch (e) {
      console.error(e); alert("Fayl açılmadı: " + ((e && e.message) || e));
    } finally { if (btn) btn.classList.remove("ld"); }
  }

  /* ------------------------------------------------------------------
     Fənn və fayl siyahısı (YQ.subView əvəzi)
  ------------------------------------------------------------------ */
  function subView(box, l, closeBtn) {
    var SUBS = (typeof YQ !== "undefined" && YQ.SUBS) || ["Azərbaycan dili", "Qanunvericilik", "İnformatika", "Məntiq"];
    var subs = SUBS.slice(), of = function (p) { return p.sub || "Digər"; };
    (l || []).forEach(function (p) { if (subs.indexOf(of(p)) < 0) subs.push(of(p)); });
    var cnt = function (s) { return l.filter(function (p) { return of(p) === s; }).length; };
    var list = subs.filter(function (s) { return cnt(s) || SUBS.indexOf(s) > -1; });

    function home() {
      box.innerHTML = '<h3 class="dqm-h">📚 Fənlər</h3><p class="dqm-sub">Dərs materialları üçün fənni seçin</p><div class="dqm-grid">' +
        list.map(function (s, i) {
          return '<button type="button" class="dqm-sj" style="--i:' + i + '" data-s="' + i + '"><span class="dqm-ic">🎓</span>' + esc(s) + "<small>" + cnt(s) + " material</small></button>";
        }).join("") + "</div>" + (closeBtn || "");
      box.onclick = function (e) { var b = e.target.closest("[data-s]"); if (b) files(list[+b.dataset.s]); };
    }
    function files(s) {
      var items = l.filter(function (p) { return of(p) === s; });
      box.innerHTML = '<button type="button" class="dqm-back" data-a="back">← Fənlər</button><h3 class="dqm-h">🎓 ' + esc(s) + "</h3>" +
        (items.length > 6 ? '<input class="dqm-find" type="search" placeholder="Material axtar…" autocomplete="off">' : '<div style="height:8px"></div>') +
        '<div class="dqm-list">' + (items.map(function (p, i) {
          return '<div class="dqm-row" style="--i:' + i + '" data-q="' + esc(String(p.title).toLowerCase()) + '"><div class="dqm-nm"><span class="dqm-ic">🎓</span><span>' + esc(p.title) + '</span></div>' +
            '<div class="dqm-bt"><button type="button" class="dqm-b" data-m="open" data-id="' + esc(p._id) + '">Aç</button>' +
            '<button type="button" class="dqm-b dl" data-m="dl" data-id="' + esc(p._id) + '">Yüklə</button></div></div>';
        }).join("") || '<div class="dqm-empty">Bu fənn üzrə hələ material yoxdur.</div>') + "</div>" + (closeBtn || "");
      var fi = box.querySelector(".dqm-find");
      if (fi) fi.oninput = function () {
        var q = fi.value.trim().toLowerCase();
        box.querySelectorAll(".dqm-row").forEach(function (r) { r.hidden = !!q && r.dataset.q.indexOf(q) < 0; });
      };
      box.onclick = function (e) {
        if (e.target.closest("[data-a=back]")) return home();
        var b = e.target.closest("[data-m]");
        if (!b) return;
        var row = b.closest(".dqm-row"), t = row && row.querySelector(".dqm-nm span:last-child");
        run(b.dataset.id, b.dataset.m, b, t && t.textContent);
      };
    }
    home();
  }
  subView.__dqm = 1;

  /* ------------------------------------------------------------------
     Admin: Storage-ə yükləmə
  ------------------------------------------------------------------ */
  /* Token mənbələri (ardıcıllıqla): 1) dq_adm_tok (etibarlıdırsa), 2) Supabase
     sessiyası (müddəti bitibsə avtomatik yenilənir), 3) köhnə açar formaları. */
  function jwtExp(t) {
    try { return JSON.parse(atob(String(t).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch (e) { return 0; }
  }
  async function adminTok() {
    try { if (typeof window.__dqAdminToken === "function") { var ft = await window.__dqAdminToken(); if (ft) return ft; } } catch (e) { }
    try {
      var s = JSON.parse(localStorage.getItem(ADM_TOK) || "null");
      if (typeof s === "string") s = { t: s, e: jwtExp(s) };
      if (s && s.t && (s.e || jwtExp(s.t)) > Date.now() + 15000) return s.t;
    } catch (e) { }
    try {
      if (typeof _supabase !== "undefined" && _supabase.auth) {
        var r = await _supabase.auth.getSession();
        var ss = r && r.data && r.data.session;
        if (ss && ss.access_token) {
          if (ss.expires_at && ss.expires_at * 1000 < Date.now() + 15000) {
            var rr = await _supabase.auth.refreshSession();
            ss = rr && rr.data && rr.data.session;
          }
          if (ss && ss.access_token) {
            try { localStorage.setItem(ADM_TOK, JSON.stringify({ t: ss.access_token, e: jwtExp(ss.access_token) })); } catch (e) { }
            return ss.access_token;
          }
        }
      }
    } catch (e) { }
    return null;
  }
  function xhrUpload(path, file, prog) {
    return adminTok().then(function (tok) { return new Promise(function (res, rej) {
      if (!tok) return rej(Object.assign(new Error("Admin sessiyası bitib — yenidən daxil olun"), { auth: 1 }));
      var x = new XMLHttpRequest();
      x.open("POST", SB + "/storage/v1/object/" + BUCKET + "/" + path);
      x.setRequestHeader("apikey", KEY);
      x.setRequestHeader("Authorization", "Bearer " + tok);
      x.setRequestHeader("Content-Type", "application/pdf");
      x.setRequestHeader("x-upsert", "false");
      x.upload.onprogress = function (e) { e.lengthComputable && prog && prog(e.loaded / e.total); };
      x.onload = function () {
        if (x.status >= 200 && x.status < 300) return res();
        if (x.status === 401) return rej(Object.assign(new Error("Admin sessiyası bitib — yenidən daxil olun"), { auth: 1, status: 401 }));
        var m = ""; try { m = JSON.parse(x.responseText); m = m.message || m.error || ""; } catch (e) { m = x.responseText; }
        rej(Object.assign(new Error(m || ("HTTP " + x.status)), { status: x.status }));
      };
      x.onerror = function () { rej(new Error("Şəbəkə xətası")); };
      x.send(file);
    }); });
  }
  function storageDel(path) {
    if (!path) return Promise.resolve();
    return adminTok().then(function (tok) {
      if (!tok) return;
      return fetch(SB + "/storage/v1/object/" + BUCKET + "/" + path, { method: "DELETE", headers: { apikey: KEY, Authorization: "Bearer " + tok } });
    }).catch(function () { });
  }
  function readB64(file) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(file); });
  }

  async function adminUpload() {
    var DM = window.DM; if (!DM) return;
    var sub = DM.$("dm-sub").value.trim();
    if (!sub) return alert("Fənni seçin.");
    var rows = [].slice.call(DM.$("dm-rows").querySelectorAll(".dm-row"));
    if (!rows.length) return alert("Ən azı bir material əlavə edin.");
    for (var i = 0; i < rows.length; i++) {
      var nm = rows[i].querySelector(".dm-name").value.trim();
      if (!nm) return alert((i + 1) + "-ci materialın adını yazın.");
      if (!rows[i].file) return alert('"' + nm + '" üçün PDF seçin.');
      if (rows[i].file.size > STORAGE_MAX) return alert('"' + nm + '" faylı ' + STORAGE_MAX / 1e6 + " MB-dan böyükdür.");
    }
    await V2.probe();
    var prog = DM.$("dm-prog"), btn = DM.$("dm-up"), ok = 0, fail = [], legacyUsed = 0, authLost = false;
    btn.disabled = true;
    try {
      for (var k = 0; k < rows.length; k++) {
        var r = rows[k], file = r.file, title = r.querySelector(".dm-name").value.trim(), no = +r.dataset.no || 0;
        var tag = (k + 1) + " / " + rows.length;
        prog.textContent = "Yüklənir " + tag + " …";
        var rec = { title: title, sub: sub, no: no, name: file.name, size: file.size, ts: new Date().toISOString() }, path = null;
        if (V2.mode === "cloud" && storageOK !== false && !authLost) {
          var p = "pdf/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + ".pdf";
          try {
            await xhrUpload(p, file, function (f) { prog.textContent = "Yüklənir " + tag + " · " + Math.round(f * 100) + "%"; });
            path = p; storageOK = true;
            rec.url = SB + "/storage/v1/object/public/" + BUCKET + "/" + p; rec.path = p;
          } catch (e) {
            if (e.auth) { authLost = true; }                /* token yoxdur: Storage bu dəfə atlanır, baza yolu ilə davam */
            else storageOK = false;                         /* bucket yoxdur / icazə yoxdur → köhnə üsul */
            console.warn("[dq-materials] Storage alınmadı, köhnə üsula keçilir:", e.message);
          }
        }
        if (!path) {
          if (V2.mode === "cloud" ? file.size > LEGACY_MAX : file.size > 4e6) {
            fail.push(title + ": " + (authLost ? "admin sessiyası bitib — yenidən daxil olun (Storage-ə yükləmək üçün lazımdır)" : "Storage qurulmayıb (materials.sql)") + "; ehtiyat üsul " + (V2.mode === "cloud" ? 10 : 4) + " MB-dan böyük faylı qəbul etmir");
            continue;
          }
          rec.data = await readB64(file); legacyUsed++;
        }
        var id = await V2.put("pdfs", rec);
        if (!id && V2.mode === "cloud") { path && storageDel(path); fail.push(title + ": baza yazmadı"); continue; }
        ok++; r.remove();
      }
    } catch (err) {
      fail.push(String((err && err.message) || err));
    }
    prog.textContent = ""; btn.disabled = false;
    try { DM.renumber(); } catch (e) { }
    if (ok) toast(ok + " material əlavə olundu ✅" + (legacyUsed ? " (köhnə üsul)" : ""));
    if (fail.length) alert("❌ Yazılmayanlar:\n" + fail.join("\n"));
    else if (legacyUsed && authLost) toast("Admin sessiyası yenilənmədi — fayl ehtiyat üsulla yazıldı. Yenidən daxil olun");
    else if (legacyUsed && storageOK === false) toast("Məsləhət: materials.sql-i işlədin — fayllar daha sürətli açılar");
    try { await DM.load(); } catch (e) { }
  }
  adminUpload.__dqm = 1;

  async function adminDel(id) {
    var DM = window.DM;
    if (!confirm("Material silinsin?")) return;
    await V2.probe();
    if (V2.mode === "cloud") {
      var path = null;
      try { var r = await _supabase.from("dq_v2_store").select("p:data->>path").eq("id", id).single(); path = r.data && r.data.p; } catch (e) { }
      var d = await _supabase.from("dq_v2_store").delete().eq("id", id).select("id");
      if (d.error || !d.data || !d.data.length) return alert("Silinmədi: " + (d.error ? d.error.message : "icazə yoxdur — admin kimi yenidən daxil olun"));
      storageDel(path);
    } else {
      localStorage.setItem("dq_v2_pdfs", JSON.stringify((await V2.list("pdfs")).filter(function (x) { return x._id != id; })));
    }
    cache.delete(String(id));
    toast("Silindi");
    DM && DM.load();
  }
  adminDel.__dqm = 1;

  /* ------------------------------------------------------------------
     Qoşulma (köhnə kod sonradan üstünə yazsa, yenidən tətbiq olunur)
  ------------------------------------------------------------------ */
  function install() {
    try {
      if (typeof YQ !== "undefined") {
        if (!YQ.subView || !YQ.subView.__dqm) YQ.subView = subView;
        if (!YQ.getPdf || !YQ.getPdf.__dqm) {
          var gp = function (id, mode, btn) { return run(id, mode, btn); }; gp.__dqm = 1; YQ.getPdf = gp;
        }
      }
    } catch (e) { }
    try {
      if (!window.DQPDF || !window.DQPDF.__dqm) {
        window.DQPDF = {
          __dqm: 1,
          open: function (id, b) { return run(id, "open", b); },
          dl: function (id, b) { return run(id, "dl", b); },
          close: closeViewer
        };
      }
    } catch (e) { }
    try {
      var DM = window.DM;
      if (DM) {
        if (!DM.upload || !DM.upload.__dqm) DM.upload = adminUpload;
        if (!DM.del || !DM.del.__dqm) DM.del = adminDel;
      }
    } catch (e) { }
  }
  install();
  setInterval(install, 1200);
  D.addEventListener("DOMContentLoaded", install);
})();
