import type { PaliAmountInput } from "../utils/token";

/** Fee terms for a compute step: an absolute amount plus an optional dynamic compute rate. */
export interface Fee {
  /** Absolute fee offered for the compute step, in PALI. Defaults to 0. */
  amount?: PaliAmountInput;
  /** Compute rate used for dynamic fee calculation, in PALI. Defaults to 0. */
  computeRate?: PaliAmountInput;
}

/** On-chain proof that a result extrinsic was included in a block. */
export interface SubmissionReceipt {
  /** Hash of the result extrinsic (hex-encoded, "0x..."). */
  extrinsicHash: string;
  /** Block height at which the result extrinsic was included. */
  blockHeight: number;
  /** Zero-based index of the result extrinsic within the block. */
  extrinsicIndex: number;
}
