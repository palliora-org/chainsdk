import { assert } from "../utils/assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function payoutStake(account: any, eras: Array<number>) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

for (const era of eras) {
    debugLog("Paying account: ", account.address, " for era ", era);

    const unstakeTx = api.tx.staking.payoutStakers(account.address, era);
    const hash = await signAndSend(unstakeTx, account);

    debugLog(`Unstake transaction sent with hash: ${hash.hash}`);
  }
}
