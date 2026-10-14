/* DQ Platform — dq-home2.js (v1)
   Ana səhifə üçün premium qat: yeni hero (kompüterdə canlı işləyən sınaq), «Niyə DQ Platform?» bölməsi,
   yekun CTA zolağı və tünd başlıq. Mövcud kodu dəyişmir: #v3-home içinə əlavə olunur. Söndürmək üçün script sətrini silin. */
(function () {
  "use strict";
  if (window.DQH2) return;
  var D = document, $ = function (s, r) { return (r || D).querySelector(s); };

  var CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Caveat:wght@600&display=swap');
html body{--hn:#06112e;--hn2:#0c2260;--hg:#f6c453;--hg2:#e5a82c;--hf:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif}
/* başlıq: tək tünd zolaq */
html body #v3-home .v3-top{background:#040c22;font-family:var(--hf)}
html body #v3-home .v3-hd{background:linear-gradient(180deg,#07163f,var(--hn));border:0;box-shadow:none}
html body #v3-home .v3-hd h1{color:#fff;font:800 24px var(--hf);letter-spacing:-.02em}
html body #v3-home .v3-hd .v3-r a,html body #v3-home .v3-hd .v3-r button{
  background:linear-gradient(135deg,var(--hg),var(--hg2));color:#1a1403;border:0;border-radius:12px;font:800 14px var(--hf);
  box-shadow:0 10px 22px -10px rgba(246,196,83,.8)}
html body #v3-home .v3-nav{background:var(--hn);border:0;border-bottom:1px solid rgba(246,196,83,.35);font-family:var(--hf)}
html body #v3-home .v3-nav a{color:#d6def5;border-radius:0;background:none;border-bottom:2px solid transparent;transition:color .2s,border-color .2s}
html body #v3-home .v3-nav a:hover{color:#fff;border-bottom-color:var(--hg)}

/* hero */
.h2-hero{position:relative;overflow:hidden;color:#fff;font-family:var(--hf);
 background:radial-gradient(60% 80% at 78% 55%,rgba(246,176,60,.22),transparent 62%),radial-gradient(70% 90% at 0 0,#12308a55,transparent 60%),linear-gradient(170deg,#0a1c52,var(--hn) 70%);
 padding:clamp(28px,5vw,64px) clamp(18px,5vw,56px) clamp(36px,5vw,64px)}
.h2-hero::before{content:"";position:absolute;inset:0;opacity:.07;pointer-events:none;
 background:linear-gradient(#fff 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,#fff 1px,transparent 1px) 0 0/48px 48px}
.h2-in{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:clamp(18px,4vw,48px);align-items:center;max-width:1180px;margin:auto}
.h2-hero h2{font:800 clamp(34px,5.2vw,62px)/1.04 var(--hf);letter-spacing:-.035em;margin:0 0 18px;color:#fff}
.h2-hero h2 em{font-style:normal;color:var(--hg)}
.h2-hero p{font:500 clamp(15px,1.5vw,18px)/1.65 var(--hf);color:#c9d4f2;max-width:34em;margin:0 0 26px}
.h2-cta{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px}
.h2-b{cursor:pointer;border:0;border-radius:999px;padding:16px 26px;font:800 15px var(--hf);display:inline-flex;gap:10px;align-items:center}
.h2-b.g{background:linear-gradient(135deg,var(--hg),var(--hg2));color:#1a1403;box-shadow:0 18px 30px -14px rgba(246,196,83,.85)}
.h2-b.o{background:rgba(255,255,255,.06);color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.45)}
.h2-tr{display:flex;flex-wrap:wrap;gap:18px 26px}
.h2-tr div{display:flex;gap:10px;align-items:center;font:600 12.5px/1.35 var(--hf);color:#c9d4f2;max-width:170px}
.h2-tr i{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(246,196,83,.14);box-shadow:inset 0 0 0 1px rgba(246,196,83,.5);color:var(--hg);font-style:normal}

/* kompüter */
.h2-vis{position:relative;min-height:320px;display:grid;place-items:center}
.h2-note{position:absolute;right:0;top:-6px;transform:rotate(-7deg);font:600 clamp(18px,2.2vw,26px)/1.15 'Caveat','Segoe Script',cursive;color:var(--hg);text-align:right;z-index:3}
.h2-note::after{content:"";display:block;height:3px;margin-top:6px;border-radius:3px;background:var(--hg);transform:rotate(-2deg)}
.h2-lap{width:min(100%,560px);transform:perspective(1500px) rotateY(-13deg) rotateX(3deg);transform-origin:60% 60%;filter:drop-shadow(0 40px 40px rgba(0,0,0,.55))}
.h2-scr{background:#0a0f1e;border:7px solid #1b2236;border-bottom-width:9px;border-radius:14px 14px 4px 4px;overflow:hidden;aspect-ratio:16/10;display:flex;flex-direction:column;box-shadow:0 0 0 1px #3a4468}
.h2-base{height:14px;margin:0 -6%;border-radius:2px 2px 16px 16px;background:linear-gradient(#cfd5e4,#8a93ac 70%,#5b6482)}
.h2-eh{display:flex;justify-content:space-between;align-items:center;background:#0e2a73;color:#fff;padding:2.2% 3%;font:700 clamp(7px,1.1vw,11px) var(--hf)}
.h2-eh b{background:rgba(246,196,83,.18);border:1px solid rgba(246,196,83,.5);color:var(--hg);padding:2px 8px;border-radius:5px;font-variant-numeric:tabular-nums}
.h2-eb{flex:1;display:grid;grid-template-columns:1.65fr 1fr;gap:2.5%;padding:2.5%;background:#eef2fb;min-height:0}
.h2-q{background:#fff;border-radius:6px;padding:4%;color:#0c1a44;font:600 clamp(6px,.95vw,10px)/1.45 var(--hf)}
.h2-q small{display:block;background:#eef2fb;border-radius:4px;padding:3% 4%;margin-bottom:4%;font-weight:800}
.h2-q p{margin:0 0 4%;font-weight:700;color:#0c1a44}
.h2-o{display:flex;gap:6px;align-items:center;background:#eef2fb;border-radius:4px;padding:2.2% 3%;margin-bottom:2.4%;transition:background .35s,color .35s;color:#33415f}
.h2-o i{width:.9em;height:.9em;border-radius:50%;border:1.5px solid #7a86a6;flex:none;transition:.35s}
.h2-o.on{background:#0e2a73;color:#fff}.h2-o.on i{background:var(--hg);border-color:var(--hg)}
.h2-ac{background:#fff;border-radius:6px;padding:5%;color:#0c1a44;font:800 clamp(6px,.9vw,9px) var(--hf)}
.h2-g{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin:5% 0 8%}
.h2-g s{text-decoration:none;display:grid;place-items:center;aspect-ratio:1.1;border-radius:2px;background:#eef2fb;font-weight:700;transition:background .4s,color .4s}
.h2-g s.d{background:#0e2a73;color:#fff}.h2-g s.c{outline:1.5px solid var(--hg);background:#fff3cf}
.h2-books{position:absolute;left:-4%;bottom:-6px;z-index:2;display:flex;flex-direction:column;gap:3px;transform:rotate(-4deg)}
.h2-books span{display:block;padding:7px 18px 7px 14px;border-radius:3px 6px 6px 3px;color:#e9d9a6;font:700 12px var(--hf);background:linear-gradient(90deg,#0a1b52,#173a95);box-shadow:0 6px 10px -4px #000a}
.h2-books span:nth-child(even){margin-left:14px}

/* niyə */
.h2-why{padding:clamp(34px,5vw,60px) 20px;background:#f4f6fc;text-align:center;font-family:var(--hf)}
.h2-why h3{display:inline-flex;gap:16px;align-items:center;margin:0 0 30px;font:800 clamp(22px,3vw,32px) var(--hf);color:#0a1c52;letter-spacing:-.02em}
.h2-why h3::before,.h2-why h3::after{content:"";width:clamp(24px,8vw,90px);height:2px;background:var(--hg2)}
.h2-wg{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));max-width:1100px;margin:auto}
.h2-wg div{padding:6px 22px;border-left:1px solid #dbe1f0}.h2-wg div:first-child{border-left:0}
.h2-wg i{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 12px;border-radius:50%;background:linear-gradient(145deg,var(--hg),var(--hg2));font-style:normal;font-size:24px;box-shadow:0 12px 20px -10px rgba(229,168,44,.9)}
.h2-wg b{display:block;color:#0a1c52;font-size:16px;margin-bottom:6px}.h2-wg small{color:#5f6b8a;font-size:13.5px;line-height:1.5}

/* yekun zolaq */
.h2-band{position:relative;overflow:hidden;margin:0;padding:clamp(24px,4vw,40px) clamp(18px,5vw,56px);color:#fff;font-family:var(--hf);
 background:linear-gradient(110deg,var(--hn) 55%,#14307f);display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.h2-band::after{content:"";position:absolute;right:18%;top:-30%;width:90px;height:180%;background:linear-gradient(var(--hg),transparent);opacity:.5;transform:rotate(24deg)}
.h2-band b{position:relative;z-index:1;font:800 clamp(20px,2.6vw,30px)/1.2 var(--hf);max-width:20em}

@media(max-width:820px){.h2-in{grid-template-columns:1fr}.h2-vis{margin-top:14px}.h2-books{display:none}.h2-note{position:static;transform:rotate(-3deg);margin-bottom:10px}.h2-lap{transform:none}.h2-wg div{border-left:0}}
/* gecə rejimi saytda invert filtri ilə işləyir: tünd bölmələri ilkin rəngdə saxla */
html.dq13-dark .h2-hero,html.dq13-dark .h2-band,html.dq13-dark #v3-home .v3-hd,html.dq13-dark #v3-home .v3-nav,html.dq13-dark #v3-home .v3-top{filter:invert(1) hue-rotate(180deg)}
@media(prefers-reduced-motion:reduce){.h2-o,.h2-g s,.h2-o i{transition:none}}
`;

  var OPT = ["oxuyanda apardığım qeydlər", "düşünüb danışmağa çalışan", "oxuyaraq çalışan tələbə", "dəfələrlə oxumaq istədiyim", "gülə-gülə içəri daxil olan"];
  function heroHtml() {
    var cells = ""; for (var i = 1; i <= 15; i++) cells += "<s" + (i === 1 ? ' class="c"' : "") + ">" + i + "</s>";
    return '<div class="h2-in"><div><h2>Dövlət qulluğuna hazırlığın <em>ən doğru yolu</em></h2>' +
      "<p>DQ Platform dövlət qulluğu üzrə sınaq imtahanları, aktual materiallar və peşəkar hazırlıq imkanı verir. Uğur səninlədir!</p>" +
      '<div class="h2-cta"><button type="button" class="h2-b g" data-h2="exam">▶ Sınaq imtahanına başla</button><button type="button" class="h2-b o" data-h2="mat">📚 Materiallar</button></div>' +
      '<div class="h2-tr"><div><i>✔</i>DİM modelinə uyğun imtahanlar</div><div><i>🛡</i>Təhlükəsiz və stabil platforma</div><div><i>📱</i>Hər zaman və hər yerdə</div></div></div>' +
      '<div class="h2-vis"><div class="h2-note">Dəqiq məlumat,<br>Düzgün hazırlıq,<br>Uğurlu nəticə</div>' +
      '<div class="h2-books"><span>Qanunvericilik</span><span>İnformatika</span><span>Azərbaycan dili</span><span>Məntiq</span></div>' +
      '<div class="h2-lap"><div class="h2-scr"><div class="h2-eh"><span>Dövlət Qulluğu Sınaq 1 (BB)</span><b class="h2-tm">02:59:51</b></div>' +
      '<div class="h2-eb"><div class="h2-q"><small>Sual 1 (Azərbaycan dili)</small><p>«Feli bağlama + məsdər + feli sifət» sxeminə uyğun gələn bandı seçin.</p>' +
      OPT.map(function (t, i) { return '<div class="h2-o"><i></i>' + "ABCDE"[i] + ") " + t + "</div>"; }).join("") +
      '</div><div class="h2-ac">Cavab kartı<div class="h2-g">' + cells + '</div>Azərbaycan dili 0/15</div></div></div><div class="h2-base"></div></div></div></div>';
  }
  var WHY = [["🎯", "DİM modelinə uyğun", "Real imtahan formatına uyğun sınaqlar və suallar."], ["📊", "Nəticənin təhlili", "Hər sınaqdan sonra ətraflı nəticə analizi."], ["📖", "Zəngin materiallar", "Fənn üzrə aktual mövzular, testlər və izahlar."], ["📱", "Rahat istifadə", "Hər yerdə, hər zaman mobil və kompüterdən."]];

  function click(re) {
    var a = [].filter.call(D.querySelectorAll("#v3-home .v3-nav a"), function (x) { return re.test(x.textContent); })[0];
    if (a) { a.click(); return true; } return false;
  }
  function login() {
    try { if (window.YQ && YQ.open) return YQ.open("in"); } catch (e) { }
    var b = [].filter.call(D.querySelectorAll("#v3-home .v3-hd .v3-r a,#v3-home .v3-hd .v3-r button"), function (x) { return /Daxil|Kabinet/i.test(x.textContent); })[0]; b && b.click();
  }
  function mount() {
    var home = $("#v3-home"), nav = home && $(".v3-nav", home);
    if (!nav || $(".h2-hero", home)) return;
    var h = D.createElement("section"); h.className = "h2-hero"; h.innerHTML = heroHtml(); nav.insertAdjacentElement("afterend", h);
    var why = D.createElement("section"); why.className = "h2-why";
    why.innerHTML = "<h3>Niyə məhz DQ Platform?</h3><div class=\"h2-wg\">" + WHY.map(function (w) { return "<div><i>" + w[0] + "</i><b>" + w[1] + "</b><small>" + w[2] + "</small></div>"; }).join("") + "</div>";
    var band = D.createElement("section"); band.className = "h2-band";
    band.innerHTML = '<b>Dövlət qulluğu hədəfinə doğru ilk addımını at!</b><button type="button" class="h2-b g" data-h2="reg">Qeydiyyatdan keç ›</button>';
    var ft = $(".v3-ft", home);
    if (ft) { ft.insertAdjacentElement("beforebegin", why); ft.insertAdjacentElement("beforebegin", band); } else { home.appendChild(why); home.appendChild(band); }
  }

  D.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-h2]"); if (!b) return;
    var k = b.dataset.h2;
    if (k === "exam" && !click(/sınaq/i)) { try { V3.go("exam"); } catch (x) { } }
    else if (k === "mat") click(/material/i);
    else if (k === "reg") login();
  });

  /* canlı sınaq: taymer geri sayır, suallar cavablanır */
  var left = 2 * 3600 + 59 * 60 + 51, step = 0, still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  setInterval(function () {
    var t = $(".h2-tm"); if (!t) return;
    left = left > 0 ? left - 1 : 2 * 3600 + 59 * 60 + 51;
    t.textContent = p2(Math.floor(left / 3600)) + ":" + p2(Math.floor(left % 3600 / 60)) + ":" + p2(left % 60);
  }, 1000);
  if (!still) setInterval(function () {
    var os = D.querySelectorAll(".h2-o"), cs = D.querySelectorAll(".h2-g s"); if (!os.length) return;
    step++; var sel = (step * 2 + 1) % 5;
    [].forEach.call(os, function (o, i) { o.classList.toggle("on", i === sel); });
    [].forEach.call(cs, function (c, i) { var q = step % 16; c.classList.toggle("d", i < q); c.classList.toggle("c", i === q); });
  }, 2200);

  var st = D.createElement("style"); st.id = "dq-home2-css"; st.textContent = CSS; D.head.appendChild(st);
  var raf = 0, obs = new MutationObserver(function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; mount(); }); });
  function boot() { var h = $("#v3-home"); if (h) { obs.observe(h, { childList: true, subtree: true }); mount(); } else setTimeout(boot, 300); }
  boot();
  window.DQH2 = { mount: mount };
})();
