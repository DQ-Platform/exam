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
      name: String(pick(o, /^(name|ad_?soyad|full_?name|student(_name)?|ad)$/i) || ""),
      ok: pick(o, /^(correct|dogru|doğru|right)$/i),
      bad: pick(o, /^(wrong|yanlis|yanlış|incorrect)$/i),
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


  /* =====================================================================
   *  NƏTİCƏ MƏRKƏZİ — admin panelində «Digər alətlər» altında yeni bölmə
   *  İştirakçı · İş nömrəsi · Sınaq · Kateqoriya · Tarix · Müddət · Bal · Cavab kartı
   * ===================================================================== */
  var RC_CSS =
    "#dqrc{position:fixed;inset:0;z-index:100010;background:#eef3fb;overflow:auto;display:none;-webkit-overflow-scrolling:touch;color:#12285e;font-family:inherit;text-align:left}" +
    "#dqrc.on{display:block}" +
    ".dqrc-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px;background:linear-gradient(90deg,#0a2f7a,#2f63bd);color:#fff}" +
    ".dqrc-top h3{margin:0;font-size:18px;color:#fff;text-align:left;flex:1;min-width:160px}" +
    ".dqrc-bk,.dqrc-btn{border:0;border-radius:999px;padding:9px 16px;font:700 13px inherit;font-family:inherit;cursor:pointer;background:#ffffff2e;color:#fff}" +
    ".dqrc-btn.d{background:#0a2f7a;color:#fff;border-radius:10px;padding:7px 12px}" +
    ".dqrc-w{max-width:1180px;margin:0 auto;padding:16px 14px 60px}" +
    ".dqrc-st{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}" +
    ".dqrc-st div{background:#fff;border:1px solid #dbe5f6;border-left:4px solid #d9a441;border-radius:14px;padding:12px 14px}" +
    ".dqrc-st small{display:block;color:#64748b;font-size:12px;font-weight:700}.dqrc-st b{display:block;font-size:22px;color:#0a2f7a;margin-top:2px}" +
    ".dqrc-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}" +
    ".dqrc-in{padding:10px 12px;border:1.5px solid #c9d6ee;border-radius:10px;font:14px inherit;font-family:inherit;background:#fff;min-width:0}" +
    ".dqrc-in:focus{outline:none;border-color:#2f63bd;box-shadow:0 0 0 3px #2f63bd26}" +
    ".dqrc-s{flex:1 1 220px}" +
    ".dqrc-chip{border:1.5px solid #c9d6ee;background:#fff;color:#0a2f7a;border-radius:999px;padding:7px 14px;font:700 12.5px inherit;font-family:inherit;cursor:pointer}" +
    ".dqrc-chip.on{background:#0a2f7a;border-color:#0a2f7a;color:#fff}" +
    ".dqrc-tw{background:#fff;border:1px solid #dbe5f6;border-radius:16px;overflow:auto;box-shadow:0 4px 18px #0a2f7a14}" +
    ".dqrc-tw table{width:100%;min-width:900px;border-collapse:collapse;margin:0;font-size:13.5px}" +
    ".dqrc-tw th{position:sticky;top:0;background:#0a2f7a;color:#fff;padding:12px 10px;font-size:12.5px;letter-spacing:.3px;white-space:nowrap;border:0}" +
    ".dqrc-tw td{padding:11px 10px;border:0;border-bottom:1px solid #eef2f7;text-align:center;vertical-align:middle}" +
    ".dqrc-tw tbody tr:hover{background:#f5f8fe}" +
    ".dqrc-cat{display:inline-block;padding:3px 10px;border-radius:7px;background:#e0e7ff;color:#3730a3;font-weight:800;font-size:12px}" +
    ".dqrc-cat.BB{background:#ccfbf1;color:#0f766e}.dqrc-cat.AC{background:#fef3c7;color:#b45309}" +
    ".dqrc-n{color:#94a3b8;font-weight:700}" +
    ".dqrc-empty{padding:34px 12px;text-align:center;color:#64748b}" +
    ".dqrc-pill{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:100020;border:0;border-radius:999px;padding:11px 20px;background:#0a2f7a;color:#fff;font:800 13px inherit;font-family:inherit;box-shadow:0 8px 22px #0a2f7a66;cursor:pointer;display:none}" +
    ".dqrc-pill.on{display:block}" +
    ".dqrc-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100030;background:#0f172a;color:#fff;padding:11px 18px;border-radius:12px;font-weight:600;font-size:13.5px}";
  var rcs = document.createElement("style"); rcs.id = "dqrc-css"; rcs.textContent = RC_CSS; document.head.appendChild(rcs);

  var RC = { rows: [], f: { q: "", cat: "", exam: "", sort: "new" }, root: null, pill: null };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function rcToast(m) {
    var d = document.createElement("div"); d.className = "dqrc-toast"; d.textContent = m; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2800);
  }
  function properName(s) {
    return String(s).trim().split(/\s+/).map(function (w) { return w.charAt(0).toLocaleUpperCase("az") + w.slice(1).toLocaleLowerCase("az"); }).join(" ");
  }

  /* admin panelindəki mövcud nəticə cədvəlindən (cavab kartı düymələri ilə birlikdə) oxu */
  function scrapeDom() {
    var out = [];
    [].forEach.call(document.querySelectorAll("#full-participants-list tr"), function (tr) {
      var c = tr.children; if (c.length < 8) return;
      var fin = up(c[1].textContent); if (fin.length < 4) return;
      out.push({ name: c[0].textContent, fin: fin, exam: (c[2].textContent.match(/\d+/) || [""])[0], cat: up(c[3].textContent),
        ok: parseFloat(c[4].textContent), bad: parseFloat(c[5].textContent), score: parseFloat(c[6].textContent) });
    });
    return out;
  }
  function buildRows() {
    return load(true).then(function (db) {
      var base = db.filter(function (r) { return r.name; });
      if (!base.length) base = scrapeDom();
      RC.rows = base.map(function (r) {
        var m = r.at !== undefined ? r : (find(db, r.fin, r.exam, [r.cat]) || {});
        var sc = r.score != null && !isNaN(r.score) ? r.score : null;
        return {
          name: properName(r.name || "—"), fin: r.fin, exam: r.exam, cat: r.cat,
          ok: r.ok != null && r.ok !== "" ? +r.ok : null, bad: r.bad != null && r.bad !== "" ? +r.bad : null,
          score: sc, at: m.at || null, dur: m.dur != null ? m.dur : null
        };
      });
      render();
    });
  }

  function visible() {
    var f = RC.f, q = norm(f.q);
    var list = RC.rows.filter(function (r) {
      return (!q || norm(r.name).indexOf(q) > -1 || norm(r.fin).indexOf(q) > -1) && (!f.cat || r.cat === f.cat) && (!f.exam || r.exam === f.exam);
    });
    var by = {
      new: function (a, b) { return (b.at || 0) - (a.at || 0); },
      hi: function (a, b) { return (b.score || 0) - (a.score || 0); },
      lo: function (a, b) { return (a.score == null) - (b.score == null) || (a.score || 0) - (b.score || 0); },
      az: function (a, b) { return a.name.localeCompare(b.name, "az"); }
    };
    return list.sort(by[f.sort] || by.new);
  }

  function render() {
    if (!RC.root) return;
    var all = RC.rows, list = visible();
    var sc = list.filter(function (r) { return r.score != null; }), du = list.filter(function (r) { return r.dur != null; });
    var avg = sc.length ? (sc.reduce(function (s, r) { return s + r.score; }, 0) / sc.length) : null;
    var avgD = du.length ? du.reduce(function (s, r) { return s + r.dur; }, 0) / du.length : null;
    var cats = [], exams = [];
    all.forEach(function (r) { if (r.cat && cats.indexOf(r.cat) < 0) cats.push(r.cat); if (r.exam && exams.indexOf(r.exam) < 0) exams.push(r.exam); });
    exams.sort(function (a, b) { return a - b; });
    var h = '<div class="dqrc-st">' +
      '<div><small>Nəticə sayı</small><b>' + list.length + "</b></div>" +
      '<div><small>Orta bal</small><b>' + (avg != null ? avg.toFixed(1) : "—") + "</b></div>" +
      '<div><small>Ən yüksək bal</small><b>' + (sc.length ? Math.max.apply(null, sc.map(function (r) { return r.score; })) : "—") + "</b></div>" +
      '<div><small>Orta müddət</small><b style="font-size:17px">' + (avgD != null ? fmtDur(avgD) : "—") + "</b></div></div>" +
      '<div class="dqrc-tools"><input class="dqrc-in dqrc-s" id="dqrc-q" type="search" placeholder="🔎 Ad və ya iş nömrəsi ilə axtar…" value="' + esc(RC.f.q) + '">' +
      '<select class="dqrc-in" id="dqrc-ex"><option value="">Bütün sınaqlar</option>' + exams.map(function (e) { return '<option value="' + e + '"' + (RC.f.exam === e ? " selected" : "") + ">Sınaq " + e + "</option>"; }).join("") + "</select>" +
      '<select class="dqrc-in" id="dqrc-so">' + [["new", "Ən yeni əvvəl"], ["hi", "Bal: yüksəkdən aşağı"], ["lo", "Bal: aşağıdan yuxarı"], ["az", "Ad: A–Z"]].map(function (o) { return '<option value="' + o[0] + '"' + (RC.f.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
      '<button class="dqrc-btn d" id="dqrc-csv" type="button">⬇ CSV</button><button class="dqrc-btn d" id="dqrc-rf" type="button">⟳ Yenilə</button></div>' +
      '<div class="dqrc-tools"><button class="dqrc-chip' + (RC.f.cat ? "" : " on") + '" data-cat="">Hamısı</button>' +
      cats.map(function (c) { return '<button class="dqrc-chip' + (RC.f.cat === c ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>";
    h += '<div class="dqrc-tw"><table><thead><tr><th>№</th><th>Ad Soyad</th><th>İş nömrəsi</th><th>Sınaq</th><th>Kateqoriya</th><th>İştirak tarixi</th><th>Müddət</th><th>Doğru</th><th>Yanlış</th><th>Bal</th><th>Cavab kartı</th></tr></thead><tbody>';
    if (!list.length) h += '<tr><td colspan="11" class="dqrc-empty">' + (all.length ? "Filtrə uyğun nəticə yoxdur." : "Nəticə tapılmadı. Verilənlər bazası ilə əlaqə yoxdur və ya hələ iştirakçı yoxdur.") + "</td></tr>";
    list.forEach(function (r, i) {
      var f = r.at ? fmtDate(r.at) : null, none = '<span class="dqx-none">—</span>';
      h += "<tr><td class=\"dqrc-n\">" + (i + 1) + "</td><td class=\"dqx-name\" style=\"text-align:left\">" + esc(r.name) + "</td>" +
        '<td><span class="dqx-code">' + esc(r.fin) + "</span></td><td>" + (r.exam ? "Sınaq " + esc(r.exam) : "—") + "</td>" +
        "<td>" + (r.cat ? '<span class="dqrc-cat ' + esc(r.cat) + '">' + esc(r.cat) + "</span>" : "—") + "</td>" +
        "<td>" + (f ? '<div class="dqx-date"><b>' + f.d + "</b><small>" + f.t + "</small></div>" : none) + "</td>" +
        "<td>" + (r.dur != null ? '<span class="dqx-dur">⏱ ' + fmtDur(r.dur) + "</span>" : none) + "</td>" +
        '<td><span class="dqx-ok">' + (r.ok != null ? r.ok : "—") + '</span></td><td><span class="dqx-bad">' + (r.bad != null ? r.bad : "—") + "</span></td>" +
        "<td>" + (r.score != null ? '<span class="dqx-score ' + scoreCls(r.score) + '">' + r.score + "</span>" : none) + "</td>" +
        '<td><button type="button" class="dqrc-btn d" data-card="' + esc(r.fin) + "|" + esc(r.exam) + "|" + esc(r.cat) + '">📄 Cavab kartı</button></td></tr>';
    });
    h += "</tbody></table></div>";
    var keep = document.activeElement && document.activeElement.id === "dqrc-q";
    RC.root.querySelector(".dqrc-w").innerHTML = h;
    if (keep) { var q = RC.root.querySelector("#dqrc-q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  function cardBtn(fin, exam, cat) {
    var trs = document.querySelectorAll("#full-participants-list tr");
    for (var i = 0; i < trs.length; i++) {
      var c = trs[i].children; if (c.length < 8) continue;
      if (up(c[1].textContent) !== fin) continue;
      if (exam && (c[2].textContent.match(/\d+/) || [""])[0] !== exam) continue;
      if (cat && up(c[3].textContent) !== cat) continue;
      var b = [].filter.call(trs[i].querySelectorAll("button"), function (x) { return /cavablar/i.test(x.textContent); })[0];
      if (b) return b;
    }
    return null;
  }
  function openCard(fin, exam, cat, tries) {
    var b = cardBtn(fin, exam, cat);
    if (b) {
      RC.root.classList.remove("on"); RC.pill.classList.add("on");
      setTimeout(function () { b.click(); }, 60);
      return;
    }
    if (!tries && typeof window.switchAdminTab === "function") { try { window.switchAdminTab("siyahi"); } catch (e) {} }
    if ((tries || 0) < 6) return setTimeout(function () { openCard(fin, exam, cat, (tries || 0) + 1); }, 450);
    rcToast("Cavab kartı tapılmadı. «İştirakçılar & Nəticələr» bölməsini bir dəfə açın və yenidən cəhd edin.");
  }

  function csv() {
    var rows = [["Ad Soyad", "İş nömrəsi", "Sınaq", "Kateqoriya", "İştirak tarixi", "Müddət", "Doğru", "Yanlış", "Bal"]];
    visible().forEach(function (r) {
      var f = r.at ? fmtDate(r.at) : null;
      rows.push([r.name, r.fin, r.exam, r.cat, f ? f.d + " " + f.t : "", r.dur != null ? fmtDur(r.dur) : "", r.ok, r.bad, r.score].map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }));
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map(function (r) { return r.join(";"); }).join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "netice-merkezi.csv"; document.body.appendChild(a); a.click(); a.remove();
  }

  function mount() {
    if (RC.root) return;
    var r = document.createElement("div"); r.id = "dqrc"; r.setAttribute("role", "dialog"); r.setAttribute("aria-label", "Nəticə Mərkəzi");
    r.innerHTML = '<div class="dqrc-top"><button class="dqrc-bk" type="button" data-x="1">← Panelə qayıt</button><h3>📈 Nəticə Mərkəzi — iştirakçı nəticələri</h3></div><div class="dqrc-w"></div>';
    document.body.appendChild(r); RC.root = r;
    var p = document.createElement("button"); p.type = "button"; p.className = "dqrc-pill"; p.textContent = "← Nəticə Mərkəzinə qayıt";
    document.body.appendChild(p); RC.pill = p;
    p.onclick = function () { p.classList.remove("on"); r.classList.add("on"); };
    r.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("[data-x]")) { r.classList.remove("on"); document.body.style.overflow = ""; return; }
      var ch = t.closest(".dqrc-chip"); if (ch) { RC.f.cat = ch.getAttribute("data-cat"); render(); return; }
      var cb = t.closest("[data-card]"); if (cb) { var a = cb.getAttribute("data-card").split("|"); openCard(a[0], a[1], a[2]); return; }
      if (t.closest("#dqrc-csv")) return csv();
      if (t.closest("#dqrc-rf")) { rcToast("Yenilənir…"); return buildRows(); }
    });
    r.addEventListener("input", function (e) { if (e.target.id === "dqrc-q") { RC.f.q = e.target.value; render(); } });
    r.addEventListener("change", function (e) {
      if (e.target.id === "dqrc-ex") { RC.f.exam = e.target.value; render(); }
      if (e.target.id === "dqrc-so") { RC.f.sort = e.target.value; render(); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && r.classList.contains("on")) r.classList.remove("on"); });
  }
  window.DQResultsHub = {
    open: function () {
      if (window.DQAdminGate && !DQAdminGate.is()) return;
      mount(); RC.pill.classList.remove("on"); RC.root.classList.add("on");
      RC.root.querySelector(".dqrc-w").innerHTML = '<div class="dqrc-empty">Yüklənir…</div>';
      buildRows();
    }
  };

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
