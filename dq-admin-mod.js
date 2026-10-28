/* =====================================================================
   DQ Admin Mod — dq-admin-mod.js?v=1
   Mərkəzi Admin Paneldəki bütün modulları SİYAHI kimi göstərir və gizlətməyə imkan verir.
     • Paneldəki «🛠 Admin mod» düyməsi → tam ekran modul meneceri
     • Hər modul üçün açar (göstər / gizlət), qruplar üzrə düzülüş
     • «Hamısını yığ» / «Hamısını aç» (qrup siyahıları), axtarış, «Hamısını göstər»
     • «👁 Gizlədilmiş modullar (N)» — toxunanda göstərir, 2-ci dəfə toxunanda gizlədir
     • Hər hansı modulun ÜSTÜNDƏ BASILI TUTSAN → «🙈 Gizlət» menyusu çıxır (4 san «Geri al»)
     • Seçim brauzerdə saxlanılır (localStorage: dqx_hidden_mods)
   Qoşulma: index.html-in sonunda, dq-admin-fix.js-dən SONRA.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqAdminMod) return;
  window.__dqAdminMod = 1;

  var D = document, KEY = "dqx_hidden_mods", UI = "dqx_mod_ui", busy = false, timer = null, obs = null, ui = { shut: {}, hidOpen: false, q: "" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s == null ? "" : s).toLocaleLowerCase("az").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim(); }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function hidden() { try { var a = JSON.parse(lget(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveHidden(a) { lset(KEY, JSON.stringify(a)); }
  try { var u = JSON.parse(lget(UI) || "{}"); if (u && typeof u === "object") { ui.shut = u.shut || {}; ui.hidOpen = !!u.hidOpen; } } catch (e) { }
  function saveUi() { lset(UI, JSON.stringify({ shut: ui.shut, hidOpen: ui.hidOpen })); }

  /* ---------- modul məlumatı ---------- */
  function cardInfo(c) {
    var cl = c.cloneNode(true);
    [].forEach.call(cl.querySelectorAll(".dqcnt,.icon,small,.dqm-x"), function (e) { e.remove(); });
    var name = (cl.textContent || "").replace(/\s+/g, " ").trim();
    var ic = c.querySelector(".icon"), icon = ic ? (ic.textContent || "").trim() : "";
    return { name: name, icon: icon || "▫️", key: norm(name) };
  }
  function allGroups() {
    var root = D.querySelector("#admin-panel .dqap-root");
    if (!root) return [];
    var out = [];
    [].forEach.call(root.querySelectorAll(":scope>.dqap-g"), function (g) {
      var t = g.querySelector(".dqap-tt b"), ic = g.querySelector(".dqap-i");
      var grp = { el: g, name: t ? t.textContent : "", icon: ic ? ic.textContent : "📁", color: getComputedStyle(g).getPropertyValue("--ag") || "#1e3a8a", mods: [] };
      [].forEach.call(g.querySelectorAll(".dqap-c .admin-nav-card"), function (c) {
        if (c.getAttribute("data-dqap-dup")) return;
        var i = cardInfo(c); i.el = c; grp.mods.push(i);
      });
      out.push(grp);
    });
    return out;
  }

  /* ---------- üslub ---------- */
  function css() {
    if (D.getElementById("dqm-css")) return;
    var s = D.createElement("style"); s.id = "dqm-css";
    s.textContent = [
      ".dqm-off{display:none!important}.dqap-g.dqm-empty{display:none!important}",
      ".dqm-btn{background:linear-gradient(135deg,#0a2f7a,#2f63bd)!important;color:#fff!important;border-color:#0a2f7a!important}",
      ".dqm-hid{margin:6px 0 14px;border:1.5px dashed #c9d6ee;border-radius:16px;background:#f8fafc;overflow:hidden}",
      ".dqm-hh{display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;user-select:none;font:800 14px system-ui,sans-serif;color:#475569}",
      ".dqm-hh b{flex:1;text-align:left;font-weight:800}.dqm-hh .n{min-width:24px;padding:2px 9px;border-radius:999px;background:#64748b;color:#fff;font-size:11.5px;text-align:center}.dqm-hh i{font-style:normal;font-size:10px;color:#94a3b8;transition:transform .25s}",
      ".dqm-hid.on .dqm-hh i{transform:rotate(180deg)}.dqm-hb{display:none;padding:2px 14px 14px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.dqm-hid.on .dqm-hb{display:grid}",
      ".dqm-chip{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #dbe3f1;border-radius:12px;background:#fff;font:700 12.5px system-ui,sans-serif;color:#1e293b;cursor:pointer;text-align:left;font-family:inherit}",
      ".dqm-chip span.i{flex:none;font-size:17px}.dqm-chip span.t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dqm-chip em{flex:none;font-style:normal;font-size:11px;color:#0a2f7a;background:#eaf1fc;border-radius:8px;padding:3px 7px}",
      /* menecer */
      "#dqm-ov{position:fixed;inset:0;z-index:2147483000;background:#0b1220b3;display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;animation:dqmIn .25s ease both}",
      "@media(min-width:720px){#dqm-ov{align-items:center;padding:20px}}",
      "#dqm-sh{background:#f4f7fc;width:100%;max-width:760px;height:94vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 50px #0008;color:#0f172a;text-align:left}",
      "@media(min-width:720px){#dqm-sh{height:88vh;border-radius:20px}}",
      "#dqm-sh .top{flex:none;display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 16px 12px;background:linear-gradient(90deg,#0a2f7a,#2f63bd);color:#fff}",
      "#dqm-sh .top h3{margin:0;flex:1;font-size:17px;color:#fff;text-align:left}#dqm-sh .top button{width:36px;height:36px;border-radius:50%;border:0;background:#ffffff2e;color:#fff;font-size:16px;cursor:pointer}",
      "#dqm-sh .tools{flex:none;padding:12px 14px 8px;background:#fff;border-bottom:1px solid #e3e9f4}",
      "#dqm-sh .tools input{width:100%;box-sizing:border-box;padding:11px 13px;border:1.5px solid #dbe3f1;border-radius:12px;font-size:14px;background:#f8fafc;outline:none;font-family:inherit}#dqm-sh .tools input:focus{border-color:#2f63bd;box-shadow:0 0 0 4px #2f63bd22;background:#fff}",
      "#dqm-sh .tr{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;align-items:center}",
      "#dqm-sh .b{border:1.5px solid #dbe3f1;background:#fff;color:#334155;border-radius:11px;padding:8px 12px;font:700 12.5px inherit;font-family:inherit;cursor:pointer}#dqm-sh .b:active{transform:scale(.97)}#dqm-sh .b.p{background:#0a2f7a;border-color:#0a2f7a;color:#fff}",
      "#dqm-sh .st{margin-left:auto;font:700 12px system-ui,sans-serif;color:#64748b}",
      "#dqm-sh .bd{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 30px}",
      ".dqm-g{margin:0 0 12px;background:#fff;border:1px solid #e3e9f4;border-radius:14px;overflow:hidden}",
      ".dqm-gh{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;user-select:none;position:relative;background:color-mix(in srgb,var(--c) 6%,#fff)}",
      ".dqm-gh:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c)}",
      ".dqm-gh .gi{flex:none;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:color-mix(in srgb,var(--c) 14%,#fff)}",
      ".dqm-gh b{flex:1;min-width:0;font-size:14px;color:var(--c);text-align:left}.dqm-gh .n{padding:2px 9px;border-radius:999px;background:var(--c);color:#fff;font-size:11.5px;font-weight:800}.dqm-gh i{font-style:normal;font-size:10px;color:#94a3b8;transition:transform .25s}",
      ".dqm-g.shut .dqm-gh i{transform:rotate(-90deg)}.dqm-g.shut .dqm-gl{display:none}",
      ".dqm-r{display:flex;align-items:center;gap:11px;padding:10px 13px;border-top:1px solid #eef2f9}",
      ".dqm-r .ri{flex:none;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:#f1f5fb}",
      ".dqm-r .rn{flex:1;min-width:0;font:700 14px system-ui,sans-serif;color:#1e293b;overflow-wrap:anywhere;text-align:left}",
      ".dqm-r.off .rn{color:#94a3b8;text-decoration:line-through}.dqm-r.off .ri{opacity:.5}",
      ".dqm-sw{flex:none;position:relative;width:46px;height:27px;border-radius:999px;border:0;background:#cbd5e1;cursor:pointer;transition:background .2s;padding:0}",
      ".dqm-sw:after{content:'';position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;box-shadow:0 2px 5px #0004;transition:transform .2s}",
      ".dqm-sw.on{background:#16a34a}.dqm-sw.on:after{transform:translateX(19px)}",
      ".dqm-hs{margin-top:4px;border:1.5px dashed #c9d6ee;border-radius:14px;background:#fff;overflow:hidden}",
      ".dqm-hs .hh{display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer;user-select:none;font:800 14px system-ui,sans-serif;color:#475569}.dqm-hs .hh b{flex:1;text-align:left}",
      ".dqm-hs .hh .n{min-width:24px;padding:2px 9px;border-radius:999px;background:#64748b;color:#fff;font-size:11.5px;text-align:center}.dqm-hs .hh i{font-style:normal;font-size:10px;color:#94a3b8;transition:transform .25s}",
      ".dqm-hs.on .hh i{transform:rotate(180deg)}.dqm-hs .hl{display:none}.dqm-hs.on .hl{display:block}",
      ".dqm-em{padding:18px;text-align:center;color:#94a3b8;font:600 13px system-ui,sans-serif}",
      ".dqap-c .admin-nav-card{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}",
      ".dqm-pop{position:fixed;z-index:2147483200;min-width:190px;max-width:260px;background:#fff;border-radius:16px;box-shadow:0 14px 40px #0006,0 0 0 1px #e3e9f4;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;animation:dqmIn .15s ease both;text-align:left}",
      ".dqm-pop .pt{padding:10px 14px 8px;font:700 12px system-ui,sans-serif;color:#64748b;border-bottom:1px solid #eef2f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dqm-pop button{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border:0;background:#fff;font:800 14px system-ui,sans-serif;color:#0f172a;cursor:pointer;text-align:left;font-family:inherit}.dqm-pop button:active{background:#f1f5fb}.dqm-pop button.d{color:#b91c1c}",
      ".dqm-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483300;display:flex;align-items:center;gap:12px;background:#0f172a;color:#fff;border-radius:14px;padding:11px 14px;font:600 13px system-ui,sans-serif;box-shadow:0 10px 30px #0006;max-width:92vw}.dqm-toast button{border:0;background:#facc15;color:#0f172a;border-radius:9px;padding:6px 11px;font:800 12.5px inherit;font-family:inherit;cursor:pointer}",
      "@keyframes dqmIn{from{opacity:0}to{opacity:1}}@media(prefers-reduced-motion:reduce){#dqm-ov{animation:none}}"
    ].join("\n");
    D.head.appendChild(s);
  }

  /* ---------- paneldə tətbiq ---------- */
  function apply() {
    var root = D.querySelector("#admin-panel .dqap-root");
    if (!root) return;
    busy = true;
    try {
      css();
      var H = hidden(), hiddenMods = [];
      [].forEach.call(root.querySelectorAll(":scope>.dqap-g"), function (g) {
        var vis = 0;
        [].forEach.call(g.querySelectorAll(".dqap-c .admin-nav-card"), function (c) {
          if (c.getAttribute("data-dqap-dup")) return;
          var i = cardInfo(c), off = H.indexOf(i.key) > -1;
          c.classList.toggle("dqm-off", off);
          if (off) { i.el = c; hiddenMods.push(i); } else vis++;
        });
        var n = g.querySelector(".dqap-n"); if (n && n.textContent !== String(vis)) n.textContent = vis;
        g.classList.toggle("dqm-empty", vis === 0);
      });
      var bar = root.querySelector(".dqap-bar");
      if (bar && !bar.querySelector(".dqm-btn")) {
        var b = D.createElement("button"); b.type = "button"; b.className = "dqap-tog dqm-btn"; b.setAttribute("data-dqm", "open"); b.textContent = "🛠 Admin mod";
        bar.appendChild(b);
      }
      var box = root.querySelector(":scope>.dqm-hid");
      if (!hiddenMods.length) { if (box) box.remove(); }
      else {
        if (!box) { box = D.createElement("section"); box.className = "dqm-hid"; root.appendChild(box); }
        var was = box.classList.contains("on");
        box.innerHTML = '<div class="dqm-hh" role="button" tabindex="0" data-dqm="hid"><span>👁</span><b>Gizlədilmiş modullar</b><span class="n">' + hiddenMods.length + '</span><i>▼</i></div><div class="dqm-hb">' +
          hiddenMods.map(function (m, k) { return '<button type="button" class="dqm-chip" data-dqm="go" data-k="' + k + '"><span class="i">' + esc(m.icon) + '</span><span class="t">' + esc(m.name) + '</span><em data-dqm="un" data-k="' + k + '">↩</em></button>'; }).join("") + '</div>';
        box.classList.toggle("on", was || ui.hidOpen && false);
        box._mods = hiddenMods;
      }
    } finally { busy = false; }
  }

  /* ---------- menecer ---------- */
  function openMgr() {
    var old = D.getElementById("dqm-ov"); if (old) old.remove();
    css();
    var o = D.createElement("div"); o.id = "dqm-ov";
    o.innerHTML = '<div id="dqm-sh" role="dialog" aria-modal="true" aria-label="Admin mod"><div class="top"><h3>🛠 Admin mod — modullar</h3><button type="button" data-m="x" aria-label="Bağla">✕</button></div>' +
      '<div class="tools"><input type="search" id="dqm-q" placeholder="🔎 Modul axtar…" aria-label="Modul axtar"><div class="tr"><button type="button" class="b" data-m="shut">▲ Hamısını yığ</button><button type="button" class="b" data-m="open">▼ Hamısını aç</button><button type="button" class="b p" data-m="showall">👁 Hamısını göstər</button><span class="st" id="dqm-st"></span></div></div><div class="bd" id="dqm-bd"></div></div>';
    D.body.appendChild(o);
    D.body.style.overflow = "hidden";
    ui.q = "";
    drawMgr();
    o.addEventListener("click", function (e) {
      if (e.target === o) return closeMgr();
      var t = e.target.closest("[data-m]"); if (!t) return;
      var a = t.getAttribute("data-m");
      if (a === "x") return closeMgr();
      if (a === "shut" || a === "open") { allGroups().forEach(function (g, i) { ui.shut["g" + i] = a === "shut"; }); saveUi(); return drawMgr(); }
      if (a === "showall") { saveHidden([]); apply(); return drawMgr(); }
      if (a === "g") { var gi = t.getAttribute("data-i"); ui.shut["g" + gi] = !ui.shut["g" + gi]; saveUi(); return drawMgr(); }
      if (a === "hid") { ui.hidOpen = !ui.hidOpen; saveUi(); return drawMgr(); }
      if (a === "sw") {
        var k = t.getAttribute("data-k"), H = hidden(), p = H.indexOf(k);
        if (p > -1) H.splice(p, 1); else H.push(k);
        saveHidden(H); apply(); drawMgr();
      }
    });
    o.querySelector("#dqm-q").addEventListener("input", function () { ui.q = this.value; drawMgr(true); });
  }
  function closeMgr() { var o = D.getElementById("dqm-ov"); if (o) o.remove(); D.body.style.overflow = ""; }
  function drawMgr(keepFocus) {
    var bd = D.getElementById("dqm-bd"); if (!bd) return;
    var sc = bd.scrollTop, H = hidden(), q = norm(ui.q), groups = allGroups(), total = 0, hid = [], h = "";
    groups.forEach(function (g, gi) {
      var vis = g.mods.filter(function (m) { return H.indexOf(m.key) === -1; });
      g.mods.forEach(function (m) { total++; if (H.indexOf(m.key) > -1) hid.push({ m: m, g: g }); });
      var rows = vis.filter(function (m) { return !q || m.key.indexOf(q) > -1; });
      if (!rows.length) return;
      var shut = !q && ui.shut["g" + gi];
      h += '<section class="dqm-g' + (shut ? " shut" : "") + '" style="--c:' + esc(g.color.trim() || "#1e3a8a") + '"><div class="dqm-gh" role="button" tabindex="0" data-m="g" data-i="' + gi + '"><span class="gi">' + esc(g.icon) + '</span><b>' + esc(g.name) + '</b><span class="n">' + vis.length + '</span><i>▼</i></div><div class="dqm-gl">' +
        rows.map(function (m) { return '<div class="dqm-r"><span class="ri">' + esc(m.icon) + '</span><span class="rn">' + esc(m.name) + '</span><button type="button" class="dqm-sw on" data-m="sw" data-k="' + esc(m.key) + '" role="switch" aria-checked="true" aria-label="' + esc(m.name) + ' — gizlət"></button></div>'; }).join("") + '</div></section>';
    });
    if (!h) h = '<div class="dqm-em">' + (q ? "Heç nə tapılmadı" : "Göstərilən modul yoxdur") + '</div>';
    var hf = hid.filter(function (x) { return !q || x.m.key.indexOf(q) > -1; });
    h += '<section class="dqm-hs' + (ui.hidOpen ? " on" : "") + '"><div class="hh" role="button" tabindex="0" data-m="hid"><span>👁</span><b>Gizlədilmiş modullar</b><span class="n">' + hid.length + '</span><i>▼</i></div><div class="hl">' +
      (hf.length ? hf.map(function (x) { return '<div class="dqm-r off"><span class="ri">' + esc(x.m.icon) + '</span><span class="rn">' + esc(x.m.name) + '<small style="display:block;text-decoration:none;color:#94a3b8;font-weight:600;font-size:11.5px">' + esc(x.g.name) + '</small></span><button type="button" class="dqm-sw" data-m="sw" data-k="' + esc(x.m.key) + '" role="switch" aria-checked="false" aria-label="' + esc(x.m.name) + ' — göstər"></button></div>'; }).join("") : '<div class="dqm-em">Gizlədilmiş modul yoxdur</div>') + '</div></section>';
    bd.innerHTML = h;
    var st = D.getElementById("dqm-st"); if (st) st.textContent = (total - hid.length) + " göstərilir · " + hid.length + " gizli";
    bd.scrollTop = sc;
  }

  /* ---------- panel kliklər ---------- */
  D.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-dqm]") : null;
    if (!t) return;
    var a = t.getAttribute("data-dqm"), box = t.closest(".dqm-hid");
    if (a === "open") { e.preventDefault(); return openMgr(); }
    if (!box) return;
    if (a === "hid") { box.classList.toggle("on"); return; }
    var mods = box._mods || [], m = mods[+t.getAttribute("data-k")];
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    if (a === "un") { var H = hidden(), p = H.indexOf(m.key); if (p > -1) H.splice(p, 1); saveHidden(H); apply(); return; }
    if (a === "go") { try { m.el.click(); } catch (x) { } }
  }, true);

  /* ---------- uzun basma → «Gizlət» menyusu ---------- */
  var lpT = null, lpX = 0, lpY = 0, lpDone = 0;
  function closePop() { var o = D.querySelector(".dqm-pop"); if (o) o.remove(); }
  function toast(msg, undo) {
    var o = D.querySelector(".dqm-toast"); if (o) o.remove();
    o = D.createElement("div"); o.className = "dqm-toast"; o.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button type="button">Geri al</button>' : "");
    D.body.appendChild(o);
    var tm = setTimeout(function () { o.remove(); }, 4500);
    if (undo) o.querySelector("button").onclick = function () { clearTimeout(tm); o.remove(); undo(); };
  }
  function showPop(card, x, y) {
    closePop(); css();
    var info = cardInfo(card), o = D.createElement("div");
    o.className = "dqm-pop";
    o.innerHTML = '<div class="pt">' + esc(info.icon + " " + info.name) + '</div><button type="button" class="d" data-p="hide">🙈 Gizlət</button><button type="button" data-p="x">✕ Ləğv et</button>';
    D.body.appendChild(o);
    var w = o.offsetWidth, h = o.offsetHeight;
    o.style.left = Math.max(8, Math.min(x - w / 2, innerWidth - w - 8)) + "px";
    o.style.top = Math.max(8, Math.min(y + 10, innerHeight - h - 8)) + "px";
    o.addEventListener("click", function (e) {
      var b = e.target.closest("[data-p]"); if (!b) return;
      e.stopPropagation();
      closePop();
      if (b.getAttribute("data-p") === "hide") {
        var H = hidden(); if (H.indexOf(info.key) === -1) H.push(info.key);
        saveHidden(H); apply();
        toast("«" + info.name + "» gizlədildi", function () { var G = hidden(), p = G.indexOf(info.key); if (p > -1) G.splice(p, 1); saveHidden(G); apply(); });
      }
    });
    lpDone = Date.now();
  }
  function cardOf(t) { var c = t && t.closest ? t.closest("#admin-panel .dqap-root .dqap-c .admin-nav-card") : null; return c && !c.closest(".dqm-hid") ? c : null; }
  D.addEventListener("pointerdown", function (e) {
    if (e.target.closest && e.target.closest(".dqm-pop")) return;
    closePop();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var c = cardOf(e.target); if (!c) return;
    lpX = e.clientX; lpY = e.clientY; clearTimeout(lpT);
    lpT = setTimeout(function () { showPop(c, lpX, lpY); if (navigator.vibrate) try { navigator.vibrate(18); } catch (x) { } }, 520);
  }, true);
  D.addEventListener("pointermove", function (e) { if (lpT && (Math.abs(e.clientX - lpX) > 10 || Math.abs(e.clientY - lpY) > 10)) { clearTimeout(lpT); lpT = null; } }, true);
  ["pointerup", "pointercancel", "scroll"].forEach(function (n) { D.addEventListener(n, function () { clearTimeout(lpT); lpT = null; }, true); });
  D.addEventListener("contextmenu", function (e) { var c = cardOf(e.target); if (!c) return; e.preventDefault(); clearTimeout(lpT); lpT = null; if (!D.querySelector(".dqm-pop")) showPop(c, e.clientX, e.clientY); }, true);
  D.addEventListener("click", function (e) {
    if (Date.now() - lpDone < 700 && cardOf(e.target)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);
  D.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });

  function sched() {
    if (busy) return;
    clearTimeout(timer);
    timer = setTimeout(function () { try { watch(); apply(); } catch (e) { } }, 140);
  }
  function watch() {
    var g = D.querySelector("#admin-panel .admin-nav-grid");
    if (!g) return;
    if (obs && obs._g === g) return;
    if (obs) obs.disconnect();
    obs = new MutationObserver(function (ml) {
      if (busy) return;
      for (var i = 0; i < ml.length; i++) {
        var n = ml[i].target;
        if (n.nodeType === 1 && n.closest && n.closest(".dqm-hid")) continue;
        if (ml[i].type === "attributes" && ml[i].attributeName === "class") continue;
        return sched();
      }
    });
    obs.observe(g, { childList: true, subtree: true });
    obs._g = g;
  }
  function init() { watch(); apply(); setTimeout(function () { watch(); apply(); }, 900); setTimeout(function () { watch(); apply(); }, 2800); setInterval(function () { if (!busy) { watch(); var r = D.querySelector("#admin-panel .dqap-root"); if (r && !r.querySelector(".dqm-btn")) apply(); } }, 1500); }
  if (D.readyState === "complete") init(); else window.addEventListener("load", init);
  window.DQAdminMod = { open: openMgr, hidden: hidden, apply: apply };
})();
