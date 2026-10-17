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
var RLS=function(e){return!!e&&(e.code==="42501"||/row-level security|permission denied/i.test(e.message||""))};
var ST={db:null,
 idb:function(){return this.db||(this.db=new Promise(function(ok,no){var r=indexedDB.open("dq_qbank",1);r.onupgradeneeded=function(){r.result.createObjectStore("q",{keyPath:"id"})};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}}))},
 tx:function(m,f){return this.idb().then(function(d){return new Promise(function(ok,no){var t=d.transaction("q",m),q=f(t.objectStore("q"));t.oncomplete=function(){ok(q&&q.result)};t.onerror=function(){no(t.error)}})})},
 init:async function(){try{var r=await _supabase.from("question_bank").select("id").limit(1);S.mode=r.error?"idb":"sb"}catch(e){S.mode="idb"}},
 all:async function(){var loc=[];try{loc=(await this.tx("readonly",function(o){return o.getAll()}))||[]}catch(e){}
  if(S.mode==="sb"){var r=await _supabase.from("question_bank").select("*").order("created",{ascending:true});if(r.error)throw r.error;
   var ids={},out=r.data||[];out.forEach(function(x){ids[x.id]=1});S.nloc=0;loc.forEach(function(x){if(!ids[x.id]){x._local=1;S.nloc++;out.push(x)}});return out}
  S.nloc=0;return loc},
 put:async function(it0){var it=Object.assign({},it0);delete it._local;
  if(S.mode==="sb"){var r=await _supabase.from("question_bank").upsert([it]);
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
function render(cv,r,thr){
 var P=14,c=document.createElement("canvas");c.width=Math.round(r.w)+P*2;c.height=Math.round(r.h)+P*2;
 var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
 x.drawImage(cv,r.x,r.y,r.w,r.h,P,P,Math.round(r.w),Math.round(r.h));
 (cv.qmask||[]).forEach(function(m){x.fillStyle="#fff";x.fillRect(P+m.x-r.x,P+m.y-r.y,m.w,m.h)});
 if(thr<255){var im=x.getImageData(0,0,c.width,c.height),d=im.data;
  for(var i=0;i<d.length;i+=4){var l=.299*d[i]+.587*d[i+1]+.114*d[i+2];if(l>thr){d[i]=d[i+1]=d[i+2]=255}else if(l<90){d[i]=d[i+1]=d[i+2]=0}}
  x.putImageData(im,0,0)}
 return c.toDataURL("image/png")}

/* ---------- İş axını: yüklə -> kəs ---------- */
async function run(){
 if(S.busy)return;var fs=S.files;if(!fs.length){msg("Əvvəlcə şəkil / PDF seçin.");return}
 S.busy=1;S.res=[];S.rs=0;var thr=+E("qp-clean").value,src0=E("qp-src").value.trim(),G={},na=0;
 try{msg("OCR hazırlanır…");await needOCR();
  for(var fi=0;fi<fs.length;fi++){var f=fs[fi],src=src0||f.name.replace(/\.[^.]+$/,""),pg=await filePages(f),K={},first=S.res.length;
   for(var pi=0;pi<pg.length;pi++){msg("Fayl "+(fi+1)+"/"+fs.length+" · səhifə "+(pi+1)+"/"+pg.length+" oxunur…");
    var sg=await segment(pg[pi]);
    if(sg.key){pg[pi].qmask=sg.key.boxes;Object.assign(K,sg.key.map)}
    if(!sg.list.length&&!sg.key){var b=sg.bounds;sg.list=[{n:0,x:b[0],y:b[1],w:b[2],h:b[3]-b[1]}]}
    sg.list.forEach(function(q){S.res.push({id:uid(),cv:pg[pi],r:q,n:q.n,src:src,thr:thr,ok:1,correct:-1,auto:0,text:"",opts:["","","","",""],img:render(pg[pi],q,thr)})})}
   na+=applyKey(S.res.slice(first),K);Object.assign(G,K)}
  na+=applyKey(S.res,G);var nk=Object.keys(G).length;
  msg("✅ "+S.res.length+" sual tapıldı"+(nk?" · 🔑 cavab açarı tapıldı ("+nk+" cavab), "+na+" sual avtomatik işarələndi.":" · cavab açarı tapılmadı (aşağıdan əl ilə yapışdıra bilərsiniz).")+" Yoxlayın, sonra banka əlavə edin.")
 }catch(e){msg("Xəta: "+e.message)}
 S.busy=0;drawRes()}
function cur(){return S.items.filter(function(x){return x.id===S.cur})[0]}
function obj(t){return t.dataset.c==="r"?S.res[+t.dataset.i]:cur()}
function redraw(t){t.dataset.c==="r"?drawRes():drawPrev()}
function warn(q,c,i){return'<span id="qpw-'+c+i+'" class="qp-no" style="'+(q.correct<0?"":"display:none")+'">⚠ Düzgün cavab seçilməyib</span>'}
function body(q,c,i,extra){var d='data-c="'+c+'" data-i="'+i+'"',h='<textarea '+d+' data-f="text" rows="3" placeholder="Sual mətni (istəyə görə, boş ola bilər)">'+esc(q.text)+'</textarea>'
 +'<div class="qp-im"><b>🖼 Sualın Əsas Şəkli:</b><img src="'+q.img+'"><div class="qp-cf">';
 if(q.cv)h+='<span class="qp-adj"><button '+d+' data-a="adj" data-e="t" data-d="-14" title="Yuxarı genişlət">⬆+</button><button '+d+' data-a="adj" data-e="t" data-d="14" title="Yuxarı daralt">⬆−</button><button '+d+' data-a="adj" data-e="b" data-d="14" title="Aşağı genişlət">⬇+</button><button '+d+' data-a="adj" data-e="b" data-d="-14" title="Aşağı daralt">⬇−</button></span>';
 h+='<label class="qp-fb">🔄 Şəkli dəyiş<input type="file" accept="image/*" '+d+' data-f="img" style="display:none"></label></div></div>';
 q.opts.forEach(function(t,k){h+='<div class="qp-op"><b>'+LL[k]+')</b><input '+d+' data-f="opt" data-o="'+k+'" value="'+esc(t)+'" placeholder="Variant mətni (şəkildədirsə boş qala bilər)"><label class="qp-rd"><input type="radio" name="qpc-'+c+i+'" '+d+' data-f="cor" data-o="'+k+'"'+(q.correct===k?" checked":"")+'> Düzgün</label><button '+d+' data-a="odel" data-o="'+k+'" class="qp-x"'+(q.opts.length<=2?" disabled":"")+'>🗑 Sil</button></div>'});
 return h+'<div class="qp-fl" style="margin-top:8px"><button class="qp-b gr" '+d+' data-a="oadd">+ Dinamik Variant Əlavə Et</button>'+(extra||"")+'</div>'}
function adjB(d){return'<span class="qp-adj"><button '+d+' data-a="adj" data-e="t" data-d="-14" title="Yuxarı genişlət">⬆+</button><button '+d+' data-a="adj" data-e="t" data-d="14" title="Yuxarı daralt">⬆−</button><button '+d+' data-a="adj" data-e="b" data-d="14" title="Aşağı genişlət">⬇+</button><button '+d+' data-a="adj" data-e="b" data-d="-14" title="Aşağı daralt">⬇−</button></span>'}
function cardH(q,i){var d='data-c="r" data-i="'+i+'"',sel='<select '+d+' data-f="cs"><option value="">—</option>'+q.opts.map(function(_,k){return'<option value="'+k+'"'+(q.correct===k?" selected":"")+'>'+LL[k]+'</option>'}).join("")+'</select>';
 return'<div class="qp-cd '+(q.correct<0?"nc":"ok")+(i===S.rs?" on":"")+'" data-a="pick" data-i="'+i+'"><img src="'+q.img+'"><div class="qp-cb"><label>№<input type="number" class="qp-nn" '+d+' data-f="n" value="'+q.n+'"></label><label>Cavab'+sel+'</label>'+(q.auto?'<span title="Cavab açarından avtomatik">🔑</span>':"")+'</div><div class="qp-cf">'+(q.cv?adjB(d):"")+'<button '+d+' data-a="rm" class="qp-x">✕</button></div></div>'}
function edH(){var i=S.rs,q=S.res[i];if(!q)return'<div class="qp-em">Soldan sual seçin.</div>';var d='data-c="r" data-i="'+i+'"';
 return'<div class="qp-qh"><span><b>👁 Ön baxış</b> · Sual <input type="number" class="qp-nn" '+d+' data-f="n" value="'+q.n+'"> <small>('+(i+1)+"/"+S.res.length+")</small></span>"+warn(q,"r",i)+"</div>"
 +'<div class="qp-fl" style="margin:0 0 6px"><button class="qp-b gr" data-a="nav" data-d="-1">◀ Əvvəlki</button><button class="qp-b gr" data-a="nav" data-d="1">Sonrakı ▶</button><button class="qp-b no qp-mx" data-a="eclose">✕ Bağla</button></div>'
 +body(q,"r",i,'<button class="qp-b ok" '+d+' data-a="addone">📥 Banka əlavə et</button><button class="qp-b no" '+d+' data-a="rm">🗑 Sualı sil</button>')}
function drawRes(){var box=E("qp-res"),ol=box.querySelector(".qp-cl"),oe=E("qp-edit"),t1=ol?ol.scrollTop:0,t2=oe?oe.scrollTop:0,op=!!(oe&&oe.classList.contains("open"));
 if(!S.res.length){box.innerHTML="";return}
 if(S.rs>=S.res.length)S.rs=S.res.length-1;if(S.rs<0)S.rs=0;
 var nc=S.res.filter(function(q){return q.correct<0}).length;
 box.innerHTML='<div class="qp-split"><div class="qp-lc"><div class="qp-ph">✂️ '+S.res.length+" sual kəsildi · "+(nc?'<span class="qp-no">cavabsız: '+nc+"</span>":"✅ hamısında cavab var")+'</div><div class="qp-cl">'+S.res.map(cardH).join("")+'</div><div class="qp-ft"><button class="qp-b gr" data-a="cancel">Ləğv et</button><button class="qp-b" data-a="addall">Hamısını banka əlavə et</button></div></div><div id="qp-edit" class="qp-edit'+(op?" open":"")+'">'+edH()+"</div></div>";
 ol=box.querySelector(".qp-cl");oe=E("qp-edit");if(ol)ol.scrollTop=t1;if(oe)oe.scrollTop=t2}
function adj(i,e,d){S.rs=i;var q=S.res[i],r=q.r;d=+d;
 if(e==="t"){r.y+=d;r.h-=d}else{r.h+=d}
 if(r.y<0){r.h+=r.y;r.y=0}if(r.y+r.h>q.cv.height)r.h=q.cv.height-r.y;if(r.h<20)r.h=20;
 q.img=render(q.cv,r,q.thr);drawRes()}
async function mkU(q){var o=mk(q);try{o.img=await toUrl(o.img)}catch(e){}return o}
function mk(q){return{id:uid(),src:q.src,num:q.n||0,tag:E("qp-tag").value,correct:q.correct,img:q.img,text:q.text||"",opts:q.opts.slice(),created:new Date().toISOString()}}
async function addOne(i){S.rls=0;try{await ST.put(await mkU(S.res[i]));S.res.splice(i,1);if(i<S.rs)S.rs--;drawRes();msg("✅ Banka əlavə olundu."+(S.rls?" (Supabase yazma icazəsi yoxdur — bu cihazda saxlandı, SQL-i işlədin)":""))}catch(e){msg("Xəta: "+e.message)}}
async function addAll(){var n=0,nc=S.res.filter(function(q){return q.correct<0}).length;S.rls=0;
 if(nc&&!confirm(nc+" sualda düzgün cavab seçilməyib. Yenə də banka əlavə edilsin?"))return;msg("Banka yazılır…");
 try{for(var i=0;i<S.res.length;i++){await ST.put(await mkU(S.res[i]));n++}
  S.res=[];drawRes();msg("✅ "+n+" sual banka əlavə olundu."+(S.rls?" (Supabase yazma icazəsi yoxdur — bu cihazda saxlandı, SQL-i işlədin)":""));await load();tab(2)}
 catch(e){msg("Xəta: "+e.message)}}
/* ---------- Bank ---------- */
async function load(){try{S.items=await ST.all()}catch(e){msg("Bank oxunmadı: "+e.message,"qp-bmsg")}
 S.items.forEach(function(it){it.text=it.text||"";if(!it.opts||!it.opts.length)it.opts=["","","","",""]});S.items.sort(function(a,b){return(a.src||"").localeCompare(b.src||"")||(a.num||0)-(b.num||0)});drawBank()}
function filtered(){var q=(E("qp-f").value||"").toLowerCase(),t=E("qp-ft").value;
 return S.items.filter(function(it){return(!t||it.tag===t)&&(!q||((it.src||"")+" "+it.num).toLowerCase().indexOf(q)>-1)})}
function drawBank(){var a=filtered(),h="";
 a.forEach(function(it){h+='<div class="qp-row'+(S.cur===it.id?" cur":"")+'" data-id="'+it.id+'"><input type="checkbox" data-a="sel" data-id="'+it.id+'"'+(S.sel[it.id]?" checked":"")+'><img src="'+it.img+'" loading="lazy"><div class="qp-rm"><b>№'+(it.num||"?")+'</b> '+(it.tag?'<span class="qp-tg">'+esc(it.tag)+'</span>':"")+(it.correct>-1?' <span class="qp-ok">✓'+L[it.correct]+'</span>':' <span class="qp-no">cavab yox</span>')+'<br><small>'+esc(it.src)+'</small></div></div>'});
 E("qp-list").innerHTML=h||'<div class="qp-em">Bank boşdur və ya filtrə uyğun sual yoxdur.</div>';
 E("qp-cnt").textContent=a.length+" sual · seçilib: "+Object.keys(S.sel).filter(function(k){return S.sel[k]}).length;
 E("qp-mode").innerHTML=S.mode==="sb"?"☁️ Bank: Supabase (hər cihazdan)"+(S.nloc?' · ⚠ '+S.nloc+' sual yalnız bu cihazdadır <button class="qp-b gr" data-a="sync" style="padding:4px 10px">☁️ Supabase-ə göndər</button>':""):"💾 Bank: yalnız bu cihazda (question_bank cədvəli yoxdur)";
 drawPrev();summary()}
function drawPrev(){var it=cur(),p=E("qp-prev");
 if(!it){p.innerHTML='<div class="qp-em">Önbaxış üçün soldan sual seçin.</div>';return}
 p.innerHTML='<div class="qp-qh"><b>👁 Ön baxış</b>'+warn(it,"b",0)+'</div><div class="qp-pf"><label>№ <input id="qp-pn" type="number" value="'+(it.num||0)+'"></label>'
  +'<label>Mənbə <input id="qp-ps" value="'+esc(it.src)+'"></label>'
  +'<label>Kateqoriya <select id="qp-pt">'+["","BA","BB","AC"].map(function(t){return'<option'+(it.tag===t?" selected":"")+' value="'+t+'">'+(t||"—")+'</option>'}).join("")+'</select></label></div>'
  +body(it,"b",0,'<button class="qp-b ok" data-a="psave">💾 Yadda saxla</button><button class="qp-b no" data-a="pdel">🗑 Sualı sil</button>')}
function chosen(){var f=filtered().filter(function(it){return S.sel[it.id]});return f}
function summary(){var c=chosen(),ex=E("qp-ex").value||"?",st=+E("qp-st").value||1,cats=cats_(),
 nc=c.filter(function(i){return i.correct<0}).length;
 E("qp-sum").innerHTML=c.length?("<b>"+c.length+" sual</b> → Sınaq <b>"+esc(ex)+"</b> · <b>"+(cats.join(", ")||"kateqoriya seçilməyib")+"</b> · №<b>"+st+"–"+(st+c.length-1)+"</b>"+(st+c.length-1>100?' <span class="qp-no">100-dən çoxdur!</span>':"")+(nc?'<br><span class="qp-no">'+nc+" sualda düzgün cavab seçilməyib (A kimi yazılacaq)</span>":"")):"Bankdan sual seçin."}
function cats_(){return Array.prototype.map.call(document.querySelectorAll(".qp-cat:checked"),function(c){return c.value})}
async function assign(){var c=chosen(),ex=E("qp-ex").value.trim(),st=parseInt(E("qp-st").value,10),cats=cats_();
 if(!c.length||!ex||!st||!cats.length){msg("Sual, sınaq №, başlanğıc № və kateqoriya seçin.","qp-amsg");return}
 if(st+c.length-1>100){msg("Son nömrə 100-dən çox ola bilməz.","qp-amsg");return}
 if(!confirm("Sınaq "+ex+" · "+cats.join(", ")+" · №"+st+"–"+(st+c.length-1)+"\n"+c.length+" sual yazılacaq. Həmin nömrələrdə mövcud suallar ƏVƏZ OLUNACAQ. Davam?"))return;
 try{var U=[];for(var j=0;j<c.length;j++){msg("Şəkil hazırlanır "+(j+1)+"/"+c.length+"…","qp-amsg");U[j]=await toUrl(c[j].img)}
  for(var k=0;k<cats.length;k++)for(var i=0;i<c.length;i++){var n=st+i,it=c[i],
   p={subject:window.getSubjectByNumber?getSubjectByNumber(n):"Ümumi",question:it.text||"",image_url:U[i],options:(it.opts&&it.opts.length?it.opts:L).map(function(t,k){return(t&&t.trim())||LL[k]}),correct:it.correct>-1?it.correct:0};
   msg("Yazılır: "+cats[k]+" №"+n+"…","qp-amsg");
   var r=await _supabase.from("exam_questions").select("id").eq("exam_id",ex).eq("category",cats[k]).eq("q_number",n).maybeSingle();
   var q=r.data?await _supabase.from("exam_questions").update(p).eq("id",r.data.id):await _supabase.from("exam_questions").insert([Object.assign({exam_id:ex,category:cats[k],q_number:n},p)]);
   if(q.error)throw q.error}
  msg("✅ Tamamlandı: Sınaq "+ex+" · "+cats.join(", ")+" · №"+st+"–"+(st+c.length-1),"qp-amsg")
 }catch(e){msg("Xəta: "+(e.message||e),"qp-amsg")}}

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
function tab(n){S.tab=n;E("qp-t1").style.display=n===1?"":"none";E("qp-t2").style.display=n===2?"":"none";E("qp-t3").style.display=n===3?"":"none";E("qp-b3").classList.toggle("on",n===3);if(n===3){var c=cfg()||{};E("qp-cu").value=c.u||"";E("qp-ck").value=c.k||"";E("qp-cw").checked=c.w!==false}
 E("qp-b1").classList.toggle("on",n===1);E("qp-b2").classList.toggle("on",n===2);if(n===2)load()}
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
+"#mod-qpro .qp-pre{display:flex;gap:6px;flex-wrap:wrap}#mod-qpro .qp-pre button{padding:5px 9px;border:1px solid #a5b4fc;background:#fff;border-radius:8px;font-size:12px;cursor:pointer}";

function build(){
 if(!E("qp-css")){var s=document.createElement("style");s.id="qp-css";s.textContent=CSS;document.head.appendChild(s)}
 if(!E("mod-qpro")){var a=E("mod-cropgen");if(!a)return false;var d=document.createElement("div");d.id="mod-qpro";d.className="admin-module-block";
  d.innerHTML='<h4>⚡ Smart Kəsmə & Sual Bankı PRO</h4><div class="qp-tabs"><button id="qp-b1" class="on" data-a="tab" data-n="1">① Yüklə & Avto-kəs</button><button id="qp-b2" data-a="tab" data-n="2">② Sual Bankı</button><button id="qp-b3" data-a="tab" data-n="3">③ ☁️ Cloudflare</button></div>'
  +'<div id="qp-t1"><div class="qp-drop" id="qp-dz">📷 Şəkil / PDF seçin (bir neçə fayl ola bilər)<br><small>Ekran şəkilləri, foto və ya PDF — sistem hər sualı nömrəsinə görə ayrıca kəsəcək</small><input id="qp-file" type="file" accept="image/*,application/pdf" multiple style="display:none"></div>'
  +'<div id="qp-fn" style="margin:6px 0;font-size:13px;color:#475569"></div>'
  +'<details class="qp-kd"><summary>🔑 Cavab açarı — PDF-in sonunda avtomatik tapılır; lazım olsa əl ilə yapışdırın</summary><textarea id="qp-keytxt" rows="3" placeholder="56 D  57 B  58 E …   və ya   56-D, 57-B, 58-E"></textarea><button class="qp-b gr" data-a="keyapply">Tətbiq et (kəsilmiş suallara)</button></details>'
  +''
  +'<div class="qp-fl"><label>Mənbə adı (boşdursa fayl adı)<input id="qp-src" placeholder="məs: 05.02.2026 DQ(BB)"></label><label>Kateqoriya<select id="qp-tag"><option value="">—</option><option>BA</option><option selected>BB</option><option>AC</option></select></label>'
  +'<label>Fon təmizləmə<select id="qp-clean"><option value="255">Yox</option><option value="215" selected>Yüngül (su nişanı)</option><option value="185">Güclü</option></select></label><button class="qp-b" data-a="run">✂️ Avto-kəs</button></div>'
  +'<div id="qp-msg" style="font-weight:700;color:#334155"></div><div id="qp-res" class="qp-res"></div>'
  +'</div>'
  +'<div id="qp-t2" style="display:none"><div id="qp-mode" style="font-size:12px;color:#475569;margin-bottom:6px"></div>'
  +'<div class="qp-fl"><label>Axtar<input id="qp-f" placeholder="mənbə və ya №"></label><label>Kateqoriya<select id="qp-ft"><option value="">Hamısı</option><option>BA</option><option>BB</option><option>AC</option></select></label><button class="qp-b gr" data-a="all">Hamısını seç/sil</button><span id="qp-cnt" style="font-size:13px;font-weight:700"></span><div id="qp-bmsg"></div></div>'
  +'<div class="qp-bank"><div id="qp-list" class="qp-list"></div><div id="qp-prev" class="qp-prev"></div></div>'
  +'<div class="qp-as"><b>🎯 Seçilmişləri sınağa təyin et</b><div class="qp-fl"><label>Sınaq №<input id="qp-ex" type="number" value="1" style="width:90px"></label><label>Başlanğıc sual №<input id="qp-st" type="number" value="71" style="width:110px"></label>'
  +'<label>Kateqoriya<span style="display:flex;gap:10px;font-weight:600"><span><input class="qp-cat" type="checkbox" value="BA"> BA</span><span><input class="qp-cat" type="checkbox" value="BB" checked> BB</span><span><input class="qp-cat" type="checkbox" value="AC"> AC</span></span></label></div>'
  +'<div class="qp-pre"><button data-a="pre" data-v="1">Az.dili 1</button><button data-a="pre" data-v="16">Qanun 16</button><button data-a="pre" data-v="56">İnformatika 56</button><button data-a="pre" data-v="71">Məntiq 71</button></div>'
  +'<div id="qp-sum" style="margin:10px 0;font-size:14px"></div><button class="qp-b ok" data-a="assign">✅ Sınağa Əlavə Et</button> <span id="qp-amsg" style="font-weight:700;margin-left:8px"></span></div></div>'
  +'<div id="qp-t3" style="display:none"><p style="font-size:13px;color:#475569">Şəkillər Cloudflare R2-də saxlanır, bazada yalnız link qalır — Supabase egress limiti aşılmır. Qoşulandan sonra yeni əlavə olunan şəkillər (sual, variant, bank) avtomatik buraya yüklənir; köhnələri "Köhnə şəkilləri köçür" ilə köçürün.</p><div class="qp-fl"><label style="flex:1">Worker URL<input id="qp-cu" placeholder="https://dq-img.xxx.workers.dev"></label><label>Yükləmə açarı<input id="qp-ck" type="password"></label><label style="flex-direction:row;align-items:center;gap:6px"><input id="qp-cw" type="checkbox" checked> WebP-yə sıx</label></div><div class="qp-fl"><button class="qp-b" data-a="csave">💾 Yadda saxla</button><button class="qp-b gr" data-a="ctest">🔌 Test</button><button class="qp-b ok" data-a="cmig">🚚 Köhnə şəkilləri köçür</button><button class="qp-b no" data-a="cstop">⏹ Dayandır</button></div><div id="qp-cmsg" style="font-weight:700"></div></div>';
  a.parentNode.insertBefore(d,a);
  d.addEventListener("click",onClick);d.addEventListener("change",onChange);d.addEventListener("input",function(e){var t=e.target,f=t.dataset&&t.dataset.f;if(/^qp-(ex|st)$/.test(t.id)){summary();return}
   if(!f)return;var o=obj(t);if(!o)return;if(f==="text")o.text=t.value;else if(f==="opt")o.opts[+t.dataset.o]=t.value;else if(f==="n")o.n=+t.value||0});
  E("qp-dz").onclick=function(){E("qp-file").click()};
  E("qp-file").onchange=function(){S.files=[].slice.call(this.files);E("qp-fn").textContent=S.files.map(function(f){return f.name}).join(" · ")};
  E("qp-f").oninput=drawBank}
 if(!E("qp-nav")){var nc=document.querySelector('.admin-nav-card[onclick*="cropgen"]');if(nc){var n=document.createElement("div");n.id="qp-nav";n.className="admin-nav-card";n.style.cssText="background:linear-gradient(135deg,#059669,#2563eb);color:#fff";n.innerHTML='<span class="icon">⚡</span> Smart Kəsmə & Sual Bankı PRO';n.onclick=function(){switchAdminTab("qpro");QPRO.open()};nc.parentNode.insertBefore(n,nc)}}
 return true}
function onClick(e){var t=e.target.closest("[data-a],.qp-row");if(!t)return;var a=t.getAttribute("data-a");
 if(!a&&t.classList.contains("qp-row")){S.cur=t.getAttribute("data-id");drawBank();return}
 if(a==="tab")tab(+t.getAttribute("data-n"));
 else if(a==="run")run();
 else if(a==="pick"){if(/^(INPUT|SELECT|OPTION|LABEL)$/.test(e.target.tagName))return;S.rs=+t.dataset.i;drawRes();var ed=E("qp-edit");if(ed)ed.classList.add("open")}
 else if(a==="nav"){S.rs=Math.max(0,Math.min(S.res.length-1,S.rs+(+t.dataset.d)));drawRes();var cc=document.querySelector("#qp-res .qp-cd.on");if(cc&&cc.scrollIntoView)cc.scrollIntoView({block:"nearest"})}
 else if(a==="eclose"){var ed2=E("qp-edit");if(ed2)ed2.classList.remove("open")}
 else if(a==="keyapply"){var K=parseKey(E("qp-keytxt").value),nk=Object.keys(K).length;if(!nk){msg("Cavab açarı oxunmadı. Nümunə: 56 D 57 B 58 E");return}var m=0;S.res.forEach(function(q){if(K[q.n]!=null&&K[q.n]<q.opts.length){q.correct=K[q.n];q.auto=1;m++}});msg("🔑 "+nk+" cavab oxundu, "+m+" sual işarələndi.");drawRes()}
 else if(a==="sync"){msg("Göndərilir…","qp-bmsg");ST.sync().then(function(n){msg("✅ "+n+" sual Supabase-ə göndərildi.","qp-bmsg");return load()}).catch(function(x){msg(RLS(x)?"Supabase hələ yazmağa icazə vermir — SQL-i işlədin.":"Xəta: "+x.message,"qp-bmsg")})}else if(a==="addall")addAll();
 else if(a==="oadd"){var o=obj(t);if(o.opts.length<8){o.opts.push("");redraw(t)}}
 else if(a==="odel"){var o2=obj(t),k=+t.dataset.o;o2.opts.splice(k,1);if(o2.correct===k)o2.correct=-1;else if(o2.correct>k)o2.correct--;redraw(t)}
 else if(a==="addone")addOne(+t.dataset.i);
 else if(a==="cancel"){if(confirm("Bütün nəticələr silinsin?")){S.res=[];drawRes();msg("")}}
 else if(a==="adj")adj(+t.dataset.i,t.dataset.e,t.dataset.d);
 else if(a==="rm"){var ri=+t.dataset.i;S.res.splice(ri,1);if(ri<S.rs)S.rs--;drawRes()}
 else if(a==="sel"){S.sel[t.dataset.id]=t.checked;e.stopPropagation();E("qp-cnt").textContent=filtered().length+" sual · seçilib: "+Object.keys(S.sel).filter(function(k){return S.sel[k]}).length;summary()}
 else if(a==="all"){var f=filtered(),on=!f.every(function(i){return S.sel[i.id]});f.forEach(function(i){S.sel[i.id]=on});drawBank()}
 else if(a==="pre"){E("qp-st").value=t.dataset.v;summary()}
 else if(a==="assign")assign();
 else if(a==="csave")csave();else if(a==="ctest")ctest();else if(a==="cmig")migrate();else if(a==="cstop"){S.mig=0;msg("Dayandırılır…","qp-cmsg")}
 else if(a==="psave"){var it=S.items.filter(function(x){return x.id===S.cur})[0];if(!it)return;it.num=+E("qp-pn").value||0;it.src=E("qp-ps").value;it.tag=E("qp-pt").value;
  ST.put(it).then(load).catch(function(x){msg("Xəta: "+x.message,"qp-bmsg")})}
 else if(a==="pdel"){if(S.cur&&confirm("Bu sual bankdan silinsin?"))ST.del(S.cur).then(function(){delete S.sel[S.cur];S.cur=null;return load()}).catch(function(x){msg("Xəta: "+x.message,"qp-bmsg")})}}
function onChange(e){var t=e.target,f=t.dataset&&t.dataset.f,o;
 if(f==="cs"){o=obj(t);o.correct=t.value===""?-1:+t.value;o.auto=0;drawRes();return}
 if(f==="cor"){o=obj(t);o.correct=+t.dataset.o;o.auto=0;if(t.dataset.c==="r"){drawRes();return}var w=E("qpw-"+t.dataset.c+(t.dataset.c==="r"?t.dataset.i:0));if(w)w.style.display="none";summary()}
 else if(f==="img"){o=obj(t);var fl=t.files[0];if(!fl)return;var rd=new FileReader(),c=t.dataset.c;rd.onload=function(){o.img=rd.result;o.cv=null;if(c==="r")drawRes();else{drawPrev();drawBank()}};rd.readAsDataURL(fl)}
 if(t.id==="qp-ft")drawBank();if(t.classList.contains("qp-cat"))summary()}

window.QPRO={open:async function(){hook();await ST.init();if(S.tab===2)load()},run:run};
var n=0,iv=setInterval(function(){build();hook();if(++n>200)clearInterval(iv)},3000);
build();hook();
})();
