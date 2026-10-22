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
    "@media(max-width:520px){#dqg .lg{margin-top:5vh;padding:24px 18px}#dqg .grid{grid-template-columns:1fr}}"
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
    "html.dq13-dark #dqg,html.dq13-dark #dqg-rh{filter:invert(1) hue-rotate(180deg)}";
  document.head.appendChild(st);

  /* Shadow DOM: index.html / digər skriptlərin qlobal CSS-i (.ov, .md, .hd, .grid, .logo …) bu pəncərəyə toxuna bilmir */
  function mount(hostId) {
    var host = document.createElement("div");
    host.id = hostId;
    document.body.appendChild(host);
    [["position", "fixed"], ["top", "0"], ["right", "0"], ["bottom", "0"], ["left", "0"], ["z-index", "2147483600"],
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
  var tst = document.createElement("div"); tst.className = "toast"; tst.id = "dqg-toast"; M.ui.appendChild(tst);
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
      /* artıq təhvil verilmiş nəticələr */
      var done = {};
      try {
        var rr = await db().from("exam_results").select("exam_no,category").eq("fin", fin);
        (rr.data || []).forEach(function (x) { done[String(x.exam_no) + "|" + String(x.category).toUpperCase()] = 1; });
      } catch (e) {}
      session = { fin: fin, name: name, items: items, prog: prog, done: done };
      renderList();
    } catch (e) {
      showErr("Xəta: " + (e.message || e));
    } finally { b.disabled = false; b.textContent = "Daxil ol"; }
  }

  /* ---------- kartlar ---------- */
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
        '<div class="ft"><button type="button" class="gold" data-btn></button></div></div>';
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
  async function start(it) {
    var resume = hasLocalState(it), yes = $("dqg-yes");
    if (yes) { yes.disabled = true; yes.textContent = "Hazırlanır…"; }
    /* app.js tam yüklənməyibsə gözlə (açılış ekranı hələ 100% olmaya bilər) */
    var fn = await waitFor(function () { return appFn(resume ? "restoreSession" : "startExamSession"); }, 15000);
    if (yes) { yes.disabled = false; yes.textContent = "Bəli"; }
    if (!fn) {
      closeConfirm();
      toast("Sistem hələ tam yüklənməyib və ya imtahan funksiyası tapılmadı. Səhifəni yeniləyib yenidən cəhd edin. Taymer işə düşmədi.");
      console.error("dqg: " + (resume ? "restoreSession" : "startExamSession") + " tapılmadı");
      return;
    }
    var fresh = !resume && !getRun(it);
    if (!resume) setRun(it);
    closeConfirm();
    try { sessionStorage.setItem("dqg_flow", "1"); } catch (e) {}
    try {
      currentStudentName = session.name || currentStudentName;
      currentActiveFin = session.fin;
    } catch (e) { console.warn("dqg: sessiya dəyişənləri", e); }
    try { if (window.DQ && DQ.saveCabinet) DQ.saveCabinet({ name: session.name, fin: session.fin }); } catch (e) { console.warn("dqg: saveCabinet", e); }
    document.documentElement.classList.add("dqg-auto");
    root.style.display = "none";
    document.documentElement.style.overflow = "";
    if (!resume) autoConfirm();
    var err = null;
    try { await fn(it.exam, it.cat); } catch (e) { err = e; console.warn("dqg: start", e); }
    document.documentElement.classList.remove("dqg-auto");
    /* imtahan ekranının açılmasını 10 san gözlə (suallar şəbəkədən gələ bilər) */
    var ok = await waitFor(function () {
      var es = document.getElementById("exam-screen"), rs = document.getElementById("result-screen");
      return (es && es.classList.contains("active")) || (rs && rs.classList.contains("active"));
    }, err ? 800 : 10000);
    clearInterval(autoIv);
    if (!ok && session) {   /* başlamadı — taymeri geri qaytar və kartlara qayıt */
      if (fresh) unsetRun(it);
      root.style.display = ""; document.documentElement.classList.add("dqg-on");
      document.documentElement.style.overflow = "hidden";
      $("dqg-list").style.display = "block"; refresh();
      toast("İmtahan başlamadı" + (err && err.message ? ": " + err.message : ". İcazə yoxlanılmadı və ya imtahan tapılmadı.") + " Taymer işə düşmədi.");
    }
  }

  /* ---------- hadisələr ---------- */
  $("dqg-go").addEventListener("click", login);
  $("dqg-fin").addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
  $("dqg-fin").addEventListener("input", function () { this.value = normFin(this.value); });
  $("dqg-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-btn]"); if (!b || b.disabled) return;
    openConfirm(session.items[+b.closest(".ex").dataset.i]);
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

  /* ---------- imtahan bitəndən sonra: bal + «Nəticəyə bax» ---------- */
  (function () {
    var shown = false, box = null, boxHost = null;
    function rmBox() { try { if (boxHost) boxHost.remove(); } catch (e) {} box = null; boxHost = null; }
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
        '<button type="button" class="gold" id="dqg-view">Nəticəyə bax</button></div></div>';
      document.documentElement.style.overflow = "hidden";
      box.querySelector("#dqg-view").onclick = function () {
        rmBox(); document.documentElement.style.overflow = "";
        var r = document.getElementById("result-screen"); if (r && r.scrollIntoView) r.scrollIntoView();
      };
    }
    setInterval(function () {
      var flow = false; try { flow = sessionStorage.getItem("dqg_flow") === "1"; } catch (e) {}
      if (!flow) return;
      var r = document.getElementById("result-screen");
      var on = !!(r && r.classList.contains("active") && r.offsetParent);
      if (on && !shown) { shown = true; setTimeout(function () { if (!box) build(); }, 400); }
      if (!on) { shown = false; if (box) { rmBox(); document.documentElement.style.overflow = ""; } }
    }, 600);
  })();
  setTimeout(function () { try { $("dqg-fin").focus(); } catch (e) {} }, 300);
})();
