/* DQ Platform — Dizayn kilidi v1
   Məqsəd: V3 redaktorunda «Yadda saxla» basılan dizayn mərkəzi bazaya yazılır,
   yoxlanılır və bundan sonra heç nə (yeni kod, ziyarətçi, köhnə keş, avtomatik miqrasiya) onu sıfırlaya bilmir.
   Qoşulma: index.html-də app.js-dən dərhal sonra  <script src="dq-lock.js?v=1"></script> */
(function () {
  "use strict";
  if (window.__dqLock) return;
  if (typeof V3 === "undefined" || typeof V2 === "undefined" || typeof _supabase === "undefined") {
    console.warn("[dq-lock] V3 / V2 / _supabase tapılmadı — yamaq işə düşmədi");
    return;
  }
  window.__dqLock = { v: 1 };

  var COL = "v3cfg", HIST = "v3hist", CK = "dq_v3_lock_cache", DRAFT = "dq_v3_draft";
  var MIG = ["qan", "hz", "hzs", "inf", "imt"];           /* köhnə kodun avtomatik əlavə etdiyi düymələr */
  var L = { id: null, rev: 0, ready: false, degraded: false, allow: false, sig: "", retry: 0 };

  /* ---------- kiçik köməkçilər ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { }
    return null;
  }
  function isAdmin() { return window.__dqAuthed === true; }
  function editorOpen() { var r = document.getElementById("v3-root"); return !!r && r.style.display === "block"; }
  function toast(t) { try { V2.toast(t); } catch (e) { } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("server cavab vermədi (zaman aşımı)")); }, ms); })]);
  }
  function snapOf(D) { return { txt: clone(D.txt || {}), items: clone(D.items || {}), groups: clone(D.groups || {}) }; }
  function sigOf(c) { try { return JSON.stringify([c.txt, c.items, c.groups]); } catch (e) { return ""; } }
  function valid(c) {
    return !!(c && c.items && typeof c.items === "object" && c.groups && typeof c.groups === "object" && Object.keys(c.items).length);
  }

  /* ---------- V3.D və V3.id yalnız bu yamaqdan dəyişə bilər ---------- */
  (function guard() {
    var d = V3.D;
    Object.defineProperty(V3, "D", {
      configurable: true, enumerable: true,
      get: function () { return d; },
      set: function (v) { if (L.allow) d = v; }          /* köhnə load() və 1200ms «defolt» taymeri bloklanır */
    });
    Object.defineProperty(V3, "id", {
      configurable: true, enumerable: true,
      get: function () { return null; },
      set: function () { }
    });
  })();
  function setD(cfg) { L.allow = true; try { V3.D = cfg; } finally { L.allow = false; } }

  /* ---------- konfiqurasiyanı normallaşdır ---------- */
  function normalize(c, saved) {
    var d = clone(V3.DEF);
    if (c) {
      if (c.txt) Object.assign(d.txt, c.txt);
      if (c.items) d.items = clone(c.items);
      if (c.groups) d.groups = Object.assign({}, d.groups, clone(c.groups));
      var s4 = d.items.s4;
      if (s4 && s4.t === "PDF MATERİAL") { s4.t = "DƏRS MATERİALLARI"; s4.s = "Fənlər üzrə vəsaitlər"; }
    }
    if (saved) {
      /* admin dizaynı artıq bir dəfə saxlayıb: «yeni düymə əlavə et» miqrasiyaları bir daha toxunmasın */
      d.txt.qanAdded = "1"; d.txt.hzAdded = "1";
      if (!d.items.imt) {                                 /* «İmtahanlar» düyməsi başqa id ilə varsa təkrar yaranmasın */
        var k = Object.keys(d.items).filter(function (i) { return d.items[i] && d.items[i].a === "sessions"; })[0];
        if (k) {
          d.items.imt = d.items[k]; delete d.items[k];
          Object.keys(d.groups).forEach(function (g) {
            d.groups[g] = (d.groups[g] || []).map(function (x) { return x === k ? "imt" : x; });
          });
        }
      }
    }
    return d;
  }

  /* admin tərəfindən dəyişdirilib, yoxsa saf defoltdur? (kilidsiz köhnə qeydləri ayırmaq üçün) */
  function isCustom(c) {
    var D = V3.DEF, it = c.items || {}, k;
    for (k in it) {
      var x = it[k]; if (!x) continue;
      if (x.h) return true;
      if (MIG.indexOf(k) > -1) continue;
      var b = D.items[k];
      if (!b) return true;
      if (x.t !== b.t || (x.a || "") !== (b.a || "") || (x.s || "") !== (b.s || "") || (x.c || "") !== (b.c || "")) {
        if (k === "s4" && x.t === "PDF MATERİAL") continue;
        return true;
      }
    }
    for (k in D.items) if (!it[k]) return true;
    var t = c.txt || {};
    for (k in D.txt) if (t[k] != null && t[k] !== D.txt[k]) return true;
    var g = c.groups || {};
    for (k in D.groups) {
      var a = (g[k] || []).filter(function (i) { return MIG.indexOf(i) < 0; }).join(",");
      if (a !== D.groups[k].join(",")) return true;
    }
    return false;
  }

  /* ---------- bazadan oxu ---------- */
  async function fetchRows() {
    await V2.probe();
    if (V2.mode !== "cloud") {
      var l = await V2.list(COL);
      return {
        cloud: false,
        rows: (l || []).map(function (r) { var d = Object.assign({}, r), id = d._id; delete d._id; return { id: id, created: null, data: d }; })
          .sort(function (a, b) { return b.id - a.id; })
      };
    }
    var q = await withTimeout(_supabase.from("dq_v2_store").select("id,created_at,data").eq("collection", COL).order("id", { ascending: false }).limit(80), 7000);
    if (q.error) throw q.error;
    return { cloud: true, rows: (q.data || []).map(function (r) { return { id: r.id, created: r.created_at, data: r.data || {} }; }) };
  }
  function pick(rows) {
    var ok = rows.filter(function (r) { return valid(r.data); });
    var lk = ok.filter(function (r) { return r.data.lock; })
      .sort(function (a, b) { return (b.data.rev || 0) - (a.data.rev || 0) || b.id - a.id; });
    if (lk.length) return { row: lk[0], kind: "lock" };
    var cu = ok.filter(function (r) { return isCustom(r.data); });
    if (cu.length) return { row: cu[0], kind: "legacy" };
    return ok.length ? { row: ok[0], kind: "legacy" } : null;
  }

  /* ---------- bu cihazda son yaxşı dizayn (səhifə dərhal düzgün açılsın) ---------- */
  function cacheRead() {
    try { var o = JSON.parse(ls(CK) || "null"); return o && valid(o.cfg) ? o : null; } catch (e) { return null; }
  }
  function cacheWrite(id, rev, cfg) { ls(CK, JSON.stringify({ id: id, rev: rev, cfg: snapOf(cfg) })); }

  function paint() {
    try { V3.render(); } catch (e) { console.warn("[dq-lock] render", e); }
    [700, 1800].forEach(function (ms) {
      setTimeout(function () { try { window.HOME && HOME.order && HOME.order(); } catch (e) { } }, ms);
    });
  }

  /* ---------- yükləmə ---------- */
  var inflight = null;
  function load(force) {
    if (inflight) return inflight;
    inflight = run(force).then(function (r) { inflight = null; return r; }, function (e) { inflight = null; throw e; });
    return inflight;
  }
  async function run(force) {
    var first = !L.ready, c = cacheRead(), fb = null;
    if (first && c) {                                      /* 1) keşdən ani, düzgün görünüş */
      setD(normalize(c.cfg, true)); L.sig = sigOf(V3.D); L.ready = true; paint();
    } else if (first) {                                    /* keş yoxdur: 3.5 san-dən sonra yedək defolt */
      fb = setTimeout(function () {
        if (!L.ready) { setD(normalize(null, false)); L.ready = true; L.degraded = true; paint(); }
      }, 3500);
    }
    var res = null;
    for (var i = 0; i < 2 && !res; i++) {
      try { res = await fetchRows(); } catch (e) { console.warn("[dq-lock] oxuma xətası", e); if (i === 0) await sleep(600); }
    }
    clearTimeout(fb);
    if (!res) {                                            /* şəbəkə problemi: mövcud görünüşü saxla, sonra təkrar yoxla */
      if (!L.ready) { setD(normalize(null, false)); L.ready = true; L.degraded = true; paint(); }
      if (L.retry++ < 6) setTimeout(function () { load(false).catch(function () { }); }, 15000);
      return false;
    }
    L.retry = 0;
    var p = pick(res.rows);
    if (p) {                                               /* 2) bazadakı dizayn həqiqətdir */
      var cfg = normalize(p.row.data, true), s = sigOf(cfg);
      L.id = p.kind === "lock" ? p.row.id : null;
      L.rev = p.kind === "lock" ? (p.row.data.rev || 0) : 0;
      if (force || L.degraded || s !== L.sig) {
        L.degraded = false; setD(cfg); L.sig = s; L.ready = true; paint();
      }
      cacheWrite(L.id, L.rev, cfg);
    } else if (!L.ready) {                                 /* baza həqiqətən boşdur */
      setD(normalize(null, false)); L.ready = true; L.sig = sigOf(V3.D); paint();
    }
    return true;
  }

  /* ---------- yazma: yalnız admin «Yadda saxla» ---------- */
  async function writeLocked(snap) {
    await V2.probe();
    if (V2.mode !== "cloud") throw new Error("mərkəzi baza (Supabase) əlçatan deyil — dizayn yalnız bu cihazda qalardı, ona görə yazılmadı");
    var rev = Date.now(), payload = { txt: snap.txt, items: snap.items, groups: snap.groups, lock: true, rev: rev };
    var q = null;
    if (L.id) {
      q = await _supabase.from("dq_v2_store").update({ data: payload }).eq("id", L.id).select("id");
      if (q.error) throw new Error(q.error.message);
      if (!q.data || !q.data.length) q = null;             /* sətir silinibsə, yenisi yaradılsın */
    }
    if (!q) {
      q = await _supabase.from("dq_v2_store").insert([{ collection: COL, data: payload }]).select("id");
      if (q.error) throw new Error(q.error.message);
      if (!q.data || !q.data.length) throw new Error("baza yazmağa icazə vermədi — admin kimi yenidən daxil olun");
    }
    var id = q.data[0].id;
    var v = await _supabase.from("dq_v2_store").select("id,data").eq("id", id).single();   /* real yoxlama */
    if (v.error || !v.data || !v.data.data || v.data.data.rev !== rev) throw new Error("yazılış bazada təsdiqlənmədi");
    L.id = id; L.rev = rev;
    try {                                                  /* tarixçə: son 20 variant */
      await _supabase.from("dq_v2_store").insert([{ collection: HIST, data: { ts: rev, cfg: snap } }]);
      var h = await _supabase.from("dq_v2_store").select("id").eq("collection", HIST).order("id", { ascending: false });
      var old = ((h && h.data) || []).slice(20).map(function (r) { return r.id; });
      if (old.length) await _supabase.from("dq_v2_store").delete().in("id", old);
    } catch (e) { }
  }

  V3.commit = async function () {
    if (V3.busy) return false;
    V3.busy = true; V3.err = ""; try { V3.barUpdate(); } catch (e) { }
    try {
      clearTimeout(V3.timer);
      try { V3.syncTxt(); } catch (e) { }
      var snap = snapOf(V3.D);
      await writeLocked(snap);
      V3.dirty = false; V3.savedAt = new Date();
      ls(DRAFT, null);
      L.sig = sigOf(snap); L.degraded = false; L.ready = true;
      cacheWrite(L.id, L.rev, snap);
      toast("Mərkəzi bazaya yazıldı və yoxlandı ✅");
      try { V3.render(); } catch (e) { }
      return true;
    } catch (e) {
      V3.err = String((e && e.message) || e);
      toast("Saxlanılmadı ❌ " + V3.err);
      return false;
    } finally {
      V3.busy = false; try { V3.barUpdate(); } catch (e) { }
    }
  };

  /* redaktor bağlıykən köhnə kodun V3.save() çağırışı: ziyarətçi heç vaxt bazaya yazmır */
  var prevSave = V3.save;
  V3.save = function () {
    if (editorOpen() && window.V3SV) return prevSave.apply(V3, arguments);   /* yalnız «dəyişdi» işarəsi */
    if (isAdmin() && L.ready && !L.degraded) {
      clearTimeout(V3.timer);
      V3.timer = setTimeout(function () { V3.commit(); }, 400);
      return;
    }
    try { V3.render(); } catch (e) { }
  };

  V3.load = function () { return load(true); };            /* «Ləğv et» və redaktor açılışı üçün */

  /* ---------- tarixçə / bərpa ---------- */
  function summary(cfg) {
    var it = cfg.items || {}, g = cfg.groups || {};
    var nav = (g.nav || []).map(function (id) { return it[id]; }).filter(function (x) { return x && !x.h; })
      .map(function (x) { return x.t; }).join(" · ");
    var hid = Object.keys(it).filter(function (k) { return it[k] && it[k].h; }).length;
    return { nav: nav || "—", hid: hid };
  }
  async function openHistory() {
    var old = document.getElementById("dq-lk-h"); if (old) old.remove();
    var m = document.createElement("div"); m.id = "dq-lk-h";
    m.style.cssText = "position:fixed;inset:0;z-index:100010;background:#0f172acc;display:flex;align-items:center;justify-content:center;padding:14px";
    m.innerHTML = '<div style="background:#fff;color:#0f172a;border-radius:16px;width:min(100%,460px);max-height:86vh;overflow:auto;padding:16px;font:500 14px/1.4 Roboto,Arial,sans-serif"><b style="font-size:17px">🕘 Əvvəlki variantlar</b><div id="dq-lk-l" style="margin-top:10px">Yüklənir…</div><button type="button" id="dq-lk-x" style="margin-top:12px;width:100%;border:0;border-radius:10px;padding:11px;background:#eef2ff;color:#1e1b4b;font:800 14px inherit;cursor:pointer">Bağla</button></div>';
    document.body.appendChild(m);
    m.onclick = function (e) { if (e.target === m || e.target.id === "dq-lk-x") m.remove(); };
    var box = document.getElementById("dq-lk-l");
    try {
      var q = await withTimeout(_supabase.from("dq_v2_store").select("id,collection,created_at,data").in("collection", [COL, HIST]).order("id", { ascending: false }).limit(60), 8000);
      if (q.error) throw q.error;
      var list = [];
      (q.data || []).forEach(function (r) {
        var cfg = r.collection === HIST ? (r.data && r.data.cfg) : r.data;
        if (!valid(cfg)) return;
        list.push({ cfg: cfg, when: r.created_at, tag: r.collection === HIST ? "saxlanılıb" : (r.data.lock ? "aktiv" : "köhnə qeyd") });
      });
      if (!list.length) { box.textContent = "Tarixçə boşdur."; return; }
      box.innerHTML = "";
      list.slice(0, 25).forEach(function (x) {
        var s = summary(x.cfg), row = document.createElement("div");
        row.style.cssText = "border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:8px";
        row.innerHTML = '<div style="font-size:12px;color:#64748b">' + V3.esc(x.when ? new Date(x.when).toLocaleString("az-AZ") : "") + " · " + x.tag + "</div>" +
          '<div style="margin:4px 0;font-size:13px">Menyu: ' + V3.esc(s.nav) + (s.hid ? " · gizli: " + s.hid : "") + "</div>";
        var b = document.createElement("button"); b.type = "button"; b.textContent = "Bunu bərpa et";
        b.style.cssText = "border:0;border-radius:9px;padding:8px 12px;background:#00c853;color:#fff;font:800 13px inherit;cursor:pointer";
        b.onclick = function () {
          setD(normalize(x.cfg, true)); V3.dirty = true;
          try { V3.draw(); } catch (e) { }
          try { V3.barUpdate(); } catch (e) { }
          toast("Bərpa olundu — indi «Yadda saxla» basın");
          m.remove();
        };
        row.appendChild(b); box.appendChild(row);
      });
    } catch (e) { box.textContent = "Oxunmadı: " + ((e && e.message) || e); }
  }
  var prevBar = V3.bar;
  if (typeof prevBar === "function") {
    V3.bar = function () {
      var r = prevBar.apply(V3, arguments);
      var bt = document.querySelector("#v3-sv .bt");
      if (bt && !document.getElementById("v3-sv-h")) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "o"; b.id = "v3-sv-h"; b.title = "Əvvəlki variantlar"; b.textContent = "🕘";
        b.onclick = openHistory; bt.insertBefore(b, bt.firstChild);
      }
      return r;
    };
  }

  /* ---------- başqa cihazda saxlanılan dəyişiklik bu cihaza da çatsın ---------- */
  var lastRef = Date.now();
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || Date.now() - lastRef < 60000 || editorOpen() || V3.dirty) return;
    lastRef = Date.now(); load(false).catch(function () { });
  });

  load(false).catch(function (e) { console.warn("[dq-lock]", e); });
})();
