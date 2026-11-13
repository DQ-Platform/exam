/* «Nəticəni təhlil et, gələcəyini planla» bölməsinin yeni, statistikasız dizaynı.
   Köhnə bölməni tapır, gizlədir və yerinə yeni blok qoyur (səhifə yenidən çəkilsə də bərpa olunur). */
(function(){"use strict";
if(window.__dqAn)return;window.__dqAn=1;
var CSS="#dq-an,#dq-an *{box-sizing:border-box}#dq-an{position:relative;margin:28px auto;max-width:1180px;border-radius:24px;overflow:hidden;color:#e9eefb;font-family:inherit;border:1px solid rgba(201,162,75,.38);background:radial-gradient(900px 380px at 100% 0%,rgba(243,217,139,.13),transparent 60%),radial-gradient(700px 400px at 0% 100%,rgba(59,110,230,.28),transparent 60%),linear-gradient(135deg,#0c2150 0%,#0a1a42 55%,#08143a 100%);box-shadow:0 24px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.07)}"+
"#dq-an:before{content:'';position:absolute;left:0;top:26px;bottom:26px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(180deg,#f3d98b,#c9a24b)}"+
"#dq-an .an-in{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;padding:44px 44px 44px 48px;align-items:center}"+
"#dq-an .an-k{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f3d98b;margin-bottom:14px}#dq-an .an-k i{width:26px;height:2px;background:linear-gradient(90deg,#f3d98b,transparent)}"+
"#dq-an h2{margin:0 0 12px;font-size:clamp(26px,3.2vw,38px);line-height:1.15;font-weight:800;color:#fff;letter-spacing:-.3px}#dq-an h2 em{font-style:normal;background:linear-gradient(180deg,#f7e3a1,#c9a24b);-webkit-background-clip:text;background-clip:text;color:transparent}"+
"#dq-an .an-p{margin:0 0 22px;color:#a9b8dc;font-size:16px;line-height:1.65;max-width:520px}"+
"#dq-an .an-f{list-style:none;margin:0 0 26px;padding:0;display:grid;gap:12px}#dq-an .an-f li{display:flex;align-items:center;gap:12px;font-size:15px;color:#dbe4fa}"+
"#dq-an .an-f svg{flex:none;width:34px;height:34px;padding:7px;border-radius:10px;background:rgba(243,217,139,.12);border:1px solid rgba(243,217,139,.35);stroke:#f3d98b;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}"+
"#dq-an .an-b{display:inline-flex;align-items:center;gap:10px;padding:14px 26px;border-radius:14px;font-weight:700;font-size:16px;text-decoration:none;color:#1a1405;background:linear-gradient(180deg,#f3d98b,#c9a24b);box-shadow:0 10px 26px rgba(201,162,75,.3);transition:transform .15s,filter .15s}#dq-an .an-b:hover{transform:translateY(-2px);filter:brightness(1.06)}"+
"#dq-an .an-s{position:relative;display:grid;gap:14px;padding-left:4px}#dq-an .an-s:before{content:'';position:absolute;left:31px;top:34px;bottom:34px;width:2px;background:linear-gradient(180deg,rgba(243,217,139,.7),rgba(243,217,139,.08))}"+
"#dq-an .an-c{position:relative;display:flex;gap:16px;align-items:flex-start;padding:18px 18px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(4px)}"+
"#dq-an .an-n{flex:none;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:19px;color:#1a1405;background:linear-gradient(180deg,#f7e3a1,#c9a24b);box-shadow:0 0 0 6px rgba(243,217,139,.13)}"+
"#dq-an .an-c b{display:block;font-size:17px;color:#fff;margin:2px 0 4px}#dq-an .an-c span{font-size:14px;line-height:1.5;color:#a9b8dc}"+
"@media(max-width:820px){#dq-an{margin:20px 12px;border-radius:20px}#dq-an .an-in{grid-template-columns:1fr;gap:26px;padding:30px 20px 28px 24px}#dq-an .an-b{width:100%;justify-content:center}#dq-an .an-p{font-size:15px}}";
var HTML='<div class="an-in"><div><div class="an-k"><i></i>Analiz və inkişaf</div><h2>Nəticəni <em>təhlil et</em>,<br>gələcəyini planla</h2><p class="an-p">Hər sınaqdan sonra detallı nəticə analizi, zəif mövzuların müəyyənləşdirilməsi və fərdi inkişaf planı ilə hazırlığı daha məqsədyönlü qur.</p>'+
'<ul class="an-f"><li><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>Fənn və mövzu üzrə detallı analiz</li><li><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>Zəif mövzuların dəqiq müəyyənləşdirilməsi</li><li><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg>Səhvlərin izahlı baxışı</li></ul>'+
'<a class="an-b" href="movzu.html">Mövzu sınağına başla <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>'+
'<div class="an-s"><div class="an-c"><div class="an-n">1</div><div><b>Sınaq ver</b><span>Kateqoriya, fənn və mövzuları seç — sualları sistem fənn bölgüsünə uyğun təsadüfi tərtib edir.</span></div></div><div class="an-c"><div class="an-n">2</div><div><b>Nəticəni analiz et</b><span>Hər mövzu üzrə güclü və zəif tərəflərini, düzgün cavabları və izahları gör.</span></div></div><div class="an-c"><div class="an-n">3</div><div><b>Hazırlığı planla</b><span>Zəif mövzulara fokuslan, yeni mövzu sınağı ilə irəliləyişini yoxla.</span></div></div></div></div>';
var busy=0;
function leaf(){var all=document.querySelectorAll("h1,h2,h3,h4,div,p,span,b,strong");for(var i=0;i<all.length;i++){var e=all[i];if(e.id==="dq-an"||e.closest("#dq-an"))continue;if(e.children.length<=1&&/^\s*Nəticəni\s+təhlil\s+et,?\s*gələcəyini\s+planla\s*$/i.test(e.textContent||""))return e}return null}
function run(){if(busy)return;var h=leaf();if(!h)return;busy=1;
 var el=h;while(el.parentElement&&el.parentElement!==document.body){var p=el.parentElement,t=p.textContent||"";if(/Niyə məhz|Fənlər üzrə testlər|Aktiv sınaqlar|Yeniliklər|İmtahan Qeydiyyatı/.test(t))break;el=p}
 if(!document.getElementById("dq-an-css")){var s=document.createElement("style");s.id="dq-an-css";s.textContent=CSS;document.head.appendChild(s)}
 var n=document.createElement("section");n.id="dq-an";n.innerHTML=HTML;el.parentNode.insertBefore(n,el);el.style.setProperty("display","none","important");el.setAttribute("data-dq-an-old","1");
 setTimeout(function(){busy=0},300)}
function tick(){var n=document.getElementById("dq-an");if(n&&n.isConnected){var old=document.querySelector("[data-dq-an-old]");if(old&&old.style.display!=="none")old.style.setProperty("display","none","important");var h=leaf();if(!h)return}run()}
var t=0;new MutationObserver(function(){clearTimeout(t);t=setTimeout(tick,200)}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);else tick();
})();
