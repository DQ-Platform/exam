/* DQ Platform · dq-pro-fix.js  (v1)
   app.js və digər skriptlərdən SONRA yüklənir. Mövcud kodu dəyişmir, yalnız üstündən qoruyur:
   1) Ana səhifənin quyruğu (statistika kartları + footer) heç vaxt yox olmur
   2) «Testlər» tabı donarsa ehtiyat yükləyici + «Yenidən cəhd» düyməsi
   3) Admin paneldə «Media» modulu (şəkil kitabxanası) + Xəbər qapağı üçün «Mediadan seç»
*/
(function () {
  "use strict";
  if (window.__dqPro) return;
  window.__dqPro = 1;
  var D = document, $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var toast = function (m) { try { V2.toast(m); } catch (e) { alert(m); } };

  /* ---------- CSS ---------- */
  var st = D.createElement("style");
  st.id = "dq-pro-css";
  st.textContent =
    "#v3-home.active .v3-ft{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important}" +
    "#v3-home.active #dq-stats{display:grid!important;visibility:visible!important;opacity:1!important}" +
    ".dqm-ov{position:fixed;inset:0;z-index:2147483000;background:#f1f5f9;overflow:auto;font-family:inherit;color:#0f172a}" +
    ".dqm-hd{position:sticky;top:0;z-index:2;background:#0b2a6b;color:#fff;padding:14px 16px;display:flex;gap:10px;align-items:center;justify-content:space-between}" +
    ".dqm-hd h3{margin:0;font-size:18px}.dqm-bd{max-width:1100px;margin:0 auto;padding:16px}" +
    ".dqm-bt{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#0b5ed7;color:#fff;font-size:14px}" +
    ".dqm-bt.o{background:#fff;color:#0b2a6b;border:1px solid #cbd5e1}.dqm-bt.x{background:#dc2626}.dqm-bt.s{padding:6px 10px;font-size:12px}" +
    ".dqm-drop{border:2px dashed #94a3b8;border-radius:14px;padding:22px;text-align:center;background:#fff;margin-bottom:14px}" +
    ".dqm-in{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;box-sizing:border-box;margin-bottom:14px}" +
    ".dqm-gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}" +
    ".dqm-cd{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,.08);display:flex;flex-direction:column}" +
    ".dqm-cd img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#e2e8f0;cursor:zoom-in}" +
    ".dqm-cd div{padding:8px 10px;font-size:12px;word-break:break-word}.dqm-cd small{color:#64748b;display:block}" +
    ".dqm-ac{display:flex;gap:6px;flex-wrap:wrap;padding:0 10px 10px!important}" +
    ".dqm-emp{text-align:center;color:#64748b;padding:30px}";
  D.head.appendChild(st);

  /* =========================================================
     1) ANA SƏHİFƏ QUYRUĞU
     ========================================================= */
  var ftCache = "";
  function buildFooter(h) {
    var f = D.createElement("div");
    f.className = "v3-ft";
    f.innerHTML = ftCache ||
      "© 2026 DQ Platform – Developed by Yunis İmanov" +
      '<div style="margin-top:16px;font-size:14px"><a style="color:#22c55e;cursor:pointer" onclick="V3.info(\'terms\')">İstifadə Şərtləri</a> &nbsp;|&nbsp; ' +
      '<a style="color:#22c55e;cursor:pointer" onclick="V3.info(\'priv\')">Məxfilik Siyasəti</a></div>';
    h.appendChild(f);
    try { if (window.HOME && HOME.fab) HOME.fab(); } catch (e) { }
    return f;
  }
  var tries = 0, lastSt = 0, sched = 0;
  function tail() {
    sched = 0;
    var h = $("v3-home");
    if (!h || D.hidden || !h.classList.contains("active") || !h.querySelector(".v3-hero")) return;
    try { if (window.DQGate && DQGate.holding && DQGate.holding()) return; } catch (e) { }
    var ft = h.querySelector(".v3-ft");
    if (ft && ft.textContent.trim()) ftCache = ft.innerHTML;
    if (!ft) ft = buildFooter(h);
    else if (!ft.textContent.trim() && ftCache) ft.innerHTML = ftCache;
    /* statistika */
    if (!h.querySelector("#dq-stats") && window.DQST && DQST.mount && Date.now() - lastSt > 2500 && tries < 8) {
      tries++; lastSt = Date.now();
      try { DQST.mount(true); } catch (e) { }
    }
    if (h.querySelector("#dq-stats")) tries = 0;
    /* footer həmişə ən sonda */
    if (ft.parentNode === h && h.lastElementChild !== ft) h.appendChild(ft);
  }
  function go() { if (!sched) sched = setTimeout(tail, 150); }
  setInterval(tail, 1500);
  D.addEventListener("visibilitychange", go);
  (function wait(n) {
    var h = $("v3-home");
    if (h) { try { new MutationObserver(go).observe(h, { childList: true }); } catch (e) { } go(); }
    else if (n < 80) setTimeout(function () { wait(n + 1); }, 250);
  })(0);

  /* =========================================================
     2) TESTLƏR — donma qoruyucusu
     ========================================================= */
  function fallbackTests(el) {
    el.innerHTML = '<div class="v3-t"><h2>Fənn Testləri</h2><p style="color:#64748b">Yüklənir…</p></div>';
    Promise.resolve(V2.list("v3tests")).then(function (list) {
      list = list || []; V3.tests = list;
      var by = {};
      list.forEach(function (t, i) { (by[t.subject || "Digər"] = by[t.subject || "Digər"] || []).push([t, i]); });
      var keys = Object.keys(by);
      el.innerHTML = '<div class="v3-t"><h2>Fənn Testləri</h2>' + (keys.length ? keys.map(function (s) {
        return '<h3 style="text-align:left;margin:18px 0 8px">' + esc(s) + '</h3><div class="v3-cards">' + by[s].map(function (p) {
          return '<div class="v3-cd" onclick="V3.openTest(' + p[1] + ')"><b>' + esc(p[0].title) + '</b><small>' + ((p[0].ans || []).length) + ' sual</small></div>';
        }).join("") + "</div>";
      }).join("") : '<p style="margin:20px 0">Hələ test əlavə edilməyib.</p>') +
        '<div class="v3-row"><a class="v3-b v3-d" onclick="showScreen(\'v3-home\')">Ana səhifə</a></div></div>';
    }).catch(function () {
      el.innerHTML = '<div class="v3-t"><h2>Fənn Testləri</h2><p>Bağlantı xətası baş verdi.</p><div class="v3-row">' +
        '<a class="v3-b v3-g" onclick="V3.showTests()">🔄 Yenidən cəhd et</a><a class="v3-b v3-d" onclick="showScreen(\'v3-home\')">Ana səhifə</a></div></div>';
    });
  }
  function wrapTests() {
    if (!window.V3 || typeof V3.showTests !== "function" || V3.showTests.__pro) return;
    var prev = V3.showTests;
    V3.showTests = async function () {
      var r;
      try { r = await prev.apply(V3, arguments); } catch (e) { console.error("[dq-pro] showTests", e); }
      setTimeout(function () {
        var el = $("v3-tests");
        if (el && el.classList.contains("active") && /Yüklənir|^\s*$/.test(el.textContent.slice(0, 200)) && !el.querySelector(".v3-cd,.tlx,.dt-card")) fallbackTests(el);
      }, 6500);
      return r;
    };
    V3.showTests.__pro = 1;
  }
  [1500, 4000, 8000].forEach(function (t) { setTimeout(wrapTests, t); });

  /* =========================================================
     3) MEDIA MODULU
     ========================================================= */
  var COL = "media";
  var M = window.DQMedia = { rows: [], q: "", pick: null };

  function fit(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error("Fayl oxunmadı")); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error("Şəkil deyil")); };
        im.onload = function () {
          var mx = 1600, k = Math.min(1, mx / Math.max(im.width, im.height)), w = Math.round(im.width * k), h = Math.round(im.height * k);
          var c = D.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(im, 0, 0, w, h);
          var q = 0.85, u = c.toDataURL("image/jpeg", q);
          while (u.length > 900000 && q > 0.4) { q -= 0.1; u = c.toDataURL("image/jpeg", q); }
          res({ name: file.name.replace(/\.[^.]+$/, ""), url: u, w: w, h: h, size: Math.round(u.length * 0.75), date: new Date().toISOString().slice(0, 10) });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function rmRow(id) {
    await V2.probe();
    if (V2.mode === "cloud") await _supabase.from("dq_v2_store").delete().eq("id", id);
    else localStorage.setItem("dq_v2_" + COL, JSON.stringify((await V2.list(COL)).filter(function (x) { return x._id != id; })));
  }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB"; }
  function draw() {
    var g = $("dqm-gr"); if (!g) return;
    var q = M.q.toLowerCase(), rows = M.rows.filter(function (r) { return !q || String(r.name || "").toLowerCase().indexOf(q) > -1; });
    g.innerHTML = rows.length ? rows.map(function (r) {
      return '<div class="dqm-cd"><img src="' + r.url + '" alt="' + esc(r.name) + '" data-v="' + r._id + '"><div><b>' + esc(r.name) + '</b><small>' + r.w + '×' + r.h + ' · ' + kb(r.size || 0) + ' · ' + esc(r.date || "") + '</small></div>' +
        '<div class="dqm-ac">' + (M.pick ? '<button class="dqm-bt s" data-a="pick" data-i="' + r._id + '">Seç</button>' : "") +
        '<button class="dqm-bt o s" data-a="ren" data-i="' + r._id + '">Adı dəyiş</button><button class="dqm-bt x s" data-a="del" data-i="' + r._id + '">Sil</button></div></div>';
    }).join("") : '<div class="dqm-emp" style="grid-column:1/-1">Hələ şəkil yoxdur. Yuxarıdan yükləyin.</div>';
  }
  async function reload() {
    var g = $("dqm-gr"); if (g) g.innerHTML = '<div class="dqm-emp" style="grid-column:1/-1">Yüklənir…</div>';
    try { M.rows = await V2.list(COL); } catch (e) { M.rows = []; }
    draw();
  }
  M.open = function (pick) {
    M.pick = typeof pick === "function" ? pick : null;
    var o = $("dqm-ov"); if (o) o.remove();
    o = D.createElement("div"); o.id = "dqm-ov"; o.className = "dqm-ov";
    o.innerHTML = '<div class="dqm-hd"><h3>🖼️ Media kitabxanası</h3><button class="dqm-bt o" id="dqm-x">✕ Bağla</button></div><div class="dqm-bd">' +
      '<div class="dqm-drop"><p style="margin:0 0 10px"><b>Şəkilləri seçin</b> (JPG/PNG/WEBP — avtomatik sıxılır, maks. 1600px)</p>' +
      '<input type="file" id="dqm-f" accept="image/*" multiple style="display:none"><button class="dqm-bt" id="dqm-up">⬆️ Şəkil yüklə</button><p id="dqm-msg" style="margin:10px 0 0;color:#475569;font-size:13px"></p></div>' +
      '<input class="dqm-in" id="dqm-s" placeholder="Axtar…"><div class="dqm-gr" id="dqm-gr"></div></div>';
    D.body.appendChild(o);
    $("dqm-x").onclick = function () { o.remove(); M.pick = null; };
    $("dqm-up").onclick = function () { $("dqm-f").click(); };
    $("dqm-s").oninput = function () { M.q = this.value; draw(); };
    $("dqm-f").onchange = async function () {
      var fs = [].slice.call(this.files || []), ok = 0, msg = $("dqm-msg");
      for (var i = 0; i < fs.length; i++) {
        if (fs[i].size > 15 * 1048576) { msg.textContent = fs[i].name + ": 15 MB-dan böyükdür, keçildi."; continue; }
        msg.textContent = "Yüklənir " + (i + 1) + "/" + fs.length + "…";
        try { await V2.put(COL, await fit(fs[i])); ok++; } catch (e) { msg.textContent = fs[i].name + ": " + e.message; }
      }
      this.value = ""; if (ok) { msg.textContent = ok + " şəkil əlavə olundu ✅"; await reload(); }
    };
    o.addEventListener("click", async function (ev) {
      var im = ev.target.closest("img[data-v]");
      if (im) { window.open(im.src, "_blank"); return; }
      var b = ev.target.closest("[data-a]"); if (!b) return;
      var id = b.getAttribute("data-i"), r = M.rows.filter(function (x) { return x._id == id; })[0]; if (!r) return;
      var a = b.getAttribute("data-a");
      if (a === "pick") { var cb = M.pick; o.remove(); M.pick = null; cb && cb(r.url, r); }
      else if (a === "ren") { var n = prompt("Yeni ad:", r.name || ""); if (n && n.trim()) { r.name = n.trim().slice(0, 80); await V2.put(COL, r, r._id); await reload(); } }
      else if (a === "del") { if (confirm("«" + r.name + "» silinsin?")) { await rmRow(r._id); toast("Silindi"); await reload(); } }
    });
    reload();
  };

  function adminCard() {
    var g = D.querySelector("#admin-panel .admin-nav-grid") || D.querySelector(".admin-nav-grid");
    if (!g || $("dqm-card")) return;
    var c = D.createElement("div");
    c.id = "dqm-card"; c.className = "admin-nav-card";
    c.innerHTML = '<span class="icon">🖼️</span> Media';
    c.onclick = function () { M.open(); };
    g.appendChild(c);
  }
  function newsPick() {
    var p = $("nw-prev");
    if (!p || $("dqm-pick") || !window.NW2 || !NW2.setCover) return;
    var b = D.createElement("button");
    b.type = "button"; b.id = "dqm-pick"; b.className = "dqm-bt o s"; b.style.margin = "6px 0";
    b.textContent = "📁 Mediadan seç";
    b.onclick = function () { M.open(function (u) { NW2.setCover(u); }); };
    p.parentNode.insertBefore(b, p.nextSibling);
  }
  function adminTick() { adminCard(); newsPick(); }
  try { new MutationObserver(function () { clearTimeout(adminTick.t); adminTick.t = setTimeout(adminTick, 120); }).observe(D.body, { childList: true, subtree: true }); } catch (e) { }
  adminTick();
})();
