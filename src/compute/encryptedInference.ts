import { edwardsToMontgomeryPub } from "@noble/curves/ed25519";
import type { KeyringPair } from "@polkadot/keyring/types";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { createAgreement, buildFee } from "../compute";
import { getApi, signAndSend } from "../chain";
import { encrypt, gen_stretched_key, testCrypt } from "../crypto";
import { hexToUint8Array, Hex } from "../utils";
import type { Fee } from "../chain/types";
import type { GuardianGroupInfo } from "../da/types";

export interface EncryptedInferenceSubscriptionParams {
  /** Guardian account addresses that participate in this compute. */
  guardians: string[];
  /** Fee offered for the compute step. Defaults to 0. */
  fee?: Fee;
  /** Block number deadline. Defaults to 0 (no deadline). */
  deadline?: number;
}

export interface EncryptedInferenceSubscriptionInvocationParams {
  /** Hex-encoded agreement ID returned by encryptedInferenceSubscription. */
  agreementId: string;
  /** Input payload to encrypt and submit. String is UTF-8 encoded. */
  input: Uint8Array | string;
  /** Guardian addresses to route the compute request to. */
  guardians: string[];
  /** Guardian group cryptographic parameters for threshold encryption. */
  guardianInfo: GuardianGroupInfo;
}

export interface EncryptedInferenceComputeParams {
  /** Input payload to encrypt and submit. String is UTF-8 encoded. */
  input: Uint8Array | string;
  /** Guardian account addresses that participate in this compute. */
  guardians: string[];
  /** Guardian group cryptographic parameters for threshold encryption. */
  guardianInfo: GuardianGroupInfo;
  /** Fee offered for the compute step. Defaults to 0. */
  fee?: Fee;
  /** Block number deadline. Defaults to 0 (no deadline). */
  deadline?: number;
}

/**
 * Creates a Dormant agreement that registers encrypted inference compute terms.
 * The agreement ID returned here is passed to encryptedInferenceSubscriptionInvocation
 * for each subsequent encrypted inference call.
 */
export async function encryptedInferenceSubscription(
  params: EncryptedInferenceSubscriptionParams,
  account: KeyringPair,
) {
  const computeStep = {
    cipher: "Plaintext",
    computerIndices: params.guardians.map((_, i) => i),
    ...buildFee(params.fee),
    deadline: params.deadline ?? 0,
    confidentiality: { Trusted: 0 },
    feeFunction: null,
    input: null,
    program: { NativeExecute: "Inference" },
  };

  const contract = {
    contractType: "Dormant" as const,
    guardians: params.guardians,
    preCheck: null,
    compute: computeStep,
    postCheck: null,
    resultCipher: "Plaintext",
  };

  return createAgreement(contract, account);
}

/**
 * Invokes an existing encrypted inference subscription agreement with a
 * threshold-encrypted input payload. The result is encrypted back to encAccount.
 *
 * @param params   - Agreement ID, input payload, guardians, and guardian group crypto params.
 * @param encAccount - Ed25519 keypair whose public key is used to receive the encrypted result.
 * @param account  - Keypair used to sign and submit the transaction.
 */
export async function encryptedInferenceSubscriptionInvocation(
  params: EncryptedInferenceSubscriptionInvocationParams,
  encAccount: KeyringPair,
  account: KeyringPair,
) {
  const api = await getApi();
  if (!api) throw new Error("Api not initialized");

  const inputBytes =
    typeof params.input === "string"
      ? new TextEncoder().encode(params.input)
      : params.input;

  const { encoded: cyphtxt, ikm } = testCrypt(
    params.guardianInfo.tauParams,
    params.guardianInfo.aggKey,
  );

  const sharedKey = gen_stretched_key(hexToUint8Array(ikm as Hex));
  const { ciphertext, nonce } = encrypt(inputBytes, sharedKey);

  const cyphtxtBytes = hexToUint8Array(cyphtxt as Hex);
  const groupPkBytes = hexToUint8Array(params.guardianInfo.groupPk as Hex);
  const tauParamsBytes = hexToUint8Array(params.guardianInfo.tauParams as Hex);

  const tx = (
    api.tx as Record<
      string,
      Record<string, (...args: unknown[]) => SubmittableExtrinsic<"promise">>
    >
  )["dataAvailability"]["daccComputeRequest"](
    edwardsToMontgomeryPub(encAccount.publicKey),
    nonce,
    Array.from(ciphertext),
    params.guardians[0],
    Array.from(cyphtxtBytes),
    Array.from(groupPkBytes),
    Array.from(tauParamsBytes),
    params.guardians,
  );

  const idHex = params.agreementId.startsWith("0x")
    ? params.agreementId.slice(2)
    : params.agreementId;

  const opts = {
    compute: {
      da_type: 4,
      agreement: [Buffer.from(idHex, "hex")],
      verification: 0,
      compute: 1,
    },
  };

  return signAndSend(tx, account, opts);
}

/**
 * Convenience wrapper: creates an encrypted inference subscription then
 * immediately invokes it with the given input. Returns both receipts.
 *
 * @param params     - Input payload, guardians, guardian group crypto params, and fee.
 * @param encAccount - Ed25519 keypair whose public key is used to receive the encrypted result.
 * @param account    - Keypair used to sign and submit both transactions.
 */
export async function encryptedInferenceCompute(
  params: EncryptedInferenceComputeParams,
  encAccount: KeyringPair,
  account: KeyringPair,
) {
  const subscription = await encryptedInferenceSubscription(
    {
      guardians: params.guardians,
      fee: params.fee,
      deadline: params.deadline,
    },
    account,
  );

  if (!subscription.agreementId) {
    throw new Error("Subscription creation did not return an agreement ID");
  }

  const invocation = await encryptedInferenceSubscriptionInvocation(
    {
      agreementId: subscription.agreementId,
      input: params.input,
      guardians: params.guardians,
      guardianInfo: params.guardianInfo,
    },
    encAccount,
    account,
  );

  return { subscription, invocation };
}
