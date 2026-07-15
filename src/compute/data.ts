import { KeyringPair } from "@polkadot/keyring/types";
import { getKeyring } from "../chain";
import { createAgreement, buildFee } from "../compute";
import type { Fee } from "../chain/types";

export interface DataContractParams {
  /** URL pointing to the data to store. */
  url: string;
  /** Guardian account IDs that participate in this contract. */
  guardians: string[];
  /**
   * Absolute fee offered for the contract. Defaults to 0.
   * `computeRate` is omitted: this is a `Dormant` contract and the
   * compute rate only applies to `Active` contracts.
   */
  fee: Fee;
  /** Block number deadline. Defaults to 0 (no deadline). */
  deadline?: number;
  /** Trusted guardian index in the guardians list. Defaults to 0. */
  trustIndex?: number;
}

/**
 * Submits a dormant data-store contract on-chain via `compute.agreement`.
 *
 * - No encryption (Plaintext cipher suite)
 * - Trusted confidentiality mode
 * - Input fetched from a URL
 * - No pre-check or post-check verifications
 * - Plain (unencrypted) result
 */
export async function dataContract(params: DataContractParams, account: KeyringPair) {
  const plaintextCipher = "Plaintext";

  const computeStep = {
    cipher: plaintextCipher,
    computerIndices: params.guardians.map((_, i) => i),
    ...buildFee(params.fee),
    deadline: params.deadline ?? 0,
    confidentiality: { Trusted: params.trustIndex ?? 0 },
    feeFunction: null,
    input: {
      Url: {
        url: Array.from(new TextEncoder().encode(params.url)),
      },
    },
    program: {
      NativeData: "DaFalse",
    },
  };

  const contract = {
    contractType: "Dormant" as const,
    guardians: params.guardians,
    preCheck: null,
    compute: computeStep,
    postCheck: null,
    resultCipher: plaintextCipher,
  };

  return createAgreement(contract, account);
}
