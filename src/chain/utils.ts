import assert from "assert";
import { TX_WAIT_FINALIZATION } from "../config";
import { getApi } from "./singleton";
import { isFunction } from "@polkadot/util";
import { DEFAULT_COMPUTE_PAYLOAD } from "./spec";
import bs58 from "bs58";
import { getGuardianList } from "../guardian";

export const signAndSend = async (request: any, account: any, opts = DEFAULT_COMPUTE_PAYLOAD) => {
  const tx_result: any = await new Promise((res, err) => {
    request.signAndSend(account, (result: any) => {
      // console.trace(result.toHuman());
      if (result.isFinalized) {
        res(result);
      }
      if (!TX_WAIT_FINALIZATION && result.isInBlock) {
        res(result);
      }
      if (result.isError) err(result);
    });
  });
  // console.trace(tx_result.toHuman());

  if (tx_result.isError) {
    throw new Error(`Transaction failed with error: ${tx_result.error}`);
  }

  if (tx_result.dispatchError) {
    throw new Error(
      `Transaction dispatched with error: ${tx_result.dispatchError}`
    );
  }

  console.debug(
    `Transaction ${tx_result.txHash.toHex()} included in timepoint ${
      tx_result.blockNumber
    }-${tx_result.txIndex}`
  );

  return {
    blockNumber: tx_result?.blockNumber?.toNumber(),
    index: tx_result?.txIndex,
    hash: tx_result.txHash.toHex(),
    tx_result,
  };
};

export const getFileMetadataCall = async (
  api: any,
  metadataRef: [number, number]
) => {
  const block = await getBlock(api, metadataRef[0]);
  const call = block.block.extrinsics[metadataRef[1]];
  return call.method;
};

const getBlock = async (api: any, blockNumber: number) => {
  const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
  return await api.rpc.chain.getBlock(blockHash);
};

export const getGuardianAddress = async () => {
  try {
    const api = await getApi();

    if (!api) throw new Error("API not initialized");
    assert(
      isFunction(api.query["guardian"]?.["worker"]),
      `api.query.guardian.worker does not exist`,
    );

    const list = await getGuardianList();

    const addresses = await Promise.all(
      list.map(async (item) => {
        const peerid = bs58.decode(item).slice(0, 32);
        return ((await api.query["guardian"]["worker"](peerid)).toString());
      })
    );

    return list.map((peerid, index) => ({ peerid, address: addresses[index] }));
  } catch (error) {
    throw error;
  }
};

export const getGuardianNwParams = async () => {
  try {
    const api = await getApi();
    if (!api) throw new Error("API not initialized");

    const rpc = api.rpc as unknown as Record<
      string,
      Record<string, (...params: unknown[]) => Promise<unknown>>
    >;
    const section = "guardian";
    const method = "guardianNwParams";

    assert(
      isFunction(rpc[section]?.[method]),
      `api.rpc.${section}.guardianNwParams does not exist`
    );

    const guardianNwParams = (await rpc[section][method]()) as Record<
      string,
      unknown
    >;
    if (
      typeof guardianNwParams === "object" &&
      guardianNwParams !== null &&
      "kzg" in guardianNwParams
    ) {
      return (guardianNwParams.kzg as any).toHex().slice(2);
    } else {
      throw new Error(`Invalid ${guardianNwParams} format`);
    }
  } catch (error) {
    console.error({ error });
    throw error;
  }
};
