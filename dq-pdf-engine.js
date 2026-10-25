/* DQ Platform · dq-pdf-engine.js · v1
 * 1) DQPDF.core  – AI-siz PDF/şəkil → sual + variant ayırıcı (mətn qatı, 2 sütun, şəkil/fiqur kəsmə, OCR ehtiyat)
 * 2) "Sual Bankı (PDF & OCR)" – bütün PDF-i skan edir, sualları siyahı kimi göstərir, hamısını bazaya yazır
 * 3) "Şablonlar" – real şablonlar (V2 "templates"), Bax / Sil / Sınaqdan yarat / Sınağa yaz
 * Yükləmə: index.html-də app.js-dən SONRA <script src="dq-pdf-engine.js?v=1"></script>
 */
(function (root) {
  'use strict';
  var LET = 'ABCDE';
  var SUBJ_NAMES = ['azərbaycan dili', 'qanunvericilik', 'informatika', 'məntiq', 'riyaziyyat', 'tarix', 'ingilis dili', 'hüquq'];

  /* ───────────── ümumi köməkçilər ───────────── */
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, '')
      .replace(/[\u00a0\u2007\u202f\t]/g, ' ')
      .replace(/[ ]{2,}/g, ' ').trim();
  }
  function fixSchwa(s) { // OCR-da "m ə nası" → "mənası" (yalnız tək hərf + ə halı)
    if (!/(^|\s)[əƏ](\s|$)/.test(s)) return s;
    var t = s.split(/\s+/), out = [];
    for (var i = 0; i < t.length; i++) {
      var w = t[i];
      if (w === 'ə' || w === 'Ə') {
        var prev = out[out.length - 1];
        if (prev !== undefined && /^[A-Za-zƏəÖöÜüĞğIıİiŞşÇç]$/.test(prev)) {
          out[out.length - 1] = prev + w;
          if (i + 1 < t.length && /^[A-Za-zƏÖÜĞIİŞÇəöüğışç]/.test(t[i + 1]) && !/^[əƏ]$/.test(t[i + 1])) { out[out.length - 1] += t[i + 1]; i++; }
        } else if (prev !== undefined && i + 1 >= t.length) out[out.length - 1] = prev + w;
        else out.push(w);
      } else out.push(w);
    }
    return out.join(' ');
  }
  function mul(a, b) { // 2D affine [a,b,c,d,e,f]
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }
  function median(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
  function normKey(s) { return String(s || '').toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); }

  /* ───────────── sətirlərin qurulması (2 sütun) ───────────── */
  // items: [{s,x,y(top),w,h}] səhifə koordinatları (yuxarıdan aşağı, scale=1)
  function buildRows(items, pageW, pageNo) {
    items = items.filter(function (it) { return it.s && it.s.trim(); });
    if (!items.length) return [];
    var narrow = items.filter(function (it) { return it.w < pageW * 0.5; });
    var gx = gutter(narrow, pageW);
    var streams = { full: [], c0: [], c1: [] };
    items.forEach(function (it) {
      if (gx == null) { streams.c0.push(it); return; }
      if (it.x < gx - 2 && it.x + it.w > gx + 2) streams.full.push(it);
      else if (it.x + it.w / 2 < gx) streams.c0.push(it); else streams.c1.push(it);
    });
    var r0 = mk(streams.c0, 0), r1 = mk(streams.c1, 1), rf = mk(streams.full, 0);
    rf.forEach(function (r) { r.col = -1; });
    var colTop = Math.min.apply(null, r0.concat(r1).map(function (r) { return r.top; }).concat([1e9]));
    var head = rf.filter(function (r) { return r.top < colTop; }), rest = rf.filter(function (r) { return r.top >= colTop; });
    rest.forEach(function (r) { r.col = 0; });
    var left = r0.concat(rest).sort(function (a, b) { return a.top - b.top; });
    var all = head.concat(left, r1);
    all.forEach(function (r) { r.page = pageNo; r.gx = gx; });
    return all;

    function mk(list, col) {
      list = list.slice().sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x; });
      var rows = [];
      list.forEach(function (it) {
        var cy = it.y + it.h / 2, r = rows[rows.length - 1];
        if (r && Math.abs(cy - r.cy) <= Math.max(2.5, Math.min(r.h, it.h) * 0.55)) { r.items.push(it); r.cy = (r.cy * (r.items.length - 1) + cy) / r.items.length; r.h = Math.max(r.h, it.h); }
        else rows.push({ items: [it], cy: cy, h: it.h });
      });
      return rows.map(function (r) {
        r.items.sort(function (a, b) { return a.x - b.x; });
        var t = '', pe = null;
        r.items.forEach(function (it) {
          var gap = pe == null ? 0 : it.x - pe;
          if (pe != null && gap > it.h * 0.12 && !/\s$/.test(t) && !/^\s/.test(it.s)) t += ' ';
          t += it.s; pe = it.x + it.w;
        });
        var f = r.items[0], fs = f.s.trim();
        return {
          text: clean(t), col: col, x0: r.items[0].x, x1: Math.max.apply(null, r.items.map(function (i) { return i.x + i.w; })),
          top: Math.min.apply(null, r.items.map(function (i) { return i.y; })), bot: Math.max.apply(null, r.items.map(function (i) { return i.y + i.h; })),
          h: r.h, cy: r.cy, first: fs.toUpperCase(), firstSingle: fs.length === 1 && /[A-Ea-e]/.test(fs) && (r.items.length > 1 || true), nItems: r.items.length
        };
      }).filter(function (r) { return r.text; });
    }
  }
  function gutter(items, W) {
    var N = 200, cov = new Array(N).fill(0);
    if (items.length < 12) return null;
    items.forEach(function (it) {
      var a = Math.max(0, Math.floor(it.x / W * N)), b = Math.min(N - 1, Math.floor((it.x + it.w) / W * N));
      for (var k = a; k <= b; k++) cov[k]++;
    });
    var best = null;
    for (var k = Math.floor(N * 0.3); k <= Math.floor(N * 0.7); k++) {
      if (cov[k] !== 0) continue;
      var e = k; while (e + 1 < N && cov[e + 1] === 0) e++;
      if (e - k + 1 >= 2 && (!best || e - k + 1 > best.len)) best = { s: k, len: e - k + 1 };
      k = e;
    }
    if (!best) return null;
    var g = (best.s + best.len / 2) / N * W, L = 0, R = 0;
    items.forEach(function (it) { if (it.x + it.w <= g + 2) L++; else if (it.x >= g - 2) R++; });
    return (L >= 6 && R >= 6 && L + R >= items.length * 0.85) ? g : null;
  }

  /* ───────────── səs-küy (başlıq, su nişanı) ───────────── */
  function denoise(pages, userWords) {
    var words = (userWords || []).map(function (w) { return w.toLowerCase(); }).filter(Boolean);
    var cnt = {}, np = pages.length;
    pages.forEach(function (p) { var seen = {}; p.rows.forEach(function (r) { var k = normKey(r.text); if (k && !seen[k]) { seen[k] = 1; cnt[k] = (cnt[k] || 0) + 1; } }); });
    var out = [];
    pages.forEach(function (p) {
      p.rows.forEach(function (r) {
        var t = r.text, low = t.toLowerCase(), k = normKey(t);
        var edge = r.top < p.h * 0.1 || r.bot > p.h * 0.92;
        if (np >= 3 && edge && cnt[k] >= Math.ceil(np * 0.6)) return;
        if (edge && /^\d{1,3}$/.test(t)) return;
        if (/^\+?\d[\d\s()-]{8,}$/.test(t)) return;
        for (var i = 0; i < words.length; i++) if (low.indexOf(words[i]) > -1) return;
        out.push(r);
      });
    });
    return out;
  }

  /* ───────────── sual / variant ayırıcı ───────────── */
  var CIRC = { 'Ⓐ': 'A', 'Ⓑ': 'B', 'Ⓒ': 'C', 'Ⓓ': 'D', 'Ⓔ': 'E' };
  function qCand(r) {
    var m = r.text.match(/^\s*(?:sual\s*)?(\d{1,3})\s*[.)]\s*(.*)$/i);
    if (m) return { n: +m[1], rest: m[2] || '', punct: true };
    m = r.text.match(/^\s*(\d{1,3})\s+(\S.*)$/);
    if (m) return { n: +m[1], rest: m[2], punct: false };
    return null;
  }
  function optMark(r, want) { // want: gözlənilən hərf
    var t = r.text, m;
    if (CIRC[t.charAt(0)]) { if (CIRC[t.charAt(0)] === want) return { l: want, rest: t.slice(1).trim() }; return null; }
    m = t.match(/^[\(\[\{]?\s*([A-Ea-e])\s*[\)\].:]\s*(.*)$/);
    if (m && m[1].toUpperCase() === want) return { l: want, rest: m[2] };
    m = t.match(/^[\(\[\{@©®⊙○◯]\s*([A-Ea-e])\s*[\)\]\}]?\s+(.*)$/);
    if (m && m[1].toUpperCase() === want) return { l: want, rest: m[2] };
    if (r.firstSingle && r.first === want && (t.length === 1 || /^[A-Ea-e]\s+\S/.test(t))) return { l: want, rest: t.slice(1).trim() };
    return null;
  }
  function splitInline(text) { // "A) 3 B) 4 C) 5" → hissələr
    var re = /(?:^|\s)\(?([A-E])[.)]\s+(?=\S)/g, m, pos = [], prev = -1;
    while ((m = re.exec(text))) {
      var li = LET.indexOf(m[1]);
      if (li !== prev + 1) continue;
      pos.push({ i: m.index + (/\s/.test(m[0].charAt(0)) ? 1 : 0), l: m[1], len: m[0].length - (/\s/.test(m[0].charAt(0)) ? 1 : 0) }); prev = li;
    }
    return pos;
  }
  function isSubjectBanner(t) { var k = t.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim(); return k.length < 30 && SUBJ_NAMES.indexOf(k) > -1; }
  function isListLine(t) { return /^(?:\d{1,2}|[IVX]{1,4})\s*[.)]\s+\S/.test(t) || /^[-–•▪●]\s+\S/.test(t); }
  function join(a, b) {
    if (!a) return b; if (!b) return a;
    if (/[a-zəöüğışç]-$/.test(a) && /^[a-zəöüğışç]/.test(b)) return a.slice(0, -1) + b;
    return a + ' ' + b;
  }

  function parse(rows, opt) {
    opt = opt || {};
    var KEYRE = /^(?:(?:cavablar|açar|key|answers)\s*[:\-–]?\s*)?(?:\d{1,3}\s*[-–:.)=]\s*[A-Ea-e][\s,;]*){3,}$/i;
    // 1) başlanğıc nömrəsini tap: ardınca n+1 gələn və yaxınlıqda A variantı olan namizəd
    var cands = [];
    rows.forEach(function (r, i) { var c = qCand(r); if (c) cands.push({ i: i, n: c.n }); });
    var startIdx = -1;
    for (var a = 0; a < cands.length && startIdx < 0; a++) {
      var c0 = cands[a];
      var hasA = false;
      for (var j = c0.i + 1; j < Math.min(rows.length, c0.i + 45); j++) if (optMark(rows[j], 'A')) { hasA = true; break; }
      if (!hasA) continue;
      var hasNext = cands.some(function (z) { return z.i > c0.i && z.n === c0.n + 1; });
      var onlyOne = cands.length === 1 || cands.filter(function (z) { return z.n !== c0.n; }).length === 0;
      if (hasNext || onlyOne || a === cands.length - 1) startIdx = c0.i;
    }
    if (startIdx < 0 && opt.unnumbered !== false) startIdx = 0;
    var out = [], cur = null, last = 0, key = {}, hint = '';
    function nq(n, rest, row) {
      fin();
      cur = { num: n, stem: [], opts: {}, order: [], correct: null, rows: [], optRows: {}, subjectHint: hint, page: row ? row.page : 0, col: row ? row.col : 0 };
      hint = '';
      if (rest) cur.stem.push(rest);
      if (row) cur.rows.push(row);
    }
    function fin() { if (cur && (cur.stem.length || cur.order.length)) out.push(cur); cur = null; }
    function addOpt(l, text, row) { cur.opts[l] = text; cur.order.push(l); cur.optRows[l] = [row]; }
    function lastLetter() { return cur && cur.order.length ? cur.order[cur.order.length - 1] : null; }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], t = r.text;
      if (startIdx >= 0 && i < startIdx) continue;
      if (KEYRE.test(t)) { t.replace(/(\d{1,3})\s*[-–:.)=]\s*([A-Ea-e])/g, function (_, n, l) { key[+n] = l.toUpperCase(); return ''; }); continue; }
      var am = t.match(/^(?:düzgün\s+cavab|doğru\s+cavab|cavab|answer|correct)\s*[:\-–=]\s*\(?([A-Ea-e])\)?\s*[.)]?\s*$/i);
      if (am && cur) { cur.correct = am[1].toUpperCase(); continue; }
      if (isSubjectBanner(t)) { hint = t; continue; }

      var qc = qCand(r), acceptQ = false;
      if (qc) {
        var nopt = cur ? cur.order.length : 0;
        if (!cur && last === 0) acceptQ = (i === startIdx);
        else if (qc.n === last + 1) acceptQ = qc.punct || true;
        else if (qc.punct && qc.n > last + 1 && qc.n <= last + 4 && cur && nopt >= 2) acceptQ = true;
        if (acceptQ && !qc.punct && cur && nopt === 0 && !cur.stem.length) acceptQ = false;
      }
      if (acceptQ) {
        last = qc.n; nq(qc.n, '', r);
        var rest = qc.rest;
        // eyni sətirdə variantlar?
        var sp = splitInline(rest);
        if (sp.length >= 2 && sp[0].l === 'A') {
          if (sp[0].i > 0) cur.stem.push(rest.slice(0, sp[0].i).trim());
          sp.forEach(function (p, k) { addOpt(p.l, rest.slice(p.i + p.len, k + 1 < sp.length ? sp[k + 1].i : rest.length).trim(), r); });
        } else if (rest) cur.stem[0] = rest;
        continue;
      }
      if (!cur) { // nömrəsiz başlanğıc
        if (startIdx >= 0 && i >= startIdx) { nq(last + 1 || 1, '', r); last = cur.num; } else continue;
      }
      // variant?
      var want = LET.charAt(cur.order.length), mk = cur.order.length < 5 ? optMark(r, want) : null;
      if (!mk && cur.order.length === 0 && cur.stem.length) {
        var sp2 = splitInline(t);
        if (sp2.length >= 3 || (sp2.length === 2 && /[?:]\s*$/.test(t.slice(0, sp2[0].i).trim()))) {
          if (sp2[0].i > 0) cur.stem.push(t.slice(0, sp2[0].i).trim());
          sp2.forEach(function (p, k) { addOpt(p.l, t.slice(p.i + p.len, k + 1 < sp2.length ? sp2[k + 1].i : t.length).trim(), r); });
          continue;
        }
      }
      if (mk) {
        var sp3 = splitInline(mk.l === 'A' ? 'A) ' + mk.rest : '');
        if (mk.l === 'A' && sp3.length >= 2) {
          var rs = 'A) ' + mk.rest;
          sp3.forEach(function (p, k) { addOpt(p.l, rs.slice(p.i + p.len, k + 1 < sp3.length ? sp3[k + 1].i : rs.length).trim(), r); });
        } else addOpt(mk.l, mk.rest, r);
        continue;
      }
      var ll = lastLetter();
      if (ll) { cur.opts[ll] = join(cur.opts[ll], t); cur.optRows[ll].push(r); continue; }
      cur.rows.push(r);
      if (cur.stem.length && isListLine(t)) cur.stem.push(t); else if (cur.stem.length) cur.stem[cur.stem.length - 1] = join(cur.stem[cur.stem.length - 1], t); else cur.stem.push(t);
    }
    fin();
    // dublikat nömrələr: daha dolu olanı saxla
    var byNum = {}, res = [];
    out.forEach(function (q) { var o = byNum[q.num]; if (o && o.order.length >= q.order.length) return; if (o) res.splice(res.indexOf(o), 1); byNum[q.num] = q; res.push(q); });
    res.forEach(function (q) {
      if (q.correct == null && key[q.num]) q.correct = key[q.num];
    });
    return res;
  }

  /* ───────────── sual obyektinin yekun forması ───────────── */
  function finish(q, ocr) {
    var fx = ocr ? fixSchwa : function (x) { return x; };
    var stem = q.stem.map(fx).join('\n').replace(/\s+([,.;:?!])/g, '$1').trim();
    var o = {};
    LET.split('').forEach(function (l) { if (q.opts[l] != null) o[l] = fx(clean(q.opts[l])).replace(/^\(?[A-Ea-e][.)]\s+/, ''); });
    var n = Object.keys(o).length, issues = [];
    if (!stem) issues.push('mətn yoxdur');
    if (n < 2) issues.push('variant azdır');
    var txtEmpty = Object.keys(o).filter(function (l) { return !o[l]; });
    var ci = q.correct ? LET.indexOf(q.correct) : -1;
    return {
      num: q.num, text: stem, opts: o, optImg: {}, img: null, correct: ci >= 0 && o[LET[ci]] !== undefined ? ci : -1,
      subjectHint: q.subjectHint || '', page: q.page, issues: issues, _q: q, ocr: !!ocr, emptyOpts: txtEmpty
    };
  }

  /* ───────────── fiqur / şəkil bölgələri ───────────── */
  function colBounds(q, pageW) {
    var rs = q.rows.length ? q.rows : [];
    var allRows = rs.concat(Object.keys(q.optRows).reduce(function (a, l) { return a.concat(q.optRows[l]); }, []));
    var x0 = Math.min.apply(null, allRows.map(function (r) { return r.x0; })), x1 = Math.max.apply(null, allRows.map(function (r) { return r.x1; }));
    var gx = allRows[0] && allRows[0].gx;
    if (gx != null) { var col = allRows[0].col; if (col === 1) { x0 = Math.min(x0, gx); x1 = Math.max(x1, pageW - 10); } else { x0 = Math.max(0, Math.min(x0, 10)); x1 = Math.max(x1, gx - 4); } }
    return [Math.max(0, x0 - 6), Math.min(pageW, x1 + 6)];
  }
  function figureRect(q, page) {
    var stemRows = q.rows.filter(function (r) { return r.page === q.page; });
    if (!stemRows.length) return null;
    var firstOpt = q.order.length ? q.optRows[q.order[0]][0] : null;
    var top = Math.min.apply(null, stemRows.map(function (r) { return r.top; }));
    var bottom = firstOpt && firstOpt.page === q.page ? firstOpt.top : Math.max.apply(null, stemRows.map(function (r) { return r.bot; })) + 4;
    var bx = colBounds(q, page.w), rect = null;
    (page.images || []).forEach(function (b) {
      var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      if (cx >= bx[0] - 8 && cx <= bx[1] + 8 && cy >= top - 4 && cy <= bottom + 6 && (b.x1 - b.x0) > 24 && (b.y1 - b.y0) > 18) {
        rect = rect ? [Math.min(rect[0], b.x0), Math.min(rect[1], b.y0), Math.max(rect[2], b.x1), Math.max(rect[3], b.y1)] : [b.x0, b.y0, b.x1, b.y1];
      }
    });
    if (rect) return [rect[0] - 4, rect[1] - 4, rect[2] + 4, rect[3] + 4];
    // boşluq qaydası: mətn sətirləri arasında böyük boşluq = fiqur
    var seq = stemRows.slice().sort(function (a, b) { return a.top - b.top; });
    if (firstOpt && firstOpt.page === q.page) seq.push(firstOpt);
    var mh = median(seq.map(function (r) { return r.h; })) || 12;
    for (var i = 0; i + 1 < seq.length; i++) {
      var gap = seq[i + 1].top - seq[i].bot;
      if (gap > Math.max(40, mh * 3.2)) return [bx[0], seq[i].bot + 2, bx[1], seq[i + 1].top - 2];
    }
    return null;
  }
  function optRect(q, l, page) {
    var rs = q.optRows[l]; if (!rs || !rs.length) return null;
    var bx = colBounds(q, page.w), top = Math.min.apply(null, rs.map(function (r) { return r.top; })) - 3;
    var idx = q.order.indexOf(l), nxt = q.order[idx + 1], bottom = nxt ? q.optRows[nxt][0].top - 1 : Math.max.apply(null, rs.map(function (r) { return r.bot; })) + Math.max(10, rs[0].h * 1.2);
    (page.images || []).forEach(function (b) { var cy = (b.y0 + b.y1) / 2; if (cy >= top && cy <= bottom + 40 && (b.x1 + b.x0) / 2 > bx[0] && (b.x1 + b.x0) / 2 < bx[1]) bottom = Math.max(bottom, b.y1 + 2); });
    return [bx[0], top, bx[1], bottom];
  }

  function cropCanvas(cv, rect, scale, maxW) {
    var x = Math.max(0, Math.round(rect[0] * scale)), y = Math.max(0, Math.round(rect[1] * scale));
    var w = Math.min(cv.width - x, Math.round((rect[2] - rect[0]) * scale)), h = Math.min(cv.height - y, Math.round((rect[3] - rect[1]) * scale));
    if (w < 12 || h < 12) return null;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(cv, x, y, w, h, 0, 0, w, h);
    c = trimWhite(c);
    var k = Math.min(1, (maxW || 900) / c.width);
    if (k < 1) { var o = document.createElement('canvas'); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); var og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, o.width, o.height); og.drawImage(c, 0, 0, o.width, o.height); c = o; }
    return c.toDataURL('image/jpeg', 0.86);
  }
  function trimWhite(c) {
    var w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data, t = h, b = -1, l = w, r = -1, p, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { p = (y * w + x) * 4; if (d[p] < 235 || d[p + 1] < 235 || d[p + 2] < 235) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; } }
    if (b < 0) return c;
    t = Math.max(0, t - 6); l = Math.max(0, l - 6); b = Math.min(h - 1, b + 6); r = Math.min(w - 1, r + 6);
    var nw = r - l + 1, nh = b - t + 1; if (nw * nh > w * h * 0.97) return c;
    var o = document.createElement('canvas'); o.width = nw; o.height = nh; var g = o.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, nw, nh); g.drawImage(c, l, t, nw, nh, 0, 0, nw, nh); return o;
  }

  /* ───────────── pdf.js / OCR qatı (yalnız brauzer) ───────────── */
  var SC = 2.2;
  async function libs(k) { if (root.__dqLibs) await root.__dqLibs(k); }
  async function pdfPages(file, prog, ocrForce) {
    await libs('pdf');
    if (root.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, pages = [], OPS = pdfjsLib.OPS;
    for (var p = 1; p <= pdf.numPages; p++) {
      prog && prog('Səhifə ' + p + ' / ' + pdf.numPages + ' oxunur…', p / pdf.numPages * 0.5);
      var pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 1 }), vt = vp.transform, tc = await pg.getTextContent(), items = [];
      tc.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var m = mul(vt, it.transform), h = Math.hypot(m[2], m[3]) || it.height || 10;
        items.push({ s: it.str, x: m[4], y: m[5] - h * 0.9, w: (it.width || 0) * Math.hypot(vt[0], vt[1]), h: h });
      });
      var images = [];
      try {
        var ol = await pg.getOperatorList(), st = [], ctm = [1, 0, 0, 1, 0, 0];
        for (var k = 0; k < ol.fnArray.length; k++) {
          var fn = ol.fnArray[k], ar = ol.argsArray[k];
          if (fn === OPS.save) st.push(ctm.slice()); else if (fn === OPS.restore) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
          else if (fn === OPS.transform) ctm = mul(ctm, ar);
          else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
            var M = mul(vt, ctm), xs = [M[4], M[0] + M[4], M[2] + M[4], M[0] + M[2] + M[4]], ys = [M[5], M[1] + M[5], M[3] + M[5], M[1] + M[3] + M[5]];
            images.push({ x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) });
          }
        }
      } catch (e) { }
      var chars = items.reduce(function (a, i) { return a + i.s.length; }, 0);
      pages.push({ no: p, w: vp.width, h: vp.height, items: items, images: images, hasText: chars > 30 && !ocrForce, pg: pg });
    }
    return pages;
  }
  async function renderPage(pg) {
    var vp = pg.getViewport({ scale: SC }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; return c;
  }
  async function ocrPage(cv, scale) {
    await libs('ocr');
    var T = root.Tesseract; if (!T) throw new Error('OCR kitabxanası yüklənmədi');
    var r = await T.recognize(cv, 'aze+eng'), items = [];
    ((r.data && r.data.words) || []).forEach(function (w) { if (w.text && w.text.trim() && w.bbox) items.push({ s: w.text, x: w.bbox.x0 / scale, y: w.bbox.y0 / scale, w: (w.bbox.x1 - w.bbox.x0) / scale, h: (w.bbox.y1 - w.bbox.y0) / scale }); });
    return items;
  }
  async function imagePage(file) {
    var bm = await createImageBitmap(file), k = Math.min(2.5, Math.max(1, 1800 / bm.width)), c = document.createElement('canvas');
    c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bm, 0, 0, c.width, c.height);
    return { canvas: c, scale: k, w: c.width / k, h: c.height / k };
  }

  /* ───────────── əsas giriş: fayl(lar) → suallar ───────────── */
  async function parseFiles(files, o) {
    o = o || {}; var prog = o.onProgress || function () { };
    var allPages = [], docs = [];
    for (var f = 0; f < files.length; f++) {
      var file = files[f], isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      if (isPdf) {
        var pp = await pdfPages(file, function (m, p) { prog((files.length > 1 ? 'Fayl ' + (f + 1) + '/' + files.length + ' · ' : '') + m, p); }, o.forceOcr);
        pp.forEach(function (p) { p.file = file.name; p.canvas = null; });
        allPages = allPages.concat(pp);
      } else {
        var ip = await imagePage(file);
        allPages.push({ no: 1, w: ip.w, h: ip.h, items: [], images: [], hasText: false, canvas: ip.canvas, scale: ip.scale, file: file.name, img: true });
      }
    }
    var anyOcr = false;
    for (var i = 0; i < allPages.length; i++) {
      var P = allPages[i];
      if (!P.hasText) {
        anyOcr = true; prog('OCR: səhifə ' + (i + 1) + ' / ' + allPages.length + ' (fayl: ' + P.file + ')', 0.5 + 0.35 * (i / allPages.length));
        var cv = P.canvas, sc = P.scale;
        if (!cv) { cv = await renderPage(P.pg); sc = SC; P.canvas = cv; P.scale = sc; }
        P.items = await ocrPage(cv, sc);
      }
      P.rows = buildRows(P.items, P.w, i);
    }
    var rows = denoise(allPages.map(function (p) { return { rows: p.rows, h: p.h }; }), o.noise);
    rows.forEach(function (r) { r.pageObj = allPages[r.page]; });
    var parsed = parse(rows, o).map(function (q) { return finish(q, anyOcr); });
    // şəkillər
    prog('Şəkillər kəsilir…', 0.9);
    var need = {};
    parsed.forEach(function (q) {
      var P = allPages[q._q.page]; if (!P) return;
      var fr = figureRect(q._q, P), optNeed = q.emptyOpts.length > 0 && q.emptyOpts.length >= Math.max(1, Object.keys(q.opts).length - 1);
      if (fr || optNeed) { (need[q._q.page] = need[q._q.page] || []).push({ q: q, fr: fr, optNeed: optNeed }); }
    });
    for (var pi in need) {
      var Pg = allPages[pi], cvs = Pg.canvas, sc2 = Pg.scale;
      if (!cvs) { if (!Pg.pg) continue; cvs = await renderPage(Pg.pg); sc2 = SC; }
      need[pi].forEach(function (z) {
        if (z.fr) z.q.img = cropCanvas(cvs, z.fr, sc2, 900);
        if (z.optNeed) z.q.emptyOpts.forEach(function (l) { var rr = optRect(z.q._q, l, Pg); if (rr) { var u = cropCanvas(cvs, rr, sc2, 560); if (u) { z.q.optImg[l] = u; if (z.q.opts[l] === '') z.q.opts[l] = ''; } } });
      });
      cvs.width = cvs.height = 0;
    }
    allPages.forEach(function (p) { if (p.canvas) { p.canvas.width = p.canvas.height = 0; } });
    parsed.forEach(function (q) { delete q._q; });
    prog('Hazırdır', 1);
    return { questions: parsed, pages: allPages.length, ocr: anyOcr };
  }

  var core = { LET: LET, parse: parse, buildRows: buildRows, finish: finish, fixSchwa: fixSchwa, denoise: denoise, parseFiles: parseFiles, v: 1 };
  root.DQPDF = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  /* ═════════════ UI: Sual Bankı (PDF & OCR) ═════════════ */
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var S = { qs: [], busy: false, sel: {} };
  function subj(n) { try { return getSubjectByNumber(n); } catch (e) { return 'Ümumi'; } }
  function isOpenQ(n) { try { return openQuestionIds.indexOf(n) > -1; } catch (e) { return false; } }
  function toast(t) { try { if (root.V2 && V2.toast) return V2.toast(t); } catch (e) { } var d = document.createElement('div'); d.textContent = t; d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;z-index:100001;font:600 13px sans-serif'; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2800); }

  function css() {
    if ($('dqx-css')) return;
    var s = document.createElement('style'); s.id = 'dqx-css';
    s.textContent = '#dqx-box{border:1px solid #c7d2fe;background:#f5f7ff;border-radius:14px;padding:14px;margin:0 0 16px}#dqx-box h5{margin:0 0 8px;font-size:16px}.dqx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.dqx-row label{font-size:13px;display:flex;gap:4px;align-items:center}.dqx-in{padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:14px;background:#fff}.dqx-b{border:0;border-radius:9px;padding:8px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#e2e8f0;color:#0f172a}.dqx-b.p{background:#2563eb;color:#fff}.dqx-b.g{background:#16a34a;color:#fff}.dqx-b.r{background:#fee2e2;color:#b91c1c}.dqx-b:disabled{opacity:.5;cursor:not-allowed}.dqx-bar{height:8px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin:6px 0}.dqx-bar i{display:block;height:100%;width:0;background:#2563eb;transition:width .2s}.dqx-st{font-size:13px;color:#475569}.dqx-q{background:#fff;border:1px solid #dbe1ea;border-radius:12px;padding:10px;margin:10px 0}.dqx-q.bad{border-color:#f59e0b;background:#fffbeb}.dqx-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:#64748b}.dqx-h .nn{width:64px}.dqx-tag{padding:2px 8px;border-radius:99px;background:#e8eefc;font-weight:700}.dqx-tag.ok{background:#dcfce7;color:#166534}.dqx-tag.w{background:#fef3c7;color:#92400e}.dqx-q textarea{width:100%;min-height:56px;margin:6px 0;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:14px;resize:vertical}.dqx-o{display:flex;gap:6px;align-items:center;margin-top:5px}.dqx-o b{width:20px}.dqx-o .dqx-in{flex:1;min-width:0}.dqx-q img{max-width:100%;max-height:200px;display:block;margin:4px 0;border-radius:6px;border:1px solid #e2e8f0}.dqx-oi{max-height:56px!important;display:inline-block!important}';
    document.head.appendChild(s);
  }

  function mount() {
    var mod = $('mod-sualbanki'); if (!mod || $('dqx-box')) return;
    css();
    var box = document.createElement('div'); box.id = 'dqx-box';
    box.innerHTML = '<h5>🚀 Tam PDF skaneri — bütün sual və variantlar bir dəfəyə</h5>' +
      '<p class="dqx-st">PDF-in mətn qatı oxunur (süni intellekt lazım deyil), 2 sütun avtomatik ayrılır, şəkil/fiqur sualla birlikdə kəsilir. Mətn qatı olmayan skan PDF və şəkillər üçün OCR işləyir.</p>' +
      '<div class="dqx-row"><input type="file" id="dqx-file" accept="application/pdf,image/*" multiple class="dqx-in"><label><input type="checkbox" id="dqx-ocr"> OCR-ı məcburi işlət</label></div>' +
      '<div class="dqx-row"><label>Sınaq №<input type="number" id="dqx-exam" class="dqx-in" value="1" style="width:80px"></label>' +
      ['BA', 'BB', 'AC'].map(function (c, i) { return '<label><input type="checkbox" class="dqx-cat" value="' + c + '"' + (i === 0 ? ' checked' : '') + '> ' + c + '</label>'; }).join('') +
      '<label>Nömrələmə<select id="dqx-numm" class="dqx-in"><option value="src">PDF-dəki nömrə ilə</option><option value="seq">Başlanğıc №-dən ardıcıl</option></select></label>' +
      '<label>Başlanğıc №<input type="number" id="dqx-start" class="dqx-in" value="1" style="width:80px"></label></div>' +
      '<div class="dqx-row"><label style="flex:1">Süzgəc sözləri (vergüllə; belə sətirlər atılır)<input id="dqx-noise" class="dqx-in" style="flex:1" value="DQplatform, By Yunis, 0504305162"></label></div>' +
      '<div class="dqx-bar"><i id="dqx-pb"></i></div><div class="dqx-st" id="dqx-msg"></div>' +
      '<div id="dqx-tools" style="display:none"><div class="dqx-row"><b id="dqx-sum"></b><button class="dqx-b" id="dqx-all">☑ Hamısını seç</button><button class="dqx-b" id="dqx-none">☐ Seçimi sil</button><button class="dqx-b r" id="dqx-clr">🗑 Siyahını təmizlə</button><button class="dqx-b g" id="dqx-save">💾 Seçilənləri bazaya yaz</button></div></div>' +
      '<div id="dqx-list"></div>';
    var dz = mod.querySelector('.pdf-drop-zone');
    (dz || mod.querySelector('p')).insertAdjacentElement('afterend', box);
    var ed = box.nextElementSibling; // köhnə tək-sual redaktoru
    while (ed && !(ed.tagName === 'DIV' && /Sual Detalları/.test(ed.textContent || ''))) ed = ed.nextElementSibling;
    if (ed) { var dt = document.createElement('details'); dt.style.margin = '8px 0'; dt.innerHTML = '<summary style="cursor:pointer;font-weight:700">✍️ Tək sualı əl ilə daxil et</summary>'; ed.parentNode.insertBefore(dt, ed); dt.appendChild(ed); }
    $('dqx-file').onchange = function () { run([].slice.call(this.files)); this.value = ''; };
    $('dqx-all').onclick = function () { S.qs.forEach(function (q, i) { S.sel[i] = true; }); draw(); };
    $('dqx-none').onclick = function () { S.sel = {}; draw(); };
    $('dqx-clr').onclick = function () { if (!S.qs.length || confirm('Siyahıdakı ' + S.qs.length + ' sual silinsin?')) { S.qs = []; S.sel = {}; draw(); } };
    $('dqx-save').onclick = save;
    box.addEventListener('input', onInput); box.addEventListener('change', onChange); box.addEventListener('click', onClick);
  }
  root.handleOCRProcess = function (inp) { mount(); var fs = [].slice.call(inp.files || []); inp.value = ''; if (fs.length) run(fs); };

  function say(m, p) { var e = $('dqx-msg'); if (e) e.textContent = m || ''; if (p != null && $('dqx-pb')) $('dqx-pb').style.width = Math.round(p * 100) + '%'; }
  async function run(files) {
    if (S.busy || !files.length) return; S.busy = true;
    try {
      var noise = ($('dqx-noise').value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      var r = await parseFiles(files, { noise: noise, forceOcr: $('dqx-ocr').checked, onProgress: say });
      var seq = $('dqx-numm').value === 'seq', st = Math.max(1, +$('dqx-start').value || 1);
      r.questions.forEach(function (q, i) { if (seq) q.num = st + i; else if (!q.num) q.num = st + i; });
      S.qs = r.questions; S.sel = {}; S.qs.forEach(function (q, i) { if (!q.issues.length && q.correct >= 0) S.sel[i] = true; });
      say(r.questions.length + ' sual tapıldı · ' + r.pages + ' səhifə' + (r.ocr ? ' · OCR istifadə olundu, mətni yoxlayın' : '') + '. Düzgün cavabı seçin və bazaya yazın.', 1);
      if (!r.questions.length) say('Sual tapılmadı. Sənəddə «1. sual … A) … B) …» quruluşu olmalıdır. OCR-ı məcburi işlətməyi yoxlayın.', 1);
    } catch (e) { say('Xəta: ' + (e && e.message || e), 0); }
    S.busy = false; draw();
  }
  function status(q) {
    var e = [], n = Object.keys(q.opts).length;
    if (!q.text && !q.img) e.push('mətn yoxdur');
    if (n < 2) e.push('variant azdır');
    if (q.correct < 0 && !isOpenQ(q.num)) e.push('düzgün cavab seçilməyib');
    if (subj(q.num) === 'Qanunvericilik' && n > 4) e.push('E variantı yazılmayacaq (Qanunvericilik 4 variantlıdır)');
    return e;
  }
  function draw() {
    var L = $('dqx-list'); if (!L) return;
    $('dqx-tools').style.display = S.qs.length ? 'block' : 'none';
    var okN = 0; S.qs.forEach(function (q) { if (!status(q).length) okN++; });
    $('dqx-sum').textContent = S.qs.length + ' sual · ' + okN + ' hazır · ' + Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length + ' seçilib';
    L.innerHTML = S.qs.map(function (q, i) {
      var e = status(q), letters = LET.split('').filter(function (l) { return q.opts[l] !== undefined; });
      return '<div class="dqx-q' + (e.length ? ' bad' : '') + '" data-i="' + i + '"><div class="dqx-h"><input type="checkbox" data-k="sel"' + (S.sel[i] ? ' checked' : '') + '> № <input class="dqx-in nn" type="number" data-k="num" value="' + q.num + '"><span class="dqx-tag">' + esc(subj(q.num)) + '</span><span class="dqx-tag ' + (e.length ? 'w' : 'ok') + '">' + (e.length ? '⚠ ' + esc(e.join(' · ')) : '✓ hazırdır') + '</span><span>səh. ' + (q.page + 1) + '</span><button class="dqx-b r" data-a="del" style="margin-left:auto">🗑</button></div>' +
        '<textarea data-k="text" placeholder="Sual mətni">' + esc(q.text) + '</textarea>' +
        (q.img ? '<img src="' + q.img + '"><button class="dqx-b r" data-a="rimg">✕ Şəkli sil</button>' : '') +
        letters.map(function (l, k) { var ci = LET.indexOf(l); return '<div class="dqx-o"><input type="radio" name="dqxc' + i + '" data-k="cor" data-l="' + ci + '"' + (q.correct === ci ? ' checked' : '') + '><b>' + l + ')</b><input class="dqx-in" data-k="opt" data-l="' + l + '" value="' + esc(q.opts[l]) + '">' + (q.optImg[l] ? '<img class="dqx-oi" src="' + q.optImg[l] + '"><button class="dqx-b r" data-a="oimg" data-l="' + l + '">✕</button>' : '') + (letters.length > 2 ? '<button class="dqx-b r" data-a="odel" data-l="' + l + '">✕</button>' : '') + '</div>'; }).join('') +
        '<div class="dqx-row">' + (letters.length < 5 ? '<button class="dqx-b" data-a="oadd">＋ Variant</button>' : '') + (isOpenQ(q.num) ? '<label>Açıq cavab (BA)<input class="dqx-in" data-k="open" value="' + esc(q.open || '') + '"></label>' : '') + '</div></div>';
    }).join('');
  }
  function qOf(el) { var c = el.closest('.dqx-q'); return c ? S.qs[+c.dataset.i] : null; }
  function onInput(e) {
    var el = e.target, q = qOf(el), k = el.dataset.k; if (!q) return;
    if (k === 'text') q.text = el.value; else if (k === 'opt') q.opts[el.dataset.l] = el.value; else if (k === 'open') q.open = el.value;
  }
  function onChange(e) {
    var el = e.target, q = qOf(el), k = el.dataset.k; if (!q) return; var i = +el.closest('.dqx-q').dataset.i;
    if (k === 'sel') { S.sel[i] = el.checked; draw(); }
    else if (k === 'num') { q.num = +el.value || q.num; draw(); }
    else if (k === 'cor') { q.correct = +el.dataset.l; draw(); }
    else if (k === 'text' || k === 'opt' || k === 'open') draw();
  }
  function onClick(e) {
    var b = e.target.closest('[data-a]'); if (!b) return; var q = qOf(b), i = +b.closest('.dqx-q').dataset.i, a = b.dataset.a; if (!q) return;
    if (a === 'del') { S.qs.splice(i, 1); var ns = {}; Object.keys(S.sel).forEach(function (k) { k = +k; if (k < i) ns[k] = S.sel[k]; else if (k > i) ns[k - 1] = S.sel[k]; }); S.sel = ns; }
    else if (a === 'rimg') q.img = null;
    else if (a === 'oimg') delete q.optImg[b.dataset.l];
    else if (a === 'odel') { var l = b.dataset.l, ci = LET.indexOf(l), keep = LET.split('').filter(function (x) { return q.opts[x] !== undefined && x !== l; }), no = {}, ni = {}; keep.forEach(function (x, k) { no[LET[k]] = q.opts[x]; if (q.optImg[x]) ni[LET[k]] = q.optImg[x]; }); if (q.correct === ci) q.correct = -1; else if (q.correct > ci) q.correct--; q.opts = no; q.optImg = ni; }
    else if (a === 'oadd') { var n = Object.keys(q.opts).length; if (n < 5) q.opts[LET[n]] = ''; }
    draw();
  }
  async function save() {
    if (S.busy) return;
    var idx = Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).map(Number).sort(function (a, b) { return a - b; });
    if (!idx.length) return toast('Heç bir sual seçilməyib.');
    var cats = [].map.call(document.querySelectorAll('.dqx-cat:checked'), function (x) { return x.value; });
    if (!cats.length) return toast('Ən azı 1 kateqoriya seçin.');
    var exam = String($('dqx-exam').value || '1');
    var bad = idx.filter(function (i) { return status(S.qs[i]).filter(function (x) { return !/E variantı/.test(x); }).length; });
    if (bad.length && !confirm(bad.length + ' seçilmiş sual natamamdır (' + bad.slice(0, 8).map(function (i) { return '№' + S.qs[i].num; }).join(', ') + '). Onlar atılsın və qalanı yazılsın?')) return;
    var good = idx.filter(function (i) { return bad.indexOf(i) < 0; });
    if (!good.length) return toast('Yazıla bilən sual yoxdur.');
    S.busy = true; $('dqx-save').disabled = true;
    try {
      var nums = {}; good.forEach(function (i) { nums[S.qs[i].num] = (nums[S.qs[i].num] || 0) + 1; });
      var dup = Object.keys(nums).filter(function (n) { return nums[n] > 1; });
      if (dup.length) { toast('Təkrarlanan sual nömrələri var: ' + dup.join(', ')); S.busy = false; $('dqx-save').disabled = false; return; }
      var ex = await _supabase.from('exam_questions').select('id,category,q_number').eq('exam_id', exam).in('category', cats);
      if (ex.error) throw ex.error;
      var have = {}; (ex.data || []).forEach(function (r) { have[r.category + '|' + r.q_number] = r.id; });
      var over = good.filter(function (i) { return cats.some(function (c) { return have[c + '|' + S.qs[i].num]; }); }).length;
      if (over && !confirm(over + ' mövcud sual əvəz olunacaq. Davam edilsin?')) { S.busy = false; $('dqx-save').disabled = false; return; }
      var ins = [], upd = [], skipped = 0;
      good.forEach(function (i) {
        var q = S.qs[i], n = q.num, sj = subj(n), qan = sj === 'Qanunvericilik';
        cats.forEach(function (c) {
          var row = { exam_id: exam, category: c, q_number: n, subject: sj, question: q.text.trim(), image_url: q.img || null };
          if (c === 'BA' && isOpenQ(n)) { row.options = []; row.correct = String(q.open || '').trim().toUpperCase(); if (!row.correct) { skipped++; return; } }
          else {
            var letters = LET.split('').filter(function (l) { return q.opts[l] !== undefined; }).slice(0, qan ? 4 : 5);
            row.options = letters.map(function (l) { return { text: String(q.opts[l] || '').trim(), image: q.optImg[l] || null }; });
            row.correct = q.correct >= row.options.length ? 0 : q.correct;
          }
          var id = have[c + '|' + n]; if (id) upd.push({ id: id, row: row }); else ins.push(row);
        });
      });
      var done = 0, err = null;
      for (var k = 0; k < ins.length && !err; k += 40) { var r1 = await _supabase.from('exam_questions').insert(ins.slice(k, k + 40)); if (r1.error) err = r1.error; else done += Math.min(40, ins.length - k); say('Yazılır… ' + done + ' / ' + (ins.length + upd.length)); }
      for (var u = 0; u < upd.length && !err; u++) { var r2 = await _supabase.from('exam_questions').update(upd[u].row).eq('id', upd[u].id); if (r2.error) err = r2.error; else { done++; if (u % 10 === 0) say('Yazılır… ' + done + ' / ' + (ins.length + upd.length)); } }
      if (err) throw err;
      say('✅ ' + good.length + ' sual · Sınaq ' + exam + ' · [' + cats.join(', ') + '] bazaya yazıldı' + (skipped ? ' · ' + skipped + ' açıq sual cavabsız keçildi' : '') + '.', 1);
      toast('Bazaya yazıldı ✅');
      var gs = {}; good.forEach(function (i) { gs[i] = 1; });
      S.qs = S.qs.filter(function (q, i) { return !gs[i]; }); S.sel = {};
    } catch (e) { say('Yazılmadı: ' + (e && e.message || e), 0); toast('Xəta: ' + (e && e.message || e)); }
    S.busy = false; $('dqx-save').disabled = false; draw();
  }

  /* ═════════════ UI: Şablonlar ═════════════ */
  var T = { rows: [] };
  function v2ok() { return root.V2 && typeof V2.list === 'function'; }
  function tCount(r) { return (r.questions || []).length; }
  async function tplDelete(id) {
    await V2.probe();
    if (V2.mode === 'cloud') { var r = await _supabase.from('dq_v2_store').delete().eq('id', id); if (r.error) throw r.error; }
    else localStorage.setItem('dq_v2_templates', JSON.stringify((await V2.list('templates')).filter(function (x) { return x._id != id; })));
  }
  async function tplRender() {
    var mod = $('mod-sablonlar'); if (!mod) return; css();
    if (!v2ok()) { mod.innerHTML = '<h4>📋 Şablonlar</h4><p>Şablon modulu hələ yüklənməyib, səhifəni yeniləyin.</p>'; return; }
    mod.innerHTML = '<h4>📋 Yaradılmış İmtahan Şablonları</h4><p class="dqx-st">Yüklənir…</p>';
    var rows = []; try { rows = await V2.list('templates'); } catch (e) { }
    T.rows = rows;
    mod.innerHTML = '<h4>📋 Yaradılmış İmtahan Şablonları</h4>' +
      '<div class="dqx-row" style="background:#f5f7ff;border:1px solid #c7d2fe;border-radius:12px;padding:10px"><b>Sınaqdan şablon yarat:</b><input id="tp-name" class="dqx-in" placeholder="Şablon adı"><input id="tp-exam" type="number" class="dqx-in" value="1" style="width:80px" title="Sınaq №"><select id="tp-cat" class="dqx-in"><option>BA</option><option>BB</option><option>AC</option></select><button class="dqx-b p" id="tp-mk">➕ Yarat</button><span class="dqx-st" id="tp-msg"></span></div>' +
      '<div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th>Şablon Adı</th><th>Təsnifat</th><th>Sınaq №</th><th>Sual Sayı</th><th>Yaradılma Tarixi</th><th>Əməliyyat</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) { return '<tr><td><b>' + esc(r.name) + '</b></td><td><span class="badge-cat">' + esc(r.cat || r.category || '—') + '</span></td><td>' + esc(r.exam_no || '—') + '</td><td>' + tCount(r) + ' sual</td><td>' + esc(r.date || '') + '</td><td style="white-space:nowrap"><button class="dqx-b p" data-t="view" data-i="' + i + '">👁️ Bax</button> <button class="dqx-b g" data-t="apply" data-i="' + i + '">⬆ Sınağa yaz</button> <button class="dqx-b r" data-t="del" data-i="' + i + '">🗑</button></td></tr>'; }).join('') : '<tr><td colspan="6" style="text-align:center;padding:18px;color:#64748b">Hələ şablon yoxdur. Yuxarıdan sınaqdan yarada və ya İdarəçi V2 → Sual Bankı-da «Şablon kimi saxla» istifadə edə bilərsiniz.</td></tr>') +
      '</tbody></table></div>';
    $('tp-mk').onclick = tplMake;
    mod.onclick = function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return; var r = T.rows[+b.dataset.i]; if (!r) return;
      if (b.dataset.t === 'view') tplView(r);
      else if (b.dataset.t === 'del') { if (confirm('«' + r.name + '» şablonu silinsin?')) tplDelete(r._id).then(tplRender).catch(function (er) { toast('Xəta: ' + (er.message || er)); }); }
      else if (b.dataset.t === 'apply') tplApply(r);
    };
  }
  function qNorm(q) { // iki format: V2 {text,opts:[{text,img}],qimg,correct,type} və ya exam_questions
    var opts = q.opts || q.options || [];
    return { text: q.text != null ? q.text : (q.question || ''), img: q.qimg || q.image_url || null, open: q.type === 'open' || (!opts.length), correct: q.correct, opts: opts.map(function (o) { return typeof o === 'object' && o ? { text: o.text || '', img: o.img || o.image || null } : { text: String(o || ''), img: null }; }), n: q.n || q.q_number };
  }
  function tplView(r) {
    var d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:12px';
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    var qs = (r.questions || []).map(qNorm);
    d.innerHTML = '<div style="background:#fff;color:#0f172a;border-radius:14px;max-width:760px;width:100%;max-height:90vh;overflow:auto;padding:16px"><h3 style="text-align:left;margin:0 0 10px">' + esc(r.name) + ' — ' + qs.length + ' sual</h3>' +
      qs.map(function (q, k) { return '<div class="dqx-q"><b>' + (q.n || k + 1) + '. ' + esc(q.text || (q.img ? '🖼️ Şəkilli sual' : '')) + '</b>' + (q.img ? '<img src="' + q.img + '">' : '') + (q.open ? '<div style="font-size:13px;margin-top:4px">Açıq cavab: <b>' + esc(q.correct) + '</b></div>' : q.opts.map(function (o, j) { return '<div style="font-size:13px;margin-top:3px;' + (j === +q.correct ? 'color:#059669;font-weight:800' : '') + '">' + LET[j] + ') ' + esc(o.text) + (o.img ? ' <img class="dqx-oi" src="' + o.img + '">' : '') + '</div>'; }).join('')) + '</div>'; }).join('') +
      '<div style="text-align:right;margin-top:10px"><button class="dqx-b" id="tp-close">Bağla</button></div></div>';
    document.body.appendChild(d); d.querySelector('#tp-close').onclick = function () { d.remove(); };
  }
  async function tplMake() {
    var name = ($('tp-name').value || '').trim(), exam = String($('tp-exam').value || '1'), cat = $('tp-cat').value, m = $('tp-msg');
    if (!name) { m.textContent = 'Şablon adı yazın.'; return; }
    m.textContent = 'Suallar oxunur…';
    var r = await _supabase.from('exam_questions').select('*').eq('exam_id', exam).eq('category', cat).order('q_number');
    if (r.error) { m.textContent = 'Xəta: ' + r.error.message; return; }
    if (!(r.data || []).length) { m.textContent = 'Sınaq ' + exam + ' / ' + cat + ' üçün sual tapılmadı.'; return; }
    var qs = r.data.map(function (q) {
      var open = !Array.isArray(q.options) || !q.options.length;
      return { type: open ? 'open' : 'mcq', n: q.q_number, text: q.question || '', qimg: q.image_url || null, cat: cat, correct: open ? String(q.correct) : parseInt(q.correct), opts: open ? [] : q.options.map(function (o) { return { text: typeof o === 'object' && o ? (o.text || '') : String(o || ''), img: typeof o === 'object' && o ? (o.image || null) : null }; }) };
    });
    await V2.put('templates', { name: name, cat: cat, exam_no: exam, questions: qs, date: new Date().toISOString().slice(0, 10) });
    toast('Şablon yaradıldı ✅'); tplRender();
  }
  async function tplApply(r) {
    var ex = prompt('Hansı sınağa yazılsın? (Sınaq №)', '1'); if (!ex) return;
    var cs = prompt('Hansı kateqoriyalara? (məs: BA,BB)', (r.cat || 'BA').toString().split('/')[0]); if (!cs) return;
    var cats = cs.toUpperCase().split(/[\s,;/]+/).filter(function (c) { return /^(BA|BB|AC)$/.test(c); }); if (!cats.length) return toast('Kateqoriya düzgün deyil.');
    var qs = (r.questions || []).map(qNorm), st = 1;
    var hasN = qs.every(function (q) { return q.n > 0; });
    if (!hasN) { st = parseInt(prompt('Şablonda sual nömrələri yoxdur. Başlanğıc nömrə?', '1')) || 1; }
    if (!confirm('«' + r.name + '» (' + qs.length + ' sual) → Sınaq ' + ex + ' [' + cats.join(', ') + ']. Mövcud eyni nömrəli suallar əvəz olunacaq. Davam?')) return;
    try {
      var exr = await _supabase.from('exam_questions').select('id,category,q_number').eq('exam_id', ex).in('category', cats), have = {};
      (exr.data || []).forEach(function (x) { have[x.category + '|' + x.q_number] = x.id; });
      var ins = [], n = 0;
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i], num = hasN ? q.n : st + i, sj = subj(num);
        for (var c = 0; c < cats.length; c++) {
          var row = { exam_id: ex, category: cats[c], q_number: num, subject: sj, question: q.text, image_url: q.img || null, options: q.open ? [] : q.opts.slice(0, sj === 'Qanunvericilik' ? 4 : 5).map(function (o) { return { text: o.text, image: o.img || null }; }), correct: q.open ? String(q.correct) : (parseInt(q.correct) || 0) };
          var id = have[cats[c] + '|' + num];
          if (id) { var u = await _supabase.from('exam_questions').update(row).eq('id', id); if (u.error) throw u.error; n++; } else ins.push(row);
        }
      }
      for (var k = 0; k < ins.length; k += 40) { var rr = await _supabase.from('exam_questions').insert(ins.slice(k, k + 40)); if (rr.error) throw rr.error; n += Math.min(40, ins.length - k); }
      toast('✅ ' + n + ' qeyd Sınaq ' + ex + '-ə yazıldı');
    } catch (e) { toast('Xəta: ' + (e.message || e)); }
  }

  /* ═════════════ Tam ekran Pro rejim: köhnə "PDF Pro Oxuma" və "Smart Kəsmə" kartlarının əvəzi ═════════════ */
  function openPro(title) {
    mount(); var box = $('dqx-box'); if (!box) return toast('Sual Bankı modulu tapılmadı');
    var ov = $('dqx-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'dqx-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100002;background:#eef1f7;overflow:auto;padding:12px;padding-top:calc(12px + env(safe-area-inset-top,0px))';
      ov.innerHTML = '<div style="max-width:900px;margin:0 auto"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 id="dqx-ovt" style="margin:0;text-align:left"></h3><button class="dqx-b r" id="dqx-ovx">✕ Bağla</button></div><div id="dqx-ovh"></div></div>';
      document.body.appendChild(ov); $('dqx-ovx').onclick = closePro;
    }
    $('dqx-ovt').textContent = title; $('dqx-ovh').appendChild(box); ov.style.display = 'block'; ov.scrollTop = 0;
  }
  function closePro() {
    var ov = $('dqx-ov'), box = $('dqx-box'), mod = $('mod-sualbanki');
    if (box && mod) { var dz = mod.querySelector('.pdf-drop-zone'); (dz || mod.firstElementChild).insertAdjacentElement('afterend', box); }
    if (ov) ov.style.display = 'none';
  }
  var PRO_TILES = [[/PDF\s*Pro\s*Oxuma/i, '📄 PDF Pro Oxuma — sual + variant avtomatik düzülüş'], [/Smart\s*K[əe]smə/i, '⚡ Smart Kəsmə & Sual Bankı PRO']];
  document.addEventListener('click', function (e) {
    if (e.shiftKey) return; // Shift basılıbsa köhnə modul açılır
    var n = e.target, hops = 0;
    while (n && n !== document.body && hops++ < 5) {
      var tx = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (tx.length && tx.length < 90 && !n.closest('#dqx-ov, #dqx-box')) {
        for (var i = 0; i < PRO_TILES.length; i++) if (PRO_TILES[i][0].test(tx)) { e.preventDefault(); e.stopImmediatePropagation(); openPro(PRO_TILES[i][1]); return; }
      }
      n = n.parentElement;
    }
  }, true);
  root.DQPDF.openPro = openPro;

  /* ═════════════ qoşulma ═════════════ */
  function hook() {
    if (typeof switchAdminTab === 'function' && !switchAdminTab.__dqx) {
      var o = switchAdminTab;
      var w = function (t) { var r = o.apply(this, arguments); try { if (t === 'sualbanki') mount(); if (t === 'sablonlar') tplRender(); } catch (e) { console.warn('[dq-pdf-engine]', e); } return r; };
      w.__dqx = 1; root.switchAdminTab = w;
    }
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  setTimeout(hook, 1200);
  root.DQPDF.ui = { mount: mount, tpl: tplRender, state: S };
})(typeof window !== 'undefined' ? window : globalThis);
