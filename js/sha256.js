/* Minimal synchronous SHA-256 (FIPS 180-4).
 * Written by hand so the pages work offline and from file:// without crypto.subtle.
 * Round constants are derived from the fractional parts of the cube roots of the
 * first 64 primes, as in the specification. */
(function (root) {
  'use strict';

  const primes = [];
  for (let n = 2; primes.length < 64; n++) {
    if (primes.every((p) => n % p !== 0)) primes.push(n);
  }
  const frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const K = Uint32Array.from(primes.map((p) => frac32(Math.cbrt(p))));
  const H0 = Uint32Array.from(primes.slice(0, 8).map((p) => frac32(Math.sqrt(p))));

  const ror = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(data) {
    const H = Uint32Array.from(H0);
    const len = data.length;
    const padLen = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(padLen);
    buf.set(data);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(padLen - 8, Math.floor((len * 8) / 4294967296));
    dv.setUint32(padLen - 4, (len * 8) >>> 0);
    const w = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + 4 * i);
      for (let i = 16; i < 64; i++) {
        const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d;
      H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(4 * i, H[i]);
    return out;
  }

  root.sha256 = sha256;
  if (typeof module !== 'undefined') module.exports = sha256;
})(typeof window !== 'undefined' ? window : globalThis);
