import dotenv from "dotenv";
import { homedir } from "os";
import { join } from "path";
dotenv.config();

const DEFAULT_PALLIORA_DIR = join(homedir(), ".palliora");
export const PALLIORA_DIR = process.env.PALLIORA_DIR || DEFAULT_PALLIORA_DIR;

export const PALLIORA_KEYFILE = process.env.PALLIORA_KEYFILE || `${PALLIORA_DIR}/account.key`;
export const PALLIORA_WS = process.env.PALLIORA_WS || "wss://manas-rpc.palliora.org";
export const PALLIORA_RPC_URL = process.env.PALLIORA_RPC_URL || "wss://manas-rpc.palliora.org";

export const TX_WAIT_FINALIZATION = process.env.TX_WAIT_FINALIZATION ? true : false;