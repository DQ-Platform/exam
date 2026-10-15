/* =====================================================================
   DQ Platform — PANEL V2 (mobil tətbiq görünüşü)
   Mövcud Y2 (ysl2) panelinin üzərinə qoyulur; heç bir mövcud funksiya silinmir.
   Əlavə edir: 5 bölməli alt naviqasiya (Ana səhifə · Quizlər · ✦ AI idxal · Qruplar · Profil),
   birləşmiş «Quizlər / İmtahanlar» səhifəsi (axtarış + status çipləri), «Nə yaratmaq istəyirsiniz?» pəncərəsi,
   yenilənmiş «PDF-dən idxal» ekranı, Profil menyusu və 2 addımlı imtahan sihirbazının yeni dizaynı.
   ===================================================================== */
(function () {
  "use strict";
  var Y = window.Y2;
  if (!Y || Y.__pv2) return;
  Y.__pv2 = 1;
  var $ = function (i) { return document.getElementById(i); };
  var e = function (s) { return (window.V2 && V2.esc) ? V2.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fd = function (x) { return x ? new Date(x).toLocaleString("az-AZ") : "—"; };
  var js = function (v) { return JSON.stringify(v).replace(/"/g, "&quot;"); };
  Y.pv = Y.pv || { f: "Hamısı", q: "" };

  /* ---------------- CSS ---------------- */
  var css = '#y2.pv2{background:#f4f6fb;font-family:Inter,system-ui,sans-serif}'
    + '#y2.pv2 h1{font-size:34px;letter-spacing:-.03em;margin:6px 0 8px}#y2.pv2 h2{font-size:22px;letter-spacing:-.02em}'
    + '#y2.pv2 .y2-main{padding-bottom:120px}'
    + '.pv2-hd{display:flex;justify-content:space-between;align-items:center;gap:10px}'
    + '.pv2-new{border:0;border-radius:999px;background:#0b5fff;color:#fff;font-weight:800;font-size:16px;padding:14px 22px;cursor:pointer;box-shadow:0 8px 20px #0b5fff44}'
    + '.pv2-seg{display:flex;background:#e6ebf4;border-radius:22px;padding:6px;margin:16px 0}.pv2-seg button{flex:1;border:0;background:transparent;border-radius:17px;padding:14px;font-weight:800;font-size:16px;color:#64748b;cursor:pointer}.pv2-seg button.on{background:#fff;color:#0f172a;box-shadow:0 2px 10px #0f172a1a}'
    + '.pv2-s{width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:22px;padding:17px 20px;font-size:17px;font-family:inherit;box-sizing:border-box}'
    + '.pv2-ch{display:flex;gap:10px;overflow-x:auto;padding:14px 0;scrollbar-width:none}.pv2-ch::-webkit-scrollbar{display:none}.pv2-ch button{white-space:nowrap;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:12px 20px;font-weight:700;font-size:16px;color:#334155;cursor:pointer}.pv2-ch button.on{background:#0f172a;color:#fff;border-color:#0f172a}.pv2-ch b{opacity:.6;margin-left:6px}'
    + '.pv2-c{background:#fff;border:1px solid #e8edf5;border-radius:22px;padding:18px;margin-bottom:12px;box-shadow:0 2px 10px #0f172a0a}.pv2-c h3{margin:0 0 4px;font-size:18px}.pv2-m{color:#64748b;font-size:14px;margin:2px 0}'
    + '.pv2-r{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}'
    + '.pv2-bd{border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;background:#e0e7ff;color:#1d4ed8}.pv2-bd.Aktiv{background:#dcfce7;color:#15803d}.pv2-bd.Qaralama,.pv2-bd.Gözləyən{background:#fef3c7;color:#b45309}.pv2-bd.Bitmiş{background:#f1f5f9;color:#64748b}'
    + '.pv2-bt{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;color:#0f172a}.pv2-bt.r{color:#dc2626;border-color:#fecaca}.pv2-code{font-family:ui-monospace,monospace;font-weight:800;background:#eff6ff;color:#1d4ed8;border-radius:10px;padding:4px 10px}'
    + '.pv2-em{text-align:center;color:#64748b;font-size:18px;padding:70px 10px}'
    /* sheet */
    + '.y2-md:has(.pv2-sh){align-items:flex-end;padding:0}.y2-md>div.pv2-sh{border-radius:32px 32px 0 0;max-width:720px;margin:0 auto;padding:12px 22px 28px}'
    + '.pv2-grab{width:56px;height:6px;border-radius:9px;background:#d9e0ec;margin:0 auto 18px}.pv2-shh{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.pv2-shh h2{margin:0;font-size:26px}.pv2-shh button{width:60px;height:60px;border-radius:50%;border:0;background:#eef2f7;font-size:22px;cursor:pointer}'
    + '.pv2-ch2{display:flex;gap:16px;align-items:center;border:2px solid #e3e8f0;border-radius:28px;padding:20px;margin-bottom:14px;cursor:pointer;background:#fff;width:100%;text-align:left;font-family:inherit}.pv2-ic{flex:none;width:68px;height:68px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800}.pv2-ch2 b{display:block;font-size:21px;margin-bottom:4px}.pv2-ch2 span.t{color:#64748b;font-size:15px;line-height:1.4}.pv2-ch2 i.ar{margin-left:auto;font-style:normal;color:#64748b;font-size:24px}'
    /* wizard */
    + '.y2-md>div:has(.y2-steps){border-radius:28px 28px 0 0;max-width:720px;margin:auto auto 0}.y2-steps{display:flex;gap:8px;background:#eef2f7;border-radius:22px;padding:8px;margin:14px 0}.y2-steps b{flex:1;display:flex;gap:8px;align-items:center;justify-content:center;border-radius:16px;padding:12px 6px;font-size:14px;color:#64748b;white-space:nowrap}.y2-steps b.on{background:#fff;color:#0f172a;box-shadow:0 2px 8px #0f172a14}'
    /* pdf */
    + '.pv2-drop{display:flex!important;flex-direction:column;align-items:center;gap:10px;text-align:center;border:2px dashed #9db4f0!important;background:#eef3ff!important;border-radius:30px!important;padding:44px 16px!important;cursor:pointer}.pv2-up{width:84px;height:84px;border-radius:26px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;color:#0b5fff;box-shadow:0 4px 14px #0b5fff22}.pv2-drop b{font-size:22px}'
    + '.pv2-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}.pv2-3 div{background:#fff;border:1px solid #e8edf5;border-radius:24px;padding:18px}.pv2-3 b{display:block;font-size:40px;line-height:1.1}.pv2-3 span{color:#64748b;font-size:15px}'
    + '.pv2-mod{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e8edf5;border-radius:24px;padding:18px 20px;margin:14px 0}.pv2-mod i{font-style:normal;color:#7c3aed;font-size:26px}.pv2-mod .v{margin-left:auto;font-weight:800}.pv2-dot{width:12px;height:12px;border-radius:50%;background:#22c55e}.pv2-dot.off{background:#ef4444}'
    + '.pv2-menu a{display:flex;align-items:center;gap:14px;padding:16px 4px;border-bottom:1px solid #f1f5f9;font-weight:700;font-size:16px;cursor:pointer}.pv2-menu a:last-child{border:0}.pv2-menu a em{font-style:normal;font-size:22px;width:34px}.pv2-menu a.r{color:#dc2626}'
    + '@media(max-width:820px){.pv2-3 b{font-size:34px}}';
  var st = document.createElement("style"); st.id = "pv2-css"; st.textContent = css; document.head.appendChild(st);

  /* ---------------- alt naviqasiya + başlıq ---------------- */
  var bnItems = [["home", "fa-house", "Ana səhifə"], ["quiz", "fa-file-lines", "Quizlər"], ["pdf", "fa-wand-magic-sparkles", "AI idxal", "ai"], ["group", "fa-user-group", "Qruplar"], ["prof", "fa-user", "Profil"]];
  function post() {
    var r = $("y2"); if (!r) return;
    r.classList.add("pv2");
    var lg = r.querySelector(".y2-logo"); if (lg) lg.innerHTML = "Panel v2<i>.</i>";
    var bn = r.querySelector(".y2-bn");
    if (bn) bn.innerHTML = bnItems.map(function (n) {
      var on = n[0] === Y.page || (n[0] === "quiz" && Y.page === "exam");
      return '<a class="' + (n[3] || "") + (on ? " on" : "") + '" onclick="Y2.go(\'' + n[0] + '\')"><i class="fa-solid ' + n[1] + '"></i>' + n[2] + '</a>';
    }).join("");
  }
  var od = Y.draw;
  Y.draw = function () { var x = od.apply(this, arguments); try { post(); } catch (err) { console.warn("pv2", err); } return x; };

  /* ---------------- Quizlər / İmtahanlar (birləşmiş) ---------------- */
  function kind() { return Y.page === "exam" ? "exam" : "quiz"; }
  function stOf(k, x) {
    if (k === "quiz") { var s = x.status || "Aktiv"; return s === "Aktiv" ? "Aktiv" : s === "Qaralama" ? "Qaralama" : "Bitmiş"; }
    if (x.status && x.status !== "Aktiv") return "Bitmiş";
    var n = Date.now(), a = new Date(x.start).getTime(), b = new Date(x.end).getTime();
    return n < a ? "Gözləyən" : n > b ? "Bitmiş" : "Aktiv";
  }
  function chipsFor(k) { return k === "quiz" ? ["Hamısı", "Aktiv", "Qaralama", "Bitmiş"] : ["Hamısı", "Aktiv", "Gözləyən", "Bitmiş"]; }
  function card(k, x) {
    var s = stOf(k, x);
    if (k === "quiz") {
      return '<div class="pv2-c"><div class="pv2-r" style="margin:0"><h3>' + e(x.title) + '</h3><span class="pv2-bd ' + s + '">' + s + '</span></div>'
        + '<div class="pv2-m">' + (x.topic ? e(x.topic) + " · " : "") + (x.qs || []).length + ' sual · ' + (x.dur || 30) + ' dəq</div>'
        + '<div class="pv2-r"><select class="pv2-bt" onchange="Y2.pvSt(' + js(x._id) + ',this.value)">' + ["Aktiv", "Qaralama", "Bağlanıb", "Arxiv"].map(function (o) { return '<option' + (o === (x.status || "Aktiv") ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>'
        + '<button class="pv2-bt r" onclick="Y2.del(\'ysl2_quiz\',' + js(x._id) + ')">Sil</button></div></div>';
    }
    return '<div class="pv2-c"><div class="pv2-r" style="margin:0"><h3>' + e(x.name) + '</h3><span class="pv2-bd ' + s + '">' + s + '</span></div>'
      + '<div class="pv2-m">' + e(x.pkg) + ' · ' + (x.count || 100) + ' sual · ' + (x.dur || 0) + ' dəq</div><div class="pv2-m">' + fd(x.start) + ' → ' + fd(x.end) + '</div>'
      + '<div class="pv2-r"><span>Giriş kodu: <span class="pv2-code">' + e(x.code) + '</span></span><span><button class="pv2-bt" onclick="Y2.pvCopy(' + js(x.code) + ')">Kopyala</button> <button class="pv2-bt r" onclick="Y2.del(\'ysl2_exam\',' + js(x._id) + ')">Sil</button></span></div></div>';
  }
  function list(k) {
    var all = k === "exam" ? Y.D.ysl2_exam : Y.D.ysl2_quiz, q = (Y.pv.q || "").toLowerCase();
    var l = all.filter(function (x) { return (Y.pv.f === "Hamısı" || stOf(k, x) === Y.pv.f) && (!q || String(x.title || x.name || "").toLowerCase().indexOf(q) > -1); });
    return l.length ? l.map(function (x) { return card(k, x); }).join("") : '<div class="pv2-em">' + (all.length ? "Uyğun nəticə tapılmadı." : (k === "exam" ? "Hələ imtahan yaratmamısınız." : "Hələ quiz yaradılmayıb.")) + '</div>';
  }
  function page() {
    var k = kind(), all = k === "exam" ? Y.D.ysl2_exam : Y.D.ysl2_quiz;
    if (Y.pv.k !== k) { Y.pv.k = k; Y.pv.f = "Hamısı"; Y.pv.q = ""; }
    return '<div class="pv2-hd"><h1>Quizlər</h1><button class="pv2-new" onclick="Y2.pvNew()">＋ Yeni</button></div>'
      + '<div class="pv2-seg"><button class="' + (k === "quiz" ? "on" : "") + '" onclick="Y2.go(\'quiz\')">Quizlər</button><button class="' + (k === "exam" ? "on" : "") + '" onclick="Y2.go(\'exam\')">İmtahanlar</button></div>'
      + '<input class="pv2-s" placeholder="Başlığa görə axtar" value="' + e(Y.pv.q) + '" oninput="Y2.pvQ(this.value)">'
      + '<div class="pv2-ch">' + chipsFor(k).map(function (c) { var n = c === "Hamısı" ? all.length : all.filter(function (x) { return stOf(k, x) === c; }).length; return '<button class="' + (Y.pv.f === c ? "on" : "") + '" onclick="Y2.pvF(\'' + c + '\')">' + c + '<b>' + n + '</b></button>'; }).join("") + '</div>'
      + '<div id="pv2-list">' + list(k) + '</div>';
  }
  Y.p_quiz = page; Y.p_exam = page;
  Y.pvQ = function (v) { Y.pv.q = v; var l = $("pv2-list"); if (l) l.innerHTML = list(kind()); };
  Y.pvF = function (c) { Y.pv.f = c; Y.draw(); };
  Y.pvSt = async function (id, v) { await Y.quizSt(id, v); await Y.go("quiz"); };
  Y.pvCopy = function (c) { try { navigator.clipboard.writeText(c); V2.toast("Kod kopyalandı ✅"); } catch (x) { prompt("Kod:", c); } };

  /* ---------------- «Nə yaratmaq istəyirsiniz?» ---------------- */
  function structText() {
    try { if (typeof examStructure !== "undefined") return examStructure.map(function (s) { return (s.end - s.start + 1) + " " + s.title; }).join(" · "); } catch (x) { }
    return "15 Azərbaycan dili · 40 Qanunvericilik · 15 İnformatika · 30 Məntiq";
  }
  Y.pvNew = function () {
    Y.modal('<div class="pv2-sh"><div class="pv2-grab"></div><div class="pv2-shh"><h2>Nə yaratmaq istəyirsiniz?</h2><button onclick="Y2.cm()">✕</button></div>'
      + '<button class="pv2-ch2" onclick="Y2.cm();Y2.quizForm()"><span class="pv2-ic" style="background:#e8f0ff;color:#0b5fff">🔗</span><span><b>Quiz</b><span class="t">Sual bankından fərdi suallar seçin, müddət və status verin.</span></span><i class="ar">→</i></button>'
      + '<button class="pv2-ch2" onclick="Y2.cm();Y2.ex=null;Y2.exStep1()"><span class="pv2-ic" style="background:#fff3dc;color:#b45309">100</span><span><b>İmtahan</b><span class="t">Yalnız uyğun 100 suallıq paket; fənn bölgüsü avtomatik düzülür.</span></span><i class="ar">→</i></button>'
      + '<p class="pv2-m">İmtahan: ' + e(structText()) + '</p></div>');
  };

  /* ---------------- PDF-dən idxal ---------------- */
  var opdf = Y.p_pdf;
  Y.p_pdf = function () {
    if (Y.view === "rev" && Y.imp) return opdf.apply(this, arguments);
    var I = Y.D.ysl2_imp || [], tot = I.reduce(function (a, x) { return a + x.qs.length; }, 0), ap = I.reduce(function (a, x) { return a + x.qs.filter(function (q) { return q.st === "ok"; }).length; }, 0);
    var m = localStorage.getItem("ysl2_model") || "gemini-2.5-flash", hasKey = !!localStorage.getItem("ysl2_key");
    var mon = I.filter(function (x) { var d = new Date(x.ts), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length;
    return '<h1>PDF-dən idxal</h1><p class="y2-sub">PDF və ya Word faylını yükləyin — AI sualları avtomatik ayıracaq.</p>'
      + '<label class="y2-drop pv2-drop"><input type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onchange="Y2.pickF(this)"><span class="pv2-up">⬆</span><b>Fayl seçin</b><span class="y2-mut">.pdf, .docx · maksimum 10 MB</span></label>'
      + '<div id="y2-file">' + Y.fileRow() + '</div>'
      + '<p class="y2-mut" style="margin:14px 2px">Bu ay <b>' + mon + '</b> sənəd yüklənib.</p>'
      + '<div class="pv2-mod"><i>✦</i><span class="y2-mut">Model</span><span class="v">' + e(m) + '</span><span class="pv2-dot' + (hasKey ? "" : " off") + '" title="' + (hasKey ? "API açarı var" : "API açarı yoxdur — Profil bölməsində daxil edin") + '"></span></div>'
      + '<div class="pv2-3"><div><b>' + I.length + '</b><span>Sənəd</span></div><div><b>' + tot + '</b><span>Aşkarlanan</span></div><div><b>' + ap + '</b><span>Təsdiqlənən</span></div></div>'
      + '<button class="pv2-bt" style="width:100%;padding:14px;margin-bottom:6px" onclick="Y2.close();try{showScreen(\'admin-panel\');switchAdminTab(\'copy2\')}catch(x){}">📑 Mətn / şəkildən toplu ayır (Copy2)</button>'
      + '<div class="pv2-hd" style="margin-top:22px"><h2 style="margin:0">İdxal tarixçəsi</h2><span class="y2-mut">' + I.length + ' sənəd</span></div>'
      + (I.length ? I.map(function (x) { return '<div class="pv2-c" style="margin-top:12px"><h3>' + e(x.name) + '</h3><div class="pv2-m">' + (x.pages || "—") + ' səhifə · ' + x.qs.length + ' sual · ' + x.qs.filter(function (q) { return q.st === "ok"; }).length + ' təsdiqli · ' + fd(x.ts) + '</div><div class="pv2-r"><button class="pv2-bt" onclick="Y2.openImp(' + js(x._id) + ')">Aç</button><button class="pv2-bt r" onclick="Y2.del(\'ysl2_imp\',' + js(x._id) + ')">Sil</button></div></div>'; }).join("") + '<button class="pv2-bt r" onclick="Y2.clearImp()">Tarixçəni təmizlə</button>' : '<div class="pv2-c pv2-em" style="padding:34px 10px;font-size:16px">Hələ sənəd yüklənməyib.</div>');
  };

  /* ---------------- Profil menyusu ---------------- */
  var opr = Y.p_prof;
  Y.p_prof = function () {
    var menu = '<div class="pv2-c pv2-menu"><a onclick="Y2.go(\'bank\')"><em>🗂️</em>Sual bankı</a><a onclick="Y2.go(\'res\')"><em>📊</em>Nəticələr</a>'
      + '<a onclick="Y2.close();try{showScreen(\'admin-panel\')}catch(x){}"><em>⚙️</em>Əsas Admin Panelə keç</a><a class="r" onclick="Y2.logout()"><em>🚪</em>Çıxış</a></div>';
    return opr.apply(this, arguments).replace("<h1>Profil</h1>", "<h1>Profil</h1>" + menu);
  };
})();
