/*!
 * DQ Platform — İmtahan bölməsi (v11)
 * Sınaq siyahısı + qeydiyyat (iş nömrəsi avtomatik) + 3 addımlı giriş portalı.
 *
 * Qoşulma: index.html-in sonunda, digər skriptlərdən sonra
 *   <script src="dq-imtahan-giris.js?v=11"></script>
 *
 * İstəyə görə tənzimləmə (bu faylı yükləməzdən əvvəl):
 *   window.DQ_IG_CONFIG = {
 *     whatsapp: '994504305162',
 *     prices: { BB: 10, BA: 13, AC: 15 },
 *     requireApproval: true,       // ödəniş təsdiqlənməyibsə imtahana buraxma
 *     autoLaunch: true,            // giriş bitəndə kabinetdə sınağı avtomatik aç
 *     autoBind: false,             // true olsa, «İmtahan» menyusunu bu fayl özü tutur
 *                                  // (index.html-də head-dakı #dq-imtahan-early artıq tutur)
 *     getExams: async () => [...], // sınaq siyahısını öz mənbənizdən verin
 *     onStart: (exam, user) => {}  // imtahanı başladan öz funksiyanız
 *   };
 *
 * Axın: Başla → 1) Ad Soyad → 2) İş nömrəsi (yoxdursa «Qeydiyyatdan keç») → 3) Qaydalar + razılıq.
 * Yeni qeydiyyat admin paneldə gözləməyə düşür; admin kateqoriya + sınaq nömrəsini seçib icazə verir.
 *
 * Dizayn qeydi: bütün interfeys Shadow DOM daxilindədir. Saytdakı 400 KB-lıq ümumi CSS
 * (h4{text-align:center}, button, [class*=modal] və s.) siyahıya və pəncərələrə təsir edə bilmir,
 * digər skriptlər də onun üslublarını silə bilmir.
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
    autoBind: false,
    groups: ['BB', 'BA', 'AC'],
    storageUsers: 'dq_ig_users',
    storageSession: 'dq_ig_session',
    storageExams: 'dq_ig_exams',
    storageResults: 'dq_ig_results',
    resultCollections: ['results', 'exam_results', 'netice'],
    allowRetake: false,
    homeCarousel: true,
    stackHome: true, /* ana səhifədə «Sınaqlar» üstdə, «Yeniliklər» altda — tək sütun */
    videos: { register: '', exam: '' }, /* məs. { register: 'video/qeydiyyat.mp4', exam: 'video/imtahan.mp4' } */
    notifyNew: true,
    carouselMs: 5500,
    legacyRegs: 'dq_exam_regs',
    supabase: {
      url: 'https://cpzwliqlgaplroscvduo.supabase.co',
      key: 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF'
    }
  }, window.DQ_IG_CONFIG || {});
  CFG.whatsapp = String(CFG.whatsapp).replace(/\D/g, '');

  /* ================= köməkçilər ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ls(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  /* Azərbaycan hərflərini sadələşdirir: «Başla» → «basla», «Sınaq» → «sinaq».
     Mətn axtarışında və ad müqayisəsində istifadə olunur. */
  var FOLD = { '\u0259': 'e', '\u0131': 'i', '\u015F': 's', '\u00E7': 'c', '\u011F': 'g', '\u00F6': 'o', '\u00FC': 'u' };
  function norm(s) {
    return String(s || '').replace(/\u0130/g, 'i').replace(/\u0307/g, '').toLowerCase()
      .replace(/[\u0259\u0131\u015F\u00E7\u011F\u00F6\u00FC]/g, function (c) { return FOLD[c]; })
      .replace(/\s+/g, ' ').trim();
  }
  function nameKey(s) { return norm(s).split(' ').filter(Boolean).sort().join(' '); }
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

  /* 7 simvollu iş nömrəsi (məs. 57C8UF4); 0/O, 1/I kimi qarışan simvollar yoxdur */
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genCode() {
    var arr = new Uint32Array(7), code = '', i;
    try { (window.crypto || window.msCrypto).getRandomValues(arr); }
    catch (e) { for (i = 0; i < 7; i++) arr[i] = Math.floor(Math.random() * 4e9); }
    for (i = 0; i < 7; i++) code += ALPHA[arr[i] % ALPHA.length];
    return code;
  }

  /* ================= nəticə köməkçiləri ================= */
  function pick(d, keys) {
    for (var i = 0; i < keys.length; i++) if (d[keys[i]] != null && d[keys[i]] !== '') return d[keys[i]];
    return null;
  }
  function sameExam(d, exam) {
    var g = String(pick(d, ['group', 'category', 'qrup', 'kateqoriya']) || '').toUpperCase();
    var n = parseInt(pick(d, ['number', 'sinaq', 'examNumber', 'sinaqNo']), 10) || 0;
    if (g || n) return (!g || g === String(exam.group).toUpperCase()) && (!n || n === (parseInt(exam.number, 10) || 0));
    var t = norm(pick(d, ['exam', 'examTitle', 'title', 'sinaqAdi']) || ''), et = norm(exam.title);
    return !!t && (t.indexOf(et) > -1 || et.indexOf(t) > -1);
  }
  function normResult(d) {
    return {
      score: pick(d, ['score', 'point', 'points', 'ball', 'netice', 'result']),
      percent: pick(d, ['percent', 'percentage', 'faiz', 'pct']),
      correct: pick(d, ['correct', 'duz', 'right', 'correctCount']),
      wrong: pick(d, ['wrong', 'sehv', 'incorrect', 'wrongCount']),
      empty: pick(d, ['empty', 'blank', 'bos', 'skipped']),
      total: pick(d, ['total', 'questions', 'count', 'totalQuestions']),
      ts: pick(d, ['ts', 'finishedAt', 'date', 'createdAt', 'time'])
    };
  }
  function fmtDate(ts) {
    var d = new Date(typeof ts === 'string' && /^\d+$/.test(ts) ? +ts : ts);
    if (isNaN(d.getTime())) return '';
    var p = function (x) { return ('0' + x).slice(-2); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  /* imtahan bitəndə sistem bu hadisəni göndərsə nəticə yadda qalır:
     window.dispatchEvent(new CustomEvent('dq:exam-finished', {detail:{code,group,number,score,correct,wrong,total}})) */
  function saveResult(code, exam, res) {
    var store = ls(CFG.storageResults, {});
    store[String(code).toUpperCase() + '|' + examKey(exam)] = normResult(res || {});
    lsSet(CFG.storageResults, store);
  }
  window.addEventListener('dq:exam-finished', function (e) {
    var d = (e && e.detail) || {};
    if (d.code && d.group && d.number) saveResult(d.code, { group: d.group, number: d.number }, d);
  });

  /* ================= məlumat qatı ================= */
  function sbFetch(path, opts, ms) {
    var sb = CFG.supabase;
    if (!sb || !sb.url) return Promise.reject(new Error('no-db'));
    var ac = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { try { if (ac) ac.abort(); } catch (e) {} }, ms || 5000);
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
      return {
        code: code, ad: n.ad, soyad: n.soyad, group: d.group || (gm ? gm[1] : ''),
        price: d.price, status: d.status || 'pending', rid: a[0].id,
        allowed: Array.isArray(d.allowed) ? d.allowed : undefined, want: d.want || ''
      };
    } catch (e) { return undefined; }
  }

  function pushReg(u) {
    return sbFetch('dq_v2_store', {
      method: 'POST', keepalive: true, headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ collection: 'regs', data: {
        name: u.ad + ' ' + u.soyad, phone: '', email: '', fin: u.code,
        sid: 'dqg-' + u.group, group: u.group, want: u.want || '', price: u.price, status: u.status,
        allowed: [], payment: u.payment || '', ts: Date.now(), source: 'imtahan-bolmesi' } })
    }, 8000).catch(function () {});
  }

  function legacyList() { var l = ls(CFG.legacyRegs, []); return Array.isArray(l) ? l : []; }

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
        return {
          id: x.id || (g + '-' + n), group: g, number: n,
          title: x.title || ('Dövlət Qulluğu ' + g + ' kateqoriyası üzrə sınaq ' + n),
          questions: x.questions || CFG.questionCount, duration: x.duration || CFG.duration
        };
      });
    },
    async findUser(code) {
      code = String(code || '').trim().toUpperCase();
      if (typeof CFG.findUser === 'function') return await CFG.findUser(code);
      var local = (ls(CFG.storageUsers, {}))[code] || null;
      if (!local) {
        var lg = legacyList().filter(function (r) { return r && String(r.code).toUpperCase() === code; })[0];
        if (lg) {
          var n = splitName(lg.name);
          local = { code: code, ad: n.ad, soyad: n.soyad, group: '', price: lg.price, status: lg.status || 'pending' };
        }
      }
      var remote = await remoteFind(code);
      if (remote) return Object.assign({}, local || {}, remote, { group: remote.group || (local && local.group) || '' });
      if (remote === null && local && local.status === 'pending') pushReg(local); /* əvvəl göndərilə bilməyibsə təkrar cəhd */
      if (remote === undefined && local) local._offline = true;
      return local;
    },
    /* İstifadəçi bu sınaqda artıq iştirak edibsə nəticəsini qaytarır (yoxdursa null).
       Mənbələr: CFG.findResult → yerli yaddaş → bazadakı nəticə kolleksiyaları (CFG.resultCollections). */
    async findResult(u, exam) {
      if (typeof CFG.findResult === 'function') { try { return await CFG.findResult(u, exam); } catch (e) { return null; } }
      var code = String(u.code || '').toUpperCase(), key = code + '|' + examKey(exam);
      var store = ls(CFG.storageResults, {});
      if (store[key]) return store[key];
      var found = null, enc = encodeURIComponent(code);
      for (var i = 0; i < CFG.resultCollections.length && !found; i++) {
        try {
          var r = await sbFetch('dq_v2_store?select=id,data&collection=eq.' + CFG.resultCollections[i] +
            '&or=(data->>fin.eq.' + enc + ',data->>code.eq.' + enc + ')&order=id.desc&limit=30', {}, 4500);
          if (!r.ok) continue;
          var a = await r.json(), hit = (a || []).map(function (x) { return x.data || {}; })
            .filter(function (d) { return sameExam(d, exam); })[0];
          if (hit) found = normResult(hit);
        } catch (e) {}
      }
      if (found) { store[key] = found; lsSet(CFG.storageResults, store); }
      return found;
    },
    /* Admin tərəfindən hazırlanmış elan qapağı (dq-elan.js). null = yoxdur */
    async getCover(key) {
      Data._cov = Data._cov || {};
      if (key in Data._cov) return Data._cov[key];
      var img = null;
      try {
        var r = await sbFetch('dq_v2_store?select=data&collection=eq.elan&data->>key=eq.' + encodeURIComponent(key) + '&order=id.desc&limit=1', {}, 4000);
        if (r.ok) { var a = await r.json(); img = (a && a[0] && a[0].data && a[0].data.img) || null; }
      } catch (e) {}
      Data._cov[key] = img;
      return img;
    },
    /* Admin tərəfindən sınaq üçün yüklənmiş qapaq şəkilləri (dq-sinaq-qapaq.js). Yüngül siyahı + dəyişənləri yükləmə + yerli keş */
    async getCovers() {
      var cache = ls('dq_sq_cov', {}); if (!cache || typeof cache !== 'object') cache = {};
      try {
        var r = await sbFetch('dq_v2_store?select=id,k:data->>key,t:data->>ts&collection=eq.sinaqcover&order=id.desc&limit=300', {}, 4500);
        if (!r.ok) return cache;
        var rows = await r.json(), latest = {}, out = {}, keys;
        (rows || []).forEach(function (x) { if (x && x.k && !(x.k in latest)) latest[x.k] = { id: x.id, ts: String(x.t || '') }; });
        keys = Object.keys(latest);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i], c = cache[k];
          if (c && String(c.ts) === latest[k].ts) { out[k] = c; continue; }
          try {
            var rr = await sbFetch('dq_v2_store?select=data&id=eq.' + latest[k].id, {}, 6000);
            var a = rr.ok ? await rr.json() : null;
            out[k] = { ts: latest[k].ts, img: (a && a[0] && a[0].data && a[0].data.img) || '' };
          } catch (e) { out[k] = c || { ts: latest[k].ts, img: '' }; }
        }
        try { localStorage.setItem('dq_sq_cov', JSON.stringify(out)); } catch (e) {}
        return out;
      } catch (e) { return cache; }
    },
    async uniqueCode() {
      var all = ls(CFG.storageUsers, {}), c, i;
      for (i = 0; i < 6; i++) {
        c = genCode();
        if (all[c]) continue;
        if (!(await remoteFind(c))) return c;
      }
      return genCode();
    },
    hasRegistration: function () {
      return !!ls(CFG.storageSession, null) || Object.keys(ls(CFG.storageUsers, {})).length > 0 || legacyList().length > 0;
    }
  };

  /* ================= üslub (Shadow DOM daxilində) =================
     Siyahı = tünd göy / qızılı kabinet dizaynı, pəncərələr = ağ «İmtahana Giriş Portalı» dizaynı */
  var CSS = `
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
.layer{font-family:Mulish,'Noto Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.4;color:#e9eefb;text-align:left;-webkit-text-size-adjust:100%}
button,input{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit}

/* siyahı */
.page{position:fixed;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,#0b1a40,#06112c)}
.top{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0c1f4d;border-bottom:2px solid #c9a24a}
.logo{display:flex;align-items:center;gap:10px}
.lg{width:36px;height:36px;border:1.5px solid #c9a24a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#f3d47a;font:700 13px Georgia,serif}
.brand b{display:block;color:#f3d47a;font-size:16px;line-height:1.1}
.brand small{color:#9fb0d6;font-size:10px;letter-spacing:.12em}
.x{border:1px solid #c9a24a;color:#f3d47a;background:transparent;border-radius:10px;padding:7px 14px;font-size:13px}
.wrap{max-width:820px;margin:0 auto;padding:16px 14px 40px}
.user{display:flex;align-items:center;gap:12px;margin:6px 0 14px}
.av{width:46px;height:46px;border-radius:50%;background:linear-gradient(180deg,#f3d47a,#d4a73c);color:#13203f;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;flex:none}
.user b{display:block;color:#fff;font-size:16px}
.user small{color:#9fb0d6;letter-spacing:.1em;font-size:11px}
.h{color:#e0b648;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:6px 0 12px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(max-width:320px){.grid{grid-template-columns:1fr}}
.card{background:linear-gradient(160deg,#12295f,#0e2250);border:1px solid #243d7a;border-radius:16px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.28)}
.card-b{padding:12px 12px 10px}
.card h4{margin:0 0 4px;font-size:13px;line-height:1.3;color:#fff;font-weight:700;text-align:left}
.st{font-size:11px;color:#8fa3cf;margin-bottom:8px}
.meta{font-size:11px;color:#c3cfe8;line-height:1.7}
.meta b{color:#fff}
.card-f{padding:10px 12px 12px;border-top:1px solid #1d3570}
.gold{display:block;width:100%;border:0;border-radius:10px;padding:10px;font-weight:700;font-size:13px;color:#13203f;background:linear-gradient(180deg,#f3d47a,#d4a73c);box-shadow:0 4px 12px rgba(212,167,60,.25)}
.stat{display:inline-block;margin-top:3px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;letter-spacing:.02em}
.stat.w{background:rgba(224,182,72,.18);color:#f3d47a}
.stat.ok{background:rgba(76,175,138,.2);color:#7fe0b4}
.empty{text-align:center;padding:4px 0}
.empty .ic{font-size:36px}
.empty.dark{grid-column:1/-1;color:#9fb0d6;padding:30px 0}

/* pəncərələr */
.ov{position:fixed;inset:0;background:rgba(15,18,35,.62);display:flex;align-items:center;justify-content:center;padding:14px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.modal{position:relative;width:100%;max-width:460px;max-height:94vh;overflow:auto;background:#fff;color:#1e1b4b;border-radius:26px;padding:26px 22px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.modal:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#1e1b4b,#c9a24a)}
.modal h3{margin:0 0 12px;text-align:center;font-size:24px;font-weight:400;color:#1e1b4b}
.chip{display:table;margin:0 auto 14px;font-size:13px;padding:7px 14px;border:1px solid #ece9e1;border-radius:12px;color:#6b7280;background:#fff}
.chip b{color:#1e1b4b}
.note{display:block;font-size:14px;line-height:1.6;margin:0 0 12px;padding:0!important;color:#4b5563!important;background:none!important;background-image:none!important;border:0!important;box-shadow:none!important;text-shadow:none!important;opacity:1!important;filter:none!important}
.box .note{color:#374151!important}
.box .note b{color:#1e1b4b!important}
.lbl{display:block;font-size:13px;color:#1e1b4b;margin:12px 0 6px}
.in{width:100%;padding:14px 16px;border-radius:16px;border:1px solid #e5e2da;background:#fff;color:#1e1b4b;font-size:16px;outline:none;-webkit-user-select:text;user-select:text}
.in:focus{border-color:#1e1b4b;box-shadow:0 0 0 3px rgba(30,27,75,.1)}
.code{text-align:center;letter-spacing:.35em;font-weight:800;text-transform:uppercase}
.box{border:1px solid #ece9e1;background:#fff;border-radius:16px;padding:14px 16px;margin:10px 0;font-size:14px;line-height:1.6;color:#4b5563}
.box b{color:#1e1b4b}
.box ul{margin:8px 0 0;padding-left:20px}
.box li{margin-bottom:9px}
.big{font-size:26px;font-weight:800;letter-spacing:.3em;color:#1e1b4b;text-align:center;margin:8px 0 4px}
.copy{display:block;margin:0 auto 6px;border:1px solid #e5e2da;background:#fff;color:#1e1b4b;border-radius:999px;padding:6px 14px;font-size:12px}
.pay{display:flex;gap:8px;margin-top:10px}
.pay span{flex:1;text-align:center;padding:10px 4px;border-radius:12px;background:#f7f6f2;border:1px solid #ece9e1;font-size:13px;color:#6b7280}
.pay span.on{border-color:#1e1b4b;background:#1e1b4b;color:#fff;font-weight:700}
.err{color:#d92d20;font-size:13px;margin:8px 0 0;min-height:16px;line-height:1.5}
.err a{color:#1e1b4b;font-weight:700}
.row{display:flex;gap:12px;margin-top:16px}
.row>*{flex:1}
.ghost,.navy{border-radius:999px;padding:15px 12px;font-size:15px}
.ghost{border:1px solid #e5e2da;background:#fff;color:#1e1b4b}
.navy{border:0;background:#1e1b4b;color:#fff;box-shadow:0 8px 18px rgba(30,27,75,.28)}
.navy[disabled]{background:#e1d3bd;box-shadow:none;cursor:not-allowed}
.chk{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:#4b5563;margin:14px 0 0;cursor:pointer;line-height:1.5}
.chk input{width:22px;height:22px;margin-top:1px;accent-color:#1e1b4b;flex:none}
.chk b{color:#1e1b4b}
.steps{display:flex;align-items:center;margin:22px 0 2px}
.dot{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:#ebe9e2;color:#6b7280;flex:none}
.dot.act{background:#1e1b4b;color:#fff;box-shadow:0 0 0 4px rgba(30,27,75,.12)}
.dot.done{background:#4caf8a;color:#fff}
.line{flex:1;height:4px;background:#ebe9e2;margin:0 6px;border-radius:2px}
.line.done{background:#4caf8a}
.cov{display:block;width:100%;max-height:280px;object-fit:cover;border-radius:16px;margin:0 0 14px}
.kv{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #f0eee8;font-size:14px;color:#4b5563}
.kv b{color:#1e1b4b}
.or{display:flex;align-items:center;gap:10px;margin:16px 0 10px;font-size:13px;color:#6b7280}
.or:before,.or:after{content:"";flex:1;height:1px;background:#ece9e1}
.reg{display:block;width:100%;border:1.5px dashed #c9a24a;background:#fffaf0;color:#1e1b4b;border-radius:999px;padding:13px 12px;font-size:15px;font-weight:700}
`;

  /* ================= qabıq (host + shadow root) ================= */
  var host = null, root = null, pageEl = null, ovs = null;
  var listOpen = false, listToken = null, prevOverflow = null;

  function ensureFont() {
    if (document.getElementById('dqg-font')) return;
    var l = document.createElement('link');
    l.id = 'dqg-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Mulish:wght@400;600;700;800&display=swap';
    (document.head || document.documentElement).appendChild(l);
  }

  /* Host öz üslubunu inline !important ilə daşıyır: saytın heç bir stylesheet-i onu poza bilməz.
     `all:initial` saytın body-dən miras qalan font/rəng/hizalanmanı kəsir. */
  function styleHost(visible) {
    var s = host.style;
    s.setProperty('all', 'initial', 'important');
    [['position', 'fixed'], ['top', '0'], ['right', '0'], ['bottom', '0'], ['left', '0'],
      ['z-index', '2147483000'], ['display', visible ? 'block' : 'none'],
      ['-webkit-user-select', 'text'], ['user-select', 'text']
    ].forEach(function (p) { s.setProperty(p[0], p[1], 'important'); });
  }

  function ensureHost() {
    if (host && host.isConnected) return;
    ensureFont();
    host = document.createElement('div');
    host.id = 'dqg-host';
    host.className = 'dqg-page'; /* #dq-imtahan-early məhz bu sinifə baxır */
    styleHost(false);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style><div class="layer"><div class="page" id="page" hidden></div><div id="ovs"></div></div>';
    pageEl = root.getElementById('page');
    ovs = root.getElementById('ovs');
    pageEl.addEventListener('click', onPageClick);
    document.body.appendChild(host);
  }

  /* siyahı və ya pəncərə açıqdırsa host görünür və səhifə sürüşməsi bağlanır */
  function sync() {
    if (!host) return;
    var open = listOpen || ovs.children.length > 0;
    styleHost(open);
    if (open && prevOverflow === null) { prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    else if (!open && prevOverflow !== null) { document.body.style.overflow = prevOverflow; prevOverflow = null; }
  }

  function modal(html) {
    ensureHost();
    var ov = document.createElement('div');
    ov.className = 'ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="modal">' + html + '</div>';
    ovs.appendChild(ov);
    sync();
    var m = { ov: ov, box: ov.firstChild, close: function () { if (ov.isConnected) { ov.remove(); sync(); } } };
    /* mətni seçib pəncərədən kənarda buraxanda təsadüfən bağlanmasın */
    var down = null;
    ov.addEventListener('pointerdown', function (e) { down = e.target; });
    ov.addEventListener('click', function (e) { if (e.target === ov && down === ov) m.close(); down = null; });
    return m;
  }

  /* ================= sınaq siyahısı ================= */
  function userHead(u) {
    var ok = u.status === 'approved';
    return '<div class="av">' + esc((u.ad || '?').charAt(0).toUpperCase()) + '</div><div><b>' + esc(u.ad + ' ' + u.soyad) + '</b>' +
      '<small>İŞ NÖMRƏSİ: ' + esc(u.code) + '</small><br><span class="stat ' + (ok ? 'ok' : 'w') + '">' +
      (ok ? 'Təsdiqlənib' : 'Admin təsdiqi gözlənilir') + '</span></div>';
  }

  var shown = [];
  function onPageClick(ev) {
    if (ev.target.closest('[data-x]')) return closeList();
    var b = ev.target.closest('[data-i]');
    if (b) onStartTap(shown[+b.getAttribute('data-i')]);
  }

  async function openList() {
    ensureHost();
    ovs.innerHTML = '';
    var token = listToken = {};
    var u = ls(CFG.storageSession, null);
    listOpen = true;
    pageEl.hidden = false;
    pageEl.innerHTML =
      '<div class="top"><div class="logo"><div class="lg">DQ</div><div class="brand"><b>DQ Platform</b><small>DÖVLƏT QULLUĞU SINAQ İMTAHANI</small></div></div>' +
      '<button class="x" data-x type="button">Çıxış</button></div>' +
      '<div class="wrap"><div class="user"' + (u ? '' : ' hidden') + '>' + (u ? userHead(u) : '') + '</div>' +
      '<div class="h">Sınaqlar</div><div class="grid"><div class="empty dark">Yüklənir…</div></div></div>';
    sync();

    var results = await Promise.all([
      Data.getExams().catch(function () { return []; }),
      u ? Data.findUser(u.code).catch(function () { return null; }) : Promise.resolve(null)
    ]);
    if (listToken !== token) return; /* gözləyərkən bağlanıb və ya yenidən açılıb */

    var exams = results[0] || [], fresh = results[1];
    if (fresh && fresh.code) { u = Object.assign({}, u, fresh); lsSet(CFG.storageSession, u); }

    exams.sort(function (a, b) {
      var ga = CFG.groups.indexOf(a.group), gb = CFG.groups.indexOf(b.group);
      return ((ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb)) || (a.group > b.group ? 1 : a.group < b.group ? -1 : 0) || ((a.number || 0) - (b.number || 0));
    });

    /* təsdiqlənmiş və admin icazə vermiş istifadəçi yalnız öz sınaqlarını görür */
    var personal = !!(u && u.status === 'approved' && Array.isArray(u.allowed));
    shown = personal ? exams.filter(function (e) { return isAllowed(u, e); }) : exams;

    var uh = pageEl.querySelector('.user');
    if (u) { uh.hidden = false; uh.innerHTML = userHead(u); }
    pageEl.querySelector('.h').textContent = personal ? 'Sizə icazə verilmiş sınaqlar' : 'Sınaqlar';
    pageEl.querySelector('.grid').innerHTML = !shown.length
      ? '<div class="empty dark"><div class="ic">🗂</div>' + (personal ? 'Hələ sizə sınaq üçün icazə verilməyib.' : 'Hazırda aktiv sınaq yoxdur.') + '</div>'
      : shown.map(function (e, i) {
        return '<div class="card"><div class="card-b"><h4>' + esc(e.title) + '</h4>' +
          '<div class="st">Başlanmayıb</div><div class="meta">Sual sayı: <b>' + esc(e.questions) + '</b><br>Müddət: <b>' + esc(e.duration) + ' Dəqiqə</b></div></div>' +
          '<div class="card-f"><button class="gold" type="button" data-i="' + i + '">Başla</button></div></div>';
      }).join('');
  }

  function closeList() {
    listToken = null; listOpen = false;
    if (pageEl) { pageEl.hidden = true; pageEl.innerHTML = ''; }
    sync();
  }

  function closeAll() {
    if (ovs) ovs.innerHTML = '';
    closeList();
  }

  /* ================= «Başla» toxunuşu ================= */
  function onStartTap(exam) {
    if (!exam) return;
    if (!Data.hasRegistration()) return showNotRegistered(exam);
    openWizard(exam);
  }

  function stepper(n) {
    var h = '<div class="steps">';
    for (var i = 1; i <= 3; i++) {
      h += '<div class="dot ' + (i < n ? 'done' : i === n ? 'act' : '') + '">' + (i < n ? '✓' : i) + '</div>';
      if (i < 3) h += '<div class="line ' + (i < n ? 'done' : '') + '"></div>';
    }
    return h + '</div>';
  }
  function chip(exam) {
    return exam ? '<div class="chip">Qrup: <b>' + esc(exam.group) + '</b> &nbsp;|&nbsp; Sınaq: <b>' + esc(exam.number || exam.title) + '</b></div>' : '';
  }

  /* ---------- qeydiyyatsız istifadəçi ---------- */
  function showNotRegistered(exam) {
    var m = modal('<div class="empty"><div class="ic">📝</div><h3>Qeydiyyatdan keçin</h3>' +
      '<div class="note">Sınağa başlamaq üçün əvvəlcə qeydiyyatdan keçməlisiniz.</div></div>' +
      '<div class="row"><button class="ghost" type="button" data-have>İş nömrəm var</button><button class="navy" type="button" data-reg>Qeydiyyatdan keç</button></div>');
    m.box.querySelector('[data-reg]').onclick = function () { m.close(); openRegister(exam); };
    m.box.querySelector('[data-have]').onclick = function () { m.close(); openWizard(exam); };
  }

  /* ---------- qeydiyyat: ad + soyad → iş nömrəsi avtomatik ---------- */
  function openRegister(exam, pre) {
    pre = pre || ls(CFG.storageSession, null) || {};
    var group = (exam && exam.group) || CFG.groups[0];
    var m = modal('<h3>Qeydiyyat</h3>' + chip(exam) +
      '<div class="note">Ad və soyadınızı yazın. İş nömrəniz avtomatik yaradılacaq.</div>' +
      '<label class="lbl" for="ad">Adınız</label><input class="in" id="ad" autocomplete="given-name" value="' + esc(pre.ad || '') + '">' +
      '<label class="lbl" for="soy">Soyadınız</label><input class="in" id="soy" autocomplete="family-name" value="' + esc(pre.soyad || '') + '">' +
      '<label class="lbl">Kateqoriya</label><div class="pay" id="grp">' +
      CFG.groups.map(function (g) { return '<span data-g="' + g + '" class="' + (g === group ? 'on' : '') + '">' + g + ' — ' + CFG.prices[g] + ' AZN</span>'; }).join('') + '</div>' +
      '<div class="err" id="err" role="alert"></div>' +
      '<div class="row"><button class="ghost" type="button" data-c>Ləğv et</button><button class="navy" type="button" data-n>Davam et</button></div>');
    var q = function (s) { return m.box.querySelector(s); };
    if (exam) Data.getCover(examKey(exam)).then(function (img) {
      if (!img || !m.ov.isConnected) return;
      var im = document.createElement('img'); im.className = 'cov'; im.alt = ''; im.src = img;
      m.box.insertBefore(im, m.box.firstChild);
    });
    q('#grp').onclick = function (e) {
      var s = e.target.closest('[data-g]'); if (!s) return;
      group = s.getAttribute('data-g');
      [].forEach.call(q('#grp').children, function (x) { x.classList.toggle('on', x === s); });
    };
    q('[data-c]').onclick = m.close;
    q('[data-n]').onclick = async function () {
      var btn = this, ad = q('#ad').value.trim(), soy = q('#soy').value.trim();
      if (ad.length < 2 || soy.length < 2) { q('#err').textContent = 'Ad və soyadı düzgün daxil edin.'; return; }
      btn.disabled = true; q('#err').textContent = '';
      var code = await Data.uniqueCode();
      var price = CFG.prices[group];
      var user = {
        code: code, ad: ad, soyad: soy, group: group, price: price,
        want: (exam && exam.group === group && exam.number) ? examKey(exam) : '', allowed: [],
        status: price > 0 ? 'pending' : 'approved', createdAt: new Date().toISOString()
      };
      m.close(); showPayment(user);
    };
    setTimeout(function () { try { q('#ad').focus(); } catch (e) {} }, 80);
  }

  /* ---------- iş nömrəsi + ödəniş məlumatı + WhatsApp ---------- */
  function showPayment(user) {
    var prices = CFG.groups.map(function (g) { return g + ' ' + CFG.prices[g] + ' AZN'; });
    var m = modal('<h3>Qeydiyyat tamamlandı</h3>' +
      '<div class="box"><b>' + esc(user.ad + ' ' + user.soyad) + '</b><br>İş nömrəniz:<div class="big">' + esc(user.code) + '</div>' +
      '<button class="copy" type="button" data-copy>Nömrəni kopyala</button>' +
      '<span style="font-size:13px">Bu nömrəni saxlayın — imtahana bununla daxil olacaqsınız.</span></div>' +
      '<div class="box"><b>Ödəniş</b><div class="pay">' +
      CFG.groups.map(function (g) { return '<span class="' + (g === user.group ? 'on' : '') + '">' + g + ' ' + CFG.prices[g] + ' AZN</span>'; }).join('') + '</div>' +
      '<div class="note" style="margin:10px 0 0">Ödəniş ' + prices.join(', ') + ' təşkil edir. Seçdiyiniz qrup: <b>' + esc(user.group) + ' — ' + user.price + ' AZN</b>. ' +
      '«Razıyam» düyməsinə toxunduqda ödəniş qeyd olunur və WhatsApp-da hazır mesaj açılır. Admin ödənişi təsdiqləyib sizə sınaq icazəsi verəcək.</div></div>' +
      '<div class="row"><button class="ghost" type="button" data-c>Ləğv et</button><button class="navy" type="button" data-ok>Razıyam</button></div>');
    m.box.querySelector('[data-c]').onclick = m.close;
    m.box.querySelector('[data-copy]').onclick = function () {
      var b = this;
      try {
        navigator.clipboard.writeText(user.code).then(
          function () { b.textContent = 'Kopyalandı ✓'; },
          function () { b.textContent = user.code; });
      } catch (e) { b.textContent = user.code; }
    };
    m.box.querySelector('[data-ok]').onclick = function () {
      this.disabled = true;
      user.payment = 'qeyd olundu';
      /* yerli yaddaş sinxron yazılır — WhatsApp pəncərəsi bloklanmasın deyə */
      var all = ls(CFG.storageUsers, {}); all[user.code] = user; lsSet(CFG.storageUsers, all);
      lsSet(CFG.storageSession, user);
      pushReg(user);
      if (typeof CFG.saveUser === 'function') { try { CFG.saveUser(user); } catch (e) {} }
      var text = 'Salam! DQ Platform sınaq platformasında imtahanda qeydiyyatdan keçdim.\n' +
        'Ad Soyad: ' + user.ad + ' ' + user.soyad + '\n' +
        'İş nömrəsi: ' + user.code + '\n' +
        'Kateqoriya: ' + user.group + (user.want ? ' (Sınaq ' + user.want.split('-')[1] + ')' : '') + '\n' +
        'Ödəniş: ' + user.price + '₼\n' +
        'Ödəniş üçün kart kodunu qeyd edərsiniz zəhmət olmasa. Sınaq imtahanında iştirak və qeydiyyatın təsdiqi üçün yazıram.';
      var url = waLink(text), w = null;
      try { w = window.open(url, '_blank'); } catch (e) {}
      if (!w) location.href = url;
      m.close();
      if (listOpen) openList();
    };
  }

  /* ================= 3 addımlı giriş portalı =================
     1) Ad Soyad   2) İş nömrəsi (yoxdursa qeydiyyat)   3) Qaydalar + razılıq */
  function openWizard(exam) {
    var sess = ls(CFG.storageSession, null) || {};
    var user = null, step = 1, who = { ad: sess.ad || '', soyad: sess.soyad || '' };
    var m = modal('<div id="body"></div>');
    var body = m.box.querySelector('#body');

    function head() { return '<h3>İmtahana Giriş Portalı</h3>' + chip(exam); }
    function waPending(u) { return waLink('Salam! İş nömrəm: ' + u.code + '. Ödənişi etmişəm, sınaq icazəsi üçün yazıram.'); }
    function q(s) { return body.querySelector(s); }

    function render() {
      if (step === 1) renderName();
      else if (step === 2) renderCode();
      else renderRules();
    }

    function renderName() {
      body.innerHTML = head() +
        '<div class="note">Zəhmət olmasa, imtahanda iştirak edəcək şəxsin ad və soyadını daxil edin.</div>' +
        '<label class="lbl" for="ad">Adınız</label><input class="in" id="ad" autocomplete="given-name" value="' + esc(who.ad) + '">' +
        '<label class="lbl" for="soy">Soyadınız</label><input class="in" id="soy" autocomplete="family-name" value="' + esc(who.soyad) + '">' +
        '<div class="err" id="err" role="alert"></div>' +
        '<div class="row"><button class="ghost" type="button" data-c>Ləğv et</button><button class="navy" type="button" data-n>Davam et</button></div>' + stepper(1);
      var ad = q('#ad'), soy = q('#soy'), err = q('#err'), go = q('[data-n]');
      q('[data-c]').onclick = m.close;
      soy.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      go.onclick = function () {
        if (ad.value.trim().length < 2 || soy.value.trim().length < 2) { err.textContent = 'Ad və soyadı düzgün daxil edin.'; return; }
        who = { ad: ad.value.trim(), soyad: soy.value.trim() }; step = 2; render();
      };
      setTimeout(function () { try { (who.ad ? soy : ad).focus(); } catch (e) {} }, 80);
    }

    function renderCode() {
      body.innerHTML = head() +
        '<div class="note">Qeydiyyatdan keçmisinizsə, 7 simvollu şəxsi iş nömrənizi daxil edin.</div>' +
        '<label class="lbl" for="code">Şəxsi iş nömrəsi</label>' +
        '<input class="in code" id="code" maxlength="7" placeholder="7 simvollu kod" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(sess.code || '') + '">' +
        '<div class="err" id="err" role="alert"></div>' +
        '<div class="row" style="margin-top:8px"><button class="ghost" type="button" data-b>Geri</button><button class="navy" type="button" data-n>Davam et</button></div>' +
        '<div class="or">İş nömrəniz yoxdur?</div><button class="reg" type="button" data-reg>Qeydiyyatdan keç</button>' + stepper(2);
      var inp = q('#code'), err = q('#err'), go = q('[data-n]');
      inp.oninput = function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      q('[data-b]').onclick = function () { step = 1; render(); };
      q('[data-reg]').onclick = function () { m.close(); openRegister(exam, who); };

      go.onclick = async function () {
        err.textContent = '';
        var code = inp.value.trim().toUpperCase();
        if (code.length !== 7) { err.textContent = 'İş nömrəsi 7 simvol olmalıdır.'; return; }
        go.disabled = true; go.textContent = 'Yoxlanılır…';
        var u = null;
        try { u = await Data.findUser(code); } catch (e) {}
        go.disabled = false; go.textContent = 'Davam et';

        if (!u) {
          err.innerHTML = 'Bu iş nömrəsi tapılmadı. <a href="#" data-r2>Qeydiyyatdan keç</a>';
          err.querySelector('[data-r2]').onclick = function (e) { e.preventDefault(); m.close(); openRegister(exam, who); };
          return;
        }
        if (nameKey(u.ad + ' ' + u.soyad) !== nameKey(who.ad + ' ' + who.soyad)) {
          err.innerHTML = 'Bu iş nömrəsi başqa ad-soyada aiddir. <a href="#" data-bk>Ad və soyadı düzəlt</a>';
          err.querySelector('[data-bk]').onclick = function (e) { e.preventDefault(); step = 1; render(); };
          return;
        }
        /* bu sınaqda artıq iştirak edibsə — nəticəni birbaşa göstər */
        go.disabled = true; go.textContent = 'Nəticə yoxlanılır…';
        var prev = null;
        try { prev = await Data.findResult(u, exam); } catch (e) {}
        go.disabled = false; go.textContent = 'Davam et';
        if (prev) { lsSet(CFG.storageSession, u); user = u; renderResult(u, prev); return; }

        if (u._offline && u.status !== 'approved') { err.textContent = 'Serverlə əlaqə qurula bilmədi. İnterneti yoxlayıb yenidən cəhd edin.'; return; }
        if (CFG.requireApproval && u.status && u.status !== 'approved') {
          err.innerHTML = 'Qeydiyyatınız hələ təsdiqlənməyib. Admin ödənişi təsdiqləyib icazə verənədək gözləyin və ya <a href="' + esc(waPending(u)) + '" target="_blank" rel="noopener">adminə yazın</a>.';
          return;
        }
        if (CFG.requireApproval && !isAllowed(u, exam)) {
          err.innerHTML = 'Bu sınaq (' + esc(exam.group) + ' · Sınaq ' + esc(exam.number) + ') üçün sizə hələ icazə verilməyib. <a href="' + esc(waPending(u)) + '" target="_blank" rel="noopener">Adminə yazın</a>.';
          return;
        }
        user = u; lsSet(CFG.storageSession, u); step = 3; render();
      };
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
    }

    function renderResult(u, res) {
      var rows = [];
      if (res.correct != null) rows.push(['Düzgün cavab', res.correct]);
      if (res.wrong != null) rows.push(['Səhv cavab', res.wrong]);
      if (res.empty != null) rows.push(['Boş', res.empty]);
      if (res.total != null) rows.push(['Ümumi sual', res.total]);
      var dt = res.ts ? fmtDate(res.ts) : '';
      if (dt) rows.push(['Tarix', dt]);
      var main = res.score != null ? res.score : (res.percent != null ? res.percent + '%' : '—');
      body.innerHTML = '<h3>Sizin nəticəniz</h3>' + chip(exam) +
        '<div class="box"><b>' + esc(u.ad + ' ' + u.soyad) + '</b><br>İş nömrəsi: <b>' + esc(u.code) + '</b>' +
        '<div class="big">' + esc(main) + '</div>' +
        (res.score != null && res.percent != null ? '<div class="note" style="text-align:center;margin:0 0 8px">' + esc(res.percent) + '%</div>' : '') +
        rows.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' +
        '<div class="note">Bu sınaqda artıq iştirak etmisiniz, ona görə nəticəniz birbaşa göstərilir.</div>' +
        '<div class="row"><button class="ghost" type="button" data-b>Geri</button><button class="navy" type="button" data-x>Bağla</button></div>' +
        (CFG.allowRetake ? '<div class="or">və ya</div><button class="reg" type="button" data-re>Sınağı yenidən başla</button>' : '');
      q('[data-b]').onclick = function () { step = 2; render(); };
      q('[data-x]').onclick = m.close;
      if (CFG.allowRetake) q('[data-re]').onclick = function () { step = 3; render(); };
    }

    function renderRules() {
      body.innerHTML = head() +
        '<div class="box"><b>İmtahan Qaydaları:</b><ul>' +
        '<li>Sınaq suallarını hər hansı qrupda paylaşmaq, 3-cü şəxslərə göndərmək <b>qadağandır</b>.</li>' +
        '<li>Bu sınaqda <b>xarici mənbələrdən</b> (müəllim köməyi, tələbədən-tələbəyə, kitab, internet resurslarından) istifadə <b>qadağandır</b>.</li>' +
        '<li>Sınaq müddəti: <b>' + esc(exam.duration || CFG.duration) + ' dəqiqə</b>. İmtahan səhifəsindən çıxış etsəniz belə, geri sayım taymeri davam edir. Hər hansı bir imtahan şərti pozulduqda imtahan dayandırılacaqdır.</li></ul></div>' +
        '<label class="chk"><input type="checkbox" id="agree"><span>Bütün qaydaları oxudum və <b>qaydalarla razıyam</b>.</span></label>' +
        '<div class="row"><button class="ghost" type="button" data-b>Geri</button><button class="navy" type="button" data-go disabled>▷ İmtahana Başla</button></div>' + stepper(3);
      var cb = q('#agree'), gob = q('[data-go]');
      cb.onchange = function () { gob.disabled = !cb.checked; };
      q('[data-b]').onclick = function () { step = 2; render(); };
      gob.onclick = function () { closeAll(); startExam(exam, user); };
    }

    render();
  }

  /* ================= imtahanı başlat ================= */
  function fire(el) {
    ['input', 'change'].forEach(function (n) { try { el.dispatchEvent(new Event(n, { bubbles: true })); } catch (e) {} });
  }

  /* sistemin kabinetindəki uyğun sınağın «Başla» düyməsini tapıb açır */
  function launchFromCabinet(exam) {
    var group = norm(exam.group).replace(/[^a-z0-9]/g, '');
    var re = new RegExp('(^|\\s)' + group + '\\s.*sinaq\\s*' + (parseInt(exam.number, 10) || 0) + '(?!\\d)');
    var tt = norm(exam.title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var reT = tt ? new RegExp(tt + '(?!\\d)') : null;
    var tries = 0, timer = setInterval(function () {
      tries++;
      var list = document.getElementById('registered-exams-list');
      if (list) {
        for (var i = 0; i < list.children.length; i++) {
          var ct = norm(list.children[i].textContent);
          if (!(re.test(ct) || (reT && reT.test(ct)))) continue;
          var btns = list.children[i].querySelectorAll('button,a,[role="button"]');
          for (var j = 0; j < btns.length; j++) {
            if (/basla/.test(norm(btns[j].textContent))) { clearInterval(timer); btns[j].click(); return; }
          }
        }
      }
      if (tries > 30) clearInterval(timer);
    }, 300);
  }

  function startExam(exam, user) {
    try { window.dispatchEvent(new CustomEvent('dq:start-exam', { detail: { exam: exam, user: user, group: exam.group, number: exam.number } })); } catch (e) {}
    if (typeof CFG.onStart === 'function') return CFG.onStart(exam, user);

    var n = document.getElementById('user-name'), f = document.getElementById('user-fin');
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

  /* ================= «İmtahan» menyusuna qoşulma (ixtiyari) ================= */
  var NAVSEL = '[data-dqnav],.v3-hd,.v3-top,.v3-nav,header,nav,[class*=header],[class*=navbar],[class*=topbar],[class*=menu],[class*=dock],[class*=tabbar],[role="tablist"]';
  var SKIP = '.dqg-page,#dqx-ov,#dqa-ov,#rga,#admin-panel,#login-screen,#exam-screen,#dq-cab';

  function isNavTab(target) {
    if (!target || !target.closest || target.closest(SKIP)) return false;
    if (window.__dqInAdminUI && window.__dqInAdminUI(target)) return false; /* İmtahanPro / admin interfeysi istisnadır */
    for (var i = 0, el = target; el && el !== document.body && i < 5; i++, el = el.parentElement) {
      var key = norm((el.getAttribute && (el.getAttribute('data-tab') || el.getAttribute('data-page'))) || '');
      var hit = key === 'imtahan' || key === 'exam' || norm(el.textContent) === 'imtahan';
      if (hit && (el.hasAttribute('data-dqnav') || el.closest(NAVSEL) || el.closest('#dqr'))) return true;
    }
    return false;
  }

  function autoBind() {
    ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend'].forEach(function (n) {
      window.addEventListener(n, function (e) { if (isNavTab(e.target)) e.stopImmediatePropagation(); }, { capture: true, passive: true });
    });
    window.addEventListener('click', function (e) {
      if (!isNavTab(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      openList();
    }, true);
  }

  /* Esc: əvvəl pəncərəni, sonra siyahını bağlayır */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !host) return;
    if (ovs.lastElementChild) { ovs.lastElementChild.remove(); sync(); }
    else if (listOpen) closeList();
  });


  /* ================= Ana səhifə: «Aktiv sınaqlar» karuseli =================
     İmtahanPro-da aktiv edilmiş sınaqlar «Hazırda aktiv sınaq yoxdur» yerində göstərilir və
     hər 2 saniyədən bir animasiya ilə növbətiyə keçir. ‹ › düymələri də işləyir. */
  var AC = { covers: {}, node: null, track: null, dots: null, exams: [], sig: '', idx: 0, timer: null, pauseUntil: 0, hidden: null, loadedAt: 0, loading: false, jump: null };

  function carCss() {
    if (AC.css && document.getElementById('dqa-css')) return;
    var st = document.getElementById('dqa-css') || document.createElement('style'); st.id = 'dqa-css';
    st.textContent =
      '.dqa{position:relative;overflow:hidden;border-radius:16px;border:1px solid #243d7a;background:linear-gradient(160deg,#12295f,#0e2250);color:#e9eefb;font-family:Mulish,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left;width:100%;box-sizing:border-box}' +
      '.dqa *{box-sizing:border-box}' +
      '.dqa-tr{display:flex;transition:transform .6s cubic-bezier(.4,0,.2,1);will-change:transform}' +
      '.dqa-tr.off{transition:none}' +
      '.dqa-sl{flex:0 0 100%;min-width:0;padding:18px 18px 14px;display:flex;flex-direction:column;gap:8px}' +
      '.dqa-tag{align-self:flex-start;font-size:12px;font-weight:800;color:#f3d47a;background:rgba(224,182,72,.16);border:1px solid rgba(224,182,72,.35);padding:4px 11px;border-radius:99px;letter-spacing:.02em}' +
      '.dqa-t{margin:0;font-size:17px;line-height:1.3;font-weight:800;color:#fff;text-align:left}' +
      '.dqa-m{font-size:13px;color:#c3cfe8;line-height:1.6}.dqa-m b{color:#fff}' +
      '.dqa-go{align-self:flex-start;margin-top:4px;border:0;border-radius:12px;padding:11px 20px;font:800 14px Mulish,system-ui,sans-serif;color:#13203f;background:linear-gradient(180deg,#f3d47a,#d4a73c);box-shadow:0 4px 12px rgba(212,167,60,.25);cursor:pointer}' +
      '.dqa-dots{display:flex;justify-content:center;gap:6px;padding:0 0 12px}' +
      '.dqa-dots i{width:7px;height:7px;border-radius:99px;background:#3b4f86;transition:all .3s}.dqa-dots i.on{width:20px;background:#f3d47a}' +
      '.dqa-lx{background:#fff;border:1px solid #e3e8f2;border-radius:20px;padding:20px;color:#0f1f45;font-family:inherit;text-align:left}' +
      '.dqa-lx h3{margin:0 0 2px;font-size:20px;font-weight:800;color:#0f1f45;text-align:left}.dqa-lxs{font-size:13px;color:#5d6a88;margin-bottom:12px}' +
      '.dqa-lx .dqa-tag{background:#fff7e0;color:#8a6410;border-color:#f0d58a}' +
      '.dqa-lxr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #eef1f7;flex-wrap:wrap}.dqa-lxr>div{min-width:0;flex:1 1 180px}' +
      '.dqa-lxt{font-size:15px;font-weight:700;margin:6px 0 2px;color:#0f1f45}.dqa-lxm{font-size:12px;color:#5d6a88}' +
      '.dqa-lxb{border:0;border-radius:12px;padding:11px 16px;font:800 13px Mulish,system-ui,sans-serif;color:#fff;background:#1e1b4b;cursor:pointer;white-space:nowrap}' +
      '.dqa-lxa{display:flex;gap:8px;flex-wrap:wrap}.dqa-lxb.gh{background:#eef2fb;color:#1e1b4b}' +
      '.dqa-vd{margin-top:14px}.dqa-vd video{display:block;width:100%;max-height:420px;border-radius:14px;background:#000;margin-top:6px}' +
      '.dqa-bn{position:fixed;left:12px;right:12px;top:12px;z-index:2147483200;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#0c1f4d;color:#fff;border:1px solid #c9a24a;border-radius:16px;padding:12px 14px;box-shadow:0 14px 34px #0006;font-family:Mulish,system-ui,sans-serif;font-size:13px;max-width:520px;margin:0 auto}' +
      '.dqa-bn b{color:#f3d47a;font-size:14px}.dqa-bn span{flex:1 1 120px;color:#c3cfe8}.dqa-bn button{border:0;border-radius:10px;padding:9px 14px;font-weight:800;background:#f3d47a;color:#13203f;cursor:pointer}.dqa-bn i{cursor:pointer;font-style:normal;font-size:20px;color:#9fb0d6;padding:0 4px}' +
      '@media (prefers-reduced-motion:reduce){.dqa-tr{transition:none}}';
    AC.css = st.textContent;
    if (!st.isConnected) (document.head || document.documentElement).appendChild(st);
  }

  /* Shadow DOM: saytın ümumi CSS-i kartlara toxuna bilmir */
  var EXTRA_CSS = ':host{display:block!important;width:100%!important;max-width:100%!important}';
  /* Karusel dizaynı: «Yeniliklər» slayderi ilə eyni dil (solda şəkil, sağda mətn, nöqtələr, animasiya) */
  var CAR_CSS =
    '.dqa{position:relative;overflow:hidden;border-radius:16px;border:1px solid rgba(120,150,220,.24);background:linear-gradient(160deg,#17294f,#0d1b3e);box-shadow:0 14px 30px -18px rgba(0,0,0,.7);touch-action:pan-y;-webkit-tap-highlight-color:transparent}' +
    '.dqa-tr{display:flex;transition:transform .75s cubic-bezier(.4,0,.2,1);will-change:transform}.dqa-tr.off{transition:none}' +
    '.dqa-sl{flex:0 0 100%;min-width:0;display:flex;flex-direction:row;align-items:stretch;padding:0;gap:0}' +
    '.dqa-img{position:relative;flex:0 0 38%;min-height:216px;overflow:hidden;background:#0b1a40;isolation:isolate}' +
    '.dqa-img:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 55%,rgba(13,27,62,.55));pointer-events:none;z-index:2}' +
    '.dqa-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.1);transition:transform 6.5s cubic-bezier(.2,.7,.2,1);z-index:1}' +
    '.dqa-sl.on .dqa-img img{transform:scale(1)}' +
    '.dqa-art{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(120% 70% at 50% 0%,rgba(255,255,255,.18),transparent 62%),linear-gradient(155deg,var(--a),var(--b));z-index:1}' +
    '.dqa-art:before{content:"";position:absolute;inset:9px;border:1px solid rgba(217,178,95,.4);border-radius:12px}' +
    '.dqa-art:after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(circle at 50% 45%,#000,transparent 75%);mask-image:radial-gradient(circle at 50% 45%,#000,transparent 75%)}' +
    '.dqa-big{position:relative;z-index:1;font-weight:800;font-size:clamp(46px,13vw,84px);line-height:1;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:2px #d9b25f}' +
    '.dqa-art small{position:relative;z-index:1;font-size:11px;font-weight:800;letter-spacing:.14em;color:#f3d47a;text-transform:uppercase}' +
    '.dqa-lg{position:absolute;left:12px;top:12px;z-index:3;width:30px;height:30px;border-radius:9px;background:#f3d47a;color:#13203f;font:800 12px Mulish,system-ui,sans-serif;display:grid;place-items:center;box-shadow:0 4px 10px rgba(0,0,0,.3)}' +
    '.dqa-bd{position:absolute;left:12px;bottom:12px;z-index:3;font:800 12px Mulish,system-ui,sans-serif;color:#fff;background:rgba(8,16,40,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18);padding:5px 11px;border-radius:99px}' +
    '.dqa-bx{flex:1 1 0;min-width:0;padding:18px 20px 16px 18px;display:flex;flex-direction:column;justify-content:center;gap:10px}' +
    '.dqa-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.dqa-tag{align-self:auto;font-size:12px;font-weight:800;color:#f3d47a;background:rgba(224,182,72,.16);border:1px solid rgba(224,182,72,.35);padding:4px 11px;border-radius:99px;letter-spacing:.02em}' +
    '.dqa-live{display:inline-flex;align-items:center;gap:6px;font:700 12px Mulish,system-ui,sans-serif;color:#9fb0d6}.dqa-live i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 0 rgba(52,211,153,.6);animation:dqaPulse 1.8s infinite}' +
    '@keyframes dqaPulse{70%{box-shadow:0 0 0 7px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}' +
    '.dqa-t{margin:0;font-size:clamp(16px,4.3vw,21px);line-height:1.28;font-weight:800;color:#fff;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
    '.dqa-ch{display:flex;flex-wrap:wrap;gap:6px}.dqa-ch span{font:700 12px Mulish,system-ui,sans-serif;color:#c3cfe8;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);padding:5px 10px;border-radius:9px}.dqa-ch b{color:#fff}' +
    '.dqa-go{align-self:flex-start;margin-top:4px;border:0;border-radius:12px;padding:11px 18px;font:800 14px Mulish,system-ui,sans-serif;color:#13203f;background:linear-gradient(180deg,#f3d47a,#d4a73c);box-shadow:0 6px 16px -6px rgba(212,167,60,.55);cursor:pointer;white-space:nowrap;transition:transform .2s,box-shadow .2s}' +
    '.dqa-go:hover{transform:translateY(-1px)}.dqa-go:active{transform:scale(.97)}' +
    '@keyframes dqaIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
    '.dqa-sl.on .dqa-bx>*{animation:dqaIn .6s cubic-bezier(.2,.8,.2,1) both}.dqa-sl.on .dqa-bx>*:nth-child(2){animation-delay:.07s}.dqa-sl.on .dqa-bx>*:nth-child(3){animation-delay:.14s}.dqa-sl.on .dqa-bx>*:nth-child(4){animation-delay:.21s}' +
    '.dqa-dots{display:flex;justify-content:center;gap:7px;padding:2px 0 14px}.dqa-dots i{width:8px;height:8px;border-radius:99px;background:#3b4f86;transition:width .35s cubic-bezier(.3,1.2,.4,1),background-color .3s;cursor:pointer}.dqa-dots i.on{width:24px;background:#f3d47a}' +
    '@media (min-width:640px){.dqa-img{flex-basis:34%;min-height:250px}.dqa-bx{padding:24px 28px;gap:12px}}' +
    '@media (max-width:360px){.dqa-sl{flex-direction:column}.dqa-img{flex:0 0 auto;min-height:150px}}' +
    '@media (prefers-reduced-motion:reduce){.dqa-tr{transition:none}.dqa-img img{transition:none;transform:none}.dqa-sl.on .dqa-bx>*{animation:none}.dqa-live i{animation:none}}';
  function shadowHost(id, inner) {
    carCss();
    var h = document.createElement('div'); h.id = id;
    var sr = h.attachShadow({ mode: 'open' });
    sr.innerHTML = '<style>' + (AC.css || '') + EXTRA_CSS + CAR_CSS + '</style>' + inner;
    return { host: h, sr: sr };
  }

  var ART = { BA: ['#7c2d6b', '#3a1457'], BB: ['#1d4ed8', '#12306f'], AC: ['#0f766e', '#0a3f4e'] };
  function slideHtml(e, i) {
    var key = examKey(e), cv = AC.covers && AC.covers[key], img = cv && cv.img, c = ART[e.group] || ['#1e3a8a', '#0b1a40'], pr = CFG.prices && CFG.prices[e.group];
    var art = img
      ? '<img src="' + esc(img) + '" alt="' + esc(e.title) + '" decoding="async">'
      : '<div class="dqa-art" style="--a:' + c[0] + ';--b:' + c[1] + '"><div class="dqa-big">' + esc(e.group) + '</div><small>Sınaq ' + esc(e.number) + '</small></div>';
    return '<div class="dqa-sl"><div class="dqa-img">' + art + '<span class="dqa-lg">DQ</span>' + (img ? '<span class="dqa-bd">Sınaq ' + esc(e.number) + '</span>' : '') + '</div>' +
      '<div class="dqa-bx"><div class="dqa-top"><span class="dqa-tag">' + esc(e.group) + ' · Sınaq ' + esc(e.number) + '</span><span class="dqa-live"><i></i>Qeydiyyat açıqdır</span></div>' +
      '<h4 class="dqa-t">' + esc(e.title) + '</h4>' +
      '<div class="dqa-ch"><span><b>' + esc(e.questions) + '</b> sual</span><span><b>' + esc(e.duration) + '</b> dəq</span>' + (pr ? '<span><b>' + esc(pr) + '</b> AZN</span>' : '') + '</div>' +
      '<button class="dqa-go" type="button" data-i="' + i + '">Sınağa keç →</button></div></div>';
  }

  function carMove(animate) {
    if (!AC.track) return;
    AC.track.classList.toggle('off', !animate);
    AC.track.style.transform = 'translateX(' + (-100 * AC.idx) + '%)';
    var n = AC.exams.length, cur = AC.idx % n;
    [].forEach.call(AC.dots.children, function (d, k) { d.classList.toggle('on', k === cur); });
    [].forEach.call(AC.track.children, function (sl, k) { sl.classList.toggle('on', k === AC.idx || (AC.idx === n && k === 0)); });
  }
  function carNext() {
    var n = AC.exams.length; if (n < 2) return;
    if (AC.idx >= n) { AC.idx = 0; carMove(false); void AC.track.offsetWidth; }
    AC.idx++; carMove(true);
    if (AC.idx === n) { clearTimeout(AC.jump); AC.jump = setTimeout(function () { if (AC.idx === n) { AC.idx = 0; carMove(false); } }, 650); }
  }
  function carPrev() {
    var n = AC.exams.length; if (n < 2) return;
    clearTimeout(AC.jump);
    if (AC.idx <= 0) { AC.idx = n; carMove(false); void AC.track.offsetWidth; }
    AC.idx--; carMove(true);
  }

  function carBuild() {
    var n = AC.exams.length;
    var sh = shadowHost('dqa-home', '<div class="dqa"><div class="dqa-tr">' + AC.exams.map(slideHtml).join('') + (n > 1 ? slideHtml(AC.exams[0], 0) : '') + '</div>' +
      (n > 1 ? '<div class="dqa-dots">' + AC.exams.map(function () { return '<i></i>'; }).join('') + '</div>' : '') + '</div>');
    AC.node = sh.host; AC.sr = sh.sr; AC.track = sh.sr.querySelector('.dqa-tr');
    AC.dots = sh.sr.querySelector('.dqa-dots') || document.createElement('div'); AC.idx = 0;
    sh.sr.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-i]'); if (b) onStartTap(AC.exams[+b.getAttribute('data-i')]);
    });
    var pause = function () { AC.pauseUntil = Date.now() + 4000; };
    ['pointerenter', 'touchstart', 'pointerdown'].forEach(function (n2) { sh.host.addEventListener(n2, pause, { passive: true }); });
    carMove(false);
    [].forEach.call(AC.dots.children, function (d, k) { d.addEventListener('click', function () { AC.pauseUntil = Date.now() + 6000; clearTimeout(AC.jump); AC.idx = k; carMove(true); }); });
    var sx = null, sy = 0;
    sh.sr.addEventListener('pointerdown', function (ev) { if (ev.target.closest('button')) { sx = null; return; } sx = ev.clientX; sy = ev.clientY; }, { passive: true });
    sh.sr.addEventListener('pointerup', function (ev) {
      if (sx === null) return; var dx = ev.clientX - sx, dy = ev.clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) { AC.pauseUntil = Date.now() + 6000; if (dx < 0) carNext(); else carPrev(); }
    }, { passive: true });
    sh.sr.addEventListener('pointercancel', function () { sx = null; }, { passive: true });
  }

  /* «Hazırda aktiv sınaq yoxdur» yazısını və onu əhatə edən qutunu tapır */
  function findEmpty() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), t, hit = null;
    while ((t = w.nextNode())) {
      var v = t.nodeValue;
      if (!v || v.length > 80 || v.length < 12) continue;
      if (/aktiv sinaq yoxdur/.test(norm(v)) && !(AC.node && AC.node.contains(t))) { hit = t.parentElement; break; }
    }
    if (!hit) return null;
    var box = hit;
    for (var i = 0, el = hit; el && i < 4; i++, el = el.parentElement) {
      try { if (/dashed/.test(getComputedStyle(el).borderStyle)) { box = el; break; } } catch (e) {}
    }
    return box;
  }

  /* Saytın öz skripti sınaq kartlarını özü çəkibsə (alt-alta düzülən siyahı), onu gizlədib yerinə karusel qoyuruq */
  function findHostCards() {
    var hdr = stackPanels.b && stackPanels.b.isConnected ? stackPanels.b : textEls('aktiv sinaqlar ve movzu testleri')[0];
    if (!hdr) return null;
    var pan = hdr, btns = [];
    function scan(root) {
      var out = [], all = root.querySelectorAll('button,a,[role="button"]');
      for (var i = 0; i < all.length; i++) {
        if (/^sinaga kec/.test(norm(all[i].textContent)) && all[i].getClientRects().length) out.push(all[i]);
      }
      return out;
    }
    for (var up = 0; pan && up < 7; up++, pan = pan.parentElement) {
      btns = scan(pan);
      if (btns.length) break;
    }
    if (!btns.length) return null;
    var L = btns[0];
    btns.forEach(function (b) { L = lca(L, b); });
    while (L.parentElement && !L.parentElement.contains(hdr)) L = L.parentElement;
    if (L.contains(hdr) || L === document.body) return null;
    return L;
  }

  function carBindArrows(box) {
    var el = box;
    for (var up = 0; el && up < 5; up++, el = el.parentElement) {
      var bs = el.querySelectorAll('button,[role="button"],a'), l = null, r = null;
      for (var i = 0; i < bs.length; i++) {
        var tx = (bs[i].textContent || '').trim();
        if (/^[‹<❮←]$/.test(tx)) l = bs[i]; else if (/^[›>❯→]$/.test(tx)) r = bs[i];
      }
      if (l && r) {
        if (!l.__dqa) { l.__dqa = 1; l.addEventListener('click', function () { AC.pauseUntil = Date.now() + 4000; carPrev(); }); }
        if (!r.__dqa) { r.__dqa = 1; r.addEventListener('click', function () { AC.pauseUntil = Date.now() + 4000; carNext(); }); }
        return;
      }
    }
  }

  function carMount() {
    if (!AC.exams.length) {
      if (AC.node && AC.node.parentNode) AC.node.parentNode.removeChild(AC.node);
      if (AC.hidden) { AC.hidden.style.removeProperty('display'); AC.hidden = null; }
      return;
    }
    var box = findEmpty() || findHostCards();
    if (box) { AC.hidden = box; box.style.setProperty('display', 'none', 'important'); }
    if (!AC.node) carBuild();
    if (AC.hidden && AC.hidden.parentNode && (!AC.node.isConnected || AC.node.previousElementSibling !== AC.hidden)) {
      AC.hidden.parentNode.insertBefore(AC.node, AC.hidden.nextSibling);
    }
    if (AC.hidden) carBindArrows(AC.hidden);
  }

  async function carRefresh(force) {
    if (AC.loading) return;
    if (!force && Date.now() - AC.loadedAt < 60000) return;
    AC.loading = true;
    try {
      var list = await Data.getExams();
      try { AC.covers = await Data.getCovers(); } catch (e) { AC.covers = AC.covers || {}; }
      AC.loadedAt = Date.now();
      list.sort(function (a, b) {
        var ga = CFG.groups.indexOf(a.group), gb = CFG.groups.indexOf(b.group);
        return ((ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb)) || ((a.number || 0) - (b.number || 0));
      });
      if (list.length || AC.sig) notifyNew(list);
      var sig = list.map(function (e) { var c = AC.covers && AC.covers[examKey(e)]; return examKey(e) + e.title + e.questions + e.duration + (c && c.img ? c.ts : ''); }).join('|');
      if (sig !== AC.sig) {
        AC.sig = sig; AC.exams = list;
        if (AC.node && AC.node.parentNode) AC.node.parentNode.removeChild(AC.node);
        AC.node = null; AC.track = null;
      }
    } catch (e) {}
    AC.loading = false;
  }

  function videosHtml() {
    var v = CFG.videos || {}, h = '';
    [['register', 'Necə qeydiyyatdan keçmək olar?'], ['exam', 'İmtahanda necə iştirak olunur?']].forEach(function (x) {
      if (v[x[0]]) h += '<div class="dqa-vd"><div class="dqa-lxt">' + x[1] + '</div><video controls playsinline preload="metadata" src="' + esc(v[x[0]]) + '"></video></div>';
    });
    return h;
  }

  /* istifadəçi elanı özü paylaşır: qapaq şəkli + qeydiyyat linki */
  function shareExam(e) {
    if (!e) return;
    if (window.DQElan && DQElan.quickShare) return DQElan.quickShare(e);
    var url = location.origin + location.pathname + '?qeyd=' + encodeURIComponent(examKey(e));
    var text = '📢 Qeydiyyat elanı\n' + e.title + '\n\nQeydiyyat: ' + url;
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); }
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  /* Bildirişlər: yeni imtahan əlavə olunanda (sayt açılanda) xəbərdarlıq.
     Sayt bağlı ikən telefona push göndərmək üçün server tərəfi (FCM/VAPID) lazımdır. */
  function askNotify(btn) {
    try { Notification.requestPermission().then(function (p) { if (btn && p !== 'default') btn.remove(); }); } catch (e) {}
  }
  function notifyNew(list) {
    if (!CFG.notifyNew) return;
    var seen = ls('dq_ig_seen', null), keys = list.map(examKey);
    lsSet('dq_ig_seen', keys);
    if (!seen) return; /* ilk ziyarətdə xəbərdarlıq yoxdur */
    var fresh = list.filter(function (e) { return seen.indexOf(examKey(e)) < 0; });
    if (!fresh.length) return;
    var e = fresh[0], title = 'Yeni imtahan: ' + e.group + ' · Sınaq ' + e.number, body = 'Qeydiyyat açıqdır. Toxunun və qeydiyyatdan keçin.';
    try {
      if (window.Notification && Notification.permission === 'granted') {
        var open = function () { window.focus(); openRegister(e); };
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, { body: body, icon: 'icon-512.png', tag: 'dq-new-' + examKey(e), data: { url: location.pathname + '?qeyd=' + examKey(e) } }); })
            .catch(function () { var n = new Notification(title, { body: body }); n.onclick = open; });
        } else { var n = new Notification(title, { body: body }); n.onclick = open; }
      }
    } catch (er) {}
    var bn = document.createElement('div'); bn.className = 'dqa-bn';
    bn.innerHTML = '<b>' + esc(title) + '</b><span>' + (fresh.length > 1 ? '+ ' + (fresh.length - 1) + ' yeni imtahan' : 'Qeydiyyat açıqdır') + '</span><button type="button">Qeydiyyat</button><i>×</i>';
    bn.querySelector('button').onclick = function () { bn.remove(); openRegister(e); };
    bn.querySelector('i').onclick = function () { bn.remove(); };
    document.body.appendChild(bn); setTimeout(function () { bn.remove(); }, 12000);
  }

  /* Qeydiyyat portalında (#lxp) aktiv imtahanlar siyahısı: hər birindən qeydiyyatdan keçmək olur */
  function lxpMount() {
    var lx = document.getElementById('lxp'), old = document.getElementById('dqa-lxp');
    if (!lx || !lx.getClientRects().length || !AC.exams.length) { if (old && !AC.exams.length) old.remove(); return; }
    if (old && old.isConnected && old.getAttribute('data-sig') === AC.sig) return;
    if (old) old.remove();
    var w = lx.querySelector('.lxp-w') || lx;
    var sh = shadowHost('dqa-lxp', '<div class="dqa-lx"><h3>Aktiv imtahanlar</h3><div class="dqa-lxs">Seçin və qeydiyyatdan keçin</div>' + AC.exams.map(function (e, i) {
      return '<div class="dqa-lxr"><div><span class="dqa-tag">' + esc(e.group) + ' · Sınaq ' + esc(e.number) + '</span><div class="dqa-lxt">' + esc(e.title) + '</div>' +
        '<div class="dqa-lxm">' + esc(e.questions) + ' sual · ' + esc(e.duration) + ' dəq' + (CFG.prices[e.group] ? ' · ' + CFG.prices[e.group] + ' AZN' : '') + '</div></div>' +
        '<div class="dqa-lxa"><button type="button" class="dqa-lxb" data-i="' + i + '">Qeydiyyatdan keç</button>' +
        '<button type="button" class="dqa-lxb gh" data-s="' + i + '">📣 Paylaş</button></div></div>';
    }).join('') + videosHtml() +
      ((window.Notification && Notification.permission === 'default') ? '<button type="button" class="dqa-lxb gh" data-bell style="width:100%;margin-top:12px">🔔 Yeni imtahanlardan xəbərdar ol</button>' : '') + '</div>');
    sh.host.setAttribute('data-sig', AC.sig);
    sh.sr.addEventListener('click', function (ev) {
      var t = ev.target, x;
      if ((x = t.closest('[data-s]'))) return shareExam(AC.exams[+x.getAttribute('data-s')]);
      if ((x = t.closest('[data-bell]'))) return askNotify(x);
      if ((x = t.closest('[data-i]'))) openRegister(AC.exams[+x.getAttribute('data-i')]);
    });
    w.appendChild(sh.host);
  }

  /* Elan linki: ?qeyd=BB-1 (və ya #qeyd=BB-1) → qeydiyyat pəncərəsi birbaşa açılır */
  function deepLink() {
    var m = /[?&#]qeyd=([^&#]*)/.exec(location.search + location.hash);
    if (!m) return;
    var key = decodeURIComponent(m[1]).toUpperCase();
    Data.getExams().then(function (list) {
      openRegister(list.filter(function (e) { return examKey(e) === key; })[0] || null);
    }).catch(function () { openRegister(null); });
  }

  /* Ana səhifədə iki paneli tək sütuna salır: əvvəl «Aktiv sınaqlar», sonra «Yeniliklər» */
  function textEls(txt) {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), t;
    while ((t = w.nextNode())) {
      var v = t.nodeValue;
      if (v && v.length < 60 && norm(v) === txt && t.parentElement && !t.parentElement.closest('header,nav,#dqa-lxp,#dqg-host')) out.push(t.parentElement);
    }
    return out;
  }
  function lca(a, b) { for (var n = a; n; n = n.parentElement) if (n.contains(b)) return n; return null; }
  function stackPanels() {
    if (!CFG.stackHome) return;
    if (!stackPanels.c || !stackPanels.c.isConnected) {
      var bs = textEls('aktiv sinaqlar ve movzu testleri'), as = textEls('yenilikler'), best = null, bsz = 1e9;
      bs.forEach(function (b) {
        as.forEach(function (a) {
          var c = lca(a, b);
          if (!c || c === document.body || c === document.documentElement || c.id === 'lxp') return;
          var sz = c.getElementsByTagName('*').length;
          if (sz < bsz) { bsz = sz; best = { c: c, a: a, b: b }; }
        });
      });
      if (!best) return;
      stackPanels.c = best.c; stackPanels.a = best.a; stackPanels.b = best.b;
    }
    var c = stackPanels.c, pa = null, pb = null;
    for (var k = 0; k < c.children.length; k++) {
      if (c.children[k].contains(stackPanels.a)) pa = c.children[k];
      if (c.children[k].contains(stackPanels.b)) pb = c.children[k];
    }
    if (!pa || !pb || pa === pb) return;
    var S = function (el, o) { for (var p in o) el.style.setProperty(p, o[p], 'important'); };
    S(c, { display: 'flex', 'flex-direction': 'column', gap: '20px', 'grid-template-columns': 'minmax(0,1fr)', 'align-items': 'stretch' });
    S(pb, { order: '1', width: '100%', 'max-width': 'none', 'min-width': '0', flex: 'none', margin: '0', 'grid-column': 'auto' });
    S(pa, { order: '2', width: '100%', 'max-width': 'none', 'min-width': '0', flex: 'none', margin: '0', 'grid-column': 'auto' });
  }

  function carTick() {
    if (document.hidden) return;
    try { stackPanels(); } catch (e) {}
    carRefresh(false).then(function () { carMount(); lxpMount(); });
  }
  function carStart() {
    if (!CFG.homeCarousel || AC.timer) return;
    AC.timer = setInterval(function () {
      if (document.hidden || Date.now() < AC.pauseUntil || !AC.node || !AC.node.isConnected || AC.exams.length < 2) return;
      carNext();
    }, CFG.carouselMs);
    setInterval(carTick, 1200);
    setTimeout(carTick, 300);
  }

  window.DQImtahanGiris = {
    open: openList,
    close: closeAll,
    register: function () { openRegister(null); },
    config: CFG,
    sb: sbFetch,
    registerFor: function (e) { openRegister(e || null); },
    getExams: function () { return Data.getExams(); },
    startExam: onStartTap,
    saveResult: saveResult,
    getCovers: function () { return Data.getCovers(); },
    refreshHome: function () { return carRefresh(true).then(carMount); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { carStart(); setTimeout(deepLink, 400); });
  else { carStart(); setTimeout(deepLink, 400); }
  if (CFG.autoBind) autoBind();
})();
