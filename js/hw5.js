/* Page logic for Homework 5: runs the experiments of both exercises and fills the tables. */
(function () {
  'use strict';
  const { riemann, lebesgue, FUNCTIONS, dirichlet, thomae, taggedRiemann } = Integrals;
  const { Phi, series, tail, trapezoid, simpson, PhiErfSeries, PhiErfApprox } = NormCDF;
  const sci = (x) => (x === 0 ? '0' : x.toExponential(2));
  const fmt = (x) => (x === 0 ? '0' : Math.abs(x - 1) < 1e-9 ? '1' : sci(x));

  // fills the table with the given id: head = header cells, rows = arrays of cells (the first `text` cells are text, the others numbers)
  function fill(id, head, rows, text = 1) {
    const cells = (tag, row) => row.map((c, i) => `<${tag}${i < text ? '' : tag === 'td' ? ' class="num nw"' : ' class="num"'}>${c}</${tag}>`).join('');
    document.getElementById(id).innerHTML = `<thead><tr>${cells('th', head)}</tr></thead><tbody>${rows.map((row) => `<tr>${cells('td', row)}</tr>`).join('')}</tbody>`;
  }

  // ---------- Exercise 1 ----------
  const NS = [11, 101, 1001, 10001, 100001];                       // N subintervals (odd), K = N levels
  const order = (err) => Math.log10(err[3] / err[4]) / Math.log10(NS[4] / NS[3]);   // error ~ N^(-p), from the two largest N
  const name = (i) => `f<sub>${i + 1}</sub>`;
  fill('table-functions', ['', 'f(x)', 'x in', 'exact integral'], FUNCTIONS.map((F, i) => [name(i), F.label, F.domain, String(Number(F.exact.toPrecision(8)))]), 3);
  const head = (all) => ['function', ...NS.map((N) => (all ? 'N = K = ' : 'N = ') + N), 'observed order p<br><small>error ~ N<sup>&minus;p</sup></small>'];
  for (const [id, sum] of [['riemann', (F, N) => riemann(F.f, F.a, F.b, N)], ['lebesgue', (F, N) => lebesgue(F.f, F.a, F.b, N, N)]]) {
    fill('table-' + id, head(id === 'lebesgue'), FUNCTIONS.map((F, i) => {
      const err = NS.map((N) => Math.abs(sum(F, N) - F.exact));
      return [name(i), ...err.map(sci), order(err).toFixed(2)];
    }));
  }

  // time of the two sums for sin x with N = K = 10^6 (mean of 5 runs after one warm-up run)
  const S = FUNCTIONS[0], BIG = 1e6;
  const ms = (run) => { run(); const t0 = performance.now(); for (let r = 0; r < 5; r++) run(); return (performance.now() - t0) / 5; };
  const tR = ms(() => riemann(S.f, S.a, S.b, BIG)), tL = ms(() => lebesgue(S.f, S.a, S.b, BIG, BIG));
  fill('table-time', ['sum, N = K = 10<sup>6</sup>', 'time (ms)', 'memory'], [
    ['Riemann', tR.toFixed(1), 'a few numbers'],
    ['Lebesgue', `${tL.toFixed(1)} (${(tL / tR).toFixed(1)} times)`, `two arrays with N and K numbers (${(2 * BIG * 8 / 1e6)} MB)`],
  ]);

  // Dirichlet and Thomae: Riemann sums with rational tags and with irrational tags
  document.getElementById('table-pathological').querySelector('tbody').innerHTML = NS.map((N) => '<tr><td class="num nw">' + N + '</td>'
    + [taggedRiemann(dirichlet, N, true), taggedRiemann(dirichlet, N, false), taggedRiemann(thomae, N, true), taggedRiemann(thomae, N, false)]
      .map((v) => `<td class="num nw">${fmt(v)}</td>`).join('') + '</tr>').join('');

  // ---------- Exercise 2 ----------
  // The reference from the web: Wikipedia, "68-95-99.7 rule", table of numerical values (version of 10 August 2026, read on 11 November 2026).
  // For each z: P(|Z| <= z) with 15 decimals and the frequency outside the range as "1 in N" (the table gives
  // a coarser fraction, instead of an integer N, for z = 0.5 and z = 1.5)
  const REFERENCE = [
    { z: 0.5, inside: '0.382924922548026', oneIn: '3 in 5' },
    { z: 1, inside: '0.682689492137086', oneIn: '1 in 3' },
    { z: 1.5, inside: '0.866385597462284', oneIn: '2 in 15' },
    { z: 2, inside: '0.954499736103642', oneIn: '1 in 22' },
    { z: 2.5, inside: '0.987580669348448', oneIn: '1 in 81' },
    { z: 3, inside: '0.997300203936740', oneIn: '1 in 370' },
    { z: 3.5, inside: '0.999534741841929', oneIn: '1 in 2149' },
    { z: 4, inside: '0.999936657516334', oneIn: '1 in 15787' },
    { z: 4.5, inside: '0.999993204653751', oneIn: '1 in 147160' },
    { z: 5, inside: '0.999999426696856', oneIn: '1 in 1744278' },
    { z: 5.5, inside: '0.999999962020875', oneIn: '1 in 26330254' },
    { z: 6, inside: '0.999999998026825', oneIn: '1 in 506797346' },
    { z: 6.5, inside: '0.999999999919680', oneIn: '1 in 12450197393' },
    { z: 7, inside: '0.999999999997440', oneIn: '1 in 390682215445' },
    { z: 7.5, inside: '0.999999999999936', oneIn: '1 in 15669601204101' },
    { z: 8, inside: '0.999999999999999', oneIn: '1 in 803734397655348' },
  ];
  const inside = (f, z) => 2 * f(z) - 1;                             // P(|Z| <= z) = 2 Phi(z) - 1

  let worst = 0;
  fill('table-reference', ['z', '2&Phi;(z) &minus; 1<br><small>computed</small>', 'reference', 'difference', '1 in N<br><small>computed</small>', 'reference'], REFERENCE.map((r) => {
    const mine = inside(Phi, r.z), d = Math.abs(mine - Number(r.inside));
    worst = Math.max(worst, d);
    const N = 1 / (2 * Phi(-r.z)), integer = /^1 in \d+$/.test(r.oneIn);
    return [r.z, mine.toFixed(15), r.inside, sci(d), '1 in ' + (integer ? Math.round(N) : N.toPrecision(3)), r.oneIn];
  }));
  document.getElementById('worst-inside').textContent = sci(worst);

  // time of one call, in microseconds: f is called on the given points for about `budget` ms (after a short warm-up)
  function micro(f, points, budget = 30) {
    const run = (ms) => {
      let calls = 0, sink = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { for (let i = 0; i < points.length; i++) sink += f(points[i]); calls += points.length; }
      return { us: (performance.now() - t0) * 1000 / calls, sink };
    };
    run(3);
    return run(budget);
  }
  const Z = REFERENCE.map((r) => r.z);

  // cost of the two routes, series and continued fraction, and how much they differ on the lower tail
  fill('table-routes', ['x', 'terms of the series', 'iterations of the fraction', 'series<br><small>ns per call</small>', 'fraction<br><small>ns per call</small>',
    '&Phi;(&minus;x): difference of the two routes<br><small>relative</small>'],
  [1, 2, 3, 4, 6, 8].map((x) => {
    const s = series(-x).value, t = tail(x).value;
    const near = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => x + k * 0.001);                // a few points close to x for the timing
    return [x, series(x).terms, tail(x).iterations, Math.round(micro((v) => series(v).value, near, 12).us * 1000), Math.round(micro((v) => tail(v).value, near, 12).us * 1000), sci(Math.abs(s - t) / t)];
  }));

  // the approaches compared: the largest error of 2 Phi(z) - 1 on the 16 points and the time of one call
  fill('table-methods', ['approach', 'largest error<br><small>16 points</small>', 'time per call (&mu;s)'],
    [['series and continued fraction', Phi], ['trapezoidal rule, N = 1000', (x) => trapezoid(x, 1000)], ["Simpson's rule, N = 1000", (x) => simpson(x, 1000)],
      ['power series of erf', PhiErfSeries], ['approximation of erf (A&amp;S 7.1.26)', PhiErfApprox]].map(([name, f]) => {
      const err = Math.max(...REFERENCE.map((r) => Math.abs(inside(f, r.z) - Number(r.inside))));
      return [name, sci(err), micro(f, Z).us.toPrecision(2)];
    }));
})();
