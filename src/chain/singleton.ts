/**
 * Module providing singleton access to Polkadot API, WebSocket provider, and keyring.
 *
 * This module ensures that only one instance of the WsProvider, ApiPromise and Keyring
 * are created and reused across the application. It exposes a class-based wrapper
 * (RpcApi) for managed connect/disconnect flows and convenience functions for directly
 * obtaining the singleton instances.
 *
 * Notes:
 * - The API is created with custom RPC, types and signed extensions provided by
 *   {@link API_RPC}, {@link API_TYPES} and {@link API_EXTENSIONS}.
 * - In non-test environments, the module attaches fatal handlers to the API that call
 *   `process.exit(0)` on error/disconnect to allow an external supervisor to restart
 *   the process.
 * - The keyring is created for `sr25519` keys. The convenience getter populates a
 *   default development account derived from the well-known dev URI `//Bob`
 *   (named "Bob default"). This is a development-only seed and MUST NOT be used
 *   in production.
 */
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { API_EXTENSIONS, API_RPC, API_TYPES } from "./spec";
import { provider } from "./wsProvider";
import { waitReady } from "@polkadot/wasm-crypto";

// Create singleton instances
let wsProvider: WsProvider | null = null;
let api: ApiPromise | null = null;
let keyring: Keyring | null = null;
// Separate keyring instance intended for encryption-related keys/usages.
let encKeyring: Keyring | null = null;

/**
 * Lightweight manager that holds and controls the lifecycle of the singleton
 * WsProvider, ApiPromise and Keyring instances.
 *
 * @remarks
 * - Instances are created lazily when {@link RpcApi.connect} is called.
 * - The class maintains simple connection state via `isConnected`, `isConnecting`,
 *   and `error` fields so callers can inspect the status without directly
 *   interrogating the underlying API/provider.
 * - Event handlers are attached to both the provider and the API to update `error`
 *   and `isConnected` appropriately when runtime errors or disconnects occur.
 *
 * @example
 * const rpc = getRpcApi();
 * await rpc.connect("wss://example.com");
 * const { api, keyring } = await rpc.getApi();
 *
 * @public
 */
export class RpcApi {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  constructor() {
    this.isConnected = false;
    this.isConnecting = false;
    this.error = null;
  }

  /**
   * Establishes a connection to a node at `endpoint` and returns the singleton
   * API and Keyring instances.
   *
   * @param endpoint - WebSocket endpoint URL to connect to (e.g. "wss://...").
   * @returns A promise resolving to an object containing the singleton {@link ApiPromise}
   *          instance and the singleton {@link Keyring} instance.
   *
   * @remarks
   * - If a connection already exists (`isConnected === true`) the method returns
   *   the already-initialized instances without recreating them.
   * - The method sets `isConnecting` to true while establishing the connection and
   *   clears it in a `finally` block.
   * - Provider and API event listeners update the instance `error` and `isConnected`
   *   fields on runtime errors and disconnects.
   * - The Keyring created here uses `sr25519` keys. If the standalone `getKeyring`
   *   helper is used elsewhere, it will additionally add a default development
   *   account derived from the well-known dev URI `//Bob` (named "Bob default").
   *
   * @throws Will re-throw underlying errors encountered while creating the provider
   *         or API. In that case `error` will contain the textual error message.
   */
  async connect(endpoint: string) {
    try {
      if (this.isConnected) {
        return { api, keyring };
      }

      this.isConnecting = true;
      this.error = null;

      // Create WsProvider only if it doesn't exist
      if (!wsProvider) {
        wsProvider = new WsProvider(endpoint);

        // Handle provider events
        wsProvider.on("error", (err) => {
          console.error("WsProvider error:", err);
          this.error = "WebSocket connection error";
          this.isConnected = false;
        });

        wsProvider.on("disconnected", () => {
          console.log("WsProvider disconnected");
          this.isConnected = false;
        });
      }

      // Create API only if it doesn't exist
      if (!api) {
        api = await ApiPromise.create({
          provider: wsProvider,
          rpc: API_RPC,
          types: API_TYPES,
          signedExtensions: API_EXTENSIONS,
        });

        // Handle API events
        api.on("error", (err) => {
          console.error("API error:", err);
          this.error = "API error occurred";
        });

        api.on("disconnected", () => {
          this.isConnected = false;
        });
      }

      // Create Keyring only if it doesn't exist
      if (!keyring) {
        keyring = new Keyring({ type: "sr25519" });
      }

      // Create encryption keyring only if it doesn't exist
      if (!encKeyring) {
        encKeyring = new Keyring({ type: "ed25519" });
      }

      await api.isReady;

      this.isConnected = true;
      return { api, keyring };
    } catch (err) {
      console.error("Failed to connect to Polkadot:", err);
      this.error = err instanceof Error ? err.message : "Failed to connect to Polkadot";
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Gracefully disconnects and nullifies the singleton API, provider and keyring
   * instances managed by this RpcApi instance.
   *
   * @remarks
   * - The method calls `api.disconnect()` and `wsProvider.disconnect()` if they
   *   exist, then sets the internal singletons to `null` and `isConnected` to false.
   * - Any error during disconnect is captured in `error`.
   */
  async disconnect() {
    try {
      if (api) {
        await api.disconnect();
        api = null;
      }
      if (wsProvider) {
        await wsProvider.disconnect();
        wsProvider = null;
      }
      keyring = null;
      this.isConnected = false;
    } catch (err) {
      console.error("Error disconnecting:", err);
      this.error = err instanceof Error ? err.message : "Failed to disconnect";
    }
  }

  getApi() {
    return api;
  }

  getKeyring() {
    return keyring;
  }

  getEncKeyring() {
    return encKeyring;
  }
}

/**
 * getApi()
 *
 * Returns the singleton {@link ApiPromise} instance, creating it if necessary.
 *
 * @remarks
 * - If no underlying `provider` is configured (the module-level `provider`
 *   imported from "./wsProvider"), this function returns `undefined`.
 * - When creating the API, the configured `rpc`, `types` and `signedExtensions`
 *   are applied.
 * - In non-test environments, top-level API `error` and `disconnected` events
 *   cause the process to exit so that an external supervisor can restart the
 *   process.
 *
 * @returns The singleton {@link ApiPromise} instance (or `undefined` if no provider).
 */
export async function getApi() {
  if (!provider) return;
  console.debug(provider.endpoint);

  if (!api) {
    api = await ApiPromise.create({
      provider,
      rpc: API_RPC,
      types: API_TYPES,
      signedExtensions: API_EXTENSIONS,
    });
  }
  if (process.env.NODE_ENV !== "test") {
    api.on("error", (err) => {
      console.error("api error, will restart:", err);
      process.exit(0);
    });
    api.on("disconnected", () => {
      console.error("api disconnected, will restart.");
      process.exit(0);
    });
  }
  return api;
}

/**
 * getKeyring()
 *
 * Returns the singleton {@link Keyring} instance, creating it if necessary.
 *
 * @remarks
 * - Ensures {@link waitReady} has resolved before constructing the keyring so
 *   that WASM crypto is initialized.
 * - The keyring is created with `type: "sr25519"`.
 * - The function also adds a default development account from the dev seed URI
 *   `//Bob` and labels it "Bob default".
 *
 * @important
 * The seed URI `//Bob` is a well-known development seed. It is convenient for
 * local testing but is insecure for any real funds or production use. Replace
 * or remove this default account when deploying to production.
 *
 * @returns The singleton {@link Keyring} instance.
 */
export async function getKeyring() {
  if (!keyring) {
    await waitReady();
    keyring = new Keyring({ type: "sr25519" });
    keyring.addFromUri('//Bob', { name: 'Bob default' });
  }
  return keyring;
}

/**
 * getEncKeyring()
 *
 * Returns the singleton encryption-focused {@link Keyring} instance, creating it
 * if necessary.
 *
 * @remarks
 * - Ensures {@link waitReady} has resolved before constructing the keyring so
 *   that WASM crypto is initialized.
 * - The keyring is created with `type: "sr25519"` and a development default
 *   account derived from the dev seed URI `//Bob` is added and labeled
 *   "Bob default (enc)".
 *
 * @important
 * The seed URI `//Bob` is a well-known development seed and MUST NOT be used
 * in production for real funds. Replace or remove this default when deploying
 * to production.
 *
 * @returns The singleton {@link Keyring} instance used for encryption keys.
 */
export async function getEncKeyring() {
  if (!encKeyring) {
    await waitReady();
    encKeyring = new Keyring({ type: "ed25519" });
    encKeyring.addFromUri('//Bob', { name: 'Bob default (enc)' });
  }
  return encKeyring;
}

// Singleton instance
let apiInstance: RpcApi | null = null;

/**
 * Returns the singleton {@link RpcApi} manager instance, creating it on first use.
 *
 * @returns The singleton {@link RpcApi}.
 */
export function getRpcApi(): RpcApi {
  if (!apiInstance) {
    apiInstance = new RpcApi();
  }
  return apiInstance;
}
