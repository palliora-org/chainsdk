import { getApi, getGuardianAddress, getKeyring, signAndSend } from "../chain";
import { assert, debugLog, toAtomicPaliAmount } from "../utils";
import type { KeyringPair } from "@polkadot/keyring/types";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { GuardianAddress } from "../da/types";
import type { Fee } from "../chain/types";

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

  const tx = (
    api.tx as Record<
      string,
      Record<string, (...args: unknown[]) => SubmittableExtrinsic<"promise">>
    >
  )["compute"]["agreement"](contract, oracle_quore_id ?? null);
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
    const agreementCreatedEvent = tx_result.events.find(
      (event: {
        event: { section: string; method: string; data: unknown[] };
      }) => {
        return (
          event.event.section === "compute" &&
          event.event.method === "AgreementCreated"
        );
      },
    );

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
