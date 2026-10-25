/* DQ Platform — dq-admin.js v3 (dq-live-admin.js bu fayla birləşdirilib)
   Admin kabineti: iş nömrəsi sahəsinə admin kodu yazılanda admin kabineti açılır,
   bütün sınaqlar aktiv görünür və sual redaktoru birbaşa açılır.

   v2-də nə düzəldildi:
   1) Admin artıq tələbə kabinetinə (DQ.openCabinet-in sonrakı qatları) düşmür —
      birbaşa admin kabineti (exam-select-screen) açılır.
   2) Kod açıq mətnlə saxlanmır (duzlu SHA-256 yoxlaması).
   3) Skript index.html-də ƏN ƏVVƏL yüklənir və window səviyyəsində tutur —
      başqa modulların giriş yoxlamasından əvvəl işləyir.
   4) Səhv cəhdlərə görə heç bir bloklama yoxdur (bu mexanizmdə sayğac yoxdur).
   5) Sınaq nömrəsini əl ilə yazıb redaktoru açmaq üçün sahə əlavə olundu. */
(function () {
  "use strict";
  if (window.DQ_ADMIN) return;

  var SALT = "dqadm1|";
  var HASH = "b50a3484f1b07ad063c7ac1eeaa04e94dab0e390c930e82c47072b51315c40bf";
  var FLAG = "dq_admin_cab";
  var CATS = ["BA", "BB", "AC"];
  var D = document;

  function $(id) { return D.getElementById(id); }
  function norm(v) { return String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase(); }
  function isAdm() { return window.__dqAdminCab === true; }
  function g(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }

  /* ---------- SHA-256 (sinxron, ASCII/UTF-8) ---------- */
  var K = [], H0 = [];
  (function () {
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (var c = 2, n = 0; n < 64; c++) {
      var pr = true;
      for (var d = 2; d * d <= c; d++) if (c % d === 0) { pr = false; break; }
      if (!pr) continue;
      if (n < 8) H0[n] = frac(Math.pow(c, 0.5));
      K[n++] = frac(Math.pow(c, 1 / 3));
    }
  })();
  function sha256(str) {
    var m = unescape(encodeURIComponent(str)), l = m.length, w = [], i, j;
    for (i = 0; i < l; i++) w[i >> 2] |= m.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    w[(((l + 8) >> 6) << 4) + 15] = l * 8;
    var h = H0.slice(), a, b, c, d, e, f, gg, hh, t1, t2, W = new Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (j = 0; j < w.length; j += 16) {
      for (i = 0; i < 64; i++) {
        if (i < 16) W[i] = w[j + i] | 0;
        else {
          var s0 = rr(W[i - 15], 7) ^ rr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
          var s1 = rr(W[i - 2], 17) ^ rr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
          W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
        }
      }
      a = h[0]; b = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; gg = h[6]; hh = h[7];
      for (i = 0; i < 64; i++) {
        t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & gg)) + K[i] + W[i]) | 0;
        t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = gg; gg = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + gg) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }
  function isCode(v) { v = norm(v); return v.length === 7 && sha256(SALT + v) === HASH; }

  function setFlag(on) {
    window.__dqAdminCab = !!on;
    try { on ? sessionStorage.setItem(FLAG, "1") : sessionStorage.removeItem(FLAG); } catch (e) {}
  }

  function toast(m) {
    try { if (typeof V2 !== "undefined" && V2.toast) return V2.toast(m); } catch (e) {}
    if (!D.body) return;
    var o = D.createElement("div");
    o.textContent = m;
    o.setAttribute("role", "status");
    o.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0f2d6b;color:#fff;padding:11px 18px;border-radius:99px;font:600 14px system-ui,sans-serif;z-index:2147483000;max-width:90vw;text-align:center;box-shadow:0 8px 22px rgba(0,0,0,.35)";
    D.body.appendChild(o);
    setTimeout(function () { o.remove(); }, 2800);
  }

  /* ---------- Sessiya bərpası: admin yalnız eyni brauzer sessiyasında qalır ---------- */
  try {
    if (sessionStorage.getItem(FLAG) === "1") window.__dqAdminCab = true;
    else {
      var c0 = JSON.parse(localStorage.getItem("dq_cabinet") || "null");
      if (c0 && c0.fin === "ADMIN") localStorage.removeItem("dq_cabinet");
    }
  } catch (e) {}

  /* ---------- Sınaq siyahısı (dərhal göstərilir, baza məlumatı arxa fonda gəlir) ---------- */
  var CK = "dq_adm_cats";
  function baseList(map) {
    var n = +g(function () { return totalExamsCount; }, 2) || 2, out = [], i;
    for (i = 1; i <= n; i++) map[String(i)] = map[String(i)] || {};
    return Object.keys(map).map(Number).filter(function (x) { return x > 0; })
      .sort(function (a, b) { return a - b; })
      .map(function (k) { return { n: k, cats: map[String(k)] }; });
  }
  function cachedMap() { try { return JSON.parse(sessionStorage.getItem(CK) || "{}") || {}; } catch (e) { return {}; } }
  function fetchMap() {
    var q = Promise.resolve(_supabase.from("exam_questions").select("exam_id,category").eq("q_number", 1))
      .then(function (r) {
        var map = {};
        (r.data || []).forEach(function (x) {
          (map[String(x.exam_id)] = map[String(x.exam_id)] || {})[String(x.category || "BA").toUpperCase()] = 1;
        });
        try { sessionStorage.setItem(CK, JSON.stringify(map)); } catch (e) {}
        return map;
      });
    var t = new Promise(function (res) { setTimeout(function () { res(null); }, 4000); });
    return Promise.race([q, t]).catch(function () { return null; });
  }

  /* ---------- Sual redaktorunu aç ---------- */
  function launch(n, cat) {
    n = String(parseInt(n, 10) || 0);
    if (n === "0") { toast("Sınaq nömrəsini düzgün yazın."); return; }
    try {
      window.__dqEditOk = true;
      isLiveEditMode = true;
      currentStudentName = "ADMIN REDAKTOR";
      currentActiveFin = "ADMIN";
      var p = $("live-edit-panel");
      if (p) p.style.display = "block";
      if (window.__dqLiveKick) window.__dqLiveKick();
      Promise.resolve(startExamSession(n, cat)).then(function () { if (window.__dqLiveKick) window.__dqLiveKick(); }).catch(function (e) {
        console.error(e); toast("Redaktor açıla bilmədi: " + (e && e.message || e));
      });
    } catch (e) { console.error(e); toast("Redaktor açıla bilmədi: " + e.message); }
  }

  /* ---------- Admin siyahısı ---------- */
  var rendering = false;
  function listHtml(L) {
    var h = '<div class="dqadm-root"><div class="dq-note" style="margin:0 auto 14px"><i class="fa-solid fa-user-shield"></i><span><b>Admin rejimi:</b> bütün sınaqlar aktivdir. Sınağı açın və sualları birbaşa redaktə edin.</span></div>';
    h += '<div class="exam-item-card"><div class="exam-item-header"><span>Sınaq nömrəsini yazın</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<input id="dqadm-n" type="number" min="1" inputmode="numeric" placeholder="№" style="width:90px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px">' +
      CATS.map(function (c) { return '<button type="button" class="btn btn-primary btn-sm" data-dqadm-n="' + c + '">' + c + '</button>'; }).join("") +
      '</div></div>';
    return h + L.map(function (x) {
      return '<div class="exam-item-card"><div class="exam-item-header"><span>Sınaq ' + x.n + '</span><span style="font-size:12px;color:#15803d;font-weight:800">● AKTİV</span></div><div style="display:flex;flex-direction:column;gap:6px">' +
        CATS.map(function (c) {
          return '<div class="cat-action-row"><span class="cat-action-title">' + c + ' kateqoriyası' +
            (x.cats[c] ? '' : ' <small class="dqadm-empty" style="color:#94a3b8;font-weight:600">(boşdur)</small>') +
            '</span><button type="button" class="btn btn-primary btn-sm" data-dqadm="' + x.n + '|' + c + '">✏️ Aç və redaktə et</button></div>';
        }).join("") + '</div></div>';
    }).join("") + '</div>';
  }
  function adminRender() {
    var box = $("registered-exams-list");
    if (!box || rendering) return Promise.resolve();
    rendering = true;
    try {
      box.innerHTML = listHtml(baseList(cachedMap()));
      box.onclick = function (e) {
        var b = e.target.closest("[data-dqadm]");
        if (b) { var p = b.getAttribute("data-dqadm").split("|"); launch(p[0], p[1]); return; }
        var nb = e.target.closest("[data-dqadm-n]");
        if (nb) { var inp = $("dqadm-n"); launch(inp && inp.value, nb.getAttribute("data-dqadm-n")); }
      };
      try { DQ.setReg(true); } catch (e) {}
    } finally { rendering = false; }
    return fetchMap().then(function (map) {          /* arxa fonda "(boşdur)" qeydlərini dəqiqləşdir */
      if (!map || !isAdm()) return;
      var cur = $("registered-exams-list");
      if (cur && cur.querySelector(".dqadm-root")) { rendering = true; try { cur.innerHTML = listHtml(baseList(map)); } finally { rendering = false; } }
    });
  }

  /* ---------- Admin kabinetini birbaşa aç (tələbə kabinetini yan keç) ---------- */
  function openAdminCabinet() {
    currentStudentName = "Admin";
    currentActiveFin = "ADMIN";
    try { DQ.saveCabinet({ name: "Admin", fin: "ADMIN" }); } catch (e) {}
    var old = $("dq-cab"); if (old) old.remove();
    try {   /* qarşılama / qeydiyyat pəncərələri admin kabinetinin üstündə qalmasın */
      var w = $("dq-welcome"); if (w) w.remove();
      D.querySelectorAll(".dqg-ov").forEach(function (x) { x.remove(); });
    } catch (e) {}
    var f = $("cab-fin"); if (f) f.textContent = "İş nömrəsi: ADMIN";
    var n = $("cab-name"); if (n) n.textContent = "Admin";
    var a = $("cab-av"); if (a) a.textContent = "A";
    var s = $("exam-select-screen");
    if (s) [".cab-card", ".cab-tests"].forEach(function (q) { var el = s.querySelector(q); if (el) el.style.display = ""; });
    try { DQ.setReg(true); } catch (e) {}
    showScreen("exam-select-screen");
    try { scrollTo(0, 0); } catch (e) {}
    return adminRender();
  }

  /* ---------- Başqa qatların admin yolunu pozmaması üçün sarğılar ---------- */
  function wrapRender() {
    var orig = window.renderRegisteredExams;
    if (typeof orig !== "function" || orig.__dqadm) return;
    var w = function () { return isAdm() ? adminRender() : orig.apply(this, arguments); };
    w.__dqadm = true;
    window.renderRegisteredExams = w;
    try { renderRegisteredExams = w; } catch (e) {}
  }
  function wrapNav() {
    if (typeof DQ !== "undefined" && DQ.openCabinet && !DQ.openCabinet.__dqadm) {
      var oc = DQ.openCabinet;
      DQ.openCabinet = function () { return isAdm() ? openAdminCabinet() : oc.apply(this, arguments); };
      DQ.openCabinet.__dqadm = true;
    }
    if (typeof V3 !== "undefined" && V3.go && !V3.go.__dqadm) {
      var og = V3.go;
      V3.go = function (id) {
        if (isAdm() && id === "kab") { openAdminCabinet(); return; }
        return og.apply(this, arguments);
      };
      V3.go.__dqadm = true;
    }
    if (typeof DQ !== "undefined" && DQ.logout && !DQ.logout.__dqadm) {
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
  }
  function watchList() {
    var box = $("registered-exams-list");
    if (!box || box.__dqw) return;
    box.__dqw = 1;
    new MutationObserver(function () {
      if (isAdm() && !rendering && !box.querySelector(".dqadm-root")) adminRender();
    }).observe(box, { childList: true });
  }
  (function boot() {
    var tries = 0, iv = setInterval(function () {
      wrapRender(); wrapNav(); watchList();
      if (++tries > 80) clearInterval(iv);          /* ~20 san */
    }, 250);
  })();

  /* ---------- Admin kabinetinə giriş ---------- */
  var entering = false;
  function enter() {
    if (entering) return;
    entering = true;
    setTimeout(function () { entering = false; }, 1200);
    setFlag(true);
    wrapRender(); wrapNav(); watchList();
    var em = $("error-msg"); if (em) em.textContent = "";
    var fm = $("dq-fl-msg"); if (fm) fm.textContent = "";
    try { DQ.pending = null; } catch (e) {}
    try { openAdminCabinet(); }
    catch (e) { console.error(e); toast("Kabinet açıla bilmədi: " + (e && e.message || e)); return; }
    toast("Admin kimi daxil oldunuz ✅");
  }

  /* ---------- Kodun tutulması: formanın öz yoxlamasından ƏVVƏL ---------- */
  var armed = null;     /* admin kodu yazılmış sahə */
  function textLike(t) {
    if (!t || t.tagName !== "INPUT") return false;
    var ty = (t.type || "text").toLowerCase();
    return !(ty === "file" || ty === "checkbox" || ty === "radio" || ty === "hidden");
  }
  function trigger(e) {
    var t = armed;
    armed = null;
    if (e && e.cancelable) e.preventDefault();
    if (e) { e.stopImmediatePropagation(); e.stopPropagation(); }
    if (t) { t.value = ""; try { t.blur(); } catch (x) {} }
    enter();
  }
  function onType(e) {                                  /* yalnız yazılan sahəyə baxılır */
    var t = e.target;
    if (!textLike(t) || t.value.length < 7 || t.value.length > 12) return;
    if (isCode(t.value)) { armed = t; trigger(e); }
  }
  function onAct(e) {                                   /* düymə/forma təsdiqi: yalnız bir dəfə skan */
    var t = e.target && e.target.closest && e.target.closest("button,[role=button],a,input[type=submit],form");
    if (!t && e.type !== "submit" && e.type !== "keydown") return;
    var L = D.querySelectorAll("input"), i;
    for (i = 0; i < L.length; i++) {
      if (textLike(L[i]) && L[i].value.length >= 7 && L[i].value.length <= 12 && isCode(L[i].value)) { armed = L[i]; trigger(e); return; }
    }
  }
  ["input", "change", "paste", "keyup"].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      onType(e);
      if (ev === "paste") setTimeout(function () { if (textLike(e.target) && isCode(e.target.value)) { armed = e.target; trigger(null); } }, 0);
    }, true);
  });
  ["click", "pointerup", "touchend", "submit"].forEach(function (ev) { window.addEventListener(ev, onAct, true); });
  window.addEventListener("keydown", function (e) { if (e.key === "Enter") onAct(e); }, true);

  /* ---------- Müstəqil giriş yolu: saytın ünvanının sonuna #adm yazın ---------- */
  function codeModal() {
    if ($("dqadm-ov")) return;
    var ov = D.createElement("div");
    ov.id = "dqadm-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(5,12,35,.78);display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML = '<div style="width:min(360px,94vw);background:#0f2145;border:1px solid #c9a24a;border-radius:16px;padding:20px;color:#fff;font-family:system-ui,sans-serif">' +
      '<h3 style="margin:0 0 6px;color:#e8c873">Admin girişi</h3><p style="margin:0 0 12px;font-size:13px;opacity:.75">Admin kodunu yazın.</p>' +
      '<input id="dqadm-code" type="text" autocomplete="off" autocapitalize="characters" maxlength="12" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #334b82;background:#07102a;color:#fff;font-size:18px;letter-spacing:3px">' +
      '<div id="dqadm-msg" style="min-height:18px;margin-top:8px;font-size:13px;color:#ff9aa2"></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><button id="dqadm-no" type="button" style="flex:1;padding:11px;border-radius:10px;border:0;background:#24365f;color:#fff;font-weight:700">Ləğv et</button>' +
      '<button id="dqadm-go" type="button" style="flex:1.4;padding:11px;border-radius:10px;border:0;background:#e0b653;color:#101a33;font-weight:800">Daxil ol</button></div></div>';
    D.body.appendChild(ov);
    var inp = $("dqadm-code");
    function close() { ov.remove(); }
    function go() {
      if (isCode(inp.value)) { close(); enter(); }
      else { $("dqadm-msg").textContent = "Kod yanlışdır."; inp.select(); }
    }
    $("dqadm-no").onclick = close;
    $("dqadm-go").onclick = go;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  }
  function hashGate() {
    if (/^#adm$/i.test(location.hash)) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      if (isAdm()) openAdminCabinet(); else codeModal();
    }
  }
  window.addEventListener("hashchange", hashGate);
  (function waitBody() { if (D.body) hashGate(); else setTimeout(waitBody, 100); })();
  setTimeout(hashGate, 1500);

  window.DQ_ADMIN = { version: 3, modal: codeModal, enter: enter, isAdmin: isAdm, launch: launch, open: openAdminCabinet };
  try { console.info("[dq-admin] v3 aktivdir"); } catch (e) {}
})();

/* ===== Canlı Sual Redaktoru: avtomatik aktivləşmə + "Sualı sil" (əvvəlki dq-live-admin.js) ===== */
(function () {
  "use strict";
  if (window.__dqLiveAdminPro) return;
  window.__dqLiveAdminPro = true;

  var FIX_ENTITIES = true;      // &#39; &quot; düzəlişi (istəməsən false et)
  var UNDO_MS = 10000;          // "Geri qaytar" müddəti
  var CATS = ["BA", "BB", "AC"];

  /* ---------- təhlükəsiz global oxuma ---------- */
  function g(f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } }
  function $(id) { return document.getElementById(id); }

  var isLive = function () { return g(function () { return isLiveEditMode; }, false) === true; };
  var isReview = function () { return g(function () { return isReviewMode; }, false) === true; };
  var isAdmin = function () {
    return isLive() && (window.__dqAuthed === true || window.__dqEditOk === true ||
      g(function () { return currentActiveFin; }, "") === "ADMIN");
  };
  var qList = function () { return g(function () { return allQuestions; }, []) || []; };
  var qIdx = function () { return g(function () { return currentQuestionIndex; }, 0) || 0; };
  var examId = function () { return g(function () { return selectedExamId; }, "1"); };
  var group = function () { return g(function () { return userGroup; }, "BA"); };
  var sb = function () { return g(function () { return _supabase; }, null); };

  function examActive() {
    var ex = $("exam-screen");
    return !!(ex && ex.classList.contains("active"));
  }
  function editBtn() { return $("inline-edit-toggle-btn"); }
  function editIsOn() {
    var b = editBtn();
    if (b) return /ba[ğg]la/i.test(b.textContent || "");
    return g(function () { return inlineEditOn; }, false) === true;
  }

  /* ---------- CSS ---------- */
  var css = document.createElement("style");
  css.id = "dqx-css";
  css.textContent =
    ".dqx-del{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;" +
    "border:1.5px solid #b42318;background:#fff;color:#b42318;font:700 12px/1.2 inherit;font-family:inherit;cursor:pointer;" +
    "transition:background .15s,color .15s,transform .1s}" +
    ".dqx-del:hover{background:#b42318;color:#fff}.dqx-del:active{transform:scale(.97)}" +
    ".dqx-ov{position:fixed;inset:0;z-index:100000;background:rgba(7,19,48,.55);display:flex;align-items:center;" +
    "justify-content:center;padding:16px;backdrop-filter:blur(2px);animation:dqxf .15s ease}" +
    "@keyframes dqxf{from{opacity:0}to{opacity:1}}" +
    ".dqx-box{width:min(460px,94vw);background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);" +
    "overflow:hidden;font-family:inherit;color:#0f2447}" +
    ".dqx-hd{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#fdecea;color:#912018;font-weight:800;font-size:16px}" +
    ".dqx-bd{padding:16px 18px;font-size:14px;line-height:1.5}" +
    ".dqx-pv{margin:10px 0;padding:10px 12px;background:#f3f5f9;border-left:4px solid #0a2f7a;border-radius:6px;" +
    "color:#334155;max-height:90px;overflow:auto;font-size:13px;word-break:break-word}" +
    ".dqx-cats{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 4px;font-weight:700;font-size:13px}" +
    ".dqx-cats label{display:flex;align-items:center;gap:5px;cursor:pointer}" +
    ".dqx-warn{font-size:12px;color:#912018;margin-top:8px}" +
    ".dqx-ft{display:flex;justify-content:flex-end;gap:10px;padding:12px 18px;background:#f8fafc;border-top:1px solid #e2e8f0}" +
    ".dqx-b{padding:9px 18px;border-radius:8px;border:0;font:700 13px/1 inherit;font-family:inherit;cursor:pointer}" +
    ".dqx-b.c{background:#e2e8f0;color:#334155}.dqx-b.d{background:#b42318;color:#fff}" +
    ".dqx-b[disabled]{opacity:.55;cursor:wait}" +
    ".dqx-tt{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100001;max-width:92vw;display:flex;" +
    "align-items:center;gap:12px;padding:11px 16px;border-radius:10px;background:#0f2447;color:#fff;font-size:13px;" +
    "font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3)}" +
    ".dqx-tt.err{background:#912018}.dqx-tt button{background:#f4b73e;color:#0f2447;border:0;border-radius:6px;" +
    "padding:5px 10px;font:800 12px/1 inherit;font-family:inherit;cursor:pointer}";
  document.head.appendChild(css);

  /* ---------- toast ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, opt) {
    opt = opt || {};
    if (toastEl) { toastEl.remove(); clearTimeout(toastTimer); }
    var t = document.createElement("div");
    t.className = "dqx-tt" + (opt.err ? " err" : "");
    t.setAttribute("role", "status");
    var s = document.createElement("span");
    s.textContent = msg;
    t.appendChild(s);
    if (opt.action) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.action.label;
      b.onclick = function () { t.remove(); opt.action.fn(); };
      t.appendChild(b);
    }
    document.body.appendChild(t);
    toastEl = t;
    toastTimer = setTimeout(function () { t.remove(); }, opt.ms || 2600);
  }

  /* ---------- 1) Avtomatik redaktə ---------- */
  var userClosed = false;

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("#inline-edit-toggle-btn");
    if (b) userClosed = editIsOn();   // klikdən əvvəl açıqdırsa → admin bağlayır
  }, true);

  function autoEdit() {
    if (!isAdmin() || !examActive()) { userClosed = false; return; }
    if (isReview() || userClosed) return;
    if (!qList().length) return;
    var b = editBtn();
    if (!b || b.offsetParent === null) return;   // panel hələ görünmür
    if (!editIsOn()) b.click();
  }

  /* ---------- 3) Sınmış simvollar ---------- */
  var ENT = /&#0*39;|&#x27;|&apos;|&quot;|&#0*34;/gi;
  function fixEntities(root) {
    if (!FIX_ENTITIES || !root || !ENT.test(root.textContent || "")) { ENT.lastIndex = 0; return; }   /* təmizdirsə ağacı gəzmə */
    ENT.lastIndex = 0;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, hit = [];
    while ((n = w.nextNode())) {
      if (ENT.test(n.nodeValue)) hit.push(n);
      ENT.lastIndex = 0;
    }
    var act = document.activeElement;
    hit.forEach(function (t) {
      if (act && act.contains && act.contains(t) && act.isContentEditable) return;  // yazarkən toxunma
      t.nodeValue = t.nodeValue.replace(/&#0*39;|&#x27;|&apos;/gi, "'").replace(/&quot;|&#0*34;/gi, '"');
    });
  }

  /* ---------- 2) Sualı sil ---------- */
  function plain(html) {
    try { return (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").trim(); }
    catch (e) { return String(html || ""); }
  }

  function decorate() {
    if (!isAdmin() || isReview()) return;
    var bar = document.querySelector("#single-question-container .ie-bar");
    if (!bar || bar.querySelector("#dqx-del")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "dqx-del";
    btn.className = "dqx-del";
    btn.title = "Bu sualı bazadan sil";
    btn.textContent = "🗑️ Sualı sil";
    btn.onclick = openConfirm;
    var save = [].slice.call(bar.querySelectorAll("button")).filter(function (x) { return /yadda saxla/i.test(x.textContent); })[0];
    (save && save.parentElement ? save.parentElement : bar).appendChild(btn);
  }

  var busy = false;

  function openConfirm() {
    if (busy) return;
    var list = qList(), i = qIdx(), q = list[i];
    if (!q) { toast("Sual tapılmadı.", { err: true }); return; }
    var qNum = q.id || i + 1, cur = group();
    var checked = {};
    [].forEach.call(document.querySelectorAll(".ie-cat-chk:checked"), function (c) { checked[c.value] = true; });
    if (!Object.keys(checked).length) checked[cur] = true;

    var ov = document.createElement("div");
    ov.className = "dqx-ov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    var box = document.createElement("div");
    box.className = "dqx-box";

    var hd = document.createElement("div");
    hd.className = "dqx-hd";
    hd.textContent = "🗑️ Sual " + qNum + " silinsin?";

    var bd = document.createElement("div");
    bd.className = "dqx-bd";
    var info = document.createElement("div");
    info.textContent = "Sınaq " + examId() + (q.subject ? " · " + q.subject : "");
    info.style.fontWeight = "700";
    var pv = document.createElement("div");
    pv.className = "dqx-pv";
    var txt = plain(q.question);
    pv.textContent = txt ? (txt.length > 180 ? txt.slice(0, 180) + "…" : txt) : "(mətn yoxdur)";
    var lbl = document.createElement("div");
    lbl.textContent = "Hansı kateqoriyalardan silinsin:";
    var cats = document.createElement("div");
    cats.className = "dqx-cats";
    CATS.forEach(function (c) {
      var l = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = c; cb.checked = !!checked[c];
      l.appendChild(cb);
      l.appendChild(document.createTextNode(" " + c));
      cats.appendChild(l);
    });
    var warn = document.createElement("div");
    warn.className = "dqx-warn";
    warn.textContent = "Sual bazadan silinir və sınaqdan çıxır. Silmədən sonra 10 saniyə geri qaytarmaq olar.";
    bd.appendChild(info); bd.appendChild(pv); bd.appendChild(lbl); bd.appendChild(cats); bd.appendChild(warn);

    var ft = document.createElement("div");
    ft.className = "dqx-ft";
    var no = document.createElement("button");
    no.type = "button"; no.className = "dqx-b c"; no.textContent = "Ləğv et";
    var yes = document.createElement("button");
    yes.type = "button"; yes.className = "dqx-b d"; yes.textContent = "Sil";
    ft.appendChild(no); ft.appendChild(yes);

    box.appendChild(hd); box.appendChild(bd); box.appendChild(ft);
    ov.appendChild(box);
    document.body.appendChild(ov);
    no.focus();

    function close() { document.removeEventListener("keydown", esc, true); ov.remove(); }
    function esc(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    document.addEventListener("keydown", esc, true);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    no.onclick = close;
    yes.onclick = async function () {
      var sel = [].filter.call(cats.querySelectorAll("input"), function (c) { return c.checked; }).map(function (c) { return c.value; });
      if (!sel.length) { warn.textContent = "Ən azı bir kateqoriya seçin."; return; }
      yes.disabled = no.disabled = true;
      yes.textContent = "Silinir…";
      await runDelete({ exam: examId(), qNum: qNum, cur: cur, idx: i, q: q }, sel);
      close();
    };
  }

  async function runDelete(ctx, cats) {
    var client = sb();
    if (!client) { toast("Baza bağlantısı yoxdur.", { err: true }); return; }
    busy = true;
    var removed = [], ok = {}, errs = [];
    var isPlaceholder = (ctx.q.question || "") === "Yeni sual mətni...";
    try {
      for (var k = 0; k < cats.length; k++) {
        var c = cats[k];
        var r = await client.from("exam_questions").delete()
          .eq("exam_id", ctx.exam).eq("category", c).eq("q_number", ctx.qNum).select("*");
        if (r.error) { errs.push(c + ": " + r.error.message); continue; }
        var rows = r.data || [];
        if (c === ctx.cur && !rows.length && !isPlaceholder) {
          errs.push(c + ": sual bazada silinmədi (icazə yoxdur və ya sətir tapılmadı)");
          continue;
        }
        ok[c] = true;
        rows.forEach(function (x) { removed.push(x); });
      }
    } catch (e) {
      errs.push(e && e.message ? e.message : String(e));
    }
    busy = false;

    var done = Object.keys(ok);
    if (!done.length) { toast("❌ Silinmədi — " + (errs[0] || "xəta"), { err: true, ms: 5000 }); return; }

    if (ok[ctx.cur]) removeLocal(ctx);

    var msg = "✅ Sual " + ctx.qNum + " silindi (" + done.join(", ") + ")";
    if (errs.length) msg += " · xəta: " + errs[0];
    toast(msg, removed.length ? {
      ms: UNDO_MS,
      action: { label: "↩ Geri qaytar", fn: function () { undo(ctx, removed); } }
    } : { ms: 3000, err: !!errs.length });
  }

  function removeLocal(ctx) {
    var list = qList();
    var at = -1;
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id == ctx.qNum) { at = i; break; }
    if (at < 0) at = ctx.idx;
    list.splice(at, 1);
    g(function () { delete userAnswers[ctx.qNum]; });
    g(function () { delete flaggedQuestions[ctx.qNum]; });
    if (!list.length) {
      // siyahı boşaldı → redaktor üçün boş şablonu yenidən yüklə
      g(function () { return startExamSession(ctx.exam, ctx.cur); });
      return;
    }
    var ni = Math.min(at, list.length - 1);
    g(function () { currentQuestionIndex = ni; });
    g(function () { saveSessionState(); });
    g(function () { renderCurrentQuestion(); });
    g(function () { loadNavGrid(); });
  }

  async function undo(ctx, rows) {
    var client = sb();
    if (!client || !rows.length) return;
    var payload = rows.map(function (r) {
      var o = {};
      Object.keys(r).forEach(function (k) { if (k !== "id" && k !== "created_at") o[k] = r[k]; });
      return o;
    });
    var r = await client.from("exam_questions").insert(payload);
    if (r.error) { toast("❌ Geri qaytarılmadı: " + r.error.message, { err: true, ms: 5000 }); return; }
    if (String(examId()) === String(ctx.exam) && group() === ctx.cur) {
      try {
        await startExamSession(ctx.exam, ctx.cur);
        var l = qList(), at = -1;
        for (var i = 0; i < l.length; i++) if (l[i] && l[i].id == ctx.qNum) { at = i; break; }
        if (at >= 0) {
          g(function () { currentQuestionIndex = at; });
          g(function () { renderCurrentQuestion(); });
          g(function () { loadNavGrid(); });
        }
      } catch (e) { /* səssiz */ }
    }
    toast("↩ Sual " + ctx.qNum + " bərpa edildi", { ms: 2500 });
  }

  /* ---------- Müşahidə (dövrsüz: yalnız DOM dəyişəndə, 120 ms birləşdirilmiş) ---------- */
  var timer = 0, watched = null, watchedEx = null;
  function tick() {
    timer = 0;
    if (!isLive()) return;                      /* admin redaktor rejimində deyilsə heç nə etmə */
    autoEdit();
    decorate();
    var c = $("single-question-container");
    if (c) fixEntities(c);
  }
  function schedule() { if (!timer) timer = setTimeout(tick, 120); }
  function watch() {
    var c = $("single-question-container"), ex = $("exam-screen");
    if (c && c !== watched) { watched = c; new MutationObserver(schedule).observe(c, { childList: true, subtree: true }); }
    if (ex && ex !== watchedEx) { watchedEx = ex; new MutationObserver(schedule).observe(ex, { attributes: true, attributeFilter: ["class"] }); }
    return !!(watched && watchedEx);
  }
  (function boot() { var n = 0; (function t() { if (!watch() && ++n < 120) setTimeout(t, 500); })(); })();
  window.__dqLiveKick = function () { [200, 700, 1500, 3000, 6000].forEach(function (ms) { setTimeout(function () { watch(); schedule(); }, ms); }); };
})();
