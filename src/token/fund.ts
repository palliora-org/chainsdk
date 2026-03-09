import assert from "assert";
import { getApi, getKeyring, signAndSend } from "../chain";

export async function fundAccount(account: any, amount: bigint, address?: string) {
  const addr = address ? address : account.address;
  const keyring = await getKeyring();
  const api = await getApi();

  assert(api, "API not initialized");

  console.log(`\nFunding account: ${addr} with amount: ${amount}`);

  const tx = api.tx.balances.transferKeepAlive(addr, amount);
  const hash = await signAndSend(tx, keyring.getPairs()[0]);

  console.log(`Fund transaction sent with hash: ${hash.hash}`);
}
