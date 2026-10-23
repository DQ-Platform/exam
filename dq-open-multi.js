/* DQ Open-Multi: BA kateqoriyasında açıq suallar çox seçimli (1,2,3…) göstərilir.
   Cavab "2,4" kimi normallaşdırılır → mövcud bal/nəticə kodu (mətn müqayisəsi) olduğu kimi işləyir.
   app.js-dən SONRA yüklənməlidir. */
(function () {
  "use strict";
  var CSS =
    ".dqom{margin-top:16px;display:flex;flex-direction:column;gap:10px}" +
    ".dqom-hint{font-size:13px;font-weight:600;color:var(--text-main,#334155);opacity:.75;margin-bottom:2px}" +
    ".dqom-opt{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;border:1px solid var(--border-color,#d8e0ec);border-radius:10px;background:#fff;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;transition:border-color .15s,background .15s,box-shadow .15s}" +
    ".dqom-opt:hover{border-color:var(--accent-blue,#2f63bd)}" +
    ".dqom-opt:focus-visible{outline:2px solid var(--accent-blue,#2f63bd);outline-offset:2px}" +
    ".dqom-box{flex:0 0 auto;width:20px;height:20px;margin-top:1px;border:1.5px solid #94a3b8;border-radius:5px;background:#fff;display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s}" +
    ".dqom-no{flex:0 0 auto;font-weight:800;min-width:18px;color:var(--primary-dark,#082b57)}" +
    ".dqom-tx{flex:1 1 auto;min-width:0;line-height:1.5;color:var(--text-main,#1b2433)}" +
    ".dqom-tx p{margin:0}.dqom-tx img{max-width:100%;height:auto;display:block;margin-top:6px}" +
    ".dqom-opt.on{border-color:var(--accent-blue,#2f63bd);background:#eef3fc;box-shadow:0 0 0 1px var(--accent-blue,#2f63bd) inset}" +
    ".dqom-opt.on .dqom-box,.dqom-opt.ok .dqom-box{background:var(--accent-blue,#2f63bd);border-color:var(--accent-blue,#2f63bd)}" +
    ".dqom-opt.on .dqom-box:after,.dqom-opt.ok .dqom-box:after{content:'';width:9px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translate(1px,-1px)}" +
    ".dqom-opt.ok{border-color:#15803d;background:#f0fdf4;box-shadow:none}" +
    ".dqom-opt.ok .dqom-box{background:#15803d;border-color:#15803d}" +
    ".dqom-opt.bad{border-color:#b91c1c;background:#fef2f2}" +
    ".dqom-opt.bad .dqom-box{background:#b91c1c;border-color:#b91c1c}" +
    ".dqom-opt.bad .dqom-box:after{content:'\\2715';color:#fff;font-size:11px;font-weight:800;line-height:1}" +
    ".dqom-opt.lock{cursor:default}.dqom-opt.lock:hover{border-color:var(--border-color,#d8e0ec)}.dqom-opt.lock.ok:hover{border-color:#15803d}.dqom-opt.lock.bad:hover{border-color:#b91c1c}";

  function css() {
    if (document.getElementById("dqom-css")) return;
    var s = document.createElement("style");
    s.id = "dqom-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* "B, D" / "2;4" / "42" → "2,4" ; boşdursa "" ; tanınmırsa null */
  function canon(v) {
    var s = String(v == null ? "" : v).toUpperCase().trim();
    if (!s) return "";
    if (!/^[1-9A-F\s,;.\-–\/+]+$/.test(s)) return null;
    var a = s.match(/[1-9A-F]/g) || [], seen = {}, out = [];
    a.forEach(function (c) {
      var n = /\d/.test(c) ? +c : c.charCodeAt(0) - 64;
      if (!seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.sort(function (x, y) { return x - y; }).join(",");
  }
  function set(v) {
    var c = canon(v), m = {};
    (c || "").split(",").forEach(function (x) { if (x) m[x] = 1; });
    return m;
  }
  function otext(o) { return o && typeof o === "object" ? o.text || "" : o == null ? "" : String(o); }
  function oimg(o) { return o && typeof o === "object" ? o.image || o.img || "" : ""; }
  function clean(h) { try { return typeof dqClean === "function" ? dqClean(h) : h; } catch (e) { return h; } }

  function isBA() { try { return String(userGroup || "").toUpperCase() === "BA"; } catch (e) { return false; } }
  function isOpenNo(n) { try { return openQuestionIds.indexOf(n) > -1; } catch (e) { return false; } }
  function hasOpts(q) {
    return Array.isArray(q && q.options) &&
      q.options.filter(function (o) { return String(otext(o)).trim() || oimg(o); }).length >= 2;
  }
  function multi(q, n) {
    if (!q || !isBA() || !isOpenNo(n) || !hasOpts(q)) return false;
    var c = canon(q.correct);
    return c !== null && c !== "";
  }
  function qno(q, i) { return q.id || i + 1; }

  /* bütün sualların düzgün cavabını kanonik formaya gətir (balın müqayisəsi üçün) */
  function normAll() {
    try {
      (allQuestions || []).forEach(function (q, i) {
        if (multi(q, qno(q, i))) q.correct = canon(q.correct);
      });
    } catch (e) {}
  }

  function paint(root, n, q) {
    var chosen = set(userAnswers[n]), right = set(q.correct), rev = false;
    try { rev = !!isReviewMode; } catch (e) {}
    [].forEach.call(root.querySelectorAll(".dqom-opt"), function (el) {
      var k = el.getAttribute("data-n"), on = !!chosen[k];
      el.classList.toggle("on", on && !rev);
      el.classList.toggle("ok", rev && !!right[k]);
      el.classList.toggle("bad", rev && on && !right[k]);
      el.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  window.dqOmToggle = function (n, k) {
    try { if (examFinished || isReviewMode) return; } catch (e) {}
    var cur = set(userAnswers[n]);
    if (cur[k]) delete cur[k]; else cur[k] = 1;
    var v = Object.keys(cur).map(Number).sort(function (a, b) { return a - b; }).join(",");
    if (v) userAnswers[n] = v; else delete userAnswers[n];
    try { saveSessionState(); } catch (e) {}
    try { loadNavGrid(); } catch (e) {}
    var root = document.getElementById("dqom-" + n), q = null;
    try { q = allQuestions.filter(function (x, i) { return qno(x, i) === n; })[0]; } catch (e) {}
    if (root && q) paint(root, n, q);
  };

  function enhance() {
    var host = document.getElementById("single-question-container");
    if (!host) return;
    var list, q, n, i;
    try { list = getActiveReviewQuestions(); i = currentQuestionIndex; q = list[i]; } catch (e) { return; }
    if (!q) return;
    n = qno(q, i);
    if (!multi(q, n)) return;
    q.correct = canon(q.correct);
    var inp = host.querySelector('input[oninput^="selectOpenAnswer"]');
    var grp = inp && (inp.closest(".form-group") || inp.parentNode);
    if (!grp || document.getElementById("dqom-" + n)) return;
    css();
    var rev = false; try { rev = !!isReviewMode; } catch (e) {}
    var html = '<div class="dqom" id="dqom-' + n + '"><div class="dqom-hint">Doğru olan bütün ifadələri seçin (bir neçə cavab ola bilər)</div>';
    q.options.forEach(function (o, k) {
      var t = String(otext(o)).trim(), im = oimg(o);
      if (!t && !im) return;
      html += '<div class="dqom-opt' + (rev ? " lock" : "") + '" role="checkbox" tabindex="0" aria-checked="false" data-n="' + (k + 1) + '"' +
        (rev ? "" : ' onclick="dqOmToggle(' + n + "," + (k + 1) + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();dqOmToggle(' + n + "," + (k + 1) + ')}"') + ">" +
        '<span class="dqom-box"></span><b class="dqom-no">' + (k + 1) + '.</b><span class="dqom-tx">' + clean(t) +
        (im ? '<img src="' + im + '" alt="">' : "") + "</span></div>";
    });
    html += "</div>";
    grp.outerHTML = html;
    paint(document.getElementById("dqom-" + n), n, q);
  }

  function wrap(name, after, before) {
    var orig = window[name];
    if (typeof orig !== "function" || orig.__dqom) return;
    var w = function () {
      if (before) before();
      var r = orig.apply(this, arguments);
      if (after) {
        if (r && typeof r.then === "function") return r.then(function (x) { after(); return x; });
        after();
      }
      return r;
    };
    w.__dqom = 1;
    window[name] = w;
  }

  function init() {
    wrap("renderCurrentQuestion", enhance, normAll);
    wrap("finishExam", null, normAll);
  }
  init();
  window.addEventListener("load", init);
})();
