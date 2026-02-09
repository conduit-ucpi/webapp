import { useMemo } from 'react';
import { Config } from '@/types';
import { TokenDetails } from '@/types/tokens';

export interface TokenSelectionResult {
  /** The currently selected token (based on URL param or default) */
  selectedToken: TokenDetails | null;

  /** The symbol of the selected token */
  selectedTokenSymbol: string;

  /** The address of the selected token */
  selectedTokenAddress: string;

  /** All available tokens */
  availableTokens: TokenDetails[];

  /** Find a token by symbol */
  findTokenBySymbol: (symbol: string) => TokenDetails | undefined;

  /** Check if a token is available */
  isTokenAvailable: (symbol: string) => boolean;
}

/**
 * Hook for centralized token selection logic
 *
 * This hook provides a single source of truth for token selection across the app.
 * It handles:
 * - URL parameter-based token selection (?tokenSymbol=USDT)
 * - Fallback to default token
 * - Legacy config support (usdcDetails/usdtDetails)
 *
 * @param config - Application configuration
 * @param queryTokenSymbol - Token symbol from URL query parameter
 * @returns Token selection result with helpers
 */
export function useTokenSelection(
  config: Config | null,
  queryTokenSymbol?: string
): TokenSelectionResult {

  const availableTokens = useMemo(() => {
    if (!config) return [];

    // Prefer new supportedTokens array
    if (config.supportedTokens && config.supportedTokens.length > 0) {
      return config.supportedTokens.filter(t => t.enabled !== false);
    }

    // Fallback to legacy fields
    const legacyTokens: TokenDetails[] = [];
    if (config.usdcDetails) {
      legacyTokens.push(config.usdcDetails);
    }
    if (config.usdtDetails) {
      legacyTokens.push(config.usdtDetails);
    }

    return legacyTokens;
  }, [config]);

  const findTokenBySymbol = useMemo(() => {
    return (symbol: string) => {
      return availableTokens.find(t =>
        t.symbol.toUpperCase() === symbol.toUpperCase()
      );
    };
  }, [availableTokens]);

  const selectedToken = useMemo(() => {
    if (!config || availableTokens.length === 0) return null;

    // If URL parameter provided, try to find that token
    if (queryTokenSymbol) {
      const token = findTokenBySymbol(queryTokenSymbol);
      if (token) {
        return token;
      }
      console.warn(`Token ${queryTokenSymbol} not found, falling back to default`);
    }

    // Use new defaultToken if available
    if (config.defaultToken) {
      return config.defaultToken;
    }

    // Fallback to legacy primaryToken
    if (config.primaryToken) {
      return config.primaryToken;
    }

    // Last resort: first available token
    return availableTokens[0] || null;
  }, [config, queryTokenSymbol, availableTokens, findTokenBySymbol]);

  const selectedTokenSymbol = useMemo(
    () => selectedToken?.symbol || 'USDC',
    [selectedToken]
  );

  const selectedTokenAddress = useMemo(
    () => selectedToken?.address || '',
    [selectedToken]
  );

  const isTokenAvailable = useMemo(() => {
    return (symbol: string) => {
      return availableTokens.some(t =>
        t.symbol.toUpperCase() === symbol.toUpperCase()
      );
    };
  }, [availableTokens]);

  return {
    selectedToken,
    selectedTokenSymbol,
    selectedTokenAddress,
    availableTokens,
    findTokenBySymbol,
    isTokenAvailable
  };
}
