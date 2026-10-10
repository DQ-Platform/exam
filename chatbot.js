/* DQ Çatbot v1 — mövzu menyusu + təklif/şikayət qutusu + admin idarəsi
   Verilənlər: dq_v2_store cədvəli, kolleksiyalar: "chatcfg" (ayarlar), "suggestions" (müraciətlər). */
(function () {
  "use strict";
  if (window.DQCHAT) return;

  var TBL = "dq_v2_store", CFG_C = "chatcfg", SUG_C = "suggestions";
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TYPES = [["Təklif", "💡"], ["Şikayət", "⚠️"], ["Sual", "❓"]];
  var DEF = {
    on: true,
    title: "DQ Köməkçi",
    welcome: "Salam! 👋 Mən DQ Platforma köməkçisiyəm. Aşağıdakı mövzulardan birini seçin və ya sualınızı yazın.",
    suggest: {
      on: true,
      title: "Təklif və şikayətlər",
      intro: "Fikriniz bizim üçün vacibdir. Təklif, şikayət və ya sualınızı yazın — idarəetmə heyəti nəzərdən keçirəcək."
    },
    topics: []
  };

  var cfg = null, cfgId = null, built = false, opened = false, greeted = false, ED = null, lastQ = "";

  /* ---------- köməkçi funksiyalar ---------- */
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function str(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function safeUrl(u) { u = String(u || "").trim(); return /^(https?:\/\/|tel:|mailto:)/i.test(u) ? u : ""; }
  function sb() { try { return typeof _supabase !== "undefined" ? _supabase : null; } catch (e) { return null; } }
  function isAdmin() { return window.__dqAuthed === true; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fdate(t) { var d = new Date(t); return isNaN(d) ? "" : pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fold(s) {
    return String(s).toLowerCase().replace(/\u0307/g, "").replace(/ə/g, "e").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/[^a-z0-9\s]/g, " ");
  }
  function fmt(t) {
    return esc(t).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function norm(d) {
    d = d || {};
    var o = clone(DEF), s = d.suggest || {};
    o.on = d.on !== false;
    o.title = str(d.title, 60) || DEF.title;
    o.welcome = str(d.welcome, 600) || DEF.welcome;
    o.suggest = { on: s.on !== false, title: str(s.title, 60) || DEF.suggest.title, intro: str(s.intro, 400) || DEF.suggest.intro };
    o.topics = (Array.isArray(d.topics) ? d.topics : []).slice(0, 30).map(function (t, i) {
      return { id: str(t.id, 24) || "t" + i, icon: str(t.icon, 4) || "💡", title: str(t.title, 80), keys: str(t.keys, 300), answer: str(t.answer, 2000), btn: str(t.btn, 40), url: safeUrl(t.url), on: t.on !== false };
    });
    return o;
  }

  async function loadCfg() {
    var c = sb();
    if (!c) return clone(DEF);
    try {
      var r = await c.from(TBL).select("id,data").eq("collection", CFG_C).order("id", { ascending: false }).limit(1);
      if (r.error) throw r.error;
      if (r.data && r.data[0]) { cfgId = r.data[0].id; return norm(r.data[0].data); }
    } catch (e) { console.warn("[çatbot] ayarlar yüklənmədi:", e); }
    return clone(DEF);
  }

  /* ---------- üslub ---------- */
  function css() {
    if ($("cb-css")) return;
    var s = document.createElement("style");
    s.id = "cb-css";
    s.textContent = [
      "#cb-fab{position:fixed;right:14px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:99991;width:58px;height:58px;border:0;border-radius:50%;cursor:pointer;color:#fff;background:linear-gradient(135deg,#0a2f7a,#2f63bd);box-shadow:0 10px 26px rgba(10,47,122,.45);display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform .25s,opacity .25s}",
      "#cb-fab:hover{transform:translateY(-2px) scale(1.05)}#cb-fab svg{width:28px;height:28px}",
      "#cb-fab .cb-dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#d9a441;border:2px solid #fff}",
      "#cb-fab:after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid rgba(47,99,189,.55);animation:cbPulse 2.4s ease-out 3}",
      "html.cb-open #cb-fab,#cb-fab[hidden]{display:none}",
      "#cb-tip{position:fixed;right:84px;bottom:calc(104px + env(safe-area-inset-bottom,0px));z-index:99991;max-width:210px;background:#fff;color:#12285e;font:600 13px/1.4 system-ui,sans-serif;padding:10px 14px;border-radius:14px 14px 4px 14px;box-shadow:0 8px 24px rgba(10,47,122,.25);cursor:pointer;animation:cbIn .4s ease both}",
      "#cb-panel{position:fixed;right:14px;bottom:14px;z-index:99992;width:380px;max-width:calc(100vw - 28px);height:min(640px,calc(100vh - 28px));height:min(640px,calc(100dvh - 28px));display:flex;flex-direction:column;background:#f3f7fd;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(10,47,122,.4);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#12285e;text-align:left;animation:cbUp .35s cubic-bezier(.2,.8,.2,1) both}",
      "#cb-panel[hidden]{display:none}",
      "#cb-panel header{display:flex;align-items:center;gap:12px;padding:14px 16px;color:#fff;background:linear-gradient(120deg,#0a2f7a,#2f63bd);border-bottom:3px solid #d9a441}",
      "#cb-panel .cb-av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex:none;font-size:20px}",
      "#cb-panel header b{display:block;font-size:16px}#cb-panel header small{opacity:.85;font-size:12px}#cb-panel header .cb-hb{margin-left:auto;display:flex;gap:6px}",
      "#cb-panel header button{border:0;background:rgba(255,255,255,.16);color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:16px}#cb-panel header button:hover{background:rgba(255,255,255,.3)}",
      "#cb-log{flex:1;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}",
      ".cb-m{max-width:86%;padding:10px 13px;border-radius:16px;word-break:break-word;animation:cbIn .3s ease both}",
      ".cb-m.bot{align-self:flex-start;background:#fff;border:1px solid #dbe5f6;border-bottom-left-radius:4px}",
      ".cb-m.me{align-self:flex-end;background:#0a2f7a;color:#fff;border-bottom-right-radius:4px}",
      ".cb-m a{color:#2f63bd}.cb-m.me a{color:#fff}",
      ".cb-link{display:inline-block;margin-top:8px;padding:8px 14px;border-radius:10px;background:#0a2f7a;color:#fff!important;text-decoration:none;font-weight:700;font-size:13px}",
      ".cb-typing i{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#94a3b8;animation:cbDot 1s infinite}.cb-typing i:nth-child(2){animation-delay:.15s}.cb-typing i:nth-child(3){animation-delay:.3s}",
      "#cb-quick{padding:6px 14px 10px;display:flex;flex-wrap:wrap;gap:8px;max-height:36%;overflow-y:auto}",
      "#cb-quick:empty{display:none}",
      "#cb-quick button{border:1.5px solid #c9d6ee;background:#fff;color:#0a2f7a;border-radius:999px;padding:8px 14px;font:600 13px inherit;font-family:inherit;cursor:pointer;transition:all .2s;text-align:left}",
      "#cb-quick button:hover{border-color:#2f63bd;background:#eaf1fc;transform:translateY(-1px)}#cb-quick button.gold{border-color:#d9a441;background:#fff8e6;color:#7a5200}",
      "#cb-in{display:flex;gap:8px;padding:10px 12px;background:#fff;border-top:1px solid #dbe5f6}",
      "#cb-in input{flex:1;min-width:0;border:1.5px solid #c9d6ee;border-radius:12px;padding:11px 14px;font-size:16px;font-family:inherit;outline:none;color:#12285e}#cb-in input:focus{border-color:#2f63bd;box-shadow:0 0 0 3px rgba(47,99,189,.15)}",
      "#cb-in button{border:0;border-radius:12px;width:46px;background:#0a2f7a;color:#fff;font-size:18px;cursor:pointer}",
      ".cb-foot{text-align:center;font-size:11px;color:#64748b;padding:0 0 8px;background:#fff}",
      ".cb-card{background:#fff;border:1px solid #dbe5f6;border-radius:16px;padding:14px;align-self:stretch;position:relative}",
      ".cb-card label{display:block;font-weight:700;font-size:12.5px;margin:10px 0 4px;color:#26365e}",
      ".cb-card textarea,.cb-card input[type=text],.cb-card input:not([type]){width:100%;box-sizing:border-box;border:1.5px solid #c9d6ee;border-radius:10px;padding:10px 12px;font-size:16px;font-family:inherit;color:#12285e;outline:none;resize:vertical}",
      ".cb-card textarea:focus,.cb-card input:focus{border-color:#2f63bd;box-shadow:0 0 0 3px rgba(47,99,189,.15)}",
      ".cb-types{display:flex;gap:6px;flex-wrap:wrap}.cb-t{margin:0!important}.cb-t input{position:absolute;opacity:0;pointer-events:none}",
      ".cb-t span{display:inline-block;padding:8px 14px;border:1.5px solid #c9d6ee;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;background:#fff}.cb-t input:checked+span{background:#0a2f7a;border-color:#0a2f7a;color:#fff}.cb-t input:focus-visible+span{outline:3px solid rgba(47,99,189,.4)}",
      ".cb-cnt{text-align:right;font-size:11px;color:#64748b;margin-top:2px}.cb-err{color:#b91c1c;font-size:13px;font-weight:600;min-height:18px;margin-top:6px}",
      ".cb-row{display:flex;gap:8px;margin-top:8px}.cb-b{flex:1;border:0;border-radius:10px;padding:11px;background:#0a2f7a;color:#fff;font:700 14px inherit;font-family:inherit;cursor:pointer}.cb-b.o{background:#eaf1fc;color:#0a2f7a}.cb-b:disabled{opacity:.6;cursor:wait}",
      ".cb-note{font-size:11.5px;color:#64748b;margin:10px 0 0}",
      "@keyframes cbUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}@keyframes cbIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes cbDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}@keyframes cbPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.6);opacity:0}}",
      "@media(max-width:560px){#cb-panel{right:0;bottom:0;left:0;width:100%;max-width:none;height:100vh;height:100dvh;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px)}#cb-panel header{padding-top:calc(14px + env(safe-area-inset-top,0px))}}",
      "@media(prefers-reduced-motion:reduce){#cb-panel,.cb-m,#cb-tip,#cb-fab:after{animation:none!important}.cb-typing i{animation:none}}",
      /* admin */
      "#cb-adm{position:fixed;inset:0;z-index:100060;background:#eef3fb;overflow-y:auto;color:#12285e;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:left}",
      "#cb-adm *{user-select:text}#cb-adm .a-bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;padding:10px 12px;background:#0a2f7a;overflow-x:auto}",
      "#cb-adm .a-bar b{color:#fff;margin-right:auto;white-space:nowrap}#cb-adm .a-bar button{border:0;border-radius:999px;padding:9px 16px;font:700 13px inherit;font-family:inherit;cursor:pointer;background:#12408f;color:#fff;white-space:nowrap}#cb-adm .a-bar button.on{background:#d9a441;color:#1b2a55}#cb-adm .a-bar button.x{background:#dc2626}",
      "#cb-adm .a-w{max-width:900px;margin:0 auto;padding:16px}#cb-adm .a-c{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 2px 10px rgba(10,47,122,.08)}#cb-adm h3{margin:0 0 10px;font-size:16px;text-align:left;color:#0a2f7a}",
      "#cb-adm label{display:block;font-weight:700;font-size:12.5px;margin:10px 0 4px}#cb-adm input[type=text],#cb-adm textarea{width:100%;box-sizing:border-box;border:1.5px solid #c9d6ee;border-radius:10px;padding:10px 12px;font-size:15px;font-family:inherit;color:#12285e;background:#fff}",
      "#cb-adm textarea{min-height:90px;resize:vertical}#cb-adm .a-g{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:620px){#cb-adm .a-g{grid-template-columns:1fr}}",
      "#cb-adm .a-ck{display:flex;align-items:center;gap:8px;font-weight:700;margin:8px 0}#cb-adm .a-ck input{width:18px;height:18px}",
      "#cb-adm .a-t{border:1.5px solid #dbe5f6;border-radius:14px;padding:12px;margin-bottom:12px;background:#fafcff}#cb-adm .a-t.off{opacity:.6}#cb-adm .a-th{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px}#cb-adm .a-th b{margin-right:auto}",
      "#cb-adm .a-btn{border:0;border-radius:10px;padding:10px 16px;font:700 13px inherit;font-family:inherit;cursor:pointer;background:#2f63bd;color:#fff}#cb-adm .a-btn.o{background:#eaf1fc;color:#0a2f7a}#cb-adm .a-btn.r{background:#fee2e2;color:#b91c1c}#cb-adm .a-btn.s{padding:6px 10px;font-size:12px}#cb-adm .a-btn.g{background:#16a34a}",
      "#cb-adm .a-ch{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}#cb-adm .a-ch button{border:1.5px solid #c9d6ee;background:#fff;color:#0a2f7a;border-radius:999px;padding:6px 14px;font:700 12.5px inherit;font-family:inherit;cursor:pointer}#cb-adm .a-ch button.on{background:#0a2f7a;color:#fff;border-color:#0a2f7a}",
      "#cb-adm .a-i{border:1px solid #dbe5f6;border-left:4px solid #2f63bd;border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fff}#cb-adm .a-i.new{border-left-color:#d9a441;background:#fffdf5}#cb-adm .a-i.Şikayət{border-left-color:#dc2626}",
      "#cb-adm .a-m{font-size:12px;color:#64748b;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}#cb-adm .a-tag{font-weight:800;padding:2px 9px;border-radius:999px;background:#eaf1fc;color:#0a2f7a;font-size:11.5px}#cb-adm .a-tx{white-space:pre-wrap;word-break:break-word;margin:6px 0 10px}",
      "#cb-adm .a-em{text-align:center;color:#94a3b8;padding:26px 0}#cb-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100070;background:#0a2f7a;color:#fff;padding:11px 20px;border-radius:999px;font:600 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)}#cb-toast.er{background:#b91c1c}",
      "#cb-bd{display:inline-block;min-width:18px;padding:0 6px;margin-left:4px;border-radius:99px;background:#dc2626;color:#fff;font-size:11px;line-height:18px}#cb-bd:empty{display:none}"
    ].join("\n");
    document.head.appendChild(s);
  }

  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><circle cx="9" cy="12" r=".9" fill="currentColor"/><circle cx="13" cy="12" r=".9" fill="currentColor"/><circle cx="17" cy="12" r=".9" fill="currentColor"/></svg>';

  /* ---------- ictimai çatbot ---------- */
  function build() {
    if (built) return;
    built = true;
    css();
    var b = document.createElement("button");
    b.id = "cb-fab"; b.type = "button"; b.setAttribute("aria-label", cfg.title); b.setAttribute("aria-haspopup", "dialog");
    b.innerHTML = ICON + '<span class="cb-dot"></span>';
    b.onclick = open;
    document.body.appendChild(b);

    var p = document.createElement("section");
    p.id = "cb-panel"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", cfg.title);
    p.innerHTML = '<header><span class="cb-av">🤖</span><div><b id="cb-title"></b><small>Adətən dərhal cavab verir</small></div>' +
      '<div class="cb-hb"><button type="button" id="cb-reset" title="Yeni söhbət" aria-label="Yeni söhbət">↻</button><button type="button" id="cb-close" title="Bağla" aria-label="Bağla">✕</button></div></header>' +
      '<div id="cb-log" aria-live="polite"></div><div id="cb-quick"></div>' +
      '<form id="cb-in" autocomplete="off"><input id="cb-q" type="text" maxlength="200" placeholder="Sualınızı yazın…" aria-label="Mesajınız"><button type="submit" aria-label="Göndər">➤</button></form>' +
      '<div class="cb-foot">DQ Platform · avtomatik köməkçi</div>';
    document.body.appendChild(p);
    $("cb-title").textContent = cfg.title;
    $("cb-close").onclick = close;
    $("cb-reset").onclick = function () { $("cb-log").innerHTML = ""; $("cb-quick").innerHTML = ""; greeted = false; greet(); };
    $("cb-in").onsubmit = function (e) { e.preventDefault(); var q = $("cb-q").value.trim(); if (!q) return; $("cb-q").value = ""; ask(q); };
    $("cb-quick").addEventListener("click", onQuick);
    $("cb-log").addEventListener("click", onLog);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && opened) close(); });

    if (!sessionStorage.getItem("dq_cb_tip")) {
      setTimeout(function () {
        if (opened || !$("cb-fab") || $("cb-fab").hidden) return;
        var t = document.createElement("div");
        t.id = "cb-tip"; t.textContent = "👋 Sualınız var? Kömək etməyə hazıram!";
        t.onclick = open; document.body.appendChild(t);
        try { sessionStorage.setItem("dq_cb_tip", "1"); } catch (e) { }
        setTimeout(function () { t.remove(); }, 7000);
      }, 8000);
    }
    setInterval(visibility, 700);
    visibility();
  }

  function visibility() {
    var f = $("cb-fab"), p = $("cb-panel");
    if (!f) return;
    var hide = !cfg.on || document.querySelector("#exam-screen.active") || document.documentElement.classList.contains("dqs-on") || $("cb-adm");
    f.hidden = !!hide;
    if (hide && p && !p.hidden) close();
    var t = $("cb-tip"); if (t && hide) t.remove();
  }

  function open() {
    if (!built) return;
    opened = true;
    var t = $("cb-tip"); t && t.remove();
    $("cb-panel").hidden = false;
    document.documentElement.classList.add("cb-open");
    var d = document.querySelector("#cb-fab .cb-dot"); d && d.remove();
    if (!greeted) greet();
    if (window.matchMedia && matchMedia("(pointer:fine)").matches) setTimeout(function () { $("cb-q").focus(); }, 80);
  }
  function close() {
    opened = false;
    var p = $("cb-panel"); p && (p.hidden = true);
    document.documentElement.classList.remove("cb-open");
    var f = $("cb-fab"); f && f.focus && !f.hidden && f.focus({ preventScroll: true });
  }

  function scroll() { var l = $("cb-log"); l && (l.scrollTop = l.scrollHeight); }
  function bubble(who, html) {
    var d = document.createElement("div");
    d.className = "cb-m " + who; d.innerHTML = html;
    $("cb-log").appendChild(d); scroll(); return d;
  }
  function say(html, delay) {
    return new Promise(function (res) {
      var d = bubble("bot", '<span class="cb-typing" aria-label="yazır"><i></i><i></i><i></i></span>');
      setTimeout(function () { d.innerHTML = html; scroll(); res(d); }, RM ? 0 : (delay == null ? 450 : delay));
    });
  }
  function chips(list) {
    var q = $("cb-quick");
    q.innerHTML = list.map(function (c) {
      return '<button type="button" data-a="' + esc(c[0]) + '"' + (c[2] ? ' class="' + c[2] + '"' : "") + ">" + esc(c[1]) + "</button>";
    }).join("");
    scroll();
  }
  function menuChips() {
    var list = cfg.topics.filter(function (t) { return t.on && t.title; }).map(function (t) { return ["t:" + t.id, t.icon + " " + t.title]; });
    if (cfg.suggest.on) list.push(["sug", "💬 " + cfg.suggest.title, "gold"]);
    chips(list);
  }
  async function greet() {
    greeted = true;
    await say(fmt(cfg.welcome), 300);
    var has = cfg.topics.some(function (t) { return t.on && t.title; });
    if (!has && !cfg.suggest.on) { await say("Hazırda əlavə mövzu yoxdur. Sualınızı yazın."); return; }
    menuChips();
  }

  function onQuick(e) {
    var b = e.target.closest("button[data-a]");
    if (!b) return;
    var a = b.getAttribute("data-a");
    if (a === "menu") { bubble("me", "⬅ Əsas menyu"); say("Başqa nə ilə kömək edə bilərəm?", 250).then(menuChips); chips([]); }
    else if (a === "sug") { bubble("me", esc(cfg.suggest.title)); chips([]); showForm(""); }
    else if (a === "ok") { bubble("me", "✅ Kömək etdi"); chips([]); say("Sevindim! 😊 Başqa sualınız olsa, buradayam.", 300).then(menuChips); }
    else if (a === "more") { bubble("me", "❓ Hələ də sualım var"); chips([]); showForm(""); }
    else if (a === "free") { bubble("me", "Mesajı göndər"); chips([]); showForm(lastQ); }
    else if (a.indexOf("t:") === 0) topic(a.slice(2));
  }
  function onLog(e) {
    if (e.target.closest("[data-act=cancel]")) {
      var c = $("cb-sf"); c && c.remove();
      say("Mesaj ləğv olundu. Başqa nə ilə kömək edə bilərəm?", 250).then(menuChips);
    }
  }

  function topic(id) {
    var t = cfg.topics.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    bubble("me", esc(t.icon + " " + t.title)); chips([]);
    var html = fmt(t.answer || "Məlumat tezliklə əlavə olunacaq.");
    if (t.btn && t.url) html += '<br><a class="cb-link" href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer">' + esc(t.btn) + " ↗</a>";
    say(html).then(function () {
      var l = [["ok", "✅ Kömək etdi"]];
      if (cfg.suggest.on) l.push(["more", "❓ Hələ də sualım var", "gold"]);
      l.push(["menu", "⬅ Əsas menyu"]);
      chips(l);
    });
  }

  function ask(q) {
    lastQ = q;
    bubble("me", esc(q)); chips([]);
    var tokens = fold(q).split(/\s+/).filter(function (w) { return w.length >= 3; });
    var best = null, score = 0;
    cfg.topics.forEach(function (t) {
      if (!t.on || !t.title) return;
      var ti = fold(t.title), hay = ti + " " + fold(t.keys), s = 0;
      tokens.forEach(function (w) {
        var k = w.slice(0, Math.min(w.length, 5));
        if (hay.indexOf(k) > -1) s += ti.indexOf(k) > -1 ? 2 : 1;
      });
      if (s > score) { score = s; best = t; }
    });
    if (best && score >= 1) {
      var html = fmt(best.answer || "Məlumat tezliklə əlavə olunacaq.");
      if (best.btn && best.url) html += '<br><a class="cb-link" href="' + esc(best.url) + '" target="_blank" rel="noopener noreferrer">' + esc(best.btn) + " ↗</a>";
      say("<b>" + esc(best.icon + " " + best.title) + "</b><br>" + html).then(function () {
        var l = [["ok", "✅ Kömək etdi"]];
        if (cfg.suggest.on) l.push(["more", "❓ Hələ də sualım var", "gold"]);
        l.push(["menu", "⬅ Əsas menyu"]);
        chips(l);
      });
    } else {
      say("Bu barədə hazır məlumat tapa bilmədim. 🙏 Aşağıdakı mövzulara baxa və ya mesajınızı idarəetmə heyətinə göndərə bilərsiniz.").then(function () {
        var l = [];
        if (cfg.suggest.on) l.push(["free", "📨 Bu mesajı göndər", "gold"]);
        l.push(["menu", "⬅ Əsas menyu"]);
        chips(l);
      });
    }
  }

  /* ---------- təklif / şikayət formu ---------- */
  function limited() {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem("dq_cb_t") || "[]"); } catch (e) { }
    var now = Date.now();
    arr = arr.filter(function (t) { return now - t < 864e5; });
    if (arr.length && now - arr[arr.length - 1] < 45000) return "Bir neçə saniyə sonra yenidən cəhd edin.";
    if (arr.length >= 5) return "Gündəlik göndərmə limiti dolub. Sabah yenidən cəhd edin.";
    return "";
  }
  function markSent() {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem("dq_cb_t") || "[]"); } catch (e) { }
    arr.push(Date.now());
    try { localStorage.setItem("dq_cb_t", JSON.stringify(arr.slice(-10))); } catch (e) { }
  }

  async function showForm(pre) {
    var old = $("cb-sf"); old && old.remove();
    await say(fmt(cfg.suggest.intro), 300);
    var nm = "";
    try { nm = (window.YQ2 && YQ2.me && YQ2.me.name) || ""; } catch (e) { }
    var d = document.createElement("form");
    d.id = "cb-sf"; d.className = "cb-card"; d.noValidate = true;
    d.innerHTML = '<div class="cb-types" role="radiogroup" aria-label="Növ">' + TYPES.map(function (t, i) {
      return '<label class="cb-t"><input type="radio" name="cbt" value="' + t[0] + '"' + (i === 0 ? " checked" : "") + "><span>" + t[1] + " " + t[0] + "</span></label>";
    }).join("") + "</div>" +
      '<label for="cb-sx">Mesajınız</label><textarea id="cb-sx" maxlength="1000" rows="4" placeholder="Fikrinizi ətraflı yazın…">' + esc(pre) + "</textarea>" +
      '<div class="cb-cnt"><span id="cb-cn">0</span>/1000</div>' +
      '<label for="cb-sn">Adınız (könüllü)</label><input id="cb-sn" type="text" maxlength="60" value="' + esc(nm) + '" autocomplete="name">' +
      '<label for="cb-sc">Əlaqə: telefon və ya e-poçt (könüllü)</label><input id="cb-sc" type="text" maxlength="80" autocomplete="email">' +
      '<input id="cb-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<div id="cb-se" class="cb-err" role="alert"></div>' +
      '<div class="cb-row"><button type="button" class="cb-b o" data-act="cancel">Ləğv et</button><button type="submit" class="cb-b" id="cb-go">Göndər</button></div>' +
      '<p class="cb-note">🔒 Mesajınız yalnız idarəetmə heyətinə görünür. Ad və əlaqə yazmaq məcburi deyil.</p>';
    $("cb-log").appendChild(d); scroll();
    var ta = $("cb-sx"), cn = $("cb-cn");
    cn.textContent = ta.value.length;
    ta.addEventListener("input", function () { cn.textContent = ta.value.length; });
    d.addEventListener("submit", submit);
    if (window.matchMedia && matchMedia("(pointer:fine)").matches) ta.focus();
  }

  async function submit(e) {
    e.preventDefault();
    var er = $("cb-se"), go = $("cb-go");
    er.textContent = "";
    if ($("cb-hp").value) { $("cb-sf").remove(); say("✅ Təşəkkür edirik!").then(menuChips); return; }
    var text = $("cb-sx").value.trim(), name = $("cb-sn").value.trim(), contact = $("cb-sc").value.trim();
    var type = (document.querySelector("#cb-sf input[name=cbt]:checked") || {}).value || "Təklif";
    if (text.length < 10) { er.textContent = "Mesaj ən azı 10 simvol olmalıdır."; return; }
    if (contact && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^\+?[0-9\s()\-]{7,20}$/.test(contact))) { er.textContent = "Əlaqə üçün düzgün telefon və ya e-poçt yazın."; return; }
    var lim = limited(); if (lim) { er.textContent = lim; return; }
    var c = sb(); if (!c) { er.textContent = "Hazırda göndərmək mümkün deyil."; return; }
    go.disabled = true; go.textContent = "Göndərilir…";
    var ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    var scr = (document.querySelector(".screen.active") || {}).id || "";
    var rec = { type: type, text: text.slice(0, 1000), name: name.slice(0, 60), contact: contact.slice(0, 80), ref: ref, ts: new Date().toISOString(), page: scr, status: "new" };
    var r;
    try { r = await c.from(TBL).insert([{ collection: SUG_C, data: rec }]); } catch (x) { r = { error: x }; }
    if (r.error) { go.disabled = false; go.textContent = "Göndər"; er.textContent = "Göndərilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin."; console.warn("[çatbot]", r.error); return; }
    markSent();
    $("cb-sf").remove();
    await say("✅ <b>Təşəkkür edirik!</b> Mesajınız qəbul olundu.<br>Müraciət nömrəsi: <b>#" + ref + "</b>", 350);
    say("Başqa nə ilə kömək edə bilərəm?", 300).then(menuChips);
  }

  /* ---------- admin idarəsi ---------- */
  function toast(t, bad) {
    var o = $("cb-toast"); o && o.remove();
    o = document.createElement("div"); o.id = "cb-toast"; if (bad) o.className = "er"; o.textContent = t;
    document.body.appendChild(o); setTimeout(function () { o.remove(); }, 2600);
  }

  async function newCount() {
    var c = sb(); if (!c) return 0;
    try {
      var r = await c.from(TBL).select("id", { count: "exact", head: true }).eq("collection", SUG_C).eq("data->>status", "new");
      return r.error ? 0 : (r.count || 0);
    } catch (e) { return 0; }
  }
  async function refreshBadge() {
    var b = $("cb-bd"); if (!b) return;
    var n = await newCount();
    b.textContent = n ? String(n) : "";
  }

  function mountAdmin() {
    if (!isAdmin() || window.__dqReady !== true) { var x = $("cb-card"); x && x.remove(); return; }
    var g = document.querySelector("#admin-panel .admin-nav-grid");
    if (!g || $("cb-card")) return;
    var d = document.createElement("div");
    d.id = "cb-card"; d.className = "admin-nav-card";
    d.innerHTML = '<span class="icon">🤖</span> Çatbot idarəsi <span id="cb-bd"></span>';
    d.onclick = openAdmin;
    g.appendChild(d);
    refreshBadge();
  }

  async function openAdmin() {
    if (!isAdmin()) return;
    css();
    var cur = await loadCfg();
    ED = clone(cur);
    var o = $("cb-adm");
    if (!o) { o = document.createElement("div"); o.id = "cb-adm"; document.body.appendChild(o); }
    document.body.style.overflow = "hidden";
    tab("set");
  }
  function closeAdmin() {
    var o = $("cb-adm"); o && o.remove();
    document.body.style.overflow = "";
    refreshBadge();
  }

  var curTab = "set", filt = "all", INBOX = [];
  function tab(t) {
    curTab = t;
    var o = $("cb-adm");
    o.innerHTML = '<div class="a-bar"><b>🤖 Çatbot idarəsi</b><button class="' + (t === "set" ? "on" : "") + '" data-t="set">⚙ Mövzular</button><button class="' + (t === "inb" ? "on" : "") + '" data-t="inb">📥 Təklif və şikayətlər</button><button class="x" data-t="x">✕ Bağla</button></div><div class="a-w" id="cb-aw"></div>';
    o.querySelector(".a-bar").onclick = function (e) {
      var b = e.target.closest("button[data-t]"); if (!b) return;
      var v = b.getAttribute("data-t");
      v === "x" ? closeAdmin() : tab(v);
    };
    t === "set" ? drawSettings() : drawInbox();
  }

  function drawSettings() {
    var w = $("cb-aw"), s = ED.suggest;
    w.innerHTML =
      '<div class="a-c"><h3>Ümumi</h3>' +
      '<label class="a-ck"><input type="checkbox" id="a-on"' + (ED.on ? " checked" : "") + '> Çatbot saytda aktivdir</label>' +
      '<label>Çatbotun adı</label><input type="text" id="a-ti" maxlength="60" value="' + esc(ED.title) + '">' +
      '<label>Salamlama mesajı</label><textarea id="a-we" maxlength="600">' + esc(ED.welcome) + "</textarea></div>" +
      '<div class="a-c"><h3>💬 Təklif və şikayət bölməsi</h3>' +
      '<label class="a-ck"><input type="checkbox" id="a-son"' + (s.on ? " checked" : "") + '> Bu bölmə aktivdir</label>' +
      '<label>Düymənin adı</label><input type="text" id="a-sti" maxlength="60" value="' + esc(s.title) + '">' +
      '<label>Giriş mətni</label><textarea id="a-sin" maxlength="400">' + esc(s.intro) + "</textarea></div>" +
      '<div class="a-c"><h3>📚 Mövzular (istifadəçi bunları seçəcək)</h3><div id="a-tl"></div>' +
      '<button class="a-btn o" id="a-add" type="button">＋ Mövzu əlavə et</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="a-btn g" id="a-save" type="button">💾 Yadda saxla</button><button class="a-btn o" id="a-prev" type="button">👁 Saytda bax</button></div>';
    drawTopics();
    w.addEventListener("input", onAdmInput);
    w.addEventListener("change", onAdmInput);
    $("a-add").onclick = function () {
      if (ED.topics.length >= 30) return toast("Maksimum 30 mövzu", true);
      ED.topics.push({ id: "t" + Date.now().toString(36), icon: "💡", title: "", keys: "", answer: "", btn: "", url: "", on: true });
      drawTopics();
      var l = document.querySelectorAll("#a-tl .a-t"); l[l.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    };
    $("a-save").onclick = saveCfg;
    $("a-prev").onclick = async function () { if (await saveCfg(true)) { closeAdmin(); toast("Yadda saxlanıldı. Aşağıda çatbotu sınaya bilərsiniz."); setTimeout(open, 300); } };
  }
  function onAdmInput(e) {
    var t = e.target, id = t.id, f = t.getAttribute("data-f"), i = t.getAttribute("data-i");
    if (f != null && i != null) { var tp = ED.topics[+i]; if (tp) { tp[f] = t.type === "checkbox" ? t.checked : t.value; if (f === "on") t.closest(".a-t").classList.toggle("off", !t.checked); } return; }
    if (id === "a-on") ED.on = t.checked;
    else if (id === "a-ti") ED.title = t.value;
    else if (id === "a-we") ED.welcome = t.value;
    else if (id === "a-son") ED.suggest.on = t.checked;
    else if (id === "a-sti") ED.suggest.title = t.value;
    else if (id === "a-sin") ED.suggest.intro = t.value;
  }
  function drawTopics() {
    var h = ED.topics.map(function (t, i) {
      return '<div class="a-t' + (t.on ? "" : " off") + '"><div class="a-th"><b>#' + (i + 1) + "</b>" +
        '<label class="a-ck" style="margin:0"><input type="checkbox" data-f="on" data-i="' + i + '"' + (t.on ? " checked" : "") + "> Aktiv</label>" +
        '<button class="a-btn o s" data-m="up" data-i="' + i + '" type="button">↑</button><button class="a-btn o s" data-m="dn" data-i="' + i + '" type="button">↓</button><button class="a-btn r s" data-m="del" data-i="' + i + '" type="button">🗑</button></div>' +
        '<div class="a-g"><div><label>Emoji</label><input type="text" maxlength="4" data-f="icon" data-i="' + i + '" value="' + esc(t.icon) + '"></div>' +
        '<div><label>Başlıq (düymədə görünən)</label><input type="text" maxlength="80" data-f="title" data-i="' + i + '" value="' + esc(t.title) + '" placeholder="məs: Sınaq barədə məlumat"></div></div>' +
        '<label>Cavab mətni</label><textarea maxlength="2000" data-f="answer" data-i="' + i + '" placeholder="İstifadəçiyə göstəriləcək məlumat">' + esc(t.answer) + "</textarea>" +
        '<label>Açar sözlər (vergüllə; yazılı sualı tapmaq üçün)</label><input type="text" maxlength="300" data-f="keys" data-i="' + i + '" value="' + esc(t.keys) + '" placeholder="sınaq, tarix, qeydiyyat">' +
        '<div class="a-g"><div><label>Düymə yazısı (könüllü)</label><input type="text" maxlength="40" data-f="btn" data-i="' + i + '" value="' + esc(t.btn) + '" placeholder="Ətraflı bax"></div>' +
        '<div><label>Keçid (https://…)</label><input type="text" maxlength="300" data-f="url" data-i="' + i + '" value="' + esc(t.url) + '" placeholder="https://"></div></div></div>';
    }).join("");
    $("a-tl").innerHTML = h || '<div class="a-em">Hələ mövzu yoxdur. «Mövzu əlavə et» düyməsi ilə başlayın.</div>';
    $("a-tl").onclick = function (e) {
      var b = e.target.closest("button[data-m]"); if (!b) return;
      var i = +b.getAttribute("data-i"), m = b.getAttribute("data-m");
      if (m === "del") { if (!confirm("Bu mövzu silinsin?")) return; ED.topics.splice(i, 1); }
      else if (m === "up" && i > 0) { var a = ED.topics[i]; ED.topics[i] = ED.topics[i - 1]; ED.topics[i - 1] = a; }
      else if (m === "dn" && i < ED.topics.length - 1) { var c = ED.topics[i]; ED.topics[i] = ED.topics[i + 1]; ED.topics[i + 1] = c; }
      drawTopics();
    };
  }

  async function saveCfg(quiet) {
    var c = sb(); if (!c) { toast("Baza əlçatan deyil", true); return false; }
    var bad = ED.topics.filter(function (t) { return !t.title.trim(); });
    if (bad.length) { toast("Başlığı boş olan mövzu var — doldurun və ya silin", true); return false; }
    var url = ED.topics.filter(function (t) { return t.url && !safeUrl(t.url); });
    if (url.length) { toast("Keçid https:// ilə başlamalıdır", true); return false; }
    var data = norm(ED), btn = $("a-save");
    btn && (btn.disabled = true);
    try {
      var r;
      if (cfgId) r = await c.from(TBL).update({ data: data }).eq("id", cfgId).select("id");
      else r = await c.from(TBL).insert([{ collection: CFG_C, data: data }]).select("id");
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error("İcazə yoxdur (admin girişini yoxlayın)");
      cfgId = r.data[0].id;
      cfg = data;
      var f = $("cb-fab"); f && f.setAttribute("aria-label", cfg.title);
      var tt = $("cb-title"); tt && (tt.textContent = cfg.title);
      if (!built && cfg.on) build();
      if (opened) { $("cb-log").innerHTML = ""; $("cb-quick").innerHTML = ""; greeted = false; greet(); }
      if (quiet !== true) toast("Yadda saxlanıldı ✅");
      return true;
    } catch (e) {
      console.warn("[çatbot]", e);
      toast("Saxlanmadı: " + (e.message || "xəta"), true);
      return false;
    } finally { btn && (btn.disabled = false); }
  }

  async function drawInbox() {
    var w = $("cb-aw");
    w.innerHTML = '<div class="a-em">Yüklənir…</div>';
    var c = sb(), rows = [];
    try {
      var r = await c.from(TBL).select("id,data").eq("collection", SUG_C).order("id", { ascending: false }).limit(300);
      if (r.error) throw r.error;
      rows = r.data || [];
    } catch (e) { w.innerHTML = '<div class="a-em">Yüklənmədi: ' + esc(e.message || "xəta") + "</div>"; return; }
    INBOX = rows;
    paintInbox();
  }
  function paintInbox() {
    var w = $("cb-aw");
    var list = INBOX.filter(function (r) {
      var d = r.data || {};
      return filt === "all" || (filt === "new" ? d.status === "new" : d.type === filt);
    });
    var nNew = INBOX.filter(function (r) { return (r.data || {}).status === "new"; }).length;
    var F = [["all", "Hamısı (" + INBOX.length + ")"], ["new", "Yeni (" + nNew + ")"], ["Təklif", "💡 Təklif"], ["Şikayət", "⚠️ Şikayət"], ["Sual", "❓ Sual"]];
    w.innerHTML = '<div class="a-ch">' + F.map(function (f) { return '<button data-f="' + f[0] + '" class="' + (filt === f[0] ? "on" : "") + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      (list.map(function (r) {
        var d = r.data || {};
        return '<div class="a-i ' + (d.status === "new" ? "new " : "") + esc(d.type) + '"><div class="a-m"><span class="a-tag">' + esc(d.type || "—") + "</span><span>#" + esc(d.ref || r.id) + "</span><span>" + esc(fdate(d.ts)) + "</span>" +
          (d.name ? "<span>👤 " + esc(d.name) + "</span>" : "") + (d.contact ? "<span>📞 " + esc(d.contact) + "</span>" : "") +
          (d.status === "new" ? '<span class="a-tag" style="background:#fef3c7;color:#92400e">YENİ</span>' : "") + "</div>" +
          '<div class="a-tx">' + esc(d.text) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<button class="a-btn o s" data-a="st" data-id="' + r.id + '">' + (d.status === "new" ? "✔ Oxundu" : "↺ Yenidən yeni") + "</button>" +
          '<button class="a-btn o s" data-a="cp" data-id="' + r.id + '">📋 Kopyala</button>' +
          '<button class="a-btn r s" data-a="rm" data-id="' + r.id + '">🗑 Sil</button></div></div>';
      }).join("") || '<div class="a-em">Bu bölmədə müraciət yoxdur.</div>');
    w.onclick = onInbox;
  }
  async function onInbox(e) {
    var f = e.target.closest("button[data-f]");
    if (f) { filt = f.getAttribute("data-f"); paintInbox(); return; }
    var b = e.target.closest("button[data-a]"); if (!b) return;
    var id = +b.getAttribute("data-id"), a = b.getAttribute("data-a");
    var row = INBOX.filter(function (r) { return r.id === id; })[0]; if (!row) return;
    var c = sb();
    if (a === "cp") {
      var d = row.data || {};
      var t = "[" + d.type + "] #" + d.ref + " · " + fdate(d.ts) + "\n" + d.text + (d.name ? "\nAd: " + d.name : "") + (d.contact ? "\nƏlaqə: " + d.contact : "");
      try { await navigator.clipboard.writeText(t); toast("Kopyalandı"); } catch (x) { toast("Kopyalanmadı", true); }
    } else if (a === "st") {
      var nd = Object.assign({}, row.data, { status: row.data.status === "new" ? "read" : "new" });
      var r = await c.from(TBL).update({ data: nd }).eq("id", id).select("id");
      if (r.error || !r.data || !r.data.length) return toast("Dəyişmədi (icazəni yoxlayın)", true);
      row.data = nd; paintInbox();
    } else if (a === "rm") {
      if (!confirm("Bu müraciət həmişəlik silinsin?")) return;
      var r2 = await c.from(TBL).delete().eq("id", id).select("id");
      if (r2.error || !r2.data || !r2.data.length) return toast("Silinmədi (icazəni yoxlayın)", true);
      INBOX = INBOX.filter(function (x) { return x.id !== id; }); paintInbox();
    }
  }

  /* ---------- işə salma: bütün səhifə yüklənəndən sonra ---------- */
  async function start() {
    css();
    cfg = await loadCfg();
    if (cfg.on) build();
    setInterval(mountAdmin, 1200);
    setInterval(function () { isAdmin() && $("cb-bd") && refreshBadge(); }, 60000);
    mountAdmin();
  }
  (function wait() {
    var t0 = Date.now();
    (function poll() {
      if (window.__dqReady === true || Date.now() - t0 > 14000) { start(); return; }
      setTimeout(poll, 250);
    })();
  })();

  window.DQCHAT = { open: open, close: close, openAdmin: openAdmin };
})();
