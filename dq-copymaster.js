/* CopyMaster — Toplu Copy/Paste sual modulu (DQ Platform)
   Bir dəfəyə onlarla sualı yapışdırın → sistem ayrıb ard-arda nömrələyir → hər sualı redaktə edin →
   mövcud saveCopyPasteQuestion() ilə (baza formatı dəyişmədən) bir-bir bazaya yazır. */
(function () {
"use strict";
if (window.CopyMaster) return;

var LS = "dq_copymaster_draft_v1";
var LETTERS = ["A", "B", "C", "D", "E"];
var CYR = { "А": "A", "В": "B", "С": "C", "Е": "E", "а": "a", "в": "b", "с": "c", "е": "e" };
var S = { items: [], running: false, stop: false };

/* ---------- köməkçilər ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function letIdx(ch) { ch = CYR[ch] || ch; var i = "ABCDE".indexOf(String(ch).toUpperCase()); return i; }
function norm(t) {
  return String(t || "").replace(/\r\n?/g, "\n").replace(/[\u200B-\u200D\uFEFF\u2060]/g, "").replace(/\u00A0/g, " ").replace(/\t/g, " ");
}

/* ---------- PARSER ---------- */
var RX_OPT = /^\s*[\(\[]?\s*([A-Ea-eАВСЕавсе])\s*[\)\]\.\:]\s*(.*)$/;
var RX_OPT_DASH = /^\s*([A-Ea-e])\s+[-–—]\s+(.*)$/;
var RX_Q = /^\s*(?:sual\s*)?[№#]?\s*(\d{1,4})\s*[\.\)\:\-–]\s+(.*)$/i;
var RX_ANS = /^\s*(?:[Dd]üzgün\s*[Cc]avab|[Dd]oğru\s*[Cc]avab|[Cc]avab|answer|ans|правильный\s*ответ|ответ)\s*[:\-–=]?\s*[\(\[]?\s*([A-Ea-eАВСЕавсе])\s*[\)\]]?\s*(?:[\.\,\;].*)?$/i;
var RX_EXP = /^\s*(?:[İIiı]zah(?:at)?|[Şş]ərh|[Qq]eyd|[Əə]saslandırma|explanation)\s*[:\-–]\s*(.*)$/i;
var RX_KEYLINE = /^(?:\s*\d{1,4}\s*[\.\)\-–:=]?\s*[A-Ea-eАВСЕавсе]\s*[,;]?\s*)+$/;
var RX_KEYHEAD = /^\s*(?:cavablar|cavab\s*açarı|açar|answers?|key|ответы)\s*[:\-]?\s*$/i;

function splitInline(line) {
  var re = /(^|\s)[\(\[]?([A-Ea-eАВСЕавсе])[\)\]]\s+/g, m, marks = [];
  while ((m = re.exec(line))) marks.push({ pos: m.index + m[1].length, end: re.lastIndex, idx: letIdx(m[2]) });
  if (marks.length < 2) return [line];
  for (var s = 0; s < marks.length; s++) {
    var run = [marks[s]];
    for (var k = s + 1; k < marks.length; k++) { if (marks[k].idx === run[run.length - 1].idx + 1) run.push(marks[k]); else break; }
    var startsLine = marks[s].pos === 0;
    if (run.length >= 2 && (marks[s].idx === 0 || startsLine) && (run.length >= 3 || startsLine || marks[s].idx === 0)) {
      var out = [], head = line.slice(0, run[0].pos).trim();
      if (head) out.push(head);
      for (var j = 0; j < run.length; j++) {
        var to = j + 1 < run.length ? run[j + 1].pos : line.length;
        out.push(LETTERS[run[j].idx] + ") " + line.slice(run[j].end, to).trim());
      }
      return out;
    }
  }
  return [line];
}

function takeAnswerKey(lines) {
  var key = {}, found = false, i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  var end = i;
  while (i >= 0 && (RX_KEYLINE.test(lines[i].trim()) || !lines[i].trim())) i--;
  if (i >= 0 && RX_KEYHEAD.test(lines[i].trim())) i--; 
  else if (i < end) { /* başlıq yoxdur */ }
  var from = i + 1;
  if (from > end) return { lines: lines, key: null };
  var block = lines.slice(from, end + 1).join(" "), re = /(\d{1,4})\s*[\.\)\-–:=]?\s*([A-Ea-eАВСЕавсе])/g, m;
  while ((m = re.exec(block))) { key[+m[1]] = letIdx(m[2]); found = true; }
  /* Açar yalnız ən azı 2 cavab varsa və blokdan əvvəl variant sətri gəlirsə qəbul edilir */
  var cnt = Object.keys(key).length;
  if (!found || cnt < 2) return { lines: lines, key: null };
  return { lines: lines.slice(0, from), key: key };
}

function parseBulk(raw) {
  var text = norm(raw), lines = text.split("\n"), kk = takeAnswerKey(lines);
  lines = kk.lines;
  var exp = [];
  lines.forEach(function (l) { splitInline(l).forEach(function (x) { exp.push(x); }); });
  var items = [], cur = null, mode = "q", blank = false;

  function start(n, t) {
    cur = { n: n, q: t || "", opts: [], correct: -1, expl: "" };
    items.push(cur); mode = "q";
  }
  function looksNew(line) {
    var c = cur.opts.length;
    if (c >= 5) return true;
    if (c >= 4) return blank || /[?:]\s*$/.test(line);
    if (c >= 2) return blank;
    return false;
  }

  exp.forEach(function (line) {
    var t = line.replace(/\s+$/, "");
    if (!t.trim()) { blank = true; return; }
    var m;
    if (cur && (m = RX_ANS.exec(t))) { cur.correct = letIdx(m[1]); mode = "ans"; blank = false; return; }
    if (cur && (m = RX_EXP.exec(t))) { cur.expl = m[1].trim(); mode = "expl"; blank = false; return; }
    m = RX_OPT.exec(t) || RX_OPT_DASH.exec(t);
    if (m && cur) {
      var ix = letIdx(m[1]);
      if (ix === cur.opts.length && ix <= 4 && mode !== "expl") {
        cur.opts.push(m[2].trim()); mode = "opt"; blank = false; return;
      }
    }
    var qm = RX_Q.exec(t);
    if (qm) {
      var n = +qm[1];
      var isNew = !cur || cur.opts.length >= 2 || (cur.opts.length === 0 && !cur.q.trim()) || n === cur.n + 1 || mode === "expl" || mode === "ans";
      if (isNew) { start(n, qm[2].trim()); blank = false; return; }
    }
    if (!cur) { start(null, t.trim()); blank = false; return; }
    if (mode === "expl") { cur.expl += (cur.expl ? "\n" : "") + t.trim(); }
    else if (mode === "ans") { start(null, t.trim()); }
    else if (mode === "opt") {
      if (looksNew(t)) start(null, t.trim());
      else cur.opts[cur.opts.length - 1] += " " + t.trim();
    } else { cur.q += (cur.q ? "\n" : "") + t.trim(); }
    blank = false;
  });

  items.forEach(function (it, i) {
    it.q = it.q.trim();
    for (var k = 0; k < it.opts.length; k++) {
      var o = it.opts[k], mark = false;
      if (/\s*(?:✓|✔|✅|☑)\s*$/.test(o)) { o = o.replace(/\s*(?:✓|✔|✅|☑)\s*$/, ""); mark = true; }
      if (/^\*\s*/.test(o)) { o = o.replace(/^\*\s*/, ""); mark = true; }
      if (/\s*\((?:düz|doğru|correct)\)\s*$/i.test(o)) { o = o.replace(/\s*\((?:düz|doğru|correct)\)\s*$/i, ""); mark = true; }
      it.opts[k] = o.trim();
      if (mark && it.correct < 0) it.correct = k;
    }
    if (kk.key) {
      var kv = (it.n != null && kk.key[it.n] != null) ? kk.key[it.n] : kk.key[i + 1];
      if (kv != null && kv >= 0 && it.correct < 0) it.correct = kv;
    }
    it.inc = true; it.status = "wait"; it.msg = "";
  });
  return items;
}

function check(it, dupes) {
  var w = [], opts = it.opts.map(function (o) { return (o || "").trim(); });
  var filled = opts.filter(Boolean).length;
  if (!(it.q || "").trim()) w.push("Sual mətni boşdur");
  if (filled < 2) w.push("Ən azı 2 variant lazımdır");
  else if (filled < 4) w.push("Yalnız " + filled + " variant var");
  var gap = false; for (var i = 0; i < opts.length; i++) { if (!opts[i]) gap = true; else if (gap) { w.push("Variantlar arasında boşluq var"); break; } }
  if (it.correct < 0) w.push("Düzgün cavab seçilməyib");
  else if (!opts[it.correct]) w.push("Düzgün cavab boş variantı göstərir");
  if (dupes[(it.q || "").trim().toLowerCase()] > 1 && (it.q || "").trim()) w.push("Təkrarlanan sual");
  return w;
}
function dupMap() {
  var d = {}; S.items.forEach(function (it) { var k = (it.q || "").trim().toLowerCase(); if (k) d[k] = (d[k] || 0) + 1; }); return d;
}
function blocking(w) { return w.some(function (x) { return /boşdur|lazımdır|seçilməyib|boş variantı|boşluq/.test(x); }); }

/* ---------- UI ---------- */
var CSS = ".cm{max-width:980px;margin:0 auto}.cm h4{margin:0 0 4px}.cm .cm-sub{color:#64748b;font-size:13px;margin-bottom:12px}" +
".cm textarea,.cm input[type=text],.cm input[type=number],.cm select{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:#fff;color:#0f172a}" +
".cm textarea{line-height:1.55;resize:vertical}.cm .cm-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0}" +
".cm .cm-row label.cm-chip{display:inline-flex;gap:6px;align-items:center;padding:6px 12px;border:1px solid #cbd5e1;border-radius:999px;font-weight:700;cursor:pointer;background:#fff}" +
".cm .cm-num{width:96px!important}.cm .cm-btn{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;color:#fff;background:#0b2a6b;font:inherit;font-weight:700}" +
".cm .cm-btn.g{background:#059669}.cm .cm-btn.r{background:#dc2626}.cm .cm-btn.l{background:#e2e8f0;color:#0f172a}.cm .cm-btn[disabled]{opacity:.5;cursor:not-allowed}" +
".cm .cm-card{border:1px solid #cbd5e1;border-radius:14px;padding:12px;margin:12px 0;background:#f8fafc}.cm .cm-card.ok{border-color:#10b981;background:#ecfdf5}.cm .cm-card.bad{border-color:#ef4444;background:#fef2f2}" +
".cm .cm-card.off{opacity:.5}.cm .cm-hd{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap}" +
".cm .cm-badge{font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;background:#e2e8f0}.cm .cm-w{color:#b45309;font-size:12.5px;margin:4px 0}.cm .cm-e{color:#b91c1c;font-size:12.5px;margin:4px 0;font-weight:700}" +
".cm .cm-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}@media(max-width:640px){.cm .cm-grid{grid-template-columns:1fr}}" +
".cm .cm-opt{display:flex;gap:6px;align-items:center}.cm .cm-opt b{min-width:20px}.cm .cm-bar{height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:10px 0}.cm .cm-bar i{display:block;height:100%;width:0;background:#059669;transition:width .2s}" +
".cm .cm-sum{padding:10px 12px;border-radius:10px;background:#eff6ff;font-weight:600;margin:10px 0;line-height:1.6}";

function render() {
  var root = $("mod-copymaster"); if (!root) return;
  if (!$("cm-css")) { var st = document.createElement("style"); st.id = "cm-css"; st.textContent = CSS; document.head.appendChild(st); }
  var d = {}; try { d = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) {}
  root.innerHTML =
    '<div class="cm"><h4>🚀 CopyMaster — Toplu Copy / Paste Sual Daxiletmə</h4>' +
    '<div class="cm-sub">Word, WhatsApp, PDF və s.-dən onlarla sualı bir dəfəyə yapışdırın. Sistem sualları ayırıb ard-arda nömrələyəcək, hər birini redaktə edə, yoxlaya və hamısını bir kliklə bazaya yükləyə bilərsiniz. Dəstəklənir: <b>1. / 1) / Sual 1:</b>, <b>A) / A. / a)</b>, bir sətirdə variantlar, <b>Cavab: B</b>, <b>İzah:</b>, ✓ işarəsi, sonda cavab açarı (<b>1-B 2-C …</b>).</div>' +
    '<textarea id="cm-raw" rows="9" placeholder="1. Azərbaycan Respublikasının paytaxtı haradır?\nA) Gəncə\nB) Bakı\nC) Sumqayıt\nD) Şəki\nE) Lənkəran\nCavab: B\n\n2. Növbəti sual...\nA) ...\nB) ...">' + esc(d.raw || "") + '</textarea>' +
    '<div class="cm-row"><span>Sınaq №</span><input id="cm-exam" class="cm-num" type="number" min="1" value="' + (d.exam || 1) + '">' +
    '<span>Başlanğıc sual №</span><input id="cm-start" class="cm-num" type="number" min="1" value="' + (d.start || 1) + '">' +
    '<label class="cm-chip"><input type="checkbox" class="cm-cat" value="BA"' + (d.ba === false ? "" : " checked") + '> BA</label>' +
    '<label class="cm-chip"><input type="checkbox" class="cm-cat" value="BB"' + (d.bb ? " checked" : "") + '> BB</label>' +
    '<label class="cm-chip"><input type="checkbox" class="cm-cat" value="AC"' + (d.ac ? " checked" : "") + '> AC</label>' +
    '<label class="cm-chip" style="background:linear-gradient(135deg,#f59e0b,#db2777);color:#fff;border:0"><input type="checkbox" id="cm-flash"> ⚡ Günün sualı</label></div>' +
    '<div class="cm-row"><button class="cm-btn" id="cm-parse">🔍 Analiz et və ayır</button>' +
    '<button class="cm-btn l" id="cm-renum">🔢 Yenidən ardıcıl nömrələ</button>' +
    '<button class="cm-btn l" id="cm-clear">🗑️ Təmizlə</button></div>' +
    '<div id="cm-sum"></div><div id="cm-list"></div>' +
    '<div id="cm-foot" style="display:none"><div class="cm-bar"><i id="cm-prog"></i></div>' +
    '<div class="cm-row"><button class="cm-btn g" id="cm-go">💾 Hamısını Seçilən Kateqoriyalara Yüklə & Bazaya Vur</button>' +
    '<button class="cm-btn r" id="cm-stop" style="display:none">⏹ Dayandır</button>' +
    '<button class="cm-btn l" id="cm-prune">✅ Uğurluları siyahıdan sil</button></div></div></div>';
  $("cm-flash").checked = !!d.flash;
  bind(); draw();
}

function saveDraft() {
  try {
    var cats = {}; [].forEach.call(document.querySelectorAll(".cm-cat"), function (c) { cats[c.value] = c.checked; });
    localStorage.setItem(LS, JSON.stringify({ raw: $("cm-raw").value, exam: $("cm-exam").value, start: $("cm-start").value, ba: cats.BA, bb: cats.BB, ac: cats.AC, flash: $("cm-flash").checked }));
  } catch (e) {}
}

function renumber() {
  var s = parseInt($("cm-start").value, 10) || 1, n = s;
  S.items.forEach(function (it) { if (it.inc && it.status !== "ok") { it.num = n++; } });
}

function bind() {
  $("cm-parse").onclick = function () {
    var v = $("cm-raw").value;
    if (!v.trim()) { alert("Əvvəlcə sualları yapışdırın."); return; }
    S.items = parseBulk(v);
    var s = parseInt($("cm-start").value, 10) || 1;
    S.items.forEach(function (it, i) { it.num = s + i; });
    saveDraft(); draw();
  };
  $("cm-raw").oninput = saveDraft;
  ["cm-exam", "cm-start", "cm-flash"].forEach(function (id) { $(id).onchange = saveDraft; });
  [].forEach.call(document.querySelectorAll(".cm-cat"), function (c) { c.onchange = saveDraft; });
  $("cm-renum").onclick = function () { renumber(); draw(); };
  $("cm-clear").onclick = function () {
    if (S.running) return;
    if (!confirm("Mətn və siyahı təmizlənsin?")) return;
    $("cm-raw").value = ""; S.items = []; saveDraft(); draw();
  };
  $("cm-go").onclick = run;
  $("cm-stop").onclick = function () { S.stop = true; };
  $("cm-prune").onclick = function () { S.items = S.items.filter(function (i) { return i.status !== "ok"; }); draw(); };
  $("cm-list").addEventListener("input", onEdit);
  $("cm-list").addEventListener("change", onEdit);
  $("cm-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (!b || S.running) return;
    S.items.splice(+b.getAttribute("data-del"), 1); draw();
  });
}

function onEdit(e) {
  if (S.running) return;
  var el = e.target, i = el.getAttribute("data-i"), f = el.getAttribute("data-f");
  if (i == null || !f) return;
  var it = S.items[+i]; if (!it) return;
  if (f === "q") it.q = el.value;
  else if (f === "expl") it.expl = el.value;
  else if (f === "num") it.num = parseInt(el.value, 10) || 1;
  else if (f === "inc") it.inc = el.checked;
  else if (f === "cor") it.correct = parseInt(el.value, 10);
  else if (f.charAt(0) === "o") { var k = +f.charAt(1); while (it.opts.length <= k) it.opts.push(""); it.opts[k] = el.value; }
  if (f === "inc" || f === "cor" || (f.charAt(0) === "o" && f.length === 2 && el.type !== "text")) draw();
  else if (e.type === "change") draw();
  else refreshSummary();
}

function refreshSummary() {
  var dm = dupMap(), tot = S.items.length, inc = 0, okc = 0, bad = 0, warn = 0;
  S.items.forEach(function (it) {
    var w = check(it, dm);
    if (it.inc) { inc++; if (blocking(w)) bad++; else if (w.length) warn++; }
    if (it.status === "ok") okc++;
  });
  var box = $("cm-sum"); if (!box) return;
  box.innerHTML = tot ? '<div class="cm-sum">📊 Tapıldı: <b>' + tot + '</b> sual · Yüklənəcək: <b>' + inc + '</b> · Düzgün: <b>' + (inc - bad - warn) + '</b> · Xəbərdarlıqlı: <b>' + warn + '</b> · Düzəliş tələb edən (atlanacaq): <b>' + bad + '</b> · Yüklənib: <b>' + okc + '</b></div>' : "";
  $("cm-foot").style.display = tot ? "block" : "none";
}

function draw() {
  var dm = dupMap(), list = $("cm-list"); if (!list) return;
  var h = "";
  S.items.forEach(function (it, i) {
    var w = check(it, dm), blk = blocking(w);
    var cls = it.status === "ok" ? "ok" : it.status === "fail" ? "bad" : "";
    if (!it.inc) cls += " off";
    var badge = it.status === "ok" ? "✅ Yükləndi" : it.status === "fail" ? "❌ Xəta" : it.status === "work" ? "⏳ Yüklənir…" : blk ? "⚠️ Düzəliş lazım" : "🟦 Hazır";
    var optsH = "";
    for (var k = 0; k < 5; k++) optsH += '<div class="cm-opt"><b>' + LETTERS[k] + '</b><input type="text" data-i="' + i + '" data-f="o' + k + '" value="' + esc(it.opts[k] || "") + '" placeholder="' + LETTERS[k] + ' variantı' + (k === 4 ? " (əgər varsa)" : "") + '"></div>';
    var sel = '<option value="-1">Seçin…</option>';
    for (var j = 0; j < 5; j++) sel += '<option value="' + j + '"' + (it.correct === j ? " selected" : "") + '>' + LETTERS[j] + ' variantı</option>';
    h += '<div class="cm-card ' + cls + '"><div class="cm-hd"><div style="display:flex;gap:8px;align-items:center"><label class="cm-chip" style="padding:3px 10px"><input type="checkbox" data-i="' + i + '" data-f="inc"' + (it.inc ? " checked" : "") + '> Daxil et</label>' +
      '<span>Sual №</span><input type="number" class="cm-num" min="1" data-i="' + i + '" data-f="num" value="' + (it.num || 1) + '" style="width:80px!important"></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><span class="cm-badge">' + badge + '</span><button class="cm-btn l" style="padding:4px 10px" data-del="' + i + '">✖</button></div></div>' +
      '<textarea rows="3" data-i="' + i + '" data-f="q" placeholder="Sual mətni">' + esc(it.q) + '</textarea>' +
      '<div class="cm-grid">' + optsH + '</div>' +
      '<div class="cm-grid"><div><label style="font-weight:700;font-size:13px">Düzgün cavab</label><select data-i="' + i + '" data-f="cor">' + sel + '</select></div>' +
      '<div><label style="font-weight:700;font-size:13px">Qanunvericilik izahı / şərh (istəyə görə)</label><textarea rows="2" data-i="' + i + '" data-f="expl">' + esc(it.expl) + '</textarea></div></div>' +
      w.map(function (x) { return '<div class="cm-w">⚠ ' + esc(x) + '</div>'; }).join("") +
      (it.msg ? '<div class="' + (it.status === "fail" ? "cm-e" : "cm-w") + '">' + esc(it.msg) + '</div>' : "") + '</div>';
  });
  list.innerHTML = h; refreshSummary();
}

/* ---------- Bazaya yükləmə ---------- */
function sb() { try { return _supabase; } catch (e) { return window._supabase || null; } }
async function dbCount(exam) {
  var s = sb(); if (!s) return null;
  try {
    var r = await s.from("exam_questions").select("*", { count: "exact", head: true }).eq("exam_id", Number(exam));
    if (!r.error && typeof r.count === "number") return r.count;
    r = await s.from("exam_questions").select("*", { count: "exact", head: true }).eq("exam_id", String(exam));
    if (!r.error && typeof r.count === "number") return r.count;
  } catch (e) {}
  return null;
}
function setv(id, v, evt) {
  var el = $(id); if (!el) return false; el.value = v;
  try { el.dispatchEvent(new Event(evt || "input", { bubbles: true })); } catch (e) {}
  return true;
}

async function run() {
  if (S.running) return;
  if (typeof window.saveCopyPasteQuestion !== "function") { alert("saveCopyPasteQuestion funksiyası tapılmadı — app.js yüklənməyib."); return; }
  var exam = parseInt($("cm-exam").value, 10);
  var cats = [].filter.call(document.querySelectorAll(".cm-cat"), function (c) { return c.checked; }).map(function (c) { return c.value; });
  if (!exam || exam < 1) { alert("Sınaq № düzgün deyil."); return; }
  if (!cats.length) { alert("Ən azı bir kateqoriya (BA / BB / AC) seçin."); return; }
  var dm = dupMap();
  var todo = S.items.filter(function (it) { return it.inc && it.status !== "ok" && !blocking(check(it, dm)); });
  var skipped = S.items.filter(function (it) { return it.inc && it.status !== "ok" && blocking(check(it, dm)); }).length;
  if (!todo.length) { alert("Yüklənəcək hazır sual yoxdur. Kartlardakı xəbərdarlıqları düzəldin."); return; }
  var nums = {}, dup = false; todo.forEach(function (it) { if (nums[it.num]) dup = true; nums[it.num] = 1; });
  if (dup && !confirm("Bəzi suallar eyni № -yə malikdir və bir-birini əvəz edə bilər. Yenə də davam edilsin?")) return;
  if (!confirm(todo.length + " sual — Sınaq " + exam + " · " + cats.join(", ") + " kateqoriyasına yüklənsin?" + (skipped ? "\n(" + skipped + " düzəliş tələb edən sual atlanacaq)" : ""))) return;

  S.running = true; S.stop = false;
  $("cm-go").disabled = true; $("cm-stop").style.display = "inline-block"; $("cm-parse").disabled = true;
  var flash = $("cm-flash").checked;
  var oa = window.alert, oc = window.confirm, msgs = [];
  var ok = 0, fail = 0, done = 0;

  try {
    for (var n = 0; n < todo.length; n++) {
      if (S.stop) break;
      var it = todo[n]; it.status = "work"; it.msg = ""; draw();
      msgs = []; window.alert = function (m) { msgs.push(String(m)); }; window.confirm = function () { return true; };
      try {
        var before = await dbCount(exam);
        setv("cp-raw-text", "", "input");
        setv("cp-parsed-question", it.q.trim());
        var cc = it.opts.map(function (o) { return (o || "").trim(); });
        setv("cp-opt-a", cc[0] || ""); setv("cp-opt-b", cc[1] || ""); setv("cp-opt-c", cc[2] || ""); setv("cp-opt-d", cc[3] || "");
        setv("cp-opt-e", cc[4] || "");
        setv("cp-exam-id", exam, "change"); setv("cp-q-num", it.num, "input");
        [].forEach.call(document.querySelectorAll(".cp-cat-chk"), function (c) { c.checked = cats.indexOf(c.value) > -1; });
        var fc = $("cp-flash-chk"); if (fc) fc.checked = flash;
        setv("cp-correct-opt", String(it.correct), "change");
        if ($("cp-correct-opt") && $("cp-correct-opt").value !== String(it.correct)) throw new Error("Düzgün cavab formaya yazıla bilmədi");
        var r = window.saveCopyPasteQuestion();
        if (r && typeof r.then === "function") await r;
        var after = null, tries = 0;
        if (before != null) { while (tries < 12) { await sleep(500); after = await dbCount(exam); if (after != null && after > before) break; tries++; } }
        else await sleep(900);
        var err = msgs.filter(function (m) { return /xəta|səhv|alınmadı|uğursuz|seçin|daxil edin|boş|doldurun|error|fail/i.test(m); })[0];
        if (err) { it.status = "fail"; it.msg = err; fail++; }
        else if (before != null && after != null && after <= before) { it.status = "ok"; it.msg = "Yeni sətir artmadı — eyni № mövcud idisə yenilənmiş ola bilər (bazada yoxlayın)."; ok++; }
        else { it.status = "ok"; ok++; }
      } catch (e) { it.status = "fail"; it.msg = (e && e.message) || "Naməlum xəta"; fail++; }
      finally { window.alert = oa; window.confirm = oc; }
      done++; $("cm-prog").style.width = Math.round(done / todo.length * 100) + "%"; draw();
      await sleep(150);
    }
  } finally {
    window.alert = oa; window.confirm = oc;
    S.running = false; $("cm-go").disabled = false; $("cm-stop").style.display = "none"; $("cm-parse").disabled = false;
    setv("cp-parsed-question", ""); setv("cp-opt-a", ""); setv("cp-opt-b", ""); setv("cp-opt-c", ""); setv("cp-opt-d", ""); setv("cp-opt-e", "");
    draw();
    var s = $("cm-sum"); if (s) s.insertAdjacentHTML("afterbegin", '<div class="cm-sum" style="background:#ecfdf5">🏁 Bitdi: ✅ ' + ok + ' uğurlu · ❌ ' + fail + ' xəta' + (S.stop ? " · ⏹ dayandırıldı" : "") + (skipped ? " · ⚠️ " + skipped + " atlandı" : "") + (fail ? ". Xətalıları düzəldib yenidən «Yüklə» basın — yalnız yüklənməyənlər göndəriləcək." : "") + '</div>');
  }
}

/* ---------- qeydiyyat ---------- */
function ensureHost() {
  if ($("mod-copymaster")) return true;
  var ref = $("mod-copy2") || $("mod-copypaste"); if (!ref) return false;
  var d = document.createElement("div"); d.id = "mod-copymaster"; d.className = "admin-module-block";
  ref.parentNode.insertBefore(d, ref.nextSibling); return true;
}
function init() { if (ensureHost()) render(); }
window.CopyMaster = {
  open: function () { init(); if (typeof window.switchAdminTab === "function") window.switchAdminTab("copymaster"); },
  render: init, parse: parseBulk
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
document.addEventListener("click", function (e) {
  var c = e.target.closest && e.target.closest("[onclick*=\"'copymaster'\"]");
  if (c && $("mod-copymaster") && !$("cm-raw")) render();
});
})();
