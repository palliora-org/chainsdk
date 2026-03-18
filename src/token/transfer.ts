import { getApi, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function transfer(account: any, amount: bigint, address: string) {
  const api = await getApi();

  assert(api, "API not initialized");

  debugLog(`\nTransferring funds to account: ${address} with amount: ${amount}`);

  const tx = api.tx.balances.transferKeepAlive(address, amount);
  const hash = await signAndSend(tx, account);

  debugLog(`Transfer transaction sent with hash: ${hash.hash}`);
}
