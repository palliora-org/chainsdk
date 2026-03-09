import assert from "assert";
import { getApi, signAndSend } from "../chain";

export async function payoutStake(account: any, eras: Array<number>) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

for (const era of eras) {
    console.log("Paying account: ", account.address, " for era ", era);

    const unstakeTx = api.tx.staking.payoutStakers(account.address, era);
    const hash = await signAndSend(unstakeTx, account);

    console.log(`Unstake transaction sent with hash: ${hash.hash}`);
  }
}
