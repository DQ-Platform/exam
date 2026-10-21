/* =====================================================================
   DQ Platform · Ana səhifə slayderləri
   1) 📢 Yeniliklər — şəkil solda, məlumat sağda; ardıcıl animasiya ilə avtomatik dəyişir
      (məlumat Yeniliklər bölməsindəki xəbərlərdən götürülür: DQN.items)
   2) 🎓 Aktiv sınaqlar və mövzu testləri — qapaq şəkli solda, məlumat sağda
      (Sınaq 1 · BB kateqoriyası · 100 sual · 180 dəqiqə …). Aktiv sınaq = «Sınaq növləri»ndə açıq (o=1) olan xana.
   Yerləşmə: ana səhifədə «Niyə məhz DQ Platform?» bölməsinin üstü.
   index.html-də digər skriptlərdən SONRA:  <script src="dq-home-sliders.js?v=1"></script>
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQHS) return;

  var DUR = +window.DQHS_DUR || 7000, TICK = 100, MAX_EXAMS = 8, MAX_TOPICS = 10;
  var CATS = ["BB", "BA", "AC"];
  var CAT = { BB: { a: "#0f2c52", b: "#1d4f91", m: 100, p: 65 }, BA: { a: "#4a1048", b: "#6b1230", m: 120, p: 84 }, AC: { a: "#0c3b45", b: "#14606b", m: 100, p: 65 } };
  var DEF_TYPES = [{ n: "Sınaq 1", t: { BB: { q: 60, d: 120, o: 1 }, BA: { q: 50, d: 100, o: 1 }, AC: { q: 40, d: 90, o: 1 } } },
                   { n: "Sınaq 2", t: { BB: { q: 60, d: 120, o: 1 }, BA: { q: 50, d: 100, o: 1 }, AC: { q: 40, d: 90, o: 1 } } }];
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var cssUrl = function (u) { return String(u).replace(/["\\\n\r]/g, ""); };

  /* ───────── CSS ───────── */
  var CSS = '#dq-hs{max-width:1020px;margin:30px auto 22px;padding:0 14px;box-sizing:border-box;font-family:inherit}' +
    '#dq-hs *{box-sizing:border-box}.hs-sec{margin:0 0 34px}.hs-sec[hidden]{display:none!important}' +
    '.hs-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 2px 12px}.hs-h{margin:0;font-size:clamp(20px,4.4vw,28px);line-height:1.2;color:#0f2d6b;font-weight:800}' +
    '.hs-sub{margin:3px 0 0;font-size:13px;color:#64748b;font-weight:500}.hs-all{border:0;background:none;color:#1d4ed8;font:700 13px inherit;cursor:pointer;padding:6px 2px;white-space:nowrap}.hs-all:hover{text-decoration:underline}' +
    '.hs-card{position:relative;border-radius:22px;overflow:hidden;background:#f4f6fb;border:1px solid #dbe3f0;box-shadow:0 14px 34px rgba(15,45,107,.14)}' +
    '.hs-stage{display:grid}.hs-slide{grid-area:1/1;display:flex;min-width:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateX(34px);transition:opacity .7s ease,transform .7s cubic-bezier(.22,.61,.36,1),visibility 0s linear .7s}' +
    '.hs-slide.on{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}.hs-slide.out{transform:translateX(-34px)}' +
    '.hs-img{position:relative;flex:0 0 42%;min-height:270px;overflow:hidden;background:#dfe9fa}' +
    '.hs-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}' +
    '.hs-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:14px}.hs-ph b{font-size:clamp(40px,9vw,70px);line-height:1}.hs-ph i{font-style:normal;margin-top:10px;font-weight:800;letter-spacing:2px;font-size:clamp(18px,4vw,30px);opacity:.92}' +
    '.hs-ph:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 80% 15%,rgba(255,255,255,.28),transparent 55%)}.hs-ph>*{position:relative}' +
    '.hs-new{position:absolute;left:14px;top:14px;z-index:2;background:#eab308;color:#422006;font-weight:800;font-size:12px;padding:6px 14px;border-radius:99px;box-shadow:0 6px 14px rgba(0,0,0,.2)}' +
    '.hs-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:26px 28px;background:linear-gradient(135deg,#f7f9fd,#edf1f8)}' +
    '.hs-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:#64748b}.hs-pill{display:inline-flex;align-items:center;gap:5px;font-weight:800;font-size:12px;padding:5px 12px;border-radius:99px;letter-spacing:.2px;background:#dbeafe;color:#1e40af}' +
    '.hs-pill.el{background:#fef3c7;color:#92400e}.hs-pill.dy{background:#d1fae5;color:#065f46}.hs-pill.ex{background:#e0e7ff;color:#3730a3}.hs-pill.tp{background:#fce7f3;color:#9d174d}.hs-pill.live{background:#dcfce7;color:#166534}' +
    '.hs-pill.live:before{content:"";width:8px;height:8px;border-radius:50%;background:#16a34a;animation:hsPulse 1.4s infinite}' +
    '.hs-t{margin:0;font-size:clamp(19px,3.6vw,28px);line-height:1.25;color:#0f2d6b;font-weight:800;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
    '.hs-p{margin:0;font-size:14.5px;line-height:1.65;color:#475569;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.hs-sb{margin:0;font-size:15px;font-weight:700;color:#334155}' +
    '.hs-chips{display:flex;flex-wrap:wrap;gap:8px}.hs-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #dbe3f0;border-radius:12px;padding:8px 12px;font-size:13.5px;font-weight:700;color:#0f2d6b}' +
    '.hs-note{font-size:13px;color:#64748b}.hs-act{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}' +
    '.hs-btn{border:0;border-radius:99px;padding:11px 22px;font:700 14px inherit;cursor:pointer;transition:transform .15s,box-shadow .15s}.hs-btn:active{transform:scale(.97)}' +
    '.hs-btn.p{background:linear-gradient(135deg,#0f2d6b,#2456b3);color:#fff;box-shadow:0 8px 18px rgba(15,45,107,.3)}.hs-btn.g{background:#e2e8f4;color:#1e3a8a}.hs-btn:hover{transform:translateY(-1px)}' +
    '.hs-bar{height:4px;background:rgba(15,45,107,.1)}.hs-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#eab308,#f59e0b)}' +
    '.hs-ctl{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px}.hs-ar{width:36px;height:36px;border-radius:50%;border:1px solid #cbd5e1;background:#fff;color:#0f2d6b;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}.hs-ar:hover{background:#eef2ff}' +
    '.hs-dots{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:60%}.hs-dot{width:9px;height:9px;border-radius:99px;border:0;background:#cbd5e1;padding:0;cursor:pointer;transition:width .3s,background .3s}.hs-dot.on{width:26px;background:#0f2d6b}' +
    /* ardıcıl giriş animasiyası: şəkil yaxınlaşır, mətn sətir-sətir qalxır */
    '.hs-slide.on .hs-img img,.hs-slide.on .hs-ph{animation:hsZoom 1.6s cubic-bezier(.22,.61,.36,1) both}' +
    '.hs-slide.on .hs-body>*{animation:hsUp .6s cubic-bezier(.22,.61,.36,1) both;animation-delay:calc(var(--i,0)*90ms + 140ms)}' +
    '.hs-slide.on .hs-new{animation:hsPop .6s .5s cubic-bezier(.3,1.6,.4,1) both}' +
    '@keyframes hsUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes hsZoom{from{transform:scale(1.14)}to{transform:scale(1)}}' +
    '@keyframes hsPop{from{opacity:0;transform:scale(.4) rotate(-8deg)}to{opacity:1;transform:none}}@keyframes hsPulse{0%,100%{opacity:1}50%{opacity:.35}}' +
    '@media(max-width:640px){#dq-hs{margin:22px auto 14px}.hs-slide{flex-direction:column}.hs-img{flex:none;min-height:0;aspect-ratio:16/9}.hs-body{padding:16px 16px 18px;gap:8px}.hs-p{font-size:13.5px;-webkit-line-clamp:3}.hs-btn{padding:10px 18px;font-size:13px}.hs-dots{max-width:70%}}' +
    '@media(prefers-reduced-motion:reduce){.hs-slide,.hs-slide *{animation:none!important;transition:none!important}}';

  /* ───────── ümumi slayder mühərriki ───────── */
  var sliders = [];
  function Slider(host, o) {
    this.host = host; this.items = o.items; this.slideHtml = o.slide; this.onAct = o.onAct; this.label = o.label;
    this.cur = 0; this.t = 0; this.hover = false; this.vis = true; this.busy = false;
    this.draw(); this.bind(); sliders.push(this);
  }
  Slider.prototype.draw = function () {
    var n = this.items.length, self = this;
    this.host.innerHTML = '<div class="hs-card" tabindex="0" role="region" aria-roledescription="carousel" aria-label="' + esc(this.label) + '"><div class="hs-stage">' +
      this.items.map(function (it, i) { return '<article class="hs-slide' + (i === 0 ? " on" : "") + '" data-i="' + i + '" aria-hidden="' + (i !== 0) + '">' + self.slideHtml(it, i) + '</article>'; }).join("") +
      '</div><div class="hs-bar"><i></i></div></div>' +
      (n > 1 ? '<div class="hs-ctl"><button type="button" class="hs-ar" data-a="prev" aria-label="Əvvəlki">‹</button><div class="hs-dots">' +
        this.items.map(function (_, i) { return '<button type="button" class="hs-dot' + (i === 0 ? " on" : "") + '" data-a="dot" data-i="' + i + '" aria-label="' + (i + 1) + '"></button>'; }).join("") +
        '</div><button type="button" class="hs-ar" data-a="next" aria-label="Növbəti">›</button></div>' : "");
    this.cur = 0; this.t = 0;
  };
  Slider.prototype.go = function (i, dir) {
    var n = this.items.length; if (n < 2 || this.busy) return;
    i = (i + n) % n; if (i === this.cur) return;
    var sl = this.host.querySelectorAll(".hs-slide"), nw = sl[i], old = sl[this.cur], self = this;
    dir = dir || (i > this.cur ? 1 : -1);
    this.busy = true;
    nw.style.transition = "none"; nw.style.transform = "translateX(" + dir * 34 + "px)"; void nw.offsetWidth; nw.style.transition = ""; nw.style.transform = "";
    nw.classList.add("on"); nw.setAttribute("aria-hidden", "false");
    old.classList.remove("on"); old.setAttribute("aria-hidden", "true"); old.style.transform = "translateX(" + (-dir * 34) + "px)";
    this.host.querySelectorAll(".hs-dot").forEach(function (d, k) { d.classList.toggle("on", k === i); });
    this.cur = i; this.t = 0; this.bar(0);
    setTimeout(function () { old.style.transform = ""; self.busy = false; }, RM ? 0 : 760);
  };
  Slider.prototype.bar = function (p) { var b = this.host.querySelector(".hs-bar i"); if (b) b.style.width = p + "%"; };
  Slider.prototype.bind = function () {
    var self = this, h = this.host, x0 = null, y0 = 0;
    h.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "prev") self.go(self.cur - 1, -1); else if (a === "next") self.go(self.cur + 1, 1);
      else if (a === "dot") self.go(+b.getAttribute("data-i"));
      else if (self.onAct) self.onAct(a, self.items[self.cur], self.cur);
    });
    h.addEventListener("mouseenter", function () { self.hover = true; });
    h.addEventListener("mouseleave", function () { self.hover = false; });
    h.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") self.go(self.cur - 1, -1); else if (e.key === "ArrowRight") self.go(self.cur + 1, 1); });
    h.addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; self.hover = true; }, { passive: true });
    h.addEventListener("touchend", function (e) {
      self.hover = false; if (x0 == null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) self.go(self.cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { es.forEach(function (en) { self.vis = en.isIntersecting; }); }, { threshold: 0.2 }).observe(h);
  };
  setInterval(function () {
    var home = $("v3-home");
    if (document.hidden || (home && !home.classList.contains("active"))) return;
    sliders = sliders.filter(function (s) { return document.body.contains(s.host); });
    sliders.forEach(function (s) {
      if (s.items.length < 2 || s.hover || !s.vis || s.busy) return;
      s.t += TICK; s.bar(Math.min(100, s.t / DUR * 100));
      if (s.t >= DUR) s.go(s.cur + 1, 1);
    });
  }, TICK);

  /* ───────── 1) YENİLİKLƏR ───────── */
  function newsItems() {
    var l = (window.DQN && DQN.items) || [];
    if (l.length) return { list: l.slice(0, 8), dqn: true };
    return { list: [], dqn: false };
  }
  function kindOf(n) { try { if (window.NW && NW.kind) return NW.kind(n); } catch (e) {} var k = (n && n.kind) || ""; return /mtahan/i.test(k) || k === "Elan" ? "Elan" : k === "Dəyişiklik" ? "Dəyişiklik" : "Xəbər"; }
  function isNew(n) { var t = Date.parse(n.pub || ""); return !!t && Date.now() - t < 7 * 864e5 && Date.now() - t > -864e5; }
  function summary(n, len) { var s = String(n.sum || n.body || "").replace(/\s+/g, " ").trim(); return s.length > len ? s.slice(0, len).replace(/\s+\S*$/, "") + "…" : s; }
  function newsImg(n, i) {
    if (n.img) return n.img;
    var host = $("yq-news"), im = host && host.querySelectorAll(".dqn-slide img")[i];
    return im ? im.getAttribute("src") || "" : "";
  }
  function newsSlide(n, i) {
    var k = kindOf(n), im = newsImg(n, i), kc = k === "Elan" ? "el" : k === "Dəyişiklik" ? "dy" : "";
    return '<div class="hs-img" style="background:linear-gradient(135deg,#1e3a8a,#3b82f6)">' +
      (im ? '<img src="' + esc(im) + '" alt="" loading="' + (i === 0 ? "eager" : "lazy") + '" decoding="async">' : '<div class="hs-ph"><b>📢</b><i>' + esc(k.toUpperCase()) + '</i></div>') +
      (isNew(n) ? '<span class="hs-new">YENİ</span>' : "") + '</div>' +
      '<div class="hs-body"><div class="hs-meta" style="--i:0"><span class="hs-pill ' + kc + '">' + esc(k) + '</span><time>' + esc(String(n.pub || n.date || "").slice(0, 10)) + '</time></div>' +
      '<h3 class="hs-t" style="--i:1">' + esc(n.title) + '</h3><p class="hs-p" style="--i:2">' + esc(summary(n, 260)) + '</p>' +
      '<div class="hs-act" style="--i:3"><button type="button" class="hs-btn p" data-a="more">Ətraflı oxu →</button><button type="button" class="hs-btn g" data-a="share">🔗 Paylaş</button></div></div>';
  }
  function newsAct(a, n, i) {
    if (a === "more") { try { if (window.DQN && DQN.open && DQN.items && DQN.items[i] === n) return DQN.open(i); } catch (e) {} try { NW.open("all"); } catch (e) {} }
    else if (a === "share") {
      try { if (window.dqShareWithCover) return window.dqShareWithCover(n); } catch (e) {}
      var t = "DQPlatform - " + n.title; if (navigator.share) navigator.share({ text: t }).catch(function () {}); else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
    } else if (a === "all") { try { NW.open("all"); } catch (e) {} }
  }

  /* ───────── 2) AKTİV SINAQLAR + MÖVZU TESTLƏRİ ───────── */
  var TYPES = null, TYPES_AT = 0, GEN = null, GEN_AT = 0;
  async function loadTypes() {
    if (TYPES && Date.now() - TYPES_AT < 120000) return TYPES;
    var out = null;
    try { if (typeof V2 !== "undefined") { await V2.probe(); var r = (await V2.list("types"))[0]; if (r && Array.isArray(r.sinaq) && r.sinaq.length) out = r.sinaq; } } catch (e) {}
    if (!out) { try { var c = JSON.parse(localStorage.getItem("dq_types_cfg") || "null"); if (Array.isArray(c) && c.length) out = c; } catch (e) {} }
    TYPES = out || DEF_TYPES; TYPES_AT = Date.now(); return TYPES;
  }
  async function loadGeneralCover() {         // admin: «sistem üçün ümumi qapaq şəkli»
    if (GEN !== null && Date.now() - GEN_AT < 300000) return GEN;
    var u = "";
    try {
      if (typeof V2 !== "undefined") {
        var d = (await V2.list("lxcfg"))[0], j = d && d.json ? JSON.parse(d.json) : null;
        u = (j && j.heroImgs && j.heroImgs[0]) || "";
      }
    } catch (e) {}
    GEN = u; GEN_AT = Date.now(); return GEN;
  }
  function liveSession(no, cat) {
    try {
      var l = (window.LX && LX.cache) || [], now = Date.now();
      return l.filter(function (x) {
        if (!x || x.status === "Bitib" || parseInt(x.exam_no) !== no || String(x.cat || "").toUpperCase() !== cat) return false;
        if (x.perm) return true;
        var st = new Date(x.start).getTime(), en = (window.LX && LX.endOf ? LX.endOf(x) : new Date(x.end || x.start)).getTime();
        return st <= now && en > now;
      })[0] || null;
    } catch (e) { return null; }
  }
  async function examItems() {
    var cfg = await loadTypes(), gen = await loadGeneralCover(), out = [];
    cfg.forEach(function (s, si) {
      var no = parseInt(String(s.n || "").replace(/\D/g, "")) || si + 1;
      CATS.forEach(function (k) {
        var c = (s.t || {})[k]; if (!c || !+c.o) return;
        var se = liveSession(no, k), cv = se && ((se.covers && se.covers[0]) || se.cover) || gen || "";
        out.push({ kind: "exam", no: no, name: s.n || ("Sınaq " + no), cat: k, q: +c.q || 0, d: +c.d || 0, cover: cv, sess: se });
      });
    });
    out.sort(function (a, b) { return a.no - b.no || CATS.indexOf(a.cat) - CATS.indexOf(b.cat); });
    return out.slice(0, MAX_EXAMS);
  }
  function topicItems() {
    var pool = []; try { pool = (window.TLX && TLX.pool && TLX.pool()) || []; } catch (e) {}
    var lists = pool.map(function (s) {
      return (s.topics || []).filter(function (t) { return (t.n || (t.qs && t.qs.length) || 0) > 0; }).map(function (t) {
        return { kind: "topic", subject: s.name, icon: s.icon || "📚", cover: s.cover || "", grad: s.grad || ["#2f63bd", "#0a2f7a"], topic: t.name, n: t.n || (t.qs && t.qs.length) || 0, time: +t.time || 0 };
      });
    }).filter(function (l) { return l.length; });
    var out = [], r = 0;
    while (out.length < MAX_TOPICS && lists.some(function (l) { return l.length > r; })) {
      lists.forEach(function (l) { if (l[r] && out.length < MAX_TOPICS) out.push(l[r]); });
      r++;
    }
    return out;
  }
  function phHtml(icon, label) { return '<div class="hs-ph"><b>' + esc(icon) + '</b><i>' + esc(label) + '</i></div>'; }
  function exSlide(it, i) {
    if (it.kind === "exam") {
      var C = CAT[it.cat] || CAT.BB, se = it.sess;
      var note = se ? (se.perm ? "♾ Müddətsiz sessiya — istənilən vaxt daxil ola bilərsiniz" : "📅 Sessiya aktivdir") : "";
      return '<div class="hs-img" style="background:linear-gradient(135deg,' + C.a + ',' + C.b + ')">' + (it.cover ? '<img src="' + esc(it.cover) + '" alt="" loading="' + (i === 0 ? "eager" : "lazy") + '" decoding="async">' : phHtml("🎓", it.cat)) + '</div>' +
        '<div class="hs-body"><div class="hs-meta" style="--i:0"><span class="hs-pill ex">🎓 Sınaq</span><span class="hs-pill live">Aktiv</span></div>' +
        '<h3 class="hs-t" style="--i:1">' + esc(it.name) + '</h3><p class="hs-sb" style="--i:2">' + esc(it.cat) + ' kateqoriyası · Qəbul tipli sınaq</p>' +
        '<div class="hs-chips" style="--i:3">' + (it.q ? '<span class="hs-chip">📝 ' + it.q + ' sual</span>' : "") + (it.d ? '<span class="hs-chip">⏱ ' + it.d + ' dəqiqə</span>' : "") + '<span class="hs-chip">🎯 Keçid balı ' + C.p + '/' + C.m + '</span></div>' +
        (note ? '<div class="hs-note" style="--i:4">' + esc(note) + '</div>' : "") +
        '<div class="hs-act" style="--i:5"><button type="button" class="hs-btn p" data-a="exam">Sınağa keç →</button><button type="button" class="hs-btn g" data-a="exams">Bütün sınaqlar</button></div></div>';
    }
    var g = it.grad || ["#2f63bd", "#0a2f7a"];
    return '<div class="hs-img" style="background:linear-gradient(135deg,' + esc(g[0]) + ',' + esc(g[1]) + ')">' + (it.cover ? '<img src="' + esc(it.cover) + '" alt="" loading="lazy" decoding="async">' : phHtml(it.icon, it.subject)) + '</div>' +
      '<div class="hs-body"><div class="hs-meta" style="--i:0"><span class="hs-pill tp">📚 Mövzu testi</span></div>' +
      '<h3 class="hs-t" style="--i:1">' + esc(it.topic) + '</h3><p class="hs-sb" style="--i:2">' + esc(it.icon) + ' ' + esc(it.subject) + '</p>' +
      '<div class="hs-chips" style="--i:3"><span class="hs-chip">📝 ' + it.n + ' sual</span>' + (it.time ? '<span class="hs-chip">⏱ ' + it.time + ' dəqiqə</span>' : "") + '</div>' +
      '<div class="hs-act" style="--i:4"><button type="button" class="hs-btn p" data-a="topic">Testə başla →</button><button type="button" class="hs-btn g" data-a="tests">Bütün testlər</button></div></div>';
  }
  function exAct(a, it) {
    try {
      if (a === "exam" || a === "exams") { if (window.DQ && DQ.openCabinet) DQ.openCabinet(); }
      else if (a === "topic") { if (window.TLX && TLX.begin) TLX.begin(it.subject, it.topic); }
      else if (a === "tests" || a === "all") { if (window.V3 && V3.showTests) V3.showTests(); }
    } catch (e) { console.warn("[dq-hs]", e); }
  }

  /* ───────── yerləşdirmə ───────── */
  var sig = { n: "", e: "" }, wrap = null, S_NEWS = null, S_EX = null;
  function homeReady() { var h = $("v3-home"); return h && (h.querySelector(".v3-hero") || h.querySelector("#dt-home") || h.querySelector(".v3-ft")) ? h : null; }
  function anchor(h) {
    var w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (!/Niy[əe]\s+m[əe]hz/i.test(n.nodeValue || "")) continue;
      var el = n.parentElement;
      while (el && el.parentElement && el.parentElement !== h && el.parentElement.children.length < 3) el = el.parentElement;
      if (el && el !== h) return el;
    }
    return h.querySelector("#dq-stats") || h.querySelector(".v3-ft") || null;
  }
  function ensureWrap(h) {
    if (wrap && wrap.isConnected && h.contains(wrap)) return wrap;
    var st = $("dq-hs-css"); if (!st) { st = document.createElement("style"); st.id = "dq-hs-css"; st.textContent = CSS; document.head.appendChild(st); }
    wrap = document.createElement("div"); wrap.id = "dq-hs";
    wrap.innerHTML = '<section class="hs-sec" id="hs-news" hidden><div class="hs-head"><div><h2 class="hs-h">📢 Yeniliklər</h2><p class="hs-sub">Ən son xəbərlər, elanlar və qanun dəyişiklikləri</p></div><button type="button" class="hs-all" data-all="news">Bütün xəbərlər →</button></div><div class="hs-host"></div></section>' +
      '<section class="hs-sec" id="hs-ex" hidden><div class="hs-head"><div><h2 class="hs-h">🎓 Aktiv sınaqlar və mövzu testləri</h2><p class="hs-sub">Sınağa qoşul və ya fənn üzrə mövzu testi ilə hazırlaş</p></div><button type="button" class="hs-all" data-all="ex">Bütün sınaqlar →</button></div><div class="hs-host"></div></section>';
    wrap.addEventListener("click", function (e) {
      var b = e.target.closest("[data-all]"); if (!b) return;
      if (b.getAttribute("data-all") === "news") newsAct("all"); else exAct("exams");
    });
    var ref = anchor(h); if (ref && ref.parentNode) ref.parentNode.insertBefore(wrap, ref); else h.appendChild(wrap);
    S_NEWS = S_EX = null; sig.n = sig.e = "";
    return wrap;
  }
  function placeCheck(h) {                    // başqa modul bölmələri yenidən düzübsə, «Niyə məhz»in üstünə qaytar
    var ref = anchor(h);
    if (ref && wrap.nextElementSibling !== ref && ref.parentNode && ref !== wrap) { ref.parentNode.insertBefore(wrap, ref); }
  }
  function fillNews() {
    var sec = $("hs-news"); if (!sec) return;
    var r = newsItems(), s = r.list.map(function (n, i) { return (n._id || "") + "|" + n.title + "|" + (n.img ? n.img.length : 0) + "|" + newsImg(n, i).length; }).join("~");
    if (!r.list.length) { sec.hidden = true; sig.n = ""; S_NEWS = null; return; }
    if (s === sig.n && S_NEWS && S_NEWS.host.isConnected) return;
    sig.n = s; sec.hidden = false;
    S_NEWS = new Slider(sec.querySelector(".hs-host"), { items: r.list, slide: newsSlide, onAct: newsAct, label: "Yeniliklər" });
  }
  async function fillExams() {
    var sec = $("hs-ex"); if (!sec) return;
    var items = []; try { items = (await examItems()).concat(topicItems()); } catch (e) { console.warn("[dq-hs]", e); }
    if (!items.length) { sec.hidden = true; sig.e = ""; S_EX = null; return; }
    var s = items.map(function (it) { return it.kind + "|" + (it.name || it.topic) + "|" + (it.cat || it.subject) + "|" + (it.q || it.n) + "|" + (it.d || it.time) + "|" + (it.cover ? it.cover.length : 0); }).join("~");
    if (s === sig.e && S_EX && S_EX.host.isConnected) return;
    sig.e = s; sec.hidden = false;
    S_EX = new Slider(sec.querySelector(".hs-host"), { items: items, slide: exSlide, onAct: exAct, label: "Aktiv sınaqlar və mövzu testləri" });
  }

  var busy = false, lastEx = 0;
  async function tick() {
    if (busy) return; busy = true;
    try {
      var h = homeReady(); if (!h) { busy = false; return; }
      ensureWrap(h); placeCheck(h); fillNews();
      if (!S_EX || Date.now() - lastEx > 20000) { lastEx = Date.now(); await fillExams(); }
    } catch (e) { console.warn("[dq-hs]", e); }
    busy = false;
  }
  setInterval(tick, 1200);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();

  window.DQHS = { refresh: function () { sig.n = sig.e = ""; lastEx = 0; tick(); }, _sliders: function () { return sliders; } };
})();
