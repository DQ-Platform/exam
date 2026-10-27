/* =====================================================================
   DQ Admin Fix — dq-admin-fix.js?v=1      (index.html-in ƏN SONUNDA yüklənir)
   Problem: redaktə/admin panelə heç bir yoldan girmək olmur; ekranda
   «Kabinetə giriş → Yoxlanılır…» ilişib qalır.
   Səbəb (kodda tapıldı):
     • Sual redaktoru (📝 Suallar) sınaq sessiyasını başladır; iştirakçı
       «Kabinetə giriş» (İş nömrəsi) pəncərəsi admin əvəzinə çıxır və
       Supabase sorğusu cavab verməyəndə «Yoxlanılır…» sonsuza qədər qalır.
     • Mövcud qoruyucu (__dqKillGiris) yalnız 25 saniyə işləyir.
     • Admin girişi yalnız Gmail OTP-yə bağlıdır (e-poçt limiti/baza xətası olsa — giriş yoxdur).
   Həll:
     1) Ayrıca, etibarlı «Admin giriş» pəncərəsi (admin kodu ilə; Gmail kodu ehtiyat).
     2) Admin rejimi aktiv olduqca iştirakçı giriş pəncərəsi DAİMİ söndürülür.
     3) Bütün GET sorğularına vaxt limiti (ilişən «Yoxlanılır…» olmasın).
     4) İlişmiş «Yoxlanılır…/Hazırlanır…» düymələrini avtomatik bərpa edən nəzarətçi.
     5) Diaqnostika (🩺): hansı hissənin işləmədiyini göstərir.
   Açılış: ?admin=1 · #admin · Ctrl+Shift+A · loqoya 5 dəfə toxun · DQAdminFix.open()
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQAdminFix) return;

  var D = document, NAVY = "#0b2a6b", GOLD = "#c9a063", Z = 2147483600, KEY = "dq_nav2_unlock";
  var SB = "https://cpzwliqlgaplroscvduo.supabase.co";
  function $(i) { return D.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function toast(t) {
    try { if (window.V2 && V2.toast) return V2.toast(t); } catch (e) { }
    var o = $("dqaf-toast"); if (o) o.remove();
    o = D.createElement("div"); o.id = "dqaf-toast"; o.textContent = t;
    o.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);max-width:88vw;z-index:" + (Z + 5) + ";background:#0f172a;color:#fff;padding:11px 16px;border-radius:12px;font:600 14px system-ui,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);text-align:center";
    D.body.appendChild(o); setTimeout(function () { o.remove(); }, 3500);
  }
  function g(name) { try { return (0, eval)("typeof " + name + "!=='undefined'?" + name + ":undefined"); } catch (e) { return undefined; } }
  function setG(name, v) { try { (0, eval)(name + "=" + JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ------------------------------------------------------------------
     1) admin vəziyyəti
     ------------------------------------------------------------------ */
  var adminOn = false;
  function isAdmin() {
    if (adminOn) return true;
    try { if (window.__dqAuthed === true || window.__dqEditOk === true) return true; } catch (e) { }
    try { if (localStorage.getItem("dq_admin_logged") === "true") return true; } catch (e) { }
    try { if (g("currentActiveFin") === "ADMIN") return true; } catch (e) { }
    return false;
  }
  function grant() {
    adminOn = true;
    try { window.__dqAuthed = true; } catch (e) { }
    try { localStorage.setItem("dq_admin_logged", "true"); } catch (e) { }
    try { sessionStorage.setItem(KEY, "1"); sessionStorage.setItem("dq_nav2_unlock", "1"); } catch (e) { }
    try { window.DQ_NAV2 && DQ_NAV2.unlock && DQ_NAV2.unlock(); } catch (e) { }
    try { localStorage.setItem("dq_nav_adm", String(Date.now())); } catch (e) { }
    killLogin();
    fab();
  }
  function revoke() {
    adminOn = false;
    try { localStorage.removeItem("dq_nav_adm"); } catch (e) { }
    try { window.__dqAuthed = false; window.__dqEditOk = false; } catch (e) { }
    try { localStorage.removeItem("dq_admin_logged"); localStorage.removeItem("dq_adm_tok"); sessionStorage.removeItem(KEY); sessionStorage.removeItem("dq_nav2_unlock"); } catch (e) { }
    var f = $("dqaf-fab"); if (f) f.remove();
    var p = $("dqpp-fab"); if (p) p.remove();
  }

  /* ------------------------------------------------------------------
     2) iştirakçı «Kabinetə giriş» pəncərəsi — admin rejimində daimi söndürülür
     ------------------------------------------------------------------ */
  function looksLikeCabLogin(el) {
    if (!el || el.nodeType !== 1 || el.id === "dqaf-ov" || el.id === "dqaf-diag") return false;
    if (el.closest && el.closest("#dqaf-ov,#dqaf-diag,#dqpp-ov,#dqps-ov,#dqps-pv")) return false;
    if (el.id === "dqg" || (el.classList && el.classList.contains("dqg-ov"))) return true;
    var cs; try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (cs.position !== "fixed" && cs.position !== "absolute") return false;
    var t = el.textContent || "";
    return t.length < 900 && /Kabinet[əe]\s*giri[şs]/i.test(t) && !!el.querySelector("input");
  }
  function killLogin() {
    if (!isAdmin()) return;
    try { D.documentElement.classList.remove("dqg-pre"); } catch (e) { }
    var kids = D.body ? D.body.children : [], rm = [], i;
    for (i = 0; i < kids.length; i++) if (looksLikeCabLogin(kids[i])) rm.push(kids[i]);
    rm.forEach(function (n) { try { n.remove(); } catch (e) { } });
    if (rm.length) { try { D.body.classList.remove("dq-ov-lock"); D.documentElement.style.overflow = ""; D.body.style.overflow = ""; } catch (e) { } }
  }
  try {
    var pend = 0;
    new MutationObserver(function () {
      if (pend || !isAdmin()) return;
      pend = 1; setTimeout(function () { pend = 0; killLogin(); }, 30);
    }).observe(D.documentElement, { childList: true, subtree: false });
    D.addEventListener("DOMContentLoaded", function () {
      try { new MutationObserver(function () { if (pend || !isAdmin()) return; pend = 1; setTimeout(function () { pend = 0; killLogin(); }, 30); }).observe(D.body, { childList: true }); } catch (e) { }
    });
    if (D.body) new MutationObserver(function () { if (pend || !isAdmin()) return; pend = 1; setTimeout(function () { pend = 0; killLogin(); }, 30); }).observe(D.body, { childList: true });
  } catch (e) { }

  /* ------------------------------------------------------------------
     3) GET sorğularına vaxt limiti (sonsuz «Yoxlanılır…» olmasın)
     ------------------------------------------------------------------ */
  (function () {
    var RF = window.fetch; if (!RF || RF.__dqaf) return;
    var LIMIT = 45000;
    var w = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        var m = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if (m === "GET" && url.indexOf(SB) === 0 && !(init && init.signal) && window.AbortController) {
          var ac = new AbortController(), t = setTimeout(function () { try { ac.abort(); } catch (e) { } }, LIMIT);
          var init2 = Object.assign({}, init || {}, { signal: ac.signal });
          return RF.call(this, input, init2).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
        }
      } catch (e) { }
      return RF.apply(this, arguments);
    };
    w.__dqaf = 1; window.fetch = w;
  })();

  /* ------------------------------------------------------------------
     4) ilişmiş düymələrin nəzarətçisi
     ------------------------------------------------------------------ */
  var seen = new WeakMap();
  setInterval(function () {
    if (D.hidden) return;
    var now = Date.now(), list = D.querySelectorAll("button");
    for (var i = 0; i < list.length; i++) {
      var b = list[i], tx = (b.textContent || "").replace(/\s+/g, " ").trim();
      var kind = /^Yoxlan[ıi]l[ıi]r[….]*$/i.test(tx) ? "y" : /^Haz[ıi]rlan[ıi]r[….]*$/i.test(tx) ? "h" : "";
      if (!kind) { if (seen.has(b)) seen.delete(b); continue; }
      var t0 = seen.get(b);
      if (!t0) { seen.set(b, now); continue; }
      if (now - t0 < 20000) continue;
      seen.delete(b);
      var restore = kind === "y" ? "Yenidən cəhd et" : "PDF-ə çevir";
      if (kind === "y" && (b.closest && b.closest("[class*=dqg],#dqg,.dq-fl,[class*=giris]"))) restore = "Davam et";
      try { b.disabled = false; b.removeAttribute("disabled"); b.textContent = restore; } catch (e) { }
      toast("Server cavab vermədi. İnternetinizi yoxlayıb yenidən cəhd edin.");
    }
  }, 2000);

  /* ------------------------------------------------------------------
     5) admin giriş pəncərəsi
     ------------------------------------------------------------------ */
  function css() {
    if ($("dqaf-css")) return;
    var s = D.createElement("style"); s.id = "dqaf-css";
    s.textContent =
      "#dqaf-ov{position:fixed;inset:0;z-index:" + Z + ";display:flex;align-items:flex-end;justify-content:center;background:rgba(8,14,40,.66);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);font-family:Mulish,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
      "@media(min-width:560px){#dqaf-ov{align-items:center;padding:16px}}" +
      "#dqaf{width:100%;max-width:420px;max-height:92vh;overflow:auto;background:#fff;color:#1c2333;border-radius:22px 22px 0 0;box-shadow:0 -10px 50px rgba(0,0,0,.4);text-align:left;padding:0 0 calc(16px + env(safe-area-inset-bottom,0px))}" +
      "@media(min-width:560px){#dqaf{border-radius:22px}}" +
      "#dqaf:before{content:'';display:block;height:4px;background:linear-gradient(90deg," + NAVY + "," + GOLD + ")}" +
      "#dqaf .in{padding:18px 20px 4px}#dqaf h3{margin:0 0 4px;font-size:20px;font-weight:800;color:" + NAVY + "}#dqaf p{margin:0 0 12px;font-size:13.5px;color:#64748b}" +
      "#dqaf .f{display:flex;gap:8px}#dqaf input{flex:1;min-width:0;border:1.5px solid #cfd8ea;border-radius:12px;padding:13px;font:inherit;font-size:17px;letter-spacing:2px;background:#f8faff;color:#0b1b4a}" +
      "#dqaf input:focus{outline:0;border-color:" + NAVY + ";background:#fff}" +
      "#dqaf .eye{flex:none;width:48px;border:1.5px solid #cfd8ea;border-radius:12px;background:#fff;font-size:18px;cursor:pointer}" +
      "#dqaf .m{min-height:20px;margin:8px 0 2px;font-size:13px;font-weight:700;color:#b42318}" +
      "#dqaf .r{display:flex;gap:10px;margin:8px 0 0}#dqaf button.b{flex:1;border:1.5px solid #dfe2ee;border-radius:13px;background:#fff;color:#1c2333;font:800 15px inherit;font-family:inherit;padding:13px;cursor:pointer}" +
      "#dqaf button.b.ok{flex:1.6;background:" + NAVY + ";border-color:" + NAVY + ";color:#fff}#dqaf button:disabled{opacity:.5}" +
      "#dqaf .alt{display:block;width:100%;margin:10px 0 0;border:0;background:none;color:" + NAVY + ";font:700 13.5px inherit;font-family:inherit;text-decoration:underline;cursor:pointer;padding:8px}" +
      "#dqaf .mn{display:grid;gap:9px;margin:6px 0 4px}#dqaf .mn button{display:flex;align-items:center;gap:12px;text-align:left;border:1.5px solid #e1e6f2;border-radius:14px;background:#fbfcff;padding:13px 14px;font:700 15px inherit;font-family:inherit;color:#1c2333;cursor:pointer}" +
      "#dqaf .mn button span{font-size:22px;flex:none}#dqaf .mn button small{display:block;font-weight:500;font-size:12px;color:#64748b;margin-top:1px}" +
      "#dqaf .mn button.x{border-color:#f3c7c7;background:#fff7f7;color:#b42318}" +
      "#dqaf-diag{position:fixed;inset:0;z-index:" + (Z + 1) + ";background:#eef1f8;overflow:auto;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;padding:calc(14px + env(safe-area-inset-top,0px)) 14px 40px;text-align:left}" +
      "#dqaf-diag h3{margin:0 0 4px;color:" + NAVY + "}#dqaf-diag .row{background:#fff;border:1px solid #dfe5f1;border-radius:12px;padding:10px 12px;margin:8px 0;font-size:14px}#dqaf-diag .row b{display:block}#dqaf-diag .row small{color:#64748b}" +
      "#dqaf-diag button{border:0;border-radius:12px;background:" + NAVY + ";color:#fff;font:800 14px inherit;font-family:inherit;padding:12px 16px;margin:6px 6px 0 0;cursor:pointer}" +
      "#dqaf-fab{position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:" + (Z - 20) + ";border:0;border-radius:999px;background:" + GOLD + ";color:#1b2540;font:800 13px Mulish,system-ui,Arial,sans-serif;padding:11px 15px;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer}";
    D.head.appendChild(s);
  }
  function close() { var o = $("dqaf-ov"); if (o) o.remove(); try { D.body.classList.remove("dq-ov-lock"); } catch (e) { } }
  function shell(html) {
    css(); close();
    var o = D.createElement("div"); o.id = "dqaf-ov"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
    o.innerHTML = '<div id="dqaf"><div class="in">' + html + "</div></div>";
    D.body.appendChild(o);
    o.addEventListener("pointerdown", function (e) { if (e.target === o) close(); });
    return o;
  }

  var fails = 0, lockUntil = 0;
  function adminCode() { var c = g("ADMIN_PASS"); return (typeof c === "string" && c) ? c : ""; }

  function login() {
    if (isAdmin()) return menu();
    var o = shell('<h3>🔐 Admin giriş</h3><p>Admin kodunu daxil edin.</p>' +
      '<div class="f"><input id="dqaf-c" type="password" inputmode="numeric" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="••••••••" aria-label="Admin kodu"><button type="button" class="eye" id="dqaf-e" aria-label="Göstər">👁</button></div>' +
      '<div class="m" id="dqaf-m" role="alert"></div>' +
      '<div class="r"><button type="button" class="b" id="dqaf-no">Ləğv et</button><button type="button" class="b ok" id="dqaf-go">Daxil ol</button></div>' +
      '<button type="button" class="alt" id="dqaf-gm">📧 Gmail kodu ilə daxil ol</button>' +
      '<button type="button" class="alt" id="dqaf-dg">🩺 Diaqnostika</button>');
    var inp = $("dqaf-c"), m = $("dqaf-m"), go = $("dqaf-go");
    setTimeout(function () { try { inp.focus(); } catch (e) { } }, 80);
    function submit() {
      var left = Math.ceil((lockUntil - Date.now()) / 1000);
      if (left > 0) { m.textContent = "Çox səhv cəhd. " + left + " san. gözləyin."; return; }
      var v = inp.value.trim();
      if (!v) { m.textContent = "Kodu yazın."; return; }
      var code = adminCode();
      if (!code) { m.textContent = "Kod yoxlanıla bilmədi (app.js yüklənməyib). Səhifəni yeniləyin və ya Gmail kodu ilə girin."; return; }
      if (v === code) { fails = 0; grant(); menu(); return; }
      if (++fails >= 5) { fails = 0; lockUntil = Date.now() + 60000; m.textContent = "Çox səhv cəhd. 60 san. gözləyin."; }
      else m.textContent = "Kod yanlışdır. Qalan cəhd: " + (5 - fails);
      inp.value = ""; inp.focus();
    }
    go.onclick = submit;
    inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } };
    $("dqaf-e").onclick = function () { inp.type = inp.type === "password" ? "text" : "password"; inp.focus(); };
    $("dqaf-no").onclick = close;
    $("dqaf-gm").onclick = function () {
      close();
      try { if (window.DQADM && DQADM.login) return DQADM.login(); if (window.__dqAdminLogin) return window.__dqAdminLogin(); } catch (e) { }
      toast("Gmail ilə giriş modulu tapılmadı");
    };
    $("dqaf-dg").onclick = function () { close(); diag(); };
    return o;
  }

  /* ------------------------------------------------------------------
     6) admin menyusu — hər bölməyə ayrı düymə
     ------------------------------------------------------------------ */
  function openCentral() {
    close(); grant();
    try {
      if (typeof showScreen !== "function") throw new Error("showScreen yoxdur");
      if (window.DQNav && DQNav.toAdmin) DQNav.toAdmin(); else {
      showScreen("admin-panel");
      try { loadAdminPanelData(); } catch (e) { }
      window.scrollTo(0, 0); }
    } catch (e) { toast("Admin panel açıla bilmədi: " + (e && e.message || e)); }
  }
  function openEditor() {
    close(); grant();
    try { window.__dqEditOk = true; } catch (e) { }
    try { window.__dqKillGiris && window.__dqKillGiris(60000); } catch (e) { }
    try {
      if (typeof startExamSession !== "function") throw new Error("startExamSession yoxdur");
      try { isLiveEditMode = true; } catch (e) { setG("isLiveEditMode", true); }
      try { currentStudentName = "ADMIN REDAKTOR"; } catch (e) { setG("currentStudentName", "ADMIN REDAKTOR"); }
      try { currentActiveFin = "ADMIN"; } catch (e) { setG("currentActiveFin", "ADMIN"); }
      var p = $("live-edit-panel"); if (p) p.style.display = "block";
      toast("Redaktor açılır…");
      Promise.resolve(startExamSession("1", "BA")).then(function () {
        var n = 0, t = setInterval(function () {
          killLogin();
          if (++n > 80) { clearInterval(t); return; }
          var ex = $("exam-screen"), qs = g("allQuestions");
          if (ex && ex.classList.contains("active") && qs && qs.length) {
            clearInterval(t);
            try { if (!g("inlineEditOn")) toggleInlineEdit(); } catch (e) { }
          }
        }, 300);
      }).catch(function (e) { toast("Redaktor açıla bilmədi: " + (e && e.message || e)); });
    } catch (e) { toast("Redaktor açıla bilmədi: " + (e && e.message || e)); }
  }
  function openV2() {
    close(); grant();
    try { localStorage.setItem("dq_admin_logged", "true"); V2.open(); } catch (e) { toast("Panel v2 açıla bilmədi"); }
  }
  function menu() {
    var items = [
      ["🛡️", "Mərkəzi admin panel", "Suallar, sınaqlar, nəticələr, PDF alətləri", openCentral],
      ["📝", "Sual redaktoru", "Canlı redaktə rejimi", openEditor],
      ["⚙️", "Panel v2", "Mobil idarəetmə paneli", openV2],
      ["🗂️", "Sual papkaları", "Fənn üzrə suallar + PDF-ə çevir", function () { close(); grant(); window.DQPapka ? DQPapka.open() : toast("Modul yüklənməyib (dq-sual-papka.js)"); }],
      ["🩺", "Diaqnostika", "Nə işləmir? — yoxlama", function () { close(); diag(); }]
    ];
    shell('<h3>🛡️ Admin</h3><p>Bölmə seçin</p><div class="mn" id="dqaf-mn">' +
      items.map(function (it, i) { return '<button type="button" data-i="' + i + '"><span>' + it[0] + "</span><div>" + esc(it[1]) + "<small>" + esc(it[2]) + "</small></div></button>"; }).join("") +
      '<button type="button" class="x" data-i="x"><span>🚪</span><div>Admin çıxışı<small>Bu cihazda admin rejimini bağla</small></div></button></div>');
    $("dqaf-mn").onclick = function (e) {
      var b = e.target.closest("button[data-i]"); if (!b) return;
      if (b.dataset.i === "x") { revoke(); close(); toast("Admin rejimi bağlandı"); return; }
      items[+b.dataset.i][3]();
    };
  }

  /* ------------------------------------------------------------------
     7) diaqnostika
     ------------------------------------------------------------------ */
  function timed(fn, ms) {
    var t0 = Date.now();
    return new Promise(function (res) {
      var done = false, tm = setTimeout(function () { if (!done) { done = true; res({ ok: false, ms: Date.now() - t0, msg: "cavab yoxdur (" + ms / 1000 + " san.)" }); } }, ms);
      Promise.resolve().then(fn).then(function (r) { if (done) return; done = true; clearTimeout(tm); res(Object.assign({ ok: true, ms: Date.now() - t0 }, r || {})); },
        function (e) { if (done) return; done = true; clearTimeout(tm); res({ ok: false, ms: Date.now() - t0, msg: String(e && e.message || e) }); });
    });
  }
  async function diag() {
    css();
    var o = $("dqaf-diag"); if (o) o.remove();
    o = D.createElement("div"); o.id = "dqaf-diag";
    o.innerHTML = '<h3>🩺 Diaqnostika</h3><small style="color:#64748b">Nəticəni ekran görüntüsü ilə göndərə bilərsiniz.</small><div id="dqaf-rows"></div><button type="button" id="dqaf-re">↻ Təkrar yoxla</button><button type="button" id="dqaf-x">✕ Bağla</button>';
    D.body.appendChild(o);
    $("dqaf-x").onclick = function () { o.remove(); };
    $("dqaf-re").onclick = function () { o.remove(); diag(); };
    var rows = $("dqaf-rows");
    function add(ok, title, note) { var d = D.createElement("div"); d.className = "row"; d.innerHTML = "<b>" + (ok === null ? "ℹ️" : ok ? "✅" : "❌") + " " + esc(title) + "</b><small>" + esc(note || "") + "</small>"; rows.appendChild(d); }
    var sbc = (function () { try { return typeof _supabase !== "undefined" ? _supabase : null; } catch (e) { return null; } })();
    add(null, "Rejim", "Admin: " + (isAdmin() ? "aktiv" : "yox") + " · Brauzer onlayn: " + (navigator.onLine ? "bəli" : "XEYR"));
    ["V2", "V3", "YQ2", "DQ", "DQADM", "DQPapka", "DQPdfSecim", "DQPDF"].forEach(function (n) { add(!!window[n] || g(n) !== undefined, "Modul " + n, (window[n] || g(n) !== undefined) ? "yüklənib" : "YÜKLƏNMƏYİB (fayl tapılmır və ya xəta var)"); });
    ["showScreen", "startExamSession", "switchAdminTab", "loadAdminPanelData", "toggleInlineEdit"].forEach(function (n) { var ok = typeof g(n) === "function"; add(ok, "Funksiya " + n, ok ? "var" : "yoxdur — app.js tam yüklənməyib"); });
    add(!!adminCode(), "Admin kodu (ADMIN_PASS)", adminCode() ? "app.js-də təyin olunub" : "tapılmadı");
    var r = await timed(function () { return fetch(SB + "/auth/v1/health", { headers: { apikey: "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF" } }).then(function (x) { return { msg: "HTTP " + x.status }; }); }, 10000);
    add(r.ok, "Supabase Auth (Gmail kodu üçün)", r.ok ? r.ms + " ms · " + r.msg : r.msg);
    if (sbc) {
      r = await timed(function () { return sbc.from("allowed_students").select("fin", { count: "exact", head: true }).then(function (x) { if (x.error) throw x.error; return { msg: "cədvəl oxundu" }; }); }, 12000);
      add(r.ok, "allowed_students (İş nömrəsi yoxlaması)", r.ok ? r.ms + " ms · " + r.msg : r.msg + " → «Yoxlanılır…» ilişməsinin səbəbi budur");
      r = await timed(function () { return sbc.from("exam_questions").select("id", { count: "exact", head: true }).then(function (x) { if (x.error) throw x.error; return { msg: (x.count == null ? "?" : x.count) + " sual" }; }); }, 12000);
      add(r.ok, "exam_questions (suallar)", r.ok ? r.ms + " ms · " + r.msg : r.msg);
      r = await timed(function () { return sbc.from("dq_v2_store").select("id", { count: "exact", head: true }).then(function (x) { if (x.error) throw x.error; return { msg: "oxundu" }; }); }, 12000);
      add(r.ok, "dq_v2_store (panel məlumatları)", r.ok ? r.ms + " ms · " + r.msg : r.msg);
    } else add(false, "Supabase klienti", "_supabase tapılmadı");
    add(null, "Bitdi", "❌ olan sətirlər problemin yeridir.");
  }

  /* ------------------------------------------------------------------
     8) giriş nöqtələri
     ------------------------------------------------------------------ */
  function fab() {
    if (!isAdmin() || $("dqaf-fab") || !D.body) return;
    css();
    var b = D.createElement("button"); b.id = "dqaf-fab"; b.type = "button"; b.textContent = "🛡️ Admin";
    b.onclick = function () { menu(); };
    D.body.appendChild(b);
  }
  setInterval(function () { try { if (isAdmin()) { fab(); } else { var f = $("dqaf-fab"); if (f) f.remove(); } } catch (e) { } }, 1500);

  D.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) { e.preventDefault(); login(); }
  });
  var taps = [];
  D.addEventListener("click", function (e) {
    var n = e.target, hops = 0;
    while (n && n !== D.body && hops++ < 4) {
      var tx = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (tx.length && tx.length < 24 && /^DQ\s*Platform/i.test(tx)) {
        var now = Date.now(); taps = taps.filter(function (t) { return now - t < 3500; }); taps.push(now);
        if (taps.length >= 5) { taps = []; login(); }
        return;
      }
      n = n.parentElement;
    }
  }, true);
  function fromUrl() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("admin") === "1" || location.hash === "#admin") setTimeout(login, 1200);
      if (q.get("diag") === "1") setTimeout(diag, 1500);
    } catch (e) { }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fromUrl); else fromUrl();
  window.addEventListener("load", function () { setTimeout(function () { if (isAdmin()) { killLogin(); fab(); } }, 800); });

  window.DQAdminFix = { open: login, menu: menu, editor: openEditor, central: openCentral, diag: diag, grant: grant, revoke: revoke, version: 1 };
})();
