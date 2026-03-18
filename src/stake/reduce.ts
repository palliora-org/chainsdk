import { getApi, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function reduceStake(account: any, amount: bigint) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  debugLog("Using account:", account.address);

  const unstakeTx = api.tx.staking.unbond(amount);
  const hash = await signAndSend(unstakeTx, account);

  debugLog(`Unstake transaction sent with hash: ${hash.hash}`);
}
