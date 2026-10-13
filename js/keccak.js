/* Keccak sponge (FIPS 202 permutation Keccak-f[1600]) written from the specification, BigInt lanes.
 * keccak256 is the function Ethereum uses (original Keccak padding, suffix 0x01).
 * sha3_256 is the NIST standard (suffix 0x06). The permutation is the same, only the padding differs. */
(function (root) {
  'use strict';

  const MASK = (1n << 64n) - 1n;
  const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);

  // round constants from the LFSR of FIPS 202 (algorithm 5)
  function rcBit(t) {
    if (t % 255 === 0) return 1;
    let R = 1;
    for (let i = 1; i <= t % 255; i++) { R <<= 1; if (R & 0x100) R ^= 0x171; }
    return R & 1;
  }
  const RC = Array.from({ length: 24 }, (_, ir) => {
    let rc = 0n;
    for (let j = 0; j <= 6; j++) if (rcBit(j + 7 * ir)) rc |= 1n << BigInt((1 << j) - 1);
    return rc;
  });

  // rotation offsets of the rho step (FIPS 202, algorithm 2); lane (x, y) is stored at index x + 5y
  const ROT = Array.from({ length: 25 }, () => 0);
  {
    let x = 1, y = 0;
    for (let t = 0; t < 24; t++) {
      ROT[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;
      [x, y] = [y, (2 * x + 3 * y) % 5];
    }
  }

  function keccakF(A) {                                    // A: 25 lanes (BigInt), modified in place
    for (let round = 0; round < 24; round++) {
      // theta
      const C = [0, 1, 2, 3, 4].map((x) => A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20]);
      for (let x = 0; x < 5; x++) {
        const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
        for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D;
      }
      // rho and pi
      const B = new Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x + 5 * y]);
      }
      // chi
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          A[x + 5 * y] = B[x + 5 * y] ^ ((B[((x + 1) % 5) + 5 * y] ^ MASK) & B[((x + 2) % 5) + 5 * y]);
        }
      }
      // iota
      A[0] ^= RC[round];
    }
  }

  function sponge(msg, rate, suffix, outLen) {
    const padded = new Uint8Array(Math.ceil((msg.length + 1) / rate) * rate);
    padded.set(msg);
    padded[msg.length] ^= suffix;                          // domain-separation / padding byte
    padded[padded.length - 1] ^= 0x80;                     // final bit of the pad10*1 rule
    const A = new Array(25).fill(0n);
    for (let off = 0; off < padded.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) {                 // absorb: xor the block into the state, little-endian lanes
        let lane = 0n;
        for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + 8 * i + b]);
        A[i] ^= lane;
      }
      keccakF(A);
    }
    const out = new Uint8Array(outLen);                    // squeeze (one block is enough for 256 bits)
    for (let i = 0; i < outLen; i++) out[i] = Number((A[i >> 3] >> BigInt(8 * (i & 7))) & 0xffn);
    return out;
  }

  root.Keccak = {
    keccak256: (msg) => sponge(msg, 136, 0x01, 32),
    sha3_256: (msg) => sponge(msg, 136, 0x06, 32),
  };
  if (typeof module !== 'undefined') module.exports = root.Keccak;
})(typeof window !== 'undefined' ? window : globalThis);
