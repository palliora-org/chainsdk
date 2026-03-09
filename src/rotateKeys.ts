import assert from "assert";
import { getApi, provider, signAndSend } from "./chain";
import bs58 from 'bs58';

export async function rotateAndSetKeys(account: any) {
  const api = await getApi();

  assert(api, "API not initialized");

  console.log(`Rotating session keys for ${account.meta.name} on ${provider.endpoint}`);

  const newKeys = await api.rpc.author.rotateKeys();
  console.log(`${account.meta.name} rotated keys on ${provider.endpoint}:`, newKeys?.toHex?.() ?? newKeys);

  const setKeysTx = api.tx.session.setKeys(newKeys, []);
  const hash = await signAndSend(setKeysTx, account);

  console.log(`Rotate session transaction sent with hash: ${hash.hash}`);
}

export async function setWorker(account: any) {
  const api = await getApi();

  assert(api, "API not initialized");

  const peerid = bs58.decode((await api.rpc.system.localPeerId()).toString());
  const setWorkerTx = api.tx.guardian.setWorker(peerid.slice(0, 32));
  const hash = await signAndSend(setWorkerTx, account);

  console.log(`Set worker id transaction sent with hash: ${hash.hash}`);
}