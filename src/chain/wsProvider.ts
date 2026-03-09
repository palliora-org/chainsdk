import { WsProvider } from "@polkadot/api";
import { PALLIORA_WS } from "../config";

export const provider = new WsProvider(PALLIORA_WS, 10000);
