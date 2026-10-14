/* DQ Platform — dq-editor.js (v1)
   Admin paneldə «🎨 Premium redaktə»: bütün panellərə keçib istənilən elementi seçmək və dəyişmək
   (mətn, rəng, fon, şrift, ölçü, künc, şəffaflıq, fon şəkli, gizlətmə). Dəyişikliklər verilənlər bazasına
   yazılır və bütün istifadəçilərdə avtomatik tətbiq olunur. V2 (dq-qapaq.js ilə eyni sistem) tələb olunur. */
(function () {
  "use strict";
  if (window.DQED) return;
  var COL = "uiedits", CK = "dq_uiedits_v1", D = document;
  var S = { edits: {}, id: null, dirty: false, on: false, sel: "", el: null, hov: null, bypass: false, busy: false };
  var $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  try { var c0 = JSON.parse(localStorage.getItem(CK) || "null"); if (c0 && c0.edits) S.edits = c0.edits; } catch (e) { }

  var PR = { color: "color", bg: "background-color", fs: "font-size", fw: "font-weight", ff: "font-family", br: "border-radius", op: "opacity", bi: "background-image" };
  var FF = [["Standart", ""], ["Plus Jakarta Sans", "'Plus Jakarta Sans',sans-serif"], ["Serif (Georgia)", "Georgia,'Times New Roman',serif"], ["Əl yazısı (Caveat)", "'Caveat',cursive"], ["Monospace", "ui-monospace,Consolas,monospace"]];

  /* ---------- element ünvanı (shadow DOM daxil) ---------- */
  function nth(el) { var i = 1, s = el; while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++; return el.tagName.toLowerCase() + ":nth-of-type(" + i + ")"; }
  function pathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) {
        parts.unshift("#" + el.id); var rt = el.getRootNode();
        return (rt && rt.host ? pathOf(rt.host) + ">>>" : "") + parts.join(">");
      }
      if (el === D.body) { parts.unshift("body"); return parts.join(">"); }
      parts.unshift(nth(el)); var p = el.parentNode;
      if (p && p.nodeType === 11 && p.host) return pathOf(p.host) + ">>>" + parts.join(">");
      el = p;
    }
    return parts.join(">");
  }
  function resolve(sel) {
    var segs = sel.split(">>>"), ctx = D, el = null;
    for (var i = 0; i < segs.length; i++) {
      if (!ctx) return null;
      try { el = ctx.querySelector(segs[i]); } catch (e) { return null; }
      if (!el) return null; ctx = el.shadowRoot || null;
    }
    return el;
  }

  /* ---------- tətbiq ---------- */
  function clean(h) { return String(h).replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?(<\/\s*\1\s*>|$)/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "").replace(/javascript:/gi, ""); }
  function applyOne(sel, e) {
    var el = resolve(sel); if (!el || (el.closest && el.closest("#dqed-bar,#dqed-ins"))) return;
    if (!el.__dqo) { el.__dqo = { t: el.children.length ? null : el.textContent, x: el.children.length ? el.innerHTML : null }; el.__dqv = { h: "" }; }
    var v = el.__dqv;
    if (e.t != null && !el.children.length) { if (v.t !== e.t) { el.textContent = e.t; v.t = e.t; } }
    else if (v.t != null && el.__dqo.t != null) { el.textContent = el.__dqo.t; v.t = null; }
    if (e.x != null) { var c = clean(e.x); if (v.x !== c) { el.innerHTML = c; v.x = c; } }
    else if (v.x != null && el.__dqo.x != null) { el.innerHTML = el.__dqo.x; v.x = null; }
    var s = e.s || {};
    Object.keys(PR).forEach(function (k) {
      var p = PR[k], val = s[k];
      if (val != null && val !== "") {
        val = k === "fs" || k === "br" ? val + "px" : k === "op" ? val / 100 : k === "bi" ? "url('" + val + "')" : val;
        if (v[k] !== String(val)) {
          el.style.setProperty(p, val, "important"); v[k] = String(val);
          if (k === "bi") { el.style.setProperty("background-size", "cover", "important"); el.style.setProperty("background-position", "center", "important"); }
        }
      } else if (v[k] != null) { el.style.removeProperty(p); if (k === "bi") { el.style.removeProperty("background-size"); el.style.removeProperty("background-position"); } v[k] = null; }
    });
    var hv = e.h ? (S.on ? "o" : "d") : "";
    if (v.h !== hv) {
      el.style.removeProperty(v.h === "o" ? "opacity" : "display");
      if (hv) el.style.setProperty(hv === "o" ? "opacity" : "display", hv === "o" ? ".25" : "none", "important");
      v.h = hv;
    }
  }
  function applyAll() { Object.keys(S.edits).forEach(function (k) { try { applyOne(k, S.edits[k]); } catch (e) { } }); }
  function cache() { try { localStorage.setItem(CK, JSON.stringify({ edits: S.edits })); } catch (e) { } }

  /* ---------- verilənlər bazası ---------- */
  async function load() {
    try {
      if (V2.probe) await V2.probe();
      var r = (await V2.list(COL))[0];
      if (r) { S.id = r._id; if (r.edits && typeof r.edits === "object" && !S.dirty) { S.edits = r.edits; cache(); } }
      applyAll();
    } catch (e) { console.warn("[DQED] yüklənmədi", e); }
  }
  async function save() {
    if (S.busy) return; S.busy = true; stat("Saxlanılır…");
    try {
      var json = JSON.stringify(S.edits); if (json.length > 1500000) throw new Error("Dəyişikliklər çox böyükdür (şəkilləri azaldın)");
      if (V2.probe) await V2.probe();
      await V2.put(COL, { edits: S.edits, v: 1, at: new Date().toISOString() }, S.id || undefined);
      if (!S.id) { var r = (await V2.list(COL))[0]; S.id = r && r._id; }
      cache(); S.dirty = false; stat("✅ Saxlanıldı"); try { V2.toast("Dizayn dəyişiklikləri saxlanıldı ✅"); } catch (e) { }
    } catch (x) { stat("● saxlanmadı"); alert("Saxlanmadı: " + (x && x.message || x)); }
    S.busy = false;
  }

  /* ---------- redaktə rejimi ---------- */
  var CSS = "html.dqed-on{margin-top:48px}#dqed-bar{position:fixed;top:0;left:0;right:0;height:48px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:0 10px;background:linear-gradient(180deg,#0a1c52,#06112e);border-bottom:2px solid #f6c453;color:#fff;font:700 13px 'Plus Jakarta Sans',system-ui,sans-serif}" +
    "#dqed-bar b{color:#f6c453;white-space:nowrap}#dqed-nav{flex:1;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}#dqed-bar button,#dqed-ins button{font:700 12px inherit;font-family:inherit;border:0;border-radius:8px;padding:7px 11px;cursor:pointer;white-space:nowrap;background:rgba(255,255,255,.12);color:#fff}" +
    "#dqed-bar button.g{background:linear-gradient(135deg,#f6c453,#e5a82c);color:#1a1403}#dqed-st{font-weight:600;color:#aebbe3;white-space:nowrap}" +
    "#dqed-ins{position:fixed;left:0;right:0;bottom:0;max-height:48vh;overflow:auto;z-index:2147483000;background:#fff;color:#0a1c52;border-top:3px solid #f6c453;box-shadow:0 -14px 40px rgba(6,17,46,.35);padding:10px 14px 16px;font:600 13px 'Plus Jakarta Sans',system-ui,sans-serif;display:none}" +
    "@media(min-width:900px){#dqed-ins{left:auto;right:14px;bottom:14px;width:340px;max-height:80vh;border:1px solid #dfe3f1;border-top:3px solid #f6c453;border-radius:16px}}" +
    "#dqed-ins .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}#dqed-ins .hd button{background:#eef1fb;color:#0a1c52}#dqed-ins label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;color:#4b5679}" +
    "#dqed-ins label>span{flex:none}#dqed-ins input[type=range]{flex:1}#dqed-ins input[type=color]{width:46px;height:30px;border:0;padding:0;background:none}#dqed-ins textarea,#dqed-ins select{width:100%;border:1px solid #dfe3f1;border-radius:8px;padding:8px;font:inherit;color:#0a1c52;box-sizing:border-box}" +
    "#dqed-ins .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}#dqed-ins .row button{background:#eef1fb;color:#0a1c52}#dqed-ins .row button.r{background:#fee2e2;color:#b91c1c}";
  function stat(t) { var s = $("dqed-st"); if (s) s.textContent = t != null ? t : (S.dirty ? "● saxlanmamış" : ""); }
  function hex(c) { var m = String(c).match(/\d+(\.\d+)?/g); if (!m || (m.length > 3 && +m[3] === 0)) return "#ffffff"; return "#" + m.slice(0, 3).map(function (n) { return ("0" + (+n | 0).toString(16)).slice(-2); }).join(""); }
  function go(fn) { desel(); S.bypass = true; try { window.LXP && LXP.close && LXP.close(); } catch (e) { } try { fn(); } catch (e) { console.warn(e); } S.bypass = false; setTimeout(applyAll, 500); setTimeout(applyAll, 1500); }
  function build() {
    if (!$("dqed-css")) { var st = D.createElement("style"); st.id = "dqed-css"; st.textContent = CSS; D.head.appendChild(st); }
    if (!D.getElementById("dqed-fonts")) { var l = D.createElement("link"); l.id = "dqed-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=Caveat:wght@600&display=swap"; D.head.appendChild(l); }
    var bar = D.createElement("div"); bar.id = "dqed-bar";
    bar.innerHTML = '<b>✏️ Redaktə rejimi</b><div id="dqed-nav"></div><span id="dqed-st"></span><button type="button" class="g" data-a="save">💾 Saxla</button><button type="button" data-a="all">↺ Hamısı</button><button type="button" data-a="out">Çıx</button>';
    var ins = D.createElement("div"); ins.id = "dqed-ins";
    D.body.appendChild(bar); D.body.appendChild(ins); D.documentElement.classList.add("dqed-on");
    var items = [["🏠 Ana səhifə", function () { showScreen("v3-home"); }]];
    [].forEach.call(D.querySelectorAll("#v3-home .v3-nav a"), function (a, i) {
      if (/ana\s*s/i.test(a.textContent)) return;
      items.push(["▸ " + a.textContent.trim(), function () { showScreen("v3-home"); var l = D.querySelectorAll("#v3-home .v3-nav a")[i]; l && l.click(); }]);
    });
    if (window.LXP && LXP.open) items.push(["📋 Qeydiyyat portalı", function () { LXP.open(); }]);
    var nav = $("dqed-nav");
    items.forEach(function (it) { var b = D.createElement("button"); b.type = "button"; b.textContent = it[0]; b.onclick = function () { go(it[1]); }; nav.appendChild(b); });
    bar.addEventListener("click", function (e) {
      var a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === "save") save(); else if (a === "out") exit();
      else if (a === "all") { if (!confirm("Bütün dizayn dəyişiklikləri silinsin?")) return; desel(); var old = S.edits; S.edits = {}; Object.keys(old).forEach(function (k) { applyOne(k, {}); }); S.dirty = true; stat(); }
    });
    ins.addEventListener("input", onInput); ins.addEventListener("change", onChange); ins.addEventListener("click", onInsClick);
  }
  function inUi(path) { return path.some(function (n) { return n && (n.id === "dqed-bar" || n.id === "dqed-ins"); }); }
  function hover(e) { if (!S.on) return; var p = e.composedPath(); if (inUi(p)) return; var t = p[0]; if (!t || t.nodeType !== 1 || t === S.hov || t === S.el) return; unhover(); S.hov = t; t.__dqho = t.style.outline; t.style.outline = "2px dashed #f6c453"; }
  function unhover() { if (S.hov) { S.hov.style.outline = S.hov.__dqho || ""; S.hov = null; } }
  function pick(e) {
    if (!S.on || S.bypass) return; var p = e.composedPath(); if (inUi(p)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var t = p[0]; if (!t || t.nodeType !== 1) return; unhover(); desel();
    S.el = t; S.sel = pathOf(t); t.__dqso = t.style.outline; t.style.outline = "2px solid #f6c453"; render();
  }
  function desel() { if (S.el) { S.el.style.outline = S.el.__dqso || ""; } S.el = null; S.sel = ""; var i = $("dqed-ins"); if (i) i.style.display = "none"; }
  function render() {
    var el = S.el, box = $("dqed-ins"); if (!el) { box.style.display = "none"; return; }
    var e = S.edits[S.sel] || { s: {} }, s = e.s || {}, cs = getComputedStyle(el), leaf = !el.children.length;
    var inl = !leaf && [].every.call(el.children, function (c) { return /^(B|I|EM|STRONG|BR|SPAN|U|SMALL)$/.test(c.tagName) && !c.children.length; });
    var cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "";
    var h = '<div class="hd"><b>' + esc(el.tagName.toLowerCase() + cls) + '</b><button data-a="x">✕ Bağla</button></div>';
    if (leaf) h += '<label style="display:block"><span>Mətn</span><textarea rows="2" data-k="t">' + esc(e.t != null ? e.t : el.textContent) + "</textarea></label>";
    else if (inl) h += '<label style="display:block"><span>Mətn (sadə HTML: &lt;em&gt; &lt;b&gt; &lt;br&gt;)</span><textarea rows="3" data-k="x">' + esc(e.x != null ? e.x : el.innerHTML) + "</textarea></label>";
    var col = function (k, lbl, v) { return "<label><span>" + lbl + '</span><span><input type="color" data-k="' + k + '" value="' + v + '"> <button data-r="' + k + '">↺</button></span></label>'; };
    var rng = function (k, lbl, min, max, v) { return "<label><span>" + lbl + '</span><input type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" value="' + Math.round(v) + '"><button data-r="' + k + '">↺</button></label>'; };
    h += col("color", "Mətn rəngi", s.color || hex(cs.color)) + col("bg", "Fon rəngi", s.bg || hex(cs.backgroundColor)) +
      rng("fs", "Şrift ölçüsü", 8, 120, s.fs || parseFloat(cs.fontSize)) + rng("br", "Künc yuvarlaqlığı", 0, 80, s.br != null ? s.br : parseFloat(cs.borderTopLeftRadius) || 0) + rng("op", "Şəffaflıq", 5, 100, s.op != null ? s.op : cs.opacity * 100);
    h += '<label><span>Qalınlıq</span><select data-k="fw"><option value="">Standart</option>' + [400, 500, 600, 700, 800, 900].map(function (w) { return '<option value="' + w + '"' + (String(s.fw) === String(w) ? " selected" : "") + ">" + w + "</option>"; }).join("") + "</select></label>";
    h += '<label><span>Şrift</span><select data-k="ff">' + FF.map(function (f) { return '<option value="' + esc(f[1]) + '"' + (s.ff === f[1] ? " selected" : "") + ">" + f[0] + "</option>"; }).join("") + "</select></label>";
    h += '<label><span>Fon şəkli</span><span><input type="file" accept="image/*" data-img="1" style="max-width:150px"> ' + (s.bi ? '<button data-r="bi">🗑</button>' : "") + "</span></label>";
    h += '<label><span>Bu elementi gizlət</span><input type="checkbox" data-k="h"' + (e.h ? " checked" : "") + "></label>";
    h += '<div class="row"><button class="r" data-a="reset">↺ Bu elementi sıfırla</button></div>';
    box.innerHTML = h; box.style.display = "block";
  }
  function set(k, v) {
    var sel = S.sel; if (!sel) return;
    var e = S.edits[sel] || (S.edits[sel] = { s: {} }); e.s = e.s || {};
    if (k === "t" || k === "x") { if (v == null) delete e[k]; else e[k] = v; }
    else if (k === "h") { if (v) e.h = 1; else delete e.h; }
    else if (v === "" || v == null) delete e.s[k]; else e.s[k] = v;
    if (!Object.keys(e.s).length && e.t == null && e.x == null && !e.h) delete S.edits[sel];
    S.dirty = true; stat(); applyOne(sel, S.edits[sel] || {});
  }
  function onInput(ev) { var t = ev.target, k = t.dataset && t.dataset.k; if (!k || t.type === "checkbox" || t.tagName === "SELECT") return; set(k, t.type === "range" ? +t.value : t.value); }
  function onChange(ev) {
    var t = ev.target, k = t.dataset && t.dataset.k;
    if (t.dataset && t.dataset.img && t.files[0]) { shrink(t.files[0]).then(function (d) { set("bi", d); render(); }).catch(function (x) { alert("Xəta: " + (x && x.message || x)); }); return; }
    if (!k) return; if (t.type === "checkbox") set("h", t.checked); else if (t.tagName === "SELECT") set(k, t.value);
  }
  function onInsClick(ev) {
    var b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.r) { set(b.dataset.r, ""); render(); }
    else if (b.dataset.a === "x") desel();
    else if (b.dataset.a === "reset") { var sel = S.sel; delete S.edits[sel]; applyOne(sel, {}); S.dirty = true; stat(); render(); }
  }
  function shrink(file) {
    return new Promise(function (ok, no) {
      var r = new FileReader(); r.onerror = function () { no(new Error("Fayl oxunmadı")); };
      r.onload = function () {
        var im = new Image(); im.onerror = function () { no(new Error("Şəkil açılmadı")); };
        im.onload = function () {
          var W = Math.min(1280, im.width), H = Math.round(im.height * W / im.width), c = D.createElement("canvas"); c.width = W; c.height = H;
          c.getContext("2d").drawImage(im, 0, 0, W, H); var q = .85, d = "";
          for (var i = 0; i < 7; i++) { d = c.toDataURL("image/jpeg", q); if (d.length < 240000) break; q -= .1; }
          ok(d);
        }; im.src = r.result;
      }; r.readAsDataURL(file);
    });
  }
  async function open() {
    if (S.on) return; await load(); S.on = true; build(); stat("");
    D.addEventListener("click", pick, true); D.addEventListener("pointerover", hover, true);
    go(function () { showScreen("v3-home"); }); applyAll();
  }
  function exit() {
    if (S.dirty && !confirm("Saxlanmamış dəyişikliklər var. Yenə də çıxılsın?")) return;
    if (S.dirty) { S.dirty = false; try { var c = JSON.parse(localStorage.getItem(CK) || "null"); var old = S.edits; S.edits = c && c.edits || {}; Object.keys(old).forEach(function (k) { if (!S.edits[k]) applyOne(k, {}); }); } catch (e) { } }
    desel(); unhover(); S.on = false; D.removeEventListener("click", pick, true); D.removeEventListener("pointerover", hover, true);
    var a = $("dqed-bar"), b = $("dqed-ins"); a && a.remove(); b && b.remove(); D.documentElement.classList.remove("dqed-on");
    try { window.LXP && LXP.close && LXP.close(); } catch (e) { } applyAll(); try { showScreen("admin-panel"); } catch (e) { }
  }

  /* ---------- admin kartı ---------- */
  function addCard() {
    var g = D.querySelector("#admin-panel .admin-nav-grid"); if ($("dqed-card")) return true; if (!g) return false;
    var d = D.createElement("div"); d.id = "dqed-card"; d.className = "admin-nav-card";
    d.style.cssText = "background:linear-gradient(135deg,#06112e,#0c2260);color:#f6c453;box-shadow:inset 0 0 0 1px rgba(246,196,83,.6)";
    d.innerHTML = '<span class="icon">🎨</span> Premium redaktə'; d.onclick = open; g.appendChild(d); return true;
  }
  window.DQED = { open: open, apply: applyAll, edits: function () { return JSON.parse(JSON.stringify(S.edits)); }, reload: load };
  var n = 0, iv = setInterval(function () { if (window.V2 && V2.list) { clearInterval(iv); load(); } else if (++n > 160) clearInterval(iv); }, 250);
  var m = 0, iv2 = setInterval(function () { if (addCard() || ++m > 60) clearInterval(iv2); }, 500);
  var ap = $("admin-panel"); if (ap && window.MutationObserver) new MutationObserver(function () { if (!$("dqed-card")) addCard(); }).observe(ap, { childList: true, subtree: true });
  setInterval(applyAll, 1200); applyAll();
})();
