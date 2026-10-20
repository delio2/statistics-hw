/* Page logic for Homework 2: the two schemes, their statistics, the Caesar cryptanalysis and the attack on the toy ECC scheme. */
(function () {
  'use strict';
  const { secp256k1: C } = ECC;
  const { TEST_TEXT, MODEL_TEXT } = CORPUS;
  const $ = (id) => document.getElementById(id);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
  const big = (n) => n.toString(16).padStart(64, '0');
  const short = (s) => (s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s);
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const row = (label, value) => `<tr><th>${label}</th><td class="mono-wrap">${value}</td></tr>`;
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const keyShift = () => Math.min(25, Math.max(0, Number($('shift').value) | 0));

  // ---------- section 1: the toy ECC scheme ----------
  let current = null;                                          // the latest key pair, message and ciphertext

  function runEcc() {
    $('ecc-err').textContent = '';
    const text = $('msg').value, bytes = enc.encode(text);
    if (bytes.length < 1 || bytes.length > 32) { $('ecc-err').textContent = 'The message must have 1 to 32 bytes.'; return; }
    const bits = Math.min(20, Math.max(8, Number($('bits').value) | 0));
    const { d, Q } = ToyECC.keyPair(bits);
    const ct = ToyECC.encrypt(bytes, Q);
    const back = dec.decode(ToyECC.decrypt(ct, d));
    current = { d, Q, ct, text, bits };
    $('ecc-out').innerHTML =
      row(`Private key d (secret, between 1 and 2<sup>${bits}</sup>)`, d.toString())
      + row('Public key Q = dG (x-coordinate)', short(big(Q.x)))
      + row('Fresh secret r (256 bits)', short(big(ct.r)))
      + row('R = rG (x-coordinate), sent with the ciphertext', short(big(ct.R.x)))
      + row('Ciphertext c = message XOR keystream', hex(ct.c))
      + row('Decryption with d', esc(back))
      + row('Check', back === text ? 'the decrypted message is the original one' : 'MISMATCH');
  }

  // ---------- section 1: the Caesar cipher ----------
  function renderCaesar() {
    const k = keyShift(), c = Caesar.encrypt($('msg').value, k);
    $('caesar-out').innerHTML = row('Ciphertext', esc(c)) + row('Decryption with the same key', esc(Caesar.decrypt(c, k)));
  }

  // ---------- section 2: statistics of the two ciphertexts ----------
  function drawBars(cv, series, labels, title, labelEvery = 1) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pad = { l: 40, r: 8, t: 30, b: 26 };
    const line = cssVar('--line'), muted = cssVar('--muted'), fg = cssVar('--fg');
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...series.flatMap((s) => s.values)) * 1.1 || 1;
    const Y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
    ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = fg;
    ctx.fillText(title, W / 2, 14);
    ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = (max * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(W - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(v.toFixed(max < 3 ? 2 : 0), pad.l - 4, Y(v) + 4);
    }
    const gw = (W - pad.l - pad.r) / labels.length, bw = Math.max(1, (gw - 2) / series.length);
    series.forEach((s, si) => {
      ctx.fillStyle = s.color;
      s.values.forEach((v, i) => ctx.fillRect(pad.l + i * gw + 1 + si * bw, Y(v), bw, Y(0) - Y(v)));
    });
    ctx.fillStyle = muted; ctx.textAlign = 'center';
    labels.forEach((l, i) => { if (i % labelEvery === 0) ctx.fillText(l, pad.l + i * gw + gw / 2, H - 8); });
    ctx.textAlign = 'left';
    series.forEach((s, si) => { ctx.fillStyle = s.color; ctx.fillRect(W - 170, 6 + si * 13, 10, 10); ctx.fillStyle = fg; ctx.fillText(s.name, W - 156, 15 + si * 13); });
  }

  const chi2 = (counts) => { const n = counts.reduce((a, b) => a + b, 0), e = n / counts.length; return counts.reduce((s, o) => s + (o - e) ** 2 / e, 0); };
  const top = (counts) => counts.indexOf(Math.max(...counts));

  async function runStats() {
    const btn = $('stat-run'), status = $('stat-status');
    btn.disabled = true;
    const k = keyShift(), plain = Caesar.letters(TEST_TEXT), caesar = Caesar.encrypt(plain, k);
    const { Q } = ToyECC.keyPair(Math.min(20, Math.max(8, Number($('bits').value) | 0)));
    const bytes = enc.encode(plain), blocks = Math.ceil(bytes.length / 32), ecc = [];
    for (let i = 0; i < blocks; i++) {
      ecc.push(...ToyECC.encrypt(bytes.slice(32 * i, 32 * i + 32), Q).c);        // a fresh r for every block
      if (i % 5 === 0) { status.textContent = `Encrypting block ${i + 1} of ${blocks}...`; await tick(); }
    }
    status.textContent = '';
    const pc = Caesar.counts(plain), cc = Caesar.counts(caesar), bc = new Array(256).fill(0);
    ecc.forEach((b) => bc[b]++);
    const pct = (c) => c.map((x) => (100 * x) / c.reduce((a, b) => a + b, 0));
    const letter = (i) => String.fromCharCode(65 + i);
    drawBars($('ch-let'), [{ name: 'plaintext', color: cssVar('--accent'), values: pct(pc) }, { name: 'Caesar ciphertext', color: '#d98a2b', values: pct(cc) }],
      Array.from({ length: 26 }, (_, i) => letter(i)), 'letter frequencies (%)');
    drawBars($('ch-byte'), [{ name: 'toy ECC ciphertext', color: '#d98a2b', values: pct(bc) }],
      Array.from({ length: 256 }, (_, i) => String(i)), 'byte values of the ECC ciphertext (%)', 64);
    const n = plain.length, m = ecc.length;
    $('stat-table').innerHTML = '<thead><tr><th></th><th>Plaintext</th><th>Caesar ciphertext</th><th>Toy ECC ciphertext</th></tr></thead><tbody>'
      + `<tr><td>Symbols</td><td>${n} letters</td><td>${n} letters</td><td>${m} bytes</td></tr>`
      + `<tr><td>Most frequent symbol</td><td>${letter(top(pc))} (${(100 * pc[top(pc)] / n).toFixed(1)}%)</td><td>${letter(top(cc))} (${(100 * cc[top(cc)] / n).toFixed(1)}%)</td><td>byte ${top(bc)} (${(100 * bc[top(bc)] / m).toFixed(1)}%)</td></tr>`
      + `<tr><td>Chi-square against a uniform distribution</td><td>${chi2(pc).toFixed(0)} (26 letters, 95% limit 37.7)</td><td>${chi2(cc).toFixed(0)}, the same as the plaintext</td><td>${chi2(bc).toFixed(0)} (256 values, 95% limit 293)</td></tr>`
      + '</tbody>';
    $('stat-out').hidden = false;
    btn.disabled = false;
  }

  // ---------- section 3: cryptanalysis of the Caesar cipher ----------
  const ENGLISH = [8.17, 1.49, 2.78, 4.25, 12.70, 2.23, 2.02, 6.09, 6.97, 0.15, 0.77, 4.03, 2.41, 6.75, 7.51, 1.93, 0.10, 5.99, 6.33, 9.06, 2.76, 0.98, 2.36, 0.15, 1.97, 0.07];
  function pearson(a, b) {
    const n = a.length, ma = a.reduce((x, y) => x + y) / n, mb = b.reduce((x, y) => x + y) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb);
  }
  $('corr').textContent = pearson(Caesar.counts(MODEL_TEXT), ENGLISH).toFixed(2);

  function renderCrack() {
    const cipher = $('c-in').value;
    if (Caesar.letters(cipher).length < 5) { $('crack-sum').textContent = 'Enter a text with some letters.'; $('crack-table').innerHTML = ''; return; }
    const a = Caesar.crack(cipher), b = Caesar.crack(cipher, Caesar.bigramScore);
    $('crack-sum').innerHTML = `Letter frequencies (χ²) give the key <strong>${a.key}</strong>, bigram scoring gives the key <strong>${b.key}</strong>. `
      + `Recovered text: <span class="mono-wrap">${esc(Caesar.decrypt(cipher, a.key).slice(0, 120))}</span>`;
    $('crack-table').innerHTML = '<thead><tr><th>Key</th><th class="num">&chi;&sup2; (letters)</th><th class="num">bigram score</th><th>Decryption with this key (start)</th></tr></thead><tbody>'
      + a.table.map((r, i) => `<tr${r.key === a.key ? ' class="hl"' : ''}><td>${r.key}</td><td class="num">${r.score.toFixed(1)}</td><td class="num">${b.table[i].score.toFixed(1)}</td>`
        + `<td class="mono-wrap">${esc(Caesar.decrypt(cipher, r.key).slice(0, 40))}</td></tr>`).join('')
      + '</tbody>';
  }

  async function runExp() {
    const btn = $('exp-run');
    btn.disabled = true;
    const text = Caesar.letters(TEST_TEXT), lengths = [10, 20, 40, 80, 160, 320], trials = 300;
    let html = '<thead><tr><th>Letters in the ciphertext</th><th class="num">letter frequencies (&chi;&sup2;)</th><th class="num">bigram scoring</th></tr></thead><tbody>';
    for (const L of lengths) {
      let f = 0, g = 0;
      for (let t = 0; t < trials; t++) {
        const start = Math.floor(Math.random() * (text.length - L)), key = 1 + Math.floor(Math.random() * 25);
        const cipher = Caesar.encrypt(text.slice(start, start + L), key);
        if (Caesar.crack(cipher).key === key) f++;
        if (Caesar.crack(cipher, Caesar.bigramScore).key === key) g++;
      }
      html += `<tr><td>${L}</td><td class="num">${((100 * f) / trials).toFixed(0)}%</td><td class="num">${((100 * g) / trials).toFixed(0)}%</td></tr>`;
      await tick();
    }
    $('exp-table').innerHTML = html + '</tbody>';
    $('exp-table').hidden = false;
    btn.disabled = false;
  }

  // ---------- section 4: the attack on the toy ECC scheme ----------
  function measureSpeed() {                                      // point additions per second on this computer
    let P = C.G;
    const n = 3000, t0 = performance.now();
    for (let i = 0; i < n; i++) P = C.add(P, C.G);
    return n / ((performance.now() - t0) / 1000);
  }
  function fmtTime(s) {
    if (s < 1) return 'less than 1 second';
    if (s < 60) return `${s.toFixed(1)} seconds`;
    if (s < 3600) return `${(s / 60).toFixed(1)} minutes`;
    if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
    const years = s / 31557600;
    if (years < 1) return `${(s / 86400).toFixed(1)} days`;
    return years < 1e6 ? `${years.toFixed(0)} years` : `${years.toExponential(1).replace('e+', ' × 10^')} years`;
  }

  async function runAttack() {
    const btn = $('atk-run');
    if (!current) runEcc();
    if (!current) { $('atk-out').innerHTML = row('Error', 'fix the message of section 1 first'); return; }
    btn.disabled = true;
    const { d, Q, ct, text, bits } = current, last = 1n << BigInt(bits), CHUNK = 4096n;
    const t0 = performance.now();
    let found = null;
    for (let from = 1n; from <= last && found === null; from += CHUNK) {
      found = ToyECC.searchKeys(Q, from, from + CHUNK - 1n < last ? from + CHUNK - 1n : last);
      $('atk-out').innerHTML = row('Searching', `private keys up to ${from + CHUNK - 1n} tried...`);
      await tick();
    }
    const ms = performance.now() - t0;
    $('atk-out').innerHTML =
      row('Public key Q (x-coordinate), known to the attacker', short(big(Q.x)))
      + row('Private key found', found === null ? 'not found' : found.toString())
      + row('Real private key', d.toString())
      + row('Steps (point additions) and time', `${found} steps, ${(ms / 1000).toFixed(2)} seconds`)
      + row('Message decrypted with the key found', found === null ? '-' : esc(dec.decode(ToyECC.decrypt(ct, found))))
      + row('Original message', esc(text));
    const speed = measureSpeed();
    let html = `<caption class="sub">Measured speed on this computer: ${Math.round(speed).toLocaleString('en-US')} point additions per second.</caption>`
      + '<thead><tr><th>Private key size</th><th>Brute force (about 2<sup>b-1</sup> steps on average)</th><th>Square-root attacks (about 2<sup>b/2</sup> steps)</th></tr></thead><tbody>';
    for (const b of [16, 32, 64, 128, 256]) {
      html += `<tr><td>${b} bits</td><td>${fmtTime(2 ** (b - 1) / speed)}</td><td>${fmtTime(2 ** (b / 2) / speed)}</td></tr>`;
    }
    $('atk-scale').innerHTML = html + '</tbody>';
    $('atk-scale').hidden = false;
    btn.disabled = false;
  }

  // ---------- wiring ----------
  $('ecc-run').addEventListener('click', runEcc);
  $('msg').addEventListener('input', renderCaesar);
  $('shift').addEventListener('input', renderCaesar);
  $('stat-run').addEventListener('click', runStats);
  $('c-in').addEventListener('input', renderCrack);
  $('c-load').addEventListener('click', () => { $('c-in').value = Caesar.encrypt($('msg').value, keyShift()); renderCrack(); });
  $('exp-run').addEventListener('click', runExp);
  $('atk-run').addEventListener('click', runAttack);

  runEcc();
  renderCaesar();
  const start = TEST_TEXT.indexOf('During the first weeks');
  $('c-in').value = Caesar.encrypt(TEST_TEXT.slice(start, start + 170), 11);
  renderCrack();
})();
