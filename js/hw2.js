/* Page logic for Homework 2: block-time simulation, catch-up table, ECDSA nonce-reuse demo. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const css = () => getComputedStyle(document.documentElement);

  // ---------- 2. mining as a Poisson process ----------
  function poissonPmf(k, lam) {
    let lf = 0;
    for (let i = 2; i <= k; i++) lf += Math.log(i);
    return Math.exp(-lam + k * Math.log(lam) - lf);
  }

  function drawIntervals(times, mean) {
    const cv = $('m-chart'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, pad = { l: 44, r: 12, t: 12, b: 32 };
    const c = css(), col = (v) => c.getPropertyValue(v).trim();
    ctx.clearRect(0, 0, W, H);
    const xmax = mean * 5, bins = 50, bw = xmax / bins;
    const counts = new Array(bins).fill(0);
    for (const t of times) { const b = Math.floor(t / bw); if (b < bins) counts[b]++; }
    const dens = counts.map((n) => n / times.length / bw);
    const theory = (x) => Math.exp(-x / mean) / mean;
    const ymax = Math.max(...dens, theory(0)) * 1.1;
    const X = (x) => pad.l + (x / xmax) * (W - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / ymax) * (H - pad.t - pad.b);

    ctx.strokeStyle = col('--line'); ctx.fillStyle = col('--muted'); ctx.font = '12px system-ui';
    ctx.beginPath(); ctx.moveTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    for (let i = 0; i <= 5; i++) ctx.fillText(Math.round((i * mean) / 60) + ' min', X(i * mean) - 14, H - pad.b + 16);
    ctx.fillText('time between blocks', W / 2 - 55, H - 4);
    ctx.fillText('density', 2, pad.t + 8);

    ctx.globalAlpha = 0.6; ctx.fillStyle = col('--accent');
    dens.forEach((v, i) => ctx.fillRect(X(i * bw) + 1, Y(v), X(bw) - X(0) - 1, Y(0) - Y(v)));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col('--fg'); ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = (i / 200) * xmax; i ? ctx.lineTo(X(x), Y(theory(x))) : ctx.moveTo(X(x), Y(theory(x))); }
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = col('--fg'); ctx.fillText('line: exponential density', W - 190, pad.t + 12);
  }

  $('m-run').addEventListener('click', () => {
    const n = Math.min(500000, Math.max(500, +$('m-blocks').value | 0));
    const mean = Math.max(1, +$('m-mean').value || 600);
    const times = new Float64Array(n);
    for (let i = 0; i < n; i++) times[i] = -mean * Math.log(1 - Math.random());   // 1-U is in (0,1]

    let sum = 0, sumSq = 0, over1h = 0;
    for (const t of times) { sum += t; sumSq += t * t; if (t > 3600) over1h++; }
    const m = sum / n, sd = Math.sqrt(sumSq / n - m * m);
    $('m-tab').innerHTML =
      `<tr><td>Mean (s)</td><td>${mean}</td><td>${m.toFixed(1)}</td></tr>` +
      `<tr><td>Standard deviation (s)</td><td>${mean}</td><td>${sd.toFixed(1)}</td></tr>` +
      `<tr><td>P(interval &gt; 1 hour)</td><td>${(Math.exp(-3600 / mean) * 100).toFixed(3)}%</td><td>${((over1h / n) * 100).toFixed(3)}%</td></tr>`;

    // blocks per hour: cumulative arrival times, count in consecutive windows of 3600 s
    const lam = 3600 / mean;
    const kMin = Math.max(0, Math.floor(lam - 4 * Math.sqrt(lam)));   // rows shown: mean +/- 4 sd
    const kMax = Math.ceil(lam + 4 * Math.sqrt(lam));
    const hours = new Map();
    let t = 0;
    for (const dt of times) { t += dt; const h = Math.floor(t / 3600); hours.set(h, (hours.get(h) || 0) + 1); }
    const totalHours = Math.floor(t / 3600);             // only complete windows
    if (totalHours < 1) {
      $('m-pois').innerHTML = '<tr><td colspan="3">Simulated time is shorter than one hour: increase the number of blocks.</td></tr>';
    } else {
      const freq = new Array(kMax + 1).fill(0);
      for (let h = 0; h < totalHours; h++) { const k = hours.get(h) || 0; if (k <= kMax) freq[k]++; }
      let rowsHtml = '';
      for (let k = kMin; k <= kMax; k++) {
        rowsHtml += `<tr><td>${k}</td><td>${(poissonPmf(k, lam) * 100).toFixed(2)}%</td><td>${((freq[k] / totalHours) * 100).toFixed(2)}%</td></tr>`;
      }
      $('m-pois').innerHTML = rowsHtml;
    }

    $('m-out').hidden = false;
    drawIntervals(times, mean);
  });

  // ---------- 3. attacker catch-up probability (Nakamoto, section 11) ----------
  function catchUp(q, z) {
    const p = 1 - q;
    if (q >= p) return 1;
    const lam = (z * q) / p;
    let pois = Math.exp(-lam), sum = 0;
    for (let k = 0; k <= z; k++) {
      if (k > 0) pois *= lam / k;
      sum += pois * (1 - Math.pow(q / p, z - k));
    }
    return 1 - sum;
  }
  const rows = [];
  for (let z = 0; z <= 10; z++) {
    rows.push(`<tr><td>${z}</td>` + [0.1, 0.3, 0.45].map((q) => `<td class="num">${catchUp(q, z).toFixed(7)}</td>`).join('') + '</tr>');
  }
  document.querySelector('#c-tab tbody').innerHTML = rows.join('');

  // ---------- 4. ECDSA nonce reuse ----------
  const { N, mul, inv, mod, bytesToBig, utf8 } = ECC;
  const hex = (n) => n.toString(16).padStart(64, '0');
  const rand = () => {
    let k = 0n;
    while (k === 0n) k = bytesToBig(crypto.getRandomValues(new Uint8Array(32))) % N;
    return k;
  };

  $('n-run').addEventListener('click', () => {
    const d = rand(), k = rand();                                  // private key and (reused!) nonce
    const z1 = bytesToBig(sha256(utf8('pay Alice 1 BTC'))) % N;
    const z2 = bytesToBig(sha256(utf8('pay Bob 2 BTC'))) % N;
    const r = mul(k).x % N;
    const kinv = inv(k, N);
    const s1 = mod(kinv * (z1 + r * d), N);
    const s2 = mod(kinv * (z2 + r * d), N);

    // attacker's side: only (z1, z2, r, s1, s2) are used
    const kRec = mod((z1 - z2) * inv(s1 - s2, N), N);
    const dRec = mod((s1 * kRec - z1) * inv(r, N), N);

    $('n-r').textContent = hex(r);
    $('n-s1').textContent = hex(s1);
    $('n-s2').textContent = hex(s2);
    $('n-k').textContent = hex(kRec);
    $('n-d').textContent = hex(dRec);
    $('n-ok').innerHTML = dRec === d ? '<span class="pass">yes - the private key is fully recovered</span>' : '<span class="fail">no</span>';
    $('n-tab').hidden = false;
  });
})();
