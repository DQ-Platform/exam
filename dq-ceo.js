/* DQ Platform — CEO girişi: /ysl (və ya ?ceo=1) + «Bu cihazı yadda saxla»
   Doğrulama mövcud admin girişindədir (Supabase e-poçt kodu, yalnız admin e-poçtu).
   Bu fayl app.js-dən ƏVVƏL yüklənməlidir. */
(function () {
  "use strict";
  var TK = "dq_adm_tok", LG = "dq_admin_logged", PREF = "dq_ceo_remember", ALIVE = "dq_ceo_alive";
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ss(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  /* 1) «Yadda saxlama» söndürülübsə: yeni brauzer sessiyasında giriş silinir */
  try {
    if (ls(PREF) === "0" && !ss(ALIVE)) { localStorage.removeItem(TK); localStorage.removeItem(LG); }
    else if (ls(TK)) sessionStorage.setItem(ALIVE, "1");
  } catch (e) {}

  /* 2) Giriş pəncərəsinə «Bu cihazı yadda saxla» qutusu (standart: işarəli) */
  function addBox() {
    var ov = document.getElementById("dq-adm-ov"); if (!ov || document.getElementById("dq-rem")) return;
    var a2 = document.getElementById("dq-a2"); if (!a2) return;
    var lb = document.createElement("label");
    lb.id = "dq-rem"; lb.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0 4px;font-size:14px;color:#0b2a6b;cursor:pointer";
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = ls(PREF) !== "0";
    cb.style.cssText = "width:18px;height:18px;margin:0;padding:0";
    cb.onchange = function () { try { localStorage.setItem(PREF, cb.checked ? "1" : "0"); } catch (e) {} };
    lb.appendChild(cb); lb.appendChild(document.createTextNode("Bu cihazı yadda saxla"));
    a2.parentNode.insertBefore(lb, a2);
  }
  var wasOpen = false;
  function watch() {
    var ov = document.getElementById("dq-adm-ov");
    if (ov) addBox();
    if (wasOpen && !ov && ls(TK)) { try { sessionStorage.setItem(ALIVE, "1"); } catch (e) {} }   /* giriş uğurlu oldu */
    wasOpen = !!ov;
  }
  function startWatch() {
    try { new MutationObserver(watch).observe(document.body, { childList: true, subtree: true }); } catch (e) { setInterval(watch, 500); }
  }
  if (document.body) startWatch(); else document.addEventListener("DOMContentLoaded", startWatch);

  /* 3) /ysl (və ya ?ceo=1) birbaşa girişi */
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  if (!(path === "/ysl" || new URLSearchParams(location.search).get("ceo") === "1")) return;
  var H = document.documentElement; H.classList.add("dq-ceo");
  var st = document.createElement("style");
  st.textContent = "html.dq-ceo:not(.dq-ceo-in) body>*:not(#dq-adm-ov):not(#dq-adm-bar):not(script):not(style){filter:blur(6px) brightness(.55);pointer-events:none}";
  (document.head || H).appendChild(st);
  var t0 = Date.now(), tried = false, opened = false;
  (function poll() {
    var ov = document.getElementById("dq-adm-ov"), now = Date.now() - t0;
    if (window.__dqAuthed === true) {                       /* artıq daxil olub (yadda saxlanılıb) */
      H.classList.add("dq-ceo-in");
      if (!opened) { opened = true; try { if (typeof V2 !== "undefined" && V2.open) V2.open(); } catch (e) {} }
      return;
    }
    var hasTok = !!ls(TK);
    if (!tried && (!hasTok || now > 5000)) {               /* token varsa, yoxlanmasını 5 san-ə qədər gözlə */
      var b = document.getElementById("dq-adm-login");
      if (b) { tried = true; b.click(); }
    }
    if (ov) { var i = document.getElementById("dq-a1"); if (i && document.activeElement !== i) try { i.focus(); } catch (e) {} }
    if (tried && !ov) H.classList.add("dq-ceo-in");
    if (now < 90000) setTimeout(poll, 400);
  })();
})();
