/*!
 * DQ Platform — Sınaq qapaq şəkilləri (v1)
 * Admin paneldə «🖼️ Sınaq qapaqları» kartı: aktiv sınaqların siyahısı, hər biri üçün qapaq şəkli yüklə / kəs / sil.
 * Şəkil ana səhifədəki «Aktiv sınaqlar və mövzu testləri» karuselində sınağın solunda görünür.
 * Şəkil yoxdursa DQ üslubunda standart qapaq göstərilir.
 *
 * Qoşulma: dq-imtahan-giris.js-dən SONRA
 *   <script src="dq-sinaq-qapaq.js?v=1"></script>
 * Açmaq:  DQSinaqQapaq.open()   — siyahı,   DQSinaqQapaq.open({group:'BB', number:1})  — birbaşa redaktor
 */
(function () {
  'use strict';
  if (window.DQSinaqQapaq) return;

  var S = 900;                       /* çıxış şəklinin tərəfi (kvadrat) */
  var MAXB = 190000;                 /* şəkil üçün hədəf ölçü (bayt, base64 mətni) */
  var root = null, st = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function G() { return window.DQImtahanGiris; }
  function keyOf(e) { return String(e.group).toUpperCase() + '-' + (parseInt(e.number, 10) || 0); }
  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function toast(t) {
    ensureCss();
    var d = document.createElement('div'); d.className = 'dqc-toast'; d.textContent = t; (root || document.body).appendChild(d);
    setTimeout(function () { d.remove(); }, 2800);
  }

  var CSS =
    '.dqc{position:fixed;inset:0;z-index:2147483100;background:#f3f5fa;overflow:auto;-webkit-overflow-scrolling:touch;font-family:Mulish,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f1f45;font-size:14px;line-height:1.4;text-align:left}' +
    '.dqc *{box-sizing:border-box}.dqc button,.dqc input,.dqc select{font:inherit;color:inherit}' +
    '.dqc-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:#0c1f4d;border-bottom:2px solid #c9a24a;color:#f3d47a;font-weight:800;font-size:16px}' +
    '.dqc-x{border:1px solid #c9a24a;background:transparent;color:#f3d47a;border-radius:10px;padding:7px 14px;cursor:pointer}' +
    '.dqc-w{max-width:720px;margin:0 auto;padding:16px 14px 70px}' +
    '.dqc-m{font-size:12.5px;color:#5d6a88}' +
    '.dqc-card{background:#fff;border:1px solid #e3e8f2;border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 6px 20px -14px #0f1f4540;display:flex;gap:14px;align-items:center}' +
    '.dqc-th{flex:0 0 96px;height:96px;border-radius:14px;overflow:hidden;background:linear-gradient(155deg,#12306f,#0b1a40);position:relative;display:grid;place-items:center;color:#d9b25f;font-weight:800;font-size:30px;-webkit-text-stroke:0}' +
    '.dqc-th img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.dqc-bd{flex:1;min-width:0}.dqc-tag{display:inline-block;font-size:12px;font-weight:800;color:#8a6410;background:#fff7e0;border:1px solid #f0d58a;padding:3px 10px;border-radius:99px}' +
    '.dqc-t{font-size:15px;font-weight:800;margin:6px 0 2px}.dqc-st{font-size:12px;font-weight:700}.dqc-st.ok{color:#15803d}.dqc-st.no{color:#94a3b8}' +
    '.dqc-b{border:0;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;background:#1e1b4b;color:#fff;margin:8px 8px 0 0}' +
    '.dqc-b.gold{background:linear-gradient(180deg,#f3d47a,#d4a73c);color:#13203f}.dqc-b.gh{background:#fff;color:#1e1b4b;border:1px solid #d9deeb}.dqc-b.red{background:#fff;color:#b91c1c;border:1px solid #fecaca}.dqc-b:disabled{opacity:.5}' +
    '.dqc-b.full{width:100%;margin:12px 0 0}' +
    '.dqc-pv{display:block;width:100%;max-width:360px;aspect-ratio:1/1;margin:0 auto 12px;border-radius:16px;background:#0b1a40;box-shadow:0 14px 34px -14px #0008;touch-action:none;cursor:grab}' +
    '.dqc label{display:block;font-size:12px;font-weight:700;color:#5d6a88;margin:12px 0 5px}.dqc input[type=range]{width:100%}.dqc input[type=file]{width:100%}' +
    '.dqc-box{background:#fff;border:1px solid #e3e8f2;border-radius:18px;padding:16px;margin-bottom:12px}.dqc h3{margin:0 0 4px;font-size:15px;font-weight:800}' +
    '.dqc-row{display:flex;gap:10px;flex-wrap:wrap}.dqc-row>*{flex:1 1 140px}' +
    '.dqc-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:11px 18px;border-radius:99px;font-weight:700;z-index:9;max-width:90%}' +
    '@media(max-width:420px){.dqc-th{flex-basis:72px;height:72px}}';

  function ensureCss() {
    if (document.getElementById('dqc-css')) return;
    var e = document.createElement('style'); e.id = 'dqc-css'; e.textContent = CSS; document.head.appendChild(e);
  }
  function mount() {
    if (root && root.isConnected) { root.innerHTML = ''; return; }
    ensureCss(); root = document.createElement('div'); root.className = 'dqc'; document.body.appendChild(root);
  }
  function close() { if (root) { root.remove(); root = null; } }
  function top(title, back) {
    return '<div class="dqc-top"><span>' + esc(title) + '</span><button class="dqc-x" type="button" data-x>' + (back ? '‹ Geri' : 'Bağla') + '</button></div>';
  }

  /* ---------- yaddaş ---------- */
  async function loadCovers() { try { return await G().getCovers(); } catch (e) { return ls('dq_sq_cov', {}); } }
  async function writeCover(key, img) {
    var ts = String(Date.now());
    var r = await G().sb('dq_v2_store', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ collection: 'sinaqcover', data: { key: key, img: img, ts: ts } })
    }, 20000);
    if (!r.ok) throw new Error('save-failed');
    var c = ls('dq_sq_cov', {}); c[key] = { ts: ts, img: img };
    try { localStorage.setItem('dq_sq_cov', JSON.stringify(c)); } catch (e) {}
    try { G().refreshHome(); } catch (e) {}
  }

  /* ---------- siyahı ---------- */
  async function openList() {
    mount();
    root.innerHTML = top('🖼️ Sınaq qapaqları') + '<div class="dqc-w"><div class="dqc-box">Yüklənir…</div></div>';
    root.querySelector('[data-x]').onclick = close;
    var list = [], covers = {};
    try { list = await G().getExams(); } catch (e) {}
    covers = await loadCovers(); if (!root) return;
    list.sort(function (a, b) { return String(a.group).localeCompare(b.group) || (a.number - b.number); });
    var w = root.querySelector('.dqc-w');
    w.innerHTML = '<p class="dqc-m" style="margin:0 0 12px">Aktiv sınaqlar üçün qapaq şəkli əlavə edin. Şəkil ana səhifədəki «Aktiv sınaqlar və mövzu testləri» bölməsində sınağın solunda görünür. Şəkil yoxdursa standart DQ qapağı göstərilir.</p>' +
      (list.length ? list.map(function (e, i) {
        var c = covers[keyOf(e)], has = c && c.img;
        return '<div class="dqc-card"><div class="dqc-th">' + (has ? '<img src="' + esc(c.img) + '" alt="">' : esc(e.group)) + '</div>' +
          '<div class="dqc-bd"><span class="dqc-tag">' + esc(e.group) + ' · Sınaq ' + esc(e.number) + '</span><div class="dqc-t">' + esc(e.title) + '</div>' +
          '<div class="dqc-st ' + (has ? 'ok' : 'no') + '">' + (has ? '● Qapaq şəkli var' : '○ Standart qapaq') + '</div>' +
          '<button class="dqc-b gold" type="button" data-i="' + i + '">' + (has ? 'Dəyiş' : 'Şəkil əlavə et') + '</button>' +
          (has ? '<button class="dqc-b red" type="button" data-d="' + i + '">Sil</button>' : '') + '</div></div>';
      }).join('') : '<div class="dqc-box">Hazırda aktiv sınaq yoxdur. İmtahanPro-da sınağı aktiv edin.</div>');
    w.onclick = async function (ev) {
      var b = ev.target.closest('[data-i]'), d = ev.target.closest('[data-d]');
      if (b) return openEditor(list[+b.getAttribute('data-i')]);
      if (d) {
        var ex = list[+d.getAttribute('data-d')];
        if (!confirm(keyOf(ex) + ' üçün qapaq şəkli silinsin?')) return;
        d.disabled = true;
        try { await writeCover(keyOf(ex), ''); toast('Qapaq silindi ✓'); } catch (e) { toast('Silmək alınmadı (server əlçatmaz)'); }
        openList();
      }
    };
  }

  /* ---------- redaktor (kvadrat kəsmə) ---------- */
  function draw() {
    var cv = st.cv, x = cv.getContext('2d'), im = st.img, v = cv.width;
    x.fillStyle = '#0b1a40'; x.fillRect(0, 0, v, v);
    if (!im) {
      x.fillStyle = '#d9b25f'; x.font = '800 ' + Math.round(v / 5) + 'px Mulish,Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('Şəkil seçin', v / 2, v / 2); return;
    }
    var base = Math.max(v / im.width, v / im.height), k = base * st.zoom, w = im.width * k, h = im.height * k;
    var mx = Math.max(0, (w - v) / 2), my = Math.max(0, (h - v) / 2);
    x.drawImage(im, (v - w) / 2 + (st.ox / 100) * mx, (v - h) / 2 + (st.oy / 100) * my, w, h);
  }
  function render(size) {
    var o = document.createElement('canvas'); o.width = o.height = size;
    var keep = st.cv; st.cv = o; draw(); st.cv = keep; return o;
  }
  function encode() {
    var size = S, q = .84, out = '';
    for (var i = 0; i < 6; i++) {
      out = render(size).toDataURL('image/jpeg', q);
      if (out.length <= MAXB) break;
      if (q > .6) q -= .08; else size = Math.round(size * .85);
    }
    return out;
  }
  async function openEditor(ex) {
    mount();
    st = { ex: ex, img: null, zoom: 1, ox: 0, oy: 0 };
    root.innerHTML = top('Qapaq şəkli · ' + keyOf(ex), true) +
      '<div class="dqc-w"><canvas class="dqc-pv" id="cv" width="540" height="540"></canvas>' +
      '<p class="dqc-m" style="text-align:center;margin:0 0 6px">Şəkli sürüşdürərək yerini seçin. Kvadrat kəsim: həm telefonda, həm kompüterdə səliqəli görünür.</p>' +
      '<div class="dqc-box"><h3>' + esc(ex.title) + '</h3>' +
      '<label for="f-img">Şəkil</label><input type="file" id="f-img" accept="image/*">' +
      '<label for="f-z">Yaxınlaşdır</label><input type="range" id="f-z" min="1" max="3" step="0.02" value="1">' +
      '<div class="dqc-row"><div><label for="f-x">Üfüqi</label><input type="range" id="f-x" min="-100" max="100" value="0"></div>' +
      '<div><label for="f-y">Şaquli</label><input type="range" id="f-y" min="-100" max="100" value="0"></div></div></div>' +
      '<button class="dqc-b gold full" type="button" id="b-save">Yadda saxla</button>' +
      '<button class="dqc-b gh full" type="button" id="b-back">Ləğv et</button></div>';
    root.querySelector('[data-x]').onclick = openList;
    var q = function (s) { return root.querySelector(s); };
    st.cv = q('#cv');
    var cur = (await loadCovers())[keyOf(ex)];
    if (!root) return;
    function setImg(url) { var im = new Image(); im.onload = function () { st.img = im; draw(); }; im.src = url; }
    if (cur && cur.img) setImg(cur.img); else draw();
    q('#f-img').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { st.zoom = 1; st.ox = st.oy = 0; q('#f-z').value = 1; q('#f-x').value = 0; q('#f-y').value = 0; setImg(fr.result); };
      fr.readAsDataURL(f);
    };
    q('#f-z').oninput = function () { st.zoom = +this.value; draw(); };
    q('#f-x').oninput = function () { st.ox = +this.value; draw(); };
    q('#f-y').oninput = function () { st.oy = +this.value; draw(); };
    /* barmaqla / siçanla sürüşdürmə */
    var drag = null;
    st.cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy }; try { st.cv.setPointerCapture(e.pointerId); } catch (_e) {} });
    st.cv.addEventListener('pointermove', function (e) {
      if (!drag || !st.img) return;
      var r = st.cv.getBoundingClientRect(), k = 200 / r.width;
      st.ox = Math.max(-100, Math.min(100, drag.ox - (e.clientX - drag.x) * k));
      st.oy = Math.max(-100, Math.min(100, drag.oy - (e.clientY - drag.y) * k));
      q('#f-x').value = st.ox; q('#f-y').value = st.oy; draw();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { st.cv.addEventListener(n, function () { drag = null; }); });
    q('#b-back').onclick = openList;
    q('#b-save').onclick = async function () {
      if (!st.img) { toast('Əvvəlcə şəkil seçin'); return; }
      var b = this; b.disabled = true; b.textContent = 'Saxlanılır…';
      try { await writeCover(keyOf(ex), encode()); toast('Qapaq saxlandı ✓ Ana səhifədə görünəcək'); openList(); }
      catch (e) { b.disabled = false; b.textContent = 'Yadda saxla'; toast('Saxlamaq alınmadı. İnterneti yoxlayın'); }
    };
  }

  function open(ex) {
    if (!G() || !G().getCovers) { alert('İmtahan modulu yüklənməyib (dq-imtahan-giris.js)'); return; }
    if (ex && ex.group && ex.number) return openEditor(Object.assign({ title: '' }, ex));
    openList();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root) close(); });
  window.DQSinaqQapaq = { open: open, close: close };
})();
