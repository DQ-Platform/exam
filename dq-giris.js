/* DQ Platform — İştirakçı giriş modulu
   Link: ?giris=1&qrup=BA&sinaq=1
   Axın: İş nömrəsi → icazə verilmiş sınaqlar (kartlar) → «İmtahanı başlat» təsdiqi → mövcud imtahan axını */
(function () {
  "use strict";
  var Q = new URLSearchParams(location.search);
  if (Q.get("giris") !== "1") return;

  var T = "allowed_students",
    WA = "994504305162",
    QCOUNT = 100,       /* sual sayı (kartda göstərilir) */
    DUR = 180,          /* müddət, dəqiqə */
    hintExam = Q.get("sinaq") || "",
    hintCat = (Q.get("qrup") || "").toUpperCase();
  var cols = null, session = null, tick = null;

  /* ---------- köməkçilər ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function db() {
    try { if (typeof _supabase !== "undefined" && _supabase && _supabase.from) return _supabase; } catch (e) {}
    var w = window, c = [w._supabase, w.sb, w.supabaseClient];
    for (var i = 0; i < c.length; i++) if (c[i] && c[i].from) return c[i];
    return null;
  }
  function pick(row, re, def) { if (row) for (var k in row) if (re.test(k)) return k; return def; }
  async function schema() {
    if (cols) return cols;
    var r = null;
    try { var q = await db().from(T).select("*").limit(1); r = q.data && q.data[0]; } catch (e) {}
    var catK = pick(r, /cat|kateq/i, "categories");
    cols = {
      name: pick(r, /^(student_?name|full_?name|name|ad)/i, "student_name"),
      fin: pick(r, /fin|code|kod|is_?nom/i, "fin"),
      exam: pick(r, /exam/i, "exam_no"),
      cat: catK,
      start: pick(r, /start/i, null),
      prog: r && ("dq_progress" in r) ? "dq_progress" : null
    };
    return cols;
  }
  var CYR = { "А":"A","В":"B","С":"C","Е":"E","Н":"H","К":"K","М":"M","О":"O","Р":"P","Т":"T","Х":"X","У":"Y","І":"I","Ѕ":"S","Ј":"J" };
  function normFin(v) {
    return String(v || "").toUpperCase().replace(/[\s\u200b-\u200f\ufeff]/g, "").replace(/[А-ЯЁІЅЈ]/g, function (c) { return CYR[c] || c; });
  }
  /* şərti gözləyir (app.js / verilənlər bazası gec yüklənəndə) */
  function waitFor(fn, ms) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function p() {
        var v = null; try { v = fn(); } catch (e) {}
        if (v) return res(v);
        if (Date.now() - t0 > ms) return res(null);
        setTimeout(p, 150);
      })();
    });
  }
  function appFn(name) {
    try { if (typeof window[name] === "function") return window[name]; } catch (e) {}
    try { if (window.DQ && typeof window.DQ[name] === "function") return window.DQ[name].bind(window.DQ); } catch (e) {}
    return null;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(d) { return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(); }
  function fmtDT(d) { return fmtDate(d) + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmtLeft(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
  }
  function runKey(it) { return "dqg_run:" + session.fin + ":" + it.exam + ":" + it.cat; }
  function pkey(it) { return it.exam + "|" + it.cat; }
  function hasLocalState(it) {
    try {
      var st = JSON.parse(localStorage.getItem("dq_exam_state") || "null");
      return !!(st && localStorage.getItem("dq_exam_end_time") && String(st.fin).toUpperCase() === session.fin &&
        String(st.examId) === String(it.exam) && String(st.userGroup || "BA").toUpperCase() === it.cat);
    } catch (e) { return false; }
  }
  function getRun(it) {
    var l = 0; try { l = +localStorage.getItem(runKey(it)) || 0; } catch (e) {}
    var sv = session && session.prog && +session.prog[pkey(it)] || 0;
    return l && sv ? Math.min(l, sv) : (l || sv);   /* ən erkən başlama vaxtı */
  }
  function setRun(it) {
    if (getRun(it)) return;
    var now = Date.now();
    try { localStorage.setItem(runKey(it), String(now)); } catch (e) {}
    if (session) {
      session.prog = session.prog || {}; session.prog[pkey(it)] = now;
      /* serverdə saxla (cədvəldə dq_progress sütunu varsa) — başqa cihazdan da taymer davam edir */
      if (cols && cols.prog && db()) {
        try { db().from(T).update(Object.fromEntries([[cols.prog, session.prog]])).eq(cols.fin, session.fin).then(function () {}, function () {}); } catch (e) {}
      }
    }
  }

  /* başlama alınmayıbsa taymeri geri qaytar (istifadəçinin vaxtı boş yerə getməsin) */
  function unsetRun(it) {
    try { localStorage.removeItem(runKey(it)); } catch (e) {}
    if (session && session.prog) {
      delete session.prog[pkey(it)];
      if (cols && cols.prog && db()) {
        try { db().from(T).update(Object.fromEntries([[cols.prog, session.prog]])).eq(cols.fin, session.fin).then(function () {}, function () {}); } catch (e) {}
      }
    }
  }

  /* ---------- üslub ---------- */
  var css = [
    "#dqg,#dqg *{box-sizing:border-box}",
    "#dqg{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;",
    "font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e9eefb;",
    "background:radial-gradient(1200px 600px at 50% -10%,#16356f 0%,#0b1d44 45%,#071330 100%)}",
    "#dqg .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:30;max-width:92%;padding:12px 16px;border-radius:12px;",
    "background:#7f1d1d;border:1px solid #f87171;color:#fee2e2;font-size:13.5px;line-height:1.5;display:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
    "#dqg .toast.on{display:block}",
    "#dqg .hd{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:12px 20px;",
    "background:linear-gradient(180deg,#0b1d44,#091735);border-bottom:2px solid #c9a24b;box-shadow:0 6px 24px rgba(0,0,0,.35)}",
    "#dqg .logo{width:42px;height:42px;flex:none;border-radius:12px;display:block}",
    "#dqg .brand{display:flex;flex-direction:column;line-height:1.15}",
    "#dqg .brand b{font-size:18px;font-weight:800;letter-spacing:.4px;color:#f3d98b}",
    "#dqg .brand small{font-size:11px;color:#9fb0d6;letter-spacing:1.2px;text-transform:uppercase}",
    "#dqg .out{margin-left:auto;background:transparent;border:1px solid #c9a24b;color:#f3d98b;border-radius:10px;",
    "padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer}",
    "#dqg .out:hover{background:rgba(201,162,75,.15)}",
    "#dqg .wrap{max-width:900px;margin:0 auto;padding:28px 18px 60px}",
    /* giriş kartı */
    "#dqg .lg{max-width:400px;margin:9vh auto 0;padding:30px 26px;border-radius:20px;",
    "background:linear-gradient(180deg,#0f2557,#0b1d44);border:1px solid rgba(201,162,75,.55);",
    "box-shadow:0 20px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06)}",
    "#dqg .lg h1{margin:0 0 6px;font-size:21px;color:#f3d98b;font-weight:800;text-align:center}",
    "#dqg .lg p.s{margin:0 0 22px;text-align:center;color:#9fb0d6;font-size:13.5px}",
    "#dqg label{display:block;font-size:12px;font-weight:800;letter-spacing:1.2px;color:#c9a24b;margin-bottom:8px}",
    "#dqg input.in{width:100%;padding:14px 16px;border-radius:12px;border:1px solid #2c4a8a;background:#081634;color:#fff;",
    "font-size:18px;font-weight:700;letter-spacing:3px;text-transform:uppercase;outline:none;transition:.15s}",
    "#dqg input.in::placeholder{color:#5f739f;letter-spacing:1px;font-weight:500;font-size:14px;text-transform:none}",
    "#dqg input.in:focus{border-color:#e0b84f;box-shadow:0 0 0 3px rgba(224,184,79,.2)}",
    "#dqg .gold{width:100%;margin-top:16px;padding:14px;border:0;border-radius:12px;cursor:pointer;font-weight:800;font-size:15px;",
    "color:#0a1a3a;background:linear-gradient(180deg,#f3d98b,#c9a24b);box-shadow:0 8px 20px rgba(201,162,75,.28);transition:.15s}",
    "#dqg .gold:hover{filter:brightness(1.06);transform:translateY(-1px)}",
    "#dqg .gold:disabled{opacity:.55;cursor:default;transform:none;filter:none}",
    "#dqg .err{margin-top:14px;padding:11px 13px;border-radius:10px;background:rgba(185,28,28,.15);border:1px solid rgba(248,113,113,.45);",
    "color:#fecaca;font-size:13.5px;display:none}",
    "#dqg .wa{display:none;margin-top:10px;text-align:center;padding:12px;border-radius:12px;background:#1faa59;color:#fff;font-weight:800;text-decoration:none;font-size:14px}",
    /* kartlar */
    "#dqg .who{display:flex;align-items:center;gap:14px;margin-bottom:22px}",
    "#dqg .av{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:19px;color:#0a1a3a;",
    "background:linear-gradient(180deg,#f3d98b,#c9a24b)}",
    "#dqg .who b{display:block;font-size:17px;color:#fff}",
    "#dqg .who small{color:#9fb0d6;font-size:12.5px;letter-spacing:1px}",
    "#dqg h2{margin:0 0 14px;font-size:14px;letter-spacing:1.4px;text-transform:uppercase;color:#c9a24b}",
    "#dqg .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}",
    "#dqg .ex{display:flex;flex-direction:column;border-radius:16px;overflow:hidden;",
    "background:linear-gradient(180deg,#112a60,#0c1f4a);border:1px solid rgba(201,162,75,.4);box-shadow:0 10px 30px rgba(0,0,0,.35)}",
    "#dqg .ex.hint{border-color:#e0b84f;box-shadow:0 0 0 1px #e0b84f,0 10px 30px rgba(0,0,0,.35)}",
    "#dqg .ex .bd{padding:18px 18px 14px;flex:1}",
    "#dqg .ex h3{margin:0 0 8px;font-size:16px;line-height:1.35;color:#fff;font-weight:800}",
    "#dqg .st{font-size:12.5px;color:#9fb0d6;margin-bottom:12px}",
    "#dqg .st.run{color:#f3d98b;font-weight:700}",
    "#dqg .st.run span{font-variant-numeric:tabular-nums;color:#ffe9a8}",
    "#dqg .mt{font-size:13px;color:#c8d4f0;line-height:1.7}#dqg .mt b{color:#fff}",
    "#dqg .ft{padding:14px 18px 18px;border-top:1px solid rgba(255,255,255,.07)}",
    "#dqg .ft .gold{margin:0;padding:12px}",
    "#dqg .ft .lock{background:#1a2f60;color:#8394bd;box-shadow:none;cursor:not-allowed}",
    "#dqg .empty{padding:28px;text-align:center;border:1px dashed rgba(201,162,75,.5);border-radius:16px;color:#c8d4f0}",
    /* modal */
    "#dqg .ov{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:18px;",
    "background:rgba(3,8,22,.72);backdrop-filter:blur(3px)}",
    "#dqg .ov.on{display:flex}",
    "#dqg .md{width:100%;max-width:440px;padding:24px 24px 20px;border-radius:18px;position:relative;",
    "background:linear-gradient(180deg,#112a60,#0b1d44);border:1px solid #c9a24b;box-shadow:0 30px 80px rgba(0,0,0,.65)}",
    "#dqg .md h4{margin:0 0 12px;font-size:21px;color:#f3d98b;font-weight:800}",
    "#dqg .md p{margin:0 0 6px;font-size:14px;line-height:1.6;color:#d5def5}",
    "#dqg .md .nm{margin:0 0 14px;font-size:13px;color:#c9a24b;font-weight:700}",
    "#dqg .md .x{position:absolute;right:14px;top:12px;background:none;border:0;color:#9fb0d6;font-size:24px;cursor:pointer;line-height:1}",
    "#dqg .md .bt{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}",
    "#dqg .md .bt button{padding:11px 26px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer}",
    "#dqg .md .no{background:transparent;border:1px solid #4a63a0;color:#d5def5}",
    "#dqg .md .no:hover{background:rgba(255,255,255,.06)}",
    "#dqg .md .yes{border:0;color:#0a1a3a;background:linear-gradient(180deg,#f3d98b,#c9a24b)}",
    "#dqg .ft .row{display:flex;gap:10px;align-items:stretch}#dqg .ft .row .gold{flex:1;width:auto}",
    "#dqg .inf{flex:none;width:48px;border-radius:12px;border:1px solid rgba(201,162,75,.65);background:rgba(201,162,75,.08);color:#f3d98b;cursor:pointer;display:grid;place-items:center;transition:.15s}",
    "#dqg .inf:hover{background:rgba(201,162,75,.2)}#dqg .inf svg{width:22px;height:22px}",
    "#dqg .rv{width:100%;margin-top:10px;padding:11px;border-radius:12px;border:1px solid #c9a24b;background:transparent;color:#f3d98b;font-weight:800;font-size:13.5px;cursor:pointer}",
    "#dqg .rv:hover{background:rgba(201,162,75,.14)}",
    /* keçid (yükləmə) ekranı */
    "#dqg .ld{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s;",
    "background:radial-gradient(1200px 600px at 50% -10%,#16356f 0%,#0b1d44 45%,#071330 100%)}",
    "#dqg .ld.on{opacity:1;visibility:visible;transition:opacity .3s}",
    "#dqg .ldc{width:100%;max-width:360px;text-align:center}",
    "#dqg .lring{position:relative;width:112px;height:112px;margin:0 auto 22px;display:grid;place-items:center}",
    "#dqg .lring .logo{width:64px;height:64px;animation:dqgP 1.8s ease-in-out infinite}",
    "#dqg .lring .spin{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(201,162,75,.18);border-top-color:#e0b84f;animation:dqgS 1s linear infinite}",
    "@keyframes dqgS{to{transform:rotate(360deg)}}@keyframes dqgP{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}",
    "#dqg .ldc h3{margin:0 0 6px;font-size:20px;font-weight:800;color:#f3d98b}",
    "#dqg .ldc .ls{min-height:20px;font-size:13.5px;color:#b9c7e8;margin-bottom:18px}",
    "#dqg .ldc .bar{height:6px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}",
    "#dqg .ldc .bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#c9a24b,#f3d98b);transition:width .25s ease-out}",
    "#dqg .ldc .pc{margin-top:8px;font-size:12px;color:#9fb0d6;font-variant-numeric:tabular-nums}",
    "#dqg .ldc .tp{margin-top:22px;font-size:12px;line-height:1.6;color:#7f92bd}",
    /* nəticə pəncərəsi */
    "#dqg .md2{max-width:480px;max-height:90vh;overflow-y:auto;padding:22px 20px 18px}",
    "#dqg .md2 h4{margin:0 40px 2px 0;font-size:19px}#dqg .md2 .sb0{font-size:12.5px;color:#9fb0d6;margin-bottom:14px}",
    "#dqg .rs{display:flex;align-items:center;gap:16px;margin-bottom:14px}",
    "#dqg .dn{width:132px;height:132px;flex:none}#dqg .dnv{font-size:34px;font-weight:900;fill:#f3d98b}#dqg .dnl{font-size:11px;fill:#9fb0d6;letter-spacing:1px}",
    "#dqg .chips{display:flex;flex-direction:column;gap:7px;flex:1}",
    "#dqg .chip{display:flex;justify-content:space-between;align-items:center;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.05);font-size:13px;color:#d5def5}",
    "#dqg .chip b{font-size:15px;color:#fff}#dqg .chip em{font-style:normal;display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px}",
    "#dqg .ps{padding:10px 12px;border-radius:10px;background:rgba(201,162,75,.1);border:1px solid rgba(201,162,75,.35);color:#f3d98b;font-size:12.5px;line-height:1.5;margin-bottom:14px}",
    "#dqg .md2 h5{margin:6px 0 10px;font-size:12px;letter-spacing:1.3px;text-transform:uppercase;color:#c9a24b}",
    "#dqg .sj{margin-bottom:12px}#dqg .sj .t{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#e9eefb;margin-bottom:5px}",
    "#dqg .sj .t span{color:#9fb0d6;font-size:12px;white-space:nowrap}",
    "#dqg .sj .b{display:flex;height:8px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.08)}",
    "#dqg .sj .b i{display:block;height:100%}",
    "#dqg .mact{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}#dqg .mact button{flex:1;min-width:130px;padding:11px 14px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer}",
    "#dqg .mact .sec{background:transparent;border:1px solid #c9a24b;color:#f3d98b}",
    "@media(max-width:520px){#dqg .lg{margin-top:5vh;padding:24px 18px}#dqg .grid{grid-template-columns:1fr}#dqg .rs{flex-direction:column;align-items:stretch}#dqg .dn{margin:0 auto}}"
  ].join("").replace(/#dqg(?![-\w])/g, "[data-dqg]");

  var LOGO =
    '<svg class="logo" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="dqgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d98b"/><stop offset="1" stop-color="#b98a2e"/></linearGradient></defs>' +
    '<rect x="1.5" y="1.5" width="45" height="45" rx="12" fill="#0f2557" stroke="url(#dqgG)" stroke-width="2"/>' +
    '<path d="M24 7l14 5v10c0 9-6 15-14 19C16 37 10 31 10 22V12z" fill="none" stroke="url(#dqgG)" stroke-width="1.6" opacity=".55"/>' +
    '<text x="24" y="29.5" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="17" fill="url(#dqgG)">DQ</text></svg>';

  /* ---------- quruluş ---------- */
  /* səhifə səviyyəli qaydalar (yalnız bunlar shadow-un xaricindədir) */
  var st = document.createElement("style");
  st.id = "dqg-style";
  st.textContent =
    "html.dqg-auto #dq-cs{opacity:0!important;pointer-events:none!important}" +
    "html.dqg-on #dq-splash{display:none!important}" +
    "html.dq13-dark #dqg,html.dq13-dark #dqg-rh,html.dq13-dark #dqg-mh{filter:invert(1) hue-rotate(180deg)}";
  document.head.appendChild(st);

  /* Shadow DOM: index.html / digər skriptlərin qlobal CSS-i (.ov, .md, .hd, .grid, .logo …) bu pəncərəyə toxuna bilmir */
  function mount(hostId, z) {
    var host = document.createElement("div");
    host.id = hostId;
    document.body.appendChild(host);
    [["position", "fixed"], ["top", "0"], ["right", "0"], ["bottom", "0"], ["left", "0"], ["z-index", z || "2147483600"],
     ["visibility", "visible"], ["opacity", "1"], ["pointer-events", "auto"], ["margin", "0"], ["padding", "0"]
    ].forEach(function (x) { host.style.setProperty(x[0], x[1], "important"); });
    var sh = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var sty = document.createElement("style"); sty.textContent = css; sh.appendChild(sty);
    var ui = document.createElement("div"); ui.setAttribute("data-dqg", ""); sh.appendChild(ui);
    return { host: host, sh: sh, ui: ui };
  }

  var M = mount("dqg"), root = M.host, SH = M.sh;
  M.ui.innerHTML =
    '<div class="hd">' + LOGO + '<div class="brand"><b>DQ Platform</b><small>Dövlət Qulluğu Sınaq İmtahanı</small></div>' +
    '<button type="button" class="out" id="dqg-out" style="display:none">Çıxış</button></div>' +
    '<div class="wrap">' +
    /* 1) giriş */
    '<div id="dqg-login" class="lg"><h1>Kabinetə giriş</h1><p class="s">İştirak üçün sizə verilən iş nömrəsini yazın</p>' +
    '<label for="dqg-fin">İŞ NÖMRƏSİ</label>' +
    '<input id="dqg-fin" class="in" type="text" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="İş nömrəsini daxil edin">' +
    '<button type="button" id="dqg-go" class="gold">Daxil ol</button>' +
    '<div id="dqg-err" class="err"></div><a id="dqg-wa" class="wa" target="_blank" rel="noopener">💬 WhatsApp ilə yazın</a></div>' +
    /* 2) kartlar */
    '<div id="dqg-list" style="display:none"><div class="who"><div class="av" id="dqg-av">?</div><div><b id="dqg-nm"></b><small id="dqg-fn"></small></div></div>' +
    '<h2>Sizə icazə verilmiş sınaqlar</h2><div id="dqg-grid" class="grid"></div></div></div>' +
    /* 3) təsdiq pəncərəsi */
    '<div class="ov" id="dqg-ov"><div class="md" role="dialog" aria-modal="true"><button type="button" class="x" id="dqg-x" aria-label="Bağla">×</button>' +
    '<h4>İmtahanı başlat</h4><div class="nm" id="dqg-mn"></div>' +
    '<p>Təsdiq edirəm düyməsini basdıqdan sonra imtahan başlayacaq və imtahanı dayandırmaq, yenidən başlatmaq mümkün olmayacaq. Razısınız?</p>' +
    '<div class="bt"><button type="button" class="no" id="dqg-no">Xeyr</button><button type="button" class="yes" id="dqg-yes">Bəli</button></div></div></div>';
  var ldEl = document.createElement("div"); ldEl.className = "ld"; ldEl.id = "dqg-ld";
  ldEl.innerHTML = '<div class="ldc"><div class="lring"><div class="spin"></div>' + LOGO + '</div><h3 id="dqg-ld-t">İmtahan başlayır</h3>' +
    '<div class="ls" id="dqg-ld-s"></div><div class="bar"><i id="dqg-ld-b"></i></div><div class="pc" id="dqg-ld-p">0%</div>' +
    '<div class="tp">Səhifəni bağlamayın. Hazır olan kimi avtomatik keçid ediləcək.</div></div>';
  M.ui.appendChild(ldEl);
  var tst = document.createElement("div"); tst.className = "toast"; tst.id = "dqg-toast"; M.ui.appendChild(tst);
  /* ayrıca modal hostu (nəticə statistikası, təhlil təsdiqi) — həm kartlarda, həm imtahandan sonrakı pəncərədə işləyir */
  var MH = mount("dqg-mh", "2147483647");
  MH.host.style.setProperty("display", "none", "important");
  MH.ui.style.setProperty("background", "transparent", "important");
  MH.ui.innerHTML = '<div class="ov" id="dqg-ov2"><div class="md md2" role="dialog" aria-modal="true"><button type="button" class="x" id="dqg-x2" aria-label="Bağla">×</button><div id="dqg-m2"></div></div></div>';
  var $m = function (id) { return MH.sh.getElementById ? MH.sh.getElementById(id) : document.getElementById(id); };
  document.documentElement.classList.add("dqg-on");
  document.documentElement.classList.remove("dqg-pre");
  document.documentElement.style.overflow = "hidden";

  var $ = function (id) { return SH.getElementById ? SH.getElementById(id) : document.getElementById(id); };

  var toastT = null;
  function toast(t) {
    var e = $("dqg-toast"); if (!e) return;
    e.textContent = t; e.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove("on"); }, 7000);
  }
  function showErr(t, wa) {
    var e = $("dqg-err"); e.textContent = t; e.style.display = "block";
    var a = $("dqg-wa");
    if (wa) {
      a.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(
        "Salam, DQ Platform-da iştirak icazəsi almaq istəyirəm.\nİş nömrəsi: " + wa);
      a.style.display = "block";
    } else a.style.display = "none";
  }

  /* təhvil verilmiş nəticələr (bal, düz/səhv/boş, fənn statistikası, təhlil istifadəsi) */
  async function loadResults() {
    var done = {}, res = {};
    try {
      var rr = await db().from("exam_results").select("*").eq("fin", session.fin);
      (rr.data || []).forEach(function (x) {
        var k = String(x.exam_no) + "|" + String(x.category).toUpperCase();
        done[k] = 1; res[k] = x;
      });
    } catch (e) { console.warn("dqg: nəticələr", e); }
    session.done = done; session.res = res;
  }
  function reviewKey(it) { return "dq_review_used:" + session.fin + ":" + it.exam + ":" + it.cat; }
  function reviewEligible(it) {
    var r = session && session.res && session.res[pkey(it)];
    if (!r || !((+r.wrong_count || 0) > 0)) return false;
    if (r.review_used === true) return false;
    try { if (localStorage.getItem(reviewKey(it)) === "1") return false; } catch (e) {}
    return true;
  }

  /* ---------- giriş ---------- */
  async function login() {
    var fin = normFin($("dqg-fin").value);
    $("dqg-err").style.display = "none"; $("dqg-wa").style.display = "none";
    if (!fin) return showErr("İş nömrəsini yazın.");
    if (fin.length < 4) return showErr("İş nömrəsi düzgün deyil.");
    var b = $("dqg-go");
    b.disabled = true; b.textContent = "Yoxlanılır…";
    try {
      if (!(await waitFor(db, 8000))) return showErr("Verilənlər bazası ilə bağlantı qurulmayıb. İnternetinizi yoxlayıb yenidən cəhd edin.");
      var c = await schema();
      var q = await db().from(T).select("*").eq(c.fin, fin);
      if (q.error) throw q.error;
      var rows = q.data || [], items = [], seen = {}, name = "", prog = {};
      rows.forEach(function (r) {
        if (!name && r[c.name]) name = r[c.name];
        if (c.prog && r[c.prog]) {
          var pv = r[c.prog]; if (typeof pv === "string") { try { pv = JSON.parse(pv); } catch (e) { pv = null; } }
          if (pv && typeof pv === "object") for (var pk in pv) if (!prog[pk] || +pv[pk] < prog[pk]) prog[pk] = +pv[pk];
        }
        var cats = Array.isArray(r[c.cat]) ? r[c.cat] : String(r[c.cat] || "").split(",");
        cats.forEach(function (k) {
          k = String(k).trim().toUpperCase(); if (!k) return;
          var id = r[c.exam] + "|" + k; if (seen[id]) return; seen[id] = 1;
          items.push({ exam: r[c.exam], cat: k, start: c.start && r[c.start] ? new Date(r[c.start]) : null });
        });
      });
      if (!items.length) return showErr("Bu iş nömrəsi üzrə icazə tapılmadı. İcazə almaq üçün bizimlə əlaqə saxlayın.", fin);
      items.sort(function (a, b2) {
        var ha = (String(a.exam) === hintExam && a.cat === hintCat) ? 0 : 1,
            hb = (String(b2.exam) === hintExam && b2.cat === hintCat) ? 0 : 1;
        return ha - hb || a.exam - b2.exam || a.cat.localeCompare(b2.cat);
      });
      /* app.js-in öz «exam_started» qeydləri (serverdə) → başlama vaxtı */
      try {
        if (window.V2 && V2.list) {
          var L = await V2.list("exam_started");
          (L || []).forEach(function (r) {
            if (String(r.fin).toUpperCase() !== fin) return;
            var t = Date.parse(r.at), k = String(r.exam) + "|" + String(r.cat).toUpperCase();
            if (t && (!prog[k] || t < prog[k])) prog[k] = t;
          });
        }
      } catch (e) {}
      session = { fin: fin, name: name, items: items, prog: prog, done: {}, res: {} };
      await loadResults();
      renderList();
    } catch (e) {
      showErr("Xəta: " + (e.message || e));
    } finally { b.disabled = false; b.textContent = "Daxil ol"; }
  }

  /* ---------- kartlar ---------- */
  var INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/></svg>';
  function renderList() {
    $("dqg-login").style.display = "none";
    $("dqg-list").style.display = "block";
    $("dqg-out").style.display = "block";
    $("dqg-nm").textContent = session.name || "İştirakçı";
    $("dqg-fn").textContent = "İŞ NÖMRƏSİ: " + session.fin;
    $("dqg-av").textContent = (session.name || session.fin).trim().charAt(0).toUpperCase();
    var g = $("dqg-grid");
    g.innerHTML = session.items.map(function (it, i) {
      var hint = String(it.exam) === hintExam && it.cat === hintCat ? " hint" : "";
      var title = "Dövlət Qulluğu " + esc(it.cat) + " kateqoriyası üzrə sınaq " + esc(it.exam) +
        (it.start ? " - " + fmtDate(it.start) : "");
      return '<div class="ex' + hint + '" data-i="' + i + '"><div class="bd"><h3>' + title + '</h3>' +
        '<div class="st" data-st></div>' +
        '<div class="mt">Sual sayı: <b>' + QCOUNT + '</b><br>Müddət: <b>' + DUR + ' Dəqiqə</b></div></div>' +
        '<div class="ft"><div class="row"><button type="button" class="gold" data-btn></button>' +
        '<button type="button" class="inf" data-info style="display:none" title="Nəticə və statistika" aria-label="Nəticə və statistika">' + INFO + '</button></div>' +
        '<button type="button" class="rv" data-rv style="display:none">🔍 Səhvləri təhlil et (1 dəfə)</button></div></div>';
    }).join("");
    refresh();
    clearInterval(tick); tick = setInterval(refresh, 1000);
  }
  function refresh() {
    if (!session) return;
    var now = Date.now();
    Array.prototype.forEach.call($("dqg-grid").children, function (card) {
      var it = session.items[+card.dataset.i], s = card.querySelector("[data-st]"), b = card.querySelector("[data-btn]");
      var run = getRun(it), left = run ? DUR * 60000 - (now - run) : 0, loc = hasLocalState(it);
      var inf = card.querySelector("[data-info]"), rv = card.querySelector("[data-rv]"), isDone = !!session.done[pkey(it)];
      inf.style.display = isDone && session.res[pkey(it)] ? "" : "none";
      rv.style.display = isDone && reviewEligible(it) ? "" : "none";
      b.classList.remove("lock"); b.disabled = false;
      function lock(t) { b.textContent = t; b.disabled = true; b.classList.add("lock"); }
      if (session.done[pkey(it)]) {
        s.className = "st"; s.textContent = "Tamamlanıb"; lock("Tamamlanıb");
      } else if (it.start && it.start.getTime() > now && !run) {
        s.className = "st"; s.textContent = "Başlama vaxtı: " + fmtDT(it.start); lock("Hələ açılmayıb");
      } else if (run && left <= 0) {
        s.className = "st"; s.textContent = "Vaxt bitib";
        if (loc) { b.textContent = "Nəticəni göndər"; } else lock("Vaxt bitib");
      } else if (run) {
        s.className = "st run"; s.innerHTML = "Davam edir: <span>" + fmtLeft(left) + "</span>";
        if (loc) b.textContent = "Davam et"; else lock("Başladığınız cihazdan davam edin");
      } else {
        s.className = "st"; s.textContent = "Başlanmayıb"; b.textContent = "Başla";
      }
    });
  }

  /* ---------- təsdiq pəncərəsi ---------- */
  var pending = null;
  function openConfirm(it) {
    pending = it;
    var resume = hasLocalState(it);
    $("dqg-mn").textContent = "Dövlət Qulluğu " + it.cat + " · Sınaq " + it.exam;
    if (resume) { start(it); return; }  /* davam edən imtahan təsdiq tələb etmir */
    $("dqg-ov").classList.add("on");
  }
  function closeConfirm() { $("dqg-ov").classList.remove("on"); pending = null; }

  /* ---------- mövcud imtahan axınına (app.js) birbaşa ötürmə ---------- */
  var autoIv = null;
  function autoConfirm() {
    /* app-in öz «Sınağa başlamağa əminsiniz?» pəncərəsi gizli şəkildə təsdiqlənir (təsdiq artıq bizim pəncərədə verilib) */
    var n = 0; clearInterval(autoIv);
    autoIv = setInterval(function () {
      var d = document.getElementById("dq-cs"), ok = d && d.querySelector("#dq-cs-ok");
      if (d && d.classList.contains("on") && ok) { clearInterval(autoIv); ok.click(); }
      else if (++n > 100) clearInterval(autoIv);
    }, 100);
  }
  /* ---------- keçid (yükləmə) ekranı ---------- */
  var ldTimer = null, ldVal = 0, ldMsgs = null, reviewBusy = false, infoIt = null;
  var LD_MSG = [[0, "İcazə yoxlanılır…"], [25, "Suallar yüklənir…"], [55, "İmtahan hazırlanır…"], [80, "Demək olar hazırdır…"]];
  function ldPaint(p) {
    p = Math.min(100, Math.round(p));
    var m = ldMsgs[0][1];
    for (var i = 0; i < ldMsgs.length; i++) if (p >= ldMsgs[i][0]) m = ldMsgs[i][1];
    if (p >= 100) m = "Hazırdır!";
    $("dqg-ld-b").style.width = p + "%"; $("dqg-ld-p").textContent = p + "%"; $("dqg-ld-s").textContent = m;
  }
  function ldShow(title, msgs) {
    clearInterval(ldTimer); ldVal = 0; ldMsgs = msgs || LD_MSG;
    $("dqg-ld-t").textContent = title; ldPaint(0);
    $("dqg-ld").classList.add("on");
    ldTimer = setInterval(function () { ldVal += (92 - ldVal) * 0.045; ldPaint(ldVal); }, 120);
  }
  function ldHide() { clearInterval(ldTimer); $("dqg-ld").classList.remove("on"); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function showRoot() {
    root.style.display = ""; M.ui.style.transition = ""; M.ui.style.opacity = "";
    document.documentElement.classList.add("dqg-on");
    document.documentElement.style.overflow = "hidden";
  }
  /* 100%-ə çatdır, yumşaq şəkildə söndür və imtahan ekranını aç */
  async function leaveRoot() {
    clearInterval(ldTimer); ldPaint(100); await sleep(380);
    M.ui.style.transition = "opacity .45s ease"; M.ui.style.opacity = "0";
    await sleep(470);
    root.style.display = "none";
    ldHide(); M.ui.style.transition = ""; M.ui.style.opacity = "";
    document.documentElement.style.overflow = "";
  }
  function screenOn(id) { var e = document.getElementById(id); return !!(e && e.classList.contains("active")); }
  function examTitle(it) { return "Dövlət Qulluğu " + it.cat + " kateqoriyası üzrə sınaq " + it.exam; }

  async function start(it) {
    var resume = hasLocalState(it);
    closeConfirm();
    showRoot();
    ldShow(resume ? "İmtahana qayıdırsınız" : "İmtahan başlayır",
      resume ? [[0, "Cavablarınız bərpa olunur…"], [40, "Qalan vaxt hesablanır…"], [75, "İmtahan ekranı hazırlanır…"]] : null);
    /* app.js tam yüklənməyibsə gözlə */
    var fn = await waitFor(function () { return appFn(resume ? "restoreSession" : "startExamSession"); }, 15000);
    if (!fn) {
      ldHide();
      toast("Sistem hələ tam yüklənməyib. Səhifəni yeniləyib yenidən cəhd edin. Taymer işə düşmədi.");
      console.error("dqg: " + (resume ? "restoreSession" : "startExamSession") + " tapılmadı");
      return;
    }
    var fresh = !resume && !getRun(it);
    if (!resume) setRun(it);
    try { sessionStorage.setItem("dqg_flow", "1"); } catch (e) {}
    try {
      currentStudentName = session.name || currentStudentName;
      currentActiveFin = session.fin;
    } catch (e) { console.warn("dqg: sessiya dəyişənləri", e); }
    try { if (window.DQ && DQ.saveCabinet) DQ.saveCabinet({ name: session.name, fin: session.fin }); } catch (e) { console.warn("dqg: saveCabinet", e); }
    document.documentElement.classList.add("dqg-auto");
    if (!resume) autoConfirm();
    var err = null;
    try { await fn(it.exam, it.cat); } catch (e) { err = e; console.warn("dqg: start", e); }
    document.documentElement.classList.remove("dqg-auto");
    /* imtahan ekranının açılmasını gözlə (suallar şəbəkədən gələ bilər) */
    var ok = await waitFor(function () { return screenOn("exam-screen") || (resume && screenOn("result-screen")); }, err ? 800 : 12000);
    clearInterval(autoIv);
    if (!ok && session) {   /* başlamadı — taymeri geri qaytar, kartlara qayıt */
      if (fresh) unsetRun(it);
      ldHide(); refresh();
      toast("İmtahan başlamadı" + (err && err.message ? ": " + err.message : ". İcazə yoxlanılmadı və ya imtahan tapılmadı.") + " Taymer işə düşmədi.");
      return;
    }
    await leaveRoot();
  }

  /* ---------- modal (nəticə statistikası / təhlil təsdiqi) ---------- */
  var mRes = null;
  function openModal(html, resolve) {
    $m("dqg-m2").innerHTML = html; mRes = resolve || null;
    MH.host.style.setProperty("display", "block", "important");
    $m("dqg-ov2").classList.add("on");
  }
  function closeModal(v) {
    $m("dqg-ov2").classList.remove("on");
    MH.host.style.setProperty("display", "none", "important");
    var r = mRes; mRes = null; if (r) r(!!v);
  }
  function ask(html) { return new Promise(function (res) { openModal(html, res); }); }

  function donut(c, w, u, score) {
    var t = (c + w + u) || 1, R = 52, C = 2 * Math.PI * R, off = 0, out = "";
    [[c, "#34d399"], [w, "#f87171"], [u, "#64748b"]].forEach(function (g) {
      var len = C * g[0] / t;
      if (len > 0) out += '<circle cx="70" cy="70" r="52" fill="none" stroke="' + g[1] + '" stroke-width="14" stroke-dasharray="' + len + " " + (C - len) +
        '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"/>';
      off += len;
    });
    return '<svg class="dn" viewBox="0 0 140 140" role="img" aria-label="Yekun bal"><circle cx="70" cy="70" r="52" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="14"/>' +
      out + '<text x="70" y="70" text-anchor="middle" class="dnv">' + esc(score) + '</text><text x="70" y="90" text-anchor="middle" class="dnl">BAL</text></svg>';
  }
  function openInfo(it) {
    var r = session && session.res[pkey(it)];
    if (!r) { toast("Nəticə məlumatı tapılmadı."); return; }
    infoIt = it;
    var c = +r.correct_count || 0, w = +r.wrong_count || 0, u = +r.unanswered_count || 0, score = r.score == null ? 0 : r.score;
    var ss = r.subject_stats;
    if (typeof ss === "string") { try { ss = JSON.parse(ss); } catch (e) { ss = null; } }
    var ps = ""; try { var f = appFn("buildPassStatusText"); if (f) ps = f(it.cat, +score || 0); } catch (e) {}
    var subj = "";
    if (ss && typeof ss === "object") {
      Object.keys(ss).forEach(function (k) {
        var x = ss[k] || {}, a = +x.correct || 0, b = +x.wrong || 0, n = +x.unanswered || 0, t = a + b + n;
        if (!t) return;
        subj += '<div class="sj"><div class="t"><b>' + esc(k) + '</b><span>✓ ' + a + " · ✗ " + b + " · ○ " + n + " · " + Math.round(a / t * 100) + '%</span></div>' +
          '<div class="b"><i style="width:' + (a / t * 100) + '%;background:#34d399"></i><i style="width:' + (b / t * 100) + '%;background:#f87171"></i><i style="width:' + (n / t * 100) + '%;background:#64748b"></i></div></div>';
      });
    }
    openModal('<h4>Sınaq ' + esc(it.exam) + ' · ' + esc(it.cat) + ' nəticəsi</h4><div class="sb0">' + esc(session.name || session.fin) + '</div>' +
      '<div class="rs">' + donut(c, w, u, score) + '<div class="chips">' +
      '<div class="chip"><span><em style="background:#34d399"></em>Düzgün</span><b>' + c + '</b></div>' +
      '<div class="chip"><span><em style="background:#f87171"></em>Səhv</span><b>' + w + '</b></div>' +
      '<div class="chip"><span><em style="background:#64748b"></em>Cavabsız</span><b>' + u + '</b></div></div></div>' +
      (ps ? '<div class="ps">' + esc(ps) + '</div>' : '') +
      (subj ? '<h5>Fənlər üzrə statistika</h5>' + subj : '<div class="sb0">Fənn statistikası bu sınaq üçün mövcud deyil.</div>') +
      '<div class="mact"><button type="button" class="yes" data-a="chart">📊 Qrafik formanı gör</button>' + (reviewEligible(it) ? '<button type="button" class="yes" data-a="review">🔍 Səhvləri təhlil et</button>' : '') +
      '<button type="button" class="sec" data-a="cancel">Bağla</button></div>');
  }

  /* ---------- səhvlərin təhlili (yalnız 1 dəfə) ---------- */
  async function launchReview(it, direct) {
    if (reviewBusy) return;
    var ok = await ask('<h4>Səhvlərin təhlili</h4><div class="sb0">' + esc(examTitle(it)) + '</div>' +
      '<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#d5def5">Bu imkandan yalnız <b style="color:#f3d98b">1 dəfə</b> istifadə etmək olar. ' +
      'Yalnız səhv cavab verdiyiniz suallar və düzgün cavablar göstəriləcək.</p>' +
      '<p style="margin:0;font-size:13px;line-height:1.6;color:#9fb0d6">Təhlil açıldığı andan hüquq istifadə olunmuş sayılır.</p>' +
      '<div class="mact"><button type="button" class="sec" data-a="cancel">Ləğv et</button><button type="button" class="yes" data-a="ok">Təhlilə başla</button></div>');
    if (!ok) return;
    reviewBusy = true;
    showRoot();
    ldShow("Təhlil hazırlanır", [[0, "Nəticəniz yüklənir…"], [40, "Səhv cavablar seçilir…"], [75, "Təhlil ekranı hazırlanır…"]]);
    try {
      var br = await waitFor(function () { return appFn("backToReviewQuestions"); }, 8000);
      var va = direct ? true : await waitFor(function () { return appFn("viewAnswerCard"); }, 8000);
      if (!br || !va) throw new Error("sistem hələ hazır deyil");
      try { currentStudentName = session.name || currentStudentName; currentActiveFin = session.fin; } catch (e) {}
      try { sessionStorage.setItem("dqg_flow", "1"); } catch (e) {}
      if (!direct) {
        await appFn("viewAnswerCard")(String(it.exam), it.cat, session.fin, session.name || session.fin);
        if (!(await waitFor(function () { return screenOn("result-screen"); }, 8000))) throw new Error("nəticə yüklənmədi");
      }
      var oc = window.confirm; window.confirm = function () { return true; };   /* təsdiq artıq bizim pəncərədə verilib */
      try { br(); } finally { window.confirm = oc; }
      if (!(await waitFor(function () { return screenOn("exam-screen"); }, 5000))) throw new Error("təhlil ekranı açılmadı");
      if (session.res[pkey(it)]) session.res[pkey(it)].review_used = true;
      try { localStorage.setItem(reviewKey(it), "1"); } catch (e) {}
      await leaveRoot();
    } catch (e) {
      ldHide(); showRoot(); if (session) refresh();
      toast("Təhlil açılmadı: " + (e && e.message ? e.message : e));
    } finally { reviewBusy = false; }
  }

  /* ---------- «Qrafik formanı gör»: nəticə cədvəli (cavab kartı) ---------- */
  var chartBusy = false, chartMode = false, chartSeen = false;
  async function launchChart(it) {
    if (chartBusy || reviewBusy || !session) return;
    chartBusy = true;
    showRoot();
    ldShow("Nəticə hazırlanır", [[0, "Nəticəniz yüklənir…"], [45, "Cədvəl qurulur…"], [80, "Ekran hazırlanır…"]]);
    try {
      var va = await waitFor(function () { return appFn("viewAnswerCard"); }, 8000);
      if (!va) throw new Error("sistem hələ hazır deyil");
      try { currentStudentName = session.name || currentStudentName; currentActiveFin = session.fin; } catch (e) {}
      try { sessionStorage.setItem("dqg_flow", "1"); } catch (e) {}
      try { if (resultCtl.rm) resultCtl.rm(); } catch (e) {}
      chartMode = true; chartSeen = false;   /* «İmtahan tamamlandı» pəncərəsi və rəy sorğusu bu rejimdə çıxmasın */
      await va(String(it.exam), it.cat, session.fin, session.name || session.fin);
      if (!(await waitFor(function () { return screenOn("result-screen"); }, 8000))) throw new Error("nəticə yüklənmədi");
      try { window.scrollTo(0, 0); } catch (e) {}
      await leaveRoot();
    } catch (e) {
      chartMode = false; ldHide(); showRoot(); if (session) refresh();
      toast("Nəticə cədvəli açılmadı: " + (e && e.message ? e.message : e));
    } finally { chartBusy = false; }
  }

  /* ---------- imtahan bitəndən sonra push tipli rəy sorğusu ---------- */
  var FBQ = "Sınaq haqqında təəssüratınızı paylaşa bilərsinizmi, zəhmət olmasa? (Hər hansı çatışmazlıq, uyğunsuzluq varsa onu da qeyd edə bilərsiniz)";
  var FBTHX = "Diqqətiniz üçün təşəkkürlər 🙏";
  var fbHost = null;
  function fbKey(c) { return "dqg_fb:" + c.fin + ":" + c.exam + ":" + c.cat; }
  function fbRemove() { try { if (fbHost) fbHost.remove(); } catch (e) {} fbHost = null; }
  async function fbSave(c, text) {
    var data = { name: c.name || c.fin, fin: c.fin, category: c.cat, exam: c.exam, score: c.score, rating: 0, text: text, kind: "post-exam", show: false, date: new Date().toLocaleDateString("az-AZ") };
    try {
      if (typeof V2 !== "undefined" && V2 && V2.put) { await V2.put("feedback", data); return true; }
    } catch (e) {}
    try {
      var d = db(); if (!d) return false;
      var r = await d.from("dq_v2_store").insert([{ collection: "feedback", data: data }]);
      return !r.error;
    } catch (e) { return false; }
  }
  function askFeedback(c) {
    if (!c || !c.fin) return;
    try { if (localStorage.getItem(fbKey(c)) === "1") return; localStorage.setItem(fbKey(c), "1"); } catch (e) {}
    fbRemove();
    var host = document.createElement("div"); host.id = "dqg-fbh"; fbHost = host;
    [["position", "fixed"], ["top", "0"], ["left", "0"], ["right", "0"], ["z-index", "2147483646"], ["pointer-events", "none"], ["margin", "0"], ["padding", "0"], ["visibility", "visible"], ["opacity", "1"]]
      .forEach(function (x) { host.style.setProperty(x[0], x[1], "important"); });
    document.body.appendChild(host);
    var sh = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var st = document.createElement("style");
    st.textContent =
      ".n{box-sizing:border-box;pointer-events:auto;width:min(94vw,440px);margin:calc(env(safe-area-inset-top,0px) + 12px) auto 0;padding:14px 16px 14px;border-radius:18px;" +
      "background:linear-gradient(180deg,#14306b,#0c2150);border:1px solid rgba(201,162,75,.75);color:#e8eefc;font-family:inherit;" +
      "box-shadow:0 18px 50px rgba(0,0,0,.55);transform:translateY(-130%);opacity:0;transition:transform .5s cubic-bezier(.2,.9,.3,1.1),opacity .35s}" +
      ".n.on{transform:none;opacity:1}" +
      ".h{display:flex;align-items:center;gap:10px;margin-bottom:8px}" +
      ".ic{flex:none;width:32px;height:32px;border-radius:9px;background:linear-gradient(180deg,#f3d98b,#c9a24b);color:#0a1a3a;display:grid;place-items:center;font-weight:900;font-size:13px}" +
      ".t{flex:1;font-size:12px;letter-spacing:.6px;font-weight:800;color:#f3d98b;text-transform:uppercase}" +
      ".x{flex:none;width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#e8eefc;font-size:18px;line-height:1;cursor:pointer}" +
      ".x:hover{background:rgba(255,255,255,.2)}" +
      ".q{margin:0 0 12px;font-size:14.5px;line-height:1.55}" +
      ".thx{margin:6px 0 4px;font-size:16px;font-weight:800;text-align:center;color:#f3d98b}" +
      ".r{display:flex;gap:10px}" +
      ".b{flex:1;padding:11px 14px;border-radius:11px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}" +
      ".y{border:0;color:#0a1a3a;background:linear-gradient(180deg,#f3d98b,#c9a24b)}" +
      ".no{background:transparent;border:1px solid #c9a24b;color:#f3d98b}" +
      ".b:disabled{opacity:.6;cursor:default}" +
      "textarea{box-sizing:border-box;width:100%;min-height:96px;resize:vertical;margin:0 0 10px;padding:11px 12px;border-radius:11px;border:1px solid #4a63a0;background:#0a1a3f;color:#e8eefc;font:inherit;font-size:14px;line-height:1.5}" +
      "textarea:focus{outline:2px solid #c9a24b;border-color:#c9a24b}" +
      ".m{min-height:18px;margin:-2px 0 8px;font-size:12.5px;color:#fca5a5}";
    sh.appendChild(st);
    var n = document.createElement("div"); n.className = "n"; n.setAttribute("role", "alertdialog"); n.setAttribute("aria-live", "polite");
    sh.appendChild(n);
    var closed = false;
    function hide(ms) {
      if (closed) return; closed = true;
      setTimeout(function () { n.classList.remove("on"); setTimeout(fbRemove, 550); }, ms || 0);
    }
    function head() {
      return '<div class="h"><div class="ic">DQ</div><div class="t">DQ Platform · Rəy</div><button type="button" class="x" aria-label="Bağla">×</button></div>';
    }
    function thanks() {
      n.innerHTML = head() + '<div class="thx">' + FBTHX + '</div>';
      n.querySelector(".x").onclick = function () { hide(0); };
      hide(2800);
    }
    function step1() {
      n.innerHTML = head() + '<p class="q">' + esc(FBQ) + '</p><div class="r"><button type="button" class="b no" id="no">Xeyr</button><button type="button" class="b y" id="yes">Bəli</button></div>';
      n.querySelector(".x").onclick = thanks;      /* bağla düyməsi də təşəkkür göstərir */
      n.querySelector("#no").onclick = thanks;
      n.querySelector("#yes").onclick = step2;
    }
    function step2() {
      n.innerHTML = head() + '<p class="q">Fikirlərinizi, qeyd etdiyiniz çatışmazlıq və uyğunsuzluqları yazın:</p>' +
        '<textarea id="tx" maxlength="1500" placeholder="Rəyinizi bura yazın…"></textarea><div class="m" id="mg"></div>' +
        '<div class="r"><button type="button" class="b no" id="bk">Geri</button><button type="button" class="b y" id="sd">Göndər</button></div>';
      var tx = n.querySelector("#tx"), mg = n.querySelector("#mg"), sd = n.querySelector("#sd");
      n.querySelector(".x").onclick = thanks;
      n.querySelector("#bk").onclick = step1;
      try { tx.focus(); } catch (e) {}
      sd.onclick = async function () {
        var v = tx.value.trim();
        if (!v) { mg.textContent = "Zəhmət olmasa rəyinizi yazın."; return; }
        sd.disabled = true; sd.textContent = "Göndərilir…"; mg.textContent = "";
        var ok = await fbSave(c, v);
        if (ok) thanks();
        else { sd.disabled = false; sd.textContent = "Göndər"; mg.textContent = "Göndərmək mümkün olmadı. İnterneti yoxlayıb yenidən cəhd edin."; }
      };
    }
    step1();
    requestAnimationFrame(function () { requestAnimationFrame(function () { n.classList.add("on"); }); });
  }

  /* ---------- kabinetə (kartlara) qayıdış ---------- */
  var resultCtl = { rm: null };
  async function backToCards() {
    if (!session || reviewBusy) return;
    try { if (examFinished && selectedExamId && userGroup) session.done[String(selectedExamId) + "|" + String(userGroup).toUpperCase()] = 1; } catch (e) {}
    if (resultCtl.rm) resultCtl.rm();
    var keep = Object.keys(session.done);
    showRoot(); ldHide();
    $("dqg-login").style.display = "none"; $("dqg-list").style.display = "block"; $("dqg-out").style.display = "block";
    renderList();
    await loadResults();
    keep.forEach(function (k) { session.done[k] = 1; });
    refresh();
  }
  function flowOn() { try { return sessionStorage.getItem("dqg_flow") === "1"; } catch (e) { return false; } }
  (function () {
    var og = appFn("goHome");
    if (!og || og.__dqg) return;
    var ng = function () {
      var r = og.apply(this, arguments);
      if (flowOn()) setTimeout(function () {
        var a = document.querySelector(".screen.active"), id = a && a.id;
        if (id !== "exam-screen" && id !== "result-screen") backToCards();
      }, 160);
      return r;
    };
    ng.__dqg = 1; window.goHome = ng;
  })();

  /* ---------- hadisələr ---------- */
  $("dqg-go").addEventListener("click", login);
  $("dqg-fin").addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
  $("dqg-fin").addEventListener("input", function () { this.value = normFin(this.value); });
  $("dqg-grid").addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var card = t.closest(".ex"); if (!card || !session) return;
    var it = session.items[+card.dataset.i];
    if (t.closest("[data-info]")) return openInfo(it);
    if (t.closest("[data-rv]")) return launchReview(it, false);
    var b = t.closest("[data-btn]"); if (b && !b.disabled) openConfirm(it);
  });
  $("dqg-no").addEventListener("click", closeConfirm);
  $("dqg-x").addEventListener("click", closeConfirm);
  $("dqg-ov").addEventListener("click", function (e) { if (e.target === this) closeConfirm(); });
  $("dqg-yes").addEventListener("click", function () { if (pending) start(pending); });
  $("dqg-out").addEventListener("click", function () {
    session = null; clearInterval(tick);
    $("dqg-list").style.display = "none"; $("dqg-out").style.display = "none";
    $("dqg-login").style.display = ""; $("dqg-fin").value = ""; $("dqg-fin").focus();
  });
  var ov2 = $m("dqg-ov2");
  ov2.addEventListener("click", function (e) {
    var t = e.target;
    if (t === ov2 || t.id === "dqg-x2") return closeModal(false);
    var a = t.closest && t.closest("[data-a]"); if (!a) return;
    var v = a.getAttribute("data-a");
    if (v === "ok") closeModal(true);
    else if (v === "cancel") closeModal(false);
    else if (v === "review") { var it = infoIt; closeModal(false); if (it) launchReview(it, false); }
    else if (v === "chart") { var it2 = infoIt; closeModal(false); if (it2) launchChart(it2); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov2.classList.contains("on")) closeModal(false); });

  /* ---------- imtahan bitəndən sonra: bal + «Nəticəyə bax» ---------- */
  (function () {
    var shown = false, box = null, boxHost = null;
    function rmBox() { try { if (boxHost) boxHost.remove(); } catch (e) {} box = null; boxHost = null; }
    resultCtl.rm = function () { rmBox(); document.documentElement.style.overflow = ""; };
    function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ""; }
    function build() {
      var sc = txt("finalScoreText").match(/-?[\d]+(?:[.,]\d+)?/);
      var nm = txt("res-name") || (session && session.name) || "";
      var RM = mount("dqg-rh"); boxHost = RM.host; box = RM.ui; box.id = "dqg-r";
      box.innerHTML =
        '<div class="hd">' + LOGO + '<div class="brand"><b>DQ Platform</b><small>Dövlət Qulluğu Sınaq İmtahanı</small></div></div>' +
        '<div class="wrap"><div class="lg" style="max-width:440px;text-align:center">' +
        '<h1>İmtahan tamamlandı</h1>' + (nm ? '<p class="s">' + esc(nm) + '</p>' : '<p class="s">&nbsp;</p>') +
        '<div style="font-size:12px;letter-spacing:1.4px;color:#c9a24b;font-weight:800">YEKUN BAL</div>' +
        '<div style="font-size:72px;font-weight:900;line-height:1.1;margin:6px 0 4px;color:#f3d98b;text-shadow:0 4px 24px rgba(201,162,75,.35)">' +
        (sc ? esc(sc[0]) : "0") + '</div><div style="color:#9fb0d6;margin-bottom:6px">bal</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin:16px 0 4px;font-size:13px;color:#c8d4f0">' +
        '<span>✅ ' + esc(txt("totalCorrect") || "0") + '</span><span>❌ ' + esc(txt("totalWrong") || "0") + '</span><span>➖ ' + esc(txt("totalUnanswered") || "0") + '</span></div>' +
        '<button type="button" class="gold" id="dqg-view">Nəticəyə bax</button>' +
        '<button type="button" class="rv" id="dqg-rv" style="display:none">🔍 Səhvləri təhlil et (1 dəfə)</button>' +
        '<button type="button" class="rv" id="dqg-cab">Kabinetə qayıt</button></div></div>';
      try {
        var fbc = { fin: session && session.fin, name: nm, exam: String(selectedExamId), cat: String(userGroup).toUpperCase(), score: sc ? sc[0] : "0" };
        setTimeout(function () { askFeedback(fbc); }, 1800);
      } catch (e) {}
      var wn = parseInt(txt("totalWrong"), 10) || 0, used = false;
      try { var iu = appFn("isReviewAlreadyUsed"); used = !!(iu && iu()); } catch (e) {}
      if (wn > 0 && !used) box.querySelector("#dqg-rv").style.display = "";
      box.querySelector("#dqg-rv").onclick = function () {
        var it = null; try { it = { exam: String(selectedExamId), cat: String(userGroup).toUpperCase() }; } catch (e) {}
        if (!it || !session) return;
        rmBox(); launchReview(it, true);
      };
      box.querySelector("#dqg-cab").onclick = function () { rmBox(); backToCards(); };
      document.documentElement.style.overflow = "hidden";
      box.querySelector("#dqg-view").onclick = function () {
        rmBox(); document.documentElement.style.overflow = "";
        var r = document.getElementById("result-screen"); if (r && r.scrollIntoView) r.scrollIntoView();
      };
    }
    setInterval(function () {
      var flow = false; try { flow = sessionStorage.getItem("dqg_flow") === "1"; } catch (e) {}
      if (!flow || reviewBusy) return;
      var r = document.getElementById("result-screen");
      var on = !!(r && r.classList.contains("active") && r.offsetParent);
      if (on && chartMode) chartSeen = true;
      if (on && !shown) { shown = true; if (!chartMode) setTimeout(function () { if (!box && !chartMode) build(); }, 400); }
      if (!on) { shown = false; if (!chartBusy && chartSeen) { chartMode = false; chartSeen = false; } if (box) { rmBox(); document.documentElement.style.overflow = ""; } }
    }, 600);
  })();
  setTimeout(function () { try { $("dqg-fin").focus(); } catch (e) {} }, 300);
})();
