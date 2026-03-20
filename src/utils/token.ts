import { assert } from "./assert";
import { formatBalance } from "@polkadot/util";
import { getApi } from "../chain";

interface TokenProperties {
  symbol: string;
  decimals: number;
}

let tokenCache: TokenProperties | null = null;

/**
 * Fetch token name and decimals from RPC system properties
 * Results are cached for subsequent calls
 * @param rpc - RPC provider instance with system.properties method
 * @returns Promise<TokenProperties> with symbol and decimals
 */
export async function fetchTokenProperties(): Promise<TokenProperties> {
  // Return cached value if available
  if (tokenCache) {
    return tokenCache;
  }

  try {
    const systemProperties = (await (await getApi())?.rpc.system.properties())?.toHuman();

    assert(systemProperties, "Failed to fetch system properties from RPC");

    const tokenProperties: TokenProperties = {
      symbol: (systemProperties?.tokenSymbol as string[] || ["UNIT"])[0],
      decimals: Number((systemProperties?.tokenDecimals as string[] || ['18'])[0]),
    };

    // Store in cache
    tokenCache = tokenProperties;

    return tokenProperties;
  } catch (error) {
    console.error("Failed to fetch token properties:", error);
    throw error;
  }
}

/**
 * Get cached token properties without making an RPC call
 * @returns TokenProperties or null if not yet cached
 */
export function getCachedTokenProperties(): TokenProperties | null {
  return tokenCache;
}

/**
 * Clear the token properties cache
 */
export function clearTokenCache(): void {
  tokenCache = null;
}

/**
 * Format balance using cached token properties
 * @param balance - The balance value to format
 * @returns Formatted balance string
 */
export async function formatBalanceWithTokenProperties(balance: string | number): Promise<string> {
  const tokenProperties = await fetchTokenProperties();
  
  if (!tokenProperties) {
    throw new Error(
      "Token properties not yet cached. Call fetchTokenProperties first.",
    );
  }

  return formatBalance(balance, {
    decimals: tokenProperties.decimals,
    withSi: true,
    withUnit: tokenProperties.symbol,
  });
}
