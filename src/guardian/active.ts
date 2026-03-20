import { getApi } from "../chain";
import { isFunction } from "@polkadot/util";
import { assert } from "../utils";

export const getGuardianList = async () => {
  const api = await getApi();
  if (!api) throw new Error("API not initialized");

  const rpc = api.rpc as unknown as Record<
    string,
    Record<string, (...params: unknown[]) => Promise<unknown>>
  >;
  const section = "guardian";
  const method = "guardianList";

  assert(
    isFunction(rpc[section]?.[method]),
    `api.rpc.${section}.${method} does not exist`,
  );

  const list = ((await rpc[section]["guardianList"]()) as Array<Text>)
    .map((item) => [item.toString()])
    .flat(1);

  return list;
};
