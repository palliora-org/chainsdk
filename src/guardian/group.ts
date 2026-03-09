import assert from "assert";
import { getApi, getGuardianNwParams, signAndSend } from "../chain";
import { hexToUint8Array } from "../utils/helper";
import { getGuardianList } from "./active";

export const createGuardianGroup = async (account: any) => {
  try {
    const guardians = await getGuardianList();
    const api = await getApi();

    console.log("Available guardians:", guardians);

    assert(guardians.length >= 3, "Not enough guardians available to create a group");
    assert(account, "Failed to load account");
    assert(api, "Failed to initialize API");

    const tau_params = await getGuardianNwParams();
    assert(tau_params && tau_params !== "", "Failed to retrieve guardian network parameters");

    // For simplicity, select the first 3 guardians
    const selectedGuardians = guardians.slice(1, 4);
    console.log(`Selected guardians: ${selectedGuardians.join(", ")} and tau_params: ${tau_params}`);

    // Create and send the transaction
    const tx = api.tx.dataAvailability.daccGuardianGroup(
      selectedGuardians, // Select first 3 guardians for simplicity
      Array.from(hexToUint8Array(tau_params)) // Use the new helper function
    );
    const result = await signAndSend(tx, account);

    console.log("Guardian group created:", result);
  } catch (error) {
    console.error("Error creating guardian group:", error);
    throw new Error(`Failed to create guardian group: ${error instanceof Error ? error.message : error}`);
  }
};
