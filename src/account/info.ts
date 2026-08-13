import { getApi } from "../chain";
import { assert } from "../utils";
import { getBalance, type Balance } from "../token/balance";

export interface AccountInfo {
  address: string;
  nonce: number;
  balance: Balance;
  /** On-chain identity display name, or `null` if none is set. */
  displayName: string | null;
}

function extractDisplayName(display: unknown): string | null {
  if (!display || display === "None") return null;
  if (typeof display === "string") return display;
  if (typeof display === "object" && "Raw" in (display as Record<string, unknown>)) {
    return String((display as { Raw: unknown }).Raw);
  }
  return null;
}

/** Convenience read combining balance, nonce, and identity display name for a single account. */
export async function getAccountInfo(address: string): Promise<AccountInfo> {
  const api = await getApi();
  assert(api, "API not initialized");

  const [accountData, balance, identity] = await Promise.all([
    api.query.system.account(address),
    getBalance(address),
    api.query.identity.identityOf(address),
  ]);

  const nonce = (accountData.toPrimitive() as { nonce: number }).nonce;
  const identityHuman = identity.toHuman() as { info?: { display?: unknown } } | null;

  return {
    address,
    nonce,
    balance,
    displayName: extractDisplayName(identityHuman?.info?.display),
  };
}
