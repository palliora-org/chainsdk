import { getApi, getKeyring, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function fundAccount(account: any, amount: bigint, address?: string) {
  const addr = address ? address : account.address;
  const keyring = await getKeyring();
  const api = await getApi();

  assert(api, "API not initialized");

  debugLog(`\nFunding account: ${addr} with amount: ${amount}`);

  const tx = api.tx.balances.transferKeepAlive(addr, amount);
  const hash = await signAndSend(tx, keyring.getPairs()[0]);

  debugLog(`Fund transaction sent with hash: ${hash.hash}`);
}
