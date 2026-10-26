/* Page logic for Homework 3: runs the simulations and draws the trajectories, the histograms and the tables. */
(function () {
  'use strict';
  const { bernoulli, rademacher, simulate, summarize, histogram, EPS } = Sums;
  const $ = (id) => document.getElementById(id);
  const P = 0.3, M = 1000;                                     // probability of the Bernoulli model, number of attackers
  const NS = [10, 100, 1000, 10000], N = NS[NS.length - 1];    // the values of n
  const KEPT = 15, BARS = 30, STRIDE = N / 500;                // trajectories drawn, bars of a histogram, one point in STRIDE of a path is drawn
  const QUANTITIES = [
    { id: 'total', title: 'Total score S<sub>n</sub>', scale: () => 1 },
    { id: 'average', title: 'Average score S<sub>n</sub>/n', scale: (n) => n },
    { id: 'normalized', title: 'Normalized total score S<sub>n</sub>/&radic;n', scale: (n) => Math.sqrt(n) },
  ];
  const results = {};                                          // the simulation of each model
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const tick = (v) => String(Number(v.toPrecision(3))).replace('-', '−');
  const num = (x) => {                                         // a number with 3 significant digits, as HTML
    if (x === 0) return '0';
    if (Math.abs(x) >= 0.01 && Math.abs(x) < 1e5) return String(Number(x.toPrecision(3)));
    const [mant, exp] = x.toExponential(2).split('e');
    return `${mant}&middot;10<sup>${exp.replace('-', '&minus;').replace('+', '')}</sup>`;
  };

  function prepare(cv, w, h) {                                 // a canvas of w x h CSS pixels, sharp on high-density screens
    const dpr = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '11px system-ui, sans-serif'; ctx.lineWidth = 1;
    return ctx;
  }

  // ---------- trajectories ----------
  // about `count` round values between lo and hi, for the labels of an axis
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
    const step = mag * [1, 2, 5, 10].find((f) => f * mag >= raw), ticks = [];
    for (let i = Math.ceil(lo / step); i * step <= hi + step * 1e-9; i++) ticks.push(i * step);
    return ticks;
  }

  function drawPaths(cv, { model, paths }) {
    const W = 420, H = 260, pad = { l: 50, r: 10, t: 26, b: 36 }, ctx = prepare(cv, W, H);
    const fg = cssVar('--fg'), muted = cssVar('--muted'), line = cssVar('--line'), accent = cssVar('--accent');
    let ymin = 0, ymax = 0;
    for (const p of paths) for (let k = 0; k <= N; k += STRIDE) { ymin = Math.min(ymin, p[k]); ymax = Math.max(ymax, p[k]); }
    const X = (k) => pad.l + (k / N) * (W - pad.l - pad.r), Y = (v) => H - pad.b - ((v - ymin) / (ymax - ymin)) * (H - pad.t - pad.b);
    ctx.fillStyle = fg; ctx.textAlign = 'left';
    ctx.fillText(`${model.name} model: S_k of ${paths.length} attackers`, pad.l, 14);
    ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.textAlign = 'right';
    for (const v of niceTicks(ymin, ymax, 6)) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(tick(v), pad.l - 5, Y(v) + 4);
    }
    [0, N / 2, N].forEach((k, i) => { ctx.textAlign = i === 2 ? 'right' : 'center'; ctx.fillText(String(k), X(k), H - 20); });
    ctx.textAlign = 'center'; ctx.fillText('k (systems attacked so far)', (pad.l + W - pad.r) / 2, H - 6);
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.6;
    for (const p of paths) {
      ctx.beginPath();
      for (let k = 0; k <= N; k += STRIDE) k ? ctx.lineTo(X(k), Y(p[k])) : ctx.moveTo(X(k), Y(p[k]));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- histograms ----------
  // values shown on the horizontal axis: the same range for every n whenever the quantity has a limit
  function range(model, qid, n) {
    const sd = Math.sqrt(model.sigma2), s = Math.sqrt(n);
    if (qid === 'total') return [Math.max(model.min * n, model.mu * n - 4 * sd * s), Math.min(model.max * n, model.mu * n + 4 * sd * s)];
    if (qid === 'average') return [model.min, model.max];
    return [model.mu * s - 4 * sd, model.mu * s + 4 * sd];
  }

  function drawHistogram(cv, bins, lo, hi, n, withNormal) {
    const W = 200, H = 130, pad = { l: 6, r: 6, t: 20, b: 20 }, ctx = prepare(cv, W, H);
    const fg = cssVar('--fg'), muted = cssVar('--muted'), line = cssVar('--line'), accent = cssVar('--accent');
    const peak = Math.max(...bins.map((b) => b.density), withNormal ? phi(0) : 0) * 1.1 || 1;
    const X = (v) => pad.l + ((v - lo) / (hi - lo)) * (W - pad.l - pad.r), Y = (d) => H - pad.b - (d / peak) * (H - pad.t - pad.b);
    ctx.fillStyle = accent; ctx.globalAlpha = 0.8;
    for (const b of bins) {
      const x0 = Math.max(X(b.from), pad.l), x1 = Math.min(X(b.to), W - pad.r);
      if (x1 > x0) ctx.fillRect(x0, Y(b.density), Math.max(x1 - x0 - 0.6, 0.6), Y(0) - Y(b.density));
    }
    ctx.globalAlpha = 1;
    if (withNormal) {                                           // the density of the standard normal distribution
      ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const v = lo + ((hi - lo) * i) / 80; i ? ctx.lineTo(X(v), Y(phi(v))) : ctx.moveTo(X(v), Y(phi(v))); }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(W - pad.r, Y(0)); ctx.stroke();
    ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(`n = ${n}`, pad.l, 13);
    ctx.fillStyle = muted;
    ctx.textAlign = 'left'; ctx.fillText(tick(lo), pad.l, H - 6);
    ctx.textAlign = 'center'; ctx.fillText(tick((lo + hi) / 2), (pad.l + W - pad.r) / 2, H - 6);
    ctx.textAlign = 'right'; ctx.fillText(tick(hi), W - pad.r, H - 6);
  }

  function buildFigure(key) {                                  // one row of 4 small histograms (n = 10, ..., 10000) for each quantity
    $(`fig-${key}`).innerHTML = QUANTITIES.map((q) => `<p class="qname">${q.title}</p><div class="grid4">`
      + NS.map((n) => `<canvas id="h-${key}-${q.id}-${n}" width="200" height="130" role="img" aria-label="${key} model, ${q.id} score, n = ${n}"></canvas>`).join('') + '</div>').join('');
  }

  function renderFigure(key) {
    const { model, S } = results[key];
    for (const q of QUANTITIES) NS.forEach((n, k) => {
      const [lo, hi] = range(model, q.id, n);
      drawHistogram($(`h-${key}-${q.id}-${n}`), histogram(S[k], q.scale(n), model.lattice, lo, hi, BARS), lo, hi, n, key === 'rademacher' && q.id === 'normalized');
    });
  }

  // ---------- tables ----------
  function renderTable(key) {
    const { model, rows } = results[key];
    const cell = (sim, theory) => `<td class="num">${num(sim)}<br><small>theory ${num(theory)}</small></td>`;
    $(`table-${key}`).innerHTML = '<thead><tr><th class="num">n</th>'
      + `<th class="num">P(|S<sub>n</sub>/n &minus; &mu;| &gt; ${EPS})<br><small>&mu; = ${num(model.mu)}</small></th>`
      + '<th class="num">Var(S<sub>n</sub>)</th><th class="num">Var(S<sub>n</sub>/n)</th><th class="num">Var(S<sub>n</sub>/&radic;n)</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td class="num">${r.n}</td><td class="num">${r.farFromMu.toFixed(3)}</td>`
        + cell(r.varTotal, r.theory.varTotal) + cell(r.varAverage, r.theory.varAverage) + cell(r.varNormalized, r.theory.varNormalized) + '</tr>').join('')
      + '</tbody>';
  }

  const render = (key) => { drawPaths($(`paths-${key}`), results[key]); renderFigure(key); renderTable(key); };

  // ---------- running ----------
  async function run() {
    for (const [key, model] of [['bernoulli', bernoulli(P)], ['rademacher', rademacher()]]) {
      $('status').textContent = `Simulating the ${model.name} model: ${M} attackers, ${N.toLocaleString('en-US')} systems each...`;
      const { S, paths } = await simulate(model, M, NS, KEPT);
      results[key] = { model, S, paths, rows: NS.map((n, k) => summarize(model, S[k], n)) };
      render(key);
    }
    $('status').textContent = '';
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Object.keys(results).forEach(render));
  ['bernoulli', 'rademacher'].forEach(buildFigure);
  run();
})();
