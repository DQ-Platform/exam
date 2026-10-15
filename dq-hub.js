/* DQ Platform — dq-hub.js (v1) — Ana səhifə «Yeniliklər + Tövsiyə» paneli
   Sol: 3D «coverflow» xəbər karuseli (avtomatik fırlanır, toxunanda xəbərə daxil olur)
   Sağ: fırlanan tövsiyə paneli — karusel mövzusu, sınaq kateqoriyası, test və fənlər üzrə sual (paylaşmaqla)
   Asılılıqlar: app.js (V2, HOME, TLX.pool/begin, LX.exMap, startExamSession, V3.showTests) */
(function () {
  "use strict";
  if (window.DQHUB) return;
  var D = document, $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var LET = "ABCDEF";
  var G = [["#4f46e5", "#7c3aed"], ["#0ea5e9", "#2563eb"], ["#059669", "#0d9488"], ["#ea580c", "#db2777"], ["#7c3aed", "#db2777"], ["#0891b2", "#4f46e5"]];
  var DATA = { news: null, tests: null, exams: null, pool: null }, ST = { n: 0, r: 0, loading: false };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CSS = '#dq-hub{max-width:1180px;margin:20px auto 6px;padding:0 14px;box-sizing:border-box}' +
    '#dq-hub .dqh-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:18px;align-items:stretch}' +
    '@media(max-width:920px){#dq-hub .dqh-grid{grid-template-columns:minmax(0,1fr)}}' +
    '#dq-hub .dqh-box{position:relative;background:#fff;border:1px solid rgba(99,102,241,.14);border-radius:26px;padding:16px 14px 14px;box-shadow:0 1px 2px rgba(15,23,42,.05),0 22px 46px -22px rgba(79,70,229,.45);overflow:hidden}' +
    '#dq-hub .dqh-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 6px 4px}' +
    '#dq-hub .dqh-hd h2{margin:0;font-size:19px;font-weight:800;background:linear-gradient(120deg,#4f46e5,#7c3aed 50%,#06b6d4);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '#dq-hub .dqh-hd small{color:#64748b;font-size:12.5px}' +
    '#dq-hub .dqh-all{border:0;background:#eef2ff;color:#3730a3;border-radius:99px;padding:7px 13px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .25s,color .25s}' +
    '#dq-hub .dqh-all:hover{background:linear-gradient(120deg,#4f46e5,#7c3aed);color:#fff}' +
    /* coverflow */
    '#dq-hub .dqh-cf{position:relative;height:clamp(330px,46vw,420px);perspective:1300px;perspective-origin:50% 45%;margin-top:6px;touch-action:pan-y;user-select:none;-webkit-user-select:none}' +
    '#dq-hub .dqh-c{position:absolute;left:50%;top:8px;bottom:40px;width:min(250px,58%);margin-left:calc(min(250px,58%) / -2);border-radius:22px;overflow:hidden;cursor:pointer;background:#0f172a;box-shadow:0 22px 40px -18px rgba(15,23,42,.75);transition:transform .85s cubic-bezier(.22,.61,.36,1),opacity .85s ease,filter .85s ease;will-change:transform,opacity;backface-visibility:hidden}' +
    '#dq-hub .dqh-c img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}' +
    '#dq-hub .dqh-c .nb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:64px}' +
    '#dq-hub .dqh-c .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,10,40,0) 38%,rgba(7,10,40,.93) 100%)}' +
    '#dq-hub .dqh-c .tx{position:absolute;left:14px;right:14px;bottom:13px;color:#fff;text-align:left}' +
    '#dq-hub .dqh-c .tx b{display:inline-block;font-size:10.5px;letter-spacing:.6px;text-transform:uppercase;background:rgba(255,255,255,.2);backdrop-filter:blur(4px);border-radius:99px;padding:3px 10px;margin-bottom:6px}' +
    '#dq-hub .dqh-c .tx h3{margin:0;font-size:15px;line-height:1.3;font-weight:800;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.4)}' +
    '#dq-hub .dqh-c .tx span{display:block;margin-top:5px;font-size:11.5px;opacity:.85}' +
    '#dq-hub .dqh-c .nw{position:absolute;top:12px;left:12px;background:linear-gradient(120deg,#f59e0b,#ec4899);color:#fff;font-size:10.5px;font-weight:800;border-radius:99px;padding:4px 10px;box-shadow:0 6px 14px -6px rgba(236,72,153,.8)}' +
    '#dq-hub .dqh-c .go{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);color:#312e81;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;opacity:0;transform:scale(.7);transition:opacity .3s,transform .3s}' +
    '#dq-hub .dqh-c.on .go{opacity:1;transform:none}' +
    '#dq-hub .dqh-ar{position:absolute;top:50%;margin-top:-26px;width:42px;height:42px;border-radius:50%;border:0;background:#fff;color:#1e1b4b;font-size:22px;font-weight:800;cursor:pointer;z-index:30;box-shadow:0 10px 24px -8px rgba(15,23,42,.45);transition:background .25s,color .25s,transform .2s}' +
    '#dq-hub .dqh-ar:hover{background:linear-gradient(120deg,#4f46e5,#7c3aed);color:#fff;transform:scale(1.08)}#dq-hub .dqh-ar.l{left:2px}#dq-hub .dqh-ar.r{right:2px}' +
    '#dq-hub .dqh-dots{position:absolute;left:0;right:0;bottom:6px;display:flex;justify-content:center;gap:7px;z-index:30}' +
    '#dq-hub .dqh-dots i{width:8px;height:8px;border-radius:99px;background:#cbd5e1;cursor:pointer;transition:width .4s,background .4s}#dq-hub .dqh-dots i.on{width:26px;background:linear-gradient(90deg,#4f46e5,#06b6d4)}' +
    /* tövsiyə paneli */
    '#dq-hub .dqh-rec{display:flex;flex-direction:column;background:linear-gradient(180deg,#fff,#f7f5ff)}' +
    '#dq-hub .dqh-stage{position:relative;flex:1;min-height:410px;margin-top:8px}' +
    '#dq-hub .rs{position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;border-radius:20px;padding:14px;overflow:auto;opacity:0;visibility:hidden;transform:translateX(24px);pointer-events:none;transition:opacity .6s ease,transform .7s cubic-bezier(.22,.61,.36,1),visibility 0s linear .6s;color:#fff;scrollbar-width:thin}' +
    '#dq-hub .rs.on{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .6s ease,transform .7s cubic-bezier(.22,.61,.36,1),visibility 0s}' +
    '#dq-hub .rs.out{transform:translateX(-24px)}' +
    '#dq-hub .rs .tp{align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;background:rgba(255,255,255,.2);border-radius:99px;padding:4px 11px}' +
    '#dq-hub .rs h3{margin:0;font-size:20px;line-height:1.25;font-weight:800;color:#fff}' +
    '#dq-hub .rs p{margin:0;font-size:13.5px;line-height:1.5;opacity:.92}' +
    '#dq-hub .rs .mt{display:flex;gap:7px;flex-wrap:wrap}#dq-hub .rs .mt span{background:rgba(255,255,255,.18);border-radius:99px;padding:4px 11px;font-size:12px;font-weight:700}' +
    '#dq-hub .rs .ic{font-size:44px;line-height:1}' +
    '#dq-hub .rs .sp{flex:1}' +
    '#dq-hub .rs .ac{display:flex;gap:8px;flex-wrap:wrap}' +
    '#dq-hub .rb{border:0;border-radius:12px;padding:11px 16px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;background:#fff;color:#312e81;box-shadow:0 10px 22px -10px rgba(0,0,0,.5);transition:transform .2s,box-shadow .2s}' +
    '#dq-hub .rb:hover{transform:translateY(-2px)}#dq-hub .rb.g{background:rgba(255,255,255,.18);color:#fff;box-shadow:none}' +
    '#dq-hub .rs.q .qt{font-size:15px;line-height:1.45;font-weight:700;margin:0;white-space:pre-line}' +
    '#dq-hub .rs.q .qi{max-height:110px;border-radius:12px;object-fit:contain;background:#fff;align-self:flex-start}' +
    '#dq-hub .qo{display:flex;flex-direction:column;gap:7px}' +
    '#dq-hub .qo button{display:flex;gap:9px;align-items:flex-start;text-align:left;border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.14);color:#fff;border-radius:12px;padding:9px 11px;font:inherit;font-size:13.5px;cursor:pointer;transition:background .25s,border-color .25s,transform .15s}' +
    '#dq-hub .qo button:hover{background:rgba(255,255,255,.26)}#dq-hub .qo button:active{transform:scale(.985)}' +
    '#dq-hub .qo button b{flex:none;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:11.5px}' +
    '#dq-hub .qo button.ok{background:#16a34a;border-color:#bbf7d0}#dq-hub .qo button.no{background:#dc2626;border-color:#fecaca}#dq-hub .qo.done button{pointer-events:none}' +
    '#dq-hub .qx{font-size:12.5px;background:rgba(0,0,0,.22);border-radius:12px;padding:8px 11px;display:none}#dq-hub .qx.on{display:block}' +
    '#dq-hub .dqh-ft{display:flex;align-items:center;gap:10px;padding:10px 4px 0}' +
    '#dq-hub .dqh-bar{flex:1;height:5px;border-radius:99px;background:#e2e8f0;overflow:hidden}#dq-hub .dqh-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4f46e5,#06b6d4)}' +
    '#dq-hub .dqh-n{font-size:12px;color:#64748b;font-weight:700;min-width:44px;text-align:center}' +
    '#dq-hub .dqh-nv{width:32px;height:32px;border-radius:50%;border:0;background:#eef2ff;color:#3730a3;font-weight:800;cursor:pointer}#dq-hub .dqh-nv:hover{background:#4f46e5;color:#fff}' +
    '@media(prefers-reduced-motion:reduce){#dq-hub .dqh-c,#dq-hub .rs{transition-duration:.01s!important}}';

  function injectCss() { if ($("dq-hub-css")) return; var s = D.createElement("style"); s.id = "dq-hub-css"; s.textContent = CSS; D.head.appendChild(s); }

  /* ---------------- məlumat ---------------- */
  function dayN() { var d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
  function rng(seed) { var r = seed >>> 0; return function () { r = (r + 0x6D2B79F5) >>> 0; var t = r; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, seed) { a = a.slice(); var r = rng(seed); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  async function load() {
    if (ST.loading) return; ST.loading = true;
    try {
      if (DATA.news === null && window.V2) {
        try {
          var l = await V2.list("news");
          DATA.news = (l || []).filter(function (n) { return n.title && !(n.kind && /^(exam|imtahan-sinaq)$/i.test(n.kind)); })
            .sort(function (a, b) { return String(b.pub || b.date || "").localeCompare(String(a.pub || a.date || "")); }).slice(0, 9);
        } catch (e) { DATA.news = []; }
      }
      if (DATA.tests === null && window.V2) { try { DATA.tests = (await V2.list("v3tests")) || []; } catch (e) { DATA.tests = []; } }
      if (DATA.exams === null && window.LX && LX.exMap) { try { DATA.exams = await LX.exMap(); } catch (e) { DATA.exams = {}; } }
      if (window.TLX && TLX.pool) { try { DATA.pool = TLX.pool(); } catch (e) { DATA.pool = []; } } else DATA.pool = [];
    } finally { ST.loading = false; }
  }
  function ready() { return DATA.news !== null && DATA.pool !== null; }

  /* ---------------- xəbər açılışı ---------------- */
  function openNews(n) {
    try { HOME.openNews(); } catch (e) { return; }
    var t = String(n.title).trim(), tries = 0, iv = setInterval(function () {
      var ms = D.querySelectorAll("#nw-pub .nw-card");
      for (var k = 0; k < ms.length; k++) { var h = ms[k].querySelector("h3"); if (h && h.textContent.trim() === t) { clearInterval(iv); var m = ms[k].querySelector(".nw-more"); m && m.click(); return; } }
      if (++tries > 40) clearInterval(iv);
    }, 150);
  }
  function share(data, toastMsg) {
    var d = { title: data.title, text: data.text, url: data.url || location.href };
    if (navigator.share) { navigator.share(d).catch(function () { }); return; }
    var txt = (data.text ? data.text + "\n" : "") + (data.url || location.href);
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { try { V2.toast(toastMsg || "Kopyalandı ✅"); } catch (e) { } });
  }

  /* ---------------- sol: xəbər coverflow ---------------- */
  function sum(n) { var t = n.sum || String(n.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); return t.length > 120 ? t.slice(0, 117) + "…" : t; }
  function fresh(n) { var d = Date.parse(n.pub || n.date || ""); return d && Date.now() - d < 7 * 864e5; }
  function newsCard(n, i) {
    var g = G[i % G.length];
    return '<div class="dqh-c" data-i="' + i + '" role="button" tabindex="0" aria-label="' + esc(n.title) + '" style="background:linear-gradient(150deg,' + g[0] + ',' + g[1] + ')">' +
      (n.img ? '<img alt="" draggable="false" ' + (i > 2 ? 'loading="lazy" ' : "") + 'src="' + esc(n.img) + '">' : '<div class="nb">📰</div>') +
      '<div class="ov"></div>' + (fresh(n) ? '<span class="nw">YENİ</span>' : "") + '<span class="go">→</span>' +
      '<div class="tx"><b>' + esc(n.kind || "Xəbər") + '</b><h3>' + esc(n.title) + '</h3><span>' + esc(String(n.pub || n.date || "").slice(0, 10)) + '</span></div></div>';
  }
  function placeFlow(root) {
    var cards = root.querySelectorAll(".dqh-c"), N = cards.length, cur = ST.n;
    [].forEach.call(cards, function (c, i) {
      var d = i - cur; if (d > N / 2) d -= N; if (d < -N / 2) d += N;
      var a = Math.abs(d), vis = a <= 2;
      c.classList.toggle("on", d === 0);
      c.style.zIndex = 20 - a;
      c.style.opacity = !vis ? 0 : a === 0 ? 1 : a === 1 ? .94 : .55;
      c.style.pointerEvents = vis ? "auto" : "none";
      c.style.filter = a === 0 ? "none" : "brightness(" + (1 - a * .2) + ") saturate(.9)";
      var tx = d === 0 ? 0 : (d > 0 ? 1 : -1) * (a === 1 ? 62 : 98);
      c.style.transform = "translateX(" + tx + "%) translateZ(" + (-a * 150) + "px) rotateY(" + (-d * 34) + "deg) scale(" + (1 - a * .07) + ")";
    });
    [].forEach.call(root.querySelectorAll(".dqh-dots i"), function (x, k) { x.classList.toggle("on", k === cur); });
  }
  function flowGo(root, to) { var N = DATA.news.length; ST.n = (to + N) % N; placeFlow(root); }

  /* ---------------- sağ: tövsiyə slaydları ---------------- */
  function buildSlides() {
    var day = dayN(), out = [], pool = DATA.pool || [], specials = [], Q = [];
    /* mövzu */
    var topics = []; pool.forEach(function (s, si) { s.topics.forEach(function (t) { if (t.n) topics.push({ s: s, t: t, si: si }); }); });
    if (topics.length) { var tp = shuffle(topics, day * 7 + 1)[0]; specials.push({ k: "topic", s: tp.s, t: tp.t, si: tp.si }); }
    /* sınaq kateqoriyası */
    var ex = DATA.exams || {}, pairs = []; ["BA", "BB", "AC"].forEach(function (c) { (ex[c] || []).forEach(function (id) { pairs.push({ id: id, c: c }); }); });
    if (pairs.length) { var ep = shuffle(pairs, day * 13 + 5)[0]; specials.push({ k: "exam", id: ep.id, c: ep.c }); }
    /* test */
    var ts = (DATA.tests || []).filter(function (t) { return t.title; });
    if (ts.length) specials.push({ k: "test", t: shuffle(ts, day * 3 + 2)[0] });
    /* suallar: hər fənndən 2 */
    pool.forEach(function (s, si) {
      var all = []; s.topics.forEach(function (t) { t.qs.forEach(function (q) { if (q && q.t && q.o && q.o.length >= 2 && q.c >= 0) all.push({ q: q, s: s, topic: t.name, si: si }); }); });
      shuffle(all, day * 31 + si * 17 + 3).slice(0, pool.length > 4 ? 2 : 3).forEach(function (x) { Q.push(x); });
    });
    /* növbələşdir: hər 2 sualdan sonra bir xüsusi kart */
    var qi = 0, spi = 0, firstSpecial = true;
    if (specials.length && firstSpecial) { out.push(specials[spi++]); }
    while (qi < Q.length || spi < specials.length) {
      for (var k = 0; k < 2 && qi < Q.length; k++) out.push({ k: "q", d: Q[qi++] });
      if (spi < specials.length) out.push(specials[spi++]);
      if (out.length > 14) break;
    }
    return out;
  }
  function grad(i) { var g = G[i % G.length]; return "linear-gradient(150deg," + g[0] + "," + g[1] + ")"; }
  function slideHtml(sl, i) {
    if (sl.k === "topic") {
      var s = sl.s, bg = s.cover ? "linear-gradient(180deg,rgba(7,10,40,.35),rgba(7,10,40,.88)),url('" + esc(s.cover) + "') center/cover" : "linear-gradient(150deg," + s.grad[0] + "," + s.grad[1] + ")";
      return '<div class="rs" data-i="' + i + '" style="background:' + bg + '"><span class="tp">📚 Tövsiyə olunan mövzu</span><div class="ic">' + esc(s.icon || "📚") + '</div><h3>' + esc(sl.t.name) + '</h3><p>' + esc(s.name) + ' fənni üzrə hazırlıq testi</p>' +
        '<div class="mt"><span>❓ ' + sl.t.n + ' sual</span><span>⏱ ' + (sl.t.time > 0 ? sl.t.time : Math.max(1, Math.round(sl.t.n * 1.2))) + ' dəq</span></div><div class="sp"></div><div class="ac"><button type="button" class="rb" data-a="topic" data-s="' + esc(s.name) + '" data-t="' + esc(sl.t.name) + '">▶ Testə başla</button><button type="button" class="rb g" data-a="shtopic" data-i="' + i + '">🔗 Paylaş</button></div></div>';
    }
    if (sl.k === "exam") {
      return '<div class="rs" data-i="' + i + '" style="background:linear-gradient(150deg,#0a1a45,#1b1a6b 55%,#7c3aed)"><span class="tp">🎯 Sınaq kateqoriyası</span><div class="ic">📝</div><h3>Sınaq № ' + esc(sl.id) + ' · ' + esc(sl.c) + '</h3><p>Real imtahan formatında hazırlaşın: vaxt məhdudiyyəti və nəticənin avtomatik yoxlanması ilə.</p>' +
        '<div class="mt"><span>' + esc(sl.c) + ' kateqoriyası</span><span>Vaxtlı sınaq</span></div><div class="sp"></div><div class="ac"><button type="button" class="rb" data-a="exam" data-id="' + esc(sl.id) + '" data-c="' + esc(sl.c) + '">▶ Sınağa keç</button><button type="button" class="rb g" data-a="shexam" data-i="' + i + '">🔗 Paylaş</button></div></div>';
    }
    if (sl.k === "test") {
      var t = sl.t;
      return '<div class="rs" data-i="' + i + '" style="background:linear-gradient(150deg,#059669,#0d9488 60%,#0ea5e9)"><span class="tp">⭐ Tövsiyə olunan test</span>' + (t.img ? '<img class="qi" alt="" loading="lazy" src="' + esc(t.img) + '" style="max-height:120px;background:#fff">' : '<div class="ic">🧪</div>') +
        '<h3>' + esc(t.title) + '</h3><p>' + esc(t.subject || "Fənn testi") + (t.ans ? ' · ' + t.ans.length + ' sual' : "") + '</p><div class="sp"></div><div class="ac"><button type="button" class="rb" data-a="test">▶ Testlərə keç</button><button type="button" class="rb g" data-a="shtest" data-i="' + i + '">🔗 Paylaş</button></div></div>';
    }
    var d = sl.d, q = d.q;
    return '<div class="rs q" data-i="' + i + '" style="background:' + (d.s.cover ? "linear-gradient(180deg,rgba(7,10,40,.62),rgba(7,10,40,.92)),url('" + esc(d.s.cover) + "') center/cover" : "linear-gradient(150deg," + d.s.grad[0] + "," + d.s.grad[1] + ")") + '"><span class="tp">' + esc(d.s.icon || "❓") + ' ' + esc(d.s.name) + ' · sual</span>' +
      (q.i ? '<img class="qi" alt="" loading="lazy" src="' + esc(q.i) + '">' : "") + '<p class="qt">' + esc(q.t) + '</p><div class="qo">' +
      q.o.map(function (o, k) { return '<button type="button" data-a="opt" data-k="' + k + '"><b>' + LET[k] + '</b><span>' + esc(o) + '</span></button>'; }).join("") + '</div><div class="qx"></div><div class="sp"></div>' +
      '<div class="ac"><button type="button" class="rb g" data-a="shq" data-i="' + i + '">🔗 Sualı paylaş</button><button type="button" class="rb g" data-a="nextq">Növbəti →</button></div></div>';
  }

  /* ---------------- qurulma və idarəetmə ---------------- */
  var T = { flow: null, rec: null, rbar: null, hover: false, rhover: false, slides: [], r: 0 };
  function mount(host) {
    injectCss();
    var news = DATA.news || [], sl = (T.slides = buildSlides());
    var hub = D.createElement("section"); hub.id = "dq-hub"; hub.setAttribute("aria-label", "Yeniliklər və tövsiyələr");
    hub.innerHTML = '<div class="dqh-grid">' +
      '<div class="dqh-box dqh-news"><div class="dqh-hd"><div><h2>📢 Yeniliklər</h2><small>Toxunun — xəbərə daxil olun</small></div><button type="button" class="dqh-all" data-a="all">Hamısı →</button></div>' +
      (news.length ? '<div class="dqh-cf" id="dqh-cf">' + news.map(newsCard).join("") + (news.length > 1 ? '<button type="button" class="dqh-ar l" data-a="prev" aria-label="Əvvəlki">‹</button><button type="button" class="dqh-ar r" data-a="next" aria-label="Növbəti">›</button><div class="dqh-dots">' + news.map(function (_, i) { return '<i data-a="dot" data-i="' + i + '"></i>'; }).join("") + '</div>' : "") + '</div>'
        : '<div style="padding:40px 10px;text-align:center;color:#64748b">Hələ xəbər yoxdur.</div>') + '</div>' +
      '<aside class="dqh-box dqh-rec"><div class="dqh-hd"><div><h2>✨ Sizin üçün tövsiyə</h2><small>Hər gün yenilənir</small></div></div>' +
      (sl.length ? '<div class="dqh-stage" id="dqh-stage">' + sl.map(slideHtml).join("") + '</div><div class="dqh-ft"><button type="button" class="dqh-nv" data-a="rprev" aria-label="Əvvəlki">‹</button><div class="dqh-bar"><i id="dqh-bi"></i></div><span class="dqh-n" id="dqh-rn"></span><button type="button" class="dqh-nv" data-a="rnext" aria-label="Növbəti">›</button></div>'
        : '<div style="padding:40px 10px;text-align:center;color:#64748b">Tövsiyələr hazırlanır…</div>') + '</aside></div>';
    host.parentNode.insertBefore(hub, host);
    if (news.length) { ST.n = Math.min(ST.n, news.length - 1); placeFlow(hub); }
    if (sl.length) rShow(hub, ST.r < sl.length ? ST.r : 0, true);
    bind(hub); return hub;
  }
  function rShow(hub, to, first) {
    var N = T.slides.length; if (!N) return;
    var els = hub.querySelectorAll(".rs"), prev = ST.r;
    ST.r = (to + N) % N;
    [].forEach.call(els, function (e, k) { e.classList.toggle("on", k === ST.r); e.classList.toggle("out", k === prev && prev !== ST.r); });
    var n = hub.querySelector("#dqh-rn"); if (n) n.textContent = (ST.r + 1) + " / " + N;
    T.rstart = Date.now(); T.rdur = els[ST.r] && els[ST.r].classList.contains("q") ? 11000 : 7000;
  }
  function bind(hub) {
    var cf = hub.querySelector("#dqh-cf"), sx = 0, sy = 0, moved = false;
    hub.addEventListener("click", function (e) {
      var c = e.target.closest(".dqh-c");
      if (c && !e.target.closest("[data-a]")) { if (moved) { moved = false; return; } var i = +c.dataset.i; if (i === ST.n) openNews(DATA.news[i]); else flowGo(hub, i); T.last = Date.now(); return; }
      var b = e.target.closest("[data-a]"); if (!b) return; var a = b.dataset.a; T.last = Date.now();
      if (a === "prev") return flowGo(hub, ST.n - 1);
      if (a === "next") return flowGo(hub, ST.n + 1);
      if (a === "dot") return flowGo(hub, +b.dataset.i);
      if (a === "all") { try { HOME.openNews(); } catch (x) { } return; }
      if (a === "rprev") return rShow(hub, ST.r - 1);
      if (a === "rnext" || a === "nextq") return rShow(hub, ST.r + 1);
      if (a === "topic") { try { TLX.begin(b.dataset.s, b.dataset.t); } catch (x) { } return; }
      if (a === "exam") { try { startExamSession(b.dataset.id, b.dataset.c); } catch (x) { alert("Sınaq açıla bilmədi."); } return; }
      if (a === "test") { try { V3.showTests(); } catch (x) { } return; }
      if (a === "opt") {
        var slide = b.closest(".rs"), sl = T.slides[+slide.dataset.i], q = sl.d.q, k = +b.dataset.k, box = slide.querySelector(".qo");
        if (box.classList.contains("done")) return; box.classList.add("done");
        [].forEach.call(box.children, function (x, j) { if (j === q.c) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        var qx = slide.querySelector(".qx"); qx.classList.add("on"); qx.innerHTML = (k === q.c ? "✅ Düzgündür!" : "❌ Düzgün cavab: <b>" + LET[q.c] + ") " + esc(q.o[q.c]) + "</b>") + (q.e ? "<br>💡 " + esc(q.e) : "");
        T.rstart = Date.now() + 6000; return;
      }
      if (a === "shq") { var s1 = T.slides[+b.dataset.i].d; share({ title: "DQ Platform — sual", text: "❓ " + s1.s.name + "\n\n" + s1.q.t + "\n" + s1.q.o.map(function (o, k) { return LET[k] + ") " + o; }).join("\n") + "\n\nCavabı yoxlayın 👇" }, "Sual kopyalandı ✅"); return; }
      if (a === "shtopic") { var t1 = T.slides[+b.dataset.i]; share({ title: "DQ Platform", text: "📚 " + t1.s.name + " — " + t1.t.name + " testi (" + t1.t.n + " sual)" }, "Link kopyalandı ✅"); return; }
      if (a === "shexam") { var e1 = T.slides[+b.dataset.i]; share({ title: "DQ Platform", text: "📝 Sınaq № " + e1.id + " · " + e1.c + " kateqoriyası" }, "Link kopyalandı ✅"); return; }
      if (a === "shtest") { var x1 = T.slides[+b.dataset.i].t; share({ title: "DQ Platform", text: "⭐ " + x1.title + (x1.subject ? " (" + x1.subject + ")" : "") }, "Link kopyalandı ✅"); return; }
    });
    /* sürüşdürmə (swipe) */
    if (cf) {
      cf.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; moved = false; T.hover = true; });
      cf.addEventListener("pointerup", function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { moved = true; flowGo(hub, ST.n + (dx < 0 ? 1 : -1)); T.last = Date.now(); } setTimeout(function () { T.hover = false; }, 1200); });
      cf.addEventListener("pointerleave", function () { T.hover = false; });
      cf.addEventListener("mouseenter", function () { T.hover = true; }); cf.addEventListener("mouseleave", function () { T.hover = false; });
      cf.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.classList.contains("on")) openNews(DATA.news[ST.n]); if (e.key === "ArrowRight") flowGo(hub, ST.n + 1); if (e.key === "ArrowLeft") flowGo(hub, ST.n - 1); });
    }
    var st = hub.querySelector("#dqh-stage");
    if (st) { st.addEventListener("mouseenter", function () { T.rhover = true; }); st.addEventListener("mouseleave", function () { T.rhover = false; }); st.addEventListener("touchstart", function () { T.rhover = true; }, { passive: true }); st.addEventListener("touchend", function () { setTimeout(function () { T.rhover = false; T.rstart = Date.now(); }, 4000); }, { passive: true }); }
  }

  /* avtomatik fırlanma */
  var lastFlow = Date.now();
  setInterval(function () {
    var hub = $("dq-hub"); if (!hub || D.hidden) return;
    var r = hub.getBoundingClientRect(), vis = r.bottom > 0 && r.top < innerHeight; if (!vis || REDUCED) return;
    var now = Date.now();
    if (DATA.news && DATA.news.length > 1 && !T.hover && now - lastFlow > 4600 && now - (T.last || 0) > 5000) { lastFlow = now; flowGo(hub, ST.n + 1); }
    var bi = hub.querySelector("#dqh-bi");
    if (T.slides.length > 1 && !T.rhover && T.rstart) {
      var p = Math.max(0, Math.min(1, (now - T.rstart) / (T.rdur || 7000))); if (bi) bi.style.width = (p * 100) + "%";
      if (p >= 1) rShow(hub, ST.r + 1);
    } else if (bi && T.rhover) { /* dayandırılıb */ }
  }, 120);

  /* ana səhifəyə yerləşdir */
  function tick() {
    var h = $("v3-home"); if (!h || h.style.display === "none") return;
    var grid = $("dt-grid"); if (!grid || grid.parentNode === null) return;
    var hub = $("dq-hub");
    if (hub && hub.nextElementSibling === grid) return;
    if (!ready()) { load(); return; }
    if (hub) hub.remove();
    mount(grid);
  }
  setInterval(tick, 700);
  /* məlumat dəyişsə (admin yeni xəbər əlavə etsə) səhifə yenilənəndə yenilənir; əl ilə yeniləmək üçün: */
  window.DQHUB = { reload: function () { DATA.news = DATA.tests = DATA.exams = DATA.pool = null; var h = $("dq-hub"); h && h.remove(); load(); } };
})();
