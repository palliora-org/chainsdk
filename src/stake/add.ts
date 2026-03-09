import assert from "assert";
import { getApi, signAndSend } from "../chain";

export async function addStake(account: any, amount: bigint) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  console.log("Using account:", account.address);

  const stakeTx = api.tx.staking.bondExtra(amount);
  const hash = await signAndSend(stakeTx, account);

  console.log(`Stake transaction sent with hash: ${hash.hash}`);
}
