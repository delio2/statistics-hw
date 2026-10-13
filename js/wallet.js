/* The Ethereum wallet pipeline: mnemonic -> seed (BIP-39) -> private key (BIP-32 / BIP-44)
 * -> public key (secp256k1) -> address (Keccak-256) -> checksummed address (EIP-55).
 * HMAC-SHA512 and PBKDF2 come from the browser's built-in WebCrypto; everything else is in this project. */
(function (root) {
  'use strict';
  const E = root.ECC || require('./ecc.js');
  const K = root.Keccak || require('./keccak.js');
  const sha256 = root.sha256 || require('./sha256.js');
  const { secp256k1: C, bytesToBig, bigToBytes, toHex, utf8, concat } = E;
  const subtle = root.crypto && root.crypto.subtle;
  const HARDENED = 0x80000000;

  const ser32 = (i) => Uint8Array.of(i >>> 24, (i >>> 16) & 255, (i >>> 8) & 255, i & 255);

  // ---------- BIP-39 ----------
  // entropy (16, 20, 24, 28 or 32 bytes) + checksum (first ENT/32 bits of SHA-256) -> groups of 11 bits -> word indices
  function entropyToIndices(entropy) {
    const bits = Array.from(entropy, (b) => b.toString(2).padStart(8, '0')).join('');
    const csBits = entropy.length * 8 / 32;
    const checksum = Array.from(sha256(entropy), (b) => b.toString(2).padStart(8, '0')).join('').slice(0, csBits);
    const all = bits + checksum;
    const indices = [];
    for (let i = 0; i < all.length; i += 11) indices.push(parseInt(all.slice(i, i + 11), 2));
    return { bits, checksum, indices };
  }

  // seed = PBKDF2-HMAC-SHA512(password = mnemonic, salt = "mnemonic" + passphrase, 2048 iterations, 64 bytes)
  async function mnemonicToSeed(mnemonic, passphrase = '') {
    const key = await subtle.importKey('raw', utf8(mnemonic.normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
    const salt = utf8('mnemonic' + passphrase.normalize('NFKD'));
    return new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-512', salt, iterations: 2048 }, key, 512));
  }

  // ---------- BIP-32 ----------
  async function hmacSha512(keyBytes, data) {
    const key = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', key, data));
  }

  // master key: I = HMAC-SHA512(key = "Bitcoin seed", data = seed); left half = private key, right half = chain code
  async function masterKey(seed) {
    const I = await hmacSha512(utf8('Bitcoin seed'), seed);
    return { key: I.slice(0, 32), chain: I.slice(32) };
  }

  // child key derivation (private parent -> private child)
  async function childKey(parent, index) {
    const k = bytesToBig(parent.key);
    const data = index >= HARDENED
      ? concat(Uint8Array.of(0), parent.key, ser32(index))                        // hardened: uses the private key
      : concat(E.hexToBytes(E.compress(C.mul(k))), ser32(index));                  // normal: uses the public key
    const I = await hmacSha512(parent.chain, data);
    const il = bytesToBig(I.slice(0, 32));
    const child = (il + k) % C.n;
    if (il >= C.n || child === 0n) throw new Error('invalid key (probability < 2^-127): use the next index');
    return { key: bigToBytes(child), chain: I.slice(32) };
  }

  // "m/44'/60'/0'/0/0" -> [44+2^31, 60+2^31, 0+2^31, 0, 0]
  function parsePath(path) {
    const parts = path.trim().split('/');
    if (parts[0] !== 'm') throw new Error('the path must start with m');
    return parts.slice(1).map((p) => {
      const m = /^(\d+)('|h)?$/.exec(p);
      if (!m || Number(m[1]) >= HARDENED) throw new Error('bad path element: ' + p);
      return Number(m[1]) + (m[2] ? HARDENED : 0);
    });
  }

  async function derivePath(seed, path) {
    let node = await masterKey(seed);
    for (const index of parsePath(path)) node = await childKey(node, index);
    return node;
  }

  // ---------- secp256k1 -> Keccak-256 -> EIP-55 ----------
  function publicKey(privateKey) {                 // the 64 bytes x || y (Ethereum drops the 0x04 prefix)
    const Q = C.mul(bytesToBig(privateKey));
    return { x: Q.x, y: Q.y, bytes: concat(bigToBytes(Q.x), bigToBytes(Q.y)) };
  }

  const addressBytes = (pubBytes) => K.keccak256(pubBytes).slice(12);          // last 20 bytes of Keccak-256

  // EIP-55: a hex letter is written in upper case when the matching nibble of Keccak-256(lower-case address) is >= 8
  function toChecksumAddress(addressHex) {
    const lower = addressHex.toLowerCase().replace(/^0x/, '');
    const hash = toHex(K.keccak256(utf8(lower)));
    let out = '0x';
    for (let i = 0; i < lower.length; i++) {
      out += /[a-f]/.test(lower[i]) && parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
    }
    return out;
  }

  root.Wallet = {
    HARDENED, entropyToIndices, mnemonicToSeed, masterKey, childKey, parsePath, derivePath,
    publicKey, addressBytes, toChecksumAddress,
  };
  if (typeof module !== 'undefined') module.exports = root.Wallet;
})(typeof window !== 'undefined' ? window : globalThis);
