/*!
 * DQ Platform — İmtahan bölməsi: sınaq siyahısı + qeydiyyat + 3 addımlı giriş
 * Müstəqil fayl. index.html-in sonunda (app.js-dən sonra) əlavə edin:
 *   <script src="dq-imtahan-giris.js"></script>
 *
 * İstəyə görə tənzimləmə (bu faylı yükləməzdən əvvəl):
 *   window.DQ_IG_CONFIG = {
 *     whatsapp: '994504305162',
 *     prices: { BB: 10, BA: 13, AC: 15 },
 *     requireApproval: false,         // true → admin təsdiqi olmadan başlamaq olmaz
 *     getExams:   async () => [...],  // sistemdəki sınaqlar
 *     findUser:   async (code) => user|null,
 *     saveUser:   async (user) => {},
 *     onStart:    (exam, user) => {}  // imtahanı başladan funksiyanız
 *   };
 */
(function () {
  'use strict';
  if (window.DQImtahanGiris) return;

  var CFG = Object.assign({
    whatsapp: '994504305162',
    prices: { BB: 10, BA: 13, AC: 15 },
    duration: 180,
    questionCount: 100,
    requireApproval: false,
    autoBind: true,
    groups: ['BB', 'BA', 'AC'],
    examCount: 5,
    storageUsers: 'dq_ig_users',
    storageSession: 'dq_ig_session'
  }, window.DQ_IG_CONFIG || {});

  /* ---------- köməkçilər ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ls(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // qarışan simvollar (0,O,1,I) yoxdur
  function genCode(existing) {
    var code, tries = 0;
    do {
      code = '';
      var arr = new Uint32Array(7);
      (window.crypto || window.msCrypto).getRandomValues(arr);
      for (var i = 0; i < 7; i++) code += ALPHA[arr[i] % ALPHA.length];
      tries++;
    } while (existing && existing[code] && tries < 50);
    return code;
  }

  /* ---------- məlumat qatı (öz bazanıza qoşmaq üçün hook-lar) ---------- */
  var Data = {
    async getExams() {
      if (typeof CFG.getExams === 'function') return await CFG.getExams();
      var list = [];
      for (var n = 1; n <= CFG.examCount; n++) {
        CFG.groups.forEach(function (g) {
          list.push({ id: g + '-' + n, group: g, number: n,
            title: 'Dövlət Qulluğu ' + g + ' kateqoriyası üzrə sınaq ' + n,
            questions: CFG.questionCount, duration: CFG.duration });
        });
      }
      return list;
    },
    async findUser(code) {
      code = String(code || '').trim().toUpperCase();
      if (typeof CFG.findUser === 'function') return await CFG.findUser(code);
      return (ls(CFG.storageUsers, {}))[code] || null;
    },
    async saveUser(u) {
      var all = ls(CFG.storageUsers, {});
      all[u.code] = u; lsSet(CFG.storageUsers, all);
      if (typeof CFG.saveUser === 'function') { try { await CFG.saveUser(u); } catch (e) { console.warn('saveUser', e); } }
    },
    localCodes: function () { return ls(CFG.storageUsers, {}); },
    hasRegistration: function () { return !!ls(CFG.storageSession, null) || Object.keys(ls(CFG.storageUsers, {})).length > 0; }
  };

  /* ---------- üslub (sistemin tünd göy + qızılı dizaynı) ---------- */
  var CSS = '\
.dqg-page{position:fixed;inset:0;z-index:99990;overflow:auto;background:linear-gradient(180deg,#0b1a40,#06112c);color:#e9eefb;font-family:inherit;-webkit-overflow-scrolling:touch}\
.dqg-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0c1f4d;border-bottom:2px solid #c9a24a}\
.dqg-brand b{display:block;color:#f3d47a;font-size:16px}.dqg-brand small{color:#9fb0d6;font-size:10px;letter-spacing:.12em}\
.dqg-x{border:1px solid #c9a24a;color:#f3d47a;background:transparent;border-radius:10px;padding:7px 14px;font-size:13px;cursor:pointer}\
.dqg-wrap{max-width:820px;margin:0 auto;padding:16px 14px 40px}\
.dqg-h{color:#e0b648;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:6px 0 12px}\
.dqg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}\
@media(max-width:320px){.dqg-grid{grid-template-columns:1fr}}\
.dqg-card{background:linear-gradient(160deg,#12295f,#0e2250);border:1px solid #243d7a;border-radius:16px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.28)}\
.dqg-card-b{padding:12px 12px 10px}.dqg-card h4{margin:0 0 4px;font-size:13px;line-height:1.3;color:#fff}\
.dqg-st{font-size:11px;color:#8fa3cf;margin-bottom:8px}.dqg-meta{font-size:11px;color:#c3cfe8;line-height:1.7}.dqg-meta b{color:#fff}\
.dqg-card-f{padding:10px 12px 12px;border-top:1px solid #1d3570}\
.dqg-gold{display:block;width:100%;border:0;border-radius:10px;padding:10px;font-weight:700;font-size:13px;color:#13203f;cursor:pointer;background:linear-gradient(180deg,#f3d47a,#d4a73c);box-shadow:0 4px 12px rgba(212,167,60,.28)}\
.dqg-gold[disabled]{opacity:.45;cursor:not-allowed;box-shadow:none}\
.dqg-ov{position:fixed;inset:0;z-index:99999;background:rgba(3,8,22,.72);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px)}\
@media(min-width:600px){.dqg-ov{align-items:center}}\
.dqg-modal{width:100%;max-width:460px;max-height:94vh;overflow:auto;background:linear-gradient(180deg,#112a63,#0b1c47);border:1px solid #2b4690;border-radius:20px 20px 0 0;padding:20px 18px 16px;color:#e9eefb;box-shadow:0 -10px 40px rgba(0,0,0,.5)}\
@media(min-width:600px){.dqg-modal{border-radius:20px}}\
.dqg-modal h3{margin:0 0 6px;text-align:center;font-size:18px;color:#f3d47a}\
.dqg-chip{display:table;margin:0 auto 14px;font-size:12px;padding:5px 12px;border:1px solid #2b4690;border-radius:10px;color:#b7c5e6;background:#0d2152}.dqg-chip b{color:#fff}\
.dqg-p{font-size:13px;color:#b7c5e6;line-height:1.55;margin:0 0 12px}\
.dqg-lbl{display:block;font-size:12px;color:#c3cfe8;margin:10px 0 5px}\
.dqg-in{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid #2b4690;background:#0a1a42;color:#fff;font-size:15px;outline:none}\
.dqg-in:focus{border-color:#e0b648}.dqg-code{text-align:center;letter-spacing:.35em;font-weight:800;text-transform:uppercase}\
.dqg-box{border:1px solid #2b4690;background:#0d2152;border-radius:14px;padding:13px 14px;margin:10px 0;font-size:13px;line-height:1.6;color:#c3cfe8}.dqg-box b{color:#fff}\
.dqg-box ul{margin:6px 0 0;padding-left:18px}.dqg-box li{margin-bottom:6px}\
.dqg-big{font-size:22px;font-weight:800;letter-spacing:.3em;color:#f3d47a;text-align:center;margin:6px 0}\
.dqg-pay{display:flex;gap:6px;margin-top:8px}.dqg-pay span{flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:#0a1a42;border:1px solid #2b4690;font-size:12px}\
.dqg-pay span.on{border-color:#e0b648;color:#f3d47a;font-weight:700}\
.dqg-err{color:#ff9c9c;font-size:12.5px;margin:8px 0 0;min-height:16px}\
.dqg-ok{color:#7be0ae}\
.dqg-row{display:flex;gap:10px;margin-top:14px}.dqg-row>*{flex:1}\
.dqg-ghost{border:1px solid #2b4690;background:transparent;color:#d6e0f7;border-radius:12px;padding:12px;font-size:14px;cursor:pointer}\
.dqg-chk{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#d6e0f7;margin:12px 0 0;cursor:pointer;line-height:1.5}\
.dqg-chk input{width:20px;height:20px;margin-top:1px;accent-color:#e0b648;flex:none}\
.dqg-steps{display:flex;align-items:center;margin:18px 6px 2px}\
.dqg-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:#1a2f6a;color:#8fa3cf;flex:none}\
.dqg-dot.act{background:#f3d47a;color:#13203f;box-shadow:0 0 0 4px rgba(243,212,122,.18)}.dqg-dot.done{background:#25b07a;color:#fff}\
.dqg-line{flex:1;height:3px;background:#1a2f6a;margin:0 6px;border-radius:2px}.dqg-line.done{background:#25b07a}\
.dqg-empty{text-align:center;padding:10px 0}.dqg-empty .ic{font-size:34px}\
';
  function injectCss() {
    if (document.getElementById('dqg-css')) return;
    var s = document.createElement('style'); s.id = 'dqg-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- sınaq siyahısı səhifəsi ---------- */
  var page = null;
  async function openList() {
    injectCss(); closeList();
    var exams = await Data.getExams();
    exams.sort(function (a, b) { return (a.number - b.number) || (CFG.groups.indexOf(a.group) - CFG.groups.indexOf(b.group)); });
    var u = ls(CFG.storageSession, null);
    page = document.createElement('div'); page.className = 'dqg-page';
    page.innerHTML =
      '<div class="dqg-top"><div class="dqg-brand"><b>DQ Platform</b><small>DÖVLƏT QULLUĞU SINAQ İMTAHANI</small></div>' +
      '<button class="dqg-x" data-x>Bağla</button></div>' +
      '<div class="dqg-wrap">' +
      (u ? '<div class="dqg-box"><b>' + esc(u.ad + ' ' + u.soyad) + '</b><br>İş nömrəsi: <b>' + esc(u.code) + '</b></div>' : '') +
      '<div class="dqg-h">Sistemdəki sınaqlar</div><div class="dqg-grid">' +
      exams.map(function (e, i) {
        return '<div class="dqg-card"><div class="dqg-card-b"><h4>' + esc(e.title) + '</h4>' +
          '<div class="dqg-st">Başlanmayıb</div><div class="dqg-meta">Sual sayı: <b>' + esc(e.questions) + '</b><br>Müddət: <b>' + esc(e.duration) + ' Dəqiqə</b></div></div>' +
          '<div class="dqg-card-f"><button class="dqg-gold" data-i="' + i + '">Başla</button></div></div>';
      }).join('') + '</div></div>';
    document.body.appendChild(page);
    page.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-x]')) return closeList();
      var b = ev.target.closest('[data-i]');
      if (b) onStartTap(exams[+b.getAttribute('data-i')]);
    });
  }
  function closeList() { if (page) { page.remove(); page = null; } }

  /* ---------- Başla toxunuşu ---------- */
  function onStartTap(exam) {
    if (!Data.hasRegistration()) return showNotRegistered(exam);
    openWizard(exam);
  }

  /* ---------- modal köməkçisi ---------- */
  function modal(html) {
    var ov = document.createElement('div'); ov.className = 'dqg-ov';
    ov.innerHTML = '<div class="dqg-modal">' + html + '</div>';
    document.body.appendChild(ov);
    return { ov: ov, box: ov.firstChild, close: function () { ov.remove(); } };
  }
  function stepper(n) {
    var h = '<div class="dqg-steps">';
    for (var i = 1; i <= 3; i++) {
      var c = i < n ? 'done' : i === n ? 'act' : '';
      h += '<div class="dqg-dot ' + c + '">' + (i < n ? '✓' : i) + '</div>';
      if (i < 3) h += '<div class="dqg-line ' + (i < n ? 'done' : '') + '"></div>';
    }
    return h + '</div>';
  }
  function chip(exam) { return '<div class="dqg-chip">Qrup: <b>' + esc(exam.group) + '</b> &nbsp;|&nbsp; Sınaq: <b>' + esc(exam.number || exam.title) + '</b></div>'; }

  /* ---------- qeydiyyatsız: xəbərdarlıq ---------- */
  function showNotRegistered(exam) {
    var m = modal('<div class="dqg-empty"><div class="ic">📝</div><h3>Qeydiyyatdan keçin</h3>' +
      '<p class="dqg-p">Sınağa başlamaq üçün əvvəlcə qeydiyyatdan keçməlisiniz.</p></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-have>İş nömrəm var</button><button class="dqg-gold" data-reg>Qeydiyyatdan keç</button></div>');
    m.box.querySelector('[data-reg]').onclick = function () { m.close(); openRegister(exam); };
    m.box.querySelector('[data-have]').onclick = function () { m.close(); openWizard(exam); };
    m.ov.addEventListener('click', function (e) { if (e.target === m.ov) m.close(); });
  }

  /* ---------- qeydiyyat ---------- */
  function openRegister(exam) {
    var group = (exam && exam.group) || CFG.groups[0];
    var m = modal('<h3>Qeydiyyat</h3>' + (exam ? chip(exam) : '') +
      '<p class="dqg-p">Ad və soyadınızı yazın. İş nömrəniz avtomatik yaradılacaq.</p>' +
      '<label class="dqg-lbl">Adınız</label><input class="dqg-in" id="dqgAd" autocomplete="given-name">' +
      '<label class="dqg-lbl">Soyadınız</label><input class="dqg-in" id="dqgSoy" autocomplete="family-name">' +
      '<label class="dqg-lbl">Qrup</label><div class="dqg-pay" id="dqgG">' +
      CFG.groups.map(function (g) { return '<span data-g="' + g + '" class="' + (g === group ? 'on' : '') + '">' + g + ' — ' + CFG.prices[g] + '₼</span>'; }).join('') + '</div>' +
      '<div class="dqg-err" id="dqgErr"></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-gold" data-n>Davam et</button></div>');
    var q = function (s) { return m.box.querySelector(s); };
    q('#dqgG').onclick = function (e) {
      var s = e.target.closest('[data-g]'); if (!s) return;
      group = s.getAttribute('data-g');
      [].forEach.call(q('#dqgG').children, function (x) { x.classList.toggle('on', x === s); });
    };
    q('[data-c]').onclick = m.close;
    q('[data-n]').onclick = function () {
      var ad = q('#dqgAd').value.trim(), soy = q('#dqgSoy').value.trim();
      if (ad.length < 2 || soy.length < 2) { q('#dqgErr').textContent = 'Ad və soyadı düzgün daxil edin.'; return; }
      var user = { code: genCode(Data.localCodes()), ad: ad, soyad: soy, group: group,
        price: CFG.prices[group], status: 'pending', createdAt: new Date().toISOString() };
      m.close(); showPayment(user, exam);
    };
  }

  /* ---------- ödəniş məlumatı + WhatsApp ---------- */
  function showPayment(user, exam) {
    var m = modal('<h3>Qeydiyyat tamamlandı</h3>' +
      '<div class="dqg-box"><b>' + esc(user.ad + ' ' + user.soyad) + '</b><br>İş nömrəniz:<div class="dqg-big">' + esc(user.code) + '</div>' +
      '<span style="font-size:12px">Bu nömrəni saxlayın — imtahana bununla daxil olacaqsınız.</span></div>' +
      '<div class="dqg-box"><b>Ödəniş</b><div class="dqg-pay">' +
      CFG.groups.map(function (g) { return '<span class="' + (g === user.group ? 'on' : '') + '">' + g + ' ' + CFG.prices[g] + '₼</span>'; }).join('') + '</div>' +
      '<p class="dqg-p" style="margin:10px 0 0">Seçdiyiniz qrup (<b>' + esc(user.group) + '</b>) üzrə ödəniş <b>' + user.price + '₼</b> təşkil edir. ' +
      '“Razıyam” düyməsinə toxunduqda WhatsApp-da hazır mesaj açılacaq.</p></div>' +
      '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-gold" data-ok>Razıyam</button></div>');
    m.box.querySelector('[data-c]').onclick = m.close;
    m.box.querySelector('[data-ok]').onclick = async function () {
      var btn = this; btn.disabled = true;
      user.payment = 'qeyd olundu';
      await Data.saveUser(user);
      lsSet(CFG.storageSession, user);
      var text = 'Salam! DQ Platform sınaq imtahanı üçün qeydiyyatdan keçdim.\n' +
        'Ad Soyad: ' + user.ad + ' ' + user.soyad + '\n' +
        'İş nömrəsi: ' + user.code + '\n' +
        'Qrup: ' + user.group + '\n' +
        'Ödəniş: ' + user.price + '₼\n' +
        'Ödənişi edirəm, təsdiq üçün yazıram.';
      window.open('https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(text), '_blank');
      m.close();
      if (page) openList();
    };
  }

  /* ---------- 3 addımlı giriş ---------- */
  function openWizard(exam) {
    var user = null, step = 1;
    var m = modal('<div id="dqgBody"></div>');
    var body = m.box.querySelector('#dqgBody');
    m.ov.addEventListener('click', function (e) { if (e.target === m.ov) m.close(); });

    function head() { return '<h3>İmtahana Giriş</h3>' + chip(exam); }

    function render() {
      if (step === 1) {
        body.innerHTML = head() +
          '<p class="dqg-p">Zəhmət olmasa, 7 simvollu iş nömrənizi daxil edin.</p>' +
          '<label class="dqg-lbl">Şəxsi iş nömrəsi</label>' +
          '<input class="dqg-in dqg-code" id="dqgCode" maxlength="7" placeholder="7 simvollu kod" autocomplete="off" autocapitalize="characters">' +
          '<div class="dqg-err" id="dqgErr"></div>' +
          '<div class="dqg-row"><button class="dqg-ghost" data-c>Ləğv et</button><button class="dqg-gold" data-n>Davam et</button></div>' + stepper(1);
        var inp = body.querySelector('#dqgCode');
        var s = ls(CFG.storageSession, null); if (s) inp.value = s.code;
        body.querySelector('[data-c]').onclick = m.close;
        body.querySelector('[data-n]').onclick = async function () {
          var err = body.querySelector('#dqgErr'); err.textContent = '';
          var code = inp.value.trim().toUpperCase();
          if (code.length !== 7) { err.textContent = 'İş nömrəsi 7 simvol olmalıdır.'; return; }
          var u = await Data.findUser(code);
          if (!u) {
            err.innerHTML = 'Bu iş nömrəsi tapılmadı. <a href="#" data-reg style="color:#f3d47a">Qeydiyyatdan keç</a>';
            err.querySelector('[data-reg]').onclick = function (e) { e.preventDefault(); m.close(); openRegister(exam); };
            return;
          }
          if (CFG.requireApproval && u.status !== 'approved') { err.textContent = 'Qeydiyyatınız hələ admin tərəfindən təsdiqlənməyib. Ödənişi tamamlayıb təsdiq gözləyin.'; return; }
          user = u; lsSet(CFG.storageSession, u); step = 2; render();
        };
      } else if (step === 2) {
        body.innerHTML = head() +
          '<p class="dqg-p">Məlumatların düzgünlüyünə əminsiniz?</p>' +
          '<div class="dqg-box">Tələbə: <b style="font-size:16px">' + esc(user.ad + ' ' + user.soyad) + '</b><br>' +
          'İş nömrəsi: <b>' + esc(user.code) + '</b></div>' +
          '<div class="dqg-row"><button class="dqg-ghost" data-b>Geri</button><button class="dqg-gold" data-n>Bəli, Davam et</button></div>' + stepper(2);
        body.querySelector('[data-b]').onclick = function () { step = 1; render(); };
        body.querySelector('[data-n]').onclick = function () { step = 3; render(); };
      } else {
        body.innerHTML = head() +
          '<div class="dqg-box"><b>İmtahan Qaydaları:</b><ul>' +
          '<li>Sınaq suallarını hər hansı qrupda paylaşmaq, 3-cü şəxslərə göndərmək <b>qadağandır</b>.</li>' +
          '<li>Bu sınaqda <b>xarici mənbələrdən</b> (müəllim köməyi, tələbədən-tələbəyə, kitab, internet resurslarından) istifadə <b>qadağandır</b>.</li>' +
          '<li>Sınaq müddəti: <b>' + esc(exam.duration || CFG.duration) + ' dəqiqə</b>.</li>' +
          '<li>İmtahan səhifəsindən çıxış etsəniz belə, geri sayım taymeri davam edir. Hər hansı bir imtahan şərti pozulduqda imtahan dayandırılacaqdır.</li></ul></div>' +
          '<label class="dqg-chk"><input type="checkbox" id="dqgAgree"><span>Bütün qaydaları oxudum və <b>qaydalarla razıyam</b>.</span></label>' +
          '<div class="dqg-row"><button class="dqg-ghost" data-b>Geri</button><button class="dqg-gold" data-go disabled>▷ İmtahana Başla</button></div>' + stepper(3);
        var cb = body.querySelector('#dqgAgree'), go = body.querySelector('[data-go]');
        cb.onchange = function () { go.disabled = !cb.checked; };
        body.querySelector('[data-b]').onclick = function () { step = 2; render(); };
        go.onclick = function () { m.close(); closeList(); startExam(exam, user); };
      }
    }
    render();
  }

  /* ---------- imtahanı başlat ---------- */
  function startExam(exam, user) {
    var detail = { exam: exam, user: user, group: exam.group, number: exam.number };
    try { window.dispatchEvent(new CustomEvent('dq:start-exam', { detail: detail })); } catch (e) {}
    if (typeof CFG.onStart === 'function') return CFG.onStart(exam, user);
    // Mövcud sisteminizdəki başlatma funksiyasına qoşulma (varsa)
    var fn = window.startExam || window.dqStartExam || window.startSinaq || window.baslaSinaq;
    if (typeof fn === 'function') return fn(exam.group, exam.number, user.code, user);
    console.warn('DQ İmtahan: onStart verilməyib — dq:start-exam hadisəsi göndərildi.', detail);
  }

  /* ---------- İmtahan tabına avtomatik qoşulma ---------- */
  function autoBind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('a,button,[role="tab"],li,[data-tab],[data-page]');
      if (!t || t.closest('.dqg-page,.dqg-ov')) return;
      var txt = (t.textContent || '').trim().toLowerCase();
      var key = ((t.getAttribute('data-tab') || t.getAttribute('data-page') || '') + '').toLowerCase();
      if (txt === 'i̇mtahan' || txt === 'imtahan' || txt === 'i̇mtahan'.normalize() || key === 'imtahan' || key === 'exam') {
        e.preventDefault(); e.stopImmediatePropagation(); openList();
      }
    }, true);
  }

  window.DQImtahanGiris = { open: openList, close: closeList, register: function () { openRegister(null); }, config: CFG };
  if (CFG.autoBind) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoBind); else autoBind();
  }
})();
