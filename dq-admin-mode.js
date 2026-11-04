/* DQ Platform — İdarə modu. Yalnız /proysl-dan admin kimi daxil olmuş cihazda görünür; adi istifadəçilər üçün heç nə göstərmir. */
(function(){"use strict";
var U="https://cpzwliqlgaplroscvduo.supabase.co",K="sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
var OK=["99686c0544e9a36931c945b4197068c88f4db34d74d9de5504e60d756bc30d7e","74894384393f0ed1f63e9a3b58a82a7483b25b7c3f46d6e44301e87a52321c8d"];
var A=""; try{A=localStorage.dqa||""}catch(e){}
if(OK.indexOf(A)<0||window.DQMode)return; window.DQMode=1;
var D=document;
function H(x){var h={apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"};for(var k in x||{})h[k]=x[k];return h}
function api(p,o){o=o||{};o.headers=H(o.h);return fetch(U+"/rest/v1/"+p,o).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(r.status+" "+t.slice(0,140))});return r.text().then(function(t){return t?JSON.parse(t):null})})}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function q(s,r){return(r||D).querySelector(s)}
var st=D.createElement("style");st.textContent="#dqm-f{position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483000;width:52px;height:52px;border-radius:50%;border:0;background:linear-gradient(135deg,#d9a23a,#b45309);color:#fff;font-size:22px;box-shadow:0 6px 20px #0006;cursor:pointer}#dqm-s{position:fixed;inset:0;z-index:2147483001;background:#0008;display:none;align-items:flex-end;justify-content:center}#dqm-s.on{display:flex}#dqm-b{background:#fff;color:#0f1f45;width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:20px 20px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom,0px));font:14px/1.45 system-ui,sans-serif}#dqm-b h3{margin:0 0 10px;font-size:17px}#dqm-b input,#dqm-b select,#dqm-b textarea{width:100%;padding:10px;border:1px solid #d7deef;border-radius:10px;margin:3px 0 9px;font:inherit;box-sizing:border-box;background:#fff;color:#0f1f45}#dqm-b label{font-size:12px;font-weight:700}#dqm-b button{border:0;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;background:#1e3a8a;color:#fff;cursor:pointer}#dqm-b button.s{background:#e8eefc;color:#1e3a8a}#dqm-b button.d{background:#fee2e2;color:#dc2626}.dqm-a{display:block;width:100%;text-align:left;margin:0 0 8px;padding:14px!important}.dqm-r{display:flex;gap:8px}.dqm-r>*{flex:1}.dqm-i{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e6ebf7}.dqm-m{color:#6b7794;font-size:12px}";
D.head.appendChild(st);
var f=D.createElement("button");f.id="dqm-f";f.textContent="⚙️";f.title="İdarə modu";
var sh=D.createElement("div");sh.id="dqm-s";sh.innerHTML='<div id="dqm-b"></div>';
function add(){if(window.DQ_EMBED)return;if(!D.body)return setTimeout(add,200);D.body.appendChild(f);D.body.appendChild(sh)}add();
var T=null,B=function(){return T||q("#dqm-b")};
function openS(){sh.className="on";menu()}function closeS(){sh.className=""}
f.onclick=openS;sh.onclick=function(e){if(e.target===sh)closeS()};
function toast(t){var e=q("#dqm-t");if(!e){e=D.createElement("div");e.id="dqm-t";e.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:12px;z-index:2147483002;font:14px system-ui";D.body.appendChild(e)}e.textContent=t;e.style.display="block";clearTimeout(e._t);e._t=setTimeout(function(){e.style.display="none"},2400)}

/* Hazırda açıq olan ekranı başlıqdan tanı */
function ctx(){var t=[].slice.call(D.querySelectorAll("h1,h2,h3,header *,[class*=title],[class*=head]")).filter(function(e){return e.getClientRects().length&&e.textContent.length<90}).map(function(e){return e.textContent}).join("|");
 if(/Xəbərlər və Elanlar|Yeniliklər/.test(t))return"news";if(/Qeydiyyat Portal|Aktiv sessiyalar/.test(t))return"sess";if(/Sınaq İmtahanları|Sınaqlar/.test(t))return"sinaq";if(/Fənlər üzrə testlər|Testlər/.test(t))return"test";return""}
var ACT={news:["📰","Xəbər əlavə et",news],sinaq:["🎯","Yeni sınaq əlavə et (suallarla)",function(){quest("sinaq")}],test:["📝","Yeni test / sual əlavə et",function(){quest("test")}],sess:["🎓","İmtahan sessiyası aktivləşdir / qeydiyyat əlavə et",sess],mat:["📚","Material əlavə et",function(){openMod(/D[əe]rs\s*Materia/i,"Dərs materialları modulu tapılmadı")}],info:["ℹ️","Məlumat əlavə et",function(){openMod(/M[əe]lumat/i,"Məlumat modulu tapılmadı")}]};

/* Mövcud admin modulunu (Dərs materialları, Məlumat bölməsi) kartın mətnindən tapıb açır */
function openMod(re,msg){var p=D.getElementById("admin-panel"),cards=p?[].slice.call(p.querySelectorAll(".admin-nav-card")):[],c=cards.filter(function(e){return re.test(e.textContent)})[0];
 if(!c)return toast(msg);closeS();
 try{if(typeof window.dqGoAdmin==="function")window.dqGoAdmin();else{[].forEach.call(D.querySelectorAll(".screen.active"),function(x){x.classList.remove("active")});p.classList.add("active")}}catch(e){}
 setTimeout(function(){c.click()},150)}
var ED=[["✏️","Əsas səhifəni canlı redaktə et",function(){return window.DQNav&&DQNav.openEditor},function(){DQNav.openEditor()}],["🔗","Keçid idarəsi (düymə → keçid)",function(){return window.DQKecid&&DQKecid.open},function(){DQKecid.open()}],["🧭","Portal idarəsi",function(){return window.PRT&&PRT.open},function(){PRT.open()}],["🙈","Gizləmə (bölmələri gizlət)",function(){return window.GZL&&GZL.open},function(){GZL.open()}]];
function menu(){var c=ctx(),keys=Object.keys(ACT);if(c){keys.splice(keys.indexOf(c),1);keys.unshift(c)}
 B().innerHTML="<h3>⚙️ İdarə modu</h3>"+(c?'<div class="dqm-m" style="margin-bottom:8px">Açıq ekrana uyğun əməliyyat birinci göstərilir</div>':"")+keys.map(function(k){return'<button class="dqm-a '+(k==c?"":"s")+'" data-k="'+k+'">'+ACT[k][0]+" "+ACT[k][1]+"</button>"}).join("")+ED.filter(function(e){return e[2]()}).map(function(e,i){return'<button class="dqm-a s" data-e="'+i+'">'+e[0]+" "+e[1]+"</button>"}).join("")+'<button class="dqm-a s" id="dqm-p">🔐 Admin panelinə qayıt</button><button class="s dqm-a" id="dqm-x">Bağla</button>';
 [].forEach.call(B().querySelectorAll("[data-k]"),function(b){b.onclick=ACT[b.dataset.k][2]});var EL=ED.filter(function(e){return e[2]()});[].forEach.call(B().querySelectorAll("[data-e]"),function(b){b.onclick=function(){closeS();EL[b.dataset.e][3]()}});q("#dqm-p").onclick=function(){location.href=location.pathname.replace(/[^\/]*$/,"")+"proysl"};q("#dqm-x").onclick=closeS}
function head(t){return'<h3>'+t+'</h3>'+(T?"":'<button class="s" id="dqm-bk" style="margin-bottom:10px">← Geri</button>')}
function wire(){var b=q("#dqm-bk");if(b)b.onclick=menu}

/* ---- 1. Xəbər ---- */
function news(){B().innerHTML=head("📰 Xəbər əlavə et")+'<label>Başlıq</label><input id="n1" maxlength="150"><div class="dqm-r"><div><label>Kateqoriya</label><select id="n2"><option>Xəbər</option><option>Elan</option><option>İmtahan</option></select></div><div><label>Tarix</label><input id="n3" type="date"></div></div><label>Qapaq şəkli (4:5, avtomatik sıxılır)</label><input id="n4" type="file" accept="image/*"><label>Qısa xülasə</label><input id="n5" maxlength="200"><label>Tam mətn</label><textarea id="n6" rows="5"></textarea><label>Əlavə link (könüllü)</label><input id="n7" placeholder="https://..."><input id="n8" placeholder="Düymənin yazısı"><button id="n9" style="width:100%">+ Paylaş</button>';wire();
 var img="";q("#n3").value=new Date().toISOString().slice(0,10);
 q("#n4").onchange=function(e){var fl=e.target.files[0];if(!fl)return;var im=new Image();im.onload=function(){var c=D.createElement("canvas");c.width=640;c.height=800;var x=c.getContext("2d"),r=Math.max(640/im.width,800/im.height),w=im.width*r,h=im.height*r;x.drawImage(im,(640-w)/2,(800-h)/2,w,h);img=c.toDataURL("image/jpeg",.78)};im.src=URL.createObjectURL(fl)};
 q("#n9").onclick=function(){var t=q("#n1").value.trim();if(!t)return toast("Başlıq yazın");
  api("dq_v2_store",{method:"POST",h:{Prefer:"return=minimal"},body:JSON.stringify({collection:"news",data:{title:t,cat:q("#n2").value,date:q("#n3").value,img:img,summary:q("#n5").value,body:q("#n6").value,link:q("#n7").value,linkText:q("#n8").value,ts:Date.now()}})}).then(function(){toast("Paylaşıldı ✓");setTimeout(function(){location.reload()},900)}).catch(function(e){toast("Xəta: "+e.message)})}}

/* ---- 2. İmtahan sessiyaları (regsessions) ---- */
function getReg(){return api("dq_v2_store?select=id,data&collection=eq.regsessions&order=id.desc&limit=1").then(function(a){return a&&a[0]?a[0]:null})}
function saveReg(row,list){var d=Object.assign({},row?row.data:{},{list:list});return row?api("dq_v2_store?id=eq."+row.id,{method:"PATCH",h:{Prefer:"return=minimal"},body:JSON.stringify({data:d})}):api("dq_v2_store",{method:"POST",h:{Prefer:"return=minimal"},body:JSON.stringify({collection:"regsessions",data:d})})}
function sess(){B().innerHTML=head("🎓 İmtahan sessiyaları")+'<div id="sl" class="dqm-m">Yüklənir…</div><h3 style="margin-top:14px">Yeni imtahan</h3><div class="dqm-r"><div><label>Ad</label><input id="s1" placeholder="Sınaq 4"></div><div><label>Kateqoriya</label><input id="s2" placeholder="BB / BA / AC"></div></div><div class="dqm-r"><div><label>Tarix (qısa)</label><input id="s3" placeholder="14 okt"></div><div><label>İmtahan vaxtı</label><input id="s4" placeholder="14 okt, 18:53"></div></div><div class="dqm-r"><div><label>Saat aralığı</label><input id="s5" placeholder="18:53 – 23:59"></div><div><label>Qeydiyyat bitmə</label><input id="s6" placeholder="13 okt"></div></div><div class="dqm-r"><div><label>Qiymət (₼, 0 = pulsuz)</label><input id="s7" type="number" value="0"></div><div><label>Yer sayı</label><input id="s8" type="number" value="50"></div></div><label><input id="s9" type="checkbox" checked style="width:auto"> Dərhal aktiv (qeydiyyata açıq)</label><br><br><button id="sa" style="width:100%">+ Əlavə et</button>';wire();
 var row=null,list=[];
 function draw(){q("#sl").innerHTML=list.length?list.map(function(s,i){return'<div class="dqm-i"><div><b>'+esc(s.name)+"</b> · "+esc(s.cat)+'<div class="dqm-m">'+esc(s.exam||s.time)+" · "+(s.taken||0)+"/"+(s.cap||0)+'</div></div><div><button class="s" data-t="'+i+'">'+(s.open?"Bağla":"Aktivləşdir")+'</button> <button class="d" data-d="'+i+'">🗑</button></div></div>'}).join(""):"Sessiya yoxdur";
  [].forEach.call(q("#sl").querySelectorAll("[data-t]"),function(b){b.onclick=function(){list[b.dataset.t].open=!list[b.dataset.t].open;saveReg(row,list).then(function(){toast("Yadda saxlandı ✓");draw()}).catch(function(e){toast(e.message)})}});
  [].forEach.call(q("#sl").querySelectorAll("[data-d]"),function(b){b.onclick=function(){if(!confirm("Silinsin?"))return;list.splice(b.dataset.d,1);saveReg(row,list).then(function(){toast("Silindi");draw()}).catch(function(e){toast(e.message)})}})}
 getReg().then(function(r){row=r;list=r&&r.data&&Array.isArray(r.data.list)?r.data.list:[];draw()}).catch(function(e){q("#sl").textContent="Xəta: "+e.message});
 q("#sa").onclick=function(){var n=q("#s1").value.trim(),c=q("#s2").value.trim().toUpperCase();if(!n||!c)return toast("Ad və kateqoriyanı yazın");
  list.push({id:"s"+Date.now(),kind:"Ümumi sınaq",duration:180,cat:c,name:n,place:"DQplatform",time:q("#s3").value||"Hər zaman açıq",exam:q("#s4").value||"İstənilən vaxt",hours:q("#s5").value||"Müddətsiz giriş",deadline:q("#s6").value||"Müddətsiz",price:+q("#s7").value||0,cap:+q("#s8").value||50,taken:0,open:q("#s9").checked});
  saveReg(row,list).then(function(){return getReg()}).then(function(r){row=r;toast("Əlavə olundu ✓");draw()}).catch(function(e){toast("Xəta: "+e.message)})}}

/* ---- 3. Sual / sınaq / test yükləmə (exam_questions) — saytın Pro Add modulunun eyni sütun xəritəsi ilə ---- */
var L5=["A","B","C","D","E"];
function sample(){return api("exam_questions?select=*&limit=1").then(function(r){return r&&r[0]})}
function mapper(sm){var K=Object.keys(sm),f=function(re){return K.filter(function(k){return re.test(k)})[0]},m={};
 m.cat=f(/^category$/);m.exam=f(/^exam_id$/);m.num=f(/^(q_?num(ber)?|question_(num|no|number|index)|num(ber)?|q_?no|order(_?index)?|position|idx|index|sira)$/i);
 m.q=f(/^(question(_text)?|q_?text|text|title|sual)$/i);m.opts=f(/^(options?|variants?|choices|answers)$/i);m.corr=f(/^(correct(_?(answer|option|index|idx))?|answer|right_?answer|dogru)$/i);
 if(!m.opts){m.each=L5.map(function(L){return f(new RegExp("^(opt(ion)?_?"+L+"|variant_?"+L+"|"+L+")$","i"))});if(m.each.filter(Boolean).length<4)m.each=null}return m}
function toRow(r,i,m,sm,exam,cat,start){var o={};if(m.exam)o[m.exam]=typeof sm[m.exam]==="number"?+exam:String(exam);o[m.cat]=cat;if(m.num)o[m.num]=start+i;o[m.q]=r.q;
 var op=r.o.filter(function(x,k){return k<4||x});if(m.opts){o[m.opts]=op}else m.each.forEach(function(k,j){if(k)o[k]=r.o[j]||""});
 var cv=sm[m.corr];o[m.corr]=typeof cv==="number"?r.c:(typeof cv==="string"&&/^[A-E]$/i.test(cv)?L5[r.c]:(op[r.c]||""));return o}
function quest(mode){var isS=mode=="sinaq";
 B().innerHTML=head(isS?"🎯 Yeni sınaq əlavə et":"📝 Yeni test / sual əlavə et")+'<p class="dqm-m">Hər sətir bir sual: <b>sual | A | B | C | D | düzgün cavab (hərf)</b> — 5 variant üçün E də yazın.</p><div class="dqm-r"><div><label>'+(isS?"Sınaq nömrəsi (exam_id)":"Sınaq nömrəsi")+'</label><input id="q1"></div><div><label>Kateqoriya (BB / BA / AC)</label><input id="q2"></div></div><textarea id="q3" rows="8"></textarea><label><input id="q4" type="checkbox" '+(isS?"checked":"")+' style="width:auto"> Köhnə sualları silib yenisi ilə əvəz et</label><br><br><button id="q5" style="width:100%">Yüklə</button><p class="dqm-m" id="q6"></p>';wire();
 q("#q5").onclick=function(){var ex=q("#q1").value.trim(),ct=q("#q2").value.trim().toUpperCase(),L=q("#q3").value.split("\n").map(function(x){return x.trim()}).filter(Boolean),rep=q("#q4").checked;if(!ex||!ct||!L.length)return toast("Sahələri doldurun");
  var sm,m,rows;
  sample().then(function(s){if(!s)throw new Error("Bazada nümunə sual yoxdur — sütun strukturu təyin edilə bilmədi");sm=s;m=mapper(s);
   if(!m.exam||!m.cat||!m.q||!m.corr||!(m.opts||m.each))throw new Error("Sütunlar tanınmadı: "+Object.keys(s).join(", "));
   rows=L.map(function(l,i){var p=l.split("|").map(function(x){return x.trim()}),c=L5.indexOf((p[p.length-1]||"").toUpperCase()),o=p.slice(1,-1);if(p.length<4||c<0||c>=o.length)throw new Error((i+1)+"-ci sətir: format səhvdir (sual | A | B | C | D | düzgün hərf)");return{q:p[0],o:o,c:c}});
   var f="?"+m.exam+"=eq."+encodeURIComponent(ex)+"&"+m.cat+"=eq."+encodeURIComponent(ct);
   if(rep){if(!confirm(rows.length+" sual yüklənəcək, bu sınaq/kateqoriyadakı köhnələr silinəcək. Davam?"))throw new Error("Ləğv edildi");return api("exam_questions"+f,{method:"DELETE"}).then(function(){return 0})}
   return api("exam_questions"+f+"&select=id"+(m.num?","+m.num:"")).then(function(a){return m.num?a.reduce(function(x,r){return Math.max(x,+r[m.num]||0)},0):a.length})})
  .then(function(off){var data=rows.map(function(r,i){return toRow(r,i,m,sm,ex,ct,off+1)}),ch=Promise.resolve();
   for(var i=0;i<data.length;i+=50)(function(i){ch=ch.then(function(){return api("exam_questions",{method:"POST",h:{Prefer:"return=minimal"},body:JSON.stringify(data.slice(i,i+50))}).then(function(){q("#q6").textContent=Math.min(i+50,data.length)+"/"+data.length})})})(i);return ch})
  .then(function(){toast("Yükləndi ✓")}).catch(function(e){toast("Xəta: "+e.message);q("#q6").textContent=e.message})}}
window.DQMode={sess:function(el){T=el;sess()},quest:function(md,el){T=el;quest(md)}};
})();
