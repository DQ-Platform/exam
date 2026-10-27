/* =====================================================================
   DQ Açıq sual seçicisi — dq-open-pro.js?v=1   (index.html-in ən sonunda yüklənir)
   Problem: «Çoxseçimli cavab seçicisi» həmişə 1–5 dairə göstərirdi.
   Həll:
     • Sualda neçə nömrəli punkt (1. 2. 3. …) varsa, o qədər dairə çıxır (məs. 8 punkt → 8 dairə).
     • Dairəyə də, sualın mətnindəki rəqəmin özünə də toxunanda seçilir (rəng dəyişir),
       seçim avtomatik cavab xanasına yazılır. Yenidən toxunsan seçim götürülür.
     • Punkt yoxdursa (hesablama sualı) dairələr ümumiyyətlə çıxmır — yalnız
       «Cavabı daxil edin» xanası qalır.
     • Cavab xanasına əl ilə yazmaq da işləyir; dairələr yazıya uyğun yenilənir.
     • Cavabın formatı (1,3,4 / 134) sualın düzgün cavabına uyğun seçilir.
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQOpenPro) return;
  var D = document, NAVY = "#0b2a6b", GOLD = "#c9a063";

  function css() {
    if (D.getElementById("dqo-css")) return;
    var s = D.createElement("style"); s.id = "dqo-css";
    s.textContent =
      ".dqo-box{margin:12px 0 4px;padding:10px 12px;border:1.5px solid #cfd8ea;border-radius:14px;background:#f8faff;text-align:left}" +
      ".dqo-box .dqo-h{font:800 12.5px/1.2 Mulish,system-ui,Arial,sans-serif;color:" + NAVY + ";margin:0 0 8px}" +
      ".dqo-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dqo-c{width:38px;height:38px;border-radius:50%;border:2px solid " + NAVY + ";background:#fff;color:" + NAVY + ";font:800 15px Mulish,system-ui,Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all .15s;-webkit-tap-highlight-color:transparent}" +
      ".dqo-c.on{background:" + NAVY + ";color:#fff;box-shadow:0 3px 10px rgba(11,42,107,.35);transform:scale(1.06)}" +
      ".dqo-c:disabled{opacity:.5;cursor:not-allowed}" +
      ".dqo-clr{margin-left:6px;border:1.5px solid #b42318;color:#b42318;background:#fff;border-radius:10px;padding:7px 12px;font:700 12.5px Mulish,system-ui,Arial,sans-serif;cursor:pointer}" +
      ".dqo-sum{margin-top:8px;font:600 13px Mulish,system-ui,Arial,sans-serif;color:#475569}.dqo-sum b{color:" + NAVY + ";letter-spacing:1px}" +
      ".dqo-n{display:inline-flex;align-items:center;justify-content:center;min-width:1.55em;height:1.55em;margin-right:.25em;border-radius:50%;border:1.6px solid " + NAVY + ";color:" + NAVY + ";font-weight:800;font-size:.86em;line-height:1;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;transition:all .15s;vertical-align:middle}" +
      ".dqo-n.on{background:" + NAVY + ";color:#fff}" +
      ".dqo-lbl{font-weight:800;font-size:14px;color:#1c2333;margin:10px 0 4px;display:block}";
    D.head.appendChild(s);
  }

  function curQ() {
    try { return allQuestions[currentQuestionIndex] || null; } catch (e) { return null; }
  }

  /* neçə nömrəli punkt var? */
  function countPoints(host, inputZone) {
    var txt = (host.innerText || host.textContent || "");
    var lines = txt.split(/\n+/), n = 0, i, m;
    for (i = 0; i < lines.length; i++) {
      m = /^\s*(\d{1,2})\s*[.)]\s*\S/.exec(lines[i]);
      if (m && +m[1] === n + 1) n++;
    }
    if (n >= 2) return n;
    var q = curQ();
    if (q && Array.isArray(q.options)) {
      var c = 0;
      q.options.forEach(function (o) {
        var t = (o && typeof o === "object") ? (o.text || o.image) : o;
        if (t != null && String(t).replace(/<[^>]*>/g, "").trim()) c++;
      });
      if (c >= 2) return Math.min(c, 12);
    }
    return 0;
  }

  function sepFor(q) {
    var c = q && q.correct != null ? String(q.correct) : "";
    if (/,/.test(c)) return ",";
    if (/^\d{2,}$/.test(c)) return "";
    return ",";
  }
  function parseSel(v, n) {
    v = String(v || "").trim();
    if (!v) return [];
    var parts = /[^\d]/.test(v) ? v.split(/[^\d]+/) : (n >= 10 ? [v] : v.split(""));
    var set = {}, out = [];
    parts.forEach(function (p) { var k = +p; if (k >= 1 && k <= n && !set[k]) { set[k] = 1; out.push(k); } });
    return out.sort(function (a, b) { return a - b; });
  }

  function fire(el) {
    ["input", "change", "keyup"].forEach(function (t) {
      try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) { }
    });
  }

  function findInput(cont) {
    var list = cont.querySelectorAll("input.form-control, input[type=text]");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.id === "ie-open-correct" || el.closest(".ie-bar")) continue;
      return el;
    }
    return null;
  }

  /* köhnə «Çoxseçimli cavab seçicisi» bloklarını gizlət */
  function hideOld(cont, input) {
    var all = cont.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest(".dqo-box") || el.children.length > 12) continue;
      var own = "";
      for (var k = 0; k < el.childNodes.length; k++) if (el.childNodes[k].nodeType === 3) own += el.childNodes[k].nodeValue;
      if (!/[Çç]oxse[çc]imli/i.test(own)) continue;
      var top = el, p = el.parentElement;
      while (p && p !== cont && !p.contains(input) && !p.querySelector("#single-question-container") && (p.textContent || "").length < 160) { top = p; p = p.parentElement; }
      top.style.display = "none";
      top.setAttribute("data-dqo-old", "1");
    }
  }

  function wrapNumbers(host, n, toggle, isOn) {
    if (host.getAttribute("data-dqo-wrapped") === String(n)) return;
    var html = host.innerHTML, count = 0;
    var re = /(^|<br\s*\/?>|<p[^>]*>|<\/p>|<li[^>]*>|\n)(\s*)(\d{1,2})(\s*[.)])(?=\s*\S)/gi;
    html = html.replace(re, function (all, pre, sp, num, dot) {
      var k = +num;
      if (k !== count + 1 || k > n) return all;
      count++;
      return pre + sp + '<span class="dqo-n" role="button" tabindex="0" data-k="' + k + '" aria-label="' + k + ' seç">' + num + "</span>" + dot;
    });
    if (!count) return;
    host.innerHTML = html;
    host.setAttribute("data-dqo-wrapped", String(n));
    host.addEventListener("click", function (e) {
      var s = e.target.closest ? e.target.closest(".dqo-n") : null;
      if (s) { e.preventDefault(); e.stopPropagation(); toggle(+s.getAttribute("data-k")); }
    });
    host.addEventListener("keydown", function (e) {
      var s = e.target.closest ? e.target.closest(".dqo-n") : null;
      if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(+s.getAttribute("data-k")); }
    });
  }

  function enhance() {
    var cont = D.getElementById("single-question-container");
    if (!cont) return;
    var scr = D.getElementById("exam-screen");
    if (!scr || !scr.classList.contains("active")) return;
    var qs = cont.querySelector(".question-title, .question-text");
    if (cont.querySelector("#ie-open-correct")) return;              /* redaktor rejimi: öz sahəsi var */
    var input = findInput(cont);
    if (!input) return;
    var grp = input.closest(".form-group") || input.parentElement;
    if (!/[Aa][çc][ıi]q/.test((grp && grp.textContent) || "") && !cont.querySelector("[data-dqo-old]") && !/[Çç]oxse[çc]imli/i.test(cont.textContent || "")) return;
    css();
    hideOld(cont, input);

    var q = curQ(), host = qs || cont;
    var n = countPoints(host, grp);
    var sep = sepFor(q);
    var key = (q ? (q.id || currentQuestionIndex) : "x") + "|" + n;
    var box = cont.querySelector(".dqo-box");
    if (box && box.getAttribute("data-key") === key) { sync(); return; }
    if (box) box.remove();
    if (qs) qs.removeAttribute("data-dqo-wrapped");

    /* sual mətnində «Cavabı daxil edin» başlığı */
    var lab = grp.querySelector("label");
    if (lab) lab.classList.add("dqo-lbl");

    function selNow() { return parseSel(input.value, n); }
    function toggle(k) {
      if (input.disabled || input.readOnly) return;
      var cur = selNow(), i = cur.indexOf(k);
      if (i > -1) cur.splice(i, 1); else cur.push(k);
      cur.sort(function (a, b) { return a - b; });
      input.value = cur.join(sep);
      fire(input);
      sync();
    }
    function sync() {
      var cur = selNow(), set = {};
      cur.forEach(function (k) { set[k] = 1; });
      [].forEach.call(cont.querySelectorAll(".dqo-c"), function (b) { b.classList.toggle("on", !!set[+b.getAttribute("data-k")]); b.setAttribute("aria-pressed", set[+b.getAttribute("data-k")] ? "true" : "false"); });
      [].forEach.call(cont.querySelectorAll(".dqo-n"), function (b) { b.classList.toggle("on", !!set[+b.getAttribute("data-k")]); });
      var sm = cont.querySelector(".dqo-sum b");
      if (sm) sm.textContent = cur.length ? cur.join(sep ? ", " : " ") : "—";
    }

    if (n >= 2) {
      box = D.createElement("div");
      box.className = "dqo-box"; box.setAttribute("data-key", key);
      var h = '<div class="dqo-h">Çoxseçimli cavab — doğru hesab etdiyiniz nömrələrə toxunun</div><div class="dqo-row">';
      for (var i = 1; i <= n; i++) h += '<button type="button" class="dqo-c" data-k="' + i + '" aria-pressed="false">' + i + "</button>";
      h += '<button type="button" class="dqo-clr">Təmizlə</button></div><div class="dqo-sum">Seçilən: <b>—</b></div>';
      box.innerHTML = h;
      grp.parentNode.insertBefore(box, grp.nextSibling);
      box.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("button") : null;
        if (!b) return;
        if (b.classList.contains("dqo-clr")) { input.value = ""; fire(input); sync(); return; }
        toggle(+b.getAttribute("data-k"));
      });
      if (input.disabled || input.readOnly) [].forEach.call(box.querySelectorAll("button"), function (b) { b.disabled = true; });
      wrapNumbers(host, n, toggle);
    } else {
      /* hesablama sualı: yalnız cavab xanası */
      box = D.createElement("div"); box.className = "dqo-box"; box.style.display = "none"; box.setAttribute("data-key", key);
      grp.parentNode.insertBefore(box, grp.nextSibling);
    }
    if (!input.__dqo) {
      input.__dqo = 1;
      input.addEventListener("input", function () { var c = D.getElementById("single-question-container"); if (c) { [].forEach.call(c.querySelectorAll(".dqo-c"), function () { }); } try { sync2(); } catch (e) { } });
    }
    function sync2() { sync(); }
    sync();
  }

  var raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; try { enhance(); } catch (e) { } }); }

  function start() {
    var cont = D.getElementById("single-question-container");
    if (!cont) return setTimeout(start, 400);
    new MutationObserver(schedule).observe(cont, { childList: true, subtree: true });
    setInterval(schedule, 1200);
    schedule();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", start); else start();

  window.DQOpenPro = { refresh: enhance };
})();
