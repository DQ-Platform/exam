/* DQ Kitab — "Sınaq Toplusu" modulu
   Admin: toplu yarat (fənn seç, bazadakı sınaq + kateqoriyanı əlavə et, sırala, rəng seç)
   Oxu: üz qabığı → mündəricat → bölmələr → cavab açarı → arxa qabıq (səhifə çevirmə, çap/PDF)
   Məlumat: dq_v2_store, collection = "kitab"  */
(function () {
  "use strict";
  if (window.DQK) return;

  var D = document, COLL = "kitab", L = ["A", "B", "C", "D", "E", "F"];
  var SUBJ = {
    az: { name: "Azərbaycan dili", a: 1, b: 15 },
    qanun: { name: "Qanunvericilik", a: 16, b: 55 },
    info: { name: "İnformatika", a: 56, b: 70 },
    mantiq: { name: "Məntiq", a: 71, b: 100 }
  };
  var ORDER = ["az", "qanun", "info", "mantiq"];
  var SUBJ_CHIPS = [["all", "Ümumi (4 fənn)"], ["az", "Azərbaycan dili"], ["qanun", "Qanunvericilik"], ["info", "İnformatika"], ["mantiq", "Məntiq"]];
  var THEMES = [
    { n: "Lacivərd", a: "#0a2f7a", b: "#1d4fae", g: "#d9a441" },
    { n: "Zümrüd", a: "#064e3b", b: "#059669", g: "#e8c872" },
    { n: "Bordo", a: "#7f1d1d", b: "#b91c1c", g: "#e8c872" },
    { n: "Qara", a: "#0f172a", b: "#334155", g: "#d9a441" },
    { n: "Bənövşəyi", a: "#4c1d95", b: "#7c3aed", g: "#f0c14b" },
    { n: "Okean", a: "#0e5a73", b: "#0891b2", g: "#fcd34d" }
  ];

  function $(i) { return D.getElementById(i); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rich(s) {
    s = s == null ? "" : String(s);
    if (/<\/?[a-z][^>]*>/i.test(s)) return s;
    return esc(s).replace(/\r?\n/g, "<br>");
  }
  function plain(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function isAdmin() {
    try { return lget("dq_admin_logged") === "true" || window.__dqAuthed === true || !!(window.DQNav && DQNav.isAdmin && DQNav.isAdmin()); } catch (e) { return false; }
  }
  function theme(i) { return THEMES[i] || THEMES[0]; }
  function subjName(k) { return k === "all" ? "Ümumi" : (SUBJ[k] ? SUBJ[k].name : k); }
  function subjList(k) { return k === "all" || !SUBJ[k] ? ORDER.slice() : [k]; }
  function inRange(k) { var s = SUBJ[k]; return function (r) { var n = +r.q_number; return n >= s.a && n <= s.b; }; }
  function isOpen(cat, n) { try { return cat === "BA" && openQuestionIds.indexOf(+n) > -1; } catch (e) { return false; } }
  function toast(t, err) {
    var d = D.createElement("div"); d.className = "dqk-toast" + (err ? " er" : ""); d.textContent = t; D.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add("on"); });
    setTimeout(function () { d.classList.remove("on"); setTimeout(function () { d.remove(); }, 400); }, 2300);
  }

  /* ------------------------------------------------------------------ saxlama */
  async function listAll() { try { return (await V2.list(COLL)) || []; } catch (e) { return []; } }
  async function saveDoc(o) { await V2.put(COLL, o, o._id); }
  async function delDoc(id) {
    await V2.probe();
    if (V2.mode === "cloud") await _supabase.from("dq_v2_store").delete().eq("id", id);
    else lset("dq_v2_" + COLL, JSON.stringify((await V2.list(COLL)).filter(function (x) { return x._id != id; })));
  }

  /* ------------------------------------------------------------------ baza */
  var IDX = null, idxP = null, QC = {};
  function loadIdx(force) {
    if (IDX && !force) return Promise.resolve(IDX);
    if (idxP) return idxP;
    idxP = (async function () {
      var map = {}, from = 0;
      for (;;) {
        var r = await _supabase.from("exam_questions").select("exam_id,category,q_number").order("id", { ascending: true }).range(from, from + 999);
        if (r.error) throw r.error;
        var d = r.data || [];
        d.forEach(function (x) {
          var c = String(x.category || "").toUpperCase(), k = String(x.exam_id) + "|" + c;
          var m = map[k] || (map[k] = { e: String(x.exam_id), c: c, n: [] });
          m.n.push(+x.q_number);
        });
        if (d.length < 1000 || from > 200000) break;
        from += 1000;
      }
      IDX = map; return map;
    })();
    idxP.then(function () { idxP = null; }, function () { idxP = null; });
    return idxP;
  }
  function cnt(e, c, subj) {
    var m = IDX && IDX[String(e) + "|" + String(c).toUpperCase()];
    if (!m) return 0;
    if (subj === "all") return m.n.length;
    var s = SUBJ[subj]; return m.n.filter(function (n) { return n >= s.a && n <= s.b; }).length;
  }
  async function getQs(e, c) {
    var k = e + "|" + c;
    if (QC[k]) return QC[k];
    var r = await _supabase.from("exam_questions").select("*").eq("exam_id", String(e)).eq("category", c).order("q_number", { ascending: true });
    if (r.error) throw r.error;
    QC[k] = r.data || []; return QC[k];
  }

  /* ------------------------------------------------------------------ CSS */
  function css() {
    if ($("dqk-css")) return;
    var s = D.createElement("style"); s.id = "dqk-css";
    s.textContent = [
      "#dqk-root,#dqk-rd{position:fixed;inset:0;display:none;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;text-align:left;-webkit-tap-highlight-color:transparent}",
      "#dqk-root{z-index:100004;background:#eef2f9;flex-direction:column}",
      "#dqk-rd{z-index:100006;background:radial-gradient(120% 90% at 50% 0%,#24324f,#0e1626 70%);flex-direction:column;color:#e6ecf8}",
      "#dqk-root.on,#dqk-rd.on{display:flex}",
      ".dqk-top{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 14px 12px;background:linear-gradient(90deg,#0a2f7a,#2f63bd);color:#fff;flex:none}",
      ".dqk-top h3{margin:0;flex:1;text-align:left;font-size:17px;color:#fff}",
      ".dqk-x{width:36px;height:36px;border-radius:50%;border:0;background:#ffffff2e;color:#fff;font-size:16px;cursor:pointer}",
      ".dqk-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:16px 14px 40px}",
      ".dqk-wrap{max-width:860px;margin:0 auto}",
      ".dqk-btn{border:0;border-radius:12px;padding:11px 16px;font:700 14px inherit;font-family:inherit;cursor:pointer;color:#fff;background:#0a2f7a;transition:transform .15s,box-shadow .2s}",
      ".dqk-btn:active{transform:scale(.97)}.dqk-btn.g{background:#16a34a}.dqk-btn.r{background:#dc2626}.dqk-btn.o{background:#fff;color:#0a2f7a;border:1.5px solid #c9d6ee}.dqk-btn.s{padding:7px 11px;font-size:12.5px;border-radius:10px}.dqk-btn.gold{background:linear-gradient(135deg,#ffd36b,#f5a623);color:#1b2a55}",
      ".dqk-btn[disabled]{opacity:.5;pointer-events:none}",
      ".dqk-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:14px}",
      ".dqk-card{background:#fff;border-radius:18px;padding:14px;border:1px solid #dbe5f6;box-shadow:0 8px 22px -14px #0a2f7a66;display:flex;flex-direction:column;gap:10px;animation:dqkUp .45s cubic-bezier(.22,1,.36,1) both}",
      ".dqk-mini{height:150px;border-radius:6px 12px 12px 6px;position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px 16px 14px 24px;background:linear-gradient(135deg,var(--a),var(--b));box-shadow:inset 8px 0 10px -6px #0006,0 10px 20px -10px #0007}",
      ".dqk-mini:before{content:'';position:absolute;left:10px;top:0;bottom:0;width:2px;background:#0004}",
      ".dqk-mini:after{content:'';position:absolute;inset:8px 8px 8px 18px;border:1.5px solid var(--g);opacity:.55;border-radius:3px;pointer-events:none}",
      ".dqk-mini b{font:700 16px/1.25 Georgia,'Times New Roman',serif;max-width:100%;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
      ".dqk-mini i{font-style:normal;margin-top:8px;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--g);font-weight:800}",
      ".dqk-meta{font-size:12.5px;color:#64748b;line-height:1.5}",
      ".dqk-row{display:flex;gap:8px;flex-wrap:wrap}",
      ".dqk-empty{text-align:center;color:#64748b;padding:40px 14px;background:#fff;border:1.5px dashed #c8d4ec;border-radius:18px;margin-top:14px}",
      ".dqk-ed{background:#fff;border-radius:18px;padding:16px;border:1px solid #dbe5f6;margin-top:12px}",
      ".dqk-ed label{display:block;font-size:12px;font-weight:800;color:#475569;margin:14px 0 6px;letter-spacing:.3px;text-transform:uppercase}",
      ".dqk-in{width:100%;box-sizing:border-box;padding:12px 13px;border:1.5px solid #cbd5e1;border-radius:12px;font:15px inherit;font-family:inherit;background:#fff;color:#0f172a}",
      ".dqk-in:focus{outline:none;border-color:#2f63bd;box-shadow:0 0 0 4px #2f63bd22}",
      ".dqk-chips{display:flex;flex-wrap:wrap;gap:8px}",
      ".dqk-chip{border:1.5px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:8px 14px;font:700 13px inherit;font-family:inherit;cursor:pointer;transition:all .2s}",
      ".dqk-chip.on{background:#0a2f7a;border-color:#0a2f7a;color:#fff}.dqk-chip small{opacity:.7;font-weight:600;margin-left:4px}.dqk-chip.z{opacity:.55}",
      ".dqk-sw{width:46px;height:46px;border-radius:12px;border:3px solid transparent;cursor:pointer;box-shadow:0 4px 10px -4px #0006;position:relative}",
      ".dqk-sw.on{border-color:#0f172a}.dqk-sw.on:after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900}",
      ".dqk-it{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;background:#f8fafc}",
      ".dqk-it>span{width:28px;height:28px;border-radius:50%;background:#0a2f7a;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none}",
      ".dqk-it>div{flex:1;min-width:0}.dqk-it b{display:block;font-size:14.5px}.dqk-it small{color:#64748b;font-size:12px}",
      ".dqk-it button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:14px}",
      ".dqk-h{margin:20px 2px 8px;font-size:13px;font-weight:800;color:#0a2f7a;letter-spacing:.3px}",
      ".dqk-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translate(-50%,16px);z-index:100020;background:#15803d;color:#fff;padding:11px 18px;border-radius:999px;font:700 14px system-ui,sans-serif;opacity:0;transition:.35s;box-shadow:0 10px 26px -8px #0006;max-width:90vw;text-align:center}",
      ".dqk-toast.on{opacity:1;transform:translate(-50%,0)}.dqk-toast.er{background:#b91c1c}",
      "@keyframes dqkUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",

      /* ---------- oxuyucu ---------- */
      "#dqk-rd .dqk-rtop{display:flex;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 10px 8px;flex:none;background:#0b1220cc;backdrop-filter:blur(8px);border-bottom:1px solid #ffffff14}",
      "#dqk-rd .dqk-rtop h4{flex:1;min-width:0;margin:0 4px;text-align:left;font:600 13.5px Georgia,serif;color:#dbe4f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#dqk-rd .dqk-ib{min-width:38px;height:38px;padding:0 10px;border-radius:11px;border:1px solid #ffffff26;background:#ffffff12;color:#fff;font:700 13px inherit;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px}",
      "#dqk-rd .dqk-ib.on{background:#d9a441;border-color:#d9a441;color:#1b2a55}",
      "#dqk-rd .dqk-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px 8px;position:relative;touch-action:pan-y}",
      ".dqk-spread{display:flex;align-items:stretch;height:100%;max-height:100%;filter:drop-shadow(0 22px 34px #000a)}",
      ".dqk-pg{position:relative;background:#fffdf7;color:#1b2333;display:flex;flex-direction:column;overflow:hidden;font-family:Georgia,'Noto Serif','Times New Roman',serif;line-height:1.55}",
      ".dqk-pg.L{border-radius:10px 2px 2px 10px;background:linear-gradient(90deg,#fffdf7 92%,#e9e1cc)}",
      ".dqk-pg.R{border-radius:2px 10px 10px 2px;background:linear-gradient(270deg,#fffdf7 92%,#e9e1cc)}",
      ".dqk-pg.S{border-radius:8px}.dqk-pg.blank{background:linear-gradient(90deg,#f3ecd9,#e9e1cc)}",
      ".dqk-pg.fwd{animation:dqkFwd .5s cubic-bezier(.22,1,.36,1) both;transform-origin:left center}",
      ".dqk-pg.bwd{animation:dqkBwd .5s cubic-bezier(.22,1,.36,1) both;transform-origin:right center}",
      "@keyframes dqkFwd{from{opacity:0;transform:perspective(1500px) rotateY(-30deg) translateX(22px)}to{opacity:1;transform:none}}",
      "@keyframes dqkBwd{from{opacity:0;transform:perspective(1500px) rotateY(30deg) translateX(-22px)}to{opacity:1;transform:none}}",
      ".dqk-rh{display:flex;justify-content:space-between;gap:10px;padding:12px 22px 7px;font:700 10px/1.2 system-ui,sans-serif;letter-spacing:1.3px;text-transform:uppercase;color:#8a7f66;border-bottom:1px solid #e6dcc3;margin:0 14px;flex:none}",
      ".dqk-rh span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dqk-bd{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 22px 6px}",
      ".dqk-pn{flex:none;text-align:center;font:600 12px Georgia,serif;color:#8a7f66;padding:6px 0 11px}",
      ".dqk-pn:before,.dqk-pn:after{content:'—';margin:0 8px;opacity:.5}",
      ".dqk-pg.L .dqk-pn{text-align:left;padding-left:22px}.dqk-pg.R .dqk-pn{text-align:right;padding-right:22px}",
      ".dqk-pg.L .dqk-pn:before,.dqk-pg.L .dqk-pn:after,.dqk-pg.R .dqk-pn:before,.dqk-pg.R .dqk-pn:after{content:none}",
      ".dqk-ban{margin:2px 0 14px;padding:10px 14px;border-radius:10px;color:#fff;background:linear-gradient(120deg,var(--a),var(--b));font:800 15px Georgia,serif;display:flex;justify-content:space-between;align-items:center;gap:8px}",
      ".dqk-ban small{font:700 11px system-ui,sans-serif;opacity:.85;letter-spacing:.6px}",
      ".dqk-q{display:flex;gap:10px;margin:0 0 15px;break-inside:avoid}",
      ".dqk-n{flex:none;min-width:30px;height:30px;border-radius:50%;background:var(--a);color:#fff;font:800 13px/30px system-ui,sans-serif;text-align:center;padding:0 4px;box-sizing:border-box}",
      ".dqk-qb{flex:1;min-width:0}.dqk-qt{font-weight:700;overflow-wrap:anywhere}.dqk-qt p,.dqk-o li span p{margin:0 0 .4em}",
      ".dqk-qb img{max-width:100%;height:auto;border-radius:6px}.dqk-im{display:block;margin:8px auto 2px}.dqk-oi{display:block;max-width:60%;margin:5px 0}",
      ".dqk-o{list-style:none;margin:7px 0 0;padding:0}.dqk-o li{display:flex;gap:8px;padding:3px 7px;margin:0 -7px;border-radius:7px;overflow-wrap:anywhere}",
      ".dqk-o li b{flex:none;color:var(--a);font-family:system-ui,sans-serif;font-size:.86em;padding-top:.12em;min-width:1.4em}",
      ".dqk-o li.ok{background:#dcfce7;box-shadow:inset 3px 0 0 #16a34a}.dqk-o li.ok b{color:#15803d}",
      ".dqk-open{margin-top:8px;padding:8px 11px;border:1.5px dashed #b9ad8c;border-radius:8px;color:#8a7f66;font:600 .86em system-ui,sans-serif}",
      ".dqk-ans{margin-top:6px;padding:6px 11px;border-radius:8px;background:#dcfce7;color:#166534;font:600 .9em system-ui,sans-serif}",
      ".dqk-toc{list-style:none;margin:0;padding:0}",
      ".dqk-toc li{display:flex;align-items:baseline;gap:8px;padding:8px 2px;cursor:pointer;border-radius:8px}",
      ".dqk-toc li:hover{background:#f5eedb}.dqk-toc li.l0{font-weight:700;margin-top:8px}.dqk-toc li.l1{padding-left:18px;font-size:.92em;color:#4a4332}",
      ".dqk-toc li i{flex:1;border-bottom:2px dotted #cbbf9f;transform:translateY(-4px);min-width:14px}.dqk-toc li b{font-family:system-ui,sans-serif;font-size:.9em;color:var(--a)}",
      ".dqk-toc li em{font-style:normal;font:600 .75em system-ui,sans-serif;color:#8a7f66;margin-left:6px}",
      ".dqk-h2{margin:6px 0 10px;font:800 1.5em Georgia,serif;color:var(--a);text-align:left}",
      ".dqk-div{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:100%;gap:10px}",
      ".dqk-div .big{font:800 2.6em/1.1 Georgia,serif;color:var(--a)}.dqk-div .orn{color:var(--g);font-size:1.6em;letter-spacing:8px}",
      ".dqk-div .cat{display:inline-block;padding:6px 18px;border-radius:999px;background:var(--a);color:#fff;font:800 .95em system-ui,sans-serif;letter-spacing:1px}",
      ".dqk-div ul{list-style:none;margin:10px 0 0;padding:0;font:600 .92em system-ui,sans-serif;color:#4a4332}.dqk-div li{padding:3px 0}.dqk-div li b{color:var(--a)}",
      ".dqk-key{display:grid;gap:6px;margin-bottom:6px}",
      ".dqk-key div{border:1px solid #e0d6bb;border-radius:7px;padding:5px 2px;text-align:center;font:700 .9em system-ui,sans-serif;background:#fbf6e6}",
      ".dqk-key div span{color:#8a7f66;font-weight:600;margin-right:4px}.dqk-key div b{color:#15803d}",
      ".dqk-kh{font:800 .8em system-ui,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:var(--a);margin:12px 0 6px}",
      /* qabıq */
      ".dqk-pg.cv{background:linear-gradient(135deg,var(--a),var(--b));color:#fff;border-radius:6px 14px 14px 6px;box-shadow:inset 12px 0 16px -8px #0007}",
      ".dqk-pg.cv:before{content:'';position:absolute;left:14px;top:0;bottom:0;width:2px;background:#0005;z-index:1}",
      ".dqk-pg.cv:after{content:'';position:absolute;inset:14px 14px 14px 26px;border:2px solid var(--g);border-radius:6px;opacity:.7;pointer-events:none}",
      ".dqk-cvi{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:34px 34px 30px 46px;gap:12px;overflow:auto}",
      ".dqk-cvi .top{font:800 11px system-ui,sans-serif;letter-spacing:3px;color:var(--g)}",
      ".dqk-cvi .orn{color:var(--g);font-size:30px;line-height:1}",
      ".dqk-cvi h1{margin:6px 0 0;font:800 clamp(24px,4.4vw,34px)/1.2 Georgia,'Times New Roman',serif;color:#fff;text-align:center;overflow-wrap:anywhere;text-shadow:0 2px 10px #0005}",
      ".dqk-cvi .sub{font:italic 15px Georgia,serif;color:#ffffffcc}",
      ".dqk-cvi .badge{padding:7px 18px;border:1.5px solid var(--g);color:var(--g);border-radius:999px;font:800 12px system-ui,sans-serif;letter-spacing:1.4px;text-transform:uppercase}",
      ".dqk-cvi .st{font:600 12.5px system-ui,sans-serif;color:#ffffffb8;letter-spacing:.4px}",
      ".dqk-cvi .go{margin-top:8px;border:0;border-radius:999px;padding:12px 24px;font:800 14px system-ui,sans-serif;cursor:pointer;background:linear-gradient(135deg,#ffd36b,var(--g));color:#1b2a55;box-shadow:0 10px 24px -8px #0008}",
      ".dqk-cvi .foot{font:600 10.5px system-ui,sans-serif;color:#ffffff88;letter-spacing:1.5px;margin-top:6px}",
      ".dqk-rbot{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px max(10px,env(safe-area-inset-bottom));background:#0b1220cc;border-top:1px solid #ffffff14}",
      ".dqk-rbot .nv{width:46px;height:42px;font-size:20px;padding:0}",
      ".dqk-pgi{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font:700 13px system-ui,sans-serif;color:#cfd9ef}",
      ".dqk-pgi input{width:56px;text-align:center;padding:8px 4px;border-radius:9px;border:1px solid #ffffff2e;background:#ffffff14;color:#fff;font:700 14px inherit;font-family:inherit}",
      ".dqk-prog{height:3px;background:#ffffff14;flex:none}.dqk-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#d9a441,#ffd36b);transition:width .4s ease}",
      ".dqk-load{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#cfd9ef;font:600 14px system-ui,sans-serif;z-index:5}",
      ".dqk-load i{width:38px;height:38px;border-radius:50%;border:3px solid #ffffff2e;border-top-color:#d9a441;animation:dqkSp .8s linear infinite}@keyframes dqkSp{to{transform:rotate(360deg)}}",
      "#dqk-print{display:none}",
      "@media print{body>*:not(#dqk-print){display:none!important}#dqk-print{display:block!important}#dqk-print .dqk-pg{display:flex!important;width:auto!important;height:auto!important;min-height:260mm;margin:0!important;border-radius:0!important;box-shadow:none!important;page-break-after:always;break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:visible}#dqk-print .dqk-bd{overflow:visible}@page{size:A4;margin:10mm}}",
      "@media(prefers-reduced-motion:reduce){.dqk-pg.fwd,.dqk-pg.bwd,.dqk-card{animation:none!important}}"
    ].join("\n");
    D.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ ADMİN */
  var A = { docs: [], ed: null, busy: false };

  function ensureRoot() {
    css();
    var r = $("dqk-root");
    if (!r) {
      r = D.createElement("div"); r.id = "dqk-root";
      r.innerHTML = '<div class="dqk-top"><h3>📚 Sınaq Toplusu</h3><button class="dqk-x" data-a="close" aria-label="Bağla">✕</button></div><div class="dqk-body"><div class="dqk-wrap" id="dqk-main"></div></div>';
      D.body.appendChild(r);
      r.addEventListener("click", onAdminClick);
      r.addEventListener("input", onAdminInput);
    }
    return r;
  }
  function open() {
    if (!isAdmin()) { alert("Bu modul yalnız admin üçündür."); return; }
    ensureRoot().classList.add("on");
    D.body.style.overflow = "hidden";
    A.ed = null; refreshList();
  }
  function closeAdmin() { var r = $("dqk-root"); r && r.classList.remove("on"); D.body.style.overflow = ""; }

  async function refreshList() {
    var m = $("dqk-main"); if (!m) return;
    m.innerHTML = '<div class="dqk-empty">Yüklənir…</div>';
    A.docs = await listAll();
    drawList();
  }
  function docStats(d) {
    var items = (d.items || []).length;
    return items + " sınaq · " + subjName(d.subject);
  }
  function drawList() {
    var m = $("dqk-main"); if (!m) return;
    var h = '<div class="dqk-row" style="align-items:center;justify-content:space-between"><div class="dqk-meta" style="font-size:14px">Kitab kimi oxunan sınaq kolleksiyaları. Fənn seçin, bazadan sınaq + kateqoriya əlavə edin.</div><button class="dqk-btn gold" data-a="new">➕ Yeni toplu</button></div>';
    if (!A.docs.length) h += '<div class="dqk-empty">📖 Hələ heç bir toplu yoxdur.<br>«Yeni toplu» düyməsi ilə ilk kitabı yaradın.</div>';
    else {
      h += '<div class="dqk-lib">' + A.docs.map(function (d, i) {
        var t = theme(d.theme);
        return '<div class="dqk-card" style="animation-delay:' + (i * 50) + 'ms"><div class="dqk-mini" style="--a:' + t.a + ';--b:' + t.b + ';--g:' + t.g + '"><b>' + esc(d.title || "Adsız") + '</b><i>' + esc(subjName(d.subject)) + '</i></div><div class="dqk-meta"><b style="color:#0f172a">' + esc(d.title || "Adsız") + '</b><br>' + esc(docStats(d)) + '</div><div class="dqk-row"><button class="dqk-btn s" data-a="read" data-i="' + i + '">📖 Oxu</button><button class="dqk-btn o s" data-a="edit" data-i="' + i + '">✏️ Redaktə</button><button class="dqk-btn r s" data-a="del" data-i="' + i + '">🗑️</button></div></div>';
      }).join("") + '</div>';
    }
    m.innerHTML = h;
  }

  function newDoc() { return { title: "", subtitle: "Sınaq toplusu", subject: "all", theme: 0, items: [], created: new Date().toISOString() }; }
  function openEditor(d) {
    A.ed = { doc: JSON.parse(JSON.stringify(d)), loading: true };
    drawEditor();
    loadIdx().then(function () { if (A.ed) { A.ed.loading = false; drawEditor(true); } }, function (e) {
      if (A.ed) { A.ed.loading = false; A.ed.err = (e && e.message) || "baza oxunmadı"; drawEditor(true); }
    });
  }
  function readInputs() {
    if (!A.ed) return;
    var t = $("dqk-t"), s = $("dqk-st");
    if (t) A.ed.doc.title = t.value;
    if (s) A.ed.doc.subtitle = s.value;
  }
  function bankSorted() {
    if (!IDX) return [];
    return Object.keys(IDX).map(function (k) { return IDX[k]; }).sort(function (a, b) { return (parseInt(a.e) || 0) - (parseInt(b.e) || 0) || a.c.localeCompare(b.c); });
  }
  function hasItem(d, e, c) { return d.items.some(function (x) { return String(x.exam) === String(e) && x.cat === c; }); }

  function drawEditor(keepScroll) {
    var m = $("dqk-main"); if (!m || !A.ed) return;
    var d = A.ed.doc, body = m.parentNode, sc = body.scrollTop;
    var h = '<div class="dqk-row" style="justify-content:space-between;align-items:center"><button class="dqk-btn o s" data-a="back">← Siyahı</button><b>' + (d._id ? "Toplunu redaktə et" : "Yeni toplu") + '</b></div><div class="dqk-ed">';
    h += '<label>Kitabın adı</label><input class="dqk-in" id="dqk-t" maxlength="90" placeholder="Məsələn: Məntiq — Sınaq toplusu 2026" value="' + esc(d.title) + '">';
    h += '<label>Alt başlıq (ixtiyari)</label><input class="dqk-in" id="dqk-st" maxlength="90" value="' + esc(d.subtitle) + '">';
    h += '<label>Fənn</label><div class="dqk-chips">' + SUBJ_CHIPS.map(function (c) { return '<button class="dqk-chip' + (d.subject === c[0] ? " on" : "") + '" data-a="subj" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join("") + '</div>';
    h += '<label>Üz qabığının rəngi</label><div class="dqk-chips">' + THEMES.map(function (t, i) { return '<div class="dqk-sw' + (d.theme === i ? " on" : "") + '" data-a="theme" data-v="' + i + '" title="' + t.n + '" style="background:linear-gradient(135deg,' + t.a + ',' + t.b + ')"></div>'; }).join("") + '</div>';
    h += '<div class="dqk-h">Kitabın sınaqları (' + d.items.length + ')</div>';
    if (!d.items.length) h += '<div class="dqk-meta" style="padding:6px 2px 10px">Hələ sınaq əlavə olunmayıb. Aşağıdan seçin.</div>';
    d.items.forEach(function (x, i) {
      var n = IDX ? cnt(x.exam, x.cat, d.subject) : null;
      h += '<div class="dqk-it"><span>' + (i + 1) + '</span><div><b>Sınaq ' + esc(x.exam) + ' · ' + esc(x.cat) + '</b><small>' + (n == null ? "…" : n + " sual" + (d.subject === "all" ? "" : " (" + esc(subjName(d.subject)) + ")")) + '</small></div><button data-a="up" data-i="' + i + '" ' + (i === 0 ? "disabled" : "") + '>↑</button><button data-a="dn" data-i="' + i + '" ' + (i === d.items.length - 1 ? "disabled" : "") + '>↓</button><button data-a="rm" data-i="' + i + '" style="color:#dc2626">✕</button></div>';
    });
    h += '<div class="dqk-h">Bazadakı sınaqlardan əlavə et</div>';
    if (A.ed.loading) h += '<div class="dqk-meta">Baza oxunur…</div>';
    else if (A.ed.err) h += '<div class="dqk-meta" style="color:#b91c1c">Xəta: ' + esc(A.ed.err) + '</div>';
    else {
      var bank = bankSorted();
      if (!bank.length) h += '<div class="dqk-meta">Bazada sual tapılmadı.</div>';
      else {
        h += '<div class="dqk-chips">' + bank.map(function (b) {
          var n = cnt(b.e, b.c, d.subject), on = hasItem(d, b.e, b.c);
          return '<button class="dqk-chip' + (on ? " on" : "") + (n ? "" : " z") + '" data-a="bank" data-e="' + esc(b.e) + '" data-c="' + esc(b.c) + '">' + (on ? "✓ " : "") + 'Sınaq ' + esc(b.e) + ' · ' + esc(b.c) + '<small>' + n + '</small></button>';
        }).join("") + '</div>';
        h += '<div class="dqk-row" style="margin-top:10px"><button class="dqk-btn o s" data-a="addall">➕ Hamısını əlavə et</button><button class="dqk-btn o s" data-a="clear">Təmizlə</button></div>';
      }
    }
    h += '<div class="dqk-h">Əl ilə əlavə et</div><div class="dqk-row"><input class="dqk-in" id="dqk-me" type="number" min="1" placeholder="Sınaq №" style="width:110px"><select class="dqk-in" id="dqk-mc" style="width:auto"><option>BA</option><option>BB</option><option>AC</option></select><button class="dqk-btn s" data-a="manual">➕ Əlavə et</button></div>';
    h += '</div><div class="dqk-row" style="margin-top:14px"><button class="dqk-btn g" data-a="save">💾 Yadda saxla</button><button class="dqk-btn gold" data-a="preview">📖 Oxu</button></div>';
    m.innerHTML = h;
    if (keepScroll) body.scrollTop = sc; else body.scrollTop = 0;
  }

  function onAdminInput() { /* sahələr yalnız lazım olanda oxunur */ }
  async function onAdminClick(e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a"), i = parseInt(b.getAttribute("data-i"));
    if (a === "close") return closeAdmin();
    if (a === "new") return openEditor(newDoc());
    if (a === "edit") return openEditor(A.docs[i]);
    if (a === "read") return read(A.docs[i]);
    if (a === "del") {
      var d = A.docs[i];
      if (!d || !confirm("«" + (d.title || "Adsız") + "» silinsin?")) return;
      await delDoc(d._id); toast("Silindi"); return refreshList();
    }
    if (a === "back") { A.ed = null; return refreshList(); }
    if (!A.ed) return;
    var doc = A.ed.doc;
    readInputs();
    if (a === "subj") { doc.subject = b.getAttribute("data-v"); return drawEditor(true); }
    if (a === "theme") { doc.theme = parseInt(b.getAttribute("data-v")); return drawEditor(true); }
    if (a === "up" && i > 0) { var t = doc.items[i]; doc.items[i] = doc.items[i - 1]; doc.items[i - 1] = t; return drawEditor(true); }
    if (a === "dn" && i < doc.items.length - 1) { var t2 = doc.items[i]; doc.items[i] = doc.items[i + 1]; doc.items[i + 1] = t2; return drawEditor(true); }
    if (a === "rm") { doc.items.splice(i, 1); return drawEditor(true); }
    if (a === "bank") {
      var ee = b.getAttribute("data-e"), cc = b.getAttribute("data-c");
      if (hasItem(doc, ee, cc)) doc.items = doc.items.filter(function (x) { return !(String(x.exam) === ee && x.cat === cc); });
      else doc.items.push({ exam: ee, cat: cc });
      return drawEditor(true);
    }
    if (a === "addall") {
      bankSorted().forEach(function (bk) { if (cnt(bk.e, bk.c, doc.subject) && !hasItem(doc, bk.e, bk.c)) doc.items.push({ exam: bk.e, cat: bk.c }); });
      return drawEditor(true);
    }
    if (a === "clear") { doc.items = []; return drawEditor(true); }
    if (a === "manual") {
      var ex = String(parseInt($("dqk-me").value) || ""), ct = $("dqk-mc").value;
      if (!ex) { toast("Sınaq nömrəsini yazın", true); return; }
      if (hasItem(doc, ex, ct)) { toast("Bu artıq əlavə olunub", true); return; }
      if (IDX && !cnt(ex, ct, "all") && !confirm("Bazada Sınaq " + ex + " · " + ct + " üçün sual tapılmadı. Yenə də əlavə edilsin?")) return;
      doc.items.push({ exam: ex, cat: ct }); return drawEditor(true);
    }
    if (a === "save") return doSave();
    if (a === "preview") {
      if (!doc.items.length) { toast("Əvvəl ən azı bir sınaq əlavə edin", true); return; }
      return read(doc);
    }
  }
  async function doSave() {
    var d = A.ed.doc;
    if (!String(d.title || "").trim()) { toast("Kitabın adını yazın", true); return; }
    if (!d.items.length) { toast("Ən azı bir sınaq əlavə edin", true); return; }
    if (A.busy) return; A.busy = true;
    try {
      d.title = d.title.trim(); d.updated = new Date().toISOString();
      await saveDoc(d);
      toast("✅ Kitab yadda saxlanıldı");
      A.docs = await listAll();
      var fresh = !d._id && A.docs[0] && A.docs[0].title === d.title ? A.docs[0] : A.docs.filter(function (x) { return x._id === d._id; })[0];
      if (fresh) A.ed.doc = JSON.parse(JSON.stringify(fresh));
      drawEditor(true);
    } catch (e) { toast("Yadda saxlanmadı: " + (e && e.message || e), true); }
    A.busy = false;
  }

  /* ------------------------------------------------------------------ OXUYUCU */
  var R = null;

  function pageSize() {
    var w = window.innerWidth, h = window.innerHeight, spread = w >= 900;
    var stageH = Math.max(320, h - 56 - 62 - 20 - 3);
    var pw = spread ? Math.min(560, Math.floor((Math.min(w, 1240) - 40) / 2)) : Math.min(w - 16, 560);
    var ph = Math.min(stageH, spread ? 820 : 900);
    return { w: pw, h: ph, spread: spread };
  }

  function paginate(doc, data, fs, sz) {
    var W = sz.w, H = sz.h;
    var cpl = Math.max(14, Math.floor((W - 90) / (fs * 0.52)));
    var budget = Math.max(7, Math.floor((H - 105) / (fs * 1.6)));
    function ln(html) { return Math.max(1, Math.ceil(plain(html).length / cpl)); }
    function wt(r, cat) {
      var w = ln(r.question) + 1.5 + (r.image_url ? 9 : 0);
      if (isOpen(cat, r.q_number)) return w + 2.5;
      (Array.isArray(r.options) ? r.options : []).forEach(function (o) {
        var t = o && typeof o === "object" ? o.text : o;
        w += ln(t) + 0.2 + (o && typeof o === "object" && o.image ? 7 : 0);
      });
      return w;
    }
    var content = [], secs = [], total = 0;
    var cols = W < 520 ? 4 : 5, keyRows = Math.max(4, Math.floor((H - 190) / (fs * 2.4)));

    data.forEach(function (d, i) {
      var it = d.it, label = "Sınaq " + it.exam + " · " + it.cat;
      var subs = subjList(doc.subject).map(function (k) { return { k: k, rows: d.rows.filter(inRange(k)) }; }).filter(function (x) { return x.rows.length; });
      var n = subs.reduce(function (s, x) { return s + x.rows.length; }, 0);
      total += n;
      content.push({ t: "div", sec: i, label: label, subs: subs.map(function (x) { return { name: SUBJ[x.k].name, n: x.rows.length }; }), n: n });
      secs.push({ l: 0, text: label, local: content.length - 1, meta: n + " sual" });
      subs.forEach(function (sb) {
        var start = content.length, cur = [], used = 0, first = true;
        var flush = function () {
          if (!cur.length) return;
          content.push({ t: "q", sec: i, sub: sb.k, cat: it.cat, label: label, qs: cur, banner: first });
          first = false; cur = []; used = 0;
        };
        sb.rows.forEach(function (r) {
          var w = wt(r, it.cat);
          if (cur.length && used + w > budget) flush();
          cur.push(r); used += w;
        });
        flush();
        secs.push({ l: 1, text: SUBJ[sb.k].name, local: start, meta: sb.rows.length + " sual" });
      });
      if (n) {
        var krows = [];
        subs.forEach(function (sb) {
          krows.push({ h: SUBJ[sb.k].name });
          for (var j = 0; j < sb.rows.length; j += cols) {
            krows.push({ cells: sb.rows.slice(j, j + cols).map(function (r) {
              var open = isOpen(it.cat, r.q_number), a = open ? String(r.correct == null ? "" : r.correct).slice(0, 9) : (L[parseInt(r.correct)] || "–");
              return { n: r.q_number, a: a };
            }) });
          }
        });
        var kstart = content.length;
        for (var p = 0; p < krows.length; p += keyRows) content.push({ t: "key", sec: i, label: label, rows: krows.slice(p, p + keyRows), cols: cols, cont: p > 0 });
        secs.push({ l: 1, text: "Cavab açarı", local: kstart, meta: "" });
      }
    });

    var eps = Math.max(8, Math.floor((H - 200) / (fs * 2.05)));
    var tocN = Math.max(1, Math.ceil(secs.length / eps));
    var pages = [{ t: "cover" }];
    for (var k = 0; k < tocN; k++) pages.push({ t: "toc", ents: secs.slice(k * eps, (k + 1) * eps), cont: k > 0 });
    var base = pages.length;
    content.forEach(function (p) { pages.push(p); });
    secs.forEach(function (s) { s.page = base + s.local; });
    pages.push({ t: "back" });
    pages.forEach(function (p, i) { p.idx = i; });
    return { pages: pages, total: total, secs: secs };
  }

  function qHTML(r, cat, ans) {
    var h = '<div class="dqk-q"><div class="dqk-n">' + esc(r.q_number) + '</div><div class="dqk-qb"><div class="dqk-qt">' + rich(r.question) + '</div>';
    if (r.image_url) h += '<img class="dqk-im" src="' + esc(r.image_url) + '" alt="">';
    if (isOpen(cat, r.q_number)) {
      h += '<div class="dqk-open">Açıq sual — cavabı yazın: ____________</div>';
      if (ans) h += '<div class="dqk-ans">Cavab: <b>' + esc(r.correct) + '</b></div>';
    } else {
      h += '<ol class="dqk-o">';
      (Array.isArray(r.options) ? r.options : []).forEach(function (o, i) {
        var obj = o && typeof o === "object", t = obj ? o.text || "" : o, im = obj ? o.image : null;
        h += '<li' + (ans && parseInt(r.correct) === i ? ' class="ok"' : "") + '><b>' + L[i] + ')</b><span>' + rich(t) + (im ? '<img class="dqk-oi" src="' + esc(im) + '" alt="">' : "") + '</span></li>';
      });
      h += '</ol>';
    }
    return h + '</div></div>';
  }

  function pageInner(p) {
    var doc = R.doc, st = R.stats, h;
    if (p.t === "cover" || p.t === "back") {
      if (p.t === "cover") {
        return '<div class="dqk-cvi"><div class="top">DQ PLATFORM</div><div class="orn">❖</div><h1>' + esc(doc.title) + '</h1>' + (doc.subtitle ? '<div class="sub">' + esc(doc.subtitle) + '</div>' : "") + '<div class="badge">' + esc(subjName(doc.subject)) + '</div><div class="st">' + doc.items.length + ' sınaq · ' + st.total + ' sual</div><button class="go" data-r="start">Oxumağa başla →</button><div class="foot">© DQ PLATFORM</div></div>';
      }
      return '<div class="dqk-cvi"><div class="orn">❖</div><h1 style="font-size:24px">Uğurlar!</h1><div class="sub">Hazırlığınız uğurlu olsun</div><div class="st">' + esc(doc.title) + '</div><button class="go" data-r="toc">Mündəricata qayıt</button><div class="foot">© DQ PLATFORM</div></div>';
    }
    var head = '<div class="dqk-rh"><span>' + esc(doc.title) + '</span><span>' + esc(p.label || (p.t === "toc" ? "Mündəricat" : "")) + '</span></div>';
    var foot = '<div class="dqk-pn">' + p.idx + '</div>';
    if (p.t === "toc") {
      h = '<h2 class="dqk-h2">Mündəricat' + (p.cont ? ' <small style="font-size:.5em;color:#8a7f66">(davamı)</small>' : "") + '</h2><ul class="dqk-toc">' + p.ents.map(function (s) {
        return '<li class="l' + s.l + '" data-go="' + s.page + '"><span>' + esc(s.text) + (s.meta ? '<em>' + esc(s.meta) + '</em>' : "") + '</span><i></i><b>' + s.page + '</b></li>';
      }).join("") + '</ul>';
    } else if (p.t === "div") {
      var m = p.label.split(" · ");
      h = '<div class="dqk-div"><div class="orn">❖ ❖ ❖</div><div class="big">' + esc(m[0]) + '</div><div class="cat">' + esc(m[1] || "") + ' KATEQORİYASI</div><ul>' + p.subs.map(function (s) { return '<li>' + esc(s.name) + ' — <b>' + s.n + ' sual</b></li>'; }).join("") + '</ul><div class="dqk-meta" style="margin-top:6px">Cəmi ' + p.n + ' sual</div></div>';
    } else if (p.t === "q") {
      var a = p.qs[0].q_number, b = p.qs[p.qs.length - 1].q_number;
      h = (p.banner ? '<div class="dqk-ban"><span>' + esc(SUBJ[p.sub].name) + '</span><small>SUAL ' + a + '–' + b + '</small></div>' : "") + p.qs.map(function (r) { return qHTML(r, p.cat, R.ans); }).join("");
    } else {
      h = '<h2 class="dqk-h2">Cavab açarı' + (p.cont ? ' <small style="font-size:.5em;color:#8a7f66">(davamı)</small>' : "") + '</h2>' + p.rows.map(function (r) {
        if (r.h) return '<div class="dqk-kh">' + esc(r.h) + '</div>';
        return '<div class="dqk-key" style="grid-template-columns:repeat(' + p.cols + ',1fr)">' + r.cells.map(function (c) { return '<div><span>' + esc(c.n) + '</span><b>' + esc(c.a) + '</b></div>'; }).join("") + '</div>';
      }).join("");
    }
    return head + '<div class="dqk-bd">' + h + '</div>' + foot;
  }

  function viewOf(cur, spread, N) {
    if (!spread) return [cur];
    if (cur === 0) return [0];
    if (cur === 1) return [null, 1];
    var l = cur % 2 === 0 ? cur : cur - 1;
    return [l, l + 1 < N ? l + 1 : null];
  }

  function anchorOf(p) { return p ? p.t + "|" + p.sec + "|" + (p.sub || "") + "|" + (p.qs ? p.qs[0].q_number : (p.rows ? (p.cont ? 1 : 0) : "")) : ""; }
  function findAnchor(pages, p) {
    if (!p) return 0;
    var k = anchorOf(p), same = null, i;
    for (i = 0; i < pages.length; i++) if (anchorOf(pages[i]) === k) return i;
    if (p.t === "q") {
      var n0 = p.qs[0].q_number;
      for (i = 0; i < pages.length; i++) { var q = pages[i]; if (q.t === "q" && q.sec === p.sec && q.sub === p.sub && q.qs[0].q_number <= n0 && q.qs[q.qs.length - 1].q_number >= n0) return i; }
    }
    for (i = 0; i < pages.length; i++) { var x = pages[i]; if (x.t === p.t && x.sec === p.sec && (x.sub || "") === (p.sub || "")) { same = i; break; } }
    return same == null ? Math.min(p.idx || 0, pages.length - 1) : same;
  }

  function ensureReader() {
    css();
    var r = $("dqk-rd");
    if (r) return r;
    r = D.createElement("div"); r.id = "dqk-rd";
    r.innerHTML = '<div class="dqk-rtop"><button class="dqk-ib" data-r="close" aria-label="Bağla">✕</button><h4 id="dqk-rt"></h4><button class="dqk-ib" data-r="toc" title="Mündəricat">☰</button><button class="dqk-ib" data-r="fsm" title="Kiçilt">A−</button><button class="dqk-ib" data-r="fsp" title="Böyüt">A+</button><button class="dqk-ib" data-r="ans" id="dqk-ansb" title="Cavabları göstər">✓</button><button class="dqk-ib" data-r="print" title="Çap / PDF">🖨</button></div><div class="dqk-prog"><i id="dqk-pr"></i></div><div class="dqk-stage" id="dqk-stage"></div><div class="dqk-rbot"><button class="dqk-ib nv" data-r="prev" aria-label="Əvvəlki">‹</button><div class="dqk-pgi"><input id="dqk-pi" type="number" min="0" inputmode="numeric"><span id="dqk-pt">/ 0</span></div><button class="dqk-ib nv" data-r="next" aria-label="Növbəti">›</button></div>';
    D.body.appendChild(r);
    r.addEventListener("click", onReaderClick);
    var pi = r.querySelector("#dqk-pi");
    pi.addEventListener("change", function () { var v = parseInt(pi.value); if (!isNaN(v)) goto(v, true); else sync(); });
    pi.addEventListener("keydown", function (e) { if (e.key === "Enter") pi.blur(); });
    var st = r.querySelector("#dqk-stage"), sx = 0, sy = 0, tt = 0;
    st.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; tt = Date.now(); }, { passive: true });
    st.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 60 && Date.now() - tt < 700) turn(dx < 0 ? 1 : -1);
    }, { passive: true });
    D.addEventListener("keydown", function (e) {
      if (!R || !r.classList.contains("on")) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1); else if (e.key === "Escape") closeReader();
    });
    var rt; window.addEventListener("resize", function () { if (!R || !r.classList.contains("on")) return; clearTimeout(rt); rt = setTimeout(function () { rebuild(true); }, 220); });
    return r;
  }

  async function read(doc) {
    if (!doc || !doc.items || !doc.items.length) { toast("Kitabda sınaq yoxdur", true); return; }
    var r = ensureReader();
    QC = {};
    R = { doc: doc, data: null, pages: [], cur: 0, fs: parseInt(lget("dqk_fs")) || 15, ans: lget("dqk_ans") === "1", stats: { total: 0 }, dir: "fwd" };
    var t = theme(doc.theme);
    r.style.setProperty("--a", t.a); r.style.setProperty("--b", t.b); r.style.setProperty("--g", t.g);
    r.querySelector("#dqk-rt").textContent = doc.title || "Kitab";
    r.classList.add("on"); D.body.style.overflow = "hidden";
    r.querySelector("#dqk-stage").innerHTML = '<div class="dqk-load"><i></i>Kitab hazırlanır…</div>';
    try {
      R.data = await Promise.all(doc.items.map(function (it) { return getQs(it.exam, it.cat).then(function (rows) { return { it: it, rows: rows }; }); }));
    } catch (e) {
      r.querySelector("#dqk-stage").innerHTML = '<div class="dqk-load">⚠️ Suallar yüklənmədi<br><small>' + esc(e && e.message || "şəbəkə xətası") + '</small><button class="dqk-ib" data-r="close">Bağla</button></div>';
      return;
    }
    rebuild(false);
  }

  function rebuild(keep) {
    if (!R || !R.data) return;
    var prev = keep ? R.pages[R.cur] : null, sz = pageSize();
    var res = paginate(R.doc, R.data, R.fs, sz);
    R.pages = res.pages; R.stats = res; R.sz = sz;
    R.cur = prev ? findAnchor(R.pages, prev) : 0;
    $("dqk-ansb").classList.toggle("on", R.ans);
    draw(false);
  }

  function draw(animate) {
    if (!R) return;
    var st = $("dqk-stage"), sz = R.sz, N = R.pages.length;
    var view = viewOf(R.cur, sz.spread, N);
    var h = '<div class="dqk-spread" style="height:' + sz.h + 'px">';
    view.forEach(function (idx, k) {
      var side = view.length === 1 ? "S" : (k === 0 ? "L" : "R");
      if (idx == null) { h += '<div class="dqk-pg ' + side + ' blank" style="width:' + sz.w + 'px;height:' + sz.h + 'px"></div>'; return; }
      var p = R.pages[idx], cls = "dqk-pg " + side + ((p.t === "cover" || p.t === "back") ? " cv" : "") + (animate ? " " + R.dir : "");
      h += '<div class="' + cls + '" data-idx="' + idx + '" style="width:' + sz.w + 'px;height:' + sz.h + 'px;font-size:' + R.fs + 'px">' + pageInner(p) + '</div>';
    });
    st.innerHTML = h + '</div>';
    R.view = view;
    sync();
  }

  function sync() {
    if (!R) return;
    var N = R.pages.length, shown = R.view.filter(function (x) { return x != null; });
    var a = shown[0], b = shown[shown.length - 1];
    var pi = $("dqk-pi"); if (pi && D.activeElement !== pi) pi.value = shown.length > 1 ? a : a;
    $("dqk-pt").textContent = "/ " + (N - 1) + (shown.length > 1 ? "  (" + a + "–" + b + ")" : "");
    $("dqk-pr").style.width = (b / (N - 1) * 100) + "%";
    var prev = D.querySelector('#dqk-rd [data-r="prev"]'), next = D.querySelector('#dqk-rd [data-r="next"]');
    prev.disabled = a === 0; next.disabled = b === N - 1; prev.style.opacity = prev.disabled ? .35 : 1; next.style.opacity = next.disabled ? .35 : 1;
  }

  function goto(idx, jump) {
    if (!R) return;
    var N = R.pages.length; idx = Math.max(0, Math.min(N - 1, idx));
    R.dir = idx >= R.cur ? "fwd" : "bwd"; R.cur = idx; draw(true);
  }
  function turn(d) {
    if (!R) return;
    var shown = R.view.filter(function (x) { return x != null; }), N = R.pages.length, t;
    if (d > 0) { t = shown[shown.length - 1] + 1; if (t >= N) return; }
    else { t = shown[0] - 1; if (t < 0) return; }
    goto(t);
  }

  function onReaderClick(e) {
    var go = e.target.closest("[data-go]");
    if (go) { goto(parseInt(go.getAttribute("data-go"))); return; }
    var b = e.target.closest("[data-r]"); if (!b) return;
    var a = b.getAttribute("data-r");
    if (a === "close") return closeReader();
    if (a === "start") return goto(1);
    if (a === "toc") return goto(1);
    if (a === "prev") return turn(-1);
    if (a === "next") return turn(1);
    if (a === "fsp" || a === "fsm") {
      R.fs = Math.max(12, Math.min(22, R.fs + (a === "fsp" ? 1 : -1))); lset("dqk_fs", R.fs);
      toast("Şrift: " + R.fs + " px"); return rebuild(true);
    }
    if (a === "ans") { R.ans = !R.ans; lset("dqk_ans", R.ans ? "1" : "0"); $("dqk-ansb").classList.toggle("on", R.ans); toast(R.ans ? "Cavablar göstərilir" : "Cavablar gizlədildi"); return draw(false); }
    if (a === "print") return doPrint();
  }

  function doPrint() {
    if (!R) return;
    var old = $("dqk-print"); if (old) old.remove();
    var box = D.createElement("div"); box.id = "dqk-print";
    var t = theme(R.doc.theme);
    box.style.cssText = "--a:" + t.a + ";--b:" + t.b + ";--g:" + t.g;
    box.innerHTML = R.pages.map(function (p) {
      var cv = p.t === "cover" || p.t === "back";
      return '<div class="dqk-pg S' + (cv ? " cv" : "") + '" style="font-size:' + R.fs + 'px">' + pageInner(p) + '</div>';
    }).join("").replace(/<button class="go"[^>]*>.*?<\/button>/g, "");
    D.body.appendChild(box);
    setTimeout(function () { window.print(); setTimeout(function () { box.remove(); }, 1500); }, 250);
  }

  function closeReader() {
    var r = $("dqk-rd"); r && r.classList.remove("on");
    R = null;
    var adm = $("dqk-root");
    if (!(adm && adm.classList.contains("on"))) D.body.style.overflow = "";
  }

  window.DQK = { open: open, read: read, close: function () { closeReader(); closeAdmin(); }, _paginate: paginate };
})();
