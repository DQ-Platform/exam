/* =====================================================================
   DQ Platform — Canlı Sual Redaktoru: avtomatik aktivləşmə + "Sualı sil"
   Müstəqil fayldır (app.js / dq-editor.js dəyişdirilmir).

   Nə edir:
   1) Admin "📝 Suallar" bölməsinə (və ya ysl ilə) daxil olanda "Sualı Redaktə Et"
      rejimi AVTOMATİK açılır (Redaktəni bağla düyməsi, variantlar, Düzgün,
      BA/BB/AC seçimi, Yadda saxla… — şəkildəki kimi).
      Admin əl ilə "Redaktəni bağla" desə, bölmədən çıxana qədər yenidən açılmır.
   2) Redaktə panelinə "🗑️ Sualı sil" düyməsi əlavə edir: kateqoriyaları seçirsən
      (BA / BB / AC), təsdiq pəncərəsi çıxır, sual bazadan silinir, cavab kartı
      yenilənir. Silmədən sonra 10 saniyə "↩ Geri qaytar" imkanı var.
   3) Suallarda görünən &#39; / &quot; kimi sınmış simvolları düzgün göstərir.

   Qoşulma: index.html-də dq-editor.js sətrindən SONRA bir sətir əlavə et:
       <script src="dq-live-admin.js?v=1"></script>
   ===================================================================== */
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
    if (!FIX_ENTITIES || !root) return;
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

  /* ---------- Dövr + müşahidə ---------- */
  var raf = 0, watched = null;
  function tick() {
    raf = 0;
    autoEdit();
    decorate();
    var c = $("single-question-container");
    if (c) fixEntities(c);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

  function watch() {
    var c = $("single-question-container");
    if (c && c !== watched) {
      watched = c;
      new MutationObserver(schedule).observe(c, { childList: true, subtree: true });
    }
  }
  setInterval(function () { watch(); schedule(); }, 500);
  watch();
  schedule();
})();
