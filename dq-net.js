/* =====================================================================
   DQ NET v1.0 — Supabase REST sorğuları üçün təhlükəsiz təkrar cəhd qatı
   ---------------------------------------------------------------------
   • Müvəqqəti şəbəkə xətası / 429 / 5xx zamanı sorğunu avtomatik təkrarlayır
     (iPhone Safari, mobil internet, Wi-Fi ↔ 4G keçidi).
   • YALNIZ təkrarlana bilən (idempotent) metodlar: GET, HEAD, PUT, PATCH, DELETE.
     POST (yeni qeyd əlavə etmə) heç vaxt kor-koranə təkrarlanmır — dublikat olmasın.
     POST-un təhlükəsiz təkrarı dq-core.js-də (_cid yoxlaması ilə) edilir.
   • Supabase CDN skriptindən ƏVVƏL qoşulmalıdır: klient fetch-i yaradılan anda tutur.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqNet) return;
  var nf = window.fetch;
  if (typeof nf !== "function") return;
  window.__dqNet = 1;

  var HOST = "cpzwliqlgaplroscvduo.supabase.co";
  var RETRY_ST = { 408: 1, 425: 1, 429: 1, 500: 1, 502: 1, 503: 1, 504: 1 };
  var IDEMP = { GET: 1, HEAD: 1, PUT: 1, PATCH: 1, DELETE: 1 };
  var DELAYS = [400, 1200, 2600];
  var st = { bad: 0, good: 0 }, subs = [];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function mark(ok) {
    var was = st.bad >= 2;
    if (ok) { st.bad = 0; st.good++; } else { st.bad++; }
    var now = st.bad >= 2;
    if (was !== now) {
      subs.slice().forEach(function (f) { try { f(now ? "degraded" : "ok"); } catch (e) {} });
    }
  }

  function urlOf(input) {
    try {
      if (typeof input === "string") return input;
      if (typeof Request !== "undefined" && input instanceof Request) return "";
      return input ? String(input) : "";
    } catch (e) { return ""; }
  }

  /* ---------- v2: eyni sorğuların birləşdirilməsi + qısa keş + timeout ----------
     • Ana səhifə açılanda onlarla modul eyni cədvəli (liveexams, countdown, regs…) ayrı-ayrı çəkirdi.
       İndi eyni anda gedən eyni GET/HEAD sorğusu BİR dəfə göndərilir, nəticə hər istehlakçıya
       ayrıca (təzə nüsxə kimi) verilir.
     • Cavab TTL müddətinə (6 san) yadda saxlanır; istənilən yazma (POST/PUT/PATCH/DELETE) keşi təmizləyir.
     • Cavab verməyən (asılı qalan) oxu sorğusu 25 san-dən sonra kəsilib təkrar cəhd edilir. */
  var TTL = 6000, MAXE = 60, MAXB = 3 * 1024 * 1024, TMO = 25000;
  var cache = {}, order = [], flight = {};
  function hdrKey(h) {
    try {
      if (!h) return "";
      var o = [];
      if (typeof Headers !== "undefined" && h instanceof Headers) { h.forEach(function (v, k) { o.push(k + "=" + v); }); }
      else if (Array.isArray(h)) { h.forEach(function (p) { o.push(String(p[0]).toLowerCase() + "=" + p[1]); }); }
      else { Object.keys(h).forEach(function (k) { o.push(k.toLowerCase() + "=" + h[k]); }); }
      return o.sort().join("&");
    } catch (e) { return ""; }
  }
  function mkRes(c, method) {
    return new Response(method === "HEAD" ? null : c.buf.slice(0), { status: c.status, statusText: c.text, headers: c.hdrs });
  }
  function put(key, res, method) {
    if (!(res.status === 200 || res.status === 206)) return Promise.resolve();
    var hdrs = []; res.headers.forEach(function (v, k) { hdrs.push([k, v]); });
    var done = method === "HEAD" ? Promise.resolve(null) : res.clone().arrayBuffer();
    return done.then(function (buf) {
      if (buf && buf.byteLength > MAXB) return;
      cache[key] = { t: Date.now(), buf: buf, status: res.status, text: res.statusText, hdrs: hdrs };
      order.push(key);
      while (order.length > MAXE) { delete cache[order.shift()]; }
    }, function () {});
  }
  function clearAll() { cache = {}; order = []; }

  window.fetch = function (input, init) {
    var url = urlOf(input);
    if (!url || url.indexOf(HOST) < 0 || url.indexOf("/rest/v1/") < 0) {
      return nf.apply(window, arguments);
    }
    var method = String((init && init.method) || "GET").toUpperCase();
    var canRetry = !!IDEMP[method];
    var isRead = method === "GET" || method === "HEAD";
    if (!isRead) clearAll();                       /* yazma → oxu keşi köhnəlir */
    var args = arguments, n = 0;

    var key = null;
    if (isRead && !(init && init.signal)) {
      key = method + " " + url + " " + hdrKey(init && init.headers);
      var hit = cache[key];
      if (hit && Date.now() - hit.t < TTL) return Promise.resolve(mkRes(hit, method));
      if (flight[key]) {
        return flight[key].then(function () {
          var c = cache[key];
          return c ? mkRes(c, method) : nf.apply(window, args);   /* keşə düşməyibsə (xəta) → özü göndərsin */
        });
      }
    }

    function attempt() {
      var ctrl = null, timer = null, timedOut = false, ai = args;
      if (isRead && !(init && init.signal) && typeof AbortController !== "undefined") {
        ctrl = new AbortController();
        timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, TMO);
        var i2 = {}; for (var k in init) i2[k] = init[k]; i2.signal = ctrl.signal;
        ai = [input, i2];
      }
      return nf.apply(window, ai).then(function (res) {
        if (timer) clearTimeout(timer);
        if (canRetry && RETRY_ST[res.status] && n < DELAYS.length) {
          var d = DELAYS[n++], ra = +res.headers.get("retry-after");
          if (ra > 0 && ra <= 5) d = Math.max(d, ra * 1000);
          return sleep(d + Math.random() * 250).then(attempt);
        }
        mark(res.status < 500 && res.status !== 429);
        return res;
      }, function (err) {
        if (timer) clearTimeout(timer);
        var aborted = !timedOut && ((err && err.name === "AbortError") || (init && init.signal && init.signal.aborted));
        if (!aborted && canRetry && n < DELAYS.length) {
          var d = DELAYS[n++];
          return sleep(d + Math.random() * 250).then(attempt);
        }
        if (!aborted) mark(false);
        throw err;
      });
    }

    if (!key) return attempt();
    var p = attempt().then(function (res) {
      return put(key, res, method).then(function () { return res; });
    });
    flight[key] = p.then(function () {}, function () {});
    flight[key].then(function () { delete flight[key]; });
    return p;
  };

  window.DQNet = {
    status: function () { return st.bad >= 2 ? "degraded" : "ok"; },
    onChange: function (f) { if (typeof f === "function") subs.push(f); }
  };
})();
