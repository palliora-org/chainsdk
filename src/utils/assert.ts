/**
 * Isomorphic assert utility that works in both Node.js and browser environments.
 * Replaces Node.js built-in assert for client-side compatibility.
 */
export function assert(
  condition: unknown,
  message?: string
): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}
