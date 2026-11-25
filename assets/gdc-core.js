/* ===== CLC GDC — calculation engine =====
   No eval(): expressions are parsed by the small parser below and evaluated on a syntax tree.
   Used by assets/gdc.js (the calculator window). Also loads in Node for the tests in tools/test-gdc.mjs. */
(function(root){
  "use strict";

  /* ---------------- numbers ---------------- */
  function fmt(v, sig){
    sig = sig || 10;
    if (typeof v !== "number") return String(v);
    if (isNaN(v)) return "Math ERROR";
    if (!isFinite(v)) return v > 0 ? "∞" : "−∞";
    if (v === 0) return "0";
    var a = Math.abs(v), s;
    if (a >= 1e10 || a < 1e-9){
      var p = v.toExponential(sig - 1).split("e");
      s = String(parseFloat(p[0])) + "E" + (+p[1]);
    } else s = String(parseFloat(v.toPrecision(sig)));
    return s.replace(/^-/, "−").replace("E-", "E−");
  }
  function toFrac(v){                          // exact-looking fraction p/q (q ≤ 10000), or null
    if (!isFinite(v) || Number.isInteger(v) || Math.abs(v) > 1e9) return null;
    var x = Math.abs(v), h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (var i = 0; i < 40; i++){
      var ai = Math.floor(b), h2 = ai * h1 + h0, k2 = ai * k1 + k0;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (k1 > 10000) return null;
      if (Math.abs(x - h1 / k1) < 1e-11 * Math.max(1, x)) return (v < 0 ? "−" : "") + h1 + "/" + k1;
      if (b - ai < 1e-15) break;
      b = 1 / (b - ai);
    }
    return null;
  }

  /* ---------------- parser ---------------- */
  var FUNCS = ["asinh","acosh","atanh","asin","acos","atan","sinh","cosh","tanh","sin","cos","tan","ln","log","sqrt","cbrt","abs",
               "exp","nCr","nPr","floor","ceil","round","int","integral","deriv","sum","min","max","gcd","lcm"];
  var LAZY = {integral: 1, deriv: 1, sum: 1};
  var NAMES = FUNCS.concat(["Ans","pi","x","X","e"]).sort(function(a, b){ return b.length - a.length; });

  function normalize(s){
    return String(s)
      .replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/π/g, "pi").replace(/ᴇ/g, "E")
      .replace(/sin⁻¹/g, "asin").replace(/cos⁻¹/g, "acos").replace(/tan⁻¹/g, "atan")
      .replace(/arcsin/g, "asin").replace(/arccos/g, "acos").replace(/arctan/g, "atan")
      .replace(/d\/dx/g, "deriv").replace(/∫/g, "integral").replace(/Σ/g, "sum").replace(/∛/g, "cbrt").replace(/√/g, "sqrt")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁻¹/g, "^(-1)");
  }
  function tokenize(src){
    var s = normalize(src), t = [], i = 0;
    while (i < s.length){
      var c = s[i];
      if (/\s/.test(c)){ i++; continue; }
      if (/[0-9.]/.test(c)){
        var m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/.exec(s.slice(i));
        if (!m) throw new Error("Syntax ERROR");
        t.push({k: "num", v: parseFloat(m[0])}); i += m[0].length; continue;
      }
      if (/[A-Za-z]/.test(c)){
        var run = /^[A-Za-z]+/.exec(s.slice(i))[0], j = 0;
        while (j < run.length){
          var hit = null;
          for (var n = 0; n < NAMES.length; n++) if (run.substr(j, NAMES[n].length) === NAMES[n]){ hit = NAMES[n]; break; }
          if (!hit) throw new Error("Syntax ERROR: unknown “" + run.slice(j) + "”");
          t.push({k: FUNCS.indexOf(hit) >= 0 ? "fn" : "id", v: hit === "X" ? "x" : hit}); j += hit.length;
        }
        i += run.length; continue;
      }
      if ("+-*/^!(),=".indexOf(c) >= 0){ t.push({k: c}); i++; continue; }
      throw new Error("Syntax ERROR: “" + c + "”");
    }
    return t;
  }
  function parse(src){
    var t = tokenize(src), p = 0;
    function peek(){ return t[p] || {k: "eof"}; }
    function eat(k){ if (peek().k === k){ p++; return true; } return false; }
    function startsPrimary(tok){ return tok.k === "num" || tok.k === "id" || tok.k === "fn" || tok.k === "("; }
    function expr(){ return add(); }
    function add(){
      var a = mul();
      for (;;){
        if (eat("+")) a = {t: "bin", op: "+", a: a, b: mul()};
        else if (eat("-")) a = {t: "bin", op: "-", a: a, b: mul()};
        else return a;
      }
    }
    function mul(){
      var a = unary();
      for (;;){
        if (eat("*")) a = {t: "bin", op: "*", a: a, b: unary()};
        else if (eat("/")) a = {t: "bin", op: "/", a: a, b: unary()};
        else if (startsPrimary(peek())) a = {t: "bin", op: "*", a: a, b: power()};   // implicit: 2x, 3sin(x), (x+1)(x-1)
        else return a;
      }
    }
    function unary(){
      if (eat("-")) return {t: "neg", a: unary()};
      if (eat("+")) return unary();
      return power();
    }
    function power(){
      var b = postfix();
      if (eat("^")) return {t: "bin", op: "^", a: b, b: unary()};
      return b;
    }
    function postfix(){
      var a = primary();
      while (eat("!")) a = {t: "fact", a: a};
      return a;
    }
    function close(){ if (!eat(")") && peek().k !== "eof") throw new Error("Syntax ERROR: missing “)”"); }
    function primary(){
      var tok = peek();
      if (tok.k === "num"){ p++; return {t: "num", v: tok.v}; }
      if (eat("(")){ var e = expr(); close(); return e; }
      if (tok.k === "id"){
        p++;
        if (tok.v === "pi") return {t: "num", v: Math.PI};
        if (tok.v === "e") return {t: "num", v: Math.E};
        return {t: "var", n: tok.v};
      }
      if (tok.k === "fn"){
        p++;
        var args = [];
        if (eat("(")){
          if (!eat(")")){
            args.push(expr());
            while (eat(",")) args.push(expr());
            close();
          }
        } else args.push(postfix());                 // sin 30, ln 2
        return {t: "fn", n: tok.v, args: args};
      }
      throw new Error(tok.k === "eof" ? "Syntax ERROR: incomplete" : "Syntax ERROR");
    }
    var tree = expr();
    if (peek().k !== "eof") throw new Error(peek().k === "=" ? "Syntax ERROR: “=” only in the Equation solver" : "Syntax ERROR");
    return tree;
  }

  /* ---------------- special functions ---------------- */
  function gammaln(x){
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - gammaln(1 - x);
    x -= 1; var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function factorial(n){
    if (n < 0 && Number.isInteger(n)) return NaN;
    if (Number.isInteger(n) && n <= 170){ var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
    return Math.exp(gammaln(n + 1));
  }
  function nCr(n, r){
    if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < 0) return NaN;
    if (r > n) return 0;
    r = Math.min(r, n - r); var v = 1;
    for (var i = 1; i <= r; i++) v = v * (n - r + i) / i;
    return Math.round(v) === v || v > 1e15 ? v : Math.round(v);
  }
  function nPr(n, r){
    if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < 0) return NaN;
    if (r > n) return 0;
    var v = 1; for (var i = 0; i < r; i++) v *= (n - i); return v;
  }
  function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
  // regularized incomplete gamma P(a,x) and Q(a,x) (series / continued fraction)
  function gammainc(a, x){
    if (x <= 0) return {P: 0, Q: 1};
    var gln = gammaln(a);
    if (x < a + 1){
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 1000; n++){ ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
      var P = sum * Math.exp(-x + a * Math.log(x) - gln); return {P: P, Q: 1 - P};
    }
    var b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for (var i = 1; i < 1000; i++){
      var an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var dl = d * c; h *= dl; if (Math.abs(dl - 1) < 1e-16) break;
    }
    var Q = Math.exp(-x + a * Math.log(x) - gln) * h; return {P: 1 - Q, Q: Q};
  }
  function Phi(z){                               // standard normal CDF, accurate in both tails
    if (z === -Infinity) return 0; if (z === Infinity) return 1;
    var q = 0.5 * gammainc(0.5, z * z / 2).Q;
    return z < 0 ? q : 1 - q;
  }
  function PhiInv(p){                            // Acklam + one Newton step
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239],
        b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
        c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
        d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416], q, r, x;
    if (p < 0.02425){ q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    else if (p > 1 - 0.02425){ q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    else { q = p - 0.5; r = q * q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
    var e = Phi(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }

  /* ---------------- numerical calculus ---------------- */
  function integrate(f, a, b){
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a);
    function simpson(fa, fm, fb, a, b){ return (b - a) / 6 * (fa + 4 * fm + fb); }
    function rec(a, b, fa, fm, fb, whole, eps, depth){
      var m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2, flm = f(lm), frm = f(rm);
      var left = simpson(fa, flm, fm, a, m), right = simpson(fm, frm, fb, m, b), diff = left + right - whole;
      if (depth <= 0 || Math.abs(diff) <= 15 * eps) return left + right + diff / 15;
      return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
    }
    // split into 16 panels so that narrow features are not missed
    var n = 16, h = (b - a) / n, total = 0;
    for (var i = 0; i < n; i++){
      var x0 = a + i * h, x1 = x0 + h, f0 = f(x0), f1 = f(x1), fm = f((x0 + x1) / 2);
      total += rec(x0, x1, f0, fm, f1, simpson(f0, fm, f1, x0, x1), 1e-12, 40);
    }
    return total;
  }
  function derivative(f, a){
    var h = 1e-3 * Math.max(1, Math.abs(a));
    function D(h){ return (f(a + h) - f(a - h)) / (2 * h); }
    var d1 = D(h), d2 = D(h / 2), d3 = D(h / 4);
    var r1 = (4 * d2 - d1) / 3, r2 = (4 * d3 - d2) / 3;
    return (16 * r2 - r1) / 15;
  }

  /* ---------------- evaluation ---------------- */
  function snap(v){ return Math.abs(v) < 1e-15 ? 0 : v; }
  function evaluate(node, env){
    var deg = env.deg, k = deg ? Math.PI / 180 : 1;
    function trig(fn, x){
      if (deg){
        var m = ((x % 360) + 360) % 360;
        if (fn === "sin"){ if (m === 0 || m === 180) return 0; if (m === 90) return 1; if (m === 270) return -1; }
        if (fn === "cos"){ if (m === 90 || m === 270) return 0; if (m === 0) return 1; if (m === 180) return -1; }
        if (fn === "tan"){ if (m === 0 || m === 180) return 0; if (m === 90 || m === 270) return NaN; }
      }
      return snap(Math[fn](x * k));
    }
    function ev(n, x){
      switch (n.t){
        case "num": return n.v;
        case "var":
          if (n.n === "x"){ if (x === undefined) throw new Error("x has no value here — use it in Graph, Table, ∫, d/dx or Σ"); return x; }
          if (n.n === "Ans") return env.Ans || 0;
          throw new Error("Unknown variable " + n.n);
        case "neg": return -ev(n.a, x);
        case "fact": return factorial(ev(n.a, x));
        case "bin":
          var A = ev(n.a, x), B = ev(n.b, x);
          switch (n.op){
            case "+": return A + B; case "-": return A - B; case "*": return A * B;
            case "/": return B === 0 ? NaN : A / B;
            case "^":
              if (A < 0 && !Number.isInteger(B)){
                var fr = toFrac(B);                    // (−8)^(1/3) = −2 like a GDC
                if (fr){ var q = +fr.split("/")[1], pnum = +fr.replace("−", "-").split("/")[0];
                  if (q % 2 === 1) return (pnum % 2 === 0 ? 1 : -1) * Math.pow(-A, B); }
                return NaN;
              }
              return Math.pow(A, B);
          }
          break;
        case "fn":
          var a = n.args, f = n.n;
          if (LAZY[f]){
            var fx = function(t){ return ev(a[0], t); };
            if (f === "integral"){ if (a.length !== 3) throw new Error("∫(f(x), a, b)"); return integrate(fx, ev(a[1], x), ev(a[2], x)); }
            if (f === "deriv"){ if (a.length !== 2) throw new Error("d/dx(f(x), a)"); return derivative(fx, ev(a[1], x)); }
            if (f === "sum"){
              if (a.length !== 3) throw new Error("Σ(f(x), start, end)");
              var s0 = ev(a[1], x), s1 = ev(a[2], x), tot = 0;
              if (!Number.isInteger(s0) || !Number.isInteger(s1) || s1 - s0 > 1e6) throw new Error("Σ needs whole-number limits");
              for (var i = s0; i <= s1; i++) tot += fx(i);
              return tot;
            }
          }
          var v = a.map(function(z){ return ev(z, x); }), u = v[0];
          if (v.length === 0) throw new Error("Syntax ERROR: " + f + "( ) needs a value");
          switch (f){
            case "sin": case "cos": case "tan": return trig(f, u);
            case "asin": return Math.asin(u) / k; case "acos": return Math.acos(u) / k; case "atan": return Math.atan(u) / k;
            case "sinh": return Math.sinh(u); case "cosh": return Math.cosh(u); case "tanh": return Math.tanh(u);
            case "asinh": return Math.asinh(u); case "acosh": return Math.acosh(u); case "atanh": return Math.atanh(u);
            case "ln": return u > 0 ? Math.log(u) : NaN;
            case "log": return v.length === 2 ? (v[1] > 0 && u > 0 && u !== 1 ? Math.log(v[1]) / Math.log(u) : NaN) : (u > 0 ? Math.log10(u) : NaN);
            case "sqrt": return u >= 0 ? Math.sqrt(u) : NaN;
            case "cbrt": return Math.cbrt(u);
            case "abs": return Math.abs(u);
            case "exp": return Math.exp(u);
            case "nCr": return nCr(u, v[1]); case "nPr": return nPr(u, v[1]);
            case "floor": case "int": return Math.floor(u); case "ceil": return Math.ceil(u);
            case "round": return v.length === 2 ? +u.toFixed(v[1]) : Math.round(u);
            case "min": return Math.min.apply(null, v); case "max": return Math.max.apply(null, v);
            case "gcd": return v.reduce(gcd); case "lcm": return v.reduce(function(p, q){ return p / gcd(p, q) * q; });
          }
      }
      throw new Error("Syntax ERROR");
    }
    return ev(node, env.x);
  }
  function calc(src, env){ return evaluate(parse(src), env || {}); }
  function compile(src, env){                      // f(x) for graphs/tables; returns NaN where undefined
    var tree = parse(src);
    return function(x){ try{ var v = evaluate(tree, {deg: env && env.deg, Ans: env && env.Ans, x: x}); return typeof v === "number" ? v : NaN; }catch(e){ return NaN; } };
  }

  /* ---------------- root / extremum finding ---------------- */
  function refineRoot(f, a, b){
    var fa = f(a), fb = f(b);
    for (var i = 0; i < 200; i++){
      var m = (a + b) / 2, fm = f(m);
      if (fm === 0 || (b - a) / 2 < 1e-14 * Math.max(1, Math.abs(m))) return m;
      if ((fa < 0) === (fm < 0)){ a = m; fa = fm; } else { b = m; fb = fm; }
    }
    return (a + b) / 2;
  }
  function golden(f, a, b, sign){                // sign=+1 max, −1 min
    var g = (Math.sqrt(5) - 1) / 2, c = b - g * (b - a), d = a + g * (b - a), fc = sign * f(c), fd = sign * f(d);
    for (var i = 0; i < 200 && Math.abs(b - a) > 1e-12 * Math.max(1, Math.abs(c)); i++){
      if (fc > fd){ b = d; d = c; fd = fc; c = b - g * (b - a); fc = sign * f(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = sign * f(d); }
    }
    return (a + b) / 2;
  }
  function roots(f, lo, hi, n){
    n = n || 2000; var out = [], h = (hi - lo) / n, x0 = lo, f0 = f(lo);
    for (var i = 1; i <= n; i++){
      var x1 = lo + i * h, f1 = f(x1);
      if (isFinite(f0) && isFinite(f1)){
        if (f0 === 0) out.push(x0);
        else if ((f0 < 0) !== (f1 < 0) && f1 !== 0){
          var r = refineRoot(f, x0, x1);
          if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(f0), Math.abs(f1))) out.push(r);   // skip asymptote jumps
        }
      }
      x0 = x1; f0 = f1;
    }
    if (f0 === 0) out.push(hi);
    // double roots (touching the axis): local min of |f| that reaches ~0
    var g = function(x){ return Math.abs(f(x)); };
    extrema(g, lo, hi, -1, n).forEach(function(p){
      if (Math.abs(p.y) < 1e-9 && !out.some(function(r){ return Math.abs(r - p.x) < 1e-6 * Math.max(1, Math.abs(r)); })) out.push(p.x);
    });
    return out.sort(function(a, b){ return a - b; }).filter(function(r, i, arr){ return i === 0 || Math.abs(r - arr[i - 1]) > 1e-9 * Math.max(1, Math.abs(r)); });
  }
  function extrema(f, lo, hi, sign, n){         // local max (sign 1) or min (sign −1) strictly inside [lo,hi]
    n = n || 2000; var h = (hi - lo) / n, ys = [], out = [];
    for (var i = 0; i <= n; i++) ys.push(sign * f(lo + i * h));
    for (var j = 1; j < n; j++){
      if (isFinite(ys[j - 1]) && isFinite(ys[j]) && isFinite(ys[j + 1]) && ys[j] >= ys[j - 1] && ys[j] > ys[j + 1]){
        var a = lo + (j - 1) * h, b = lo + (j + 1) * h, x = golden(f, a, b, sign);
        // golden section is only accurate to ~1e-8: finish on the zero of f′ when f′ changes sign
        var d = function(t){ return derivative(f, t); }, da = d(a), db = d(b);
        if (isFinite(da) && isFinite(db) && (da < 0) !== (db < 0)){ var xr = refineRoot(d, a, b); if (sign * f(xr) >= sign * f(x) - 1e-12 * Math.max(1, Math.abs(f(x)))) x = xr; }
        out.push({x: x, y: f(x)});
      }
    }
    return out;
  }

  /* ---------------- statistics ---------------- */
  function median(s){ var n = s.length, m = Math.floor(n / 2); return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function oneVar(xs, fs){
    var data = [];
    xs.forEach(function(x, i){
      var f = fs ? fs[i] : 1;
      if (fs && (!Number.isInteger(f) || f < 0)) throw new Error("Frequencies must be whole numbers ≥ 0");
      for (var k = 0; k < f; k++) data.push(x);
    });
    var n = data.length; if (!n) throw new Error("List 1 is empty");
    data.sort(function(a, b){ return a - b; });
    var sx = 0, sxx = 0; data.forEach(function(x){ sx += x; sxx += x * x; });
    var mean = sx / n, ss = data.reduce(function(s, x){ return s + (x - mean) * (x - mean); }, 0);
    var half = Math.floor(n / 2), lower = data.slice(0, half), upper = data.slice(n % 2 ? half + 1 : half);
    return {n: n, mean: mean, sum: sx, sum2: sxx, sigma: Math.sqrt(ss / n), s: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN,
      min: data[0], q1: n > 1 ? median(lower) : data[0], med: median(data), q3: n > 1 ? median(upper) : data[0], max: data[n - 1]};
  }
  function pearson(xs, ys){
    var n = xs.length, mx = 0, my = 0; for (var i = 0; i < n; i++){ mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < n; i++){ sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    return {r: sxy / Math.sqrt(sxx * syy), a: sxy / sxx, b: my - sxy / sxx * mx, mx: mx, my: my};
  }
  function ranks(v){
    var idx = v.map(function(x, i){ return i; }).sort(function(a, b){ return v[a] - v[b]; }), r = new Array(v.length), i = 0;
    while (i < idx.length){
      var j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
      for (var k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  function solveLinear(M, rhs){                  // Gaussian elimination; returns null if singular
    var n = rhs.length, A = M.map(function(row, i){ return row.slice().concat([rhs[i]]); });
    for (var c = 0; c < n; c++){
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      var t = A[c]; A[c] = A[p]; A[p] = t;
      for (r = 0; r < n; r++) if (r !== c){ var f = A[r][c] / A[c][c]; for (var k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    return A.map(function(row, i){ return row[n] / row[i]; });
  }
  function regression(xs, ys, type){
    if (xs.length !== ys.length) throw new Error("List 1 and List 2 must have the same number of values");
    if (xs.length < 2) throw new Error("Need at least 2 pairs of values");
    if (type === "linear"){ var p = pearson(xs, ys); return {eq: "y = ax + b", a: p.a, b: p.b, r: p.r, r2: p.r * p.r, f: function(x){ return p.a * x + p.b; }}; }
    if (type === "quad"){
      var S = [0, 0, 0, 0, 0], T = [0, 0, 0];
      for (var i = 0; i < xs.length; i++){ var x = xs[i], y = ys[i]; for (var k = 0; k < 5; k++) S[k] += Math.pow(x, k); T[0] += y; T[1] += x * y; T[2] += x * x * y; }
      var c = solveLinear([[S[4], S[3], S[2]], [S[3], S[2], S[1]], [S[2], S[1], S[0]]], [T[2], T[1], T[0]]);
      if (!c) throw new Error("Not enough different x-values for a quadratic");
      var f = function(x){ return c[0] * x * x + c[1] * x + c[2]; }, my = ys.reduce(function(s, y){ return s + y; }, 0) / ys.length, ssr = 0, sst = 0;
      for (i = 0; i < xs.length; i++){ ssr += Math.pow(ys[i] - f(xs[i]), 2); sst += Math.pow(ys[i] - my, 2); }
      return {eq: "y = ax² + bx + c", a: c[0], b: c[1], c: c[2], r2: 1 - ssr / sst, f: f};
    }
    if (type === "exp"){
      if (ys.some(function(y){ return y <= 0; })) throw new Error("Exponential regression needs all y > 0");
      var q = pearson(xs, ys.map(Math.log)), A = Math.exp(q.b), B = Math.exp(q.a);
      return {eq: "y = a·bˣ", a: A, b: B, r: q.r, r2: q.r * q.r, f: function(x){ return A * Math.pow(B, x); }};
    }
    if (type === "power"){
      if (ys.some(function(y){ return y <= 0; }) || xs.some(function(x){ return x <= 0; })) throw new Error("Power regression needs all x > 0 and y > 0");
      var w = pearson(xs.map(Math.log), ys.map(Math.log)), A2 = Math.exp(w.b);
      return {eq: "y = a·xᵇ", a: A2, b: w.a, r: w.r, r2: w.r * w.r, f: function(x){ return A2 * Math.pow(x, w.a); }};
    }
    throw new Error("Unknown regression");
  }
  function spearman(xs, ys){ return pearson(ranks(xs), ranks(ys)).r; }

  /* ---------------- distributions ---------------- */
  function normalPdf(x, mu, sd){ return Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI)); }
  function normalCdf(lo, hi, mu, sd){
    if (!(sd > 0)) throw new Error("σ must be > 0");
    var a = (lo - mu) / sd, b = (hi - mu) / sd;
    if (b <= 0) return Phi(b) - Phi(a);
    if (a >= 0) return (1 - Phi(a)) - (1 - Phi(b));
    return 1 - Phi(a) - (1 - Phi(b));
  }
  function invNorm(area, mu, sd, tail){
    if (!(area > 0 && area < 1)) throw new Error("Area must be between 0 and 1");
    if (!(sd > 0)) throw new Error("σ must be > 0");
    if (tail === "right") return {x: mu + sd * PhiInv(1 - area)};
    if (tail === "center"){ var z = PhiInv((1 + area) / 2); return {lo: mu - sd * z, hi: mu + sd * z}; }
    return {x: mu + sd * PhiInv(area)};
  }
  function binomPdf(k, n, p){
    if (!Number.isInteger(n) || n < 0 || !(p >= 0 && p <= 1)) throw new Error("n must be a whole number, 0 ≤ p ≤ 1");
    if (!Number.isInteger(k) || k < 0 || k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0; if (p === 1) return k === n ? 1 : 0;
    return Math.exp(gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  }
  function binomCdf(lo, hi, n, p){
    var s = 0; lo = Math.max(0, Math.ceil(lo)); hi = Math.min(n, Math.floor(hi));
    for (var k = lo; k <= hi; k++) s += binomPdf(k, n, p);
    return Math.min(1, s);
  }
  function chi2p(stat, df){ return gammainc(df / 2, stat / 2).Q; }
  function chi2Independence(rows){
    var r = rows.length, c = rows[0].length;
    if (r < 2 || c < 2 || rows.some(function(row){ return row.length !== c; })) throw new Error("Enter at least 2 rows and 2 columns, all rows the same length");
    var R = rows.map(function(row){ return row.reduce(function(s, v){ return s + v; }, 0); }), C = [], N = 0;
    for (var j = 0; j < c; j++){ C[j] = 0; for (var i = 0; i < r; i++) C[j] += rows[i][j]; N += C[j]; }
    var E = [], stat = 0;
    for (i = 0; i < r; i++){ E[i] = []; for (j = 0; j < c; j++){ E[i][j] = R[i] * C[j] / N; stat += Math.pow(rows[i][j] - E[i][j], 2) / E[i][j]; } }
    var df = (r - 1) * (c - 1);
    return {stat: stat, df: df, p: chi2p(stat, df), expected: E};
  }
  function chi2GOF(obs, exp, df){
    if (obs.length !== exp.length || obs.length < 2) throw new Error("Observed and Expected must have the same number of values (at least 2)");
    var stat = 0; for (var i = 0; i < obs.length; i++) stat += Math.pow(obs[i] - exp[i], 2) / exp[i];
    df = df || obs.length - 1;
    return {stat: stat, df: df, p: chi2p(stat, df)};
  }

  /* ---------------- equations ---------------- */
  function polyRoots(coef){                      // coef highest power first; returns [{re, im}]
    while (coef.length && coef[0] === 0) coef = coef.slice(1);
    var n = coef.length - 1; if (n < 1) throw new Error("The leading coefficient cannot be 0");
    if (n === 1) return [{re: -coef[1] / coef[0], im: 0}];
    if (n === 2){
      var a = coef[0], b = coef[1], c = coef[2], D = b * b - 4 * a * c;
      if (D >= 0){ var q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D)), r1 = q / a, r2 = q !== 0 ? c / q : -b / a - r1;
        return [{re: Math.min(r1, r2), im: 0}, {re: Math.max(r1, r2), im: 0}]; }
      return [{re: -b / (2 * a), im: -Math.sqrt(-D) / (2 * a) * (a > 0 ? 1 : -1)}, {re: -b / (2 * a), im: Math.sqrt(-D) / (2 * a) * (a > 0 ? 1 : -1)}];
    }
    var m = coef.map(function(v){ return v / coef[0]; }), z = [];
    for (var i = 0; i < n; i++) z.push({re: Math.cos(2 * Math.PI * i / n + 0.4) * (1 + 0.5 * i / n), im: Math.sin(2 * Math.PI * i / n + 0.4) * (1 + 0.5 * i / n)});
    function mul(a, b){ return {re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re}; }
    function div(a, b){ var d = b.re * b.re + b.im * b.im; return {re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d}; }
    function pv(x){ var s = {re: m[0], im: 0}; for (var k = 1; k <= n; k++){ s = mul(s, x); s.re += m[k]; } return s; }
    for (var it = 0; it < 2000; it++){
      var delta = 0;
      for (i = 0; i < n; i++){
        var den = {re: 1, im: 0};
        for (var j = 0; j < n; j++) if (j !== i) den = mul(den, {re: z[i].re - z[j].re, im: z[i].im - z[j].im});
        var step = div(pv(z[i]), den); z[i] = {re: z[i].re - step.re, im: z[i].im - step.im};
        delta = Math.max(delta, Math.abs(step.re) + Math.abs(step.im));
      }
      if (delta < 1e-15) break;
    }
    // polish with Newton on the original polynomial
    function dpv(x){ var s = {re: n * m[0], im: 0}; for (var k = 1; k < n; k++){ s = mul(s, x); s.re += (n - k) * m[k]; } return s; }
    z = z.map(function(x){ for (var k = 0; k < 5; k++){ var d = dpv(x); if (d.re === 0 && d.im === 0) break; var s = div(pv(x), d); x = {re: x.re - s.re, im: x.im - s.im}; } return x; });
    z.forEach(function(x){ if (Math.abs(x.im) < 1e-9 * Math.max(1, Math.abs(x.re))) x.im = 0; if (Math.abs(x.re) < 1e-13) x.re = 0; });
    return z.sort(function(a, b){ return (a.im !== 0) - (b.im !== 0) || a.re - b.re || a.im - b.im; });
  }
  function simultaneous(M, rhs){
    var s = solveLinear(M, rhs);
    if (s) return {unique: true, x: s};
    // singular: check consistency with rank comparison
    function rank(A){
      A = A.map(function(r){ return r.slice(); }); var rk = 0, rows = A.length, cols = A[0].length;
      for (var c = 0; c < cols && rk < rows; c++){
        var p = rk; for (var r = rk + 1; r < rows; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        if (Math.abs(A[p][c]) < 1e-10) continue;
        var t = A[rk]; A[rk] = A[p]; A[p] = t;
        for (r = rk + 1; r < rows; r++){ var f = A[r][c] / A[rk][c]; for (var k = c; k < cols; k++) A[r][k] -= f * A[rk][k]; }
        rk++;
      }
      return rk;
    }
    var aug = M.map(function(r, i){ return r.concat([rhs[i]]); });
    return {unique: false, infinite: rank(M) === rank(aug)};
  }

  /* ---------------- finance (TVM, same convention as GDCs: money paid out is negative) ---------------- */
  function tvm(o, solveFor){
    var N = o.N, I = o.I, PV = o.PV, PMT = o.PMT, FV = o.FV, PY = o.PY || 1, CY = o.CY || 1, S = o.bgn ? 1 : 0;
    function rate(I){ return Math.pow(1 + I / (100 * CY), CY / PY) - 1; }
    function F(I, N, PV, PMT, FV){
      var i = rate(I);
      if (Math.abs(i) < 1e-14) return PV + PMT * N + FV;
      var g = Math.pow(1 + i, N);
      return PV * g + PMT * (1 + i * S) * (g - 1) / i + FV;
    }
    var i = rate(I), g = Math.pow(1 + i, N), z = Math.abs(i) < 1e-14;
    switch (solveFor){
      case "FV": return z ? -(PV + PMT * N) : -(PV * g + PMT * (1 + i * S) * (g - 1) / i);
      case "PV": return z ? -(FV + PMT * N) : -(FV + PMT * (1 + i * S) * (g - 1) / i) / g;
      case "PMT": return z ? -(PV + FV) / N : -(PV * g + FV) * i / ((1 + i * S) * (g - 1));
      case "N":
        if (z) return -(PV + FV) / PMT;
        var A = PMT * (1 + i * S) / i, ratio = (A - FV) / (PV + A);
        if (!(ratio > 0)) throw new Error("No solution for N with these values (check the signs: money paid out is negative)");
        return Math.log(ratio) / Math.log(1 + i);
      case "I":
        var f = function(r){ return F(r, N, PV, PMT, FV); }, lo = -99.9999, prev = f(lo), found = null;
        var grid = [];
        for (var x = -99; x <= 100; x += 0.5) grid.push(x);
        for (x = 110; x <= 1000; x += 10) grid.push(x);
        for (var k = 0; k < grid.length; k++){
          var v = f(grid[k]);
          if (isFinite(prev) && isFinite(v) && (prev < 0) !== (v < 0)){ found = refineRoot(f, k ? grid[k - 1] : lo, grid[k]); break; }
          prev = v;
        }
        if (found === null) throw new Error("No interest rate fits these values (check the signs: money paid out is negative)");
        return found;
    }
    throw new Error("Choose what to solve for");
  }

  var api = {fmt: fmt, toFrac: toFrac, parse: parse, calc: calc, compile: compile, integrate: integrate, derivative: derivative,
    roots: roots, extrema: extrema, refineRoot: refineRoot, oneVar: oneVar, regression: regression, spearman: spearman, pearson: pearson,
    normalPdf: normalPdf, normalCdf: normalCdf, invNorm: invNorm, binomPdf: binomPdf, binomCdf: binomCdf,
    chi2Independence: chi2Independence, chi2GOF: chi2GOF, chi2p: chi2p, polyRoots: polyRoots, simultaneous: simultaneous, tvm: tvm,
    factorial: factorial, nCr: nCr, nPr: nPr, Phi: Phi, PhiInv: PhiInv};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CLCGDCMath = api;
})(typeof window !== "undefined" ? window : globalThis);
