/* DQ Platform — dq-qapaq.js (v1)
   Sistem qapaq şəkilləri: admin paneldə «🖼️ Sistem qapaqları» kartı.
   · Slotlar: tests (Testlər / Günün tövsiyə testi), news (şəkilsiz xəbərlər), site (ümumi ehtiyat qapaq)
   · Fənn üzrə qapaq şəkli isə «🎠 Karusel» panelində hər fənnin öz parametrlərindədir və bunu üstələyir.
   · DQSYS.get(slot) — qapağı qaytarır (slot boşdursa «site» ehtiyatı). app.js?v=29 və dq-birlesdirme.js?v=5 ilə işləyir. */
(function () {
  "use strict";
  if (window.DQSYS) return;
  var COL = "syscovers", CK = "dq_syscov_v1", D = document;
  var SLOTS = [
    { k: "tests", t: "Testlər qapağı", d: "«Testlər» karuselində şəkli olmayan fənlərin və «Günün tövsiyə testi» kartının fonu." },
    { k: "news", t: "Xəbərlər qapağı", d: "Şəkli əlavə edilməmiş xəbərlərdə (siyahı və «Yeniliklər» slayderi) görünür." },
    { k: "site", t: "Ümumi sistem qapağı", d: "Yuxarıdakı slotlar boşdursa, ehtiyat kimi istifadə olunur." }
  ];
  var $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = { covers: {}, id: null, dirty: false, busy: false };

  try { var c0 = JSON.parse(localStorage.getItem(CK) || "null"); if (c0 && c0.covers) S.covers = c0.covers; } catch (e) { }

  function get(slot) { return S.covers[slot] || (slot !== "site" ? S.covers.site : "") || ""; }
  function cache() { try { localStorage.setItem(CK, JSON.stringify({ covers: S.covers })); } catch (e) { } }

  /* ---------- verilənlər bazası ---------- */
  async function load() {
    try {
      if (V2.probe) await V2.probe();
      var r = (await V2.list(COL))[0];
      if (r) { S.id = r._id; if (r.covers && typeof r.covers === "object") { S.covers = r.covers; cache(); } }
      else if (!S.id) { /* hələ yazılmayıb */ }
      applyAll();
    } catch (e) { console.warn("[DQSYS] yüklənmədi", e); }
  }
  async function persist() {
    if (V2.probe) await V2.probe();
    await V2.put(COL, { covers: S.covers, v: 1, at: new Date().toISOString() }, S.id || undefined);
    if (!S.id) { var r = (await V2.list(COL))[0]; S.id = r && r._id; }
    cache();
  }

  /* ---------- sayta tətbiqi: şəkilsiz xəbərlər ---------- */
  function applyNews() {
    var im = get("news"); if (!im) return;
    var pub = $("nw-pub"); if (!pub) return;
    [].forEach.call(pub.querySelectorAll(".nw-card div.im"), function (d) {
      var img = D.createElement("img"); img.className = "im"; img.alt = ""; img.src = im; img.setAttribute("data-dqs", "1");
      d.replaceWith(img);
    });
    [].forEach.call(D.querySelectorAll("#dtn .dtn-im"), function (box) {
      if (box.querySelector("img")) return;
      var img = D.createElement("img"); img.alt = ""; img.src = im; img.setAttribute("data-dqs", "1");
      box.appendChild(img);
    });
  }
  var lastSig = "";
  function applyAll() {
    try { applyNews(); } catch (e) { }
    var sg = (S.covers.tests || "").length + "|" + (S.covers.site || "").length;
    if (sg !== lastSig) { lastSig = sg; if (sg !== "0|0" && window.TLX && TLX.refresh) { try { TLX.refresh(); } catch (e) { } } }
  }

  /* ---------- şəkil sıxma ---------- */
  function shrink(file, W, H) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onerror = function () { no(new Error("Fayl oxunmadı")); };
      r.onload = function () {
        var im = new Image();
        im.onerror = function () { no(new Error("Şəkil açılmadı")); };
        im.onload = function () {
          var c = D.createElement("canvas"), k = Math.max(W / im.width, H / im.height), w = im.width * k, h = im.height * k;
          c.width = W; c.height = H;
          var x = c.getContext("2d"); x.fillStyle = "#0a2f7a"; x.fillRect(0, 0, W, H);
          x.imageSmoothingQuality = "high"; x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
          var q = .86, d = "";
          for (var i = 0; i < 7; i++) { d = c.toDataURL("image/jpeg", q); if (d.length < 220000) break; q -= .09; }
          ok(d);
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- admin paneli ---------- */
  var root = null;
  function msg(t) { var m = $("dqs-st"); if (m) m.textContent = t || ""; }
  function draw() {
    var b = root.querySelector(".dqs-b");
    b.innerHTML = SLOTS.map(function (s) {
      var v = S.covers[s.k] || "";
      return '<div class="dqs-c"><div class="dqs-pv"' + (v ? ' style="background-image:url(\'' + v + '\')"' : "") + ">" + (v ? "" : "Şəkil yoxdur") + "</div>" +
        '<div class="dqs-tx"><b>🖼️ ' + esc(s.t) + "</b><small>" + esc(s.d) + "</small>" +
        '<div class="dqs-row"><button type="button" class="dqs-bt blue" data-a="pick" data-k="' + s.k + '">' + (v ? "🔄 Dəyiş" : "📁 Şəkil seç") + "</button>" +
        (v ? '<button type="button" class="dqs-bt red" data-a="del" data-k="' + s.k + '">🗑 Sil</button>' : "") +
        '<input type="file" accept="image/*" hidden data-f="' + s.k + '"></div></div></div>';
    }).join("");
  }
  function build() {
    if (root) return;
    root = D.createElement("div"); root.id = "dqs-root"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Sistem qapaq şəkilləri");
    root.innerHTML = '<div class="dqs-p"><div class="dqs-h"><div><b>🖼️ Sistem qapaq şəkilləri</b><small>Saytın ümumi hissələri üçün qapaq şəkilləri</small></div><button type="button" class="dqs-bt" data-a="close" aria-label="Bağla">✕</button></div><div class="dqs-b"></div>' +
      '<div class="dqs-f"><span class="dqs-st" id="dqs-st"></span><button type="button" class="dqs-bt" data-a="close">Bağla</button><button type="button" class="dqs-bt pri" data-a="save">💾 Saxla</button></div></div>';
    D.body.appendChild(root);
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) { if (e.target === root) close(); return; }
      var a = b.dataset.a, k = b.dataset.k;
      if (a === "close") return close();
      if (a === "pick") { var f = root.querySelector('[data-f="' + k + '"]'); f && f.click(); return; }
      if (a === "del") { delete S.covers[k]; S.dirty = true; msg("● saxlanmamış dəyişikliklər"); draw(); return; }
      if (a === "save") return save(b);
    });
    root.addEventListener("change", async function (e) {
      var f = e.target.closest && e.target.closest("[data-f]"); if (!f || !f.files[0]) return;
      try { msg("Şəkil işlənir…"); S.covers[f.dataset.f] = await shrink(f.files[0], 1280, 800); S.dirty = true; msg("● saxlanmamış dəyişikliklər"); draw(); }
      catch (x) { msg(""); alert("Xəta: " + (x && x.message || x)); }
    });
    D.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("open")) close(); });
  }
  async function save(btn) {
    if (S.busy) return; S.busy = true; btn.disabled = true; msg("Saxlanılır…");
    try { await persist(); S.dirty = false; msg("✅ saxlanıldı"); try { V2.toast("Sistem qapaqları yeniləndi ✅"); } catch (e) { } applyAll(); if (window.TLX && TLX.refresh) TLX.refresh(); }
    catch (x) { msg(""); alert("Saxlanmadı: " + (x && x.message || x)); }
    S.busy = false; btn.disabled = false;
  }
  function close() {
    if (S.dirty && !confirm("Saxlanmamış dəyişikliklər itəcək. Bağlansın?")) return;
    if (S.dirty) { try { var c = JSON.parse(localStorage.getItem(CK) || "null"); S.covers = c && c.covers || {}; } catch (e) { S.covers = {}; } S.dirty = false; }
    root.classList.remove("open"); D.documentElement.style.overflow = "";
  }
  async function open() { build(); await load(); S.dirty = false; msg(""); draw(); root.classList.add("open"); D.documentElement.style.overflow = "hidden"; }

  function addCard() {
    var g = D.querySelector("#admin-panel .admin-nav-grid"); if ($("dqs-card")) return true; if (!g) return false;
    var d = D.createElement("div"); d.id = "dqs-card"; d.className = "admin-nav-card";
    d.style.cssText = "background:linear-gradient(135deg,#0a2f7a,#2a5db8);color:#fff";
    d.innerHTML = '<span class="icon">🖼️</span> Sistem qapaqları'; d.onclick = open; g.appendChild(d); return true;
  }

  window.DQSYS = { get: get, open: open, covers: function () { return JSON.parse(JSON.stringify(S.covers)); }, reload: load };

  /* qurulum */
  var n = 0, iv = setInterval(function () { if (window.V2 && V2.list) { clearInterval(iv); load(); } else if (++n > 160) clearInterval(iv); }, 250);
  var m = 0, iv2 = setInterval(function () { if (addCard() || ++m > 60) clearInterval(iv2); }, 500);
  var ap = $("admin-panel"); if (ap && window.MutationObserver) new MutationObserver(function () { if (!$("dqs-card")) addCard(); }).observe(ap, { childList: true, subtree: true });
  else D.addEventListener("DOMContentLoaded", function () { var a2 = $("admin-panel"); if (a2 && window.MutationObserver) new MutationObserver(function () { if (!$("dqs-card")) addCard(); }).observe(a2, { childList: true, subtree: true }); });
  setInterval(applyNews, 900);
})();
