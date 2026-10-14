/* DQ Wallet v1 — Balans: kabinet kartı + balansdan ödəniş + admin "Balans İdarəsi". Server: dq-wallet.sql */
(function(){"use strict";if(window.DQW)return;
var SB="https://cpzwliqlgaplroscvduo.supabase.co",KEY="sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
var $=function(i){return document.getElementById(i)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function m2(v){var n=Math.round(parseFloat(v)*100)/100;return(isNaN(n)?0:n)+" ₼"}
function toast(t){try{V2.toast(t)}catch(e){alert(t)}}
function mkey(){try{return localStorage.getItem("dq_yq_sess")||""}catch(e){return""}}
function atok(){try{var s=JSON.parse(localStorage.getItem("dq_adm_tok")||"null");return s&&s.t&&(s.e>Date.now()||s.r)?s.t:""}catch(e){return""}}
function dt(s){var d=new Date(s);return isNaN(d)?"":("0"+d.getDate()).slice(-2)+"."+("0"+(d.getMonth()+1)).slice(-2)+"."+d.getFullYear()+" "+("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)}
async function rpc(fn,a,tok){try{var r=await fetch(SB+"/rest/v1/rpc/"+fn,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json",Authorization:"Bearer "+(tok||KEY)},body:JSON.stringify(a||{})});var j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){var m=(j&&(j.message||j.hint))||"Server xətası";return{ok:false,err:/forbidden|JWT|expired/i.test(m)||r.status===401?"Admin sessiyası etibarsızdır — paneldən çıxıb yenidən daxil olun":/does not exist|Could not find/i.test(m)?"SQL quraşdırılmayıb (dq-wallet.sql işlədin)":m}}
 return j}catch(e){return{ok:false,err:"Şəbəkə xətası"}}}

var css=document.createElement("style");css.textContent=
".dqw-card{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px auto;max-width:650px;padding:14px 16px;border-radius:16px;background:linear-gradient(135deg,#0a2a6e,#123a8c);color:#fff;box-shadow:0 6px 18px rgba(10,42,110,.25)}"+
".dqw-card small{display:block;opacity:.8;font-size:12px}.dqw-card b{font-size:24px;color:#f5b942}"+
".dqw-b{border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;background:#fff;color:#0a2a6e}.dqw-b.g{background:#f5b942;color:#3b2a00}.dqw-b.r{background:#dc2626;color:#fff}.dqw-b.s{background:#059669;color:#fff}.dqw-b:disabled{opacity:.5}"+
".dqw-ov{position:fixed;inset:0;z-index:99990;background:rgba(6,26,71,.55);display:flex;align-items:center;justify-content:center;padding:12px}"+
".dqw-bx{background:#fff;color:#0f172a;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:18px;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:inherit}"+
".dqw-bx h3{margin:0 0 4px;font-size:18px}.dqw-sub{color:#64748b;font-size:13px;margin-bottom:10px}"+
".dqw-big{font-size:30px;font-weight:800;color:#0a2a6e;margin:6px 0}.dqw-tabs{display:flex;gap:6px;margin:10px 0}.dqw-tabs button{flex:1}"+
".dqw-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;margin-top:6px;font-size:13px}.dqw-row small{display:block;color:#64748b}"+
".dqw-row.c{cursor:pointer}.dqw-row.c:hover{background:#f1f5f9}.dqp{color:#059669;font-weight:800;white-space:nowrap}.dqn{color:#dc2626;font-weight:800;white-space:nowrap}"+
".dqw-bx input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:10px;margin-top:6px;font-size:14px}"+
".dqw-info{background:#f1f5f9;border-radius:10px;padding:10px;font-size:13px;margin-top:8px;line-height:1.5}.dqw-warn{background:#fef2f2;color:#b91c1c}"+
".dqw-card2{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#eff6ff;border-radius:10px;padding:10px;margin-top:8px}.dqw-card2 b{font-size:17px;letter-spacing:1px}"+
".dqw-act{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.dqw-act .dqw-b{flex:1}.dqw-chips{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}.dqw-chips .dqw-b{background:#e2e8f0;color:#0f172a;padding:6px 12px}";
document.head.appendChild(css);

var S={bal:null,tx:[],fin:"",name:"",err:""};
async function load(){var k=mkey();if(!k){S.bal=null;S.err="auth";return S}var r=await rpc("dq_wallet_get",{p_key:k});
 if(r&&r.ok){S.bal=+r.balance;S.tx=r.tx||[];S.fin=r.fin;S.name=r.name;S.err=""}else{S.bal=null;S.err=(r&&r.err)||"err"}paintCard();return S}

/* ---------- Kabinet kartı ---------- */
function paintCard(){var c=$("dqw-card");if(!c)return;
 if(!mkey())c.innerHTML='<div><small>💰 Balans</small><span style="font-size:13px">Balans üçün hesabınıza daxil olun</span></div><button class="dqw-b g" onclick="try{YQ.open(\'in\')}catch(e){}">Daxil ol</button>';
 else c.innerHTML='<div><small>💰 Balansım</small><b>'+(S.bal==null?(S.err&&S.err!=="auth"?"—":"…"):esc(m2(S.bal)))+'</b></div><div style="display:flex;gap:6px"><button class="dqw-b g" onclick="DQW.open(\'topup\')">+ Artır</button><button class="dqw-b" onclick="DQW.open(\'hist\')">Tarixçə</button></div>'}
function mount(){var a=document.querySelector(".cab-card");if(!a||$("dqw-card"))return;var d=document.createElement("div");d.id="dqw-card";d.className="dqw-card";a.parentNode.insertBefore(d,a.nextSibling);paintCard();load()}

/* ---------- Modal ---------- */
function modal(h){close();var o=document.createElement("div");o.className="dqw-ov";o.id="dqw-ov";o.innerHTML='<div class="dqw-bx" id="dqw-bx">'+h+'</div>';o.addEventListener("mousedown",function(e){if(e.target===o)close()});document.body.appendChild(o);return o}
function close(){var o=$("dqw-ov");o&&o.remove()}
var KIND={topup:["Balans artırıldı","dqp"],adjust:["Düzəliş","dqn"],pay:["İmtahan ödənişi","dqn"],refund:["Geri qaytarma","dqp"]};
function txRow(t,adm){var k=KIND[t.kind]||[t.kind,"dqp"],a=+t.amount;
 return'<div class="dqw-row"><div><b>'+esc(k[0])+'</b>'+(adm?' · '+esc(t.name||"")+' <small>'+esc(t.fin)+'</small>':'')+'<small>'+esc(dt(t.created_at))+' · №'+esc(t.id)+(t.note?' · '+esc(t.note):'')+'</small></div><div style="text-align:right"><span class="'+(a>=0?"dqp":"dqn")+'">'+(a>=0?"+":"")+esc(m2(a))+'</span><small>qalıq '+esc(m2(t.balance_after))+'</small></div></div>'}
function payInfo(){var c=null;try{(LX.cache||[]).forEach(function(x){var p=x.pay;if(!c&&p&&p.card)c={card:String(p.card),holder:p.holder||"",note:p.note||""}})}catch(e){}return c}
function send(kind,txt){var wa=typeof DQ_WA!=="undefined"?DQ_WA:"994504305162",tg=typeof DQ_TG!=="undefined"?DQ_TG:"Imanoff_oo1";window.open((kind==="tg"?"https://t.me/"+tg:"https://wa.me/"+wa)+"?text="+encodeURIComponent(txt),"_blank")}
function copy(t,b){try{navigator.clipboard.writeText(t).then(function(){b.textContent="✓"})}catch(e){prompt("Kopyalayın:",t)}}

function draw(tab){var inf=payInfo(),dg=function(s){return String(s).replace(/\D/g,"")},g=function(s){return dg(s).replace(/(.{4})/g,"$1 ").trim()};
 var h='<h3>💰 Balansım</h3><div class="dqw-sub">'+esc(S.name||"")+(S.fin?' · FİN '+esc(S.fin):'')+'</div><div class="dqw-big">'+esc(m2(S.bal||0))+'</div>'+
 '<div class="dqw-tabs"><button class="dqw-b '+(tab==="topup"?"g":"")+'" onclick="DQW.open(\'topup\',1)" style="border:1px solid #cbd5e1">Balansı artır</button><button class="dqw-b '+(tab==="hist"?"g":"")+'" onclick="DQW.open(\'hist\',1)" style="border:1px solid #cbd5e1">Tarixçə</button></div>';
 if(tab==="topup"){h+='<div class="dqw-info"><b>Necə artırılır?</b><br>1) Aşağıdakı karta istədiyiniz məbləği köçürün.<br>2) Çeki WhatsApp/Telegram ilə göndərin (FİN: <b>'+esc(S.fin)+'</b>).<br>3) Admin təsdiqləyən kimi balansınız artır, sonra istədiyiniz sınağın ödənişini balansdan edib başlaya bilərsiniz.</div>'+
  (inf?'<div class="dqw-card2"><b>'+esc(g(inf.card))+'</b><button class="dqw-b" onclick="DQW.cp(\''+dg(inf.card)+'\',this)">Kopyala</button></div>'+(inf.holder?'<div class="dqw-sub" style="margin-top:6px">Kart sahibi: <b>'+esc(inf.holder)+'</b></div>':''):'<div class="dqw-info dqw-warn">Kart məlumatı hələ təyin edilməyib — admin ilə əlaqə saxlayın.</div>')+
  '<div class="dqw-act"><button class="dqw-b s" onclick="DQW.snd(\'wa\')">WhatsApp</button><button class="dqw-b" style="background:#0284c7;color:#fff" onclick="DQW.snd(\'tg\')">Telegram</button></div>'}
 else h+=(S.tx.length?S.tx.map(function(t){return txRow(t)}).join(""):'<div class="dqw-info">Hələ əməliyyat yoxdur.</div>');
 h+='<div class="dqw-act"><button class="dqw-b" onclick="DQW.x()">Bağla</button></div>';$("dqw-bx").innerHTML=h}
async function open(tab,quick){if(!mkey()){try{YQ.open("in")}catch(e){toast("Hesaba daxil olun")}return}
 if(!quick||!$("dqw-bx"))modal('<div class="dqw-sub">Yüklənir…</div>');
 if(!quick||S.bal==null)await load();if(S.err){close();toast(S.err==="auth"?"Hesaba yenidən daxil olun":S.err.indexOf("dq_wallet")>-1||/does not exist|Could not find/.test(S.err)?"Balans modulu hələ quraşdırılmayıb":S.err);return}draw(tab||"hist")}

/* ---------- Balansdan ödəniş ---------- */
function hook(){var L=window.LXP;if(!L||!L.reg||L.__w||!window.LX)return false;L.__w=1;var o=L.reg;
 L.reg=function(id){var a=arguments,self=this,x=(LX.cache||[]).filter(function(z){return String(z._id)===String(id)})[0],p=x&&x.pay;
  if(!mkey()||!p||!p.on||!(parseFloat(p.price)>0))return o.apply(self,a);
  payModal(x,function(){o.apply(self,a)})};return true}
async function payModal(x,fallback){var price=Math.round(parseFloat(x.pay.price)*100)/100;modal('<div class="dqw-sub">Yüklənir…</div>');await load();
 if(S.err){close();return fallback()}
 var ok=S.bal>=price;
 $("dqw-bx").innerHTML='<h3>💳 Ödəniş — '+esc(x.cat)+'</h3><div class="dqw-sub">'+esc(x.title||"")+'</div><div class="dqw-big">'+esc(m2(price))+'</div>'+
  '<div class="dqw-row"><span>Balansınız</span><b>'+esc(m2(S.bal))+'</b></div>'+
  (ok?'<div class="dqw-row"><span>Ödənişdən sonra</span><b>'+esc(m2(S.bal-price))+'</b></div><div class="dqw-info">Ödəniş edildikdən dərhal sonra qeydiyyatınız təsdiqlənir. FİN kodunuzla imtahana daxil ola bilərsiniz.</div>':
  '<div class="dqw-info dqw-warn">Balans kifayət etmir — çatışmayan məbləğ: <b>'+esc(m2(price-S.bal))+'</b></div>')+
  '<div class="dqw-act">'+(ok?'<button class="dqw-b s" id="dqw-go">Balansdan ödə</button>':'<button class="dqw-b g" id="dqw-tp">Balansı artır</button>')+'</div>'+
  '<div class="dqw-act"><button class="dqw-b" id="dqw-old">Kartla ödə (köhnə qayda)</button><button class="dqw-b" id="dqw-no">Ləğv et</button></div>';
 $("dqw-no").onclick=close;$("dqw-old").onclick=function(){close();fallback()};
 if($("dqw-tp"))$("dqw-tp").onclick=function(){open("topup",1)};
 if($("dqw-go"))$("dqw-go").onclick=async function(){var b=this;b.disabled=true;b.textContent="Gözləyin…";var r=await rpc("dq_wallet_pay",{p_key:mkey(),p_exam:String(x._id)});
  if(r&&r.ok){try{var m=JSON.parse(localStorage.getItem("lx_my_regs")||"{}");m[x._id]={work_no:r.work_no,fin:r.fin};localStorage.setItem("lx_my_regs",JSON.stringify(m))}catch(e){}
   close();toast("Ödəniş uğurla edildi ✅");load();try{LXP.done(x._id,r.work_no,r.fin)}catch(e){}try{LXP.refresh&&LXP.refresh()}catch(e){}}
  else if(r&&r.dup){close();fallback()}
  else if(r&&r.err==="low"){S.bal=+r.balance;close();payModal(x,fallback)}
  else{b.disabled=false;b.textContent="Balansdan ödə";toast((r&&r.err)||"Xəta baş verdi")}}}

/* ---------- Admin: Balans İdarəsi ---------- */
var A={list:[],sel:null,tx:[],t:0};
async function acall(fn,a){var r=await rpc(fn,a,atok());if(r&&r.ok===false){toast(r.err);return null}return r}
function openAdmin(){if(!atok()){toast("Admin kimi daxil olun");return}
 modal('<h3>💰 Balans İdarəsi</h3><div class="dqw-sub">İstifadəçinin balansını artırın və əməliyyatlara baxın</div><input id="dqw-q" placeholder="FİN və ya ad ilə axtar…" autocomplete="off"><div id="dqw-res"></div><div id="dqw-sel"></div><h3 style="margin-top:14px;font-size:15px" id="dqw-th">Son əməliyyatlar</h3><div id="dqw-tx"></div><div class="dqw-act"><button class="dqw-b" onclick="DQW.csv()">CSV</button><button class="dqw-b" onclick="DQW.x()">Bağla</button></div>');
 A.sel=null;$("dqw-q").addEventListener("input",function(){clearTimeout(A.t);A.t=setTimeout(function(){search(this.value)}.bind(this),300)});search("");txLoad(null)}
async function search(q){var r=await acall("dq_wallet_admin_search",{p_q:q||""});if(!r)return;A.list=r.slice();var f=String(q||"").trim().toUpperCase();
 if(/^[A-Z0-9]{7}$/.test(f)&&!A.list.some(function(z){return z.fin===f}))A.list.unshift({fin:f,name:"FİN ilə birbaşa",contact:"",balance:0});
 var el=$("dqw-res");if(!el)return;el.innerHTML=A.list.length?A.list.slice(0,8).map(function(u,i){return'<div class="dqw-row c" onclick="DQW.pick('+i+')"><div><b>'+esc(u.name)+'</b><small>'+esc(u.fin)+(u.contact?' · '+esc(u.contact):'')+'</small></div><b>'+esc(m2(u.balance))+'</b></div>'}).join(""):'<div class="dqw-info">Nəticə tapılmadı.</div>'}
function pick(i){A.sel=A.list[i];selDraw();txLoad(A.sel.fin)}
function selDraw(){var u=A.sel,el=$("dqw-sel");if(!el||!u)return;
 el.innerHTML='<div class="dqw-info"><b>'+esc(u.name)+'</b> · '+esc(u.fin)+'<br>Cari balans: <b>'+esc(m2(u.balance))+'</b></div><input id="dqw-amt" type="number" min="0" step="0.5" placeholder="Məbləğ (₼)"><div class="dqw-chips">'+[5,10,15,20,50].map(function(n){return'<button class="dqw-b" onclick="$(\'dqw-amt\').value='+n+'">'+n+'</button>'}).join("")+'</div><input id="dqw-note" placeholder="Qeyd (məs: kart köçürməsi, çek №…)"><div class="dqw-act"><button class="dqw-b s" onclick="DQW.adj(1)">➕ Artır</button><button class="dqw-b r" onclick="DQW.adj(-1)">➖ Azalt</button></div>';
 window.$=window.$||$}
async function adj(sg){var u=A.sel,amt=parseFloat(($("dqw-amt")||{}).value);if(!u||!(amt>0)){toast("Məbləği yazın");return}
 if(!confirm(u.name+" ("+u.fin+") balansı "+(sg>0?"artırılsın":"azaldılsın")+": "+m2(amt)+"?"))return;
 var r=await acall("dq_wallet_admin_topup",{p_fin:u.fin,p_amount:sg*amt,p_note:($("dqw-note")||{}).value||""});
 if(r&&r.ok){u.balance=r.balance;toast("Yeniləndi ✅ Yeni balans: "+m2(r.balance));selDraw();txLoad(u.fin);search(($("dqw-q")||{}).value)}}
async function txLoad(fin){var r=await acall("dq_wallet_admin_tx",{p_fin:fin||null});if(!r)return;A.tx=r;var el=$("dqw-tx"),th=$("dqw-th");if(th)th.textContent=fin?"Əməliyyatlar — "+fin:"Son əməliyyatlar";
 el&&(el.innerHTML=r.length?r.map(function(t){return txRow(t,!fin)}).join(""):'<div class="dqw-info">Əməliyyat yoxdur.</div>')}
function csv(){var q=function(s){return'"'+String(s==null?"":s).replace(/"/g,'""')+'"'},rows=[["№","Tarix","Ad","FİN","Növ","Məbləğ","Qalıq","Qeyd","Admin"]].concat(A.tx.map(function(t){return[t.id,dt(t.created_at),t.name,t.fin,t.kind,t.amount,t.balance_after,t.note,t.by_email]}));
 var b=new Blob(["\ufeff"+rows.map(function(r){return r.map(q).join(";")}).join("\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="balans-emeliyyatlari.csv";document.body.appendChild(a);a.click();a.remove()}
function mountAdmin(){var g=document.querySelector(".admin-nav-grid");if(!g||g.querySelector("[data-dqw]"))return;var d=document.createElement("div");d.className="admin-nav-card";d.setAttribute("data-dqw","1");d.style.cssText="background:#047857;color:#fff";d.onclick=openAdmin;d.innerHTML='<span class="icon">💰</span> Balans İdarəsi';g.insertBefore(d,g.firstChild)}

window.DQW={open:open,openAdmin:openAdmin,refresh:load,x:close,cp:copy,pick:pick,adj:adj,csv:csv,
 snd:function(k){send(k,"Salam! Balansımı artırmaq istəyirəm.\nAd: "+S.name+"\nFİN: "+S.fin+"\nMəbləğ: ___ ₼ (çek əlavədir)")}};
setInterval(function(){try{mount();mountAdmin();hook()}catch(e){}},1000);
})();
