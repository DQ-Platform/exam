/* DQ Platform — dq-admin.js v1
   Xüsusi kodla Admin kabineti: bütün sınaqlar aktiv + canlı sual redaktoru.
   Bu fayl müstəqildir; index.html-də ən sonda (variant-fix-dən sonra) yüklənməlidir. */
(function () {
  "use strict";
  if (window.DQ_ADMIN) return;

  var CODE = "Y7C7UF7";            /* admin giriş kodu (böyük hərflə) */
  var FLAG = "dq_admin_cab";       /* sessiya bayrağı */
  var D = document;

  function $(id) { return D.getElementById(id); }
  function norm(v) { return String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase(); }
  function isAdm() { return window.__dqAdminCab === true; }

  function setFlag(on) {
    window.__dqAdminCab = !!on;
    try { on ? sessionStorage.setItem(FLAG, "1") : sessionStorage.removeItem(FLAG); } catch (e) {}
  }

  function toast(m) {
    try { if (typeof V2 !== "undefined" && V2.toast) return V2.toast(m); } catch (e) {}
    var o = D.createElement("div");
    o.textContent = m;
    o.setAttribute("role", "status");
    o.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0f2d6b;color:#fff;padding:11px 18px;border-radius:99px;font:600 14px system-ui,sans-serif;z-index:2147483000;max-width:90vw;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.35)";
    D.body.appendChild(o);
    setTimeout(function () { o.remove(); }, 2800);
  }

  /* ---- Sessiya bərpası: admin yalnız eyni brauzer sessiyasında qalır ---- */
  try {
    if (sessionStorage.getItem(FLAG) === "1") window.__dqAdminCab = true;
    else {
      var c0 = JSON.parse(localStorage.getItem("dq_cabinet") || "null");
      if (c0 && c0.fin === "ADMIN") localStorage.removeItem("dq_cabinet");
    }
  } catch (e) {}

  /* ---- Sınaq siyahısı ---- */
  async function examList() {
    var map = {};
    try {
      var r = await _supabase.from("exam_questions").select("exam_id,category").eq("q_number", 1);
      (r.data || []).forEach(function (x) {
        var k = String(x.exam_id);
        (map[k] = map[k] || {})[String(x.category || "BA").toUpperCase()] = 1;
      });
    } catch (e) {}
    var n = +(typeof totalExamsCount !== "undefined" ? totalExamsCount : 2) || 2;
    for (var i = 1; i <= n; i++) map[String(i)] = map[String(i)] || {};
    return Object.keys(map).map(Number)
      .filter(function (x) { return x > 0; })
      .sort(function (a, b) { return a - b; })
      .map(function (k) { return { n: k, cats: map[String(k)] }; });
  }

  /* ---- Redaktoru aç ---- */
  function launch(n, cat) {
    try {
      window.__dqEditOk = true;
      isLiveEditMode = true;
      currentStudentName = "ADMIN REDAKTOR";
      currentActiveFin = "ADMIN";
      var p = $("live-edit-panel");
      if (p) p.style.display = "block";
      Promise.resolve(startExamSession(String(n), cat)).then(function () {
        var t = 0, iv = setInterval(function () {
          if (++t > 60) { clearInterval(iv); return; }
          var ex = $("exam-screen");
          if (isLiveEditMode && allQuestions && allQuestions.length && ex && ex.classList.contains("active")) {
            clearInterval(iv);
            if (!inlineEditOn) toggleInlineEdit();
          }
        }, 300);
      }).catch(function (e) { console.error(e); toast("Redaktor açıla bilmədi: " + (e && e.message || e)); });
    } catch (e) { console.error(e); toast("Redaktor açıla bilmədi: " + e.message); }
  }

  /* ---- Admin siyahısı ---- */
  var rendering = false;
  async function adminRender() {
    var box = $("registered-exams-list");
    if (!box || rendering) return;
    rendering = true;
    try {
      box.innerHTML = '<p class="dqadm-root">Sınaqlar yüklənir...</p>';
      var L = await examList();
      var h = '<div class="dqadm-root"><div class="dq-note" style="margin:0 auto 14px"><i class="fa-solid fa-user-shield"></i><span><b>Admin rejimi:</b> bütün sınaqlar aktivdir. Sınağı açın və sualları birbaşa redaktə edin.</span></div>';
      h += L.map(function (x) {
        return '<div class="exam-item-card"><div class="exam-item-header"><span>Sınaq ' + x.n + '</span><span style="font-size:12px;color:#15803d;font-weight:800">● AKTİV</span></div><div style="display:flex;flex-direction:column;gap:6px">' +
          ["BA", "BB", "AC"].map(function (c) {
            return '<div class="cat-action-row"><span class="cat-action-title">' + c + ' kateqoriyası' +
              (x.cats[c] ? '' : ' <small style="color:#94a3b8;font-weight:600">(boşdur)</small>') +
              '</span><button type="button" class="btn btn-primary btn-sm" data-dqadm="' + x.n + '|' + c + '">✏️ Aç və redaktə et</button></div>';
          }).join("") + '</div></div>';
      }).join("") + '</div>';
      box.innerHTML = h;
      box.onclick = function (e) {
        var b = e.target.closest("[data-dqadm]");
        if (!b) return;
        var p = b.getAttribute("data-dqadm").split("|");
        launch(p[0], p[1]);
      };
      try { DQ.setReg(true); } catch (e) {}
    } finally { rendering = false; }
  }

  /* renderRegisteredExams-i admin üçün yönləndir */
  function wrapRender() {
    var orig = window.renderRegisteredExams;
    if (typeof orig !== "function" || orig.__dqadm) return;
    var w = function () { return isAdm() ? adminRender() : orig.apply(this, arguments); };
    w.__dqadm = true;
    window.renderRegisteredExams = w;
    try { renderRegisteredExams = w; } catch (e) {}
  }
  wrapRender();

  /* Ehtiyat: başqa mexanizm siyahını yenidən yazsa, admin siyahısı bərpa olunur */
  function watchList() {
    var box = $("registered-exams-list");
    if (!box || box.__dqw) return;
    box.__dqw = 1;
    new MutationObserver(function () {
      if (isAdm() && !rendering && !box.querySelector(".dqadm-root")) adminRender();
    }).observe(box, { childList: true });
  }
  watchList();
  setTimeout(watchList, 1200);

  /* ---- Admin kabinetinə giriş ---- */
  var entering = false;
  function enter() {
    if (entering) return;
    entering = true;
    setTimeout(function () { entering = false; }, 1200);
    setFlag(true);
    currentStudentName = "Admin";
    currentActiveFin = "ADMIN";
    try { DQ.saveCabinet({ name: "Admin", fin: "ADMIN" }); } catch (e) {}
    var em = $("error-msg"); if (em) em.textContent = "";
    var fm = $("dq-fl-msg"); if (fm) fm.textContent = "";
    wrapRender(); watchList();
    try { DQ.pending = null; DQ.openCabinet(); }
    catch (e) { console.error(e); toast("Kabinet açıla bilmədi"); return; }
    setTimeout(function () {
      var f = $("cab-fin"); if (f) f.textContent = "İş nömrəsi: ADMIN";
      var n = $("cab-name"); if (n) n.textContent = "Admin";
      var a = $("cab-av"); if (a) a.textContent = "A";
      watchList();
    }, 120);
    toast("Admin kimi daxil oldunuz ✅");
  }

  /* ---- Kodun tutulması: formanın öz yoxlamasından ƏVVƏL (capture) ---- */
  function find() {
    var L = D.querySelectorAll("input");
    for (var i = 0; i < L.length; i++) {
      var t = L[i], ty = (t.type || "text").toLowerCase();
      if (ty === "password" || ty === "file" || ty === "checkbox" || ty === "radio" || ty === "hidden") continue;
      if (norm(t.value) === CODE) return t;
    }
    return null;
  }
  function intercept(e) {
    var t = find();
    if (!t) return;
    if (e && e.cancelable) e.preventDefault();
    if (e) { e.stopImmediatePropagation(); e.stopPropagation(); }
    t.value = "";
    try { t.blur(); } catch (x) {}
    enter();
  }
  ["input", "change", "paste", "keyup", "click", "touchend", "pointerup", "submit"].forEach(function (ev) {
    D.addEventListener(ev, function (e) {
      /* paste/input zamanı dəyər hələ yenilənməyə bilər — ikiqat yoxlama */
      intercept(e);
      if (ev === "paste" || ev === "input") setTimeout(function () { intercept(null); }, 0);
    }, true);
  });
  D.addEventListener("keydown", function (e) { if (e.key === "Enter") intercept(e); }, true);

  /* ---- Çıxış ---- */
  function wrapLogout() {
    if (typeof DQ === "undefined" || !DQ.logout || DQ.logout.__dqadm) return;
    var ol = DQ.logout;
    DQ.logout = function () {
      if (isAdm()) {
        setFlag(false);
        window.__dqEditOk = false;
        try { isLiveEditMode = false; } catch (e) {}
        var p = $("live-edit-panel"); if (p) p.style.display = "none";
      }
      return ol.apply(this, arguments);
    };
    DQ.logout.__dqadm = true;
  }
  wrapLogout();
  setTimeout(function () { wrapLogout(); wrapRender(); }, 800);

  window.DQ_ADMIN = { version: 1, enter: enter, isAdmin: isAdm, launch: launch };
  try { console.info("[dq-admin] v1 aktivdir"); } catch (e) {}
})();
