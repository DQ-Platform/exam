/* DQ PATCH — </body>-dən əvvəl <script> ... </script> daxilinə qoyun */
(function(){'use strict';
var VAPID_PUBLIC='BURAYA_VAPID_PUBLIC_KEY';
var $=function(i){return document.getElementById(i)},p2=function(n){return String(n).padStart(2,'0')},
hm=function(d){return p2(d.getHours())+':'+p2(d.getMinutes())},
dmy=function(d){return p2(d.getDate())+'.'+p2(d.getMonth()+1)+'.'+d.getFullYear()},
say=function(t){typeof dqToast==='function'?dqToast(t):alert(t)};

/* ---------- CSS ---------- */
var st=document.createElement('style');st.textContent=`
.lx-cv{position:relative;overflow:hidden}
.dqv{position:absolute;inset:0;background:linear-gradient(120deg,#071f52,#0a2f7a,#2f63bd,#0a2f7a);background-size:300% 300%;animation:dqvBg 9s ease infinite}
.dqv:before{content:"";position:absolute;inset:0;opacity:.6;background:repeating-linear-gradient(0deg,#ffffff0d 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,#ffffff0d 0 1px,transparent 1px 32px);-webkit-mask-image:radial-gradient(circle at 50% 50%,#000,transparent 75%);mask-image:radial-gradient(circle at 50% 50%,#000,transparent 75%)}
.dqv:after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,#ffffff40 50%,transparent 60%);transform:translateX(-120%);animation:dqvShine 4.5s ease-in-out infinite}
.dqv .sq{position:absolute;border-radius:22%;transform:rotate(45deg);background:linear-gradient(135deg,#bcd2f5b3,#3f74c940);animation:dqvF 7s ease-in-out infinite}
.dqv .sq.g{background:linear-gradient(135deg,#d9a441cc,#d9a44122)}
.dqv .ring{position:absolute;left:50%;top:50%;width:158px;height:158px;margin:-79px 0 0 -79px;border:2px dashed #d9a441a6;border-radius:50%;animation:dqvR 16s linear infinite}
.dqv .ring i{position:absolute;font-style:normal;font-size:20px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#ffffff26;backdrop-filter:blur(4px);display:grid;place-items:center;animation:dqvR 16s linear infinite reverse}
.dqv .pulse{position:absolute;left:50%;top:50%;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:2px solid #fff9;animation:dqvP 2.6s ease-out infinite}
.dqv .pulse.b{animation-delay:1.3s}
.dqv .cap{position:absolute;left:50%;top:50%;font-size:64px;line-height:1;transform:translate(-50%,-50%);animation:dqvCap 3.6s ease-in-out infinite;filter:drop-shadow(0 12px 18px #0006)}
.dqv .cl{position:absolute;left:0;right:0;bottom:10px;height:20px;text-align:center}
.dqv .cl span{position:absolute;left:0;right:0;font:800 12px/20px system-ui,Arial;letter-spacing:2px;text-transform:uppercase;color:#fff;opacity:0;animation:dqvT 9s infinite}
.dqv .cl span:nth-child(2){animation-delay:3s}.dqv .cl span:nth-child(3){animation-delay:6s}
@keyframes dqvBg{50%{background-position:100% 100%}}
@keyframes dqvShine{0%,55%{transform:translateX(-120%)}to{transform:translateX(120%)}}
@keyframes dqvF{50%{transform:rotate(60deg) translate(10px,-18px)}}
@keyframes dqvR{to{transform:rotate(360deg)}}
@keyframes dqvP{0%{transform:scale(.7);opacity:.9}to{transform:scale(2);opacity:0}}
@keyframes dqvCap{0%,100%{transform:translate(-50%,-50%) rotate(-8deg)}30%{transform:translate(-50%,-78%) rotate(10deg) scale(1.06)}60%{transform:translate(-50%,-50%) rotate(-4deg)}}
@keyframes dqvT{0%{opacity:0;transform:translateY(8px)}8%,28%{opacity:1;transform:none}36%,100%{opacity:0;transform:translateY(-8px)}}
#dq-bell{position:fixed;left:14px;bottom:16px;z-index:900;width:46px;height:46px;border:0;border-radius:50%;background:linear-gradient(135deg,#0a2f7a,#2f63bd);color:#fff;font-size:20px;cursor:pointer;box-shadow:0 8px 20px #0a2f7a66}
#dq-bell.on{background:linear-gradient(135deg,#16a34a,#0f7a37)}
#dq-bell:not(.on){animation:dqvRing 2.4s ease-in-out infinite}
@keyframes dqvRing{0%,60%,100%{transform:rotate(0)}65%{transform:rotate(14deg)}75%{transform:rotate(-12deg)}85%{transform:rotate(8deg)}}
#dq-ask{position:fixed;left:12px;right:12px;bottom:74px;z-index:901;max-width:420px;background:#fff;border-radius:18px;padding:16px;box-shadow:0 18px 44px #0f172a59;border-top:4px solid #d9a441;font-family:inherit;animation:dqPop .4s both}
#dq-ask b{display:block;font-size:15px;color:#0a2f7a;margin-bottom:4px}#dq-ask p{margin:0 0 12px;font-size:13px;color:#475569;line-height:1.5}
#dq-ask div{display:flex;gap:8px}#dq-ask button{flex:1;border:0;border-radius:12px;padding:11px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
#dq-ask .y{background:#0a2f7a;color:#fff}#dq-ask .n{background:#eef3fc;color:#0a2f7a}`;
document.head.appendChild(st);

/* ---------- 1. Animasiyalı qapaq (şəkil yoxdursa) ---------- */
var SCENE='<div class="dqv"><i class="sq" style="width:76px;height:76px;left:-18px;top:10%"></i><i class="sq g" style="width:44px;height:44px;right:12%;top:8%;animation-delay:-2s"></i><i class="sq" style="width:96px;height:96px;right:-26px;bottom:6%;animation-delay:-4s"></i><i class="sq g" style="width:34px;height:34px;left:14%;bottom:14%;animation-delay:-1s"></i><div class="ring"><i style="top:0;left:50%">📝</i><i style="top:50%;left:100%">✅</i><i style="top:100%;left:50%">⏱️</i><i style="top:50%;left:0">🏆</i></div><div class="pulse"></div><div class="pulse b"></div><div class="cap">🎓</div><div class="cl"><span>Hazırlaş</span><span>Qeydiyyatdan keç</span><span>Uğur qazan</span></div></div>';
function paint(){document.querySelectorAll('.lx-cv').forEach(function(cv){var bg=cv.style.backgroundImage;if(bg&&bg!=='none'||cv.querySelector('.dqv'))return;cv.textContent='';cv.insertAdjacentHTML('beforeend',SCENE)})}

/* ---------- 2. Admin: paylaşımda görünən kateqoriya ---------- */
function adminFields(){var n=$('lx-name');if(!n||$('lx-catline'))return;
n.closest('.v2-f').insertAdjacentHTML('afterend','<div class="v2-f mt-3"><label>Paylaşımda görünən kateqoriya (təsdiq edin)</label><input class="v2-in" id="lx-catline" placeholder="Məs: BB(Ba,Ac)"><small class="v2-sub">Paylaşım: «Sınaq kateqoriyaları …». Boş qalsa seçilmiş kateqoriya yazılır.</small></div>');
var c=$('lx-cat');if(c){$('lx-catline').value=c.value;c.addEventListener('change',function(){$('lx-catline').value=c.value})}}

/* ---------- 3. Paylaşım mətni (link /qeydiyyat — qapaq şəkli ilə önizləmə) ---------- */
function shareText(x){var s=new Date(x.start),e=LX.endOf(x),same=dmy(s)===dmy(e);
return '📢 '+(x.type||'Qəbul tipli sınaq')+' — Sınaq kateqoriyaları '+(x.catline||x.cat)+
'\n📅 İmtahan tarixi: '+dmy(s)+' · '+hm(s)+'–'+(same?'':dmy(e)+' ')+hm(e)+
'\n🔒 Yalnız qeydiyyatdan keçmiş tələbələr · FİN kod ilə yaxud təsdiqlənmiş iştirak kodu ilə.'+
'\n📝 Qeydiyyat üçün:\n🌐 '+location.origin+'/qeydiyyat'}
function hook(){if(window.LX&&LX.endOf&&!(LX.shareText&&LX.shareText.__dq)){LX.shareText=shareText;shareText.__dq=1}}

/* ---------- 4. Bildirişlər ---------- */
function u8(u){var b=atob((u+'='.repeat((4-u.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/')),o=new Uint8Array(b.length);for(var i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function enable(){
if(!('serviceWorker' in navigator)||!('PushManager' in window)){say('iPhone-da əvvəlcə Safari → Paylaş → «Ana ekrana əlavə et», sonra bildirişi açın.');return}
if(await Notification.requestPermission()!=='granted'){say('Bildiriş icazəsi verilmədi');return}
try{var reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID_PUBLIC)}),j=sub.toJSON();
if(localStorage.getItem('dq_push_ep')!==j.endpoint){await V2.put('push_subs',{endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,date:new Date().toISOString()});localStorage.setItem('dq_push_ep',j.endpoint)}
say('🔔 Bildirişlər açıldı');}catch(e){say('Bildiriş açılmadı: '+e.message)}ui()}
function ui(){var on='Notification' in window&&Notification.permission==='granted'&&localStorage.getItem('dq_push_ep'),b=$('dq-bell');
if(!b){b=document.createElement('button');b.id='dq-bell';b.title='Bildirişlər';b.textContent='🔔';b.onclick=function(){on_()?say('Bildirişlər artıq açıqdır ✅'):enable()};document.body.appendChild(b)}
b.classList.toggle('on',!!on);var a=$('dq-ask');a&&on&&a.remove()}
function on_(){return 'Notification' in window&&Notification.permission==='granted'&&localStorage.getItem('dq_push_ep')}
function ask(){if(on_()||!('Notification' in window)||Notification.permission==='denied'||localStorage.getItem('dq_ask_no')||$('dq-ask'))return;
var d=document.createElement('div');d.id='dq-ask';d.innerHTML='<b>🔔 Bildirişləri aç</b><p>Yeni sınaq, test, xəbər və elanlar paylaşılanda dərhal xəbərdar olun.</p><div><button class="n">Sonra</button><button class="y">Aç</button></div>';
d.querySelector('.y').onclick=function(){d.remove();enable()};d.querySelector('.n').onclick=function(){localStorage.setItem('dq_ask_no','1');d.remove()};document.body.appendChild(d)}

/* Admin yeni elan/sınaq yaradanda bildiriş göndər */
function wrapPut(){if(!window.V2||V2.put.__dq)return;var o=V2.put;
V2.put=async function(c,obj,id){
if(c==='liveexams'&&!id){var cl=$('lx-catline');cl&&cl.value.trim()&&(obj.catline=cl.value.trim())}
var r=await o.apply(this,arguments);
if(!id&&(c==='news'||c==='liveexams'))setTimeout(function(){push(c,obj)},400);return r};V2.put.__dq=1}
async function push(c,o){if(!confirm('Bildiriş abunəçilərinə göndərilsin?'))return;
var m=c==='liveexams'?{title:'📢 Yeni sınaq elan olundu',body:o.title+' ('+(o.catline||o.cat)+') — '+dmy(new Date(o.start))+' '+hm(new Date(o.start)),url:'/qeydiyyat',image:'/cover/latest.jpg'}
:{title:'📰 '+(o.kind||'Elan')+': '+o.title,body:String(o.body||'').slice(0,120),url:'/?news=1',image:''};
m.ts=Date.now();
try{await o_put('push_msg',m);var r=await fetch('/push/notify',{method:'POST',headers:{'x-admin-key':ADMIN_PASS}});var j=await r.json();say('Bildiriş göndərildi: '+(j.sent||0)+' nəfər')}catch(e){say('Bildiriş göndərilmədi: '+e.message)}}
function o_put(c,o){return V2.put.__raw?V2.put.__raw.call(V2,c,o):V2.put(c,o)}

/* ---------- işə sal ---------- */
var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){paint();adminFields();hook()},120)}).observe(document.body,{childList:true,subtree:true});
setInterval(function(){hook();wrapPut()},1500);paint();hook();wrapPut();ui();setTimeout(ask,9000);
if(/[?&]reg=1/.test(location.search))setTimeout(function(){try{LXP.open()}catch(e){}},2500);
})();
/* DQ Platform – service worker (PWA) */
const VERSION = 'dq-v3';
const CORE = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;           /* Supabase və s. toxunulmur */

  if (r.mode === 'navigate') {                          /* səhifə: əvvəl şəbəkə, oflayn olanda keş */
    e.respondWith(
      fetch(r).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./').then((x) => x || Response.error()))
    );
    return;
  }
  e.respondWith(                                        /* fayllar: keş + arxada yenilə */
    caches.match(r).then((hit) => {
      const net = fetch(r).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(r, copy)).catch(() => {}); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
/* service-worker.js faylınızın SONUNA əlavə edin (mövcud kodu silməyin) */
self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'DQ Platform', {
    body: d.body || '', icon: d.icon || 'icon-512.png', badge: d.badge || 'icon-512.png',
    data: { url: d.url || './' }, tag: d.tag || undefined
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) { list[i].navigate(url); return list[i].focus(); }
    return clients.openWindow(url);
  }));
});

