/* Page logic for Homework 4: runs the experiment of Exercise 2 for several values of n and fills the table. */
(function () {
  'use strict';
  const { MU, SIGMA2, experiment } = Welford;
  const M = 1000, NS = [10, 100, 1000, 10000];                 // number of hackers, values of n
  const num = (x) => x.toPrecision(4);

  const rows = NS.map((n) => experiment(n, M));
  document.getElementById('table').innerHTML = '<thead><tr><th class="num">n</th>'
    + `<th class="num">average of the sampling means<br><small>&mu; = ${MU}</small></th>`
    + `<th class="num">average of the sampling variances<br><small>&sigma;&sup2; = ${SIGMA2}</small></th>`
    + '<th class="num">standard deviation of the sampling means</th><th class="num">standard deviation of the sampling variances</th></tr></thead><tbody>'
    + rows.map((r) => `<tr><td class="num">${r.n}</td><td class="num">${num(r.avgMeans)}</td><td class="num">${num(r.avgVariances)}</td>`
      + `<td class="num">${num(r.sdMeans)}</td><td class="num">${num(r.sdVariances)}</td></tr>`).join('')
    + '</tbody>';
})();
