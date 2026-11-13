/* DQ Mövzu PRO — ortaq kitabxana (Supabase dq_v2_store üzərində) */
(function(){"use strict";
var U="https://cpzwliqlgaplroscvduo.supabase.co",K="sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF",TBL="dq_v2_store";
var WA="994506671557";
var COL={cfg:"mv_cfg",cat:"mv_catalog",q:"mv_q",order:"mv_order",att:"mv_attempt",exam:"ip_exam"};
function H(x){var h={apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"};for(var k in x||{})h[k]=x[k];return h}
function req(path,opt){return fetch(U+"/rest/v1/"+path,opt).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(r.status+" "+t.slice(0,160))});return r.status===204?null:r.text().then(function(t){return t?JSON.parse(t):null})})}
function wrap(r){var d=r.data||{};d._id=r.id;return d}
var DB={
 /* bütün sətirlər (səhifələnmiş) */
 list:function(col,filter,max){var out=[],lim=1000;max=max||20000;
  function page(off){return req(TBL+"?select=id,data&collection=eq."+col+(filter?"&"+filter:"")+"&order=id.asc&limit="+lim+"&offset="+off,{headers:H()}).then(function(a){a=a||[];out=out.concat(a.map(wrap));return(a.length===lim&&out.length<max)?page(off+lim):out})}
  return page(0)},
 add:function(col,data){return req(TBL,{method:"POST",headers:H({Prefer:"return=representation"}),body:JSON.stringify({collection:col,data:data})}).then(function(a){return wrap(a[0])})},
 addMany:function(col,arr){var i=0,res=[];function nx(){if(i>=arr.length)return Promise.resolve(res);var ch=arr.slice(i,i+200).map(function(d){return{collection:col,data:d}});i+=200;return req(TBL,{method:"POST",headers:H({Prefer:"return=representation"}),body:JSON.stringify(ch)}).then(function(a){res=res.concat((a||[]).map(wrap));return nx()})}return nx()},
 put:function(id,data){var d=Object.assign({},data);delete d._id;return req(TBL+"?id=eq."+id,{method:"PATCH",headers:H({Prefer:"return=minimal"}),body:JSON.stringify({data:d})})},
 del:function(id){return req(TBL+"?id=eq."+id,{method:"DELETE",headers:H()})},
 delMany:function(ids){var i=0;function nx(){if(i>=ids.length)return Promise.resolve();var c=ids.slice(i,i+100);i+=100;return req(TBL+"?id=in.("+c.join(",")+")",{method:"DELETE",headers:H()}).then(nx)}return nx()},
 byIds:function(ids){var i=0,out=[];function nx(){if(i>=ids.length)return Promise.resolve(out);var c=ids.slice(i,i+150);i+=150;return req(TBL+"?select=id,data&id=in.("+c.join(",")+")",{headers:H()}).then(function(a){out=out.concat((a||[]).map(wrap));return nx()})}return nx()},
 one:function(col){return req(TBL+"?select=id,data&collection=eq."+col+"&order=id.desc&limit=1",{headers:H()}).then(function(a){return a&&a[0]?wrap(a[0]):null})},
 save1:function(col,data){var id=data._id;if(id)return DB.put(id,data).then(function(){return data});return DB.add(col,data)}
};
var DEF_CFG={wa:WA,cats:["BB","BA","AC"],
 full:{BB:10,BA:13,AC:15},
 single:{partUpTo:10,part:5,all:7},
 multi:{tiers:[{upTo:5,price:5},{upTo:10,price:9}],beyond:11},
 minPerExamMin:1.8,passPct:50,payNote:"Ödənişdən sonra admin sizə icazə verəcək."};
var DEF_CAT={categories:{BB:{subjects:[]},BA:{subjects:[]},AC:{subjects:[]}}};
function uid(p){return(p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function code(){var a="ABCDEFGHJKLMNPQRSTUVWXYZ",d="23456789",all=a+d,s="";for(var i=0;i<7;i++)s+=all[Math.floor(Math.random()*all.length)];
 if(!/\d/.test(s)||!/[A-Z]/.test(s))return code();return s}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function $(s,r){return(r||document).querySelector(s)}
function toast(m,err){var t=document.createElement("div");t.className="toast"+(err?" e":"");t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},err?4500:2600)}
function azn(n){return(Math.round(n*100)/100)+" ₼"}
/* ---- QİYMƏT ---- */
function price(cat,sel,cfg,catalog){
 var subs=((catalog.categories[cat]||{}).subjects)||[],chosen=[],allFull=subs.length>0,i,s,n;
 for(i=0;i<subs.length;i++){s=subs[i];n=(sel[s.id]||[]).length;
  if(n>0)chosen.push({s:s,n:n,total:s.topics.length});
  if(n<s.topics.length||!s.topics.length)allFull=false}
 if(!chosen.length)return{price:0,mode:"none",note:""};
 var full=cfg.full[cat]||0;
 if(allFull)return{price:full,mode:"full",note:"Tam paket ("+cat+")"};
 if(chosen.length===1){var c=chosen[0],p=(c.n>=c.total)?cfg.single.all:(c.n<=cfg.single.partUpTo?cfg.single.part:cfg.single.all);
  return{price:p,mode:"single",note:c.s.name+": "+(c.n>=c.total?"bütün mövzular":c.n+" mövzu")}}
 var sum=0,parts=[];
 chosen.forEach(function(c){var p=cfg.multi.beyond,t=cfg.multi.tiers;for(var k=0;k<t.length;k++)if(c.n<=t[k].upTo){p=t[k].price;break}
  sum+=p;parts.push(c.s.name+" "+p+"₼")});
 var capped=full&&sum>full;
 return{price:capped?full:sum,mode:"multi",note:parts.join(" + ")+(capped?" → paket qiyməti ilə məhdudlaşdı":"")}}
/* ---- RANDOM SINAQ PLANI (fənn üzrə bölgü) ---- */
function plan(cat,sel,catalog,pool){
 var subs=((catalog.categories[cat]||{}).subjects)||[],out=[],rep=[];
 subs.forEach(function(s){var tids=sel[s.id]||[];if(!tids.length)return;
  var quota=+s.quota||0;if(!quota)return;
  var lists=tids.map(function(t){return shuffle(pool.filter(function(q){return q.cat===cat&&q.subj===s.id&&q.topic===t}))}).filter(function(l){return l.length});
  var got=[],k=0;
  while(got.length<quota&&lists.some(function(l){return l.length})){var l=lists[k%lists.length];if(l.length)got.push(l.shift());k++}
  rep.push({subj:s.name,quota:quota,got:got.length});out=out.concat(shuffle(got))});
 return{qs:out,report:rep}}
/* sualı snapshot-a çevir (variantlar qarışdırılır) */
function snap(q,doShuffle){var idx=q.opts.map(function(_,i){return i});if(doShuffle!==false)idx=shuffle(idx);
 return{t:q.text,img:q.img||"",o:idx.map(function(i){return q.opts[i]}),c:idx.indexOf(q.correct),e:q.expl||"",s:q.subj||"",sn:q.subjName||"",tp:q.topic||"",tn:q.topicName||""}}
/* ---- toplu sual parser ---- */
function parseBulk(txt){var blocks=String(txt).replace(/\r/g,"").split(/\n\s*\n+/),out=[],bad=0;
 blocks.forEach(function(b){var lines=b.split("\n").map(function(x){return x.trim()}).filter(Boolean);if(!lines.length)return;
  var q=[],opts=[],cor=-1,ex="",m;
  lines.forEach(function(l){
   if(m=/^(?:düzgün(?: cavab)?|cavab|answer|correct)\s*[:=\-]\s*([A-Ea-e])\b/i.exec(l)){cor="ABCDE".indexOf(m[1].toUpperCase())}
   else if(m=/^(?:[iİ]zah|[şŞ]ərh|explanation)\s*[:=\-]\s*(.+)/i.exec(l)){ex=m[1]}
   else if(m=/^(\*?)\s*([A-Ea-e])\s*[).]\s*(.+)$/.exec(l)){opts.push(m[3].replace(/\s*\*$/,""));if(m[1]==="*"||/\*$/.test(m[3]))cor=opts.length-1}
   else if(!opts.length)q.push(l.replace(/^\d+\s*[).\-]\s*/,""))});
  var text=q.join(" ").trim();
  if(text&&opts.length>=2&&cor>=0&&cor<opts.length)out.push({text:text,opts:opts,correct:cor,expl:ex});else bad++});
 return{ok:out,bad:bad}}
function waLink(msg,num){return"https://wa.me/"+(num||WA)+"?text="+encodeURIComponent(msg)}
window.MV={U:U,K:K,DB:DB,COL:COL,DEF_CFG:DEF_CFG,DEF_CAT:DEF_CAT,uid:uid,esc:esc,code:code,shuffle:shuffle,$:$,toast:toast,azn:azn,price:price,plan:plan,snap:snap,parseBulk:parseBulk,waLink:waLink,WA:WA,
 loadCfg:function(){return DB.one(COL.cfg).then(function(r){var c=r||{};return Object.assign({_id:c._id},JSON.parse(JSON.stringify(DEF_CFG)),c)})},
 loadCat:function(){return DB.one(COL.cat).then(function(r){var c=r||JSON.parse(JSON.stringify(DEF_CAT));["BB","BA","AC"].forEach(function(k){c.categories[k]=c.categories[k]||{subjects:[]}});return c})}};
})();
