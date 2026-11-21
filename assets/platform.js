/* ===== CLC IB Practice — platform code (shared by the home page and the course pages) =====
   The home page (index.html) is public: it only lists the courses.
   Each course page (aa-sl.html, aa-hl.html, ai-sl.html) holds that course's material and quizzes and is published
   ENCRYPTED with its own weekly password (tools/build-encrypted-site.mjs). This file has no course material in it. */
(function(){
  "use strict";

  var COURSES = {
    "aa-sl": {title: "Math AA SL", full: "Analysis & Approaches SL", icon: "📘", color: "practice", href: "aa-sl.html"},
    "aa-hl": {title: "Math AA HL", full: "Analysis & Approaches HL", icon: "📕", color: "full", href: "aa-hl.html"},
    "ai-sl": {title: "Math AI SL", full: "Applications & Interpretation SL", icon: "📗", color: "english", href: "ai-sl.html"}
  };
  var ORDER = ["aa-sl", "aa-hl", "ai-sl"];
  var TOPICS = [
    {n: 1, key: "t1", label: "Number & Algebra", icon: "🔢"},
    {n: 2, key: "t2", label: "Functions", icon: "ƒ"},
    {n: 3, key: "t3", label: "Geometry & Trigonometry", icon: "📐"},
    {n: 4, key: "t4", label: "Statistics & Probability", icon: "📊"},
    {n: 5, key: "t5", label: "Calculus", icon: "∫"}
  ];
  var KINDS = [
    {key: "theory", label: "Theory & Notes", icon: "📚"},
    {key: "practice", label: "Worksheets & Practice", icon: "✏️"},
    {key: "test", label: "Topic Tests", icon: "📝"}
  ];
  var LETTERS = ["A", "B", "C", "D"];
  var LOGO = "clc-logo.png";

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c]; }); }
  function ls(k, v){ try{ if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } }

  /* ---------------- theme (light / dark) ---------------- */
  function systemDark(){ return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
  function currentTheme(){ var t = ls("clc_theme"); return t === "dark" || t === "light" ? t : (systemDark() ? "dark" : "light"); }
  function applyTheme(){ document.documentElement.setAttribute("data-theme", currentTheme()); }
  window.clcToggleTheme = function(){
    ls("clc_theme", currentTheme() === "dark" ? "light" : "dark"); applyTheme();
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-btn]"), function(b){ b.innerHTML = themeIcon(); });
  };
  function themeIcon(){ return currentTheme() === "dark" ? "☀️" : "🌙"; }
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(){ if (!ls("clc_theme")) applyTheme(); });
  applyTheme();
  window.clcGDC = function(){ if (window.CLCGDC) window.CLCGDC.toggle(); };
  function tools(){
    return "<div class='tb-tools'>" +
      "<button class='tb-btn' onclick='clcGDC()' aria-label='Open the GDC calculator' title='GDC calculator'>🧮 GDC</button>" +
      "<button class='tb-btn' data-theme-btn onclick='clcToggleTheme()' aria-label='Light or dark mode' title='Light / dark mode'>" + themeIcon() + "</button></div>";
  }

  function typeset(el){
    if (window.renderMathInElement){
      try{ window.renderMathInElement(el, {delimiters: [{left: "$", right: "$", display: false}], throwOnError: false}); }catch(e){}
    }
  }
  function footer(){
    var f = document.createElement("footer"); f.className = "foot";
    f.textContent = "CLC IB Practice — independent study tool, not affiliated with the International Baccalaureate Organization.";
    return f;
  }

  /* ================= HOME (public) ================= */
  function startHome(){
    var app = document.getElementById("app");
    var tiles = ORDER.map(function(c){
      var s = COURSES[c];
      return "<a class='tile-col' href='" + s.href + "'>" +
        "<div class='icon' style='background:var(--" + s.color + "-soft); color:var(--" + s.color + ");'>" + s.icon + "</div>" +
        "<strong>" + esc(s.title) + "</strong><span>" + esc(s.full) + "</span><span class='lock-ico'>🔒 own password</span></a>";
    }).join("");
    app.innerHTML = "<div class='floating-tools'>" + tools() + "</div><main>" +
      "<div class='home-hero'><img src='" + LOGO + "' alt='CLC'><h1 class='display'><b>CLC</b> IB Practice</h1>" +
      "<p>IB Diploma Mathematics. Choose your course — each course has its own password, which changes every Monday. Ask your teacher for it.</p></div>" +
      "<p class='eyebrow' style='margin-top:22px;'>Choose your course</p><div class='section-grid'>" + tiles + "</div>" +
      "<div class='card' style='margin-top:16px;'><p class='eyebrow' style='margin:0 0 6px;'>🧮 GDC</p>" +
      "<p class='note'>A graphing calculator with Run, Graph, Table, Stats, Distributions, Equation and Finance modes is available on every page — press <b>GDC</b> at the top.</p></div>" +
      "</main>";
    app.querySelector("main").appendChild(footer());
  }

  /* ================= COURSE (encrypted page) ================= */
  function startCourse(data){
    var C = data.id, meta = COURSES[C], RES = data.resources || [], QUIZ = data.quiz || {};
    var PRACTICE = (data.practice || []).filter(function(s){ return !(data.practiceLevel === "SL" && s.level === "HL only"); });
    var state = {nav: []};

    function getUser(){ return ls("clc_ib_user"); }
    function go(screen, params){ state.nav.push({screen: screen, params: params || {}}); render(); window.scrollTo(0, 0); }
    function back(){ if (state.nav.length > 1){ state.nav.pop(); render(); window.scrollTo(0, 0); } else location.href = "index.html"; }
    function top(){ return state.nav[state.nav.length - 1]; }
    window.go = go; window.back = back;

    function res(topic, kind){ return RES.filter(function(r){ return (!topic || r.topic === topic) && (!kind || r.kind === kind); }); }
    function quizFor(t){ return QUIZ[t] || []; }
    function bestKey(t){ return "clc_ib_best_" + C + "_" + t; }
    function getBest(t){ try{ var v = ls(bestKey(t)); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
    function setBest(t, correct, total){ var b = getBest(t); if (!b || correct / total > b.c / b.n) ls(bestKey(t), JSON.stringify({c: correct, n: total})); }
    function topicById(k){ return TOPICS.filter(function(x){ return x.key === k; })[0]; }

    function render(){
      var t = top(), app = document.getElementById("app");
      document.body.classList.toggle("signin-page", t.screen === "signin");
      if (t.screen === "signin"){
        app.innerHTML = "<div class='floating-tools'>" + tools() + "</div><main id='screenContent' style='padding:20px 0 48px;'>" + screenSignin() + "</main>";
        return;
      }
      app.innerHTML = "<div class='topbar'>" +
        (state.nav.length > 1 ? "<button class='backbtn' onclick='back()' aria-label='Back'>←</button>"
                              : "<a class='backbtn' href='index.html' aria-label='All courses' title='All courses'>←</a>") +
        "<img class='topbar-logo' src='" + LOGO + "' alt=''><h1>" + esc(title(t)) + "</h1>" + tools() + "</div><main id='screenContent'></main>";
      var main = document.getElementById("screenContent");
      main.innerHTML = screen(t);
      typeset(main);
      if (t.screen === "course") main.appendChild(footer());
    }
    function title(t){
      switch (t.screen){
        case "topic": return meta.title + " · " + topicById(t.params.t).label;
        case "mock": return meta.title + " · Mock Exams";
        case "quiz": return t.params.title;
        case "quizresult": return t.params.title + " — Results";
        case "practice": return t.params.sec + " · Practice";
        case "papers": return meta.title + " · IB-style Papers";
        case "paper": return meta.title + " · " + (paperById(t.params.id) || {}).title;
        default: return meta.title;
      }
    }
    function screen(t){
      switch (t.screen){
        case "course": return screenCourse();
        case "topic": return screenTopic(t.params.t);
        case "mock": return screenMock();
        case "quiz": return screenQuiz(t.params);
        case "quizresult": return screenQuizResult(t.params);
        case "practice": return screenPractice(t.params);
        case "papers": return screenPapers();
        case "paper": return screenPaper(t.params);
      }
      return "<p>Not found.</p>";
    }

    function screenSignin(){
      return "<div class='signin-card'><img class='signin-logo' src='" + LOGO + "' alt='CLC'>" +
        "<h2 class='signin-brand'><b>CLC</b> IB Practice</h2><div class='signin-divider'></div>" +
        "<h1 class='display signin-title'>Sign in to continue</h1>" +
        "<p class='signin-sub'>" + esc(meta.title) + " — " + esc(meta.full) + ".</p>" +
        "<div class='signin-row2'>" +
        "<input class='field' id='nameField' placeholder='Full name' maxlength='40' onkeydown=\"if(event.key==='Enter')clcSignin()\">" +
        "<input class='field' id='classField' placeholder='Class / Τμήμα' maxlength='24' onkeydown=\"if(event.key==='Enter')clcSignin()\"></div>" +
        "<p id='signinError' class='signin-error' hidden></p>" +
        "<button class='btn signin-btn' onclick='clcSignin()'>Sign In</button></div>";
    }
    window.clcSignin = function(){
      var v = document.getElementById("nameField").value.replace(/\s+/g, " ").trim(), errEl = document.getElementById("signinError");
      if (v.split(" ").length < 2){ errEl.textContent = "Γράψε ονοματεπώνυμο (όνομα και επώνυμο)."; errEl.hidden = false; return; }
      ls("clc_ib_user", v);
      var cls = document.getElementById("classField"); ls("clc_ib_class", cls ? cls.value.replace(/\s+/g, " ").trim().slice(0, 24) : "");
      state.nav = [{screen: "course", params: {}}]; render();
    };
    window.clcSignout = function(){ ls("clc_ib_user", null); state.nav = [{screen: "signin", params: {}}]; render(); };

    function countLabel(n){ return n ? n + (n === 1 ? " resource" : " resources") : "Coming soon"; }
    function screenCourse(){
      var u = getUser() || "";
      var html = "<div class='card' style='position:relative;'><div class='subject-strip' style='background:var(--" + meta.color + ");'></div>" +
        "<p class='eyebrow' style='color:var(--" + meta.color + ");'>" + meta.icon + " " + esc(meta.full) + "</p>" +
        "<p class='note'>Welcome, <b>" + esc(u) + "</b>! Organised by the five IB syllabus topics: interactive quizzes, theory, worksheets and topic tests.</p>" +
        "<button class='signout' onclick='clcSignout()'>Not you? Change name</button></div>" +
        "<p class='eyebrow'>Syllabus topics</p><div class='topic-grid'>";
      TOPICS.forEach(function(tp){
        var n = res(tp.key).length, q = quizFor(tp.key).length, b = getBest(tp.key);
        html += "<button class='tile-col' onclick=\"go('topic',{t:'" + tp.key + "'})\">" +
          "<div class='icon' style='background:var(--" + meta.color + "-soft); color:var(--" + meta.color + ");'>" + tp.icon + "</div>" +
          "<strong>Topic " + tp.n + " · " + esc(tp.label) + "</strong>" +
          "<span class='count-pill'>" + [q ? "🧠 Quiz" + (b ? " " + b.c + "/" + b.n : "") : "", n || !q ? countLabel(n) : ""].filter(Boolean).join(" · ") + "</span></button>";
      });
      html += "</div><p class='eyebrow'>Exam practice</p>";
      var mb = getBest("mixed");
      html += "<button class='tile' onclick=\"startQuiz('mixed')\"><div class='icon' style='background:var(--" + meta.color + "-soft); color:var(--" + meta.color + ");'>🧠</div>" +
        "<div class='body'><strong>Mixed Interactive Quiz</strong><span>10 random questions from all 5 topics" + (mb ? " · Best: " + mb.c + "/" + mb.n : "") + "</span></div><div class='chev'>→</div></button>";
      if (PAPERS.length) html += "<button class='tile' onclick=\"go('papers')\"><div class='icon' style='background:var(--accent-soft); color:var(--accent);'>📝</div>" +
        "<div class='body'><strong>IB-style Papers</strong><span>" + PAPERS.map(function(x){ return x.title; }).join(", ") + " · timed, in the official format, new numbers every attempt</span></div><div class='chev'>→</div></button>";
      html += "<button class='tile' onclick=\"go('mock')\"><div class='icon' style='background:var(--accent-soft); color:var(--accent);'>🎯</div>" +
        "<div class='body'><strong>Mock Exams</strong><span>Full papers mixing all topics · " + countLabel(res("mock").length) + "</span></div><div class='chev'>→</div></button>";
      return html;
    }
    function resTile(r, color, icon){
      if (r.pdf){                                  // slides: view as PDF or download the PowerPoint (both encrypted per course)
        return "<div class='tile'><div class='icon' style='background:var(--" + color + "-soft); color:var(--" + color + ");'>" + icon + "</div>" +
          "<div class='body'><strong>" + esc(r.label) + "</strong><div class='file-links'>" +
          "<a class='file-btn' href='" + esc(r.pdf) + "'>📖 View slides</a></div></div></div>";
      }
      if (r.page){                                 // an interactive page kept encrypted with the course (opens in a new tab)
        return "<a class='tile' href='" + esc(r.page) + "'><div class='icon' style='background:var(--" + color + "-soft); color:var(--" + color + ");'>" + icon + "</div>" +
          "<div class='body'><strong>" + esc(r.label) + "</strong><span>" + esc(r.note || "Interactive practice") + "</span></div><div class='chev'>↗</div></a>";
      }
      var tag = r.sol === true ? "<span class='res-tag sol'>Solutions</span>" : (r.sol === false ? "<span class='res-tag unsolved'>Unsolved</span>" : "");
      return "<a class='tile' href='" + esc(r.href) + "' target='_blank' rel='noopener'><div class='icon' style='background:var(--" + color + "-soft); color:var(--" + color + ");'>" + icon + "</div>" +
        "<div class='body'><strong>" + esc(r.label) + tag + "</strong><span>Opens in a new tab</span></div><div class='chev'>↗</div></a>";
    }
    function screenTopic(t){
      var tp = topicById(t), html = "<div class='card' style='position:relative;'><div class='subject-strip' style='background:var(--" + meta.color + ");'></div>" +
        "<p class='eyebrow' style='color:var(--" + meta.color + ");'>" + tp.icon + " Topic " + tp.n + "</p><h2 style='margin:0; font-size:22px;'>" + esc(tp.label) + "</h2></div>";
      var qn = quizFor(t).length;
      if (qn){
        var bb = getBest(t);
        html += "<p class='eyebrow' style='margin-top:18px;'>🧠 Interactive Quiz</p><button class='tile' onclick=\"startQuiz('" + t + "')\">" +
          "<div class='icon' style='background:var(--accent-soft); color:var(--accent);'>🧠</div><div class='body'><strong>Topic " + tp.n + " Quiz</strong>" +
          "<span>" + qn + " questions · instant feedback & full explanations" + (bb ? " · Best: " + bb.c + "/" + bb.n : "") + "</span></div><div class='chev'>→</div></button>";
      }
      var secs = PRACTICE.filter(function(s){ return s.topic === t; });
      if (secs.length){
        html += "<p class='eyebrow' style='margin-top:18px;'>✍️ Practice quizzes by subtopic</p>";
        secs.forEach(function(s){
          var b = pBest(s.sec), poss = s.qs.length;
          html += "<button class='tile' onclick=\"go('practice',{sec:'" + s.sec + "',i:0})\"><div class='icon' style='background:var(--" + meta.color + "-soft); color:var(--" + meta.color + ");'>✍️</div>" +
            "<div class='body'><strong>" + esc(s.sec + " " + s.title) + "</strong><span>" + poss + " exam-style questions · type your answers · mark scheme" +
            (b ? " · Best: " + b.e + "/" + b.p + " marks" : "") + "</span></div><div class='chev'>→</div></button>";
        });
      }
      KINDS.forEach(function(k){
        var list = res(t, k.key);
        html += "<p class='eyebrow' style='margin-top:18px;'>" + k.icon + " " + k.label + "</p>";
        html += list.length ? list.map(function(r){ return resTile(r, meta.color, k.icon); }).join("") : "<div class='card' style='padding:14px 18px;'><p class='note'>Coming soon.</p></div>";
      });
      return html;
    }
    function screenMock(){
      var list = res("mock");
      return "<div class='card' style='position:relative;'><div class='subject-strip' style='background:var(--accent);'></div><p class='eyebrow' style='color:var(--accent);'>🎯 Mock Exams</p>" +
        "<p class='note'>Exam-style papers across the whole syllabus. Time yourself as in the real exam.</p></div>" +
        (list.length ? list.map(function(r){ return resTile(r, "accent", "🎯"); }).join("") : "<div class='empty'><div class='big'>📂</div>No mock exams yet.<br>They will appear here soon.</div>");
    }

    /* ---------- quiz ---------- */
    function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
    window.startQuiz = function(t){
      var qs, ttl;
      if (t === "mixed"){ var all = []; TOPICS.forEach(function(tp){ quizFor(tp.key).forEach(function(q){ all.push(q); }); }); qs = shuffle(all).slice(0, 10); ttl = meta.title + " · Mixed Quiz"; }
      else { qs = quizFor(t); ttl = meta.title + " · Topic " + topicById(t).n + " Quiz"; }
      go("quiz", {t: t, title: ttl, qs: qs, i: 0, picked: null, correct: 0});
    };
    function screenQuiz(p){
      var q = p.qs[p.i], html = "<div class='progress-dots'>";
      for (var k = 0; k < p.qs.length; k++) html += "<span class='" + (k < p.i ? "done" : (k === p.i ? "current" : "")) + "'></span>";
      html += "</div><div style='display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;'>" +
        "<span class='eyebrow' style='margin:0;'>Question " + (p.i + 1) + " of " + p.qs.length + "</span><span class='badge " + q.diff.toLowerCase() + "'>" + esc(q.diff) + "</span></div>" +
        "<p class='qstem'>" + esc(q.stem) + "</p>";
      q.choices.forEach(function(ch, idx){
        var cls = "choice";
        if (p.picked !== null){ if (idx === q.correct) cls += " correct"; else if (idx === p.picked) cls += " incorrect"; }
        html += "<button class='" + cls + "' " + (p.picked === null ? "onclick='quizPick(" + idx + ")'" : "disabled") + "><span class='letter'>" + LETTERS[idx] + "</span><span>" + esc(ch) + "</span></button>";
      });
      if (p.picked !== null){
        var ok = p.picked === q.correct;
        html += "<div class='explain-panel'><div class='row2'><span class='verdict " + (ok ? "ok" : "no") + "'>" + (ok ? "✓ Correct!" : "✗ Not quite — the answer is " + LETTERS[q.correct]) + "</span></div>" +
          "<div class='explain-block'><b>Key idea</b>" + esc(q.rule) + "</div><div class='explain-block'><b>Working</b>" + esc(q.why) + "</div>" +
          "<div class='explain-block'><b>Tip</b>" + esc(q.tip) + "</div><div class='explain-block'><b>Common trap</b>" + esc(q.trap) + "</div>" +
          "<div class='explain-block'><b>Why the other answers are wrong</b></div>" +
          q.poe.map(function(e){ return "<div class='poe-item'><b>" + e.letter + ".</b> " + esc(e.text) + "</div>"; }).join("") +
          "</div><button class='btn primary' onclick='quizNext()'>" + (p.i + 1 < p.qs.length ? "Next Question →" : "See Results") + "</button>";
      }
      return html;
    }
    window.quizPick = function(idx){ var p = top().params; if (p.picked !== null) return; p.picked = idx; if (idx === p.qs[p.i].correct) p.correct++; render(); };
    window.quizNext = function(){
      var p = top().params;
      if (p.i + 1 >= p.qs.length){
        setBest(p.t, p.correct, p.qs.length);
        state.nav[state.nav.length - 1] = {screen: "quizresult", params: {t: p.t, title: p.title, correct: p.correct, total: p.qs.length}};
      } else { p.i++; p.picked = null; }
      render(); window.scrollTo(0, 0);
    };
    function screenQuizResult(p){
      var pct = Math.round(100 * p.correct / p.total), b = getBest(p.t);
      var msg = pct >= 80 ? "Excellent work — you're exam-ready on this one! 🎉" : (pct >= 50 ? "Good effort — review the explanations and try again." : "Keep going — revisit the theory notes, then retry.");
      return "<div class='score-hero'><div class='num mono'>" + p.correct + "/" + p.total + "</div><div class='lbl'>" + pct + "% correct" + (b ? " · Best: " + b.c + "/" + b.n : "") + "</div></div>" +
        "<p style='text-align:center; color:var(--muted); font-size:14px; margin:0 0 18px;'>" + msg + "</p>" +
        "<button class='btn primary' onclick=\"back(); startQuiz('" + p.t + "')\">Try Again</button><div style='height:10px;'></div>" +
        "<button class='btn ghost' onclick='back()'>← Back</button>";
    }


    /* ---------- practice quizzes (typed answers, mark scheme, new variants) ---------- */
    function pBestKey(sec){ return "clc_ib_pr_" + C + "_" + sec; }
    function pBest(sec){ try{ var v = ls(pBestKey(sec)); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
    function pSave(sec, e, p){ var b = pBest(sec); if (!b || e / p > b.e / b.p) ls(pBestKey(sec), JSON.stringify({e: e, p: p})); }
    var PSTATE = {};                                 // per section: {seeds:[], res:{qi:{pi:{v,ok,shown}}}}
    function secById(id){ return PRACTICE.filter(function(s){ return s.sec === id; })[0]; }
    function pst(sec){ if (!PSTATE[sec]) PSTATE[sec] = {seeds: [], res: {}}; return PSTATE[sec]; }
    function instQ(sec, qi){
      var S = secById(sec), st = pst(sec), T = S.qs[qi];
      if (st.seeds[qi] === undefined) st.seeds[qi] = 1 + Math.floor(Math.random() * 1e6);
      for (var k = 0; k < 40; k++){ try{ var q = T.gen(window.CLCP.H.mk(st.seeds[qi] + k * 7919)); if (q) return q; }catch(e){} }
      return null;
    }
    function parseAns(s){
      s = String(s).trim().replace(/−/g, "-").replace(/\s+/g, "");
      if (!s) return NaN;
      if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
      var m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/); if (m) return +m[1] / +m[2];
      m = s.match(/^-?\d*\.?\d+(?:e-?\d+)?$/i); return m ? +s : NaN;
    }
    function close(u, a, tol){ if (!isFinite(u)) return false; if (Math.abs(u - a) <= tol) return true; return !Number.isInteger(a) && tol <= 1e-6 && Math.abs(u - a) <= 0.0005 * Math.abs(a); }
    function checkPart(part, raw){
      var want = [].concat(part.a), tol = part.tol == null ? 1e-6 : part.tol;
      var got = String(raw).split(/[;]|,(?=\s*-?\d)(?!\d{3}\b)/).map(parseAns).filter(function(x){ return !isNaN(x); });
      if (want.length === 1) return got.length === 1 && close(got[0], want[0], tol);
      if (got.length !== want.length) return false;
      var used = [];
      return want.every(function(w){ for (var i = 0; i < got.length; i++) if (used.indexOf(i) < 0 && close(got[i], w, tol)){ used.push(i); return true; } return false; });
    }
    function ansText(pt){ return pt.show || [].concat(pt.a).map(function(x){ return Number.isInteger(x) ? x : +x.toPrecision(6); }).join("; "); }
    function screenPractice(p){
      var S = secById(p.sec); if (!S) return "<p>Not found.</p>";
      var qi = p.i, T = S.qs[qi], q = instQ(p.sec, qi), st = pst(p.sec), R = st.res[qi] = st.res[qi] || {};
      if (!q) return "<p>This question could not be generated. Press New variant.</p>";
      var max = q.parts.reduce(function(a, x){ return a + x.m; }, 0);
      var html = "<div class='card' style='position:relative;'><div class='subject-strip' style='background:var(--" + meta.color + ");'></div>" +
        "<p class='eyebrow' style='color:var(--" + meta.color + ");'>✍️ " + esc(S.sec + " " + S.title) + "</p>" +
        "<div class='pq-nav'>" + S.qs.map(function(x, k){ return "<button class='pq-dot" + (k === qi ? " on" : "") + (st.res[k] && Object.keys(st.res[k]).length ? " done" : "") + "' onclick='pGo(" + k + ")'>" + (k + 1) + "</button>"; }).join("") + "</div></div>";
      html += "<div class='card pq-card'><div class='pq-head'><b>Question " + (qi + 1) + "</b><span class='badge " + T.diff.toLowerCase() + "'>" + esc(T.diff) + "</span><span class='pq-max'>[Maximum mark: " + max + "]</span>" +
        "<button class='btn ghost pq-var' onclick='pVariant()'>↻ New variant</button></div>";
      html += "<div class='pq-stem'>" + q.stem + "</div>";
      q.parts.forEach(function(part, pi){
        var r = R[pi] || {};
        html += "<div class='pq-part'><div class='pq-q'>" + (q.parts.length > 1 ? "<b>(" + "abcdef"[pi] + ")</b> " : "") + part.q + "<span class='pq-m'>[" + part.m + "]</span></div>" +
          "<div class='pq-row'><input class='field pq-in' id='pin" + pi + "' value='" + esc(r.v || "") + "' placeholder='answer' " + (r.ok ? "disabled" : "") + " onkeydown=\"if(event.key==='Enter')pCheck(" + pi + ")\">" +
          "<button class='btn primary pq-btn' onclick='pCheck(" + pi + ")' " + (r.ok ? "disabled" : "") + ">Check</button>" +
          "<button class='btn ghost pq-btn' onclick='pShow(" + pi + ")'>" + (r.shown ? "Hide" : "Show") + " mark scheme</button></div>" +
          (r.v !== undefined && r.tried ? "<div class='pq-fb " + (r.ok ? "ok" : "no") + "'>" + (r.ok ? "✓ Correct — " + part.m + "/" + part.m + " marks" : "✗ Not yet — check your working or open the mark scheme") + "</div>" : "") +
          (r.shown ? "<div class='pq-ms'><b>Mark scheme</b><ol>" + part.sol.map(function(x){ return "<li>" + x + "</li>"; }).join("") + "</ol>" +
            "<div class='pq-final'>Answer: " + ansText(part) + "</div></div>" : "") + "</div>";
      });
      var earned = 0, poss = 0;
      S.qs.forEach(function(x, k){ var rr = st.res[k]; if (!rr) return; var qq = instQ(p.sec, k); if (!qq) return; qq.parts.forEach(function(pt, j){ if (rr[j] && (rr[j].tried || rr[j].shown)){ poss += pt.m; if (rr[j].ok) earned += pt.m; } }); });
      html += "<div class='pq-sum'>Score so far: <b>" + earned + " / " + poss + "</b> marks</div></div>";
      html += "<div class='pq-pn'><button class='btn ghost' " + (qi === 0 ? "disabled" : "") + " onclick='pGo(" + (qi - 1) + ")'>‹ Prev</button>" +
        "<button class='btn primary' onclick='" + (qi + 1 < S.qs.length ? "pGo(" + (qi + 1) + ")" : "back()") + "'>" + (qi + 1 < S.qs.length ? "Next ›" : "Finish") + "</button></div>" +
        "<p class='note' style='margin-top:10px;'>Type numbers, fractions (3/4) or decimals; give non-exact answers to 3 significant figures. For two answers type them with a semicolon, e.g. <b>2; −3</b>.</p>";
      if (poss) pSave(p.sec, earned, poss);
      return html;
    }
    window.pGo = function(k){ var p = top().params; p.i = k; render(); window.scrollTo(0, 0); };
    window.pVariant = function(){ var p = top().params, st = pst(p.sec); st.seeds[p.i] = 1 + Math.floor(Math.random() * 1e6); st.res[p.i] = {}; render(); };
    window.pCheck = function(pi){
      var p = top().params, q = instQ(p.sec, p.i), st = pst(p.sec), R = st.res[p.i] = st.res[p.i] || {}, v = document.getElementById("pin" + pi).value;
      R[pi] = R[pi] || {}; R[pi].v = v; R[pi].tried = true; R[pi].ok = checkPart(q.parts[pi], v); render();
    };
    window.pShow = function(pi){
      var p = top().params, st = pst(p.sec), R = st.res[p.i] = st.res[p.i] || {}, el = document.getElementById("pin" + pi);
      R[pi] = R[pi] || {}; if (el && !R[pi].ok) R[pi].v = el.value; R[pi].shown = !R[pi].shown; render();
    };
    /* ---------- IB-style papers (timed, whole paper on one page, marked at the end) ---------- */
    var PAPERS = data.papers || [], PAST = {};
    function paperById(id){ return PAPERS.filter(function(x){ return x.id === id; })[0]; }
    function paKey(id){ return "clc_ib_pp_" + C + "_" + id; }
    function paBest(id){ try{ var v = ls(paKey(id)); return v ? JSON.parse(v) : null; }catch(e){ return null; } }
    function paSave(id, e, p){ var b = paBest(id); if (!b || e / p > b.e / b.p) ls(paKey(id), JSON.stringify({e: e, p: p})); }
    function shuffle(a){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function genQ(T){ var s = 1 + Math.floor(Math.random() * 1e6); for (var k = 0; k < 40; k++){ try{ var q = T.gen(window.CLCP.H.mk(s + k * 7919)); if (q) return q; }catch(e){} } return null; }
    function makePaper(P){
      var out = [];
      P.sections.forEach(function(S){
        var pool = shuffle(S.pool().slice()), used = {}, got = [], want = S.count * (S.merge || 1);
        for (var i = 0; i < pool.length && got.length < want; i++){
          var it = pool[i]; if (it.from && used[it.from]) continue;
          var q = genQ(it.t); if (!q) continue;
          if (it.from) used[it.from] = 1; got.push({from: it.from || "", q: q});
        }
        if (S.merge){                                // short questions are paired (same topic first) into one IB-sized question
          got.sort(function(a, b){ return parseFloat(a.from) - parseFloat(b.from); });
          var g2 = [];
          for (var j = 0; j < got.length; j += S.merge){
            var parts = [];
            got.slice(j, j + S.merge).forEach(function(g){ g.q.parts.forEach(function(pt, k){ var c = {}; for (var x in pt) c[x] = pt[x]; if (!k && g.q.stem) c.q = "<div class='pa-sub'>" + g.q.stem + "</div>" + c.q; parts.push(c); }); });
            g2.push({q: {stem: "", parts: parts}});
          }
          got = g2;
        }
        got.forEach(function(g){ out.push({section: S.name, q: g.q, max: g.q.parts.reduce(function(a, x){ return a + x.m; }, 0)}); });
      });
      return {qs: out, start: Date.now(), done: false, ans: {}, self: {}, ok: {}};
    }
    function paGrade(pc){ var b = [[70, 7], [57, 6], [45, 5], [34, 4], [22, 3], [10, 2]]; for (var i = 0; i < b.length; i++) if (pc >= b[i][0]) return b[i][1]; return 1; }
    function paScore(st){ var e = 0, p = 0; st.qs.forEach(function(Q, qi){ Q.q.parts.forEach(function(pt, pi){ var k = qi + "_" + pi; p += pt.m; e += pt.self ? (+st.self[k] || 0) : (st.ok[k] ? pt.m : 0); }); }); return {e: e, p: p}; }
    function paOpts(m, v){ var o = ""; for (var i = 0; i <= m; i++) o += "<option" + (i === v ? " selected" : "") + ">" + i + "</option>"; return o; }
    function fmtTime(ms){ var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); }
    function screenPapers(){
      var html = "<div class='card' style='position:relative;'><div class='subject-strip' style='background:var(--accent);'></div>" +
        "<p class='eyebrow' style='color:var(--accent);'>📝 IB-style papers</p><h2 style='margin:0 0 6px; font-size:22px;'>Exam papers in the IB format</h2>" +
        "<p class='note'>Every paper follows the timing, sections and marks of the real IB papers. Each attempt is a new paper with new numbers. " +
        "Answer every question, press <b>Finish &amp; mark</b>, then read the mark scheme. Questions that ask you to show or prove something are marked by you.</p></div>";
      PAPERS.forEach(function(P){
        var b = paBest(P.id), st = PAST[P.id], live = st && !st.done;
        html += "<div class='tile pa-tile'><div class='icon' style='background:var(--accent-soft); color:var(--accent);'>" + (P.gdc ? "🧮" : "✏️") + "</div>" +
          "<div class='body'><strong>" + esc(meta.title + " — " + P.title) + "</strong><span>" + esc(P.sub) + " · " + P.time + " minutes" +
          (b ? " · Best: " + b.e + "/" + b.p + " (" + Math.round(100 * b.e / b.p) + "%)" : "") + "</span>" +
          "<div class='file-links'>" + (live ? "<button class='file-btn' onclick=\"go('paper',{id:'" + P.id + "'})\">▶ Continue</button>" : "") +
          "<button class='file-btn' onclick=\"paNew('" + P.id + "')\">" + (live ? "New paper" : "▶ Start paper") + "</button></div></div></div>";
      });
      return html;
    }
    function screenPaper(p){
      var P = paperById(p.id), st = PAST[p.id]; if (!P || !st) return "<p>Not found.</p>";
      if (!P.gdc && !st.done) setTimeout(function(){ document.querySelectorAll("button[onclick='clcGDC()']").forEach(function(b){ b.style.display = "none"; }); if (window.CLCGDC && window.CLCGDC.close) window.CLCGDC.close(); }, 0);
      var sc = paScore(st), html = "<div class='card pa-head'><div class='subject-strip' style='background:var(--accent);'></div>" +
        "<p class='eyebrow' style='color:var(--accent);'>" + esc(meta.full) + "</p><h2 style='margin:0; font-size:22px;'>" + esc(P.title) + "</h2>" +
        "<div class='pa-info'><span>⏱ " + P.time + " minutes</span><span>Total: " + sc.p + " marks</span><span class='pa-gdc " + (P.gdc ? "yes" : "no") + "'>" + (P.gdc ? "🧮 Calculator allowed" : "🚫 No calculator") + "</span></div>" +
        (st.done ? "" : "<div class='pa-timer' id='paTimer'>" + fmtTime(P.time * 60000 - (Date.now() - st.start)) + "</div>") + "</div>";
      if (st.done){
        var pc = Math.round(100 * sc.e / sc.p);
        html += "<div class='card pa-res'><b>Score: " + sc.e + " / " + sc.p + " marks (" + pc + "%)</b><span>Indicative grade: <b>" + paGrade(pc) + "</b> (approximate boundaries)</span>" +
          "<span>Time used: " + fmtTime(st.end - st.start) + "</span><span class='note'>Set your own marks for the self-marked parts below — the score updates.</span></div>";
      }
      var lastSec = "";
      st.qs.forEach(function(Q, qi){
        if (Q.section !== lastSec){ lastSec = Q.section; html += "<p class='eyebrow pa-sec'>" + esc(Q.section) + "</p>"; }
        var qe = 0;
        Q.q.parts.forEach(function(pt, pi){ var k = qi + "_" + pi; qe += pt.self ? (+st.self[k] || 0) : (st.ok[k] ? pt.m : 0); });
        html += "<div class='card pq-card'><div class='pq-head'><b>Question " + (qi + 1) + "</b><span class='pq-max'>[Maximum mark: " + Q.max + "]</span>" +
          (st.done ? "<span class='pa-qs'>" + qe + " / " + Q.max + "</span>" : "") + "</div><div class='pq-stem'>" + Q.q.stem + "</div>";
        Q.q.parts.forEach(function(pt, pi){
          var k = qi + "_" + pi, lab = Q.q.parts.length > 1 ? "<b>(" + "abcdefgh"[pi] + ")</b> " : "";
          html += "<div class='pq-part'><div class='pq-q'>" + lab + pt.q + "<span class='pq-m'>[" + pt.m + "]</span></div>";
          if (pt.self){
            html += st.done ? "<div class='pq-row'><label class='pa-self'>Your marks: <select onchange=\"paSelf('" + k + "',this.value)\">" +
                paOpts(pt.m, +st.self[k] || 0) + "</select> / " + pt.m + "</label></div>"
              : "<div class='note'>Write this on paper — you mark it yourself against the mark scheme after you finish.</div>";
          } else {
            html += "<div class='pq-row'><input class='field pq-in' value='" + esc(st.ans[k] || "") + "' placeholder='answer' " + (st.done ? "disabled" : "") + " oninput=\"paSet('" + k + "',this.value)\"></div>";
            if (st.done) html += "<div class='pq-fb " + (st.ok[k] ? "ok" : "no") + "'>" + (st.ok[k] ? "✓ " + pt.m + "/" + pt.m : "✗ 0/" + pt.m) + "</div>";
          }
          if (st.done) html += "<div class='pq-ms'><b>Mark scheme</b><ol>" + pt.sol.map(function(x){ return "<li>" + x + "</li>"; }).join("") + "</ol>" +
            (pt.self ? "" : "<div class='pq-final'>Answer: " + ansText(pt) + "</div>") + "</div>";
          html += "</div>";
        });
        html += "</div>";
      });
      html += st.done ? "<div class='pq-pn'><button class='btn ghost' onclick='back()'>‹ All papers</button><button class='btn primary' onclick=\"paNew('" + p.id + "',true)\">New paper ↻</button></div>"
        : "<div class='pq-pn'><button class='btn primary' onclick='paFinish()'>Finish &amp; mark</button></div><p class='note' style='margin-top:10px;'>Type numbers, fractions (3/4) or decimals; give non-exact answers to 3 significant figures. For two answers use a semicolon, e.g. <b>2; −3</b>.</p>";
      return html;
    }
    window.paNew = function(id, replace){ PAST[id] = makePaper(paperById(id)); if (replace) state.nav.pop(); go("paper", {id: id}); };
    window.paSet = function(k, v){ var st = PAST[top().params.id]; if (st && !st.done) st.ans[k] = v; };
    window.paSelf = function(k, v){ var id = top().params.id, st = PAST[id]; st.self[k] = +v; var sc = paScore(st); paSave(id, sc.e, sc.p); var y = window.scrollY; render(); window.scrollTo(0, y); };
    window.paFinish = function(){
      var id = top().params.id, st = PAST[id], blank = 0;
      st.qs.forEach(function(Q, qi){ Q.q.parts.forEach(function(pt, pi){ if (!pt.self && !String(st.ans[qi + "_" + pi] || "").trim()) blank++; }); });
      if (blank && !confirm(blank + " answer box" + (blank > 1 ? "es are" : " is") + " empty. Finish and mark anyway?")) return;
      st.qs.forEach(function(Q, qi){ Q.q.parts.forEach(function(pt, pi){ var k = qi + "_" + pi; if (!pt.self) st.ok[k] = checkPart(pt, st.ans[k] || ""); }); });
      st.done = true; st.end = Date.now(); var sc = paScore(st); paSave(id, sc.e, sc.p); render(); window.scrollTo(0, 0);
    };
    setInterval(function(){
      var el = document.getElementById("paTimer"); if (!el) return; var t = top(), P = paperById(t.params.id), st = PAST[t.params.id]; if (!P || !st) return;
      var left = P.time * 60000 - (Date.now() - st.start); el.textContent = left > 0 ? fmtTime(left) : "Time's up — finish when ready"; el.classList.toggle("over", left <= 0);
    }, 1000);
    state.nav = getUser() ? [{screen: "course", params: {}}] : [{screen: "signin", params: {}}];
    render();
  }

  window.CLCPlatform = {startHome: startHome, startCourse: startCourse, courses: COURSES};
})();
