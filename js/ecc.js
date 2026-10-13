/* Elliptic curves y^2 = x^3 + b over F_p (BigInt, affine coordinates).
 * The same Curve class is used for the toy curve of Homework 1 (p = 17) and for secp256k1.
 * Educational code: not constant time, never use it for real keys. */
(function (root) {
  'use strict';

  const mod = (a, m) => { const r = a % m; return r >= 0n ? r : r + m; };

  function powmod(b, e, m) {
    let r = 1n;
    b = mod(b, m);
    while (e > 0n) {
      if (e & 1n) r = (r * b) % m;
      b = (b * b) % m;
      e >>= 1n;
    }
    return r;
  }

  // modular inverse with the extended Euclid algorithm
  function inv(a, m) {
    let r0 = mod(a, m), r1 = m, s0 = 1n, s1 = 0n;
    while (r1 !== 0n) {
      const q = r0 / r1;
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    if (r0 !== 1n) throw new Error('not invertible');
    return mod(s0, m);
  }

  // A point is {x, y}; the point at infinity (the neutral element) is null.
  class Curve {
    constructor(p, b, G, n = null) { this.p = p; this.b = b; this.G = G; this.n = n; }

    isOnCurve(P) {
      return P === null || mod(P.y * P.y - P.x ** 3n - this.b, this.p) === 0n;
    }

    neg(P) { return P === null ? null : { x: P.x, y: mod(-P.y, this.p) }; }

    // slope of the chord through P and Q, or of the tangent when P = Q (the curve has a = 0)
    slope(P, Q) {
      const p = this.p;
      if (P.x === Q.x) return mod(3n * P.x * P.x * inv(2n * P.y, p), p);
      return mod((Q.y - P.y) * inv(Q.x - P.x, p), p);
    }

    add(P, Q) {
      if (P === null) return Q;
      if (Q === null) return P;
      if (P.x === Q.x && mod(P.y + Q.y, this.p) === 0n) return null;   // Q = -P
      const l = this.slope(P, Q);
      const x = mod(l * l - P.x - Q.x, this.p);
      return { x, y: mod(l * (P.x - x) - P.y, this.p) };
    }

    // double-and-add, from the most significant bit of k down to the least significant one.
    // If steps is an array, every doubling and addition is recorded in it.
    mul(k, P = this.G, steps = null) {
      if (this.n !== null) k = mod(k, this.n);
      let R = null;
      for (const bit of k.toString(2)) {
        R = this.add(R, R);
        if (steps) steps.push({ op: 'double', bit, R });
        if (bit === '1') {
          R = this.add(R, P);
          if (steps) steps.push({ op: 'add', bit, R });
        }
      }
      return R;
    }

    // order of P by brute force (only for small curves)
    order(P) {
      let R = P, i = 1;
      while (R !== null) { R = this.add(R, P); i++; }
      return i;
    }

    // discrete logarithm by brute force: the smallest k >= 1 with k*P = Q (feasible only on tiny curves)
    dlog(P, Q) {
      let R = P;
      for (let k = 1n; R !== null; k++, R = this.add(R, P)) {
        if (R.x === Q.x && R.y === Q.y) return k;
      }
      return null;
    }

    // all affine points by brute force (only for small p)
    points() {
      const out = [];
      for (let x = 0n; x < this.p; x++) {
        for (let y = 0n; y < this.p; y++) if (this.isOnCurve({ x, y })) out.push({ x, y });
      }
      return out;
    }
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
  const hexToBytes = (h) => Uint8Array.from(h.match(/../g) || [], (b) => parseInt(b, 16));
  const utf8 = (s) => new TextEncoder().encode(s);
  const concat = (...arrs) => {
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };

  // ---------- the two curves ----------
  const toy = new Curve(17n, 7n, { x: 1n, y: 5n });          // y^2 = x^3 + 7 (mod 17), G = (1, 5)

  const secp256k1 = new Curve(                                // y^2 = x^3 + 7 over p = 2^256 - 2^32 - 977
    0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
    7n,
    {
      x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
      y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n,
    },
    0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
  );

  // compressed SEC1 encoding: 02/03 (parity of y) followed by x
  const compress = (pt) => (pt === null ? '00' : (pt.y & 1n ? '03' : '02') + toHex(bigToBytes(pt.x)));

  root.ECC = { Curve, toy, secp256k1, mod, powmod, inv, bytesToBig, bigToBytes, toHex, hexToBytes, utf8, concat, compress };
  if (typeof module !== 'undefined') module.exports = root.ECC;
})(typeof window !== 'undefined' ? window : globalThis);
