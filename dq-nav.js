/* =====================================================================
   DQ Nav — dq-nav.js?v=1        (index.html-in ƏN SONUNDA yüklənir)
   1) Admin sessiyası yeniləmədə (F5 / «Yenilə») itmir: «yapışqan» admin (30 gün, yalnız
      açıq çıxışda silinir). checkAuth() flag-ı silsə də geri qaytarılır.
   2) «Qaldığın yerdən davam»: admin paneli, modul, Sual modulunun addımı (sınaq/kateqoriya/
      fənn/sual), canlı redaktor (sınaq №, kateqoriya, sual №, redaktə açıq/bağlı),
      V2 səhifəsi, Pro Add — yeniləmədən sonra eyni yerə qayıdır.
   3) Hər modulda: «⬅ Əvvələ (Geri)», «🛠 Admin panelə qayıt», «🏠 Əsas səhifə» düymələri
      (admin modulları, redaktor rejimi, V2/V3/Sual papkaları, PDF önbaxışı).
   4) «Yapışıb qalan» boş admin panel vəziyyəti (şəkildəki) avtomatik düzəlir.
   5) Redaktor və imtahan ekranı telefonda HƏMİŞƏ masaüstü rejimdə (1280 px) açılır.
   6) Açıq sualın inline redaktorunda «Düzgün açıq cavab» xanası həmişə var.
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQNav) return;

  var D = document, NAVY = "#0b2a6b", GOLD = "#c9a063", Z = 2147483000;
  var KS = "dq_nav_state", KA = "dq_nav_adm", KH = "dq_nav_hist";
  function $(i) { return D.getElementById(i); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  function g(name) { try { return (0, eval)("typeof " + name + "!=='undefined'?" + name + ":undefined"); } catch (e) { return undefined; } }
  function setG(name, v) { try { (0, eval)(name + "=" + JSON.stringify(v)); return true; } catch (e) { return false; } }
  function call(fn) { try { return fn(); } catch (e) { return undefined; } }
  function vis(el) { return !!el && el.style.display !== "none" && getComputedStyle(el).display !== "none"; }

  /* ------------------------------------------------------------------
     1) yapışqan admin sessiyası
     ------------------------------------------------------------------ */
  function stickyOn() { var v = +lsGet(KA); return !!v && Date.now() - v < 30 * 864e5; }
  function stickySet() { lsSet(KA, String(Date.now())); }
  function stickyClear() { lsDel(KA); }
  function adminFlag() { return lsGet("dq_admin_logged") === "true" || window.__dqAuthed === true; }
  function isAdmin() { return adminFlag() || stickyOn(); }

  var lastRefresh = 0;
  function keepAdmin() {
    if (adminFlag()) {
      if (Date.now() - lastRefresh > 60000 || !stickyOn()) { stickySet(); lastRefresh = Date.now(); }
    } else if (stickyOn()) {
      lsSet("dq_admin_logged", "true");
      try { window.__dqAuthed = true; } catch (e) { }
    }
  }
  keepAdmin();
  setInterval(keepAdmin, 500);

  /* açıq çıxış → yapışqanlığı sil */
  D.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button,a,[role=button]") : null;
    if (!b) return;
    var t = (b.textContent || "").replace(/\s+/g, " ").trim();
    if (b.id === "dqad-b3" || /^[^A-Za-zƏəİıÖöÜüŞşÇçĞğ]*(Admin\s+)?[Çç][ıi]x[ıi][şs][ıi]?\s*$/i.test(t) && isAdmin() && !b.closest("#dq-cab")) {
      stickyClear(); lsDel("dq_admin_logged");
      try { window.__dqAuthed = false; } catch (e) { }
    }
  }, true);

  /* goHome / «Paneli bağla» admini çıxarmasın */
  (function () {
    var oc = window.clearSessionStorage;
    if (typeof oc === "function" && !oc.__dqn) {
      window.clearSessionStorage = function () {
        var keep = stickyOn();
        var r = oc.apply(this, arguments);
        if (keep) lsSet("dq_admin_logged", "true");
        return r;
      };
      window.clearSessionStorage.__dqn = 1;
    }
    window.closeAdminPanel = function () { DQNav.home(); };
  })();

  /* ------------------------------------------------------------------
     2) masaüstü rejim (telefonda redaktor / imtahan / admin)
     ------------------------------------------------------------------ */
  function small() {
    try { return (matchMedia("(pointer:coarse)").matches || "ontouchstart" in window) && Math.min(screen.width, screen.height) < 820; } catch (e) { return false; }
  }
  function deskApplied() {
    var m = D.querySelector('meta[name="viewport"]');
    return !!m && /width\s*=\s*1280/.test(m.getAttribute("content") || "");
  }
  function needDesk() {
    var a = D.querySelector(".screen.active"), id = a ? a.id : "";
    return id === "exam-screen" || id === "exam-select-screen" || id === "result-screen" || id === "admin-panel";
  }
  function deskTick() {
    if (!small()) return;
    var need = needDesk();
    D.body && D.body.classList.toggle("dqn-force", need);
    if (!need) return;
    if (!deskApplied()) {
      try { if (window.DQDM && DQDM.on) { DQDM.on(); return; } } catch (e) { }
      var m = D.querySelector('meta[name="viewport"]');
      if (!m) { m = D.createElement("meta"); m.name = "viewport"; D.head.appendChild(m); }
      m.setAttribute("content", "width=1280, user-scalable=yes, maximum-scale=5, viewport-fit=cover");
    }
  }
  setInterval(deskTick, 300);

  /* ------------------------------------------------------------------
     3) üslub
     ------------------------------------------------------------------ */
  function css() {
    if ($("dqn-css")) return;
    var s = D.createElement("style"); s.id = "dqn-css";
    s.textContent =
      "body.dqn-force #dqdm,body.dqn-force #dqdm-t{display:none!important}" +
      ".dqn-bar{position:sticky;top:0;z-index:30;display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px;padding:9px 10px;background:rgba(255,255,255,.96);border:1px solid #dfe5f1;border-radius:12px;box-shadow:0 4px 14px rgba(11,42,107,.12)}" +
      ".dqn-bar button,.dqn-ed button,#dqn-float button{border:0;border-radius:10px;padding:9px 13px;font:800 13px Mulish,system-ui,Arial,sans-serif;cursor:pointer;white-space:nowrap}" +
      ".dqn-b1{background:#64748b;color:#fff}.dqn-b2{background:" + NAVY + ";color:" + GOLD + "}.dqn-b3{background:#fff;color:" + NAVY + ";border:1.5px solid " + NAVY + "!important}" +
      ".dqn-ed{display:inline-flex;gap:8px;flex-wrap:wrap;align-items:center}" +
      "#dqn-float{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:" + Z + ";display:none;gap:8px;padding:8px 10px;border-radius:16px;background:rgba(11,42,107,.94);box-shadow:0 8px 26px rgba(0,0,0,.35);border:1px solid " + GOLD + "}" +
      "#dqn-float button{background:rgba(255,255,255,.14);color:#fff}#dqn-float button.a{background:" + GOLD + ";color:#1b2540}";
    D.head.appendChild(s);
  }
  function btns(cls) {
    return '<button type="button" class="dqn-b1" data-n="back">⬅ Əvvələ</button>' +
      '<button type="button" class="dqn-b2" data-n="admin">🛠 Admin panelə qayıt</button>' +
      '<button type="button" class="dqn-b3" data-n="home">🏠 Əsas səhifə</button>';
  }
  function onBtn(e) {
    var b = e.target.closest ? e.target.closest("button[data-n]") : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var n = b.getAttribute("data-n");
    if (n === "back") DQNav.back(); else if (n === "admin") DQNav.toAdmin(); else if (n === "home") DQNav.home();
  }

  /* ------------------------------------------------------------------
     4) naviqasiya: panel / modul / overlay / redaktor
     ------------------------------------------------------------------ */
  function grid() { return D.querySelector("#admin-panel .admin-nav-grid"); }
  function blocks() { return [].slice.call(D.querySelectorAll("#admin-panel .admin-module-block")); }
  function visibleBlock() {
    var b = blocks().filter(function (x) { return vis(x); });
    return b.length ? b[0] : null;
  }

  function overlayOf() {
    var v2 = $("v2-root"); if (v2 && v2.style.display === "block") return "v2";
    var v3 = $("v3-root"); if (v3 && v3.style.display === "block") return "v3";
    var pp = $("dqpp-ov"); if (pp && pp.style.display === "block") return "papka";
    return "";
  }

  function stepOf() {
    var ids = ["stepExams", "stepCategories", "stepSubjects", "stepEditor"], i;
    for (i = 0; i < ids.length; i++) { var e = $(ids[i]); if (e && vis(e)) return i + 1; }
    return 0;
  }

  function snap() {
    var a = D.querySelector(".screen.active"), s = { scr: a ? a.id : "" };
    var ov = overlayOf();
    if (ov) { s.ov = ov; if (ov === "v2") s.v2 = g("V2") && V2.page; if (ov === "v3") s.v3 = g("V3") && V3.tab; }
    if (s.scr === "admin-panel" && !ov) {
      var b = visibleBlock();
      if (b) {
        s.tab = b.id.replace(/^mod-/, "");
        if (s.tab === "suallar") {
          s.step = stepOf();
          s.se = g("editorSelectedExam"); s.sc = g("editorSelectedCategory"); s.ss = g("editorSelectedSubject");
          var qn = $("questionNumber"); s.sq = qn ? qn.value : "";
        }
      }
    }
    if (s.scr === "exam-screen" && g("isLiveEditMode")) {
      s.ed = { e: g("selectedExamId"), c: g("userGroup"), i: g("currentQuestionIndex") || 0, n: !!g("inlineEditOn") };
    }
    return s;
  }
  function keyOf(s) {
    return JSON.stringify([s.scr, s.ov || "", s.v2 || "", s.v3 || "", s.tab || "", s.step || 0, s.se || "", s.sc || "", s.ss || "", s.ed ? [s.ed.e, s.ed.c] : 0]);
  }

  var hist = [], lastKey = "", suppress = false;
  try { hist = JSON.parse(ssGet(KH) || "[]") || []; } catch (e) { hist = []; }
  function histSave() { ssSet(KH, JSON.stringify(hist.slice(-40))); }

  function track() {
    if (!isAdmin()) return;
    var s = snap(), k = keyOf(s);
    if (s.scr && s.scr !== "exam-screen" || s.ed) lsSet(KS, JSON.stringify(s));
    if (k === lastKey) return;
    if (!suppress && lastKey) hist.push(s); else if (!hist.length) hist.push(s);
    if (suppress) { hist[hist.length - 1] = s; }
    suppress = false;
    lastKey = k;
    histSave();
  }
  /* redaktorda sual № dəyişəndə də saxla */
  setInterval(function () { if (isAdmin()) { var s = snap(); if (s.ed) lsSet(KS, JSON.stringify(s)); } }, 1500);

  /* --- overlayləri bağla --- */
  function closeOverlays() {
    call(function () { if ($("v2-root") && $("v2-root").style.display === "block") V2.close(); });
    call(function () { if ($("v3-root") && $("v3-root").style.display === "block") V3.close(); });
    call(function () { if ($("dqpp-ov") && $("dqpp-ov").style.display === "block") DQPapka.close(); });
    call(function () { window.DQPdfSecim && DQPdfSecim.closePreview && DQPdfSecim.closePreview(); });
    call(function () { var o = $("dqaf-ov"); o && o.remove(); });
    call(function () { var o = $("dqaf-diag"); o && o.remove(); });
    ["tv2-root", "dqpr-root", "dqrt2-root"].forEach(function (id) { var r = $(id); if (r && r.classList.contains("on")) { r.classList.remove("on"); } });
    try { D.body.style.overflow = ""; D.documentElement.style.overflow = ""; } catch (e) { }
  }

  /* --- admin panel (kök) --- */
  function showAdmin() {
    closeOverlays();
    try { if (g("inlineEditOn")) setG("inlineEditOn", false); } catch (e) { }
    try { setG("isLiveEditMode", false); } catch (e) { }
    try { window.PRA && PRA.close && PRA.close(); } catch (e) { }
    call(function () { showScreen("admin-panel"); });
    var p = $("admin-panel");
    if (p && !p.classList.contains("active")) {
      [].forEach.call(D.querySelectorAll(".screen.active"), function (x) { x.classList.remove("active"); });
      p.classList.add("active");
    }
    blocks().forEach(function (b) { b.style.display = "none"; });
    var gr = grid(); if (gr) gr.style.removeProperty("display");
    var pf = D.getElementById("live-edit-panel"); if (pf) pf.style.display = "none";
    call(function () { loadAdminPanelData(); });
    window.scrollTo(0, 0);
    track();
  }

  function openTab(tab, s) {
    if (tab === "proadd") { call(function () { PRA.open(); }); return; }
    call(function () { switchAdminTab(tab); });
    if (tab === "suallar" && s && s.step > 1) {
      call(function () { selectExam(String(s.se)); });
      if (s.step > 2) call(function () { selectCategory(s.sc); });
      if (s.step > 3 && s.ss) {
        call(function () { openEditor(s.ss); });
        if (s.sq) setTimeout(function () { call(function () { var q = $("questionNumber"); if (q) { q.value = s.sq; loadEditorQuestionData(s.sq); } }); }, 500);
      }
    }
  }

  /* --- redaktor --- */
  function openEditorAt(ed) {
    stickySet(); keepAdmin();
    try { window.__dqAuthed = true; window.__dqEditOk = true; } catch (e) { }
    call(function () { window.__dqKillGiris && window.__dqKillGiris(60000); });
    closeOverlays();
    setG("isLiveEditMode", true); setG("currentStudentName", "ADMIN REDAKTOR"); setG("currentActiveFin", "ADMIN");
    var p = $("live-edit-panel"); if (p) p.style.display = "block";
    var ex = $("live-edit-exam"); if (ex) ex.value = ed.e || 1;
    var cs = $("live-edit-category"); if (cs) cs.value = ed.c || "BA";
    var tries = 0;
    return Promise.resolve(call(function () { return startExamSession(String(ed.e || 1), ed.c || "BA"); })).then(function () {
      var t = setInterval(function () {
        tries++;
        var qs = g("allQuestions");
        if (qs && qs.length && $("exam-screen") && $("exam-screen").classList.contains("active")) {
          clearInterval(t);
          if (ed.i > 0 && ed.i < qs.length) call(function () { jumpToQuestion(ed.i); });
          if (ed.n && !g("inlineEditOn")) setTimeout(function () { call(function () { toggleInlineEdit(); }); }, 150);
        } else if (tries > 60) clearInterval(t);
      }, 250);
    });
  }

  function go(s) {
    if (!s) return showAdmin();
    suppress = true;
    if (s.ed) return openEditorAt(s.ed);
    if (s.ov === "v2") { closeOverlays(); call(function () { V2.open(); }); if (s.v2) call(function () { V2.go(s.v2); }); return; }
    if (s.ov === "v3") { closeOverlays(); call(function () { V3.open(); }); if (s.v3) call(function () { V3.setTab(s.v3); }); return; }
    if (s.ov === "papka") { closeOverlays(); call(function () { DQPapka.open(); }); return; }
    if (s.scr === "admin-panel") { showAdmin(); if (s.tab) openTab(s.tab, s); return; }
    closeOverlays();
    if (s.scr && s.scr !== "exam-screen") call(function () { showScreen(s.scr); });
  }

  var DQNav = {
    version: 1,
    openEditor: function (e, c) {
      if (typeof g("startExamSession") !== "function") { alert("Redaktor açıla bilmədi: app.js tam yüklənməyib. Səhifəni yeniləyin."); return; }
      return Promise.resolve(openEditorAt({ e: e || 1, c: c || "BA", i: 0, n: false })).then(function () {
        var t = 0, w = setInterval(function () {
          var ex = $("exam-screen");
          if (ex && ex.classList.contains("active")) { clearInterval(w); try { window.scrollTo(0, 0); } catch (x) { } }
          else if (++t > 40) { clearInterval(w); alert("Redaktor pəncərəsi açılmadı. Sınaq 1 (BA) üçün sual olmaya bilər."); }
        }, 250);
      });
    },
    toAdmin: function () { suppress = true; hist = hist.filter(function (x) { return x.scr === "admin-panel" && !x.tab && !x.ov; }).slice(0, 1); showAdmin(); },
    home: function () {
      closeOverlays();
      try { setG("isLiveEditMode", false); } catch (e) { }
      call(function () { goHome(); });
      keepAdmin();
      hist = []; histSave(); lastKey = "";
    },
    back: function () {
      var cur = keyOf(snap()), prev = null;
      while (hist.length) {
        var x = hist.pop();
        if (keyOf(x) === cur) continue;
        prev = x; break;
      }
      hist.push(prev || snap());
      histSave();
      if (!prev) { var s = snap(); if (s.scr === "admin-panel" && !s.tab && !s.ov) return DQNav.home(); return showAdmin(); }
      /* admin panel kökündən başqa yerə qayıtmaq lazımdırsa */
      go(prev);
    },
    save: track, snap: snap, go: go, isAdmin: isAdmin, restore: restore
  };
  window.DQNav = DQNav;

  /* ------------------------------------------------------------------
     4b) canlı redaktor: sınaq №/kateqoriya dəyişəndə hamar keçid
     ------------------------------------------------------------------ */
  (function smoothSwitch() {
    if (window.__dqSmoothLive) return; window.__dqSmoothLive = true;
    var st = D.createElement("style");
    st.id = "dq-smooth-live-css";
    st.textContent =
      "#single-question-container,#grid-nav-container,#active-exam-title{transition:opacity .16s ease,transform .16s ease,filter .16s ease}" +
      "#single-question-container.dq-out,#grid-nav-container.dq-out{opacity:.25;transform:translateY(6px);filter:blur(1.5px);pointer-events:none}" +
      "#single-question-container.dq-in,#grid-nav-container.dq-in{animation:dqLeIn .42s cubic-bezier(.22,1,.36,1) both}" +
      "#grid-nav-container.dq-in{animation-delay:.05s}" +
      "@keyframes dqLeIn{from{opacity:0;transform:translateY(14px) scale(.992)}to{opacity:1;transform:none}}" +
      "#active-exam-title.dq-in{animation:dqLeTitle .5s ease both}" +
      "@keyframes dqLeTitle{0%{opacity:.2;transform:translateX(-10px)}100%{opacity:1;transform:none}}" +
      "#live-edit-panel.dq-sw-lock select,#live-edit-panel.dq-sw-lock input,#live-edit-panel.dq-sw-lock button{pointer-events:none;opacity:.7}" +
      "#dq-le-chip{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));z-index:100003;transform:translate(-50%,-16px);opacity:0;" +
      "padding:9px 16px;border-radius:999px;background:#0f2d6b;color:#fff;font:700 13px/1.2 system-ui,-apple-system,Arial,sans-serif;" +
      "box-shadow:0 10px 26px -8px #0f2d6b99;pointer-events:none;white-space:nowrap;transition:opacity .3s ease,transform .45s cubic-bezier(.22,1,.36,1)}" +
      "#dq-le-chip.on{opacity:1;transform:translate(-50%,0)}#dq-le-chip.ok{background:#15803d}" +
      "@media(prefers-reduced-motion:reduce){#single-question-container,#grid-nav-container,#active-exam-title,#dq-le-chip{transition:none!important;animation:none!important}}";
    D.head.appendChild(st);

    var chipT = 0;
    function chip(text, ok, ms) {
      var c = $("dq-le-chip");
      if (!c) { c = D.createElement("div"); c.id = "dq-le-chip"; D.body.appendChild(c); }
      c.textContent = text; c.classList.toggle("ok", !!ok);
      requestAnimationFrame(function () { c.classList.add("on"); });
      clearTimeout(chipT);
      if (ms) chipT = setTimeout(function () { c.classList.remove("on"); }, ms);
    }
    function els() { return [$("single-question-container"), $("grid-nav-container")]; }
    function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

    function wrap(name, label) {
      var orig = window[name];
      if (typeof orig !== "function" || orig.__dqSm) return false;
      var w = function () {
        var args = arguments, panel = $("live-edit-panel"), busy = false;
        try { busy = g("isLiveEditMode") === true; } catch (e) { }
        if (!busy) return orig.apply(this, args);
        var ex = String(g("selectedExamId") || ""), cat = String(g("userGroup") || "");
        els().forEach(function (e) { if (e) { e.classList.remove("dq-in"); e.classList.add("dq-out"); } });
        panel && panel.classList.add("dq-sw-lock");
        chip("⏳ " + label(args) + " yüklənir…", false, 0);
        var t0 = Date.now(), res;
        try { res = orig.apply(this, args); } catch (e) { res = Promise.reject(e); }
        return Promise.resolve(res).then(function (r) {
          var wait = Math.max(0, 180 - (Date.now() - t0));   /* fade-out görünsün */
          return new Promise(function (ok) { setTimeout(function () { ok(r); }, wait); });
        }).then(function (r) {
          els().forEach(function (e) { if (e) { e.classList.remove("dq-out"); replay(e, "dq-in"); } });
          replay($("active-exam-title"), "dq-in");
          panel && panel.classList.remove("dq-sw-lock");
          var nex = String(g("selectedExamId") || ""), ncat = String(g("userGroup") || "");
          if (r === false) chip("⚠️ Dəyişiklik alınmadı", false, 2200);
          else chip("✅ Sınaq " + nex + " · " + ncat, true, 1400);
          return r;
        }, function (err) {
          els().forEach(function (e) { e && e.classList.remove("dq-out"); });
          panel && panel.classList.remove("dq-sw-lock");
          chip("⚠️ Yüklənmədi", false, 2500);
          throw err;
        });
      };
      w.__dqSm = true; window[name] = w; return true;
    }
    function install() {
      var a = wrap("changeLiveExam", function (x) { return "Sınaq " + (parseInt(x[0]) || ""); });
      var b = wrap("changeLiveCategory", function (x) { return String(x[0] || "") + " kateqoriyası"; });
      return a || b || (window.changeLiveExam && window.changeLiveExam.__dqSm && window.changeLiveCategory && window.changeLiveCategory.__dqSm);
    }
    if (!install()) { var n = 0, iv = setInterval(function () { if (install() || ++n > 40) clearInterval(iv); }, 500); }
  })();

  /* ------------------------------------------------------------------
     5) yeniləmədən sonra qaldığın yerə qayıt
     ------------------------------------------------------------------ */
  var touched = false, restored = false;
  ["pointerdown", "keydown"].forEach(function (t) { D.addEventListener(t, function () { touched = true; }, true); });
  function restore(force) {
    if (restored && !force) return;
    if (!stickyOn() && !adminFlag()) return;
    var s; try { s = JSON.parse(lsGet(KS) || "null"); } catch (e) { s = null; }
    if (!s) return;
    var cur = snap();
    if (keyOf(cur) === keyOf(s) && !(s.ed)) { restored = true; return; }
    if (s.scr === "exam-screen" && !s.ed) return;
    if (cur.ed && s.ed) { restored = true; return; }
    restored = true;
    keepAdmin();
    go(s);
  }
  function tryRestore(n) {
    if (restored || touched) return;
    var ready = typeof showScreen === "function" && typeof switchAdminTab === "function";
    var ev = D.querySelector(".screen.active");
    if (ready && (n >= 2)) restore();
    else if (n < 12) setTimeout(function () { tryRestore(n + 1); }, 700);
  }
  window.addEventListener("load", function () { setTimeout(function () { tryRestore(0); }, 900); });
  if (D.readyState === "complete") setTimeout(function () { tryRestore(0); }, 900);

  /* ------------------------------------------------------------------
     6) panel çubuğu, redaktor çubuğu, üzən çubuq, «yapışmış» panelin təmiri
     ------------------------------------------------------------------ */
  function ui() {
    css();
    var p = $("admin-panel");
    if (p) {
      var bar = $("dqn-bar");
      if (!bar) {
        bar = D.createElement("div"); bar.id = "dqn-bar"; bar.className = "dqn-bar"; bar.innerHTML = btns();
        bar.addEventListener("click", onBtn);
        var hd = p.querySelector(".nav-header-bar");
        if (hd && hd.nextSibling) hd.parentNode.insertBefore(bar, hd.nextSibling); else p.insertBefore(bar, p.firstChild);
      }
      var onPanel = p.classList.contains("active"), vb = visibleBlock();
      bar.style.display = (onPanel && vb) ? "flex" : "none";

      /* şəkildəki vəziyyət: panel açıqdır, nə grid var, nə modul */
      if (onPanel && !vb && !overlayOf()) {
        var gr = grid();
        if (gr && getComputedStyle(gr).display === "none") gr.style.removeProperty("display");
        if (gr && getComputedStyle(gr).display === "none") gr.style.setProperty("display", "block", "important");
      }
    }
    var lp = $("live-edit-panel");
    if (lp && !lp.querySelector(".dqn-ed")) {
      var holder = lp.querySelector("div > div:last-child") || lp;
      var w = D.createElement("div"); w.className = "dqn-ed"; w.innerHTML = btns();
      w.addEventListener("click", onBtn);
      var first = lp.firstElementChild;
      if (first && first.firstElementChild) first.firstElementChild.appendChild(w); else lp.appendChild(w);
      var old = $("dq-go-admin"); if (old) old.style.display = "none";
    }
    var fl = $("dqn-float");
    if (!fl) {
      fl = D.createElement("div"); fl.id = "dqn-float";
      fl.innerHTML = '<button type="button" data-n="back">⬅ Geri</button><button type="button" class="a" data-n="admin">🛠 Admin panelə qayıt</button><button type="button" data-n="home">🏠 Əsas səhifə</button>';
      fl.addEventListener("click", onBtn);
      D.body.appendChild(fl);
    }
    fl.style.display = (overlayOf() && isAdmin()) ? "flex" : "none";
  }
  window.dqGoAdmin = function () { DQNav.toAdmin(); };
  setInterval(function () { try { ui(); track(); } catch (e) { } }, 500);

  /* ------------------------------------------------------------------
     7) açıq sual: inline redaktorda «Düzgün açıq cavab» xanası həmişə olsun
     ------------------------------------------------------------------ */
  (function () {
    var o = window.applyInlineEdit;
    if (typeof o !== "function" || o.__dqn) return;
    window.applyInlineEdit = function (q, qNum, isOpen) {
      var r = o.apply(this, arguments);
      try {
        if (isOpen && !$("ie-open-correct")) {
          var c = $("single-question-container"), bar = c && c.querySelector(".ie-bar");
          var d = D.createElement("div"); d.className = "form-group";
          d.innerHTML = '<label style="font-weight:bold;font-size:14px;">✅ Düzgün açıq cavab (əl ilə yazın):</label>' +
            '<input type="text" id="ie-open-correct" class="form-control" style="max-width:300px;text-transform:uppercase;" value="' + String(q && q.correct != null ? q.correct : "").replace(/"/g, "&quot;") + '">';
          if (bar) bar.parentNode.insertBefore(d, bar); else if (c) c.appendChild(d);
        }
      } catch (e) { }
      return r;
    };
    window.applyInlineEdit.__dqn = 1;
  })();
})();
