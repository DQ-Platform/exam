/* DQ Resepşin — admin modulu: ad-soyad + sınaq/kateqoriya icazəsi + unikal (birdəfəlik) iş nömrəsi + link göndərmə */
(function(){"use strict";
var $=function(i){return document.getElementById(i)};
var AL="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",CATS=["BA","BB","AC"],T="allowed_students";
var cur=null,cols=null,rowsCache=[];
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
function linkOf(p){
 var u=new URL(location.href);u.search="";u.hash="";
 u.searchParams.set("giris","1");u.searchParams.set("qrup",p.cats.join(","));u.searchParams.set("sinaq",p.exam);
 return u.toString()}
function link(){return linkOf(cur)}
function textOf(p){return "Salam, "+p.name+"!\n\nSizə sınaq "+p.exam+" ("+p.cats.join(", ")+" qrupları) üçün iştirak icazəsi verildi ✅\n\nDaxil olmaq üçün linkə keçin:\n"+linkOf(p)+"\n\nİş nömrəniz: "+p.fin+"\n\n⚠️ Xatırlatma: sualları qruplara və başqalarına göndərmək qadağandır. Sınaq zəhmətlə hazırlanıb və hər kəs ödəniş edib qoşulub. Linki də başqasına göndərməyin zəhmət olmasa.\nGöndərildikdə hesabınız bloklanır."}
function text(){return textOf(cur)}
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
   rowsCache=rows;
   tb.innerHTML=rows.length?rows.map(function(r,i){var k=r[c.cat];return"<tr><td>"+esc(r[c.name])+"</td><td><b>"+esc(r[c.fin])+"</b></td><td>"+esc(r[c.exam])+"</td><td>"+esc(Array.isArray(k)?k.join(", "):k)+"</td><td><button type=\"button\" class=\"btn btn-sm\" style=\"background:#0b1d44;color:#f3d98b;border:1px solid #c9a24b;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;white-space:nowrap\" onclick=\"DQResep.edit("+i+")\">✏️ Redaktə et</button></td></tr>"}).join(""):"<tr><td colspan=5>Hələ icazə yoxdur</td></tr>"
  }catch(e){tb.innerHTML="<tr><td colspan=5>Yüklənmədi</td></tr>"}},
 open(){
  document.querySelectorAll(".admin-module-block").forEach(function(b){b.style.display="none"});
  var m=$("mod-resepsiya");m.style.display="block";m.scrollIntoView({behavior:"smooth"});this.load()}
};

/* ===== Redaktə pəncərəsi: mövcud şəxsə əlavə sınaq / kateqoriya icazəsi ===== */
var ED={fin:"",name:"",rows:[],sel:{}};
function catsOf(r,c){var k=r[c.cat];return(Array.isArray(k)?k:String(k==null?"":k).replace(/[{}"\[\]]/g,"").split(",")).map(function(x){return String(x).trim().toUpperCase()}).filter(Boolean)}
function pack(c,a){return c.arr?a:a.join(",")}
function edBox(){
 var d=$("rsp-ed");if(d)return d;
 var st=document.createElement("style");st.textContent="#rsp-ed{position:fixed;inset:0;z-index:2147483100;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(3,8,22,.72);backdrop-filter:blur(3px);font-family:inherit}#rsp-ed.on{display:flex}#rsp-ed .b{width:100%;max-width:480px;max-height:92vh;overflow:auto;padding:22px;border-radius:18px;background:linear-gradient(180deg,#112a60,#0b1d44);border:1px solid #c9a24b;color:#e9eefb;box-shadow:0 30px 80px rgba(0,0,0,.6);text-align:left}#rsp-ed h3{margin:0 0 2px;color:#f3d98b;font-size:20px}#rsp-ed .s{color:#9fb0d6;font-size:13px;margin-bottom:14px}#rsp-ed h5{margin:16px 0 8px;color:#c9a24b;font-size:12px;letter-spacing:1.2px;text-transform:uppercase}#rsp-ed .ln{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;margin-bottom:8px;border:1px solid rgba(201,162,75,.35);border-radius:12px;background:rgba(255,255,255,.04)}#rsp-ed .ln b{min-width:70px}#rsp-ed .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:#0a1a3a;border:1px solid #c9a24b;color:#f3d98b;font-weight:800;font-size:12px}#rsp-ed .chip i{font-style:normal;cursor:pointer;color:#fca5a5;font-size:15px;line-height:1}#rsp-ed .ln .sd{margin-left:auto;background:#1faa59;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px;cursor:pointer}#rsp-ed input{width:90px;padding:10px 12px;border-radius:10px;border:1px solid #2c4a8a;background:#081634;color:#fff;font-size:16px;font-weight:700}#rsp-ed .cb{display:inline-block;margin:0 6px 6px 0;padding:8px 16px;border-radius:10px;border:1px solid #4a63a0;background:transparent;color:#d5def5;font-weight:800;cursor:pointer}#rsp-ed .cb.on{background:linear-gradient(180deg,#f3d98b,#c9a24b);color:#0a1a3a;border-color:#c9a24b}#rsp-ed .go{width:100%;margin-top:10px;padding:13px;border:0;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;color:#0a1a3a;background:linear-gradient(180deg,#f3d98b,#c9a24b)}#rsp-ed .cl{width:100%;margin-top:10px;padding:11px;border-radius:12px;border:1px solid #4a63a0;background:transparent;color:#d5def5;font-weight:700;cursor:pointer}#rsp-ed .m{margin-top:10px;font-size:13px;min-height:18px}";
 document.head.appendChild(st);
 d=document.createElement("div");d.id="rsp-ed";
 d.innerHTML='<div class="b"><h3>İcazələri redaktə et</h3><div class="s" id="rsp-ed-s"></div><h5>Mövcud icazələr</h5><div id="rsp-ed-l"></div><h5>Yeni icazə əlavə et</h5><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:13px;color:#c8d4f0">Sınaq №</span><input id="rsp-ed-n" type="number" min="1" value="1"></div><div id="rsp-ed-c"><button type="button" class="cb" data-c="BA">BA</button><button type="button" class="cb" data-c="BB">BB</button><button type="button" class="cb" data-c="AC">AC</button></div><button type="button" class="go" id="rsp-ed-add">➕ İcazəni əlavə et</button><div class="m" id="rsp-ed-m"></div><button type="button" class="cl" id="rsp-ed-x">Bağla</button></div>';
 document.body.appendChild(d);
 d.addEventListener("click",function(e){if(e.target===d)DQResep.closeEd()});
 $("rsp-ed-x").onclick=function(){DQResep.closeEd()};
 $("rsp-ed-add").onclick=function(){DQResep.addPerm()};
 $("rsp-ed-c").addEventListener("click",function(e){var b=e.target.closest(".cb");if(b)b.classList.toggle("on")});
 $("rsp-ed-l").addEventListener("click",function(e){
  var x=e.target.closest("[data-rm]");if(x)return DQResep.rmCat(x.dataset.ex,x.dataset.rm);
  var s=e.target.closest("[data-sd]");if(s)DQResep.sendEd(s.dataset.sd)});
 return d}
function edMsg(t,err){var m=$("rsp-ed-m");m.style.color=err?"#fca5a5":"#86efac";m.textContent=t||""}
async function edRender(){
 var c=await schema(),q=await db().from(T).select("*").eq(c.fin,ED.fin);
 ED.rows=(q.data||[]).slice().sort(function(a,b){return a[c.exam]-b[c.exam]});
 $("rsp-ed-s").textContent=ED.name+" · İş nömrəsi: "+ED.fin;
 $("rsp-ed-l").innerHTML=ED.rows.map(function(r){
  return'<div class="ln"><b>Sınaq '+esc(r[c.exam])+'</b>'+catsOf(r,c).map(function(k){return'<span class="chip">'+esc(k)+'<i data-ex="'+esc(r[c.exam])+'" data-rm="'+esc(k)+'" title="Sil">×</i></span>'}).join("")+'<button type="button" class="sd" data-sd="'+esc(r[c.exam])+'">📤 Göndər</button></div>'}).join("")||'<div class="s">İcazə yoxdur</div>'}
Object.assign(window.DQResep,{
 async edit(i){
  var r=rowsCache[i];if(!r)return;var c=await schema();
  ED.fin=r[c.fin];ED.name=r[c.name]||"";
  var d=edBox();edMsg("");
  d.querySelectorAll("#rsp-ed-c .cb").forEach(function(b){b.classList.remove("on")});
  $("rsp-ed-n").value=r[c.exam]||1;
  d.classList.add("on");
  try{await edRender()}catch(e){edMsg("Yüklənmədi: "+(e.message||e),1)}},
 closeEd(){var d=$("rsp-ed");d&&d.classList.remove("on");this.load()},
 async addPerm(){
  var exam=parseInt($("rsp-ed-n").value,10),
   cats=Array.prototype.map.call(document.querySelectorAll("#rsp-ed-c .cb.on"),function(b){return b.dataset.c});
  if(!exam)return edMsg("Sınaq nömrəsini yazın",1);
  if(!cats.length)return edMsg("Ən azı bir kateqoriya seçin",1);
  var b=$("rsp-ed-add");b.disabled=true;
  try{
   var c=await schema(),ex=ED.rows.filter(function(r){return String(r[c.exam])===String(exam)})[0];
   if(ex){
    var have=catsOf(ex,c),add=cats.filter(function(k){return have.indexOf(k)<0});
    if(!add.length){edMsg("Bu kateqoriyalar artıq verilib",1);return}
    var up={};up[c.cat]=pack(c,have.concat(add));
    var r=await db().from(T).update(up).eq(c.fin,ED.fin).eq(c.exam,exam);if(r.error)throw r.error
   }else{
    var row={};row[c.name]=ED.name;row[c.fin]=ED.fin;row[c.exam]=exam;row[c.cat]=pack(c,cats);
    var r2=await db().from(T).insert(row);if(r2.error)throw r2.error
   }
   edMsg("✅ İcazə əlavə olundu");
   document.querySelectorAll("#rsp-ed-c .cb").forEach(function(x){x.classList.remove("on")});
   await edRender()
  }catch(e){edMsg("Xəta: "+(e.message||e),1)}finally{b.disabled=false}},
 async rmCat(exam,cat){
  if(!confirm("Sınaq "+exam+" üçün "+cat+" icazəsi silinsin?"))return;
  try{
   var c=await schema(),ex=ED.rows.filter(function(r){return String(r[c.exam])===String(exam)})[0];if(!ex)return;
   var left=catsOf(ex,c).filter(function(k){return k!==cat}),r;
   if(left.length){var up={};up[c.cat]=pack(c,left);r=await db().from(T).update(up).eq(c.fin,ED.fin).eq(c.exam,ex[c.exam])}
   else r=await db().from(T).delete().eq(c.fin,ED.fin).eq(c.exam,ex[c.exam]);
   if(r.error)throw r.error;
   edMsg("Silindi");await edRender()
  }catch(e){edMsg("Xəta: "+(e.message||e),1)}},
 async sendEd(exam){
  var c=await schema(),ex=ED.rows.filter(function(r){return String(r[c.exam])===String(exam)})[0];if(!ex)return;
  var t=textOf({name:ED.name,fin:ED.fin,exam:ex[c.exam],cats:catsOf(ex,c)});
  if(navigator.share)navigator.share({title:"İmtahan icazəsi",text:t}).catch(function(){});
  else window.open("https://wa.me/?text="+encodeURIComponent(t),"_blank")}
});
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
 '<h4 class="mt-4" style="text-align:left">Son verilən icazələr</h4><div style="overflow-x:auto"><table><thead><tr><th>Ad Soyad</th><th>İş nömrəsi</th><th>Sınaq №</th><th>Kateqoriya</th><th>Redaktə</th></tr></thead><tbody id="rsp-list"></tbody></table></div></div>';
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
