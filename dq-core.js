/* =====================================================================
   DQ CORE v1.2 — mərkəzi baza etibarlılıq qatı
   ---------------------------------------------------------------------
   app.js və yspro.js-dən SONRA qoşulur. Mövcud kodu dəyişmir, üstündən
   təhlükəsiz şəkildə sarıyır:

   1. V2.probe  — şəbəkə xətası artıq səssizcə "local" (yalnız bu cihaz) rejimə
                  keçirmir. "local" yalnız cədvəl həqiqətən yoxdursa.
   2. V2.list   — 1000 sətir limitini aşır (səhifələmə), xəta olanda boş siyahı
                  göstərmir, son uğurlu nüsxəni qaytarır.
   3. V2.put    — təkrar cəhd + bazadan geri oxuyub təsdiq + dublikatsız (_cid)
                  yenidən göndərmə + əlaqə yoxdursa cihazda növbə (outbox),
                  əlaqə bərpa olunanda avtomatik göndərilir.
   4. saveQuestionToSupabase — hər kateqoriya üçün xəta yoxlanır, bazadan geri
                  oxunub təsdiqlənir; yalnız həqiqətən yazılıbsa "saxlanıldı" deyir.
   5. İcazə uyğunluğu — ad/FIN müqayisəsi Unicode, böyük-kiçik hərf, I/İ/ı və
                  gizli boşluqlara qarşı davamlıdır (iPhone/Android klaviaturaları).
   6. İcazə əlavə etmə — eyni tələbə+sınaq artıq varsa "unique_student_exam" xətası
                  əvəzinə kateqoriyalar (BA/BB/AC) mövcud icazəyə BİRLƏŞDİRİLİR.
   7. Qanunvericilik sualları yalnız 4 variantla (A–D) göstərilir, boş E variantı
                  gizlədilir; yeni saxlanan suallarda boş E bazaya yazılmır.
   8. İcazə canlı sinxron — admin icazə verəndə tələbənin açıq səhifəsi
                  (realtime + 30 san yoxlama + tab/ekran qayıdanda) avtomatik yenilənir.
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQCore) return;

  /* ---------------- ümumi köməkçilər ---------------- */
  var mem = {};
  var LS = {
    get: function (k) {
      var v = null;
      try { v = window.localStorage.getItem(k); } catch (e) {}
      return v !== null ? v : (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null);
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); delete mem[k]; return true; }
      catch (e) { mem[k] = v; return false; }
    },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) {} delete mem[k]; }
  };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function uid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function canon(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
  }
  function getSB() { try { return typeof _supabase !== "undefined" ? _supabase : null; } catch (e) { return null; } }
  function getV2() { try { return typeof V2 !== "undefined" ? V2 : null; } catch (e) { return null; } }
  function isAdmin() { return window.__dqAuthed === true; }

  var AUTH_MSG = "Admin sessiyası bitib və ya icazə yoxdur. Admin kimi yenidən daxil olun.";
  function errInfo(e) {
    var code = String((e && e.code) || ""), msg = String((e && e.message) || e || ""), st = e && e.status;
    var missing = code === "42P01" || code === "PGRST205" || /Could not find the table/i.test(msg) ||
      (st === 404 && /relation|table/i.test(msg));
    var auth = code === "42501" || code === "PGRST301" || st === 401 || st === 403 ||
      /jwt|row-level security|permission denied/i.test(msg);
    var cons = /^23/.test(code) || /^22/.test(code);
    return { missing: missing, auth: auth, fatal: auth || cons, unique: code === "23505", msg: msg, code: code };
  }

  /* ---------------- vəziyyət nişanı (pill) ---------------- */
  var flags = { stale: false }, okTimer = 0, pill = null, okMsg = false;
  function css() {
    if (document.getElementById("dq-core-css")) return;
    var s = document.createElement("style");
    s.id = "dq-core-css";
    s.textContent = "#dq-core-pill{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));" +
      "z-index:99991;max-width:calc(100vw - 24px);padding:9px 14px;border-radius:12px;font:600 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
      "color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.25);cursor:pointer;display:none;-webkit-tap-highlight-color:transparent}" +
      "#dq-core-pill.w{background:#b45309}#dq-core-pill.o{background:#047857}";
    (document.head || document.documentElement).appendChild(s);
  }
  function pillRefresh() {
    var q = box.length, deg = window.DQNet && DQNet.status() === "degraded";
    var text = "", kind = "";
    if (q > 0) { text = "⚠️ " + q + " dəyişiklik bazaya göndərilməyi gözləyir — toxunun"; kind = "w"; }
    else if (okMsg) { text = "✅ Bütün dəyişikliklər mərkəzi bazaya yazıldı"; kind = "o"; }
    else if (isAdmin() && deg) { text = "⚠️ Mərkəzi baza ilə əlaqə zəifdir"; kind = "w"; }
    else if (isAdmin() && flags.stale) { text = "⚠️ Köhnə (keşlənmiş) məlumat göstərilir"; kind = "w"; }
    if (!text) { if (pill) pill.style.display = "none"; return; }
    if (!document.body) return;
    css();
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "dq-core-pill";
      pill.setAttribute("role", "status");
      pill.addEventListener("click", function () { flush(); });
      document.body.appendChild(pill);
    }
    pill.className = kind;
    pill.textContent = text;
    pill.style.display = "block";
  }
  function flashOk() {
    okMsg = true; pillRefresh();
    clearTimeout(okTimer);
    okTimer = setTimeout(function () { okMsg = false; pillRefresh(); }, 3500);
  }

  /* ---------------- outbox (əlaqə yoxdursa cihazda növbə) ---------------- */
  var OBK = "dq_core_outbox_v1", box = [], flushing = false;
  try { box = JSON.parse(LS.get(OBK) || "[]"); if (!Array.isArray(box)) box = []; } catch (e) { box = []; }
  function saveBox() { LS.set(OBK, JSON.stringify(box.slice(-200))); }

  /* ---------------- bazaya yazma: təkrar + təsdiq ---------------- */
  async function cloudWrite(sb, c, o, id, cid, checkFirst) {
    var last = null, norm = canon(JSON.parse(JSON.stringify(o)));
    for (var i = 0; i < 3; i++) {
      try {
        if (id) {
          var r = await sb.from("dq_v2_store").update({ data: o }).eq("id", id).select("id,data");
          if (r.error) {
            var e = errInfo(r.error);
            if (e.fatal) return { ok: false, fatal: true, msg: e.auth ? AUTH_MSG : e.msg };
            last = e.msg;
          } else if (!r.data || !r.data.length) {
            return { ok: false, fatal: true, msg: "dəyişiklik mərkəzi bazaya yazılmadı (icazə yoxdur və ya qeyd silinib). Admin kimi yenidən daxil olun." };
          } else if (canon(r.data[0].data) === norm) {
            return { ok: true, id: r.data[0].id };
          } else { last = "Yazılan məlumat bazadakı ilə üst-üstə düşmədi"; }
        } else {
          if (i > 0 || checkFirst) {
            /* əvvəlki cəhd əslində yazılmış ola bilər (cavab itib) — dublikat yaratma */
            var ex = await sb.from("dq_v2_store").select("id").eq("collection", c).eq("data->>_cid", cid).limit(1);
            if (!ex.error && ex.data && ex.data.length) return { ok: true, id: ex.data[0].id };
          }
          var r2 = await sb.from("dq_v2_store").insert([{ collection: c, data: o }]).select("id");
          if (r2.error) {
            var e2 = errInfo(r2.error);
            if (e2.fatal) return { ok: false, fatal: true, msg: e2.auth ? AUTH_MSG : e2.msg };
            last = e2.msg;
          } else if (!r2.data || !r2.data.length) {
            return { ok: false, fatal: true, msg: "qeyd mərkəzi bazaya yazılmadı (icazə yoxdur). Admin kimi yenidən daxil olun." };
          } else { return { ok: true, id: r2.data[0].id }; }
        }
      } catch (x) { last = String((x && x.message) || x); }
      await sleep(500 * (i + 1) * (i + 1));
    }
    return { ok: false, fatal: false, msg: last || "naməlum xəta" };
  }

  async function flush() {
    if (flushing || !box.length) return;
    var sb = getSB(); if (!sb) return;
    flushing = true;
    var did = false;
    try {
      for (var i = 0; i < box.length;) {
        var it = box[i];
        var r = await cloudWrite(sb, it.c, it.o, it.id, it.cid, true);
        if (r.ok) { box.splice(i, 1); saveBox(); did = true; continue; }
        if (r.fatal) {
          box.splice(i, 1); saveBox();
          try { alert("❌ Növbədəki bir dəyişiklik rədd edildi: " + r.msg); } catch (e) {}
          continue;
        }
        break; /* əlaqə hələ yoxdur — sonra yenə cəhd */
      }
    } finally {
      flushing = false;
      if (did && !box.length) flashOk(); else pillRefresh();
    }
  }

  /* ---------------- V2 yamaqları ---------------- */
  function patchV2() {
    var V = getV2(), sb = getSB();
    if (!V || !sb) return false;

    if (!V.probe || !V.probe.__dqc) {
      V.probe = async function () {
        if (V.mode) return;
        if (V.__dqProbing) return V.__dqProbing;
        V.__dqProbing = (async function () {
          for (var i = 0; i < 4; i++) {
            var r;
            try { r = await sb.from("dq_v2_store").select("id").limit(1); } catch (e) { r = { error: e }; }
            if (!r.error) { V.mode = "cloud"; return; }
            if (errInfo(r.error).missing) { V.mode = "local"; return; }
            await sleep(400 * (i + 1) * (i + 1));
          }
          /* şəbəkə problemi ≠ cədvəl yoxdur: "local"-a keçmə, bulud rejimində qal */
          V.mode = "cloud";
        })().then(function () { V.__dqProbing = null; }, function () { V.__dqProbing = null; V.mode = V.mode || "cloud"; });
        return V.__dqProbing;
      };
      V.probe.__dqc = 1;
    }

    if (!V.list || !V.list.__dqc) {
      var oList = V.list;
      V.list = async function (c) {
        await V.probe();
        if (V.mode !== "cloud") return oList.call(V, c);
        var rows = [], from = 0, step = 1000, failed = false;
        for (;;) {
          var r;
          try {
            r = await sb.from("dq_v2_store").select("*").eq("collection", c)
              .order("id", { ascending: false }).range(from, from + step - 1);
          } catch (e) { r = { error: e }; }
          if (r.error) { failed = true; break; }
          var d = r.data || [];
          rows = rows.concat(d);
          if (d.length < step || from > 50000) break;
          from += step;
        }
        var ck = "dq_core_c_" + c;
        if (failed) {
          flags.stale = true; pillRefresh();
          try { var cached = JSON.parse(LS.get(ck) || "null"); if (Array.isArray(cached)) return cached; } catch (e) {}
          return [];
        }
        flags.stale = false;
        var out = rows.map(function (x) { return Object.assign({}, x.data, { _id: x.id }); });
        try { var js = JSON.stringify(out); if (js.length < 400000) LS.set(ck, js); } catch (e) {}
        return out;
      };
      V.list.__dqc = 1;
    }

    if (!V.put || !V.put.__dqc) {
      var oPut = V.put;
      V.put = async function (c, obj, id) {
        await V.probe();
        if (V.mode !== "cloud") return oPut.call(V, c, obj, id);
        var o = Object.assign({}, obj); delete o._id;
        var cid = null;
        if (!id) { cid = o._cid || (o._cid = uid()); }
        var res = await cloudWrite(sb, c, o, id, cid, false);
        if (res.ok) { if (box.length) flush(); return res.id; }
        if (res.fatal) { alert("Xəta: " + res.msg); return; }
        box.push({ c: c, o: o, id: id || null, cid: cid, ts: Date.now() });
        saveBox(); pillRefresh();
        alert("⚠️ Bağlantı problemi: dəyişiklik mərkəzi bazaya HƏLƏ yazılmadı.\nMəlumat cihazda təhlükəsiz saxlanıldı və internet bərpa olunan kimi avtomatik göndəriləcək. Səhifəni bağlamayın.");
        return;
      };
      V.put.__dqc = 1;
    }
    return true;
  }

  /* ---------------- sual saxlama (exam_questions) ---------------- */
  var QKEY = ["exam_id", "category", "q_number"];
  async function saveQuestionSafe() {
    var sb = getSB();
    if (!sb) { alert("Mərkəzi baza qoşulmayıb."); return; }
    if (window.__dqSavingQ) return;
    window.__dqSavingQ = 1;
    var btn = document.activeElement && document.activeElement.tagName === "BUTTON" ? document.activeElement : null;
    if (btn) btn.disabled = true;
    try {
      var $ = function (i) { return document.getElementById(i); };
      var qText = $("questionText").value.trim();
      var isOpen = editorSelectedCategory === "BA" && openQuestionIds.includes(editorCurrentQIndex);
      var options = [], correctVal = 0;
      if (isOpen) {
        correctVal = $("editor-open-correct").value.trim().toUpperCase();
      } else {
        var inputs = document.querySelectorAll(".ed-opt-txt"),
          radio = document.querySelector('input[name="editor-correct-radio"]:checked');
        if (radio) correctVal = parseInt(radio.value);
        inputs.forEach(function (inp, idx) {
          options.push({ text: inp.value.trim(), image: editorUploadedOptions[idx] || null });
        });
      }
      if (!isOpen) {
        var isQan = false;
        try { isQan = typeof getSubjectByNumber === "function" && getSubjectByNumber(editorCurrentQIndex) === "Qanunvericilik"; } catch (e) {}
        if (isQan && options.length > 4 && parseInt(correctVal) !== 4) options = options.slice(0, 4);
        while (options.length > 2) {
          var lastO = options[options.length - 1];
          if (lastO.text || lastO.image) break;
          options.pop();
        }
      }
      var hasContent = qText || editorImageData || options.some(function (o) { return o.text || o.image; });
      if (!hasContent) { alert("Sual boşdur: mətn, şəkil və ya variant daxil edin."); return; }

      var cats = [];
      document.querySelectorAll(".editor-target-cat-chk:checked").forEach(function (c) { cats.push(c.value); });
      if (!cats.length) cats.push(editorSelectedCategory);

      var payload = { question: qText, image_url: editorImageData, options: options, correct: correctVal };
      var ok = [], bad = [];
      for (var k = 0; k < cats.length; k++) {
        var cat = cats[k];
        var key = { exam_id: editorSelectedExam, category: cat, q_number: editorCurrentQIndex };
        var res = await writeOneQuestion(sb, key, payload, editorSelectedSubject);
        (res.ok ? ok : bad).push(res.ok ? cat : (cat + ": " + res.msg));
      }
      var n = editorCurrentQIndex;
      if (!bad.length) {
        editorUploadedOptions = {};
        alert("Sual " + n + " mərkəzi bazaya yazıldı və bazadan təsdiqləndi ✅" + (ok.length > 1 ? "\n(" + ok.join(", ") + ")" : ""));
      } else {
        alert("❌ Sual " + n + " bazaya YAZILMADI:\n" + bad.join("\n") +
          (ok.length ? "\n\nYazıldı: " + ok.join(", ") : "") +
          "\n\nSual mətnini kopyalayın, bağlantını yoxlayın və yenidən saxlayın.");
      }
    } finally {
      window.__dqSavingQ = 0;
      if (btn) btn.disabled = false;
    }
  }

  async function writeOneQuestion(sb, key, payload, subject) {
    var lastMsg = "naməlum xəta";
    for (var i = 0; i < 3; i++) {
      try {
        /* mövcud sətir(lər)i yenilə — maybeSingle istifadə olunmur (dublikat olsa xəta verir) */
        var u = await sb.from("exam_questions").update(payload).match(key).select("id");
        if (u.error) {
          var eu = errInfo(u.error);
          if (eu.fatal) return { ok: false, msg: eu.auth ? AUTH_MSG : eu.msg };
          lastMsg = eu.msg;
        } else if (u.data && u.data.length) {
          if (await verifyQuestion(sb, key, payload)) return { ok: true };
          lastMsg = "Yazılan sual bazadan təsdiqlənmədi";
        } else {
          var row = Object.assign({}, key, { subject: subject }, payload);
          var ins = await sb.from("exam_questions").insert([row]).select("id");
          if (ins.error) {
            var ei = errInfo(ins.error);
            if (ei.unique) continue; /* paralel yazılıb — yenidən yenilə */
            if (ei.fatal) return { ok: false, msg: ei.auth ? AUTH_MSG : ei.msg };
            lastMsg = ei.msg;
          } else if (!ins.data || !ins.data.length) {
            return { ok: false, msg: "server yazmağa icazə vermədi (admin sessiyasını yoxlayın)" };
          } else if (await verifyQuestion(sb, key, payload)) {
            return { ok: true };
          } else { lastMsg = "Yazılan sual bazadan təsdiqlənmədi"; }
        }
      } catch (x) { lastMsg = String((x && x.message) || x); }
      await sleep(500 * (i + 1) * (i + 1));
    }
    return { ok: false, msg: lastMsg };
  }

  async function verifyQuestion(sb, key, p) {
    var r = await sb.from("exam_questions").select("question,correct,options,image_url").match(key).limit(1);
    if (r.error || !r.data || !r.data.length) return false;
    var d = r.data[0];
    return canon({ q: d.question, c: String(d.correct), o: d.options, i: d.image_url || null }) ===
      canon({ q: p.question, c: String(p.correct), o: p.options, i: p.image_url || null });
  }

  /* ---------------- ad / FIN uyğunluğu (cihazdan asılı olmayaraq) ---------------- */
  function normName(s) {
    s = String(s == null ? "" : s);
    try { s = s.normalize("NFC"); } catch (e) {}
    s = s.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
      .replace(/\s+/g, " ").trim();
    try { s = s.toLocaleLowerCase("az"); } catch (e) { s = s.toLowerCase(); }
    return s.replace(/\u0307/g, "").replace(/\u0131/g, "i").replace(/\u0130/g, "i");
  }
  var FIN_IDS = { "user-fin": 1, "adm-student-fin": 1, "cab-fin": 1, "sch-fin": 1, "dq-fl-fin": 1, "dqpf-fin": 1,
    "dqx-fin": 1, "lx-fin": 1, "lx-pfin": 1, "pw-fin": 1, "sp-fl-fin": 1, "u-fin": 1 };
  var NAME_IDS = { "user-name": 1, "adm-student-name": 1, "cab-name": 1 };
  function cleanFin(v) {
    return String(v).replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF\u00AD\-]/g, "").toUpperCase();
  }
  function hardenInputs() {
    document.addEventListener("focusin", function (e) {
      var t = e.target; if (!t || !t.id) return;
      if (FIN_IDS[t.id]) {
        t.setAttribute("autocapitalize", "characters"); t.setAttribute("autocorrect", "off");
        t.setAttribute("autocomplete", "off"); t.setAttribute("spellcheck", "false");
      } else if (NAME_IDS[t.id]) {
        t.setAttribute("autocapitalize", "words"); t.setAttribute("autocorrect", "off");
        t.setAttribute("spellcheck", "false");
      }
    }, true);
    document.addEventListener("input", function (e) {
      var t = e.target; if (!t || !t.id || !FIN_IDS[t.id] || t.composing) return;
      var v = cleanFin(t.value);
      if (v !== t.value) {
        t.value = v;
        try { t.setSelectionRange(v.length, v.length); } catch (x) {}
      }
    }, true);
    document.addEventListener("compositionstart", function (e) { if (e.target) e.target.composing = 1; }, true);
    document.addEventListener("compositionend", function (e) { if (e.target) e.target.composing = 0; }, true);
  }

  /* ---------------- icazə canlı sinxron ---------------- */
  var lastSig = null, lastFin = "", busyP = false, lastRender = 0;
  function curFin() { try { return typeof currentActiveFin !== "undefined" ? currentActiveFin : ""; } catch (e) { return ""; } }
  function rerender() {
    var el = document.getElementById("registered-exams-list");
    if (!el || el.offsetParent === null || typeof renderRegisteredExams !== "function") return true;
    if (Date.now() - lastRender < 8000) return false;
    lastRender = Date.now();
    try { renderRegisteredExams(); } catch (e) {}
    return true;
  }
  async function checkPerm() {
    if (busyP) return;
    var fin = curFin(), sb = getSB();
    if (!fin || fin === "ADMIN" || !sb) return;
    busyP = true;
    try {
      var r = await sb.from("allowed_students").select("id,exam_no,categories,student_name").eq("fin", fin).order("id");
      if (r.error || !r.data) return;
      var sig = canon(r.data);
      if (fin !== lastFin) { lastFin = fin; lastSig = sig; return; }
      if (sig !== lastSig && rerender()) lastSig = sig;
    } catch (e) {} finally { busyP = false; }
  }
  function permSync() {
    var sb = getSB();
    try {
      if (sb && sb.channel) {
        sb.channel("dq-core-perm").on("postgres_changes", { event: "*", schema: "public", table: "allowed_students" },
          function () { checkPerm(); }).subscribe();
      }
    } catch (e) {}
    function wake() { if (!document.hidden) { checkPerm(); if (box.length) flush(); } }
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);   /* iOS Safari bfcache */
    window.addEventListener("focus", wake);
    window.addEventListener("online", function () { flush(); checkPerm(); });
    setInterval(function () { if (!document.hidden) checkPerm(); }, 30000);
  }

  /* ---------------- icazə əlavə etmə: eyni tələbə+sınaq varsa kateqoriyaları BİRLƏŞDİR ---------------- */
  function toArr(c) {
    if (Array.isArray(c)) return c.map(String);
    if (c == null || c === "") return [];
    if (typeof c === "string") {
      try { var j = JSON.parse(c); if (Array.isArray(j)) return j.map(String); } catch (e) {}
      return c.split(/[\s,;]+/).filter(Boolean);
    }
    return [];
  }
  function union(a, b) {
    var seen = {}, out = [];
    a.concat(b).forEach(function (x) { x = String(x).toUpperCase(); if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  async function grantOne(orig, row) {
    var T = "allowed_students", cats = toArr(row.categories);
    async function findBy(col) {
      var q = await orig(T).select("*").eq(col, row[col]).eq("exam_no", row.exam_no);
      return q.error ? { error: q.error } : { row: (q.data && q.data[0]) || null };
    }
    async function merge(ex) {
      var u = await orig(T).update({ categories: union(toArr(ex.categories), cats) }).eq("id", ex.id).select();
      return u.error ? { error: u.error } : { data: u.data || [] };
    }
    var f = await findBy("fin");
    if (f.error) return { error: f.error };
    if (f.row) return merge(f.row);
    var ins = await orig(T).insert([row]).select();
    if (!ins.error) return { data: ins.data || [] };
    if (!errInfo(ins.error).unique) return { error: ins.error };
    /* unikal açar başqa sütunlara bağlıdırsa (məs. ad+sınaq) — onu tap və birləşdir */
    var f2 = await findBy("fin");
    if (!f2.row) f2 = row.student_name ? await findBy("student_name") : f2;
    if (f2.row) return merge(f2.row);
    return { error: ins.error };
  }
  function patchAllowed() {
    var sb = getSB();
    if (!sb || typeof sb.from !== "function" || sb.from.__dqc) return;
    var orig = sb.from.bind(sb);
    var wrapped = function (t) {
      var b = orig(t);
      if (t !== "allowed_students") return b;
      b.insert = function (rows) {
        var arr = Array.isArray(rows) ? rows : [rows];
        var p = (async function () {
          var all = [];
          for (var i = 0; i < arr.length; i++) {
            var r = await grantOne(orig, arr[i]);
            if (r.error) return { data: null, error: r.error, count: null, status: 400, statusText: "Bad Request" };
            all = all.concat(r.data);
          }
          return { data: all, error: null, count: null, status: 201, statusText: "Created" };
        })();
        var th = {
          select: function () { return th; },
          single: function () { return p.then(function (r) { return r.error ? r : Object.assign({}, r, { data: r.data[0] || null }); }); },
          maybeSingle: function () { return th.single(); },
          then: function (a, c) { return p.then(a, c); },
          catch: function (c) { return p.catch(c); }
        };
        return th;
      };
      return b;
    };
    wrapped.__dqc = 1;
    sb.from = wrapped;
  }

  /* ---------------- Qanunvericilik: yalnız 4 variant (A–D); boş E göstərilmir ---------------- */
  function findQ(n) {
    try {
      if (typeof allQuestions !== "undefined" && Array.isArray(allQuestions)) {
        for (var i = 0; i < allQuestions.length; i++) if (String(allQuestions[i].id) === String(n)) return allQuestions[i];
      }
    } catch (e) {}
    return null;
  }
  function trimOptions() {
    var radios = document.querySelectorAll('input[type="radio"][name^="opt-"][value="4"]');
    for (var i = 0; i < radios.length; i++) {
      var r = radios[i], lab = r.closest ? r.closest("label") : null;
      if (!lab || lab.getAttribute("data-dq-e")) continue;
      var n = r.name.slice(4), q = findQ(n), subj = "";
      try { subj = (q && q.subject) || (typeof getSubjectByNumber === "function" ? getSubjectByNumber(parseInt(n)) : "") || ""; } catch (e) {}
      var txt = (lab.textContent || "").replace(/^\s*E\)\s*/, "").trim();
      var hasImg = !!lab.querySelector("img.opt-preview-img");
      var keepE = q && String(q.correct) === "4";
      if ((!txt && !hasImg) || (/qanunvericilik/i.test(subj) && !keepE)) {
        lab.style.display = "none";
        lab.setAttribute("data-dq-e", "1");
      }
    }
  }
  function limitVariants() {
    var sched = 0;
    function go() { if (sched) return; sched = 1; (window.requestAnimationFrame || setTimeout)(function () { sched = 0; try { trimOptions(); } catch (e) {} }); }
    try { new MutationObserver(go).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setInterval(function () { if (!document.hidden) go(); }, 2000);
    go();
  }

  /* ---------------- yamaqların tətbiqi və qorunması ---------------- */
  function applyAll() {
    patchV2();
    patchAllowed();
    if (!window.saveQuestionToSupabase || !window.saveQuestionToSupabase.__dqc) {
      if (typeof window.saveQuestionToSupabase === "function") {
        saveQuestionSafe.__dqc = 1;
        window.saveQuestionToSupabase = saveQuestionSafe;
      }
    }
    if (!window.dqNormName || !window.dqNormName.__dqc) {
      if (typeof window.dqNormName === "function") { normName.__dqc = 1; window.dqNormName = normName; }
    }
  }

  function start() {
    applyAll();
    hardenInputs();
    limitVariants();
    permSync();
    if (window.DQNet) DQNet.onChange(function () { pillRefresh(); if (DQNet.status() === "ok") flush(); });
    setInterval(function () { applyAll(); if (box.length && !document.hidden) flush(); pillRefresh(); }, 3000);
    if (box.length) { pillRefresh(); setTimeout(flush, 1500); }
  }

  window.DQCore = {
    version: "1.2", flush: flush,
    pending: function () { return box.length; },
    normName: normName, canon: canon
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
