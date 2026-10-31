/* DQ Platform · Materiallar (Fənlər kartları) + Sınaqlar (3D karusel) — müstəqil modul.
   Mövcud kodlara toxunmur: yuxarı menyudakı MATERİALLAR / SINAQLAR düymələrini tutub öz tam ekranını açır. */
(function(){"use strict";
if(window.__dqBol)return;window.__dqBol=1;
var D=document,SUBJ=["Azərbaycan dili","Qanunvericilik","İnformatika","Məntiq"],root,esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
var css=D.createElement("style");css.textContent=
"#dqb{position:fixed;inset:0;z-index:2147483000;background:#eef1f7;overflow:auto;display:none;font-family:'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;color:#0b1b44;-webkit-overflow-scrolling:touch}"+
"#dqb.on{display:block}.dqb-w{max-width:900px;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) 16px 40px}"+
".dqb-top{display:flex;justify-content:space-between;gap:8px}.dqb-b{border:1px solid #dfe3f1;background:#fff;border-radius:12px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:14px;color:#0b1b44}.dqb-b.x{color:#b42318;border-color:#f5c6c0}"+
".dqb-h{font-size:26px;font-weight:800;margin:22px 0 6px}.dqb-s{color:#475569;margin:0 0 18px}"+
".dqb-g{display:grid;grid-template-columns:1fr 1fr;gap:14px}.dqb-c{background:#f4f6fb;border:1px solid #dfe3f1;border-radius:24px;padding:26px 10px;text-align:center;cursor:pointer;transition:.2s;font:inherit}"+
".dqb-c:hover{transform:translateY(-3px);box-shadow:0 14px 28px -16px rgba(6,17,46,.5)}.dqb-ic{width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,#1e4fb8,#0c2260);display:grid;place-items:center;font-size:38px;margin:0 auto 14px}"+
".dqb-n{font-size:19px;font-weight:700;color:#0c2260}.dqb-m{font-weight:700;margin-top:8px;color:#334155}"+
".dqb-close{display:block;width:100%;margin-top:18px;border:0;border-radius:16px;background:#0c2260;color:#fff;font-weight:800;font-size:17px;padding:16px;cursor:pointer}"+
".dqb-in{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid #cfd6e6;border-radius:12px;font-size:15px;margin-bottom:12px}"+
".dqb-row{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #dfe3f1;border-radius:16px;padding:14px;margin-bottom:10px}.dqb-row b{flex:1;word-break:break-word}.dqb-row a,.dqb-row button{background:#0c2260;color:#fff;border:0;border-radius:10px;padding:9px 14px;font-weight:700;text-decoration:none;cursor:pointer;font-size:14px}"+
".dqb-empty{text-align:center;color:#64748b;padding:34px 10px;background:#fff;border-radius:16px}"+
".dqb-tabs{display:flex;gap:4px;overflow-x:auto;background:#fff;border:1px solid #dfe3f1;border-radius:999px;padding:6px;margin:0 auto 18px;max-width:100%;width:max-content;scrollbar-width:none}.dqb-tabs button{border:0;background:none;border-radius:999px;padding:9px 16px;font-weight:600;cursor:pointer;white-space:nowrap;font:inherit;font-size:14px}.dqb-tabs button.on{background:#0c2260;color:#f6c453}"+
".dqb-car{position:relative;height:350px;perspective:1200px;touch-action:pan-y;user-select:none;-webkit-user-select:none;overflow:visible}"+
".dqb-card{position:absolute;left:50%;top:6px;width:var(--w,180px);height:300px;margin-left:calc(var(--w,180px)/-2);transform-style:preserve-3d;will-change:transform;transition:transform .65s cubic-bezier(.22,.9,.3,1),opacity .45s ease;cursor:pointer;-webkit-tap-highlight-color:transparent}"+
".dqb-card.fl{z-index:30!important}"+
".dqb-f{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .85s cubic-bezier(.34,1.2,.5,1)}.dqb-card.fl .dqb-f{transform:rotateY(180deg)}"+
".dqb-face{position:absolute;inset:0;border-radius:24px;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:18px 12px;color:#fff;box-shadow:0 18px 34px -16px rgba(6,17,46,.7);overflow:hidden}"+
".dqb-face:before{content:'';position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 0,rgba(255,255,255,.22),transparent 60%);pointer-events:none}.dqb-face.bk{transform:rotateY(180deg)}"+
".dqb-pill{background:rgba(255,255,255,.2);border-radius:99px;padding:4px 14px;font-size:13px;font-weight:700;position:relative}.dqb-big{font-size:72px;font-weight:900;color:#d9b45c;letter-spacing:-2px;position:relative}.dqb-hint{font-size:13px;opacity:.9;position:relative}"+
".dqb-ar{position:absolute;top:45%;width:44px;height:44px;border-radius:50%;border:0;background:#fff;box-shadow:0 6px 16px rgba(0,0,0,.15);font-size:20px;cursor:pointer;z-index:40}.dqb-dots{display:flex;gap:9px;justify-content:center;margin:6px 0 20px}.dqb-dots i{width:10px;height:10px;border-radius:9px;background:#cbd5e1;transition:.25s}.dqb-dots i.on{width:38px;background:#0c2260}"+
".dqb-box{background:#fff;border-left:5px solid #e5a82c;border-radius:16px;padding:18px;box-shadow:0 10px 26px -18px rgba(6,17,46,.6);margin-top:8px}.dqb-box form{display:flex;gap:10px}.dqb-box input{flex:1;padding:13px;border:2px solid #e5a82c;border-radius:12px;font-size:15px;min-width:0}.dqb-box button.go{background:#0c2260;color:#fff;border:0;border-radius:12px;padding:0 22px;font-weight:800;cursor:pointer}.dqb-msg{margin-top:10px;font-weight:600;font-size:14px}"+
"@media(max-width:560px){.dqb-h{font-size:22px}.dqb-c{padding:20px 6px}.dqb-n{font-size:16px}}";
D.head.appendChild(css);

/* ---------- verilənlər ---------- */
function V2L(k){try{return window.V2&&V2.list?Promise.resolve(V2.list(k)).then(function(a){return Array.isArray(a)?a:[]}).catch(function(){return[]}):Promise.resolve([])}catch(e){return Promise.resolve([])}}
function sb(){try{return(0,eval)("typeof _supabase!=='undefined'?_supabase:null")}catch(e){return window.sb||null}}
function getMaterials(){
 var keys=["pdfs","materials","pdf_materials"],i=0;
 function next(){if(i>=keys.length)return Promise.resolve([]);return V2L(keys[i++]).then(function(a){return a.length?a:next()})}
 return next().then(function(a){return a.filter(function(x){return x&&typeof x==="object"}).map(function(x,n){
  var u=x.url||x.file||x.href||x.data||x.pdf||"";return{id:x.id||n,title:x.title||x.name||x.ad||"Material "+(n+1),subject:x.subject||x.sub||x.fenn||x["fənn"]||"",url:u}})})}
function getExams(){var c=sb();if(!c)return Promise.resolve({1:["BA","AC","BB"]});
 return c.from("exam_questions").select("exam_id,category").limit(20000).then(function(r){var m={};((r&&r.data)||[]).forEach(function(q){(m[q.exam_id]=m[q.exam_id]||{})[q.category]=1});
  var o={};Object.keys(m).sort(function(a,b){return a-b}).forEach(function(k){o[k]=["BA","AC","BB"].filter(function(c){return m[k][c]})});return Object.keys(o).length?o:{1:["BA","AC","BB"]}}).catch(function(){return{1:["BA","AC","BB"]}})}

/* ---------- çərçivə ---------- */
function open(html){if(!root){root=D.createElement("div");root.id="dqb";D.body.appendChild(root)}root.innerHTML='<div class="dqb-w">'+html+'</div>';root.classList.add("on");D.body.style.overflow="hidden";root.scrollTop=0}
function close(){if(root)root.classList.remove("on");D.body.style.overflow="";stopAuto()}
function bind(sel,fn){var e=root.querySelectorAll(sel);Array.prototype.forEach.call(e,function(x){x.addEventListener("click",function(ev){fn(x,ev)})})}

/* ---------- MATERİALLAR: Fənlər ---------- */
function openMaterials(){
 open('<h2 class="dqb-h">📚 Fənlər</h2><p class="dqb-s">Yüklənir…</p>');
 getMaterials().then(function(L){
  var subs=SUBJ.slice();L.forEach(function(m){if(m.subject&&subs.indexOf(m.subject)<0)subs.push(m.subject)});
  var cnt=function(s){return L.filter(function(m){return m.subject===s}).length};
  open('<h2 class="dqb-h">📚 Fənlər</h2><p class="dqb-s">Dərs materialları üçün fənni seçin</p><div class="dqb-g">'+subs.map(function(s){return'<button type="button" class="dqb-c" data-s="'+esc(s)+'"><div class="dqb-ic">🎓</div><div class="dqb-n">'+esc(s)+'</div><div class="dqb-m">'+cnt(s)+' material</div></button>'}).join("")+'</div><button class="dqb-close" type="button" id="dqb-x">Bağla</button>');
  bind(".dqb-c",function(b){openSubject(b.dataset.s,L)});bind("#dqb-x",close)})}
function openSubject(s,L){
 var items=L.filter(function(m){return m.subject===s});
 open('<div class="dqb-top"><button class="dqb-b" id="dqb-bk">← Fənlər</button><button class="dqb-b x" id="dqb-x">Bağla</button></div><h2 class="dqb-h">🎓 '+esc(s)+'</h2><input class="dqb-in" id="dqb-q" placeholder="Material axtar…"><div id="dqb-l"></div>');
 function draw(q){q=(q||"").toLocaleLowerCase("az");var a=items.filter(function(m){return m.title.toLocaleLowerCase("az").indexOf(q)>=0});
  root.querySelector("#dqb-l").innerHTML=a.length?a.map(function(m,i){return'<div class="dqb-row"><span style="font-size:26px">📄</span><b>'+esc(m.title)+'</b>'+(m.url?'<a href="'+esc(m.url)+'" target="_blank" rel="noopener">Aç</a>':'<button disabled style="opacity:.5">Fayl yoxdur</button>')+'</div>'}).join(""):'<div class="dqb-empty">Bu fənn üzrə material tapılmadı.</div>'}
 draw("");root.querySelector("#dqb-q").addEventListener("input",function(){draw(this.value)});
 bind("#dqb-bk",function(){openMaterials()});bind("#dqb-x",close)}

/* ---------- SINAQLAR: 3D karusel ---------- */
var COL={BA:"linear-gradient(160deg,#7a2a66,#4c1d5b)",AC:"linear-gradient(160deg,#17727a,#0f4f5c)",BB:"linear-gradient(160deg,#2f5fb0,#243c7a)"},TXT={BA:"Toxun və çevir",AC:"Toxun və çevir",BB:"Toxun və çevir"},timer=null;
function stopAuto(){clearInterval(timer);timer=null}
function openSinaq(){
 open('<p class="dqb-s">Yüklənir…</p>');
 getExams().then(function(EX){
  var nums=Object.keys(EX),cur=nums[0],idx=0;
  open('<div class="dqb-top"><button class="dqb-b" id="dqb-bk">← Geri</button><span></span></div><div style="text-align:center"><h2 class="dqb-h" style="font-size:22px">Sınaqlar</h2><p class="dqb-s">Sınaqda iştirak üçün qeydiyyat tələb olunur.</p>'+
   '<button class="dqb-b" id="dqb-chk" style="background:#1e3a8a;color:#fff">🪪 İş nömrəsi ilə qeydiyyatı yoxla</button><h2 class="dqb-h" style="font-size:30px;margin-top:26px">Dövlət Qulluğu Sınaq İmtahanları</h2><p class="dqb-s">Sınağı seç, növü çevir, balını gör.</p>'+
   '<div class="dqb-tabs" id="dqb-t"></div><div class="dqb-car" id="dqb-car"></div><div class="dqb-dots" id="dqb-d"></div></div>'+
   '<div class="dqb-box"><b style="font-size:18px">🔑 Sınaqda iştirak</b><p style="color:#475569;font-size:14px;margin:8px 0 12px">İş nömrənizi yazın. İcazəniz varsa, kabinetə daxil olmadan birbaşa sınağa keçəcəksiniz.</p><form id="dqb-f"><input id="dqb-no" inputmode="numeric" placeholder="İş nömrəsi" autocomplete="off"><button class="go" type="submit">Davam et</button></form><div class="dqb-msg" id="dqb-ms"></div></div>'+
   '<div style="text-align:center;margin-top:22px"><button class="dqb-b" id="dqb-home" style="font-size:13px;background:#eef2ff">← Ana səhifəyə qayıt</button></div>');
  function cats(){return EX[cur]||[]}
  function drawTabs(){root.querySelector("#dqb-t").innerHTML=nums.map(function(n){return'<button type="button" data-n="'+n+'"'+(n===cur?' class="on"':"")+'>Sınaq '+n+'</button>'}).join("");
   bind("#dqb-t button",function(b){cur=b.dataset.n;idx=0;built="";drawTabs();drawCar()})}
  var built="",W=180;
  function build(){var c=cats(),car=root.querySelector("#dqb-car");built=cur;
   if(!c.length){car.innerHTML='<div class="dqb-empty">Bu sınaqda sual yoxdur.</div>';root.querySelector("#dqb-d").innerHTML="";return}
   car.innerHTML=c.map(function(k,i){return'<div class="dqb-card" data-i="'+i+'"><div class="dqb-f">'+
    '<div class="dqb-face" style="background:'+COL[k]+'"><span class="dqb-pill">Sınaq '+cur+'</span><span class="dqb-big">'+k+'</span><span class="dqb-hint">'+TXT[k]+'</span></div>'+
    '<div class="dqb-face bk" style="background:'+COL[k]+'"><span class="dqb-pill">Sınaq '+cur+' · '+k+'</span><span style="font-size:15px;text-align:center;line-height:1.7;position:relative">100 sual<br>Balını sınaqdan sonra gör</span><button type="button" class="dqb-b" data-st="'+k+'" style="color:#0c2260;position:relative">Başla</button></div></div></div>'}).join("")+
    '<button type="button" class="dqb-ar" style="left:0" data-d="-1" aria-label="Əvvəlki">‹</button><button type="button" class="dqb-ar" style="right:0" data-d="1" aria-label="Növbəti">›</button>';
   root.querySelector("#dqb-d").innerHTML=c.map(function(){return"<i></i>"}).join("")}
  function layout(){var c=cats(),n=c.length;if(!n)return;var car=root.querySelector("#dqb-car");W=Math.max(140,Math.min(190,car.clientWidth*.42));car.style.setProperty("--w",W+"px");
   Array.prototype.forEach.call(car.querySelectorAll(".dqb-card"),function(el,i){var off=((i-idx)%n+n)%n;if(off>n/2)off-=n;var ab=Math.abs(off),vis=ab<=1;
    if(!vis||i!==idx)el.classList.remove("fl");
    el.style.zIndex=10-ab;el.style.opacity=vis?1:0;el.style.pointerEvents=vis?"auto":"none";
    el.style.transform="translateX("+(off*W*.62)+"px) translateZ("+(-ab*90)+"px) rotateY("+(-off*20)+"deg) scale("+(ab?.93:1.04)+")"});
   Array.prototype.forEach.call(root.querySelectorAll("#dqb-d i"),function(d,i){d.className=i===idx?"on":""})}
  function drawCar(){if(built!==cur)build();layout()}
  function go(d){var n=cats().length;if(!n)return;idx=(idx+d+n)%n;layout()}
  root.querySelector("#dqb-car").addEventListener("click",function(ev){
   var ar=ev.target.closest(".dqb-ar");if(ar){ev.stopPropagation();return go(+ar.dataset.d)}
   var st=ev.target.closest("[data-st]");if(st){return start(cur,st.dataset.st)}
   var el=ev.target.closest(".dqb-card");if(!el)return;var i=+el.dataset.i;if(i!==idx){idx=i;layout()}else el.classList.toggle("fl")});
  var sx=null;root.querySelector("#dqb-car").addEventListener("touchstart",function(e){sx=e.touches[0].clientX},{passive:true});
  root.querySelector("#dqb-car").addEventListener("touchend",function(e){if(sx==null)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40)go(dx<0?1:-1);sx=null});
  stopAuto();timer=setInterval(function(){if(!root.querySelector(".dqb-card.fl")&&D.activeElement!==root.querySelector("#dqb-no"))go(1)},4000);
  drawTabs();drawCar();window.addEventListener("resize",function(){if(root&&root.classList.contains("on")&&root.querySelector("#dqb-car"))layout()});
  bind("#dqb-bk",close);bind("#dqb-home",close);
  bind("#dqb-chk",function(){if(window.DQExam&&DQExam.open)DQExam.open("sinaq");else root.querySelector("#dqb-no").focus()});
  root.querySelector("#dqb-f").addEventListener("submit",function(e){e.preventDefault();check(root.querySelector("#dqb-no").value.trim())});
  function msg(t,ok){var m=root.querySelector("#dqb-ms");m.style.color=ok?"#047857":"#b42318";m.textContent=t}
  function check(no){if(!no)return msg("İş nömrəsini daxil edin.");msg("Yoxlanılır…",1);
   V2L("regs").then(function(R){var r=R.filter(function(x){return Object.keys(x||{}).some(function(k){return String(x[k]).trim()===no})})[0];
    if(r&&(r.status==="approved"||r.approved===true)){msg("İcazəniz təsdiqlənib. Sınaq başladılır…",1);start(cur,cats()[idx]||cats()[0],r)}
    else if(r)msg("Qeydiyyatınız var, lakin hələ təsdiqlənməyib. Təsdiqi gözləyin.");
    else{msg("Bu iş nömrəsi ilə qeydiyyat tapılmadı. Qeydiyyat səhifəsi açılır…");setTimeout(function(){if(window.DQExam&&DQExam.open)DQExam.open("reg")},900)}})}
  function start(ex,cat,reg){close();var ev=new CustomEvent("dq-start-exam",{detail:{exam:ex,category:cat,reg:reg||null},cancelable:true});
   if(!D.dispatchEvent(ev))return;var fn=["startExamDirect","startActiveExam","startExam","startMockExam"].filter(function(f){return typeof window[f]==="function"})[0];
   try{if(fn)window[fn](ex,cat,reg);else if(window.DQExam&&DQExam.open)DQExam.open("sinaq")}catch(e){if(window.DQExam)DQExam.open("sinaq")}}
 })}

/* ---------- menyu tutucu ---------- */
function norm(t){return String(t||"").replace(/\s+/g," ").trim().toLocaleUpperCase("az")}
D.addEventListener("click",function(e){
 var t=e.target.closest&&e.target.closest("a,button,li,[role=tab],[data-tab],span,div");if(!t||(root&&root.contains(t)))return;
 var n=norm(t.textContent);if(n!=="MATERİALLAR"&&n!=="SINAQLAR")return;
 if(!t.closest("nav,header,[class*=nav],[id*=nav],[class*=tabs],[id*=tabs]"))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();n==="MATERİALLAR"?openMaterials():openSinaq()},true);
D.addEventListener("keydown",function(e){if(e.key==="Escape"&&root&&root.classList.contains("on"))close()});
window.DQBol={materials:openMaterials,sinaqlar:openSinaq,close:close};
})();
