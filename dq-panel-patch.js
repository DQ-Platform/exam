/* DQ Panel Patch: (1) şablon cədvəlinə «Sınaq №» (2) idarəetmə panelindən sifariş/məzun kartlarının silinməsi (3) Pro Add statistikası */
(function(){"use strict";
var $=function(i){return document.getElementById(i)},DB=null,tm=null;
function sb(){return window._supabase||null}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function nz(s){return String(s||"").toLowerCase().replace(/\s+/g," ").trim()}
/* ---- məlumat: bankdakı suallar + Pro Add-də gözləyənlər ---- */
async function data(force){
 if(DB&&!force&&Date.now()-DB.t<60000)return DB;
 var rows=[],sub=null;
 try{var q=await sb().from("exam_questions").select("*").limit(20000);if(q.error)throw q.error;rows=q.data||[];
  var K=rows[0]?Object.keys(rows[0]):[];sub=K.filter(function(k){return/^(subject(_name)?|fenn|fənn|section|topic|lesson|bolme|bölmə)$/i.test(k)})[0]}catch(e){}
 var bank=rows.map(function(r){return{e:String(r.exam_id),c:r.category,s:sub?r[sub]:"—"}});
 var pend=[];try{pend=(JSON.parse(localStorage.getItem("proadd_questions_v1")||"[]")||[]).map(function(q){return{e:String(q.exam||"1"),c:q.category,s:q.subject||"—"}})}catch(e){}
 DB={t:Date.now(),bank:bank,pend:pend,ok:!!rows.length};return DB}
function agg(list){var m={};list.forEach(function(x){var a=m[x.e]=m[x.e]||{},b=a[x.c]=a[x.c]||{n:0,s:{}};b.n++;b.s[x.s]=(b.s[x.s]||0)+1});return m}
/* ---- 1) şablon cədvəli: Sınaq № sütunu ---- */
async function templates(){
 var tb=Array.prototype.find.call(document.querySelectorAll("table"),function(t){var h=t.textContent;return/Şablon Adı/.test(h)&&/Sual\s*Sayı/.test(h)&&t.offsetParent});
 if(!tb)return;
 var ths=tb.querySelectorAll("thead th,thead td"),ci=-1;
 ths.forEach(function(h,i){if(/Təsnifat/.test(h.textContent))ci=i});if(ci<0)return;
 var d=await data(),m={};d.bank.forEach(function(x){var k=nz(x.s)+"|"+x.c;(m[k]=m[k]||{})[x.e]=1});
 var hr=ths[0].parentNode;
 if(!/Sınaq/.test(hr.textContent)){var th=document.createElement(ths[ci].tagName);th.textContent="Sınaq №";hr.insertBefore(th,ths[ci].nextSibling)}
 tb.querySelectorAll("tbody tr").forEach(function(r){
  if(r.dataset.sn||r.children.length<=ci)return;r.dataset.sn="1";
  var nm=nz(r.children[0].textContent),ct=r.children[ci].textContent.trim(),ex={};
  Object.keys(m).forEach(function(k){var p=k.split("|");if(p[1]===ct&&p[0]&&(nm.indexOf(p[0])>-1||p[0].indexOf(nm)>-1))Object.keys(m[k]).forEach(function(e){ex[e]=1})});
  var td=document.createElement("td"),l=Object.keys(ex).sort(function(a,b){return a-b});td.textContent=l.length?l.join(", "):"—";td.style.fontWeight="700";
  r.insertBefore(td,r.children[ci].nextSibling)})}
/* ---- 2) idarəetmə paneli: sifariş və məzun kartları silinir ---- */
function dash(){
 var KEEP=["İmtahan Sualları","İmtahan Sessiyası"],DEL=["Ümumi Sifariş","Məzun/Tələbələr"];
 function leaf(t){return Array.prototype.find.call(document.querySelectorAll("div,span,p,h3,h4,h5,small,b"),function(e){return!e.children.length&&e.textContent.trim()===t&&e.offsetParent})}
 function keeps(e){return KEEP.some(function(k){return e.textContent.indexOf(k)>-1})}
 DEL.forEach(function(t){var e=leaf(t);if(!e)return;while(e.parentElement&&!keeps(e.parentElement)&&e.parentElement!==document.body)e=e.parentElement;if(!keeps(e))e.style.display="none"});
 var h=leaf("Son Kitab Sifarişləri");if(h&&!h.dataset.rm){h.dataset.rm=1;var n=h.nextElementSibling;h.style.display="none";if(n)n.style.display="none"}}
/* ---- 3) Pro Add statistikası ---- */
async function stats(){
 var o=$("rsp-st");if(!o){o=document.createElement("div");o.id="rsp-st";o.style.cssText="position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.6);display:flex;align-items:flex-end;justify-content:center";document.body.appendChild(o)}
 o.style.display="flex";o.innerHTML='<div style="background:#fff;color:#0f172a;width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px"><b>Yüklənir…</b></div>';
 var d=await data(true),B=agg(d.bank),P=agg(d.pend),ex=Object.keys(B).concat(Object.keys(P)).filter(function(v,i,a){return a.indexOf(v)===i}).sort(function(a,b){return a-b});
 var h='<div style="background:#fff;color:#0f172a;width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px;font-family:inherit"><div style="display:flex;justify-content:space-between;align-items:center;position:sticky;top:-16px;background:#fff;padding:8px 0"><b style="font-size:18px">📊 Pro Add statistikası</b><button id="rsp-x" style="border:0;background:#e2e8f0;border-radius:10px;padding:8px 14px;font-weight:700">Bağla</button></div>'+
 '<div style="display:flex;gap:8px;margin:8px 0 14px;flex-wrap:wrap"><div style="flex:1;background:#eef2ff;border-radius:12px;padding:10px;text-align:center">Bankda<br><b style="font-size:22px">'+d.bank.length+'</b></div><div style="flex:1;background:#fffbeb;border-radius:12px;padding:10px;text-align:center">Pro Add-də gözləyən<br><b style="font-size:22px">'+d.pend.length+'</b></div></div>';
 if(!ex.length)h+='<p>Hələ sual yoxdur.</p>';
 ex.forEach(function(e){h+='<h4 style="margin:14px 0 6px">Sınaq '+esc(e)+'</h4>';
  var cs=Object.keys(Object.assign({},B[e]||{},P[e]||{})).sort();
  cs.forEach(function(c){var b=(B[e]||{})[c]||{n:0,s:{}},p=(P[e]||{})[c]||{n:0,s:{}},pc=Math.min(100,Math.round(b.n)),ss={};
   Object.keys(b.s).forEach(function(k){ss[k]=(ss[k]||0)+b.s[k]});Object.keys(p.s).forEach(function(k){ss[k]=ss[k]||0});
   h+='<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:8px"><div style="display:flex;justify-content:space-between"><b>'+esc(c)+'</b><span>'+b.n+'/100'+(p.n?' <span style="color:#b45309">+'+p.n+' gözləyir</span>':'')+'</span></div>'+
   '<div style="height:8px;background:#e2e8f0;border-radius:9px;margin:6px 0;overflow:hidden"><div style="height:100%;width:'+pc+'%;background:#16a34a"></div></div><div style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px">'+
   Object.keys(ss).map(function(k){var w=(p.s[k]||0);return'<span style="background:#f1f5f9;border-radius:8px;padding:3px 8px">'+esc(k)+': <b>'+(b.s[k]||0)+'</b>'+(w?' <i style="color:#b45309">+'+w+'</i>':'')+'</span>'}).join("")+'</div></div>'})});
 if(!d.ok)h+='<p style="color:#b91c1c">Bazadan sual oxunmadı (admin kimi daxil olun).</p>';
 o.innerHTML=h+'</div>';$("rsp-x").onclick=function(){o.style.display="none"};o.onclick=function(e){if(e.target===o)o.style.display="none"}}
window.DQProAddStats=stats;
function menu(){
 var g=document.querySelector(".admin-nav-grid");
 if(g&&!$("rsp-nav")){var c=document.createElement("div");c.id="rsp-nav";c.className="admin-nav-card";c.style.cssText="background:#0f766e;color:#fff";c.innerHTML='<span class="icon">📊</span> Pro Add Statistika';c.onclick=stats;g.insertBefore(c,g.firstChild)}
 var l=Array.prototype.find.call(document.querySelectorAll("a,li,button,div,span"),function(e){return!e.children.length&&e.textContent.trim()==="İmtahan Şablonları"&&e.offsetParent&&!e.closest("table")});
 if(l&&!$("rsp-side")){var it=l;while(it.parentElement&&it.parentElement.children.length<2)it=it.parentElement;
  if(it.parentElement){var cl=it.cloneNode(true);cl.id="rsp-side";Array.prototype.slice.call(cl.attributes).forEach(function(a){if(/^(data-|on|href)/.test(a.name))cl.removeAttribute(a.name)});
   cl.classList.remove("active","on","is-active");cl.style.cursor="pointer";
   var t=Array.prototype.find.call(cl.querySelectorAll("*"),function(e){return!e.children.length&&/Şablon/.test(e.textContent)})||cl;t.textContent="Pro Add Statistika";
   cl.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();stats()},true);it.parentElement.insertBefore(cl,it.nextSibling)}}}
function run(){try{dash();menu();templates()}catch(e){}}
new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(run,250)}).observe(document.body,{childList:true,subtree:true});run();
})();
