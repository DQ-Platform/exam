/* =====================================================================
   DQ CANVA PRO v1  —  saytı Canva kimi canlı dizayn et
   ---------------------------------------------------------------------
   • Hamı üçün (runtime): dərc olunmuş dəyişiklikləri tətbiq edir
     (gizlətmə, mətn, rəng, ölçü, sıra, yeni bloklar). Yükləmə: yalnız bu fayl.
   • Admin üçün (redaktor): CanvaPro.open() — saytın özündə klikləyib dəyiş.
   • Admin Panel V2-də "Canva Pro" bölməsi əlavə edir (sol menyu).
   • Saxlama: Supabase dq_v2_store, collection = "canvapro"
     (hər "Dərc et" yeni versiya yaradır, son 15 versiya saxlanır).
   ===================================================================== */
(function () {
  "use strict";
  if (window.CanvaPro) return;

  var SB = "https://cpzwliqlgaplroscvduo.supabase.co",
    KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF",
    COL = "canvapro", LC = "dq_cvpro_live_v1", LD = "dq_cvpro_draft_v1", D = document;

  var doc = blank(), liveStr = "", liveId = null;
  var editing = false, preview = false, sel = null, hover = null, pending = null, bypass = false;
  var hist = [], hi = -1, applying = false, lastMiss = 0, orig = {}, lyEls = [], tab = "add", obs = null, raf = 0;

  /* ---------- kiçik köməkçilər ---------- */
  function blank() { return { v: 1, ops: {}, blocks: [], t: 0, n: 0 }; }
  function jp(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function q(s) { try { return D.querySelector(s); } catch (e) { return null; } }
  function inUI(n) { return !!(n && n.closest && n.closest("#cv-ui,#cv-ov,#cv-toast")); }
  function rid() { return "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function sig(d) { return JSON.stringify({ ops: d.ops, blocks: d.blocks }); }
  function count(d) { return Object.keys(d.ops).length + d.blocks.length; }
  function norm(d) {
    d = d && typeof d === "object" ? d : {};
    var o = { v: 1, ops: {}, blocks: [], t: +d.t || 0, n: 0 };
    if (d.ops && typeof d.ops === "object") Object.keys(d.ops).forEach(function (k) { if (d.ops[k] && typeof d.ops[k] === "object") o.ops[k] = d.ops[k]; });
    if (Array.isArray(d.blocks)) d.blocks.forEach(function (b) { if (b && typeof b.html === "string" && b.a) o.blocks.push({ id: String(b.id || rid()).replace(/[^\w-]/g, ""), a: String(b.a), p: b.p === "before" || b.p === "in" ? b.p : "after", html: b.html, st: b.st || {}, h: b.h ? 1 : 0, o: b.o == null ? null : +b.o, ty: b.ty || "html" }); });
    o.n = count(o);
    return o;
  }

  /* ---------- təhlükəsizlik: HTML və CSS təmizləmə ---------- */
  var BAD = "script,style,iframe,object,embed,base,meta,link,form,template,frame,frameset,applet";
  function clean(html) {
    var t = D.createElement("template");
    t.innerHTML = String(html || "");
    [].forEach.call(t.content.querySelectorAll(BAD), function (n) { n.remove(); });
    [].forEach.call(t.content.querySelectorAll("*"), function (n) {
      [].slice.call(n.attributes).forEach(function (a) {
        var k = a.name.toLowerCase(), v = a.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
        if (k.indexOf("on") === 0 || k === "srcdoc" || k === "formaction" ||
          ((k === "href" || k === "src" || k === "xlink:href" || k === "action") && /^(javascript|vbscript|data:text)/.test(v))) n.removeAttribute(a.name);
        else if (k === "style" && /expression|javascript|url\(/.test(v.replace(/url\(data:image\/[a-z+]+;base64,[a-z0-9+\/=]+\)/g, ""))) n.removeAttribute("style");
      });
    });
    return t.innerHTML;
  }
  var PROPS = "color,background,background-color,background-image,font-size,font-weight,font-style,font-family,text-align,text-decoration,text-transform,letter-spacing,line-height,border-radius,border,padding,margin,margin-top,margin-bottom,opacity,order,display,flex-direction,width,max-width,min-height,height,box-shadow,gap,justify-content,align-items,transform,filter".split(",");
  function okv(k, v) { v = String(v); return PROPS.indexOf(k) > -1 && v.length < 220 && !/[;{}<>\\]|url\(|expression|javascript|@import/i.test(v); }
  function okSel(s) { if (typeof s !== "string" || s.length > 700 || /[{};@<]|\/\*/.test(s)) return false; try { D.createDocumentFragment().querySelector(s); return true; } catch (e) { return false; } }
  function safeUrl(v) {
    v = String(v || "").trim();
    return /^(javascript|vbscript|data:text)/i.test(v.replace(/[\s\u0000-\u001f]/g, "")) ? "" : v.slice(0, 2400000);
  }

  /* ---------- stabil CSS yolu (elementi sonradan tapmaq üçün) ---------- */
  function stable(c) { return c && c.length < 28 && !/^(active|on|off|show|shown|open|hidden|selected|current|disabled|loading|is-|has-|js-|cv-|ys-|v3on)/.test(c) && !/\d{3,}/.test(c); }
  function seg(el) {
    var t = el.tagName.toLowerCase(), p = el.parentElement,
      cls = [].slice.call(el.classList).filter(stable).slice(0, 2).map(function (c) { return "." + CSS.escape(c); }).join(""), s = t + cls;
    if (!p) return s;
    var sameTag = [].filter.call(p.children, function (c) { return c.tagName === el.tagName; });
    if (sameTag.length === 1) return t;
    var alone = cls && [].filter.call(sameTag, function (c) { return c.matches(s); }).length === 1;
    return alone ? s : s + ":nth-of-type(" + (sameTag.indexOf(el) + 1) + ")";
  }
  function pathOf(el) {
    if (el === D.body) return "body";
    var a = [], n = el;
    while (n && n !== D.body && n !== D.documentElement) {
      if (n.id && !/\d{4,}/.test(n.id) && D.querySelectorAll("#" + CSS.escape(n.id)).length === 1) { a.unshift("#" + CSS.escape(n.id)); return a.join(">"); }
      a.unshift(seg(n)); n = n.parentElement;
    }
    return "body>" + a.join(">");
  }

  /* ---------- stil kompilyasiyası ---------- */
  var BASE = "cv-block{display:block;max-width:1180px;margin:18px auto;padding:0 18px;box-sizing:border-box}cv-block img{max-width:100%}.cv-btn{cursor:pointer}[data-cv-href]{cursor:pointer}";
  function cssText(d, ed) {
    var o = [];
    Object.keys(d.ops).forEach(function (s) {
      if (!okSel(s)) return;
      var p = d.ops[s];
      if (p.h) o.push(ed ? s + "{opacity:.3!important;outline:2px dashed #ef4444!important}" : s + "{display:none!important}");
      var b = [];
      for (var k in (p.st || {})) if (p.st[k] !== "" && p.st[k] != null && okv(k, p.st[k])) b.push(k + ":" + p.st[k] + "!important");
      if (b.length) o.push(s + "{" + b.join(";") + "}");
    });
    return o.join("\n");
  }
  function applyCss() {
    var st = D.getElementById("cv-css");
    if (!st) { st = D.createElement("style"); st.id = "cv-css"; (D.head || D.documentElement).appendChild(st); }
    var t = BASE + "\n" + cssText(doc, editing && !preview);
    if (st.textContent !== t) st.textContent = t;
  }

  /* ---------- DOM tətbiqi: mətn, atribut, bloklar ---------- */
  var ATT = ["href", "src", "alt", "title", "target"];
  function applyOp(s, p, e, restore) {
    if (p.tx != null) { var h = clean(p.tx); if (e.__tx !== h) { e.innerHTML = h; e.__tx = h; } }
    if (p.at) for (var k in p.at) if (ATT.indexOf(k) > -1) {
      var v = k === "href" || k === "src" ? safeUrl(p.at[k]) : String(p.at[k]).slice(0, 500);
      if (k === "href" && e.tagName !== "A") { if (e.getAttribute("data-cv-href") !== v) e.setAttribute("data-cv-href", v); }
      else if (e.getAttribute(k) !== v) e.setAttribute(k, v);
    }
  }
  function mkBlock(b) {
    var e = D.createElement("cv-block");
    e.setAttribute("data-cv", b.id);
    return fillBlock(e, b);
  }
  function fillBlock(e, b) {
    e.innerHTML = clean(b.html); e.__h = b.html;
    [].forEach.call(e.querySelectorAll(".cv-vid[data-vid]"), function (v) {
      var id = String(v.getAttribute("data-vid")).replace(/[^\w-]/g, "").slice(0, 20);
      if (!id || v.querySelector("iframe")) return;
      var f = D.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id; f.allowFullscreen = true; f.loading = "lazy";
      f.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:14px");
      v.appendChild(f);
    });
    return e;
  }
  function styleBlock(e, b) {
    e.removeAttribute("style");
    for (var k in (b.st || {})) if (okv(k, b.st[k])) e.style.setProperty(k, b.st[k]);
    if (b.o != null) e.style.order = b.o;
    if (b.h) { if (editing && !preview) { e.style.opacity = ".3"; e.style.outline = "2px dashed #ef4444"; } else e.style.display = "none"; }
  }
  function applyDom(force) {
    if (applying) return;
    applying = true;
    var miss = 0;
    try {
      Object.keys(doc.ops).forEach(function (s) {
        var p = doc.ops[s];
        if (p.tx == null && !p.at) return;
        var e = q(s);
        if (!e || !okSel(s)) { miss++; return; }
        applyOp(s, p, e);
      });
      if (force) Object.keys(orig).forEach(function (s) {          // undo: dəyişikliyi geri qaytar
        var p = doc.ops[s] || {}, o = orig[s], e = q(s);
        if (!e) return;
        if (p.tx == null && o.tx != null) { e.innerHTML = o.tx; e.__tx = undefined; }
        for (var k in (o.at || {})) if (!p.at || p.at[k] == null) { if (o.at[k] == null) { e.removeAttribute(k); e.removeAttribute("data-cv-href"); } else e.setAttribute(k, o.at[k]); }
      });
      var ids = {}, cur = {};
      doc.blocks.forEach(function (b) {
        ids[b.id] = 1;
        var anchor = q(b.a), e = q('cv-block[data-cv="' + b.id + '"]');
        if (!anchor || !okSel(b.a)) { miss++; if (e) e.remove(); return; }
        if (!e) e = mkBlock(b); else if (e.__h !== b.html) fillBlock(e, b);
        styleBlock(e, b);
        var key = b.a + "|" + b.p, c = cur[key];
        if (b.p === "in") {
          if (!c) { if (e.parentElement !== anchor || e.nextElementSibling) anchor.appendChild(e); }
          else if (c.nextElementSibling !== e) c.after(e);
        } else if (b.p === "before") {
          if (!c) { if (e.nextElementSibling !== anchor) anchor.before(e); }
          else if (c.nextElementSibling !== e) c.after(e);
        } else {
          var from = c || anchor;
          if (from.nextElementSibling !== e) from.after(e);
        }
        cur[key] = e;
      });
      [].forEach.call(D.querySelectorAll("cv-block"), function (e) { if (!ids[e.getAttribute("data-cv")]) e.remove(); });
    } catch (err) { console.warn("[CanvaPro]", err); }
    lastMiss = miss;
    if (obs) obs.takeRecords();
    applying = false;
    return miss;
  }

  /* ---------- Supabase (REST) ---------- */
  function api(path, opt) {
    opt = opt || {};
    var ac = window.AbortController ? new AbortController() : null, t = setTimeout(function () { ac && ac.abort(); }, 15000);
    opt.headers = Object.assign({ apikey: KEY }, opt.headers || {});
    if (ac) opt.signal = ac.signal;
    return fetch(SB + "/rest/v1/" + path, opt).then(function (r) {
      clearTimeout(t);
      return r.text().then(function (x) { if (!r.ok) throw new Error(r.status + " " + x.slice(0, 180)); return x ? JSON.parse(x) : null; });
    }, function (e) { clearTimeout(t); throw e; });
  }
  function fetchLatest() {
    return api("dq_v2_store?select=id,data&collection=eq." + COL + "&order=id.desc&limit=1").then(function (a) { return a && a[0] ? a[0] : null; });
  }
  function publish(d) {
    d = norm(d); d.t = Date.now(); d.n = count(d);
    var js = JSON.stringify(d);
    if (js.length > 3000000) return Promise.reject(new Error("Dəyişikliklər çox böyükdür (şəkillər). Şəkilləri kiçildin."));
    return api("dq_v2_store", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify([{ collection: COL, data: d }]) })
      .then(function (r) {
        var row = r && r[0]; if (row) { liveId = row.id; liveStr = sig(d); try { localStorage.setItem(LC, JSON.stringify({ id: row.id, data: d })); } catch (e) { } }
        return api("dq_v2_store?select=id&collection=eq." + COL + "&order=id.desc&offset=15&limit=200").then(function (old) {
          if (old && old.length) return api("dq_v2_store?id=in.(" + old.map(function (x) { return x.id; }).join(",") + ")", { method: "DELETE" });
        }).catch(function () { });
      });
  }

  /* ---------- hamı üçün: yüklə + tətbiq et ---------- */
  var tm = 0;
  function boot() {
    var c = jp(localStorage.getItem(LC), null);
    if (c && c.data) { doc = norm(c.data); liveStr = sig(doc); liveId = c.id; applyCss(); applyDom(); }
    fetchLatest().then(function (r) {
      if (!r) { if (c) { try { localStorage.removeItem(LC); } catch (e) { } if (!editing) { doc = blank(); applyCss(); applyDom(true); } } return; }
      if (r.id === liveId && c) return;
      liveId = r.id;
      try { localStorage.setItem(LC, JSON.stringify({ id: r.id, data: r.data })); } catch (e) { }
      if (!editing) { doc = norm(r.data); liveStr = sig(doc); applyCss(); applyDom(true); }
    }).catch(function () { });
    try {
      obs = new MutationObserver(function () {
        if (applying || editing) return;
        clearTimeout(tm); tm = setTimeout(function () { applyDom(); }, 250);
      });
      obs.observe(D.documentElement, { childList: true, subtree: true });
    } catch (e) { }
    D.addEventListener("click", function (e) {                   // hər elementə "keçid" (admin təyin edib)
      if (editing || !e.target.closest) return;
      var n = e.target.closest("[data-cv-href]");
      if (!n || n.tagName === "A") return;
      var u = safeUrl(n.getAttribute("data-cv-href"));
      if (!u) return;
      e.preventDefault(); e.stopPropagation();
      if (/^#/.test(u)) location.hash = u; else window.open(u, /^https?:/i.test(u) && u.indexOf(location.origin) !== 0 ? "_blank" : "_self", "noopener");
    }, true);
  }

  /* =====================================================================
     REDAKTOR
     ===================================================================== */
  var BL = {
    h: { n: "Başlıq", i: "🔤", html: '<h2 style="margin:0;font-size:32px;font-weight:800;color:#0b1d3a">Yeni başlıq</h2>' },
    p: { n: "Mətn", i: "📝", html: '<p style="margin:0;font-size:17px;line-height:1.65;color:#334155">Mətnini bura yaz. İstənilən sözü ikiqat klikləyib dəyişə bilərsən.</p>' },
    btn: { n: "Düymə", i: "🔘", html: '<a href="#" class="cv-btn" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#d4af37;color:#0b1d3a;font-weight:800;text-decoration:none">Düymə</a>' },
    img: { n: "Şəkil", i: "🖼️", html: '<img alt="" style="display:block;max-width:100%;margin:0 auto;border-radius:16px" src="data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420"><rect width="100%" height="100%" rx="24" fill="#e2e8f0"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="28" fill="#64748b">Şəkil seç (sağ paneldən yüklə)</text></svg>') + '">' },
    ban: { n: "Banner", i: "🎯", html: '<div style="padding:34px 28px;border-radius:22px;background:linear-gradient(135deg,#0b1d3a,#1d4ed8);color:#fff;text-align:center"><h2 style="margin:0 0 10px;font-size:30px;font-weight:800">Banner başlığı</h2><p style="margin:0 0 18px;font-size:17px;opacity:.9">Qısa izahat mətni</p><a href="#" class="cv-btn" style="display:inline-block;padding:13px 26px;border-radius:12px;background:#d4af37;color:#0b1d3a;font-weight:800;text-decoration:none">Ətraflı</a></div>' },
    card: { n: "Kart", i: "🗂️", html: '<div style="padding:24px;border-radius:18px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 10px 28px #0f172a14"><h3 style="margin:0 0 8px;font-size:22px;color:#0b1d3a">Kart başlığı</h3><p style="margin:0;color:#475569;line-height:1.6">Kartın mətni burada yazılır.</p></div>' },
    sp: { n: "Boşluq", i: "↕️", html: '<div style="height:40px"></div>' },
    hr: { n: "Xətt", i: "➖", html: '<hr style="border:0;height:2px;background:#cbd5e1;margin:8px 0">' },
    vid: { n: "Video", i: "▶️", html: "" },
    html: { n: "HTML", i: "🧩", html: '<div style="padding:20px;border:2px dashed #94a3b8;border-radius:14px;text-align:center;color:#475569">Xüsusi HTML bloku</div>' }
  };
  var CSSUI = '#cv-ui,#cv-ui *{box-sizing:border-box;font-family:Mulish,"Segoe UI",system-ui,sans-serif}' +
    'html.cv-on{padding-top:50px!important}@media(min-width:1100px){html.cv-on{padding-left:250px!important;padding-right:290px!important}}' +
    '#cv-ui{position:fixed;inset:0;z-index:2147483600;pointer-events:none;color:#1e1b4b;font-size:13px}' +
    '#cv-ui>*{pointer-events:auto}' +
    '.cv-top{position:fixed;top:0;left:0;right:0;height:50px;display:flex;align-items:center;gap:6px;padding:0 10px;background:linear-gradient(90deg,#7d2ae8,#4f46e5 55%,#00c4cc);color:#fff;box-shadow:0 4px 18px #0004;overflow-x:auto}' +
    '.cv-top button{border:0;border-radius:9px;padding:8px 12px;font-weight:700;font-size:13px;cursor:pointer;color:#fff;background:#ffffff26;white-space:nowrap}.cv-top button:hover{background:#ffffff40}' +
    '.cv-top .cv-pub{background:#fff;color:#4f1fb5}.cv-logo{font-size:16px;font-weight:900;margin-right:6px;white-space:nowrap}.cv-sp{flex:1}' +
    '.cv-chip{font-size:12px;background:#0003;padding:5px 10px;border-radius:99px;white-space:nowrap}' +
    '.cv-left,.cv-right{position:fixed;top:50px;bottom:0;background:#fff;box-shadow:0 0 22px #0003;overflow:auto}' +
    '.cv-left{left:0;width:250px}.cv-right{right:0;width:290px;padding:12px}' +
    'html.cv-nol .cv-left{display:none}html.cv-nor .cv-right{display:none}' +
    '.cv-tabs{display:flex;position:sticky;top:0;background:#fff;z-index:2;border-bottom:1px solid #e5e7eb}.cv-tabs button{flex:1;border:0;background:none;padding:11px 4px;font-weight:800;cursor:pointer;color:#64748b;font-size:12px}.cv-tabs button.on{color:#7d2ae8;box-shadow:inset 0 -3px #7d2ae8}' +
    '.cv-pane{padding:12px}.cv-pane h4{margin:14px 0 8px;font-size:12px;letter-spacing:.5px;color:#64748b;text-transform:uppercase}' +
    '.cv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cv-grid button,.cv-btn2{border:1px solid #e5e7eb;background:#f8fafc;border-radius:12px;padding:12px 6px;cursor:pointer;font-weight:700;font-size:12.5px;color:#1e1b4b}.cv-grid button:hover,.cv-btn2:hover{background:#f1e9ff;border-color:#c4a3ff}' +
    '.cv-grid button span{display:block;font-size:22px;margin-bottom:3px}' +
    '.cv-ly{display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:8px;cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden}.cv-ly:hover{background:#f1e9ff}.cv-ly.on{background:#7d2ae8;color:#fff}.cv-ly .nm{flex:1;overflow:hidden;text-overflow:ellipsis}.cv-ly .tg,.cv-ly .ey{width:20px;text-align:center;opacity:.8}' +
    '.cv-row{display:flex;align-items:center;gap:8px;margin:7px 0}.cv-row label{flex:0 0 78px;font-weight:700;color:#475569;font-size:12px}.cv-row input[type=range]{flex:1}.cv-row input[type=number],.cv-row input[type=text],.cv-row select,.cv-ta{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:7px 8px;font-size:13px}' +
    '.cv-ta{min-height:74px;resize:vertical}.cv-row input[type=color]{width:44px;height:30px;border:1px solid #d1d5db;border-radius:8px;padding:2px;background:#fff}' +
    '.cv-seg{display:flex;gap:4px}.cv-seg button{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:800}.cv-seg button.on{background:#7d2ae8;color:#fff;border-color:#7d2ae8}' +
    '.cv-act{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.cv-act button{border:1px solid #e5e7eb;background:#f8fafc;border-radius:9px;padding:8px 10px;cursor:pointer;font-weight:700;font-size:12px}.cv-act .red{color:#b91c1c;border-color:#fecaca;background:#fff1f2}' +
    '.cv-empty{color:#64748b;line-height:1.6;padding:8px 2px}.cv-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.5;margin:8px 0}' +
    '#cv-ov{position:fixed;inset:0;z-index:2147483590;pointer-events:none}#cv-ov .hv{position:fixed;border:2px solid #7d2ae8aa;background:#7d2ae814;display:none}#cv-ov .sl{position:fixed;border:2px solid #00c4cc;box-shadow:0 0 0 1px #fff inset;display:none}' +
    '#cv-ov .tb{position:fixed;display:none;gap:3px;background:#1e1b4b;border-radius:10px;padding:4px;pointer-events:auto;box-shadow:0 6px 18px #0006;z-index:2}#cv-ov .tb button{border:0;background:#ffffff1f;color:#fff;border-radius:7px;min-width:30px;height:28px;cursor:pointer;font-size:13px}#cv-ov .tb button:hover{background:#7d2ae8}' +
    '#cv-ov .lb{position:fixed;display:none;background:#00c4cc;color:#fff;font:700 11px Mulish,sans-serif;padding:2px 7px;border-radius:6px 6px 6px 0;white-space:nowrap}' +
    '#cv-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483640;background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:12px;font:700 13px Mulish,sans-serif;box-shadow:0 8px 24px #0006;max-width:92vw;text-align:center}' +
    'html.cv-pv .cv-left,html.cv-pv .cv-right{display:none}html.cv-pv{padding:50px 0 0!important}html.cv-pv #cv-ov{display:none}';

  function toast(t, ms) {
    var n = D.getElementById("cv-toast") || D.body.appendChild(Object.assign(D.createElement("div"), { id: "cv-toast" }));
    n.textContent = t; n.style.display = "block"; clearTimeout(n.__t); n.__t = setTimeout(function () { n.style.display = "none"; }, ms || 2600);
  }
  function $(id) { return D.getElementById(id); }

  function open() {
    if (editing) return;
    try { if (typeof V2 !== "undefined" && V2.close) V2.close(); } catch (e) { }
    var dr = jp(localStorage.getItem(LD), null);
    if (!liveStr) liveStr = sig(doc);
    var base = norm(jp(liveStr, blank()));
    if (dr && dr.doc && sig(norm(dr.doc)) !== sig(base) && confirm("Saxlanmamış qaralama tapıldı. Davam edək?\n\nOK = qaralamanı aç, Ləğv = dərc olunmuş versiyadan başla")) base = norm(dr.doc);
    doc = base; editing = true; preview = false; sel = null; hover = null; pending = null; hist = []; hi = -1; orig = {};
    D.documentElement.classList.add("cv-on");
    var st = D.createElement("style"); st.id = "cv-uicss"; st.textContent = CSSUI; D.head.appendChild(st);
    var ui = D.createElement("div"); ui.id = "cv-ui";
    ui.innerHTML = '<div class="cv-top"><span class="cv-logo">🎨 Canva Pro</span>' +
      '<button data-a="pl" title="Sol panel">◧</button><button data-a="undo">↶</button><button data-a="redo">↷</button><span class="cv-chip" id="cv-chip"></span><span class="cv-sp"></span>' +
      '<button data-a="pr" title="Sağ panel">◨</button><button data-a="prev">👁 Önbaxış</button><button data-a="save" class="cv-pub">🚀 Dərc et</button><button data-a="exit">✕ Bağla</button></div>' +
      '<div class="cv-left"><div class="cv-tabs"><button data-tab="add">➕ Əlavə</button><button data-tab="lay">🗂 Qatlar</button><button data-tab="win">🪟 Pəncərə</button><button data-tab="glb">⚙ Ümumi</button></div><div class="cv-pane" id="cv-lp"></div></div>' +
      '<div class="cv-right" id="cv-insp"></div><input type="file" id="cv-file" accept="image/*" style="display:none">';
    D.body.appendChild(ui);
    var ov = D.createElement("div"); ov.id = "cv-ov";
    ov.innerHTML = '<div class="hv"></div><div class="sl"></div><div class="lb"></div><div class="tb"><button data-a="edit" title="Mətni dəyiş">✏️</button><button data-a="parent" title="Üst element">⬆</button><button data-a="up" title="Yuxarı">▲</button><button data-a="down" title="Aşağı">▼</button><button data-a="hide" title="Gizlət / göstər">👁</button><button data-a="dup" title="Təkrarla">⧉</button><button data-a="del" title="Sil / sıfırla">🗑</button></div>';
    D.body.appendChild(ov);
    ui.addEventListener("click", onUI); ui.addEventListener("input", onInput); ui.addEventListener("change", onChange);
    ov.addEventListener("click", onUI);
    D.addEventListener("click", onPage, true); D.addEventListener("dblclick", onDbl, true);
    D.addEventListener("mousemove", onMove, true); D.addEventListener("keydown", onKey, true);
    $("cv-file").addEventListener("change", onFile);
    applyCss(); applyDom(); snap(true); setTab("add"); renderInsp(); chip(); tick();
    toast("Canva Pro açıldı — istənilən elementə klikləyin", 3200);
  }
  function close(keep) {
    if (!editing) return;
    if (!keep && sig(doc) !== liveStr && !confirm("Dərc olunmamış dəyişikliklər var. Yenə də bağlansın? (Qaralama saxlanılıb, sonra davam edə bilərsiniz.)")) return;
    endEdit();
    editing = false; preview = false; cancelAnimationFrame(raf);
    D.removeEventListener("click", onPage, true); D.removeEventListener("dblclick", onDbl, true);
    D.removeEventListener("mousemove", onMove, true); D.removeEventListener("keydown", onKey, true);
    ["cv-ui", "cv-ov", "cv-uicss"].forEach(function (i) { var n = $(i); n && n.remove(); });
    D.documentElement.classList.remove("cv-on", "cv-nol", "cv-nor", "cv-pv");
    doc = norm(jp(liveStr, blank())); applyCss(); applyDom(true);
  }

  /* ----- tarixçə / qaralama ----- */
  function snap(first) {
    var s = JSON.stringify(doc);
    if (!first && hist[hi] === s) return;
    hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1;
    try { localStorage.setItem(LD, JSON.stringify({ t: Date.now(), doc: doc })); } catch (e) { }
    chip();
  }
  function restore(s) { doc = norm(jp(s, blank())); applyCss(); applyDom(true); renderInsp(); chip(); if (tab === "lay") renderLayers(); }
  function chip() {
    var c = $("cv-chip"); if (!c) return;
    var dirty = sig(doc) !== liveStr;
    c.textContent = count(doc) + " dəyişiklik · " + (dirty ? "● dərc olunmayıb" : "✓ dərc olunub") + (lastMiss ? " · ⚠ " + lastMiss + " tətbiq olunmadı" : "");
    c.title = lastMiss ? "Bəzi dəyişikliklər tapılmayan elementlərə aiddir (səhifə strukturu dəyişib). Qatlardan sıfırlaya bilərsiniz." : "";
  }

  /* ----- seçim və redaktə ----- */
  function blkOf(el) { return el && el.closest ? el.closest("cv-block") : null; }
  function bOf(e) { var id = e && e.getAttribute("data-cv"); return doc.blocks.filter(function (b) { return b.id === id; })[0]; }
  function opOf(s) { return doc.ops[s] || (doc.ops[s] = {}); }
  function tidy(s) { var p = doc.ops[s]; if (p && !p.h && !p.tx && p.tx !== "" && (!p.st || !Object.keys(p.st).length) && (!p.at || !Object.keys(p.at).length)) delete doc.ops[s]; else if (p) { if (p.st && !Object.keys(p.st).length) delete p.st; if (p.at && !Object.keys(p.at).length) delete p.at; } }
  function remember(s, e, k) { var o = orig[s] || (orig[s] = { at: {} }); if (k === "tx" && o.tx == null) o.tx = e.innerHTML; if (k && k !== "tx" && !(k in o.at)) o.at[k] = e.getAttribute(k === "href" && e.tagName !== "A" ? "data-cv-href" : k); }
  function setStyle(el, prop, val) {
    var blk = blkOf(el);
    if (blk && el === blk) { var b = bOf(blk); if (!b) return; b.st = b.st || {}; if (val === "" || val == null) delete b.st[prop]; else b.st[prop] = val; styleBlock(blk, b); }
    else if (blk) { if (val === "" || val == null) el.style.removeProperty(prop); else el.style.setProperty(prop, val); syncBlock(blk); }
    else { var s = pathOf(el), p = opOf(s); p.st = p.st || {}; if (val === "" || val == null) delete p.st[prop]; else p.st[prop] = val; tidy(s); applyCss(); }
  }
  function syncBlock(blk) {
    var b = bOf(blk); if (!b) return;
    var c = blk.cloneNode(true);
    [].forEach.call(c.querySelectorAll("iframe"), function (n) { n.remove(); });
    [].forEach.call(c.querySelectorAll("[contenteditable]"), function (n) { n.removeAttribute("contenteditable"); });
    b.html = clean(c.innerHTML); blk.__h = b.html;
  }
  function setAttr(el, k, v) {
    var blk = blkOf(el);
    if (blk && el !== blk) { el.setAttribute(k, v); syncBlock(blk); return; }
    var s = pathOf(el); remember(s, el, k); var p = opOf(s); p.at = p.at || {}; if (v === "") delete p.at[k]; else p.at[k] = v; tidy(s);
    applyOp(s, p, el); if (v === "") { el.removeAttribute(k === "href" && el.tagName !== "A" ? "data-cv-href" : k); }
  }
  function setText(el, html) {
    var blk = blkOf(el);
    if (blk && el !== blk) { el.innerHTML = clean(html); syncBlock(blk); return; }
    var s = pathOf(el); remember(s, el, "tx"); opOf(s).tx = clean(html); el.innerHTML = opOf(s).tx; el.__tx = opOf(s).tx;
  }
  var LEAFOK = /^(BR|B|I|U|STRONG|EM|SPAN|A|SMALL|MARK|SUB|SUP)$/;
  function isLeaf(el) {
    if (!el || /^(IMG|INPUT|SELECT|TEXTAREA|SVG|VIDEO|CANVAS|IFRAME|HR|CV-BLOCK|BODY|HTML)$/i.test(el.tagName)) return false;
    if (!(el.textContent || "").trim()) return false;
    return [].every.call(el.querySelectorAll("*"), function (c) { return LEAFOK.test(c.tagName) && !c.id; });
  }
  function leafUp(el) { while (el && el !== D.body) { if (isLeaf(el)) return el; el = el.parentElement; } return null; }
  var editEl = null;
  function startEdit(el) {
    endEdit(); if (!isLeaf(el)) return false;
    var s = blkOf(el) ? null : pathOf(el); if (s) remember(s, el, "tx");
    editEl = el; el.setAttribute("contenteditable", "true"); el.focus();
    try { var r = D.createRange(); r.selectNodeContents(el); var g = getSelection(); g.removeAllRanges(); g.addRange(r); } catch (e) { }
    return true;
  }
  function endEdit() {
    if (!editEl) return;
    var el = editEl; editEl = null; el.removeAttribute("contenteditable");
    var h = clean(el.innerHTML), blk = blkOf(el);
    if (blk && el !== blk) syncBlock(blk); else { var s = pathOf(el); opOf(s).tx = h; el.__tx = h; }
    snap(); renderInsp();
  }
  function select(el) {
    if (el && (inUI(el) || el === D.documentElement)) return;
    if (sel !== el) endEdit();
    sel = el || null; renderInsp(); if (tab === "lay") hiliteLayer();
  }
  function onPage(e) {
    if (bypass || preview || !editing) return;
    var t = e.target; if (inUI(t)) return;
    if (t.closest && t.closest("[contenteditable=true]")) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (pending) { insertBlock(pending, t); pending = null; return; }
    select(t);
  }
  function onDbl(e) {
    if (preview || !editing || inUI(e.target)) return;
    var l = leafUp(e.target); if (!l) return;
    e.preventDefault(); e.stopPropagation(); select(l); startEdit(l);
  }
  function onMove(e) { hover = editing && !preview && !inUI(e.target) ? e.target : null; }
  function onKey(e) {
    if (!editing) return;
    var ed = editEl && editEl.contains(e.target);
    if (e.key === "Escape") { if (ed) editEl.blur(), endEdit(); else if (pending) pending = null, toast("Ləğv edildi"); else select(null); return; }
    if ((e.ctrlKey || e.metaKey) && !ed && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      if (e.key === "z") { e.preventDefault(); act("undo"); } else if (e.key === "y") { e.preventDefault(); act("redo"); }
    }
    if ((e.key === "Delete") && !ed && sel && blkOf(sel) === sel && !/INPUT|TEXTAREA/.test(e.target.tagName)) act("del");
  }

  /* ----- blok əlavə et ----- */
  function blockLevel(el) {
    while (el && el !== D.body) { var d = getComputedStyle(el).display; if (d !== "inline" && d !== "contents" && d !== "inline-block" || el.tagName === "CV-BLOCK") break; el = el.parentElement; }
    return el;
  }
  function insertBlock(type, target) {
    var def = BL[type], html = def.html, anchor, pos = "after";
    if (type === "vid") {
      var u = prompt("YouTube linkini yapışdırın:"); if (!u) return;
      var m = u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,15})/); if (!m) return toast("Link tanınmadı");
      html = '<div class="cv-vid" data-vid="' + m[1] + '" style="position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;background:#000"></div>';
    }
    if (type === "html") { var h = prompt("HTML kodunu yapışdırın (təhlükəsizlik üçün script/iframe silinir):", html); if (h == null) return; html = h; }
    target = target || sel;
    if (!target || target === D.documentElement || target === D.body) { var m2 = mainRoot(); target = m2; pos = "in"; }
    var blk = blkOf(target);
    anchor = blk || blockLevel(target) || target;
    if (anchor === D.body) pos = "in";
    var b = { id: rid(), a: pathOf(anchor), p: pos, html: clean(html), st: {}, h: 0, o: null, ty: type };
    if (blk) { var pb = bOf(blk); if (pb) { b.a = pb.a; b.p = pb.p; } }   // blok bloku izləyir
    var idx = blk ? doc.blocks.indexOf(bOf(blk)) + 1 : doc.blocks.length;
    doc.blocks.splice(idx, 0, b);
    applyDom(); snap();
    var e = q('cv-block[data-cv="' + b.id + '"]'); if (e) { select(e); e.scrollIntoView({ block: "center", behavior: "smooth" }); }
    toast(def.n + " əlavə olundu — mətni ikiqat klikləyib dəyişin");
  }
  function mainRoot() {
    var best = null, h = 0;
    [].forEach.call(D.body.children, function (c) { if (inUI(c) || /^(SCRIPT|STYLE|LINK|CV-BLOCK)$/.test(c.tagName)) return; var r = c.getBoundingClientRect(); if (r.height > h && getComputedStyle(c).display !== "none") { h = r.height; best = c; } });
    return best || D.body;
  }

  /* ----- əməliyyatlar ----- */
  function siblingsOf(el) { return [].filter.call(el.parentElement.children, function (c) { return !inUI(c) && !/^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(c.tagName); }); }
  function moveEl(el, d) {
    var p = el.parentElement; if (!p) return;
    var sibs = siblingsOf(el).map(function (c, i) { return { c: c, i: i, o: parseInt(getComputedStyle(c).order, 10) || 0 }; });
    sibs.sort(function (a, b) { return a.o - b.o || a.i - b.i; });
    var k = sibs.map(function (x) { return x.c; }).indexOf(el), j = k + d;
    if (j < 0 || j >= sibs.length) return toast("Daha irəli getmir");
    var tmp = sibs[k]; sibs[k] = sibs[j]; sibs[j] = tmp;
    var pd = getComputedStyle(p).display;
    if (pd !== "flex" && pd !== "grid" && pd !== "inline-flex" && pd !== "inline-grid" && p !== D.documentElement) { setStyle(p, "display", "flex"); setStyle(p, "flex-direction", "column"); }
    sibs.forEach(function (x, i) { var v = String((i + 1) * 10); if (x.c.tagName === "CV-BLOCK") { var b = bOf(x.c); if (b) { b.o = +v; styleBlock(x.c, b); } } else setStyle(x.c, "order", v); });
    snap();
  }
  function act(a) {
    if (a === "undo") { if (editEl) endEdit(); if (hi > 0) { hi--; restore(hist[hi]); } return; }
    if (a === "redo") { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } return; }
    if (a === "pl") { D.documentElement.classList.toggle("cv-nol"); return; }
    if (a === "pr") { D.documentElement.classList.toggle("cv-nor"); return; }
    if (a === "prev") { preview = !preview; D.documentElement.classList.toggle("cv-pv", preview); applyCss(); applyDom(); var b = D.querySelector('.cv-top [data-a="prev"]'); if (b) b.textContent = preview ? "✏️ Redaktə" : "👁 Önbaxış"; return; }
    if (a === "save") return doPublish();
    if (a === "exit") return close();
    if (!sel) return toast("Əvvəlcə bir element seçin");
    var blk = blkOf(sel), isB = blk && sel === blk;
    if (a === "edit") { var l = leafUp(sel); if (!l || !startEdit(l)) toast("Bu elementdə mətn yoxdur — içindəki yazını seçin"); return; }
    if (a === "parent") { if (sel.parentElement && sel.parentElement !== D.body) select(sel.parentElement); return; }
    if (a === "up") return moveEl(sel, -1);
    if (a === "down") return moveEl(sel, 1);
    if (a === "hide") {
      if (isB) { var b1 = bOf(blk); b1.h = b1.h ? 0 : 1; styleBlock(blk, b1); }
      else { var s = pathOf(sel), p = opOf(s); p.h = p.h ? 0 : 1; if (!p.h) delete p.h; tidy(s); applyCss(); }
      snap(); renderInsp(); return;
    }
    if (a === "dup") {
      if (!isB) return toast("Təkrarlamaq yalnız əlavə etdiyiniz bloklar üçündür");
      var o = bOf(blk), c = JSON.parse(JSON.stringify(o)); c.id = rid(); doc.blocks.splice(doc.blocks.indexOf(o) + 1, 0, c); applyDom(); snap();
      select(q('cv-block[data-cv="' + c.id + '"]')); return;
    }
    if (a === "del") {
      if (isB) { if (!confirm("Bu blok silinsin?")) return; doc.blocks.splice(doc.blocks.indexOf(bOf(blk)), 1); applyDom(); sel = null; snap(); renderInsp(); return; }
      if (blk) { return toast("Blokun içindəki elementi gizlədə bilərsiniz (👁)"); }
      var s2 = pathOf(sel); delete doc.ops[s2]; applyCss(); applyDom(true); snap(); renderInsp(); toast("Element orijinal vəziyyətə qayıtdı"); return;
    }
  }
  function doPublish() {
    if (editEl) endEdit();
    if (sig(doc) === liveStr) return toast("Dəyişiklik yoxdur");
    if (!confirm("Dərc edilsin?\n\nDəyişikliklər bütün istifadəçilərdə dərhal görünəcək.")) return;
    toast("Dərc olunur…", 8000);
    publish(doc).then(function () { doc = norm(doc); liveStr = sig(doc); try { localStorage.removeItem(LD); } catch (e) { } snap(true); chip(); toast("✅ Dərc olundu — bütün cihazlarda aktivdir", 3600); })
      .catch(function (e) { toast("❌ Xəta: " + (e && e.message || e), 6000); });
  }

  /* ----- sol panel ----- */
  function setTab(t) {
    tab = t;
    [].forEach.call(D.querySelectorAll(".cv-tabs button"), function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
    var p = $("cv-lp"); if (!p) return;
    if (t === "add") {
      p.innerHTML = '<h4>Blok əlavə et</h4><div class="cv-grid">' + Object.keys(BL).map(function (k) { return '<button data-add="' + k + '"><span>' + BL[k].i + "</span>" + BL[k].n + "</button>"; }).join("") + "</div>" +
        '<div class="cv-note">Əvvəl səhifədə bir yer seçin — blok onun <b>altına</b> düşəcək. Seçim yoxdursa blok düyməsini basıb sonra yerə klikləyin.</div>';
    } else if (t === "lay") { p.innerHTML = '<div class="cv-row"><button class="cv-btn2" data-a2="rl">🔄 Yenilə</button></div><div id="cv-ly"></div>'; renderLayers(); }
    else if (t === "win") {
      var n = navItems();
      p.innerHTML = "<h4>Pəncərələr (menyu bölmələri)</h4>" + (n.length ? n.map(function (x, i) { return '<button class="cv-btn2" style="display:block;width:100%;margin:5px 0;text-align:left" data-nav="' + i + '">🪟 ' + esc(x.t) + "</button>"; }).join("") : '<div class="cv-note">Menyu tapılmadı.</div>') +
        '<div class="cv-note">Pəncərəyə keçin, sonra onun içində klikləyib redaktə edin. Açılmış pəncərə/modal da Qatlar bölməsində görünür.</div>';
      p.__nav = n;
    } else if (t === "glb") {
      var bs = doc.ops.body && doc.ops.body.st || {};
      p.innerHTML = '<h4>Ümumi səhifə</h4><div class="cv-row"><label>Fon rəngi</label><input type="color" data-g="background-color" value="' + hex(bs["background-color"] || getComputedStyle(D.body).backgroundColor) + '"></div>' +
        '<div class="cv-row"><label>Şrift</label><select data-g="font-family"><option value="">Orijinal</option><option value="Mulish,sans-serif">Mulish</option><option value="Arial,Helvetica,sans-serif">Arial</option><option value="Georgia,serif">Georgia</option><option value="\'Courier New\',monospace">Mono</option></select></div>' +
        '<h4>Təhlükəli zona</h4><div class="cv-act"><button class="red" data-a2="reset">♻️ Hamısını orijinala qaytar</button></div>';
      var sf = p.querySelector("select"); if (sf) sf.value = bs["font-family"] || "";
    }
  }
  function navItems() {
    var NAVS = ["ANA SƏHİFƏ", "YENİLİKLƏR", "SINAQLAR", "TESTLƏR", "İMTAHAN", "MATERİALLAR", "MƏLUMAT", "DƏRS MATERİALLARI", "XƏBƏRLƏR"], out = [], seen = {};
    [].forEach.call(D.querySelectorAll("a,button,li,div,span"), function (n) {
      if (inUI(n) || n.children.length > 2) return;
      var t = (n.textContent || "").trim().replace(/\s+/g, " "); if (!t || t.length > 22) return;
      var u = t.toLocaleUpperCase("az");
      if (NAVS.indexOf(u) > -1 && !seen[u] && n.getBoundingClientRect().top < 300) { seen[u] = 1; out.push({ t: t, n: n }); }
    });
    return out;
  }
  function goNav(n) { var c = n.querySelector && n.querySelector("a,button") || n; bypass = true; try { c.click(); } finally { bypass = false; } sel = null; setTimeout(function () { renderInsp(); if (tab === "lay") renderLayers(); }, 500); }
  function lbl(el) {
    var tx = ""; [].forEach.call(el.childNodes, function (n) { if (n.nodeType === 3) tx += n.textContent; }); tx = tx.trim().replace(/\s+/g, " ");
    if (!tx) tx = (el.textContent || "").trim().replace(/\s+/g, " ");
    var c = el.id ? "#" + el.id : [].slice.call(el.classList).filter(stable)[0] ? "." + [].slice.call(el.classList).filter(stable)[0] : "";
    return el.tagName.toLowerCase() + c + (tx ? " · " + tx.slice(0, 26) : "");
  }
  function layerKids(p) { return [].filter.call(p.children, function (c) { return !inUI(c) && !/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|TEMPLATE|BR)$/.test(c.tagName) && (c.offsetHeight > 0 || (doc.ops[pathOf(c)] || {}).h); }); }
  function layerRow(el, depth) {
    var i = lyEls.push(el) - 1, kids = layerKids(el).length, hid = el.tagName === "CV-BLOCK" ? (bOf(el) || {}).h : (doc.ops[pathOf(el)] || {}).h;
    return '<div class="cv-ly" data-ly="' + i + '" style="padding-left:' + (4 + depth * 11) + 'px"><span class="tg" data-tg="' + i + '" data-d="' + depth + '">' + (kids ? "▸" : "·") + '</span><span class="nm">' + esc(lbl(el)) + '</span><span class="ey" data-ey="' + i + '">' + (hid ? "🚫" : "👁") + "</span></div>";
  }
  function renderLayers() { lyEls = []; var h = $("cv-ly"); if (!h) return; h.innerHTML = layerKids(D.body).map(function (c) { return layerRow(c, 0); }).join("") || '<div class="cv-empty">Boşdur</div>'; hiliteLayer(); }
  function hiliteLayer() { [].forEach.call(D.querySelectorAll(".cv-ly"), function (r) { r.classList.toggle("on", lyEls[+r.getAttribute("data-ly")] === sel); }); }
  function hex(c) {
    var m = String(c || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && +m[4] === 0)) return /^#[0-9a-f]{6}$/i.test(c) ? c : "#ffffff";
    return "#" + [m[1], m[2], m[3]].map(function (x) { return ("0" + (+x).toString(16)).slice(-2); }).join("");
  }

  /* ----- sağ panel (inspektor) ----- */
  function renderInsp() {
    var h = $("cv-insp"); if (!h) return;
    if (!sel || !sel.isConnected) { sel = null; h.innerHTML = '<div class="cv-empty"><b>Seçim yoxdur</b><br>Səhifədə istənilən yazıya, şəkilə, düyməyə və ya bölməyə klikləyin.<br><br>✏️ Mətni dəyişmək: ikiqat klik<br>👁 Gizlətmək: seçib 👁<br>▲▼ Yerini dəyişmək<br>➕ Yeni blok: sol paneldən</div>'; return; }
    var cs = getComputedStyle(sel), blk = blkOf(sel), isB = blk && sel === blk, leaf = isLeaf(sel), link = sel.closest("a") || (sel.tagName === "A" ? sel : null);
    var st = isB ? (bOf(blk) || {}).st || {} : blk ? {} : (doc.ops[pathOf(sel)] || {}).st || {};
    var fs = parseInt(cs.fontSize, 10) || 16, br = parseInt(cs.borderTopLeftRadius, 10) || 0, pd = parseInt(cs.paddingTop, 10) || 0, op = Math.round((parseFloat(cs.opacity) || 1) * 100);
    var hid = isB ? (bOf(blk) || {}).h : (doc.ops[pathOf(sel)] || {}).h;
    var href = link ? (link.getAttribute("href") || "") : (sel.getAttribute("data-cv-href") || "");
    var s = '<div style="font-weight:800;color:#7d2ae8;margin-bottom:6px;word-break:break-all">' + esc(lbl(sel)) + (isB ? " (əlavə blok)" : "") + "</div>";
    if (leaf) s += '<div class="cv-row"><textarea class="cv-ta" data-f="text">' + esc(sel.innerText) + "</textarea></div>";
    s += '<div class="cv-act"><button data-a2="parent">⬆ Üst</button><button data-a2="edit">✏️ Mətn</button><button data-a2="up">▲</button><button data-a2="down">▼</button><button data-a2="hide">' + (hid ? "👁 Göstər" : "🚫 Gizlət") + "</button>" + (isB ? '<button data-a2="dup">⧉ Təkrarla</button><button class="red" data-a2="del">🗑 Sil</button>' : '<button class="red" data-a2="del">↺ Sıfırla</button>') + "</div>";
    s += '<div class="cv-row"><label>Ölçü</label><input type="range" min="8" max="120" value="' + fs + '" data-p="font-size" data-u="px"><span id="v-fs" style="width:34px">' + fs + "</span></div>";
    s += '<div class="cv-row"><label>Yazı rəngi</label><input type="color" data-p="color" value="' + hex(cs.color) + '"></div>';
    s += '<div class="cv-row"><label>Fon rəngi</label><input type="color" data-p="background-color" value="' + hex(st["background-color"] || cs.backgroundColor) + '"><button class="cv-btn2" style="padding:6px 8px" data-clr="background-color">Şəffaf</button></div>';
    s += '<div class="cv-row"><label>Stil</label><div class="cv-seg"><button data-tg="bold" class="' + (+cs.fontWeight >= 600 ? "on" : "") + '"><b>B</b></button><button data-tg="italic" class="' + (cs.fontStyle === "italic" ? "on" : "") + '"><i>I</i></button><button data-tg="underline" class="' + (/underline/.test(cs.textDecorationLine) ? "on" : "") + '"><u>U</u></button></div></div>';
    s += '<div class="cv-row"><label>Düzləmə</label><div class="cv-seg">' + ["left", "center", "right"].map(function (x) { return '<button data-al="' + x + '" class="' + (cs.textAlign === x ? "on" : "") + '">' + { left: "⇤", center: "↔", right: "⇥" }[x] + "</button>"; }).join("") + "</div></div>";
    s += '<div class="cv-row"><label>Künc</label><input type="range" min="0" max="60" value="' + br + '" data-p="border-radius" data-u="px"></div>';
    s += '<div class="cv-row"><label>Boşluq</label><input type="range" min="0" max="80" value="' + pd + '" data-p="padding" data-u="px"></div>';
    s += '<div class="cv-row"><label>Şəffaflıq</label><input type="range" min="10" max="100" value="' + op + '" data-p="opacity" data-u="%"></div>';
    s += '<div class="cv-row"><label>Eni</label><select data-w><option value="">Orijinal</option><option value="100%">100%</option><option value="75%">75%</option><option value="50%">50%</option><option value="auto">Avto</option></select></div>';
    if (sel.tagName === "IMG") s += '<div class="cv-row"><label>Şəkil</label><button class="cv-btn2" data-a2="pick">📤 Yüklə</button></div><div class="cv-row"><input type="text" data-f="src" placeholder="və ya şəkil linki (https://…)" value="' + ((sel.getAttribute("src") || "").indexOf("data:") === 0 ? "" : esc(sel.getAttribute("src") || "")) + '"></div>';
    if (link || (leaf && !isB) || sel.tagName === "BUTTON" || isB) s += '<div class="cv-row"><label>Keçid</label><input type="text" data-f="href" placeholder="https://… və ya #bölmə" value="' + esc(href) + '"></div>';
    h.innerHTML = s;
    var w = h.querySelector("[data-w]"); if (w) w.value = st.width || "";
  }
  function onUI(e) {
    var t = e.target.closest ? e.target.closest("button,.cv-ly,[data-ey]") : null; if (!t) return;
    var a = t.getAttribute("data-a"); if (a) { act(a); return; }
    if (t.getAttribute("data-tab")) return setTab(t.getAttribute("data-tab"));
    var add = t.getAttribute("data-add");
    if (add) { if (sel) insertBlock(add, sel); else { pending = add; toast("İndi blokun əlavə olunacağı yerə klikləyin (altına düşəcək)", 4000); } return; }
    var a2 = t.getAttribute("data-a2");
    if (a2) {
      if (a2 === "rl") return renderLayers();
      if (a2 === "pick") return $("cv-file").click();
      if (a2 === "reset") { if (!confirm("Bütün dəyişikliklər (qaralamada) orijinala qaytarılsın? Dərc edənə qədər yayımlanmır.")) return; doc = blank(); applyCss(); applyDom(true); sel = null; snap(); renderInsp(); chip(); return toast("Orijinal dizayn — dərc etsəniz hamıda tətbiq olunacaq", 4000); }
      return act(a2);
    }
    var nv = t.getAttribute("data-nav"); if (nv != null) { var L = $("cv-lp").__nav; return L && L[+nv] && goNav(L[+nv].n); }
    var tg = t.getAttribute("data-tg");
    if (tg && sel && !t.closest(".cv-ly")) {
      var on = t.classList.contains("on");
      if (tg === "bold") setStyle(sel, "font-weight", on ? "400" : "800");
      if (tg === "italic") setStyle(sel, "font-style", on ? "normal" : "italic");
      if (tg === "underline") setStyle(sel, "text-decoration", on ? "none" : "underline");
      snap(); return renderInsp();
    }
    var al = t.getAttribute("data-al"); if (al && sel) { setStyle(sel, "text-align", al); snap(); return renderInsp(); }
    var cl = t.getAttribute("data-clr"); if (cl && sel) { setStyle(sel, cl, "transparent"); snap(); return renderInsp(); }
    var ey = t.getAttribute("data-ey");
    if (ey != null) { var el = lyEls[+ey]; if (el) { var bk = el.tagName === "CV-BLOCK" ? bOf(el) : null; if (bk) { bk.h = bk.h ? 0 : 1; styleBlock(el, bk); } else { var s = pathOf(el), p = opOf(s); p.h = p.h ? 0 : 1; if (!p.h) delete p.h; tidy(s); applyCss(); } snap(); renderLayers(); renderInsp(); } e.stopPropagation(); return; }
    var ly = t.closest(".cv-ly");
    if (ly) {
      var i = +ly.getAttribute("data-ly"), el2 = lyEls[i], tgl = e.target.closest("[data-tg]");
      if (tgl && el2) {                                          // aç/bağla
        var nx = ly.nextElementSibling, d = +tgl.getAttribute("data-d");
        if (tgl.textContent === "▾") { while (nx && +nx.querySelector(".tg").getAttribute("data-d") > d) { var r = nx; nx = nx.nextElementSibling; r.remove(); } tgl.textContent = "▸"; }
        else if (tgl.textContent === "▸") { var tmp = D.createElement("div"); tmp.innerHTML = layerKids(el2).map(function (c) { return layerRow(c, d + 1); }).join(""); while (tmp.lastChild) ly.after(tmp.lastChild); tgl.textContent = "▾"; }
        return;
      }
      if (el2 && el2.isConnected) { select(el2); el2.scrollIntoView({ block: "center", behavior: "smooth" }); }
    }
  }
  function onInput(e) {
    var t = e.target;
    if (t.getAttribute("data-g") != null) { setStyle(D.body, t.getAttribute("data-g"), t.value); return; }
    if (!sel) return;
    var p = t.getAttribute("data-p");
    if (p) { var u = t.getAttribute("data-u") || "", v = u === "%" ? (t.value / 100) + "" : t.value + u; if (p === "opacity" || p === "font-size" || p === "border-radius" || p === "padding" || p === "color" || p === "background-color") setStyle(sel, p, v); var l = $("v-fs"); if (p === "font-size" && l) l.textContent = t.value; return; }
    var f = t.getAttribute("data-f");
    if (f === "text") { var h = esc(t.value).replace(/\n/g, "<br>"); if (isLeaf(sel)) setText(sel, h); }
    else if (f === "href") setAttr(sel, "href", t.value.trim());
    else if (f === "src") setAttr(sel, "src", t.value.trim());
  }
  function onChange(e) {
    var t = e.target;
    if (t.hasAttribute("data-w") && sel) { setStyle(sel, "width", t.value); if (t.value) setStyle(sel, "margin-left", "auto"), setStyle(sel, "margin-right", "auto"); }
    if (t.getAttribute("data-g") != null) { /* snap aşağıda */ }
    snap();
  }
  function onFile(e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f || !sel) return;
    var rd = new FileReader();
    rd.onload = function () {
      var im = new Image();
      im.onload = function () {
        var m = 1400, k = Math.min(1, m / Math.max(im.width, im.height)), c = D.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        var u = c.toDataURL("image/jpeg", 0.8); if (u.length > 700000) u = c.toDataURL("image/jpeg", 0.6);
        if (sel && sel.tagName === "IMG") { setAttr(sel, "src", u); snap(); renderInsp(); toast("Şəkil yükləndi (" + Math.round(u.length / 1024) + " KB)"); }
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  }

  /* ----- overlay: hover / seçim çərçivəsi ----- */
  function box(n, el) {
    if (!el || !el.isConnected) { n.style.display = "none"; return null; }
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) { n.style.display = "none"; return null; }
    n.style.cssText = "display:block;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px";
    return r;
  }
  function tick() {
    if (!editing) return;
    var ov = $("cv-ov");
    if (ov && !preview) {
      var hv = ov.querySelector(".hv"), sl = ov.querySelector(".sl"), tb = ov.querySelector(".tb"), lb = ov.querySelector(".lb");
      box(hv, hover && hover !== sel ? hover : null);
      var r = box(sl, sel);
      if (r) {
        var top = Math.max(54, r.top - 36), left = Math.min(Math.max(4, r.left), innerWidth - 250);
        tb.style.cssText = "display:flex;left:" + left + "px;top:" + top + "px";
        lb.style.cssText = "display:block;left:" + r.left + "px;top:" + Math.max(54, r.top - 18) + "px;" + (r.top - 18 < 54 ? "display:none" : ""); lb.textContent = Math.round(r.width) + " × " + Math.round(r.height);
      } else { tb.style.display = "none"; lb.style.display = "none"; }
    }
    raf = requestAnimationFrame(tick);
  }

  /* =====================================================================
     ADMIN PANEL V2 — "Canva Pro" bölməsi
     ===================================================================== */
  function fmt(t) { return t ? new Date(+t).toLocaleString("az-AZ") : "—"; }
  function vPage() {
    return api("dq_v2_store?select=id,t:data->>t,n:data->>n&collection=eq." + COL + "&order=id.desc&limit=15").catch(function () { return null; }).then(function (rows) {
      var cloud = rows !== null; rows = rows || [];
      var cards = ["Ana səhifə", "Yeniliklər", "Sınaqlar", "Testlər", "İmtahan", "Materiallar", "Məlumat"].map(function (n) { return '<button class="v2-b" style="margin:4px" onclick="CanvaPro.openWin(\'' + n + '\')">🪟 ' + n + "</button>"; }).join("");
      var tr = rows.map(function (r, i) { return "<tr><td>" + (i === 0 ? "🟢 Aktiv" : "v" + (rows.length - i)) + "</td><td>" + fmt(r.t) + "</td><td>" + (r.n || 0) + " dəyişiklik</td><td>" + (i === 0 ? "" : '<button class="v2-b" onclick="CanvaPro.vRestore(' + r.id + ')">Bərpa et</button>') + "</td></tr>"; }).join("");
      return {
        title: "🎨 Canva Pro", sub: "Saytı Canva kimi dizayn et: mətni dəyiş, bölməni gizlət, yeni blok əlavə et — hamısı canlı sayt üzərində.",
        html: '<div class="v2-card" style="background:linear-gradient(135deg,#7d2ae8,#4f46e5 55%,#00c4cc);color:#fff;margin-bottom:14px"><h2 style="margin:0 0 8px;color:#fff">🎨 Canva Pro Redaktoru</h2><div style="line-height:1.7;opacity:.95">✏️ İstənilən yazını ikiqat klikləyib dəyiş &nbsp;·&nbsp; 🚫 İstənilən hissəni gizlət &nbsp;·&nbsp; ▲▼ Yerini dəyiş<br>🎨 Rəng, ölçü, künc, şəffaflıq &nbsp;·&nbsp; ➕ Başlıq, mətn, düymə, şəkil, banner, video əlavə et<br>↶ Geri al &nbsp;·&nbsp; 👁 Önbaxış &nbsp;·&nbsp; 🚀 Dərc et — bütün cihazlarda dərhal aktiv olur</div><button class="v2-b" style="margin-top:14px;background:#fff;color:#4f1fb5;font-size:15px" onclick="CanvaPro.open()">🎨 Redaktoru aç</button></div>' +
          '<div class="v2-card" style="margin-bottom:14px"><h3>🪟 Pəncərəni seç və redaktə et</h3><div class="v2-sub">Sayta keçib həmin pəncərədə redaktoru açır.</div>' + cards + "</div>" +
          '<div class="v2-card" style="margin-bottom:14px"><h3>🕘 Versiyalar</h3>' + (cloud ? (tr ? '<table style="width:100%;border-collapse:collapse;font-size:13px" cellpadding="7">' + tr + "</table>" : '<div class="v2-sub">Hələ heç nə dərc olunmayıb.</div>') : '<div class="v2-sub" style="color:#b45309">⚠ Verilənlər bazasına qoşulmaq alınmadı.</div>') + "</div>" +
          '<div class="v2-card"><h3>♻️ Orijinal dizayna qayıt</h3><div class="v2-sub">Bütün Canva Pro dəyişikliklərini ləğv edir (köhnə versiyalar saxlanılır, bərpa edə bilərsiniz).</div><button class="v2-b" style="background:#b91c1c" onclick="CanvaPro.vReset()">Hamısını sıfırla</button></div>'
      };
    });
  }
  function hookV2() {
    try {
      if (typeof V2 === "undefined" || !V2.menu || V2.__cv) return false;
      V2.__cv = 1; V2.menu.splice(1, 0, ["canva", "fa-palette", "Canva Pro"]); V2.p_canva = vPage; return true;
    } catch (e) { return false; }
  }

  window.CanvaPro = {
    open: open, close: close,
    openWin: function (name) {
      try { if (typeof V2 !== "undefined" && V2.close) V2.close(); } catch (e) { }
      setTimeout(function () {
        var it = navItems().filter(function (x) { return x.t.toLocaleUpperCase("az") === String(name).toLocaleUpperCase("az"); })[0];
        if (it) { bypass = true; try { (it.n.querySelector && it.n.querySelector("a,button") || it.n).click(); } finally { bypass = false; } }
        setTimeout(open, 600);
      }, 150);
    },
    vRestore: function (id) {
      if (!confirm("Bu versiya bərpa edilsin (yeni aktiv versiya kimi)?")) return;
      api("dq_v2_store?select=data&id=eq." + id).then(function (r) { return publish(r[0].data); })
        .then(function () { doc = norm(jp(liveStr, blank())); applyCss(); applyDom(true); try { V2.go("canva"); } catch (e) { } toast("✅ Versiya bərpa olundu"); })
        .catch(function (e) { alert("Xəta: " + (e && e.message || e)); });
    },
    vReset: function () {
      if (!confirm("Bütün Canva Pro dəyişiklikləri ləğv edilsin?")) return;
      publish(blank()).then(function () { doc = blank(); liveStr = sig(doc); applyCss(); applyDom(true); try { V2.go("canva"); } catch (e) { } toast("✅ Orijinal dizayna qayıdıldı"); })
        .catch(function (e) { alert("Xəta: " + (e && e.message || e)); });
    },
    _doc: function () { return doc; }
  };

  /* ---------- start ---------- */
  boot();
  var tries = 0, iv = setInterval(function () { if (hookV2() || ++tries > 80) clearInterval(iv); }, 250);
})();
