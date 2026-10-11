/* =====================================================================
   DQ Gate v1.0 — "bir dəfəyə, səliqəli açılış"
   ---------------------------------------------------------------------
   Problem: splash 2.4 san-dən sonra bağlanırdı, amma bloklar (qeydiyyat
   paneli, günün testi, imtahan kartı, geri sayım, statistika, ikonlar,
   şriftlər) sonradan hissə-hissə gəlirdi → "dona-dona" yüklənmə.

   Həll: splash əsl hazır olana qədər saxlanır. Hazırlıq şərtləri:
     1) Ana səhifənin real məzmunu çəkilib (placeholder getməyib)
     2) Supabase ilkin sorğuları (__dqPre*) bitib (və ya vaxtı keçib)
     3) Şriftlər + Font Awesome ikonları yüklənib
     4) Səhifə yüklənib (document.readyState === "complete")
     5) DOM + hündürlük "sakitləşib" (QUIET ms dəyişməyib)
        və ilk render-dən MIN ms keçib (HOME.order 700/1800ms yenidən
        düzür — bu da splash-ın arxasında baş verir)
   Təhlükəsizlik: CAP ms-dən sonra nə olursa-olsun açılır.

   Qoşulma: dq-boot skriptindən dərhal SONRA, app.js-dən ƏVVƏL.
   Fərdi ayar (istəsəniz, bu skriptdən əvvəl):
     <script>window.DQ_GATE={cap:7000,min:1900,quiet:900}</script>
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqGate) return;
  window.__dqGate = 1;

  var D = document, H = D.documentElement, T0 = performance.now();
  var CFG = window.DQ_GATE || {};
  var seen = false;
  try { seen = sessionStorage.getItem("dq_gate_seen") === "1"; } catch (e) { }

  window.__dqGateStage = { render: false, data: false, fonts: false, load: false, blocks: false };
  var CAP = CFG.cap || 7000;                                   /* mütləq maksimum gözləmə */
  var MIN = CFG.min != null ? CFG.min : (seen ? 400 : 1200);   /* ilk render-dən sonra minimum */
  var QUIET = CFG.quiet != null ? CFG.quiet : (seen ? 450 : 900); /* dəyişməsiz müddət */

  var holding = true, timer = 0, resolveReady, why = "";
  var ready = new Promise(function (r) { resolveReady = r; });

  H.classList.add("dq-hold");

  /* splash-ın arxasında gedən giriş animasiyaları görünməsin deyə söndürürük */
  var st = D.createElement("style");
  st.id = "dq-gate-css";
  st.textContent = "html.dq-hold .dql-in{animation:none!important;opacity:1!important;transform:none!important}";
  (D.head || H).appendChild(st);

  /* ---- 1) Başqa kod splash-a "off" qoysa, hazır olana qədər geri götür ---- */
  var guard = null;
  try {
    guard = new MutationObserver(function (rs) {
      if (!holding) return;
      for (var i = 0; i < rs.length; i++) {
        var t = rs[i].target;
        if (t && t.id === "dq-splash" && t.classList.contains("off")) t.classList.remove("off");
      }
    });
    guard.observe(H, { subtree: true, attributes: true, attributeFilter: ["class"] });
  } catch (e) { }

  /* ---- 2) app.js DQBOOT.gate() çağırırsa, bizim gate-i qaytar ---- */
  function hook() {
    try { if (window.DQBOOT) window.DQBOOT.gate = function () { return ready; }; } catch (e) { }
  }
  hook();
  D.addEventListener("DOMContentLoaded", hook);

  /* ---- 3) Məlumat hazırlığı ---- */
  var dataOk = false, fontsOk = false;

  function settle(p) { return Promise.resolve(p).then(function () { }, function () { }); }
  (function () {
    var list = [window.__dqPre, window.__dqPreT, window.__dqPreN1].filter(Boolean).map(settle);
    var to = new Promise(function (r) { setTimeout(r, Math.min(4500, CAP - 500)); });
    Promise.race([Promise.all(list), to]).then(function () { dataOk = true; window.__dqGateStage.data = true; });
  })();

  function faReady() {
    return new Promise(function (ok) {
      var n = 0;
      (function p() {
        var l = D.querySelector('link[href*="font-awesome"]');
        if (l && l.rel === "stylesheet" && D.fonts && D.fonts.load) {
          Promise.all([
            D.fonts.load('900 16px "Font Awesome 6 Free"'),
            D.fonts.load('400 16px "Font Awesome 6 Brands"')
          ]).then(ok, ok);
        } else if (++n > 30) ok();
        else setTimeout(p, 100);
      })();
    });
  }
  (function () {
    var f = D.fonts && D.fonts.ready ? D.fonts.ready : Promise.resolve();
    var to = new Promise(function (r) { setTimeout(r, 3000); });
    Promise.race([Promise.all([settle(f), faReady()]), to]).then(function () { fontsOk = true; window.__dqGateStage.fonts = true; });
  })();

  /* ---- 4) Ana səhifə vəziyyəti ---- */
  var tRender = 0, lastSig = "", tChange = performance.now();

  function realRender(h) {
    if (!h) return false;
    if (h.querySelector(".v3-hd")) return true;
    return h.children.length > 0 && h.textContent.indexOf("yüklənir") === -1;
  }
  function sig(h) {
    return h.getElementsByTagName("*").length + "|" + h.scrollHeight + "|" + h.textContent.length;
  }

  function release(reason) {
    if (!holding) return;
    holding = false;
    why = reason;
    clearInterval(timer);
    try { guard && guard.disconnect(); } catch (e) { }
    try { sessionStorage.setItem("dq_gate_seen", "1"); } catch (e) { }
    window.__dqGateLog = { reason: reason, ms: Math.round(performance.now() - T0) };
    try { console.info("[dq-gate] hazır:", reason, window.__dqGateLog.ms + "ms"); } catch (e) { }

    /* Hazır olduqda: faiz 100%-ə dolur → "Xoş gəlmisiniz!" → yalnız sonra ana səhifəyə yumşaq keçid */
    var sp = D.getElementById("dq-splash"), opened = false;
    function open() {
      if (opened) return;
      opened = true;
      H.classList.remove("dq-hold");
      if (sp) sp.classList.add("off");          /* splash yumşaq solur (.6s) */
      resolveReady();
    }
    if (sp && window.DQSplash && D.visibilityState !== "hidden") {
      window.DQSplash.complete(open);
      setTimeout(open, 2200);                   /* təhlükəsizlik: heç vaxt ilişib qalmasın */
    } else open();
  }

  function tick() {
    if (!holding) return;
    var now = performance.now();
    if (now - T0 >= CAP) return release("cap");

    var h = D.getElementById("v3-home");
    if (!h) return;
    var s = sig(h);
    if (s !== lastSig) { lastSig = s; tChange = now; }

    var stg = window.__dqGateStage;
    if (D.readyState === "complete") stg.load = true;
    if (!realRender(h)) return;
    stg.render = true;
    if (!tRender) tRender = now;

    /* Statistika kartları və footer də yerində olmalıdır (admin statistikanı gizlədibsə, 4.5 san-dən sonra gözləmirik) */
    var blocksOk = !!h.querySelector(".v3-ft") && (!!D.getElementById("dq-stats") || now - T0 > 4500);
    if (blocksOk) stg.blocks = true;

    if (dataOk && fontsOk && blocksOk &&
      D.readyState === "complete" &&
      now - tRender >= MIN &&
      now - tChange >= QUIET) release("hazır");
  }

  timer = setInterval(tick, 100);

  window.DQGate = {
    release: function () { release("manual"); },
    holding: function () { return holding; },
    ready: ready
  };
})();
