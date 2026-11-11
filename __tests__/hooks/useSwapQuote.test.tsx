/**
 * The quote behind "Pay … using your USDC": asked once per amount, and never when it is off.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useSwapQuote } from '@/hooks/useSwapQuote';
import { SWAP_VENUES } from '@/lib/stablecoinSwap';

const venue = SWAP_VENUES[8453];
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2';

describe('useSwapQuote', () => {
  it('quotes the amount and reports the cost', async () => {
    const quoteSwap = jest.fn().mockResolvedValue(BigInt(19_985_028));
    const { result } = renderHook(() =>
      useSwapQuote({ venue, tokenIn: USDC, tokenOut: USDT, amountOut: BigInt(20_000_000), quoteSwap })
    );
    expect(result.current.state).toBe('quoting');
    await waitFor(() => expect(result.current.state).toBe('quoted'));
    expect(result.current.amountIn).toBe(BigInt(19_985_028));
    expect(quoteSwap).toHaveBeenCalledWith(venue, USDC, USDT, BigInt(20_000_000));
  });

  it('asks once however often the page renders, and again only for a new amount', async () => {
    const quoteSwap = jest.fn().mockResolvedValue(BigInt(1));
    const { result, rerender } = renderHook(
      ({ amountOut }) =>
        // A new function each render, as useSimpleEthers hands out.
        useSwapQuote({ venue, tokenIn: USDC, tokenOut: USDT, amountOut, quoteSwap: (...args) => quoteSwap(...args) }),
      { initialProps: { amountOut: BigInt(20_000_000) } }
    );
    await waitFor(() => expect(result.current.state).toBe('quoted'));
    rerender({ amountOut: BigInt(20_000_000) });
    rerender({ amountOut: BigInt(20_000_000) });
    expect(quoteSwap).toHaveBeenCalledTimes(1);
    rerender({ amountOut: BigInt(5_000_000) });
    await waitFor(() => expect(quoteSwap).toHaveBeenCalledTimes(2));
  });

  it('asks nothing with no venue, or nothing to convert', () => {
    const quoteSwap = jest.fn();
    const off = renderHook(() => useSwapQuote({ venue: null, tokenIn: USDC, tokenOut: USDT, amountOut: BigInt(1), quoteSwap }));
    const nothing = renderHook(() => useSwapQuote({ venue, tokenIn: USDC, tokenOut: USDT, amountOut: BigInt(0), quoteSwap }));
    expect(off.result.current.state).toBe('idle');
    expect(nothing.result.current.state).toBe('idle');
    expect(quoteSwap).not.toHaveBeenCalled();
  });

  it('says so when the pool cannot quote it', async () => {
    const quoteSwap = jest.fn().mockRejectedValue(new Error('execution reverted'));
    const { result } = renderHook(() =>
      useSwapQuote({ venue, tokenIn: USDC, tokenOut: USDT, amountOut: BigInt(20_000_000), quoteSwap })
    );
    await waitFor(() => expect(result.current.state).toBe('failed'));
    expect(result.current.amountIn).toBeNull();
  });
});
