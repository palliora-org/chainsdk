import type { KeyringPair } from "@polkadot/keyring/types";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import { getApi, signAndSend, watchForSubmissionReceipt, fetchAndDecodeExtrinsic } from "../chain";
import { createAgreement, buildFee } from "./agreement";
import {
  encrypt,
  decrypt,
  gen_stretched_key,
  gen_shared_key,
  testCrypt,
  generateRandomBytes,
} from "../crypto";
import { assert, debugLog, hexToUint8Array } from "../utils";
import type { Hex } from "../utils";
import type { Fee, SubmissionReceipt } from "../chain/types";
import type { CipherSuite, GuardianGroupInfo } from "../da/types";

/**
 * Fee terms an inference subscription is created with when the caller does not
 * supply its own. `amount` is the absolute fee offered for the agreement;
 * `computeRate` drives dynamic settlement per invocation.
 */
export const DEFAULT_INFERENCE_FEE: Fee = {
  amount: "4",
  computeRate: "0.001",
};

/** Strips an optional `0x` prefix — `hexToUint8Array` expects bare hex. */
const stripHex = (h: string): string => (h.startsWith("0x") ? h.slice(2) : h);

const toBytes = (h: string): Uint8Array => hexToUint8Array(stripHex(h) as Hex);

export interface InferenceSessionParams {
  /** Guardian group crypto params — `tauParams`, `aggKey`, `groupPk`, `guardians`. */
  guardianInfo: GuardianGroupInfo;
  /** sr25519 pair that signs and pays for the extrinsics. */
  account: KeyringPair;
  /** ed25519 pair whose public key the guardian seals the result to. */
  encAccount: KeyringPair;
  /**
   * Public key of the guardian node that performs the result re-encryption.
   * Pinned by the caller — the result shared secret is
   * `x25519(encAccount secret, nodePublicKey)`.
   */
  nodePublicKey: Uint8Array;
  /** Fee terms for the agreement. Defaults to {@link DEFAULT_INFERENCE_FEE}. */
  fee?: Fee;
  /** Block-number deadline. Defaults to 0 (no deadline). */
  deadline?: number;
  /**
   * Existing subscription agreement to reuse. When omitted, the first
   * {@link InferenceSession.submit} creates one.
   */
  agreementId?: string;
  /**
   * Guardians bound to `agreementId`. Required alongside it, since an invocation
   * must name the same guardian set the agreement was created with.
   */
  guardians?: string[];
}

/** A payload encrypted under the guardian group's threshold key, ready to submit. */
export interface PreparedInvocation {
  /** `CipherSuite::ThresholdHybrid` describing how `ciphertext` is wrapped. */
  cipher: CipherSuite;
  /** The encrypted payload bytes. */
  ciphertext: Uint8Array;
}

export interface SubmitResult {
  /** Agreement this invocation belongs to. */
  agreementId: string;
  /** True when this submission created the agreement rather than invoking one. */
  agreementCreated: boolean;
  /** Block the submitted extrinsic landed in. */
  blockNumber: number;
  /** Index of the submitted extrinsic within that block. */
  index: number;
}

export interface InferenceInvocation {
  /** The decrypted, JSON-parsed guardian payload. */
  response: unknown;
  agreementId: string;
  agreementCreated: boolean;
  /**
   * Identifier matched against the guardian's `compute.result` extrinsic. On this
   * runtime it is the agreement ID.
   */
  requestId: string;
  /** Where our submission landed. */
  invoke: { blockNumber: number; index: number };
  /** Where the guardian's result landed — the coordinates settlement is read from. */
  result: { blockHeight: number; extrinsicIndex: number };
}

/** The still-encrypted result, as read off the guardian's extrinsic. */
export interface FetchedResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

export interface InferenceSession {
  /** The agreement ID, once created or if one was supplied. */
  getAgreementId(): string | undefined;
  /** The guardian set bound to the agreement. */
  getGuardians(): string[];
  /** Threshold-encrypt a payload. Local only — no chain access. */
  prepare(input: Uint8Array | string): PreparedInvocation;
  /** Create the agreement (first call) or invoke it, submitting `prepared`. */
  submit(prepared: PreparedInvocation): Promise<SubmitResult>;
  /** Block until the guardian's `compute.result` extrinsic for this agreement lands. */
  awaitResult(timeoutMs?: number): Promise<SubmissionReceipt>;
  /** Fetch and decode the result extrinsic at `receipt`. Network-bound. */
  fetchResult(receipt: SubmissionReceipt): Promise<FetchedResult>;
  /** Decrypt a fetched result and parse it as JSON. Local CPU only. */
  decryptResult(fetched: FetchedResult): unknown;
  /** {@link fetchResult} then {@link decryptResult}. */
  readResult(receipt: SubmissionReceipt): Promise<unknown>;
  /** `prepare` → `submit` → `awaitResult` → `readResult`, in order. */
  invoke(input: Uint8Array | string, timeoutMs?: number): Promise<InferenceInvocation>;
}

/**
 * Opens a handle over a `Subscription` compute agreement for encrypted inference.
 *
 * The agreement is created lazily: the first {@link InferenceSession.submit} carries
 * the payload inline and creates it, and every later submit drives it through
 * `compute.invoke`. Pass `agreementId` and `guardians` to reuse one across sessions.
 *
 * The four steps are exposed individually as well as through {@link InferenceSession.invoke},
 * so callers that need to time or observe each phase can drive them directly. The
 * session itself measures nothing.
 *
 * @example
 * const session = await createInferenceSession({ guardianInfo, account, encAccount, nodePublicKey });
 * const { response } = await session.invoke(JSON.stringify({ model, messages }));
 */
export async function createInferenceSession(
  params: InferenceSessionParams,
): Promise<InferenceSession> {
  const { guardianInfo, account, encAccount, nodePublicKey } = params;

  assert(guardianInfo?.tauParams && guardianInfo?.aggKey && guardianInfo?.groupPk,
    "Guardian group info is missing tauParams, aggKey or groupPk");
  assert(account, "A signing account is required");
  assert(encAccount, "An encryption account is required");
  assert(nodePublicKey?.length === 32,
    `nodePublicKey must be 32 bytes, got ${nodePublicKey?.length ?? 0}`);

  let agreementId: string | undefined = params.agreementId;
  const guardians: string[] = params.guardians ?? guardianInfo.guardians ?? [];

  assert(guardians.length > 0, "No guardians available for this session");

  const prepare = (input: Uint8Array | string): PreparedInvocation => {
    const payloadBytes = typeof input === "string" ? new TextEncoder().encode(input) : input;

    // A fresh session key per payload — never reuse ikm across invocations.
    const { encoded: cyphtxt, ikm } = testCrypt(
      stripHex(guardianInfo.tauParams),
      stripHex(guardianInfo.aggKey),
    );
    const symKey = gen_stretched_key(toBytes(ikm as string));
    const { ciphertext, nonce } = encrypt(payloadBytes, symKey);

    const cipher: CipherSuite = {
      ThresholdHybrid: {
        thresholdParams: {
          SilentThreshold: {
            tdParams: Array.from(toBytes(cyphtxt as string)),
            pkBytes: Array.from(toBytes(guardianInfo.groupPk)),
            tauParams: Array.from(toBytes(guardianInfo.tauParams)),
          },
        },
        symmetricParams: { ChaCha20Poly1305: { nonce: Array.from(nonce) } },
      },
    };

    return { cipher, ciphertext };
  };

  const buildResultCipher = (): CipherSuite => {
    const resultNonce = generateRandomBytes(12);

    return {
      AsymmetricHybrid: {
        asymmetricParams: {
          Ed25519: {
            recipientPublicKey: Array.from(encAccount.publicKey),
            ephemeralPublicKey: Array.from(nodePublicKey),
            kdf: "HkdfSha256",
            salt: null,
            info: null,
          },
        },
        symmetricParams: { ChaCha20Poly1305: { nonce: Array.from(resultNonce) } },
      },
    };
  };

  const submit = async (prepared: PreparedInvocation): Promise<SubmitResult> => {
    const api = await getApi();
    if (!api) throw new Error("Api not initialized");

    const input = { Inline: { data: Array.from(prepared.ciphertext) } };

    if (agreementId) {
      const tx = (
        api.tx as Record<
          string,
          Record<string, (...args: unknown[]) => SubmittableExtrinsic<"promise">>
        >
      )["compute"]["invoke"](
        // The contract ID goes on the wire as raw bytes, not as a hex string.
        Array.from(toBytes(agreementId)),
        guardians,
        prepared.cipher,
        input,
      );

      const { blockNumber, index } = await signAndSend(tx, account);
      debugLog(`Invoked agreement ${agreementId} at ${blockNumber}-${index}`);

      return { agreementId, agreementCreated: false, blockNumber, index };
    }

    const computeStep = {
      cipher: prepared.cipher,
      computerIndices: guardians.map((_, i) => i),
      ...buildFee(params.fee ?? DEFAULT_INFERENCE_FEE),
      deadline: params.deadline ?? 0,
      confidentiality: { Trusted: 0 },
      feeFunction: null,
      programEnv: null,
      input,
      program: { NativeExecute: "Inference" },
      metadata: null,
    };

    const result = await createAgreement(
      {
        contractType: "Subscription",
        guardians,
        preCheck: null,
        compute: computeStep,
        postCheck: null,
        resultCipher: buildResultCipher(),
      },
      account,
    );

    if (!result.agreementId) {
      throw new Error("Agreement creation did not emit an AgreementCreated event");
    }

    agreementId = result.agreementId;
    debugLog(`Created subscription agreement ${agreementId}`);

    return {
      agreementId,
      agreementCreated: true,
      blockNumber: result.blockNumber,
      index: result.index,
    };
  };

  const awaitResult = async (timeoutMs?: number): Promise<SubmissionReceipt> => {
    if (!agreementId) throw new Error("No agreement to await a result for — submit first");
    return watchForSubmissionReceipt(agreementId, timeoutMs);
  };

  const fetchResult = async (receipt: SubmissionReceipt): Promise<FetchedResult> => {
    const { decoded } = await fetchAndDecodeExtrinsic(receipt.blockHeight, receipt.extrinsicIndex);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = (decoded.method as any).args;

    const ciphertextHex: string = args.contract.compute.input.Inline.data;
    const nonceHex: string =
      args.contract.compute.cipher.AsymmetricHybrid.symmetricParams.ChaCha20Poly1305.nonce;

    return { ciphertext: toBytes(ciphertextHex), nonce: toBytes(nonceHex) };
  };

  const decryptResult = (fetched: FetchedResult): unknown => {
    // The x25519 secret sits at bytes 16..48 of the PKCS8-encoded ed25519 pair.
    const selfKey = encAccount.encodePkcs8().slice(16, 48);
    const sharedKey = gen_shared_key(selfKey, nodePublicKey);

    const plaintext = decrypt(fetched.ciphertext, sharedKey, fetched.nonce);
    const text = new TextDecoder().decode(plaintext ?? new Uint8Array());

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Guardian result was not valid JSON: ${text.slice(0, 200)}`);
    }
  };

  const readResult = async (receipt: SubmissionReceipt): Promise<unknown> =>
    decryptResult(await fetchResult(receipt));

  const invoke = async (
    input: Uint8Array | string,
    timeoutMs?: number,
  ): Promise<InferenceInvocation> => {
    const prepared = prepare(input);
    const submitted = await submit(prepared);
    const receipt = await awaitResult(timeoutMs);
    const response = await readResult(receipt);

    return {
      response,
      agreementId: submitted.agreementId,
      agreementCreated: submitted.agreementCreated,
      requestId: submitted.agreementId,
      invoke: { blockNumber: submitted.blockNumber, index: submitted.index },
      result: { blockHeight: receipt.blockHeight, extrinsicIndex: receipt.extrinsicIndex },
    };
  };

  return {
    getAgreementId: () => agreementId,
    getGuardians: () => guardians,
    prepare,
    submit,
    awaitResult,
    fetchResult,
    decryptResult,
    readResult,
    invoke,
  };
}
