/* DQ PDF Pro v1.0 — PDF-dən sual idxalı, canlı redaktə + ön baxış, ümumi sual bazası, sınaq PDF-i.
   index.html-də app.js-dən SONRA əlavə edin:  <script src="dq-pdf-pro.js?v=1"></script> */
(function(){"use strict";
if(window.DQPP)return;
/* ═══════════════ 1. KÖMƏKÇİLƏR ═══════════════ */
var VERSION="1.0.0";
var CATS=["BA","BB","AC","AB"];
var LS_KEY="dq_gemini_key";
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function subjectOf(n){try{if(typeof getSubjectByNumber==="function")return getSubjectByNumber(n)}catch(e){}return"Ümumi"}
function subjectList(){try{if(typeof examStructure!=="undefined"&&examStructure.length)return examStructure.map(function(s){return s.title}).concat(["Ümumi"])}catch(e){}return["Azərbaycan dili","Qanunvericilik","İnformatika","Məntiq","Ümumi"]}
function toast(msg,kind){
  var d=document.createElement("div");d.className="pp-toast"+(kind?" "+kind:"");d.textContent=msg;
  document.body.appendChild(d);setTimeout(function(){d.classList.add("out")},3200);setTimeout(function(){d.remove()},3700);
}
var UP_AZ=function(s){return s.toLocaleUpperCase("az")};

/* ═══════════════ 2. MƏTNİN AVTOMATİK TƏMİZLƏNMƏSİ ═══════════════ */
var AZ_LOW="a-zəıöüçşğ",AZ_UP="A-ZƏİÖÜÇŞĞ";
function cleanInline(s){
  s=String(s==null?"":s);
  try{s=s.normalize("NFC")}catch(e){}
  s=s.replace(/[\u0305\u0304\u0332\u0333\u203e\ufffd]/g,"")                 /* sürüşmüş üst xətt və s. */
     .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g,"")
     .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000\t]/g," ")
     .replace(/[\u2018\u2019\u201b]/g,"'")
     .replace(/ *[\u2014] */g," – ")
     .replace(/(\s)-(\s)/g,"$1–$2")
     .replace(/[ ]{2,}/g," ");
  /* durğu işarəsindən əvvəlki boşluq (rəqəm:rəqəm nisbətləri istisna) */
  s=s.replace(/\s+([,;?!)\]])/g,"$1")
     .replace(/(\S)\s+([.:])(?=\s|$)/g,function(m,a,b){return(b===":"&&/\d/.test(a))?m:a+b})
     .replace(/([(\[])\s+/g,"$1");
  /* durğu işarəsindən sonra boşluq */
  s=s.replace(new RegExp("([,;])(?=["+AZ_LOW+AZ_UP+"])","g"),"$1 ")
     .replace(new RegExp("(["+AZ_LOW+"]{2})([.?!])(?=["+AZ_UP+"]["+AZ_LOW+"])","g"),"$1$2 ");
  return s.trim();
}
function capFirst(s){
  var m=s.match(new RegExp("^([\"“«(\\[]*)(["+AZ_LOW+"])(["+AZ_LOW+"]{2,})(?![A-Za-z0-9ƏəİıÖöÜüÇçŞşĞğ])"));
  if(!m)return s;
  return m[1]+UP_AZ(m[2])+m[3]+s.slice(m[0].length);
}
function isSentenceLike(t){return t.length>=10||/\s/.test(t)}
function polishOptions(opts){
  var sl=opts.filter(function(o){return isSentenceLike(o.t)&&!o.img||isSentenceLike(o.t)});
  if(sl.length>=Math.max(2,Math.ceil(opts.length/2))){
    opts.forEach(function(o){if(isSentenceLike(o.t))o.t=capFirst(o.t)});
    var withDot=sl.filter(function(o){return/[^.]\.$/.test(o.t)}).length;
    if(withDot&&withDot<sl.length){
      if(withDot>=sl.length/2)opts.forEach(function(o){if(isSentenceLike(o.t)&&!/[.!?…:]$/.test(o.t))o.t+="."});
      else opts.forEach(function(o){o.t=o.t.replace(/([^.])\.$/,"$1")});
    }
  }
}
function polishStem(stem){
  return stem.split("\n").map(function(p,i){p=cleanInline(p);return i===0?capFirst(p):p}).join("\n");
}

/* ═══════════════ 3. BARMAQ İZİ (təkrar və "istifadə olunub" üçün) ═══════════════ */
function normFp(s){
  return String(s==null?"":s).replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").toLocaleLowerCase("az").replace(/[^\p{L}\p{N}]+/gu,"");
}
function hash53(str){
  var h1=0xdeadbeef,h2=0x41c6ce57,i,ch;
  for(i=0;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(h2>>>0).toString(16).padStart(8,"0")+(h1>>>0).toString(16).padStart(8,"0");
}
function optText(o){return o&&typeof o==="object"?(o.text!=null?o.text:o.t):o}
function fingerprint(stem,opts){
  return hash53(normFp(stem)+"|"+(opts||[]).map(function(o){return normFp(optText(o))}).join("|"));
}

/* ═══════════════ 4. PDF.JS HAZIRLIĞI ═══════════════ */
async function ensurePdfLib(){
  if(window.pdfjsLib&&pdfjsLib.getDocument)return;
  try{if(typeof window.__dqLibs==="function")await window.__dqLibs("pdf")}catch(e){}
  if(!(window.pdfjsLib&&pdfjsLib.getDocument)){
    await new Promise(function(ok,no){
      var s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload=ok;s.onerror=function(){no(new Error("pdf.js yüklənmədi \u2014 internet bağlantısını yoxlayın"))};
      document.head.appendChild(s);
    });
  }
  if(pdfjsLib.GlobalWorkerOptions&&!pdfjsLib.GlobalWorkerOptions.workerSrc)
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* ═══════════════ 5. SƏHİFƏNİN OXUNMASI ═══════════════ */
function mulm(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
function bboxThrough(m,x0,y0,x1,y1){
  var xs=[],ys=[];[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].forEach(function(p){xs.push(m[0]*p[0]+m[2]*p[1]+m[4]);ys.push(m[1]*p[0]+m[3]*p[1]+m[5])});
  return{x0:Math.min.apply(0,xs),y0:Math.min.apply(0,ys),x1:Math.max.apply(0,xs),y1:Math.max.apply(0,ys)};
}
/* pdf.js 3.x və 4+ üçün path sərhədi */
function pathBox(a,O){
  if(a&&a[2]&&typeof a[2].length==="number"&&a[2].length>=4&&typeof a[2][0]==="number")return[a[2][0],a[2][1],a[2][2],a[2][3]];
  if(a&&Array.isArray(a[0])&&a[1]){
    var ops=a[0],co=a[1],j=0,xs=[],ys=[];
    for(var i=0;i<ops.length;i++){
      var o=ops[i];
      if(o===O.moveTo||o===O.lineTo){xs.push(co[j]);ys.push(co[j+1]);j+=2}
      else if(o===O.curveTo){xs.push(co[j],co[j+2],co[j+4]);ys.push(co[j+1],co[j+3],co[j+5]);j+=6}
      else if(o===O.curveTo2||o===O.curveTo3){xs.push(co[j],co[j+2]);ys.push(co[j+1],co[j+3]);j+=4}
      else if(o===O.rectangle){xs.push(co[j],co[j]+co[j+2]);ys.push(co[j+1],co[j+1]+co[j+3]);j+=4}
    }
    if(xs.length)return[Math.min.apply(0,xs),Math.min.apply(0,ys),Math.max.apply(0,xs),Math.max.apply(0,ys)];
  }
  return null;
}
async function readGraphics(page,vt){
  var ol=await page.getOperatorList(),O=pdfjsLib.OPS,fn=ol.fnArray,ar=ol.argsArray,out=[];
  var ctm=vt.slice(),stack=[],pend=null,paint={},img={};
  ["stroke","closeStroke","fill","eoFill","fillStroke","eoFillStroke","closeFillStroke","closeEOFillStroke"].forEach(function(n){if(O[n]!=null)paint[O[n]]=1});
  ["paintImageXObject","paintInlineImageXObject","paintImageMaskXObject","paintSolidColorImageMask","paintJpegXObject"].forEach(function(n){if(O[n]!=null)img[O[n]]=1});
  function addPath(b,m){if(!b)return;var r=bboxThrough(m,b[0],b[1],b[2],b[3]);r.k="p";out.push(r)}
  for(var i=0;i<fn.length;i++){
    var f=fn[i],a=ar[i];
    if(f===O.save)stack.push(ctm.slice());
    else if(f===O.restore){if(stack.length)ctm=stack.pop()}
    else if(f===O.transform)ctm=mulm(ctm,a);
    else if(O.paintFormXObjectBegin!=null&&f===O.paintFormXObjectBegin){stack.push(ctm.slice());if(a&&a[0])ctm=mulm(ctm,a[0])}
    else if(O.paintFormXObjectEnd!=null&&f===O.paintFormXObjectEnd){if(stack.length)ctm=stack.pop()}
    else if(f===O.constructPath){
      if(a&&Array.isArray(a[0]))pend={b:pathBox(a,O),m:ctm.slice()};         /* 3.x: boyama ayrıca əmrdir */
      else if(a&&paint[a[0]])addPath(pathBox(a,O),ctm);                      /* 4+: boyama daxildədir */
      else pend=null;
    }
    else if(paint[f]){if(pend)addPath(pend.b,pend.m);pend=null}
    else if(O.endPath!=null&&f===O.endPath)pend=null;
    else if(img[f]){var r=bboxThrough(ctm,0,0,1,1);r.k="i";out.push(r)}
  }
  return out;
}

function groupLines(items){
  items=items.slice().sort(function(a,b){return a.y-b.y||a.x-b.x});
  var lines=[];
  items.forEach(function(it){
    var L=lines[lines.length-1];
    if(L&&Math.abs(it.y-L.y)<=Math.max(2.2,L.h*.45)){L.items.push(it);L.h=Math.max(L.h,it.h)}
    else lines.push({y:it.y,h:it.h,items:[it]});
  });
  lines.forEach(function(L){
    L.items.sort(function(a,b){return a.x-b.x});
    var t="",prev=null,x0=1e9,x1=-1e9;
    L.items.forEach(function(it){
      if(prev){
        var gap=it.x-(prev.x+prev.w),hh=Math.max(prev.h,it.h);
        if(gap>hh*2.4)t+="\t";else if(gap>hh*.18&&!/\s$/.test(t)&&!/^\s/.test(it.s))t+=" ";
      }
      t+=it.s;prev=it;x0=Math.min(x0,it.x);x1=Math.max(x1,it.x+it.w);
    });
    L.text=t.replace(/[ ]+$/,"").replace(/(^|[\s\t])([A-E])\s\)/g,"$1$2)");L.x0=x0;L.x1=x1;L.top=L.y-L.h;L.bot=L.y+L.h*.25;
  });
  return lines.filter(function(L){return L.text.trim()});
}
function detectGutter(items,W,figs){
  var narrow=items.filter(function(i){return i.w<W*.45});
  var fg=(figs||[]).filter(function(f){return f.x1-f.x0<W*.45});
  if(narrow.length+fg.length<6)return null;
  var N=Math.ceil(W)+2,cov=new Uint16Array(N);
  function mark(a,b){a=Math.max(0,Math.floor(a));b=Math.min(N-1,Math.ceil(b));for(var k=a;k<=b;k++)cov[k]++}
  narrow.forEach(function(i){mark(i.x,i.x+i.w)});fg.forEach(function(f){mark(f.x0,f.x1)});
  var lo=Math.floor(W*.3),hi=Math.ceil(W*.7),best=null,run=null;
  for(var k=lo;k<=hi;k++){
    if(cov[k]<=2){if(!run)run={s:k,e:k};else run.e=k}
    else{if(run&&(!best||run.e-run.s>best.e-best.s))best=run;run=null}
  }
  if(run&&(!best||run.e-run.s>best.e-best.s))best=run;
  if(!best||best.e-best.s<5)return null;
  var g=(best.s+best.e)/2,l=0,r=0;
  narrow.forEach(function(i){(i.x+i.w/2<g)?l++:r++});fg.forEach(function(f){((f.x0+f.x1)/2<g)?l++:r++});
  if(l<3||r<3)return null;
  return g;
}

/* Başlıq / titul sətirləri \u2014 sual mətninə qarışmasın */
var HEADER_RES=[
  /(?:^|\s)aid\s+test(?:\s+tapşırıqları)?\s*$/i,
  /^tapşırıqları\s*$/i,
  /test\s+tapşırıqları\s*$/i,
  /^\d{1,2}\.\d{1,2}\.\d{4}\b.{0,40}$/,
  /^(?:sual\s*)?bank[ıi]?\s*$/i
];
function isHeaderLine(t){t=t.replace(/\t/g," ").trim();if(t.length>90)return false;return HEADER_RES.some(function(r){return r.test(t)})}

var PAIR_LINE=/^\s*(?:\d{1,3}\s*[-–:.)=]?\s*[A-Ea-e]\s*[,;]?\s*)+$/;
function pageIsKey(items,lines){
  var toks=items.filter(function(i){return i.s.trim()});
  if(toks.length<10)return false;
  var ok=toks.filter(function(i){return/^(\d{1,3}|[A-Ea-e]|\d{1,3}\s*[-–.):]?\s*[A-Ea-e])$/.test(i.s.trim())}).length;
  var nums=toks.filter(function(i){return/^\d{1,3}$/.test(i.s.trim())||/^\d{1,3}\s*[-–.):]?\s*[A-Ea-e]$/.test(i.s.trim())}).length;
  if(ok/toks.length>=.85&&nums>=6)return true;
  var pl=lines.filter(function(L){return PAIR_LINE.test(L.text.replace(/\t/g," "))}).length;
  var pairs=0;lines.forEach(function(L){var m=L.text.match(/\d{1,3}\s*[-–:.)=]?\s*[A-Ea-e](?![A-Za-zƏəİıÖöÜüÇçŞşĞğ])/g);if(m&&PAIR_LINE.test(L.text.replace(/\t/g," ")))pairs+=m.length});
  return lines.length>0&&pl/lines.length>=.8&&pairs>=8;
}

async function readPage(page,pn,opt){
  var vp=page.getViewport({scale:1}),W=vp.width,H=vp.height,vt=vp.transform;
  var tc=await page.getTextContent(),items=[];
  tc.items.forEach(function(it){
    if(typeof it.str!=="string"||!it.str.length)return;
    var tr=it.transform,x=vt[0]*tr[4]+vt[2]*tr[5]+vt[4],y=vt[1]*tr[4]+vt[3]*tr[5]+vt[5];
    var h=Math.abs(it.height)||Math.hypot(tr[2],tr[3])||10;
    if(!it.str.trim())return;
    items.push({s:it.str,x:x,y:y,w:Math.abs(it.width),h:h});
  });
  var pg={pn:pn,W:W,H:H,items:items,gfx:[],figs:[],isKey:false,lines:[]};
  var flat=groupLines(items);
  pg.isKey=pageIsKey(items,flat);
  if(pg.isKey)return pg;
  /* qrafik elementlər → klasterlər */
  pg.raw=[];
  if(opt.figures){try{pg.raw=sanitizeRects(await readGraphics(page,vt),pg);pg.figs=buildFigs(pg.raw,pg)}catch(e){console.warn("[DQPP] qrafik oxunmadı",e)}}
  var rest=items.filter(function(it){return!it.hdr&&(/^(?:[A-E]\s?\)\s*)+$/.test(it.s.trim())||!pg.figs.some(function(f){return f.has(it)}))});
  var gut=detectGutter(rest,W,pg.figs);
  var groups=gut!=null?[rest.filter(function(i){return i.x+i.w/2<gut}),rest.filter(function(i){return i.x+i.w/2>=gut})]:[rest];
  var colBounds=gut!=null?[[0,gut],[gut,W]]:[[0,W]];
  groups.forEach(function(g,ci){
    groupLines(g).forEach(function(L){L.col=ci;L.page=pn;L.t="line";pg.lines.push(L)});
  });
  /* şəkilləri sütunlara bölüşdür */
  pg.figs.forEach(function(f){
    var cx=(f.x0+f.x1)/2,ci=0;
    if(gut!=null)ci=cx<gut?0:1;
    f.col=ci;f.page=pn;f.t="fig";f.top=f.y0;f.bot=f.y1;
  });
  pg.cols=colBounds.length;pg.colBounds=colBounds;
  return pg;
}

/* qrafik klasterləri */
function sanitizeRects(rects,pg){
  var W=pg.W,H=pg.H;
  return rects.filter(function(r){
    var w=r.x1-r.x0,h=r.y1-r.y0;
    if(w<0.5&&h<0.5)return false;
    if(w>W*.82&&h>H*.45)return false;                    /* fon düzbucaqlısı */
    if(r.x1<0||r.y1<0||r.x0>W||r.y0>H)return false;
    if((w<2.5&&h>H*.3)||(h<2.5&&w>W*.4))return false;      /* sütun xətləri, haşiyələr */
    return true;
  });
}
function buildFigs(rects,pg){
  var W=pg.W,H=pg.H;
  var G=14,n=rects.length,par=[];for(var i=0;i<n;i++)par[i]=i;
  function find(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x]}return x}
  for(var a=0;a<n;a++)for(var b=a+1;b<n;b++){
    var A=rects[a],B=rects[b];
    if(A.x0-G<=B.x1&&B.x0-G<=A.x1&&A.y0-G<=B.y1&&B.y0-G<=A.y1){var ra=find(a),rb=find(b);if(ra!==rb)par[ra]=rb}
  }
  var cl={};for(i=0;i<n;i++){var r=find(i);(cl[r]=cl[r]||[]).push(rects[i])}
  var out=[];
  Object.keys(cl).forEach(function(k){
    var rs=cl[k],bb={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9},bigImg=false,paths=0;
    rs.forEach(function(r){
      bb.x0=Math.min(bb.x0,r.x0);bb.y0=Math.min(bb.y0,r.y0);bb.x1=Math.max(bb.x1,r.x1);bb.y1=Math.max(bb.y1,r.y1);
      if(r.k==="i"){var w=r.x1-r.x0,h=r.y1-r.y0;if(Math.min(w,h)>=24&&Math.max(w,h)>=40)bigImg=true}else paths++;
    });
    var w=bb.x1-bb.x0,h=bb.y1-bb.y0,area=w*h;
    var sig=bigImg||paths>=3||(paths>=2&&area>2500);
    if(!sig)return;
    if(w>W*.9)return;                                      /* bütün səhifə eni \u2014 bəzək xətti */
    bb.bigImg=bigImg;bb.n=rs.length;out.push(bb);
  });
  /* başlıq qutularını at; etiketləri (qısa mətn) şəklə qat */
  var items=pg.items,final=[];
  out.forEach(function(f){
    var inside=items.filter(function(it){var cy=it.y-it.h*.35,cx=it.x+it.w/2;return cx>=f.x0-1&&cx<=f.x1+1&&cy>=f.y0-1&&cy<=f.y1+1});
    var txt=inside.map(function(i){return i.s}).join(" ").trim();
    var lines=groupLines(inside),isBanner=!f.bigImg&&f.n<=3&&lines.length>=1&&lines.length<=2&&(f.y1-f.y0)<46&&txt.length<=90;
    if(!f.bigImg&&txt&&(isHeaderLine(txt)||isBanner)){inside.forEach(function(i){i.hdr=true});return}
    final.push(f);
  });
  final.forEach(function(f){
    for(var it=0;it<2;it++){
      items.forEach(function(i){
        var s=i.s.trim();
        if(s.length>4||/^[A-E][).]?$/.test(s))return;
        if(items.some(function(j){return j!==i&&Math.abs(j.y-i.y)<i.h*.5&&j.s.trim().length>4&&!(j.x+j.w/2>=f.x0&&j.x+j.w/2<=f.x1&&j.y-j.h*.35>=f.y0&&j.y-j.h*.35<=f.y1)}))return;
        var cy=i.y-i.h*.35,cx=i.x+i.w/2,m=14;
        if(cx>=f.x0-m&&cx<=f.x1+m&&cy>=f.y0-m&&cy<=f.y1+m){
          f.x0=Math.min(f.x0,i.x-1);f.x1=Math.max(f.x1,i.x+i.w+1);f.y0=Math.min(f.y0,i.y-i.h);f.y1=Math.max(f.y1,i.y+i.h*.3);
        }
      });
    }
    f.has=function(i){var cy=i.y-i.h*.35,cx=i.x+i.w/2;return cx>=f.x0-1&&cx<=f.x1+1&&cy>=f.y0-1&&cy<=f.y1+1};
  });
  /* üst-üstə düşən klasterləri birləşdir */
  final.sort(function(a,b){return a.y0-b.y0});
  var merged=[];
  final.forEach(function(f){
    var p=merged[merged.length-1];
    if(p&&f.x0<=p.x1&&p.x0<=f.x1&&f.y0<=p.y1){
      p.x0=Math.min(p.x0,f.x0);p.x1=Math.max(p.x1,f.x1);p.y1=Math.max(p.y1,f.y1);p.bigImg=p.bigImg||f.bigImg;
      var o=p.has,o2=f.has;p.has=function(i){return o(i)||o2(i)};
    }else merged.push(f);
  });
  return merged;
}

/* ═══════════════ 6. CAVAB AÇARI ═══════════════ */
function parseKey(pages){
  var map={},count=0,dups=[];
  function add(n,l){l=l.toUpperCase();if(map[n]&&map[n]!==l){dups.push(n);return}if(!map[n]){map[n]=l;count++}}
  pages.forEach(function(pg){
    if(!pg.isKey)return;
    var N=[],L=[];
    pg.items.forEach(function(i){
      var t=i.s.trim(),cy=i.y-i.h*.35,m;
      if(/^\d{1,3}$/.test(t))N.push({n:+t,x:i.x,cy:cy,h:i.h});
      else if(/^[A-Ea-e]$/.test(t))L.push({l:t,x:i.x,cy:cy});
      else if((m=t.match(/^(\d{1,3})\s*[-–.):]?\s*([A-Ea-e])$/)))add(+m[1],m[2]);
      else if(PAIR_LINE.test(t)){var re=/(\d{1,3})\s*[-–:.)=]?\s*([A-Ea-e])/g,q;while((q=re.exec(t)))add(+q[1],q[2])}
    });
    N.sort(function(a,b){return a.cy-b.cy||a.x-b.x});
    N.forEach(function(n){
      var best=null;
      L.forEach(function(l){
        if(l.used)return;var dy=Math.abs(l.cy-n.cy);if(dy>n.h*.9)return;var dx=l.x-n.x;if(dx<-2)return;
        var sc=dx+dy*4;if(!best||sc<best.sc)best={l:l,sc:sc};
      });
      if(best){best.l.used=true;add(n.n,best.l.l)}
    });
    /* satır-hizalama uğursuz olarsa: sütun üzrə sıra ilə cütləş */
    var un=N.filter(function(n){return map[n.n]==null}),ul=L.filter(function(l){return!l.used});
    if(un.length&&un.length===ul.length){
      un.sort(function(a,b){return a.x-b.x||a.cy-b.cy});ul.sort(function(a,b){return a.x-b.x||a.cy-b.cy});
      un.forEach(function(n,i){add(n.n,ul[i].l)});
    }
  });
  return{map:map,count:count,dups:dups};
}

/* ═══════════════ 7. SUALLARIN AYRILMASI ═══════════════ */
function lineQ(e){var m=e.text.replace(/\t/g," ").match(/^\s*(\d{1,3})\s*[.)]\s*(\S.*)$/);if(!m)return null;var rest=m[2];
  if(/^\d{1,2}\.\d{2,4}\b/.test(rest)||rest.length<3)return null;return{n:+m[1],rest:rest}}
function blockText(stream,i0,i1){var t=[];for(var i=i0;i<i1;i++)if(stream[i].t==="line")t.push(stream[i].text);return t.join("\n")}
function hasOptions(txt){return/(^|\s)A\)/.test(txt)&&/(^|\s)B\)/.test(txt)}
function pickStarts(stream,strict){
  var cands=[];stream.forEach(function(e,i){if(e.t!=="line")return;var q=lineQ(e);if(q)cands.push({i:i,n:q.n})});
  var best=[];
  for(var f=0;f<cands.length;f++){
    var chain=[cands[f]],exp=cands[f].n+1;
    for(var k=f+1;k<cands.length;k++){
      var c=cands[k];
      if(c.n!==exp)continue;
      if(strict&&!hasOptions(blockText(stream,chain[chain.length-1].i,c.i)))continue;
      chain.push(c);exp++;
    }
    if(chain.length>best.length)best=chain;
    if(best.length>=cands.length-f)break;
  }
  return best;
}
function splitStatements(text){
  /* "1. A 2. B 3. C" → ayrı sətirlər */
  var re=/(^|\s)(\d{1,2}|[a-e])\.\s+(?=\S)/g,m,marks=[];
  while((m=re.exec(text)))marks.push({v:m[2],s:m.index+m[1].length});
  if(marks.length<2)return[text];
  var seq=true;
  for(var i=1;i<marks.length;i++){
    var a=marks[i-1].v,b=marks[i].v;
    if(/\d/.test(a)?(+b!==+a+1):(b.charCodeAt(0)!==a.charCodeAt(0)+1)){seq=false;break}
  }
  if(!seq)return[text];
  var out=[],pre=text.slice(0,marks[0].s).trim();if(pre)out.push(pre);
  marks.forEach(function(mk,i){out.push(text.slice(mk.s,i+1<marks.length?marks[i+1].s:undefined).trim())});
  return out;
}
var STMT_RE=/^(?:\d{1,2}|[a-e])\.\s+\S|^[•·\u25cf\u25aa\u25a0•\uf0b7\uf0a7]\s*\S|^[IVX]{1,4}[.)]\s+\S/;
function joinWrapped(a,b){
  if(/[A-Za-zƏəİıÖöÜüÇçŞşĞğ]-$/.test(a)&&/^[a-zəıöüçşğ]/.test(b))return a.slice(0,-1)+b;
  return a+" "+b;
}
function flowStem(lines){
  var paras=[],cur="",curStmt=false,prevBot=null,lh=12;
  function push(){if(cur.trim())paras.push(cur.trim());cur=""}
  lines.forEach(function(L){
    var parts=L.text.split("\t").join(" ");
    splitStatements(parts).forEach(function(seg,si){
      seg=seg.replace(/^[•·\uf0b7\uf0a7\u25cf\u25aa\u25a0]\s*/,"• ");
      var isStmt=STMT_RE.test(seg);
      var gap=(si===0&&prevBot!=null)?L.top-prevBot:0;
      if(!cur){cur=seg;curStmt=isStmt}
      else if(isStmt||si>0){push();cur=seg;curStmt=isStmt}
      else if(curStmt&&/[.?!;:]$/.test(cur)&&/^[A-ZƏİÖÜÇŞĞ0-9"“]/.test(seg)){push();cur=seg;curStmt=false}
      else if(gap>lh*1.1&&/[.?!:]$/.test(cur)){push();cur=seg;curStmt=false}
      else cur=joinWrapped(cur,seg);
    });
    prevBot=L.bot;lh=Math.max(8,L.h);
  });
  push();
  return paras.join("\n");
}
function findOptionChain(full){
  var re=/(^|\s)([A-E])\)/g,m,marks=[];
  while((m=re.exec(full)))marks.push({L:m[2],s:m.index+m[1].length,e:re.lastIndex});
  var best=null;
  for(var i=0;i<marks.length;i++){
    if(marks[i].L!=="A")continue;
    var chain=[marks[i]],nx="B";
    for(var j=i+1;j<marks.length&&nx<="E";j++){if(marks[j].L===nx){chain.push(marks[j]);nx=String.fromCharCode(nx.charCodeAt(0)+1)}}
    if(chain.length>=2&&(!best||chain.length>=best.length))best=chain;
  }
  return best;
}
function oneLine(seg){
  var parts=seg.split("\n").map(function(s){return s.replace(/\t/g," ").trim()}).filter(Boolean),t="";
  parts.forEach(function(p,i){t=i?joinWrapped(t,p):p});
  return t.replace(/\s{2,}/g," ").trim();
}

var PUA=/[\ue000-\uf8ff\u25a0-\u25ff\u2b1a\u2b1b\u2b1c]/g;
var BULLET_PUA=/[\uf0b7\uf0a7\u25cf\u25aa\u25a0]/g;
function hasPUA(t){return/[\ue000-\uf8ff\u25a1-\u25ff\u2b1a-\u2b1c]/.test(String(t||"").replace(BULLET_PUA,""))}
function meaningful(t){return String(t||"").replace(PUA,"").replace(/\s+/g,"").length>0}
var OVERLINE=/[\u0305\u0304\u0332\u0333\u203e]/;
function colOf(pg,ci){return pg.colBounds[Math.min(ci,pg.colBounds.length-1)]}
function cropOf(pg,ci,T,B,trim){
  var cb=colOf(pg,ci);
  return{page:pg.pn,x0:Math.max(0,cb[0]+1),x1:Math.min(pg.W,cb[1]-1),y0:Math.max(0,T-3),y1:Math.min(pg.H,B+3),trim:!!trim};
}
function parseBlock(block,ctx){
  var lines=block.filter(function(e){return e.t==="line"}),figs=block.filter(function(e){return e.t==="fig"});
  if(!lines.length)return null;
  var qm=lineQ(lines[0]),number=qm?qm.n:0,flags=[];
  var work=lines.map(function(L,i){var o={text:L.text,top:L.top,bot:L.bot,h:L.h,page:L.page,col:L.col};if(i===0&&qm)o.text=qm.rest;return o});
  function textOf(ws){return ws.map(function(L){return L.text}).join("\n")}
  var full=textOf(work),chain=findOptionChain(full),opts=[],stem,crops=[],gopt=false;
  if(OVERLINE.test(full))flags.push("overline");
  function rawOpts(ch,txt){return ch.map(function(mk,k){return oneLine(txt.slice(mk.e,k+1<ch.length?ch[k+1].s:undefined))})}
  if(chain){
    var rt=rawOpts(chain,full),good=rt.filter(meaningful).length;
    gopt=chain.length>=3&&(good<=chain.length-2||rt.some(hasPUA));
  }
  var oi=chain?(full.slice(0,chain[0].s).match(/\n/g)||[]).length:-1;
  if(gopt){
    /* variantlar şəkildir: seçimlər boş qalır, variant sahəsi şəkilə daxil edilir */
    var ol=work[oi],pg0=ctx.pages[ol.page],last=work[work.length-1];
    var grp={};figs.forEach(function(f){var k=f.page+":"+f.col;(grp[k]=grp[k]||{page:f.page,col:f.col,figs:[]}).figs.push(f)});
    var ok=ol.page+":"+ol.col;(grp[ok]=grp[ok]||{page:ol.page,col:ol.col,figs:[]}).opt={top:ol.top,bot:Math.max.apply(0,work.filter(function(L,ix){return ix>=oi&&L.page===ol.page&&L.col===ol.col}).map(function(L){return L.bot}))};
    Object.keys(grp).forEach(function(k){
      var g=grp[k],pg=ctx.pages[g.page],cb=colOf(pg,g.col),T=1e9,B=-1e9;
      g.figs.forEach(function(f){T=Math.min(T,f.y0);B=Math.max(B,f.y1)});
      var inCol=function(r){var cx=(r.x0+r.x1)/2;return cx>=cb[0]-2&&cx<=cb[1]+2};
      if(g.opt){
        var stemBot=-1e9;
        work.forEach(function(L,ix){if(ix<oi&&L.page===g.page&&L.col===g.col)stemBot=Math.max(stemBot,L.bot)});
        g.figs.forEach(function(f){if(f.y1<=g.opt.top+2)stemBot=Math.max(stemBot,f.y1)});
        T=Math.min(T,g.opt.top);B=Math.max(B,g.opt.bot);
        pg.raw.forEach(function(r){if(inCol(r)&&r.y0>=stemBot-1&&r.y0<g.opt.top+4)T=Math.min(T,r.y0)});
        var limit=(ctx.nextTop&&ctx.nextPage===g.page&&ctx.nextCol===g.col)?ctx.nextTop-2:pg.H;
        for(var pass=0;pass<3;pass++)pg.raw.forEach(function(r){if(inCol(r)&&r.y0>=T-1&&r.y0<limit&&r.y1>B)B=Math.min(r.y1,limit)});
      }
      crops.push(cropOf(pg,g.col,T,B,true));
    });
    stem=flowStem(work.slice(0,oi));
    for(var n=0;n<chain.length;n++)opts.push({t:"",img:null});
    flags.push("gopt");
  }else{
    var fg={};
    figs.forEach(function(f){var k=f.page+":"+f.col,g=fg[k];if(!g)fg[k]=g={page:f.page,x0:f.x0,x1:f.x1,y0:f.y0,y1:f.y1};else{g.x0=Math.min(g.x0,f.x0);g.x1=Math.max(g.x1,f.x1);g.y0=Math.min(g.y0,f.y0);g.y1=Math.max(g.y1,f.y1)}});
    Object.keys(fg).forEach(function(k){var g=fg[k],pg=ctx.pages[g.page];crops.push({page:g.page,x0:Math.max(0,g.x0-2),x1:Math.min(pg.W,g.x1+2),y0:Math.max(0,g.y0-2),y1:Math.min(pg.H,g.y1+2),trim:false})});
    var sl;
    if(chain){
      var stemText=full.slice(0,chain[0].s);sl=work.slice(0,oi);
      var partial=stemText.slice(stemText.lastIndexOf("\n")+1);
      if(partial.trim())sl.push({text:partial,top:work[oi].top,bot:work[oi].bot,h:work[oi].h});
      rawOpts(chain,full).forEach(function(t){opts.push({t:t,img:null})});
    }else sl=work.slice();
    /* şrift simvolları olan sətirlər mətn kimi oxunmur \u2014 şəkil kimi kəsilir */
    var keep=[],run=null;
    sl.forEach(function(L){
      if(hasPUA(L.text)&&ctx.pages[L.page]){
        if(run&&run.page===L.page&&run.col===L.col)run.B=Math.max(run.B,L.bot);else{run={page:L.page,col:L.col,T:L.top,B:L.bot};crops.push(run.crop=cropOf(ctx.pages[L.page],L.col,L.top,L.bot,true));run.crop.__run=run}
        run.crop.y1=Math.min(ctx.pages[L.page].H,run.B+3);flags.indexOf("symline")<0&&flags.push("symline");
      }else{run=null;keep.push(L)}
    });
    stem=flowStem(keep);
  }
  stem=stem.replace(BULLET_PUA,"•");
  if(hasPUA(stem)){flags.push("pua");stem=stem.replace(PUA,"")}
  opts.forEach(function(o){if(hasPUA(o.t)){flags.push("pua");o.t=o.t.replace(PUA,"")}});
  crops.forEach(function(c){delete c.__run});
  return{number:number,stem:stem,opts:opts,crops:crops,page:lines[0].page,top:lines[0].top,flags:flags,gopt:gopt};
}

function buildQuestions(pages,opt){
  var stream=[],byNo={};
  pages.forEach(function(pg){byNo[pg.pn]=pg});
  pages.forEach(function(pg){
    if(pg.isKey)return;
    for(var ci=0;ci<(pg.cols||1);ci++){
      var col=[];
      pg.lines.filter(function(l){return l.col===ci}).forEach(function(l){if(!isHeaderLine(l.text))col.push(l)});
      pg.figs.filter(function(f){return f.col===ci}).forEach(function(f){col.push(f)});
      col.sort(function(a,b){return a.top-b.top});
      col.forEach(function(e){stream.push(e)});
    }
  });
  var strict=pickStarts(stream,true),relaxed=pickStarts(stream,false),starts=strict;
  if(relaxed.length>strict.length){
    var withOpt=0;
    relaxed.forEach(function(s,k){if(hasOptions(blockText(stream,s.i,k+1<relaxed.length?relaxed[k+1].i:stream.length)))withOpt++});
    if(withOpt/relaxed.length>=.85)starts=relaxed;
  }
  var qs=[];
  starts.forEach(function(s,k){
    var end=k+1<starts.length?starts[k+1].i:stream.length,nx=k+1<starts.length?stream[starts[k+1].i]:null;
    var b=parseBlock(stream.slice(s.i,end),{pages:byNo,nextTop:nx&&nx.top,nextPage:nx&&nx.page,nextCol:nx&&nx.col});
    if(b){b.number=s.n;qs.push(b)}
  });
  return qs;
}

/* ═══════════════ 8. ŞƏKİL KƏSMƏ ═══════════════ */
var RENDER_SCALE=2.4;
async function pageCanvas(pdf,pn,cache){
  if(cache[pn])return cache[pn];
  var page=await pdf.getPage(pn),vp=page.getViewport({scale:RENDER_SCALE}),c=document.createElement("canvas");
  c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
  var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:x,viewport:vp}).promise;
  return cache[pn]={c:c,scale:RENDER_SCALE};
}
function trimCanvas(c,pad){
  var w=c.width,h=c.height,d=c.getContext("2d").getImageData(0,0,w,h).data,x0=w,y0=h,x1=-1,y1=-1,x,y,i;
  for(y=0;y<h;y++)for(x=0;x<w;x++){i=(y*w+x)*4;if(d[i+3]>8&&(d[i]<244||d[i+1]<244||d[i+2]<244)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(x1<0)return c;
  x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
  var o=document.createElement("canvas");o.width=x1-x0+1;o.height=y1-y0+1;
  var ox=o.getContext("2d");ox.fillStyle="#fff";ox.fillRect(0,0,o.width,o.height);ox.drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
  return o;
}
async function renderCrops(pdf,crops,cache){
  var parts=[];
  for(var k=0;k<crops.length;k++){
    var cr=crops[k],pc=await pageCanvas(pdf,cr.page,cache),s=pc.scale;
    var sx=Math.max(0,Math.floor(cr.x0*s)),sy=Math.max(0,Math.floor(cr.y0*s)),sw=Math.min(pc.c.width-sx,Math.ceil((cr.x1-cr.x0)*s)),sh=Math.min(pc.c.height-sy,Math.ceil((cr.y1-cr.y0)*s));
    if(sw<4||sh<4)continue;
    var cv=document.createElement("canvas");cv.width=sw;cv.height=sh;
    var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,sw,sh);cx.drawImage(pc.c,sx,sy,sw,sh,0,0,sw,sh);
    parts.push(cr.trim?trimCanvas(cv,8):trimCanvas(cv,4));
  }
  if(!parts.length)return null;
  var W=Math.max.apply(0,parts.map(function(p){return p.width})),gap=10,H=parts.reduce(function(a,p){return a+p.height},0)+gap*(parts.length-1);
  var out=document.createElement("canvas");out.width=W;out.height=H;
  var ox=out.getContext("2d");ox.fillStyle="#fff";ox.fillRect(0,0,W,H);
  var yy=0;parts.forEach(function(p){ox.drawImage(p,0,yy);yy+=p.height+gap});
  var url=out.toDataURL("image/png");
  if(url.length>450000)url=out.toDataURL("image/jpeg",.9);
  return url;
}


/* ═══════════════ 9. MODEL ═══════════════ */
var S={file:null,pdf:null,pages:[],qs:[],sel:0,key:null,opt:{figures:true,clean:true,key:true,numMode:"pdf",start:1},
  busy:false,dirty:false,filter:"all",showAns:true,exams:[1,2],bankReady:null,aiBusy:false};
var uid=0;
function dqc(t){try{if(typeof dqClean==="function")return dqClean(t)}catch(e){}return"<p>"+esc(t).replace(/\n/g,"<br>")+"</p>"}
function newQ(p){
  return Object.assign({id:++uid,number:0,stem:"",opts:[{t:"",img:null},{t:"",img:null},{t:"",img:null},{t:"",img:null},{t:"",img:null}],
    correct:-1,image:null,crops:[],flags:[],gopt:false,open:false,openAns:"",subject:"",raw:null,ai:null,keyLetter:null},p||{});
}
function warnings(q){
  var w=[],n=q.opts.length;
  if(!q.stem.trim()&&!q.image)w.push({k:"err",t:"Sual mətni boşdur"});
  if(!q.open){
    if(n<2)w.push({k:"err",t:"Variantlar tapılmadı \u2014 əlavə edin və ya sualı açıq sual kimi işarələyin"});
    else if(n<4&&!q.gopt)w.push({k:"warn",t:"Variant sayı azdır ("+n+")"});
    if(!q.gopt){var e=[];q.opts.forEach(function(o,i){if(!o.t.trim()&&!o.img)e.push("ABCDE"[i])});if(e.length)w.push({k:"err",t:"Boş variant: "+e.join(", ")})}
    if(q.correct<0)w.push({k:"err",t:"Düzgün cavab seçilməyib"+(q.keyLetter?"":" (PDF-də cavab açarı tapılmadı)")});
    else if(q.correct>=n)w.push({k:"err",t:"Düzgün cavab mövcud olmayan variantı göstərir"});
  }else if(!q.openAns.trim())w.push({k:"err",t:"Açıq sualın düzgün cavabı yazılmayıb"});
  if(q.flags.indexOf("overline")>=0)w.push({k:"warn",t:"Mətndə üst xətt (⎯) işarəsi vardı və silindi \u2014 ifadəni yoxlayın"});
  if(q.flags.indexOf("pua")>=0||q.flags.indexOf("symline")>=0)w.push({k:"warn",t:"Xüsusi şrift simvolları var \u2014 şəkildə düzgün göründüyünü yoxlayın (lazım olsa şəkli əvəz edin)"});
  if(q.gopt)w.push({k:"info",t:"Variantlar şəkil şəklindədir \u2014 şəkil variant sətirlərini də əhatə edir"});
  else if(q.image)w.push({k:"info",t:"Şəkil/cədvəl PDF-dən avtomatik kəsildi"});
  if(q.ai&&!q.ai.done)w.push({k:"info",t:"AI düzəliş təklifi gözləyir"});
  return w;
}
function qStatus(q){var w=warnings(q);if(w.some(function(x){return x.k==="err"}))return"err";if(w.some(function(x){return x.k==="warn"}))return"warn";return"ok"}
function finalNumber(q,i){return S.opt.numMode==="seq"?(+S.opt.start||1)+i:q.number}
function qSubject(q,i){return q.subject||subjectOf(finalNumber(q,i))}
function applyKey(){
  S.qs.forEach(function(q){
    var l=S.key&&S.key.map[q.number];q.keyLetter=l||null;
    if(l&&q.opts.length){var ix="ABCDE".indexOf(l);q.correct=ix>=0&&ix<q.opts.length?ix:-1}
  });
}
function cleanQuestion(q){
  q.stem=polishStem(q.stem);
  q.opts.forEach(function(o){o.t=cleanInline(o.t)});
  polishOptions(q.opts);
}

/* ═══════════════ 10. PDF → SUALLAR ═══════════════ */
async function runImport(file){
  if(S.busy)return;
  S.busy=true;S.file=file;
  var pr=function(t,p){var b=$("pp-prog");if(!b)return;b.style.display="block";$("pp-prog-t").textContent=t;$("pp-prog-f").style.width=Math.round(p)+"%"};
  try{
    pr("PDF kitabxanası yüklənir…",3);
    await ensurePdfLib();
    pr("Fayl oxunur…",6);
    var buf=await file.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise,pages=[];
    for(var i=1;i<=pdf.numPages;i++){
      pr("Səhifə "+i+" / "+pdf.numPages+" analiz olunur…",8+i/pdf.numPages*50);
      var pg=await pdf.getPage(i);pages.push(await readPage(pg,i,S.opt));
    }
    pr("Suallar və variantlar ayrılır…",62);
    var raw=buildQuestions(pages,S.opt);
    if(!raw.length)throw new Error("PDF-də nömrələnmiş sual (1. 2. 3. …) tapılmadı. Fayl skan edilmiş şəkil ola bilər \u2014 belə PDF-lər üçün «AI PDF Studio PRO» bölməsindən istifadə edin.");
    var key=S.opt.key?parseKey(pages):{map:{},count:0,dups:[]},cache={};
    var qs=[];
    for(var k=0;k<raw.length;k++){
      pr("Şəkillər hazırlanır: "+(k+1)+" / "+raw.length,64+k/raw.length*34);
      var r=raw[k],q=newQ({number:r.number,stem:r.stem,opts:r.opts.length?r.opts:[],crops:r.crops,flags:r.flags,gopt:r.gopt});
      q.raw={stem:q.stem,opts:q.opts.map(function(o){return o.t})};
      if(S.opt.clean)cleanQuestion(q);
      if(q.crops.length)try{q.image=await renderCrops(pdf,q.crops,cache)}catch(e){console.warn("[DQPP] şəkil",e)}
      qs.push(q);
    }
    S.pdf=pdf;S.pages=pages;S.key=key;S.qs=qs;S.sel=0;S.dirty=true;
    applyKey();
    pr("Hazırdır",100);
    renderWork();
    var miss=qs.filter(function(q){return q.correct<0&&!q.open}).length;
    toast(qs.length+" sual oxundu"+(key.count?"; cavab açarı: "+key.count+" cavab":"; cavab açarı tapılmadı")+(miss?" · "+miss+" sualın cavabı yoxdur":""),miss?"warn":"ok");
  }catch(e){
    console.error(e);toast(e.message||String(e),"err");
    var b=$("pp-prog");if(b)b.style.display="none";
  }finally{S.busy=false}
}

/* ═══════════════ 11. ŞƏKİL ƏMƏLİYYATLARI ═══════════════ */
function readImageFile(f,max){
  return new Promise(function(ok,no){
    var fr=new FileReader();
    fr.onerror=function(){no(new Error("Fayl oxunmadı"))};
    fr.onload=function(){
      var im=new Image();
      im.onload=function(){
        var sc=Math.min(1,(max||1400)/Math.max(im.width,im.height)),c=document.createElement("canvas");
        c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);
        var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
        var u=c.toDataURL("image/png");if(u.length>450000)u=c.toDataURL("image/jpeg",.9);ok(u);
      };
      im.onerror=function(){no(new Error("Şəkil formatı tanınmadı"))};
      im.src=fr.result;
    };
    fr.readAsDataURL(f);
  });
}
var CR={pn:1,scale:1.5,rect:null,canvas:null,drag:null};
async function openCrop(){
  var q=S.qs[S.sel];
  if(!S.pdf){toast("PDF yaddaşda deyil \u2014 əvvəlcə faylı yenidən yükləyin","err");return}
  CR.pn=(q.crops[0]&&q.crops[0].page)||1;CR.rect=null;
  var m=$("pp-crop");m.style.display="flex";
  m.querySelector("[data-pages]").innerHTML="";
  for(var i=1;i<=S.pdf.numPages;i++){var o=document.createElement("option");o.value=i;o.textContent="Səhifə "+i;m.querySelector("[data-pages]").appendChild(o)}
  m.querySelector("[data-pages]").value=CR.pn;
  await cropShow();
}
async function cropShow(){
  var page=await S.pdf.getPage(CR.pn),vp=page.getViewport({scale:CR.scale}),cv=$("pp-crop-cv");
  cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
  var x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:x,viewport:vp}).promise;
  CR.base=x.getImageData(0,0,cv.width,cv.height);CR.rect=null;
}
function cropDraw(){
  var cv=$("pp-crop-cv"),x=cv.getContext("2d");x.putImageData(CR.base,0,0);
  if(CR.rect){var r=CR.rect;x.fillStyle="rgba(37,99,235,.18)";x.strokeStyle="#2563eb";x.lineWidth=2;x.fillRect(r.x,r.y,r.w,r.h);x.strokeRect(r.x,r.y,r.w,r.h)}
}
function cropPos(ev){var cv=$("pp-crop-cv"),b=cv.getBoundingClientRect(),t=ev.touches?ev.touches[0]:ev;return{x:(t.clientX-b.left)*cv.width/b.width,y:(t.clientY-b.top)*cv.height/b.height}}
async function cropApply(){
  if(!CR.rect||CR.rect.w<8||CR.rect.h<8){toast("Əvvəlcə sahəni seçin","warn");return}
  var r=CR.rect,s=CR.scale,q=S.qs[S.sel];
  var crop={page:CR.pn,x0:r.x/s,y0:r.y/s,x1:(r.x+r.w)/s,y1:(r.y+r.h)/s,trim:false};
  var mode=$("pp-crop-mode").value;
  try{
    var url=await renderCrops(S.pdf,[crop],{});
    if(!url)throw new Error("Boş sahə");
    if(mode==="add"&&q.image){
      url=await stackImages([q.image,url]);q.crops.push(crop);
    }else q.crops=[crop];
    q.image=url;S.dirty=true;$("pp-crop").style.display="none";
    renderEditor();renderPreview();renderList();toast("Şəkil əlavə olundu","ok");
  }catch(e){toast(e.message,"err")}
}
function stackImages(urls){
  return Promise.all(urls.map(function(u){return new Promise(function(ok){var i=new Image();i.onload=function(){ok(i)};i.src=u})})).then(function(ims){
    var W=Math.max.apply(0,ims.map(function(i){return i.width})),H=ims.reduce(function(a,i){return a+i.height},0)+10*(ims.length-1);
    var c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,W,H);
    var y=0;ims.forEach(function(i){x.drawImage(i,0,y);y+=i.height+10});
    var u=c.toDataURL("image/png");return u.length>450000?c.toDataURL("image/jpeg",.9):u;
  });
}

/* ═══════════════ 12. AI DÜZƏLİŞİ (isteğe bağlı) ═══════════════ */
function aiKey(){try{return localStorage.getItem(LS_KEY)||""}catch(e){return""}}
function nums(t){return(String(t).match(/\d+/g)||[]).sort().join(",")}
function wordDiff(a,b){
  var A=a.split(/(\s+)/),B=b.split(/(\s+)/),n=A.length,m=B.length,dp=[],i,j;
  for(i=0;i<=n;i++){dp[i]=new Array(m+1).fill(0)}
  for(i=n-1;i>=0;i--)for(j=m-1;j>=0;j--)dp[i][j]=A[i]===B[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  var out="";i=0;j=0;
  while(i<n&&j<m){
    if(A[i]===B[j]){out+=esc(A[i]);i++;j++}
    else if(dp[i+1][j]>=dp[i][j+1]){if(A[i].trim())out+='<del>'+esc(A[i])+'</del>';i++}
    else{if(B[j].trim())out+='<ins>'+esc(B[j])+'</ins>';else out+=esc(B[j]);j++}
  }
  while(i<n){if(A[i].trim())out+='<del>'+esc(A[i])+'</del>';i++}
  while(j<m){out+=B[j].trim()?'<ins>'+esc(B[j])+'</ins>':esc(B[j]);j++}
  return out;
}
var AI_PROMPT="Sən Azərbaycan dili üzrə peşəkar redaktor-korrektorsan. Aşağıda PDF-dən çıxarılmış test sualları JSON formatındadır. Hər sual üçün YALNIZ orfoqrafiya, qrammatika, durğu işarələri, böyük/kiçik hərf və PDF oxunuşundan yaranmış hərf səhvlərini (məsələn «yuxan»→«yuxarı», ayrı/bitişik yazılış) düzəlt. Mənanı, rəqəmləri, düsturları, kodları, xüsusi adları, ingilis terminlərini (Windows, Excel və s.), sətir bölgülərini və variantların sırasını DƏYİŞMƏ; heç nə əlavə etmə, heç nəyi silmə. Düzəliş lazım deyilsə mətni eyni qaytar. YALNIZ JSON qaytar (markdown yoxdur): {\"items\":[{\"i\":0,\"stem\":\"...\",\"options\":[\"...\"]}]}. Variantların sayı girişdəki ilə eyni olmalıdır.";
async function aiCall(key,model,payload){
  var url="https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+encodeURIComponent(key);
  var body={contents:[{parts:[{text:AI_PROMPT+"\n\n"+JSON.stringify({items:payload})}]}],generationConfig:{temperature:0,responseMimeType:"application/json"}};
  for(var t=0;t<3;t++){
    var r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(r.status===429||r.status>=500){await sleep(2500*(t+1));continue}
    var j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||"HTTP "+r.status);
    var parts=(((j.candidates||[])[0]||{}).content||{}).parts||[],txt=parts.map(function(p){return p.text||""}).join("").replace(/```json|```/g,"").trim();
    try{return JSON.parse(txt).items||[]}catch(e){if(t===2)throw new Error("AI cavabı oxunmadı")}
  }
  throw new Error("AI cavab vermədi (limit və ya server xətası)");
}
async function runAI(indices){
  var key=aiKey();
  if(!key){toast("Əvvəlcə Gemini API açarını daxil edin (aşağıdakı sahə)","warn");return}
  if(S.aiBusy)return;S.aiBusy=true;renderAiBar();
  var model=($("pp-ai-model")||{}).value||"gemini-2.5-flash",done=0,changed=0;
  try{
    for(var s=0;s<indices.length;s+=8){
      var chunk=indices.slice(s,s+8),payload=chunk.map(function(ix,k){var q=S.qs[ix];return{i:k,stem:q.stem,options:q.opts.map(function(o){return o.t})}});
      var res=await aiCall(key,model,payload);
      res.forEach(function(r){
        var q=S.qs[chunk[r.i]];if(!q||typeof r.stem!=="string"||!Array.isArray(r.options)||r.options.length!==q.opts.length)return;
        var ok=nums(r.stem)===nums(q.stem)&&r.options.every(function(o,k){return typeof o==="string"&&nums(o)===nums(q.opts[k].t)});
        var ratio=function(a,b){return!a.length||(b.length/a.length>.6&&b.length/a.length<1.5)};
        ok=ok&&ratio(q.stem,r.stem)&&r.options.every(function(o,k){return ratio(q.opts[k].t,o)});
        if(!ok)return;
        var same=r.stem===q.stem&&r.options.every(function(o,k){return o===q.opts[k].t});
        if(!same){q.ai={stem:r.stem,options:r.options,done:false};changed++}
      });
      done+=chunk.length;toast("AI yoxlaması: "+done+" / "+indices.length,"ok");
    }
    toast("AI yoxlaması bitdi \u2014 "+changed+" sualda təklif var","ok");
  }catch(e){toast("AI xətası: "+e.message,"err")}
  S.aiBusy=false;renderAiBar();renderList();renderEditor();
}
function acceptAI(i){
  var q=S.qs[i];if(!q||!q.ai)return;
  q.stem=q.ai.stem;q.ai.options.forEach(function(o,k){q.opts[k].t=o});q.ai=null;S.dirty=true;
}

/* ═══════════════ 13. İNTERFEYS ═══════════════ */
var CSS='.pp{font-family:inherit;color:#0f172a}.pp *{box-sizing:border-box}'+
'.pp h4{margin:0 0 4px;text-align:left}.pp .sub{color:#64748b;font-size:13px;margin:0 0 14px}'+
'.pp-drop{border:2px dashed #93c5fd;background:#eff6ff;border-radius:16px;padding:34px 16px;text-align:center;cursor:pointer;transition:.2s}'+
'.pp-drop:hover,.pp-drop.on{background:#dbeafe;border-color:#2563eb}.pp-drop b{display:block;font-size:16px;margin-bottom:4px}.pp-drop span{color:#64748b;font-size:13px}'+
'.pp-opts{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0;font-size:13px}.pp-opts label{display:flex;align-items:center;gap:6px;cursor:pointer}'+
'.pp-prog{display:none;margin:12px 0}.pp-prog .t{font-size:13px;color:#334155;margin-bottom:4px}.pp-prog .b{height:8px;border-radius:8px;background:#e2e8f0;overflow:hidden}.pp-prog .f{height:100%;width:0;background:linear-gradient(90deg,#2563eb,#7c3aed);transition:width .25s}'+
'.pp-stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}.pp-stat{background:#f1f5f9;border-radius:10px;padding:6px 12px;font-size:12.5px}.pp-stat b{font-size:15px}.pp-stat.e{background:#fee2e2;color:#991b1b}.pp-stat.w{background:#fef3c7;color:#92400e}.pp-stat.g{background:#dcfce7;color:#166534}'+
'.pp-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start}'+
'@media(max-width:980px){.pp-grid{grid-template-columns:1fr}}'+
'.pp-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px}.pp-pv{position:sticky;top:10px}'+
'.pp-chips{display:flex;flex-wrap:wrap;gap:5px;max-height:132px;overflow:auto;padding:2px}'+
'.pp-chip{min-width:38px;padding:5px 7px;border-radius:8px;border:2px solid #e2e8f0;background:#fff;font-size:12px;font-weight:700;cursor:pointer;text-align:center}'+
'.pp-chip.ok{border-color:#86efac;background:#f0fdf4}.pp-chip.warn{border-color:#fcd34d;background:#fffbeb}.pp-chip.err{border-color:#fca5a5;background:#fef2f2}.pp-chip.sel{outline:3px solid #2563eb;outline-offset:1px}'+
'.pp-f{margin:10px 0}.pp-f>label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px}'+
'.pp textarea,.pp input[type=text],.pp input[type=number],.pp select{width:100%;padding:9px 10px;border:2px solid #e2e8f0;border-radius:10px;font:inherit;font-size:14px;background:#fff;color:#0f172a}'+
'.pp textarea{min-height:90px;resize:vertical;line-height:1.5}.pp textarea:focus,.pp input:focus,.pp select:focus{outline:none;border-color:#2563eb}'+
'.pp-opt{display:flex;gap:8px;align-items:center;margin:6px 0}.pp-opt .l{width:26px;font-weight:800;text-align:center}.pp-opt input[type=radio]{width:20px;height:20px;accent-color:#16a34a;flex:none}.pp-opt.cor input[type=text]{border-color:#22c55e;background:#f0fdf4}'+
'.pp-b{border:0;border-radius:10px;padding:8px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#e2e8f0;color:#0f172a}.pp-b:hover{filter:brightness(.95)}.pp-b.p{background:#2563eb;color:#fff}.pp-b.g{background:#16a34a;color:#fff}.pp-b.d{background:#fee2e2;color:#b91c1c}.pp-b.s{padding:5px 9px;font-size:12px}.pp-b:disabled{opacity:.5;cursor:not-allowed}'+
'.pp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'+
'.pp-w{font-size:12.5px;padding:6px 10px;border-radius:8px;margin:4px 0}.pp-w.err{background:#fee2e2;color:#991b1b}.pp-w.warn{background:#fef3c7;color:#92400e}.pp-w.info{background:#e0f2fe;color:#075985}'+
'.pp-img{max-width:100%;max-height:180px;border:1px solid #e2e8f0;border-radius:8px;display:block;margin:6px 0;background:#fff}'+
'.pp-bar{position:sticky;bottom:0;z-index:5;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:12px;margin-top:16px;box-shadow:0 -6px 20px #0f172a14;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}'+
'.pp-bar .c{min-width:140px}.pp-bar .c>label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:3px}.pp-bar .chk{display:flex;gap:6px;align-items:center;font-size:13px;margin:3px 0;cursor:pointer}'+
'.pp-pv .question-top{display:flex;justify-content:space-between;align-items:center}.pp-pv .preview-img{max-height:none!important}.pp-pv .options label.cor{background:#dcfce7;outline:2px solid #22c55e}'+
'.pp-ai{background:#faf5ff;border:1px solid #d8b4fe;border-radius:12px;padding:10px;margin:10px 0;font-size:13.5px;line-height:1.55}.pp-ai ins{background:#bbf7d0;text-decoration:none;border-radius:3px;padding:0 2px}.pp-ai del{background:#fecaca;border-radius:3px;padding:0 2px}'+
'.pp-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;font-size:13.5px;z-index:99999;max-width:90vw;box-shadow:0 8px 24px #0004;transition:opacity .4s}.pp-toast.ok{background:#166534}.pp-toast.err{background:#991b1b}.pp-toast.warn{background:#92400e}.pp-toast.out{opacity:0}'+
'.pp-modal{position:fixed;inset:0;background:#0f172acc;z-index:99990;display:none;align-items:center;justify-content:center;padding:14px}.pp-modal .in{background:#fff;border-radius:16px;padding:14px;max-width:96vw;max-height:94vh;overflow:auto}'+
'.pp-modal canvas{max-width:100%;cursor:crosshair;touch-action:none;border:1px solid #cbd5e1}'+
'.pp-tbl{width:100%;border-collapse:collapse;font-size:13px}.pp-tbl th,.pp-tbl td{border-bottom:1px solid #e2e8f0;padding:7px 6px;text-align:left;vertical-align:top}.pp-tbl th{background:#f8fafc;font-size:12px;color:#475569;position:sticky;top:0}'+
'.pp-tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:700;margin:1px 2px 1px 0}.pp-tag.u{background:#dcfce7;color:#166534}.pp-tag.n{background:#f1f5f9;color:#475569}.pp-tag.c{background:#dbeafe;color:#1d4ed8}'+
'.pp-code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px;font:12px/1.5 monospace;white-space:pre-wrap;max-height:260px;overflow:auto}';

function el(id){return $(id)}
function renderWork(){
  var root=$("pp-work");if(!root)return;
  if(!S.qs.length){root.innerHTML="";return}
  root.innerHTML=
  '<div id="pp-stats" class="pp-stats"></div>'+
  '<div id="pp-aibar"></div>'+
  '<div class="pp-grid"><div>'+
    '<div class="pp-card"><div class="pp-row" style="justify-content:space-between;margin-bottom:6px"><b>Suallar</b>'+
    '<span class="pp-row"><label style="font-size:12px"><input type="checkbox" id="pp-onlyp"> yalnız problemlilər</label></span></div><div id="pp-list" class="pp-chips"></div></div>'+
    '<div class="pp-card" style="margin-top:12px" id="pp-editor"></div>'+
  '</div><div class="pp-card pp-pv"><div class="pp-row" style="justify-content:space-between;margin-bottom:8px"><b>👁 İştirakçıya necə görünəcək</b>'+
    '<span class="pp-row"><label style="font-size:12px"><input type="checkbox" id="pp-showans" checked> düzgün cavabı göstər</label></span></div>'+
    '<div id="pp-preview"></div><div class="pp-row" style="margin-top:10px;justify-content:space-between"><button class="pp-b s" data-act="prev">← Əvvəlki</button><span id="pp-pos" style="font-size:12px;color:#64748b"></span><button class="pp-b s" data-act="next">Növbəti →</button></div></div>'+
  '</div>'+
  '<div class="pp-bar" id="pp-bar"></div>';
  renderStats();renderAiBar();renderList();renderEditor();renderPreview();renderBar();
}
function renderStats(){
  var n=S.qs.length,ok=0,w=0,e=0,noans=0;
  S.qs.forEach(function(q){var s=qStatus(q);if(s==="ok")ok++;else if(s==="warn")w++;else e++;if(q.correct<0&&!q.open)noans++});
  var dupN={};S.qs.forEach(function(q,i){var k=finalNumber(q,i);dupN[k]=(dupN[k]||0)+1});
  var dups=Object.keys(dupN).filter(function(k){return dupN[k]>1});
  var nums=S.qs.map(function(q,i){return finalNumber(q,i)}),miss=[];
  var mn=Math.min.apply(0,nums),mx=Math.max.apply(0,nums);for(var k=mn;k<=mx;k++)if(nums.indexOf(k)<0)miss.push(k);
  el("pp-stats").innerHTML='<div class="pp-stat"><b>'+n+'</b> sual</div><div class="pp-stat g"><b>'+ok+'</b> hazır</div>'+
    (w?'<div class="pp-stat w"><b>'+w+'</b> yoxlanmalı</div>':'')+(e?'<div class="pp-stat e"><b>'+e+'</b> xətalı</div>':'')+
    '<div class="pp-stat"><b>'+(n-noans)+'</b>/'+n+' cavab seçilib</div>'+
    (S.key?'<div class="pp-stat">Cavab açarı: <b>'+S.key.count+'</b></div>':'')+
    (miss.length?'<div class="pp-stat w">Atlanmış nömrələr: '+miss.slice(0,12).join(", ")+(miss.length>12?"…":"")+'</div>':'')+
    (dups.length?'<div class="pp-stat e">Təkrar nömrələr: '+dups.join(", ")+'</div>':'');
}
function renderAiBar(){
  var b=el("pp-aibar");if(!b)return;
  var pend=S.qs.filter(function(q){return q.ai}).length;
  b.innerHTML='<details class="pp-card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">✨ AI ilə orfoqrafiya / qrammatika yoxlaması (isteğe bağlı)'+(pend?' \u2014 <span style="color:#7c3aed">'+pend+' təklif var</span>':'')+'</summary>'+
    '<p class="sub" style="margin-top:8px">Avtomatik təmizləmə boşluq, durğu və böyük hərfi düzəldir. Sözlərdəki PDF səhvlərini («yuxan» kimi) tutmaq üçün Gemini ilə yoxlaya bilərsiniz. AI rəqəmləri dəyişərsə təklif rədd edilir; hər təklifi özünüz təsdiqləyirsiniz.</p>'+
    '<div class="pp-row"><input type="text" id="pp-ai-key" placeholder="Gemini API açarı" value="'+esc(aiKey())+'" style="max-width:300px">'+
    '<select id="pp-ai-model" style="max-width:190px"><option>gemini-2.5-flash</option><option>gemini-2.5-pro</option></select>'+
    '<button class="pp-b p" data-act="ai-all"'+(S.aiBusy?" disabled":"")+'>'+(S.aiBusy?"Yoxlanır…":"Bütün sualları yoxla")+'</button>'+
    (pend?'<button class="pp-b g" data-act="ai-accept-all">Bütün təklifləri qəbul et</button>':'')+'</div></details>';
}
function renderList(){
  var l=el("pp-list");if(!l)return;
  var only=el("pp-onlyp")&&el("pp-onlyp").checked,h="";
  S.qs.forEach(function(q,i){var s=qStatus(q);if(only&&s==="ok"&&!q.ai)return;h+='<div class="pp-chip '+s+(i===S.sel?" sel":"")+'" data-act="sel" data-i="'+i+'" title="'+esc(warnings(q).filter(function(w){return w.k!=="info"}).map(function(w){return w.t}).join("\n"))+'">'+finalNumber(q,i)+(q.ai?" ✨":"")+'</div>'});
  l.innerHTML=h||'<span style="color:#64748b;font-size:13px">Problemli sual yoxdur ✅</span>';
}
function renderEditor(){
  var box=el("pp-editor");if(!box)return;
  var q=S.qs[S.sel];if(!q){box.innerHTML="";return}
  var i=S.sel,subs=subjectList(),w=warnings(q);
  var h='<div class="pp-row" style="justify-content:space-between"><b>✏\ufe0f Sual redaktoru</b><span class="pp-row">'+
    '<button class="pp-b s" data-act="add-after">➕ Sual əlavə et</button><button class="pp-b s d" data-act="del-q">🗑 Sil</button></span></div>';
  h+='<div class="pp-row" style="margin-top:6px"><div class="pp-f" style="width:90px"><label>Nömrə</label><input type="number" data-f="number" value="'+q.number+'"></div>'+
     '<div class="pp-f" style="flex:1;min-width:160px"><label>Fənn</label><select data-f="subject"><option value="">Avtomatik ('+esc(subjectOf(finalNumber(q,i)))+')</option>'+subs.map(function(s){return'<option'+(q.subject===s?" selected":"")+'>'+esc(s)+'</option>'}).join("")+'</select></div>'+
     '<div class="pp-f"><label>&nbsp;</label><label style="display:flex;gap:6px;align-items:center;font-weight:600"><input type="checkbox" data-f="open"'+(q.open?" checked":"")+'> Açıq sual</label></div></div>';
  h+='<div class="pp-f"><label>Sualın mətni</label><textarea data-f="stem" rows="4">'+esc(q.stem)+'</textarea></div>';
  h+='<div class="pp-f"><label>Şəkil / cədvəl / fiqur</label>'+(q.image?'<img class="pp-img" src="'+q.image+'">':'<div style="font-size:12.5px;color:#64748b">Şəkil yoxdur</div>')+
     '<div class="pp-row"><button class="pp-b s" data-act="crop">✂\ufe0f PDF-dən sahə kəs</button><button class="pp-b s" data-act="up-img">📁 Fayldan yüklə</button>'+(q.image?'<button class="pp-b s d" data-act="rm-img">Şəkli sil</button>':'')+'<input type="file" id="pp-imgfile" accept="image/*" style="display:none"></div></div>';
  if(q.open){
    h+='<div class="pp-f"><label>Düzgün cavab (açıq sual)</label><input type="text" data-f="openAns" value="'+esc(q.openAns)+'"></div>';
  }else{
    h+='<div class="pp-f"><label>Variantlar (düzgün cavabı dairə ilə seçin)</label>';
    q.opts.forEach(function(o,k){
      h+='<div class="pp-opt'+(q.correct===k?" cor":"")+'"><span class="l">'+"ABCDE"[k]+'</span><input type="radio" name="pp-cor" data-f="correct" data-k="'+k+'"'+(q.correct===k?" checked":"")+'>'+
         '<input type="text" data-f="opt" data-k="'+k+'" value="'+esc(o.t)+'" placeholder="Variant '+"ABCDE"[k]+'">'+
         (o.img?'<img src="'+o.img+'" style="height:30px;border-radius:4px">':'')+
         '<button class="pp-b s" data-act="opt-img" data-k="'+k+'" title="Variant şəkli">🖼</button>'+
         (q.opts.length>2?'<button class="pp-b s d" data-act="opt-del" data-k="'+k+'" title="Variantı sil">✕</button>':'')+'</div>';
    });
    h+=(q.opts.length<5?'<button class="pp-b s" data-act="opt-add">➕ Variant əlavə et</button> ':'')+'<input type="file" id="pp-optfile" accept="image/*" style="display:none"></div>';
  }
  if(q.ai){
    h+='<div class="pp-ai"><b>✨ AI təklifi</b><div style="margin-top:6px">'+wordDiff(q.stem,q.ai.stem).replace(/\n/g,"<br>")+'</div>'+
      q.ai.options.map(function(o,k){return o!==q.opts[k].t?'<div><b>'+"ABCDE"[k]+')</b> '+wordDiff(q.opts[k].t,o)+'</div>':''}).join("")+
      '<div class="pp-row" style="margin-top:8px"><button class="pp-b g s" data-act="ai-ok">Qəbul et</button><button class="pp-b s" data-act="ai-no">Rədd et</button></div></div>';
  }
  h+='<div class="pp-row" style="margin:6px 0"><button class="pp-b s" data-act="reclean">🧹 Mətni təmizlə</button>'+(q.raw?'<button class="pp-b s" data-act="restore">↩ PDF-dəki ilkin mətn</button>':'')+
     '<button class="pp-b s" data-act="ai-one"'+(S.aiBusy?" disabled":"")+'>✨ AI ilə yoxla</button></div>';
  h+=w.map(function(x){return'<div class="pp-w '+x.k+'">'+(x.k==="err"?"⛔ ":x.k==="warn"?"⚠\ufe0f ":"ℹ\ufe0f ")+esc(x.t)+'</div>'}).join("");
  box.innerHTML=h;
}
function renderPreview(){
  var box=el("pp-preview");if(!box)return;
  var q=S.qs[S.sel];if(!q){box.innerHTML="";return}
  var i=S.sel,labels="ABCDE",h='<div class="question-top"><span style="font-size:16px;font-weight:bold;color:var(--primary-dark)">Sual '+finalNumber(q,i)+' ('+esc(qSubject(q,i))+')</span><span class="question-score-badge">⭐ 1 Bal</span></div>';
  h+='<div class="question-title">'+dqc(q.stem)+'</div>';
  if(q.image)h+='<img src="'+q.image+'" class="preview-img" alt="Sual şəkli">';
  if(q.open)h+='<div class="form-group mt-3"><label style="font-weight:bold;font-size:14px">Cavabınızı Daxil Edin (Açıq Sual):</label><input type="text" class="form-control" style="max-width:300px" disabled'+(S.showAns?' value="'+esc(q.openAns)+'"':"")+'></div>';
  else{
    h+='<div class="options mt-3">';
    q.opts.forEach(function(o,k){
      var cor=S.showAns&&q.correct===k;
      h+='<label class="'+(cor?"cor":"")+'" style="display:flex;align-items:center;gap:10px"><input type="radio" disabled'+(cor?" checked":"")+'><span class="dq-opt"><b class="dq-ol">'+labels[k]+')</b><span class="dq-ot">'+dqc(o.t)+'</span></span>'+(o.img?'<img src="'+o.img+'" class="opt-preview-img" style="margin-left:auto">':"")+'</label>';
    });
    h+='</div>';
  }
  box.innerHTML=h;
  var p=el("pp-pos");if(p)p.textContent=(S.sel+1)+" / "+S.qs.length;
}
function renderBar(){
  var b=el("pp-bar");if(!b)return;
  var ex=S.exams.map(function(n){return'<option value="'+n+'">Sınaq '+n+'</option>'}).join("")+'<option value="'+(Math.max.apply(0,S.exams)+1)+'">Sınaq '+(Math.max.apply(0,S.exams)+1)+' (yeni)</option>';
  var keep=S.bar||{exam:"",cat:"BB",toExam:true,toBank:false};
  b.innerHTML=
   '<div class="c"><label>Sınaq nömrəsi</label><select id="pp-exam">'+ex+'</select></div>'+
   '<div class="c"><label>Kateqoriya</label><select id="pp-cat">'+CATS.map(function(c){return'<option>'+c+'</option>'}).join("")+'</select></div>'+
   '<div class="c" style="min-width:210px"><label>Nömrələmə</label><select id="pp-nummode"><option value="pdf">PDF-dəki nömrələr ('+(S.qs[0]?S.qs[0].number:"")+'…)</option><option value="seq">Başlanğıc nömrədən ardıcıl</option></select></div>'+
   '<div class="c" id="pp-startw" style="min-width:90px;max-width:110px;display:none"><label>Başlanğıc</label><input type="number" id="pp-start" min="1" value="'+S.opt.start+'"></div>'+
   '<div class="c" style="flex:1;min-width:250px"><label class="chk"><input type="checkbox" id="pp-toexam"> Sınaqa yüklə (seçilən sınaq + kateqoriya)</label>'+
   '<label class="chk"><input type="checkbox" id="pp-tobank"> Ümumi sınaq bazasına da yüklə (kateqoriya üzrə)</label><div id="pp-bankmsg" style="font-size:12px;color:#92400e"></div></div>'+
   '<div class="c"><button class="pp-b g" id="pp-save" data-act="save" style="padding:12px 20px;font-size:14px">⬆ Yüklə</button></div>';
  $("pp-exam").value=keep.exam||String(S.exams[S.exams.length-1]);$("pp-cat").value=keep.cat;
  $("pp-toexam").checked=keep.toExam;$("pp-tobank").checked=keep.toBank;$("pp-nummode").value=S.opt.numMode;
  $("pp-startw").style.display=S.opt.numMode==="seq"?"":"none";
  probeBank().then(function(ok){var m=$("pp-bankmsg");if(m)m.innerHTML=ok?"":'⚠\ufe0f Baza cədvəli qurulmayıb \u2014 <a href="#" data-act="show-sql">SQL-ə bax</a>'});
}
function saveBar(){
  if(!$("pp-exam"))return;
  S.bar={exam:$("pp-exam").value,cat:$("pp-cat").value,toExam:$("pp-toexam").checked,toBank:$("pp-tobank").checked};
}

/* ═══════════════ 14. VERİLƏNLƏR BAZASI ═══════════════ */
var BANK_SQL="create table if not exists question_bank (\n  id bigserial primary key,\n  category text not null,\n  subject text,\n  src_number int,\n  question text not null default '',\n  image_url text,\n  has_image boolean not null default false,\n  used_in jsonb not null default '[]',\n  options jsonb not null default '[]',\n  correct text,\n  fp text not null,\n  source text,\n  created_at timestamptz not null default now(),\n  unique (category, fp)\n);\ncreate index if not exists question_bank_cat_idx on question_bank (category);\nalter table question_bank enable row level security;\ndrop policy if exists \"qbank all\" on question_bank;\ncreate policy \"qbank all\" on question_bank for all using (true) with check (true);";
async function probeBank(force){
  if(S.bankReady!==null&&!force)return S.bankReady;
  try{var r=await _supabase.from("question_bank").select("id",{head:true,count:"exact"});S.bankReady=!r.error}catch(e){S.bankReady=false}
  return S.bankReady;
}
async function loadExams(){
  var max=2;
  try{if(typeof loadExamRegistry==="function")max=Math.max(max,+(await loadExamRegistry())||2)}catch(e){}
  S.exams=[];for(var i=1;i<=max;i++)S.exams.push(i);
}
function imgSig(u){return hash53(u.length+":"+u.slice(0,4000)+u.slice(-200)).slice(0,10)}
function payloadOf(q,i){
  var closed=!q.open;
  return{
    number:finalNumber(q,i),subject:qSubject(q,i),question:q.stem.trim(),image:q.image||null,
    options:closed?q.opts.map(function(o){return o.img?{text:o.t,image:o.img}:o.t}):[],
    correct:closed?q.correct:q.openAns.trim().toUpperCase(),fp:fingerprint(q.stem,closed?q.opts.map(function(o){return o.t}):[])+(q.image?"-"+imgSig(q.image):"")
  };
}
async function doSave(){
  saveBar();
  var b=S.bar,toExam=b.toExam,toBank=b.toBank;
  if(!toExam&&!toBank){toast("Hədəfi seçin: sınaq və/və ya ümumi baza","warn");return}
  var ready=S.qs.map(function(q,i){return{q:q,i:i}}).filter(function(x){return qStatus(x.q)!=="err"});
  var bad=S.qs.length-ready.length;
  if(!ready.length){toast("Yüklənə bilən sual yoxdur \u2014 xətaları düzəldin","err");return}
  var nums={},dup=false;ready.forEach(function(x){var n=finalNumber(x.q,x.i);if(nums[n])dup=true;nums[n]=1});
  if(toExam&&dup){toast("Təkrar sual nömrələri var \u2014 nömrələri düzəldin","err");return}
  if(toBank&&!(await probeBank(true))){toast("«question_bank» cədvəli yoxdur. SQL-i Supabase-də icra edin","err");return}
  var msg=ready.length+" sual yüklənəcək"+(bad?" ("+bad+" xətalı sual atılacaq)":"")+".\n";
  if(toExam)msg+="• Sınaq "+b.exam+" · "+b.cat+" kateqoriyası (eyni nömrəli suallar yenilənəcək)\n";
  if(toBank)msg+="• Ümumi baza · "+b.cat+" (təkrar suallar yenilənəcək)\n";
  if(!confirm(msg+"\nDavam edilsin?"))return;
  var btn=$("pp-save");btn.disabled=true;var res=[];
  try{
    if(toExam){
      btn.textContent="Sınağa yazılır…";
      var ex=await _supabase.from("exam_questions").select("id,q_number").eq("exam_id",String(b.exam)).eq("category",b.cat);
      if(ex.error)throw ex.error;
      var byNum={};(ex.data||[]).forEach(function(r){byNum[r.q_number]=r.id});
      var ins=[],upd=[];
      ready.forEach(function(x){
        var p=payloadOf(x.q,x.i),row={exam_id:String(b.exam),category:b.cat,q_number:p.number,subject:p.subject,question:p.question,image_url:p.image,options:p.options,correct:p.correct};
        if(byNum[p.number]!=null)upd.push({id:byNum[p.number],row:row});else ins.push(row);
      });
      for(var s=0;s<ins.length;s+=15){var r1=await _supabase.from("exam_questions").insert(ins.slice(s,s+15));if(r1.error)throw r1.error}
      for(var u=0;u<upd.length;u++){var r2=await _supabase.from("exam_questions").update(upd[u].row).eq("id",upd[u].id);if(r2.error)throw r2.error;btn.textContent="Yenilənir "+(u+1)+"/"+upd.length}
      res.push("Sınaq "+b.exam+" · "+b.cat+": "+ins.length+" yeni, "+upd.length+" yenilənmiş");
      var en=+b.exam;if(S.exams.indexOf(en)<0){try{if(typeof V2!=="undefined"&&V2.put)await V2.put("exams",{no:en,created:new Date().toISOString()});S.exams.push(en)}catch(e){}}
    }
    if(toBank){
      btn.textContent="Bazaya yazılır…";
      var rows=ready.map(function(x){var p=payloadOf(x.q,x.i);return{category:b.cat,subject:p.subject,src_number:p.number,question:p.question,image_url:p.image,has_image:!!p.image,options:p.options,correct:String(p.correct),fp:p.fp,source:S.file?S.file.name:null,_n:p.number}});
      var seen={};rows=rows.filter(function(r){if(seen[r.fp])return false;seen[r.fp]=1;return true});
      var old={};
      for(var q0=0;q0<rows.length;q0+=50){
        var ex0=await _supabase.from("question_bank").select("fp,used_in").eq("category",b.cat).in("fp",rows.slice(q0,q0+50).map(function(r){return r.fp}));
        if(ex0.error)throw ex0.error;(ex0.data||[]).forEach(function(r){old[r.fp]=Array.isArray(r.used_in)?r.used_in:[]});
      }
      rows.forEach(function(r){
        var keep=(old[r.fp]||[]).filter(function(u){return!(toExam&&String(u.exam)===String(b.exam)&&u.cat===b.cat)});
        if(toExam)keep.push({exam:String(b.exam),cat:b.cat,n:r._n});
        r.used_in=keep;delete r._n;
      });
      for(var t=0;t<rows.length;t+=15){var r3=await _supabase.from("question_bank").upsert(rows.slice(t,t+15),{onConflict:"category,fp"});if(r3.error)throw r3.error}
      res.push("Ümumi baza · "+b.cat+": "+rows.length+" sual");
    }
    S.dirty=false;toast("✅ Yükləndi \u2014 "+res.join(" | "),"ok");alert("Yükləmə tamamlandı:\n"+res.join("\n"));
    if(window.DQPP&&DQPP._bankDirty)DQPP._bankDirty();
  }catch(e){console.error(e);toast("Yazılmadı: "+(e.message||JSON.stringify(e)),"err");alert("Xəta baş verdi: "+(e.message||JSON.stringify(e))+"\nYazılmış hissə qismən ola bilər, yenidən cəhd edə bilərsiniz (eyni nömrəli suallar yenilənir).")}
  btn.disabled=false;btn.textContent="⬆ Yüklə";renderBar();
}

/* ═══════════════ 15. HADİSƏLƏR ═══════════════ */
function curQ(){return S.qs[S.sel]}
function onAct(a,t){
  var q=curQ(),i=S.sel;
  switch(a){
    case"sel":S.sel=+t.dataset.i;renderList();renderEditor();renderPreview();break;
    case"prev":if(S.sel>0){S.sel--;renderList();renderEditor();renderPreview()}break;
    case"next":if(S.sel<S.qs.length-1){S.sel++;renderList();renderEditor();renderPreview()}break;
    case"add-after":S.qs.splice(i+1,0,newQ({number:q.number+1}));S.sel=i+1;S.dirty=true;renderStats();renderList();renderEditor();renderPreview();break;
    case"del-q":if(!confirm("Bu sual siyahıdan silinsin? (PDF-ə və bazaya toxunulmur)"))return;S.qs.splice(i,1);if(!S.qs.length){renderWork();return}S.sel=Math.min(S.sel,S.qs.length-1);S.dirty=true;renderStats();renderList();renderEditor();renderPreview();break;
    case"opt-add":q.opts.push({t:"",img:null});S.dirty=true;renderEditor();renderPreview();renderList();renderStats();break;
    case"opt-del":var k=+t.dataset.k;q.opts.splice(k,1);if(q.correct===k)q.correct=-1;else if(q.correct>k)q.correct--;S.dirty=true;renderEditor();renderPreview();renderList();renderStats();break;
    case"rm-img":q.image=null;q.crops=[];S.dirty=true;renderEditor();renderPreview();renderList();break;
    case"up-img":$("pp-imgfile").click();break;
    case"opt-img":S.optImgK=+t.dataset.k;$("pp-optfile").click();break;
    case"crop":openCrop();break;
    case"reclean":cleanQuestion(q);S.dirty=true;renderEditor();renderPreview();break;
    case"restore":if(q.raw){q.stem=q.raw.stem;q.opts.forEach(function(o,k){if(q.raw.opts[k]!=null)o.t=q.raw.opts[k]});S.dirty=true;renderEditor();renderPreview()}break;
    case"ai-one":runAI([i]);break;
    case"ai-all":runAI(S.qs.map(function(_,k){return k}));break;
    case"ai-ok":acceptAI(i);renderEditor();renderPreview();renderList();renderAiBar();break;
    case"ai-no":q.ai=null;renderEditor();renderList();renderAiBar();break;
    case"ai-accept-all":S.qs.forEach(function(_,k){if(S.qs[k].ai)acceptAI(k)});renderEditor();renderPreview();renderList();renderAiBar();renderStats();break;
    case"save":doSave();break;
    case"show-sql":showSql();break;
  }
}
function showSql(){
  var m=$("pp-sql");m.style.display="flex";m.querySelector("pre").textContent=BANK_SQL;
}
function onInput(t){
  var q=curQ();if(!q)return;var f=t.dataset.f;
  if(f==="stem")q.stem=t.value;
  else if(f==="number"){q.number=+t.value||0}
  else if(f==="subject")q.subject=t.value;
  else if(f==="openAns")q.openAns=t.value;
  else if(f==="opt")q.opts[+t.dataset.k].t=t.value;
  else if(f==="correct"){q.correct=+t.dataset.k;renderEditor()}
  else if(f==="open"){q.open=t.checked;renderEditor()}
  else return;
  S.dirty=true;renderPreview();renderStats();
  var chip=document.querySelector('.pp-chip[data-i="'+S.sel+'"]');
  if(chip){chip.className="pp-chip "+qStatus(q)+" sel";chip.textContent=finalNumber(q,S.sel)+(q.ai?" ✨":"")}
}

function buildImport(){
  var root=$("mod-pdfpro");
  root.innerHTML='<div class="pp"><h4>📥 PDF-dən Sual İdxalı (Pro)</h4><p class="sub">PDF-i yükləyin \u2014 suallar, variantlar, cədvəl/fiqurlar və sondakı cavab açarı avtomatik ayrılır. Sağda iştirakçının görəcəyi görünüşü canlı yoxlayıb redaktə edə bilərsiniz.</p>'+
  '<div class="pp-drop" id="pp-drop"><b>📄 PDF faylını bura sürüşdürün və ya seçin</b><span>Sütunlu (2 sütun) və tək sütunlu test PDF-ləri dəstəklənir · skan şəkilləri deyil, mətnli PDF olmalıdır</span></div>'+
  '<input type="file" id="pp-file" accept="application/pdf,.pdf" style="display:none">'+
  '<div class="pp-opts"><label><input type="checkbox" id="pp-o-fig" checked> Cədvəl, fiqur və şəkilləri avtomatik kəs</label><label><input type="checkbox" id="pp-o-key" checked> Sondakı cavab açarını oxu</label><label><input type="checkbox" id="pp-o-clean" checked> Mətni avtomatik düzəlt (boşluq, durğu, böyük hərf)</label></div>'+
  '<div class="pp-prog" id="pp-prog"><div class="t" id="pp-prog-t"></div><div class="b"><div class="f" id="pp-prog-f"></div></div></div>'+
  '<div id="pp-work"></div></div>'+
  '<div class="pp-modal" id="pp-crop"><div class="in"><div class="pp-row" style="margin-bottom:8px"><select data-pages style="width:140px"></select><select id="pp-crop-mode" style="width:230px"><option value="replace">Mövcud şəkli əvəz et</option><option value="add">Mövcud şəklin altına əlavə et</option></select><button class="pp-b p" data-act2="crop-ok">Seçilmiş sahəni əlavə et</button><button class="pp-b" data-act2="crop-x">Bağla</button></div><canvas id="pp-crop-cv"></canvas><div style="font-size:12px;color:#64748b;margin-top:6px">Siçanla (və ya barmaqla) şəkil kimi götürüləcək sahəni çəkin.</div></div></div>'+
  '<div class="pp-modal" id="pp-sql"><div class="in" style="max-width:720px"><b>Supabase → SQL Editor-də bir dəfə icra edin:</b><pre class="pp-code" style="margin:10px 0"></pre><div class="pp-row"><button class="pp-b p" data-act2="sql-copy">Kopyala</button><button class="pp-b" data-act2="sql-x">Bağla</button></div></div></div>';
  var drop=$("pp-drop"),fi=$("pp-file");
  drop.onclick=function(){fi.click()};
  drop.ondragover=function(e){e.preventDefault();drop.classList.add("on")};
  drop.ondragleave=function(){drop.classList.remove("on")};
  drop.ondrop=function(e){e.preventDefault();drop.classList.remove("on");var f=e.dataTransfer.files[0];if(f)startFile(f)};
  fi.onchange=function(){if(fi.files[0])startFile(fi.files[0]);fi.value=""};
  root.addEventListener("click",function(e){
    var t=e.target.closest("[data-act]");if(t){e.preventDefault();onAct(t.dataset.act,t);return}
    t=e.target.closest("[data-act2]");if(!t)return;
    var a=t.dataset.act2;
    if(a==="crop-ok")cropApply();else if(a==="crop-x")$("pp-crop").style.display="none";
    else if(a==="sql-x")$("pp-sql").style.display="none";
    else if(a==="sql-copy"){try{navigator.clipboard.writeText(BANK_SQL);toast("Kopyalandı","ok")}catch(er){}}
  });
  root.addEventListener("input",function(e){var t=e.target;
    if(t.dataset&&t.dataset.f)onInput(t);
    else if(t.id==="pp-onlyp")renderList();
    else if(t.id==="pp-showans"){S.showAns=t.checked;renderPreview()}
    else if(t.id==="pp-nummode"){S.opt.numMode=t.value;$("pp-startw").style.display=t.value==="seq"?"":"none";renderStats();renderList();renderPreview()}
    else if(t.id==="pp-start"){S.opt.start=+t.value||1;renderStats();renderList();renderPreview()}
    else if(t.id==="pp-ai-key"){try{localStorage.setItem(LS_KEY,t.value.trim())}catch(er){}}
  });
  root.addEventListener("change",async function(e){
    var t=e.target;
    if(t.dataset&&t.dataset.f==="pages")return;
    if(t.dataset&&"pages" in t.dataset){CR.pn=+t.value;await cropShow();return}
    if(t.id==="pp-imgfile"&&t.files[0]){try{curQ().image=await readImageFile(t.files[0]);curQ().crops=[];S.dirty=true;renderEditor();renderPreview();renderList()}catch(er){toast(er.message,"err")}t.value=""}
    if(t.id==="pp-optfile"&&t.files[0]){try{curQ().opts[S.optImgK].img=await readImageFile(t.files[0],500);S.dirty=true;renderEditor();renderPreview()}catch(er){toast(er.message,"err")}t.value=""}
    if(t.id==="pp-o-fig")S.opt.figures=t.checked;if(t.id==="pp-o-key")S.opt.key=t.checked;if(t.id==="pp-o-clean")S.opt.clean=t.checked;
  });
  var cv=$("pp-crop-cv");
  var down=function(e){e.preventDefault();var p=cropPos(e);CR.drag=p;CR.rect={x:p.x,y:p.y,w:0,h:0}};
  var move=function(e){if(!CR.drag)return;e.preventDefault();var p=cropPos(e),d=CR.drag;CR.rect={x:Math.min(d.x,p.x),y:Math.min(d.y,p.y),w:Math.abs(p.x-d.x),h:Math.abs(p.y-d.y)};cropDraw()};
  var up=function(){CR.drag=null};
  cv.addEventListener("mousedown",down);cv.addEventListener("mousemove",move);window.addEventListener("mouseup",up);
  cv.addEventListener("touchstart",down,{passive:false});cv.addEventListener("touchmove",move,{passive:false});cv.addEventListener("touchend",up);
  window.addEventListener("beforeunload",function(e){if(S.dirty&&S.qs.length){e.preventDefault();e.returnValue=""}});
}
function startFile(f){
  if(!/\.pdf$/i.test(f.name)&&f.type!=="application/pdf"){toast("Yalnız PDF faylı seçin","err");return}
  if(S.qs.length&&S.dirty&&!confirm("Hazırkı redaktə edilməmiş dəyişikliklər itəcək. Yeni PDF yüklənsin?"))return;
  S.qs=[];$("pp-work").innerHTML="";S.bar=null;
  loadExams().then(function(){runImport(f)});
}


/* ═══════════════ 16. SUAL BAZASI MODULU ═══════════════ */
var B={rows:[],usage:null,loaded:false,loading:false,page:0,per:20,f:{cat:"",subject:"",q:"",use:""},sel:{},open:{},img:{}};
async function pagedSelect(table,cols,filter){
  var out=[],from=0,step=1000;
  for(;;){
    var q=_supabase.from(table).select(cols).range(from,from+step-1);
    if(filter)q=filter(q);
    var r=await q;if(r.error)throw r.error;
    out=out.concat(r.data||[]);if(!r.data||r.data.length<step)break;from+=step;
  }
  return out;
}
async function bankLoad(force){
  if(B.loading)return;if(B.loaded&&!force)return;
  B.loading=true;renderBank();
  try{
    if(!(await probeBank(true))){B.loading=false;B.loaded=false;B.missing=true;renderBank();return}
    B.missing=false;
    B.rows=await pagedSelect("question_bank","id,category,subject,src_number,question,options,correct,fp,source,created_at,has_image,used_in",function(q){return q.order("id",{ascending:false})});
    var ex=await pagedSelect("exam_questions","exam_id,category,q_number,question,options"),map={},exist={};
    ex.forEach(function(r){
      exist[r.exam_id+"|"+r.category+"|"+r.q_number]=1;
      var opts=Array.isArray(r.options)?r.options:[],fp=fingerprint(r.question,opts.map(optText));
      (map[fp]=map[fp]||[]).push({exam:r.exam_id,cat:r.category,n:r.q_number});
    });
    B.exist=exist;
    B.textMap=map;B.usage=true;B.loaded=true;B.page=0;B.sel={};
  }catch(e){console.error(e);toast("Baza yüklənmədi: "+(e.message||e),"err")}
  B.loading=false;renderBank();
}
function usageOf(r){
  var seen={},out=[];
  function add(x){var k=x.exam+"|"+x.cat+"|"+x.n;if(!seen[k]){seen[k]=1;out.push(x)}}
  (Array.isArray(r.used_in)?r.used_in:[]).forEach(function(u){if(B.exist&&B.exist[u.exam+"|"+u.cat+"|"+u.n])add(u)});
  if(!r.has_image&&B.textMap){var tf=r.fp.split("-")[0];(B.textMap[tf]||[]).forEach(add)}
  return out;
}
function bankFiltered(){
  var f=B.f,q=f.q.trim().toLocaleLowerCase("az");
  return B.rows.filter(function(r){
    if(f.cat&&r.category!==f.cat)return false;
    if(f.subject&&r.subject!==f.subject)return false;
    if(f.q&&(r.question||"").toLocaleLowerCase("az").indexOf(q)<0&&String(r.src_number)!==f.q.trim())return false;
    var u=usageOf(r).length>0;
    if(f.use==="used"&&!u)return false;if(f.use==="free"&&u)return false;
    return true;
  });
}
function usageHtml(r){
  var u=usageOf(r);
  if(!u.length)return'<span class="pp-tag n">İstifadə olunmayıb</span>';
  u.sort(function(a,b){return(+a.exam)-(+b.exam)||String(a.cat).localeCompare(b.cat)||a.n-b.n});
  return u.map(function(x){return'<span class="pp-tag u">✅ Sınaq '+esc(x.exam)+' · '+esc(x.cat)+' · sual '+esc(x.n)+' üzrə istifadə olunub</span>'}).join("");
}
function renderBank(){
  var root=$("mod-qbank");if(!root)return;
  if(!root.dataset.built){root.dataset.built="1";root.innerHTML='<div class="pp" id="pp-bank"></div>';
    root.addEventListener("click",bankClick);root.addEventListener("input",bankInput);root.addEventListener("change",bankInput);}
  var box=$("pp-bank");
  var head='<h4>🗄\ufe0f Sual Bazası</h4><p class="sub">Ümumi sınaq bazasına yüklənmiş suallar. Hər sualın qarşısında hansı sınaqda, hansı kateqoriyada və neçənci sual kimi istifadə edildiyi göstərilir.</p>';
  if(B.missing){box.innerHTML=head+'<div class="pp-w err">«question_bank» cədvəli hələ qurulmayıb. Aşağıdakı SQL-i Supabase → SQL Editor-də bir dəfə icra edin, sonra «Yenilə» düyməsini basın.</div><pre class="pp-code">'+esc(BANK_SQL)+'</pre><div class="pp-row" style="margin-top:8px"><button class="pp-b p" data-b="copy">SQL-i kopyala</button><button class="pp-b" data-b="reload">Yenilə</button></div>';return}
  if(B.loading&&!B.loaded){box.innerHTML=head+'<p class="sub">Yüklənir…</p>';return}
  var all=B.rows,used=all.filter(function(r){return usageOf(r).length}).length,rows=bankFiltered();
  var pages=Math.max(1,Math.ceil(rows.length/B.per));B.page=Math.min(B.page,pages-1);
  var slice=rows.slice(B.page*B.per,B.page*B.per+B.per),cats={};all.forEach(function(r){cats[r.category]=(cats[r.category]||0)+1});
  var subs={};all.forEach(function(r){if(r.subject)subs[r.subject]=1});
  var h=head+'<div class="pp-stats"><div class="pp-stat"><b>'+all.length+'</b> sual bazada</div><div class="pp-stat g"><b>'+used+'</b> istifadə olunub</div><div class="pp-stat"><b>'+(all.length-used)+'</b> istifadə olunmayıb</div>'+
    Object.keys(cats).sort().map(function(c){return'<div class="pp-stat">'+esc(c)+': <b>'+cats[c]+'</b></div>'}).join("")+'</div>';
  h+='<div class="pp-row" style="margin-bottom:10px">'+
    '<select data-bf="cat" style="max-width:150px"><option value="">Bütün kateqoriyalar</option>'+CATS.map(function(c){return'<option'+(B.f.cat===c?" selected":"")+'>'+c+'</option>'}).join("")+'</select>'+
    '<select data-bf="subject" style="max-width:190px"><option value="">Bütün fənlər</option>'+Object.keys(subs).sort().map(function(s){return'<option'+(B.f.subject===s?" selected":"")+'>'+esc(s)+'</option>'}).join("")+'</select>'+
    '<select data-bf="use" style="max-width:190px"><option value="">İstifadə vəziyyəti: hamısı</option><option value="used"'+(B.f.use==="used"?" selected":"")+'>İstifadə olunub</option><option value="free"'+(B.f.use==="free"?" selected":"")+'>İstifadə olunmayıb</option></select>'+
    '<input type="text" data-bf="q" placeholder="Mətn və ya nömrə üzrə axtar…" value="'+esc(B.f.q)+'" style="max-width:260px">'+
    '<button class="pp-b" data-b="reload">🔄 Yenilə</button><button class="pp-b d" data-b="del-sel">🗑 Seçilmişləri sil ('+Object.keys(B.sel).length+')</button></div>';
  h+='<div style="overflow:auto"><table class="pp-tbl"><thead><tr><th style="width:28px"><input type="checkbox" data-b="selall"></th><th style="width:54px">Nömrə</th><th style="width:92px">Kateqoriya</th><th>Sual</th><th style="width:34%">İstifadə</th></tr></thead><tbody>';
  slice.forEach(function(r){
    var op=B.open[r.id],opts=Array.isArray(r.options)?r.options:[];
    h+='<tr><td><input type="checkbox" data-b="sel" data-id="'+r.id+'"'+(B.sel[r.id]?" checked":"")+'></td><td><b>'+esc(r.src_number==null?"\u2014":r.src_number)+'</b></td><td><span class="pp-tag c">'+esc(r.category)+'</span><div style="font-size:11px;color:#64748b">'+esc(r.subject||"")+'</div></td>'+
      '<td><div>'+esc((r.question||"").slice(0,op?2000:150))+((r.question||"").length>150&&!op?"…":"")+(r.has_image?' 🖼':"")+'</div>'+
      '<button class="pp-b s" style="margin-top:4px" data-b="open" data-id="'+r.id+'">'+(op?"Bağla":"Bax")+'</button>'+
      (op?'<div style="margin-top:6px">'+(B.img[r.id]?'<img class="pp-img" src="'+B.img[r.id]+'">':(r.has_image?'<i style="color:#64748b">şəkil yüklənir…</i>':""))+
        opts.map(function(o,k){var cor=String(r.correct)===String(k);return'<div style="padding:3px 6px;border-radius:6px;'+(cor?"background:#dcfce7;font-weight:700":"")+'">'+"ABCDE"[k]+') '+esc(optText(o))+(cor?" ✓":"")+'</div>'}).join("")+
        (!opts.length?'<div style="padding:3px 6px;background:#dcfce7">Cavab: '+esc(r.correct)+'</div>':"")+
        '<div style="font-size:11px;color:#64748b;margin-top:4px">Mənbə: '+esc(r.source||"\u2014")+'</div></div>':"")+'</td>'+
      '<td>'+usageHtml(r)+'</td></tr>';
  });
  if(!slice.length)h+='<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px">Bu filtrlərə uyğun sual yoxdur</td></tr>';
  h+='</tbody></table></div><div class="pp-row" style="justify-content:space-between;margin-top:10px"><span style="font-size:12.5px;color:#64748b">'+rows.length+' sual · səhifə '+(B.page+1)+' / '+pages+'</span><span class="pp-row"><button class="pp-b s" data-b="pg" data-d="-1"'+(B.page?"":" disabled")+'>← Əvvəlki</button><button class="pp-b s" data-b="pg" data-d="1"'+(B.page<pages-1?"":" disabled")+'>Növbəti →</button></span></div>';
  box.innerHTML=h;
}
async function bankClick(e){
  var t=e.target.closest("[data-b]");if(!t)return;var a=t.dataset.b;
  if(a==="reload"){B.loaded=false;await bankLoad(true)}
  else if(a==="copy"){try{navigator.clipboard.writeText(BANK_SQL);toast("Kopyalandı","ok")}catch(er){}}
  else if(a==="pg"){B.page+=+t.dataset.d;renderBank()}
  else if(a==="sel"){if(t.checked)B.sel[t.dataset.id]=1;else delete B.sel[t.dataset.id];renderBank()}
  else if(a==="selall"){bankFiltered().slice(B.page*B.per,B.page*B.per+B.per).forEach(function(r){if(t.checked)B.sel[r.id]=1;else delete B.sel[r.id]});renderBank()}
  else if(a==="open"){
    var id=t.dataset.id;B.open[id]=!B.open[id];renderBank();
    var r=B.rows.filter(function(x){return String(x.id)===String(id)})[0];
    if(B.open[id]&&r&&r.has_image&&!B.img[id]){var x=await _supabase.from("question_bank").select("image_url").eq("id",id).single();if(x.data){B.img[id]=x.data.image_url;renderBank()}}
  }
  else if(a==="del-sel"){
    var ids=Object.keys(B.sel);if(!ids.length){toast("Silmək üçün sual seçin","warn");return}
    if(!confirm(ids.length+" sual bazadan həmişəlik silinsin? (Sınaqlardakı suallara toxunulmur)"))return;
    var r2=await _supabase.from("question_bank").delete().in("id",ids);
    if(r2.error){toast("Silinmədi: "+r2.error.message,"err");return}
    B.rows=B.rows.filter(function(x){return!B.sel[x.id]});B.sel={};toast("Silindi","ok");renderBank();
  }
}
function bankInput(e){
  var t=e.target;if(!t.dataset||!t.dataset.bf)return;
  if(t.dataset.bf==="q"&&e.type==="change")return;
  B.f[t.dataset.bf]=t.value;B.page=0;
  if(t.dataset.bf==="q"){clearTimeout(bankInput.tm);bankInput.tm=setTimeout(function(){var p=t.selectionStart;renderBank();var n=document.querySelector('[data-bf="q"]');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(er){}}},250)}
  else renderBank();
}

/* ═══════════════ 17. SINAQ → PDF MODULU ═══════════════ */
var EP={data:null,loading:false,opt:{key:true,cols:2,banner:true}};
async function epLoad(force){
  if(EP.loading)return;if(EP.data&&!force)return;
  EP.loading=true;renderEP();
  try{
    var rows=await pagedSelect("exam_questions","exam_id,category"),m={};
    rows.forEach(function(r){var e=String(r.exam_id);(m[e]=m[e]||{})[r.category]=((m[e]||{})[r.category]||0)+1});
    EP.data=m;
  }catch(e){console.error(e);toast("Sınaqlar yüklənmədi: "+(e.message||e),"err")}
  EP.loading=false;renderEP();
}
function renderEP(){
  var root=$("mod-exampdf");if(!root)return;
  if(!root.dataset.built){root.dataset.built="1";root.innerHTML='<div class="pp" id="pp-ep"></div>';
    root.addEventListener("click",epClick);root.addEventListener("change",function(e){var t=e.target;if(t.id==="ep-key")EP.opt.key=t.checked;if(t.id==="ep-cols")EP.opt.cols=+t.value;if(t.id==="ep-ban")EP.opt.banner=t.checked})}
  var box=$("pp-ep"),h='<h4>📑 Sınaq PDF-i</h4><p class="sub">Bazadakı sınaq suallarını səliqəli PDF-ə çevirin. Hər sınaq və kateqoriya üçün bazada olan sual sayı göstərilir. Açılan çap pəncərəsində «PDF kimi saxla» seçin.</p>';
  if(EP.loading&&!EP.data){box.innerHTML=h+'<p class="sub">Yüklənir…</p>';return}
  h+='<div class="pp-opts" style="margin-top:0"><label><input type="checkbox" id="ep-key"'+(EP.opt.key?" checked":"")+'> Sonda cavab açarı əlavə et</label><label><input type="checkbox" id="ep-ban"'+(EP.opt.banner?" checked":"")+'> Fənn başlıqları</label>'+
     '<label>Sütun: <select id="ep-cols" style="width:auto;display:inline-block"><option value="2"'+(EP.opt.cols===2?" selected":"")+'>2 sütun</option><option value="1"'+(EP.opt.cols===1?" selected":"")+'>1 sütun</option></select></label><button class="pp-b" data-e="reload">🔄 Yenilə</button></div>';
  var ex=Object.keys(EP.data||{}).sort(function(a,b){return(+a)-(+b)});
  if(!ex.length)h+='<div class="pp-w info">Bazada sınaq sualı tapılmadı.</div>';
  ex.forEach(function(e){
    var cats=Object.keys(EP.data[e]).sort(function(a,b){var ia=CATS.indexOf(a),ib=CATS.indexOf(b);return(ia<0?9:ia)-(ib<0?9:ib)||a.localeCompare(b)});
    h+='<div class="pp-card" style="margin-bottom:10px"><b style="font-size:15px">Sınaq '+esc(e)+'</b>';
    cats.forEach(function(c){
      h+='<div class="pp-row" style="justify-content:space-between;padding:8px 0;border-top:1px solid #f1f5f9;margin-top:6px"><span><span class="pp-tag c" style="font-size:13px">'+esc(c)+'</span> <b>'+EP.data[e][c]+'</b> sual</span>'+
         '<button class="pp-b p s" data-e="pdf" data-x="'+esc(e)+'" data-c="'+esc(c)+'">📄 PDF-ə çevir</button></div>';
    });
    h+='</div>';
  });
  box.innerHTML=h;
}
async function epClick(e){
  var t=e.target.closest("[data-e]");if(!t)return;
  if(t.dataset.e==="reload")await epLoad(true);
  else if(t.dataset.e==="pdf"){
    t.disabled=true;var old=t.textContent;t.textContent="Hazırlanır…";
    try{await exportExam(t.dataset.x,t.dataset.c)}catch(er){console.error(er);toast("PDF hazırlanmadı: "+(er.message||er),"err")}
    t.disabled=false;t.textContent=old;
  }
}
function optLetterList(q){return"ABCDE"}

/* Variant mətnini çapa uyğun təmizləyir: <p> işarələri yox, şəkillər real şəkil kimi */
function optPrintHtml(o){
  var raw=optText(o);raw=raw==null?"":String(raw);
  var extra=(o&&typeof o==="object"&&o.image)?o.image:"";
  var html="";
  if(/<\/?[a-z][^>]*>/i.test(raw)){
    var d=new DOMParser().parseFromString("<body>"+raw.replace(/&nbsp;|\u00a0/g," ")+"</body>","text/html");
    d.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach(function(n){n.remove()});
    d.body.querySelectorAll("img").forEach(function(im){
      var src=im.getAttribute("src")||"";
      if(/^\s*javascript:/i.test(src)){im.remove();return}
      [].slice.call(im.attributes).forEach(function(a){if(a.name!=="src")im.removeAttribute(a.name)});
      im.className="oi";
    });
    d.body.querySelectorAll("p,div,li,h1,h2,h3,h4,span").forEach(function(n){
      if(!n.textContent.trim()&&!n.querySelector("img")){n.remove();return}
      n.replaceWith.apply(n,[].slice.call(n.childNodes));
    });
    html=d.body.innerHTML.replace(/(<br\s*\/?>\s*)+$/i,"").trim();
  }else html=esc(raw.trim());
  if(extra&&html.indexOf("<img")<0)html+=(html?" ":"")+'<img class="oi" src="'+esc(extra)+'">';
  return html;
}
function buildPrintHtml(title,rows,opt){
  var css='.dq-hd{position:fixed;left:0;right:0;top:0;transform:translateY(-100%);margin-top:-3mm;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #0f2a5c;padding-bottom:1.2mm;font-family:Georgia,"Times New Roman",serif;color:#0f2a5c;z-index:5}.dq-hd .l,.dq-hd .r{font-size:10.5pt;font-weight:600;min-width:38mm}.dq-hd .r{text-align:right;font-style:italic}.dq-hd .c{display:flex;align-items:center;gap:2.5mm;font-size:15pt;font-weight:700;font-style:italic;text-align:center}.dq-wm{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-32deg);text-align:center;z-index:-1;color:#0f2a5c;opacity:.10;white-space:nowrap;font-family:Arial,sans-serif;pointer-events:none}.dq-wm svg{display:block;margin:0 auto 3mm}.dq-wm b{display:block;font-size:62pt;letter-spacing:2pt}.dq-wm i{display:block;font-size:24pt;margin-top:2mm}'+
  '@page{size:A4;margin:24mm 13mm 17mm;@bottom-center{content:"Səhifə " counter(page) " / " counter(pages);font:600 8.5pt Arial,sans-serif;color:#0f2a5c;vertical-align:top;padding-top:2mm;border-top:1px solid #c8962e}@bottom-left{content:"DQplatform";font:italic 8pt Georgia,serif;color:#7b8aa8;vertical-align:top;padding-top:2mm;border-top:1px solid #c8962e}@bottom-right{content:"By Yunis İmanov";font:italic 8pt Georgia,serif;color:#7b8aa8;vertical-align:top;padding-top:2mm;border-top:1px solid #c8962e}@top-left{content:"0504305162";font:600 10.5pt Georgia,serif;color:#0f2a5c;vertical-align:bottom;border-bottom:1.5px solid #0f2a5c;padding-bottom:1mm}@top-center{content:"DQplatform | Dövlət Qulluğu";font:italic 700 15pt Georgia,serif;color:#0f2a5c;vertical-align:bottom;border-bottom:1.5px solid #0f2a5c;padding-bottom:1mm;width:110mm}@top-right{content:"By Yunis İmanov";font:italic 600 10.5pt Georgia,serif;color:#0f2a5c;vertical-align:bottom;border-bottom:1.5px solid #0f2a5c;padding-bottom:1mm}}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{box-sizing:border-box}body{font:10.5pt/1.36 "Times New Roman",Times,serif;color:#000;margin:0}'+
   '.ttl{text-align:center;margin:1mm 0 7mm;padding:3mm 0 4mm;border-top:.6mm solid #0f2a5c;border-bottom:.6mm solid #c8962e}.ttl .ey{font:700 8pt Arial,sans-serif;letter-spacing:2.2pt;color:#c8962e;margin-bottom:1.2mm}.ttl h1{font:700 19pt Georgia,serif;color:#0f2a5c;margin:0}.ttl .sb{font:600 9pt Arial,sans-serif;color:#51607f;margin-top:1.2mm}.cols{column-count:'+opt.cols+';column-gap:9mm;column-rule:1px solid #c9d3e6}'+
   '.sec{background:linear-gradient(90deg,#0f2a5c,#1d4e9e);color:#fff;border-left:2.2mm solid #c8962e;border-radius:1.5mm;font-weight:700;letter-spacing:.4pt;text-align:center;padding:1.8mm 3mm;margin:0 0 3mm;break-inside:avoid;break-after:avoid;font-size:11.5pt}'+
   '.q{break-inside:avoid;margin:0 0 5mm}.qt{font-weight:400}.qt p{margin:0 0 1mm}.qt p:first-of-type{display:inline}.qt p:first-of-type+p{margin-top:1mm}.qn{display:inline-block;min-width:5.6mm;padding:0 1.4mm;background:#0f2a5c;color:#fff;border-radius:1.2mm;font:700 9pt Arial,sans-serif;text-align:center;margin-right:1.6mm;line-height:1.5}'+
   '.q img.f{display:block;max-width:100%;margin:2mm 0}.qt img{max-width:100%;height:auto;mix-blend-mode:multiply}.o{margin:1.1mm 0;padding-left:7mm;text-indent:-7mm;overflow:hidden}.o .ol{display:inline-block;width:4.9mm;height:4.9mm;border:.3mm solid #0f2a5c;border-radius:50%;text-align:center;font:700 7.6pt/4.5mm Arial,sans-serif;color:#0f2a5c;margin-right:1.8mm;text-indent:0;vertical-align:middle;box-sizing:border-box}.o img.oi{mix-blend-mode:multiply;max-height:20mm;display:inline-block;max-width:92%;max-height:20mm;width:auto;height:auto;vertical-align:middle;margin:1mm 0 0 1mm;text-indent:0}.dq-dl{position:fixed;right:12px;top:50%;transform:translateY(-50%);z-index:99;background:#2563eb;color:#fff;border:0;border-radius:14px;padding:14px 12px;font:700 14px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);writing-mode:vertical-rl;cursor:pointer}@media print{.dq-dl{display:none!important}}.orow{margin:1mm 0}'+
   '.key{break-before:page;padding-top:6mm}.key h2{font-size:13pt;text-align:center;margin:0 0 5mm}.kt{display:flex;flex-wrap:wrap;gap:6mm;justify-content:center}.kt table{border-collapse:collapse}.kt td:first-child{background:#eef2fa;font-weight:700;color:#0f2a5c}.kt td:last-child{font-weight:700}.key h2{color:#0f2a5c;border-bottom:.6mm solid #c8962e;padding-bottom:2mm}.kt td{border:1px solid #9fb0d0;padding:1mm 4mm;text-align:center;min-width:12mm}';
  var h='<!doctype html><html lang="az"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+css+'</style></head><body><button class="dq-dl" onclick="window.print()">⬇ Yüklə (PDF)</button><div class="dq-wm"><svg class="wm" width="190" height="190" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs><path id="rg" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs><circle cx="100" cy="100" r="96" fill="none" stroke="#0f2a5c" stroke-width="4"/><circle cx="100" cy="100" r="90" fill="none" stroke="#c8962e" stroke-width="1.5"/><circle cx="100" cy="100" r="62" fill="#0f2a5c"/><circle cx="100" cy="100" r="57" fill="none" stroke="#c8962e" stroke-width="1.5"/><text font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2.4" fill="#0f2a5c"><textPath href="#rg" startOffset="2%">DQ PLATFORM • DÖVLƏT QULLUĞU •</textPath></text><text x="100" y="116" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="52" fill="#fff">YS</text><path d="M72,128 H128" stroke="#c8962e" stroke-width="2"/><path d="M100,52 l4,9 h-8z" fill="#c8962e"/></svg><b>DQplatform</b><i>By Yunis İmanov</i></div><div class="ttl"><div class="ey">DQPLATFORM · SINAQ MATERİALI</div><h1>'+esc(title)+'</h1><div class="sb">'+rows.length+' sual</div></div><div class="cols">';
  var lastSub=null;
  rows.forEach(function(r){
    if(opt.banner&&r.subject&&r.subject!==lastSub){h+='<div class="sec">'+esc(r.subject)+'</div>';lastSub=r.subject}
    var opts=Array.isArray(r.options)?r.options:[];
    h+='<div class="q"><div class="qt"><span class="qn">'+esc(r.q_number)+'</span> '+dqPrint(r.question)+'</div>';
    if(r.image_url)h+='<img class="f" src="'+esc(r.image_url)+'">';
    var allEmpty=opts.length&&opts.every(function(o){return!String(optText(o)||"").trim()&&!(o&&o.image)});
    if(allEmpty)h+='<div class="orow">'+opts.map(function(o,k){return"ABCDE"[k]+")"}).join("&emsp;&emsp;")+'</div>';
    else opts.forEach(function(o,k){h+='<div class="o"><span class="ol">'+"ABCDE"[k]+'</span>'+optPrintHtml(o)+'</div>'});
    h+='</div>';
  });
  h+='</div>';
  if(opt.key){
    var keys=rows.map(function(r){var opts=Array.isArray(r.options)?r.options:[],c=r.correct;return[r.q_number,opts.length&&c!=null&&c!==""&&!isNaN(+c)?"ABCDE"[+c]||"?":String(c==null?"":c)]});
    var per=25,tabs="";
    for(var i=0;i<keys.length;i+=per)tabs+='<table>'+keys.slice(i,i+per).map(function(k){return'<tr><td>'+esc(k[0])+'</td><td>'+esc(k[1])+'</td></tr>'}).join("")+'</table>';
    h+='<div class="key"><h2>Cavab açarı</h2><div class="kt">'+tabs+'</div></div>';
  }
  return h+'</body></html>';
}
function dqPrint(t){
  if(typeof dqClean==="function"){try{return dqClean(t)}catch(e){}}
  return'<p>'+esc(t).replace(/\n/g,"<br>")+'</p>';
}
/* Şəkillərin ağ fonunu şəffaf edir ki, arxa fondakı watermark görünsün */
function dqUnwhite(src){
  return new Promise(function(ok){
    var im=new Image();
    im.onload=function(){
      try{
        var w=im.naturalWidth,h=im.naturalHeight;if(!w||!h||w*h>6000000)return ok(src);
        var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");x.drawImage(im,0,0);
        var d=x.getImageData(0,0,w,h),p=d.data;
        for(var i=0;i<p.length;i+=4){var m=Math.min(p[i],p[i+1],p[i+2]);if(m>=246)p[i+3]=0;else if(m>=226)p[i+3]=Math.min(p[i+3],Math.round((246-m)/20*255))}
        x.putImageData(d,0,0);ok(c.toDataURL("image/png"));
      }catch(e){ok(src)}
    };
    im.onerror=function(){ok(src)};im.src=src;
  });
}
async function dqUnwhiteHtml(html){
  var re=/(<img[^>]*?\ssrc=")(data:image\/[^"]+)(")/g,m,list=[],seen={};
  while((m=re.exec(html))){if(!seen[m[2]]){seen[m[2]]=1;list.push(m[2])}}
  var map={};for(var i=0;i<list.length;i++)map[list[i]]=await dqUnwhite(list[i]);
  return html.replace(re,function(a,p,u,q){return p+(map[u]||u)+q});
}
async function exportExam(exam,cat){
  var rows=await pagedSelect("exam_questions","q_number,subject,question,image_url,options,correct",function(q){return q.eq("exam_id",String(exam)).eq("category",cat).order("q_number",{ascending:true})});
  if(!rows.length){toast("Bu sınaqda sual yoxdur","warn");return}
  rows.sort(function(a,b){return a.q_number-b.q_number});
  var html=buildPrintHtml("Sınaq "+exam+" · "+cat+" kateqoriyası",rows,EP.opt);
  try{html=await dqUnwhiteHtml(html)}catch(e){console.error(e)}
  window.DQPP._lastPrintHtml=html;
  var w=null;try{w=window.open("","_blank")}catch(e){}
  if(w){
    w.document.open();w.document.write(html);w.document.close();
    toast("Önizləmə açıldı — sağdakı «Yüklə» düyməsini basın ("+rows.length+" sual)","ok");
    return;
  }
  var old=document.getElementById("pp-printframe");if(old)old.remove();
  var f=document.createElement("iframe");f.id="pp-printframe";f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  var d=f.contentWindow.document;d.open();d.write(html);d.close();
  await new Promise(function(ok){
    var ims=[].slice.call(d.images),left=ims.length;if(!left)return ok();
    var done=function(){if(--left<=0)ok()};ims.forEach(function(i){if(i.complete)done();else{i.onload=done;i.onerror=done}});setTimeout(ok,8000);
  });
  await sleep(200);
  f.contentWindow.focus();f.contentWindow.print();
  toast("Çap pəncərəsində «PDF kimi saxla» seçin ("+rows.length+" sual)","ok");
}

/* ═══════════════ 18. QOŞULMA (admin panelə) ═══════════════ */
var built={imp:false};
function openTab(name){try{if(typeof switchAdminTab==="function")switchAdminTab(name)}catch(e){console.error(e)}}
function ensureModules(){
  var panel=$("admin-panel");if(!panel)return false;
  var grid=panel.querySelector(".admin-nav-grid");
  if(!$("pp-css")){var st=document.createElement("style");st.id="pp-css";st.textContent=CSS;document.head.appendChild(st)}
  ["pdfpro","qbank","exampdf"].forEach(function(id){
    if(!$("mod-"+id)){var d=document.createElement("div");d.id="mod-"+id;d.className="admin-module-block";panel.appendChild(d)}
  });
  if(grid&&!grid.querySelector("[data-pp-card]")){
    var cards=[
      ["DQPP.openImport()","📥","PDF-dən Sual İdxalı (Pro)","linear-gradient(135deg,#2563eb,#7c3aed)"],
      ["DQPP.openBank()","🗄\ufe0f","Sual Bazası","linear-gradient(135deg,#0f766e,#0891b2)"],
      ["DQPP.openExamPdf()","📑","Sınaq PDF-i","linear-gradient(135deg,#b45309,#dc2626)"]
    ];
    for(var i=cards.length-1;i>=0;i--){
      var c=document.createElement("div");c.className="admin-nav-card";c.setAttribute("data-pp-card","1");c.setAttribute("onclick",cards[i][0]);
      c.style.cssText="background:"+cards[i][3]+";color:#fff";c.innerHTML='<span class="icon">'+cards[i][1]+'</span> '+cards[i][2];
      grid.insertBefore(c,grid.firstChild);
    }
  }
  return true;
}
window.DQPP={
  version:VERSION,
  openImport:function(){ensureModules();openTab("pdfpro");if(!built.imp){buildImport();built.imp=true}loadExams().then(function(){if(S.qs.length)renderBar()})},
  openBank:function(){ensureModules();openTab("qbank");renderBank();bankLoad(false)},
  openExamPdf:function(){ensureModules();openTab("exampdf");renderEP();epLoad(false)},
  _bankDirty:function(){B.loaded=false},
  _t:{pickStarts:pickStarts,blockText:blockText,hasOptions:hasOptions,isHeaderLine:isHeaderLine,S:S,buildPrintHtml:buildPrintHtml,cleanInline:cleanInline,polishStem:polishStem,polishOptions:polishOptions,fingerprint:fingerprint,readPage:readPage,buildQuestions:buildQuestions,parseKey:parseKey,renderCrops:renderCrops,wordDiff:wordDiff,runImport:runImport,doSave:doSave}
};
(function boot(){
  var n=0,iv=setInterval(function(){try{ensureModules()}catch(e){}if(++n>40)clearInterval(iv)},250);
  setInterval(function(){try{ensureModules()}catch(e){}},2000);
})();

})();
