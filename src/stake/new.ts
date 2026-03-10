import assert from "assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function newStake(
  account: any,
  amount: bigint,
  rewardDestination: string = "Staked"
) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  debugLog(
    `Staking amount: ${amount} for account: ${account.address} with reward destination: ${rewardDestination}`
  );

  const stakeTx = api.tx.staking.bond(amount, rewardDestination);
  const hash = await signAndSend(stakeTx, account);

  debugLog(`Stake transaction sent with hash: ${hash.hash}`);
}
