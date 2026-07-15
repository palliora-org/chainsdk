import { KeyringPair } from "@polkadot/keyring/types";
import { getKeyring } from "../chain";
import { createAgreement, buildFee } from "../compute";
import type { Fee } from "../chain/types";

export interface InferenceComputeParams {
  /** Raw input data — string will be UTF-8 encoded, Uint8Array used as-is. */
  input: Uint8Array | string;
  /** Guardian account IDs that participate in this compute. */
  guardians: string[];
  /** Fee offered for the compute step. Defaults to 0 amount and 0 compute rate. */
  fee: Fee;
  /** Block number deadline for the compute step. Defaults to 0 (no deadline). */
  deadline?: number;
}

/**
 * Submits a plain (unencrypted, no-confidentiality) inference compute request
 * on-chain via the `compute.agreement` extrinsic.
 *
 * - Input is sent inline (no DA layer indirection).
 * - Program is the native `Inference` executor.
 * - Pre-check and post-check are no-ops (no verification).
 * - Cipher fields carry zero-value placeholders (unused in the trusted path).
 * - Result is returned in plain (no re-encryption).
 */
export async function inferenceCompute(params: InferenceComputeParams, account: KeyringPair) {
  const inputData =
    typeof params.input === "string"
      ? Array.from(new TextEncoder().encode(params.input))
      : Array.from(params.input);

  // No encryption — use the Plaintext variant of CipherSuite.
  const plaintextCipher = "Plaintext";

  // Primary compute step: inline input + native inference execution.
  const computeStep = {
    cipher: plaintextCipher,
    computerIndices: params.guardians.map((_, i) => i),
    ...buildFee(params.fee),
    deadline: params.deadline ?? 0,
    confidentiality: { Trusted: 0 },
    feeFunction: null,
    input: { Inline: { data: inputData } },
    program: { NativeExecute: "Inference" },
  };

  const contract = {
    contractType: "Active" as const,
    guardians: params.guardians,
    compute: computeStep,
    resultCipher: plaintextCipher,
  };

  return createAgreement(contract, account);
}
