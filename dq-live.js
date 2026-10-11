/* =====================================================================
   DQ Live v1.0 — saytın «canlılıq» qatı
   ---------------------------------------------------------------------
   • Düymələrə toxunanda dalğa (ripple) effekti
   • Kartlar/bloklar ekrana girəndə yumşaq görünmə animasiyası
   • İnternet kəsiləndə/qayıdanda ani bildiriş
   • Səhifə üstündə nazik yüklənmə xətti (ekran dəyişəndə)
   Mövcud kodu dəyişmir. dq-polish.js-dən sonra qoşulur.
   «Hərəkəti azalt» sistem ayarına hörmət edir.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqLive) return;
  window.__dqLive = 1;
  var D = document;
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) { }

  var RIPPLE = ".v3-bt,.btn,.lxp-bt,.dqm-b,.ds-go,.v3-b,.v3-chip,.admin-nav-card,.dq-regbtn,.v1b,.pu-chip,.hx-nav button";
  var REVEAL = ".v3-cd,.ds-c,.lxp-card,.lx-card,.nw-card,.dq-cd,.admin-nav-card,.dqm-sj";

  var css = [
    ".dql-rp{position:relative;overflow:hidden}",
    ".dql-w{position:absolute;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.45);transform:scale(0);animation:dqlW .6s ease-out forwards}",
    "@keyframes dqlW{to{transform:scale(1);opacity:0}}",
    ".dql-pre{opacity:0;transform:translateY(18px)}",
    ".dql-in{animation:dqlIn .55s cubic-bezier(.22,.9,.24,1) both;animation-delay:var(--dql-d,0ms)}",
    "@keyframes dqlIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}",
    "#dql-net{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));z-index:2147483250;transform:translate(-50%,-80px);padding:10px 18px;border-radius:99px;font:700 13px system-ui,sans-serif;color:#fff;background:#b45309;box-shadow:0 12px 28px -10px rgba(0,0,0,.5);transition:transform .45s cubic-bezier(.22,.9,.24,1);pointer-events:none}",
    "#dql-net.on{transform:translate(-50%,0)}#dql-net.ok{background:#047857}",
    "@media(prefers-reduced-motion:reduce){.dql-w{display:none}.dql-pre{opacity:1;transform:none}.dql-in{animation:none}}"
  ].join("");
  var st = D.createElement("style"); st.id = "dql-css"; st.textContent = css;
  (D.head || D.documentElement).appendChild(st);

  /* ---------- ripple ---------- */
  D.addEventListener("pointerdown", function (e) {
    if (reduce || e.button > 0) return;
    var t = e.target.closest && e.target.closest(RIPPLE);
    if (!t || t.disabled) return;
    var cs = getComputedStyle(t);
    if (cs.position === "static") t.style.position = "relative";
    t.classList.add("dql-rp");
    var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, w = D.createElement("span");
    w.className = "dql-w";
    w.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
    t.appendChild(w);
    setTimeout(function () { w.remove(); }, 650);
  }, { passive: true, capture: true });

  /* ---------- görünmə animasiyası ---------- */
  var io = null, seen = new WeakSet();
  if (!reduce && "IntersectionObserver" in window) {
    io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting) return;
        var el = x.target; io.unobserve(el);
        el.classList.remove("dql-pre");
        el.classList.add("dql-in");
        setTimeout(function () { el.classList.remove("dql-in"); }, 1400);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
  }
  function scan(root) {
    if (!io) return;
    var list = (root || D).querySelectorAll ? (root || D).querySelectorAll(REVEAL) : [];
    var i = 0;
    [].forEach.call(list, function (el) {
      if (seen.has(el)) return;
      seen.add(el);
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;                     /* gizli ekran: öz animasiyası var */
      if (r.top > innerHeight * 0.98) {                       /* aşağıda: scroll edəndə açılsın */
        el.classList.add("dql-pre"); io.observe(el);
        /* təhlükəsizlik: heç vaxt görünməz qalmasın */
        setTimeout(function () { if (el.classList.contains("dql-pre") && el.getBoundingClientRect().top < innerHeight) { el.classList.remove("dql-pre"); } }, 6000);
      } else {                                                /* ekrandadır: stagger ilə girsin */
        el.style.setProperty("--dql-d", Math.min(i++, 8) * 55 + "ms");
        el.classList.add("dql-in");
        setTimeout(function () { el.classList.remove("dql-in"); }, 1400);
      }
    });
  }
  var sched = 0;
  function later() {
    if (sched) return;
    sched = setTimeout(function () { sched = 0; scan(); }, 180);
  }
  try { new MutationObserver(later).observe(D.body, { childList: true, subtree: true }); } catch (e) { }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", later); else later();

  /* ---------- internet bildirişi ---------- */
  var net = null, nt = 0;
  function note(ok) {
    if (!net) { net = D.createElement("div"); net.id = "dql-net"; net.setAttribute("role", "status"); D.body.appendChild(net); }
    net.className = "on" + (ok ? " ok" : "");
    net.textContent = ok ? "✅ İnternet bərpa olundu" : "⚠️ İnternet bağlantısı kəsildi";
    clearTimeout(nt);
    nt = setTimeout(function () { net.classList.remove("on"); }, ok ? 2600 : 5000);
  }
  window.addEventListener("offline", function () { note(false); });
  window.addEventListener("online", function () { note(true); });
})();
