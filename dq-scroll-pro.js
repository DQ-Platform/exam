/*!
 * DQ Platform — Sürüşmə qoruması (v1, müstəqil fayl)
 * Məqsəd: ana səhifə və bütün ekranlar həmişə yuxarı-aşağı sürüşsün.
 *  1) toxunuşu «dondurmağa» çalışan preventDefault çağırışlarını şaquli sürüşmədə zərərsiz edir
 *     (kətan, sürüşdürücü, mətn sahəsi və üzən düymə istisnadır)
 *  2) touch-action:none olan valideynləri (səhifə, #v3-root, #v2-root) sürüşməyə açır
 *  3) pəncərə bağlandıqdan sonra ilişib qalan overflow:hidden / dqh-lock / dqg-pre kilidlərini açır
 * Qoşulma: bütün digər skriptlərdən SONRA
 *   <script src="dq-scroll-pro.js?v=1"></script>
 */
/* Ana səhifə sürüşməsi: ilişmiş kilidləri açır, toxunuşu dondurmağa çalışan kodu şaquli sürüşmədə zərərsiz edir */
(function(){"use strict";if(window.__dqScrollFix)return;window.__dqScrollFix=1;
var D=document,H=D.documentElement,KEEP="canvas,input[type=range],textarea,select,#dq13-dock,.dz-img,.rt-ed,.rt-handle,.annotation-canvas,.cropgen-canvas-wrap,.v2-cv,[data-keep-touch]";
var P=Event.prototype.preventDefault,vert=false,sx=0,sy=0;
function inKeep(t){try{return !!(t&&t.closest&&t.closest(KEEP))}catch(e){return false}}
/* touch-action:none olan valideynləri (düymə/kətan istisna) sürüşməyə açır */
function freeTA(t){try{for(var e=t,k=0;e&&e.nodeType===1&&k<14;e=e.parentElement,k++){
 if(inKeep(e)||e.id==="dq13-dock")break;
 if(getComputedStyle(e).touchAction==="none")e.style.setProperty("touch-action","auto","important")}}catch(x){}}
addEventListener("touchstart",function(e){var t=e.touches&&e.touches[0];if(!t)return;sx=t.clientX;sy=t.clientY;vert=false;freeTA(e.target)},{capture:true,passive:true});
addEventListener("touchmove",function(e){if(vert)return;var t=e.touches&&e.touches[0];if(!t)return;var dx=Math.abs(t.clientX-sx),dy=Math.abs(t.clientY-sy);if(dy>8&&dy>dx*1.2)vert=true},{capture:true,passive:true});
["touchend","touchcancel"].forEach(function(n){addEventListener(n,function(){vert=false},{capture:true,passive:true})});
Event.prototype.preventDefault=function(){
 try{if(this.type==="touchmove"&&vert&&this.cancelable&&!inKeep(this.target))return}catch(e){}
 return P.apply(this,arguments)};
/* ilişmiş sinif/stil kilidləri */
function shown(e){return !!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden")}
function free(){try{var B=D.body;if(!B)return;
 [H,B,D.getElementById("v3-root"),D.getElementById("v2-root")].forEach(function(e){if(e&&getComputedStyle(e).touchAction==="none")e.style.setProperty("touch-action","auto","important")});
 if(H.classList.contains("dqh-lock")&&!shown(D.getElementById("dqh-login")))H.classList.remove("dqh-lock");
 if(H.classList.contains("dqg-pre")&&!D.getElementById("dqg-shell"))H.classList.remove("dqg-pre");
 var hv=D.getElementById("dqg-host"),open=(hv&&hv.style.display==="block")||shown(D.getElementById("dqes-host"))||D.querySelector("#dqx-ov.on,#dqa-ov.on,#rga.on,.dqe,.dqc,#admin-panel:not([hidden]),#exam-screen:not([hidden])");
 var adm=D.getElementById("admin-panel"),ex=D.getElementById("exam-screen");
 if(shown(adm)||shown(ex)||B.classList.contains("dqh-split"))return;
 if(!open){["overflow","overflowY"].forEach(function(p){if(B.style[p]==="hidden")B.style[p]="";if(H.style[p]==="hidden")H.style[p]=""});
  if(B.style.position==="fixed"){B.style.position="";B.style.top="";B.style.width=""}}
 var r=D.getElementById("v3-root");
 if(r&&shown(r)&&!open){if(r.style.overflowY==="hidden"||r.style.overflow==="hidden"){r.style.overflow="";r.style.overflowY=""}}
}catch(e){}}
setInterval(free,600);["pageshow","focus","visibilitychange","orientationchange","resize"].forEach(function(n){addEventListener(n,function(){setTimeout(free,60)},{passive:true})});
})();
