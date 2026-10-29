/* =====================================================================
   DQ Vaxtlı Quiz — dq-quiz.js?v=1
   • Admin: «🎯 Vaxtlı Quiz Sınaqları» (admin paneldə kart) — quiz yarat, sual əlavə et (əl ilə / toplu yapışdır /
     bazadan), başlama–bitmə vaxtı təyin et, hər quiz üçün öz linki, avtomatik aktivləşmə, siyahı, nəticələr (Excel).
   • İştirakçı: ?dqquiz=ID linki → gözləmə taymeri → ad-soyad + qeydiyyat yoxlaması → quiz → nəticə səhifəsi.
   • Ana səhifə: «Hamıya açıq» quizlər üçün başlamağa qalan vaxt taymeri; taymer bitəndə avtomatik aktivləşir.
   Məlumat: Supabase dq_v2_store (collection = dqq_quizzes / dqq_attempts). Yeni cədvəl tələb olunmur.
   ===================================================================== */
(function () {
  "use strict";
  if (window.DQQZ) return;
  var D = document, U = "https://cpzwliqlgaplroscvduo.supabase.co", K = "sb_publishable_1clDyHhxAiSCurwGHwMi3g_rrs17eYF";
  var COL = "dqq_quizzes", ACOL = "dqq_attempts", LET = "ABCDE", SUBJ = ["Azərbaycan dili", "Qanunvericilik", "İnformatika", "Məntiq", "Ümumi"];
  var skew = 0;

  /* ------------------------------------------------------------ köməkçilər */
  function now() { return Date.now() + skew; }
  function $(i) { return D.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(ms) { var d = new Date(+ms); return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function hms(s) { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s % 3600 / 60)) + ":" + pad(s % 60); }
  function toLocal(ms) { var d = new Date(+ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fromLocal(v) { var t = new Date(v).getTime(); return isNaN(t) ? 0 : t; }
  function norm(s) { return String(s == null ? "" : s).toLocaleLowerCase("az").replace(/\s+/g, " ").trim(); }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function ldel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function jparse(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }
  function strip(h) { var t = D.createElement("div"); t.innerHTML = String(h || ""); return (t.textContent || "").replace(/\s+/g, " ").trim(); }
  function safeHtml(h) {
    return String(h || "").replace(/<\s*(script|iframe|object|embed|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "").replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "");
  }
  function qBody(q) { return q.h ? safeHtml(q.t) : esc(q.t).replace(/\n/g, "<br>"); }
  function imgTag(s, cls) { return s ? '<img class="' + (cls || "dqqz-im") + '" src="' + esc(s) + '" alt="">' : ""; }
  function toast(msg, bad) {
    var o = $("dqqz-toast"); if (o) o.remove();
    o = D.createElement("div"); o.id = "dqqz-toast"; o.textContent = msg;
    o.setAttribute("style", "position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483600;background:" + (bad ? "#b91c1c" : "#0f172a") + ";color:#fff;padding:11px 16px;border-radius:12px;font:600 13px system-ui,sans-serif;box-shadow:0 10px 30px #0006;max-width:92vw;text-align:center");
    D.body.appendChild(o); setTimeout(function () { o.remove(); }, 3200);
  }
  function copy(t) {
    return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { return true; }, function () {
      var a = D.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; D.body.appendChild(a); a.select();
      var ok = false; try { ok = D.execCommand("copy"); } catch (e) { } a.remove(); return ok;
    });
  }
  function readImg(file, max) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onerror = function () { no(new Error("Şəkil oxunmadı")); };
      r.onload = function () {
        var i = new Image();
        i.onerror = function () { no(new Error("Şəkil açılmadı")); };
        i.onload = function () {
          var s = Math.min(1, (max || 900) / Math.max(i.width, i.height)), c = D.createElement("canvas");
          c.width = Math.max(1, Math.round(i.width * s)); c.height = Math.max(1, Math.round(i.height * s));
          var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(i, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/jpeg", 0.82));
        };
        i.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------ server */
  function hdr(x) { var h = { apikey: K, Authorization: "Bearer " + K, "Content-Type": "application/json" }; for (var k in x) h[k] = x[k]; return h; }
  async function api(path, o) {
    o = o || {}; o.headers = hdr(o.headers);
    var r = await fetch(U + "/rest/v1/" + path, o);
    try { var dh = r.headers && r.headers.get("date"); if (dh) { var t = Date.parse(dh); if (t && Math.abs(t - Date.now()) < 864e5) skew = t - Date.now(); } } catch (e) { }
    if (!r.ok) { var tx = ""; try { tx = await r.text(); } catch (e) { } throw new Error("Server " + r.status + " " + tx.slice(0, 140)); }
    if (r.status === 204) return null;
    var t2 = await r.text(); return t2 ? JSON.parse(t2) : null;
  }
  var LIGHT = "id,title:data->>title,subject:data->>subject,mode:data->>mode,start:data->>start,end:data->>end,manual:data->>manual,n:data->>n,reg:data->>reg,dur:data->>dur,created:data->>created";
  function lightQ(r) { return { id: r.id, title: r.title || "Quiz", subject: r.subject || "", mode: r.mode || "link", start: +r.start || 0, end: +r.end || 0, manual: r.manual || "", n: +r.n || 0, reg: r.reg !== "false", dur: +r.dur || 0, created: +r.created || 0 }; }
  async function listQuizzes() { var a = await api("dq_v2_store?select=" + LIGHT + "&collection=eq." + COL + "&order=id.desc&limit=300"); return (a || []).map(lightQ); }
  async function loadQuiz(id) {
    var a = await api("dq_v2_store?select=id,data&collection=eq." + COL + "&id=eq." + encodeURIComponent(id) + "&limit=1");
    if (!a || !a[0]) return null; var q = a[0].data || {}; q.id = a[0].id; q.qs = q.qs || []; return q;
  }
  async function saveQuiz(q) {
    q.n = q.qs.length; var d = JSON.parse(JSON.stringify(q)); delete d.id;
    if (q.id) { await api("dq_v2_store?id=eq." + q.id, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: d }) }); return q.id; }
    var a = await api("dq_v2_store", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ collection: COL, data: d }) });
    q.id = a && a[0] && a[0].id; return q.id;
  }
  async function patchQuiz(id, fields) {
    var q = await loadQuiz(id); if (!q) throw new Error("Quiz tapılmadı");
    for (var k in fields) q[k] = fields[k]; await saveQuiz(q); return q;
  }
  async function delQuiz(id) {
    await api("dq_v2_store?collection=eq." + ACOL + "&data->>quizId=eq." + id, { method: "DELETE" }).catch(function () { });
    await api("dq_v2_store?id=eq." + id, { method: "DELETE" });
  }
  async function attemptsOf(id) {
    var a = await api("dq_v2_store?select=id,data&collection=eq." + ACOL + "&data->>quizId=eq." + id + "&order=id.asc&limit=3000");
    return (a || []).map(function (r) { var x = r.data || {}; x.rid = r.id; return x; });
  }
  async function attemptCounts() {
    var a = await api("dq_v2_store?select=qid:data->>quizId&collection=eq." + ACOL + "&limit=20000"), m = {};
    (a || []).forEach(function (r) { m[r.qid] = (m[r.qid] || 0) + 1; }); return m;
  }
  async function findAttempt(id, key) {
    var a = await api("dq_v2_store?select=id,data&collection=eq." + ACOL + "&data->>quizId=eq." + id + "&data->>key=eq." + encodeURIComponent(key) + "&limit=1");
    return a && a[0] ? a[0] : null;
  }
  async function saveAttempt(a) { await api("dq_v2_store", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ collection: ACOL, data: a }) }); }

  /* ------------------------------------------------------------ vəziyyət */
  function stateOf(q, t) {
    t = t || now();
    if (q.manual === "on") return "active";
    if (q.manual === "off") return "closed";
    if (t < q.start) return "wait";
    if (t <= q.end) return "active";
    return "ended";
  }
  var ST = { wait: ["⏳", "Gözləyir", "#b45309", "#fef3c7"], active: ["🟢", "Aktiv", "#15803d", "#dcfce7"], ended: ["⚫", "Bitib", "#475569", "#e2e8f0"], closed: ["⏸", "Dayandırılıb", "#b91c1c", "#fee2e2"] };
  function chip(s) { var c = ST[s]; return '<span class="dqqz-chip" style="color:' + c[2] + ';background:' + c[3] + '">' + c[0] + " " + c[1] + "</span>"; }
  function linkOf(id) { var u = new URL(location.href); u.search = ""; u.hash = ""; return u.origin + u.pathname + "?dqquiz=" + id; }

  /* ------------------------------------------------------------ üslub */
  function css() {
    if ($("dqqz-css")) return;
    var s = D.createElement("style"); s.id = "dqqz-css";
    s.textContent = [
      "#dqqz-ad,#dqqz-pl{position:fixed;inset:0;z-index:2147482000;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;text-align:left;-webkit-text-size-adjust:100%}",
      "#dqqz-ad{background:#0b1220b3;display:flex;align-items:flex-end;justify-content:center}@media(min-width:760px){#dqqz-ad{align-items:center;padding:18px}}",
      ".dqqz-sh{background:#f4f7fc;width:100%;max-width:980px;height:95vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -10px 50px #0008}@media(min-width:760px){.dqqz-sh{height:92vh;border-radius:20px}}",
      ".dqqz-top{flex:none;display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 16px 12px;background:linear-gradient(90deg,#4c1d95,#2f63bd);color:#fff}.dqqz-top b{flex:1;font-size:17px}.dqqz-top button{border:0;background:#ffffff2e;color:#fff;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer}",
      ".dqqz-bd{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 40px}",
      ".dqqz-bd button,#dqqz-pl button{font-family:inherit}",
      ".dqqz-b{border:1.5px solid #cdd8ec;background:#fff;color:#1e293b;border-radius:11px;padding:9px 13px;font-weight:800;font-size:13px;cursor:pointer}.dqqz-b:active{transform:scale(.97)}.dqqz-b.p{background:#4c1d95;border-color:#4c1d95;color:#fff}.dqqz-b.g{background:#15803d;border-color:#15803d;color:#fff}.dqqz-b.r{color:#b91c1c;border-color:#fecaca}.dqqz-b.s{padding:7px 10px;font-size:12px}.dqqz-b:disabled{opacity:.5}",
      ".dqqz-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
      ".dqqz-card{background:#fff;border:1px solid #e3e9f4;border-radius:16px;padding:14px;margin:0 0 12px;box-shadow:0 2px 10px -6px #0f172a30}",
      ".dqqz-card h4{margin:0 0 4px;font-size:16px;line-height:1.3;color:#0f172a}.dqqz-meta{font-size:12.5px;color:#64748b;line-height:1.5}",
      ".dqqz-chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:800;margin:0 6px 4px 0}.dqqz-chip.n{background:#eaf1fc;color:#0a2f7a}",
      ".dqqz-lnk{display:flex;gap:8px;align-items:center;margin:9px 0;padding:8px 10px;background:#f1f5fb;border-radius:11px;font-size:12.5px;color:#334155;word-break:break-all}",
      ".dqqz-l{display:block;margin:12px 0 4px;font-size:12.5px;font-weight:800;color:#334155}",
      ".dqqz-in{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #cdd8ec;border-radius:11px;font-size:14.5px;background:#fff;font-family:inherit;color:#0f172a;outline:none}.dqqz-in:focus{border-color:#4c1d95;box-shadow:0 0 0 4px #4c1d9522}textarea.dqqz-in{min-height:90px;resize:vertical;line-height:1.5}",
      ".dqqz-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:520px){.dqqz-2{grid-template-columns:1fr}}",
      ".dqqz-seg{display:flex;gap:6px;flex-wrap:wrap}.dqqz-seg button{flex:1 1 auto;padding:10px 12px;border:1.5px solid #cdd8ec;background:#fff;border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;color:#334155}.dqqz-seg button.on{background:#4c1d95;color:#fff;border-color:#4c1d95}",
      ".dqqz-ck{display:flex;align-items:center;gap:9px;padding:9px 0;font-size:14px;font-weight:600;cursor:pointer}.dqqz-ck input{width:20px;height:20px;accent-color:#4c1d95}",
      ".dqqz-h{margin:18px 2px 8px;font-size:12px;letter-spacing:.7px;text-transform:uppercase;color:#64748b;font-weight:800}",
      ".dqqz-q{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:#fff;border:1px solid #e3e9f4;border-radius:13px;margin:0 0 8px}.dqqz-q>span{flex:none;min-width:28px;height:28px;border-radius:9px;background:#4c1d95;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}.dqqz-q>div{flex:1;min-width:0;font-size:13.5px;line-height:1.45;overflow-wrap:anywhere}.dqqz-q small{display:block;color:#64748b;font-size:12px;margin-top:2px}.dqqz-q.bad{border-color:#fca5a5;background:#fef2f2}",
      ".dqqz-q .ac{display:flex;flex-direction:column;gap:4px}.dqqz-q .ac button{border:1px solid #e3e9f4;background:#f8fafc;border-radius:8px;width:30px;height:28px;cursor:pointer;font-size:13px}",
      ".dqqz-op{display:flex;gap:8px;align-items:center;margin:0 0 7px}.dqqz-op>b{flex:none;width:30px;height:30px;border-radius:50%;border:2px solid #4c1d95;color:#4c1d95;display:flex;align-items:center;justify-content:center;font-size:13px}.dqqz-op.ok>b{background:#15803d;border-color:#15803d;color:#fff}.dqqz-op .dqqz-in{flex:1}.dqqz-op button{flex:none}",
      ".dqqz-im{max-width:100%;max-height:260px;border-radius:10px;margin:8px 0;display:block;object-fit:contain}.dqqz-oi{max-height:80px;margin:4px 0}",
      ".dqqz-sc{overflow:auto;border:1px solid #cdd8ec;border-radius:12px;background:#fff;max-height:62vh}",
      ".dqqz-tb{border-collapse:collapse;width:100%;font-size:13px;min-width:720px}.dqqz-tb th{position:sticky;top:0;background:#1e3a8a;color:#fff;padding:9px 10px;text-align:left;white-space:nowrap;font-size:12px;z-index:1}.dqqz-tb td{padding:8px 10px;border:1px solid #e3e9f4;vertical-align:top}.dqqz-tb tr:nth-child(even) td{background:#f8fafc}.dqqz-tb td.n{text-align:center;font-weight:700}.dqqz-tb td.ok{color:#15803d;font-weight:800;text-align:center}.dqqz-tb td.no{color:#b91c1c;font-weight:800;text-align:center}.dqqz-tb tr[data-a=det]{cursor:pointer}.dqqz-tb tr[data-a=det]:hover td{background:#eef2ff}",
      ".dqqz-wr{display:inline-block;min-width:24px;padding:2px 7px;margin:1px 3px 1px 0;border-radius:7px;background:#fee2e2;color:#b91c1c;font-weight:800;font-size:12px}",
      ".dqqz-kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:0 0 12px}.dqqz-kp div{background:#fff;border:1px solid #e3e9f4;border-radius:13px;padding:11px 12px}.dqqz-kp b{display:block;font-size:22px;color:#4c1d95}.dqqz-kp span{font-size:12px;color:#64748b;font-weight:700}",
      ".dqqz-pk{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-bottom:1px solid #eef2f9;cursor:pointer}.dqqz-pk input{width:20px;height:20px;margin-top:2px;accent-color:#4c1d95;flex:none}.dqqz-pk div{flex:1;font-size:13px;line-height:1.4;overflow-wrap:anywhere}.dqqz-pk small{color:#64748b}",
      ".dqqz-mo{position:fixed;inset:0;z-index:2147483100;background:#0b1220b8;display:flex;align-items:center;justify-content:center;padding:14px}.dqqz-md{background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:16px}",
      /* iştirakçı */
      "#dqqz-pl{background:#eef2fa;overflow:auto;-webkit-overflow-scrolling:touch}",
      ".dqqz-hd{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between;padding:max(12px,env(safe-area-inset-top)) 16px 12px;background:#0b2a7a;color:#fff;box-shadow:0 4px 18px #0b2a7a55}",
      ".dqqz-hd .tt{background:#fff;color:#0b2a7a;border-radius:11px;padding:9px 14px;font-weight:700;font-size:14px;max-width:62%;line-height:1.3}.dqqz-hd .tm{font:800 19px ui-monospace,Menlo,Consolas,monospace;background:#ffffff1f;border:1px solid #ffffff44;border-radius:11px;padding:7px 13px;color:#facc15;letter-spacing:1px}.dqqz-hd .tm.low{color:#fca5a5;animation:dqqzp 1s infinite}@keyframes dqqzp{50%{opacity:.55}}",
      ".dqqz-wrap{max-width:1060px;margin:0 auto;padding:14px}",
      ".dqqz-main{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}@media(max-width:820px){.dqqz-main{grid-template-columns:1fr}}",
      ".dqqz-pn{background:#fff;border:1px solid #dbe3f1;border-radius:18px;padding:16px;box-shadow:0 6px 24px -14px #0b2a7a55}",
      ".dqqz-qc{background:#eaf2ff;border:1px solid #c9dcf8;border-radius:16px;padding:12px}.dqqz-qh{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#fff;border-radius:12px;padding:11px 14px;font-weight:800;font-size:15px;margin:0 0 12px}.dqqz-qh em{font-style:normal;font-size:12px;color:#0e7490;background:#e0f2fe;border-radius:9px;padding:5px 10px}",
      ".dqqz-qt{font-size:16px;line-height:1.65;font-weight:500;margin:6px 4px 14px;overflow-wrap:anywhere}.dqqz-qt img{max-width:100%;height:auto;border-radius:10px}",
      ".dqqz-o{display:flex;align-items:center;gap:13px;width:100%;box-sizing:border-box;text-align:left;border:2px solid transparent;background:#f5f9ff;border-radius:14px;padding:12px 14px;margin:0 0 9px;font-size:15.5px;cursor:pointer;color:#0f172a}.dqqz-o b{flex:none;width:36px;height:36px;border-radius:50%;border:2px solid #0b2a7a;display:flex;align-items:center;justify-content:center;font-size:15px;color:#0b2a7a;background:#fff}.dqqz-o span{flex:1;min-width:0;overflow-wrap:anywhere;line-height:1.45}.dqqz-o:hover{background:#e6f0ff}.dqqz-o.on{border-color:#0b2a7a;background:#dbe8ff}.dqqz-o.on b{background:#0b2a7a;color:#fff}.dqqz-o img{max-width:100%;max-height:120px;display:block;margin:4px 0}",
      ".dqqz-nv{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #e3e9f4}.dqqz-nv button{border:0;border-radius:11px;padding:13px 20px;font-weight:800;font-size:14.5px;cursor:pointer}.dqqz-nv .g{background:#64748b;color:#fff}.dqqz-nv .o{background:#fff;color:#b91c1c;border:1.5px solid #b91c1c}.dqqz-nv .r{background:#b91c1c;color:#fff}.dqqz-nv .n{background:#0b2a7a;color:#fff}",
      ".dqqz-ca{background:#fff;border:1px solid #dbe3f1;border-radius:18px;padding:14px;position:sticky;top:76px}@media(max-width:820px){.dqqz-ca{position:static}}.dqqz-ca h5{margin:0 0 10px;font-size:15px;padding-bottom:8px;border-bottom:2px solid #0b2a7a}",
      ".dqqz-gr{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.dqqz-gr button{aspect-ratio:1;border:1.5px solid #dbe3f1;background:#fff;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;color:#0f172a}.dqqz-gr button.a{background:#dbe8ff;border-color:#2f63bd;color:#0b2a7a}.dqqz-gr button.c{outline:3px solid #0b2a7a;outline-offset:1px}",
      ".dqqz-ctr{max-width:560px;margin:7vh auto;padding:0 14px}.dqqz-big{background:#fff;border-radius:22px;padding:24px 20px;box-shadow:0 18px 50px -20px #0b2a7a66;border-top:5px solid #d4af37;text-align:center}.dqqz-big h2{margin:6px 0 6px;font-size:21px;line-height:1.3}.dqqz-big p{color:#64748b;font-size:14px;line-height:1.55;margin:6px 0}",
      ".dqqz-cd{display:flex;gap:9px;justify-content:center;margin:18px 0}.dqqz-cd div{min-width:64px;background:#0b2a7a;color:#fff;border-radius:14px;padding:12px 8px}.dqqz-cd b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.dqqz-cd span{font-size:11px;opacity:.8}",
      ".dqqz-btn{display:block;width:100%;border:0;border-radius:14px;padding:15px;font-weight:800;font-size:16px;cursor:pointer;color:#fff;background:linear-gradient(180deg,#22c55e,#15803d);margin-top:14px}.dqqz-btn.b{background:linear-gradient(120deg,#0b2a7a,#2f63bd)}.dqqz-btn.l{background:#e2e8f0;color:#0f172a}",
      ".dqqz-fm{text-align:left}.dqqz-fm label{display:block;margin:13px 0 5px;font-size:13px;font-weight:800;color:#334155}.dqqz-err{margin:12px 0 0;padding:10px 12px;border-radius:11px;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;text-align:left}",
      /* nəticə */
      ".dqqz-rs{max-width:1040px;margin:14px auto;background:#fff;border-radius:18px;border-top:5px solid #c9a063;padding:22px 18px 26px;box-shadow:0 10px 40px -20px #0b2a7a55}",
      ".dqqz-rs h3{margin:0 0 10px;text-align:center;font-size:17px;line-height:1.4}.dqqz-rs h4{margin:0 0 18px;text-align:center;font-size:16px}.dqqz-rs .inf{max-width:560px;margin:0 auto 22px;font-size:14px;line-height:1.9}.dqqz-rs .inf b{font-weight:800}",
      ".dqqz-rs .sb{font-weight:800;font-size:14.5px;margin:16px 0 8px}.dqqz-gt{overflow:auto;margin:0 0 6px;border-radius:6px}.dqqz-gt table{border-collapse:collapse;font-size:13px;min-width:100%}.dqqz-gt th,.dqqz-gt td{border:1px solid #64748b;padding:3px 7px;text-align:center;min-width:24px}.dqqz-gt th{background:#fff}.dqqz-gt td.l{border:0;text-align:left;font-weight:700;padding-right:12px;white-space:nowrap}.dqqz-gt td.bad{color:#b91c1c;font-weight:800;background:#fef2f2}.dqqz-gt td.good{color:#15803d;font-weight:800}",
      ".dqqz-rs .sm{font-style:italic;font-size:13px;margin:6px 0 18px}.dqqz-rs .tot{font-style:italic;font-weight:800;font-size:19px;line-height:1.6;margin:22px 0 14px}",
      ".dqqz-sc2{background:#f4f6fb;border:1px solid #e3e9f4;border-radius:12px;text-align:center;padding:15px;margin:0 0 12px;font-style:italic;font-weight:800;font-size:18px}.dqqz-sc2.no{color:#b91c1c}.dqqz-sc2.ok{color:#15803d}",
      ".dqqz-ban{margin:12px 0;border-radius:20px;padding:16px 18px;color:#fff;background:linear-gradient(120deg,#4c1d95,#2f63bd);box-shadow:0 14px 34px -16px #4c1d95aa;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;text-align:left}",
      ".dqqz-ban .ic{flex:none;width:46px;height:46px;border-radius:14px;background:#ffffff26;display:flex;align-items:center;justify-content:center;font-size:24px}.dqqz-ban .tx{flex:1 1 200px;min-width:0}.dqqz-ban b{display:block;font-size:16px;line-height:1.3}.dqqz-ban small{display:block;opacity:.85;font-size:12.5px;margin-top:2px}",
      ".dqqz-ban .tm{display:flex;gap:6px}.dqqz-ban .tm i{font-style:normal;background:#ffffff26;border-radius:10px;padding:6px 9px;text-align:center;min-width:42px}.dqqz-ban .tm i b{font-size:18px;font-variant-numeric:tabular-nums}.dqqz-ban .tm i span{display:block;font-size:10px;opacity:.8}",
      ".dqqz-ban button{border:0;border-radius:12px;padding:12px 18px;background:#facc15;color:#1e1b4b;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}.dqqz-ban button.lv{background:#22c55e;color:#fff;animation:dqqzp 1.6s infinite}",
      "@media print{#dqqz-pl .dqqz-hd,#dqqz-pl .dqqz-noprint{display:none!important}}"
    ].join("\n");
    D.head.appendChild(s);
  }

  /* ================================================================ ADMIN */
  var A = { view: "list", list: [], counts: {}, q: null, qi: -1, res: null, sel: {}, busy: false };
  function root() { return $("dqqz-bd"); }
  function openAdmin() {
    css(); closeAdmin();
    var o = D.createElement("div"); o.id = "dqqz-ad";
    o.innerHTML = '<div class="dqqz-sh" role="dialog" aria-modal="true"><div class="dqqz-top"><b id="dqqz-ttl">🎯 Vaxtlı Quiz Sınaqları</b><button data-a="x" aria-label="Bağla">✕</button></div><div class="dqqz-bd" id="dqqz-bd"></div></div>';
    D.body.appendChild(o); D.body.style.overflow = "hidden";
    o.addEventListener("click", onAdminClick);
    o.addEventListener("change", onAdminChange);
    o.addEventListener("input", function (e) { var id = e.target && e.target.id; if (id === "dqqz-f-dur") { var v = parseInt(e.target.value) || 0; [].forEach.call(D.querySelectorAll("#dqqz-durp button"), function (b) { b.classList.toggle("on", +b.getAttribute("data-v") === v); }); } if (id && id.indexOf("dqqz-f-") === 0) updPrev(); });
    o.addEventListener("paste", onPaste);
    A.view = "list"; refreshList();
  }
  function closeAdmin() { var o = $("dqqz-ad"); if (o) o.remove(); D.body.style.overflow = ""; }
  function setTitle(t) { var e = $("dqqz-ttl"); if (e) e.textContent = t; }
  function busy(on) { A.busy = on; }

  async function refreshList() {
    setTitle("🎯 Vaxtlı Quiz Sınaqları"); var r = root(); if (!r) return;
    r.innerHTML = '<div class="dqqz-meta" style="padding:30px;text-align:center">Yüklənir…</div>';
    try { A.list = await listQuizzes(); A.counts = await attemptCounts().catch(function () { return {}; }); }
    catch (e) { r.innerHTML = '<div class="dqqz-card"><b style="color:#b91c1c">Xəta:</b> ' + esc(e.message) + '<div class="dqqz-row" style="margin-top:10px"><button class="dqqz-b" data-a="reload">↻ Yenidən yüklə</button></div></div>'; return; }
    drawList();
  }
  function drawList() {
    var r = root(); if (!r) return; A.view = "list";
    var h = '<div class="dqqz-row" style="margin:0 0 12px"><button class="dqqz-b p" data-a="new">➕ Yeni quiz</button><button class="dqqz-b" data-a="reload">↻ Yenilə</button><span class="dqqz-meta" style="margin-left:auto">' + A.list.length + ' quiz</span></div>';
    if (!A.list.length) h += '<div class="dqqz-card dqqz-meta" style="text-align:center;padding:26px">Hələ quiz yoxdur. «Yeni quiz» ilə başlayın — ad, fənn, vaxt seçin, sualları əlavə edin; hər quiz üçün öz linki yaranacaq.</div>';
    A.list.forEach(function (q) {
      var s = stateOf(q), cnt = A.counts[q.id] || 0;
      h += '<div class="dqqz-card"><div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><h4>' + esc(q.title) + '</h4><div>' + chip(s) + '<span class="dqqz-chip n">' + esc(q.subject || "Fənn yoxdur") + '</span><span class="dqqz-chip n">' + (q.mode === "public" ? "🌐 Hamıya açıq" : "🔗 Link ilə") + '</span><span class="dqqz-chip n">❓ ' + q.n + ' sual</span><span class="dqqz-chip n">👥 ' + cnt + '</span></div>' +
        '<div class="dqqz-meta">🕒 ' + fmt(q.start) + ' → ' + fmt(q.end) + (q.manual === "on" ? " · əl ilə AÇIQDIR" : q.manual === "off" ? " · əl ilə DAYANDIRILIB" : "") + '</div></div></div>' +
        '<div class="dqqz-lnk"><span style="flex:1">🔗 ' + esc(linkOf(q.id)) + '</span><button class="dqqz-b s" data-a="copy" data-id="' + q.id + '">Kopyala</button><button class="dqqz-b s" data-a="share" data-id="' + q.id + '">Paylaş</button></div>' +
        '<div class="dqqz-row">' +
        (s === "active" && q.manual === "on" ? '<button class="dqqz-b s" data-a="auto" data-id="' + q.id + '">⏱ Avtomatik</button>' : "") +
        (s === "active" ? '<button class="dqqz-b s r" data-a="stop" data-id="' + q.id + '">⏸ Dayandır</button>' : '<button class="dqqz-b s g" data-a="on" data-id="' + q.id + '">▶ İndi aktiv et</button>') +
        (q.manual && s !== "active" ? '<button class="dqqz-b s" data-a="auto" data-id="' + q.id + '">⏱ Avtomatik</button>' : "") +
        '<button class="dqqz-b s" data-a="edit" data-id="' + q.id + '">✏️ Redaktə</button><button class="dqqz-b s" data-a="res" data-id="' + q.id + '">📊 Nəticələr</button><button class="dqqz-b s" data-a="dup" data-id="' + q.id + '">📋 Təkrarla</button><button class="dqqz-b s r" data-a="del" data-id="' + q.id + '">🗑 Sil</button></div></div>';
    });
    r.innerHTML = h;
  }
  function newQuiz() {
    var t = Math.ceil((now() + 36e5) / 18e5) * 18e5;
    return { title: "", subject: "Ümumi", mode: "link", start: t, end: t + 30 * 6e4, manual: "", reg: true, dur: 0, pass: 50, showAns: true, qs: [], created: now() };
  }
  function drawEdit() {
    var q = A.q, r = root(); if (!r) return; A.view = "edit";
    setTitle(q.id ? "✏️ Quiz redaktəsi" : "➕ Yeni quiz");
    var minutes = Math.max(1, Math.round((q.end - q.start) / 6e4));
    var h = '<div class="dqqz-row" style="margin:0 0 6px"><button class="dqqz-b" data-a="back">← Siyahı</button></div>' +
      '<div class="dqqz-card"><label class="dqqz-l" style="margin-top:0">Quizin adı</label><input class="dqqz-in" id="dqqz-f-title" maxlength="120" placeholder="Məsələn: Məntiq — axşam quizi" value="' + esc(q.title) + '">' +
      '<label class="dqqz-l">Fənn</label><div class="dqqz-seg" id="dqqz-subj">' + SUBJ.map(function (s) { return '<button type="button" data-a="subj" data-v="' + esc(s) + '" class="' + (q.subject === s ? "on" : "") + '">' + esc(s) + '</button>'; }).join("") + '</div>' +
      '<label class="dqqz-l">Kimlər görsün</label><div class="dqqz-seg"><button type="button" data-a="mode" data-v="link" class="' + (q.mode === "link" ? "on" : "") + '">🔗 Yalnız link ilə (qrupa göndər)</button><button type="button" data-a="mode" data-v="public" class="' + (q.mode === "public" ? "on" : "") + '">🌐 Hamıya açıq (ana səhifədə taymer)</button></div>' +
      '<div style="margin-top:14px;padding:12px;border:1.5px solid #c7d2fe;border-radius:14px;background:#f5f7ff"><div style="font-weight:800;margin-bottom:2px">⏱ Vaxt idarəsi</div>' +
      '<div class="dqqz-meta" style="margin:0 0 8px">1) Quizin açıq olduğu aralıq — linkə yalnız bu aralıqda girib başlamaq olur.</div>' +
      '<div class="dqqz-2"><div><label class="dqqz-l" style="margin-top:0">Açılma vaxtı</label><input class="dqqz-in" type="datetime-local" id="dqqz-f-start" value="' + toLocal(q.start) + '"></div><div><label class="dqqz-l" style="margin-top:0">Bağlanma vaxtı</label><input class="dqqz-in" type="datetime-local" id="dqqz-f-end" value="' + toLocal(q.end) + '"></div></div>' +
      '<div class="dqqz-2"><div><label class="dqqz-l">Aralığın uzunluğu (dəq)</label><input class="dqqz-in" type="number" min="1" inputmode="numeric" id="dqqz-f-min" value="' + minutes + '"></div><div></div></div>' +
      '<div class="dqqz-meta" style="margin:12px 0 6px">2) İşləmə müddəti — iştirakçı başlayan anda onun şəxsi geri sayımı işə düşür.</div>' +
      '<div class="dqqz-seg" id="dqqz-durp">' + [[15, "15 dəq"], [30, "30 dəq"], [45, "45 dəq"], [60, "1 saat"], [90, "1,5 saat"], [120, "2 saat"], [0, "♾ Limitsiz"]].map(function (p) { return '<button type="button" data-a="durp" data-v="' + p[0] + '" class="' + ((q.dur || 0) === p[0] ? "on" : "") + '">' + p[1] + '</button>'; }).join("") + '</div>' +
      '<div class="dqqz-2"><div><label class="dqqz-l">Özəl müddət (dəq, 0 = limitsiz)</label><input class="dqqz-in" type="number" min="0" inputmode="numeric" id="dqqz-f-dur" value="' + (q.dur || 0) + '"></div><div></div></div>' +
      '<div id="dqqz-prev" style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #e0e7ff;font-size:13px;line-height:1.55"></div></div>' +
      '<div class="dqqz-2"><div><label class="dqqz-l">Keçid balı (%)</label><input class="dqqz-in" type="number" min="0" max="100" inputmode="numeric" id="dqqz-f-pass" value="' + q.pass + '"></div><div></div></div>' +
      '<label class="dqqz-ck"><input type="checkbox" id="dqqz-f-grace"' + (q.grace ? " checked" : "") + '><span>Bağlanma vaxtı keçsə belə, başlamış iştirakçı öz işləmə müddətini tam işləsin</span></label>' +
      '<label class="dqqz-ck"><input type="checkbox" id="dqqz-f-reg"' + (q.reg ? " checked" : "") + '><span>Qeydiyyat tələb olunsun (iştirakçı sayta qeydiyyatdan keçməlidir)</span></label>' +
      '<label class="dqqz-ck"><input type="checkbox" id="dqqz-f-ans"' + (q.showAns ? " checked" : "") + '><span>Nəticədə doğru cavablar göstərilsin</span></label></div>';
    h += '<div class="dqqz-h">Suallar (' + q.qs.length + ')</div>';
    if (!q.qs.length) h += '<div class="dqqz-card dqqz-meta" style="text-align:center">Hələ sual yoxdur.</div>';
    q.qs.forEach(function (x, i) {
      var bad = x.c < 0 || !x.o || (!x.oi && x.o.filter(function (o) { return o.t || o.i; }).length < 2);
      h += '<div class="dqqz-q' + (bad ? " bad" : "") + '"><span>' + (i + 1) + '</span><div>' + esc(strip(qBody(x)).slice(0, 150) || "(şəkilli sual)") + (x.i ? " 🖼" : "") + '<small>' + (x.c >= 0 ? "Doğru: " + LET[x.c] : "⚠ doğru cavab seçilməyib") + " · " + x.o.filter(function (o) { return o.t || o.i; }).length + ' variant</small></div><div class="ac"><button data-a="qup" data-i="' + i + '"' + (i ? "" : " disabled") + '>↑</button><button data-a="qdn" data-i="' + i + '"' + (i < q.qs.length - 1 ? "" : " disabled") + '>↓</button></div><div class="ac"><button data-a="qed" data-i="' + i + '">✏️</button><button data-a="qrm" data-i="' + i + '" style="color:#b91c1c">✕</button></div></div>';
    });
    h += '<div class="dqqz-row" style="margin-top:10px"><button class="dqqz-b p" data-a="qnew">➕ Sual əlavə et</button><button class="dqqz-b" data-a="bulk">📥 Toplu yapışdır</button><button class="dqqz-b" data-a="pdfimp">📄 PDF-dən əlavə et</button><button class="dqqz-b" data-a="dbimp">🗄 Bazadan seç</button></div>';
    h += '<div class="dqqz-row" style="margin-top:18px"><button class="dqqz-b g" data-a="save">💾 Yadda saxla</button>' + (q.id ? '<button class="dqqz-b" data-a="copy" data-id="' + q.id + '">🔗 Linki kopyala</button>' : "") + '</div>';
    r.innerHTML = h; updPrev();
  }
  function prevTxt() {
    var st = fromLocal(($("dqqz-f-start") || {}).value), en = fromLocal(($("dqqz-f-end") || {}).value), du = Math.max(0, parseInt(($("dqqz-f-dur") || {}).value) || 0), gr = $("dqqz-f-grace") && $("dqqz-f-grace").checked;
    function hm(ms) { var d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    function dl(m) { return m >= 60 && m % 60 === 0 ? (m / 60) + " saat" : m > 60 ? Math.floor(m / 60) + " saat " + (m % 60) + " dəq" : m + " dəq"; }
    if (!st || !en || en <= st) return '<span style="color:#b91c1c">⚠ Bağlanma vaxtı açılmadan sonra olmalıdır.</span>';
    var win = Math.round((en - st) / 6e4), t = "🟢 Link <b>" + hm(st) + " – " + hm(en) + "</b> arası açıqdır (" + dl(win) + ").";
    if (!du) return t + "<br>⏳ Şəxsi taymer yoxdur — iştirakçı bağlanma vaxtına (" + hm(en) + ") qədər işləyir.";
    t += "<br>⏳ Başlayan hər kəs <b>" + dl(du) + "</b> alır.";
    if (du >= win && !gr) t += "<br>ℹ Müddət aralıqdan uzundur — hamı " + hm(en) + "-də bağlanır.";
    var ex = en - 10 * 6e4; if (ex < st) ex = st;
    t += "<br>Misal: " + hm(ex) + "-də başlayan " + (gr ? hm(ex + du * 6e4) + "-də" : hm(Math.min(en, ex + du * 6e4)) + "-də") + " bitirir" + (gr ? " (tam müddət)." : (ex + du * 6e4 > en ? " (bağlanma vaxtı kəsir)." : "."));
    return t;
  }
  function updPrev() { var e = $("dqqz-prev"); if (e) e.innerHTML = prevTxt(); }
  function readEd() {
    var q = A.q; if (!q || A.view !== "edit") return;
    var v;
    if ((v = $("dqqz-f-title"))) q.title = v.value.trim();
    if ((v = $("dqqz-f-start"))) q.start = fromLocal(v.value) || q.start;
    if ((v = $("dqqz-f-end"))) q.end = fromLocal(v.value) || q.end;
    if ((v = $("dqqz-f-dur"))) q.dur = Math.max(0, parseInt(v.value) || 0);
    if ((v = $("dqqz-f-pass"))) q.pass = Math.max(0, Math.min(100, parseInt(v.value) || 0));
    if ((v = $("dqqz-f-reg"))) q.reg = v.checked;
    if ((v = $("dqqz-f-grace"))) q.grace = v.checked;
    if ((v = $("dqqz-f-ans"))) q.showAns = v.checked;
  }
  function onAdminChange(e) {
    var t = e.target;
    if (t.id === "dqqz-f-start" || t.id === "dqqz-f-min") {
      var st = fromLocal($("dqqz-f-start").value), mn = Math.max(1, parseInt($("dqqz-f-min").value) || 30);
      if (st) { $("dqqz-f-end").value = toLocal(st + mn * 6e4); }
    }
    if (t.id === "dqqz-f-end") {
      var s2 = fromLocal($("dqqz-f-start").value), e2 = fromLocal(t.value);
      if (s2 && e2 > s2) $("dqqz-f-min").value = Math.round((e2 - s2) / 6e4);
    }
    updPrev();
    if (t.getAttribute && t.getAttribute("data-pk")) { var k = t.getAttribute("data-pk"); if (t.checked) A.sel[k] = 1; else delete A.sel[k]; var c = $("dqqz-pkn"); if (c) c.textContent = Object.keys(A.sel).length; }
    if (t.getAttribute && t.getAttribute("data-img")) pickImg(t);
    if (t.getAttribute && t.getAttribute("data-pdf") && t.files && t.files[0]) runFiles([].slice.call(t.files));
  }
  function onPaste(e) {
    var t = e.target; if (!t || !t.closest || !t.closest("[data-pimg]")) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) if (items[i].type.indexOf("image") === 0) {
      var f = items[i].getAsFile(); if (!f) continue; e.preventDefault();
      readImg(f).then(function (d) { A.qf.i = d; drawQEdit(true); toast("Şəkil əlavə olundu"); }); return;
    }
  }
  async function pickImg(inp) {
    var f = inp.files && inp.files[0]; if (!f) return;
    var tg = inp.getAttribute("data-img"); readQForm();
    try { var d = await readImg(f, tg === "q" ? 900 : 500); if (tg === "q") A.qf.i = d; else A.qf.o[+tg].i = d; drawQEdit(true); } catch (e) { toast(e.message, true); }
  }

  /* ---- sual formu */
  function blankQ() { return { t: "", i: "", h: false, o: [0, 1, 2, 3, 4].map(function () { return { t: "", i: "" }; }), c: -1 }; }
  function drawQEdit(keep) {
    var f = A.qf, r = root(); if (!r) return; A.view = "qedit";
    var sc = r.scrollTop; setTitle(A.qi >= 0 ? "✏️ Sual " + (A.qi + 1) : "➕ Yeni sual");
    var h = '<div class="dqqz-row" style="margin:0 0 6px"><button class="dqqz-b" data-a="qcancel">← Quizə qayıt</button></div><div class="dqqz-card" data-pimg="1"><label class="dqqz-l" style="margin-top:0">Sualın mətni</label><textarea class="dqqz-in" id="dqqz-qt" placeholder="Sualı yazın… (şəkli birbaşa buraya yapışdıra da bilərsiniz)">' + esc(f.h ? strip(f.t) : f.t) + '</textarea>' +
      '<div class="dqqz-row" style="margin-top:8px"><label class="dqqz-b s" style="cursor:pointer">🖼 Şəkil seç<input type="file" accept="image/*" data-img="q" hidden></label>' + (f.i ? '<button class="dqqz-b s r" data-a="qimgx">Şəkli sil</button>' : "") + '</div>' + imgTag(f.i) +
      '<label class="dqqz-l">Variantlar (doğru cavabı işarələyin)</label>';
    f.o.forEach(function (o, i) {
      h += '<div class="dqqz-op' + (f.c === i ? " ok" : "") + '"><b data-a="qc" data-i="' + i + '" style="cursor:pointer" title="Doğru cavab">' + LET[i] + '</b><input class="dqqz-in" id="dqqz-o' + i + '" placeholder="Variant ' + LET[i] + '" value="' + esc(o.t) + '"><label class="dqqz-b s" style="cursor:pointer">🖼<input type="file" accept="image/*" data-img="' + i + '" hidden></label></div>' + (o.i ? '<div style="margin:-3px 0 8px 38px">' + imgTag(o.i, "dqqz-im dqqz-oi") + '<button class="dqqz-b s r" data-a="qoix" data-i="' + i + '">Şəkli sil</button></div>' : "");
    });
    h += '<div class="dqqz-meta">Doğru cavab: <b>' + (f.c >= 0 ? LET[f.c] : "seçilməyib") + '</b> — variantın hərfinə toxunun.</div><div class="dqqz-row" style="margin-top:14px"><button class="dqqz-b g" data-a="qsave">✔ Sualı saxla</button><button class="dqqz-b" data-a="qsave2">✔ Saxla və yenisini əlavə et</button></div></div>';
    r.innerHTML = h; r.scrollTop = keep ? sc : 0;
  }
  function readQForm() {
    var f = A.qf; if (!f || A.view !== "qedit") return;
    var t = $("dqqz-qt"); if (t) { f.t = t.value; f.h = false; }
    f.o.forEach(function (o, i) { var e = $("dqqz-o" + i); if (e) o.t = e.value; });
  }
  function validQ(f) {
    if (!String(f.t).trim() && !f.i) return "Sualın mətni və ya şəkli olmalıdır";
    if (!f.oi && f.o.filter(function (o) { return o.t.trim() || o.i; }).length < 2) return "Ən azı 2 variant yazın";
    if (f.c < 0) return "Doğru cavabı seçin (variantın hərfinə toxunun)";
    if (!(f.o[f.c].t.trim() || f.o[f.c].i || (f.oi && f.c < f.oi))) return "Doğru cavab boş variantdır";
    return "";
  }
  /* ---- toplu yapışdır */
  function parseBulk(txt) {
    var lines = String(txt).replace(/\r/g, "").split("\n"), blocks = [], cur = [];
    function flush() { if (cur.length) blocks.push(cur); cur = []; }
    lines.forEach(function (ln) {
      if (!ln.trim()) { flush(); return; }
      if (/^\s*\d{1,3}\s*[\.\)]\s+\S/.test(ln) && cur.some(function (x) { return /^\s*(cavab|doğru|answer)/i.test(x) || /^\s*\(?[A-E][\)\.]\s/i.test(x); }) ) flush();
      cur.push(ln);
    }); flush();
    var out = [];
    blocks.forEach(function (b) {
      var qt = [], opts = [], ans = -1, inOpt = false;
      b.forEach(function (ln) {
        var m;
        if ((m = ln.match(/^\s*(?:doğru\s*)?(?:cavab|answer)\s*[:\-–]?\s*\(?([A-Ea-e])\)?\s*$/i))) { ans = LET.indexOf(m[1].toUpperCase()); return; }
        if ((m = ln.match(/^\s*\(?([A-Ea-e])[\)\.]\s*(.*)$/)) && (LET.indexOf(m[1].toUpperCase()) === opts.length || inOpt)) { inOpt = true; opts[LET.indexOf(m[1].toUpperCase())] = m[2].trim(); return; }
        if (inOpt && opts.length) { opts[opts.length - 1] = (opts[opts.length - 1] + " " + ln.trim()).trim(); return; }
        qt.push(ln.replace(/^\s*\d{1,3}\s*[\.\)]\s+/, ""));
      });
      if (!qt.join("").trim() && !opts.length) return;
      var f = blankQ(); f.t = qt.join("\n").trim();
      for (var i = 0; i < 5; i++) f.o[i].t = opts[i] || "";
      f.c = ans; out.push(f);
    });
    return out;
  }
  function drawBulk() {
    var r = root(); A.view = "bulk"; setTitle("📥 Toplu yapışdır");
    r.innerHTML = '<div class="dqqz-row" style="margin:0 0 6px"><button class="dqqz-b" data-a="qcancel">← Quizə qayıt</button></div><div class="dqqz-card"><div class="dqqz-meta">Sualları belə yapışdırın (suallar arasında boş sətir; doğru cavab sətri ixtiyaridir, sonra düzəldə bilərsiniz):</div><pre style="background:#f1f5fb;border-radius:10px;padding:10px;font-size:12.5px;white-space:pre-wrap;margin:8px 0">1. Azərbaycan Respublikasının paytaxtı hansıdır?\nA) Gəncə\nB) Bakı\nC) Sumqayıt\nD) Şəki\nE) Lənkəran\nCavab: B</pre><textarea class="dqqz-in" id="dqqz-bulk" style="min-height:240px" placeholder="Sualları buraya yapışdırın…"></textarea><div class="dqqz-row" style="margin-top:12px"><button class="dqqz-b p" data-a="bulkgo">➕ Suallara çevir və əlavə et</button></div></div>';
  }
  /* ---- bazadan seç */
  var DBC = null;
  function dbMap(sm) {
    var Ks = Object.keys(sm), f = function (re) { return Ks.filter(function (k) { return re.test(k); })[0]; }, m = {};
    m.cat = f(/^category$/); m.exam = f(/^exam_id$/); m.num = f(/^(q_?num(ber)?|question_(num|no|number|index)|num(ber)?|q_?no|order(_?index)?|position|idx|index|sira)$/i);
    m.q = f(/^(question(_text)?|q_?text|text|title|sual)$/i); m.opts = f(/^(options?|variants?|choices|answers)$/i);
    m.corr = f(/^(correct(_?(answer|option|index|idx))?|answer|right_?answer|dogru)$/i); m.sub = f(/^(subject(_name)?|fenn|fənn|section|topic|lesson|bolme|bölmə)$/i);
    if (!m.opts) { m.each = LET.split("").map(function (L) { return f(new RegExp("^(opt(ion)?_?" + L + "|variant_?" + L + "|" + L + ")$", "i")); }); if (m.each.filter(Boolean).length < 4) m.each = null; }
    return m;
  }
  function rowToQ(r, m) {
    var f = blankQ(), ops = [];
    if (m.opts) { var v = r[m.opts]; if (typeof v === "string") v = jparse(v, [v]); ops = Array.isArray(v) ? v : []; } else if (m.each) ops = m.each.map(function (k) { return k ? r[k] : ""; });
    ops = ops.map(function (o) { return typeof o === "object" && o ? (o.text || o.t || "") : String(o == null ? "" : o); });
    f.t = String(r[m.q] || ""); f.h = true;
    for (var i = 0; i < 5; i++) f.o[i].t = ops[i] || "";
    var c = r[m.corr];
    if (typeof c === "number") f.c = c; else if (/^[A-Ea-e]$/.test(String(c))) f.c = LET.indexOf(String(c).toUpperCase());
    else { var ix = ops.findIndex(function (o) { return String(o) === String(c); }); f.c = ix; }
    return f;
  }
  async function drawDb() {
    var r = root(); A.view = "dbimp"; setTitle("🗄 Bazadan seç"); A.sel = {};
    r.innerHTML = '<div class="dqqz-meta" style="padding:26px;text-align:center">Baza oxunur…</div>';
    try {
      var sb = window._supabase; if (!sb || !sb.from) throw new Error("Sual bazası bağlantısı tapılmadı");
      var s = await sb.from("exam_questions").select("*").limit(1); if (s.error || !s.data || !s.data[0]) throw new Error("Bazada sual tapılmadı");
      var m = dbMap(s.data[0]); if (!m.q || !m.corr || !(m.opts || m.each)) throw new Error("Cədvəl sütunları tanınmadı");
      var rows = [], from = 0, subj = A.q.subject && A.q.subject !== "Ümumi" ? A.q.subject : null;
      for (;;) {
        var qq = sb.from("exam_questions").select("*"); if (subj && m.sub) qq = qq.eq(m.sub, subj);
        var x = await qq.order("id", { ascending: true }).range(from, from + 999); if (x.error) throw x.error;
        rows = rows.concat(x.data || []); if ((x.data || []).length < 1000 || rows.length > 6000) break; from += 1000;
      }
      DBC = { m: m, rows: rows, f: "" }; drawDbList();
    } catch (e) { r.innerHTML = '<div class="dqqz-row" style="margin:0 0 6px"><button class="dqqz-b" data-a="qcancel">← Quizə qayıt</button></div><div class="dqqz-card" style="color:#b91c1c;font-weight:700">' + esc(e.message || e) + '</div>'; }
  }
  function drawDbList() {
    var r = root(), m = DBC.m, tags = {};
    DBC.rows.forEach(function (x) { tags[(m.exam ? x[m.exam] : "?") + " · " + (m.cat ? x[m.cat] : "?")] = 1; });
    var ks = Object.keys(tags).sort(function (a, b) { return parseInt(a) - parseInt(b) || (a < b ? -1 : 1); });
    var list = DBC.rows.filter(function (x) { return !DBC.f || (x[m.exam] + " · " + x[m.cat]) === DBC.f; });
    var h = '<div class="dqqz-row" style="margin:0 0 8px"><button class="dqqz-b" data-a="qcancel">← Quizə qayıt</button><span class="dqqz-meta" style="margin-left:auto">Seçildi: <b id="dqqz-pkn">' + Object.keys(A.sel).length + '</b></span></div>' +
      '<div class="dqqz-meta" style="margin:0 0 8px">Fənn: <b>' + esc(A.q.subject) + '</b> · ' + DBC.rows.length + ' sual tapıldı</div><div class="dqqz-seg" style="margin:0 0 10px"><button type="button" class="' + (!DBC.f ? "on" : "") + '" data-a="dbf" data-v="">Hamısı</button>' + ks.map(function (k) { return '<button type="button" class="' + (DBC.f === k ? "on" : "") + '" data-a="dbf" data-v="' + esc(k) + '">Sınaq ' + esc(k) + '</button>'; }).join("") + '</div>' +
      '<div class="dqqz-row" style="margin:0 0 8px"><button class="dqqz-b s" data-a="dball">Görünənlərin hamısını seç</button><button class="dqqz-b s" data-a="dbnone">Seçimi təmizlə</button><button class="dqqz-b s g" data-a="dbadd">➕ Seçilənləri quizə əlavə et</button></div><div class="dqqz-card" style="padding:0;overflow:hidden">';
    list.slice(0, 400).forEach(function (x) {
      h += '<label class="dqqz-pk"><input type="checkbox" data-pk="' + x.id + '"' + (A.sel[x.id] ? " checked" : "") + '><div>' + esc(strip(x[m.q]).slice(0, 170) || "(şəkilli sual)") + '<br><small>Sınaq ' + esc(x[m.exam]) + " · " + esc(x[m.cat]) + (m.num ? " · №" + esc(x[m.num]) : "") + '</small></div></label>';
    });
    if (list.length > 400) h += '<div class="dqqz-meta" style="padding:10px">İlk 400 sual göstərilir — sınaq üzrə süzün.</div>';
    r.innerHTML = h + "</div>";
  }

  /* ---- nəticələr */
  function statsOf(q, a) {
    var c = 0, w = 0, b = 0, wl = [];
    q.qs.forEach(function (x, i) { var v = a[i]; if (v == null || v < 0) b++; else if (v === x.c) c++; else { w++; wl.push(i + 1); } });
    return { c: c, w: w, b: b, wl: wl };
  }
  async function openRes(id) {
    var r = root(); setTitle("📊 Nəticələr"); r.innerHTML = '<div class="dqqz-meta" style="padding:30px;text-align:center">Yüklənir…</div>';
    try { var q = await loadQuiz(id); if (!q) throw new Error("Quiz tapılmadı"); var at = await attemptsOf(id); A.res = { q: q, at: at }; drawRes(); }
    catch (e) { r.innerHTML = '<div class="dqqz-card" style="color:#b91c1c">Xəta: ' + esc(e.message) + '</div><button class="dqqz-b" data-a="back">← Siyahı</button>'; }
  }
  function rowsOf() {
    var R = A.res, q = R.q;
    return R.at.map(function (a) { var s = statsOf(q, a.answers || []), sc = s.c; return { a: a, s: s, score: sc, pct: q.qs.length ? Math.round(sc * 100 / q.qs.length) : 0 }; })
      .sort(function (x, y) { return y.score - x.score || (x.a.sec || 0) - (y.a.sec || 0); });
  }
  function drawRes() {
    var R = A.res, q = R.q, rows = rowsOf(), r = root(); A.view = "res";
    var n = rows.length, avg = n ? (rows.reduce(function (s, x) { return s + x.score; }, 0) / n) : 0, pass = rows.filter(function (x) { return x.pct >= q.pass; }).length;
    var h = '<div class="dqqz-row" style="margin:0 0 10px"><button class="dqqz-b" data-a="back">← Siyahı</button><button class="dqqz-b" data-a="resref">↻ Yenilə</button><button class="dqqz-b p" data-a="print">🖨 Çap / PDF</button><button class="dqqz-b g" data-a="xlsx">⬇ Excel (.xlsx)</button><button class="dqqz-b" data-a="csv">⬇ CSV</button></div>' +
      '<div class="dqqz-card" style="padding:12px"><h4>' + esc(q.title) + '</h4><div class="dqqz-meta">' + esc(q.subject) + " · " + fmt(q.start) + " → " + fmt(q.end) + " · " + q.qs.length + ' sual · keçid balı ' + q.pass + '%</div></div>' +
      '<div class="dqqz-kp"><div><b>' + n + '</b><span>İştirakçı</span></div><div><b>' + avg.toFixed(1) + '</b><span>Orta bal</span></div><div><b>' + (n ? Math.round(pass * 100 / n) : 0) + '%</b><span>Keçənlər (' + pass + ')</span></div><div><b>' + (n ? Math.max.apply(null, rows.map(function (x) { return x.score; })) : 0) + '</b><span>Ən yüksək</span></div></div>';
    if (!n) h += '<div class="dqqz-card dqqz-meta" style="text-align:center">Hələ heç kim iştirak etməyib.</div>';
    else {
      h += '<div class="dqqz-sc"><table class="dqqz-tb"><thead><tr><th>№</th><th>Ad Soyad</th><th>Qeydiyyat №</th><th>Nəticə</th><th>%</th><th>Status</th><th>Vaxt</th><th>Başladı</th></tr></thead><tbody>';
      rows.forEach(function (x, i) {
        var ok = x.pct >= q.pass, bl = blanksOf(q, x.a.answers || []);
        h += '<tr data-a="det" data-r="' + x.a.rid + '"><td class="n">' + (i + 1) + '</td><td><b>' + esc(x.a.name) + '</b></td><td>' + esc(x.a.reg || "—") + (x.a.regOk === false ? ' <span title="Qeydiyyat yoxlanılmadı">⚠</span>' : "") + '</td><td style="min-width:190px"><b style="font-size:15px">' + x.score + "/" + q.qs.length + '</b>' + (x.s.wl.length ? ' <span style="color:#b91c1c;font-size:12.5px">(səhv suallar: ' + x.s.wl.join(",") + ')</span>' : "") + (bl.length ? ' <span style="color:#64748b;font-size:12.5px">(boş: ' + bl.join(",") + ')</span>' : "") + '</td><td class="n">' + x.pct + '%</td><td class="n" style="font-weight:800;color:' + (ok ? "#15803d" : "#b91c1c") + '">' + (ok ? "Keçdi" : "Keçmədi") + '</td><td class="n">' + hms(x.a.sec || 0) + '</td><td>' + fmt(x.a.at || 0) + '</td></tr>';
      });
      h += '</tbody></table></div><div class="dqqz-meta" style="margin-top:6px">Sətrə toxunun — iştirakçının hər sualda seçdiyi və doğru cavab görünür.</div>';
      h += '<div class="dqqz-h">Suallar üzrə statistika</div><div class="dqqz-sc"><table class="dqqz-tb" style="min-width:480px"><thead><tr><th>№</th><th>Sual</th><th>Doğru</th><th>Düzgün cavab verənlər</th></tr></thead><tbody>';
      q.qs.forEach(function (x, i) {
        var ok = rows.filter(function (y) { return (y.a.answers || [])[i] === x.c; }).length;
        h += '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(strip(qBody(x)).slice(0, 90)) + '</td><td class="n">' + LET[x.c] + '</td><td class="n">' + ok + " / " + n + " (" + Math.round(ok * 100 / n) + '%)</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    r.innerHTML = h;
  }
  function showDet(rid) {
    var R = A.res, a = R.at.filter(function (x) { return String(x.rid) === String(rid); })[0]; if (!a) return;
    var q = R.q, s = statsOf(q, a.answers || []), h = '<div class="dqqz-md"><div class="dqqz-row" style="justify-content:space-between;margin:0 0 8px"><b style="font-size:16px">' + esc(a.name) + '</b><button class="dqqz-b s" data-a="mclose">✕</button></div><div class="dqqz-meta">Qeydiyyat №: ' + esc(a.reg || "—") + ' · Düz: <b style="color:#15803d">' + s.c + '</b> · Səhv: <b style="color:#b91c1c">' + s.w + '</b> · Boş: ' + s.b + ' · ' + fmt(a.at || 0) + '</div>';
    if (!s.wl.length && !s.b) h += '<div class="dqqz-card" style="margin-top:10px;color:#15803d;font-weight:800">Bütün suallara düz cavab verib 🎉</div>';
    q.qs.forEach(function (x, i) {
      var v = (a.answers || [])[i]; if (v === x.c) return;
      h += '<div class="dqqz-card" style="margin-top:10px"><b>Sual ' + (i + 1) + '</b> ' + (v == null || v < 0 ? '<span class="dqqz-chip" style="background:#e2e8f0;color:#475569">cavabsız</span>' : "") + '<div style="margin:6px 0;line-height:1.5">' + qBody(x) + imgTag(x.i) + '</div><div style="font-size:13px"><span style="color:#b91c1c;font-weight:800">Seçdiyi: ' + (v == null || v < 0 ? "—" : LET[v] + ") " + esc(x.o[v].t || "(şəkil)")) + '</span><br><span style="color:#15803d;font-weight:800">Doğru: ' + LET[x.c] + ") " + esc(x.o[x.c].t || "(şəkil)") + '</span></div></div>';
    });
    var m = D.createElement("div"); m.className = "dqqz-mo"; m.id = "dqqz-mo"; m.innerHTML = h + '<div class="dqqz-row" style="margin-top:12px"><button class="dqqz-b r s" data-a="delat" data-r="' + a.rid + '">🗑 Bu iştirakçını sil (yenidən iştirak edə bilər)</button></div></div>';
    D.body.appendChild(m); m.addEventListener("click", function (e) { if (e.target === m) m.remove(); onAdminClick(e); });
  }
  function tableData() {
    var q = A.res.q, rows = rowsOf(), head = ["№", "Ad Soyad", "Qeydiyyat №", "Nəticə", "Düz", "Səhv", "Boş", "Faiz (%)", "Status", "Müddət", "Başlama vaxtı", "Səhv suallar"];
    var data = [head]; rows.forEach(function (x, i) { data.push([i + 1, x.a.name, x.a.reg || "", resText(x), x.s.c, x.s.w, x.s.b, x.pct, x.pct >= q.pass ? "Keçdi" : "Keçmədi", hms(x.a.sec || 0), fmt(x.a.at || 0), x.s.wl.join(", ")]); });
    return data;
  }
  function download(name, blob) { var u = URL.createObjectURL(blob), a = D.createElement("a"); a.href = u; a.download = name; D.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 800); }
  function fname(ext) { return (A.res.q.title || "quiz").replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40) + "_nəticələr." + ext; }
  function exportCsv() {
    var csv = "\ufeff" + tableData().map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
    download(fname("csv"), new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }
  function loadXlsx() {
    return new Promise(function (ok, no) {
      if (window.XLSX) return ok(window.XLSX);
      var s = D.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = function () { ok(window.XLSX); }; s.onerror = function () { no(new Error("Excel kitabxanası yüklənmədi")); }; D.head.appendChild(s);
    });
  }
  async function exportXlsx() {
    try {
      var X = await loadXlsx(), ws = X.utils.aoa_to_sheet(tableData()), wb = X.utils.book_new();
      ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 34 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 10 }, { wch: 10 }, { wch: 17 }, { wch: 30 }];
      X.utils.book_append_sheet(wb, ws, "Nəticələr");
      var q = A.res.q, ws2 = X.utils.aoa_to_sheet([["№", "Sual", "Doğru cavab"].concat(["Düzgün cavab verənlər"])].concat(q.qs.map(function (x, i) { var ok = A.res.at.filter(function (a) { return (a.answers || [])[i] === x.c; }).length; return [i + 1, strip(qBody(x)).slice(0, 200), LET[x.c], ok + " / " + A.res.at.length]; })));
      X.utils.book_append_sheet(wb, ws2, "Suallar");
      var out = X.write(wb, { bookType: "xlsx", type: "array" });
      download(fname("xlsx"), new Blob([out], { type: "application/octet-stream" }));
    } catch (e) { toast(e.message + " — CSV yüklənir", true); exportCsv(); }
  }

  /* ---- nəticə mətni + çap (yalnız admin) */
  function blanksOf(q, a) { var b = []; q.qs.forEach(function (x, i) { var v = a[i]; if (v == null || v < 0) b.push(i + 1); }); return b; }
  function resText(x) {
    var n = A.res.q.qs.length, bl = blanksOf(A.res.q, x.a.answers || []), p = [];
    if (x.s.wl.length) p.push("səhv suallar: " + x.s.wl.join(","));
    if (bl.length) p.push("boş: " + bl.join(","));
    return x.score + "/" + n + (p.length ? " (" + p.join("; ") + ")" : "");
  }
  function printHtml(html) {
    var f = D.createElement("iframe"); f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    D.body.appendChild(f); var d = f.contentWindow.document; d.open(); d.write(html); d.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Çap pəncərəsi açılmadı", true); }
      setTimeout(function () { f.remove(); }, 90000);
    }, 450);
  }
  function exportPrint() {
    var R = A.res, q = R.q, rows = rowsOf(), n = rows.length, avg = n ? rows.reduce(function (s, x) { return s + x.score; }, 0) / n : 0, pass = rows.filter(function (x) { return x.pct >= q.pass; }).length;
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc((q.title || "Quiz") + " — nəticələr") + '</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:12px;margin:0}.hd{border-bottom:3px solid #c9a227;padding-bottom:8px;margin-bottom:10px}.hd b{font-size:11px;letter-spacing:.12em;color:#0b1f4d}h1{font-size:19px;margin:3px 0 2px;color:#0b1f4d}.m{color:#475569;margin:0}.kp{display:flex;gap:10px;margin:10px 0}.kp div{border:1px solid #cbd5e1;border-radius:6px;padding:6px 12px}.kp b{display:block;font-size:16px}table{border-collapse:collapse;width:100%;margin-bottom:14px}th{background:#0b1f4d;color:#fff;text-align:left}th,td{border:1px solid #94a3b8;padding:5px 7px;vertical-align:top}tr{page-break-inside:avoid}tbody tr:nth-child(even) td{background:#f1f5f9}.ok{color:#15803d;font-weight:700}.no{color:#b91c1c;font-weight:700}.c{text-align:center;white-space:nowrap}h2{font-size:14px;color:#0b1f4d;margin:12px 0 6px}</style></head><body>' +
      '<div class="hd"><b>DQ PLATFORM</b><h1>' + esc(q.title) + '</h1><p class="m">' + esc(q.subject) + " · " + fmt(q.start) + " → " + fmt(q.end) + " · " + q.qs.length + " sual · Keçid balı: " + q.pass + '%</p></div>' +
      '<div class="kp"><div><b>' + n + '</b>İştirakçı</div><div><b>' + avg.toFixed(1) + '</b>Orta bal</div><div><b>' + pass + ' (' + (n ? Math.round(pass * 100 / n) : 0) + '%)</b>Keçənlər</div></div>' +
      '<table><thead><tr><th>№</th><th>Ad Soyad</th><th>Qeydiyyat №</th><th>Nəticə</th><th>%</th><th>Status</th><th>Müddət</th><th>Başlama</th></tr></thead><tbody>';
    rows.forEach(function (x, i) {
      var ok = x.pct >= q.pass;
      h += '<tr><td class="c">' + (i + 1) + '</td><td><b>' + esc(x.a.name) + '</b></td><td>' + esc(x.a.reg || "—") + '</td><td><b>' + esc(resText(x)) + '</b></td><td class="c">' + x.pct + '%</td><td class="c ' + (ok ? "ok" : "no") + '">' + (ok ? "Keçdi" : "Keçmədi") + '</td><td class="c">' + hms(x.a.sec || 0) + '</td><td class="c">' + fmt(x.a.at || 0) + '</td></tr>';
    });
    h += '</tbody></table><h2>Suallar üzrə statistika</h2><table><thead><tr><th>№</th><th>Sual</th><th>Doğru</th><th>Düz cavab verənlər</th></tr></thead><tbody>';
    q.qs.forEach(function (x, i) {
      var ok = rows.filter(function (y) { return (y.a.answers || [])[i] === x.c; }).length;
      h += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(strip(qBody(x)).slice(0, 110) || "(şəkilli sual)") + '</td><td class="c">' + LET[x.c] + '</td><td class="c">' + ok + " / " + n + (n ? " (" + Math.round(ok * 100 / n) + "%)" : "") + '</td></tr>';
    });
    h += '</tbody></table></body></html>';
    if (!n) return toast("Çap üçün nəticə yoxdur", true);
    printHtml(h);
  }

  /* ---- PDF-dən sual idxalı (ağıllı kəsmə) */
  var PI = { doc: null, qs: [], name: "", cp: 0, cc: null, src: [] };
  function loadPdfJs() {
    return new Promise(function (ok, no) {
      var V = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
      function ready() { try { if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = V + "pdf.worker.min.js"; } catch (e) { } ok(window.pdfjsLib); }
      if (window.pdfjsLib) return ready();
      var s = D.createElement("script"); s.src = V + "pdf.min.js"; s.onload = ready; s.onerror = function () { no(new Error("PDF kitabxanası yüklənmədi — internetə baxın")); }; D.head.appendChild(s);
    });
  }
  async function pageLines(page, pno) {
    var vp = page.getViewport({ scale: 1 }), W = vp.width, H = vp.height, tc = await page.getTextContent(), its = [];
    tc.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var fh = Math.abs(it.height) || Math.hypot(it.transform[2], it.transform[3]) || 10, base = H - it.transform[5];
      if (base < H * 0.05 || base > H * 0.955) return; /* başlıq/altlıq/səhifə nömrəsi */
      its.push({ s: it.str, x: it.transform[4], w: it.width, fh: fh, top: base - fh, bot: base + fh * 0.3, base: base });
    });
    var g = 0, two = false;
    if (its.length > 24) {
      var best = null;
      for (var k = Math.round(W * 0.38); k <= W * 0.62; k += 3) {
        var cr = 0, L = 0, Rr = 0;
        its.forEach(function (it) { if (it.x < k && it.x + it.w > k) cr++; else if (it.x + it.w / 2 < k) L++; else Rr++; });
        if (cr <= its.length * 0.03 && L >= its.length * 0.2 && Rr >= its.length * 0.2) { var sc = cr * 1000 + Math.abs(k - W / 2); if (!best || sc < best.sc) best = { k: k, sc: sc }; }
      }
      if (best) { g = best.k; two = true; }
    }
    var out = [], nc = two ? 2 : 1;
    for (var ci = 0; ci < nc; ci++) {
      var arr = its.filter(function (it) { var cx = it.x + it.w / 2; return !two || (ci === 0 ? cx < g : cx >= g); });
      arr.sort(function (a, b) { return a.base - b.base || a.x - b.x; });
      var lines = [];
      arr.forEach(function (it) {
        var Ln = lines[lines.length - 1];
        if (Ln && Math.abs(it.base - Ln.base) < Math.max(2.5, it.fh * 0.45)) Ln.its.push(it); else lines.push({ base: it.base, its: [it] });
      });
      lines.forEach(function (Ln) {
        Ln.its.sort(function (a, b) { return a.x - b.x; });
        var t = "", pe = null, top = 1e9, bot = 0;
        Ln.its.forEach(function (it) { if (pe !== null && it.x - pe > it.fh * 0.18) t += " "; t += it.s; pe = it.x + it.w; top = Math.min(top, it.top); bot = Math.max(bot, it.bot); });
        t = t.replace(/\s+/g, " ").trim();
        if (t) out.push({ t: t, p: pno, y0: top, y1: bot, cx0: ci === 0 ? W * 0.03 : g, cx1: ci === nc - 1 ? W * 0.97 : g });
      });
    }
    return out;
  }
  function dropRepeats(pages) {
    var cnt = {}, flat = [];
    pages.forEach(function (ls) { var seen = {}; ls.forEach(function (l) { var k = l.t.toLowerCase().replace(/\d+/g, "#"); if (!seen[k]) { seen[k] = 1; cnt[k] = (cnt[k] || 0) + 1; } }); });
    var lim = Math.max(3, Math.ceil(pages.length * 0.6));
    pages.forEach(function (ls) { ls.forEach(function (l) { var k = l.t.toLowerCase().replace(/\d+/g, "#"); if (pages.length >= 3 && cnt[k] >= lim && l.t.length < 90) return; flat.push(l); }); });
    return flat;
  }
  function joinStem(a) {
    var r = a[0] || "";
    for (var i = 1; i < a.length; i++) r += (/^(\d{1,2}\s*[\.\)]\s|[-•–]\s)/.test(a[i]) || /:$/.test(a[i - 1]) ? "\n" : " ") + a[i];
    return r.trim();
  }
  function parseQLines(lines) {
    var qs = [], cur = null, lastN = 0, key = {}, keyMode = false;
    function fin() { if (cur) { qs.push(cur); cur = null; } }
    function marks(s, from) {
      function scan(nx0) {
        var re = /(^|[^A-Za-zƏəİıÖöÜüÇçŞşĞğ])\(?([A-E])[\)\.]\s*/g, r, acc = [], nx = nx0;
        while ((r = re.exec(s))) { var L = LET.indexOf(r[2]); if (L === nx) { acc.push({ at: r.index + r[1].length, end: re.lastIndex }); nx++; } }
        return acc;
      }
      var m0 = scan(from);
      if (!m0.length && from === 0) { var m1 = scan(1); if (m1.length >= 3 && m1[0].at > 0) { m1.unshift({ at: 0, end: 0, lost: true }); return m1; } }
      return m0;
    }
    lines.forEach(function (ln) {
      var s = ln.t, m;
      if (!keyMode && lastN > 0 && (!cur || cur.o.length >= 2) && /^((düzgün|doğru)\s+)?cavablar|^cavab\s+açarı|^açar\b|^answers\b|^answer\s+key/i.test(s)) { fin(); keyMode = true; }
      if (keyMode) {
        var re2 = /(\d{1,3})\s*[-–—:\.\)=]*\s*\(?([A-Ea-e])\)?(?![A-Za-zƏəİıÖöÜüÇçŞşĞğ])/g, r2;
        while ((r2 = re2.exec(s))) key[+r2[1]] = LET.indexOf(r2[2].toUpperCase());
        return;
      }
      if (cur && (m = s.match(/^(?:doğru\s*)?(?:cavab|answer)\s*[:\-–]?\s*\(?([A-Ea-e])\)?\s*$/i))) { cur.ans = LET.indexOf(m[1].toUpperCase()); return; }
      if (cur) {
        var mk = marks(s, cur.o.length);
        if (mk.length && (mk[0].at === 0 || mk.length >= 2 || cur.o.length)) {
          if (mk[0].at > 0) { var pre = s.slice(0, mk[0].at).trim(); if (cur.o.length) cur.o[cur.o.length - 1] += " " + pre; else cur.st.push(pre); }
          for (var q = 0; q < mk.length; q++) { if (!cur.o.length) cur.fo = ln; cur.o.push(s.slice(mk[q].end, q + 1 < mk.length ? mk[q + 1].at : undefined).trim()); }
          if (mk[0].lost) { cur.o[0] = s.slice(0, mk[1].at).replace(/^\s+|\s+$/g, ""); }
          cur.ol = ln; return;
        }
      }
      m = s.match(/^(\d{1,3})\s*[\.\)\-–]\s*(.*)$/);
      if (m) {
        var n = +m[1];
        if ((!cur || cur.o.length >= 2 || cur.ans != null) && (lastN === 0 || (n > lastN && n <= lastN + 3))) { fin(); cur = { n: n, st: m[2] ? [m[2]] : [], sl: [ln], o: [], ans: null, fo: null, ol: null }; lastN = n; return; }
      }
      if (!cur) return;
      if (cur.o.length) { cur.o[cur.o.length - 1] += " " + s; cur.ol = ln; } else { cur.st.push(s); cur.sl.push(ln); }
    });
    fin();
    return qs.map(function (c) {
      var f = blankQ(); f.n = c.n; f.t = joinStem(c.st);
      for (var i = 0; i < 5; i++) f.o[i].t = (c.o[i] || "").trim();
      f.c = c.ans != null ? c.ans : (key[c.n] != null ? key[c.n] : -1);
      var fl = c.sl[0]; if (fl) {
        var same = c.sl.filter(function (l) { return l.p === fl.p && l.cx0 === fl.cx0; }), y1 = Math.max.apply(null, same.map(function (l) { return l.y1; }));
        if (c.fo && c.fo.p === fl.p && c.fo.cx0 === fl.cx0) y1 = Math.max(y1, c.fo.y0 - 1);
        var yy0 = Math.min.apply(null, same.map(function (l) { return l.y0; })), hs = same.reduce(function (a, l) { return a + (l.y1 - l.y0); }, 0), y1v = y1;
        if (c.ol && c.ol.p === fl.p && c.ol.cx0 === fl.cx0) y1v = Math.max(y1, c.ol.y1);
        f._box = { p: fl.p, x0: fl.cx0, x1: fl.cx1, y0: yy0, y1: y1, y1v: y1v };
        f._fig = (y1 - yy0) > hs * 1.9 + 24;
      }
      return f;
    });
  }
  function drawPdf() {
    var r = root(); A.view = "pdf"; setTitle("📄 PDF / şəkildən sual əlavə et");
    r.innerHTML = '<div class="dqqz-row" style="margin:0 0 6px"><button class="dqqz-b" data-a="qcancel">← Quizə qayıt</button></div><div class="dqqz-card"><div class="dqqz-meta" style="line-height:1.6"><b>PDF</b> (mətn qatlı) və ya <b>şəkil</b> (foto/skrin, bir neçəsini birlikdə seçə bilərsiniz) yükləyin. Sistem 1–2 sütunu tanıyır, başlıq/altlıq/su nişanını kənarlaşdırır, sualları nömrəyə görə ayırır, A–E variantlarını tapır. Şəkillərdə mətn OCR ilə oxunur və hər sual səliqəli şəkil kimi kəsilir. Cədvəl, fiqur, düstur olan suallar üçün <b>🖼 Şəkil</b> rejimi seçilir.</div><label class="dqqz-b p" style="display:inline-block;margin-top:12px;cursor:pointer">📎 PDF / şəkil seç<input type="file" accept="application/pdf,.pdf,image/*" multiple data-pdf="1" style="display:none"></label><div id="dqqz-pgs" class="dqqz-meta" style="margin-top:10px"></div></div>';
  }
  function loadImgFile(file) { return new Promise(function (ok, no) { var u = URL.createObjectURL(file), i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { no(new Error("Şəkil açılmadı: " + file.name)); }; i.src = u; }); }
  function cleanCanvas(img) {
    var k = Math.max(0.5, Math.min(2.2, 2000 / img.naturalWidth)), c = D.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    inkClean(c); return c;
  }
  /* su nişanı (açıq rəng) və rəngli əl yazısı/dairələr silinir, yalnız qara mətn/fiqur qalır */
  function inkClean(c) {
    var x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      var r = p[i], g1 = p[i + 1], b = p[i + 2], g = 0.299 * r + 0.587 * g1 + 0.114 * b, sat = Math.max(r, g1, b) - Math.min(r, g1, b), v;
      if (sat > 60 && g > 45) v = 255; else v = g >= 185 ? 255 : g <= 95 ? 0 : (g - 95) * 255 / 90;
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    x.putImageData(d, 0, 0);
  }
  function splitCols(c) {
    var W = c.width, H = c.height, x = c.getContext("2d"), p = x.getImageData(0, 0, W, H).data, ink = new Array(W).fill(0), tot = 0;
    for (var y = Math.round(H * 0.04); y < H * 0.97; y += 2) for (var i = 0; i < W; i++) if (p[(y * W + i) * 4] < 140) { ink[i]++; tot++; }
    var a = Math.round(W * 0.38), b = Math.round(W * 0.62), mx = a;
    for (var j = a; j < b; j++) if (ink[j] > ink[mx]) mx = j;
    var g;
    if (ink[mx] > H * 0.22) { g = mx; var w = Math.max(3, Math.round(W * 0.006)); x.fillStyle = "#fff"; x.fillRect(g - w, 0, w * 2, H); }
    else { var best = 1e9; g = Math.round(W / 2); for (var k = a; k < b; k++) { var s = 0; for (var q = -6; q <= 6; q++) s += ink[k + q] || 0; if (s < best) { best = s; g = k; } } }
    var L = 0, R = 0; for (var m = 0; m < W; m++) { if (m < g) L += ink[m]; else R += ink[m]; }
    return (L > tot * 0.15 && R > tot * 0.15) ? g : 0;
  }
  async function ocrLib() {
    if (!window.Tesseract) await new Promise(function (ok, no) { var s = D.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js"; s.onload = ok; s.onerror = function () { no(new Error("OCR kitabxanası yüklənmədi — internetə baxın")); }; D.head.appendChild(s); });
    try { return await window.Tesseract.createWorker("aze+eng"); } catch (e) { return await window.Tesseract.createWorker("eng"); }
  }
  async function imageLines(file, pno, wk, say) {
    var img = await loadImgFile(file), c = cleanCanvas(img), g = splitCols(c), W = c.width, H = c.height, out = [], cols = g ? [[0, g], [g, W]] : [[0, W]];
    PI.src[pno - 1] = { kind: "img", c: c };
    for (var ci = 0; ci < cols.length; ci++) {
      var x0 = cols[ci][0], x1 = cols[ci][1], sub = D.createElement("canvas"); sub.width = x1 - x0; sub.height = H;
      sub.getContext("2d").drawImage(c, x0, 0, x1 - x0, H, 0, 0, x1 - x0, H);
      say("OCR: " + file.name + " — sütun " + (ci + 1) + " / " + cols.length);
      var r = await wk.recognize(sub), ls = (r.data && r.data.lines) || [];
      ls.forEach(function (l) { var t = String(l.text || "").replace(/\s+/g, " ").trim(); if (t.length < 2 || !l.bbox) return; out.push({ t: t, p: pno, y0: l.bbox.y0, y1: l.bbox.y1, cx0: ci === 0 ? W * 0.02 : x0, cx1: ci === cols.length - 1 ? W * 0.98 : x1 }); });
    }
    return out;
  }
  async function runFiles(files) {
    var st = $("dqqz-pgs"); function say(t) { if (st) st.textContent = t; }
    try {
      files = files.slice().sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
      PI = { doc: null, qs: [], name: files.map(function (f) { return f.name; }).join(", "), cp: 0, cc: null, src: [] };
      var all = [], chars = 0, wk = null, pno = 0, fromImg = false;
      for (var fi = 0; fi < files.length; fi++) {
        var f = files[fi];
        if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
          say("PDF yüklənir: " + f.name); var lib = await loadPdfJs(), doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
          for (var p = 1; p <= doc.numPages; p++) { pno++; say("Oxunur: " + f.name + " — səhifə " + p + " / " + doc.numPages); PI.src[pno - 1] = { kind: "pdf", doc: doc, n: p }; var ls = await pageLines(await doc.getPage(p), pno); ls.forEach(function (l) { chars += l.t.length; }); all.push(ls); }
        } else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)) {
          fromImg = true; if (!wk) { say("OCR hazırlanır (ilk dəfə bir az çəkə bilər)…"); wk = await ocrLib(); }
          pno++; var il = await imageLines(f, pno, wk, say); il.forEach(function (l) { chars += l.t.length; }); all.push(il);
        }
      }
      if (wk) { try { await wk.terminate(); } catch (e) { } }
      if (chars < 40) throw new Error("Mətn tapılmadı. Mətn qatı olmayan PDF-i şəkil kimi (skrin) yükləyin.");
      PI.qs = parseQLines(dropRepeats(all));
      if (!PI.qs.length) throw new Error("Sual tanınmadı. Suallar “1.” kimi nömrələnməli, variantlar “A)” ilə başlamalıdır.");
      PI.qs.forEach(function (x) {
        var no = nOpt(x), top = 0; for (var k = 4; k >= 0; k--) if (x.o[k].t) { top = k + 1; break; }
        x.on = top >= 2 ? top : 5;
        x.m = no < 2 ? "sv" : (fromImg || x._fig) ? "s" : "t";
      });
      for (var qi = 0; qi < PI.qs.length; qi++) { say("Sual şəkilləri kəsilir: " + (qi + 1) + " / " + PI.qs.length); var xq = PI.qs[qi]; if (xq._box && xq.m !== "t") await ensureCrop(xq, xq.m === "sv"); }
      drawPdfPrev();
    } catch (e) { say("⚠ " + (e && e.message ? e.message : "Xəta")); }
  }
  function nOpt(x) { return x.o.filter(function (o) { return o.t && o.t.trim(); }).length; }
  async function ensureCrop(x, full) {
    var k = full ? "i2" : "i1"; if (x[k] || !x._box) return;
    var b = x._box; x[k] = await cropBox({ p: b.p, x0: b.x0, x1: b.x1, y0: b.y0, y1: full ? b.y1v : b.y1 });
  }
  function drawPdfPrev(keep) {
    var r = root(), qs = PI.qs, sc = r.scrollTop; A.view = "pdfp"; setTitle("📄 Yoxlama");
    var noAns = qs.filter(function (x) { return x.c < 0; }).length, weak = qs.filter(function (x) { return x.m !== "sv" && nOpt(x) < 2; }).length;
    var h = '<div class="dqqz-row" style="margin:0 0 8px"><button class="dqqz-b" data-a="pdfimp">← Başqa fayl</button><button class="dqqz-b" data-a="qcancel">Ləğv et</button></div><div class="dqqz-card" style="padding:12px"><b>' + qs.length + ' sual tanındı</b> <span class="dqqz-meta">(' + esc(PI.name.slice(0, 80)) + ')</span><div class="dqqz-meta" style="margin-top:4px;line-height:1.5">' + (noAns ? "⚠ " + noAns + " sualın doğru cavabı tapılmadı — variant hərfinə toxunub seçin. " : "✓ Bütün suallarda doğru cavab var. ") + (weak ? "⚠ " + weak + " sualda variant tam oxunmadı — 🖼+A–E rejimini seçin. " : "") + 'Rejimlər: 📝 mətn · 🖼 sual şəkil kimi · 🖼+A–E sual və variantlar şəkildə. Şəkillərdə su nişanı və rəngli əl yazısı/dairələr avtomatik silinir.</div></div>';
    qs.forEach(function (x, i) {
      var bad = x.c < 0 || (x.m !== "sv" && nOpt(x) < 2), mb = function (v, lb) { return '<button class="dqqz-b s" data-a="pdfm" data-i="' + i + '" data-v="' + v + '" style="' + (x.m === v ? "background:#4c1d95;color:#fff" : "") + '">' + lb + '</button>'; };
      h += '<div class="dqqz-card" style="margin-top:10px;padding:12px;' + (bad ? "border:1.5px solid #f59e0b" : "") + '"><div class="dqqz-row" style="justify-content:space-between;margin:0 0 6px"><b>Sual ' + (i + 1) + (x.n && x.n !== i + 1 ? ' <small style="color:#64748b">(' + x.n + ')</small>' : "") + '</b><span><button class="dqqz-b s" data-a="pdfup" data-i="' + i + '"' + (i ? "" : " disabled") + '>↑</button> <button class="dqqz-b s" data-a="pdfrm" data-i="' + i + '" style="color:#b91c1c">✕</button></span></div>' +
        '<div class="dqqz-row" style="margin:0 0 8px;gap:6px">' + mb("t", "📝 Mətn") + mb("s", "🖼 Şəkil") + mb("sv", "🖼+A–E") + '</div>';
      if (x.m === "t") h += '<textarea class="dqqz-in" data-pt="' + i + '" rows="3" style="font-size:13.5px">' + esc(x.t) + '</textarea>';
      else { var im = x.m === "sv" ? x.i2 : x.i1; h += im ? '<img src="' + im + '" alt="" style="max-width:100%;border:1px solid #e2e8f0;border-radius:8px;background:#fff">' : '<div class="dqqz-meta">Şəkil üçün yer tapılmadı</div>'; }
      if (x.m === "sv") {
        h += '<div class="dqqz-meta" style="margin:8px 0 4px">Variant sayı: ' + [2, 3, 4, 5].map(function (n) { return '<button class="dqqz-b s" data-a="pdfn" data-i="' + i + '" data-v="' + n + '" style="' + (x.on === n ? "background:#4c1d95;color:#fff" : "") + '">' + n + '</button>'; }).join(" ") + '</div><div class="dqqz-row" style="gap:6px">' + [0, 1, 2, 3, 4].slice(0, x.on).map(function (k) { return '<button class="dqqz-b s" data-a="pdfc" data-i="' + i + '" data-k="' + k + '" style="min-width:44px;' + (x.c === k ? "background:#15803d;color:#fff" : "") + '">' + LET[k] + '</button>'; }).join("") + '</div>';
      } else {
        var shown = 4; for (var k = 4; k >= 0; k--) if (x.o[k].t) { shown = Math.max(4, k + 1); break; }
        for (var k2 = 0; k2 < shown; k2++) h += '<div class="dqqz-row" style="margin-top:6px;flex-wrap:nowrap;gap:6px"><button class="dqqz-b s" data-a="pdfc" data-i="' + i + '" data-k="' + k2 + '" style="min-width:38px;' + (x.c === k2 ? "background:#15803d;color:#fff" : "") + '">' + LET[k2] + '</button><input class="dqqz-in" data-po="' + i + '-' + k2 + '" value="' + esc(x.o[k2].t) + '" style="padding:8px 10px;font-size:13.5px"></div>';
      }
      h += '</div>';
    });
    h += '<div class="dqqz-row" style="margin-top:14px"><button class="dqqz-b g" data-a="pdfadd">➕ ' + qs.length + ' sualı quizə əlavə et</button></div>';
    r.innerHTML = h; if (keep) r.scrollTop = sc;
  }
  function readPdfPrev() {
    PI.qs.forEach(function (x, i) {
      var t = D.querySelector('[data-pt="' + i + '"]'); if (t) x.t = t.value;
      for (var k = 0; k < 5; k++) { var o = D.querySelector('[data-po="' + i + "-" + k + '"]'); if (o) x.o[k].t = o.value; }
    });
  }
  async function cropBox(b) {
    var s = PI.src[b.p - 1], S = 1, c;
    if (!s) return "";
    if (s.kind === "img") c = s.c;
    else {
      S = 2.2; c = PI.cc;
      if (!c || PI.cp !== b.p) {
        var pg = await s.doc.getPage(s.n), vp = pg.getViewport({ scale: S }); c = D.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; PI.cc = c; PI.cp = b.p;
      }
    }
    var pad = 5 * S, x0 = Math.max(0, b.x0 * S - pad), y0 = Math.max(0, b.y0 * S - pad), x1 = Math.min(c.width, b.x1 * S + pad), y1 = Math.min(c.height, b.y1 * S + pad);
    var w = Math.max(10, x1 - x0), h = Math.max(10, y1 - y0), k = Math.min(1, 900 / w), o = D.createElement("canvas");
    o.width = Math.round(w * k); o.height = Math.round(h * k);
    var cx = o.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, o.width, o.height); cx.drawImage(c, x0, y0, w, h, 0, 0, o.width, o.height);
    if (s.kind !== "img") inkClean(o);
    return o.toDataURL("image/jpeg", 0.88);
  }

  /* ---- klik idarəsi */
  async function onAdminClick(e) {
    var t = e.target.closest ? e.target.closest("[data-a]") : null; if (!t) return;
    var a = t.getAttribute("data-a"), id = t.getAttribute("data-id");
    try {
      switch (a) {
        case "x": return closeAdmin();
        case "mclose": var mo = $("dqqz-mo"); if (mo) mo.remove(); return;
        case "reload": return refreshList();
        case "back": A.q = null; return refreshList();
        case "new": A.q = newQuiz(); return drawEdit();
        case "edit": { var q = await loadQuiz(id); if (!q) return toast("Tapılmadı", true); A.q = q; return drawEdit(); }
        case "dup": { var d = await loadQuiz(id); if (!d) return; delete d.id; d.title += " (surət)"; d.manual = ""; var s0 = Math.ceil((now() + 36e5) / 18e5) * 18e5, len = d.end - d.start; d.start = s0; d.end = s0 + len; d.created = now(); await saveQuiz(d); toast("Təkrarlandı"); return refreshList(); }
        case "del": if (!confirm("Quiz və bütün nəticələri silinsin? Bu geri qaytarılmır.")) return; await delQuiz(id); toast("Silindi"); return refreshList();
        case "copy": { var ok = await copy(linkOf(id)); return toast(ok ? "🔗 Link kopyalandı" : "Kopyalanmadı", !ok); }
        case "share": { var url = linkOf(id), L = A.list.filter(function (x) { return String(x.id) === String(id); })[0]; var tx = "🎯 " + (L ? L.title : "Quiz") + (L ? "\n🕒 " + fmt(L.start) + " – " + fmt(L.end) : "");
          if (navigator.share) { try { await navigator.share({ title: L ? L.title : "Quiz", text: tx, url: url }); return; } catch (x) { if (x && x.name === "AbortError") return; } }
          window.open("https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(tx), "_blank"); return; }
        case "on": await patchQuiz(id, { manual: "on" }); toast("Quiz aktiv edildi (dayandırana qədər açıq qalır)"); return refreshList();
        case "stop": await patchQuiz(id, { manual: "off" }); toast("Quiz dayandırıldı"); return refreshList();
        case "auto": await patchQuiz(id, { manual: "" }); toast("Vaxt cədvəlinə qaytarıldı"); return refreshList();
        case "res": return openRes(id);
        case "resref": return openRes(A.res.q.id);
        case "det": return showDet(t.getAttribute("data-r"));
        case "delat": { if (!confirm("İştirakçı nəticəsi silinsin?")) return; await api("dq_v2_store?id=eq." + t.getAttribute("data-r"), { method: "DELETE" }); var m2 = $("dqqz-mo"); if (m2) m2.remove(); toast("Silindi"); return openRes(A.res.q.id); }
        case "xlsx": return exportXlsx();
        case "csv": return exportCsv();
        case "subj": readEd(); A.q.subject = t.getAttribute("data-v"); return drawEdit();
        case "mode": readEd(); A.q.mode = t.getAttribute("data-v"); return drawEdit();
        case "qup": case "qdn": { readEd(); var i = +t.getAttribute("data-i"), j = a === "qup" ? i - 1 : i + 1, L2 = A.q.qs; var tmp = L2[i]; L2[i] = L2[j]; L2[j] = tmp; return drawEdit(); }
        case "qrm": readEd(); if (!confirm("Sual silinsin?")) return; A.q.qs.splice(+t.getAttribute("data-i"), 1); return drawEdit();
        case "qnew": readEd(); A.qi = -1; A.qf = blankQ(); return drawQEdit();
        case "qed": readEd(); A.qi = +t.getAttribute("data-i"); A.qf = JSON.parse(JSON.stringify(A.q.qs[A.qi])); if (A.qf.h) { A.qf.t = strip(A.qf.t); A.qf.h = false; } return drawQEdit();
        case "qcancel": return drawEdit();
        case "qimgx": readQForm(); A.qf.i = ""; return drawQEdit(true);
        case "qoix": readQForm(); A.qf.o[+t.getAttribute("data-i")].i = ""; return drawQEdit(true);
        case "qc": readQForm(); A.qf.c = +t.getAttribute("data-i"); return drawQEdit(true);
        case "qsave": case "qsave2": {
          readQForm(); var er = validQ(A.qf); if (er) return toast(er, true);
          var f = JSON.parse(JSON.stringify(A.qf)); if (A.qi >= 0) A.q.qs[A.qi] = f; else A.q.qs.push(f);
          toast("Sual saxlanıldı"); if (a === "qsave2") { A.qi = -1; A.qf = blankQ(); return drawQEdit(); } return drawEdit();
        }
        case "bulk": readEd(); return drawBulk();
        case "bulkgo": { var arr = parseBulk($("dqqz-bulk").value); if (!arr.length) return toast("Sual tapılmadı — formatı yoxlayın", true); arr.forEach(function (x) { A.q.qs.push(x); }); toast(arr.length + " sual əlavə olundu"); return drawEdit(); }
        case "dbimp": readEd(); return drawDb();
        case "dbf": DBC.f = t.getAttribute("data-v"); return drawDbList();
        case "dball": DBC.rows.filter(function (x) { return !DBC.f || (x[DBC.m.exam] + " · " + x[DBC.m.cat]) === DBC.f; }).slice(0, 400).forEach(function (x) { A.sel[x.id] = 1; }); return drawDbList();
        case "dbnone": A.sel = {}; return drawDbList();
        case "dbadd": {
          var ids = Object.keys(A.sel); if (!ids.length) return toast("Sual seçin", true);
          var add = 0; DBC.rows.forEach(function (x) { if (A.sel[x.id]) { var f2 = rowToQ(x, DBC.m); if (f2.c >= 0 && f2.o.filter(function (o) { return o.t; }).length >= 2) { A.q.qs.push(f2); add++; } } });
          toast(add + " sual əlavə olundu" + (add < ids.length ? " (" + (ids.length - add) + " sualın doğru cavabı tanınmadı)" : ""), add < ids.length); return drawEdit();
        }
        case "durp": readEd(); A.q.dur = +t.getAttribute("data-v"); return drawEdit();
        case "print": return exportPrint();
        case "pdfimp": readEd(); return drawPdf();
        case "pdfc": { readPdfPrev(); var pi = +t.getAttribute("data-i"), pk = +t.getAttribute("data-k"); PI.qs[pi].c = PI.qs[pi].c === pk ? -1 : pk; return drawPdfPrev(true); }
        case "pdfrm": readPdfPrev(); PI.qs.splice(+t.getAttribute("data-i"), 1); return drawPdfPrev(true);
        case "pdfup": { readPdfPrev(); var ui = +t.getAttribute("data-i"), tq = PI.qs[ui]; PI.qs[ui] = PI.qs[ui - 1]; PI.qs[ui - 1] = tq; return drawPdfPrev(true); }
        case "pdfm": {
          readPdfPrev(); var mi = +t.getAttribute("data-i"), mv = t.getAttribute("data-v"), mq = PI.qs[mi]; mq.m = mv;
          if (mv !== "t") { if (!mq._box) { mq.m = "t"; toast("Bu sualın yeri tapılmadı", true); } else { toast("Şəkil kəsilir…"); await ensureCrop(mq, mv === "sv"); } }
          return drawPdfPrev(true);
        }
        case "pdfn": { readPdfPrev(); var nq = PI.qs[+t.getAttribute("data-i")]; nq.on = +t.getAttribute("data-v"); if (nq.c >= nq.on) nq.c = -1; return drawPdfPrev(true); }
        case "pdfadd": {
          readPdfPrev(); var added = 0, noA = 0;
          for (var pj = 0; pj < PI.qs.length; pj++) {
            var x = PI.qs[pj];
            if (x.m !== "t") await ensureCrop(x, x.m === "sv");
            var f3 = { t: x.m === "t" ? x.t.trim() : "", i: x.m === "sv" ? (x.i2 || "") : x.m === "s" ? (x.i1 || "") : "", h: false, o: x.o.map(function (o) { return { t: (o.t || "").trim(), i: "" }; }), c: x.c };
            if (x.m === "sv") { f3.oi = x.on; f3.o.forEach(function (o) { o.t = ""; }); }
            else if (f3.c >= 0 && !f3.o[f3.c].t) f3.c = -1;
            if (!f3.t && !f3.i) continue;
            if (f3.c < 0) noA++;
            A.q.qs.push(f3); added++;
          }
          if (!added) return toast("Əlavə ediləcək sual yoxdur", true);
          PI.qs = []; PI.cc = null; PI.src = [];
          toast(added + " sual əlavə olundu" + (noA ? " — " + noA + " sualda doğru cavab seçilməyib" : ""), !!noA); return drawEdit();
        }
        case "save": {
          if (A.busy) return; readEd(); var Q = A.q;
          if (!Q.title) return toast("Quizin adını yazın", true);
          if (!Q.end || Q.end <= Q.start) return toast("Bitmə vaxtı başlamadan sonra olmalıdır", true);
          if (!Q.qs.length) return toast("Ən azı bir sual əlavə edin", true);
          for (var k = 0; k < Q.qs.length; k++) { var x = Q.qs[k], er2 = ""; if (x.c < 0) er2 = "Sual " + (k + 1) + ": doğru cavab seçilməyib"; else if (!(x.o[x.c].t || x.o[x.c].i || (x.oi && x.c < x.oi))) er2 = "Sual " + (k + 1) + ": doğru cavab boşdur"; if (er2) return toast(er2, true); }
          busy(true); t.disabled = true;
          try { await saveQuiz(Q); toast("✅ Yadda saxlanıldı"); drawEdit(); } finally { busy(false); t.disabled = false; }
          return;
        }
      }
    } catch (err) { toast(err && err.message ? err.message : "Xəta", true); }
  }
  /* ================================================================ İŞTİRAKÇI */
  var P = { q: null, run: null, tm: null, wt: null };
  function plClear() { clearInterval(P.tm); clearInterval(P.wt); P.tm = P.wt = null; }
  function plBox() { var o = $("dqqz-pl"); if (!o) { css(); o = D.createElement("div"); o.id = "dqqz-pl"; D.body.appendChild(o); D.body.style.overflow = "hidden"; } return o; }
  function closePlayer() {
    plClear(); var o = $("dqqz-pl"); if (o) o.remove(); D.body.style.overflow = "";
    try { var u = new URL(location.href); if (u.searchParams.has("dqquiz")) { u.searchParams.delete("dqquiz"); history.replaceState(null, "", u.pathname + (u.search || "") + u.hash); } } catch (e) { }
    P.q = null; P.run = null;
  }
  function plMsg(icon, title, text, btn) {
    plBox().innerHTML = '<div class="dqqz-ctr"><div class="dqqz-big"><div style="font-size:42px">' + icon + '</div><h2>' + esc(title) + '</h2><p>' + text + '</p>' + (btn === false ? "" : '<button class="dqqz-btn b" data-p="home">🏠 Əsas səhifəyə qayıt</button>') + '</div></div>';
  }
  function plClick(e) {
    var t = e.target.closest ? e.target.closest("[data-p]") : null; if (!t) return;
    var a = t.getAttribute("data-p");
    if (a === "home") return closePlayer();
    if (a === "start") return startForm();
    if (a === "opt") return setAns(+t.getAttribute("data-k"));
    if (a === "go") return goTo(+t.getAttribute("data-i"));
    if (a === "prev") return goTo(P.run.i - 1);
    if (a === "next") return goTo(P.run.i + 1);
    if (a === "clr") return setAns(-1);
    if (a === "fin") return finish(false);
    if (a === "retry") return retrySave();
    if (a === "print") return window.print();
  }
  async function openPlayer(id) {
    css(); plClear(); var box = plBox(); box.onclick = plClick;
    plMsg("⏳", "Yüklənir…", "", false);
    try { P.q = await loadQuiz(id); } catch (e) { return plMsg("⚠️", "Quiz yüklənmədi", esc(e.message)); }
    if (!P.q) return plMsg("🔍", "Quiz tapılmadı", "Link səhvdir və ya quiz silinib.");
    var done = jparse(lget("dqqz_done_" + id), null);
    if (done && done.answers) return showResult(done);
    gate();
  }
  function cdBoxes(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return [[d, "Gün"], [h, "Saat"], [m, "Dəq"], [x, "San"]].map(function (a) { return '<div><b>' + pad(a[0]) + '</b><span>' + a[1] + '</span></div>'; }).join("");
  }
  function gate() {
    plClear(); var q = P.q, s = stateOf(q);
    if (s === "wait") {
      plBox().innerHTML = '<div class="dqqz-ctr"><div class="dqqz-big"><div style="font-size:42px">🎯</div><h2>' + esc(q.title) + '</h2><p>' + esc(q.subject) + ' · ' + q.qs.length + ' sual</p><p>Quiz <b>' + fmt(q.start) + '</b> tarixində başlayacaq.<br>Taymer bitəndə quiz avtomatik aktivləşəcək.</p><div class="dqqz-cd" id="dqqz-cd">' + cdBoxes(q.start - now()) + '</div><button class="dqqz-btn l" data-p="home">Bağla</button></div></div>';
      P.wt = setInterval(function () { if (stateOf(q) !== "wait") { gate(); return; } var c = $("dqqz-cd"); if (c) c.innerHTML = cdBoxes(q.start - now()); }, 500);
      return;
    }
    if (s === "ended" || s === "closed") return plMsg("⚫", "Bu quiz bitib", s === "closed" ? "Quiz müvəqqəti dayandırılıb." : "Quiz " + fmt(q.end) + " tarixində başa çatıb.");
    var run = jparse(lget("dqqz_run_" + q.id), null);
    if (run && run.answers && run.answers.length === q.qs.length) { P.run = run; return drawRun(); }
    drawForm();
  }
  function drawForm(err) {
    var q = P.q, last = q.manual === "on" ? "" : "<br>Aktiv müddət: <b>" + fmt(q.end) + "</b> tarixinə qədər.";
    plBox().innerHTML = '<div class="dqqz-ctr"><div class="dqqz-big"><div style="font-size:42px">🎯</div><h2>' + esc(q.title) + '</h2><p>' + esc(q.subject) + ' · ' + q.qs.length + ' sual' + (q.dur ? ' · ' + q.dur + ' dəqiqə' : "") + '</p><p style="font-size:13px">' + (q.dur ? 'Başladıqdan sonra <b>' + q.dur + ' dəqiqə</b> vaxtınız olacaq.' : "") + last + '</p>' +
      '<div class="dqqz-fm"><label>Ad Soyad</label><input class="dqqz-in" id="dqqz-nm" autocomplete="name" maxlength="60" placeholder="Məsələn: Əli Məmmədov" value="' + esc(lget("dqqz_name") || "") + '">' +
      (q.reg ? '<label>Qeydiyyat (iş) nömrəniz</label><input class="dqqz-in" id="dqqz-rg" inputmode="text" autocomplete="off" maxlength="40" placeholder="Sayta qeydiyyatdan keçərkən aldığınız nömrə" value="' + esc(lget("dqqz_reg") || "") + '"><p style="font-size:12px;margin:6px 0 0">Quizdə iştirak üçün sayta qeydiyyatdan keçmiş olmalısınız.</p>' : "") + '</div>' +
      '<div class="dqqz-err" id="dqqz-er" style="display:' + (err ? "block" : "none") + '">' + (err || "") + '</div><button class="dqqz-btn" id="dqqz-go" data-p="start">▶ Quizə başla</button><button class="dqqz-btn l" data-p="home">Bağla</button></div></div>';
  }
  var regInfo = null;
  async function regCol() {
    if (regInfo) return regInfo; regInfo = { col: null };
    try {
      var r = await api("allowed_students?select=*&limit=1"), row = r && r[0];
      if (row) { var c = Object.keys(row).filter(function (k) { return /(nomr|number|^no$|_no$|code|kod|work|job|is_|iş)/i.test(k) && !/^id$|created|updated/i.test(k); })[0]; regInfo.col = c || null; }
    } catch (e) { }
    return regInfo;
  }
  async function checkReg(val) {
    var v = String(val || "").trim(); if (!v) return { ok: false };
    var ri = await regCol(), checked = false;
    if (ri.col) {
      try { var a = await api("allowed_students?select=" + encodeURIComponent(ri.col) + "&" + encodeURIComponent(ri.col) + "=eq." + encodeURIComponent(v) + "&limit=1"); checked = true; if (a && a.length) return { ok: true }; } catch (e) { }
    }
    try {
      var rr = await api("dq_v2_store?select=data&collection=eq.regs&limit=3000");
      if (rr && rr.length) {
        checked = true;
        var hit = rr.some(function (x) { var d = x.data || {}; return d.status === "approved" && Object.keys(d).some(function (k) { return k !== "status" && typeof d[k] !== "object" && String(d[k]).trim().toLowerCase() === v.toLowerCase(); }); });
        if (hit) return { ok: true };
      }
    } catch (e) { }
    return checked ? { ok: false } : { ok: true, unverified: true };
  }
  async function startForm() {
    var q = P.q, nm = ($("dqqz-nm").value || "").trim().replace(/\s+/g, " "), rg = q.reg && $("dqqz-rg") ? $("dqqz-rg").value.trim() : "", btn = $("dqqz-go"), er = $("dqqz-er");
    function bad(m) { er.style.display = "block"; er.textContent = m; btn.disabled = false; btn.textContent = "▶ Quizə başla"; }
    if (nm.split(" ").filter(function (x) { return x.length > 1; }).length < 2) return bad("Ad və soyadınızı tam yazın.");
    if (q.reg && !rg) return bad("Qeydiyyat nömrənizi yazın.");
    if (stateOf(q) !== "active") return gate();
    btn.disabled = true; btn.textContent = "Yoxlanılır…"; er.style.display = "none";
    try {
      var rc = { ok: true }; if (q.reg) rc = await checkReg(rg);
      if (!rc.ok) return bad("Bu nömrə ilə qeydiyyat tapılmadı. Əvvəlcə sayta qeydiyyatdan keçin, təsdiqdən sonra yenidən cəhd edin.");
      var key = q.reg && rg ? "r:" + norm(rg) : "n:" + norm(nm), ex = await findAttempt(q.id, key);
      if (ex) { var a = ex.data; a.rid = ex.id; return showResult(a, true); }
      lset("dqqz_name", nm); if (rg) lset("dqqz_reg", rg);
      P.run = { name: nm, reg: rg, regOk: rc.unverified ? false : true, key: key, t0: now(), answers: q.qs.map(function () { return -1; }), i: 0 };
      lset("dqqz_run_" + q.id, JSON.stringify(P.run)); drawRun();
    } catch (e) { bad("Xəta: " + e.message); }
  }
  function deadline() { var q = P.q, d = Infinity; if (q.dur > 0) d = P.run.t0 + q.dur * 6e4; if (q.manual !== "on" && !(q.dur > 0 && q.grace)) d = Math.min(d, q.end); return d; }
  function drawRun() {
    plClear(); var q = P.q, run = P.run, i = run.i, x = q.qs[i], ans = run.answers, done = ans.filter(function (v) { return v >= 0; }).length;
    var h = '<div class="dqqz-hd"><div class="tt">' + esc(q.title) + '</div><div class="tm" id="dqqz-tm">--:--:--</div></div><div class="dqqz-wrap"><div class="dqqz-main"><div class="dqqz-pn"><div class="dqqz-qc"><div class="dqqz-qh"><span>Sual ' + (i + 1) + ' (' + esc(q.subject) + ')</span><em>' + (ans[i] >= 0 ? "✔ cavablandı" : "cavabsız") + '</em></div><div class="dqqz-qt">' + qBody(x) + imgTag(x.i) + '</div>';
    x.o.forEach(function (o, k) { if (!(o.t || o.i || (x.oi && k < x.oi))) return; h += '<button class="dqqz-o' + (ans[i] === k ? " on" : "") + '" data-p="opt" data-k="' + k + '"><b>' + LET[k] + '</b><span>' + (o.t ? esc(o.t) : "") + imgTag(o.i, "dqqz-im dqqz-oi") + '</span></button>'; });
    h += '</div><div class="dqqz-nv"><button class="g" data-p="prev"' + (i ? "" : " disabled style='opacity:.45'") + '>Əvvəlki</button><button class="o" data-p="clr">Seçimi Ləğv Et</button><button class="r" data-p="fin">Testi Bitir</button><button class="n" data-p="next"' + (i < q.qs.length - 1 ? "" : " disabled style='opacity:.45'") + '>Növbəti</button></div></div>' +
      '<div class="dqqz-ca"><h5>Cavab Kartı</h5><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;margin:0 0 8px"><span>' + esc(q.subject) + '</span><span>' + done + ' / ' + q.qs.length + '</span></div><div class="dqqz-gr">' + q.qs.map(function (_, k) { return '<button data-p="go" data-i="' + k + '" class="' + (ans[k] >= 0 ? "a " : "") + (k === i ? "c" : "") + '">' + (k + 1) + '</button>'; }).join("") + '</div></div></div></div>';
    var box = plBox(), sc = box.scrollTop; box.innerHTML = h; box.scrollTop = 0; void sc;
    var tick = function () {
      var el = $("dqqz-tm"); if (!el) return; var left = (deadline() - now()) / 1000;
      if (deadline() === Infinity) { el.textContent = hms((now() - P.run.t0) / 1000); return; }
      el.textContent = hms(left); el.classList.toggle("low", left < 60);
      if (left <= 0) { plClear(); finish(true); }
    };
    tick(); P.tm = setInterval(tick, 500);
  }
  function saveRun() { lset("dqqz_run_" + P.q.id, JSON.stringify(P.run)); }
  function setAns(k) { P.run.answers[P.run.i] = k; saveRun(); drawRun(); }
  function goTo(i) { if (i < 0 || i >= P.q.qs.length) return; P.run.i = i; saveRun(); drawRun(); }
  async function finish(auto) {
    var q = P.q, run = P.run; if (!run) return;
    if (!auto) {
      var blank = run.answers.filter(function (v) { return v < 0; }).length;
      if (!confirm(blank ? blank + " sual cavabsızdır. Testi bitirmək istəyirsiniz?" : "Testi bitirmək istəyirsiniz?")) return;
    }
    plClear();
    var s = statsOf(q, run.answers), end = Math.min(now(), deadline() === Infinity ? now() : deadline());
    var res = { quizId: String(q.id), key: run.key, name: run.name, reg: run.reg, regOk: run.regOk, answers: run.answers, c: s.c, w: s.w, b: s.b, total: q.qs.length, sec: Math.max(1, Math.round((end - run.t0) / 1000)), at: run.t0 };
    lset("dqqz_done_" + q.id, JSON.stringify(res)); ldel("dqqz_run_" + q.id); P.run = null;
    try { await saveAttempt(res); res.saved = true; } catch (e) { res.saved = false; res.err = e.message; }
    P.last = res; showResult(res);
  }
  async function retrySave() { var r = P.last; if (!r) return; try { await saveAttempt(r); r.saved = true; toast("Nəticə göndərildi"); showResult(r); } catch (e) { toast("Yenə alınmadı: " + e.message, true); } }
  function showResult(res, dup) {
    plClear(); var q = P.q, ans = res.answers || [], s = statsOf(q, ans), n = q.qs.length, pct = n ? Math.round(s.c * 100 / n) : 0, ok = pct >= q.pass, CH = 20;
    var tabs = "";
    for (var from = 0; from < n; from += CH) {
      var idx = []; for (var j = from; j < Math.min(n, from + CH); j++) idx.push(j);
      tabs += '<div class="dqqz-gt"><table><thead><tr><th colspan="' + (idx.length + 1) + '">Testlər</th></tr></thead><tbody><tr><td class="l">Sual №</td>' + idx.map(function (k) { return '<td>' + (k + 1) + '</td>'; }).join("") + '</tr>' +
        (q.showAns ? '<tr><td class="l">Doğru cavab</td>' + idx.map(function (k) { return '<td>' + LET[q.qs[k].c] + '</td>'; }).join("") + '</tr>' : "") +
        '<tr><td class="l">Cavab</td>' + idx.map(function (k) { var v = ans[k]; return '<td class="' + (v == null || v < 0 ? "" : (v === q.qs[k].c ? "good" : "bad")) + '">' + (v == null || v < 0 ? "-" : LET[v]) + '</td>'; }).join("") + '</tr></tbody></table></div>';
    }
    var wrong = "";
    if (q.showAns && s.wl.length) {
      wrong = '<div class="sb" style="margin-top:26px">Səhv cavab verdiyiniz suallar</div>';
      s.wl.forEach(function (no) { var x = q.qs[no - 1], v = ans[no - 1]; wrong += '<div class="dqqz-card"><b>Sual ' + no + '</b><div style="margin:6px 0;line-height:1.5">' + qBody(x) + imgTag(x.i) + '</div><div style="font-size:13px"><span style="color:#b91c1c;font-weight:800">Sizin cavab: ' + LET[v] + ") " + esc(x.o[v].t || "(şəkil)") + '</span><br><span style="color:#15803d;font-weight:800">Doğru cavab: ' + LET[x.c] + ") " + esc(x.o[x.c].t || "(şəkil)") + '</span></div></div>'; });
    }
    plBox().innerHTML = '<div class="dqqz-rs">' + (dup ? '<div class="dqqz-err" style="margin:0 0 14px">Bu qeydiyyatla quizdə artıq iştirak edilib — nəticəniz aşağıdadır.</div>' : "") +
      '<h3>' + esc(q.title) + ' — sınaq nəticələri haqqında məlumat</h3><h4>' + esc(String(res.name || "").toLocaleUpperCase("az")) + '</h4><div class="inf">Qrup: <b>' + esc(q.subject) + '</b><br>Quizin tarixi və vaxtı: <b>' + fmt(res.at || q.start) + '</b><br>Quizin keçirildiyi ünvan: <b>Dqplatform</b><br>Sərf olunan vaxt: <b>' + hms(res.sec || 0) + '</b></div>' +
      '<div class="sb">' + esc(q.subject) + '</div>' + tabs + '<div class="sm">Doğru cavabların sayı: <b>' + s.c + '</b>; Yanlış cavabların sayı: <b>' + s.w + '</b>; Cavablandırılmayan test tapşırıqlarının sayı: <b>' + s.b + '</b>; Topladığı bal: <b>' + s.c + '</b></div>' +
      '<div class="tot">Doğru cavabların sayı: ' + s.c + '<br>Yanlış cavabların sayı: ' + s.w + '<br>Cavablandırılmayan test tapşırıqlarının sayı: ' + s.b + '</div>' +
      '<div class="dqqz-sc2">YEKUN BAL: ' + s.c + ' / ' + n + ' (' + pct + '%)</div><div class="dqqz-sc2 ' + (ok ? "ok" : "no") + '">' + (ok ? "Təbrik edirik! Quizdən uğurla keçdiniz." : "Test imtahanından müvəffəqiyyət əldə etməmisiniz.") + '</div>' +
      (res.saved === false ? '<div class="dqqz-err dqqz-noprint">Nəticə serverə yazılmadı (' + esc(res.err || "şəbəkə xətası") + '). İnterneti yoxlayıb yenidən göndərin.<button class="dqqz-btn b" data-p="retry" style="margin-top:8px">↻ Yenidən göndər</button></div>' : "") +
      '<button class="dqqz-btn dqqz-noprint" data-p="home" style="background:#15803d">🏠 Əsas Səhifəyə Qayıt</button>' + wrong + '</div>';
    plBox().scrollTop = 0;
  }

  /* ================================================================ ANA SƏHİFƏ */
  var HB = { list: [], tk: null, rf: null, tries: 0 };
  function bansBox() {
    var c = $("dqqz-bans"); if (c && D.body.contains(c)) return c;
    var anc = $("lxp-ban"); if (!anc) return null;
    c = D.createElement("div"); c.id = "dqqz-bans"; anc.parentNode.insertBefore(c, anc.nextSibling); return c;
  }
  function drawBans() {
    var c = bansBox(); if (!c) return; css();
    var t = now(), vis = HB.list.filter(function (q) { var s = stateOf(q, t); return s === "wait" || s === "active"; });
    if (!vis.length) { c.innerHTML = ""; c._sig = ""; return; }
    var sig = vis.map(function (q) { return q.id + stateOf(q, t); }).join("|");
    if (c._sig !== sig) {
      c._sig = sig;
      c.innerHTML = vis.map(function (q) {
        var s = stateOf(q, t);
        return '<div class="dqqz-ban" data-id="' + q.id + '"><div class="ic">🎯</div><div class="tx"><b>' + esc(q.title) + '</b><small>' + esc(q.subject) + ' · ' + q.n + ' sual · ' + (s === "wait" ? "Başlama: " + fmt(q.start) : "Quiz başladı!") + '</small></div>' +
          (s === "wait" ? '<div class="tm" data-st="' + q.start + '"></div><button data-q="' + q.id + '">Ətraflı</button>' : '<button class="lv" data-q="' + q.id + '">▶ Quizə başla</button>') + '</div>';
      }).join("");
      c.onclick = function (e) { var b = e.target.closest("[data-q]"); if (b) openPlayer(b.getAttribute("data-q")); };
    }
    [].forEach.call(c.querySelectorAll(".tm[data-st]"), function (e) {
      var s = Math.max(0, Math.floor((+e.getAttribute("data-st") - t) / 1000));
      e.innerHTML = [[Math.floor(s / 86400), "gün"], [Math.floor(s % 86400 / 3600), "saat"], [Math.floor(s % 3600 / 60), "dəq"], [s % 60, "san"]].map(function (a) { return '<i><b>' + pad(a[0]) + '</b><span>' + a[1] + '</span></i>'; }).join("");
    });
  }
  async function homeLoad() {
    try { HB.list = (await api("dq_v2_store?select=" + LIGHT + "&collection=eq." + COL + "&data->>mode=eq.public&order=id.desc&limit=30")).map(lightQ); } catch (e) { return; }
    drawBans();
  }
  function homeInit() {
    homeLoad(); clearInterval(HB.tk); clearInterval(HB.rf);
    HB.tk = setInterval(function () { if (HB.list.length || $("dqqz-bans")) { if (!bansBox() && HB.tries++ > 40) return; drawBans(); } }, 1000);
    HB.rf = setInterval(homeLoad, 90000);
  }

  /* ================================================================ BAŞLAT */
  function injectCard() {
    var g = D.querySelector("#admin-panel .admin-nav-grid"); if (!g || g.querySelector("[data-dqqz]")) return;
    var c = D.createElement("div"); c.className = "admin-nav-card"; c.setAttribute("data-dqqz", "1");
    c.innerHTML = '<span class="icon">🎯</span> Vaxtlı Quiz Sınaqları'; c.onclick = openAdmin; g.appendChild(c);
  }
  function quizParam() {
    try { var u = new URL(location.href), v = u.searchParams.get("dqquiz"); if (v) return v; var m = location.hash.match(/dqquiz=([\w-]+)/); return m ? m[1] : null; } catch (e) { return null; }
  }
  function init() {
    var id = quizParam();
    if (id) openPlayer(id);
    homeInit(); injectCard(); setInterval(injectCard, 2000);
  }
  window.DQQZ = { open: openAdmin, play: openPlayer, state: stateOf };
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", init); else init();
})();
