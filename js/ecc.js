/* secp256k1 arithmetic + a toy elliptic-curve hash (ECMH style).
 * Curve: y^2 = x^3 + 7 over F_p  (the curve used by Bitcoin and Ethereum).
 * Educational code: BigInt, affine coordinates, NOT constant time, never use for real keys. */
(function (root) {
  'use strict';
  const sha256 = root.sha256 || require('./sha256.js');

  const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
  const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const B = 7n;
  const G = {
    x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
    y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n,
  };

  const mod = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m; };

  function powmod(b, e, m = P) {
    let r = 1n;
    b = mod(b, m);
    while (e > 0n) {
      if (e & 1n) r = (r * b) % m;
      b = (b * b) % m;
      e >>= 1n;
    }
    return r;
  }

  // modular inverse via extended Euclid
  function inv(a, m = P) {
    let r0 = mod(a, m), r1 = m, s0 = 1n, s1 = 0n;
    while (r1 !== 0n) {
      const q = r0 / r1;
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    if (r0 !== 1n) throw new Error('not invertible');
    return mod(s0, m);
  }

  // The point at infinity is represented by null.
  const isOnCurve = (pt) => pt === null || mod(pt.y * pt.y - pt.x * pt.x * pt.x - B) === 0n;

  function add(a, b) {
    if (a === null) return b;
    if (b === null) return a;
    let lambda;
    if (a.x === b.x) {
      if (mod(a.y + b.y) === 0n) return null; // a = -b
      lambda = mod(3n * a.x * a.x * inv(2n * a.y));
    } else {
      lambda = mod((b.y - a.y) * inv(b.x - a.x));
    }
    const x = mod(lambda * lambda - a.x - b.x);
    return { x, y: mod(lambda * (a.x - x) - a.y) };
  }

  function mul(k, pt = G) {
    k = mod(k, N);
    let acc = null, base = pt;
    while (k > 0n) {
      if (k & 1n) acc = add(acc, base);
      base = add(base, base);
      k >>= 1n;
    }
    return acc;
  }

  // ---------- byte helpers ----------
  function bytesToBig(u8) {
    let r = 0n;
    for (const b of u8) r = (r << 8n) | BigInt(b);
    return r;
  }
  function bigToBytes(n, len = 32) {
    const out = new Uint8Array(len);
    for (let i = len - 1; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; }
    return out;
  }
  const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
  const utf8 = (s) => new TextEncoder().encode(s);

  // ---------- toy hash: map a message to a curve point ("try and increment") ----------
  // H(m): for ctr = 0,1,2,... take x = SHA256(0x01 || ctr || m) mod p. If x^3+7 is a
  // quadratic residue, a point exists; its sign is taken from an independent hash bit.
  // About half of the x values work, so on average two attempts are needed.
  const SQRT_EXP = (P + 1n) / 4n; // valid because p = 3 (mod 4)

  function hashToPoint(msg) {
    for (let ctr = 0; ; ctr++) {
      const pre = new Uint8Array(5 + msg.length);
      pre[0] = 1;
      new DataView(pre.buffer).setUint32(1, ctr);
      pre.set(msg, 5);
      const h = sha256(pre);
      const x = bytesToBig(h) % P;
      const rhs = mod(x * x * x + B);
      const y0 = powmod(rhs, SQRT_EXP);
      if (mod(y0 * y0) !== rhs) continue;
      const signBit = sha256(Uint8Array.from([2, ...h]))[0] & 1;
      const y = (y0 & 1n) === BigInt(signBit) ? y0 : P - y0;
      return { point: { x, y }, counter: ctr };
    }
  }

  // ECMH: hash of a multiset = sum of the hashes of its elements (group operation).
  function multisetHash(msgs) {
    let acc = null;
    for (const m of msgs) acc = add(acc, hashToPoint(m).point);
    return acc;
  }

  function compress(pt) {
    if (pt === null) return '00';
    return (pt.y & 1n ? '03' : '02') + toHex(bigToBytes(pt.x));
  }

  root.ECC = {
    P, N, B, G, mod, powmod, inv, isOnCurve, add, mul,
    bytesToBig, bigToBytes, toHex, utf8, hashToPoint, multisetHash, compress,
  };
  if (typeof module !== 'undefined') module.exports = root.ECC;
})(typeof window !== 'undefined' ? window : globalThis);
