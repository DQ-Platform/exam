/*!
 * DQ Platform — Admin panelə keçid yolları (v1)
 * Uzun basma (0,9 san):  «Giriş» / «Kabinet» düyməsi  və  «Yunis İmanov» yazısı (alt hissə, başlıq və s.)
 * Əlavə yollar:           ?admin=1  və ya  #admin  (link),  Ctrl+Shift+A (kompüter)
 * Admin artıq daxil olubsa → birbaşa admin panel. Olmayıbsa → saytın admin giriş funksiyası tapılıb çağırılır.
 * Heç nə tapılmasa ekranda tapılmış admin funksiyalarının adı göstərilir (diaqnostika).
 * Qoşulma: digər skriptlərdən sonra  <script src="dq-admin-kecid.js?v=1"></script>
 */
(function () {
  'use strict';
  if (window.__dqAdminKecid) return; window.__dqAdminKecid = 1;
  var HOLD = 900, MOVE = 12, timer = null, sx = 0, sy = 0, firedAt = 0, D = document;

  function norm(s) {
    return String(s || '').replace(/\u0130/g, 'i').replace(/\u0307/g, '').toLowerCase()
      .replace(/[\u0259]/g, 'e').replace(/[\u0131]/g, 'i').replace(/[\u015F]/g, 's').replace(/[\u00E7]/g, 'c')
      .replace(/[\u011F]/g, 'g').replace(/[\u00F6]/g, 'o').replace(/[\u00FC]/g, 'u').replace(/\s+/g, ' ').trim();
  }
  var NAMES = { 'giris': 1, 'kabinet': 1, 'kabinete giris': 1, 'kabinete daxil ol': 1, 'daxil ol': 1, 'login': 1 };

  function match(t) {
    if (!t || t.nodeType !== 1) t = t && t.parentElement;
    for (var i = 0, el = t; el && el !== D.body && i < 5; i++, el = el.parentElement) {
      if (el.hasAttribute && el.hasAttribute('data-dq-admin-hold')) return true;
      if (el.childElementCount > 8) continue; /* böyük konteynerlərin mətnini hər toxunuşda oxumuruq */
      var tx = norm(el.textContent);
      if (!tx || tx.length > 120) continue;
      if (/imanov/.test(tx) && tx.length < 90) return true;
      if (NAMES[tx] && /^(a|button)$/i.test(el.tagName || '') || NAMES[tx] && el.getAttribute && el.getAttribute('role') === 'button') return true;
    }
    return false;
  }

  /* ---------- admin giriş funksiyasını tap ---------- */
  var RX = /^(open|show|go|enter|start|goto)?_?(dq)?admin(login|panel|gate|auth|giris|ui)?$/i;
  var SKIP = /^(isAdmin|adminOpen|adminUI|switchAdminTab|dqGoAdmin|DQAdminGate)$/;

  function candidates() {
    var out = [], seen = {};
    function add(label, fn, ctx) { if (!seen[label]) { seen[label] = 1; out.push({ label: label, fn: fn, ctx: ctx }); } }
    ['DQAdmin', 'DQCeo', 'DQCEO', 'DQAdminLogin', 'DQAuth', 'DQ'].forEach(function (o) {
      var ob = window[o]; if (!ob || typeof ob !== 'object' && typeof ob !== 'function') return;
      ['open', 'login', 'show', 'admin', 'adminLogin', 'openAdmin', 'showAdmin', 'enter'].forEach(function (m) {
        if (typeof ob[m] === 'function') add(o + '.' + m, ob[m], ob);
      });
    });
    ['openAdminLogin', 'showAdminLogin', 'adminLogin', 'openAdmin', 'showAdmin', 'dqAdminLogin', 'dqAdminOpen', 'DQAdminLogin', 'goAdmin'].forEach(function (n) {
      if (typeof window[n] === 'function') add(n, window[n], window);
    });
    try {
      Object.keys(window).forEach(function (k) {
        var v; try { v = window[k]; } catch (e) { return; }
        if (SKIP.test(k)) return;
        if (typeof v === 'function' && RX.test(k)) add(k, v, window);
        else if (v && typeof v === 'object' && /admin|ceo/i.test(k) && !/Gate|Pro|Reg|Hub/.test(k)) {
          ['open', 'login', 'show', 'enter'].forEach(function (m) { if (typeof v[m] === 'function') add(k + '.' + m, v[m], v); });
        }
      });
    } catch (e) {}
    return out;
  }

  function toast(t) {
    var d = D.createElement('div');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:20px;z-index:2147483600;max-width:520px;margin:0 auto;background:#0c1f4d;color:#fff;border:1px solid #c9a24a;border-radius:14px;padding:12px 14px;font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 12px 30px #0007';
    d.textContent = t; D.body.appendChild(d); setTimeout(function () { d.remove(); }, 7000);
  }

  function admin() {
    try {
      if (window.DQAdminGate && DQAdminGate.is() && typeof window.dqGoAdmin === 'function') { window.dqGoAdmin(); return; }
    } catch (e) {}
    var c = candidates();
    for (var i = 0; i < c.length; i++) {
      try { c[i].fn.call(c[i].ctx); return; } catch (e) {}
    }
    var names = [];
    try { names = Object.keys(window).filter(function (k) { return /admin|ceo/i.test(k); }).slice(0, 14); } catch (e) {}
    toast('Admin giriş funksiyası tapılmadı. Saytda tapılan admin adları: ' + (names.join(', ') || 'yoxdur') + '. Bu mesajın şəklini göndərin.');
  }

  /* ---------- uzun basma ---------- */
  function cancel() { clearTimeout(timer); timer = null; }
  function down(e) {
    if (e.button > 0 || !match(e.target)) return;
    var p = (e.touches && e.touches[0]) || e;
    sx = p.clientX; sy = p.clientY; cancel();
    timer = setTimeout(function () {
      timer = null; firedAt = Date.now();
      try { navigator.vibrate && navigator.vibrate(30); } catch (er) {}
      admin();
    }, HOLD);
  }
  function move(e) {
    if (!timer) return;
    var p = (e.touches && e.touches[0]) || e;
    if (Math.abs(p.clientX - sx) > MOVE || Math.abs(p.clientY - sy) > MOVE) cancel();
  }
  var hasPtr = !!window.PointerEvent;
  if (hasPtr) {
    window.addEventListener('pointerdown', down, { capture: true, passive: true });
    window.addEventListener('pointermove', move, { capture: true, passive: true });
    ['pointerup', 'pointercancel'].forEach(function (n) { window.addEventListener(n, cancel, { capture: true, passive: true }); });
  } else {
    window.addEventListener('touchstart', down, { capture: true, passive: true });
    window.addEventListener('touchmove', move, { capture: true, passive: true });
    ['touchend', 'touchcancel'].forEach(function (n) { window.addEventListener(n, cancel, { capture: true, passive: true }); });
    window.addEventListener('mousedown', down, { capture: true, passive: true });
    window.addEventListener('mouseup', cancel, { capture: true, passive: true });
  }
  window.addEventListener('scroll', cancel, { capture: true, passive: true });
  /* uzun basmadan sonra təsadüfi klik / kontekst menyusu / mətn seçimi olmasın */
  window.addEventListener('click', function (e) {
    if (firedAt && Date.now() - firedAt < 1000 && match(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('contextmenu', function (e) { if (match(e.target)) e.preventDefault(); }, true);
  var st = D.createElement('style');
  st.textContent = '.footer-text,.v3-ft,.dq-ft-fallback{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}';
  (D.head || D.documentElement).appendChild(st);

  /* ---------- digər yollar ---------- */
  D.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) { e.preventDefault(); admin(); }
  });
  function byUrl() {
    if (/[?&]admin=1(&|$)/.test(location.search) || /^#admin$/i.test(location.hash)) setTimeout(admin, 1200);
  }
  if (D.readyState === 'complete') byUrl(); else window.addEventListener('load', byUrl);

  window.DQAdminKecid = { open: admin, candidates: function () { return candidates().map(function (c) { return c.label; }); } };
})();
