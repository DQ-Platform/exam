/* =====================================================================
   PDF PRO OXUMA — şəkil (PDF/Word/Office ekran görüntüsü) və PDF-dən
   sualları + variantları + fiqurları səliqəli çıxarır, redaktə etdirir,
   sınağa əlavə edir.   Admin paneldə yeni modul: mod-pdfoxu
   Asılılıq: app.js (switchAdminTab, _supabase, examStructure, __dqLibs)
   index.html-də digər modullardan SONRA:  <script src="dq-pdf-oxu.js?v=1"></script>
   ===================================================================== */
(function () {
  "use strict";
  if (typeof window !== "undefined" && window.DQPO) return;

  /* ═════════ A. SAF ÇEKİRDƏK (canvas-sız, test oluna bilir) ═════════ */
  var AZC = "A-Za-zƏəİıÖöÜüÇçŞşĞğ", AZL = "a-zəıöüçşğ", AZU = "A-ZƏİÖÜÇŞĞ";

  function morph(m, ws, hs, r, grow) {          // grow=1 genişlət, 0 daralt (kənardan kənar = dolu)
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
  function components(m, ws, hs) {              // bağlı komponentlər (4-qonşu)
    var lab = new Uint8Array(ws * hs), stack = new Int32Array(ws * hs), out = [];
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
      out.push({ n: n, x0: bx0, x1: bx1, y0: by0, y1: by1 });
    }
    return out;
  }
  function cropImg(img, x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    w = Math.max(1, Math.min(img.w - x, Math.round(w))); h = Math.max(1, Math.min(img.h - y, Math.round(h)));
    var o = new Uint8ClampedArray(w * h * 4);
    for (var r = 0; r < h; r++) o.set(img.data.subarray(((y + r) * img.w + x) * 4, ((y + r) * img.w + x + w) * 4), r * w * 4);
    return { w: w, h: h, data: o };
  }
  /* ekran görüntüsündə ən böyük ağ «kağız» sahəsi (tünd interfeys atılır) */
  function findPaper(img) {
    var w = img.w, h = img.h, s = Math.max(2, Math.round(Math.max(w, h) / 550)), ws = Math.floor(w / s), hs = Math.floor(h / s), full = { x: 0, y: 0, w: w, h: h };
    if (ws < 12 || hs < 12) return full;
    var d = img.data, m = new Uint8Array(ws * hs), x, y, yy, xx;
    for (y = 0; y < hs; y++) for (x = 0; x < ws; x++) {
      var mn = 255;
      for (yy = 0; yy < s && mn > 200; yy++) for (xx = 0; xx < s; xx++) {
        var k = ((y * s + yy) * w + (x * s + xx)) * 4, v = d[k] < d[k + 1] ? d[k] : d[k + 1]; if (d[k + 2] < v) v = d[k + 2]; if (v < mn) mn = v;
      }
      m[y * ws + x] = mn > 200 ? 1 : 0;
    }
    m = morph(morph(m, ws, hs, 3, 1), ws, hs, 3, 0);
    var best = null; components(m, ws, hs).forEach(function (c) { if (!best || c.n > best.n) best = c; });
    if (!best) return full;
    var rx = best.x0 * s, ry = best.y0 * s, rw = Math.min(w - rx, (best.x1 - best.x0 + 1) * s), rh = Math.min(h - ry, (best.y1 - best.y0 + 1) * s);
    if (rw * rh < 0.2 * w * h) return full;
    if (rw > 0.97 * w && rh > 0.97 * h) return full;
    return { x: rx, y: ry, w: rw, h: rh };
  }
  /* səhifənin üstünə düşən düz rəngli lövhələr (bildiriş zolağı, alət paneli, boz dairə) */
  function findOverlays(img) {
    var w = img.w, h = img.h, s = 4, ws = Math.floor(w / s), hs = Math.floor(h / s), d = img.data, m = new Uint8Array(ws * hs), x, y, yy, xx;
    for (y = 0; y < hs; y++) for (x = 0; x < ws; x++) {
      var mn = 255, mx = 0;
      for (yy = 0; yy < s; yy++) for (xx = 0; xx < s; xx++) {
        var k = ((y * s + yy) * w + (x * s + xx)) * 4, l = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; if (l < mn) mn = l; if (l > mx) mx = l;
      }
      m[y * ws + x] = (mx - mn <= 30 && mx < 205) ? 1 : 0;
    }
    m = morph(morph(m, ws, hs, 3, 1), ws, hs, 3, 0);
    var out = [], pad = 14;
    components(m, ws, hs).forEach(function (c) {
      var bw = (c.x1 - c.x0 + 1) * s, bh = (c.y1 - c.y0 + 1) * s, edge = c.x1 * s >= w - 12 || c.x0 === 0 || c.y1 * s >= h - 12;
      if (c.n * s * s < 0.003 * w * h) return;
      if (!(bw >= 0.25 * w || edge)) return;
      var x0 = Math.max(0, c.x0 * s - pad), y0 = Math.max(0, c.y0 * s - pad), x1 = Math.min(w, (c.x1 + 1) * s + pad), y1 = Math.min(h, (c.y1 + 1) * s + pad);
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    });
    return out;
  }
  /* kəs → üst lövhələri ağla → yalnız məzmun sahəsini saxla */
  function cleanPage(img) {
    var pr = findPaper(img), page = (pr.w === img.w && pr.h === img.h) ? { w: img.w, h: img.h, data: new Uint8ClampedArray(img.data) } : cropImg(img, pr.x, pr.y, pr.w, pr.h);
    var ov = findOverlays(page), i, x, y;
    ov.forEach(function (r) {
      for (y = r.y; y < Math.min(page.h, r.y + r.h); y++) for (x = r.x; x < Math.min(page.w, r.x + r.w); x++) { var k = (y * page.w + x) * 4; page.data[k] = page.data[k + 1] = page.data[k + 2] = 255; page.data[k + 3] = 255; }
    });
    var rows = new Uint32Array(page.h), cols = new Uint32Array(page.w);
    for (y = 0; y < page.h; y++) for (x = 0; x < page.w; x++) { var j = (y * page.w + x) * 4; if (page.data[j] < 150 && page.data[j + 1] < 150 && page.data[j + 2] < 150) { rows[y]++; cols[x]++; } }
    var y0 = 0, y1 = page.h - 1, x0 = 0, x1 = page.w - 1;
    while (y0 < page.h && rows[y0] < 3) y0++; while (y1 > y0 && rows[y1] < 3) y1--;
    while (x0 < page.w && cols[x0] < 3) x0++; while (x1 > x0 && cols[x1] < 3) x1--;
    if (y1 - y0 < 20 || x1 - x0 < 20) { y0 = 0; y1 = page.h - 1; x0 = 0; x1 = page.w - 1; }
    var m = 16, cx = Math.max(0, x0 - m), cy = Math.max(0, y0 - m), cw = Math.min(page.w, x1 + m + 1) - cx, ch = Math.min(page.h, y1 + m + 1) - cy;
    var out = cropImg(page, cx, cy, cw, ch);
    out.ox = pr.x + cx; out.oy = pr.y + cy;
    out.overlays = ov.map(function (r) { return { x: r.x - cx, y: r.y - cy, w: r.w, h: r.h }; });
    return out;
  }
  /* iki sütun: ortadakı boş zolağın x-i (yoxdursa null) */
  function findGutter(img) {
    var w = img.w, h = img.h, d = img.data, y0 = Math.round(h * 0.15), y1 = Math.round(h * 0.85), ink = new Uint32Array(w), x, y;
    for (y = y0; y < y1; y++) for (x = 0; x < w; x++) { var i = (y * w + x) * 4; if (d[i] < 150 && d[i + 1] < 150 && d[i + 2] < 150) ink[x]++; }
    var band = y1 - y0;
    for (x = 3; x < w - 3; x++) if (ink[x] > band * 0.6 && ink[x - 3] < band * 0.25 && ink[x + 3] < band * 0.25) ink[x] = 0;
    var lo = Math.floor(w * 0.36), hi = Math.ceil(w * 0.64), sl = 0, sr = 0;
    for (x = 0; x < lo; x++) sl += ink[x]; for (x = hi; x < w; x++) sr += ink[x];
    sl /= Math.max(1, lo); sr /= Math.max(1, w - hi);
    if (sl < band * 0.03 || sr < band * 0.03) return null;
    var eps = Math.max(1, 0.04 * Math.min(sl, sr)), best = null, cur = null;
    for (x = lo; x < hi; x++) {
      if (ink[x] <= eps) { if (!cur) cur = { a: x, b: x }; cur.b = x; }
      else { if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur; cur = null; }
    }
    if (cur && (!best || cur.b - cur.a > best.b - best.a)) best = cur;
    return best && best.b - best.a + 1 >= w * 0.012 ? Math.round((best.a + best.b) / 2) : null;
  }
  function colorCount(img, b) {                  // rəngli piksellər (Windows loqosu və s.)
    var n = 0, d = img.data, x0 = Math.max(0, Math.floor(b.x0)), y0 = Math.max(0, Math.floor(b.y0)), x1 = Math.min(img.w, Math.ceil(b.x1)), y1 = Math.min(img.h, Math.ceil(b.y1));
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
      var i = (y * img.w + x) * 4, r = d[i], g = d[i + 1], bl = d[i + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx - mn > 70 && mx > 110) n++;
    }
    return n;
  }

  /* ---- sözlər → sətirlər ---- */
  function wordBox(L) { var b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }; L.forEach(function (w) { if (w.x0 < b.x0) b.x0 = w.x0; if (w.y0 < b.y0) b.y0 = w.y0; if (w.x1 > b.x1) b.x1 = w.x1; if (w.y1 > b.y1) b.y1 = w.y1; }); return b; }
  function union(a, b) { if (!a) return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }; return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }; }
  function groupLines(words) {
    var ws = words.filter(function (w) { return String(w.t || "").trim(); }).sort(function (a, b) { return (a.y0 + a.y1) - (b.y0 + b.y1); });
    if (!ws.length) return [];
    var hs = ws.map(function (w) { return w.y1 - w.y0; }).sort(function (a, b) { return a - b; }), mh = hs[Math.floor(hs.length / 2)] || 10, lines = [];
    ws.forEach(function (w) {
      var cy = (w.y0 + w.y1) / 2, L = lines[lines.length - 1];
      if (L && Math.abs(cy - L.cy) <= mh * 0.6) { L.words.push(w); L.cy = (L.cy * (L.words.length - 1) + cy) / L.words.length; }
      else lines.push({ words: [w], cy: cy });
    });
    lines.forEach(function (L) { L.words.sort(function (a, b) { return a.x0 - b.x0; }); L.box = wordBox(L.words); L.y0 = L.box.y0; L.y1 = L.box.y1; });
    return lines.sort(function (a, b) { return a.cy - b.cy; });
  }
  var MK = /^\(?([A-E])[)\]}](.*)$/, QN = /^(\d{1,3})[.)](.*)$/;
  function isMarkerLine(L) { return L.words.some(function (w) { return MK.test(w.t); }); }
  function isTextLine(L) {
    if (L.words.length < 3) return false;
    var good = L.words.filter(function (w) { return new RegExp("[" + AZC + "]{3,}").test(w.t) && (w.c == null || w.c >= 60); }).length;
    return good >= 2;
  }
  /* fiqurlar: mətn sətirləri çıxarıldıqdan sonra qalan «mürəkkəb» zolaqları */
  function findFigures(img, words, overlays) {
    var w = img.w, h = img.h, d = img.data, lines = groupLines(words), blocked = new Uint8Array(w * h), x, y;
    lines.forEach(function (L) {
      if (!(isTextLine(L) || isMarkerLine(L))) return;
      L.words.forEach(function (wd) {
        var x0 = Math.max(0, Math.floor(wd.x0) - 3), x1 = Math.min(w, Math.ceil(wd.x1) + 3), y0 = Math.max(0, Math.floor(wd.y0) - 3), y1 = Math.min(h, Math.ceil(wd.y1) + 3);
        for (y = y0; y < y1; y++) for (x = x0; x < x1; x++) blocked[y * w + x] = 1;
      });
    });
    var rows = new Uint32Array(h), minX = new Int32Array(h).fill(w), maxX = new Int32Array(h).fill(-1);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (blocked[y * w + x]) continue;
      var i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b);
      if (mn < 200 || mx - mn > 60) { rows[y]++; if (x < minX[y]) minX[y] = x; if (x > maxX[y]) maxX[y] = x; }
    }
    var bands = [], s = -1, last = -1;
    for (y = 0; y <= h; y++) {
      var on = y < h && rows[y] >= 2;
      if (on) { if (s < 0) s = y; else if (y - last > 12) { bands.push([s, last]); s = y; } last = y; }
    }
    if (s >= 0) bands.push([s, last]);
    var figs = [];
    bands.forEach(function (bd) {
      var n = 0, a = w, z = -1; for (y = bd[0]; y <= bd[1]; y++) { n += rows[y]; if (minX[y] < a) a = minX[y]; if (maxX[y] > z) z = maxX[y]; }
      if (bd[1] - bd[0] + 1 < 36 || z - a < 50 || n < 350) return;
      var pad = 8; figs.push({ x0: Math.max(0, a - pad), y0: Math.max(0, bd[0] - pad), x1: Math.min(w, z + pad), y1: Math.min(h, bd[1] + pad) });
    });
    return figs;
  }

  /* ---- mətn təmizləmə ---- */
  function tidy(s) {
    s = String(s == null ? "" : s);
    try { s = s.normalize("NFC"); } catch (e) {}
    s = s.replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "").replace(/[\u00a0\u2000-\u200a\u202f\t]/g, " ").replace(/[\u2018\u2019\u201b]/g, "'").replace(/[ ]{2,}/g, " ");
    s = s.replace(/\s+([,;?!)\]])/g, "$1").replace(/(\S)\s+([.:])(?=\s|$)/g, function (m, a, b) { return (b === ":" && /\d/.test(a)) ? m : a + b; }).replace(/([(\[])\s+/g, "$1");
    s = s.replace(new RegExp("([,;])(?=[" + AZC + "])", "g"), "$1 ").replace(new RegExp("([" + AZL + "]{2})([.?!])(?=[" + AZU + "][" + AZL + "]|\\d\\s)", "g"), "$1$2 ")
      .replace(new RegExp("(\\?|!)(?=[" + AZC + "])", "g"), "$1 ").replace(new RegExp("(^|\\n)(\\d{1,2})\\.(?=[" + AZC + "])", "g"), "$1$2. ");
    return s.split("\n").map(function (x) { return x.trim(); }).join("\n").trim();
  }
  function joinStem(lines) {
    var out = [];
    lines.forEach(function (l) {
      l = l.trim(); if (!l) return;
      if (!out.length) { out.push(l); return; }
      var stmt = /^\d{1,2}[.)]\s*\S/.test(l) && !/^\d{1,2}[.)]\d/.test(l);
      if (stmt || /^[•\-–]\s/.test(l)) out.push(l); else out[out.length - 1] += " " + l;
    });
    return out.join("\n");
  }
  function hits(a, b) { return a.x0 < b.x + b.w && a.x1 > b.x && a.y0 < b.y + b.h && a.y1 > b.y; }
  function wtext(ws) { return ws.map(function (w) { return w.t; }).join(" ").replace(/\s+/g, " ").trim(); }

  /* ---- əsas analiz: sözlər + şəkil → suallar ---- */
  function analyze(img, words, overlays) {
    overlays = overlays || [];
    var figs = findFigures(img, words, overlays);
    var inFig = function (wd) { var cx = (wd.x0 + wd.x1) / 2, cy = (wd.y0 + wd.y1) / 2; return figs.some(function (f) { return cx >= f.x0 && cx <= f.x1 && cy >= f.y0 && cy <= f.y1; }); };
    var lines = groupLines(words.filter(function (wd) { return !inFig(wd); }));
    var firsts = lines.map(function (L) { return L.words[0].x0; }).sort(function (a, b) { return a - b; }), lm = firsts.length ? firsts[Math.floor(firsts.length * 0.1)] : 0, tol = img.w * 0.07;
    var ev = [];
    lines.forEach(function (L) { ev.push({ k: "L", y: L.y0, L: L }); });
    figs.forEach(function (F) { ev.push({ k: "F", y: F.y0, F: F }); });
    ev.sort(function (a, b) { return a.y - b.y; });
    var qs = [], cur = null, last = 0, pending = [], nextCut = false;
    function mkQ(num, noStem) {
      cur = { num: num, stem: [], opt: [], optConf: [], optBox: null, segBoxes: [], figs: pending.splice(0), cut: nextCut, noStem: !!noStem, lastIdx: -1, lastOpt: -1 };
      nextCut = false; qs.push(cur); if (num !== "") last = num; return cur;
    }
    function addOpt(li, text, box, conf) {
      cur.opt[li] = ((cur.opt[li] ? cur.opt[li] + " " : "") + text).trim();
      cur.optConf[li] = (cur.optConf[li] || []).concat(conf);
      cur.segBoxes[li] = union(cur.segBoxes[li], box); cur.optBox = union(cur.optBox, box);
      cur.lastOpt = li; if (li > cur.lastIdx) cur.lastIdx = li;
    }
    ev.forEach(function (e) {
      if (e.k === "F") {
        if (cur && cur.lastIdx < 0 && cur.stem.length) cur.figs.push(e.F); else pending.push(e.F);
        return;
      }
      var L = e.L, ws = L.words;
      if (overlays.some(function (r) { return hits({ x0: L.box.x0 - 40, y0: L.box.y0 - 4, x1: L.box.x1 + 40, y1: L.box.y1 + 4 }, r); })) { if (cur) cur.cut = true; nextCut = true; return; }
      var f = ws[0], qm = QN.exec(f.t), nOpts = cur ? cur.opt.filter(Boolean).length : 0;
      if (qm && f.x0 <= lm + tol && (!cur || nOpts >= 2)) {
        var n = +qm[1];
        if ((!cur && n >= 1 && n <= 300) || (cur && (n === last + 1 || (n > last && n <= last + 5)))) {
          mkQ(n, false);
          var rest = (qm[2] ? [qm[2]] : []).concat(ws.slice(1).map(function (w) { return w.t; })).join(" ").trim();
          if (rest) cur.stem.push(rest);
          return;
        }
      }
      /* variant işarələri */
      var idxs = [], lastIdx = cur ? cur.lastIdx : -1;
      for (var i = 0; i < ws.length; i++) {
        var m = MK.exec(ws[i].t); if (!m) continue;
        var li = m[1].charCodeAt(0) - 65, ok = false;
        if (i === 0) ok = true; else if (li === lastIdx + 1) ok = true;
        if (ok) { idxs.push({ i: i, li: li, rest: m[2] }); lastIdx = li; }
      }
      if (idxs.length) {
        if (!cur || (idxs[0].i === 0 && idxs[0].li <= cur.lastIdx)) mkQ("", true);
        if (idxs[0].i > 0) {                                       // sətrin əvvəlindəki söz(lər) əvvəlki variantın davamıdır
          var pre = ws.slice(0, idxs[0].i);
          if (cur.lastOpt >= 0) addOpt(cur.lastOpt, wtext(pre), wordBox(pre), pre.map(function (w) { return w.c; })); else cur.stem.push(wtext(pre));
        }
        idxs.forEach(function (it, k) {
          var end = k + 1 < idxs.length ? idxs[k + 1].i : ws.length, seg = ws.slice(it.i, end);
          var text = ((it.rest ? it.rest + " " : "") + wtext(seg.slice(1))).trim();
          addOpt(it.li, text, wordBox(seg), seg.map(function (w) { return w.c; }));
        });
        return;
      }
      if (!cur) return;
      if (cur.lastIdx < 0) cur.stem.push(wtext(ws));
      else if (cur.lastOpt >= 0) addOpt(cur.lastOpt, wtext(ws), L.box, ws.map(function (w) { return w.c; }));
    });
    if (pending.length && qs.length) qs[qs.length - 1].figs = qs[qs.length - 1].figs.concat(pending);
    return qs.map(function (q) {
      var cnt = q.opt.filter(Boolean).length, sym = false, low = false;
      q.opt.forEach(function (t, li) {
        if (t == null) return;
        var conf = (q.optConf[li] || []).filter(function (c) { return c != null; }), avg = conf.length ? conf.reduce(function (a, b) { return a + b; }, 0) / conf.length : 100;
        if (/[→←↑↓]/.test(t) || /[<>«»][-—–]*\s*$/.test(t) || /\+\s*$/.test(t)) sym = true;
        if (q.segBoxes[li] && colorCount(img, q.segBoxes[li]) >= 40) sym = true;
        if (avg < 45 && t.length <= 14) sym = true;
        if (avg < 60) low = true;
      });
      var optRect = null;
      if (sym && q.optBox) optRect = { x0: Math.max(0, q.optBox.x0 - 10), y0: Math.max(0, q.optBox.y0 - 8), x1: Math.min(img.w, q.optBox.x1 + 10), y1: Math.min(img.h, q.optBox.y1 + 8) };
      var letters = []; for (var k = 0; k <= q.lastIdx; k++) letters.push(String.fromCharCode(65 + k));
      var opts = []; for (var j = 0; j < 5; j++) opts.push(sym ? (j <= q.lastIdx ? String.fromCharCode(65 + j) : "") : tidy(q.opt[j] || ""));
      return { num: q.num, text: tidy(joinStem(q.stem)), opts: opts, symbolic: sym, figs: q.figs, optRect: optRect, cut: q.cut, noStem: q.noStem && !q.stem.length, low: low, count: cnt };
    });
  }

  var core = { findPaper: findPaper, findOverlays: findOverlays, cleanPage: cleanPage, findGutter: findGutter, cropImg: cropImg, groupLines: groupLines, findFigures: findFigures, analyze: analyze, tidy: tidy, colorCount: colorCount };
  if (typeof window !== "undefined") window.__DQPO_CORE = core;

  /* ═════════ B. BRAUZER HİSSƏSİ: fayl → OCR/PDF mətni → kartlar → sınağa əlavə ═════════ */
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var LET = ["A", "B", "C", "D", "E"];
  var SB_URL = "https://cpzwliqlgaplroscvduo.supabase.co", SB_KEY = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
  var P = { qs: [], uid: 0, busy: false, built: false };

  function sb() {
    try { if (typeof _supabase !== "undefined" && _supabase) return _supabase; } catch (e) {}
    if (!window.__qsSb) window.__qsSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__qsSb;
  }
  function structure() {
    try { if (typeof examStructure !== "undefined" && examStructure && examStructure.length) return examStructure; } catch (e) {}
    return [{ title: "Azərbaycan dili", start: 1, end: 15 }, { title: "Qanunvericilik", start: 16, end: 55 }, { title: "İnformatika", start: 56, end: 70 }, { title: "Məntiq", start: 71, end: 100 }];
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function mk(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function msg(t, kind) {
    var el = $("po-msg"); if (!el) return;
    el.className = "po-msg" + (kind ? " " + kind : ""); el.textContent = t || "";
    if (t && kind !== "err") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function prog(p) { var b = $("po-prog"); if (!b) return; b.style.display = "block"; b.firstChild.style.width = Math.max(0, Math.min(100, p)) + "%"; }
  function imgOf(c) { var d = c.getContext("2d").getImageData(0, 0, c.width, c.height); return { w: c.width, h: c.height, data: d.data }; }
  function canvasOf(img) { var c = mk(img.w, img.h); c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0); return c; }
  function cropURL(cv, r, q) {
    var x = Math.max(0, r.x0), y = Math.max(0, r.y0), w = Math.min(cv.width, r.x1) - x, h = Math.min(cv.height, r.y1) - y;
    if (w < 8 || h < 8) return null;
    var c = mk(w, h), g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(cv, x, y, w, h, 0, 0, w, h);
    return c.toDataURL("image/jpeg", q || 0.9);
  }

  /* ---- fayl yükləmə ---- */
  function fileToCanvas(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 3600 / Math.max(im.naturalWidth, im.naturalHeight)), c = mk(im.naturalWidth * s, im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c);
      };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error("Şəkil açılmadı: " + file.name)); };
      im.src = url;
    });
  }
  function pdfWords(tc, vp) {                      // PDF mətn qatı → söz qutuları (piksel koordinatı)
    var out = [], U = window.pdfjsLib.Util;
    tc.items.forEach(function (it) {
      var s = it.str; if (!s || !s.trim()) return;
      var tx = U.transform(vp.transform, it.transform), fh = Math.hypot(tx[2], tx[3]) || 10, wpx = (it.width || 0) * vp.scale, x = tx[4], yb = tx[5], n = s.length;
      var re = /\S+/g, m;
      while ((m = re.exec(s))) {
        var a = x + wpx * (m.index / n), b = x + wpx * ((m.index + m[0].length) / n);
        out.push({ t: m[0], c: 100, x0: a, y0: yb - fh * 0.85, x1: b, y1: yb + fh * 0.2 });
      }
    });
    return out;
  }
  async function pdfPages(file, onP) {
    if (!window.__dqLibs) throw new Error("PDF kitabxanası tapılmadı (__dqLibs).");
    await window.__dqLibs("pdf");
    var pdf = await window.pdfjsLib.getDocument(new Uint8Array(await file.arrayBuffer())).promise, out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i), base = pg.getViewport({ scale: 1 }), sc = Math.min(3, 1700 / base.width), vp = pg.getViewport({ scale: sc }), c = mk(vp.width, vp.height), cx = c.getContext("2d");
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: cx, viewport: vp }).promise;
      var tc = await pg.getTextContent(), words = pdfWords(tc, vp), chars = words.reduce(function (a, w) { return a + w.t.length; }, 0), bad = words.filter(function (w) { return /[\ue000-\uf8ff\ufffd]/.test(w.t); }).length;
      out.push({ canvas: c, words: (chars >= 60 && bad < words.length * 0.02) ? words : null, name: file.name + " s." + i });
      if (onP) onP(i, pdf.numPages);
    }
    return out;
  }

  /* ---- OCR ---- */
  var OCR = { w: null };
  async function getOcr() {
    if (OCR.w) return OCR.w;
    if (!window.__dqLibs) throw new Error("Kitabxana yükləyicisi (__dqLibs) tapılmadı.");
    await window.__dqLibs("ocr");
    OCR.w = await window.Tesseract.createWorker("aze+eng", 1, { logger: function (m) { if (m && m.status === "recognizing text") OCR.cb && OCR.cb(m.progress || 0); } });
    try { await OCR.w.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" }); } catch (e) {}
    return OCR.w;
  }
  function flatWords(d) {
    var out = [];
    ((d && d.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { out.push(w); }); }); }); });
    if (!out.length && d && d.words) out = d.words;
    return out;
  }
  async function ocrWords(part) {                  // part: {w,h,data} → söz qutuları (part koordinatı)
    var s = Math.min(2.5, Math.max(1, 1800 / part.w)), M = 30, c = mk(part.w * s + 2 * M, part.h * s + 2 * M), g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    var gray = new Uint8ClampedArray(part.data.length);                   // boz filiqran/rəngli fon → ağ, mətn qara
    for (var i = 0; i < gray.length; i += 4) {
      var v = Math.max(part.data[i], part.data[i + 1], part.data[i + 2]), o = v >= 200 ? 255 : v <= 110 ? 0 : (v - 110) * 255 / 90;
      gray[i] = gray[i + 1] = gray[i + 2] = o; gray[i + 3] = 255;
    }
    var tmp = mk(part.w, part.h); tmp.getContext("2d").putImageData(new ImageData(gray, part.w, part.h), 0, 0);
    g.imageSmoothingQuality = "high"; g.drawImage(tmp, M, M, part.w * s, part.h * s);
    var w = await getOcr(), res = await w.recognize(c, {}, { blocks: true, text: true });
    return flatWords(res && res.data).filter(function (x) { return x && String(x.text || "").trim() && x.bbox; }).map(function (x) {
      return { t: String(x.text).trim(), c: x.confidence, x0: (x.bbox.x0 - M) / s, y0: (x.bbox.y0 - M) / s, x1: (x.bbox.x1 - M) / s, y1: (x.bbox.y1 - M) / s };
    });
  }

  /* ---- bir səhifənin emalı ---- */
  async function processPage(srcCanvas, preWords, label, pageNo) {
    var pg = core.cleanPage(imgOf(srcCanvas)), g = core.findGutter(pg), parts = [];
    if (g) parts = [{ img: core.cropImg(pg, 0, 0, g - 4, pg.h), dx: 0 }, { img: core.cropImg(pg, g + 4, 0, pg.w - g - 4, pg.h), dx: g + 4 }];
    else parts = [{ img: pg, dx: 0 }];
    var out = [];
    for (var k = 0; k < parts.length; k++) {
      var part = parts[k], words;
      if (preWords) {
        words = preWords.map(function (w) { return { t: w.t, c: w.c, x0: w.x0 - pg.ox - part.dx, y0: w.y0 - pg.oy, x1: w.x1 - pg.ox - part.dx, y1: w.y1 - pg.oy }; })
          .filter(function (w) { return w.x1 > 0 && w.x0 < part.img.w && w.y1 > 0 && w.y0 < part.img.h; });
      } else {
        msg(label + (parts.length > 1 ? " (sütun " + (k + 1) + "/" + parts.length + ")" : "") + " oxunur…");
        OCR.cb = function (p) { prog((pageNo.i + (k + p) / parts.length) / pageNo.n * 100); };
        words = await ocrWords(part.img);
      }
      var ovs = pg.overlays.map(function (r) { return { x: r.x - part.dx, y: r.y, w: r.w, h: r.h }; });
      var cv = canvasOf(part.img), qs = core.analyze(part.img, words, ovs);
      qs.forEach(function (q) {
        out.push({
          id: ++P.uid, sel: false, num: q.num, text: q.text, opts: q.opts.slice(), correct: null, nOpt: Math.max(4, q.opts.reduce(function (a, o, i) { return o ? i + 1 : a; }, 0)),
          figs: q.figs.map(function (f) { return cropURL(cv, f, 0.9); }).filter(Boolean), optUrl: q.optRect ? cropURL(cv, q.optRect, 0.92) : null,
          symbolic: q.symbolic, cut: q.cut, noStem: q.noStem, low: q.low, page: label
        });
      });
    }
    return out;
  }
  async function onFiles(files) {
    if (P.busy) return;
    files = Array.prototype.slice.call(files || []).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    if (!files.length) return;
    P.busy = true; $("po-drop").style.pointerEvents = "none";
    var found = [];
    try {
      var pages = [];
      for (var f = 0; f < files.length; f++) {
        var file = files[f];
        if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
          msg("PDF açılır: " + file.name);
          pages = pages.concat(await pdfPages(file, function (i, n) { msg("PDF səhifələri hazırlanır: " + i + "/" + n); }));
        } else pages.push({ canvas: await fileToCanvas(file), words: null, name: file.name });
      }
      var pn = { i: 0, n: pages.length };
      for (var i = 0; i < pages.length; i++) {
        pn.i = i; prog(i / pages.length * 100);
        msg((pages[i].words ? "Mətn qatı oxunur: " : "OCR: ") + pages[i].name + " (" + (i + 1) + "/" + pages.length + ")" + (OCR.w || pages[i].words ? "" : " — ilk dəfə 20–40 san ola bilər"));
        found = found.concat(await processPage(pages[i].canvas, pages[i].words, pages[i].name, pn));
      }
      prog(100);
      /* səhifə sonunda kəsilmiş sual: başlıqsız (örtülməyib) parçanı əvvəlkinə qoş */
      var res = [];
      found.forEach(function (q) { var p = res[res.length - 1]; if (p && q.noStem && !q.cut && !q.text) mergeInto(p, q); else res.push(q); });
      P.qs = P.qs.concat(res); renderList();
      var nf = res.reduce(function (a, q) { return a + q.figs.length; }, 0), ns = res.filter(function (q) { return q.symbolic; }).length;
      msg(res.length ? "✅ " + res.length + " sual çıxarıldı" + (nf ? ", " + nf + " fiqur kəsildi" : "") + (ns ? ", " + ns + " sualın variantları şəkil kimi saxlandı" : "") + ". Mətni yoxlayın, düzgün cavabı seçin, sonra sınağa əlavə edin." : "Sual tapılmadı. Şəkildə «1.» və «A)» formatı olmalıdır — ➕ Boş sual ilə əl ilə də daxil edə bilərsiniz.", res.length ? "ok" : "err");
    } catch (e) { console.error(e); msg("❌ " + (e.message || e), "err"); }
    P.busy = false; $("po-drop").style.pointerEvents = ""; setTimeout(function () { var b = $("po-prog"); if (b) b.style.display = "none"; }, 1500);
  }

  /* ---- siyahı ---- */
  function find(id) { for (var i = 0; i < P.qs.length; i++) if (P.qs[i].id === id) return i; return -1; }
  function mergeInto(a, b) {
    if (b.text) a.text = (a.text ? a.text + "\n" : "") + b.text;
    for (var k = 0; k < 5; k++) { if (!a.opts[k]) a.opts[k] = b.opts[k] || ""; else if (b.opts[k]) a.opts[k] += " " + b.opts[k]; }
    a.figs = a.figs.concat(b.figs); a.optUrl = a.optUrl || b.optUrl; a.symbolic = a.symbolic || b.symbolic; a.cut = b.cut; a.nOpt = Math.max(a.nOpt, b.nOpt);
  }
  function tags(q) {
    var t = "";
    if (q.cut) t += '<span class="po-tag w">⚠ üstü örtülüb / yarımçıq</span>';
    if (q.noStem) t += '<span class="po-tag w">⚠ sual mətni yoxdur</span>';
    if (q.symbolic) t += '<span class="po-tag i">🖼 variantlar şəkil kimi saxlanır</span>';
    if (q.low && !q.symbolic) t += '<span class="po-tag w">🔍 OCR zəifdir — yoxlayın</span>';
    if (q.correct == null) t += '<span class="po-tag w">cavab seçilməyib</span>';
    return t;
  }
  function cardHtml(q, pos) {
    var h = '<div class="po-card' + (q.sel ? " sel" : "") + '" data-id="' + q.id + '"><label class="po-sel"><input type="checkbox" class="po-ck"' + (q.sel ? " checked" : "") + '><span>' + (pos + 1) + '</span></label><div class="po-body">' +
      '<div class="po-top"><input class="po-in po-num" type="number" placeholder="№" value="' + esc(q.num) + '"><span class="po-tag">' + esc(q.page || "") + '</span><span class="po-tags">' + tags(q) + '</span></div>' +
      '<textarea class="po-in po-t" placeholder="Sual mətni">' + esc(q.text) + '</textarea>';
    q.figs.forEach(function (u, i) {
      h += '<div class="po-img"><img src="' + u + '"><div class="po-ib"><button class="po-b o s" data-act="fup" data-i="' + i + '" title="Əvvəlki suala keçir">⬆</button><button class="po-b o s" data-act="fdn" data-i="' + i + '" title="Növbəti suala keçir">⬇</button><button class="po-b r s" data-act="frm" data-i="' + i + '">✕</button></div></div>';
    });
    if (q.optUrl) h += '<div class="po-img opt"><img src="' + q.optUrl + '"><div class="po-ib"><span class="po-tag i">variantlar</span><button class="po-b r s" data-act="orm">✕</button></div></div>';
    for (var i = 0; i < q.nOpt; i++) {
      h += '<div class="po-o"><button class="po-r' + (q.correct === i ? " on" : "") + '" data-act="cor" data-i="' + i + '">' + LET[i] + '</button><input class="po-in po-ov" data-i="' + i + '" value="' + esc(q.opts[i]) + '" placeholder="Variant ' + LET[i] + '"></div>';
    }
    h += '<div class="po-bt"><button class="po-b o s" data-act="addo"' + (q.nOpt >= 5 ? " disabled" : "") + '>＋ Variant</button><button class="po-b o s" data-act="delo"' + (q.nOpt <= 2 ? " disabled" : "") + '>－ Variant</button>' +
      '<button class="po-b o s" data-act="merge">↧ Növbətilə birləşdir</button><button class="po-b o s" data-act="img">📷 Şəkil</button><button class="po-b r s" data-act="del">🗑 Sil</button></div></div></div>';
    return h;
  }
  function renderList() {
    $("po-qwrap").style.display = P.qs.length ? "block" : "none";
    $("po-list").innerHTML = P.qs.map(cardHtml).join("");
    $("po-list").querySelectorAll(".po-t").forEach(grow);
    counts();
    var s = guessSubject(); if (s >= 0 && !$("po-subj").dataset.touched) $("po-subj").value = s;
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.max(80, t.scrollHeight + 4) + "px"; }
  function counts() { $("po-cnt").textContent = P.qs.length; $("po-selcnt").textContent = P.qs.filter(function (q) { return q.sel; }).length; }
  function guessSubject() {
    var st = structure(), best = -1, bc = 0;
    st.forEach(function (s, i) { var c = P.qs.filter(function (q) { var n = parseInt(q.num); return n >= s.start && n <= s.end; }).length; if (c > bc) { bc = c; best = i; } });
    return best;
  }
  function listClick(e) {
    var b = e.target.closest("[data-act]"), ck = e.target.closest(".po-ck");
    var card = e.target.closest(".po-card"); if (!card) return;
    var i = find(+card.dataset.id), q = P.qs[i]; if (!q) return;
    if (ck && !b) { q.sel = ck.checked; card.classList.toggle("sel", q.sel); counts(); return; }
    if (!b) return;
    var a = b.dataset.act, k = +b.dataset.i;
    if (a === "cor") { q.correct = q.correct === k ? null : k; renderList(); }
    else if (a === "addo") { if (q.nOpt < 5) q.nOpt++; renderList(); }
    else if (a === "delo") { if (q.nOpt > 2) { q.opts[q.nOpt - 1] = ""; q.nOpt--; if (q.correct != null && q.correct >= q.nOpt) q.correct = null; } renderList(); }
    else if (a === "del") { P.qs.splice(i, 1); renderList(); }
    else if (a === "merge") { if (P.qs[i + 1]) { mergeInto(q, P.qs[i + 1]); P.qs.splice(i + 1, 1); renderList(); } else msg("Birləşdirmək üçün növbəti sual yoxdur.", "err"); }
    else if (a === "frm") { q.figs.splice(k, 1); renderList(); }
    else if (a === "orm") { q.optUrl = null; q.symbolic = false; renderList(); }
    else if (a === "fup" || a === "fdn") {
      var j = a === "fup" ? i - 1 : i + 1; if (!P.qs[j]) return msg("Köçürmək üçün qonşu sual yoxdur.", "err");
      P.qs[j].figs.push(q.figs.splice(k, 1)[0]); renderList();
    }
    else if (a === "img") { var f = $("po-imgfile"); f.onchange = function () { var fl = f.files[0]; f.value = ""; if (!fl) return; fileToCanvas(fl).then(function (c) { q.figs.push(c.toDataURL("image/jpeg", 0.9)); renderList(); }).catch(function (er) { msg("❌ " + er.message, "err"); }); }; f.click(); }
  }
  function listInput(e) {
    var t = e.target, card = t.closest(".po-card"); if (!card) return;
    var q = P.qs[find(+card.dataset.id)]; if (!q) return;
    if (t.classList.contains("po-t")) { q.text = t.value; grow(t); }
    else if (t.classList.contains("po-num")) q.num = t.value;
    else if (t.classList.contains("po-ov")) q.opts[+t.dataset.i] = t.value;
  }

  /* ---- sınağa əlavə ---- */
  function subj() { return structure()[+$("po-subj").value] || structure()[0]; }
  function selCats() { return Array.prototype.map.call(document.querySelectorAll(".po-cat:checked"), function (x) { return x.value; }); }
  async function usedNums(exam, cat, s) {
    var r = await sb().from("exam_questions").select("id,q_number").eq("exam_id", exam).eq("category", cat).gte("q_number", s.start).lte("q_number", s.end);
    if (r.error) throw r.error;
    var m = {}; (r.data || []).forEach(function (x) { m[x.q_number] = x.id; }); return m;
  }
  async function checkFree() {
    var exam = $("po-exam").value.trim(), cats = selCats(), s = subj();
    if (!exam || !cats.length) return msg("Sınaq № və kateqoriya seçin.", "err");
    try {
      var lines = [];
      for (var c of cats) { var u = await usedNums(exam, c, s), used = Object.keys(u).length, tot = s.end - s.start + 1; lines.push(c + ": " + s.title + " (" + s.start + "–" + s.end + ") — " + used + " dolu, " + (tot - used) + " boş"); }
      $("po-free").textContent = lines.join("\n");
    } catch (e) { msg("❌ " + e.message, "err"); }
  }
  function loadImg(u) { return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = u; }); }
  async function composeImage(q) {
    var urls = q.figs.slice(); if (q.optUrl) urls.push(q.optUrl);
    if (!urls.length) return null;
    if (urls.length === 1) return urls[0];
    var ims = []; for (var i = 0; i < urls.length; i++) ims.push(await loadImg(urls[i]));
    var w = Math.max.apply(null, ims.map(function (m) { return m.width; })), h = ims.reduce(function (a, m) { return a + m.height; }, 0) + 14 * (ims.length - 1), c = mk(w, h), g = c.getContext("2d"), y = 0;
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    ims.forEach(function (m) { g.drawImage(m, 0, y); y += m.height + 14; });
    return c.toDataURL("image/jpeg", 0.88);
  }
  async function addSelected() {
    if (P.busy) return;
    var sel = P.qs.filter(function (q) { return q.sel; });
    if (!sel.length) return msg("Əvvəlcə sualları seçin (sol tərəfdəki qutular).", "err");
    var exam = $("po-exam").value.trim(), cats = selCats(), s = subj(), mode = $("po-mode").value, man = parseInt($("po-start").value) || 0;
    if (!exam) return msg("Sınaq nömrəsini yazın.", "err");
    if (!cats.length) return msg("Ən azı 1 kateqoriya seçin.", "err");
    var bad = [];
    sel.forEach(function (q) {
      var n = q.opts.slice(0, q.nOpt).filter(function (o) { return o.trim(); }).length;
      if (!q.text.trim() && !q.figs.length) bad.push("sual mətni boşdur (№" + (q.num || "?") + ")");
      else if (n < 2) bad.push("variant azdır (№" + (q.num || "?") + ")");
    });
    if (bad.length) return msg("❌ Düzəldin:\n" + bad.slice(0, 8).join("\n"), "err");
    var noCor = sel.filter(function (q) { return q.correct == null; }).length;
    if (noCor && !confirm(noCor + " sualda düzgün cavab seçilməyib — onlara 'A' yazılacaq. Davam edilsin?")) return;
    if (!confirm(sel.length + " sual → Sınaq " + exam + " / " + cats.join(", ") + " / " + s.title + " (" + s.start + "–" + s.end + ")\nDavam edilsin?")) return;
    P.busy = true; $("po-add").disabled = true;
    var report = [], okIds = {}, anyErr = false;
    try {
      var images = {}; for (var z = 0; z < sel.length; z++) images[sel[z].id] = await composeImage(sel[z]);
      for (var ci = 0; ci < cats.length; ci++) {
        var cat = cats[ci], used = await usedNums(exam, cat, s), nums = [], start = Math.min(s.end, Math.max(s.start, man || s.start)), skipped = 0, k, n;
        if (mode === "num") { sel.forEach(function (q) { var v = parseInt(q.num); if (v >= s.start && v <= s.end) nums.push(v); else { nums.push(null); skipped++; } }); }
        else if (mode === "gaps") { for (n = start; n <= s.end && nums.length < sel.length; n++) if (!used[n]) nums.push(n); }
        else { for (n = start; n <= s.end && nums.length < sel.length; n++) nums.push(n); }
        if (skipped && !confirm(cat + ": " + skipped + " sualın nömrəsi " + s.title + " aralığından (" + s.start + "–" + s.end + ") kənardadır, onlar əlavə olunmayacaq. Davam?")) { report.push(cat + ": ləğv edildi"); continue; }
        if (mode !== "num" && nums.length < sel.length && !confirm(cat + ": yalnız " + nums.length + " yer var, " + (sel.length - nums.length) + " sual əlavə olunmayacaq. Davam?")) { report.push(cat + ": ləğv edildi"); continue; }
        var over = nums.filter(function (v) { return v != null && used[v]; }).length;
        if (mode !== "gaps" && over && !confirm(cat + ": " + over + " dolu nömrənin üzərinə yazılacaq. Davam?")) { report.push(cat + ": ləğv edildi"); continue; }
        var okCount = 0, first = null, lastN = null;
        for (k = 0; k < nums.length && k < sel.length; k++) {
          if (nums[k] == null) continue;
          var q = sel[k], opts = q.opts.slice(0, q.nOpt).map(function (o) { return { text: o.trim(), image: null }; });
          while (opts.length > 2 && !opts[opts.length - 1].text) opts.pop();
          var row = { exam_id: exam, category: cat, q_number: nums[k], subject: s.title, question: q.text.trim(), image_url: images[q.id] || null, options: opts, correct: q.correct == null ? 0 : q.correct };
          var res = used[nums[k]] && mode !== "gaps" ? await sb().from("exam_questions").update(row).eq("id", used[nums[k]]) : await sb().from("exam_questions").insert([row]);
          if (res.error) { anyErr = true; report.push(cat + " №" + nums[k] + ": " + res.error.message); }
          else { okCount++; okIds[q.id] = (okIds[q.id] || 0) + 1; if (first == null) first = nums[k]; lastN = nums[k]; }
        }
        if (okCount) report.push("✅ " + cat + ": " + okCount + " sual → " + first + (lastN !== first ? "–" + lastN : ""));
      }
      if (!anyErr && $("po-rm").checked) { P.qs = P.qs.filter(function (q) { return !(q.sel && okIds[q.id] === cats.length); }); renderList(); }
      msg(report.join("\n"), anyErr ? "err" : "ok"); checkFree();
    } catch (e) { msg("❌ " + e.message, "err"); }
    P.busy = false; $("po-add").disabled = false;
  }

  /* ---- interfeys ---- */
  var CSS = '.po-h{font-size:12px;color:#64748b;margin:4px 0 10px}.po-box{border:1.5px solid #e2e8f0;border-radius:14px;padding:12px;margin:10px 0;background:#fff}.po-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}' +
    '.po-drop{border:2px dashed #94a3b8;border-radius:16px;padding:22px 12px;text-align:center;cursor:pointer;background:#f8fafc;font-weight:700}.po-b{border:0;border-radius:10px;padding:10px 14px;font:700 14px inherit;cursor:pointer;background:#2563eb;color:#fff}.po-b.o{background:#e2e8f0;color:#0f172a}.po-b.g{background:#059669}.po-b.r{background:#fee2e2;color:#b91c1c}.po-b.s{padding:6px 10px;font-size:12px}.po-b:disabled{opacity:.5}' +
    '.po-in{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:14px inherit;background:#fff;color:#0f172a;width:100%;box-sizing:border-box}.po-in.po-t{min-height:80px;resize:vertical}' +
    '.po-prog{display:none;height:8px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin:8px 0}.po-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width .2s}' +
    '.po-msg{white-space:pre-line;font-size:13px;border-radius:10px;padding:0}.po-msg:not(:empty){padding:10px 12px;margin:8px 0;background:#eff6ff;color:#1e3a8a}.po-msg.ok{background:#dcfce7;color:#166534}.po-msg.err{background:#fee2e2;color:#991b1b}' +
    '.po-card{display:flex;gap:10px;border:1.5px solid #e2e8f0;border-radius:14px;padding:10px;margin:10px 0;background:#fff}.po-card.sel{border-color:#2563eb;background:#f8fbff}.po-sel{display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:12px}.po-body{flex:1;min-width:0}' +
    '.po-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.po-num{width:76px!important}.po-tag{font-size:11px;background:#e2e8f0;border-radius:8px;padding:3px 7px;font-weight:700}.po-tag.w{background:#fef3c7;color:#92400e}.po-tag.i{background:#dbeafe;color:#1e40af}' +
    '.po-img{position:relative;margin:8px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff}.po-img img{display:block;max-width:100%;margin:auto}.po-ib{position:absolute;top:4px;right:4px;display:flex;gap:4px}' +
    '.po-o{display:flex;gap:8px;align-items:center;margin-top:6px}.po-r{flex:0 0 34px;height:34px;border-radius:50%;border:2.5px solid #0f2a5c;color:#0f2a5c;font-weight:800;background:#fff;cursor:pointer}.po-r.on{background:#0f2a5c;color:#fff}' +
    '.po-bt{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.po-cats label{display:inline-flex;gap:4px;border:1.5px solid #cbd5e1;border-radius:20px;padding:6px 12px;margin:2px 4px 2px 0;font-weight:700;cursor:pointer}.po-bar{position:sticky;bottom:0;background:#fff;border-top:2px solid #e2e8f0;padding:12px;margin-top:12px;border-radius:12px 12px 0 0}';
  function build() {
    if (P.built && $("mod-pdfoxu") && $("po-list")) return;
    var host = $("admin-panel"); if (!host) return;
    if (!$("po-css")) { var st = document.createElement("style"); st.id = "po-css"; st.textContent = CSS; document.head.appendChild(st); }
    var d = $("mod-pdfoxu");
    if (!d) { d = document.createElement("div"); d.id = "mod-pdfoxu"; d.className = "admin-module-block"; host.appendChild(d); }
    d.innerHTML =
      '<h4>📄 PDF Pro Oxuma (şəkil / PDF → sual + variant + fiqur → sınağa əlavə)</h4>' +
      '<p class="po-h">PDF, Word/Office ekran görüntüsü və ya skan yükləyin. Sistem tünd interfeysi və üstə düşən lövhələri atır, səhifəni təmizləyir, iki sütunu ayırır, sualları və A–E variantlarını çıxarır. Sualın şəkli (cədvəl, ekran, sxem) sualla birgə saxlanır; loqo/ox kimi simvol variantları şəkil kimi kəsilir ki, məzmun pozulmasın.</p>' +
      '<div class="po-box"><div class="po-drop" id="po-drop">📤 Şəkil(lər) və ya PDF seçin<br><small style="font-weight:500;color:#64748b">Bir neçə fayl seçə bilərsiniz · sıra fayl adına görə</small></div>' +
      '<input type="file" id="po-file" accept="image/*,application/pdf" multiple style="display:none"><input type="file" id="po-imgfile" accept="image/*" style="display:none">' +
      '<div class="po-prog" id="po-prog"><i></i></div><div class="po-msg" id="po-msg"></div>' +
      '<div class="po-row"><button class="po-b o" id="po-blank">➕ Boş sual</button></div></div>' +
      '<div id="po-qwrap" style="display:none"><div class="po-box"><b>Suallar — <span id="po-cnt">0</span> sual, <span id="po-selcnt">0</span> seçilib</b>' +
      '<div class="po-row"><button class="po-b o s" id="po-all">☑ Hamısını seç</button><button class="po-b o s" id="po-none">☐ Seçimi sil</button><button class="po-b r s" id="po-clear">🗑 Siyahını təmizlə</button></div></div>' +
      '<div id="po-list"></div>' +
      '<div class="po-bar"><b>Sınağa əlavə et</b><div class="po-row"><label>Sınaq №<br><input class="po-in" style="width:90px" id="po-exam" list="po-exams" placeholder="2"></label><datalist id="po-exams"></datalist>' +
      '<label>Fənn<br><select class="po-in" id="po-subj"></select></label></div>' +
      '<div class="po-row po-cats" id="po-cats">' + ["BA", "BB", "AC", "AB"].map(function (c) { return '<label><input type="checkbox" class="po-cat" value="' + c + '">' + c + '</label>'; }).join("") + '</div>' +
      '<div class="po-row"><label>Rejim<br><select class="po-in" id="po-mode"><option value="num">Mənbə sual nömrəsi ilə (56 → 56)</option><option value="gaps">Boş nömrələrə yerləşdir</option><option value="over">Başlanğıc nömrədən üzərinə yaz</option></select></label>' +
      '<label>Başlanğıc №<br><input class="po-in" style="width:90px" type="number" id="po-start" placeholder="avto"></label></div>' +
      '<div class="po-row"><label><input type="checkbox" id="po-rm" checked> Əlavə olunanları siyahıdan çıxar</label></div>' +
      '<div class="po-h" id="po-free" style="white-space:pre-line"></div>' +
      '<div class="po-row"><button class="po-b o" id="po-chk">🔎 Boş yerləri yoxla</button><button class="po-b g" id="po-add" style="flex:1">➕ Seçilənləri sınağa əlavə et</button></div></div></div>';
    P.built = true; wire(); loadExams();
  }
  function wire() {
    var f = $("po-file");
    $("po-drop").onclick = function () { f.click(); };
    f.onchange = function () { var fl = f.files; onFiles(fl); setTimeout(function () { f.value = ""; }, 0); };
    var dr = $("po-drop");
    dr.ondragover = function (e) { e.preventDefault(); }; dr.ondrop = function (e) { e.preventDefault(); onFiles(e.dataTransfer.files); };
    $("po-blank").onclick = function () { P.qs.push({ id: ++P.uid, sel: false, num: "", text: "", opts: ["", "", "", "", ""], correct: null, nOpt: 4, figs: [], optUrl: null, symbolic: false, cut: false, noStem: false, low: false, page: "" }); renderList(); };
    var L = $("po-list"); L.addEventListener("click", listClick); L.addEventListener("input", listInput);
    $("po-all").onclick = function () { P.qs.forEach(function (q) { q.sel = true; }); renderList(); };
    $("po-none").onclick = function () { P.qs.forEach(function (q) { q.sel = false; }); renderList(); };
    $("po-clear").onclick = function () { if (confirm("Bütün siyahı təmizlənsin?")) { P.qs = []; renderList(); } };
    var sj = $("po-subj"); sj.innerHTML = structure().map(function (s, i) { return '<option value="' + i + '">' + esc(s.title) + " (" + s.start + "–" + s.end + ")</option>"; }).join("");
    sj.onchange = function () { sj.dataset.touched = "1"; };
    $("po-chk").onclick = checkFree; $("po-add").onclick = addSelected;
  }
  async function loadExams() {
    try {
      var r = await sb().from("exam_questions").select("exam_id").limit(3000), seen = {};
      (r.data || []).forEach(function (x) { seen[x.exam_id] = 1; });
      $("po-exams").innerHTML = Object.keys(seen).sort(function (a, b) { return a - b; }).map(function (v) { return '<option value="' + esc(v) + '">'; }).join("");
    } catch (e) {}
  }
  if (typeof document === "undefined") return;     // (node testləri üçün)
  /* ---- admin panelə qoşulma ---- */
  function ensure() {
    var panel = $("admin-panel"); if (!panel) return false;
    if (!$("mod-pdfoxu")) { var d = document.createElement("div"); d.id = "mod-pdfoxu"; d.className = "admin-module-block"; panel.appendChild(d); }
    var grid = panel.querySelector(".admin-nav-grid");
    if (grid && !grid.querySelector("[data-po-card]")) {
      var c = document.createElement("div"); c.className = "admin-nav-card"; c.setAttribute("data-po-card", "1"); c.setAttribute("onclick", "DQPO.open()");
      c.style.cssText = "background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff"; c.innerHTML = '<span class="icon">📄</span> PDF Pro Oxuma (Sual Bankı)';
      grid.insertBefore(c, grid.firstChild);
    }
    return true;
  }
  window.DQPO = {
    version: "1.0.0",
    open: function () {
      ensure(); build();
      try { if (typeof switchAdminTab === "function") switchAdminTab("pdfoxu"); else { document.querySelectorAll(".admin-module-block").forEach(function (b) { b.style.display = "none"; }); $("mod-pdfoxu").style.display = "block"; } } catch (e) { console.error(e); }
    },
    _core: core
  };
  var n = 0, iv = setInterval(function () { try { ensure(); } catch (e) {} if (++n > 40) clearInterval(iv); }, 250);
  setInterval(function () { try { ensure(); } catch (e) {} }, 2000);

})();
