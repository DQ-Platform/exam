/* DQ Platform — Qeydiyyat portalı: yeni hero + 2 saniyəlik şəkil slayd-şousu
   Şəkillər kəsilmir (object-fit: contain), arxa fon eyni şəklin bulanıq variantıdır. */
(function () {
  "use strict";

  var BASE = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/[^\/]*$/, "") : "";
  })();

  var SLIDES = [
    { f: "hero/hero-1.jpg", t: "Aktiv imtahanlar" },
    { f: "hero/hero-2.jpg", t: "Qeydiyyat cədvəli" },
    { f: "hero/hero-3.jpg", t: "DQ Platform" },
    { f: "hero/hero-4.jpg", t: "Test pəncərəsi" },
    { f: "hero/hero-5.jpg", t: "Cavab kartı" },
    { f: "hero/hero-6.jpg", t: "Nəticə və cavab açarı" }
  ];
  var N = SLIDES.length, MS = 2000, idx = 0, timer = 0;

  var CSS = [
    /* 1-ci şəkil: «İmtahanlar» başlığı tünd rəngdə itirdi */
    ".ds-hd h2{color:#fff!important}",

    /* ---------- HERO ---------- */
    "#lxp .lxp-hero.hx{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:clamp(22px,4vw,48px);align-items:center;padding:clamp(24px,4vw,46px);margin-bottom:26px;border-radius:26px;overflow:hidden;isolation:isolate;color:#fff;",
    "background:radial-gradient(520px 300px at 92% 6%,rgba(217,164,65,.30),transparent 65%),radial-gradient(620px 380px at 0% 100%,rgba(63,116,201,.38),transparent 70%),linear-gradient(135deg,#061a47 0%,#0a2f7a 52%,#12408f 100%);",
    "box-shadow:0 24px 50px -20px rgba(8,43,87,.6),inset 0 0 0 1px rgba(255,255,255,.08)}",
    "#lxp .lxp-hero.hx:before{content:'';position:absolute;inset:0;width:auto;height:auto;border-radius:0;z-index:-1;animation:none;pointer-events:none;",
    "background:repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 44px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 44px);",
    "-webkit-mask-image:radial-gradient(circle at 70% 45%,#000,transparent 75%);mask-image:radial-gradient(circle at 70% 45%,#000,transparent 75%)}",
    "#lxp .lxp-hero.hx>*{max-width:none;margin:0}",
    ".hx-d{position:absolute;z-index:-1;border-radius:22%;transform:rotate(45deg);pointer-events:none;animation:hxF 9s ease-in-out infinite}",
    ".hx-d.a{width:150px;height:150px;left:-52px;bottom:-48px;background:linear-gradient(135deg,rgba(143,179,236,.38),rgba(63,116,201,.06))}",
    ".hx-d.b{width:92px;height:92px;right:44%;top:-36px;background:linear-gradient(135deg,rgba(217,164,65,.5),rgba(217,164,65,.05));animation-delay:-3s}",
    "@keyframes hxF{50%{transform:rotate(60deg) translate(10px,-14px)}}",

    /* mətn sütunu */
    ".hx-copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0}",
    "#lxp .hx h1{margin:18px 0 12px;font-size:clamp(28px,4.4vw,44px);line-height:1.1;text-align:left;letter-spacing:-.5px}",
    "#lxp .hx p{max-width:46ch;text-align:left;font-size:15.5px;line-height:1.7;opacity:.92}",
    ".hx-feats{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 0;padding:0;list-style:none}",
    ".hx-feats li{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:99px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);font-size:12.5px;font-weight:700;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
    "#lxp .hx .lxp-chk{position:static;margin:26px 0 0!important;padding:13px 24px;background:#fff;color:#082b57;box-shadow:0 10px 24px -8px rgba(0,0,0,.5),0 0 0 3px rgba(217,164,65,.0);transition:transform .25s,box-shadow .25s}",
    "#lxp .hx .lxp-chk:hover{transform:translateY(-2px);box-shadow:0 14px 28px -8px rgba(0,0,0,.55),0 0 0 3px rgba(217,164,65,.7)}",

    /* şəkil nümayişi */
    ".hx-show{min-width:0;display:flex;flex-direction:column;gap:12px}",
    ".hx-stage{position:relative;height:clamp(310px,42vw,480px);border-radius:22px;overflow:hidden;background:#0a1f4d;border:1px solid rgba(255,255,255,.22);box-shadow:0 28px 50px -22px rgba(0,0,0,.65),0 0 0 6px rgba(255,255,255,.06);touch-action:pan-y}",
    ".hx-s{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px 16px 58px;opacity:0;visibility:hidden;transition:opacity .7s ease,visibility 0s linear .7s}",
    ".hx-s.on{opacity:1;visibility:visible;transition-delay:0s}",
    ".hx-bg{position:absolute;inset:-30px;background-size:cover;background-position:center;filter:blur(26px) saturate(1.25) brightness(.78);opacity:.8}",
    ".hx-fg{position:relative;display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:12px;background:#fff;box-shadow:0 18px 40px -10px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.4);transform:scale(.94) translateY(8px);transition:transform .9s cubic-bezier(.22,.9,.24,1)}",
    ".hx-s.on .hx-fg{transform:none}",
    ".hx-prog{position:absolute;left:0;right:0;top:0;height:3px;z-index:3;background:rgba(255,255,255,.14)}",
    ".hx-prog i{display:block;height:100%;transform-origin:0 50%;transform:scaleX(0);background:linear-gradient(90deg,#d9a441,#f3d58d)}",
    ".hx-prog i.run{animation:hxP 2s linear forwards}",
    "@keyframes hxP{to{transform:scaleX(1)}}",
    ".hx-cap{position:absolute;left:14px;right:14px;bottom:12px;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 8px 8px 14px;border-radius:14px;background:rgba(6,26,71,.62);border:1px solid rgba(255,255,255,.16);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#fff;font-size:12.5px;font-weight:700}",
    ".hx-cap b{color:#f3d58d;font-variant-numeric:tabular-nums;margin-right:9px}",
    ".hx-cap em{font-style:normal}",
    ".hx-nav{display:flex;gap:6px;flex:none}",
    ".hx-nav button{width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:16px;line-height:1;cursor:pointer;transition:background .2s}",
    ".hx-nav button:hover{background:rgba(217,164,65,.8)}",
    ".hx-th{display:grid;grid-template-columns:repeat(var(--n,6),minmax(0,1fr));gap:8px}",
    ".hx-th button{aspect-ratio:1/1;padding:4px;border-radius:12px;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);cursor:pointer;transition:transform .25s,border-color .25s,background .25s}",
    ".hx-th img{display:block;width:100%;height:100%;object-fit:contain;border-radius:7px;background:#fff}",
    ".hx-th button.on{border-color:#d9a441;background:rgba(217,164,65,.24);transform:translateY(-3px)}",

    /* ---------- cədvəl kartı: səliqə ---------- */
    "#lxp .lxp-w{max-width:1180px}",
    "#lxp .lxp-card{padding:clamp(16px,2.4vw,26px)}",
    "#lxp .lxp-ch b{font-weight:800;letter-spacing:-.3px}",
    "#lxp .lxp-bt{transition:transform .2s,box-shadow .2s,background .2s}",
    "#lxp .lxp-bt:not(:disabled):hover{transform:translateY(-1px)}",

    /* mobil */
    "@media(max-width:860px){#lxp .lxp-hero.hx{grid-template-columns:minmax(0,1fr)}.hx-stage{height:clamp(300px,86vw,440px)}}",
    "@media(max-width:480px){#lxp .lxp-hero.hx{border-radius:20px}.hx-feats li{font-size:12px;padding:7px 11px}.hx-th{gap:6px}.hx-th button{border-radius:10px;padding:3px}.hx-cap{font-size:11.5px}.hx-nav{display:none}#lxp .hx .lxp-chk{width:100%}}",
    "@media(prefers-reduced-motion:reduce){.hx-d,.hx-prog i.run{animation:none!important}.hx-s,.hx-fg{transition:none!important}}"
  ].join("");

  function addCss() {
    if (document.getElementById("dq-hero-css")) return;
    var s = document.createElement("style");
    s.id = "dq-hero-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // hero/ qovluğunda olmayan şəkillər slayd-şoudan çıxarılır (qırıq şəkil görünməsin)
  function probe(sl) {
    return new Promise(function (res) {
      var i = new Image(); i.decoding = "async";
      i.onload = function () { res(sl); };
      i.onerror = function () { res(null); };
      i.src = BASE + sl.f;
    });
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function apply(box) {
    box.querySelectorAll(".hx-s").forEach(function (e, i) { e.classList.toggle("on", i === idx); });
    box.querySelectorAll(".hx-th button").forEach(function (e, i) { e.classList.toggle("on", i === idx); });
    box.querySelector(".hx-cap b").textContent = pad(idx + 1) + " / " + pad(N);
    box.querySelector(".hx-cap em").textContent = SLIDES[idx].t;
    var bar = box.querySelector(".hx-prog i");
    bar.classList.remove("run");
    void bar.offsetWidth;
    bar.classList.add("run");
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!document.querySelector("#lxp .hx-show")) { timer = 0; return; }
      if (document.hidden) { schedule(); return; }
      go(idx + 1);
    }, MS);
  }

  function go(n) {
    var box = document.querySelector("#lxp .hx-show");
    if (!box) return;
    idx = (n + N) % N;
    apply(box);
    schedule();
  }

  function build(hero) {
    if (hero.getAttribute("data-hx")) return;
    hero.setAttribute("data-hx", "1");
    hero.classList.add("hx");

    var bdg = hero.querySelector(".lxp-bdg"), h1 = hero.querySelector("h1"),
        p = hero.querySelector("p"), chk = hero.querySelector(".lxp-chk"),
        art = hero.querySelector(".lxp-art");
    if (art) art.remove();

    var copy = el("div", "hx-copy");
    [bdg, h1, p].forEach(function (n) { if (n) copy.appendChild(n); });
    copy.appendChild(el("ul", "hx-feats",
      "<li>⚡ Sürətli qeydiyyat</li><li>🔐 FİN kodla giriş</li><li>🔄 Canlı yenilənir</li>"));
    if (chk) copy.appendChild(chk);

    var slides = SLIDES.map(function (s, i) {
      var u = BASE + s.f;
      return '<div class="hx-s' + (i === idx ? " on" : "") + '"><div class="hx-bg" style="background-image:url(\'' + u +
        '\')"></div><img class="hx-fg" src="' + u + '" alt="' + s.t + '" decoding="async"></div>';
    }).join("");
    var thumbs = SLIDES.map(function (s, i) {
      return '<button type="button" data-i="' + i + '" aria-label="' + s.t + '"><img src="' + BASE + s.f + '" alt=""></button>';
    }).join("");

    var show = el("div", "hx-show",
      '<div class="hx-stage"><div class="hx-prog"><i></i></div>' + slides +
      '<div class="hx-cap"><span><b></b><em></em></span><span class="hx-nav">' +
      '<button type="button" data-d="-1" aria-label="Əvvəlki">‹</button>' +
      '<button type="button" data-d="1" aria-label="Növbəti">›</button></span></div></div>' +
      '<div class="hx-th" style="--n:' + N + '">' + thumbs + "</div>");

    show.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-d")) go(idx + +b.getAttribute("data-d"));
      else if (b.hasAttribute("data-i")) go(+b.getAttribute("data-i"));
    });
    var x0 = null;
    show.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    show.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    hero.appendChild(el("span", "hx-d a"));
    hero.appendChild(el("span", "hx-d b"));
    hero.appendChild(copy);
    hero.appendChild(show);

    apply(show);
    schedule();
  }

  function watch() {
    var body = document.getElementById("lxp-body");
    if (!body) return;
    if (body.__hx) return;
    body.__hx = 1;
    var run = function () {
      var h = body.querySelector(".lxp-hero:not([data-hx])");
      if (h) build(h);
    };
    new MutationObserver(run).observe(body, { childList: true });
    run();
  }

  addCss();
  Promise.all(SLIDES.map(probe)).then(function (ok) {
    SLIDES = ok.filter(Boolean);
    N = SLIDES.length;
    if (!N) return;                       /* şəkil yoxdur: köhnə hero olduğu kimi qalır */
    idx = 0;
    new MutationObserver(watch).observe(document.body, { childList: true });
    watch();
  });
})();
