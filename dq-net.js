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

  window.fetch = function (input, init) {
    var url = urlOf(input);
    if (!url || url.indexOf(HOST) < 0 || url.indexOf("/rest/v1/") < 0) {
      return nf.apply(window, arguments);
    }
    var method = String((init && init.method) || "GET").toUpperCase();
    var canRetry = !!IDEMP[method];
    var args = arguments, n = 0;

    function attempt() {
      return nf.apply(window, args).then(function (res) {
        if (canRetry && RETRY_ST[res.status] && n < DELAYS.length) {
          var d = DELAYS[n++], ra = +res.headers.get("retry-after");
          if (ra > 0 && ra <= 5) d = Math.max(d, ra * 1000);
          return sleep(d + Math.random() * 250).then(attempt);
        }
        mark(res.status < 500 && res.status !== 429);
        return res;
      }, function (err) {
        var aborted = (err && err.name === "AbortError") || (init && init.signal && init.signal.aborted);
        if (!aborted && canRetry && n < DELAYS.length) {
          var d = DELAYS[n++];
          return sleep(d + Math.random() * 250).then(attempt);
        }
        if (!aborted) mark(false);
        throw err;
      });
    }
    return attempt();
  };

  window.DQNet = {
    status: function () { return st.bad >= 2 ? "degraded" : "ok"; },
    onChange: function (f) { if (typeof f === "function") subs.push(f); }
  };
})();
