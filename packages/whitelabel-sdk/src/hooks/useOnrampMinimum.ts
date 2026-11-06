import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import { onrampFiatCurrency } from '../lib/coinbaseOnramp';
import { useExchangeRate } from './useExchangeRate';

export interface OnrampMinimum {
  /** As Coinbase states it, e.g. 2 in GBP. */
  amount: number;
  currency: string;
  /** The same limit in the token being paid, rounded up to the cent. */
  inTokens: number;
}

/**
 * The exchange's smallest purchase, for greying out what it would refuse.
 *
 * Null until it is known, and null if it cannot be: a failed lookup must not block a payment, and
 * Coinbase still refuses for itself. See pages/api/coinbase/onramp-minimum.ts.
 */
export function useOnrampMinimum(tokenSymbol: string, enabled: boolean): OnrampMinimum | null {
  const currency = onrampFiatCurrency();
  const { rate } = useExchangeRate(currency, tokenSymbol);
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(`/api/coinbase/onramp-minimum?currency=${currency}`, { credentials: 'omit' });
        const body = await response.json();
        if (!cancelled && response.ok && body.minimum > 0) setAmount(body.minimum);
      } catch {
        // Unknown, so nothing is greyed out.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currency, enabled]);

  if (amount === null || !rate) return null;
  return { amount, currency, inTokens: Math.ceil(amount * rate * 100) / 100 };
}
