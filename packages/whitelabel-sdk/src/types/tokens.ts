/**
 * Token configuration types for multi-token support
 *
 * This file defines the structure for token configuration that can be provided
 * via the SUPPORTED_TOKENS environment variable as JSON.
 */

export interface TokenConfig {
  /** Token symbol (e.g., "USDC", "USDT", "DAI") */
  symbol: string;

  /** Contract address on the blockchain */
  address: string;

  /** Human-readable token name */
  name: string;

  /** Number of decimals (6 for USDC/USDT, 18 for DAI) */
  decimals: number;

  /** Whether this is the default token to use */
  isDefault?: boolean;

  /** Path to token icon/logo */
  icon?: string;

  /** Brand color for UI elements */
  color?: string;

  /** Whether this token is currently enabled */
  enabled?: boolean;

  /** Chain ID this token is deployed on */
  chainId?: number;
}

/**
 * Extended token details with on-chain information
 * This is what the config API returns after fetching on-chain data
 */
export interface TokenDetails extends TokenConfig {
  /** Total supply (optional, fetched from chain) */
  totalSupply?: string;

  /** Any additional on-chain data */
  [key: string]: any;
}

/**
 * Default token configuration for fallback
 * Used when SUPPORTED_TOKENS env var is not provided
 */
export const DEFAULT_TOKEN_CONFIG: TokenConfig[] = [
  {
    symbol: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USD Coin',
    decimals: 6,
    isDefault: true,
    icon: '/tokens/usdc.svg',
    color: '#2775CA',
    enabled: true,
    chainId: 8453
  }
];

/**
 * Validates token configuration
 */
export function isValidTokenConfig(token: any): token is TokenConfig {
  return (
    typeof token === 'object' &&
    typeof token.symbol === 'string' &&
    typeof token.address === 'string' &&
    token.address.match(/^0x[a-fA-F0-9]{40}$/) !== null &&
    typeof token.name === 'string' &&
    typeof token.decimals === 'number' &&
    token.decimals > 0
  );
}

/**
 * Parse and validate SUPPORTED_TOKENS from environment variable
 */
export function parseTokensFromEnv(envValue: string | undefined): TokenConfig[] {
  if (!envValue) {
    console.warn('SUPPORTED_TOKENS not provided, using default configuration');
    return DEFAULT_TOKEN_CONFIG;
  }

  try {
    const parsed = JSON.parse(envValue);

    if (!Array.isArray(parsed)) {
      console.error('SUPPORTED_TOKENS must be an array');
      return DEFAULT_TOKEN_CONFIG;
    }

    const validTokens = parsed.filter((token, index) => {
      const valid = isValidTokenConfig(token);
      if (!valid) {
        console.error(`Invalid token configuration at index ${index}:`, token);
      }
      return valid;
    });

    if (validTokens.length === 0) {
      console.error('No valid tokens found in SUPPORTED_TOKENS');
      return DEFAULT_TOKEN_CONFIG;
    }

    // Ensure at least one default token
    const hasDefault = validTokens.some(t => t.isDefault === true);
    if (!hasDefault) {
      console.warn('No default token specified, setting first token as default');
      validTokens[0].isDefault = true;
    }

    return validTokens;
  } catch (error) {
    console.error('Failed to parse SUPPORTED_TOKENS:', error);
    return DEFAULT_TOKEN_CONFIG;
  }
}
