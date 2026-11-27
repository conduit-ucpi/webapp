/**
 * TDD spec for useTokenBalance — the read-only token-balance fetch extracted
 * from contract-create.tsx and contract-pay.tsx.
 *
 * Behavior being locked (identical in both pages, modulo the enable gate):
 *  - when enabled (address + tokenAddress + rpc present, page-specific gate),
 *    fetches the balance via getTokenBalance and exposes it as a string
 *  - exposes isLoadingBalance around the fetch
 *  - on error, retries with backoff; never reports a failed read as a zero balance (never throws)
 *  - does NOT fetch while disabled
 *  - re-renders that only change getTokenBalance identity do NOT re-fetch
 *    (loop-prevention: getTokenBalance excluded from deps)
 *  - refetch() re-runs the fetch on demand
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useTokenBalance, RETRY_DELAYS_MS } from '@/hooks/useTokenBalance';

describe('useTokenBalance', () => {
  let getTokenBalance: jest.Mock;

  const params = (overrides = {}) => ({
    enabled: true,
    address: '0xUser',
    tokenAddress: '0xToken',
    getTokenBalance,
    ...overrides,
  });

  beforeEach(() => {
    getTokenBalance = jest.fn().mockResolvedValue('42.5');
  });

  afterEach(() => jest.clearAllMocks());

  it('fetches and exposes the balance when enabled', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(result.current.tokenBalance).toBe('42.5'));
    expect(getTokenBalance).toHaveBeenCalledWith('0xUser', '0xToken');
  });

  it('starts with a "0" balance before the fetch resolves', () => {
    getTokenBalance.mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTokenBalance(params()));
    expect(result.current.tokenBalance).toBe('0');
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useTokenBalance(params({ enabled: false })));
    await new Promise((r) => setTimeout(r, 50));
    expect(getTokenBalance).not.toHaveBeenCalled();
  });

  it('does not fetch when address or tokenAddress is missing', async () => {
    renderHook(() => useTokenBalance(params({ address: undefined })));
    await new Promise((r) => setTimeout(r, 50));
    expect(getTokenBalance).not.toHaveBeenCalled();
  });

  /**
   * A failed read is not a zero balance. Reporting it as '0' made the pay page say "0.0010 USDC
   * short" and disable Pay for a funded wallet, with nothing ever reading again.
   */
  describe('when a read fails', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const flush = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };

    it('retries, stays loading meanwhile, and shows the balance once a read succeeds', async () => {
      getTokenBalance
        .mockRejectedValueOnce(new Error('over rate limit'))
        .mockRejectedValueOnce(new Error('over rate limit'))
        .mockResolvedValue('0.226');
      const { result } = renderHook(() => useTokenBalance(params()));

      await flush(0);
      expect(result.current.isLoadingBalance).toBe(true);
      expect(result.current.tokenBalance).toBe('0');

      await flush(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1]);
      expect(getTokenBalance).toHaveBeenCalledTimes(3);
      expect(result.current.tokenBalance).toBe('0.226');
      expect(result.current.isLoadingBalance).toBe(false);
      expect(result.current.balanceError).toBe(false);
    });

    it('gives up after the last retry, flags the error, and does not throw', async () => {
      getTokenBalance.mockRejectedValue(new Error('rpc down'));
      const { result } = renderHook(() => useTokenBalance(params()));

      await flush(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 100);
      expect(getTokenBalance).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
      expect(result.current.balanceError).toBe(true);
      expect(result.current.isLoadingBalance).toBe(false);
    });

    it('keeps the last known balance rather than replacing it with zero', async () => {
      getTokenBalance.mockResolvedValueOnce('5.0').mockRejectedValue(new Error('rpc down'));
      const { result } = renderHook(() => useTokenBalance(params()));
      await flush(0);
      expect(result.current.tokenBalance).toBe('5.0');

      act(() => { void result.current.refetch(); });
      await flush(RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 100);
      expect(result.current.tokenBalance).toBe('5.0');
      expect(result.current.balanceError).toBe(true);
    });

    it('stops retrying once unmounted', async () => {
      getTokenBalance.mockRejectedValue(new Error('rpc down'));
      const { unmount } = renderHook(() => useTokenBalance(params()));
      await flush(0);
      unmount();
      await flush(60_000);
      expect(getTokenBalance).toHaveBeenCalledTimes(1);
    });
  });

  it('exposes isLoadingBalance=false after the fetch settles', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(result.current.isLoadingBalance).toBe(false));
    expect(result.current.tokenBalance).toBe('42.5');
  });

  it('does not re-fetch when only getTokenBalance identity changes (loop-prevention)', async () => {
    const { rerender } = renderHook((props) => useTokenBalance(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    // useSimpleEthers returns a fresh object every render — a new getTokenBalance
    // identity must NOT re-trigger the effect (that was the balance-flash loop).
    const newGetBalance = jest.fn().mockResolvedValue('42.5');
    rerender(params({ getTokenBalance: newGetBalance }));
    await new Promise((r) => setTimeout(r, 50));
    expect(newGetBalance).not.toHaveBeenCalled();
    expect(getTokenBalance).toHaveBeenCalledTimes(1);
  });

  it('refetch() triggers a fresh balance read', async () => {
    const { result } = renderHook(() => useTokenBalance(params()));
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    getTokenBalance.mockResolvedValue('100');
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.tokenBalance).toBe('100');
    expect(getTokenBalance).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when the gating inputs change (e.g. tokenAddress)', async () => {
    const { rerender } = renderHook((props) => useTokenBalance(props), {
      initialProps: params(),
    });
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(1));

    rerender(params({ tokenAddress: '0xOtherToken' }));
    await waitFor(() => expect(getTokenBalance).toHaveBeenCalledTimes(2));
    expect(getTokenBalance).toHaveBeenLastCalledWith('0xUser', '0xOtherToken');
  });
});
