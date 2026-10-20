/* Toy ECC encryption scheme on secp256k1 with a small private-key range, and the attack on it (Homework 2). */
(function (root) {
  'use strict';
  const { secp256k1: C } = root.ECC || require('./ecc.js');

  // uniformly random BigInt in [0, n)
  function randomBelow(n) {
    const bits = n.toString(2).length, bytes = Math.ceil(bits / 8);
    for (;;) {
      let x = 0n;
      for (const b of crypto.getRandomValues(new Uint8Array(bytes))) x = (x << 8n) | BigInt(b);
      x &= (1n << BigInt(bits)) - 1n;
      if (x < n) return x;
    }
  }

  const bytesOf = (n) => { const out = new Uint8Array(32); for (let i = 31; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; } return out; };
  const keystream = (S) => bytesOf(S.x);                    // the 32 bytes of the x-coordinate of the shared point
  const xor = (a, b) => Uint8Array.from(a, (v, i) => v ^ b[i]);

  // key generation: the private key d is restricted to 1 .. 2^bits (a small range, so that the experiments are feasible)
  function keyPair(bits) {
    const d = 1n + randomBelow(1n << BigInt(bits));
    return { d, Q: C.mul(d) };
  }

  // encryption with the public key Q (message: at most 32 bytes): r is a fresh secret, R = rG is sent along
  function encrypt(message, Q) {
    const r = 1n + randomBelow(C.n - 1n);
    const R = C.mul(r);
    const S = C.mul(r, Q);                                  // shared point S = rQ
    return { R, c: xor(message, keystream(S)), r };
  }

  // decryption with the private key d: dR = d(rG) = r(dG) = rQ = S, so the keystream is the same
  function decrypt({ R, c }, d) {
    const S = C.mul(d, R);
    return xor(c, keystream(S));
  }

  // the attack: try every private key d = from, ..., to until dG = Q (only the public key Q is needed)
  function searchKeys(Q, from, to) {
    let P = C.mul(from);
    for (let d = from; d <= to; d++, P = C.add(P, C.G)) {
      if (P.x === Q.x && P.y === Q.y) return d;
    }
    return null;
  }

  root.ToyECC = { keyPair, encrypt, decrypt, searchKeys, keystream, bytesOf };
  if (typeof module !== 'undefined') module.exports = root.ToyECC;
})(typeof window !== 'undefined' ? window : globalThis);
