/* =====================================================================
   SUAL STUDİYASI — şəkil / PDF-dən sual çıxar, fonu təmizlə, redaktə et,
   seçib sınağa əlavə et.   (admin paneldə yeni modul: mod-qstudio)
   Asılılıq: app.js (switchAdminTab, _supabase, examStructure, __dqLibs)
   ===================================================================== */
(function () {
  "use strict";
  if (window.QS) return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var KEY_LS = "dq_gemini_key", CFG_LS = "dq_qs_cfg", DRAFT_LS = "dq_qs_draft";
  var LET = ["A", "B", "C", "D", "E"];
  var SB_URL = "https://cpzwliqlgaplroscvduo.supabase.co";
  var SB_KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";

  var S = {
    pages: [], cur: 0, qs: [], uid: 0, busy: false, showOrig: false, eraseOn: false,
    drag: null, cfg: { c: 165, top: 5, bot: 7, auto: 1, stack: 1, model: "gemini-2.5-flash" }
  };
  try { Object.assign(S.cfg, JSON.parse(localStorage.getItem(CFG_LS) || "{}")); } catch (e) {}

  /* ---------- köməkçilər ---------- */
  function sb() {
    try { if (typeof _supabase !== "undefined" && _supabase) return _supabase; } catch (e) {}
    if (!window.__qsSb) window.__qsSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__qsSb;
  }
  function structure() {
    try { if (typeof examStructure !== "undefined" && examStructure && examStructure.length) return examStructure; } catch (e) {}
    return [
      { title: "Azərbaycan dili", start: 1, end: 15 }, { title: "Qanunvericilik", start: 16, end: 55 },
      { title: "İnformatika", start: 56, end: 70 }, { title: "Məntiq", start: 71, end: 100 }
    ];
  }
  function mk(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function msg(t, kind) {
    var el = $("qs-msg"); if (!el) return;
    el.className = "qs-msg" + (kind ? " " + kind : "");
    el.textContent = t || "";
    if (t && kind !== "err") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function saveCfg() { try { localStorage.setItem(CFG_LS, JSON.stringify(S.cfg)); } catch (e) {} }

  /* ---------- CSS ---------- */
  function injectCss() {
    if ($("qs-css")) return;
    var st = document.createElement("style"); st.id = "qs-css";
    st.textContent = [
      "#mod-qstudio{padding:14px}",
      "#mod-qstudio h4{text-align:left;margin:0 0 4px}",
      ".qs-help{font-size:13px;color:#64748b;line-height:1.5;margin:4px 0 12px}",
      ".qs-box{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:12px;background:#fff}",
      ".qs-box>b{display:block;margin-bottom:8px;font-size:14px;color:#0f172a}",
      ".qs-drop{border:2px dashed #6366f1;background:#f5f3ff;border-radius:14px;padding:22px 10px;text-align:center;cursor:pointer;font-weight:700}",
      ".qs-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}",
      ".qs-row label{font-size:12.5px;font-weight:700;color:#334155;display:flex;align-items:center;gap:6px}",
      ".qs-row input[type=range]{flex:1;min-width:140px}",
      ".qs-in{padding:9px 10px;border:1.5px solid #cbd5e1;border-radius:9px;font:inherit;font-size:14px;min-width:0;background:#fff}",
      ".qs-in:focus{outline:none;border-color:#6366f1}",
      ".qs-b{border:0;border-radius:9px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;background:#1e1b4b;color:#fff;font-family:inherit}",
      ".qs-b.g{background:#10b981}.qs-b.r{background:#ef4444}.qs-b.o{background:#fff;color:#1e1b4b;border:1.5px solid #cbd5e1}.qs-b.s{padding:6px 10px;font-size:12px}",
      ".qs-b.on{background:#d97706}.qs-b:disabled{opacity:.5;cursor:not-allowed}",
      ".qs-cvwrap{border:2px dashed #94a3b8;border-radius:10px;background:#f8fafc;overflow:hidden;max-height:70vh;overflow-y:auto;position:relative}",
      ".qs-cvwrap canvas{display:block;width:100%;height:auto;background:#fff}",
      ".qs-msg{min-height:20px;font-size:13px;font-weight:700;color:#475569;margin:8px 0;white-space:pre-line}",
      ".qs-msg.ok{color:#15803d}.qs-msg.err{color:#b91c1c}",
      ".qs-prog{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0;display:none}",
      ".qs-prog i{display:block;height:100%;width:0;background:#6366f1;transition:width .3s}",
      ".qs-list{display:flex;flex-direction:column;gap:10px}",
      ".qs-card{display:flex;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden}",
      ".qs-card.sel{border-color:#10b981;box-shadow:0 0 0 2px #10b98133}",
      ".qs-sel{flex:0 0 52px;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;padding-top:12px;cursor:pointer;border-right:1px solid #e2e8f0;font-size:11px;font-weight:800;color:#475569}",
      ".qs-card.sel .qs-sel{background:#d1fae5}",
      ".qs-sel input{width:26px;height:26px;accent-color:#10b981}",
      ".qs-body{flex:1;min-width:0;padding:10px}",
      ".qs-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}",
      ".qs-num{width:74px}",
      ".qs-tag{font-size:11px;font-weight:700;background:#e0e7ff;color:#3730a3;border-radius:99px;padding:2px 9px}",
      ".qs-tag.w{background:#fef3c7;color:#92400e}",
      ".qs-t{width:100%;min-height:90px;resize:vertical;line-height:1.5}",
      ".qs-o{display:flex;gap:6px;align-items:center;margin-top:6px}",
      ".qs-o .qs-in{flex:1}",
      ".qs-r{flex:none;width:34px;height:34px;border-radius:50%;border:2px solid #6366f1;background:#fff;color:#4338ca;font-weight:800;cursor:pointer}",
      ".qs-r.on{background:#10b981;border-color:#10b981;color:#fff}",
      ".qs-bt{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}",
      ".qs-img{margin-top:6px;position:relative;display:inline-block}",
      ".qs-img img{max-width:100%;max-height:160px;border:1px solid #e2e8f0;border-radius:8px;display:block}",
      ".qs-bar{position:sticky;bottom:0;z-index:20;background:#fff;border:2px solid #6366f1;border-radius:12px;padding:10px;margin-top:12px;box-shadow:0 -6px 18px #0f172a22}",
      ".qs-cats{display:flex;gap:6px;flex-wrap:wrap}",
      ".qs-cats label{display:flex;gap:5px;align-items:center;border:1.5px solid #cbd5e1;border-radius:99px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer}",
      ".qs-cats input:checked+span{color:#059669}",
      ".qs-modal{position:fixed;inset:0;z-index:100010;background:#0f172acc;display:flex;flex-direction:column}",
      ".qs-modal header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;color:#fff;font-weight:700}",
      ".qs-modal .bd{flex:1;overflow:auto;padding:0 8px 16px;text-align:center}",
      ".qs-modal img{max-width:100%;background:#fff}",
      "@media(max-width:600px){.qs-sel{flex-basis:44px}.qs-body{padding:8px}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------- modul HTML ---------- */
  function build() {
    if ($("mod-qstudio")) return;
    injectCss();
    var host = $("admin-panel");
    if (!host) return;
    var d = document.createElement("div");
    d.id = "mod-qstudio"; d.className = "admin-module-block";
    d.innerHTML =
      '<h4>🧼 Sual Bankı Studiyası (Şəkil / PDF → Təmiz sual → Sınağa əlavə)</h4>' +
      '<p class="qs-help">Test səhifəsinin şəklini və ya PDF-ni yükləyin. Sistem arxa fondakı ad, loqo, su nişanı və başlıqları təmizləyir, ' +
      'iki sütunu alt-alta düzür, sonra sualları çıxarıb <b>redaktə edilə bilən</b> siyahı kimi göstərir. Sol tərəfdəki qutu ilə seçin, ' +
      'aşağıdan sınaq/kateqoriya/fənn seçib bir kliklə əlavə edin.</p>' +

      '<div class="qs-box"><b>1) Fayl yüklə</b>' +
      '<div class="qs-drop" id="qs-drop">📤 Şəkil(lər) və ya PDF seçin<br><small style="font-weight:500;color:#64748b">Telefon ekran görüntüləri də olar (səhifə avtomatik tapılıb kəsilir)</small></div>' +
      '<input type="file" id="qs-file" accept="image/*,application/pdf" multiple style="display:none">' +
      '<div class="qs-row" id="qs-pgcount"></div></div>' +

      '<div class="qs-box" id="qs-clean" style="display:none"><b>2) Fonu təmizlə</b>' +
      '<div class="qs-row"><label style="flex:1;min-width:230px">Fon silmə gücü: <span id="qs-cv">165</span>' +
      '<input type="range" id="qs-c" min="110" max="235" step="1"></label></div>' +
      '<div class="qs-help" style="margin:0">Yazı solğun görünürsə azaldın; fon qalırsa artırın.</div>' +
      '<div class="qs-row"><label>Üst kəsik %<input class="qs-in" style="width:64px" type="number" id="qs-top" min="0" max="20"></label>' +
      '<label>Alt kəsik %<input class="qs-in" style="width:64px" type="number" id="qs-bot" min="0" max="20"></label></div>' +
      '<div class="qs-row"><label><input type="checkbox" id="qs-auto"> Səhifəni avto tap və kəs</label>' +
      '<label><input type="checkbox" id="qs-stack"> 2 sütunu alt-alta düz</label></div>' +
      '<div class="qs-row"><button class="qs-b o s" id="qs-prev">◀</button><b id="qs-pg" style="min-width:64px;text-align:center">1/1</b>' +
      '<button class="qs-b o s" id="qs-next">▶</button>' +
      '<button class="qs-b o s" id="qs-orig">👁 Orijinal</button>' +
      '<button class="qs-b o s" id="qs-eraser">🧽 Sil rejimi</button>' +
      '<button class="qs-b o s" id="qs-undo">↩ Geri</button></div>' +
      '<div class="qs-cvwrap"><canvas id="qs-canvas"></canvas></div>' +
      '<div class="qs-help" style="margin-top:6px">🧽 Sil rejimini açıb barmaqla/siçanla düzbucaq çəkin — qalıq loqo/yazı ağ ilə örtülür.</div></div>' +

      '<div class="qs-box" id="qs-ext" style="display:none"><b>3) Sualları çıxar (Gemini və ya Gemini-siz OCR)</b>' +
      '<div class="qs-row"><input class="qs-in" id="qs-key" type="password" placeholder="Gemini API açarı (boşdursa OCR işləyir)" style="flex:1;min-width:200px">' +
      '<select class="qs-in" id="qs-model"><option value="gemini-2.5-flash">2.5 Flash (sürətli)</option><option value="gemini-2.5-flash-lite">2.5 Flash-Lite (limit yüngül)</option><option value="gemini-2.0-flash">2.0 Flash</option>' +
      '<option value="gemini-2.5-pro">2.5 Pro (daha dəqiq)</option></select></div>' +
      '<div class="qs-row"><button class="qs-b g" id="qs-go">🤖 Bütün səhifələrdən sualları çıxar</button>' +
      '<button class="qs-b" id="qs-ocr">📝 Gemini-siz çıxar (OCR)</button></div>' +
      '<div class="qs-help" style="margin:0">OCR rejimi API açarı tələb etmir, brauzerdə işləyir (ilk dəfə dil faylı yüklənir). Sütunlar avtomatik ayrılır, sual və A–E variantlar ayrı xanalara düşür, fiqur/sxem/cədvəl şəkilləri avtomatik kəsilib suala əlavə olunur. Düzgün cavab seçilmir.</div>' +
      '<div class="qs-row">' +
      '<button class="qs-b o" id="qs-blank">➕ Boş sual</button><button class="qs-b o" id="qs-restore" style="display:none">♻️ Qaralamanı bərpa et</button></div>' +
      '<div class="qs-prog" id="qs-prog"><i></i></div></div>' +

      '<div class="qs-msg" id="qs-msg"></div>' +

      '<div id="qs-qwrap" style="display:none">' +
      '<div class="qs-box"><b>4) Suallar — <span id="qs-cnt">0</span> sual, <span id="qs-selcnt">0</span> seçilib</b>' +
      '<div class="qs-row"><button class="qs-b o s" id="qs-all">☑ Hamısını seç</button><button class="qs-b o s" id="qs-none">☐ Seçimi sil</button>' +
      '<label>№ <input class="qs-in" style="width:62px" type="number" id="qs-r1" min="1" placeholder="1"> – <input class="qs-in" style="width:62px" type="number" id="qs-r2" min="1" placeholder="40"></label>' +
      '<button class="qs-b o s" id="qs-range">Aralığı seç</button></div></div>' +
      '<div class="qs-list" id="qs-list"></div>' +

      '<div class="qs-bar"><b style="font-size:14px">5) Sınağa əlavə et</b>' +
      '<div class="qs-row"><label>Sınaq №<input class="qs-in" style="width:90px" id="qs-exam" list="qs-exams" placeholder="2"></label>' +
      '<datalist id="qs-exams"></datalist>' +
      '<label>Fənn<select class="qs-in" id="qs-subj"></select></label></div>' +
      '<div class="qs-row"><div class="qs-cats" id="qs-cats">' +
      ["BA", "BB", "AC", "AB"].map(function (c) { return '<label><input type="checkbox" class="qs-cat" value="' + c + '"><span>' + c + '</span></label>'; }).join("") +
      '</div></div>' +
      '<div class="qs-row"><label>Rejim<select class="qs-in" id="qs-mode"><option value="gaps">Boş nömrələrə yerləşdir</option>' +
      '<option value="over">Başlanğıc nömrədən üzərinə yaz</option></select></label>' +
      '<label>Başlanğıc №<input class="qs-in" style="width:80px" type="number" id="qs-start" placeholder="avto"></label></div>' +
      '<div class="qs-row"><label><input type="checkbox" id="qs-rm" checked> Əlavə olunanları siyahıdan çıxar</label></div>' +
      '<div class="qs-help" id="qs-free" style="margin:2px 0 6px"></div>' +
      '<div class="qs-row"><button class="qs-b o" id="qs-chk">🔎 Boş yerləri yoxla</button>' +
      '<button class="qs-b g" id="qs-add" style="flex:1">➕ Seçilənləri sınağa əlavə et</button></div></div>' +
      '</div>';
    var before = $("mod-pdfauto");
    if (before && before.parentNode) before.parentNode.insertBefore(d, before); else host.appendChild(d);
    wire();
  }

  /* ---------- fayl yükləmə ---------- */
  function fileToCanvas(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 3200 / Math.max(im.width, im.height));
        var c = mk(im.width * s, im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c);
      };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error("Şəkil açılmadı: " + file.name)); };
      im.src = url;
    });
  }
  async function pdfToCanvases(file) {
    if (!window.__dqLibs) throw new Error("PDF kitabxanası tapılmadı (__dqLibs).");
    await window.__dqLibs("pdf");
    var pdf = await pdfjsLib.getDocument(new Uint8Array(await file.arrayBuffer())).promise, out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), base = pg.getViewport({ scale: 1 });
      var sc = Math.min(3, 1800 / base.width), vp = pg.getViewport({ scale: sc }), c = mk(vp.width, vp.height);
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push(c);
      msg("PDF oxunur: " + i + "/" + pdf.numPages);
    }
    return out;
  }
  async function onFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    msg("Fayllar oxunur…");
    try {
      for (var f of files) {
        if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) {
          var cs = await pdfToCanvases(f);
          cs.forEach(function (c, i) { S.pages.push({ name: f.name + " s." + (i + 1), src: c, rects: [], geo: "" }); });
        } else {
          S.pages.push({ name: f.name, src: await fileToCanvas(f), rects: [], geo: "" });
        }
      }
      S.cur = Math.max(0, S.pages.length - files.length >= 0 ? 0 : 0);
      $("qs-pgcount").innerHTML = '<span class="qs-tag">' + S.pages.length + ' səhifə yükləndi</span> <button class="qs-b r s" id="qs-reset">Hamısını sil</button>';
      $("qs-reset").onclick = function () { S.pages = []; S.cur = 0; $("qs-pgcount").innerHTML = ""; $("qs-clean").style.display = "none"; $("qs-ext").style.display = $("qs-qwrap").style.display === "none" ? "none" : "block"; };
      $("qs-clean").style.display = "block"; $("qs-ext").style.display = "block"; $("qs-qwrap").style.display = "block";
      msg("");
      showPage();
    } catch (e) { msg("❌ " + e.message, "err"); }
  }

  /* ---------- təmizləmə boru xətti ---------- */
  function runsOf(ok, gap) {         // true-lar arasında "gap"-dək boşluğu körpüləyib ən uzun zolağı qaytarır
    var best = null, s = -1, last = -1;
    function fin() { if (s >= 0 && (!best || last + 1 - s > best.b - best.a)) best = { a: s, b: last + 1 }; }
    for (var i = 0; i < ok.length; i++) {
      if (!ok[i]) continue;
      if (s < 0) s = i; else if (i - last > gap + 1) { fin(); s = i; }
      last = i;
    }
    fin(); return best;
  }
  function morph(m, ws, hs, r, grow) {   // grow=1: genişlət (dilate), grow=0: daralt (erode; kənardan kənar = dolu)
    var o = new Uint8Array(ws * hs), x, y, dx, dy, hit;
    for (y = 0; y < hs; y++) for (x = 0; x < ws; x++) {
      hit = grow ? 0 : 1;
      for (dy = -r; dy <= r && (grow ? !hit : hit); dy++) for (dx = -r; dx <= r; dx++) {
        var yy = y + dy, xx = x + dx, v = (yy < 0 || yy >= hs || xx < 0 || xx >= ws) ? (grow ? 0 : 1) : m[yy * ws + xx];
        if (grow ? v : !v) { hit = grow ? 1 : 0; break; }
      }
      o[y * ws + x] = hit;
    }
    return o;
  }
  function pageRect(src) {          // ekran görüntüsündə ən böyük ağ «kağız» sahəsini tapır (qara/tünd interfeys və menyular atılır)
    var w = src.width, h = src.height, s = Math.max(2, Math.round(Math.max(w, h) / 550)),
      ws = Math.floor(w / s), hs = Math.floor(h / s), full = { x: 0, y: 0, w: w, h: h };
    if (ws < 12 || hs < 12) return full;
    var d = src.getContext("2d").getImageData(0, 0, w, h).data, m = new Uint8Array(ws * hs), x, y, yy, xx;
    for (y = 0; y < hs; y++) for (x = 0; x < ws; x++) {
      var mn = 255;
      for (yy = 0; yy < s && mn > 200; yy++) for (xx = 0; xx < s; xx++) {
        var k = ((y * s + yy) * w + (x * s + xx)) * 4, v = d[k] < d[k + 1] ? d[k] : d[k + 1];
        if (d[k + 2] < v) v = d[k + 2]; if (v < mn) mn = v;
      }
      m[y * ws + x] = mn > 200 ? 1 : 0;
    }
    m = morph(morph(m, ws, hs, 3, 1), ws, hs, 3, 0);        // mətn sətirləri arasındakı boşluqları doldur
    var lab = new Uint8Array(ws * hs), stack = new Int32Array(ws * hs), best = null;
    for (var st0 = 0; st0 < ws * hs; st0++) {
      if (!m[st0] || lab[st0]) continue;
      var sp = 0, n = 0, bx0 = ws, bx1 = 0, by0 = hs, by1 = 0;
      stack[sp++] = st0; lab[st0] = 1;
      while (sp) {
        var cur = stack[--sp], cx = cur % ws, cy = (cur - cx) / ws; n++;
        if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
        if (cx > 0 && m[cur - 1] && !lab[cur - 1]) { lab[cur - 1] = 1; stack[sp++] = cur - 1; }
        if (cx < ws - 1 && m[cur + 1] && !lab[cur + 1]) { lab[cur + 1] = 1; stack[sp++] = cur + 1; }
        if (cy > 0 && m[cur - ws] && !lab[cur - ws]) { lab[cur - ws] = 1; stack[sp++] = cur - ws; }
        if (cy < hs - 1 && m[cur + ws] && !lab[cur + ws]) { lab[cur + ws] = 1; stack[sp++] = cur + ws; }
      }
      if (!best || n > best.n) best = { n: n, x0: bx0, x1: bx1, y0: by0, y1: by1 };
    }
    if (!best) return full;
    var rx = best.x0 * s, ry = best.y0 * s, rw = Math.min(w - rx, (best.x1 - best.x0 + 1) * s), rh = Math.min(h - ry, (best.y1 - best.y0 + 1) * s);
    if (rw * rh < 0.2 * w * h) return full;
    if (rw > 0.97 * w && rh > 0.97 * h) return full;
    var mg = Math.round(rw * 0.012);
    return { x: rx + mg, y: ry, w: rw - 2 * mg, h: rh };
  }
  function headerLine(cv) {          // başlığın altındakı tünd qırmızı xətti axtarır
    var w = cv.width, lim = Math.floor(cv.height * 0.14), d = cv.getContext("2d").getImageData(0, 0, w, lim).data, best = -1;
    for (var y = 0; y < lim; y++) {
      var n = 0;
      for (var x = 0; x < w; x += 2) { var i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 90 && r < 215 && r - g > 45 && r - b > 45) n++; }
      if (n > 0.4 * (w / 2)) best = y;
    }
    return best;
  }
  function geometry(p) {             // kəsmə nəticəsi (orijinal rəngdə)
    var key = [S.cfg.auto, S.cfg.top, S.cfg.bot].join("|");
    if (p.geo === key && p.crop) return p.crop;
    var rc = S.cfg.auto ? pageRect(p.src) : { x: 0, y: 0, w: p.src.width, h: p.src.height };
    var a = mk(rc.w, rc.h); a.getContext("2d").drawImage(p.src, rc.x, rc.y, rc.w, rc.h, 0, 0, rc.w, rc.h);
    var ln = headerLine(a), top = ln >= 0 ? ln + 4 : Math.round(a.height * S.cfg.top / 100),
      bot = Math.round(a.height * S.cfg.bot / 100), hh = Math.max(20, a.height - top - bot);
    var c = mk(a.width, hh); c.getContext("2d").drawImage(a, 0, top, a.width, hh, 0, 0, a.width, hh);
    if (p.geo !== key) p.rects = [];
    p.geo = key; p.crop = c; p.stackKey = null;
    return c;
  }
  function cleanCanvas(src, c) {      // maks. kanal ilə: boz/çəhrayı/qırmızı su nişanı → ağ, qara mətn qalır
    var w = src.width, h = src.height, ctx = src.getContext("2d"), im = ctx.getImageData(0, 0, w, h), d = im.data,
      lo = c - 60, hi = c, k = 255 / (hi - lo);
    for (var i = 0; i < d.length; i += 4) {
      var v = d[i] > d[i + 1] ? d[i] : d[i + 1]; if (d[i + 2] > v) v = d[i + 2];
      var o = v >= hi ? 255 : v <= lo ? 0 : (v - lo) * k;
      d[i] = d[i + 1] = d[i + 2] = o; d[i + 3] = 255;
    }
    var out = mk(w, h); out.getContext("2d").putImageData(im, 0, 0); return out;
  }
  function contentRows(cv, x0, x1) {
    var w = cv.width, h = cv.height, d = cv.getContext("2d").getImageData(0, 0, w, h).data, a = -1, b = -1;
    for (var y = 0; y < h; y++) {
      var n = 0; for (var x = x0; x < x1; x++) if (d[(y * w + x) * 4] < 140) { if (++n >= 2) break; }
      if (n >= 2) { if (a < 0) a = y; b = y; }
    }
    return a < 0 ? null : [Math.max(0, a - 10), Math.min(h, b + 12)];
  }
  function stackCols(cv) {            // sol sütun yuxarı, sağ sütun aşağı
    var w = cv.width, h = cv.height, d = cv.getContext("2d").getImageData(0, 0, w, h).data, cnt = new Uint32Array(w),
      xa = Math.floor(w * 0.38), xb = Math.ceil(w * 0.62), x, y;
    for (y = 0; y < h; y++) for (x = xa; x < xb; x++) if (d[(y * w + x) * 4] < 140) cnt[x]++;
    var tol = Math.max(2, h * 0.004), best = null, cur = null;
    for (x = xa; x < xb; x++) {
      if (cnt[x] <= tol) { if (!cur) cur = { a: x, b: x }; cur.b = x; }
      else { if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur; cur = null; }
    }
    if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
    if (!best || best.b - best.a < 6) return cv;      // iki sütun tapılmadı
    var cx = Math.round((best.a + best.b) / 2), lw = cx, rw = w - cx;
    var rl = contentRows(cv, 0, lw), rr = contentRows(cv, cx, w);
    if (!rl || !rr) return cv;
    var lh = rl[1] - rl[0], rh = rr[1] - rr[0], out = mk(Math.max(lw, rw), lh + rh + 12), ctx = out.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, 0, rl[0], lw, lh, 0, 0, lw, lh);
    ctx.drawImage(cv, cx, rr[0], rw, rh, 0, lh + 12, rw, rh);
    return out;
  }
  function tight(cv) {              // yalnız sual/variant mətni qalır, ətrafı dümağ ağ olur
    var w = cv.width, h = cv.height, d = cv.getContext("2d").getImageData(0, 0, w, h).data, rows = new Uint32Array(h), cols = new Uint32Array(w), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (d[(y * w + x) * 4] < 140) { rows[y]++; cols[x]++; }
    var y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h && rows[y0] < 3) y0++; while (y1 > y0 && rows[y1] < 3) y1--;
    while (x0 < w && cols[x0] < 3) x0++; while (x1 > x0 && cols[x1] < 3) x1--;
    if (y1 - y0 < 20 || x1 - x0 < 20) return cv;
    var bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = Math.max(16, Math.round(bw * 0.03)), out = mk(bw + 2 * pad, bh + 2 * pad), ctx = out.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, x0, y0, bw, bh, pad, pad, bw, bh);
    return out;
  }
  function process(p) {
    var g = geometry(p), cl = tight(cleanCanvas(g, S.cfg.c));
    var out = S.cfg.stack ? stackCols(cl) : cl;
    var ctx = out.getContext("2d"); ctx.fillStyle = "#fff";
    (p.rects || []).forEach(function (r) { ctx.fillRect(r.x * out.width, r.y * out.height, r.w * out.width, r.h * out.height); });
    p.out = out; p.url = null;
    return out;
  }

  /* ---------- önbaxış ---------- */
  function showPage() {
    var p = S.pages[S.cur]; if (!p) return;
    var cv = $("qs-canvas"), img = S.showOrig ? geometry(p) : process(p);
    cv.width = img.width; cv.height = img.height;
    cv.getContext("2d").drawImage(img, 0, 0);
    $("qs-pg").textContent = (S.cur + 1) + "/" + S.pages.length;
    $("qs-orig").textContent = S.showOrig ? "👁 Təmiz" : "👁 Orijinal";
    $("qs-eraser").classList.toggle("on", S.eraseOn);
    cv.style.touchAction = S.eraseOn && !S.showOrig ? "none" : "auto";
    cv.style.cursor = S.eraseOn ? "crosshair" : "default";
  }
  function pt(e, cv) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
  }
  function wireCanvas() {
    var cv = $("qs-canvas");
    cv.addEventListener("pointerdown", function (e) {
      if (!S.eraseOn || S.showOrig) return;
      S.drag = { a: pt(e, cv), b: pt(e, cv) };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    });
    cv.addEventListener("pointermove", function (e) {
      if (!S.drag) return;
      S.drag.b = pt(e, cv);
      var p = S.pages[S.cur], ctx = cv.getContext("2d");
      ctx.drawImage(p.out, 0, 0);
      ctx.fillStyle = "rgba(239,68,68,.25)"; ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
      var x = Math.min(S.drag.a.x, S.drag.b.x), y = Math.min(S.drag.a.y, S.drag.b.y),
        w = Math.abs(S.drag.a.x - S.drag.b.x), h = Math.abs(S.drag.a.y - S.drag.b.y);
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    });
    function end() {
      if (!S.drag) return;
      var p = S.pages[S.cur], d = S.drag; S.drag = null;
      var x = Math.min(d.a.x, d.b.x), y = Math.min(d.a.y, d.b.y), w = Math.abs(d.a.x - d.b.x), h = Math.abs(d.a.y - d.b.y);
      if (w > 4 && h > 4) p.rects.push({ x: x / cv.width, y: y / cv.height, w: w / cv.width, h: h / cv.height });
      showPage();
    }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  }

  /* ---------- Gemini ---------- */
  var PROMPT =
    'Sən imtahan sualları çıxaran dəqiq köməkçisən. Verilən şəkillər eyni sənədin ardıcıl hissələridir (hər şəkil tək sütunlu uzun lentdir; mətn oxunuş sırasındadır). ' +
    'Şəkillərdəki BÜTÜN test suallarını sıra ilə çıxar. YALNIZ JSON qaytar (markdown yoxdur), format: ' +
    '{"questions":[{"number":int|null,"question":"...","options":{"A":"","B":"","C":"","D":"","E":""},"correct":"A|B|C|D|E|null","page":int,"has_figure":bool,"figure_box":[ymin,xmin,ymax,xmax]|null,"incomplete":bool}]}. ' +
    'Qaydalar: (1) Mətni orijinaldakı dildə, Azərbaycan hərfləri (ə ö ü ı ç ş ğ) ilə dəyişdirmədən yaz. ' +
    '(2) Sualın nömrəsini ("1.", "2." …) yalnız number sahəsinə yaz, question mətninə daxil etmə. ' +
    '(3) Sualın daxilindəki nömrələnmiş mülahizələri (1. 2. 3. …) question mətninə hər biri yeni sətirdə daxil et. ' +
    '(4) A), B), C), D), E) variantlarını options-a yaz; variantın əvvəlindəki hərfi və mötərizəni at. ' +
    '(5) Sual və ya variant sütun/səhifə arasında kəsilibsə birləşdir. ' +
    '(6) Düzgün cavab göstərilməyibsə correct=null, TƏXMİN ETMƏ. ' +
    '(7) Başlıq, altlıq, su nişanı, loqo və ad yazılarını (məs. "DÖVLƏT QULLUĞU", "Ümumi sınaq imtahanı", şəxs adları) suala QATMA. ' +
    '(8) page = sualın başladığı şəklin nömrəsi (1-dən). ' +
    '(9) Sualda şəkil/cədvəl/sxem varsa has_figure=true və figure_box-u həmin şəklin daxilində 0–1000 normallaşdırılmış koordinatla ver. ' +
    '(10) Sonuncu şəkildə sual yarımçıq kəsilibsə incomplete=true. Sual yoxdursa {"questions":[]}. ' +
    '(11) Brauzer/tətbiq interfeysini (ünvan sətri, "Sayfa 1 / 9", %100, Önceki, Sonraki, Bitir, düymələr, saat, versiya, səhifə nömrələri) TAMAMİLƏ at; ilk nömrələnmiş sualdan əvvəl heç nə yazma. ' +
    '(12) Hər sualı öz variantları ilə birlikdə tam çıxar; variant başqa sütunda/səhifədə olsa belə öz sualına aid et. Nömrələri buraxma və təkrarlama. ' +
    '(13) OCR/yazı səhvlərini, artıq boşluqları və durğu işarələrini düzəlt (məs. "Dogru"→"Doğru"), amma mənanı, ədədləri və xüsusi adları dəyişmə.';

  function toJpeg(cv) {
    var s = Math.min(2, Math.max(1, 900 / cv.width)); if (cv.height * s > 7000) s = Math.max(1, 7000 / cv.height);
    var c = cv; if (s > 1.01) { c = mk(cv.width * s, cv.height * s); var x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cv, 0, 0, c.width, c.height); }
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }
  async function callGemini(key, model, images) {
    var parts = [{ text: PROMPT }];
    images.forEach(function (b64, i) { parts.push({ text: "Şəkil " + (i + 1) + ":" }); parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } }); });
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
    var body = { contents: [{ parts: parts }], generationConfig: { temperature: 0.1, responseMimeType: "application/json", maxOutputTokens: 16000 } };
    var lastErr = "";
    for (var t = 0; t < 4; t++) {
      var r;
      try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch (e) { lastErr = "şəbəkə xətası (" + e.message + ")"; await sleep(3000 * (t + 1)); continue; }
      var j = null; try { j = await r.json(); } catch (e) {}
      var em = (j && j.error && j.error.message) || "";
      if (r.status === 429 || r.status >= 500) {
        lastErr = "HTTP " + r.status + (em ? ": " + em.slice(0, 180) : "");
        if (/per ?day|PerDay/i.test(em + JSON.stringify((j && j.error && j.error.details) || ""))) break;   // gündəlik limit — gözləməyin mənası yoxdur
        var wait = 5000 * (t + 1), rd = /retry in ([\d.]+)s/i.exec(em);
        if (rd) wait = Math.min(60000, Math.ceil(parseFloat(rd[1]) * 1000) + 500);
        msg("Gemini məşğuldur (" + r.status + "), " + Math.round(wait / 1000) + " san gözlənilir… (" + (t + 1) + "/4)");
        await sleep(wait); continue;
      }
      if (!r.ok) throw new Error(em || "HTTP " + r.status);
      var pp = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      var txt = pp.map(function (x) { return x.text || ""; }).join("").replace(/```json|```/g, "").trim();
      try { return JSON.parse(txt).questions || []; } catch (e) { lastErr = "cavab JSON deyil"; if (t >= 2) return []; }
    }
    var err = new Error("Gemini cavab vermədi — " + lastErr); err.retryable = true; throw err;
  }
  async function callWithFallback(key, images) {
    var order = [S.cfg.model, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(function (m, i, a) { return a.indexOf(m) === i; });
    var last;
    for (var i = 0; i < order.length; i++) {
      try { var res = await callGemini(key, order[i], images); if (i > 0) S.cfg.model = order[i]; return res; }
      catch (e) {
        last = e;
        if (e.retryable || /not found|404|not supported/i.test(e.message)) { msg("⚠️ " + order[i] + " alınmadı, növbəti model yoxlanılır…"); continue; }
        throw e;
      }
    }
    throw last;
  }
  function cropNorm(cv, box) {
    if (!box || box.length !== 4) return null;
    var y1 = Math.max(0, box[0]) / 1000 * cv.height, x1 = Math.max(0, box[1]) / 1000 * cv.width,
      y2 = Math.min(1000, box[2]) / 1000 * cv.height, x2 = Math.min(1000, box[3]) / 1000 * cv.width, w = x2 - x1, h = y2 - y1;
    if (w < 20 || h < 20) return null;
    var c = mk(w, h); c.getContext("2d").drawImage(cv, x1, y1, w, h, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.85);
  }
  function setProg(p) { var b = $("qs-prog"); b.style.display = "block"; b.firstChild.style.width = p + "%"; }
  function score(q) { return q.opts.filter(Boolean).length * 1000 + q.text.length - (q.incomplete ? 500 : 0); }

  async function extract() {
    if (S.busy) return;
    if (!S.pages.length) return msg("Əvvəlcə fayl yükləyin.", "err");
    var key = $("qs-key").value.trim();
    if (!key) { msg("Gemini açarı yoxdur — OCR (Gemini-siz) rejimi işə düşür…"); return extractOcr(); }
    try { localStorage.setItem(KEY_LS, key); } catch (e) {}
    S.cfg.model = $("qs-model").value; saveCfg();
    S.busy = true; $("qs-go").disabled = true;
    var found = [], fb = false;
    try {
      var n = S.pages.length, CH = 3, STEP = 2, start = 0, done = 0;
      while (start < n) {
        var idx = []; for (var i = start; i < Math.min(n, start + CH); i++) idx.push(i);
        msg("Gemini oxuyur: səhifə " + (idx[0] + 1) + "–" + (idx[idx.length - 1] + 1) + " / " + n);
        setProg(Math.round(done / n * 100));
        var imgs = idx.map(function (k) { return toJpeg(process(S.pages[k])); });
        var items = await callWithFallback(key, imgs);
        items.forEach(function (it, order) {
          var pi = idx[Math.min(idx.length, Math.max(1, parseInt(it.page) || 1)) - 1];
          var o = it.options || {}, opts = LET.map(function (l) { return String(o[l] == null ? "" : o[l]).trim(); });
          while (opts.length > 4 && !opts[opts.length - 1]) opts.pop();
          while (opts.length < 4) opts.push("");
          var ci = LET.indexOf(String(it.correct || "").toUpperCase());
          var q = { id: ++S.uid, sel: false, num: it.number == null ? "" : it.number, text: String(it.question || "").trim(), opts: opts, correct: ci >= 0 ? ci : null, image: null, page: pi, incomplete: !!it.incomplete };
          if (it.has_figure && it.figure_box) q.image = cropNorm(S.pages[pi].out, it.figure_box);
          found.push({ q: q, ord: pi * 1000 + order });
        });
        done = Math.min(n, start + CH); start += STEP;
        if (start + 1 >= n && done >= n) break;
        await sleep(2500);
      }
      setProg(100);
      found.sort(function (a, b) { return a.ord - b.ord; });
      var map = {}, list = [];
      found.forEach(function (f) {      // üst-üstə düşən səhifələrdə təkrar sualları birləşdir
        var q = f.q, k = q.num !== "" ? "n" + q.num : "t" + q.text.slice(0, 60).toLowerCase();
        if (map[k] != null) { if (score(q) > score(list[map[k]])) list[map[k]] = q; }
        else { map[k] = list.length; list.push(q); }
      });
      S.qs = S.qs.concat(list);
      renderList(); persist();
      msg("✅ " + list.length + " sual çıxarıldı. Yoxlayın, düzəldin, sol qutu ilə seçib sınağa əlavə edin.", "ok");
    } catch (e) { msg("❌ " + e.message + "\nGemini işləmədi — OCR rejiminə keçilir…", "err"); fb = true; }
    S.busy = false; $("qs-go").disabled = false;
    if (fb) return extractOcr();
    setTimeout(function () { $("qs-prog").style.display = "none"; }, 1500);
  }

  /* ---------- Gemini-siz: OCR (Tesseract) + şəkil aşkarlama + qayda əsaslı parser ---------- */
  var OPT_RE = /^\(?\s*([A-Ea-e])\s*(?:[)\]}]|\.(?=\s))\s*(.*)$/;
  var NUM_RE = /^(\d{1,3})\s*[.,)]\s*(.*)$/;
  var NOISE_RE = /^(d[öo]vl[əe]t qullu[ğg]u|[üu]mumi s[ıi]naq|www\.|https?:)/i;
  var NOISE2_RE = /(sayfa\s*\d+\s*\/\s*\d+|sonraki|[öo]nceki|s[ıi]naq\s*\d+\s*kopya)/i;
  var SYM_RE = /^[AΔ△▲Vv•●■□▽\/\\^\-_~.,'"|\s]{1,16}$/;

  /* "42351 B) 51423 C) 24351" kimi eyni sətirdəki variantları ayırır */
  function inlineSplit(s, exp) {
    var re = /(?:^|\s)([A-E])\s*[)\]}]/g, m, hits = [];
    while ((m = re.exec(s))) {
      var li = LET.indexOf(m[1]);
      if (li >= exp && li <= exp + 1) { hits.push({ li: li, s: m.index, e: re.lastIndex }); exp = li + 1; }
    }
    var res = { head: (hits.length ? s.slice(0, hits[0].s) : s).trim(), items: [] };
    hits.forEach(function (h, k) {
      res.items.push({ li: h.li, text: s.slice(h.e, k + 1 < hits.length ? hits[k + 1].s : s.length).trim() });
    });
    return res;
  }

  /* lines: [{t,p,g,x0,y0,x1,y1}], figs: figs[g] = fiqur qutuları. A) B) C) D) E) variant xanalarına düşür */
  function parseOcrLines(lines, figs) {
    var qs = [], cur = null, last = 0, prevFig = false;
    function rect(ln) { return ln.g == null || ln.y0 == null ? null : { g: ln.g, x0: ln.x0, y0: ln.y0, x1: ln.x1, y1: ln.y1 }; }
    function inFig(ln) {
      if (ln.g == null || ln.y0 == null || !figs || !figs[ln.g]) return false;
      var cx = (ln.x0 + ln.x1) / 2, cy = (ln.y0 + ln.y1) / 2;
      return figs[ln.g].some(function (f) { return cx >= f.x0 - 2 && cx <= f.x1 + 2 && cy >= f.y0 - 2 && cy <= f.y1 + 2; });
    }
    function open(n, rest, ln) {
      cur = { num: n, lines: [], opts: [], optOpen: -1, page: ln.p, start: rect(ln), optRects: [], optConf: [] };
      if (rest) cur.lines.push(rest);
      qs.push(cur); last = n;
    }
    function addText(q, t) {
      var L = q.lines;
      if (!L.length) { L.push(t); return; }
      var prev = L[L.length - 1];
      if (/^\d{1,2}\s*[.)]\s*\S/.test(t) || /[?:]$/.test(prev)) L.push(t);
      else L[L.length - 1] = prev + " " + t;
    }
    function setOpt(q, li, text) { while (q.opts.length < li) q.opts.push(""); q.opts[li] = text; q.optOpen = li; }
    function takeOpts(ln, m, inF) {
      var li = LET.indexOf(m[1].toUpperCase()), nxt = cur.opts.length;
      if (li < nxt || li > nxt + 1) return false;
      var sp = inlineSplit(m[2], li + 1), rc = rect(ln);
      setOpt(cur, li, inF ? "" : sp.head);
      sp.items.forEach(function (it) { setOpt(cur, it.li, inF ? "" : it.text); });
      if (rc) cur.optRects.push(rc);
      if (!inF && ln.c != null) cur.optConf.push(ln.c);
      return true;
    }
    lines.forEach(function (ln) {
      var t = String(ln.t || "").replace(/\s+/g, " ").trim(), m;
      if (!t || !/[A-Za-z0-9əƏöÖüÜıİçÇşŞğĞ]/.test(t) || NOISE_RE.test(t) || NOISE2_RE.test(t) || /^\d{1,3}$/.test(t)) return;
      var inF = inFig(ln), wasFig = prevFig; prevFig = inF;
      if (cur && (m = OPT_RE.exec(t)) && takeOpts(ln, m, inF)) return;
      if (inF) return;                                   // fiqurun içindəki OCR zibili
      if ((m = NUM_RE.exec(t))) {
        var n = parseInt(m[1], 10), no = cur ? cur.opts.length : 0;
        var isNew = !cur ? n <= 200 : ((no >= 1 && (n === last + 1 || (no >= 2 && n > last && n <= last + 12))) || (n === last + 1 && wasFig));
        if (isNew) { open(n, m[2].trim(), ln); return; }
      }
      if (!cur) return;
      if (cur.optOpen >= 0) {
        cur.opts[cur.optOpen] = (cur.opts[cur.optOpen] + " " + t).trim();
        var rc = rect(ln); if (rc) cur.optRects.push(rc);
      } else addText(cur, t);
    });
    return qs.map(function (c) {
      var o = c.opts.slice(0, 5), cnt = o.length; while (o.length < 4) o.push("");
      var fo = o.filter(Boolean);
      var sym = fo.length >= 3 && fo.every(function (x) { return SYM_RE.test(x); }) && fo.some(function (x) { return x.replace(/\s/g, "").length >= 2; });
      if (!sym && c.optConf.length) {                     // variant sətirlərini OCR zəif oxuyubsa (simvol/fiqur variantlar)
        var avg = c.optConf.reduce(function (x, y) { return x + y; }, 0) / c.optConf.length;
        if (avg < 68) sym = true;
      }
      return { num: c.num, text: c.lines.join("\n").trim(), opts: o, page: c.page, incomplete: fo.length < 4,
        start: c.start, optRects: c.optRects, markerCount: cnt, symbolic: sym };
    });
  }

  /* hər sual üçün: hansı fiqur(lar) kəsilsin, variantlar şəkildirmi */
  function planImages(qs, infos, docHasE) {
    var PK = 1e5;
    qs.forEach(function (q, qi) {
      q.rects = null; q.picVar = false;
      if (!q.start) return;
      var nx = qs[qi + 1];
      var a = q.start.g * PK + q.start.y0 - 3, b = (nx && nx.start) ? nx.start.g * PK + nx.start.y0 - 3 : Infinity;
      var cl = [];
      infos.forEach(function (inf, g) {
        inf.figs.forEach(function (f) { var c = g * PK + (f.y0 + f.y1) / 2; if (c >= a && c < b) cl.push({ g: g, f: f }); });
      });
      var picVar = q.symbolic || (cl.length && q.opts.filter(Boolean).length < 2) || q.optRects.some(function (r) {
        var cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
        return cl.some(function (c) { return c.g === r.g && cx >= c.f.x0 - 3 && cx <= c.f.x1 + 3 && cy >= c.f.y0 - 3 && cy <= c.f.y1 + 3; });
      });
      var rs = {};
      function add(g, x0, y0, x1, y1) {
        var r = rs[g];
        if (!r) rs[g] = { g: g, x0: x0, y0: y0, x1: x1, y1: y1 };
        else { r.x0 = Math.min(r.x0, x0); r.y0 = Math.min(r.y0, y0); r.x1 = Math.max(r.x1, x1); r.y1 = Math.max(r.y1, y1); }
      }
      cl.forEach(function (c) { add(c.g, c.f.x0, c.f.y0, c.f.x1, c.f.y1); });
      if (q.symbolic) q.optRects.forEach(function (r) { add(r.g, r.x0, r.y0, r.x1, r.y1); });
      var gs = Object.keys(rs).map(Number).sort(function (x, y) { return x - y; });
      if (!gs.length) return;
      q.rects = gs.map(function (g) { return rs[g]; });
      q.picVar = !!picVar;
      if (q.picVar) {
        var n = Math.max(q.markerCount, docHasE ? 5 : 4);
        q.opts = LET.slice(0, n);
        q.incomplete = false;
      }
    });
  }

  /* ---------- fiqur aşkarlama (bağlı komponentlər; OCR-a ehtiyac yoxdur) ---------- */
  function detectFigures(g, w, h) {
    var N = w * h, ink = new Uint8Array(N), i, x, y;
    for (i = 0; i < N; i++) ink[i] = g[i] < 150 ? 1 : 0;
    var lab = new Int32Array(N), parent = [0], next = 1;
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function uni(a, b) { a = find(a); b = find(b); if (a !== b) { if (a < b) parent[b] = a; else parent[a] = b; } }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!ink[i]) continue;
      var l1 = x > 0 ? lab[i - 1] : 0, l2 = (x > 0 && y > 0) ? lab[i - w - 1] : 0, l3 = y > 0 ? lab[i - w] : 0, l4 = (y > 0 && x < w - 1) ? lab[i - w + 1] : 0;
      var m = 0; [l1, l2, l3, l4].forEach(function (l) { if (l && (!m || l < m)) m = l; });
      if (!m) { lab[i] = next; parent.push(next); next++; }
      else { lab[i] = m; [l1, l2, l3, l4].forEach(function (l) { if (l && l !== m) uni(m, l); }); }
    }
    var bx0 = new Int32Array(next).fill(1e9), by0 = new Int32Array(next).fill(1e9), bx1 = new Int32Array(next).fill(-1), by1 = new Int32Array(next).fill(-1), cnt = new Int32Array(next);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!lab[i]) continue;
      var r = find(lab[i]);
      if (x < bx0[r]) bx0[r] = x; if (x > bx1[r]) bx1[r] = x; if (y < by0[r]) by0[r] = y; if (y > by1[r]) by1[r] = y; cnt[r]++;
    }
    var comps = [], hs = [];
    for (var r2 = 1; r2 < next; r2++) if (cnt[r2] && parent[r2] === r2) {
      var c = { x0: bx0[r2], y0: by0[r2], x1: bx1[r2], y1: by1[r2] };
      c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; comps.push(c);
      if (c.h >= 5 && c.h <= 45 && c.w <= 60) hs.push(c.h);
    }
    hs.sort(function (a, b) { return a - b; });
    var hText = hs.length ? hs[Math.floor(hs.length * 0.75)] : 12, bigH = Math.max(26, 2.2 * hText), big = [], small = [];
    comps.forEach(function (c) {
      var rule = c.w <= 5 && c.h >= h * 0.5;               // səhifə ayırıcı xətti
      if (!rule && c.h >= bigH && c.w >= 0.6 * hText) big.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
      else if (!rule && c.w >= 8 * hText && c.h >= 1.6 * hText) big.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
      else small.push(c);
    });
    function merge(bs, m) {
      var ch = true;
      while (ch) {
        ch = false;
        for (var a = 0; a < bs.length && !ch; a++) for (var b = a + 1; b < bs.length && !ch; b++) {
          var A = bs[a], B = bs[b];
          if (A.x0 - m <= B.x1 && B.x0 - m <= A.x1 && A.y0 - m <= B.y1 && B.y0 - m <= A.y1) {
            A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0); A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
            bs.splice(b, 1); ch = true;
          }
        }
      }
      return bs;
    }
    big = merge(big, Math.max(18, 1.8 * hText));
    small.forEach(function (c) {                           // etiketlər: K, P, 1., A) …
      var cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      big.forEach(function (f) {
        if (cx >= f.x0 - 34 && cx <= f.x1 + 34 && cy >= f.y0 - 3 && cy <= f.y1 + 3) {
          f.x0 = Math.min(f.x0, c.x0); f.x1 = Math.max(f.x1, c.x1); f.y0 = Math.min(f.y0, c.y0); f.y1 = Math.max(f.y1, c.y1);
        }
      });
    });
    return merge(big, 6).filter(function (f) { return f.x1 - f.x0 >= 20 && f.y1 - f.y0 >= 20; });
  }
  function grayOf(cv) {
    var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, g = new Uint8Array(n);
    for (var i = 0; i < n; i++) g[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0;
    return g;
  }
  function drawRects(rects, infos) {
    var segs = rects.map(function (r) {
      var cv = infos[r.g].cv, x0 = Math.max(0, Math.floor(r.x0 - 6)), y0 = Math.max(0, Math.floor(r.y0 - 2)),
        x1 = Math.min(cv.width, Math.ceil(r.x1 + 6)), y1 = Math.min(cv.height, Math.ceil(r.y1 + 2));
      return { cv: cv, x0: x0, y0: y0, w: x1 - x0, h: y1 - y0 };
    }).filter(function (s) { return s.w > 20 && s.h > 20; });
    if (!segs.length) return null;
    var W = Math.max.apply(null, segs.map(function (s) { return s.w; })), f = Math.min(2, Math.max(1, 800 / W)), gap = 8, H = 0;
    segs.forEach(function (s) { H += s.h * f; }); H += gap * (segs.length - 1);
    var c = mk(Math.round(W * f), Math.round(H)), x = c.getContext("2d"), yy = 0;
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = "high";
    segs.forEach(function (s) { x.drawImage(s.cv, s.x0, s.y0, s.w, s.h, 0, yy, s.w * f, s.h * f); yy += s.h * f + gap; });
    return c.toDataURL("image/jpeg", 0.9);
  }

  /* ---------- sütun ayırma (OCR-dan əvvəl) ---------- */
  function findGutter(cnt, w, ch) {
    var lo = Math.floor(w * 0.25), hi = Math.ceil(w * 0.75), tol = Math.max(2, ch * 0.004), best = null, cur = null;
    for (var x = lo; x < hi; x++) {
      var c = cnt[x] > ch * 0.6 ? 0 : cnt[x];          // nazik şaquli xətti (ayırıcı) boşluq say
      if (c <= tol) { if (!cur) cur = { a: x, b: x }; cur.b = x; }
      else { if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur; cur = null; }
    }
    if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
    return best && best.b - best.a >= 6 ? best : null;
  }
  function splitColumns(cv) {
    var w = cv.width, h = cv.height, d = cv.getContext("2d").getImageData(0, 0, w, h).data;
    var cnt = new Array(w).fill(0), rows = new Array(h).fill(0);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 150) { cnt[x]++; rows[y]++; }
    }
    var y0 = 0, y1 = h - 1; while (y0 < h && rows[y0] < 3) y0++; while (y1 > y0 && rows[y1] < 3) y1--;
    var g = findGutter(cnt, w, Math.max(1, y1 - y0));
    if (!g) return [cv];
    function crop(xa, xb) {
      var c = mk(xb - xa, h); c.getContext("2d").drawImage(cv, xa, 0, xb - xa, h, 0, 0, xb - xa, h); return c;
    }
    return [crop(0, g.a), crop(g.b + 1, w)];
  }
  function ocrParts(p) {
    var saved = S.cfg.stack, flat;
    S.cfg.stack = 0; try { flat = process(p); } finally { S.cfg.stack = saved; }
    var out = process(p);                                // istifadəçinin gördüyü (rects tətbiq olunmuş) şəkil
    if (out.height > flat.height * 1.3) return [out];    // 2 sütun artıq alt-alta düzülüb
    return splitColumns(out);                            // düzülməyib → özümüz ayırırıq
  }

  var OCR = { w: null, k: 0, n: 1, f: 1 };
  async function getOcr() {
    if (OCR.w) return OCR.w;
    if (!window.__dqLibs) throw new Error("Kitabxana yükləyicisi (__dqLibs) tapılmadı.");
    await window.__dqLibs("ocr");
    OCR.w = await Tesseract.createWorker("aze", 1, {
      logger: function (m) {
        if (m && m.status === "recognizing text") setProg(Math.round((OCR.k + (m.progress || 0) * OCR.f) / OCR.n * 100));
      }
    });
    return OCR.w;
  }
  function ocrCanvas(cv) {
    var s = 1800 / cv.width;
    s = Math.min(2.5, Math.max(1, s)); if (cv.width * s > 2600) s = 2600 / cv.width;
    if (cv.height * s > 9000) s = Math.max(0.6, 9000 / cv.height);
    var M = 30, c = mk(cv.width * s + 2 * M, cv.height * s + 2 * M), x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = "high"; x.drawImage(cv, M, M, cv.width * s, cv.height * s);
    return { c: c, s: s, M: M };
  }
  function ocrLines(d) {
    if (d && d.lines && d.lines.length) return d.lines;
    var out = [];
    ((d && d.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pp) { (pp.lines || []).forEach(function (l) { out.push(l); }); }); });
    return out;
  }
  /* ---------- ehtiyat parser: variant zəncirinə (A→B→C→D) görə suallara ayırır ---------- */
  var AZC = "A-Za-zƏəİıÖöÜüÇçŞşĞğ";
  function fbClean(s) {
    s = String(s || "").replace(/[\u00a0\t]/g, " ").replace(/ {2,}/g, " ").replace(/\s+([,;?!)])/g, "$1");
    s = s.replace(new RegExp("([,;])(?=[" + AZC + "])", "g"), "$1 ").replace(new RegExp("([a-zəıöüçşğ]{2})([.?!])(?=[A-ZƏİÖÜÇŞĞ][a-zəıöüçşğ]|\\d\\s)", "g"), "$1$2 ");
    s = s.replace(new RegExp("(^|\\n)(\\d{1,2})\\.(?=[" + AZC + "])", "g"), "$1$2. ");
    return s.trim();
  }
  function fbJoin(raw) {
    var out = [];
    raw.split("\n").forEach(function (l) {
      l = l.trim(); if (!l) return;
      if (!out.length) { out.push(l); return; }
      var stmt = /^\d{1,2}[.)]\s*\S/.test(l) && !/^\d{1,2}[.)]\d/.test(l);
      if (stmt || /^[•\-–]\s/.test(l)) out.push(l); else out[out.length - 1] += " " + l;
    });
    return out.join("\n");
  }
  function chainParse(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").map(function (l) { return l.replace(/\s+/g, " ").trim(); })
      .filter(function (l) { return l && /[A-Za-z0-9əƏöÖüÜıİçÇşŞğĞ]/.test(l) && !NOISE_RE.test(l) && !NOISE2_RE.test(l) && !/^\d{1,3}$/.test(l); });
    var T = lines.join("\n"), M = [], m, re1 = /(^|\s)\(?([A-E])\s?\)\s*/g, re2 = /^([A-E])\.(?=\s|[^\d.])\s*/gm;
    while ((m = re1.exec(T))) M.push({ L: m[2], s: m.index + m[1].length, e: m.index + m[0].length });
    while ((m = re2.exec(T))) M.push({ L: m[1], s: m.index, e: m.index + m[0].length });
    M.sort(function (a, b) { return a.s - b.s; });
    var ch = [], cur = null;
    M.forEach(function (x) {
      if (!cur) { if (x.L === "A") cur = [x]; return; }
      var nx = String.fromCharCode(cur[cur.length - 1].L.charCodeAt(0) + 1);
      if (x.L === nx && x.s >= cur[cur.length - 1].e) { cur.push(x); if (x.L === "E") { ch.push(cur); cur = null; } }
      else if (x.L === "A") { if (cur.length >= 2) ch.push(cur); cur = [x]; }
    });
    if (cur && cur.length >= 2) ch.push(cur);
    function cands(from, to, skip) {
      var seg = T.slice(from, to), re = /^(\d{1,3})\s*[.)]\s*(?=\S)/gm, mm, o = [];
      while ((mm = re.exec(seg))) {
        if (skip && mm.index === 0) continue;
        var rest = seg.slice(mm.index + mm[0].length, mm.index + mm[0].length + 40);
        if (/^\d/.test(rest) && !new RegExp("^\\d+\\s+[" + AZC + "]{3,}").test(rest)) continue;
        if (/^[\d.\s]+$/.test(rest.split("\n")[0])) continue;
        o.push({ n: +mm[1], pos: from + mm.index, len: mm[0].length });
      }
      return o;
    }
    var res = [], lastN = 0, prevEnd = 0;
    ch.forEach(function (c, i) {
      var first = c[0], cs = cands(prevEnd, first.s, i > 0), exp = i === 0 ? 1 : lastN + 1,
        cd = i === 0 ? (cs.filter(function (z) { return z.n === 1; })[0] || cs[0] || null) : (cs.filter(function (z) { return z.n === exp; })[0] || null);
      if (i > 0) { var pl = ch[i - 1][ch[i - 1].length - 1]; res[res.length - 1].lastRaw = T.slice(pl.e, cd ? cd.pos : first.s); }
      var stem = cd ? T.slice(cd.pos + cd.len, first.s) : (i === 0 ? T.slice(0, first.s) : "");
      var n = cd ? cd.n : exp; lastN = n;
      var o = ["", "", "", "", ""];
      c.forEach(function (x, k) { if (k + 1 < c.length) o[x.L.charCodeAt(0) - 65] = T.slice(x.e, c[k + 1].s); });
      res.push({ n: n, stem: stem, o: o, li: c[c.length - 1].L.charCodeAt(0) - 65, ls: c[c.length - 1].e });
      prevEnd = c[c.length - 1].e;
    });
    if (res.length) {
      var lq = res[res.length - 1], nx = cands(lq.ls, T.length, false).filter(function (z) { return z.n === lq.n + 1; })[0];
      lq.lastRaw = T.slice(lq.ls, nx ? nx.pos : T.length);
    }
    return res.map(function (q) {
      q.o[q.li] = q.lastRaw || "";
      var opts = q.o.map(function (x) { return fbClean(fbJoin(x).replace(/\n/g, " ")); }), cnt = opts.filter(Boolean).length;
      var stemT = fbClean(fbJoin(q.stem)); stemT = stemT.charAt(0).toLocaleUpperCase("az") + stemT.slice(1);
      while (opts.length > 4 && !opts[opts.length - 1]) opts.pop();
      return { num: q.n, text: stemT, opts: opts, page: 0, incomplete: cnt < 4 };
    });
  }

  async function extractOcr() {
    if (S.busy) return;
    if (!S.pages.length) return msg("Əvvəlcə fayl yükləyin.", "err");
    S.busy = true; $("qs-go").disabled = true; $("qs-ocr").disabled = true;
    try {
      msg("OCR mühərriki yüklənir (ilk dəfə 20–40 san çəkə bilər)…"); setProg(2);
      var w = await getOcr();
      await w.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
      var n = S.pages.length, lines = [], infos = [];
      OCR.n = n;
      for (var k = 0; k < n; k++) {
        var parts = ocrParts(S.pages[k]); OCR.f = 1 / parts.length;
        for (var j = 0; j < parts.length; j++) {
          OCR.k = k + j / parts.length; msg("OCR oxuyur: səhifə " + (k + 1) + " / " + n + (parts.length > 1 ? " (sütun " + (j + 1) + "/" + parts.length + ")" : " (sütun ayrılmadı)"));
          var cv = parts[j], gi = infos.length, figs = [];
          try { figs = detectFigures(grayOf(cv), cv.width, cv.height); } catch (er) { figs = []; }
          infos.push({ cv: cv, p: k, figs: figs });
          var oc = ocrCanvas(cv);
          var res = await w.recognize(oc.c, {}, { blocks: true, text: true });
          var ls = ocrLines(res && res.data);
          if (ls.length) ls.forEach(function (l) {
            var b = l.bbox || {};
            lines.push({ t: l.text, c: l.confidence, p: k, g: gi, x0: (b.x0 - oc.M) / oc.s, y0: (b.y0 - oc.M) / oc.s, x1: (b.x1 - oc.M) / oc.s, y1: (b.y1 - oc.M) / oc.s });
          });
          else String((res && res.data && res.data.text) || "").split(/\r?\n/).forEach(function (t) { lines.push({ t: t, p: k }); });
        }
        setProg(Math.round((k + 1) / n * 100));
      }
      showPage();
      msg("Suallar və şəkillər hazırlanır…");
      var docHasE = lines.some(function (l) { return /(?:^|\s)E\s*[)\]}]/.test(String(l.t || "")); });
      var raw = parseOcrLines(lines, infos.map(function (f) { return f.figs; })), alt = [];
      try { alt = chainParse(lines.map(function (l) { return l.t || ""; }).join("\n")); } catch (er) { alt = []; }
      if (alt.length > raw.length) raw = alt;                 // əsas parser az tapıbsa ehtiyat parserə keç
      else planImages(raw, infos, docHasE);
      var nimg = 0;
      var list = raw.map(function (it) {
        var img = null;
        if (it.rects) { try { img = drawRects(it.rects, infos); } catch (er) { img = null; } }
        if (img) nimg++;
        return { id: ++S.uid, sel: false, num: it.num, text: it.text, opts: it.opts, correct: null, image: img, page: it.page, incomplete: it.incomplete };
      });
      if (!list.length) msg("Sual tapılmadı. Yuxarıdakı təmiz səhifəni yoxlayın (fon silmə gücü / 🧽 Sil rejimi), ya da ➕ Boş sual ilə əl ilə daxil edin.", "err");
      else {
        S.qs = S.qs.concat(list); renderList(); persist();
        msg("✅ OCR ilə " + list.length + " sual çıxarıldı, " + nimg + " sual üçün şəkil kəsildi. Düzgün cavabı seçin və mətni yoxlayın. Variantlar şəkildədirsə, xanalarda yalnız A, B, C… hərfləri yazılır.", "ok");
      }
    } catch (e) { msg("❌ OCR xətası: " + e.message + " (internet bağlantısını yoxlayın)", "err"); }
    S.busy = false; $("qs-go").disabled = false; $("qs-ocr").disabled = false;
    setTimeout(function () { $("qs-prog").style.display = "none"; }, 1500);
  }

  /* ---------- sual siyahısı ---------- */
  function find(id) { for (var i = 0; i < S.qs.length; i++) if (S.qs[i].id === id) return i; return -1; }
  function cardHtml(q, pos) {
    var h = '<div class="qs-card' + (q.sel ? " sel" : "") + '" data-id="' + q.id + '">' +
      '<label class="qs-sel"><input type="checkbox" class="qs-ck"' + (q.sel ? " checked" : "") + '><span>' + (pos + 1) + '</span></label>' +
      '<div class="qs-body"><div class="qs-top"><input class="qs-in qs-num" type="number" placeholder="№" value="' + esc(q.num) + '">' +
      (q.page != null && S.pages[q.page] ? '<span class="qs-tag">səh. ' + (q.page + 1) + '</span><button class="qs-b o s" data-act="view">👁 Səhifə</button>' : "") +
      (q.incomplete ? '<span class="qs-tag w">⚠ yarımçıq</span>' : "") +
      (q.correct == null ? '<span class="qs-tag w">cavab seçilməyib</span>' : "") + '</div>' +
      '<textarea class="qs-in qs-t" placeholder="Sual mətni">' + esc(q.text) + '</textarea>';
    if (q.image) h += '<div class="qs-img"><img src="' + q.image + '"><button class="qs-b r s" data-act="rmimg" style="position:absolute;top:4px;right:4px">✕</button></div>';
    q.opts.forEach(function (o, i) {
      h += '<div class="qs-o"><button class="qs-r' + (q.correct === i ? " on" : "") + '" data-act="cor" data-i="' + i + '">' + LET[i] + '</button>' +
        '<input class="qs-in qs-ov" data-i="' + i + '" value="' + esc(o) + '" placeholder="Variant ' + LET[i] + '"></div>';
    });
    h += '<div class="qs-bt"><button class="qs-b o s" data-act="addo"' + (q.opts.length >= 5 ? " disabled" : "") + '>＋ Variant</button>' +
      '<button class="qs-b o s" data-act="delo"' + (q.opts.length <= 2 ? " disabled" : "") + '>－ Variant</button>' +
      '<button class="qs-b o s" data-act="merge">↧ Növbətilə birləşdir</button>' +
      '<button class="qs-b o s" data-act="dup">⧉ Təkrarla</button>' +
      '<button class="qs-b o s" data-act="img">📷 Şəkil</button>' +
      '<button class="qs-b r s" data-act="del">🗑 Sil</button></div></div></div>';
    return h;
  }
  function renderList() {
    $("qs-qwrap").style.display = (S.qs.length || S.pages.length) ? "block" : "none";
    $("qs-list").innerHTML = S.qs.map(cardHtml).join("");
    $("qs-list").querySelectorAll(".qs-t").forEach(grow);
    counts();
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.max(90, t.scrollHeight + 4) + "px"; }
  function counts() {
    $("qs-cnt").textContent = S.qs.length;
    $("qs-selcnt").textContent = S.qs.filter(function (q) { return q.sel; }).length;
  }
  var persistT;
  function persist() {
    clearTimeout(persistT);
    persistT = setTimeout(function () {
      try { localStorage.setItem(DRAFT_LS, JSON.stringify(S.qs.map(function (q) { return Object.assign({}, q, { image: null, page: null }); }))); } catch (e) {}
    }, 600);
  }
  function listClick(e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var card = b.closest(".qs-card"), id = +card.dataset.id, i = find(id), q = S.qs[i], act = b.dataset.act;
    if (act === "cor") { var k = +b.dataset.i; q.correct = q.correct === k ? null : k; }
    else if (act === "addo") { if (q.opts.length < 5) q.opts.push(""); }
    else if (act === "delo") { if (q.opts.length > 2) { q.opts.pop(); if (q.correct != null && q.correct >= q.opts.length) q.correct = null; } }
    else if (act === "del") { if (!confirm("Bu sual siyahıdan silinsin?")) return; S.qs.splice(i, 1); }
    else if (act === "dup") { var c = JSON.parse(JSON.stringify(q)); c.id = ++S.uid; c.sel = false; c.image = q.image; S.qs.splice(i + 1, 0, c); }
    else if (act === "rmimg") { q.image = null; }
    else if (act === "img") { S.imgFor = id; $("qs-imgfile").click(); return; }
    else if (act === "view") { viewPage(q.page); return; }
    else if (act === "merge") {
      var nx = S.qs[i + 1]; if (!nx) return msg("Növbəti sual yoxdur.", "err");
      q.text = (q.text + "\n" + nx.text).trim();
      var len = Math.max(q.opts.length, nx.opts.length);
      for (var j = 0; j < len; j++) { var a = q.opts[j] || "", c2 = nx.opts[j] || ""; q.opts[j] = a && c2 ? a + " " + c2 : a || c2; }
      if (q.correct == null) q.correct = nx.correct; q.image = q.image || nx.image; q.incomplete = nx.incomplete;
      S.qs.splice(i + 1, 1);
    }
    renderList(); persist();
  }
  function listInput(e) {
    var t = e.target, card = t.closest(".qs-card"); if (!card) return;
    var q = S.qs[find(+card.dataset.id)]; if (!q) return;
    if (t.classList.contains("qs-t")) { q.text = t.value; grow(t); }
    else if (t.classList.contains("qs-num")) q.num = t.value;
    else if (t.classList.contains("qs-ov")) q.opts[+t.dataset.i] = t.value;
    persist();
  }
  function listChange(e) {
    var t = e.target; if (!t.classList.contains("qs-ck")) return;
    var card = t.closest(".qs-card"), q = S.qs[find(+card.dataset.id)]; q.sel = t.checked;
    card.classList.toggle("sel", q.sel); counts();
  }
  function viewPage(pi) {
    var p = S.pages[pi]; if (!p) return;
    if (!p.url) p.url = (p.out || process(p)).toDataURL("image/png");
    var m = document.createElement("div"); m.className = "qs-modal";
    m.innerHTML = '<header><span>Səhifə ' + (pi + 1) + ' (təmizlənmiş)</span><button class="qs-b r s">✕ Bağla</button></header><div class="bd"><img src="' + p.url + '"></div>';
    m.querySelector("button").onclick = function () { m.remove(); };
    document.body.appendChild(m);
  }
  function imgFile(file) {
    var q = S.qs[find(S.imgFor)]; if (!q || !file) return;
    fileToCanvas(file).then(function (c) {
      var s = Math.min(1, 900 / c.width), o = mk(c.width * s, c.height * s); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height);
      q.image = o.toDataURL("image/jpeg", 0.82); renderList();
    }).catch(function (e) { msg("❌ " + e.message, "err"); });
  }

  /* ---------- sınağa əlavə ---------- */
  function subj() { return structure()[+$("qs-subj").value] || structure()[0]; }
  function selCats() { return Array.prototype.map.call(document.querySelectorAll(".qs-cat:checked"), function (x) { return x.value; }); }
  async function usedNums(exam, cat, s) {
    var r = await sb().from("exam_questions").select("id,q_number").eq("exam_id", exam).eq("category", cat).gte("q_number", s.start).lte("q_number", s.end);
    if (r.error) throw r.error;
    var m = {}; (r.data || []).forEach(function (x) { m[x.q_number] = x.id; }); return m;
  }
  async function checkFree() {
    var exam = $("qs-exam").value.trim(), cats = selCats(), s = subj();
    if (!exam || !cats.length) return msg("Sınaq № və kateqoriya seçin.", "err");
    try {
      var lines = [];
      for (var c of cats) {
        var u = await usedNums(exam, c, s), used = Object.keys(u).length, tot = s.end - s.start + 1;
        lines.push(c + ": " + s.title + " (" + s.start + "–" + s.end + ") — " + used + " dolu, " + (tot - used) + " boş");
      }
      $("qs-free").textContent = lines.join("\n"); $("qs-free").style.whiteSpace = "pre-line";
    } catch (e) { msg("❌ " + e.message, "err"); }
  }
  async function addSelected() {
    if (S.busy) return;
    var sel = S.qs.filter(function (q) { return q.sel; });
    if (!sel.length) return msg("Əvvəlcə sualları seçin (sol tərəfdəki qutular).", "err");
    var exam = $("qs-exam").value.trim(), cats = selCats(), s = subj(), mode = $("qs-mode").value, man = parseInt($("qs-start").value) || 0;
    if (!exam) return msg("Sınaq nömrəsini yazın.", "err");
    if (!cats.length) return msg("Ən azı 1 kateqoriya seçin.", "err");
    var bad = [];
    sel.forEach(function (q) {
      var n = q.opts.filter(function (o) { return o.trim(); }).length;
      if (!q.text.trim() && !q.image) bad.push("sual mətni boşdur (№" + (q.num || "?") + ")");
      else if (n < 2) bad.push("variant azdır (№" + (q.num || "?") + ")");
    });
    if (bad.length) return msg("❌ Düzəldin:\n" + bad.slice(0, 8).join("\n"), "err");
    var noCor = sel.filter(function (q) { return q.correct == null; }).length;
    if (noCor && !confirm(noCor + " sualda düzgün cavab seçilməyib — onlara 'A' yazılacaq. Davam edilsin?")) return;
    if (!confirm(sel.length + " sual → Sınaq " + exam + " / " + cats.join(", ") + " / " + s.title + " (" + s.start + "–" + s.end + ")\nDavam edilsin?")) return;
    S.busy = true; $("qs-add").disabled = true;
    var report = [], okIds = {}, anyErr = false;
    try {
      for (var ci = 0; ci < cats.length; ci++) {
        var cat = cats[ci], used = await usedNums(exam, cat, s), nums = [], start = Math.min(s.end, Math.max(s.start, man || s.start));
        if (mode === "gaps") { for (var n = start; n <= s.end && nums.length < sel.length; n++) if (!used[n]) nums.push(n); }
        else { for (var m = start; m <= s.end && nums.length < sel.length; m++) nums.push(m); }
        if (nums.length < sel.length) {
          if (!confirm(cat + ": yalnız " + nums.length + " yer var, " + (sel.length - nums.length) + " sual əlavə olunmayacaq. Davam?")) { report.push(cat + ": ləğv edildi"); continue; }
        }
        var okCount = 0;
        for (var k = 0; k < nums.length; k++) {
          var q = sel[k], row = {
            exam_id: exam, category: cat, q_number: nums[k], subject: s.title, question: q.text.trim(), image_url: q.image || null,
            options: q.opts.map(function (o) { return { text: o.trim(), image: null }; }).filter(function (o, i, a) { return o.text || i < 2; }),
            correct: q.correct == null ? 0 : q.correct
          };
          var res = used[nums[k]] && mode === "over"
            ? await sb().from("exam_questions").update(row).eq("id", used[nums[k]])
            : await sb().from("exam_questions").insert([row]);
          if (res.error) { anyErr = true; report.push(cat + " №" + nums[k] + ": " + res.error.message); }
          else { okCount++; okIds[q.id] = (okIds[q.id] || 0) + 1; }
        }
        if (nums.length) report.push("✅ " + cat + ": " + okCount + " sual → " + nums[0] + "–" + nums[nums.length - 1]);
      }
      if (!anyErr && $("qs-rm").checked) {
        S.qs = S.qs.filter(function (q) { return !(q.sel && okIds[q.id] === cats.length); });
        renderList(); persist();
      }
      msg(report.join("\n"), anyErr ? "err" : "ok");
      checkFree();
    } catch (e) { msg("❌ " + e.message, "err"); }
    S.busy = false; $("qs-add").disabled = false;
  }

  /* ---------- naqillər ---------- */
  function wire() {
    var f = $("qs-file");
    $("qs-drop").onclick = function () { f.click(); };
    f.onchange = function () { onFiles(f.files); f.value = ""; };
    var imf = document.createElement("input"); imf.type = "file"; imf.accept = "image/*"; imf.id = "qs-imgfile"; imf.style.display = "none";
    imf.onchange = function () { imgFile(imf.files[0]); imf.value = ""; };
    $("mod-qstudio").appendChild(imf);

    var c = $("qs-c"), top = $("qs-top"), bot = $("qs-bot"), auto = $("qs-auto"), stack = $("qs-stack");
    c.value = S.cfg.c; $("qs-cv").textContent = S.cfg.c; top.value = S.cfg.top; bot.value = S.cfg.bot;
    auto.checked = !!S.cfg.auto; stack.checked = !!S.cfg.stack;
    var raf = 0;
    c.oninput = function () { S.cfg.c = +c.value; $("qs-cv").textContent = c.value; cancelAnimationFrame(raf); raf = requestAnimationFrame(showPage); };
    c.onchange = saveCfg;
    [top, bot].forEach(function (el) { el.onchange = function () { S.cfg.top = Math.max(0, Math.min(20, +top.value || 0)); S.cfg.bot = Math.max(0, Math.min(20, +bot.value || 0)); saveCfg(); showPage(); }; });
    auto.onchange = function () { S.cfg.auto = auto.checked ? 1 : 0; saveCfg(); showPage(); };
    stack.onchange = function () { S.cfg.stack = stack.checked ? 1 : 0; S.pages.forEach(function (p) { p.rects = []; }); saveCfg(); showPage(); };
    $("qs-prev").onclick = function () { if (S.cur > 0) { S.cur--; showPage(); } };
    $("qs-next").onclick = function () { if (S.cur < S.pages.length - 1) { S.cur++; showPage(); } };
    $("qs-orig").onclick = function () { S.showOrig = !S.showOrig; showPage(); };
    $("qs-eraser").onclick = function () { S.eraseOn = !S.eraseOn; if (S.eraseOn) S.showOrig = false; showPage(); };
    $("qs-undo").onclick = function () { var p = S.pages[S.cur]; if (p && p.rects.length) { p.rects.pop(); showPage(); } };
    wireCanvas();

    var key = $("qs-key"); try { key.value = localStorage.getItem(KEY_LS) || ""; } catch (e) {}
    $("qs-model").value = S.cfg.model;
    $("qs-go").onclick = extract; $("qs-ocr").onclick = extractOcr;
    $("qs-blank").onclick = function () {
      S.qs.push({ id: ++S.uid, sel: false, num: "", text: "", opts: ["", "", "", ""], correct: null, image: null, page: null, incomplete: false });
      renderList(); persist();
    };
    var draft = null; try { draft = JSON.parse(localStorage.getItem(DRAFT_LS) || "null"); } catch (e) {}
    if (draft && draft.length) {
      var rb = $("qs-restore"); rb.style.display = "inline-block"; rb.textContent = "♻️ Qaralamanı bərpa et (" + draft.length + ")";
      rb.onclick = function () { draft.forEach(function (q) { q.id = ++S.uid; q.sel = false; S.qs.push(q); }); rb.style.display = "none"; $("qs-ext").style.display = "block"; renderList(); };
    }

    var L = $("qs-list");
    L.addEventListener("click", listClick); L.addEventListener("input", listInput); L.addEventListener("change", listChange);
    $("qs-all").onclick = function () { S.qs.forEach(function (q) { q.sel = true; }); renderList(); };
    $("qs-none").onclick = function () { S.qs.forEach(function (q) { q.sel = false; }); renderList(); };
    $("qs-range").onclick = function () {
      var a = parseInt($("qs-r1").value) || 1, b = parseInt($("qs-r2").value) || S.qs.length;
      S.qs.forEach(function (q, i) { q.sel = i + 1 >= a && i + 1 <= b; }); renderList();
    };
    var sj = $("qs-subj");
    sj.innerHTML = structure().map(function (s, i) { return '<option value="' + i + '"' + (/qanun/i.test(s.title) ? " selected" : "") + ">" + esc(s.title) + " (" + s.start + "–" + s.end + ")</option>"; }).join("");
    $("qs-chk").onclick = checkFree; $("qs-add").onclick = addSelected;
  }
  async function loadExams() {
    try {
      var r = await sb().from("exam_questions").select("exam_id").limit(3000), seen = {};
      (r.data || []).forEach(function (x) { seen[x.exam_id] = 1; });
      $("qs-exams").innerHTML = Object.keys(seen).sort(function (a, b) { return a - b; }).map(function (v) { return '<option value="' + esc(v) + '">'; }).join("");
    } catch (e) {}
  }

  window.QS = { show: function () { build(); loadExams(); if (S.pages.length) showPage(); } };

  /* switchAdminTab-a qoşul */
  function hook() {
    build();
    var o = window.switchAdminTab;
    if (typeof o !== "function" || o.__qs) return;
    window.switchAdminTab = function (t) {
      var r = o.apply(this, arguments);
      if (t === "qstudio") window.QS.show();
      return r;
    };
    window.switchAdminTab.__qs = true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook); else hook();
})();
