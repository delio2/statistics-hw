/* Page logic for Homework 1: public key on the toy curve, double-and-add, animation, statistics. */
(function () {
  'use strict';
  const { toy, mod } = ECC;
  const $ = (id) => document.getElementById(id);
  const pt = (P) => (P === null ? 'O' : `(${P.x}, ${P.y})`);
  const samePoint = (A, B) => (A === null && B === null) || (A !== null && B !== null && A.x === B.x && A.y === B.y);
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const parseK = (s) => (/^\d+$/.test(s.trim()) && BigInt(s.trim()) > 0n ? BigInt(s.trim()) : null);

  // ---------- facts about the curve and the base point selectors ----------
  const points = toy.points();
  const orderOf = new Map(points.map((P) => [pt(P), toy.order(P)]));

  function fillSelect(sel) {
    sel.innerHTML = points.map((P) =>
      `<option value="${P.x},${P.y}"${P.x === 1n && P.y === 5n ? ' selected' : ''}>${pt(P)}, order ${orderOf.get(pt(P))}</option>`).join('');
  }
  const baseOf = (sel) => { const [x, y] = sel.value.split(',').map(BigInt); return { x, y }; };

  fillSelect($('base'));
  fillSelect($('s-base'));
  $('f-count').textContent = points.length;
  $('f-points').textContent = points.map(pt).reduce((rows, s, i) => {
    if (i % 6 === 0) rows.push([]);
    rows[rows.length - 1].push(s);
    return rows;
  }, []).map((r) => r.join('  ')).join('\n');

  // ---------- section 3: G, 2G, ..., kG ----------
  function describeAdd(prev, G) {                       // how prev + G is computed
    if (prev === null) return 'O + G = G';
    if (prev.x === G.x && mod(prev.y + G.y, toy.p) === 0n) return '(-G) + G = O';
    return `${prev.x === G.x ? 'tangent (doubling)' : 'chord'}, λ = ${toy.slope(prev, G)}`;
  }

  function renderCalc() {
    const G = baseOf($('base')), k = parseK($('k').value);
    const body = $('mult-table').querySelector('tbody');
    body.innerHTML = '';
    $('mult-note').textContent = '';
    if (k === null) { $('pk').textContent = 'The private key must be a positive integer.'; return; }
    const Q = toy.mul(k, G);
    $('pk').innerHTML = `TOY PUBLIC KEY: Q = ${k}G = <strong>${pt(Q)}</strong>`;
    if (k > 200n) { $('mult-note').textContent = 'k is large: the list G, 2G, ..., kG is not printed. See the double-and-add method below.'; return; }
    let R = null, html = '';
    for (let i = 1n; i <= k; i++) {
      const how = i === 1n ? 'base point G' : describeAdd(R, G);
      R = toy.add(R, G);
      html += `<tr${i === k ? ' class="hl"' : ''}><td>${i}</td><td>${pt(R)}</td><td>${how}</td></tr>`;
    }
    body.innerHTML = html;
    $('mult-note').textContent = samePoint(R, Q)
      ? 'Check: adding G one at a time and the double-and-add method of section 4 give the same point.'
      : 'Warning: the two methods disagree.';
  }

  // ---------- section 4: double-and-add ----------
  function renderTrace() {
    const G = baseOf($('base')), k = parseK($('k').value);
    const body = $('dbl-table').querySelector('tbody');
    if (k === null) { body.innerHTML = ''; $('dbl-note').textContent = ''; return; }
    const steps = [];
    toy.mul(k, G, steps);
    body.innerHTML = steps.slice(0, 60).map((s, i) =>
      `<tr><td>${i + 1}</td><td>${s.bit}</td><td>${s.op === 'double' ? 'double' : 'add G'}</td><td>${pt(s.R)}</td></tr>`).join('');
    const d = steps.filter((s) => s.op === 'double').length, a = steps.length - d;
    $('dbl-note').textContent = `${d} doublings and ${a} additions (${steps.length} operations), against ${k - 1n} additions with the first method.`
      + (steps.length > 60 ? ' Only the first 60 steps are shown.' : '');
  }

  function renderBig() {
    const G = baseOf($('base')), s = $('bigk').value.trim();
    if (!/^\d+$/.test(s) || BigInt(s) === 0n) { $('big-out').textContent = 'Enter a positive integer.'; return; }
    const K = BigInt(s), steps = [];
    const Q = toy.mul(K, G, steps);
    const n = BigInt(orderOf.get(pt(G))), r = K % n;
    const Q2 = r === 0n ? null : toy.mul(r, G);
    const d = steps.filter((x) => x.op === 'double').length;
    $('big-out').innerHTML = `k has ${K.toString(2).length} bits: ${d} doublings and ${steps.length - d} additions give Q = kG = <strong>${pt(Q)}</strong>. `
      + `Since n = ${n}, k mod n = ${r}, and ${r}G = ${pt(Q2)}: ${samePoint(Q, Q2) ? 'the same point.' : 'MISMATCH.'} `
      + `Adding G one at a time would need ${K - 1n} additions.`;
  }

  // ---------- section 5: slow-motion visualisation of G, 2G, ..., kG ----------
  let frames = [], shown = 0, timer = null;

  function buildFrames() {
    const G = baseOf($('base')), k = parseK($('k').value);
    frames = []; shown = 0;
    if (k === null) return;
    let R = null;
    const limit = k < 60n ? Number(k) : 60;
    for (let i = 1; i <= limit; i++) {
      R = toy.add(R, G);
      frames.push({ point: R, label: `${i}G`, text: `${i}G = ${i === 1 ? 'G' : `${i - 1}G + G`} = ${pt(R)}` });
    }
    if (k > 60n) frames[frames.length - 1].text += ' (only the first 60 steps are animated)';
  }

  function drawViz() {
    const cv = $('viz'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, p = Number(toy.p);
    const m = 40, cell = (W - 2 * m) / (p - 1);
    const X = (x) => m + Number(x) * cell, Y = (y) => H - m - Number(y) * cell;
    const accent = cssVar('--accent'), line = cssVar('--line'), muted = cssVar('--muted'), fg = cssVar('--fg');
    ctx.clearRect(0, 0, W, H);
    ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.fillStyle = muted;
    for (let i = 0; i < p; i++) {
      ctx.beginPath(); ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i), Y(p - 1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(0), Y(i)); ctx.lineTo(X(p - 1), Y(i)); ctx.stroke();
      if (i % 2 === 0) { ctx.fillText(i, X(i), H - m + 20); ctx.fillText(i, m - 16, Y(i) + 4); }
    }
    ctx.fillText('x', W - 12, H - m + 20); ctx.fillText('y', m - 16, 20);
    ctx.globalAlpha = 0.55; ctx.fillStyle = muted;                     // all points of the curve
    for (const P of points) { ctx.beginPath(); ctx.arc(X(P.x), Y(P.y), 5, 0, 2 * Math.PI); ctx.fill(); }
    ctx.globalAlpha = 1;

    const vis = frames.slice(0, shown).filter((f) => f.point !== null);
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath();
    vis.forEach((f, i) => (i ? ctx.lineTo(X(f.point.x), Y(f.point.y)) : ctx.moveTo(X(f.point.x), Y(f.point.y))));
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;

    ctx.textAlign = 'left';
    vis.forEach((f, i) => {
      const last = i === vis.length - 1 && frames[shown - 1].point !== null;
      ctx.fillStyle = accent; ctx.globalAlpha = last ? 1 : 0.55;
      ctx.beginPath(); ctx.arc(X(f.point.x), Y(f.point.y), last ? 10 : 7, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.font = last ? 'bold 14px system-ui' : '12px system-ui';
      ctx.fillText(f.label, X(f.point.x) + 11, Y(f.point.y) - 9);
    });
    const G = baseOf($('base'));                                       // the base point is always marked
    ctx.strokeStyle = fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(G.x), Y(G.y), 13, 0, 2 * Math.PI); ctx.stroke(); ctx.lineWidth = 1;

    $('viz-text').textContent = shown === 0 ? 'Press Play or Step. The ring marks the base point G.'
      : frames[shown - 1].text + (frames[shown - 1].point === null ? ' (the point at infinity is not on the grid)' : '')
        + (shown === frames.length ? ' [last step]' : '');
  }

  const delay = () => 1600 - Number($('speed').value) * 140;
  function setPlaying(on) {
    clearInterval(timer); timer = null;
    $('v-play').textContent = on ? 'Pause' : 'Play';
    if (!on) return;
    if (shown >= frames.length) shown = 0;
    timer = setInterval(() => {
      if (shown >= frames.length) { setPlaying(false); return; }
      shown++; drawViz();
    }, delay());
  }
  $('v-play').addEventListener('click', () => { const playing = timer !== null; setPlaying(!playing); if (!playing && shown < frames.length) { shown++; drawViz(); } });
  $('v-step').addEventListener('click', () => { setPlaying(false); if (shown >= frames.length) shown = 0; else shown++; drawViz(); });
  $('v-reset').addEventListener('click', () => { setPlaying(false); shown = 0; drawViz(); });
  $('speed').addEventListener('input', () => { if (timer !== null) setPlaying(true); });

  function refreshAll() {
    renderCalc(); renderTrace(); renderBig();
    setPlaying(false); buildFrames(); drawViz();
  }
  $('base').addEventListener('change', refreshAll);
  $('k').addEventListener('input', refreshAll);
  $('bigk').addEventListener('input', renderBig);

  // ---------- section 6: statistics ----------
  function drawBars(cv, counts, title) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = { l: 34, r: 8, t: 28, b: 28 };
    const accent = cssVar('--accent'), line = cssVar('--line'), muted = cssVar('--muted'), fg = cssVar('--fg');
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(2, ...counts), bw = (W - pad.l - pad.r) / counts.length;
    const Y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
    ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = fg;
    ctx.fillText(title, W / 2, 16);
    ctx.fillStyle = muted; ctx.strokeStyle = line;
    for (let v = 0; v <= max; v++) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(v, pad.l - 12, Y(v) + 4);
    }
    ctx.fillStyle = accent;
    counts.forEach((c, i) => { if (c > 0) ctx.fillRect(pad.l + i * bw + 2, Y(c), bw - 4, Y(0) - Y(c)); });
    ctx.fillStyle = muted;
    counts.forEach((_, i) => ctx.fillText(i, pad.l + i * bw + bw / 2, H - 10));
  }

  const f2 = (v) => (v === null ? 'n/a' : v.toFixed(2));
  function renderStats() {
    const G = baseOf($('s-base')), r = ToyStats.analyse(toy, G), p = Number(toy.p);
    $('s-summary').innerHTML = `G = ${pt(G)} has order <strong>n = ${r.n}</strong>, so the outputs kG for k = 1, ..., ${r.n - 1} are `
      + `<strong>${r.m}</strong> different points, out of the ${r.curvePoints} points of the curve.`;
    drawBars($('ch-x'), r.xCounts, 'frequency of each x value');
    drawBars($('ch-y'), r.yCounts, 'frequency of each y value');

    $('s-bits').innerHTML = '<thead><tr><th>Bit</th><th class="num">fraction of ones in x</th><th class="num">fraction of ones in y</th><th class="num">ideal</th></tr></thead><tbody>'
      + r.bitFreqX.map((fx, j) => `<tr><td>bit ${r.nb - 1 - j}${j === 0 ? ' (most significant)' : ''}</td><td class="num">${fx.toFixed(2)}</td><td class="num">${r.bitFreqY[j].toFixed(2)}</td><td class="num">0.50</td></tr>`).join('')
      + '</tbody>';

    const a = r.avalanche;
    $('s-tests').innerHTML = '<thead><tr><th>Property</th><th>Result</th></tr></thead><tbody>'
      + `<tr><td>Distinct values</td><td>${r.xCounts.filter((c) => c > 0).length} different x values and ${r.yCounts.filter((c) => c > 0).length} different y values for ${r.m} points</td></tr>`
      + `<tr><td>Uniformity (chi-square against a uniform distribution on 0, ..., ${p - 1})</td><td>x: ${r.xChi.toFixed(1)}, y: ${r.yChi.toFixed(1)} (${p - 1} degrees of freedom). `
      + `${r.expected >= 5 ? '' : `Not reliable: the expected count per value is ${r.expected.toFixed(2)}, below 5. `}Each output point appears exactly once, so the outputs are uniform on the subgroup by construction.</td></tr>`
      + `<tr><td>Correlation between k and the output</td><td>r(k, x) = ${f2(r.rKX)}, r(k, y) = ${f2(r.rKY)}, r(x, y) = ${f2(r.rXY)}${r.band === null ? '' : ` (a value beyond ±${r.band.toFixed(2)} would be significant)`}</td></tr>`
      + `<tr><td>Symmetry x(kG) = x((n - k)G)</td><td>true for ${r.sameXPairs} of ${r.m} values of k</td></tr>`
      + `<tr><td>Avalanche (flip one bit of k, count the changed bits of the ${a.outBits}-bit output)</td><td>${a.mean === null ? 'n/a (too few points)'
        : `mean ${a.mean.toFixed(2)} over ${a.flips} flips, against ${a.baseline.toFixed(2)} for two random different outputs`}</td></tr>`
      + '</tbody>';
  }
  $('s-base').addEventListener('change', renderStats);

  refreshAll();
  renderStats();
})();
