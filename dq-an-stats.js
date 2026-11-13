/* «Nəticəni təhlil et, gələcəyini planla» bölməsi — premium statistika paneli.
   - Köhnə bölməni bir dəfə tapıb gizlədir, yerinə TƏK nüsxə qoyur (dublikat yaranmır).
   - Rəqəmləri dəyişmək üçün: window.DQ_AN_DATA = {total, correct, wrong, empty, subjects:[{n,p}]} */
(function () {
  "use strict";
  if (window.__dqAnStats) return;
  window.__dqAnStats = 1;

  var DEF = {
    total: 85, correct: 34, wrong: 6, empty: 0,
    subjects: [
      { n: "Azərbaycan dili", p: 92 },
      { n: "İnformatika", p: 85 },
      { n: "Qanunvericilik", p: 78 },
      { n: "Məntiq", p: 70 }
    ]
  };
  function data() {
    var d = window.DQ_AN_DATA || {}, o = {};
    for (var k in DEF) o[k] = d[k] != null ? d[k] : DEF[k];
    return o;
  }
  function pct(v) { v = +v; return isNaN(v) ? 0 : Math.max(0, Math.min(100, Math.round(v))); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var CSS = [
    "#dq-an,#dq-an *{box-sizing:border-box}",
    "#dq-an{position:relative;margin:28px auto;max-width:1180px;border-radius:24px;overflow:hidden;color:#e9eefb;font-family:inherit;",
    "border:1px solid rgba(201,162,75,.34);background:radial-gradient(800px 360px at 100% 0%,rgba(243,217,139,.10),transparent 60%),",
    "radial-gradient(700px 400px at 0% 100%,rgba(59,110,230,.26),transparent 60%),linear-gradient(135deg,#0c2150 0%,#0a1a42 55%,#08143a 100%);",
    "box-shadow:0 24px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.07)}",
    "#dq-an:before{content:'';position:absolute;left:0;top:28px;bottom:28px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,#f3d98b,#c9a24b)}",
    "#dq-an .an-in{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);gap:32px;padding:40px 36px 40px 44px;align-items:center}",
    "#dq-an .an-k{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f3d98b;margin-bottom:14px}",
    "#dq-an .an-k i{width:26px;height:2px;background:linear-gradient(90deg,#f3d98b,transparent)}",
    "#dq-an h2{margin:0 0 12px;font-size:clamp(24px,3vw,34px);line-height:1.15;font-weight:800;color:#fff;letter-spacing:-.3px;text-align:left}",
    "#dq-an h2 em{font-style:normal;background:linear-gradient(180deg,#f7e3a1,#c9a24b);-webkit-background-clip:text;background-clip:text;color:transparent}",
    "#dq-an .an-p{margin:0;color:#a9b8dc;font-size:15px;line-height:1.65;max-width:380px;text-align:left}",
    "#dq-an .an-g{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:stretch}",
    "#dq-an .an-card{position:relative;border-radius:20px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.025));",
    "border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(4px);min-width:0}",
    "#dq-an .an-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px}",
    "#dq-an .an-hd b{font-size:13px;letter-spacing:.4px;color:#dbe4fa;font-weight:700}",
    "#dq-an .an-chip{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#f3d98b;padding:3px 9px;border-radius:99px;border:1px solid rgba(243,217,139,.35);background:rgba(243,217,139,.08)}",
    "#dq-an .an-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:14px}",
    "#dq-an .an-dn{position:relative;width:104px;height:104px}",
    "#dq-an .an-dn svg{width:100%;height:100%;transform:rotate(-90deg);display:block}",
    "#dq-an .an-dn .tr{fill:none;stroke:rgba(255,255,255,.1);stroke-width:9}",
    "#dq-an .an-dn .pg{fill:none;stroke:url(#dqAnGr);stroke-width:9;stroke-linecap:round;stroke-dasharray:276.46;stroke-dashoffset:276.46;transition:stroke-dashoffset 1.2s cubic-bezier(.22,.8,.22,1)}",
    "#dq-an .an-dn span{position:absolute;inset:0;display:grid;place-items:center;font-size:24px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}",
    "#dq-an .an-dl{display:block;margin-top:6px;text-align:center;font-size:12px;color:#a9b8dc}",
    "#dq-an .an-st{list-style:none;margin:0;padding:0;display:grid;gap:0}",
    "#dq-an .an-st li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px;color:#cfd9f3}",
    "#dq-an .an-st li:last-child{border-bottom:0}",
    "#dq-an .an-st li span{display:inline-flex;align-items:center;gap:9px}",
    "#dq-an .an-st li span:before{content:'';width:8px;height:8px;border-radius:50%;background:var(--c)}",
    "#dq-an .an-st li b{font-size:16px;color:#fff;font-variant-numeric:tabular-nums}",
    "#dq-an .an-sb{display:grid;gap:12px}",
    "#dq-an .an-sr .t{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;color:#dbe4fa;margin-bottom:6px}",
    "#dq-an .an-sr .t b{color:#f3d98b;font-variant-numeric:tabular-nums}",
    "#dq-an .an-bar{height:9px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}",
    "#dq-an .an-bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#3b6ee6,#2dd4bf);transition:width 1.1s cubic-bezier(.22,.8,.22,1)}",
    "#dq-an .an-img{display:flex;flex-direction:column;justify-content:space-between;padding:20px;overflow:hidden;min-height:260px;",
    "background:radial-gradient(300px 220px at 80% 90%,rgba(59,110,230,.35),transparent 70%),linear-gradient(160deg,#0f2a63,#091a45)}",
    "#dq-an .an-img h3{margin:0;position:relative;z-index:1;font-size:19px;line-height:1.3;font-weight:800;color:#fff;text-align:left;max-width:200px}",
    "#dq-an .an-img h3 em{font-style:normal;color:#f3d98b}",
    "#dq-an .an-img svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:78%;display:block}",
    "#dq-an.on .pg{stroke-dashoffset:var(--off)}",
    "@media(max-width:980px){#dq-an .an-in{grid-template-columns:1fr;gap:24px;padding:30px 20px 24px 26px}#dq-an .an-p{max-width:none}}",
    "@media(max-width:620px){#dq-an{margin:20px 12px;border-radius:20px}#dq-an .an-g{grid-template-columns:1fr}#dq-an .an-img{min-height:220px}#dq-an .an-top{gap:14px}#dq-an .an-dn{width:92px;height:92px}}",
    "@media(prefers-reduced-motion:reduce){#dq-an .pg,#dq-an .an-bar i{transition:none}}"
  ].join("");

  function html() {
    var d = data(), tot = pct(d.total), off = (276.46 * (1 - tot / 100)).toFixed(2);
    var rows = (d.subjects || []).map(function (s) {
      var p = pct(s.p);
      return '<div class="an-sr"><div class="t"><span>' + esc(s.n) + '</span><b>' + p + '%</b></div>' +
        '<div class="an-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p + '" aria-label="' + esc(s.n) + '"><i data-w="' + p + '"></i></div></div>';
    }).join("");
    return '<div class="an-in"><div>' +
      '<div class="an-k"><i></i>Analiz və inkişaf</div>' +
      '<h2>Nəticəni <em>təhlil et</em>,<br>gələcəyini planla</h2>' +
      '<p class="an-p">Hər sınaqdan sonra detallı nəticə analizi, zəif mövzuların müəyyənləşdirilməsi və fərdi inkişaf planı ilə hazırlığını daha səmərəli qur.</p></div>' +
      '<div class="an-g">' +
      '<div class="an-card"><div class="an-hd"><b>Nəticə analizi</b><span class="an-chip">Nümunə</span></div>' +
      '<div class="an-top"><div><div class="an-dn" role="img" aria-label="Ümumi nəticə ' + tot + ' faiz">' +
      '<svg viewBox="0 0 100 100"><defs><linearGradient id="dqAnGr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs>' +
      '<circle class="tr" cx="50" cy="50" r="44"/><circle class="pg" cx="50" cy="50" r="44" style="--off:' + off + '"/></svg><span>' + tot + '%</span></div>' +
      '<small class="an-dl">Ümumi nəticə</small></div>' +
      '<ul class="an-st"><li><span style="--c:#2dd4bf">Düzgün cavablar</span><b>' + esc(d.correct) + '</b></li>' +
      '<li><span style="--c:#f87171">Səhv cavablar</span><b>' + esc(d.wrong) + '</b></li>' +
      '<li><span style="--c:#94a3b8">Boş qalanlar</span><b>' + esc(d.empty) + '</b></li></ul></div>' +
      '<div class="an-hd"><b>Fənlər üzrə nəticə</b></div><div class="an-sb">' + rows + '</div></div>' +
      '<div class="an-card an-img"><h3>Sizin inkişafınız <em>bizim motivasiyamızdır!</em></h3>' +
      '<svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs>' +
      '<linearGradient id="dqAnB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b8cff" stop-opacity=".95"/><stop offset="1" stop-color="#1d3f9e" stop-opacity=".55"/></linearGradient>' +
      '<linearGradient id="dqAnA" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#c9a24b"/><stop offset="1" stop-color="#f7e3a1"/></linearGradient>' +
      '<filter id="dqAnGl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect x="30" y="150" width="36" height="70" rx="5" fill="url(#dqAnB)"/><rect x="82" y="124" width="36" height="96" rx="5" fill="url(#dqAnB)"/>' +
      '<rect x="134" y="98" width="36" height="122" rx="5" fill="url(#dqAnB)"/><rect x="186" y="70" width="36" height="150" rx="5" fill="url(#dqAnB)"/>' +
      '<rect x="238" y="44" width="36" height="176" rx="5" fill="url(#dqAnB)"/>' +
      '<path d="M22 150 L86 112 L132 128 L214 62 L262 30" fill="none" stroke="url(#dqAnA)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#dqAnGl)"/>' +
      '<path d="M246 24 L266 28 L258 48" fill="none" stroke="#f7e3a1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#dqAnGl)"/></svg></div>' +
      '</div></div>';
  }

  function inNew(n) { return !!(n.closest && (n.closest("#dq-an") || n.closest("[data-dqan-old]"))); }

  function findHeading() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n, re = /Nəticəni\s+təhlil\s+et/i;
    while ((n = w.nextNode())) {
      if (!re.test(n.nodeValue || "")) continue;
      var e = n.parentElement;
      if (!e || inNew(e) || /^(SCRIPT|STYLE|TEXTAREA)$/.test(e.tagName)) continue;
      return e;
    }
    return null;
  }

  function container(h) {
    var el = h, stop = /Niyə məhz|Fənlər üzrə testlər|Aktiv sınaqlar|Yeniliklər|İmtahan Qeydiyyatı|Son yeniliklər/;
    while (el.parentElement && el.parentElement !== document.body) {
      var p = el.parentElement;
      if (stop.test(p.textContent || "")) break;
      el = p;
    }
    return el;
  }

  function animate(sec) {
    var go = function () {
      sec.classList.add("on");
      var bars = sec.querySelectorAll(".an-bar i");
      for (var i = 0; i < bars.length; i++) bars[i].style.width = bars[i].getAttribute("data-w") + "%";
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        if (es[0] && es[0].isIntersecting) { io.disconnect(); go(); }
      }, { threshold: .2 });
      io.observe(sec);
    } else go();
  }

  function ensureCss() {
    if (document.getElementById("dq-an-css")) return;
    var s = document.createElement("style");
    s.id = "dq-an-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  function dedupe() {
    var all = document.querySelectorAll("#dq-an");
    for (var i = 1; i < all.length; i++) all[i].parentNode.removeChild(all[i]);
    var olds = document.querySelectorAll("[data-dqan-old]");
    for (var j = 0; j < olds.length; j++) olds[j].style.setProperty("display", "none", "important");
    return all[0] || null;
  }

  var busy = 0, last = 0;
  function tick() {
    if (busy || document.hidden) return;
    busy = 1;
    try {
      var mine = dedupe(), h = findHeading();
      if (!h) return;                      /* köhnə bölmə yoxdur — heç nə etmə */
      var old = container(h);
      old.setAttribute("data-dqan-old", "1");
      old.style.setProperty("display", "none", "important");
      if (mine && mine.isConnected && mine.nextElementSibling === old) return;
      if (mine && mine.parentNode) mine.parentNode.removeChild(mine);
      ensureCss();
      var n = document.createElement("section");
      n.id = "dq-an"; n.innerHTML = html();
      old.parentNode.insertBefore(n, old);
      animate(n);
    } catch (e) { /* səssiz */ }
    finally { busy = 0; last = Date.now(); }
  }

  var t = 0;
  new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () { if (Date.now() - last > 500) tick(); }, 400);
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  setTimeout(tick, 1200); setTimeout(tick, 3000);
})();
