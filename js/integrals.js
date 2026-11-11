/* Numerical integration with a Riemann-type sum and a Lebesgue-type sum (Homework 5, exercise 1). */
(function (root) {
  'use strict';

  // Riemann: partition [a, b] into N equal subintervals and add f(midpoint) * width
  function riemann(f, a, b, N) {
    const dx = (b - a) / N;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += f(a + (i + 0.5) * dx);
    return sum * dx;
  }

  // Lebesgue (f >= 0): partition the range [0, M], M = largest value, into K equal levels
  // E_j = [y_(j-1), y_j), y_j = j M / K, and add y_(j-1) * (measure of the preimage of E_j).
  // The preimage is measured on the grid of the domain: the total width of the N subintervals
  // (the same as above) whose midpoint value lies in E_j. The last level also contains M
  function lebesgue(f, a, b, N, K) {
    const dx = (b - a) / N, values = new Float64Array(N);
    let M = 0;
    for (let i = 0; i < N; i++) { values[i] = f(a + (i + 0.5) * dx); if (values[i] > M) M = values[i]; }
    const h = M / K, measure = new Float64Array(K);
    for (let i = 0; i < N; i++) measure[Math.min(K - 1, Math.floor(values[i] / h))] += dx;
    let sum = 0;
    for (let j = 0; j < K; j++) sum += j * h * measure[j];
    return sum;
  }

  // the functions f1, ..., f7 of the exercise, with the exact value of their integral
  const FUNCTIONS = [
    { label: 'sin x', domain: '[0, &pi;]', a: 0, b: Math.PI, f: Math.sin, exact: 2 },
    { label: 'x&sup2;', domain: '[0, 1]', a: 0, b: 1, f: (x) => x * x, exact: 1 / 3 },
    { label: '1 if x &lt; 0.5, 3 if x &ge; 0.5', domain: '[0, 1]', a: 0, b: 1, f: (x) => (x < 0.5 ? 1 : 3), exact: 2 },
    { label: '|x &minus; 0.5|', domain: '[0, 1]', a: 0, b: 1, f: (x) => Math.abs(x - 0.5), exact: 0.25 },
    { label: '1/&radic;x', domain: '(0, 1]', a: 0, b: 1, f: (x) => 1 / Math.sqrt(x), exact: 2 },
    { label: '1 if x &lt; 0.5, 0 if x &ge; 0.5', domain: '[0, 1]', a: 0, b: 1, f: (x) => (x < 0.5 ? 1 : 0), exact: 0.5 },
    { label: 'sin x / x', domain: '[0, &pi;]', a: 0, b: Math.PI, f: (x) => Math.sin(x) / x, exact: 1.8519370519824662 },
  ];

  // The pathological functions. A computer stores only rational numbers, so a point is described,
  // not computed: a rational point is the pair [p, q] = p/q, an irrational point is null
  const gcd = (p, q) => (q === 0 ? p : gcd(q, p % q));
  // Dirichlet: 1 if x is rational, 0 if x is irrational
  const dirichlet = (point) => (point === null ? 0 : 1);
  // Thomae: 1/q if x = p/q in lowest terms, 0 if x is irrational
  const thomae = (point) => (point === null ? 0 : gcd(point[0], point[1]) / point[1]);

  // Riemann sum on [0, 1] with N subintervals and one tag in each: the rational midpoint
  // (2i - 1)/(2N), or an irrational point
  function taggedRiemann(f, N, rational) {
    let sum = 0;
    for (let i = 1; i <= N; i++) sum += f(rational ? [2 * i - 1, 2 * N] : null) / N;
    return sum;
  }

  root.Integrals = { riemann, lebesgue, FUNCTIONS, dirichlet, thomae, taggedRiemann };
  if (typeof module !== 'undefined') module.exports = root.Integrals;
})(typeof window !== 'undefined' ? window : globalThis);
