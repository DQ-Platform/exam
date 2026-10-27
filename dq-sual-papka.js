/* =====================================================================
   DQ Sual Papkaları — dq-sual-papka.js?v=1
   Saytda yerləşdirilmiş BÜTÜN sualları fənn üzrə «papka» kimi göstərir:
     📁 Məntiq — 200 sual     [PDF-ə çevir]
     📁 Azərbaycan dili — 150 sual   [PDF-ə çevir]  ... və s.
   • Hər fənnin qarşısında «PDF-ə çevir» düyməsi (sınaq PDF-i ilə eyni dizayn:
     tünd mavi + qızılı, filqran, səhifə başlığı, cavab açarı).
   • Bir neçə fənni seçib birlikdə PDF etmək mümkündür.
   • Eyni sual bir neçə sınaqda/kateqoriyada təkrarlanırsa, bir dəfə sayılır
     («Təkrarları birləşdir» — söndürmək olar).
   • Mənbələr: sınaq sualları (exam_questions) + Sual Bankı papkaları (dqbank).
   Asılılıq: dq-pdf-secim.js (v2) — PDF qurucusu və önbaxış oradadır.
   Açılış: yalnız admin üçün 🗂️ düyməsi və admin panelindəki «Sual papkaları» kartı;
           kodla: DQPapka.open()
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQPapka) return;

  var D = document, NAVY = "#0b2a6b", GOLD = "#c9a063", Z = 2147483000;
  var LET = ["A", "B", "C", "D", "E"];
  var S = null;               /* vəziyyət */
  var CSS_ON = false;

  function $(i) { return D.getElementById(i); }
  function esc(x) {
    return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function sec() { return window.DQPdfSecim || null; }
  function db() { try { return typeof _supabase !== "undefined" ? _supabase : null; } catch (e) { return null; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("Server cavab vermədi (vaxt bitdi)")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  async function run(fn, tries) {
    tries = tries || 3;
    var last;
    for (var i = 0; i < tries; i++) {
      try {
        var r = await withTimeout(Promise.resolve(fn()), 25000);
        if (r && r.error) throw r.error;
        return (r && r.data) || [];
      } catch (e) { last = e; if (i < tries - 1) await sleep(700 * (i + 1)); }
    }
    throw last || new Error("Sorğu alınmadı");
  }
  function isAdmin() {
    try { return window.__dqAuthed === true || localStorage.getItem("dq_admin_logged") === "true"; } catch (e) { return false; }
  }

  /* ---------------- mətn normallaşdırma ---------------- */
  function plain(s) {
    s = String(s == null ? "" : s);
    s = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
    return s.replace(/\s+/g, " ").trim();
  }
  function fold(s) {
    return plain(s).toLowerCase().replace(/[^a-z0-9əöüğışçİ]+/g, "");
  }
  function subjName(raw, qn) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (s) return s;
    try { if (typeof getSubjectByNumber === "function" && qn) { var g = getSubjectByNumber(+qn); if (g) return g; } } catch (e) { }
    return "Digər";
  }
  function subjKey(n) { return String(n).toLowerCase().replace(/\s+/g, " ").trim(); }

  /* ---------------- bazadan sürətli siyahı (yüngül sütunlar) ---------------- */
  async function fetchExamLight(onProg) {
    var all = [], from = 0, STEP = 1000, guard = 0;
    while (guard++ < 60) {
      var rows = await run(function () {
        return db().from("exam_questions").select("id,exam_id,category,q_number,subject,question")
          .order("id", { ascending: true }).range(from, from + STEP - 1);
      });
      all = all.concat(rows);
      if (onProg) onProg(all.length);
      if (rows.length < STEP) break;
      from += STEP;
    }
    return all;
  }
  async function fetchBank() {
    try {
      if (typeof V2 === "undefined" || typeof V2.list !== "function") return [];
      return (await withTimeout(Promise.resolve(V2.list("dqbank")), 25000)) || [];
    } catch (e) { return []; }
  }

  /* ---------------- fənlərə bölmə + təkrarların birləşdirilməsi ---------------- */
  var CATORD = { BA: 0, BB: 1, AC: 2 };
  function build(exRows, bankRows, dedupe) {
    var map = {}, order = [], totalRaw = 0;
    function bucket(name) {
      var k = subjKey(name);
      if (!map[k]) { map[k] = { name: name, key: k, items: [], seen: {}, dup: 0, src: { exam: 0, bank: 0 }, where: {}, on: false }; order.push(map[k]); }
      return map[k];
    }
    exRows.slice().sort(function (a, b) {
      return (+a.exam_id || 0) - (+b.exam_id || 0) || ((CATORD[a.category] != null ? CATORD[a.category] : 9) - (CATORD[b.category] != null ? CATORD[b.category] : 9)) || (+a.q_number - +b.q_number);
    }).forEach(function (r) {
      totalRaw++;
      var b = bucket(subjName(r.subject, r.q_number)), f = fold(r.question);
      var key = f.length >= 20 ? "t:" + f : "i:" + r.id;
      var w = "Sınaq " + r.exam_id + " · " + r.category;
      b.where[w] = (b.where[w] || 0) + 1;
      if (dedupe && b.seen[key]) { b.dup++; return; }
      b.seen[key] = 1; b.src.exam++;
      b.items.push({ src: "exam", id: r.id, orig: +r.q_number, cat: r.category, exam: r.exam_id });
    });
    bankRows.forEach(function (r) {
      totalRaw++;
      var b = bucket(subjName(r.subject, 0)), f = fold(r.text);
      var key = f.length >= 20 ? "t:" + f : "b:" + r._id;
      b.where["Sual Bankı"] = (b.where["Sual Bankı"] || 0) + 1;
      if (dedupe && b.seen[key]) { b.dup++; return; }
      b.seen[key] = 1; b.src.bank++;
      b.items.push({ src: "bank", rec: r, orig: +r.num || 0 });
    });
    /* böyük papkalar yuxarıda */
    order.sort(function (a, b) { return b.items.length - a.items.length || a.name.localeCompare(b.name, "az"); });
    return { groups: order, raw: totalRaw };
  }

  /* ---------------- tam sualları yüklə (kiçik hissələrlə) ---------------- */
  function bankToQ(r) {
    var cor = r.correct;
    return {
      q_number: 0, question: r.text || "", image_url: r.img || null,
      options: (r.opts || []).map(function (o) { return { text: (o && o.text) || "", image: (o && o.img) || null }; }),
      correct: (typeof cor === "number") ? cor : cor, __open: false, __lim: (r.opts || []).length || 5
    };
  }
  async function fetchFull(items, onStep) {
    var ex = items.filter(function (i) { return i.src === "exam"; }), have = {}, done = 0;
    var chunks = [], SZ = 6, i;
    for (i = 0; i < ex.length; i += SZ) chunks.push(ex.slice(i, i + SZ));
    var idx = 0, fail = null, st = S;
    async function worker() {
      while (!fail && st && !st.cancel) {
        var my = idx++; if (my >= chunks.length) return;
        var ids = chunks[my].map(function (x) { return x.id; });
        try {
          var rows = await run(function () {
            return db().from("exam_questions").select("id,q_number,category,question,image_url,options,correct").in("id", ids);
          });
          rows.forEach(function (r) { have[r.id] = r; });
          done += ids.length; if (onStep) onStep(done, ex.length);
        } catch (e) { fail = e; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (fail) throw fail;
    if (!st || st.cancel) return null;
    var out = [];
    items.forEach(function (it) {
      if (it.src === "bank") { out.push(bankToQ(it.rec)); return; }
      var r = have[it.id]; if (!r) return;
      var q = Object.assign({}, r);
      q.__n = +r.q_number;
      q.__open = (r.category === "BA") && (function () { try { return Array.isArray(openQuestionIds) && openQuestionIds.indexOf(+r.q_number) > -1; } catch (e) { return false; } })();
      try { q.__lim = (typeof dqOptLim === "function") ? dqOptLim(+r.q_number) : 5; } catch (e) { q.__lim = 5; }
      out.push(q);
    });
    return out;
  }

  /* ---------------- PDF ---------------- */
  async function makePdf(names) {
    var sc = sec();
    if (!sc || sc.version < 2) { S.err = "PDF modulu (dq-pdf-secim.js v2) yüklənməyib. Səhifəni yeniləyin."; draw(); return; }
    var picks = S.groups.filter(function (g) { return names.indexOf(g.key) > -1; });
    if (!picks.length) return;
    var total = picks.reduce(function (a, g) { return a + g.items.length; }, 0);
    if (!total) { S.err = "Seçilmiş papkalarda sual yoxdur."; draw(); return; }
    var exTotal = picks.reduce(function (a, g) { return a + g.items.filter(function (x) { return x.src === "exam"; }).length; }, 0);
    S.stage = "make"; S.err = ""; S.done = 0; S.total = Math.max(1, exTotal); S.cancel = false; draw();
    var st = S, groups = [], base = 0;
    try {
      for (var gi = 0; gi < picks.length; gi++) {
        var g = picks[gi], baseDone = base;
        var qs = await fetchFull(g.items, function (d) {
          st.done = baseDone + d;
          var b = D.querySelector("#dqpp .ld"), p = D.querySelector("#dqpp .pg i");
          if (b) b.textContent = "Suallar hazırlanır… " + Math.min(st.done, st.total) + " / " + st.total;
          if (p) p.style.width = Math.round(Math.min(st.done, st.total) / st.total * 100) + "%";
        });
        if (S !== st || st.cancel || qs == null) return;
        base += g.items.filter(function (x) { return x.src === "exam"; }).length;
        st.done = base;
        qs.forEach(function (q, i) { q.q_number = i + 1; });      /* 1…N ardıcıl nömrələmə */
        if (qs.length) groups.push({ name: g.name, items: qs });
      }
    } catch (e) {
      S.stage = "list"; S.err = "Suallar tam yüklənmədi: " + (e && e.message || e) + ". Yenidən cəhd edin."; draw(); return;
    }
    if (!groups.length) { S.stage = "list"; S.err = "Sual tapılmadı."; draw(); return; }
    var n = groups.reduce(function (a, g) { return a + g.items.length; }, 0);
    var many = groups.length > 1;
    var title = many ? "Sual papkaları · " + groups.length + " fənn" : groups[0].name;
    var html;
    try {
      html = sc.buildDoc({
        exam: "", cat: "", mode: many ? "custom" : "all", groups: groups,
        opts: { key: S.opts.key, heads: many ? S.opts.heads : S.opts.heads, cols: S.opts.cols },
        title: title,
        sub: "Sual bazası · " + n + " sual · " + new Date().toLocaleDateString("az-AZ"),
        docName: "DQplatform-" + title.replace(/[^\wƏəİıÖöÜüŞşÇçĞğ]+/g, "-")
      });
    } catch (e) { S.stage = "list"; S.err = "PDF sənədi qurulmadı: " + (e && e.message || e); draw(); return; }
    S.stage = "list"; draw();
    sc.preview(html, title + " · " + n + " sual");
  }

  /* ---------------- üslub ---------------- */
  function css() {
    if (CSS_ON) return; CSS_ON = true;
    var s = D.createElement("style"); s.id = "dqpp-css";
    s.textContent =
      "#dqpp-ov{position:fixed;inset:0;z-index:" + Z + ";background:#eef1f8;overflow:auto;-webkit-overflow-scrolling:touch;font-family:Mulish,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2333}" +
      "#dqpp{max-width:760px;margin:0 auto;padding:0 12px 120px}" +
      "#dqpp .top{position:sticky;top:0;z-index:3;margin:0 -12px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 12px;background:linear-gradient(120deg," + NAVY + ",#173f94);color:#fff;border-bottom:3px solid " + GOLD + ";display:flex;align-items:center;gap:10px}" +
      "#dqpp .top h2{margin:0;font-size:18px;font-weight:800;flex:1;text-align:left;color:#fff}#dqpp .top small{display:block;font-weight:600;font-size:12px;color:#f1dcb8;margin-top:2px}" +
      "#dqpp .top button{border:0;border-radius:11px;padding:10px 13px;font:800 13.5px inherit;font-family:inherit;background:rgba(255,255,255,.16);color:#fff;cursor:pointer}" +
      "#dqpp .box{background:#fff;border:1px solid #dfe5f1;border-radius:16px;padding:12px 14px;margin:12px 0;box-shadow:0 2px 10px rgba(11,42,107,.06)}" +
      "#dqpp .opts{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font-size:14px}#dqpp .opts label{display:flex;align-items:center;gap:7px;cursor:pointer}" +
      "#dqpp input[type=checkbox]{width:19px;height:19px;accent-color:" + NAVY + "}#dqpp select{font:inherit;font-size:14px;border:1.5px solid #dfe2ee;border-radius:10px;padding:6px 8px;background:#fff}" +
      "#dqpp .srch{width:100%;border:1.5px solid #dfe2ee;border-radius:12px;padding:11px 13px;font:inherit;font-size:15px;background:#fff;margin:2px 0 0}" +
      "#dqpp .fd{background:#fff;border:1.5px solid #e1e6f2;border-radius:16px;margin:0 0 10px;overflow:hidden;box-shadow:0 2px 10px rgba(11,42,107,.05)}#dqpp .fd.on{border-color:" + NAVY + "}" +
      "#dqpp .fr{display:flex;align-items:center;gap:11px;padding:13px 12px}" +
      "#dqpp .ic{flex:none;width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#eaf0ff,#fff4e0);display:flex;align-items:center;justify-content:center;font-size:23px}" +
      "#dqpp .nm{flex:1;min-width:0;text-align:left;cursor:pointer}#dqpp .nm b{display:block;font-size:16px;color:" + NAVY + ";font-weight:800;overflow:hidden;text-overflow:ellipsis}" +
      "#dqpp .nm span{display:block;font-size:12.5px;color:#64748b;margin-top:2px}" +
      "#dqpp .go{flex:none;border:0;border-radius:12px;background:" + NAVY + ";color:#fff;font:800 13.5px inherit;font-family:inherit;padding:12px 13px;cursor:pointer;box-shadow:0 4px 12px rgba(11,42,107,.25)}#dqpp .go:disabled{opacity:.5}" +
      "#dqpp .dt{padding:0 14px 12px 67px;font-size:12.5px;color:#475569;text-align:left;line-height:1.7}#dqpp .dt i{font-style:normal;display:inline-block;background:#eef2fb;border-radius:8px;padding:1px 8px;margin:2px 4px 2px 0}" +
      "#dqpp .ld{text-align:center;padding:26px 8px;color:#475569;font-size:14px}#dqpp .pg{height:9px;border-radius:9px;background:#e6ebf6;overflow:hidden;margin:6px 0 8px}#dqpp .pg i{display:block;height:100%;width:0;background:linear-gradient(90deg," + NAVY + "," + GOLD + ");transition:width .25s}" +
      "#dqpp .err{background:#fff1f1;border:1px solid #f5c2c2;color:#b42318;border-radius:12px;padding:10px 12px;font-size:13px;margin:10px 0;text-align:left}" +
      "#dqpp .bar{position:fixed;left:0;right:0;bottom:0;z-index:4;background:#fff;border-top:1px solid #dfe5f1;padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 20px rgba(11,42,107,.12)}" +
      "#dqpp .bar .in{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:10px}#dqpp .bar p{margin:0;flex:1;font-size:13px;color:#475569;text-align:left}" +
      "#dqpp .bar button{border:0;border-radius:13px;background:" + NAVY + ";color:#fff;font:800 14.5px inherit;font-family:inherit;padding:13px 16px;cursor:pointer}#dqpp .bar button:disabled{opacity:.45}" +
      "#dqpp .bar button.g{background:#fff;color:" + NAVY + ";border:1.5px solid " + NAVY + "}" +
      "#dqpp .stats{display:flex;gap:8px;margin:12px 0 0}#dqpp .stats div{flex:1;background:#fff;border:1px solid #dfe5f1;border-radius:14px;padding:10px 6px;text-align:center}#dqpp .stats b{display:block;font-size:20px;color:" + NAVY + "}#dqpp .stats span{font-size:11.5px;color:#64748b}";
    D.head.appendChild(s);
  }

  /* ---------------- ekran ---------------- */
  function ov() {
    var o = $("dqpp-ov");
    if (!o) {
      css(); o = D.createElement("div"); o.id = "dqpp-ov";
      o.innerHTML = '<div id="dqpp"></div>';
      D.body.appendChild(o);
      o.addEventListener("click", onClick);
      o.addEventListener("change", onChange);
      o.addEventListener("input", onInput);
    }
    o.style.display = "block";
    return o;
  }
  function visible() {
    var q = (S.q || "").toLowerCase();
    return S.groups.filter(function (g) { return !q || g.name.toLowerCase().indexOf(q) > -1; });
  }
  function draw() {
    if (!S) return;
    var d = $("dqpp"); if (!d) return;
    var h = [], scr = d.parentNode.scrollTop;
    h.push('<div class="top"><h2>🗂️ Sual papkaları<small>Saytdakı bütün suallar fənn üzrə</small></h2><button type="button" data-a="refresh">↻ Yenilə</button><button type="button" data-a="close">⬅ Geri</button><button type="button" data-a="admin">🛠 Admin panel</button></div>');
    if (S.stage === "load") {
      h.push('<div class="ld">Suallar bazadan oxunur… ' + (S.n ? S.n + " sual" : "") + "</div>");
    } else if (S.stage === "make") {
      var pc = S.total ? Math.round(S.done / S.total * 100) : 0;
      h.push('<div class="box"><div class="ld">Suallar hazırlanır… ' + S.done + " / " + S.total + '</div><div class="pg"><i style="width:' + pc + '%"></i></div><div style="text-align:center"><button type="button" class="go" data-a="stop">Dayandır</button></div></div>');
    } else {
      if (S.err) h.push('<div class="err">' + esc(S.err) + "</div>");
      var tot = S.groups.reduce(function (a, g) { return a + g.items.length; }, 0), dup = S.groups.reduce(function (a, g) { return a + g.dup; }, 0);
      h.push('<div class="stats"><div><b>' + S.groups.length + "</b><span>papka (fənn)</span></div><div><b>" + tot + "</b><span>sual</span></div><div><b>" + dup + "</b><span>təkrar birləşdirildi</span></div></div>");
      h.push('<div class="box"><div class="opts">' +
        '<label><input type="checkbox" id="dqpp-dd"' + (S.dedupe ? " checked" : "") + '> Təkrarları birləşdir</label>' +
        '<label><input type="checkbox" id="dqpp-k"' + (S.opts.key ? " checked" : "") + '> Cavab açarı</label>' +
        '<label><input type="checkbox" id="dqpp-h"' + (S.opts.heads ? " checked" : "") + '> Fənn başlıqları</label>' +
        '<label>Sütun <select id="dqpp-c"><option value="2"' + (S.opts.cols === 2 ? " selected" : "") + '>2 sütun</option><option value="1"' + (S.opts.cols === 1 ? " selected" : "") + ">1 sütun</option></select></label>" +
        '<label><input type="checkbox" id="dqpp-bk"' + (S.useBank ? " checked" : "") + '> Sual Bankı papkaları daxil</label>' +
        '</div><input class="srch" id="dqpp-q" placeholder="🔍 Papka axtar…" value="' + esc(S.q) + '"></div>');
      var vis = visible();
      if (!vis.length) h.push('<div class="ld">' + (S.groups.length ? "Axtarışa uyğun papka yoxdur." : "Bazada sual tapılmadı.") + "</div>");
      vis.forEach(function (g) {
        var det = "";
        if (S.open[g.key]) {
          var w = Object.keys(g.where).sort(function (a, b) { return g.where[b] - g.where[a]; }).slice(0, 40);
          det = '<div class="dt">' + (w.length ? w.map(function (k) { return "<i>" + esc(k) + ": " + g.where[k] + "</i>"; }).join("") : "") +
            (g.dup ? "<br>♻️ " + g.dup + " təkrar sual bir dəfə sayılıb" : "") + "</div>";
        }
        var src = [];
        if (g.src.exam) src.push(g.src.exam + " sınaq");
        if (g.src.bank) src.push(g.src.bank + " bank");
        h.push('<div class="fd' + (g.on ? " on" : "") + '"><div class="fr"><input type="checkbox" data-k="' + esc(g.key) + '"' + (g.on ? " checked" : "") + ' aria-label="Seç">' +
          '<div class="ic">📁</div><div class="nm" data-o="' + esc(g.key) + '"><b>' + esc(g.name) + "</b><span>" + g.items.length + " sual" + (src.length ? " · " + src.join(" + ") : "") + (S.open[g.key] ? " ▴" : " ▾") + "</span></div>" +
          '<button type="button" class="go" data-g="' + esc(g.key) + '"' + (g.items.length ? "" : " disabled") + ">📄 PDF-ə çevir</button></div>" + det + "</div>");
      });
    }
    var sel = S.groups.filter(function (g) { return g.on; }), sn = sel.reduce(function (a, g) { return a + g.items.length; }, 0);
    if (S.stage === "list") {
      h.push('<div class="bar"><div class="in"><p>' + (sel.length ? "Seçilib: <b>" + sel.length + " fənn · " + sn + " sual</b>" : "Birdən çox fənni seçib birlikdə PDF edə bilərsiniz") + '</p><button type="button" class="g" data-a="all">Hamısı</button><button type="button" data-a="sel"' + (sel.length ? "" : " disabled") + ">Seçilənləri PDF-ə çevir</button></div></div>");
    }
    d.innerHTML = h.join("");
    d.parentNode.scrollTop = scr;
    var qi = $("dqpp-q"); if (qi && S.focusQ) { qi.focus(); try { qi.setSelectionRange(S.q.length, S.q.length); } catch (e) { } S.focusQ = false; }
  }
  function readOpts() {
    var k = $("dqpp-k"), hd = $("dqpp-h"), c = $("dqpp-c");
    if (k) S.opts.key = k.checked;
    if (hd) S.opts.heads = hd.checked;
    if (c) S.opts.cols = +c.value === 1 ? 1 : 2;
  }
  function onClick(e) {
    if (!S) return;
    var t = e.target.closest ? e.target.closest("[data-a],[data-g],[data-o]") : null;
    if (!t) return;
    readOpts();
    if (t.dataset.g) { makePdf([t.dataset.g]); return; }
    if (t.dataset.o) { S.open[t.dataset.o] = !S.open[t.dataset.o]; draw(); return; }
    var a = t.dataset.a;
    if (a === "close") { close(); try { if (window.DQNav) DQNav.toAdmin(); } catch (e) { } }
    else if (a === "admin") { close(); try { if (window.DQNav) DQNav.toAdmin(); } catch (e) { } }
    else if (a === "refresh") load(true);
    else if (a === "stop") { S.cancel = true; S.stage = "list"; draw(); }
    else if (a === "all") { var on = S.groups.some(function (g) { return !g.on; }); visible().forEach(function (g) { g.on = on; }); draw(); }
    else if (a === "sel") makePdf(S.groups.filter(function (g) { return g.on; }).map(function (g) { return g.key; }));
  }
  function onChange(e) {
    if (!S) return;
    var t = e.target;
    if (t.dataset && t.dataset.k != null) {
      var g = S.groups.filter(function (x) { return x.key === t.dataset.k; })[0]; if (g) g.on = t.checked; draw(); return;
    }
    if (t.id === "dqpp-dd") { S.dedupe = t.checked; readOpts(); regroup(); return; }
    if (t.id === "dqpp-bk") { S.useBank = t.checked; readOpts(); regroup(); return; }
    if (t.id === "dqpp-k" || t.id === "dqpp-h" || t.id === "dqpp-c") readOpts();
  }
  function onInput(e) {
    if (e.target.id === "dqpp-q") { S.q = e.target.value; S.focusQ = true; draw(); }
  }
  function regroup() {
    var keep = {};
    S.groups.forEach(function (g) { if (g.on) keep[g.key] = 1; });
    var r = build(S.ex, S.useBank ? S.bank : [], S.dedupe);
    r.groups.forEach(function (g) { g.on = !!keep[g.key]; });
    S.groups = r.groups; draw();
  }

  async function load(force) {
    S.stage = "load"; S.err = ""; S.n = 0; draw();
    try {
      if (!db()) throw new Error("Verilənlər bazası bağlantısı hazır deyil. Səhifəni yeniləyin.");
      var st = S;
      var ex = await fetchExamLight(function (n) { if (S === st) { S.n = n; var l = D.querySelector("#dqpp .ld"); if (l) l.textContent = "Suallar bazadan oxunur… " + n + " sual"; } });
      var bank = await fetchBank();
      if (S !== st) return;
      S.ex = ex; S.bank = bank;
      var r = build(ex, S.useBank ? bank : [], S.dedupe);
      S.groups = r.groups; S.stage = "list"; draw();
    } catch (e) {
      if (!S) return;
      S.stage = "list"; S.groups = []; S.err = "Suallar oxunmadı: " + (e && e.message || e); draw();
    }
  }

  function open() {
    if (!isAdmin()) { try { V2.toast("Bu bölmə yalnız admin üçündür"); } catch (e) { alert("Bu bölmə yalnız admin üçündür"); } return; }
    ov();
    S = { stage: "load", groups: [], ex: [], bank: [], dedupe: true, useBank: true, opts: { key: true, heads: true, cols: 2 }, open: {}, q: "", err: "", cancel: false };
    load();
  }
  function close() {
    if (S) S.cancel = true;
    var o = $("dqpp-ov"); if (o) o.style.display = "none";
    S = null;
  }

  /* ---------------- giriş nöqtələri (yalnız admin) ---------------- */
  function entries() {
    var show = isAdmin();
    var fab = $("dqpp-fab");
    if (show && !fab) {
      css();
      fab = D.createElement("button"); fab.id = "dqpp-fab"; fab.type = "button"; fab.textContent = "🗂️ Sual papkaları";
      fab.style.cssText = "position:fixed;left:12px;bottom:calc(62px + env(safe-area-inset-bottom,0px));z-index:" + (Z - 10) + ";border:0;border-radius:999px;background:" + NAVY + ";color:#fff;font:800 13px Mulish,system-ui,Arial,sans-serif;padding:11px 15px;box-shadow:0 6px 18px rgba(11,42,107,.35);cursor:pointer";
      fab.onclick = open;
      D.body.appendChild(fab);
    } else if (!show && fab) fab.remove();
    var g = D.querySelector("#admin-panel .admin-nav-grid");
    if (g && show && !$("dqpp-card")) {
      var c = D.createElement("div"); c.id = "dqpp-card"; c.className = "admin-nav-card"; c.setAttribute("role", "button"); c.tabIndex = 0;
      c.innerHTML = '<span class="icon">🗂️</span> Sual papkaları';
      c.onclick = open;
      c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
      g.appendChild(c);
    }
  }
  setInterval(function () { try { if (!D.hidden) entries(); } catch (e) { } }, 1500);
  try { if (new URLSearchParams(location.search).get("papka") === "1") setTimeout(function () { if (isAdmin()) open(); }, 2500); } catch (e) { }

  window.DQPapka = { open: open, close: close, _build: build, _fold: fold, version: 1 };
})();
