# Statistics for Cybersecurity - Homework

MSc Cybersecurity, Sapienza University of Rome, A.Y. 2026/27. Author: Delio Errosa.

Plain HTML and JavaScript, no libraries and no build step. Open `index.html` in a browser, or use the published version:
https://delio2.github.io/statistics-hw/

| Page | Content |
| --- | --- |
| `homework1.html` | Private key to public key on the toy curve y² = x³ + 7 (mod 17), double-and-add, an animation and a statistical exploration |
| `homework2.html` | The Ethereum wallet pipeline: BIP-39, BIP-32, BIP-44, secp256k1, Keccak-256 and EIP-55, with a live demo and statistical tests |

Code (`js/`): `ecc.js` (elliptic curves, toy curve and secp256k1), `sha256.js`, `keccak.js`, `wallet.js` (BIP-39/32/44 and EIP-55), `stats.js` and `toystats.js` (statistics), `hw1.js` and `hw2.js` (page logic).

Educational code: not constant time, do not use it for real keys.
