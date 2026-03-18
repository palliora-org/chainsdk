import { edwardsToMontgomeryPriv, edwardsToMontgomeryPub, x25519 } from '@noble/curves/ed25519';
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";

export const gen_stretched_key = (input: Uint8Array) => {
  const salt = new Uint8Array(32); // 32 bytes of zero
  const info = new TextEncoder().encode("aes_encryption");
  return hkdf(sha256, input, salt, info, 32); // 32 bytes output key length
};

export const gen_shared_key = (key: Uint8Array, pk: Uint8Array) => {
  const mg_key = edwardsToMontgomeryPriv(key);
  const mg_pk = edwardsToMontgomeryPub(pk);
  return x25519.getSharedSecret(mg_key, mg_pk);
};

export const encrypt = (plaintext: Uint8Array, key: Uint8Array) => {
  const cipher = new ChaCha20Poly1305(key);
  const nonce = new Uint8Array(cipher.nonceLength);
  globalThis.crypto.getRandomValues(nonce);
  const ciphertext = cipher.seal(nonce, plaintext);
  return { ciphertext, nonce };
};

export const decrypt = (ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array) => {
  const cipher = new ChaCha20Poly1305(key);
  const res = cipher.open(nonce, ciphertext);
  return res;
};
