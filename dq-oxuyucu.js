/* DQ Platform — dq-oxuyucu.js (v1) — «🧠 Ağıllı Oxuyucu»
   · Mətn / PDF / şəkil (OCR) → sual + variantlar (A–E, istənilən sırada) + düzgün cavab + izah
   · Çox sualı ardıcıl düzür, nömrələyir, təkrarları və çatışmazlıqları göstərir, redaktə etməyə imkan verir
   · Hədəflər: «exam» (Copy/Paste paneli → Supabase exam_questions) və «krs» (Karusel → seçilmiş mövzu)
   · Asılılıq: app.js (pdf.js/Tesseract yükləyicisi window.__dqLibs, _supabase, getSubjectByNumber, dqClean) */
(function (root) {
  "use strict";
  var LET = "ABCDE";

  /* ====================================================================
     1. PARSER (təmiz funksiya — DOM-dan asılı deyil)
     ==================================================================== */
  var CYR = { "А": "A", "В": "B", "С": "C", "Е": "E", "а": "a", "в": "b", "с": "c", "е": "e" };
  var RE_OPT = /^\(?([A-Ea-e])\s*[.)\]}:]\s*(.*)$/;
  var RE_QNUM = /^(?:sual\s*|q(?:uestion)?\s*|№\s*)?(\d{1,3})\s*[.)\-–:]\s*(\S.*)$/i;
  var RE_ANS = /^(?:düzgün\s+)?(?:cavab(?:ı)?|answer|ans|cavabı)\s*[:=\-–]\s*\(?([A-Ea-e])\)?\s*[.)]?\s*(?:[-–:]?\s*(.*))?$/i;
  var RE_EXP = /^(?:izah(?:at)?|şərh|həlli|həll|explanation)\s*[:\-–]\s*(.*)$/i;
  var RE_KEYHEAD = /^(?:cavablar|cavab\s+açarı|açar|answers?(?:\s+key)?)\s*[:\-–]?\s*$/i;
  var RE_PAIRS1 = /^(?:\d{1,3}\s*[-–.):=]?\s*[A-Ea-e]\s*[,;/]?\s*)+$/;
  var RE_PAIRS = /^(?:\d{1,3}\s*[-–.):=]?\s*[A-Ea-e]\s*[,;/]?\s*){2,}$/;
  var OK_MARK = /(?:\s*(?:✓|✔|☑|\(\s*\+\s*\)|\(\s*düzgün\s*\))\s*$)|(?:^\s*(?:✓|✔|☑)\s*)/i;

  function prep(raw) {
    var t = String(raw || "").replace(/\r/g, "").replace(/[\u00a0\u2007\u202f\t]/g, " ").replace(/[\u200b-\u200d\ufeff\u00ad]/g, "");
    t = t.replace(/(^|\s)\(?([АВСЕавсе])(?=\s?[).\]])/g, function (m, p, c) { return p + (CYR[c] || c); });
    var out = [];
    t.split("\n").forEach(function (ln) {
      ln = ln.replace(/ {2,}/g, " ").trim();
      if (!ln) { out.push(""); return; }
      if (/^[-–—\s]*(?:səh(?:ifə)?\.?|page)?\s*\d{1,3}\s*[-–—]*$/i.test(ln) && ln.length < 14 && !RE_QNUM.test(ln)) return; /* səhifə nömrəsi */
      breakInline(ln).forEach(function (x) { out.push(x); });
    });
    /* təkrarlanan başlıq/altlıq sətirləri (≥3 dəfə, qısa, nömrəsiz) */
    var cnt = {}; out.forEach(function (l) { if (l && l.length < 70) cnt[l] = (cnt[l] || 0) + 1; });
    return out.filter(function (l) { return !(l && cnt[l] >= 3 && !RE_OPT.test(l) && !RE_QNUM.test(l) && !RE_ANS.test(l)); });
  }

  /* bir sətirdə birdən çox variant/«Cavab:» varsa ayır */
  function breakInline(line) {
    var s = line, parts = [];
    var am = s.match(/\s+((?:düzgün\s+)?cavab(?:ı)?\s*[:=\-–]\s*\(?[A-Ea-e]\)?\.?)\s*$/i);
    var tail = null;
    if (am && am.index > 0 && !/^düzgün$/i.test(s.slice(0, am.index).trim())) { tail = am[1]; s = s.slice(0, am.index); }
    var re = /(^|\s)\(?([A-Ea-e])\s?[.)\]}](?=\s|$)/g, m, mk = [];
    while ((m = re.exec(s))) {
      var L = m[2], atStart = m.index === 0 && m[1] === "";
      if (!atStart && L !== L.toUpperCase()) continue;
      mk.push({ pos: m.index + m[1].length, L: L.toUpperCase(), start: atStart });
    }
    var letters = {}; mk.forEach(function (k) { letters[k.L] = 1; });
    var distinct = Object.keys(letters).length;
    if (distinct >= 2 || (distinct === 1 && mk[0].L === "A" && !mk[0].start)) {
      var last = 0;
      mk.forEach(function (k, i) { if (k.pos > last) { var seg = s.slice(last, k.pos).trim(); if (seg) parts.push(seg); last = k.pos; } });
      var rest = s.slice(last).trim(); if (rest) parts.push(rest);
      /* hər seqment tək marker ilə başlamalıdır — artıq belədir */
      var fin = [], cur = "";
      parts.forEach(function (p) { fin.push(p); });
      parts = fin;
    } else parts = [s.trim()];
    if (tail) parts.push(tail);
    return parts.filter(Boolean);
  }

  function isStatement(ln) { return /^(?:[IVX]{1,4}\s*[.)]|\d{1,2}\s*[.)]|[-–•▪●○]\s)/.test(ln); }

  function parse(raw) {
    var lines = prep(raw), qs = [], cur = null, mode = "stem", blank = false, keyMode = false, key = {}, m;
    var hasNums = lines.some(function (l) { return l && RE_QNUM.test(l) && !RE_OPT.test(l); });
    function optCount(q) { return LET.split("").filter(function (l) { return q.opts[l]; }).length; }
    function mk(num, stem) { var q = { num: num, stem: stem || "", opts: {}, correct: -1, exp: "", last: null }; qs.push(q); return q; }
    lines.forEach(function (ln) {
      if (!ln) { blank = true; return; }
      var wasBlank = blank; blank = false;
      if (RE_KEYHEAD.test(ln)) { keyMode = true; return; }
      if ((keyMode && RE_PAIRS1.test(ln)) || RE_PAIRS.test(ln)) {
        var r = /(\d{1,3})\s*[-–.):=]?\s*([A-Ea-e])/g, x; while ((x = r.exec(ln))) key[+x[1]] = x[2].toUpperCase(); return;
      }
      if (cur && (m = ln.match(RE_ANS))) { cur.correct = LET.indexOf(m[1].toUpperCase()); if (m[2] && /^(?:izah|şərh)/i.test(m[2])) cur.exp = m[2].replace(RE_EXP, "$1"); mode = "done"; return; }
      if (cur && (m = ln.match(RE_EXP))) { cur.exp = m[1]; mode = "exp"; return; }
      if ((m = ln.match(RE_OPT)) && m[2] !== undefined) {
        var L = m[1].toUpperCase(), txt = m[2].trim();
        if (!cur) { cur = mk(null, ""); }
        else if (cur.opts[L] !== undefined && optCount(cur) >= 2 && !hasNums) { cur = mk(null, ""); }
        else if (cur.opts[L] !== undefined) { cur.opts[L] += " " + txt; cur.last = L; mode = "opt"; return; }
        if (OK_MARK.test(txt)) { txt = txt.replace(OK_MARK, "").trim(); cur.correct = LET.indexOf(L); }
        cur.opts[L] = txt; cur.last = L; mode = "opt"; return;
      }
      if ((m = ln.match(RE_QNUM)) && (!cur || optCount(cur) >= 2 || mode === "done")) {
        cur = mk(+m[1], m[2].trim()); mode = "stem"; return;
      }
      if (!cur) { cur = mk(null, ln); mode = "stem"; return; }
      if (mode === "opt") {
        if (wasBlank || (!hasNums && optCount(cur) >= 4 && /^[A-ZƏÖÜÇŞĞİ0-9"«]/.test(ln) && /[.?!:;»")]$/.test(cur.opts[cur.last] || ""))) { cur = mk(null, ln); mode = "stem"; return; }
        cur.opts[cur.last] += " " + ln; return;
      }
      if (mode === "done") { cur = mk(null, ln); mode = "stem"; return; }
      if (mode === "exp") { cur.exp += " " + ln; return; }
      cur.stem += (cur.stem ? (isStatement(ln) ? "\n" : " ") : "") + ln;
    });
    var seen = {}, res = [];
    qs.forEach(function (q) {
      q.stem = q.stem.replace(/[ ]{2,}/g, " ").trim();
      if (q.num != null && key[q.num] && q.correct < 0) q.correct = LET.indexOf(key[q.num]);
      var n = optCount(q);
      if (!q.stem && !n) return;
      if (!n && q.stem.length < 6) return;
      q.options = LET.split("").map(function (l) { return q.opts[l] || ""; });
      q.issues = [];
      res.push(q);
    });
    res.forEach(function (q) { validate(q, seen); });
    return res;
  }

  function validate(q, seen) {
    var n = q.options.filter(Boolean).length, iss = [];
    if (!q.stem) iss.push("sual mətni boşdur");
    if (n < 2) iss.push("variant çatışmır");
    else {
      var hi = -1; q.options.forEach(function (o, i) { if (o) hi = i; });
      var gaps = []; for (var i = 0; i <= hi; i++) if (!q.options[i]) gaps.push(LET[i]);
      if (gaps.length) iss.push(gaps.join(", ") + " variantı boşdur");
      else if (hi < 3) iss.push("4-dən az variant");
    }
    if (q.correct < 0) iss.push("düzgün cavab seçilməyib");
    else if (!q.options[q.correct]) iss.push("düzgün cavab boş variantdadır");
    if (seen) { var sig = q.stem.toLowerCase().replace(/\W+/g, " ").trim(); if (sig && seen[sig]) iss.push("təkrar sual"); else if (sig) seen[sig] = 1; }
    q.issues = iss; return q;
  }

  /* Karusel (krs) formatı: {t, o:[...], c, e} */
  function toKrs(list) {
    return list.map(function (q) {
      var hi = -1; q.options.forEach(function (o, i) { if (o) hi = i; });
      return { t: q.stem, o: q.options.slice(0, hi + 1), c: q.correct, e: q.exp || "" };
    }).filter(function (x) { return x.t && x.o.filter(Boolean).length >= 2; });
  }

  /* ====================================================================
     2. FAYLDAN MƏTN (PDF mətn qatı → yoxdursa OCR; şəkil → OCR)
     ==================================================================== */
  function lib(k) { return root.__dqLibs ? root.__dqLibs(k) : Promise.reject(new Error("Kitabxana yükləyicisi tapılmadı")); }
  function itemsToLines(items, W) {
    var its = items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) { return { s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || 10 }; });
    if (!its.length) return [];
    var mid = W / 2, span = its.filter(function (i) { return i.x < mid - 6 && i.x + i.w > mid + 6; }).length;
    var left = its.filter(function (i) { return i.x < mid; }).length, right = its.length - left;
    var two = W > 0 && span / its.length < .06 && left > its.length * .28 && right > its.length * .28 && its.filter(function (i) { return i.x > mid + 8; }).length > 12;
    function group(arr) {
      arr.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
      var L = [];
      arr.forEach(function (i) { var l = L[L.length - 1]; if (l && Math.abs(l.y - i.y) < Math.max(3, i.h * .5)) l.i.push(i); else L.push({ y: i.y, i: [i] }); });
      return L.map(function (l) {
        l.i.sort(function (a, b) { return a.x - b.x; });
        var s = "", px = null;
        l.i.forEach(function (i) { if (px !== null && i.x - px > 1.5) s += " "; s += i.s; px = i.x + i.w; });
        return s.replace(/\s+/g, " ").trim();
      });
    }
    return two ? group(its.filter(function (i) { return i.x < mid; })).concat(group(its.filter(function (i) { return i.x >= mid; }))) : group(its);
  }
  function toCanvas(src, maxW) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(2.2, Math.max(1, maxW / im.width)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        try { var d = g.getImageData(0, 0, c.width, c.height), p = d.data; for (var i = 0; i < p.length; i += 4) { var v = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11); v = v > 170 ? 255 : v < 90 ? 0 : (v - 90) * 255 / 80; p[i] = p[i + 1] = p[i + 2] = v; } g.putImageData(d, 0, 0); } catch (e) { }
        ok(c);
      };
      im.onerror = function () { no(new Error("Şəkil açılmadı")); };
      im.src = src;
    });
  }
  async function ocr(canvas, label, prog) {
    await lib("ocr");
    if (typeof Tesseract === "undefined") throw new Error("OCR kitabxanası yüklənmədi — internet bağlantısını yoxlayın.");
    var r = await Tesseract.recognize(canvas, "aze+eng", { logger: function (m) { if (m.status === "recognizing text") prog(null, label + " · " + Math.round(m.progress * 100) + "%"); } });
    return (r && r.data && r.data.text) || "";
  }
  function readFile(file, mode) {
    return new Promise(function (ok, no) { var r = new FileReader(); r.onerror = function () { no(new Error("Fayl oxunmadı")); }; r.onload = function () { ok(r.result); }; mode === "text" ? r.readAsText(file) : mode === "buf" ? r.readAsArrayBuffer(file) : r.readAsDataURL(file); });
  }
  async function extract(file, prog) {
    var n = file.name || "fayl", t = file.type || "";
    if (/text\/|\.txt$/i.test(t + n)) return await readFile(file, "text");
    if (t.indexOf("image/") === 0) {
      prog(null, n + " · şəkil hazırlanır");
      var dataUrl = await readFile(file, "url"), cv = await toCanvas(dataUrl, 2000);
      return await ocr(cv, n, prog);
    }
    if (/pdf/i.test(t) || /\.pdf$/i.test(n)) {
      await lib("pdf");
      var pdf = await root.pdfjsLib.getDocument(new Uint8Array(await readFile(file, "buf"))).promise, all = "";
      for (var p = 1; p <= pdf.numPages; p++) {
        prog(Math.round((p - 1) / pdf.numPages * 100), n + " · səhifə " + p + "/" + pdf.numPages);
        var pg = await pdf.getPage(p), vp1 = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
        var ls = itemsToLines(tc.items, vp1.width), txt = ls.join("\n");
        if (txt.replace(/\s/g, "").length < 40) {
          var vp = pg.getViewport({ scale: 2.2 }), c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
          await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          txt = await ocr(c, n + " · səhifə " + p + " (OCR)", prog);
        }
        all += txt + "\n";
      }
      return all;
    }
    throw new Error("«" + n + "» dəstəklənmir (PDF, şəkil və ya .txt seçin)");
  }

  /* ====================================================================
     3. İSTİFADƏÇİ İNTERFEYSİ
     ==================================================================== */
  var D = typeof document !== "undefined" ? document : null;
  var S = { list: [], target: "exam", busy: false, ctx: {} };
  var $ = function (i) { return D.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rootEl = null;

  var CSS = '#dqr{position:fixed;inset:0;z-index:2147483100;display:none;background:#0b1b3acc;backdrop-filter:blur(3px)}#dqr.open{display:block}' +
    '#dqr .p{position:absolute;inset:0;max-width:980px;margin:0 auto;background:#f6f7fb;display:flex;flex-direction:column;box-shadow:0 30px 80px #0008}' +
    '@media(min-width:900px){#dqr .p{inset:20px 0;border-radius:22px;overflow:hidden}}' +
    '#dqr .h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;background:linear-gradient(120deg,#4f46e5,#7c3aed 55%,#06b6d4);color:#fff}' +
    '#dqr .h b{font-size:17px}#dqr .h small{display:block;opacity:.85;font-weight:400}' +
    '#dqr .b{flex:1;overflow:auto;padding:14px 16px;-webkit-overflow-scrolling:touch}' +
    '#dqr .f{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fff}' +
    '#dqr textarea,#dqr input[type=text],#dqr input[type=number],#dqr select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;background:#fff;box-sizing:border-box}' +
    '#dqr textarea{min-height:120px;resize:vertical;line-height:1.5}' +
    '#dqr .bt{border:0;border-radius:10px;padding:9px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#e2e8f0;color:#0f172a;white-space:nowrap}' +
    '#dqr .bt.pri{background:linear-gradient(120deg,#4f46e5,#7c3aed);color:#fff}#dqr .bt.grn{background:linear-gradient(120deg,#10b981,#059669);color:#fff}#dqr .bt.red{background:#fee2e2;color:#b91c1c}#dqr .bt:disabled{opacity:.5;cursor:default}' +
    '#dqr .drop{border:2px dashed #a5b4fc;border-radius:16px;padding:18px;text-align:center;background:#eef2ff;color:#3730a3;font-weight:700;cursor:pointer;margin:10px 0}#dqr .drop.on{background:#e0e7ff;border-color:#4f46e5}' +
    '#dqr .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}' +
    '#dqr .pg{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0;display:none}#dqr .pg i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4f46e5,#06b6d4);transition:width .25s}' +
    '#dqr .st{font-size:12.5px;color:#475569;margin:4px 0}' +
    '#dqr .q{background:#fff;border:1px solid #e2e8f0;border-left:5px solid #10b981;border-radius:16px;padding:12px;margin:10px 0;box-shadow:0 6px 18px -12px #4f46e5}' +
    '#dqr .q.w{border-left-color:#f59e0b}#dqr .q.e{border-left-color:#ef4444}' +
    '#dqr .qh{display:flex;gap:8px;align-items:center;margin-bottom:8px}#dqr .qh .n{width:64px}#dqr .qh .sp{flex:1}' +
    '#dqr .o{display:flex;gap:6px;align-items:center;margin:5px 0}#dqr .o label{flex:none;width:26px;height:26px;border-radius:50%;background:#e0e7ff;color:#3730a3;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px}' +
    '#dqr .o input[type=radio]{flex:none;width:20px;height:20px;accent-color:#10b981}#dqr .o.ok label{background:#10b981;color:#fff}' +
    '#dqr .iss{font-size:12px;color:#b45309;background:#fef3c7;border-radius:8px;padding:4px 8px;margin-top:6px}#dqr .iss.e{color:#b91c1c;background:#fee2e2}' +
    '#dqr .sum{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}#dqr .sum span{padding:4px 10px;border-radius:99px;font-size:12px;font-weight:800;background:#e2e8f0}#dqr .sum .g{background:#d1fae5;color:#065f46}#dqr .sum .y{background:#fef3c7;color:#92400e}' +
    '#dqr .tg{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#dqr .tg label{font-weight:700;font-size:13px}' +
    '#dqr details{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin:8px 0}#dqr summary{cursor:pointer;font-weight:700;font-size:13px}';

  function ui() {
    if (rootEl) return;
    var st = D.createElement("style"); st.textContent = CSS; D.head.appendChild(st);
    rootEl = D.createElement("div"); rootEl.id = "dqr"; rootEl.setAttribute("role", "dialog");
    rootEl.innerHTML = '<div class="p"><div class="h"><div><b>🧠 Ağıllı Oxuyucu</b><small id="dqr-sub"></small></div><button type="button" class="bt" data-a="close">✕</button></div>' +
      '<div class="b" id="dqr-b"></div><div class="f" id="dqr-f"></div></div>';
    D.body.appendChild(rootEl);
    rootEl.addEventListener("click", onClick);
    rootEl.addEventListener("input", onInput);
    rootEl.addEventListener("change", onChange);
    var dz = null;
    rootEl.addEventListener("dragover", function (e) { if (e.target.closest && e.target.closest(".drop")) { e.preventDefault(); e.target.closest(".drop").classList.add("on"); } });
    rootEl.addEventListener("dragleave", function (e) { var d = e.target.closest && e.target.closest(".drop"); d && d.classList.remove("on"); });
    rootEl.addEventListener("drop", function (e) { var d = e.target.closest && e.target.closest(".drop"); if (!d) return; e.preventDefault(); d.classList.remove("on"); addFiles(e.dataTransfer.files); });
    D.addEventListener("keydown", function (e) { if (e.key === "Escape" && rootEl.classList.contains("open") && !S.busy) close(); });
  }

  function open(o) {
    ui(); o = o || {}; S.target = o.target || "exam"; S.ctx = o; S.files = []; S.list = []; S.step = "in";
    var seed = o.text || "";
    S.text = seed;
    $("dqr-sub").textContent = S.target === "krs" ? "Karusel · " + (root.KRSX ? root.KRSX.topic() : "") : "Sınaq sualları · Copy/Paste paneli";
    rootEl.classList.add("open"); D.documentElement.style.overflow = "hidden";
    render();
  }
  function close() { rootEl.classList.remove("open"); D.documentElement.style.overflow = ""; }

  function prog(p, t) {
    var pg = $("dqr-pg"), st = $("dqr-st"); if (!pg) return;
    pg.style.display = "block"; if (p != null) pg.firstChild.style.width = p + "%"; if (t) st.textContent = t;
  }

  function render() {
    var b = $("dqr-b"), f = $("dqr-f");
    if (S.step === "in") {
      b.innerHTML = '<div class="st">Mətni yapışdırın və ya PDF / şəkil (bir neçəsini birdən) yükləyin. Variantlar istənilən sırada, bir sətirdə və ya ayrı-ayrı yazıla bilər; «Cavab: B», «✓» və ya sonda cavab açarı («1-A 2-C …») avtomatik tanınır.</div>' +
        '<textarea id="dqr-t" placeholder="1. Sual mətni?\nA) …\nB) …\nC) …\nD) …\nCavab: B">' + esc(S.text) + '</textarea>' +
        '<div class="drop" data-a="pick">📎 PDF / şəkil seçin və ya bura sürüşdürün</div>' +
        '<input type="file" id="dqr-fi" accept="application/pdf,image/*,.txt,text/plain" multiple hidden>' +
        '<div id="dqr-fl" class="st">' + (S.files.length ? S.files.map(function (x) { return "📄 " + esc(x.name); }).join(" · ") : "") + '</div>' +
        '<div class="pg" id="dqr-pg"><i></i></div><div class="st" id="dqr-st"></div>';
      f.innerHTML = '<button type="button" class="bt pri" data-a="read" ' + (S.busy ? "disabled" : "") + '>🔍 Oxu və düz</button><span style="flex:1"></span><button type="button" class="bt" data-a="close">Bağla</button>';
    } else {
      var ok = 0, w = 0; S.list.forEach(function (q) { validate(q); q.issues.length ? w++ : ok++; });
      var tg = S.target === "exam" ?
        '<details open><summary>⚙️ Hara yüklənsin</summary><div class="tg" style="margin-top:8px"><label>Sınaq №<input type="number" id="dqr-ex" style="width:80px" value="' + esc(S.ctx.exam || (S.exam || "1")) + '"></label>' +
        '<label>Başlanğıc sual №<input type="number" id="dqr-n0" style="width:90px" value="' + esc(S.ctx.n0 || "1") + '"></label>' +
        ["BA", "BB", "AC"].map(function (c) { return '<label><input type="checkbox" class="dqr-cat" value="' + c + '" ' + ((S.cats || ["BA"]).indexOf(c) > -1 ? "checked" : "") + '> ' + c + "</label>"; }).join("") + '</div></details>' : "";
      b.innerHTML = '<div class="sum"><span>Cəmi: ' + S.list.length + '</span><span class="g">✅ Hazır: ' + ok + '</span><span class="y">⚠ Yoxlanmalı: ' + w + '</span></div>' + tg +
        '<div class="row"><button type="button" class="bt" data-a="renum">🔢 Ardıcıl nömrələ</button><button type="button" class="bt" data-a="dedup">♻️ Təkrarları sil</button><button type="button" class="bt" data-a="back">← Mətnə qayıt</button></div>' +
        '<div id="dqr-ql">' + S.list.map(qHtml).join("") + '</div><div class="st" id="dqr-st"></div><div class="pg" id="dqr-pg"><i></i></div>';
      f.innerHTML = '<span class="st" style="margin-right:auto">' + (S.target === "krs" ? "Suallar seçilmiş mövzuya əlavə olunacaq; sonra «💾 Saxla» basın." : "Düzgün cavabı olmayan sual yüklənməz.") + '</span><button type="button" class="bt" data-a="close">Bağla</button><button type="button" class="bt grn" data-a="apply" ' + (S.busy || !S.list.length ? "disabled" : "") + '>' + (S.target === "krs" ? "➕ Mövzuya əlavə et" : "💾 Bazaya yüklə") + ' (' + S.list.length + ')</button>';
    }
  }
  function qHtml(q, i) {
    var cls = !q.issues.length ? "" : q.issues.some(function (x) { return /çatışmır|boş|seçilməyib/.test(x); }) ? "e" : "w";
    return '<div class="q ' + cls + '" data-i="' + i + '"><div class="qh"><b>#</b><input type="number" class="n" data-f="num" value="' + esc(q.num == null ? "" : q.num) + '" placeholder="№">' +
      '<span class="sp"></span><button type="button" class="bt" data-a="up" title="Yuxarı">↑</button><button type="button" class="bt" data-a="down" title="Aşağı">↓</button><button type="button" class="bt red" data-a="del" title="Sil">✕</button></div>' +
      '<textarea data-f="stem" rows="3">' + esc(q.stem) + '</textarea>' +
      LET.split("").map(function (l, k) { return '<div class="o ' + (q.correct === k ? "ok" : "") + '"><label>' + l + '</label><input type="text" data-f="o' + k + '" value="' + esc(q.options[k]) + '" placeholder="' + l + ' variantı' + (k === 4 ? " (əgər varsa)" : "") + '"><input type="radio" name="c' + i + '" data-f="c" value="' + k + '" ' + (q.correct === k ? "checked" : "") + ' title="Düzgün cavab"></div>'; }).join("") +
      (q.exp ? '<details><summary>İzah</summary><textarea data-f="exp" rows="2">' + esc(q.exp) + '</textarea></details>' : "") +
      (q.issues.length ? '<div class="iss ' + (cls === "e" ? "e" : "") + '">⚠ ' + esc(q.issues.join(" · ")) + '</div>' : "") + '</div>';
  }

  function onInput(e) {
    var el = e.target, qd = el.closest && el.closest(".q");
    if (!qd) { if (el.id === "dqr-t") S.text = el.value; return; }
    var q = S.list[+qd.dataset.i], f = el.dataset.f; if (!q || !f) return;
    if (f === "stem") q.stem = el.value; else if (f === "exp") q.exp = el.value;
    else if (f === "num") q.num = el.value === "" ? null : +el.value;
    else if (/^o\d$/.test(f)) q.options[+f[1]] = el.value;
  }
  function onChange(e) {
    var el = e.target;
    if (el.id === "dqr-fi") { addFiles(el.files); el.value = ""; return; }
    var qd = el.closest && el.closest(".q");
    if (qd && el.dataset.f === "c") { S.list[+qd.dataset.i].correct = +el.value; rerender(true); }
    else if (qd) { rerender(true); }
  }
  function rerender(keep) { var b = $("dqr-b"), y = b ? b.scrollTop : 0, a = D.activeElement && D.activeElement.id; render(); if (b) b.scrollTop = y; }
  function addFiles(fl) { [].forEach.call(fl || [], function (x) { S.files.push(x); }); var l = $("dqr-fl"); if (l) l.innerHTML = S.files.map(function (x) { return "📄 " + esc(x.name); }).join(" · "); }

  async function doRead() {
    if (S.busy) return;
    var t = ($("dqr-t") ? $("dqr-t").value : S.text) || ""; S.text = t;
    if (!t.trim() && !S.files.length) { alert("Mətn yapışdırın və ya fayl seçin."); return; }
    S.busy = true; render();
    var all = t;
    try {
      for (var i = 0; i < S.files.length; i++) { prog(null, "Oxunur: " + S.files[i].name); all += "\n" + await extract(S.files[i], prog); }
      var res = parse(all);
      if (!res.length) { alert("Sual tapılmadı. Format: «1. Sual», «A) …», «B) …», «Cavab: B». Mətni yoxlayın."); S.busy = false; S.step = "in"; render(); return; }
      var n0 = S.ctx.n0 ? +S.ctx.n0 : null;
      res.forEach(function (q, i) { if (q.num == null) q.num = n0 != null ? n0 + i : i + 1; });
      S.list = res; S.step = "rev";
    } catch (x) { alert("Xəta: " + (x && x.message || x)); S.step = "in"; }
    S.busy = false; render();
  }

  function stripP(s) { return s.replace(/^<p>([\s\S]*)<\/p>$/, function (m, x) { return x.indexOf("<p>") < 0 ? x : m; }); }
  async function applyExam() {
    var ex = $("dqr-ex").value, n0 = parseInt($("dqr-n0").value) || 1, cats = [].map.call(rootEl.querySelectorAll(".dqr-cat:checked"), function (c) { return c.value; });
    if (!ex) return alert("Sınaq № daxil edin.");
    if (!cats.length) return alert("Ən azı 1 kateqoriya seçin (BA, BB və ya AC).");
    var bad = S.list.filter(function (q) { validate(q); return q.correct < 0 || q.options.filter(Boolean).length < 2 || !q.stem; });
    if (bad.length) { alert("Bu suallarda düzgün cavab, mətn və ya ən azı 2 variant yoxdur: " + bad.slice(0, 10).map(function (q) { return "#" + (q.num == null ? "?" : q.num); }).join(", ") + (bad.length > 10 ? " …" : "") + "\n\nDüzəldin və ya sualları silin."); return; }
    if (typeof _supabase === "undefined") return alert("Verilənlər bazası bağlantısı tapılmadı.");
    S.busy = true; render(); var done = 0, fail = 0, total = S.list.length * cats.length, k = 0, lastNum = n0;
    for (var i = 0; i < S.list.length; i++) {
      var q = S.list[i], num = q.num != null ? q.num : n0 + i; lastNum = num;
      var subj = typeof getSubjectByNumber === "function" ? getSubjectByNumber(num) : "", qanun = subj === "Qanunvericilik";
      var opts = q.options.map(function (o) { return { text: stripP(dqClean(o)), image: null }; }), hi = -1; q.options.forEach(function (o, j) { if (o) hi = j; });
      opts = opts.slice(0, Math.max(2, qanun ? Math.min(hi + 1, 4) : hi + 1));
      for (var c = 0; c < cats.length; c++) {
        k++; prog(Math.round(k / total * 100), "Yüklənir: " + k + " / " + total);
        try {
          var ex1 = await _supabase.from("exam_questions").select("id").eq("exam_id", ex).eq("category", cats[c]).eq("q_number", num).maybeSingle();
          var row = { subject: subj, question: dqClean(q.stem), image_url: null, options: opts, correct: q.correct }, er;
          if (ex1 && ex1.data) { er = (await _supabase.from("exam_questions").update(row).eq("id", ex1.data.id)).error; }
          else { er = (await _supabase.from("exam_questions").insert([Object.assign({ exam_id: ex, category: cats[c], q_number: num }, row)])).error; }
          er ? fail++ : done++;
        } catch (x) { fail++; }
      }
    }
    S.busy = false; render();
    alert(done + " yazı uğurla yükləndi" + (fail ? ", " + fail + " xəta baş verdi" : "") + " ✅");
    if (!fail) {
      try { var cn = $("cp-q-num"); if (cn) { cn.value = lastNum + 1; if (root.updateFennVariantLimits) updateFennVariantLimits("cp", lastNum + 1); } var ce = $("cp-exam-id"); if (ce) ce.value = ex; } catch (x) { }
      close();
    }
  }
  function applyKrs() {
    if (!root.KRSX || !root.KRSX.ready()) return alert("Əvvəlcə Karusel panelində mövzunu seçin («✏️ Suallar»).");
    var list = toKrs(S.list);
    if (!list.length) return alert("Əlavə ediləcək tam sual yoxdur.");
    var n = root.KRSX.add(list);
    try { V2.toast(n + " sual mövzuya əlavə olundu — «💾 Saxla» basın ✅"); } catch (e) { }
    close();
  }

  function onClick(e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.dataset.a, qd = b.closest(".q"), i = qd ? +qd.dataset.i : -1;
    if (S.busy && a !== "close") return;
    if (a === "close") return S.busy ? 0 : close();
    if (a === "pick") { var fi = $("dqr-fi"); fi && fi.click(); return; }
    if (a === "read") return doRead();
    if (a === "back") { S.step = "in"; render(); return; }
    if (a === "up" && i > 0) { var x = S.list[i]; S.list[i] = S.list[i - 1]; S.list[i - 1] = x; rerender(); return; }
    if (a === "down" && i < S.list.length - 1) { var y = S.list[i]; S.list[i] = S.list[i + 1]; S.list[i + 1] = y; rerender(); return; }
    if (a === "del") { S.list.splice(i, 1); rerender(); return; }
    if (a === "renum") { var s0 = parseInt(S.list[0] && S.list[0].num) || (S.ctx.n0 ? +S.ctx.n0 : 1); S.list.forEach(function (q, k) { q.num = s0 + k; }); rerender(); return; }
    if (a === "dedup") { var seen = {}; S.list = S.list.filter(function (q) { var sg = q.stem.toLowerCase().replace(/\W+/g, " ").trim(); if (sg && seen[sg]) return false; seen[sg] = 1; return true; }); rerender(); return; }
    if (a === "apply") return S.target === "krs" ? applyKrs() : applyExam();
  }

  /* ====================================================================
     4. İNTEQRASİYA (Copy/Paste paneli və Karusel)
     ==================================================================== */
  function addCpButton() {
    if (!D) return;
    var ta = $("cp-raw-text"); if (!ta || $("dqr-cp-btn")) return;
    var host = ta.closest(".form-group") || ta.parentNode, d = D.createElement("div");
    d.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px";
    d.innerHTML = '<button type="button" id="dqr-cp-btn" class="btn btn-primary" style="flex:1 1 260px">🧠 Ağıllı Oxuyucu — PDF · şəkil · çoxlu sual</button>';
    host.parentNode.insertBefore(d, host.nextSibling);
    $("dqr-cp-btn").onclick = function () { open({ target: "exam", text: ta.value, exam: ($("cp-exam-id") || {}).value, n0: ($("cp-q-num") || {}).value }); };
  }
  var api = { parse: parse, parseForKrs: function (raw) { return toKrs(parse(raw)); }, validate: validate, open: open, close: close };
  root.DQR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (D) {
    var n = 0, iv = setInterval(function () { addCpButton(); if ($("dqr-cp-btn") || ++n > 120) clearInterval(iv); }, 800);
    if (root.MutationObserver) new MutationObserver(function () { if (!$("dqr-cp-btn")) addCpButton(); }).observe(D.body || D.documentElement, { childList: true, subtree: true });
  }
})(typeof window !== "undefined" ? window : globalThis);
