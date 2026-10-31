/*!
 * DQ Platform — Resepşn: "Son verilən icazələr" cədvəlinə
 * «İştirak tarixi · Müddət · Bal» sütunlarını əlavə edir.
 *
 * Qoşulması: index.html-də dq-resepsiya.js-dən SONRA
 *   <script src="dq-resepsiya-netice.js?v=1"></script>
 *
 * Mövcud kodu dəyişmir: cədvəl özü yenidən çəkiləndə də sütunlar avtomatik bərpa olunur.
 * Nəticələr Supabase-dən oxunur (window._supabase), uyğun cədvəl/kolleksiya avtomatik tapılır.
 * Yoxlama: konsolda  DQReceptionStats.info()
 */
(function () {
  "use strict";
  if (window.DQReceptionStats) return;

  /* ---------- Ayarlar (lazım olsa yalnız bunu dəyişin) ---------- */
  var CFG = {
    tables: ["exam_results", "results", "student_results", "exam_attempts", "attempts"],
    collections: ["results", "exam_results", "attempts", "natice", "netice"],
    storeTable: "dq_v2_store",
    limit: 5000,
    ttl: 60000,                       // nəticələr 60 san keşlənir
    empty: "—"
  };

  /* ---------- Stil ---------- */
  var css =
    ".dqx-th{white-space:nowrap}" +
    ".dqx-td{white-space:nowrap;font-variant-numeric:tabular-nums}" +
    ".dqx-date b{display:block;font-weight:700;color:#0a2f7a;font-size:12.5px;line-height:1.25}" +
    ".dqx-date small{display:block;color:#64748b;font-size:11px;font-weight:600}" +
    ".dqx-dur{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:#eaf1fc;color:#0a2f7a;font-weight:700;font-size:12px}" +
    ".dqx-score{display:inline-block;min-width:44px;padding:3px 10px;border-radius:8px;font-weight:800;font-size:13px;color:#fff;background:#64748b}" +
    ".dqx-score.hi{background:#059669}.dqx-score.mid{background:#d97706}.dqx-score.lo{background:#dc2626}" +
    ".dqx-ok{color:#059669;font-weight:800}.dqx-bad{color:#dc2626;font-weight:800}" +
    ".dqx-name{font-weight:700;color:#0f172a;text-align:left}" +
    ".dqx-code{font-family:ui-monospace,Consolas,monospace;letter-spacing:.8px;font-weight:700;color:#334155}" +
    ".dqx-none{display:inline-block;padding:3px 9px;border-radius:999px;background:#f1f5f9;color:#94a3b8;font-weight:700;font-size:11.5px}";
  var st = document.createElement("style");
  st.id = "dqx-resepsiya-css";
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- Köməkçilər ---------- */
  var norm = function (s) { return String(s == null ? "" : s).trim().toLowerCase(); };
  var up = function (s) { return String(s == null ? "" : s).trim().toUpperCase(); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };

  function toMs(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return v < 1e11 ? v * 1000 : v;
    if (/^\d+(\.\d+)?$/.test(String(v))) return toMs(parseFloat(v));
    var t = Date.parse(v);
    return isNaN(t) ? null : t;
  }
  function fmtDate(ms) {
    var d = new Date(ms);
    return { d: pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear(), t: pad(d.getHours()) + ":" + pad(d.getMinutes()) };
  }
  function fmtDur(sec) {
    sec = Math.round(sec);
    if (!(sec >= 0)) return null;
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + " saat " + m + " dəq";
    if (m) return m + " dəq " + (s ? s + " san" : "");
    return s + " san";
  }

  /* Sətirdəki açarları adlarına görə tanıyır (sahə adları bilinmədiyi üçün) */
  function pick(o, re) {
    for (var k in o) if (re.test(k) && o[k] != null && o[k] !== "" && typeof o[k] !== "object") return o[k];
    return null;
  }
  function normalize(row) {
    var o = row && row.data && typeof row.data === "object" ? Object.assign({ created_at: row.created_at }, row.data) : row;
    if (!o) return null;
    var fin = pick(o, /^(fin|code|work_?no|is_?nomresi|iş.*nömrə.*|student_?(fin|code)|token)$/i);
    if (!fin) return null;
    var start = toMs(pick(o, /^(started?(_at)?|start(_time|ed_at)?|begin\w*|ts|date|time|created_at)$/i));
    var end = toMs(pick(o, /^(finish\w*|end(ed)?(_at)?|submitted(_at)?|completed(_at)?)$/i));
    var dur = pick(o, /^(duration(_sec\w*)?|elapsed\w*|time_?spent|spent|sure|müddət|seconds|secs)$/i);
    dur = dur != null ? parseFloat(dur) : null;
    if (dur != null && dur > 10000) dur = dur / 1000;         // ms ehtimalı
    if (dur == null && start && end && end > start) dur = (end - start) / 1000;
    var score = pick(o, /^(score|bal|total(_score)?|yekun(_bal)?|points)$/i);
    return {
      fin: up(fin),
      exam: String(pick(o, /^(exam(_id|_no)?|sinaq|sınaq)$/i) || "").replace(/\D/g, ""),
      cat: up(pick(o, /^(cat(egory)?|kateqoriya)$/i) || ""),
      at: end || start,
      dur: dur,
      score: score != null ? parseFloat(score) : null
    };
  }

  /* ---------- Məlumat mənbəyi ---------- */
  var cache = { rows: null, at: 0, source: null, p: null };

  function sb() { return window._supabase && window._supabase.from ? window._supabase : null; }

  function tryTable(name) {
    return sb().from(name).select("*").limit(CFG.limit).then(function (r) {
      if (r.error || !r.data || !r.data.length) return null;
      var rows = r.data.map(normalize).filter(Boolean);
      return rows.length ? { source: name, rows: rows } : null;
    }, function () { return null; });
  }
  function tryCollection(name) {
    return sb().from(CFG.storeTable).select("*").eq("collection", name).order("id", { ascending: false }).limit(CFG.limit)
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) return null;
        var rows = r.data.map(normalize).filter(Boolean);
        return rows.length ? { source: CFG.storeTable + ":" + name, rows: rows } : null;
      }, function () { return null; });
  }
  function firstHit(list, fn) {
    return list.reduce(function (p, n) {
      return p.then(function (hit) { return hit || fn(n); });
    }, Promise.resolve(null));
  }
  function load(force) {
    if (!sb()) return Promise.resolve(cache.rows || []);
    if (!force && cache.rows && Date.now() - cache.at < CFG.ttl) return Promise.resolve(cache.rows);
    if (cache.p) return cache.p;
    cache.p = (cache.source
      ? (cache.source.indexOf(":") > -1 ? tryCollection(cache.source.split(":")[1]) : tryTable(cache.source))
      : Promise.resolve(null))
      .then(function (hit) { return hit || firstHit(CFG.tables, tryTable); })
      .then(function (hit) { return hit || firstHit(CFG.collections, tryCollection); })
      .then(function (hit) {
        cache.rows = hit ? hit.rows : (cache.rows || []);
        cache.source = hit ? hit.source : cache.source;
        cache.at = Date.now();
        cache.p = null;
        return cache.rows;
      }, function () { cache.p = null; return cache.rows || []; });
    return cache.p;
  }

  function find(rows, fin, exam, cats) {
    var best = null;
    rows.forEach(function (r) {
      if (r.fin !== fin) return;
      var score = 1;
      if (exam && r.exam && r.exam === exam) score += 2;
      if (r.cat && cats.indexOf(r.cat) > -1) score += 2;
      if (exam && r.exam && r.exam !== exam) score -= 2;
      if (r.cat && cats.length && cats.indexOf(r.cat) < 0) score -= 2;
      if (score < 1) return;
      if (!best || score > best.s || (score === best.s && (r.at || 0) > (best.r.at || 0))) best = { r: r, s: score };
    });
    return best && best.r;
  }

  /* ---------- Cədvəlin zənginləşdirilməsi ---------- */
  function kind(tb) {
    var th = [].map.call(tb.querySelectorAll("thead th"), function (x) { return norm(x.textContent); });
    if (th.length < 4 || th.indexOf("iştirak tarixi") > -1 || !th.some(function (t) { return t.indexOf("iş nömrəsi") > -1; })) return null;
    if (th.some(function (t) { return t.indexOf("redakt") > -1; })) return "perm";
    if (th.indexOf("doğru") > -1 && th.indexOf("yanlış") > -1 && th.indexOf("bal") > -1 && th.length <= 7) return "res";
    return null;
  }
  function addHeaders(tb, k) {
    var tr = tb.querySelector("thead tr"), ths = tr.querySelectorAll("th"), cs = ths[0];
    var ref = k === "perm" ? tr.lastElementChild : [].filter.call(ths, function (x) { return norm(x.textContent) === "doğru"; })[0];
    (k === "perm" ? ["İştirak tarixi", "Müddət", "Bal"] : ["İştirak tarixi", "Müddət"]).forEach(function (t) {
      var th = document.createElement("th");
      th.className = "dqx-th";
      th.textContent = t;
      if (cs && cs.getAttribute("style")) th.setAttribute("style", cs.getAttribute("style"));
      tr.insertBefore(th, ref);
    });
    tb.setAttribute("data-dqx", k);
  }
  function cell(html, cls) {
    var td = document.createElement("td");
    td.className = "dqx-td " + (cls || "");
    td.style.textAlign = "center";
    td.innerHTML = html;
    return td;
  }
  function scoreCls(v) { return v >= 70 ? "hi" : v >= 40 ? "mid" : "lo"; }

  function fillRow(tr, rows, k) {
    if (k === "res") return fillRes(tr, rows);
    var tds = tr.children;
    if (tds.length < 5 || tr.getAttribute("data-dqx-row")) return;
    var fin = up(tds[1].textContent), exam = String(tds[2].textContent).replace(/\D/g, "");
    if (!fin || fin.length < 4) return;
    var cats = up(tds[3].textContent).split(/[\s,;/]+/).filter(Boolean);
    var r = find(rows, fin, exam, cats), last = tr.lastElementChild, none = '<span class="dqx-none">' + CFG.empty + "</span>";
    var dateC, durC, scoreC;
    if (r) {
      var f = r.at ? fmtDate(r.at) : null, dur = r.dur != null ? fmtDur(r.dur) : null;
      dateC = cell(f ? "<div class=\"dqx-date\"><b>" + f.d + "</b><small>" + f.t + "</small></div>" : none);
      durC = cell(dur ? '<span class="dqx-dur">⏱ ' + dur + "</span>" : none);
      scoreC = cell(r.score != null && !isNaN(r.score) ? '<span class="dqx-score ' + scoreCls(r.score) + '">' + r.score + "</span>" : none);
    } else {
      var np = '<span class="dqx-none">Qatılmayıb</span>';
      dateC = cell(np); durC = cell(none); scoreC = cell(none);
    }
    tr.insertBefore(dateC, last); tr.insertBefore(durC, last); tr.insertBefore(scoreC, last);
    tr.setAttribute("data-dqx-row", "1");
  }

  function properName(s) {
    return String(s).trim().split(/\s+/).map(function (w) {
      return w.charAt(0).toLocaleUpperCase("az") + w.slice(1).toLocaleLowerCase("az");
    }).join(" ");
  }
  function fillRes(tr, rows) {
    var tds = tr.children;
    if (tds.length < 6 || tr.getAttribute("data-dqx-row")) return;
    var fin = up(tds[1].textContent);
    if (!fin || fin.length < 4) return;
    var sn = tds[2].textContent, exam = (sn.match(/\d+/) || [""])[0], cm = sn.match(/\(([^)]+)\)/), cats = cm ? up(cm[1]).split(/[\s,;/]+/) : [];
    var r = find(rows, fin, exam, cats), none = '<span class="dqx-none">' + CFG.empty + "</span>";
    tds[0].textContent = properName(tds[0].textContent); tds[0].className += " dqx-name";
    tds[1].innerHTML = '<span class="dqx-code">' + fin + "</span>";
    var ok = parseFloat(tds[3].textContent), bad = parseFloat(tds[4].textContent), sc = parseFloat(tds[5].textContent);
    tds[3].innerHTML = '<span class="dqx-ok">' + (isNaN(ok) ? tds[3].textContent : ok) + "</span>";
    tds[4].innerHTML = '<span class="dqx-bad">' + (isNaN(bad) ? tds[4].textContent : bad) + "</span>";
    if (!isNaN(sc)) tds[5].innerHTML = '<span class="dqx-score ' + scoreCls(sc) + '">' + sc + "</span>";
    var f = r && r.at ? fmtDate(r.at) : null, dur = r && r.dur != null ? fmtDur(r.dur) : null;
    var dc = cell(f ? '<div class="dqx-date"><b>' + f.d + "</b><small>" + f.t + "</small></div>" : none);
    var uc = cell(dur ? '<span class="dqx-dur">⏱ ' + dur + "</span>" : none);
    tr.insertBefore(dc, tds[3]); tr.insertBefore(uc, tds[3]);
    tr.setAttribute("data-dqx-row", "1");
  }

  function enrich() {
    [].forEach.call(document.querySelectorAll("table"), function (tb) {
      var k = tb.getAttribute("data-dqx");
      if (!k) { k = kind(tb); if (k) addHeaders(tb, k); }
      if (k) {
        var pending = [].filter.call(tb.querySelectorAll("tbody tr"), function (tr) { return !tr.getAttribute("data-dqx-row"); });
        if (pending.length) load().then(function (rows) { pending.forEach(function (tr) { fillRow(tr, rows, k); }); });
      }
    });
  }

  var timer = null;
  new MutationObserver(function () {
    clearTimeout(timer);
    timer = setTimeout(enrich, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
  enrich();

  window.DQReceptionStats = {
    refresh: function () {
      return load(true).then(function () {
        [].forEach.call(document.querySelectorAll("tr[data-dqx-row]"), function (tr) {
          tr.removeAttribute("data-dqx-row");
          [].slice.call(tr.querySelectorAll("td.dqx-td")).forEach(function (c) { c.remove(); });
        });
        enrich();
      });
    },
    info: function () { return { source: cache.source, rows: (cache.rows || []).length, sample: (cache.rows || [])[0] || null }; }
  };
})();
