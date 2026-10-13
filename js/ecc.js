/* Elliptic curve y^2 = x^3 + b over F_p for the toy curve of Homework 1 (BigInt, affine coordinates).
 * Educational code: it is only meant for tiny curves. */
(function (root) {
  'use strict';

  const mod = (a, m) => { const r = a % m; return r >= 0n ? r : r + m; };

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
    constructor(p, b, G) { this.p = p; this.b = b; this.G = G; }

    isOnCurve(P) {
      return P === null || mod(P.y * P.y - P.x ** 3n - this.b, this.p) === 0n;
    }

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

    // order of P by brute force
    order(P) {
      let R = P, i = 1;
      while (R !== null) { R = this.add(R, P); i++; }
      return i;
    }

    // all the affine points, by brute force
    points() {
      const out = [];
      for (let x = 0n; x < this.p; x++) {
        for (let y = 0n; y < this.p; y++) if (this.isOnCurve({ x, y })) out.push({ x, y });
      }
      return out;
    }
  }

  const toy = new Curve(17n, 7n, { x: 1n, y: 5n });          // y^2 = x^3 + 7 (mod 17), G = (1, 5)

  root.ECC = { Curve, toy, mod };
  if (typeof module !== 'undefined') module.exports = root.ECC;
})(typeof window !== 'undefined' ? window : globalThis);
