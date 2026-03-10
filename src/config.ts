import dotenv from "dotenv";
dotenv.config();

export const PALLIORA_WS = process.env.PALLIORA_WS || "wss://manas-rpc.palliora.org";
export const PALLIORA_RPC_URL = process.env.PALLIORA_RPC_URL || "wss://manas-rpc.palliora.org";

// Debug flag for logging/tracing wrapper function execution
export const DEBUG = process.env.DEBUG === "true" || false;

export const TX_WAIT_FINALIZATION = process.env.TX_WAIT_FINALIZATION === "true" || false;