/* Sums of i.i.d. scores (Homework 3): the two models, the simulation of m trajectories and the statistics used on the page. */
(function (root) {
  'use strict';

  // the two models for one increment X_i: its mean mu, its variance sigma2, its smallest and largest value,
  // the lattice of the sums (S_n moves in steps of `lattice`) and draw(), which gives one value
  const bernoulli = (p) => ({ name: 'Bernoulli', mu: p, sigma2: p * (1 - p), min: 0, max: 1, lattice: 1, draw: () => (Math.random() < p ? 1 : 0) });
  const rademacher = () => ({ name: 'Rademacher', mu: 0, sigma2: 1, min: -1, max: 1, lattice: 2, draw: () => (Math.random() < 0.5 ? 1 : -1) });

  // m attackers, each one goes through N systems (N = the largest n). S[k][j] is the total score S_n
  // of attacker j for n = ns[k], read from its trajectory. The whole trajectory is kept for the
  // first `keep` attackers (for the picture)
  async function simulate(model, m, ns, keep) {
    const N = ns[ns.length - 1], S = ns.map(() => new Float64Array(m)), paths = [];
    for (let j = 0; j < m; j++) {
      const path = j < keep ? new Int32Array(N + 1) : null;
      let s = 0, k = 0;
      for (let i = 1; i <= N; i++) {
        s += model.draw();                                   // score on system i
        if (path) path[i] = s;
        if (i === ns[k]) S[k++][j] = s;
      }
      if (path) paths.push(path);
      if (j % 200 === 199) await new Promise((r) => setTimeout(r, 0));   // let the page update
    }
    return { S, paths };
  }

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const variance = (a) => { const mu = mean(a); return a.reduce((x, y) => x + (y - mu) ** 2, 0) / (a.length - 1); };

  // the three quantities studied, for the m attackers: S_n, S_n/n and S_n/sqrt(n)
  const quantities = (S, n) => ({
    total: S, average: S.map((x) => x / n), normalized: S.map((x) => x / Math.sqrt(n)),
  });

  const EPS = 0.05;

  // one row of the tables, for one value of n: the frequency of |S_n/n - mu| > EPS
  // and the variances of the three quantities (simulated and from theory)
  function summarize(model, S, n) {
    const q = quantities(S, n);
    return {
      n,
      farFromMu: q.average.filter((x) => Math.abs(x - model.mu) > EPS).length / S.length,
      varTotal: variance(q.total), varAverage: variance(q.average), varNormalized: variance(q.normalized),
      theory: { varTotal: n * model.sigma2, varAverage: model.sigma2 / n, varNormalized: model.sigma2 },
    };
  }

  // histogram of the values S / c on [lo, hi] (c = 1, n or sqrt(n)), for a sum S that moves on a lattice (S = offset + i * step, i an integer).
  // Every bar is centred on lattice points and is a whole number q of them wide, so that no bar is empty or doubled by chance.
  // The height is a density (fraction of the sample divided by the width of the bar), comparable with a probability density.
  function histogram(S, c, step, lo, hi, bars) {
    const offset = ((S[0] % step) + step) % step;
    const q = Math.max(1, Math.ceil(((hi - lo) * c) / (step * bars)));
    const first = offset + step * Math.ceil((lo * c - offset) / step);          // first lattice point inside the range
    const edge = (b) => (first - step / 2 + b * step * q) / c;
    const count = Math.max(1, Math.ceil((hi * c - (first - step / 2)) / (step * q)));
    const bins = Array.from({ length: count }, (_, b) => ({ from: edge(b), to: edge(b + 1), density: 0 }));
    for (const s of S) {
      const b = Math.floor((s - first + step / 2) / (step * q));
      if (b >= 0 && b < count) bins[b].density++;
    }
    for (const bin of bins) bin.density /= S.length * (bin.to - bin.from);
    return bins;
  }

  root.Sums = { bernoulli, rademacher, simulate, mean, variance, quantities, EPS, summarize, histogram };
  if (typeof module !== 'undefined') module.exports = root.Sums;
})(typeof window !== 'undefined' ? window : globalThis);
