import assert from "assert";
import { getApi, signAndSend } from "../chain";

export async function transfer(account: any, amount: bigint, address: string) {
  const api = await getApi();

  assert(api, "API not initialized");

  console.log(`\nTransferring funds to account: ${address} with amount: ${amount}`);

  const tx = api.tx.balances.transferKeepAlive(address, amount);
  const hash = await signAndSend(tx, account);

  console.log(`Transfer transaction sent with hash: ${hash.hash}`);
}
