/* DQ Platform — dq-home-news.js (v1)
   "📢 Yeniliklər" slayderini ana səhifənin SONUNDA, "Dövlət qulluğu hədəfinə doğru ilk addımı at!"
   blokunun yerində (üstündə) göstərir. Kabinetə daxil olmuş istifadəçidə isə həmin çağırış bloku gizlənir, yeniliklər qalır.
   Qoşulma: index.html-də dq-home2.js-dən SONRA:  <script src="dq-home-news.js?v=1"></script> */
(function () {
  "use strict";
  if (window.__dqHomeNews) return;
  window.__dqHomeNews = 1;

  var CTA_TXT = "hədəfinə doğru";
  var WHY_TXT = "Niyə məhz";

  /* ---------- CSS ---------- */
  var css =
    /* yeniliklər həm qonaq, həm daxil olmuş istifadəçi üçün görünür */
    "#v3-home #yq-news.dqn-host{display:block!important;max-width:1020px;margin:26px auto 22px!important;padding:0 14px!important}" +
    "#v3-home #yq-news.dqn-host>.dqn-title,#v3-home #yq-news.dqn-host>.dqn-sub,#v3-home #yq-news.dqn-host>.dqn,#v3-home #yq-news.dqn-host>.dqn-all{display:block!important}" +
    "#v3-home #yq-news.dqn-host>.dq2n{display:none!important}" +
    /* daxil olmuş istifadəçi: "Qeydiyyatdan keç" çağırış bloku yox olur */
    ".dq-hn-cta-off{display:none!important}";
  var st = document.createElement("style");
  st.id = "dq-home-news-css";
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- daxil olub-olmadığını yoxla ---------- */
  function authed() {
    try {
      if (document.body.classList.contains("dq-authed")) return true;
      if (window.DQ && typeof DQ.cabinet === "function" && DQ.cabinet()) return true;
      if (localStorage.getItem("dq_cabinet")) return true;
      if (localStorage.getItem("dq_yq_sess")) return true;
    } catch (e) { }
    return false;
  }

  /* ---------- "Dövlət qulluğu hədəfinə doğru..." blokunu tap ---------- */
  function norm(t) { return String(t || "").replace(/[\s\u00a0\u200b]+/g, " ").toLowerCase(); }
  var RX = /h[əe]d[əe]fin[əe]\s+do[ğg]ru|add[ıi]m[ıi]n[ıi]\s+at/;

  function findCta(home) {
    var best = null;
    /* 1) mətn düyünləri üzrə axtarış (mətn bölünmüş olsa da, ən yaxın element tapılır) */
    var w = document.createTreeWalker(home, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (RX.test(norm(n.nodeValue))) { best = n.parentElement; break; }
    }
    /* 2) ehtiyat: bütöv element mətni üzrə */
    if (!best) {
      var all = home.querySelectorAll("div,section,h2,h3,h4,p,span,b,strong");
      for (var i = 0; i < all.length; i++) {
        var t = norm(all[i].textContent);
        if (t.length < 200 && RX.test(t)) { best = all[i]; break; }
      }
    }
    if (!best) return null;
    /* yuxarı qalx: zolağın özünü (düymə ilə) tut, "Niyə məhz" / statistika / hero bölməsinə çatma */
    var el = best;
    while (el.parentElement && el.parentElement !== home) {
      var p = el.parentElement, pt = norm(p.textContent);
      if (pt.indexOf("niyə məhz") > -1 || pt.indexOf("niye mehz") > -1 || p.querySelector("#dq-stats") ||
          p.querySelector("#dt-home,#dt-grid,.v3-ft") || pt.length > 600) break;
      el = p;
    }
    return el;
  }

  /* ---------- yerləşdir ---------- */
  function place() {
    var home = document.getElementById("v3-home");
    var box = document.getElementById("yq-news");
    if (!home) return;

    var ref = findCta(home);
    if (ref) {
      var off = authed();
      ref.classList.toggle("dq-hn-cta-off", off);
      if (off) ref.style.setProperty("display", "none", "important"); else ref.style.removeProperty("display");
    }

    if (!box) return;
    if (ref && ref.parentNode) {
      if (box.nextElementSibling !== ref || box.parentNode !== ref.parentNode) ref.parentNode.insertBefore(box, ref);
      return;
    }
    /* ehtiyat: statistika kartlarından əvvəl, yoxsa footer-dən əvvəl */
    var fb = document.getElementById("dq-stats") || home.querySelector(".v3-ft");
    if (fb && fb.parentNode && (box.nextElementSibling !== fb || box.parentNode !== fb.parentNode)) {
      fb.parentNode.insertBefore(box, fb);
    }
  }

  var timer = 0;
  function soon() { clearTimeout(timer); timer = setTimeout(place, 80); }

  /* ana səhifə dinamik qurulduğu üçün dəyişiklikləri izləyirik */
  var mo = new MutationObserver(soon);
  function start() {
    var home = document.getElementById("v3-home");
    if (home) mo.observe(home, { childList: true, subtree: false });
    place();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  /* ilk saniyələrdə və sonra seyrək yoxlama (login/logout, yenidən render) */
  var n = 0, iv = setInterval(function () { place(); if (++n > 40) { clearInterval(iv); setInterval(place, 2500); } }, 250);
  window.addEventListener("dq-news-fresh", soon);
  window.addEventListener("storage", soon);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) soon(); });
})();
