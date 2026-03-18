import bs58 from "bs58";
import { getApi, getKeyring, signAndSend } from "../chain";
import { getGuardianList } from "../guardian";
import { assert, debugLog } from "../utils";

export async function createAgreement() {
  const api = await getApi();
  if (!api) throw new Error("Api not initialized");

  const tx = (api.tx as any).compute.agreement();
  const guardians = await getGuardianList();
  const agreement = guardians
    .slice(0, 3)
    .map((g) => bs58.decode(g).subarray(6));
  assert(agreement.length === 3, "Not enough guardians to create agreement");

  const keyring = await getKeyring();
  const account = keyring.getPairs()[0];

  const { tx_result } = await signAndSend(tx, account, {
    compute: { da_type: 1, agreement, verification: 0, compute: 1 },
  } as any);

  if (!tx_result.isError) {
    const agreementCreatedEvent = tx_result.events.find((event: any) => {
      return (
        event.event.section === "compute" &&
        event.event.method === "AgreementCreated"
      );
    });

    if (agreementCreatedEvent) {
      debugLog(
        "Agreement data:",
        agreementCreatedEvent.event.data.toString(),
      );
    } else {
      debugLog("AgreementCreated event not found");
    }
  }
}

export default createAgreement;
