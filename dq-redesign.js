/* DQ Platform — yeni ana səhifə (mockup-a uyğun). Mövcud funksiyalara (V3, LXP, YQ, DQ, LX, V2) toxunmur, yalnız çağırır. */
(function(){"use strict";
var $=function(i){return document.getElementById(i)};
var E=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var S={news:[]},AZ=["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"];
try{var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";document.head.appendChild(l)}catch(e){}
var IM=function(n){return'<img src="img/'+n+'.png" alt="" loading="lazy">'};
var LOGO='<img src="img/logo.png" alt="DQ">';
function logged(){try{if(window.DQ10&&DQ10.logged)return DQ10.logged()}catch(e){}try{if(YQ2.sess())return true}catch(e){}try{var c=DQ.cabinet();return!!(c&&(c.fin||c.name))}catch(e){}return false}
function T(){return window.V3&&V3.D&&V3.D.txt||{}}
function items(){return window.V3&&V3.D&&V3.D.items||{}}
function ended(x){try{return x.status==="Bitib"||LX.endOf(x).getTime()<=Date.now()}catch(e){return false}}
function prices(){try{var o=JSON.parse(localStorage.getItem("dq_prices_cache")||"null");return o&&o.map||{}}catch(e){return{}}}
function money(v){var n=Math.round(parseFloat(v)*100)/100;return isNaN(n)?"":n+" ₼"}
function dmy(d){var p=function(n){return String(n).padStart(2,"0")};return p(d.getDate())+"."+p(d.getMonth()+1)+"."+d.getFullYear()+" · "+p(d.getHours())+":"+p(d.getMinutes())}
function icon(s){s=String(s||"");return/qanun|hüquq/i.test(s)?"i3":/az[əe]rbaycan|dil/i.test(s)?"i2":/informat|kompüter/i.test(s)?"i4":"i1"}

function exams(){
  var ex=[];try{ex=(LX.cache||[]).filter(function(x){return x&&x.start&&!ended(x)}).sort(function(a,b){return new Date(a.start)-new Date(b.start)}).slice(0,4)}catch(e){}
  if(ex.length)return ex.map(function(x){
    var p=x.pay&&typeof x.pay==="object"&&x.pay.on?money(x.pay.price):"Pulsuz",cap=parseInt(x.cap)>0?x.cap+" yer":"Limitsiz",c=String(x.cat||"").toUpperCase();
    return'<article class="ex '+E(c)+'"><div class="tp">'+IM(icon((x.subject||"")+" "+x.title))+'<span class="tag">'+E(c||"DQ")+'</span></div><h3>'+E(x.title)+'</h3><div class="ch"><span>'+E(p)+'</span><span>'+E(cap)+'</span><span>'+E(dmy(new Date(x.start)))+'</span></div><a class="b g" data-a="exam">İştirak et →</a></article>'}).join("");
  var pr=prices();
  return[["i1","Ümumi sınaq imtahanı","BB"],["i2","Azərbaycan dili","BB"],["i3","Qanunvericilik","AC"],["i4","İnformatika","BA"]].map(function(d){
    var pc=pr[d[2]]!=null&&pr[d[2]]!==""?money(pr[d[2]]):"Sınaq";
    return'<article class="ex '+d[2]+'"><div class="tp">'+IM(d[0])+'<span class="tag">'+d[2]+'</span></div><h3>'+d[1]+'</h3><div class="ch"><span>'+E(pc)+'</span><span>Onlayn</span><span>Real format</span></div><a class="b g" data-a="exam">İştirak et →</a></article>'}).join("")}

function newsHtml(){
  if(!S.news.length)return'<div class="em">Hələlik yenilik yoxdur.</div>';
  return S.news.map(function(n){var d=new Date(n.pub||n.date||""),ok=!isNaN(d);
    return'<a class="it" data-a="news"><div class="dt"><b>'+(ok?d.getDate():"•")+'</b>'+(ok?AZ[d.getMonth()]:"")+'</div><div><h3>'+E(n.title)+'</h3><small>'+E(n.kind||"Xəbər")+'</small></div></a>'}).join("")}

function build(){
  var t=T(),it=items(),on=logged(),
  soc=(V3.D&&V3.D.groups&&V3.D.groups.soc||[]).filter(function(k){return it[k]&&!it[k].h}),
  nav=[["Ana səhifə","go","n1"],["Yeniliklər","news"],["Sınaqlar","exam"],["Testlər","tests"],["İmtahan","exam"],["Materiallar","sc","dqr-wh"],["Haqqımızda","sc","dqr-ft"]],
  navH=nav.map(function(n,i){return'<a data-a="'+n[1]+'"'+(n[2]?' data-k="'+n[2]+'"':"")+(i?"":' class="on"')+'>'+n[0]+'</a>'}).join("");
  var brand='<div class="lg" data-a="go" data-k="n1">'+LOGO+'<span>PLATFORM</span></div>';
  return'<header class="hd"><div class="w">'+brand+'<nav aria-label="Əsas menyu">'+navH+'</nav><div class="au"><a class="b sq" data-a="news" aria-label="Axtar">🔍</a>'
  +(on?'<a class="b g" data-a="kab">Kabinet</a><a class="b" data-a="out">Çıxış</a>':'<a class="b" data-a="in">Daxil ol</a><a class="b g" data-a="reg">Qeydiyyat</a>')+'</div></div></header>'
  +'<main><div class="hero"><div class="bg" role="img" aria-label="Kompüter və telefonda onlayn imtahan"></div><div class="w"><div class="tx"><div class="ey">DÖVLƏT QULLUĞU</div><h1>Hədəfiniz<br>dövlət qulluğudur?<span>Biz sizinləyik!</span></h1>'
  +'<p>DQ Platform – dövlət qulluğu üzrə sınaq imtahanları, aktual materiallar və peşəkar hazırlıq imkanı verir. Uğur səninlədir!</p><a class="cta" data-a="exam">Sınaq imtahanına başla<i>→</i></a></div>'
  +'<div class="mini"><div>'+IM("m1")+'DİM modelinə uyğun imtahanlar</div><div>'+IM("m2")+'Təhlil və nəticə analizi</div><div>'+IM("m3")+'Hər zaman və hər yerdə</div><div>'+IM("m4")+'Təkmilləşdirilmiş platforma</div></div></div></div>'
  +'<section><div class="w"><div class="sh"><div><h2>İmtahanlar və sınaqlar</h2><p>Öz səviyyəni yoxla, nəticəni təhlil et, uğura bir addım da yaxın ol!</p></div><a data-a="exam">Bütün sınaqlar →</a></div><div class="g4" id="dqr-ex">'+exams()+'</div></div></section>'
  +'<section><div class="w"><div class="an"><div><h2>Nəticəni təhlil et, gələcəyini planla</h2><p>Hər sınaqdan sonra detallı nəticə analizi, zəif mövzuların müəyyənləşdirilməsi və fərdi inkişaf planı ilə hazırlığını daha səmərəli qur.</p><a class="b o" data-a="exam">Nəticə analizi →</a></div>'
  +'<div class="rs"><div class="rg"><div class="ring"><b>85%</b></div>Ümumi nəticə</div><div class="st"><div>Düzgün cavablar<b>34</b></div><div>Səhv cavablar<b>6</b></div><div>Boş qalanlar<b>0</b></div></div>'
  +'<div class="bars"><b>Fənlər üzrə nəticə</b><div>Azərbaycan dili<s><i style="width:92%;background:#25d478"></i></s>92%</div><div>Qanunvericilik<s><i style="width:78%;background:#f0c24f"></i></s>78%</div><div>İnformatika<s><i style="width:85%;background:#2e8bff"></i></s>85%</div><div>Məntiq<s><i style="width:70%;background:#8b4dff"></i></s>70%</div></div><div class="smp">Nümunə nəticə görünüşü</div></div>'
  +'<div class="gr" role="img" aria-label="İnkişaf qrafiki"></div></div></div></section>'
  +'<section id="dqr-wh"><div class="w"><div class="sh"><div><h2>Niyə məhz DQ Platform?</h2></div></div><div class="wh"><div class="wy">'+IM("f1")+'DİM modelinə uyğun real sınaqlar</div><div class="wy">'+IM("f2")+'Dəqiq nəticə analizi və statistikalar</div><div class="wy">'+IM("f3")+'Aktual materiallar və qanunvericilik</div><div class="wy">'+IM("f4")+'Mobil uyğun istifadə</div><div class="wy">'+IM("f5")+'Stabil və təhlükəsiz platforma</div><div id="dqr-st"></div></div><div id="dqr-cnt"></div></div></section>'
  +'<section><div class="w"><div class="nb"><div class="nl"><div><h2>Son yeniliklər</h2><a data-a="news">Bütün yeniliklər →</a></div><div id="dqr-nw">'+newsHtml()+'</div></div>'
  +'<div class="bn"><small>DÖVLƏT QULLUĞU</small><h2>Daha yaxşı bir gələcək səninlədir!</h2><p>Peşəkar hazırlıq, real nəticə!</p><a class="cta" data-a="exam">Sınaq imtahanına başla<i>→</i></a><div class="chp"><span>Dəqiq məlumat</span><span>Peşəkar təhlil</span><span>Real nəticə</span><span>Uğurlu karyera</span></div></div></div></div></section></main>'
  +'<footer class="ft" id="dqr-ft"><div class="w"><div>'+brand+'<small>Dövlət qulluğu sınaq imtahanı</small></div><nav>'+navH.replace(' class="on"',"")+'</nav>'
  +'<div class="so">'+soc.map(function(k){return'<a data-a="go" data-k="'+k+'" aria-label="'+E(it[k].t)+'">'+E(it[k].t)+'</a>'}).join("")+'</div>'
  +'<div class="cp"><span>'+E(t.foot1||"© 2026 DQ Platform")+' '+E(t.foot2||"")+'</span><span><a data-a="info" data-k="terms">İstifadə Şərtləri</a><a data-a="info" data-k="priv">Məxfilik Siyasəti</a></span></div></div></footer>'}

var A={
 go:function(k){V3.go(k)},in:function(){YQ.open("in")},reg:function(){YQ.open("reg")},kab:function(){V3.go("kab")},out:function(){DQ.logout()},
 exam:function(){if(window.LXP&&LXP.open)LXP.open();else V3.go("n2")},tests:function(){V3.showTests()},news:function(){openFeedModal("news")},info:function(k){V3.info(k)},
 sc:function(id){var e=$(id);if(e)e.scrollIntoView({behavior:"smooth"})}};

function adopt(){var c=$("dqr-cnt"),s=$("dqr-st"),a=$("dq-count"),b=$("dq-stats");
  if(c&&a&&a.parentNode!==c)c.appendChild(a);if(s&&b&&b.parentNode!==s)s.appendChild(b)}
function loadNews(){if(!window.V2||!V2.list)return;V2.list("news").then(function(l){
  S.news=(l||[]).filter(function(n){return n.title&&!(n.kind&&/^(exam|imtahan-sinaq)$/i.test(n.kind))}).sort(function(a,b){return String(b.pub||b.date||"").localeCompare(String(a.pub||a.date||""))}).slice(0,3);
  var el=$("dqr-nw");if(el)el.innerHTML=newsHtml()}).catch(function(){})}
function mount(){
  var h=$("v3-home");if(!h||!window.V3||!V3.D||!window.V2)return;
  var el=$("dqr");
  if(!el||!h.contains(el)){
    if(!h.querySelector(".v3-hero"))return;
    el=document.createElement("div");el.id="dqr";el.innerHTML=build();
    el.addEventListener("click",function(e){var b=e.target.closest("[data-a]");if(!b)return;e.preventDefault();var f=A[b.getAttribute("data-a")];if(f)f(b.getAttribute("data-k"))});
    h.insertBefore(el,h.firstChild);h.classList.add("dqr-on");loadNews()}
  var sig=(logged()?1:0)+"|"+(window.LX&&LX.cache?LX.cache.map(function(x){return x._id+(x.title||"")}).join():"");
  if(el.__sig!==sig){var first=el.__sig==null;el.__sig=sig;if(!first){var sc=window.scrollY;el.innerHTML=build();loadNews();window.scrollTo(0,sc)}}
  adopt()}
setInterval(function(){try{mount()}catch(e){}},500);
setInterval(loadNews,60000);
})();
