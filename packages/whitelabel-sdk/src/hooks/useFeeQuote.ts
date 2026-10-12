import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useConfig } from '../components/auth/ConfigProvider';
import { apiFetch } from '../lib/apiFetch';

/**
 * What the escrow factory charges on an amount, asked of the factory as the amount is typed.
 *
 * ⚠️ NEVER COMPUTED HERE. The fee rule is the factory's (`quoteCreatorFee`); /api/fee-quote asks
 *    it through chainservice. The site used to carry its own copy of the rule, which would have
 *    gone on quoting the old figure the moment the contract changed.
 *
 * Debounced, so a person typing "1250" asks once, not four times. `fee` is in whole tokens.
 */
export type FeeQuote =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'quoted'; fee: number }
  | { state: 'tooSmall' }
  | { state: 'unavailable' };

const DEBOUNCE_MS = 300;

export function useFeeQuote(amount: number | null, tokenSymbol?: string): FeeQuote {
  const { config } = useConfig();
  const token =
    config?.supportedTokens?.find((t) => t.symbol.toUpperCase() === (tokenSymbol ?? '').toUpperCase()) ??
    config?.defaultToken ??
    config?.supportedTokens?.[0];
  const tokenAddress = token?.address;
  const decimals = token?.decimals;
  const [quote, setQuote] = useState<FeeQuote>({ state: 'idle' });

  useEffect(() => {
    if (amount === null || !(amount > 0) || !tokenAddress || decimals === undefined) {
      setQuote({ state: 'idle' });
      return;
    }
    let baseUnits: bigint;
    try {
      baseUnits = ethers.parseUnits(String(amount), decimals);
    } catch {
      setQuote({ state: 'idle' });
      return;
    }
    if (baseUnits <= BigInt(0)) {
      setQuote({ state: 'idle' });
      return;
    }

    let cancelled = false;
    setQuote({ state: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const response = await apiFetch('/api/fee-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenAddress, amount: baseUnits.toString() }),
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !body.success) return setQuote({ state: 'unavailable' });
        if (body.amountTooSmall) return setQuote({ state: 'tooSmall' });
        setQuote({ state: 'quoted', fee: Number(ethers.formatUnits(BigInt(body.creatorFee), decimals)) });
      } catch {
        if (!cancelled) setQuote({ state: 'unavailable' });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, tokenAddress, decimals]);

  return quote;
}
