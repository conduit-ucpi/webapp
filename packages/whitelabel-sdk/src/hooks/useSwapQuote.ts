import { useEffect, useRef, useState } from 'react';
import type { SwapVenue } from '../lib/stablecoinSwap';

export interface SwapQuote {
  /** What the conversion costs, in the paying token's base units; null until quoted. */
  amountIn: bigint | null;
  state: 'idle' | 'quoting' | 'quoted' | 'failed';
}

interface UseSwapQuoteParams {
  /** Null turns the quote off: nothing is asked of the chain. */
  venue: SwapVenue | null;
  tokenIn: string | undefined;
  tokenOut: string | undefined;
  /** Exactly what must arrive, in the wanted token's base units. */
  amountOut: bigint;
  quoteSwap: (venue: SwapVenue, tokenIn: string, tokenOut: string, amountOut: bigint) => Promise<bigint>;
}

const IDLE: SwapQuote = { amountIn: null, state: 'idle' };

/**
 * What it would cost to convert into exactly `amountOut`, for showing on the pay button.
 *
 * ⚠️ ASKED ONCE PER AMOUNT. A quote is an RPC call, and the public RPC refuses a page that makes
 *    them on every render (see prewarmTransferToContract). It is for display and for deciding
 *    whether the button is live; the payment takes a fresh quote when the button is pressed.
 *
 * quoteSwap is held in a ref, not a dependency, for the reason useTokenBalance gives.
 */
export function useSwapQuote({ venue, tokenIn, tokenOut, amountOut, quoteSwap }: UseSwapQuoteParams): SwapQuote {
  const [quote, setQuote] = useState<SwapQuote>(IDLE);
  const quoteSwapRef = useRef(quoteSwap);
  quoteSwapRef.current = quoteSwap;

  const amount = amountOut.toString();
  useEffect(() => {
    if (!venue || !tokenIn || !tokenOut || amount === '0' || amount.startsWith('-')) {
      setQuote(IDLE);
      return;
    }
    let cancelled = false;
    setQuote({ amountIn: null, state: 'quoting' });
    quoteSwapRef
      .current(venue, tokenIn, tokenOut, BigInt(amount))
      .then((amountIn) => {
        if (!cancelled) setQuote({ amountIn, state: 'quoted' });
      })
      .catch(() => {
        if (!cancelled) setQuote({ amountIn: null, state: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [venue, tokenIn, tokenOut, amount]);

  return quote;
}
