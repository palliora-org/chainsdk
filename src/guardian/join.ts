import { assert } from "../utils/assert";
import { getApi, signAndSend } from "../chain";
import { debugLog } from "../utils";

export async function joinGuardian(account: any, prefs: any) {
  const api = await getApi();

  assert(api, "API not initialized");
  assert(account, "Account not initialized");

  const computeOpts =
    (prefs.compute as string | undefined)
      ?.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0) || undefined;

  const guardianPrefs = {
    pubKey: account.publicKey,
    guardian: prefs.standard,
    verifier: prefs.verifier,
    compute: prefs.compute ? true : false,
    computePrefs: {
      trusted: computeOpts?.includes("trusted") || false,
      tee: computeOpts?.includes("tee") || false,
      mpc: computeOpts?.includes("mpc") || false,
      fhe: computeOpts?.includes("fhe") || false,
      zkp: computeOpts?.includes("zkp") || false,
    },
  };

  debugLog(
    account.address,
    "joining as guardian with preferences:",
    guardianPrefs
  );

  const guardTx = api.tx.staking.guard(guardianPrefs);
  const hash = await signAndSend(guardTx, account);

  debugLog("Guardian join tx sent with hash:", hash.hash);
}
