import { randomBytes } from 'crypto';

/**
 * Generates a random bytes of the specified length.
 * @param length Number of bytes.
 * @returns Buffer containing random bytes.
 */
export function generateRandomBytes(length: number = 32): Buffer {
    return randomBytes(length);
}