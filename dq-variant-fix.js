/*! DQ Variant Fix v2
 *  1) Qapalı suallarda (Qanunvericilik istisna) 5 variant (A–E) həmişə göstərilir,
 *     o cümlədən şəkil kimi əlavə edilmiş E variantı.
 *  2) Açıq suallarda (BA kateqoriyası) çoxseçimli cavab seçicisi.
 *  3) Yoxlama Rejimi: sınaq siyahısı bütün sınaqları göstərir (yalnız 1-ci sualı olanları yox).
 *  Heç bir mövcud faylı dəyişmir; index.html-də app.js-dən SONRA yüklənməlidir.
 */
(function () {
  "use strict";
  if (window.__dqVarFix) return;
  window.__dqVarFix = true;

  var LET = ["A", "B", "C", "D", "E"];
  var STATE = ["selected", "active", "checked", "on", "is-selected", "is-checked", "sel", "chosen"];
  var busy = false, timer = 0;

  function safe(fn, d) { try { return fn(); } catch (e) { return d; } }

  /* ---------- cari sualın konteksti (app.js qlobalları) ---------- */
  function ctx() {
    var list = safe(function () { return getActiveReviewQuestions(); }, null) ||
               safe(function () { return allQuestions; }, null);
    if (!list || !list.length) return null;
    var idx = safe(function () { return currentQuestionIndex; }, 0);
    var q = list[idx];
    if (!q) return null;
    var n = q.id || idx + 1;
    var group = safe(function () { return userGroup; }, "");
    var open = group === "BA" && safe(function () { return openQuestionIds.indexOf(n) > -1; }, false);
    var lim = safe(function () { return dqOptLim(n); }, (n >= 16 && n <= 55) ? 4 : 5);
    var review = safe(function () { return isReviewMode === true; }, false);
    return { q: q, n: n, open: open, lim: lim, review: review };
  }

  function has(o) {
    if (o && typeof o === "object") return !!(String(o.text || "").trim() || o.image);
    return !!String(o == null ? "" : o).trim();
  }
  function optHtml(o) {
    var t = (o && typeof o === "object") ? (o.text || "") : String(o == null ? "" : o);
    return safe(function () { return dqClean(t); }, t);
  }
  function optImg(o) { return (o && typeof o === "object" && o.image) ? o.image : null; }

  function visible(e) {
    var s = getComputedStyle(e);
    return s.display !== "none" && s.visibility !== "hidden";
  }

  /* ---------- variant elementlərini tap ---------- */
  function optionEls(root) {
    var els = [];
    var box = root.querySelector(".options");
    if (box) {
      els = [].filter.call(box.children, function (e) {
        return e.nodeType === 1 && (e.querySelector('input[type="radio"]') ||
          e.matches("[data-idx],[data-i],[role=radio],button,label"));
      });
    }
    if (!els.length) {
      var seen = [];
      [].forEach.call(root.querySelectorAll('input[type="radio"][name^="opt-"]'), function (r) {
        var el = r.closest("label,li,.option,[class*=opt],[class*=card]") || r.parentElement;
        if (el && seen.indexOf(el) < 0) seen.push(el);
      });
      els = seen;
    }
    return els;
  }

  /* ---------- D elementinin surətindən E düzəlt ---------- */
  function buildClone(src, idx, c, opts) {
    var prev = idx - 1, L0 = LET[prev], L1 = LET[idx];
    var n = src.cloneNode(true);
    n.setAttribute("data-dq-extra", "1");
    var all = [n].concat([].slice.call(n.querySelectorAll("*")));

    all.forEach(function (e) {
      [].slice.call(e.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase(), v = a.value;
        if (/^(value|data-(idx|i|k|index|opt|n|val|value))$/.test(nm) && v === String(prev)) {
          e.setAttribute(a.name, String(idx));
        } else if (/^data-(l|letter|label|opt-letter)$/.test(nm) && v.toUpperCase() === L0) {
          e.setAttribute(a.name, L1);
        } else if (nm.indexOf("on") === 0) {
          e.setAttribute(a.name, v.replace(/\(\s*(\d+)\s*(,|\))/, function (m, d, t) {
            return d === String(prev) ? "(" + idx + t : m;
          }));
        } else if (nm === "id" || nm === "for") {
          e.setAttribute(a.name, v.replace(new RegExp("(^|[^0-9])" + prev + "$"), "$1" + idx));
        }
      });
      STATE.forEach(function (k) { e.classList.remove(k); });
    });

    /* hərf mətni: D) → E) */
    var tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null), nodes = [], t;
    while ((t = tw.nextNode())) nodes.push(t);
    nodes.forEach(function (tn) {
      var s = tn.nodeValue, tr = s.trim();
      if (tr === L0 || tr === L0 + ")" || tr === L0 + "." || tr === L0 + ":") tn.nodeValue = s.replace(L0, L1);
    });

    /* mətn */
    var ot = n.querySelector(".dq-ot");
    var prevHtml = optHtml(opts[prev]).trim();
    if (ot) {
      ot.innerHTML = optHtml(opts[idx]);
    } else if (prevHtml) {
      var cand = [].filter.call(n.querySelectorAll("*"), function (e) { return e.innerHTML.trim() === prevHtml; });
      if (cand.length) cand[cand.length - 1].innerHTML = optHtml(opts[idx]);
    }

    /* şəkil */
    var image = optImg(opts[idx]);
    var imgs = [].slice.call(n.querySelectorAll("img"));
    if (image) {
      if (imgs.length) {
        imgs[0].src = image; imgs[0].removeAttribute("srcset");
        imgs.slice(1).forEach(function (i) { i.remove(); });
      } else {
        var im = document.createElement("img");
        im.className = "opt-preview-img"; im.style.marginLeft = "auto";
        im.alt = "Variant " + L1; im.src = image;
        n.appendChild(im);
      }
    } else {
      imgs.forEach(function (i) { i.remove(); });
    }

    /* seçilmiş vəziyyət */
    var sel = safe(function () { return userAnswers[c.n] === idx; }, false);
    var r = n.querySelector('input[type="radio"]');
    if (r) {
      r.checked = sel;
      if (sel) r.setAttribute("checked", "checked"); else r.removeAttribute("checked");
    }
    if (sel) n.classList.add("selected");

    n.addEventListener("click", function () {
      if (c.review || safe(function () { return examFinished; }, false)) return;
      var rr = n.querySelector('input[type="radio"]');
      if (rr) {
        if (!rr.checked) { rr.checked = true; rr.dispatchEvent(new Event("change", { bubbles: true })); }
      } else {
        safe(function () { selectOption(idx, c.n); });
      }
      setTimeout(syncSel, 0);
    });
    return n;
  }

  /* E elementinin seçim sinfi digərləri ilə sinxron qalsın */
  function syncSel() {
    var root = document.getElementById("single-question-container");
    if (!root) return;
    var extras = root.querySelectorAll("[data-dq-extra]");
    if (!extras.length) return;
    var els = optionEls(root);
    var learned = [];
    els.forEach(function (e) {
      if (e.hasAttribute("data-dq-extra")) return;
      var r = e.querySelector('input[type="radio"]');
      if (r && r.checked) STATE.forEach(function (k) { if (e.classList.contains(k)) learned.push(k); });
    });
    if (!learned.length) learned = ["selected"];
    [].forEach.call(extras, function (x) {
      var r = x.querySelector('input[type="radio"]');
      var on = r ? r.checked : false;
      STATE.forEach(function (k) { x.classList.remove(k); });
      if (on) {
        learned.forEach(function (k) { x.classList.add(k); });
        els.forEach(function (e) {
          if (e !== x) STATE.forEach(function (k) { e.classList.remove(k); });
        });
      }
    });
  }

  function unhide(el, refDisplay) {
    if (!visible(el)) {
      var s = getComputedStyle(el);
      if (s.display === "none") el.style.setProperty("display", refDisplay, "important");
      if (s.visibility === "hidden") el.style.setProperty("visibility", "visible", "important");
    }
  }

  /* ---------- 1) qapalı suallarda 5 variant ---------- */
  function ensureFive(root, c) {
    if (c.lim !== 5) return;                       // Qanunvericilik: 4 variant
    var opts = Array.isArray(c.q.options) ? c.q.options : [];
    var last = -1;
    for (var i = 0; i < Math.min(opts.length, 5); i++) if (has(opts[i])) last = i;
    var want = last + 1;
    if (want < 1) return;

    var els = optionEls(root);
    if (!els.length) return;

    var ref = els.filter(visible)[0];
    var disp = ref ? getComputedStyle(ref).display : "flex";
    if (disp === "none") disp = "flex";
    for (var k = 0; k < Math.min(want, els.length); k++) unhide(els[k], disp);

    var guard = 0;
    while (els.length < want && guard++ < 5) {
      var idx = els.length, src = els[els.length - 1];
      var clone = buildClone(src, idx, c, opts);
      src.parentNode.insertBefore(clone, src.nextSibling);
      els.push(clone);
    }
  }

  /* ---------- 2) açıq suallarda çoxseçimli seçici ---------- */
  function fixOpen(root, c) {
    var inp = root.querySelector('input[oninput*="selectOpenAnswer"]');
    if (!inp) return;
    var host = inp.closest(".form-group") || inp.parentElement;
    var panel = host.querySelector(".dq-mc");
    if (!panel) {
      panel = buildPanel(inp, c);
      host.appendChild(panel);
    }
    syncChips(panel, inp);
  }

  function modeOf(c) {
    var corr = String(c.q.correct == null ? "" : c.q.correct).trim().toUpperCase();
    var letters = /^[A-F]([\s,;]*[A-F])*$/.test(corr);
    var m = corr.match(/[,;]\s*|\s+/);
    var sep = m ? m[0] : "";
    var max = 5;
    var found = corr.match(letters ? /[A-F]/g : /[1-9]/g) || [];
    found.forEach(function (t) {
      var v = letters ? LET.concat(["F"]).indexOf(t) + 1 : +t;
      if (v > max) max = v;
    });
    max = Math.min(max, letters ? 6 : 9);
    var tokens = [];
    for (var i = 0; i < max; i++) tokens.push(letters ? "ABCDEF".charAt(i) : String(i + 1));
    return { letters: letters, sep: sep, tokens: tokens };
  }

  function buildPanel(inp, c) {
    var md = modeOf(c);
    var wrap = document.createElement("div");
    wrap.className = "dq-mc";
    wrap.style.cssText = "margin-top:10px";

    var tgl = document.createElement("button");
    tgl.type = "button";
    tgl.className = "btn btn-secondary btn-sm dq-mc-t";
    tgl.textContent = "☑ Çoxseçimli cavab seçicisi";

    var body = document.createElement("div");
    body.className = "dq-mc-p";
    body.style.cssText = "margin-top:8px;display:" + (inp.value ? "flex" : "none") +
      ";flex-wrap:wrap;gap:8px;align-items:center";

    md.tokens.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dq-mc-c";
      b.setAttribute("data-t", t);
      b.setAttribute("aria-pressed", "false");
      b.textContent = t;
      b.style.cssText = "min-width:42px;height:42px;border-radius:50%;border:2px solid #0a2f7a;" +
        "background:#fff;color:#0a2f7a;font-weight:800;font-size:15px;cursor:pointer;padding:0 6px";
      b.disabled = inp.disabled;
      b.addEventListener("click", function () {
        if (inp.disabled) return;
        var cur = readTokens(inp.value, md);
        var i = cur.indexOf(t);
        if (i > -1) cur.splice(i, 1); else cur.push(t);
        cur.sort(function (a, z) { return md.tokens.indexOf(a) - md.tokens.indexOf(z); });
        inp.value = cur.join(md.sep);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        syncChips(wrap, inp);
      });
      body.appendChild(b);
    });

    var clr = document.createElement("button");
    clr.type = "button";
    clr.className = "btn btn-outline-danger btn-sm";
    clr.textContent = "Təmizlə";
    clr.disabled = inp.disabled;
    clr.addEventListener("click", function () {
      if (inp.disabled) return;
      inp.value = "";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      syncChips(wrap, inp);
    });
    body.appendChild(clr);

    tgl.addEventListener("click", function () {
      body.style.display = body.style.display === "none" ? "flex" : "none";
    });
    inp.addEventListener("input", function () { syncChips(wrap, inp); });

    wrap.__md = md;
    wrap.appendChild(tgl);
    wrap.appendChild(body);
    return wrap;
  }

  function readTokens(v, md) {
    v = String(v || "").toUpperCase();
    if (!/^[\s,;A-F1-9]*$/.test(v)) return [];
    var m = v.match(md.letters ? /[A-F]/g : /[1-9]/g) || [];
    var out = [];
    m.forEach(function (t) { if (md.tokens.indexOf(t) > -1 && out.indexOf(t) < 0) out.push(t); });
    return out;
  }

  function syncChips(panel, inp) {
    var md = panel.__md;
    if (!md) return;
    var cur = readTokens(inp.value, md);
    [].forEach.call(panel.querySelectorAll(".dq-mc-c"), function (b) {
      var on = cur.indexOf(b.getAttribute("data-t")) > -1;
      var st = on ? "true" : "false";
      if (b.getAttribute("aria-pressed") !== st) {
        b.setAttribute("aria-pressed", st);
        b.style.background = on ? "#0a2f7a" : "#fff";
        b.style.color = on ? "#fff" : "#0a2f7a";
      }
      if (b.disabled !== inp.disabled) b.disabled = inp.disabled;
    });
  }

  /* ---------- işə sal ---------- */
  function run() {
    if (busy) return;
    busy = true;
    try {
      var root = document.getElementById("single-question-container");
      if (!root) return;
      var c = ctx();
      if (!c) return;
      if (root.querySelector(".ie-opt-row,.ie-editable")) return;   // canlı redaktə rejimi
      if (c.open) fixOpen(root, c); else ensureFive(root, c);
    } catch (e) {
      console.warn("[dq-variant-fix]", e);
    } finally {
      busy = false;
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = 0; run(); }, 30);
  }

  function attach() {
    var root = document.getElementById("single-question-container");
    if (!root || root.__dqObs) return;
    var mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    root.__dqObs = mo;
    root.addEventListener("change", function () { setTimeout(syncSel, 0); }, true);
  }


  /* ---------- 3) Yoxlama Rejimi: bütün sınaqlar ---------- */
  function patchYX() {
    var Y = safe(function () { return YX; }, null);
    if (!Y || Y.__dqPatched) return !!Y;
    Y.__dqPatched = true;
    var origPick = Y.pick;

    async function pageAll(table, cols) {
      var rows = [], from = 0, step = 1000;
      for (;;) {
        var r = await _supabase.from(table).select(cols).order("id", { ascending: true }).range(from, from + step - 1);
        if (r.error) r = await _supabase.from(table).select(cols.replace(/^id,/, "")).range(from, from + step - 1);
        if (r.error) throw r.error;
        var d = r.data || [];
        rows = rows.concat(d);
        if (d.length < step || from > 300000) break;
        from += step;
      }
      return rows;
    }

    Y.__fill = function () {
      var sel = this.$("yx-exam");
      if (!sel) return;
      var keep = sel.value, has = this.__has || {}, cat = this.cat, max = this.__max || 2, h = "";
      for (var i = 1; i <= max; i++) {
        var filled = cat ? !!(has[cat] && has[cat][i]) : true;
        h += '<option value="' + i + '">Sınaq ' + i + (filled ? "" : " (bu kateqoriyada boşdur)") + "</option>";
      }
      sel.innerHTML = h;
      if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
    };

    Y.pick = function (c) {
      var r = origPick.apply(this, arguments);
      try { this.__fill(); } catch (e) {}
      return r;
    };

    Y.open = async function () {
      switchAdminTab("yoxlama");
      this.back();
      var sel = this.$("yx-exam");
      if (sel) sel.innerHTML = '<option value="1">Yüklənir…</option>';
      var nums = new Set([1, 2]), has = {};
      try {
        (await V2.list("exams")).forEach(function (e) { var n = parseInt(e.no); if (n > 0) nums.add(n); });
      } catch (e) {}
      try {
        (await pageAll("exam_questions", "id,exam_id,category")).forEach(function (r) {
          var n = parseInt(r.exam_id); if (!(n > 0)) return;
          nums.add(n);
          var c = String(r.category || "").toUpperCase();
          (has[c] = has[c] || {})[n] = 1;
        });
      } catch (e) { console.warn("[dq-variant-fix] sınaq siyahısı:", e); }
      try {
        (await pageAll("exam_results", "id,exam_no")).forEach(function (r) { var n = parseInt(r.exam_no); if (n > 0) nums.add(n); });
      } catch (e) {}
      this.__has = has;
      this.__max = Math.min(Math.max.apply(null, Array.from(nums)), 200);
      this.__fill();
    };
    return true;
  }
  var yxTimer = setInterval(function () { if (patchYX()) clearInterval(yxTimer); }, 400);

  setInterval(function () { attach(); schedule(); }, 700);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { attach(); schedule(); });
  else { attach(); schedule(); }
})();
