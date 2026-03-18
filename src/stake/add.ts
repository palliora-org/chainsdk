import { getApi, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function addStake(account: any, amount: bigint) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  debugLog("Using account:", account.address);

  const stakeTx = api.tx.staking.bondExtra(amount);
  const hash = await signAndSend(stakeTx, account);

  debugLog(`Stake transaction sent with hash: ${hash.hash}`);
}
