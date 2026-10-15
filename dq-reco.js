/* DQ Platform — dq-reco.js (v1)
   ▸ Ana səhifənin sonunda avtomatik "🎯 Tövsiyə olunanlar" paneli (Yeniliklər bölməsini əvəz edir):
       sol: fənnə aid qapaq şəkli · sağ: tövsiyə sual (variantlarla, seçib yoxlamaq olur) / mövzu testi / sınaq kateqoriyası
       özü fırlanır, paylaşmaq olur; testlərdəki suallardan + admin "Sual bankı"ndan təsadüfi götürür.
   ▸ Admin (V2) paneldə yeni bölmə: "🎯 Tövsiyə Paneli" → Qapaq şəkilləri · Sual bankı · Parametrlər
   ▸ "Dövlət qulluğu hədəfinə doğru ilk addımı at!" bloku daxil olmuş istifadəçidə gizlənir.
   Qoşulma (index.html, dq-home2.js-dən sonra):  <script src="dq-reco.js?v=1"></script>  */
(function () {
  "use strict";
  if (window.__dqReco) return;
  window.__dqReco = 1;

  var SB_URL = "https://cpzwliqlgaplroscvduo.supabase.co";
  var SB_KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
  var LET = ["A", "B", "C", "D", "E"];
  var MAX_SLIDES = 12;
  var DEF = { sec: 9, per: 2, topics: 1, exams: 1, bank: 1 };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* =====================================================================
     1) ÜMUMİ: verilənlər
     ===================================================================== */
  async function rawList(c) {
    var u = SB_URL + "/rest/v1/dq_v2_store?select=*&collection=eq." + encodeURIComponent(c) + "&order=id.desc&limit=1000";
    var r = await fetch(u, { headers: { apikey: SB_KEY } });
    if (!r.ok) throw new Error("http " + r.status);
    return (await r.json()).map(function (x) { return Object.assign({}, x.data, { _id: x.id }); });
  }
  async function list(c) {
    try { if (typeof V2 !== "undefined" && V2 && V2.list) return await V2.list(c); } catch (e) { }
    try { return await rawList(c); } catch (e) { return []; }
  }
  function validQ(q) {
    return q && typeof q.t === "string" && q.t.trim() && Array.isArray(q.o) && q.o.length >= 2 && q.o.length <= 5 &&
      q.o.every(function (x) { return String(x).trim(); }) && Number.isInteger(q.c) && q.c >= 0 && q.c < q.o.length;
  }
  function pool() { try { return (window.TLX && TLX.pool && TLX.pool()) || []; } catch (e) { return []; } }

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }

  async function loadExams() {
    try {
      var u = SB_URL + "/rest/v1/exam_questions?select=exam_id,category&q_number=eq.1&limit=500";
      var r = await fetch(u, { headers: { apikey: SB_KEY } });
      if (!r.ok) return [];
      var seen = {}, out = [];
      (await r.json()).forEach(function (x) {
        var k = x.exam_id + "|" + String(x.category || "").toUpperCase();
        if (!seen[k] && x.exam_id && x.category) { seen[k] = 1; out.push({ exam: x.exam_id, cat: String(x.category).toUpperCase() }); }
      });
      return out;
    } catch (e) { return []; }
  }

  /* =====================================================================
     2) PANEL (ana səhifə)
     ===================================================================== */
  var css =
    "#v3-home #yq-news{display:none!important}" +
    ".dq-hn-cta-off{display:none!important}" +
    "#dq-reco{max-width:1020px;margin:30px auto 26px;padding:0 14px;font-family:inherit}" +
    ".dqr-h{text-align:center;margin-bottom:14px}.dqr-h h2{margin:0;font-size:26px;font-weight:800;color:#0a2f7a;letter-spacing:-.2px}" +
    ".dqr-h p{margin:4px 0 0;font-size:13.5px;color:#64748b}.dqr-h i{display:block;width:64px;height:3px;border-radius:3px;margin:9px auto 0;background:linear-gradient(90deg,#1f4aa8,#e9b43c)}" +
    ".dqr-st{position:relative;border-radius:22px;background:#f3f5fb;box-shadow:0 14px 38px rgba(10,47,122,.16);overflow:hidden;border-top:3px solid #1f4aa8}" +
    ".dqr-g{display:grid}.dqr-s{grid-area:1/1;display:flex;min-height:330px;opacity:0;visibility:hidden;transform:translateX(18px);transition:opacity .5s,transform .5s,visibility 0s .5s}" +
    ".dqr-s.on{opacity:1;visibility:visible;transform:none;transition-delay:0s}" +
    ".dqr-cv{position:relative;flex:0 0 38%;min-height:240px;background-size:cover;background-position:center;overflow:hidden;display:flex;align-items:flex-end}" +
    ".dqr-cv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 6s ease}.dqr-s.on .dqr-cv img{transform:scale(1.07)}" +
    ".dqr-cv:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.55))}" +
    ".dqr-ic{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:84px;opacity:.9;filter:drop-shadow(0 8px 18px rgba(0,0,0,.3))}" +
    ".dqr-bg{position:relative;z-index:2;margin:0 0 14px 14px;padding:6px 12px;border-radius:99px;background:rgba(255,255,255,.95);color:#0a2f7a;font-size:12.5px;font-weight:800;box-shadow:0 4px 14px rgba(0,0,0,.2)}" +
    ".dqr-bd{flex:1;min-width:0;padding:20px 22px;display:flex;flex-direction:column;justify-content:center;gap:10px}" +
    ".dqr-m{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.dqr-k{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:99px;background:#dbe5fb;color:#0a2f7a;letter-spacing:.3px}" +
    ".dqr-k.g{background:#fff1c7;color:#7a5200}.dqr-k.r{background:#dcfce7;color:#14532d}.dqr-t{font-size:12px;color:#64748b}" +
    ".dqr-q{margin:0;font-size:17.5px;line-height:1.4;font-weight:700;color:#0f1f4b}.dqr-p{margin:0;font-size:14px;color:#475569;line-height:1.5}" +
    ".dqr-os{display:grid;gap:7px}.dqr-o{display:flex;gap:10px;align-items:center;text-align:left;width:100%;border:1.5px solid #d4dcef;background:#fff;border-radius:12px;padding:9px 12px;font-size:14px;color:#1e293b;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,transform .1s}" +
    ".dqr-o b{flex:0 0 26px;height:26px;border-radius:50%;background:#e8eefc;color:#1f4aa8;display:flex;align-items:center;justify-content:center;font-size:12.5px}" +
    ".dqr-o:hover{border-color:#1f4aa8}.dqr-o:active{transform:scale(.99)}.dqr-s.done .dqr-o{cursor:default}" +
    ".dqr-o.ok{border-color:#16a34a;background:#e9fbef}.dqr-o.ok b{background:#16a34a;color:#fff}.dqr-o.no{border-color:#dc2626;background:#fdecec}.dqr-o.no b{background:#dc2626;color:#fff}" +
    ".dqr-fb{display:none;font-size:13.5px;line-height:1.45;padding:9px 12px;border-radius:10px;background:#eef2ff;color:#1e3a8a}.dqr-s.done .dqr-fb{display:block}.dqr-fb.y{background:#e9fbef;color:#14532d}.dqr-fb.n{background:#fdecec;color:#7f1d1d}" +
    ".dqr-a{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}.dqr-b{border:0;border-radius:99px;padding:9px 16px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#1f4aa8;color:#fff;box-shadow:0 6px 16px rgba(31,74,168,.3)}" +
    ".dqr-b.g{background:#e3e9f7;color:#1f3a7a;box-shadow:none}.dqr-b.y{background:#e9b43c;color:#2b1d00;box-shadow:0 6px 16px rgba(233,180,60,.35)}" +
    ".dqr-c{display:flex;justify-content:center;align-items:center;gap:10px;padding:10px 0 12px}.dqr-ar{width:32px;height:32px;border-radius:50%;border:0;background:#fff;color:#1f4aa8;font-size:18px;cursor:pointer;box-shadow:0 3px 10px rgba(10,47,122,.18)}" +
    ".dqr-d{display:flex;gap:6px;align-items:center}.dqr-d i{width:7px;height:7px;border-radius:7px;background:#b7c3e2;cursor:pointer;transition:all .3s}.dqr-d i.on{width:26px;background:#1f4aa8}" +
    ".dqr-pg{position:absolute;left:0;top:0;height:3px;width:0;background:linear-gradient(90deg,#e9b43c,#1f4aa8);z-index:5}.dqr-pg.run{animation:dqrP linear forwards}@keyframes dqrP{to{width:100%}}" +
    "@media(max-width:700px){.dqr-s{flex-direction:column;min-height:0}.dqr-cv{flex:none;min-height:0;height:150px}.dqr-ic{font-size:60px}.dqr-bd{padding:16px 16px 12px}.dqr-q{font-size:16px}.dqr-h h2{font-size:22px}}" +
    "@media(prefers-reduced-motion:reduce){.dqr-s,.dqr-cv img{transition:none!important}.dqr-pg.run{animation:none}}";
  var st = document.createElement("style"); st.id = "dq-reco-css"; st.textContent = css; document.head.appendChild(st);

  var S = { items: [], cur: 0, timer: 0, paused: false, inView: true, cfg: DEF, built: false, tries: 0 };

  /* ---------- deste qur ---------- */
  async function build() {
    var cfgRows = [], covRows = [], bank = [];
    var res = await Promise.all([list("reco"), list("qbank"), loadExams()]);
    cfgRows = res[0] || []; bank = res[1] || []; var exams = res[2] || [];
    var cfg = Object.assign({}, DEF);
    cfgRows.forEach(function (r) { if (r.k === "cfg") ["sec", "per", "topics", "exams", "bank"].forEach(function (k) { if (r[k] != null) cfg[k] = +r[k]; }); });
    S.cfg = cfg;
    var covers = {};
    cfgRows.forEach(function (r) { if (r.k === "cover" && r.img) (covers[r.subject] = covers[r.subject] || []).push(r.img); });

    var P = pool(), d = new Date();
    var seed = (Math.floor(Date.now() / 864e5) * 4 + Math.floor(d.getHours() / 6)) * 7919;
    var R = rng(seed);

    var subj = {}; /* ad -> {name,icon,grad,cover,qs:[{q,topic}],topics:[]} */
    P.forEach(function (s) {
      var o = subj[s.name] = subj[s.name] || { name: s.name, icon: s.icon || "📚", grad: s.grad || ["#2f63bd", "#0a2f7a"], cover: s.cover || "", qs: [], topics: [] };
      (s.topics || []).forEach(function (t) {
        var qs = (t.qs || []).filter(validQ);
        qs.forEach(function (q) { o.qs.push({ q: q, topic: t.name }); });
        if (qs.length) o.topics.push({ name: t.name, n: qs.length, time: t.time });
      });
    });
    if (cfg.bank) bank.forEach(function (b) {
      if (!validQ(b) || !b.subject) return;
      var o = subj[b.subject] = subj[b.subject] || { name: b.subject, icon: "📚", grad: ["#2f63bd", "#0a2f7a"], cover: "", qs: [], topics: [] };
      o.qs.push({ q: b, topic: b.topic || "" });
    });

    function coverOf(name, k) {
      var a = covers[name] || []; if (a.length) return a[k % a.length];
      return (subj[name] && subj[name].cover) || "";
    }

    var Q = [], T = [], E = [];
    Object.keys(subj).forEach(function (name) {
      var s = subj[name], pick = shuffle(s.qs, R).slice(0, Math.max(1, cfg.per));
      pick.forEach(function (p, k) { Q.push({ type: "q", s: s, q: p.q, topic: p.topic, cover: coverOf(name, k + Q.length) }); });
      if (cfg.topics && s.topics.length) {
        var t = shuffle(s.topics, R)[0]; T.push({ type: "t", s: s, topic: t, cover: coverOf(name, T.length + 3) });
      }
    });
    Q = shuffle(Q, R); T = shuffle(T, R).slice(0, 3);
    if (cfg.exams && exams.length) {
      shuffle(exams, R).slice(0, 2).forEach(function (e, k) { E.push({ type: "e", e: e, cover: coverOf("Sınaq", k) || coverOf("Ümumi", k) }); });
    }
    var out = [], qi = 0, ti = 0, ei = 0;
    while ((qi < Q.length || ti < T.length || ei < E.length) && out.length < MAX_SLIDES) {
      for (var a = 0; a < 2 && qi < Q.length; a++) out.push(Q[qi++]);
      if (ti < T.length) out.push(T[ti++]);
      for (var b = 0; b < 2 && qi < Q.length; b++) out.push(Q[qi++]);
      if (ei < E.length) out.push(E[ei++]);
    }
    return out.slice(0, MAX_SLIDES);
  }

  /* ---------- HTML ---------- */
  function coverHtml(it) {
    var s = it.s, g = s ? s.grad : ["#1f4aa8", "#0a2f7a"], ic = s ? s.icon : "🎓", nm = s ? s.name : (it.e ? "Sınaq " + it.e.exam : "");
    var bg = "background:linear-gradient(135deg," + esc(g[0]) + "," + esc(g[1]) + ")";
    return '<div class="dqr-cv" style="' + bg + '">' + (it.cover ? '<img src="' + esc(it.cover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : "") +
      '<span class="dqr-ic">' + (it.cover ? "" : esc(ic)) + '</span>' + (it.cover ? "" : "") + '<span class="dqr-bg">' + esc(ic) + " " + esc(nm) + "</span></div>";
  }
  function slideHtml(it, i) {
    var body = "";
    if (it.type === "q") {
      var q = it.q;
      body = '<div class="dqr-m"><span class="dqr-k">TÖVSİYƏ SUALI</span>' + (it.topic ? '<span class="dqr-t">' + esc(it.topic) + "</span>" : "") + "</div>" +
        '<h3 class="dqr-q">' + esc(q.t) + "</h3>" +
        '<div class="dqr-os">' + q.o.map(function (o, k) { return '<button type="button" class="dqr-o" data-k="' + k + '"><b>' + LET[k] + "</b><span>" + esc(o) + "</span></button>"; }).join("") + "</div>" +
        '<div class="dqr-fb"></div>' +
        '<div class="dqr-a"><button class="dqr-b g" data-a="share">🔗 Paylaş</button>' +
        (it.topic ? '<button class="dqr-b" data-a="topic">📝 Mövzu testi</button>' : "") + '<button class="dqr-b g" data-a="next">Növbəti →</button></div>';
    } else if (it.type === "t") {
      var m = it.topic;
      body = '<div class="dqr-m"><span class="dqr-k g">MÖVZU TESTİ</span><span class="dqr-t">' + esc(it.s.name) + "</span></div>" +
        '<h3 class="dqr-q">' + esc(m.name) + "</h3>" +
        '<p class="dqr-p">' + m.n + " sual" + (m.time > 0 ? " · " + m.time + " dəqiqə" : "") + " · Vaxt geriyə sayılır, bitəndə nəticə avtomatik yoxlanır.</p>" +
        '<div class="dqr-a"><button class="dqr-b y" data-a="topic">▶ Testə başla</button><button class="dqr-b g" data-a="share">🔗 Paylaş</button></div>';
    } else {
      body = '<div class="dqr-m"><span class="dqr-k r">SINAQ</span><span class="dqr-t">Dövlət qulluğu</span></div>' +
        '<h3 class="dqr-q">Sınaq ' + esc(it.e.exam) + " · " + esc(it.e.cat) + " kateqoriyası</h3>" +
        '<p class="dqr-p">Real imtahan formatında sınaq. Qeydiyyatdan keçərək iştirak edin, nəticənin təhlilini alın.</p>' +
        '<div class="dqr-a"><button class="dqr-b y" data-a="exam">Sınaqlara bax</button><button class="dqr-b g" data-a="share">🔗 Paylaş</button></div>';
    }
    return '<article class="dqr-s' + (i === 0 ? " on" : "") + '" data-i="' + i + '" aria-hidden="' + (i !== 0) + '">' + coverHtml(it) + '<div class="dqr-bd">' + body + "</div></article>";
  }

  function render(root) {
    root.innerHTML = '<div class="dqr-h"><h2>🎯 Tövsiyə olunanlar</h2><p>Sizin üçün seçilmiş suallar, mövzu testləri və sınaqlar</p><i></i></div>' +
      '<div class="dqr-st"><div class="dqr-pg"></div><div class="dqr-g">' + S.items.map(slideHtml).join("") + "</div>" +
      '<div class="dqr-c"><button class="dqr-ar" data-a="prev" aria-label="Əvvəlki">‹</button><div class="dqr-d">' + S.items.map(function (_, i) { return '<i data-d="' + i + '"' + (i === 0 ? ' class="on"' : "") + "></i>"; }).join("") + '</div><button class="dqr-ar" data-a="next" aria-label="Növbəti">›</button></div></div>';
  }

  /* ---------- hərəkət ---------- */
  function go(n) {
    var root = $("dq-reco"); if (!root || !S.items.length) return;
    S.cur = (n + S.items.length) % S.items.length;
    root.querySelectorAll(".dqr-s").forEach(function (el, i) { var on = i === S.cur; el.classList.toggle("on", on); el.setAttribute("aria-hidden", !on); });
    root.querySelectorAll(".dqr-d i").forEach(function (el, i) { el.classList.toggle("on", i === S.cur); });
    schedule();
  }
  function schedule() {
    clearTimeout(S.timer);
    var pg = document.querySelector("#dq-reco .dqr-pg");
    if (pg) { pg.classList.remove("run"); void pg.offsetWidth; }
    var cur = document.querySelector('#dq-reco .dqr-s[data-i="' + S.cur + '"]');
    if (S.paused || document.hidden || !S.inView || S.items.length < 2 || (cur && cur.classList.contains("done"))) return;
    var ms = Math.max(4, S.cfg.sec) * 1000;
    if (pg) { pg.style.animationDuration = ms + "ms"; pg.classList.add("run"); }
    S.timer = setTimeout(function () { go(S.cur + 1); }, ms);
  }

  function shareText(it) {
    var url = location.origin + location.pathname, t;
    if (it.type === "q") t = "❓ " + it.q.t + "\n" + it.q.o.map(function (o, k) { return LET[k] + ") " + o; }).join("\n") + "\n\nCavabı yoxla 👇";
    else if (it.type === "t") t = "📝 " + it.s.name + " · " + it.topic.name + " — mövzu testi";
    else t = "🎓 Sınaq " + it.e.exam + " · " + it.e.cat + " kateqoriyası";
    return { title: "DQ Platform", text: t + "\n🎯 DQ Platform", url: url };
  }
  function share(it) {
    var o = shareText(it);
    if (navigator.share) { navigator.share(o).catch(function () { }); return; }
    window.open("https://wa.me/?text=" + encodeURIComponent(o.text + "\n" + o.url), "_blank", "noopener");
  }

  function onClick(e) {
    var root = $("dq-reco"), t = e.target;
    var d = t.closest && t.closest("[data-d]"); if (d) { go(+d.getAttribute("data-d")); return; }
    var opt = t.closest && t.closest(".dqr-o");
    if (opt) {
      var sl = opt.closest(".dqr-s"), it = S.items[+sl.getAttribute("data-i")];
      if (!it || sl.classList.contains("done")) return;
      var k = +opt.getAttribute("data-k"), ok = k === it.q.c;
      sl.classList.add("done");
      sl.querySelectorAll(".dqr-o").forEach(function (b, i) { if (i === it.q.c) b.classList.add("ok"); else if (i === k) b.classList.add("no"); });
      var fb = sl.querySelector(".dqr-fb"); fb.className = "dqr-fb " + (ok ? "y" : "n");
      fb.innerHTML = (ok ? "✅ Düzgün cavab!" : "❌ Düzgün cavab: <b>" + LET[it.q.c] + ") " + esc(it.q.o[it.q.c]) + "</b>") + (it.q.e ? "<br>" + esc(it.q.e) : "");
      schedule(); return;
    }
    var a = t.closest && t.closest("[data-a]"); if (!a) return;
    var act = a.getAttribute("data-a"), sl2 = a.closest(".dqr-s"), it2 = sl2 ? S.items[+sl2.getAttribute("data-i")] : null;
    if (act === "next") go(S.cur + 1);
    else if (act === "prev") go(S.cur - 1);
    else if (act === "share" && it2) share(it2);
    else if (act === "topic" && it2 && it2.s) { try { var tn = it2.type === "t" ? it2.topic.name : it2.topic; window.TLX && TLX.begin(it2.s.name, tn); } catch (x) { } }
    else if (act === "exam") {
      var tg = document.querySelector("#v3-home .lxp-card,#lxp,#v3-home [id*=sinaq]");
      if (tg && tg.scrollIntoView) tg.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function init() {
    var home = $("v3-home"); if (!home) return;
    var root = $("dq-reco");
    if (!root) { root = document.createElement("section"); root.id = "dq-reco"; root.setAttribute("aria-label", "Tövsiyə olunanlar"); root.style.display = "none"; root.addEventListener("click", onClick); }
    S.root = root;
    place();
    var items = [];
    try { items = await build(); } catch (e) { items = []; }
    if (!items.length) { if (++S.tries < 12) setTimeout(init, 2000); return; } /* testlər gec yüklənə bilər */
    S.items = items; S.cur = 0; S.built = true; S.paused = false;
    render(root); root.style.display = ""; place(); schedule();

    root.onmouseenter = root.onfocusin = function () { S.paused = true; schedule(); };
    root.onmouseleave = root.onfocusout = function () { S.paused = false; schedule(); };
    var x0 = null;
    root.ontouchstart = function (e) { x0 = e.touches[0].clientX; S.paused = true; clearTimeout(S.timer); };
    root.ontouchend = function (e) {
      var dx = e.changedTouches[0].clientX - x0; S.paused = false;
      if (Math.abs(dx) > 45) go(S.cur + (dx < 0 ? 1 : -1)); else schedule();
    };
    if ("IntersectionObserver" in window && !S.io) { S.io = new IntersectionObserver(function (en) { S.inView = en[0].isIntersecting; schedule(); }, { threshold: .15 }); S.io.observe(root); }
    document.addEventListener("visibilitychange", schedule);
  }

  /* ---------- yer + CTA blokunu gizlət ---------- */
  var MAP = { "ə": "e", "ı": "i", "ö": "o", "ü": "u", "ğ": "g", "ç": "c", "ş": "s", "İ": "i", "Ə": "e" };
  function norm(t) {
    t = String(t || ""); try { t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { }
    return t.toLowerCase().replace(/[əıöüğçşİƏ]/g, function (c) { return MAP[c] || c; }).replace(/[\s\u00a0\u200b]+/g, " ");
  }
  var RX_CTA = /hedefin\w*\s+dogru|adimin\w*\s+at/, RX_WHY = /niye\s+mehz/, RX_BTN = /qeydiyyatdan\s+kec/;
  function authed() {
    try {
      if (document.body.classList.contains("dq-authed")) return true;
      if (window.DQ && typeof DQ.cabinet === "function" && DQ.cabinet()) return true;
      if (localStorage.getItem("dq_cabinet") || localStorage.getItem("dq_yq_sess")) return true;
    } catch (e) { }
    return false;
  }
  function firstTextEl(root, rx, max) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { if (rx.test(norm(n.nodeValue))) return n.parentElement; }
    var all = root.querySelectorAll("div,section,h1,h2,h3,h4,p,span,b,strong,a,button");
    for (var i = 0; i < all.length; i++) { var t = norm(all[i].textContent); if (t.length < (max || 200) && rx.test(t)) return all[i]; }
    return null;
  }
  function stopClimb(p) {
    if (!p || p === document.body || p === document.documentElement || p.id === "v3-home" || p.id === "dq-reco") return true;
    var t = norm(p.textContent);
    return RX_WHY.test(t) || !!p.querySelector("#dq-stats,#dq-reco,#dt-home,#dt-grid,.v3-ft,.v3-hero") || t.length > 700;
  }
  function findCta() {
    var home = $("v3-home") || document.body, seed = firstTextEl(home, RX_CTA, 200);
    if (!seed) {
      var el = firstTextEl(home, RX_WHY, 120);
      for (var up = 0; el && up < 8 && !seed; up++, el = el.parentElement) {
        var sib = el.nextElementSibling, k = 0;
        while (sib && k++ < 3) { var tt = norm(sib.textContent); if (tt.length < 220 && RX_BTN.test(tt)) { seed = sib; break; } sib = sib.nextElementSibling; }
      }
    }
    if (!seed) return null;
    var e2 = seed; while (e2.parentElement && !stopClimb(e2.parentElement)) e2 = e2.parentElement; return e2;
  }
  function place() {
    var home = $("v3-home"); if (!home) return;
    var ref = findCta(), off = authed(), box = $("dq-reco");
    if (ref) { ref.classList.toggle("dq-hn-cta-off", off); if (off) ref.style.setProperty("display", "none", "important"); else ref.style.removeProperty("display"); }
    window.__dqHn = { found: !!ref, authed: off, slides: S.items.length };
    if (!box) return;
    var fb = ref || $("dq-stats") || home.querySelector(".v3-ft");
    if (fb && fb.parentNode && (box.nextElementSibling !== fb || box.parentNode !== fb.parentNode)) fb.parentNode.insertBefore(box, fb);
    else if (!fb && box.parentNode !== home) home.appendChild(box);
  }
  var tm = 0; function soon() { clearTimeout(tm); tm = setTimeout(place, 80); }
  function start() {
    try {
      new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      var home = $("v3-home"); if (home) new MutationObserver(soon).observe(home, { childList: true, subtree: true });
    } catch (e) { }
    init();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  setInterval(place, 800);
  window.addEventListener("storage", soon);
  window.DQRECO = { refresh: function () { S.tries = 0; init(); }, state: S };

  /* =====================================================================
     3) ADMIN (V2) — "🎯 Tövsiyə Paneli": Qapaqlar · Sual bankı · Parametrlər
     ===================================================================== */
  var ra = { tab: "cov", edit: null, f: "" };
  var acss =
    ".ra-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.ra-tabs button{border:0;border-radius:10px;padding:9px 14px;font-weight:700;cursor:pointer;background:#e8ecf6;color:#1f3a7a}.ra-tabs button.on{background:#1f4aa8;color:#fff}" +
    ".ra-sub{border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px;background:#fff}.ra-sub h4{margin:0 0 8px;font-size:15px}" +
    ".ra-th{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.ra-th div{position:relative;width:110px;height:70px;border-radius:10px;overflow:hidden;border:1px solid #dbe2f0}.ra-th img{width:100%;height:100%;object-fit:cover}" +
    ".ra-th button{position:absolute;top:3px;right:3px;border:0;border-radius:50%;width:22px;height:22px;background:rgba(220,38,38,.92);color:#fff;cursor:pointer;font-size:12px}" +
    ".ra-g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ra-g .full{grid-column:1/-1}.ra-g label{display:block;font-size:12.5px;font-weight:700;margin:0 0 3px;color:#475569}" +
    ".ra-q{border-bottom:1px solid #eef1f7;padding:10px 0;display:flex;gap:10px;justify-content:space-between;align-items:flex-start}.ra-q small{color:#64748b}.ra-ok{color:#15803d;font-weight:700}" +
    "@media(max-width:640px){.ra-g{grid-template-columns:1fr}}";
  var as = document.createElement("style"); as.textContent = acss; document.head.appendChild(as);

  function subjectNames(extra) {
    var s = {}; pool().forEach(function (x) { s[x.name] = 1; });
    (extra || []).forEach(function (n) { if (n) s[n] = 1; });
    ["Sınaq", "Ümumi"].forEach(function (n) { s[n] = 1; });
    return Object.keys(s);
  }
  function fitImg(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error("decode")); };
      im.onload = function () {
        try {
          var k = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight)), q = .82, d = "";
          for (var t = 0; t < 5; t++) {
            var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
            var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
            d = c.toDataURL("image/jpeg", q); if (d.length < 350000) break; q -= .1; k *= .85;
          }
          URL.revokeObjectURL(url); ok(d);
        } catch (e) { URL.revokeObjectURL(url); no(e); }
      };
      im.src = url;
    });
  }

  function parseBulk(txt, subject, topic) {
    var out = [], bad = 0;
    String(txt || "").replace(/\r/g, "").split(/\n\s*\n+/).forEach(function (blk) {
      var lines = blk.split("\n").map(function (l) { return l.trim(); }).filter(Boolean); if (!lines.length) return;
      var qs = [], o = [], ans = -1, ex = "";
      lines.forEach(function (l) {
        var m;
        if ((m = /^(?:düzgün\s+)?(?:cavab|answer)\s*[:\-]\s*\(?([A-Ea-e])\)?/i.exec(l))) ans = m[1].toUpperCase().charCodeAt(0) - 65;
        else if ((m = /^(?:izah|şərh|serh)\s*[:\-]\s*(.+)$/i.exec(l))) ex = m[1];
        else if ((m = /^\(?([A-Ea-e])[\).:\-]\s*(.+)$/.exec(l))) o.push(m[2].trim());
        else if (!o.length) qs.push(l.replace(/^\d+[\).]\s*/, ""));
      });
      var obj = { subject: subject, topic: topic, t: qs.join(" "), o: o, c: ans, e: ex };
      if (validQ(obj)) out.push(obj); else bad++;
    });
    return { ok: out, bad: bad };
  }

  var RA = window.RECO_ADM = {
    tab: function (t) { ra.tab = t; ra.edit = null; V2.go("reco"); },
    async addCover(inp) {
      var f = inp.files && inp.files[0]; if (!f) return;
      try { var img = await fitImg(f); await V2.put("reco", { k: "cover", subject: inp.getAttribute("data-s"), img: img }); V2.toast("Qapaq əlavə olundu ✅"); V2.go("reco"); }
      catch (e) { alert("Şəkil oxunmadı. JPG, PNG və ya WEBP seçin."); }
      inp.value = "";
    },
    delRow: function (c, id) { V2.del(c, id); },
    async saveBank() {
      var v = function (id) { return (V2.$(id) ? V2.$(id).value : "").trim(); };
      var o = [], i; for (i = 0; i < 5; i++) { var t = v("rb-o" + i); if (t) o.push(t); }
      var obj = { subject: v("rb-s"), topic: v("rb-t"), t: v("rb-q"), o: o, c: +v("rb-c"), e: v("rb-e") };
      if (!obj.subject) return alert("Fənni yazın.");
      if (!validQ(obj)) return alert("Sual mətni, ən azı 2 variant və düzgün cavab (mövcud variantlardan) lazımdır.");
      await V2.put("qbank", obj, ra.edit || void 0); ra.edit = null; V2.toast("Sual bankına əlavə olundu ✅"); V2.go("reco");
    },
    async bulk() {
      var v = function (id) { return (V2.$(id) ? V2.$(id).value : "").trim(); };
      var subj = v("rb-s"); if (!subj) return alert("Əvvəlcə fənni yazın.");
      var r = parseBulk(V2.$("rb-bulk").value, subj, v("rb-t"));
      if (!r.ok.length) return alert("Heç bir sual tanınmadı. Formata baxın.");
      for (var i = 0; i < r.ok.length; i++) await V2.put("qbank", r.ok[i]);
      V2.toast(r.ok.length + " sual əlavə olundu" + (r.bad ? " (" + r.bad + " blok səhv formatda)" : "") + " ✅"); V2.go("reco");
    },
    editQ: function (id) { ra.edit = id; V2.go("reco"); },
    cancel: function () { ra.edit = null; V2.go("reco"); },
    filter: function (v) { ra.f = v; V2.go("reco"); },
    async saveCfg() {
      var g = function (id) { return V2.$(id); };
      var o = { k: "cfg", sec: Math.min(30, Math.max(4, +g("rc-sec").value || 9)), per: Math.min(5, Math.max(1, +g("rc-per").value || 2)),
        topics: g("rc-t").checked ? 1 : 0, exams: g("rc-e").checked ? 1 : 0, bank: g("rc-b").checked ? 1 : 0 };
      var rows = await V2.list("reco"), cur = rows.filter(function (r) { return r.k === "cfg"; })[0];
      await V2.put("reco", o, cur ? cur._id : void 0); V2.toast("Parametrlər saxlanıldı ✅");
    }
  };

  async function pageReco() {
    var rows = await V2.list("reco"), bank = await V2.list("qbank");
    var cfg = Object.assign({}, DEF); rows.forEach(function (r) { if (r.k === "cfg") Object.keys(DEF).forEach(function (k) { if (r[k] != null) cfg[k] = +r[k]; }); });
    var tabs = [["cov", "🖼 Qapaq şəkilləri"], ["bank", "🏦 Sual bankı (" + bank.length + ")"], ["cfg", "⚙️ Parametrlər"]];
    var h = '<div class="ra-tabs">' + tabs.map(function (t) { return '<button class="' + (ra.tab === t[0] ? "on" : "") + '" onclick="RECO_ADM.tab(\'' + t[0] + '\')">' + t[1] + "</button>"; }).join("") + "</div>";
    var names = subjectNames(bank.map(function (b) { return b.subject; }));

    if (ra.tab === "cov") {
      h += '<div class="v2-card"><p style="margin:0 0 12px;color:#475569;font-size:13.5px">Hər fənn üçün bir və ya bir neçə qapaq şəkli əlavə edin. Ana səhifədəki "Tövsiyə olunanlar" panelində həmin fənnin sualı/testi çıxanda şəkillərdən biri göstərilir. Şəkil yoxdursa fənnin rəngi və ikonu istifadə olunur. "Sınaq" – sınaq kartları üçündür.</p>' +
        names.map(function (n) {
          var cv = rows.filter(function (r) { return r.k === "cover" && r.subject === n; });
          return '<div class="ra-sub"><h4>' + V2.esc(n) + ' <small style="color:#64748b">(' + cv.length + " şəkil)</small></h4>" +
            '<div class="ra-th">' + cv.map(function (r) { return '<div><img src="' + V2.esc(r.img) + '" alt=""><button onclick="RECO_ADM.delRow(\'reco\',' + r._id + ')">✕</button></div>'; }).join("") + "</div>" +
            '<input type="file" accept="image/*" data-s="' + V2.esc(n) + '" onchange="RECO_ADM.addCover(this)"></div>';
        }).join("") + "</div>";
    } else if (ra.tab === "bank") {
      var cur = ra.edit ? bank.filter(function (b) { return b._id == ra.edit; })[0] : null; cur = cur || { subject: "", topic: "", t: "", o: [], c: 0, e: "" };
      var lst = bank.filter(function (b) { var q = ra.f.toLowerCase(); return !q || (b.subject + " " + b.topic + " " + b.t).toLowerCase().indexOf(q) > -1; });
      h += '<div class="v2-card"><h3 style="margin-top:0">' + (cur._id ? "Sualı redaktə et" : "Yeni sual") + '</h3><div class="ra-g">' +
        '<div><label>Fənn</label><input class="v2-in" id="rb-s" list="rb-sl" value="' + V2.esc(cur.subject) + '"><datalist id="rb-sl">' + names.map(function (n) { return "<option>" + V2.esc(n); }).join("") + "</datalist></div>" +
        '<div><label>Mövzu (istəyə görə)</label><input class="v2-in" id="rb-t" value="' + V2.esc(cur.topic) + '"></div>' +
        '<div class="full"><label>Sual mətni</label><textarea class="v2-in" id="rb-q" rows="3">' + V2.esc(cur.t) + "</textarea></div>" +
        [0, 1, 2, 3, 4].map(function (i) { return "<div><label>Variant " + LET[i] + (i > 1 ? " (istəyə görə)" : "") + '</label><input class="v2-in" id="rb-o' + i + '" value="' + V2.esc(cur.o[i] || "") + '"></div>'; }).join("") +
        '<div><label>Düzgün cavab</label><select class="v2-in" id="rb-c">' + [0, 1, 2, 3, 4].map(function (i) { return '<option value="' + i + '"' + (cur.c === i ? " selected" : "") + ">" + LET[i] + "</option>"; }).join("") + "</select></div>" +
        '<div class="full"><label>İzah (istəyə görə — cavabdan sonra göstərilir)</label><input class="v2-in" id="rb-e" value="' + V2.esc(cur.e) + '"></div></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px"><button class="v2-b" onclick="RECO_ADM.saveBank()">💾 Yadda saxla</button>' + (cur._id ? '<button class="v2-b" style="background:#64748b" onclick="RECO_ADM.cancel()">Ləğv et</button>' : "") + "</div></div>" +
        '<div class="v2-card"><h3 style="margin-top:0">📋 Çoxlu sual əlavə et (yapışdır)</h3><p style="font-size:12.5px;color:#64748b;margin:0 0 8px">Yuxarıdakı Fənn/Mövzu hamısına tətbiq olunur. Suallar boş sətirlə ayrılır:<br><code>Sual mətni<br>A) variant<br>B) variant<br>C) variant<br>Cavab: B<br>İzah: ixtiyari</code></p>' +
        '<textarea class="v2-in" id="rb-bulk" rows="7"></textarea><button class="v2-b" style="margin-top:8px" onclick="RECO_ADM.bulk()">➕ Hamısını əlavə et</button></div>' +
        '<div class="v2-card"><h3 style="margin-top:0">Bank (' + lst.length + ')</h3><input class="v2-in" placeholder="🔎 Axtar (fənn, mövzu, mətn)" value="' + V2.esc(ra.f) + '" onchange="RECO_ADM.filter(this.value)" style="margin-bottom:8px">' +
        (lst.slice(0, 80).map(function (b) {
          return '<div class="ra-q"><div><b>' + V2.esc(b.t) + "</b><br><small>" + V2.esc(b.subject) + (b.topic ? " · " + V2.esc(b.topic) : "") + "</small><br><small>" +
            b.o.map(function (o, i) { return i === b.c ? '<span class="ra-ok">' + LET[i] + ") " + V2.esc(o) + "</span>" : LET[i] + ") " + V2.esc(o); }).join(" · ") + '</small></div><div style="white-space:nowrap"><button class="v2-b" style="padding:5px 9px" onclick="RECO_ADM.editQ(' + b._id + ')">✏️</button> <button class="v2-b" style="padding:5px 9px;background:#dc2626" onclick="RECO_ADM.delRow(\'qbank\',' + b._id + ')">🗑</button></div></div>';
        }).join("") || '<div class="v2-empty">Sual yoxdur</div>') + (lst.length > 80 ? '<small style="color:#64748b">İlk 80 sual göstərilir — axtarışdan istifadə edin.</small>' : "") + "</div>";
    } else {
      h += '<div class="v2-card"><div class="ra-g">' +
        '<div><label>Slayd keçid vaxtı (san)</label><input class="v2-in" id="rc-sec" type="number" min="4" max="30" value="' + cfg.sec + '"></div>' +
        '<div><label>Hər fənndən sual sayı</label><input class="v2-in" id="rc-per" type="number" min="1" max="5" value="' + cfg.per + '"></div>' +
        '<div class="full"><label><input type="checkbox" id="rc-t"' + (cfg.topics ? " checked" : "") + "> Mövzu testi kartları göstər</label></div>" +
        '<div class="full"><label><input type="checkbox" id="rc-e"' + (cfg.exams ? " checked" : "") + "> Sınaq kateqoriyası kartları göstər</label></div>" +
        '<div class="full"><label><input type="checkbox" id="rc-b"' + (cfg.bank ? " checked" : "") + "> Sual bankındakı sualları da qatışdır</label></div></div>" +
        '<button class="v2-b" style="margin-top:12px" onclick="RECO_ADM.saveCfg()">💾 Yadda saxla</button></div>' +
        '<div class="v2-card" style="font-size:13px;color:#475569"><b>Necə işləyir?</b> Panel avtomatikdir: testlərə əlavə etdiyiniz suallardan və sual bankından hər fənn üzrə təsadüfi sual seçir, mövzu testi və sınaq kateqoriyası kartları ilə növbələşdirir, hər 6 saatdan bir seçimi yeniləyir.</div>';
    }
    return { title: "🎯 Tövsiyə Paneli", sub: "Ana səhifədəki avtomatik tövsiyə blokunun qapaqları, sual bankı və parametrləri", html: h };
  }

  function hookAdmin() {
    if (typeof V2 === "undefined" || !V2 || !V2.menu || !V2.go) return false;
    if (!V2.p_reco) {
      V2.p_reco = pageReco;
      if (!V2.menu.some(function (m) { return m[0] === "reco"; })) {
        var i = V2.menu.findIndex(function (m) { return m[0] === "news"; });
        V2.menu.splice(i < 0 ? V2.menu.length : i + 1, 0, ["reco", "fa-star", "🎯 Tövsiyə Paneli"]);
      }
    }
    return true;
  }
  var ht = 0; (function tryHook() { if (!hookAdmin() && ++ht < 60) setTimeout(tryHook, 500); })();
})();
