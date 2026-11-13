/* Ana menyuya «MÖVZU SINAĞI» bəndi əlavə edir (movzu.html-ə keçid) */
(function(){"use strict";if(location.pathname.indexOf("movzu")>-1)return;var tries=0;
function add(){if(document.getElementById("dq-mv-nav"))return true;
 var c=document.querySelectorAll("a,button,li,div,span"),el=null;
 for(var i=0;i<c.length;i++){var e=c[i];if(e.children.length<=1&&/^sınaqlar$/i.test((e.textContent||"").replace(/\s+/g," ").trim())&&e.offsetParent!==null&&e.getBoundingClientRect().top<260){el=e;break}}
 if(!el)return false;
 var host=el.closest("a,button,li")||el,n=host.cloneNode(true);n.id="dq-mv-nav";n.removeAttribute("onclick");n.removeAttribute("href");n.classList.remove("active","on");
 var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),t;while(t=w.nextNode()){if(t.nodeValue.trim()){t.nodeValue="Mövzu sınağı";break}}
 n.style.cursor="pointer";n.addEventListener("click",function(ev){ev.preventDefault();ev.stopPropagation();location.href="movzu.html"},true);
 host.parentNode.insertBefore(n,host.nextSibling);return true}
function loop(){if(add()||++tries>40)return;setTimeout(loop,500)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loop);else loop();
new MutationObserver(function(){if(!document.getElementById("dq-mv-nav")&&tries<200){tries++;add()}}).observe(document.documentElement,{childList:true,subtree:true});
})();
