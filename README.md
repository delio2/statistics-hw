# Statistics for Cybersecurity - Homework

MSc Cybersecurity, Sapienza University of Rome, A.Y. 2026/27. Author: Delio Errosa.

Plain HTML and JavaScript, no libraries and no build step. Open `index.html` in a browser, or use the published version:
https://delio2.github.io/statistics-hw/

| Page | Content |
| --- | --- |
| `hw1-ex1.html` | Homework 1, exercise 1: private key to public key on the toy curve y² = x³ + 7 (mod 17), double-and-add, an animation and a statistical exploration |
| `hw1-ex2.html` | Homework 1, exercise 2: the Ethereum wallet pipeline: BIP-39, BIP-32, BIP-44, secp256k1, Keccak-256 and EIP-55, with a worked example, history and statistical properties |
| `hw2-caesar-vs-ecc.html` | Homework 2: Caesar cipher and a toy ECC scheme on secp256k1, their comparison, and the attacks on both |

Code (`js/`): `ecc.js` (elliptic curves), `toystats.js` and `hw1.js` (exercise 1), `corpus.js`, `caesar.js`, `toyecc.js` and `hw2.js` (Homework 2). Homework 1, exercise 2 is plain text and tables.

`homework1.html` and `homework2.html` are only redirects to `hw1-ex1.html` and `hw1-ex2.html` (old links).

Educational code: not constant time, do not use it for real keys.
