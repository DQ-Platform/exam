/* DQ Platform — dq-birlesdirme.js (v1)
   Testlər V2 (sual idxalı) + Testlər idarəsi + Karusel (fənn testləri) BİRLƏŞDİRMƏSİ.
   · Sual idxalı paneli artıq «Fənn → Mövzu» seçir və sualları birbaşa karusel kataloquna (krs_catalogue) yazır.
   · «Testlər idarəsi»ndə «➕ Sual əlavə et» eyni panelə fənn/mövzunu öncədən doldurub açır.
   · Ana səhifədə «Günün tövsiyə testi» hər gün karuseldəki mövzulardan təsadüfi (hamı üçün eyni) seçilir.
   app.js?v=27 (TLX.begin / TLX.daily) tələb olunur. */
(function () {
  "use strict";
  if (window.DQB) return;
  var COL = "krs_catalogue", CACHE = "krs_cache_v1", D = document, LET = "ABCDEF";
  var PAL = [["#7c3aed", "#4c1d95"], ["#2f63bd", "#0a2f7a"], ["#059669", "#065f46"], ["#ea580c", "#7c2d12"], ["#db2777", "#831843"], ["#0891b2", "#164e63"], ["#ca8a04", "#713f12"], ["#dc2626", "#7f1d1d"]];
  var $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  var low = function (s) { return String(s || "").trim().toLowerCase(); };
  var S = { cat: null, sub: "", top: "", busy: false };

  /* ---------- kataloq (karusel) ---------- */
  function seed() {
    return clone((window.TLX && TLX.subjects || []).map(function (s) {
      return { name: s.name, icon: s.icon, c1: s.grad[0], c2: s.grad[1], acc: s.acc,
        topics: (s.topics || []).map(function (t) { return { name: t.name, count: t.count || 0, time: t.time || 0, qs: t.questions || [] }; }) };
    }));
  }
  async function fetchCat() {
    await V2.probe();
    var r = (await V2.list(COL))[0];
    var subs = r && Array.isArray(r.subjects) ? clone(r.subjects) : (window.KRS_DATA && window.KRS_DATA.subjects ? clone(window.KRS_DATA.subjects) : seed());
    subs.forEach(function (s) { s.topics = s.topics || []; s.topics.forEach(function (t) { t.qs = t.qs || []; }); });
    return { id: r ? r._id : null, subjects: subs };
  }
  async function pushCat(cat) {
    var d = { subjects: cat.subjects, v: 2, at: new Date().toISOString() };
    await V2.put(COL, d, cat.id || undefined);
    if (!cat.id) { var r = (await V2.list(COL))[0]; cat.id = r && r._id; }
    window.KRS_DATA = { subjects: d.subjects };
    try { localStorage.setItem(CACHE, JSON.stringify({ subjects: d.subjects })); } catch (e) { }
    if (window.TLX && TLX.refresh) TLX.refresh();
  }
  function light(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return "#c4b5fd";
    var n = parseInt(m[1], 16), f = function (v) { return Math.round(v + (255 - v) * .55); };
    return "#" + [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return ("0" + f(v).toString(16)).slice(-2); }).join("");
  }
  function findSub(cat, name) { return cat.subjects.filter(function (s) { return low(s.name) === low(name); })[0]; }
  function findTop(s, name) { return s && s.topics.filter(function (t) { return low(t.name) === low(name); })[0]; }
  function mapQ(q) {
    var o = [], c = -1;
    q.o.forEach(function (x, k) { var v = String(x || "").trim(); if (v) { if (k === q.c) c = o.length; o.push(v); } });
    var r = { t: String(q.q || "").trim(), o: o, c: c, e: "" };
    if (q.imgs && q.imgs[0]) r.i = q.imgs[0];
    return r;
  }
  var sig = function (q) { return low(q.t) + "|" + q.o.map(low).join("|") + "|" + String(q.i || "").slice(-48); };

  /* ---------- Testlər V2 panelinin yenilənməsi ---------- */
  function msg(t, k) { var m = $("tv2-msg"); if (m) { m.className = "tv2-msg " + (k || "i"); m.textContent = t; m.style.display = t ? "block" : "none"; } }
  function subOpts() {
    var cat = S.cat ? S.cat.subjects : [], names = cat.map(function (s) { return s.name; });
    if (S.sub && !names.some(function (n) { return low(n) === low(S.sub); })) names.push(S.sub);
    return '<option value="">— Fənn seçin —</option>' + names.map(function (n) { return '<option value="' + esc(n) + '"' + (low(n) === low(S.sub) ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + '<option value="__new">➕ Yeni fənn…</option>';
  }
  function topOpts() {
    var s = S.cat && findSub(S.cat, S.sub), names = s ? s.topics.map(function (t) { return t.name; }) : [];
    if (S.top && !names.some(function (n) { return low(n) === low(S.top); })) names.push(S.top);
    return '<option value="">— Mövzu seçin —</option>' + names.map(function (n) {
      var t = s && findTop(s, n);
      return '<option value="' + esc(n) + '"' + (low(n) === low(S.top) ? " selected" : "") + ">" + esc(n) + (t ? " (" + t.qs.length + " sual)" : " (yeni)") + "</option>";
    }).join("") + '<option value="__new">➕ Yeni mövzu…</option>';
  }
  function paintTarget() {
    var a = $("dqb-sub"), b = $("dqb-top"); if (!a || !b) return;
    a.innerHTML = subOpts(); b.innerHTML = topOpts();
    var h = $("tv2-sub"); if (h) h.value = S.sub;
    var bk = $("dqb-back"); if (bk) bk.style.display = S.from === "krs" ? "" : "none";
    var s = S.cat && findSub(S.cat, S.sub), t = findTop(s, S.top), i = $("dqb-info");
    if (i) i.textContent = !S.sub ? "Sualların aid olduğu fənni seçin." : !S.top ? "İndi mövzunu seçin." :
      "Sual «" + S.sub + " › " + S.top + "» bölməsinə əlavə olunacaq" + (t ? " (hazırda " + t.qs.length + " sual var)." : " (mövzu yaradılacaq).");
  }
  function paintSummary() {
    var b = $("dqb-sum"); if (!b) return;
    var subs = S.cat ? S.cat.subjects : [];
    b.innerHTML = subs.map(function (s) {
      var tot = s.topics.reduce(function (n, t) { return n + t.qs.length; }, 0);
      return '<div style="margin:6px 0"><b>' + esc(s.icon || "📚") + " " + esc(s.name) + '</b> <small style="color:#64748b">· ' + s.topics.length + " mövzu · " + tot + " sual</small>" +
        '<div style="font-size:12px;color:#475569;margin:2px 0 0 4px">' + (s.topics.map(function (t) { return esc(t.name) + " (" + t.qs.length + ")"; }).join(" · ") || "mövzu yoxdur") + "</div></div>";
    }).join("") || '<div class="tv2-msg i">Kataloq boşdur.</div>';
  }
  function enhance() {
    var root = $("tv2-root"); if (!root || $("dqb-box")) return;
    var top = root.querySelector(".tv2-top"); if (!top) return;
    var box = D.createElement("div"); box.id = "dqb-box"; box.className = "tv2-card";
    box.innerHTML = '<b>🎯 Sual hara əlavə olunsun?</b>' +
      '<div class="tv2-g" style="margin-top:8px"><div><label>Fənn</label><select class="tv2-in" id="dqb-sub"></select></div><div><label>Mövzu</label><select class="tv2-in" id="dqb-top"></select></div></div>' +
      '<div id="dqb-info" class="tv2-msg i" style="display:block;margin-top:8px"></div>' +
      '<div class="tv2-row"><button type="button" class="tv2-b g" id="dqb-back" style="display:none">🎠 Karuselə qayıt</button></div>' +
      '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">📚 Karuseldəki fənlər və mövzular</summary><div id="dqb-sum" style="margin-top:6px"></div>' +
      '<div class="tv2-row"><button type="button" class="tv2-b b" id="dqb-krs">🎠 Karusel idarəsini aç (redaktə / silmə)</button></div></details>';
    top.insertAdjacentElement("afterend", box);
    ["tv2-sub", "tv2-no"].forEach(function (id) { var e = $(id); if (e && e.parentNode) e.parentNode.style.display = "none"; });
    var sv = $("tv2-save"); if (sv) sv.textContent = "💾 Karuselə əlavə et";
    box.addEventListener("change", function (e) {
      var id = e.target.id;
      if (id === "dqb-sub") {
        var v = e.target.value;
        if (v === "__new") { v = (prompt("Yeni fənnin adı:") || "").trim(); if (!v) { paintTarget(); return; } }
        S.sub = v; S.top = "";
      } else if (id === "dqb-top") {
        var w = e.target.value;
        if (w === "__new") { w = (prompt("Yeni mövzunun adı:") || "").trim(); if (!w) { paintTarget(); return; } }
        S.top = w;
      } else return;
      paintTarget();
    });
    $("dqb-krs").onclick = function () { if (window.KRS) { TV2.close(); KRS.open(); } };
    $("dqb-back").onclick = backToKrs;
    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest('[data-a="save"]'); if (!b) return;
      e.stopImmediatePropagation(); e.preventDefault(); doSave(b);
    }, true);
    paintTarget(); paintSummary();
  }
  async function doSave(btn) {
    if (S.busy) return;
    var T = window.TV2, ed = T && T.ed;
    if (!S.sub) return msg("Əvvəl fənni seçin.", "e");
    if (!S.top) return msg("Mövzunu seçin və ya «➕ Yeni mövzu…» ilə yaradın.", "e");
    if (!ed || !ed.qs.length) return msg("Sual yoxdur.", "e");
    var bad = [];
    ed.qs.forEach(function (q, n) {
      var filled = q.o.filter(function (o) { return String(o).trim(); }).length;
      var ok = String(q.q || "").trim() && filled >= 2 && q.c > -1 && q.o[q.c] && String(q.o[q.c]).trim();
      var c = $("tq" + n); if (c) c.classList.toggle("bad", !ok); if (!ok) bad.push(n + 1);
    });
    if (bad.length) { var f = $("tq" + (bad[0] - 1)); f && f.scrollIntoView({ behavior: "smooth", block: "center" }); return msg("Natamam suallar: " + bad.join(", ") + " (mətn, ən azı 2 variant və düzgün cavab lazımdır).", "e"); }
    S.busy = true; btn.disabled = true; msg("Karuselə yazılır...", "i");
    try {
      var cat = await fetchCat(), s = findSub(cat, S.sub);
      if (!s) { var p = PAL[cat.subjects.length % PAL.length]; s = { name: S.sub, icon: "📚", c1: p[0], c2: p[1], acc: light(p[0]), topics: [] }; cat.subjects.push(s); }
      var t = findTop(s, S.top);
      if (!t) { t = { name: S.top, count: 0, time: 0, qs: [] }; s.topics.push(t); }
      var seen = {}; t.qs.forEach(function (q) { seen[sig(q)] = 1; });
      var add = 0, dup = 0, multi = 0;
      ed.qs.forEach(function (q) {
        if (q.imgs && q.imgs.length > 1) multi++;
        var m = mapQ(q), k = sig(m); if (seen[k]) { dup++; return; } seen[k] = 1; t.qs.push(m); add++;
      });
      var mn = parseInt(($("tv2-min") || {}).value, 10); if (mn > 0) t.time = mn;
      if ((t.count || 0) < t.qs.length) t.count = t.qs.length;
      if (JSON.stringify(cat.subjects).length > 7e6 && !confirm("Kataloq çox böyükdür (şəkillər). Yenə də saxlanılsın?")) { S.busy = false; btn.disabled = false; return msg("Ləğv edildi.", "i"); }
      await pushCat(cat);
      S.cat = cat;
      var clr = $("tv2-root").querySelector('[data-a="clear"]'); clr && clr.click();
      paintTarget(); paintSummary();
      msg("✅ " + add + " sual «" + s.name + " › " + t.name + "» bölməsinə əlavə olundu. Cəmi: " + t.qs.length + " sual." + (dup ? " " + dup + " təkrar sual buraxıldı." : "") +
        (multi ? " ⚠ " + multi + " sualda bir neçə şəkil var — yalnız birincisi saxlandı." : "") + " Ana səhifə → Testlər → «Fənlər üzrə testlər» bölməsində görünür.", "k");
    } catch (x) { msg("Xəta: " + (x && x.message || x), "e"); }
    S.busy = false; btn.disabled = false;
  }
  async function openPanel(sub, top, from) {
    S.from = from || "";
    var T = window.TV2; if (!T) return;
    try { S.cat = await fetchCat(); } catch (e) { S.cat = S.cat || { id: null, subjects: seed() }; }
    if (sub != null) { S.sub = sub; S.top = top || ""; }
    await T.open(); enhance(); paintTarget(); paintSummary();
  }

  /* Testlər idarəsi → «➕ Sual əlavə et» eyni panelə yönləndirilir */
  D.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest('.tm-act [data-act="edit"]');
    if (!b || !/Sual əlavə et/.test(b.textContent) || !window.TV2) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try {
      var rows = await V2.list("v3tests"), t = rows.filter(function (x) { return String(x._id) === String(b.dataset.id); })[0] || {};
      var cat = S.cat = await fetchCat(), s = findSub(cat, t.subject || ""), tp = s && findTop(s, t.title || "");
      if (window.TM && TM.close) TM.close();
      await openPanel(s ? s.name : (t.subject || ""), tp ? tp.name : (t.title || ""));
      msg("«" + (t.title || "Test") + "» üçün sualları yapışdırın, cavabları seçin və «Karuselə əlavə et» basın.", "i");
    } catch (x) { console.warn("[DQB]", x); if (window.TV2) openPanel(); }
  }, true);

  /* ---------- Günün tövsiyə testi (karuseldən təsadüfi) ---------- */
  function cover(p) {
    var ph = p.cover || (window.DQSYS && DQSYS.get("tests"));
    if (ph) return ph;
    var g = p.grad || ["#2f63bd", "#0a2f7a"], t = String(p.topic).slice(0, 34), s = String(p.subject).slice(0, 30);
    var x = function (v) { return String(v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + g[1] + '"/><stop offset="1" stop-color="' + g[0] + '"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/>' +
      '<g fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"><circle cx="680" cy="90" r="120"/><circle cx="680" cy="90" r="80"/><circle cx="90" cy="430" r="140"/></g>' +
      '<text x="680" y="125" font-size="96" text-anchor="middle">' + x(p.icon || "📚") + '</text><rect x="48" y="176" width="56" height="5" rx="2" fill="#fff" fill-opacity=".85"/>' +
      '<text x="48" y="250" font-family="Arial,sans-serif" font-weight="800" font-size="46" fill="#fff">' + x(t) + '</text><text x="48" y="305" font-family="Arial,sans-serif" font-weight="700" font-size="26" fill="#fff" fill-opacity=".85">' + x(s) + "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function dayKey() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function dayCard(p, sg) {
    return '<div class="dt-day dqb-day" data-sig="' + esc(sg) + '"><div class="cv"><img alt="" src="' + cover(p) + '"></div><div class="in"><span class="dt-tag">⭐ GÜNÜN TÖVSİYƏ TESTİ</span><h3>' + esc(p.topic) + '</h3>' +
      '<div class="dt-meta"><span>📚 ' + esc(p.subject) + "</span><span>❓ " + p.n + " sual</span><span>⏱ " + p.mins + " dəqiqə</span></div>" +
      "<p>Hər gün yeni mövzu: bu gün «" + esc(p.subject) + "» fənni üzrə «" + esc(p.topic) + "». Taymer başlayanda vaxt geriyə sayılır və bitəndə nəticə avtomatik yoxlanılır.</p>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="dt-bt g" data-dqb-go="1" data-s="' + esc(p.subject) + '" data-t="' + esc(p.topic) + '">▶ Testə başla</button>' +
      '<button type="button" class="dt-bt l" data-dqb-all="1">Bütün testlər</button></div></div></div>';
  }
  function paintDaily() {
    var h = $("v3-home"); if (!h || !window.TLX || !TLX.daily) return;
    var p = TLX.daily(), el = $("dt-home");
    if (!p) return;
    var sg = p.subject + "|" + p.topic + "|" + p.n + "|" + dayKey();
    if (!el) {
      var grid = $("dt-grid"); if (!grid || grid.parentNode !== h) return;
      el = D.createElement("section"); el.id = "dt-home"; el.className = "dt-hm"; h.insertBefore(el, grid.nextSibling);
    }
    var cur = el.querySelector(".dqb-day"); if (cur && cur.getAttribute("data-sig") === sg) return;
    el.setAttribute("data-sig", "dqb|" + sg); el.innerHTML = dayCard(p, sg);
  }
  D.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest("[data-dqb-go]");
    if (g) { e.preventDefault(); if (window.TLX && TLX.begin) TLX.begin(g.dataset.s, g.dataset.t, g); return; }
    if (e.target.closest && e.target.closest("[data-dqb-all]")) { e.preventDefault(); if (window.V3 && V3.showTests) V3.showTests(); }
  });
  /* Qərarlı yüklənmə: köhnə kartın əvəzi ekrana çıxmamış, eyni kadrda (MutationObserver mikrotapşırığı) edilir — «tullanma» olmur */
  var dayMO = null, dayBusy = false;
  function guardedDaily() {
    if (dayBusy) return; dayBusy = true;
    try { paintDaily(); } catch (e) { }
    if (dayMO) dayMO.takeRecords();
    dayBusy = false;
  }
  var dn = 0, dIv = setInterval(function () {
    var h = $("v3-home");
    if (h && window.MutationObserver) {
      clearInterval(dIv);
      dayMO = new MutationObserver(guardedDaily);
      dayMO.observe(h, { childList: true, subtree: true });
      guardedDaily();
    } else if (++dn > 80) clearInterval(dIv);
  }, 100);
  setInterval(guardedDaily, 5000);  /* ehtiyat: karusel kataloqu gec yüklənərsə */


  /* ---------- Xəbərlər səhifəsi: sabit WhatsApp düyməsi + sağdan sola axan yazı ---------- */
  (function () {
    if (D.getElementById("dqb-news-css")) return;
    var st = D.createElement("style"); st.id = "dqb-news-css";
    st.textContent =
      ".nw-stick{position:sticky;top:0;z-index:5}.nw-stick .nw-top{position:static}" +
      ".nw-wbar{display:flex;align-items:center;gap:10px;background:#0b2447;border-bottom:2px solid #c9a24f;padding:7px 12px}" +
      ".nw-tick{flex:1;min-width:0;overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent)}" +
      ".nw-tt{display:inline-block;padding-left:100%;color:#fff!important;font-weight:600;font-size:14px;text-decoration:none;animation:nwTick 34s linear infinite;will-change:transform}" +
      ".nw-tick:hover .nw-tt,.nw-tick:active .nw-tt{animation-play-state:paused}" +
      "@keyframes nwTick{from{transform:translateX(0)}to{transform:translateX(-100%)}}" +
      ".nw-wbtn{flex:none;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#25d366,#0f9d6b);color:#fff!important;border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px;text-decoration:none;white-space:nowrap;box-shadow:0 4px 12px #25d36655}" +
      ".nw-wbtn .s{display:none}" +
      "@media(max-width:560px){.nw-wbtn .l{display:none}.nw-wbtn .s{display:inline}.nw-wbtn{padding:8px 12px}.nw-tt{font-size:13px}}" +
      "@media(prefers-reduced-motion:reduce){.nw-tick{white-space:normal}.nw-tt{animation:none;padding-left:0;white-space:normal}}" +
      "#nw-pub .nw-lay{grid-template-columns:minmax(0,1fr)!important}#nw-pub .nw-wrap{max-width:900px!important}#nw-pub .nw-side{display:none!important}";
    D.head.appendChild(st);
  })();


  /* ---------- Karusel panelinə inteqrasiya: idxal düyməsi + bütün alətlər ---------- */
  var TOOLS_SKIP = /karusel|testlər v2/i;
  function krsCur() {
    var r = $("krs-root"); if (!r) return {};
    var sn = r.querySelector('[data-k="sname"]'), tn = r.querySelector(".krs-t.on [data-k=\"tname\"]");
    return { sub: sn ? sn.value.trim() : "", top: tn ? tn.value.trim() : "" };
  }
  function adminCards() {
    return [].slice.call(D.querySelectorAll("#admin-panel .admin-nav-card")).filter(function (c) { return c.id !== "krs-card" && !TOOLS_SKIP.test(c.textContent); });
  }
  function injectKrs() {
    var r = $("krs-root"); if (!r || !r.classList.contains("open")) return;
    var b = r.querySelector(".krs-b"); if (!b) return;
    var qc = null;
    [].forEach.call(b.querySelectorAll(".krs-c"), function (c) { var h = c.querySelector("h4"); if (h && /^❓ Suallar/.test(h.textContent)) qc = c; });
    if (qc && !qc.querySelector(".dqb-tb")) {
      var cur = krsCur(), tb = D.createElement("div"); tb.className = "dqb-tb";
      tb.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin:8px 0";
      tb.innerHTML = '<button type="button" class="krs-bt sm blue" data-dqb="imp">📄 PDF / 🖼 Şəkil / 🟣 Forms / Mətn idxalı</button>' +
        '<small style="flex-basis:100%;color:#64748b">Suallar «' + esc(cur.sub) + ' › ' + esc(cur.top) + '» mövzusuna əlavə olunacaq. Əvvəl yadda saxlanmamış dəyişiklik varsa, «💾 Saxla» basın.</small>';
      qc.querySelector("h4").insertAdjacentElement("afterend", tb);
    }
    if (!b.querySelector(".dqb-tools")) {
      var cards = adminCards(), tl = D.createElement("div"); tl.className = "krs-c dqb-tools";
      tl.innerHTML = '<details><summary style="cursor:pointer;font-weight:800">🧰 Bütün alətlər (Testlər idarəsi, sual bankı, yoxlama, kəsmə…)</summary><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
        '<button type="button" class="krs-bt sm" data-dqb="tm">🗂️ Testlər idarəsi</button>' +
        cards.map(function (c, i) { return '<button type="button" class="krs-bt sm" data-dqb-tool="' + i + '">' + esc(c.textContent.replace(/\s+/g, " ").trim()) + "</button>"; }).join("") +
        "</div></details>";
      b.insertBefore(tl, b.firstChild);
    }
  }
  function closeKrs() {
    if (!window.KRS) return true;
    KRS.close();
    var r = $("krs-root"); return !(r && r.classList.contains("open"));
  }
  D.addEventListener("click", function (e) {
    var x = e.target.closest && e.target.closest("[data-dqb],[data-dqb-tool]"); if (!x) return;
    e.preventDefault();
    if (x.dataset.dqb === "imp") {
      var c = krsCur(); if (!c.sub || !c.top) return alert("Əvvəl mövzunu seçin.");
      if (closeKrs()) openPanel(c.sub, c.top, "krs");
    } else if (x.dataset.dqb === "tm") {
      if (closeKrs() && window.TM) TM.open();
    } else if (x.dataset.dqbTool != null) {
      var cards = adminCards(), card = cards[+x.dataset.dqbTool];
      if (card && closeKrs()) setTimeout(function () { card.click(); }, 80);
    }
  });
  function backToKrs() {
    var sub = S.sub, top = S.top;
    if (window.TV2) TV2.close();
    S.from = "";
    if (!window.KRS) return;
    Promise.resolve(KRS.open()).then(function () {
      setTimeout(function () {
        var r = $("krs-root"); if (!r) return;
        var chip = [].filter.call(r.querySelectorAll('[data-a="ssel"]'), function (b) { return low(b.textContent).indexOf(low(sub)) > -1; })[0];
        chip && chip.click();
        setTimeout(function () {
          var inp = [].filter.call(r.querySelectorAll('.krs-t [data-k="tname"]'), function (i) { return low(i.value) === low(top); })[0];
          var tb = inp && inp.closest(".krs-t").querySelector('[data-a="tsel"]'); tb && tb.click();
        }, 60);
      }, 120);
    });
  }
  setInterval(function () { try { injectKrs(); } catch (e) { } }, 600);

  /* ---------- qurulum ---------- */
  var n = 0, iv = setInterval(function () {
    if (window.V2 && window.TV2 && window.TLX) {
      clearInterval(iv);
      var oc = TV2.close;
      TV2.close = function () { S.from = ""; return oc.apply(this, arguments); };
      var o = TV2.open;
      TV2.open = async function () {
        try { S.cat = await fetchCat(); } catch (e) { S.cat = S.cat || { id: null, subjects: seed() }; }
        var r = await o.apply(this, arguments);
        try { enhance(); paintTarget(); paintSummary(); } catch (x) { console.warn("[DQB]", x); }
        return r;
      };
    } else if (++n > 240) clearInterval(iv);
  }, 250);
  window.DQB = { open: openPanel, daily: function () { return window.TLX && TLX.daily && TLX.daily(); } };
})();
