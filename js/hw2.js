/* Page logic for Homework 2: the two schemes, the Caesar cryptanalysis and the attack on the toy ECC scheme. */
(function () {
  'use strict';
  const { TEST_TEXT } = CORPUS;
  const $ = (id) => document.getElementById(id);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
  const big = (n) => n.toString(16).padStart(64, '0');
  const short = (s) => (s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s);
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const row = (label, value) => `<tr><th>${label}</th><td class="mono-wrap">${value}</td></tr>`;
  const keyShift = () => Math.min(25, Math.max(0, Number($('shift').value) | 0));

  // ---------- section 1: the toy ECC scheme ----------
  let current = null;                                          // the latest key pair, message and ciphertext

  function runEcc() {
    $('ecc-err').textContent = '';
    const text = $('msg').value, bytes = enc.encode(text);
    if (bytes.length < 1 || bytes.length > 32) { $('ecc-err').textContent = 'The message must have 1 to 32 bytes.'; return; }
    const { d, Q } = ToyECC.keyPair();
    const ct = ToyECC.encrypt(bytes, Q);
    const back = dec.decode(ToyECC.decrypt(ct, d));
    current = { d, Q, ct, text };
    $('ecc-out').innerHTML =
      row(`Private key d (secret, between 1 and 2<sup>${ToyECC.KEY_BITS}</sup>)`, d.toString())
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

  // ---------- section 3: cryptanalysis of the Caesar cipher ----------
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
  async function runAttack() {
    const btn = $('atk-run');
    if (!current) runEcc();
    if (!current) { $('atk-out').innerHTML = row('Error', 'fix the message of section 1 first'); return; }
    btn.disabled = true;
    const { d, Q, ct, text } = current, last = 1n << BigInt(ToyECC.KEY_BITS), CHUNK = 4096n;
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
    btn.disabled = false;
  }

  // ---------- wiring ----------
  $('ecc-run').addEventListener('click', runEcc);
  $('msg').addEventListener('input', renderCaesar);
  $('shift').addEventListener('input', renderCaesar);
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
