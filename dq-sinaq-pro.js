/* DQ Sınaq Pro v2.0 — admin paneldə «Sınaq» papkası:
   fənn papkaları (Az dili · İnformatika · Məntiq · Qanunvericilik · Ümumi 100 sual),
   sual əlavə etmə: ŞƏKİL (1 və ya çox), PDF, COPY-PASTE → səliqəli sual + variantlar,
   sonra sınaq nömrəsi + kateqoriya seçib bazaya (exam_questions) yazmaq.
   index.html-də dq-pdf-pro.js-dən SONRA əlavə edin:  <script src="dq-sinaq-pro.js?v=2"></script> */
(function(){"use strict";
if(window.DQSQ)return;
var VERSION="2.0.0",LS_KEY="dq_gemini_key",LS_NOISE="dq_sq_noise";
var CATS=["BA","BB","AC","AB"];
var AZ="A-Za-zƏəİıÖöÜüÇçŞşĞğ",AZL="a-zəıöüçşğ",AZU="A-ZƏİÖÜÇŞĞ";
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function lsGet(k){try{return localStorage.getItem(k)||""}catch(e){return""}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}

/* ═════════ 1. PAPKALAR ═════════ */
function folders(){
  var F=[
    {id:"az",title:"Azərbaycan dili",icon:"🔤",start:1,end:15,max:5},
    {id:"info",title:"İnformatika",icon:"💻",start:56,end:70,max:5},
    {id:"logic",title:"Məntiq",icon:"🧩",start:71,end:100,max:5},
    {id:"law",title:"Qanunvericilik",icon:"⚖️",start:16,end:55,max:4},
    {id:"all",title:"Ümumi (100 sual)",icon:"📚",start:1,end:100,max:5}];
  try{if(typeof examStructure!=="undefined")examStructure.forEach(function(s){F.forEach(function(f){if(f.title===s.title){f.start=s.start;f.end=s.end}})})}catch(e){}
  return F;
}
function subjectOf(n){try{if(typeof getSubjectByNumber==="function")return getSubjectByNumber(n)}catch(e){}return"Ümumi"}

/* ═════════ 2. MƏTNİN TƏMİZLƏNMƏSİ ═════════ */
function upAz(c){return c.toLocaleUpperCase("az")}
function capFirst(s){var m=s.match(new RegExp("^([\"“«(\\[]*)(["+AZL+"])"));return m?s.slice(0,m[1].length)+upAz(m[2])+s.slice(m[0].length):s}
function cleanT(s){
  s=String(s==null?"":s);
  try{s=s.normalize("NFC")}catch(e){}
  s=s.replace(/[\u0305\u0304\u0332\u0333\u203e\ufffd]/g,"").replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g,"")
   .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000\t]/g," ").replace(/[\u2018\u2019\u201b`´]/g,"'")
   .replace(/[\u201c\u201d\u201e]/g,'"').replace(/ *[\u2014] */g," – ").replace(/(\s)-(\s)/g,"$1–$2").replace(/[ ]{2,}/g," ");
  s=s.replace(/\s+([,;?!)\]])/g,"$1").replace(/(\S)\s+([.:])(?=\s|$)/g,function(m,a,b){return(b===":"&&/\d/.test(a))?m:a+b}).replace(/([(\[])\s+/g,"$1");
  s=s.replace(new RegExp("([,;])(?=["+AZ+"])","g"),"$1 ").replace(new RegExp("(["+AZL+"]{2})([.?!])(?=["+AZU+"]["+AZL+"]|\\d\\s)","g"),"$1$2 ")
   .replace(new RegExp("(\\?|!)(?=["+AZ+"])","g"),"$1 ").replace(new RegExp("(["+AZL+"]{2}):(?=["+AZ+"])","g"),"$1: ");
  s=s.replace(new RegExp("(^|\\n)(\\d{1,2})\\.(?=["+AZ+"])","g"),"$1$2. ");
  return s.split("\n").map(function(x){return x.trim()}).join("\n").trim();
}
function extraNoise(){var t=lsGet(LS_NOISE);if(!t&&t!=="")t="";if(!lsGet(LS_NOISE)&&lsGet(LS_NOISE+"_init")!=="1")return["hasanov","lachin"];return t.split(",").map(function(x){return x.trim().toLowerCase()}).filter(Boolean)}
function isNoise(l){
  var t=l.trim();if(!t)return true;
  var an=t.replace(/[^0-9A-Za-zƏəİıÖöÜüÇçŞşĞğ]/g,"").length;
  if(an<2&&!/^\(?[A-E]\s*[).]/.test(t))return true;
  if(/^[-–—_=|.·•\s]{2,}$/.test(t))return true;
  if(/onlinetestyap|client\.|https?:\/\//i.test(t))return true;
  if(/^(Sayfa|Səhifə|Page)\s*\d+\s*(\/\s*\d+)?\s*$/i.test(t)||/Sayfa\s*\d+\s*\/\s*\d+/i.test(t))return true;
  if(/^\d{1,3}\s*\/\s*\d{1,3}$/.test(t))return true;
  if(/^(←\s*)?(Önceki|Sonraki|Bitir)\b/i.test(t)||/^v\d+\.\d+/i.test(t))return true;
  if(/^DÖVLƏT\s+QULLUĞU/i.test(t)&&t.length<70)return true;
  if(/sınaq\s+imtahan/i.test(t)&&/kateqoriya|üzrə/i.test(t)&&t.length<90)return true;
  var lo=t.toLowerCase(),ex=extraNoise();
  for(var i=0;i<ex.length;i++)if(lo.indexOf(ex[i])>=0&&t.length<40)return true;
  return false;
}

/* ═════════ 3. SUAL PARSERİ ═════════ */
function findMarkers(T){
  var out=[],m,re1=/(^|\s)\(?([A-E])\s?\)\s*/g,re2=/^([A-E])\.(?=\s|[^\d.])\s*/gm;
  while((m=re1.exec(T))){out.push({L:m[2],s:m.index+m[1].length,e:m.index+m[0].length});if(m[0].length===0)re1.lastIndex++}
  while((m=re2.exec(T))){out.push({L:m[1],s:m.index,e:m.index+m[0].length})}
  out.sort(function(a,b){return a.s-b.s||a.e-b.e});
  var ded=[];out.forEach(function(x){var p=ded[ded.length-1];if(p&&p.s===x.s)return;ded.push(x)});
  return ded;
}
function buildChains(M){
  var chains=[],cur=null;
  M.forEach(function(x){
    if(!cur){if(x.L==="A")cur=[x];return}
    var nxt=String.fromCharCode(cur[cur.length-1].L.charCodeAt(0)+1);
    if(x.L===nxt&&x.s>=cur[cur.length-1].e){cur.push(x);if(x.L==="E"){chains.push(cur);cur=null}}
    else if(x.L==="A"){if(cur.length>=2)chains.push(cur);cur=[x]}
  });
  if(cur&&cur.length>=2)chains.push(cur);
  return chains;
}
function candidates(T,from,to,skipFirst){
  var seg=T.slice(from,to),re=new RegExp("^(\\d{1,3})\\s*[.)]\\s*(?=\\S)","gm"),m,out=[];
  while((m=re.exec(seg))){
    if(skipFirst&&m.index===0)continue;
    var rest=seg.slice(m.index+m[0].length,m.index+m[0].length+40);
    if(/^\d/.test(rest)&&!new RegExp("^\\d+\\s+["+AZ+"]{3,}").test(rest))continue;
    if(/^[\d.\s]+$/.test(rest.split("\n")[0]))continue;
    out.push({n:+m[1],pos:from+m.index,len:m[0].length});
  }
  return out;
}
function joinLines(raw){
  var out=[];
  raw.split("\n").forEach(function(l){
    l=l.trim();if(!l)return;
    if(!out.length){out.push(l);return}
    var stmt=(/^\d{1,2}\s*[.)]\s*\S/.test(l)&&!/^\d{1,2}\s*[.)]\s*\d/.test(l))||/^(?:I{1,3}|IV|VI{0,3}|IX|X)\s*[.)]\s*\S/.test(l),bul=/^[•\-–]\s/.test(l);
    if(stmt||bul)out.push(l);
    else{var p=out[out.length-1];out[out.length-1]=p+(/[-\u00ad]$/.test(p)&&new RegExp("^["+AZL+"]").test(l)?"":" ")+l}
  });
  return out.join("\n");
}
function parse(text){
  var lines=String(text==null?"":text).replace(/\r/g,"").split("\n").map(function(l){return l.replace(/[\t\u00a0]+/g," ").trim()}).filter(function(l){return!isNoise(l)});
  var T=lines.join("\n"),chains=buildChains(findMarkers(T)),res=[],lastN=0,prevEnd=0,pendingFallback=false;
  for(var i=0;i<chains.length;i++){
    var ch=chains[i],first=ch[0],cs=candidates(T,prevEnd,first.s,i>0),cand=null,exp=i===0?1:lastN+1;
    if(i===0){cand=cs.filter(function(c){return c.n===1})[0]||cs[0]||null}
    else cand=cs.filter(function(c){return c.n===exp})[0]||cs.filter(function(c){return c.n>lastN&&c.n<=lastN+6})[0]||null;
    /* əvvəlki sualın son variantı: candidate-ə qədər */
    if(i>0){
      var prev=res[res.length-1],lastM=chains[i-1][chains[i-1].length-1];
      var endPos=cand?cand.pos:first.s;
      prev._lastRaw=T.slice(lastM.e,endPos);
    }
    var stemRaw=T.slice(cand?cand.pos+cand.len:(i===0?0:prevEnd),first.s);
    
    var n=cand?cand.n:exp;lastN=n;if(i===0&&!cand){var junk=stemRaw.split("\n");/* nömrəsiz başlanğıc: yalnız son sətirlər (sualın özü) saxlanır */stemRaw=junk.slice(Math.max(0,junk.length-6)).join("\n")}
    var opts=[];
    for(var k=0;k<ch.length;k++){
      var idx=ch[k].L.charCodeAt(0)-65;
      opts[idx]=k+1<ch.length?T.slice(ch[k].e,ch[k+1].s):null;
    }
    var q={n:n,stemRaw:stemRaw,optsRaw:opts,lastIdx:ch[ch.length-1].L.charCodeAt(0)-65,_lastStart:ch[ch.length-1].e};
    res.push(q);
    prevEnd=ch[ch.length-1].e;
  }
  /* sonuncu sualın son variantı */
  if(res.length){
    var lastQ=res[res.length-1],ls=lastQ._lastStart,nx=candidates(T,ls,T.length,false).filter(function(c){return c.n===lastQ.n+1})[0];
    lastQ._lastRaw=T.slice(ls,nx?nx.pos:T.length);
  }
  return res.map(function(q){
    var o=["","","","",""];
    q.optsRaw.forEach(function(t,i){if(t!=null)o[i]=t});
    o[q.lastIdx]=q._lastRaw||"";
    var key=-1,m=o[q.lastIdx].match(/(?:^|\s)(?:Cavab|Düzgün\s+cavab|Answer)\s*[:=\-–]?\s*\(?([A-E])\)?\s*$/i);
    if(m){key=m[1].toUpperCase().charCodeAt(0)-65;o[q.lastIdx]=o[q.lastIdx].slice(0,m.index)}
    return polish({n:q.n,stem:joinLines(q.stemRaw),opts:o.map(function(t){return joinLines(t).replace(/\n/g," ")}),correct:key});
  });
}
function polish(q){
  q.stem=cleanT(q.stem).split("\n").map(function(p,i){return i===0?capFirst(p):p}).join("\n");
  q.opts=q.opts.map(function(t){return cleanT(t).replace(/\n/g," ")});
  var sl=q.opts.filter(function(t){return t&&/\s/.test(t)&&new RegExp("^["+AZL+"]").test(t)});
  if(sl.length>=2||(sl.length&&sl.length>=q.opts.filter(Boolean).length/2))q.opts=q.opts.map(function(t){return t&&/\s|^.{4,}$/.test(t)?capFirst(t):t});
  var withDot=q.opts.filter(function(t){return/[^.]\.$/.test(t)}).length,nonEmpty=q.opts.filter(Boolean).length;
  if(withDot&&withDot<nonEmpty){
    if(withDot>=nonEmpty/2)q.opts=q.opts.map(function(t){return t&&!/[.!?…:]$/.test(t)&&/\s/.test(t)?t+".":t});
    else q.opts=q.opts.map(function(t){return t.replace(/([^.])\.$/,"$1")});
  }
  return q;
}

/* ═════════ 4. ŞƏKİLDƏN OXUMA (kəsmə, sütun ayırma, OCR / Gemini) ═════════ */
function loadImage(file){return new Promise(function(ok,no){
  var u=URL.createObjectURL(file),im=new Image();
  im.onload=function(){var s=Math.min(1,4200/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*s);c.height=Math.round(im.naturalHeight*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);ok(c)};
  im.onerror=function(){URL.revokeObjectURL(u);no(new Error("Şəkil açılmadı: "+file.name))};im.src=u})}
function sub(c,x,y,w,h,scale){
  var o=document.createElement("canvas");o.width=Math.max(1,Math.round(w*(scale||1)));o.height=Math.max(1,Math.round(h*(scale||1)));
  var x2=o.getContext("2d");x2.fillStyle="#fff";x2.fillRect(0,0,o.width,o.height);x2.drawImage(c,x,y,w,h,0,0,o.width,o.height);return o;
}
function longestRun(flags,gap){
  var best=[0,-1],s=-1,miss=0;
  for(var i=0;i<=flags.length;i++){
    var f=i<flags.length&&flags[i];
    if(f){if(s<0)s=i;miss=0;if(i-s>best[1]-best[0])best=[s,i]}
    else if(s>=0){miss++;if(miss>gap||i===flags.length){s=-1;miss=0}}
  }
  return best;
}
/* ekran görüntüsündən yalnız ağ «kağız» sahəsini kəsir (brauzer/menyu zolaqları atılır) */
function paperCrop(c){
  var sc=Math.min(1,700/c.width),a=sub(c,0,0,c.width,c.height,sc),W=a.width,H=a.height,d=a.getContext("2d").getImageData(0,0,W,H).data;
  var rows=new Array(H).fill(0);
  for(var y=0;y<H;y++){var n=0;for(var x=0;x<W;x++){var i=(y*W+x)*4;if(Math.min(d[i],d[i+1],d[i+2])>215)n++}rows[y]=n/W>=0.5}
  var r=longestRun(rows,8);if(r[1]-r[0]<H*0.25)return c;
  var cols=new Array(W).fill(0);
  for(var x2=0;x2<W;x2++){var m=0;for(var y2=r[0];y2<=r[1];y2++){var j=(y2*W+x2)*4;if(Math.min(d[j],d[j+1],d[j+2])>215)m++}cols[x2]=m/(r[1]-r[0]+1)>=0.5}
  var cc=longestRun(cols,8);if(cc[1]-cc[0]<W*0.3)cc=[0,W-1];
  var pad=Math.round(2/sc);
  var X=Math.max(0,Math.round(cc[0]/sc)+pad),Y=Math.max(0,Math.round(r[0]/sc)+pad),X2=Math.min(c.width,Math.round(cc[1]/sc)-pad),Y2=Math.min(c.height,Math.round(r[1]/sc)-pad);
  if(X2-X<50||Y2-Y<50)return c;
  return sub(c,X,Y,X2-X,Y2-Y,1);
}
/* iki sütunlu səhifəni sol/sağ sütuna bölür (şaquli xətt və filiqran nəzərə alınır) */
function splitColumns(c){
  var sc=Math.min(1,900/c.width),a=sub(c,0,0,c.width,c.height,sc),W=a.width,H=a.height,d=a.getContext("2d").getImageData(0,0,W,H).data;
  var y0=Math.round(H*0.15),y1=Math.round(H*0.85),ink=new Array(W).fill(0);
  for(var y=y0;y<y1;y++)for(var x=0;x<W;x++){var i=(y*W+x)*4;if(d[i]<150&&d[i+1]<150&&d[i+2]<150)ink[x]++}
  var band=y1-y0;
  for(var x2=2;x2<W-2;x2++){if(ink[x2]>band*0.6&&ink[x2-3<0?0:x2-3]<band*0.25&&ink[x2+3>=W?W-1:x2+3]<band*0.25)ink[x2]=0}
  var lo=Math.floor(W*0.36),hi=Math.ceil(W*0.64),sideL=0,sideR=0,k;
  for(k=0;k<lo;k++)sideL+=ink[k];for(k=hi;k<W;k++)sideR+=ink[k];
  sideL/=Math.max(1,lo);sideR/=Math.max(1,W-hi);
  if(sideL<band*0.02||sideR<band*0.02)return[c];
  var eps=Math.max(1,0.04*Math.min(sideL,sideR)),flags=[];
  for(k=lo;k<hi;k++)flags.push(ink[k]<=eps);
  var run=longestRun(flags,0);
  if(run[1]-run[0]+1<W*0.012)return[c];
  var mid=Math.round((lo+(run[0]+run[1])/2)/sc),cut=Math.max(4,Math.round(4/sc));
  var L=sub(c,0,0,mid-cut,c.height,1),R=sub(c,mid+cut,0,c.width-mid-cut,c.height,1);
  return[L,R];
}
/* boz filiqranı, rəngli ləkələri silir, mətni oxunaqlı edir və böyüdür */
function enhance(c){
  var s=Math.max(1,Math.min(3,1500/c.width)),o=sub(c,0,0,c.width,c.height,s),x=o.getContext("2d"),im=x.getImageData(0,0,o.width,o.height),p=im.data;
  for(var i=0;i<p.length;i+=4){var g=0.3*p[i]+0.59*p[i+1]+0.11*p[i+2],mx=Math.max(p[i],p[i+1],p[i+2]),mn=Math.min(p[i],p[i+1],p[i+2]);
    var v=(g<135&&mx-mn<90)?0:255;p[i]=p[i+1]=p[i+2]=v}
  x.putImageData(im,0,0);return o;
}
var worker=null;
async function ocrWorker(){
  if(worker)return worker;
  if(typeof window.__dqLibs==="function")await window.__dqLibs("ocr");
  if(!window.Tesseract)throw new Error("OCR kitabxanası yüklənmədi — internet bağlantısını yoxlayın");
  var w=await Tesseract.createWorker("aze+eng",1,{logger:function(m){if(m&&m.status==="recognizing text")prog(null,Math.round((m.progress||0)*100))}});
  try{await w.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"})}catch(e){}
  worker=w;return w;
}
async function ocrCanvas(c){
  var parts=splitColumns(paperCrop(c)),txt="",w=await ocrWorker();
  for(var i=0;i<parts.length;i++){var r=await w.recognize(enhance(parts[i]));txt+=(r.data.text||"")+"\n"}
  return txt;
}
function gKey(){return lsGet(LS_KEY)}
var G_PROMPT="Bu, Azərbaycan dilində test imtahanı sualları olan səhifənin şəklidir (ekran görüntüsü və ya skan). Səhifədəki BÜTÜN sualları və variantları oxu. QAYDALAR: 1) Səhifə iki sütunludursa əvvəl sol sütunu yuxarıdan aşağı, sonra sağ sütunu oxu. 2) Filiqran (böyük boz yazılar), səhifə başlığı/altlığı, brauzer və düymə yazıları (Önceki, Sonraki, Bitir, Sayfa) kimi test məzmununa aid olmayan hər şeyi at. 3) Birinci tam görünən sualdan başla, ondan əvvəl heç nə yazma. 4) Sual daxilindəki 1., 2., 3. kimi nömrələnmiş mülahizələri ayrıca sətirdə saxla. 5) Orfoqrafiya və durğu işarələrini düzəlt, mənanı, rəqəmləri və variantların sırasını dəyişmə. 6) Hər sualı sual nömrəsi ilə, variantları isə A) B) C) D) (varsa E)) ilə, hər birini yeni sətirdən yaz. Sualların arasında boş sətir burax. YALNIZ mətni qaytar, izah və markdown yazma.";
async function geminiImage(c){
  var key=gKey(),s=Math.min(1,2200/Math.max(c.width,c.height)),b=sub(c,0,0,c.width,c.height,s).toDataURL("image/jpeg",0.9).split(",")[1];
  var url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(key);
  var body={contents:[{parts:[{text:G_PROMPT},{inlineData:{mimeType:"image/jpeg",data:b}}]}],generationConfig:{temperature:0}};
  for(var t=0;t<3;t++){
    var r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(r.status===429||r.status>=500){await sleep(2500*(t+1));continue}
    var j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||("HTTP "+r.status));
    var parts=(((j.candidates||[])[0]||{}).content||{}).parts||[];
    return parts.map(function(p){return p.text||""}).join("").replace(/```[a-z]*/g,"").trim();
  }
  throw new Error("Gemini cavab vermədi (limit və ya server xətası)");
}
async function readCanvas(c){
  if(gKey()&&S.engine!=="ocr"){try{return await geminiImage(c)}catch(e){toast("Gemini işləmədi, OCR-a keçilir: "+e.message,"warn")}}
  return await ocrCanvas(c);
}

/* ═════════ 5. PDF-DƏN OXUMA ═════════ */
async function ensurePdf(){
  if(window.pdfjsLib&&pdfjsLib.getDocument)return;
  try{if(typeof window.__dqLibs==="function")await window.__dqLibs("pdf")}catch(e){}
  if(!(window.pdfjsLib&&pdfjsLib.getDocument)){
    await new Promise(function(ok,no){var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=ok;s.onerror=function(){no(new Error("pdf.js yüklənmədi"))};document.head.appendChild(s)});
  }
  if(pdfjsLib.GlobalWorkerOptions&&!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
function itemsToText(items,W){
  items=items.filter(function(it){return it.s&&it.s.trim()});
  if(!items.length)return"";
  var narrow=items.filter(function(it){return it.w<W*0.5}),cov=new Uint16Array(Math.ceil(W)+3),k;
  narrow.forEach(function(it){for(k=Math.max(0,Math.floor(it.x));k<=Math.min(cov.length-1,Math.ceil(it.x+it.w));k++)cov[k]++});
  var lo=Math.floor(W*0.35),hi=Math.ceil(W*0.65),flags=[];for(k=lo;k<hi;k++)flags.push(cov[k]===0);
  var run=longestRun(flags,0),mid=null;
  if(run[1]-run[0]+1>=6){
    var m=lo+(run[0]+run[1])/2,L=narrow.filter(function(it){return it.x+it.w/2<m}).length,R=narrow.length-L;
    if(L>=narrow.length*0.15&&R>=narrow.length*0.15)mid=m;
  }
  function colText(arr){
    arr.sort(function(a,b){return b.y-a.y||a.x-b.x});
    var hs=arr.map(function(i){return i.h}).filter(Boolean).sort(function(a,b){return a-b}),tol=Math.max(2,(hs[Math.floor(hs.length/2)]||10)*0.5),lines=[],cur=null;
    arr.forEach(function(it){if(!cur||Math.abs(cur.y-it.y)>tol){cur={y:it.y,its:[]};lines.push(cur)}cur.its.push(it)});
    return lines.map(function(l){l.its.sort(function(a,b){return a.x-b.x});var s="",px=null;
      l.its.forEach(function(it){if(px!=null&&it.x-px>1.2&&!/\s$/.test(s)&&!/^\s/.test(it.s))s+=" ";s+=it.s;px=it.x+it.w});return s}).join("\n");
  }
  if(mid==null)return colText(items.slice());
  var c0=[],c1=[];items.forEach(function(it){(it.w>=W*0.5||it.x+it.w/2<mid?c0:c1).push(it)});
  return colText(c0)+"\n"+colText(c1);
}
async function readPdf(file){
  await ensurePdf();
  var pdf=await pdfjsLib.getDocument(new Uint8Array(await file.arrayBuffer())).promise,all="";
  for(var p=1;p<=pdf.numPages;p++){
    prog("PDF səhifə "+p+" / "+pdf.numPages,Math.round((p-1)/pdf.numPages*100));
    var page=await pdf.getPage(p),vp=page.getViewport({scale:1}),tc=await page.getTextContent();
    var items=tc.items.map(function(it){return{s:it.str,x:it.transform[4],y:it.transform[5],w:it.width||0,h:it.height||Math.abs(it.transform[3])||10}});
    var txt=itemsToText(items,vp.width),bad=(txt.match(/[\ue000-\uf8ff\ufffd]/g)||[]).length;
    if(txt.replace(/\s/g,"").length<40||bad>txt.length*0.02){
      var rv=page.getViewport({scale:2.4}),cv=document.createElement("canvas");cv.width=rv.width;cv.height=rv.height;
      var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
      await page.render({canvasContext:cx,viewport:rv}).promise;
      txt=await readCanvas(cv);
    }
    all+=txt+"\n";
  }
  prog("",100);return all;
}

/* ═════════ 6. VƏZİYYƏT ═════════ */
var S={f:null,tab:"img",qs:[],uid:0,busy:false,seq:true,start:1,exams:"1",cats:["BB"],noAns:false,auto:true,engine:"auto",view:"home",ex:{exam:"1",cat:"BB",rows:null}};
function toast(msg,kind){
  var d=document.createElement("div");d.textContent=msg;
  d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:92vw;padding:11px 16px;border-radius:12px;font:600 14px system-ui;color:#fff;z-index:2147483000;box-shadow:0 8px 24px rgba(0,0,0,.3);background:"+(kind==="err"?"#dc2626":kind==="warn"?"#d97706":"#059669");
  document.body.appendChild(d);setTimeout(function(){d.remove()},kind==="err"?6000:3200);
}
function modal(title,body,okTxt,cancelTxt){
  return new Promise(function(ok){
    var o=document.createElement("div");o.style.cssText="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:16px";
    o.innerHTML='<div style="background:#fff;color:#0f172a;border-radius:16px;max-width:460px;width:100%;max-height:86vh;overflow:auto;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:inherit"><h3 style="margin:0 0 10px;font-size:18px">'+esc(title)+'</h3><div style="white-space:pre-line;font-size:14px;line-height:1.5;color:#334155">'+esc(body)+'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+(cancelTxt?'<button data-m="0" style="border:0;border-radius:10px;padding:10px 16px;font:700 14px inherit;background:#e2e8f0;cursor:pointer">'+esc(cancelTxt)+'</button>':'')+'<button data-m="1" style="border:0;border-radius:10px;padding:10px 16px;font:700 14px inherit;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;cursor:pointer">'+esc(okTxt||"OK")+'</button></div></div>';
    o.onclick=function(e){var b=e.target.closest("[data-m]");if(!b&&e.target!==o)return;o.remove();ok(b?b.dataset.m==="1":false)};
    document.body.appendChild(o);
  });
}
function ask(t,b,okT){return modal(t,b,okT||"Davam et","Ləğv et")}
function info(t,b){return modal(t,b,"Bağla",null)}
function prog(txt,pct){var t=$("sq-ptxt"),b=$("sq-pbar"),w=$("sq-prog");if(!w)return;w.style.display="block";if(txt!=null&&t)t.textContent=txt;if(pct!=null&&b)b.style.width=pct+"%"}
function mkQ(p){return Object.assign({id:++S.uid,n:0,stem:"",opts:["","","","",""],correct:-1},p)}
function rangeOf(){return S.f?[S.f.start,S.f.end]:[1,100]}
function finalNum(q,i){return S.seq?(+S.start||1)+i:q.n}
function warnings(q,i){
  var w=[],n=finalNum(q,i),r=rangeOf(),cnt=q.opts.filter(function(t){return t.trim()}).length;
  if(!q.stem.trim())w.push({k:"err",t:"Sual mətni boşdur"});
  if(cnt<2)w.push({k:"err",t:"Ən azı 2 variant olmalıdır"});
  else if(cnt<4)w.push({k:"warn",t:"Variant sayı azdır ("+cnt+")"});
  var firstEmpty=-1;q.opts.forEach(function(t,k){if(!t.trim()&&firstEmpty<0)firstEmpty=k});
  if(cnt>=2&&q.opts.slice(0,cnt).some(function(t){return!t.trim()}))w.push({k:"warn",t:"Boş variant var"});
  if(q.correct<0)w.push({k:"warn",t:"Düzgün cavab seçilməyib"});
  else if(!q.opts[q.correct].trim())w.push({k:"err",t:"Düzgün cavab boş variantdır"});
  if(n<r[0]||n>r[1])w.push({k:"err",t:"№"+n+" bu papkanın aralığından ("+r[0]+"–"+r[1]+") kənardadır"});
  return w;
}
function status(q,i){var w=warnings(q,i);return w.some(function(x){return x.k==="err"})?"err":w.length?"warn":"ok"}

/* ═════════ 7. İNTERFEYS ═════════ */
var CSS='.sq{font-family:inherit;color:#0f172a}.sq *{box-sizing:border-box}.sq h3{margin:0 0 6px;font-size:20px}.sq .sub{color:#64748b;font-size:13px;margin:0 0 14px}'+
'.sq-fg{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}'+
'.sq-fc{border:0;border-radius:16px;padding:18px 14px;color:#fff;text-align:left;cursor:pointer;font:700 15px inherit;box-shadow:0 6px 16px rgba(15,23,42,.18);transition:transform .12s}.sq-fc:active{transform:scale(.97)}.sq-fc span{display:block;font-size:28px;margin-bottom:6px}.sq-fc small{display:block;opacity:.85;font-weight:500;margin-top:3px}'+
'.sq-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.sq-b{border:0;border-radius:10px;padding:10px 14px;font:700 14px inherit;cursor:pointer;background:#e2e8f0;color:#0f172a}.sq-b.p{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}.sq-b.g{background:#059669;color:#fff}.sq-b.r{background:#fee2e2;color:#b91c1c}.sq-b:disabled{opacity:.5}'+
'.sq-tabs{display:flex;gap:6px;margin-bottom:12px}.sq-tabs button{flex:1;border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 6px;font:700 13px inherit;cursor:pointer}.sq-tabs button.on{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}'+
'.sq-drop{border:2px dashed #94a3b8;border-radius:16px;padding:22px 14px;text-align:center;cursor:pointer;background:#f8fafc}.sq-drop b{display:block;font-size:15px}.sq-drop span{font-size:12px;color:#64748b}'+
'.sq textarea,.sq input[type=text],.sq input[type=number]{width:100%;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:14px inherit;background:#fff;color:#0f172a}.sq textarea{resize:vertical;min-height:90px}'+
'#sq-prog{display:none;margin:12px 0}.sq-pb{height:8px;background:#e2e8f0;border-radius:6px;overflow:hidden}.sq-pb i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width .2s}#sq-ptxt{font-size:13px;color:#475569;margin-bottom:5px}'+
'.sq-card{border:1.5px solid #e2e8f0;border-left:5px solid #94a3b8;border-radius:14px;padding:12px;margin:10px 0;background:#fff}.sq-card.ok{border-left-color:#059669}.sq-card.warn{border-left-color:#d97706}.sq-card.err{border-left-color:#dc2626}'+
'.sq-ch{display:flex;gap:6px;align-items:center;margin-bottom:8px}.sq-ch input{width:70px!important}.sq-ch .sp{flex:1}.sq-ch button{border:0;border-radius:8px;padding:7px 10px;background:#e2e8f0;cursor:pointer;font-weight:700}'+
'.sq-o{display:flex;gap:8px;align-items:center;margin-top:6px}.sq-ol{flex:0 0 34px;height:34px;border-radius:50%;border:2.5px solid #0f2a5c;color:#0f2a5c;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff}.sq-ol.on{background:#0f2a5c;color:#fff}'+
'.sq-w{margin-top:8px;font-size:12px;border-radius:8px;padding:6px 9px}.sq-w.err{background:#fee2e2;color:#991b1b}.sq-w.warn{background:#fef3c7;color:#92400e}'+
'.sq-save{position:sticky;bottom:0;background:#fff;border-top:2px solid #e2e8f0;padding:12px 0;margin-top:14px}.sq-chip{display:inline-flex;align-items:center;gap:5px;border:1.5px solid #cbd5e1;border-radius:20px;padding:6px 12px;margin:3px 4px 3px 0;font-weight:700;font-size:13px;cursor:pointer}.sq-chip:has(input:checked){background:#2563eb;color:#fff;border-color:#2563eb}.sq-chip input{display:none}'+
'.sq-row{display:flex;gap:10px;flex-wrap:wrap}.sq-row>div{flex:1 1 150px}.sq label.l{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px}'+
'.sq-ex{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:6px 0;display:flex;gap:8px;align-items:flex-start;font-size:13px}.sq-ex b{flex:0 0 auto}.sq-ex .t{flex:1}';

function root(){return $("mod-sinaq")}
function render(){
  var r=root();if(!r)return;
  if(S.view==="home")return renderHome(r);
  renderFolder(r);
}
function renderHome(r){
  var colors=["#2563eb,#7c3aed","#0891b2,#0f766e","#d97706,#dc2626","#7c3aed,#db2777","#334155,#0f172a"];
  r.innerHTML='<div class="sq"><h3>📚 Sınaq</h3><p class="sub">Fənn papkasını seçin, sonra sualları şəkildən, PDF-dən və ya copy-paste ilə əlavə edin.</p><div class="sq-fg">'+
    folders().map(function(f,i){return'<button class="sq-fc" data-f="'+f.id+'" style="background:linear-gradient(135deg,'+colors[i%colors.length]+')"><span>'+f.icon+'</span>'+esc(f.title)+'<small>sual '+f.start+'–'+f.end+'</small></button>'}).join("")+'</div></div>';
  r.onclick=function(e){var b=e.target.closest("[data-f]");if(!b)return;S.f=folders().filter(function(f){return f.id===b.dataset.f})[0];S.start=S.f.start;S.qs=[];S.view="folder";S.tab="img";restoreDraft();render()};
}
function renderFolder(r){
  var f=S.f,key=gKey();
  r.innerHTML='<div class="sq"><div class="sq-bar"><button class="sq-b" data-a="home">← Papkalar</button><h3 style="margin:0">'+f.icon+' '+esc(f.title)+'</h3></div>'+
  '<div class="sq-tabs"><button data-t="img" class="'+(S.tab==="img"?"on":"")+'">🖼 Şəkil</button><button data-t="pdf" class="'+(S.tab==="pdf"?"on":"")+'">📄 PDF</button><button data-t="txt" class="'+(S.tab==="txt"?"on":"")+'">📋 Copy-Paste</button><button data-t="view" class="'+(S.tab==="view"?"on":"")+'">📂 Suallar</button></div>'+
  '<div id="sq-src"></div><div id="sq-prog"><div id="sq-ptxt"></div><div class="sq-pb"><i id="sq-pbar"></i></div></div><div id="sq-work"></div></div>';
  r.onclick=onClick;r.oninput=onInput;r.onchange=onChange;
  r.ondragover=function(e){if(S.tab==="img"||S.tab==="pdf"){e.preventDefault()}};
  r.ondrop=function(e){if(S.tab!=="img"&&S.tab!=="pdf")return;e.preventDefault();var fl=e.dataTransfer&&e.dataTransfer.files;if(fl&&fl.length)startFiles(fl)};
  renderSrc();renderWork();
}
function renderSrc(){
  var e=$("sq-src");if(!e)return;
  if(S.tab==="view"){e.innerHTML=viewHtml();return}
  var key=gKey(),h="";
  if(S.tab==="img")h='<div class="sq-drop" data-a="pick"><b>🖼 Sual şəkillərini seçin (1 və ya bir neçə)</b><span>Ekran görüntüsü və ya skan. 2 sütunlu səhifə, filiqran və brauzer zolağı avtomatik təmizlənir. Sual 1-dən başlayır.</span></div><input type="file" id="sq-file" accept="image/*" multiple style="display:none">';
  else if(S.tab==="pdf")h='<div class="sq-drop" data-a="pick"><b>📄 PDF faylını seçin</b><span>Mətnli və skan PDF dəstəklənir · 2 sütun avtomatik tanınır · oxuma 1-ci sualdan başlayır.</span></div><input type="file" id="sq-file" accept="application/pdf,.pdf" style="display:none">';
  else h='<label class="l">Sualları və variantları bura yapışdırın</label><textarea id="sq-txt" rows="9" placeholder="1. Sual mətni?\nA) variant\nB) variant\nC) variant\nD) variant"></textarea><div class="sq-bar" style="margin-top:8px"><button class="sq-b p" data-a="parse">Suallara ayır</button></div>';
  h+='<div class="sq-bar" style="margin-top:10px">'+(S.tab!=="txt"?'<select id="sq-eng" style="padding:9px;border-radius:10px;border:1.5px solid #cbd5e1"><option value="auto"'+(S.engine==="auto"?" selected":"")+'>Mühərrik: Avto (Gemini varsa)</option><option value="ocr"'+(S.engine==="ocr"?" selected":"")+'>Yalnız OCR</option></select>':"")+
    '<button class="sq-b" data-a="key">🔑 Gemini açarı'+(key?" ✓":"")+'</button><button class="sq-b" data-a="noise">🧹 Süzgəc sözləri</button></div>';
  e.innerHTML=h;
}
function renderWork(){
  var w=$("sq-work");if(!w)return;saveDraft();
  if(S.tab==="view"){w.innerHTML="";return}
  if(!S.qs.length){w.innerHTML="";return}
  var r=rangeOf(),ok=0,wn=0,er=0;S.qs.forEach(function(q,i){var s=status(q,i);if(s==="ok")ok++;else if(s==="warn")wn++;else er++});
  var h='<div class="sq-bar" style="margin-top:14px"><b>'+S.qs.length+' sual tanındı</b><span style="color:#059669">✅ '+ok+'</span><span style="color:#d97706">⚠ '+wn+'</span><span style="color:#dc2626">⛔ '+er+'</span><span class="sp" style="flex:1"></span>'+
   '<button class="sq-b" data-a="ai">✨ Qrammatik yoxla</button><button class="sq-b" data-a="dups">♻️ Təkrarları sil</button><button class="sq-b r" data-a="clear">Təmizlə</button></div>'+
   '<div class="sq-row" style="margin-bottom:8px"><div><label class="l">Nömrələmə</label><label class="sq-chip"><input type="checkbox" id="sq-seq"'+(S.seq?" checked":"")+'>Ardıcıl nömrələ</label></div><div><label class="l">Başlanğıc sual №</label><input type="number" id="sq-start" value="'+esc(S.start)+'" min="1" max="100"></div></div>'+
   '<details style="margin-bottom:8px"><summary style="cursor:pointer;font-weight:700;font-size:13px">🗝 Cavab açarını toplu yapışdır (məs: 1-A 2-C 3-B və ya ACBD…)</summary><textarea id="sq-key" rows="2" placeholder="1-A 2-C 3-B …"></textarea><button class="sq-b" data-a="applykey" style="margin-top:6px">Tətbiq et</button></details>';
  h+=S.qs.map(function(q,i){return cardHtml(q,i)}).join("");
  h+='<div class="sq-save"><div class="sq-row"><div style="flex:1 1 200px"><label class="l">Sınaq nömrəsi (bir neçə: 1,2)</label><input type="text" id="sq-exams" value="'+esc(S.exams)+'" inputmode="numeric"></div><div style="flex:2 1 220px"><label class="l">Kateqoriya</label>'+
   CATS.map(function(c){return'<label class="sq-chip"><input type="checkbox" data-cat="'+c+'"'+(S.cats.indexOf(c)>=0?" checked":"")+'>'+c+'</label>'}).join("")+'</div></div>'+
   '<label class="sq-chip" style="margin-top:6px"><input type="checkbox" id="sq-noans"'+(S.noAns?" checked":"")+'>Cavabı seçilməyənləri də yüklə (sonra Redaktə Mərkəzində təyin edin)</label>'+
   '<div class="sq-bar" style="margin-top:8px"><button class="sq-b g" data-a="save" id="sq-savebtn" style="flex:1">⬆ Sınağa yüklə ('+(S.qs.length-er)+')</button></div></div>';
  w.innerHTML=h;
}
function cardHtml(q,i){
  var st=status(q,i),ws=warnings(q,i),L="ABCDE",max=S.f&&S.f.max||5;
  var h='<div class="sq-card '+st+'" data-i="'+i+'"><div class="sq-ch"><b>№</b><input type="number" data-f="n" value="'+finalNum(q,i)+'"'+(S.seq?" disabled":"")+'><span class="sp"></span><button data-a="up">↑</button><button data-a="down">↓</button><button data-a="del" style="background:#fee2e2;color:#b91c1c">✕</button></div>'+
   '<textarea data-f="stem" rows="3">'+esc(q.stem)+'</textarea>';
  for(var k=0;k<max;k++)h+='<div class="sq-o"><div class="sq-ol'+(q.correct===k?" on":"")+'" data-a="ok" data-k="'+k+'" title="Düzgün cavab">'+L[k]+'</div><input type="text" data-f="o'+k+'" value="'+esc(q.opts[k]||"")+'" placeholder="'+L[k]+' variantı'+(k===4?" (əgər varsa)":"")+'"></div>';
  h+=ws.map(function(w){return'<div class="sq-w '+w.k+'">'+(w.k==="err"?"⛔ ":"⚠ ")+esc(w.t)+'</div>'}).join("")+'</div>';
  return h;
}
function refreshCard(i){
  var c=document.querySelector('.sq-card[data-i="'+i+'"]');if(!c)return;
  var q=S.qs[i],st=status(q,i);c.className="sq-card "+st;
  c.querySelectorAll(".sq-w").forEach(function(x){x.remove()});
  warnings(q,i).forEach(function(w){var d=document.createElement("div");d.className="sq-w "+w.k;d.textContent=(w.k==="err"?"⛔ ":"⚠ ")+w.t;c.appendChild(d)});
  c.querySelectorAll(".sq-ol").forEach(function(o,k){o.classList.toggle("on",q.correct===k)});
}

/* ═════════ 8. HADİSƏLƏR ═════════ */
function onClick(e){
  var t=e.target.closest("[data-a],[data-t]");if(!t)return;
  if(t.dataset.t){S.tab=t.dataset.t;if(S.tab==="view")S.ex.rows=null;renderSrc();renderWork();document.querySelectorAll(".sq-tabs button").forEach(function(b){b.classList.toggle("on",b.dataset.t===S.tab)});return}
  var a=t.dataset.a,card=t.closest(".sq-card"),i=card?+card.dataset.i:-1;
  switch(a){
    case"home":S.view="home";render();break;
    case"pick":var f=$("sq-file");if(f){f.onchange=function(){startFiles(f.files);f.value=""};f.click()}break;
    case"parse":var tx=$("sq-txt").value;if(!tx.trim())return toast("Mətn boşdur","warn");addParsed(parse(tx));maybeAuto();break;
    case"key":var k=prompt("Gemini API açarı (saytdakı Ağıllı oxuyucu ilə eyni):",gKey());if(k!=null){lsSet(LS_KEY,k.trim());renderSrc()}break;
    case"noise":var cur=lsGet(LS_NOISE+"_init")==="1"?lsGet(LS_NOISE):"Hasanov,Lachin",v=prompt("Sualdan silinəcək söz/ifadələr (vergüllə). Filiqran, ad-soyad və s.:",cur);if(v!=null){lsSet(LS_NOISE,v);lsSet(LS_NOISE+"_init","1")}break;
    case"clear":ask("Siyahı təmizlənsin?","Tanınmış "+S.qs.length+" sual silinəcək.","Təmizlə").then(function(y){if(y){S.qs=[];clearDraft();renderWork()}});break;
    case"dups":dedupe();break;
    case"ai":runAI();break;
    case"applykey":applyKey();break;
    case"up":if(i>0){S.qs.splice(i-1,0,S.qs.splice(i,1)[0]);renderWork()}break;
    case"down":if(i<S.qs.length-1){S.qs.splice(i+1,0,S.qs.splice(i,1)[0]);renderWork()}break;
    case"del":S.qs.splice(i,1);renderWork();break;
    case"ok":var q=S.qs[i],k2=+t.dataset.k;q.correct=q.correct===k2?-1:k2;refreshCard(i);break;
    case"save":doSave();break;
    case"vload":loadView();break;
    case"vdel":delView(+t.dataset.id);break;
  }
}
function onInput(e){
  var t=e.target;
  if(t.id==="sq-start"){S.start=+t.value||1;renderWork();return}
  if(t.id==="sq-exams"){S.exams=t.value;return}
  if(t.id==="sq-vexam"){S.ex.exam=t.value;return}
  var card=t.closest&&t.closest(".sq-card");if(!card||!t.dataset.f)return;
  var i=+card.dataset.i,q=S.qs[i],f=t.dataset.f;
  if(f==="stem")q.stem=t.value;else if(f==="n")q.n=+t.value||0;else if(/^o\d$/.test(f))q.opts[+f[1]]=t.value;
  saveDraft();refreshCard(i);
}
function onChange(e){
  var t=e.target;
  if(t.id==="sq-seq"){S.seq=t.checked;renderWork()}
  else if(t.id==="sq-noans")S.noAns=t.checked;
  else if(t.id==="sq-eng")S.engine=t.value;
  else if(t.id==="sq-vcat")S.ex.cat=t.value;
  else if(t.dataset&&t.dataset.cat){S.cats=[].map.call(document.querySelectorAll("[data-cat]:checked"),function(x){return x.dataset.cat})}
}

/* ═════════ 9. QARALAMA (təsadüfən bağlansa, itməsin) ═════════ */
var DK="dq_sq_draft_v2",dTimer=0;
function readDrafts(){try{return JSON.parse(lsGet(DK)||"{}")||{}}catch(e){return{}}}
function saveDraft(){clearTimeout(dTimer);dTimer=setTimeout(function(){if(!S.f)return;var d=readDrafts();if(S.qs.length)d[S.f.id]={qs:S.qs,seq:S.seq,start:S.start,exams:S.exams,cats:S.cats,t:Date.now()};else delete d[S.f.id];lsSet(DK,JSON.stringify(d))},400)}
function clearDraft(){if(!S.f)return;var d=readDrafts();delete d[S.f.id];lsSet(DK,JSON.stringify(d))}
function restoreDraft(){
  var d=readDrafts()[S.f.id];if(!d||!d.qs||!d.qs.length||Date.now()-d.t>14*864e5)return;
  S.qs=d.qs;S.seq=d.seq!==false;S.start=d.start||S.f.start;S.exams=d.exams||S.exams;S.cats=d.cats&&d.cats.length?d.cats:S.cats;
  S.uid=S.qs.reduce(function(m,q){return Math.max(m,q.id||0)},S.uid);
  toast("Yarımçıq qaralama bərpa olundu ("+S.qs.length+" sual)","warn");
}
function maybeAuto(){if(S.auto&&gKey()&&S.qs.some(function(q){return!q.ai}))runAI(true)}

/* ═════════ 9b. İMPORT AXINI ═════════ */
function addParsed(list){
  if(!list.length){toast("Sual tapılmadı. Format: «1. Sual», «A) …», «B) …»","warn");return}
  var max=S.f&&S.f.max||5;
  list.forEach(function(p){var q=mkQ(p);if(max<5)q.opts[4]="";S.qs.push(q)});
  S.qs.forEach(function(q){if(q.opts.length<5)while(q.opts.length<5)q.opts.push("")});
  toast(list.length+" sual tanındı — yoxlayıb yükləyin","ok");
  renderWork();var w=$("sq-work");if(w&&w.scrollIntoView)w.scrollIntoView({behavior:"smooth"});
}
async function startFiles(files){
  if(S.busy||!files||!files.length)return;
  var all=[].slice.call(files),isPdf=function(f){return/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)};
  var pdfs=all.filter(isPdf),imgs=all.filter(function(f){return/^image\//.test(f.type)||/\.(png|jpe?g|webp|bmp|gif|heic)$/i.test(f.name)});
  if(!pdfs.length&&!imgs.length)return toast("Yalnız şəkil və ya PDF faylı seçin","warn");
  var usePdf=S.tab==="pdf"?pdfs.length>0:(!imgs.length&&pdfs.length>0);
  if(usePdf)S.tab="pdf";else S.tab="img";
  if(S.tab==="pdf"&&!pdfs.length)return toast("PDF faylı seçilməyib","warn");
  if(S.tab==="img"&&!imgs.length)return toast("Şəkil seçilməyib","warn");
  S.busy=true;
  var list=(S.tab==="pdf"?pdfs:imgs).sort(function(a,b){return a.name.localeCompare(b.name,undefined,{numeric:true})});
  var txt="";
  try{
    if(S.tab==="pdf"){txt=await readPdf(list[0])}
    else for(var i=0;i<list.length;i++){
      prog("Şəkil "+(i+1)+" / "+list.length+" oxunur…",Math.round(i/list.length*100));
      var c=await loadImage(list[i]);txt+=(await readCanvas(c))+"\n";
    }
    prog("Suallara ayrılır…",100);
    addParsed(parse(txt));
    if(!S.qs.length)window._dqsqLastText=txt;
  }catch(e){console.error(e);toast("Oxuma xətası: "+(e.message||e),"err")}
  S.busy=false;var w=$("sq-prog");if(w)setTimeout(function(){w.style.display="none"},800);
  maybeAuto();
}
function dedupe(){
  var seen={},before=S.qs.length;
  S.qs=S.qs.filter(function(q){var k=(q.stem+"|"+q.opts.join("|")).toLowerCase().replace(/\s+/g,"");if(seen[k])return false;seen[k]=1;return true});
  toast((before-S.qs.length)+" təkrar silindi","ok");renderWork();
}
function applyKey(){
  var t=($("sq-key").value||"").toUpperCase(),map={},m,re=/(\d{1,3})\s*[-.:)=]?\s*([A-E])/g,cnt=0;
  while((m=re.exec(t)))map[+m[1]]=m[2].charCodeAt(0)-65;
  if(Object.keys(map).length){S.qs.forEach(function(q,i){var n=finalNum(q,i),loc=i+1,v=map[n]!=null?map[n]:map[loc];if(v!=null){q.correct=v;cnt++}})}
  else{var seq=t.replace(/[^A-E]/g,"");seq.split("").forEach(function(ch,i){if(S.qs[i]){S.qs[i].correct=ch.charCodeAt(0)-65;cnt++}})}
  toast(cnt+" sualın cavabı təyin edildi","ok");renderWork();
}
var AI_P="Sən Azərbaycan dili üzrə peşəkar redaktor-korrektorsan. Aşağıdakı test sualları JSON formatındadır. Hər sual üçün YALNIZ orfoqrafiya, qrammatika, durğu işarələri, böyük/kiçik hərf və OCR-dan yaranmış hərf səhvlərini düzəlt. Mənanı, rəqəmləri, xüsusi adları, sətir bölgülərini və variantların sırasını DƏYİŞMƏ. YALNIZ JSON qaytar: {\"items\":[{\"i\":0,\"stem\":\"...\",\"options\":[\"...\"]}]}. Variantların sayı eyni olmalıdır.";
function nums(t){return(String(t).match(/\d+/g)||[]).join(",")}
async function runAI(onlyNew){
  var key=gKey();if(!key)return toast("Əvvəlcə «🔑 Gemini açarı» düyməsi ilə açarı daxil edin","warn");
  if(S.busy)return;S.busy=true;var fixed=0,pool=S.qs.filter(function(q){return!onlyNew||!q.ai});
  try{
    for(var s=0;s<pool.length;s+=8){
      var chunk=pool.slice(s,s+8),payload=chunk.map(function(q,k){return{i:k,stem:q.stem,options:q.opts.filter(function(x){return x.trim()})}});
      prog("Qrammatik yoxlama "+Math.min(s+8,pool.length)+" / "+pool.length,Math.round(s/pool.length*100));
      var url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(key),res=null;
      for(var t=0;t<3&&!res;t++){
        var r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:AI_P+"\n\n"+JSON.stringify({items:payload})}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}})});
        if(r.status===429||r.status>=500){await sleep(2500*(t+1));continue}
        var j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"HTTP "+r.status);
        var txt=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(function(p){return p.text||""}).join("").replace(/```json|```/g,"").trim();
        try{res=JSON.parse(txt).items||[]}catch(e){}
      }
      chunk.forEach(function(q){q.ai=true});
      (res||[]).forEach(function(x){
        var q=chunk[x.i];if(!q||typeof x.stem!=="string"||!Array.isArray(x.options))return;
        var cur=q.opts.filter(function(v){return v.trim()});
        if(x.options.length!==cur.length||nums(x.stem)!==nums(q.stem)||x.options.some(function(o,k){return nums(o)!==nums(cur[k])}))return;
        if(x.stem.length<q.stem.length*0.6||x.stem.length>q.stem.length*1.5)return;
        var idx=0;q.stem=x.stem;q.opts=q.opts.map(function(v){return v.trim()?String(x.options[idx++]):v});fixed++;
      });
    }
    toast("Qrammatik yoxlama bitdi — "+fixed+" sual düzəldildi","ok");
  }catch(e){toast("Gemini xətası: "+e.message,"err")}
  S.busy=false;var w=$("sq-prog");if(w)w.style.display="none";renderWork();
}

/* ═════════ 10. BAZAYA YAZMA ═════════ */
function db(){return typeof _supabase!=="undefined"?_supabase:window._supabase}
async function doSave(){
  var exams=String(S.exams).split(/[\s,;]+/).filter(function(x){return/^\d+$/.test(x)}),cats=S.cats.slice();
  if(!exams.length)return toast("Sınaq nömrəsini yazın","warn");
  if(!cats.length)return toast("Ən azı bir kateqoriya seçin","warn");
  var ready=S.qs.map(function(q,i){return{q:q,i:i}}).filter(function(x){var s=status(x.q,x.i);if(s==="err")return false;if(x.q.correct<0&&!S.noAns)return false;return true});
  var skipped=S.qs.length-ready.length;
  if(!ready.length)return toast("Yüklənə bilən sual yoxdur — xətaları düzəldin","err");
  var nums={},dup=false;ready.forEach(function(x){var n=finalNum(x.q,x.i);if(nums[n])dup=true;nums[n]=1});
  if(dup)return toast("Təkrar sual nömrələri var — nömrələri düzəldin","err");
  var noAns=ready.filter(function(x){return x.q.correct<0}).length;
  var msg=ready.length+" sual yüklənəcək"+(skipped?" ("+skipped+" xətalı/cavabsız sual atılacaq)":"")+".\n• Sınaq "+exams.join(", ")+" · "+cats.join(", ")+" · "+S.f.title+"\n"+(noAns?"• "+noAns+" sualın düzgün cavabı seçilməyib (sonra təyin etməlisiniz)\n":"")+"Eyni nömrəli suallar yenilənəcək. Davam edilsin?";
  if(!await ask("Sınağa yükləmə",msg,"⬆ Yüklə"))return;
  var btn=$("sq-savebtn");if(btn)btn.disabled=true;
  try{
    var total=exams.length*cats.length,done=0,out=[];
    for(var e=0;e<exams.length;e++)for(var c=0;c<cats.length;c++){
      done++;if(btn)btn.textContent="Yazılır "+done+"/"+total+"…";
      var ex=await db().from("exam_questions").select("id,q_number").eq("exam_id",exams[e]).eq("category",cats[c]);
      if(ex.error)throw ex.error;
      var by={};(ex.data||[]).forEach(function(r){by[r.q_number]=r.id});
      var ins=[],upd=[];
      ready.forEach(function(x){
        var n=finalNum(x.q,x.i),opts=x.q.opts.map(function(t){return t.trim()}),last=opts.length;while(last>0&&!opts[last-1])last--;
        var row={exam_id:exams[e],category:cats[c],q_number:n,subject:subjectOf(n),question:x.q.stem.trim(),options:opts.slice(0,last),correct:x.q.correct};
        if(by[n]!=null){var ur=Object.assign({},row);delete ur.exam_id;delete ur.category;delete ur.q_number;upd.push({id:by[n],row:ur})}else{row.image_url=null;ins.push(row)}
      });
      for(var s=0;s<ins.length;s+=15){var r1=await db().from("exam_questions").insert(ins.slice(s,s+15));if(r1.error)throw r1.error}
      for(var u=0;u<upd.length;u++){var r2=await db().from("exam_questions").update(upd[u].row).eq("id",upd[u].id);if(r2.error)throw r2.error}
      var vr=await db().from("exam_questions").select("q_number").eq("exam_id",exams[e]).eq("category",cats[c]).in("q_number",ready.map(function(x){return finalNum(x.q,x.i)}));
      if(vr.error)throw vr.error;
      if((vr.data||[]).length<ready.length)throw new Error("Yoxlama uğursuz: Sınaq "+exams[e]+" · "+cats[c]+" üçün "+ready.length+" sualdan yalnız "+(vr.data||[]).length+" bazada görünür");
      out.push("Sınaq "+exams[e]+" · "+cats[c]+": "+ins.length+" yeni, "+upd.length+" yenilənmiş ✓ bazada təsdiqləndi");
      try{if(typeof V2!=="undefined"&&V2.put)await V2.put("exams",{no:+exams[e],created:new Date().toISOString()})}catch(er){}
    }
    S.qs=[];clearDraft();renderWork();await info("✅ Yükləmə tamamlandı",out.join("\n"));
  }catch(err){console.error(err);await info("❌ Xəta",(err.message||JSON.stringify(err))+"\nYazılmış hissə qismən ola bilər; yenidən cəhd edə bilərsiniz (eyni nömrəli suallar yenilənir).")}
  if(btn){btn.disabled=false}
}

/* ═════════ 11. PAPKADAKI SUALLAR ═════════ */
function viewHtml(){
  var f=S.f,h='<div class="sq-row"><div><label class="l">Sınaq №</label><input type="text" id="sq-vexam" value="'+esc(S.ex.exam)+'" inputmode="numeric"></div><div><label class="l">Kateqoriya</label><select id="sq-vcat" style="width:100%;padding:9px;border-radius:10px;border:1.5px solid #cbd5e1">'+CATS.map(function(c){return'<option'+(c===S.ex.cat?" selected":"")+'>'+c+'</option>'}).join("")+'</select></div></div><div class="sq-bar" style="margin-top:8px"><button class="sq-b p" data-a="vload">Suallara bax ('+f.start+'–'+f.end+')</button></div>';
  if(S.ex.rows){var have={};S.ex.rows.forEach(function(r){have[r.q_number]=1});var miss=[];for(var mn=f.start;mn<=f.end;mn++)if(!have[mn])miss.push(mn);h+='<p class="sub" style="margin-top:10px"><b>'+S.ex.rows.length+' / '+(f.end-f.start+1)+'</b> sual yüklənib'+(miss.length&&miss.length<=60?' · çatışmayan №: '+miss.join(', '):(miss.length?' · '+miss.length+' sual çatışmır':' · ✅ tam'))+'</p>'}
  if(S.ex.rows)h+=S.ex.rows.length?S.ex.rows.map(function(r){return'<div class="sq-ex"><b>'+r.q_number+'</b><div class="t">'+esc(String(r.question||"").slice(0,160))+'</div><button class="sq-b r" data-a="vdel" data-id="'+r.id+'">✕</button></div>'}).join(""):'<p class="sub">Bu papkada sual yoxdur.</p>';
  return h;
}
async function loadView(){
  try{
    var f=S.f,r=await db().from("exam_questions").select("id,q_number,question").eq("exam_id",String(S.ex.exam).trim()).eq("category",S.ex.cat).gte("q_number",f.start).lte("q_number",f.end).order("q_number",{ascending:true});
    if(r.error)throw r.error;S.ex.rows=r.data||[];renderSrc();
  }catch(e){toast("Yüklənmədi: "+(e.message||e),"err")}
}
async function delView(id){
  if(!await ask("Sual silinsin?","Bu əməliyyat geri qaytarılmır.","Sil"))return;
  try{var r=await db().from("exam_questions").delete().eq("id",id);if(r.error)throw r.error;S.ex.rows=S.ex.rows.filter(function(x){return x.id!==id});renderSrc()}catch(e){toast("Silinmədi: "+(e.message||e),"err")}
}

/* ═════════ 12. ADMİN PANELƏ QOŞULMA ═════════ */
function ensure(){
  var panel=$("admin-panel");if(!panel)return false;
  if(!$("sq-css")){var st=document.createElement("style");st.id="sq-css";st.textContent=CSS;document.head.appendChild(st)}
  if(!$("mod-sinaq")){var d=document.createElement("div");d.id="mod-sinaq";d.className="admin-module-block";panel.appendChild(d)}
  var grid=panel.querySelector(".admin-nav-grid");
  if(grid&&!grid.querySelector("[data-sq-card]")){
    var c=document.createElement("div");c.className="admin-nav-card";c.setAttribute("data-sq-card","1");c.setAttribute("onclick","DQSQ.open()");
    c.style.cssText="background:linear-gradient(135deg,#059669,#0891b2);color:#fff";c.innerHTML='<span class="icon">📚</span> Sınaq — Sual Bankı (fənn papkaları)';
    grid.appendChild(c);
  }
  return true;
}
window.DQSQ={
  version:VERSION,
  open:function(){
    ensure();
    try{if(typeof switchAdminTab==="function")switchAdminTab("sinaq");else{document.querySelectorAll(".admin-module-block").forEach(function(b){b.style.display="none"});$("mod-sinaq").style.display="block"}}catch(e){console.error(e)}
    S.view="home";render();
  },
  _t:{parse:parse,cleanT:cleanT,isNoise:isNoise,itemsToText:itemsToText,joinLines:joinLines}
};
if(typeof document!=="undefined"){
  document.addEventListener("paste",function(e){
    if(S.view!=="folder"||S.tab!=="img"||!$("mod-sinaq")||$("mod-sinaq").offsetParent===null)return;
    var it=e.clipboardData&&e.clipboardData.files;if(it&&it.length){var im=[].filter.call(it,function(f){return/^image\//.test(f.type)});if(im.length){e.preventDefault();startFiles(im)}}
  });
  var n=0,iv=setInterval(function(){try{ensure()}catch(e){}if(++n>40)clearInterval(iv)},250);
  setInterval(function(){try{ensure()}catch(e){}},2000);
}
})();
