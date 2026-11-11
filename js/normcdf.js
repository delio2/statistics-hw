/* Numerical computation of the standard normal CDF (Homework 5, exercise 2). */
(function (root) {
  'use strict';

  const SQRT_2PI = Math.sqrt(2 * Math.PI);

  // density phi(x) = exp(-x^2 / 2) / sqrt(2 pi)
  const density = (x) => Math.exp(-x * x / 2) / SQRT_2PI;

  // Series, |x| < 3: Phi(x) = 1/2 + phi(x) (x + x^3/3 + x^5/(3*5) + x^7/(3*5*7) + ...).
  // All the terms have the sign of x, so there is no cancellation among them.
  // Returns the value and the number of terms that were added
  function series(x) {
    let term = x, sum = x, n = 0;
    while (Math.abs(term) > 1e-17 * Math.abs(sum)) { n++; term *= x * x / (2 * n + 1); sum += term; }
    return { value: 0.5 + density(x) * sum, terms: n + 1 };
  }

  // Tail, x >= 3: Q(x) = 1 - Phi(x) = phi(x) / (x + 1/(x + 2/(x + 3/(x + ...)))),
  // a continued fraction evaluated with the modified Lentz algorithm.
  // Returns the value and the number of iterations
  function tail(x) {
    let f = x, C = x, D = 0, k = 1;
    for (; k <= 1000; k++) {
      D = 1 / (x + k * D);
      C = x + k / C;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-15) break;
    }
    return { value: density(x) / f, iterations: k };
  }

  // Phi(x): the series for |x| < 3; for the tails the continued fraction, with Phi(-x) = 1 - Phi(x)
  function Phi(x) {
    if (!Number.isFinite(x)) return Number.isNaN(x) ? NaN : (x > 0 ? 1 : 0);
    if (Math.abs(x) < 3) return series(x).value;
    const q = tail(Math.abs(x)).value;
    return x > 0 ? 1 - q : q;
  }

  // ---- the other approaches of the exercise, for comparison ----

  // numerical integration of the density from 0 to x with N subintervals, Phi(x) = 1/2 + integral:
  // the trapezoidal rule and Simpson's rule (N even)
  function trapezoid(x, N) {
    const h = x / N;
    let sum = (density(0) + density(x)) / 2;
    for (let i = 1; i < N; i++) sum += density(i * h);
    return 0.5 + sum * h;
  }
  function simpson(x, N) {
    const h = x / N;
    let sum = density(0) + density(x);
    for (let i = 1; i < N; i++) sum += (i % 2 ? 4 : 2) * density(i * h);
    return 0.5 + sum * h / 3;
  }

  // power series of erf: erf(z) = 2/sqrt(pi) * sum_n (-1)^n z^(2n+1) / (n! (2n+1)),
  // and Phi(x) = (1 + erf(x/sqrt 2)) / 2. The terms alternate in sign: for large |x| they
  // become huge before they decrease, and the sum loses its digits
  function erfSeries(z) {
    let term = z, sum = z; // term = (-1)^n z^(2n+1) / n!
    for (let n = 1; n <= 500; n++) {
      term *= -z * z / n;
      sum += term / (2 * n + 1);
      if (Math.abs(term / (2 * n + 1)) <= 1e-17 * Math.abs(sum)) break;
    }
    return 2 / Math.sqrt(Math.PI) * sum;
  }
  const PhiErfSeries = (x) => 0.5 * (1 + erfSeries(x / Math.SQRT2));

  // approximation of erf (Abramowitz and Stegun 7.1.26, |error| <= 1.5e-7),
  // and Phi(x) = (1 + erf(x/sqrt 2)) / 2
  function erfApprox(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const y = 1 - poly * Math.exp(-z * z);
    return z >= 0 ? y : -y;
  }
  const PhiErfApprox = (x) => 0.5 * (1 + erfApprox(x / Math.SQRT2));

  root.NormCDF = { density, series, tail, Phi, trapezoid, simpson, erfSeries, PhiErfSeries, erfApprox, PhiErfApprox };
  if (typeof module !== 'undefined') module.exports = root.NormCDF;
})(typeof window !== 'undefined' ? window : globalThis);
