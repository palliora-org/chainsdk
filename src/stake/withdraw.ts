import assert from "assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function withdrawStake(account: any) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const unstakeTx = api.tx.staking.withdrawUnbonded(0);
  const hash = await signAndSend(unstakeTx, account);

  debugLog(`Unstake transaction sent with hash: ${hash.hash}`);
}
