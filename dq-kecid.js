/* DQ Platform · Keçid İdarəsi v2
   Ana səhifədəki hər düymə çip kimi görünür; toxun → mətn / alt mətn / rəng / sıra / gizlət və
   «Toxunanda nə olsun?» siyahısından saytın bölmələrini, saytdakı BÜTÜN JS funksiyalarını (avtomatik tapılır)
   və mövcud düymələrin əməliyyatlarını seç. «+ əlavə et» ilə yeni düymə yarat. */
(function(){"use strict";
if(window.DQKecid&&window.DQKecid.v===2)return;
var D=document,LS="dq_kecid_v2",U="https://cpzwliqlgaplroscvduo.supabase.co",K="sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
var R={rules:{},custom:[],order:{}},ui,scan=[],bypass=false,CAT=null;
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var norm=function(t){return String(t||"").replace(/\s+/g," ").trim().toLocaleUpperCase("az")};
var EXCL="#dqk,#dqb,[id*=admin],[class*=admin],.modal,[role=dialog]";
try{var o=JSON.parse(localStorage.getItem(LS)||"null");if(o&&o.rules)R=o}catch(e){}
function sv(){try{localStorage.setItem(LS,JSON.stringify(R))}catch(e){}}
function pull(){return fetch(U+"/rest/v1/dq_v2_store?select=data&collection=eq.kecid2&order=id.desc&limit=1&_t="+Date.now(),{headers:{apikey:K,Authorization:"Bearer "+K}}).then(function(r){return r.ok?r.json():null}).then(function(a){var d=a&&a[0]&&a[0].data;if(d&&d.rules){R={rules:d.rules,custom:d.custom||[],order:d.order||{}};sv();apply()}}).catch(function(){})}
function push(){sv();return fetch(U+"/rest/v1/dq_v2_store",{method:"POST",headers:{apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({collection:"kecid2",data:{rules:R.rules,custom:R.custom,order:R.order,t:Date.now()}})}).then(function(r){return r.ok}).catch(function(){return false})}
function toast(t,bad){var e=D.createElement("div");e.textContent=t;e.style.cssText="position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:"+(bad?"#b42318":"#0c2260")+";color:#fff;padding:11px 18px;border-radius:12px;z-index:2147483600;font:600 14px system-ui;max-width:86vw";D.body.appendChild(e);setTimeout(function(){e.remove()},2600)}

/* ---------- skan ---------- */
function label(el){var own=(el.innerText||el.textContent||"").replace(/\s+/g," ").trim();return(own||el.getAttribute("aria-label")||el.title||"").slice(0,40)}
function region(el){if(el.dataset.dqkReg)return el.dataset.dqkReg;
 if(el.closest("nav"))return"Menyu";if(el.closest("header,#login-topbar,.login-topbar"))return"Başlıq düymələri";if(el.closest("footer"))return"Alt hissə";
 var s=el.closest("section,[id]");for(var i=0;s&&i<4;i++){var h=s.querySelector("h1,h2,h3");if(h&&h.textContent.trim())return h.textContent.trim().slice(0,40);s=s.parentElement&&s.parentElement.closest("section,[id]")}return"Digər düymələr"}
function collect(){var seen={},out=[];
 Array.prototype.forEach.call(D.querySelectorAll("a,button,[role=button],[role=tab]"),function(el){
  if(el.closest(EXCL))return;var lb=label(el);if(!lb&&!el.querySelector("svg,i,img"))return;
  var r=el.getBoundingClientRect();if(!el.dataset.dqkKey&&r.width===0&&r.height===0)return;
  var reg=region(el),k=el.dataset.dqkKey&&el.dataset.dqkKey.indexOf("custom|")===0?el.dataset.dqkKey:reg+"|"+norm(el.dataset.dqkOrig||lb||el.id||el.className);
  if(k.indexOf("custom|")!==0){seen[k]=(seen[k]||0)+1;if(seen[k]>1)k+="#"+seen[k]}
  el.dataset.dqkKey=k;out.push({el:el,key:k,reg:reg,txt:lb||"(ikon)",orig:el.dataset.dqkOrig||lb})});
 return out}

/* ---------- əməliyyat kataloqu (avtomatik) ---------- */
function goTab(names){names=[].concat(names);for(var i=0;i<names.length;i++){var n=norm(names[i]),f=Array.prototype.filter.call(D.querySelectorAll("nav a,nav button,nav li,nav span,header a,header button,[role=tab]"),function(e){return norm(e.textContent)===n&&!e.closest(EXCL)})[0];if(f){bypass=true;try{f.click()}finally{bypass=false}return true}}return false}
function scrollTo(txt){var n=norm(txt),h=Array.prototype.filter.call(D.querySelectorAll("h1,h2,h3,h4,section,[id]"),function(e){return norm(e.textContent).indexOf(n)===0||e.id===txt})[0];if(h){h.scrollIntoView({behavior:"smooth",block:"start"});return true}return false}
function clickText(rx){var f=Array.prototype.filter.call(D.querySelectorAll("a,button"),function(e){return rx.test(norm(e.textContent))&&!e.closest(EXCL)})[0];if(f){bypass=true;try{f.click()}finally{bypass=false}return true}return false}
function fnPath(p){var o=window,a=p.split(".");for(var i=0;i<a.length-1;i++){o=o&&o[a[i]]}return{o:o,f:o&&o[a[a.length-1]]}}
var P=[
 ["home","Ana səhifə","Saytın bölmələri",function(){return goTab("ANA SƏHİFƏ")||(window.scrollTo(0,0),true)}],
 ["news","Yeniliklər / elanlar","Saytın bölmələri",function(){return goTab(["YENİLİKLƏR","XƏBƏRLƏR"])||scrollTo("Yeniliklər")}],
 ["sinaq","Sınaqlar","Saytın bölmələri",function(){return goTab("SINAQLAR")||(window.DQBol&&DQBol.sinaqlar())}],
 ["tests","Testlər","Saytın bölmələri",function(){return goTab("TESTLƏR")||(window.V3&&V3.showTests&&(V3.showTests(),true))}],
 ["exam","İmtahanlar səhifəsi (aktiv sessiyalar)","Saytın bölmələri",function(){return goTab("İMTAHAN")||(window.DQExam&&(DQExam.open("reg"),true))}],
 ["mat","Dərs materialları","Saytın bölmələri",function(){return goTab("MATERİALLAR")||(window.DQBol&&(DQBol.materials(),true))}],
 ["info","Məlumat bölməsi","Saytın bölmələri",function(){return goTab("MƏLUMAT")||scrollTo("Məlumat")}],
 ["law","Qanunvericilik bölməsi","Saytın bölmələri",function(){return goTab("QANUNVERİCİLİK")||scrollTo("Qanunvericilik")}],
 ["prep","Hazırlıq materialları (qanunlar, flaşkart, test)","Saytın bölmələri",function(){return goTab("HAZIRLIQ")||scrollTo("Hazırlıq")||(window.DQBol&&(DQBol.materials(),true))}],
 ["start","Sınaq imtahanına başla","Hesab və imtahan",function(){return window.DQExam?(DQExam.open("sinaq"),true):clickText(/SINAQ İMTAHANINA BAŞLA|SINAQLARA BAX/)}],
 ["reg","Qeydiyyat paneli","Hesab və imtahan",function(){return window.DQExam?(DQExam.open("reg"),true):clickText(/QEYDİYYAT/)}],
 ["cab","Kabinet / Daxil ol","Hesab və imtahan",function(){return clickText(/^(DAXİL OL|KABİNET|DAXİL OL\/QEYDİYYAT)/)}],
 ["out","Çıxış","Hesab və imtahan",function(){var f=["logout","doLogout","signOut","handleLogout","userLogout"].filter(function(n){return typeof window[n]==="function"})[0];if(f){window[f]();return true}return clickText(/^ÇIXIŞ$/)}]
];
var DANGER=/(delete|remove|clear|reset|wipe|drop|purge|truncate|destroy|erase|sil\b|overwrite|replace|publish|upload|import)/i;
var SKIP=/^(supabase|_supabase|pdfjs|pdfjsLib|Tesseract|jspdf|jsPDF|html2canvas|gsap|Chart|XLSX|mammoth|JSZip|Swal|firebase|gtag|dataLayer|ga|fbq|google|webkit|chrome|CSS|React|ReactDOM)/;
var HUM={open:"aç",show:"göstər",close:"bağla",toggle:"aç/bağla",start:"başla",go:"keç",step:"addım",switch:"keç",render:"göstər",load:"yüklə",hide:"gizlət",next:"növbəti",prev:"əvvəlki",submit:"göndər",check:"yoxla",login:"daxil ol",logout:"çıxış",share:"paylaş",copy:"kopyala",print:"çap et",download:"yüklə",refresh:"yenilə",scroll:"sürüşdür",cancel:"ləğv et",save:"saxla"};
function human(n){var w=n.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[_\-]+/g," ").split(" ").filter(Boolean);var v=w[0]&&HUM[w[0].toLowerCase()];return v?(w.slice(1).join(" ")+" — "+v).trim():w.join(" ")}
function discover(){
 if(CAT)return CAT;var base={};try{var ifr=D.createElement("iframe");ifr.style.display="none";D.body.appendChild(ifr);Object.getOwnPropertyNames(ifr.contentWindow).forEach(function(k){base[k]=1});ifr.remove()}catch(e){}
 var fns=[],seen={};
 Object.getOwnPropertyNames(window).forEach(function(k){if(base[k]||SKIP.test(k)||/^(on|webkit|__|DQKecid|DQBol$)/.test(k)||k.length<3)return;var v;try{v=window[k]}catch(e){return}
  if(typeof v==="function"){if(/\[native code\]/.test(Function.prototype.toString.call(v))||/^class\s/.test(Function.prototype.toString.call(v)))return;add(k,v,k)}
  else if(v&&typeof v==="object"&&!(v instanceof Node)&&!(v instanceof Window)&&!Array.isArray(v)){var n=0;Object.getOwnPropertyNames(v).forEach(function(m){if(n>80||m[0]==="_"||/^(constructor|toString)$/.test(m))return;var f;try{f=v[m]}catch(e){return}if(typeof f==="function"&&!/\[native code\]/.test(Function.prototype.toString.call(f))&&!/^class\s/.test(Function.prototype.toString.call(f))){add(k+"."+m,f,k);n++}})}});
 function add(path,f,ns){if(seen[path])return;seen[path]=1;fns.push({path:path,ns:ns,len:f.length,danger:DANGER.test(path)})}
 var oc={};Array.prototype.forEach.call(D.querySelectorAll("[onclick]"),function(e){var c=(e.getAttribute("onclick")||"").trim();if(!c||c.length>200||c.indexOf("this")>=0&&!/^\w/.test(c))return;if(!oc[c])oc[c]={code:c,txt:label(e)||e.title||"",danger:DANGER.test(c)}});
 CAT={fns:fns.sort(function(a,b){return a.path.localeCompare(b.path)}),oc:Object.keys(oc).map(function(k){return oc[k]})};return CAT}
function runT(t){if(!t)return true;
 try{switch(t.type){
  case"p":var p=P.filter(function(x){return x[0]===t.value})[0];return p?p[3]():false;
  case"tab":return goTab(t.value);
  case"url":var v=t.value||"";if(/^\d{7,}$/.test(v))v="tel:+"+v;if(!/^(https?:|tel:|mailto:|\/|#)/i.test(v))v="https://"+v;if(t.blank===false)location.href=v;else window.open(v,"_blank","noopener");return true;
  case"scroll":return scrollTo(t.value);
  case"fn":var r=fnPath(t.value);if(typeof r.f!=="function"){toast("Funksiya tapılmadı: "+t.value,1);return false}var a=[];if(t.args){try{a=JSON.parse("["+t.args+"]")}catch(e){a=[t.args]}}r.f.apply(r.o,a);return true;
  case"js":new Function(t.value)();return true}}catch(e){toast("Xəta: "+(e&&e.message||e),1);return false}return true}
function tLabel(t){if(!t||t.type==="default")return"Standart (dəyişmə)";if(t.type==="none")return"Heç nə";if(t.type==="p"){var p=P.filter(function(x){return x[0]===t.value})[0];return p?p[1]:t.value}if(t.type==="tab")return"Bölmə: "+t.value;if(t.type==="url")return"Link: "+t.value;if(t.type==="scroll")return"Sürüşdür: "+t.value;if(t.type==="fn")return"Funksiya: "+t.value+"("+(t.args||"")+")";if(t.type==="js")return"Öz funksiyam (JS)";return""}

/* ---------- tətbiq ---------- */
var st=D.createElement("style");st.textContent="[data-dqk-hide]{display:none!important}.dqk-flash{outline:4px solid #e5a82c!important;outline-offset:3px}";D.head.appendChild(st);
var COLORS={"":["Olduğu kimi",""],green:["Yaşıl","#16a34a"],blue:["Mavi","#2563eb"],navy:["Tünd mavi","#0c2260"],red:["Qırmızı","#dc2626"],gold:["Sarı","#e5a82c"],purple:["Bənövşəyi","#7c3aed"],dark:["Qara","#111827"]};
function setText(el,txt){var tn=null,b=0;el.childNodes.forEach(function(n){if(n.nodeType===3&&n.textContent.trim().length>=b){b=n.textContent.trim().length;tn=n}});if(tn)tn.textContent=" "+txt+" ";else el.appendChild(D.createTextNode(txt))}
function apply(){
 var all=collect();
 /* yeni (əlavə olunmuş) düymələr */
 R.custom.forEach(function(c){if(D.querySelector('[data-dqk-key="custom|'+c.id+'"]'))return;var anc=null;all.forEach(function(o){if(o.reg===c.reg&&!/^custom\|/.test(o.key))anc=o});if(!anc)return;
  var cl=anc.el.cloneNode(true);cl.removeAttribute("id");cl.removeAttribute("onclick");cl.removeAttribute("href");cl.removeAttribute("data-dqk-hide");cl.dataset.dqkKey="custom|"+c.id;cl.dataset.dqkReg=c.reg;cl.dataset.dqkOrig=c.label;setText(cl,c.label);anc.el.parentNode.insertBefore(cl,anc.el.nextSibling)});
 all=collect();
 all.forEach(function(o){var r=R.rules[o.key],c=o.key.indexOf("custom|")===0?R.custom.filter(function(x){return"custom|"+x.id===o.key})[0]:null,rr=r||(c?{label:c.label,t:c.t,color:c.color,sub:c.sub,hide:c.hide}:null),el=o.el;
  el.toggleAttribute("data-dqk-hide",!!(rr&&rr.hide));
  if(rr&&rr.label&&norm(o.txt)!==norm(rr.label)){if(!el.dataset.dqkOrig)el.dataset.dqkOrig=o.orig;setText(el,rr.label)}
  if(rr&&rr.sub){var s=el.querySelector("small,p,[class*=sub],[class*=desc]");if(s)s.textContent=rr.sub}
  if(rr&&rr.color&&COLORS[rr.color]&&COLORS[rr.color][1]){el.style.setProperty("background",COLORS[rr.color][1],"important");el.style.setProperty("color",rr.color==="gold"?"#111":"#fff","important")}
  else if(el.dataset.dqkColored&&rr&&!rr.color){el.style.removeProperty("background");el.style.removeProperty("color")}
  el.dataset.dqkColored=rr&&rr.color?"1":""});
 Object.keys(R.order).forEach(function(reg){var els=R.order[reg].map(function(k){return D.querySelector('[data-dqk-key="'+k.replace(/"/g,'\\"')+'"]')}).filter(Boolean);if(els.length<2)return;var par=els[0].parentNode;if(!els.every(function(e){return e.parentNode===par}))return;var ref=els[els.length-1].nextSibling;els.forEach(function(e){par.insertBefore(e,ref)})})}
D.addEventListener("click",function(e){if(bypass||(ui&&ui.contains(e.target)))return;
 var el=e.target.closest&&e.target.closest("[data-dqk-key]");if(!el||el.closest(EXCL))return;var k=el.dataset.dqkKey,r=R.rules[k],c=k.indexOf("custom|")===0?R.custom.filter(function(x){return"custom|"+x.id===k})[0]:null,t=(r&&r.t)||(c&&c.t);
 if((r&&r.hide)||!t||t.type==="default")return;e.preventDefault();e.stopImmediatePropagation();if(t.type!=="none")runT(t)},true);

/* ---------- redaktor ---------- */
var css=D.createElement("style");css.textContent=
"#dqk{position:fixed;inset:0;z-index:2147483200;background:#f0f3f9;overflow:auto;display:none;font-family:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;color:#0b1b44}#dqk.on{display:block}"+
".dqk-bar{position:sticky;top:0;z-index:3;background:#0a2f7a;padding:12px;display:flex;gap:8px;flex-wrap:wrap}.dqk-bar button{border:0;border-radius:99px;padding:9px 16px;font-weight:700;background:#14388f;color:#fff;cursor:pointer;font-size:13px}.dqk-bar .r{background:#dc2626}.dqk-bar .v{background:#6d4cf5}"+
".dqk-w{max-width:880px;margin:0 auto;padding:14px}.dqk-hint{background:#ecfdf5;border-radius:12px;padding:14px;font-size:14px;margin-bottom:14px}.dqk-g{background:#fff;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px -18px #06112e}.dqk-g h4{margin:0 0 10px;font-size:16px}"+
".dqk-box{border:1.5px dashed #c5cde0;border-radius:12px;padding:10px;display:flex;flex-wrap:wrap;gap:8px;background:#fafbfe}.dqk-c{border:0;border-radius:99px;padding:8px 14px;background:#2f5fb8;color:#fff;font-weight:700;font-size:13px;cursor:pointer;max-width:100%}.dqk-c.h{opacity:.4}.dqk-c.add{background:#fff;color:#0b1b44;border:1px dashed #94a3b8}.dqk-c i{font-style:normal;margin-left:6px;background:rgba(255,255,255,.25);border-radius:8px;padding:1px 7px;font-size:11px}"+
".dqk-m{position:fixed;inset:0;background:rgba(6,17,46,.55);display:grid;place-items:center;z-index:5;padding:14px}.dqk-md{background:#fff;border-radius:18px;padding:20px;width:min(460px,100%);max-height:92vh;overflow:auto}.dqk-md label{display:block;font-weight:700;font-size:13px;margin:12px 0 5px}.dqk-md input,.dqk-md select,.dqk-md textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cfd6e6;border-radius:10px;font:inherit;font-size:15px}.dqk-md .row{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.dqk-md .row button{flex:1;border:0;border-radius:10px;padding:12px;font-weight:800;cursor:pointer;min-width:70px}"+
".dqk-pk{position:fixed;inset:0;z-index:7;background:rgba(6,17,46,.55);display:flex;align-items:flex-end;justify-content:center}.dqk-ps{background:#fff;width:min(560px,100%);max-height:88vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column}.dqk-ph{padding:14px 16px;border-bottom:1px solid #e5e7eb}.dqk-ph input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cfd6e6;border-radius:10px;font-size:15px;margin-top:8px}.dqk-pl{overflow:auto;flex:1}.dqk-gh{padding:10px 16px;background:#f1f5f9;font-weight:800;font-size:12px;color:#475569;position:sticky;top:0}.dqk-it{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 16px;border-bottom:1px solid #e5e7eb;cursor:pointer;font-size:16px}.dqk-it small{display:block;color:#64748b;font-size:12px;word-break:break-all}.dqk-rd{flex:none;width:24px;height:24px;border:2.5px solid #111;border-radius:50%}.dqk-it.on .dqk-rd{border-color:#2563eb;background:radial-gradient(#2563eb 45%,#fff 50%)}.dqk-it.dg b{color:#b42318}";
D.head.appendChild(css);
function open(){if(!ui){ui=D.createElement("div");ui.id="dqk";D.body.appendChild(ui)}ui.classList.add("on");D.body.style.overflow="hidden";render()}
function close(){ui.classList.remove("on");D.body.style.overflow=""}
function render(){scan=collect();var G={};scan.forEach(function(o){(G[o.reg]=G[o.reg]||[]).push(o)});
 var order=["Başlıq düymələri","Menyu"].filter(function(k){return G[k]}).concat(Object.keys(G).filter(function(k){return k!=="Başlıq düymələri"&&k!=="Menyu"&&k!=="Alt hissə"}),G["Alt hissə"]?["Alt hissə"]:[]);
 ui.innerHTML='<div class="dqk-bar"><button class="v" id="dqk-s">👁 Sayta bax</button><button id="dqk-rs">↺ Hamısını sıfırla</button><button class="r" id="dqk-x">✕ Bağla</button></div><div class="dqk-w"><div class="dqk-hint"><b>Keçid idarəsi:</b> düyməyə toxun → redaktə et (mətn, alt mətn, rəng, sıra, hara keçsin, gizlət / sil). «+ əlavə et» ilə yeni düymə yarat. Dəyişikliklər avtomatik saxlanır.</div>'+
  order.map(function(g){return'<div class="dqk-g"><h4>'+esc(g)+'</h4><div class="dqk-box">'+G[g].map(function(o){var r=R.rules[o.key],c=o.key.indexOf("custom|")===0?R.custom.filter(function(x){return"custom|"+x.id===o.key})[0]:null,rr=r||c||{},t=rr.t,x=rr.hide?"gizli":(t&&t.type!=="default"?"→":"");return'<button type="button" class="dqk-c'+(rr.hide?" h":"")+'" data-k="'+esc(o.key)+'">'+esc(rr.label||o.txt)+(x?'<i>'+x+'</i>':"")+'</button>'}).join("")+'<button type="button" class="dqk-c add" data-add="'+esc(g)+'">+ əlavə et</button></div></div>'}).join("")+'</div>';
 ui.querySelector("#dqk-x").onclick=close;ui.querySelector("#dqk-s").onclick=close;
 ui.querySelector("#dqk-rs").onclick=function(){if(confirm("Bütün keçid dəyişiklikləri sıfırlansın?")){R={rules:{},custom:[],order:{}};push().then(function(){location.reload()})}};
 Array.prototype.forEach.call(ui.querySelectorAll(".dqk-c[data-k]"),function(b){b.onclick=function(){edit(b.dataset.k)}});
 Array.prototype.forEach.call(ui.querySelectorAll(".dqk-c[data-add]"),function(b){b.onclick=function(){var id="c"+Date.now().toString(36);R.custom.push({id:id,reg:b.dataset.add,label:"Yeni düymə",t:{type:"default"}});apply();render();edit("custom|"+id)}})}
function picker(cur,done){
 var cat=discover(),pk=D.createElement("div");pk.className="dqk-pk";var showAll=false;
 pk.innerHTML='<div class="dqk-ps"><div class="dqk-ph"><b>Toxunanda nə olsun?</b><input id="pk-q" placeholder="Axtar: bölmə, funksiya, düymə…"><label style="display:flex;gap:6px;align-items:center;font-size:12px;margin-top:8px"><input type="checkbox" id="pk-d" style="width:auto;margin:0"> Dəyişdirici funksiyaları da göstər (sil, sıfırla…)</label></div><div class="dqk-pl" id="pk-l"></div></div>';ui.appendChild(pk);
 pk.addEventListener("click",function(e){if(e.target===pk)pk.remove()});
 var curKey=JSON.stringify([cur.type,cur.value]);
 function items(){var q=norm(pk.querySelector("#pk-q").value),L=[],sd=pk.querySelector("#pk-d").checked;
  var base=[["Standart (dəyişmə)",{type:"default"},"Standart"],["Heç nə (düymə işləməsin)",{type:"none"},"Standart"],["Link (URL / WhatsApp / Telegram / telefon)",{type:"url",value:"",blank:true},"Əlavə"],["Öz funksiyam (JS kodu)",{type:"js",value:""},"Əlavə"]];
  P.forEach(function(p){L.push([p[1],{type:"p",value:p[0]},p[2]])});base.forEach(function(b){L.push(b)});
  cat.oc.forEach(function(o){if(o.danger&&!sd)return;L.push([(o.txt?o.txt+" — ":"")+"düymə əməliyyatı",{type:"js",value:o.code},"Saytdakı düymələrin əməliyyatları (avtomatik)",o.code,o.danger])});
  cat.fns.forEach(function(f){if(f.danger&&!sd)return;L.push([human(f.path),{type:"fn",value:f.path,args:""},"Saytdakı funksiyalar (avtomatik)",f.path+"("+(f.len?f.len+" parametr":"")+")",f.danger]);});
  return L.filter(function(x){return!q||norm(x[0]+" "+(x[3]||"")).indexOf(q)>=0})}
 function draw(){var L=items(),h="",g="";L.forEach(function(x,i){if(x[2]!==g){g=x[2];h+='<div class="dqk-gh">'+esc(g)+'</div>'}var on=JSON.stringify([x[1].type,x[1].value])===curKey||(x[1].type==="url"&&cur.type==="url")||(x[1].type==="js"&&!x[1].value&&cur.type==="js"&&!cur.value);
  h+='<div class="dqk-it'+(on?" on":"")+(x[4]?" dg":"")+'" data-i="'+i+'"><div><b style="font-weight:600">'+esc(x[0])+'</b>'+(x[3]?'<small>'+esc(x[3])+'</small>':"")+'</div><span class="dqk-rd"></span></div>'});
  var l=pk.querySelector("#pk-l");l.innerHTML=h||'<div style="padding:24px;text-align:center;color:#64748b">Heç nə tapılmadı</div>';
  Array.prototype.forEach.call(l.querySelectorAll(".dqk-it"),function(el){el.onclick=function(){var x=L[+el.dataset.i];if(x[4]&&!confirm("Bu əməliyyat məlumatı dəyişə və ya silə bilər. Ziyarətçilər də bu düyməyə basa bilər. Yenə də seçilsin?"))return;pk.remove();done(JSON.parse(JSON.stringify(x[1])))}})}
 pk.querySelector("#pk-q").oninput=draw;pk.querySelector("#pk-d").onchange=draw;draw()}
function edit(k){
 var o=scan.filter(function(x){return x.key===k})[0];if(!o)return;var isC=k.indexOf("custom|")===0,c=isC?R.custom.filter(function(x){return"custom|"+x.id===k})[0]:null,r=isC?c:(R.rules[k]||{}),
  t=JSON.parse(JSON.stringify(r.t||{type:"default"})),m=D.createElement("div");m.className="dqk-m";
 m.innerHTML='<div class="dqk-md"><h3 style="margin:0">Redaktə</h3><small style="color:#64748b">'+esc(o.reg)+'</small><label>Mətn</label><input id="e-l" value="'+esc(r.label||(isC?"":o.txt))+'"><label>Alt mətn (kartlar üçün)</label><input id="e-s" value="'+esc(r.sub||"")+'">'+
  '<label>Toxunanda nə olsun?</label><button type="button" id="e-t" style="width:100%;text-align:left;padding:11px;border:1px solid #cfd6e6;border-radius:10px;background:#f1f5f9;font:inherit;font-size:15px"></button><div id="e-v"></div>'+
  '<label>Rəng</label><select id="e-c">'+Object.keys(COLORS).map(function(x){return'<option value="'+x+'"'+((r.color||"")===x?" selected":"")+'>'+COLORS[x][0]+'</option>'}).join("")+'</select>'+
  '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e-h" style="width:auto"'+(r.hide?" checked":"")+'> Gizlət</label>'+
  '<div class="row"><button id="e-l2" style="background:#eef2ff">◀ Sola</button><button id="e-r2" style="background:#eef2ff">Sağa ▶</button><button id="e-sh" style="background:#eef2ff">📍 Göstər</button></div>'+
  '<div class="row"><button id="e-ok" style="background:#2563eb;color:#fff">Saxla</button><button id="e-del" style="background:#ef4444;color:#fff">Sil</button><button id="e-c2" style="background:#0c2260;color:#fff">Ləğv</button></div></div>';
 ui.appendChild(m);
 function drawV(){m.querySelector("#e-t").textContent=tLabel(t);var v=m.querySelector("#e-v");
  v.innerHTML=t.type==="url"?'<label>Link</label><input id="e-val" placeholder="https://… və ya 994501234567" value="'+esc(t.value||"")+'"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="e-b" style="width:auto"'+(t.blank===false?"":" checked")+'> Yeni pəncərədə aç</label>':
   t.type==="js"?'<label>JS kodu</label><textarea id="e-val" rows="3" placeholder="məs: alert(\'Salam\')">'+esc(t.value||"")+'</textarea>':
   t.type==="fn"?'<label>Parametrlər (lazım olsa, vergüllə: 1,"abc")</label><input id="e-val" value="'+esc(t.args||"")+'">':""}
 drawV();m.querySelector("#e-t").onclick=function(){syncV();picker(t,function(n){t=n;drawV()})};
 function syncV(){var ve=m.querySelector("#e-val");if(!ve)return;if(t.type==="fn")t.args=ve.value.trim();else t.value=ve.value.trim();if(m.querySelector("#e-b"))t.blank=m.querySelector("#e-b").checked}
 m.querySelector("#e-c2").onclick=function(){m.remove()};
 m.querySelector("#e-sh").onclick=function(){close();o.el.scrollIntoView({block:"center",behavior:"smooth"});o.el.classList.add("dqk-flash");setTimeout(function(){o.el.classList.remove("dqk-flash")},2500)};
 function move(d){var els=scan.filter(function(x){return x.reg===o.reg&&x.el.parentNode===o.el.parentNode}).map(function(x){return x.key}),i=els.indexOf(k),j=i+d;if(i<0||j<0||j>=els.length)return toast("Bu istiqamətdə yer yoxdur",1);els.splice(i,1);els.splice(j,0,k);R.order[o.reg]=els;push();apply();render();edit(k);toast("Sıra dəyişdi")}
 m.querySelector("#e-l2").onclick=function(){move(-1)};m.querySelector("#e-r2").onclick=function(){move(1)};
 m.querySelector("#e-del").onclick=function(){if(isC){if(!confirm("Bu düymə silinsin?"))return;R.custom=R.custom.filter(function(x){return"custom|"+x.id!==k});var e=D.querySelector('[data-dqk-key="'+k+'"]');if(e)e.remove()}else{R.rules[k]=Object.assign({},R.rules[k],{hide:true})}push();apply();m.remove();render()};
 m.querySelector("#e-ok").onclick=function(){syncV();if((t.type==="url"||t.type==="js")&&!t.value)return toast("Dəyər daxil edin",1);
  var nr={label:m.querySelector("#e-l").value.trim(),sub:m.querySelector("#e-s").value.trim(),color:m.querySelector("#e-c").value,hide:m.querySelector("#e-h").checked,t:t};
  if(isC){Object.assign(c,nr);if(!nr.label)c.label="Yeni düymə"}else{if(!nr.label&&!nr.sub&&!nr.color&&!nr.hide&&t.type==="default")delete R.rules[k];else R.rules[k]=nr}
  if(!isC&&o.el.dataset.dqkOrig&&!nr.label){push().then(function(){location.reload()});return}
  push().then(function(ok){if(!ok)toast("Uzaq bazaya yazıla bilmədi — yalnız bu cihazda saxlandı",1)});apply();m.remove();render()}}
window.DQKecid={v:2,open:open,close:close,apply:apply,run:runT,catalog:discover,rules:function(){return R}};
var tm=null;new MutationObserver(function(){clearTimeout(tm);tm=setTimeout(apply,300)}).observe(D.body,{childList:true,subtree:true});
function boot(){apply();pull()}if(D.readyState!=="loading")boot();else D.addEventListener("DOMContentLoaded",boot);
})();
