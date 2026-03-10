import assert from "assert";
import { getApi, getGuardianNwParams, signAndSend } from "../chain";
import { hexToUint8Array, debugLog } from "../utils";

export const createGuardianGroup = async (account: any, selectedGuardians: any) => {
  try {
    const api = await getApi();

    assert(selectedGuardians.length >= 3, "Not enough guardians available to create a group");
    assert(account, "Failed to load account");
    assert(api, "Failed to initialize API");

    const tau_params = await getGuardianNwParams();
    assert(tau_params && tau_params !== "", "Failed to retrieve guardian network parameters");

    // For simplicity, select the first 3 guardians
    debugLog(`Selected guardians: ${selectedGuardians.join(", ")} and tau_params: ${tau_params}`);

    // Create and send the transaction
    const tx = api.tx.dataAvailability.daccGuardianGroup(
      selectedGuardians,
      Array.from(hexToUint8Array(tau_params)) // Use the new helper function
    );
    const result = await signAndSend(tx, account);

    debugLog("Guardian group created:", result);
  } catch (error) {
    console.error("Error creating guardian group:", error);
    throw new Error(`Failed to create guardian group: ${error instanceof Error ? error.message : error}`);
  }
};
