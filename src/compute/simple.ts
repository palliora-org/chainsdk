import { KeyringPair } from "@polkadot/keyring/types";
import { getKeyring } from "../chain";
import { createAgreement, buildFee } from "../compute";
import type { Fee } from "../chain/types";

export interface SimpleComputeParams {
  /** Guardian account IDs that participate in this compute. */
  guardians: string[];
  /** Input reference block number from which to read the tx payload. */
  inputBlockNumber?: number;
  /** Input reference extrinsic index within the input block. */
  inputExtrinsicIndex?: number;
  /** Program location as URL. */
  programUrl: string;
  /** Fee offered for the compute step. Defaults to 0 amount and 0 compute rate. */
  fee?: Fee;
  /** Block number deadline for the compute step. Defaults to 0 (no deadline). */
  deadline?: number;
  /** Trusted guardian index in the guardians list. Defaults to 0. */
  trustIndex?: number;
}

/**
 * Submits a minimal trusted compute agreement:
 * - no encryption (plaintext cipher)
 * - trusted confidentiality mode
 * - input from chain transaction reference
 * - program fetched from URL
 * - no pre/post verification
 */
export async function simpleCompute(params: SimpleComputeParams, account: KeyringPair) {
  const plaintextCipher = "Plaintext";
  const computeStep = {
    cipher: plaintextCipher,
    computerIndices: params.guardians.map((_, i) => i),
    ...buildFee(params.fee),
    deadline: params.deadline ?? 0,
    confidentiality: { Trusted: params.trustIndex ?? 0 },
    feeFunction: null,
    input: null,
    program: {
      Url: {
        url: Array.from(new TextEncoder().encode(params.programUrl)),
      },
    },
  };

  const contract = {
    contractType: "Active" as const,
    guardians: params.guardians,
    preCheck: null,
    compute: computeStep,
    postCheck: null,
    resultCipher: plaintextCipher,
  };

  return createAgreement(contract, account);
}
