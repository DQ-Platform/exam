/*!
 * DQ Platform — dq-preload.js
 * Səhifə açılan kimi bütün mərkəzi məlumatı (yeniliklər, testlər, imtahanlar,
 * suallar, nəticələr/statistika) PARALEL yükləyir və DQ keşinə (yaddaş + localStorage
 * + IndexedDB) yazır. Sonrakı DQ.read/DQ.load çağırışları dərhal keşdən cavab alır.
 *
 * Yükləmə sırası:  dq-net.js → supabase-js → dq-db.js → dq-preload.js
 * İstifadə:        DQPreload.ready.then(() => ...)   // hamısı hazır olanda
 *                  DQPreload.get("exam_questions")   // hazır massiv (və ya null)
 */
(function () {
  "use strict";
  if (window.DQPreload) return;
  function D() { return window.DQSB || window.DQ; }

  var PAGE = 1000;          // PostgREST bir sorğuda max sətir
  var IDB = "dq_preload", STORE = "t", IDB_TTL = 6 * 3600 * 1000;
  var data = {}, listeners = [], done = 0, total = 0, t0 = Date.now();

  /* Hər cədvəl: açar, sütunlar, sıralama. Ağır cədvəllər səhifələnir. */
  var JOBS = [
    { t: "dq_v2_store",      key: "news",      sel: "*", eq: ["collection", "news"],      order: "id" },
    { t: "dq_v2_store",      key: "tests",     sel: "*", eq: ["collection", "tests"],     order: "id" },
    { t: "dq_v2_store",      key: "exams",     sel: "*", eq: ["collection", "exams"],     order: "id" },
    { t: "dq_v2_store",      key: "quizres",   sel: "*", eq: ["collection", "quizres"],   order: "id", lazy: true },
    { t: "allowed_students", key: "students",  sel: "*", order: "id" },
    { t: "exam_questions",   key: "questions", sel: "*", order: "id" },
    { t: "exam_results",     key: "results",   sel: "*", order: "id", lazy: true }
  ];

  /* ---------- IndexedDB (localStorage 5MB limitindən yuxarı böyük keş) ---------- */
  function idb() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open(IDB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  function idbGet(k) {
    return idb().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        try {
          var q = db.transaction(STORE).objectStore(STORE).get(k);
          q.onsuccess = function () { res(q.result || null); };
          q.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  function idbSet(k, v) {
    return idb().then(function (db) {
      if (!db) return;
      try { db.transaction(STORE, "readwrite").objectStore(STORE).put(v, k); } catch (e) { }
    });
  }

  /* ---------- Səhifələnmiş yükləmə ---------- */
  async function fetchAll(job) {
    var out = [], from = 0;
    for (;;) {
      var q = D().client.from(job.t).select(job.sel);
      if (job.eq) q = q.eq(job.eq[0], job.eq[1]);
      q = q.order(job.order, { ascending: true }).range(from, from + PAGE - 1);
      var r = await q;
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  function notify(key) {
    listeners.slice().forEach(function (f) { try { f(key, data[key]); } catch (e) { } });
    try { window.dispatchEvent(new CustomEvent("dq:preload", { detail: { key: key, done: done, total: total } })); } catch (e) { }
  }

  async function runJob(job) {
    var ck = "pre:" + job.key;
    /* 1) keş varsa dərhal ver (səhifə gözləmir) */
    var cached = await idbGet(ck);
    if (cached && Date.now() - cached.t < IDB_TTL) { data[job.key] = cached.v; notify(job.key); }
    /* 2) fonda təzəsini çək, dəyişibsə yenilə */
    try {
      var fresh = await fetchAll(job);
      var changed = !cached || JSON.stringify(cached.v) !== JSON.stringify(fresh);
      data[job.key] = fresh;
      idbSet(ck, { t: Date.now(), v: fresh });
      /* dq-db.js keşini də isitmək üçün eyni açarla yazırıq */
      try { localStorage.setItem("dqdb:" + job.t + "|pre:" + job.key, JSON.stringify({ t: Date.now(), v: fresh.length < 400 ? fresh : [] })); } catch (e) { }
      if (changed) notify(job.key);
    } catch (e) {
      console.warn("[DQPreload]", job.key, e && e.message);
    } finally { done++; }
  }

  function start() {
    if (!D() || !D().client || !D().on) { setTimeout(start, 80); return; }
    var now = JOBS.filter(function (j) { return !j.lazy; });
    var later = JOBS.filter(function (j) { return j.lazy; });
    total = JOBS.length;
    /* kritik məlumat paralel; ağır/statistika cədvəlləri boş vaxtda (səhifəni bloklamır) */
    window.DQPreload.ready = Promise.all(now.map(runJob)).then(function () {
      var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 300); };
      idle(function () { Promise.all(later.map(runJob)).then(function () { window.DQPreload.full = Date.now() - t0; }); });
      return data;
    });
    /* yazı olanda həmin cədvəli təzələ */
    D().on("change", function (e) {
      JOBS.filter(function (j) { return j.t === e.table; }).forEach(runJob);
    });
    /* tab geri qayıdanda / internet bərpa olanda yenilə */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - t0 > 60000) { t0 = Date.now(); JOBS.forEach(runJob); }
    });
  }

  window.DQPreload = {
    ready: null, full: 0,
    get: function (k) { return data[k] || null; },
    on: function (f) { listeners.push(f); },
    refresh: function () { return Promise.all(JOBS.map(runJob)); }
  };
  start();
})();
