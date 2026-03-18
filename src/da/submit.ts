import { assert } from "../utils/assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function submitData(account: any, data: string) {
  const api = await getApi();

  assert(api, "API not initialized");

  debugLog(`\nSubmitting data with content length: ${data.length}`);

  const tx = api.tx.dataAvailability.submitData(data);
  const hash = await signAndSend(tx, account);

  debugLog(`Data availability transaction sent with hash: ${hash.hash}`);
}
