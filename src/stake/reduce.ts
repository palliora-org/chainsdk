import assert from "assert";
import { getApi, signAndSend } from "../chain";

export async function reduceStake(account: any, amount: bigint) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  console.log("Using account:", account.address);

  const unstakeTx = api.tx.staking.unbond(amount);
  const hash = await signAndSend(unstakeTx, account);

  console.log(`Unstake transaction sent with hash: ${hash.hash}`);
}
