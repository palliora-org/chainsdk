import { findEvent, getApi, getGuardianAddress, getKeyring, signAndSend } from "../chain";
import { assert, debugLog, toAtomicPaliAmount } from "../utils";
import type { KeyringPair } from "@polkadot/keyring/types";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { GuardianAddress } from "../da/types";
import type { CurrencyId, Fee } from "../chain/types";

/**
 * Converts a {@link Fee} into the on-chain `fees` / `computeRate` pair.
 * `computeRate` only has meaning for `Active` contracts (it drives dynamic
 * fee calculation during `compute.result`); omit `computeRate` for `Dormant`
 * contracts.
 */
export function buildFee(fee?: Fee) {
  return {
    fees: toAtomicPaliAmount(fee?.amount ?? "0"),
    computeRate: toAtomicPaliAmount(fee?.computeRate ?? "0"),
  };
}

export interface ComputeContract {
  contractType: "Active" | "Dormant";
  guardians: GuardianAddress[];
  preCheck?: unknown;
  compute: Record<string, unknown>;
  postCheck?: unknown;
  resultCipher: unknown;
  /** Currency the deposit is reserved in and settlement is paid out in. Defaults to "Native". */
  currencyId?: CurrencyId;
}

export async function createAgreement(
  contract: ComputeContract,
  account: KeyringPair,
  oracle_quore_id: string | undefined = undefined,
): Promise<{
  blockNumber: number;
  index: number;
  hash: string;
  agreementId?: string;
}> {
  const api = await getApi();
  if (!api) throw new Error("Api not initialized");

  // currencyId defaults to "Native", reproducing pre-upgrade behavior for callers
  // that don't opt into paying the contract deposit/settlement in another currency.
  const onChainContract = { currencyId: "Native" as const, ...contract };

  const tx = (
    api.tx as Record<
      string,
      Record<string, (...args: unknown[]) => SubmittableExtrinsic<"promise">>
    >
  )["compute"]["agreement"](onChainContract, oracle_quore_id ?? null);
  const opts = {
    compute: {
      daType: 1,
      verification: 0,
      compute: contract.contractType === "Active" ? 1 : 0,
    },
  };

  const { tx_result, blockNumber, index, hash } = await signAndSend(
    tx,
    account,
    opts,
  );

  if (!tx_result.isError) {
    const agreementCreatedEvent = findEvent(tx_result.events, "compute", "AgreementCreated");

    if (agreementCreatedEvent) {
      debugLog("Agreement data:", agreementCreatedEvent.event.data.toString());
      return {
        blockNumber,
        index: index ?? 0,
        hash,
        agreementId:
          agreementCreatedEvent.event.data[0]?.toHex?.() ??
          agreementCreatedEvent.event.data.toString(),
      };
    } else {
      debugLog("AgreementCreated event not found");
    }
  }

  return { blockNumber, index: index ?? 0, hash };
}

export interface InvokeAgreementInput {
  /** Guardian account IDs handling the invocation; matches the agreement's guardian set. */
  guardians: GuardianAddress[];
  /** Cipher suite describing how `data` is encrypted. Use "Plaintext" for unencrypted payloads. */
  cipher: unknown;
  /** Invocation payload bytes (already encrypted if `cipher` is not "Plaintext"). */
  data: Uint8Array | number[];
}

/**
 * Invokes an existing `Subscription`-type agreement with a new payload, via
 * `compute.invoke`.
 *
 * @param agreementId - Hex-encoded agreement ID (as returned by `createAgreement`).
 */
export async function invokeAgreement(
  agreementId: string,
  input: InvokeAgreementInput,
  account: KeyringPair,
  opts?: Record<string, unknown>,
) {
  const api = await getApi();
  if (!api) throw new Error("Api not initialized");

  const tx = (
    api.tx as Record<
      string,
      Record<string, (...args: unknown[]) => SubmittableExtrinsic<"promise">>
    >
  )["compute"]["invoke"](
    agreementId,
    input.guardians,
    input.cipher,
    { Inline: { data: Array.from(input.data) } },
  );

  return signAndSend(tx, account, opts);
}

export async function createSimpleAgreement() {
  const guardianIds = (await getGuardianAddress())
    .slice(0, 3)
    .map((g) => g.address);
  assert(guardianIds.length === 3, "Not enough guardians to create agreement");

  const contract = {
    contractType: "Dormant" as const,
    guardians: guardianIds,
    preCheck: null,
    compute: {
      cipher: "Plaintext",
      computerIndices: [0, 1, 2],
      ...buildFee({ amount: "0", computeRate: "0" }),
      deadline: 0,
      confidentiality: { Trusted: 0 },
      feeFunction: null,
      input: null,
      program: { NativeData: "DaFalse" },
      metadata: null,
    },
    postCheck: null,
    resultCipher: "Plaintext",
  };

  const keyring = await getKeyring();
  const account = keyring.getPairs()[0];

  return createAgreement(contract, account);
}

export default createSimpleAgreement;
