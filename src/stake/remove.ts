import assert from "assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function removeStake(account: any) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const stakeAmount: any = (await api.query.staking.ledger(account.address))?.toPrimitive();

  debugLog("Removing entire stake amount:", stakeAmount?.active || 0n);

  const unstakeTx = api.tx.staking.unbond(stakeAmount?.active || 0n);
  const hash = await signAndSend(unstakeTx, account);

  debugLog(`Unstake transaction sent with hash: ${hash.hash}`);
}
