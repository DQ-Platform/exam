/* =====================================================================
   DQ PDF Seçim — dq-pdf-secim.js?v=3   (versiya 2 API-si: version, preview, buildDoc)
   «PDF-ə çevir» düyməsinə toxunanda seçim pəncərəsi + PEŞƏKAR PDF mühərriki:
     • Həqiqi A4 səhifələr (210×297 mm): hər səhifədə başlıq, altlıq «Səhifə X / N», filqran
     • Hər FƏNN YENİ SƏHİFƏDƏN başlayır (fənn zolağı ilə)
     • Sual heç vaxt iki səhifəyə / iki sütuna bölünmür
     • Variantlar mümkün olduqca YAN-YANA (A  B  C  D  E bir sətirdə); sığmasa 2 sütun; sığmasa alt-alta
     • Şəkillər ölçüyə görə avtomatik kiçildilir, səhifədən çıxmır
     • Açıq suallar (BA): ifadələr + «Cavab: ____»; cavab açarı ayrı səhifədə
   Qoşulma: app.js-dən SONRA (index.html-in sonunda).
   dq-sual-papka.js bu moduldan DQPdfSecim.buildDoc / preview istifadə edir.
   ===================================================================== */
(function () {
  "use strict";
  if (window.__dqPdfSecim) return;
  window.__dqPdfSecim = 1;

  var D = document, LET = ["A", "B", "C", "D", "E"], NAVY = "#0b2a6b", GOLD = "#c9a063", Z = 2147483100;
  var BYPASS = null, ST = null, CSS_ON = false, PV_URL = null, TAB_OPEN = false, EX_URL = null, ED_MSG = null;

  function $(i) { return D.getElementById(i); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("Server cavab vermədi (vaxt bitdi)")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function db() { try { return typeof _supabase !== "undefined" ? _supabase : null; } catch (e) { return null; } }
  function isTouch() {
    try { return (matchMedia("(pointer:coarse)").matches || "ontouchstart" in window) && Math.min(screen.width, screen.height) < 900; } catch (e) { return false; }
  }

  /* ---------------- Bazadan oxuma (vaxt limiti + təkrar) ---------------- */
  async function run(fn, tries) {
    tries = tries || 3;
    var last;
    for (var i = 0; i < tries; i++) {
      try {
        var r = await withTimeout(Promise.resolve(fn()), 25000);
        if (r && r.error) throw r.error;
        return (r && r.data) || [];
      } catch (e) {
        last = e;
        if (i < tries - 1) await sleep(700 * (i + 1));
      }
    }
    throw last || new Error("Sorğu alınmadı");
  }
  function listQ(c) {
    return run(function () {
      return db().from("exam_questions").select("q_number,subject").eq("exam_id", c.exam).eq("category", c.cat).order("q_number", { ascending: true });
    });
  }
  function fullQ(c, nums) {
    return run(function () {
      return db().from("exam_questions").select("q_number,subject,question,image_url,options,correct").eq("exam_id", c.exam).eq("category", c.cat).in("q_number", nums).order("q_number", { ascending: true });
    });
  }

  /* ---------------- Mətn təmizləmə (xam teqlər və &#39; göstərilməsin) ---------------- */
  function decodeEnt(s) {
    try { var t = D.createElement("textarea"); t.innerHTML = s; return t.value; } catch (e) { return s; }
  }
  function hasTag(s) { return /<\/?[a-z][^>]*>/i.test(s); }
  function fixEsc(s) {
    s = String(s == null ? "" : s);
    if (/&amp;(#\d+|#x[0-9a-f]+|[a-z]{2,8});/i.test(s)) s = s.replace(/&amp;(?=#\d+;|#x[0-9a-f]+;|[a-z]{2,8};)/gi, "&");
    if (/&lt;\/?(p|br|img|b|i|u|strong|em|sub|sup|span|table|tr|td|ul|ol|li)\b/i.test(s)) {
      s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    }
    if (!hasTag(s) && /&[#a-z0-9]+;/i.test(s)) s = decodeEnt(s);
    return s;
  }
  function basic(s) {
    if (!hasTag(s)) return "<p>" + esc(s).replace(/\n/g, "<br>") + "</p>";
    return s.replace(/<(?!\/?(p|br|b|i|u|strong|em|sub|sup|ul|ol|li|img|table|thead|tbody|tr|td|th)\b)[^>]*>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  }
  function clean(s) {
    s = fixEsc(s);
    try { if (typeof dqClean === "function") return dqClean(s); } catch (e) { }
    return basic(s);
  }
  function plainLen(s) {
    return String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/&[#a-z0-9]+;/gi, "x").replace(/\s+/g, " ").trim().length;
  }
  function safeSrc(u) {
    u = String(u || "").trim();
    return /^(https?:\/\/|data:image\/|blob:|\/|[\w.-]+\/)/i.test(u) ? u : "";
  }
  function optParts(o) {
    return (o && typeof o === "object") ? { t: o.text || "", i: o.image || o.img || null } : { t: o == null ? "" : o, i: null };
  }

  /* ---------------- Kontekst: düymədən Sınaq № və kateqoriya ---------------- */
  function ctxOf(btn) {
    var cat = "", total = 0, exam = "", n, t, m;
    for (n = btn.parentElement; n && n !== D.body && n !== D.documentElement; n = n.parentElement) {
      t = (n.textContent || "").replace(/\s+/g, " ");
      if (!cat) {
        m = /([A-Z]{2})\s*(\d+)\s*sual/.exec(t);
        if (m) { cat = m[1]; total = +m[2]; }
      }
      if (cat && !exam) {
        m = /Sınaq\s*(\d+)/.exec(t);
        if (m) { exam = m[1]; break; }
      }
    }
    return (cat && exam) ? { exam: exam, cat: cat, total: total } : null;
  }
  function readPageOpts() {
    var o = { key: true, heads: true, cols: 2 };
    try {
      [].forEach.call(D.querySelectorAll("label"), function (l) {
        var i = l.querySelector("input[type=checkbox]"), t = l.textContent || "";
        if (!i) return;
        if (/cavab\s*a[cç]ar/i.test(t)) o.key = i.checked;
        if (/f[əe]nn\s*ba[sş]l[ıi]q/i.test(t)) o.heads = i.checked;
      });
      [].forEach.call(D.querySelectorAll("select"), function (s) {
        var p = (s.parentElement && s.parentElement.textContent) || "";
        if (/s[üu]tun/i.test(p) && s.selectedIndex >= 0) {
          var m = /(\d)/.exec(s.options[s.selectedIndex].text || s.value);
          if (m && (+m[1] === 1 || +m[1] === 2)) o.cols = +m[1];
        }
      });
    } catch (e) { }
    return o;
  }

  /* ---------------- Fənlərə bölmə ---------------- */
  function subjOf(row) {
    var s = String(row.subject || "").trim();
    if (s) return s;
    try { if (typeof getSubjectByNumber === "function") return getSubjectByNumber(+row.q_number); } catch (e) { }
    return "Ümumi";
  }
  function groupRows(rows) {
    var map = {}, out = [];
    rows.forEach(function (r) {
      var k = subjOf(r);
      if (!map[k]) { map[k] = { name: k, nums: [], on: true }; out.push(map[k]); }
      map[k].nums.push(+r.q_number);
    });
    return out;
  }
  function isOpenQ(cat, n) {
    try { return cat === "BA" && Array.isArray(openQuestionIds) && openQuestionIds.indexOf(+n) > -1; } catch (e) { return false; }
  }
  function openOf(q, cat) { return q.__open != null ? !!q.__open : isOpenQ(cat, q.q_number); }
  function limOf(q) {
    if (q.__lim) return q.__lim;
    try { if (typeof dqOptLim === "function") return dqOptLim(+q.q_number) || 5; } catch (e) { }
    return 5;
  }
  function keyOf(q, cat) {
    var c = q.correct;
    if (openOf(q, cat)) return (c == null || c === "") ? "—" : String(c).toUpperCase();
    if (typeof c === "number" || /^\d+$/.test(String(c))) return LET[+c] || "—";
    return (c == null || c === "") ? "—" : String(c).toUpperCase();
  }

  /* =====================================================================
     PDF mühərriki — səhifələmə sənədin İÇİNDƏ (iframe / yeni səhifə) işləyir.
     Aşağıdakı funksiya sətrə çevrilib sənədə yerləşdirilir (closure istifadə etmir).
     ===================================================================== */
  function __layout() {
    var doc = document, src = doc.getElementById("src"), out = doc.getElementById("out"), tpl = doc.getElementById("tpl");
    var pages = [], cur = null, secs = [];
    out.innerHTML = "";

    function over(col) { return col.scrollHeight > col.clientHeight + 1; }

    function mkPage(sec, first) {
      var p = doc.createElement("div");
      p.className = "page";
      p.innerHTML = tpl.innerHTML;
      p.setAttribute("data-si", String(secs.indexOf(sec)));
      if (first) p.setAttribute("data-first", "1");
      var sbar = p.querySelector(".sbar"), colsEl = p.querySelector(".cols");
      var nc = +sec.getAttribute("data-cols") || 2, cols = [], i;
      var cover = sec.querySelector(":scope>.cover"), banner = sec.querySelector(":scope>.sb");
      if (first && cover) sbar.appendChild(cover.cloneNode(true));
      if (banner) {
        var b = banner.cloneNode(true);
        if (!first) { b.className = "sb cont"; var sm = b.querySelector("small"); if (sm) sm.textContent = "davamı"; }
        sbar.appendChild(b);
      }
      for (i = 0; i < nc; i++) {
        var c = doc.createElement("div");
        c.className = "col";
        colsEl.appendChild(c);
        cols.push(c);
      }
      out.appendChild(p);
      pages.push(p);
      cur = { page: p, cols: cols, ci: 0, sec: sec };
    }

    function advance() {
      if (cur.ci + 1 < cur.cols.length) { cur.ci++; return; }
      mkPage(cur.sec, false);
    }

    function fitOps(b) {
      var o = b.querySelector(".ops[data-auto]");
      if (o) o.className = "ops";          /* variantlar CSS flex-wrap ilə yan-yana düzülür */
    }

    function tighten(b) {
      b.classList.add("tight");
      var z = 1;
      while (z > 0.55 && b.parentNode && over(b.parentNode)) { z -= 0.05; b.style.zoom = z.toFixed(2); }
    }

    function place(b) {
      var guard = 0;
      while (guard++ < 400) {
        var col = cur.cols[cur.ci];
        col.appendChild(b);
        fitOps(b);
        if (!over(col)) return;
        col.removeChild(b);
        if (col.children.length === 0) {         /* tək özü sığmır → şəkilləri kiçilt */
          col.appendChild(b);
          fitOps(b);
          if (over(col)) tighten(b);
          return;
        }
        advance();
      }
    }

    sec_loop: {
      secs = [].slice.call(src.querySelectorAll(":scope>section"));
      secs.forEach(function (sec) {
        var blocks = [].slice.call(sec.children).filter(function (c) { return c.classList.contains("q") || c.classList.contains("kb"); });
        if (!blocks.length) return;
        mkPage(sec, true);
        blocks.forEach(place);
      });
    }

    var total = pages.length;
    [].forEach.call(out.querySelectorAll(".pg-n"), function (e, i) { e.textContent = String(i + 1); });
    [].forEach.call(out.querySelectorAll(".pg-t"), function (e) { e.textContent = String(total); });
    return total;
  }

  /* =====================================================================
     Word tipli redaktə rejimi — sənədin İÇİNDƏ işləyir (closure istifadə etmir).
     Alətlər paneli: geri/ irəli, şrift, ölçü, B/I/U/S, rəng, fon, hizalama, siyahı,
     başlıq/altlıq/filqran redaktoru, yenidən səhifələmə, HTML kimi saxlama.
     ===================================================================== */
  function __edit(layout) {
    var doc = document, body = doc.body, out = doc.getElementById("out"), src = doc.getElementById("src"), tpl = doc.getElementById("tpl");
    var ON = false, saved = null, savedHost = null;
    var EDIT_SEL = ".qt,.ot,.stm span,.cover h1,.cover p,.cover .sj,.sb span,.sb small,.kb h3,.kc i";
    function $(i) { return doc.getElementById(i); }
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    function each(l, f) { [].forEach.call(l, f); }

    /* ---------- alətlər paneli ---------- */
    var tb = doc.createElement("div");
    tb.id = "etb";
    tb.innerHTML =
      '<button data-c="undo" title="Geri al">↶</button><button data-c="redo" title="İrəli">↷</button><i class="sp"></i>' +
      '<select id="efont" title="Şrift"><option value="">Şrift</option><option value="Noto Serif">Noto Serif</option><option value="Roboto">Roboto</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option></select>' +
      '<select id="esize" title="Ölçü (pt)"><option value="">pt</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>24</option><option>28</option></select><i class="sp"></i>' +
      '<button data-c="bold" title="Qalın"><b>B</b></button><button data-c="italic" title="Kursiv"><em>I</em></button><button data-c="underline" title="Altından xətt"><u>U</u></button><button data-c="strikeThrough" title="Üstündən xətt"><s>S</s></button>' +
      '<button data-c="subscript" title="Aşağı indeks">x₂</button><button data-c="superscript" title="Yuxarı indeks">x²</button><i class="sp"></i>' +
      '<label class="clr" title="Mətn rəngi">A<input type="color" id="ecol" value="#0b2a6b"></label><label class="clr hl" title="Fon rəngi (marker)">▮<input type="color" id="ehl" value="#fff176"></label><i class="sp"></i>' +
      '<button data-c="justifyLeft" title="Sola">≡</button><button data-c="justifyCenter" title="Mərkəzə">☰</button><button data-c="justifyRight" title="Sağa">≣</button><button data-c="justifyFull" title="Hər iki tərəfə">▤</button><i class="sp"></i>' +
      '<button data-c="insertUnorderedList" title="Nişanlı siyahı">• ≡</button><button data-c="insertOrderedList" title="Nömrəli siyahı">1.≡</button><button data-c="removeFormat" title="Formatı təmizlə">⌫</button><i class="sp"></i>' +
      '<button data-a="reflow" id="erf" title="Mətn dəyişdikdən sonra səhifələri yenidən düz">↻ Səhifələ</button><button data-a="hf" title="Başlıq, altlıq və filqran">🧾 Başlıq/altlıq</button><button data-a="save" title="Redaktə olunmuş sənədi HTML kimi yüklə">💾 HTML</button><button data-a="reset" title="Bütün dəyişiklikləri ləğv et">↩ Sıfırla</button><button data-a="done" class="ok">✓ Bitir</button>';
    body.appendChild(tb);

    var eb = doc.createElement("button");
    eb.id = "ebtn"; eb.type = "button"; eb.textContent = "✏️ Redaktə";
    if (self !== top) eb.style.display = "none";
    body.appendChild(eb);

    /* ---------- seçimin saxlanması (düymələr fokusu aparmasın) ---------- */
    doc.addEventListener("selectionchange", function () {
      if (!ON) return;
      var s = doc.getSelection();
      if (!s || !s.rangeCount) return;
      var r = s.getRangeAt(0), n = r.commonAncestorContainer, el = n.nodeType === 1 ? n : n.parentNode;
      var host = el && el.closest ? el.closest('[contenteditable="true"]') : null;
      if (host) { saved = r.cloneRange(); savedHost = host; state(); }
    });
    function restore() {
      if (!saved || !savedHost) return false;
      try { savedHost.focus({ preventScroll: true }); } catch (e) { }
      var s = doc.getSelection();
      s.removeAllRanges(); s.addRange(saved);
      return true;
    }
    function state() {
      each(tb.querySelectorAll("button[data-c]"), function (b) {
        var c = b.getAttribute("data-c");
        if (/^(bold|italic|underline|strikeThrough|subscript|superscript|insertUnorderedList|insertOrderedList)$/.test(c)) {
          var on = false; try { on = doc.queryCommandState(c); } catch (e) { }
          b.classList.toggle("on", !!on);
        }
      });
    }
    function dirtyMark() { window.__dirty = true; }
    function exec(c, v) {
      if (!restore()) return;
      try { doc.execCommand("styleWithCSS", false, true); } catch (e) { }
      doc.execCommand(c, false, v == null ? null : v);
      dirtyMark(); state(); checkAll();
    }
    function applySize(pt) {
      if (!restore()) return;
      try { doc.execCommand("styleWithCSS", false, true); } catch (e) { }
      doc.execCommand("fontSize", false, "7");
      each(out.querySelectorAll('font[size="7"],[style*="xxx-large"]'), function (f) {
        if (f.tagName === "FONT") {
          var sp = doc.createElement("span");
          sp.style.fontSize = pt + "pt";
          while (f.firstChild) sp.appendChild(f.firstChild);
          f.parentNode.replaceChild(sp, f);
        } else f.style.fontSize = pt + "pt";
      });
      dirtyMark(); checkAll();
    }

    tb.addEventListener("mousedown", function (e) { if (!/^(SELECT|INPUT|OPTION)$/.test(e.target.tagName)) e.preventDefault(); });
    tb.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b) return;
      var c = b.getAttribute("data-c"), a = b.getAttribute("data-a");
      if (c) { if (c === "undo" || c === "redo") { restore(); doc.execCommand(c); dirtyMark(); checkAll(); } else exec(c); return; }
      if (a === "reflow") reflow();
      else if (a === "hf") openHF();
      else if (a === "save") download();
      else if (a === "reset") { if (confirm("Bütün dəyişikliklər ləğv edilsin və sənəd ilkin halına qayıtsın?")) { try { location.reload(); } catch (er) { } } }
      else if (a === "done") toggle(false);
    });
    $("efont").addEventListener("change", function () { if (this.value) exec("fontName", this.value); this.selectedIndex = 0; });
    $("esize").addEventListener("change", function () { if (this.value) applySize(+this.value); this.selectedIndex = 0; });
    $("ecol").addEventListener("input", function () { exec("foreColor", this.value); });
    $("ehl").addEventListener("input", function () { exec("hiliteColor", this.value); });

    /* ---------- redaktə rejimi ---------- */
    function markEd() {
      each(out.querySelectorAll(EDIT_SEL), function (e) { e.setAttribute("contenteditable", "true"); e.setAttribute("spellcheck", "false"); });
      each(out.querySelectorAll(".qn,.op b,.stm b,.kc b"), function (e) { e.setAttribute("contenteditable", "false"); });
    }
    function unmarkEd() {
      each(out.querySelectorAll("[contenteditable]"), function (e) { e.removeAttribute("contenteditable"); e.removeAttribute("spellcheck"); });
    }
    function toggle(v) {
      ON = v == null ? !ON : !!v;
      body.classList.toggle("ed", ON);
      if (ON) { markEd(); try { doc.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) { } }
      else { unmarkEd(); saved = null; savedHost = null; }
      eb.textContent = ON ? "✓ Redaktəni bitir" : "✏️ Redaktə";
      eb.classList.toggle("on", ON);
      try { parent.postMessage({ dqEd: ON }, "*"); } catch (e) { }
      return ON;
    }
    eb.addEventListener("click", function () { toggle(); });

    out.addEventListener("paste", function (e) {
      if (!ON) return;
      var cd = e.clipboardData || window.clipboardData;
      if (!cd) return;
      e.preventDefault();
      doc.execCommand("insertText", false, cd.getData("text/plain"));
    });
    out.addEventListener("input", function (e) {
      if (!ON) return;
      dirtyMark();
      var col = e.target && e.target.closest ? e.target.closest(".col") : null;
      if (col && col.scrollHeight > col.clientHeight + 1) warn(true); else checkAll();
    });
    out.addEventListener("click", function (e) { if (ON && e.target.closest && (e.target.closest(".ph") || e.target.closest(".pf"))) openHF(); });

    function warn(on) { var b = $("erf"); if (b) b.classList.toggle("warn", !!on); }
    function checkAll() {
      var any = false;
      each(out.querySelectorAll(".col"), function (c) { if (c.scrollHeight > c.clientHeight + 1) any = true; });
      warn(any);
    }

    /* ---------- yenidən səhifələmə: bloklar qaynağa qaytarılır, sonra təzədən düzülür ---------- */
    function reflow() {
      var was = ON;
      if (ON) unmarkEd();
      var secs = [].slice.call(src.querySelectorAll(":scope>section")), map = {};
      secs.forEach(function (sec, i) {
        var fp = out.querySelector('.page[data-si="' + i + '"][data-first="1"]');
        if (!fp) return;
        var cv = fp.querySelector(".sbar .cover"), sc = sec.querySelector(":scope>.cover");
        if (cv && sc) sc.innerHTML = cv.innerHTML;
        var bn = fp.querySelector(".sbar .sb:not(.cont)"), sb = sec.querySelector(":scope>.sb");
        if (bn && sb) sb.innerHTML = bn.innerHTML;
      });
      each(out.querySelectorAll(".page"), function (p) {
        var si = +p.getAttribute("data-si");
        each(p.querySelectorAll(".col>.q,.col>.kb"), function (b) { (map[si] || (map[si] = [])).push(b); });
      });
      secs.forEach(function (sec, i) {
        (map[i] || []).forEach(function (b) { b.style.zoom = ""; b.classList.remove("tight"); sec.appendChild(b); });
      });
      var t = layout();
      if (was) markEd();
      warn(false); checkAll();
      return t;
    }

    /* ---------- başlıq / altlıq / filqran ---------- */
    function pick(sel) {
      var e = out.querySelector(".page " + sel) || (tpl.content && tpl.content.querySelector(sel));
      return e ? e : null;
    }
    function txt(sel) { var e = pick(sel); return e ? e.textContent : ""; }
    function putHF(root, v) {
      function s(sel, fn) { var e = root.querySelector(sel); if (e) fn(e); }
      s(".ph .l", function (e) { e.textContent = v.hl; });
      s(".ph .c", function (e) { e.innerHTML = v.hc.split("|").map(function (x) { return esc(x.trim()); }).join("<i>|</i>"); });
      s(".ph .r", function (e) { e.textContent = v.hr; });
      s(".pf .l", function (e) { e.textContent = v.fl; });
      s(".pf .r", function (e) { e.textContent = v.fr; });
      s(".wm .t1", function (e) { e.textContent = v.w1; });
      s(".wm .t2", function (e) { e.textContent = v.w2; });
      s(".wm", function (e) { e.style.display = v.wm ? "" : "none"; });
    }
    function openHF() {
      var old = $("edlg"); if (old) old.remove();
      var wm = pick(".wm"), wmOn = !(wm && wm.style.display === "none");
      var d = doc.createElement("div"); d.id = "edlg";
      d.innerHTML = '<div class="box"><h3>Başlıq, altlıq və filqran</h3><p>Dəyişiklik <b>bütün səhifələrə</b> tətbiq olunur.</p>' +
        '<label>Başlıq — sol</label><input id="hf_hl" maxlength="60">' +
        '<label>Başlıq — mərkəz (hissələri | ilə ayırın)</label><input id="hf_hc" maxlength="80">' +
        '<label>Başlıq — sağ</label><input id="hf_hr" maxlength="60">' +
        '<label>Altlıq — sol</label><input id="hf_fl" maxlength="60">' +
        '<label>Altlıq — sağ</label><input id="hf_fr" maxlength="60">' +
        '<label>Filqran — böyük yazı</label><input id="hf_w1" maxlength="40">' +
        '<label>Filqran — kiçik yazı</label><input id="hf_w2" maxlength="40">' +
        '<label class="ck"><input type="checkbox" id="hf_wm"> Filqranı (loqo + yazı) göstər</label>' +
        '<div class="row"><button data-x="ok" class="ok">Tətbiq et</button><button data-x="no">Ləğv et</button></div></div>';
      body.appendChild(d);
      $("hf_hl").value = txt(".ph .l"); $("hf_hc").value = txt(".ph .c"); $("hf_hr").value = txt(".ph .r");
      $("hf_fl").value = txt(".pf .l"); $("hf_fr").value = txt(".pf .r");
      $("hf_w1").value = txt(".wm .t1"); $("hf_w2").value = txt(".wm .t2"); $("hf_wm").checked = wmOn;
      d.addEventListener("click", function (e) {
        var x = e.target.getAttribute && e.target.getAttribute("data-x");
        if (e.target === d || x === "no") { d.remove(); return; }
        if (x === "ok") {
          var v = { hl: $("hf_hl").value, hc: $("hf_hc").value, hr: $("hf_hr").value, fl: $("hf_fl").value, fr: $("hf_fr").value, w1: $("hf_w1").value, w2: $("hf_w2").value, wm: $("hf_wm").checked };
          if (tpl.content) putHF(tpl.content, v);
          each(out.querySelectorAll(".page"), function (p) { putHF(p, v); });
          dirtyMark(); d.remove();
        }
      });
    }

    /* ---------- statik HTML (redaktələrlə) ---------- */
    function exportStatic() {
      var was = ON;
      if (ON) unmarkEd();
      var clone = doc.documentElement.cloneNode(true);
      if (was) markEd();
      ["script", "#etb", "#ebtn", "#edlg", "#src", "#ld", "template"].forEach(function (sel) { each(clone.querySelectorAll(sel), function (e) { e.parentNode.removeChild(e); }); });
      var cb = clone.querySelector("body");
      cb.className = (cb.className || "").replace(/\bed\b/, "").trim();
      var s = doc.createElement("script");
      s.textContent = '(function(){var d=document,r=d.documentElement;function fit(){var w=r.clientWidth,z=w<830?(w-8)/794:1;r.style.zoom=String(z>0?z:1)}fit();addEventListener("resize",fit);addEventListener("beforeprint",function(){r.style.zoom="1"});addEventListener("afterprint",fit);var b=d.getElementById("pbtn");if(b)b.onclick=function(){print()};if(/#print/.test(location.hash))setTimeout(function(){try{print()}catch(e){}},600)})();';
      cb.appendChild(s);
      return "<!DOCTYPE html>" + clone.outerHTML;
    }
    function download() {
      try {
        var blob = new Blob([exportStatic()], { type: "text/html;charset=utf-8" }), a = doc.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = (doc.title || "DQplatform") + "-redakte.html";
        body.appendChild(a); a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) { } }, 1500);
      } catch (e) { alert("Yüklənmədi: " + e.message); }
    }

    window.__edToggle = toggle;
    window.__dqExport = exportStatic;
    window.__dqReflow = reflow;
    window.__dirty = false;
  }

  /* ---------------- sənədin üslubu ---------------- */
  function docCss() {
    return "" +
      "*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "html,body{margin:0;padding:0}" +
      "body{background:#dfe5f1;color:#1c2333;font-family:'Noto Serif','Source Serif 4',Georgia,'Times New Roman',serif;font-size:10.2pt;line-height:1.36;-webkit-text-size-adjust:100%}" +
      ".sans{font-family:'Roboto','Segoe UI',Arial,sans-serif}" +
      "#src{position:absolute;left:-99999px;top:0;width:800px;visibility:hidden}" +
      "#ld{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#dfe5f1;color:#0b2a6b;font:700 15px Roboto,Arial,sans-serif;z-index:50}" +
      "#out{padding:10px 0 80px}" +
      ".page{position:relative;width:210mm;height:296mm;margin:10px auto;background:#fff;overflow:hidden;box-shadow:0 6px 24px rgba(11,42,107,.2);page-break-after:always;break-after:page}" +
      /* filqran */
      ".wm{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}" +
      ".wm .em{position:absolute;left:50%;top:47%;width:78mm;height:78mm;margin:-39mm 0 0 -39mm;opacity:.075}" +
      ".wm .t1{position:absolute;left:0;right:0;top:55%;text-align:center;transform:rotate(-30deg);font:800 74pt 'Roboto',Arial,sans-serif;color:" + NAVY + ";opacity:.055;letter-spacing:1px}" +
      ".wm .t2{position:absolute;left:0;right:0;top:67%;text-align:center;transform:rotate(-30deg);font:italic 600 24pt 'Noto Serif',Georgia,serif;color:" + NAVY + ";opacity:.07}" +
      /* başlıq / altlıq */
      ".ph{position:absolute;z-index:2;top:8mm;left:13mm;right:13mm;height:13mm;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;border-bottom:.45mm solid " + NAVY + ";padding-bottom:1.8mm}" +
      ".ph .l{font:700 9.5pt 'Roboto','Segoe UI',Arial,sans-serif;color:" + NAVY + "}" +
      ".ph .c{font:italic 700 15pt 'Noto Serif',Georgia,serif;color:" + NAVY + ";letter-spacing:.2px;white-space:nowrap}.ph .c i{font-style:normal;color:" + GOLD + ";margin:0 1.4mm}" +
      ".ph .r{text-align:right;font:italic 700 10.5pt 'Noto Serif',Georgia,serif;color:" + NAVY + "}" +
      ".pf{position:absolute;z-index:2;bottom:7mm;left:13mm;right:13mm;height:7mm;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-top:.3mm solid " + GOLD + ";padding-top:1.6mm;font-size:8pt;color:#6b7690}" +
      ".pf .l,.pf .r{font-style:italic}.pf .r{text-align:right}.pf .c{font:700 8.6pt 'Roboto','Segoe UI',Arial,sans-serif;color:" + NAVY + "}" +
      /* gövdə */
      ".pb{position:absolute;z-index:1;top:24mm;bottom:17mm;left:13mm;right:13mm;display:flex;flex-direction:column}" +
      ".sbar:empty{display:none}.sbar{flex:none;margin:0 0 4.2mm}" +
      ".cover{border-radius:2.6mm;padding:4.6mm 6mm;margin:0 0 4.2mm;color:#fff;background:linear-gradient(120deg," + NAVY + ",#173f94);border-bottom:1.1mm solid " + GOLD + "}" +
      ".cover h1{margin:0 0 1mm;font:800 16.5pt 'Roboto','Segoe UI',Arial,sans-serif}.cover p{margin:0;font:500 9.2pt 'Roboto',Arial,sans-serif;opacity:.93}" +
      ".cover .sj{margin-top:1.4mm;font:500 8.6pt 'Roboto',Arial,sans-serif;color:#f1dcb8}" +
      ".sb{display:flex;align-items:center;justify-content:center;gap:3mm;background:" + NAVY + ";color:#fff;border-left:2.2mm solid " + GOLD + ";border-radius:1.8mm;padding:2.3mm 4mm;font:800 12.5pt 'Roboto','Segoe UI',Arial,sans-serif;letter-spacing:.3px}" +
      ".sb small{font:500 8.6pt 'Roboto',Arial,sans-serif;color:#f1dcb8}" +
      ".sb.cont{padding:1.2mm 4mm;font-size:9.5pt;justify-content:flex-start;background:#eef2fb;color:" + NAVY + ";border-left-color:" + GOLD + "}.sb.cont small{color:#64748b}" +
      ".cols{flex:1;min-height:0;display:flex}" +
      ".col{flex:1 1 0;min-width:0;height:100%;overflow:hidden;position:relative}" +
      ".col+.col{margin-left:6mm;padding-left:6mm;border-left:.3mm solid #d3d9e6}" +
      /* sual */
      ".q{margin-top:4.6mm;overflow-wrap:anywhere}.col>:first-child{margin-top:0}" +
      ".qh{display:flex;gap:2.2mm;align-items:flex-start}" +
      ".qn{flex:none;min-width:7.4mm;height:5.6mm;padding:0 1.6mm;margin-top:.5mm;border-radius:1.2mm;background:" + NAVY + ";color:#fff;font:800 8.6pt 'Roboto','Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center}" +
      ".qt{flex:1;min-width:0}.qt p,.ot p,.stm span p{margin:0 0 1mm}.qt p:last-child,.ot p:last-child{margin-bottom:0}" +
      "img{max-width:100%;height:auto;object-fit:contain}.qimg,.qt img{display:block;margin:1.6mm 0;max-height:74mm}" +
      ".tight .qimg,.tight .qt img{max-height:46mm}.tight .op img{max-height:14mm!important}" +
      "table{border-collapse:collapse;max-width:100%;margin:1mm 0}td,th{border:1px solid #b8c0d4;padding:.7mm 1.5mm;font-size:8.8pt}" +
      /* variantlar: yan-yana, yer qurtaranda aşağı sətrə keçir */
      ".ops{display:flex;flex-wrap:wrap;align-items:flex-start;gap:1.3mm 6mm;margin:1.8mm 0 0 0}" +
      ".op{display:flex;gap:1.7mm;align-items:flex-start;font-size:9.8pt;flex:0 1 auto;max-width:100%;margin:0}" +
      ".op b{flex:none;width:5mm;height:5mm;border-radius:50%;border:.28mm solid " + NAVY + ";color:" + NAVY + ";font:700 7.4pt 'Roboto','Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;margin-top:.5mm}" +
      ".ot{min-width:0;flex:0 1 auto}" +
      ".op img{max-height:24mm;display:block}" +
      /* açıq sual */
      ".stm{display:flex;gap:1.7mm;align-items:flex-start;margin:0 0 1mm;font-size:9.8pt}" +
      ".stm b{flex:none;min-width:4.6mm;font:800 9pt 'Roboto',Arial,sans-serif;color:" + NAVY + ";margin-top:.2mm}.stm span{min-width:0;flex:1}" +
      ".ans{margin-top:2.2mm;font:600 9.4pt 'Roboto',Arial,sans-serif;color:#475569;display:flex;align-items:flex-end;gap:2mm}.ans i{display:block;flex:0 1 46mm;border-bottom:.3mm solid #64748b;height:4.6mm}" +
      /* cavab açarı */
      ".kb{margin-top:5mm}.kb h3{margin:0 0 2.2mm;font:800 10.5pt 'Roboto','Segoe UI',Arial,sans-serif;color:" + NAVY + ";padding-bottom:1mm;border-bottom:.35mm solid " + GOLD + "}" +
      ".kg{display:grid;grid-template-columns:repeat(8,1fr);gap:1.6mm 2.4mm}" +
      ".kc{display:flex;justify-content:space-between;align-items:baseline;border:1px solid #d3d9e6;border-radius:1.4mm;padding:.9mm 2mm;font:500 9pt 'Roboto',Arial,sans-serif}.kc b{color:" + NAVY + "}.kc i{font-style:normal;font-weight:800}" +
      /* düymə */
      "#pbtn{position:fixed;right:14px;bottom:16px;z-index:60;border:0;border-radius:999px;background:" + NAVY + ";color:#fff;font:700 14px Roboto,Arial,sans-serif;padding:13px 20px;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer}" +
      /* redaktə rejimi */
      "#ebtn{position:fixed;left:14px;bottom:16px;z-index:60;border:0;border-radius:999px;background:#fff;color:" + NAVY + ";font:700 14px Roboto,Arial,sans-serif;padding:13px 18px;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer}#ebtn.on{background:" + GOLD + ";color:#1b2540}" +
      "#etb{position:fixed;left:0;right:0;top:0;z-index:70;display:none;align-items:center;gap:4px;padding:7px 8px;background:" + NAVY + ";overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;box-shadow:0 4px 16px rgba(0,0,0,.35)}body.ed #etb{display:flex}" +
      "#etb button,#etb select,#etb .clr{flex:none;height:36px;min-width:36px;border:0;border-radius:8px;padding:0 10px;background:rgba(255,255,255,.14);color:#fff;font:700 14px Roboto,Arial,sans-serif;cursor:pointer}" +
      "#etb select{background:#fff;color:#1c2333;padding:0 4px;max-width:112px}#etb button.on{background:" + GOLD + ";color:#1b2540}#etb .ok{background:#16a34a}" +
      "#etb .sp{flex:none;width:1px;height:22px;background:rgba(255,255,255,.28);margin:0 3px}" +
      "#etb .clr{position:relative;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;width:36px;padding:0;font-size:17px}#etb .clr input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}" +
      "#etb .clr.hl{color:#fff176}#erf.warn{background:#ef4444;animation:ep 1s ease-in-out infinite}@keyframes ep{50%{box-shadow:0 0 0 4px rgba(239,68,68,.4)}}" +
      "body.ed #out{padding-top:58px}" +
      "body.ed .page [contenteditable=true]{outline:1px dashed transparent;outline-offset:1px;border-radius:1mm;cursor:text;-webkit-user-select:text;user-select:text}" +
      "body.ed .page [contenteditable=true]:hover{outline-color:" + GOLD + ";background:rgba(201,160,99,.08)}" +
      "body.ed .page [contenteditable=true]:focus{outline:1.5px solid #2f63bd;background:rgba(47,99,189,.06)}" +
      "body.ed .ph,body.ed .pf{cursor:pointer;outline:1px dotted rgba(47,99,189,.45)}" +
      "#edlg{position:fixed;inset:0;z-index:90;background:rgba(11,18,32,.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Roboto,Arial,sans-serif}" +
      "#edlg .box{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:440px;max-height:92vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.4)}#edlg h3{margin:0 0 4px;font-size:17px;color:" + NAVY + "}#edlg p{margin:0 0 8px;font-size:13px;color:#64748b}" +
      "#edlg label{display:block;font-size:12px;font-weight:700;color:#475569;margin:10px 0 4px}#edlg input[type=text],#edlg input:not([type]){width:100%;padding:10px 11px;border:1.5px solid #cbd5e1;border-radius:9px;font:14px Roboto,Arial,sans-serif}" +
      "#edlg .ck{display:flex;align-items:center;gap:8px;font-size:13.5px;margin-top:12px}#edlg .row{display:flex;gap:8px;margin-top:16px}#edlg button{flex:1;border:0;border-radius:10px;padding:12px;font:700 14px Roboto,Arial,sans-serif;cursor:pointer;background:#e2e8f0;color:#1c2333}#edlg .ok{background:" + NAVY + ";color:#fff}" +
      "@page{size:A4;margin:0}" +
      "@media print{body{background:#fff}#out{padding:0}.page{margin:0;box-shadow:none}.page:last-child{page-break-after:auto;break-after:auto}#pbtn,#ld,#etb,#ebtn,#edlg{display:none!important}body.ed #out{padding:0}.page [contenteditable]{outline:none!important;background:none!important}}";
  }

  function emblem() {
    return '<svg class="em" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="94" fill="none" stroke="' + NAVY + '" stroke-width="6"/><circle cx="100" cy="100" r="82" fill="' + NAVY + '"/><circle cx="100" cy="100" r="72" fill="none" stroke="' + GOLD + '" stroke-width="2.5"/><text x="100" y="126" text-anchor="middle" font-size="76" font-weight="800" fill="' + GOLD + '" font-family="Georgia,serif">YS</text></svg>';
  }

  /* ---------------- sual blokları ---------------- */
  function qBlock(q, cat) {
    var n = q.q_number, open = openOf(q, cat), lim = limOf(q), h = [];
    h.push('<div class="q"><div class="qh"><span class="qn">' + esc(n) + '</span><div class="qt">' + clean(q.question));
    var src = safeSrc(q.image_url);
    if (src) h.push('<img class="qimg" src="' + esc(src) + '" alt="">');
    h.push("</div></div>");
    var opts = Array.isArray(q.options) ? q.options : [];
    if (open) {
      var any = false;
      opts.forEach(function (opt, i) {
        var p = optParts(opt), is = safeSrc(p.i);
        if (!String(p.t).trim() && !is) return;
        any = true;
        h.push('<div class="stm"><b>' + (i + 1) + '.</b><span>' + (String(p.t).trim() ? clean(p.t) : "") + (is ? '<img src="' + esc(is) + '" alt="">' : "") + "</span></div>");
      });
      h.push('<div class="ans">Cavab:<i></i></div>');
      if (!any) { /* yalnız cavab xətti */ }
    } else if (opts.length) {
      h.push('<div class="ops" data-auto="1">');
      opts.slice(0, lim).forEach(function (opt, i) {
        var p = optParts(opt), is = safeSrc(p.i);
        h.push('<div class="op"><b>' + LET[i] + '</b><div class="ot">' + (String(p.t).trim() ? clean(p.t) : "") + (is ? '<img src="' + esc(is) + '" alt="">' : "") + "</div></div>");
      });
      h.push("</div>");
    }
    h.push("</div>");
    return h.join("");
  }

  function buildDoc(o) {
    var cols = (o.opts && o.opts.cols === 1) ? 1 : 2;
    var heads = !o.opts || o.opts.heads !== false;
    var withKey = !o.opts || o.opts.key !== false;
    var total = 0, subjLine = [];
    o.groups.forEach(function (g) { total += g.items.length; subjLine.push(g.name + " (" + g.items.length + ")"); });
    var title = o.title || ("Sınaq " + o.exam + " · " + o.cat + " kateqoriyası");
    var sub = o.sub || ((o.mode === "all" ? "Ümumi sınaq" : "Seçilmiş fənlər") + " · " + total + " sual · " + new Date().toLocaleDateString("az-AZ"));
    var docName = o.docName || ("DQplatform-Sinaq" + (o.exam || "") + "-" + (o.cat || ""));

    var h = [];
    h.push('<!DOCTYPE html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
    h.push("<title>" + esc(docName) + "</title>");
    h.push('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    h.push('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,600;1,700&family=Roboto:wght@400;500;700;800&display=swap">');
    h.push("<style>" + docCss() + "</style></head><body>");
    h.push('<div id="ld">PDF səhifələnir…</div>');
    h.push('<template id="tpl"><div class="wm" aria-hidden="true">' + emblem() + '<div class="t1">DQplatform</div><div class="t2">Yunis İmanov</div></div>' +
      '<div class="ph"><div class="l">0504305162</div><div class="c">DQplatform<i>|</i>Dövlət Qulluğu</div><div class="r">Yunis İmanov</div></div>' +
      '<div class="pb"><div class="sbar"></div><div class="cols"></div></div>' +
      '<div class="pf"><div class="l">DQplatform</div><div class="c">Səhifə <span class="pg-n"></span> / <span class="pg-t"></span></div><div class="r">Yunis İmanov</div></div></template>');
    h.push('<div id="src">');
    o.groups.forEach(function (g, gi) {
      var f = g.items[0] && g.items[0].q_number, l = g.items[g.items.length - 1] && g.items[g.items.length - 1].q_number;
      h.push('<section data-cols="' + cols + '" data-name="' + esc(g.name) + '">');
      if (gi === 0) h.push('<div class="cover"><h1>' + esc(title) + "</h1><p>" + esc(sub) + '</p><div class="sj">' + esc(subjLine.join("  •  ")) + "</div></div>");
      if (heads) h.push('<div class="sb"><span>' + esc(g.name) + "</span><small>" + g.items.length + " sual" + (f != null && l != null ? " · " + f + "–" + l : "") + "</small></div>");
      g.items.forEach(function (q) { h.push(qBlock(q, o.cat)); });
      h.push("</section>");
    });
    if (withKey) {
      h.push('<section data-cols="1" data-name="Cavab açarı"><div class="sb"><span>Cavab açarı</span><small>' + total + " sual</small></div>");
      o.groups.forEach(function (g) {
        h.push('<div class="kb">' + (heads ? "<h3>" + esc(g.name) + "</h3>" : "") + '<div class="kg">');
        g.items.forEach(function (q) { h.push('<div class="kc"><b>' + esc(q.q_number) + "</b><i>" + esc(keyOf(q, o.cat)) + "</i></div>"); });
        h.push("</div></div>");
      });
      h.push("</section>");
    }
    h.push("</div>");
    h.push('<div id="out"></div><button type="button" id="pbtn">⬇ PDF kimi saxla</button>');
    h.push("<script>(" + boot.toString().replace(/<\/script/gi, "<\\/script") + ")(" + __layout.toString().replace(/<\/script/gi, "<\\/script") + "," + __edit.toString().replace(/<\/script/gi, "<\\/script") + ");<\/script>");
    h.push("</body></html>");
    return h.join("");
  }

  /* sənədin içindəki başlatma kodu: şəkillər/şriftlər yüklənəndən sonra səhifələyir */
  function boot(layout, edit) {
    var doc = document, root = doc.documentElement;
    function fit() {
      var w = root.clientWidth, z = w < 830 ? (w - 8) / 794 : 1;
      root.style.zoom = z > 0 ? String(z) : "1";
    }
    function wait() {
      var imgs = [].slice.call(doc.querySelectorAll("#src img")), jobs = imgs.map(function (im) {
        return new Promise(function (res) {
          if (im.complete) return res();
          im.addEventListener("load", res); im.addEventListener("error", function () { try { im.parentNode.removeChild(im); } catch (e) { } res(); });
        });
      });
      var fonts = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready.catch(function () { }) : Promise.resolve();
      return Promise.race([Promise.all(jobs.concat([fonts])), new Promise(function (r) { setTimeout(r, 14000); })]);
    }
    function go() {
      root.style.zoom = "1";
      try { layout(); }
      catch (e) { var s = doc.getElementById("src"); s.style.cssText = "position:static;visibility:visible;width:auto;padding:12mm"; doc.getElementById("out").style.display = "none"; }
      var ld = doc.getElementById("ld"); if (ld) ld.parentNode.removeChild(ld);
      try { if (edit) edit(layout); } catch (e) { }
      fit();
      if (/#print/.test(location.hash)) setTimeout(function () { try { print(); } catch (e) { } }, 500);
    }
    wait().then(function () { return new Promise(function (r) { setTimeout(r, 60); }); }).then(go);
    addEventListener("resize", fit);
    addEventListener("beforeprint", function () { root.style.zoom = "1"; });
    addEventListener("afterprint", fit);
    var b = doc.getElementById("pbtn");
    if (b) { if (self !== top) b.style.display = "none"; b.onclick = function () { print(); }; }
  }

  /* ---------------- Üslub (pəncərə + önbaxış) ---------------- */
  function css() {
    if (CSS_ON) return; CSS_ON = true;
    var s = D.createElement("style"); s.id = "dqps-css";
    s.textContent =
      "#dqps-ov{position:fixed;inset:0;z-index:" + Z + ";display:flex;align-items:flex-end;justify-content:center;background:rgba(10,15,40,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-family:Mulish,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;animation:dqpsF .2s ease both}" +
      "@media(min-width:560px){#dqps-ov{align-items:center;padding:16px}}" +
      "#dqps{width:100%;max-width:480px;max-height:92vh;display:flex;flex-direction:column;background:#fff;color:#1c2333;border-radius:22px 22px 0 0;box-shadow:0 -10px 50px rgba(10,10,30,.35);overflow:hidden;animation:dqpsU .3s cubic-bezier(.22,.9,.24,1) both}" +
      "@media(min-width:560px){#dqps{border-radius:22px}}" +
      "#dqps:before{content:'';height:4px;flex:none;background:linear-gradient(90deg," + NAVY + "," + GOLD + ")}" +
      "#dqps .hd{padding:16px 18px 6px;flex:none}#dqps h3{margin:0;font-size:19px;font-weight:800;color:" + NAVY + "}#dqps .sb2{margin:2px 0 0;font-size:13px;color:#64748b}" +
      "#dqps .bd{padding:8px 18px 4px;overflow:auto;-webkit-overflow-scrolling:touch;flex:1}" +
      "#dqps .seg{display:flex;gap:6px;background:#eef2fb;border-radius:14px;padding:4px;margin:6px 0 10px}" +
      "#dqps .seg button{flex:1;border:0;background:transparent;border-radius:11px;padding:11px 6px;font:700 13.5px inherit;font-family:inherit;color:#475569;cursor:pointer;transition:all .2s}" +
      "#dqps .seg button.on{background:" + NAVY + ";color:#fff;box-shadow:0 4px 12px rgba(11,42,107,.3)}" +
      "#dqps .tools{display:flex;justify-content:space-between;align-items:center;margin:2px 0 6px;font-size:12.5px;color:#64748b}#dqps .tools button{border:0;background:none;color:" + NAVY + ";font:700 12.5px inherit;font-family:inherit;padding:6px 4px;cursor:pointer}" +
      "#dqps .sj{display:flex;align-items:center;gap:11px;border:1.5px solid #e1e6f2;border-radius:14px;padding:11px 12px;margin:0 0 8px;cursor:pointer;background:#fbfcff;transition:border-color .15s,background .15s}" +
      "#dqps .sj.on{border-color:" + NAVY + ";background:#eef3ff}#dqps .sj input{width:20px;height:20px;accent-color:" + NAVY + ";flex:none}" +
      "#dqps .sj .nm{flex:1;font-weight:700;font-size:14.5px}#dqps .sj .ct{font-size:12.5px;color:#64748b;text-align:right;line-height:1.3}" +
      "#dqps .all{border:1.5px dashed #c9d3ea;border-radius:14px;padding:12px;font-size:13.5px;color:#475569;margin:0 0 8px;background:#fafbff}" +
      "#dqps .opt{display:flex;align-items:center;gap:10px;font-size:14px;margin:7px 0}#dqps .opt input[type=checkbox]{width:19px;height:19px;accent-color:" + NAVY + "}" +
      "#dqps .opt select{margin-left:auto;font:inherit;font-size:14px;border:1.5px solid #dfe2ee;border-radius:10px;padding:6px 8px;background:#fff}" +
      "#dqps hr{border:0;border-top:1px solid #e8ecf5;margin:10px 0}" +
      "#dqps .ft{flex:none;padding:10px 18px 16px;border-top:1px solid #eef1f8;background:#fff}#dqps .sum{font-size:13px;color:#475569;margin:0 0 8px;min-height:18px}" +
      "#dqps .rw{display:flex;gap:10px}#dqps .rw button{flex:1;font:800 15px inherit;font-family:inherit;border-radius:13px;padding:14px;cursor:pointer;border:1px solid #dfe2ee;background:#fff;color:#1c2333}" +
      "#dqps .rw button.ok{flex:1.7;background:" + NAVY + ";border-color:" + NAVY + ";color:#fff}#dqps .rw button:disabled{opacity:.5;cursor:not-allowed}" +
      "#dqps .old{display:block;text-align:center;margin:9px auto 0;border:0;background:none;color:#64748b;font:600 12px inherit;font-family:inherit;text-decoration:underline;cursor:pointer}" +
      "#dqps .err{background:#fff1f1;border:1px solid #f5c2c2;color:#b42318;border-radius:12px;padding:10px 12px;font-size:13px;margin:6px 0}" +
      "#dqps .pg{height:9px;border-radius:9px;background:#e6ebf6;overflow:hidden;margin:14px 0 8px}#dqps .pg i{display:block;height:100%;width:0;background:linear-gradient(90deg," + NAVY + "," + GOLD + ");transition:width .25s}" +
      "#dqps .ld{text-align:center;padding:26px 8px;color:#475569;font-size:14px}" +
      "#dqps-pv{position:fixed;inset:0;z-index:" + (Z + 1) + ";background:#dfe5f1;display:flex;flex-direction:column;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
      "#dqps-pv .bar{display:flex;align-items:center;gap:8px;padding:9px 10px;background:" + NAVY + ";color:#fff;flex:none;padding-top:max(9px,env(safe-area-inset-top))}" +
      "#dqps-pv .bar .t{flex:1;font-weight:700;font-size:14px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:center}" +
      "#dqps-pv .bar button{border:0;border-radius:11px;padding:10px 13px;font:800 13.5px inherit;font-family:inherit;cursor:pointer;background:rgba(255,255,255,.14);color:#fff;white-space:nowrap}" +
      "#dqps-pv .bar .r{display:flex;gap:6px;margin-left:auto}#dqps-pv .bar .g,#dqps-pv .bar .on{background:" + GOLD + ";color:#1b2540}" +
      "#dqps-pv iframe{flex:1;width:100%;border:0;background:#dfe5f1}#dqps-pv .ld{position:absolute;inset:56px 0 0;display:flex;align-items:center;justify-content:center;background:#dfe5f1;color:#334155;font-weight:700}" +
      "@media(max-width:480px){#dqps-pv .bar .t{display:none}}" +
      "@keyframes dqpsF{from{opacity:0}to{opacity:1}}@keyframes dqpsU{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}" +
      "@media(prefers-reduced-motion:reduce){#dqps-ov,#dqps{animation:none!important}}";
    D.head.appendChild(s);
  }

  /* ---------------- Seçim pəncərəsi ---------------- */
  function closeDlg() {
    if (ST) ST.cancel = true;
    var o = $("dqps-ov"); if (o) o.remove();
    D.removeEventListener("keydown", onKey, true);
    ST = null;
  }
  function onKey(e) { if (e.key === "Escape" && $("dqps-ov")) { e.preventDefault(); closeDlg(); } }

  function selected() {
    if (ST.mode === "all") return ST.groups;
    return ST.groups.filter(function (g) { return g.on; });
  }
  function countSel() { return selected().reduce(function (a, g) { return a + g.nums.length; }, 0); }

  function render() {
    var d = $("dqps"); if (!d || !ST) return;
    var c = ST.ctx, h = [];
    h.push('<div class="hd"><h3>PDF-ə çevir</h3><p class="sb2">Sınaq ' + esc(c.exam) + " · " + esc(c.cat) + (ST.rows ? " · " + ST.rows.length + " sual" : "") + "</p></div>");
    h.push('<div class="bd">');
    if (ST.stage === "load") {
      h.push('<div class="ld">Fənlər yüklənir…</div>');
    } else if (ST.stage === "err") {
      h.push('<div class="err">' + esc(ST.err) + "</div>");
    } else if (ST.stage === "make") {
      var pc = ST.total ? Math.round(ST.done / ST.total * 100) : 0;
      h.push('<div class="ld">Suallar hazırlanır… ' + ST.done + " / " + ST.total + '</div><div class="pg"><i style="width:' + pc + '%"></i></div>');
    } else {
      h.push('<div class="seg" role="tablist"><button type="button" data-m="all" class="' + (ST.mode === "all" ? "on" : "") + '">📚 Ümumi sınaq</button><button type="button" data-m="custom" class="' + (ST.mode === "custom" ? "on" : "") + '">🎯 Fənləri seçirəm</button></div>');
      if (ST.mode === "all") {
        h.push('<div class="all">Bütün fənlər birlikdə, sınaqdakı ardıcıllıqla çıxarılacaq (hər fənn yeni səhifədən): ' + ST.groups.map(function (g) { return esc(g.name); }).join(", ") + ".</div>");
      } else {
        h.push('<div class="tools"><span>Fənni toxunaraq seçin</span><span><button type="button" data-a="allon">Hamısı</button> · <button type="button" data-a="alloff">Heç biri</button></span></div>');
        ST.groups.forEach(function (g, i) {
          var f = g.nums[0], l = g.nums[g.nums.length - 1];
          h.push('<label class="sj ' + (g.on ? "on" : "") + '"><input type="checkbox" data-i="' + i + '"' + (g.on ? " checked" : "") + '><span class="nm">' + esc(g.name) + '</span><span class="ct">' + g.nums.length + " sual<br>" + f + "–" + l + "</span></label>");
        });
      }
      h.push("<hr>");
      h.push('<label class="opt"><input type="checkbox" id="dqps-k"' + (ST.opts.key ? " checked" : "") + '> Sonda cavab açarı əlavə et</label>');
      h.push('<label class="opt"><input type="checkbox" id="dqps-h"' + (ST.opts.heads ? " checked" : "") + '> Fənn başlıqları</label>');
      h.push('<label class="opt">Sütun sayı<select id="dqps-c"><option value="2"' + (ST.opts.cols === 2 ? " selected" : "") + '>2 sütun</option><option value="1"' + (ST.opts.cols === 1 ? " selected" : "") + ">1 sütun</option></select></label>");
      if (ST.err) h.push('<div class="err">' + esc(ST.err) + "</div>");
    }
    h.push("</div>");
    var n = ST.stage === "ready" ? countSel() : 0;
    h.push('<div class="ft">');
    if (ST.stage === "ready") h.push('<p class="sum">Seçilib: <b>' + selected().length + " fənn · " + n + " sual</b></p>");
    h.push('<div class="rw"><button type="button" data-a="close">' + (ST.stage === "make" ? "Dayandır" : "Ləğv et") + "</button>");
    if (ST.stage === "ready") h.push('<button type="button" class="ok" data-a="go"' + (n ? "" : " disabled") + ">PDF yarat</button>");
    if (ST.stage === "err") h.push('<button type="button" class="ok" data-a="retry">Yenidən cəhd et</button>');
    h.push("</div>");
    if (ST.stage !== "make") h.push('<button type="button" class="old" data-a="old">Köhnə üsulla çevir (bütün sınaq)</button>');
    h.push("</div>");
    d.innerHTML = h.join("");
  }

  function readOptsFromDlg() {
    var k = $("dqps-k"), hd = $("dqps-h"), c = $("dqps-c");
    if (k) ST.opts.key = k.checked;
    if (hd) ST.opts.heads = hd.checked;
    if (c) ST.opts.cols = +c.value === 1 ? 1 : 2;
  }

  async function loadList() {
    ST.stage = "load"; ST.err = ""; render();
    try {
      if (!db()) throw new Error("Verilənlər bazası bağlantısı hazır deyil. Səhifəni yeniləyin.");
      var rows = await listQ(ST.ctx);
      if (!ST || ST.dead) return;
      if (!rows.length) throw new Error("Bu sınaq və kateqoriya üçün bazada sual tapılmadı.");
      ST.rows = rows; ST.groups = groupRows(rows); ST.stage = "ready"; render();
    } catch (e) {
      if (!ST) return;
      ST.stage = "err"; ST.err = "Suallar siyahısı alınmadı: " + (e && e.message || e); render();
    }
  }

  async function make() {
    readOptsFromDlg();
    var sel = selected(), nums = [];
    sel.forEach(function (g) { nums = nums.concat(g.nums); });
    if (!nums.length) return;
    ST.stage = "make"; ST.err = ""; ST.total = nums.length; ST.done = 0; ST.cancel = false; render();
    var chunks = [], i, SZ = 8;
    for (i = 0; i < nums.length; i += SZ) chunks.push(nums.slice(i, i + SZ));
    var got = {}, st = ST, idx = 0, fail = null;
    async function worker() {
      while (!fail && !st.cancel) {
        var my = idx++; if (my >= chunks.length) return;
        try {
          var rows = await fullQ(st.ctx, chunks[my]);
          rows.forEach(function (r) { got[r.q_number] = r; });
          st.done += chunks[my].length;
          if (ST === st) { var b = D.querySelector("#dqps .ld"), p = D.querySelector("#dqps .pg i"); if (b) b.textContent = "Suallar hazırlanır… " + Math.min(st.done, st.total) + " / " + st.total; if (p) p.style.width = Math.round(Math.min(st.done, st.total) / st.total * 100) + "%"; }
        } catch (e) { fail = e; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (ST !== st || st.cancel) return;
    if (fail) { st.stage = "ready"; st.err = "Suallar tam yüklənmədi: " + (fail.message || fail) + ". Yenidən cəhd edin."; render(); return; }
    var groups = sel.map(function (g) {
      return { name: g.name, items: g.nums.map(function (n) { return got[n]; }).filter(Boolean) };
    }).filter(function (g) { return g.items.length; });
    if (!groups.length) { st.stage = "ready"; st.err = "Seçilmiş fənlər üzrə sual tapılmadı."; render(); return; }
    var html;
    try {
      html = buildDoc({ exam: st.ctx.exam, cat: st.ctx.cat, mode: st.mode, groups: groups, opts: st.opts });
    } catch (e) { st.stage = "ready"; st.err = "PDF sənədi qurulmadı: " + (e && e.message || e); render(); return; }
    var title = "Sınaq " + st.ctx.exam + " · " + st.ctx.cat + (st.mode === "all" ? " · Ümumi" : " · Seçilmiş fənlər");
    closeDlg();
    showPreview(html, title);
  }

  /* ---------------- Önbaxış ---------------- */
  function closePreview() {
    var p = $("dqps-pv"); if (p) p.remove();
    if (PV_URL && !TAB_OPEN) { try { URL.revokeObjectURL(PV_URL); } catch (e) { } }
    PV_URL = null; TAB_OPEN = false;
    if (EX_URL) { try { URL.revokeObjectURL(EX_URL); } catch (e) { } EX_URL = null; }
    if (ED_MSG) { window.removeEventListener("message", ED_MSG); ED_MSG = null; }
  }
  function showPreview(html, title) {
    css(); closePreview();
    PV_URL = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    var o = D.createElement("div"); o.id = "dqps-pv";
    o.innerHTML = '<div class="bar"><button type="button" id="dqps-x">⬅ Geri</button><span class="t">' + esc(title) + '</span><div class="r"><button type="button" id="dqps-ed" title="Sənədi Word kimi redaktə et">✏️ Redaktə</button><button type="button" id="dqps-ad" title="Admin panelə qayıt">🛠 Admin panel</button><button type="button" class="g" id="dqps-dl">⬇ Yüklə (PDF)</button><button type="button" id="dqps-tab" title="Ayrıca səhifədə aç">↗</button></div></div><iframe id="dqps-fr" title="PDF önbaxış"></iframe><div class="ld" id="dqps-ld">Önbaxış hazırlanır…</div>';
    D.body.appendChild(o);
    var fr = $("dqps-fr");
    fr.onload = function () { var l = $("dqps-ld"); if (l) setTimeout(function () { var l2 = $("dqps-ld"); if (l2) l2.remove(); }, 500); };
    fr.src = PV_URL;
    function curUrl() {
      try {
        var w = fr.contentWindow;
        if (w && w.__dirty && w.__dqExport) {            /* redaktə olunubsa: dəyişikliklərlə statik sənəd */
          if (EX_URL) { try { URL.revokeObjectURL(EX_URL); } catch (e) { } }
          EX_URL = URL.createObjectURL(new Blob([w.__dqExport()], { type: "text/html;charset=utf-8" }));
          return EX_URL;
        }
      } catch (e) { }
      return PV_URL;
    }
    function openTab(autoPrint) {
      var w = window.open(curUrl() + (autoPrint ? "#print" : ""), "_blank");
      if (w) TAB_OPEN = true; else alert("Yeni səhifə açılmadı. Brauzerdə pop-up icazəsi verin.");
      return !!w;
    }
    $("dqps-x").onclick = closePreview;
    $("dqps-ad").onclick = function () {
      closePreview();
      try { if (window.DQNav && DQNav.toAdmin) return DQNav.toAdmin(); } catch (e) { }
      try { if (window.DQAdminFix && DQAdminFix.central) DQAdminFix.central(); } catch (e) { }
    };
    $("dqps-tab").onclick = function () { openTab(false); };
    var edb = $("dqps-ed");
    edb.onclick = function () {
      try { var on = fr.contentWindow.__edToggle(); edb.classList.toggle("on", !!on); edb.textContent = on ? "✓ Redaktə" : "✏️ Redaktə"; }
      catch (e) { alert("Sənəd hələ hazır deyil, bir az gözləyin."); }
    };
    if (ED_MSG) window.removeEventListener("message", ED_MSG);
    ED_MSG = function (ev) {
      if (!ev.data || typeof ev.data.dqEd !== "boolean" || !$("dqps-ed")) return;
      edb.classList.toggle("on", ev.data.dqEd); edb.textContent = ev.data.dqEd ? "✓ Redaktə" : "✏️ Redaktə";
    };
    window.addEventListener("message", ED_MSG);
    $("dqps-dl").onclick = function () {
      if (isTouch()) { if (openTab(true)) return; }
      try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { openTab(true); }
    };
  }

  /* ---------------- Başlanğıc ---------------- */
  function openDlg(ctx, btn) {
    css(); closeDlg();
    ST = { ctx: ctx, btn: btn, mode: "all", opts: readPageOpts(), stage: "load", groups: [], rows: null, err: "", cancel: false };
    var o = D.createElement("div"); o.id = "dqps-ov";
    o.innerHTML = '<div id="dqps" role="dialog" aria-modal="true" aria-label="PDF seçimi"></div>';
    D.body.appendChild(o);
    o.addEventListener("pointerdown", function (e) { if (e.target === o) closeDlg(); });
    o.addEventListener("click", function (e) {
      if (!ST) return;
      var t = e.target.closest ? e.target.closest("[data-a],[data-m]") : null;
      if (!t) return;
      if (t.dataset.m) { readOptsFromDlg(); ST.mode = t.dataset.m; ST.err = ""; render(); return; }
      var a = t.dataset.a;
      if (a === "close") closeDlg();
      else if (a === "allon" || a === "alloff") { readOptsFromDlg(); ST.groups.forEach(function (g) { g.on = a === "allon"; }); render(); }
      else if (a === "go") make();
      else if (a === "retry") loadList();
      else if (a === "old") { var b = ST.btn; closeDlg(); BYPASS = b; try { b.click(); } finally { BYPASS = null; } }
    });
    o.addEventListener("change", function (e) {
      if (!ST) return;
      var t = e.target;
      if (t && t.dataset && t.dataset.i != null) { readOptsFromDlg(); ST.groups[+t.dataset.i].on = t.checked; ST.err = ""; render(); }
    });
    D.addEventListener("keydown", onKey, true);
    loadList();
  }

  window.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button,a,[role=button]") : null;
    if (!b || b === BYPASS || b.disabled) return;
    if (b.closest && b.closest("#dqps-ov,#dqps-pv")) return;
    var tx = (b.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^[^A-Za-z]*PDF\s*-\s*[əe]\s*[çc]evir\s*$/i.test(tx)) return;
    var ctx = ctxOf(b);
    if (!ctx) return;                       /* kontekst tapılmadı → köhnə davranış */
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    openDlg(ctx, b);
  }, true);

  window.DQPdfSecim = { version: 2, open: openDlg, ctxOf: ctxOf, buildDoc: buildDoc, preview: showPreview, closePreview: closePreview, groupRows: groupRows, clean: clean, keyOf: keyOf };
})();
