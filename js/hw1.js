/* Page logic for Homework 1: live demo, self-test and statistical experiment. */
(function () {
  'use strict';
  const { hashToPoint, add, mul, compress, isOnCurve, utf8, toHex, bigToBytes, G, N, P } = ECC;
  const $ = (id) => document.getElementById(id);
  const hex = (n) => n.toString(16).padStart(64, '0');

  // ---------- hash functions under test ----------
  const toyHash = (m) => bigToBytes(hashToPoint(m).point.x);
  const badHash = (m) => {                      // control: polynomial hash mod 2^256
    const M = 1n << 256n;
    let h = 0n, pw = 1n;
    for (const b of m) { h = (h + BigInt(b) * pw) % M; pw = (pw * 257n) % M; }
    return bigToBytes(h);
  };

  // ---------- live demo ----------
  function updateDemo() {
    const r = hashToPoint(utf8($('msg').value));
    $('o-att').textContent = r.counter + 1;
    $('o-x').textContent = hex(r.point.x);
    $('o-y').textContent = hex(r.point.y);
    $('o-dig').textContent = compress(r.point);
    $('o-curve').innerHTML = isOnCurve(r.point) ? '<span class="pass">yes</span>' : '<span class="fail">no</span>';
  }
  function updateMultiset() {
    const a = hashToPoint(utf8($('ma').value)).point;
    const b = hashToPoint(utf8($('mb').value)).point;
    const ab = compress(add(a, b)), ba = compress(add(b, a));
    $('s-ab').textContent = ab;
    $('s-ba').textContent = ba;
    $('s-eq').innerHTML = ab === ba ? '<span class="pass">yes (commutative, order does not matter)</span>' : '<span class="fail">no</span>';
  }
  $('msg').addEventListener('input', updateDemo);
  $('ma').addEventListener('input', updateMultiset);
  $('mb').addEventListener('input', updateMultiset);
  updateDemo();
  updateMultiset();

  // ---------- self test ----------
  function selfTest() {
    const a = utf8('a'), b = utf8('b');
    const checks = [
      ['SHA-256("abc") = ba7816bf...0015ad',
        () => toHex(sha256(utf8('abc'))) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
      ['G lies on the curve', () => isOnCurve(G)],
      ['2G has the published x-coordinate C6047F94...709EE5',
        () => hex(mul(2n).x).toUpperCase() === 'C6047F9441ED7D6D3045406E95C07CD85C778E4B8CEF3CA7ABAC09B95C709EE5'],
      ['n * G = point at infinity (n is the group order)', () => mul(N) === null],
      ['(n-1) * G = -G', () => { const q = mul(N - 1n); return q.x === G.x && q.y === P - G.y; }],
      ['H(m) is a point of the curve (200 random messages)', () => {
        for (let i = 0; i < 200; i++) if (!isOnCurve(hashToPoint(crypto.getRandomValues(new Uint8Array(12))).point)) return false;
        return true;
      }],
      ['H is deterministic', () => compress(hashToPoint(a).point) === compress(hashToPoint(a).point)],
      ['H(a) + H(b) = H(b) + H(a)', () => compress(add(hashToPoint(a).point, hashToPoint(b).point)) === compress(add(hashToPoint(b).point, hashToPoint(a).point))],
      ['H(a) + (H(b) + H(c)) = (H(a) + H(b)) + H(c)', () => {
        const c = utf8('c'), pa = hashToPoint(a).point, pb = hashToPoint(b).point, pc = hashToPoint(c).point;
        return compress(add(pa, add(pb, pc))) === compress(add(add(pa, pb), pc));
      }],
    ];
    const body = document.querySelector('#selftest tbody');
    for (const [name, fn] of checks) {
      let ok = false;
      try { ok = fn(); } catch (e) { ok = false; }
      body.insertAdjacentHTML('beforeend', `<tr><td>${name}</td><td>${ok ? '<span class="pass">pass</span>' : '<span class="fail">FAIL</span>'}</td></tr>`);
    }
  }
  selfTest();

  // ---------- statistical experiment ----------
  const fmt = (x, d = 2) => x.toFixed(d);
  const flag = (ok) => (ok ? '<span class="pass">pass</span>' : '<span class="fail">fail</span>');

  function judge(r) {
    const se = r.avalanche.expSd / Math.sqrt(r.N);
    return {
      aval: Math.abs(r.avalanche.mean - 128) < 4 * se && Math.abs(r.avalanche.sd / 8 - 1) < 0.15,
      bits: r.bits.nAbove3 <= 4 && r.bits.maxAbsZ < 4.5,
      chi: r.bytes.pChi > 0.001 && r.bytes.pChi < 0.999,
      coll: Math.abs(r.coll.z) < 4,
    };
  }

  function binomPmf256() {                       // Binomial(256, 1/2) via log-factorials
    const lf = [0];
    for (let i = 1; i <= 256; i++) lf[i] = lf[i - 1] + Math.log(i);
    return Array.from({ length: 257 }, (_, k) => Math.exp(lf[256] - lf[k] - lf[256 - k] - 256 * Math.LN2));
  }

  function drawChart(toy, bad) {
    const cv = $('chart'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, pad = { l: 44, r: 12, t: 12, b: 32 };
    const css = getComputedStyle(document.documentElement);
    const col = (v) => css.getPropertyValue(v).trim();
    ctx.clearRect(0, 0, W, H);
    const pmf = binomPmf256();
    const toyP = toy.avalanche.hist.map((c) => c / toy.N);
    const badP = bad.avalanche.hist.map((c) => c / bad.N);
    const ymax = Math.max(...pmf, ...toyP, ...badP) * 1.1;
    const X = (k) => pad.l + (k / 256) * (W - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / ymax) * (H - pad.t - pad.b);
    const bw = Math.max(1, (W - pad.l - pad.r) / 257 - 0.5);

    ctx.strokeStyle = col('--line'); ctx.fillStyle = col('--muted'); ctx.font = '12px system-ui';
    ctx.beginPath(); ctx.moveTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
    for (let k = 0; k <= 256; k += 32) {
      ctx.fillText(k, X(k) - 8, H - pad.b + 16);
      ctx.beginPath(); ctx.moveTo(X(k), H - pad.b); ctx.lineTo(X(k), H - pad.b + 4); ctx.stroke();
    }
    ctx.fillText('flipped output bits', W / 2 - 50, H - 4);
    ctx.fillText('frequency', 2, pad.t + 8);

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = col('--bad');
    badP.forEach((v, k) => { if (v > 0) ctx.fillRect(X(k) - bw / 2, Y(v), bw, Y(0) - Y(v)); });
    ctx.fillStyle = col('--accent');
    toyP.forEach((v, k) => { if (v > 0) ctx.fillRect(X(k) - bw / 2, Y(v), bw, Y(0) - Y(v)); });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = col('--fg'); ctx.lineWidth = 1.5; ctx.beginPath();
    pmf.forEach((v, k) => (k ? ctx.lineTo(X(k), Y(v)) : ctx.moveTo(X(k), Y(v))));
    ctx.stroke(); ctx.lineWidth = 1;

    ctx.fillStyle = col('--accent'); ctx.fillRect(W - 250, pad.t, 12, 12);
    ctx.fillStyle = col('--fg'); ctx.fillText('toy ECC hash', W - 232, pad.t + 11);
    ctx.fillStyle = col('--bad'); ctx.fillRect(W - 250, pad.t + 18, 12, 12);
    ctx.fillStyle = col('--fg'); ctx.fillText('control (bad hash)', W - 232, pad.t + 29);
    ctx.fillText('line: Binomial(256, 1/2)', W - 250, pad.t + 48);
  }

  $('run').addEventListener('click', async () => {
    const opts = {
      samples: Math.min(20000, Math.max(200, +$('p-n').value | 0)),
      msgLen: Math.min(256, Math.max(1, +$('p-len').value | 0)),
      truncBits: Math.min(30, Math.max(8, +$('p-k').value | 0)),
    };
    const btn = $('run'), prog = $('prog');
    btn.disabled = true; prog.hidden = false;
    const mk = (idx) => (p) => { prog.value = (idx + p) / 2; };
    const toy = await Stats.runExperiment(toyHash, { ...opts, onProgress: mk(0) });
    const bad = await Stats.runExperiment(badHash, { ...opts, onProgress: mk(1) });
    prog.hidden = true; btn.disabled = false;

    const jt = judge(toy), jb = judge(bad);
    const row = (name, ideal, f, key) =>
      `<tr><td>${name}</td><td>${ideal}</td><td>${f(toy)} ${flag(jt[key])}</td><td>${f(bad)} ${flag(jb[key])}</td></tr>`;
    $('res-body').innerHTML =
      row('Avalanche: mean flipped bits (sd)', '128 (8)', (r) => `${fmt(r.avalanche.mean)} (${fmt(r.avalanche.sd)})`, 'aval') +
      row('Bit balance: bits with |z| &gt; 3 / max |z|', '&asymp; 0.7 / &asymp; 2.9', (r) => `${r.bits.nAbove3} / ${fmt(r.bits.maxAbsZ)}`, 'bits') +
      row('Byte uniformity: chi-square (255 df), p-value', '&asymp; 255, p not extreme', (r) => `${fmt(r.bytes.chi, 1)}, p = ${r.bytes.pChi.toFixed(3)}`, 'chi') +
      row(`Collisions on ${opts.truncBits} bits: observed / expected`, 'close', (r) => `${r.coll.observed} / ${fmt(r.coll.expected, 1)}`, 'coll');
    $('results').hidden = false;
    drawChart(toy, bad);
  });
})();
