import { getApi } from "../chain";
import { assert } from "../utils";
import { formatBalanceWithTokenProperties } from "../utils/token";

export interface Balance {
  free: bigint;
  reserved: bigint;
  frozen: bigint;
  /** Free balance formatted with the chain's token symbol/decimals, e.g. "1.5 PALI". */
  formatted: string;
}

/** Reads an account's free/reserved/frozen balance from `system.account`. */
export async function getBalance(address: string): Promise<Balance> {
  const api = await getApi();
  assert(api, "API not initialized");

  const account = (await api.query.system.account(address)).toPrimitive() as {
    data: { free: string | number; reserved: string | number; frozen: string | number };
  };

  const free = BigInt(account.data.free);
  const reserved = BigInt(account.data.reserved);
  const frozen = BigInt(account.data.frozen);

  return {
    free,
    reserved,
    frozen,
    formatted: await formatBalanceWithTokenProperties(free),
  };
}
