/* DQ Platform — CEO girişi: /ysl (və ya ?ceo=1) linki
   Mövcud admin girişini (Supabase e-poçt kodu, yalnız dqplatform7@gmail.com) birbaşa açır.
   Heç bir parol və ya e-poçt yoxlaması bu faylda deyil — doğrulama mövcud girişdədir. */
(function () {
  "use strict";
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  var on = path === "/ysl" || new URLSearchParams(location.search).get("ceo") === "1";
  if (!on) return;
  document.documentElement.classList.add("dq-ceo");
  var st = document.createElement("style");
  st.textContent = "html.dq-ceo body>*:not(#dq-adm-ov):not(#dq-adm-bar):not(script):not(style){filter:blur(6px) brightness(.55);pointer-events:none}" +
    "html.dq-ceo.dq-ceo-in body>*{filter:none!important;pointer-events:auto!important}";
  document.head.appendChild(st);
  var t0 = Date.now(), tried = false;
  (function poll() {
    var bar = document.getElementById("dq-adm-bar"), ov = document.getElementById("dq-adm-ov");
    if (bar && bar.offsetParent !== null && !ov) {       /* artıq daxil olub */
      document.documentElement.classList.add("dq-ceo-in"); return;
    }
    var b = document.getElementById("dq-adm-login");
    if (b && !tried) { tried = true; b.click(); }
    if (ov) { var i = document.getElementById("dq-a1"); if (i && document.activeElement !== i) try { i.focus(); } catch (e) {} }
    /* giriş uğurlu olduqda (modal bağlanır, panel/bar görünür) bulanıqlığı götür */
    if (tried && !ov) document.documentElement.classList.add("dq-ceo-in");
    if (Date.now() - t0 < 60000) setTimeout(poll, 400);
  })();
})();
