import assert from "assert";
import { getApi, signAndSend } from "./chain";
import { debugLog } from "./utils/helper";

export async function setIdentity(account: any, {display = undefined}: any) {
	const api = await getApi();

	assert(api, "API not initialized");

	debugLog(`\nSetting identity for account: ${account.address} as ${display}`);

	const tx = api.tx.identity.setIdentity({display: {Raw: display}});
	const hash = await signAndSend(tx, account);

	debugLog(`Set identity transaction sent with hash: ${hash.hash}`);
}

