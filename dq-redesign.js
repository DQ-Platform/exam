/* DQ Platform — yeni ana səhifə + vizual redaktor (Canva tipli). Mövcud funksiyalara (V3, LXP, YQ, DQ, LX, V2) yalnız müraciət edir. */
(function(){"use strict";
var $=function(i){return document.getElementById(i)},
gV3=function(){try{return V3}catch(e){}},gV2=function(){try{return V2}catch(e){}},
E=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})},
NL=function(s){return E(s).replace(/\n/g,"<br>")},
CL=function(o){return JSON.parse(JSON.stringify(o))},
S={news:[],imgs:{},edit:false,hist:[],fut:[],id:null,dirty:false,sel:null,base:"",ready:false},
AZ=["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"],
SN={ex:"İmtahanlar",an:"Nəticə analizi",why:"Niyə DQ Platform",news:"Yeniliklər"},
cfg=null,DEFC=null;
try{var lk=document.createElement("link");lk.rel="stylesheet";lk.href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Caveat:wght@600&display=swap";document.head.appendChild(lk)}catch(e){}

function gp(o,p){return String(p).split(".").reduce(function(a,k){return a==null?a:a[k]},o)}
function sp(o,p,v){var k=p.split("."),l=k.pop();k.reduce(function(a,x){return a[x]},o)[l]=v}
function merge(d,s){if(s===undefined||s===null)return d;if(d&&s&&typeof d==="object"&&typeof s==="object"&&!Array.isArray(d)&&!Array.isArray(s)){var r={};Object.keys(d).forEach(function(k){r[k]=merge(d[k],s[k])});Object.keys(s).forEach(function(k){if(!(k in r))r[k]=s[k]});return r}return s}
function isAdmin(){try{return localStorage.getItem("dq_admin_logged")==="true"||window.__dqAuthed===true}catch(e){return false}}
function logged(){try{if(window.DQ10&&DQ10.logged)return DQ10.logged()}catch(e){}try{if(YQ2.sess())return true}catch(e){}try{var c=DQ.cabinet();return!!(c&&(c.fin||c.name))}catch(e){}return false}

/* ---------- ikonlar (inline SVG: şəkil faylı tələb etmir) ---------- */
var ICO={cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c3 2.6 9 2.6 12 0v-4.5M22 9v6"/>',
book:'<path d="M3 5.5c3-1.2 6-1 9 .8v13c-3-1.8-6-2-9-.8z"/><path d="M21 5.5c-3-1.2-6-1-9 .8v13c3-1.8 6-2 9-.8z"/>',
scale:'<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-3 7a3.2 3.2 0 006 0zM20 7l-3 7a3.2 3.2 0 006 0z"/>',
monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5M7 9l2 2-2 2M12 13h4"/>',
doc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
chart:'<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.6 8-8 9-4.4-1-8-4-8-9V6z"/><path d="M8.5 12l2.3 2.3 4.7-4.8"/>',
phone:'<rect x="7" y="2" width="10" height="20" rx="2.2"/><path d="M11 18.5h2"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2"/>',
up:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.8 3-6 6.5-6s6.5 2.2 6.5 6M16 4.6a3.5 3.5 0 010 6.8M18.5 14.4c2 .8 3 2.6 3 5.6"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
moon:'<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
bell:'<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
tg:'<path d="M21 4L3 11.2l6 2.2 2.3 6.8 3.3-4.6 5 3.6z"/><path d="M9 13.4L21 4"/>',
wa:'<path d="M4 20l1.3-4.3A8.2 8.2 0 1112 20.2a8.2 8.2 0 01-3.7-.9z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.7-2-1-1 .9c-1-.4-2-1.4-2.4-2.4l.9-1-1-2z"/>',
yt:'<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10.2 9.6v4.8l4.2-2.4z"/>',
ig:'<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.8"/><path d="M16.8 7.2h.01"/>'};
function SV(k,c){return'<svg class="'+(c||"ic")+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICO[k]||ICO.doc)+"</svg>"}
function socIc(a,t){a=String(a||"")+" "+String(t||"");return/t\.me|telegram/i.test(a)?"tg":/wa\.me|whatsapp/i.test(a)?"wa":/youtube|youtu\.be/i.test(a)?"yt":/instagram/i.test(a)?"ig":""}

function makeDef(){
  var it=(gV3()&&V3.D&&V3.D.items)||{},gs=(gV3()&&V3.D&&V3.D.groups&&V3.D.groups.soc)||[],
  soc=gs.filter(function(k){return it[k]&&!it[k].h}).map(function(k){return{t:it[k].t,a:it[k].a||"none"}});
  if(!soc.length)soc=[{t:"Telegram",a:"none"},{t:"WhatsApp",a:"none"},{t:"YouTube",a:"none"},{t:"Instagram",a:"none"}];
  var card=function(ic,c,t,cat,ch){return{ic:ic,c:c,t:t,cat:cat,ch:ch,b:{t:"İştirak et",a:"exam"}}};
  return{v:2,theme:{gd:"#e8b94a",bg:"#020a1a",pn:"#061330",tx:"#f1f5ff"},order:["ex","an","why","news"],hide:{},st:{},
  nav:[{t:"Ana səhifə",a:"home"},{t:"Yeniliklər",a:"news"},{t:"Sınaqlar",a:"exam"},{t:"Testlər",a:"tests"},{t:"İmtahan",a:"exam"},{t:"Materiallar",a:"law"},{t:"Haqqımızda",a:"sc:dqr-ft"}],
  brand:"PLATFORM",logo:"logo.png",
  hero:{eb:"DÖVLƏT QULLUĞU",t1:"Hədəfiniz dövlət qulluğudur?",t2:"Biz sizinləyik!",p:"DQ Platform – dövlət qulluğu üzrə sınaq imtahanları, aktual materiallar və peşəkar hazırlıq imkanı verir. Uğur səninlədir!",btn:{t:"Sınaq imtahanına başla",a:"exam"},img:"hero.jpg",
   feat:[{ic:"doc",t:"DİM modelinə uyğun imtahanlar"},{ic:"chart",t:"Təhlil və nəticə analizi"},{ic:"target",t:"Hər zaman və hər yerdə"},{ic:"shield",t:"Təkmilləşdirilmiş platforma"}]},
  ex:{t:"İmtahanlar və sınaqlar",s:"Öz səviyyəni yoxla, nəticəni təhlil et, uğura bir addım da yaxın ol!",lk:{t:"Bütün sınaqlar →",a:"exam"},auto:true,
   cards:[card("cap","blue","Ümumi sınaq imtahanı","BB",["7 AZN","10 sual","120 dəq"]),card("book","green","Azərbaycan dili","BB",["5 AZN","40 sual","60 dəq"]),card("scale","purple","Qanunvericilik","AC",["5 AZN","40 sual","60 dəq"]),card("monitor","blue","İnformatika","BA",["5 AZN","40 sual","60 dəq"])]},
  an:{t:"Nəticəni təhlil et, gələcəyini planla",p:"Hər sınaqdan sonra detallı nəticə analizi, zəif mövzuların müəyyənləşdirilməsi və fərdi inkişaf planı ilə hazırlığını daha səmərəli qur.",btn:{t:"Nəticə analizi →",a:"exam"},img:"chart.jpg",
   pct:"85%",rl:"Ümumi nəticə",bt:"Fənlər üzrə nəticə",
   st:[{t:"Düzgün cavablar",v:"34"},{t:"Səhv cavablar",v:"6"},{t:"Boş qalanlar",v:"0"}],
   bars:[{t:"Azərbaycan dili",v:"92%",c:"#25d478"},{t:"Qanunvericilik",v:"78%",c:"#f0c24f"},{t:"İnformatika",v:"85%",c:"#2e8bff"},{t:"Məntiq",v:"70%",c:"#8b4dff"}]},
  why:{t:"Niyə məhz DQ Platform?",items:[{ic:"target",t:"DİM modelinə uyğun real sınaqlar"},{ic:"chart",t:"Dəqiq nəticə analizi və statistikalar"},{ic:"book",t:"Aktual materiallar və qanunvericilik"},{ic:"phone",t:"Mobil uyğun istifadə"},{ic:"shield",t:"Stabil və təhlükəsiz platforma"}]},
  news:{t:"Son yeniliklər",lk:{t:"Bütün yeniliklər →",a:"news"},bn:{s:"DÖVLƏT QULLUĞU",t:"Daha yaxşı bir gələcək səninlədir!",p:"Peşəkar hazırlıq, real nəticə!",btn:{t:"Sınaq imtahanına başla",a:"exam"},img:"mount.jpg",chips:[{ic:"info",t:"Dəqiq məlumat"},{ic:"target",t:"Peşəkar təhlil"},{ic:"chart",t:"Real nəticə"},{ic:"up",t:"Uğurlu karyera"}]}},
  ft:{tag:"Dövlət qulluğu sınaq imtahanı",soc:soc,copy:"© 2026 DQ Platform. Bütün hüquqlar qorunur.",links:[{t:"İstifadə Şərtləri",a:"info:terms"},{t:"Məxfilik Siyasəti",a:"info:priv"}]}}}

/* ---------- köməkçilər ---------- */
function SRC(v){v=v||"";if(v.indexOf("img:")===0)return S.imgs[v.slice(4)]||"";var A=window.DQR_IMG||{},m=v.match(/(?:^|\/)([A-Za-z0-9_-]+)\.(?:png|jpe?g|webp)$/i);if(m){var k=m[1].toLowerCase();if(k==="bg")k="hero";if(A[k])return A[k]}return v}
function ST(p){var s=cfg.st&&cfg.st[p];if(!s)return"";return' style="'+(s.c?"color:"+E(s.c)+";":"")+(s.s?"font-size:calc(var(--k,1)*"+(+s.s)+"px);":"")+'"'}
function ced(){return S.edit?' contenteditable="true" spellcheck="false"':""}
function X(p,tag,cls,ml){return"<"+tag+(cls?' class="'+cls+'"':"")+' data-p="'+p+'"'+(ml?' data-ml="1"':"")+ST(p)+ced()+">"+NL(gp(cfg,p))+"</"+tag+">"}
function LK(p,cls,post,pre){return'<a class="'+cls+'" data-lp="'+p+'">'+(pre||"")+X(p+".t","span")+(post||"")+"</a>"}
function BG(p,cls){return'<div class="'+cls+'" data-ip="'+p+'" style="background-image:url(\''+E(SRC(gp(cfg,p)))+'\')">'+(S.edit?'<b class="chip">📷 Şəkli dəyiş</b>':"")+"</div>"}
function IB(l,i){return S.edit?'<div class="ibar" data-l="'+l+'" data-i="'+i+'"><b data-x="l" title="Sola">◀</b><b data-x="r" title="Sağa">▶</b><b data-x="c" title="Kopyala">⧉</b><b data-x="d" title="Sil">✕</b></div>':""}
function ADD(l){return S.edit?'<button type="button" class="addb" data-add="'+l+'">＋ Əlavə et</button>':""}
function SB(s){return S.edit?'<div class="sbar">'+SN[s]+' <b data-sx="'+s+'|u">▲</b><b data-sx="'+s+'|d">▼</b><b data-sx="'+s+'|h">'+(cfg.hide[s]?"👁 Göstər":"🚫 Gizlət")+"</b></div>":""}
function pct(v){var n=parseInt(v,10);return isNaN(n)?0:Math.max(0,Math.min(100,n))}
function ended(x){try{return x.status==="Bitib"||LX.endOf(x).getTime()<=Date.now()}catch(e){return false}}
function money(v){var n=Math.round(parseFloat(v)*100)/100;return isNaN(n)?"":n+" AZN"}
function dmy(d){var p=function(n){return String(n).padStart(2,"0")};return p(d.getDate())+"."+p(d.getMonth()+1)+"."+d.getFullYear()+" · "+p(d.getHours())+":"+p(d.getMinutes())}
function icon(s){s=String(s||"");return/qanun|hüquq/i.test(s)?"scale":/az[əe]rbaycan|dil/i.test(s)?"book":/informat|kompüter/i.test(s)?"monitor":"cap"}
function live(){try{return(LX.cache||[]).filter(function(x){return x&&x.start&&!ended(x)}).sort(function(a,b){return new Date(a.start)-new Date(b.start)}).slice(0,4)}catch(e){return[]}}
var AZF=["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
function plain(s){return String(s==null?"":s).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}

/* ---------- bölmələr ---------- */
var SEC={
ex:function(){var c=cfg.ex,lv=(!S.edit&&c.auto)?live():[],h,i;
 var liveH=lv.map(function(x){var p=x.pay&&typeof x.pay==="object"&&x.pay.on?money(x.pay.price):"Pulsuz",cap=parseInt(x.cap)>0?x.cap+" yer":"Limitsiz",k=String(x.cat||"").toUpperCase(),ic=icon((x.subject||"")+" "+x.title);
  return'<article class="ex '+E(k)+'"><svg class="wm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">'+(ICO[ic]||"")+'</svg><div class="tp"><span class="ci">'+SV(ic)+'</span><span class="tag">'+E(k||"DQ")+'</span></div><h3>'+E(x.title)+'</h3><div class="ch"><span>'+E(p)+'</span><span>'+E(cap)+'</span><span>'+E(dmy(new Date(x.start)))+'</span></div><a class="b g" data-a="exam">İştirak et <i class="ar">→</i></a></article>'}).join("");
 var st=c.cards.map(function(x,i){var b="ex.cards."+i,k=String(x.cat||"").toUpperCase();
  return'<article class="ex '+E(x.c||k)+'" data-ix="'+i+'">'+IB("ex.cards",i)+'<svg class="wm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">'+(ICO[x.ic]||ICO.cap)+'</svg><div class="tp"><span class="ci">'+SV(x.ic||"cap")+"</span>"+X(b+".cat","span","tag")+"</div>"+X(b+".t","h3")+'<div class="ch">'+(x.ch||[]).map(function(t,j){return t||S.edit?X(b+".ch."+j,"span"):""}).join("")+"</div>"+LK(b+".b","b g",' <i class="ar">→</i>')+"</article>"});
 h=S.edit?st.join("")+ADD("ex.cards"):liveH+st.slice(lv.length).join("");
 return'<section id="dqr-ex" data-sec="ex" class="'+(cfg.hide.ex?"dim":"")+'">'+SB("ex")+'<div class="w"><div class="sh"><div>'+X("ex.t","h2")+X("ex.s","p")+"</div>"+LK("ex.lk","lkx")+'</div>'+(S.edit&&c.auto?'<div class="enote">Aktiv sınaq olduqda saytda real sınaqlar avtomatik göstərilir (sol paneldən söndürə bilərsiniz). Aşağıdakılar ehtiyat kartlardır.</div>':"")+'<div class="g4">'+h+"</div></div></section>"},
an:function(){var a=cfg.an;
 return'<section id="dqr-an" data-sec="an" class="'+(cfg.hide.an?"dim":"")+'">'+SB("an")+'<div class="w"><div class="an"><div>'+X("an.t","h2","",1)+X("an.p","p","",1)+LK("an.btn","b o")+'</div><div class="rs"><div class="rg"><div class="ring" style="--p:'+pct(a.pct)+'%"><b>'+X("an.pct","span")+"</b></div>"+X("an.rl","span")+'</div><div class="st">'+a.st.map(function(r,i){return"<div>"+X("an.st."+i+".t","span")+X("an.st."+i+".v","b")+"</div>"}).join("")+'</div><div class="bars">'+X("an.bt","b")+a.bars.map(function(r,i){return"<div>"+X("an.bars."+i+".t","span")+'<s><i style="width:'+pct(r.v)+"%;background:"+E(r.c)+'"></i></s>'+X("an.bars."+i+".v","span")+"</div>"}).join("")+"</div></div>"+BG("an.img","gr")+"</div></div></section>"},
why:function(){return'<section id="dqr-why" data-sec="why" class="'+(cfg.hide.why?"dim":"")+'">'+SB("why")+'<div class="w"><div class="sh pl"><div>'+X("why.t","h2")+'</div></div><div class="wh">'+cfg.why.items.map(function(x,i){return'<div class="wy" data-ix="'+i+'">'+IB("why.items",i)+'<span class="wi">'+SV(x.ic||"target")+"</span>"+X("why.items."+i+".t","span")+"</div>"}).join("")+ADD("why.items")+'<div id="dqr-st"></div></div><div id="dqr-cnt"></div></div></section>'},
news:function(){var n=cfg.news,b=n.bn;
 return'<section id="dqr-news" data-sec="news" class="'+(cfg.hide.news?"dim":"")+'">'+SB("news")+'<div class="w"><div class="nb"><div class="nl"><div class="nh">'+X("news.t","h2")+LK("news.lk","lkx")+'</div><div id="dqr-nw">'+newsHtml()+(S.edit?'<div class="enote">Xəbərlər idarə panelindəki «Yeniliklər» bölməsindən gəlir.</div>':"")+'</div></div><div class="bn">'+BG("news.bn.img","bnimg")+"<small>"+X("news.bn.s","span")+"</small>"+X("news.bn.t","h2","",1)+X("news.bn.p","p")+LK("news.bn.btn","cta",'<i>→</i>')+'<div class="chp">'+b.chips.map(function(c,i){return'<span data-ix="'+i+'">'+IB("news.bn.chips",i)+SV(c.ic||"info")+X("news.bn.chips."+i+".t","em")+"</span>"}).join("")+ADD("news.bn.chips")+"</div></div></div></div></section>"}};

function newsHtml(){if(!S.news.length)return'<div class="em">Hələlik yenilik yoxdur.</div>';
 return S.news.map(function(n){var d=new Date(n.pub||n.date||""),ok=!isNaN(d),ds=plain(n.summary||n.desc||n.text||n.body||n.content||"");if(ds.length>86)ds=ds.slice(0,84)+"…";
  return'<a class="it" data-a="news"><div class="dt"><b>'+(ok?d.getDate():"•")+"</b>"+(ok?AZF[d.getMonth()]:"")+'</div><div class="tt"><h3>'+E(n.title)+"</h3><small>"+E(ds||n.kind||"Xəbər")+"</small></div></a>"}).join("")}

function build(){
  var on=logged(),nav=cfg.nav.map(function(n,i){return'<a data-ix="'+i+'" data-lp="nav.'+i+'"'+(i?"":' class="on"')+">"+IB("nav",i)+X("nav."+i+".t","span")+"</a>"}).join("")+ADD("nav"),
  logo='<img src="'+E(SRC(cfg.logo))+'" alt="DQ">',
  brand='<div class="lg" data-a="home">'+logo+X("brand","span")+"</div>",
  h=cfg.hero,feat=h.feat.map(function(m,i){return'<div data-ix="'+i+'">'+IB("hero.feat",i)+"<i>"+SV(m.ic||"doc")+"</i>"+X("hero.feat."+i+".t","span")+"</div>"}).join("")+ADD("hero.feat");
  var fnav=cfg.nav.map(function(n,i){return'<a data-lp="nav.'+i+'">'+E(n.t)+"</a>"}).join(""),
  soc=cfg.ft.soc.map(function(s,i){var k=socIc(s.a,s.t);return'<a data-ix="'+i+'" data-lp="ft.soc.'+i+'" title="'+E(s.t)+'">'+IB("ft.soc",i)+(k?SV(k):E(String(s.t||"•").slice(0,2)))+"</a>"}).join("")+ADD("ft.soc"),
  fl=cfg.ft.links.map(function(s,i){return'<a data-ix="'+i+'" data-lp="ft.links.'+i+'">'+IB("ft.links",i)+X("ft.links."+i+".t","span")+"</a>"}).join("");
  var mid=cfg.order.filter(function(s){return SEC[s]&&(S.edit||!cfg.hide[s])}).map(function(s){return SEC[s]()}).join("");
  return'<header class="hd"><div class="w">'+brand+'<nav aria-label="Əsas menyu">'+nav+'</nav><div class="au"><span class="tl"><button type="button" class="tb tl-bell" data-tl="bell" title="Bildirişlər" hidden>'+SV("bell")+'<i></i></button><button type="button" class="tb" data-tl="theme" title="Görünüş (gündüz / gecə)" hidden>'+SV("moon")+'</button><button type="button" class="tb" data-tl="eye" title="Göz rahatlığı" hidden>'+SV("eye")+'</button><button type="button" class="tb sq" data-tl="search" title="Axtar">'+SV("search")+"</button></span>"+(on?'<a class="b g" data-a="kab">Kabinet</a><a class="b" data-a="out">Çıxış</a>':'<a class="b" data-a="in">Daxil ol</a><a class="b g" data-a="reg">Qeydiyyat</a>')+"</div></div></header>"
  +'<main><div class="hero">'+BG("hero.img","bg")+'<div class="w"><div class="tx">'+X("hero.eb","div","ey")+"<h1>"+X("hero.t1","span","t1",1)+" "+X("hero.t2","span","t2")+"</h1>"+X("hero.p","p","",1)+LK("hero.btn","cta",'<i>→</i>')+'<div class="feat">'+feat+"</div></div></div></div>"+mid+"</main>"
  +'<footer class="ft" id="dqr-ft"><div class="w"><div><div class="lg" data-a="home">'+logo+"<span>"+E(cfg.brand)+"</span></div><small>"+X("ft.tag","span")+"</small></div><nav>"+fnav+'</nav><div class="so">'+soc+'</div><div class="cp">'+X("ft.copy","span")+"<span>"+fl+'</span><span class="by">Yş.<span class="dq-imbtn">İmanoff</span></span></div></div></footer>'}

/* ---------- əməliyyatlar ---------- */
var A={home:function(){try{showScreen("v3-home");scrollTo(0,0)}catch(e){}},law:function(){if(typeof LAW2!=="undefined"&&LAW2.open)LAW2.open();else V3.go("n4")},exam:function(){if(window.LXP&&typeof LXP.open==="function")LXP.open();else V3.go("n2")},
 reg:function(){YQ.open("reg")},in:function(){YQ.open("in")},kab:function(){V3.go("kab")},out:function(){DQ.logout()},tests:function(){V3.showTests()},news:function(){openFeedModal("news")},
 info:function(k){V3.info(k)},sc:function(id){var e=$(id);if(e)e.scrollIntoView({behavior:"smooth"})},none:function(){}};
function run(a){a=a||"none";if(/^https?:/i.test(a)){window.open(a,"_blank","noopener");return}var m=a.split(":"),f=A[m[0]];if(f)try{f(m.slice(1).join(":"))}catch(e){}}
function theme(){var el=$("dqr"),t=cfg.theme;if(!el)return;["gd","bg","pn","tx"].forEach(function(k){el.style.setProperty("--"+k,t[k])});var h=$("v3-home");if(h)h.style.background=t.bg}
function adopt(){var c=$("dqr-cnt"),s=$("dqr-st"),a=$("dq-count"),b=$("dq-stats");if(c&&a&&a.parentNode!==c)c.appendChild(a);if(s&&b&&b.parentNode!==s)s.appendChild(b)}
function rebuild(){var el=$("dqr");if(!el)return;var y=window.scrollY;el.innerHTML=build();el.classList.toggle("ed",S.edit);theme();adopt();secList();if(S.edit)window.scrollTo(0,y);S.sel=null;tbar()}
function loadNews(){if(!gV2()||!V2.list)return;V2.list("news").then(function(l){S.news=(l||[]).filter(function(n){return n.title&&!(n.kind&&/^(exam|imtahan-sinaq)$/i.test(n.kind))}).sort(function(a,b){return String(b.pub||b.date||"").localeCompare(String(a.pub||a.date||""))}).slice(0,3);var el=$("dqr-nw");if(el&&!S.edit)el.innerHTML=newsHtml()}).catch(function(){})}
function needImgs(){return JSON.stringify(cfg).indexOf('"img:')>-1}
function loadImgs(){if(!needImgs()||!gV2())return;V2.list("dqrimg").then(function(l){(l||[]).forEach(function(r){if(r.k)S.imgs[r.k]=r.d});refreshImgs()}).catch(function(){})}
function refreshImgs(){var el=$("dqr");if(!el)return;[].forEach.call(el.querySelectorAll("[data-ip]"),function(n){var u=SRC(gp(cfg,n.dataset.ip));if(n.tagName==="IMG")n.src=u;else n.style.backgroundImage="url('"+u.replace(/'/g,"%27")+"')"});[].forEach.call(el.querySelectorAll(".lg img"),function(n){n.src=SRC(cfg.logo)})}
async function loadCfg(){try{var l=await V2.list("dqrcfg");if(l&&l[0]){S.id=l[0]._id;var c=l[0].cfg||null;return c&&c.v===2?c:null}}catch(e){}return null}
async function save(){try{await V2.put("dqrcfg",{cfg:cfg},S.id);var r=await V2.list("dqrcfg");S.id=r[0]&&r[0]._id;S.dirty=false;S.base=JSON.stringify(cfg);try{localStorage.setItem("dqr_cache2",JSON.stringify(cfg))}catch(e){}toast("Yadda saxlanıldı ✅")}catch(e){toast("Xəta: saxlanıla bilmədi")}}

/* ---------- redaktor ---------- */
function snap(){var j=JSON.stringify(cfg);if(S.hist[S.hist.length-1]!==j){S.hist.push(j);if(S.hist.length>60)S.hist.shift();S.fut=[]}}
function dirty(){S.dirty=true}
function undo(){if(!S.hist.length)return;S.fut.push(JSON.stringify(cfg));cfg=JSON.parse(S.hist.pop());dirty();rebuild()}
function redo(){if(!S.fut.length)return;S.hist.push(JSON.stringify(cfg));cfg=JSON.parse(S.fut.pop());dirty();rebuild()}
function toast(m){var t=$("dqe-t");if(!t)return;t.textContent=m;t.classList.add("on");clearTimeout(t.__t);t.__t=setTimeout(function(){t.classList.remove("on")},2200)}
function itemOp(x){var bar=x.closest(".ibar"),l=bar.dataset.l,i=+bar.dataset.i,arr=gp(cfg,l),k=x.dataset.x,t;snap();
 if(k==="l"&&i>0){t=arr[i-1];arr[i-1]=arr[i];arr[i]=t}
 else if(k==="r"&&i<arr.length-1){t=arr[i+1];arr[i+1]=arr[i];arr[i]=t}
 else if(k==="c")arr.splice(i+1,0,CL(arr[i]));
 else if(k==="d"){if(arr.length>1||confirm("Son element silinsin?"))arr.splice(i,1)}
 dirty();rebuild()}
function addItem(l){var arr=gp(cfg,l);snap();var src=arr.length?arr[arr.length-1]:gp(DEFC,l)[0];arr.push(CL(src));dirty();rebuild()}
function secOp(s,op){var o=cfg.order,i=o.indexOf(s),t;snap();
 if(op==="u"&&i>0){t=o[i-1];o[i-1]=o[i];o[i]=t}else if(op==="d"&&i<o.length-1){t=o[i+1];o[i+1]=o[i];o[i]=t}else if(op==="h")cfg.hide[s]=!cfg.hide[s];
 dirty();rebuild()}
function secList(){var b=$("dqe-secs");if(!b)return;b.innerHTML=cfg.order.map(function(s){return'<div class="r"><span'+(cfg.hide[s]?' style="opacity:.5"':"")+">"+SN[s]+'</span><span><b data-sx="'+s+'|u">▲</b><b data-sx="'+s+'|d">▼</b><b data-sx="'+s+'|h">'+(cfg.hide[s]?"👁":"🚫")+"</b></span></div>"}).join("");var a=$("dqe-auto");if(a)a.checked=!!cfg.ex.auto;
 [].forEach.call(document.querySelectorAll("#dqe-p [data-th]"),function(i){i.value=cfg.theme[i.dataset.th]})}
var PRE=[["exam","Sınaq / Kabinet"],["reg","Qeydiyyat"],["in","Daxil ol"],["kab","Kabinet"],["tests","Testlər"],["law","Materiallar (Qanunvericilik)"],["news","Yeniliklər"],["home","Ana səhifə"],["sc:dqr-ex","→ İmtahanlar bölməsi"],["sc:dqr-an","→ Analiz bölməsi"],["sc:dqr-why","→ Niyə DQ bölməsi"],["sc:dqr-news","→ Yeniliklər bölməsi"],["sc:dqr-ft","→ Səhifənin altı"],["info:terms","İstifadə Şərtləri"],["info:priv","Məxfilik Siyasəti"],["none","Keçid yoxdur"]];
function hex(c){var m=String(c).match(/\d+/g)||[255,255,255];return"#"+m.slice(0,3).map(function(n){return(+n).toString(16).padStart(2,"0")}).join("")}
function select(t){var tx=t.closest("[data-p]"),lkn=t.closest("[data-lp]"),im=t.closest("[data-ip]");S.sel={tx:tx,lk:lkn,im:im};tbar()}
function tbar(){var tb=$("dqe-tb"),s=S.sel;if(!tb)return;if(!S.edit||!s||!(s.tx||s.lk||s.im)||!document.contains(s.tx||s.lk||s.im)){tb.hidden=true;return}
 var h="";
 if(s.tx)h+='<span class="g"><b data-t="fs-" title="Kiçilt">A−</b><b data-t="fs+" title="Böyüt">A+</b><input type="color" data-t="col" title="Mətn rəngi" value="'+hex(getComputedStyle(s.tx).color)+'"><b data-t="rs" title="Stili sıfırla">↺</b></span>';
 if(s.lk){var a=(gp(cfg,s.lk.dataset.lp)||{}).a||"none",known=PRE.some(function(p){return p[0]===a});
  h+='<span class="g"><select data-t="act" title="Keçid">'+PRE.map(function(p){return'<option value="'+p[0]+'"'+(p[0]===a?" selected":"")+">"+p[1]+"</option>"}).join("")+'<option value="ext"'+(known?"":" selected")+'>🌐 Xarici link…</option></select><input data-t="url" placeholder="https://…" value="'+(known?"":E(a))+'"'+(known?" hidden":"")+"></span>"}
 if(s.im)h+='<span class="g"><b data-t="img">📷 Şəkli dəyiş</b><b data-t="imgrs" title="Orijinala qaytar">↺</b></span>';
 tb.innerHTML=h;tb.hidden=false;place()}
function place(){var s=S.sel,tb=$("dqe-tb");if(!s||!tb||tb.hidden)return;var n=s.tx||s.lk||s.im;if(!n)return;var r=n.getBoundingClientRect(),w=tb.offsetWidth||260;tb.style.top=Math.max(8,r.top-48)+"px";tb.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+"px"}
function pack(file,max,png){return new Promise(function(ok,no){var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);ok(c.toDataURL(png?"image/png":"image/jpeg",.86))};im.onerror=no;im.src=r.result};r.onerror=no;r.readAsDataURL(file)})}
async function setImg(file){var s=S.sel;if(!s||!s.im||!file)return;var p=s.im.dataset.ip,tag=s.im.tagName==="IMG";
 try{var d=await pack(file,tag?320:1600,tag),k=Date.now().toString(36)+Math.random().toString(36).slice(2,6);S.imgs[k]=d;snap();sp(cfg,p,"img:"+k);dirty();refreshImgs();
  try{await V2.put("dqrimg",{k:k,d:d})}catch(e){toast("Şəkil bazaya yazıla bilmədi")}}catch(e){toast("Şəkil oxunmadı")}}
function tool(e){var el=e.target.closest("[data-t]");if(!el||!S.sel)return;var s=S.sel,k=el.dataset.t,t=e.type;
 if(t==="click"){
  if(k==="fs+"||k==="fs-"){var kk=parseFloat(getComputedStyle($("dqr")).getPropertyValue("--k"))||1,px=parseFloat(getComputedStyle(s.tx).fontSize)/kk,n=Math.max(8,Math.round(px*(k==="fs+"?1.1:.9))),p=s.tx.dataset.p;snap();cfg.st[p]=Object.assign(cfg.st[p]||{},{s:n});s.tx.style.fontSize="calc(var(--k,1)*"+n+"px)";dirty();place()}
  else if(k==="rs"){var p2=s.tx.dataset.p;snap();delete cfg.st[p2];s.tx.removeAttribute("style");dirty();tbar()}
  else if(k==="img")$("dqe-file").click();
  else if(k==="imgrs"){var ip=s.im.dataset.ip;snap();sp(cfg,ip,gp(DEFC,ip));dirty();refreshImgs()}}
 else if(t==="input"&&k==="col"){var p3=s.tx.dataset.p;if(!S.cs){snap();S.cs=1}cfg.st[p3]=Object.assign(cfg.st[p3]||{},{c:el.value});s.tx.style.color=el.value;dirty()}
 else if(t==="change"){
  if(k==="col")S.cs=0;
  else if(k==="act"){var o=gp(cfg,s.lk.dataset.lp);snap();if(el.value==="ext"){var u=el.parentNode.querySelector("[data-t=url]");u.hidden=false;u.focus();o.a="https://"}else{o.a=el.value;el.parentNode.querySelector("[data-t=url]").hidden=true}dirty()}
  else if(k==="url"){snap();gp(cfg,s.lk.dataset.lp).a=el.value.trim();dirty()}}}
function ui(){if($("dqe"))return;var d=document.createElement("div");d.id="dqe";
 d.innerHTML='<button type="button" id="dqe-fab" hidden>✏️ Redaktə</button><div id="dqe-tb" hidden></div><input type="file" id="dqe-file" accept="image/*" hidden><div id="dqe-t"></div>'
 +'<aside id="dqe-p" hidden><div class="h"><b>🎨 Redaktor</b><span><button data-e="undo" title="Geri">↶</button><button data-e="redo" title="İrəli">↷</button></span></div>'
 +'<p class="hint">Mətnə klik edib yazın · şəkilə klik edib dəyişin · düyməyə klik edib keçid seçin · kartın küncündəki ◀ ▶ ⧉ ✕ ilə yerini dəyişin.</p>'
 +'<h4>Tema rəngləri</h4><div class="r"><label>Əsas (qızılı)</label><input type="color" data-th="gd"></div><div class="r"><label>Fon</label><input type="color" data-th="bg"></div><div class="r"><label>Kart fonu</label><input type="color" data-th="pn"></div><div class="r"><label>Mətn</label><input type="color" data-th="tx"></div>'
 +'<h4>Bölmələr</h4><div id="dqe-secs"></div><label class="ck"><input type="checkbox" id="dqe-auto"> Aktiv sınaqları avtomatik göstər</label>'
 +'<div class="f"><button data-e="reset">Sıfırla</button><button data-e="exit">Bağla</button><button class="pri" data-e="save">💾 Yadda saxla</button></div></aside>';
 document.body.appendChild(d);
 $("dqe-fab").onclick=enter;$("dqe-file").onchange=function(e){setImg(e.target.files[0]);e.target.value=""};
 var tb=$("dqe-tb");["click","input","change"].forEach(function(t){tb.addEventListener(t,tool)});tb.addEventListener("mousedown",function(e){if(!/INPUT|SELECT/.test(e.target.tagName))e.preventDefault()});
 var p=$("dqe-p");
 p.addEventListener("click",function(e){var sx=e.target.closest("[data-sx]");if(sx){var a=sx.dataset.sx.split("|");secOp(a[0],a[1]);return}var b=e.target.closest("[data-e]");if(!b)return;var k=b.dataset.e;
  if(k==="undo")undo();else if(k==="redo")redo();else if(k==="save")save();else if(k==="exit")leave();
  else if(k==="reset"&&confirm("Bütün dizayn ilkin vəziyyətə qayıtsın? (Yadda saxlayana qədər dəyişmir)")){snap();cfg=CL(DEFC);dirty();rebuild()}});
 p.addEventListener("input",function(e){var t=e.target.dataset&&e.target.dataset.th;if(t){if(!S.ts){snap();S.ts=1}cfg.theme[t]=e.target.value;dirty();theme()}});
 p.addEventListener("change",function(e){S.ts=0;if(e.target.id==="dqe-auto"){snap();cfg.ex.auto=e.target.checked;dirty()}});
 window.addEventListener("scroll",place,{passive:true});window.addEventListener("resize",place);
 window.addEventListener("beforeunload",function(e){if(S.edit&&S.dirty){e.preventDefault();e.returnValue=""}});
 document.addEventListener("keydown",function(e){if(!S.edit||!(e.ctrlKey||e.metaKey))return;if(document.activeElement&&document.activeElement.isContentEditable)return;var k=e.key.toLowerCase();if(k==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(k==="y"){e.preventDefault();redo()}else if(k==="s"){e.preventDefault();save()}})}
function enter(){S.edit=true;S.hist=[];S.fut=[];S.base=JSON.stringify(cfg);$("dqe-p").hidden=false;$("dqe-fab").hidden=true;document.body.classList.add("dqe-on");rebuild()}
function leave(){if(S.dirty&&!confirm("Saxlanılmamış dəyişikliklər itəcək. Bağlansın?"))return;if(S.dirty){cfg=JSON.parse(S.base);S.dirty=false}S.edit=false;$("dqe-p").hidden=true;document.body.classList.remove("dqe-on");rebuild()}
/* ---------- üzən düymələrin (zəng, görünüş, göz) başlığa inteqrasiyası ---------- */
function findBell(){var d=$("dq13-dock"),c,rx=/bell|notif|bildiri|z[əe]ng/i;
 var direct=$("dq-bell");if(direct)return S.bell=direct;
 if(S.bell&&document.contains(S.bell))return S.bell;
 var all=[].slice.call(document.querySelectorAll("button,a,[role=button]")).filter(function(b){return!b.closest("#dqr")&&!b.closest("#dqe")});
 c=all.filter(function(b){return b.textContent.indexOf("🔔")>-1||rx.test((b.id||"")+" "+(b.className&&b.className.baseVal===undefined?b.className:"")+" "+(b.getAttribute("aria-label")||""))});
 if(d)c.sort(function(a,b){return(d.contains(b)?1:0)-(d.contains(a)?1:0)});
 return S.bell=c[0]||null}
function tools(){var el=$("dqr");if(!el)return;var hb=el.querySelector(".hd"),bell=findBell(),fab=$("dq13-fab"),eye=$("dq13-eye"),q=function(k){return el.querySelector('[data-tl="'+k+'"]')};
 var b=q("bell");if(b){b.hidden=!bell;if(bell){b.classList.toggle("on",bell.classList.contains("on"));b.classList.toggle("dot",!!bell.querySelector("[class*=badge],[class*=dot],[class*=cnt],sup"))}}
 var t=q("theme");if(t)t.hidden=!fab;var y=q("eye");if(y){y.hidden=!eye;y.classList.toggle("on",!!(eye&&eye.classList.contains("on")))}
 if(hb)document.body.style.setProperty("--dqr-top",Math.max(0,hb.getBoundingClientRect().bottom)+"px")}
function toolClick(k){var m={bell:findBell(),theme:$("dq13-fab"),eye:$("dq13-eye")};if(k==="search"){A.news();return}var n=m[k];if(n)n.click()}
function wire(el){
 el.addEventListener("click",function(e){var t=e.target,tl=t.closest&&t.closest("[data-tl]");
  if(tl){e.preventDefault();e.stopPropagation();toolClick(tl.dataset.tl);return}
  if(S.edit){var x=t.closest("[data-x]");if(x){e.preventDefault();itemOp(x);return}var ad=t.closest("[data-add]");if(ad){e.preventDefault();addItem(ad.dataset.add);return}var sb=t.closest("[data-sx]");if(sb){var a=sb.dataset.sx.split("|");secOp(a[0],a[1]);return}
   if(t.closest("[data-lp],[data-p],[data-ip]")){if(t.closest("a"))e.preventDefault();select(t)}else{S.sel=null;tbar()}return}
  var b=t.closest("[data-lp]");if(b){e.preventDefault();run((gp(cfg,b.dataset.lp)||{}).a);return}
  var d=t.closest("[data-a]");if(d){e.preventDefault();run(d.dataset.a)}});
 el.addEventListener("focusin",function(e){if(S.edit&&e.target.closest&&e.target.closest("[data-p]"))snap()});
 el.addEventListener("input",function(e){var n=e.target.closest&&e.target.closest("[data-p]");if(!S.edit||!n)return;var v=n.innerText.replace(/\n$/,"");sp(cfg,n.dataset.p,v);dirty();
  if(n.dataset.p==="an.pct"){var r=el.querySelector(".ring");if(r)r.style.setProperty("--p",pct(v)+"%")}
  var m=n.dataset.p.match(/^an\.bars\.(\d+)\.v$/);if(m){var i=el.querySelectorAll(".bars s i")[m[1]];if(i)i.style.width=pct(v)+"%"}});
 el.addEventListener("keydown",function(e){var n=e.target.closest&&e.target.closest("[data-p]");if(!S.edit||!n||e.key!=="Enter")return;e.preventDefault();if(n.dataset.ml)document.execCommand("insertLineBreak");else n.blur()});
 el.addEventListener("paste",function(e){var n=e.target.closest&&e.target.closest("[data-p]");if(!S.edit||!n)return;e.preventDefault();document.execCommand("insertText",false,(e.clipboardData||window.clipboardData).getData("text/plain"))})}

/* ---------- qoşulma ---------- */
function init(){var c=null;try{c=JSON.parse(localStorage.getItem("dqr_cache2")||"null")}catch(e){}
 DEFC=makeDef();cfg=merge(CL(DEFC),c&&c.v===2?c:null);S.ready=true;ui();
 loadCfg().then(function(f){if(f&&!S.edit){var m=merge(CL(DEFC),f);if(JSON.stringify(m)!==JSON.stringify(cfg)){cfg=m;rebuild()}try{localStorage.setItem("dqr_cache2",JSON.stringify(f))}catch(e){}}loadImgs()})}
function mount(){
  var h=$("v3-home");if(!h||!gV3()||!V3.D||!gV2())return;
  if(!S.ready)init();
  var fab=$("dqe-fab");if(fab)fab.hidden=S.edit||!isAdmin();
  var vis=h.getClientRects().length>0&&!!$("dqr");document.body.classList.toggle("dqr-hdr",vis);if(vis)tools();
  var el=$("dqr");
  if(!el||!h.contains(el)){if(!h.querySelector(".v3-hero")&&!el)return;
    el=document.createElement("div");el.id="dqr";el.innerHTML=build();wire(el);h.insertBefore(el,h.firstChild);h.classList.add("dqr-on");theme();loadNews();loadImgs();secList()}
  if(S.edit){adopt();return}
  var sig=(logged()?1:0)+"|"+(window.LX&&LX.cache?LX.cache.map(function(x){return x._id+(x.title||"")}).join():"");
  if(el.__sig!==sig){var first=el.__sig==null;el.__sig=sig;if(!first){var y=window.scrollY;el.innerHTML=build();theme();loadNews();window.scrollTo(0,y)}}
  adopt()}
window.DQR={S:S,build:function(){return build()},cfg:function(){return cfg},init:init};
setInterval(function(){try{mount()}catch(e){}},500);
setInterval(loadNews,60000);
})();
