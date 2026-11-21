/* ===== CLC GDC — the calculator window =====
   Modes like an exam graphing calculator: Run (calculations), Graph (with G-Solve), Table, Stats (1-var & regression),
   Dist (normal, binomial, χ² tests), Equation (polynomials, simultaneous, solver) and Finance (TVM).
   Uses the engine in assets/gdc-core.js. Opens with CLCGDC.open(); everything typed is kept on this device. */
(function(){
  "use strict";
  var G = window.CLCGDCMath, STORE = "clc_gdc_v1";
  var COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7"];
  var TABS = [["run", "Run"], ["graph", "Graph"], ["table", "Table"], ["stats", "Stats"], ["dist", "Dist"], ["equa", "Equa"], ["tvm", "TVM"]];
  var DEF = {
    tab: "run", deg: false, hist: [],
    ys: [{f: "", on: true}, {f: "", on: true}, {f: "", on: true}, {f: "", on: true}],
    win: {xmin: -10, xmax: 10, ymin: -10, ymax: 10}, tbl: {start: "-3", end: "3", step: "1"},
    l1: "", l2: "", freq: false, reg: "linear", est: "",
    dist: {type: "ncd", lo: "-1E99", hi: "1E99", mu: "0", sd: "1", x: "", area: "", tail: "left", n: "", p: "", obs: "", exp: "", df: "", mat: ""},
    equa: {type: "poly", deg: 2, unk: 2, coef: {}, eq: "", lo: "-100", hi: "100"},
    tvm: {N: "", I: "", PV: "", PMT: "0", FV: "", PY: "1", CY: "1", bgn: false}
  };
  var S = load(), panel = null, gs = {marks: [], shade: null, trace: null};

  function load(){
    var s = null; try{ s = JSON.parse(localStorage.getItem(STORE) || "null"); }catch(e){}
    var o = JSON.parse(JSON.stringify(DEF));
    if (s) Object.keys(o).forEach(function(k){ if (s[k] !== undefined) o[k] = (typeof o[k] === "object" && !Array.isArray(o[k])) ? Object.assign(o[k], s[k]) : s[k]; });
    return o;
  }
  var saveT = 0;
  function save(){ clearTimeout(saveT); saveT = setTimeout(function(){ try{ localStorage.setItem(STORE, JSON.stringify(S)); }catch(e){} }, 200); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c]; }); }
  function $(sel){ return panel.querySelector(sel); }
  function env(){ return {deg: S.deg, Ans: ans()}; }
  function ans(){ var h = S.hist[S.hist.length - 1]; return h ? h.v : 0; }
  function num(s, name){                       // a field: number or expression such as 1/3, −2000, √2
    if (String(s).trim() === "") throw new Error((name || "A value") + " is missing");
    var t = String(s).trim().toLowerCase();
    if (t === "-inf" || t === "−inf" || t === "-∞" || t === "−∞") return -Infinity;
    if (t === "inf" || t === "∞") return Infinity;
    var v = G.calc(s, env());
    if (typeof v !== "number" || isNaN(v)) throw new Error((name || "A value") + " is not a number");
    return v;
  }
  function list(s, name){
    var parts = String(s).split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) throw new Error((name || "The list") + " is empty");
    return parts.map(function(p, i){ return num(p, (name || "List") + " value " + (i + 1)); });
  }
  function F(v){ return G.fmt(v); }
  function row(k, v){ return "<div class='gdc-kv'><span>" + k + "</span><b>" + v + "</b></div>"; }
  function err(e){ return "<div class='gdc-err'>" + esc(e && e.message ? e.message : e) + "</div>"; }

  /* ---------------- window ---------------- */
  function build(){
    panel = document.createElement("div");
    panel.className = "gdc"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Graphing calculator");
    panel.innerHTML =
      "<div class='gdc-head'><b>CLC GDC</b><span class='gdc-sp'></span>" +
      "<button class='gdc-chip' data-act='angle' title='Angle unit'></button>" +
      "<button class='gdc-x' data-act='close' aria-label='Close calculator'>✕</button></div>" +
      "<div class='gdc-tabs' role='tablist'>" + TABS.map(function(t){ return "<button role='tab' data-tab='" + t[0] + "'>" + t[1] + "</button>"; }).join("") + "</div>" +
      "<div class='gdc-body'></div>";
    document.body.appendChild(panel);
    panel.addEventListener("click", onClick);
    panel.addEventListener("input", onInput);
    panel.addEventListener("change", onInput);
    panel.addEventListener("keydown", function(e){
      if (e.key === "Escape"){ close(); return; }
      if (e.key === "Enter" && e.target.id === "gdcIn"){ e.preventDefault(); exe(); }
    });
    drag();
  }
  function drag(){
    var head = panel.querySelector(".gdc-head"), sx, sy, ox, oy, on = false;
    head.addEventListener("pointerdown", function(e){
      if (e.target.closest("button") || window.innerWidth < 640) return;
      on = true; sx = e.clientX; sy = e.clientY; var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", function(e){
      if (!on) return;
      var x = Math.min(window.innerWidth - 80, Math.max(0, ox + e.clientX - sx)), y = Math.min(window.innerHeight - 40, Math.max(0, oy + e.clientY - sy));
      panel.style.left = x + "px"; panel.style.top = y + "px"; panel.style.right = "auto"; panel.style.bottom = "auto";
    });
    head.addEventListener("pointerup", function(){ on = false; });
  }
  function open(){
    if (!panel) build();
    panel.classList.add("open"); document.documentElement.classList.add("gdc-open");
    render();
  }
  function close(){ if (panel){ panel.classList.remove("open"); document.documentElement.classList.remove("gdc-open"); } }
  function toggle(){ if (panel && panel.classList.contains("open")) close(); else open(); }

  function render(){
    panel.querySelector("[data-act=angle]").textContent = S.deg ? "Deg" : "Rad";
    Array.prototype.forEach.call(panel.querySelectorAll("[data-tab]"), function(b){ b.setAttribute("aria-selected", b.getAttribute("data-tab") === S.tab ? "true" : "false"); });
    var body = panel.querySelector(".gdc-body");
    body.innerHTML = ({run: runHTML, graph: graphHTML, table: tableHTML, stats: statsHTML, dist: distHTML, equa: equaHTML, tvm: tvmHTML})[S.tab]();
    if (S.tab === "run"){ var h = $(".gdc-screen"); h.scrollTop = h.scrollHeight; var inp = $("#gdcIn"); if (matchMedia("(pointer:coarse)").matches) inp.setAttribute("inputmode", "none"); inp.focus(); }
    if (S.tab === "graph") setupCanvas();
  }

  /* ---------------- Run ---------------- */
  var FKEYS = [["sin", "sin("], ["cos", "cos("], ["tan", "tan("], ["ln", "ln("], ["log", "log("], ["√", "√("],
               ["sin⁻¹", "sin⁻¹("], ["cos⁻¹", "cos⁻¹("], ["tan⁻¹", "tan⁻¹("], ["eˣ", "e^("], ["x²", "²"], ["xʸ", "^"],
               ["(", "("], [")", ")"], [",", ","], ["π", "π"], ["e", "e"], ["x", "x"],
               ["∫dx", "∫("], ["d/dx", "d/dx("], ["Σ", "Σ("], ["nCr", "nCr("], ["nPr", "nPr("], ["x!", "!"]];
  var NKEYS = [["7"], ["8"], ["9"], ["DEL", "@del"], ["AC", "@ac"],
               ["4"], ["5"], ["6"], ["×", "×"], ["÷", "÷"],
               ["1"], ["2"], ["3"], ["+"], ["−", "−"],
               ["0"], ["."], ["×10ˣ", "E"], ["Ans", "Ans"], ["EXE", "@exe"]];
  function runHTML(){
    var h = S.hist.slice(-40).map(function(it, i){
      var fr = typeof it.v === "number" ? G.toFrac(it.v) : null;
      return "<button class='gdc-line' data-recall='" + (S.hist.length - Math.min(40, S.hist.length) + i) + "' title='Use this calculation again'>" +
        "<span class='gdc-e'>" + esc(it.e) + "</span><span class='gdc-r'>" + esc(F(it.v)) + (fr ? "<small> = " + esc(fr) + "</small>" : "") + "</span></button>";
    }).join("");
    return "<div class='gdc-screen'>" + (h || "<div class='gdc-hint'>Type a calculation and press EXE.<br>Examples: <code>2sin(30)</code>, <code>∫(x^2,0,3)</code>, <code>d/dx(x^3,2)</code>, <code>Σ(x^2,1,10)</code>, <code>nCr(10,3)</code></div>") + "</div>" +
      "<input id='gdcIn' class='gdc-input' autocomplete='off' autocapitalize='off' spellcheck='false' aria-label='Calculation' placeholder='0'>" +
      "<div class='gdc-msg' id='gdcMsg'></div>" +
      "<div class='gdc-keys gdc-f'>" + FKEYS.map(function(k){ return "<button data-key='" + esc(k[1]) + "'>" + k[0] + "</button>"; }).join("") + "</div>" +
      "<div class='gdc-keys gdc-n'>" + NKEYS.map(function(k){ var v = k[1] || k[0]; return "<button data-key='" + esc(v) + "' class='" + (v === "@exe" ? "gdc-exe" : v[0] === "@" ? "gdc-del" : "") + "'>" + k[0] + "</button>"; }).join("") + "</div>" +
      "<div class='gdc-row'><button class='gdc-small' data-act='clearhist'>Clear history</button></div>";
  }
  function insert(t){
    var inp = $("#gdcIn"); if (!inp) return;
    if (t === "@exe") return exe();
    if (t === "@ac"){ inp.value = ""; $("#gdcMsg").textContent = ""; inp.focus(); return; }
    var a = inp.selectionStart == null ? inp.value.length : inp.selectionStart, b = inp.selectionEnd == null ? a : inp.selectionEnd;
    if (t === "@del"){
      if (a === b && a > 0){ var cut = 1, before = inp.value.slice(0, a);
        var m = /(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|d\/dx\(|nCr\(|nPr\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|∫\(|Σ\(|e\^\(|Ans)$/.exec(before); if (m) cut = m[0].length;
        inp.value = inp.value.slice(0, a - cut) + inp.value.slice(b); a -= cut; }
      else { inp.value = inp.value.slice(0, a) + inp.value.slice(b); }
      inp.setSelectionRange(a, a); inp.focus(); return;
    }
    if (inp.value === "" && /^[×÷+^²!]/.test(t) && S.hist.length) t = "Ans" + t;   // like a GDC: an operator first uses Ans
    inp.value = inp.value.slice(0, a) + t + inp.value.slice(b);
    var p = a + t.length; inp.setSelectionRange(p, p); inp.focus();
  }
  function exe(){
    var inp = $("#gdcIn"), msg = $("#gdcMsg"), e = inp.value.trim();
    if (!e){ if (S.hist.length){ e = S.hist[S.hist.length - 1].e; } else return; }
    try{
      var v = G.calc(e, env());
      S.hist.push({e: e, v: v}); if (S.hist.length > 200) S.hist.shift(); save();
      render();
    }catch(x){ msg.textContent = x.message; }
  }

  /* ---------------- Graph ---------------- */
  function graphHTML(){
    var fs = S.ys.map(function(y, i){
      return "<div class='gdc-y'><label class='gdc-dot' style='--c:" + COLORS[i] + "'><input type='checkbox' data-yon='" + i + "'" + (y.on ? " checked" : "") + " aria-label='Show Y" + (i + 1) + "'></label>" +
        "<span>Y" + (i + 1) + "=</span><input data-yf='" + i + "' value='" + esc(y.f) + "' placeholder='" + (i === 0 ? "e.g. x^3-12x" : "") + "' autocomplete='off' spellcheck='false'></div>";
    }).join("");
    var w = S.win;
    return "<div class='gdc-canvas-wrap'><canvas id='gdcCv' aria-label='Graph'></canvas><div class='gdc-trace' id='gdcTr'></div></div>" +
      "<div class='gdc-row'><button data-act='zin'>Zoom +</button><button data-act='zout'>Zoom −</button><button data-act='zstd'>Standard</button><button data-act='zauto'>Auto</button></div>" +
      fs +
      "<details class='gdc-win'><summary>V-Window</summary><div class='gdc-grid4'>" +
      ["xmin", "xmax", "ymin", "ymax"].map(function(k){ return "<label>" + k.replace("min", " min").replace("max", " max") + "<input data-win='" + k + "' value='" + F(w[k]).replace("−", "-") + "'></label>"; }).join("") +
      "</div></details>" +
      "<div class='gdc-gs'><b>G-Solve</b><div class='gdc-row'>" +
      "<select id='gsT'><option value='root'>Root</option><option value='max'>Max</option><option value='min'>Min</option><option value='isct'>Intersect</option>" +
      "<option value='yint'>y-intercept</option><option value='ycal'>Y-Cal (y at x)</option><option value='xcal'>X-Cal (x at y)</option><option value='int'>∫dx</option></select>" +
      "<select id='gsF'>" + [0, 1, 2, 3].map(function(i){ return "<option value='" + i + "'>Y" + (i + 1) + "</option>"; }).join("") + "</select>" +
      "<select id='gsG' class='gdc-hide'>" + [0, 1, 2, 3].map(function(i){ return "<option value='" + i + "'" + (i === 1 ? " selected" : "") + ">Y" + (i + 1) + "</option>"; }).join("") + "</select>" +
      "<input id='gsA' class='gdc-hide gdc-short' placeholder='x'><input id='gsB' class='gdc-hide gdc-short' placeholder='b'>" +
      "<button class='gdc-go' data-act='gsolve'>Solve</button></div><div id='gsOut' class='gdc-out'></div>" +
      "<p class='gdc-note'>Root, Max, Min and Intersect search the x-range you can see. Drag to move the graph, pinch or scroll to zoom, tap the graph to trace.</p></div>";
  }
  var cv, ctx, W, H, ro;
  function setupCanvas(){
    cv = $("#gdcCv"); ctx = cv.getContext("2d");
    function size(){ var r = cv.parentNode.getBoundingClientRect(), d = window.devicePixelRatio || 1; W = r.width; H = Math.round(Math.min(300, Math.max(200, W * 0.68)));
      cv.style.height = H + "px"; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0); draw(); }
    size();
    if (ro) ro.disconnect();
    if (window.ResizeObserver){ ro = new ResizeObserver(function(){ if (cv && cv.isConnected) size(); }); ro.observe(cv.parentNode); }
    var pts = {}, start = null, moved = false;
    cv.addEventListener("pointerdown", function(e){ cv.setPointerCapture(e.pointerId); pts[e.pointerId] = {x: e.offsetX, y: e.offsetY};
      start = {w: Object.assign({}, S.win), p: Object.assign({}, pts), d: dist2()}; moved = false; });
    cv.addEventListener("pointermove", function(e){
      if (!pts[e.pointerId]) return; pts[e.pointerId] = {x: e.offsetX, y: e.offsetY};
      var ids = Object.keys(pts), w = start.w, sx = (w.xmax - w.xmin) / W, sy = (w.ymax - w.ymin) / H;
      if (ids.length === 1 && start.p[ids[0]]){
        var dx = pts[ids[0]].x - start.p[ids[0]].x, dy = pts[ids[0]].y - start.p[ids[0]].y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved){ S.win = {xmin: w.xmin - dx * sx, xmax: w.xmax - dx * sx, ymin: w.ymin + dy * sy, ymax: w.ymax + dy * sy}; draw(); }
      } else if (ids.length === 2 && start.d){
        moved = true; var k = start.d / Math.max(10, dist2()); zoomAt(w, k, W / 2, H / 2); draw();
      }
    });
    function end(e){ delete pts[e.pointerId];
      if (!moved && Object.keys(pts).length === 0) trace(e.offsetX, e.offsetY);
      start = {w: Object.assign({}, S.win), p: Object.assign({}, pts), d: dist2()}; save(); syncWin(); }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("wheel", function(e){ e.preventDefault(); zoomAt(Object.assign({}, S.win), e.deltaY > 0 ? 1.15 : 1 / 1.15, e.offsetX, e.offsetY); draw(); save(); syncWin(); }, {passive: false});
    function dist2(){ var ids = Object.keys(pts); if (ids.length < 2) return 0; var a = pts[ids[0]], b = pts[ids[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    gsTypeUI();
  }
  function zoomAt(w, k, px, py){
    var cx = w.xmin + px / W * (w.xmax - w.xmin), cy = w.ymax - py / H * (w.ymax - w.ymin);
    S.win = {xmin: cx - (cx - w.xmin) * k, xmax: cx + (w.xmax - cx) * k, ymin: cy - (cy - w.ymin) * k, ymax: cy + (w.ymax - cy) * k};
  }
  function syncWin(){ ["xmin", "xmax", "ymin", "ymax"].forEach(function(k){ var el = panel.querySelector("[data-win=" + k + "]"); if (el && document.activeElement !== el) el.value = F(S.win[k]).replace("−", "-"); }); }
  function funcs(){
    return S.ys.map(function(y, i){
      if (!y.on || !y.f.trim()) return null;
      try{ return {i: i, f: G.compile(y.f, env())}; }catch(e){ return {i: i, error: e.message}; }
    });
  }
  function nice(span){ var raw = span / 8, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function draw(){
    if (!ctx) return;
    var cs = getComputedStyle(panel), ink = cs.getPropertyValue("--ink").trim() || "#000", line = cs.getPropertyValue("--line").trim() || "#ddd",
        muted = cs.getPropertyValue("--muted").trim() || "#666", bg = cs.getPropertyValue("--paper").trim() || "#fff", w = S.win;
    var X = function(x){ return (x - w.xmin) / (w.xmax - w.xmin) * W; }, Y = function(y){ return H - (y - w.ymin) / (w.ymax - w.ymin) * H; };
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var tx = nice(w.xmax - w.xmin), ty = nice(w.ymax - w.ymin);
    ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.beginPath();
    for (var gx = Math.ceil(w.xmin / tx) * tx; gx <= w.xmax; gx += tx){ ctx.moveTo(Math.round(X(gx)) + .5, 0); ctx.lineTo(Math.round(X(gx)) + .5, H); }
    for (var gy = Math.ceil(w.ymin / ty) * ty; gy <= w.ymax; gy += ty){ ctx.moveTo(0, Math.round(Y(gy)) + .5); ctx.lineTo(W, Math.round(Y(gy)) + .5); }
    ctx.stroke();
    ctx.strokeStyle = muted; ctx.lineWidth = 1.5; ctx.beginPath();
    if (w.xmin < 0 && w.xmax > 0){ ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); }
    if (w.ymin < 0 && w.ymax > 0){ ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); }
    ctx.stroke();
    ctx.fillStyle = muted; ctx.font = "10px system-ui, sans-serif";
    var ay = Math.min(H - 4, Math.max(12, Y(0) + 12)), ax = Math.min(W - 30, Math.max(3, X(0) + 3));
    for (gx = Math.ceil(w.xmin / tx) * tx; gx <= w.xmax; gx += tx) if (Math.abs(gx) > tx / 2) ctx.fillText(F(+gx.toPrecision(6)), X(gx) + 2, ay);
    for (gy = Math.ceil(w.ymin / ty) * ty; gy <= w.ymax; gy += ty) if (Math.abs(gy) > ty / 2) ctx.fillText(F(+gy.toPrecision(6)), ax, Y(gy) - 2);
    // shaded integral
    var list = funcs();
    if (gs.shade && list[gs.shade.i] && list[gs.shade.i].f){
      var f0 = list[gs.shade.i].f; ctx.fillStyle = COLORS[gs.shade.i] + "33"; ctx.beginPath(); ctx.moveTo(X(gs.shade.a), Y(0));
      for (var k = 0; k <= 200; k++){ var xs = gs.shade.a + (gs.shade.b - gs.shade.a) * k / 200; ctx.lineTo(X(xs), Y(f0(xs))); }
      ctx.lineTo(X(gs.shade.b), Y(0)); ctx.closePath(); ctx.fill();
    }
    var errs = [];
    list.forEach(function(it){
      if (!it) return; if (it.error){ errs.push("Y" + (it.i + 1) + ": " + it.error); return; }
      ctx.strokeStyle = COLORS[it.i]; ctx.lineWidth = 2; ctx.beginPath();
      var pen = false, prev = null, n = Math.ceil(W * 2);
      for (var j = 0; j <= n; j++){
        var x = w.xmin + (w.xmax - w.xmin) * j / n, y = it.f(x), py = Y(y);
        if (!isFinite(y) || Math.abs(py) > 1e6){ pen = false; prev = null; continue; }
        if (pen && prev !== null && Math.abs(py - prev) > H * 1.5){ pen = false; }
        if (pen) ctx.lineTo(X(x), py); else { ctx.moveTo(X(x), py); pen = true; }
        prev = py;
      }
      ctx.stroke();
    });
    gs.marks.forEach(function(m){ dot(X(m.x), Y(m.y), COLORS[m.i] || ink, ink); });
    if (gs.trace){ var t = gs.trace; ctx.strokeStyle = muted; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(t.x), 0); ctx.lineTo(X(t.x), H); ctx.stroke(); ctx.setLineDash([]); dot(X(t.x), Y(t.y), COLORS[t.i], ink); }
    var tr = $("#gdcTr");
    if (tr) tr.innerHTML = gs.trace ? "<b style='color:" + COLORS[gs.trace.i] + "'>Y" + (gs.trace.i + 1) + "</b> x = " + F(gs.trace.x) + ", y = " + F(gs.trace.y) : (errs.length ? "<span class='gdc-err'>" + esc(errs.join(" · ")) + "</span>" : "");
  }
  function dot(x, y, c, ink){ ctx.fillStyle = c; ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
  function trace(px, py){
    var w = S.win, x = w.xmin + px / W * (w.xmax - w.xmin), yc = w.ymax - py / H * (w.ymax - w.ymin), best = null;
    funcs().forEach(function(it){ if (!it || !it.f) return; var y = it.f(x); if (isFinite(y) && (!best || Math.abs(y - yc) < Math.abs(best.y - yc))) best = {i: it.i, x: x, y: y}; });
    gs.trace = best; draw();
  }
  function autoY(){
    var ys = [], w = S.win;
    funcs().forEach(function(it){ if (!it || !it.f) return; for (var j = 0; j <= 400; j++){ var y = it.f(w.xmin + (w.xmax - w.xmin) * j / 400); if (isFinite(y)) ys.push(y); } });
    if (!ys.length) return;
    ys.sort(function(a, b){ return a - b; });
    var lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.98) - 1];
    if (hi - lo < 1e-9){ lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.1; S.win.ymin = lo - pad; S.win.ymax = hi + pad;
  }
  function gsTypeUI(){
    var t = $("#gsT").value;
    $("#gsG").classList.toggle("gdc-hide", t !== "isct");
    $("#gsA").classList.toggle("gdc-hide", ["ycal", "xcal", "int"].indexOf(t) < 0);
    $("#gsB").classList.toggle("gdc-hide", t !== "int");
    $("#gsA").placeholder = t === "xcal" ? "y =" : t === "int" ? "lower a" : "x =";
    $("#gsB").placeholder = "upper b";
  }
  function gsolve(){
    var out = $("#gsOut"), t = $("#gsT").value, i = +$("#gsF").value, list = funcs(), it = list[i], w = S.win;
    gs.marks = []; gs.shade = null; gs.trace = null;
    try{
      if (!it) throw new Error("Y" + (i + 1) + " is empty or hidden");
      if (it.error) throw new Error("Y" + (i + 1) + ": " + it.error);
      var f = it.f, res = [], name = "Y" + (i + 1);
      if (t === "root"){ G.roots(f, w.xmin, w.xmax).forEach(function(x){ res.push(row(name + " root", "x = " + F(x))); gs.marks.push({i: i, x: x, y: 0}); }); }
      else if (t === "max" || t === "min"){ G.extrema(f, w.xmin, w.xmax, t === "max" ? 1 : -1).forEach(function(p){ res.push(row(name + " " + t, "x = " + F(p.x) + ", y = " + F(p.y))); gs.marks.push({i: i, x: p.x, y: p.y}); }); }
      else if (t === "isct"){
        var j = +$("#gsG").value, g = list[j]; if (j === i) throw new Error("Choose two different functions");
        if (!g || g.error) throw new Error("Y" + (j + 1) + " is empty, hidden or has an error");
        G.roots(function(x){ return f(x) - g.f(x); }, w.xmin, w.xmax).forEach(function(x){ var y = f(x); res.push(row("Y" + (i + 1) + " ∩ Y" + (j + 1), "x = " + F(x) + ", y = " + F(y))); gs.marks.push({i: i, x: x, y: y}); });
      }
      else if (t === "yint"){ var y0 = f(0); if (!isFinite(y0)) throw new Error("Not defined at x = 0"); res.push(row(name + " y-intercept", "y = " + F(y0))); gs.marks.push({i: i, x: 0, y: y0}); }
      else if (t === "ycal"){ var xv = num($("#gsA").value, "x"), yv = f(xv); if (!isFinite(yv)) throw new Error("Not defined at this x"); res.push(row(name + "(" + F(xv) + ")", "y = " + F(yv))); gs.marks.push({i: i, x: xv, y: yv}); }
      else if (t === "xcal"){ var k = num($("#gsA").value, "y"); G.roots(function(x){ return f(x) - k; }, w.xmin, w.xmax).forEach(function(x){ res.push(row(name + " = " + F(k), "x = " + F(x))); gs.marks.push({i: i, x: x, y: k}); }); }
      else if (t === "int"){ var a = num($("#gsA").value, "Lower limit"), b = num($("#gsB").value, "Upper limit"); res.push(row("∫ " + name + " dx from " + F(a) + " to " + F(b), F(G.integrate(f, a, b)))); gs.shade = {i: i, a: a, b: b}; }
      out.innerHTML = res.length ? res.join("") : "<div class='gdc-note'>Nothing found in the visible x-range (" + F(w.xmin) + " to " + F(w.xmax) + "). Zoom out or move the graph.</div>";
    }catch(e){ out.innerHTML = err(e); }
    draw();
  }

  /* ---------------- Table ---------------- */
  function tableHTML(){
    var t = S.tbl, body = "", head = "", msg = "";
    try{
      var a = num(t.start, "Start"), b = num(t.end, "End"), st = num(t.step, "Step"), fs = funcs().filter(Boolean);
      if (!(st > 0)) throw new Error("Step must be > 0");
      if ((b - a) / st > 300) throw new Error("Too many rows — make the step bigger (max 300 rows)");
      if (!fs.length) throw new Error("Type a function in Graph (Y1–Y4) first");
      head = "<tr><th>x</th>" + fs.map(function(f){ return "<th style='color:" + COLORS[f.i] + "'>Y" + (f.i + 1) + "</th>"; }).join("") + "</tr>";
      for (var x = a, n = 0; x <= b + st * 1e-9 && n < 301; x = a + (++n) * st){
        var xx = +x.toPrecision(12);
        body += "<tr><td>" + F(xx) + "</td>" + fs.map(function(f){ return "<td>" + (f.error ? "—" : F(f.f(xx))) + "</td>"; }).join("") + "</tr>";
      }
    }catch(e){ msg = err(e); }
    return "<div class='gdc-grid3'>" + [["start", "Start"], ["end", "End"], ["step", "Step"]].map(function(k){ return "<label>" + k[1] + "<input data-tbl='" + k[0] + "' value='" + esc(t[k[0]]) + "'></label>"; }).join("") + "</div>" +
      "<div class='gdc-row'><button class='gdc-go' data-act='tbl'>Make table</button></div>" + msg +
      (body ? "<div class='gdc-tablewrap'><table class='gdc-table'>" + head + body + "</table></div>" : "") +
      "<p class='gdc-note'>The table uses the functions Y1–Y4 from the Graph tab.</p>";
  }

  /* ---------------- Stats ---------------- */
  function statsHTML(){
    return "<label class='gdc-lab'>List 1 <small>(x-values)</small><textarea data-st='l1' rows='3' placeholder='e.g. 3, 5, 7, 7, 8, 10'>" + esc(S.l1) + "</textarea></label>" +
      "<label class='gdc-lab'>List 2 <small>(y-values or frequencies)</small><textarea data-st='l2' rows='3' placeholder='optional'>" + esc(S.l2) + "</textarea></label>" +
      "<p class='gdc-note'>Separate values with spaces, commas or new lines. Use a point for decimals (2.5).</p>" +
      "<div class='gdc-row'><button class='gdc-go' data-act='onevar'>1-Variable</button><label class='gdc-check'><input type='checkbox' data-st='freq'" + (S.freq ? " checked" : "") + "> List 2 = frequencies</label></div>" +
      "<div class='gdc-row'><button class='gdc-go' data-act='twovar'>2-Variable</button><select data-st='reg'>" +
      [["linear", "Linear y = ax + b"], ["quad", "Quadratic"], ["exp", "Exponential y = a·bˣ"], ["power", "Power y = a·xᵇ"]].map(function(o){ return "<option value='" + o[0] + "'" + (S.reg === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      "</select></div><div id='stOut' class='gdc-out'></div>";
  }
  var lastReg = null;
  function oneVar(){
    var out = $("#stOut");
    try{
      var xs = list(S.l1, "List 1"), fs = S.freq ? list(S.l2, "List 2") : null;
      if (fs && fs.length !== xs.length) throw new Error("List 1 and List 2 must have the same number of values");
      var s = G.oneVar(xs, fs);
      out.innerHTML = row("x̄ (mean)", F(s.mean)) + row("Σx", F(s.sum)) + row("Σx²", F(s.sum2)) + row("σx (population SD)", F(s.sigma)) + row("sx (sample SD)", F(s.s)) +
        row("n", F(s.n)) + row("min", F(s.min)) + row("Q1", F(s.q1)) + row("Median", F(s.med)) + row("Q3", F(s.q3)) + row("max", F(s.max)) + row("IQR", F(s.q3 - s.q1)) + row("Range", F(s.max - s.min));
    }catch(e){ out.innerHTML = err(e); }
  }
  function twoVar(){
    var out = $("#stOut");
    try{
      var xs = list(S.l1, "List 1"), ys = list(S.l2, "List 2"), r = G.regression(xs, ys, S.reg); lastReg = r;
      var h = row("Model", r.eq) + row("a", F(r.a)) + row("b", F(r.b)) + (r.c !== undefined ? row("c", F(r.c)) : "") +
        (r.r !== undefined ? row("r", F(r.r)) : "") + row("r²", F(r.r2));
      if (S.reg === "linear") h += row("Spearman r<sub>s</sub>", F(G.spearman(xs, ys))) + row("x̄, ȳ", F(G.pearson(xs, ys).mx) + ", " + F(G.pearson(xs, ys).my));
      h += "<div class='gdc-row'><input data-st='est' class='gdc-short' placeholder='x' value='" + esc(S.est) + "'><button data-act='estimate'>Estimate y</button><span id='estOut'></span></div>" +
        "<div class='gdc-row'><button data-act='reg2graph'>Draw the model as Y1 in Graph</button></div>";
      out.innerHTML = h;
    }catch(e){ out.innerHTML = err(e); }
  }
  function regText(){
    var r = lastReg, a = G.fmt(r.a, 12).replace("−", "-"), b = G.fmt(r.b, 12).replace("−", "-");
    if (S.reg === "linear") return a + "x+(" + b + ")";
    if (S.reg === "quad") return a + "x^2+(" + b + ")x+(" + G.fmt(r.c, 12).replace("−", "-") + ")";
    if (S.reg === "exp") return a + "(" + b + ")^x";
    return a + "x^(" + b + ")";
  }

  /* ---------------- Dist ---------------- */
  var DTYPES = [["ncd", "Normal CD  P(a ≤ X ≤ b)"], ["inv", "Inverse Normal"], ["npd", "Normal PD"], ["bpd", "Binomial PD  P(X = x)"], ["bcd", "Binomial CD  P(a ≤ X ≤ b)"],
                ["chi", "χ² test for independence"], ["gof", "χ² goodness of fit"]];
  function fld(k, label, ph){ return "<label>" + label + "<input data-ds='" + k + "' value='" + esc(S.dist[k]) + "' placeholder='" + (ph || "") + "'></label>"; }
  function distHTML(){
    var d = S.dist, t = d.type, f = "";
    if (t === "ncd") f = fld("lo", "Lower", "-1E99") + fld("hi", "Upper", "1E99") + fld("mu", "μ (mean)") + fld("sd", "σ (SD)");
    if (t === "inv") f = "<label>Tail<select data-ds='tail'>" + [["left", "Left  P(X < x)"], ["right", "Right  P(X > x)"], ["center", "Central"]].map(function(o){ return "<option value='" + o[0] + "'" + (d.tail === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
      fld("area", "Area (probability)") + fld("mu", "μ (mean)") + fld("sd", "σ (SD)");
    if (t === "npd") f = fld("x", "x") + fld("mu", "μ (mean)") + fld("sd", "σ (SD)");
    if (t === "bpd") f = fld("x", "x") + fld("n", "n (trials)") + fld("p", "p");
    if (t === "bcd") f = fld("lo", "Lower", "0") + fld("hi", "Upper") + fld("n", "n (trials)") + fld("p", "p");
    if (t === "chi") f = "<label class='gdc-wide'>Observed table <small>(one row per line)</small><textarea data-ds='mat' rows='4' placeholder='20 30\n30 20'>" + esc(d.mat) + "</textarea></label>";
    if (t === "gof") f = "<label class='gdc-wide'>Observed<textarea data-ds='obs' rows='2' placeholder='18 22 20 40'>" + esc(d.obs) + "</textarea></label>" +
      "<label class='gdc-wide'>Expected<textarea data-ds='exp' rows='2' placeholder='25 25 25 25'>" + esc(d.exp) + "</textarea></label>" + fld("df", "df (blank = k − 1)");
    return "<select data-ds='type' class='gdc-wide'>" + DTYPES.map(function(o){ return "<option value='" + o[0] + "'" + (t === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
      "<div class='gdc-grid2'>" + f + "</div><div class='gdc-row'><button class='gdc-go' data-act='dist'>Execute</button></div><div id='dsOut' class='gdc-out'></div>" +
      (t === "ncd" || t === "bcd" ? "<p class='gdc-note'>For “X less than b” leave Lower as −1E99 (normal) or 0 (binomial).</p>" : "");
  }
  function dist(){
    var d = S.dist, out = $("#dsOut");
    try{
      var h = "";
      if (d.type === "ncd"){ var lo = num(d.lo, "Lower"), hi = num(d.hi, "Upper"), mu = num(d.mu, "μ"), sd = num(d.sd, "σ");
        h = row("p", F(G.normalCdf(lo, hi, mu, sd))) + row("z (lower)", isFinite(lo) && Math.abs(lo) < 1e90 ? F((lo - mu) / sd) : "−∞") + row("z (upper)", isFinite(hi) && Math.abs(hi) < 1e90 ? F((hi - mu) / sd) : "∞"); }
      if (d.type === "inv"){ var r = G.invNorm(num(d.area, "Area"), num(d.mu, "μ"), num(d.sd, "σ"), d.tail);
        h = r.x !== undefined ? row("x", F(r.x)) : row("x₁ (lower)", F(r.lo)) + row("x₂ (upper)", F(r.hi)); }
      if (d.type === "npd") h = row("f(x)", F(G.normalPdf(num(d.x, "x"), num(d.mu, "μ"), num(d.sd, "σ"))));
      if (d.type === "bpd"){ var n = num(d.n, "n"), p = num(d.p, "p"), x = num(d.x, "x"); h = row("P(X = " + F(x) + ")", F(G.binomPdf(x, n, p))) + row("E(X) = np", F(n * p)) + row("Var(X) = np(1−p)", F(n * p * (1 - p))); }
      if (d.type === "bcd"){ var n2 = num(d.n, "n"), p2 = num(d.p, "p"), a = d.lo.trim() === "" ? 0 : num(d.lo, "Lower"), b = d.hi.trim() === "" ? n2 : num(d.hi, "Upper");
        h = row("P(" + F(a) + " ≤ X ≤ " + F(b) + ")", F(G.binomCdf(a, b, n2, p2))); }
      if (d.type === "chi"){
        var rows = String(d.mat).split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l, i){ return list(l, "Row " + (i + 1)); });
        var c = G.chi2Independence(rows);
        h = row("χ² statistic", F(c.stat)) + row("p-value", F(c.p)) + row("df", F(c.df)) +
          "<div class='gdc-note'>Expected frequencies:</div><div class='gdc-tablewrap'><table class='gdc-table'>" + c.expected.map(function(r){ return "<tr>" + r.map(function(v){ return "<td>" + F(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
      }
      if (d.type === "gof"){ var g = G.chi2GOF(list(d.obs, "Observed"), list(d.exp, "Expected"), d.df.trim() ? num(d.df, "df") : 0);
        h = row("χ² statistic", F(g.stat)) + row("p-value", F(g.p)) + row("df", F(g.df)); }
      out.innerHTML = h;
    }catch(e){ out.innerHTML = err(e); }
  }

  /* ---------------- Equation ---------------- */
  function cin(k, label){ return "<label>" + label + "<input data-cf='" + k + "' value='" + esc(S.equa.coef[k] || "") + "'></label>"; }
  function equaHTML(){
    var q = S.equa, h = "<select data-eq='type' class='gdc-wide'>" + [["poly", "Polynomial  aₙxⁿ + … + a₀ = 0"], ["sim", "Simultaneous linear equations"], ["solve", "Solver  f(x) = g(x)"]]
      .map(function(o){ return "<option value='" + o[0] + "'" + (q.type === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>";
    if (q.type === "poly"){
      h += "<div class='gdc-row'>Degree <select data-eq='deg'>" + [2, 3, 4, 5, 6].map(function(n){ return "<option" + (q.deg === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></div><div class='gdc-grid3'>";
      for (var p = q.deg; p >= 0; p--) h += cin("p" + p, p === 0 ? "constant" : p === 1 ? "x" : "x" + ["", "", "²", "³", "⁴", "⁵", "⁶"][p]);
      h += "</div>";
    }
    if (q.type === "sim"){
      var v = ["x", "y", "z", "t"].slice(0, q.unk);
      h += "<div class='gdc-row'>Unknowns <select data-eq='unk'>" + [2, 3, 4].map(function(n){ return "<option" + (q.unk === n ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></div>";
      for (var r = 0; r < q.unk; r++){
        h += "<div class='gdc-eqrow'>" + v.map(function(n, c){ return "<input data-cf='s" + r + "_" + c + "' value='" + esc(q.coef["s" + r + "_" + c] || "") + "' aria-label='coefficient of " + n + " in equation " + (r + 1) + "'><span>" + n + (c < q.unk - 1 ? " +" : "") + "</span>"; }).join("") +
          "<span>=</span><input data-cf='s" + r + "_r' value='" + esc(q.coef["s" + r + "_r"] || "") + "' aria-label='right-hand side of equation " + (r + 1) + "'></div>";
      }
    }
    if (q.type === "solve"){
      h += "<label class='gdc-lab'>Equation in x<input data-eq='eq' value='" + esc(q.eq) + "' placeholder='e.g. 2^x = 3x + 1' autocomplete='off' spellcheck='false'></label>" +
        "<div class='gdc-grid2'><label>Lower x<input data-eq='lo' value='" + esc(q.lo) + "'></label><label>Upper x<input data-eq='hi' value='" + esc(q.hi) + "'></label></div>";
    }
    return h + "<div class='gdc-row'><button class='gdc-go' data-act='equa'>Solve</button></div><div id='eqOut' class='gdc-out'></div>";
  }
  function cplx(z){ if (z.im === 0) return F(z.re); var re = z.re === 0 ? "" : F(z.re) + (z.im < 0 ? " − " : " + "), im = Math.abs(z.im); return re + (z.re === 0 && z.im < 0 ? "−" : "") + (Math.abs(im - 1) < 1e-12 ? "" : F(im)) + "i"; }
  function equa(){
    var q = S.equa, out = $("#eqOut");
    try{
      if (q.type === "poly"){
        var c = []; for (var p = q.deg; p >= 0; p--) c.push(q.coef["p" + p] && String(q.coef["p" + p]).trim() !== "" ? num(q.coef["p" + p]) : 0);
        if (c[0] === 0) throw new Error("The coefficient of x" + (q.deg > 1 ? "^" + q.deg : "") + " cannot be 0");
        out.innerHTML = G.polyRoots(c).map(function(z, i){ return row("x" + "₁₂₃₄₅₆"[i], cplx(z)); }).join("");
      }
      if (q.type === "sim"){
        var M = [], R = [];
        for (var r = 0; r < q.unk; r++){ M.push([]); for (var k = 0; k < q.unk; k++) M[r].push(num(q.coef["s" + r + "_" + k] || "0")); R.push(num(q.coef["s" + r + "_r"] || "0")); }
        var s = G.simultaneous(M, R), v = ["x", "y", "z", "t"];
        out.innerHTML = s.unique ? s.x.map(function(val, i){ return row(v[i], F(val)); }).join("") : "<div class='gdc-note'><b>" + (s.infinite ? "Infinitely many solutions" : "No solution") + "</b></div>";
      }
      if (q.type === "solve"){
        var parts = String(q.eq).split("=");
        if (!q.eq.trim()) throw new Error("Type an equation in x");
        if (parts.length > 2) throw new Error("Use only one “=”");
        var L = G.compile(parts[0], env()), Rr = parts.length === 2 ? G.compile(parts[1], env()) : function(){ return 0; };
        G.parse(parts[0]); if (parts.length === 2) G.parse(parts[1]);
        var lo = num(q.lo, "Lower x"), hi = num(q.hi, "Upper x"); if (!(hi > lo)) throw new Error("Upper x must be bigger than Lower x");
        var rs = G.roots(function(x){ return L(x) - Rr(x); }, lo, hi, 20000);
        out.innerHTML = rs.length ? rs.slice(0, 12).map(function(x, i){ return row("x" + (rs.length > 1 ? " (" + (i + 1) + ")" : ""), F(x)); }).join("") + (rs.length > 12 ? "<div class='gdc-note'>…and more — narrow the range.</div>" : "")
          : "<div class='gdc-note'>No solution between " + F(lo) + " and " + F(hi) + ".</div>";
      }
    }catch(e){ out.innerHTML = err(e); }
  }

  /* ---------------- Finance (TVM) ---------------- */
  var TV = [["N", "N", "number of payments"], ["I", "I%", "annual interest rate"], ["PV", "PV", "present value"], ["PMT", "PMT", "payment each period"], ["FV", "FV", "future value"], ["PY", "P/Y", "payments per year"], ["CY", "C/Y", "compounding periods per year"]];
  function tvmHTML(){
    var t = S.tvm;
    return "<div class='gdc-tvm'>" + TV.map(function(f){
      var solvable = ["N", "I", "PV", "PMT", "FV"].indexOf(f[0]) >= 0;
      return "<label><b>" + f[1] + "</b><small>" + f[2] + "</small></label><input data-tv='" + f[0] + "' value='" + esc(t[f[0]]) + "'>" +
        (solvable ? "<button data-solve='" + f[0] + "'>Solve</button>" : "<span></span>");
    }).join("") + "</div>" +
      "<div class='gdc-row'><label class='gdc-check'><input type='radio' name='gdcpm' data-tv='end'" + (!t.bgn ? " checked" : "") + "> Payment at END</label><label class='gdc-check'><input type='radio' name='gdcpm' data-tv='bgn'" + (t.bgn ? " checked" : "") + "> at BEGIN</label></div>" +
      "<div id='tvOut' class='gdc-out'></div>" +
      "<p class='gdc-note'>Money you pay out (an investment, a payment) is negative; money you receive is positive. Example: €2000 at 3% compounded monthly for 5 years → N = 60, I% = 3, PV = −2000, PMT = 0, P/Y = C/Y = 12, then Solve FV.</p>";
  }
  function tvmSolve(k){
    var t = S.tvm, out = $("#tvOut"), o = {bgn: t.bgn};
    try{
      TV.forEach(function(f){ if (f[0] !== k) o[f[0]] = num(t[f[0]], f[1]); });
      var v = G.tvm(o, k);
      if (!isFinite(v)) throw new Error("No solution with these values");
      t[k] = G.fmt(v, 12).replace("−", "-"); save();
      var inp = panel.querySelector("[data-tv=" + k + "]"); inp.value = t[k]; inp.classList.add("gdc-solved"); setTimeout(function(){ inp.classList.remove("gdc-solved"); }, 1500);
      out.innerHTML = row(TV.filter(function(f){ return f[0] === k; })[0][1], F(v));
    }catch(e){ out.innerHTML = err(e); }
  }

  /* ---------------- events ---------------- */
  function onClick(e){
    var b = e.target.closest("button"); if (!b) return;
    var tab = b.getAttribute("data-tab"), key = b.getAttribute("data-key"), act = b.getAttribute("data-act"), rec = b.getAttribute("data-recall"), sv = b.getAttribute("data-solve");
    if (tab){ S.tab = tab; save(); render(); return; }
    if (key){ insert(key); return; }
    if (rec !== null){ var inp = $("#gdcIn"); inp.value = S.hist[+rec].e; inp.focus(); return; }
    if (sv){ tvmSolve(sv); return; }
    switch (act){
      case "close": close(); break;
      case "angle": S.deg = !S.deg; save(); if (S.tab === "run") { panel.querySelector("[data-act=angle]").textContent = S.deg ? "Deg" : "Rad"; } else render(); break;
      case "clearhist": S.hist = []; save(); render(); break;
      case "zin": zoomAt(Object.assign({}, S.win), 0.5, W / 2, H / 2); draw(); save(); syncWin(); break;
      case "zout": zoomAt(Object.assign({}, S.win), 2, W / 2, H / 2); draw(); save(); syncWin(); break;
      case "zstd": S.win = {xmin: -10, xmax: 10, ymin: -10, ymax: 10}; draw(); save(); syncWin(); break;
      case "zauto": autoY(); draw(); save(); syncWin(); break;
      case "gsolve": gsolve(); break;
      case "tbl": render(); break;
      case "onevar": oneVar(); break;
      case "twovar": twoVar(); break;
      case "estimate":
        try{ $("#estOut").textContent = "y = " + F(lastReg.f(num(S.est, "x"))); }catch(x){ $("#estOut").textContent = x.message; } break;
      case "reg2graph": S.ys[0] = {f: regText(), on: true}; S.tab = "graph"; save(); render(); break;
      case "dist": dist(); break;
      case "equa": equa(); break;
    }
  }
  function onInput(e){
    var el = e.target, a;
    if ((a = el.getAttribute("data-yf")) !== null){ S.ys[+a].f = el.value; gs.marks = []; gs.shade = null; gs.trace = null; save(); draw(); return; }
    if ((a = el.getAttribute("data-yon")) !== null){ S.ys[+a].on = el.checked; save(); draw(); return; }
    if ((a = el.getAttribute("data-win")) !== null){ try{ var v = num(el.value); S.win[a] = v; if (S.win.xmax > S.win.xmin && S.win.ymax > S.win.ymin){ save(); draw(); } }catch(x){} return; }
    if ((a = el.getAttribute("data-tbl")) !== null){ S.tbl[a] = el.value; save(); return; }
    if ((a = el.getAttribute("data-st")) !== null){ S[a] = el.type === "checkbox" ? el.checked : el.value; save(); return; }
    if ((a = el.getAttribute("data-ds")) !== null){ S.dist[a] = el.value; save(); if (a === "type" && e.type === "change") render(); return; }
    if ((a = el.getAttribute("data-eq")) !== null){ S.equa[a] = (a === "deg" || a === "unk") ? +el.value : el.value; save(); if ((a === "type" || a === "deg" || a === "unk") && e.type === "change") render(); return; }
    if ((a = el.getAttribute("data-cf")) !== null){ S.equa.coef[a] = el.value; save(); return; }
    if ((a = el.getAttribute("data-tv")) !== null){ if (a === "end" || a === "bgn") S.tvm.bgn = a === "bgn"; else S.tvm[a] = el.value; save(); return; }
    if (el.id === "gsT"){ gsTypeUI(); return; }
  }

  window.CLCGDC = {open: open, close: close, toggle: toggle};
})();
