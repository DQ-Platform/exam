(function(){if(!window.__dqTema){window.__dqTema=1;var O=window.MutationObserver;O&&(window.MutationObserver=function(cb){var q=[],t=0,obs;function run(){t=0;var r=q;if(q=[],r.length)try{cb.call(obs,r,obs)}catch(e){console.error(e)}}obs=new O(function(m){for(var i=0;i<m.length;i++)q.push(m[i]);t||(t=setTimeout(run,60))});var dc=obs.disconnect;return obs.disconnect=function(){return t&&(clearTimeout(t),t=0),q=[],dc.call(obs)},obs},window.MutationObserver.prototype=O.prototype);var SI=window.setInterval;window.setInterval=function(fn,ms){if(typeof fn!="function")return SI.apply(window,arguments);var a=[].slice.call(arguments,2);return ms<250&&(ms=250),SI.call(window,function(){document.hidden||fn.apply(null,a)},ms)};try{var AE=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,f,o){return(t==="scroll"||t==="touchstart"||t==="touchmove"||t==="wheel")&&(o===void 0||o===!1)&&(o={passive:!0}),AE.call(this,t,f,o)}}catch{}document.addEventListener("DOMContentLoaded",function(){var f=function(root){(root||document).querySelectorAll("img:not([loading])").forEach(function(i){i.loading="lazy",i.decoding="async"})};f(),setTimeout(f,2500)})}  /* 5) Açılış pəncərələri növbə ilə: modal > kuki/yüklə > bildiriş */
  function vis(sel){var e=document.querySelector(sel);return !!(e&&e.offsetWidth>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden')}
  function q(){
    var b=document.body;if(!b)return;
    var m=vis('.dqg-ov.on')||vis('.dqg-ov2.on')||vis('.dqg-ov');
    b.classList.toggle('dq-q1',m);
    b.classList.toggle('dq-q2',!m&&vis('#dq-pwa-wrap'));
  }
  setInterval(q,500);document.addEventListener('DOMContentLoaded',q);
  /* 6) Tünd göy fonda qırmızı mətn oxunmur -> açıq tonla əvəz et */
  function lum(c){var m=c.match(/[\d.]+/g);if(!m)return 1;var a=m.slice(0,3).map(function(v){v=+v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*a[0]+.7152*a[1]+.0722*a[2]}
  function bgOf(e){while(e){var c=getComputedStyle(e).backgroundColor,m=c.match(/[\d.]+/g);if(m&&(m.length<4||+m[3]>.6))return c;e=e.parentElement}return'rgb(255,255,255)'}
  var busy=0;
  function fix(){
    if(busy||document.hidden)return;busy=1;
    var root=document.getElementById('dqr');if(!root){busy=0;return}
    var els=root.querySelectorAll('a,span,b,i,button,small,em,strong,p,h1,h2,h3,h4,li,div');
    for(var i=0;i<els.length;i++){
      var e=els[i];if(e.classList.contains('dq-lc')||e.classList.contains('dq-lw')||!e.firstChild)continue;
      var t=false;for(var n=e.firstChild;n;n=n.nextSibling){if(n.nodeType===3&&n.textContent.trim()){t=true;break}}
      if(!t)continue;
      var cs=getComputedStyle(e),m=cs.color.match(/[\d.]+/g);if(!m)continue;
      var r=+m[0],g=+m[1],b=+m[2];
      if(cs.color.indexOf('color(')===0){r=m[0]*255;g=m[1]*255;b=m[2]*255}
      if(r>150&&g<140&&b<130&&r-g>90){
        var a=lum(cs.color),c=lum(bgOf(e));
        if((Math.max(a,c)+.05)/(Math.min(a,c)+.05)<3)e.classList.add(c<.2?'dq-lc':'dq-lw');
      }
    }
    busy=0;
  }
  var ft=0;function sched(){clearTimeout(ft);ft=setTimeout(fix,350)}
  document.addEventListener('click',sched,true);window.addEventListener('load',function(){setTimeout(fix,800);setTimeout(fix,3500)});
})();
