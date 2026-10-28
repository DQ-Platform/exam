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
  var SIZES = { A4: { w: 718, h: 1047, label: "A4" }, A5: { w: 484, h: 718, label: "A5" }, Letter: { w: 740, h: 980, label: "Letter" } };
  var PDF_DEF = { size: "A4", cols: 1, fs: 13, font: "serif", header: "", footer: "", watermark: "", cover: true, toc: true, dividers: true, key: true, back: true, answers: false, pageNums: true };
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
    if (/<\/?[a-z][^>]*>/i.test(s)) return clean(s);
    return esc(s).replace(/\r?\n/g, "<br>");
  }
  function plain(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
  function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function isAdmin() {
    try { return lget("dq_admin_logged") === "true" || window.__dqAuthed === true || !!(window.DQNav && DQNav.isAdmin && DQNav.isAdmin()); } catch (e) { return false; }
  }
  function theme(i) { return THEMES[i] || THEMES[0]; }
  function pdfOf(d) {
    var p = Object.assign({}, PDF_DEF, (d && d.pdf) || {});
    if (!SIZES[p.size]) p.size = "A4";
    p.cols = p.cols === 2 ? 2 : 1;
    p.fs = Math.max(10, Math.min(18, parseInt(p.fs) || 13));
    p.font = p.font === "sans" ? "sans" : "serif";
    return p;
  }
  function sizeOf(p) { return SIZES[p.size] || SIZES.A4; }
  function clean(h) {
    return String(h == null ? "" : h)
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|form)\b[^>]*\/?>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
  }
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
      ".dqk-qb img{max-width:100%;height:auto;border-radius:6px}.dqk-im{max-height:260px;object-fit:contain}.dqk-oi{max-height:130px;object-fit:contain}.dqk-im{display:block;margin:8px auto 2px}.dqk-oi{display:block;max-width:60%;margin:5px 0}",
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
      "#dqk-root,#dqk-root *,#dqk-rd .dqk-pg,#dqk-rd .dqk-pg *,#dqk-rd input{-webkit-user-select:text;user-select:text}",
      "#dqk-root *{box-sizing:border-box}",
      ".dqk-chips+.dqk-chips{margin-top:10px}",
      ".dqk-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:520px){.dqk-2{grid-template-columns:1fr}}",
      ".dqk-pvrow{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:12px}.dqk-pvside{flex:1;min-width:190px}.dqk-pvside b{display:block;margin-bottom:4px}",
      ".dqk-pvw{position:relative;overflow:hidden;border-radius:6px 12px 12px 6px;box-shadow:0 12px 24px -12px #0009,0 2px 6px #0003;flex:none;background:#0a2f7a}.dqk-pvw .dqk-pg{box-shadow:none}.dqk-cardcv{margin:2px auto}",
      ".dqk-acc{width:100%;margin-top:20px;display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border:1.5px solid #c9d6ee;border-radius:12px;background:#f1f6ff;color:#0a2f7a;font:800 14px inherit;font-family:inherit;cursor:pointer;text-align:left}.dqk-acc i{font-style:normal;font-size:12px}",
      ".dqk-pdfbody{padding:2px 4px 6px;border-left:3px solid #d9a441;margin:10px 0 0 4px;padding-left:12px}",
      ".dqk-cks{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.dqk-ck{display:flex!important;align-items:center;gap:10px;margin:0!important;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:13.5px!important;font-weight:600!important;text-transform:none!important;letter-spacing:0!important;color:#0f172a!important;cursor:pointer}.dqk-ck input{width:20px;height:20px;accent-color:#0a2f7a;flex:none}",
      "#dqk-cvp{position:fixed;inset:0;z-index:100010;background:#0b1220d9;display:flex;align-items:center;justify-content:center;padding:14px;cursor:pointer;animation:dqkUp .3s ease both}.dqk-cvp-in{text-align:center}.dqk-cvp-in .dqk-pvw{margin:0 auto}.dqk-cvp-h{margin-top:12px;color:#cfd9ef;font:600 13px system-ui,sans-serif}",
      ".dqk-pn.pdf{display:flex;justify-content:space-between;gap:10px;padding:6px 22px 11px;text-align:left}.dqk-pn.pdf:before,.dqk-pn.pdf:after{content:none}.dqk-pn.pdf span:last-child{font-weight:700}",
      ".dqk-wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font:900 70px/1 system-ui,sans-serif;letter-spacing:4px;color:#0a2f7a12;transform:rotate(-30deg);white-space:nowrap;z-index:0;overflow:hidden}.dqk-pg>.dqk-rh,.dqk-pg>.dqk-bd,.dqk-pg>.dqk-pn{position:relative;z-index:1}",
      ".dqk-pg.sans{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5}",
      ".dqk-bd.c2{column-count:2;column-gap:18px;column-fill:auto;overflow:hidden}.dqk-bd.c2 .dqk-ban{column-span:all}.dqk-bd.c2 .dqk-q{break-inside:avoid}",
      ".dqk-pg.pdf{box-shadow:0 20px 40px -14px #000a;border-radius:3px}.dqk-pg.pdf.cv{border-radius:3px}.dqk-pg.pdf .dqk-bd{overflow:hidden}",
      ".dqk-pdfwrap{position:relative;flex:none}",
      "#dqk-rd.pdfm [data-r=fsm],#dqk-rd.pdfm [data-r=fsp]{display:none}",
      "#dqk-print{display:none}",
      "@media print{html,body{background:#fff!important;padding:0!important;margin:0!important;height:auto!important;overflow:visible!important}body:before{content:none!important;display:none!important}body>*:not(#dqk-print){display:none!important}#dqk-print{display:block!important}#dqk-print .dqk-pg{display:flex!important;margin:0!important;border-radius:0!important;box-shadow:none!important;page-break-after:always;break-after:page;overflow:hidden;transform:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}#dqk-print .dqk-pg:last-child{page-break-after:auto;break-after:auto}}",
      "@media(prefers-reduced-motion:reduce){.dqk-pg.fwd,.dqk-pg.bwd,.dqk-card{animation:none!important}}"
    ].join("\n");
    D.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ ÜZ QABIĞI */
  function coverHTML(doc, st, print) {
    var brand = String(doc.brand || "").trim() || "DQ PLATFORM", by = String(doc.byline || "").trim() || "© DQ PLATFORM";
    var stat = st ? ((st.n != null ? st.n + " sınaq" : "") + (st.q != null ? " · " + st.q + " sual" : "")) : "";
    return '<div class="dqk-cvi"><div class="top">' + esc(brand) + '</div><div class="orn">❖</div><h1>' + esc(doc.title || "Kitabın adı") + '</h1>' +
      (doc.subtitle ? '<div class="sub">' + esc(doc.subtitle) + '</div>' : "") +
      '<div class="badge">' + esc(subjName(doc.subject)) + '</div>' + (stat ? '<div class="st">' + esc(stat) + '</div>' : "") +
      (print ? "" : '<button class="go" data-r="start">Oxumağa başla →</button>') + '<div class="foot">' + esc(by) + '</div></div>';
  }
  function backHTML(doc, print) {
    return '<div class="dqk-cvi"><div class="orn">❖</div><h1 style="font-size:24px">Uğurlar!</h1><div class="sub">Hazırlığınız uğurlu olsun</div><div class="st">' + esc(doc.title) + '</div>' +
      (print ? "" : '<button class="go" data-r="toc">Mündəricata qayıt</button>') + '<div class="foot">' + esc(String(doc.byline || "").trim() || "© DQ PLATFORM") + '</div></div>';
  }
  function themeVars(d) { var t = theme(d.theme); return "--a:" + t.a + ";--b:" + t.b + ";--g:" + t.g; }
  function docTotal(d) {
    if (!IDX) return null;
    return (d.items || []).reduce(function (s, x) { return s + cnt(x.exam, x.cat, d.subject); }, 0);
  }
  /* kiçildilmiş üz qabığı (PDF səhifə nisbəti ilə) */
  function coverBox(d, scale, extra) {
    var sz = sizeOf(pdfOf(d)), W = 360, H = Math.round(W * sz.h / sz.w);
    var html = coverHTML(d, { n: (d.items || []).length, q: docTotal(d) }, true);
    return '<div class="dqk-pvw' + (extra || "") + '" style="' + themeVars(d) + ';width:' + Math.round(W * scale) + 'px;height:' + Math.round(H * scale) + 'px"><div class="dqk-pg cv" style="position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;font-size:15px;transform:scale(' + scale + ');transform-origin:0 0">' + html + '</div></div>';
  }
  function showCoverModal() {
    if (!A.ed) return; readInputs();
    var d = A.ed.doc, sz = sizeOf(pdfOf(d)), W = 360, H = Math.round(W * sz.h / sz.w);
    var k = Math.max(.5, Math.min((window.innerWidth - 40) / W, (window.innerHeight - 110) / H, 1.7));
    var m = D.createElement("div"); m.id = "dqk-cvp";
    m.innerHTML = '<div class="dqk-cvp-in">' + coverBox(d, k) + '<div class="dqk-cvp-h">Üz qabığı ön baxışı · ' + esc(pdfOf(d).size) + ' · bağlamaq üçün toxunun</div></div>';
    m.addEventListener("click", function () { m.remove(); });
    D.body.appendChild(m);
  }
  function updatePreview() {
    var box = $("dqk-pvbox"); if (!box || !A.ed) return;
    box.innerHTML = coverBox(A.ed.doc, .5);
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
      r.addEventListener("change", onAdminInput);
    }
    return r;
  }
  function open() {
    if (!isAdmin()) { alert("Bu modul yalnız admin üçündür."); return; }
    ensureRoot().classList.add("on");
    D.body.style.overflow = "hidden";
    A.ed = null; refreshList();
  }
  function closeAdmin() { var r = $("dqk-root"); r && r.classList.remove("on"); var c = $("dqk-cvp"); c && c.remove(); if (!$("dqk-rd") || !$("dqk-rd").classList.contains("on")) D.body.style.overflow = ""; }

  async function refreshList() {
    var m = $("dqk-main"); if (!m) return;
    m.innerHTML = '<div class="dqk-empty">Yüklənir…</div>';
    A.docs = await listAll();
    drawList();
  }
  function drawList() {
    var m = $("dqk-main"); if (!m) return;
    var h = '<div class="dqk-row" style="align-items:center;justify-content:space-between"><div class="dqk-meta" style="font-size:14px;flex:1;min-width:200px">Kitab kimi oxunan sınaq kolleksiyaları. Fənn seçin, bazadan sınaq + kateqoriya əlavə edin, PDF dizaynını qurun.</div><button class="dqk-btn gold" data-a="new">➕ Yeni toplu</button></div>';
    if (!A.docs.length) h += '<div class="dqk-empty">📖 Hələ heç bir toplu yoxdur.<br>«Yeni toplu» düyməsi ilə ilk kitabı yaradın.</div>';
    else {
      h += '<div class="dqk-lib">' + A.docs.map(function (d, i) {
        return '<div class="dqk-card" style="animation-delay:' + Math.min(i, 8) * 50 + 'ms">' + coverBox(d, .5, " dqk-cardcv") + '<div class="dqk-meta"><b style="color:#0f172a;font-size:14px">' + esc(d.title || "Adsız") + '</b><br>' + (d.items || []).length + ' sınaq · ' + esc(subjName(d.subject)) + ' · ' + esc(pdfOf(d).size) + '</div><div class="dqk-row"><button class="dqk-btn s" data-a="read" data-i="' + i + '">📖 Oxu</button><button class="dqk-btn o s" data-a="pdfv" data-i="' + i + '">📄 PDF</button><button class="dqk-btn o s" data-a="edit" data-i="' + i + '">✏️</button><button class="dqk-btn r s" data-a="del" data-i="' + i + '" aria-label="Sil">🗑️</button></div></div>';
      }).join("") + '</div>';
    }
    m.innerHTML = h;
  }

  function newDoc() { return { title: "", subtitle: "Sınaq toplusu", subject: "all", theme: 0, brand: "", byline: "", items: [], pdf: Object.assign({}, PDF_DEF), created: new Date().toISOString() }; }
  function openEditor(d) {
    var doc = JSON.parse(JSON.stringify(d)); doc.items = doc.items || []; doc.pdf = pdfOf(doc);
    A.ed = { doc: doc, loading: true, pdfOpen: false, catF: "" };
    drawEditor();
    loadIdx().then(function () { if (A.ed) { A.ed.loading = false; drawEditor(true); } }, function (e) {
      if (A.ed) { A.ed.loading = false; A.ed.err = (e && e.message) || "baza oxunmadı"; drawEditor(true); }
    });
  }
  function val(id) { var e = $(id); return e ? e.value : null; }
  function readInputs() {
    if (!A.ed) return;
    var d = A.ed.doc, p = d.pdf, v;
    if ((v = val("dqk-t")) != null) d.title = v;
    if ((v = val("dqk-st")) != null) d.subtitle = v;
    if ((v = val("dqk-br")) != null) d.brand = v;
    if ((v = val("dqk-by")) != null) d.byline = v;
    if ((v = val("dqk-ph")) != null) p.header = v;
    if ((v = val("dqk-pf")) != null) p.footer = v;
    if ((v = val("dqk-pw")) != null) p.watermark = v;
    if ((v = val("dqk-pfs")) != null) p.fs = Math.max(10, Math.min(18, parseInt(v) || 13));
    ["cover", "toc", "dividers", "key", "back", "answers", "pageNums"].forEach(function (k) { var e = $("dqk-c-" + k); if (e) p[k] = !!e.checked; });
  }
  function bankSorted() {
    if (!IDX) return [];
    return Object.keys(IDX).map(function (k) { return IDX[k]; }).sort(function (a, b) { return (parseInt(a.e) || 0) - (parseInt(b.e) || 0) || a.c.localeCompare(b.c); });
  }
  function hasItem(d, e, c) { return d.items.some(function (x) { return String(x.exam) === String(e) && x.cat === c; }); }
  function chipRow(arr, cur, act, key) {
    return '<div class="dqk-chips">' + arr.map(function (c) { return '<button class="dqk-chip' + (String(cur) === String(c[0]) ? " on" : "") + '" data-a="' + act + '" data-k="' + (key || "") + '" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join("") + '</div>';
  }
  function chk(k, label, p) { return '<label class="dqk-ck"><input type="checkbox" id="dqk-c-' + k + '"' + (p[k] ? " checked" : "") + '><span>' + label + '</span></label>'; }

  function drawEditor(keepScroll) {
    var m = $("dqk-main"); if (!m || !A.ed) return;
    var d = A.ed.doc, p = d.pdf, body = m.parentNode, sc = body.scrollTop;
    var h = '<div class="dqk-row" style="justify-content:space-between;align-items:center"><button class="dqk-btn o s" data-a="back">← Siyahı</button><b>' + (d._id ? "Toplunu redaktə et" : "Yeni toplu") + '</b></div>';

    /* üz qabığı ön baxışı */
    h += '<div class="dqk-ed dqk-pvrow"><div id="dqk-pvbox">' + coverBox(d, .5) + '</div><div class="dqk-pvside"><b>Üz qabığı ön baxışı</b><div class="dqk-meta">Ad, alt başlıq, rəng, fənn və səhifə ölçüsü dəyişdikcə dərhal yenilənir.</div><div class="dqk-row" style="margin-top:8px"><button class="dqk-btn o s" data-a="cvbig">🔍 Böyüt</button><button class="dqk-btn o s" data-a="pdfprev">📄 PDF ön baxışı</button></div></div></div>';

    h += '<div class="dqk-ed">';
    h += '<label>Kitabın adı</label><input class="dqk-in" id="dqk-t" maxlength="90" placeholder="Məsələn: Məntiq — Sınaq toplusu 2026" value="' + esc(d.title) + '">';
    h += '<label>Alt başlıq (ixtiyari)</label><input class="dqk-in" id="dqk-st" maxlength="90" value="' + esc(d.subtitle) + '">';
    h += '<div class="dqk-2"><div><label>Qabığın üst yazısı</label><input class="dqk-in" id="dqk-br" maxlength="40" placeholder="DQ PLATFORM" value="' + esc(d.brand) + '"></div><div><label>Qabığın alt yazısı</label><input class="dqk-in" id="dqk-by" maxlength="60" placeholder="© DQ PLATFORM" value="' + esc(d.byline) + '"></div></div>';
    h += '<label>Fənn</label>' + chipRow(SUBJ_CHIPS, d.subject, "subj");
    h += '<label>Üz qabığının rəngi</label><div class="dqk-chips">' + THEMES.map(function (t, i) { return '<div class="dqk-sw' + (d.theme === i ? " on" : "") + '" data-a="theme" data-v="' + i + '" title="' + t.n + '" style="background:linear-gradient(135deg,' + t.a + ',' + t.b + ')"></div>'; }).join("") + '</div>';

    h += '<div class="dqk-h">Kitabın sınaqları (' + d.items.length + ')</div>';
    if (!d.items.length) h += '<div class="dqk-meta" style="padding:6px 2px 10px">Hələ sınaq əlavə olunmayıb. Aşağıdan seçin.</div>';
    d.items.forEach(function (x, i) {
      var n = IDX ? cnt(x.exam, x.cat, d.subject) : null;
      h += '<div class="dqk-it"><span>' + (i + 1) + '</span><div><b>Sınaq ' + esc(x.exam) + ' · ' + esc(x.cat) + '</b><small' + (n === 0 ? ' style="color:#dc2626"' : "") + '>' + (n == null ? "…" : (n === 0 ? "sual yoxdur — kitabda atlanacaq" : n + " sual" + (d.subject === "all" ? "" : " (" + esc(subjName(d.subject)) + ")"))) + '</small></div><button data-a="up" data-i="' + i + '" aria-label="Yuxarı" ' + (i === 0 ? "disabled" : "") + '>↑</button><button data-a="dn" data-i="' + i + '" aria-label="Aşağı" ' + (i === d.items.length - 1 ? "disabled" : "") + '>↓</button><button data-a="rm" data-i="' + i + '" aria-label="Sil" style="color:#dc2626">✕</button></div>';
    });

    h += '<div class="dqk-h">Bazadakı sınaqlardan əlavə et</div>';
    if (A.ed.loading) h += '<div class="dqk-meta">Baza oxunur…</div>';
    else if (A.ed.err) h += '<div class="dqk-meta" style="color:#b91c1c">Xəta: ' + esc(A.ed.err) + '</div><button class="dqk-btn o s" data-a="reload" style="margin-top:8px">↻ Yenidən yüklə</button>';
    else {
      var bank = bankSorted(), cats = {}; bank.forEach(function (b) { cats[b.c] = 1; });
      var catArr = [["", "Hamısı"]].concat(Object.keys(cats).sort().map(function (c) { return [c, c]; }));
      if (!bank.length) h += '<div class="dqk-meta">Bazada sual tapılmadı.</div>';
      else {
        h += chipRow(catArr, A.ed.catF, "catf");
        h += '<div class="dqk-chips">' + bank.filter(function (b) { return !A.ed.catF || b.c === A.ed.catF; }).map(function (b) {
          var n = cnt(b.e, b.c, d.subject), on = hasItem(d, b.e, b.c);
          return '<button class="dqk-chip' + (on ? " on" : "") + (n ? "" : " z") + '" data-a="bank" data-e="' + esc(b.e) + '" data-c="' + esc(b.c) + '">' + (on ? "✓ " : "") + 'Sınaq ' + esc(b.e) + ' · ' + esc(b.c) + '<small>' + n + '</small></button>';
        }).join("") + '</div>';
        h += '<div class="dqk-row" style="margin-top:10px"><button class="dqk-btn o s" data-a="addall">➕ Görünənlərin hamısını əlavə et</button><button class="dqk-btn o s" data-a="clear">Təmizlə</button><button class="dqk-btn o s" data-a="reload">↻ Bazanı yenilə</button></div>';
      }
    }
    h += '<div class="dqk-h">Əl ilə əlavə et</div><div class="dqk-row"><input class="dqk-in" id="dqk-me" type="number" min="1" inputmode="numeric" placeholder="Sınaq №" style="width:110px"><select class="dqk-in" id="dqk-mc" style="width:auto"><option>BA</option><option>BB</option><option>AC</option></select><button class="dqk-btn s" data-a="manual">➕ Əlavə et</button></div>';

    /* PDF dizaynı */
    h += '<button class="dqk-acc" data-a="pdfsec" aria-expanded="' + (A.ed.pdfOpen ? "true" : "false") + '"><span>🎨 PDF / çap dizaynı</span><i>' + (A.ed.pdfOpen ? "▲" : "▼") + '</i></button>';
    h += '<div id="dqk-pdfbody" class="dqk-pdfbody" style="display:' + (A.ed.pdfOpen ? "block" : "none") + '">';
    h += '<label>Səhifə ölçüsü</label>' + chipRow([["A4", "A4"], ["A5", "A5"], ["Letter", "Letter"]], p.size, "pset", "size");
    h += '<label>Sütun sayı (sual səhifələrində)</label>' + chipRow([[1, "1 sütun"], [2, "2 sütun"]], p.cols, "pset", "cols");
    h += '<label>Şrift</label>' + chipRow([["serif", "Kitab (Serif)"], ["sans", "Sadə (Sans)"]], p.font, "pset", "font");
    h += '<label>Şrift ölçüsü: <b id="dqk-pfsv">' + p.fs + ' px</b></label><input type="range" id="dqk-pfs" min="10" max="18" step="1" value="' + p.fs + '" style="width:100%">';
    h += '<label>Səhifə başlığı (yuxarı)</label><input class="dqk-in" id="dqk-ph" maxlength="80" placeholder="Boş qalsa kitabın adı yazılır" value="' + esc(p.header) + '">';
    h += '<label>Səhifə altlığı (aşağı sol)</label><input class="dqk-in" id="dqk-pf" maxlength="80" placeholder="Məsələn: Hazırladı — Y. İmanov" value="' + esc(p.footer) + '">';
    h += '<label>Su nişanı (watermark, ixtiyari)</label><input class="dqk-in" id="dqk-pw" maxlength="30" placeholder="Məsələn: ys.imanoff" value="' + esc(p.watermark) + '">';
    h += '<label>PDF-ə daxil olsun</label><div class="dqk-cks">' + chk("cover", "Üz qabığı", p) + chk("toc", "Mündəricat", p) + chk("dividers", "Sınaq ayırıcı səhifələri", p) + chk("key", "Cavab açarı", p) + chk("back", "Arxa qabıq", p) + chk("answers", "Düzgün cavablar sualların içində", p) + chk("pageNums", "Səhifə nömrələri", p) + '</div>';
    h += '<div class="dqk-row" style="margin-top:12px"><button class="dqk-btn o s" data-a="pdfprev">📄 PDF ön baxışı</button><button class="dqk-btn g s" data-a="pdfprint">🖨 PDF yarat</button></div><div class="dqk-meta" style="margin-top:6px">«PDF yarat» çap pəncərəsini açır — orada «PDF kimi saxla» seçin. Dizayn ayarları kitabla birlikdə saxlanılır.</div>';
    h += '</div>';

    h += '</div><div class="dqk-row" style="margin-top:14px"><button class="dqk-btn g" data-a="save">💾 Yadda saxla</button><button class="dqk-btn gold" data-a="preview">📖 Oxu</button></div>';
    m.innerHTML = h;
    body.scrollTop = keepScroll ? sc : 0;
  }

  function onAdminInput(e) {
    var t = e.target; if (!A.ed || !t || !t.id || t.id.indexOf("dqk-") !== 0) return;
    if (t.id === "dqk-pfs") { var l = $("dqk-pfsv"); if (l) l.textContent = t.value + " px"; }
    readInputs();
    if (/^dqk-(t|st|br|by)$/.test(t.id)) updatePreview();
  }
  async function onAdminClick(e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a"), i = parseInt(b.getAttribute("data-i"));
    if (a === "close") return closeAdmin();
    if (a === "new") return openEditor(newDoc());
    if (a === "edit") return openEditor(A.docs[i]);
    if (a === "read") return read(A.docs[i]);
    if (a === "pdfv") return read(A.docs[i], { pdf: true });
    if (a === "del") {
      var dd = A.docs[i];
      if (!dd || !confirm("«" + (dd.title || "Adsız") + "» silinsin?")) return;
      try { await delDoc(dd._id); toast("Silindi"); } catch (er) { toast("Silinmədi: " + (er && er.message || er), true); }
      return refreshList();
    }
    if (a === "back") { A.ed = null; return refreshList(); }
    if (!A.ed) return;
    var doc = A.ed.doc;
    readInputs();
    if (a === "subj") { doc.subject = b.getAttribute("data-v"); return drawEditor(true); }
    if (a === "theme") { doc.theme = parseInt(b.getAttribute("data-v")); return drawEditor(true); }
    if (a === "catf") { A.ed.catF = b.getAttribute("data-v"); return drawEditor(true); }
    if (a === "pset") {
      var k = b.getAttribute("data-k"), v = b.getAttribute("data-v");
      doc.pdf[k] = k === "cols" ? parseInt(v) : v; return drawEditor(true);
    }
    if (a === "pdfsec") { A.ed.pdfOpen = !A.ed.pdfOpen; var pb = $("dqk-pdfbody"); if (pb) pb.style.display = A.ed.pdfOpen ? "block" : "none"; b.setAttribute("aria-expanded", A.ed.pdfOpen ? "true" : "false"); var ic = b.querySelector("i"); if (ic) ic.textContent = A.ed.pdfOpen ? "▲" : "▼"; return; }
    if (a === "cvbig") return showCoverModal();
    if (a === "reload") { A.ed.loading = true; A.ed.err = null; drawEditor(true); try { await loadIdx(true); } catch (er) { A.ed.err = (er && er.message) || "baza oxunmadı"; } A.ed.loading = false; return drawEditor(true); }
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
      bankSorted().filter(function (bk) { return !A.ed.catF || bk.c === A.ed.catF; }).forEach(function (bk) { if (cnt(bk.e, bk.c, doc.subject) && !hasItem(doc, bk.e, bk.c)) doc.items.push({ exam: bk.e, cat: bk.c }); });
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
    if (a === "preview" || a === "pdfprev" || a === "pdfprint") {
      if (!doc.items.length) { toast("Əvvəl ən azı bir sınaq əlavə edin", true); return; }
      return read(doc, a === "preview" ? {} : { pdf: true, print: a === "pdfprint" });
    }
  }
  async function doSave() {
    var d = A.ed.doc;
    readInputs();
    if (!String(d.title || "").trim()) { toast("Kitabın adını yazın", true); return; }
    if (!d.items.length) { toast("Ən azı bir sınaq əlavə edin", true); return; }
    if (A.busy) return; A.busy = true;
    try {
      d.title = d.title.trim(); d.updated = new Date().toISOString();
      await saveDoc(d);
      toast("✅ Kitab yadda saxlanıldı");
      A.docs = await listAll();
      var fresh = A.docs.filter(function (x) { return d._id ? x._id === d._id : x.created === d.created; })[0];
      if (fresh) { A.ed.doc = JSON.parse(JSON.stringify(fresh)); A.ed.doc.pdf = pdfOf(A.ed.doc); }
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
    return { w: pw, h: Math.min(stageH, spread ? 820 : 900), spread: spread };
  }

  /* real DOM ölçmə: eyni CSS ilə gizli səhifədə hər sualın hündürlüyü ölçülür */
  function makeMeasurer(fs, sz, cols, font, pdfPage) {
    try {
      var host = D.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;contain:layout";
      host.innerHTML = '<div class="dqk-pg S' + (pdfPage ? " pdf" : "") + (font === "sans" ? " sans" : "") + '" style="width:' + sz.w + 'px;height:' + sz.h + 'px;font-size:' + fs + 'px"><div class="dqk-rh"><span>x</span><span>x</span></div><div class="dqk-bd"></div><div class="dqk-pn">1</div></div>';
      D.body.appendChild(host);
      var bd = host.querySelector(".dqk-bd"), cs = getComputedStyle(bd);
      var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var availH = bd.clientHeight - padY, colW = (bd.clientWidth - padX - (cols - 1) * 18) / cols;
      if (!(availH > 80) || !(colW > 60)) { host.remove(); return null; }
      var inner = D.createElement("div"); inner.style.width = colW + "px"; bd.appendChild(inner);
      function hOf(html) {
        inner.innerHTML = html;
        var el = inner.firstElementChild; if (!el) return 0;
        var h = el.getBoundingClientRect().height + (parseFloat(getComputedStyle(el).marginBottom) || 0);
        Array.prototype.forEach.call(el.querySelectorAll("img"), function (im) { if (!im.complete || !im.naturalHeight) h += im.className === "dqk-oi" ? 90 : 160; });
        return h;
      }
      return {
        availH: Math.floor(availH * 0.985) - 6,
        q: function (r, cat) { return hOf(qHTML(r, cat, true)); },
        ban: function () { return hOf('<div class="dqk-ban"><span>Məntiq</span><small>SUAL 100–100</small></div>'); },
        done: function () { host.remove(); }
      };
    } catch (e) { return null; }
  }
  function preload(rows) {
    var urls = [];
    rows.forEach(function (r) {
      if (r.image_url) urls.push(r.image_url);
      (Array.isArray(r.options) ? r.options : []).forEach(function (o) { if (o && typeof o === "object" && o.image) urls.push(o.image); });
    });
    if (!urls.length) return Promise.resolve();
    return Promise.race([
      Promise.all(urls.map(function (u) { return new Promise(function (ok) { var im = new Image(); im.onload = im.onerror = ok; im.src = u; }); })),
      new Promise(function (ok) { setTimeout(ok, 5000); })
    ]);
  }

  /* o: {cols, cover, toc, div, key, back, safe} */
  function paginate(doc, data, fs, sz, o) {
    o = o || {};
    var cols = o.cols === 2 ? 2 : 1, F = { cover: o.cover !== false, toc: o.toc !== false, div: o.div !== false, key: o.key !== false, back: o.back !== false };
    var W = sz.w, H = sz.h, colW = (W - 44 - (cols - 1) * 18) / cols;
    var cpl = Math.max(12, Math.floor((colW - 46) / (fs * 0.52)));
    var budget = Math.max(6, Math.floor(((H - 105) / (fs * 1.6)) * cols * (o.safe || 1)));
    function ln(html) { return Math.max(1, Math.ceil(plain(html).length / cpl)); }
    function wt(r, cat) {
      var w = ln(r.question) + 1.5 + (r.image_url ? 9 : 0);
      if (isOpen(cat, r.q_number)) return w + 2.5;
      (Array.isArray(r.options) ? r.options : []).forEach(function (x) {
        var t = x && typeof x === "object" ? x.text : x;
        w += ln(t) + 0.2 + (x && typeof x === "object" && x.image ? 7 : 0);
      });
      return w;
    }
    var content = [], secs = [], total = 0, nItems = 0;
    var availH = o.m ? o.m.availH : H - 105;
    var kc = Math.max(4, Math.min(10, Math.floor((W - 44) / (fs * 5.2)))), keyRows = Math.max(4, Math.floor((availH - 60) / (fs * 2.5)));

    data.forEach(function (d, i) {
      var it = d.it, label = "Sınaq " + it.exam + " · " + it.cat;
      var subs = subjList(doc.subject).map(function (k) { return { k: k, rows: d.rows.filter(inRange(k)) }; }).filter(function (x) { return x.rows.length; });
      var n = subs.reduce(function (s, x) { return s + x.rows.length; }, 0);
      if (!n) return;
      total += n; nItems++;
      if (F.div) content.push({ t: "div", sec: i, label: label, subs: subs.map(function (x) { return { name: SUBJ[x.k].name, n: x.rows.length }; }), n: n });
      secs.push({ l: 0, text: label, local: content.length - (F.div ? 1 : 0), meta: n + " sual" });
      subs.forEach(function (sb) {
        var start = content.length, cur = [], used = 0, first = true, col = 0, colUsed = 0, m = o.m || null;
        var bannerH = m ? m.ban() : 0;
        var flush = function () {
          if (!cur.length) return;
          content.push({ t: "q", sec: i, sub: sb.k, cat: it.cat, label: label, qs: cur, banner: first });
          first = false; cur = []; used = 0; col = 0; colUsed = 0;
        };
        sb.rows.forEach(function (r) {
          if (m) {
            var hq = m.q(r, it.cat), cap = m.availH - (first ? bannerH : 0);
            if (cur.length && colUsed + hq > cap) { if (col + 1 < cols) { col++; colUsed = 0; } else flush(); }
            cur.push(r); colUsed += hq; return;
          }
          var w = wt(r, it.cat);
          if (cur.length && used + w > budget) flush();
          cur.push(r); used += w;
        });
        flush();
        secs.push({ l: 1, text: SUBJ[sb.k].name, local: start, meta: sb.rows.length + " sual" });
      });
      if (F.key) {
        var krows = [];
        subs.forEach(function (sb) {
          krows.push({ h: SUBJ[sb.k].name });
          for (var j = 0; j < sb.rows.length; j += kc) {
            krows.push({ cells: sb.rows.slice(j, j + kc).map(function (r) {
              var op = isOpen(it.cat, r.q_number);
              return { n: r.q_number, a: op ? String(r.correct == null ? "" : r.correct).slice(0, 9) : (L[parseInt(r.correct)] || "–") };
            }) });
          }
        });
        var kstart = content.length;
        for (var p = 0; p < krows.length; p += keyRows) content.push({ t: "key", sec: i, label: label, rows: krows.slice(p, p + keyRows), cols: kc, cont: p > 0 });
        secs.push({ l: 1, text: "Cavab açarı", local: kstart, meta: "" });
      }
    });

    var pages = [];
    if (F.cover) pages.push({ t: "cover" });
    if (F.toc && secs.length) {
      var eps = Math.max(6, Math.floor((availH - 60) / (fs * 2.2))), tocN = Math.max(1, Math.ceil(secs.length / eps));
      for (var k = 0; k < tocN; k++) pages.push({ t: "toc", ents: secs.slice(k * eps, (k + 1) * eps), cont: k > 0 });
    }
    var off = F.cover ? 0 : 1, base = pages.length;
    content.forEach(function (p) { pages.push(p); });
    secs.forEach(function (s) { s.page = base + s.local + off; });
    if (F.back) pages.push({ t: "back" });
    pages.forEach(function (p, i) { p.idx = i; p.no = i + off; });
    return { pages: pages, total: total, nItems: nItems, secs: secs, off: off };
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
        h += '<li' + (ans && parseInt(r.correct) === i ? ' class="ok"' : "") + '><b>' + (L[i] || "") + ')</b><span>' + rich(t) + (im ? '<img class="dqk-oi" src="' + esc(im) + '" alt="">' : "") + '</span></li>';
      });
      h += '</ol>';
    }
    return h + '</div></div>';
  }

  /* c: {doc,total,n,ans,pdf,print} */
  function pageInner(p, c) {
    var doc = c.doc, h;
    if (p.t === "cover") return coverHTML(doc, { n: c.n, q: c.total }, c.print);
    if (p.t === "back") return backHTML(doc, c.print);
    var left = (c.pdf && String(c.pdf.header || "").trim()) || doc.title;
    var head = '<div class="dqk-rh"><span>' + esc(left) + '</span><span>' + esc(p.label || (p.t === "toc" ? "Mündəricat" : "")) + '</span></div>';
    var foot = c.pdf
      ? '<div class="dqk-pn pdf"><span>' + esc(c.pdf.footer || "") + '</span><span>' + (c.pdf.pageNums ? p.no : "") + '</span></div>'
      : '<div class="dqk-pn">' + p.no + '</div>';
    var wm = c.pdf && String(c.pdf.watermark || "").trim() ? '<div class="dqk-wm">' + esc(c.pdf.watermark) + '</div>' : "";
    if (p.t === "toc") {
      h = '<h2 class="dqk-h2">Mündəricat' + (p.cont ? ' <small style="font-size:.5em;color:#8a7f66">(davamı)</small>' : "") + '</h2><ul class="dqk-toc">' + p.ents.map(function (s) {
        return '<li class="l' + s.l + '" data-go="' + s.page + '"><span>' + esc(s.text) + (s.meta ? '<em>' + esc(s.meta) + '</em>' : "") + '</span><i></i><b>' + s.page + '</b></li>';
      }).join("") + '</ul>';
    } else if (p.t === "div") {
      var m = p.label.split(" · ");
      h = '<div class="dqk-div"><div class="orn">❖ ❖ ❖</div><div class="big">' + esc(m[0]) + '</div><div class="cat">' + esc(m[1] || "") + ' KATEQORİYASI</div><ul>' + p.subs.map(function (s) { return '<li>' + esc(s.name) + ' — <b>' + s.n + ' sual</b></li>'; }).join("") + '</ul><div class="dqk-meta" style="margin-top:6px">Cəmi ' + p.n + ' sual</div></div>';
    } else if (p.t === "q") {
      var a = p.qs[0].q_number, b = p.qs[p.qs.length - 1].q_number;
      h = (p.banner ? '<div class="dqk-ban"><span>' + esc(SUBJ[p.sub].name) + '</span><small>SUAL ' + a + '–' + b + '</small></div>' : "") + p.qs.map(function (r) { return qHTML(r, p.cat, c.ans); }).join("");
    } else {
      h = '<h2 class="dqk-h2">Cavab açarı' + (p.cont ? ' <small style="font-size:.5em;color:#8a7f66">(davamı)</small>' : "") + '</h2>' + p.rows.map(function (r) {
        if (r.h) return '<div class="dqk-kh">' + esc(r.h) + '</div>';
        return '<div class="dqk-key" style="grid-template-columns:repeat(' + p.cols + ',1fr)">' + r.cells.map(function (x) { return '<div><span>' + esc(x.n) + '</span><b>' + esc(x.a) + '</b></div>'; }).join("") + '</div>';
      }).join("");
    }
    var c2 = c.pdf && c.pdf.cols === 2 && p.t === "q" ? " c2" : "";
    return wm + head + '<div class="dqk-bd' + c2 + '">' + h + '</div>' + foot;
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
    if (!p || !pages.length) return 0;
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
    r.innerHTML = '<div class="dqk-rtop"><button class="dqk-ib" data-r="close" aria-label="Bağla">✕</button><h4 id="dqk-rt"></h4><button class="dqk-ib" data-r="toc" title="Mündəricat" aria-label="Mündəricat">☰</button><button class="dqk-ib" data-r="fsm" title="Kiçilt">A−</button><button class="dqk-ib" data-r="fsp" title="Böyüt">A+</button><button class="dqk-ib" data-r="ans" id="dqk-ansb" title="Cavabları göstər/gizlət">✓</button><button class="dqk-ib" data-r="pdf" id="dqk-pdfb" title="PDF səhifə görünüşü">📄</button><button class="dqk-ib" data-r="print" title="Çap / PDF yarat">🖨</button></div><div class="dqk-prog"><i id="dqk-pr"></i></div><div class="dqk-stage" id="dqk-stage"></div><div class="dqk-rbot"><button class="dqk-ib nv" data-r="prev" aria-label="Əvvəlki">‹</button><div class="dqk-pgi"><input id="dqk-pi" type="number" min="0" inputmode="numeric" aria-label="Səhifə nömrəsi"><span id="dqk-pt">/ 0</span></div><button class="dqk-ib nv" data-r="next" aria-label="Növbəti">›</button></div>';
    D.body.appendChild(r);
    r.addEventListener("click", onReaderClick);
    var pi = r.querySelector("#dqk-pi");
    pi.addEventListener("change", function () { var v = parseInt(pi.value); if (!isNaN(v) && R) goto(v - R.off); else sync(); });
    pi.addEventListener("keydown", function (e) { if (e.key === "Enter") pi.blur(); });
    var st = r.querySelector("#dqk-stage"), sx = 0, sy = 0, tt = 0;
    st.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; tt = Date.now(); }, { passive: true });
    st.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dy) < 60 && Date.now() - tt < 700) turn(dx < 0 ? 1 : -1);
    }, { passive: true });
    D.addEventListener("keydown", function (e) {
      var cvp = $("dqk-cvp"), rd = $("dqk-rd"), ad = $("dqk-root");
      if (e.key === "Escape") {
        if (cvp) cvp.remove(); else if (rd && rd.classList.contains("on")) closeReader(); else if (ad && ad.classList.contains("on")) closeAdmin();
        return;
      }
      if (!R || !rd.classList.contains("on")) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1);
    });
    var rt; window.addEventListener("resize", function () {
      if (!R || !r.classList.contains("on") || !R.data) return;
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (D.activeElement === pi) return;
        if (R.pdfMode) return draw(false);
        var n = pageSize();
        if (!R.sz || n.w !== R.sz.w || n.spread !== R.sz.spread || Math.abs(n.h - R.sz.h) > 150) rebuild(true);
      }, 220);
    });
    return r;
  }

  function pdfOpts(pdf) { return { cols: pdf.cols, cover: pdf.cover, toc: pdf.toc, div: pdf.dividers, key: pdf.key, back: pdf.back, safe: 0.93 }; }

  async function read(doc, opts) {
    opts = opts || {};
    if (!doc || !doc.items || !doc.items.length) { toast("Kitabda sınaq yoxdur", true); return; }
    var r = ensureReader();
    QC = {};
    var me = R = { doc: doc, data: null, pages: [], cur: 0, fs: parseInt(lget("dqk_fs")) || 15, ans: lget("dqk_ans") === "1", pdfMode: !!opts.pdf, pdfAns: !!pdfOf(doc).answers, res: { total: 0, off: 0 }, off: 0, dir: "fwd" };
    r.setAttribute("style", themeVars(doc));
    r.classList.toggle("pdfm", me.pdfMode);
    r.querySelector("#dqk-rt").textContent = doc.title || "Kitab";
    r.classList.add("on"); D.body.style.overflow = "hidden";
    r.querySelector("#dqk-stage").innerHTML = '<div class="dqk-load"><i></i>Kitab hazırlanır…</div>';
    var data;
    try {
      data = await Promise.all(doc.items.map(function (it) { return getQs(it.exam, it.cat).then(function (rows) { return { it: it, rows: rows }; }); }));
    } catch (e) {
      if (R !== me) return;
      r.querySelector("#dqk-stage").innerHTML = '<div class="dqk-load">⚠️ Suallar yüklənmədi<br><small>' + esc(e && e.message || "şəbəkə xətası") + '</small><button class="dqk-ib" data-r="close">Bağla</button></div>';
      return;
    }
    if (R !== me) return;
    data.forEach(function (d) { QC[d.it.exam + "|" + d.it.cat] = d.rows; });
    await preload([].concat.apply([], data.map(function (d) { return d.rows; })));
    if (R !== me) return;
    me.data = data;
    rebuild(false);
    if (R !== me) return;
    if (!me.res.total) { toast("Seçilən sınaqlarda bu fənn üzrə sual tapılmadı", true); closeReader(); return; }
    if (opts.print) doPrint();
  }

  function rebuild(keep) {
    if (!R || !R.data) return;
    var prev = keep ? R.pages[R.cur] : null, res;
    if (R.pdfMode) {
      var pdf = pdfOf(R.doc), ps = sizeOf(pdf);
      R.sz = { w: ps.w, h: ps.h, spread: false };
      var mp = makeMeasurer(pdf.fs, R.sz, pdf.cols, pdf.font, true), op = pdfOpts(pdf); op.m = mp;
      res = paginate(R.doc, R.data, pdf.fs, R.sz, op);
      mp && mp.done();
    } else {
      R.sz = pageSize();
      var ms = makeMeasurer(R.fs, R.sz, 1, "serif", false);
      res = paginate(R.doc, R.data, R.fs, R.sz, { m: ms });
      ms && ms.done();
    }
    R.res = res; R.pages = res.pages; R.off = res.off;
    R.cur = prev ? findAnchor(R.pages, prev) : 0;
    $("dqk-ansb").classList.toggle("on", R.pdfMode ? R.pdfAns : R.ans);
    $("dqk-pdfb").classList.toggle("on", R.pdfMode);
    $("dqk-rd").classList.toggle("pdfm", R.pdfMode);
    draw(false);
  }

  function ctxOf(res) {
    return { doc: R.doc, total: res.total, n: res.nItems, ans: R.pdfMode ? R.pdfAns : R.ans, pdf: R.pdfMode ? pdfOf(R.doc) : null, print: false };
  }

  function draw(animate) {
    if (!R || !R.pages.length) return;
    var st = $("dqk-stage"), sz = R.sz, N = R.pages.length, h;
    if (R.pdfMode) {
      var pdf = pdfOf(R.doc), p = R.pages[R.cur], k = Math.min((st.clientWidth - 16) / sz.w, (st.clientHeight - 16) / sz.h, 1.3);
      if (!(k > 0.1)) k = 0.5;
      var cv = p.t === "cover" || p.t === "back";
      h = '<div class="dqk-pdfwrap' + (animate ? " " + R.dir : "") + '" style="width:' + Math.round(sz.w * k) + 'px;height:' + Math.round(sz.h * k) + 'px"><div class="dqk-pg S pdf' + (cv ? " cv" : "") + (pdf.font === "sans" ? " sans" : "") + '" data-idx="' + p.idx + '" style="width:' + sz.w + 'px;height:' + sz.h + 'px;font-size:' + pdf.fs + 'px;transform:scale(' + k + ');transform-origin:0 0">' + pageInner(p, ctxOf(R.res)) + '</div></div>';
      st.innerHTML = h; R.view = [R.cur]; sync(); return;
    }
    var view = viewOf(R.cur, sz.spread, N), c = ctxOf(R.res);
    h = '<div class="dqk-spread" style="height:' + sz.h + 'px">';
    view.forEach(function (idx, kk) {
      var side = view.length === 1 ? "S" : (kk === 0 ? "L" : "R");
      if (idx == null) { h += '<div class="dqk-pg ' + side + ' blank" style="width:' + sz.w + 'px;height:' + sz.h + 'px"></div>'; return; }
      var p = R.pages[idx], cls = "dqk-pg " + side + ((p.t === "cover" || p.t === "back") ? " cv" : "") + (animate ? " " + R.dir : "");
      h += '<div class="' + cls + '" data-idx="' + idx + '" style="width:' + sz.w + 'px;height:' + sz.h + 'px;font-size:' + R.fs + 'px">' + pageInner(p, c) + '</div>';
    });
    st.innerHTML = h + '</div>';
    R.view = view;
    sync();
  }

  function sync() {
    if (!R || !R.pages.length) return;
    var N = R.pages.length, shown = R.view.filter(function (x) { return x != null; });
    var a = shown[0], b = shown[shown.length - 1];
    var pi = $("dqk-pi"); if (pi && D.activeElement !== pi) pi.value = R.pages[a].no;
    $("dqk-pt").textContent = "/ " + R.pages[N - 1].no + (shown.length > 1 ? "  (" + R.pages[a].no + "–" + R.pages[b].no + ")" : "");
    $("dqk-pr").style.width = (N > 1 ? b / (N - 1) * 100 : 100) + "%";
    var prev = D.querySelector('#dqk-rd [data-r="prev"]'), next = D.querySelector('#dqk-rd [data-r="next"]');
    prev.disabled = a === 0; next.disabled = b === N - 1; prev.style.opacity = prev.disabled ? .35 : 1; next.style.opacity = next.disabled ? .35 : 1;
  }

  function goto(idx) {
    if (!R || !R.pages.length) return;
    idx = Math.max(0, Math.min(R.pages.length - 1, idx));
    R.dir = idx >= R.cur ? "fwd" : "bwd"; R.cur = idx; draw(true);
  }
  function turn(d) {
    if (!R || !R.view) return;
    var shown = R.view.filter(function (x) { return x != null; }), N = R.pages.length, t;
    if (d > 0) { t = shown[shown.length - 1] + 1; if (t >= N) return; }
    else { t = shown[0] - 1; if (t < 0) return; }
    goto(t);
  }

  function onReaderClick(e) {
    if (!R) return;
    var go = e.target.closest("[data-go]");
    if (go) { goto(parseInt(go.getAttribute("data-go")) - R.off); return; }
    var b = e.target.closest("[data-r]"); if (!b) return;
    var a = b.getAttribute("data-r");
    if (a === "close") return closeReader();
    if (a === "start" || a === "toc") { var ti = R.pages.findIndex(function (p) { return p.t === "toc"; }); var f = R.pages.findIndex(function (p) { return p.t !== "cover"; }); return goto(ti > -1 ? ti : (f > -1 ? f : 0)); }
    if (a === "prev") return turn(-1);
    if (a === "next") return turn(1);
    if (a === "fsp" || a === "fsm") {
      R.fs = Math.max(12, Math.min(22, R.fs + (a === "fsp" ? 1 : -1))); lset("dqk_fs", R.fs);
      toast("Şrift: " + R.fs + " px"); return rebuild(true);
    }
    if (a === "ans") {
      if (R.pdfMode) R.pdfAns = !R.pdfAns; else { R.ans = !R.ans; lset("dqk_ans", R.ans ? "1" : "0"); }
      var on = R.pdfMode ? R.pdfAns : R.ans;
      $("dqk-ansb").classList.toggle("on", on); toast(on ? "Cavablar göstərilir" : "Cavablar gizlədildi"); return draw(false);
    }
    if (a === "pdf") { R.pdfMode = !R.pdfMode; toast(R.pdfMode ? "PDF səhifə görünüşü (" + pdfOf(R.doc).size + ")" : "Oxu görünüşü"); return rebuild(true); }
    if (a === "print") return doPrint();
  }

  function waitImgs(box) {
    var imgs = Array.prototype.slice.call(box.querySelectorAll("img"));
    if (!imgs.length) return Promise.resolve();
    return Promise.race([Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; }); })), new Promise(function (ok) { setTimeout(ok, 5000); })]);
  }

  function doPrint() {
    if (!R || !R.data) return;
    var pdf = pdfOf(R.doc), ps = sizeOf(pdf);
    var mq = makeMeasurer(pdf.fs, { w: ps.w, h: ps.h }, pdf.cols, pdf.font, true), oq = pdfOpts(pdf); oq.m = mq;
    var res = paginate(R.doc, R.data, pdf.fs, { w: ps.w, h: ps.h }, oq);
    mq && mq.done();
    if (!res.pages.length) { toast("Çap üçün səhifə yoxdur", true); return; }
    var old = $("dqk-print"); if (old) old.remove();
    var oldS = $("dqk-print-css"); if (oldS) oldS.remove();
    var sty = D.createElement("style"); sty.id = "dqk-print-css";
    sty.textContent = "@media print{@page{size:" + (pdf.size === "Letter" ? "letter" : pdf.size) + ";margin:10mm}#dqk-print .dqk-pg{width:" + ps.w + "px!important;height:" + ps.h + "px!important}}";
    D.head.appendChild(sty);
    var box = D.createElement("div"); box.id = "dqk-print"; box.setAttribute("style", themeVars(R.doc));
    var c = { doc: R.doc, total: res.total, n: res.nItems, ans: R.pdfAns, pdf: pdf, print: true };
    box.innerHTML = res.pages.map(function (p) {
      var cv = p.t === "cover" || p.t === "back";
      return '<div class="dqk-pg S pdf' + (cv ? " cv" : "") + (pdf.font === "sans" ? " sans" : "") + '" style="width:' + ps.w + 'px;height:' + ps.h + 'px;font-size:' + pdf.fs + 'px">' + pageInner(p, c) + '</div>';
    }).join("");
    D.body.appendChild(box);
    var done = false, clean = function () { if (done) return; done = true; box.remove(); sty.remove(); window.removeEventListener("afterprint", clean); };
    window.addEventListener("afterprint", clean);
    toast("Çap pəncərəsində «PDF kimi saxla» seçin");
    waitImgs(box).then(function () { setTimeout(function () { try { window.print(); } catch (e) { clean(); } setTimeout(clean, 120000); }, 150); });
  }

  function closeReader() {
    var r = $("dqk-rd"); r && r.classList.remove("on");
    R = null;
    var adm = $("dqk-root");
    if (!(adm && adm.classList.contains("on"))) D.body.style.overflow = "";
  }

  window.DQK = { open: open, read: read, close: function () { closeReader(); closeAdmin(); }, _paginate: paginate };
})();
