/**
 * Generates random bytes of the specified length.
 * Uses Web Crypto API (crypto.getRandomValues) - available in all modern browsers
 * and Node.js 18+.
 *
 * @param length Number of bytes.
 * @returns Uint8Array containing random bytes.
 */
export function generateRandomBytes(length: number = 32): Uint8Array {
  const bytes = new Uint8Array(length);
  const cr = globalThis.crypto;
  if (!cr || typeof cr.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues is not available. Ensure you're running in a supported environment (browser or Node.js 18+)."
    );
  }
  cr.getRandomValues(bytes);
  return bytes;
}
