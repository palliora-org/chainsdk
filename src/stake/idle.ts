import assert from "assert";
import { getApi, signAndSend } from "../chain";

export async function joinIdleStaker(account: any, prefs: any) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const chillTx = api.tx.staking.chill();
  const hash = await signAndSend(chillTx, account);

  console.log("Idle staker chill tx sent with hash:", hash.hash);
}
