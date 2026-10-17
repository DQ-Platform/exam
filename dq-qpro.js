/* DQ QPRO — Smart Kəsmə + Sual Bankı + Sınağa təyin et. Mövcud kodu dəyişmir, ayrıca modul kimi qoşulur.
   Bank: Supabase "question_bank" cədvəli varsa orada, yoxdursa bu cihazın IndexedDB-sində saxlanır. */
(function(){"use strict";
if(window.QPRO)return;
var S={items:[],sel:{},cur:null,res:[],files:[],mode:"idb",tab:1,busy:0};
var E=function(i){return document.getElementById(i)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var uid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var msg=function(m,id){var t=E(id||"qp-msg");if(t)t.textContent=m};
var L=["A","B","C","D","E"],LL="ABCDEFGH".split("");

/* ---------- Saxlama ---------- */
var SUBJ=["Azərbaycan dili","Qanunvericilik","İnformatika","Məntiq"],SQLM="alter table question_bank add column if not exists subject text;\nalter table question_bank add column if not exists used jsonb default '[]'::jsonb;\nnotify pgrst, 'reload schema';";
function metaGet(){try{return JSON.parse(localStorage.getItem("dq_qmeta")||"{}")}catch(e){return{}}}
function metaSet(id,sj,us){var m=metaGet();m[id]={subject:sj||"",used:us||[]};try{localStorage.setItem("dq_qmeta",JSON.stringify(m))}catch(e){}}
function usedOf(it){return Array.isArray(it.used)?it.used:[]}
function usedTxt(it){var u=usedOf(it);if(!u.length)return'<span class="qp-nu">⏳ İstifadə olunmayıb</span>';
 return'<span class="qp-us">✅ İstifadə olunub: '+u.slice(0,3).map(function(x){return"Sınaq "+esc(x.ex)+" · "+esc(x.cat||"")+" №"+esc(x.n)}).join("; ")+(u.length>3?" +"+(u.length-3):"")+'</span>'}
function subjNorm(v){v=String(v||"").toLowerCase().trim();if(!v)return"";for(var i=0;i<SUBJ.length;i++)if(v.slice(0,4)===SUBJ[i].toLowerCase().slice(0,4))return SUBJ[i];return""}
function subjSel(val,attr){return'<select '+attr+'><option value="">— fənn —</option>'+SUBJ.map(function(x){return'<option'+(val===x?" selected":"")+'>'+x+'</option>'}).join("")+(val&&SUBJ.indexOf(val)<0?'<option selected>'+esc(val)+'</option>':"")+'</select>'}
var RLS=function(e){return!!e&&(e.code==="42501"||/row-level security|permission denied/i.test(e.message||""))};
var ST={db:null,
 idb:function(){return this.db||(this.db=new Promise(function(ok,no){var r=indexedDB.open("dq_qbank",1);r.onupgradeneeded=function(){r.result.createObjectStore("q",{keyPath:"id"})};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}}))},
 tx:function(m,f){return this.idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction("q",m),q=f(t.objectStore("q"));t.oncomplete=function(){ok(q&&q.result)};t.onerror=function(){no(t.error)}})})},
 init:async function(){try{var r=await _supabase.from("question_bank").select("id").limit(1);S.mode=r.error?"idb":"sb"}catch(e){S.mode="idb"}
  S.meta=false;if(S.mode==="sb"){try{var r2=await _supabase.from("question_bank").select("subject,used").limit(1);S.meta=!r2.error}catch(e){S.meta=false}}},
 all:async function(){var loc=[];try{loc=(await this.tx("readonly",function(o){return o.getAll()}))||[]}catch(e){}
  if(S.mode==="sb"){var r=await _supabase.from("question_bank").select("*").order("created",{ascending:true});if(r.error)throw r.error;
   var ids={},out=r.data||[];out.forEach(function(x){ids[x.id]=1});S.nloc=0;loc.forEach(function(x){if(!ids[x.id]){x._local=1;S.nloc++;out.push(x)}});
   if(!S.meta){var mm=metaGet();out.forEach(function(x){var m=mm[x.id];if(m){x.subject=m.subject;x.used=m.used}})}return out}
  S.nloc=0;return loc},
 put:async function(it0){var it=Object.assign({},it0);delete it._local;if(it.oi){var oi=it.oi;it.opts=(it.opts||[]).map(function(t,k){return oi[k]?"\u0001IMG:"+oi[k]+"\u0001"+(t||""):(t||"")});delete it.oi}
  if(S.mode==="sb"){if(!S.meta){metaSet(it.id,it.subject,it.used);delete it.subject;delete it.used}var r=await _supabase.from("question_bank").upsert([it]);
   if(r.error){if(RLS(r.error)){S.rls=1;await this.tx("readwrite",function(o){return o.put(it)});return}throw r.error}}
  else await this.tx("readwrite",function(o){return o.put(it)})},
 del:async function(id){try{await this.tx("readwrite",function(o){return o["delete"](id)})}catch(e){}
  if(S.mode==="sb"){var r=await _supabase.from("question_bank").delete().eq("id",id);if(r.error&&!RLS(r.error))throw r.error}},
 sync:async function(){var loc=(await this.tx("readonly",function(o){return o.getAll()}))||[],ok=0;
  for(var i=0;i<loc.length;i++){var c=Object.assign({},loc[i]);delete c._local;var r=await _supabase.from("question_bank").upsert([c]);
   if(r.error)throw r.error;await this.tx("readwrite",function(o){return o["delete"](c.id)});ok++}return ok}
};

/* ---------- Şəkil / PDF -> canvas ---------- */
async function pageTokens(p,v){var tc=await p.getTextContent(),o=[],m1=v.transform;
 tc.items.forEach(function(it){var s=it.str;if(!s||!s.trim())return;var m2=it.transform,
  m=[m1[0]*m2[0]+m1[2]*m2[1],m1[1]*m2[0]+m1[3]*m2[1],m1[0]*m2[2]+m1[2]*m2[3],m1[1]*m2[2]+m1[3]*m2[3],m1[0]*m2[4]+m1[2]*m2[5]+m1[4],m1[1]*m2[4]+m1[3]*m2[5]+m1[5]],
  h=Math.hypot(m[2],m[3])||12,w=(it.width||0)*v.scale,L=s.length,re=/\S+/g,t;
  while((t=re.exec(s)))o.push({t:t[0],x:m[4]+w*t.index/L,y:m[5]-h,w:w*t[0].length/L,h:h})});
 return o}
/* ---------- Cavab açarı (PDF sonundakı "56 D / 57 B …" cədvəli) ---------- */
function findKey(tk){
 tk=(tk||[]).filter(function(a){return a.t&&!/^[-–—:.,;|()]+$/.test(a.t)});
 var P=[];
 tk.forEach(function(a){var m=/^(\d{1,3})[-–.:)]?([A-Ea-e])$/.exec(a.t);
  if(m){P.push({n:+m[1],l:m[2].toUpperCase(),x:a.x,y:a.y,w:a.w,h:a.h});return}
  if(!/^\d{1,3}$/.test(a.t))return;
  var yc=a.y+a.h/2,best=null;
  tk.forEach(function(b){if(b===a||!/^[A-Ea-e]$/.test(b.t))return;var dx=b.x-(a.x+a.w);if(dx<-a.h*.3||dx>a.h*6)return;
   if(Math.abs(b.y+b.h/2-yc)>Math.max(a.h,b.h)*.6)return;if(!best||dx<best.dx)best={b:b,dx:dx}});
  if(best)P.push({n:+a.t,l:best.b.t.toUpperCase(),x:a.x,y:a.y,w:best.b.x+best.b.w-a.x,h:Math.max(a.h,best.b.h)})});
 if(P.length<4)return null;
 var hs=P.map(function(p){return p.h}).sort(function(a,b){return a-b}),hm=hs[hs.length>>1]||16,map={},boxes=[];
 function runs(ax,ot,tol){var g=[],S2=P.slice().sort(function(a,b){return a[ax]-b[ax]});
  S2.forEach(function(p){var l=g[g.length-1];if(l&&p[ax]-l[l.length-1][ax]<=tol)l.push(p);else g.push([p])});
  g.forEach(function(c){c.sort(function(a,b){return a[ot]-b[ot]});var cur=[];
   function flush(){if(cur.length>=4){var x0=1e9,y0=1e9,x1=0,y1=0;cur.forEach(function(p){map[p.n]=L.indexOf(p.l);x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x+p.w);y1=Math.max(y1,p.y+p.h)});
     boxes.push({x:x0-.9*hm,y:y0-.55*hm,w:x1-x0+2.9*hm,h:y1-y0+1.1*hm})}cur=[]}
   c.forEach(function(p){var l=cur[cur.length-1];if(l&&p.n===l.n)return;if(l&&p.n-l.n>=1&&p.n-l.n<=2)cur.push(p);else{flush();cur=[p]}});flush()})}
 runs("x","y",hm*1.5);runs("y","x",hm*.6);
 return Object.keys(map).length>=4?{map:map,boxes:boxes}:null}
function parseKey(s){var K={},re=/(\d{1,3})\s*[-–.:)=]*\s*([A-Ea-e])(?![A-Za-z])/g,m;while((m=re.exec(String(s||""))))K[+m[1]]=L.indexOf(m[2].toUpperCase());return K}
function applyKey(list,K){var n=0;list.forEach(function(q){if(q.correct<0&&K[q.n]!=null&&K[q.n]>-1&&K[q.n]<q.opts.length){q.correct=K[q.n];q.auto=1;n++}});return n}
function loadImg(src){return new Promise(function(ok,no){var i=new Image();i.onload=function(){ok(i)};i.onerror=no;i.src=src})}
async function filePages(f){
 if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){
  var pdf=await pdfjsLib.getDocument(new Uint8Array(await f.arrayBuffer())).promise,out=[];
  for(var i=1;i<=pdf.numPages;i++){var p=await pdf.getPage(i),v=p.getViewport({scale:2.5}),c=document.createElement("canvas");c.width=v.width;c.height=v.height;await p.render({canvasContext:c.getContext("2d"),viewport:v}).promise;try{c.qtx=await pageTokens(p,v)}catch(e){c.qtx=[]}out.push(c)}
  return out}
 var im=await loadImg(URL.createObjectURL(f)),c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext("2d").drawImage(im,0,0);return[c]}
function needOCR(){return window.Tesseract?Promise.resolve():new Promise(function(ok,no){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";s.onload=ok;s.onerror=function(){no(new Error("OCR yüklənmədi (internet?)"))};document.head.appendChild(s)})}
async function mkWorker(){var w=await Tesseract.createWorker("eng");try{if(w.loadLanguage){await w.loadLanguage("eng");await w.initialize("eng")}}catch(e){}
 await w.setParameters({tessedit_char_whitelist:"0123456789.",tessedit_pageseg_mode:"6"});return w}
function words(d){if(d.words&&d.words.length)return d.words;var o=[];(d.blocks||[]).forEach(function(b){(b.paragraphs||[]).forEach(function(p){(p.lines||[]).forEach(function(l){(l.words||[]).forEach(function(w){o.push(w)})})})});return o}

/* ---------- Avtomatik bölmə ---------- */
async function segment(cv){
 var W=cv.width,H=cv.height,g=cv.getContext("2d").getImageData(0,0,W,H).data;
 var lum=function(x,y){var i=(y*W+x)*4;return .299*g[i]+.587*g[i+1]+.114*g[i+2]};
 var rowMean=function(y){var s=0,n=0;for(var x=0;x<W;x+=4){s+=lum(x,y);n++}return s/n};
 var y0=0,y1=H;while(y0<H/3&&rowMean(y0)<120)y0++;while(y1>H*2/3&&rowMean(y1-1)<120)y1--;
 var sc=W<1600?2:1,oc=document.createElement("canvas");oc.width=W*sc;oc.height=(y1-y0)*sc;
 oc.getContext("2d").drawImage(cv,0,y0,W,y1-y0,0,0,oc.width,oc.height);
 var r=await Tesseract.recognize(oc,"eng"),ws=words(r.data).map(function(w){return{t:(w.text||"").trim(),x:w.bbox.x0/sc,y:w.bbox.y0/sc+y0,w:(w.bbox.x1-w.bbox.x0)/sc,h:(w.bbox.y1-w.bbox.y0)/sc}});
 var key=findKey(cv.qtx&&cv.qtx.length?cv.qtx:null)||findKey(ws);
 var inK=function(x,y){return key&&key.boxes.some(function(b){return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h})},dk=function(x,y){return lum(x,y)<140&&!inK(x,y)};
 var hs=ws.map(function(w){return w.h}).sort(function(a,b){return a-b}),lineH=(hs[hs.length>>1]||18)*1.5;
 var cd=ws.filter(function(w){return/^\d{1,3}\.$/.test(w.t)}).map(function(w){return{n:parseInt(w.t,10),x:w.x,y:w.y}});
 if(!cd.length)return{list:[],bounds:[0,y0,W,y1],key:key};
 /* sütunlar (ilkin) */
 var xs=cd.map(function(c){return c.x}).sort(function(a,b){return a-b}),cl=[];
 xs.forEach(function(x){var l=cl[cl.length-1];if(l&&x-l.max<W*.12){l.max=x;l.v.push(x)}else cl.push({max:x,v:[x]})});
 cl.forEach(function(c){c.v.sort(function(a,b){return a-b});c.med=c.v[c.v.length>>1]});
 cd.forEach(function(c){var b=0;cl.forEach(function(k,i){if(Math.abs(k.med-c.x)<Math.abs(cl[b].med-c.x))b=i});c.col=b;c.ok=Math.abs(cl[b].med-c.x)<W*.06});
 cd=cd.filter(function(c){return c.ok&&!inK(c.x,c.y)});
 /* 2-ci keçid: hər sütunun kənar zolağında yalnız rəqəm oxu (qalın nömrələri tutur) */
 try{var wk=await mkWorker();
  for(var ci=0;ci<cl.length;ci++){var sx=Math.max(0,Math.round(cl[ci].med-12)),sw=Math.min(W-sx,60),zc=document.createElement("canvas");
   zc.width=sw*3+40;zc.height=(y1-y0)*3+40;var zx=zc.getContext("2d");zx.fillStyle="#fff";zx.fillRect(0,0,zc.width,zc.height);
   zx.drawImage(cv,sx,y0,sw,y1-y0,20,20,sw*3,(y1-y0)*3);
   var zr=await wk.recognize(zc);
   words(zr.data).forEach(function(w){var t=(w.text||"").trim();if(!/^\d{1,3}\.$/.test(t))return;
    var yy=(w.bbox.y0-20)/3+y0;cd=cd.filter(function(c){return!(c.col===ci&&Math.abs(c.y-yy)<25)});
    cd.push({n:parseInt(t,10),x:cl[ci].med,y:yy,col:ci,ok:true})})}
  await wk.terminate()}catch(e){}
 /* hər sütunda artan nömrə zənciri (1.,2.,3. siyahı maddələrini atır) */
 var keep=[];
 cl.forEach(function(k,ci){
  var a=cd.filter(function(c){return c.col===ci}).sort(function(p,q){return p.y-q.y}),dp=[],pv=[],bi=-1;
  a.forEach(function(c,i){dp[i]=1;pv[i]=-1;for(var j=0;j<i;j++)if(a[j].n<c.n&&c.n<=a[j].n+6&&dp[j]+1>dp[i]){dp[i]=dp[j]+1;pv[i]=j}if(bi<0||dp[i]>=dp[bi])bi=i});
  var ch=[];while(bi>=0){ch.unshift(a[bi]);bi=pv[bi]}
  /* zəncirdən əvvəl oxunmamış nömrə varsa (məs. 75. → 1.), onu n-1 kimi qəbul et */
  if(ch.length&&ch[0].n>1){var up=a.filter(function(c){return c.y<ch[0].y-30&&ch.indexOf(c)<0}).pop();if(up){up.n=ch[0].n-1;ch.unshift(up)}}
  keep.push(ch)});
 var mx=Math.max.apply(null,keep.map(function(c){return c.length}));
 if(mx>=2)keep=keep.filter(function(c){return c.length>=2});
 /* ayırıcı şaquli xətt */
 var dv=null,mid=0,cs=keep.map(function(c){return c.length?c[0].x:null}).filter(function(v){return v!=null});
 if(cs.length>1){mid=(cs[0]+cs[1])/2;var best=0;
  for(var x=Math.max(0,Math.round(mid-W*.06));x<Math.min(W,mid+W*.06);x++){var run=0,segs=[],st=0;
   for(var y=y0;y<y1;y++){if(lum(x,y)<130){if(!run)st=y;run++}else{if(run>H*.1)segs.push([st,y]);run=0}}if(run>H*.1)segs.push([st,y1]);
   var tot=segs.reduce(function(s,q){return s+q[1]-q[0]},0);if(tot>best){best=tot;dv={x:x,segs:segs}}}
  if(best<H*.15)dv=null}
 var out=[];
 keep.forEach(function(ch,ci){var colL=Math.max(0,Math.min.apply(null,ch.map(function(c){return c.x}))-14),nxt=keep[ci+1]&&keep[ci+1].length?Math.min.apply(null,keep[ci+1].map(function(c){return c.x})):null;
  var R=dv&&dv.x>colL&&(ci===0||true)&&nxt!=null&&dv.x<nxt?dv.x-5:(nxt!=null?nxt-12:W-4);
  if(key)key.boxes.forEach(function(b){if(b.x>colL+40&&b.x<R)R=Math.min(R,Math.round(b.x)-4)});
  ch.forEach(function(c,i){
   var top=Math.max(y0,Math.round(c.y-8)),lim=i+1<ch.length?Math.round(ch[i+1].y-8):y1;
   if(dv)dv.segs.forEach(function(s){if(top>=s[0]-12&&top<=s[1]+12)lim=Math.min(lim,s[1]+2)});
   var gl=Math.max(34,Math.round(lineH*3.2)),blank=0,seen=0,end=top;
   for(var y=top;y<lim;y++){var ink=0;for(var x=colL;x<R&&ink<2;x++)if(dk(x,y))ink++;
    if(ink>=2){seen=1;blank=0;end=y}else{blank++;if(seen&&blank>=gl)break}}
   /* üfüqi kənarları dəqiqləşdir (ayırıcı xəttin qalığını at) */
   var h=end-top+1,xl=R,xr=colL;
   for(var x=colL;x<R;x++){var n=0;for(var y=top;y<=end;y++)if(dk(x,y))n++;if(n>=2&&n<h*.6){if(x<xl)xl=x;if(x>xr)xr=x}}
   if(xr<=xl)return;
   out.push({n:c.n,x:Math.max(0,xl-10),y:Math.max(0,top-4),w:Math.min(W,xr+10)-Math.max(0,xl-10),h:Math.min(H,end+10)-Math.max(0,top-4),col:ci})})});
 out.sort(function(a,b){return a.n-b.n});
 return{list:out,bounds:[0,y0,W,y1],key:key}}

/* ---------- Kəsik şəkil hazırla (təmizlə + kənar boşluq) ---------- */
function hexc(h){h=String(h||"#ffffff").replace("#","");if(h.length===3)h=h.replace(/./g,"$&$&");return[parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0]}
function render(cv,r,thr,fx){fx=fx||{};
 var P=14,c=document.createElement("canvas");c.width=Math.round(r.w)+P*2;c.height=Math.round(r.h)+P*2;
 var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
 x.drawImage(cv,r.x,r.y,r.w,r.h,P,P,Math.round(r.w),Math.round(r.h));
 (cv.qmask||[]).forEach(function(m){x.fillStyle="#fff";x.fillRect(P+m.x-r.x,P+m.y-r.y,m.w,m.h)});
 var rc=(fx.bg&&String(fx.bg).toLowerCase()!=="#ffffff")||!!fx.fg;
 if(thr<255||rc){var im=x.getImageData(0,0,c.width,c.height),d=im.data,B=hexc(fx.bg),F=fx.fg?hexc(fx.fg):[0,0,0],T=Math.max(thr,100);
  for(var i=0;i<d.length;i+=4){var l=.299*d[i]+.587*d[i+1]+.114*d[i+2];
   if(rc){var t=l>=T?0:l<90?1:(T-l)/(T-90);d[i]=B[0]+(F[0]-B[0])*t;d[i+1]=B[1]+(F[1]-B[1])*t;d[i+2]=B[2]+(F[2]-B[2])*t}
   else{var mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);if(l>thr||(l>150&&mx-mn>30)){d[i]=d[i+1]=d[i+2]=255}else if(l<90){d[i]=d[i+1]=d[i+2]=0}}}
  x.putImageData(im,0,0)}
 return c.toDataURL("image/png")}
function tight(cv,r,thr){var w=Math.max(1,Math.round(r.w)),h=Math.max(1,Math.round(r.h)),c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);
 x.drawImage(cv,r.x,r.y,r.w,r.h,0,0,w,h);var d=x.getImageData(0,0,w,h).data,T=Math.min(thr,205),cs=new Int32Array(w),rs=new Int32Array(h);
 for(var j=0;j<h;j++)for(var i=0;i<w;i++){var k=(j*w+i)*4,l=.299*d[k]+.587*d[k+1]+.114*d[k+2];if(l<T&&!(l>150&&Math.max(d[k],d[k+1],d[k+2])-Math.min(d[k],d[k+1],d[k+2])>30)){cs[i]++;rs[j]++}}
 var x0=0,x1=w-1,y0=0,y1=h-1;while(x0<w&&cs[x0]<2)x0++;while(x1>x0&&cs[x1]<2)x1--;while(y0<h&&rs[y0]<2)y0++;while(y1>y0&&rs[y1]<2)y1--;
 if(x1-x0<8||y1-y0<8)return r;var m=4;x0=Math.max(0,x0-m);y0=Math.max(0,y0-m);x1=Math.min(w-1,x1+m);y1=Math.min(h-1,y1+m);
 return{x:r.x+x0*r.w/w,y:r.y+y0*r.h/h,w:(x1-x0+1)*r.w/w,h:(y1-y0+1)*r.h/h}}
function ensOi(q){if(!q.oi)q.oi=[];if(!q.orc)q.orc=[];while(q.oi.length<q.opts.length)q.oi.push("");while(q.orc.length<q.opts.length)q.orc.push(null)}
function reimg(q){if(!q.cv)return;if(q.r)q.img=render(q.cv,q.r,q.thr,q.fx);if(q.orc)q.orc.forEach(function(r,k){if(r)q.oi[k]=render(q.cv,r,q.thr,q.fx)})}
function fxH(q,d){if(!q.cv||!(q.img||(q.oi||[]).some(function(z){return z})))return"";var f=q.fx||{},t=q.thr;
 return'<div class="qp-fx"><b>🎨 Şəkil: fon və rəng</b><div class="qp-fl" style="margin:6px 0"><label>Fon təmizləmə (watermark)<select '+d+' data-f="fxthr"><option value="255"'+(t>=255?" selected":"")+'>Yox</option><option value="225"'+(t<255&&t>=210?" selected":"")+'>Yüngül</option><option value="200"'+(t<210&&t>=190?" selected":"")+'>Orta</option><option value="175"'+(t<190?" selected":"")+'>Güclü</option></select></label>'
 +'<label>Fon rəngi<input type="color" '+d+' data-f="fxbg" value="'+(f.bg||"#ffffff")+'"></label><label>Yazı rəngi<input type="color" '+d+' data-f="fxfg" value="'+(f.fg||"#000000")+'"></label></div>'
 +'<div class="qp-pre"><button '+d+' data-a="fxpre" data-v="#ffffff|">⬜ Ağ</button><button '+d+' data-a="fxpre" data-v="#fff7e0|">🟨 Krem</button><button '+d+' data-a="fxpre" data-v="#0f172a|#f8fafc">⬛ Tünd</button><button '+d+' data-a="fxreset">↺ Sıfırla</button><button '+d+' data-a="fxall">📋 Hamısına tətbiq et</button></div></div>'}
function stuV(q){var h='<div class="qp-sv"><div class="qp-svh"><span>№'+(q.n||"?")+'</span><small>Tələbə görünüşü</small></div>'+(q.text?'<div class="qp-svt">'+esc(q.text)+'</div>':"")+(q.img?'<div class="qp-svi"><img src="'+q.img+'"></div>':"");
 q.opts.forEach(function(o,k){h+='<div class="qp-svo'+(q.correct===k?" ok":"")+'"><i>'+LL[k]+'</i>'+((q.oi&&q.oi[k])?'<img class="qp-svoi" src="'+q.oi[k]+'">':"")+'<span>'+esc(o)+'</span></div>'});return h+'</div>'}
function updSv(){var q=S.res[S.rs],e=E("qp-svw");if(q&&e)e.innerHTML=stuV(q)}



/* ---------- AI rejimi: şəkildən yalnız sual + variant mətni (Gemini) ---------- */
function aiKey(){var k="";try{k=localStorage.getItem("spro_key")||localStorage.getItem("ysl2_key")||localStorage.getItem("m57_key")||"";
 if(!k){for(var i=0;i<localStorage.length;i++){var n=localStorage.key(i);if(/gemin/i.test(n)&&/key|api/i.test(n)){k=localStorage.getItem(n);if(k)break}}}}catch(e){}return String(k||"").trim()}
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
var AIP="Bu şəkil test sualları səhifəsidir (ekran görüntüsü, foto və ya PDF səhifəsi). Yalnız TAM görünən test suallarını çıxar.\n"
+"QAYDALAR:\n"
+"1) Çıxarma: tətbiq/PDF-oxuyucu başlığı (fayl adı, düymələr), bölmə başlıq qutusu (məs. \"... test tapşırıqları\"), müəllim adı/telefon, su nişanı, alt hissədəki sosial şəbəkə/əlaqə sətri, səhifə nömrəsi, reklam, cavab açarı cədvəli.\n"
+"2) Oxuma sırası: əvvəl sol sütun yuxarıdan aşağı, sonra sağ sütun. Sual bir sütundan digərinə və ya səhifə sonundan növbəti səhifəyə keçirsə və davamı bu şəkildə görünürsə, birləşdir.\n"
+"3) Sualın nömrəsini \"n\" sahəsinə yaz, mətnin içindən sil. \"text\" — sualın mətni (orijinal dildə, düzgün durğu işarələri ilə). Sualın daxilində 1., 2., 3. kimi maddələr varsa, hər birini yeni sətirdə (\\n) saxla.\n"
+"4) \"options\" — variantlar A,B,C,D,E ardıcıllığı ilə, \"A.\" \"B)\" kimi prefikssiz yalnız mətn. Variant yalnız şəkil/cədvəl/diaqramdırsa həmin variantı \"\" yaz (sayını qoru).\n"
+"5) Mətni olduğu kimi köçür, yenidən yazma, tərcümə etmə, səhvləri \"düzəltmə\" (yalnız aydın OCR kimi görünən qarışıqlığı düzəlt).\n"
+"6) \"complete\": sual mətni və bütün variantlar şəkildə tam görünürsə true; şəklin kənarında kəsilibsə, variantların bir hissəsi yoxdursa false.\n"
+"6b) Variant yalnız rəsmdən/fiqurdan ibarətdirsə (mətn yoxdursa): options[k]=\"\" yaz və \"option_boxes[k]\" = [ymin,xmin,ymax,xmax] (0-1000) yalnız həmin rəsmi əhatə etsin, \"A)\" hərfini daxil etmə. Mətn variantı üçün option_boxes[k]=null. option_boxes uzunluğu options ilə eyni olsun.\n"
+"6a) Variantlar bir sətirdə yazılıbsa (\"A) 99 B) 310 C) 215\") onları ayrı-ayrı variantlara böl.\n"
+"7) Cədvəl, qrafik, elektron cədvəl fraqmenti, diaqram, düstur şəkli və s. MƏTNƏ ÇEVRİLMƏZ: onu yalnız \"figure\" ilə göstər, sualın cümlələri isə \"text\"-də qalsın. figure yalnız həmin cədvəl/şəkli əhatə etsin (sual mətnini və variantları daxil etmə). Sualın mətnlə yazıla bilməyən hissəsi varsa, yazıla bilməyən hissəsi varsa (şəkil, qrafik, cədvəl fraqmenti, diaqram, düstur şəkli), \"figure\" = [ymin,xmin,ymax,xmax] (0-1000 normallaşmış) sualın bütün rəsm/şəkil/cədvəl hissəsini TAM əhatə etsin (bütün sətirlər və \"?\" işarəsi daxil; sual nömrəsi, mətn cümlələri və variantlar xaric); yoxdursa null. Mətn və variantları figure-ə daxil etmə.\n"
+"8) \"box\" = sualın (mətn+variantlar) tam sahəsi [ymin,xmin,ymax,xmax] (0-1000).\n"
+"9) Düzgün cavab işarələnibsə (məs. rənglənmiş/çərçivəli) \"answer\" = hərf; yoxsa null.\n"
+"10) Sual nömrəsi \"Sual 1.\", \"1.\", \"1)\", \"№1\" şəklində ola bilər. Mətnin ilk rəqəmini nömrə ilə qarışdırma: \"1.18 üzvdən ibarət...\" sualında n=1, text isə \"18 üzvdən ibarət...\" ilə başlayır.\n"
+"11) Variant hərfləri a) b) c) d) və ya A) B) C) formatında ola bilər, sayı 3-6 arası dəyişir: şəkildə neçə variant varsa o qədər qaytar, boş əlavə variant yazma. Hərf prefiksi (a), B), D) və s.) və \"A)Mətn\" kimi bitişik yazılış olsa belə çıxarılsın.\n"
+"12) Sual deyil: brauzer/tətbiq paneli, sənəd adı, səhifə və zoom düymələri, versiya və tarix damğası, böyük solğun watermark/loqo yazısı, səhifə başlığı (fənn və ya imtahan adı), sütunlar arasındakı xətt.\n"
+"13) \"subject\": sualın fənni, yalnız bunlardan biri: \"Azərbaycan dili\", \"Qanunvericilik\" (hüquq, qanun, Konstitusiya, kargüzarlıq, normativ aktlar), \"İnformatika\" (kompüter, Word/Excel/PowerPoint), \"Məntiq\" (məntiqi və riyazi tapşırıqlar, fiqurlar, ardıcıllıqlar), və ya \"\" əgər bilmirsənsə.\n"
+"Cavabı yalnız JSON massivi kimi qaytar: [{\"n\":56,\"text\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\",\"...\"],\"complete\":true,\"figure\":null,\"box\":[0,0,0,0],\"option_boxes\":[null,null,null,null,null],\"subject\":\"\",\"answer\":null}]. Sual yoxdursa [] qaytar.";
function cvJpeg(cv,max){var w=cv.width,h=cv.height,sc=Math.min(max/Math.max(w,h),Math.max(1,Math.min(2,1600/w))),c=document.createElement("canvas");c.width=Math.round(w*sc);c.height=Math.round(h*sc);
 var x=c.getContext("2d");x.imageSmoothingQuality="high";x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0,c.width,c.height);return c.toDataURL("image/jpeg",.92).split(",")[1]}
function subCv(cv,y,h){var c=document.createElement("canvas");c.width=cv.width;c.height=h;c.getContext("2d").drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);return c}
function tilesOf(cv){var W=cv.width,H=cv.height,th=Math.round(W*1.4);if(H<=th*1.25)return[cv];
 var step=Math.round(th*.8),n=Math.ceil((H-th)/step)+1,o=[];for(var i=0;i<n;i++)o.push(subCv(cv,Math.min(i*step,H-th),th));return o}
async function aiCall(b64,extra){var key=aiKey(),pm="";try{pm=localStorage.getItem("spro_model")||localStorage.getItem("ysl2_model")||""}catch(e){}
 var ms=[pm||"gemini-2.5-flash","gemini-2.5-flash"].filter(function(x,i,a){return a.indexOf(x)===i}),err="";
 for(var mi=0;mi<ms.length;mi++){for(var t=0;t<4;t++){
  var gc={responseMimeType:"application/json",temperature:0.1,maxOutputTokens:32000};if(/flash/.test(ms[mi]))gc.thinkingConfig={thinkingBudget:0};
  var res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+ms[mi]+":generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({contents:[{parts:[{text:AIP+(extra||"")},{inline_data:{mime_type:"image/jpeg",data:b64}}]}],generationConfig:gc})});
  var j=await res.json().catch(function(){return{}});
  if(res.ok){var c=j.candidates&&j.candidates[0],tx=c&&c.content&&c.content.parts?c.content.parts.map(function(p){return p.text||""}).join(""):"";if(!tx)throw new Error("AI boş cavab verdi.");return tx}
  err=(j.error&&j.error.message)||("HTTP "+res.status);
  if(res.status===404||(res.status===400&&/model/i.test(err)))break;
  if([429,500,503].indexOf(res.status)>-1){await sleep(1500*(t+1)*(t+1));continue}
  throw new Error(err)}}
 throw new Error(err||"AI cavab vermədi.")}
function aiParse(tx){tx=String(tx).replace(/```json|```/g,"").trim();var a=tx.indexOf("[");if(a<0)return[];var q=tx.slice(a),b=q.lastIndexOf("]");
 try{if(b>0)return JSON.parse(q.slice(0,b+1))}catch(e){}
 for(var k=q.lastIndexOf("}"),n=0;k>0&&n<80;k=q.lastIndexOf("}",k-1),n++){try{var r=JSON.parse(q.slice(0,k+1)+"]");if(Array.isArray(r))return r}catch(y){}}return[]}
function nrect(cv,b,pad){if(!Array.isArray(b)||b.length<4)return null;var y0=+b[0],x0=+b[1],y1=+b[2],x1=+b[3];if(!(y1>y0&&x1>x0))return null;
 var W=cv.width,H=cv.height,px=Math.round(W*pad/1000),py=Math.round(H*pad/1000),
 x=Math.max(0,Math.round(x0*W/1000)-px),y=Math.max(0,Math.round(y0*H/1000)-py),r=Math.min(W,Math.round(x1*W/1000)+px),d=Math.min(H,Math.round(y1*H/1000)+py);
 return r-x>12&&d-y>12?{x:x,y:y,w:r-x,h:d-y}:null}
function clean1(s){return String(s==null?"":s).replace(/^\s*Sual\s*\d{1,3}\s*[.:)]\s*/i,"").replace(/^\s*\(?\d{1,3}\s*[.)]\s+(?=\S)/,"").replace(/[ \t]+\n/g,"\n").trim()}
async function runAI(fs,thr,src0){var na=0,skipped=[],G={},pgi=0,OPX=/^\(?[A-Ea-e]\s*\)\s*|^\(?[A-Ea-e]\s*[.:]\s+/;
 for(var fi=0;fi<fs.length;fi++){var f=fs[fi],src=src0||f.name.replace(/\.[^.]+$/,""),pg=await filePages(f),first=S.res.length,K={};
  for(var pi=0;pi<pg.length;pi++){var cv0=pg[pi],tl=tilesOf(cv0),cand=[];pgi++;
   for(var ti=0;ti<tl.length;ti++){msg("🤖 AI oxuyur: fayl "+(fi+1)+"/"+fs.length+" · səhifə "+(pi+1)+"/"+pg.length+(tl.length>1?" · hissə "+(ti+1)+"/"+tl.length:"")+"…");
    var arr=aiParse(await aiCall(cvJpeg(tl[ti],3000),tl.length>1?"\nDİQQƏT: bu şəkil səhifənin yalnız bir hissəsidir; yuxarı/aşağı kənarda kəsilmiş suallar complete:false olsun.":""));
    arr.forEach(function(x){if(x&&typeof x==="object")cand.push({x:x,cv:tl[ti]})})}
   var kk=cv0.qtx&&cv0.qtx.length?findKey(cv0.qtx):null;if(kk)Object.assign(K,kk.map);
   var seen={},bad={},nk_=function(x,n){var t=String(x.text||"").toLowerCase().replace(/[^a-z0-9əıöüçşğ]+/g,"").slice(0,48);return t||("n"+n)};
   cand.forEach(function(c){var x=c.x,n=parseInt(x.n,10)||0,opts=(Array.isArray(x.options)?x.options:[]).map(function(o){return clean1(o).replace(OPX,"")});
    var key=nk_(x,n);if(seen[key])return;
    if(x.complete===false||opts.length<2){bad[key]=n||String(x.text||"").slice(0,25);return}
    seen[key]=1;delete bad[key];
    var cv=c.cv,ob=Array.isArray(x.option_boxes)?x.option_boxes:[],orc=opts.map(function(_,k){var rr=nrect(cv,ob[k],8);return rr?tight(cv,rr,thr):null}),last=-1;
    opts.forEach(function(o,k){if(o||orc[k])last=k});var cnt=Math.min(8,Math.max(last+1,2));opts=opts.slice(0,cnt);orc=orc.slice(0,cnt);
    var oi=orc.map(function(r){return r?render(cv,r,thr,{}):""}),hasO=orc.some(function(z){return z});
    var fr=nrect(cv,x.figure,12),br=nrect(cv,x.box,10),img="",r=null;if(fr){r=tight(cv,fr,thr);img=render(cv,r,thr,{})}
    var ans=-1;if(typeof x.answer==="string"&&/^[A-Ea-e]$/.test(x.answer.trim()))ans=L.indexOf(x.answer.trim().toUpperCase());
    S.res.push({id:uid(),pg:pgi,cv:(fr||hasO)?cv:null,r:r,oi:oi,orc:orc,qr:br,qcv:cv,n:n,src:src,thr:thr,ok:1,correct:ans<opts.length?ans:-1,auto:0,text:clean1(x.text),opts:opts,img:img,ai:1,fx:{},subject:subjNorm(E("qp-subj")&&E("qp-subj").value)||subjNorm(x.subject)})});
   Object.keys(bad).forEach(function(k){skipped.push(bad[k])})}
  na+=applyKey(S.res.slice(first),K);Object.assign(G,K)}
 na+=applyKey(S.res,G);S.res.sort(function(a,b){return a.pg-b.pg});
 msg("✅ "+S.res.length+" sual mətni ilə çıxarıldı"+(na?" · 🔑 "+na+" sual avtomatik cavablandı":"")+(skipped.length?" · ⚠ yarımçıq olduğu üçün buraxıldı: "+skipped.join(", "):"")+". Sağda yoxlayıb düzəldin, sonra banka əlavə edin.")}
function qimgOf(q){var r=q.qr;if(!r||!q.qcv)return false;q.cv=q.qcv;q.r=Object.assign({},r);q.fx=q.fx||{};q.img=render(q.cv,q.r,q.thr,q.fx);return true}

/* ---------- İş axını: yüklə -> kəs ---------- */
async function run(){
 if(S.busy)return;var fs=S.files;if(!fs.length){msg("Əvvəlcə şəkil / PDF seçin.");return}
 S.busy=1;S.res=[];S.rs=0;var thr=+E("qp-clean").value,src0=E("qp-src").value.trim(),G={},na=0;
 try{if(E("qp-aim")&&E("qp-aim").value==="ai"&&aiKey()){try{await runAI(fs,thr,src0)}catch(e){msg("Xəta: "+e.message)}S.busy=0;drawRes();return}
  msg("OCR hazırlanır…");await needOCR();
  for(var fi=0;fi<fs.length;fi++){var f=fs[fi],src=src0||f.name.replace(/\.[^.]+$/,""),pg=await filePages(f),K={},first=S.res.length;
   for(var pi=0;pi<pg.length;pi++){msg("Fayl "+(fi+1)+"/"+fs.length+" · səhifə "+(pi+1)+"/"+pg.length+" oxunur…");
    var sg=await segment(pg[pi]);
    if(sg.key){pg[pi].qmask=sg.key.boxes;Object.assign(K,sg.key.map)}
    if(!sg.list.length&&!sg.key){var b=sg.bounds;sg.list=[{n:0,x:b[0],y:b[1],w:b[2],h:b[3]-b[1]}]}
    sg.list.forEach(function(q){S.res.push({id:uid(),cv:pg[pi],r:q,n:q.n,src:src,thr:thr,ok:1,correct:-1,auto:0,text:"",opts:["","","","",""],img:render(pg[pi],q,thr),fx:{}})})}
   na+=applyKey(S.res.slice(first),K);Object.assign(G,K)}
  na+=applyKey(S.res,G);var nk=Object.keys(G).length;
  msg("✅ "+S.res.length+" sual tapıldı"+(nk?" · 🔑 cavab açarı tapıldı ("+nk+" cavab), "+na+" sual avtomatik işarələndi.":" · cavab açarı tapılmadı (aşağıdan əl ilə yapışdıra bilərsiniz).")+" Yoxlayın, sonra banka əlavə edin.")
 }catch(e){msg("Xəta: "+e.message)}
 S.busy=0;drawRes()}
function cur(){return S.items.filter(function(x){return x.id===S.cur})[0]}
function obj(t){return t.dataset.c==="r"?S.res[+t.dataset.i]:cur()}
function redraw(t){t.dataset.c==="r"?drawRes():drawPrev()}
function warn(q,c,i){return'<span id="qpw-'+c+i+'" class="qp-no" style="'+(q.correct<0?"":"display:none")+'">⚠ Düzgün cavab seçilməyib</span>'}
function body(q,c,i,extra){var d='data-c="'+c+'" data-i="'+i+'"',h='<textarea '+d+' data-f="text" rows="'+Math.min(14,Math.max(4,String(q.text||'').split('\n').length+2))+'" placeholder="Sual mətni (istəyə görə, boş ola bilər)">'+esc(q.text)+'</textarea>'
 +'<div class="qp-im"><b>🖼 Sualın Əsas Şəkli:</b>'+(q.img?'<img src="'+q.img+'">':'<div class="qp-em" style="padding:10px">Şəkil yoxdur (yalnız mətn)</div>')+'<div class="qp-cf">';
 if(q.cv&&q.r)h+='<span class="qp-adj"><button '+d+' data-a="adj" data-e="t" data-d="-14" title="Yuxarı genişlət">⬆+</button><button '+d+' data-a="adj" data-e="t" data-d="14" title="Yuxarı daralt">⬆−</button><button '+d+' data-a="adj" data-e="b" data-d="14" title="Aşağı genişlət">⬇+</button><button '+d+' data-a="adj" data-e="b" data-d="-14" title="Aşağı daralt">⬇−</button></span>';
 if(q.qr&&q.qcv)h+='<button '+d+' data-a="qimg" class="qp-fb">✂️ Sualı şəkil kimi də götür</button>';if(q.img)h+='<button '+d+' data-a="rmimg" class="qp-fb">✕ Şəkli sil</button>';
h+='<label class="qp-fb">🔄 Şəkli dəyiş<input type="file" accept="image/*" '+d+' data-f="img" style="display:none"></label></div>'+fxH(q,d)+'</div>';
 q.opts.forEach(function(t,k){ensOi(q);h+='<div class="qp-op"><b>'+LL[k]+')</b>'+(q.oi[k]?'<img class="qp-oi" src="'+q.oi[k]+'"><button '+d+' data-a="oirm" data-o="'+k+'" class="qp-x" title="Variant şəklini sil">✕</button>':"")+'<input '+d+' data-f="opt" data-o="'+k+'" value="'+esc(t)+'" placeholder="Variant mətni (şəkildədirsə boş qala bilər)"><label class="qp-fb" style="margin:0" title="Variant şəkli əlavə et/dəyiş">🖼<input type="file" accept="image/*" '+d+' data-f="oimg" data-o="'+k+'" style="display:none"></label><label class="qp-rd"><input type="radio" name="qpc-'+c+i+'" '+d+' data-f="cor" data-o="'+k+'"'+(q.correct===k?" checked":"")+'> Düzgün</label><button '+d+' data-a="odel" data-o="'+k+'" class="qp-x"'+(q.opts.length<=2?" disabled":"")+'>🗑 Sil</button></div>'});
 return h+'<div class="qp-fl" style="margin-top:8px"><button class="qp-b gr" '+d+' data-a="oadd">+ Dinamik Variant Əlavə Et</button>'+(extra||"")+'</div>'}
function adjB(d){return'<span class="qp-adj"><button '+d+' data-a="adj" data-e="t" data-d="-14" title="Yuxarı genişlət">⬆+</button><button '+d+' data-a="adj" data-e="t" data-d="14" title="Yuxarı daralt">⬆−</button><button '+d+' data-a="adj" data-e="b" data-d="14" title="Aşağı genişlət">⬇+</button><button '+d+' data-a="adj" data-e="b" data-d="-14" title="Aşağı daralt">⬇−</button></span>'}
function cardH(q,i){var d='data-c="r" data-i="'+i+'"',sel='<select '+d+' data-f="cs"><option value="">—</option>'+q.opts.map(function(_,k){return'<option value="'+k+'"'+(q.correct===k?" selected":"")+'>'+LL[k]+'</option>'}).join("")+'</select>';
 return'<div class="qp-cd '+(q.correct<0?"nc":"ok")+(i===S.rs?" on":"")+'" data-a="pick" data-i="'+i+'">'+(q.ai?'<div class="qp-pt">'+esc((q.text||"").slice(0,170)||"(mətn yoxdur)")+'</div>'+(q.img?'<img style="height:70px" src="'+q.img+'">':"")+'<div class="qp-ov">'+q.opts.filter(function(o,k){return o||(q.oi&&q.oi[k])}).length+" variant</div>":'<img src="'+q.img+'">')+'<div class="qp-cb"><label>№<input type="number" class="qp-nn" '+d+' data-f="n" value="'+q.n+'"></label><label>Cavab'+sel+'</label>'+(q.auto?'<span title="Cavab açarından avtomatik">🔑</span>':"")+'</div><div class="qp-cf">'+(q.cv&&q.r?adjB(d):"")+'<button '+d+' data-a="rm" class="qp-x">✕</button></div></div>'}
function edH(){var i=S.rs,q=S.res[i];if(!q)return'<div class="qp-em">Soldan sual seçin.</div>';var d='data-c="r" data-i="'+i+'"';
 return'<div class="qp-qh"><span><b>👁 Ön baxış</b> · Sual <input type="number" class="qp-nn" '+d+' data-f="n" value="'+q.n+'"> <small>('+(i+1)+"/"+S.res.length+")</small></span>"+warn(q,"r",i)+"</div>"
 +'<div class="qp-fl" style="margin:0 0 6px"><button class="qp-b gr" data-a="nav" data-d="-1">◀ Əvvəlki</button><button class="qp-b gr" data-a="nav" data-d="1">Sonrakı ▶</button><button class="qp-b no qp-mx" data-a="eclose">✕ Bağla</button></div>'
 +'<div class="qp-fl" style="margin:0 0 6px"><label>Fənn '+subjSel(q.subject||"",d+' data-f="subj"')+'</label></div><details class="qp-kd" open><summary>👁 Tələbə görünüşü</summary><div id="qp-svw">'+stuV(q)+'</div></details>'+body(q,"r",i,'<button class="qp-b ok" '+d+' data-a="addone">📥 Banka əlavə et</button><button class="qp-b no" '+d+' data-a="rm">🗑 Sualı sil</button>')}
function drawRes(){var box=E("qp-res"),ol=box.querySelector(".qp-cl"),oe=E("qp-edit"),t1=ol?ol.scrollTop:0,t2=oe?oe.scrollTop:0,op=!!(oe&&oe.classList.contains("open"));
 if(!S.res.length){box.innerHTML="";return}
 if(S.rs>=S.res.length)S.rs=S.res.length-1;if(S.rs<0)S.rs=0;
 var nc=S.res.filter(function(q){return q.correct<0}).length;
 box.innerHTML='<div class="qp-split"><div class="qp-lc"><div class="qp-ph">✂️ '+S.res.length+" sual kəsildi · "+(nc?'<span class="qp-no">cavabsız: '+nc+"</span>":"✅ hamısında cavab var")+'</div><div class="qp-cl">'+S.res.map(cardH).join("")+'</div><div class="qp-ft"><button class="qp-b gr" data-a="cancel">Ləğv et</button><button class="qp-b" data-a="addall">Hamısını banka əlavə et</button></div></div><div id="qp-edit" class="qp-edit'+(op?" open":"")+'">'+edH()+"</div></div>";
 ol=box.querySelector(".qp-cl");oe=E("qp-edit");if(ol)ol.scrollTop=t1;if(oe)oe.scrollTop=t2}
function adj(i,e,d){S.rs=i;var q=S.res[i],r=q.r;d=+d;
 if(e==="t"){r.y+=d;r.h-=d}else{r.h+=d}
 if(r.y<0){r.h+=r.y;r.y=0}if(r.y+r.h>q.cv.height)r.h=q.cv.height-r.y;if(r.h<20)r.h=20;
 q.img=render(q.cv,r,q.thr,q.fx);drawRes()}
async function mkU(q){var o=mk(q);try{if(o.img)o.img=await toUrl(o.img);for(var i=0;i<o.oi.length;i++)if(o.oi[i])o.oi[i]=await toUrl(o.oi[i])}catch(e){}return o}
function mk(q){return{id:uid(),src:q.src,num:q.n||0,tag:E("qp-tag").value,correct:q.correct,img:q.img,text:q.text||"",opts:q.opts.slice(),oi:(q.oi||[]).slice(),subject:q.subject||(E("qp-subj")?E("qp-subj").value:""),used:[],created:new Date().toISOString()}}
async function addOne(i){S.rls=0;try{await ST.put(await mkU(S.res[i]));S.res.splice(i,1);if(i<S.rs)S.rs--;drawRes();msg("✅ Banka əlavə olundu."+(S.rls?" (Supabase yazma icazəsi yoxdur — bu cihazda saxlandı, SQL-i işlədin)":""))}catch(e){msg("Xəta: "+e.message)}}
async function addAll(){var n=0,nc=S.res.filter(function(q){return q.correct<0}).length;S.rls=0;
 if(nc&&!confirm(nc+" sualda düzgün cavab seçilməyib. Yenə də banka əlavə edilsin?"))return;msg("Banka yazılır…");
 try{for(var i=0;i<S.res.length;i++){await ST.put(await mkU(S.res[i]));n++}
  S.res=[];drawRes();msg("✅ "+n+" sual banka əlavə olundu."+(S.rls?" (Supabase yazma icazəsi yoxdur — bu cihazda saxlandı, SQL-i işlədin)":""));await load();tab(2)}
 catch(e){msg("Xəta: "+e.message)}}
/* ---------- Mövcud sınaq suallarını banka idxal ---------- */
function hsh(x){var h=5381;for(var i=0;i<x.length;i++)h=((h<<5)+h+x.charCodeAt(i))|0;return h}
function sig(t,im){t=String(t||"").trim().slice(0,200);im=String(im||"");if(!t&&!im)return null;return t+"|"+(im?im.length+":"+hsh(im):"")}
async function importExams(){if(S.imp)return;
 if(!confirm("Sınaqlardakı (exam_questions) bütün suallar banka köçürülüb «istifadə olunub» kimi işarələnəcək. Bankda artıq eyni sual varsa təkrar yaradılmayacaq, yalnız sınaq qeydi əlavə olunacaq. Şəkillər hələ base64-dürsə trafik çox ola bilər (əvvəl Cloudflare köçürməsi tövsiyə olunur). Davam?"))return;
 S.imp=1;try{await load();var byId={},bySig={},from=0,B=40,add=0,mer=0;
  S.items.forEach(function(it){byId[it.id]=it;var g=sig(it.text,it.img);if(g)bySig[g]=it});
  while(true){var r=await _supabase.from("exam_questions").select("id,exam_id,category,q_number,subject,question,image_url,options,correct").order("id",{ascending:true}).range(from,from+B-1);
   if(r.error)throw r.error;var rows=r.data||[];if(!rows.length)break;
   for(var i=0;i<rows.length;i++){var w=rows[i],u={ex:String(w.exam_id),cat:w.category,n:w.q_number,t:new Date().toISOString().slice(0,10)},g=sig(w.question,w.image_url),it=byId["eq"+w.id]||(g&&bySig[g]);
    if(it){var us=usedOf(it).slice();if(us.some(function(z){return String(z.ex)===u.ex&&z.cat===u.cat&&z.n===u.n}))continue;us.push(u);it.used=us;if(!it.subject&&w.subject)it.subject=w.subject;await ST.put(it);mer++}
    else{var op=[],oi=[];(Array.isArray(w.options)?w.options:[]).forEach(function(o,k){if(o&&typeof o==="object"){op[k]=o.text||"";oi[k]=o.image||""}else{op[k]=String(o||"");oi[k]=""}if(op[k]===LL[k])op[k]=""});
     if(op.length<2){op=["","","","",""];oi=["","","","",""]}
     it={id:"eq"+w.id,src:"Sınaq "+w.exam_id,num:w.q_number,tag:w.category,subject:w.subject||"",correct:parseInt(w.correct)>=0?parseInt(w.correct):-1,img:w.image_url||"",text:w.question||"",opts:op,oi:oi,used:[u],created:new Date().toISOString()};
     await ST.put(it);byId[it.id]=it;if(g)bySig[g]=it;add++}}
   from+=B;msg("Köçürülür… yeni: "+add+" · mövcuda qeyd: "+mer,"qp-bmsg")}
  msg("✅ Bitdi. Yeni əlavə olunan: "+add+" · mövcud suala sınaq qeydi: "+mer,"qp-bmsg");await load()
 }catch(e){msg("Xəta: "+(e.message||e),"qp-bmsg")}S.imp=0}
/* ---------- Bank ---------- */
async function load(){try{S.items=await ST.all()}catch(e){msg("Bank oxunmadı: "+e.message,"qp-bmsg")}
 S.items.forEach(function(it){it.text=it.text||"";if(!it.opts||!it.opts.length)it.opts=["","","","",""];it.oi=[];it.opts=it.opts.map(function(o,k){if(o&&typeof o==="object"){it.oi[k]=o.image||"";return o.text||""}var m=/^\u0001IMG:([^\u0001]*)\u0001([\s\S]*)$/.exec(String(o||""));if(m){it.oi[k]=m[1];return m[2]}it.oi[k]="";return String(o||"")})});S.items.sort(function(a,b){return(a.src||"").localeCompare(b.src||"")||(a.num||0)-(b.num||0)});drawBank()}
function filtered(){var q=(E("qp-f").value||"").toLowerCase().trim(),t=E("qp-ft").value,su=E("qp-fs").value,us=E("qp-fu").value,ex=(E("qp-fx").value||"").trim(),tx=(E("qp-ex").value||"").trim(),tc=cats_();
 return S.items.filter(function(it){if(t&&(t==="__none"?!!it.tag:it.tag!==t))return false;
  if(su&&(su==="__none"?!!it.subject:(it.subject||"")!==su))return false;
  var u=usedOf(it);if(us==="used"&&!u.length)return false;if(us==="unused"&&u.length)return false;
  if(us==="notin"&&tx&&u.some(function(z){return String(z.ex)===tx&&tc.indexOf(z.cat)>-1}))return false;
  if(ex&&!u.some(function(z){return String(z.ex)===ex}))return false;
  if(q&&((it.src||"")+" "+it.num+" "+(it.text||"")+" "+(it.opts||[]).join(" ")).toLowerCase().indexOf(q)<0)return false;return true})}
function selected(){return S.items.filter(function(it){return S.sel[it.id]})}
function selUI(){var a=filtered(),n=selected().length,vis=a.filter(function(it){return S.sel[it.id]}).length,c=E("qp-all");
 E("qp-cnt").textContent=a.length+" sual göstərilir · seçilib: "+n;if(c){c.checked=a.length>0&&vis===a.length;c.indeterminate=vis>0&&vis<a.length}
 Array.prototype.forEach.call(document.querySelectorAll("#qp-list .qp-row"),function(r){r.classList.toggle("sel",!!S.sel[r.getAttribute("data-id")])});summary();barUI()}
function drawBank(){if(!E("qp-list"))return;var a=filtered(),h="",NS="Fənni yoxdur";
 var subs=SUBJ.slice();S.items.forEach(function(it){if(it.subject&&subs.indexOf(it.subject)<0)subs.push(it.subject)});
 var fs=E("qp-fs"),cv0=fs.value;fs.innerHTML='<option value="">Hamısı</option>'+subs.map(function(x){return"<option>"+esc(x)+"</option>"}).join("")+'<option value="__none">'+NS+'</option>';fs.value=cv0||"";
 /* fənn × kateqoriya cədvəli */
 var T=["BB","BA","AC","__none"],cur_s=fs.value,cur_t=E("qp-ft").value,rows=subs.concat(["__none"]),mx='<table class="qb-t"><thead><tr><th>Fənn</th><th>BB</th><th>BA</th><th>AC</th><th>Kateq. yox</th><th>Cəmi</th></tr></thead><tbody>',tot={};
 function cell(sv,tv,cl){var g=S.items.filter(function(it){return(sv===""||(sv==="__none"?!it.subject:it.subject===sv))&&(tv===""||(tv==="__none"?!it.tag:it.tag===tv))});if(!g.length)return'<td class="z">—</td>';
  var un=g.filter(function(it){return!usedOf(it).length}).length;return'<td><button class="qb-cell'+((cur_s===sv&&cur_t===tv)?" on":"")+'" data-a="mx" data-s="'+esc(sv)+'" data-t="'+tv+'">'+g.length+'<small> ⏳'+un+'</small></button></td>'}
 rows.forEach(function(sv){if(sv==="__none"&&!S.items.some(function(it){return!it.subject}))return;
  mx+='<tr><th><button class="qb-cell nm'+((cur_s===sv&&!cur_t)?" on":"")+'" data-a="mx" data-s="'+esc(sv)+'" data-t="">'+(sv==="__none"?NS:esc(sv))+'</button></th>'+T.map(function(tv){return cell(sv,tv)}).join("")+cell(sv,"")+'</tr>'});
 mx+='<tr class="tt"><th>Cəmi</th>'+T.map(function(tv){return cell("",tv)}).join("")+cell("","")+'</tr></tbody></table><div class="qb-lg">Rəqəm = bazadakı sual sayı · ⏳ = heç bir sınaqda istifadə olunmayıb · xanaya basıb süzün</div>';
 E("qp-mx").innerHTML=mx;
 a.forEach(function(it){h+='<div class="qp-row'+(S.cur===it.id?" cur":"")+(S.sel[it.id]?" sel":"")+'" data-id="'+it.id+'"><label class="qb-ck"><input type="checkbox" data-a="sel" data-id="'+it.id+'"'+(S.sel[it.id]?" checked":"")+'></label>'+(it.img?'<img src="'+it.img+'" loading="lazy">':'<div class="qp-ni">Aa</div>')+'<div class="qp-rm"><b>№'+(it.num||"?")+'</b> '+(it.tag?'<span class="qp-tg">'+esc(it.tag)+'</span>':"")+(it.subject?' <span class="qp-sj">'+esc(it.subject)+'</span>':"")+(it.correct>-1?' <span class="qp-ok">✓'+L[it.correct]+'</span>':' <span class="qp-no">cavab yox</span>')+'<br>'+usedTxt(it)+'<br><small>'+esc(it.src)+'</small>'+(it.text?'<br><small class="qp-sn">'+esc(it.text.slice(0,90))+'</small>':'')+'</div></div>'});
 E("qp-list").innerHTML=h||'<div class="qp-em">Bank boşdur və ya filtrə uyğun sual yoxdur.</div>';
 var exs={};S.items.forEach(function(it){usedOf(it).forEach(function(z){exs[z.ex]=1})});E("qp-exl").innerHTML=Object.keys(exs).sort(function(x,y){return x-y}).map(function(x){return'<option value="'+esc(x)+'">'}).join("");
 E("qp-mode").innerHTML=S.mode==="sb"?"☁️ Bank: Supabase (hər cihazdan)"+(S.nloc?' · ⚠ '+S.nloc+' sual yalnız bu cihazdadır <button class="qp-b gr" data-a="sync" style="padding:4px 10px">☁️ Supabase-ə göndər</button>':""):"💾 Bank: yalnız bu cihazda (question_bank cədvəli yoxdur)";
 E("qp-metan").innerHTML=(S.mode==="sb"&&!S.meta)?'⚠ «Fənn» və «istifadə olunub» qeydləri hələ yalnız bu cihazda saxlanır. Hər cihazdan görünməsi üçün Supabase SQL Editor-da bir dəfə işlədin: <button class="qp-b gr" data-a="sqlcopy" style="padding:4px 10px">📋 SQL-i kopyala</button>':"";
 drawPrev();selUI()}
function drawPrev(){var it=cur(),p=E("qp-prev");if(!p)return;
 if(!it){p.innerHTML='<div class="qp-em">Önbaxış üçün soldan sual seçin.</div>';return}
 p.innerHTML='<div class="qp-qh"><b>👁 Ön baxış</b>'+warn(it,"b",0)+'</div><div style="margin:0 0 8px">'+usedTxt(it)+(usedOf(it).length?' <button class="qp-b gr" data-a="uclr" style="padding:3px 8px;font-size:11px">↺ qeydi təmizlə</button>':"")+'</div><div class="qp-pf"><label>№ <input id="qp-pn" type="number" value="'+(it.num||0)+'"></label>'
  +'<label>Mənbə <input id="qp-ps" value="'+esc(it.src)+'"></label>'
  +'<label>Kateqoriya <select id="qp-pt">'+["","BA","BB","AC"].map(function(t){return'<option'+(it.tag===t?" selected":"")+' value="'+t+'">'+(t||"—")+'</option>'}).join("")+'</select></label><label>Fənn '+subjSel(it.subject||"",'id="qp-psu"')+'</label></div>'
  +body(it,"b",0,'<button class="qp-b ok" data-a="psave">💾 Yadda saxla</button><button class="qp-b no" data-a="pdel">🗑 Sualı sil</button>')}
var RNG={"Azərbaycan dili":[1,15],"Qanunvericilik":[16,55],"İnformatika":[56,70],"Məntiq":[71,100]};
function cats_(){return Array.prototype.map.call(document.querySelectorAll(".qp-cat:checked"),function(c){return c.value})}
function rngTxt(a){a=a.slice().sort(function(x,y){return x-y});var o=[],i=0;while(i<a.length){var j=i;while(j+1<a.length&&a[j+1]===a[j]+1)j++;o.push(j>i?a[i]+"–"+a[j]:""+a[i]);i=j+1}return o.join(", ")}
async function occFor(ex,cat,force){S.occ=S.occ||{};S.added=S.added||{};var k=ex+"|"+cat;if(!force&&S.occ[k])return S.occ[k];var set={},from=0;
 while(true){var r=await _supabase.from("exam_questions").select("q_number").in("exam_id",[ex]).in("category",[cat]).range(from,from+999);if(r.error)throw r.error;var d=r.data||[];d.forEach(function(x){set[x.q_number]=1});if(d.length<1000)break;from+=1000}
 (S.added[k]||[]).forEach(function(n){set[n]=1});return S.occ[k]=set}
async function summary(){var el=E("qp-sum");if(!el)return;var tok=S.sumTok=(S.sumTok||0)+1,sel=selected(),ex=(E("qp-ex").value||"").trim(),cats=cats_(),mode=E("qp-pm").value;S.plan=null;
 var bs={};sel.forEach(function(it){var k=it.subject||"Fənni yoxdur";bs[k]=(bs[k]||0)+1});
 var head='<b>'+sel.length+' sual seçilib</b>'+(sel.length?' · '+Object.keys(bs).map(function(k){return esc(k)+' <b>'+bs[k]+'</b>'}).join(' · '):"");
 if(!sel.length){el.innerHTML=head+'<div class="qb-hint">Baza siyahısında sualların solundakı □ ilə seçin.</div>';return}
 if(!ex||!cats.length){el.innerHTML=head+'<div class="qb-hint">Sınaq № və kateqoriyanı seçin.</div>';return}
 el.innerHTML=head+'<div class="qb-hint">⏳ Sınaqdakı boş nömrələr yoxlanılır…</div>';
 try{var plan=[],tb='',skip=0,repl=0,over=0,noans=sel.filter(function(it){return it.correct<0}).length;
  for(var ci=0;ci<cats.length;ci++){var cat=cats[ci],occ=Object.assign({},await occFor(ex,cat)),by={};
   if(mode==="auto"){sel.forEach(function(it){var r=RNG[it.subject];if(!r){skip++;return}var n=r[0];while(n<=r[1]&&occ[n])n++;if(n>r[1]){over++;(by[it.subject]=by[it.subject]||{p:[],o:0}).o++;return}occ[n]=1;plan.push({it:it,cat:cat,n:n});(by[it.subject]=by[it.subject]||{p:[],o:0}).p.push(n)})}
   else{var n0=parseInt(E("qp-st").value,10)||1,n1=n0;sel.forEach(function(it){if(n1>100){over++;return}if(occ[n1])repl++;plan.push({it:it,cat:cat,n:n1});(by[it.subject||"Fənni yoxdur"]=by[it.subject||"Fənni yoxdur"]||{p:[],o:0}).p.push(n1);n1++})}
   Object.keys(by).forEach(function(k){var r=RNG[k],free=r?(function(){var c=0;for(var z=r[0];z<=r[1];z++)if(!occ[z])c++;return c})():null;
    tb+='<tr><td>'+cat+'</td><td>'+esc(k)+'</td><td><b>'+by[k].p.length+'</b></td><td>'+(by[k].p.length?'№'+rngTxt(by[k].p):"—")+'</td><td>'+(by[k].o?'<span class="qp-no">⚠ '+by[k].o+' sual üçün yer yoxdur</span>':(free!=null&&mode==="auto"?'boş qalır: '+free:""))+'</td></tr>'})}
  if(tok!==S.sumTok)return;S.plan=plan;S.pw={repl:repl,noans:noans,skip:skip,over:over};
  el.innerHTML=head+'<table class="qb-t qb-pl"><thead><tr><th>Kat.</th><th>Fənn</th><th>Sual</th><th>Nömrələr</th><th></th></tr></thead><tbody>'+tb+'</tbody></table>'
   +(skip?'<div class="qp-no">⚠ '+skip+' sualın fənni yoxdur — yerləşdirilməyəcək. Yuxarıdakı «Seçilənlərə: fənn» ilə təyin edin.</div>':"")
   +(repl?'<div class="qp-no">⚠ '+repl+' mövcud sual əvəz olunacaq.</div>':"")+(noans?'<div class="qp-no">⚠ '+noans+' sualda düzgün cavab seçilməyib (A kimi yazılacaq).</div>':"")
 }catch(e){if(tok===S.sumTok)el.innerHTML=head+'<div class="qp-no">Boş nömrələr oxunmadı: '+esc(e.message||e)+'</div>'}}
async function prepIt(it){var o={img:it.img?await toUrl(it.img):null,oi:[]},oj=it.oi||[];for(var z=0;z<oj.length;z++)o.oi[z]=oj[z]?await toUrl(oj[z]):"";return o}
async function assign(){await summary();var plan=S.plan,pw=S.pw||{},ex=(E("qp-ex").value||"").trim(),cats=cats_();
 if(!plan||!plan.length){msg("Əlavə ediləcək sual yoxdur (seçim, sınaq, kateqoriya və ya fənnləri yoxlayın).","qp-amsg");return}
 if(!confirm("Sınaq "+ex+" · "+cats.join(", ")+"\n"+plan.length+" sual əlavə olunacaq."+(pw.repl?"\n⚠ "+pw.repl+" mövcud sual ƏVƏZ OLUNACAQ.":"")+(pw.noans?"\n⚠ "+pw.noans+" sualda düzgün cavab seçilməyib (A kimi yazılacaq).":"")+((pw.skip||pw.over)?"\n⚠ "+((pw.skip||0)+(pw.over||0))+" sual yerləşdirilməyəcək.":"")+"\n\nDavam?"))return;
 var cache={},done=[],err=null;S.added=S.added||{};S.occ=S.occ||{};
 try{for(var i=0;i<plan.length;i++){var e=plan[i],it=e.it,cc=cache[it.id]||(cache[it.id]=await prepIt(it)),n=e.n;msg("Yazılır "+(i+1)+"/"+plan.length+" · "+e.cat+" №"+n+"…","qp-amsg");
   var p={subject:window.getSubjectByNumber?getSubjectByNumber(n):"Ümumi",question:it.text||"",image_url:cc.img,options:(it.opts&&it.opts.length?it.opts:L).map(function(t,k){var im=cc.oi[k],tx=(t&&t.trim())||"";return im?{text:tx,image:im}:(tx||LL[k])}),correct:it.correct>-1?it.correct:0};
   var r=await _supabase.from("exam_questions").select("id").eq("exam_id",ex).eq("category",e.cat).eq("q_number",n).maybeSingle();
   var q=r.data?await _supabase.from("exam_questions").update(p).eq("id",r.data.id):await _supabase.from("exam_questions").insert([Object.assign({exam_id:ex,category:e.cat,q_number:n},p)]);
   if(q.error)throw q.error;done.push(e);var k2=ex+"|"+e.cat;(S.added[k2]=S.added[k2]||[]).push(n);if(S.occ[k2])S.occ[k2][n]=1}
 }catch(x){err=x}
 var ch={};done.forEach(function(e){var it=e.it,u=ch[it.id]?it.used:usedOf(it).slice();if(!u.some(function(z){return String(z.ex)===String(ex)&&z.cat===e.cat&&z.n===e.n}))u.push({ex:ex,cat:e.cat,n:e.n,t:new Date().toISOString().slice(0,10)});it.used=u;ch[it.id]=it});
 try{for(var id in ch)await ST.put(ch[id])}catch(x){}
 await load();
 msg(err?"⚠ "+done.length+" sual yazıldı, sonra xəta: "+(err.message||err):"✅ Tamamlandı: Sınaq "+ex+" · "+cats.join(", ")+" · "+done.length+" sual əlavə olundu.","qp-amsg")}

/* ---------- Cloudflare R2 ---------- */
function cfg(){try{return JSON.parse(localStorage.getItem("dq_r2")||"null")}catch(e){return null}}
async function toBlob(d,webp){if(!webp)return(await fetch(d)).blob();var im=await loadImg(d),c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);return new Promise(function(ok){c.toBlob(ok,"image/webp",.92)})}
var UC={};
async function toUrl(d){var c=cfg();if(!c||!c.u||!d||d.indexOf("data:")!==0)return d;
 var k=d.length+":"+d.slice(60,140)+d.slice(-80);if(UC[k])return UC[k];
 var b=await toBlob(d,c.w!==false),r=await fetch(c.u.replace(/\/$/,"")+"/upload",{method:"POST",headers:{"x-key":c.k,"content-type":b.type||"image/png"},body:b});
 if(!r.ok)throw new Error("Yükləmə xətası "+r.status);var j=await r.json();UC[k]=j.url;return j.url}
function csave(){localStorage.setItem("dq_r2",JSON.stringify({u:E("qp-cu").value.trim(),k:E("qp-ck").value.trim(),w:E("qp-cw").checked}));msg("✅ Yadda saxlandı.","qp-cmsg")}
async function ctest(){csave();try{var u=await toUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");var r=await fetch(u);msg(r.ok?"✅ Cloudflare işləyir: "+u:"Şəkil oxunmadı ("+r.status+")","qp-cmsg")}catch(e){msg("Xəta: "+e.message+" (URL/açar/Worker yoxlayın)","qp-cmsg")}}
async function cvOpt(o){var D=function(v){return typeof v==="string"&&v.indexOf("data:image")===0};
 if(D(o))return[await toUrl(o),1];if(o&&typeof o==="object"&&D(o.image))return[Object.assign({},o,{image:await toUrl(o.image)}),1];return[o,0]}
/* ---------- Edge keş: imtahan suallarını Cloudflare Worker-dən oxut (Supabase egress azalır) ----------
   Tələbə cihazlarında da işləməsi üçün Worker ünvanını bura yazın: var EDGE="https://dq-img.XXXX.workers.dev"; */
var EDGE="";
function edgeUrl(){return(EDGE||(cfg()||{}).u||"").replace(/\/$/,"")}
function edgeTry(b){var base=edgeUrl(),u=b.url;if(!base||!u||b.method!=="GET")return null;
 var h=b.headers,g=function(k){return h?String(h.get?h.get(k):(h[k]||h[k.toLowerCase()])||""):""};
 if(/pgrst\.object/.test(g("Accept"))||/count/.test(g("Prefer")))return null;
 var sp=u.searchParams;if(!/^eq\./.test(sp.get("exam_id")||"")||!/^eq\./.test(sp.get("category")||""))return null;
 return fetch(base+"/rest/exam_questions"+u.search).then(function(r){if(!r.ok)throw 0;return r.json()})
  .then(function(d){return Array.isArray(d)?{data:d,error:null,count:null,status:200,statusText:"OK"}:null}).catch(function(){return null})}
function edge(b){if(b.__e||typeof b.then!=="function")return;b.__e=1;var th=b.then;
 b.then=function(a,r){var p=null;try{p=edgeTry(b)}catch(e){}
  return(p?p.then(function(x){return x||th.call(b)}):th.call(b)).then(a,r)}}
/* yeni yazılan şəkillər avtomatik Cloudflare-ə getsin (Cloudflare qoşulubsa) */
async function offBody(body){var rows=Array.isArray(body)?body:[body];
 for(var i=0;i<rows.length;i++){var r=rows[i];if(!r||typeof r!=="object")continue;
  for(var j=0;j<2;j++){var k=j?"img":"image_url";if(typeof r[k]==="string"&&r[k].indexOf("data:image")===0)r[k]=await toUrl(r[k])}
  if(Array.isArray(r.options)){for(var m=0;m<r.options.length;m++)r.options[m]=(await cvOpt(r.options[m]))[0]}}}
function hook(){try{if(typeof _supabase==="undefined"||!_supabase||_supabase.__dqoff)return;var of=_supabase.from;
 _supabase.from=function(t){var q=of.apply(_supabase,arguments);if(t!=="exam_questions"&&t!=="question_bank")return q;
  if(t==="exam_questions"){var fs=q.select;if(typeof fs==="function")q.select=function(){var b=fs.apply(q,arguments);try{edge(b)}catch(e){}return b}}
  ["insert","update","upsert"].forEach(function(m){var f=q[m];if(typeof f!=="function")return;
   q[m]=function(){var b=f.apply(q,arguments);
    try{if(b&&typeof b.then==="function"&&"body" in b&&!b.__o){b.__o=1;var th=b.then;
     b.then=function(a,r){var c=cfg();if(!c||!c.u||!c.k)return th.call(b,a,r);return offBody(b.body).catch(function(){}).then(function(){return th.call(b,a,r)})}}}catch(e){}
    return b}});return q};_supabase.__dqoff=1}catch(e){}}
async function migrate(){var c=cfg();if(!c||!c.u||!c.k){msg("Əvvəl URL və açarı yadda saxlayın.","qp-cmsg");return}
 if(S.mig)return;if(!confirm("Supabase-dəki base64 şəkillər (sual + variant + bank) Cloudflare-ə köçürülüb bazada link ilə əvəz olunacaq. Davam?"))return;
 S.mig=1;var done=0,nb=0,B=4,seen={},seenB={};
 var ex=function(m){var k=Object.keys(m);return k.length?"("+k.join(",")+")":null};
 async function nextRows(){var q=_supabase.from("exam_questions").select("id,image_url,options").like("image_url","data:%"),e=ex(seen);if(e)q=q.not("id","in",e);
  var r=await q.limit(B);if(r.error)throw r.error;if((r.data||[]).length)return r.data;
  var cd=[];for(var i=0;i<8;i++){cd.push("options->>"+i+".like.data:*");cd.push("options->"+i+"->>image.like.data:*")}
  var q2=_supabase.from("exam_questions").select("id,image_url,options").or(cd.join(",")),e2=ex(seen);if(e2)q2=q2.not("id","in",e2);
  var r2=await q2.limit(B);return r2.error?[]:(r2.data||[])}
 try{while(S.mig){var rows=await nextRows();if(!rows.length)break;
   for(var i=0;i<rows.length&&S.mig;i++){var w=rows[i];seen[w.id]=1;
    try{var p={};if(w.image_url&&String(w.image_url).indexOf("data:")===0)p.image_url=await toUrl(w.image_url);
     if(Array.isArray(w.options)){var ch=0,no=[];for(var k=0;k<w.options.length;k++){var t=await cvOpt(w.options[k]);no.push(t[0]);if(t[1])ch=1}if(ch)p.options=no}
     if(!Object.keys(p).length)continue;
     var u=await _supabase.from("exam_questions").update(p).eq("id",w.id);if(u.error)throw u.error;done++;
     msg("Köçürüldü: "+done+" sual · xəta: "+nb,"qp-cmsg")}
    catch(e){nb++;msg("Xəta (id "+w.id+"): "+e.message,"qp-cmsg")}}}
  var bd=0;
  while(S.mig){var q3=_supabase.from("question_bank").select("id,img").like("img","data:%"),e3=ex(seenB);if(e3)q3=q3.not("id","in",e3);
   var r3=await q3.limit(B);if(r3.error||!(r3.data||[]).length)break;
   for(var j=0;j<r3.data.length&&S.mig;j++){var x=r3.data[j];seenB[x.id]=1;
    try{var up=await _supabase.from("question_bank").update({img:await toUrl(x.img)}).eq("id",x.id);if(up.error)throw up.error;bd++;msg("Bank köçürüldü: "+bd,"qp-cmsg")}catch(e){nb++}}}
  msg((S.mig?"✅ Bitdi. ":"⏹ Dayandırıldı. ")+"Köçürülən sual: "+done+" · bank: "+bd+" · xətalı: "+nb,"qp-cmsg")
 }catch(e){msg("Xəta: "+(e.message||e),"qp-cmsg")}
 S.mig=0}
/* ---------- UI ---------- */
function tab(n){if(n===2){S.tab=2;if(window.switchAdminTab)switchAdminTab("qbank");load();return}
 S.tab=n;E("qp-t1").style.display=n===1?"":"none";E("qp-t3").style.display=n===3?"":"none";E("qp-b1").classList.toggle("on",n===1);E("qp-b3").classList.toggle("on",n===3);
 if(n===3){var c=cfg()||{};E("qp-cu").value=c.u||"";E("qp-ck").value=c.k||"";E("qp-cw").checked=c.w!==false}}
var onInput;
var CSS="#mod-qpro .qp-tabs{display:flex;gap:8px;margin:10px 0}#mod-qpro .qp-tabs button{flex:1;padding:10px;border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;font-weight:700;cursor:pointer}#mod-qpro .qp-tabs button.on{background:#2563eb;color:#fff;border-color:#2563eb}"
+"#mod-qpro .qp-drop{border:2px dashed #10b981;background:#ecfdf5;border-radius:14px;padding:22px;text-align:center;cursor:pointer;font-weight:700}"
+"#mod-qpro .qp-fl{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:10px 0}#mod-qpro label{font-size:12px;font-weight:700;color:#475569;display:flex;flex-direction:column;gap:3px}"
+"#mod-qpro input,#mod-qpro select{padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;background:#fff;color:#0f172a;min-width:0}"
+"#mod-qpro .qp-b{padding:10px 16px;border:0;border-radius:10px;font-weight:800;cursor:pointer;background:#2563eb;color:#fff}#mod-qpro .qp-b.ok{background:#16a34a}#mod-qpro .qp-b.no{background:#dc2626}#mod-qpro .qp-b.gr{background:#64748b}"
+"#mod-qpro .qp-res{display:block;margin-top:12px}#mod-qpro .qp-card{border:1.5px solid #e2e8f0;border-radius:12px;padding:8px;background:#fff}#mod-qpro .qp-card img{width:100%;max-height:260px;object-fit:contain;display:block;border-radius:6px;background:#fff}"
+"#mod-qpro .qp-cf{display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-top:6px}#mod-qpro .qp-cf input{width:64px}#mod-qpro .qp-adj button,#mod-qpro .qp-x{padding:5px 7px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;cursor:pointer;font-size:12px}#mod-qpro .qp-x{margin-left:auto;color:#dc2626}"
+"#mod-qpro .qp-bank{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start}@media(max-width:820px){#mod-qpro .qp-bank{grid-template-columns:1fr}}"
+"#mod-qpro .qp-list{max-height:560px;overflow:auto;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff}#mod-qpro .qp-row{display:flex;gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid #eef2f7;cursor:pointer}#mod-qpro .qp-row.cur{background:#eff6ff}#mod-qpro .qp-row img{width:96px;height:56px;object-fit:cover;object-position:top left;border:1px solid #e2e8f0;border-radius:6px;background:#fff}"
+"#mod-qpro .qp-rm{font-size:13px;line-height:1.35}#mod-qpro .qp-tg{background:#e0e7ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800}#mod-qpro .qp-ok{color:#16a34a;font-weight:800}#mod-qpro .qp-no{color:#dc2626;font-weight:700;font-size:12px}"
+"#mod-qpro .qp-prev{position:sticky;top:8px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;padding:10px}#mod-qpro .qp-big{width:100%;max-height:480px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;background:#fff}#mod-qpro .qp-pf{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}#mod-qpro .qp-pb{display:flex;gap:8px;margin-top:8px}"
+"#mod-qpro .qp-as{margin-top:14px;border:1.5px solid #c7d2fe;background:#eef2ff;border-radius:12px;padding:12px}#mod-qpro .qp-em{padding:22px;text-align:center;color:#64748b}#mod-qpro .qp-pv{border:1.5px solid #fca5a5;border-radius:12px;background:#fff;margin-top:12px;overflow:hidden}#mod-qpro .qp-ph{padding:10px 14px;font-weight:800;border-bottom:1px solid #e2e8f0}#mod-qpro .qp-pvl{max-height:78vh;overflow:auto;padding:10px;background:#f8fafc}"
+"#mod-qpro .qp-qc{border:1.5px solid #fca5a5;border-radius:12px;background:#fff;padding:12px;margin-bottom:12px}#mod-qpro .qp-qh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-weight:700}#mod-qpro .qp-nn{width:70px}"
+"#mod-qpro textarea{width:100%;box-sizing:border-box;padding:9px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;background:#f1f5f9;color:#0f172a;resize:vertical}"
+"#mod-qpro .qp-im{margin:8px 0;padding:8px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}#mod-qpro .qp-im img{width:100%;max-height:300px;object-fit:contain;display:block;margin:6px 0;background:#fff;border-radius:6px}"
+"#mod-qpro .qp-op{display:flex;gap:6px;align-items:center;margin:6px 0;background:#f1f5f9;border-radius:10px;padding:6px 8px}#mod-qpro .qp-op input[type=text],#mod-qpro .qp-op input:not([type]){flex:1;min-width:0}#mod-qpro .qp-op b{width:22px}"
+"#mod-qpro .qp-rd{flex-direction:row;align-items:center;gap:4px;white-space:nowrap}#mod-qpro .qp-fb{padding:5px 9px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;font-size:12px;cursor:pointer;margin-left:auto}"
+"#mod-qpro .qp-ft{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:10px;padding:10px;background:#fff;border-top:1px solid #e2e8f0}#mod-qpro .qp-x:disabled{opacity:.4}"
+"#mod-qpro .qp-split{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px;align-items:start}#mod-qpro .qp-lc{border:1.5px solid #cbd5e1;border-radius:12px;background:#fff;overflow:hidden}"
+"#mod-qpro .qp-cl{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:10px;max-height:78vh;overflow:auto;background:#f8fafc}"
+"#mod-qpro .qp-cd{border:2px solid #fca5a5;border-radius:12px;background:#fff;padding:6px;cursor:pointer}#mod-qpro .qp-cd.ok{border-color:#86efac}#mod-qpro .qp-cd.on{box-shadow:0 0 0 3px #2563eb}"
+"#mod-qpro .qp-cd img{width:100%;height:140px;object-fit:contain;object-position:top;background:#fff;border-radius:6px;display:block}#mod-qpro .qp-cb{display:flex;gap:6px;align-items:end;margin-top:6px}#mod-qpro .qp-cb .qp-nn{width:56px}#mod-qpro .qp-cb select{padding:6px 4px}"
+"#mod-qpro .qp-edit{position:sticky;top:8px;border:1.5px solid #fca5a5;border-radius:12px;background:#fff;max-height:92vh;overflow:auto;padding:12px}#mod-qpro .qp-mx{display:none}"
+"#mod-qpro .qp-kd{margin:8px 0;border:1px dashed #94a3b8;border-radius:10px;padding:8px;background:#f8fafc}#mod-qpro .qp-kd summary{cursor:pointer;font-weight:700;font-size:13px}#mod-qpro .qp-kd textarea{margin:6px 0}"
+"@media(max-width:900px){#mod-qpro .qp-split{grid-template-columns:1fr}#mod-qpro .qp-edit{display:none}#mod-qpro .qp-edit.open{display:block;position:fixed;inset:0;z-index:2147483000;max-height:none;border-radius:0;border:0}#mod-qpro .qp-mx{display:inline-block}#mod-qpro .qp-cl{grid-template-columns:repeat(2,minmax(0,1fr));max-height:none}}"
+"#mod-qpro .qp-pt{font-size:13px;line-height:1.35;max-height:78px;overflow:hidden;white-space:pre-line;color:#0f172a;margin-bottom:4px}#mod-qpro .qp-ov{font-size:11px;color:#64748b;font-weight:700}#mod-qpro .qp-ni{width:96px;height:56px;display:flex;align-items:center;justify-content:center;background:#eef2ff;color:#4338ca;font-weight:800;border-radius:6px;flex:none}#mod-qpro .qp-sn{color:#64748b}@media(min-width:901px){#mod-qpro .qp-split{grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr)}}#mod-qpro .qp-fx{margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1}#mod-qpro input[type=color]{width:46px;height:34px;padding:2px}#mod-qpro .qp-sv{border:1.5px solid #e2e8f0;border-radius:14px;background:#fff;padding:14px;margin-top:6px;box-shadow:0 2px 8px rgba(15,23,42,.06)}#mod-qpro .qp-svh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}#mod-qpro .qp-svh span{background:#0f172a;color:#fff;border-radius:8px;padding:3px 10px;font-weight:800}#mod-qpro .qp-svh small{color:#94a3b8}#mod-qpro .qp-svt{font-size:15px;line-height:1.5;white-space:pre-line;color:#0f172a;margin-bottom:10px}#mod-qpro .qp-svi{text-align:center;margin:8px 0 12px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}#mod-qpro .qp-svi img{max-width:100%;display:block;margin:auto}#mod-qpro .qp-svo{display:flex;gap:10px;align-items:center;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:6px 0;color:#0f172a}#mod-qpro .qp-svo i{width:26px;height:26px;border-radius:50%;background:#eef2ff;color:#3730a3;font-style:normal;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}#mod-qpro .qp-svo.ok{border-color:#16a34a;background:#f0fdf4}#mod-qpro .qp-svo.ok i{background:#16a34a;color:#fff}#mod-qpro .qp-oi{height:46px;max-width:90px;object-fit:contain;background:#fff;border:1px solid #e2e8f0;border-radius:6px;flex:none}#mod-qpro .qp-svoi{max-height:90px;max-width:160px;object-fit:contain}#mod-qpro .qp-cd .qp-pt+img{height:110px!important}#mod-qpro .qp-stats{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}#mod-qpro .qp-stats span,#mod-qpro .qp-stats button{padding:5px 11px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;font-size:12px;font-weight:700;color:#0f172a}#mod-qpro .qp-stats button{cursor:pointer}#mod-qpro .qp-us{color:#15803d;font-weight:700;font-size:12px}#mod-qpro .qp-nu{color:#b45309;font-weight:700;font-size:12px}#mod-qpro .qp-sj{background:#ecfeff;color:#0e7490;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:800}#mod-qpro .qb-mx{overflow:auto;margin:6px 0 10px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff}#mod-qpro .qb-t{border-collapse:collapse;width:100%;font-size:13px}#mod-qpro .qb-t th,#mod-qpro .qb-t td{padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:center;color:#0f172a}#mod-qpro .qb-t thead th{background:#f1f5f9;font-size:12px;color:#475569}#mod-qpro .qb-t tbody th{text-align:left;font-weight:700}#mod-qpro .qb-t td.z{color:#cbd5e1}#mod-qpro .qb-t tr.tt th,#mod-qpro .qb-t tr.tt td{background:#f8fafc;font-weight:800}#mod-qpro .qb-cell{border:1px solid transparent;background:transparent;border-radius:8px;padding:4px 9px;font-weight:800;cursor:pointer;color:#1d4ed8;font-size:13px}#mod-qpro .qb-cell.nm{color:#0f172a;text-align:left}#mod-qpro .qb-cell:hover{background:#eff6ff}#mod-qpro .qb-cell.on{background:#2563eb;color:#fff}#mod-qpro .qb-cell small{font-weight:600;opacity:.75}#mod-qpro .qb-lg{font-size:11px;color:#64748b;padding:4px 10px 8px}#mod-qpro .qb-tb{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc}#mod-qpro .qb-all{flex-direction:row;align-items:center;gap:6px;font-size:13px;color:#0f172a;cursor:pointer}#mod-qpro .qb-cnt{font-size:13px;font-weight:700;color:#334155}#mod-qpro .qb-bulk{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;font-weight:700;color:#475569}#mod-qpro .qb-ck{flex-direction:row;padding:6px;cursor:pointer}#mod-qpro .qb-ck input,#mod-qpro .qb-all input{width:20px;height:20px;accent-color:#2563eb;cursor:pointer}#mod-qpro .qp-row.sel{background:#eff6ff;box-shadow:inset 3px 0 0 #2563eb}#mod-qpro .qb-dock{position:sticky;bottom:0;z-index:5;margin-top:14px;border:1.5px solid #c7d2fe;background:#eef2ff;border-radius:12px;padding:12px;box-shadow:0 -4px 14px rgba(15,23,42,.1);max-height:60vh;overflow:auto}#mod-qpro .qb-dh{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;color:#0f172a}#mod-qpro .qb-cats{display:flex;gap:12px;flex-direction:row;font-weight:700;padding:6px 0}#mod-qpro .qb-cats label{flex-direction:row;align-items:center;gap:5px;font-size:14px;color:#0f172a}#mod-qpro .qb-cats input{width:18px;height:18px;accent-color:#2563eb}#mod-qpro .qb-sum{margin:8px 0;font-size:13px;color:#0f172a}#mod-qpro .qb-hint{color:#64748b;margin-top:4px}#mod-qpro .qb-pl{background:#fff;border-radius:8px;margin-top:6px}#mod-qpro .qp-pre{display:flex;gap:6px;flex-wrap:wrap}#mod-qpro .qp-pre button{padding:5px 9px;border:1px solid #a5b4fc;background:#fff;border-radius:8px;font-size:12px;cursor:pointer}";

function build(){
 if(!E("qp-css")){var s=document.createElement("style");s.id="qp-css";s.textContent=CSS.replace(/#mod-qpro /g,":is(#mod-qpro,#mod-qbank) ");document.head.appendChild(s)}
 if(!E("mod-qpro")){var a=E("mod-cropgen");if(!a)return false;var d=document.createElement("div");d.id="mod-qpro";d.className="admin-module-block";
  d.innerHTML='<h4>⚡ Smart Kəsmə & Sual Bankı PRO</h4><div class="qp-tabs"><button id="qp-b1" class="on" data-a="tab" data-n="1">① Yüklə & Avto-kəs</button><button id="qp-b2" data-a="tab" data-n="2">② 🗃 Sual bazası ↗</button><button id="qp-b3" data-a="tab" data-n="3">③ ☁️ Cloudflare</button></div>'
  +'<div id="qp-t1"><div class="qp-drop" id="qp-dz">📷 Şəkil / PDF seçin (bir neçə fayl ola bilər)<br><small>Ekran şəkilləri, foto və ya PDF — AI yalnız sualları və variantları mətn kimi çıxarır, sağda redaktə edə bilərsiniz</small><input id="qp-file" type="file" accept="image/*,application/pdf" multiple style="display:none"></div>'
  +'<div id="qp-fn" style="margin:6px 0;font-size:13px;color:#475569"></div>'
  +'<details class="qp-kd"><summary>🔑 Cavab açarı — PDF-in sonunda avtomatik tapılır; lazım olsa əl ilə yapışdırın</summary><textarea id="qp-keytxt" rows="3" placeholder="56 D  57 B  58 E …   və ya   56-D, 57-B, 58-E"></textarea><button class="qp-b gr" data-a="keyapply">Tətbiq et (kəsilmiş suallara)</button></details>'
  +''
  +'<div class="qp-fl"><label>Mənbə adı (boşdursa fayl adı)<input id="qp-src" placeholder="məs: 05.02.2026 DQ(BB)"></label><label>Kateqoriya<select id="qp-tag"><option value="">—</option><option>BA</option><option selected>BB</option><option>AC</option></select></label>'
  +'<label>Fənn<select id="qp-subj"><option value="">🤖 Avto (AI təyin etsin)</option>'+SUBJ.map(function(x){return"<option>"+x+"</option>"}).join("")+'</select></label><label>Rejim<select id="qp-aim"><option value="ai" selected>🤖 AI: sual + variant mətni</option><option value="cut">✂️ Yalnız şəkil kəsmə</option></select></label><label>Fon təmizləmə<select id="qp-clean"><option value="255">Yox</option><option value="215" selected>Yüngül (su nişanı)</option><option value="185">Güclü</option></select></label><button class="qp-b" data-a="run">⚡ Çıxar</button></div>'
  +'<div id="qp-msg" style="font-weight:700;color:#334155"></div><div id="qp-res" class="qp-res"></div>'
  +'</div>'
  +'<div id="qp-t3" style="display:none"><p style="font-size:13px;color:#475569">Şəkillər Cloudflare R2-də saxlanır, bazada yalnız link qalır — Supabase egress limiti aşılmır. Qoşulandan sonra yeni əlavə olunan şəkillər (sual, variant, bank) avtomatik buraya yüklənir; köhnələri "Köhnə şəkilləri köçür" ilə köçürün.</p><div class="qp-fl"><label style="flex:1">Worker URL<input id="qp-cu" placeholder="https://dq-img.xxx.workers.dev"></label><label>Yükləmə açarı<input id="qp-ck" type="password"></label><label style="flex-direction:row;align-items:center;gap:6px"><input id="qp-cw" type="checkbox" checked> WebP-yə sıx</label></div><div class="qp-fl"><button class="qp-b" data-a="csave">💾 Yadda saxla</button><button class="qp-b gr" data-a="ctest">🔌 Test</button><button class="qp-b ok" data-a="cmig">🚚 Köhnə şəkilləri köçür</button><button class="qp-b no" data-a="cstop">⏹ Dayandır</button></div><div id="qp-cmsg" style="font-weight:700"></div></div>';
  a.parentNode.insertBefore(d,a);
  d.addEventListener("click",onClick);d.addEventListener("change",onChange);d.addEventListener("input",onInput=function(e){var t=e.target,f=t.dataset&&t.dataset.f;if(/^qp-(ex|st)$/.test(t.id)){if(t.id==="qp-ex"&&E("qp-fu").value==="notin")drawBank();else summary();return}
   if(!f)return;var o=obj(t);if(!o)return;if(t.dataset.c==="r"&&(f==="text"||f==="opt"||f==="n"))setTimeout(updSv,0);
   if(f==="text"){o.text=t.value;if(t.dataset.c==="r"){var pe=document.querySelector("#qp-res .qp-cd[data-i=\""+t.dataset.i+"\"] .qp-pt");if(pe)pe.textContent=t.value.slice(0,170)||"(mətn yoxdur)"}}else if(f==="opt")o.opts[+t.dataset.o]=t.value;else if(f==="n")o.n=+t.value||0});
  E("qp-dz").onclick=function(){E("qp-file").click()};
  E("qp-file").onchange=function(){S.files=[].slice.call(this.files);E("qp-fn").textContent=S.files.map(function(f){return f.name}).join(" · ")};
  }
 if(!E("mod-qbank")){var a2=E("mod-cropgen");if(a2){var q2=document.createElement("div");q2.id="mod-qbank";q2.className="admin-module-block";
  q2.innerHTML='<h4>🗃 Sual bazası</h4><div class="qp-fl" style="margin:0 0 6px"><button class="qp-b gr" data-a="goqp">⚡ Smart Kəsmə-yə keç</button><button class="qp-b gr" data-a="impex">📥 Mövcud sınaq suallarını idxal et</button></div>'
  +'<div id="qp-mode" style="font-size:12px;color:#475569;margin-bottom:6px"></div><div id="qp-metan" style="font-size:12px;color:#b45309;margin-bottom:6px"></div>'
  +'<div id="qp-mx" class="qb-mx"></div>'
  +'<div class="qp-fl"><label>Axtar<input id="qp-f" placeholder="mətn, mənbə və ya №"></label><label>Fənn<select id="qp-fs"><option value="">Hamısı</option></select></label>'
  +'<label>Kateqoriya<select id="qp-ft"><option value="">Hamısı</option><option>BB</option><option>BA</option><option>AC</option><option value="__none">Kateqoriyası yoxdur</option></select></label>'
  +'<label>Status<select id="qp-fu"><option value="">Hamısı</option><option value="unused">⏳ Heç sınaqda olmayıb</option><option value="used">✅ Sınaqda istifadə olunub</option><option value="notin">➕ Seçilən sınaqda yoxdur</option></select></label>'
  +'<label>Bu sınaqda olanlar<input id="qp-fx" type="number" placeholder="Sınaq №" style="width:100px"></label></div>'
  +'<div class="qb-tb"><label class="qb-all"><input type="checkbox" id="qp-all" data-a="all"> Görünənlərin hamısını seç</label><span id="qp-cnt" class="qb-cnt"></span>'
  +'<span class="qb-bulk">Seçilənlərə: <select id="qp-bsu"><option value="">fənn…</option>'+SUBJ.map(function(x){return"<option>"+x+"</option>"}).join("")+'</select><select id="qp-bta"><option value="">kateqoriya…</option><option>BB</option><option>BA</option><option>AC</option></select><button class="qp-b gr" data-a="bsub" style="padding:6px 10px">Təyin et</button><button class="qp-b no" data-a="delsel" style="padding:6px 10px">🗑 Sil</button></span><div id="qp-bmsg" style="font-weight:700;width:100%"></div></div>'
  +'<div class="qp-bank"><div id="qp-list" class="qp-list"></div><div id="qp-prev" class="qp-prev"></div></div>'
  +'<div class="qb-dock"><div class="qb-dh"><b>🎯 Seçilmişləri sınağa əlavə et</b><span id="qp-amsg" style="font-weight:700"></span></div>'
  +'<div class="qp-fl"><label>Sınaq №<input id="qp-ex" list="qp-exl" type="number" value="1" style="width:100px"><datalist id="qp-exl"></datalist></label>'
  +'<label>Kateqoriya (hansına əlavə olunsun)<span class="qb-cats"><label><input class="qp-cat" type="checkbox" value="BB" checked> BB</label><label><input class="qp-cat" type="checkbox" value="BA"> BA</label><label><input class="qp-cat" type="checkbox" value="AC"> AC</label></span></label>'
  +'<label>Yerləşdirmə<select id="qp-pm"><option value="auto">🧠 Avtomatik: fənn aralığına görə, boş nömrələrə</option><option value="man">✍️ Əl ilə: başlanğıc №-dən (üstünə yazır)</option></select></label>'
  +'<label id="qp-stw" style="display:none">Başlanğıc №<input id="qp-st" type="number" value="1" style="width:100px"></label></div>'
  +'<div class="qp-pre" id="qp-prew" style="display:none"><button data-a="pre" data-v="1">Az.dili 1</button><button data-a="pre" data-v="16">Qanun 16</button><button data-a="pre" data-v="56">İnformatika 56</button><button data-a="pre" data-v="71">Məntiq 71</button></div>'
  +'<div id="qp-sum" class="qb-sum"></div><button class="qp-b ok" data-a="assign">✅ Sınağa əlavə et</button> <button class="qp-b gr" data-a="refocc">🔄 Boş nömrələri yenilə</button></div>';
  a2.parentNode.insertBefore(q2,a2);q2.addEventListener("click",onClick);q2.addEventListener("change",onChange);q2.addEventListener("input",onInput);
  E("qp-f").oninput=drawBank;E("qp-fx").oninput=drawBank}}
 if(!E("qp-nav")){var nc=document.querySelector('.admin-nav-card[onclick*="cropgen"]');if(nc){var n=document.createElement("div");n.id="qp-nav";n.className="admin-nav-card";n.style.cssText="background:linear-gradient(135deg,#059669,#2563eb);color:#fff";n.innerHTML='<span class="icon">⚡</span> Smart Kəsmə & Sual Bankı PRO';n.onclick=function(){switchAdminTab("qpro");QPRO.open()};nc.parentNode.insertBefore(n,nc)}}
 if(!E("qb-nav")){var nc2=document.querySelector('.admin-nav-card[onclick*="cropgen"]');if(nc2){var n2=document.createElement("div");n2.id="qb-nav";n2.className="admin-nav-card";n2.style.cssText="background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff";n2.innerHTML='<span class="icon">🗃</span> Sual bazası';n2.onclick=function(){switchAdminTab("qbank");QPRO.openBank()};nc2.parentNode.insertBefore(n2,nc2)}}
 return true}
function onClick(e){var t=e.target.closest("[data-a],.qp-row");if(!t)return;var a=t.getAttribute("data-a");
 if(!a&&t.classList.contains("qp-row")){if(e.target.closest(".qb-ck"))return;S.cur=t.getAttribute("data-id");drawBank();return}
 if(a==="tab")tab(+t.getAttribute("data-n"));
 else if(a==="run")run();
 else if(a==="pick"){if(/^(INPUT|SELECT|OPTION|LABEL)$/.test(e.target.tagName))return;S.rs=+t.dataset.i;drawRes();var ed=E("qp-edit");if(ed)ed.classList.add("open")}
 else if(a==="nav"){S.rs=Math.max(0,Math.min(S.res.length-1,S.rs+(+t.dataset.d)));drawRes();var cc=document.querySelector("#qp-res .qp-cd.on");if(cc&&cc.scrollIntoView)cc.scrollIntoView({block:"nearest"})}
 else if(a==="eclose"){var ed2=E("qp-edit");if(ed2)ed2.classList.remove("open")}
 else if(a==="keyapply"){var K=parseKey(E("qp-keytxt").value),nk=Object.keys(K).length;if(!nk){msg("Cavab açarı oxunmadı. Nümunə: 56 D 57 B 58 E");return}var m=0;S.res.forEach(function(q){if(K[q.n]!=null&&K[q.n]<q.opts.length){q.correct=K[q.n];q.auto=1;m++}});msg("🔑 "+nk+" cavab oxundu, "+m+" sual işarələndi.");drawRes()}
 else if(a==="sync"){msg("Göndərilir…","qp-bmsg");ST.sync().then(function(n){msg("✅ "+n+" sual Supabase-ə göndərildi.","qp-bmsg");return load()}).catch(function(x){msg(RLS(x)?"Supabase hələ yazmağa icazə vermir — SQL-i işlədin.":"Xəta: "+x.message,"qp-bmsg")})}else if(a==="addall")addAll();
 else if(a==="oadd"){var o=obj(t);if(o.opts.length<8){o.opts.push("");ensOi(o);redraw(t)}}
 else if(a==="odel"){var o2=obj(t),k=+t.dataset.o;o2.opts.splice(k,1);ensOi(o2);o2.oi.splice(k,1);o2.orc.splice(k,1);if(o2.correct===k)o2.correct=-1;else if(o2.correct>k)o2.correct--;redraw(t)}
 else if(a==="addone")addOne(+t.dataset.i);
 else if(a==="cancel"){if(confirm("Bütün nəticələr silinsin?")){S.res=[];drawRes();msg("")}}
 else if(a==="fxpre"){var o5=obj(t),pv=t.dataset.v.split("|");o5.fx={bg:pv[0],fg:pv[1]};reimg(o5);redraw(t)}
 else if(a==="fxreset"){var o6=obj(t);o6.fx={};o6.thr=+E("qp-clean").value;reimg(o6);redraw(t)}
 else if(a==="fxall"){var o7=obj(t);S.res.forEach(function(z){if(z.cv&&(z.img||(z.oi||[]).some(function(a){return a}))){z.fx=Object.assign({},o7.fx);z.thr=o7.thr;reimg(z)}});drawRes();msg("🎨 Bütün şəkillərə tətbiq olundu.")}
 else if(a==="oirm"){var o8=obj(t),k8=+t.dataset.o;ensOi(o8);o8.oi[k8]="";o8.orc[k8]=null;redraw(t)}
 else if(a==="mx"){E("qp-fs").value=t.dataset.s;E("qp-ft").value=t.dataset.t;if(E("qp-fs").value!==t.dataset.s)E("qp-fs").value="";drawBank()}
 else if(a==="refocc"){S.occ={};S.added={};summary()}
 else if(a==="bsub"){var bs=E("qp-bsu").value,bt=E("qp-bta").value,ss=selected();if(!ss.length){msg("Əvvəl sual seçin.","qp-bmsg");return}if(!bs&&!bt){msg("Fənn və ya kateqoriya seçin.","qp-bmsg");return}
  (async function(){try{for(var z=0;z<ss.length;z++){if(bs)ss[z].subject=bs;if(bt)ss[z].tag=bt;await ST.put(ss[z])}await load();msg("✅ "+ss.length+" sual yeniləndi.","qp-bmsg")}catch(x){msg("Xəta: "+x.message,"qp-bmsg")}})()}
 else if(a==="goqp"){if(window.switchAdminTab)switchAdminTab("qpro")}
 else if(a==="impex")importExams();
 else if(a==="sqlcopy"){try{navigator.clipboard.writeText(SQLM);msg("📋 SQL kopyalandı — Supabase → SQL Editor → Run.","qp-bmsg")}catch(x){prompt("SQL:",SQLM)}}
 else if(a==="fsub"){var fe=E("qp-fs");fe.value=t.dataset.v;if(fe.value!==t.dataset.v)fe.value="";drawBank()}
 else if(a==="uclr"){var ci=cur();if(ci&&confirm("Bu sualın sınaq istifadə qeydi təmizlənsin?")){ci.used=[];ST.put(ci).then(load).catch(function(x){msg("Xəta: "+x.message,"qp-bmsg")})}}
 else if(a==="delsel"){var ids=Object.keys(S.sel).filter(function(k){return S.sel[k]});if(!ids.length){msg("Əvvəl sual seçin.","qp-bmsg");return}
  if(confirm(ids.length+" sual bankdan silinsin? (sınaqlardakı suallara toxunulmur)")){(async function(){try{for(var z=0;z<ids.length;z++){await ST.del(ids[z]);delete S.sel[ids[z]]}if(ids.indexOf(S.cur)>-1)S.cur=null;await load();msg("✅ "+ids.length+" sual silindi.","qp-bmsg")}catch(x){msg("Xəta: "+x.message,"qp-bmsg")}})()}}
 else if(a==="qimg"){var oq=obj(t);if(qimgOf(oq))redraw(t)}
 else if(a==="rmimg"){var orr=obj(t);orr.img="";orr.cv=null;redraw(t)}
 else if(a==="adj")adj(+t.dataset.i,t.dataset.e,t.dataset.d);
 else if(a==="rm"){var ri=+t.dataset.i;S.res.splice(ri,1);if(ri<S.rs)S.rs--;drawRes()}
 else if(a==="sel"){S.sel[t.dataset.id]=t.checked;e.stopPropagation();selUI()}
 else if(a==="all"){var f=filtered(),on=!f.every(function(i){return S.sel[i.id]});f.forEach(function(i){S.sel[i.id]=on});drawBank()}
 else if(a==="pre"){E("qp-st").value=t.dataset.v;summary()}
 else if(a==="assign")assign();
 else if(a==="csave")csave();else if(a==="ctest")ctest();else if(a==="cmig")migrate();else if(a==="cstop"){S.mig=0;msg("Dayandırılır…","qp-cmsg")}
 else if(a==="psave"){var it=S.items.filter(function(x){return x.id===S.cur})[0];if(!it)return;it.num=+E("qp-pn").value||0;it.src=E("qp-ps").value;it.tag=E("qp-pt").value;it.subject=E("qp-psu").value;
  ST.put(it).then(load).catch(function(x){msg("Xəta: "+x.message,"qp-bmsg")})}
 else if(a==="pdel"){if(S.cur&&confirm("Bu sual bankdan silinsin?"))ST.del(S.cur).then(function(){delete S.sel[S.cur];S.cur=null;return load()}).catch(function(x){msg("Xəta: "+x.message,"qp-bmsg")})}}
function onChange(e){var t=e.target,f=t.dataset&&t.dataset.f,o;
 if(f==="subj"){o=obj(t);o.subject=t.value;return}
 if(f==="fxthr"||f==="fxbg"||f==="fxfg"){o=obj(t);o.fx=o.fx||{};if(f==="fxthr")o.thr=+t.value;else if(f==="fxbg")o.fx.bg=t.value;else o.fx.fg=t.value;reimg(o);redraw(t);return}
 if(f==="cs"){o=obj(t);o.correct=t.value===""?-1:+t.value;o.auto=0;drawRes();return}
 if(f==="cor"){o=obj(t);o.correct=+t.dataset.o;o.auto=0;if(t.dataset.c==="r"){drawRes();return}var w=E("qpw-"+t.dataset.c+(t.dataset.c==="r"?t.dataset.i:0));if(w)w.style.display="none";summary()}
 else if(f==="oimg"){o=obj(t);var fl2=t.files[0];if(!fl2)return;var rd2=new FileReader(),c2=t.dataset.c,k2=+t.dataset.o;rd2.onload=function(){ensOi(o);o.oi[k2]=rd2.result;o.orc[k2]=null;if(c2==="r")drawRes();else{drawPrev();drawBank()}};rd2.readAsDataURL(fl2)}
 else if(f==="img"){o=obj(t);var fl=t.files[0];if(!fl)return;var rd=new FileReader(),c=t.dataset.c;rd.onload=function(){o.img=rd.result;o.cv=null;if(c==="r")drawRes();else{drawPrev();drawBank()}};rd.readAsDataURL(fl)}
 if(/^qp-f[tsu]$/.test(t.id))drawBank();if(t.id==="qp-pm"){E("qp-stw").style.display=t.value==="man"?"":"none";E("qp-prew").style.display=t.value==="man"?"":"none";summary()}if(t.classList.contains("qp-cat"))summary()}

/* ---------- Alt panel: seçilmiş suallar + «Sınaq N əlavə et» + PDF ---------- */
function barKey(it){return(it.subject||"Fənni yoxdur")+" · "+(it.tag||"kateqoriyasız")}
function barUI(){var q=E("mod-qbank");if(!q)return;
 if(!E("qp-css2")){var st=document.createElement("style");st.id="qp-css2";
  st.textContent="#qp-bar{position:fixed;left:0;right:0;bottom:0;z-index:999;background:#0f172a;color:#fff;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 16px rgba(0,0,0,.25);display:none}#qp-bar .qb-bt{font-size:13px;line-height:1.5;margin-bottom:8px}#qp-bar .qb-bt b{color:#fde68a}#qp-bar .qb-br{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#qp-bar input{width:70px;padding:8px;border-radius:8px;border:0;font-size:14px}#qp-bar button{padding:10px 14px;border:0;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;background:#16a34a;color:#fff;flex:1}#qp-bar button.gr{background:#475569;flex:0 0 auto}";
  document.head.appendChild(st)}
 var bar=E("qp-bar");
 if(!bar){bar=document.createElement("div");bar.id="qp-bar";q.appendChild(bar);
  bar.addEventListener("input",function(e){if(e.target.id==="qp-bex"){E("qp-ex").value=e.target.value;if(E("qp-fu").value==="notin")drawBank();else summary();barUI()}});
  bar.addEventListener("click",function(e){var b=e.target.closest("[data-b]");if(!b)return;if(b.dataset.b==="pdf")pdfSel()})}
 var sel=selected(),vis=q.offsetParent!==null;
 if(!sel.length||!vis){bar.style.display="none";return}
 var g={};sel.forEach(function(it){var k=barKey(it);g[k]=(g[k]||0)+1});
 var ex=(E("qp-ex").value||"").trim(),cats=cats_();
 var txt=Object.keys(g).map(function(k){return esc(k)+" papkasından <b>"+g[k]+"</b> sual seçildi"}).join("<br>");
 var lbl="Sınaq "+esc(ex||"?")+(cats.length?" "+esc(cats.join("+")):"")+" əlavə et";
 var had=document.activeElement&&document.activeElement.id==="qp-bex";
 bar.innerHTML='<div class="qb-bt">'+txt+'</div><div class="qb-br"><input id="qp-bex" type="number" placeholder="Sınaq №" value="'+esc(ex)+'"><button data-a="assign">➕ '+lbl+'</button><button class="gr" data-b="pdf">📄 PDF</button></div>';
 bar.style.display="block";if(had){var i=E("qp-bex");i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
function pdfSel(){var sel=selected();if(!sel.length){msg("Əvvəl sual seçin.","qp-bmsg");return}
 var order=SUBJ.slice();sel=sel.slice().sort(function(a,b){var x=order.indexOf(a.subject),y=order.indexOf(b.subject);x=x<0?99:x;y=y<0?99:y;return x-y||(a.tag||"").localeCompare(b.tag||"")||(a.src||"").localeCompare(b.src||"")||(a.num||0)-(b.num||0)});
 var h='<!doctype html><html><head><meta charset="utf-8"><title>Seçilmiş suallar</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:16px;background:#e2e8f0;padding:6px 10px;border-radius:6px;margin:22px 0 10px;page-break-after:avoid}.q{margin:0 0 14px;page-break-inside:avoid}.q img{max-width:100%;display:block;margin:6px 0}.o{margin:3px 0 3px 14px}.o img{max-height:120px}small{color:#64748b}table{border-collapse:collapse;margin-top:8px}td,th{border:1px solid #94a3b8;padding:3px 8px;font-size:13px}@media print{.np{display:none}}</style></head><body><button class="np" onclick="print()" style="padding:10px 16px;font-size:15px">🖨 PDF kimi saxla / çap et</button><h1>Seçilmiş suallar ('+sel.length+')</h1>',cur_h=null,n=0,key=[];
 sel.forEach(function(it){var hd=barKey(it);if(hd!==cur_h){cur_h=hd;h+="<h2>"+esc(hd)+"</h2>"}n++;
  h+='<div class="q"><b>'+n+'.</b> '+(it.text?esc(it.text).replace(/\n/g,"<br>"):"")+' <small>('+esc(it.src||"")+(it.num?" №"+it.num:"")+')</small>'+(it.img?'<img src="'+it.img+'">':"");
  (it.opts||[]).forEach(function(o,k){var t=(o||"").trim(),im=(it.oi||[])[k];if(!t&&!im)return;h+='<div class="o"><b>'+LL[k]+')</b> '+esc(t)+(im?'<br><img src="'+im+'">':"")+"</div>"});
  h+="</div>";key.push(n+"-"+(it.correct>-1?L[it.correct]:"?"))});
 h+='<h2>Cavab açarı</h2><table><tr>'+key.map(function(k,i){return"<td>"+k+"</td>"+((i+1)%10===0?"</tr><tr>":"")}).join("")+"</tr></table></body></html>";
 var w=window.open("","_blank");if(!w){msg("Pəncərə bloklandı — brauzerdə pop-up-a icazə verin.","qp-bmsg");return}
 w.document.open();w.document.write(h);w.document.close();
 var imgs=[].slice.call(w.document.images),go=function(){try{w.focus();w.print()}catch(e){}};
 Promise.all(imgs.map(function(i){return i.complete?1:new Promise(function(r){i.onload=i.onerror=r})})).then(function(){setTimeout(go,300)})}
setInterval(barUI,1500);

window.QPRO={open:async function(){hook();await ST.init()},openBank:async function(){hook();await ST.init();S.tab=2;load()},run:run};
var n=0,iv=setInterval(function(){build();hook();if(++n>200)clearInterval(iv)},3000);
build();hook();
})();
