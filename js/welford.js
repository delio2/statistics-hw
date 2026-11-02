/* Welford's recurrences (Exercise 1) and the sampling experiment with m hackers (Exercise 2). */
(function (root) {
  'use strict';

  // Welford's recurrences: update the state (k, mean, ss) with the next value x. The core logic is the 3 lines below
  function update(state, x) {
    const delta = x - state.mean;                    // x_k - M_(k-1)
    state.mean += delta / ++state.k;                 // M_k = M_(k-1) + (x_k - M_(k-1)) / k                 (Knuth)
    state.ss += delta * (x - state.mean);            // SS_k = SS_(k-1) + (x_k - M_(k-1)) (x_k - M_k)       (Welford)
  }
  // the (sampling) variance of the values seen so far, for k >= 2
  const variance = (state) => state.ss / (state.k - 1);

  // the score of one penetration attempt: an integer between 0 and 10, uniform on {0, 1, ..., 10}.
  // Its theoretical mean is (0 + 10) / 2 = 5 and its theoretical variance is ((10 - 0 + 1)^2 - 1) / 12 = 10
  const MU = 5, SIGMA2 = 10;
  const score = () => Math.floor(Math.random() * 11);

  // one hacker attacks n systems: the sampling mean and the sampling variance of its n scores
  function hacker(n) {
    const state = { k: 0, mean: 0, ss: 0 };
    for (let i = 0; i < n; i++) update(state, score());
    return { mean: state.mean, variance: variance(state) };
  }

  // m hackers: the average and the standard deviation, across the hackers, of the sampling means and of
  // the sampling variances (computed with the same recurrences)
  function experiment(n, m) {
    const means = { k: 0, mean: 0, ss: 0 }, variances = { k: 0, mean: 0, ss: 0 };
    for (let j = 0; j < m; j++) {
      const h = hacker(n);
      update(means, h.mean);
      update(variances, h.variance);
    }
    return {
      n,
      avgMeans: means.mean, sdMeans: Math.sqrt(variance(means)),
      avgVariances: variances.mean, sdVariances: Math.sqrt(variance(variances)),
    };
  }

  root.Welford = { update, variance, MU, SIGMA2, score, hacker, experiment };
  if (typeof module !== 'undefined') module.exports = root.Welford;
})(typeof window !== 'undefined' ? window : globalThis);
