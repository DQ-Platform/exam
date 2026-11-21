/*!
 * DQ Platform — Mərkəzi baza qatı (dq-db.js)
 * ----------------------------------------------------------------
 * Bütün panellər bazaya YALNIZ bu fayl vasitəsilə qoşulur:
 *   • tək Supabase müştərisi (hər səhifədə təkrar açar/URL yoxdur)
 *   • DQ.read()    — keş + eyni sorğunun təkrarının birləşdirilməsi (dedupe) + stale-while-revalidate
 *   • DQ.write()   — yazı + avtomatik keş ləğvi + digər tablara/pəncərələrə xəbər
 *   • DQ.upsertMany() — böyük siyahıları hissə-hissə göndərir
 *   • DQ.watch()   — canlı yenilənmə (yalnız dəyişəndə callback; tab gizli olanda dayanır)
 *   • DQ.esc()     — HTML-ə yazılan mətnləri təhlükəsiz edir (XSS-dən qoruma)
 *   • DQ.status()  — "online | offline | degraded" + kiçik status göstəricisi (DQ.mountStatus)
 *
 * Yüklənmə sırası (hər panelin <head> hissəsində):
 *   dq-firebase.js → dq-net.js → supabase-js (UMD) → dq-db.js
 * Köhnə panel kodu üçün: const _supabase = DQ.client;
 */
(function () {
  "use strict";
  if (window.__dqDbLoaded) return;
  window.__dqDbLoaded = true;

  var CFG = window.DQ_CONFIG || {
    url: "https://cpzwliqlgaplroscvduo.supabase.co",
    key: "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF" // publishable (anon) açar — gizli deyil, təhlükəsizlik RLS ilə təmin olunur
  };

  var BUDGET = 3000;             // istifadəçinin gözləmə həddi (ms) — bundan sonra keş/yüklənir-mesajı göstərilir
  var TTL_DEFAULT = 15000;       // keşin ömrü (ms)
  var SWR_MAX = 10 * 60 * 1000;  // köhnə keş bundan yaşlıdırsa istifadə olunmur
  var LS_PREFIX = "dqdb:";
  var LS_MAX_BYTES = 200000;     // bir keş qeydi üçün localStorage limiti

  var mem = {};                  // key -> {t, v}
  var inflight = {};             // key -> Promise
  var listeners = {};            // event -> [fn]
  var bc = null;

  /* ---------------------------------------------------------- client */
  function makeClient() {
    if (!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(CFG.url, CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { headers: { "x-client-info": "dq-platform-web" } }
    });
  }
  var client = makeClient();
  function afterWrite(t) { invalidate(t); emit("change", { table: t }); try { bc && bc.postMessage({ table: t }); } catch (e) { } }
  if (client) {
    var rawFrom = client.from.bind(client);
    client.from = function (t) {
      var b = rawFrom(t);
      ["insert", "update", "upsert", "delete"].forEach(function (m) {
        var orig = b[m]; if (typeof orig !== "function") return;
        b[m] = function () {
          var r = orig.apply(b, arguments), th = r.then;
          r.then = function (a, c) { return th.call(r, function (res) { if (res && !res.error) afterWrite(t); return a ? a(res) : res; }, c); };
          return r;
        };
      });
      return b;
    };
  }
  if (!client) console.error("[DQ] supabase-js yüklənməyib — dq-db.js skriptdən əvvəl supabase-js qoşun.");

  /* ---------------------------------------------------------- utils */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hash(s) { // sürətli qeyri-kriptoqrafik hash (dəyişiklik aşkarı üçün)
    var h = 5381, i = s.length;
    while (i) h = (h * 33) ^ s.charCodeAt(--i);
    return (h >>> 0).toString(36) + ":" + s.length;
  }

  function friendly(e) {
    if (!e) return "";
    var code = String(e.code || ""), msg = String(e.message || e);
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "İnternet bağlantısı yoxdur.";
    if (code === "42501" || /row-level security|permission denied|jwt/i.test(msg)) return "Bu əməliyyat üçün icazə yoxdur. Admin kimi daxil olun.";
    if (code === "23505") return "Bu qeyd artıq mövcuddur.";
    if (code === "42P01" || code === "PGRST205") return "Baza cədvəli tapılmadı.";
    if (code === "timeout") return "Bazadan cavab gec gəldi. Bir az sonra yenidən cəhd edin.";
    return msg;
  }

  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return function () { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); }; }
  function emit(ev, data) { (listeners[ev] || []).slice().forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------------------------------------------------------- status */
  var state = (typeof navigator !== "undefined" && navigator.onLine === false) ? "offline" : "online";
  var fails = 0;
  function setState(s) { if (s !== state) { state = s; emit("status", s); } }
  function ok() { fails = 0; setState("online"); }
  function bad() {
    fails++;
    setState((typeof navigator !== "undefined" && navigator.onLine === false) ? "offline" : fails >= 2 ? "degraded" : state);
  }
  window.addEventListener("online", function () { fails = 0; setState("online"); emit("reconnect"); });
  window.addEventListener("offline", function () { setState("offline"); });

  /* ---------------------------------------------------------- cache */
  function lsGet(k) { try { var r = localStorage.getItem(LS_PREFIX + k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function lsSet(k, o) { try { var s = JSON.stringify(o); if (s.length <= LS_MAX_BYTES) localStorage.setItem(LS_PREFIX + k, s); } catch (e) { /* kvota dolu ola bilər */ } }
  function lsDel(k) { try { localStorage.removeItem(LS_PREFIX + k); } catch (e) { } }

  function tableOf(key) { return key.split("|")[0]; }

  function invalidate(table) {
    Object.keys(mem).forEach(function (k) { if (tableOf(k) === table) { delete mem[k]; lsDel(k); } });
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var lk = localStorage.key(i);
        if (lk && lk.indexOf(LS_PREFIX + table + "|") === 0) localStorage.removeItem(lk);
      }
    } catch (e) { }
  }

  /* ---------------------------------------------------------- read */
  /**
   * DQ.read(table, build, opts) → Promise<{data, error, cached, stale}>
   *   build : function(q) { return q.select("*").order("id",{ascending:false}); }
   *   opts  : { ttl, key, force, swr, onFresh, retries, timeout }
   *     key    — sorğunu fərqləndirən əlavə açar (build funksiyası fərqli sorğular yaradırsa mütləq verin)
   *     swr    — true: köhnə keş varsa dərhal qaytar, fonda yenilə və onFresh(res) çağır
   *     force  — keşi atla
   */
  function read(table, build, opts) {
    opts = opts || {};
    var key = table + "|" + (opts.key || (build ? String(build) : "all"));
    var ttl = opts.ttl != null ? opts.ttl : TTL_DEFAULT;
    var now = Date.now();

    var hit = mem[key] || (function () { var l = lsGet(key); if (l) mem[key] = l; return l; })();
    if (!opts.force && hit && now - hit.t < ttl) return Promise.resolve({ data: hit.v, error: null, cached: true });

    if (!opts.force && opts.swr && hit && now - hit.t < SWR_MAX) {
      fetchFresh(key, table, build, opts).then(function (res) { if (!res.error && typeof opts.onFresh === "function") opts.onFresh(res); });
      return Promise.resolve({ data: hit.v, error: null, cached: true, stale: true });
    }
    var p = fetchFresh(key, table, build, opts);
    var budget = opts.budget != null ? opts.budget : BUDGET;
    if (!budget) return p;
    // BÜDCƏ: istifadəçi ən çox 3 saniyə gözləyir. Sorğu fonda davam edir və bitəndə "data" hadisəsi yayılır.
    return Promise.race([p, new Promise(function (res) {
      setTimeout(function () {
        var old = mem[key] || lsGet(key);
        res(old ? { data: old.v, error: null, cached: true, stale: true, timedOut: true, pending: p }
                : { data: null, error: { code: "timeout", message: "timeout" }, timedOut: true, pending: p, message: friendly({ code: "timeout" }) });
      }, budget);
    })]);
  }

  function fetchFresh(key, table, build, opts) {
    if (inflight[key]) return inflight[key]; // eyni sorğu artıq gedir — təkrar göndərmə
    var retries = opts.retries != null ? opts.retries : 1;
    var timeout = opts.timeout || 20000;

    var p = (async function () {
      var last;
      for (var n = 0; n <= retries; n++) {
        try {
          var q = client.from(table);
          var req = build ? build(q) : q.select("*");
          var res = await Promise.race([req, new Promise(function (_, rej) { setTimeout(function () { var e = new Error("timeout"); e.code = "timeout"; rej(e); }, timeout); })]);
          if (res && res.error) {
            last = res.error;
            if (res.error.code === "42501" || /^2[23]/.test(String(res.error.code))) break; // təkrar cəhd mənasızdır
            throw res.error;
          }
          ok();
          var entry = { t: Date.now(), v: res.data };
          mem[key] = entry; lsSet(key, entry);
          return { data: res.data, error: null, cached: false };
        } catch (e) {
          last = e; bad();
          if (n < retries) await sleep(350 * Math.pow(2, n) + Math.random() * 200);
        }
      }
      // son çarə: şəbəkə yoxdursa köhnə keşi göstər
      var old = mem[key] || lsGet(key);
      if (old && opts.fallbackStale !== false) return { data: old.v, error: null, cached: true, stale: true, offline: true };
      return { data: null, error: last, message: friendly(last) };
    })();

    inflight[key] = p;
    var done = function () { delete inflight[key]; };
    p.then(done, done);
    return p;
  }

  /**
   * DQ.load(table, build, o) — panel siyahıları üçün standart yükləyici.
   *   o.render(data)  : məlumatı ekrana çıxarır (dəyişəndə yenidən çağırılır)
   *   o.key           : sorğu açarı (mütləq)
   *   o.target        : (ixtiyari) tbody/konteyner — yüklənərkən skelet, xətada "Yenidən cəhd" göstərilir
   *   o.cols          : target üçün sütun sayı
   * Davranış: keş varsa DƏRHAL göstərir → fonda yeniləyir. Keş yoxdursa ≤3 san gözləyir, sonra
   * "yavaş" vəziyyətini göstərir və məlumat gələn kimi özü doldurur.
   */
  function load(table, build, o) {
    var shown = "", tgt = typeof o.target === "string" ? document.getElementById(o.target) : o.target, cols = o.cols || 1;
    function paint(d) {
      var h = hash(JSON.stringify(d == null ? null : d));
      if (h === shown) return; shown = h;
      try { o.render(d || []); } catch (e) { console.error("[DQ.load render]", e); }
    }
    function skeleton() {
      if (tgt && !shown) tgt.innerHTML = '<tr><td colspan="' + cols + '"><div class="dq-skel"></div><div class="dq-skel" style="margin-top:10px;width:70%"></div></td></tr>';
    }
    function failed(msg) {
      if (!tgt || shown) return DQ.toast(msg, "err");
      tgt.innerHTML = '<tr><td colspan="' + cols + '" class="dq-empty">' + esc(msg) + ' <button type="button" class="btn btn-sm" data-dq-retry>Yenidən cəhd et</button></td></tr>';
      var b = tgt.querySelector("[data-dq-retry]"); if (b) b.onclick = function () { run(true); };
    }
    function run(force) {
      skeleton();
      return read(table, build, { key: o.key, swr: true, ttl: o.ttl != null ? o.ttl : 0, force: !!force, onFresh: function (r) { paint(r.data); } }).then(function (r) {
        if (!r.error) { paint(r.data); if (r.timedOut && r.pending) r.pending.then(function (x) { if (!x.error) paint(x.data); }); return r; }
        if (r.timedOut && r.pending) { // 3 san keçdi, sorğu davam edir
          if (tgt && !shown) tgt.innerHTML = '<tr><td colspan="' + cols + '" class="dq-empty">Baza gec cavab verir — yüklənir…</td></tr>';
          r.pending.then(function (x) { if (!x.error) { paint(x.data); } else failed(x.message || friendly(x.error)); });
          return r; // çağıran tərəf 3 saniyədən çox gözləmir; məlumat gələndə render özü çağırılır
        }
        failed(r.message || friendly(r.error)); return r;
      });
    }
    var stop = watchSoft(table, build, o.key, paint, o.every || 15000);
    return run(false).then(function (r) { r.stop = stop; return r; });
  }
  // load() üçün yüngül canlı yenilənmə: yalnız tab görünəndə, yalnız dəyişəndə
  function watchSoft(table, build, key, paint, every) {
    return watch(table, build, paint, { every: every, key: key, _skipFirst: true });
  }

  /* ---------------------------------------------------------- write */
  /**
   * DQ.write(table, mutate) — mutate: function(q){ return q.insert([...]); }
   * Uğurlu yazıdan sonra həmin tabın keşi silinir və "change" hadisəsi yayılır.
   */
  async function write(table, mutate, opts) {
    opts = opts || {};
    var last, retries = opts.retries != null ? opts.retries : 1;
    for (var n = 0; n <= retries; n++) {
      try {
        var res = await mutate(client.from(table));
        if (res && res.error) {
          last = res.error;
          if (res.error.code === "42501" || /^2[23]/.test(String(res.error.code))) break;
          throw res.error;
        }
        ok();
        invalidate(table);
        emit("change", { table: table });
        try { bc && bc.postMessage({ table: table }); } catch (e) { }
        return { data: res ? res.data : null, error: null };
      } catch (e) {
        last = e; bad();
        if (n < retries) await sleep(500 + Math.random() * 300);
      }
    }
    return { data: null, error: last, message: friendly(last) };
  }

  async function upsertMany(table, rows, opts) {
    opts = opts || {};
    var size = opts.chunk || 200, all = [];
    for (var i = 0; i < rows.length; i += size) {
      var part = rows.slice(i, i + size);
      var r = await write(table, function (q) { return q.upsert(part, opts.onConflict ? { onConflict: opts.onConflict } : undefined); }, { retries: 2 });
      if (r.error) return { data: all, error: r.error, message: r.message, doneRows: i };
      if (typeof opts.onProgress === "function") opts.onProgress(Math.min(i + size, rows.length), rows.length);
    }
    return { data: all, error: null };
  }

  /* ---------------------------------------------------------- watch */
  /**
   * DQ.watch(table, build, cb, opts) → stop()
   * Canlı yenilənmə (polling): yalnız data DƏYİŞƏNDƏ cb(data) çağırılır.
   * Tab gizlidirsə dayanır, geri qayıdanda və internet bərpa olanda dərhal yoxlayır.
   * Eyni brauzerin digər pəncərəsində yazı olarsa (BroadcastChannel) gözləmədən yenilənir.
   */
  function watch(table, build, cb, opts) {
    opts = opts || {};
    var every = Math.max(3000, opts.every || 10000), timer = 0, last = "", stopped = false;

    function tick(force) {
      if (stopped || (document.hidden && !force)) return schedule();
      read(table, build, { ttl: 0, force: true, key: opts.key, retries: 0, fallbackStale: false }).then(function (res) {
        if (stopped) return;
        if (!res.error) {
          var h = hash(JSON.stringify(res.data));
          if (h !== last) { last = h; try { cb(res.data); } catch (e) { console.error(e); } }
        }
        schedule();
      });
    }
    function schedule() { clearTimeout(timer); if (!stopped) timer = setTimeout(tick, every + Math.random() * 400); }
    function kick() { tick(true); }

    var offChange = on("change", function (e) { if (e.table === table) kick(); });
    var offRe = on("reconnect", kick);
    function vis() { if (!document.hidden) kick(); }
    document.addEventListener("visibilitychange", vis);
    if (opts._skipFirst) schedule(); else kick();

    return function stop() { stopped = true; clearTimeout(timer); offChange(); offRe(); document.removeEventListener("visibilitychange", vis); };
  }

  try {
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("dq-db");
      bc.onmessage = function (m) { if (m.data && m.data.table) { invalidate(m.data.table); emit("change", { table: m.data.table }); } };
    }
  } catch (e) { }

  /* ---------------------------------------------------------- UI: status pill + toast */
  function injectUiCss() {
    if (document.getElementById("dq-db-css")) return;
    var s = document.createElement("style"); s.id = "dq-db-css";
    s.textContent =
      ".dq-conn{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font:600 11px/1 'Oswald',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;background:rgba(255,255,255,.92);color:#0a2540;box-shadow:0 2px 10px rgba(0,60,140,.15)}" +
      ".dq-conn i{width:8px;height:8px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.2)}" +
      ".dq-conn.degraded i{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.25)}" +
      ".dq-conn.offline i{background:#c81a02;box-shadow:0 0 0 3px rgba(247,33,3,.25)}" +
      "#dq-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;z-index:99999;max-width:92vw;padding:12px 18px;border-radius:14px;background:#0a2540;color:#fdfdfe;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,40,100,.35);transition:.25s;pointer-events:none}" +
      "#dq-toast.show{opacity:1;transform:translate(-50%,0)}#dq-toast.err{background:#c81a02}#dq-toast.ok{background:#0a7d3b}";
    (document.head || document.documentElement).appendChild(s);
  }

  var LABEL = { online: "Baza ilə əlaqə: aktiv", degraded: "Əlaqə zəifdir", offline: "İnternet yoxdur" };
  function mountStatus(target) {
    injectUiCss();
    var el = document.createElement("span");
    el.className = "dq-conn"; el.setAttribute("role", "status");
    function paint(s) { el.className = "dq-conn " + s; el.innerHTML = "<i></i>" + LABEL[s]; }
    paint(state); on("status", paint);
    (typeof target === "string" ? document.querySelector(target) : target || document.body).appendChild(el);
    return el;
  }

  var toastT = 0;
  function toast(msg, kind) {
    injectUiCss();
    var el = document.getElementById("dq-toast");
    if (!el) { el = document.createElement("div"); el.id = "dq-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = (kind || "") ; el.textContent = msg;
    requestAnimationFrame(function () { el.classList.add("show"); });
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("show"); }, 3200);
  }

  // inline onclick="fn('...')" üçün təhlükəsiz arqument: DQ.arg(v) → fn-də DQ.unarg(x)
  function arg(v) { return encodeURIComponent(String(v == null ? "" : v)).replace(/'/g, "%27"); }
  function unarg(v) { try { return decodeURIComponent(v); } catch (e) { return v; } }

  // <body data-dq-status> olan səhifələrdə status göstəricisi avtomatik hero-ya əlavə olunur
  document.addEventListener("DOMContentLoaded", function () {
    if (!document.body.hasAttribute("data-dq-status")) return;
    var host = document.querySelector(".top-bar,.header-title,.header,header");
    if (!host) return;
    var box = document.createElement("div"); box.className = "dq-hero-tools";
    host.appendChild(box); mountStatus(box);
  });

  /* ---------------------------------------------------------- public */
  var API = {
    client: client, config: { url: CFG.url },
    read: read, write: write, upsertMany: upsertMany, watch: watch,
    load: load, invalidate: invalidate, on: on, esc: esc, arg: arg, unarg: unarg, friendly: friendly, toast: toast,
    status: function () { return state; }, mountStatus: mountStatus,
    // tez yoxlama: baza cavab verirmi? (cədvəl adı dəyişə bilər)
    ping: function () { return read("allowed_students", function (q) { return q.select("id").limit(1); }, { force: true, retries: 0, fallbackStale: false }).then(function (r) { return !r.error; }); }
  };
  /* index.html-də DQ artıq naviqasiya/kabinet üçün mövcuddur — üzərinə yazmırıq, birləşdiririk */
  window.DQSB = API; /* app.js öz "var DQ" obyekti ilə window.DQ-ni əvəz etdiyi üçün etibarlı ad */
  var host = window.DQ && typeof window.DQ === "object" ? window.DQ : (window.DQ = {});
  Object.keys(API).forEach(function (k) { if (!(k in host)) host[k] = API[k]; });
})();
