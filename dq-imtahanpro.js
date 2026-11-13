/*!
 * DQ Platform — İmtahanPro (admin modulu)
 * Admin paneldən sınaq əlavə et / aktiv et / sil. Burada AKTİV olan sınaqlar
 * İmtahan bölməsindəki «Sizə icazə verilmiş sınaqlar» siyahısında görünür.
 * Məlumat: dq_v2_store, collection="imtahanpro" (data.list)
 * «Qeydiyyatlar» tabı: İmtahan bölməsindən gələn yeni qeydiyyatlar (collection="regs", source="imtahan-bolmesi") gözləməyə düşür;
 * admin kateqoriya + sınaq nömrələrini seçib «İcazə ver» edir (data.allowed = ["BB-1","BB-2"], status="approved").
 * index.html-də admin düyməsi: onclick="window.DQImtahanPro&&DQImtahanPro.open()"
 */
(function () {
  'use strict';
  if (window.DQImtahanPro) return;
  var U = 'https://cpzwliqlgaplroscvduo.supabase.co',
      K = 'sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF',
      COL = 'imtahanpro', GROUPS = ['BB', 'BA', 'AC'];
  var list = [], rowId = null, ov = null, mode = 'list', editing = null, busy = false;
  var tab = 'sinaq', regs = [], regFilter = 'pending', grant = null; /* grant = {id, sel:{}, cat} */

  function hdr(x) { var h = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' }; for (var k in x) h[k] = x[k]; return h; }
  function ft(u, o, ms) {
    var ac = window.AbortController ? new AbortController() : null,
        t = setTimeout(function () { try { ac && ac.abort(); } catch (e) {} }, ms || 9000);
    o = o || {}; if (ac) o.signal = ac.signal;
    return fetch(u, o).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function load() {
    return ft(U + '/rest/v1/dq_v2_store?select=id,data&collection=eq.' + COL + '&order=id.desc&limit=1', { headers: hdr() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (a) {
        if (a && a[0]) { rowId = a[0].id; list = (a[0].data && Array.isArray(a[0].data.list)) ? a[0].data.list : []; }
        else { rowId = null; list = []; }
      });
  }
  function save() {
    var body = JSON.stringify(rowId ? { data: { list: list } } : { collection: COL, data: { list: list } });
    var req = rowId
      ? ft(U + '/rest/v1/dq_v2_store?id=eq.' + rowId, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: body })
      : ft(U + '/rest/v1/dq_v2_store', { method: 'POST', headers: hdr({ Prefer: 'return=representation' }), body: body });
    return req.then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { if (!rowId && t) { try { var a = JSON.parse(t); rowId = a && a[0] && a[0].id; } catch (e) {} } });
  }
  function loadRegs() {
    return ft(U + '/rest/v1/dq_v2_store?select=id,data&collection=eq.regs&order=id.desc&limit=500', { headers: hdr() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (a) {
        regs = (a || []).filter(function (x) { return x && x.data && (x.data.source === 'imtahan-bolmesi'); });
      });
  }
  function patchReg(r, patch, msg) {
    var nd = Object.assign({}, r.data, patch);
    return ft(U + '/rest/v1/dq_v2_store?id=eq.' + r.id, { method: 'PATCH', headers: hdr({ Prefer: 'return=minimal' }), body: JSON.stringify({ data: nd }) })
      .then(function (x) { if (!x.ok) throw new Error(x.status); r.data = nd; render(); toast('✅ ' + msg); })
      .catch(function (e) { toast('Yazıla bilmədi (' + (e && e.message || 'xəta') + ')', 1); });
  }
  function delReg(r) {
    return ft(U + '/rest/v1/dq_v2_store?id=eq.' + r.id, { method: 'DELETE', headers: hdr({ Prefer: 'return=minimal' }) })
      .then(function (x) { if (!x.ok) throw new Error(x.status); regs = regs.filter(function (y) { return y !== r; }); render(); toast('✅ Silindi'); })
      .catch(function (e) { toast('Silinə bilmədi (' + (e && e.message || 'xəta') + ')', 1); });
  }
  function regById(id) { for (var i = 0; i < regs.length; i++) if (String(regs[i].id) === String(id)) return regs[i]; return null; }
  function activeExams(g) { return list.filter(function (x) { return x.active !== false && (!g || x.group === g); }); }
  function key(x) { return x.group + '-' + (+x.number); }
  function fmtDate(t) { if (!t) return ''; var d = new Date(+t); return isNaN(d) ? '' : d.toLocaleDateString('az-AZ') + ' ' + d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }); }
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m, bad) {
    var t = $('ipro-t'); if (!t) return;
    t.textContent = m; t.style.background = bad ? '#b91c1c' : '#0f172a'; t.style.opacity = 1;
    clearTimeout(toast.k); toast.k = setTimeout(function () { t.style.opacity = 0; }, 2600);
  }
  function defTitle(g, n) { return 'Dövlət Qulluğu ' + g + ' kateqoriyası üzrə sınaq ' + n; }
  function sortList() {
    list.sort(function (a, b) {
      return (GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)) || ((+a.number || 0) - (+b.number || 0));
    });
  }
  function exists(g, n, skipIdx) {
    return list.some(function (x, i) { return i !== skipIdx && x.group === g && +x.number === +n; });
  }
  function persist(msg) {
    sortList(); render();
    save().then(function () { if (msg) toast('✅ ' + msg + ' — İmtahan bölməsində dərhal görünəcək'); })
      .catch(function (e) { toast('Yazıla bilmədi (' + (e && e.message || 'xəta') + ')', 1); });
  }

  function css() {
    if ($('ipro-css')) return;
    var s = document.createElement('style'); s.id = 'ipro-css';
    s.textContent =
      '#ipro{position:fixed;inset:0;z-index:100010;background:#eef3fb;overflow:auto;font-family:inherit;color:#12285e;text-align:left;display:none}#ipro.on{display:block}' +
      '#ipro .w{max-width:760px;margin:0 auto;padding:16px 14px 90px}#ipro .top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}#ipro h3{margin:0;font-size:19px;text-align:left}' +
      '#ipro .c{background:#fff;border:1px solid #dbe5f6;border-radius:14px;padding:14px;margin-bottom:10px}#ipro .r{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}' +
      '#ipro .b{border:0;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;color:#fff;background:#0a2f7a;font-family:inherit}#ipro .b.g{background:#16a34a}#ipro .b.x{background:#dc2626}#ipro .b.o{background:#e2e8f0;color:#12285e}#ipro .b.s{padding:7px 12px;font-size:12.5px}#ipro .b[disabled]{opacity:.5}' +
      '#ipro label{display:block;font-size:12.5px;font-weight:700;margin:10px 0 4px}#ipro input[type=text],#ipro input[type=number],#ipro select{width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #c9d6ee;border-radius:9px;font-size:15px;font-family:inherit;background:#fff;color:#12285e}' +
      '#ipro .tg{display:inline-block;padding:2px 9px;border-radius:7px;background:#0a2f7a;color:#fff;font-weight:800;font-size:12px;margin-right:6px}#ipro small{color:#64748b}' +
      '#ipro .st{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:6px}#ipro .st.on{background:#dcfce7;color:#166534}#ipro .st.off{background:#fee2e2;color:#991b1b}' +
      '#ipro .gh{margin:16px 2px 8px;font-size:12px;font-weight:800;letter-spacing:1.2px;color:#0a2f7a}' +
      '#ipro .ck{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0}#ipro .ck label{display:flex;gap:6px;align-items:center;margin:0;font-size:14px}' +
      '#ipro .tabs{display:flex;gap:8px;margin-bottom:12px}#ipro .tabs .b{flex:1;background:#e2e8f0;color:#12285e}#ipro .tabs .b.on{background:#0a2f7a;color:#fff}' +
      '#ipro .chp{display:inline-block;padding:3px 9px;border-radius:8px;background:#eef3fb;border:1px solid #c9d6ee;font-size:12px;font-weight:700;margin:2px 4px 2px 0;color:#0a2f7a}#ipro .code{font-family:ui-monospace,Menlo,monospace;font-weight:800;letter-spacing:.18em;background:#0f172a;color:#fff;padding:2px 9px;border-radius:7px;font-size:13px}' +
      '#ipro .st.w{background:#fef3c7;color:#92400e}#ipro .gb{background:#f8fafc;border:1.5px solid #c9d6ee;border-radius:12px;padding:12px;margin-top:10px}#ipro .gx{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:10px 0}#ipro .gx label{display:flex;gap:8px;align-items:center;margin:0;padding:9px 10px;border:1.5px solid #c9d6ee;border-radius:9px;background:#fff;font-size:14px;cursor:pointer}' +
      '#ipro-t{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);color:#fff;padding:11px 18px;border-radius:99px;font-weight:700;font-size:14px;opacity:0;transition:.3s;z-index:100020;pointer-events:none;max-width:92vw;text-align:center}';
    document.head.appendChild(s);
  }

  function build() {
    if (ov) return; css();
    ov = document.createElement('div'); ov.id = 'ipro'; document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.dataset.a, i = +b.dataset.i;
      if (a === 'close') { ov.classList.remove('on'); document.body.style.overflow = ''; }
      else if (a === 'tab') { tab = b.dataset.t; mode = 'list'; editing = null; grant = null; render(); if (tab === 'reg') refreshRegs(); }
      else if (a === 'rf') { regFilter = b.dataset.f; grant = null; render(); }
      else if (a === 'rrefresh') refreshRegs();
      else if (a === 'gopen') {
        var rr = regById(b.dataset.id); if (!rr) return;
        var sel = {}; (Array.isArray(rr.data.allowed) ? rr.data.allowed : []).forEach(function (k) { sel[k] = 1; });
        if (rr.data.want && !Object.keys(sel).length) sel[rr.data.want] = 1;
        grant = { id: rr.id, sel: sel, cat: (rr.data.group && GROUPS.indexOf(rr.data.group) > -1) ? rr.data.group : GROUPS[0] }; render();
      }
      else if (a === 'gcancel') { grant = null; render(); }
      else if (a === 'gcat') { grant.cat = b.dataset.g; render(); }
      else if (a === 'gall') { activeExams(grant.cat).forEach(function (x) { grant.sel[key(x)] = 1; }); render(); }
      else if (a === 'gnone') { activeExams(grant.cat).forEach(function (x) { delete grant.sel[key(x)]; }); render(); }
      else if (a === 'gok') {
        var r1 = regById(grant.id), keys = Object.keys(grant.sel);
        if (!keys.length) { toast('Ən azı bir sınaq seçin', 1); return; }
        keys.sort(function (p, q) { var A = p.split('-'), B = q.split('-'); return (GROUPS.indexOf(A[0]) - GROUPS.indexOf(B[0])) || (+A[1] - +B[1]); });
        var g0 = keys[0].split('-')[0]; grant = null;
        patchReg(r1, { status: 'approved', allowed: keys, group: g0, sid: 'dqg-' + g0, approvedAt: Date.now() }, 'İcazə verildi (' + keys.length + ' sınaq)');
      }
      else if (a === 'rrevoke') { var r2 = regById(b.dataset.id); if (r2 && confirm(r2.data.name + ' üçün icazə götürülsün?')) patchReg(r2, { status: 'pending', allowed: [] }, 'İcazə götürüldü'); }
      else if (a === 'rdel') { var r3 = regById(b.dataset.id); if (r3 && confirm('“' + r3.data.name + '” qeydiyyatı silinsin?')) delReg(r3); }
      else if (a === 'new') { mode = 'edit'; editing = { idx: -1, v: { group: 'BB', number: nextNum('BB'), title: '', questions: 100, duration: 180, active: true } }; render(); }
      else if (a === 'bulk') { mode = 'bulk'; render(); }
      else if (a === 'edit') { mode = 'edit'; editing = { idx: i, v: Object.assign({}, list[i]) }; render(); }
      else if (a === 'cancel') { mode = 'list'; editing = null; render(); }
      else if (a === 'ok') saveOne();
      else if (a === 'bulkok') saveBulk();
      else if (a === 'del') { if (confirm('“' + titleOf(list[i]) + '” silinsin?')) { list.splice(i, 1); persist('Silindi'); } }
      else if (a === 'tog') { list[i].active = list[i].active === false; persist(list[i].active === false ? 'Deaktiv edildi' : 'Aktiv edildi'); }
      else if (a === 'allon' || a === 'alloff') { list.forEach(function (x) { x.active = a === 'allon'; }); persist(a === 'allon' ? 'Hamısı aktiv edildi' : 'Hamısı deaktiv edildi'); }
      else if (a === 'clear') { if (list.length && confirm('Bütün sınaqlar (' + list.length + ') silinsin?')) { list = []; persist('Siyahı təmizləndi'); } }
    });
    ov.addEventListener('change', function (e) {
      if (grant && e.target.getAttribute && e.target.getAttribute('data-gk')) {
        var k = e.target.getAttribute('data-gk'); if (e.target.checked) grant.sel[k] = 1; else delete grant.sel[k]; render(); return;
      }
      if (e.target.id === 'ipro-group' && editing && editing.idx < 0) { var n = $('ipro-number'); if (n) n.value = nextNum(e.target.value); }
    });
  }
  function nextNum(g) {
    var m = 0; list.forEach(function (x) { if (x.group === g && +x.number > m) m = +x.number; }); return m + 1;
  }
  function titleOf(x) { return x.title || defTitle(x.group, x.number); }

  function saveOne() {
    var v = editing.v;
    v.group = String($('ipro-group').value || '').trim().toUpperCase();
    v.number = Math.max(1, parseInt($('ipro-number').value, 10) || 0);
    v.title = $('ipro-title').value.trim();
    v.questions = Math.max(1, parseInt($('ipro-q').value, 10) || 100);
    v.duration = Math.max(1, parseInt($('ipro-d').value, 10) || 180);
    v.active = $('ipro-active').checked;
    if (!v.group) { toast('Kateqoriyanı yazın', 1); return; }
    if (!v.number) { toast('Sınaq nömrəsini yazın', 1); return; }
    if (exists(v.group, v.number, editing.idx)) { toast(v.group + ' · Sınaq ' + v.number + ' artıq var', 1); return; }
    if (!v.id) v.id = v.group + '-' + v.number;
    else v.id = v.group + '-' + v.number;
    if (editing.idx < 0) list.push(v); else list[editing.idx] = v;
    mode = 'list'; editing = null; persist('Saxlanıldı');
  }
  function saveBulk() {
    var gs = GROUPS.filter(function (g) { return $('ipro-bg-' + g) && $('ipro-bg-' + g).checked; });
    var extra = ($('ipro-bgx').value || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
    extra.forEach(function (g) { if (gs.indexOf(g) < 0) gs.push(g); });
    var from = parseInt($('ipro-bf').value, 10) || 1, to = parseInt($('ipro-bt').value, 10) || from;
    var q = Math.max(1, parseInt($('ipro-bq').value, 10) || 100), d = Math.max(1, parseInt($('ipro-bd').value, 10) || 180);
    var act = $('ipro-ba').checked, added = 0, skipped = 0;
    if (!gs.length) { toast('Ən azı bir kateqoriya seçin', 1); return; }
    if (to < from || to - from > 99) { toast('Nömrə aralığı düzgün deyil', 1); return; }
    gs.forEach(function (g) {
      for (var n = from; n <= to; n++) {
        if (exists(g, n, -1)) { skipped++; continue; }
        list.push({ id: g + '-' + n, group: g, number: n, title: '', questions: q, duration: d, active: act }); added++;
      }
    });
    mode = 'list'; persist(added + ' sınaq əlavə olundu' + (skipped ? ' (' + skipped + ' artıq var idi)' : ''));
  }

  function render() {
    var pend = regs.filter(function (r) { return r.data.status !== 'approved'; }).length;
    var h = '<div class="w"><div class="top"><h3>🎯 İmtahanPro</h3><button class="b o" data-a="close">✕ Bağla</button></div>' +
      '<div class="tabs"><button class="b ' + (tab === 'sinaq' ? 'on' : '') + '" data-a="tab" data-t="sinaq">Sınaqlar</button><button class="b ' + (tab === 'reg' ? 'on' : '') + '" data-a="tab" data-t="reg">Qeydiyyatlar' + (pend ? ' (' + pend + ')' : '') + '</button></div>';
    if (tab === 'reg') { ov.innerHTML = h + renderRegs() + '</div><div id="ipro-t"></div>'; return; }
    if (mode === 'edit' && editing) {
      var v = editing.v;
      h += '<div class="c"><b>' + (editing.idx < 0 ? 'Yeni sınaq' : 'Redaktə') + '</b>' +
        '<label>Kateqoriya (BB, BA, AC…)</label><input id="ipro-group" list="ipro-gl" type="text" value="' + esc(v.group) + '"><datalist id="ipro-gl">' + GROUPS.map(function (g) { return '<option value="' + g + '">'; }).join('') + '</datalist>' +
        '<label>Sınaq nömrəsi</label><input id="ipro-number" type="number" min="1" value="' + esc(v.number) + '">' +
        '<label>Başlıq (boş qalsa avtomatik yazılır)</label><input id="ipro-title" type="text" placeholder="' + esc(defTitle(v.group, v.number)) + '" value="' + esc(v.title || '') + '">' +
        '<label>Sual sayı</label><input id="ipro-q" type="number" min="1" value="' + esc(v.questions) + '">' +
        '<label>Müddət (dəqiqə)</label><input id="ipro-d" type="number" min="1" value="' + esc(v.duration) + '">' +
        '<label style="display:flex;gap:8px;align-items:center"><input id="ipro-active" type="checkbox"' + (v.active !== false ? ' checked' : '') + '> Aktiv — İmtahan bölməsində görünsün</label>' +
        '<div class="r" style="margin-top:14px"><button class="b o" data-a="cancel">Ləğv et</button><button class="b g" data-a="ok">Yadda saxla</button></div></div>';
    } else if (mode === 'bulk') {
      h += '<div class="c"><b>Toplu əlavə</b><label>Kateqoriyalar</label><div class="ck">' +
        GROUPS.map(function (g) { return '<label><input type="checkbox" id="ipro-bg-' + g + '" checked> ' + g + '</label>'; }).join('') + '</div>' +
        '<label>Digər kateqoriya (istəyə görə, vergüllə)</label><input id="ipro-bgx" type="text" placeholder="məs. CC, DD">' +
        '<div class="r"><div style="flex:1"><label>Sınaq nömrəsi: -dən</label><input id="ipro-bf" type="number" min="1" value="1"></div><div style="flex:1"><label>-dək</label><input id="ipro-bt" type="number" min="1" value="5"></div></div>' +
        '<div class="r"><div style="flex:1"><label>Sual sayı</label><input id="ipro-bq" type="number" min="1" value="100"></div><div style="flex:1"><label>Müddət (dəq)</label><input id="ipro-bd" type="number" min="1" value="180"></div></div>' +
        '<label style="display:flex;gap:8px;align-items:center"><input id="ipro-ba" type="checkbox" checked> Aktiv olaraq əlavə et</label>' +
        '<div class="r" style="margin-top:14px"><button class="b o" data-a="cancel">Ləğv et</button><button class="b g" data-a="bulkok">Əlavə et</button></div></div>';
    } else {
      h += '<p style="margin:0 0 12px;font-size:13px;color:#475569;line-height:1.5">Burada <b>aktiv</b> olan sınaqlar imtahan panelində «Sizə icazə verilmiş sınaqlar» siyahısında görünür. Deaktiv və ya silinənlər görünmür.</p>' +
        '<div class="r" style="margin-bottom:12px;justify-content:flex-start"><button class="b g" data-a="new">＋ Yeni sınaq</button><button class="b" data-a="bulk">＋ Toplu əlavə</button><button class="b o s" data-a="allon">Hamısı aktiv</button><button class="b o s" data-a="alloff">Hamısı deaktiv</button><button class="b x s" data-a="clear">Hamısını sil</button></div>';
      if (busy) h += '<div class="c">Yüklənir…</div>';
      else if (!list.length) h += '<div class="c" style="text-align:center;color:#64748b">Hələ sınaq yoxdur. İmtahan bölməsində «aktiv sınaq yoxdur» görünür. «Toplu əlavə» ilə BB/BA/AC üzrə sınaqları bir toxunuşla əlavə edə bilərsiniz.</div>';
      var last = null;
      list.forEach(function (s, i) {
        if (s.group !== last) { last = s.group; h += '<div class="gh">' + esc(s.group) + ' KATEQORİYASI</div>'; }
        var on = s.active !== false;
        h += '<div class="c"><div class="r"><div><span class="tg">' + esc(s.group) + '</span><b>Sınaq ' + esc(s.number) + '</b><span class="st ' + (on ? 'on' : 'off') + '">' + (on ? 'Aktiv' : 'Deaktiv') + '</span><br><small>' + esc(titleOf(s)) + '<br>' + esc(s.questions) + ' sual · ' + esc(s.duration) + ' dəq</small></div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="b s ' + (on ? 'o' : 'g') + '" data-a="tog" data-i="' + i + '">' + (on ? '⏸ Deaktiv' : '▶ Aktiv et') + '</button><button class="b s" data-a="edit" data-i="' + i + '">✏️</button><button class="b s x" data-a="del" data-i="' + i + '">🗑</button></div></div></div>';
      });
    }
    ov.innerHTML = h + '</div><div id="ipro-t"></div>';
  }

  function renderRegs() {
    var cnt = { pending: 0, approved: 0 };
    regs.forEach(function (r) { cnt[r.data.status === 'approved' ? 'approved' : 'pending']++; });
    var h = '<div class="r" style="margin-bottom:12px;justify-content:flex-start">' +
      [['pending', '⏳ Gözləyən (' + cnt.pending + ')'], ['approved', '✅ Təsdiqlənmiş (' + cnt.approved + ')'], ['all', 'Hamısı']].map(function (f) {
        return '<button class="b s ' + (regFilter === f[0] ? '' : 'o') + '" data-a="rf" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
      '<button class="b s o" data-a="rrefresh">↻ Yenilə</button></div>';
    if (busy) return h + '<div class="c">Yüklənir…</div>';
    var rows = regs.filter(function (r) { var ok = r.data.status === 'approved'; return regFilter === 'all' || (regFilter === 'approved') === ok; });
    if (!rows.length) return h + '<div class="c" style="text-align:center;color:#64748b">' + (regFilter === 'pending' ? 'Gözləyən qeydiyyat yoxdur.' : 'Qeydiyyat tapılmadı.') + '</div>';
    rows.forEach(function (r) {
      var d = r.data, ok = d.status === 'approved', open = grant && String(grant.id) === String(r.id);
      var al = Array.isArray(d.allowed) ? d.allowed : [];
      h += '<div class="c"><div class="r"><div><b style="font-size:16px">' + esc(d.name) + '</b><span class="st ' + (ok ? 'on' : 'w') + '">' + (ok ? 'Təsdiqlənib' : 'Gözləyir') + '</span><br>' +
        '<span class="code">' + esc(d.fin) + '</span> <small>· ' + esc(d.group || '—') + ' · ' + (d.price != null ? esc(d.price) + '₼' : '') + (d.payment ? ' · ödəniş qeyd olunub' : '') + '</small><br>' +
        '<small>' + esc(fmtDate(d.ts)) + (d.want ? ' · istədiyi sınaq: <b>' + esc(d.want.replace('-', ' · Sınaq ')) + '</b>' : '') + '</small>' +
        (al.length ? '<div style="margin-top:6px">' + al.map(function (k) { return '<span class="chp">' + esc(k.replace('-', ' · ')) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="b s g" data-a="gopen" data-id="' + esc(r.id) + '">' + (ok ? '✏️ İcazələr' : '✔ İcazə ver') + '</button>' +
        (ok ? '<button class="b s o" data-a="rrevoke" data-id="' + esc(r.id) + '">⏸ Götür</button>' : '') +
        '<button class="b s x" data-a="rdel" data-id="' + esc(r.id) + '">🗑</button></div></div>';
      if (open) {
        var ex = activeExams(grant.cat);
        h += '<div class="gb"><b>Kateqoriya və sınaq nömrəsini seçin</b><div style="display:flex;gap:6px;margin:10px 0 0">' +
          GROUPS.map(function (g) { var n = Object.keys(grant.sel).filter(function (k) { return k.indexOf(g + '-') === 0; }).length;
            return '<button class="b s ' + (grant.cat === g ? '' : 'o') + '" data-a="gcat" data-g="' + g + '">' + g + (n ? ' (' + n + ')' : '') + '</button>'; }).join('') + '</div>' +
          (ex.length ? '<div class="gx">' + ex.map(function (x) { var k = key(x);
              return '<label><input type="checkbox" data-gk="' + k + '"' + (grant.sel[k] ? ' checked' : '') + '> Sınaq ' + esc(x.number) + '</label>'; }).join('') + '</div>'
            : '<p style="color:#64748b;font-size:13px">Bu kateqoriyada aktiv sınaq yoxdur. «Sınaqlar» tabından əlavə edin.</p>') +
          '<div class="r"><div style="display:flex;gap:6px"><button class="b s o" data-a="gall">Hamısı</button><button class="b s o" data-a="gnone">Heç biri</button></div>' +
          '<div style="display:flex;gap:6px"><button class="b s o" data-a="gcancel">Ləğv et</button><button class="b s g" data-a="gok">İcazə ver</button></div></div></div>';
      }
      h += '</div>';
    });
    return h;
  }
  function refreshRegs() {
    busy = true; render();
    Promise.all([load().catch(function () {}), loadRegs()]).then(function () { busy = false; sortList(); render(); })
      .catch(function () { busy = false; render(); toast('Bazadan oxuna bilmədi', 1); });
  }

  window.DQImtahanPro = {
    open: function () {
      if (!(window.DQAdminGate && DQAdminGate.is())) return;
      build(); ov.classList.add('on'); document.body.style.overflow = 'hidden';
      mode = 'list'; editing = null; tab = 'sinaq'; grant = null; busy = true; render();
      Promise.all([load(), loadRegs().catch(function () {})]).then(function () { busy = false; sortList(); render(); })
        .catch(function () { busy = false; render(); toast('Bazadan oxuna bilmədi', 1); });
    }
  };
})();
