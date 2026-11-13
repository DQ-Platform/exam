/*!
 * DQ Platform — Qeydiyyat elanı (v1)
 * Admin paneldə «📣 Qeydiyyat elanı» kartı: aktiv imtahanların siyahısı, hər birinin altında
 * «Qeydiyyat elanı paylaş» düyməsi. Paylaşmazdan əvvəl qapaq şəkli redaktə olunur.
 * Elan linki (?qeyd=BB-1) açılanda qeydiyyat pəncərəsi birbaşa açılır və qapaq orada görünür.
 *
 * Qoşulma: dq-imtahan-giris.js-dən SONRA
 *   <script src="dq-elan.js?v=1"></script>
 * Açmaq:  DQElan.open()  — siyahı,   DQElan.open({group:'BB', number:1})  — birbaşa redaktor
 */
(function () {
  'use strict';
  if (window.DQElan) return;

  var W = 1080, H = 1350, LSK = 'dq_elan_cfg';
  var root = null, state = { exam: null, cfg: null, bgImg: null, cv: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function G() { return window.DQImtahanGiris; }
  function keyOf(e) { return String(e.group).toUpperCase() + '-' + (parseInt(e.number, 10) || 0); }
  function link(e) { return location.origin + location.pathname + '?qeyd=' + encodeURIComponent(keyOf(e)); }
  function toast(t) {
    ensureCss();
    var d = document.createElement('div'); d.className = 'dqe-toast'; d.textContent = t; (root || document.body).appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }

  var CSS =
    '.dqe{position:fixed;inset:0;z-index:2147483100;background:#f3f5fa;overflow:auto;-webkit-overflow-scrolling:touch;font-family:Mulish,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f1f45;font-size:14px;line-height:1.4;text-align:left}' +
    '.dqe *{box-sizing:border-box}.dqe button,.dqe input,.dqe textarea,.dqe select{font:inherit;color:inherit}' +
    '.dqe-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:#0c1f4d;border-bottom:2px solid #c9a24a;color:#f3d47a;font-weight:800;font-size:16px}' +
    '.dqe-x{border:1px solid #c9a24a;background:transparent;color:#f3d47a;border-radius:10px;padding:7px 14px;cursor:pointer}' +
    '.dqe-w{max-width:720px;margin:0 auto;padding:16px 14px 60px}' +
    '.dqe-card{background:#fff;border:1px solid #e3e8f2;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 6px 20px -14px #0f1f4540}' +
    '.dqe-tag{display:inline-block;font-size:12px;font-weight:800;color:#8a6410;background:#fff7e0;border:1px solid #f0d58a;padding:3px 10px;border-radius:99px}' +
    '.dqe-t{font-size:16px;font-weight:800;margin:8px 0 4px}.dqe-m{font-size:12px;color:#5d6a88}' +
    '.dqe-b{border:0;border-radius:12px;padding:12px 16px;font-weight:800;cursor:pointer;background:#1e1b4b;color:#fff}' +
    '.dqe-b.gold{background:linear-gradient(180deg,#f3d47a,#d4a73c);color:#13203f}.dqe-b.gh{background:#fff;color:#1e1b4b;border:1px solid #d9deeb}' +
    '.dqe-b.full{width:100%;margin-top:12px}.dqe-b:disabled{opacity:.5}' +
    '.dqe-prev{display:block;width:100%;max-width:420px;margin:0 auto 14px;border-radius:14px;box-shadow:0 14px 34px -14px #0008;background:#0b1a40}' +
    '.dqe label{display:block;font-size:12px;font-weight:700;color:#5d6a88;margin:12px 0 5px}' +
    '.dqe input[type=text],.dqe textarea,.dqe select{width:100%;padding:11px 12px;border:1px solid #d9deeb;border-radius:12px;background:#fff;font-size:15px;outline:none}' +
    '.dqe textarea{min-height:64px;resize:vertical}.dqe input[type=range]{width:100%}' +
    '.dqe-g{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.dqe-g4{grid-template-columns:repeat(4,1fr)}' +
    '.dqe input[type=color]{width:100%;height:44px;border:1px solid #d9deeb;border-radius:12px;padding:3px;background:#fff}' +
    '.dqe-row{display:flex;gap:10px;flex-wrap:wrap}.dqe-row>*{flex:1 1 140px}' +
    '.dqe-link{word-break:break-all;font-size:12px;background:#eef2fb;border-radius:10px;padding:9px 11px;color:#1e1b4b;margin-top:8px}' +
    '.dqe-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:99px;font-weight:700;z-index:9;max-width:90%}' +
    '.dqe h3{margin:0 0 4px;font-size:15px;font-weight:800}';

  function defaults(ex) {
    var pr = (G() && G().config && G().config.prices || {})[ex.group];
    return {
      brand: 'DQ Platform', badge: 'QEYDİYYAT AÇIQDIR',
      title: ex.title || ('Dövlət Qulluğu ' + ex.group + ' kateqoriyası üzrə sınaq ' + ex.number),
      sub: 'Sınaq imtahanına qeydiyyat başlayıb',
      info: (ex.questions || '') + ' sual · ' + (ex.duration || '') + ' dəqiqə',
      price: pr ? pr + ' AZN' : '', when: '', cta: 'Qeydiyyatdan keç',
      bg1: '#0b1a40', bg2: '#12306f', accent: '#f3d47a', text: '#ffffff',
      ov: 0.45, pos: 'center', tsize: 74, bg: ''
    };
  }

  /* ---------- qapağın çəkilməsi (canvas) ---------- */
  function wrap(x, text, maxW) {
    var out = [];
    String(text || '').split('\n').forEach(function (par) {
      var words = par.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  function rr(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  var FONT = 'Mulish,"Segoe UI",Roboto,Arial,sans-serif';

  function draw(cv, c, bgImg, ex) {
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d'), P = 90, mw = W - P * 2;
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, c.bg1); g.addColorStop(1, c.bg2);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (bgImg) {
      var r = Math.max(W / bgImg.width, H / bgImg.height), w = bgImg.width * r, h = bgImg.height * r;
      x.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
      x.fillStyle = 'rgba(5,10,30,' + c.ov + ')'; x.fillRect(0, 0, W, H);
    }
    x.strokeStyle = c.accent; x.globalAlpha = .55; x.lineWidth = 4; rr(x, 34, 34, W - 68, H - 68, 36); x.stroke(); x.globalAlpha = 1;

    /* brend */
    x.fillStyle = c.accent; rr(x, P, 90, 84, 84, 20); x.fill();
    x.fillStyle = '#13203f'; x.font = '800 36px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DQ', P + 42, 133);
    x.textAlign = 'left'; x.fillStyle = c.text; x.font = '800 40px ' + FONT; x.fillText(c.brand || '', P + 108, 133);

    /* mətn bloku: əvvəl ölçülür, sonra yerləşdirilir */
    var ts = +c.tsize || 74, blocks = [], gap = 34;
    x.font = '800 ' + ts + 'px ' + FONT; var tl = wrap(x, c.title, mw);
    x.font = '600 40px ' + FONT; var sl = c.sub ? wrap(x, c.sub, mw) : [];
    var chips = [c.info, c.price, c.when].filter(Boolean);
    var bh = 62 + gap + tl.length * ts * 1.18 + (sl.length ? gap + sl.length * 54 : 0) + (chips.length ? gap + chips.length * 76 : 0);
    var y0 = c.pos === 'top' ? 250 : c.pos === 'bottom' ? H - bh - 330 : Math.max(250, (H - bh) / 2 - 20);
    var y = y0;

    if (c.badge) {
      x.font = '800 28px ' + FONT; var bw = x.measureText(c.badge).width + 56;
      x.fillStyle = c.accent; x.globalAlpha = .18; rr(x, P, y, bw, 62, 31); x.fill(); x.globalAlpha = 1;
      x.strokeStyle = c.accent; x.lineWidth = 2; rr(x, P, y, bw, 62, 31); x.stroke();
      x.fillStyle = c.accent; x.textBaseline = 'middle'; x.fillText(c.badge, P + 28, y + 32);
    }
    y += 62 + gap; x.textBaseline = 'top';
    x.fillStyle = c.text; x.font = '800 ' + ts + 'px ' + FONT;
    tl.forEach(function (l) { x.fillText(l, P, y); y += ts * 1.18; });
    if (sl.length) {
      y += gap - 6; x.fillStyle = c.accent; x.font = '600 40px ' + FONT;
      sl.forEach(function (l) { x.fillText(l, P, y); y += 54; });
    }
    if (chips.length) {
      y += gap - 6; x.font = '700 34px ' + FONT;
      chips.forEach(function (t) {
        var cw = x.measureText(t).width + 52;
        x.fillStyle = 'rgba(255,255,255,.14)'; rr(x, P, y, cw, 60, 18); x.fill();
        x.fillStyle = c.text; x.textBaseline = 'middle'; x.fillText(t, P + 26, y + 31); x.textBaseline = 'top'; y += 76;
      });
    }

    /* CTA */
    var cy = H - 250;
    x.fillStyle = c.accent; rr(x, P, cy, mw, 110, 55); x.fill();
    x.fillStyle = '#13203f'; x.font = '800 46px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText((c.cta || 'Qeydiyyatdan keç') + '  →', W / 2, cy + 56);
    x.fillStyle = c.text; x.globalAlpha = .8; x.font = '600 28px ' + FONT;
    x.fillText(location.host || 'dqplatform', W / 2, cy + 150); x.globalAlpha = 1; x.textAlign = 'left';
  }

  function redraw() {
    if (!state.cv) return;
    draw(state.cv, state.cfg, state.bgImg, state.exam);
  }

  /* ---------- yaddaş ---------- */
  async function loadCfg(ex) {
    var k = keyOf(ex), c = (ls(LSK, {}))[k];
    if (!c) {
      try {
        var r = await G().sb('dq_v2_store?select=data&collection=eq.elan&data->>key=eq.' + encodeURIComponent(k) + '&order=id.desc&limit=1', {}, 4000);
        if (r.ok) { var a = await r.json(); if (a && a[0] && a[0].data && a[0].data.cfg) c = a[0].data.cfg; }
      } catch (e) {}
    }
    return Object.assign(defaults(ex), c || {});
  }
  function thumb(cv) {
    var t = document.createElement('canvas'); t.width = 600; t.height = 750;
    t.getContext('2d').drawImage(cv, 0, 0, 600, 750);
    return t.toDataURL('image/jpeg', .72);
  }
  async function save() {
    var ex = state.exam, k = keyOf(ex), all = ls(LSK, {});
    all[k] = state.cfg;
    var ok = lsSet(LSK, all);
    var remoteCfg = Object.assign({}, state.cfg, { bg: '' });
    var img = thumb(state.cv);
    try {
      var r = await G().sb('dq_v2_store', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ collection: 'elan', data: { key: k, cfg: remoteCfg, img: img, ts: Date.now() } })
      }, 9000);
      if (r.ok) { toast('Yadda saxlandı ✓ Qeydiyyat pəncərəsində də görünəcək'); return true; }
    } catch (e) {}
    toast(ok ? 'Yalnız bu cihazda saxlandı (server əlçatmaz)' : 'Yadda saxlamaq alınmadı');
    return false;
  }

  /* ---------- paylaşım ---------- */
  function shareText(ex, c) {
    return '📢 ' + (c.badge ? 'Qeydiyyat elanı' : 'Elan') + '\n' + c.title + '\n' +
      [c.sub, c.info, c.price, c.when].filter(Boolean).join('\n') + '\n\nQeydiyyat: ' + link(ex);
  }
  function blobOf(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/png'); }); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  async function share(ex, c, cv) {
    ex = ex || state.exam; c = c || state.cfg; cv = cv || state.cv;
    var text = shareText(ex, c), blob = await blobOf(cv);
    var file = null; try { file = new File([blob], 'qeydiyyat-' + keyOf(ex) + '.png', { type: 'image/png' }); } catch (e) {}
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: text }); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    /* ehtiyat: şəkil yüklənir, WhatsApp mətni (link daxil) açılır */
    download(blob, 'qeydiyyat-' + keyOf(ex) + '.png');
    toast('Şəkil yükləndi — WhatsApp-da mətnlə birlikdə əlavə edin');
    setTimeout(function () { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }, 700);
  }

  /* ---------- interfeys ---------- */
  function ensureCss() {
    if (document.getElementById('dqe-css')) return;
    var st = document.createElement('style'); st.id = 'dqe-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function mount() {
    if (root && root.isConnected) { root.innerHTML = ''; return; }
    ensureCss();
    root = document.createElement('div'); root.className = 'dqe'; document.body.appendChild(root);
  }
  function close() { if (root) { root.remove(); root = null; } }
  function top(title, back) {
    return '<div class="dqe-top"><span>' + esc(title) + '</span><button class="dqe-x" type="button" data-x>' + (back ? '‹ Geri' : 'Bağla') + '</button></div>';
  }

  async function openList() {
    mount();
    root.innerHTML = top('📣 Qeydiyyat elanı') + '<div class="dqe-w"><div class="dqe-card">Yüklənir…</div></div>';
    root.querySelector('[data-x]').onclick = close;
    var list = [];
    try { list = await G().getExams(); } catch (e) {}
    if (!root) return;
    list.sort(function (a, b) { return String(a.group).localeCompare(b.group) || (a.number - b.number); });
    var w = root.querySelector('.dqe-w');
    w.innerHTML = '<p class="dqe-m" style="margin:0 0 12px">İmtahanPro-da aktiv olan imtahanlar. Elan qapağını düzəldib paylaşın.</p>' +
      (list.length ? list.map(function (e, i) {
        return '<div class="dqe-card"><span class="dqe-tag">' + esc(e.group) + ' · Sınaq ' + esc(e.number) + '</span>' +
          '<div class="dqe-t">' + esc(e.title) + '</div><div class="dqe-m">' + esc(e.questions) + ' sual · ' + esc(e.duration) + ' dəq</div>' +
          '<button class="dqe-b gold full" type="button" data-i="' + i + '">📣 Qeydiyyat elanı paylaş</button></div>';
      }).join('') : '<div class="dqe-card">Hazırda aktiv imtahan yoxdur. İmtahanPro-da imtahanı aktiv edin.</div>');
    w.onclick = function (ev) { var b = ev.target.closest('[data-i]'); if (b) openEditor(list[+b.getAttribute('data-i')]); };
  }

  function field(id, label, val, area) {
    return '<label for="' + id + '">' + label + '</label>' +
      (area ? '<textarea id="' + id + '">' + esc(val) + '</textarea>' : '<input type="text" id="' + id + '" value="' + esc(val) + '">');
  }

  async function openEditor(ex) {
    mount();
    state.exam = ex; state.bgImg = null;
    root.innerHTML = top('Elan qapağı', true) + '<div class="dqe-w"><div class="dqe-card">Yüklənir…</div></div>';
    root.querySelector('[data-x]').onclick = openList;
    var c = await loadCfg(ex); if (!root) return;
    state.cfg = c;
    var w = root.querySelector('.dqe-w');
    w.innerHTML =
      '<canvas class="dqe-prev" id="cv"></canvas>' +
      '<div class="dqe-card"><h3>Mətn</h3>' +
      field('f-brand', 'Brend adı', c.brand) + field('f-badge', 'Üst etiket', c.badge) +
      field('f-title', 'Başlıq', c.title, 1) + field('f-sub', 'Alt başlıq', c.sub, 1) +
      field('f-info', 'Məlumat sətri', c.info) + field('f-price', 'Qiymət', c.price) +
      field('f-when', 'Tarix / vaxt (ixtiyari)', c.when) + field('f-cta', 'Düymə yazısı', c.cta) +
      '<label for="f-tsize">Başlıq ölçüsü</label><input type="range" id="f-tsize" min="40" max="110" value="' + c.tsize + '">' +
      '<label for="f-pos">Mətnin yeri</label><select id="f-pos"><option value="top">Yuxarı</option><option value="center">Orta</option><option value="bottom">Aşağı</option></select></div>' +
      '<div class="dqe-card"><h3>Rənglər</h3><div class="dqe-g dqe-g4">' +
      '<div><label>Fon 1</label><input type="color" id="f-bg1" value="' + c.bg1 + '"></div>' +
      '<div><label>Fon 2</label><input type="color" id="f-bg2" value="' + c.bg2 + '"></div>' +
      '<div><label>Vurğu</label><input type="color" id="f-accent" value="' + c.accent + '"></div>' +
      '<div><label>Mətn</label><input type="color" id="f-text" value="' + c.text + '"></div></div>' +
      '<label for="f-img">Fon şəkli</label><input type="file" id="f-img" accept="image/*">' +
      '<label for="f-ov">Şəkil üzərində qaralma</label><input type="range" id="f-ov" min="0" max="0.9" step="0.05" value="' + c.ov + '">' +
      '<button class="dqe-b gh full" type="button" id="b-noimg">Fon şəklini sil</button></div>' +
      '<div class="dqe-card"><h3>Paylaşım linki</h3><div class="dqe-link" id="lk">' + esc(link(ex)) + '</div>' +
      '<div class="dqe-row" style="margin-top:10px"><button class="dqe-b gh" type="button" id="b-copy">Linki kopyala</button><button class="dqe-b gh" type="button" id="b-dl">Şəkli yüklə</button></div>' +
      '<p class="dqe-m" style="margin-top:8px">Bu linkə toxunan şəxsdə qeydiyyat pəncərəsi birbaşa açılır və aşağıdakı qapaq orada görünür (Yadda saxla basılandan sonra).</p></div>' +
      '<button class="dqe-b gold full" type="button" id="b-share">📣 Paylaş</button>' +
      '<div class="dqe-row"><button class="dqe-b full" type="button" id="b-save">Yadda saxla</button><button class="dqe-b gh full" type="button" id="b-reset">Sıfırla</button></div>';

    state.cv = w.querySelector('#cv');
    var q = function (s) { return w.querySelector(s); };
    q('#f-pos').value = c.pos;
    var map = { 'f-brand': 'brand', 'f-badge': 'badge', 'f-title': 'title', 'f-sub': 'sub', 'f-info': 'info', 'f-price': 'price', 'f-when': 'when', 'f-cta': 'cta',
      'f-bg1': 'bg1', 'f-bg2': 'bg2', 'f-accent': 'accent', 'f-text': 'text', 'f-pos': 'pos' };
    Object.keys(map).forEach(function (id) {
      var ev = function () { state.cfg[map[id]] = q('#' + id).value; redraw(); };
      q('#' + id).addEventListener('input', ev); q('#' + id).addEventListener('change', ev);
    });
    q('#f-tsize').addEventListener('input', function () { state.cfg.tsize = +this.value; redraw(); });
    q('#f-ov').addEventListener('input', function () { state.cfg.ov = +this.value; redraw(); });

    function setBg(url) {
      if (!url) { state.bgImg = null; state.cfg.bg = ''; redraw(); return; }
      var im = new Image(); im.onload = function () { state.bgImg = im; redraw(); }; im.src = url;
    }
    q('#f-img').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 1080 / Math.max(im.width, im.height)), t = document.createElement('canvas');
          t.width = Math.round(im.width * k); t.height = Math.round(im.height * k);
          t.getContext('2d').drawImage(im, 0, 0, t.width, t.height);
          state.cfg.bg = t.toDataURL('image/jpeg', .78); setBg(state.cfg.bg);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    };
    q('#b-noimg').onclick = function () { q('#f-img').value = ''; setBg(''); };
    q('#b-copy').onclick = function () {
      try { navigator.clipboard.writeText(link(ex)).then(function () { toast('Link kopyalandı ✓'); }, function () { toast(link(ex)); }); } catch (e) { toast(link(ex)); }
    };
    q('#b-dl').onclick = async function () { download(await blobOf(state.cv), 'qeydiyyat-' + keyOf(ex) + '.png'); };
    q('#b-save').onclick = save;
    q('#b-share').onclick = async function () { var b = this; b.disabled = true; await save(); await share(); b.disabled = false; };
    q('#b-reset').onclick = function () {
      var all = ls(LSK, {}); delete all[keyOf(ex)]; lsSet(LSK, all); openEditor(ex);
    };
    if (c.bg) setBg(c.bg); else redraw();
    setTimeout(redraw, 600); /* şrift yüklənəndən sonra yenidən çək */
  }

  function open(ex) {
    if (!G()) { alert('İmtahan modulu yüklənməyib (dq-imtahan-giris.js)'); return; }
    if (ex && ex.group && ex.number) {
      var full = Object.assign({ questions: '', duration: '' }, ex);
      return openEditor(full);
    }
    openList();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root) close(); });
  /* İstifadəçi tərəfi: admin qapağı hazırlayıbsa o, yoxdursa standart qapaq şəkli ilə paylaşır */
  async function quickShare(ex) {
    try {
      var c = await loadCfg(ex), cv = document.createElement('canvas'), im = null;
      if (c.bg) im = await new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = c.bg; });
      draw(cv, c, im, ex);
      await share(ex, c, cv);
    } catch (e) { toast('Paylaşmaq alınmadı'); }
  }

  window.DQElan = { open: open, close: close, link: link, quickShare: quickShare };
})();
