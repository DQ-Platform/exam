/*!
 * DQ Platform — Elan Studio (v1)
 * Müstəqil elan/afişa redaktoru. Admin paneldə «Digər alətlər» bölməsində «📣 Elan Studio» kartı kimi görünür.
 *
 * Nələr edir:
 *  - İstənilən elan yaradın: mətn, şəkil, fiqur qatları; hər qat barmaqla sürüşdürülür, ölçüsü və dönməsi dəyişir
 *  - Fon: qradiyent / tək rəng / şəkil (yüklə, yaxınlaşdır, sürüşdür, qaralt)
 *  - Format: Post 4:5, Kvadrat 1:1, Story 9:16
 *  - Hazır şablonlar, geri/irəli (undo/redo), qat siyahısı, təkrarla, sil, öndə/arxada
 *  - Kitabxana: elanlar Supabase-də (collection «elan2») və bu cihazda saxlanır
 *  - Aktiv imtahandan bir toxunuşla elan yaratma; imtahana bağlı elan portalda «🔗 Paylaş» düyməsində istifadə olunur
 *  - PNG yüklə, WhatsApp/sistem paylaşımı, link kopyala
 *
 * Qoşulma: dq-imtahan-giris.js-dən SONRA
 *   <script src="dq-elan-studio.js?v=1"></script>
 * Açmaq: DQElanStudio.open()   |   DQElanStudio.quickShare({group:'BB',number:1,title:'…'})
 * Tam müstəqildir: bütün interfeys Shadow DOM daxilindədir, saytın CSS-i ona təsir etmir.
 */
(function () {
  'use strict';
  if (window.DQElanStudio) return;

  var LS_LIB = 'dq_elan2_lib', COL = 'elan2', MAXIMG = 1100, MAXLAYERS_IMG = 8;
  var FORMATS = { '4:5': [1080, 1350, 'Post 4:5'], '1:1': [1080, 1080, 'Kvadrat 1:1'], '9:16': [1080, 1920, 'Story 9:16'] };
  var FONTS = {
    sans: 'Mulish,Roboto,system-ui,-apple-system,"Segoe UI",Arial,sans-serif',
    serif: 'Georgia,"Times New Roman",serif',
    mono: '"Courier New",ui-monospace,monospace',
    round: '"Trebuchet MS","Segoe UI",Verdana,sans-serif'
  };
  var host = null, sr = null, view = 'lib', D = null, sel = null, past = [], future = [], cache = {}, dirty = false;
  var cv = null, ctx = null, drag = null, prevOverflow = null;

  /* ---------------- köməkçilər ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function isAdmin() { try { return !!(window.DQAdminGate && DQAdminGate.is()) || localStorage.getItem('dq_admin_logged') === 'true'; } catch (e) { return false; } }
  function G() { return window.DQImtahanGiris; }
  function cfgSb() { var c = G() && G().config && G().config.supabase; return c && c.url ? c : { url: 'https://cpzwliqlgaplroscvduo.supabase.co', key: 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF' }; }
  function sb(path, opts, ms) {
    var c = cfgSb(), ac = window.AbortController ? new AbortController() : null, t = setTimeout(function () { try { ac && ac.abort(); } catch (e) {} }, ms || 8000);
    opts = Object.assign({}, opts); opts.headers = Object.assign({ apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, opts.headers || {});
    if (ac) opts.signal = ac.signal;
    return fetch(c.url + '/rest/v1/' + path, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function keyOf(e) { return String(e.group).toUpperCase() + '-' + (parseInt(e.number, 10) || 0); }
  function examLink(key) { return location.origin + location.pathname + (key ? '?qeyd=' + encodeURIComponent(key) : ''); }
  function toast(t) {
    if (!sr) return; var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; sr.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function $(s) { return sr.querySelector(s); }

  /* ---------------- model ---------------- */
  function blank(fmt) {
    return { id: uid('d'), name: 'Yeni elan', key: '', link: '', fmt: fmt || '4:5', imgs: {}, ts: Date.now(),
      bg: { type: 'grad', c1: '#0c1f4d', c2: '#1f3b8a', angle: 160, img: '', zoom: 1, ox: 0, oy: 0, dim: 0.35 }, layers: [] };
  }
  function T(text, o) { return Object.assign({ id: uid('l'), t: 'text', text: text, x: 80, y: 200, w: 920, size: 64, weight: 800, color: '#ffffff', align: 'left', font: 'sans', lh: 1.18, shadow: false, op: 1, rot: 0 }, o || {}); }
  function R(o) { return Object.assign({ id: uid('l'), t: 'rect', x: 80, y: 200, w: 400, h: 100, fill: '#d4a73c', radius: 30, op: 1, rot: 0, stroke: '', sw: 0 }, o || {}); }
  function I(img, o) { return Object.assign({ id: uid('l'), t: 'image', img: img, x: 80, y: 200, w: 400, h: 400, radius: 0, fit: 'cover', op: 1, rot: 0 }, o || {}); }

  var TPLS = {
    gold: { n: 'Qızıl · Tünd', bg: { c1: '#0a1840', c2: '#1d3a88', angle: 160 }, text: '#ffffff', accent: '#f3d47a', cta: '#d4a73c', ctaTx: '#13203f' },
    light: { n: 'Təmiz · Açıq', bg: { c1: '#ffffff', c2: '#e9eefb', angle: 170 }, text: '#10204a', accent: '#1d3a88', cta: '#1d3a88', ctaTx: '#ffffff' },
    green: { n: 'Yaşıl', bg: { c1: '#05301f', c2: '#0f7a4a', angle: 150 }, text: '#ffffff', accent: '#b8f5d3', cta: '#f3d47a', ctaTx: '#10301f' },
    violet: { n: 'Bənövşəyi', bg: { c1: '#1e1b4b', c2: '#6d4cf5', angle: 155 }, text: '#ffffff', accent: '#fde68a', cta: '#fde68a', ctaTx: '#1e1b4b' }
  };
  function fromTemplate(k, ex) {
    var t = TPLS[k] || TPLS.gold, d = blank('4:5'), H = FORMATS[d.fmt][1];
    ex = ex || {};
    var pr = (G() && G().config && G().config.prices || {})[String(ex.group || '').toUpperCase()];
    d.bg = Object.assign(d.bg, t.bg, { type: 'grad' });
    d.name = ex.group ? (String(ex.group).toUpperCase() + ' · Sınaq ' + ex.number) : 'Yeni elan';
    d.key = ex.group ? keyOf(ex) : '';
    var title = ex.title || (ex.group ? 'Dövlət Qulluğu ' + String(ex.group).toUpperCase() + ' kateqoriyası üzrə sınaq ' + ex.number : 'Elan başlığı');
    d.layers = [
      R({ x: 80, y: 96, w: 74, h: 74, fill: t.accent, radius: 22 }),
      T('DQ', { x: 80, y: 112, w: 74, size: 36, color: t.ctaTx === '#ffffff' ? '#ffffff' : '#13203f', align: 'center' }),
      T('DQ Platform', { x: 176, y: 114, w: 600, size: 40, color: t.text }),
      T('QEYDİYYAT AÇIQDIR', { x: 80, y: 330, w: 700, size: 30, color: t.accent, weight: 800 }),
      T(title, { x: 80, y: 392, w: 920, size: 78, color: t.text }),
      T('Sınaq imtahanına qeydiyyat başlayıb', { x: 80, y: 700, w: 920, size: 40, weight: 600, color: t.accent }),
      T((ex.questions || 100) + ' sual · ' + (ex.duration || 180) + ' dəqiqə' + (pr ? '  ·  ' + pr + ' AZN' : ''), { x: 80, y: 800, w: 920, size: 36, weight: 700, color: t.text }),
      R({ x: 80, y: H - 250, w: 920, h: 110, fill: t.cta, radius: 55 }),
      T('Qeydiyyatdan keç  →', { x: 80, y: H - 250 + 31, w: 920, size: 46, align: 'center', color: t.ctaTx }),
      T(location.host || 'dqplatform', { x: 80, y: H - 100, w: 920, size: 28, weight: 600, align: 'center', color: t.text, op: 0.8 })
    ];
    return d;
  }

  /* ---------------- çəkmə ---------------- */
  function getImg(d, id, cb) {
    var src = d.imgs[id]; if (!src) return null;
    var c = cache[id]; if (c && c.src === src) return c.complete ? c : null;
    var im = new Image(); im.onload = function () { redraw(); }; im.src = src; cache[id] = im; return im.complete ? im : null;
  }
  function wrap(x, text, mw) {
    var out = [];
    String(text || '').split('\n').forEach(function (par) {
      var words = par.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (x.measureText(t).width > mw && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  function rr(x, px, py, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); x.beginPath();
    x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }
  function measureText(x, l) {
    x.font = l.weight + ' ' + l.size + 'px ' + FONTS[l.font || 'sans'];
    var lines = wrap(x, l.text, l.w); l._lines = lines; l.h = Math.max(l.size, lines.length * l.size * l.lh); return lines;
  }
  function drawBg(x, d, W, H) {
    var b = d.bg;
    if (b.type === 'solid') { x.fillStyle = b.c1; x.fillRect(0, 0, W, H); }
    else if (b.type === 'image' && b.img && getImg(d, b.img)) {
      var im = cache[b.img], s = Math.max(W / im.width, H / im.height) * (b.zoom || 1), w = im.width * s, h = im.height * s;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.drawImage(im, (W - w) / 2 + (b.ox || 0) * W / 2, (H - h) / 2 + (b.oy || 0) * H / 2, w, h);
      if (b.dim > 0) { x.fillStyle = 'rgba(0,0,0,' + b.dim + ')'; x.fillRect(0, 0, W, H); }
    } else {
      var a = (b.angle || 0) * Math.PI / 180, cx = W / 2, cy = H / 2, r = Math.sqrt(W * W + H * H) / 2;
      var g = x.createLinearGradient(cx - Math.sin(a) * r, cy + Math.cos(a) * r, cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      g.addColorStop(0, b.c1); g.addColorStop(1, b.c2); x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
  }
  function drawLayer(x, d, l) {
    x.save();
    var h = l.h;
    if (l.t === 'text') measureText(x, l); h = l.h;
    var cx = l.x + l.w / 2, cy = l.y + h / 2;
    x.translate(cx, cy); x.rotate((l.rot || 0) * Math.PI / 180); x.globalAlpha = l.op == null ? 1 : l.op;
    if (l.t === 'rect') {
      rr(x, -l.w / 2, -h / 2, l.w, h, l.radius); x.fillStyle = l.fill; x.fill();
      if (l.sw > 0 && l.stroke) { x.strokeStyle = l.stroke; x.lineWidth = l.sw; x.stroke(); }
    } else if (l.t === 'image') {
      var im = getImg(d, l.img);
      rr(x, -l.w / 2, -h / 2, l.w, h, l.radius);
      if (im) {
        x.save(); x.clip();
        var s = l.fit === 'contain' ? Math.min(l.w / im.width, h / im.height) : Math.max(l.w / im.width, h / im.height);
        x.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s); x.restore();
      } else { x.fillStyle = 'rgba(128,128,128,.3)'; x.fill(); }
    } else {
      x.font = l.weight + ' ' + l.size + 'px ' + FONTS[l.font || 'sans']; x.fillStyle = l.color; x.textBaseline = 'top';
      if (l.shadow) { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 16; x.shadowOffsetY = 4; }
      l._lines.forEach(function (ln, i) {
        var tw = x.measureText(ln).width, px = l.align === 'center' ? -tw / 2 : l.align === 'right' ? l.w / 2 - tw : -l.w / 2;
        x.fillText(ln, px, -h / 2 + i * l.size * l.lh + (l.size * l.lh - l.size) / 2);
      });
    }
    x.restore();
  }
  function render(x, d, selId) {
    var f = FORMATS[d.fmt], W = f[0], H = f[1];
    x.clearRect(0, 0, W, H); drawBg(x, d, W, H);
    d.layers.forEach(function (l) { drawLayer(x, d, l); });
    if (selId) {
      var l = d.layers.filter(function (q) { return q.id === selId; })[0];
      if (l) {
        x.save(); x.translate(l.x + l.w / 2, l.y + l.h / 2); x.rotate((l.rot || 0) * Math.PI / 180);
        x.strokeStyle = '#38bdf8'; x.lineWidth = 4; x.setLineDash([14, 10]); x.strokeRect(-l.w / 2 - 6, -l.h / 2 - 6, l.w + 12, l.h + 12); x.setLineDash([]);
        x.fillStyle = '#fff'; x.strokeStyle = '#0284c7'; x.lineWidth = 5; x.beginPath(); x.arc(l.w / 2 + 6, l.h / 2 + 6, 22, 0, 7); x.fill(); x.stroke();
        x.restore();
      }
    }
  }
  function redraw() { if (cv && D) { var f = FORMATS[D.fmt]; if (cv.width !== f[0]) { cv.width = f[0]; cv.height = f[1]; } render(ctx, D, sel); } }

  /* ---------------- tarixçə ---------------- */
  function snap() { var im = D.imgs; D.imgs = null; var s = JSON.stringify(D); D.imgs = im; return s; }
  function commit() { past.push(snap()); if (past.length > 60) past.shift(); future = []; dirty = true; syncUndo(); }
  function restore(s) { var im = D.imgs, o = JSON.parse(s); o.imgs = im; D = o; if (sel && !D.layers.some(function (l) { return l.id === sel; })) sel = null; }
  function undo() { if (!past.length) return; future.push(snap()); restore(past.pop()); dirty = true; panel(); redraw(); syncUndo(); }
  function redo() { if (!future.length) return; past.push(snap()); restore(future.pop()); dirty = true; panel(); redraw(); syncUndo(); }
  function syncUndo() { var u = $('#undo'), r = $('#redo'); if (u) u.disabled = !past.length; if (r) r.disabled = !future.length; }

  /* ---------------- şəkil yükləmə ---------------- */
  function readImage(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = rej;
      fr.onload = function () {
        var im = new Image();
        im.onerror = rej;
        im.onload = function () {
          var s = Math.min(1, MAXIMG / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          var x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
          var png = /png|webp|gif|svg/i.test(file.type || '');
          var out = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82);
          if (png && out.length > 380000) out = c.toDataURL('image/jpeg', 0.82);
          res({ src: out, w: c.width, h: c.height });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function pickImage(cb) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      readImage(f).then(cb, function () { toast('Şəkil oxunmadı'); });
    };
    inp.click();
  }
  function addImgData(r) { var id = uid('i'); D.imgs[id] = r.src; return id; }

  /* ---------------- saxlama (kitabxana) ---------------- */
  function thumb() {
    var t = document.createElement('canvas'), f = FORMATS[D.fmt], w = 300, h = Math.round(300 * f[1] / f[0]); t.width = w; t.height = h;
    var c = document.createElement('canvas'); c.width = f[0]; c.height = f[1]; render(c.getContext('2d'), D, null);
    t.getContext('2d').drawImage(c, 0, 0, w, h); return t.toDataURL('image/jpeg', 0.6);
  }
  function localLib() { var l = ls(LS_LIB, []); return Array.isArray(l) ? l : []; }
  function saveLocal(item) {
    var l = localLib().filter(function (x) { return x.id !== item.id; }); l.unshift(item);
    if (!lsSet(LS_LIB, l)) { var lite = l.map(function (x, i) { return i ? Object.assign({}, x, { design: null }) : x; }); lsSet(LS_LIB, lite); }
  }
  async function save() {
    var item = { id: D.id, name: D.name, key: D.key || '', img: thumb(), ts: Date.now(), design: D };
    D.ts = item.ts; saveLocal(item);
    var ok = false;
    try {
      var r = await sb('dq_v2_store', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: COL, data: { id: D.id, name: D.name, key: D.key || '', img: item.img, ts: item.ts, design: D } }) }, 12000);
      ok = r.ok;
    } catch (e) {}
    dirty = false;
    toast(ok ? 'Saxlandı ✓ Hər cihazda görünəcək' : 'Yalnız bu cihazda saxlandı (server əlçatmaz və ya şəkillər çoxdur)');
  }
  async function remoteLib() {
    try {
      var r = await sb('dq_v2_store?select=data&collection=eq.' + COL + '&order=id.desc&limit=120', {}, 8000);
      if (!r.ok) return null; var a = await r.json(), seen = {}, out = [];
      (a || []).forEach(function (x) { var d = x.data || {}; if (!d.id || seen[d.id]) return; seen[d.id] = 1; if (!d.deleted) out.push(d); });
      return out;
    } catch (e) { return null; }
  }
  async function removeItem(id) {
    var l = localLib().filter(function (x) { return x.id !== id; }); lsSet(LS_LIB, l);
    try { await sb('dq_v2_store', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ collection: COL, data: { id: id, deleted: true, ts: Date.now() } }) }, 8000); } catch (e) {}
  }
  async function findByKey(key) {
    var loc = localLib().filter(function (x) { return x.key === key && x.design; })[0]; if (loc) return loc.design;
    try {
      var r = await sb('dq_v2_store?select=data&collection=eq.' + COL + '&data->>key=eq.' + encodeURIComponent(key) + '&order=id.desc&limit=1', {}, 6000);
      if (r.ok) { var a = await r.json(); if (a && a[0] && a[0].data && !a[0].data.deleted && a[0].data.design) return a[0].data.design; }
    } catch (e) {}
    return null;
  }

  /* ---------------- çıxış / paylaşım ---------------- */
  function exportCanvas(d) { var f = FORMATS[d.fmt], c = document.createElement('canvas'); c.width = f[0]; c.height = f[1]; render(c.getContext('2d'), d, null); return c; }
  function toBlob(c) { return new Promise(function (r) { c.toBlob(r, 'image/png'); }); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function shareText(d) {
    var l = d.link || (d.key ? examLink(d.key) : examLink(''));
    var title = d.layers.filter(function (x) { return x.t === 'text' && x.size >= 60; })[0];
    return '📢 ' + (title ? title.text : d.name) + '\n\nQeydiyyat: ' + l;
  }
  async function shareDesign(d) {
    await preload(d);
    var blob = await toBlob(exportCanvas(d)), text = shareText(d), file = null;
    try { file = new File([blob], 'elan-' + (d.key || d.id) + '.png', { type: 'image/png' }); } catch (e) {}
    try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    download(blob, 'elan-' + (d.key || d.id) + '.png'); toast('Şəkil yükləndi — WhatsApp-da mətnlə əlavə edin');
    setTimeout(function () { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }, 700);
  }
  function preload(d) {
    var ids = Object.keys(d.imgs || {});
    return Promise.all(ids.map(function (id) {
      return new Promise(function (res) {
        var c = cache[id]; if (c && c.src === d.imgs[id] && c.complete) return res();
        var im = new Image(); im.onload = im.onerror = function () { res(); }; im.src = d.imgs[id]; cache[id] = im;
      });
    }));
  }

  /* ---------------- interfeys ---------------- */
  var CSS =
    ':host{all:initial}*{box-sizing:border-box}' +
    '.app{position:fixed;inset:0;display:flex;flex-direction:column;background:#eef1f8;color:#0f1f45;font-family:Mulish,Roboto,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:15px;-webkit-tap-highlight-color:transparent}' +
    'button,input,textarea,select{font:inherit;color:inherit}' +
    '.top{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:#0c1f4d;border-bottom:2px solid #c9a24a;color:#f3d47a;font-weight:800}' +
    '.top .tt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.x{border:1px solid #c9a24a;background:transparent;color:#f3d47a;border-radius:10px;padding:7px 12px;cursor:pointer;font-weight:700}' +
    '.x:disabled{opacity:.35}' +
    '.body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 12px 90px}' +
    '.w{max-width:760px;margin:0 auto}' +
    '.card{background:#fff;border:1px solid #e0e6f2;border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 6px 20px -14px #0f1f4540}' +
    '.card h3{margin:0 0 8px;font-size:14px;font-weight:800;letter-spacing:.02em}' +
    '.b{border:0;border-radius:12px;padding:11px 14px;font-weight:800;cursor:pointer;background:#1e1b4b;color:#fff}' +
    '.b.gold{background:linear-gradient(180deg,#f3d47a,#d4a73c);color:#13203f}.b.gh{background:#fff;color:#1e1b4b;border:1px solid #d3daea}.b.red{background:#dc2626}.b.sm{padding:8px 11px;font-size:13px}' +
    '.b:disabled{opacity:.45}.full{width:100%}' +
    '.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row>.grow{flex:1 1 120px}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
    '.it{background:#fff;border:1px solid #e0e6f2;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}' +
    '.it img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#dfe6f6;display:block}' +
    '.it .m{padding:8px 10px;font-size:12px;color:#5d6a88}.it .m b{display:block;color:#0f1f45;font-size:13px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.it .a{display:flex;gap:6px;padding:0 10px 10px}.it .a .b{flex:1;padding:8px 6px;font-size:12px}' +
    '.tp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.tp button{border:2px solid #d3daea;border-radius:12px;height:64px;cursor:pointer;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px #0008}' +
    '.tp button.l{color:#10204a;text-shadow:none}' +
    'label{display:block;font-size:12px;font-weight:700;color:#5d6a88;margin:10px 0 4px}' +
    'input[type=text],textarea,select{width:100%;padding:10px 11px;border:1px solid #d3daea;border-radius:11px;background:#fff;font-size:15px;outline:none}' +
    'textarea{min-height:70px;resize:vertical}input[type=range]{width:100%}' +
    'input[type=color]{width:100%;height:42px;border:1px solid #d3daea;border-radius:11px;padding:3px;background:#fff}' +
    '.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.stage{background:#d9e0f0;border-radius:18px;padding:12px;display:flex;justify-content:center;margin-bottom:10px;position:relative}' +
    'canvas{display:block;max-width:100%;max-height:56vh;width:auto;height:auto;border-radius:10px;box-shadow:0 14px 34px -14px #0008;touch-action:none;background:#0b1a40}' +
    '.tools{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;-webkit-overflow-scrolling:touch}.tools .b{white-space:nowrap;flex:none}' +
    '.seg{display:flex;border:1px solid #d3daea;border-radius:11px;overflow:hidden}.seg button{flex:1;border:0;background:#fff;padding:9px 4px;cursor:pointer;font-weight:700}.seg button.on{background:#1e1b4b;color:#fff}' +
    '.ly{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e0e6f2;border-radius:11px;margin-bottom:6px;background:#fff;cursor:pointer}.ly.on{border-color:#0284c7;background:#eaf6fd}.ly span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}' +
    '.ly i{font-style:normal;font-size:12px;color:#5d6a88;width:20px;text-align:center}.ly button{border:0;background:#eef1f8;border-radius:8px;padding:5px 8px;cursor:pointer}' +
    '.bar{position:sticky;bottom:0;display:flex;gap:8px;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:#fff;border-top:1px solid #dfe5f2}.bar .b{flex:1}' +
    '.hint{font-size:12px;color:#5d6a88;margin:4px 0 0}' +
    '.toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:99px;font-weight:700;z-index:9;max-width:90%;text-align:center}' +
    '.empty{padding:30px 14px;text-align:center;color:#5d6a88}';

  function build() {
    if (host && host.isConnected) return;
    host = document.createElement('div'); host.id = 'dqes-host';
    ['position:fixed', 'inset:0', 'z-index:2147483200', 'display:none'].forEach(function (p) { var kv = p.split(':'); host.style.setProperty(kv[0], kv[1], 'important'); });
    sr = host.attachShadow({ mode: 'open' }); sr.innerHTML = '<style>' + CSS + '</style><div class="app" id="app"></div>';
    document.body.appendChild(host);
  }
  function show(v) {
    host.style.setProperty('display', v ? 'block' : 'none', 'important');
    if (v && prevOverflow === null) { prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    if (!v && prevOverflow !== null) { document.body.style.overflow = prevOverflow === 'hidden' ? '' : prevOverflow; prevOverflow = null; }
  }
  function close() {
    if (view === 'ed' && dirty && !confirm('Saxlanmamış dəyişikliklər var. Çıxılsın?')) return;
    show(false); D = null; cv = null;
  }
  function app() { return sr.getElementById('app'); }

  /* ----- kitabxana görünüşü ----- */
  async function openLib() {
    view = 'lib'; D = null; cv = null; sel = null;
    var A = app();
    A.innerHTML = '<div class="top"><span class="tt">📣 Elan Studio</span><button class="x" id="cl">Bağla</button></div><div class="body"><div class="w">' +
      '<div class="card"><h3>Yeni elan</h3><div class="tp" id="tp">' +
      Object.keys(TPLS).map(function (k) { var t = TPLS[k]; return '<button data-k="' + k + '" class="' + (k === 'light' ? 'l' : '') + '" style="background:linear-gradient(160deg,' + t.bg.c1 + ',' + t.bg.c2 + ')">' + esc(t.n) + '</button>'; }).join('') +
      '</div><div class="row" style="margin-top:10px"><button class="b gh grow" id="blank">Boş kətan</button></div></div>' +
      '<div class="card"><h3>Aktiv imtahandan yarat</h3><div id="ex" class="hint">Yüklənir…</div></div>' +
      '<div class="card"><h3>Elanlarım</h3><div id="lib"><div class="hint">Yüklənir…</div></div></div>' +
      '</div></div>';
    $('#cl').onclick = close;
    $('#tp').onclick = function (e) { var b = e.target.closest('[data-k]'); if (b) openEditor(fromTemplate(b.getAttribute('data-k'))); };
    $('#blank').onclick = function () { openEditor(blank('4:5')); };

    var exams = []; try { exams = await G().getExams(); } catch (e) {}
    if (view !== 'lib') return;
    exams.sort(function (a, b) { return String(a.group).localeCompare(b.group) || a.number - b.number; });
    var exEl = $('#ex');
    exEl.innerHTML = exams.length ? '<div class="row">' + exams.map(function (e, i) { return '<button class="b gh sm" data-i="' + i + '">' + esc(e.group) + ' · Sınaq ' + esc(e.number) + '</button>'; }).join('') + '</div><p class="hint">Seçdiyiniz imtahanın məlumatları elana avtomatik yazılır. Bu elan portalda həmin sınağın «🔗 Paylaş» düyməsində istifadə olunacaq.</p>' : 'Hazırda aktiv imtahan yoxdur (İmtahanPro-da aktiv edin).';
    exEl.onclick = async function (ev) {
      var b = ev.target.closest('[data-i]'); if (!b) return; var e = exams[+b.getAttribute('data-i')];
      var ex = await findByKey(keyOf(e)); if (ex) { if (confirm('Bu sınaq üçün elan artıq var. Onu açım? (Ləğv = yenisini yarat)')) { await preload(ex); return openEditor(ex, true); } }
      openEditor(fromTemplate('gold', e));
    };

    var local = localLib(), remote = await remoteLib(), map = {};
    local.forEach(function (x) { map[x.id] = x; });
    (remote || []).forEach(function (x) { if (!map[x.id] || (x.ts || 0) >= (map[x.id].ts || 0)) map[x.id] = Object.assign({}, map[x.id] || {}, x); });
    var items = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    if (view !== 'lib') return;
    $('#lib').innerHTML = items.length ? '<div class="grid">' + items.map(function (x, i) {
      return '<div class="it"><img alt="" src="' + esc(x.img || '') + '"><div class="m"><b>' + esc(x.name) + '</b>' + (x.key ? esc(x.key) + ' · ' : '') + new Date(x.ts || 0).toLocaleDateString('az') + '</div>' +
        '<div class="a"><button class="b sm" data-o="' + i + '">Aç</button><button class="b red sm" data-d="' + i + '">Sil</button></div></div>';
    }).join('') + '</div>' : '<div class="empty">Hələ elan yoxdur. Yuxarıdan şablon seçin.</div>';
    $('#lib').onclick = async function (ev) {
      var o = ev.target.closest('[data-o]'), d = ev.target.closest('[data-d]');
      if (o) { var it = items[+o.getAttribute('data-o')]; if (!it.design) { toast('Bu elan yalnız serverdə var, yüklənmədi'); return; } await preload(it.design); openEditor(it.design, true); }
      if (d) { var it2 = items[+d.getAttribute('data-d')]; if (confirm('«' + it2.name + '» silinsin?')) { await removeItem(it2.id); openLib(); } }
    };
  }

  /* ----- redaktor ----- */
  function openEditor(design, existing) {
    view = 'ed'; D = design; D.imgs = D.imgs || {}; sel = null; past = []; future = []; dirty = !existing;
    var A = app();
    A.innerHTML = '<div class="top"><button class="x" id="bk">‹ Geri</button><span class="tt" id="nm">' + esc(D.name) + '</span>' +
      '<button class="x" id="undo" title="Geri al">↶</button><button class="x" id="redo" title="İrəli">↷</button></div>' +
      '<div class="body"><div class="w">' +
      '<div class="stage"><canvas id="cv"></canvas></div>' +
      '<div class="tools" id="tools">' +
      '<button class="b sm" data-a="text">＋ Mətn</button><button class="b sm" data-a="img">＋ Şəkil</button><button class="b sm" data-a="rect">＋ Fiqur</button>' +
      '<button class="b gh sm" data-a="bg">🎨 Fon</button><button class="b gh sm" data-a="fmt">📐 Format</button><button class="b gh sm" data-a="info">⚙️ Elan</button></div>' +
      '<div id="pn"></div>' +
      '<div class="card"><h3>Qatlar</h3><div id="ls"></div></div>' +
      '</div></div>' +
      '<div class="bar"><button class="b gh" id="sv">💾 Saxla</button><button class="b gh" id="dl">⬇️ PNG</button><button class="b gold" id="sh">📣 Paylaş</button></div>';
    cv = $('#cv'); var f = FORMATS[D.fmt]; cv.width = f[0]; cv.height = f[1]; ctx = cv.getContext('2d');
    $('#bk').onclick = function () { if (dirty && !confirm('Saxlanmamış dəyişikliklər var. Geri qayıdılsın?')) return; openLib(); };
    $('#undo').onclick = undo; $('#redo').onclick = redo;
    $('#sv').onclick = async function () { var b = this; b.disabled = true; await save(); b.disabled = false; };
    $('#dl').onclick = async function () { await preload(D); download(await toBlob(exportCanvas(D)), 'elan-' + (D.key || D.id) + '.png'); toast('Yükləndi ✓'); };
    $('#sh').onclick = function () { shareDesign(D); };
    $('#tools').onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a'), f = FORMATS[D.fmt];
      if (a === 'text') { commit(); var l = T('Yeni mətn', { x: 80, y: f[1] / 2 - 40, size: 64 }); D.layers.push(l); sel = l.id; panel(); redraw(); }
      else if (a === 'rect') { commit(); var r = R({ x: 80, y: f[1] / 2, w: 500, h: 120 }); D.layers.push(r); sel = r.id; panel(); redraw(); }
      else if (a === 'img') {
        if (D.layers.filter(function (q) { return q.t === 'image'; }).length >= MAXLAYERS_IMG) { toast('Ən çox ' + MAXLAYERS_IMG + ' şəkil'); return; }
        pickImage(function (r) { commit(); var id = addImgData(r), w = Math.min(560, r.w), h = Math.round(w * r.h / r.w); var l = I(id, { x: (f[0] - w) / 2, y: (f[1] - h) / 2, w: w, h: h }); D.layers.push(l); sel = l.id; panel(); redraw(); });
      } else { sel = null; panel(a); redraw(); }
    };
    bindCanvas(); panel(); layersUi(); syncUndo();
    redraw(); preload(D).then(redraw);
  }

  function hit(px, py) {
    for (var i = D.layers.length - 1; i >= 0; i--) {
      var l = D.layers[i], cx = l.x + l.w / 2, cy = l.y + l.h / 2, a = -(l.rot || 0) * Math.PI / 180, dx = px - cx, dy = py - cy;
      var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= l.w / 2 + 6 && Math.abs(ly) <= l.h / 2 + 6) return l;
    }
    return null;
  }
  function bindCanvas() {
    function pt(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
    cv.onpointerdown = function (e) {
      var p = pt(e), cur = D.layers.filter(function (l) { return l.id === sel; })[0], mode = 'move', l = null;
      if (cur) {
        var a = -(cur.rot || 0) * Math.PI / 180, dx = p[0] - (cur.x + cur.w / 2), dy = p[1] - (cur.y + cur.h / 2);
        var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.hypot(lx - (cur.w / 2 + 6), ly - (cur.h / 2 + 6)) < 44) { mode = 'size'; l = cur; }
      }
      if (!l) l = hit(p[0], p[1]);
      if (!l) { if (sel) { sel = null; panel(); redraw(); } return; }
      if (sel !== l.id) { sel = l.id; panel(); }
      drag = { l: l, mode: mode, p: p, x: l.x, y: l.y, w: l.w, h: l.h, a: -(l.rot || 0) * Math.PI / 180, c: false };
      try { cv.setPointerCapture(e.pointerId); } catch (_) {} redraw(); e.preventDefault();
    };
    cv.onpointermove = function (e) {
      if (!drag) return; var p = pt(e), dx = p[0] - drag.p[0], dy = p[1] - drag.p[1], l = drag.l;
      if (!drag.c) { if (Math.hypot(dx, dy) < 4) return; drag.c = true; var kx = drag.l.x, ky = drag.l.y; commit(); }
      if (drag.mode === 'move') { l.x = Math.round(drag.x + dx); l.y = Math.round(drag.y + dy); }
      else {
        var lx = dx * Math.cos(drag.a) - dy * Math.sin(drag.a), ly = dx * Math.sin(drag.a) + dy * Math.cos(drag.a);
        l.w = Math.max(40, Math.round(drag.w + lx));
        if (l.t === 'image') l.h = Math.max(40, Math.round(l.w * drag.h / drag.w));
        else if (l.t === 'rect') l.h = Math.max(20, Math.round(drag.h + ly));
      }
      dirty = true; redraw();
    };
    function end() { if (drag) { drag = null; panel(); layersUi(); } }
    cv.onpointerup = end; cv.onpointercancel = end;
  }

  /* ----- xassə paneli ----- */
  function field(id, label, html) { return '<label for="' + id + '">' + label + '</label>' + html; }
  function rng(id, label, v, a, b, st) { return field(id, label, '<input type="range" id="' + id + '" min="' + a + '" max="' + b + '" step="' + (st || 1) + '" value="' + v + '">'); }
  function col(id, label, v) { return field(id, label, '<input type="color" id="' + id + '" value="' + esc(v || '#ffffff') + '">'); }
  function liveBind(id, fn, once) {
    var el = $('#' + id); if (!el) return; var started = false;
    var h = function () { if (!started) { commit(); started = true; } fn(el); dirty = true; redraw(); };
    el.addEventListener('input', h); el.addEventListener('change', function () { started = false; layersUi(); });
  }
  function panel(mode) {
    var P = $('#pn'); if (!P) return; var l = D.layers.filter(function (q) { return q.id === sel; })[0], h = '';
    if (l) {
      h += '<div class="card"><h3>' + (l.t === 'text' ? 'Mətn' : l.t === 'image' ? 'Şəkil' : 'Fiqur') + ' xassələri</h3>';
      if (l.t === 'text') {
        h += field('p-tx', 'Mətn', '<textarea id="p-tx">' + esc(l.text) + '</textarea>') +
          rng('p-sz', 'Ölçü: ' + l.size, l.size, 16, 240) +
          '<div class="g2">' + field('p-wt', 'Qalınlıq', '<select id="p-wt">' + [[500, 'Normal'], [700, 'Qalın'], [800, 'Çox qalın'], [900, 'Ən qalın']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] == l.weight ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') +
          field('p-ft', 'Şrift', '<select id="p-ft">' + [['sans', 'Müasir'], ['serif', 'Klassik'], ['round', 'Yumru'], ['mono', 'Yazı maşını']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === l.font ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '</div>' +
          '<div class="g2">' + col('p-co', 'Rəng', l.color) + field('p-al', 'Düzülüş', '<div class="seg" id="p-al">' + ['left', 'center', 'right'].map(function (a, i) { return '<button data-v="' + a + '" class="' + (l.align === a ? 'on' : '') + '">' + ['⬅', '⬌', '➡'][i] + '</button>'; }).join('') + '</div>') + '</div>' +
          rng('p-lh', 'Sətir aralığı', l.lh, 0.9, 2, 0.02) +
          '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="p-sh"' + (l.shadow ? ' checked' : '') + '> Kölgə</label>';
      } else if (l.t === 'image') {
        h += '<div class="row"><button class="b gh sm" id="p-rp">Şəkli dəyiş</button></div>' +
          field('p-fit', 'Yerləşmə', '<select id="p-fit"><option value="cover"' + (l.fit === 'cover' ? ' selected' : '') + '>Doldur (kəs)</option><option value="contain"' + (l.fit === 'contain' ? ' selected' : '') + '>Tam sığdır</option></select>') +
          rng('p-rad', 'Künc yuvarlaqlığı', l.radius, 0, Math.round(Math.min(l.w, l.h) / 2));
      } else {
        h += '<div class="g2">' + col('p-fi', 'Doldurma', l.fill) + col('p-st', 'Haşiyə', l.stroke || '#ffffff') + '</div>' +
          rng('p-sw', 'Haşiyə qalınlığı', l.sw || 0, 0, 30) + rng('p-rad', 'Künc yuvarlaqlığı', l.radius, 0, 300);
      }
      h += rng('p-op', 'Şəffaflıq', l.op == null ? 1 : l.op, 0.05, 1, 0.05) + rng('p-ro', 'Dönmə: ' + (l.rot || 0) + '°', l.rot || 0, -180, 180) +
        '<div class="row" style="margin-top:12px"><button class="b gh sm" id="p-cx">↔ Mərkəzlə</button><button class="b gh sm" id="p-up">↑ Öndə</button><button class="b gh sm" id="p-dn">↓ Arxada</button><button class="b gh sm" id="p-dp">⧉ Təkrarla</button><button class="b red sm" id="p-del">🗑 Sil</button></div></div>';
    } else if (mode === 'bg') {
      var b = D.bg;
      h += '<div class="card"><h3>Fon</h3><div class="seg" id="b-t">' + [['grad', 'Qradiyent'], ['solid', 'Rəng'], ['image', 'Şəkil']].map(function (o) { return '<button data-v="' + o[0] + '" class="' + (b.type === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
      if (b.type !== 'image') h += '<div class="g2">' + col('b-c1', b.type === 'solid' ? 'Rəng' : 'Rəng 1', b.c1) + (b.type === 'grad' ? col('b-c2', 'Rəng 2', b.c2) : '') + '</div>' + (b.type === 'grad' ? rng('b-an', 'Bucaq', b.angle, 0, 360) : '');
      else h += '<div class="row" style="margin-top:10px"><button class="b gh sm" id="b-up">' + (b.img ? 'Şəkli dəyiş' : 'Şəkil seç') + '</button></div>' + rng('b-zm', 'Yaxınlaşdır', b.zoom, 1, 3, 0.05) + rng('b-ox', 'Üfüqi sürüşdür', b.ox, -1, 1, 0.02) + rng('b-oy', 'Şaquli sürüşdür', b.oy, -1, 1, 0.02) + rng('b-dm', 'Qaraltma', b.dim, 0, 0.9, 0.05);
      h += '</div>';
    } else if (mode === 'fmt') {
      h += '<div class="card"><h3>Format</h3><div class="seg" id="f-s">' + Object.keys(FORMATS).map(function (k) { return '<button data-v="' + k + '" class="' + (D.fmt === k ? 'on' : '') + '">' + FORMATS[k][2] + '</button>'; }).join('') + '</div><p class="hint">Formatı dəyişəndə qatlar öz yerində qalır; lazım olsa sürüşdürün.</p></div>';
    } else if (mode === 'info') {
      h += '<div class="card"><h3>Elan məlumatı</h3>' + field('i-nm', 'Elanın adı (yalnız sizin üçün)', '<input type="text" id="i-nm" value="' + esc(D.name) + '">') +
        field('i-key', 'Sınağa bağla (məs. BB-1)', '<input type="text" id="i-key" value="' + esc(D.key) + '" placeholder="boş = ümumi elan">') +
        field('i-lk', 'Paylaşım linki', '<input type="text" id="i-lk" value="' + esc(D.link) + '" placeholder="boş = ' + esc(examLink(D.key)) + '">') +
        '<p class="hint">Sınağa bağlanan elan portalda həmin sınağın «🔗 Paylaş» düyməsində istifadə olunur.</p></div>';
    } else h += '<div class="card"><p class="hint" style="margin:0">Elementi seçmək üçün üzərinə toxunun. Sürüşdürmək üçün barmaqla çəkin, ölçüsünü dəyişmək üçün mavi dairəni çəkin. Fon, format və məlumat üçün yuxarıdakı düymələr.</p></div>';
    P.innerHTML = h; bindPanel(l, mode); layersUi();
  }
  function bindPanel(l, mode) {
    if (l) {
      liveBind('p-tx', function (e) { l.text = e.value; });
      liveBind('p-sz', function (e) { l.size = +e.value; e.previousElementSibling.textContent = 'Ölçü: ' + l.size; });
      liveBind('p-wt', function (e) { l.weight = +e.value; }); liveBind('p-ft', function (e) { l.font = e.value; });
      liveBind('p-co', function (e) { l.color = e.value; }); liveBind('p-lh', function (e) { l.lh = +e.value; });
      liveBind('p-sh', function (e) { l.shadow = e.checked; }); liveBind('p-fit', function (e) { l.fit = e.value; });
      liveBind('p-rad', function (e) { l.radius = +e.value; }); liveBind('p-fi', function (e) { l.fill = e.value; });
      liveBind('p-st', function (e) { l.stroke = e.value; }); liveBind('p-sw', function (e) { l.sw = +e.value; });
      liveBind('p-op', function (e) { l.op = +e.value; });
      liveBind('p-ro', function (e) { l.rot = +e.value; e.previousElementSibling.textContent = 'Dönmə: ' + l.rot + '°'; });
      var al = $('#p-al'); if (al) al.onclick = function (e) { var b = e.target.closest('[data-v]'); if (!b) return; commit(); l.align = b.getAttribute('data-v'); [].forEach.call(al.children, function (x) { x.classList.toggle('on', x === b); }); redraw(); };
      var rp = $('#p-rp'); if (rp) rp.onclick = function () { pickImage(function (r) { commit(); l.img = addImgData(r); l.h = Math.round(l.w * r.h / r.w); panel(); redraw(); }); };
      $('#p-cx').onclick = function () { commit(); l.x = Math.round((FORMATS[D.fmt][0] - l.w) / 2); redraw(); };
      $('#p-up').onclick = function () { var i = D.layers.indexOf(l); if (i < D.layers.length - 1) { commit(); D.layers.splice(i, 1); D.layers.splice(i + 1, 0, l); redraw(); layersUi(); } };
      $('#p-dn').onclick = function () { var i = D.layers.indexOf(l); if (i > 0) { commit(); D.layers.splice(i, 1); D.layers.splice(i - 1, 0, l); redraw(); layersUi(); } };
      $('#p-dp').onclick = function () { commit(); var c = JSON.parse(JSON.stringify(l)); c.id = uid('l'); c.x += 40; c.y += 40; D.layers.push(c); sel = c.id; panel(); redraw(); };
      $('#p-del').onclick = function () { commit(); D.layers = D.layers.filter(function (q) { return q !== l; }); sel = null; panel(); redraw(); };
    } else if (mode === 'bg') {
      var b = D.bg, bt = $('#b-t');
      bt.onclick = function (e) { var x = e.target.closest('[data-v]'); if (!x) return; commit(); b.type = x.getAttribute('data-v'); panel('bg'); redraw(); };
      liveBind('b-c1', function (e) { b.c1 = e.value; }); liveBind('b-c2', function (e) { b.c2 = e.value; }); liveBind('b-an', function (e) { b.angle = +e.value; });
      liveBind('b-zm', function (e) { b.zoom = +e.value; }); liveBind('b-ox', function (e) { b.ox = +e.value; }); liveBind('b-oy', function (e) { b.oy = +e.value; }); liveBind('b-dm', function (e) { b.dim = +e.value; });
      var up = $('#b-up'); if (up) up.onclick = function () { pickImage(function (r) { commit(); b.img = addImgData(r); b.type = 'image'; panel('bg'); redraw(); }); };
    } else if (mode === 'fmt') {
      $('#f-s').onclick = function (e) { var x = e.target.closest('[data-v]'); if (!x) return; commit(); D.fmt = x.getAttribute('data-v'); var f = FORMATS[D.fmt]; cv.width = f[0]; cv.height = f[1]; panel('fmt'); redraw(); };
    } else if (mode === 'info') {
      var nm = $('#i-nm'), ky = $('#i-key'), lk = $('#i-lk');
      nm.oninput = function () { D.name = nm.value; $('#nm').textContent = D.name || 'Elan'; dirty = true; };
      ky.oninput = function () { D.key = ky.value.trim().toUpperCase(); dirty = true; };
      lk.oninput = function () { D.link = lk.value.trim(); dirty = true; };
    }
  }
  function layersUi() {
    var L = $('#ls'); if (!L || !D) return;
    L.innerHTML = D.layers.length ? D.layers.slice().reverse().map(function (l) {
      var lab = l.t === 'text' ? l.text.replace(/\n/g, ' ') : l.t === 'image' ? 'Şəkil' : 'Fiqur';
      return '<div class="ly' + (l.id === sel ? ' on' : '') + '" data-id="' + l.id + '"><i>' + (l.t === 'text' ? 'T' : l.t === 'image' ? '🖼' : '▭') + '</i><span>' + esc(lab) + '</span></div>';
    }).join('') : '<div class="hint">Qat yoxdur. Yuxarıdan əlavə edin.</div>';
    L.onclick = function (e) { var r = e.target.closest('[data-id]'); if (!r) return; sel = r.getAttribute('data-id'); panel(); redraw(); };
  }

  /* ---------------- ictimai API ---------------- */
  function open(opts) {
    if (!isAdmin()) { alert('Bu bölmə yalnız admin üçündür'); return; }
    build(); show(true);
    if (opts && opts.group && opts.number) { findByKey(keyOf(opts)).then(function (ex) { if (ex) preload(ex).then(function () { openEditor(ex, true); }); else openEditor(fromTemplate('gold', opts)); }); }
    else openLib();
  }
  /* Hamı üçün: imtahana bağlı admin elanı varsa o, yoxdursa standart şablonla paylaşır */
  async function quickShare(ex) {
    try {
      var d = await findByKey(keyOf(ex)); if (!d) d = fromTemplate('gold', ex); d.imgs = d.imgs || {};
      await shareDesign(d);
    } catch (e) { alert('Paylaşmaq alınmadı'); }
  }

  /* ---------------- «Digər alətlər» bölməsinə kart ---------------- */
  function injectTile() {
    try {
      if (!isAdmin()) return;
      var all = document.querySelectorAll('body *'), src = null;
      for (var i = 0; i < all.length; i++) {
        var e = all[i]; if (e.closest('#dqes-host') || e.children.length > 0) continue;
        if ((e.textContent || '').trim() === 'ImtahanPro') {
          var t = e; for (var k = 0; k < 5 && t.parentElement; k++) { if (t.parentElement.children.length >= 4 && t.parentElement.children.length === [].filter.call(t.parentElement.children, function (c) { return c.tagName === t.tagName; }).length) break; t = t.parentElement; }
          if (t.parentElement && t.parentElement.children.length >= 3) { src = t; break; }
        }
      }
      if (!src) return;
      var par = src.parentElement; if (par.querySelector('[data-dqes-tile]')) return;
      var c = src.cloneNode(true);
      [c].concat([].slice.call(c.querySelectorAll('*'))).forEach(function (n) {
        n.removeAttribute('id'); n.removeAttribute('onclick'); n.removeAttribute('href');
        [].slice.call(n.attributes).forEach(function (a) { if (/^data-/.test(a.name)) n.removeAttribute(a.name); });
      });
      var w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), n, done = false, iconDone = false;
      while ((n = w.nextNode())) { if (n.data.trim() === 'ImtahanPro') { n.data = 'Elan Studio'; done = true; } }
      [].forEach.call(c.querySelectorAll('*'), function (el) {
        if (iconDone) return; var tx = (el.textContent || '').trim();
        if (!el.children.length && tx && tx.length <= 4 && !/[A-Za-z0-9]/.test(tx)) { el.textContent = '📣'; iconDone = true; }
      });
      if (!done) return;
      c.setAttribute('data-dqes-tile', '1'); c.style.cursor = 'pointer';
      c.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); open(); });
      src.insertAdjacentElement('afterend', c);
    } catch (e) {}
  }
  var tmr = 0;
  function schedTile() { if (tmr) return; tmr = setTimeout(function () { tmr = 0; injectTile(); }, 400); }
  function initTile() {
    try { new MutationObserver(schedTile).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    setInterval(injectTile, 2500); schedTile();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && host && host.style.display === 'block') close(); });
  window.DQElanStudio = { open: open, close: close, quickShare: quickShare };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTile); else initTile();
})();
