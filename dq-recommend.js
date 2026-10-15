/* DQ Platform — dq-recommend.js (v1)
   «🎯 Sizin üçün tövsiyə» paneli (ana səhifə, Yeniliklərin üstündə) + admin modulu (Sual bankı / Qapaq şəkilləri / Ayarlar).
   Panel hər gün avtomatik yenilənir: hər fənndən 1–2 sual (variantlarla, seçmək olur), mövzu testi, test, sınaq kateqoriyası.
   Sol tərəf: fənnə aid qapaq şəkli, sağ tərəf: tövsiyə (yeniliklərdən fərqli olaraq xəbər mətni yoxdur). Avtomatik fırlanır.
   Mənbələr: «🎠 Karusel» kataloqu (krs_catalogue), Sual bankı (qbank), v3tests, liveexams.
   Qoşulma: index.html-də dq-home-news.js-dən SONRA:  <script src="dq-recommend.js?v=1"></script> */
(function () {
  "use strict";
  if (window.RC) return;

  var COL = { bank: "qbank", cov: "rccovers", cfg: "rccfg" };
  var L = "ABCDEF";
  var DEF = { on: true, sec: 11, perSubject: 2, topics: true, tests: true, exams: true, catalogue: true, max: 14 };
  var S = { cat: [], bank: [], covers: [], tests: [], exams: [], cfg: Object.assign({}, DEF), cfgId: null,
            items: [], cur: 0, t0: 0, hold: 0, hover: false, ans: {}, ready: false, deep: false };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var low = function (s) { return String(s || "").trim().toLowerCase(); };

  /* ================= köməkçilər ================= */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function dayKey() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function validQ(q) {
    return q && typeof q.t === "string" && q.t.trim() && Array.isArray(q.o) && q.o.length >= 2 && q.o.length <= 6 &&
      q.o.every(function (x) { return String(x).trim(); }) && Number.isInteger(q.c) && q.c >= 0 && q.c < q.o.length;
  }
  async function safe(c) { try { return (await V2.list(c)) || []; } catch (e) { return []; } }
  function toast(m) { try { V2.toast(m); } catch (e) { } }
  var PAL = [["#7c3aed", "#4c1d95"], ["#2f63bd", "#0a2f7a"], ["#059669", "#065f46"], ["#ea580c", "#7c2d12"], ["#db2777", "#831843"], ["#0891b2", "#164e63"], ["#ca8a04", "#713f12"], ["#dc2626", "#7f1d1d"]];
  function okColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || "") ? c : ""; }

  /* ================= məlumat ================= */
  async function load() {
    try { await V2.probe(); } catch (e) { }
    var r = await Promise.all([safe(COL.bank), safe(COL.cov), safe(COL.cfg), safe("v3tests"), safe("liveexams"), safe("krs_catalogue")]);
    S.bank = r[0]; S.covers = r[1];
    var c = r[2][0]; S.cfgId = c ? c._id : null; S.cfg = Object.assign({}, DEF, c || {}); delete S.cfg._id;
    S.tests = r[3].filter(function (t) { return t.ans && t.ans.length && t.status !== "hidden"; });
    S.exams = r[4];
    var k = r[5][0];
    if (k && Array.isArray(k.subjects)) S.cat = k.subjects;
    else if (window.KRS_DATA && Array.isArray(window.KRS_DATA.subjects)) S.cat = window.KRS_DATA.subjects;
    else { try { var cc = JSON.parse(localStorage.getItem("krs_cache_v1") || "null"); S.cat = cc && cc.subjects || []; } catch (e) { S.cat = []; } }
    S.ready = true;
  }

  /* fənn → {name, icon, c1, c2, cover, qs[]} */
  function pool() {
    var map = {}, order = [];
    function sub(name) {
      var k = low(name) || "digər";
      if (!map[k]) { map[k] = { name: String(name || "Digər").trim() || "Digər", icon: "", c1: "", c2: "", cover: "", qs: [] }; order.push(k); }
      return map[k];
    }
    (S.cat || []).forEach(function (s) {
      if (!s || !s.name || s.hidden) return;
      var o = sub(s.name); o.icon = s.icon || o.icon; o.c1 = okColor(s.c1) || o.c1; o.c2 = okColor(s.c2) || o.c2; o.cover = s.cover || o.cover;
      if (!S.cfg.catalogue) return;
      (s.topics || []).forEach(function (t) {
        if (!t || t.hidden) return;
        (t.qs || []).forEach(function (q, i) {
          if (validQ(q)) o.qs.push({ id: "c|" + s.name + "|" + t.name + "|" + i, subject: s.name, topic: t.name, t: q.t, o: q.o, c: q.c, e: q.e || "", img: q.i || "" });
        });
      });
    });
    (S.bank || []).forEach(function (b) {
      if (b.on === false || !validQ(b)) return;
      sub(b.subject).qs.push({ id: "b|" + b._id, subject: String(b.subject || "Digər"), topic: b.topic || "", t: b.t, o: b.o, c: b.c, e: b.e || "", img: "" });
    });
    return order.map(function (k) { return map[k]; });
  }

  /* ================= qapaq şəkli ================= */
  function xml(s) { return String(s).replace(/[&<>'"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[c]; }); }
  function gen(name, icon, c1, c2) {
    var p = PAL[hash(low(name)) % PAL.length];
    c1 = okColor(c1) || p[0]; c2 = okColor(c2) || p[1];
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 420'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='" + c1 + "'/><stop offset='1' stop-color='" + c2 + "'/></linearGradient></defs>" +
      "<rect width='600' height='420' fill='url(#g)'/><g fill='#fff' opacity='.13'><rect x='50' y='30' width='170' height='170' rx='34' transform='rotate(45 135 115)'/><rect x='390' y='200' width='210' height='210' rx='40' transform='rotate(45 495 305)'/><rect x='470' y='20' width='90' height='90' rx='20' transform='rotate(45 515 65)'/></g>" +
      "<text x='300' y='235' font-size='120' text-anchor='middle'>" + xml(icon || "🎯") + "</text>" +
      "<text x='300' y='352' font-size='32' font-weight='800' fill='#fff' text-anchor='middle' font-family='Arial,sans-serif' letter-spacing='2'>" + xml(String(name || "").toUpperCase().slice(0, 24)) + "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function coverFor(subject, id, sd, kindIcon, fallbackImg) {
    var list = (S.covers || []).filter(function (c) { return c.img && low(c.subject) === low(subject); });
    if (list.length) return list[hash(String(id)) % list.length].img;
    if (sd && sd.cover) return sd.cover;
    if (fallbackImg) return fallbackImg;
    return gen(subject, (sd && sd.icon) || kindIcon, sd && sd.c1, sd && sd.c2);
  }

  /* ================= tövsiyələrin avtomatik yığılması ================= */
  function build() {
    var cfg = S.cfg, rnd = rng(hash("dq-rc|" + dayKey())), P = pool(), subs = P.filter(function (s) { return s.qs.length; });
    var per = Math.max(1, Math.min(3, +cfg.perSubject || 2)), groups = [];
    subs.forEach(function (s) {
      groups.push(shuffle(s.qs.slice(), rnd).slice(0, per).map(function (q) {
        return { id: q.id, type: "q", subject: s.name, topic: q.topic, q: q, cover: coverFor(s.name, q.id, s, "🎯") };
      }));
    });
    var qItems = [];
    for (var i = 0; i < per; i++) groups.forEach(function (g) { if (g[i]) qItems.push(g[i]); });

    var others = [];
    if (cfg.topics) {
      var tops = [];
      (S.cat || []).forEach(function (s) {
        if (!s || s.hidden) return;
        (s.topics || []).forEach(function (t) {
          if (!t || t.hidden) return;
          var n = (t.qs || []).filter(validQ).length;
          if (n >= 3) tops.push({ s: s, t: t, n: n });
        });
      });
      shuffle(tops, rnd).slice(0, 2).forEach(function (x) {
        var sd = P.filter(function (p) { return low(p.name) === low(x.s.name); })[0];
        others.push({ id: "t|" + x.s.name + "|" + x.t.name, type: "topic", subject: x.s.name, topic: x.t.name, n: x.n, time: +x.t.time || Math.max(5, x.n), cover: coverFor(x.s.name, "t" + x.t.name, sd, "📚") });
      });
    }
    if (cfg.tests && S.tests.length) {
      var t = shuffle(S.tests.slice(), rnd)[0], sd2 = P.filter(function (p) { return low(p.name) === low(t.subject); })[0];
      others.push({ id: "v|" + t._id, type: "test", subject: t.subject || "Test", test: t, cover: coverFor(t.subject || "Test", "v" + t._id, sd2, "📝", t.img && /^data:image/.test(t.img) ? "" : "") });
    }
    if (cfg.exams && S.exams.length) {
      var act = S.exams.filter(function (e) { return /aktiv/i.test(e.status || ""); }), pl = act.length ? act : S.exams, ex = shuffle(pl.slice(), rnd)[0];
      var cats = String(ex.cat || "").split(/[,\s/]+/).filter(Boolean);
      others.push({ id: "e|" + ex._id, type: "exam", subject: "Sınaq", exam: ex, cats: cats, cover: coverFor("Sınaq", "e" + ex._id, null, "🏁", ex.cover || "") });
    }

    var out = [], oi = 0;
    qItems.forEach(function (it, k) {
      out.push(it);
      if ((k + 1) % 2 === 0 && others[oi]) out.push(others[oi++]);
    });
    while (oi < others.length) out.push(others[oi++]);
    S.items = out.slice(0, Math.max(3, +cfg.max || 14));
    if (S.cur >= S.items.length) S.cur = 0;
  }

  /* ================= paylaşım ================= */
  function baseUrl() { return location.origin + location.pathname; }
  function linkFor(it) { return baseUrl() + "?rec=" + encodeURIComponent(it.id); }
  function shareText(it) {
    if (it.type === "q") {
      var t = "🎯 Sınaq sualı — " + it.subject + (it.topic ? " / " + it.topic : "") + "\n\n" + it.q.t + "\n\n";
      it.q.o.forEach(function (o, i) { t += L[i] + ") " + o + "\n"; });
      return t + "\nCavabı yoxlayın 👉 " + linkFor(it);
    }
    if (it.type === "topic") return "📚 Mövzu testi — " + it.subject + " / " + it.topic + " (" + it.n + " sual)\nDQ Platform 👉 " + linkFor(it);
    if (it.type === "test") return "📝 Test — " + (it.test.title || "") + " (" + it.subject + ", " + it.test.ans.length + " sual)\nDQ Platform 👉 " + linkFor(it);
    return "🏁 Sınaq — " + (it.exam.title || "") + (it.cats.length ? " · " + it.cats.join(", ") + " kateqoriyası" : "") + "\nDQ Platform 👉 " + linkFor(it);
  }
  function share(it) {
    var txt = shareText(it);
    var old = $("rc-sh"); if (old) old.remove();
    var d = document.createElement("div"); d.id = "rc-sh"; d.className = "rc-ov";
    d.innerHTML = '<div class="rc-box"><h3>🔗 Paylaş</h3><pre class="rc-pre">' + esc(txt) + '</pre><div class="rc-shb">' +
      (navigator.share ? '<button data-s="n">📲 Paylaş…</button>' : "") +
      '<button class="wa" data-s="wa">WhatsApp</button><button class="tg" data-s="tg">Telegram</button><button data-s="cp">📋 Kopyala</button></div>' +
      '<button class="rc-x" data-s="x">Bağla</button></div>';
    d.addEventListener("click", function (e) {
      var b = e.target.closest("[data-s]");
      if (e.target === d || (b && b.dataset.s === "x")) return d.remove();
      if (!b) return;
      var k = b.dataset.s, enc = encodeURIComponent(txt);
      if (k === "wa") window.open("https://wa.me/?text=" + enc, "_blank", "noopener");
      else if (k === "tg") window.open("https://t.me/share/url?url=" + encodeURIComponent(linkFor(it)) + "&text=" + encodeURIComponent(txt.replace(/\n?[^\n]*👉[^\n]*$/, "")), "_blank", "noopener");
      else if (k === "n") { try { navigator.share({ title: "DQ Platform", text: txt, url: linkFor(it) }); } catch (e2) { } }
      else if (k === "cp") { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { b.textContent = "✅ Kopyalandı"; }, function () { var ta = d.querySelector(".rc-pre"); var r = document.createRange(); r.selectNodeContents(ta); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Seçildi — kopyalayın"; }); }
    });
    document.body.appendChild(d);
  }

  /* ================= panel (görünüş) ================= */
  var CSS = "" +
    "#rc-home{max-width:1020px;margin:30px auto 8px;padding:0 14px;box-sizing:border-box;text-align:left;position:relative}" +
    ".rc-title{margin:0 0 4px;text-align:center;font-size:clamp(22px,4.6vw,30px);font-weight:800;color:#0f2d6b}" +
    ".rc-sub{display:block;width:54px;height:4px;border-radius:4px;margin:8px auto 18px;background:linear-gradient(90deg,#2f63bd,#d9a23a)}" +
    ".rc-card{position:relative;background:#fff;border-radius:22px;overflow:hidden;border-top:4px solid #d9a23a;box-shadow:0 14px 38px #0f2d6b24,0 2px 6px #0f2d6b0f}" +
    ".rc-stage{display:grid}" +
    ".rc-slide{grid-area:1/1;display:flex;min-width:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateX(18px);transition:opacity .6s ease,transform .6s cubic-bezier(.22,.61,.36,1),visibility 0s linear .6s}" +
    ".rc-slide.on{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}" +
    ".rc-cv{position:relative;flex:0 0 38%;min-height:300px;background:#e8effb;overflow:hidden}" +
    ".rc-cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}" +
    ".rc-cv:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#0f2d6b00 55%,#0f2d6b8c)}" +
    ".rc-tag{position:absolute;left:12px;top:12px;z-index:2;background:#d9a23a;color:#fff;font-size:11px;font-weight:800;letter-spacing:.8px;padding:5px 11px;border-radius:99px;box-shadow:0 4px 10px #d9a23a66}" +
    ".rc-subj{position:absolute;left:14px;bottom:12px;right:14px;z-index:2;color:#fff;font-weight:800;font-size:15px;text-shadow:0 2px 8px #0008}" +
    ".rc-bd{flex:1;min-width:0;padding:22px 26px;display:flex;flex-direction:column;justify-content:center;gap:10px}" +
    ".rc-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12.5px;color:#64748b}" +
    ".rc-k{font-weight:800;font-size:11.5px;padding:4px 11px;border-radius:99px;background:#dbeafe;color:#1e40af}" +
    ".rc-k.g{background:#fef3c7;color:#92400e}.rc-k.v{background:#d1fae5;color:#065f46}" +
    ".rc-bd h3{margin:0;text-align:left;font-size:clamp(17px,3vw,22px);line-height:1.3;color:#0f2d6b;font-weight:800}" +
    ".rc-q{font-size:clamp(15px,2.4vw,17.5px);line-height:1.5;color:#12285e;font-weight:700;white-space:pre-line;max-height:7.5em;overflow:auto}" +
    ".rc-qi{max-width:100%;max-height:130px;object-fit:contain;border-radius:10px;align-self:flex-start}" +
    ".rc-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".rc-opt{display:flex;gap:9px;align-items:flex-start;text-align:left;font:inherit;font-size:14px;line-height:1.35;color:#26365e;background:#f3f7fd;border:1.5px solid #dbe5f6;border-radius:12px;padding:9px 11px;cursor:pointer;transition:border-color .2s,background .2s,transform .15s}" +
    ".rc-opt b{flex:none;width:24px;height:24px;border-radius:50%;background:#fff;border:1.5px solid #c9d6ee;display:grid;place-items:center;font-size:12px;color:#1e4fa3}" +
    ".rc-opt:hover:not(:disabled){border-color:#2f63bd;background:#eaf1fc;transform:translateY(-1px)}" +
    ".rc-opt:disabled{cursor:default}" +
    ".rc-opt.ok{background:#dcfce7;border-color:#16a34a;color:#166534}.rc-opt.ok b{background:#16a34a;border-color:#16a34a;color:#fff}" +
    ".rc-opt.no{background:#fee2e2;border-color:#dc2626;color:#991b1b}.rc-opt.no b{background:#dc2626;border-color:#dc2626;color:#fff}" +
    ".rc-exp{display:none;font-size:13.5px;line-height:1.5;color:#26365e;background:#eaf1fc;border-radius:10px;padding:9px 12px}" +
    ".rc-exp.on{display:block}" +
    ".rc-p{margin:0;font-size:14.5px;line-height:1.6;color:#475569}" +
    ".rc-act{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}" +
    ".rc-btn{font:inherit;font-size:13.5px;font-weight:700;border:0;cursor:pointer;border-radius:99px;padding:10px 20px;display:inline-flex;align-items:center;gap:7px;transition:transform .2s,box-shadow .2s,background .2s}" +
    ".rc-btn.p{background:linear-gradient(135deg,#1e4fa3,#2f63bd);color:#fff;box-shadow:0 6px 16px #1e4fa34d}.rc-btn.g{background:#eef3fc;color:#1e4fa3}" +
    ".rc-btn:hover{transform:translateY(-2px)}" +
    ".rc-bar{height:3px;background:#e6edf9}.rc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2f63bd,#d9a23a)}" +
    ".rc-ctl{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px}" +
    ".rc-ar{width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;background:#fff;color:#1e4fa3;font-size:20px;line-height:1;box-shadow:0 4px 12px #0f2d6b29;transition:transform .2s,background .2s,color .2s}" +
    ".rc-ar:hover{background:#1e4fa3;color:#fff;transform:scale(1.08)}" +
    ".rc-dots{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:70%}" +
    ".rc-dot{width:9px;height:9px;padding:0;border:0;border-radius:99px;background:#c5d3ec;cursor:pointer;transition:width .4s,background .4s}" +
    ".rc-dot.on{width:26px;background:#2f63bd}" +
    ".rc-ov{position:fixed;inset:0;z-index:100010;background:#0a1634a8;backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".rc-box{background:#fff;border-radius:20px;max-width:460px;width:100%;padding:20px;box-shadow:0 30px 70px #00000059}" +
    ".rc-box h3{margin:0 0 10px;text-align:left;color:#0f2d6b}" +
    ".rc-pre{white-space:pre-wrap;word-break:break-word;background:#f3f7fd;border-radius:12px;padding:12px;font:13px/1.5 inherit;font-family:inherit;max-height:40vh;overflow:auto;margin:0 0 12px;color:#26365e;user-select:text}" +
    ".rc-shb{display:flex;gap:8px;flex-wrap:wrap}.rc-shb button{font:inherit;font-size:13px;font-weight:700;padding:9px 14px;border-radius:99px;border:1px solid #cbd5e1;background:#fff;color:#1e4fa3;cursor:pointer}" +
    ".rc-shb .wa{color:#15803d;border-color:#86efac}.rc-shb .tg{color:#0369a1;border-color:#7dd3fc}" +
    ".rc-x{width:100%;margin-top:12px;border:0;border-radius:12px;padding:11px;font:inherit;font-weight:700;background:#0f2d6b;color:#fff;cursor:pointer}" +
    "@media(max-width:700px){.rc-slide{flex-direction:column}.rc-cv{flex:none;min-height:0;height:150px}.rc-bd{padding:16px 16px 18px}.rc-opts{grid-template-columns:1fr}}" +
    "@media(prefers-reduced-motion:reduce){.rc-slide{transition:none}}";
  var st = document.createElement("style"); st.id = "dq-recommend-css"; st.textContent = CSS; document.head.appendChild(st);

  var KIND = { q: ["🎯 TÖVSİYƏ OLUNAN SUAL", ""], topic: ["📚 MÖVZU TESTİ", "g"], test: ["📝 TEST", "v"], exam: ["🏁 SINAQ", "g"] };

  function slideHTML(it, i) {
    var kt = KIND[it.type], body = "";
    var meta = '<div class="rc-meta"><span class="rc-k ' + kt[1] + '">' + esc(it.subject) + "</span>" + (it.topic ? "<span>" + esc(it.topic) + "</span>" : "") + "</div>";
    if (it.type === "q") {
      body = meta + '<div class="rc-q">' + esc(it.q.t) + "</div>" + (it.q.img ? '<img class="rc-qi" alt="" loading="lazy" src="' + esc(it.q.img) + '">' : "") +
        '<div class="rc-opts">' + it.q.o.map(function (o, k) { return '<button type="button" class="rc-opt" data-a="opt" data-k="' + k + '"><b>' + L[k] + "</b><span>" + esc(o) + "</span></button>"; }).join("") + "</div>" +
        '<div class="rc-exp"></div><div class="rc-act"><button type="button" class="rc-btn g" data-a="share">🔗 Paylaş</button></div>';
    } else if (it.type === "topic") {
      body = meta + "<h3>" + esc(it.topic) + '</h3><p class="rc-p">' + esc(it.subject) + " fənni üzrə mövzu testi: <b>" + it.n + " sual</b>, təxminən <b>" + it.time + " dəqiqə</b>. Vaxt bitəndə nəticə avtomatik yoxlanılır.</p>" +
        '<div class="rc-act"><button type="button" class="rc-btn p" data-a="topic">▶ Testə başla</button><button type="button" class="rc-btn g" data-a="share">🔗 Paylaş</button></div>';
    } else if (it.type === "test") {
      body = meta + "<h3>" + esc(it.test.title || "Test") + '</h3><p class="rc-p"><b>' + it.test.ans.length + " sual</b>. Cavabları işarələyin, nəticə dərhal yoxlanılır.</p>" +
        '<div class="rc-act"><button type="button" class="rc-btn p" data-a="test">▶ Testə başla</button><button type="button" class="rc-btn g" data-a="share">🔗 Paylaş</button></div>';
    } else {
      body = '<div class="rc-meta"><span class="rc-k g">Sınaq</span>' + it.cats.map(function (c) { return '<span class="rc-k">' + esc(c) + "</span>"; }).join("") + "</div><h3>" + esc(it.exam.title || "Sınaq") + '</h3><p class="rc-p">' +
        (it.cats.length ? "Kateqoriya: <b>" + esc(it.cats.join(", ")) + "</b>. " : "") + "Real imtahan formatında sınaqda iştirak edin.</p>" +
        '<div class="rc-act"><button type="button" class="rc-btn p" data-a="exam">Sınağa bax</button><button type="button" class="rc-btn g" data-a="share">🔗 Paylaş</button></div>';
    }
    return '<article class="rc-slide' + (i === S.cur ? " on" : "") + '" data-i="' + i + '" aria-hidden="' + (i !== S.cur) + '"><div class="rc-cv"><span class="rc-tag">' + kt[0] + '</span><img alt="" loading="' + (i < 2 ? "eager" : "lazy") + '" decoding="async" src="' + esc(it.cover) + '"><span class="rc-subj">' + esc(it.subject) + '</span></div><div class="rc-bd">' + body + "</div></article>";
  }

  var sig = "";
  function render() {
    var host = $("rc-home");
    if (!S.cfg.on || !S.items.length) { if (host) host.remove(); sig = ""; return; }
    var s = S.items.map(function (x) { return x.id; }).join("~") + "|" + S.covers.length;
    if (!host) { host = document.createElement("section"); host.id = "rc-home"; host.setAttribute("aria-label", "Tövsiyə olunanlar"); sig = ""; }
    place(host);
    if (s === sig && host.querySelector(".rc-card")) return;
    sig = s;
    host.innerHTML = '<h2 class="rc-title">🎯 Sizin üçün tövsiyə</h2><span class="rc-sub"></span><div class="rc-card" role="region" aria-roledescription="carousel"><div class="rc-stage">' +
      S.items.map(slideHTML).join("") + '</div><div class="rc-bar"><i></i></div></div><div class="rc-ctl"><button class="rc-ar" data-a="prev" aria-label="Əvvəlki">‹</button><div class="rc-dots">' +
      S.items.map(function (_, i) { return '<button class="rc-dot' + (i === S.cur ? " on" : "") + '" data-a="go" data-i="' + i + '" aria-label="' + (i + 1) + '"></button>'; }).join("") + '</div><button class="rc-ar" data-a="next" aria-label="Növbəti">›</button></div>';
    S.t0 = Date.now();
    Object.keys(S.ans).forEach(function (id) { var i = idxOf(id); if (i > -1) paintAns(i); });
  }

  function place(host) {
    var home = $("v3-home"); if (!home) return;
    var ref = $("yq-news") || $("dq-stats") || home.querySelector(".v3-ft");
    if (!ref || !ref.parentNode) return;
    if (host.parentNode !== ref.parentNode || host.nextElementSibling !== ref) ref.parentNode.insertBefore(host, ref);
  }

  function idxOf(id) { for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return i; return -1; }

  function show(i) {
    var host = $("rc-home"); if (!host || !S.items.length) return;
    S.cur = (i + S.items.length) % S.items.length; S.t0 = Date.now();
    host.querySelectorAll(".rc-slide").forEach(function (s) { var on = +s.dataset.i === S.cur; s.classList.toggle("on", on); s.setAttribute("aria-hidden", String(!on)); });
    host.querySelectorAll(".rc-dot").forEach(function (d) { d.classList.toggle("on", +d.dataset.i === S.cur); });
  }

  function paintAns(i) {
    var it = S.items[i], host = $("rc-home"), a = it && S.ans[it.id];
    if (!host || a == null) return;
    var sl = host.querySelector('.rc-slide[data-i="' + i + '"]'); if (!sl) return;
    sl.querySelectorAll(".rc-opt").forEach(function (b) {
      var k = +b.dataset.k; b.disabled = true;
      if (k === it.q.c) b.classList.add("ok"); else if (k === a) b.classList.add("no");
    });
    var ex = sl.querySelector(".rc-exp");
    if (ex) {
      ex.classList.add("on");
      ex.innerHTML = (a === it.q.c ? "✅ <b>Düzgün!</b> " : "❌ <b>Yanlış.</b> Düzgün cavab: <b>" + L[it.q.c] + ") " + esc(it.q.o[it.q.c]) + "</b>. ") + (it.q.e ? "<br>" + esc(it.q.e) : "");
    }
  }

  function bind() {
    var host = $("rc-home"); if (!host || host.__b) return; host.__b = 1;
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a, it = S.items[S.cur];
      if (a === "prev") show(S.cur - 1);
      else if (a === "next") show(S.cur + 1);
      else if (a === "go") show(+b.dataset.i);
      else if (a === "opt" && it && it.type === "q" && S.ans[it.id] == null) { S.ans[it.id] = +b.dataset.k; paintAns(S.cur); S.hold = Date.now() + 15000; }
      else if (a === "share" && it) share(it);
      else if (a === "topic" && it) { if (window.TLX && TLX.begin) TLX.begin(it.subject, it.topic); else toast("Test hazırda açıla bilmir"); }
      else if (a === "test" && it) { if (window.DT && DT.start) DT.start(it.test._id); else toast("Test hazırda açıla bilmir"); }
      else if (a === "exam") { var t = document.querySelector("#v3-home .lx-card,#v3-home #dt-grid,#v3-home .dq2-top"); t ? t.scrollIntoView({ behavior: "smooth", block: "center" }) : window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
    host.addEventListener("mouseenter", function () { S.hover = true; });
    host.addEventListener("mouseleave", function () { S.hover = false; S.t0 = Date.now(); });
    host.addEventListener("touchstart", function () { S.hold = Date.now() + 9000; }, { passive: true });
    host.addEventListener("focusin", function () { S.hold = Date.now() + 9000; });
    var sx = 0;
    host.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    host.addEventListener("touchend", function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 55) show(S.cur + (dx < 0 ? 1 : -1)); }, { passive: true });
  }

  /* avtomatik fırlanma */
  setInterval(function () {
    var host = $("rc-home"); if (!host || document.hidden || S.items.length < 2) return;
    var bar = host.querySelector(".rc-bar i"), dur = Math.max(4, +S.cfg.sec || 11) * 1000;
    if (S.hover || Date.now() < S.hold || host.querySelector(".rc-ov")) { S.t0 = Date.now() - (bar ? (parseFloat(bar.style.width) || 0) / 100 * dur : 0); return; }
    var p = (Date.now() - S.t0) / dur;
    if (bar) bar.style.width = Math.min(100, p * 100) + "%";
    if (p >= 1) show(S.cur + 1);
  }, 100);

  /* ?rec=ID — paylaşılan keçid */
  function deep() {
    if (S.deep) return; var id = null;
    try { id = new URL(location.href).searchParams.get("rec"); } catch (e) { }
    if (!id) { S.deep = true; return; }
    var i = idxOf(id);
    if (i < 0) {
      /* paylaşılan sual bu günkü siyahıda yoxdursa, onu əvvələ əlavə et */
      var P = pool(), q = null, sd = null;
      P.forEach(function (s) { s.qs.forEach(function (x) { if (x.id === id) { q = x; sd = s; } }); });
      if (!q) { S.deep = true; return; }
      S.items.unshift({ id: q.id, type: "q", subject: sd.name, topic: q.topic, q: q, cover: coverFor(sd.name, q.id, sd, "🎯") });
      sig = ""; S.cur = 0; render(); bind();
    } else { S.cur = i; sig = ""; render(); bind(); }
    S.deep = true;
    setTimeout(function () { var h = $("rc-home"); h && h.scrollIntoView({ behavior: "smooth", block: "center" }); }, 400);
  }

  async function refresh() { await load(); build(); render(); bind(); deep(); }

  function start() {
    var n = 0, iv = setInterval(function () {
      if ($("v3-home") && window.V2 && V2.list) { clearInterval(iv); refresh(); setInterval(refresh, 5 * 60 * 1000); }
      else if (++n > 200) clearInterval(iv);
    }, 250);
    setInterval(function () { var h = $("rc-home"); if (h) place(h); installAdmin(); }, 800);
  }

  /* ================= ADMIN MODULU ================= */
  var ACSS = "" +
    "#rc-ad{position:fixed;inset:0;z-index:100000;background:#f3f7fd;overflow:auto;display:none;font-family:Roboto,Arial,sans-serif;color:#12285e;text-align:left}" +
    ".rca-top{background:linear-gradient(90deg,#0a2f7a,#2f63bd);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:5}" +
    ".rca-top b{font-size:18px;flex:1}.rca-top button{border:0;border-radius:999px;background:#ffffff2e;color:#fff;font-weight:700;padding:8px 14px;cursor:pointer;font-family:inherit}" +
    ".rca-tabs{display:flex;gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid #dbe5f6;overflow-x:auto;position:sticky;top:52px;z-index:4}" +
    ".rca-tab{border:1.5px solid #c9d6ee;background:#fff;color:#0a2f7a;border-radius:999px;padding:8px 16px;font-weight:700;font-size:13px;white-space:nowrap;cursor:pointer;font-family:inherit}" +
    ".rca-tab.on{background:#0a2f7a;border-color:#0a2f7a;color:#fff}" +
    ".rca-w{max-width:980px;margin:0 auto;padding:16px 14px 60px}" +
    ".rca-c{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 2px 10px #0f286414}" +
    ".rca-c h3{margin:0 0 10px;text-align:left;font-size:16px;color:#0a2f7a}" +
    ".rca-c label{display:block;font-weight:700;font-size:13px;margin:10px 0 4px}" +
    ".rca-in,.rca-ta,.rca-se{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #c9d6ee;border-radius:10px;font:inherit;font-size:14.5px;background:#fff;user-select:text}" +
    ".rca-ta{min-height:84px;resize:vertical}" +
    ".rca-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:640px){.rca-g2{grid-template-columns:1fr}}" +
    ".rca-o{display:flex;align-items:center;gap:8px;margin:6px 0}.rca-o b{width:22px;text-align:center}.rca-o input[type=radio]{width:20px;height:20px;accent-color:#16a34a;flex:none}" +
    ".rca-b{border:0;border-radius:10px;background:#2f63bd;color:#fff;font-weight:700;padding:10px 16px;cursor:pointer;font-family:inherit;margin:10px 8px 0 0}" +
    ".rca-b.o{background:#e2e8f0;color:#12285e}.rca-b.x{background:#dc2626}.rca-b.s{padding:6px 10px;margin:0 4px 0 0;font-size:12.5px}" +
    ".rca-st{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.rca-st div{background:#eaf1fc;border-radius:12px;padding:10px 16px;text-align:center;font-size:12.5px}.rca-st b{display:block;font-size:22px;color:#0a2f7a}" +
    ".rca-r{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0}.rca-r:last-child{border:0}.rca-r>div{flex:1;min-width:0}.rca-r small{color:#64748b}" +
    ".rca-r .q{font-weight:700;font-size:14px;word-break:break-word}.rca-off{opacity:.5}" +
    ".rca-cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}" +
    ".rca-cv{position:relative;border-radius:12px;overflow:hidden;border:1px solid #dbe5f6;background:#f8fafc}.rca-cv img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block}.rca-cv div{padding:6px 8px;font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:6px;align-items:center}" +
    ".rca-hint{font-size:12.5px;color:#64748b;line-height:1.55;margin-top:6px}" +
    ".rca-msg{margin-top:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;display:none}.rca-msg.ok{display:block;background:#dcfce7;color:#166534}.rca-msg.er{display:block;background:#fee2e2;color:#991b1b}" +
    ".rca-chk{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;margin:8px 0}.rca-chk input{width:18px;height:18px}";
  var ast = document.createElement("style"); ast.id = "dq-recommend-admin-css"; ast.textContent = ACSS; document.head.appendChild(ast);

  var A = { tab: "bank", edit: null, q: "", f: "" };

  function installAdmin() {
    var g = document.querySelector("#admin-panel .admin-nav-grid");
    if (!g || $("rc-card")) return;
    var d = document.createElement("div"); d.id = "rc-card"; d.className = "admin-nav-card"; d.style.cssText = "background:#0a2f7a;color:#fff";
    d.onclick = openAdmin; d.innerHTML = '<span class="icon">🎯</span> Tövsiyə / Sual bankı'; g.appendChild(d);
  }
  function subjectNames() {
    var m = {}; (S.cat || []).forEach(function (s) { if (s && s.name) m[s.name] = 1; }); (S.bank || []).forEach(function (b) { if (b.subject) m[b.subject] = 1; });
    return Object.keys(m);
  }
  async function openAdmin() {
    var el = $("rc-ad"); if (!el) { el = document.createElement("div"); el.id = "rc-ad"; document.body.appendChild(el); }
    el.style.display = "block"; el.scrollTop = 0; document.body.style.overflow = "hidden";
    el.innerHTML = '<div class="rca-w">Yüklənir…</div>';
    await load(); adminDraw();
  }
  function closeAdmin() { var el = $("rc-ad"); if (el) el.style.display = "none"; document.body.style.overflow = ""; build(); sig = ""; render(); bind(); }

  function adminDraw() {
    var el = $("rc-ad"); if (!el) return;
    var tabs = [["bank", "🏦 Sual bankı"], ["cov", "🖼 Qapaq şəkilləri"], ["cfg", "⚙️ Ayarlar"]];
    el.innerHTML = '<div class="rca-top"><b>🎯 Tövsiyə sistemi</b><button type="button" id="rca-close">✕ Bağla</button></div><div class="rca-tabs">' +
      tabs.map(function (t) { return '<button type="button" class="rca-tab' + (A.tab === t[0] ? " on" : "") + '" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") + '</div><div class="rca-w" id="rca-body"></div>';
    $("rca-close").onclick = closeAdmin;
    el.querySelectorAll(".rca-tab").forEach(function (b) { b.onclick = function () { A.tab = b.dataset.t; A.edit = null; adminDraw(); }; });
    if (A.tab === "bank") drawBank(); else if (A.tab === "cov") drawCov(); else drawCfg();
  }
  function msg(t, ok) { var m = $("rca-m"); if (m) { m.className = "rca-msg " + (ok ? "ok" : "er"); m.textContent = t; } else toast(t); }

  /* ----- Sual bankı ----- */
  function drawBank() {
    var b = $("rca-body"), e = A.edit != null ? S.bank.filter(function (x) { return x._id == A.edit; })[0] : null;
    var opts = (e && e.o) || ["", "", "", ""]; while (opts.length < 4) opts.push("");
    var subs = subjectNames();
    var total = S.bank.length, act = S.bank.filter(function (x) { return x.on !== false; }).length;
    var catN = 0; (S.cat || []).forEach(function (s) { (s.topics || []).forEach(function (t) { catN += (t.qs || []).filter(validQ).length; }); });
    var bySub = {}; S.bank.forEach(function (x) { bySub[x.subject || "Digər"] = (bySub[x.subject || "Digər"] || 0) + 1; });
    var list = S.bank.filter(function (x) {
      return (!A.f || x.subject === A.f) && (!A.q || low(x.t + " " + x.subject + " " + x.topic).indexOf(low(A.q)) > -1);
    });
    b.innerHTML =
      '<div class="rca-st"><div><b>' + total + "</b>Bankda sual</div><div><b>" + act + "</b>Aktiv</div><div><b>" + catN + "</b>Karusel kataloqunda</div><div><b>" + Object.keys(bySub).length + "</b>Fənn</div></div>" +
      '<div class="rca-c"><h3>' + (e ? "✏️ Sualı redaktə et" : "➕ Yeni sual") + '</h3><div class="rca-g2"><div><label>Fənn *</label><input class="rca-in" id="rb-s" list="rb-sl" value="' + esc(e ? e.subject : A.f) + '" placeholder="məs. Məntiq"><datalist id="rb-sl">' + subs.map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + '</datalist></div>' +
      '<div><label>Mövzu (ixtiyari)</label><input class="rca-in" id="rb-t" value="' + esc(e ? e.topic : "") + '" placeholder="məs. Verbal məntiq"></div></div>' +
      '<label>Sual *</label><textarea class="rca-ta" id="rb-q">' + esc(e ? e.t : "") + "</textarea><label>Variantlar (ən azı 2) — düzgün olanı seçin *</label>" +
      opts.map(function (o, i) { return '<div class="rca-o"><b>' + L[i] + '</b><input type="radio" name="rb-c" value="' + i + '"' + (e && e.c === i ? " checked" : "") + '><input class="rca-in" data-o="' + i + '" value="' + esc(o) + '" placeholder="' + L[i] + ' variantı"></div>'; }).join("") +
      '<div class="rca-o"><b></b><button type="button" class="rca-b o s" id="rb-more">+ Variant əlavə et</button></div>' +
      '<label>İzah (ixtiyari — cavab seçiləndən sonra göstərilir)</label><textarea class="rca-ta" id="rb-e" style="min-height:60px">' + esc(e ? e.e : "") + "</textarea>" +
      '<label class="rca-chk"><input type="checkbox" id="rb-on"' + (!e || e.on !== false ? " checked" : "") + '> Tövsiyələrdə göstərilsin</label>' +
      '<button type="button" class="rca-b" id="rb-save">' + (e ? "Yadda saxla" : "Əlavə et") + "</button>" + (e ? '<button type="button" class="rca-b o" id="rb-cancel">Ləğv et</button>' : "") +
      '<div class="rca-msg" id="rca-m"></div></div>' +
      '<div class="rca-c"><details><summary style="font-weight:700;cursor:pointer;color:#0a2f7a">📥 Toplu əlavə (hər sətir bir sual)</summary>' +
      '<div class="rca-hint">Format: <b>Fənn | Mövzu | Sual | variant1 ; variant2 ; variant3 ; variant4 | Düzgün hərf | İzah</b><br>Nümunə: <code>Məntiq | Verbal məntiq | 2+2 neçədir? | 3 ; 4 ; 5 ; 6 | B | 2+2=4</code></div>' +
      '<textarea class="rca-ta" id="rb-bulk" style="min-height:120px" placeholder="Məntiq | Verbal məntiq | 2+2 neçədir? | 3 ; 4 ; 5 ; 6 | B | 2+2=4"></textarea><button type="button" class="rca-b" id="rb-imp">Toplu əlavə et</button></details></div>' +
      '<div class="rca-c"><h3>📚 Bankdakı suallar</h3><div class="rca-g2"><input class="rca-in" id="rb-find" placeholder="Axtar…" value="' + esc(A.q) + '"><select class="rca-se" id="rb-flt"><option value="">Bütün fənlər</option>' +
      Object.keys(bySub).map(function (s) { return '<option value="' + esc(s) + '"' + (A.f === s ? " selected" : "") + ">" + esc(s) + " (" + bySub[s] + ")</option>"; }).join("") + "</select></div>" +
      (list.length ? list.slice(0, 150).map(function (x) {
        return '<div class="rca-r' + (x.on === false ? " rca-off" : "") + '"><div><div class="q">' + esc(x.t) + "</div><small>" + esc(x.subject) + (x.topic ? " · " + esc(x.topic) : "") + " · düzgün: " + L[x.c] + ") " + esc((x.o || [])[x.c] || "") + '</small></div><div style="white-space:nowrap;flex:none"><button class="rca-b o s" data-a="tg" data-id="' + x._id + '">' + (x.on === false ? "Aç" : "Gizlət") + '</button><button class="rca-b s" data-a="ed" data-id="' + x._id + '">✏️</button><button class="rca-b x s" data-a="rm" data-id="' + x._id + '">🗑</button></div></div>';
      }).join("") + (list.length > 150 ? '<div class="rca-hint">Yalnız ilk 150 sual göstərilir — axtarışdan istifadə edin.</div>' : "") : '<div class="rca-hint">Bankda hələ sual yoxdur.</div>') + "</div>";

    var extra = 0;
    $("rb-more").onclick = function () {
      var n = b.querySelectorAll("[data-o]").length; if (n >= 6) return;
      var row = document.createElement("div"); row.className = "rca-o";
      row.innerHTML = "<b>" + L[n] + '</b><input type="radio" name="rb-c" value="' + n + '"><input class="rca-in" data-o="' + n + '" placeholder="' + L[n] + ' variantı">';
      $("rb-more").parentNode.before(row);
    };
    $("rb-save").onclick = saveQ;
    if ($("rb-cancel")) $("rb-cancel").onclick = function () { A.edit = null; drawBank(); };
    $("rb-imp").onclick = importQ;
    $("rb-find").oninput = function () { A.q = this.value; var p = this.selectionStart; drawBank(); var f = $("rb-find"); f.focus(); try { f.setSelectionRange(p, p); } catch (x) { } };
    $("rb-flt").onchange = function () { A.f = this.value; drawBank(); };
    b.querySelectorAll("[data-a]").forEach(function (x) {
      x.onclick = async function () {
        var id = x.dataset.id, a = x.dataset.a, r = S.bank.filter(function (q) { return q._id == id; })[0];
        if (a === "ed") { A.edit = id; drawBank(); $("rca-body").scrollIntoView({ block: "start" }); document.getElementById("rc-ad").scrollTop = 0; }
        else if (a === "rm") { if (!confirm("Bu sual silinsin?")) return; await V2.del(COL.bank, id); S.bank = await safe(COL.bank); drawBank(); }
        else if (a === "tg" && r) { var o = Object.assign({}, r); delete o._id; o.on = r.on === false; await V2.put(COL.bank, o, id); S.bank = await safe(COL.bank); drawBank(); }
      };
    });
  }
  async function saveQ() {
    var s = $("rb-s").value.trim(), t = $("rb-q").value.trim(), o = [], c = -1;
    var rad = document.querySelector('input[name="rb-c"]:checked');
    document.querySelectorAll("#rca-body [data-o]").forEach(function (i) { o.push(i.value.trim()); });
    /* boş variantları at, düzgün cavabın indeksini yenidən hesabla */
    var chosen = rad ? +rad.value : -1, o2 = [], map = {};
    o.forEach(function (x, i) { if (x) { map[i] = o2.length; o2.push(x); } });
    c = chosen in map ? map[chosen] : -1;
    if (!s) return msg("Fənn adını yazın.");
    if (!t) return msg("Sualın mətnini yazın.");
    if (o2.length < 2) return msg("Ən azı 2 variant yazın.");
    if (c < 0) return msg("Düzgün variantı seçin (boş olmayan).");
    var obj = { subject: s, topic: $("rb-t").value.trim(), t: t, o: o2, c: c, e: $("rb-e").value.trim(), on: $("rb-on").checked, added: new Date().toISOString() };
    if (A.edit != null) { var old = S.bank.filter(function (x) { return x._id == A.edit; })[0]; if (old && old.added) obj.added = old.added; }
    await V2.put(COL.bank, obj, A.edit != null ? A.edit : undefined);
    toast(A.edit != null ? "Yeniləndi ✅" : "Əlavə olundu ✅"); A.edit = null; A.f = s; S.bank = await safe(COL.bank); drawBank();
  }
  async function importQ() {
    var lines = $("rb-bulk").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean), ok = 0, bad = [];
    for (var n = 0; n < lines.length; n++) {
      var p = lines[n].split("|").map(function (x) { return x.trim(); });
      if (p.length < 5) { bad.push(n + 1); continue; }
      var opts = p[3].split(";").map(function (x) { return x.trim(); }).filter(Boolean), ci = L.indexOf((p[4] || "").toUpperCase().charAt(0));
      if (!p[0] || !p[2] || opts.length < 2 || opts.length > 6 || ci < 0 || ci >= opts.length) { bad.push(n + 1); continue; }
      await V2.put(COL.bank, { subject: p[0], topic: p[1], t: p[2], o: opts, c: ci, e: p[5] || "", on: true, added: new Date().toISOString() }); ok++;
    }
    S.bank = await safe(COL.bank); drawBank();
    msg(ok + " sual əlavə olundu" + (bad.length ? ". Format xətası olan sətirlər: " + bad.join(", ") : "") + ".", !bad.length);
  }

  /* ----- Qapaq şəkilləri ----- */
  function resize(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error("decode")); };
      im.onload = function () {
        try {
          var nw = im.naturalWidth, nh = im.naturalHeight, k = Math.min(1, 1100 / Math.max(nw, nh)), q = .85, d = "";
          for (var i = 0; i < 6; i++) {
            var w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k)), c = document.createElement("canvas"); c.width = w; c.height = h;
            var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
            d = c.toDataURL("image/jpeg", q); if (d.length < 380000) break; q = Math.max(.6, q - .08); k *= .85;
          }
          URL.revokeObjectURL(url); ok(d);
        } catch (e) { URL.revokeObjectURL(url); no(e); }
      };
      im.src = url;
    });
  }
  function drawCov() {
    var b = $("rca-body"), subs = subjectNames().concat(["Sınaq", "Test"]).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var by = {}; S.covers.forEach(function (c) { (by[c.subject] = by[c.subject] || []).push(c); });
    b.innerHTML = '<div class="rca-c"><h3>🖼 Fənnə aid qapaq şəkli əlavə et</h3><div class="rca-hint">Hər fənn üçün bir neçə şəkil əlavə edə bilərsiniz — hər sual üçün onlardan biri avtomatik seçilir. Şəkil əlavə olunmayan fənlər üçün sistem özü gözəl qapaq yaradır. <b>Sınaq</b> və <b>Test</b> — həmin tövsiyə növləri üçün ümumi qapaqdır.</div>' +
      '<div class="rca-g2"><div><label>Fənn *</label><input class="rca-in" id="rv-s" list="rv-sl" placeholder="məs. Məntiq"><datalist id="rv-sl">' + subs.map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + '</datalist></div>' +
      '<div><label>Şəkil (JPG / PNG / WEBP)</label><input class="rca-in" type="file" id="rv-f" accept="image/*" multiple></div></div><div class="rca-msg" id="rca-m"></div></div>' +
      Object.keys(by).sort().map(function (s) {
        return '<div class="rca-c"><h3>' + esc(s) + ' <small style="color:#64748b">(' + by[s].length + ')</small></h3><div class="rca-cg">' + by[s].map(function (c) {
          return '<div class="rca-cv"><img alt="" src="' + esc(c.img) + '"><div><span>' + esc(c.name || "") + '</span><button class="rca-b x s" data-id="' + c._id + '">🗑</button></div></div>';
        }).join("") + "</div></div>";
      }).join("") || '<div class="rca-c rca-hint">Hələ qapaq şəkli əlavə olunmayıb.</div>';
    $("rv-f").onchange = async function () {
      var s = $("rv-s").value.trim(), fs = Array.prototype.slice.call(this.files || []);
      if (!s) { this.value = ""; return msg("Əvvəlcə fənn adını yazın."); }
      var n = 0;
      for (var i = 0; i < fs.length; i++) {
        try { var img = await resize(fs[i]); await V2.put(COL.cov, { subject: s, img: img, name: (fs[i].name || "").replace(/\.[^.]+$/, "").slice(0, 24) }); n++; }
        catch (e) { msg("«" + fs[i].name + "» oxunmadı (HEIC dəstəklənmir)."); }
      }
      this.value = ""; if (n) { toast(n + " şəkil əlavə olundu ✅"); S.covers = await safe(COL.cov); drawCov(); }
    };
    b.querySelectorAll("button[data-id]").forEach(function (x) {
      x.onclick = async function () { if (!confirm("Şəkil silinsin?")) return; await V2.del(COL.cov, x.dataset.id); S.covers = await safe(COL.cov); drawCov(); };
    });
  }

  /* ----- Ayarlar ----- */
  function drawCfg() {
    var c = S.cfg, b = $("rca-body");
    function chk(id, v, t) { return '<label class="rca-chk"><input type="checkbox" id="' + id + '"' + (v ? " checked" : "") + "> " + t + "</label>"; }
    b.innerHTML = '<div class="rca-c"><h3>⚙️ Tövsiyə panelinin ayarları</h3>' + chk("rg-on", c.on, "Panel ana səhifədə göstərilsin") +
      '<div class="rca-g2"><div><label>Fırlanma sürəti (saniyə)</label><input class="rca-in" type="number" min="4" max="60" id="rg-sec" value="' + (+c.sec || 11) + '"></div>' +
      '<div><label>Hər fənndən sual sayı (1–3)</label><input class="rca-in" type="number" min="1" max="3" id="rg-per" value="' + (+c.perSubject || 2) + '"></div>' +
      '<div><label>Maksimum kart sayı</label><input class="rca-in" type="number" min="3" max="30" id="rg-max" value="' + (+c.max || 14) + '"></div></div>' +
      chk("rg-cat", c.catalogue, "Suallar «🎠 Karusel» kataloqundan da götürülsün (bankla birlikdə)") + chk("rg-top", c.topics, "Mövzu testləri tövsiyə olunsun") +
      chk("rg-tst", c.tests, "Testlər tövsiyə olunsun") + chk("rg-exm", c.exams, "Sınaq kateqoriyaları tövsiyə olunsun") +
      '<div class="rca-hint">Tövsiyələr hər gün avtomatik yenilənir (hamı üçün eyni, gündən-günə fərqli). Suallar bankdan və kataloqdan fənn üzrə təsadüfi seçilir.</div>' +
      '<button type="button" class="rca-b" id="rg-save">Yadda saxla</button><div class="rca-msg" id="rca-m"></div></div>';
    $("rg-save").onclick = async function () {
      var o = { on: $("rg-on").checked, sec: Math.max(4, Math.min(60, +$("rg-sec").value || 11)), perSubject: Math.max(1, Math.min(3, +$("rg-per").value || 2)), max: Math.max(3, Math.min(30, +$("rg-max").value || 14)),
        catalogue: $("rg-cat").checked, topics: $("rg-top").checked, tests: $("rg-tst").checked, exams: $("rg-exm").checked };
      await V2.put(COL.cfg, o, S.cfgId || undefined);
      var r = await safe(COL.cfg); S.cfgId = r[0] ? r[0]._id : null; S.cfg = Object.assign({}, DEF, o);
      msg("Saxlanıldı ✅", true); toast("Saxlanıldı ✅");
    };
  }

  window.RC = { refresh: refresh, openAdmin: openAdmin, state: S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
