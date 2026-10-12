/* =====================================================================
   DQ Gate v2 (dq-gate.js?v=5) — "bir dəfəyə, tam hazır açılış"
   ---------------------------------------------------------------------
   Problem: açılış ekranı (splash) bağlanırdı, amma qeydiyyat paneli,
   imtahan kartı, geri sayım, statistika kartları və menyu sonradan,
   hissə-hissə gəlirdi → yarımçıq səhifəyə keçid + "tullanma".

   Həll: splash yalnız səhifə REAL hazır olanda açılır. Şərtlər:
     1) Ana səhifənin əsas məzmunu (hero + footer) çəkilib
     2) Ilkin sorğular (__dqPre*) bitib
     3) Şriftlər + Font Awesome ikonları hazırdır
     4) document.readyState === "complete"
     5) ŞƏBƏKƏ SAKİTDİR: Supabase /rest/v1 sorğularının heç biri
        yolda deyil və sonuncu cavabdan NET ms keçib
        (geri sayım, statistika, qeydiyyat paneli, imtahan kartı —
        hamısı öz sorğularını bitirib və yerinə düşüb)
     6) Görünən şəkillər yüklənib
     7) DOM + hündürlük QUIET ms dəyişməyib, ilk render-dən MIN ms keçib
   Əlavə: tab gizlidirsə (arxa fon) vaxt sayılmır — səhifə görünəndə
   yarımçıq açılmır. CAP ms aktiv görünən vaxtdan sonra nə olursa-olsun açılır.

   Qoşulma (dəyişməyib): dq-boot-dan SONRA, app.js-dən ƏVVƏL.
   Fərdi ayar (istəsəniz, bu skriptdən əvvəl):
     <script>window.DQ_GATE={cap:9000,min:1200,quiet:800,net:900}</script>
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqLoadGate) return;
  window.__dqLoadGate = 5;

  var D = document, H = D.documentElement, T0 = performance.now();
  var CFG = window.DQ_GATE || {};
  var seen = false;
  try { seen = sessionStorage.getItem("dq_gate_seen") === "1"; } catch (e) { }

  window.__dqGateStage = { render: false, data: false, fonts: false, load: false, blocks: false, net: false };
  var CAP = CFG.cap || 30000;                                        /* aktiv (görünən) vaxtla mütləq maksimum */
  var MIN = CFG.min != null ? CFG.min : (seen ? 600 : 1200);        /* ilk render-dən sonra minimum */
  var QUIET = CFG.quiet != null ? CFG.quiet : (seen ? 600 : 800);   /* DOM dəyişməsiz müddət */
  var NETQ = CFG.net != null ? CFG.net : 900;                       /* son şəbəkə cavabından sonra gözləmə
                                                                       (modulların 800ms-lik yerləşdirmə dövrünü əhatə edir) */

  var holding = true, timer = 0, resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });

  H.classList.add("dq-hold");

  var st = D.createElement("style");
  st.id = "dq-gate-css";
  st.textContent = "html.dq-hold .dql-in{animation:none!important;opacity:1!important;transform:none!important}";
  (D.head || H).appendChild(st);

  /* ---- aktiv (görünən) vaxt saatı: gizli tabda CAP sayılmır ---- */
  var active = 0, lastClock = performance.now();
  function clock() {
    var n = performance.now();
    if (!D.hidden) active += n - lastClock;
    lastClock = n;
    return active;
  }

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

  /* ---- 3) Şəbəkə qatı: təkrarlanan sorğuların birləşdirilməsi + qısa keş + izləmə ----
     Problem: ana səhifə yüklənərkən eyni kolleksiya 4-8 dəfə sorğulanırdı (liveexams, homestats, v3cfg …).
     Bu həm yavaşladır, həm də bloklar növbə ilə gəlib "tullanma" yaradırdı.
       • eyni vaxtda gedən eyni GET sorğusu → bir sorğu, hamıya klon cavab
       • konfiqurasiya kolleksiyaları (CACHE_COLS) → 6 san keş
       • istənilən yazma (POST/PATCH/PUT/DELETE) → bütün keş və yoldakı sorğular təmizlənir (köhnə məlumat qalmır)
     Gate yükləmə mərhələsindəki bütün sorğuları gözləyir; təkrar gələn (polling) sorğular arxa fon sayılır. */
  var CACHE_COLS = /collection=eq\.(liveexams|homestats|v3cfg|hzcfg|site_texts|types|covers|lawcfg|lxcfg|tmcfg|sitecms|krs_catalogue|settings|prices|dtview|v3tests|templates|news|wachan|countdown|lxnews)(&|$)/;
  var CACHE_TTL = 6000;
  var inflight = 0, netCount = 0, lastNetEnd = performance.now();
  var pend = {}, cache = {}, seenUrl = {};
  /* yükləmə mərhələsinin sorğuları izlənir; eyni URL 5-ci dəfə gələndə (dövri yoxlama/polling) arxa fon sayılır */
  function trackable(url) {
    if (!holding) return false;
    var n = seenUrl[url] = (seenUrl[url] || 0) + 1;
    return n <= 4;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function urlOf(u) {
    try { return typeof u === "string" ? u : (u && u.href) || ""; } catch (e) { return ""; }
  }
  function isRest(u) { return u.indexOf("/rest/v1/") > -1; }
  function hdr(init, n) {
    try {
      var h = init && init.headers; if (!h) return "";
      if (typeof h.get === "function") return h.get(n) || "";
      for (var k in h) if (k.toLowerCase() === n) return String(h[k]);
    } catch (e) { }
    return "";
  }
  try {
    var of = window.fetch;
    if (of && !of.__dqg) {
      var nf = function (input, init) {
        var self = this, args = arguments, url = urlOf(input);
        if (!url || !isRest(url)) return of.apply(self, args);       /* Request obyekti / başqa sorğular: toxunmuruq */
        var method = ((init && init.method) || "GET").toUpperCase();

        if (method !== "GET" && method !== "HEAD") {                 /* yazma: keşi təmizlə */
          pend = {}; cache = {};
          return of.apply(self, args);
        }
        if (method === "HEAD") {                                     /* say sorğuları (count): dedupe yox, yalnız izləmə */
          if (!trackable(url)) return of.apply(self, args);
          inflight++; netCount++;
          var hp = of.apply(self, args);
          var hf = function () { inflight = Math.max(0, inflight - 1); lastNetEnd = performance.now(); };
          hp.then(hf, hf);
          return hp;
        }
        if (init && init.signal) return of.apply(self, args);

        var crit = trackable(url), t0 = performance.now();
        function track(p) {
          if (!crit) return p;
          inflight++; netCount++;
          var fin = function () { inflight = Math.max(0, inflight - 1); lastNetEnd = performance.now(); };
          p.then(fin, fin);
          return p;
        }
        var key = url + "|" + hdr(init, "authorization") + "|" + hdr(init, "prefer") + "|" + hdr(init, "range");

        var c = cache[key];
        if (c && t0 - c.t < CACHE_TTL) return Promise.resolve(c.m.clone());
        if (pend[key]) return track(pend[key].then(function (m) { return m.clone(); }));

        var gen = pend;                                              /* yazmadan sonra köhnə sorğu keşə düşməsin */
        /* uğursuz (şəbəkə xətası / 5xx) oxuma sorğuları 2 dəfə təkrarlanır */
        function attempt(n) {
          return of.apply(self, args).then(function (r) {
            if (r.status >= 500 && n < 2) return wait(400 * (n + 1)).then(function () { return attempt(n + 1); });
            return r;
          }, function (e) {
            if (n < 2) return wait(400 * (n + 1)).then(function () { return attempt(n + 1); });
            throw e;
          });
        }
        var pf = window.__dqPF && window.__dqPF[url];                /* head-də əvvəlcədən başlayan sorğu */
        var src = pf ? (function () { delete window.__dqPF[url]; return pf.then(function (r) { return r.ok ? r : attempt(0); }, function () { return attempt(0); }); })() : attempt(0);
        var real = src.then(function (r) {
          if (gen === pend) {
            delete pend[key];
            if (r.ok && CACHE_COLS.test(url)) cache[key] = { t: performance.now(), m: r };
          }
          return r;
        }, function (e) { if (gen === pend) delete pend[key]; throw e; });
        pend[key] = real;
        return track(real.then(function (m) { return m.clone(); }));
      };
      nf.__dqg = 1;
      window.fetch = nf;
    }
  } catch (e) { }
  /* ehtiyat: fetch-i bizdən əvvəl tutan kitabxana olsa da, tamamlanmış sorğuları görək */
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (en) {
        if (isRest(en.name)) { netCount++; if (en.responseEnd > lastNetEnd) lastNetEnd = en.responseEnd; }
      });
    }).observe({ type: "resource", buffered: true });
  } catch (e) { }

  /* ---- 3b) HOME.build izləmə: ana səhifə qurulması (geri sayım, imtahan kartı, sıralama) bitməyənə qədər açmırıq ---- */
  var builds = { run: 0, done: 0, started: 0, lastEnd: 0, hooked: false };
  function hookBuild() {
    try {
      var Hm = window.HOME;
      if (!Hm || typeof Hm.build !== "function" || Hm.build.__dqg) return;
      var ob = Hm.build;
      var nb = function () {
        builds.run++; builds.started++;
        var p;
        try { p = ob.apply(this, arguments); } catch (e) { builds.run = Math.max(0, builds.run - 1); throw e; }
        var fin = function () { builds.run = Math.max(0, builds.run - 1); builds.done++; builds.lastEnd = performance.now(); };
        Promise.resolve(p).then(fin, fin);
        return p;
      };
      nb.__dqg = 1;
      Hm.build = nb;
      builds.hooked = true;
    } catch (e) { }
  }

  /* ---- 4) Məlumat + şrift hazırlığı ---- */
  var dataOk = false, fontsOk = false;

  function settle(p) { return Promise.resolve(p).then(function () { }, function () { }); }
  (function () {
    var list = [window.__dqPre, window.__dqPreT, window.__dqPreN1].filter(Boolean).map(settle);
    var to = new Promise(function (r) { setTimeout(r, Math.min(20000, CAP - 1000)); });
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

  /* ---- 5) Ana səhifə vəziyyəti ---- */
  var tRender = 0, lastSig = "", tChange = performance.now();

  function realRender(h) {
    if (!h) return false;
    if (h.querySelector(".v3-hd")) return true;
    return h.children.length > 0 && h.textContent.indexOf("yüklənir") === -1;
  }
  function sig(h) {
    return h.getElementsByTagName("*").length + "|" + h.scrollHeight + "|" + h.textContent.length;
  }
  function imgsReady(h) {
    var l = h.getElementsByTagName("img");
    for (var i = 0; i < l.length; i++) {
      var im = l[i], s = im.getAttribute("src");
      if (!s || s.indexOf("data:") === 0 || im.loading === "lazy") continue;
      if (!im.complete) return false;
    }
    return true;
  }

  function release(reason) {
    if (!holding) return;
    holding = false;
    clearTimeout(timer);
    try { guard && guard.disconnect(); } catch (e) { }
    try { sessionStorage.setItem("dq_gate_seen", "1"); } catch (e) { }
    window.__dqGateLog = { reason: reason, ms: Math.round(performance.now() - T0), net: netCount };
    try { console.info("[dq-gate] hazır:", reason, window.__dqGateLog.ms + "ms", "sorğu:", netCount); } catch (e) { }

    /* faiz 100%-ə dolur → "Xoş gəlmisiniz!" → yalnız sonra yumşaq keçid */
    var sp = D.getElementById("dq-splash"), opened = false;
    function open() {
      if (opened) return;
      opened = true;
      H.classList.remove("dq-hold");
      /* iki kadr gözlə: brauzer tam səhifəni çəkib bitirsin, sonra splash solsun */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (sp) sp.classList.add("off");
          resolveReady();
        });
      });
      setTimeout(function () { if (sp) sp.classList.add("off"); resolveReady(); }, 400); /* rAF dayansa */
      /* təhlükəsizlik: giriş animasiyası ilişib qalsa, gizli qalan blok olmasın */
      [1500, 3500].forEach(function (ms) {
        setTimeout(function () {
          try {
            var h = D.getElementById("v3-home"); if (!h) return;
            for (var i = 0; i < h.children.length; i++) {
              var k = h.children[i];
              if (k.classList.contains("dq-rv") && !k.classList.contains("in")) k.classList.add("in");
            }
          } catch (e) { }
        }, ms);
      });
    }
    if (sp && window.DQSplash && D.visibilityState !== "hidden") {
      window.DQSplash.complete(open);
      setTimeout(open, 2200);
    } else open();
  }

  function tick() {
    if (!holding) return;
    var act = clock();
    if (act >= CAP) return release("cap");
    if (D.hidden) return;                       /* tab gizlidir: gözləyirik, səhifə yarımçıq açılmasın */

    var now = performance.now();
    var h = D.getElementById("v3-home");
    if (!h) return;
    var s = sig(h);
    if (s !== lastSig) { lastSig = s; tChange = now; }

    var stg = window.__dqGateStage;
    if (D.readyState === "complete") stg.load = true;
    if (!realRender(h)) return;
    stg.render = true;
    if (!tRender) tRender = now;

    /* əsas bloklar */
    var core = !!h.querySelector(".v3-ft") && !!h.querySelector(".v3-hero");

    /* şəbəkə sakitliyi: yolda sorğu yoxdur + son cavabdan NETQ keçib.
       Heç sorğu getməyibsə (hamısı keşdən), modulların yerləşməsi üçün 1.6 san gözlə */
    var netIdle = inflight === 0 && now - lastNetEnd >= NETQ &&
      (netCount > 0 || now - tRender >= 1600);
    stg.net = netIdle;

    /* şəkillər (ən çox 4 san gözləyirik) */
    var imgs = imgsReady(h) || now - tRender > 4000;

    /* ana səhifə qurulub bitib: son build-dən 1.9 san sonra (HOME.order 700/1800ms yenidən düzür).
       6 san ərzində heç build başlamayıbsa bu şərt ləğv olunur */
    hookBuild();
    var buildOk = !builds.hooked ||
      (builds.run === 0 && builds.done >= 1 && now - builds.lastEnd >= 1900) ||
      (builds.started === 0 && now - tRender >= 6000);
    stg.build = buildOk;

    var blocksOk = core && netIdle && imgs && buildOk;
    stg.blocks = blocksOk;
    if (dataOk && fontsOk && blocksOk &&
      D.readyState === "complete" &&
      now - tRender >= MIN &&
      now - tChange >= QUIET) release("hazır");
  }

  function loop() {
    if (!holding) return;
    try { tick(); } catch (e) { }
    timer = setTimeout(loop, 100);              /* setTimeout: setInterval-dan fərqli olaraq performans filtrindən təsirlənmir */
  }
  loop();
  D.addEventListener("visibilitychange", function () {
    lastClock = performance.now();
    if (!D.hidden) { tChange = performance.now(); lastNetEnd = Math.max(lastNetEnd, performance.now() - NETQ + 300); }
  });

  window.DQGate = {
    release: function () { release("manual"); },
    holding: function () { return holding; },
    ready: ready
  };
})();
