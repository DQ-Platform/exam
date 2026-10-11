/* =====================================================================
   YSPRO — canlı dizayn redaktoru + mərkəzi baza sinxronu  (v1.0)
   ---------------------------------------------------------------------
   • Admin panelində "✦ YSPRO" kartı, İdarəçi V2-də "YSPRO" bölməsi,
     İdarəçi V3 redaktorunda "✦ YSPRO" düyməsi və admin üçün sayt kənarında
     "✦ YSPRO" nişanı var — hamısı eyni redaktoru açır.
   • Redaktədə istənilən bloka toxun → seç → sürüşdür / sıra dəyiş / mətni dəyiş /
     gizlət / ölçü, rəng.
   • Hər dəyişiklik mərkəzi bazaya ("pro2" kolleksiyası) YAZILIR, geri oxunub
     təsdiqlənir və bütün istifadəçilərdə yenilənmə tələb etmədən (20 san ərzində,
     realtime varsa dərhal) tətbiq olunur.
   • İdarəçi V3 ("v3cfg") üçün də eyni: yadda saxlanandan sonra bazadan geri oxunur,
     digər istifadəçilərin brauzeri isə dəyişikliyi avtomatik götürür.
   • İştirakçıya icazə (allowed_students) yazılışı yoxlanılır — səssiz uğursuzluq olmur.
   • app.js-dən sonra qoşulur.
   ===================================================================== */
(function () {
  "use strict";
  if (window.YSPRO) return;

  var COL = "pro2", CFG = "v3cfg", CK = "ys_pro2_cache_v1", POLL = 20000;
  var S = {
    rules: {}, on: false, sel: null, mode: "free", direct: false,
    grid: false, fr: true, step: 4, undo: [], redo: [], tm: 0,
    busy: false, editing: null, built: false, rail: false, min: false,
    status: "", stc: "", dirty: false, saving: false, again: false,
    sig: null, v3sig: null, lastOk: 0, lastPoll: 0
  };
  var orig = new Map();      // el -> {style, html, txt}
  var permParents = new Set();
  var D = null;              // aktiv sürüşdürmə
  var obs = null, applyTm = 0, loginAsked = 0;

  var $ = function (id) { return document.getElementById(id); };
  var isAdm = function () { return window.__dqAuthed === true; };
  var gV2 = function () { return typeof V2 !== "undefined" ? V2 : null; };
  var gV3 = function () { return typeof V3 !== "undefined" ? V3 : null; };
  var gSB = function () { return typeof _supabase !== "undefined" ? _supabase : null; };

  var SKIPTAG = /^(SCRIPT|STYLE|NOSCRIPT|LINK|META|TEMPLATE)$/;
  var INLINE_UP = /^(B|STRONG|EM|U|SMALL|BR|SUB|SUP|MARK|TSPAN|PATH|CIRCLE|RECT|G|LINE|POLYGON|POLYLINE|ELLIPSE|USE|TEXT)$/i;
  var INLINE_OK = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1, SMALL: 1, SUB: 1, SUP: 1, MARK: 1 };
  var NOTEXT = /^(IMG|INPUT|SELECT|TEXTAREA|SVG|CANVAS|TABLE|VIDEO|IFRAME|HR)$/i;
  var UIQ = "#p2-root,#p2-root *,#p2-h,#p2-h *,#p2-done,#p2-done *,#p2-toast,.p2-g";
  var V3GO = /V3\.go\('([^']+)'\)/;

  /* ---------- ümumi köməkçilər ---------- */
  function st(o) {            // sabit (açar sırasından asılı olmayan) stringify
    if (o === null || typeof o !== "object") return JSON.stringify(o);
    if (Array.isArray(o)) return "[" + o.map(st).join(",") + "]";
    return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + st(o[k]); }).join(",") + "}";
  }
  function hm(d) { d = d || new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function askLogin() {
    if (Date.now() - loginAsked < 60000) return;
    loginAsked = Date.now();
    try { window.__dqAdminLogin && window.__dqAdminLogin(); } catch (e) { }
  }
  function em(e) {
    var m = String(e && (e.message || e.error_description || e.details) || e || "");
    if (/jwt|expired|invalid token|401/i.test(m)) { askLogin(); return "Admin sessiyası bitib — yenidən daxil olun"; }
    return m || "naməlum xəta";
  }
  function flash(t) {         // redaktor qurulmamışkən də işləyən kiçik bildiriş
    try {
      var e = $("ys-flash");
      if (!e) {
        e = document.createElement("div"); e.id = "ys-flash"; e.setAttribute("data-p2ui", "1");
        e.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100050;background:#1e1b4b;color:#fff;border-radius:99px;padding:10px 18px;font:700 13px system-ui,sans-serif;max-width:90vw;text-align:center;box-shadow:0 8px 22px #0006;pointer-events:none;transition:opacity .25s";
        document.body.appendChild(e);
      }
      e.textContent = t; e.style.opacity = "1";
      clearTimeout(flash.t); flash.t = setTimeout(function () { e.style.opacity = "0"; }, 2600);
    } catch (er) { }
  }

  /* ---------- MƏRKƏZİ BAZA (keşi yan keçir, yazını doğrula) ---------- */
  var DB = {
    many: async function (cols) {
      var c = gSB(); if (!c) throw new Error("Supabase hazır deyil");
      var q = await c.from("dq_v2_store").select("id,collection,data").in("collection", cols).order("id", { ascending: false });
      if (q.error) throw q.error;
      var out = {};
      (q.data || []).forEach(function (r) { if (!out[r.collection]) out[r.collection] = r; });   // ən yeni sətir
      return out;
    },
    one: async function (col) { var m = await DB.many([col]); return m[col] || null; },
    write: async function (col, data) {
      var c = gSB(); if (!c) throw new Error("Supabase hazır deyil");
      var cur = await DB.one(col), q;
      if (cur) {
        q = await c.from("dq_v2_store").update({ data: data }).eq("id", cur.id).select("id");
      } else {
        q = await c.from("dq_v2_store").insert([{ collection: col, data: data }]).select("id");
      }
      if (q.error) throw q.error;
      if (!q.data || !q.data.length) throw new Error("Server yazmağa icazə vermədi — admin sessiyası bitmiş ola bilər");
      var back = await DB.one(col);
      if (!back || st(back.data) !== st(data)) throw new Error("Bazadan geri oxunanda dəyişiklik təsdiqlənmədi");
      return back.id;
    }
  };

  /* ---------- açar / mövqe ---------- */
  function kids(p) {
    return p ? [].filter.call(p.children, function (c) {
      return !c.hasAttribute("data-p2ui") && !SKIPTAG.test(c.tagName);
    }) : [];
  }
  function stamp(par) {
    if (!par) return;
    var ks = kids(par), has = ks.some(function (c) { return c.hasAttribute("data-p2i"); });
    ks.forEach(function (c, i) {
      if (!c.hasAttribute("data-p2i")) c.setAttribute("data-p2i", has ? 1000 + i : i);
    });
  }
  function v3id(n) {
    var m = V3GO.exec((n.getAttribute && n.getAttribute("onclick")) || "");
    return m ? m[1].replace(/\//g, "_") : null;
  }
  function tokOf(c) { var v = v3id(c); return v ? "~" + v : "i" + c.getAttribute("data-p2i"); }
  function idxOf(n) {
    var v = v3id(n);
    if (v) return "~" + v;                       // V3 düymələri: sabit açar (sıra/gizlətmədən asılı deyil)
    return n.hasAttribute("data-p2i") ? +n.getAttribute("data-p2i") : kids(n.parentNode).indexOf(n);
  }
  function keyOf(el) {
    var parts = [], n = el;
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.id && !/\d{5,}/.test(n.id) && !/^p2-/.test(n.id)) {
        parts.unshift("#" + n.id);
        return parts.join("/");
      }
      parts.unshift(idxOf(n));
      n = n.parentNode;
    }
    parts.unshift("body");
    return parts.join("/");
  }
  function resolve(k) {
    var p = k.split("/"), h = p.shift(), n;
    n = h === "body" ? document.body : document.getElementById(h.slice(1));
    if (!n) return null;
    for (var i = 0; i < p.length; i++) {
      var ks = kids(n), found = null, seg = p[i];
      if (seg.charAt(0) === "~") {
        found = ks.filter(function (c) { return v3id(c) === seg.slice(1); })[0] || null;
      } else {
        var idx = +seg;
        if (ks.some(function (c) { return c.hasAttribute("data-p2i"); })) {
          found = ks.filter(function (c) { return +c.getAttribute("data-p2i") === idx; })[0] || null;
        } else found = ks[idx] || null;
      }
      if (!found) return null;
      n = found;
    }
    return n;
  }
  function hzKey() {
    var n = document.querySelector("#v3-hz .hz-nav .nav-btn.active [data-p]"),
      t = document.querySelector("#v3-hz .hz-tab.active [data-p]");
    return (n ? n.getAttribute("data-p") : "") + "|" + (t ? t.getAttribute("data-p") : "");
  }
  function pkOf(el) {
    var s = el.closest && el.closest(".screen");
    if (!s) return "g";
    if (s.id === "v3-hz") return el.closest(".hz-main") ? "hz:" + hzKey() : "hz:chrome";
    return s.id || "s";
  }
  function curPages() {
    var ks = ["g"];
    [].forEach.call(document.querySelectorAll(".screen"), function (s) {
      if (s.id === "v3-hz") { ks.push("hz:chrome"); ks.push("hz:" + hzKey()); }
      else if (s.id) ks.push(s.id);
    });
    return ks;
  }
  function activePk() {
    var s = document.querySelector(".screen.active");
    if (!s) return "g";
    return s.id === "v3-hz" ? "hz:" + hzKey() : (s.id || "s");
  }
  function rule(el) {
    var pk = pkOf(el), k = keyOf(el);
    S.rules[pk] = S.rules[pk] || {};
    return S.rules[pk][k] || (S.rules[pk][k] = {});
  }
  function getRule(el) {
    var pk = pkOf(el), k = keyOf(el);
    return (S.rules[pk] || {})[k] || {};
  }
  function clean() {
    Object.keys(S.rules).forEach(function (pk) {
      Object.keys(S.rules[pk]).forEach(function (k) {
        var r = S.rules[pk][k];
        Object.keys(r).forEach(function (f) {
          if (r[f] === "" || r[f] == null || r[f] === false || ((f === "x" || f === "y") && !r[f]) ||
            (f === "perm" && r[f].every(function (v, i) { return v === "i" + i; }))) delete r[f];
        });
        if (!Object.keys(r).length) delete S.rules[pk][k];
      });
      if (!Object.keys(S.rules[pk]).length) delete S.rules[pk];
    });
  }
  function remember(el, withText) {
    var o = orig.get(el);
    if (!o) { o = { style: el.getAttribute("style"), html: null, txt: false }; orig.set(el, o); }
    if (withText && !o.txt) { o.html = el.innerHTML; o.txt = true; }
    return o;
  }
  function label(el) {
    var c = typeof el.className === "string" ? el.className.split(/\s+/).filter(function (x) { return x && x.indexOf("p2-") !== 0; })[0] : "";
    return el.tagName.toLowerCase() + (c ? "." + c : "");
  }
  function snippet(el, n) {
    return String(el.textContent || el.getAttribute("alt") || "").replace(/\s+/g, " ").trim().slice(0, n || 24);
  }
  function getT(el) {
    var m = String(el.style.translate || "").match(/-?[\d.]+/g);
    return m ? [parseFloat(m[0]) || 0, parseFloat(m[1]) || 0] : [0, 0];
  }
  function setT(el, x, y) {
    x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2;
    if (x || y) el.style.setProperty("translate", x + "px " + y + "px");
    else el.style.removeProperty("translate");
  }
  function canText(el) {
    if (!el || NOTEXT.test(el.tagName)) return false;
    return [].every.call(el.children, function (c) { return INLINE_OK[c.tagName]; });
  }
  function sanitize(h) {
    var ALLOW = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1, SMALL: 1, SUB: 1, SUP: 1, MARK: 1 };
    var d = new DOMParser().parseFromString("<body>" + String(h) + "</body>", "text/html");
    (function w(n) {
      [].slice.call(n.children).forEach(function (c) {
        w(c);
        if (!ALLOW[c.tagName]) { c.replaceWith.apply(c, [].slice.call(c.childNodes)); return; }
        [].slice.call(c.attributes).forEach(function (a) {
          if (a.name === "style") {
            var s = a.value.split(";").map(function (x) { return x.trim(); }).filter(function (x) {
              return /^(color|font-weight|font-size|background-color|text-decoration|font-style)\s*:\s*[#\w\s(),.%-]+$/i.test(x);
            }).join(";");
            s ? c.setAttribute("style", s) : c.removeAttribute("style");
          } else if (a.name === "class" && /^[\w\s-]+$/.test(a.value)) { /* saxla */ }
          else c.removeAttribute(a.name);
        });
      });
    })(d.body);
    return d.body.innerHTML;
  }
  function toast(t) {
    var e = $("p2-toast");
    if (!e) return flash(t);
    e.textContent = t; e.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2000);
  }

  /* ---------- qaydaları DOM-a tətbiq et ---------- */
  function applyPerm(par, perm) {
    stamp(par);
    var ks = kids(par), map = {}, want = [];
    ks.forEach(function (c) { map[tokOf(c)] = c; });
    perm.forEach(function (t) { if (map[t] && want.indexOf(map[t]) < 0) want.push(map[t]); });
    if (!want.length) return;
    ks.forEach(function (c) { if (want.indexOf(c) < 0) want.push(c); });   // yeni əlavə olunanlar sonda qalır
    if (want.every(function (c, i) { return c === ks[i]; })) return;
    permParents.add(par);
    var ref = ks[ks.length - 1].nextSibling;
    want.forEach(function (c) { par.insertBefore(c, ref); });
  }
  function paint(el, r) {
    remember(el);
    if (r.perm) applyPerm(el, r.perm);
    setT(el, r.x || 0, r.y || 0);
    r.s ? el.style.setProperty("scale", r.s) : el.style.removeProperty("scale");
    r.fs ? el.style.setProperty("font-size", r.fs + "px", "important") : el.style.removeProperty("font-size");
    r.c ? el.style.setProperty("color", r.c, "important") : el.style.removeProperty("color");
    r.bg ? el.style.setProperty("background-color", r.bg, "important") : el.style.removeProperty("background-color");
    if (r.h) {
      if (S.on) { el.style.removeProperty("display"); el.classList.add("p2-ghost"); }
      else { el.classList.remove("p2-ghost"); el.style.setProperty("display", "none", "important"); el.setAttribute("aria-hidden", "true"); }
    } else {
      el.classList.remove("p2-ghost");
      if (el.style.display === "none" && orig.get(el) && !/display\s*:\s*none/.test(orig.get(el).style || "")) { el.style.removeProperty("display"); el.removeAttribute("aria-hidden"); }
    }
    if (r.t != null && el.__p2t !== r.t) {
      remember(el, true);
      el.innerHTML = sanitize(r.t);
      el.__p2t = r.t;
    }
  }
  function applyAll() {
    if (S.busy) return;
    S.busy = true;
    if (obs) obs.disconnect();
    try {
      curPages().forEach(function (pk) {
        var pr = S.rules[pk];
        if (!pr) return;
        Object.keys(pr).sort(function (a, b) { return a.length - b.length; }).forEach(function (k) {
          var el = resolve(k);
          if (el && !el.matches(UIQ)) paint(el, pr[k]);
        });
      });
    } catch (e) { console.warn("[YSPRO]", e); }
    S.busy = false;
    observe();
  }
  function observe() {
    if (!obs) {
      obs = new MutationObserver(function () {
        clearTimeout(applyTm);
        applyTm = setTimeout(applyAll, 140);
      });
    }
    obs.observe(document.body, { childList: true, subtree: true });
  }
  function revertAll() {
    if (obs) obs.disconnect();
    orig.forEach(function (o, el) {
      if (o.style == null) el.removeAttribute("style"); else el.setAttribute("style", o.style);
      if (o.txt) { el.innerHTML = o.html; delete el.__p2t; }
      el.classList.remove("p2-ghost");
      el.removeAttribute("aria-hidden");
    });
    permParents.forEach(function (par) {
      var ks = kids(par);
      ks.filter(function (c) { return c.hasAttribute("data-p2i"); })
        .sort(function (a, b) { return +a.getAttribute("data-p2i") - +b.getAttribute("data-p2i"); })
        .forEach(function (c) { par.appendChild(c); });
    });
    orig.clear(); permParents.clear();
    observe();
  }

  /* ---------- keş (ilk görüntüdə gizlədilənlər görünməsin deyə) ---------- */
  function cacheGet() { try { var j = JSON.parse(localStorage.getItem(CK) || "null"); return j && j.rules && typeof j.rules === "object" ? j.rules : null; } catch (e) { return null; } }
  function cacheSet(r) { try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), rules: r })); } catch (e) { } }

  /* ---------- bazaya yaz / bazadan götür ---------- */
  function setStatus(t, cls) {
    S.status = t; S.stc = cls || "";
    var s = $("p2-st"); if (s) { s.textContent = t; s.className = cls || ""; }
    var rt = $("p2-retry"); if (rt) rt.hidden = cls !== "err";
  }
  function save() {
    S.dirty = true;
    setStatus("Saxlanmamış dəyişiklik…", "wait");
    clearTimeout(S.tm);
    S.tm = setTimeout(flush, 600);
  }
  async function flush() {
    clearTimeout(S.tm);
    if (S.saving) { S.again = true; return; }
    S.saving = true;
    setStatus("Mərkəzi bazaya yazılır…", "wait");
    try {
      clean();
      var data = { rules: JSON.parse(JSON.stringify(S.rules)), t: Date.now() };
      await DB.write(COL, data);
      S.sig = st(data.rules);
      S.lastOk = Date.now();
      cacheSet(data.rules);
      if (!S.again) S.dirty = false;
      setStatus("✓ Mərkəzi bazaya yazıldı və təsdiqləndi · " + hm() + " — bütün istifadəçilər üçün aktivdir", "ok");
    } catch (e) {
      setStatus("❌ Bazaya yazılmadı: " + em(e), "err");
      toast("Bazaya yazılmadı ❌");
    } finally {
      S.saving = false;
      if (S.again) { S.again = false; flush(); }
    }
  }
  function snap() {
    S.undo.push(JSON.stringify(S.rules));
    if (S.undo.length > 60) S.undo.shift();
    S.redo = [];
  }
  function restoreRules(js) {
    revertAll();
    S.rules = JSON.parse(js);
    applyAll(); save(); renderAll();
  }
  function applyRemote(rules) {
    revertAll();
    S.rules = JSON.parse(JSON.stringify(rules || {}));
    applyAll(); cacheSet(S.rules);
    if (S.built) renderAll();
  }
  /* Bütün istifadəçilər üçün: bazadakı ən son qaydalar + V3 konfiqi */
  async function poll(force) {
    if (document.hidden && !force) return;
    var m;
    try { m = await DB.many([COL, CFG]); } catch (e) { return; }
    S.lastPoll = Date.now();
    var p = m[COL], rules = (p && p.data && p.data.rules) || {};
    if (!S.dirty && !S.saving && !D && !S.editing && (!S.on || force === "admin")) {
      var sg = st(rules);
      if (sg !== S.sig) { S.sig = sg; applyRemote(rules); }
    }
    var c = m[CFG], cs = c ? st(c.data) : "";
    if (S.v3sig == null) { S.v3sig = cs; return; }
    if (cs !== S.v3sig) {
      var V = gV3(), root = $("v3-root");
      var open = !!(root && root.style.display === "block");
      if (V && V.load && !V.dirty && !V.busy && !open) {
        S.v3sig = cs;
        try { await V.load(); } catch (e) { }
      }
    }
  }
  async function pullNow() {
    setStatus("Bazadan yenilənir…", "wait");
    try {
      S.dirty = false; clearTimeout(S.tm);
      await poll("admin");
      setStatus("✓ Bazadakı son vəziyyət yükləndi · " + hm(), "ok");
      toast("Bazadan yeniləndi ✓");
    } catch (e) { setStatus("❌ " + em(e), "err"); }
  }
  async function verify() {
    setStatus("Bazada yoxlanılır…", "wait");
    try {
      clean();
      var m = await DB.many([COL, CFG]);
      var rules = (m[COL] && m[COL].data && m[COL].data.rules) || {}, n = 0, h = 0;
      Object.keys(rules).forEach(function (pk) { Object.keys(rules[pk]).forEach(function (k) { n++; if (rules[pk][k].h) h++; }); });
      var same = st(rules) === st(S.rules);
      var v3 = m[CFG] && m[CFG].data, v3h = 0;
      if (v3 && v3.items) Object.keys(v3.items).forEach(function (k) { if (v3.items[k] && v3.items[k].h) v3h++; });
      var msg = "Bazada: " + n + " qayda (" + h + " gizli blok) · V3-də gizlədilmiş düymə: " + v3h + " · yerli ilə " + (same ? "eynidir ✓" : "FƏRQLİDİR ✗");
      setStatus(msg, same ? "ok" : "err");
      toast(same ? "Baza ilə üst-üstə düşür ✓" : "Baza ilə fərq var ✗");
    } catch (e) { setStatus("❌ " + em(e), "err"); }
  }

  /* ---------- seçim ---------- */
  function norm(t) {
    if (t && t.nodeType !== 1) t = t.parentElement;
    if (!t) return null;
    var sv = t.closest && t.closest("svg");
    if (sv && t !== sv) t = sv;
    while (t && INLINE_UP.test(t.tagName) && t.parentElement) t = t.parentElement;
    if (!t || /^(HTML|BODY|HEAD)$/.test(t.tagName) || t.classList.contains("screen")) return null;
    return t;
  }
  function select(el) {
    if (S.sel) S.sel.classList.remove("p2-sel", "p2-mvon");
    S.sel = el || null;
    S.direct = false;
    if (el) {
      el.classList.add("p2-sel");
      for (var n = el; n && n !== document.body; n = n.parentNode) stamp(n.parentNode);   // açarlar sabit qalsın
    }
    renderAll();
  }
  function chain(el) {
    var out = [], n = el;
    while (n && out.length < 7 && n !== document.body && !n.classList.contains("screen")) { out.push(n); n = n.parentElement; }
    return out;
  }

  /* ---------- sürüşdürmə ---------- */
  function startDrag(e) {
    var el = S.sel;
    if (!el || D) return;
    e.preventDefault(); e.stopPropagation();
    snap();
    remember(el);
    stamp(el.parentNode);
    var fixed = getComputedStyle(el).position === "fixed";
    var r0 = el.getBoundingClientRect();
    var sx = window.scrollX, sy = window.scrollY;
    D = {
      el: el, mode: S.mode, id: e.pointerId, fixed: fixed, moved: false,
      spX: e.clientX + (fixed ? 0 : sx), spY: e.clientY + (fixed ? 0 : sy),
      r0: { l: r0.left + (fixed ? 0 : sx), t: r0.top + (fixed ? 0 : sy), w: r0.width, h: r0.height },
      last: e, cand: null, lastSwap: 0
    };
    el.style.pointerEvents = "none";
    el.classList.add("p2-drag");
    document.documentElement.classList.add("p2-dragging");
    var cx = [], cy = [], par = el.parentNode;
    if (S.mode === "free") {
      var pr = par.getBoundingClientRect();
      cx.push(pr.left + sx, pr.left + sx + pr.width / 2, pr.left + sx + pr.width);
      cy.push(pr.top + sy, pr.top + sy + pr.height / 2, pr.top + sy + pr.height);
      kids(par).filter(function (c) { return c !== el; }).slice(0, 60).forEach(function (c) {
        var r = c.getBoundingClientRect();
        if (!r.width && !r.height) return;
        cx.push(r.left + sx, r.left + sx + r.width / 2, r.left + sx + r.width);
        cy.push(r.top + sy, r.top + sy + r.height / 2, r.top + sy + r.height);
      });
    }
    D.cand = { x: cx, y: cy };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
    D.auto = setInterval(autoScroll, 16);
  }
  function autoScroll() {
    if (!D || !D.last) return;
    var y = D.last.clientY, v = 0;
    if (y < 80) v = -Math.ceil((80 - y) / 6);
    else if (y > innerHeight - 120) v = Math.ceil((y - (innerHeight - 120)) / 6);
    if (v) { scrollBy(0, v); doMove(D.last); }
  }
  function onMove(e) {
    if (!D || e.pointerId !== D.id) return;
    e.preventDefault();
    D.last = e;
    doMove(e);
  }
  function doMove(e) {
    var el = D.el, sx = D.fixed ? 0 : scrollX, sy = D.fixed ? 0 : scrollY;
    var dx = e.clientX + sx - D.spX, dy = e.clientY + sy - D.spY;
    if (!D.moved && Math.hypot(dx, dy) < 4) return;
    D.moved = true;
    var wl = D.r0.l + dx, wt = D.r0.t + dy, gx = null, gy = null;
    if (D.mode === "free") {
      var best = 7;
      [0, D.r0.w / 2, D.r0.w].forEach(function (off) {
        D.cand.x.forEach(function (c) { var d = c - (wl + off); if (Math.abs(d) < Math.abs(best)) { best = d; gx = c; } });
      });
      if (gx != null && Math.abs(best) < 7) wl += best; else gx = null;
      best = 7;
      [0, D.r0.h / 2, D.r0.h].forEach(function (off) {
        D.cand.y.forEach(function (c) { var d = c - (wt + off); if (Math.abs(d) < Math.abs(best)) { best = d; gy = c; } });
      });
      if (gy != null && Math.abs(best) < 7) wt += best; else gy = null;
    }
    el.style.setProperty("translate", "none");
    var n = el.getBoundingClientRect();
    var tx = wl - sx - n.left, ty = wt - sy - n.top;
    if (S.grid && D.mode === "free") { tx = Math.round(tx / 8) * 8; ty = Math.round(ty / 8) * 8; }
    el.style.setProperty("translate", tx + "px " + ty + "px");
    drawGuides(gx != null ? gx - sx : null, gy != null ? gy - sy : null);
    if (D.mode === "order") reorderAt(e.clientX, e.clientY);
  }
  function reorderAt(px, py) {
    var now = Date.now();
    if (now - D.lastSwap < 90) return;
    var el = D.el, par = el.parentNode, list = document.elementsFromPoint(px, py), hit = null;
    for (var i = 0; i < list.length && !hit; i++) {
      var a = list[i];
      while (a && a.parentNode !== par) a = a.parentNode;
      if (a && a !== el && !a.hasAttribute("data-p2ui") && !SKIPTAG.test(a.tagName)) hit = a;
    }
    if (!hit) return;
    var r = hit.getBoundingClientRect(), cxm = r.left + r.width / 2, cym = r.top + r.height / 2;
    var horiz = Math.abs(px - cxm) / Math.max(1, r.width) > Math.abs(py - cym) / Math.max(1, r.height);
    var before = horiz ? px < cxm : py < cym;
    if (before ? el.nextElementSibling === hit : el.previousElementSibling === hit) return;
    permParents.add(par);
    par.insertBefore(el, before ? hit : hit.nextElementSibling);
    D.lastSwap = now;
  }
  function drawGuides(x, y) {
    var gx = $("p2-gx"), gy = $("p2-gy");
    if (gx) { gx.style.display = x == null ? "none" : "block"; if (x != null) gx.style.left = Math.round(x) + "px"; }
    if (gy) { gy.style.display = y == null ? "none" : "block"; if (y != null) gy.style.top = Math.round(y) + "px"; }
  }
  function endDrag(e) {
    if (!D || (e && e.pointerId !== D.id)) return;
    var el = D.el, d = D;
    D = null;
    clearInterval(d.auto);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);
    el.style.removeProperty("pointer-events");
    el.classList.remove("p2-drag");
    document.documentElement.classList.remove("p2-dragging");
    drawGuides(null, null);
    if (!d.moved) { S.undo.pop(); return; }
    if (d.mode === "order") {
      var par = el.parentNode;
      el.style.setProperty("transition", "translate .18s ease");
      el.style.setProperty("translate", "none");
      setTimeout(function () { el.style.removeProperty("transition"); }, 230);
      var pr = rule(par);
      pr.perm = kids(par).map(tokOf);
      var er = getRule(el); if (er.x || er.y) { er.x = 0; er.y = 0; }
      toast("Sıra dəyişdi ✓");
    } else {
      var t = getT(el), r = rule(el);
      r.x = t[0]; r.y = t[1];
      toast("Yer dəyişdi ✓");
    }
    save(); renderAll();
  }

  /* ---------- əməliyyatlar ---------- */
  function nudge(dx, dy) {
    var el = S.sel; if (!el) return;
    snap(); remember(el);
    var t = getT(el), r = rule(el);
    r.x = t[0] + dx * S.step; r.y = t[1] + dy * S.step;
    setT(el, r.x, r.y);
    save();
  }
  function startText() {
    var el = S.sel;
    if (!el) return;
    if (!canText(el)) { toast("Bu blokda mətni dəyişmək üçün içindəki yazıya toxunun"); return; }
    remember(el, true);
    S.editing = el;
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
    el.classList.add("p2-edit");
    el.focus();
    try { var rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); } catch (er) { }
    $("p2-done").hidden = false;
    $("p2-sheet").hidden = true;
    el.addEventListener("blur", function fin() {
      el.removeEventListener("blur", fin);
      endText();
    });
  }
  function endText() {
    var el = S.editing;
    if (!el) return;
    S.editing = null;
    el.removeAttribute("contenteditable");
    el.classList.remove("p2-edit");
    var dn = $("p2-done"); if (dn) dn.hidden = true;
    var h = sanitize(el.innerHTML), r = getRule(el);
    if (h !== (r.t != null ? r.t : (orig.get(el) && orig.get(el).html != null ? sanitize(orig.get(el).html) : h))) {
      snap();
      var rr = rule(el); rr.t = h; el.__p2t = h;
      save(); toast("Mətn saxlandı ✓");
    }
    renderAll();
  }
  function hideEl() {
    var el = S.sel; if (!el) return;
    snap(); remember(el);
    var r = rule(el); r.h = !r.h;
    paint(el, r); save(); renderAll();
    toast(r.h ? "Gizlədildi (sayt istifadəçilərindən də gizlənəcək)" : "Geri qaytarıldı");
  }
  function resetEl() {
    var el = S.sel; if (!el) return;
    snap();
    var pk = pkOf(el), k = keyOf(el);
    if (S.rules[pk]) delete S.rules[pk][k];
    var o = orig.get(el);
    if (o) {
      if (o.style == null) el.removeAttribute("style"); else el.setAttribute("style", o.style);
      if (o.txt) { el.innerHTML = o.html; delete el.__p2t; }
      el.classList.remove("p2-ghost");
    } else { ["translate", "scale", "font-size", "color", "background-color"].forEach(function (p) { el.style.removeProperty(p); }); }
    save(); renderAll(); toast("Element sıfırlandı");
  }
  function resetPage() {
    var pk = activePk();
    if (!confirm("Bu səhifədəki bütün YSPRO dəyişiklikləri silinsin?")) return;
    snap();
    revertAll();
    delete S.rules[pk];
    if (pk.indexOf("hz:") === 0) delete S.rules["hz:chrome"];
    applyAll(); save(); select(null); toast("Səhifə sıfırlandı");
  }
  function resetAll() {
    if (!confirm("BÜTÜN səhifələrdəki YSPRO dəyişiklikləri silinsin? (bütün istifadəçilərdə ilkin görünüş qayıdacaq)")) return;
    snap();
    revertAll();
    S.rules = {};
    applyAll(); save(); if (S.built) select(null); toast("Hamısı sıfırlandı");
  }
  function setProp(prop, val) {
    var el = S.sel; if (!el) return;
    remember(el);
    var r = rule(el);
    if (!setProp.snapped) { snap(); setProp.snapped = true; }
    clearTimeout(setProp.t);
    setProp.t = setTimeout(function () { setProp.snapped = false; }, 700);
    r[prop] = val;
    paint(el, r); save();
  }

  /* ---------- UI ---------- */
  var CSS = [
    "#p2-root,#p2-root *{box-sizing:border-box;font-family:inherit}",
    "#p2-tab{position:fixed;right:0;top:34%;z-index:100030;border:0;cursor:pointer;color:#fff;font:800 13px/1 inherit;letter-spacing:.5px;padding:14px 8px;border-radius:14px 0 0 14px;background:linear-gradient(160deg,#6366f1,#1e1b4b);box-shadow:-4px 6px 18px #0006;writing-mode:vertical-rl;text-orientation:mixed}",
    "#p2-tab.on{background:linear-gradient(160deg,#f59e0b,#b45309)}",
    "#p2-rail{position:fixed;right:8px;top:50%;transform:translateY(-50%);z-index:100031;width:236px;max-height:82vh;overflow:auto;background:#fff;color:#1e1b4b;border-radius:18px;box-shadow:0 14px 44px #0007;padding:10px;font:700 13px inherit}",
    "#p2-rail[hidden],#p2-sheet[hidden],#p2-done[hidden],#p2-h[hidden],#p2-retry[hidden]{display:none!important}",
    "#p2-rail .t{display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:14px;margin-bottom:8px}",
    "#p2-rail button,#p2-sheet button{border:1px solid #d9dcf3;background:#f6f6fd;border-radius:11px;padding:9px 10px;font:700 13px inherit;color:#1e1b4b;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    "#p2-rail button{display:block;width:100%;text-align:left;margin:5px 0}",
    "#p2-rail button.p,#p2-sheet button.p{background:#4f46e5;border-color:#4f46e5;color:#fff}",
    "#p2-rail button.on,#p2-sheet button.on{background:#f59e0b;border-color:#f59e0b;color:#1c1917}",
    "#p2-rail button.d,#p2-sheet button.d{background:#fee2e2;border-color:#fecaca;color:#b91c1c}",
    "#p2-rail button:disabled,#p2-sheet button:disabled{opacity:.38}",
    "#p2-rail .row2{display:flex;gap:6px}#p2-rail .row2 button{margin:5px 0}",
    "#p2-st{font-size:12px;color:#64748b;margin:6px 2px 0;min-height:16px;line-height:1.35}",
    "#p2-st.ok{color:#15803d}#p2-st.err{color:#b91c1c}#p2-st.wait{color:#b45309}",
    "#p2-hid{margin-top:6px;border-top:1px solid #e5e7ef;padding-top:6px}",
    "#p2-sheet{position:fixed;left:0;right:0;bottom:0;z-index:100032;max-height:48vh;overflow:auto;background:#fff;color:#1e1b4b;border-radius:20px 20px 0 0;box-shadow:0 -10px 40px #0005;padding:10px 12px calc(14px + env(safe-area-inset-bottom,0px));font:700 13px inherit}",
    "#p2-sheet .r{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}",
    "#p2-sheet .big{flex:1 1 140px;padding:13px 10px;font-size:14px;text-align:center}",
    "#p2-sheet .t{font-weight:900;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#p2-sheet .chips{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}",
    "#p2-sheet .chips button{flex:0 0 auto;padding:6px 9px;font-size:12px;border-radius:99px}",
    "#p2-sheet .pad{display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,40px);gap:5px}",
    "#p2-sheet .pad button{padding:0;font-size:18px}",
    "#p2-sheet label{display:flex;align-items:center;gap:6px;font-size:12px;color:#475569}",
    "#p2-sheet input[type=number]{width:62px;padding:7px;border:1px solid #d9dcf3;border-radius:8px}",
    "#p2-sheet input[type=color]{width:36px;height:34px;padding:0;border:1px solid #d9dcf3;border-radius:8px;background:none}",
    "#p2-sheet input[type=range]{width:110px}",
    "#p2-sheet .hint{font-size:12px;color:#64748b;font-weight:600}",
    "#p2-h{position:fixed;z-index:100033;width:44px;height:44px;border-radius:50%;background:#4f46e5;color:#fff;font:900 20px/44px inherit;text-align:center;box-shadow:0 6px 18px #0007;border:3px solid #fff;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}",
    "#p2-h.order{background:#f59e0b;color:#1c1917}",
    "#p2-done{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:100034;border:0;border-radius:99px;padding:12px 22px;font:800 14px inherit;color:#fff;background:#16a34a;box-shadow:0 8px 22px #0006}",
    "#p2-toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);opacity:0;z-index:100040;background:#1e1b4b;color:#fff;border-radius:99px;padding:10px 18px;font:700 13px inherit;pointer-events:none;transition:.25s;max-width:90vw;text-align:center}",
    "#p2-toast.on{opacity:1;transform:translate(-50%,0)}",
    ".p2-g{position:fixed;z-index:100029;background:#f43f5e;display:none;pointer-events:none}",
    "#p2-gx{top:0;bottom:0;width:1px}#p2-gy{left:0;right:0;height:1px}",
    "html.p2-on .p2-sel{outline:3px solid #4f46e5!important;outline-offset:1px!important}",
    "html.p2-on .p2-mvon{outline:3px solid #f59e0b!important;touch-action:none!important;cursor:grab}",
    "html.p2-on .p2-drag{opacity:.88;z-index:100028!important;box-shadow:0 14px 34px #0008!important;position:relative}",
    "html.p2-on .p2-edit{outline:3px solid #16a34a!important;-webkit-user-select:text!important;user-select:text!important;cursor:text}",
    "html.p2-on .p2-ghost{opacity:.35!important;outline:2px dashed #ef4444!important}",
    "html.p2-on.p2-fr .screen.active :is(div,section,article,p,h1,h2,h3,h4,h5,a,button,table,img,li,ul,header,footer,nav,form,figure):not(.p2-sel):not(.p2-edit){outline:1px dashed rgba(99,102,241,.4);outline-offset:-1px}",
    "html.p2-on .screen.active *{-webkit-touch-callout:none}",
    "html.p2-on:not(.p2-typing) .screen.active *{-webkit-user-select:none;user-select:none}",
    "html.p2-sheet{padding-bottom:300px}",
    "html.p2-dragging,html.p2-dragging *{cursor:grabbing!important}"
  ].join("\n");

  function buildUI() {
    if (S.built) return;
    S.built = true;
    var st0 = document.createElement("style");
    st0.id = "p2-css"; st0.textContent = CSS;
    document.head.appendChild(st0);

    var root = document.createElement("div");
    root.id = "p2-root"; root.setAttribute("data-p2ui", "1");
    root.innerHTML =
      '<button id="p2-tab" type="button">✦ YSPRO</button>' +
      '<div id="p2-rail" hidden></div>' +
      '<div id="p2-sheet" hidden></div>';
    document.body.appendChild(root);

    var h = document.createElement("div");
    h.id = "p2-h"; h.setAttribute("data-p2ui", "1"); h.hidden = true; h.textContent = "⠿";
    document.body.appendChild(h);
    var dn = document.createElement("button");
    dn.id = "p2-done"; dn.type = "button"; dn.setAttribute("data-p2ui", "1"); dn.hidden = true; dn.textContent = "✓ Mətn redaktəsini bitir";
    document.body.appendChild(dn);
    var tt = document.createElement("div"); tt.id = "p2-toast"; tt.setAttribute("data-p2ui", "1"); document.body.appendChild(tt);
    ["x", "y"].forEach(function (a) {
      var g = document.createElement("div"); g.id = "p2-g" + a; g.className = "p2-g"; g.setAttribute("data-p2ui", "1"); document.body.appendChild(g);
    });

    $("p2-tab").addEventListener("click", function () { S.rail = true; renderAll(); });
    $("p2-rail").addEventListener("click", onRail);
    $("p2-sheet").addEventListener("click", onSheet);
    $("p2-sheet").addEventListener("input", onInput);
    $("p2-sheet").addEventListener("change", onInput);
    dn.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    dn.addEventListener("click", function () { if (S.editing) S.editing.blur(); });
    h.addEventListener("pointerdown", function (e) { if (S.on && S.sel) { try { h.setPointerCapture(e.pointerId); } catch (er) { } startDrag(e); } });
    renderAll();
    posLoop();
  }
  function destroyUI() {
    if (!S.built) return;
    if (S.on) toggle(false);
    ["p2-root", "p2-h", "p2-done", "p2-toast", "p2-gx", "p2-gy", "p2-css"].forEach(function (i) { var e = $(i); e && e.remove(); });
    S.built = false;
  }

  function renderAll() {
    if (!S.built) return;
    var tab = $("p2-tab"), rail = $("p2-rail");
    tab.hidden = S.rail;
    tab.classList.toggle("on", S.on);
    rail.hidden = !S.rail;
    if (S.rail) renderRail();
    renderSheet();
    var hd = $("p2-h");
    if (hd) { hd.hidden = !(S.on && S.sel && !S.editing); hd.className = S.mode === "order" ? "order" : ""; hd.title = S.mode === "order" ? "Sıranı dəyiş" : "Sürüşdür"; hd.textContent = S.mode === "order" ? "⇅" : "⠿"; }
    var de = document.documentElement;
    de.classList.toggle("p2-on", S.on);
    de.classList.toggle("p2-fr", S.on && S.fr);
    de.classList.toggle("p2-typing", !!S.editing);
    if (S.sel) S.sel.classList.toggle("p2-mvon", S.direct);
  }
  function hiddenList() {
    var out = [];
    curPages().forEach(function (pk) {
      var pr = S.rules[pk] || {};
      Object.keys(pr).forEach(function (k) {
        if (pr[k].h) { var el = resolve(k); if (el) out.push({ pk: pk, k: k, el: el }); }
      });
    });
    return out;
  }
  function renderRail() {
    var hl = hiddenList(), r = $("p2-rail");
    r.innerHTML =
      '<div class="t"><span>✦ YSPRO</span><button data-a="close" style="width:auto;margin:0;padding:6px 10px">✕</button></div>' +
      '<button data-a="toggle" class="' + (S.on ? "on" : "p") + '">' + (S.on ? "✏️ Redaktə: AÇIQ" : "✏️ Redaktəni aç") + "</button>" +
      '<div class="row2"><button data-a="un" ' + (S.undo.length ? "" : "disabled") + '>↶ Geri</button><button data-a="re" ' + (S.redo.length ? "" : "disabled") + '>↷ İrəli</button></div>' +
      '<button data-a="grid" class="' + (S.grid ? "on" : "") + '">🧲 Tor yapışması: ' + (S.grid ? "açıq" : "bağlı") + "</button>" +
      '<button data-a="fr" class="' + (S.fr ? "on" : "") + '">▦ Çərçivələr: ' + (S.fr ? "açıq" : "bağlı") + "</button>" +
      '<div class="row2"><button data-a="pull">🔄 Bazadan yenilə</button><button data-a="ver">🔍 Yoxla</button></div>' +
      '<button data-a="rp" class="d">⟲ Bu səhifəni sıfırla</button>' +
      '<div id="p2-st" class="' + S.stc + '">' + esc(S.status || "") + "</div>" +
      '<button data-a="retry" id="p2-retry" class="p" ' + (S.stc === "err" ? "" : "hidden") + '>🔁 Yenidən cəhd et</button>' +
      (hl.length ? '<div id="p2-hid"><div class="hint" style="font-size:12px;color:#64748b">Gizlədilənlər (' + hl.length + "):</div>" +
        hl.map(function (x, i) { return '<button data-a="show" data-i="' + i + '">↺ ' + esc(snippet(x.el, 16) || label(x.el)) + "</button>"; }).join("") + "</div>" : "") +
      '<div class="hint" style="font-size:12px;color:#64748b;margin-top:8px;font-weight:600">' +
      (S.on ? "Səhifədə istənilən bloka toxun → seç → sürüşdür. Dəyişiklik avtomatik mərkəzi bazaya yazılır." : "Redaktəni açıb bloka toxun.") + "</div>";
    r.__hl = hl;
  }
  function renderSheet() {
    var sh = $("p2-sheet"), de = document.documentElement;
    if (!S.on || !S.sel || S.editing) { sh.hidden = true; de.classList.remove("p2-sheet"); return; }
    sh.hidden = false;
    var el = S.sel, cs = getComputedStyle(el), r = getRule(el), ch = chain(el);
    var head = '<div class="r"><span class="t">&lt;' + esc(label(el)) + "&gt; " + esc(snippet(el, 22)) + "</span>" +
      '<button data-a="min">' + (S.min ? "▴" : "▾") + '</button><button data-a="desel">✕</button></div>';
    if (S.min) { sh.innerHTML = head; de.classList.remove("p2-sheet"); return; }
    de.classList.add("p2-sheet");
    sh.innerHTML = head +
      '<div class="chips">' + ch.map(function (n, i) {
        return '<button data-a="pick" data-i="' + i + '" class="' + (i === 0 ? "p" : "") + '">' + esc(label(n)).slice(0, 16) + "</button>";
      }).reverse().join("") + "</div>" +
      '<div class="r"><button class="big ' + (S.direct && S.mode === "free" ? "on" : "p") + '" data-a="free">↔ Sürüşdür (sərbəst)</button>' +
      '<button class="big ' + (S.direct && S.mode === "order" ? "on" : "") + '" data-a="order">⇅ Sıra dəyiş</button></div>' +
      '<div class="hint">' + (S.direct ? (S.mode === "free" ? "Seçilmiş bloku barmağınla tutub istədiyin yerə çək. Qırmızı xətt = düzlənmə." : "Bloku tutub başqa blokun üstünə çək — yeri dəyişəcək.") : "Sürüşdürmək üçün yuxarıdakı düyməni və ya blokdakı ⠿ dəstəyi işlət.") + "</div>" +
      '<div class="r"><button data-a="txt">✎ Mətn</button><button data-a="hide" class="d">🗑 ' + (r.h ? "Qaytar" : "Gizlət") + '</button><button data-a="up">⤴ Üst blok</button><button data-a="rst">↺ Sıfırla</button></div>' +
      '<div class="r"><div class="pad"><span></span><button data-a="nu">▲</button><span></span><button data-a="nl">◀</button><button data-a="nd">▼</button><button data-a="nr">▶</button></div>' +
      '<button data-a="step">Addım: ' + S.step + "px</button>" +
      '<label>Ölçü <input type="range" min="40" max="200" step="5" data-p="s" value="' + Math.round((r.s || 1) * 100) + '"></label></div>' +
      '<div class="r"><label>Yazı <input type="number" min="8" max="96" data-p="fs" value="' + (r.fs || parseInt(cs.fontSize) || 14) + '"></label>' +
      '<label>Rəng <input type="color" data-p="c" value="' + hex(cs.color) + '"></label>' +
      '<label>Fon <input type="color" data-p="bg" value="' + hex(cs.backgroundColor) + '"></label></div>';
  }
  function hex(c) {
    var m = String(c).match(/[\d.]+/g);
    if (!m || (m.length > 3 && +m[3] === 0)) return "#ffffff";
    return "#" + m.slice(0, 3).map(function (n) { return Math.round(+n).toString(16).padStart(2, "0"); }).join("");
  }

  function onRail(e) {
    var b = e.target.closest("button"); if (!b) return;
    var a = b.dataset.a;
    if (a === "close") { S.rail = false; return renderAll(); }
    if (a === "toggle") return toggle(!S.on);
    if (a === "un" || a === "re") {
      var from = a === "un" ? S.undo : S.redo, to = a === "un" ? S.redo : S.undo;
      if (!from.length) return;
      to.push(JSON.stringify(S.rules));
      return restoreRules(from.pop());
    }
    if (a === "grid") { S.grid = !S.grid; return renderAll(); }
    if (a === "fr") { S.fr = !S.fr; return renderAll(); }
    if (a === "rp") return resetPage();
    if (a === "pull") return pullNow();
    if (a === "ver") return verify();
    if (a === "retry") return flush();
    if (a === "show") {
      var x = $("p2-rail").__hl[+b.dataset.i]; if (!x) return;
      snap();
      var rr = S.rules[x.pk][x.k]; delete rr.h;
      x.el.classList.remove("p2-ghost"); x.el.style.removeProperty("display");
      save(); renderAll(); toast("Geri qaytarıldı");
    }
  }
  function onSheet(e) {
    var b = e.target.closest("button"); if (!b) return;
    var a = b.dataset.a, el = S.sel;
    if (a === "desel") return select(null);
    if (a === "min") { S.min = !S.min; return renderAll(); }
    if (a === "pick") { var c = chain(el)[+b.dataset.i]; return c && select(c); }
    if (a === "free" || a === "order") {
      var same = S.direct && S.mode === (a === "free" ? "free" : "order");
      S.mode = a === "free" ? "free" : "order";
      S.direct = !same;
      if (S.direct) toast(a === "free" ? "İndi bloku barmaqla sürüşdür" : "Bloku başqa blokun üstünə çək");
      return renderAll();
    }
    if (a === "txt") return startText();
    if (a === "hide") return hideEl();
    if (a === "rst") return resetEl();
    if (a === "up") { var p = el.parentElement; return p && !p.classList.contains("screen") && p !== document.body ? select(p) : toast("Daha yuxarı blok yoxdur"); }
    if (a === "step") { var sp = [1, 4, 10, 20], i = sp.indexOf(S.step); S.step = sp[(i + 1) % sp.length]; return renderAll(); }
    if (a === "nl") return nudge(-1, 0);
    if (a === "nr") return nudge(1, 0);
    if (a === "nu") return nudge(0, -1);
    if (a === "nd") return nudge(0, 1);
  }
  function onInput(e) {
    var p = e.target.dataset && e.target.dataset.p; if (!p || !S.sel) return;
    var v = e.target.value;
    if (p === "s") return setProp("s", Math.abs(+v - 100) < 3 ? 0 : +v / 100);
    if (p === "fs") return setProp("fs", Math.max(8, Math.min(96, +v || 14)));
    setProp(p, v);
  }

  function toggle(on) {
    S.on = !!on;
    if (!S.on) { endText(); if (S.built) select(null); }
    document.documentElement.classList.toggle("p2-on", S.on);
    applyAll();   // ghost-ları yenilə
    renderAll();
    if (S.on) toast("Redaktə açıq — istənilən bloka toxun");
    else if (!S.dirty) poll("admin");
  }

  /* ---------- hadisələr ---------- */
  function onClick(e) {
    if (!S.on || !S.built) return;
    if (e.target.closest && e.target.closest(UIQ)) return;
    e.stopPropagation();
    var inEdit = S.editing && S.editing.contains(e.target);
    if (!inEdit) e.preventDefault();
    if (inEdit || D) return;
    var el = norm(e.target);
    if (!el || el.matches(UIQ)) return;
    if (S.editing) S.editing.blur();
    select(el);
  }
  function onDown(e) {
    if (!S.on || !S.sel || !S.direct || D || S.editing) return;
    if (e.target.closest && e.target.closest(UIQ)) return;
    if (!S.sel.contains(e.target)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startDrag(e);
  }
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerdown", onDown, true);

  function posLoop() {
    var hd = $("p2-h");
    if (!hd) return;
    if (!hd.hidden && S.sel && document.contains(S.sel)) {
      var r = S.sel.getBoundingClientRect();
      var x = Math.min(Math.max(r.left + 4, 6), innerWidth - 50);
      var y = Math.min(Math.max(r.top - 22, 8), innerHeight - 60);
      hd.style.left = Math.round(x) + "px"; hd.style.top = Math.round(y) + "px";
    }
    requestAnimationFrame(posLoop);
  }

  /* admin vəziyyəti və lazımsız ekranlar */
  function sync() {
    var adm = isAdm();
    var blocked = !!document.querySelector("#exam-screen.active,#admin-panel.active,#v3-root[style*='block'],#v2-root[style*='block'],#v4-root[style*='block']");
    if (adm && !blocked && !S.built) buildUI();
    if ((!adm || blocked) && S.built) destroyUI();
    if (S.built) {
      if (S.sel && !document.contains(S.sel)) select(null);
      var tab = $("p2-tab"); if (tab) tab.hidden = S.rail;
    }
  }

  /* =====================================================================
     GİRİŞ NÖQTƏLƏRİ — admin panel kartı, V2 bölməsi, V3 düyməsi
     ===================================================================== */
  function openEditor() {
    if (!isAdm()) {
      flash("Əvvəlcə admin kimi daxil olun");
      try { window.__dqAdminLogin && window.__dqAdminLogin(); } catch (e) { }
      return;
    }
    var root = $("v3-root"), V = gV3();
    if (V && root && root.style.display === "block") {
      try { V.close(); } catch (e) { }
      if (root.style.display === "block") { flash("Əvvəlcə İdarəçi V3-də dəyişiklikləri yadda saxlayın"); return; }
    }
    try { var v2 = gV2(); if (v2 && v2.close) v2.close(); } catch (e) { }
    try { if (typeof showScreen === "function") showScreen("v3-home"); } catch (e) { }
    try { scrollTo(0, 0); } catch (e) { }
    S.rail = true;
    var n = 0;
    (function w() {
      sync();
      if (S.built) { renderAll(); if (!S.on) toggle(true); return; }
      if (++n < 30) setTimeout(w, 120);
    })();
  }

  function mountCard() {
    var g = document.querySelector("#admin-panel .admin-nav-grid");
    if (!g || $("ys-admin-card")) return;
    var c = document.createElement("div");
    c.className = "admin-nav-card"; c.id = "ys-admin-card";
    c.setAttribute("style", "background:linear-gradient(135deg,#6366f1,#1e1b4b);color:#fff");
    c.innerHTML = '<span class="icon">✦</span> İdarəçi YSPRO — Canlı Dizayn Redaktoru';
    c.onclick = openEditor;
    var v3c = [].filter.call(g.querySelectorAll(".admin-nav-card"), function (x) { return /V3\.open\(\)/.test(x.getAttribute("onclick") || ""); })[0];
    if (v3c && v3c.parentNode) v3c.parentNode.insertBefore(c, v3c.nextSibling); else g.appendChild(c);
  }

  function pageHtml() {
    return '' +
      '<div class="v2-card"><h3>✦ YSPRO — canlı dizayn redaktoru</h3>' +
      '<p style="color:#64748b;font-size:14px;margin:6px 0 12px">Sayt səhifələrindəki istənilən bloku sürüşdürün, sırasını, ölçüsünü, rəngini, mətnini dəyişin və ya gizlədin. Hər dəyişiklik <b>mərkəzi bazaya yazılır</b>, geri oxunub təsdiqlənir və bütün istifadəçilərdə avtomatik tətbiq olunur.</p>' +
      '<button class="v2-b" onclick="YSPRO.open()">✏️ Redaktoru aç</button></div>' +
      '<div class="v2-card"><h3>📡 Mərkəzi baza vəziyyəti</h3><div id="ys-pg-st" style="font-size:14px;line-height:1.7">Yoxlanılır…</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="v2-b o" onclick="YSPRO.pageRefresh()">🔄 Yenidən yoxla</button>' +
      '<button class="v2-b o" onclick="YSPRO.forcePull()">⬇ Bu cihazı bazadan yenilə</button></div></div>' +
      '<div class="v2-card"><h3>🔐 İcazə yoxlaması (FİN)</h3><p style="color:#64748b;font-size:13px;margin:4px 0 8px">Mərkəzi bazadan birbaşa (keşsiz) oxuyur — iştirakçıya icazənin həqiqətən yazıldığını görmək üçün.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ys-fin" class="v2-in" style="flex:1;min-width:150px;text-transform:uppercase" maxlength="12" placeholder="FİN kod">' +
      '<button class="v2-b" onclick="YSPRO.checkFin()">Yoxla</button></div><div id="ys-fin-out" style="margin-top:10px;font-size:14px"></div></div>' +
      '<div class="v2-card"><h3>💾 Ehtiyat nüsxə</h3><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="v2-b o" onclick="YSPRO.exportJson()">⬇ Yüklə (JSON)</button>' +
      '<label class="v2-b o" style="cursor:pointer">⬆ Bərpa et<input type="file" accept="application/json,.json" style="display:none" onchange="YSPRO.importJson(this)"></label>' +
      '<button class="v2-b" style="background:#dc2626" onclick="YSPRO.resetAll()">⟲ Hamısını sıfırla</button></div></div>';
  }
  async function pageRefresh() {
    var box = $("ys-pg-st"); if (!box) return;
    box.textContent = "Yoxlanılır…";
    try {
      var m = await DB.many([COL, CFG]);
      var rules = (m[COL] && m[COL].data && m[COL].data.rules) || {}, n = 0, h = 0, pages = Object.keys(rules).length;
      Object.keys(rules).forEach(function (pk) { Object.keys(rules[pk]).forEach(function (k) { n++; if (rules[pk][k].h) h++; }); });
      var v3 = m[CFG] && m[CFG].data, v3h = [];
      if (v3 && v3.items) Object.keys(v3.items).forEach(function (k) { if (v3.items[k] && v3.items[k].h) v3h.push(v3.items[k].t || k); });
      var t = m[COL] && m[COL].data && m[COL].data.t;
      box.innerHTML =
        '🟢 Baza ilə əlaqə var · admin sessiyası: <b>' + (isAdm() ? "aktiv" : "yoxdur") + '</b><br>' +
        'YSPRO qaydaları: <b>' + n + '</b> (səhifə: ' + pages + ', gizlədilmiş blok: ' + h + ')' + (t ? ' · son yazı: ' + esc(new Date(t).toLocaleString("az-AZ")) : '') + '<br>' +
        'İdarəçi V3-də gizlədilmiş düymələr: <b>' + v3h.length + '</b>' + (v3h.length ? ' — ' + v3h.map(esc).join(", ") : '') + '<br>' +
        'Yerli vəziyyət: ' + (st(rules) === st(S.rules) ? '<b style="color:#15803d">bazaya bərabərdir ✓</b>' : '<b style="color:#b91c1c">bazadan fərqlənir — «Bu cihazı bazadan yenilə» düyməsini basın</b>');
    } catch (e) { box.innerHTML = '🔴 Bazaya qoşulmaq olmadı: ' + esc(em(e)); }
  }
  async function checkFin() {
    var out = $("ys-fin-out"), inp = $("ys-fin"); if (!out || !inp) return;
    var fin = String(inp.value || "").trim().toUpperCase();
    if (fin.length < 5) { out.textContent = "FİN kodu yazın."; return; }
    out.textContent = "Yoxlanılır…";
    try {
      var c = gSB(), q = await c.from("allowed_students").select("*").eq("fin", fin);
      if (q.error) throw q.error;
      var rows = q.data || [];
      out.innerHTML = rows.length
        ? '<b style="color:#15803d">✅ İcazə bazada var:</b><br>' + rows.map(function (r) {
          var cs = Array.isArray(r.categories) ? r.categories.join(", ") : String(r.categories || "");
          return esc(r.student_name || "") + " · sınaq " + esc(r.exam_no) + " · " + esc(cs);
        }).join("<br>")
        : '<b style="color:#b91c1c">❌ Bu FİN üçün bazada icazə yoxdur.</b>';
    } catch (e) { out.innerHTML = '<b style="color:#b91c1c">Xəta: ' + esc(em(e)) + '</b>'; }
  }
  function exportJson() {
    clean();
    var blob = new Blob([JSON.stringify({ yspro: 1, rules: S.rules, t: Date.now() }, null, 1)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "yspro-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importJson(inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var j = JSON.parse(String(fr.result));
        if (!j || typeof j.rules !== "object") throw new Error("format səhvdir");
        if (!confirm("Cari YSPRO qaydaları faylın məzmunu ilə əvəz olunsun? (bütün istifadəçilərə tətbiq olunacaq)")) return;
        snap(); revertAll(); S.rules = j.rules; applyAll(); save(); flash("Ehtiyatdan bərpa olundu");
      } catch (e) { flash("Fayl oxunmadı: " + em(e)); }
      inp.value = "";
    };
    fr.readAsText(f);
  }

  function mountV2() {
    var V = gV2();
    if (!V || !V.menu || V.__ys) return;
    V.__ys = 1;
    if (!V.menu.some(function (m) { return m[0] === "yspro"; })) V.menu.splice(Math.min(1, V.menu.length), 0, ["yspro", "fa-wand-magic-sparkles", "YSPRO — Dizayn"]);
    V.p_yspro = async function () {
      setTimeout(pageRefresh, 60);
      return { title: "YSPRO", sub: "Canlı dizayn redaktoru və mərkəzi baza sinxronu.", html: pageHtml() };
    };
  }

  /* ---------- İdarəçi V3 ilə inteqrasiya ---------- */
  function cntHidden(items) { var n = 0; Object.keys(items || {}).forEach(function (k) { if (items[k] && items[k].h) n++; }); return n; }
  function hookV3() {
    var V = gV3();
    if (!V || V.__ys || !V.draw) return;
    V.__ys = 1;

    var oDraw = V.draw;
    V.draw = function () {
      var r = oDraw.apply(V, arguments);
      try {
        var bar = document.querySelector("#v3-root .v3-bar");
        if (bar && !bar.querySelector("#ys-v3-btn")) {
          var b = document.createElement("button");
          b.id = "ys-v3-btn"; b.type = "button"; b.textContent = "✦ YSPRO";
          b.setAttribute("style", "background:#6366f1");
          b.onclick = openEditor;
          bar.appendChild(b);
        }
      } catch (e) { }
      return r;
    };

    /* yalnız admin konfiqi yaza bilər (ziyarətçinin köhnə nüsxəsi bazanı əzməsin) */
    var oSave = V.save;
    if (oSave) V.save = function () { if (!isAdm()) return; return oSave.apply(V, arguments); };

    /* "Yadda saxla"dan sonra bazadan geri oxu və təsdiqlə */
    var oCommit = V.commit;
    if (oCommit) V.commit = async function () {
      var ok = await oCommit.apply(V, arguments);
      if (!ok) return ok;
      try {
        var row = await DB.one(CFG), top = row && row.data;
        var a = cntHidden(V.D && V.D.items), b = top && top.items ? cntHidden(top.items) : -1;
        var same = top && V.D && st(top.items || {}) === st(V.D.items || {}) && st(top.groups || {}) === st(V.D.groups || {});
        if (!same) {
          V.err = "Bazada təsdiqlənmədi (gizli düymə: yerli " + a + ", bazada " + b + ") — yenidən cəhd edin";
          V.dirty = true; V.verifiedAt = null;
          V.barUpdate && V.barUpdate();
          flash("Bazada təsdiqlənmədi ❌");
          return false;
        }
        S.v3sig = st(top);
        V.verifiedAt = new Date();
        V.barUpdate && V.barUpdate();
      } catch (e) { /* oxuna bilmədi — yazı artıq doğrulanıb */ }
      return ok;
    };
    var oBar = V.barUpdate;
    if (oBar) V.barUpdate = function () {
      var r = oBar.apply(V, arguments);
      try {
        var t = $("v3-sv-t");
        if (t && !V.dirty && !V.err && !V.busy && V.verifiedAt) t.textContent += " · bazada təsdiqləndi ✓";
      } catch (e) { }
      return r;
    };
    var root = $("v3-root");
    if (root && root.style.display === "block") { try { V.draw(); } catch (e) { } }
  }

  /* ---------- İŞTİRAKÇI İCAZƏSİ: allowed_students yazıları səssiz uğursuz olmasın ---------- */
  function wrapPerm() {
    var c = gSB();
    if (!c || c.__ysPerm || typeof c.from !== "function") return;
    c.__ysPerm = 1;
    var oFrom = c.from.bind(c);
    c.from = function (table) {
      var b = oFrom.apply(c, arguments);
      if (table !== "allowed_students" || !b) return b;
      ["insert", "update", "upsert", "delete"].forEach(function (m) {
        var o = b[m];
        if (typeof o !== "function") return;
        b[m] = function () {
          var fb = o.apply(b, arguments);
          try {
            if (typeof fb.select === "function") fb = fb.select();
            var oThen = fb.then.bind(fb);
            fb.then = function (res, rej) {
              return oThen(function (r) {
                try {
                  if (r && !r.error) {
                    if (m !== "delete" && Array.isArray(r.data) && !r.data.length) {
                      r.error = { message: "Server yazmağa icazə vermədi (0 sətir yazıldı) — admin kimi yenidən daxil olun" };
                    }
                  }
                  if (r && r.error) { flash("❌ İcazə bazaya yazılmadı: " + em(r.error)); }
                  else {
                    try { window.dispatchEvent(new CustomEvent("ys:perm-changed", { detail: { op: m } })); } catch (e) { }
                  }
                } catch (e) { }
                return res ? res(r) : r;
              }, rej);
            };
          } catch (e) { }
          return fb;
        };
      });
      return b;
    };
  }

  /* ---------- realtime (varsa) ---------- */
  function realtime() {
    var c = gSB();
    if (!c || realtime.done || typeof c.channel !== "function") return;
    realtime.done = true;
    try {
      c.channel("ys-live").on("postgres_changes", { event: "*", schema: "public", table: "dq_v2_store" }, function (p) {
        var n = p && p.new && p.new.collection;
        if (n === COL || n === CFG) poll(true);
      }).subscribe();
    } catch (e) { }
  }

  /* ---------- işə sal ---------- */
  var start = function () {
    var cached = cacheGet();
    if (cached) { S.rules = cached; S.sig = st(cached); }
    observe();
    applyAll();
    poll(true);
    setInterval(sync, 600);
    setInterval(function () { mountCard(); mountV2(); hookV3(); wrapPerm(); realtime(); }, 800);
    setInterval(poll, POLL);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(true); });
    addEventListener("focus", function () { poll(true); });
    addEventListener("online", function () { if (S.dirty) flush(); poll(true); });
    addEventListener("beforeunload", function (e) { if (S.dirty || S.saving) { e.preventDefault(); e.returnValue = ""; } });
    mountCard(); mountV2(); hookV3(); wrapPerm(); sync();
  };

  window.YSPRO = {
    version: "1.0", open: openEditor, apply: applyAll, rules: function () { return S.rules; },
    toggle: toggle, pull: pullNow, verify: verify, poll: poll, db: DB,
    pageRefresh: pageRefresh, forcePull: pullNow, checkFin: checkFin,
    exportJson: exportJson, importJson: importJson, resetAll: resetAll
  };
  window.DQPro2 = window.YSPRO;   // köhnə ad ilə uyğunluq
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
