/* DQ Resepşin — admin modulu: ad-soyad + sınaq/kateqoriya icazəsi + unikal (birdəfəlik) iş nömrəsi + link göndərmə */
(function(){"use strict";
var $=function(i){return document.getElementById(i)};
var AL="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",CATS=["BA","BB","AC"],T="allowed_students";
var cur=null,cols=null;
function db(){
 try{if(typeof _supabase!=="undefined"&&_supabase&&_supabase.from)return _supabase}catch(e){}
 var w=window,c=[w._supabase,w.sb,w.supabaseClient,w.parent&&w.parent!==w?w.parent._supabase:null];
 for(var i=0;i<c.length;i++)if(c[i]&&c[i].from)return c[i];
 return null}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function pick(row,re,def){if(row)for(var k in row)if(re.test(k))return k;return def}
/* sütun adlarını cədvəldən avtomatik tapır; boşdursa standart adlar */
async function schema(){
 if(cols)return cols;var r=null;
 try{var q=await db().from(T).select("*").limit(1);r=q.data&&q.data[0]}catch(e){}
 cols={name:pick(r,/^(student_?name|full_?name|name|ad)/i,"student_name"),fin:pick(r,/fin|code|kod|is_?nom/i,"fin"),
  exam:pick(r,/exam/i,"exam_no"),cat:pick(r,/cat|kateq/i,"categories"),start:pick(r,/start/i,null),
  arr:!!(r&&Array.isArray(r[pick(r,/cat|kateq/i,"categories")]))};
 return cols}
function gen(){var s="";for(var i=0;i<7;i++)s+=AL[Math.floor(Math.random()*AL.length)];return s}
async function uniqueCode(c){
 for(var n=0;n<30;n++){var f=gen(),q=await db().from(T).select(c.fin).eq(c.fin,f).limit(1);
  if(!(q.data&&q.data.length))return f}
 throw new Error("Unikal nömrə tapılmadı, yenidən cəhd edin")}
function msg(t,err){var m=$("rsp-msg");m.style.color=err?"#b91c1c":"#047857";m.textContent=t}
function chosen(){return Array.prototype.map.call(document.querySelectorAll("#rsp-cats .cat-btn.active"),function(b){return b.dataset.cat})}
function link(){
 var u=new URL(location.href);u.search="";u.hash="";
 u.searchParams.set("giris","1");u.searchParams.set("qrup",cur.cats.join(","));u.searchParams.set("sinaq",cur.exam);
 return u.toString()}
function text(){return "Salam, "+cur.name+"!\n\nSizə sınaq "+cur.exam+" ("+cur.cats.join(", ")+" qrupları) üçün iştirak icazəsi verildi ✅\n\nDaxil olmaq üçün linkə keçin:\n"+link()+"\n\nİş nömrəniz: "+cur.fin+"\n\n⚠️ Xatırlatma: sualları qruplara və başqalarına göndərmək qadağandır. Sınaq zəhmətlə hazırlanıb və hər kəs ödəniş edib qoşulub. Linki də başqasına göndərməyin zəhmət olmasa.\nGöndərildikdə hesabınız bloklanır."}
window.DQResep={
 async gen(){
  var name=$("rsp-name").value.trim(),exam=parseInt($("rsp-exam").value,10),cats=chosen();
  if(!name)return msg("Ad və soyadı yazın",1);
  if(!exam)return msg("Sınaq nömrəsini yazın",1);
  if(!cats.length)return msg("Ən azı bir kateqoriya seçin",1);
  if(!db())return msg("Verilənlər bazası bağlantısı tapılmadı — saytda admin kimi daxil olub səhifəni yeniləyin",1);
  if(cur)return msg("Bu şəxs üçün iş nömrəsi artıq yaradılıb. Yeni şəxs üçün «Yeni şəxs» düyməsini basın",1);
  var b=$("rsp-gen");b.disabled=true;
  try{
   var c=await schema(),fin=await uniqueCode(c),row={};
   row[c.name]=name;row[c.fin]=fin;row[c.exam]=exam;row[c.cat]=c.arr?cats:cats.join(",");
   var r=await db().from(T).insert(row);if(r.error)throw r.error;
   cur={name:name,fin:fin,exam:exam,cats:cats};
   $("rsp-fin").value=fin;$("rsp-send").style.display="flex";
   msg("✅ İş nömrəsi yaradıldı və icazə yazıldı. Bu nömrə yalnız bir dəfə verilir.");
   this.load()
  }catch(e){msg("Xəta: "+(e.message||e),1);b.disabled=false}
 },
 reset(){cur=null;$("rsp-name").value="";$("rsp-fin").value="";$("rsp-send").style.display="none";$("rsp-gen").disabled=false;msg("")},
 copy(){if(!cur)return;navigator.clipboard.writeText(link()).then(function(){msg("🔗 Link kopyalandı")},function(){prompt("Linki kopyalayın:",link())})},
 send(){
  if(!cur)return;var t=text();
  if(navigator.share)navigator.share({title:"İmtahan icazəsi",text:t}).catch(function(){});
  else window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank")},
 async load(){
  var tb=$("rsp-list");
  try{var c=await schema(),q=await db().from(T).select("*").order("created_at",{ascending:false}).limit(50);
   if(q.error)q=await db().from(T).select("*").limit(50);
   var rows=q.data||[];
   tb.innerHTML=rows.length?rows.map(function(r){var k=r[c.cat];return"<tr><td>"+esc(r[c.name])+"</td><td><b>"+esc(r[c.fin])+"</b></td><td>"+esc(r[c.exam])+"</td><td>"+esc(Array.isArray(k)?k.join(", "):k)+"</td></tr>"}).join(""):"<tr><td colspan=4>Hələ icazə yoxdur</td></tr>"
  }catch(e){tb.innerHTML="<tr><td colspan=4>Yüklənmədi</td></tr>"}},
 open(){
  document.querySelectorAll(".admin-module-block").forEach(function(b){b.style.display="none"});
  var m=$("mod-resepsiya");m.style.display="block";m.scrollIntoView({behavior:"smooth"});this.load()}
};
function build(){
 var grid=document.querySelector(".admin-nav-grid"),host=$("mod-idare")&&$("mod-idare").parentNode;
 if(!grid||!host||$("mod-resepsiya"))return false;
 var card=document.createElement("div");card.className="admin-nav-card";card.style.cssText="background:#b8860b;color:#fff";
 card.innerHTML='<span class="icon">🛎️</span> Resepşin';card.onclick=function(){DQResep.open()};grid.insertBefore(card,grid.firstChild);
 var m=document.createElement("div");m.id="mod-resepsiya";m.className="admin-module-block";m.style.display="none";
 m.innerHTML='<h4>🛎️ Resepşin — Sınaq İcazəsi və İş Nömrəsi</h4><div class="mt-3" style="background:#f8fafc;padding:15px;border-radius:12px;border:1px solid #e2e8f0">'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap" class="mb-2"><input id="rsp-name" class="form-control" placeholder="Ad Soyad" style="flex:2;min-width:180px">'+
 '<input id="rsp-exam" type="number" class="form-control" placeholder="Sınaq №" value="1" style="flex:1;min-width:90px"></div>'+
 '<div id="rsp-cats" class="category-buttons">'+CATS.map(function(c){return'<button type="button" class="cat-btn" data-cat="'+c+'" onclick="this.classList.toggle(\'active\')">'+c+'</button>'}).join("")+'</div>'+
 '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><button id="rsp-gen" class="btn btn-success" onclick="DQResep.gen()">🔑 İş nömrəsi yarat</button>'+
 '<button class="btn btn-secondary" onclick="DQResep.reset()">➕ Yeni şəxs</button></div>'+
 '<input id="rsp-fin" class="form-control token-field" readonly placeholder="İş nömrəsi burada görünəcək" style="margin-top:10px;text-align:center;font-weight:700">'+
 '<div id="rsp-send" style="display:none;gap:10px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary" onclick="DQResep.send()">📤 Linki istifadəçiyə göndər</button>'+
 '<button class="btn btn-secondary" onclick="DQResep.copy()">🔗 Linki kopyala</button></div>'+
 '<p id="rsp-msg" style="font-size:13px;margin-top:8px"></p>'+
 '<h4 class="mt-4" style="text-align:left">Son verilən icazələr</h4><div style="overflow-x:auto"><table><thead><tr><th>Ad Soyad</th><th>İş nömrəsi</th><th>Sınaq №</th><th>Kateqoriya</th></tr></thead><tbody id="rsp-list"></tbody></table></div></div>';
 host.appendChild(m);
 var w=window.switchAdminTab;if(typeof w==="function"&&!w.__rsp){var f=function(){m.style.display="none";return w.apply(this,arguments)};f.__rsp=1;window.switchAdminTab=f}
 return true}
var n=0,iv=setInterval(function(){if(build()||++n>60)clearInterval(iv)},500);

/* İstifadəçi linkə daxil olduqda: ?sinaq=1&kat=BB&is=XXXXXXX → uyğun imtahan kartının «Başla» düyməsini açır,
   giriş pəncərəsi (3 addımlı) açılır; iş nömrəsi 2-ci addımda avtomatik yazılır */
var P=new URLSearchParams(location.search),LS=P.get("sinaq"),LK=(P.get("kat")||"").split(",")[0],LF=P.get("is");
if(LS&&LK){try{sessionStorage.setItem("dq_rsp_fin",LF||"")}catch(e){}
 var t=0,h=setInterval(function(){
  var btn=Array.prototype.find.call(document.querySelectorAll("button,a,div[role=button]"),function(b){return /Başla/.test(b.textContent)&&b.offsetParent});
  var card=btn&&btn.closest("[class*=card]");
  if(card&&card.textContent.indexOf(LK)>-1&&new RegExp("Sınaq\\s*"+LS+"\\b").test(card.textContent)){clearInterval(h);btn.click()}
  else if(++t>40)clearInterval(h)},500);
 var fi=setInterval(function(){var i=$("user-fin")||document.querySelector('input[placeholder*="MƏSƏLƏN"],input[placeholder*="Məsələn"]');
  if(i&&LF&&!i.value){i.value=LF;i.dispatchEvent(new Event("input",{bubbles:true}));clearInterval(fi)}},600);
 setTimeout(function(){clearInterval(fi)},30000)}
})();

/* İcazə yoxdursa: giriş pəncərəsindəki xəta mesajının altında «WhatsApp ilə yaz» düyməsi çıxır.
   Mesaj hazır yazılmış halda +994504305162 nömrəsinə açılır, istifadəçi yalnız «göndər» basır. */
(function(){
 var WA="994504305162",ad={};
 document.addEventListener("input",function(e){
  var i=e.target;if(!i||i.tagName!=="INPUT")return;
  var l=i.closest("label,div"),t=(l&&l.textContent||"");
  if(/Adınız/.test(t)&&!/Soyad/.test(t.slice(0,12)))ad.a=i.value.trim();
  else if(/Soyadınız/.test(t))ad.s=i.value.trim();
  else if(/İş nömrəsi/.test(t)||i.id==="user-fin")ad.f=i.value.trim().toUpperCase()},true);
 function scan(){
  document.querySelectorAll("div,p,span,small").forEach(function(el){
   if(el.children.length||el.dataset.rspWa||!/icazə verilməyib/.test(el.textContent))return;
   el.dataset.rspWa="1";
   var m=el.textContent.match(/«(Sınaq\s*\d+)»\s*\(([^)]+)\)/),ex=m?m[1]:"Sınaq",kt=m?m[2]:"";
   var fin=ad.f;
   if(!fin){var inp=el.closest("div[class],form,section");inp=inp&&inp.querySelector("input");fin=inp&&inp.value.trim().toUpperCase()||""}
   var nm=((ad.a||"")+" "+(ad.s||"")).trim()||"DQ Platform";
   var txt="Salam mən "+ex+(kt?" - "+kt+" kateqoriyası":"")+" üçün qeydiyyatdan keçmək istəyirəm.\nÖdəniş üçün kart kodu qeyd edə bilərsizmi zəhmət olmasa.\nAd: "+nm+", İş nömrəsi: "+fin;
   var a=document.createElement("a");a.href="https://wa.me/"+WA+"?text="+encodeURIComponent(txt);a.target="_blank";a.rel="noopener";
   a.textContent="💬 WhatsApp ilə yaz";
   a.style.cssText="display:block;margin:10px 0 0;padding:12px;border-radius:12px;background:#25d366;color:#fff;font-weight:700;text-align:center;text-decoration:none";
   el.insertAdjacentElement("afterend",a)})}
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,characterData:true})
})();
