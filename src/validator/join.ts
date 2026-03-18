import { getApi, signAndSend } from "../chain";
import { assert, debugLog } from "../utils";

export async function joinValidator(account: any, commission: number) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const validateTx = api.tx.staking.validate({commission, blocked: true});
  const hash = await signAndSend(validateTx, account);

  debugLog("Validator join tx sent with hash:", hash.hash);
}
