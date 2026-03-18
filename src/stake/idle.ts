import { getApi, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function joinIdleStaker(account: any, prefs: any) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const chillTx = api.tx.staking.chill();
  const hash = await signAndSend(chillTx, account);

  debugLog("Idle staker chill tx sent with hash:", hash.hash);
}
