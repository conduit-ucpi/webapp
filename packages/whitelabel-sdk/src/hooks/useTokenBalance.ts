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
  /** Balance as a decimal string in token units; '0' before the first successful read. */
  tokenBalance: string;
  /** True from the first read until one succeeds or the retries run out. */
  isLoadingBalance: boolean;
  /** Set when every retry failed: the balance shown is the last known, not a fresh read. */
  balanceError: boolean;
  /** Re-read the balance on demand. */
  refetch: () => Promise<void>;
}

/**
 * Read-only token-balance fetch shared by contract-create and contract-pay.
 * Verbatim extraction of the previously inline `fetchTokenBalance` effect:
 * reads via getTokenBalance (which goes through the read-only RpcClient — no
 * wallet access), exposes the balance + a loading flag, and retries a failed
 * read rather than reporting it as a zero balance.
 *
 * IMPORTANT: getTokenBalance is intentionally NOT in the effect deps. It comes
 * from useSimpleEthers, which returns a fresh object each render; including its
 * identity re-fires the effect every render (balance flashing / reload loop).
 * The gating primitives below capture every input that should re-trigger the
 * fetch. A ref holds the latest getTokenBalance so the effect always calls the
 * current implementation without depending on its identity.
 */
/** Backoff between balance retries. Four retries over ~22s covers a rate-limit window. */
export const RETRY_DELAYS_MS = [1500, 3000, 6000, 12000];

export function useTokenBalance(params: UseTokenBalanceParams): UseTokenBalanceResult {
  const { enabled, address, tokenAddress, getTokenBalance } = params;
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState(false);

  // Keep the latest getTokenBalance without making it an effect dependency.
  const getTokenBalanceRef = useRef(getTokenBalance);
  getTokenBalanceRef.current = getTokenBalance;

  // Bumped on every new fetch, so a retry chain from an older one stops quietly.
  const generation = useRef(0);

  /**
   * ⚠️ A FAILED READ IS NOT A BALANCE OF ZERO. It used to set '0', and the pay page then said
   *    "0.0000 USDC · 0.0010 USDC short" and disabled Pay for a wallet holding plenty — with
   *    nothing ever reading again. A rate-limited RPC ("over rate limit", which ethers reports
   *    as CALL_EXCEPTION "missing revert data") fails reads routinely and recovers in seconds,
   *    so: retry with backoff, stay "loading" meanwhile, and if it never answers keep the last
   *    known balance and say so.
   */
  const fetchBalance = useCallback(async () => {
    if (!enabled || !address || !tokenAddress) return;
    const mine = ++generation.current;
    setIsLoadingBalance(true);
    setBalanceError(false);
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const formattedBalance = await getTokenBalanceRef.current(address, tokenAddress);
        if (mine !== generation.current) return;
        setTokenBalance(formattedBalance);
        setIsLoadingBalance(false);
        return;
      } catch (error) {
        if (mine !== generation.current) return;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          console.error('useTokenBalance: failed to fetch balance, giving up after retries:', error);
          setBalanceError(true);
          setIsLoadingBalance(false);
          return;
        }
        console.warn(`useTokenBalance: balance read failed, retrying in ${delay}ms:`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (mine !== generation.current) return;
      }
    }
  }, [enabled, address, tokenAddress]);

  useEffect(() => {
    fetchBalance();
    // Unmount or new inputs: abandon any retry chain still waiting.
    return () => { generation.current++; };
  }, [fetchBalance]);

  return { tokenBalance, isLoadingBalance, balanceError, refetch: fetchBalance };
}
