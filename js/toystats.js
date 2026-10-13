/* Statistical exploration of the points k*G on a small curve (Homework 1).
 * For a base point G of order n, the outputs are the n-1 points kG, k = 1..n-1. */
(function (root) {
  'use strict';

  const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

  // Pearson correlation coefficient of two arrays of numbers
  function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
  }

  function analyse(curve, G) {
    const p = Number(curve.p);
    const nb = (p - 1).toString(2).length;                 // bits per coordinate (5 for p = 17)
    const n = curve.order(G);
    const ks = [], pts = [];
    for (let k = 1; k < n; k++) { ks.push(k); pts.push(curve.mul(BigInt(k), G)); }
    const m = pts.length;
    const xs = pts.map((P) => Number(P.x)), ys = pts.map((P) => Number(P.y));

    // frequency of each coordinate value
    const xCounts = new Array(p).fill(0), yCounts = new Array(p).fill(0);
    xs.forEach((v) => xCounts[v]++);
    ys.forEach((v) => yCounts[v]++);

    // fraction of ones at each bit position (most significant bit first)
    const bitFreq = (vals) => Array.from({ length: nb }, (_, j) =>
      vals.reduce((a, v) => a + ((v >> (nb - 1 - j)) & 1), 0) / m);

    // chi-square statistic against a uniform distribution on 0..p-1 (reliable only if the expected count is >= 5)
    const chi = (counts) => counts.reduce((a, c) => a + (c - m / p) ** 2 / (m / p), 0);

    // avalanche: flip one bit of k, count how many of the 2*nb output bits change
    const enc = (P) => (Number(P.x) << nb) | Number(P.y);
    const out = pts.map(enc);
    const kbits = (n - 1).toString(2).length;
    let sum = 0, cnt = 0;
    for (let k = 1; k < n; k++) {
      for (let j = 0; j < kbits; j++) {
        const k2 = k ^ (1 << j);
        if (k2 >= 1 && k2 < n) { sum += popcount(out[k - 1] ^ out[k2 - 1]); cnt++; }
      }
    }
    // baseline: mean distance between two different outputs chosen at random
    let bsum = 0, bcnt = 0;
    for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) if (a !== b) { bsum += popcount(out[a] ^ out[b]); bcnt++; }

    return {
      n, m, nb, curvePoints: curve.points().length,
      xCounts, yCounts,
      bitFreqX: bitFreq(xs), bitFreqY: bitFreq(ys),
      xChi: chi(xCounts), yChi: chi(yCounts), expected: m / p,
      rKX: pearson(ks, xs), rKY: pearson(ks, ys), rXY: pearson(xs, ys),
      band: m > 1 ? 1.96 / Math.sqrt(m) : null,
      avalanche: { mean: cnt ? sum / cnt : null, flips: cnt, baseline: bcnt ? bsum / bcnt : null, outBits: 2 * nb },
      sameXPairs: ks.filter((k) => xs[k - 1] === xs[n - k - 1]).length,   // x(kG) = x((n-k)G)
    };
  }

  root.ToyStats = { analyse };
  if (typeof module !== 'undefined') module.exports = root.ToyStats;
})(typeof window !== 'undefined' ? window : globalThis);
