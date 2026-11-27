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

type Quoter = (venue: SwapVenue, tokenIn: string, tokenOut: string, amount: bigint) => Promise<bigint>;
type QuoteState = { answer: bigint | null; state: SwapQuote['state'] };
const IDLE: QuoteState = { answer: null, state: 'idle' };

/**
 * One question of the quoter per amount, whichever way round it is asked.
 *
 * ⚠️ ASKED ONCE PER AMOUNT. A quote is an RPC call, and the public RPC refuses a page that makes
 *    them on every render (see prewarmTransferToContract). It is for display and for deciding
 *    whether the button is live; the conversion takes a fresh quote when the button is pressed.
 *
 * The quoter is held in a ref, not a dependency, for the reason useTokenBalance gives.
 */
function useQuote(venue: SwapVenue | null, tokenIn: string | undefined, tokenOut: string | undefined, units: bigint, quoter: Quoter): QuoteState {
  const [quote, setQuote] = useState<QuoteState>(IDLE);
  const quoterRef = useRef(quoter);
  quoterRef.current = quoter;

  const amount = units.toString();
  useEffect(() => {
    if (!venue || !tokenIn || !tokenOut || amount === '0' || amount.startsWith('-')) {
      setQuote(IDLE);
      return;
    }
    let cancelled = false;
    setQuote({ answer: null, state: 'quoting' });
    quoterRef
      .current(venue, tokenIn, tokenOut, BigInt(amount))
      .then((answer) => {
        if (!cancelled) setQuote({ answer, state: 'quoted' });
      })
      .catch(() => {
        if (!cancelled) setQuote({ answer: null, state: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [venue, tokenIn, tokenOut, amount]);

  return quote;
}

/** What it would cost to convert into exactly `amountOut`, for showing on the pay button. */
export function useSwapQuote({ venue, tokenIn, tokenOut, amountOut, quoteSwap }: UseSwapQuoteParams): SwapQuote {
  const { answer, state } = useQuote(venue, tokenIn, tokenOut, amountOut, quoteSwap);
  return { amountIn: answer, state };
}

export interface SaleQuote {
  /** What the sale would bring, in the wanted token's base units; null until quoted. */
  amountOut: bigint | null;
  state: SwapQuote['state'];
}

interface UseSaleQuoteParams {
  /** Null turns the quote off: nothing is asked of the chain. */
  venue: SwapVenue | null;
  tokenIn: string | undefined;
  tokenOut: string | undefined;
  /** Exactly what would leave, in the held token's base units. */
  amountIn: bigint;
  quoteSale: Quoter;
}

/** What selling exactly `amountIn` would bring, for showing on the wallet page's conversion. */
export function useSaleQuote({ venue, tokenIn, tokenOut, amountIn, quoteSale }: UseSaleQuoteParams): SaleQuote {
  const { answer, state } = useQuote(venue, tokenIn, tokenOut, amountIn, quoteSale);
  return { amountOut: answer, state };
}
