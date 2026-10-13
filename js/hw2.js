/* Page logic for Homework 2: wallet pipeline demo, BIP-39 entropy, hash comparison, statistics. */
(function () {
  'use strict';
  const { hexToBytes, toHex, utf8 } = ECC;
  const { keccak256, sha3_256 } = Keccak;
  const $ = (id) => document.getElementById(id);

  // ---------- section 2: the pipeline ----------
  const EXAMPLES = {
    1: { mn: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' },
    2: { mn: 'test test test test test test test test test test test junk', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
  };
  const DEFAULT_PATH = "m/44'/60'/0'/0/0";

  async function runPipeline() {
    const table = $('w-out'), err = $('w-err');
    err.textContent = '';
    if (!(window.crypto && window.crypto.subtle)) {
      err.textContent = 'This browser does not offer WebCrypto here (it needs https, localhost or a local file).';
      return;
    }
    try {
      const mnemonic = $('w-mn').value.trim().split(/\s+/).join(' ');
      const passphrase = $('w-pass').value, path = $('w-path').value.trim();
      const seed = await Wallet.mnemonicToSeed(mnemonic, passphrase);
      const master = await Wallet.masterKey(seed);
      const node = await Wallet.derivePath(seed, path);
      const pub = Wallet.publicKey(node.key);
      const hash = keccak256(pub.bytes);
      const address = toHex(hash.slice(12));
      const checksummed = Wallet.toChecksumAddress(address);

      const known = Object.values(EXAMPLES).find((e) => e.mn === mnemonic);
      let reference = 'no reference value for this input';
      if (known && passphrase === '' && path === DEFAULT_PATH) {
        reference = checksummed === known.address
          ? `<span class="pass">matches</span> the address that wallets show for this test phrase (${known.address})`
          : '<span class="fail">does not match</span> the known address';
      }
      const row = (label, value) => `<tr><th>${label}</th><td class="mono-wrap">${value}</td></tr>`;
      table.innerHTML =
        row('1. Seed, 512 bits (BIP-39)', toHex(seed))
        + row('2. Master private key (BIP-32)', toHex(master.key))
        + row('Master chain code', toHex(master.chain))
        + row(`3. Private key at ${path} (BIP-32, BIP-44)`, toHex(node.key))
        + row('4. Public key x (secp256k1)', pub.x.toString(16).padStart(64, '0'))
        + row('Public key y', pub.y.toString(16).padStart(64, '0'))
        + row('5. Keccak-256 of x and y', toHex(hash))
        + row('Address: last 20 bytes', '0x' + address)
        + row('6. Checksummed address (EIP-55)', `<strong>${checksummed}</strong>`)
        + row('Check', reference);
      table.hidden = false;
    } catch (e) {
      table.hidden = true;
      err.textContent = 'Error: ' + e.message;
    }
  }
  $('w-run').addEventListener('click', runPipeline);
  for (const n of [1, 2]) {
    $('w-ex' + n).addEventListener('click', () => {
      $('w-mn').value = EXAMPLES[n].mn; $('w-pass').value = ''; $('w-path').value = DEFAULT_PATH;
      runPipeline();
    });
  }

  // ---------- section 3: BIP-39 entropy -> word indices ----------
  function renderEntropy() {
    const h = $('e-hex').value.trim().replace(/^0x/, '');
    const out = $('e-out');
    if (!/^[0-9a-fA-F]+$/.test(h) || ![32, 40, 48, 56, 64].includes(h.length)) {
      out.textContent = 'Enter 32, 40, 48, 56 or 64 hexadecimal digits (16, 20, 24, 28 or 32 bytes).';
      return;
    }
    const r = Wallet.entropyToIndices(hexToBytes(h));
    const all = r.bits + r.checksum;
    const rows = r.indices.map((idx, i) => `<tr><td>${i + 1}</td><td class="mono-wrap">${all.slice(11 * i, 11 * i + 11)}</td><td class="num">${idx}</td></tr>`).join('');
    out.innerHTML = `<p>${r.bits.length} bits of entropy + ${r.checksum.length} checksum bits (the first ${r.checksum.length} bits of its SHA-256 hash, <code>${r.checksum}</code>) `
      + `= ${all.length} bits = ${r.indices.length} groups of 11 bits = ${r.indices.length} words.</p>`
      + `<table><thead><tr><th>word</th><th>11 bits</th><th class="num">index in the list (0-2047)</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  $('e-hex').addEventListener('input', renderEntropy);
  renderEntropy();

  // ---------- section 5: SHA-256, Keccak-256 and SHA3-256 of the same text ----------
  function renderHashes() {
    const m = utf8($('h-in').value);
    const k = toHex(keccak256(m)), s3 = toHex(sha3_256(m));
    $('h-out').innerHTML = `<tr><th>SHA-256 (SHA-2)</th><td class="mono-wrap">${toHex(sha256(m))}</td></tr>`
      + `<tr><th>Keccak-256 (Ethereum)</th><td class="mono-wrap">${k}</td></tr>`
      + `<tr><th>SHA3-256 (NIST)</th><td class="mono-wrap">${s3}</td></tr>`
      + `<tr><th>Keccak-256 = SHA3-256?</th><td>${k === s3 ? '<span class="fail">yes</span>' : '<span class="pass">no, the digests differ</span>'}</td></tr>`;
  }
  $('h-in').addEventListener('input', renderHashes);
  renderHashes();

  // ---------- section 7: EIP-55 numbers ----------
  $('eip-bits').textContent = (40 * 6 / 16).toFixed(0);
  $('eip-pass').textContent = (Math.pow(13 / 16, 40) * 100).toFixed(4) + '%';

  // ---------- section 7: statistical tests on the three hash functions ----------
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

  $('run-hash').addEventListener('click', async () => {
    const N = Math.min(5000, Math.max(200, Number($('n-hash').value) | 0));
    const btn = $('run-hash'), prog = $('prog-hash');
    btn.disabled = true; prog.hidden = false; prog.value = 0;
    const fns = [sha256, keccak256, sha3_256];
    const results = [];
    for (let i = 0; i < fns.length; i++) {
      results.push(await Stats.runExperiment(fns[i], { samples: N, msgLen: 64, truncBits: 16, onProgress: (p) => { prog.value = (i + p) / fns.length; } }));
    }
    prog.hidden = true; btn.disabled = false;
    const J = results.map(judge);
    const cells = (f, key) => results.map((r, i) => `<td>${f(r)} ${flag(J[i][key])}</td>`).join('');
    $('hash-table').querySelector('tbody').innerHTML =
      `<tr><td>Avalanche: mean flipped bits (sd)</td><td>128 (8)</td>${cells((r) => `${r.avalanche.mean.toFixed(2)} (${r.avalanche.sd.toFixed(2)})`, 'aval')}</tr>`
      + `<tr><td>Bit balance: bits with |z| &gt; 3 / max |z|</td><td>≈ 0.7 / ≈ 2.9</td>${cells((r) => `${r.bits.nAbove3} / ${r.bits.maxAbsZ.toFixed(2)}`, 'bits')}</tr>`
      + `<tr><td>Byte uniformity: chi-square (255 df), p-value</td><td>≈ 255, p not extreme</td>${cells((r) => `${r.bytes.chi.toFixed(1)}, p = ${r.bytes.pChi.toFixed(3)}`, 'chi')}</tr>`
      + `<tr><td>Collisions on 16 bits: observed / expected</td><td>close</td>${cells((r) => `${r.coll.observed} / ${r.coll.expected.toFixed(1)}`, 'coll')}</tr>`;
    $('hash-table').hidden = false;
  });
})();
