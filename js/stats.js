/* Statistical tests used to judge a hash function (HW1).
 * Every test compares what we observe with what an ideal random function would give. */
(function (root) {
  'use strict';

  const popcount8 = new Uint8Array(256);
  for (let i = 0; i < 256; i++) popcount8[i] = (i & 1) + popcount8[i >> 1];

  function hamming(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += popcount8[a[i] ^ b[i]];
    return d;
  }

  // Standard normal CDF (Abramowitz-Stegun 7.1.26 erf approximation, error < 1.5e-7)
  function normalCdf(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const erf = 1 - poly * Math.exp(-(z * z) / 2);
    return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
  }

  // Upper-tail p-value of a chi-square statistic, Wilson-Hilferty approximation (good for k >= 30)
  function chi2PValue(chi, k) {
    const z = (Math.cbrt(chi / k) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
    return 1 - normalCdf(z);
  }

  const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
  const tick = () => new Promise((r) => setTimeout(r, 0));

  /**
   * hashFn: Uint8Array -> Uint8Array(32)
   * opts: {samples, msgLen, truncBits, onProgress}
   */
  async function runExperiment(hashFn, opts) {
    const N = opts.samples, L = opts.msgLen, K = opts.truncBits;
    const outBits = 256;

    // ---- 1. avalanche: flip one random input bit, count flipped output bits ----
    const hist = new Array(outBits + 1).fill(0);
    let sum = 0, sumSq = 0;
    // ---- pool of outputs reused for the other tests ----
    const ones = new Array(outBits).fill(0);
    const byteCount = new Array(256).fill(0);
    const seen = new Map();
    let collisions = 0;

    for (let t = 0; t < N; t++) {
      const m = randomBytes(L);
      const h = hashFn(m);

      const m2 = Uint8Array.from(m);
      const bit = Math.floor(Math.random() * L * 8);
      m2[bit >> 3] ^= 1 << (bit & 7);
      const d = hamming(h, hashFn(m2));
      hist[d]++; sum += d; sumSq += d * d;

      for (let j = 0; j < outBits; j++) ones[j] += (h[j >> 3] >> (7 - (j & 7))) & 1;
      for (const b of h) byteCount[b]++;

      // truncated output: first K bits, as an integer key
      let key = 0;
      for (let j = 0; j < K; j++) key = key * 2 + ((h[j >> 3] >> (7 - (j & 7))) & 1);
      const c = seen.get(key) || 0;
      collisions += c;           // each earlier equal value forms one colliding pair
      seen.set(key, c + 1);

      if (t % 100 === 0) { opts.onProgress && opts.onProgress(t / N); await tick(); }
    }

    const mean = sum / N;
    const sd = Math.sqrt(Math.max(0, sumSq / N - mean * mean));

    // ---- 2. bit frequency: each output bit should be 1 with probability 1/2 ----
    const z = ones.map((o) => (o - N / 2) / Math.sqrt(N / 4));
    const maxAbsZ = Math.max(...z.map(Math.abs));
    const nAbove3 = z.filter((v) => Math.abs(v) > 3).length;
    const meanFreq = ones.reduce((a, b) => a + b, 0) / (N * outBits);

    // ---- 3. byte uniformity: chi-square with 255 degrees of freedom ----
    const expectedBytes = (N * 32) / 256;
    const chi = byteCount.reduce((a, c) => a + (c - expectedBytes) ** 2 / expectedBytes, 0);
    const pChi = chi2PValue(chi, 255);

    // ---- 4. birthday test on K truncated bits ----
    const expColl = (N * (N - 1)) / 2 / 2 ** K;
    const zColl = (collisions - expColl) / Math.sqrt(expColl);

    return {
      N, L, K,
      avalanche: { mean, sd, hist, expMean: outBits / 2, expSd: Math.sqrt(outBits) / 2 },
      bits: { z, maxAbsZ, nAbove3, meanFreq },
      bytes: { counts: byteCount, chi, pChi },
      coll: { observed: collisions, expected: expColl, z: zColl },
    };
  }

  root.Stats = { hamming, normalCdf, chi2PValue, runExperiment };
  if (typeof module !== 'undefined') module.exports = root.Stats;
})(typeof window !== 'undefined' ? window : globalThis);
