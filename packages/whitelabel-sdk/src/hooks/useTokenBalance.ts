import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTokenBalanceParams {
  /**
   * Page-specific gate. create enables once a wallet is connected; pay also
   * requires the contract to be loaded. When false, no fetch is performed.
   */
  enabled: boolean;
  address: string | null | undefined;
  tokenAddress: string | undefined;
  getTokenBalance: (address: string, tokenAddress: string) => Promise<string>;
}

interface UseTokenBalanceResult {
  /** Balance as a decimal string in token units; '0' before load / on error. */
  tokenBalance: string;
  isLoadingBalance: boolean;
  /** Re-read the balance on demand. */
  refetch: () => Promise<void>;
}

/**
 * Read-only token-balance fetch shared by contract-create and contract-pay.
 * Verbatim extraction of the previously inline `fetchTokenBalance` effect:
 * reads via getTokenBalance (which goes through the read-only RpcClient — no
 * wallet access), exposes the balance + a loading flag, and falls back to '0'
 * on error.
 *
 * IMPORTANT: getTokenBalance is intentionally NOT in the effect deps. It comes
 * from useSimpleEthers, which returns a fresh object each render; including its
 * identity re-fires the effect every render (balance flashing / reload loop).
 * The gating primitives below capture every input that should re-trigger the
 * fetch. A ref holds the latest getTokenBalance so the effect always calls the
 * current implementation without depending on its identity.
 */
export function useTokenBalance(params: UseTokenBalanceParams): UseTokenBalanceResult {
  const { enabled, address, tokenAddress, getTokenBalance } = params;
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Keep the latest getTokenBalance without making it an effect dependency.
  const getTokenBalanceRef = useRef(getTokenBalance);
  getTokenBalanceRef.current = getTokenBalance;

  const fetchBalance = useCallback(async () => {
    if (!enabled || !address || !tokenAddress) return;
    setIsLoadingBalance(true);
    try {
      const formattedBalance = await getTokenBalanceRef.current(address, tokenAddress);
      setTokenBalance(formattedBalance);
    } catch (error) {
      console.error('useTokenBalance: failed to fetch balance:', error);
      setTokenBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  }, [enabled, address, tokenAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { tokenBalance, isLoadingBalance, refetch: fetchBalance };
}
