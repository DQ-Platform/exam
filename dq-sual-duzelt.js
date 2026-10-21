/* =====================================================================
   DQ Platform · Sual Düzəldici
   Xam mətni (sınaq səhifəsi, sənəd, PDF-dən kopya) yapışdırırsan →
   yalnız sual mətni + variantlar çıxarılır, qrammatika/orfoqrafiya/durğu işarələri
   peşəkar şəkildə düzəldilir → hər sualı redaktə edib dəqiqləşdirə bilirsən.

   Qoşulma (index.html-də digər skriptlərdən SONRA):
     <script src="dq-sual-duzelt.js?v=1"></script>
   Açılış:  DQSD.open()  |  Ctrl+Shift+D  |  ?sd=1  |  localStorage.dq_sd_btn="1" (üzən düymə)
   Bazaya göndərmə: window.DQSD_SAVE = function(items){ ... }  (items: [{q,o:[{k,t}],a}])
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQSD) return;

  var CFG = Object.assign({
    endpoint: "https://cpzwliqlgaplroscvduo.supabase.co/functions/v1/sual-duzelt",
    key: "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF",
    chunk: 9000
  }, window.DQSD_CFG || {});
  var LET = "ABCDEF";
  var S = { items: [], busy: false };
  var el = {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ───────── yerli (AI-siz) təhlil: ehtiyat rejim ───────── */
  var RE_NUM = /^\s*(?:Sual\s*)?(\d{1,3})\s*(?:[.)\-:]\s*|\s+)(\S.*)$/i;
  var RE_OPT_D = /^\s*\(?([A-Fa-f])\s*[.)\-:]\s*(.*)$/;      // A) mətn | A. mətn
  var RE_OPT_S = /^\s*\(?([A-F])\)?\s+(\S.*)$/;              // A mətn (dairəli hərf PDF-də)
  var RE_OPT_B = /^\s*\(?([A-F])\)?\s*$/;                     // boş variant: yalnız hərf
  var RE_JUNK = /^\s*(sınaq\s*\d*(\s*[·\-].*)?|səhifə\s*\d+.*|page\s*\d+|\d+\s*\/\s*\d+|\d+\s+sual|cavab\s+aç[ae]r[ıi]|dq\s*platform.*|by\s+yunis.*|-{2,}|_{2,})\s*$/i;
  var RE_MARK = /\s*(✓|✔|☑|\(düz\)|\(doğru\))\s*$/i;

  function fixText(s, cap) {
    s = String(s || "").replace(/[\u00a0\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
    s = s.replace(/\s+([,.;:!?])/g, "$1").replace(/([,;:!?])(?=[^\s\d"”')\]])/g, "$1 ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
    s = s.replace(/\.{4,}/g, "…").replace(/\s{2,}/g, " ").trim();
    return cap && s ? s.charAt(0).toLocaleUpperCase("az") + s.slice(1) : s;
  }
  function optMatch(line) {
    var m = RE_OPT_D.exec(line); if (m) return { k: m[1].toUpperCase(), t: m[2] };
    m = RE_OPT_S.exec(line); if (m) return { k: m[1], t: m[2] };
    m = RE_OPT_B.exec(line); if (m) return { k: m[1], t: "" };
    return null;
  }
  function tidy(it) {                                  // sondakı boş variantları at (məs. boş «E»)
    var any = it.o.some(function (x) { return x.t.trim(); });
    while (any && it.o.length && !it.o[it.o.length - 1].t.trim()) it.o.pop();
    return it;
  }
  function localParse(text) {
    var items = [], cur = null, last = 0, numbered = null, all = String(text || "").split(/\r?\n/);
    var badge = all.filter(function (l) { return /^\s*\d{1,3}\s+\S/.test(l) && !RE_JUNK.test(l); }).length >= 3;   // «12 Sual mətni» tipli nömrələmə
    if (badge) numbered = true;
    all.forEach(function (raw) {
      var line = raw.trim(); if (!line || RE_JUNK.test(line)) return;
      var done = cur && cur.o.length >= 2, qm = RE_NUM.exec(line), om = optMatch(line);
      var hasDelim = /^\s*(?:Sual\s*)?\d{1,3}\s*[.)\-:]/i.test(line);
      var isQ = qm && (!cur || cur.o.length >= 1 || !hasDelim) && (!last || (+qm[1] > last && +qm[1] <= last + 50));
      if (isQ) { cur = { no: +qm[1], q: qm[2], o: [], a: "", n: "" }; last = cur.no; items.push(cur); if (numbered === null) numbered = true; return; }
      if (om && ((cur && om.k === LET[cur.o.length]) || (!cur && om.k === "A"))) {
        if (!cur) { cur = { no: 0, q: "", o: [], a: "", n: "" }; items.push(cur); }
        var t = om.t, mk = false; if (RE_MARK.test(t)) { mk = true; t = t.replace(RE_MARK, ""); }
        if (/^\*/.test(t)) { mk = true; t = t.replace(/^\*\s*/, ""); }
        cur.o.push({ k: om.k, t: t.trim() }); if (mk) cur.a = om.k; return;
      }
      if (!cur && badge) return;                       // ilk sualdan əvvəlki başlıqları at
      if (!cur || (done && numbered !== true)) { cur = { no: 0, q: line, o: [], a: "", n: "" }; items.push(cur); if (numbered === null) numbered = false; return; }
      if (cur.o.length) cur.o[cur.o.length - 1].t += " " + line; else cur.q += (cur.q ? " " : "") + line;
    });
    items.forEach(function (it) {
      it.q = fixText(it.q, true); it.o.forEach(function (x) { x.t = fixText(x.t, false); });
      it.n = "Yerli rejim: yalnız format/durğu düzəldildi"; tidy(it);
    });
    return items.filter(function (it) { return it.q || it.o.length; });
  }

  /* ───────── «Cavab açarı» (PDF-in sonundakı cədvəl) ───────── */
  function splitKey(text) {
    var m = /^[ \t]*cavab(?:[ \t]+aç[ae]r[ıi])?[ \t]*$/im.exec(text), key = {}, n = 0;
    if (!m) return { body: text, key: key, n: 0 };
    var rest = text.slice(m.index + m[0].length), re = /(?:^|[^\d])(\d{1,3})\s*[-–:.)]?\s+([A-F])(?![A-Za-zƏəİıÖöÜüĞğŞşÇç])/g, x;
    while ((x = re.exec(rest))) { if (!key[x[1]]) { key[x[1]] = x[2]; n++; } re.lastIndex = x.index + x[0].length - 1; }
    return n >= 5 ? { body: text.slice(0, m.index), key: key, n: n } : { body: text, key: {}, n: 0 };
  }
  function applyKey(items, key) {
    var hit = 0;
    items.forEach(function (it, i) {
      var k = key[it.no || i + 1];
      if (k && it.o.length && LET.indexOf(k) < it.o.length) { it.a = k; hit++; it.n = (it.n ? it.n + " · " : "") + "doğru cavab açardan götürüldü"; }
    });
    return hit;
  }
  function flags(it) {                                 // problemli suallar üçün xəbərdarlıq
    var f = [], texts = it.o.map(function (x) { return x.t.trim(); }).filter(Boolean);
    if (!it.o.length || !texts.length) f.push("🖼 variantlar şəkildir/oxunmadı");
    else if (/şəkil|fiqur|diaqram|obyekt aid|topologiya/i.test(it.q)) f.push("🖼 şəkil tələb edə bilər");
    if (texts.length !== new Set(texts).size) f.push("eyni variantlar var");
    if (/[\uE000-\uF8FF\uFFFD□▯]/.test(it.q + it.o.map(function (x) { return x.t; }).join(""))) f.push("oxunmayan simvol var");
    if (it.o.length < 2 || !it.q.trim()) f.push("variant/sual çatmır");
    return f;
  }

  /* ───────── AI çağırışı (Supabase Edge Function) ───────── */
  function getPin() {
    var p = ""; try { p = sessionStorage.getItem("dq_sd_pin") || ""; } catch (e) {}
    if (!p) { p = prompt("Admin PIN:") || ""; if (p) try { sessionStorage.setItem("dq_sd_pin", p); } catch (e) {} }
    return p;
  }
  async function ai(payload) {
    var pin = getPin(); if (!pin) throw new Error("PIN daxil edilmədi");
    var r = await fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CFG.key, "x-admin-pin": pin },
      body: JSON.stringify(payload)
    });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (r.status === 401) { try { sessionStorage.removeItem("dq_sd_pin"); } catch (e) {} throw new Error("PIN yanlışdır"); }
    if (!r.ok || !j || j.error) throw new Error((j && j.error) || ("Server xətası " + r.status));
    return normalize(j.items);
  }
  function normalize(arr) {
    return (Array.isArray(arr) ? arr : []).map(function (x) {
      var o = (Array.isArray(x.options) ? x.options : x.o || []).slice(0, LET.length).map(function (v, j) { return { k: LET[j], t: String(v && v.t != null ? v.t : v || "") }; });
      var a = String(x.ans || x.a || "").toUpperCase();
      return tidy({ no: parseInt(x.no) || 0, q: String(x.q || ""), o: o, a: LET.indexOf(a) >= 0 && LET.indexOf(a) < o.length ? a : "", n: String(x.note || x.n || "") });
    }).filter(function (it) { return it.q.trim() || it.o.length; });
  }
  function chunkText(text) {
    var lines = text.split(/\r?\n/), out = [], cur = "";
    lines.forEach(function (ln) {
      var over = cur.length + ln.length > CFG.chunk;
      if (cur && over && (RE_Q.test(ln) || !ln.trim() || cur.length > CFG.chunk * 1.3)) { out.push(cur); cur = ""; }
      cur += ln + "\n";
    });
    if (cur.trim()) out.push(cur);
    return out;
  }

  /* ───────── UI ───────── */
  var CSS = '#dqsd{position:fixed;inset:0;z-index:2147483000;background:#eef2f9;overflow:auto;font-family:inherit;color:#0f2d6b;-webkit-overflow-scrolling:touch}#dqsd[hidden]{display:none}' +
    '#dqsd *{box-sizing:border-box}.sd-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0f2d6b,#2456b3);color:#fff}.sd-top h2{margin:0;font-size:17px;flex:1}.sd-x{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:10px;width:38px;height:38px;font-size:20px;cursor:pointer}' +
    '.sd-wrap{max-width:900px;margin:0 auto;padding:14px}.sd-box{background:#fff;border:1px solid #dbe3f0;border-radius:16px;padding:12px;margin-bottom:14px;box-shadow:0 6px 18px rgba(15,45,107,.07)}.sd-lbl{font-weight:800;font-size:13px;margin:0 0 6px;display:block}' +
    '#dqsd textarea,#dqsd input[type=text]{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:inherit;font-size:14.5px;color:#0f172a;background:#fff;resize:vertical}#dqsd textarea:focus,#dqsd input[type=text]:focus{outline:2px solid #2456b3;border-color:#2456b3}' +
    '.sd-in{min-height:170px}.sd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.sd-b{border:0;border-radius:99px;padding:10px 18px;font:700 14px inherit;cursor:pointer;background:#e2e8f4;color:#1e3a8a}.sd-b.p{background:linear-gradient(135deg,#0f2d6b,#2456b3);color:#fff}.sd-b:disabled{opacity:.55;cursor:wait}' +
    '.sd-chk{font-size:13px;display:flex;gap:6px;align-items:center;color:#475569}.sd-st{font-size:13px;color:#475569;margin-top:8px;min-height:18px}.sd-st.err{color:#b91c1c}' +
    '.sd-card{background:#fff;border:1px solid #dbe3f0;border-radius:16px;padding:12px;margin-bottom:12px}.sd-card.warn{border-color:#f59e0b;background:#fffbeb}.sd-ch{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sd-ch b{background:#0f2d6b;color:#fff;border-radius:99px;min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;padding:0 8px}' +
    '.sd-n{flex:1;font-size:12px;color:#64748b;line-height:1.3}.sd-tools{display:flex;gap:4px}.sd-tools button,.sd-o button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;min-width:34px;height:34px;cursor:pointer;font-size:15px;color:#0f2d6b}' +
    '.sd-o{display:flex;align-items:center;gap:7px;margin-top:7px}.sd-o b{width:22px;text-align:center}.sd-o input[type=radio]{width:20px;height:20px;accent-color:#16a34a;flex:none}.sd-add{margin-top:8px}' +
    '.sd-sum{font-size:13px;color:#334155;margin:0 2px 10px;font-weight:600}.sd-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:99px;font-size:13.5px;z-index:2147483600;max-width:90vw}' +
    '.sd-fab{position:fixed;right:14px;bottom:84px;z-index:2147482000;border:0;border-radius:99px;padding:12px 16px;font:800 14px inherit;color:#fff;background:linear-gradient(135deg,#0f2d6b,#2456b3);box-shadow:0 10px 24px rgba(15,45,107,.35);cursor:pointer}';

  function build() {
    if (el.root) return;
    if (!document.getElementById("dqsd-css")) { var st = document.createElement("style"); st.id = "dqsd-css"; st.textContent = CSS; document.head.appendChild(st); }
    var r = document.createElement("div"); r.id = "dqsd"; r.hidden = true;
    r.innerHTML = '<div class="sd-top"><h2>✨ Sual Düzəldici</h2><button class="sd-x" data-a="close" aria-label="Bağla">✕</button></div>' +
      '<div class="sd-wrap"><div class="sd-box"><label class="sd-lbl" for="sd-in">Xam mətn (sual + variantlar; başlıq, səhifə nömrəsi və s. avtomatik atılır)</label>' +
      '<textarea id="sd-in" class="sd-in" placeholder="Sınaq səhifəsini və ya sualları buraya yapışdırın…"></textarea>' +
      '<label class="sd-lbl" for="sd-ex" style="margin-top:10px">Əlavə təlimat (istəyə görə)</label><input type="text" id="sd-ex" placeholder="məs.: rəsmi dövlət qulluğu üslubu; qanun maddələrini dəyişmə">' +
      '<div class="sd-row"><button class="sd-b" data-a="pdf">📄 PDF yüklə</button><input type="file" id="sd-pdf" accept="application/pdf,.pdf" hidden><button class="sd-b p" data-a="run">✨ Təhlil et və düzəlt</button><button class="sd-b" data-a="local">Yalnız format (AI-siz)</button><label class="sd-chk"><input type="checkbox" id="sd-app"> mövcudlara əlavə et</label></div><div class="sd-st" id="sd-st"></div></div>' +
      '<div id="sd-sum" class="sd-sum"></div><div id="sd-list"></div>' +
      '<div class="sd-box" id="sd-out" hidden><div class="sd-row" style="margin-top:0"><button class="sd-b" data-a="addq">+ Yeni sual</button><button class="sd-b" data-a="copy">📋 Mətn kimi kopyala</button><button class="sd-b" data-a="json">⬇ JSON</button><button class="sd-b p" data-a="save">📥 Bazaya göndər</button><button class="sd-b" data-a="clear">Təmizlə</button></div></div></div>';
    document.body.appendChild(r);
    el.root = r; el.in = $("#sd-in", r); el.ex = $("#sd-ex", r); el.st = $("#sd-st", r); el.list = $("#sd-list", r); el.sum = $("#sd-sum", r); el.out = $("#sd-out", r); el.app = $("#sd-app", r); el.pdf = $("#sd-pdf", r); el.pdf.addEventListener("change", function () { var f = el.pdf.files[0]; el.pdf.value = ""; if (f) readPdf(f); });
    r.addEventListener("click", onClick); r.addEventListener("input", onInput); r.addEventListener("change", onInput);
  }
  function toast(m) { var t = document.createElement("div"); t.className = "sd-toast"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function status(m, err) { el.st.textContent = m || ""; el.st.className = "sd-st" + (err ? " err" : ""); }
  function setBusy(b) { S.busy = b; el.root.querySelectorAll('[data-a="run"],[data-a="local"],[data-a="pdf"]').forEach(function (x) { x.disabled = b; }); }

  function render() {
    var warn = 0;
    el.list.innerHTML = S.items.map(function (it, i) {
      var fl = flags(it), bad = fl.length > 0; if (bad) warn++;
      return '<div class="sd-card' + (bad ? " warn" : "") + '" data-i="' + i + '"><div class="sd-ch"><b>' + (i + 1) + '</b><span class="sd-n">' + esc(it.n) + (fl.length ? '<br><b style="color:#b45309">⚠ ' + esc(fl.join(" · ")) + '</b>' : "") + '</span><div class="sd-tools">' +
        '<button data-a="ai" title="AI ilə yenidən yaz">✨</button><button data-a="up" title="Yuxarı">↑</button><button data-a="dn" title="Aşağı">↓</button><button data-a="del" title="Sil">🗑</button></div></div>' +
        '<textarea rows="2" data-f="q">' + esc(it.q) + '</textarea>' +
        it.o.map(function (x, j) {
          return '<div class="sd-o"><input type="radio" name="sd-a' + i + '" data-f="a" value="' + x.k + '"' + (it.a === x.k ? " checked" : "") + ' title="Doğru cavab"><b>' + x.k + '</b><input type="text" data-f="o" data-j="' + j + '" value="' + esc(x.t) + '"><button data-a="delopt" data-j="' + j + '" title="Variantı sil">×</button></div>';
        }).join("") +
        (it.o.length < LET.length ? '<button class="sd-b sd-add" data-a="addopt">+ Variant</button>' : "") + '</div>';
    }).join("");
    el.list.querySelectorAll("textarea").forEach(grow);
    el.out.hidden = !S.items.length;
    var noAns = S.items.filter(function (x) { return !x.a; }).length;
    el.sum.textContent = S.items.length ? (S.items.length + " sual" + (warn ? " · ⚠ " + warn + " sual yoxlanmalıdır (⚠)" : "") + (noAns ? " · " + noAns + " sualda doğru cavab seçilməyib" : "")) : "";
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 320) + "px"; }
  function idxOf(e) { var c = e.target.closest(".sd-card"); return c ? +c.getAttribute("data-i") : -1; }
  function reletter(it) { it.o.forEach(function (x, j) { x.k = LET[j]; }); }

  function onInput(e) {
    var f = e.target.getAttribute && e.target.getAttribute("data-f"), i = idxOf(e); if (!f || i < 0) return;
    var it = S.items[i];
    if (f === "q") { it.q = e.target.value; grow(e.target); }
    else if (f === "o") it.o[+e.target.getAttribute("data-j")].t = e.target.value;
    else if (f === "a" && e.type === "change") { it.a = e.target.value; }
  }
  async function onClick(e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a"), i = idxOf(e), it = i >= 0 ? S.items[i] : null;
    if (a === "close") close();
    else if (a === "pdf") el.pdf.click();
    else if (a === "run") run(true);
    else if (a === "local") run(false);
    else if (a === "addq") { S.items.push({ q: "", o: [{ k: "A", t: "" }, { k: "B", t: "" }, { k: "C", t: "" }, { k: "D", t: "" }], a: "", n: "Əl ilə əlavə olundu" }); render(); }
    else if (a === "clear") { if (confirm("Bütün siyahı silinsin?")) { S.items = []; render(); } }
    else if (a === "copy") copy();
    else if (a === "json") dl();
    else if (a === "save") save();
    else if (it) {
      if (a === "del") S.items.splice(i, 1);
      else if (a === "up" && i > 0) S.items.splice(i - 1, 0, S.items.splice(i, 1)[0]);
      else if (a === "dn" && i < S.items.length - 1) S.items.splice(i + 1, 0, S.items.splice(i, 1)[0]);
      else if (a === "addopt") { it.o.push({ k: LET[it.o.length], t: "" }); }
      else if (a === "delopt") {
        var j = +b.getAttribute("data-j"), ai = LET.indexOf(it.a);
        it.o.splice(j, 1); reletter(it);
        if (ai === j) it.a = ""; else if (ai > j) it.a = LET[ai - 1];
      } else if (a === "ai") { refine(i); return; }
      render();
    }
  }


  /* ───────── PDF oxuma (pdf.js; skan olunmuş PDF üçün OCR) ───────── */
  function loadScript(src) { return new Promise(function (ok, no) { var x = document.createElement("script"); x.src = src; x.onload = ok; x.onerror = function () { no(new Error("Kitabxana yüklənmədi — internet bağlantısını yoxlayın")); }; document.head.appendChild(x); }); }
  async function pdfLib() {
    if (!window.pdfjsLib) { if (window.__dqLibs) await window.__dqLibs("pdf"); else await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); }
    if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  function colLines(its) {
    var rows = [];
    its.forEach(function (it) {
      var y = it.transform[5], row = rows.filter(function (r) { return Math.abs(r.y - y) < 3; })[0];
      if (!row) { row = { y: y, parts: [] }; rows.push(row); }
      row.parts.push({ x: it.transform[4], w: it.width || 0, h: Math.abs(it.transform[3]) || it.height || 10, t: it.str });
    });
    return rows.sort(function (a, b) { return b.y - a.y; }).map(function (r) {
      var s = "", end = null;
      r.parts.sort(function (a, b) { return a.x - b.x; }).forEach(function (p) {
        if (end !== null && p.x - end > p.h * 0.18) s += " ";
        s += p.t; end = p.x + p.w;
      });
      return s.replace(/\s{2,}/g, " ").trim();
    }).filter(Boolean);
  }
  function pageLines(tc, W) {                          // iki sütunlu səhifələrdə əvvəl sol, sonra sağ sütun
    var its = tc.items.filter(function (it) {            // fırlanmış (su nişanı) mətnləri at
      var t = it.transform; return it.str && it.str.trim() && Math.abs(t[1]) < 0.1 * (Math.abs(t[0]) || 1) && Math.abs(t[2]) < 0.1 * (Math.abs(t[3]) || 1);
    });
    if (!W || its.length < 20) return colLines(its);
    var mid = W / 2, cross = 0, L = [], R = [];
    its.forEach(function (it) {
      var x = it.transform[4]; if (x < mid - W * 0.01 && x + (it.width || 0) > mid + W * 0.01) cross++;
      (x < mid ? L : R).push(it);
    });
    if (cross <= 4 && L.length > its.length * 0.2 && R.length > its.length * 0.2) return colLines(L).concat(colLines(R));
    return colLines(its);
  }
  function dropRepeats(pages) {                       // hər səhifədə təkrarlanan başlıq/altlıqları at
    var cnt = {}; pages.forEach(function (ls) { var seen = {}; ls.forEach(function (l) { var k = l.replace(/\d+/g, "#"); if (!seen[k]) { seen[k] = 1; cnt[k] = (cnt[k] || 0) + 1; } }); });
    var lim = Math.max(3, pages.length * 0.5);
    return pages.map(function (ls) { return ls.filter(function (l) { return !(pages.length >= 4 && cnt[l.replace(/\d+/g, "#")] >= lim && l.length < 90); }); });
  }
  async function ocrPages(pdf) {
    status("Skan edilmiş PDF — OCR hazırlanır (bir az vaxt apara bilər)…");
    if (!window.Tesseract) { if (window.__dqLibs) await window.__dqLibs("ocr"); else await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js"); }
    var out = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      status("OCR: səhifə " + p + "/" + pdf.numPages);
      var pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 2 }), cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      var r = await Tesseract.recognize(cv, "aze"); out.push(r.data.text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean));
    }
    return out;
  }
  async function readPdf(file) {
    setBusy(true);
    try {
      status("PDF açılır…"); await pdfLib();
      var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, pages = [], chars = 0;
      for (var p = 1; p <= pdf.numPages; p++) {
        status("PDF oxunur: səhifə " + p + "/" + pdf.numPages);
        var pg = await pdf.getPage(p), ls = pageLines(await pg.getTextContent(), pg.getViewport({ scale: 1 }).width); pages.push(ls); chars += ls.join("").length;
      }
      if (chars < 30 * pdf.numPages) pages = await ocrPages(pdf);
      var text = dropRepeats(pages).map(function (ls) { return ls.join("\n"); }).join("\n");
      if (!text.trim()) throw new Error("PDF-dən mətn çıxarıla bilmədi");
      el.in.value = text;
      status(pdf.numPages + " səhifə oxundu (" + text.length + " simvol). Mətni yoxlayıb «Təhlil et və düzəlt» düyməsini basın.");
    } catch (err) { status("PDF xətası: " + err.message, true); }
    setBusy(false);
  }

  /* ───────── əsas axın ───────── */
  async function run(useAI) {
    var text = el.in.value.trim(); if (!text) { toast("Əvvəlcə mətni yapışdırın"); return; }
    var sk = splitKey(text); text = sk.body.trim();
    setBusy(true); var got = [];
    try {
      if (!useAI) got = localParse(text);
      else {
        var parts = chunkText(text), res = new Array(parts.length), next = 0, done = 0, fatal = null;
        var worker = async function () {
          while (!fatal && next < parts.length) {
            var k = next++;
            try { res[k] = await ai({ mode: "extract", text: parts[k], extra: el.ex.value.trim() }); }
            catch (err) {
              if (/PIN/.test(err.message)) { fatal = err; return; }
              res[k] = localParse(parts[k]); toast("AI xətası (" + err.message + ") — " + (k + 1) + "-ci hissə yerli rejimdə işləndi");
            }
            status("AI işləyir… " + (++done) + "/" + parts.length + " hissə");
          }
        };
        status("AI işləyir… 0/" + parts.length + " hissə");
        await Promise.all([worker(), worker(), worker()]);
        if (fatal) throw fatal;
        res.forEach(function (x) { got = got.concat(x || []); });
      }
      var kmsg = "";
      if (sk.n && got.length) { var hit = applyKey(got, sk.key); kmsg = " Cavab açarı: " + hit + "/" + got.length + " sualın doğru cavabı avtomatik yazıldı" + (sk.n !== got.length ? " (açarda " + sk.n + " cavab, tapılan sual " + got.length + " — fərq var, yoxlayın)" : "") + "."; }
      if (!got.length) { status("Heç bir sual tapılmadı. Mətnin formatını yoxlayın.", true); }
      else { S.items = el.app.checked ? S.items.concat(got) : got; status("Hazırdır: " + got.length + " sual." + kmsg + " Aşağıda redaktə edə bilərsiniz."); render(); }
    } catch (err) { status(err.message, true); }
    setBusy(false);
  }
  function itemText(it) { return it.q + "\n" + it.o.map(function (x) { return x.k + ") " + x.t; }).join("\n"); }
  async function refine(i) {
    var it = S.items[i], ins = prompt("AI-yə təlimat (boş buraxsanız: daha peşəkar və qrammatik səhvsiz olsun):", "") ; if (ins === null) return;
    setBusy(true); status("Sual " + (i + 1) + " yenidən işlənir…");
    try {
      var r = await ai({ mode: "refine", text: itemText(it), extra: ins.trim() || el.ex.value.trim() });
      if (r[0]) { r[0].a = r[0].a || (it.o.length === r[0].o.length ? it.a : ""); S.items[i] = r[0]; render(); status("Sual " + (i + 1) + " yeniləndi."); }
      else status("AI cavab qaytarmadı.", true);
    } catch (err) { status(err.message, true); }
    setBusy(false);
  }
  function asText() {
    return S.items.map(function (it, n) { return (n + 1) + ". " + it.q + "\n" + it.o.map(function (x) { return x.k + ") " + x.t; }).join("\n") + (it.a ? "\nDoğru cavab: " + it.a : ""); }).join("\n\n");
  }
  function copy() {
    var t = asText();
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Kopyalandı"); }, function () { toast("Kopyalama alınmadı"); });
    else { var x = document.createElement("textarea"); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand("copy"); toast("Kopyalandı"); } catch (e) {} x.remove(); }
  }
  function dl() {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.items.map(function (x) { return { q: x.q, o: x.o, a: x.a }; }), null, 2)], { type: "application/json" }));
    a.download = "suallar.json"; document.body.appendChild(a); a.click(); a.remove();
  }
  function save() {
    var clean = S.items.map(function (x) { return { q: x.q.trim(), o: x.o.filter(function (v) { return v.t.trim(); }), a: x.a }; });
    if (typeof window.DQSD_SAVE === "function") { try { window.DQSD_SAVE(clean); toast("Bazaya göndərildi"); } catch (e) { toast("Xəta: " + e.message); } }
    else { document.dispatchEvent(new CustomEvent("dqsd:save", { detail: clean })); toast("Baza hələ qoşulmayıb — mətn/JSON kimi köçürün"); }
  }

  function open(txt) { build(); el.root.hidden = false; document.documentElement.style.overflow = "hidden"; if (typeof txt === "string") el.in.value = txt; }
  function close() { if (el.root) el.root.hidden = true; document.documentElement.style.overflow = ""; }

  document.addEventListener("keydown", function (e) { if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) { e.preventDefault(); open(); } });
  function init() {
    try { if (/[?&]sd=1\b/.test(location.search)) open(); } catch (e) {}
    try {
      if (localStorage.getItem("dq_sd_btn") === "1" && !document.getElementById("dqsd-fab")) {
        var f = document.createElement("button"); f.id = "dqsd-fab"; f.className = "sd-fab"; f.textContent = "✨ Sual düzəlt"; f.onclick = function () { open(); };
        if (!document.getElementById("dqsd-css")) { var s = document.createElement("style"); s.id = "dqsd-css"; s.textContent = CSS; document.head.appendChild(s); }
        document.body.appendChild(f);
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.DQSD = { _pageLines: pageLines, _drop: dropRepeats, _splitKey: splitKey, _applyKey: applyKey, _flags: flags, open: open, close: close, items: function () { return S.items; }, _local: localParse, _chunk: chunkText };
})();
