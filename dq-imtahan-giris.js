/*!
 * DQ Platform — İmtahan bölməsi
 * Sınaq siyahısı + qeydiyyat (iş nömrəsi avtomatik) + 3 addımlı giriş portalı
 *
 * index.html-in sonunda (digər skriptlərdən sonra) əlavə edin:
 *   <script src="dq-imtahan-giris.js?v=3"></script>
 *
 * İstəyə görə tənzimləmə (bu faylı yükləməzdən əvvəl):
 *   window.DQ_IG_CONFIG = {
 *     whatsapp: '994504305162',
 *     prices: { BB: 10, BA: 13, AC: 15 },
 *     requireApproval: true,      // ödəniş admin tərəfindən təsdiqlənməyibsə imtahana buraxma
 *     autoLaunch: true,           // giriş bitəndə sistemin kabinetində sınağı avtomatik aç
 *     getExams: async () => [...],// sınaq siyahısını öz mənbənizdən verin
 *     onStart: (exam, user) => {} // imtahanı başladan öz funksiyanız
 *   };
 *
 * Axın: Başla → 1) Ad Soyad → 2) İş nömrəsi (yoxdursa «Qeydiyyatdan keç») → 3) Qaydalar + razılıq.
 * Yeni qeydiyyat admin paneldə (İmtahanPro → Qeydiyyatlar) gözləməyə düşür; admin kateqoriya + sınaq nömrəsini seçib icazə verir.
 *
 * Qeyd: bu skript qeydiyyat panelinə (İmtahan Qeydiyyat Portalı) heç bir sessiya əlavə etmir —
 * orada yalnız admin panelindən əlavə etdiyiniz elanlar görünür.
 */
(function () {
  'use strict';
  if (window.DQImtahanGiris) return;

  var CFG = Object.assign({
    whatsapp: '994504305162',
    prices: { BB: 10, BA: 13, AC: 15 },
    duration: 180,
    questionCount: 100,
    requireApproval: true,
    autoLaunch: true,
    autoBind: true,
    groups: ['BB', 'BA', 'AC'],
    storageUsers: 'dq_ig_users',
    storageSession: 'dq_ig_session',
    storageExams: 'dq_ig_exams',
    legacyRegs: 'dq_exam_regs',
    supabase: {
      url: 'https://cpzwliqlgaplroscvduo.supabase.co',
      key: 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF'
    }
  }, window.DQ_IG_CONFIG || {});
  CFG.whatsapp = String(CFG.whatsapp).replace(/\D/g, '');

  /* ================= köməkçilər ================= */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ls(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function norm(s) {
    return String(s || '').replace(/\u0130/g, 'i').replace(/\u0307/g, '').replace(/\u0131/g, 'i')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function splitName(full) {
    var p = String(full || '').trim().split(/\s+/);
    return { ad: p[0] || '', soyad: p.slice(1).join(' ') };
  }
  function waLink(text) { return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text); }

  function examKey(e) { return String(e.group).toUpperCase() + '-' + (parseInt(e.number, 10) || 0); }
  /* admin icazə siyahısı (allowed) varsa — yalnız həmin sınaqlar; yoxdursa (köhnə təsdiqlər) — öz qrupunun sınaqları */
  function isAllowed(u, e) {
    if (!u) return false;
    if (Array.isArray(u.allowed)) return u.allowed.indexOf(examKey(e)) > -1;
    return !u.group || String(u.group).toUpperCase() === String(e.group).toUpperCase();
  }
  function nameKey(s) { return norm(s).split(' ').filter(Boolean).sort().join(' '); }

  /* 7 simvollu iş nömrəsi (məs. 57C8UF4); 0/O, 1/I kimi qarışan simvollar yoxdur */
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genCode() {
    var arr = new Uint32Array(7), code = '', i;
    try { (window.crypto || window.msCrypto).getRandomValues(arr); }
    catch (e) { for (i = 0; i < 7; i++) arr[i] = Math.floor(Math.random() * 4e9); }
    for (i = 0; i < 7; i++) code += ALPHA[arr[i] % ALPHA.length];
    return code;
  }

  /* ================= məlumat qatı ================= */
  function sbFetch(path, opts, ms) {
    var sb = CFG.supabase;
    if (!sb || !sb.url) return Promise.reject(new Error('no-db'));
    var ac = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { try { ac && ac.abort(); } catch (e) {} }, ms || 5000);
    opts = Object.assign({}, opts);
    opts.headers = Object.assign({ apikey: sb.key, Authorization: 'Bearer ' + sb.key, 'Content-Type': 'application/json' }, opts.headers || {});
    if (ac) opts.signal = ac.signal;
    return fetch(sb.url + '/rest/v1/' + path, opts).then(
      function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }

  /* undefined = baza əlçatmazdır, null = tapılmadı, obyekt = tapıldı */
  async function remoteFind(code) {
    try {
      var r = await sbFetch('dq_v2_store?select=id,data&collection=eq.regs&data->>fin=eq.' + encodeURIComponent(code) + '&order=id.desc&limit=5');
      if (!r.ok) return undefined;
      var a = await r.json();
      if (!a || !a.length) return null;
      var d = a[0].data || {}, n = splitName(d.name);
      var gm = /^dqg-([A-Z]+)/.exec(String(d.sid || ''));
      return { code: code, ad: n.ad, soyad: n.soyad, group: d.group || (gm ? gm[1] : ''),
        price: d.price, status: d.status || 'pending', rid: a[0].id,
        allowed: Array.isArray(d.allowed) ? d.allowed : undefined, want: d.want || '' };
    } catch (e) { return undefined; }
  }
  function pushReg(u) {
    try {
      return sbFetch('dq_v2_store', {
        method: 'POST', keepalive: true, headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ collection: 'regs', data: {
          name: u.ad + ' ' + u.soyad, phone: '', email: '', fin: u.code,
          sid: 'dqg-' + u.group, group: u.group, want: u.want || '', price: u.price, status: u.status,
          allowed: [], payment: u.payment || '', ts: Date.now(), source: 'imtahan-bolmesi' } })
      }, 8000).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  function legacyList() {
    var l = ls(CFG.legacyRegs, []); return Array.isArray(l) ? l : [];
  }

  var Data = {
    /* İmtahanPro (admin) siyahısı: yalnız AKTİV sınaqlar. Baza əlçatmazdırsa son yadda qalan siyahı. */
    async getExams() {
      if (typeof CFG.getExams === 'function') return await CFG.getExams();
      var rows = null;
      try {
        var r = await sbFetch('dq_v2_store?select=id,data&collection=eq.imtahanpro&order=id.desc&limit=1');
        if (r.ok) {
          var a = await r.json();
          rows = (a && a[0] && a[0].data && Array.isArray(a[0].data.list)) ? a[0].data.list : [];
          lsSet(CFG.storageExams, rows);
        }
      } catch (e) {}
      if (rows === null) { rows = ls(CFG.storageExams, []); if (!Array.isArray(rows)) rows = []; }
      return rows.filter(function (x) { return x && x.active !== false && x.group && x.number; }).map(function (x) {
        var g = String(x.group).toUpperCase(), n = parseInt(x.number, 10) || 0;
        return { id: x.id || (g + '-' + n), group: g, number: n,
          title: x.title || ('Dövlət Qulluğu ' + g + ' kateqoriyası üzrə sınaq ' + n),
          questions: x.questions || CFG.questionCount, duration: x.duration || CFG.duration };
      });
    },
    async findUser(code) {
      code = String(code || '').trim().toUpperCase();
      if (typeof CFG.findUser === 'function') return await CFG.findUser(code);
      var local = (ls(CFG.storageUsers, {}))[code] || null;
      if (!local) {
        var lg = legacyList().filter(function (r) { return r && String(r.code).toUpperCase() === code; })[0];
        if (lg) { var n = splitName(lg.name); local = { code: code, ad: n.ad, soyad: n.soyad, group: '', price: lg.price, status: lg.status || 'pending' }; }
      }
      var remote = await remoteFind(code);
      if (remote) return Object.assign({}, local || {}, remote, { group: remote.group || (local && local.group) || '' });
      if (remote === null && local && local.status === 'pending') pushReg(local); /* əvvəl göndərilə bilməyibsə təkrar cəhd */
      if (remote === undefined && local) local._offline = true;
      return local;
    },
    async uniqueCode() {
      var all = ls(CFG.storageUsers, {}), c, i;
      for (i = 0; i < 6; i++) {
        c = genCode();
        if (all[c]) continue;
        var r = await remoteFind(c);
        if (!r) return c;
      }
      return genCode();
    },
    hasRegistration: function () {
      return !!ls(CFG.storageSession, null) || Object.keys(ls(CFG.storageUsers, {})).length > 0 || legacyList().length > 0;
    }
  };

  /* ================= üslub =================
     Siyahı = sistemin tünd göy / qızılı kabinet dizaynı,
     pəncərələr = sistemin ağ «İmtahana Giriş Portalı» dizaynı (addımlar aşağıda) */
  var CSS = '\
.dqg-page{position:fixed;inset:0;z-index:2147483000;overflow:auto;background:linear-gradient(180deg,#0b1a40,#06112c);color:#e9eefb;font-family:inherit;-webkit-overflow-scrolling:touch;text-align:left}\
.dqg-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0c1f4d;border-bottom:2px solid #c9a24a}\
.dqg-logo{display:flex;align-items:center;gap:10px}.dqg-lg{width:36px;height:36px;border:1.5px solid #c9a24a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#f3d47a;font:700 13px Georgia,serif}\
.dqg-brand b{display:block;color:#f3d47a;font-size:16px;line-height:1.1}.dqg-brand small{color:#9fb0d6;font-size:10px;letter-spacing:.12em}\
.dqg-x{border:1px solid #c9a24a;color:#f3d47a;background:transparent;border-radius:10px;padding:7px 14px;font-size:13px;cursor:pointer;font-family:inherit}\
.dqg-wrap{max-width:820px;margin:0 auto;padding:16px 14px 40px}\
.dqg-user{display:flex;align-items:center;gap:12px;margin:6px 0 14px}.dqg-av{width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#f3d47a,#d4a73c);color:#13203f;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;flex:none}\
.dqg-user b{display:block;color:#fff;font-size:16px}.dqg-user small{color:#9fb0d6;letter-spacing:.1em;font-size:11px}\
.dqg-h{color:#e0b648;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:6px 0 12px}\
.dqg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}\
@media(max-width:320px){.dqg-grid{grid-template-columns:1fr}}\
.dqg-card{background:linear-gradient(160deg,#12295f,#0e2250);border:1px solid #243d7a;border-radius:16px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.28)}\
.dqg-card-b{padding:12px 12px 10px}.dqg-card h4{margin:0 0 4px;font-size:13px;line-height:1.3;color:#fff;text-align:left}\
.dqg-st{font-size:11px;color:#8fa3cf;margin-bottom:8px}.dqg-meta{font-size:11px;color:#c3cfe8;line-height:1.7}.dqg-meta b{color:#fff}\
.dqg-card-f{padding:10px 12px 12px;border-top:1px solid #1d3570}\
.dqg-gold{display:block;width:100%;border:0;border-radius:10px;padding:10px;font-weight:700;font-size:13px;color:#13203f;cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#f3d47a,#d4a73c);box-shadow:0 4px 12px rgba(212,167,60,.25)}\
.dqg-ov{position:fixed;inset:0;z-index:2147483500;background:rgba(15,18,35,.62);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}\
.dqg-modal{position:relative;width:100%;max-width:460px;max-height:94vh;overflow:auto;background:#fff;color:#1e1b4b;border-radius:26px;padding:26px 22px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:inherit;box-sizing:border-box;text-align:left}\
.dqg-modal:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#1e1b4b,#c9a24a)}\
.dqg-modal *{box-sizing:border-box}\
.dqg-modal h3{margin:0 0 12px;text-align:center;font-size:24px;font-weight:400;color:#1e1b4b}\
.dqg-chip{display:table;margin:0 auto 14px;font-size:13px;padding:7px 14px;border:1px solid #ece9e1;border-radius:12px;color:#6b7280;background:#fff}.dqg-chip b{color:#1e1b4b}\
.dqg-p{font-size:14px;color:#6b7280;line-height:1.55;margin:0 0 12px}\
.dqg-lbl{display:block;font-size:13px;color:#1e1b4b;margin:12px 0 6px}\
.dqg-in{width:100%;padding:14px 16px;border-radius:16px;border:1px solid #e5e2da;background:#fff;color:#1e1b4b;font-size:16px;outline:none;font-family:inherit}\
.dqg-in:focus{border-color:#1e1b4b;box-shadow:0 0 0 3px rgba(30,27,75,.1)}.dqg-code{text-align:center;letter-spacing:.35em;font-weight:800;text-transform:uppercase}\
.dqg-box{border:1px solid #ece9e1;background:#fff;border-radius:16px;padding:14px 16px;margin:10px 0;font-size:14px;line-height:1.6;color:#4b5563}.dqg-box b{color:#1e1b4b}\
.dqg-box ul{margin:8px 0 0;padding-left:20px}.dqg-box li{margin-bottom:9px}\
.dqg-big{font-size:26px;font-weight:800;letter-spacing:.3em;color:#1e1b4b;text-align:center;margin:8px 0 4px}\
.dqg-copy{display:block;margin:0 auto 6px;border:1px solid #e5e2da;background:#fff;color:#1e1b4b;border-radius:999px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit}\
.dqg-pay{display:flex;gap:8px;margin-top:10px}.dqg-pay span{flex:1;text-align:center;padding:10px 4px;border-radius:12px;background:#f7f6f2;border:1px solid #ece9e1;font-size:13px;color:#6b7280}\
.dqg-pay span.on{border-color:#1e1b4b;background:#1e1b4b;color:#fff;font-weight:700}\
.dqg-err{color:#d92d20;font-size:13px;margin:8px 0 0;min-height:16px;line-height:1.5}.dqg-err a{color:#1e1b4b;font-weight:700}\
.dqg-row{display:flex;gap:12px;margin-top:16px}.dqg-row>*{flex:1}\
.dqg-ghost,.dqg-navy{border-radius:999px;padding:15px 12px;font-size:15px;cursor:pointer;font-family:inherit}\
.dqg-ghost{border:1px solid #e5e2da;background:#fff;color:#1e1b4b}\
.dqg-navy{border:0;background:#1e1b4b;color:#fff;box-shadow:0 8px 18px rgba(30,27,75,.28)}.dqg-navy[disabled]{background:#e1d3bd;box-shadow:none;cursor:not-allowed;color:#fff}\
.dqg-chk{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:#4b5563;margin:14px 0 0;cursor:pointer;line-height:1.5}\
.dqg-chk input{width:22px;height:22px;margin-top:1px;accent-color:#1e1b4b;flex:none}.dqg-chk b{color:#1e1b4b}\
.dqg-steps{display:flex;align-items:center;margin:22px 0 2px}\
.dqg-dot{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:#ebe9e2;color:#6b7280;flex:none}\
.dqg-dot.act{background:#1e1b4b;color:#fff;box-shadow:0 0 0 4px rgba(30,27,75,.12)}.dqg-dot.done{background:#4caf8a;color:#fff}\
.dqg-line{flex:1;height:4px;background:#ebe9e2;margin:0 6px;border-radius:2px}.dqg-line.done{background:#4caf8a}\
.dqg-empty{text-align:center;padding:4px 0}.dqg-empty .ic{font-size:36px}\
.dqg-modal{font-family:Mulish,system-ui,-apple-system,Segoe UI,sans-serif}\
.dqg-or{display:flex;align-items:center;gap:10px;margin:16px 0 10px;font-size:13px;color:#6b7280}.dqg-or:before,.dqg-or:after{content:\"\";flex:1;height:1px;background:#ece9e1}\
.dqg-reg{display:block;width:100%;border:1.5px dashed #c9a24a;background:#fffaf0;color:#1e1b4b;border-radius:999px;padding:13px 12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}\
.dqg-stat{display:inline-block;margin-top:3px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;letter-spacing:.02em}.dqg-stat.w{background:rgba(224,182,72,.18);color:#f3d47a}.dqg-stat.ok{background:rgba(76,175,138,.2);color:#7fe0b4}\
';
  function injectFont() {
    if (document.getElementById('dqg-font') || /fonts\\.googleapis\\.com[^"']*Mulish/i.test(document.documentElement.innerHTML.slice(0, 20000))) return;
    var l = document.createElement('link'); l.id = 'dqg-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  function injectCss() {
    if ($('dqg-css')) return;
    injectFont();
    var s = document.createElement('style'); s.id = 'dqg-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ================= sınaq siyahısı ================= */
  var page = null, prevOverflow = '';
  function userHead(u) {
    if (!u) return '';
    var ok = u.status === 'approved';
    return '<div class="dqg-av">' + esc((u.ad || '?').charAt(0).toUpperCase()) + '</div><div><b>' + esc(u.ad + ' ' + u.soyad) + '</b><small>İŞ NÖMRƏSİ: ' + esc(u.code) + '</small>' +
      '<br><span class="dqg-stat ' + (ok ? 'ok' : 'w') + '">' + (ok ? 'Təsdiqlənib' : 'Admin təsdiqi gözlənilir') + '</span></div>';
  }
  async function openList() {
    injectCss(); closeList();
    var exams = [], shown = [];
    var u = ls(CFG.storageSession, null);
    page = document.createElement('div'); page.className = 'dqg-page';
    page.innerHTML =
      '<div class="dqg-top"><div class="dqg-logo"><div class="dqg-lg">DQ</div><div class="dqg-brand"><b>DQ Platform</b><small>DÖVLƏT QULLUĞU SINAQ İMTAHANI</small></div></div>' +
      '<button class="dqg-x" data-x>Çıxış</button></div>' +
      '<div class="dqg-wrap"><div class="dqg-user" id="dqgUser" style="' + (u ? '' : 'display:none') + '">' + userHead(u) + '</div>' +
      '<div class="dqg-h" id="dqgH">Sınaqlar</div><div class="dqg-grid" id="dqgGrid"><div class="dqg-empty" style="grid-column:1/-1;color:#9fb0d6;padding:30px 0">Yüklənir…</div></div></div>';
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(page);
    page.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-x]')) return closeList();
      var b = ev.target.closest('[data-i]');
      if (b) onStartTap(shown[+b.getAttribute('data-i')]);
    });
    var mine = page;
    var pExams = Data.getExams().catch(function () { return []; });
    var pUser = u ? Data.findUser(u.code).catch(function () { return null; }) : Promise.resolve(null);
    exams = await pExams;
    var fresh = await pUser;
    if (page !== mine) return; /* gözləyərkən bağlanıb */
    if (fresh && fresh.code) { u = Object.assign({}, u, fresh); lsSet(CFG.storageSession, u); }
    exams.sort(function (a, b) {
      var ga = CFG.groups.indexOf(a.group), gb = CFG.groups.indexOf(b.group);
      return ((ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb)) || (a.group > b.group ? 1 : a.group < b.group ? -1 : 0) || ((a.number || 0) - (b.number || 0));
    });
    /* təsdiqlənmiş və admin icazə vermiş istifadəçi yalnız öz sınaqlarını görür */
    var personal = !!(u && u.status === 'approved' && Array.isArray(u.allowed));
    shown = personal ? exams.filter(function (e) { return isAllowed(u, e); }) : exams;
    if (u) { var uh = page.querySelector('#dqgUser'); uh.style.display = ''; uh.innerHTML = userHead(u); }
    page.querySelector('#dqgH').textContent = personal ? 'Sizə icazə verilmiş sınaqlar' : 'Sınaqlar';
    var grid = page.querySelector('#dqgGrid');
    grid.innerHTML = !shown.length
      ? '<div class="dqg-empty" style="grid-column:1/-1;color:#9fb0d6;padding:30px 0"><div class="ic">🗂</div>' + (personal ? 'Hələ sizə sınaq üçün icazə verilməyib.' : 'Hazırda aktiv sınaq yoxdur.') + '</div>'
      : shown.map(function (e, i) {
        return '<div class="dqg-card"><div class="dqg-card-b"><h4>' + esc(e.title) + '</h4>' +
          '<div class="dqg-st">Başlanmayıb</div><div class="dqg-meta">Sual sayı: <b>' + esc(e.questions) + '</b><br>Müddət: <b>' + esc(e.duration) + ' Dəqiqə</b></div></div>' +
          '<div class="dqg-card-f"><button class="dqg-gold" data-i="' + i + '">Başla</button></div></div>';
      }).join('');
  }
  function closeList() {
    if (page) { page.remove(); page = null; document.body.style.overflow = prevOverflow; }
  }

  /* ================= «Başla» toxunuşu ================= */
  function onStartTap(exam) {
    if (!Data.hasRegistration()) return showNotRegistered(exam);
    openWizard(exam);
  }

  function modal(html) {
    injectCss();
    var ov = document.createElement('div'); ov.className = 'dqg-ov';
    ov.innerHTML = '<div class="dqg-modal">' + html + '</div>';
    document.body.appendChild(ov);
    return { ov: ov, box: ov.firstChild, close: function () { ov.remove(); } };
  }
  /* addımlar pəncərənin ALT hissəsində */
  function stepper(n) {
    var h = '<div class="dqg-steps">';
    for (var i = 1; i <= 3; i++) {
      var c = i < n ? 'done' : i === n ? 'act' : '';
      h += '<div class="dqg-dot ' + c + '">' + (i < n ? '✓' : i) + '</div>';
      if (i < 3) h += '<div class="dqg-line ' + (i < n ? 'done' : '') + '"></div>';
    }
    return h + '</div>';
  }
  function chip(exam) {
    return '<div class="dqg-chip">Qrup: <b>' + esc(exam.group) + '</b> &nbsp;|&nbsp; Sınaq: <b>' + esc(exam.number || exam.title) + '</b></div>';
  }

  /* ---------- qeydiyyatsız istifadəçi ---------- */
  function showNotRegistered(exam) {
    var m = modal('<div class="dqg-empty"><div class="ic">📝</div><h3>Qeydiyyatdan keçin</h3>' +
      '<p class="dqg-p">Sınağa başlamaq üçün əvvəlcə qeydiyyatdan keçməlisiniz.</p></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-have>İş nömrəm var</button><button class="dqg-navy" data-reg>Qeydiyyatdan keç</button></div>');
    m.box.querySelector('[data-reg]').onclick = function () { m.close(); openRegister(exam); };
    m.box.querySelector('[data-have]').onclick = function () { m.close(); openWizard(exam); };
    m.ov.addEventListener('click', function (e) { if (e.target === m.ov) m.close(); });
  }

  /* ---------- qeydiyyat: ad + soyad → iş nömrəsi avtomatik ---------- */
  function openRegister(exam, pre) {
    pre = pre || ls(CFG.storageSession, null) || {};
    var group = (exam && exam.group) || CFG.groups[0];
    var m = modal('<h3>Qeydiyyat</h3>' + (exam ? chip(exam) : '') +
      '<p class="dqg-p">Ad və soyadınızı yazın. İş nömrəniz avtomatik yaradılacaq.</p>' +
      '<label class="dqg-lbl">Adınız</label><input class="dqg-in" id="dqgAd" autocomplete="given-name" value="' + esc(pre.ad || '') + '">' +
      '<label class="dqg-lbl">Soyadınız</label><input class="dqg-in" id="dqgSoy" autocomplete="family-name" value="' + esc(pre.soyad || '') + '">' +
      '<label class="dqg-lbl">Kateqoriya</label><div class="dqg-pay" id="dqgG">' +
      CFG.groups.map(function (g) { return '<span data-g="' + g + '" class="' + (g === group ? 'on' : '') + '">' + g + ' — ' + CFG.prices[g] + '₼</span>'; }).join('') + '</div>' +
      '<div class="dqg-err" id="dqgErr"></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-navy" data-n>Davam et</button></div>');
    var q = function (s) { return m.box.querySelector(s); };
    q('#dqgG').onclick = function (e) {
      var s = e.target.closest('[data-g]'); if (!s) return;
      group = s.getAttribute('data-g');
      [].forEach.call(q('#dqgG').children, function (x) { x.classList.toggle('on', x === s); });
    };
    q('[data-c]').onclick = m.close;
    q('[data-n]').onclick = async function () {
      var btn = this, ad = q('#dqgAd').value.trim(), soy = q('#dqgSoy').value.trim();
      if (ad.length < 2 || soy.length < 2) { q('#dqgErr').textContent = 'Ad və soyadı düzgün daxil edin.'; return; }
      btn.disabled = true; q('#dqgErr').textContent = '';
      var code = await Data.uniqueCode();
      var user = { code: code, ad: ad, soyad: soy, group: group, price: CFG.prices[group],
        want: (exam && exam.group === group && exam.number) ? examKey(exam) : '', allowed: [],
        status: CFG.prices[group] > 0 ? 'pending' : 'approved', createdAt: new Date().toISOString() };
      m.close(); showPayment(user, exam);
    };
  }

  /* ---------- iş nömrəsi + ödəniş məlumatı + WhatsApp ---------- */
  function showPayment(user, exam) {
    var prices = CFG.groups.map(function (g) { return g + ' ' + CFG.prices[g] + '₼'; });
    var m = modal('<h3>Qeydiyyat tamamlandı</h3>' +
      '<div class="dqg-box"><b>' + esc(user.ad + ' ' + user.soyad) + '</b><br>İş nömrəniz:<div class="dqg-big">' + esc(user.code) + '</div>' +
      '<button class="dqg-copy" data-copy>Nömrəni kopyala</button>' +
      '<span style="font-size:13px">Bu nömrəni saxlayın — imtahana bununla daxil olacaqsınız.</span></div>' +
      '<div class="dqg-box"><b>Ödəniş</b><div class="dqg-pay">' +
      CFG.groups.map(function (g) { return '<span class="' + (g === user.group ? 'on' : '') + '">' + g + ' ' + CFG.prices[g] + '₼</span>'; }).join('') + '</div>' +
      '<p class="dqg-p" style="margin:10px 0 0">Ödəniş ' + prices.join(', ') + ' təşkil edir. Seçdiyiniz qrup: <b>' + esc(user.group) + ' — ' + user.price + '₼</b>. ' +
      '«Razıyam» düyməsinə toxunduqda ödəniş qeyd olunur və WhatsApp-da hazır mesaj açılır. Admin ödənişi təsdiqləyib sizə sınaq icazəsi verəcək.</p></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-navy" data-ok>Razıyam</button></div>');
    m.box.querySelector('[data-c]').onclick = m.close;
    m.box.querySelector('[data-copy]').onclick = function () {
      var b = this;
      try { navigator.clipboard.writeText(user.code); b.textContent = 'Kopyalandı ✓'; } catch (e) { b.textContent = user.code; }
    };
    m.box.querySelector('[data-ok]').onclick = function () {
      this.disabled = true;
      user.payment = 'qeyd olundu';
      /* yerli yaddaş sinxron yazılır — WhatsApp pəncərəsi bloklanmasın deyə */
      var all = ls(CFG.storageUsers, {}); all[user.code] = user; lsSet(CFG.storageUsers, all);
      lsSet(CFG.storageSession, user);
      pushReg(user);
      if (typeof CFG.saveUser === 'function') { try { CFG.saveUser(user); } catch (e) {} }
      var text = 'Salam! DQ Platform sınaq imtahanı üçün qeydiyyatdan keçdim.\n' +
        'Ad Soyad: ' + user.ad + ' ' + user.soyad + '\n' +
        'İş nömrəsi: ' + user.code + '\n' +
        'Kateqoriya: ' + user.group + (user.want ? ' (Sınaq ' + user.want.split('-')[1] + ')' : '') + '\n' +
        'Ödəniş: ' + user.price + '₼\n' +
        'Ödənişi qeyd etdim. Sınaq icazəsi və təsdiq üçün yazıram.';
      var url = waLink(text);
      var w = null; try { w = window.open(url, '_blank'); } catch (e) {}
      if (!w) location.href = url;
      m.close();
      if (page) openList();
    };
  }

  /* ================= 3 addımlı giriş portalı =================
     1) Ad Soyad   2) İş nömrəsi (yoxdursa qeydiyyat)   3) Qaydalar + razılıq */
  function openWizard(exam) {
    var sess = ls(CFG.storageSession, null) || {};
    var user = null, step = 1, who = { ad: sess.ad || '', soyad: sess.soyad || '' };
    var m = modal('<div id="dqgBody"></div>');
    var body = m.box.querySelector('#dqgBody');
    m.ov.addEventListener('click', function (e) { if (e.target === m.ov) m.close(); });
    function head() { return '<h3>İmtahana Giriş Portalı</h3>' + chip(exam); }
    function waPending(u) {
      return waLink('Salam! İş nömrəm: ' + u.code + '. Ödənişi etmişəm, sınaq icazəsi üçün yazıram.');
    }

    function render() {
      if (step === 1) {
        body.innerHTML = head() +
          '<p class="dqg-p">Zəhmət olmasa, imtahanda iştirak edəcək şəxsin ad və soyadını daxil edin.</p>' +
          '<label class="dqg-lbl">Adınız</label><input class="dqg-in" id="dqgAd" autocomplete="given-name" value="' + esc(who.ad) + '">' +
          '<label class="dqg-lbl">Soyadınız</label><input class="dqg-in" id="dqgSoy" autocomplete="family-name" value="' + esc(who.soyad) + '">' +
          '<div class="dqg-err" id="dqgErr"></div>' +
          '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-navy" data-n>Davam et</button></div>' + stepper(1);
        var ad = body.querySelector('#dqgAd'), soy = body.querySelector('#dqgSoy'), err = body.querySelector('#dqgErr'), go = body.querySelector('[data-n]');
        body.querySelector('[data-c]').onclick = m.close;
        soy.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
        go.onclick = function () {
          if (ad.value.trim().length < 2 || soy.value.trim().length < 2) { err.textContent = 'Ad və soyadı düzgün daxil edin.'; return; }
          who = { ad: ad.value.trim(), soyad: soy.value.trim() }; step = 2; render();
        };
        setTimeout(function () { try { (who.ad ? soy : ad).focus(); } catch (e) {} }, 80);
      } else if (step === 2) {
        body.innerHTML = head() +
          '<p class="dqg-p">Qeydiyyatdan keçmisinizsə, 7 simvollu şəxsi iş nömrənizi daxil edin.</p>' +
          '<label class="dqg-lbl">Şəxsi iş nömrəsi</label>' +
          '<input class="dqg-in dqg-code" id="dqgCode" maxlength="7" placeholder="7 simvollu kod" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(sess.code || '') + '">' +
          '<div class="dqg-err" id="dqgErr"></div>' +
          '<div class="dqg-row" style="margin-top:8px"><button class="dqg-ghost" data-b>Geri</button><button class="dqg-navy" data-n>Davam et</button></div>' +
          '<div class="dqg-or">İş nömrəniz yoxdur?</div><button class="dqg-reg" data-reg>Qeydiyyatdan keç</button>' + stepper(2);
        var inp = body.querySelector('#dqgCode'), err2 = body.querySelector('#dqgErr'), go2 = body.querySelector('[data-n]');
        inp.oninput = function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
        inp.onkeydown = function (e) { if (e.key === 'Enter') go2.click(); };
        body.querySelector('[data-b]').onclick = function () { step = 1; render(); };
        body.querySelector('[data-reg]').onclick = function () { m.close(); openRegister(exam, who); };
        go2.onclick = async function () {
          err2.textContent = '';
          var code = inp.value.trim().toUpperCase();
          if (code.length !== 7) { err2.textContent = 'İş nömrəsi 7 simvol olmalıdır.'; return; }
          go2.disabled = true; go2.textContent = 'Yoxlanılır…';
          var u = null;
          try { u = await Data.findUser(code); } catch (e) {}
          go2.disabled = false; go2.textContent = 'Davam et';
          if (!u) {
            err2.innerHTML = 'Bu iş nömrəsi tapılmadı. <a href="#" data-r2>Qeydiyyatdan keç</a>';
            err2.querySelector('[data-r2]').onclick = function (e) { e.preventDefault(); m.close(); openRegister(exam, who); };
            return;
          }
          if (nameKey(u.ad + ' ' + u.soyad) !== nameKey(who.ad + ' ' + who.soyad)) {
            err2.innerHTML = 'Bu iş nömrəsi başqa ad-soyada aiddir. <a href="#" data-bk>Ad və soyadı düzəlt</a>';
            err2.querySelector('[data-bk]').onclick = function (e) { e.preventDefault(); step = 1; render(); };
            return;
          }
          if (u._offline && u.status !== 'approved') { err2.textContent = 'Serverlə əlaqə qurula bilmədi. İnterneti yoxlayıb yenidən cəhd edin.'; return; }
          if (CFG.requireApproval && u.status && u.status !== 'approved') {
            err2.innerHTML = 'Qeydiyyatınız hələ təsdiqlənməyib. Admin ödənişi təsdiqləyib icazə verənədək gözləyin və ya <a href="' + waPending(u) + '" target="_blank" rel="noopener">adminə yazın</a>.';
            return;
          }
          if (CFG.requireApproval && !isAllowed(u, exam)) {
            err2.innerHTML = 'Bu sınaq (' + esc(exam.group) + ' · Sınaq ' + esc(exam.number) + ') üçün sizə hələ icazə verilməyib. <a href="' + waPending(u) + '" target="_blank" rel="noopener">Adminə yazın</a>.';
            return;
          }
          user = u; lsSet(CFG.storageSession, u); step = 3; render();
        };
        setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
      } else {
        body.innerHTML = head() +
          '<div class="dqg-box"><b>İmtahan Qaydaları:</b><ul>' +
          '<li>Sınaq suallarını hər hansı qrupda paylaşmaq, 3-cü şəxslərə göndərmək <b>qadağandır</b>.</li>' +
          '<li>Bu sınaqda <b>xarici mənbələrdən</b> (müəllim köməyi, tələbədən-tələbəyə, kitab, internet resurslarından) istifadə <b>qadağandır</b>.</li>' +
          '<li>Sınaq müddəti: <b>' + esc(exam.duration || CFG.duration) + ' dəqiqə</b>. İmtahan səhifəsindən çıxış etsəniz belə, geri sayım taymeri davam edir. Hər hansı bir imtahan şərti pozulduqda imtahan dayandırılacaqdır.</li></ul></div>' +
          '<label class="dqg-chk"><input type="checkbox" id="dqgAgree"><span>Bütün qaydaları oxudum və <b>qaydalarla razıyam</b>.</span></label>' +
          '<div class="dqg-row"><button class="dqg-ghost" data-b>Geri</button><button class="dqg-navy" data-go disabled>▷ İmtahana Başla</button></div>' + stepper(3);
        var cb = body.querySelector('#dqgAgree'), gob = body.querySelector('[data-go]');
        cb.onchange = function () { gob.disabled = !cb.checked; };
        body.querySelector('[data-b]').onclick = function () { step = 2; render(); };
        gob.onclick = function () { m.close(); closeList(); startExam(exam, user); };
      }
    }
    render();
  }

  /* ================= imtahanı başlat ================= */
  function fire(el) {
    ['input', 'change'].forEach(function (n) { try { el.dispatchEvent(new Event(n, { bubbles: true })); } catch (e) {} });
  }
  /* sistemin kabinetindəki uyğun sınağın «Başla» düyməsini tapıb açır */
  function launchFromCabinet(exam) {
    var re = new RegExp('(^|\\s)' + String(exam.group).toLowerCase() + '\\s.*sinaq\\s*' + exam.number + '(?!\\d)');
    var tt = norm(exam.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var reT = tt ? new RegExp(tt + '(?!\\d)') : null;
    var tries = 0, timer = setInterval(function () {
      tries++;
      var list = $('registered-exams-list');
      if (list) {
        var cards = list.children, i, j, btns;
        for (i = 0; i < cards.length; i++) {
          var ct = norm(cards[i].textContent);
          if (!(re.test(ct) || (reT && reT.test(ct)))) continue;
          btns = cards[i].querySelectorAll('button,a,[role="button"]');
          for (j = 0; j < btns.length; j++) {
            if (/basla/.test(norm(btns[j].textContent))) { clearInterval(timer); btns[j].click(); return; }
          }
        }
      }
      if (tries > 30) clearInterval(timer);
    }, 300);
  }
  function startExam(exam, user) {
    var detail = { exam: exam, user: user, group: exam.group, number: exam.number };
    try { window.dispatchEvent(new CustomEvent('dq:start-exam', { detail: detail })); } catch (e) {}
    if (typeof CFG.onStart === 'function') return CFG.onStart(exam, user);

    var n = $('user-name'), f = $('user-fin');
    if (n && f && typeof window.proceedToExamSelect === 'function') {
      n.value = (user.ad + ' ' + user.soyad).trim().slice(0, 80);
      f.value = String(user.code).toUpperCase();
      fire(n); fire(f);
      setTimeout(function () {
        try { window.proceedToExamSelect(); } catch (e) {}
        if (CFG.autoLaunch && exam.number) launchFromCabinet(exam);
      }, 60);
      return;
    }
    /* ehtiyat: köhnə giriş linki */
    location.href = location.pathname + '?giris=1&qrup=' + encodeURIComponent(exam.group) + '&sinaq=' + encodeURIComponent(exam.number || '');
  }

  /* ================= «İmtahan» menyusuna qoşulma ================= */
  var NAVSEL = '[data-dqnav],.v3-hd,.v3-top,.v3-nav,header,nav,[class*=header],[class*=navbar],[class*=topbar],[class*=menu],[class*=dock],[class*=tabbar],[role="tablist"]';
  var SKIP = '.dqg-page,.dqg-ov,#dqx-ov,#dqa-ov,#rga,#admin-panel,#login-screen,#exam-screen,#dq-cab';
  function isNavTab(target) {
    if (!target || !target.closest || target.closest(SKIP)) return false;
    for (var i = 0, el = target; el && el !== document.body && i < 5; i++, el = el.parentElement) {
      var key = norm((el.getAttribute && (el.getAttribute('data-tab') || el.getAttribute('data-page'))) || '');
      var hit = key === 'imtahan' || key === 'exam' || norm(el.textContent) === 'imtahan';
      if (hit && (el.hasAttribute('data-dqnav') || el.closest(NAVSEL) || el.closest('#dqr'))) return true;
    }
    return false;
  }
  function autoBind() {
    /* window-capture: səhifədəki digər «İmtahan» dinləyicilərindən (qeydiyyat portalı və s.) əvvəl işləyir */
    ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend'].forEach(function (n) {
      window.addEventListener(n, function (e) { if (isNavTab(e.target)) e.stopImmediatePropagation(); }, { capture: true, passive: true });
    });
    window.addEventListener('click', function (e) {
      if (!isNavTab(e.target)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      openList();
    }, true);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var all = document.querySelectorAll('.dqg-ov');
    if (all.length) all[all.length - 1].remove();
  });

  window.DQImtahanGiris = { open: openList, close: closeList, register: function () { openRegister(null); }, config: CFG };
  if (CFG.autoBind) autoBind();
})();
