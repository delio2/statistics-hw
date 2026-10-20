/* Caesar cipher and its statistical cryptanalysis (Homework 2). */
(function (root) {
  'use strict';
  const { MODEL_TEXT } = root.CORPUS || require('./corpus.js');
  const A = 65;                                            // character code of 'A'

  // Caesar cipher: every letter is moved k places in the alphabet; other characters are kept
  const shift = (text, k) => text.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCharCode((((c.charCodeAt(0) - A + k) % 26) + 26) % 26 + A));
  const encrypt = (text, k) => shift(text, k);
  const decrypt = (text, k) => shift(text, -k);

  const letters = (text) => text.toUpperCase().replace(/[^A-Z]/g, '');

  function counts(text) {
    const c = new Array(26).fill(0);
    for (const ch of letters(text)) c[ch.charCodeAt(0) - A]++;
    return c;
  }

  // the model of the language: relative frequency of every letter in the corpus (+0.5 so that no letter has probability 0)
  const MODEL = (() => {
    const c = counts(MODEL_TEXT), n = c.reduce((a, b) => a + b, 0);
    return c.map((x) => (x + 0.5) / (n + 13));
  })();

  // chi-square distance between the letter counts of a text and the model: small = looks like the language
  function chiSquare(text) {
    const obs = counts(text), n = obs.reduce((a, b) => a + b, 0);
    return obs.reduce((sum, o, i) => sum + (o - n * MODEL[i]) ** 2 / (n * MODEL[i]), 0);
  }

  // key recovery: try the 26 shifts and keep the one whose decryption looks most like the language
  function crack(cipher, score = chiSquare) {
    const table = [];
    for (let k = 0; k < 26; k++) table.push({ key: k, score: score(decrypt(cipher, k)) });
    const best = table.reduce((b, row) => (row.score < b.score ? row : b));
    return { key: best.key, table };
  }

  // optional alternative: n-gram scoring with bigrams (minus the log-likelihood of the letter pairs, add-one smoothing)
  const BIGRAM = (() => {
    const t = letters(MODEL_TEXT), c = Array.from({ length: 26 }, () => new Array(26).fill(1));
    for (let i = 0; i + 1 < t.length; i++) c[t.charCodeAt(i) - A][t.charCodeAt(i + 1) - A]++;
    const total = c.flat().reduce((a, b) => a + b, 0);
    return c.map((row) => row.map((x) => Math.log(x / total)));
  })();
  function bigramScore(text) {
    const t = letters(text);
    let s = 0;
    for (let i = 0; i + 1 < t.length; i++) s -= BIGRAM[t.charCodeAt(i) - A][t.charCodeAt(i + 1) - A];
    return s;
  }

  root.Caesar = { shift, encrypt, decrypt, letters, counts, MODEL, chiSquare, crack, bigramScore };
  if (typeof module !== 'undefined') module.exports = root.Caesar;
})(typeof window !== 'undefined' ? window : globalThis);
