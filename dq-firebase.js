/* DQ Platform — Supabase → Firebase (Firestore) MÜVƏQQƏTİ körpü, v1
   Mövcud kod (app.js və s.) dəyişmir. supabase-js-in göndərdiyi /rest/v1/... sorğuları
   burada tutulur və Firestore-a yönləndirilir. index.html-də <head>-in ƏN BİRİNCİ script-i olmalıdır. */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;

  /* ====== 1) BURANI DOLDURUN: Firebase Console → Project settings → Your apps → Web app ====== */
  var FIREBASE_CONFIG = root.DQ_FIREBASE_CONFIG || {
    apiKey: "AIzaSyA6mD_qCRIcc8gIEsZB1EiEbUozZeMmd34",
    authDomain: "dq-platform-bdaf3.firebaseapp.com",
    projectId: "dq-platform-bdaf3",
    storageBucket: "dq-platform-bdaf3.firebasestorage.app",
    messagingSenderId: "112281643306",
    appId: "1:112281643306:web:3416ab04f460399c095653"
  };
  /* ======================================================================================== */

  var SB = "https://cpzwliqlgaplroscvduo.supabase.co";
  var SDK = "10.12.2";
  var KIND = {
    allowed_students: { exam_no: "s", fin: "s" },
    exam_questions: { exam_id: "s", category: "s", q_number: "n" },
    exam_results: { exam_no: "s", fin: "s", category: "s" },
    dq_v2_store: { collection: "s" }
  };
  var SKIP_COLL = { live: 1 };          /* canlı izləmə (heartbeat) Firestore kvotasını yeməsin deyə söndürülüb */
  var BIGLIM = 600000, CHUNK = 250000;  /* Firestore sənəd limiti 1 MiB — böyük sətirlər hissələrə bölünür */
  var BIG = {}, CACHE = {}, lastId = 0;

  var configured = FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.projectId.indexOf("BURAYA") < 0;
  if (!configured && !root.DQ_FS_TEST) {
    console.warn("[dq-firebase] Firebase konfiqurasiyası doldurulmayıb — körpü işə düşmədi.");
    return;
  }

  /* ---------- köməkçilər ---------- */
  function newId() {
    var n = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    if (n <= lastId) n = lastId + 1;
    lastId = n; return n;
  }
  function isoDate(v) {
    if (v == null || v === "") return v;
    var s = String(v).trim().replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
    var d = new Date(s);
    return isNaN(d.getTime()) ? v : d.toISOString();
  }
  function coerce(t, f, v) {
    if (v === null || v === undefined) return v;
    var k = f === "id" ? "n" : (KIND[t] || {})[f];
    if (k === "n") { var n = Number(v); return isNaN(n) ? v : n; }
    if (k === "s") return String(v);
    return v;
  }
  function normRow(t, row) {
    var o = {};
    Object.keys(row).forEach(function (k) { o[k] = coerce(t, k, row[k]); });
    if (o.created_at) o.created_at = isoDate(o.created_at);
    return o;
  }
  function docId(v) { var n = Number(v); return isNaN(n) ? String(v) : String(n); }
  function J(status, body, headers) {
    var h = { "Content-Type": "application/json" };
    if (headers) Object.keys(headers).forEach(function (k) { h[k] = headers[k]; });
    return new Response(body == null ? null : JSON.stringify(body), { status: status, headers: h });
  }
  function hget(h, n) {
    if (!h) return "";
    if (typeof h.get === "function") return h.get(n) || "";
    for (var k in h) if (k.toLowerCase() === n) return String(h[k]);
    return "";
  }

  /* ---------- Firestore sənədi <-> sətir ---------- */
  function encode(t, row) {
    var d = {};
    Object.keys(row).forEach(function (k) {
      var v = row[k];
      if (v === undefined) return;
      if (v !== null && typeof v === "object") d["j_" + k] = JSON.stringify(v); else d[k] = v;
    });
    if (t === "dq_v2_store" && row.data && typeof row.data === "object") {
      Object.keys(row.data).forEach(function (k) {
        var v = row.data[k];
        if (/^[A-Za-z0-9_]+$/.test(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
          var s = String(v); if (s.length < 200) d["d_" + k] = s;
        }
      });
    }
    return d;
  }
  async function decode(t, rec) {
    var d = rec.d, FS = await fsReady, row;
    if (d._big) {
      BIG[t + "/" + rec.id] = 1;
      row = JSON.parse((await FS.parts(t, rec.id)).join(""));
    } else {
      row = {};
      Object.keys(d).forEach(function (k) {
        if (k === "_big" || k.indexOf("d_") === 0) return;
        if (k.indexOf("j_") === 0) { try { row[k.slice(2)] = JSON.parse(d[k]); } catch (e) { row[k.slice(2)] = null; } }
        else row[k] = d[k];
      });
    }
    if (row.id == null) row.id = Number(rec.id);
    return row;
  }
  async function save(t, row) {
    var FS = await fsReady, id = String(row.id), key = t + "/" + id;
    var enc = encode(t, row);
    if (JSON.stringify(enc).length <= BIGLIM) {
      if (BIG[key]) { await FS.delParts(t, id); delete BIG[key]; }
      await FS.set(t, id, enc); return;
    }
    var idx = {};
    Object.keys(enc).forEach(function (k) { var v = enc[k]; if (typeof v !== "string" || v.length < 300) idx[k] = v; });
    var body = JSON.stringify(row), parts = [], i = 0;
    while (i < body.length) {
      var end = Math.min(body.length, i + CHUNK), c = body.charCodeAt(end - 1);
      if (end < body.length && c >= 0xD800 && c <= 0xDBFF) end--;
      parts.push(body.slice(i, end)); i = end;
    }
    if (BIG[key]) await FS.delParts(t, id);
    await FS.setParts(t, id, parts);      /* əvvəl hissələr, sonra əsas sənəd */
    idx._big = parts.length;
    await FS.set(t, id, idx); BIG[key] = 1;
  }
  async function remove(t, id) {
    var FS = await fsReady, key = t + "/" + id;
    if (BIG[key]) { await FS.delParts(t, id); delete BIG[key]; }
    await FS.del(t, id);
  }

  /* ---------- PostgREST filtr məntiqi ---------- */
  var RESERVED = { select: 1, order: 1, limit: 1, offset: 1, on_conflict: 1, columns: 1 };
  function splitTop(s, sep) {
    var out = [], d = 0, q = false, cur = "";
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '"') q = !q;
      if (!q && (c === "(" )) d++;
      if (!q && (c === ")")) d--;
      if (!q && d === 0 && c === sep) { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out;
  }
  function parseList(v) {
    v = String(v).trim();
    if (v[0] === "(" && v[v.length - 1] === ")") v = v.slice(1, -1);
    return splitTop(v, ",").map(function (x) { x = x.trim(); return x[0] === '"' ? x.slice(1, -1).replace(/\\"/g, '"') : x; });
  }
  function parseFilters(sp) {
    var f = [];
    sp.forEach(function (v, k) {
      if (RESERVED[k]) return;
      if (k === "or" || k === "and") throw new Error("or/and filtrləri körpüdə dəstəklənmir");
      var not = false, s = v;
      if (s.indexOf("not.") === 0) { not = true; s = s.slice(4); }
      var i = s.indexOf(".");
      f.push({ col: k, op: s.slice(0, i), val: s.slice(i + 1), not: not });
    });
    return f;
  }
  function getVal(row, col) {
    var m = /^(\w+)->>(\w+)$/.exec(col);
    if (m) { var o = row[m[1]], v = o && o[m[2]]; return v == null ? null : (typeof v === "object" ? JSON.stringify(v) : String(v)); }
    m = /^(\w+)->(\w+)$/.exec(col);
    if (m) { var o2 = row[m[1]]; return o2 ? o2[m[2]] : null; }
    return row[col];
  }
  function isNum(x) { return typeof x === "number" || (typeof x === "string" && x.trim() !== "" && !isNaN(x)); }
  function cmp(a, b) {
    if (isNum(a) && isNum(b)) { a = +a; b = +b; } else { a = String(a); b = String(b); }
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function looseEq(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b) || (isNum(a) && isNum(b) && Number(a) === Number(b));
  }
  function matches(row, f) {
    var a = getVal(row, f.col), r;
    switch (f.op) {
      case "eq": r = looseEq(a, f.val); break;
      case "neq": r = a != null && !looseEq(a, f.val); break;
      case "gt": r = a != null && cmp(a, f.val) > 0; break;
      case "gte": r = a != null && cmp(a, f.val) >= 0; break;
      case "lt": r = a != null && cmp(a, f.val) < 0; break;
      case "lte": r = a != null && cmp(a, f.val) <= 0; break;
      case "in": r = a != null && parseList(f.val).some(function (x) { return looseEq(a, x); }); break;
      case "is": r = f.val === "null" ? a == null : f.val === "true" ? a === true : f.val === "false" ? a === false : false; break;
      case "like": case "ilike":
        var re = new RegExp("^" + String(f.val).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", f.op === "ilike" ? "i" : "");
        r = a != null && re.test(String(a)); break;
      default: throw new Error("Dəstəklənməyən operator: " + f.op);
    }
    return f.not ? !r : r;
  }
  function planWheres(t, filters) {
    var w = [], served = [];
    filters.forEach(function (f) {
      if (f.op !== "eq" || f.not) return;
      var m;
      if (f.col !== "id" && (KIND[t] || {})[f.col]) { w.push([f.col, coerce(t, f.col, f.val)]); served.push(f); }
      else if (t === "dq_v2_store" && (m = /^data->>(\w+)$/.exec(f.col))) { w.push(["d_" + m[1], String(f.val)]); served.push(f); }
    });
    return { w: w, served: served };
  }
  function skipped(t, filters) {
    return t === "dq_v2_store" && filters.some(function (f) { return f.col === "collection" && f.op === "eq" && !f.not && SKIP_COLL[f.val]; });
  }
  async function fetchRows(t, filters) {
    var FS = await fsReady;
    if (skipped(t, filters)) return [];
    var idf = filters.filter(function (f) { return f.col === "id" && f.op === "eq" && !f.not; })[0];
    var idin = filters.filter(function (f) { return f.col === "id" && f.op === "in" && !f.not; })[0];
    var recs;
    if (idf) { var r = await FS.get(t, docId(idf.val)); recs = r ? [r] : []; }
    else if (idin) recs = (await Promise.all(parseList(idin.val).map(function (i) { return FS.get(t, docId(i)); }))).filter(Boolean);
    else recs = await FS.list(t, planWheres(t, filters).w);
    var rows = await Promise.all(recs.map(function (x) { return decode(t, x); }));
    return rows.filter(function (r2) { return filters.every(function (f) { return matches(r2, f); }); });
  }
  async function countRows(t, filters) {
    var FS = await fsReady;
    if (skipped(t, filters)) return 0;
    var pl = planWheres(t, filters);
    if (pl.served.length === filters.length && !filters.some(function (f) { return f.col === "id"; })) return FS.count(t, pl.w);
    return (await fetchRows(t, filters)).length;
  }
  function sortRows(rows, order) {
    if (!order) return rows;
    var spec = order.split(",").map(function (s) { var p = s.split("."); return { col: p[0], desc: p[1] === "desc" }; });
    return rows.slice().sort(function (a, b) {
      for (var i = 0; i < spec.length; i++) {
        var x = getVal(a, spec[i].col), y = getVal(b, spec[i].col);
        if (x == null && y == null) continue;
        if (x == null) return spec[i].desc ? -1 : 1;
        if (y == null) return spec[i].desc ? 1 : -1;
        var c = cmp(x, y); if (c) return spec[i].desc ? -c : c;
      }
      return 0;
    });
  }
  function fullRow(t, r) {
    var o = Object.assign({}, r);
    if (t === "dq_v2_store") { if (o.data === undefined) o.data = {}; if (o.collection === undefined) o.collection = null; if (o.created_at === undefined) o.created_at = null; }
    return o;
  }
  function project(t, rows, sel) {
    if (!sel || sel.trim() === "*") return rows.map(function (r) { return fullRow(t, r); });
    var items = splitTop(sel, ",");
    return rows.map(function (r) {
      var o = {};
      items.forEach(function (it) {
        it = it.trim(); if (!it) return;
        if (it === "*") { Object.assign(o, fullRow(t, r)); return; }
        var al = null, ex = it, m = /^(\w+):(?!:)(.+)$/.exec(it);
        if (m) { al = m[1]; ex = m[2].trim(); }
        ex = ex.replace(/::\w+$/, "");
        var v = getVal(r, ex);
        o[al || (/->/.test(ex) ? ex.split(/->>?/).pop() : ex)] = v === undefined ? null : v;
      });
      return o;
    });
  }
  function shape(rows, obj, status, total, off) {
    if (obj) {
      if (rows.length !== 1) return J(406, { code: "PGRST116", details: "The result contains " + rows.length + " rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" });
      return J(status, rows[0]);
    }
    var cr = rows.length ? off + "-" + (off + rows.length - 1) + "/" + total : "*/" + total;
    return J(status, rows, { "Content-Range": cr });
  }

  /* ---------- sorğu icraçısı ---------- */
  async function handle(url, method, hd, body) {
    var u = new URL(url), p = u.pathname;
    if (p.indexOf("/rest/v1/") !== 0) {
      if (p.indexOf("/auth/v1/") === 0) return J(401, { message: "Auth müvəqqəti söndürülüb", code: "401" });
      return J(404, { message: "Not found" });
    }
    var t = p.slice(9).replace(/\/+$/, "");
    if (!t) return new Response(null, { status: 200, headers: { date: new Date().toUTCString() } });
    if (t.indexOf("rpc/") === 0) return J(404, { message: "rpc dəstəklənmir", code: "404" });

    var pref = hget(hd, "prefer"), obj = /vnd\.pgrst\.object/.test(hget(hd, "accept"));
    var rep = /return=representation/.test(pref), sp = u.searchParams, sel = sp.get("select");
    var filters = parseFilters(sp);

    if (method === "HEAD") return new Response(null, { status: 200, headers: { "Content-Range": "*/" + (await countRows(t, filters)) } });

    if (method === "GET") {
      var ck = t === "dq_v2_store" ? url : null, hit = ck && CACHE[ck];
      if (hit && Date.now() - hit.t < 60000) return new Response(hit.b, { status: 200, headers: hit.h });
      var rows = sortRows(await fetchRows(t, filters), sp.get("order"));
      var total = rows.length, off = parseInt(sp.get("offset") || "0", 10) || 0, lim = sp.get("limit");
      rows = rows.slice(off, lim != null ? off + parseInt(lim, 10) : undefined);
      var res = shape(project(t, rows, sel), obj, 200, total, off);
      if (ck && res.status === 200) {
        var clone = res.clone(), hh = { "Content-Type": "application/json", "Content-Range": res.headers.get("Content-Range") || "*/0" };
        CACHE[ck] = { t: Date.now(), b: await clone.text(), h: hh };
      }
      return res;
    }

    var data = body ? JSON.parse(body) : null, out = [];
    if (method === "POST") {
      var items = Array.isArray(data) ? data : [data];
      var upsert = /resolution=merge-duplicates/.test(pref), onc = (sp.get("on_conflict") || "id").split(",");
      for (var i = 0; i < items.length; i++) {
        var row = normRow(t, items[i]);
        if (t === "dq_v2_store" && SKIP_COLL[row.collection]) { if (row.id == null) row.id = newId(); out.push(row); continue; }
        if (upsert && onc.every(function (c) { return row[c] != null; })) {
          var ex = await fetchRows(t, onc.map(function (c) { return { col: c, op: "eq", val: String(row[c]) }; }));
          if (ex.length) row = Object.assign({}, ex[0], row);
        }
        if (row.id == null) row.id = newId();
        if (!row.created_at) row.created_at = new Date().toISOString();
        await save(t, row); out.push(row);
      }
      CACHE = {};
      return rep ? shape(project(t, out, sel), obj, 201, out.length, 0) : new Response(null, { status: 201 });
    }
    if (method === "PATCH") {
      var cur = await fetchRows(t, filters), patch = normRow(t, data || {});
      for (var j = 0; j < cur.length; j++) { var m2 = Object.assign({}, cur[j], patch); await save(t, m2); out.push(m2); }
      CACHE = {};
      return rep ? shape(project(t, out, sel), obj, 200, out.length, 0) : new Response(null, { status: 204 });
    }
    if (method === "DELETE") {
      var del = await fetchRows(t, filters);
      for (var k = 0; k < del.length; k++) await remove(t, docId(del[k].id));
      CACHE = {};
      return rep ? shape(project(t, del, sel), obj, 200, del.length, 0) : new Response(null, { status: 204 });
    }
    return J(405, { message: "Method not allowed" });
  }

  /* ---------- Firestore qatı ---------- */
  async function initFirebase() {
    var base = "https://www.gstatic.com/firebasejs/" + SDK + "/";
    var A = await import(base + "firebase-app.js"), F = await import(base + "firebase-firestore.js");
    var app = A.initializeApp(FIREBASE_CONFIG);
    var db = F.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    function q(coll, w) {
      var args = [F.collection(db, coll)];
      w.forEach(function (x) { args.push(F.where(x[0], "==", x[1])); });
      return F.query.apply(null, args);
    }
    return {
      list: async function (c, w) { var s = await F.getDocs(q(c, w)); return s.docs.map(function (d) { return { id: d.id, d: d.data() }; }); },
      get: async function (c, id) { var s = await F.getDoc(F.doc(db, c, id)); return s.exists() ? { id: id, d: s.data() } : null; },
      set: function (c, id, d) { return F.setDoc(F.doc(db, c, id), d); },
      del: function (c, id) { return F.deleteDoc(F.doc(db, c, id)); },
      count: async function (c, w) { return (await F.getCountFromServer(q(c, w))).data().count; },
      parts: async function (c, id) {
        var s = await F.getDocs(F.collection(db, c, id, "p"));
        return s.docs.map(function (d) { return d.data(); }).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.s; });
      },
      setParts: async function (c, id, arr) { for (var i = 0; i < arr.length; i++) await F.setDoc(F.doc(db, c, id, "p", "p" + i), { i: i, s: arr[i] }); },
      delParts: async function (c, id) {
        var s = await F.getDocs(F.collection(db, c, id, "p"));
        for (var i = 0; i < s.docs.length; i++) await F.deleteDoc(s.docs[i].ref);
      }
    };
  }
  var fsReady = root.DQ_FS_TEST ? Promise.resolve(root.DQ_FS_TEST) : initFirebase();
  fsReady.catch(function (e) { console.error("[dq-firebase] Firebase açılmadı:", e); });

  /* ---------- fetch tutucusu ---------- */
  var realFetch = root.fetch && root.fetch.bind(root);
  root.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) ? input.url : String(input);
    if (url.indexOf(SB) !== 0) return realFetch(input, init);
    var isReq = input && typeof input === "object" && typeof input.clone === "function";
    var method = ((init && init.method) || (isReq && input.method) || "GET").toUpperCase();
    var hd = (init && init.headers) || (isReq && input.headers) || null;
    var bp = init && init.body != null ? Promise.resolve(init.body)
      : (isReq && method !== "GET" && method !== "HEAD" ? input.clone().text() : Promise.resolve(null));
    return bp.then(function (b) { return handle(url, method, hd, b); }).catch(function (e) {
      console.error("[dq-firebase]", e);
      return J(500, { message: String((e && e.message) || e), code: "FIREBASE" });
    });
  };

  /* köçürmə səhifəsi üçün */
  root.DQFB = {
    ready: fsReady,
    importRow: async function (t, row) {
      row = normRow(t, row);
      if (row.id == null) row.id = newId();
      await save(t, row); return row.id;
    },
    ping: async function () {
      var FS = await fsReady;
      await FS.set("_ping", "1", { t: Date.now() });
      return !!(await FS.get("_ping", "1"));
    }
  };
})();
