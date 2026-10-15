/* DQ Platform — dq-home-news.js (v3)
   1) "📢 Yeniliklər" slayderi ana səhifənin sonunda, "Dövlət qulluğu hədəfinə doğru ilk addımı at!" blokunun üstündə.
   2) Həmin çağırış bloku YALNIZ yeni (daxil olmamış) istifadəçilərə görünür; kabinetə daxil olan və ya
      qeydiyyatdan keçən istifadəçidə yox olur. Yeniliklər hər kəsdə qalır.
   Qoşulma: index.html-də dq-home2.js-dən SONRA: <script src="dq-home-news.js?v=3"></script> */
(function () {
  "use strict";
  if (window.__dqHomeNews) return;
  window.__dqHomeNews = 1;

  var css =
    "#v3-home #yq-news.dqn-host{display:block!important;max-width:1020px;margin:26px auto 22px!important;padding:0 14px!important}" +
    "#v3-home #yq-news.dqn-host>.dqn-title,#v3-home #yq-news.dqn-host>.dqn-sub,#v3-home #yq-news.dqn-host>.dqn,#v3-home #yq-news.dqn-host>.dqn-all{display:block!important}" +
    "#v3-home #yq-news.dqn-host>.dq2n{display:none!important}" +
    ".dq-hn-cta-off{display:none!important}";
  var st = document.createElement("style");
  st.id = "dq-home-news-css";
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- mətni sadələşdir: ligatur, diakritika, ə/ı/ö/ü/ğ/ç/ş → latın ---------- */
  var MAP = { "ə": "e", "ı": "i", "ö": "o", "ü": "u", "ğ": "g", "ç": "c", "ş": "s", "İ": "i", "Ə": "e" };
  function norm(t) {
    t = String(t || "");
    try { t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { }
    return t.toLowerCase().replace(/[əıöüğçşİƏ]/g, function (c) { return MAP[c] || c; })
      .replace(/[\s\u00a0\u200b]+/g, " ");
  }
  var RX_CTA = /hedefin\w*\s+dogru|adimin\w*\s+at/;
  var RX_WHY = /niye\s+mehz/;
  var RX_BTN = /qeydiyyatdan\s+kec/;

  /* ---------- giriş edibmi? ---------- */
  function authed() {
    try {
      if (document.body.classList.contains("dq-authed")) return true;
      if (window.DQ && typeof DQ.cabinet === "function" && DQ.cabinet()) return true;
      if (localStorage.getItem("dq_cabinet")) return true;
      if (localStorage.getItem("dq_yq_sess")) return true;
    } catch (e) { }
    return false;
  }

  function firstTextEl(root, rx, maxLen) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (rx.test(norm(n.nodeValue))) return n.parentElement;
    }
    var all = root.querySelectorAll("div,section,h1,h2,h3,h4,p,span,b,strong,a,button");
    for (var i = 0; i < all.length; i++) {
      var t = norm(all[i].textContent);
      if (t.length < (maxLen || 200) && rx.test(t)) return all[i];
    }
    return null;
  }

  function stopClimb(p) {
    if (!p || p === document.body || p === document.documentElement) return true;
    if (p.id === "v3-home" || p.id === "yq-news") return true;
    var t = norm(p.textContent);
    return RX_WHY.test(t) || !!p.querySelector("#dq-stats,#yq-news,#dt-home,#dt-grid,.v3-ft,.v3-hero") || t.length > 700;
  }

  /* ---------- çağırış blokunu tap ---------- */
  function findCta() {
    var home = document.getElementById("v3-home") || document.body;
    var seed = firstTextEl(home, RX_CTA, 200);

    /* ehtiyat: "Niyə məhz" başlığından sonrakı qardaş, içində "Qeydiyyatdan keç" olan blok */
    if (!seed) {
      var why = firstTextEl(home, RX_WHY, 120), el = why;
      for (var up = 0; el && up < 8 && !seed; up++, el = el.parentElement) {
        var sib = el.nextElementSibling, k = 0;
        while (sib && k++ < 3) {
          var tt = norm(sib.textContent);
          if (tt.length < 220 && RX_BTN.test(tt)) { seed = sib; break; }
          sib = sib.nextElementSibling;
        }
      }
    }
    if (!seed) return null;

    var el2 = seed;
    while (el2.parentElement && !stopClimb(el2.parentElement)) el2 = el2.parentElement;
    return el2;
  }

  /* ---------- tətbiq et ---------- */
  var warned = false;
  function place() {
    var home = document.getElementById("v3-home");
    if (!home) return;
    var box = document.getElementById("yq-news");
    var ref = findCta();
    var off = authed();

    window.__dqHn = { found: !!ref, authed: off };

    if (ref) {
      ref.classList.toggle("dq-hn-cta-off", off);
      if (off) ref.style.setProperty("display", "none", "important");
      else ref.style.removeProperty("display");
    } else if (!warned && home.querySelector(".v3-ft,#dq-stats")) {
      warned = true;
      try { console.warn("[dq-home-news] çağırış bloku tapılmadı"); } catch (e) { }
    }

    if (!box) return;
    if (ref && ref.parentNode) {
      if (box.nextElementSibling !== ref || box.parentNode !== ref.parentNode) ref.parentNode.insertBefore(box, ref);
      return;
    }
    var fb = document.getElementById("dq-stats") || home.querySelector(".v3-ft");
    if (fb && fb.parentNode && (box.nextElementSibling !== fb || box.parentNode !== fb.parentNode)) fb.parentNode.insertBefore(box, fb);
  }

  var timer = 0;
  function soon() { clearTimeout(timer); timer = setTimeout(place, 60); }

  function start() {
    try {
      new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      var home = document.getElementById("v3-home");
      if (home) new MutationObserver(soon).observe(home, { childList: true, subtree: true });
    } catch (e) { }
    place();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  setInterval(place, 700); /* giriş/çıxış və yenidən render üçün yüngül yoxlama */
  window.addEventListener("dq-news-fresh", soon);
  window.addEventListener("storage", soon);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) soon(); });
})();
